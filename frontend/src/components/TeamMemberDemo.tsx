import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  AlertTriangle, ArrowRight, Briefcase, CalendarDays, Check, CheckCircle2,
  CheckSquare, Clock3, Code2, FileText, Flag, FolderKanban, LayoutGrid,
  Lightbulb, List, LogOut, Paperclip, Play, Plus, Sparkles, ThumbsUp,
  Timer, UserCheck, X, Zap,
} from 'lucide-react';

type DemoView = 'work' | 'projects' | 'blockers' | 'ideas' | 'schedule';
type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'blocked';
type Priority = 'Low' | 'Medium' | 'High' | 'Urgent';

interface DemoTask {
  id: string;
  title: string;
  project: string;
  status: TaskStatus;
  priority: Priority;
  estimate: string;
  today: boolean;
  assignedBy: string;
  leadAssigned: boolean;
}

const projects = [
  {
    id: 'portal', name: 'Customer Portal V2', role: 'Frontend developer', lead: 'Govind (PM)',
    progress: 78, status: 'In progress', due: 'Aug 18',
    docs: ['API specification v2.1', 'Design tokens & UI system', 'Deployment guide'],
  },
  {
    id: 'agent', name: 'Agent Operations Studio', role: 'Full-stack developer', lead: 'Anush MK (Tech Lead)',
    progress: 46, status: 'In review', due: 'Aug 27',
    docs: ['Agent workflow architecture', 'Approval-state contract', 'OpenRouter runbook'],
  },
];

const initialTasks: DemoTask[] = [
  { id: '1', title: 'Refactor auth token refresh handler in API client', project: 'Customer Portal V2', status: 'in_progress', priority: 'Urgent', estimate: '2.5 hrs', today: true, assignedBy: 'Govind', leadAssigned: true },
  { id: '2', title: 'Review pull request #342 for UI component library', project: 'Customer Portal V2', status: 'completed', priority: 'Medium', estimate: '1 hr', today: true, assignedBy: 'Anush MK', leadAssigned: true },
  { id: '3', title: 'Fix responsive navigation drawer on mobile', project: 'Customer Portal V2', status: 'todo', priority: 'High', estimate: '1.5 hrs', today: true, assignedBy: 'Self', leadAssigned: false },
  { id: '4', title: 'Connect agent approval history to the project workspace', project: 'Agent Operations Studio', status: 'todo', priority: 'High', estimate: '3 hrs', today: true, assignedBy: 'Govind', leadAssigned: true },
  { id: '5', title: 'Update API endpoint documentation for v2 release', project: 'Customer Portal V2', status: 'todo', priority: 'Low', estimate: '1 hr', today: false, assignedBy: 'Self', leadAssigned: false },
];

const schedule = [
  { time: '09:30', title: 'Engineering daily stand-up', kind: 'Team sync', duration: '15m' },
  { time: '11:00', title: 'Agent workflow architecture review', kind: 'Tech review', duration: '45m' },
  { time: '15:30', title: 'Sprint 24 pull-request grooming', kind: 'Delivery', duration: '30m' },
];

const statusLabel: Record<TaskStatus, string> = {
  todo: 'To do', in_progress: 'In progress', completed: 'Completed', blocked: 'Blocked',
};

const formatTimer = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return [hours, minutes, remaining].map((part) => String(part).padStart(2, '0')).join(':');
};

