// Every task-first rule in one place. Pure functions: services load the facts,
// call these, and only write when the result is ok.
export type ProjectStage = 'DRAFT' | 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED' | 'CANCELLED';
export type ProjectKind = 'DELIVERY' | 'STANDING';
export type TaskStage = 'BACKLOG' | 'READY' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED' | 'DEFERRED';

export interface WorkLimits {
  maxActiveProjectsPerOwner: number;
  maxActiveProjectsOrg: number;
  maxInProgressPerPerson: number;
  maxDailyCommitments: number;
  staleProjectDays: number;
  staleTaskDays: number;
}

export const DEFAULT_LIMITS: WorkLimits = {
  maxActiveProjectsPerOwner: 2, maxActiveProjectsOrg: 6, maxInProgressPerPerson: 2,
  maxDailyCommitments: 3, staleProjectDays: 5, staleTaskDays: 3,
};

export interface BriefFacts {
  objective: string | null;
  successCriteria: unknown[];
  ownerId: string | null;
  targetDate: string | null;
  milestoneCount: number;
  tasks: { assignedTo: string | null; estimateMinutes: number | null; stage: TaskStage }[];
}

export type GateResult = { ok: true; overrideUsed?: boolean } | { ok: false; status: 400 | 403 | 409; message: string };

export interface TransitionInput {
  from: ProjectStage;
  to: ProjectStage;
  kind: ProjectKind;
  isOwner: boolean;
  canManage: boolean;
  isCeo: boolean;
  reason?: string;
  override?: boolean;
  brief: BriefFacts;
  activeCounts: { owner: number; org: number };
  limits: WorkLimits;
}

// BACKLOG is startable until Plan 2 introduces a real READY step: `pause`
// maps to Pending/BACKLOG today, so most live tasks sit there.
export const OPEN_TASK_STAGES: TaskStage[] = ['BACKLOG', 'READY', 'IN_PROGRESS'];

const fail = (status: 400 | 403 | 409, message: string): GateResult => ({ ok: false, status, message });
const hasText = (value?: string | null) => Boolean(value && value.trim());

export const briefGaps = (brief: BriefFacts): string[] => {
  const tasks = brief.tasks.filter((task) => task.stage !== 'CANCELLED');
  return [
    !hasText(brief.objective) && 'objective',
    !brief.successCriteria.length && 'success criteria',
    !brief.ownerId && 'owner',
    !brief.targetDate && 'target date',
    brief.milestoneCount < 1 && 'at least one milestone',
    !tasks.length && 'at least one task',
    tasks.some((task) => !task.assignedTo || !task.estimateMinutes) && 'every task needs an assignee and estimate',
  ].filter((gap): gap is string => Boolean(gap));
};

type Rule = { who: 'owner' | 'manager'; brief?: boolean; caps?: boolean; reason?: string };
const RULES: Partial<Record<ProjectStage, Partial<Record<ProjectStage, Rule>>>> = {
  DRAFT: { PLANNING: { who: 'owner', brief: true }, CANCELLED: { who: 'manager', reason: 'cancelling' } },
  PLANNING: { ACTIVE: { who: 'manager', brief: true, caps: true }, ON_HOLD: { who: 'owner', reason: 'parking' }, CANCELLED: { who: 'manager', reason: 'cancelling' } },
  ACTIVE: { ON_HOLD: { who: 'owner', reason: 'parking' }, CANCELLED: { who: 'manager', reason: 'cancelling' } },
  ON_HOLD: { ACTIVE: { who: 'manager', caps: true }, CANCELLED: { who: 'manager', reason: 'cancelling' } },
};

export const checkProjectTransition = (input: TransitionInput): GateResult => {
  if (input.kind === 'STANDING') return fail(400, 'Standing ops projects are always active');
  if (input.to === 'COMPLETED') return fail(400, 'Use Finish project to deliver a project');
  const rule = RULES[input.from]?.[input.to];
  if (!rule) return fail(400, `A project cannot move from ${input.from} to ${input.to}`);
  const allowed = rule.who === 'owner' ? input.isOwner || input.canManage : input.canManage;
  if (!allowed) return fail(403, rule.who === 'owner' ? 'Only the project owner or a manager can do this' : 'Only a project manager or the CEO can do this');
  if (rule.reason && !hasText(input.reason)) return fail(400, `Give a reason for ${rule.reason} this project`);
  if (rule.brief) {
    const gaps = briefGaps(input.brief);
    if (gaps.length) return fail(400, `Complete the brief first: ${gaps.join(', ')}`);
  }
  if (rule.caps) {
    const { owner, org } = input.activeCounts;
    const { maxActiveProjectsPerOwner: ownerCap, maxActiveProjectsOrg: orgCap } = input.limits;
    const breach = owner >= ownerCap
      ? `This owner already has ${owner} active projects (limit ${ownerCap}). Park or finish one first.`
      : org >= orgCap ? `The company already has ${org} active projects (limit ${orgCap}). Park or finish one first.` : null;
    if (breach) {
      if (input.override && input.isCeo && hasText(input.reason)) return { ok: true, overrideUsed: true };
      return fail(409, breach);
    }
  }
  return { ok: true, overrideUsed: false };
};

