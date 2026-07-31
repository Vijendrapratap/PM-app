import api, { expectArray } from './index';

export type WorkdayItemStatus = 'Planned' | 'In Progress' | 'Completed' | 'Blocked' | 'Deferred';

export interface WorkdayItem {
  _id: string;
  projectId: string | null;
  project: { _id: string; name: string; status: string; progress: number } | null;
  taskId: string | null;
  task: { _id: string; title: string; status: string } | null;
  title: string;
  plannedOutcome: string;
  status: WorkdayItemStatus;
  progressNote: string | null;
  blockerReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Workday {
  _id: string;
  userId: string;
  user: { _id: string; name: string; email: string; role: string; department?: string | null; photo?: string | null } | null;
  workDate: string;
  status: 'Open' | 'Completed';
  focus: string;
  checkInAt: string;
  checkOutAt: string | null;
  completedSummary: string | null;
  blockers: string | null;
  remarks: string | null;
  items: WorkdayItem[];
  createdAt: string;
  updatedAt: string;
}

export interface TeamPulseEntry {
  user: { _id: string; name: string; email: string; role: string; department?: string | null; photo?: string | null };
  availability: string;
  state: 'Not started' | 'Working' | 'Closed';
  workday: Workday | null;
}

export interface StartWorkdayPayload {
  focus: string;
  items: Array<{ projectId: string; taskId?: string; title: string; plannedOutcome: string }>;
}

export const workdayApi = {
  today: () => api.get<Workday | null>('/workdays/today').then((response) => response.data),
  start: (payload: StartWorkdayPayload) => api.post<Workday>('/workdays/start', payload).then((response) => response.data),
  updateItem: (itemId: string, payload: { status?: WorkdayItemStatus; progressNote?: string; blockerReason?: string }) =>
    api.patch<Workday>(`/workdays/items/${itemId}`, payload).then((response) => response.data),
  finish: (payload: {
    completedSummary: string;
    blockers?: string;
    remarks?: string;
    items: Array<{ id: string; status: WorkdayItemStatus; progressNote?: string; blockerReason?: string }>;
  }) => api.post<Workday>('/workdays/finish', payload).then((response) => response.data),
  team: (date: string) => api.get<TeamPulseEntry[]>('/workdays/team', { params: { date } }).then((response) => expectArray<TeamPulseEntry>(response.data)),
};
