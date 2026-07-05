import api from './index';
import type { DailyReport, Project, ProjectUpdate } from '../types';

export const projectApi = {
  list: () => api.get<Project[]>('/projects').then((res) => res.data),

  getById: (id: string) => api.get<Project>(`/projects/${id}`).then((res) => res.data),

  create: (data: FormData) =>
    api.post<Project>('/projects', data, { headers: { 'Content-Type': 'multipart/form-data' } }).then((res) => res.data),

  getUpdates: (projectId: string) =>
    api.get<ProjectUpdate[]>(`/projects/${projectId}/updates`).then((res) => res.data),

  addUpdate: (projectId: string, data: FormData) =>
    api
      .post<ProjectUpdate>(`/projects/${projectId}/updates`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.data),

  getDailyReports: (projectId: string) =>
    api.get<DailyReport[]>(`/projects/${projectId}/daily-reports`).then((res) => res.data),

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
};
