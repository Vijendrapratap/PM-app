import { supabase } from '../config/supabase';
import { AgentRunStatus, AgentType, ProjectPlanContent } from '../types/models';

const RUN_SELECT = '*, creator:created_by(id, name, photo), reviewer:reviewed_by(id, name, photo)';
const PLAN_SELECT = '*, run:agent_run_id(id, agent_type, status, provider), creator:created_by(id, name), approver:approved_by(id, name)';
const DOCUMENT_SELECT = `
  *,
  creator:created_by(id, name),
  versions:project_knowledge_document_versions(
    *, run:agent_run_id(id, agent_type, status, provider),
    creator:created_by(id, name), approver:approved_by(id, name)
  )
`;

export const agentWorkflowRepository = {
  async createRun(input: {
    project_id: string;
    agent_type: AgentType;
    trigger_event: string;
    input_snapshot: Record<string, unknown>;
    created_by: string;
  }) {
    const { data, error } = await supabase.from('agent_runs').insert(input).select(RUN_SELECT).single();
    if (error) throw error;
    return data;
  },

  async updateRun(id: string, patch: {
    status?: AgentRunStatus;
    provider?: string;
    output?: Record<string, unknown>;
    error?: string | null;
    reviewed_by?: string;
    review_note?: string | null;
    started_at?: string;
    completed_at?: string;
    reviewed_at?: string;
  }) {
    const { data, error } = await supabase
      .from('agent_runs')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(RUN_SELECT)
      .single();
    if (error) throw error;
    return data;
  },

  async findLatestRun(projectId: string, agentType: AgentType) {
    const { data, error } = await supabase
      .from('agent_runs')
      .select(RUN_SELECT)
      .eq('project_id', projectId)
      .eq('agent_type', agentType)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async nextPlanVersion(projectId: string) {
    const { data, error } = await supabase
      .from('project_plan_versions')
      .select('version')
      .eq('project_id', projectId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data?.version || 0) + 1;
  },

  async createPlan(input: {
    project_id: string;
    agent_run_id: string;
    version: number;
    content: ProjectPlanContent;
    created_by: string;
  }) {
    const { data, error } = await supabase
      .from('project_plan_versions')
      .insert({ ...input, status: 'In review' })
      .select(PLAN_SELECT)
      .single();
    if (error) throw error;
    return data;
  },

  async findPlanById(id: string) {
    const { data, error } = await supabase.from('project_plan_versions').select(PLAN_SELECT).eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async updatePlan(id: string, content: ProjectPlanContent) {
    const { data, error } = await supabase
      .from('project_plan_versions')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', id)
      .neq('status', 'Approved')
      .select(PLAN_SELECT)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async approvePlan(id: string, projectId: string, approverId: string) {
    const approvedAt = new Date().toISOString();
    const { error: supersedeError } = await supabase
      .from('project_plan_versions')
      .update({ status: 'Superseded', updated_at: approvedAt })
      .eq('project_id', projectId)
      .eq('status', 'Approved')
      .neq('id', id);
    if (supersedeError) throw supersedeError;

    const { data, error } = await supabase
      .from('project_plan_versions')
      .update({ status: 'Approved', approved_by: approverId, approved_at: approvedAt, updated_at: approvedAt })
      .eq('id', id)
      .select(PLAN_SELECT)
      .single();
    if (error) throw error;
    return data;
  },

  async publishFeaturesAndTasks(projectId: string, planId: string, content: ProjectPlanContent, actorId: string) {
    const { data: existing, error: existingError } = await supabase
      .from('project_features')
      .select('id, source_key')
      .eq('source_plan_version_id', planId);
    if (existingError) throw existingError;
    let features = existing || [];
    if (features.length === 0) {
      const { data, error: featureError } = await supabase.from('project_features').insert(
        content.features.map((feature, position) => ({
          project_id: projectId,
          source_plan_version_id: planId,
          source_key: feature.key,
          title: feature.title,
          outcome: feature.outcome,
          description: feature.description,
          acceptance_criteria: feature.acceptanceCriteria,
          priority: feature.priority,
          estimate_days: feature.estimateDays,
          confidence: feature.confidence,
          position,
        }))
      ).select('id, source_key');
      if (featureError) throw featureError;
      features = data || [];
    }

    const featureIds = new Map((features || []).map((feature) => [feature.source_key, feature.id]));
    const { data: existingTasks, error: existingTasksError } = await supabase
      .from('project_tasks')
      .select('agent_source_key')
      .eq('source_plan_version_id', planId);
    if (existingTasksError) throw existingTasksError;
    const existingTaskKeys = new Set((existingTasks || []).map((task) => task.agent_source_key));
    const tasks = content.features.flatMap((feature) => feature.tasks
      .filter((task) => !existingTaskKeys.has(task.key))
      .map((task) => ({
      project_id: projectId,
      feature_id: featureIds.get(feature.key),
      source_plan_version_id: planId,
      agent_source_key: task.key,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: 'Pending',
      estimate_days: task.estimateDays,
      acceptance_criteria: task.acceptanceCriteria,
      created_by: actorId,
    })));
    if (tasks.length) {
      const { error } = await supabase.from('project_tasks').insert(tasks);
      if (error) throw error;
    }
    return features || [];
  },

  async findOrCreateDocument(projectId: string, documentType: string, title: string, creatorId: string) {
    const { data: existing, error: findError } = await supabase
      .from('project_knowledge_documents')
      .select('*')
      .eq('project_id', projectId)
      .eq('document_type', documentType)
      .maybeSingle();
    if (findError) throw findError;
    if (existing) return existing;
    const { data, error } = await supabase.from('project_knowledge_documents').insert({
      project_id: projectId, document_type: documentType, title, created_by: creatorId,
    }).select('*').single();
    if (error) throw error;
    return data;
  },

  async nextDocumentVersion(documentId: string) {
    const { data, error } = await supabase
      .from('project_knowledge_document_versions')
      .select('version')
      .eq('document_id', documentId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data?.version || 0) + 1;
  },

  async createDocumentVersion(input: {
    document_id: string;
    agent_run_id: string;
    version: number;
    content: string;
    structured_content: Record<string, unknown>;
    created_by: string;
  }) {
    const { data, error } = await supabase.from('project_knowledge_document_versions')
      .insert({ ...input, status: 'In review' })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async findDocumentVersionById(id: string) {
    const { data, error } = await supabase
      .from('project_knowledge_document_versions')
      .select('*, document:document_id(*)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async updateDocumentVersion(id: string, content: string) {
    const { data, error } = await supabase
      .from('project_knowledge_document_versions')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', id)
      .neq('status', 'Approved')
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async approveDocumentVersion(id: string, documentId: string, approverId: string) {
    const approvedAt = new Date().toISOString();
    const { error: supersedeError } = await supabase
      .from('project_knowledge_document_versions')
      .update({ status: 'Superseded', updated_at: approvedAt })
      .eq('document_id', documentId)
      .eq('status', 'Approved')
      .neq('id', id);
    if (supersedeError) throw supersedeError;
    const { data, error } = await supabase
      .from('project_knowledge_document_versions')
      .update({ status: 'Approved', approved_by: approverId, approved_at: approvedAt, updated_at: approvedAt })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async listWorkspace(projectId: string) {
    const [runsResult, plansResult, featuresResult, documentsResult] = await Promise.all([
      supabase.from('agent_runs').select(RUN_SELECT).eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('project_plan_versions').select(PLAN_SELECT).eq('project_id', projectId).order('version', { ascending: false }),
      supabase.from('project_features').select('*, tasks:project_tasks(*)').eq('project_id', projectId).order('position'),
      supabase.from('project_knowledge_documents').select(DOCUMENT_SELECT).eq('project_id', projectId).order('created_at'),
    ]);
    const error = runsResult.error || plansResult.error || featuresResult.error || documentsResult.error;
    if (error) throw error;
    return {
      runs: runsResult.data || [], plans: plansResult.data || [],
      features: featuresResult.data || [], documents: documentsResult.data || [],
    };
  },

  async listReviewQueue() {
    const { data, error } = await supabase
      .from('agent_runs')
      .select('id, agent_type, status, provider, completed_at, created_at, project:project_id(id, name, priority, deadline)')
      .eq('status', 'Ready for review')
      .order('completed_at', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data || [];
  },
};