export const checkCommitments = ({ taskIds, limits }: { taskIds: string[]; limits: WorkLimits }): GateResult => {
  if (!taskIds.length) return fail(400, 'Commit to at least one task for today');
  if (taskIds.length > limits.maxDailyCommitments) return fail(400, `Commit to at most ${limits.maxDailyCommitments} tasks per day`);
  if (new Set(taskIds).size !== taskIds.length) return fail(400, 'Each task can be committed once');
  return { ok: true };
};

export const isLoggableProject = (project: { kind: ProjectKind; stage: ProjectStage }) =>
  project.kind === 'STANDING' || project.stage === 'ACTIVE';

export const checkWorkTarget = (input: {
  actorId: string;
  task: { assignedTo: string | null; collaboratorIds: string[]; stage: TaskStage };
  project: { kind: ProjectKind; stage: ProjectStage };
}): GateResult => {
  if (input.task.assignedTo !== input.actorId && !input.task.collaboratorIds.includes(input.actorId)) return fail(403, 'You can only record work on tasks assigned to you');
  if (!OPEN_TASK_STAGES.includes(input.task.stage)) return fail(400, 'This task is closed');
  if (!isLoggableProject(input.project)) return fail(400, 'This project is not active');
  return { ok: true };
};

// Only the user's own ops project may auto-join them; anything else needs existing membership.
export const checkQuickAddTarget = (input: { project: { kind: ProjectKind; stage: ProjectStage }; isMember: boolean; isOwnOps: boolean }): GateResult => {
  if (!isLoggableProject(input.project)) return fail(400, 'This project is not active');
  if (!input.isMember && !input.isOwnOps) return fail(403, 'You can only add tasks to projects you are a member of');
  return { ok: true };
};

export const checkStartTask = ({ inProgressCount, limits }: { inProgressCount: number; limits: WorkLimits }): GateResult =>
  inProgressCount >= limits.maxInProgressPerPerson
    ? fail(409, `You already have ${inProgressCount} tasks in progress (limit ${limits.maxInProgressPerPerson}). Finish, pause or send one for review first.`)
    : { ok: true };

export type DayOutcome = 'DONE' | 'CARRIED' | 'DELAYED' | 'BLOCKED';
export const DELAY_REASONS = ['OTHER_TASK', 'URGENT_REQUEST', 'WAITING_ON_SOMEONE', 'MEETINGS', 'UNCLEAR_REQUIREMENTS', 'LEAVE', 'OTHER'] as const;
export type DelayReason = (typeof DELAY_REASONS)[number];
export interface DayCloseAnswer { taskId: string; outcome: DayOutcome; reasonCode?: DelayReason; reason?: string }

// Every task touched today (committed or logged) needs an explicit answer.
export const checkDayClose = ({ tasks, outcomes }: { tasks: { id: string; title: string; carryForwardCount: number }[]; outcomes: DayCloseAnswer[] }): GateResult => {
  const byTask = new Map(outcomes.map((item) => [item.taskId, item]));
  const missing = tasks.filter((task) => !byTask.has(task.id));
  if (missing.length) return fail(400, `Tell us how today went for: ${missing.map((task) => task.title).join(', ')}`);
  for (const task of tasks) {
    const answer = byTask.get(task.id)!;
    if ((answer.outcome === 'DELAYED' || answer.outcome === 'BLOCKED') && !answer.reasonCode) return fail(400, `Pick a reason why "${task.title}" was ${answer.outcome.toLowerCase()}`);
    if (answer.reasonCode === 'OTHER' && !hasText(answer.reason)) return fail(400, `Add a note for "${task.title}"`);
    if (answer.outcome === 'CARRIED' && task.carryForwardCount >= 2 && !hasText(answer.reason)) return fail(400, `"${task.title}" has been carried over ${task.carryForwardCount} times. Say why before carrying it again.`);
  }
  return { ok: true };
};
