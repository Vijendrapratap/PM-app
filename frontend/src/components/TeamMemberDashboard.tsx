import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowUpRight, CalendarDays, Check, ChevronRight,
  CircleDot, Clock3, LayoutGrid, List, MessageSquareText, Target,
} from 'lucide-react';
import { projectTaskApi, type AssignedProjectTask } from '../api/projectTaskApi';
import type { Workday } from '../api/workdayApi';
import type { ImportantMessage } from '../api/messageApi';
import type { Project, TaskStatus } from '../types';
import { getErrorMessage } from '../utils/errorMessage';

interface TeamMemberDashboardProps {
  name: string;
  workday: Workday | null;
  tasks: AssignedProjectTask[];
  projects: Project[];
  messages: ImportantMessage[];
}

const columns: Array<{ status: TaskStatus; label: string }> = [
  { status: 'Pending', label: 'Not started' },
  { status: 'In Progress', label: 'In progress' },
  { status: 'In Review', label: 'In review' },
  { status: 'Blocked', label: 'Blocked' },
  { status: 'Completed', label: 'Completed' },
];

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

const TeamMemberDashboard = ({ name, workday, tasks, projects, messages }: TeamMemberDashboardProps) => {
  const [view, setView] = useState<'board' | 'list'>('board');
  const [localTasks, setLocalTasks] = useState(tasks);
  const [savingTaskId, setSavingTaskId] = useState('');
  const [error, setError] = useState('');
  useEffect(() => setLocalTasks(tasks), [tasks]);

  const today = dayKey(new Date());
  const dueToday = localTasks.filter((task) => task.dueDate?.slice(0, 10) === today && task.status !== 'Completed').length;
  const blocked = localTasks.filter((task) => task.status === 'Blocked').length;
  const active = localTasks.filter((task) => task.status === 'In Progress').length;
  const week = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - date.getDay() + 1 + index);
    const key = dayKey(date);
    return { key, day: date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2), date: date.getDate(), count: localTasks.filter((task) => task.dueDate?.slice(0, 10) === key).length };
  }), [localTasks]);

  const updateStatus = async (task: AssignedProjectTask, status: TaskStatus) => {
    try {
      setSavingTaskId(task._id); setError('');
      await projectTaskApi.update(task.projectId, task._id, { status });
      setLocalTasks((current) => current.map((item) => item._id === task._id ? { ...item, status } : item));
    } catch (updateError) {
      setError(getErrorMessage(updateError, 'We could not update that task.'));
    } finally { setSavingTaskId(''); }
  };

  const taskCard = (task: AssignedProjectTask) => (
    <article className={`member-task-card ${task.status.toLowerCase().replaceAll(' ', '-')}`} key={task._id}>
      <div className="member-task-meta"><span>{task.project?.name || 'Assigned project'}</span><small>{task.priority}</small></div>
      <Link to={task.project ? `/projects/${task.project._id}` : '/projects'}>{task.title}</Link>
      <div className="member-task-foot">
        <span><CalendarDays size={12}/>{task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No due date'}</span>
        <select aria-label={`Update status for ${task.title}`} value={task.status} disabled={savingTaskId === task._id} onChange={(event) => updateStatus(task, event.target.value as TaskStatus)}>
          {columns.map((column) => <option key={column.status} value={column.status}>{column.label}</option>)}
        </select>
      </div>
    </article>
  );

  return (
    <div className="member-home animate-fade-in">
      {error && <div className="member-inline-error" role="alert"><AlertTriangle size={15}/>{error}</div>}
      <header className="member-hero">
        <div><span className="member-eyebrow">My workspace</span><h1>Welcome back, {name.split(' ')[0]}</h1><p>Choose the next outcome, update the work, and raise blockers early.</p></div>
        <Link to="/workday" className="member-day-action"><span>{workday ? <Target size={18}/> : <CircleDot size={18}/>}</span><div><small>{workday?.status === 'Completed' ? 'Workday closed' : workday ? 'Today’s focus' : 'Start my day'}</small><strong>{workday?.focus || 'Review priority and carried tasks'}</strong></div><ChevronRight size={17}/></Link>
      </header>

      <section className="member-summary" aria-label="My work summary">
        <div><span><Clock3 size={15}/></span><strong>{active}</strong><small>In progress</small></div>
        <div><span><CalendarDays size={15}/></span><strong>{dueToday}</strong><small>Due today</small></div>
        <div className={blocked ? 'needs-attention' : ''}><span><AlertTriangle size={15}/></span><strong>{blocked}</strong><small>Blocked</small></div>
        <Link to="/workday"><span><MessageSquareText size={15}/></span><strong>Update</strong><small>Progress or blocker</small><ArrowUpRight size={13}/></Link>
      </section>

      <div className="member-layout">
        <section className="member-board">
          <header><div><span>Assigned work</span><small>Update task status here. Use My workday for progress notes and blockers.</small></div><div className="member-view-switch"><button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}><LayoutGrid size={14}/>Board</button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><List size={14}/>List</button></div></header>
          {localTasks.length === 0 ? <div className="member-empty"><Check size={20}/><strong>No assigned work</strong><span>Your assigned project tasks will appear here.</span></div> : view === 'board' ? (
            <div className="member-kanban">{columns.map((column) => { const items = localTasks.filter((task) => task.status === column.status); return <section className={`member-column ${column.status.toLowerCase().replaceAll(' ', '-')}`} key={column.status}><header><span>{column.label}</span><b>{items.length}</b></header><div>{items.map(taskCard)}{!items.length && <p>No tasks</p>}</div></section>; })}</div>
          ) : <div className="member-task-list">{localTasks.map(taskCard)}</div>}
        </section>

        <aside className="member-side">
          <section className="member-week"><header><span>My week</span><small>{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</small></header><div>{week.map((day) => <div className={day.key === today ? 'today' : ''} key={day.key}><small>{day.day}</small><strong>{day.date}</strong><i>{day.count || ''}</i></div>)}</div><footer><span><i className="due"/>Task due</span><span><i className="current"/>Today</span></footer></section>
          <section className="member-projects"><header><span>My projects</span><Link to="/projects">View all</Link></header>{projects.slice(0, 4).map((project) => <Link to={`/projects/${project._id}`} key={project._id}><div><strong>{project.name}</strong><small>{project.status} · {project.progress}%</small></div><span><i style={{ width: `${project.progress}%` }}/></span></Link>)}{!projects.length && <p>No assigned projects.</p>}</section>
          <section className="member-decisions"><header>Recent decisions</header>{messages.slice(0, 3).map((message) => <div key={message._id}><strong>{message.title}</strong><p>{message.description}</p></div>)}{!messages.length && <p>No new project decisions.</p>}</section>
        </aside>
      </div>
    </div>
  );
};

export default TeamMemberDashboard;
