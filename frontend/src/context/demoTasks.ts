import type { DailyTodo } from '../api/todoApi';
import type { Priority, TaskStatus } from '../types';

const STORAGE_KEY = 'pratap-demo-tasks-v3';

const dateKey = (offset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toLocaleDateString('en-CA');
};

const seedTasks = (): DailyTodo[] => {
  const now = new Date().toISOString();
  const person = { _id: 'demo-ceo', name: 'Vijendra Pratap Singh' };
  const defaults = { domainType: 'PERSONAL', workType: 'TASK', recurrence: 'NONE', scheduledStart: null, scheduledEnd: null, meetingWith: null, channel: null } as const;
  return [
    { ...defaults, _id: 'demo-routine-linkedin', title: 'Publish LinkedIn post', description: 'Publish today’s business or product insight and respond to early engagement.', domainType: 'MARKETING', workType: 'UPDATE', recurrence: 'WEEKDAYS', channel: 'LinkedIn', scheduledStart: `${dateKey()}T09:30:00.000Z`, dueDate: dateKey(), originalDueDate: dateKey(), carryForwardCount: 0, daysOverdue: 0, priority: 'High', status: 'Pending', assignedTo: person, createdBy: person, completedAt: null, documents: [], subtasks: [], createdAt: now, updatedAt: now, source: 'PERSONAL', project: null },
    { ...defaults, _id: 'demo-routine-twitter', title: 'Publish Twitter / X post', description: 'Share a concise insight from the current work.', domainType: 'MARKETING', workType: 'UPDATE', recurrence: 'DAILY', channel: 'Twitter / X', scheduledStart: `${dateKey()}T11:30:00.000Z`, dueDate: dateKey(), originalDueDate: dateKey(), carryForwardCount: 0, daysOverdue: 0, priority: 'Medium', status: 'Pending', assignedTo: person, createdBy: person, completedAt: null, documents: [], subtasks: [], createdAt: now, updatedAt: now, source: 'PERSONAL', project: null },
    { ...defaults, _id: 'demo-routine-reddit', title: 'Contribute to a relevant Reddit discussion', description: 'Add useful context first; share a link only where it is genuinely relevant.', domainType: 'MARKETING', workType: 'UPDATE', recurrence: 'WEEKDAYS', channel: 'Reddit', scheduledStart: `${dateKey()}T14:00:00.000Z`, dueDate: dateKey(), originalDueDate: dateKey(), carryForwardCount: 0, daysOverdue: 0, priority: 'Medium', status: 'Pending', assignedTo: person, createdBy: person, completedAt: null, documents: [], subtasks: [], createdAt: now, updatedAt: now, source: 'PERSONAL', project: null },
    { ...defaults, _id: 'demo-routine-instagram', title: 'Publish Instagram update', description: 'Adapt today’s strongest idea into a clear visual post or reel update.', domainType: 'MARKETING', workType: 'UPDATE', recurrence: 'WEEKDAYS', channel: 'Instagram', scheduledStart: `${dateKey()}T18:00:00.000Z`, dueDate: dateKey(), originalDueDate: dateKey(), carryForwardCount: 0, daysOverdue: 0, priority: 'Medium', status: 'Pending', assignedTo: person, createdBy: person, completedAt: null, documents: [], subtasks: [], createdAt: now, updatedAt: now, source: 'PERSONAL', project: null },
    { ...defaults, _id: 'demo-routine-dm', title: 'Reach out through LinkedIn DMs', description: 'Send thoughtful, relevant direct messages and record important replies.', domainType: 'MARKETING', recurrence: 'WEEKDAYS', channel: 'LinkedIn', dueDate: dateKey(), originalDueDate: dateKey(), carryForwardCount: 0, daysOverdue: 0, priority: 'High', status: 'In Progress', assignedTo: person, createdBy: person, completedAt: null, documents: [], subtasks: [], createdAt: now, updatedAt: now, source: 'PERSONAL', project: null },
    { ...defaults, _id: 'demo-routine-connections', title: 'Send targeted LinkedIn connection requests', description: 'Connect with people who match today’s relationship or business goal.', domainType: 'MARKETING', recurrence: 'WEEKDAYS', channel: 'LinkedIn', dueDate: dateKey(), originalDueDate: dateKey(), carryForwardCount: 0, daysOverdue: 0, priority: 'Medium', status: 'Pending', assignedTo: person, createdBy: person, completedAt: null, documents: [], subtasks: [], createdAt: now, updatedAt: now, source: 'PERSONAL', project: null },
    { ...defaults, _id: 'demo-routine-email', title: 'Send email outreach batch', description: 'Send the prepared email batch and capture replies requiring follow-up.', domainType: 'MARKETING', workType: 'UPDATE', recurrence: 'WEEKDAYS', channel: 'Email', scheduledStart: `${dateKey()}T12:00:00.000Z`, dueDate: dateKey(), originalDueDate: dateKey(), carryForwardCount: 0, daysOverdue: 0, priority: 'High', status: 'Pending', assignedTo: person, createdBy: person, completedAt: null, documents: [], subtasks: [], createdAt: now, updatedAt: now, source: 'PERSONAL', project: null },
    { ...defaults, _id: 'demo-routine-video', title: 'Record short-form product video', description: 'Record one useful video that can be adapted for LinkedIn and Instagram.', domainType: 'MARKETING', recurrence: 'WEEKLY', channel: 'LinkedIn + Instagram', dueDate: dateKey(2), originalDueDate: dateKey(2), carryForwardCount: 0, daysOverdue: 0, priority: 'High', status: 'Pending', assignedTo: person, createdBy: person, completedAt: null, documents: [], subtasks: [], createdAt: now, updatedAt: now, source: 'PERSONAL', project: null },
    { ...defaults, _id: 'demo-routine-development', title: 'Move Pratap AI Operations Studio development forward', description: 'Review the current build, choose one shippable improvement and complete or clearly advance it.', domainType: 'DEVELOPMENT', recurrence: 'DAILY', dueDate: dateKey(), originalDueDate: dateKey(), carryForwardCount: 0, daysOverdue: 0, priority: 'Critical', status: 'In Progress', assignedTo: person, createdBy: person, completedAt: null, documents: [], subtasks: [], createdAt: now, updatedAt: now, source: 'PERSONAL', project: null },
    { ...defaults, _id: 'demo-routine-meeting', title: 'Daily leadership check-in', description: 'Review delivery risks, decisions and the next owner for each issue.', domainType: 'OPERATIONS', workType: 'MEETING', recurrence: 'WEEKDAYS', meetingWith: 'Leadership team', scheduledStart: `${dateKey()}T06:00:00.000Z`, scheduledEnd: `${dateKey()}T06:30:00.000Z`, dueDate: dateKey(), originalDueDate: dateKey(), carryForwardCount: 0, daysOverdue: 0, priority: 'High', status: 'Pending', assignedTo: person, createdBy: person, completedAt: null, documents: [], subtasks: [], createdAt: now, updatedAt: now, source: 'PERSONAL', project: null },
    { ...defaults, _id: 'demo-routine-update', title: 'Share daily leadership update', description: 'Summarize progress, blockers, decisions and tomorrow’s focus.', domainType: 'OPERATIONS', workType: 'UPDATE', recurrence: 'DAILY', channel: 'Internal team', scheduledStart: `${dateKey()}T13:30:00.000Z`, dueDate: dateKey(), originalDueDate: dateKey(), carryForwardCount: 0, daysOverdue: 0, priority: 'High', status: 'Pending', assignedTo: person, createdBy: person, completedAt: null, documents: [], subtasks: [], createdAt: now, updatedAt: now, source: 'PERSONAL', project: null },
    { ...defaults, _id: 'demo-task-1', title: 'Review AI Interviewer scoring proposal', description: 'Confirm the evidence and approval flow before publishing the plan.', dueDate: dateKey(), originalDueDate: dateKey(), carryForwardCount: 0, daysOverdue: 0, priority: 'High', status: 'In Review', assignedTo: person, createdBy: person, completedAt: null, documents: [], subtasks: [], createdAt: now, updatedAt: now, source: 'PROJECT', project: { _id: 'ai-interviewer', name: 'AI Interviewer Platform', department: 'Development' } },
    { ...defaults, _id: 'demo-task-2', title: 'Resolve property enquiry assignment', description: 'Confirm the assignment rule so real-estate validation can continue.', dueDate: dateKey(), originalDueDate: dateKey(-1), carryForwardCount: 1, daysOverdue: 0, priority: 'Critical', status: 'Blocked', assignedTo: person, createdBy: { _id: 'demo-delivery', name: 'Govind' }, completedAt: null, documents: [], subtasks: [], createdAt: now, updatedAt: now, source: 'PROJECT', project: { _id: 'real-estate', name: 'Real Estate Complete Module', department: 'Development' } },
    { ...defaults, _id: 'demo-task-3', title: 'Prepare the weekly leadership notes', description: 'Capture decisions, owners and follow-up items for the delivery review.', domainType: 'OPERATIONS', dueDate: dateKey(), originalDueDate: dateKey(), carryForwardCount: 0, daysOverdue: 0, priority: 'Medium', status: 'Pending', assignedTo: person, createdBy: person, completedAt: null, documents: [], subtasks: [], createdAt: now, updatedAt: now, source: 'PERSONAL', project: null },
    { ...defaults, _id: 'demo-task-4', title: 'Review generated content batch', description: 'Approve or return content drafts with clear reasons.', dueDate: dateKey(1), originalDueDate: dateKey(1), carryForwardCount: 0, daysOverdue: 0, priority: 'High', status: 'Pending', assignedTo: person, createdBy: { _id: 'demo-cio', name: 'Priyanshu Rajbhar' }, completedAt: null, documents: [], subtasks: [], createdAt: now, updatedAt: now, source: 'PROJECT', project: { _id: 'content-engine', name: 'Content Engine', department: 'Marketing' } },
    { ...defaults, _id: 'demo-task-5', title: 'Prepare this week content plan', description: 'Confirm topics, formats, channels and approval owners.', dueDate: dateKey(), originalDueDate: dateKey(), carryForwardCount: 0, daysOverdue: 0, priority: 'Medium', status: 'In Progress', assignedTo: person, createdBy: { _id: 'demo-cio', name: 'Priyanshu Rajbhar' }, completedAt: null, documents: [], subtasks: [], createdAt: now, updatedAt: now, source: 'PROJECT', project: { _id: 'content-engine', name: 'Content Engine', department: 'Marketing' } },
    { ...defaults, _id: 'demo-task-6', title: 'Complete resort competitor comparison', description: 'Compare positioning, pricing, channels and customer experience.', dueDate: dateKey(), originalDueDate: dateKey(), carryForwardCount: 0, daysOverdue: 0, priority: 'High', status: 'Pending', assignedTo: person, createdBy: { _id: 'demo-sales', name: 'Satyam Tiwari' }, completedAt: null, documents: [], subtasks: [], createdAt: now, updatedAt: now, source: 'PROJECT', project: { _id: 'competitor-resort', name: 'Competitor Analysis (Resort)', department: 'Sales' } },
  ];
};

