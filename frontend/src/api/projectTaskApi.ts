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
  milestoneId: string | null;
  deliverableId: string | null;
  milestone: { id: string; name: string } | null;
  deliverable: { id: string; name: string } | null;
  title: string;
  description: string | null;
  blockerReason: string | null;
  dueDate: string | null;
  priority: Priority;
  status: TaskStatus;
  canonicalStatus?: 'BACKLOG' | 'READY' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED' | 'DEFERRED';
  blocked?: boolean;
  assignedTo: TaskPerson | null;
  createdBy: TaskPerson | null;
  completedAt: string | null;
  documents: { name: string; url: string }[];
  comments: { _id: string; body: string; createdAt: string; author: TaskPerson | null }[];
  subtasks: ProjectTaskSubtask[];
  createdAt: string;
  updatedAt: string;
}

export interface AssignedProjectTask {
  _id: string;
  projectId: string;
  project: { _id: string; name: string; department?: string | null } | null;
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
  blockerReason?: string;
  milestoneId?: string | null;
  deliverableId?: string | null;
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

  update: (projectId: string, taskId: string, data: Partial<CreateProjectTaskPayload & { status: TaskStatus; canonicalStatus: ProjectTask['canonicalStatus'] }>) =>
    api.put<ProjectTask>(`/projects/${projectId}/tasks/${taskId}`, data).then((res) => res.data),

  addComment: (projectId: string, taskId: string, body: string) => api.post<ProjectTask>(`/projects/${projectId}/tasks/${taskId}/comments`, { body }).then((res) => res.data),

  addDocuments: (projectId: string, taskId: string, files: File[]) => {
    const data = new FormData(); files.forEach((file) => data.append('documents', file));
    return api.post<ProjectTask>(`/projects/${projectId}/tasks/${taskId}/documents`, data, { headers: { 'Content-Type': 'multipart/form-data' } }).then((res) => res.data);
  },

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
  start: (taskId: string) => api.post<ProjectTask>(`/tasks/${taskId}/start`).then((res) => res.data),
  pause: (taskId: string, note?: string) => api.post<ProjectTask>(`/tasks/${taskId}/pause`, { note }).then((res) => res.data),
  addUpdate: (taskId: string, updateText: string) => api.post(`/tasks/${taskId}/update`, { updateText }).then((res) => res.data),
  block: (taskId: string, data: { summary: string; details?: string; waitingOnType: 'PERSON' | 'CLIENT' | 'EXTERNAL_SYSTEM' | 'DECISION' | 'DEPENDENCY' | 'OTHER'; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; suggestedNextAction?: string }) => api.post(`/tasks/${taskId}/block`, data).then((res) => res.data),
  unblock: (taskId: string, resolutionNote: string) => api.post(`/tasks/${taskId}/unblock`, { resolutionNote }).then((res) => res.data),
  requestReview: (taskId: string, reviewerUserId?: string) => api.post<ProjectTask>(`/tasks/${taskId}/request-review`, { reviewerUserId }).then((res) => res.data),
  approve: (taskId: string, note?: string) => api.post<ProjectTask>(`/tasks/${taskId}/approve`, { note }).then((res) => res.data),
  reject: (taskId: string, note: string) => api.post<ProjectTask>(`/tasks/${taskId}/reject`, { note }).then((res) => res.data),
  complete: (taskId: string, completionNote?: string, reviewerUserId?: string) => api.post<ProjectTask>(`/tasks/${taskId}/complete`, { completionNote, reviewerUserId }).then((res) => res.data),
};
