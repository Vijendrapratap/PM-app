import api, { expectArray } from './index';

export interface WorkLog {
  _id: string;
  sessionId: string;
  userId: string;
  projectId: string | null;
  project: { id?: string; _id?: string; name: string } | null;
  taskId: string | null;
  title: string;
  description: string;
  createdAt: string;
}

export interface DailyWorkSession {
  _id: string;
  userId: string;
  user?: { id?: string; _id?: string; name: string; email?: string; role?: string } | null;
  date: string;
  timezone: string;
  startAt: string;
  endAt: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'AUTO_COMPLETED';
  logs: WorkLog[];
}

export const dailyWorkApi = {
  current: () => api.get<DailyWorkSession | null>('/daily-work/current').then((response) => response.data),
  start: () => api.post<DailyWorkSession>('/daily-work/start').then((response) => response.data),
  end: () => api.post<DailyWorkSession>('/daily-work/end').then((response) => response.data),
  addLog: (payload: { projectId?: string; taskId?: string; title: string; description: string }) => api.post<DailyWorkSession>('/daily-work/logs', payload).then((response) => response.data),
  admin: (params: { date?: string; userId?: string; projectId?: string; status?: string } = {}) => api.get<DailyWorkSession[]>('/daily-work/admin', { params }).then((response) => expectArray<DailyWorkSession>(response.data)),
};
