import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  AlertTriangle, ArrowLeft, ArrowRight, Bell, Bot, Briefcase, CalendarDays,
  Check, CheckCircle2, Code2, Columns3, FileText, FolderKanban, Lightbulb,
  ListChecks, LogOut, Play, Plus, RefreshCw, Save, Sparkles, ThumbsUp,
  Timer, UserCheck, Workflow, X,
} from 'lucide-react';
import SharedStartDayPlanner, { type DayPlanResult } from './SharedStartDayPlanner';

type Persona = 'pm' | 'lead';
type Domain = 'ENGINEERING' | 'SALES' | 'MARKETING';
type View = 'desk' | 'projects' | 'blockers' | 'ideas' | 'agents';
type TaskStatus = 'todo' | 'in_progress' | 'review' | 'completed' | 'blocked';

interface DeliveryTask {
  id: string;
  title: string;
  projectId: string;
  project: string;
  domain: Domain;
  status: TaskStatus;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  estimate: string;
  assignee: string;
  module: string;
}

interface DeliveryProject {
  id: string;
  name: string;
  domain: Domain;
  description: string;
  lead: string;
  progress: number;
  status: string;
  due: string;
  members: string[];
  docs: Array<{ title: string; type: string }>;
  caseStudy?: string;
}

const domains: Record<Domain, { label: string; metrics: Array<{ label: string; value: string; sub: string; tone: string }>; schedule: Array<{ time: string; title: string; type: string; duration: string }> }> = {
  ENGINEERING: {
    label: 'Software engineering',
    metrics: [
      { label: 'Sprint velocity', value: '42 pts', sub: 'Sprint 24 · on track', tone: 'amber' },
      { label: 'Pending reviews', value: '3 PRs', sub: 'Average response 1.2h', tone: 'blue' },
      { label: 'Active bugs', value: '1 high', sub: 'Blocking the release', tone: 'rose' },
      { label: 'Team load', value: '76%', sub: '2 people near capacity', tone: 'green' },
    ],
    schedule: [
      { time: '09:30', title: 'Engineering daily stand-up', type: 'Team sync', duration: '15m' },
      { time: '11:00', title: 'Agent workflow architecture review', type: 'Tech review', duration: '45m' },
      { time: '15:30', title: 'Sprint 24 pull-request grooming', type: 'Delivery', duration: '30m' },
    ],
  },
  SALES: {
    label: 'Sales & business development',
    metrics: [
      { label: 'Outbound reach-outs', value: '28 / 40', sub: '70% of today’s goal', tone: 'green' },
      { label: 'Calls and demos', value: '4 today', sub: 'Next call at 14:00', tone: 'blue' },
      { label: 'Quarterly pipeline', value: '$140.5k', sub: '82% achieved', tone: 'amber' },
      { label: 'Deals at risk', value: '2', sub: 'Need leadership action', tone: 'rose' },
    ],
    schedule: [
      { time: '09:15', title: 'Pipeline and call alignment', type: 'Team sync', duration: '15m' },
      { time: '10:30', title: 'Outbound prospecting block', type: 'Routine', duration: '60m' },
      { time: '14:00', title: 'Discovery call with Atlas Retail CTO', type: 'Client', duration: '45m' },
    ],
  },
  MARKETING: {
    label: 'Marketing & growth',
    metrics: [
      { label: 'Live campaigns', value: '5 active', sub: 'Average ROAS 4.2x', tone: 'purple' },
      { label: 'Content due', value: '4 assets', sub: '2 under review', tone: 'blue' },
      { label: 'Inbound leads', value: '1,420', sub: '+18% this month', tone: 'green' },
      { label: 'Approvals waiting', value: '3', sub: 'Copy and design', tone: 'rose' },
    ],
    schedule: [
      { time: '09:30', title: 'Marketing morning stand-up', type: 'Team sync', duration: '15m' },
      { time: '11:30', title: 'Product launch content review', type: 'Workshop', duration: '60m' },
      { time: '15:00', title: 'Paid channels performance sync', type: 'Analytics', duration: '30m' },
    ],
  },
};

