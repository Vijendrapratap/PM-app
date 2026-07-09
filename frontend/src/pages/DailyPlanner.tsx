import { useMemo, useState } from 'react';
import { Plus, ListChecks, Trash2, ChevronDown, ChevronRight, Paperclip, RotateCcw } from 'lucide-react';
import { useDailyTodos } from '../hooks/useDailyTodos';
import { useTeam } from '../hooks/useTeam';
import { useAuth } from '../context/AuthContext';
import { isSuperAdmin } from '../utils/roles';
import TodoFormModal from '../components/TodoFormModal';
import SubtaskList from '../components/SubtaskList';
import ConfirmDialog from '../components/ConfirmDialog';
import { todoApi, type DailyTodo } from '../api/todoApi';
import { getErrorMessage } from '../utils/errorMessage';

const PRIORITY_BADGE: Record<string, string> = {
  Low: 'badge-neutral',
  Medium: 'badge-info',
  High: 'badge-warning',
  Critical: 'badge-danger',
};

type Tab = 'today' | 'tomorrow' | 'upcoming' | 'completed';
const TABS: { key: Tab; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
];

const dateKey = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const DailyPlanner = () => {
  const { todos, loading, refetch } = useDailyTodos();
  const { members } = useTeam();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('today');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [deleteTarget, setDeleteTarget] = useState<DailyTodo | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleExpand = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const canManageTodo = (todo: DailyTodo) => isSuperAdmin(user?.role) || todo.createdBy?._id === user?._id;

  const grouped = useMemo(() => {
    const today = dateKey(0);
    const tomorrow = dateKey(1);
    const groups: Record<Tab, DailyTodo[]> = { today: [], tomorrow: [], upcoming: [], completed: [] };
    for (const todo of todos) {
      if (todo.status === 'Completed') {
        groups.completed.push(todo);
      } else if (todo.dueDate === today) {
        groups.today.push(todo);
      } else if (todo.dueDate === tomorrow) {
        groups.tomorrow.push(todo);
      } else {
        groups.upcoming.push(todo);
      }
    }
    return groups;
  }, [todos]);

  const toggleTodoComplete = async (todo: DailyTodo) => {
    try {
      await todoApi.update(todo._id, { status: todo.status === 'Completed' ? 'Pending' : 'Completed' });
      refetch();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update task.'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await todoApi.remove(deleteTarget._id);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete task.'));
    } finally {
      setActionLoading(false);
    }
  };

  const visible = grouped[tab];

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Daily To-Do</h1>
          <p className="page-subtitle">Personal tasks and subtasks, separate from project work.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={15} /> New Task
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', padding: '0.625rem 0.875rem', fontSize: '0.8125rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '0.625rem 1rem',
              background: 'none',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--accent-blue)' : '2px solid transparent',
              color: tab === t.key ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: tab === t.key ? 600 : 500,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            {t.label} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({grouped[t.key].length})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: '80px', borderRadius: '16px' }}></div>)}
        </div>
      ) : visible.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <div className="empty-state-icon"><ListChecks size={28} /></div>
            <div className="empty-state-title">Nothing here</div>
            <div className="empty-state-desc">No tasks in this view yet.</div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((todo) => {
            const isOpen = Boolean(expanded[todo._id]);
            return (
              <div key={todo._id} className="section-card" style={{ padding: '1.125rem 1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <button className="icon-btn" style={{ width: '22px', height: '22px', marginTop: '0.125rem' }} onClick={() => toggleExpand(todo._id)}>
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <input
                    type="checkbox"
                    style={{ marginTop: '0.3rem' }}
                    checked={todo.status === 'Completed'}
                    onChange={() => toggleTodoComplete(todo)}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: '0.9375rem',
                          color: todo.status === 'Completed' ? 'var(--text-muted)' : 'var(--text-primary)',
                          textDecoration: todo.status === 'Completed' ? 'line-through' : 'none',
                        }}
                      >
                        {todo.title}
                      </span>
                      <span className={`badge ${PRIORITY_BADGE[todo.priority]}`}>{todo.priority}</span>
                      {todo.carryForwardCount > 0 && (
                        <span title={`Carried forward ${todo.carryForwardCount} time(s) - originally due ${todo.originalDueDate}`} className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <RotateCcw size={11} /> Carried {todo.carryForwardCount}x
                        </span>
                      )}
                      {todo.daysOverdue > 0 && (
                        <span className="badge badge-danger">{todo.daysOverdue}d overdue</span>
                      )}
                      {todo.documents?.length > 0 && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          <Paperclip size={11} />{todo.documents.length}
                        </span>
                      )}
                      {todo.subtasks.length > 0 && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {todo.subtasks.filter((s) => s.status === 'Completed').length}/{todo.subtasks.length} subtasks
                        </span>
                      )}
                    </div>
                    {todo.description && (
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{todo.description}</p>
                    )}
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.375rem', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      {todo.assignedTo && <span>Assigned to {todo.assignedTo.name}</span>}
                      {todo.dueDate && <span>Due {new Date(todo.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                      {todo.originalDueDate && todo.originalDueDate !== todo.dueDate && (
                        <span>Original due {new Date(todo.originalDueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      )}
                      {todo.createdBy && <span>Created by {todo.createdBy.name}</span>}
                    </div>

                    {isOpen && (
                      <SubtaskList
                        todo={todo}
                        members={members}
                        canManage={canManageTodo(todo)}
                        currentUserId={user?._id}
                        onChange={refetch}
                      />
                    )}
                  </div>
                  {canManageTodo(todo) && (
                    <button className="icon-btn" style={{ color: 'var(--danger)' }} onClick={() => setDeleteTarget(todo)}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <TodoFormModal members={members} onClose={() => setIsModalOpen(false)} onSuccess={refetch} />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Task"
          message={`Delete "${deleteTarget.title}" and all of its subtasks?`}
          confirmLabel="Delete"
          danger
          loading={actionLoading}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default DailyPlanner;
