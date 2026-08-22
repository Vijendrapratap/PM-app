import { activityLogRepository } from '../repositories/activityLogRepository';
import { workdayRepository } from '../repositories/workdayRepository';
import { workSessionRepository } from '../repositories/workSessionRepository';
import { badRequest, forbidden, notFound } from '../utils/httpError';
import { elapsedMinutes } from '../utils/duration';
import { projectTaskService } from './projectTaskService';
import { boundedFocusMinutes, focusBlockLimitMinutes } from '../utils/focusSession';

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

const plannedMinutesFor = (plan: any, taskId?: string | null, note?: string | null) =>
  (plan?.items || []).find((item: any) => taskId ? item.task_id === taskId : !item.task_id && (!note || item.title === note))?.planned_estimate_minutes;

export const workSessionService = {
  async start(input: { dailyPlanId: string; taskId?: string | null; note?: string }, actor: Actor) {
    if (!actor.organizationId) throw badRequest('Your account is not assigned to an organization');
    const plan = await workdayRepository.findById(input.dailyPlanId);
    if (!plan) throw notFound('Daily plan not found');
    if (plan.user_id !== actor.id) throw forbidden('You can only start a session for your own plan');
    if (plan.status === 'Completed') throw badRequest('Reopen the daily plan before starting another session');
    const plannedItem = (plan.items || []).find((item: any) => input.taskId ? item.task_id === input.taskId : !item.task_id && item.title === input.note)
      || (plan.items || []).find((item: any) => item.task_id === (input.taskId || null));
    if (!plannedItem) throw forbidden('You can only track time against a task in today\'s plan');

    const active = await workSessionRepository.findActiveForUser(actor.id);
    if (active?.daily_plan_id === input.dailyPlanId && active.task_id === (input.taskId || null) && (input.taskId || active.note === input.note)) return toDto(active);
    if (active) await this.stop(active.id, 'PAUSED', actor);

    const session = await workSessionRepository.create({
      organization_id: actor.organizationId,
      user_id: actor.id,
      daily_plan_id: input.dailyPlanId,
      task_id: input.taskId,
      note: input.note?.trim() || null,
    });
    if (plannedItem.status !== 'Completed') {
      await workdayRepository.updateItem(plannedItem.id, { status: 'In Progress' });
      const task = plannedItem.task;
      if (task && input.taskId && plannedItem.project_id && task.status !== 'In Progress') {
        await projectTaskService.update(plannedItem.project_id, input.taskId, { status: 'In Progress' }, actor);
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
    let sessions = await workSessionRepository.findForPlan(dailyPlanId);
    const now = new Date().toISOString();
    const active = sessions.find((session) => session.status === 'ACTIVE');
    if (active && elapsedMinutes(active.started_at, now) >= focusBlockLimitMinutes(plannedMinutesFor(plan, active.task_id, active.note))) {
      await this.stop(active.id, 'PAUSED', actor);
      sessions = await workSessionRepository.findForPlan(dailyPlanId);
    }
    const totalMinutes = sessions.reduce((total, session) => total + (
      session.status === 'ACTIVE'
        ? boundedFocusMinutes(elapsedMinutes(session.started_at, now), plannedMinutesFor(plan, session.task_id, session.note))
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
    const plan = await workdayRepository.findById(session.daily_plan_id);
    const updated = await workSessionRepository.update(id, {
      status,
      ended_at: endedAt,
      duration_minutes: boundedFocusMinutes(elapsedMinutes(session.started_at, endedAt), plannedMinutesFor(plan, session.task_id, session.note)),
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
