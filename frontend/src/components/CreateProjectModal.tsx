import { useEffect, useMemo, useRef, useState } from 'react';
import { X, UploadCloud, Paperclip, Search, Users } from 'lucide-react';
import { userApi } from '../api/userApi';
import { projectApi } from '../api/projectApi';
import { getErrorMessage } from '../utils/errorMessage';
import type { User } from '../types';

const CreateProjectModal = ({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) => {
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    department: '',
    priority: 'Medium',
    startDate: '',
    estimatedCompletionDate: '',
    budget: '',
    tags: '',
  });
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setLoadingMembers(true);
        setTeamMembers(await userApi.list());
      } catch (error) {
        console.error('Failed to fetch members', error);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchMembers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const data = new FormData();
    const { tags, ...rest } = form;
    Object.entries(rest).forEach(([k, v]) => data.append(k, v));
    data.append('status', 'Planning');
    data.append('assignedMembers', JSON.stringify(selectedMembers));
    data.append('tags', JSON.stringify(tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []));
    files.forEach(f => data.append('documents', f));
    try {
      await projectApi.create(data);
      onSuccess();
      onClose();
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to create project.'));
    } finally {
      setLoading(false);
    }
  };

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const filteredMembers = useMemo(() => teamMembers.filter(member =>
    member.name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
    member.email?.toLowerCase().includes(memberSearch.toLowerCase()) ||
    member.role?.toLowerCase().includes(memberSearch.toLowerCase())
  ), [teamMembers, memberSearch]);

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-lg">
        <div className="modal-header">
          <div>
            <div className="modal-title">Create New Project</div>
            <div className="modal-subtitle">Fill in the details to start a new project.</div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Row 1 */}
            <div className="form-group">
              <label className="form-label">Project Name *</label>
              <input type="text" className="form-input" required placeholder="e.g. AI Dashboard Redesign" value={form.name} onChange={set('name')} />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" rows={3} placeholder="What is this project about?" value={form.description} onChange={set('description')} />
            </div>

            {/* Row 2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input type="date" className="form-input" value={form.startDate} onChange={set('startDate')} />
              </div>
              <div className="form-group">
                <label className="form-label">Expected Completion Date</label>
                <input type="date" className="form-input" value={form.estimatedCompletionDate} onChange={set('estimatedCompletionDate')} />
              </div>
            </div>

            {/* Row 3 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Workstream</label>
                <select className="form-select" value={form.category} onChange={set('category')}>
                  <option value="">Choose workstream</option>
                  <option>Client delivery</option>
                  <option>Internal engine</option>
                  <option>Internal systems</option>
                  <option>Research &amp; innovation</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Department</label>
                <input type="text" className="form-input" placeholder="e.g. Design, Backend" value={form.department} onChange={set('department')} />
              </div>
            </div>

            {/* Row 4 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-select" value={form.priority} onChange={set('priority')}>
                  {['Low', 'Medium', 'High', 'Critical'].map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Budget (Optional)</label>
                <input type="number" className="form-input" placeholder="$0" value={form.budget} onChange={set('budget')} />
              </div>
            </div>

            {/* Tags */}
            <div className="form-group">
              <label className="form-label">Tags (comma-separated)</label>
              <input type="text" className="form-input" placeholder="ai, automation, frontend" value={form.tags} onChange={set('tags')} />
            </div>

            {/* Assign Team Members */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <Users size={14} /> Assign Team Members
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.625rem 0.875rem', marginBottom: '0.875rem' }}>
                <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Search team members..."
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  style={{ background: 'none', border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: '0.875rem', color: 'var(--text-primary)', width: '100%' }}
                />
              </div>
              <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'var(--surface-1)' }}>
                {loadingMembers ? (
                  <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading team members...</div>
                ) : filteredMembers.length === 0 ? (
                  <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No members found.</div>
                ) : (
                  filteredMembers.map(member => {
                    const checked = selectedMembers.includes(member._id);
                    const disabled = member.status === 'Inactive';
                    return (
                      <label
                        key={member._id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '1rem',
                          padding: '0.875rem 1rem',
                          borderBottom: '1px solid var(--border-subtle)',
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          opacity: disabled ? 0.55 : 1,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{member.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{member.role || 'Team Member'} · {member.email}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                          <span className={`badge ${disabled ? 'badge-danger' : 'badge-success'}`}>{member.status ?? 'Active'}</span>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => setSelectedMembers(prev => checked ? prev.filter(id => id !== member._id) : [...prev, member._id])}
                          />
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} assigned
              </div>
            </div>

            {/* Upload */}
            <div className="form-group">
              <label className="form-label">Initial Documents (Optional)</label>
              <div
                className="upload-zone"
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); e.dataTransfer.files && setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)].slice(0, 5)); }}
              >
                <input ref={fileRef} type="file" multiple className="" onChange={e => e.target.files && setFiles(prev => [...prev, ...Array.from(e.target.files!)].slice(0, 5))} style={{ display: 'none' }} />
                <UploadCloud size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 0.5rem' }} />
                <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Drag & drop or click to upload</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Up to 5 files</p>
              </div>
              {files.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  {files.map((f, i) => (
                    <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'var(--surface-2)', border: '1px solid var(--border-normal)', borderRadius: 'var(--radius-full)', padding: '0.25rem 0.625rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <Paperclip size={11} />
                      {f.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProjectModal;
