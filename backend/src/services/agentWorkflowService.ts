import { agentWorkflowRepository } from '../repositories/agentWorkflowRepository';
import { activityLogRepository } from '../repositories/activityLogRepository';
import { projectRepository } from '../repositories/projectRepository';
import { userRepository } from '../repositories/userRepository';
import { notificationService } from './notificationService';
import { getAgentDraftProvider } from './openAIAgentDraftProvider';
import { badRequest, forbidden, notFound } from '../utils/httpError';
import { canApproveAgentWork, canViewAllProjects, isLead } from '../utils/roles';
import { ProjectPlanContent } from '../types/models';

interface Actor { id: string; role: string }

const mapPerson = (person: any) => person ? { _id: person.id, name: person.name, photo: person.photo } : null;
const mapRun = (run: any) => ({
  _id: run.id, projectId: run.project_id, agentType: run.agent_type, status: run.status,
  triggerEvent: run.trigger_event, provider: run.provider, inputSnapshot: run.input_snapshot,
  output: run.output, error: run.error, createdBy: mapPerson(run.creator), reviewedBy: mapPerson(run.reviewer),
  reviewNote: run.review_note, startedAt: run.started_at, completedAt: run.completed_at,
  reviewedAt: run.reviewed_at, createdAt: run.created_at, updatedAt: run.updated_at,
});
const mapPlan = (plan: any) => ({
  _id: plan.id, projectId: plan.project_id, agentRunId: plan.agent_run_id, version: plan.version,
  status: plan.status, content: plan.content, createdBy: mapPerson(plan.creator), approvedBy: mapPerson(plan.approver),
  approvedAt: plan.approved_at, createdAt: plan.created_at, updatedAt: plan.updated_at,
});
const mapDocumentVersion = (version: any) => ({
  _id: version.id, documentId: version.document_id, agentRunId: version.agent_run_id,
  version: version.version, status: version.status, content: version.content,
  structuredContent: version.structured_content, createdBy: mapPerson(version.creator), approvedBy: mapPerson(version.approver),
  approvedAt: version.approved_at, createdAt: version.created_at, updatedAt: version.updated_at,
});
const mapWorkspace = (workspace: any) => ({
  runs: workspace.runs.map(mapRun),
  plans: workspace.plans.map(mapPlan),
  features: workspace.features.map((feature: any) => ({
    _id: feature.id, projectId: feature.project_id, sourcePlanVersionId: feature.source_plan_version_id,
    title: feature.title, outcome: feature.outcome, description: feature.description,
    acceptanceCriteria: feature.acceptance_criteria || [], priority: feature.priority,
    estimateDays: Number(feature.estimate_days || 0), confidence: feature.confidence, status: feature.status,
    position: feature.position,
    tasks: (feature.tasks || []).map((task: any) => ({
      _id: task.id, title: task.title, description: task.description, priority: task.priority,
      status: task.status, estimateDays: Number(task.estimate_days || 0), acceptanceCriteria: task.acceptance_criteria || [],
      assignedTo: task.assigned_to, dueDate: task.due_date,
    })),
  })),
  documents: workspace.documents.map((document: any) => ({
    _id: document.id, projectId: document.project_id, documentType: document.document_type,
    title: document.title, createdBy: mapPerson(document.creator), createdAt: document.created_at,
    versions: (document.versions || []).map(mapDocumentVersion).sort((a: any, b: any) => b.version - a.version),
  })),
});

const projectSnapshot = (project: any) => ({
  id: project.id, name: project.name, description: project.description, category: project.category,
  department: project.department, priority: project.priority, deadline: project.deadline,
  estimatedCompletionDate: project.estimated_completion_date, tags: project.tags || [],
});

const assertProjectView = async (projectId: string, actor: Actor) => {
  const project = await projectRepository.findById(projectId);
  if (!project) throw notFound('Project not found');
  if (!canViewAllProjects(actor.role) && !(await projectRepository.isMemberAssigned(projectId, actor.id))) {
    throw forbidden('You can only view agent work for projects assigned to you');
  }
  return project;
};

const assertDraftEdit = async (projectId: string, actor: Actor) => {
  const project = await assertProjectView(projectId, actor);
  if (canApproveAgentWork(actor.role)) return project;
  if (isLead(actor.role) && await projectRepository.isMemberAssigned(projectId, actor.id)) return project;
  throw forbidden('Only a Project Manager, Super Admin, or assigned Lead can edit agent drafts');
};

