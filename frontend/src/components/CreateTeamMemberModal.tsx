import { useEffect, useState } from 'react';
import { X, Shield } from 'lucide-react';
import { userApi } from '../api/userApi';
import { getErrorMessage } from '../utils/errorMessage';
import { SUPER_ADMIN_ROLE } from '../utils/roles';
import type { User } from '../types';
import { DEPARTMENTS } from '../utils/departments';

const BASE_ROLE_OPTIONS = ['Team Member', 'Manager'];

const CreateTeamMemberModal = ({
  onClose,
  onSuccess,
  member,
  canAssignSuperAdmin = false,
}: {
  onClose: () => void;
  onSuccess: () => void;
  member?: User | null;
  canAssignSuperAdmin?: boolean;
}) => {
  const ROLE_OPTIONS = canAssignSuperAdmin ? [...BASE_ROLE_OPTIONS, 'CEO'] : BASE_ROLE_OPTIONS;
  const isEdit = Boolean(member);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: ROLE_OPTIONS[0],
    designation: '',
    department: 'Engineering',
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
        role: member.platformRole === 'CEO' || member.role === SUPER_ADMIN_ROLE ? 'CEO' : member.platformRole === 'MANAGER' || ['Lead', 'Project Manager'].includes(member.role) ? 'Manager' : 'Team Member',
        designation: member.designation ?? member.role ?? '',
        department: member.department ?? 'Engineering',
        status: member.status ?? 'Active',
        skills: Array.isArray(member.skills) ? member.skills.join(', ') : '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        await userApi.invite(payload);
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
    <div className="modal-backdrop modal-backdrop-drawer">
      <div className="modal-container modal-drawer" role="dialog" aria-modal="true" aria-labelledby="team-member-modal-title">
        <div className="modal-header">
          <div>
            <div className="modal-title" id="team-member-modal-title">{isEdit ? 'Edit Team Member' : 'Add Team Member'}</div>
            <div className="modal-subtitle">{isEdit ? 'Update the member profile and role.' : 'Create an account for a new team member.'}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <section className="modal-form-section tone-account">
              <div className="modal-form-section-heading"><strong>Account details</strong><span>Sign-in and contact information</span></div>
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
              <input type="password" className="form-input" required={!isEdit} placeholder="Minimum 6 characters" value={form.password} onChange={set('password')} />
            </div>
            </section>
            <section className="modal-form-section tone-work">
              <div className="modal-form-section-heading"><strong>Work profile</strong><span>Role, team, and responsibilities</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-select" value={form.role} onChange={set('role')}>
                  {ROLE_OPTIONS.map(option => <option key={option}>{option}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Department / Team</label>
                <select className="form-select" value={form.department} onChange={set('department')}>
                  {DEPARTMENTS.map((department) => <option value={department} key={department}>{department}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Designation</label>
              <input type="text" className="form-input" placeholder="Developer, Tech Lead, Project Manager" value={form.designation} onChange={set('designation')} />
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
            </section>
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
