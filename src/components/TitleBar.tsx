import { Component, createSignal, onMount } from 'solid-js';
import { getCurrentWindow } from '@tauri-apps/api/window';
import './TitleBar.css';

interface TitleBarProps {
  currentPath: string;
  unreadCount: number;
  zoomLevel: number;
  onNavigate: (path: string) => void;
  onReload: () => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onZoomChange: (delta: number) => void;
  onZoomReset: () => void;
  onOpenSettings: () => void;
  onOpenNotifications: () => void;
  onTestNotification: () => void;
}

export const TitleBar: Component<TitleBarProps> = (props) => {
  const [isMaximized, setIsMaximized] = createSignal(false);
  const appWindow = getCurrentWindow();

  onMount(async () => {
    try {
      setIsMaximized(await appWindow.isMaximized());
      const unlisten = await appWindow.onResized(async () => {
        setIsMaximized(await appWindow.isMaximized());
      });
      return () => unlisten();
    } catch (e) {
      console.warn('Window state listener error:', e);
    }
  });

  const handleMinimize = async () => {
    await appWindow.minimize();
  };

  const handleToggleMaximize = async () => {
    await appWindow.toggleMaximize();
    setIsMaximized(await appWindow.isMaximized());
  };

  const handleClose = async () => {
    await appWindow.close();
  };

  return (
    <header class="titlebar-container" data-tauri-drag-region>
      <div class="titlebar-drag-region" data-tauri-drag-region />

      {/* Left section: Logo & Nav History */}
      <div class="titlebar-left">
        <div class="logo-container" onClick={() => props.onNavigate('/')} title="Instagram Home">
          <div class="instagram-glyph">
            <svg viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
          </div>
          <span class="logo-text">Instagram</span>
        </div>

        <div class="history-nav">
          <button class="nav-btn" onClick={props.onGoBack} title="Back (Alt+Left)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button class="nav-btn" onClick={props.onGoForward} title="Forward (Alt+Right)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <button class="nav-btn" onClick={props.onReload} title="Reload (Ctrl+R)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M23 4v6h-6" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      </div>

      {/* Center: Quick navigation links */}
      <div class="titlebar-center">
        <button
          class={`quick-link-btn ${props.currentPath === '/' ? 'active' : ''}`}
          onClick={() => props.onNavigate('/')}
          title="Feed / Home"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>Home</span>
        </button>

        <button
          class={`quick-link-btn ${props.currentPath.includes('/direct') ? 'active' : ''}`}
          onClick={() => props.onNavigate('/direct/inbox/')}
          title="Direct Messages"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
          <span>Messages</span>
          {props.unreadCount > 0 && (
            <span class="unread-pill">{props.unreadCount}</span>
          )}
        </button>

        <button
          class={`quick-link-btn ${props.currentPath.includes('/explore') ? 'active' : ''}`}
          onClick={() => props.onNavigate('/explore/')}
          title="Explore"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
          </svg>
          <span>Explore</span>
        </button>

        <button
          class={`quick-link-btn ${props.currentPath.includes('/notifications') ? 'active' : ''}`}
          onClick={() => props.onNavigate('/notifications/')}
          title="Notifications"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span>Activity</span>
        </button>
      </div>

      {/* Right: Actions, Zoom, Settings, Window Controls */}
      <div class="titlebar-right">
        {/* Test Notification Trigger */}
        <button
          class="action-btn test-notif-btn"
          onClick={props.onTestNotification}
          title="Test Native Windows Toast Notification"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <span>Test Notification</span>
        </button>

        {/* Zoom controls */}
        <div class="zoom-controls">
          <button class="nav-btn" onClick={() => props.onZoomChange(-0.1)} title="Zoom Out (Ctrl+-)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <span class="zoom-level-text" onClick={props.onZoomReset} title="Click to Reset Zoom">
            {Math.round(props.zoomLevel * 100)}%
          </span>
          <button class="nav-btn" onClick={() => props.onZoomChange(0.1)} title="Zoom In (Ctrl++)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        {/* Notifications History Drawer Button */}
        <button class="nav-btn" onClick={props.onOpenNotifications} title="Notifications Center">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>

        {/* Settings button */}
        <button class="nav-btn" onClick={props.onOpenSettings} title="App Settings">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        {/* Windows Window Controls */}
        <div class="window-controls">
          <button class="window-btn" onClick={handleMinimize} title="Minimize">
            <svg width="10" height="10" viewBox="0 0 10 1">
              <rect width="10" height="1" fill="currentColor" />
            </svg>
          </button>
          <button class="window-btn" onClick={handleToggleMaximize} title={isMaximized() ? 'Restore' : 'Maximize'}>
            {isMaximized() ? (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path fill="none" stroke="currentColor" stroke-width="1" d="M2.5,0.5 h7 v7 h-7 z M0.5,2.5 v7 h7 v-7 z" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1" />
              </svg>
            )}
          </button>
          <button class="window-btn close-btn" onClick={handleClose} title="Close">
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path fill="none" stroke="currentColor" stroke-width="1.2" d="M1,1 L9,9 M9,1 L1,9" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
};
