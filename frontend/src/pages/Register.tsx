import { useState } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { UserPlus, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/authApi';
import { getErrorMessage } from '../utils/errorMessage';

// Public self-registration. No role field here on purpose - every public
// registration always lands as 'Team Member', enforced server-side
// (see backend authService.register), and only a Super Admin can change it
// afterward from the Team Members page.
const Register = () => {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', department: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await authApi.register(form);
      await login(form.email, form.password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to register. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card animate-fade-in" style={{ maxWidth: '440px' }}>
        <div className="auth-header">
          <div className="sidebar-logo-icon">
            <img src="/brand/pratap-ai-mark.png" alt="Pratap AI" />
          </div>
          <div>
            <div className="auth-logo-title">Pratap AI Innovation</div>
            <div className="auth-logo-sub">Project Hub</div>
          </div>
        </div>

        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">
          You'll join as a Team Member. A Super Admin can change your role later.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Full Name *</label>
            <input
              type="text"
              className="form-input"
              required
              autoFocus
              value={form.name}
              onChange={set('name')}
              placeholder="John Doe"
            />
          </div>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Email Address *</label>
            <input
              type="email"
              className="form-input"
              required
              value={form.email}
              onChange={set('email')}
              placeholder="you@company.com"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                type="tel"
                className="form-input"
                value={form.phone}
                onChange={set('phone')}
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Department</label>
              <input
                type="text"
                className="form-input"
                placeholder="Design, Dev..."
                value={form.department}
                onChange={set('department')}
              />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Password *</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                required
                minLength={6}
                placeholder="Minimum 6 characters"
                value={form.password}
                onChange={set('password')}
                style={{ paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div
              style={{
                background: 'rgba(239,68,68,0.1)',
                color: 'var(--danger)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.625rem 0.875rem',
                fontSize: '0.8125rem',
                marginBottom: '1.25rem',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={submitting}
          >
            <UserPlus size={15} /> {submitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '1.5rem', marginBottom: 0 }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent-cyan)', fontWeight: 600, textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
