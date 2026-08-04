import api, { expectArray } from './index';

export interface WorkSession {
  _id: string;
  dailyPlanId: string;
  taskId: string | null;
  status: 'ACTIVE' | 'PAUSED' | 'CLOSED';
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  note: string | null;
}

export interface WorkSessionSummary {
  dailyPlanId: string;
  totalMinutes: number;
  activeSession: WorkSession | null;
  sessions: WorkSession[];
}

export const workSessionApi = {
  summary: (dailyPlanId: string) => api.get<WorkSessionSummary>('/work-sessions/summary', { params: { dailyPlanId } }).then((response) => ({
    ...response.data,
    sessions: expectArray<WorkSession>(response.data.sessions),
  })),
  start: (dailyPlanId: string, taskId?: string, note?: string) => api.post<WorkSession>('/work-sessions/start', { dailyPlanId, taskId, note }).then((response) => response.data),
  pause: (sessionId: string) => api.post<WorkSession>(`/work-sessions/${sessionId}/pause`).then((response) => response.data),
  close: (sessionId: string) => api.post<WorkSession>(`/work-sessions/${sessionId}/close`).then((response) => response.data),
};
