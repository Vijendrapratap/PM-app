import api, { expectArray } from './index';
import type { User } from '../types';

export interface UpsertUserPayload {
  name: string;
  email: string;
  phone?: string;
  password?: string;
  role: string;
  department?: string;
  status?: string;
  skills: string[];
}

export const userApi = {
  list: () => api.get<User[]>('/users').then((res) => expectArray<User>(res.data)),

  update: (id: string, data: UpsertUserPayload) => api.put<User>(`/users/${id}`, data).then((res) => res.data),

  deactivate: (id: string) => api.post(`/users/${id}/deactivate`),

  activate: (id: string) => api.post(`/users/${id}/activate`),

  remove: (id: string) => api.delete(`/users/${id}`),

  resetPassword: (id: string, password: string) => api.post(`/users/${id}/reset-password`, { password }),
};
