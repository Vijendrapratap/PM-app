import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderKanban, CheckCircle2, Users, Layers,
  ArrowUpRight, TrendingUp, Clock, Zap,
  ListTodo, ListChecks, Megaphone, AlarmClock, CheckCheck, Pin, Activity, CalendarClock, AlertTriangle, UserRoundX, Lightbulb,
} from 'lucide-react';
import { projectApi } from '../api/projectApi';
import { userApi } from '../api/userApi';
import { todoApi, type DailyTodo, type Subtask, type TodaysTodo } from '../api/todoApi';
import { messageApi, type ImportantMessage } from '../api/messageApi';
import { projectTaskApi, type AssignedProjectTask } from '../api/projectTaskApi';
import { activityApi, type ActivityEntry } from '../api/activityApi';
import { ideaApi, type Idea } from '../api/ideaApi';
import type { ProjectTask } from '../api/projectTaskApi';
import type { Project } from '../types';
import { getProjectPortfolio, PROJECT_PORTFOLIOS } from '../utils/projectTaxonomy';
import { useAuth } from '../context/AuthContext';


const PRIORITY_BADGE: Record<string, string> = {
  Low: 'badge-neutral',
  Medium: 'badge-info',
  High: 'badge-warning',
  Critical: 'badge-danger',
};

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

