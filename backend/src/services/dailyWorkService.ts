import { env } from '../config/env';
import { dailyWorkRepository } from '../repositories/dailyWorkRepository';
import { projectRepository } from '../repositories/projectRepository';
import { badRequest, forbidden, notFound, HttpError } from '../utils/httpError';
import { canApproveAgentWork } from '../utils/roles';
import { workDateForTimezone } from '../utils/workDate';
import { checkCommitments, checkQuickAddTarget, checkWorkTarget } from '../policies/workGatePolicy';
import { projectStage, taskStage, workGateRepository } from '../repositories/workGateRepository';
import { projectTaskRepository } from '../repositories/projectTaskRepository';
import { activityLogRepository } from '../repositories/activityLogRepository';
import { requiresCarryoverReason } from '../utils/dailyPlanRules';

interface Actor { id: string; role: string; timezone?: string; organizationId?: string; departmentId?: string | null }
const timezoneOf = (actor: Actor) => actor.timezone || 'Asia/Dubai';
const dateOf = (actor: Actor) => workDateForTimezone(timezoneOf(actor));
const dto = (session: any, logs: any[] = [], commitments: any[] = []) => ({
  _id: session.id, userId: session.user_id, user: session.user, date: session.work_date, timezone: session.timezone,
  startAt: session.start_at, endAt: session.end_at, status: session.status, logs: logs.map((log: any) => ({
    _id: log.id, sessionId: log.session_id, userId: log.user_id, projectId: log.project_id, project: log.project,
    taskId: log.task_id, task: log.task, title: log.title, description: log.description, minutes: log.minutes ?? null, createdAt: log.created_at,
  })),
  commitments: commitments.map((row: any) => ({
    taskId: row.task_id, position: row.position, outcome: row.outcome, carryReason: row.carry_reason,
    task: row.task ? { _id: row.task.id, title: row.task.title, projectId: row.task.project_id, projectName: row.task.project?.name || null, stage: taskStage(row.task), carryForwardCount: row.task.carry_forward_count || 0 } : null,
  })),
});
const gate = (result: { ok: boolean; status?: number; message?: string }) => { if (!result.ok) throw new HttpError(result.status!, result.message!); };
const full = async (session: any) => dto(session, await dailyWorkRepository.logs(session.id), await dailyWorkRepository.commitments(session.id));
const localHourMinute = (date: Date, timezone: string) => new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);

