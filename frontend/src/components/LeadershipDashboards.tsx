import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowUpRight, Bot, CalendarClock, CheckCircle2, CircleDot,
  Clock3, FolderKanban, Gauge, ListChecks, Target, UserRoundX, Users,
} from 'lucide-react';
import type { AgentReviewQueueItem } from '../api/agentWorkflowApi';
import type { ProjectTask } from '../api/projectTaskApi';
import type { Workday } from '../api/workdayApi';
import type { Project } from '../types';

interface CapacityMember { _id: string; name: string; department?: string | null; availability: string; openTasks: number; overdueTasks: number }
interface Blocker { project: Project; task: ProjectTask }
interface Unassigned { project: Project; task: ProjectTask }
interface DashboardData {
  name: string;
  projects: Project[];
  risks: Project[];
  blockers: Blocker[];
  unassigned: Unassigned[];
  capacity: CapacityMember[];
  agentQueue: AgentReviewQueueItem[];
  workday: Workday | null;
}

const dateLabel = () => new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const dueLabel = (project: Project) => {
  const value = project.deadline || project.estimatedCompletionDate;
  return value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date';
};

const RoleHeader = ({ eyebrow, title, description, action, workday }: { eyebrow: string; title: string; description: string; action: string; workday: Workday | null }) => (
  <header className="role-hero"><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div><div className="role-hero-side"><small>{dateLabel()}</small><div className="role-hero-actions"><Link to="/workday" className="role-start-day">{workday ? <Target size={14}/> : <CircleDot size={14}/>}<span>{workday?.status === 'Completed' ? 'View my day' : workday ? 'Update my day' : 'Start my day'}</span></Link><Link to="/projects">{action}<ArrowUpRight size={14}/></Link></div></div></header>
);

const Metric = ({ to, icon: Icon, value, label, tone = '' }: { to: string; icon: typeof CircleDot; value: string | number; label: string; tone?: string }) => (
  <Link to={to} className={`role-metric ${tone}`}><span><Icon size={15}/></span><strong>{value}</strong><small>{label}</small><ArrowUpRight size={12}/></Link>
);

const ProjectRows = ({ projects }: { projects: Project[] }) => (
  <div className="role-project-rows">{projects.slice(0, 6).map((project) => <Link to={`/projects/${project._id}`} key={project._id}><div className="role-project-name"><span>{project.name.charAt(0)}</span><div><strong>{project.name}</strong><small>{project.status} · due {dueLabel(project)}</small></div></div><div className="role-project-progress"><span><i style={{ width: `${project.progress}%` }}/></span><b>{project.progress}%</b></div><ArrowUpRight size={13}/></Link>)}{!projects.length && <p className="role-empty">No active projects in this view.</p>}</div>
);

const CapacityRows = ({ people }: { people: CapacityMember[] }) => (
  <div className="role-capacity-rows">{people.slice(0, 6).map((person) => <Link to={`/team?member=${person._id}`} key={person._id}><span>{person.name.charAt(0)}</span><div><strong>{person.name}</strong><small>{person.department || 'General team'} · {person.availability} · {person.openTasks} open</small></div><b className={person.overdueTasks ? 'late' : ''}>{person.overdueTasks ? `${person.overdueTasks} late` : 'On track'}</b></Link>)}{!people.length && <p className="role-empty">No team load available.</p>}</div>
);

