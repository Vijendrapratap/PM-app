import { projectTaskRepository } from '../repositories/projectTaskRepository';
import { projectRepository } from '../repositories/projectRepository';
import { notificationService } from './notificationService';
import { uploadFiles } from '../lib/storage';
import { mapDocument } from './mappers';
import { notFound, forbidden } from '../utils/httpError';
import { isManager, isSuperAdmin } from '../utils/roles';
import { ProjectTask, ProjectTaskSubtask } from '../types/models';
import { canManageProject } from '../policies/accessPolicy';
import { activityLogRepository } from '../repositories/activityLogRepository';
import { hierarchyRepository } from '../repositories/hierarchyRepository';
import { projectProgressService } from './projectProgressService';

interface Actor {
  id: string;
  role: string;
}

// Only the Super Admin manages the task list itself (create/edit-details/delete
// tasks and subtasks) - assigned members work the list, they don't curate it.
const assertCanManageTasks = async (projectId: string, actor: Actor) => {
  const project = await projectRepository.findById(projectId);
  if (project && canManageProject(actor, {
    organizationId: project.organization_id,
    departmentId: project.department_id,
    ownerUserId: project.owner_id,
    members: (project.project_members || []).map((membership: any) => ({
      userId: membership.user?.id,
      projectRole: membership.project_role,
      permissions: membership.permissions_json,
    })),
  })) return;
  throw forbidden('Only the CEO or a Manager in this project can add or edit tasks.');
};

// Ticking a task/subtask's status is the one action an assigned member is
// allowed to take on their own - but only on the item assigned to them.
const assertCanSetStatus = async (projectId: string, assignedTo: string | null, actor: Actor) => {
  if (isSuperAdmin(actor.role)) return;
  if (isManager(actor.role)) {
    const project = await projectRepository.findById(projectId);
    if (project && canManageProject(actor, {
      organizationId: project.organization_id,
      departmentId: project.department_id,
      ownerUserId: project.owner_id,
      members: (project.project_members || []).map((membership: any) => ({
        userId: membership.user?.id,
        projectRole: membership.project_role,
        permissions: membership.permissions_json,
      })),
    })) return;
  }
  if (assignedTo && assignedTo === actor.id) return;
  throw forbidden('Only the assigned member can update this task\'s status.');
};

const isStatusOnlyPatch = (patch: Record<string, unknown>) => {
  const keys = Object.keys(patch).filter((key) => patch[key] !== undefined);
  return keys.length > 0 && keys.every((key) => key === 'status' || key === 'blockerReason');
};

const mapPerson = (person: { id: string; name: string; email?: string; photo?: string | null } | null) =>
  person ? { _id: person.id, name: person.name, email: person.email, photo: person.photo } : null;

const mapSubtask = (subtask: ProjectTaskSubtask & { assignee?: any; documents?: any[] }) => ({
  _id: subtask.id,
  taskId: subtask.task_id,
  title: subtask.title,
  status: subtask.status,
  priority: subtask.priority,
  assignedTo: mapPerson(subtask.assignee || null),
  dueDate: subtask.due_date,
  completedAt: subtask.completed_at,
  documents: (subtask.documents || []).map(mapDocument),
  createdAt: subtask.created_at,
  updatedAt: subtask.updated_at,
});

const mapTask = (task: ProjectTask & { assignee?: any; creator?: any; subtasks?: any[]; documents?: any[]; comments?: any[] }) => ({
  _id: task.id,
  projectId: task.project_id,
  milestoneId: task.milestone_id || null,
  deliverableId: task.deliverable_id || null,
  milestone: (task as any).milestone ? { id: (task as any).milestone.id, name: (task as any).milestone.name } : null,
  deliverable: (task as any).deliverable ? { id: (task as any).deliverable.id, name: (task as any).deliverable.name } : null,
  title: task.title,
  description: task.description,
  blockerReason: task.blocker_reason,
  dueDate: task.due_date,
  priority: task.priority,
  status: task.status,
  canonicalStatus: task.canonical_status || ({ Pending: 'BACKLOG', 'In Progress': 'IN_PROGRESS', 'In Review': 'IN_REVIEW', Completed: 'DONE', Blocked: 'IN_PROGRESS' } as Record<string, string>)[task.status] || 'BACKLOG',
  blocked: Boolean(task.blocked || task.status === 'Blocked'),
  assignedTo: mapPerson(task.assignee || null),
  createdBy: mapPerson(task.creator || null),
  completedAt: task.completed_at,
  documents: (task.documents || []).map(mapDocument),
  comments: (task.comments || []).map((comment: any) => ({ _id: comment.id, body: comment.body, createdAt: comment.created_at, author: mapPerson(comment.author || null) })),
  subtasks: (task.subtasks || []).map(mapSubtask),
  createdAt: task.created_at,
  updatedAt: task.updated_at,
});

