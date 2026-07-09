import { useState } from 'react';
import { X, Megaphone } from 'lucide-react';
import { messageApi, type ImportantMessage } from '../api/messageApi';
import { getErrorMessage } from '../utils/errorMessage';
import type { Priority } from '../types';

const todayISO = () => new Date().toISOString().slice(0, 10);

const MessageFormModal = ({
  message,
  onClose,
  onSuccess,
}: {
  message?: ImportantMessage | null;
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const isEdit = Boolean(message);
  const [form, setForm] = useState({
    title: message?.title ?? '',
    description: message?.description ?? '',
    priority: (message?.priority ?? 'Medium') as Priority,
    startDate: message?.startDate?.slice(0, 10) ?? todayISO(),
    expiryDate: message?.expiryDate?.slice(0, 10) ?? '',
    pinned: message?.pinned ?? false,
    active: message?.active ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isEdit && message) {
        await messageApi.update(message._id, form);
      } else {
        await messageApi.create(form);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, `Failed to ${isEdit ? 'update' : 'create'} message.`));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-sm">
        <div className="modal-header">
          <div>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Megaphone size={16} style={{ color: 'var(--accent-cyan)' }} /> {isEdit ? 'Edit Message' : 'New Important Message'}
            </div>
            <div className="modal-subtitle">Broadcast to every team member on their next login.</div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input type="text" className="form-input" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Description *</label>
              <textarea className="form-textarea" rows={3} required value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-select" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as Priority }))}>
                  {['Low', 'Medium', 'High', 'Critical'].map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Expiry Date *</label>
                <input type="date" className="form-input" required value={form.expiryDate} onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input type="date" className="form-input" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.pinned} onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))} />
                Pinned on dashboard
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
                Active
              </label>
            </div>
            {error && <p style={{ color: 'var(--danger)', fontSize: '0.8125rem' }}>{error}</p>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Publish Message'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MessageFormModal;
