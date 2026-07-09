import { useState } from 'react';
import { Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errorMessage';

const Login = () => {
  const { user, loading, login, startDemo } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    const redirectTo = (location.state as { from?: string } | null)?.from || '/';
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (email.trim().toLowerCase() === 'demo@pratap.ai' && password === 'Demo@123') {
        startDemo();
        navigate((location.state as { from?: string } | null)?.from || '/', { replace: true });
        return;
      }
      await login(email, password);
      navigate((location.state as { from?: string } | null)?.from || '/', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid email or password.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        padding: '1.5rem',
      }}
    >
      <div
        className="animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '380px',
          background: 'var(--surface-1)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.75rem' }}>
          <div className="sidebar-logo-icon"><img src="/favicon.svg" alt="Pratap AI" /></div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>Pratap AI Innovation</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Project Hub</div>
          </div>
        </div>

        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
          Sign in
        </h1>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Enter your credentials to access the portal.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              required
              autoFocus
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
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

          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={submitting}>
            <LogIn size={15} /> {submitting ? 'Signing in...' : 'Sign In'}
          </button>
          <button type="button" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', marginTop: '0.65rem' }} onClick={() => { startDemo(); navigate('/'); }}>
            <Play size={14} /> Explore demo workspace
          </button>
        </form>

        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '1.25rem' }}>
          Don't have an account? <Link to="/register" style={{ color: 'var(--accent-blue)', fontWeight: 500 }}>Register</Link>
        </p>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '.65rem' }}>
          Demo: <span style={{ color: 'var(--text-secondary)' }}>demo@pratap.ai</span> · <span style={{ color: 'var(--text-secondary)' }}>Demo@123</span>
        </p>
      </div>
    </div>
  );
};

export default Login;
