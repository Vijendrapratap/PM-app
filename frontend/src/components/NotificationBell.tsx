import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { notificationApi, type AppNotification } from '../api/notificationApi';

const POLL_INTERVAL_MS = 45000;

// No WebSocket layer exists anywhere in this app (see plan) - polling the
// unread count is consistent with how every other list here already works
// (fetch-on-mount, no real-time infrastructure).
const NotificationBell = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    try {
      setUnreadCount(await notificationApi.unreadCount());
    } catch (error) {
      console.error('Failed to load unread notification count', error);
    }
  }, []);

  useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      try {
        setNotifications(await notificationApi.list());
      } catch (error) {
        console.error('Failed to load notifications', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleClickNotification = async (n: AppNotification) => {
    if (!n.read) {
      await notificationApi.markRead(n._id).catch(() => {});
      setNotifications((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  const handleMarkAllRead = async () => {
    await notificationApi.markAllRead().catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button className="icon-btn" onClick={toggleOpen} style={{ position: 'relative' }}>
        <Bell size={17} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              minWidth: '16px',
              height: '16px',
              borderRadius: '999px',
              background: 'var(--danger)',
              color: '#fff',
              fontSize: '0.625rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 0.5rem)',
            width: '340px',
            maxHeight: '420px',
            overflowY: 'auto',
            background: 'var(--surface-1)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)',
            zIndex: 50,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--accent-blue)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading...</div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No notifications yet.</div>
          ) : (
            notifications.map((n) => (
              <button
                key={n._id}
                onClick={() => handleClickNotification(n)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.75rem 1rem',
                  borderBottom: '1px solid var(--border-subtle)',
                  background: n.read ? 'transparent' : 'rgba(59,130,246,0.06)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  {!n.read && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-blue)', flexShrink: 0 }}></span>}
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{n.title}</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{n.message}</p>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{new Date(n.createdAt).toLocaleString()}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
