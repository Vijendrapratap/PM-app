import { useMemo, useState } from 'react';
import { CalendarCheck2, CalendarClock, ChevronDown, ChevronRight, CircleDot, Clock3, Columns3, FileText, FolderKanban, List, ListChecks, Paperclip, Pencil, Plus, RefreshCw, RotateCcw, Search, Trash2, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDailyTodos } from '../hooks/useDailyTodos';
import { useTeam } from '../hooks/useTeam';
import { useAuth } from '../context/AuthContext';
import { canApproveAgentWork, isSuperAdmin } from '../utils/roles';
import TodoFormModal, { type PersonalWorkType } from '../components/TodoFormModal';
import SubtaskList from '../components/SubtaskList';
import ConfirmDialog from '../components/ConfirmDialog';
import { todoApi, type DailyTodo } from '../api/todoApi';
import { getErrorMessage } from '../utils/errorMessage';
import { projectTaskApi } from '../api/projectTaskApi';
import { removeDemoTask, updateDemoTask } from '../context/demoTasks';
import { TASK_DEPARTMENTS, taskDepartment, taskDepartmentLabel, type TaskDepartment } from '../utils/taskDepartments';

const PRIORITY_BADGE: Record<string, string> = { Low: 'badge-neutral', Medium: 'badge-info', High: 'badge-warning', Critical: 'badge-danger' };
const TYPE_LABEL: Record<DailyTodo['workType'], string> = { TASK: 'Task', MEETING: 'Meeting', UPDATE: 'Update' };
const RECURRENCE_LABEL: Record<DailyTodo['recurrence'], string> = { NONE: '', DAILY: 'Every day', WEEKDAYS: 'Weekdays', WEEKLY: 'Every week' };

type Tab = 'carry' | 'today' | 'tomorrow' | 'upcoming' | 'completed';
type DepartmentFilter = 'ALL' | TaskDepartment;
type WorkTypeFilter = 'ALL' | DailyTodo['workType'];

const TABS: { key: Tab; label: string }[] = [
  { key: 'carry', label: 'Carry forward' }, { key: 'today', label: 'Today' }, { key: 'tomorrow', label: 'Tomorrow' }, { key: 'upcoming', label: 'Upcoming' }, { key: 'completed', label: 'Completed' },
];
const DEPARTMENT_FILTERS: Array<{ key: DepartmentFilter; label: string }> = [
  { key: 'ALL', label: 'All departments' }, ...TASK_DEPARTMENTS,
];
const TYPE_FILTERS: Array<{ key: WorkTypeFilter; label: string; icon: typeof ListChecks }> = [
  { key: 'ALL', label: 'Everything', icon: ListChecks }, { key: 'TASK', label: 'Tasks', icon: CircleDot }, { key: 'MEETING', label: 'Meetings', icon: CalendarClock }, { key: 'UPDATE', label: 'Updates', icon: FileText },
];

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
  const domain = taskDepartment(todo).toLowerCase();
  return <div className={`work-item-meta ${compact ? 'compact' : ''}`}>
    <span className={`work-type-badge type-${todo.workType.toLowerCase()}`}>{workTypeIcon(todo.workType)}{TYPE_LABEL[todo.workType]}</span>
    {todo.project ? <Link className={`todo-project-label domain-${domain}`} to={`/projects/${todo.project._id}`}><FolderKanban size={11}/>{todo.project.name}</Link> : <span className={`todo-domain-label domain-${domain}`}>{taskDepartmentLabel(todo)}</span>}
    {todo.channel && <span className="work-meta-chip">{todo.channel}</span>}
    {todo.meetingWith && <span className="work-meta-chip">With {todo.meetingWith}</span>}
    {todo.recurrence !== 'NONE' && <span className="work-meta-chip recurring"><RefreshCw size={11}/>{RECURRENCE_LABEL[todo.recurrence]}</span>}
  </div>;
};

