import { useState } from 'react';
import { Plus, Trash2, Sun, Paperclip } from 'lucide-react';
import { todoApi, type DailyTodo, type Subtask } from '../api/todoApi';
import { getErrorMessage } from '../utils/errorMessage';
import type { User, Priority } from '../types';

const SubtaskList = ({
  todo,
  members,
  canManage,
  currentUserId,
  onChange,
}: {
  todo: DailyTodo;
  members: User[];
  canManage: boolean;
  currentUserId?: string;
  onChange: () => void;
}) => {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [addToToday, setAddToToday] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await todoApi.addSubtask(todo._id, {
        title,
        assignedTo: assignedTo || undefined,
        dueDate: dueDate || undefined,
        priority,
        addToToday,
      }, files);
      setTitle('');
      setAssignedTo('');
      setDueDate('');
      setPriority('Medium');
      setAddToToday(false);
      setFiles([]);
      setAdding(false);
      onChange();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to add subtask.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleComplete = async (subtask: Subtask) => {
    try {
      await todoApi.updateSubtask(todo._id, subtask._id, {
        status: subtask.status === 'Completed' ? 'Pending' : 'Completed',
      });
      onChange();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update subtask.'));
    }
  };

  const removeSubtask = async (subtaskId: string) => {
    try {
      await todoApi.removeSubtask(todo._id, subtaskId);
      onChange();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to remove subtask.'));
    }
  };

  const canToggle = (subtask: Subtask) => canManage || subtask.assignedTo?._id === currentUserId;

  return (
    <div style={{ marginTop: '0.75rem', paddingLeft: '1.5rem', borderLeft: '2px solid var(--border-subtle)' }}>
      {todo.subtasks.length === 0 && !adding && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>No subtasks yet.</p>
      )}
      {todo.subtasks.map((subtask) => (
        <div key={subtask._id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.375rem 0', flexWrap: 'wrap' }}>
          <input
            type="checkbox"
            checked={subtask.status === 'Completed'}
            disabled={!canToggle(subtask)}
            onChange={() => toggleComplete(subtask)}
          />
          <span
            style={{
              fontSize: '0.8125rem',
              color: subtask.status === 'Completed' ? 'var(--text-muted)' : 'var(--text-secondary)',
              textDecoration: subtask.status === 'Completed' ? 'line-through' : 'none',
              flex: 1,
            }}
          >
            {subtask.title}
          </span>
          {subtask.addToToday && (
            <span title="In Today's To-Do"><Sun size={12} style={{ color: 'var(--accent-cyan)' }} /></span>
          )}
          {subtask.documents?.length > 0 && (
            <span title={`${subtask.documents.length} attachment(s)`} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              <Paperclip size={11} />{subtask.documents.length}
            </span>
          )}
          {subtask.assignedTo && (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{subtask.assignedTo.name}</span>
          )}
          {canManage && (
            <button className="icon-btn" style={{ width: '22px', height: '22px', color: 'var(--danger)' }} onClick={() => removeSubtask(subtask._id)}>
              <Trash2 size={12} />
            </button>
          )}
        </div>
      ))}

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.375rem' }}>{error}</p>}

      {canManage && (
        adding ? (
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.625rem', background: 'var(--surface-2)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Subtask title"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <select className="form-select" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                <option value="">Unassigned</option>
                {members.filter((m) => m.status !== 'Inactive').map((m) => (
                  <option key={m._id} value={m._id}>{m.name}</option>
                ))}
              </select>
              <input type="date" className="form-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              <select className="form-select" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                {['Low', 'Medium', 'High', 'Critical'].map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <input type="file" multiple onChange={(e) => e.target.files && setFiles(Array.from(e.target.files).slice(0, 5))} style={{ fontSize: '0.75rem' }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={addToToday} onChange={(e) => setAddToToday(e.target.checked)} />
              Add this subtask to the assigned user's Today's To-Do List
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" style={{ padding: '0.375rem 0.75rem' }} onClick={() => setAdding(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ padding: '0.375rem 0.75rem' }} disabled={saving}>
                {saving ? 'Adding...' : 'Add Subtask'}
              </button>
            </div>
          </form>
        ) : (
          <button className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', marginTop: '0.375rem' }} onClick={() => setAdding(true)}>
            <Plus size={12} /> Add Subtask
          </button>
        )
      )}
    </div>
  );
};

export default SubtaskList;
