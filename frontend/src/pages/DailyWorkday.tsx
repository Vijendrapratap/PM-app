import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, LockKeyhole, Plus, Square, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { projectApi } from '../api/projectApi';
import { dailyWorkApi, type DailyWorkSession } from '../api/dailyWorkApi';
import { projectTaskApi, type AssignedProjectTask } from '../api/projectTaskApi';
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
const isWorkable = (task: AssignedProjectTask) => (task.stage ? ['BACKLOG', 'READY', 'IN_PROGRESS'].includes(task.stage) : !['Completed', 'In Review', 'Cancelled'].includes(task.status)) && (task.project?.kind === 'STANDING' || task.project?.stage === 'ACTIVE');

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
  const [myTasks, setMyTasks] = useState<AssignedProjectTask[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [taskId, setTaskId] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskProjectId, setNewTaskProjectId] = useState('');
  const [minutes, setMinutes] = useState('');
  const [ending, setEnding] = useState(false);
  const [outcomes, setOutcomes] = useState<Record<string, { outcome: 'DONE' | 'CARRIED' | 'BLOCKED'; reason: string }>>({});
  const [historyMonth, setHistoryMonth] = useState(currentMonth);
  const [history, setHistory] = useState<DailyWorkSession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [teamHistory, setTeamHistory] = useState<DailyWorkSession[]>([]);
  const [teamHistoryLoading, setTeamHistoryLoading] = useState(false);

  const refresh = async () => setSession(await dailyWorkApi.current());
  useEffect(() => {
    Promise.all([dailyWorkApi.current(), projectApi.list(), projectTaskApi.assignedToMe()]).then(([current, available, tasks]) => {
      setSession(current);
      setProjects(available.filter((project) => !project.archived && (project.kind === 'STANDING' || (project.stage === 'ACTIVE' && (project.owner?._id === user?._id || project.assignedMembers.some((member) => member._id === user?._id))))));
      setMyTasks(tasks.filter(isWorkable));
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
  const togglePick = (id: string) => setPicked((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length >= 3 ? current : [...current, id]);
  const start = async () => { try { setSaving(true); setError(''); setSession(await dailyWorkApi.start(picked.length ? { commitments: picked } : { newTask: { title: newTaskTitle, projectId: newTaskProjectId || undefined } })); setNewTaskTitle(''); } catch (saveError) { setError(getErrorMessage(saveError, 'We could not start your day.')); } finally { setSaving(false); } };
  const openEnd = () => { setOutcomes(Object.fromEntries((session?.commitments || []).map((row) => [row.taskId, { outcome: 'DONE' as const, reason: '' }]))); setEnding(true); };
  const end = async () => {
    try { setSaving(true); setError(''); setSession(await dailyWorkApi.end(Object.entries(outcomes).map(([id, value]) => ({ taskId: id, outcome: value.outcome, reason: value.reason.trim() || undefined })))); setEnding(false); }
    catch (saveError) { setError(getErrorMessage(saveError, 'We could not end your day.')); } finally { setSaving(false); }
  };
  const add = async () => {
    if (!title.trim() || !description.trim() || (!taskId && !newTaskTitle.trim())) return;
    try {
      setSaving(true); setError('');
      await dailyWorkApi.addLog({ title, description, minutes: minutes ? Number(minutes) : undefined, ...(taskId ? { taskId } : { newTask: { title: newTaskTitle, projectId: newTaskProjectId || undefined } }) });
      setTitle(''); setDescription(''); setTaskId(''); setNewTaskTitle(''); setNewTaskProjectId(''); setMinutes(''); setAdding(false);
      await refresh();
      setMyTasks((await projectTaskApi.assignedToMe()).filter(isWorkable));
    } catch (saveError) { setError(getErrorMessage(saveError, 'We could not save this work record.')); } finally { setSaving(false); }
  };

  if (loading) return <main className="workday-shell"><div className="workday-skeleton skeleton" /></main>;
  return <main className="workday-shell animate-fade-in">
    <header className="workday-header"><div><div className="eyebrow"><CalendarDays size={13} /> My day</div><h1>{session ? stateLabel : 'Ready to start'}</h1><p>{session ? formatDate(session.date) : 'Start a backend-recorded work session when you are ready.'}</p></div></header>
    {error && <div className="workday-error" role="alert"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={14} /></button></div>}
    {!session ? <section className="home-start" id="plan-my-day"><div className="home-start-status"><i /><span>Day status</span><strong>Not started</strong></div><div className="home-start-copy"><span>Welcome, {user?.name || 'team member'}</span><h2>Start your day</h2><p>Your start time is recorded by the server. Projects and assignments stay separate until you record actual work.</p></div>
      <fieldset className="commit-picker"><legend>Pick up to 3 tasks you will finish today</legend>
        {!myTasks.length ? <p className="home-project-empty">No open tasks assigned to you yet. Add one below.</p> :
          myTasks.map((task) => <label key={task._id} className={picked.includes(task._id) ? 'is-picked' : ''}><input type="checkbox" checked={picked.includes(task._id)} disabled={!picked.includes(task._id) && picked.length >= 3} onChange={() => togglePick(task._id)} /><span><strong>{task.title}</strong><small>{task.project?.name || 'Project'}</small></span></label>)}
        {!myTasks.length && <label><span>Or add today's task</span><input value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} maxLength={180} placeholder="e.g. Follow up with resort client" /></label>}
        {!myTasks.length && <label><span>Project</span><select value={newTaskProjectId} onChange={(event) => setNewTaskProjectId(event.target.value)}><option value="">My department ops project</option>{projects.map((project) => <option key={project._id} value={project._id}>{project.name}{project.kind === 'STANDING' ? ' (ops)' : ''}</option>)}</select></label>}
      </fieldset>
      <button className="home-start-button" disabled={saving || (!picked.length && !newTaskTitle.trim())} onClick={start}>Start My Day <Clock3 size={18} /></button></section> : <section className="active-day" id="plan-my-day">
      <div className="active-focus"><div><span className="live-indicator"><i /> {stateLabel}</span><h2>{formatDate(session.date)}</h2><p>Started {formatTime(session.startAt)}{session.endAt ? ` · Ended ${formatTime(session.endAt)}` : ''}</p></div><div className="active-time-card"><Clock3 size={20} /><span><small>Session</small><strong>{duration(session) || 'In progress'}</strong><em>{session.logs.length} work {session.logs.length === 1 ? 'entry' : 'entries'}</em></span></div></div>
      <ol className="commit-list">{session.commitments.map((row) => <li key={row.taskId}><span className="outcome-number">{row.position}</span><div><small>{row.task?.projectName}</small><strong>{row.task?.title}</strong>{row.outcome && <em>{row.outcome.toLowerCase()}</em>}</div></li>)}</ol>
      <div className="active-outcomes"><div className="section-heading"><div><span>Today's work records</span><h2>What you actually worked on</h2></div>{session.status === 'ACTIVE' && <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={15} /> Add work</button>}</div>
        {!session.logs.length ? <p className="home-project-empty">No work records yet. You can end your day without adding one.</p> : session.logs.map((log) => <article className="active-outcome" key={log._id}><div className="active-outcome-head"><span className="outcome-number"><LockKeyhole size={15} /></span><div><small>{log.project?.name || 'Other work'}</small><h3>{log.title}</h3><p>{log.description}</p><small>Recorded {formatTime(log.createdAt)}{log.minutes ? ` · ${log.minutes} min` : ''}</small></div></div></article>)}
      </div>
      {session.status === 'ACTIVE' ? <aside className="close-day-panel"><div className="close-day-title"><div className="close-icon"><Square size={18} /></div><div><span>End My Day</span><p>This closes the session. Existing work records remain immutable.</p></div></div><button className="btn btn-primary" disabled={saving} onClick={openEnd}>{saving ? 'Ending...' : 'End My Day'}<CheckCircle2 size={15} /></button></aside> : <div className="day-closed"><CheckCircle2 size={28} /><span>Day {stateLabel}</span><h2>{formatTime(session.startAt)} → {formatTime(session.endAt)}</h2><p>{duration(session)} · {session.logs.length} work {session.logs.length === 1 ? 'entry' : 'entries'}</p></div>}
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
    {adding && <div className="modal-backdrop" role="presentation"><div className="modal-container" role="dialog" aria-modal="true"><div className="modal-header"><div><div className="modal-title">Add work record</div><p className="modal-subtitle">Saved records cannot be edited or deleted.</p></div><button className="icon-btn" aria-label="Close" onClick={() => setAdding(false)}><X size={18} /></button></div><div className="modal-body start-work-form">{error && <div className="workday-error" role="alert"><span>{error}</span></div>}<label><span>Work title</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} /></label>
      <label><span>Task</span><select value={taskId} onChange={(event) => setTaskId(event.target.value)}><option value="">+ New task…</option>{myTasks.map((task) => <option key={task._id} value={task._id}>{task.title} · {task.project?.name}</option>)}</select></label>
      {!taskId && <><label><span>New task title</span><input value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} maxLength={180} placeholder="e.g. Fix OTP retry on login" /></label>
      <label><span>Project</span><select value={newTaskProjectId} onChange={(event) => setNewTaskProjectId(event.target.value)}><option value="">My department ops project</option>{projects.map((project) => <option key={project._id} value={project._id}>{project.name}{project.kind === 'STANDING' ? ' (ops)' : ''}</option>)}</select></label></>}
      <label><span>Minutes spent (optional)</span><input type="number" min={1} max={720} value={minutes} onChange={(event) => setMinutes(event.target.value)} /></label>
      <label><span>Details</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={3000} /></label></div><div className="modal-footer"><button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button><button className="btn btn-primary" disabled={saving || !title.trim() || !description.trim() || (!taskId && !newTaskTitle.trim())} onClick={add}>Save record <LockKeyhole size={14} /></button></div></div></div>}
    {ending && session && <div className="modal-backdrop" role="presentation"><div className="modal-container" role="dialog" aria-modal="true" aria-labelledby="end-day-title"><div className="modal-header"><div><div className="modal-title" id="end-day-title">How did today go?</div><p className="modal-subtitle">One answer per commitment. Carrying a task a third time needs a reason.</p></div><button className="icon-btn" aria-label="Close" onClick={() => setEnding(false)}><X size={18} /></button></div>
      <div className="modal-body start-work-form">{error && <div className="workday-error" role="alert"><span>{error}</span></div>}{session.commitments.map((row) => <fieldset key={row.taskId}><legend>{row.task?.title}</legend>
        <select aria-label={`Outcome for ${row.task?.title}`} value={outcomes[row.taskId]?.outcome || 'DONE'} onChange={(event) => setOutcomes((current) => ({ ...current, [row.taskId]: { ...current[row.taskId], outcome: event.target.value as 'DONE' | 'CARRIED' | 'BLOCKED' } }))}><option value="DONE">Done</option><option value="CARRIED">Carry to tomorrow</option><option value="BLOCKED">Blocked</option></select>
        {outcomes[row.taskId]?.outcome !== 'DONE' && <input aria-label={`Reason for ${row.task?.title}`} placeholder={(row.task?.carryForwardCount || 0) >= 2 ? 'Reason (required)' : 'Reason (optional)'} value={outcomes[row.taskId]?.reason || ''} onChange={(event) => setOutcomes((current) => ({ ...current, [row.taskId]: { ...current[row.taskId], reason: event.target.value } }))} />}
      </fieldset>)}</div>
      <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setEnding(false)}>Cancel</button><button className="btn btn-primary" disabled={saving || session.commitments.some((row) => outcomes[row.taskId]?.outcome === 'CARRIED' && (row.task?.carryForwardCount || 0) >= 2 && !outcomes[row.taskId]?.reason.trim())} onClick={end}>{saving ? 'Ending...' : 'End My Day'} <CheckCircle2 size={15} /></button></div></div></div>}
  </main>;
}
