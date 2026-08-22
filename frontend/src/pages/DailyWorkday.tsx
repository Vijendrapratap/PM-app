import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, LockKeyhole, Plus, Square, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { projectApi } from '../api/projectApi';
import { dailyWorkApi, type DailyWorkSession } from '../api/dailyWorkApi';
import type { Project } from '../types';
import { getErrorMessage } from '../utils/errorMessage';
import { isProjectManager, isSuperAdmin } from '../utils/roles';

const formatTime = (value: string | null) => value ? new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-';
const formatDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const duration = (session: DailyWorkSession) => {
  if (!session.endAt) return null;
  const minutes = Math.max(0, Math.floor((new Date(session.endAt).getTime() - new Date(session.startAt).getTime()) / 60000));
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
};
const currentMonth = () => new Date().toISOString().slice(0, 7);

export default function DailyWorkday() {
  const { user } = useAuth();
  const [session, setSession] = useState<DailyWorkSession | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [historyMonth, setHistoryMonth] = useState(currentMonth);
  const [history, setHistory] = useState<DailyWorkSession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [teamHistory, setTeamHistory] = useState<DailyWorkSession[]>([]);
  const [teamHistoryLoading, setTeamHistoryLoading] = useState(false);

  const refresh = async () => setSession(await dailyWorkApi.current());
  useEffect(() => {
    Promise.all([dailyWorkApi.current(), projectApi.list()]).then(([current, available]) => {
      setSession(current);
      setProjects(available.filter((project) => !project.archived && project.status !== 'Completed' && project.assignedMembers.some((member) => member._id === user?._id)));
    }).catch((loadError) => setError(getErrorMessage(loadError, 'We could not load your day.'))).finally(() => setLoading(false));
  }, [user?._id]);

  useEffect(() => {
    setHistoryLoading(true);
    dailyWorkApi.history(historyMonth)
      .then(setHistory)
      .catch((historyError) => setError(getErrorMessage(historyError, 'We could not load your work history.')))
      .finally(() => setHistoryLoading(false));
  }, [historyMonth]);

  const canViewTeamHistory = isSuperAdmin(user?.platformRole || user?.role) || isProjectManager(user?.platformRole || user?.role);
  useEffect(() => {
    if (!canViewTeamHistory) return;
    const [year, month] = historyMonth.split('-').map(Number);
    const endDate = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    setTeamHistoryLoading(true);
    dailyWorkApi.admin({ startDate: `${historyMonth}-01`, endDate })
      .then(setTeamHistory)
      .catch((historyError) => setError(getErrorMessage(historyError, 'We could not load the team history.')))
      .finally(() => setTeamHistoryLoading(false));
  }, [canViewTeamHistory, historyMonth]);

  const stateLabel = useMemo(() => session?.status === 'ACTIVE' ? 'Working' : session?.status === 'AUTO_COMPLETED' ? 'Auto completed' : 'Completed', [session?.status]);
  const start = async () => { try { setSaving(true); setError(''); setSession(await dailyWorkApi.start()); } catch (saveError) { setError(getErrorMessage(saveError, 'We could not start your day.')); } finally { setSaving(false); } };
  const end = async () => { try { setSaving(true); setError(''); setSession(await dailyWorkApi.end()); } catch (saveError) { setError(getErrorMessage(saveError, 'We could not end your day.')); } finally { setSaving(false); } };
  const add = async () => {
    if (!title.trim() || !description.trim()) return;
    try { setSaving(true); setError(''); setSession(await dailyWorkApi.addLog({ title, description, projectId: projectId || undefined })); setTitle(''); setDescription(''); setProjectId(''); setAdding(false); await refresh(); } catch (saveError) { setError(getErrorMessage(saveError, 'We could not save this work record.')); } finally { setSaving(false); }
  };

  if (loading) return <main className="workday-shell"><div className="workday-skeleton skeleton" /></main>;
  return <main className="workday-shell animate-fade-in">
    <header className="workday-header"><div><div className="eyebrow"><CalendarDays size={13} /> My day</div><h1>{session ? stateLabel : 'Ready to start'}</h1><p>{session ? formatDate(session.date) : 'Start a backend-recorded work session when you are ready.'}</p></div></header>
    {error && <div className="workday-error" role="alert"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={14} /></button></div>}
    {!session ? <section className="home-start" id="plan-my-day"><div className="home-start-status"><i /><span>Day status</span><strong>Not started</strong></div><div className="home-start-copy"><span>Welcome, {user?.name || 'team member'}</span><h2>Start your day</h2><p>Your start time is recorded by the server. Projects and assignments stay separate until you record actual work.</p></div><button className="home-start-button" disabled={saving} onClick={start}>Start My Day <Clock3 size={18} /></button></section> : <section className="active-day" id="plan-my-day">
      <div className="active-focus"><div><span className="live-indicator"><i /> {stateLabel}</span><h2>{formatDate(session.date)}</h2><p>Started {formatTime(session.startAt)}{session.endAt ? ` · Ended ${formatTime(session.endAt)}` : ''}</p></div><div className="active-time-card"><Clock3 size={20} /><span><small>Session</small><strong>{duration(session) || 'In progress'}</strong><em>{session.logs.length} work {session.logs.length === 1 ? 'entry' : 'entries'}</em></span></div></div>
      <div className="active-outcomes"><div className="section-heading"><div><span>Today's work records</span><h2>What you actually worked on</h2></div>{session.status === 'ACTIVE' && <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={15} /> Add work</button>}</div>
        {!session.logs.length ? <p className="home-project-empty">No work records yet. You can end your day without adding one.</p> : session.logs.map((log) => <article className="active-outcome" key={log._id}><div className="active-outcome-head"><span className="outcome-number"><LockKeyhole size={15} /></span><div><small>{log.project?.name || 'Other work'}</small><h3>{log.title}</h3><p>{log.description}</p><small>Recorded {formatTime(log.createdAt)}</small></div></div></article>)}
      </div>
      {session.status === 'ACTIVE' ? <aside className="close-day-panel"><div className="close-day-title"><div className="close-icon"><Square size={18} /></div><div><span>End My Day</span><p>This closes the session. Existing work records remain immutable.</p></div></div><button className="btn btn-primary" disabled={saving} onClick={end}>{saving ? 'Ending...' : 'End My Day'}<CheckCircle2 size={15} /></button></aside> : <div className="day-closed"><CheckCircle2 size={28} /><span>Day {stateLabel}</span><h2>{formatTime(session.startAt)} → {formatTime(session.endAt)}</h2><p>{duration(session)} · {session.logs.length} work {session.logs.length === 1 ? 'entry' : 'entries'}</p></div>}
    </section>}
    <section className="work-history" id="work-history">
      <header><div><CalendarDays size={17} /><span><strong>Day-wise history</strong><small>Saved work records are read-only</small></span></div><input aria-label="History month" type="month" value={historyMonth} max={currentMonth()} onChange={(event) => setHistoryMonth(event.target.value)} /></header>
      {historyLoading ? <div className="workday-skeleton skeleton" /> : !history.length ? <p className="home-project-empty">No completed or active work sessions found for this month.</p> : <div className="history-detail">
        {history.map((day) => <details key={day._id} open={day.date === session?.date}>
          <summary><span><strong>{formatDate(day.date)}</strong><small>{formatTime(day.startAt)} → {formatTime(day.endAt)} · {day.logs.length} {day.logs.length === 1 ? 'entry' : 'entries'}</small></span><b>{day.status === 'AUTO_COMPLETED' ? 'Auto completed' : day.status === 'ACTIVE' ? 'Working' : 'Completed'}</b></summary>
          {day.logs.length ? day.logs.map((log) => <article key={log._id}><span><small>{log.project?.name || 'Other work'} · Recorded {formatTime(log.createdAt)}</small><strong>{log.title}</strong><p>{log.description}</p></span><LockKeyhole size={15} /></article>) : <p className="home-project-empty">No work records were saved for this day.</p>}
        </details>)}
      </div>}
    </section>
    {canViewTeamHistory && <section className="work-history" id="team-history">
      <header><div><CalendarDays size={17} /><span><strong>Team history</strong><small>All team sessions and immutable work records</small></span></div><input aria-label="Team history month" type="month" value={historyMonth} max={currentMonth()} onChange={(event) => setHistoryMonth(event.target.value)} /></header>
      {teamHistoryLoading ? <div className="workday-skeleton skeleton" /> : !teamHistory.length ? <p className="home-project-empty">No team sessions found for this month.</p> : <div className="history-detail">
        {teamHistory.map((day) => <details key={day._id}>
          <summary><span><strong>{day.user?.name || 'Team member'} · {formatDate(day.date)}</strong><small>{formatTime(day.startAt)} → {formatTime(day.endAt)} · {day.logs.length} {day.logs.length === 1 ? 'entry' : 'entries'}</small></span><b>{day.status === 'AUTO_COMPLETED' ? 'Auto completed' : day.status === 'ACTIVE' ? 'Working' : 'Completed'}</b></summary>
          {day.logs.length ? day.logs.map((log) => <article key={log._id}><span><small>{log.project?.name || 'Other work'} · Recorded {formatTime(log.createdAt)}</small><strong>{log.title}</strong><p>{log.description}</p></span><LockKeyhole size={15} /></article>) : <p className="home-project-empty">No work records were saved for this day.</p>}
        </details>)}
      </div>}
    </section>}
    {adding && <div className="modal-backdrop" role="presentation"><div className="modal-container" role="dialog" aria-modal="true"><div className="modal-header"><div><div className="modal-title">Add work record</div><p className="modal-subtitle">Saved records cannot be edited or deleted.</p></div><button className="icon-btn" aria-label="Close" onClick={() => setAdding(false)}><X size={18} /></button></div><div className="modal-body start-work-form"><label><span>Work title</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} /></label><label><span>Project</span><select value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">Other work</option>{projects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}</select></label><label><span>Details</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={3000} /></label></div><div className="modal-footer"><button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button><button className="btn btn-primary" disabled={saving || !title.trim() || !description.trim()} onClick={add}>Save record <LockKeyhole size={14} /></button></div></div></div>}
  </main>;
}