export const ProjectManagerDashboard = (data: DashboardData) => (
  <div className="role-dashboard pm-dashboard animate-fade-in">
    <RoleHeader eyebrow="Project manager workspace" title={`${data.name.split(' ')[0]}, decisions come first`} description="Approve agent work, resolve delivery risk, and make sure every task has a clear owner." action="Open all projects" workday={data.workday}/>
    <section className="role-metrics"><Metric to="/?queue=agents" icon={Bot} value={data.agentQueue.length} label="Agent drafts"/><Metric to="/projects" icon={AlertTriangle} value={data.risks.length} label="Projects at risk" tone="danger"/><Metric to="/projects" icon={UserRoundX} value={data.unassigned.length} label="Unassigned tasks"/><Metric to="/workday?view=team" icon={Users} value={data.capacity.filter((person) => person.overdueTasks > 0).length} label="People need support"/></section>
    <div className="role-primary-grid">
      <section className="role-focus-panel"><header><div><span><Bot size={15}/>Approval desk</span><small>Agent drafts remain private until you publish them.</small></div><b>{data.agentQueue.length}</b></header><div className="role-agent-list">{data.agentQueue.slice(0, 5).map((item) => <Link to={`/projects/${item.project?._id}?workspace=${item.workspace}`} key={item._id}><span>{item.agentType === 'Project Manager' ? 'PM' : 'BA'}</span><div><small>{item.agentType} agent · ready for review</small><strong>{item.project?.name || 'Project unavailable'}</strong></div><ArrowUpRight size={14}/></Link>)}{!data.agentQueue.length && <div className="role-clear"><CheckCircle2 size={17}/><span>No drafts waiting for approval.</span></div>}</div></section>
      <section className="role-day-card"><header><span>Team day</span><Link to="/workday?view=team">Open pulse</Link></header><div className="role-day-focus"><Target size={18}/><div><small>Your focus</small><strong>{data.workday?.focus || 'Set today’s management outcome'}</strong></div></div><CapacityRows people={data.capacity}/></section>
    </div>
    <div className="role-secondary-grid"><section className="role-surface"><header><div><span>Project delivery</span><small>Ordered by current urgency</small></div><Link to="/projects">View all</Link></header><ProjectRows projects={data.projects}/></section><section className="role-surface role-blocker-surface"><header><div><span>Blockers to resolve</span><small>Escalate ownership, not working hours</small></div><b>{data.blockers.length}</b></header><div className="role-blocker-list">{data.blockers.slice(0, 6).map(({ project, task }) => <Link to={`/projects/${project._id}`} key={task._id}><AlertTriangle size={13}/><div><strong>{task.title}</strong><small>{project.name} · {task.blockerReason || 'Blocker needs context'}</small></div><ArrowUpRight size={12}/></Link>)}{!data.blockers.length && <p className="role-empty">No active project blockers.</p>}</div></section></div>
  </div>
);

export const TechLeadDashboard = (data: DashboardData & { taskGroups: Array<{ project: Project; tasks: ProjectTask[] }> }) => {
  const reviewTasks = data.taskGroups.flatMap(({ project, tasks }) => tasks.filter((task) => task.status === 'In Review').map((task) => ({ project, task })));
  const dueSoon = data.taskGroups.flatMap(({ project, tasks }) => tasks.filter((task) => task.status !== 'Completed' && Boolean(task.dueDate)).map((task) => ({ project, task }))).sort((a, b) => (a.task.dueDate || '').localeCompare(b.task.dueDate || '')).slice(0, 6);
  return <div className="role-dashboard lead-dashboard animate-fade-in">
    <RoleHeader eyebrow="Tech lead workspace" title={`${data.name.split(' ')[0]}, keep delivery reviewable`} description="Focus on technical review, dependencies, blockers, and whether the next release is genuinely ready." action="Open delivery board" workday={data.workday}/>
    <section className="role-metrics"><Metric to="/projects" icon={ListChecks} value={reviewTasks.length} label="Waiting for review"/><Metric to="/projects" icon={AlertTriangle} value={data.blockers.length} label="Technical blockers" tone="danger"/><Metric to="/projects" icon={FolderKanban} value={data.projects.length} label="Assigned projects"/><Metric to="/" icon={Bot} value={data.agentQueue.length} label="Agent drafts"/></section>
    <div className="role-primary-grid lead-primary"><section className="role-focus-panel"><header><div><span><ListChecks size={15}/>Technical review queue</span><small>Check acceptance criteria before moving work forward.</small></div><b>{reviewTasks.length}</b></header><div className="role-review-list">{reviewTasks.slice(0, 7).map(({ project, task }) => <Link to={`/projects/${project._id}`} key={task._id}><span>{task.priority.slice(0,1)}</span><div><strong>{task.title}</strong><small>{project.name} · {task.assignedTo?.name || 'Unassigned'}</small></div><ArrowUpRight size={13}/></Link>)}{!reviewTasks.length && <div className="role-clear"><CheckCircle2 size={17}/><span>No tasks waiting for technical review.</span></div>}</div></section><section className="role-release-card"><header><span><Gauge size={15}/>Release readiness</span><small>Assigned work only</small></header><div className="release-score"><strong>{data.projects.length ? Math.round(data.projects.reduce((sum, project) => sum + project.progress, 0) / data.projects.length) : 0}%</strong><span>average completion</span></div><div className="release-signals"><span><i className="green"/>{reviewTasks.length} in review</span><span><i className="coral"/>{data.blockers.length} blocked</span><span><i className="gold"/>{dueSoon.length} scheduled</span></div></section></div>
    <div className="role-secondary-grid"><section className="role-surface"><header><div><span>Assigned delivery</span><small>Project health and next milestone</small></div><Link to="/projects">View all</Link></header><ProjectRows projects={data.projects}/></section><section className="role-surface"><header><div><span>Upcoming technical work</span><small>Nearest due dates</small></div><CalendarClock size={15}/></header><div className="role-blocker-list">{dueSoon.map(({ project, task }) => <Link to={`/projects/${project._id}`} key={task._id}><Clock3 size={13}/><div><strong>{task.title}</strong><small>{project.name} · {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : 'No date'}</small></div><ArrowUpRight size={12}/></Link>)}</div></section></div>
  </div>;
};

