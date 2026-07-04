import { useState, useRef } from 'react';
import { X, UploadCloud, Paperclip } from 'lucide-react';
import api from '../api';

const ALLOWED = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.png,.jpg,.jpeg,.svg,.txt';

const AddUpdateModal = ({ projectId, onClose, onSuccess }: { projectId: string; onClose: () => void; onSuccess: () => void }) => {
  const [form, setForm] = useState({
    title: '',
    description: '',
    progress: 50,
    status: 'In Progress',
    comments: '',
    links: '',
  });
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = (newFiles: File[]) => {
    setFiles(prev => [...prev, ...newFiles].slice(0, 5));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const data = new FormData();
    Object.entries(form).forEach(([k, v]) => data.append(k, String(v)));
    files.forEach(f => data.append('documents', f));
    try {
      await api.post(`/projects/${projectId}/updates`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onSuccess();
      onClose();
    } catch {
      alert('Failed to add update. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container">
        <div className="modal-header">
          <div>
            <div className="modal-title">Add Project Update</div>
            <div className="modal-subtitle">Each update is saved separately and builds the project timeline.</div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Update Title</label>
              <input type="text" className="form-input" required placeholder="e.g. Design Phase Completed" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" required placeholder="What was done? What changed?" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Progress: {form.progress}%</label>
                <input type="range" min={0} max={100} value={form.progress} onChange={e => setForm({ ...form, progress: +e.target.value })} style={{ width: '100%', accentColor: 'var(--accent-blue)' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {['Planning', 'In Progress', 'Review', 'Testing', 'Blocked', 'On Hold'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Reference Links</label>
              <input type="text" className="form-input" placeholder='[{"label":"GitHub","url":"https://github.com/..."}]' value={form.links} onChange={e => setForm({ ...form, links: e.target.value })} />
            </div>

            <div className="form-group">
              <label className="form-label">Attachments (max 5)</label>
              <div
                className={`upload-zone ${dragging ? 'drag-over' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); addFiles(Array.from(e.dataTransfer.files)); }}
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" multiple accept={ALLOWED} onChange={e => e.target.files && addFiles(Array.from(e.target.files))} style={{ display: 'none' }} />
                <UploadCloud size={28} style={{ color: 'var(--text-muted)', margin: '0 auto 0.5rem' }} />
                <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Drag & drop or click to upload</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>PDF, DOCX, ZIP, Images and more</p>
              </div>
              {files.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  {files.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'var(--surface-2)', border: '1px solid var(--border-normal)', borderRadius: 'var(--radius-full)', padding: '0.25rem 0.625rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <Paperclip size={11} />
                      {f.name}
                      <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, marginLeft: '0.125rem' }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddUpdateModal;
