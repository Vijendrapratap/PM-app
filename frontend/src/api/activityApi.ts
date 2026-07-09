import api, { expectArray } from './index';

export interface ActivityEntry {
  _id: string;
  action: string;
  details: string;
  actor: { _id: string; name: string; photo?: string | null } | null;
  project: { _id: string; name: string } | null;
  createdAt: string;
}

export const activityApi = {
  recent: (limit = 15) =>
    api.get<ActivityEntry[]>('/activity-logs', { params: { limit } }).then((res) => expectArray<ActivityEntry>(res.data)),
};