export const dailyWorkService = {
  async current(actor: Actor) {
    const session = await dailyWorkRepository.current(actor.id, dateOf(actor));
    return session ? full(session) : null;
  },
  async history(month: string, actor: Actor) {
    if (!/^\d{4}-\d{2}$/.test(month)) throw badRequest('Choose a valid history month');
    const [year, monthNumber] = month.split('-').map(Number);
    const endDate = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
    return (await dailyWorkRepository.history(actor.id, `${month}-01`, endDate)).map((session: any) => dto(session, session.logs || []));
  },
  async start(input: { commitments?: string[]; newTask?: { title: string; projectId?: string } }, actor: Actor) {
    if (!actor.organizationId) throw badRequest('Your account is not assigned to an organization');
    const existing = await dailyWorkRepository.current(actor.id, dateOf(actor));
    if (existing) {
      if (existing.status === 'ACTIVE') throw badRequest(`You already started your day at ${new Date(existing.start_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`);
      throw badRequest('Your workday is already completed for today.');
    }
    const commitments = input.newTask ? [(await this.quickAdd(input.newTask, actor)).id] : input.commitments || [];
    gate(checkCommitments({ taskIds: commitments, limits: await workGateRepository.limits(actor.organizationId) }));
    for (const taskId of commitments) await this.assertWorkTarget(taskId, actor);
    const session = await dailyWorkRepository.create({ organization_id: actor.organizationId, user_id: actor.id, work_date: dateOf(actor), timezone: timezoneOf(actor) });
    await dailyWorkRepository.addCommitments(commitments.map((taskId, index) => ({ session_id: session.id, task_id: taskId, position: index + 1 })));
    return full(session);
  },
  async assertWorkTarget(taskId: string, actor: Actor) {
    const task = await projectTaskRepository.findById(taskId);
    if (!task) throw notFound('Task not found');
    const project = await projectRepository.findById(task.project_id);
    if (!project || project.archived) throw notFound('Project not found');
    gate(checkWorkTarget({
      actorId: actor.id,
      task: { assignedTo: task.assigned_to, collaboratorIds: await workGateRepository.collaboratorIds(taskId), stage: taskStage(task) },
      project: { kind: project.kind || 'DELIVERY', stage: projectStage(project) },
    }));
    return { task, project };
  },
  async end(outcomes: { taskId: string; outcome: 'DONE' | 'CARRIED' | 'BLOCKED'; reason?: string }[], actor: Actor) {
    const session = await dailyWorkRepository.current(actor.id, dateOf(actor));
    if (!session) throw notFound('Start your day before ending it');
    if (session.status !== 'ACTIVE') throw badRequest('SESSION ALREADY COMPLETED');
    const commitments = await dailyWorkRepository.commitments(session.id);
    const byTask = new Map(outcomes.map((item) => [item.taskId, item]));
    const missing = commitments.filter((row: any) => !byTask.has(row.task_id));
    if (missing.length) throw badRequest(`Tell us how today went for: ${missing.map((row: any) => row.task?.title || 'a committed task').join(', ')}`);
    for (const row of commitments) {
      const item = byTask.get(row.task_id)!;
      if (item.outcome === 'CARRIED' && requiresCarryoverReason(row.task?.carry_forward_count || 0) && !item.reason?.trim()) throw badRequest(`"${row.task?.title}" has been carried over ${row.task?.carry_forward_count} times. Say why before carrying it again.`);
    }
    for (const row of commitments) {
      const item = byTask.get(row.task_id)!;
      await dailyWorkRepository.setOutcome(session.id, row.task_id, item.outcome, item.reason?.trim() || null);
    }
    await dailyWorkRepository.incrementCarry(commitments.filter((row: any) => byTask.get(row.task_id)!.outcome === 'CARRIED').map((row: any) => row.task_id));
    return full(await dailyWorkRepository.complete(session.id, 'COMPLETED', new Date().toISOString()));
  },
  async addLog(input: { taskId?: string; newTask?: { title: string; projectId?: string }; title: string; description: string; minutes?: number }, actor: Actor) {
    const session = await dailyWorkRepository.current(actor.id, dateOf(actor));
    if (!session || session.status !== 'ACTIVE') throw badRequest('Please Start My Day before recording work.');
    const taskId = input.taskId || (await this.quickAdd(input.newTask!, actor)).id;
    const { task } = await this.assertWorkTarget(taskId, actor);
    const log = await dailyWorkRepository.addLog({ session_id: session.id, organization_id: session.organization_id, user_id: actor.id, project_id: task.project_id, task_id: taskId, title: input.title.trim(), description: input.description.trim(), minutes: input.minutes ?? null });
    if (input.minutes) await dailyWorkRepository.addActualMinutes(taskId, input.minutes);
    return { ...dto(session), logs: [dto(session, [log]).logs[0]] };
  },
  async quickAdd(input: { title: string; projectId?: string }, actor: Actor) {
    const opsProject = await workGateRepository.opsProjectFor(actor);
    const project = input.projectId ? await projectRepository.findById(input.projectId) : opsProject;
    if (!project) throw badRequest(input.projectId ? 'Project not found' : 'Choose a project for this task');
    if (project.archived) throw notFound('Project not found');
    if (project.organization_id !== actor.organizationId) throw forbidden('You can only add tasks to your own organization');
    const isMember = project.owner_id === actor.id || await projectRepository.isMemberAssigned(project.id, actor.id);
    gate(checkQuickAddTarget({ project: { kind: project.kind || 'DELIVERY', stage: projectStage(project) }, isMember, isOwnOps: project.id === opsProject?.id }));
    if (!isMember) await projectRepository.addMembers(project.id, [actor.id]);
    const task = await projectTaskRepository.create({
      project_id: project.id, organization_id: project.organization_id, title: input.title.trim(), status: 'Pending', canonical_status: 'BACKLOG',
      priority: 'Medium', assigned_to: actor.id, created_by: actor.id, reporter_user_id: actor.id, estimate_minutes: 60, remaining_estimate_minutes: 60,
    } as any);
    await activityLogRepository.create({
      action: 'Task Created', user_id: actor.id, project_id: project.id, details: `${input.title.trim()} was quick-added from My Day.`,
      event: { eventType: 'TASK_CREATED', entityType: 'TASK', entityId: task.id, payload: { source: 'QUICK_ADD', projectKind: project.kind || 'DELIVERY' } },
    });
    return task;
  },
  async admin(filters: { date?: string; startDate?: string; endDate?: string; userId?: string; status?: string; projectId?: string }, actor: Actor) {
    if (!canApproveAgentWork(actor.role)) throw forbidden('You do not have permission to view team work logs');
    if (!actor.organizationId) throw badRequest('Your account is not assigned to an organization');
    return (await dailyWorkRepository.adminSessions(filters)).filter((session: any) => session.organization_id === actor.organizationId).map((session: any) => dto(session, session.logs || []));
  },
  async autoCloseExpired() {
    const now = new Date();
    const [hour, minute] = env.workdayEndTime.split(':').map(Number);
    for (const session of await dailyWorkRepository.activeSessions()) {
      const [currentHour, currentMinute] = localHourMinute(now, session.timezone).split(':').map(Number);
      if (currentHour > hour || (currentHour === hour && currentMinute >= minute)) {
        await dailyWorkRepository.complete(session.id, 'AUTO_COMPLETED', now.toISOString());
        await dailyWorkRepository.incrementCarry(await dailyWorkRepository.markUnresolvedCarried(session.id));
      }
    }
  },
};
