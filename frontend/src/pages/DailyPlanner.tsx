import { useMemo, useState } from 'react';
import { CalendarClock, ChevronDown, ChevronRight, CircleDot, Clock3, Columns3, FileText, FolderKanban, List, ListChecks, Paperclip, Pencil, Plus, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDailyTodos } from '../hooks/useDailyTodos';
import { useTeam } from '../hooks/useTeam';
import { useAuth } from '../context/AuthContext';
import { isSuperAdmin } from '../utils/roles';
import TodoFormModal, { type PersonalWorkType } from '../components/TodoFormModal';
import SubtaskList from '../components/SubtaskList';
import ConfirmDialog from '../components/ConfirmDialog';
import { todoApi, type DailyTodo } from '../api/todoApi';
import { getErrorMessage } from '../utils/errorMessage';
import { projectTaskApi } from '../api/projectTaskApi';
import { removeDemoTask, updateDemoTask } from '../context/demoTasks';

const PRIORITY_BADGE: Record<string, string> = { Low: 'badge-neutral', Medium: 'badge-info', High: 'badge-warning', Critical: 'badge-danger' };
const TYPE_LABEL: Record<DailyTodo['workType'], string> = { TASK: 'Task', MEETING: 'Meeting', UPDATE: 'Update' };
const RECURRENCE_LABEL: Record<DailyTodo['recurrence'], string> = { NONE: '', DAILY: 'Every day', WEEKDAYS: 'Weekdays', WEEKLY: 'Every week' };

type Tab = 'today' | 'tomorrow' | 'upcoming' | 'completed';
type TaskDomain = 'ALL' | DailyTodo['domainType'];
type WorkTypeFilter = 'ALL' | DailyTodo['workType'];

const TABS: { key: Tab; label: string }[] = [
  { key: 'today', label: 'Today' }, { key: 'tomorrow', label: 'Tomorrow' }, { key: 'upcoming', label: 'Upcoming' }, { key: 'completed', label: 'Completed' },
];
const DOMAIN_FILTERS: Array<{ key: TaskDomain; label: string }> = [
  { key: 'ALL', label: 'All work' }, { key: 'DEVELOPMENT', label: 'Development' }, { key: 'MARKETING', label: 'Marketing' }, { key: 'SALES', label: 'Sales' }, { key: 'OPERATIONS', label: 'Leadership' }, { key: 'PERSONAL', label: 'Personal' },
];
const TYPE_FILTERS: Array<{ key: WorkTypeFilter; label: string; icon: typeof ListChecks }> = [
  { key: 'ALL', label: 'Everything', icon: ListChecks }, { key: 'TASK', label: 'Tasks', icon: CircleDot }, { key: 'MEETING', label: 'Meetings', icon: CalendarClock }, { key: 'UPDATE', label: 'Updates', icon: FileText },
];

const taskDomain = (todo: DailyTodo): DailyTodo['domainType'] => {
  if (todo.source !== 'PROJECT') return todo.domainType || 'PERSONAL';
  const department = (todo.project?.department || '').toUpperCase();
  if (department === 'MARKETING') return 'MARKETING';
  if (department === 'SALES') return 'SALES';
  return 'DEVELOPMENT';
};

const dateKey = (offsetDays = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toLocaleDateString('en-CA');
};

