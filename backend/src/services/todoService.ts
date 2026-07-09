import { todoRepository } from '../repositories/todoRepository';
import { notificationService } from './notificationService';
import { uploadFiles } from '../lib/storage';
import { mapDocument } from './mappers';
import { badRequest, forbidden, notFound } from '../utils/httpError';
import { DailyTodo, DailyTodoSubtask } from '../types/models';
import { isSuperAdmin } from '../utils/roles';

interface Actor {
  id: string;
  role: string;
}

const mapPerson = (person: { id: string; name: string; email?: string; photo?: string | null } | null) =>
  person ? { _id: person.id, name: person.name, email: person.email, photo: person.photo } : null;

// Only the Super Admin curates the to-do list itself (create/edit-details/
// delete tasks and subtasks, for anyone). An assignee's only self-service
// action is ticking their own item's status - mirrors the Project Tasks rule.
const assertCanManageTodos = (actor: Actor) => {
  if (!isSuperAdmin(actor.role)) throw forbidden('Only the Super Admin can add or edit to-do tasks.');
};

const assertCanSetStatus = (assignedTo: string | null | undefined, actor: Actor) => {
  if (isSuperAdmin(actor.role)) return;
  if (assignedTo && assignedTo === actor.id) return;
  throw forbidden('Only the assigned member can update this task\'s status.');
};

const isStatusOnlyPatch = (patch: Record<string, unknown>) => {
  const keys = Object.keys(patch).filter((key) => patch[key] !== undefined);
  return keys.length > 0 && keys.every((key) => key === 'status');
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const daysBetween = (from: string, to: string) =>
  Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000);

const mapSubtask = (subtask: DailyTodoSubtask & { assignee?: any; todo?: { id: string; title: string } | null; documents?: any[] }) => ({
  _id: subtask.id,
  todoId: subtask.todo_id,
  title: subtask.title,
  status: subtask.status,
  priority: subtask.priority,
  assignedTo: mapPerson(subtask.assignee || null),
  dueDate: subtask.due_date,
  addToToday: subtask.add_to_today,
  completedAt: subtask.completed_at,
  documents: (subtask.documents || []).map(mapDocument),
  parentTitle: subtask.todo?.title,
  createdAt: subtask.created_at,
  updatedAt: subtask.updated_at,
});

const mapTodo = (todo: DailyTodo & { assignee?: any; creator?: any; subtasks?: any[]; documents?: any[] }) => {
  const today = todayISO();
  const isOverdue = Boolean(todo.due_date) && todo.due_date! < today && todo.status !== 'Completed';
  return {
    _id: todo.id,
    title: todo.title,
    description: todo.description,
    dueDate: todo.due_date,
    originalDueDate: todo.original_due_date,
    carryForwardCount: todo.carry_forward_count,
    daysOverdue: isOverdue ? daysBetween(todo.due_date!, today) : 0,
    priority: todo.priority,
    status: todo.status,
    assignedTo: mapPerson(todo.assignee || null),
    createdBy: mapPerson(todo.creator || null),
    completedAt: todo.completed_at,
    documents: (todo.documents || []).map(mapDocument),
    subtasks: (todo.subtasks || []).map(mapSubtask),
    createdAt: todo.created_at,
    updatedAt: todo.updated_at,
  };
};

// No cron scheduler exists in this app (see plan). Carry-forward runs lazily
// whenever a user's todos are read: any incomplete task whose due date has
// passed moves to today, on the *same row* (same ID - never duplicated),
// with original_due_date preserved on first carry and carry_forward_count
// incremented. This keeps "Today's To-Do" correct without a background job.
const applyCarryForward = async (todos: any[]): Promise<any[]> => {
  const today = todayISO();
  const updated = await Promise.all(
    todos.map(async (todo) => {
      if (!todo.due_date || todo.due_date >= today || todo.status === 'Completed') return todo;

      const patch = {
        original_due_date: todo.original_due_date || todo.due_date,
        due_date: today,
        carry_forward_count: (todo.carry_forward_count || 0) + 1,
      };
      await todoRepository.update(todo.id, patch);
      return { ...todo, ...patch };
    })
  );
  return updated;
};

interface CreateTodoInput {
  title: string;
  description?: string;
  dueDate?: string;
  priority?: string;
  assignedTo?: string;
  files?: Express.Multer.File[];
}