const daysFromNow = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const Dashboard = () => {
  const { user } = useAuth();
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };
  const greetingText = user?.name ? `${getGreeting()}, ${user.name.split(' ')[0]}` : 'Portfolio command center';

  const [stats, setStats] = useState({
    totalProjects: 0,
    completedProjects: 0,
    activeProjects: 0,
    totalMembers: 0,
    draftProjects: 0,
  });
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [decisionQueue, setDecisionQueue] = useState({ atRisk: [] as Project[], unassigned: [] as { task: ProjectTask; project: Project }[], plannedIdeas: [] as Idea[] });
  const [portfolioTasks, setPortfolioTasks] = useState<{ project: Project; tasks: ProjectTask[] }[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ _id: string; name: string; availability: 'Available' | 'Busy' | 'On Leave'; status: string }[]>([]);
  const [workstream, setWorkstream] = useState('All portfolios');
  const [loading, setLoading] = useState(true);

  const [todaysTodo, setTodaysTodo] = useState<TodaysTodo>({ todos: [], subtasks: [] });
  const [assignedSubtasks, setAssignedSubtasks] = useState<Subtask[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<ImportantMessage[]>([]);
  const [overdueTodos, setOverdueTodos] = useState<DailyTodo[]>([]);
  const [recentlyCompleted, setRecentlyCompleted] = useState<DailyTodo[]>([]);
  const [assignedProjectTasks, setAssignedProjectTasks] = useState<AssignedProjectTask[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityEntry[]>([]);
  const [planLoading, setPlanLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [projects, users, ideas] = await Promise.all([projectApi.list(), userApi.list(), ideaApi.list()]);
        setStats({
          totalProjects: projects.length,
          completedProjects: projects.filter((p) => p.status === 'Completed').length,
          activeProjects: projects.filter((p) => p.status !== 'Completed' && p.status !== 'Draft').length,
          draftProjects: projects.filter((p) => p.status === 'Draft').length,
          totalMembers: users.length,
        });
        setRecentProjects([...projects]
          .filter((project) => project.status !== 'Completed' && !project.archived)
          .sort((a, b) => {
            const aDeadline = a.deadline || a.estimatedCompletionDate;
            const bDeadline = b.deadline || b.estimatedCompletionDate;
            if (!aDeadline && !bDeadline) return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            if (!aDeadline) return 1;
            if (!bDeadline) return -1;
            return new Date(aDeadline).getTime() - new Date(bDeadline).getTime();
          })
          .slice(0, 7));
        setTeamMembers(users);
        const activeProjects = projects.filter((project) => project.status !== 'Completed' && !project.archived);
        const taskGroups = await Promise.all(activeProjects.map(async (project) => ({ project, tasks: await projectTaskApi.list(project._id) })));
        setPortfolioTasks(taskGroups);
        const today = new Date().toISOString().slice(0, 10);
        const soon = daysFromNow(3);
        const atRisk = activeProjects.filter((project) => {
          const due = project.estimatedCompletionDate || project.deadline;
          return Boolean(due && project.progress < 100 && (due < today || (due <= soon && project.progress < 75)));
        });
        const unassigned = taskGroups.flatMap(({ project, tasks }) => tasks
          .filter((task) => task.status !== 'Completed' && !task.assignedTo)
          .map((task) => ({ task, project })));
        setDecisionQueue({ atRisk, unassigned, plannedIdeas: ideas.filter((idea) => idea.status === 'Planned').slice(0, 4) });
      } catch (error) {
        console.error('Failed to load stats', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  useEffect(() => {
    const fetchPlanner = async () => {
      try {
        const [today, subtasks, messages, mine, myTasks, activity] = await Promise.all([
          todoApi.today(),
          todoApi.assignedSubtasks(),
          messageApi.listActive(),
          todoApi.listMine(),
          projectTaskApi.assignedToMe(),
          activityApi.recent(8),
        ]);
        setTodaysTodo(today);
        setAssignedSubtasks(subtasks);
        setPinnedMessages(messages.filter((m) => m.pinned));
        setAssignedProjectTasks(myTasks.filter((t) => t.status !== 'Completed').slice(0, 6));
        setRecentActivity(activity);

        const todayStr = new Date().toISOString().slice(0, 10);
        setOverdueTodos(
          mine.filter((t) => t.status !== 'Completed' && t.dueDate && t.dueDate.slice(0, 10) < todayStr)
        );

        const cutoff = daysAgo(7);
        setRecentlyCompleted(
          mine
            .filter((t) => t.status === 'Completed' && t.completedAt && new Date(t.completedAt) >= cutoff)
            .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
            .slice(0, 5)
        );
      } catch (error) {
        console.error('Failed to load daily planner widgets', error);
      } finally {
        setPlanLoading(false);
      }
    };
    fetchPlanner();
  }, []);

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      'Completed': 'badge-success',
      'Draft': 'badge-neutral',
      'In Progress': 'badge-primary',
      'Review': 'badge-warning',
      'Testing': 'badge-purple',
      'Planning': 'badge-info',
    };
    return map[status] ?? 'badge-neutral';
  };

  const statCards = [
    {
      label: 'Active Projects',
      value: stats.activeProjects,
      desc: 'Currently in progress',
      icon: FolderKanban,
      color: 'blue',
      to: '/projects',
    },
    {
      label: 'Completed',
      value: stats.completedProjects,
      desc: 'Successfully delivered',
      icon: CheckCircle2,
      color: 'green',
      to: '/completed',
    },
    {
      label: 'Team Members',
      value: stats.totalMembers,
      desc: 'Across all projects',
      icon: Users,
      color: 'purple',
      to: '/team',
    },
    {
      label: 'Total Projects',
      value: stats.totalProjects,
      desc: 'All time projects',
      icon: Layers,
      color: 'indigo',
      to: '/projects',
    },
  ];

  const upcomingDeadlines = assignedProjectTasks
    .filter((t) => t.dueDate && t.dueDate >= new Date().toISOString().slice(0, 10) && t.dueDate <= daysFromNow(3))
    .map((t) => ({ id: t._id, title: t.title, dueDate: t.dueDate! }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const workstreams = ['All portfolios', ...PROJECT_PORTFOLIOS];
  const inWorkstream = (project: Project) => workstream === 'All portfolios' || getProjectPortfolio(project) === workstream;
  const visibleProjects = recentProjects.filter(inWorkstream);
  const visibleRisks = decisionQueue.atRisk.filter(inWorkstream);
  const visibleUnassigned = decisionQueue.unassigned.filter(({ project }) => inWorkstream(project));
  const visibleBlockers = portfolioTasks.filter(({ project }) => inWorkstream(project)).flatMap(({ project, tasks }) => tasks.filter((task) => task.status === 'Blocked').map((task) => ({ project, task })));
  const capacity = useMemo(() => {
    const counts = new Map<string, number>();
    const overdue = new Map<string, number>();
    const today = new Date().toISOString().slice(0, 10);
    const register = (item: { status: string; dueDate: string | null; assignedTo: { _id: string } | null }) => {
      if (item.status === 'Completed' || !item.assignedTo) return;
      counts.set(item.assignedTo._id, (counts.get(item.assignedTo._id) || 0) + 1);
      if (item.dueDate && item.dueDate < today) overdue.set(item.assignedTo._id, (overdue.get(item.assignedTo._id) || 0) + 1);
    };
    portfolioTasks.filter(({ project }) => inWorkstream(project)).forEach(({ tasks }) => tasks.forEach((task) => { register(task); task.subtasks.forEach(register); }));
    return teamMembers.filter((member) => member.status === 'Active').map((member) => ({ ...member, openTasks: counts.get(member._id) || 0, overdueTasks: overdue.get(member._id) || 0 }))
      .sort((a, b) => b.overdueTasks - a.overdueTasks || b.openTasks - a.openTasks || a.name.localeCompare(b.name));
  }, [portfolioTasks, teamMembers, workstream]);

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <div className="skeleton" style={{ height: '2rem', width: '200px', marginBottom: '0.5rem' }}></div>
          <div className="skeleton" style={{ height: '1rem', width: '300px' }}></div>
        </div>
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[1,2,3,4].map(i => (
            <div key={i} className="skeleton" style={{ height: '140px', borderRadius: '16px' }}></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in dashboard-compact">
      {/* Page Header */}
      <div className="dashboard-welcome-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
            <Zap size={18} style={{ color: 'var(--accent-cyan)' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-cyan)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Pratap AI Innovation</span>
          </div>
          <h1 className="dashboard-welcome-title">{greetingText}</h1>
          <p className="dashboard-welcome-subtitle">What needs a decision, who owns the work, and where delivery needs attention.</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Today</p>
          <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>


      {/* The first screen answers a PM's three daily decisions. */}
      <section className="decision-panel">
        <div className="decision-panel-title"><div><span>Decision queue</span><small>Resolve these before planning new work</small></div><label className="workstream-filter">Portfolio scope <select value={workstream} onChange={(e) => setWorkstream(e.target.value)}>{workstreams.map((item) => <option key={item}>{item}</option>)}</select></label></div>
        <div className="decision-grid">
          <Link to="/projects" className="decision-item danger">
            <AlertTriangle size={19} /><div><strong>{visibleRisks.length} project{visibleRisks.length === 1 ? '' : 's'} at risk</strong><span>{visibleRisks.length ? `${visibleRisks.slice(0, 3).map((project) => project.name).join(' · ')}${visibleRisks.length > 3 ? ` · +${visibleRisks.length - 3} more` : ''}` : 'No deadline risks detected'}</span></div><ArrowUpRight size={15} />
          </Link>
          <Link to="/projects" className="decision-item">
            <UserRoundX size={19} /><div><strong>{visibleUnassigned.length} unassigned task{visibleUnassigned.length === 1 ? '' : 's'}</strong><span>{visibleUnassigned[0] ? `${visibleUnassigned[0].task.title} · ${visibleUnassigned[0].project.name}` : 'Every open task has an owner'}</span></div><ArrowUpRight size={15} />
          </Link>
          <Link to="/ideas" className="decision-item">
            <Lightbulb size={19} /><div><strong>{decisionQueue.plannedIdeas.length} idea{decisionQueue.plannedIdeas.length === 1 ? '' : 's'} ready to plan</strong><span>{decisionQueue.plannedIdeas[0]?.title ?? 'Move evaluated opportunities into a slot'}</span></div><ArrowUpRight size={15} />
          </Link>
        </div>
      </section>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <Link to={card.to} key={card.label} className={`stat-card ${card.color}`}>
            <div className={`stat-icon ${card.color}`}>
              <card.icon size={22} />
            </div>
            <div className="stat-value">{card.value}</div>
            <div className="stat-label">{card.label}</div>
            <div className="stat-desc">{card.desc}</div>
            <ArrowUpRight className="stat-arrow" size={16} />
          </Link>
        ))}
      </div>

      <section className="attention-card section-card"><div className="section-card-header"><div className="section-card-title"><AlertTriangle size={15}/>Attention Needed</div><span>Missed work, blockers and delivery pressure</span></div><div className="dashboard-signal-grid">
        <section className="signal-card danger"><header><AlarmClock size={15}/><span>Missed daily tasks</span><strong>{overdueTodos.length}</strong></header><div>{overdueTodos.slice(0, 3).map((task) => <Link to="/daily-todo" key={task._id}><span>{task.title}</span><em>{task.daysOverdue}d overdue</em></Link>)}{!overdueTodos.length && <p>No missed daily tasks.</p>}</div></section>
        <section className="signal-card blocker"><header><AlertTriangle size={15}/><span>Project blockers</span><strong>{visibleBlockers.length}</strong></header><div>{visibleBlockers.slice(0, 3).map(({ task, project }) => <Link to={`/projects/${project._id}`} key={task._id}><span>{task.title}</span><em title={task.blockerReason || project.name}>{task.blockerReason || project.name}</em></Link>)}{!visibleBlockers.length && <p>No active blockers.</p>}</div></section>
        <section className="signal-card"><header><Users size={15}/><span>Team delivery pressure</span><strong>{capacity.filter((member) => member.overdueTasks > 0).length}</strong></header><div>{capacity.slice(0, 3).map((member) => <Link to={`/team?member=${member._id}`} key={member._id}><span>{member.name}</span><em className={member.overdueTasks ? 'vermilion' : ''}>{member.overdueTasks ? `${member.overdueTasks} overdue` : `${member.openTasks} open · on track`}</em></Link>)}</div></section>
      </div></section>

      {/* Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Projects ordered by delivery urgency. */}
        <div className="col-span-2 section-card">
          <div className="section-card-header">
            <div className="section-card-title">
              <TrendingUp size={16} style={{ color: 'var(--accent-blue)' }} />
              Projects by Deadline
            </div>
            <Link to="/projects" style={{ fontSize: '0.8125rem', color: 'var(--accent-blue)', fontWeight: 500 }}>
              View all →
            </Link>
          </div>
          <div style={{ padding: 0 }}>
            {visibleProjects.length === 0 ? (
              <div className="empty-state" style={{ padding: '3rem 2rem' }}>
                <div className="empty-state-icon"><FolderKanban size={28} /></div>
                <div className="empty-state-title">{recentProjects.length ? 'No projects in this workstream' : 'No Projects Yet'}</div>
                <div className="empty-state-desc">{recentProjects.length ? 'Choose another portfolio scope to see work.' : 'Create your first project to get started.'}</div>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th>Deadline</th>
                    <th>Members</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProjects.map((project) => (
                    <tr key={project._id} onClick={() => window.location.href = `/projects/${project._id}`}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{project.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{project.category || 'General'}</div>
                      </td>
                      <td>
                        <span className={`badge ${getStatusBadge(project.status)}`}>{project.status}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div className="progress-bar" style={{ width: '80px' }}>
                            <div className="progress-fill" style={{ width: `${project.progress}%` }}></div>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: '30px' }}>{project.progress}%</span>
                        </div>
                      </td>
                      <td>{(() => {
                        const deadline = project.deadline || project.estimatedCompletionDate;
                        if (!deadline) return <span className="deadline-label no-date">No date</span>;
                        const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
                        return <div className={`deadline-label ${days < 0 ? 'overdue' : days <= 7 ? 'soon' : ''}`}><strong>{new Date(deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong><span>{days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d left`}</span></div>;
                      })()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '-4px' }}>
                          {(project.assignedMembers || []).slice(0, 3).map((m, i) => (
                            <div key={i} className="avatar" style={{ width: '26px', height: '26px', fontSize: '0.625rem', border: '2px solid var(--surface-1)', marginLeft: i > 0 ? '-8px' : 0 }}>
                              {m.name?.charAt(0) ?? '?'}
                            </div>
                          ))}
                          {project.assignedMembers?.length === 0 && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Unassigned</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Summary Panel */}
        <div className="flex flex-col gap-4">
          {/* Status Breakdown */}
          <div className="section-card">
            <div className="section-card-header">
              <div className="section-card-title">
                <Clock size={16} style={{ color: 'var(--accent-purple)' }} />
                Overview
              </div>
            </div>
            <div className="section-card-body">
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Active', count: stats.activeProjects, color: 'var(--accent-blue)' },
                  { label: 'Completed', count: stats.completedProjects, color: 'var(--success)' },
                  { label: 'Drafts', count: stats.draftProjects, color: 'var(--text-muted)' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }}></div>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{item.label}</span>
                    </div>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.count}</span>
                  </div>
                ))}
                <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0.25rem 0' }}></div>
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Total</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stats.totalProjects}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Documentation readiness replaces redundant navigation shortcuts. */}
          <div className="section-card">
            <div className="section-card-header">
              <div className="section-card-title">
                <CheckCheck size={16} style={{ color: 'var(--accent-cyan)' }} />
                Delivery Readiness
              </div>
            </div>
            <div className="section-card-body" style={{ padding: '1rem' }}>
              <p className="readiness-intro">Projects missing handover essentials.</p>
              <div className="readiness-list">{recentProjects.filter((project) => project.status !== 'Completed').slice(0, 4).map((project) => {
                const requirements = project.documents?.some((document) => /brd|requirement|scope|spec|prd/i.test(document.name));
                const ready = [requirements, Boolean(project.finalLinks?.github), Boolean(project.description && project.description.length >= 80)].filter(Boolean).length;
                return <Link to={`/projects/${project._id}`} key={project._id}><div><strong>{project.name}</strong><span>{ready === 3 ? 'Core documentation ready' : `${3 - ready} core item${3 - ready === 1 ? '' : 's'} missing`}</span></div><b className={ready === 3 ? 'ready' : ''}>{ready}/3</b></Link>;
              })}{recentProjects.length === 0 && <span className="capacity-empty">No active projects to review.</span>}</div>
            </div>
          </div>
        </div>
      </div>

      <section className="capacity-card">
        <div className="capacity-header"><div><div className="eyebrow"><Users size={13} /> Team capacity</div><h2>Open work by owner</h2><p>Use this to balance assignments before adding work to a sprint.</p></div><Link to="/team">View team <ArrowUpRight size={14} /></Link></div>
        <div className="capacity-list">
          {capacity.length === 0 ? <span className="capacity-empty">No active team members available.</span> : capacity.slice(0, 6).map((member) => {
            const level = member.openTasks >= 8 ? 'high' : member.openTasks >= 4 ? 'medium' : 'low';
            return <div className={`capacity-member ${member.overdueTasks ? 'has-overdue' : ''}`} key={member._id}><div className="avatar">{member.name.charAt(0)}</div><div className="capacity-name"><strong>{member.name}</strong><span>{member.availability} · {member.openTasks} open{member.overdueTasks ? ` · ${member.overdueTasks} overdue` : ''}</span></div><div className={`capacity-meter ${level}`}><i style={{ width: `${Math.min(member.openTasks / 8 * 100, 100)}%` }} /></div></div>;
          })}
        </div>
      </section>

      {/* Daily Planner Widgets */}
      <div className="grid grid-cols-2 gap-6" style={{ marginTop: '1.5rem' }}>
        {/* Today's To-Do */}
        <div className="section-card">
          <div className="section-card-header">
            <div className="section-card-title">
              <ListTodo size={16} style={{ color: 'var(--accent-cyan)' }} />
              Today's To-Do
            </div>
            <Link to="/daily-todo" style={{ fontSize: '0.8125rem', color: 'var(--accent-blue)', fontWeight: 500 }}>Open planner →</Link>
          </div>
          <div className="section-card-body">
            {planLoading ? (
              <div className="skeleton" style={{ height: '60px', borderRadius: '10px' }}></div>
            ) : todaysTodo.todos.length === 0 && todaysTodo.subtasks.length === 0 ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Nothing due today.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {todaysTodo.todos.map((t) => (
                  <div key={t._id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className={`badge ${PRIORITY_BADGE[t.priority]}`}>{t.priority}</span>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{t.title}</span>
                  </div>
                ))}
                {todaysTodo.subtasks.map((s) => (
                  <div key={s._id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{s.title}</span>
                    {s.parentTitle && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>· {s.parentTitle}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Assigned Subtasks */}
        <div className="section-card">
          <div className="section-card-header">
            <div className="section-card-title">
              <ListChecks size={16} style={{ color: 'var(--accent-purple)' }} />
              Assigned Subtasks
            </div>
          </div>
          <div className="section-card-body">
            {planLoading ? (
              <div className="skeleton" style={{ height: '60px', borderRadius: '10px' }}></div>
            ) : assignedSubtasks.length === 0 ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No subtasks assigned to you.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {assignedSubtasks.slice(0, 6).map((s) => (
                  <div key={s._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{s.title}</span>
                    {s.dueDate && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(s.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4" style={{ marginTop: '1.5rem' }}>
        {/* Assigned Project Tasks */}
        <div className="section-card">
          <div className="section-card-header">
            <div className="section-card-title">
              <FolderKanban size={16} style={{ color: 'var(--accent-blue)' }} />
              Assigned Project Tasks
            </div>
          </div>
          <div className="section-card-body">
            {planLoading ? (
              <div className="skeleton" style={{ height: '50px', borderRadius: '10px' }}></div>
            ) : assignedProjectTasks.length === 0 ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No project tasks assigned to you.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {assignedProjectTasks.map((t) => (
                  <Link key={t._id} to={t.project ? `/projects/${t.project._id}` : '/projects'} style={{ display: 'block', textDecoration: 'none' }}>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{t.title}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.project?.name}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pinned Important Messages */}
        <div className="section-card">
          <div className="section-card-header">
            <div className="section-card-title">
              <Megaphone size={16} style={{ color: 'var(--accent-cyan)' }} />
              Pinned Messages
            </div>
          </div>
          <div className="section-card-body">
            {planLoading ? (
              <div className="skeleton" style={{ height: '50px', borderRadius: '10px' }}></div>
            ) : pinnedMessages.length === 0 ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No pinned messages.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {pinnedMessages.map((m) => (
                  <div key={m._id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <Pin size={11} style={{ color: 'var(--accent-cyan)' }} />
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{m.title}</span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{m.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Overdue Items */}
        <div className="section-card">
          <div className="section-card-header">
            <div className="section-card-title">
              <AlarmClock size={16} style={{ color: 'var(--danger)' }} />
              Overdue Items
            </div>
          </div>
          <div className="section-card-body">
            {planLoading ? (
              <div className="skeleton" style={{ height: '50px', borderRadius: '10px' }}></div>
            ) : overdueTodos.length === 0 ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Nothing overdue.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {overdueTodos.slice(0, 6).map((t) => (
                  <div key={t._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{t.title}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--danger)' }}>{new Date(t.dueDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4" style={{ marginTop: '1.5rem' }}>
        {/* Recently Completed */}
        <div className="section-card">
          <div className="section-card-header">
            <div className="section-card-title">
              <CheckCheck size={16} style={{ color: 'var(--success)' }} />
              Recently Completed
            </div>
          </div>
          <div className="section-card-body">
            {planLoading ? (
              <div className="skeleton" style={{ height: '50px', borderRadius: '10px' }}></div>
            ) : recentlyCompleted.length === 0 ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Nothing completed recently.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {recentlyCompleted.map((t) => (
                  <div key={t._id} style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{t.title}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="section-card">
          <div className="section-card-header">
            <div className="section-card-title">
              <CalendarClock size={16} style={{ color: 'var(--accent-purple)' }} />
              Upcoming Deadlines
            </div>
          </div>
          <div className="section-card-body">
            {planLoading ? (
              <div className="skeleton" style={{ height: '50px', borderRadius: '10px' }}></div>
            ) : upcomingDeadlines.length === 0 ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Nothing due in the next 3 days.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {upcomingDeadlines.slice(0, 6).map((d) => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{d.title}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(d.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="section-card">
          <div className="section-card-header">
            <div className="section-card-title">
              <Activity size={16} style={{ color: 'var(--accent-blue)' }} />
              Recent Activity
            </div>
          </div>
          <div className="section-card-body">
            {planLoading ? (
              <div className="skeleton" style={{ height: '50px', borderRadius: '10px' }}></div>
            ) : recentActivity.length === 0 ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No recent activity.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {recentActivity.map((a) => (
                  <div key={a._id}>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{a.details}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{a.actor?.name ?? 'Someone'} · {new Date(a.createdAt).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
