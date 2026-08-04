import api from './index';

export interface ReportOverview {
  scope: 'PERSONAL' | 'MANAGED' | 'ORGANIZATION';
  generatedAt: string;
  metrics: {
    activeProjects: number;
    onTrackProjects: number;
    atRiskProjects: number;
    completedTasks: number;
    overdueTasks: number;
    activeBlockers: number;
    dailyPlanCompletion?: { planned: number; closed: number };
  };
  sources: {
    projects: { id: string; name: string; href: string }[];
    overdueTasks: { id: string; title: string; project: string; href: string }[];
    blockers: { id: string; summary: string; projectId: string; href: string }[];
  };
}

export const reportApi = {
  overview: () => api.get<ReportOverview>('/reports/overview').then((response) => response.data),
};
