import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckSquare, ChevronDown, ChevronRight, Plus, Trash2, Paperclip, Columns3, List } from 'lucide-react';
import { projectTaskApi, type ProjectTask, type ProjectTaskSubtask } from '../api/projectTaskApi';
import { getErrorMessage } from '../utils/errorMessage';
import type { Member, Priority, TaskStatus } from '../types';
import TaskDetailPanel from './TaskDetailPanel';

type CanonicalTaskStatus = NonNullable<ProjectTask['canonicalStatus']>;
const BOARD_COLUMNS: { status: CanonicalTaskStatus; label: string }[] = [
  { status: 'BACKLOG', label: 'Backlog' },
  { status: 'READY', label: 'Ready' },
  { status: 'IN_PROGRESS', label: 'In Progress' },
  { status: 'IN_REVIEW', label: 'Review' },
  { status: 'DONE', label: 'Done' },
];

const canonicalStatus = (task: ProjectTask): CanonicalTaskStatus => task.canonicalStatus || ({ Pending: 'BACKLOG', 'In Progress': 'IN_PROGRESS', 'In Review': 'IN_REVIEW', Completed: 'DONE', Blocked: 'IN_PROGRESS' } as Record<TaskStatus, CanonicalTaskStatus>)[task.status];

const PRIORITY_BADGE: Record<string, string> = {
  Low: 'badge-neutral',
  Medium: 'badge-info',
  High: 'badge-warning',
  Critical: 'badge-danger',
};

