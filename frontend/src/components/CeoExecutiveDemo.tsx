import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, BarChart3, Bot, Briefcase,
  CalendarDays, Check, CheckCircle2, Crown, FileText,
  FolderKanban, Lightbulb, LogOut, Play, Plus, RefreshCw, Save, ShieldCheck,
  Sparkles, ThumbsUp, Users, X, Zap,
} from 'lucide-react';
import SharedStartDayPlanner, { type DayPlanResult } from './SharedStartDayPlanner';
import { createDemoProject } from '../context/demoProjects';
import { useNavigate } from 'react-router-dom';

type Scope = 'ALL' | 'ENGINEERING' | 'SALES' | 'MARKETING';
type View = 'overview' | 'portfolio' | 'people' | 'risks' | 'ideas' | 'agents';
type Modal = 'launch' | 'start' | 'finish' | 'risk' | 'idea' | null;

interface ExecutiveProject {
  id: string;
  name: string;
  domain: Exclude<Scope, 'ALL'>;
  summary: string;
  lead: string;
  progress: number;
  health: 'On track' | 'Needs attention' | 'At risk';
  due: string;
  team: string[];
  openTasks: number;
  docs: number;
}

interface ExecutiveTask {
  id: string;
  title: string;
  projectId: string;
  assignee: string;
  status: 'To do' | 'In progress' | 'Review' | 'Done' | 'Blocked';
  estimate: string;
}

const initialProjects: ExecutiveProject[] = [
  { id: 'portal', name: 'Customer Portal V2', domain: 'ENGINEERING', summary: 'A faster, multi-tenant customer workspace with a unified design system.', lead: 'Govind · PM', progress: 78, health: 'On track', due: 'Aug 18', team: ['Alex', 'Meera', 'Anush'], openTasks: 7, docs: 5 },
  { id: 'agents', name: 'Agent Operations Studio', domain: 'ENGINEERING', summary: 'Reviewable PM and Business Analyst agents with approval history and versioning.', lead: 'Anush MK · Tech Lead', progress: 46, health: 'Needs attention', due: 'Aug 8', team: ['Zoya', 'Alex', 'Govind'], openTasks: 9, docs: 4 },
  { id: 'atlas', name: 'Atlas Retail Rollout', domain: 'SALES', summary: 'Enterprise implementation and commercial rollout for a strategic account.', lead: 'Govind · PM', progress: 75, health: 'On track', due: 'Aug 15', team: ['Aarav', 'Meera'], openTasks: 4, docs: 6 },
  { id: 'launch', name: 'Global Product Launch', domain: 'MARKETING', summary: 'Coordinated launch across product video, email, press and acquisition.', lead: 'Zoya · Growth Lead', progress: 90, health: 'On track', due: 'Aug 10', team: ['Zoya', 'Meera'], openTasks: 3, docs: 8 },
];

const initialTasks: ExecutiveTask[] = [
  { id: 't1', title: 'Refactor auth token refresh handler', projectId: 'portal', assignee: 'Alex Rivera', status: 'In progress', estimate: '2.5h' },
  { id: 't2', title: 'Resolve staging CORS configuration', projectId: 'portal', assignee: 'Meera Nair', status: 'Blocked', estimate: '1h' },
  { id: 't3', title: 'Publish agent approval history', projectId: 'agents', assignee: 'Zoya Khan', status: 'Review', estimate: '3h' },
  { id: 't4', title: 'Confirm Atlas rollout milestones', projectId: 'atlas', assignee: 'Aarav Shah', status: 'In progress', estimate: '1h' },
  { id: 't5', title: 'Approve launch film storyboards', projectId: 'launch', assignee: 'Zoya Khan', status: 'Review', estimate: '1.5h' },
];

