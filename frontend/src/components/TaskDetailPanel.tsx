import { useEffect, useRef, useState } from 'react';
import { X, Paperclip, MessageSquare, Send, User, Calendar } from 'lucide-react';
import { projectTaskApi, type ProjectTask } from '../api/projectTaskApi';
import type { Member, Priority, TaskStatus } from '../types';

const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'Pending', label: 'To Do' }, { value: 'In Progress', label: 'In Progress' }, { value: 'Blocked', label: 'Blocked' }, { value: 'In Review', label: 'In Review' }, { value: 'Completed', label: 'Done' },
];

const TaskDetailPanel = ({ projectId, task, members, canManage, currentUserId, onClose, onChange }: { projectId: string; task: ProjectTask; members: Member[]; canManage: boolean; currentUserId?: string; onClose: () => void; onChange: () => void }) => {
  const canInteract = canManage || task.assignedTo?._id === currentUserId;
  const [form, setForm] = useState({ title: task.title, description: task.description || '', status: task.status, priority: task.priority, assignedTo: task.assignedTo?._id || '', dueDate: task.dueDate?.slice(0, 10) || '', blockerReason: task.blockerReason || '' });
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setForm({ title: task.title, description: task.description || '', status: task.status, priority: task.priority, assignedTo: task.assignedTo?._id || '', dueDate: task.dueDate?.slice(0, 10) || '', blockerReason: task.blockerReason || '' }), [task]);

  const save = async () => { if (form.status === 'Blocked' && !form.blockerReason.trim()) return; setSaving(true); try { await projectTaskApi.update(projectId, task._id, canManage ? { ...form, dueDate: form.dueDate || undefined, assignedTo: form.assignedTo || undefined } : { status: form.status, blockerReason: form.blockerReason }); onChange(); } finally { setSaving(false); } };
  const addComment = async () => { if (!comment.trim()) return; setSaving(true); try { await projectTaskApi.addComment(projectId, task._id, comment.trim()); setComment(''); onChange(); } finally { setSaving(false); } };
  const addFiles = async (files: FileList | null) => { if (!files?.length) return; setSaving(true); try { await projectTaskApi.addDocuments(projectId, task._id, Array.from(files).slice(0, 5)); onChange(); } finally { setSaving(false); if (fileRef.current) fileRef.current.value = ''; } };

  return <div className="task-panel-backdrop" onMouseDown={onClose}><aside className="task-detail-panel" onMouseDown={(event) => event.stopPropagation()}>
    <header><div><span className="task-breadcrumb">Project task</span><input value={form.title} disabled={!canManage} onChange={(event) => setForm({ ...form, title: event.target.value })}/></div><button onClick={onClose}><X size={18}/></button></header>
    <div className="task-panel-body">
      <section className="task-fields">
        <label>Status<select value={form.status} disabled={!canInteract} onChange={(event) => setForm({ ...form, status: event.target.value as TaskStatus })}>{STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
        <label>Assignee<select value={form.assignedTo} disabled={!canManage} onChange={(event) => setForm({ ...form, assignedTo: event.target.value })}><option value="">Unassigned</option>{members.map((member) => <option value={member._id} key={member._id}>{member.name}</option>)}</select></label>
        <label>Priority<select value={form.priority} disabled={!canManage} onChange={(event) => setForm({ ...form, priority: event.target.value as Priority })}>{['Low','Medium','High','Critical'].map((priority) => <option key={priority}>{priority}</option>)}</select></label>
        <label>Due date<input type="date" value={form.dueDate} disabled={!canManage} onChange={(event) => setForm({ ...form, dueDate: event.target.value })}/></label>
      </section>
      {form.status === 'Blocked' && <label className="blocker-field">Blocker reason <span>Required while blocked</span><input value={form.blockerReason} disabled={!canInteract} placeholder="What is preventing progress?" onChange={(event) => setForm({ ...form, blockerReason: event.target.value })}/></label>}
      <label className="task-description">Description<textarea rows={5} disabled={!canManage} placeholder="Add context, acceptance criteria or implementation notes…" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })}/></label>
      {canInteract && <button className="btn btn-primary task-save" disabled={saving || (form.status === 'Blocked' && !form.blockerReason.trim())} onClick={save}>{saving ? 'Saving…' : 'Save changes'}</button>}
      <section className="panel-subtasks"><h3>Subtasks <span>{task.subtasks.length}</span></h3>{task.subtasks.map((subtask) => <div key={subtask._id}><span className={subtask.status === 'Completed' ? 'done' : ''}>{subtask.title}</span><em><User size={11}/>{subtask.assignedTo?.name || 'Unassigned'}</em>{subtask.dueDate && <em><Calendar size={11}/>{new Date(subtask.dueDate).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</em>}</div>)}</section>
      <section className="panel-attachments"><h3><Paperclip size={14}/>Attachments <span>{task.documents.length}</span></h3><div>{task.documents.map((document) => <a href={document.url} target="_blank" rel="noreferrer" key={document.url}>{document.name}</a>)}</div>{canInteract && <><input ref={fileRef} hidden type="file" multiple onChange={(event) => addFiles(event.target.files)}/><button className="btn btn-secondary" onClick={() => fileRef.current?.click()}><Paperclip size={13}/>Attach files</button></>}</section>
      <section className="panel-comments"><h3><MessageSquare size={14}/>Comments &amp; activity <span>{task.comments?.length || 0}</span></h3>{canInteract && <div className="comment-compose"><input value={comment} placeholder="Write an update or ask a question…" onChange={(event) => setComment(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addComment()}/><button disabled={!comment.trim() || saving} onClick={addComment}><Send size={14}/></button></div>}<div className="comment-feed">{task.comments?.map((item) => <article key={item._id}><div className="avatar">{item.author?.name?.charAt(0) || '?'}</div><div><strong>{item.author?.name || 'Team member'}</strong><time>{new Date(item.createdAt).toLocaleString()}</time><p>{item.body}</p></div></article>)}{!task.comments?.length && <p className="comment-empty">No comments yet.</p>}</div></section>
    </div>
  </aside></div>;
};
export default TaskDetailPanel;
