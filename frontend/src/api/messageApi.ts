import api, { expectArray } from './index';
import type { Priority } from '../types';

export interface ImportantMessage {
  _id: string;
  title: string;
  description: string;
  priority: Priority;
  startDate: string;
  expiryDate: string;
  pinned: boolean;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertMessagePayload {
  title: string;
  description: string;
  priority: Priority;
  startDate?: string;
  expiryDate: string;
  pinned: boolean;
  active: boolean;
}

export const messageApi = {
  list: () => api.get<ImportantMessage[]>('/messages').then((res) => expectArray<ImportantMessage>(res.data)),

  listActive: () =>
    api.get<ImportantMessage[]>('/messages/active').then((res) => expectArray<ImportantMessage>(res.data)),

  create: (data: UpsertMessagePayload) => api.post<ImportantMessage>('/messages', data).then((res) => res.data),

  update: (id: string, data: Partial<UpsertMessagePayload>) =>
    api.put<ImportantMessage>(`/messages/${id}`, data).then((res) => res.data),

  remove: (id: string) => api.delete(`/messages/${id}`),
};
