import api, { expectArray } from './index';
export type IdeaStatus = 'INBOX' | 'NEEDS_CLARIFICATION' | 'UNDER_REVIEW' | 'VALIDATING' | 'APPROVED' | 'INCUBATING' | 'CONVERTED_TO_PROJECT' | 'ARCHIVED' | 'REJECTED';
export interface Idea {
  _id: string; title: string; description: string; problem?: string; proposedSolution?: string | null; beneficiary?: string | null; expectedValue?: string | null;
  status: IdeaStatus; impact: 'Low' | 'Medium' | 'High'; effort: 'Small' | 'Medium' | 'Large'; category: string | null;
  department?: { id: string; name: string; type: string } | null;
  businessValueScore?: number | null; strategicAlignmentScore?: number | null; urgencyScore?: number | null; deliveryEffortScore?: number | null; priorityScore?: number | null;
  convertedProject?: { id: string; name: string } | null; createdBy: { _id: string; name: string; photo?: string | null } | null; createdAt: string;
}
export const ideaApi = {
  list: () => api.get<Idea[]>('/ideas').then((res) => expectArray<Idea>(res.data)),
  get: (id: string) => api.get<Idea>(`/ideas/${id}`).then((res) => res.data),
  create: (data: { title: string; problem: string; category: string; proposedSolution?: string; beneficiary?: string; expectedValue?: string }) => api.post<Idea>('/ideas', data).then((res) => res.data),
  update: (id: string, data: Partial<Idea> & Record<string, unknown>) => api.patch<Idea>(`/ideas/${id}`, data).then((res) => res.data),
  review: (id: string, status: 'UNDER_REVIEW' | 'NEEDS_CLARIFICATION' | 'VALIDATING' = 'UNDER_REVIEW') => api.post<Idea>(`/ideas/${id}/review`, { status }).then((res) => res.data),
  approve: (id: string) => api.post<Idea>(`/ideas/${id}/approve`).then((res) => res.data),
  reject: (id: string) => api.post<Idea>(`/ideas/${id}/reject`).then((res) => res.data),
  convert: (id: string) => api.post<{ idea: Idea; project: { _id: string } }>(`/ideas/${id}/convert`).then((res) => res.data),
  remove: (id: string) => api.delete(`/ideas/${id}`),
};
