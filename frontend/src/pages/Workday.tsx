import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle, ArrowRight, ArrowUpRight, CalendarDays, Check, CheckCircle2, CircleDot,
  Clock3, Flag, LockKeyhole, Pause, Play, RotateCcw,
  Save, Target, Timer, Users, X, FolderKanban,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { projectApi } from '../api/projectApi';
import { projectTaskApi, type AssignedProjectTask } from '../api/projectTaskApi';
import { workdayApi, type TeamPulseEntry, type Workday as WorkdayRecord, type WorkdayItem, type WorkdayItemStatus } from '../api/workdayApi';
import { getErrorMessage } from '../utils/errorMessage';
import { isSuperAdmin } from '../utils/roles';
import { workSessionApi, type WorkSessionSummary } from '../api/workSessionApi';
import type { Project } from '../types';
import DeadlineTimer from '../components/DeadlineTimer';
import DailyWorkday from './DailyWorkday';

type StartItem = { key: string; projectId?: string; taskId?: string; title: string; plannedOutcome: string; plannedEstimateMinutes: number; priority?: 'Low' | 'Medium' | 'High' | 'Critical'; carriedFromItemId?: string; carryoverReason?: string; source: 'CARRYOVER' | 'ASSIGNED' | 'ADDED_TODAY' };
type EndState = 'DONE' | 'CARRY_OVER' | 'RESCHEDULED' | 'BACKLOG' | 'BLOCKED' | 'NO_LONGER_REQUIRED';
type ItemDraft = { status: WorkdayItemStatus; progressNote: string; blockerReason: string; endState: EndState; carryoverReason: string };
type View = 'my-day' | 'team';

