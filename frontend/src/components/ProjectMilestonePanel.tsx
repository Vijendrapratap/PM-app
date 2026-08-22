import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, CircleDot, Flag, Layers3, ListChecks, Pencil, Plus, Save, UserRound, X } from 'lucide-react';
import { hierarchyApi, type Deliverable, type Milestone } from '../api/hierarchyApi';
import { projectTaskApi, type ProjectTask } from '../api/projectTaskApi';
import type { Member, Priority } from '../types';
import { getErrorMessage } from '../utils/errorMessage';
import TaskDetailPanel from './TaskDetailPanel';

type TaskDraft = { titles: string; assignedTo: string; dueDate: string; priority: Priority; expectedMinutes: number };
type EditTarget = { type: 'milestone' | 'feature'; id: string; name: string } | null;

const statusLabel = (value: string) => value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
const taskDone = (task: ProjectTask) => task.status === 'Completed' || task.canonicalStatus === 'DONE';
const progressOf = (tasks: ProjectTask[]) => tasks.length ? Math.round(tasks.filter(taskDone).length / tasks.length * 100) : 0;

const ProjectMilestonePanel = ({
  projectId,
  canManage,
  canAddMilestone = canManage,
  compact = false,
  members = [],
  currentUserId,
  refreshSignal = 0,
  onTasksChanged,
}: {
  projectId: string;
  canManage: boolean;
  canAddMilestone?: boolean;
  compact?: boolean;
  members?: Member[];
  currentUserId?: string;
  refreshSignal?: number;
  onTasksChanged?: () => void;
}) => {
  const [items, setItems] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [name, setName] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [featureDraft, setFeatureDraft] = useState<Record<string, string>>({});
  const [taskDraft, setTaskDraft] = useState<Record<string, TaskDraft>>({});
  const [addingTaskTo, setAddingTaskTo] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [milestones, projectTasks] = await Promise.all([hierarchyApi.list(projectId), projectTaskApi.list(projectId)]);
      setItems(milestones);
      setTasks(projectTasks);
      setSelectedMilestoneId((current) => milestones.some((milestone) => milestone.id === current) ? current : milestones[0]?.id || '');
    } catch (reason) {
      setError(getErrorMessage(reason, 'The delivery breakdown could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load, refreshSignal]);

  const unplannedTasks = useMemo(() => tasks.filter((task) => !task.milestoneId && !task.deliverableId), [tasks]);
  const activeMilestone = items.find((milestone) => milestone.id === selectedMilestoneId) || items[0] || null;
  const selectedTask = tasks.find((task) => task._id === selectedTaskId) || null;

  const addMilestone = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true); setError('');
    try {
      const created = await hierarchyApi.createMilestone(projectId, { name: name.trim(), targetDate: targetDate || undefined, sequence: items.length });
      setName(''); setTargetDate(''); setShowMilestoneForm(false); setSelectedMilestoneId(created.id);
      await load();
    } catch (reason) { setError(getErrorMessage(reason, 'The milestone could not be created.')); }
    finally { setSaving(false); }
  };

  const addFeature = async (milestoneId: string) => {
    const title = featureDraft[milestoneId]?.trim();
    if (!title) return;
    setSaving(true); setError('');
    try {
      await hierarchyApi.createDeliverable(milestoneId, { name: title });
      setFeatureDraft((current) => ({ ...current, [milestoneId]: '' }));
      await load();
    } catch (reason) { setError(getErrorMessage(reason, 'The feature could not be created.')); }
    finally { setSaving(false); }
  };

  const addTask = async (milestone: Milestone, feature: Deliverable) => {
    const draft = taskDraft[feature.id] || { titles: '', assignedTo: '', dueDate: '', priority: 'Medium' as Priority, expectedMinutes: 60 };
    const titles = draft.titles.split('\n').map((title) => title.trim()).filter(Boolean);
    if (!titles.length) return;
    setSaving(true); setError('');
    try {
      for (const title of titles) {
        await projectTaskApi.create(projectId, { title, assignedTo: draft.assignedTo || undefined, dueDate: draft.dueDate || undefined, priority: draft.priority, expectedMinutes: draft.expectedMinutes, milestoneId: milestone.id, deliverableId: feature.id });
      }
      setTaskDraft((current) => ({ ...current, [feature.id]: { titles: '', assignedTo: '', dueDate: '', priority: 'Medium', expectedMinutes: 60 } }));
      setAddingTaskTo(null);
      await load();
      onTasksChanged?.();
    } catch (reason) { setError(getErrorMessage(reason, 'The tasks could not be added to this feature.')); }
    finally { setSaving(false); }
  };

  const updateMilestoneStatus = async (milestone: Milestone, status: Milestone['status']) => {
    setError('');
    try { await hierarchyApi.updateMilestone(milestone.id, { status }); await load(); }
    catch (reason) { setError(getErrorMessage(reason, 'The milestone status could not be updated.')); }
  };

  const updateFeatureStatus = async (feature: Deliverable, status: Deliverable['status']) => {
    setError('');
    try { await hierarchyApi.updateDeliverable(feature.id, { status }); await load(); }
    catch (reason) { setError(getErrorMessage(reason, 'The feature status could not be updated.')); }
  };

  const saveName = async () => {
    if (!editTarget?.name.trim()) return;
    setSaving(true); setError('');
    try {
      if (editTarget.type === 'milestone') await hierarchyApi.updateMilestone(editTarget.id, { name: editTarget.name.trim() });
      else await hierarchyApi.updateDeliverable(editTarget.id, { name: editTarget.name.trim() });
      setEditTarget(null);
      await load();
    } catch (reason) { setError(getErrorMessage(reason, 'The name could not be updated.')); }
    finally { setSaving(false); }
  };

  const toggleTask = async (task: ProjectTask) => {
    if (!(canManage || task.assignedTo?._id === currentUserId) || task.blocked) return;
    setError('');
    try {
      if (taskDone(task)) await projectTaskApi.update(projectId, task._id, { status: 'Pending' });
      else await projectTaskApi.complete(task._id);
      await load();
      onTasksChanged?.();
    }
    catch (reason) { setError(getErrorMessage(reason, 'The task status could not be updated.')); }
  };

  const refreshTask = async () => {
    await load();
    onTasksChanged?.();
  };

  return <section className={`section-card delivery-map ${compact ? 'compact' : ''}`}>
    <header className="delivery-map-header">
      <div><span className="delivery-map-icon"><Flag size={17}/></span><span><strong>Milestones</strong></span></div>
      {canAddMilestone && <button className="btn btn-secondary" onClick={() => setShowMilestoneForm((current) => !current)}><Plus size={14}/>Add milestone</button>}
    </header>

    {error && <div className="delivery-map-error" role="alert"><CircleDot size={14}/><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><X size={13}/></button></div>}
    {showMilestoneForm && canAddMilestone && <form className="delivery-milestone-form" onSubmit={addMilestone}><label><span>Milestone</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Milestone name"/></label><label><span>Date</span><input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)}/></label><button className="btn btn-primary" disabled={saving || !name.trim()}>{saving ? 'Adding…' : 'Add'}</button><button type="button" className="btn btn-ghost" onClick={() => setShowMilestoneForm(false)}>Cancel</button></form>}

    {loading ? <div className="delivery-map-loading"><div className="skeleton"/><div className="skeleton"/></div> : !items.length ? <div className="delivery-map-empty"><Flag size={22}/><strong>No milestones yet</strong>{canAddMilestone && <button className="btn btn-primary" onClick={() => setShowMilestoneForm(true)}><Plus size={14}/>Add milestone</button>}</div> : <>
      <nav className="delivery-stage-nav" aria-label="Project milestones">
        {items.map((milestone, milestoneIndex) => {
          const milestoneTasks = tasks.filter((task) => task.milestoneId === milestone.id);
          const active = activeMilestone?.id === milestone.id;
          return <button type="button" className={`${active ? 'active' : ''} ${milestone.status === 'COMPLETED' ? 'done' : ''}`} onClick={() => setSelectedMilestoneId(milestone.id)} key={milestone.id}>
            <span className="delivery-stage-number">{milestone.status === 'COMPLETED' ? <Check size={13}/> : milestoneIndex + 1}</span>
            <span className="delivery-stage-copy"><small>Milestone {milestoneIndex + 1}</small><strong>{milestone.name}</strong><em>{milestone.deliverables?.length || 0} features · {milestoneTasks.length} tasks</em></span>
            <span className="delivery-stage-progress"><i style={{ width: `${progressOf(milestoneTasks)}%` }}/></span>
            <b>{progressOf(milestoneTasks)}%</b>
          </button>;
        })}
      </nav>

      {activeMilestone && <article className="delivery-milestone-focus">
        <header>
          <span className="delivery-sequence">{items.findIndex((item) => item.id === activeMilestone.id) + 1}</span>
          <div className="delivery-title">{editTarget?.type === 'milestone' && editTarget.id === activeMilestone.id ? <div className="delivery-inline-edit"><input autoFocus value={editTarget.name} onChange={(event) => setEditTarget({ ...editTarget, name: event.target.value })}/><button onClick={saveName} disabled={saving}><Save size={13}/></button><button onClick={() => setEditTarget(null)}><X size={13}/></button></div> : <><small>Selected milestone</small><strong>{activeMilestone.name}</strong></>}</div>
          <div className="delivery-focus-meta"><span>{activeMilestone.deliverables?.length || 0} features</span><span>{tasks.filter((task) => task.milestoneId === activeMilestone.id).length} tasks</span>{activeMilestone.target_date && <time><CalendarDays size={12}/>{new Date(`${activeMilestone.target_date}T12:00:00`).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}</time>}</div>
          {canManage && <div className="delivery-focus-actions"><select aria-label={`${activeMilestone.name} status`} value={activeMilestone.status} onChange={(event) => updateMilestoneStatus(activeMilestone, event.target.value as Milestone['status'])}>{['PLANNED','ACTIVE','COMPLETED','ON_HOLD','CANCELLED'].map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select><button className="delivery-edit" aria-label={`Rename ${activeMilestone.name}`} onClick={() => setEditTarget({ type: 'milestone', id: activeMilestone.id, name: activeMilestone.name })}><Pencil size={13}/></button></div>}
        </header>

        <div className="delivery-features">
          {(activeMilestone.deliverables || []).map((feature) => {
            const featureTasks = tasks.filter((task) => task.deliverableId === feature.id);
            const draft = taskDraft[feature.id] || { titles: '', assignedTo: '', dueDate: '', priority: 'Medium' as Priority, expectedMinutes: 60 };
            const taskCount = draft.titles.split('\n').map((title) => title.trim()).filter(Boolean).length;
            return <section className={`delivery-feature ${feature.status === 'COMPLETED' ? 'done' : ''}`} key={feature.id}>
              <header><span className="delivery-feature-icon"><Layers3 size={14}/></span><div>{editTarget?.type === 'feature' && editTarget.id === feature.id ? <div className="delivery-inline-edit"><input autoFocus value={editTarget.name} onChange={(event) => setEditTarget({ ...editTarget, name: event.target.value })}/><button onClick={saveName} disabled={saving}><Save size={13}/></button><button onClick={() => setEditTarget(null)}><X size={13}/></button></div> : <><small>Feature</small><strong>{feature.name}</strong><em>{featureTasks.length} task{featureTasks.length === 1 ? '' : 's'} · {progressOf(featureTasks)}% complete</em></>}</div>{canManage && <><select aria-label={`${feature.name} status`} value={feature.status} onChange={(event) => updateFeatureStatus(feature, event.target.value as Deliverable['status'])}>{['PLANNED','ACTIVE','IN_REVIEW','COMPLETED','CANCELLED'].map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select><button className="delivery-edit" aria-label={`Rename ${feature.name}`} onClick={() => setEditTarget({ type: 'feature', id: feature.id, name: feature.name })}><Pencil size={12}/></button><button className="delivery-add-task" onClick={() => setAddingTaskTo(addingTaskTo === feature.id ? null : feature.id)}><Plus size={12}/>Add tasks</button></>}</header>
              <div className="delivery-task-list">{featureTasks.map((task) => <div className={`delivery-task-row ${taskDone(task) ? 'done' : ''}`} key={task._id}>
                <button type="button" className="delivery-task-check" aria-label={task.blocked ? `${task.title} must be unblocked before completion` : `${taskDone(task) ? 'Reopen' : 'Complete'} ${task.title}`} title={task.blocked ? 'Resolve the blocker before completing this task' : undefined} disabled={!(canManage || task.assignedTo?._id === currentUserId) || task.blocked} onClick={() => toggleTask(task)}>{taskDone(task) && <Check size={11}/>}</button>
                <button type="button" className="delivery-task-open" onClick={() => setSelectedTaskId(task._id)}><strong>{task.title}</strong><small>Open details, comments and updates</small></button>
                <em className={`task-state state-${(task.canonicalStatus || 'BACKLOG').toLowerCase()}`}>{statusLabel(task.canonicalStatus || task.status)}</em><span className="delivery-task-owner"><UserRound size={11}/>{task.assignedTo?.name || 'Unassigned'}</span>{task.dueDate && <time>{new Date(`${task.dueDate}T12:00:00`).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}</time>}
              </div>)}{!featureTasks.length && <p>No tasks in this feature yet.</p>}</div>
              {canManage && addingTaskTo === feature.id && <form className="delivery-task-form delivery-task-bulk-form" onSubmit={(event) => { event.preventDefault(); void addTask(activeMilestone, feature); }}>
                <label className="delivery-task-lines"><span>Tasks <small>one task per line</small></span><textarea autoFocus rows={Math.min(7, Math.max(3, taskCount + 1))} value={draft.titles} onChange={(event) => setTaskDraft((current) => ({ ...current, [feature.id]: { ...draft, titles: event.target.value } }))} placeholder={'Create sign-in screen\nConnect sign-in API\nTest password reset'}/></label>
                <div className="delivery-task-defaults"><label><span>Owner</span><select value={draft.assignedTo} onChange={(event) => setTaskDraft((current) => ({ ...current, [feature.id]: { ...draft, assignedTo: event.target.value } }))}><option value="">Assign later</option>{members.map((member) => <option value={member._id} key={member._id}>{member.name}</option>)}</select></label><label><span>Due date</span><input type="date" value={draft.dueDate} onChange={(event) => setTaskDraft((current) => ({ ...current, [feature.id]: { ...draft, dueDate: event.target.value } }))}/></label><label><span>Priority</span><select value={draft.priority} onChange={(event) => setTaskDraft((current) => ({ ...current, [feature.id]: { ...draft, priority: event.target.value as Priority } }))}>{['Low','Medium','High','Critical'].map((priority) => <option key={priority}>{priority}</option>)}</select></label><label><span>Estimate</span><select value={draft.expectedMinutes} onChange={(event) => setTaskDraft((current) => ({ ...current, [feature.id]: { ...draft, expectedMinutes: Number(event.target.value) } }))}>{[[30,'30m'],[60,'1h'],[90,'1.5h'],[120,'2h'],[180,'3h'],[240,'4h']].map(([minutes,label]) => <option value={minutes} key={minutes}>{label}</option>)}</select></label></div>
                <div className="delivery-task-bulk-actions"><small>{taskCount ? `${taskCount} task${taskCount === 1 ? '' : 's'} ready` : 'Paste or type a list to add tasks quickly.'}</small><button disabled={saving || !taskCount}>{saving ? 'Adding…' : `Add ${taskCount || ''} task${taskCount === 1 ? '' : 's'}`}</button></div>
              </form>}
            </section>;
          })}
          {!activeMilestone.deliverables?.length && <div className="delivery-feature-empty"><Layers3 size={16}/><span><strong>No features yet</strong><small>Add the first feature for this milestone, then enter its tasks in one list.</small></span></div>}
          {canManage && <div className="delivery-feature-form"><input value={featureDraft[activeMilestone.id] || ''} onChange={(event) => setFeatureDraft((current) => ({ ...current, [activeMilestone.id]: event.target.value }))} placeholder="Add a feature, such as User login or Sales pipeline" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void addFeature(activeMilestone.id); } }}/><button disabled={saving || !featureDraft[activeMilestone.id]?.trim()} onClick={() => addFeature(activeMilestone.id)}><Plus size={13}/>Add feature</button></div>}
        </div>
      </article>}
    </>}

    {unplannedTasks.length > 0 && <footer className="delivery-backlog-note"><ListChecks size={14}/><span><strong>{unplannedTasks.length} task{unplannedTasks.length === 1 ? '' : 's'} not linked to the structure</strong><small>Open a task and choose its milestone and feature to keep the project breakdown complete.</small></span></footer>}
    {selectedTask && <TaskDetailPanel projectId={projectId} task={selectedTask} members={members} canManage={canManage} currentUserId={currentUserId} onClose={() => setSelectedTaskId('')} onChange={refreshTask}/>}
  </section>;
};

export default ProjectMilestonePanel;