const initialPeople = [
  { name: 'Govind', role: 'Project Manager', domain: 'Delivery', state: 'Working', since: '09:02', load: 78, tasks: 6 },
  { name: 'Anush MK', role: 'Tech Lead', domain: 'Engineering', state: 'Working', since: '09:11', load: 84, tasks: 7 },
  { name: 'Alex Rivera', role: 'Frontend Engineer', domain: 'Engineering', state: 'Working', since: '09:08', load: 72, tasks: 5 },
  { name: 'Meera Nair', role: 'Backend Engineer', domain: 'Engineering', state: 'Working', since: '09:16', load: 66, tasks: 4 },
  { name: 'Aarav Shah', role: 'Business Development', domain: 'Sales', state: 'On client call', since: '09:20', load: 81, tasks: 6 },
  { name: 'Zoya Khan', role: 'Product Designer', domain: 'Marketing', state: 'Working', since: '08:56', load: 59, tasks: 3 },
];

const scopeCopy: Record<Scope, { label: string; sub: string; schedule: Array<{ time: string; title: string; type: string }> }> = {
  ALL: { label: 'Executive · all departments', sub: 'One calm view of delivery, capacity and decisions.', schedule: [{ time: '09:00', title: 'Executive committee briefing', type: 'Executive sync' }, { time: '11:00', title: 'Agent Studio delivery review', type: 'Cross-team' }, { time: '16:00', title: 'Company all-hands & idea review', type: 'All hands' }] },
  ENGINEERING: { label: 'Software engineering', sub: 'Release health, team capacity and technical risk.', schedule: [{ time: '09:30', title: 'Engineering daily stand-up', type: 'Team sync' }, { time: '11:00', title: 'Architecture review', type: 'Tech review' }, { time: '15:30', title: 'Sprint delivery review', type: 'Delivery' }] },
  SALES: { label: 'Sales & business development', sub: 'Pipeline movement, commitments and account risk.', schedule: [{ time: '09:15', title: 'Pipeline alignment', type: 'Team sync' }, { time: '14:00', title: 'Atlas Retail CTO call', type: 'Client' }, { time: '16:30', title: 'Commercial follow-up', type: 'Review' }] },
  MARKETING: { label: 'Marketing & growth', sub: 'Campaign velocity, approvals and launch readiness.', schedule: [{ time: '09:30', title: 'Growth stand-up', type: 'Team sync' }, { time: '11:30', title: 'Launch content review', type: 'Workshop' }, { time: '15:00', title: 'Paid channels sync', type: 'Analytics' }] },
};

const initialRisks = [
  { id: 'r1', severity: 'Critical', title: 'Staging CORS configuration is blocking portal validation', project: 'Customer Portal V2', owner: 'DevOps', age: '3h' },
  { id: 'r2', severity: 'High', title: 'Interview scoring rubric still needs leadership approval', project: 'AI Recruitment Platform', owner: 'Govind', age: '1d' },
];

const initialIdeas = [
  { id: 'i1', title: 'Automated accessibility and PR review assistant', author: 'Alex Rivera', summary: 'Catch accessibility gaps and missing documentation before human review.', votes: 38, status: 'Under review' },
  { id: 'i2', title: 'Customer onboarding progress room', author: 'Meera Nair', summary: 'Give every new account a shared checklist and a visible implementation owner.', votes: 24, status: 'Shortlisted' },
];

const formatTimer = (seconds: number) => [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60].map((part) => String(part).padStart(2, '0')).join(':');

