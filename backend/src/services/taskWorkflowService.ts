import { canManageProject, canUpdateTask, canViewProject, toPolicyResource } from '../policies/accessPolicy';
import { activityLogRepository } from '../repositories/activityLogRepository';
import { projectRepository } from '../repositories/projectRepository';
import { projectTaskRepository } from '../repositories/projectTaskRepository';
import { taskUpdateRepository } from '../repositories/taskUpdateRepository';
import { badRequest, forbidden, notFound } from '../utils/httpError';
import { notificationService } from './notificationService';
import { projectTaskService } from './projectTaskService';

interface Actor { id: string; role: string; organizationId?: string; departmentId?: string | null }

const context = async (taskId: string, actor: Actor, mode: 'view' | 'update' | 'manage' = 'update') => {
  const task = await projectTaskRepository.findById(taskId);
  if (!task) throw notFound('Task not found');
  const project = await projectRepository.findById(task.project_id);
  if (!project) throw notFound('Project not found');
  const resource = toPolicyResource(project);
  const allowed = mode === 'manage' ? canManageProject(actor, resource) : mode === 'view' ? canViewProject(actor, resource) : canUpdateTask(actor, resource, task.assigned_to);
  if (!allowed) throw forbidden('You do not have permission to perform this task action');
  if (project.is_locked || project.status === 'Completed') throw badRequest('Completed projects are read-only');
  return { task, project, resource };
};

export const taskWorkflowService = {
  async start(taskId: string, actor: Actor) {
    const { task } = await context(taskId, actor);
    return projectTaskService.update(task.project_id, taskId, { status: 'In Progress' }, actor);
  },
  async pause(taskId: string, note: string | undefined, actor: Actor) {
    const { task } = await context(taskId, actor);
    if (note?.trim()) await this.addUpdate(taskId, { updateText: note }, actor);
    const result = await projectTaskService.update(task.project_id, taskId, { status: 'Pending' }, actor);
    await activityLogRepository.create({ action: 'Task Paused', user_id: actor.id, project_id: task.project_id, details: `${task.title} was paused.`, event: { eventType: 'TASK_PAUSED', entityType: 'TASK', entityId: taskId } });
    return result;
  },
  async addUpdate(taskId: string, input: { updateText: string; progressPercent?: number; remainingEstimateMinutes?: number }, actor: Actor) {
    const { task } = await context(taskId, actor);
    const update = await taskUpdateRepository.create({ task_id: taskId, author_user_id: actor.id, update_text: input.updateText.trim(), progress_percent: input.progressPercent ?? null, remaining_estimate_minutes: input.remainingEstimateMinutes ?? null });
    if (input.remainingEstimateMinutes !== undefined) await projectTaskRepository.update(taskId, { remaining_estimate_minutes: input.remainingEstimateMinutes });
    await activityLogRepository.create({
      action: 'Task Updated',
      user_id: actor.id,
      project_id: task.project_id,
      details: `${task.title}: ${input.updateText.trim()}`,
      event: {
        eventType: 'TASK_UPDATED',
        entityType: 'TASK',
        entityId: taskId,
        payload: {
          taskUpdateId: update.id,
          taskTitle: task.title,
          progressPercent: input.progressPercent,
          details: input.updateText.trim(),
        },
      },
    });
    return update;
  },
  async requestReview(taskId: string, reviewerUserId: string | undefined, actor: Actor) {
    const { task, project, resource } = await context(taskId, actor);
    const reviewer = reviewerUserId || task.reviewer_user_id || project.owner_id;
    if (reviewer === actor.id && !canManageProject(actor, resource)) throw badRequest('Choose someone else to review your task');
    await projectTaskRepository.update(taskId, { reviewer_user_id: reviewer, review_requested_at: new Date().toISOString() } as any);
    const result = await projectTaskService.update(task.project_id, taskId, { status: 'In Review' }, actor);
    await notificationService.notify(reviewer, 'review_request', 'Review requested', `${task.title} is ready for review.`, { link: `/projects/${task.project_id}`, relatedType: 'project_task', relatedId: taskId });
    return result;
  },
  async approve(taskId: string, note: string | undefined, actor: Actor) {
    const { task, project, resource } = await context(taskId, actor, 'view');
    if (task.reviewer_user_id !== actor.id && !canManageProject(actor, resource)) throw forbidden('Only the reviewer or project Manager can approve this task');
    await projectTaskRepository.update(taskId, { review_note: note?.trim() || null, reviewed_at: new Date().toISOString() } as any);
    const result = await projectTaskService.update(task.project_id, taskId, { status: 'Completed' }, actor);
    await activityLogRepository.create({ action: 'Task Review Approved', user_id: actor.id, project_id: task.project_id, details: `${task.title} was approved.`, event: { eventType: 'TASK_REVIEW_APPROVED', entityType: 'TASK', entityId: taskId } });
    if (task.assigned_to) await notificationService.notify(task.assigned_to, 'review_approved', 'Review approved', `${task.title} was approved.`, { link: `/projects/${project.id}`, relatedType: 'project_task', relatedId: taskId });
    return result;
  },
  async reject(taskId: string, note: string, actor: Actor) {
    const { task, project, resource } = await context(taskId, actor, 'view');
    if (task.reviewer_user_id !== actor.id && !canManageProject(actor, resource)) throw forbidden('Only the reviewer or project Manager can reject this task');
    await projectTaskRepository.update(taskId, { review_note: note.trim(), reviewed_at: new Date().toISOString() } as any);
    const result = await projectTaskService.update(task.project_id, taskId, { status: 'In Progress' }, actor, { skipWipCheck: true });
    await activityLogRepository.create({ action: 'Task Review Rejected', user_id: actor.id, project_id: task.project_id, details: `${task.title} needs changes.`, event: { eventType: 'TASK_REVIEW_REJECTED', entityType: 'TASK', entityId: taskId, payload: { note } } });
    if (task.assigned_to) await notificationService.notify(task.assigned_to, 'review_rejected', 'Changes requested', `${task.title}: ${note}`, { link: `/projects/${project.id}`, relatedType: 'project_task', relatedId: taskId });
    return result;
  },
  async complete(taskId: string, input: { completionNote?: string; deliveredOutput?: string; reviewerUserId?: string }, actor: Actor) {
    const { task, resource } = await context(taskId, actor);
    // Only managers may close a task directly; everyone else goes through review (reviewer defaults to the project owner).
    const reviewer = input.reviewerUserId || task.reviewer_user_id || undefined;
    await projectTaskRepository.update(taskId, { completion_note: input.completionNote?.trim() || input.deliveredOutput?.trim() || null } as any);
    return !reviewer && canManageProject(actor, resource)
      ? projectTaskService.update(task.project_id, taskId, { status: 'Completed' }, actor)
      : this.requestReview(taskId, reviewer, actor);
  },
};
