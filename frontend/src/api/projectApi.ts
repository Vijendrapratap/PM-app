import api, { expectArray } from './index';
import type { DailyReport, Project, ProjectUpdate } from '../types';

export interface UpsertProjectPayload {
  name?: string;
  description?: string;
  category?: string;
  department?: string;
  priority?: string;
  startDate?: string;
  estimatedCompletionDate?: string;
  deadline?: string;
  budget?: number;
  status?: string;
}

export const projectApi = {
  list: (includeArchived = false) =>
    api
      .get<Project[]>('/projects', { params: includeArchived ? { includeArchived: 'true' } : undefined })
      .then((res) => expectArray<Project>(res.data)),

  getById: (id: string) => api.get<Project>(`/projects/${id}`).then((res) => res.data),

  create: (data: FormData) =>
    api.post<Project>('/projects', data, { headers: { 'Content-Type': 'multipart/form-data' } }).then((res) => res.data),

  update: (id: string, data: UpsertProjectPayload) => api.put<Project>(`/projects/${id}`, data).then((res) => res.data),

  remove: (id: string) => api.delete(`/projects/${id}`),

  archive: (id: string) => api.post<Project>(`/projects/${id}/archive`).then((res) => res.data),

  restore: (id: string) => api.post<Project>(`/projects/${id}/restore`).then((res) => res.data),

  getUpdates: (projectId: string) =>
    api.get<ProjectUpdate[]>(`/projects/${projectId}/updates`).then((res) => expectArray<ProjectUpdate>(res.data)),

  addUpdate: (projectId: string, data: FormData) =>
    api
      .post<ProjectUpdate>(`/projects/${projectId}/updates`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.data),

  getDailyReports: (projectId: string) =>
    api.get<DailyReport[]>(`/projects/${projectId}/daily-reports`).then((res) => expectArray<DailyReport>(res.data)),

  saveDailyReport: (projectId: string, data: FormData) =>
    api
      .post<DailyReport>(`/projects/${projectId}/daily-reports`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.data),

  validateCompletion: (projectId: string) =>
    api.post<{ valid: boolean; errors?: string[] }>(`/projects/${projectId}/validate-completion`),

  finish: (
    projectId: string,
    data: { github?: string; googleDrive?: string; liveWebsite?: string; finalNotes?: string }
  ) => api.post<Project>(`/projects/${projectId}/finish`, data).then((res) => res.data),

  addMember: (projectId: string, userId: string) =>
    api.post<Project>(`/projects/${projectId}/members`, { userId }).then((res) => res.data),

  removeMember: (projectId: string, userId: string) =>
    api.delete<Project>(`/projects/${projectId}/members/${userId}`).then((res) => res.data),
};
