import { Component, For } from 'solid-js';
import { InterceptedNotification } from '../types';
import './NotificationDrawer.css';

interface NotificationDrawerProps {
  isOpen: boolean;
  notifications: InterceptedNotification[];
  onClose: () => void;
  onClear: () => void;
  onSelectNotification: (notif: InterceptedNotification) => void;
}

export const NotificationDrawer: Component<NotificationDrawerProps> = (props) => {
  if (!props.isOpen) return null;

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div class="drawer-backdrop" onClick={props.onClose}>
      <div class="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div class="drawer-header">
          <div class="drawer-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span>Notification Center ({props.notifications.length})</span>
          </div>

          <div class="drawer-actions">
            {props.notifications.length > 0 && (
              <button class="clear-btn" onClick={props.onClear}>
                Clear
              </button>
            )}
            <button class="close-icon-btn" onClick={props.onClose}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div class="drawer-body">
          {props.notifications.length === 0 ? (
            <div class="empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span>No notifications yet</span>
              <p style={{ "font-size": "12px", opacity: "0.7" }}>
                Direct messages, likes, and mentions will appear here and in Windows native toast notifications.
              </p>
            </div>
          ) : (
            <For each={props.notifications}>
              {(item) => (
                <div class="notif-card" onClick={() => props.onSelectNotification(item)}>
                  <div class="notif-top">
                    <span class="notif-title">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      {item.title}
                    </span>
                    <span class="notif-time">{formatTime(item.timestamp)}</span>
                  </div>
                  {item.body && <p class="notif-body">{item.body}</p>}
                  {item.tag && <span class="notif-badge-tag">{item.tag}</span>}
                </div>
              )}
            </For>
          )}
        </div>
      </div>
    </div>
  );
};
