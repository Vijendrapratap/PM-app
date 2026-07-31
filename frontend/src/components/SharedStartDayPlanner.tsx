import { useMemo, useState } from 'react';
import { ArrowRight, Flag, Plus, RotateCcw, Sparkles, X } from 'lucide-react';

export type DayPlanPriority = 'Critical' | 'High' | 'Medium' | 'Low';

export interface DayPlanTask {
  id: string;
  title: string;
  project: string;
  priority: DayPlanPriority;
  estimate?: string;
  carriedOver?: boolean;
  selected?: boolean;
  remarks?: string;
}

export interface DayPlanResult {
  focus: string;
  remarks: string;
  tasks: DayPlanTask[];
}

const priorityRank: Record<DayPlanPriority, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

const SharedStartDayPlanner = ({ tasks: suppliedTasks, projects, defaultFocus, onCancel, onStart }: {
  tasks: DayPlanTask[];
  projects: string[];
  defaultFocus: string;
  onCancel: () => void;
  onStart: (plan: DayPlanResult) => void;
}) => {
  const [tasks, setTasks] = useState(suppliedTasks);
  const [selectedIds, setSelectedIds] = useState(() => new Set(suppliedTasks.filter((task) => task.selected || task.carriedOver || ['Critical', 'High'].includes(task.priority)).map((task) => task.id)));
  const [focus, setFocus] = useState(defaultFocus);
  const [remarks, setRemarks] = useState('');
  const [newTask, setNewTask] = useState({ title: '', project: projects[0] || '', priority: 'Medium' as DayPlanPriority });

  const selected = useMemo(() => tasks.filter((task) => selectedIds.has(task.id)).sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]), [selectedIds, tasks]);
  const pending = useMemo(() => tasks.filter((task) => !selectedIds.has(task.id)).sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]), [selectedIds, tasks]);
  const carried = selected.filter((task) => task.carriedOver).length;

  const toggleTask = (id: string) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const addTask = () => {
    if (!newTask.title.trim() || !newTask.project) return;
    const item: DayPlanTask = { id: `custom-${Date.now()}`, title: newTask.title.trim(), project: newTask.project, priority: newTask.priority, selected: true };
    setTasks((current) => [item, ...current]);
    setSelectedIds((current) => new Set(current).add(item.id));
    setNewTask((current) => ({ ...current, title: '' }));
  };

  const updateTaskRemarks = (id: string, value: string) => setTasks((current) => current.map((task) => task.id === id ? { ...task, remarks: value } : task));

  return <div className="shared-day-planner">
    <label className="shared-day-focus"><span>Today will be successful if…</span><textarea value={focus} onChange={(event) => setFocus(event.target.value)} rows={2}/></label>
    {carried > 0 && <div className="shared-day-carry"><RotateCcw size={16}/><span><strong>{carried} unfinished {carried === 1 ? 'task' : 'tasks'} carried forward</strong><small>Review the context, then keep or remove the task.</small></span></div>}
    <div className="shared-day-grid">
      <section className="shared-day-priority"><header><div><Flag size={15}/><span><strong>Today’s priority</strong><small>Carried, critical and high-priority work</small></span></div><b>{selected.length}</b></header><div>{selected.map((task) => <article key={task.id}><span className={`shared-priority ${task.priority.toLowerCase()}`}>{task.priority}</span><div><small>{task.project}{task.estimate ? ` · ${task.estimate}` : ''}</small><strong>{task.title}</strong><textarea aria-label={`Remarks for ${task.title}`} value={task.remarks || ''} onChange={(event) => updateTaskRemarks(task.id, event.target.value)} placeholder="Remarks, dependency or useful context…" rows={2}/></div><button type="button" aria-label={`Remove ${task.title} from today`} onClick={() => toggleTask(task.id)}><X size={14}/></button></article>)}{!selected.length && <div className="shared-day-empty"><Sparkles size={18}/><span>Add at least one realistic task for today.</span></div>}</div></section>
      <aside className="shared-day-pending"><section><header><span><Plus size={15}/>Add task</span><small>Add missing work directly to today.</small></header><input value={newTask.title} onChange={(event) => setNewTask((current) => ({ ...current, title: event.target.value }))} placeholder="Describe a finishable task"/><select value={newTask.project} onChange={(event) => setNewTask((current) => ({ ...current, project: event.target.value }))}>{projects.map((project) => <option key={project}>{project}</option>)}</select><div><select value={newTask.priority} onChange={(event) => setNewTask((current) => ({ ...current, priority: event.target.value as DayPlanPriority }))}><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select><button type="button" disabled={!newTask.title.trim() || !newTask.project} onClick={addTask}><Plus size={13}/>Add</button></div></section><header><span>Other pending tasks</span><b>{pending.length}</b></header><div>{pending.map((task) => <button type="button" onClick={() => toggleTask(task.id)} key={task.id}><span><small>{task.project}</small><strong>{task.title}</strong></span><em className={`shared-priority ${task.priority.toLowerCase()}`}>{task.priority}</em><Plus size={14}/></button>)}{!pending.length && <p>All available work is already in today’s plan.</p>}</div></aside>
    </div>
    <label className="shared-day-remarks"><span>Overall remarks <small>optional</small></span><textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Meetings, dependencies, handover context or decisions needed…" rows={3}/></label>
    <footer><span>{selected.length} tasks selected</span><div><button type="button" onClick={onCancel}>Cancel</button><button type="button" className="primary" disabled={!focus.trim() || !selected.length} onClick={() => onStart({ focus: focus.trim(), remarks: remarks.trim(), tasks: selected })}>Confirm plan & start <ArrowRight size={14}/></button></div></footer>
  </div>;
};

export default SharedStartDayPlanner;