const Dialog = ({ title, description, icon, children, onClose, wide = false }: { title: string; description: string; icon: ReactNode; children: ReactNode; onClose: () => void; wide?: boolean }) => (
  <div className="tm-dialog-backdrop" role="presentation" onMouseDown={onClose}>
    <section className={`tm-dialog ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
      <header><span>{icon}</span><div><h2>{title}</h2><p>{description}</p></div><button type="button" aria-label="Close dialog" onClick={onClose}><X size={17}/></button></header>
      {children}
    </section>
  </div>
);

const TeamMemberDemo = () => {
  const [view, setView] = useState<DemoView>('work');
  const [tasks, setTasks] = useState(initialTasks);
  const [filter, setFilter] = useState<'today' | 'pending' | 'completed' | 'all'>('today');
  const [taskLayout, setTaskLayout] = useState<'list' | 'board'>('list');
  const [dayStarted, setDayStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [startTime, setStartTime] = useState('');
  const [dialog, setDialog] = useState<'start' | 'task' | 'blocker' | 'finish' | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskProject, setTaskProject] = useState(projects[0].name);
  const [taskEstimate, setTaskEstimate] = useState('1.5 hrs');
  const [taskPriority, setTaskPriority] = useState<Priority>('Medium');
  const [blockerTitle, setBlockerTitle] = useState('');
  const [blockers, setBlockers] = useState([
    { id: 'b1', title: 'Waiting for staging CORS configuration from DevOps', project: 'Customer Portal V2', severity: 'Critical', owner: 'DevOps', time: 'Today, 10:15' },
  ]);
  const [ideas, setIdeas] = useState([
    { id: 'i1', title: 'Pre-review accessibility bot for pull requests', description: 'Run focused accessibility checks before a reviewer opens the PR.', votes: 38, voted: true, status: 'Under review' },
    { id: 'i2', title: 'Project setup checklist generated from the approved BRD', description: 'Turn approved requirements into a consistent repository setup checklist.', votes: 27, voted: false, status: 'Planned' },
  ]);
  const [ideaTitle, setIdeaTitle] = useState('');
  const [finishSummary, setFinishSummary] = useState('');
  const [finishRemarks, setFinishRemarks] = useState('');
  const [savedCloseout, setSavedCloseout] = useState(false);

  useEffect(() => {
    if (!dayStarted) return;
    const interval = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [dayStarted]);

  const todayTasks = tasks.filter((task) => task.today);
  const completed = todayTasks.filter((task) => task.status === 'completed').length;
  const filteredTasks = tasks.filter((task) => {
    if (filter === 'today') return task.today;
    if (filter === 'pending') return task.status !== 'completed';
    if (filter === 'completed') return task.status === 'completed';
    return true;
  });

  const totalEstimate = useMemo(() => todayTasks.reduce((total, task) => total + (Number.parseFloat(task.estimate) || 0), 0), [todayTasks]);

  const toggleTask = (id: string) => setTasks((current) => current.map((task) => task.id === id ? { ...task, status: task.status === 'completed' ? 'in_progress' : 'completed' } : task));
  const toggleFocus = (id: string) => setTasks((current) => current.map((task) => task.id === id ? { ...task, today: !task.today } : task));

  const addTask = (event: FormEvent, startImmediately = false) => {
    event.preventDefault();
    if (!taskTitle.trim()) return;
    setTasks((current) => [{
      id: String(Date.now()), title: taskTitle.trim(), project: taskProject,
      status: startImmediately ? 'in_progress' : 'todo', priority: taskPriority,
      estimate: taskEstimate, today: true, assignedBy: 'Self', leadAssigned: false,
    }, ...current]);
    setTaskTitle('');
    if (!startImmediately) setDialog(null);
  };

  const beginDay = () => {
    setStartTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    setDayStarted(true);
    setSavedCloseout(false);
    setDialog(null);
  };

  const reportBlocker = (event: FormEvent) => {
    event.preventDefault();
    if (!blockerTitle.trim()) return;
    setBlockers((current) => [{ id: String(Date.now()), title: blockerTitle.trim(), project: taskProject, severity: 'High', owner: 'Govind / Anush', time: 'Just now' }, ...current]);
    setBlockerTitle('');
    setDialog(null);
    setView('blockers');
  };

  const closeDay = (event: FormEvent) => {
    event.preventDefault();
    setDayStarted(false);
    setSavedCloseout(true);
    setDialog(null);
  };

  const navItems: Array<{ id: DemoView; label: string; icon: typeof CheckSquare; badge?: number }> = [
    { id: 'work', label: 'Daily workspace', icon: CheckSquare },
    { id: 'projects', label: 'Projects & specs', icon: FolderKanban },
    { id: 'blockers', label: 'Blockers', icon: AlertTriangle, badge: blockers.length },
    { id: 'ideas', label: 'Idea bucket', icon: Lightbulb, badge: ideas.length },
    { id: 'schedule', label: 'Schedule & logs', icon: CalendarDays },
  ];

  const TaskCard = ({ task }: { task: DemoTask }) => (
    <article className={`tm-task ${task.status}`}>
      <button className="tm-task-check" type="button" aria-label={task.status === 'completed' ? `Reopen ${task.title}` : `Complete ${task.title}`} onClick={() => toggleTask(task.id)}>
        {task.status === 'completed' ? <Check size={13}/> : <span/>}
      </button>
      <div className="tm-task-copy">
        <strong>{task.title}</strong>
        <div className="tm-task-tags">
          <span><Briefcase size={11}/>{task.project}</span>
          {task.leadAssigned ? <span className="assigned"><UserCheck size={11}/>Assigned by {task.assignedBy}</span> : <span>Self-added</span>}
          <span className={`priority ${task.priority.toLowerCase()}`}>{task.priority}</span>
          <span className="estimate"><Timer size={11}/>{task.estimate}</span>
        </div>
      </div>
      <select value={task.status} aria-label={`Status for ${task.title}`} onChange={(event) => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: event.target.value as TaskStatus } : item))}>
        {Object.entries(statusLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select>
    </article>
  );

  return (
    <div className="tm-demo animate-fade-in">
      <header className="tm-hero">
        <div className="tm-hero-copy">
          <span className="tm-kicker"><Code2 size={14}/>Developer workspace</span>
          <h1>Good day, Alex</h1>
          <p>Make today clear, keep progress visible, and raise blockers before they slow delivery.</p>
        </div>
        <div className="tm-session-actions">
          {dayStarted ? <div className="tm-live-session"><span className="tm-live-dot"/><div><small>Started {startTime}</small><strong>{formatTimer(elapsed)}</strong></div><button type="button" onClick={() => setDialog('finish')}><LogOut size={14}/>End day</button></div> : <button className="tm-start-button" type="button" onClick={() => setDialog('start')}><Play size={14}/>Plan & start my day</button>}
          <button className="tm-blocker-button" type="button" onClick={() => setDialog('blocker')}><AlertTriangle size={14}/>Report blocker</button>
        </div>
      </header>

      <nav className="tm-tabs" aria-label="Team member demo sections">
        {navItems.map(({ id, label, icon: Icon, badge }) => <button type="button" className={`${view === id ? 'active' : ''} ${id === 'blockers' ? 'blocker-nav' : ''}`.trim()} onClick={() => setView(id)} key={id}><Icon size={14}/><span>{label}</span>{badge ? <b>{badge}</b> : null}</button>)}
      </nav>

      {savedCloseout && <div className="tm-success-note"><CheckCircle2 size={15}/><span>Today’s closeout was saved. Govind and Anush can now see the summary, blockers and remarks.</span><button type="button" onClick={() => setSavedCloseout(false)}><X size={14}/></button></div>}

      {view === 'work' && <>
        <section className="tm-metrics" aria-label="Today at a glance">
          <article><span><Zap size={16}/></span><div><small>Today’s focus</small><strong>{todayTasks.length} tasks</strong><p>{totalEstimate.toFixed(1)} estimated hours</p></div></article>
          <article><span><CheckCircle2 size={16}/></span><div><small>Completed</small><strong>{completed} of {todayTasks.length}</strong><p>{todayTasks.length ? Math.round(completed / todayTasks.length * 100) : 0}% of the plan</p></div></article>
          <article className={blockers.length ? 'attention' : ''}><span><AlertTriangle size={16}/></span><div><small>Open blockers</small><strong>{blockers.length} active</strong><p>Visible to delivery leads</p></div></article>
        </section>

        <section className="tm-schedule-strip">
          <header><div><CalendarDays size={15}/><span>Today’s schedule</span></div><small>Friday, July 31</small></header>
          <div>{schedule.map((item) => <article key={item.time}><time>{item.time}</time><div><strong>{item.title}</strong><small>{item.kind} · {item.duration}</small></div></article>)}</div>
        </section>

        <div className="tm-work-grid">
          <section className="tm-task-panel">
            <header><div><span><CheckSquare size={17}/>Today’s tasks</span><small>Keep stand-up updates tied to executable work.</small></div><button type="button" onClick={() => setDialog('task')}><Plus size={14}/>Add task</button></header>
            <div className="tm-task-tools"><div>{([['today', 'Today'], ['pending', 'Pending'], ['completed', 'Completed'], ['all', 'All']] as const).map(([id, label]) => <button type="button" className={filter === id ? 'active' : ''} onClick={() => setFilter(id)} key={id}>{label}</button>)}</div><div className="tm-layout-switch"><button type="button" className={taskLayout === 'list' ? 'active' : ''} onClick={() => setTaskLayout('list')} aria-label="List view"><List size={14}/></button><button type="button" className={taskLayout === 'board' ? 'active' : ''} onClick={() => setTaskLayout('board')} aria-label="Board view"><LayoutGrid size={14}/></button></div></div>
            {taskLayout === 'list' ? <div className="tm-task-list">{filteredTasks.map((task) => <TaskCard task={task} key={task.id}/>)}</div> : <div className="tm-task-board">{(['todo', 'in_progress', 'completed'] as TaskStatus[]).map((status) => <section key={status}><header><span>{statusLabel[status]}</span><b>{filteredTasks.filter((task) => task.status === status).length}</b></header><div>{filteredTasks.filter((task) => task.status === status).map((task) => <TaskCard task={task} key={task.id}/>)}</div></section>)}</div>}
          </section>

          <aside className="tm-project-rail">
            <header><div><FolderKanban size={16}/><span>Assigned projects</span></div><button type="button" onClick={() => setView('projects')}>View all<ArrowRight size={13}/></button></header>
            {projects.map((project) => <article key={project.id}><div className="tm-project-title"><span>{project.name.charAt(0)}</span><div><strong>{project.name}</strong><small>{project.role}</small></div><b>{project.status}</b></div><div className="tm-progress"><span><i style={{ width: `${project.progress}%` }}/></span><small>{project.progress}%</small></div><p>Lead: {project.lead} · due {project.due}</p><div className="tm-doc-mini">{project.docs.slice(0, 2).map((doc) => <span key={doc}><FileText size={11}/>{doc}</span>)}</div></article>)}
          </aside>
        </div>
      </>}

      {view === 'projects' && <section className="tm-page-section"><header><div><span className="tm-kicker"><FolderKanban size={14}/>Assigned delivery</span><h2>Projects, requirements and working files</h2><p>Only the projects Alex contributes to are visible here.</p></div></header><div className="tm-project-grid">{projects.map((project) => <article key={project.id}><header><div><span>{project.name.charAt(0)}</span><div><strong>{project.name}</strong><small>{project.role}</small></div></div><b>{project.status}</b></header><div className="tm-project-facts"><span><small>Project lead</small><strong>{project.lead}</strong></span><span><small>Target date</small><strong>{project.due}</strong></span><span><small>Progress</small><strong>{project.progress}%</strong></span></div><div className="tm-progress large"><span><i style={{ width: `${project.progress}%` }}/></span></div><section><h3><Paperclip size={13}/>Approved specs and working files</h3>{project.docs.map((doc, index) => <button type="button" key={doc}><FileText size={14}/><span><strong>{doc}</strong><small>{index === 0 ? 'Approved reference' : 'Working document'}</small></span><ArrowRight size={13}/></button>)}</section></article>)}</div></section>}

      {view === 'blockers' && <section className="tm-page-section"><header className="with-action"><div><span className="tm-kicker danger"><AlertTriangle size={14}/>Delivery support</span><h2>Blockers and impediments</h2><p>Raise an issue once. Ownership and follow-up stay visible.</p></div><button type="button" className="tm-danger-action" onClick={() => setDialog('blocker')}><Plus size={14}/>Report blocker</button></header><div className="tm-blocker-list">{blockers.map((blocker) => <article key={blocker.id}><span><AlertTriangle size={16}/></span><div><div><b>{blocker.severity}</b><small>{blocker.project}</small></div><strong>{blocker.title}</strong><p>Reported {blocker.time} · owner: {blocker.owner}</p></div><button type="button">Open</button></article>)}</div></section>}

      {view === 'ideas' && <section className="tm-page-section"><header className="with-action"><div><span className="tm-kicker"><Lightbulb size={14}/>Team innovation</span><h2>Idea bucket</h2><p>Small workflow improvements can become reviewed company initiatives.</p></div><form className="tm-idea-entry" onSubmit={(event) => { event.preventDefault(); if (!ideaTitle.trim()) return; setIdeas((current) => [{ id: String(Date.now()), title: ideaTitle.trim(), description: 'New idea submitted by Alex for team review.', votes: 1, voted: true, status: 'Under review' }, ...current]); setIdeaTitle(''); }}><input aria-label="New idea title" value={ideaTitle} onChange={(event) => setIdeaTitle(event.target.value)} placeholder="Pitch a concise idea"/><button type="submit"><Plus size={14}/>Pitch idea</button></form></header><div className="tm-ideas-grid">{ideas.map((idea) => <article key={idea.id}><div><span>{idea.status}</span><Lightbulb size={17}/></div><h3>{idea.title}</h3><p>{idea.description}</p><footer><small>Shared by the delivery team</small><button type="button" className={idea.voted ? 'voted' : ''} onClick={() => setIdeas((current) => current.map((item) => item.id === idea.id ? { ...item, voted: !item.voted, votes: item.votes + (item.voted ? -1 : 1) } : item))}><ThumbsUp size={13}/>{idea.votes}</button></footer></article>)}</div></section>}

      {view === 'schedule' && <section className="tm-page-section"><header><div><span className="tm-kicker"><CalendarDays size={14}/>Time and rhythm</span><h2>Schedule and workday history</h2><p>Hours support planning; outcomes and blockers explain the day.</p></div></header><div className="tm-schedule-grid"><section><header><CalendarDays size={15}/>Today’s calendar</header>{schedule.map((item) => <article key={item.time}><time>{item.time}</time><span/><div><strong>{item.title}</strong><small>{item.kind} · {item.duration}</small></div></article>)}</section><section><header><Clock3 size={15}/>Recent workdays</header>{[{ date: 'Thursday, July 30', time: '09:00–17:30', duration: '8h 30m', tasks: 4 }, { date: 'Wednesday, July 29', time: '08:55–17:15', duration: '8h 20m', tasks: 5 }].map((log) => <article className="tm-log-row" key={log.date}><div><strong>{log.date}</strong><small>{log.time} · {log.duration}</small></div><span>{log.tasks} tasks completed</span></article>)}</section></div></section>}

      {dialog === 'start' && <Dialog wide title="Plan today before the timer starts" description="Choose a realistic focus list for stand-up and delivery." icon={<Sparkles size={18}/>} onClose={() => setDialog(null)}><div className="tm-start-plan"><section><header><span>1. Choose today’s focus</span><b>{todayTasks.length} selected</b></header><div>{tasks.map((task) => <button type="button" className={task.today ? 'selected' : ''} onClick={() => toggleFocus(task.id)} key={task.id}><span>{task.today && <Check size={12}/>}</span><div><strong>{task.title}</strong><small>{task.project} · {task.estimate}{task.leadAssigned ? ` · assigned by ${task.assignedBy}` : ''}</small></div><b>{task.today ? 'Selected' : 'Add'}</b></button>)}</div></section><form onSubmit={(event) => addTask(event, true)}><span>2. Add a task that is missing</span><input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Describe a clear, finishable task"/><div><select value={taskProject} onChange={(event) => setTaskProject(event.target.value)}>{projects.map((project) => <option key={project.id}>{project.name}</option>)}</select><select value={taskEstimate} onChange={(event) => setTaskEstimate(event.target.value)}>{['30 mins', '1 hr', '1.5 hrs', '2 hrs', '3 hrs'].map((value) => <option key={value}>{value}</option>)}</select><button type="submit" disabled={!taskTitle.trim()}><Plus size={13}/>Add</button></div></form></div><footer className="tm-dialog-actions"><span>{todayTasks.length} focus tasks · {totalEstimate.toFixed(1)} estimated hours</span><div><button type="button" onClick={() => setDialog(null)}>Cancel</button><button type="button" className="primary success" onClick={beginDay}><Play size={13}/>Confirm plan & start</button></div></footer></Dialog>}

      {dialog === 'task' && <Dialog title="Add a task for today" description="Keep the title specific enough to close or hand over." icon={<Plus size={18}/>} onClose={() => setDialog(null)}><form className="tm-form" onSubmit={addTask}><label><span>Task</span><input autoFocus value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="e.g. Connect approval history to project page"/></label><div><label><span>Project</span><select value={taskProject} onChange={(event) => setTaskProject(event.target.value)}>{projects.map((project) => <option key={project.id}>{project.name}</option>)}</select></label><label><span>Priority</span><select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value as Priority)}>{['Low', 'Medium', 'High', 'Urgent'].map((value) => <option key={value}>{value}</option>)}</select></label></div><label><span>Estimated time</span><select value={taskEstimate} onChange={(event) => setTaskEstimate(event.target.value)}>{['30 mins', '1 hr', '1.5 hrs', '2 hrs', '3 hrs'].map((value) => <option key={value}>{value}</option>)}</select></label><footer><button type="button" onClick={() => setDialog(null)}>Cancel</button><button className="primary" type="submit">Add to today</button></footer></form></Dialog>}

      {dialog === 'blocker' && <Dialog title="Report a work blocker" description="This immediately becomes visible to Govind and Anush." icon={<AlertTriangle size={18}/>} onClose={() => setDialog(null)}><form className="tm-form" onSubmit={reportBlocker}><label><span>What is preventing progress?</span><textarea autoFocus value={blockerTitle} onChange={(event) => setBlockerTitle(event.target.value)} placeholder="State what is blocked and what you need to continue" rows={4}/></label><label><span>Project</span><select value={taskProject} onChange={(event) => setTaskProject(event.target.value)}>{projects.map((project) => <option key={project.id}>{project.name}</option>)}</select></label><div className="tm-escalation-note"><Flag size={14}/><span>Escalates to PM / Tech Lead with high priority.</span></div><footer><button type="button" onClick={() => setDialog(null)}>Cancel</button><button className="primary danger" type="submit">Report blocker</button></footer></form></Dialog>}

      {dialog === 'finish' && <Dialog title="Close today with useful context" description="Your summary becomes the team’s source of truth for tomorrow." icon={<LogOut size={18}/>} onClose={() => setDialog(null)}><form className="tm-form" onSubmit={closeDay}><div className="tm-closeout-stats"><span><small>Session</small><strong>{formatTimer(elapsed)}</strong></span><span><small>Completed</small><strong>{completed}/{todayTasks.length}</strong></span><span><small>Blockers</small><strong>{blockers.length}</strong></span></div><label><span>What did you complete?</span><textarea required value={finishSummary} onChange={(event) => setFinishSummary(event.target.value)} placeholder="Summarize shipped work, reviews or decisions" rows={3}/></label><label><span>Blockers and handover remarks</span><textarea value={finishRemarks} onChange={(event) => setFinishRemarks(event.target.value)} placeholder="What should Govind or Anush know?" rows={3}/></label><footer><button type="button" onClick={() => setDialog(null)}>Keep working</button><button className="primary" type="submit">Save closeout & log off</button></footer></form></Dialog>}
    </div>
  );
};

export default TeamMemberDemo;
