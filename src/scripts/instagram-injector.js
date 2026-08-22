/**
 * Instagram Desktop Webview Injected Script (Production Grade)
 * 
 * Intercepts Web Notifications, ServiceWorker Notifications, Permissions API,
 * DOM Activity & Direct Messages, and bridges them natively to Windows System Notifications.
 * Also handles external link routing to default system browser.
 */

(function () {
  console.log('[Instagram Desktop] Initializing Injected Native Bridge...');

  // Helper to safely invoke Tauri commands
  function invokeTauri(command, payload = {}) {
    try {
      if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') {
        return window.__TAURI_INTERNALS__.invoke(command, payload);
      } else if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
        return window.__TAURI__.core.invoke(command, payload);
      }
    } catch (err) {
      console.warn('[Instagram Desktop] Tauri IPC invoke error:', command, err);
    }
    return Promise.resolve();
  }

  // Helper to send native desktop notification
  function sendNativeNotification(title, body = '', icon = '', tag = '', url = '') {
    console.log('[Instagram Desktop] Triggering native notification:', { title, body, icon, tag, url });
    invokeTauri('trigger_native_notification', {
      title: String(title || 'Instagram'),
      body: body ? String(body) : null,
      icon: icon ? String(icon) : null,
      tag: tag ? String(tag) : null,
      url: url ? String(url) : window.location.href
    });
  }

  // -------------------------------------------------------------
  // 1. NAVIGATOR PERMISSIONS QUERY SPOOFING
  // -------------------------------------------------------------
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const origQuery = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = function (param) {
        if (param && (param.name === 'notifications' || param.name === 'push')) {
          return Promise.resolve({
            state: 'granted',
            name: param.name,
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false
          });
        }
        return origQuery(param);
      };
    }
  } catch (err) {
    console.warn('[Instagram Desktop] Error spoofing navigator.permissions.query:', err);
  }

  // -------------------------------------------------------------
  // 2. WEB NOTIFICATION API INTERCEPTION & PERMISSION SPOOFING
  // -------------------------------------------------------------
  try {
    const OriginalNotification = window.Notification;

    function TauriMockNotification(title, options = {}) {
      const opt = options || {};
      const body = opt.body || '';
      const icon = opt.icon || '';
      const tag = opt.tag || '';
      const url = (opt.data && opt.data.url) ? opt.data.url : window.location.href;

      sendNativeNotification(title, body, icon, tag, url);

      const instance = {
        title: title,
        body: body,
        icon: icon,
        tag: tag,
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

    Object.defineProperty(TauriMockNotification, 'permission', {
      get: () => 'granted',
      set: () => {},
      configurable: true
    });

    TauriMockNotification.requestPermission = async function (callback) {
      if (typeof callback === 'function') {
        callback('granted');
      }
      return Promise.resolve('granted');
    };

    TauriMockNotification.maxActions = 2;

    try {
      Object.defineProperty(window, 'Notification', {
        get: () => TauriMockNotification,
        set: () => {},
        configurable: true
      });
    } catch (e) {
      window.Notification = TauriMockNotification;
    }
    console.log('[Instagram Desktop] window.Notification proxy installed.');
  } catch (err) {
    console.error('[Instagram Desktop] Error shimming Notification:', err);
  }

  // -------------------------------------------------------------
  // 3. SERVICE WORKER NOTIFICATION SHIM
  // -------------------------------------------------------------
  try {
    if (typeof ServiceWorkerRegistration !== 'undefined' && ServiceWorkerRegistration.prototype) {
      const originalShowNotification = ServiceWorkerRegistration.prototype.showNotification;
      ServiceWorkerRegistration.prototype.showNotification = function (title, options = {}) {
        const opt = options || {};
        const body = opt.body || '';
        const icon = opt.icon || '';
        const tag = opt.tag || '';
        const url = (opt.data && opt.data.url) ? opt.data.url : window.location.href;

        sendNativeNotification(title, body, icon, tag, url);

        if (typeof originalShowNotification === 'function') {
          try {
            return originalShowNotification.call(this, title, options);
          } catch (e) {
            return Promise.resolve();
          }
        }
        return Promise.resolve();
      };
    }
  } catch (err) {
    console.warn('[Instagram Desktop] Error shimming ServiceWorker showNotification:', err);
  }

  // -------------------------------------------------------------
  // 4. UNREAD COUNT & TITLE MUTATION OBSERVER
  // -------------------------------------------------------------
  let lastUnreadCount = 0;
  let lastTitle = document.title;

  function parseUnreadFromTitle(title) {
    // Matches patterns like "(1) Instagram", "(12) Messages • Instagram", or "(3) Direct"
    const match = (title || '').match(/^\((\d+)\)/);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    return 0;
  }

  function handleTitleChange() {
    const currentTitle = document.title || '';
    if (currentTitle === lastTitle) return;
    lastTitle = currentTitle;

    const count = parseUnreadFromTitle(currentTitle);
    if (count !== lastUnreadCount) {
      console.log(`[Instagram Desktop] Unread count changed: ${lastUnreadCount} -> ${count}`);
      invokeTauri('update_unread_count', { count });

      // If count increased, trigger a notification if document is hidden or inactive
      if (count > lastUnreadCount && (document.hidden || !document.hasFocus())) {
        const diff = count - lastUnreadCount;
        sendNativeNotification(
          'Instagram Direct',
          `You have ${count} unread ${count === 1 ? 'message' : 'messages'}`,
          null,
          'unread-badge',
          'https://www.instagram.com/direct/inbox/'
        );
      }
      lastUnreadCount = count;
    }
  }

  const titleElem = document.querySelector('title');
  if (titleElem) {
    const titleObserver = new MutationObserver(handleTitleChange);
    titleObserver.observe(titleElem, { childList: true, characterData: true, subtree: true });
  }
  setInterval(handleTitleChange, 1500);

  // -------------------------------------------------------------
  // 5. DOM MUTATION OBSERVER FOR IN-APP DM TOASTS & BADGES
  // -------------------------------------------------------------
  const processedNotifications = new Set();

  function scanForInAppNotifications() {
    try {
      // 1. Check for Direct Message unread indicator badges in navigation
      const dmBadges = document.querySelectorAll(
        'a[href*="/direct/"] [aria-label*="unread"], ' +
        'a[href*="/direct/"] [aria-label*="Unread"], ' +
        'a[href*="/direct/"] span[class*="badge"], ' +
        'a[href*="/direct/"] div[class*="badge"], ' +
        'svg[aria-label*="Direct"][aria-label*="unread"]'
      );
      if (dmBadges.length > 0) {
        for (const dmBadge of dmBadges) {
          const text = dmBadge.textContent || dmBadge.getAttribute('aria-label') || '';
          const countMatch = text.match(/(\d+)/);
          if (countMatch) {
            const count = parseInt(countMatch[1], 10);
            if (count > 0 && count !== lastUnreadCount) {
              invokeTauri('update_unread_count', { count });
            }
            break;
          }
        }
      }

      // 2. Check for in-app Toast popups (e.g. "User sent a message", etc.)
      const toastContainers = document.querySelectorAll(
        'div[role="alert"], ' +
        'div[role="dialog"] div[tabindex="-1"], ' +
        'div[data-testid="toast"], ' +
        'div[class*="toast"], ' +
        'div[class*="Toast"]'
      );
      toastContainers.forEach(toast => {
        const text = (toast.textContent || '').trim();
        if (text && text.length > 3 && !processedNotifications.has(text)) {
          const isNotificationToast = text.includes('sent a message') ||
                                     text.includes('reacted to your message') ||
                                     text.includes('liked your') ||
                                     text.includes('commented on') ||
                                     text.includes('started following you') ||
                                     text.includes('mentioned you') ||
                                     text.includes('sent a video') ||
                                     text.includes('sent a photo') ||
                                     text.includes('sent an attachment');

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
      // DOM scan safety catch
    }
  }

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
  // 6. EXTERNAL LINK INTERCEPTOR
  // -------------------------------------------------------------
  document.addEventListener('click', function (e) {
    const target = e.target.closest('a');
    if (!target || !target.href) return;

    const href = target.href;
    try {
      const url = new URL(href);
      const isInternalHost = url.hostname.includes('instagram.com') ||
                              url.hostname.includes('cdninstagram.com') ||
                              url.hostname.includes('facebook.com') ||
                              url.hostname.includes('fbcdn.net');

      // If it's an external link or target="_blank" or instagram redirect (l.instagram.com)
      if (!isInternalHost || target.target === '_blank' || href.includes('l.instagram.com/')) {
        e.preventDefault();
        e.stopPropagation();

        let targetUrl = href;
        if (href.includes('l.instagram.com') && url.searchParams.has('u')) {
          targetUrl = decodeURIComponent(url.searchParams.get('u'));
        }

        console.log('[Instagram Desktop] Routing external link to default browser:', targetUrl);
        invokeTauri('open_external_url', { url: targetUrl });
      }
    } catch (err) {
      console.warn('[Instagram Desktop] Link routing error:', err);
    }
  }, true);

  // -------------------------------------------------------------
  // 7. GLOBAL HELPER API FOR DESKTOP SHELL
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
      sendNativeNotification('Instagram Direct', 'Test message: "Hey there! Real-time notifications are working! 🚀"', null, 'test', 'https://www.instagram.com/direct/inbox/');
    }
  };

  // -------------------------------------------------------------
  // 8. DESKTOP POLISHING CSS
  // -------------------------------------------------------------
  const style = document.createElement('style');
  style.id = 'instagram-desktop-custom-styles';
  style.textContent = `
    /* Sleek Desktop Scrollbars */
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

  console.log('[Instagram Desktop] Injected Native Bridge initialized successfully.');
})();