const CeoDialog = ({ title, description, icon, wide, onClose, children }: { title: string; description: string; icon: ReactNode; wide?: boolean; onClose: () => void; children: ReactNode }) => (
  <div className="ce-dialog-backdrop" onMouseDown={onClose}>
    <section className={`ce-dialog ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
      <header><span>{icon}</span><div><h2>{title}</h2><p>{description}</p></div><button type="button" aria-label="Close" onClick={onClose}><X size={19}/></button></header>
      {children}
    </section>
  </div>
);

const CeoExecutiveDemo = ({ planRequest }: { planRequest?: string }) => {
  const navigate = useNavigate();
  const [scope, setScope] = useState<Scope>('ALL');
  const [view, setView] = useState<View>('overview');
  const [projects, setProjects] = useState(initialProjects);
  const [tasks, setTasks] = useState(initialTasks);
  const [risks, setRisks] = useState(initialRisks);
  const [ideas, setIdeas] = useState(initialIdeas);
  const [selectedProject, setSelectedProject] = useState('agents');
  const [, setNotifications] = useState([
    { id: 'n1', title: 'PM Agent plan ready', detail: 'Content Engine scope is ready for approval.', time: '8m' },
    { id: 'n2', title: 'Critical blocker escalated', detail: 'Portal staging validation is waiting on DevOps.', time: '42m' },
    { id: 'n3', title: 'Project moved forward', detail: 'Global Product Launch reached 90% completion.', time: '2h' },
  ]);
  const [modal, setModal] = useState<Modal>(null);
  const [dayStarted, setDayStarted] = useState(false);
  const handledPlanRequest = useRef<string | undefined>(undefined);
  const [elapsed, setElapsed] = useState(0);
  const [briefing, setBriefing] = useState(false);
  const [generatingBriefing, setGeneratingBriefing] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', domain: 'ENGINEERING' as Exclude<Scope, 'ALL'>, summary: '' });
  const [breakdown, setBreakdown] = useState<Array<{ module: string; task: string; estimate: string }>>([]);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [newRisk, setNewRisk] = useState('');
  const [newIdea, setNewIdea] = useState({ title: '', summary: '' });
  const [saved, setSaved] = useState(false);
  const [prompts, setPrompts] = useState({
    pm: 'Turn approved project outcomes into clear features, executable tasks, owners, dependencies and realistic estimates. Always require human approval before publishing.',
    ba: 'Create concise, editable business and technical documents from approved project scope. Surface assumptions, acceptance criteria and unresolved decisions.',
  });

  useEffect(() => {
    if (planRequest && handledPlanRequest.current !== planRequest) {
      handledPlanRequest.current = planRequest;
      setModal(dayStarted ? 'finish' : 'start');
    }
  }, [dayStarted, planRequest]);

  useEffect(() => {
    if (!dayStarted) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [dayStarted]);

  const filteredProjects = useMemo(() => scope === 'ALL' ? projects : projects.filter((project) => project.domain === scope), [projects, scope]);
  const portfolioProgress = Math.round(filteredProjects.reduce((sum, project) => sum + project.progress, 0) / Math.max(filteredProjects.length, 1));
  const activeProject = projects.find((project) => project.id === selectedProject) || projects[0];

  const addNotification = (title: string, detail: string) => setNotifications((items) => [{ id: `n${Date.now()}`, title, detail, time: 'Now' }, ...items]);
  const generateBriefing = () => {
    setGeneratingBriefing(true);
    window.setTimeout(() => { setGeneratingBriefing(false); setBriefing(true); addNotification('Executive briefing refreshed', 'Live portfolio, people and risk signals were summarized.'); }, 700);
  };
  const beginDay = () => { setDayStarted(true); setModal(null); addNotification('Workday started', 'Pratap opened the executive workday.'); };
  const beginPlannedDay = (plan: DayPlanResult) => {
    setTasks((current) => {
      const existingIds = new Set(current.map((task) => task.id));
      const added: ExecutiveTask[] = plan.tasks.filter((task) => !existingIds.has(task.id)).map((task) => ({
        id: task.id, title: task.title, projectId: projects.find((project) => project.name === task.project)?.id || projects[0].id,
        assignee: 'Pratap', status: 'To do', estimate: task.estimate || '1h',
      }));
      return [...added, ...current];
    });
    beginDay();
    addNotification('Executive priorities published', `${plan.tasks.length} tasks are visible in Pratap’s daily plan.`);
  };
  const finishDay = () => { setDayStarted(false); setModal(null); addNotification('Executive wrap-up saved', `Workday closed after ${formatTimer(elapsed)}.`); setElapsed(0); };
  const generatePlan = () => {
    if (!newProject.name.trim()) return;
    setGeneratingPlan(true);
    window.setTimeout(() => {
      setBreakdown([
        { module: 'Discovery & alignment', task: 'Confirm outcomes, users, constraints and success measures', estimate: '4h' },
        { module: 'Delivery foundation', task: 'Define architecture, milestones, dependencies and owners', estimate: '6h' },
        { module: 'Validation & launch', task: 'Plan acceptance testing, rollout and operating handover', estimate: '5h' },
      ]);
      setGeneratingPlan(false);
    }, 650);
  };
  const launchProject = () => {
    if (!newProject.name.trim() || !breakdown.length) return;
    const id = `project-${Date.now()}`;
    createDemoProject({ id, name: newProject.name, description: newProject.summary, department: newProject.domain === 'ENGINEERING' ? 'Engineering' : newProject.domain === 'MARKETING' ? 'Marketing' : 'Sales', category: 'AI-assisted project', priority: 'High', status: 'Planning', owner: { _id: 'demo-ceo', name: 'Pratap' }, tags: ['pm-agent'] });
    setProjects((items) => [{ id, name: newProject.name, domain: newProject.domain, summary: newProject.summary || 'New strategic initiative prepared with the PM Agent.', lead: 'Govind · PM', progress: 0, health: 'On track', due: 'Sep 30', team: ['Govind', 'Anush MK'], openTasks: breakdown.length, docs: 1 }, ...items]);
    setTasks((items) => [...breakdown.map((item, index) => ({ id: `${id}-${index}`, title: item.task, projectId: id, assignee: index === 1 ? 'Anush MK' : 'Govind', status: 'To do' as const, estimate: item.estimate })), ...items]);
    addNotification('Project published', `${newProject.name} was sent to Govind with ${breakdown.length} starter tasks.`);
    setSelectedProject(id); setNewProject({ name: '', domain: 'ENGINEERING', summary: '' }); setBreakdown([]); setModal(null); setScope('ALL'); setView('portfolio');
  };
  const addRisk = (event: FormEvent) => { event.preventDefault(); if (!newRisk.trim()) return; setRisks((items) => [{ id: `r${Date.now()}`, severity: 'High', title: newRisk, project: activeProject.name, owner: 'Govind', age: 'Now' }, ...items]); addNotification('Risk escalated', newRisk); setNewRisk(''); setModal(null); };
  const addIdea = (event: FormEvent) => { event.preventDefault(); if (!newIdea.title.trim()) return; setIdeas((items) => [{ id: `i${Date.now()}`, title: newIdea.title, author: 'Pratap', summary: newIdea.summary, votes: 1, status: 'Submitted' }, ...items]); setNewIdea({ title: '', summary: '' }); setModal(null); };

  const metrics = [
    { label: 'Portfolio health', value: `${portfolioProgress}%`, sub: `${filteredProjects.length} active initiatives`, icon: BarChart3, tone: 'indigo' },
    { label: 'Team active now', value: '6 / 6', sub: 'No unplanned absence', icon: Users, tone: 'green' },
    { label: 'Decisions waiting', value: '4', sub: '2 agent plans · 2 risks', icon: ShieldCheck, tone: 'amber' },
    { label: 'Critical blockers', value: String(risks.filter((risk) => risk.severity === 'Critical').length), sub: 'Needs action today', icon: AlertTriangle, tone: 'rose' },
  ];

  const nav: Array<{ id: View; label: string; icon: typeof Activity }> = [
    { id: 'overview', label: 'Executive overview', icon: Activity }, { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
    { id: 'people', label: 'People & capacity', icon: Users }, { id: 'risks', label: 'Risks & blockers', icon: AlertTriangle },
  ];

  return (
    <div className="ce-workspace">
      <section className="ce-hero">
        <div><span><Crown size={14}/> CEO workspace</span><h1>Good day, Pratap.</h1><p>See what is moving, who needs support, and which decisions need you—without chasing status updates.</p></div>
        <label className="ce-scope"><span>Department view</span><select value={scope} onChange={(event) => setScope(event.target.value as Scope)}><option value="ALL">Executive · all departments</option><option value="ENGINEERING">Software engineering</option><option value="SALES">Sales & business development</option><option value="MARKETING">Marketing & growth</option></select><small>{scopeCopy[scope].sub}</small></label>
      </section>

      <section className="ce-command">
        <nav>{nav.map((item) => { const Icon = item.icon; return <button type="button" className={`${view === item.id ? 'active' : ''} ${item.id === 'risks' ? 'blocker-nav' : ''}`.trim()} onClick={() => setView(item.id)} key={item.id}><Icon size={15}/><span>{item.label}</span>{item.id === 'risks' && <b>{risks.length}</b>}</button>; })}</nav>
        <div className="ce-command-actions">
          <button className="ce-brief-button" type="button" onClick={generateBriefing} disabled={generatingBriefing}>{generatingBriefing ? <RefreshCw className="spin" size={15}/> : <Sparkles size={15}/>}<span>{generatingBriefing ? 'Analyzing…' : 'Generate CEO briefing'}</span></button>
        </div>
      </section>

      {briefing && <section className="ce-briefing"><header><div><Crown size={18}/><span><strong>Executive AI briefing</strong><small>Live snapshot · July 31, 2026</small></span></div><button type="button" onClick={() => setBriefing(false)}><X size={17}/></button></header><div><article><span>01</span><strong>Company health</strong><p>Delivery is steady at {portfolioProgress}% overall. The launch portfolio is moving well, while Agent Operations Studio needs tighter daily decisions.</p></article><article><span>02</span><strong>Momentum</strong><p>Marketing is closest to completion. Atlas Retail remains commercially healthy and engineering reviews are moving within the expected window.</p></article><article><span>03</span><strong>Immediate risk</strong><p>Release validation is blocked by staging access. Assign one accountable owner and resolve it before today’s architecture review.</p></article><article><span>04</span><strong>Your next move</strong><p>Approve the Content Engine agent plan, clear the staging dependency, and check Anush’s capacity before adding new engineering scope.</p></article></div></section>}

      {view === 'overview' && <div className="ce-page">
        <section className="ce-metrics">{metrics.map((metric) => { const Icon = metric.icon; return <article className={metric.tone} key={metric.label}><div><span>{metric.label}</span><strong>{metric.value}</strong><p>{metric.sub}</p></div><i><Icon size={20}/></i></article>; })}</section>
        <section className="ce-schedule"><header><span><CalendarDays size={17}/> Today across the company</span><small>Friday · July 31</small></header><div>{scopeCopy[scope].schedule.map((item) => <article key={item.time}><time>{item.time}</time><div><strong>{item.title}</strong><small>{item.type}</small></div><button type="button"><ArrowRight size={15}/></button></article>)}</div></section>
        <div className="ce-overview-grid">
          <section className="ce-portfolio-health"><header><div><span>Portfolio movement</span><p>Progress and delivery health at a glance.</p></div><button type="button" onClick={() => setView('portfolio')}>Open portfolio <ArrowRight size={14}/></button></header><div className="ce-health-summary"><article><strong>{portfolioProgress}%</strong><span>Average progress</span><p>{filteredProjects.filter((project) => project.health === 'On track').length} of {filteredProjects.length} projects are on track.</p></article><div>{filteredProjects.map((project) => <button type="button" key={project.id} onClick={() => { setSelectedProject(project.id); setView('portfolio'); }}><span><strong>{project.name}</strong><small>{project.lead} · due {project.due}</small></span><b>{project.progress}%</b><i><em style={{ width: `${project.progress}%` }}/></i></button>)}</div></div></section>
          <section className="ce-decisions"><header><span><Zap size={17}/> Decision queue</span><b>4 waiting</b></header><article className="purple"><i><Bot size={17}/></i><div><strong>Approve PM Agent plan</strong><p>Content Engine · 4 features · 18 tasks</p></div><button type="button" onClick={() => navigate('/agents')}>Review</button></article><article className="rose"><i><AlertTriangle size={17}/></i><div><strong>Unblock staging validation</strong><p>Customer Portal V2 · critical</p></div><button type="button" onClick={() => setView('risks')}>Act</button></article><article className="amber"><i><Users size={17}/></i><div><strong>Capacity check for Anush</strong><p>84% load before new sprint scope</p></div><button type="button" onClick={() => setView('people')}>View</button></article></section>
        </div>
        <section className="ce-attendance"><header><div><span><Users size={17}/> Team attendance & current load</span><p>Visibility for support and planning—not surveillance.</p></div><button type="button" onClick={() => setView('people')}>View capacity</button></header><div>{initialPeople.map((person) => <article key={person.name}><div className="ce-avatar">{person.name.split(' ').map((word) => word[0]).join('').slice(0, 2)}</div><div><strong>{person.name}</strong><p>{person.role}</p><small><i></i>{person.state} · since {person.since}</small></div><span><b>{person.load}%</b><small>{person.tasks} open tasks</small></span></article>)}</div></section>
      </div>}

      {view === 'portfolio' && <div className="ce-page"><header className="ce-page-header"><div><span>Company portfolio</span><h2>Projects, progress and delivery confidence.</h2><p>Open a project for its people, work and document summary.</p></div><button type="button" onClick={() => setModal('launch')}><Plus size={15}/> Launch project</button></header><div className="ce-portfolio-layout"><section className="ce-project-list">{filteredProjects.map((project) => <button type="button" className={activeProject.id === project.id ? 'active' : ''} key={project.id} onClick={() => setSelectedProject(project.id)}><i className={project.health.replace(' ', '-').toLowerCase()}></i><span><strong>{project.name}</strong><small>{project.domain} · {project.lead}</small></span><b>{project.progress}%</b><em><span style={{ width: `${project.progress}%` }}/></em></button>)}</section><section className="ce-project-detail"><header><span className={`ce-health ${activeProject.health.replace(' ', '-').toLowerCase()}`}>{activeProject.health}</span><small>Due {activeProject.due}</small></header><h2>{activeProject.name}</h2><p>{activeProject.summary}</p><div className="ce-project-kpis"><article><strong>{activeProject.progress}%</strong><span>Complete</span></article><article><strong>{activeProject.openTasks}</strong><span>Open tasks</span></article><article><strong>{activeProject.docs}</strong><span>Documents</span></article></div><div className="ce-project-team"><span>Accountable team</span>{activeProject.team.map((person) => <b key={person}>{person}</b>)}</div><div className="ce-project-tasks"><header><span>Work movement</span><small>{tasks.filter((task) => task.projectId === activeProject.id).length} visible tasks</small></header>{tasks.filter((task) => task.projectId === activeProject.id).map((task) => <article key={task.id}><CheckCircle2 size={16}/><div><strong>{task.title}</strong><p>{task.assignee} · {task.estimate}</p></div><span className={task.status.toLowerCase().replace(' ', '-')}>{task.status}</span></article>)}</div></section></div></div>}

      {view === 'people' && <div className="ce-page"><header className="ce-page-header"><div><span>People & capacity</span><h2>Make workload visible before it becomes burnout.</h2><p>Use capacity signals to rebalance work—not to reward long hours.</p></div></header><section className="ce-people-grid">{initialPeople.map((person) => <article key={person.name}><header><div className="ce-avatar large">{person.name.split(' ').map((word) => word[0]).join('').slice(0, 2)}</div><span><strong>{person.name}</strong><p>{person.role} · {person.domain}</p></span><i></i></header><div><span>Today</span><strong>{person.state}</strong><small>Started {person.since}</small></div><div className="ce-load"><span><small>Assigned load</small><b>{person.load}%</b></span><i><em style={{ width: `${person.load}%` }}/></i><p>{person.tasks} open tasks · {person.load >= 80 ? 'Review before assigning more' : 'Healthy working range'}</p></div><button type="button" onClick={() => { setScope(person.domain === 'Engineering' ? 'ENGINEERING' : person.domain === 'Sales' ? 'SALES' : person.domain === 'Marketing' ? 'MARKETING' : 'ALL'); setView('overview'); }}>Open related work <ArrowRight size={14}/></button></article>)}</section></div>}

      {view === 'risks' && <div className="ce-page"><header className="ce-page-header"><div><span>Risks & blockers</span><h2>Clear obstacles while they are still small.</h2><p>Every risk has an owner, an age and a clear next action.</p></div><button className="danger" type="button" onClick={() => setModal('risk')}><Plus size={15}/> Escalate risk</button></header><section className="ce-risk-list">{risks.map((risk) => <article key={risk.id}><i><AlertTriangle size={19}/></i><div><small>{risk.severity} · open {risk.age}</small><strong>{risk.title}</strong><p>{risk.project} · accountable owner: {risk.owner}</p></div><button type="button" onClick={() => { setRisks((items) => items.filter((item) => item.id !== risk.id)); addNotification('Risk resolved', risk.title); }}><Check size={15}/> Mark resolved</button></article>)}</section></div>}

      {view === 'ideas' && <div className="ce-page"><header className="ce-page-header"><div><span>Innovation bucket</span><h2>Good ideas should have a visible path.</h2><p>Review team suggestions, signal support and move the best into discovery.</p></div><button type="button" onClick={() => setModal('idea')}><Plus size={15}/> Pitch idea</button></header><section className="ce-ideas-grid">{ideas.map((idea) => <article key={idea.id}><span>{idea.status}</span><h3>{idea.title}</h3><p>{idea.summary}</p><footer><small>Proposed by {idea.author}</small><button type="button" onClick={() => setIdeas((items) => items.map((item) => item.id === idea.id ? { ...item, votes: item.votes + 1 } : item))}><ThumbsUp size={14}/>{idea.votes}</button></footer></article>)}</section></div>}

      {view === 'agents' && <div className="ce-page"><header className="ce-page-header"><div><span>Agent governance</span><h2>AI prepares the work. Your leaders approve it.</h2><p>Pratap, Govind and Anush can review outputs and adjust the operating instructions.</p></div>{saved && <span className="ce-saved"><Check size={14}/> Prompt changes saved</span>}</header><section className="ce-agent-queue"><article><i><Bot size={18}/></i><div><span>PM Agent · Content Engine</span><strong>Feature and task plan ready for review</strong><p>4 features · 18 tasks · estimated 21 working days</p></div><button type="button" onClick={() => addNotification('PM plan approved', 'Content Engine tasks were published for Govind to assign.')}><Check size={15}/> Approve</button></article><article><i><FileText size={18}/></i><div><span>Business Analyst · Agent Operations Studio</span><strong>Initial PRD and acceptance criteria ready</strong><p>Version 1 · 3 assumptions flagged for review</p></div><button type="button" onClick={() => addNotification('BA document approved', 'Agent Operations Studio PRD moved to approved.')}><Check size={15}/> Approve</button></article></section><section className="ce-agent-grid"><article><header><span><Bot size={17}/> PM Agent instructions</span><b>v3.2</b></header><p>Controls how the agent shapes features, tasks, estimates and dependencies.</p><textarea value={prompts.pm} onChange={(event) => setPrompts((value) => ({ ...value, pm: event.target.value }))} rows={6}/><footer><small>Visible to CEO, PM and Tech Lead</small><button type="button" onClick={() => { setSaved(true); window.setTimeout(() => setSaved(false), 1800); }}><Save size={14}/> Save version</button></footer></article><article><header><span><FileText size={17}/> Business Analyst instructions</span><b>v2.4</b></header><p>Controls project documentation, assumptions, acceptance criteria and traceability.</p><textarea value={prompts.ba} onChange={(event) => setPrompts((value) => ({ ...value, ba: event.target.value }))} rows={6}/><footer><small>Approval required before publishing</small><button type="button" onClick={() => { setSaved(true); window.setTimeout(() => setSaved(false), 1800); }}><Save size={14}/> Save version</button></footer></article></section></div>}

      {modal === 'start' && <CeoDialog wide title="Start my day" description="The same priority planning flow is available to CEO, PM, Tech Lead and every team member." icon={<Play size={18}/>} onClose={() => setModal(null)}><SharedStartDayPlanner tasks={tasks.filter((task) => task.status !== 'Done').map((task) => ({ id: task.id, title: task.title, project: projects.find((project) => project.id === task.projectId)?.name || 'Executive work', priority: task.status === 'Blocked' ? 'Critical' : task.status === 'Review' ? 'High' : 'Medium', estimate: task.estimate, carriedOver: task.status === 'In progress' }))} projects={projects.map((project) => project.name)} defaultFocus="Clear the most important delivery blocker and make the decisions teams need today." onCancel={() => setModal(null)} onStart={beginPlannedDay}/></CeoDialog>}
      {modal === 'finish' && <CeoDialog title="Executive wrap-up" description="Close the day with outcomes, blockers and context for tomorrow." icon={<LogOut size={18}/>} onClose={() => setModal(null)}><div className="ce-form"><label><span>Completed and decided</span><textarea rows={3} defaultValue="Reviewed portfolio health and cleared the highest-priority approvals."/></label><label><span>Carry forward</span><textarea rows={3} defaultValue="Confirm the staging owner and review engineering capacity tomorrow morning."/></label><footer><button type="button" onClick={() => setModal(null)}>Keep working</button><button type="button" onClick={finishDay}>Save & log off</button></footer></div></CeoDialog>}
      {modal === 'risk' && <CeoDialog title="Escalate a delivery risk" description="Add the obstacle and route it to an accountable owner." icon={<AlertTriangle size={18}/>} onClose={() => setModal(null)}><form className="ce-form" onSubmit={addRisk}><label><span>Risk or blocker</span><textarea rows={4} value={newRisk} onChange={(event) => setNewRisk(event.target.value)} placeholder="What is blocked, why it matters, and what decision is needed?" autoFocus/></label><footer><button type="button" onClick={() => setModal(null)}>Cancel</button><button className="danger" type="submit">Escalate risk</button></footer></form></CeoDialog>}
      {modal === 'idea' && <CeoDialog title="Pitch an idea" description="Capture the outcome and expected benefit, not a long proposal." icon={<Lightbulb size={18}/>} onClose={() => setModal(null)}><form className="ce-form" onSubmit={addIdea}><label><span>Idea title</span><input value={newIdea.title} onChange={(event) => setNewIdea((value) => ({ ...value, title: event.target.value }))} placeholder="A short, memorable title" autoFocus/></label><label><span>Expected benefit</span><textarea rows={4} value={newIdea.summary} onChange={(event) => setNewIdea((value) => ({ ...value, summary: event.target.value }))} placeholder="Who benefits, and what improves?"/></label><footer><button type="button" onClick={() => setModal(null)}>Cancel</button><button type="submit">Submit idea</button></footer></form></CeoDialog>}
      {modal === 'launch' && <CeoDialog wide title="Launch a project with the PM Agent" description="Describe the outcome. The agent drafts a reviewable plan before anything is published." icon={<Sparkles size={18}/>} onClose={() => setModal(null)}><div className="ce-launch-flow"><section><label><span>Project name</span><input value={newProject.name} onChange={(event) => setNewProject((value) => ({ ...value, name: event.target.value }))} placeholder="e.g. Partner onboarding portal" autoFocus/></label><label><span>Department</span><select value={newProject.domain} onChange={(event) => setNewProject((value) => ({ ...value, domain: event.target.value as Exclude<Scope, 'ALL'> }))}><option value="ENGINEERING">Software engineering</option><option value="SALES">Sales & business development</option><option value="MARKETING">Marketing & growth</option></select></label><label><span>Outcome and context</span><textarea rows={5} value={newProject.summary} onChange={(event) => setNewProject((value) => ({ ...value, summary: event.target.value }))} placeholder="What should change for customers or the business?"/></label><button type="button" onClick={generatePlan} disabled={!newProject.name.trim() || generatingPlan}>{generatingPlan ? <RefreshCw className="spin" size={15}/> : <Bot size={15}/>} {generatingPlan ? 'PM Agent is drafting…' : 'Draft project plan'}</button></section><section className="ce-breakdown"><header><span>Reviewable first draft</span><small>{breakdown.length ? `${breakdown.length} modules prepared` : 'Nothing is published yet'}</small></header>{breakdown.length ? breakdown.map((item, index) => <article key={item.module}><span>0{index + 1}</span><div><strong>{item.module}</strong><p><CheckCircle2 size={14}/>{item.task}</p><small>Initial estimate · {item.estimate}</small></div></article>) : <div className="ce-breakdown-empty"><FolderKanban size={30}/><strong>Your plan will appear here</strong><p>You can edit the draft before Govind receives it and before the BA Agent creates documents.</p></div>}</section></div><footer className="ce-launch-footer"><span>Publishing will notify Govind, Anush and the assigned team.</span><div><button type="button" onClick={() => setModal(null)}>Cancel</button><button type="button" disabled={!breakdown.length} onClick={launchProject}>Approve & publish <ArrowRight size={14}/></button></div></footer></CeoDialog>}
    </div>
  );
};

export default CeoExecutiveDemo;
