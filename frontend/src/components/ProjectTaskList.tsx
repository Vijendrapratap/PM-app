import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckSquare, ChevronDown, ChevronRight, Plus, Trash2, Paperclip } from 'lucide-react';
import { projectTaskApi, type ProjectTask, type ProjectTaskSubtask } from '../api/projectTaskApi';
import { getErrorMessage } from '../utils/errorMessage';
import type { Member, Priority } from '../types';

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
}: {
  projectId: string;
  task: ProjectTask;
  subtask: ProjectTaskSubtask;
  canManage: boolean;
  currentUserId?: string;
  onChange: () => void;
}) => {
  const canTick = canManage || subtask.assignedTo?._id === currentUserId;

  const toggle = async () => {
    try {
      await projectTaskApi.updateSubtask(projectId, task._id, subtask._id, {
        status: subtask.status === 'Completed' ? 'Pending' : 'Completed',
      });
      onChange();
    } catch {
      // surfaced via parent list refresh; keep row interaction simple
    }
  };

  const remove = async () => {
    try {
      await projectTaskApi.removeSubtask(projectId, task._id, subtask._id);
      onChange();
    } catch {
      // no-op
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0' }}>
      <input type="checkbox" checked={subtask.status === 'Completed'} disabled={!canTick} onChange={toggle} />
      <span style={{ fontSize: '0.8125rem', color: subtask.status === 'Completed' ? 'var(--text-muted)' : 'var(--text-secondary)', textDecoration: subtask.status === 'Completed' ? 'line-through' : 'none', flex: 1 }}>
        {subtask.title}
      </span>
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
}: {
  projectId: string;
  task: ProjectTask;
  members: Member[];
  canManage: boolean;
  currentUserId?: string;
  onChange: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [subtaskAssignee, setSubtaskAssignee] = useState('');
  const [saving, setSaving] = useState(false);

  const canTick = canManage || task.assignedTo?._id === currentUserId;

  const toggleComplete = async () => {
    await projectTaskApi.update(projectId, task._id, { status: task.status === 'Completed' ? 'Pending' : 'Completed' }).catch(() => {});
    onChange();
  };

  const removeTask = async () => {
    await projectTaskApi.remove(projectId, task._id).catch(() => {});
    onChange();
  };

  const addSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subtaskTitle.trim()) return;
    setSaving(true);
    try {
      await projectTaskApi.addSubtask(projectId, task._id, { title: subtaskTitle, assignedTo: subtaskAssignee || undefined });
      setSubtaskTitle('');
      setSubtaskAssignee('');
      setAddingSubtask(false);
      onChange();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.875rem 1rem', background: 'var(--surface-1)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
        <button className="icon-btn" style={{ width: '20px', height: '20px', marginTop: '0.125rem' }} onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <input type="checkbox" style={{ marginTop: '0.25rem' }} checked={task.status === 'Completed'} disabled={!canTick} onChange={toggleComplete} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: task.status === 'Completed' ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: task.status === 'Completed' ? 'line-through' : 'none' }}>
              {task.title}
            </span>
            <span className={`badge ${PRIORITY_BADGE[task.priority]}`}>{task.priority}</span>
            {task.documents?.length > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}><Paperclip size={11} />{task.documents.length}</span>
            )}
            {task.subtasks.length > 0 && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{task.subtasks.filter((s) => s.status === 'Completed').length}/{task.subtasks.length} subtasks</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
            {task.assignedTo && <span>Assigned to {task.assignedTo.name}</span>}
            {task.dueDate && <span>Due {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
          </div>

          {open && (
            <div style={{ marginTop: '0.625rem', paddingLeft: '1rem', borderLeft: '2px solid var(--border-subtle)' }}>
              {task.subtasks.map((s) => (
                <SubtaskRow key={s._id} projectId={projectId} task={task} subtask={s} canManage={canManage} currentUserId={currentUserId} onChange={onChange} />
              ))}
              {canManage && (
                addingSubtask ? (
                  <form onSubmit={addSubtask} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <input type="text" className="form-input" placeholder="Subtask title" autoFocus value={subtaskTitle} onChange={(e) => setSubtaskTitle(e.target.value)} />
                    <select className="form-select" style={{ maxWidth: '140px' }} value={subtaskAssignee} onChange={(e) => setSubtaskAssignee(e.target.value)}>
                      <option value="">Unassigned</option>
                      {members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
                    </select>
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
          <button className="icon-btn" style={{ color: 'var(--danger)' }} onClick={removeTask}>
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
};

const ProjectTaskList = ({ projectId, members, canManage, currentUserId }: { projectId: string; members: Member[]; canManage: boolean; currentUserId?: string }) => {
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
    refetch();
  }, [refetch]);

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
      refetch();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create task.'));
    } finally {
      setSaving(false);
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
        {canManage && (
          <button className="btn btn-secondary" onClick={() => setShowForm((v) => !v)}>
            <Plus size={14} /> Add Task
          </button>
        )}
      </div>
      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {error && <p style={{ color: 'var(--danger)', fontSize: '0.8125rem' }}>{error}</p>}

        {showForm && canManage && (
          <form onSubmit={handleCreate} style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <input type="text" className="form-input" placeholder="Task title" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <select className="form-select" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                <option value="">Unassigned</option>
                {members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
              </select>
              <input type="date" className="form-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              <select className="form-select" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                {['Low', 'Medium', 'High', 'Critical'].map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={(e) => e.target.files && setFiles(Array.from(e.target.files).slice(0, 5))} />
              <button type="button" className="btn btn-ghost" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={() => fileRef.current?.click()}>
                <Paperclip size={12} /> {files.length ? `${files.length} file(s)` : 'Attach files'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Task'}</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="skeleton" style={{ height: '60px', borderRadius: '10px' }}></div>
        ) : tasks.length === 0 ? (
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No tasks yet for this project.</p>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task._id} projectId={projectId} task={task} members={members} canManage={canManage} currentUserId={currentUserId} onChange={refetch} />
          ))
        )}
      </div>
    </div>
  );
};

export default ProjectTaskList;