const SubtaskRow = ({
  projectId,
  task,
  subtask,
  canManage,
  currentUserId,
  onChange,
  onError,
}: {
  projectId: string;
  task: ProjectTask;
  subtask: ProjectTaskSubtask;
  canManage: boolean;
  currentUserId?: string;
  onChange: () => void;
  onError: (message: string) => void;
}) => {
  const canTick = canManage || subtask.assignedTo?._id === currentUserId;

  const toggle = async () => {
    try {
      await projectTaskApi.updateSubtask(projectId, task._id, subtask._id, {
        status: subtask.status === 'Completed' ? 'Pending' : 'Completed',
      });
      onChange();
    } catch (reason) { onError(getErrorMessage(reason, 'The subtask status could not be updated.')); }
  };

  const remove = async () => {
    try {
      await projectTaskApi.removeSubtask(projectId, task._id, subtask._id);
      onChange();
    } catch (reason) { onError(getErrorMessage(reason, 'The subtask could not be removed.')); }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0' }}>
      <input type="checkbox" checked={subtask.status === 'Completed'} disabled={!canTick} onChange={toggle} />
      <span style={{ fontSize: '0.8125rem', color: subtask.status === 'Completed' ? 'var(--text-muted)' : 'var(--text-secondary)', textDecoration: subtask.status === 'Completed' ? 'line-through' : 'none', flex: 1 }}>
        {subtask.title}
      </span>
      {subtask.status !== 'Pending' && <span className={`subtask-status subtask-status-${subtask.status.toLowerCase().replace(' ', '-')}`}>{subtask.status === 'Completed' ? 'Done' : subtask.status}</span>}
      {subtask.dueDate && <span className={subtask.status !== 'Completed' && subtask.dueDate < new Date().toISOString().slice(0, 10) ? 'task-date-overdue' : 'task-date'}>Due {new Date(subtask.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
      {subtask.assignedTo && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{subtask.assignedTo.name}</span>}
      {canManage && (
        <button className="icon-btn" style={{ width: '20px', height: '20px', color: 'var(--danger)' }} onClick={remove}>
          <Trash2 size={11} />
        </button>
      )}
    </div>
  );
};

const TaskCard = ({
  projectId,
  task,
  members,
  canManage,
  currentUserId,
  onChange,
  onOpen,
  onError,
}: {
  projectId: string;
  task: ProjectTask;
  members: Member[];
  canManage: boolean;
  currentUserId?: string;
  onChange: () => void;
  onOpen: () => void;
  onError: (message: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [subtaskAssignee, setSubtaskAssignee] = useState('');
  const [subtaskDueDate, setSubtaskDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  const canTick = canManage || task.assignedTo?._id === currentUserId;

  const toggleComplete = async () => {
    try { await projectTaskApi.update(projectId, task._id, { status: task.status === 'Completed' ? 'Pending' : 'Completed' }); onChange(); }
    catch (reason) { onError(getErrorMessage(reason, 'The task status could not be updated.')); }
  };

  const removeTask = async () => {
    try { await projectTaskApi.remove(projectId, task._id); onChange(); }
    catch (reason) { onError(getErrorMessage(reason, 'The task could not be removed.')); }
  };

  const addSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subtaskTitle.trim()) return;
    setSaving(true);
    try {
      await projectTaskApi.addSubtask(projectId, task._id, { title: subtaskTitle, assignedTo: subtaskAssignee || undefined, dueDate: subtaskDueDate || undefined });
      setSubtaskTitle('');
      setSubtaskAssignee('');
      setSubtaskDueDate('');
      setAddingSubtask(false);
      onChange();
    } catch (reason) {
      onError(getErrorMessage(reason, 'The subtask could not be added.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div draggable={canManage} onDragStart={(event) => event.dataTransfer.setData('text/task-id', task._id)} className={`task-card priority-${task.priority.toLowerCase()} task-status-${task.status.toLowerCase().replace(' ', '-')} ${task.dueDate && task.status !== 'Completed' && task.dueDate < new Date().toISOString().slice(0, 10) ? 'is-overdue' : ''}`} onClick={onOpen} style={{ borderRadius: 'var(--radius-md)', padding: '0.875rem 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
        <button className="icon-btn" style={{ width: '20px', height: '20px', marginTop: '0.125rem' }} onClick={(event) => { event.stopPropagation(); setOpen((v) => !v); }}>
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <input type="checkbox" style={{ marginTop: '0.25rem' }} checked={task.status === 'Completed'} disabled={!canTick} onClick={(event) => event.stopPropagation()} onChange={toggleComplete} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: task.status === 'Completed' ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: task.status === 'Completed' ? 'line-through' : 'none' }}>
              {task.title}
            </span>
            <span className={`badge ${PRIORITY_BADGE[task.priority]}`}>{task.priority}</span>
            {(task.blocked || task.status === 'Blocked') && <span className="badge badge-danger">Blocked</span>}
            {task.deliverable && <span className="task-feature-label">{task.milestone?.name && <>{task.milestone.name}<ChevronRight size={10}/></>}{task.deliverable.name}</span>}
            {task.subtasks.length > 0 && (
              <span className="task-metric"><CheckSquare size={11}/>{task.subtasks.filter((s) => s.status === 'Completed').length}/{task.subtasks.length}</span>
            )}
            {task.documents.length > 0 && <span className="task-metric"><Paperclip size={11}/>{task.documents.length}</span>}
            {task.comments?.length > 0 && <span className="task-metric">{task.comments.length} comments</span>}
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
            {task.assignedTo && <span>Assigned to {task.assignedTo.name}</span>}
            {task.dueDate && <span className={task.status !== 'Completed' && task.dueDate < new Date().toISOString().slice(0, 10) ? 'task-date-overdue' : ''}>Due {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
          </div>
          {task.assignedTo && <div className="task-assignee" title={task.assignedTo.name}>{task.assignedTo.photo ? <img src={task.assignedTo.photo} alt=""/> : task.assignedTo.name.charAt(0)}</div>}

          {open && (
            <div style={{ marginTop: '0.625rem', paddingLeft: '1rem', borderLeft: '2px solid var(--border-subtle)' }}>
              {task.subtasks.map((s) => (
                <SubtaskRow key={s._id} projectId={projectId} task={task} subtask={s} canManage={canManage} currentUserId={currentUserId} onChange={onChange} onError={onError} />
              ))}
              {canManage && (
                addingSubtask ? (
                  <form onSubmit={addSubtask} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <input type="text" className="form-input" placeholder="Subtask title" autoFocus value={subtaskTitle} onChange={(e) => setSubtaskTitle(e.target.value)} />
                    <select className="form-select" style={{ maxWidth: '140px' }} value={subtaskAssignee} onChange={(e) => setSubtaskAssignee(e.target.value)}>
                      <option value="">Unassigned</option>
                      {members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
                    </select>
                    <input type="date" className="form-input" style={{ maxWidth: '140px' }} value={subtaskDueDate} onChange={(e) => setSubtaskDueDate(e.target.value)} />
                    <button type="submit" className="btn btn-primary" style={{ padding: '0.375rem 0.75rem' }} disabled={saving}>Add</button>
                  </form>
                ) : (
                  <button className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', marginTop: '0.375rem' }} onClick={() => setAddingSubtask(true)}>
                    <Plus size={12} /> Add Subtask
                  </button>
                )
              )}
            </div>
          )}
        </div>
        {canManage && (
          <button className="icon-btn" style={{ color: 'var(--danger)' }} onClick={(event) => { event.stopPropagation(); void removeTask(); }}>
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
};

const ProjectTaskList = ({ projectId, members, canManage, currentUserId, refreshSignal = 0, onTasksChanged }: { projectId: string; members: Member[]; canManage: boolean; currentUserId?: string; refreshSignal?: number; onTasksChanged?: () => void }) => {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'board' | 'list'>('list');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setTasks(await projectTaskApi.list(projectId));
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load tasks.'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refetch();
  }, [refetch, refreshSignal]);

  const refreshAll = () => {
    void refetch();
    onTasksChanged?.();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError('');
    try {
      await projectTaskApi.create(projectId, { title, assignedTo: assignedTo || undefined, dueDate: dueDate || undefined, priority }, files);
      setTitle('');
      setAssignedTo('');
      setDueDate('');
      setPriority('Medium');
      setFiles([]);
      setShowForm(false);
      await refetch();
      onTasksChanged?.();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create task.'));
    } finally {
      setSaving(false);
    }
  };

  const moveTask = async (taskId: string, status: CanonicalTaskStatus) => {
    if (!canManage) return;
    try {
      await projectTaskApi.update(projectId, taskId, { canonicalStatus: status });
      await refetch();
      onTasksChanged?.();
    } catch (err) {
      setError(getErrorMessage(err, 'We could not move that task.'));
    }
  };

  return (
    <div className="section-card">
      <div className="section-card-header">
        <div className="section-card-title">
          <CheckSquare size={16} style={{ color: 'var(--accent-purple)' }} />
          Project Tasks
          <span className="badge badge-neutral" style={{ marginLeft: '0.5rem' }}>{tasks.length}</span>
        </div>
        <div className="task-view-actions">
          <div className="view-switch"><button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')} title="Board view"><Columns3 size={14}/></button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} title="List view"><List size={14}/></button></div>
          {canManage && <button className="btn btn-secondary" onClick={() => setShowForm((v) => !v)}><Plus size={14} /> Add Task</button>}
        </div>
      </div>
      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {error && <p style={{ color: 'var(--danger)', fontSize: '0.8125rem' }}>{error}</p>}

        {showForm && canManage && (
          <form onSubmit={handleCreate} className="project-task-quick-form">
            <div className="project-task-quick-row">
              <input type="text" className="form-input" placeholder="What needs to be done?" aria-label="Task title" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
              <select className="form-select" aria-label="Assign task" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                <option value="">Assign later</option>
                {members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
              </select>
              <button type="submit" className="btn btn-primary" disabled={saving || !title.trim()}><Plus size={14}/>{saving ? 'Adding…' : 'Add task'}</button>
            </div>
            <details className="project-task-more-options">
              <summary>More options</summary>
              <div>
                <label><span>Due date</span><input type="date" className="form-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
                <label><span>Priority</span><select className="form-select" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>{['Low', 'Medium', 'High', 'Critical'].map((p) => <option key={p}>{p}</option>)}</select></label>
                <div><input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={(e) => e.target.files && setFiles(Array.from(e.target.files).slice(0, 5))} /><button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}><Paperclip size={12}/>{files.length ? `${files.length} file(s)` : 'Attach files'}</button></div>
              </div>
            </details>
            <button type="button" className="project-task-cancel" onClick={() => setShowForm(false)}>Cancel</button>
          </form>
        )}

        {loading ? (
          <div className="skeleton" style={{ height: '60px', borderRadius: '10px' }}></div>
        ) : tasks.length === 0 ? (
          <div className="task-empty"><CheckSquare size={22}/><strong>No tasks yet</strong><span>Add the first task to make this project’s work visible.</span>{canManage && <button className="btn btn-secondary" onClick={() => setShowForm(true)}><Plus size={13}/>Add first task</button>}</div>
        ) : view === 'list' ? (
          tasks.map((task) => (
            <TaskCard key={task._id} projectId={projectId} task={task} members={members} canManage={canManage} currentUserId={currentUserId} onChange={refreshAll} onOpen={() => setSelectedTaskId(task._id)} onError={setError} />
          ))
        ) : (
          <div className="task-board">
            {BOARD_COLUMNS.map((column) => {
              const columnTasks = tasks.filter((task) => canonicalStatus(task) === column.status);
              return <section onDragOver={(event) => { if (canManage) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); const taskId = event.dataTransfer.getData('text/task-id'); if (taskId) moveTask(taskId, column.status); }} className={`task-column task-column-${column.status.toLowerCase().replaceAll('_', '-')}`} key={column.status}>
                <header><span>{column.label}</span><strong>{columnTasks.length}</strong></header>
                <div>{columnTasks.map((task) => <TaskCard key={task._id} projectId={projectId} task={task} members={members} canManage={canManage} currentUserId={currentUserId} onChange={refreshAll} onOpen={() => setSelectedTaskId(task._id)} onError={setError}/>)}</div>
                {!columnTasks.length && <p>No tasks</p>}
              </section>;
            })}
          </div>
        )}
      </div>
      {selectedTaskId && tasks.find((task) => task._id === selectedTaskId) && (
        <TaskDetailPanel projectId={projectId} task={tasks.find((task) => task._id === selectedTaskId)!} members={members} canManage={canManage} currentUserId={currentUserId} onClose={() => setSelectedTaskId(null)} onChange={refreshAll}/>
      )}
    </div>
  );
};

export default ProjectTaskList;