const dateKey = () => {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};
const canSeeTeam = (role?: string) => isSuperAdmin(role);
const statusClass = (status: string) => status.toLowerCase().replace(/\s+/g, '-');
const formatWorkedTime = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h ${String(remainder).padStart(2, '0')}m` : `${remainder}m`;
};

const Workday = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<View>((searchParams.get('view') === 'team' || isSuperAdmin(user?.platformRole || user?.role)) && canSeeTeam(user?.role) ? 'team' : 'my-day');
  const [workday, setWorkday] = useState<WorkdayRecord | null>(null);
  const [tasks, setTasks] = useState<AssignedProjectTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [itemDrafts, setItemDrafts] = useState<Record<string, ItemDraft>>({});
  const [completedSummary, setCompletedSummary] = useState('');
  const [dayBlockers, setDayBlockers] = useState('');
  const [remarks, setRemarks] = useState('');
  const [teamDate, setTeamDate] = useState(dateKey());
  const [team, setTeam] = useState<TeamPulseEntry[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [timeSummary, setTimeSummary] = useState<WorkSessionSummary | null>(null);
  const [clockTick, setClockTick] = useState(Date.now());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [selectedMinutes, setSelectedMinutes] = useState(60);
  const [workTitle, setWorkTitle] = useState('');
  const [plannedOutcome, setPlannedOutcome] = useState('');
  const [startItems, setStartItems] = useState<StartItem[]>([]);
  const [historyMonth, setHistoryMonth] = useState(dateKey().slice(0, 7));
  const [history, setHistory] = useState<WorkdayRecord[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<WorkdayRecord | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setView((searchParams.get('view') === 'team' || isSuperAdmin(user?.platformRole || user?.role)) && canSeeTeam(user?.role) ? 'team' : 'my-day');
  }, [searchParams, user?.platformRole, user?.role]);

  useEffect(() => {
    if (!searchParams.get('plan') || loading) return;
    setView('my-day');
    window.requestAnimationFrame(() => {
      document.getElementById('plan-my-day')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [loading, searchParams]);

  useEffect(() => {
    if (!searchParams.get('start') || loading || workday) return;
    setStartModalOpen(true);
  }, [loading, searchParams, workday]);

  useEffect(() => {
    if (!searchParams.get('history') || loading) return;
    setView('my-day');
    window.requestAnimationFrame(() => document.getElementById('work-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [loading, searchParams]);

  const changeView = (next: View) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'team') params.set('view', 'team');
    else params.delete('view');
    setSearchParams(params, { replace: true });
    setView(next);
  };

  const hydrateDrafts = useCallback((record: WorkdayRecord | null) => {
    if (!record) return;
    setItemDrafts(Object.fromEntries(record.items.map((item) => [item._id, {
      status: item.status,
      progressNote: item.progressNote || '',
      blockerReason: item.blockerReason || '',
      endState: (item.endState as EndState | null) || (item.status === 'Completed' ? 'DONE' : item.status === 'Blocked' ? 'BLOCKED' : 'CARRY_OVER'),
      carryoverReason: item.carryoverReason || '',
    }])));
    setCompletedSummary(record.completedSummary || '');
    setDayBlockers(record.blockers || '');
    setRemarks(record.remarks || '');
  }, []);

  const refreshTimeSummary = useCallback(async (dailyPlanId?: string) => {
    if (!dailyPlanId) return;
    try {
      setTimeSummary(await workSessionApi.summary(dailyPlanId));
      setClockTick(Date.now());
    } catch (sessionError) {
      setError(getErrorMessage(sessionError, 'We could not load today’s tracked time.'));
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [today, assigned, assignedProjects, carryover] = await Promise.all([
          workdayApi.today(), projectTaskApi.assignedToMe(), projectApi.list(), workdayApi.carryover(),
        ]);
        setWorkday(today);
        hydrateDrafts(today);
        if (today) await refreshTimeSummary(today._id);
        const openTasks = assigned.filter((task) => task.status !== 'Completed');
        setTasks(openTasks);
        setProjects(assignedProjects.filter((project) => !project.archived && project.status !== 'Completed' && project.assignedMembers.some((member) => member._id === user?._id)));
        if (!today) setStartItems(carryover.map((item) => ({
          key: `carry-${item._id}`,
          projectId: item.projectId || undefined,
          taskId: item.taskId || undefined,
          title: item.title,
          plannedOutcome: item.plannedOutcome || item.title,
          plannedEstimateMinutes: item.plannedEstimateMinutes || 60,
          priority: item.task?.priority,
          carriedFromItemId: item._id,
          carryoverReason: 'Automatically carried forward from unfinished work.',
          source: 'CARRYOVER' as const,
        })));
      } catch (loadError) {
        setError(getErrorMessage(loadError, 'We could not load today’s workday.'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [hydrateDrafts, refreshTimeSummary, user]);

  useEffect(() => {
    workdayApi.history(historyMonth).then(setHistory).catch(() => setHistory([]));
  }, [historyMonth, workday?.status]);

  useEffect(() => {
    if (!timeSummary?.activeSession) return;
    const timer = window.setInterval(() => {
      setClockTick(Date.now());
      if (workday?._id) void refreshTimeSummary(workday._id);
    }, 60000);
    return () => window.clearInterval(timer);
  }, [refreshTimeSummary, timeSummary?.activeSession, workday?._id]);

  useEffect(() => {
    if (view !== 'team' || !canSeeTeam(user?.role)) return;
    setTeamLoading(true);
    workdayApi.team(teamDate)
      .then(setTeam)
      .catch((teamError) => setError(getErrorMessage(teamError, 'We could not load the team pulse.')))
      .finally(() => setTeamLoading(false));
  }, [teamDate, user?.role, view]);

  const startProjects = useMemo(() => {
    const assigned = new Map<string, string>();
    projects.forEach((project) => assigned.set(project._id, project.name));
    tasks.forEach((task) => task.project && assigned.set(task.project._id, task.project.name));
    return [...assigned].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, tasks]);
  const startTasks = useMemo(() => tasks.filter((task) => task.projectId === selectedProjectId), [selectedProjectId, tasks]);

  const sessionMinutes = useCallback((session: WorkSessionSummary['sessions'][number]) => {
    if (session.status !== 'ACTIVE') return Number(session.durationMinutes || 0);
    const estimate = workday?.items.find((item) => item.taskId === session.taskId)?.plannedEstimateMinutes || 90;
    return Math.min(Math.max(0, Math.floor((clockTick - new Date(session.startedAt).getTime()) / 60000)), Math.min(estimate, 120));
  }, [clockTick, workday?.items]);

  const trackedMinutes = useMemo(() => {
    if (!timeSummary) return 0;
    return timeSummary.sessions.reduce((total, session) => total + sessionMinutes(session), 0);
  }, [sessionMinutes, timeSummary]);
  const plannedMinutes = useMemo(() => workday?.items.reduce((total, item) => total + Number(item.plannedEstimateMinutes || 0), 0) || 0, [workday]);
  const trackedForTask = useCallback((taskId: string) => timeSummary?.sessions
    .filter((session) => session.taskId === taskId)
    .reduce((total, session) => total + sessionMinutes(session), 0) || 0, [sessionMinutes, timeSummary]);
  const trackedForOther = useCallback((title: string) => timeSummary?.sessions
    .filter((session) => !session.taskId && session.note === title)
    .reduce((total, session) => total + sessionMinutes(session), 0) || 0, [sessionMinutes, timeSummary]);

  const startTaskTimer = async (item: WorkdayItem) => {
    if (!workday || !item.taskId) return;
    try {
      setSaving(true); setError('');
      await workSessionApi.start(workday._id, item.taskId, item.title);
      const record = await workdayApi.today();
      setWorkday(record); hydrateDrafts(record);
      await refreshTimeSummary(workday._id);
    } catch (timerError) {
      setError(getErrorMessage(timerError, 'We could not start time tracking for this task.'));
    } finally { setSaving(false); }
  };

  const pauseTaskTimer = async () => {
    if (!workday || !timeSummary?.activeSession) return;
    try {
      setSaving(true); setError('');
      await workSessionApi.pause(timeSummary.activeSession._id);
      await refreshTimeSummary(workday._id);
    } catch (timerError) {
      setError(getErrorMessage(timerError, 'We could not pause time tracking.'));
    } finally { setSaving(false); }
  };

  const addStartItem = () => {
    const task = tasks.find((candidate) => candidate._id === selectedTaskId && candidate.projectId === selectedProjectId);
    const other = selectedProjectId === 'OTHER';
    const custom = selectedTaskId === 'CUSTOM';
    const title = task?.title || workTitle.trim();
    if ((!other && !selectedProjectId) || (!other && !task && !custom) || !title || plannedOutcome.trim().length < 3 || !selectedMinutes) return;
    if (task && startItems.some((item) => item.taskId === task._id)) {
      setError('That assigned task is already in today’s work list.');
      return;
    }
    setStartItems((current) => [...current, {
      key: `new-${Date.now()}`,
      projectId: other ? undefined : selectedProjectId,
      taskId: task?._id,
      title,
      plannedOutcome: plannedOutcome.trim(),
      plannedEstimateMinutes: selectedMinutes,
      priority: task?.priority || 'Medium',
      source: task ? 'ASSIGNED' : 'ADDED_TODAY',
    }]);
    setSelectedTaskId(''); setWorkTitle(''); setPlannedOutcome(''); setSelectedMinutes(60); setError('');
  };

  const startSelectedWork = async () => {
    if (!startItems.length) return;
    try {
      setSaving(true); setError('');
      const record = await workdayApi.start({
        focus: startItems[0].title,
        items: startItems.map(({ key: _key, ...item }) => item),
      });
      setWorkday(record); hydrateDrafts(record); setStartModalOpen(false);
      await refreshTimeSummary(record._id);
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'We could not start your workday.'));
    } finally { setSaving(false); }
  };

  const startOtherTimer = async (item: WorkdayItem) => {
    if (!workday) return;
    try {
      setSaving(true); setError('');
      await workSessionApi.start(workday._id, null, item.title);
      const record = await workdayApi.today();
      setWorkday(record); hydrateDrafts(record);
      await refreshTimeSummary(workday._id);
    } catch (timerError) {
      setError(getErrorMessage(timerError, 'We could not start time tracking for this work.'));
    } finally { setSaving(false); }
  };

  const saveItem = async (itemId: string) => {
    const draft = itemDrafts[itemId];
    if (!draft || (draft.status === 'Blocked' && !draft.blockerReason.trim())) {
      setError('Add what is blocking this outcome before saving it as blocked.');
      return;
    }
    try {
      setSaving(true); setError('');
      const record = await workdayApi.updateItem(itemId, draft);
      setWorkday(record); hydrateDrafts(record); await refreshTimeSummary(record._id);
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'We could not save this update.'));
    } finally { setSaving(false); }
  };

  const finishDay = async () => {
    if (!workday || !completedSummary.trim()) {
      setError('Write a short summary of what you completed before closing the day.');
      return;
    }
    const blockedWithoutReason = workday.items.some((item) => itemDrafts[item._id]?.status === 'Blocked' && !itemDrafts[item._id]?.blockerReason.trim());
    if (blockedWithoutReason) {
      setError('Every blocked outcome needs a blocker reason so the team can help.');
      return;
    }
    const missingCarryoverReason = workday.items.some((item) => {
      const draft = itemDrafts[item._id];
      return draft && (draft.endState === 'BACKLOG' || ((item.carryoverCount || 0) >= 2 && draft.endState === 'CARRY_OVER')) && !draft.carryoverReason.trim();
    });
    if (missingCarryoverReason) {
      setError('Add a reason for work returning to backlog or carried over more than twice.');
      return;
    }
    try {
      setSaving(true); setError('');
      const record = await workdayApi.finish({
        completedSummary: completedSummary.trim(), blockers: dayBlockers.trim(), remarks: remarks.trim(),
        items: workday.items.map((item) => ({ id: item._id, ...itemDrafts[item._id] })),
      });
      setWorkday(record); hydrateDrafts(record);
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'We could not close your workday.'));
    } finally { setSaving(false); }
  };

  const counts = useMemo(() => ({
    working: team.filter((entry) => entry.state === 'Working').length,
    closed: team.filter((entry) => entry.state === 'Closed').length,
    notStarted: team.filter((entry) => entry.state === 'Not started').length,
    blocked: team.filter((entry) => entry.workday?.items.some((item) => item.status === 'Blocked') || entry.workday?.blockers).length,
  }), [team]);
  const historyCells = useMemo(() => {
    const [year, month] = historyMonth.split('-').map(Number);
    const count = new Date(year, month, 0).getDate();
    const offset = new Date(year, month - 1, 1).getDay();
    const byDate = new Map(history.map((day) => [day.workDate, day]));
    return [
      ...Array.from({ length: offset }, () => null),
      ...Array.from({ length: count }, (_, index) => {
        const key = `${historyMonth}-${String(index + 1).padStart(2, '0')}`;
        return { day: index + 1, record: byDate.get(key) || null };
      }),
    ];
  }, [history, historyMonth]);

  if (loading) return <div className="workday-shell"><div className="workday-skeleton skeleton" /><div className="workday-skeleton skeleton" /></div>;

  return (
    <main className="workday-shell animate-fade-in">
      <header className="workday-header">
        <div>
          <div className="eyebrow"><CircleDot size={13} /> Daily operating rhythm</div>
          <h1>{view === 'team' ? 'Team pulse' : !workday ? 'Home' : 'My day'}</h1>
          <p>{view === 'team' ? 'See commitments, progress and blockers without another status meeting.' : !workday ? 'Start your day with one assigned task. You can add more work after you begin.' : 'Keep your current work moving and close the day when you are done.'}</p>
        </div>
        <div className="workday-date"><CalendarDays size={16} /><span>{new Date(`${teamDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })}</span></div>
      </header>

      {canSeeTeam(user?.role) && <div className="workday-tabs" role="tablist">
        {!isSuperAdmin(user?.platformRole || user?.role) && <button role="tab" aria-selected={view === 'my-day'} className={view === 'my-day' ? 'active' : ''} onClick={() => changeView('my-day')}><Target size={15} /> My day</button>}
        <button role="tab" aria-selected={view === 'team'} className={view === 'team' ? 'active' : ''} onClick={() => changeView('team')}><Users size={15} /> Team pulse</button>
      </div>}

      {error && <div className="workday-error" role="alert"><AlertCircle size={16} /><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={14} /></button></div>}
      {searchParams.get('closeout') === '1' && view === 'my-day' && workday?.status === 'Open' && (
        <div className="closeout-nudge"><LockKeyhole size={17} /><div><strong>Close the loop before signing out</strong><span>It takes about a minute and gives the team a clean handoff for tomorrow.</span></div></div>
      )}

      {view === 'my-day' && <section className="home-project-dashboard" aria-labelledby="active-projects-title">
        <header><div><span className="home-project-icon"><FolderKanban size={17}/></span><span><strong id="active-projects-title">My active projects</strong><small>{projects.length} project{projects.length === 1 ? '' : 's'} assigned to you</small></span></div><Link to="/projects">View all <ArrowUpRight size={14}/></Link></header>
        {projects.length ? <div className="home-project-grid">{projects.map((project) => {
          const progress = Math.max(0, Math.min(100, Number(project.progress || 0)));
          const openTasks = tasks.filter((task) => task.projectId === project._id).length;
          return <Link className="home-project-card" to={`/projects/${project._id}`} key={project._id}>
            <div className="home-project-card-head"><span><small>{project.priority} priority</small><strong>{project.name}</strong></span><ArrowUpRight size={15}/></div>
            <div className="home-project-progress"><span><b>Progress</b><strong>{progress}%</strong></span><i><b style={{ width: `${progress}%` }}/></i></div>
            <footer><span>{openTasks} open task{openTasks === 1 ? '' : 's'}</span><DeadlineTimer deadline={project.estimatedCompletionDate || project.deadline}/></footer>
          </Link>;
        })}</div> : <p className="home-project-empty">No active project is assigned to you yet. You can still add Other work when you start your day.</p>}
      </section>}

      {view === 'team' ? (
        <section className="team-pulse">
          <div className="pulse-toolbar"><div className="pulse-stats"><span><i className="working" />{counts.working} working</span><span><i className="closed" />{counts.closed} closed</span><span><i />{counts.notStarted} not started</span><span className={counts.blocked ? 'has-blockers' : ''}><Flag size={13} />{counts.blocked} blocked</span></div><label>Date<input type="date" value={teamDate} max={dateKey()} onChange={(event) => setTeamDate(event.target.value)} /></label></div>
          {teamLoading ? <div className="pulse-loading skeleton" /> : (
            <div className="pulse-list">
              {team.map((entry) => <article className="pulse-person" key={entry.user._id}>
                <div className="pulse-person-head"><div className="pulse-avatar">{entry.user.name.charAt(0)}</div><div className="pulse-identity"><strong>{entry.user.name}</strong><span>{entry.user.department || entry.user.role}</span></div><span className={`work-state ${statusClass(entry.state)}`}>{entry.state}</span></div>
                {!entry.workday ? <p className="pulse-empty">No commitment recorded for this day.</p> : <>
                  <div className="pulse-focus"><Target size={13} /><span>{entry.workday.focus}</span></div>
                  <div className="pulse-outcomes">{entry.workday.items.map((item) => <div key={item._id}><span className={`outcome-dot ${statusClass(item.status)}`}><Check size={10} /></span><p><strong>{item.title}</strong><small>{item.project?.name || 'Other work'} · {item.status}</small></p></div>)}</div>
                  {(entry.workday.blockers || entry.workday.items.some((item) => item.blockerReason)) && <div className="pulse-blocker"><Flag size={13} /><span>{entry.workday.blockers || entry.workday.items.find((item) => item.blockerReason)?.blockerReason}</span></div>}
                  {entry.workday.completedSummary && <p className="pulse-summary"><CheckCircle2 size={13} />{entry.workday.completedSummary}<small>{formatWorkedTime(entry.workday.productiveMinutes || 0)} productive time</small></p>}
                </>}
              </article>)}
            </div>
          )}
        </section>
      ) : !workday ? (
        <section className="home-start" id="plan-my-day">
          <div className="home-start-status"><i/><span>Day status</span><strong>Not Started</strong></div>
          <div className="home-start-copy"><span>Welcome, {user?.name || 'team member'}</span><h2>Ready to begin?</h2><p>Add project work or other work, then start the day. Your first timer begins automatically.</p></div>
          <div className="home-start-clock"><CalendarDays size={18}/><span><strong>{currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong><time>{currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</time></span></div>
          <button className="home-start-button" onClick={() => setStartModalOpen(true)}>Start my day <ArrowRight size={18}/></button>
          {!!startItems.length && <p className="home-start-empty">{startItems.length} unfinished item{startItems.length === 1 ? '' : 's'} will carry forward automatically.</p>}

          {startModalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setStartModalOpen(false); }}>
            <div className="modal-container modal-lg" role="dialog" aria-modal="true" aria-labelledby="start-day-title">
              <div className="modal-header"><div><div className="modal-title" id="start-day-title">Start my day</div><p className="modal-subtitle">Build a realistic list. Assigned projects and Other work use the same daily timer.</p></div><button className="icon-btn" aria-label="Close" disabled={saving} onClick={() => setStartModalOpen(false)}><X size={18}/></button></div>
              <div className="modal-body start-work-form">
                {error && <p className="start-work-error" role="alert">{error}</p>}
                {!!startItems.length && <div className="start-work-list">{startItems.map((item) => <article key={item.key}><span><small>{item.projectId ? startProjects.find((project) => project.id === item.projectId)?.name || 'Assigned project' : 'Other work'}{item.source === 'CARRYOVER' ? ' · Backlog carried forward' : ''}</small><strong>{item.title}</strong><p>{item.plannedOutcome}</p></span><b>{formatWorkedTime(item.plannedEstimateMinutes)}</b>{item.source !== 'CARRYOVER' && <button aria-label={`Remove ${item.title}`} onClick={() => setStartItems((current) => current.filter((candidate) => candidate.key !== item.key))}><X size={14}/></button>}</article>)}</div>}
                <div className="start-work-entry">
                  <label><span>Project or other</span><select autoFocus value={selectedProjectId} onChange={(event) => { setSelectedProjectId(event.target.value); setSelectedTaskId(''); setWorkTitle(''); }}><option value="">Choose</option>{startProjects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}<option value="OTHER">Other work (not linked to a project)</option></select></label>
                  {selectedProjectId && selectedProjectId !== 'OTHER' && <label><span>Assigned task or new work</span><select value={selectedTaskId} onChange={(event) => { setSelectedTaskId(event.target.value); const task = tasks.find((candidate) => candidate._id === event.target.value); setWorkTitle(task?.title || ''); setPlannedOutcome(''); }}><option value="">Choose</option>{startTasks.map((task) => <option value={task._id} key={task._id}>{task.title}</option>)}<option value="CUSTOM">Write new work for this project</option></select></label>}
                  {(selectedProjectId === 'OTHER' || selectedTaskId === 'CUSTOM') && <label><span>Work title</span><input value={workTitle} maxLength={180} onChange={(event) => setWorkTitle(event.target.value)} placeholder="What are you working on?"/></label>}
                  <label className="start-work-outcome"><span>Work details <b>required</b></span><textarea value={plannedOutcome} maxLength={500} onChange={(event) => setPlannedOutcome(event.target.value)} placeholder="Write exactly what you will do and what result you expect. This cannot be left empty."/></label>
                  <label><span>Planned time</span><select value={selectedMinutes} onChange={(event) => setSelectedMinutes(Number(event.target.value))}>{[[30,'30 minutes'],[45,'45 minutes'],[60,'1 hour'],[90,'1 hour 30 minutes'],[120,'2 hours'],[180,'3 hours'],[240,'4 hours']].map(([minutes, label]) => <option value={minutes} key={minutes}>{label}</option>)}</select></label>
                  <button className="btn btn-secondary start-work-add" disabled={!selectedProjectId || (!workTitle.trim() && !tasks.some((task) => task._id === selectedTaskId)) || plannedOutcome.trim().length < 3} onClick={addStartItem}>Add work</button>
                </div>
              </div>
              <div className="modal-footer"><span className="start-work-count">{startItems.length} item{startItems.length === 1 ? '' : 's'} planned</span><button className="btn btn-ghost" disabled={saving} onClick={() => setStartModalOpen(false)}>Cancel</button><button className="btn btn-primary" disabled={saving || !startItems.length} onClick={startSelectedWork}>{saving ? 'Starting…' : 'Start my day'}<Play size={14}/></button></div>
            </div>
          </div>}
        </section>
      ) : workday.status === 'Completed' ? (
        <section className="day-closed" id="plan-my-day">
          <div className="closed-mark"><CheckCircle2 size={28} /></div><span>Day closed</span><h2>The loop is complete.</h2><p>Your work is visible, your blockers are recorded, and tomorrow can start clean.</p>
          <div className="closed-time-worked"><Timer size={18}/><span><small>Total time worked</small><strong>{formatWorkedTime(trackedMinutes)}</strong></span></div>
          <div className="closed-focus"><small>Today’s focus</small><strong>{workday.focus}</strong></div>
          <div className="closed-outcomes">{workday.items.map((item) => <div key={item._id}><span className={`outcome-dot ${statusClass(item.status)}`}><Check size={11} /></span><div><strong>{item.title}</strong><small>{item.project?.name} · {item.status}</small></div></div>)}</div>
          <div className="closed-notes"><div><small>Completed</small><p>{workday.completedSummary}</p></div>{workday.blockers && <div className="blocked"><small>Blockers</small><p>{workday.blockers}</p></div>}{workday.remarks && <div><small>Remarks</small><p>{workday.remarks}</p></div>}</div>
        </section>
      ) : (
        <section className="active-day" id="plan-my-day">
          <div className="active-focus"><div><span className="live-indicator"><i /> Workday open</span><h2>{workday.focus}</h2><p>Started {new Date(workday.checkInAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · Productive time is the sum of focused task sessions, not the span between login and logout.</p></div><div className="active-time-card"><Timer size={20}/><span><small>Focused / planned</small><strong>{formatWorkedTime(trackedMinutes)} <i>/ {formatWorkedTime(plannedMinutes)}</i></strong><em>{timeSummary?.activeSession ? timeSummary.activeSession.taskId ? `Tracking ${workday.items.find((item) => item.taskId === timeSummary.activeSession?.taskId)?.title || 'active task'}` : `Tracking ${timeSummary.activeSession.note || 'other work'}` : 'Timer paused'}</em></span></div></div>
          <div className="active-outcomes"><div className="section-heading"><div><span>Today’s outcomes</span><h2>Move the work, then move the status.</h2></div><b>{workday.items.filter((item) => itemDrafts[item._id]?.status === 'Completed').length}/{workday.items.length} done</b></div>
            {workday.items.map((item, index) => {
              const draft = itemDrafts[item._id];
              if (!draft) return null;
              const needsReason = draft.endState === 'BACKLOG' || ((item.carryoverCount || 0) >= 2 && draft.endState === 'CARRY_OVER');
              return <article className={`active-outcome ${statusClass(draft.status)}`} key={item._id}>
                <div className="active-outcome-head">
                  <span className="outcome-number">{index + 1}</span>
                  <div><small>{item.project?.name}</small><h3>{item.title}</h3><p>{item.plannedOutcome}</p></div>
                  <select aria-label={`Status for ${item.title}`} value={draft.status} onChange={(event) => setItemDrafts((current) => ({ ...current, [item._id]: { ...draft, status: event.target.value as WorkdayItemStatus, endState: event.target.value === 'Completed' ? 'DONE' : event.target.value === 'Blocked' ? 'BLOCKED' : draft.endState === 'DONE' ? 'CARRY_OVER' : draft.endState } }))}>
                    <option>Planned</option><option>In Progress</option><option>Completed</option><option>Blocked</option><option>Deferred</option>
                  </select>
                </div>
                {item.taskId && <div className={`outcome-timer ${timeSummary?.activeSession?.taskId === item.taskId ? 'is-active' : ''}`}><div><Timer size={14}/><span><strong>{formatWorkedTime(trackedForTask(item.taskId))} / {formatWorkedTime(item.plannedEstimateMinutes || 60)}</strong>{timeSummary?.activeSession?.taskId === item.taskId ? ' · recording focused time' : ' · task timer paused'}</span></div>{timeSummary?.activeSession?.taskId === item.taskId ? <button className="btn btn-secondary" disabled={saving} onClick={pauseTaskTimer}><Pause size={13}/> Pause timer</button> : <button className="btn btn-secondary" disabled={saving || draft.status === 'Completed'} onClick={() => startTaskTimer(item)}><Play size={13}/> Start task</button>}</div>}
                {!item.taskId && <div className={`outcome-timer ${timeSummary?.activeSession && !timeSummary.activeSession.taskId && timeSummary.activeSession.note === item.title ? 'is-active' : ''}`}><div><Timer size={14}/><span><strong>{formatWorkedTime(trackedForOther(item.title))} / {formatWorkedTime(item.plannedEstimateMinutes || 60)}</strong>{timeSummary?.activeSession && !timeSummary.activeSession.taskId && timeSummary.activeSession.note === item.title ? ' · recording other work' : ' · timer paused'}</span></div>{timeSummary?.activeSession && !timeSummary.activeSession.taskId && timeSummary.activeSession.note === item.title ? <button className="btn btn-secondary" disabled={saving} onClick={pauseTaskTimer}><Pause size={13}/> Pause timer</button> : <button className="btn btn-secondary" disabled={saving || draft.status === 'Completed'} onClick={() => startOtherTimer(item)}><Play size={13}/> Start work</button>}</div>}
                <div className="outcome-update">
                  <label><span>Progress note <small>optional</small></span><textarea value={draft.progressNote} onChange={(event) => setItemDrafts((current) => ({ ...current, [item._id]: { ...draft, progressNote: event.target.value } }))} placeholder="What changed since you started?" /></label>
                  {draft.status === 'Blocked' && <label className="blocker-field"><span>What is blocking this? <b>required</b></span><textarea value={draft.blockerReason} onChange={(event) => setItemDrafts((current) => ({ ...current, [item._id]: { ...draft, blockerReason: event.target.value, endState: 'BLOCKED' } }))} placeholder="Name the dependency or decision needed." /></label>}
                  {draft.status !== 'Completed' && <label><span>At close, move to</span><select value={draft.endState} onChange={(event) => setItemDrafts((current) => ({ ...current, [item._id]: { ...draft, endState: event.target.value as EndState } }))}><option value="CARRY_OVER">Carry over</option><option value="RESCHEDULED">Reschedule</option><option value="BACKLOG">Return to backlog</option><option value="BLOCKED">Blocked</option><option value="NO_LONGER_REQUIRED">No longer required</option></select></label>}
                  {needsReason && <label><span>Reason <b>required</b></span><textarea value={draft.carryoverReason} onChange={(event) => setItemDrafts((current) => ({ ...current, [item._id]: { ...draft, carryoverReason: event.target.value } }))} placeholder="What changed, and what should happen next?" /></label>}
                  <button className="btn btn-secondary" disabled={saving} onClick={() => saveItem(item._id)}><Save size={14} /> Save update</button>
                </div>
              </article>;
            })}
          </div>

          <aside className="close-day-panel" id="close-day"><div className="close-day-title"><div className="close-icon"><Clock3 size={18} /></div><div><span>End-of-day closeout</span><p>Capture facts, not a long report.</p></div></div><div className="close-day-time"><Timer size={17}/><span><small>Productive time today</small><strong>{formatWorkedTime(trackedMinutes)} <em>of {formatWorkedTime(plannedMinutes)} planned</em></strong></span></div><label><span>What did you complete? <b>required</b></span><textarea value={completedSummary} onChange={(event) => setCompletedSummary(event.target.value)} placeholder="Shipped the review build and resolved the login edge case." /></label><label><span>Blockers or decisions needed</span><textarea value={dayBlockers} onChange={(event) => setDayBlockers(event.target.value)} placeholder="Nothing blocked, or name who can unblock you." /></label><label><span>Other remarks</span><textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Useful context for tomorrow…" /></label><div className="close-day-note"><RotateCcw size={14} /><span>Ending the day stops the active timer. Unfinished work returns automatically tomorrow as backlog.</span></div><button className="btn btn-primary" disabled={saving || !completedSummary.trim()} onClick={finishDay}>{saving ? 'Ending…' : 'End my day'}<CheckCircle2 size={15} /></button></aside>
        </section>
      )}
      {view === 'my-day' && <section className="work-history" id="work-history">
        <header><div><CalendarDays size={17}/><span><strong>Work history</strong><small>Completed days and backlog are read-only</small></span></div><input aria-label="History month" type="month" max={dateKey().slice(0, 7)} value={historyMonth} onChange={(event) => { setHistoryMonth(event.target.value); setSelectedHistory(null); }}/></header>
        <div className="history-weekdays">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="history-calendar">{historyCells.map((cell, index) => cell ? <button key={`${cell.day}-${index}`} className={cell.record ? statusClass(cell.record.status) : ''} disabled={!cell.record} onClick={() => setSelectedHistory(cell.record)}><b>{cell.day}</b>{cell.record && <><i/><small>{cell.record.items.filter((item) => item.status === 'Completed').length}/{cell.record.items.length} done</small></>}</button> : <span key={`blank-${index}`}/>)}</div>
        {selectedHistory && <div className="history-detail"><header><span><strong>{new Date(`${selectedHistory.workDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</strong><small>{selectedHistory.status} · {formatWorkedTime(selectedHistory.productiveMinutes || 0)} recorded</small></span><button aria-label="Close history detail" onClick={() => setSelectedHistory(null)}><X size={14}/></button></header>{selectedHistory.items.map((item) => <article key={item._id}><span><small>{item.project?.name || 'Other work'}{item.status !== 'Completed' ? ' · Backlog' : ''}</small><strong>{item.title}</strong><p>{item.plannedOutcome}</p></span><b className={statusClass(item.status)}>{item.status}</b></article>)}</div>}
      </section>}
    </main>
  );
};

export { Workday as LegacyWorkday };
export default DailyWorkday;