export const todoService = {
  async listMine(userId: string) {
    const todos = await applyCarryForward(await todoRepository.findForUser(userId));
    return todos.map(mapTodo);
  },

  async create(input: CreateTodoInput, actor: Actor) {
    assertCanManageTodos(actor);
    const assignedTo = input.assignedTo || actor.id;

    const todo = await todoRepository.create({
      title: input.title,
      description: input.description,
      due_date: input.dueDate || null,
      priority: (input.priority as any) || 'Medium',
      status: 'Pending',
      assigned_to: assignedTo,
      created_by: actor.id,
    });

    if (input.files?.length) {
      const uploaded = await uploadFiles(`daily-todos/${todo.id}`, input.files);
      await todoRepository.addDocuments(todo.id, uploaded.map((f) => ({ name: f.name, storage_path: f.storagePath })));
    }

    if (assignedTo !== actor.id) {
      await notificationService.notify(assignedTo, 'task_assigned', 'Task Assigned', `You were assigned the task "${todo.title}".`, {
        link: '/daily-todo',
        relatedType: 'daily_todo',
        relatedId: todo.id,
      });
    }

    const full = await todoRepository.findById(todo.id);
    return mapTodo(full);
  },

  async update(id: string, patch: Partial<CreateTodoInput & { status: string }>, actor: Actor) {
    const existing = await todoRepository.findById(id);
    if (!existing) throw notFound('Task not found');

    if (isStatusOnlyPatch(patch)) {
      assertCanSetStatus(existing.assigned_to, actor);
    } else {
      assertCanManageTodos(actor);
    }
    const allowedPatch = patch;

    if (Object.values(allowedPatch).every((v) => v === undefined)) {
      throw badRequest('Nothing to update');
    }

    await todoRepository.update(id, {
      ...(allowedPatch.title !== undefined && { title: allowedPatch.title }),
      ...(allowedPatch.description !== undefined && { description: allowedPatch.description }),
      ...(allowedPatch.dueDate !== undefined && { due_date: allowedPatch.dueDate }),
      ...(allowedPatch.priority !== undefined && { priority: allowedPatch.priority as any }),
      ...(allowedPatch.assignedTo !== undefined && { assigned_to: allowedPatch.assignedTo }),
      ...(allowedPatch.status !== undefined && {
        status: allowedPatch.status as any,
        completed_at: allowedPatch.status === 'Completed' ? new Date().toISOString() : null,
      }),
    });

    if (allowedPatch.assignedTo && allowedPatch.assignedTo !== existing.assigned_to) {
      await notificationService.notify(allowedPatch.assignedTo, 'task_assigned', 'Task Assigned', `You were assigned the task "${existing.title}".`, {
        link: '/daily-todo',
        relatedType: 'daily_todo',
        relatedId: id,
      });
    }
    if (allowedPatch.status === 'Completed' && existing.created_by && existing.created_by !== actor.id) {
      await notificationService.notify(existing.created_by, 'task_completed', 'Task Completed', `"${existing.title}" was marked complete.`, {
        link: '/daily-todo',
        relatedType: 'daily_todo',
        relatedId: id,
      });
    }

    const full = await todoRepository.findById(id);
    return mapTodo(full);
  },

  async remove(id: string, actor: Actor) {
    assertCanManageTodos(actor);
    const existing = await todoRepository.findById(id);
    if (!existing) throw notFound('Task not found');
    await todoRepository.remove(id);
    return { message: 'Task deleted successfully' };
  },

  async addSubtask(
    todoId: string,
    input: { title: string; assignedTo?: string; dueDate?: string; priority?: string; addToToday?: boolean; files?: Express.Multer.File[] },
    actor: Actor
  ) {
    assertCanManageTodos(actor);
    const todo = await todoRepository.findById(todoId);
    if (!todo) throw notFound('Task not found');

    const subtask = await todoRepository.createSubtask({
      todo_id: todoId,
      title: input.title,
      status: 'Pending',
      priority: (input.priority as any) || 'Medium',
      assigned_to: input.assignedTo || null,
      due_date: input.dueDate || null,
      add_to_today: input.addToToday ?? false,
    });

    if (input.files?.length) {
      const uploaded = await uploadFiles(`daily-todos/${todoId}/subtasks/${subtask.id}`, input.files);
      await todoRepository.addSubtaskDocuments(subtask.id, uploaded.map((f) => ({ name: f.name, storage_path: f.storagePath })));
    }

    if (input.assignedTo) {
      await notificationService.notify(input.assignedTo, 'subtask_assigned', 'Subtask Assigned', `You were assigned the subtask "${subtask.title}" under "${todo.title}".`, {
        link: '/daily-todo',
        relatedType: 'daily_todo_subtask',
        relatedId: subtask.id,
      });
    }

    const full = await todoRepository.findById(todoId);
    return mapTodo(full);
  },

  async updateSubtask(
    todoId: string,
    subtaskId: string,
    patch: { title?: string; status?: string; assignedTo?: string; dueDate?: string; priority?: string; addToToday?: boolean },
    actor: Actor
  ) {
    const todo = await todoRepository.findById(todoId);
    if (!todo) throw notFound('Task not found');
    const subtask = await todoRepository.findSubtaskById(subtaskId);
    if (!subtask || subtask.todo_id !== todoId) throw notFound('Subtask not found');

    if (isStatusOnlyPatch(patch)) {
      assertCanSetStatus(subtask.assigned_to, actor);
    } else {
      assertCanManageTodos(actor);
    }
    // Completing it here (e.g. from the Today's To-Do widget) updates this
    // exact row, so the parent task's subtask list reflects it too - single
    // source of truth, never duplicated.
    const allowedPatch = patch;

    await todoRepository.updateSubtask(subtaskId, {
      ...(allowedPatch.title !== undefined && { title: allowedPatch.title }),
      ...(allowedPatch.assignedTo !== undefined && { assigned_to: allowedPatch.assignedTo || null }),
      ...(allowedPatch.dueDate !== undefined && { due_date: allowedPatch.dueDate }),
      ...(allowedPatch.priority !== undefined && { priority: allowedPatch.priority as any }),
      ...(allowedPatch.addToToday !== undefined && { add_to_today: allowedPatch.addToToday }),
      ...(allowedPatch.status !== undefined && {
        status: allowedPatch.status as any,
        completed_at: allowedPatch.status === 'Completed' ? new Date().toISOString() : null,
      }),
    });

    if (allowedPatch.assignedTo && allowedPatch.assignedTo !== subtask.assigned_to) {
      await notificationService.notify(allowedPatch.assignedTo, 'subtask_assigned', 'Subtask Assigned', `You were assigned the subtask "${subtask.title}" under "${todo.title}".`, {
        link: '/daily-todo',
        relatedType: 'daily_todo_subtask',
        relatedId: subtaskId,
      });
    }
    if (allowedPatch.status === 'Completed' && todo.created_by && todo.created_by !== actor.id) {
      await notificationService.notify(todo.created_by, 'task_completed', 'Subtask Completed', `"${subtask.title}" was marked complete.`, {
        link: '/daily-todo',
        relatedType: 'daily_todo_subtask',
        relatedId: subtaskId,
      });
    }

    const full = await todoRepository.findById(todoId);
    return mapTodo(full);
  },

  async removeSubtask(todoId: string, subtaskId: string, actor: Actor) {
    assertCanManageTodos(actor);
    const todo = await todoRepository.findById(todoId);
    if (!todo) throw notFound('Task not found');

    const subtask = await todoRepository.findSubtaskById(subtaskId);
    if (!subtask || subtask.todo_id !== todoId) throw notFound('Subtask not found');

    await todoRepository.removeSubtask(subtaskId);
    const full = await todoRepository.findById(todoId);
    return mapTodo(full);
  },

  async getToday(userId: string) {
    const personalTodos = await applyCarryForward(await todoRepository.findForUser(userId));
    const flaggedSubtasks = await todoRepository.findTodaySubtasksForUser(userId);

    const today = todayISO();
    const todosDueToday = personalTodos
      .filter((t) => t.assigned_to === userId && t.due_date === today && t.status !== 'Completed')
      .map(mapTodo);
    const subtasks = flaggedSubtasks.filter((s) => s.status !== 'Completed').map(mapSubtask);

    return { todos: todosDueToday, subtasks };
  },

  async getAssignedSubtasks(userId: string) {
    const subtasks = await todoRepository.findSubtasksAssignedToUser(userId);
    return subtasks.filter((s) => s.status !== 'Completed').map(mapSubtask);
  },
};
