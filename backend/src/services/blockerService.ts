import { activityLogRepository } from '../repositories/activityLogRepository';
import { blockerRepository } from '../repositories/blockerRepository';
import { projectRepository } from '../repositories/projectRepository';
import { projectTaskRepository } from '../repositories/projectTaskRepository';
import { canManageProject, canUpdateTask } from '../policies/accessPolicy';
import { notificationService } from './notificationService';
import { badRequest, forbidden, notFound } from '../utils/httpError';

interface Actor { id: string; role: string; organizationId?: string; departmentId?: string | null }

const resourceFor = (project: any) => ({
  organizationId: project.organization_id,
  departmentId: project.department_id,
  ownerUserId: project.owner_id,
  members: (project.project_members || []).map((membership: any) => ({
    userId: membership.user?.id,
    projectRole: membership.project_role,
    permissions: membership.permissions_json,
  })),
});

const toDto = (row: any) => ({
  _id: row.id,
  projectId: row.project_id,
  taskId: row.task_id,
  summary: row.summary,
  details: row.details,
  waitingOnType: row.waiting_on_type,
  waitingOnUserId: row.waiting_on_user_id,
  severity: row.severity,
  status: row.status,
  suggestedNextAction: row.suggested_next_action,
  resolutionOwnerUserId: row.resolution_owner_user_id,
  resolutionNote: row.resolution_note,
  resolvedAt: row.resolved_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const blockerService = {
  async report(taskId: string, input: {
    summary: string;
    details?: string;
    waitingOnType: 'PERSON' | 'CLIENT' | 'EXTERNAL_SYSTEM' | 'DECISION' | 'DEPENDENCY' | 'OTHER';
    waitingOnUserId?: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    suggestedNextAction?: string;
    resolutionOwnerUserId?: string;
  }, actor: Actor) {
    if (!actor.organizationId) throw badRequest('Your account is not assigned to an organization');
    const task = await projectTaskRepository.findById(taskId);
    if (!task) throw notFound('Task not found');
    const project = await projectRepository.findById(task.project_id);
    if (!project) throw notFound('Project not found');
    if (!canUpdateTask(actor, resourceFor(project), task.assigned_to)) throw forbidden('You cannot report a blocker for this task');
    if (await blockerRepository.findOpenForTask(taskId)) throw badRequest('This task already has an active blocker');

    const blocker = await blockerRepository.create({
      organization_id: actor.organizationId,
      project_id: task.project_id,
      task_id: taskId,
      reported_by: actor.id,
      summary: input.summary.trim(),
      details: input.details?.trim() || null,
      waiting_on_type: input.waitingOnType,
      waiting_on_user_id: input.waitingOnUserId || null,
      severity: input.severity,
      suggested_next_action: input.suggestedNextAction?.trim() || null,
      resolution_owner_user_id: input.resolutionOwnerUserId || null,
    });
    await projectTaskRepository.update(taskId, { blocked: true, blocker_reason: input.summary.trim() });

    const managerIds = new Set<string>([project.owner_id]);
    (project.project_members || []).forEach((membership: any) => {
      if (membership.project_role === 'MANAGER' || membership.permissions_json?.manageTasks) managerIds.add(membership.user?.id);
    });
    managerIds.delete(actor.id);
    await Promise.all([...managerIds].filter(Boolean).map((id) => notificationService.notify(
      id,
      input.severity === 'CRITICAL' ? 'critical_blocker' : 'task_blocked',
      `${input.severity === 'CRITICAL' ? 'Critical b' : 'B'}locker reported`,
      `${task.title}: ${input.summary}`,
      { link: `/projects/${task.project_id}`, relatedType: 'blocker', relatedId: blocker.id },
    )));
    await activityLogRepository.create({
      action: 'Task Blocked', user_id: actor.id, project_id: task.project_id,
      details: `${task.title}: ${input.summary}`,
      event: { eventType: 'TASK_BLOCKED', entityType: 'BLOCKER', entityId: blocker.id, payload: { taskId, severity: input.severity, waitingOnType: input.waitingOnType } },
    });
    return toDto(blocker);
  },

  async resolve(taskId: string, input: { resolutionNote: string }, actor: Actor) {
    const task = await projectTaskRepository.findById(taskId);
    if (!task) throw notFound('Task not found');
    const project = await projectRepository.findById(task.project_id);
    if (!project) throw notFound('Project not found');
    const blocker = await blockerRepository.findOpenForTask(taskId);
    if (!blocker) throw notFound('Active blocker not found');
    if (blocker.reported_by !== actor.id && !canManageProject(actor, resourceFor(project))) throw forbidden('Only the reporter or a project Manager can resolve this blocker');
    const resolvedAt = new Date().toISOString();
    const updated = await blockerRepository.update(blocker.id, {
      status: 'RESOLVED', resolution_note: input.resolutionNote.trim(), resolved_at: resolvedAt,
    });
    await projectTaskRepository.update(taskId, { blocked: false, blocker_reason: null });
    await activityLogRepository.create({
      action: 'Blocker Resolved', user_id: actor.id, project_id: task.project_id,
      details: `${task.title}: blocker resolved.`,
      event: { eventType: 'BLOCKER_RESOLVED', entityType: 'BLOCKER', entityId: blocker.id, payload: { taskId, resolutionNote: input.resolutionNote } },
    });
    if (blocker.reported_by !== actor.id) await notificationService.notify(blocker.reported_by, 'blocker_resolved', 'Blocker resolved', `${task.title}: ${input.resolutionNote}`, { link: `/projects/${task.project_id}`, relatedType: 'blocker', relatedId: blocker.id });
    return toDto(updated);
  },
};
