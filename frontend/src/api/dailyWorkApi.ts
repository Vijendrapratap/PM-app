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

export type DayOutcome = 'DONE' | 'CARRIED' | 'DELAYED' | 'BLOCKED';
export type DelayReason = 'OTHER_TASK' | 'URGENT_REQUEST' | 'WAITING_ON_SOMEONE' | 'MEETINGS' | 'UNCLEAR_REQUIREMENTS' | 'LEAVE' | 'OTHER';
export const OUTCOME_LABELS: Record<DayOutcome, string> = { DONE: 'Done', CARRIED: 'Worked on, continues', DELAYED: 'Delayed', BLOCKED: 'Blocked' };
export const DELAY_REASON_LABELS: Record<DelayReason, string> = {
  OTHER_TASK: 'Spent time on another task', URGENT_REQUEST: 'Urgent / unplanned request', WAITING_ON_SOMEONE: 'Waiting on someone / client',
  MEETINGS: 'Meetings', UNCLEAR_REQUIREMENTS: 'Unclear requirements', LEAVE: 'Leave / unwell', OTHER: 'Other',
};

export interface DailyWorkSession {
  _id: string;
  userId: string;
  user?: { id?: string; _id?: string; name: string; email?: string; role?: string } | null;
  date: string;
  timezone: string;
  startAt: string;
  endAt: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'AUTO_COMPLETED';
  hours: { workedMinutes: number; expectedMinutes: number; shortByMinutes: number };
  logs: WorkLog[];
  commitments: {
    taskId: string;
    position: number;
    outcome: DayOutcome | null;
    reasonCode: DelayReason | null;
    carryReason: string | null;
    task: { _id: string; title: string; projectId: string; projectName: string | null; stage: string; carryForwardCount: number } | null;
  }[];
}

export const dailyWorkApi = {
  current: () => api.get<DailyWorkSession | null>('/daily-work/current').then((response) => response.data),
  history: (month: string) => api.get<DailyWorkSession[]>('/daily-work/history', { params: { month } }).then((response) => expectArray<DailyWorkSession>(response.data)),
  start: (body: { commitments: string[] } | { newTask: { title: string; projectId?: string } }) => api.post<DailyWorkSession>('/daily-work/start', body).then((response) => response.data),
  end: (outcomes: { taskId: string; outcome: DayOutcome; reasonCode?: DelayReason; reason?: string }[]) => api.post<DailyWorkSession>('/daily-work/end', { outcomes }).then((response) => response.data),
  addLog: (payload: { taskId?: string; newTask?: { title: string; projectId?: string }; title: string; description: string; minutes?: number }) => api.post<DailyWorkSession>('/daily-work/logs', payload).then((response) => response.data),
  admin: (params: { date?: string; startDate?: string; endDate?: string; userId?: string; projectId?: string; status?: string } = {}) => api.get<DailyWorkSession[]>('/daily-work/admin', { params }).then((response) => expectArray<DailyWorkSession>(response.data)),
};
