import api, { expectArray } from './index';
import type { Priority, TaskStatus, TaskPerson } from '../types';

export interface ProjectTaskSubtask {
  _id: string;
  taskId: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  assignedTo: TaskPerson | null;
  dueDate: string | null;
  completedAt: string | null;
  documents: { name: string; url: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTask {
  _id: string;
  projectId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: Priority;
  status: TaskStatus;
  assignedTo: TaskPerson | null;
  createdBy: TaskPerson | null;
  completedAt: string | null;
  documents: { name: string; url: string }[];
  subtasks: ProjectTaskSubtask[];
  createdAt: string;
  updatedAt: string;
}

export interface AssignedProjectTask {
  _id: string;
  projectId: string;
  project: { _id: string; name: string } | null;
  title: string;
  dueDate: string | null;
  priority: Priority;
  status: TaskStatus;
  completedAt: string | null;
}

export interface CreateProjectTaskPayload {
  title: string;
  description?: string;
  dueDate?: string;
  priority?: Priority;
  assignedTo?: string;
}

export interface CreateProjectTaskSubtaskPayload {
  title: string;
  assignedTo?: string;
  dueDate?: string;
  priority?: Priority;
}

const toFormData = <T extends object>(payload: T, files?: File[]): FormData => {
  const data = new FormData();
  Object.entries(payload as Record<string, unknown>).forEach(([key, value]) => {
    if (value !== undefined && value !== null) data.append(key, String(value));
  });
  files?.forEach((f) => data.append('documents', f));
  return data;
};

export const projectTaskApi = {
  list: (projectId: string) =>
    api.get<ProjectTask[]>(`/projects/${projectId}/tasks`).then((res) => expectArray<ProjectTask>(res.data)),

  assignedToMe: () =>
    api.get<AssignedProjectTask[]>('/my-assigned-tasks').then((res) => expectArray<AssignedProjectTask>(res.data)),

  create: (projectId: string, data: CreateProjectTaskPayload, files?: File[]) =>
    api
      .post<ProjectTask>(`/projects/${projectId}/tasks`, toFormData(data, files), {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.data),

  update: (projectId: string, taskId: string, data: Partial<CreateProjectTaskPayload & { status: TaskStatus }>) =>
    api.put<ProjectTask>(`/projects/${projectId}/tasks/${taskId}`, data).then((res) => res.data),

  remove: (projectId: string, taskId: string) => api.delete(`/projects/${projectId}/tasks/${taskId}`),

  addSubtask: (projectId: string, taskId: string, data: CreateProjectTaskSubtaskPayload, files?: File[]) =>
    api
      .post<ProjectTask>(`/projects/${projectId}/tasks/${taskId}/subtasks`, toFormData(data, files), {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.data),

  updateSubtask: (
    projectId: string,
    taskId: string,
    subId: string,
    data: Partial<CreateProjectTaskSubtaskPayload & { status: TaskStatus }>
  ) => api.put<ProjectTask>(`/projects/${projectId}/tasks/${taskId}/subtasks/${subId}`, data).then((res) => res.data),

  removeSubtask: (projectId: string, taskId: string, subId: string) =>
    api.delete<ProjectTask>(`/projects/${projectId}/tasks/${taskId}/subtasks/${subId}`).then((res) => res.data),
};