const workTypeIcon = (type: DailyTodo['workType'], size = 13) => type === 'MEETING' ? <CalendarClock size={size}/> : type === 'UPDATE' ? <FileText size={size}/> : <ListChecks size={size}/>;
const formatTime = (value: string | null) => value ? new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
const scheduleLabel = (todo: DailyTodo) => {
  if (!todo.scheduledStart) return todo.dueDate ? new Date(`${todo.dueDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date';
  const start = formatTime(todo.scheduledStart);
  return todo.scheduledEnd ? `${start}–${formatTime(todo.scheduledEnd)}` : start;
};

const WorkMeta = ({ todo, compact = false }: { todo: DailyTodo; compact?: boolean }) => {
  const domain = taskDomain(todo).toLowerCase();
  return <div className={`work-item-meta ${compact ? 'compact' : ''}`}>
    <span className={`work-type-badge type-${todo.workType.toLowerCase()}`}>{workTypeIcon(todo.workType)}{TYPE_LABEL[todo.workType]}</span>
    {todo.project ? <Link className={`todo-project-label domain-${domain}`} to={`/projects/${todo.project._id}`}><FolderKanban size={11}/>{todo.project.name}</Link> : <span className={`todo-domain-label domain-${domain}`}>{taskDomain(todo).toLowerCase().replace(/^./, (letter) => letter.toUpperCase())}</span>}
    {todo.channel && <span className="work-meta-chip">{todo.channel}</span>}
    {todo.meetingWith && <span className="work-meta-chip">With {todo.meetingWith}</span>}
    {todo.recurrence !== 'NONE' && <span className="work-meta-chip recurring"><RefreshCw size={11}/>{RECURRENCE_LABEL[todo.recurrence]}</span>}
  </div>;
};

const DailyPlanner = () => {
  const { todos, loading, error: loadError, refetch, addTodo } = useDailyTodos();
  const { members } = useTeam();
  const { user, isDemo } = useAuth();
  const [tab, setTab] = useState<Tab>('today');
  const [createType, setCreateType] = useState<PersonalWorkType | null>(null);
  const [editTarget, setEditTarget] = useState<DailyTodo | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [deleteTarget, setDeleteTarget] = useState<DailyTodo | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<'list' | 'board'>('list');
  const [domain, setDomain] = useState<TaskDomain>('ALL');
  const [workType, setWorkType] = useState<WorkTypeFilter>('ALL');

  const isAdmin = isSuperAdmin(user?.role);
  const canTickTodo = (todo: DailyTodo) => isDemo || isAdmin || todo.source === 'PROJECT' || todo.assignedTo?._id === user?._id;
  const filteredTodos = useMemo(() => todos.filter((todo) => (domain === 'ALL' || taskDomain(todo) === domain) && (workType === 'ALL' || todo.workType === workType)), [domain, todos, workType]);
  const grouped = useMemo(() => {
    const today = dateKey();
    const tomorrow = dateKey(1);
    const groups: Record<Tab, DailyTodo[]> = { today: [], tomorrow: [], upcoming: [], completed: [] };
    for (const todo of filteredTodos) {
      if (todo.status === 'Completed') groups.completed.push(todo);
      else if (todo.dueDate === today) groups.today.push(todo);
      else if (todo.dueDate === tomorrow) groups.tomorrow.push(todo);
      else groups.upcoming.push(todo);
    }
    return groups;
  }, [filteredTodos]);

  const updateTodoStatus = async (todo: DailyTodo, status: DailyTodo['status']) => {
    try {
      if (isDemo) updateDemoTask(todo._id, status);
      else if (todo.source === 'PROJECT' && todo.project) await projectTaskApi.update(todo.project._id, todo._id, { status });
      else await todoApi.update(todo._id, { status });
      void refetch();
    } catch (err) { setError(getErrorMessage(err, 'Failed to update work item.')); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      if (isDemo) removeDemoTask(deleteTarget._id);
      else if (deleteTarget.source === 'PROJECT' && deleteTarget.project) await projectTaskApi.remove(deleteTarget.project._id, deleteTarget._id);
      else await todoApi.remove(deleteTarget._id);
      setDeleteTarget(null);
      void refetch();
    } catch (err) { setError(getErrorMessage(err, 'Failed to delete work item.')); }
    finally { setActionLoading(false); }
  };

  const handleCreated = (todo: DailyTodo) => {
    setTab(todo.dueDate === dateKey() ? 'today' : todo.dueDate === dateKey(1) ? 'tomorrow' : 'upcoming');
    setWorkType('ALL');
    setDomain('ALL');
    addTodo(todo);
    void refetch();
  };

  const visible = grouped[tab];
  const boardColumns = [
    { status: 'Pending', label: 'To Do' }, { status: 'In Progress', label: 'In Progress' }, { status: 'In Review', label: 'In Review' }, { status: 'Completed', label: 'Done' },
  ] as const;
  const todayItems = todos.filter((todo) => todo.dueDate === dateKey() && todo.status !== 'Completed');

  return <div className="animate-fade-in task-workspace-page">
    <div className="page-header task-page-header">
      <div><span className="page-eyebrow">My operating workspace</span><h1 className="page-title">Tasks</h1><p className="page-subtitle">See daily routines, development work, meetings and updates in one place.</p></div>
      <div className="task-create-actions"><button className="btn btn-primary" onClick={() => setCreateType('TASK')}><Plus size={15}/> Add task</button><button className="btn btn-secondary" onClick={() => setCreateType('MEETING')}><CalendarClock size={15}/> Meeting</button><button className="btn btn-secondary" onClick={() => setCreateType('UPDATE')}><FileText size={15}/> Update</button></div>
    </div>

    {(error || loadError) && <div className="form-error">{error || loadError}</div>}

    <section className="task-workspace-summary" aria-label="Today at a glance">
      <article><span><ListChecks size={17}/></span><div><small>Open today</small><strong>{todayItems.length}</strong></div></article>
      <article><span><CircleDot size={17}/></span><div><small>In progress</small><strong>{todos.filter((todo) => todo.status === 'In Progress').length}</strong></div></article>
      <article><span><CalendarClock size={17}/></span><div><small>Meetings today</small><strong>{todayItems.filter((todo) => todo.workType === 'MEETING').length}</strong></div></article>
      <article><span><FileText size={17}/></span><div><small>Updates today</small><strong>{todayItems.filter((todo) => todo.workType === 'UPDATE').length}</strong></div></article>
    </section>

    <div className="task-filter-stack">
      <nav className="task-type-filter" aria-label="Filter by work type">{TYPE_FILTERS.map(({ key, label, icon: Icon }) => <button key={key} className={workType === key ? 'active' : ''} onClick={() => setWorkType(key)}><Icon size={14}/>{label}<span>{key === 'ALL' ? todos.length : todos.filter((todo) => todo.workType === key).length}</span></button>)}</nav>
      <nav className="task-domain-filter" aria-label="Filter by work area">{DOMAIN_FILTERS.map((item) => { const count = item.key === 'ALL' ? todos.length : todos.filter((todo) => taskDomain(todo) === item.key).length; return <button type="button" className={`domain-${item.key.toLowerCase()} ${domain === item.key ? 'active' : ''}`} aria-pressed={domain === item.key} onClick={() => setDomain(item.key)} key={item.key}><i/>{item.label}<span>{count}</span></button>; })}</nav>
    </div>

    <div className="planner-view-row">
      <div className="task-date-tabs">{TABS.map((item) => <button key={item.key} onClick={() => setTab(item.key)} className={tab === item.key ? 'active' : ''}>{item.label}<span>{grouped[item.key].length}</span></button>)}</div>
      <div className="task-view-actions"><span>{view === 'list' ? 'Focused to-do list' : 'Kanban board'}</span><div className="view-switch"><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="List view"><List size={15}/></button><button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')} aria-label="Kanban view"><Columns3 size={15}/></button></div></div>
    </div>

    {loading ? <div className="flex flex-col gap-3">{[1,2,3].map((item) => <div key={item} className="skeleton" style={{ height: 88, borderRadius: 14 }}/>)}</div>
      : !visible.length ? <div className="section-card"><div className="empty-state"><div className="empty-state-icon"><ListChecks size={28}/></div><div className="empty-state-title">This view is clear</div><div className="empty-state-desc">There are no matching items. Change a filter or add your next task.</div><button className="btn btn-primary" onClick={() => setCreateType('TASK')}><Plus size={14}/> Add task</button></div></div>
      : view === 'board' ? <div className="todo-board">{boardColumns.map((column) => { const items = visible.filter((todo) => todo.status === column.status || (column.status === 'Pending' && todo.status === 'Blocked')); return <section className={`todo-column todo-column-${column.status.toLowerCase().replace(' ', '-')}`} key={column.status}><header><span>{column.label}</span><strong>{items.length}</strong></header><div>{items.map((todo) => <article className={`todo-board-card priority-${todo.priority.toLowerCase()} domain-${taskDomain(todo).toLowerCase()} type-${todo.workType.toLowerCase()}`} key={todo._id}><WorkMeta todo={todo} compact/><h3>{todo.title}</h3>{todo.description && <p>{todo.description}</p>}<div className="board-card-schedule"><Clock3 size={12}/><span>{scheduleLabel(todo)}</span>{todo.status === 'Blocked' && <b>Blocked</b>}</div>{canTickTodo(todo) && <select aria-label={`Update ${todo.title} status`} value={todo.status} onChange={(event) => updateTodoStatus(todo, event.target.value as DailyTodo['status'])}><option value="Pending">To Do</option><option value="In Progress">In Progress</option>{todo.source === 'PROJECT' && <option value="In Review">In Review</option>}<option value="Completed">Done</option><option value="Blocked">Blocked</option></select>}</article>)}</div>{!items.length && <p className="todo-column-empty">No work here</p>}</section>; })}</div>
      : <div className="todo-list">{visible.map((todo) => { const isOpen = Boolean(expanded[todo._id]); return <article key={todo._id} className={`section-card todo-list-card priority-${todo.priority.toLowerCase()} domain-${taskDomain(todo).toLowerCase()} type-${todo.workType.toLowerCase()}`}>
        <button className={`todo-check ${todo.status === 'Completed' ? 'done' : ''}`} aria-label={todo.status === 'Completed' ? `Reopen ${todo.title}` : `Complete ${todo.title}`} disabled={!canTickTodo(todo)} onClick={() => updateTodoStatus(todo, todo.status === 'Completed' ? 'Pending' : 'Completed')}>{todo.status === 'Completed' ? '✓' : ''}</button>
        <div className="todo-list-main"><WorkMeta todo={todo}/><button className="todo-title-button" onClick={() => setExpanded((current) => ({ ...current, [todo._id]: !current[todo._id] }))}><span>{todo.title}</span>{isOpen ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}</button>{todo.description && <p>{todo.description}</p>}<div className="todo-list-foot"><span><Clock3 size={12}/>{todo.daysOverdue > 0 ? `${todo.daysOverdue}d overdue` : scheduleLabel(todo)}</span><span>{todo.assignedTo?.name || 'My work'}</span><span className={`badge ${PRIORITY_BADGE[todo.priority]}`}>{todo.priority}</span>{todo.carryForwardCount > 0 && <span className="badge badge-warning" title={`Originally due ${todo.originalDueDate}`}><RotateCcw size={11}/> Carried {todo.carryForwardCount}×</span>}{todo.documents.length > 0 && <span><Paperclip size={11}/>{todo.documents.length}</span>}</div>{isOpen && <SubtaskList todo={todo} members={members} canManage={isAdmin} currentUserId={user?._id} onChange={refetch}/>}</div>
        {isAdmin && todo.source !== 'PROJECT' && <div className="todo-row-actions"><button className="icon-btn" aria-label={`Edit ${todo.title}`} onClick={() => setEditTarget(todo)}><Pencil size={14}/></button><button className="icon-btn todo-delete" aria-label={`Delete ${todo.title}`} onClick={() => setDeleteTarget(todo)}><Trash2 size={14}/></button></div>}
      </article>; })}</div>}

    {createType && <TodoFormModal members={members} initialWorkType={createType} onClose={() => setCreateType(null)} onSuccess={handleCreated}/>}
    {editTarget && <TodoFormModal members={members} existing={editTarget} initialWorkType={editTarget.workType} onClose={() => setEditTarget(null)} onSuccess={handleCreated}/>}
    {deleteTarget && <ConfirmDialog title={`Delete ${TYPE_LABEL[deleteTarget.workType]}`} message={`Delete “${deleteTarget.title}”?`} confirmLabel="Delete" danger loading={actionLoading} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)}/>}
  </div>;
};

export default DailyPlanner;
