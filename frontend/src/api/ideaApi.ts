import api, { expectArray } from './index';

export interface Idea {
  _id: string;
  title: string;
  description: string;
  status: 'Inbox' | 'Evaluating' | 'Planned' | 'Building' | 'Parked';
  impact: 'Low' | 'Medium' | 'High';
  effort: 'Small' | 'Medium' | 'Large';
  category: string | null;
  createdBy: { _id: string; name: string; photo?: string | null } | null;
  createdAt: string;
}

export const ideaApi = {
  list: () => api.get<Idea[]>('/ideas').then((res) => expectArray<Idea>(res.data)),

  create: (data: { title: string; description: string; category?: string; impact?: Idea['impact']; effort?: Idea['effort'] }) =>
    api.post<Idea>('/ideas', data).then((res) => res.data),

  update: (id: string, data: Partial<Pick<Idea, 'status' | 'impact' | 'effort' | 'category'>>) =>
    api.patch<Idea>(`/ideas/${id}`, data).then((res) => res.data),

  remove: (id: string) => api.delete(`/ideas/${id}`),
};
