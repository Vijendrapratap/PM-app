import { agentWorkflowRepository } from '../repositories/agentWorkflowRepository';
import { activityLogRepository } from '../repositories/activityLogRepository';
import { projectRepository } from '../repositories/projectRepository';
import { userRepository } from '../repositories/userRepository';
import { notificationService } from './notificationService';
import { getAgentDraftProvider, getAgentDraftProviderStatus } from './openAIAgentDraftProvider';
import { badRequest, forbidden, notFound } from '../utils/httpError';
import { canApproveAgentWork, canViewAllProjects, isLead } from '../utils/roles';
import { ProjectPlanContent } from '../types/models';
import { agentProposalRepository } from '../repositories/agentProposalRepository';
import { logger } from '../config/logger';

interface Actor { id: string; role: string }

const defaultAgentDefinitions = [
  {
    id: 'builtin-project-manager',
    agent_key: 'project-manager',
    name: 'Project Manager Agent',
    description: 'Turns a project brief into reviewable milestones, modules, tasks, estimates, risks and acceptance criteria.',
    system_prompt: 'You are a senior startup project manager. Convert the supplied project brief into a practical delivery plan for human review. Organize the plan as project, milestones, outcome-based modules, and small executable tasks. Return modules in the features field required by the application schema. Each module must belong to one milestone. Estimates are working-day estimates, never commitments. Do not invent customer facts, integrations, deadlines, or compliance requirements. Put uncertainty into assumptions, risks, or questions. Every acceptance criterion must be observable and testable.',
    active: true,
    updated_at: '1970-01-01T00:00:00.000Z',
    updater: null,
    versions: [],
    editable: false,
  },
  {
    id: 'builtin-business-analyst',
    agent_key: 'business-analyst',
    name: 'Business Analyst Agent',
    description: 'Turns an approved delivery plan into versioned business requirements and project guidance.',
    system_prompt: 'You are a senior business analyst. Produce a concise, complete Business Requirements Document in Markdown. Base every requirement on the supplied project and approved plan. Do not invent facts; label uncertainty as an assumption or open question. Include project overview, goals, scope, exclusions, functional and non-functional requirements, acceptance criteria, dependencies, risks, open questions and approval status. Clearly label all output as an agent draft until an authorized human approves it.',
    active: true,
    updated_at: '1970-01-01T00:00:00.000Z',
    updater: null,
    versions: [],
    editable: false,
  },
] as const;

