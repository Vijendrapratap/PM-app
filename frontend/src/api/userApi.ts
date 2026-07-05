import api from './index';
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
  list: () => api.get<User[]>('/users').then((res) => res.data),

  update: (id: string, data: UpsertUserPayload) => api.put<User>(`/users/${id}`, data).then((res) => res.data),

  deactivate: (id: string) => api.post(`/users/${id}/deactivate`),
};