const DailyPlanner = () => {
  const { user, isDemo } = useAuth();
  const canSeeTeamTasks = canApproveAgentWork(user?.role);
  const [scope, setScope] = useState<'mine' | 'team'>('mine');
  const { todos, loading, error: loadError, refetch, addTodo } = useDailyTodos(scope);
  const { members } = useTeam();
  const [tab, setTab] = useState<Tab>('today');
  const [createType, setCreateType] = useState<PersonalWorkType | null>(null);
  const [editTarget, setEditTarget] = useState<DailyTodo | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [deleteTarget, setDeleteTarget] = useState<DailyTodo | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<'list' | 'board'>('list');
  const [department, setDepartment] = useState<DepartmentFilter>('ALL');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [workType, setWorkType] = useState<WorkTypeFilter>('ALL');
  const [search, setSearch] = useState('');

  const isAdmin = isSuperAdmin(user?.role);
  const canTickTodo = (todo: DailyTodo) => isDemo || isAdmin || todo.assignedTo?._id === user?._id || (canSeeTeamTasks && todo.source === 'PROJECT');
  const filteredTodos = useMemo(() => todos.filter((todo) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [todo.title, todo.description, todo.project?.name, todo.assignedTo?.name]
      .some((value) => value?.toLowerCase().includes(query));
    return matchesSearch
      && (department === 'ALL' || taskDepartment(todo) === department)
      && (projectFilter === 'ALL' || todo.project?._id === projectFilter)
      && (workType === 'ALL' || todo.workType === workType);
  }), [department, projectFilter, search, todos, workType]);
  const grouped = useMemo(() => {
    const today = dateKey();
    const tomorrow = dateKey(1);
    const groups: Record<Tab, DailyTodo[]> = { carry: [], today: [], tomorrow: [], upcoming: [], completed: [] };
    for (const todo of filteredTodos) {
      if (todo.status === 'Completed') groups.completed.push(todo);
      else {
        if (todo.carryForwardCount > 0 || todo.daysOverdue > 0) groups.carry.push(todo);
        if (todo.dueDate && todo.dueDate <= today) groups.today.push(todo);
        else if (todo.dueDate === tomorrow) groups.tomorrow.push(todo);
        else groups.upcoming.push(todo);
      }
    }
    const rank = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    Object.values(groups).forEach((items) => items.sort((a, b) => rank[a.priority] - rank[b.priority] || (a.dueDate || '9999').localeCompare(b.dueDate || '9999')));
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
    setDepartment('ALL');
    setProjectFilter('ALL');
    addTodo(todo);
    void refetch();
  };

  const visible = grouped[tab];
  const boardColumns = [
    { status: 'Pending', label: 'To Do' }, { status: 'In Progress', label: 'In Progress' }, { status: 'In Review', label: 'In Review' }, { status: 'Completed', label: 'Done' },
  ] as const;
  const todayItems = todos.filter((todo) => todo.dueDate && todo.dueDate <= dateKey() && todo.status !== 'Completed');
  const carryItems = todos.filter((todo) => todo.status !== 'Completed' && (todo.carryForwardCount > 0 || todo.daysOverdue > 0));
  const projectOptions = useMemo(() => {
    const projects = new Map<string, { id: string; name: string; count: number }>();
    todos.forEach((todo) => {
      if (!todo.project) return;
      const current = projects.get(todo.project._id);
      projects.set(todo.project._id, { id: todo.project._id, name: todo.project.name, count: (current?.count || 0) + 1 });
    });
    return [...projects.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [todos]);
  const activeFilterCount = Number(department !== 'ALL') + Number(projectFilter !== 'ALL') + Number(workType !== 'ALL') + Number(Boolean(search.trim()));

  return <div className="animate-fade-in task-workspace-page task-first-layout">
    <header className="page-header task-page-header">
      <div><span className="page-eyebrow">Daily task center</span><h1 className="page-title">Team tasks</h1><p className="page-subtitle">The work that needs attention now, organized by department and project.</p></div>
      <div className="task-create-actions"><Link className="btn btn-primary" to={`/workday?plan=${Date.now()}`}><CalendarCheck2 size={15}/> Plan my day</Link><button className="btn btn-secondary" onClick={() => setCreateType('TASK')}><Plus size={15}/> Add task</button></div>
    </header>

    {(error || loadError) && <div className="form-error">{error || loadError}</div>}

    <div className="task-scope-search task-feed-search">
      <label><Search size={15}/><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks, projects, or assignees"/></label>
      {canSeeTeamTasks && <div className="task-scope-switch" role="group" aria-label="Task scope"><button className={scope === 'mine' ? 'active' : ''} onClick={() => setScope('mine')}>My tasks</button><button className={scope === 'team' ? 'active' : ''} onClick={() => setScope('team')}><Users size={13}/>Team</button></div>}
    </div>

    <aside className="task-filter-stack task-context-rail" aria-label="Task categories">
      <div className="task-rail-heading"><div><strong>Task categories</strong><small>Filter the center list</small></div>{activeFilterCount > 0 && <button onClick={() => { setDepartment('ALL'); setProjectFilter('ALL'); setWorkType('ALL'); setSearch(''); }}>Clear {activeFilterCount}</button>}</div>
      <section className="task-workspace-summary task-rail-summary" aria-label="Today at a glance"><article className={carryItems.length ? 'needs-attention' : ''}><span><RotateCcw size={17}/></span><div><small>Carry forward</small><strong>{carryItems.length}</strong></div></article><article><span><ListChecks size={17}/></span><div><small>Open today</small><strong>{todayItems.length}</strong></div></article><article><span><CalendarClock size={17}/></span><div><small>Meetings</small><strong>{todayItems.filter((todo) => todo.workType === 'MEETING').length}</strong></div></article><article><span><CircleDot size={17}/></span><div><small>In progress</small><strong>{todos.filter((todo) => todo.status === 'In Progress').length}</strong></div></article></section>
      <div className="task-rail-actions"><button onClick={() => setCreateType('MEETING')}><CalendarClock size={14}/><span><strong>Add meeting</strong><small>Schedule team time</small></span></button><button onClick={() => setCreateType('UPDATE')}><FileText size={14}/><span><strong>Add update</strong><small>Record an action</small></span></button></div>
      <section className="task-category-group"><header><span>Departments</span><small>{department === 'ALL' ? 'All' : DEPARTMENT_FILTERS.find((item) => item.key === department)?.label}</small></header><nav className="task-domain-filter" aria-label="Filter by department">{DEPARTMENT_FILTERS.map((item) => { const count = item.key === 'ALL' ? todos.length : todos.filter((todo) => taskDepartment(todo) === item.key).length; return <button type="button" className={`domain-${item.key.toLowerCase()} ${department === item.key ? 'active' : ''}`} aria-pressed={department === item.key} onClick={() => setDepartment(item.key)} key={item.key}><i/><span className="task-category-name">{item.label}</span><b>{count}</b></button>; })}</nav></section>
      <section className="task-category-group"><header><span>Projects</span><small>{projectOptions.length}</small></header><nav className="task-project-filter" aria-label="Filter by project"><button className={projectFilter === 'ALL' ? 'active' : ''} onClick={() => setProjectFilter('ALL')}><FolderKanban size={13}/><span>All projects</span><b>{todos.filter((todo) => todo.project).length}</b></button>{projectOptions.map((project) => <button className={projectFilter === project.id ? 'active' : ''} onClick={() => setProjectFilter(project.id)} key={project.id}><span>{project.name}</span><b>{project.count}</b></button>)}</nav></section>
      <section className="task-category-group task-kind-group"><header><span>Work type</span></header><nav className="task-type-filter" aria-label="Filter by work type">{TYPE_FILTERS.map(({ key, label, icon: Icon }) => <button key={key} className={workType === key ? 'active' : ''} onClick={() => setWorkType(key)}><Icon size={14}/><span>{label}</span><b>{key === 'ALL' ? todos.length : todos.filter((todo) => todo.workType === key).length}</b></button>)}</nav></section>
    </aside>

    <div className="planner-view-row">
      <div><div className="task-date-tabs">{TABS.map((item) => <button key={item.key} onClick={() => setTab(item.key)} className={tab === item.key ? 'active' : ''}>{item.label}<span>{grouped[item.key].length}</span></button>)}</div><small>{visible.length} relevant task{visible.length === 1 ? '' : 's'} shown</small></div>
      <div className="task-view-actions"><span>{view === 'list' ? 'List' : 'Kanban'}</span><div className="view-switch"><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="List view"><List size={15}/></button><button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')} aria-label="Kanban view"><Columns3 size={15}/></button></div></div>
    </div>

    {loading ? <div className="flex flex-col gap-3">{[1,2,3].map((item) => <div key={item} className="skeleton" style={{ height: 88, borderRadius: 14 }}/>)}</div>
      : !visible.length ? <div className="section-card"><div className="empty-state"><div className="empty-state-icon"><ListChecks size={28}/></div><div className="empty-state-title">This view is clear</div><div className="empty-state-desc">There are no matching items. Change a filter or add your next task.</div><button className="btn btn-primary" onClick={() => setCreateType('TASK')}><Plus size={14}/> Add task</button></div></div>
      : view === 'board' ? <div className="todo-board">{boardColumns.map((column) => { const items = visible.filter((todo) => todo.status === column.status || (column.status === 'Pending' && todo.status === 'Blocked')); return <section className={`todo-column todo-column-${column.status.toLowerCase().replace(' ', '-')}`} key={column.status}><header><span>{column.label}</span><strong>{items.length}</strong></header><div>{items.map((todo) => <article className={`todo-board-card priority-${todo.priority.toLowerCase()} domain-${taskDepartment(todo).toLowerCase()} type-${todo.workType.toLowerCase()}`} key={todo._id}><WorkMeta todo={todo} compact/><h3>{todo.title}</h3>{todo.description && <p>{todo.description}</p>}<div className="board-card-schedule"><Clock3 size={12}/><span>{scheduleLabel(todo)}</span>{todo.status === 'Blocked' && <b>Blocked</b>}</div>{canTickTodo(todo) && <select aria-label={`Update ${todo.title} status`} value={todo.status} onChange={(event) => updateTodoStatus(todo, event.target.value as DailyTodo['status'])}><option value="Pending">To Do</option><option value="In Progress">In Progress</option>{todo.source === 'PROJECT' && <option value="In Review">In Review</option>}<option value="Completed">Done</option><option value="Blocked">Blocked</option></select>}</article>)}</div>{!items.length && <p className="todo-column-empty">No work here</p>}</section>; })}</div>
      : <div className="todo-list">{visible.map((todo) => { const isOpen = Boolean(expanded[todo._id]); return <article key={todo._id} className={`section-card todo-list-card priority-${todo.priority.toLowerCase()} domain-${taskDepartment(todo).toLowerCase()} type-${todo.workType.toLowerCase()}`}>
        <button className={`todo-check ${todo.status === 'Completed' ? 'done' : ''}`} aria-label={todo.status === 'Completed' ? `Reopen ${todo.title}` : `Complete ${todo.title}`} disabled={!canTickTodo(todo)} onClick={() => updateTodoStatus(todo, todo.status === 'Completed' ? 'Pending' : 'Completed')}>{todo.status === 'Completed' ? '✓' : ''}</button>
        <div className="todo-list-main"><WorkMeta todo={todo}/><button className="todo-title-button" onClick={() => setExpanded((current) => ({ ...current, [todo._id]: !current[todo._id] }))}><span>{todo.title}</span>{isOpen ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}</button>{todo.description && <p>{todo.description}</p>}<div className="todo-list-foot"><span><Clock3 size={12}/>{todo.daysOverdue > 0 ? `${todo.daysOverdue}d overdue` : scheduleLabel(todo)}</span><span>{todo.assignedTo?.name || 'Unassigned'}</span><span className={`badge ${PRIORITY_BADGE[todo.priority]}`}>{todo.priority}</span>{(todo.carryForwardCount > 0 || todo.daysOverdue > 0) && <span className="badge badge-warning" title={`Originally due ${todo.originalDueDate || todo.dueDate}`}><RotateCcw size={11}/>{todo.carryForwardCount > 0 ? `Carried ${todo.carryForwardCount}×` : 'Carry forward'}</span>}{todo.documents.length > 0 && <span><Paperclip size={11}/>{todo.documents.length}</span>}</div>{isOpen && <SubtaskList todo={todo} members={members} canManage={isAdmin} currentUserId={user?._id} onChange={refetch}/>}</div>
        {isAdmin && todo.source !== 'PROJECT' && <div className="todo-row-actions"><button className="icon-btn" aria-label={`Edit ${todo.title}`} onClick={() => setEditTarget(todo)}><Pencil size={14}/></button><button className="icon-btn todo-delete" aria-label={`Delete ${todo.title}`} onClick={() => setDeleteTarget(todo)}><Trash2 size={14}/></button></div>}
      </article>; })}</div>}

    {createType && <TodoFormModal members={members} initialWorkType={createType} onClose={() => setCreateType(null)} onSuccess={handleCreated}/>}
    {editTarget && <TodoFormModal members={members} existing={editTarget} initialWorkType={editTarget.workType} onClose={() => setEditTarget(null)} onSuccess={handleCreated}/>}
    {deleteTarget && <ConfirmDialog title={`Delete ${TYPE_LABEL[deleteTarget.workType]}`} message={`Delete “${deleteTarget.title}”?`} confirmLabel="Delete" danger loading={actionLoading} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)}/>}
  </div>;
};

export default DailyPlanner;