const read = (): DailyTodo[] => {
  if (typeof window === 'undefined') return seedTasks();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    if (!Array.isArray(parsed)) return seedTasks();
    const seeded = seedTasks();
    const refreshed = parsed.map((task) => {
      const seed = seeded.find((item) => item._id === task._id);
      return seed?.project && task.project && !task.project.department
        ? { ...task, project: { ...task.project, department: seed.project.department } }
        : task;
    });
    const ids = new Set(refreshed.map((task) => task._id));
    return [...refreshed, ...seeded.filter((task) => !ids.has(task._id))];
  } catch {
    return seedTasks();
  }
};

const write = (tasks: DailyTodo[]) => {
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
};

export const getDemoTasks = () => read();

export const createDemoTask = (input: { title: string; description?: string; dueDate?: string; priority?: Priority; project?: { _id: string; name: string; department?: string | null } | null; assignedTo?: { _id: string; name: string } | null; domainType?: DailyTodo['domainType']; workType?: DailyTodo['workType']; recurrence?: DailyTodo['recurrence']; scheduledStart?: string | null; scheduledEnd?: string | null; meetingWith?: string | null; channel?: string | null }) => {
  const now = new Date().toISOString();
  const owner = input.assignedTo || { _id: 'demo-ceo', name: 'Vijendra Pratap Singh' };
  const task: DailyTodo = {
    _id: `demo-task-${Date.now()}`,
    title: input.title,
    description: input.description || null,
    dueDate: input.dueDate || dateKey(),
    originalDueDate: input.dueDate || dateKey(),
    carryForwardCount: 0,
    daysOverdue: 0,
    priority: input.priority || 'Medium',
    status: 'Pending',
    assignedTo: owner,
    createdBy: owner,
    completedAt: null,
    domainType: input.domainType || 'PERSONAL',
    workType: input.workType || 'TASK',
    recurrence: input.recurrence || 'NONE',
    scheduledStart: input.scheduledStart || null,
    scheduledEnd: input.scheduledEnd || null,
    meetingWith: input.meetingWith || null,
    channel: input.channel || null,
    documents: [],
    subtasks: [],
    createdAt: now,
    updatedAt: now,
    source: input.project ? 'PROJECT' : 'PERSONAL',
    project: input.project || null,
  };
  write([task, ...read()]);
  return task;
};

export const updateDemoTask = (id: string, status: TaskStatus) => {
  const tasks = read().map((task) => task._id === id ? { ...task, status, completedAt: status === 'Completed' ? new Date().toISOString() : null, updatedAt: new Date().toISOString() } : task);
  write(tasks);
  return tasks.find((task) => task._id === id) || null;
};

export const updateDemoTaskDetails = (id: string, patch: Partial<Pick<DailyTodo, 'title' | 'description' | 'dueDate' | 'priority' | 'domainType' | 'workType' | 'recurrence' | 'scheduledStart' | 'scheduledEnd' | 'meetingWith' | 'channel'>>) => {
  const tasks = read().map((task) => task._id === id ? { ...task, ...patch, updatedAt: new Date().toISOString() } : task);
  write(tasks);
  return tasks.find((task) => task._id === id) || null;
};

export const removeDemoTask = (id: string) => write(read().filter((task) => task._id !== id));
