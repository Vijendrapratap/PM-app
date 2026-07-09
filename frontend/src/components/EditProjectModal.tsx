import { useState } from 'react';
import { X, Pencil } from 'lucide-react';
import { projectApi } from '../api/projectApi';
import { getErrorMessage } from '../utils/errorMessage';
import type { Project } from '../types';

const EditProjectModal = ({ project, onClose, onSuccess }: { project: Project; onClose: () => void; onSuccess: () => void }) => {
  const [form, setForm] = useState({
    name: project.name,
    description: project.description ?? '',
    category: project.category ?? '',
    department: project.department ?? '',
    priority: project.priority,
    startDate: project.startDate?.slice(0, 10) ?? '',
    estimatedCompletionDate: project.estimatedCompletionDate?.slice(0, 10) ?? '',
    deadline: project.deadline?.slice(0, 10) ?? '',
    budget: project.budget ?? '',
    status: project.status,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await projectApi.update(project._id, { ...form, budget: form.budget ? Number(form.budget) : undefined });
      onSuccess();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update project.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-lg">
        <div className="modal-header">
          <div>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Pencil size={16} /> Edit Project
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Project Name *</label>
              <input type="text" className="form-input" required value={form.name} onChange={set('name')} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" rows={3} value={form.description} onChange={set('description')} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input type="date" className="form-input" value={form.startDate} onChange={set('startDate')} />
              </div>
              <div className="form-group">
                <label className="form-label">Expected Completion</label>
                <input type="date" className="form-input" value={form.estimatedCompletionDate} onChange={set('estimatedCompletionDate')} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Category</label>
                <input type="text" className="form-input" value={form.category} onChange={set('category')} />
              </div>
              <div className="form-group">
                <label className="form-label">Department</label>
                <input type="text" className="form-input" value={form.department} onChange={set('department')} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-select" value={form.priority} onChange={set('priority')}>
                  {['Low', 'Medium', 'High', 'Critical'].map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={form.status} onChange={set('status')}>
                  {['Draft', 'Planning', 'In Progress', 'Review', 'Testing', 'On Hold', 'Cancelled'].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Budget</label>
              <input type="number" className="form-input" value={form.budget} onChange={set('budget')} />
            </div>
            {error && <p style={{ color: 'var(--danger)', fontSize: '0.8125rem' }}>{error}</p>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProjectModal;
