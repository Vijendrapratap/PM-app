import api from './index';
export interface CaseStudy { _id: string; projectId: string; internalRetrospective: string; externalCaseStudy: string; demoPackage: string; confidentialityFlags: Array<{ type: string; message: string }>; metricSources: Array<{ metric: string; value: number; sourceType: string; sourceIds: string[] }>; status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'ARCHIVED'; approvedAt?: string | null }
export const caseStudyApi = {
  forProject: (projectId: string) => api.get<CaseStudy | null>(`/projects/${projectId}/case-study`).then((response) => response.data),
  run: (projectId: string) => api.post<{ runId: string; caseStudy: CaseStudy }>('/agents/case-study/run', { projectId }).then((response) => response.data),
  update: (id: string, data: Partial<Pick<CaseStudy, 'internalRetrospective' | 'externalCaseStudy' | 'demoPackage'>> & { submitReview?: boolean }) => api.patch<CaseStudy>(`/case-studies/${id}`, data).then((response) => response.data),
  approve: (id: string) => api.post<CaseStudy>(`/case-studies/${id}/approve`).then((response) => response.data),
};
