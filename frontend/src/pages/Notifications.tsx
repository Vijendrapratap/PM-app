import { useEffect, useState } from 'react';
import { Bell, CheckCheck, CircleAlert } from 'lucide-react';
import { notificationApi, type AppNotification } from '../api/notificationApi';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errorMessage';

const Notifications = () => {
  const { isDemo } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isDemo) {
      setLoading(false);
      return;
    }
    notificationApi.list()
      .then(setItems)
      .catch((reason) => setError(getErrorMessage(reason, 'We could not load notifications.')))
      .finally(() => setLoading(false));
  }, [isDemo]);

  const markRead = async (item: AppNotification) => {
    if (!item.read) await notificationApi.markRead(item._id);
    setItems((current) => current.map((entry) => entry._id === item._id ? { ...entry, read: true } : entry));
    if (item.link) window.location.assign(item.link);
  };

  const markAll = async () => {
    if (!isDemo) await notificationApi.markAllRead();
    setItems((current) => current.map((entry) => ({ ...entry, read: true })));
  };

  return (
    <main className="notification-page animate-fade-in">
      <header className="notification-page-header">
        <div><span className="eyebrow"><Bell size={13}/> Response inbox</span><h1>Notifications</h1><p>Assignments, reviews, blocker responses, and decisions that need your attention.</p></div>
        {items.some((item) => !item.read) && <button className="btn btn-secondary" onClick={markAll}><CheckCheck size={15}/> Mark all read</button>}
      </header>
      {error && <div className="workday-error" role="alert"><CircleAlert size={16}/>{error}</div>}
      {loading ? <div className="notification-skeleton skeleton"/> : items.length === 0 ? (
        <section className="notification-empty"><Bell size={22}/><h2>You are caught up</h2><p>New assignments, mentions, and blocker responses will appear here.</p></section>
      ) : (
        <section className="notification-list" aria-label="Notifications">
          {items.map((item) => <button className={item.read ? '' : 'unread'} key={item._id} onClick={() => markRead(item)}>
            <span className="notification-state" aria-label={item.read ? 'Read' : 'Unread'}/>
            <span><strong>{item.title}</strong><p>{item.message}</p><small>{new Date(item.createdAt).toLocaleString()}</small></span>
          </button>)}
        </section>
      )}
    </main>
  );
};

export default Notifications;
