import { env } from '../config/env';
import { dailyWorkRepository } from '../repositories/dailyWorkRepository';
import { projectRepository } from '../repositories/projectRepository';
import { badRequest, forbidden, notFound } from '../utils/httpError';
import { isManager } from '../utils/roles';
import { workDateForTimezone } from '../utils/workDate';

interface Actor { id: string; role: string; timezone?: string; organizationId?: string }
const timezoneOf = (actor: Actor) => actor.timezone || 'Asia/Dubai';
const dateOf = (actor: Actor) => workDateForTimezone(timezoneOf(actor));
const dto = (session: any, logs: any[] = []) => ({
  _id: session.id, userId: session.user_id, user: session.user, date: session.work_date, timezone: session.timezone,
  startAt: session.start_at, endAt: session.end_at, status: session.status, logs: logs.map((log: any) => ({
    _id: log.id, sessionId: log.session_id, userId: log.user_id, projectId: log.project_id, project: log.project,
    taskId: log.task_id, task: log.task, title: log.title, description: log.description, createdAt: log.created_at,
  })),
});
const localHourMinute = (date: Date, timezone: string) => new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);

export const dailyWorkService = {
  async current(actor: Actor) {
    const session = await dailyWorkRepository.current(actor.id, dateOf(actor));
    return session ? dto(session, await dailyWorkRepository.logs(session.id)) : null;
  },
  async history(month: string, actor: Actor) {
    if (!/^\d{4}-\d{2}$/.test(month)) throw badRequest('Choose a valid history month');
    const [year, monthNumber] = month.split('-').map(Number);
    const endDate = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
    return (await dailyWorkRepository.history(actor.id, `${month}-01`, endDate)).map((session: any) => dto(session, session.logs || []));
  },
  async start(actor: Actor) {
    if (!actor.organizationId) throw badRequest('Your account is not assigned to an organization');
    const existing = await dailyWorkRepository.current(actor.id, dateOf(actor));
    if (existing) {
      if (existing.status === 'ACTIVE') throw badRequest(`You already started your day at ${new Date(existing.start_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`);
      throw badRequest('Your workday is already completed for today.');
    }
    const session = await dailyWorkRepository.create({ organization_id: actor.organizationId, user_id: actor.id, work_date: dateOf(actor), timezone: timezoneOf(actor) });
    return dto(session);
  },
  async end(actor: Actor) {
    const session = await dailyWorkRepository.current(actor.id, dateOf(actor));
    if (!session) throw notFound('Start your day before ending it');
    if (session.status !== 'ACTIVE') throw badRequest('SESSION ALREADY COMPLETED');
    return dto(await dailyWorkRepository.complete(session.id, 'COMPLETED', new Date().toISOString()), await dailyWorkRepository.logs(session.id));
  },
  async addLog(input: { projectId?: string; taskId?: string; title: string; description: string }, actor: Actor) {
    const session = await dailyWorkRepository.current(actor.id, dateOf(actor));
    if (!session || session.status !== 'ACTIVE') throw badRequest('Please Start My Day before recording work.');
    if (input.projectId) {
      const project = await projectRepository.findById(input.projectId);
      if (!project || project.archived || !(await projectRepository.isMemberAssigned(input.projectId, actor.id))) throw forbidden('You can only record work for projects assigned to you');
    }
    const log = await dailyWorkRepository.addLog({ session_id: session.id, organization_id: session.organization_id, user_id: actor.id, project_id: input.projectId || null, task_id: input.taskId || null, title: input.title.trim(), description: input.description.trim() });
    return { ...dto(session), logs: [dto(session, [log]).logs[0]] };
  },
  async admin(filters: { date?: string; startDate?: string; endDate?: string; userId?: string; status?: string; projectId?: string }, actor: Actor) {
    if (!isManager(actor.role)) throw forbidden('You do not have permission to view team work logs');
    if (!actor.organizationId) throw badRequest('Your account is not assigned to an organization');
    return (await dailyWorkRepository.adminSessions(filters)).filter((session: any) => session.organization_id === actor.organizationId).map((session: any) => dto(session, session.logs || []));
  },
  async autoCloseExpired() {
    const now = new Date();
    const [hour, minute] = env.workdayEndTime.split(':').map(Number);
    for (const session of await dailyWorkRepository.activeSessions()) {
      const [currentHour, currentMinute] = localHourMinute(now, session.timezone).split(':').map(Number);
      if (currentHour > hour || (currentHour === hour && currentMinute >= minute)) await dailyWorkRepository.complete(session.id, 'AUTO_COMPLETED', now.toISOString());
    }
  },
};