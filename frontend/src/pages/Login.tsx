import { useState } from 'react';
import { Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, Play, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errorMessage';

const Login = () => {
  const { user, loading, login, startDemo } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showDemoHint, setShowDemoHint] = useState(false);

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
    <div className="auth-page">
      <div className="auth-card animate-fade-in" style={{ maxWidth: '400px' }}>
        <div className="auth-header">
          <div className="sidebar-logo-icon">
            <img src="/brand/pratap-ai-mark.png" alt="Pratap AI" />
          </div>
          <div>
            <div className="auth-logo-title">Pratap AI Innovation</div>
            <div className="auth-logo-sub">Project Hub</div>
          </div>
        </div>

        <h1 className="auth-title">Sign in</h1>
        <p className="auth-subtitle">
          Enter your credentials to access the portal.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
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
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
            style={{ width: '100%', justifyContent: 'center', marginBottom: '0.75rem' }}
            disabled={submitting}
          >
            <LogIn size={15} /> {submitting ? 'Signing in...' : 'Sign In'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => {
              startDemo();
              navigate('/');
            }}
          >
            <Play size={14} /> Explore demo workspace
          </button>
        </form>

        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '1.5rem', marginBottom: 0 }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--accent-cyan)', fontWeight: 600, textDecoration: 'none' }}>
            Register
          </Link>
        </p>

        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', color: 'var(--text-muted)' }}
            onClick={() => setShowDemoHint(!showDemoHint)}
          >
            {showDemoHint ? 'Hide demo credentials' : 'View demo credentials'}
          </button>
          {showDemoHint && (
            <div className="demo-hint-box animate-fade-in">
              Demo Email: <strong>demo@pratap.ai</strong><br />
              Password: <strong>Demo@123</strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
