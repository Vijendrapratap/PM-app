import { useEffect, useMemo, useState } from 'react';
import { Megaphone, Pin } from 'lucide-react';
import { useImportantMessages } from '../hooks/useImportantMessages';
import { ACK_STORAGE_KEY } from '../context/AuthContext';
import type { Priority } from '../types';

const PRIORITY_BADGE: Record<Priority, string> = {
  Low: 'badge-neutral',
  Medium: 'badge-info',
  High: 'badge-warning',
  Critical: 'badge-danger',
};

const readAcknowledged = (): string[] => {
  try {
    return JSON.parse(sessionStorage.getItem(ACK_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
};

// Shown once per login (see AuthContext.ACK_STORAGE_KEY): each active message
// queues up here and reappears next login until it's edited/deactivated by a
// Super Admin, but won't re-interrupt the same session once acknowledged.
const ImportantMessageModal = () => {
  const { messages, loading } = useImportantMessages();
  const [acknowledged, setAcknowledged] = useState<string[]>(readAcknowledged);

  useEffect(() => {
    setAcknowledged(readAcknowledged());
  }, [messages]);

  const queue = useMemo(
    () => messages.filter((m) => !acknowledged.includes(m._id)),
    [messages, acknowledged]
  );

  if (loading || queue.length === 0) return null;

  const current = queue[0];

  const acknowledge = () => {
    const next = [...acknowledged, current._id];
    setAcknowledged(next);
    sessionStorage.setItem(ACK_STORAGE_KEY, JSON.stringify(next));
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-sm">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <Megaphone size={18} style={{ color: 'var(--accent-cyan)' }} />
            <div>
              <div className="modal-title">Important Message</div>
              {queue.length > 1 && (
                <div className="modal-subtitle">{queue.length} unread messages</div>
              )}
            </div>
          </div>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {current.pinned && <Pin size={13} style={{ color: 'var(--accent-cyan)' }} />}
            <span className={`badge ${PRIORITY_BADGE[current.priority]}`}>{current.priority}</span>
          </div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            {current.title}
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {current.description}
          </p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={acknowledge}>
            Acknowledged
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportantMessageModal;