const initialProjects: DeliveryProject[] = [
  { id: 'portal', name: 'Customer Portal V2', domain: 'ENGINEERING', description: 'Customer dashboard with real-time integrations, a shared design system and multi-tenant access.', lead: 'Govind (PM)', progress: 78, status: 'Active', due: 'Aug 18', members: ['Alex Rivera', 'Meera Nair', 'Anush MK'], docs: [{ title: 'API specification v2.1', type: 'Technical PRD' }, { title: 'Design tokens & UI system', type: 'Figma system' }] },
  { id: 'agents', name: 'Agent Operations Studio', domain: 'ENGINEERING', description: 'Planning and business-analysis agents with review, approval and document version controls.', lead: 'Anush MK (Tech Lead)', progress: 46, status: 'In review', due: 'Aug 8', members: ['Alex Rivera', 'Zoya Khan', 'Govind'], docs: [{ title: 'Agent workflow architecture', type: 'Technical spec' }, { title: 'Approval state contract', type: 'Decision record' }] },
  { id: 'atlas', name: 'Atlas Retail Enterprise Rollout', domain: 'SALES', description: 'Enterprise deployment and commercial rollout with a dedicated integration plan.', lead: 'Govind (PM)', progress: 75, status: 'Proposal', due: 'Aug 15', members: ['Govind', 'Aarav Shah'], docs: [{ title: 'Enterprise pitch deck', type: 'Slides' }, { title: 'Commercial SLA', type: 'Contract' }] },
  { id: 'launch', name: 'Global Product Launch', domain: 'MARKETING', description: 'Coordinated launch across press, email, product video and paid acquisition channels.', lead: 'Govind (PM)', progress: 90, status: 'Final stage', due: 'Aug 10', members: ['Zoya Khan', 'Meera Nair'], docs: [{ title: 'Brand guidelines 2026', type: 'Brand book' }] },
];

const initialTasks: DeliveryTask[] = [
  { id: 't1', title: 'Refactor auth token refresh handler in the API client', projectId: 'portal', project: 'Customer Portal V2', domain: 'ENGINEERING', status: 'in_progress', priority: 'Urgent', estimate: '2.5 hrs', assignee: 'Alex Rivera', module: 'Authentication' },
  { id: 't2', title: 'Review pull request #342 for the component library', projectId: 'portal', project: 'Customer Portal V2', domain: 'ENGINEERING', status: 'review', priority: 'Medium', estimate: '1 hr', assignee: 'Anush MK', module: 'Design system' },
  { id: 't3', title: 'Fix responsive navigation layout on mobile', projectId: 'portal', project: 'Customer Portal V2', domain: 'ENGINEERING', status: 'todo', priority: 'High', estimate: '1.5 hrs', assignee: 'Alex Rivera', module: 'Navigation' },
  { id: 't4', title: 'Connect agent approval history to the project workspace', projectId: 'agents', project: 'Agent Operations Studio', domain: 'ENGINEERING', status: 'in_progress', priority: 'High', estimate: '3 hrs', assignee: 'Zoya Khan', module: 'Agent review' },
  { id: 't5', title: 'Resolve staging CORS configuration with DevOps', projectId: 'portal', project: 'Customer Portal V2', domain: 'ENGINEERING', status: 'blocked', priority: 'Urgent', estimate: '1 hr', assignee: 'Meera Nair', module: 'Infrastructure' },
  { id: 't6', title: 'Log discovery outcomes from Atlas Retail CTO call', projectId: 'atlas', project: 'Atlas Retail Enterprise Rollout', domain: 'SALES', status: 'in_progress', priority: 'Urgent', estimate: '1 hr', assignee: 'Aarav Shah', module: 'Discovery' },
  { id: 't7', title: 'Finalize copy for the product launch email', projectId: 'launch', project: 'Global Product Launch', domain: 'MARKETING', status: 'review', priority: 'Medium', estimate: '2 hrs', assignee: 'Zoya Khan', module: 'Email campaign' },
];

const statusLabel: Record<TaskStatus, string> = { todo: 'To do', in_progress: 'In progress', review: 'Review', completed: 'Completed', blocked: 'Blocked' };
const formatTimer = (seconds: number) => [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60].map((part) => String(part).padStart(2, '0')).join(':');

