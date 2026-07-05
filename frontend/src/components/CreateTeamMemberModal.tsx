import { useEffect, useState } from 'react';
import { X, Shield } from 'lucide-react';
import { userApi } from '../api/userApi';
import { authApi } from '../api/authApi';
import { getErrorMessage } from '../utils/errorMessage';
import type { User } from '../types';

const ROLE_OPTIONS = [
  'Project Manager',
  'Software Developer',
  'UI/UX Designer',
  'Backend Developer',
  'Frontend Developer',
  'QA Tester',
  'Operations',
  'Marketing',
];

const CreateTeamMemberModal = ({
  onClose,
  onSuccess,
  member,
}: {
  onClose: () => void;
  onSuccess: () => void;
  member?: User | null;
}) => {
  const isEdit = Boolean(member);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: ROLE_OPTIONS[0],
    department: 'General',
    status: 'Active',
    skills: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (member) {
      setForm({
        name: member.name ?? '',
        email: member.email ?? '',
        phone: member.phone ?? '',
        password: '',
        role: member.role ?? ROLE_OPTIONS[0],
        department: member.department ?? 'General',
        status: member.status ?? 'Active',
        skills: Array.isArray(member.skills) ? member.skills.join(', ') : '',
      });
    }
  }, [member]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...form,
        skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
      };

      if (isEdit && member?._id) {
        await userApi.update(member._id, payload);
      } else {
        await authApi.register(payload);
      }
      onSuccess();
      onClose();
    } catch (err) {
      alert(getErrorMessage(err, `Failed to ${isEdit ? 'update' : 'add'} team member.`));
    } finally {
      setLoading(false);
    }
  };

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-sm">
        <div className="modal-header">
          <div>
            <div className="modal-title">{isEdit ? 'Edit Team Member' : 'Add Team Member'}</div>
            <div className="modal-subtitle">{isEdit ? 'Update the member profile and role.' : 'Create an account for a new team member.'}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input type="text" className="form-input" required placeholder="John Doe" value={form.name} onChange={set('name')} />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input type="email" className="form-input" required placeholder="john@company.com" value={form.email} onChange={set('email')} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input type="tel" className="form-input" placeholder="+1 555 000 0000" value={form.phone} onChange={set('phone')} />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <Shield size={13} style={{ color: 'var(--accent-cyan)' }} />
                Temporary Password {isEdit ? '(leave blank to keep existing)' : '*'}
              </label>
              <input type="password" className="form-input" required={!isEdit} placeholder="Minimum 8 characters" value={form.password} onChange={set('password')} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-select" value={form.role} onChange={set('role')}>
                  {ROLE_OPTIONS.map(option => <option key={option}>{option}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Department / Team</label>
                <input type="text" className="form-input" placeholder="Design, Backend..." value={form.department} onChange={set('department')} />
              </div>
            </div>
            {isEdit && (
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={form.status} onChange={set('status')}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Skills (comma-separated)</label>
              <input type="text" className="form-input" placeholder="React, TypeScript, Node.js" value={form.skills} onChange={set('skills')} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (isEdit ? 'Saving...' : 'Adding...') : (isEdit ? 'Save Changes' : 'Add Member')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTeamMemberModal;
