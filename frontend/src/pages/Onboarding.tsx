import { useState } from 'react';
import { ArrowRight, CalendarCheck, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errorMessage';

const guessedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dubai';

const Onboarding = () => {
  const { user, completeOnboarding } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ timezone: guessedTimezone, typicalWorkStart: '09:00', typicalWorkEnd: '18:00', notificationPreference: 'IMMEDIATE_AND_DIGEST' as const });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await completeOnboarding(form);
      navigate('/', { replace: true });
    } catch (caught) {
      setError(getErrorMessage(caught, 'Could not finish setup.'));
    } finally {
      setSaving(false);
    }
  };

  return <div className="onboarding-page animate-fade-in">
    <section className="onboarding-card">
      <div className="onboarding-eyebrow">Welcome to Pratap AI Operations Studio</div>
      <h1>Set up your workday, {user?.name?.split(' ')[0]}</h1>
      <p>Your role is <strong>{user?.designation || user?.role}</strong>{user?.department ? <> in <strong>{user.department}</strong></> : null}. This workspace uses one short daily rhythm.</p>
      <div className="onboarding-steps" aria-label="How daily work operates">
        <div><CalendarCheck size={20}/><span><strong>Plan your day</strong><small>Choose realistic work and one primary outcome.</small></span></div>
        <div><CheckCircle2 size={20}/><span><strong>Update as you work</strong><small>Start, pause, complete, or request review from the task.</small></span></div>
        <div><ShieldAlert size={20}/><span><strong>Raise blockers early</strong><small>Your manager sees the issue without duplicate reporting.</small></span></div>
      </div>
      <form onSubmit={submit}>
        <div className="form-group"><label className="form-label" htmlFor="onboarding-timezone">Timezone</label><input id="onboarding-timezone" className="form-input" required value={form.timezone} onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}/></div>
        <div className="onboarding-time-grid">
          <div className="form-group"><label className="form-label" htmlFor="work-start">Typical start</label><input id="work-start" className="form-input" type="time" value={form.typicalWorkStart} onChange={(event) => setForm((current) => ({ ...current, typicalWorkStart: event.target.value }))}/></div>
          <div className="form-group"><label className="form-label" htmlFor="work-end">Typical finish</label><input id="work-end" className="form-input" type="time" value={form.typicalWorkEnd} onChange={(event) => setForm((current) => ({ ...current, typicalWorkEnd: event.target.value }))}/></div>
        </div>
        <div className="form-group"><label className="form-label" htmlFor="notifications">Notifications</label><select id="notifications" className="form-select" value={form.notificationPreference} onChange={(event) => setForm((current) => ({ ...current, notificationPreference: event.target.value as typeof current.notificationPreference }))}><option value="IMMEDIATE_AND_DIGEST">Critical alerts immediately + daily digest</option><option value="DIGEST_ONLY">Daily digest only</option></select></div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="btn btn-primary onboarding-submit" type="submit" disabled={saving}>{saving ? 'Finishing setup…' : 'Continue to Plan My Day'} <ArrowRight size={16}/></button>
      </form>
    </section>
  </div>;
};

export default Onboarding;
