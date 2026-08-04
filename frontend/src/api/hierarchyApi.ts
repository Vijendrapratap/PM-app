import api, { expectArray } from './index';

export interface Deliverable {
  id: string;
  name: string;
  description: string | null;
  status: 'PLANNED' | 'ACTIVE' | 'IN_REVIEW' | 'COMPLETED' | 'CANCELLED';
  target_date: string | null;
}
export interface Milestone {
  id: string;
  name: string;
  description: string | null;
  sequence: number;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED';
  target_date: string | null;
  deliverables: Deliverable[];
}

export const hierarchyApi = {
  list: (projectId: string) => api.get<Milestone[]>(`/projects/${projectId}/milestones`).then((res) => expectArray<Milestone>(res.data)),
  createMilestone: (projectId: string, data: { name: string; targetDate?: string; sequence?: number }) => api.post<Milestone>(`/projects/${projectId}/milestones`, data).then((res) => res.data),
  updateMilestone: (id: string, data: Partial<{ name: string; targetDate: string; sequence: number; status: Milestone['status'] }>) => api.patch<Milestone>(`/milestones/${id}`, data).then((res) => res.data),
  createDeliverable: (milestoneId: string, data: { name: string; targetDate?: string }) => api.post<Deliverable>(`/milestones/${milestoneId}/deliverables`, data).then((res) => res.data),
  updateDeliverable: (id: string, data: Partial<{ name: string; targetDate: string; status: Deliverable['status'] }>) => api.patch<Deliverable>(`/deliverables/${id}`, data).then((res) => res.data),
};
