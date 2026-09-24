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
  minutes: number | null;
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
  commitments: {
    taskId: string;
    position: number;
    outcome: 'DONE' | 'CARRIED' | 'BLOCKED' | null;
    carryReason: string | null;
    task: { _id: string; title: string; projectId: string; projectName: string | null; stage: string; carryForwardCount: number } | null;
  }[];
}

export const dailyWorkApi = {
  current: () => api.get<DailyWorkSession | null>('/daily-work/current').then((response) => response.data),
  history: (month: string) => api.get<DailyWorkSession[]>('/daily-work/history', { params: { month } }).then((response) => expectArray<DailyWorkSession>(response.data)),
  start: (body: { commitments: string[] } | { newTask: { title: string; projectId?: string } }) => api.post<DailyWorkSession>('/daily-work/start', body).then((response) => response.data),
  end: (outcomes: { taskId: string; outcome: 'DONE' | 'CARRIED' | 'BLOCKED'; reason?: string }[]) => api.post<DailyWorkSession>('/daily-work/end', { outcomes }).then((response) => response.data),
  addLog: (payload: { taskId?: string; newTask?: { title: string; projectId?: string }; title: string; description: string; minutes?: number }) => api.post<DailyWorkSession>('/daily-work/logs', payload).then((response) => response.data),
  admin: (params: { date?: string; startDate?: string; endDate?: string; userId?: string; projectId?: string; status?: string } = {}) => api.get<DailyWorkSession[]>('/daily-work/admin', { params }).then((response) => expectArray<DailyWorkSession>(response.data)),
};
