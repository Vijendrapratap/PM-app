import api, { expectArray } from './index';

export interface Idea {
  _id: string;
  title: string;
  description: string;
  createdBy: { _id: string; name: string; photo?: string | null } | null;
  createdAt: string;
}

export const ideaApi = {
  list: () => api.get<Idea[]>('/ideas').then((res) => expectArray<Idea>(res.data)),

  create: (data: { title: string; description: string }) =>
    api.post<Idea>('/ideas', data).then((res) => res.data),

  remove: (id: string) => api.delete(`/ideas/${id}`),
};