export const CeoDashboard = (data: DashboardData & { totalProjects: number; completedProjects: number; teamSize: number }) => {
  const completion = data.totalProjects ? Math.round(data.completedProjects / data.totalProjects * 100) : 0;
  return <div className="role-dashboard ceo-dashboard animate-fade-in">
    <RoleHeader eyebrow="CEO portfolio" title={`${data.name.split(' ')[0]}, see the company clearly`} description="Portfolio movement, delivery confidence, people pressure and agent governance—without dropping into every task." action="Explore portfolio" workday={data.workday}/>
    <div className="ceo-bento"><section className="ceo-health"><header><span>Company delivery</span><small>Live portfolio signal</small></header><div className="health-orbits"><div className="orbit active"><strong>{data.projects.length}</strong><span>active</span></div><div className="orbit complete"><strong>{completion}%</strong><span>delivered</span></div><div className="orbit risk"><strong>{data.risks.length}</strong><span>at risk</span></div></div><footer><span><i/>{data.teamSize} active people</span><Link to="/projects">Portfolio details<ArrowUpRight size={12}/></Link></footer></section><section className="ceo-decisions"><header><span>Needs your attention</span><b>{data.risks.length + data.blockers.length + data.agentQueue.length}</b></header><Link to="/?queue=agents"><Bot size={15}/><div><strong>{data.agentQueue.length} agent approvals</strong><small>Plans and documents waiting</small></div><ArrowUpRight size={13}/></Link><Link to="/projects"><AlertTriangle size={15}/><div><strong>{data.risks.length} delivery risks</strong><small>Dates or progress need a decision</small></div><ArrowUpRight size={13}/></Link><Link to="/workday?view=team"><Users size={15}/><div><strong>{data.capacity.filter((person) => person.overdueTasks > 0).length} capacity risks</strong><small>Balance outcomes before adding work</small></div><ArrowUpRight size={13}/></Link></section></div>
    <section className="role-metrics"><Metric to="/projects" icon={FolderKanban} value={data.totalProjects} label="Total projects"/><Metric to="/completed" icon={CheckCircle2} value={data.completedProjects} label="Completed"/><Metric to="/team" icon={Users} value={data.teamSize} label="Team members"/><Metric to="/?queue=agents" icon={Bot} value={data.agentQueue.length} label="Agent reviews"/></section>
    <div className="role-secondary-grid"><section className="role-surface"><header><div><span>Portfolio movement</span><small>Active work ordered by urgency</small></div><Link to="/projects">Open portfolio</Link></header><ProjectRows projects={data.projects}/></section><section className="role-surface"><header><div><span>Company load</span><small>Outcomes and overdue work by owner</small></div><Link to="/team">People</Link></header><CapacityRows people={data.capacity}/></section></div>
  </div>;
};
