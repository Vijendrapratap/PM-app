import { useState } from 'react';
import { X, KeyRound } from 'lucide-react';
import { userApi } from '../api/userApi';
import { getErrorMessage } from '../utils/errorMessage';
import type { User } from '../types';

const ResetPasswordModal = ({ member, onClose, onSuccess }: { member: User; onClose: () => void; onSuccess: () => void }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await userApi.resetPassword(member._id, password);
      onSuccess();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to reset password.'));
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
              <KeyRound size={16} style={{ color: 'var(--accent-cyan)' }} /> Reset Password
            </div>
            <div className="modal-subtitle">Set a new temporary password for {member.name}.</div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">New Temporary Password *</label>
              <input
                type="password"
                className="form-input"
                required
                minLength={6}
                autoFocus
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p style={{ color: 'var(--danger)', fontSize: '0.8125rem' }}>{error}</p>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordModal;