const DeliveryDialog = ({ title, description, icon, wide, onClose, children }: { title: string; description: string; icon: ReactNode; wide?: boolean; onClose: () => void; children: ReactNode }) => (
  <div className="dl-dialog-backdrop" onMouseDown={onClose}>
    <section className={`dl-dialog ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
      <header><span>{icon}</span><div><h2>{title}</h2><p>{description}</p></div><button type="button" aria-label="Close" onClick={onClose}><X size={18}/></button></header>
      {children}
    </section>
  </div>
);

const DeliveryLeadershipDemo = () => {
  const [persona, setPersona] = useState<Persona>('pm');
  const [domain, setDomain] = useState<Domain>('ENGINEERING');
  const [view, setView] = useState<View>('desk');
  const [projects, setProjects] = useState(initialProjects);
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [dayStarted, setDayStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [startTime, setStartTime] = useState('');
  const [modal, setModal] = useState<'launch' | 'task' | 'start' | 'finish' | 'blocker' | null>(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 'n1', title: 'Agent plan ready', detail: 'Content Engine plan is ready for Govind’s review.', time: '6m' },
    { id: 'n2', title: 'Blocker escalated', detail: 'Meera needs staging access for Customer Portal V2.', time: '18m' },
    { id: 'n3', title: 'Task moved to review', detail: 'Alex submitted PR #342 for Anush.', time: '41m' },
  ]);
  const [blockers, setBlockers] = useState([{ id: 'b1', title: 'Staging CORS configuration is blocking integration testing', project: 'Customer Portal V2', severity: 'Critical', reporter: 'Meera Nair', owner: 'Anush MK', status: 'Open' }]);
  const [ideas, setIdeas] = useState([{ id: 'i1', title: 'Automated accessibility pre-review for every pull request', description: 'Catch common accessibility issues before human review.', author: 'Alex Rivera', votes: 38, voted: true }]);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskProjectId, setTaskProjectId] = useState('portal');
  const [taskAssignee, setTaskAssignee] = useState('Alex Rivera');
  const [blockerText, setBlockerText] = useState('');
  const [ideaText, setIdeaText] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectBrief, setProjectBrief] = useState('');
  const [generating, setGenerating] = useState(false);
  const [breakdown, setBreakdown] = useState<Array<{ module: string; tasks: string[] }> | null>(null);
  const [pmPrompt, setPmPrompt] = useState('Turn an approved project brief into clear features, executable tasks, acceptance criteria, owners and realistic estimate ranges. Surface assumptions and risks for review.');
  const [baPrompt, setBaPrompt] = useState('Create concise business and technical documentation from the approved project plan. Keep requirements testable, decisions traceable and language accessible.');
  const [promptSaved, setPromptSaved] = useState(false);

  useEffect(() => {
    if (!dayStarted) return;
    const interval = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [dayStarted]);

  const currentName = persona === 'pm' ? 'Govind' : 'Anush';
  const currentRole = persona === 'pm' ? 'Project Manager' : 'Tech Lead';
  const config = domains[domain];
  const domainProjects = projects.filter((project) => project.domain === domain);
  const domainTasks = tasks.filter((task) => task.domain === domain);
  const selectedProject = projects.find((project) => project.id === selectedProjectId) || projects[0];
  const projectTasks = tasks.filter((task) => task.projectId === selectedProject.id);

  const broadcast = (title: string, detail: string) => setNotifications((current) => [{ id: String(Date.now()), title, detail, time: 'Now' }, ...current]);

  const updateTask = (id: string, status: TaskStatus) => setTasks((current) => current.map((task) => task.id === id ? { ...task, status } : task));

  const addTask = (event: FormEvent) => {
    event.preventDefault();
    if (!taskTitle.trim()) return;
    const project = projects.find((item) => item.id === taskProjectId) || projects[0];
    setTasks((current) => [{ id: String(Date.now()), title: taskTitle.trim(), projectId: project.id, project: project.name, domain: project.domain, status: 'todo', priority: 'High', estimate: '2 hrs', assignee: taskAssignee, module: 'New work' }, ...current]);
    broadcast('Task assigned', `${currentName} assigned “${taskTitle.trim()}” to ${taskAssignee}.`);
    setTaskTitle(''); setModal(null);
  };

  const startPlannedDay = (plan: DayPlanResult) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setTasks((current) => {
      const existingIds = new Set(current.map((task) => task.id));
      const added: DeliveryTask[] = plan.tasks.filter((task) => !existingIds.has(task.id)).map((task) => {
        const project = projects.find((item) => item.name === task.project) || projects[0];
        return { id: task.id, title: task.title, projectId: project.id, project: project.name, domain: project.domain, status: 'todo', priority: task.priority === 'Critical' ? 'Urgent' : task.priority, estimate: task.estimate || '1 hr', assignee: currentName, module: 'Daily plan' };
      });
      return [...added, ...current];
    });
    setDayStarted(true);
    setStartTime(time);
    setModal(null);
    broadcast('Workday started', `${currentName} committed to ${plan.tasks.length} priority tasks.`);
  };

  const reportBlocker = (event: FormEvent) => {
    event.preventDefault();
    if (!blockerText.trim()) return;
    const project = projects.find((item) => item.id === taskProjectId) || projects[0];
    setBlockers((current) => [{ id: String(Date.now()), title: blockerText.trim(), project: project.name, severity: 'High', reporter: currentName, owner: persona === 'pm' ? 'Anush MK' : 'Govind', status: 'Open' }, ...current]);
    broadcast('Blocker reported', `${currentName} escalated a blocker on ${project.name}.`);
    setBlockerText(''); setModal(null); setView('blockers');
  };

  const generateBreakdown = () => {
    if (!projectName.trim() || !projectBrief.trim()) return;
    setGenerating(true);
    window.setTimeout(() => {
      setBreakdown([
        { module: 'Scope and architecture', tasks: ['Confirm actors, permissions and success measures', 'Define data model and API contracts'] },
        { module: 'Core implementation', tasks: ['Build the primary workflow and approval states', 'Add validation, error and empty states'] },
        { module: 'Quality and release', tasks: ['Complete acceptance testing', 'Prepare rollout notes and operating guide'] },
      ]);
      setGenerating(false);
    }, 700);
  };

  const launchProject = () => {
    if (!projectName.trim()) return;
    const id = `project-${Date.now()}`;
    const generatedTasks: DeliveryTask[] = (breakdown || []).flatMap((group, groupIndex) => group.tasks.map((title, index) => ({ id: `${id}-${groupIndex}-${index}`, title, projectId: id, project: projectName.trim(), domain, status: 'todo' as const, priority: index === 0 ? 'High' as const : 'Medium' as const, estimate: index === 0 ? '3 hrs' : '2 hrs', assignee: index === 0 ? 'Alex Rivera' : 'Zoya Khan', module: group.module })));
    setProjects((current) => [{ id, name: projectName.trim(), domain, description: projectBrief.trim(), lead: `${currentName} (${currentRole})`, progress: 0, status: 'Planning', due: 'Sep 4', members: [currentName, 'Alex Rivera', 'Zoya Khan'], docs: [{ title: 'Initial scope and technical brief', type: 'PM Agent draft' }] }, ...current]);
    setTasks((current) => [...generatedTasks, ...current]);
    broadcast('Project launched', `${currentName} created “${projectName.trim()}” with ${generatedTasks.length} generated tasks.`);
    setProjectName(''); setProjectBrief(''); setBreakdown(null); setModal(null);
  };

  const nav: Array<{ id: View; label: string; icon: typeof Briefcase; count?: number }> = [
    { id: 'desk', label: 'Delivery desk', icon: Workflow },
    { id: 'projects', label: 'Projects & boards', icon: FolderKanban, count: domainProjects.length },
    { id: 'blockers', label: 'Blockers', icon: AlertTriangle, count: blockers.length },
    { id: 'agents', label: 'Agent controls', icon: Bot, count: 2 },
  ];

  const TaskRow = ({ task }: { task: DeliveryTask }) => <article className={`dl-task-row ${task.status}`}>
    <span className="dl-person-avatar">{task.assignee.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span>
    <div><strong>{task.title}</strong><p>{task.project} · {task.module}</p><div><span>{task.assignee}</span><span className={task.priority.toLowerCase()}>{task.priority}</span><span><Timer size={12}/>{task.estimate}</span></div></div>
    <select value={task.status} onChange={(event) => updateTask(task.id, event.target.value as TaskStatus)} aria-label={`Status for ${task.title}`}>{Object.entries(statusLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
  </article>;

  return <div className="dl-demo animate-fade-in">
    <header className="dl-hero">
      <div><span className="dl-kicker"><Workflow size={15}/>Delivery leadership workspace</span><h1>Good day, {currentName}</h1><p>{persona === 'pm' ? 'Turn agent drafts and team updates into clear ownership, dates and delivery decisions.' : 'Keep technical work reviewable, remove dependencies and protect release quality.'}</p></div>
      <div className="dl-hero-controls">
        <div className="dl-persona-toggle"><button className={persona === 'pm' ? 'active' : ''} onClick={() => setPersona('pm')}><Workflow size={15}/><span>Govind<strong>PM</strong></span></button><button className={persona === 'lead' ? 'active' : ''} onClick={() => setPersona('lead')}><Code2 size={15}/><span>Anush<strong>Tech Lead</strong></span></button></div>
        <label className="dl-domain-select"><span>Department</span><select value={domain} onChange={(event) => setDomain(event.target.value as Domain)}><option value="ENGINEERING">Engineering</option><option value="SALES">Sales & BD</option><option value="MARKETING">Marketing</option></select></label>
      </div>
    </header>

    <section className="dl-command-bar">
      <nav>{nav.map(({ id, label, icon: Icon, count }) => <button className={`${view === id ? 'active' : ''} ${id === 'blockers' ? 'blocker-nav' : ''}`.trim()} onClick={() => setView(id)} key={id}><Icon size={15}/><span>{label}</span>{count !== undefined && <b>{count}</b>}</button>)}</nav>
      <div className="dl-command-actions">
        <div className="dl-notifications"><button aria-label="Notifications" onClick={() => setNotificationOpen(!notificationOpen)}><Bell size={16}/><i/></button>{notificationOpen && <aside><header><strong>Team broadcast feed</strong><button onClick={() => setNotifications([])}>Clear all</button></header>{notifications.length ? notifications.map((item) => <article key={item.id}><span/><div><strong>{item.title}</strong><p>{item.detail}</p></div><small>{item.time}</small></article>) : <p className="dl-empty">No unread updates.</p>}</aside>}</div>
        <button className="dl-blocker-action" onClick={() => setModal('blocker')}><AlertTriangle size={15}/>Report blocker</button>
        <button className="dl-launch" onClick={() => setModal('launch')}><Plus size={15}/>Add project</button>
        {dayStarted ? <div className="dl-session"><i/><span><small>Started {startTime}</small><strong>{formatTimer(elapsed)}</strong></span><button onClick={() => setModal('finish')}><LogOut size={14}/></button></div> : <button className="dl-start" onClick={() => setModal('start')}><Play size={14}/>Start day</button>}
      </div>
    </section>

    {view === 'desk' && <>
      <section className="dl-metrics">{config.metrics.map((metric) => <article className={metric.tone} key={metric.label}><span/>
        <div><small>{metric.label}</small><strong>{metric.value}</strong><p>{metric.sub}</p></div>
      </article>)}</section>
      <section className="dl-schedule"><header><span><CalendarDays size={16}/>Today’s team schedule</span><small>Friday, July 31 · {config.label}</small></header><div>{config.schedule.map((item) => <article key={item.time}><time>{item.time}</time><div><strong>{item.title}</strong><p>{item.type} · {item.duration}</p></div></article>)}</div></section>
      <div className="dl-desk-grid">
        <section className="dl-work-panel"><header><div><span><ListChecks size={17}/>Team work focus</span><p>{persona === 'pm' ? 'Tasks across the department that need coordination.' : 'Technical work that needs review or dependency support.'}</p></div><button onClick={() => setModal('task')}><Plus size={15}/>Assign task</button></header><div className="dl-work-summary"><span><strong>{domainTasks.filter((task) => task.status === 'in_progress').length}</strong> in progress</span><span><strong>{domainTasks.filter((task) => task.status === 'review').length}</strong> waiting review</span><span className="danger"><strong>{domainTasks.filter((task) => task.status === 'blocked').length}</strong> blocked</span></div><div className="dl-task-list">{domainTasks.map((task) => <TaskRow task={task} key={task.id}/>)}</div></section>
        <aside className="dl-side-stack"><section className="dl-agent-queue"><header><span><Bot size={16}/>Agent review queue</span><b>2</b></header><article><span>PM</span><div><strong>Content Engine plan</strong><p>Features, tasks and estimates ready</p></div><button><ArrowRight size={14}/></button></article><article><span>BA</span><div><strong>Agent Studio BRD</strong><p>Document version ready for approval</p></div><button><ArrowRight size={14}/></button></article><button onClick={() => setView('agents')}>Open agent controls<ArrowRight size={14}/></button></section><section className="dl-project-rail"><header><span>Active projects</span><button onClick={() => setView('projects')}>View all</button></header>{domainProjects.map((project) => <button key={project.id} onClick={() => { setSelectedProjectId(project.id); setView('projects'); }}><div><strong>{project.name}</strong><p>{project.lead} · due {project.due}</p></div><span><i style={{ width: `${project.progress}%` }}/></span><b>{project.progress}%</b></button>)}</section></aside>
      </div>
    </>}

    {view === 'projects' && <section className="dl-page">
      {selectedProjectId && selectedProject.domain === domain ? <>
        <button className="dl-back" onClick={() => setSelectedProjectId('')}><ArrowLeft size={15}/>All {config.label} projects</button>
        <header className="dl-project-hero"><div><span>{selectedProject.status}</span><h2>{selectedProject.name}</h2><p>{selectedProject.description}</p><div>{selectedProject.members.map((name) => <b key={name}><UserCheck size={13}/>{name}</b>)}</div></div><aside><small>Overall progress</small><strong>{selectedProject.progress}%</strong><span><i style={{ width: `${selectedProject.progress}%` }}/></span><p>{selectedProject.lead} · due {selectedProject.due}</p></aside></header>
        <div className="dl-project-layout"><section className="dl-kanban"><header><span><Columns3 size={16}/>Project task board</span><button onClick={() => setModal('task')}><Plus size={14}/>Add task</button></header><div>{(['todo', 'in_progress', 'review', 'completed'] as TaskStatus[]).map((status) => <section className={status} key={status}><header><span>{statusLabel[status]}</span><b>{projectTasks.filter((task) => task.status === status).length}</b></header>{projectTasks.filter((task) => task.status === status).map((task) => <article key={task.id}><strong>{task.title}</strong><p>{task.module}</p><div><span>{task.assignee}</span><small>{task.estimate}</small></div><select value={task.status} onChange={(event) => updateTask(task.id, event.target.value as TaskStatus)}>{Object.entries(statusLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></article>)}</section>)}</div></section><aside className="dl-docs"><header><span><FileText size={16}/>Project guidance</span><small>Approved references</small></header>{selectedProject.docs.map((doc) => <button key={doc.title}><FileText size={15}/><span><strong>{doc.title}</strong><small>{doc.type}</small></span><ArrowRight size={14}/></button>)}<button className="dl-case-study" onClick={() => setProjects((current) => current.map((project) => project.id === selectedProject.id ? { ...project, caseStudy: 'Case study draft created with executive summary, delivery outcomes, architecture decisions and scene-by-scene demo video guidance.' } : project))}><Bot size={15}/>{selectedProject.caseStudy ? 'Regenerate case study' : 'Generate case study & demo script'}</button>{selectedProject.caseStudy && <article className="dl-generated-doc"><span>BA Agent draft</span><p>{selectedProject.caseStudy}</p><button><Check size={14}/>Ready for review</button></article>}</aside></div>
      </> : <><header className="dl-page-header"><div><span className="dl-kicker"><Briefcase size={15}/>Department delivery</span><h2>Projects and task boards</h2><p>Select a project to open its work, team, documents and agent outputs.</p></div><button onClick={() => setModal('launch')}><Plus size={15}/>Create project</button></header><div className="dl-project-grid">{domainProjects.map((project) => <article key={project.id}><header><span>{project.status}</span><small>Due {project.due}</small></header><h3>{project.name}</h3><p>{project.description}</p><div className="dl-card-progress"><span><i style={{ width: `${project.progress}%` }}/></span><b>{project.progress}%</b></div><footer><span>{project.lead}</span><button onClick={() => setSelectedProjectId(project.id)}>Open workspace<ArrowRight size={14}/></button></footer></article>)}</div></>}
    </section>}

    {view === 'blockers' && <section className="dl-page"><header className="dl-page-header"><div><span className="dl-kicker danger"><AlertTriangle size={15}/>Delivery support</span><h2>Blockers and impediments</h2><p>One place for ownership, follow-up and resolution.</p></div><button className="danger" onClick={() => setModal('blocker')}><Plus size={15}/>Report blocker</button></header><div className="dl-blocker-list">{blockers.map((blocker) => <article key={blocker.id}><span><AlertTriangle size={17}/></span><div><small>{blocker.severity} · {blocker.project}</small><strong>{blocker.title}</strong><p>Reported by {blocker.reporter} · owner: {blocker.owner}</p></div><button onClick={() => setBlockers((current) => current.filter((item) => item.id !== blocker.id))}><CheckCircle2 size={14}/>Resolve</button></article>)}</div></section>}

    {view === 'ideas' && <section className="dl-page"><header className="dl-page-header"><div><span className="dl-kicker"><Lightbulb size={15}/>Team innovation</span><h2>Idea bucket</h2><p>Review workflow improvements before they become planned work.</p></div><form onSubmit={(event) => { event.preventDefault(); if (!ideaText.trim()) return; setIdeas((current) => [{ id: String(Date.now()), title: ideaText.trim(), description: 'New delivery improvement proposed for team review.', author: currentName, votes: 1, voted: true }, ...current]); setIdeaText(''); }}><input value={ideaText} onChange={(event) => setIdeaText(event.target.value)} placeholder="Pitch a concise idea"/><button><Plus size={15}/>Add idea</button></form></header><div className="dl-ideas-grid">{ideas.map((idea) => <article key={idea.id}><span>Under review</span><h3>{idea.title}</h3><p>{idea.description}</p><footer><small>Proposed by {idea.author}</small><button className={idea.voted ? 'voted' : ''} onClick={() => setIdeas((current) => current.map((item) => item.id === idea.id ? { ...item, voted: !item.voted, votes: item.votes + (item.voted ? -1 : 1) } : item))}><ThumbsUp size={14}/>{idea.votes}</button></footer></article>)}</div></section>}

    {view === 'agents' && <section className="dl-page"><header className="dl-page-header"><div><span className="dl-kicker purple"><Bot size={15}/>Governed AI workspace</span><h2>Agent controls</h2><p>PM, Tech Lead and CEO can adjust prompts. Changes should remain versioned and visible.</p></div>{promptSaved && <span className="dl-saved"><Check size={14}/>Draft prompts saved</span>}</header><div className="dl-agent-grid"><article><header><span><Workflow size={17}/>Project Manager Agent</span><b>Active</b></header><p>Creates the initial feature and executable-task plan when a project is added.</p><label><span>System prompt</span><textarea value={pmPrompt} onChange={(event) => setPmPrompt(event.target.value)} rows={8}/></label><footer><small>Last edited by Govind · version 4</small><button onClick={() => { setPromptSaved(true); window.setTimeout(() => setPromptSaved(false), 2200); }}><Save size={14}/>Save new version</button></footer></article><article><header><span><FileText size={17}/>Business Analyst Agent</span><b>Active</b></header><p>Creates and maintains approved project requirements and technical guidance.</p><label><span>System prompt</span><textarea value={baPrompt} onChange={(event) => setBaPrompt(event.target.value)} rows={8}/></label><footer><small>Last edited by Anush · version 3</small><button onClick={() => { setPromptSaved(true); window.setTimeout(() => setPromptSaved(false), 2200); }}><Save size={14}/>Save new version</button></footer></article></div></section>}

    {modal === 'start' && <DeliveryDialog wide title="Start my day" description="The same priority planning flow is available to PM, Tech Lead, CEO and every team member." icon={<Play size={18}/>} onClose={() => setModal(null)}><SharedStartDayPlanner tasks={domainTasks.filter((task) => task.status !== 'completed').map((task) => ({ id: task.id, title: task.title, project: task.project, priority: task.priority === 'Urgent' ? 'Critical' : task.priority, estimate: task.estimate, carriedOver: task.assignee === currentName && task.status === 'in_progress', selected: task.assignee === currentName }))} projects={domainProjects.map((project) => project.name)} defaultFocus={persona === 'pm' ? 'Clear delivery decisions, approve priority work and remove the most important blocker.' : 'Complete technical reviews and unblock the highest-risk integration work.'} onCancel={() => setModal(null)} onStart={startPlannedDay}/></DeliveryDialog>}
    {modal === 'finish' && <DeliveryDialog title="Close the leadership workday" description="Capture decisions, completed outcomes and handover context." icon={<LogOut size={18}/>} onClose={() => setModal(null)}><div className="dl-simple-dialog"><label><span>Completed outcomes and decisions</span><textarea rows={4} placeholder="What changed because of today’s work?"/></label><label><span>Blockers or remarks</span><textarea rows={3} placeholder="What needs follow-up tomorrow?"/></label><footer><button onClick={() => setModal(null)}>Keep working</button><button onClick={() => { setDayStarted(false); setModal(null); broadcast('Workday closed', `${currentName} published today’s delivery closeout.`); }}>Save & log off</button></footer></div></DeliveryDialog>}
    {modal === 'task' && <DeliveryDialog title="Assign an executable task" description="Every task needs a project, owner and clear finish line." icon={<ListChecks size={18}/>} onClose={() => setModal(null)}><form className="dl-form" onSubmit={addTask}><label><span>Task title</span><input autoFocus value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Describe the expected outcome"/></label><div><label><span>Project</span><select value={taskProjectId} onChange={(event) => setTaskProjectId(event.target.value)}>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label><label><span>Assignee</span><select value={taskAssignee} onChange={(event) => setTaskAssignee(event.target.value)}>{['Alex Rivera', 'Meera Nair', 'Zoya Khan', 'Aarav Shah'].map((name) => <option key={name}>{name}</option>)}</select></label></div><footer><button type="button" onClick={() => setModal(null)}>Cancel</button><button>Assign task</button></footer></form></DeliveryDialog>}
    {modal === 'blocker' && <DeliveryDialog title="Report a delivery blocker" description="The PM and Tech Lead will see this in the same shared queue." icon={<AlertTriangle size={18}/>} onClose={() => setModal(null)}><form className="dl-form" onSubmit={reportBlocker}><label><span>What is blocked?</span><textarea autoFocus rows={4} value={blockerText} onChange={(event) => setBlockerText(event.target.value)} placeholder="State what cannot continue and what is needed"/></label><label><span>Project</span><select value={taskProjectId} onChange={(event) => setTaskProjectId(event.target.value)}>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label><footer><button type="button" onClick={() => setModal(null)}>Cancel</button><button className="danger">Report blocker</button></footer></form></DeliveryDialog>}
    {modal === 'launch' && <DeliveryDialog wide title="Launch a project with the PM Agent" description="Enter the rough goal, review the generated breakdown, then publish it to the team." icon={<Sparkles size={18}/>} onClose={() => setModal(null)}><div className="dl-launch-flow"><section><label><span>Project title</span><input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="e.g. AI Support Gateway"/></label><label><span>Rough goal and scope</span><textarea rows={5} value={projectBrief} onChange={(event) => setProjectBrief(event.target.value)} placeholder="What should this project achieve, for whom, and by when?"/></label><button disabled={generating || !projectName.trim() || !projectBrief.trim()} onClick={generateBreakdown}>{generating ? <RefreshCw className="spin" size={15}/> : <Bot size={15}/>} {generating ? 'Preparing breakdown…' : 'Generate project breakdown'}</button></section><section className="dl-breakdown"><header><span>PM Agent draft</span><small>{breakdown ? 'Ready for your review' : 'Waiting for a project brief'}</small></header>{breakdown ? breakdown.map((group, index) => <article key={group.module}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{group.module}</strong>{group.tasks.map((item) => <p key={item}><Check size={12}/>{item}</p>)}</div></article>) : <div className="dl-breakdown-empty"><Bot size={22}/><p>The generated features and tasks will appear here before anything is published.</p></div>}</section></div><footer className="dl-launch-footer"><span>{breakdown ? `${breakdown.reduce((sum, group) => sum + group.tasks.length, 0)} executable tasks prepared` : 'Nothing will be published without approval'}</span><div><button onClick={() => setModal(null)}>Cancel</button><button disabled={!breakdown} onClick={launchProject}><Check size={14}/>Approve & launch project</button></div></footer></DeliveryDialog>}
  </div>;
};

export default DeliveryLeadershipDemo;
