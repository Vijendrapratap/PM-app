import api, { expectArray } from './index';

export interface AppNotification {
  _id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export const notificationApi = {
  list: () => api.get<AppNotification[]>('/notifications').then((res) => expectArray<AppNotification>(res.data)),

  unreadCount: () => api.get<{ count: number }>('/notifications/unread-count').then((res) => res.data.count),

  markRead: (id: string) => api.post(`/notifications/${id}/read`),

  markAllRead: () => api.post('/notifications/read-all'),
};
