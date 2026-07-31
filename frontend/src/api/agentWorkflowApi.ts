import api from './index';
import type { Priority } from '../types';

export type AgentRunStatus = 'Queued' | 'Working' | 'Ready for review' | 'Approved' | 'Changes requested' | 'Failed';
export type ReviewStatus = 'Draft' | 'In review' | 'Approved' | 'Superseded';

export interface PlanTaskDraft {
  key: string;
  title: string;
  description: string;
  estimateDays: number;
  priority: Priority;
  acceptanceCriteria: string[];
}

export interface PlanFeatureDraft {
  key: string;
  title: string;
  outcome: string;
  description: string;
  acceptanceCriteria: string[];
  priority: Priority;
  estimateDays: number;
  confidence: 'Low' | 'Medium' | 'High';
  tasks: PlanTaskDraft[];
}

export interface ProjectPlanContent {
  summary: string;
  assumptions: string[];
  risks: string[];
  questions: string[];
  features: PlanFeatureDraft[];
}

export interface AgentRun {
  _id: string;
  projectId: string;
  agentType: 'Project Manager' | 'Business Analyst';
  status: AgentRunStatus;
  triggerEvent: string;
  provider: string;
  inputSnapshot: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  createdBy: { _id: string; name: string } | null;
  reviewedBy: { _id: string; name: string } | null;
  reviewNote: string | null;
  startedAt: string | null;
  completedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanVersion {
  _id: string;
  projectId: string;
  agentRunId: string | null;
  version: number;
  status: ReviewStatus;
  content: ProjectPlanContent;
  createdBy: { _id: string; name: string } | null;
  approvedBy: { _id: string; name: string } | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublishedFeature {
  _id: string;
  title: string;
  outcome: string;
  description: string;
  acceptanceCriteria: string[];
  priority: Priority;
  estimateDays: number;
  confidence: 'Low' | 'Medium' | 'High';
  status: string;
  tasks: Array<{ _id: string; title: string; description: string; priority: Priority; status: string; estimateDays: number; acceptanceCriteria: string[] }>;
}

export interface KnowledgeDocumentVersion {
  _id: string;
  documentId: string;
  agentRunId: string | null;
  version: number;
  status: ReviewStatus;
  content: string;
  structuredContent: Record<string, unknown>;
  createdBy: { _id: string; name: string } | null;
  approvedBy: { _id: string; name: string } | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeDocument {
  _id: string;
  projectId: string;
  documentType: string;
  title: string;
  versions: KnowledgeDocumentVersion[];
}

export interface AgentWorkspace {
  runs: AgentRun[];
  plans: PlanVersion[];
  features: PublishedFeature[];
  documents: KnowledgeDocument[];
}

export interface AgentReviewQueueItem {
  _id: string;
  agentType: 'Project Manager' | 'Business Analyst';
  status: AgentRunStatus;
  provider: string;
  completedAt: string | null;
  createdAt: string;
  workspace: 'plan' | 'documents';
  project: { _id: string; name: string; priority: Priority; deadline: string | null } | null;
}

export const agentWorkflowApi = {
  reviewQueue: () => api.get<AgentReviewQueueItem[]>('/agent-workflow/review-queue').then((response) => response.data),
  get: (projectId: string) => api.get<AgentWorkspace>(`/projects/${projectId}/agent-workflow`).then((response) => response.data),
  runProjectManager: (projectId: string, force = false) => api.post<AgentWorkspace>(`/projects/${projectId}/agents/project-manager/run`, { force }).then((response) => response.data),
  savePlan: (projectId: string, planId: string, content: ProjectPlanContent) => api.put<PlanVersion>(`/projects/${projectId}/plans/${planId}`, { content }).then((response) => response.data),
  approvePlan: (projectId: string, planId: string) => api.post<AgentWorkspace>(`/projects/${projectId}/plans/${planId}/approve`).then((response) => response.data),
  runBusinessAnalyst: (projectId: string, planId: string, force = false) => api.post<AgentWorkspace>(`/projects/${projectId}/plans/${planId}/agents/business-analyst/run`, { force }).then((response) => response.data),
  saveDocumentVersion: (projectId: string, versionId: string, content: string) => api.put<KnowledgeDocumentVersion>(`/projects/${projectId}/document-versions/${versionId}`, { content }).then((response) => response.data),
  approveDocumentVersion: (projectId: string, versionId: string) => api.post<AgentWorkspace>(`/projects/${projectId}/document-versions/${versionId}/approve`).then((response) => response.data),
};
