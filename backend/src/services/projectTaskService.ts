import { projectTaskRepository } from '../repositories/projectTaskRepository';
import { projectRepository } from '../repositories/projectRepository';
import { notificationService } from './notificationService';
import { uploadFiles } from '../lib/storage';
import { mapDocument } from './mappers';
import { notFound, forbidden } from '../utils/httpError';
import { isSuperAdmin } from '../utils/roles';
import { ProjectTask, ProjectTaskSubtask } from '../types/models';

interface Actor {
  id: string;
  role: string;
}

// Only the Super Admin manages the task list itself (create/edit-details/delete
// tasks and subtasks) - assigned members work the list, they don't curate it.
const assertCanManageTasks = (actor: Actor) => {
  if (!isSuperAdmin(actor.role)) throw forbidden('Only the Super Admin can add or edit tasks.');
};

// Ticking a task/subtask's status is the one action an assigned member is
// allowed to take on their own - but only on the item assigned to them.
const assertCanSetStatus = (assignedTo: string | null, actor: Actor) => {
  if (isSuperAdmin(actor.role)) return;
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
  title: task.title,
  description: task.description,
  blockerReason: task.blocker_reason,
  dueDate: task.due_date,
  priority: task.priority,
  status: task.status,
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
      project: t.project ? { _id: t.project.id, name: t.project.name } : null,
      title: t.title,
      dueDate: t.due_date,
      priority: t.priority,
      status: t.status,
      completedAt: t.completed_at,
    }));
  },

  async create(projectId: string, input: CreateTaskInput, actor: Actor) {
    assertCanManageTasks(actor);
    const project = await projectRepository.findById(projectId);
    if (!project) throw notFound('Project not found');

    const task = await projectTaskRepository.create({
      project_id: projectId,
      title: input.title,
      description: input.description,
      due_date: input.dueDate || null,
      priority: (input.priority as any) || 'Medium',
      status: 'Pending',
      assigned_to: input.assignedTo || null,
      created_by: actor.id,
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

    const full = await projectTaskRepository.findById(task.id);
    return mapTask(full);
  },

  async update(
    projectId: string,
    taskId: string,
    patch: { title?: string; description?: string; blockerReason?: string; dueDate?: string; priority?: string; status?: string; assignedTo?: string },
    actor: Actor
  ) {
    const existing = await projectTaskRepository.findById(taskId);
    if (!existing || existing.project_id !== projectId) throw notFound('Task not found');

    if (isStatusOnlyPatch(patch)) {
      assertCanSetStatus(existing.assigned_to, actor);
    } else {
      assertCanManageTasks(actor);
    }

    const wasAssignedTo = existing.assigned_to;

    await projectTaskRepository.update(taskId, {
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.description !== undefined && { description: patch.description }),
      ...(patch.blockerReason !== undefined && { blocker_reason: patch.blockerReason || null }),
      ...(patch.dueDate !== undefined && { due_date: patch.dueDate }),
      ...(patch.priority !== undefined && { priority: patch.priority as any }),
      ...(patch.assignedTo !== undefined && { assigned_to: patch.assignedTo || null }),
      ...(patch.status !== undefined && {
        status: patch.status as any,
        completed_at: patch.status === 'Completed' ? new Date().toISOString() : null,
      }),
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

    const full = await projectTaskRepository.findById(taskId);
    return mapTask(full);
  },

  async addComment(projectId: string, taskId: string, body: string, actor: Actor) {
    const task = await projectTaskRepository.findById(taskId);
    if (!task || task.project_id !== projectId) throw notFound('Task not found');
    assertCanSetStatus(task.assigned_to, actor);
    await projectTaskRepository.addComment(taskId, actor.id, body);
    return mapTask(await projectTaskRepository.findById(taskId));
  },

  async addDocuments(projectId: string, taskId: string, files: Express.Multer.File[], actor: Actor) {
    const task = await projectTaskRepository.findById(taskId);
    if (!task || task.project_id !== projectId) throw notFound('Task not found');
    assertCanSetStatus(task.assigned_to, actor);
    const uploaded = await uploadFiles(`project-tasks/${taskId}`, files);
    await projectTaskRepository.addDocuments(taskId, uploaded.map((file) => ({ name: file.name, storage_path: file.storagePath })));
    return mapTask(await projectTaskRepository.findById(taskId));
  },

  async remove(projectId: string, taskId: string, actor: Actor) {
    assertCanManageTasks(actor);
    const existing = await projectTaskRepository.findById(taskId);
    if (!existing || existing.project_id !== projectId) throw notFound('Task not found');
    await projectTaskRepository.remove(taskId);
    return { message: 'Task deleted successfully' };
  },

  async addSubtask(
    projectId: string,
    taskId: string,
    input: { title: string; assignedTo?: string; dueDate?: string; priority?: string; files?: Express.Multer.File[] },
    actor: Actor
  ) {
    assertCanManageTasks(actor);
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
      assertCanSetStatus(subtask.assigned_to, actor);
    } else {
      assertCanManageTasks(actor);
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
    assertCanManageTasks(actor);
    const task = await projectTaskRepository.findById(taskId);
    if (!task || task.project_id !== projectId) throw notFound('Task not found');
    const subtask = await projectTaskRepository.findSubtaskById(subtaskId);
    if (!subtask || subtask.task_id !== taskId) throw notFound('Subtask not found');
    await projectTaskRepository.removeSubtask(subtaskId);
    const full = await projectTaskRepository.findById(taskId);
    return mapTask(full);
  },
};
