import { activityLogRepository } from '../repositories/activityLogRepository';
import { workdayRepository } from '../repositories/workdayRepository';
import { workSessionRepository } from '../repositories/workSessionRepository';
import { badRequest, forbidden, notFound } from '../utils/httpError';
import { elapsedMinutes } from '../utils/duration';
import { projectTaskService } from './projectTaskService';

interface Actor { id: string; role: string; organizationId?: string }

const toDto = (session: any) => ({
  _id: session.id,
  dailyPlanId: session.daily_plan_id,
  taskId: session.task_id,
  status: session.status,
  startedAt: session.started_at,
  endedAt: session.ended_at,
  durationMinutes: session.duration_minutes,
  note: session.note,
});

const assertOwner = async (sessionId: string, actor: Actor) => {
  const session = await workSessionRepository.findById(sessionId);
  if (!session) throw notFound('Work session not found');
  if (session.user_id !== actor.id) throw forbidden('You can only update your own work session');
  return session;
};

export const workSessionService = {
  async start(input: { dailyPlanId: string; taskId?: string; note?: string }, actor: Actor) {
    if (!actor.organizationId) throw badRequest('Your account is not assigned to an organization');
    const plan = await workdayRepository.findById(input.dailyPlanId);
    if (!plan) throw notFound('Daily plan not found');
    if (plan.user_id !== actor.id) throw forbidden('You can only start a session for your own plan');
    if (plan.status === 'Completed') throw badRequest('Reopen the daily plan before starting another session');
    if (input.taskId) {
      const plannedItem = (plan.items || []).find((item: any) => item.task_id === input.taskId);
      if (!plannedItem) throw forbidden('You can only track time against a task in today\'s plan');
    }

    const active = await workSessionRepository.findActiveForUser(actor.id);
    if (active?.daily_plan_id === input.dailyPlanId && active.task_id === (input.taskId || null)) return toDto(active);
    if (active) await this.stop(active.id, 'PAUSED', actor);

    const session = await workSessionRepository.create({
      organization_id: actor.organizationId,
      user_id: actor.id,
      daily_plan_id: input.dailyPlanId,
      task_id: input.taskId || null,
      note: input.note?.trim() || null,
    });
    if (input.taskId) {
      const plannedItem = (plan.items || []).find((item: any) => item.task_id === input.taskId);
      if (plannedItem?.status !== 'Completed') {
        await workdayRepository.updateItem(plannedItem.id, { status: 'In Progress' });
        const task = plannedItem.task;
        if (task && task.status !== 'In Progress') {
          await projectTaskService.update(plannedItem.project_id, input.taskId, { status: 'In Progress' }, actor);
        }
      }
    }
    await activityLogRepository.create({
      action: 'Work Session Started', user_id: actor.id, details: 'A work session was started.',
      event: { eventType: 'WORK_SESSION_STARTED', entityType: 'WORK_SESSION', entityId: session.id, payload: { dailyPlanId: input.dailyPlanId, taskId: input.taskId } },
    });
    return toDto(session);
  },

  async summary(dailyPlanId: string, actor: Actor) {
    const plan = await workdayRepository.findById(dailyPlanId);
    if (!plan) throw notFound('Daily plan not found');
    if (plan.user_id !== actor.id) throw forbidden('You can only view time tracked for your own daily plan');
    const sessions = await workSessionRepository.findForPlan(dailyPlanId);
    const now = new Date().toISOString();
    const totalMinutes = sessions.reduce((total, session) => total + (
      session.status === 'ACTIVE'
        ? elapsedMinutes(session.started_at, now)
        : Number(session.duration_minutes || 0)
    ), 0);
    return {
      dailyPlanId,
      totalMinutes,
      activeSession: sessions.find((session) => session.status === 'ACTIVE') ? toDto(sessions.find((session) => session.status === 'ACTIVE')) : null,
      sessions: sessions.map(toDto),
    };
  },

  async stop(id: string, status: 'PAUSED' | 'CLOSED', actor: Actor) {
    const session = await assertOwner(id, actor);
    if (session.status === 'CLOSED') return toDto(session);
    const endedAt = new Date().toISOString();
    const updated = await workSessionRepository.update(id, {
      status,
      ended_at: endedAt,
      duration_minutes: elapsedMinutes(session.started_at, endedAt),
    });
    await activityLogRepository.create({
      action: status === 'PAUSED' ? 'Work Session Paused' : 'Work Session Closed',
      user_id: actor.id,
      details: `Work session ${status.toLowerCase()}.`,
      event: { eventType: status === 'PAUSED' ? 'WORK_SESSION_PAUSED' : 'WORK_SESSION_CLOSED', entityType: 'WORK_SESSION', entityId: id, payload: { durationMinutes: updated.duration_minutes } },
    });
    return toDto(updated);
  },

  async note(id: string, note: string, actor: Actor) {
    await assertOwner(id, actor);
    return toDto(await workSessionRepository.update(id, { note: note.trim() || null }));
  },

  async closeActive(actor: Actor) {
    const active = await workSessionRepository.findActiveForUser(actor.id);
    if (active) await this.stop(active.id, 'CLOSED', actor);
  },

  async closeActiveTask(taskId: string, actor: Actor) {
    const active = await workSessionRepository.findActiveForUser(actor.id);
    if (active?.task_id === taskId) await this.stop(active.id, 'CLOSED', actor);
  },
};
