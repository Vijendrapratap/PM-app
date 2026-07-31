import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle, ArrowRight, CalendarDays, Check, CheckCircle2, CircleDot,
  Clock3, Flag, Layers3, LockKeyhole, Plus, RotateCcw,
  Save, Sparkles, Target, Users, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { projectApi } from '../api/projectApi';
import { projectTaskApi, type AssignedProjectTask } from '../api/projectTaskApi';
import { workdayApi, type TeamPulseEntry, type Workday as WorkdayRecord, type WorkdayItemStatus } from '../api/workdayApi';
import type { Project } from '../types';
import { getErrorMessage } from '../utils/errorMessage';

type DraftItem = { key: string; projectId: string; taskId?: string; title: string; plannedOutcome: string };
type ItemDraft = { status: WorkdayItemStatus; progressNote: string; blockerReason: string };
type View = 'my-day' | 'team';

const dateKey = () => {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};
const canSeeTeam = (role?: string) => role === 'Super Admin' || role === 'Project Manager';
const statusClass = (status: string) => status.toLowerCase().replace(/\s+/g, '-');

const Workday = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<View>(searchParams.get('view') === 'team' && canSeeTeam(user?.role) ? 'team' : 'my-day');
  const [workday, setWorkday] = useState<WorkdayRecord | null>(null);
  const [tasks, setTasks] = useState<AssignedProjectTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [focus, setFocus] = useState('');
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [customProject, setCustomProject] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [itemDrafts, setItemDrafts] = useState<Record<string, ItemDraft>>({});
  const [completedSummary, setCompletedSummary] = useState('');
  const [dayBlockers, setDayBlockers] = useState('');
  const [remarks, setRemarks] = useState('');
  const [teamDate, setTeamDate] = useState(dateKey());
  const [team, setTeam] = useState<TeamPulseEntry[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);

  useEffect(() => {
    setView(searchParams.get('view') === 'team' && canSeeTeam(user?.role) ? 'team' : 'my-day');
  }, [searchParams, user?.role]);

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
    }])));
    setCompletedSummary(record.completedSummary || '');
    setDayBlockers(record.blockers || '');
    setRemarks(record.remarks || '');
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [today, assigned, allProjects] = await Promise.all([
          workdayApi.today(), projectTaskApi.assignedToMe(), projectApi.list(),
        ]);
        setWorkday(today);
        hydrateDrafts(today);
        setTasks(assigned.filter((task) => task.status !== 'Completed'));
        setProjects(allProjects.filter((project) =>
          !project.archived && project.status !== 'Completed' &&
          (user?.role === 'Super Admin' || project.assignedMembers.some((member) => member._id === user?._id))
        ));
      } catch (loadError) {
        setError(getErrorMessage(loadError, 'We could not load today’s workday.'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [hydrateDrafts, user]);

  useEffect(() => {
    if (view !== 'team' || !canSeeTeam(user?.role)) return;
    setTeamLoading(true);
    workdayApi.team(teamDate)
      .then(setTeam)
      .catch((teamError) => setError(getErrorMessage(teamError, 'We could not load the team pulse.')))
      .finally(() => setTeamLoading(false));
  }, [teamDate, user?.role, view]);

  const selectedTaskIds = useMemo(() => new Set(draftItems.map((item) => item.taskId).filter(Boolean)), [draftItems]);
  const assignedProjects = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((task) => task.project && map.set(task.project._id, task.project.name));
    projects.forEach((project) => map.set(project._id, project.name));
    return [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, tasks]);

  const addTask = (task: AssignedProjectTask) => {
    if (!task.project || draftItems.length >= 3 || selectedTaskIds.has(task._id)) return;
    setDraftItems((current) => [...current, {
      key: task._id, projectId: task.projectId, taskId: task._id, title: task.title, plannedOutcome: task.title,
    }]);
  };

  const addCustomOutcome = () => {
    if (!customProject || !customTitle.trim() || draftItems.length >= 3) return;
    setDraftItems((current) => [...current, {
      key: `custom-${Date.now()}`, projectId: customProject, title: customTitle.trim(), plannedOutcome: customTitle.trim(),
    }]);
    setCustomTitle('');
  };

  const startDay = async () => {
    if (!focus.trim() || !draftItems.length || draftItems.some((item) => !item.plannedOutcome.trim())) return;
    try {
      setSaving(true); setError('');
      const record = await workdayApi.start({
        focus: focus.trim(),
        items: draftItems.map(({ projectId, taskId, title, plannedOutcome }) => ({ projectId, taskId, title, plannedOutcome })),
      });
      setWorkday(record); hydrateDrafts(record);
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'We could not start your workday.'));
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
      setWorkday(record); hydrateDrafts(record);
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

  if (loading) return <div className="workday-shell"><div className="workday-skeleton skeleton" /><div className="workday-skeleton skeleton" /></div>;

  return (
    <main className="workday-shell animate-fade-in">
      <header className="workday-header">
        <div>
          <div className="eyebrow"><CircleDot size={13} /> Daily operating rhythm</div>
          <h1>{view === 'team' ? 'Team pulse' : 'Today, with intention'}</h1>
          <p>{view === 'team' ? 'See commitments, progress and blockers without another status meeting.' : 'Choose a small number of outcomes, make progress visible, then close the loop.'}</p>
        </div>
        <div className="workday-date"><CalendarDays size={16} /><span>{new Date(`${teamDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })}</span></div>
      </header>

      {canSeeTeam(user?.role) && <div className="workday-tabs" role="tablist">
        <button role="tab" aria-selected={view === 'my-day'} className={view === 'my-day' ? 'active' : ''} onClick={() => changeView('my-day')}><Target size={15} /> My day</button>
        <button role="tab" aria-selected={view === 'team'} className={view === 'team' ? 'active' : ''} onClick={() => changeView('team')}><Users size={15} /> Team pulse</button>
      </div>}

      {error && <div className="workday-error" role="alert"><AlertCircle size={16} /><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={14} /></button></div>}
      {searchParams.get('closeout') === '1' && view === 'my-day' && workday?.status === 'Open' && (
        <div className="closeout-nudge"><LockKeyhole size={17} /><div><strong>Close the loop before signing out</strong><span>It takes about a minute and gives the team a clean handoff for tomorrow.</span></div></div>
      )}

      {view === 'team' ? (
        <section className="team-pulse">
          <div className="pulse-toolbar"><div className="pulse-stats"><span><i className="working" />{counts.working} working</span><span><i className="closed" />{counts.closed} closed</span><span><i />{counts.notStarted} not started</span><span className={counts.blocked ? 'has-blockers' : ''}><Flag size={13} />{counts.blocked} blocked</span></div><label>Date<input type="date" value={teamDate} max={dateKey()} onChange={(event) => setTeamDate(event.target.value)} /></label></div>
          {teamLoading ? <div className="pulse-loading skeleton" /> : (
            <div className="pulse-list">
              {team.map((entry) => <article className="pulse-person" key={entry.user._id}>
                <div className="pulse-person-head"><div className="pulse-avatar">{entry.user.name.charAt(0)}</div><div className="pulse-identity"><strong>{entry.user.name}</strong><span>{entry.user.department || entry.user.role}</span></div><span className={`work-state ${statusClass(entry.state)}`}>{entry.state}</span></div>
                {!entry.workday ? <p className="pulse-empty">No commitment recorded for this day.</p> : <>
                  <div className="pulse-focus"><Target size={13} /><span>{entry.workday.focus}</span></div>
                  <div className="pulse-outcomes">{entry.workday.items.map((item) => <div key={item._id}><span className={`outcome-dot ${statusClass(item.status)}`}><Check size={10} /></span><p><strong>{item.title}</strong><small>{item.project?.name || 'Project unavailable'} · {item.status}</small></p></div>)}</div>
                  {(entry.workday.blockers || entry.workday.items.some((item) => item.blockerReason)) && <div className="pulse-blocker"><Flag size={13} /><span>{entry.workday.blockers || entry.workday.items.find((item) => item.blockerReason)?.blockerReason}</span></div>}
                  {entry.workday.completedSummary && <p className="pulse-summary"><CheckCircle2 size={13} />{entry.workday.completedSummary}</p>}
                </>}
              </article>)}
            </div>
          )}
        </section>
      ) : !workday ? (
        <section className="start-day-layout">
          <div className="start-day-main">
            <div className="workday-step"><span>01</span><div><h2>Set the finish line</h2><p>One sentence that keeps the day pointed in the right direction.</p></div></div>
            <label className="focus-field"><span>Today will be successful if…</span><textarea value={focus} maxLength={240} onChange={(event) => setFocus(event.target.value)} placeholder="The client can review the new onboarding flow." /></label>

            <div className="workday-step outcomes-step"><span>02</span><div><h2>Commit to 1–3 outcomes</h2><p>Keep the list deliberately small. Finished work beats a crowded plan.</p></div><b>{draftItems.length}/3</b></div>
            <div className="selected-outcomes">
              {draftItems.map((item, index) => <article key={item.key}><span className="outcome-number">{index + 1}</span><div><small>{assignedProjects.find((project) => project.id === item.projectId)?.name}</small><strong>{item.title}</strong><textarea aria-label={`Expected outcome for ${item.title}`} value={item.plannedOutcome} onChange={(event) => setDraftItems((current) => current.map((draft) => draft.key === item.key ? { ...draft, plannedOutcome: event.target.value } : draft))} /></div><button aria-label={`Remove ${item.title}`} onClick={() => setDraftItems((current) => current.filter((draft) => draft.key !== item.key))}><X size={15} /></button></article>)}
              {!draftItems.length && <div className="outcome-empty"><Layers3 size={20} /><span>Select assigned work below or add a project outcome.</span></div>}
            </div>

            {draftItems.length < 3 && <div className="custom-outcome"><select aria-label="Project" value={customProject} onChange={(event) => setCustomProject(event.target.value)}><option value="">Choose project</option>{assignedProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><input value={customTitle} onChange={(event) => setCustomTitle(event.target.value)} placeholder="Add a project outcome…" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustomOutcome(); } }} /><button className="btn btn-secondary" disabled={!customProject || !customTitle.trim()} onClick={addCustomOutcome}><Plus size={14} /> Add</button></div>}
          </div>

          <aside className="assigned-work-panel"><div><h2>Assigned work</h2><span>{tasks.length} open tasks</span></div>{tasks.length ? <div className="assigned-task-list">{tasks.map((task) => <button key={task._id} disabled={!task.project || selectedTaskIds.has(task._id) || draftItems.length >= 3} onClick={() => addTask(task)}><span><small>{task.project?.name}</small><strong>{task.title}</strong></span>{selectedTaskIds.has(task._id) ? <Check size={15} /> : <Plus size={15} />}</button>)}</div> : <p className="assigned-empty">No open tasks are assigned to you. Add a project outcome instead.</p>}</aside>

          <div className="start-day-action"><div><Sparkles size={16} /><span><strong>A clear day has a boundary.</strong> Three outcomes is the maximum, not the target.</span></div><button className="btn btn-primary" disabled={saving || !focus.trim() || !draftItems.length || draftItems.some((item) => !item.plannedOutcome.trim())} onClick={startDay}>{saving ? 'Starting…' : 'Start my day'}<ArrowRight size={15} /></button></div>
        </section>
      ) : workday.status === 'Completed' ? (
        <section className="day-closed">
          <div className="closed-mark"><CheckCircle2 size={28} /></div><span>Day closed</span><h2>The loop is complete.</h2><p>Your work is visible, your blockers are recorded, and tomorrow can start clean.</p>
          <div className="closed-focus"><small>Today’s focus</small><strong>{workday.focus}</strong></div>
          <div className="closed-outcomes">{workday.items.map((item) => <div key={item._id}><span className={`outcome-dot ${statusClass(item.status)}`}><Check size={11} /></span><div><strong>{item.title}</strong><small>{item.project?.name} · {item.status}</small></div></div>)}</div>
          <div className="closed-notes"><div><small>Completed</small><p>{workday.completedSummary}</p></div>{workday.blockers && <div className="blocked"><small>Blockers</small><p>{workday.blockers}</p></div>}{workday.remarks && <div><small>Remarks</small><p>{workday.remarks}</p></div>}</div>
        </section>
      ) : (
        <section className="active-day">
          <div className="active-focus"><div><span className="live-indicator"><i /> Workday open</span><h2>{workday.focus}</h2><p>Started {new Date(workday.checkInAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · Update only when the state changes.</p></div><Target size={28} /></div>
          <div className="active-outcomes"><div className="section-heading"><div><span>Today’s outcomes</span><h2>Move the work, then move the status.</h2></div><b>{workday.items.filter((item) => itemDrafts[item._id]?.status === 'Completed').length}/{workday.items.length} done</b></div>
            {workday.items.map((item, index) => { const draft = itemDrafts[item._id]; if (!draft) return null; return <article className={`active-outcome ${statusClass(draft.status)}`} key={item._id}><div className="active-outcome-head"><span className="outcome-number">{index + 1}</span><div><small>{item.project?.name}</small><h3>{item.title}</h3><p>{item.plannedOutcome}</p></div><select aria-label={`Status for ${item.title}`} value={draft.status} onChange={(event) => setItemDrafts((current) => ({ ...current, [item._id]: { ...draft, status: event.target.value as WorkdayItemStatus } }))}><option>Planned</option><option>In Progress</option><option>Completed</option><option>Blocked</option><option>Deferred</option></select></div><div className="outcome-update"><label><span>Progress note <small>optional</small></span><textarea value={draft.progressNote} onChange={(event) => setItemDrafts((current) => ({ ...current, [item._id]: { ...draft, progressNote: event.target.value } }))} placeholder="What changed since you started?" /></label>{draft.status === 'Blocked' && <label className="blocker-field"><span>What is blocking this? <b>required</b></span><textarea value={draft.blockerReason} onChange={(event) => setItemDrafts((current) => ({ ...current, [item._id]: { ...draft, blockerReason: event.target.value } }))} placeholder="Name the dependency or decision needed." /></label>}<button className="btn btn-secondary" disabled={saving} onClick={() => saveItem(item._id)}><Save size={14} /> Save update</button></div></article>; })}
          </div>

          <aside className="close-day-panel" id="close-day"><div className="close-day-title"><div className="close-icon"><Clock3 size={18} /></div><div><span>End-of-day closeout</span><p>Capture facts, not a long report.</p></div></div><label><span>What did you complete? <b>required</b></span><textarea value={completedSummary} onChange={(event) => setCompletedSummary(event.target.value)} placeholder="Shipped the review build and resolved the login edge case." /></label><label><span>Blockers or decisions needed</span><textarea value={dayBlockers} onChange={(event) => setDayBlockers(event.target.value)} placeholder="Nothing blocked, or name who can unblock you." /></label><label><span>Other remarks</span><textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Useful context for tomorrow…" /></label><div className="close-day-note"><RotateCcw size={14} /><span>Unfinished outcomes stay visible as planned or deferred. No need to pretend everything is done.</span></div><button className="btn btn-primary" disabled={saving || !completedSummary.trim()} onClick={finishDay}>{saving ? 'Closing…' : 'Close my workday'}<CheckCircle2 size={15} /></button></aside>
        </section>
      )}
    </main>
  );
};

export default Workday;
