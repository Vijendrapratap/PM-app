import { useCallback, useEffect, useState } from 'react';
import { Plus, Megaphone, Pencil, Trash2, Pin, ShieldAlert } from 'lucide-react';
import MessageFormModal from '../components/MessageFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { messageApi, type ImportantMessage } from '../api/messageApi';
import { getErrorMessage } from '../utils/errorMessage';
import { useAuth } from '../context/AuthContext';
import { isSuperAdmin } from '../utils/roles';
import type { Priority } from '../types';

const PRIORITY_BADGE: Record<Priority, string> = {
  Low: 'badge-neutral',
  Medium: 'badge-info',
  High: 'badge-warning',
  Critical: 'badge-danger',
};

const isExpired = (expiryDate: string) => new Date(expiryDate) < new Date(new Date().toISOString().slice(0, 10));

const Messages = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ImportantMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<ImportantMessage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ImportantMessage | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const canManage = isSuperAdmin(user?.role);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setMessages(await messageApi.list());
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load messages.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManage) refetch();
  }, [refetch, canManage]);

  if (!canManage) {
    return (
      <div className="animate-fade-in section-card">
        <div className="empty-state">
          <div className="empty-state-icon"><ShieldAlert size={28} /></div>
          <div className="empty-state-title">Super Admin Only</div>
          <div className="empty-state-desc">Only a Super Admin can manage Important Messages.</div>
        </div>
      </div>
    );
  }

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await messageApi.remove(deleteTarget._id);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete message.'));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Important Messages</h1>
          <p className="page-subtitle">Broadcast announcements shown to every team member on login.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setIsModalOpen(true); }}>
          <Plus size={15} /> New Message
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', padding: '0.625rem 0.875rem', fontSize: '0.8125rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: '90px', borderRadius: '16px' }}></div>)}
        </div>
      ) : messages.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <div className="empty-state-icon"><Megaphone size={28} /></div>
            <div className="empty-state-title">No Messages Yet</div>
            <div className="empty-state-desc">Publish your first announcement to the team.</div>
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}><Plus size={15} /> New Message</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {messages.map((message) => {
            const expired = isExpired(message.expiryDate);
            return (
              <div key={message._id} className="section-card" style={{ padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                      {message.pinned && <Pin size={13} style={{ color: 'var(--accent-cyan)' }} />}
                      <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>{message.title}</span>
                      <span className={`badge ${PRIORITY_BADGE[message.priority]}`}>{message.priority}</span>
                      <span className={`badge ${message.active && !expired ? 'badge-success' : 'badge-neutral'}`}>
                        {expired ? 'Expired' : message.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '0.5rem' }}>{message.description}</p>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {message.startDate?.slice(0, 10)} → {message.expiryDate?.slice(0, 10)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                    <button className="icon-btn" title="Edit" onClick={() => { setEditing(message); setIsModalOpen(true); }}>
                      <Pencil size={14} />
                    </button>
                    <button className="icon-btn" title="Delete" style={{ color: 'var(--danger)' }} onClick={() => setDeleteTarget(message)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <MessageFormModal
          message={editing}
          onClose={() => { setIsModalOpen(false); setEditing(null); }}
          onSuccess={refetch}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Message"
          message={`Delete "${deleteTarget.title}"? It will stop appearing for everyone immediately.`}
          confirmLabel="Delete"
          danger
          loading={actionLoading}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default Messages;