const assertApproval = (actor: Actor) => {
  if (!canApproveAgentWork(actor.role)) throw forbidden('Only a Project Manager or Super Admin can approve agent work');
};

const reviewerIds = async (project: any) => {
  const managers = await userRepository.findActiveByRoles(['Super Admin', 'Project Manager']);
  const assignedLeads = (project.project_members || [])
    .map((membership: any) => membership.user)
    .filter((user: any) => user?.role === 'Lead');
  return [...new Set([...managers, ...assignedLeads].map((user: any) => user.id))];
};

const notifyUsers = async (ids: string[], type: string, title: string, message: string, link: string, relatedType: string, relatedId: string) => {
  await Promise.all(ids.map((id) => notificationService.notify(id, type, title, message, { link, relatedType, relatedId })));
};

export const agentWorkflowService = {
  async getDefinitions(actor: Actor) {
    if (!canApproveAgentWork(actor.role) && !isLead(actor.role)) throw forbidden('Agent Studio is available to Project Managers, Leads, and Super Admins');
    return (await agentWorkflowRepository.listDefinitions()).map((definition: any) => ({
      _id: definition.id, agentKey: definition.agent_key, name: definition.name, description: definition.description,
      systemPrompt: definition.system_prompt, active: definition.active, updatedAt: definition.updated_at,
      updatedBy: mapPerson(definition.updater), versions: (definition.versions || []).sort((a: any, b: any) => b.version - a.version).map((version: any) => ({
        _id: version.id, version: version.version, changeNote: version.change_note, createdAt: version.created_at, createdBy: mapPerson(version.creator),
      })),
    }));
  },

  async updateDefinition(id: string, systemPrompt: string, changeNote: string | undefined, actor: Actor) {
    if (!canApproveAgentWork(actor.role) && !isLead(actor.role)) throw forbidden('Agent Studio is available to Project Managers, Leads, and Super Admins');
    const definitions = await agentWorkflowRepository.listDefinitions();
    const definition = definitions.find((item: any) => item.id === id);
    if (!definition) throw notFound('Agent definition not found');
    const updated = await agentWorkflowRepository.updateDefinitionPrompt(id, systemPrompt, changeNote, actor.id);
    await activityLogRepository.create({ action: 'Agent Prompt Updated', user_id: actor.id, details: `${definition.name} system prompt was updated as version ${updated.version}.` });
    return this.getDefinitions(actor);
  },

  async getReviewQueue(actor: Actor) {
    if (!canApproveAgentWork(actor.role) && !isLead(actor.role)) return [];
    const rows = await agentWorkflowRepository.listReviewQueue();
    let allowedProjectIds: Set<string> | null = null;
    if (isLead(actor.role)) {
      const projects = await projectRepository.findForUser(actor.id);
      allowedProjectIds = new Set(projects.map((project: any) => project.id));
    }
    return rows
      .filter((row: any) => !allowedProjectIds || allowedProjectIds.has(row.project?.id))
      .map((row: any) => ({
        _id: row.id, agentType: row.agent_type, status: row.status, provider: row.provider,
        completedAt: row.completed_at, createdAt: row.created_at,
        project: row.project ? { _id: row.project.id, name: row.project.name, priority: row.project.priority, deadline: row.project.deadline } : null,
        workspace: row.agent_type === 'Project Manager' ? 'plan' : 'documents',
      }));
  },

  async getWorkspace(projectId: string, actor: Actor) {
    await assertProjectView(projectId, actor);
    return mapWorkspace(await agentWorkflowRepository.listWorkspace(projectId));
  },

  async runProjectManagerAgent(projectId: string, actor: Actor, force = false) {
    const project = await assertDraftEdit(projectId, actor);
    const latest = await agentWorkflowRepository.findLatestRun(projectId, 'Project Manager');
    if (!force && latest && ['Queued', 'Working', 'Ready for review'].includes(latest.status)) {
      return mapWorkspace(await agentWorkflowRepository.listWorkspace(projectId));
    }

    const snapshot = projectSnapshot(project);
    const run = await agentWorkflowRepository.createRun({
      project_id: projectId, agent_type: 'Project Manager', trigger_event: 'project.created',
      input_snapshot: snapshot, created_by: actor.id,
    });
    try {
      const provider = getAgentDraftProvider();
      const definition = await agentWorkflowRepository.findDefinition('project-manager');
      await agentWorkflowRepository.updateRun(run.id, { status: 'Working', started_at: new Date().toISOString() });
      const content = await provider.createProjectPlan(snapshot, definition?.system_prompt);
      const version = await agentWorkflowRepository.nextPlanVersion(projectId);
      const plan = await agentWorkflowRepository.createPlan({
        project_id: projectId, agent_run_id: run.id, version, content, created_by: actor.id,
      });
      await agentWorkflowRepository.updateRun(run.id, {
        status: 'Ready for review', provider: provider.name,
        output: content as unknown as Record<string, unknown>, completed_at: new Date().toISOString(),
      });
      await activityLogRepository.create({
        action: 'Planning Draft Ready', user_id: actor.id, project_id: projectId,
        details: `Project Manager Agent created plan v${version} with ${content.features.length} features and ${content.features.reduce((count, feature) => count + feature.tasks.length, 0)} tasks.`,
      });
      await notifyUsers(await reviewerIds(project), 'agent_plan_review', 'Planning draft ready',
        `The Project Manager Agent prepared plan v${version} for “${project.name}”.`,
        `/projects/${projectId}?workspace=plan`, 'project_plan', plan.id);
    } catch (error) {
      await agentWorkflowRepository.updateRun(run.id, {
        status: 'Failed', error: error instanceof Error ? error.message : 'Draft generation failed', completed_at: new Date().toISOString(),
      });
    }
    return mapWorkspace(await agentWorkflowRepository.listWorkspace(projectId));
  },

  async updatePlan(projectId: string, planId: string, content: ProjectPlanContent, actor: Actor) {
    await assertDraftEdit(projectId, actor);
    const plan = await agentWorkflowRepository.findPlanById(planId);
    if (!plan || plan.project_id !== projectId) throw notFound('Plan version not found');
    if (plan.status === 'Approved') throw badRequest('Approved plans are immutable. Generate a new version to make changes.');
    const updated = await agentWorkflowRepository.updatePlan(planId, content);
    if (!updated) throw badRequest('This plan can no longer be edited');
    await activityLogRepository.create({
      action: 'Planning Draft Edited', user_id: actor.id, project_id: projectId,
      details: `Plan v${plan.version} was edited before approval.`,
    });
    return mapPlan(updated);
  },

  async approvePlan(projectId: string, planId: string, actor: Actor) {
    assertApproval(actor);
    const project = await assertProjectView(projectId, actor);
    const plan = await agentWorkflowRepository.findPlanById(planId);
    if (!plan || plan.project_id !== projectId) throw notFound('Plan version not found');
    const content = plan.content as ProjectPlanContent;
    await agentWorkflowRepository.publishFeaturesAndTasks(projectId, planId, content, actor.id);
    if (plan.status !== 'Approved') await agentWorkflowRepository.approvePlan(planId, projectId, actor.id);
    if (plan.agent_run_id) {
      await agentWorkflowRepository.updateRun(plan.agent_run_id, {
        status: 'Approved', reviewed_by: actor.id, reviewed_at: new Date().toISOString(), review_note: 'Plan approved and published.',
      });
    }
    await projectRepository.update(projectId, { status: 'Planning' });
    await activityLogRepository.create({
      action: 'Project Plan Approved', user_id: actor.id, project_id: projectId,
      details: `Plan v${plan.version} was approved; ${content.features.length} features were published to the project.`,
    });
    const memberIds = (project.project_members || []).map((membership: any) => membership.user?.id).filter(Boolean);
    await notifyUsers(memberIds, 'project_plan_approved', 'Project plan approved',
      `Plan v${plan.version} for “${project.name}” is now the shared delivery plan.`,
      `/projects/${projectId}?workspace=plan`, 'project_plan', planId);
    await this.runBusinessAnalystAgent(projectId, planId, actor);
    return mapWorkspace(await agentWorkflowRepository.listWorkspace(projectId));
  },

  async runBusinessAnalystAgent(projectId: string, planId: string, actor: Actor, force = false) {
    const project = await assertDraftEdit(projectId, actor);
    const plan = await agentWorkflowRepository.findPlanById(planId);
    if (!plan || plan.project_id !== projectId || plan.status !== 'Approved') throw badRequest('Approve the project plan before generating business documentation');
    const latest = await agentWorkflowRepository.findLatestRun(projectId, 'Business Analyst');
    if (!force && latest && ['Queued', 'Working', 'Ready for review'].includes(latest.status)) {
      return mapWorkspace(await agentWorkflowRepository.listWorkspace(projectId));
    }
    const snapshot = { project: projectSnapshot(project), planId, planVersion: plan.version, plan: plan.content };
    const run = await agentWorkflowRepository.createRun({
      project_id: projectId, agent_type: 'Business Analyst', trigger_event: 'project.plan.approved',
      input_snapshot: snapshot, created_by: actor.id,
    });
    try {
      const provider = getAgentDraftProvider();
      const definition = await agentWorkflowRepository.findDefinition('business-analyst');
      await agentWorkflowRepository.updateRun(run.id, { status: 'Working', started_at: new Date().toISOString() });
      const draft = await provider.createBusinessRequirementsDocument(projectSnapshot(project), plan.content as ProjectPlanContent, definition?.system_prompt);
      const document = await agentWorkflowRepository.findOrCreateDocument(projectId, 'BRD', 'Business Requirements Document', actor.id);
      const version = await agentWorkflowRepository.nextDocumentVersion(document.id);
      const documentVersion = await agentWorkflowRepository.createDocumentVersion({
        document_id: document.id, agent_run_id: run.id, version, content: draft.content,
        structured_content: draft.structuredContent, created_by: actor.id,
      });
      await agentWorkflowRepository.updateRun(run.id, {
        status: 'Ready for review', provider: provider.name,
        output: { documentId: document.id, documentVersionId: documentVersion.id, version }, completed_at: new Date().toISOString(),
      });
      await activityLogRepository.create({
        action: 'BRD Draft Ready', user_id: actor.id, project_id: projectId,
        details: `Business Analyst Agent created BRD v${version} from approved plan v${plan.version}.`,
      });
      await notifyUsers(await reviewerIds(project), 'agent_document_review', 'BRD draft ready',
        `The Business Analyst Agent prepared BRD v${version} for “${project.name}”.`,
        `/projects/${projectId}?workspace=documents`, 'project_document_version', documentVersion.id);
    } catch (error) {
      await agentWorkflowRepository.updateRun(run.id, {
        status: 'Failed', error: error instanceof Error ? error.message : 'Document generation failed', completed_at: new Date().toISOString(),
      });
    }
    return mapWorkspace(await agentWorkflowRepository.listWorkspace(projectId));
  },

  async updateDocumentVersion(projectId: string, versionId: string, content: string, actor: Actor) {
    await assertDraftEdit(projectId, actor);
    const version = await agentWorkflowRepository.findDocumentVersionById(versionId);
    if (!version || version.document?.project_id !== projectId) throw notFound('Document version not found');
    if (version.status === 'Approved') throw badRequest('Approved document versions are immutable');
    const updated = await agentWorkflowRepository.updateDocumentVersion(versionId, content);
    if (!updated) throw badRequest('This document version can no longer be edited');
    await activityLogRepository.create({
      action: 'Document Draft Edited', user_id: actor.id, project_id: projectId,
      details: `${version.document.title} v${version.version} was edited before approval.`,
    });
    return mapDocumentVersion(updated);
  },

  async approveDocumentVersion(projectId: string, versionId: string, actor: Actor) {
    assertApproval(actor);
    const project = await assertProjectView(projectId, actor);
    const version = await agentWorkflowRepository.findDocumentVersionById(versionId);
    if (!version || version.document?.project_id !== projectId) throw notFound('Document version not found');
    if (version.status !== 'Approved') await agentWorkflowRepository.approveDocumentVersion(versionId, version.document_id, actor.id);
    if (version.agent_run_id) {
      await agentWorkflowRepository.updateRun(version.agent_run_id, {
        status: 'Approved', reviewed_by: actor.id, reviewed_at: new Date().toISOString(), review_note: 'Document approved.',
      });
    }
    await activityLogRepository.create({
      action: 'Project Document Approved', user_id: actor.id, project_id: projectId,
      details: `${version.document.title} v${version.version} was approved.`,
    });
    const memberIds = (project.project_members || []).map((membership: any) => membership.user?.id).filter(Boolean);
    await notifyUsers(memberIds, 'project_document_approved', 'Project document approved',
      `${version.document.title} v${version.version} for “${project.name}” is now approved guidance.`,
      `/projects/${projectId}?workspace=documents`, 'project_document_version', versionId);
    return mapWorkspace(await agentWorkflowRepository.listWorkspace(projectId));
  },
};
