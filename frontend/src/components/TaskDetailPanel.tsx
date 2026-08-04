import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle, Calendar, CheckCircle2, Flag, Layers3, MessageSquare, Paperclip,
  Pause, Play, ScanLine, Send, ShieldAlert, User, X, XCircle,
} from 'lucide-react';
import { hierarchyApi, type Milestone } from '../api/hierarchyApi';
import { projectTaskApi, type ProjectTask } from '../api/projectTaskApi';
import type { Member, Priority, TaskStatus } from '../types';
import { getErrorMessage } from '../utils/errorMessage';

const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'Pending', label: 'To Do' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'In Review', label: 'In Review' },
  { value: 'Completed', label: 'Done' },
];

const editableStatus = (status: TaskStatus): TaskStatus => status === 'Blocked' ? 'In Progress' : status;

const TaskDetailPanel = ({
  projectId, task, members, canManage, currentUserId, onClose, onChange,
}: {
  projectId: string;
  task: ProjectTask;
  members: Member[];
  canManage: boolean;
  currentUserId?: string;
  onClose: () => void;
  onChange: () => void;
}) => {
  const canInteract = canManage || task.assignedTo?._id === currentUserId;
  const [form, setForm] = useState({
    title: task.title,
    description: task.description || '',
    status: editableStatus(task.status),
    priority: task.priority,
    assignedTo: task.assignedTo?._id || '',
    dueDate: task.dueDate?.slice(0, 10) || '',
    blockerReason: task.blockerReason || '',
    milestoneId: task.milestoneId || '',
    deliverableId: task.deliverableId || '',
  });
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [comment, setComment] = useState('');
  const [showBlockerForm, setShowBlockerForm] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    setForm({
      title: task.title,
      description: task.description || '',
      status: editableStatus(task.status),
      priority: task.priority,
      assignedTo: task.assignedTo?._id || '',
      dueDate: task.dueDate?.slice(0, 10) || '',
      blockerReason: task.blockerReason || '',
      milestoneId: task.milestoneId || '',
      deliverableId: task.deliverableId || '',
    });
    setShowBlockerForm(false);
    setResolutionNote('');
  }, [task]);

  useEffect(() => {
    hierarchyApi.list(projectId)
      .then(setMilestones)
      .catch((reason) => setError(getErrorMessage(reason, 'The milestone list could not be loaded.')));
  }, [projectId]);

  const selectedMilestone = milestones.find((milestone) => milestone.id === form.milestoneId) || null;

  const runAction = async (action: () => Promise<unknown>, fallback = 'The task action could not be completed.') => {
    setSaving(true);
    setError('');
    try {
      await action();
      await onChange();
    } catch (reason) {
      setError(getErrorMessage(reason, fallback));
    } finally {
      setSaving(false);
    }
  };

  const save = () => runAction(
    () => projectTaskApi.update(projectId, task._id, canManage ? {
      title: form.title,
      description: form.description,
      status: form.status,
      dueDate: form.dueDate || undefined,
      assignedTo: form.assignedTo || undefined,
      priority: form.priority,
      milestoneId: form.milestoneId || null,
      deliverableId: form.deliverableId || null,
    } : { status: form.status }),
    'The task changes could not be saved.',
  );

  const reportBlocker = () => {
    if (!form.blockerReason.trim()) return;
    void runAction(async () => {
      await projectTaskApi.block(task._id, {
        summary: form.blockerReason.trim(),
        waitingOnType: 'OTHER',
        severity: 'MEDIUM',
      });
      setShowBlockerForm(false);
    }, 'The blocker could not be reported.');
  };

  const resolveBlocker = () => {
    if (!resolutionNote.trim()) return;
    void runAction(async () => {
      await projectTaskApi.unblock(task._id, resolutionNote.trim());
      setResolutionNote('');
    }, 'The blocker could not be resolved.');
  };

  const addComment = () => {
    if (!comment.trim()) return;
    void runAction(async () => {
      await projectTaskApi.addComment(projectId, task._id, comment.trim());
      setComment('');
    }, 'The comment could not be added.');
  };

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    void runAction(
      () => projectTaskApi.addDocuments(projectId, task._id, Array.from(files).slice(0, 5)),
      'The files could not be attached.',
    ).finally(() => { if (fileRef.current) fileRef.current.value = ''; });
  };

  return <div className="task-panel-backdrop" onMouseDown={onClose}>
    <aside className="task-detail-panel" role="dialog" aria-modal="true" aria-labelledby="task-panel-title" onMouseDown={(event) => event.stopPropagation()}>
      <header>
        <div><span className="task-breadcrumb">Project task</span><input id="task-panel-title" aria-label="Task title" value={form.title} disabled={!canManage} onChange={(event) => setForm({ ...form, title: event.target.value })}/></div>
        <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close task details"><X size={18}/></button>
      </header>
      <div className="task-panel-body">
        {canInteract && <nav className="task-quick-actions" aria-label="Task quick actions">
          {!task.blocked && task.status !== 'In Progress' && task.status !== 'Completed' && <button type="button" disabled={saving} onClick={() => runAction(() => projectTaskApi.start(task._id))}><Play size={13}/>Start</button>}
          {!task.blocked && task.status === 'In Progress' && <button type="button" disabled={saving} onClick={() => runAction(() => projectTaskApi.pause(task._id, form.description ? undefined : 'Paused from task drawer'))}><Pause size={13}/>Pause</button>}
          {!task.blocked && task.status !== 'In Review' && task.status !== 'Completed' && <button type="button" disabled={saving} onClick={() => runAction(() => projectTaskApi.requestReview(task._id))}><ScanLine size={13}/>Request review</button>}
          {!task.blocked && task.status !== 'Completed' && <button type="button" disabled={saving} onClick={() => runAction(() => projectTaskApi.complete(task._id, form.description ? `Delivered: ${task.title}` : undefined))}><CheckCircle2 size={13}/>Complete</button>}
          {!task.blocked && task.status !== 'Completed' && <button type="button" className="danger" disabled={saving} onClick={() => setShowBlockerForm((current) => !current)}><ShieldAlert size={13}/>Report blocker</button>}
          {canManage && !task.blocked && task.status === 'In Review' && <>
            <button type="button" disabled={saving} onClick={() => runAction(() => projectTaskApi.approve(task._id))}><CheckCircle2 size={13}/>Approve</button>
            <button type="button" className="danger" disabled={saving} onClick={() => runAction(() => projectTaskApi.reject(task._id, 'Changes requested by reviewer'))}><XCircle size={13}/>Request changes</button>
          </>}
        </nav>}

        {error && <div className="task-panel-error" role="alert"><AlertCircle size={14}/><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Dismiss error"><X size={13}/></button></div>}

        {showBlockerForm && !task.blocked && <section className="task-blocker-card report">
          <ShieldAlert size={17}/><div><strong>Report a blocker</strong><p>Describe the dependency or decision preventing progress. Project managers will see it immediately.</p><textarea autoFocus rows={3} value={form.blockerReason} placeholder="What is preventing progress?" onChange={(event) => setForm({ ...form, blockerReason: event.target.value })}/><footer><button type="button" className="btn btn-ghost" onClick={() => setShowBlockerForm(false)}>Cancel</button><button type="button" className="btn btn-danger" disabled={saving || !form.blockerReason.trim()} onClick={reportBlocker}>{saving ? 'Reporting…' : 'Report blocker'}</button></footer></div>
        </section>}

        {task.blocked && <section className="task-blocker-card active" aria-label="Active blocker">
          <ShieldAlert size={17}/><div><strong>Active blocker</strong><p>{task.blockerReason || 'Progress is blocked pending a resolution.'}</p>{canInteract && <><label>Resolution note<textarea rows={2} value={resolutionNote} placeholder="What changed, or how was this resolved?" onChange={(event) => setResolutionNote(event.target.value)}/></label><button type="button" className="btn btn-secondary" disabled={saving || !resolutionNote.trim()} onClick={resolveBlocker}>{saving ? 'Resolving…' : 'Resolve blocker'}</button></>}</div>
        </section>}

        <section className="task-fields">
          <label>Status<select value={form.status} disabled={!canInteract || task.blocked} onChange={(event) => setForm({ ...form, status: event.target.value as TaskStatus })}>{STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
          <label>Assignee<select value={form.assignedTo} disabled={!canManage} onChange={(event) => setForm({ ...form, assignedTo: event.target.value })}><option value="">Unassigned</option>{members.map((member) => <option value={member._id} key={member._id}>{member.name}</option>)}</select></label>
          <label>Priority<select value={form.priority} disabled={!canManage} onChange={(event) => setForm({ ...form, priority: event.target.value as Priority })}>{['Low', 'Medium', 'High', 'Critical'].map((priority) => <option key={priority}>{priority}</option>)}</select></label>
          <label>Due date<input type="date" value={form.dueDate} disabled={!canManage} onChange={(event) => setForm({ ...form, dueDate: event.target.value })}/></label>
        </section>

        <section className="task-hierarchy-fields"><header><Flag size={13}/><span><strong>Delivery breakdown</strong><small>Place this task where the team expects to find it.</small></span></header><div><label>Milestone<select value={form.milestoneId} disabled={!canManage} onChange={(event) => setForm({ ...form, milestoneId: event.target.value, deliverableId: '' })}><option value="">Project backlog</option>{milestones.map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.name}</option>)}</select></label><label>Module<select value={form.deliverableId} disabled={!canManage || !form.milestoneId} onChange={(event) => setForm({ ...form, deliverableId: event.target.value })}><option value="">No module selected</option>{(selectedMilestone?.deliverables || []).map((feature) => <option key={feature.id} value={feature.id}>{feature.name}</option>)}</select></label></div>{task.deliverable && <p><Layers3 size={12}/>{task.milestone?.name} <span>›</span> {task.deliverable.name}</p>}</section>

        <label className="task-description">Description<textarea rows={5} disabled={!canManage} placeholder="Add context, acceptance criteria or implementation notes…" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })}/></label>
        {canInteract && (!task.blocked || canManage) && <button type="button" className="btn btn-primary task-save" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save changes'}</button>}

        <section className="panel-subtasks"><h3>Subtasks <span>{task.subtasks.length}</span></h3>{task.subtasks.map((subtask) => <div key={subtask._id}><span className={subtask.status === 'Completed' ? 'done' : ''}>{subtask.title}</span><em><User size={11}/>{subtask.assignedTo?.name || 'Unassigned'}</em>{subtask.dueDate && <em><Calendar size={11}/>{new Date(subtask.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</em>}</div>)}</section>
        <section className="panel-attachments"><h3><Paperclip size={14}/>Attachments <span>{task.documents.length}</span></h3><div>{task.documents.map((document) => <a href={document.url} target="_blank" rel="noreferrer" key={document.url}>{document.name}</a>)}</div>{canInteract && <><input ref={fileRef} hidden type="file" multiple onChange={(event) => addFiles(event.target.files)}/><button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}><Paperclip size={13}/>Attach files</button></>}</section>
        <section className="panel-comments"><h3><MessageSquare size={14}/>Comments &amp; activity <span>{task.comments?.length || 0}</span></h3>{canInteract && <div className="comment-compose"><input value={comment} placeholder="Write an update or ask a question…" onChange={(event) => setComment(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addComment(); }}/><button type="button" aria-label="Add comment" disabled={!comment.trim() || saving} onClick={addComment}><Send size={14}/></button></div>}<div className="comment-feed">{task.comments?.map((item) => <article key={item._id}><div className="avatar">{item.author?.name?.charAt(0) || '?'}</div><div><strong>{item.author?.name || 'Team member'}</strong><time>{new Date(item.createdAt).toLocaleString()}</time><p>{item.body}</p></div></article>)}{!task.comments?.length && <p className="comment-empty">No comments yet.</p>}</div></section>
      </div>
    </aside>
  </div>;
};

export default TaskDetailPanel;
