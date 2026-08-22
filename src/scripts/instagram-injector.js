/**
 * Instagram Desktop Webview Injected Script
 * Intercepts Web Notifications, ServiceWorker Notifications, DOM Activity & Direct Messages,
 * and bridges them natively to Windows System Notifications via Tauri IPC.
 */

(function () {
  console.log('[Instagram Desktop] Injected script initialized.');

  // Helper to safely invoke Tauri commands
  function invokeTauri(command, payload = {}) {
    try {
      if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') {
        return window.__TAURI_INTERNALS__.invoke(command, payload);
      } else if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
        return window.__TAURI__.core.invoke(command, payload);
      }
    } catch (err) {
      console.warn('[Instagram Desktop] Tauri IPC invoke failed:', command, err);
    }
    return Promise.resolve();
  }

  // Helper to send native desktop notification
  function sendNativeNotification(title, body = '', icon = '', tag = '', url = '') {
    console.log('[Instagram Desktop] Sending native notification:', { title, body, icon, tag, url });
    invokeTauri('trigger_native_notification', {
      title: String(title || 'Instagram'),
      body: String(body || ''),
      icon: icon ? String(icon) : null,
      tag: tag ? String(tag) : null,
      url: url ? String(url) : window.location.href
    });
  }

  // -------------------------------------------------------------
  // 1. WEB NOTIFICATION API INTERCEPTION & PERMISSION SPOOFING
  // -------------------------------------------------------------
  try {
    const OriginalNotification = window.Notification;

    function MockNotification(title, options = {}) {
      const opt = options || {};
      sendNativeNotification(
        title,
        opt.body || '',
        opt.icon || '',
        opt.tag || '',
        opt.data && opt.data.url ? opt.data.url : ''
      );

      const instance = {
        title: title,
        body: opt.body || '',
        icon: opt.icon || '',
        tag: opt.tag || '',
        data: opt.data || null,
        onclick: null,
        onclose: null,
        onerror: null,
        onshow: null,
        close: function () {
          if (typeof this.onclose === 'function') this.onclose();
        },
        addEventListener: function (type, listener) {
          if (type === 'click' && typeof listener === 'function') {
            this.onclick = listener;
          }
        },
        removeEventListener: function () {},
        dispatchEvent: function () { return true; }
      };

      setTimeout(() => {
        if (typeof instance.onshow === 'function') instance.onshow();
      }, 50);

      return instance;
    }

    // Force permission to always be granted
    Object.defineProperty(MockNotification, 'permission', {
      get: () => 'granted',
      set: () => {},
      configurable: true
    });

    MockNotification.requestPermission = async function (callback) {
      if (typeof callback === 'function') {
        callback('granted');
      }
      return 'granted';
    };

    MockNotification.maxActions = 2;

    window.Notification = MockNotification;
    console.log('[Instagram Desktop] window.Notification shim installed.');
  } catch (err) {
    console.error('[Instagram Desktop] Error shimming Notification:', err);
  }

  // -------------------------------------------------------------
  // 2. SERVICE WORKER NOTIFICATION SHIM
  // -------------------------------------------------------------
  try {
    if ('ServiceWorkerRegistration' in window && window.ServiceWorkerRegistration.prototype) {
      const originalShowNotification = window.ServiceWorkerRegistration.prototype.showNotification;
      window.ServiceWorkerRegistration.prototype.showNotification = function (title, options = {}) {
        const opt = options || {};
        sendNativeNotification(
          title,
          opt.body || '',
          opt.icon || '',
          opt.tag || '',
          opt.data && opt.data.url ? opt.data.url : ''
        );
        if (originalShowNotification) {
          try {
            return originalShowNotification.apply(this, arguments);
          } catch (e) {}
        }
        return Promise.resolve();
      };
    }
  } catch (err) {
    console.warn('[Instagram Desktop] Error shimming ServiceWorker showNotification:', err);
  }

  // -------------------------------------------------------------
  // 3. UNREAD COUNT & TITLE MUTATION OBSERVER
  // -------------------------------------------------------------
  let lastUnreadCount = 0;
  let lastTitle = document.title;

  function parseUnreadFromTitle(title) {
    // Format is usually "(1) Instagram" or "(12) Messages • Instagram"
    const match = title.match(/^\((\d+)\)/);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    return 0;
  }

  function handleTitleChange() {
    const currentTitle = document.title;
    if (currentTitle === lastTitle) return;
    lastTitle = currentTitle;

    const count = parseUnreadFromTitle(currentTitle);
    if (count !== lastUnreadCount) {
      console.log(`[Instagram Desktop] Unread count changed: ${lastUnreadCount} -> ${count}`);
      invokeTauri('update_unread_count', { count });

      // If count increased, trigger a notification if document is hidden or inactive
      if (count > lastUnreadCount && (document.hidden || !document.hasFocus())) {
        sendNativeNotification(
          'Instagram',
          `You have ${count} unread ${count === 1 ? 'notification or message' : 'notifications or messages'}`,
          null,
          'unread-badge',
          'https://www.instagram.com/direct/inbox/'
        );
      }
      lastUnreadCount = count;
    }
  }

  // Observe title changes via MutationObserver on <title>
  const titleElem = document.querySelector('title');
  if (titleElem) {
    const titleObserver = new MutationObserver(handleTitleChange);
    titleObserver.observe(titleElem, { childList: true, characterData: true, subtree: true });
  }

  // Fallback polling for title
  setInterval(handleTitleChange, 2000);

  // -------------------------------------------------------------
  // 4. DOM MUTATION OBSERVER FOR IN-APP DM TOASTS & BADGES
  // -------------------------------------------------------------
  const processedNotifications = new Set();

  function scanForInAppNotifications() {
    try {
      // 1. Check for Direct Message unread indicator badges in sidebar/nav
      const dmBadge = document.querySelector('a[href*="/direct/"] [aria-label*="unread"], a[href*="/direct/"] span[class*="badge"], a[href*="/direct/"] div[class*="badge"]');
      if (dmBadge) {
        const text = dmBadge.textContent || dmBadge.getAttribute('aria-label') || '';
        const countMatch = text.match(/(\d+)/);
        if (countMatch) {
          const count = parseInt(countMatch[1], 10);
          if (count > 0 && count !== lastUnreadCount) {
            invokeTauri('update_unread_count', { count });
          }
        }
      }

      // 2. Check for in-app Toast popups (Instagram pops up toasts at the bottom/top for new DMs)
      const toastContainers = document.querySelectorAll('div[role="alert"], div[role="dialog"] div[tabindex="-1"], div[data-testid="toast"]');
      toastContainers.forEach(toast => {
        const text = (toast.textContent || '').trim();
        if (text && text.length > 3 && !processedNotifications.has(text)) {
          const isNotificationToast = text.includes('sent a message') ||
                                     text.includes('reacted to your message') ||
                                     text.includes('liked your') ||
                                     text.includes('commented on') ||
                                     text.includes('started following you') ||
                                     text.includes('mentioned you');

          if (isNotificationToast) {
            processedNotifications.add(text);
            if (processedNotifications.size > 100) {
              const first = processedNotifications.values().next().value;
              processedNotifications.delete(first);
            }

            console.log('[Instagram Desktop] In-app toast detected:', text);
            sendNativeNotification('Instagram Message', text, null, 'dm-toast', 'https://www.instagram.com/direct/inbox/');
          }
        }
      });
    } catch (e) {
      console.warn('[Instagram Desktop] DOM scan error:', e);
    }
  }

  // Observe body for dynamic popups / toasts
  const bodyObserver = new MutationObserver(() => {
    scanForInAppNotifications();
  });

  if (document.body) {
    bodyObserver.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      bodyObserver.observe(document.body, { childList: true, subtree: true });
    });
  }

  // -------------------------------------------------------------
  // 5. GLOBAL HELPER API FOR DESKTOP APP
  // -------------------------------------------------------------
  window.__INSTAGRAM_DESKTOP__ = {
    navigate: function (path) {
      if (!path) return;
      if (path.startsWith('http')) {
        window.location.href = path;
      } else {
        const target = path.startsWith('/') ? path : '/' + path;
        window.location.href = 'https://www.instagram.com' + target;
      }
    },
    reload: function () {
      window.location.reload();
    },
    goBack: function () {
      window.history.back();
    },
    goForward: function () {
      window.history.forward();
    },
    getUnreadCount: function () {
      return lastUnreadCount;
    },
    testNotification: function () {
      sendNativeNotification('Instagram Test', 'This is a test notification from Instagram Desktop!', null, 'test', 'https://www.instagram.com/direct/inbox/');
    }
  };

  // -------------------------------------------------------------
  // 6. CUSTOM DESKTOP CSS INJECTION
  // -------------------------------------------------------------
  const style = document.createElement('style');
  style.id = 'instagram-desktop-custom-styles';
  style.textContent = `
    /* Custom sleek desktop scrollbar */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(150, 150, 150, 0.3);
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(150, 150, 150, 0.5);
    }
  `;
  (document.head || document.documentElement).appendChild(style);

  console.log('[Instagram Desktop] Injected script setup complete.');
})();
