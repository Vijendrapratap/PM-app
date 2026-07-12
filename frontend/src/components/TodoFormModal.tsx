import { useRef, useState } from 'react';
import { X, ListChecks, Paperclip } from 'lucide-react';
import { todoApi } from '../api/todoApi';
import { getErrorMessage } from '../utils/errorMessage';
import { useAuth } from '../context/AuthContext';
import { isSuperAdmin } from '../utils/roles';
import type { User, Priority } from '../types';

const TodoFormModal = ({
  members,
  onClose,
  onSuccess,
}: {
  members: User[];
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const { user } = useAuth();
  const canAssignOthers = isSuperAdmin(user?.role);
  const [form, setForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'Medium' as Priority,
    assignedTo: user?._id ?? '',
  });
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await todoApi.create(form, files);
      onSuccess();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create task.'));
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
              <ListChecks size={16} style={{ color: 'var(--accent-cyan)' }} /> New Daily Task
            </div>
            <div className="modal-subtitle">Personal to-do, separate from project tasks.</div>
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
              <label className="form-label">Description</label>
              <textarea className="form-textarea" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input type="date" className="form-input" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-select" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as Priority }))}>
                  {['Low', 'Medium', 'High', 'Critical'].map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            {canAssignOthers && (
              <div className="form-group">
                <label className="form-label">Assign To</label>
                <select className="form-select" value={form.assignedTo} onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))}>
                  {user && <option value={user._id}>Myself ({user.name})</option>}
                  {members.filter((m) => m._id !== user?._id && m.status !== 'Inactive').map((m) => (
                    <option key={m._id} value={m._id}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Attachments</label>
              <div
                className="upload-zone"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); e.dataTransfer.files && setFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)].slice(0, 5)); }}
              >
                <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={(e) => e.target.files && setFiles((prev) => [...prev, ...Array.from(e.target.files!)].slice(0, 5))} />
                <Paperclip size={20} style={{ color: 'var(--text-muted)', margin: '0 auto 0.375rem' }} />
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Click or drag files (images, PDFs, DOCX, ZIP)</p>
              </div>
              {files.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  {files.map((f, i) => (
                    <span key={i} style={{ fontSize: '0.7rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-full)', padding: '0.2rem 0.5rem', color: 'var(--text-secondary)' }}>{f.name}</span>
                  ))}
                </div>
              )}
            </div>
            {error && <p style={{ color: 'var(--danger)', fontSize: '0.8125rem' }}>{error}</p>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TodoFormModal;