const listAgentDefinitions = async () => {
  try {
    const definitions = await agentWorkflowRepository.listDefinitions();
    return definitions.length ? definitions.map((definition: any) => ({ ...definition, editable: true })) : [...defaultAgentDefinitions];
  } catch (error) {
    logger.warn('Agent prompt storage unavailable; using built-in definitions', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [...defaultAgentDefinitions];
  }
};

const findAgentDefinition = async (agentKey: 'project-manager' | 'business-analyst') => {
  try {
    return await agentWorkflowRepository.findDefinition(agentKey)
      || defaultAgentDefinitions.find((definition) => definition.agent_key === agentKey);
  } catch (error) {
    logger.warn('Agent definition lookup failed; using built-in prompt', {
      agentKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return defaultAgentDefinitions.find((definition) => definition.agent_key === agentKey);
  }
};

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
  sources: version.sources_json || [], missingInformation: version.missing_information_json || [], generatedByAgent: Boolean(version.generated_by_agent),
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
  const managers = await userRepository.findActiveByRoles(['Super Admin', 'Project Manager'], project.organization_id);
  const assignedLeads = (project.project_members || [])
    .map((membership: any) => membership.user)
    .filter((user: any) => user?.role === 'Lead');
  return [...new Set([...managers, ...assignedLeads].map((user: any) => user.id))];
};

const notifyUsers = async (ids: string[], type: string, title: string, message: string, link: string, relatedType: string, relatedId: string) => {
  await Promise.all(ids.map((id) => notificationService.notify(id, type, title, message, { link, relatedType, relatedId })));
};

export const agentWorkflowService = {
  async getStatus(actor: Actor) {
    if (!canApproveAgentWork(actor.role) && !isLead(actor.role)) throw forbidden('Agent Studio is available to Project Managers, Leads, and Super Admins');
    const definitions = await listAgentDefinitions();
    return {
      ...getAgentDraftProviderStatus(),
      agents: definitions.map((definition: any) => ({
        agentKey: definition.agent_key,
        name: definition.name,
        active: definition.active,
      })),
    };
  },

  async getDefinitions(actor: Actor) {
    if (!canApproveAgentWork(actor.role) && !isLead(actor.role)) throw forbidden('Agent Studio is available to Project Managers, Leads, and Super Admins');
    return (await listAgentDefinitions()).map((definition: any) => ({
      _id: definition.id, agentKey: definition.agent_key, name: definition.name, description: definition.description,
      systemPrompt: definition.system_prompt, active: definition.active, updatedAt: definition.updated_at,
      editable: definition.editable !== false,
      updatedBy: mapPerson(definition.updater), versions: (definition.versions || []).sort((a: any, b: any) => b.version - a.version).map((version: any) => ({
        _id: version.id, version: version.version, changeNote: version.change_note, createdAt: version.created_at, createdBy: mapPerson(version.creator),
      })),
    }));
  },

  async updateDefinition(id: string, systemPrompt: string, changeNote: string | undefined, actor: Actor) {
    if (!canApproveAgentWork(actor.role) && !isLead(actor.role)) throw forbidden('Agent Studio is available to Project Managers, Leads, and Super Admins');
    const definitions = await listAgentDefinitions();
    const definition = definitions.find((item: any) => item.id === id);
    if (!definition) throw notFound('Agent definition not found');
    if (definition.editable === false) throw badRequest('Prompt version storage is unavailable. Apply the agent definitions migration before publishing prompt changes.');
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
    const definition = await findAgentDefinition('project-manager');
    if (definition && !definition.active) throw badRequest('The Project Manager Agent is paused');
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
      await agentWorkflowRepository.updateRun(run.id, { status: 'Working', started_at: new Date().toISOString() });
      const content = await provider.createProjectPlan(snapshot, definition?.system_prompt);
      const version = await agentWorkflowRepository.nextPlanVersion(projectId);
      const plan = await agentWorkflowRepository.createPlan({
        project_id: projectId, agent_run_id: run.id, version, content, created_by: actor.id,
      });
      await agentProposalRepository.create({
        agent_run_id: run.id, organization_id: project.organization_id, project_id: projectId,
        proposal_type: 'PROJECT_PLAN', summary: content.summary,
        assumptions_json: content.assumptions, warnings_json: [...content.risks, ...content.questions],
        actions_json: [{ type: 'PUBLISH_PLAN', planId: plan.id, featureCount: content.features.length, taskCount: content.features.reduce((count, feature) => count + feature.tasks.length, 0) }],
        idempotency_key: `publish-plan:${plan.id}`,
      });
      await agentWorkflowRepository.updateRun(run.id, {
        status: 'Ready for review', provider: provider.name,
        output: content as unknown as Record<string, unknown>, completed_at: new Date().toISOString(),
      });
      await activityLogRepository.create({
        action: 'Planning Draft Ready', user_id: actor.id, project_id: projectId,
        details: `Project Manager Agent created plan v${version} with ${content.features.length} modules and ${content.features.reduce((count, feature) => count + feature.tasks.length, 0)} tasks.`,
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
    let proposal = plan.agent_run_id ? await agentProposalRepository.findForRun(plan.agent_run_id) : null;
    if (!proposal) proposal = await agentProposalRepository.create({ agent_run_id: plan.agent_run_id, organization_id: project.organization_id, project_id: projectId, proposal_type: 'PROJECT_PLAN', summary: content.summary || `Publish plan v${plan.version}`, assumptions_json: content.assumptions || [], warnings_json: [...(content.risks || []), ...(content.questions || [])], actions_json: [{ type: 'PUBLISH_PLAN', planId }], idempotency_key: `publish-plan:${planId}` });
    if (proposal.status === 'APPLIED' && plan.status === 'Approved') return mapWorkspace(await agentWorkflowRepository.listWorkspace(projectId));
    const claimed = await agentProposalRepository.claim(proposal.id, actor.id);
    if (!claimed) throw badRequest('This proposal is already being applied or was already decided');
    try {
      await agentWorkflowRepository.publishFeaturesAndTasks(projectId, planId, content, actor.id);
      if (plan.status !== 'Approved') await agentWorkflowRepository.approvePlan(planId, projectId, actor.id);
      await agentProposalRepository.applied(proposal.id, claimed.actions_json);
    } catch (error) {
      await agentProposalRepository.failed(proposal.id, error instanceof Error ? error.message : 'Proposal application failed');
      throw error;
    }
    if (plan.agent_run_id) {
      await agentWorkflowRepository.updateRun(plan.agent_run_id, {
        status: 'Approved', reviewed_by: actor.id, reviewed_at: new Date().toISOString(), review_note: 'Plan approved and published.',
      });
    }
    await projectRepository.update(projectId, { status: 'Planning' });
    await activityLogRepository.create({
      action: 'Project Plan Approved', user_id: actor.id, project_id: projectId,
      details: `Plan v${plan.version} was approved; ${content.features.length} modules were published to the project.`,
      event: { eventType: 'AGENT_PROPOSAL_APPLIED', entityType: 'AGENT_PROPOSAL', entityId: proposal.id, payload: { planId, appliedActions: claimed.actions_json } },
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
    const definition = await findAgentDefinition('business-analyst');
    if (definition && !definition.active) throw badRequest('The Business Analyst Agent is paused');
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
      await agentWorkflowRepository.updateRun(run.id, { status: 'Working', started_at: new Date().toISOString() });
      const draft = await provider.createBusinessRequirementsDocument(projectSnapshot(project), plan.content as ProjectPlanContent, definition?.system_prompt);
      const document = await agentWorkflowRepository.findOrCreateDocument(projectId, 'BRD', 'Business Requirements Document', actor.id);
      const version = await agentWorkflowRepository.nextDocumentVersion(document.id);
      const documentVersion = await agentWorkflowRepository.createDocumentVersion({
        document_id: document.id, agent_run_id: run.id, version, content: draft.content,
        structured_content: draft.structuredContent, created_by: actor.id,
        sources_json: [{ type: 'PROJECT', id: projectId }, { type: 'APPROVED_PLAN', id: planId, version: plan.version }],
        missing_information_json: plan.content && (plan.content as ProjectPlanContent).questions || [], generated_by_agent: true,
      });
      await agentProposalRepository.create({
        agent_run_id: run.id, organization_id: project.organization_id, project_id: projectId,
        proposal_type: 'DOCUMENT_DRAFT', summary: `Approve ${document.title} v${version} as official project guidance.`,
        assumptions_json: (draft.structuredContent as any).classifications?.filter((item: any) => item.label === 'Assumption') || [],
        warnings_json: (plan.content as ProjectPlanContent).questions,
        actions_json: [{ type: 'APPROVE_DOCUMENT', documentId: document.id, versionId: documentVersion.id }],
        idempotency_key: `approve-document:${documentVersion.id}`,
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
    let proposal = version.agent_run_id ? await agentProposalRepository.findForRun(version.agent_run_id) : null;
    if (!proposal && version.agent_run_id) proposal = await agentProposalRepository.create({ agent_run_id: version.agent_run_id, organization_id: project.organization_id, project_id: projectId, proposal_type: 'DOCUMENT_DRAFT', summary: `Approve ${version.document.title} v${version.version}.`, actions_json: [{ type: 'APPROVE_DOCUMENT', documentId: version.document_id, versionId }], idempotency_key: `approve-document:${versionId}` });
    if (proposal?.status === 'APPLIED' && version.status === 'Approved') return mapWorkspace(await agentWorkflowRepository.listWorkspace(projectId));
    const claimed = proposal ? await agentProposalRepository.claim(proposal.id, actor.id) : null;
    if (proposal && !claimed) throw badRequest('This document proposal is already being applied or was already decided');
    try {
      if (version.status !== 'Approved') await agentWorkflowRepository.approveDocumentVersion(versionId, version.document_id, actor.id);
      if (proposal) await agentProposalRepository.applied(proposal.id, claimed.actions_json);
    } catch (error) {
      if (proposal) await agentProposalRepository.failed(proposal.id, error instanceof Error ? error.message : 'Document approval failed');
      throw error;
    }
    if (version.agent_run_id) {
      await agentWorkflowRepository.updateRun(version.agent_run_id, {
        status: 'Approved', reviewed_by: actor.id, reviewed_at: new Date().toISOString(), review_note: 'Document approved.',
      });
    }
    await activityLogRepository.create({
      action: 'Project Document Approved', user_id: actor.id, project_id: projectId,
      details: `${version.document.title} v${version.version} was approved.`,
      event: proposal ? { eventType: 'AGENT_PROPOSAL_APPLIED', entityType: 'AGENT_PROPOSAL', entityId: proposal.id, payload: { versionId } } : { eventType: 'DOCUMENT_APPROVED', entityType: 'DOCUMENT', entityId: version.document_id, payload: { versionId } },
    });
    const memberIds = (project.project_members || []).map((membership: any) => membership.user?.id).filter(Boolean);
    await notifyUsers(memberIds, 'project_document_approved', 'Project document approved',
      `${version.document.title} v${version.version} for “${project.name}” is now approved guidance.`,
      `/projects/${projectId}?workspace=documents`, 'project_document_version', versionId);
    return mapWorkspace(await agentWorkflowRepository.listWorkspace(projectId));
  },

  async listDocuments(projectId: string, actor: Actor) {
    await assertProjectView(projectId, actor);
    return mapWorkspace(await agentWorkflowRepository.listWorkspace(projectId)).documents;
  },

  async createDocument(projectId: string, input: { documentType: string; title: string; content?: string }, actor: Actor) {
    await assertDraftEdit(projectId, actor);
    const project = await projectRepository.findById(projectId);
    const document = await agentWorkflowRepository.findOrCreateDocument(projectId, input.documentType, input.title, actor.id);
    const version = await agentWorkflowRepository.nextDocumentVersion(document.id);
    const created = await agentWorkflowRepository.createDocumentVersion({ document_id: document.id, agent_run_id: null, version, content: input.content || '', structured_content: { classifications: [] }, created_by: actor.id, sources_json: [{ type: 'PROJECT', id: projectId }], generated_by_agent: false });
    await activityLogRepository.create({ action: 'Document Created', user_id: actor.id, project_id: projectId, details: `${input.title} v${version} was created.`, event: { eventType: 'DOCUMENT_CREATED', entityType: 'DOCUMENT', entityId: document.id, payload: { versionId: created.id, documentType: input.documentType } } });
    return mapDocumentVersion(created);
  },

  async getDocument(documentId: string, actor: Actor) {
    const document = await agentWorkflowRepository.findDocumentById(documentId); if (!document) throw notFound('Document not found');
    await assertProjectView(document.project_id, actor);
    return mapWorkspace({ runs: [], plans: [], features: [], documents: [document] }).documents[0];
  },

  async updateDocument(documentId: string, content: string, actor: Actor) {
    const document = await agentWorkflowRepository.findDocumentById(documentId); if (!document) throw notFound('Document not found');
    await assertDraftEdit(document.project_id, actor);
    const version = [...(document.versions || [])].sort((a: any, b: any) => b.version - a.version)[0]; if (!version) throw notFound('Document version not found');
    return this.updateDocumentVersion(document.project_id, version.id, content, actor);
  },

  async submitDocument(documentId: string, actor: Actor) {
    const document = await agentWorkflowRepository.findDocumentById(documentId); if (!document) throw notFound('Document not found'); await assertDraftEdit(document.project_id, actor);
    const version = [...(document.versions || [])].sort((a: any, b: any) => b.version - a.version)[0]; if (!version) throw notFound('Document version not found');
    const updated = await agentWorkflowRepository.updateDocumentVersionStatus(version.id, 'In review');
    return mapDocumentVersion(updated);
  },

  async approveDocument(documentId: string, actor: Actor) {
    const document = await agentWorkflowRepository.findDocumentById(documentId); if (!document) throw notFound('Document not found');
    const version = [...(document.versions || [])].sort((a: any, b: any) => b.version - a.version)[0]; if (!version) throw notFound('Document version not found');
    return this.approveDocumentVersion(document.project_id, version.id, actor);
  },
};
