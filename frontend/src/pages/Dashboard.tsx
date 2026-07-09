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
  const [workstream, setWorkstream] = useState('All workstreams');
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
        setRecentProjects(projects.slice(0, 5));
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

  const workstreams = useMemo(() => ['All workstreams', ...Array.from(new Set(portfolioTasks.map(({ project }) => project.category).filter((v): v is string => Boolean(v))))], [portfolioTasks]);
  const inWorkstream = (project: Project) => workstream === 'All workstreams' || project.category === workstream;
  const visibleProjects = recentProjects.filter(inWorkstream);
  const visibleRisks = decisionQueue.atRisk.filter(inWorkstream);
  const visibleUnassigned = decisionQueue.unassigned.filter(({ project }) => inWorkstream(project));
  const capacity = useMemo(() => {
    const counts = new Map<string, number>();
    portfolioTasks.filter(({ project }) => inWorkstream(project)).forEach(({ tasks }) => tasks.forEach((task) => {
      if (task.status !== 'Completed' && task.assignedTo) counts.set(task.assignedTo._id, (counts.get(task.assignedTo._id) || 0) + 1);
    }));
    return teamMembers.filter((member) => member.status === 'Active').map((member) => ({ ...member, openTasks: counts.get(member._id) || 0 }))
      .sort((a, b) => b.openTasks - a.openTasks || a.name.localeCompare(b.name));
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
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
            <Zap size={20} style={{ color: 'var(--accent-cyan)' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-cyan)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Pratap AI Innovation</span>
          </div>
          <h1 className="page-title">Portfolio command center</h1>
          <p className="page-subtitle">What needs a decision, who owns the work, and where delivery needs attention.</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Today</p>
          <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* The first screen answers a PM's three daily decisions. */}
      <section className="decision-panel">
        <div className="decision-panel-title"><div><span>Decision queue</span><small>Resolve these before planning new work</small></div><label className="workstream-filter">Portfolio scope <select value={workstream} onChange={(e) => setWorkstream(e.target.value)}>{workstreams.map((item) => <option key={item}>{item}</option>)}</select></label></div>
        <div className="decision-grid">
          <Link to="/projects" className="decision-item danger">
            <AlertTriangle size={19} /><div><strong>{visibleRisks.length} project{visibleRisks.length === 1 ? '' : 's'} at risk</strong><span>{visibleRisks[0]?.name ?? 'No deadline risks detected'}</span></div><ArrowUpRight size={15} />
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

      {/* Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Recent Projects */}
        <div className="col-span-2 section-card">
          <div className="section-card-header">
            <div className="section-card-title">
              <TrendingUp size={16} style={{ color: 'var(--accent-blue)' }} />
              Recent Projects
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

          {/* Quick Actions */}
          <div className="section-card">
            <div className="section-card-header">
              <div className="section-card-title">
                <Zap size={16} style={{ color: 'var(--accent-cyan)' }} />
                Quick Links
              </div>
            </div>
            <div className="section-card-body" style={{ padding: '1rem' }}>
              <div className="flex flex-col gap-2">
                {[
                  { label: 'Active Projects', to: '/projects', icon: FolderKanban },
                  { label: 'Completed Projects', to: '/completed', icon: CheckCircle2 },
                  { label: 'Team Members', to: '/team', icon: Users },
                ].map(item => (
                  <Link
                    key={item.label}
                    to={item.to}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      padding: '0.625rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      color: 'var(--text-secondary)',
                      transition: 'all 0.15s',
                      textDecoration: 'none',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                    }}
                  >
                    <item.icon size={15} style={{ color: 'var(--accent-blue)' }} />
                    {item.label}
                    <ArrowUpRight size={13} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="capacity-card">
        <div className="capacity-header"><div><div className="eyebrow"><Users size={13} /> Team capacity</div><h2>Open work by owner</h2><p>Use this to balance assignments before adding work to a sprint.</p></div><Link to="/team">View team <ArrowUpRight size={14} /></Link></div>
        <div className="capacity-list">
          {capacity.length === 0 ? <span className="capacity-empty">No active team members available.</span> : capacity.slice(0, 6).map((member) => {
            const level = member.openTasks >= 8 ? 'high' : member.openTasks >= 4 ? 'medium' : 'low';
            return <div className="capacity-member" key={member._id}><div className="avatar">{member.name.charAt(0)}</div><div className="capacity-name"><strong>{member.name}</strong><span>{member.availability} · {member.openTasks} open task{member.openTasks === 1 ? '' : 's'}</span></div><div className={`capacity-meter ${level}`}><i style={{ width: `${Math.min(member.openTasks / 8 * 100, 100)}%` }} /></div></div>;
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
