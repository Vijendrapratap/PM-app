import api, { expectArray } from './index';
import type { Priority, TaskStatus, TaskPerson } from '../types';

export interface Subtask {
  _id: string;
  todoId: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  assignedTo: TaskPerson | null;
  dueDate: string | null;
  addToToday: boolean;
  completedAt: string | null;
  documents: { name: string; url: string }[];
  parentTitle?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyTodo {
  _id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  originalDueDate: string | null;
  carryForwardCount: number;
  daysOverdue: number;
  priority: Priority;
  status: TaskStatus;
  assignedTo: TaskPerson | null;
  createdBy: TaskPerson | null;
  completedAt: string | null;
  documents: { name: string; url: string }[];
  subtasks: Subtask[];
  createdAt: string;
  updatedAt: string;
}

export interface TodaysTodo {
  todos: DailyTodo[];
  subtasks: Subtask[];
}

export interface CreateTodoPayload {
  title: string;
  description?: string;
  dueDate?: string;
  priority?: Priority;
  assignedTo?: string;
}

export interface CreateSubtaskPayload {
  title: string;
  assignedTo?: string;
  dueDate?: string;
  priority?: Priority;
  addToToday?: boolean;
}

const toFormData = <T extends object>(payload: T, files?: File[]): FormData => {
  const data = new FormData();
  Object.entries(payload as Record<string, unknown>).forEach(([key, value]) => {
    if (value !== undefined && value !== null) data.append(key, String(value));
  });
  files?.forEach((f) => data.append('documents', f));
  return data;
};

export const todoApi = {
  listMine: () => api.get<DailyTodo[]>('/todos/mine').then((res) => expectArray<DailyTodo>(res.data)),

  today: () => api.get<TodaysTodo>('/todos/today').then((res) => res.data),

  assignedSubtasks: () =>
    api.get<Subtask[]>('/todos/assigned-subtasks').then((res) => expectArray<Subtask>(res.data)),

  create: (data: CreateTodoPayload, files?: File[]) =>
    api
      .post<DailyTodo>('/todos', toFormData(data, files), { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((res) => res.data),

  update: (id: string, data: Partial<CreateTodoPayload & { status: TaskStatus }>) =>
    api.put<DailyTodo>(`/todos/${id}`, data).then((res) => res.data),

  remove: (id: string) => api.delete(`/todos/${id}`),

  addSubtask: (todoId: string, data: CreateSubtaskPayload, files?: File[]) =>
    api
      .post<DailyTodo>(`/todos/${todoId}/subtasks`, toFormData(data, files), {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.data),

  updateSubtask: (
    todoId: string,
    subtaskId: string,
    data: Partial<CreateSubtaskPayload & { status: TaskStatus }>
  ) => api.put<DailyTodo>(`/todos/${todoId}/subtasks/${subtaskId}`, data).then((res) => res.data),

  removeSubtask: (todoId: string, subtaskId: string) =>
    api.delete<DailyTodo>(`/todos/${todoId}/subtasks/${subtaskId}`).then((res) => res.data),
};