interface CreateTaskInput {
  title: string;
  description?: string;
  dueDate?: string;
  priority?: string;
  assignedTo?: string;
  milestoneId?: string;
  deliverableId?: string;
  files?: Express.Multer.File[];
}

export const projectTaskService = {
  async listForProject(projectId: string) {
    const tasks = await projectTaskRepository.findForProject(projectId);
    return tasks.map(mapTask);
  },

  async listAssignedToUser(userId: string) {
    const tasks = await projectTaskRepository.findAssignedToUser(userId);
    return tasks.map((t: any) => ({
      _id: t.id,
      projectId: t.project_id,
      project: t.project ? { _id: t.project.id, name: t.project.name, department: t.project.department || null } : null,
      title: t.title,
      dueDate: t.due_date,
      priority: t.priority,
      status: t.status,
      completedAt: t.completed_at,
    }));
  },

  async create(projectId: string, input: CreateTaskInput, actor: Actor) {
    await assertCanManageTasks(projectId, actor);
    const project = await projectRepository.findById(projectId);
    if (!project) throw notFound('Project not found');

    let milestoneId = input.milestoneId || null;
    if (input.deliverableId) {
      const deliverable = await hierarchyRepository.findDeliverable(input.deliverableId);
      if (!deliverable || deliverable.project_id !== projectId) throw forbidden('Module does not belong to this project');
      milestoneId = deliverable.milestone_id;
    } else if (milestoneId) {
      const milestone = await hierarchyRepository.findMilestone(milestoneId);
      if (!milestone || milestone.project_id !== projectId) throw forbidden('Milestone does not belong to this project');
    }

    const task = await projectTaskRepository.create({
      project_id: projectId,
      organization_id: project.organization_id,
      milestone_id: milestoneId,
      deliverable_id: input.deliverableId || null,
      title: input.title,
      description: input.description,
      due_date: input.dueDate || null,
      priority: (input.priority as any) || 'Medium',
      status: 'Pending',
      assigned_to: input.assignedTo || null,
      created_by: actor.id,
      reporter_user_id: actor.id,
      canonical_status: 'BACKLOG',
    });

    if (input.files?.length) {
      const uploaded = await uploadFiles(`project-tasks/${task.id}`, input.files);
      await projectTaskRepository.addDocuments(task.id, uploaded.map((f) => ({ name: f.name, storage_path: f.storagePath })));
    }

    if (input.assignedTo) {
      await notificationService.notify(
        input.assignedTo,
        'task_assigned',
        'Task Assigned',
        `You were assigned the task "${task.title}" on "${project.name}".`,
        { link: `/projects/${projectId}`, relatedType: 'project_task', relatedId: task.id }
      );
    }

    await activityLogRepository.create({
      action: 'Task Created', user_id: actor.id, project_id: projectId,
      details: `Task ${task.title} was created.`,
      event: { eventType: 'TASK_CREATED', entityType: 'TASK', entityId: task.id, payload: { assignedTo: input.assignedTo || null } },
    });
    await projectProgressService.sync(projectId);

    const full = await projectTaskRepository.findById(task.id);
    return mapTask(full);
  },

  async update(
    projectId: string,
    taskId: string,
    patch: { title?: string; description?: string; blockerReason?: string; dueDate?: string; priority?: string; status?: string; assignedTo?: string; canonicalStatus?: NonNullable<ProjectTask['canonical_status']>; milestoneId?: string | null; deliverableId?: string | null },
    actor: Actor
  ) {
    const existing = await projectTaskRepository.findById(taskId);
    if (!existing || existing.project_id !== projectId) throw notFound('Task not found');

    if (isStatusOnlyPatch(patch)) {
      await assertCanSetStatus(projectId, existing.assigned_to, actor);
    } else {
      await assertCanManageTasks(projectId, actor);
    }

    const wasAssignedTo = existing.assigned_to;

    let nextMilestoneId = patch.milestoneId;
    if (patch.deliverableId) {
      const deliverable = await hierarchyRepository.findDeliverable(patch.deliverableId);
      if (!deliverable || deliverable.project_id !== projectId) throw forbidden('Module does not belong to this project');
      nextMilestoneId = deliverable.milestone_id;
    } else if (patch.milestoneId) {
      const milestone = await hierarchyRepository.findMilestone(patch.milestoneId);
      if (!milestone || milestone.project_id !== projectId) throw forbidden('Milestone does not belong to this project');
    }

    await projectTaskRepository.update(taskId, {
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.description !== undefined && { description: patch.description }),
      ...(patch.blockerReason !== undefined && { blocker_reason: patch.blockerReason || null }),
      ...(patch.dueDate !== undefined && { due_date: patch.dueDate }),
      ...(patch.priority !== undefined && { priority: patch.priority as any }),
      ...(patch.assignedTo !== undefined && { assigned_to: patch.assignedTo || null }),
      ...((patch.milestoneId !== undefined || patch.deliverableId !== undefined) && { milestone_id: nextMilestoneId || null }),
      ...(patch.deliverableId !== undefined && { deliverable_id: patch.deliverableId || null }),
      ...(patch.canonicalStatus !== undefined && {
        canonical_status: patch.canonicalStatus,
        status: ({ BACKLOG: 'Pending', READY: 'Pending', IN_PROGRESS: 'In Progress', IN_REVIEW: 'In Review', DONE: 'Completed', CANCELLED: 'Pending', DEFERRED: 'Pending' } as Record<string, ProjectTask['status']>)[patch.canonicalStatus],
        completed_at: patch.canonicalStatus === 'DONE' ? new Date().toISOString() : null,
      }),
      ...(patch.status !== undefined && {
        status: patch.status as any,
        canonical_status: ({ Pending: 'BACKLOG', 'In Progress': 'IN_PROGRESS', 'In Review': 'IN_REVIEW', Completed: 'DONE', Blocked: 'IN_PROGRESS' } as Record<string, ProjectTask['canonical_status']>)[patch.status] || existing.canonical_status,
        blocked: patch.status === 'Blocked' ? true : existing.blocked,
        completed_at: patch.status === 'Completed' ? new Date().toISOString() : null,
      }),
    });

    const eventType = patch.status === 'In Progress' ? 'TASK_STARTED'
      : patch.status === 'In Review' ? 'TASK_REVIEW_REQUESTED'
        : patch.status === 'Completed' ? 'TASK_COMPLETED'
          : patch.status === 'Blocked' ? 'TASK_BLOCKED'
            : 'TASK_UPDATED';
    await activityLogRepository.create({
      action: eventType.split('_').map((part) => `${part[0]}${part.slice(1).toLowerCase()}`).join(' '),
      user_id: actor.id,
      project_id: projectId,
      details: `${existing.title} was updated.`,
      event: {
        eventType,
        entityType: 'TASK',
        entityId: taskId,
        payload: {
          changedFields: Object.keys(patch),
          status: patch.status,
          taskTitle: existing.title,
          details: `${existing.title} was updated${patch.status ? ` to ${patch.status}` : ''}.`,
        },
      },
    });

    if (patch.assignedTo && patch.assignedTo !== wasAssignedTo) {
      const project = await projectRepository.findById(projectId);
      await notificationService.notify(
        patch.assignedTo,
        'task_assigned',
        'Task Assigned',
        `You were assigned the task "${existing.title}" on "${project?.name}".`,
        { link: `/projects/${projectId}`, relatedType: 'project_task', relatedId: taskId }
      );
    }
    if (patch.status === 'Completed' && existing.created_by) {
      await notificationService.notify(
        existing.created_by,
        'task_completed',
        'Task Completed',
        `"${existing.title}" was marked complete.`,
        { link: `/projects/${projectId}`, relatedType: 'project_task', relatedId: taskId }
      );
    }

    await projectProgressService.sync(projectId);

    const full = await projectTaskRepository.findById(taskId);
    return mapTask(full);
  },

  async addComment(projectId: string, taskId: string, body: string, actor: Actor) {
    const task = await projectTaskRepository.findById(taskId);
    if (!task || task.project_id !== projectId) throw notFound('Task not found');
    await assertCanSetStatus(projectId, task.assigned_to, actor);
    await projectTaskRepository.addComment(taskId, actor.id, body);
    await activityLogRepository.create({
      action: 'Task Comment Added',
      user_id: actor.id,
      project_id: projectId,
      details: `${task.title}: ${body}`,
      event: {
        eventType: 'TASK_COMMENT_ADDED',
        entityType: 'TASK',
        entityId: taskId,
        payload: { taskTitle: task.title, details: body },
      },
    });
    return mapTask(await projectTaskRepository.findById(taskId));
  },

  async addDocuments(projectId: string, taskId: string, files: Express.Multer.File[], actor: Actor) {
    const task = await projectTaskRepository.findById(taskId);
    if (!task || task.project_id !== projectId) throw notFound('Task not found');
    await assertCanSetStatus(projectId, task.assigned_to, actor);
    const uploaded = await uploadFiles(`project-tasks/${taskId}`, files);
    await projectTaskRepository.addDocuments(taskId, uploaded.map((file) => ({ name: file.name, storage_path: file.storagePath })));
    return mapTask(await projectTaskRepository.findById(taskId));
  },

  async remove(projectId: string, taskId: string, actor: Actor) {
    await assertCanManageTasks(projectId, actor);
    const existing = await projectTaskRepository.findById(taskId);
    if (!existing || existing.project_id !== projectId) throw notFound('Task not found');
    await projectTaskRepository.remove(taskId);
    await projectProgressService.sync(projectId);
    return { message: 'Task deleted successfully' };
  },

  async addSubtask(
    projectId: string,
    taskId: string,
    input: { title: string; assignedTo?: string; dueDate?: string; priority?: string; files?: Express.Multer.File[] },
    actor: Actor
  ) {
    await assertCanManageTasks(projectId, actor);
    const task = await projectTaskRepository.findById(taskId);
    if (!task || task.project_id !== projectId) throw notFound('Task not found');

    const subtask = await projectTaskRepository.createSubtask({
      task_id: taskId,
      title: input.title,
      status: 'Pending',
      priority: (input.priority as any) || 'Medium',
      assigned_to: input.assignedTo || null,
      due_date: input.dueDate || null,
    });

    if (input.files?.length) {
      const uploaded = await uploadFiles(`project-tasks/${taskId}/subtasks/${subtask.id}`, input.files);
      await projectTaskRepository.addSubtaskDocuments(subtask.id, uploaded.map((f) => ({ name: f.name, storage_path: f.storagePath })));
    }

    if (input.assignedTo) {
      await notificationService.notify(
        input.assignedTo,
        'subtask_assigned',
        'Subtask Assigned',
        `You were assigned the subtask "${subtask.title}" under "${task.title}".`,
        { link: `/projects/${projectId}`, relatedType: 'project_task_subtask', relatedId: subtask.id }
      );
    }

    const full = await projectTaskRepository.findById(taskId);
    return mapTask(full);
  },

  async updateSubtask(
    projectId: string,
    taskId: string,
    subtaskId: string,
    patch: { title?: string; status?: string; assignedTo?: string; dueDate?: string; priority?: string },
    actor: Actor
  ) {
    const task = await projectTaskRepository.findById(taskId);
    if (!task || task.project_id !== projectId) throw notFound('Task not found');
    const subtask = await projectTaskRepository.findSubtaskById(subtaskId);
    if (!subtask || subtask.task_id !== taskId) throw notFound('Subtask not found');

    if (isStatusOnlyPatch(patch)) {
      await assertCanSetStatus(projectId, subtask.assigned_to, actor);
    } else {
      await assertCanManageTasks(projectId, actor);
    }

    await projectTaskRepository.updateSubtask(subtaskId, {
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.assignedTo !== undefined && { assigned_to: patch.assignedTo || null }),
      ...(patch.dueDate !== undefined && { due_date: patch.dueDate }),
      ...(patch.priority !== undefined && { priority: patch.priority as any }),
      ...(patch.status !== undefined && {
        status: patch.status as any,
        completed_at: patch.status === 'Completed' ? new Date().toISOString() : null,
      }),
    });

    if (patch.assignedTo && patch.assignedTo !== subtask.assigned_to) {
      await notificationService.notify(
        patch.assignedTo,
        'subtask_assigned',
        'Subtask Assigned',
        `You were assigned the subtask "${subtask.title}" under "${task.title}".`,
        { link: `/projects/${projectId}`, relatedType: 'project_task_subtask', relatedId: subtaskId }
      );
    }

    const full = await projectTaskRepository.findById(taskId);
    return mapTask(full);
  },

  async removeSubtask(projectId: string, taskId: string, subtaskId: string, actor: Actor) {
    await assertCanManageTasks(projectId, actor);
    const task = await projectTaskRepository.findById(taskId);
    if (!task || task.project_id !== projectId) throw notFound('Task not found');
    const subtask = await projectTaskRepository.findSubtaskById(subtaskId);
    if (!subtask || subtask.task_id !== taskId) throw notFound('Subtask not found');
    await projectTaskRepository.removeSubtask(subtaskId);
    const full = await projectTaskRepository.findById(taskId);
    return mapTask(full);
  },
};
