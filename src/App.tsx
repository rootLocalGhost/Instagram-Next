import { Component, createSignal, onMount, onCleanup, createEffect } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { TitleBar } from './components/TitleBar';
import { SettingsModal } from './components/SettingsModal';
import { NotificationDrawer } from './components/NotificationDrawer';
import { AppSettings, InterceptedNotification } from './types';
import './App.css';

const DEFAULT_SETTINGS: AppSettings = {
  enableNativeNotifications: true,
  enableSound: true,
  enablePreviews: true,
  alertOnBadgeIncrease: true,
  closeToTray: true,
  minimizeToTray: false,
  alwaysOnTop: false,
  zoomLevel: 1.0,
  userAgent: 'desktop-chrome',
  theme: 'dark'
};

const App: Component = () => {
  // Application State
  const [currentPath, setCurrentPath] = createSignal('/');
  const [unreadCount, setUnreadCount] = createSignal(0);
  const [zoomLevel, setZoomLevel] = createSignal(1.0);
  const [isSettingsOpen, setIsSettingsOpen] = createSignal(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = createSignal(false);
  const [notifications, setNotifications] = createSignal<InterceptedNotification[]>([]);

  // Load settings from storage
  const [settings, setSettings] = createSignal<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('ig_desktop_settings');
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to load settings from localStorage:', e);
    }
    return DEFAULT_SETTINGS;
  });

  // Apply theme effect
  createEffect(() => {
    const theme = settings().theme;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  });

  // Save settings when changed
  const updateSettings = (partial: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      try {
        localStorage.setItem('ig_desktop_settings', JSON.stringify(next));
      } catch (e) {
        console.warn('Failed to save settings to localStorage:', e);
      }
      return next;
    });

    if (partial.alwaysOnTop !== undefined) {
      invoke('set_always_on_top', { enabled: partial.alwaysOnTop });
    }
  };

  onMount(async () => {
    const unlisteners: UnlistenFn[] = [];

    try {
      // 1. Listen for notification events from Rust / Injected script
      const unlistenNotif = await listen<any>('notification-received', (event) => {
        const payload = event.payload;
        console.log('[App] Notification received event:', payload);
        const newNotif: InterceptedNotification = {
          id: Math.random().toString(36).substring(2, 9),
          title: payload.title || 'Instagram',
          body: payload.body || '',
          icon: payload.icon,
          tag: payload.tag,
          url: payload.url || 'https://www.instagram.com/direct/inbox/',
          timestamp: Date.now()
        };
        setNotifications(prev => [newNotif, ...prev.slice(0, 49)]);
      });
      unlisteners.push(unlistenNotif);

      // 2. Listen for unread badge count updates
      const unlistenUnread = await listen<number>('unread-count-updated', (event) => {
        setUnreadCount(event.payload);
      });
      unlisteners.push(unlistenUnread);

      // Initial unread count fetch
      const initialCount = await invoke<number>('get_unread_count').catch(() => 0);
      setUnreadCount(initialCount);
    } catch (e) {
      console.warn('Error setting up Tauri event listeners:', e);
    }

    // 3. Global Keyboard Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          handleReload();
        } else if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          handleZoomChange(0.1);
        } else if (e.key === '-') {
          e.preventDefault();
          handleZoomChange(-0.1);
        } else if (e.key === '0') {
          e.preventDefault();
          handleZoomReset();
        } else if (e.key === ',') {
          e.preventDefault();
          setIsSettingsOpen(true);
        } else if (e.key === 'm' || e.key === 'M') {
          e.preventDefault();
          handleNavigate('/direct/inbox/');
        } else if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          setIsNotificationsOpen(prev => !prev);
        }
      } else if (e.altKey) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handleGoBack();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          handleGoForward();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    onCleanup(() => {
      window.removeEventListener('keydown', handleKeyDown);
      unlisteners.forEach(fn => fn());
    });
  });

  // Navigation handlers
  const handleNavigate = async (path: string) => {
    setCurrentPath(path);
    try {
      await invoke('navigate_instagram', { path });
    } catch (e) {
      console.warn('Navigation error:', e);
    }
  };

  const handleReload = async () => {
    try {
      await invoke('reload_instagram');
    } catch (e) {
      console.warn('Reload error:', e);
    }
  };

  const handleGoBack = async () => {
    try {
      await invoke('go_back_instagram');
    } catch (e) {
      console.warn('Go back error:', e);
    }
  };

  const handleGoForward = async () => {
    try {
      await invoke('go_forward_instagram');
    } catch (e) {
      console.warn('Go forward error:', e);
    }
  };

  const handleZoomChange = async (delta: number) => {
    const newZoom = Math.min(Math.max(Number((zoomLevel() + delta).toFixed(1)), 0.6), 2.0);
    setZoomLevel(newZoom);
    try {
      await invoke('set_instagram_zoom', { zoomFactor: newZoom });
    } catch (e) {
      console.warn('Zoom error:', e);
    }
  };

  const handleZoomReset = async () => {
    setZoomLevel(1.0);
    try {
      await invoke('set_instagram_zoom', { zoomFactor: 1.0 });
    } catch (e) {
      console.warn('Zoom reset error:', e);
    }
  };

  const handleTestNotification = async () => {
    try {
      await invoke('trigger_native_notification', {
        title: 'Instagram',
        body: 'New direct message from friend: "Hey, check out this reel! 🚀"',
        icon: null,
        tag: 'test',
        url: 'https://www.instagram.com/direct/inbox/'
      });
    } catch (e) {
      console.warn('Test notification error:', e);
    }
  };

  const handleSelectNotification = (notif: InterceptedNotification) => {
    if (notif.url) {
      handleNavigate(notif.url);
    } else {
      handleNavigate('/direct/inbox/');
    }
    setIsNotificationsOpen(false);
  };

  return (
    <div class="app-container">
      {/* Title Bar & Top Nav */}
      <TitleBar
        currentPath={currentPath()}
        unreadCount={unreadCount()}
        zoomLevel={zoomLevel()}
        onNavigate={handleNavigate}
        onReload={handleReload}
        onGoBack={handleGoBack}
        onGoForward={handleGoForward}
        onZoomChange={handleZoomChange}
        onZoomReset={handleZoomReset}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(prev => !prev)}
        onTestNotification={handleTestNotification}
      />

      {/* Webview area under TitleBar (handled natively by Tauri child webview) */}
      <main class="webview-placeholder" id="webview-container" />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen()}
        settings={settings()}
        onClose={() => setIsSettingsOpen(false)}
        onUpdateSettings={updateSettings}
        onClearData={() => {
          localStorage.clear();
          handleReload();
        }}
        onTestNotification={handleTestNotification}
      />

      {/* Notifications Drawer */}
      <NotificationDrawer
        isOpen={isNotificationsOpen()}
        notifications={notifications()}
        onClose={() => setIsNotificationsOpen(false)}
        onClear={() => setNotifications([])}
        onSelectNotification={handleSelectNotification}
      />
    </div>
  );
};

export default App;
