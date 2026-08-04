import { randomUUID } from 'crypto';
import { agentWorkflowRepository } from '../repositories/agentWorkflowRepository';
import { activityLogRepository } from '../repositories/activityLogRepository';
import { blockerRepository } from '../repositories/blockerRepository';
import { caseStudyRepository } from '../repositories/caseStudyRepository';
import { projectRepository } from '../repositories/projectRepository';
import { projectTaskRepository } from '../repositories/projectTaskRepository';
import { badRequest, forbidden, notFound } from '../utils/httpError';
import { canApproveAgentWork, isSuperAdmin } from '../utils/roles';
import { validateCaseStudyMetrics } from '../utils/caseStudyMetrics';
interface Actor { id: string; role: string; organizationId?: string }
const dto = (row: any) => ({ _id: row.id, projectId: row.project_id, internalRetrospective: row.internal_retrospective_content, externalCaseStudy: row.external_case_study_content, demoPackage: row.demo_package_content, confidentialityFlags: row.confidentiality_flags_json || [], metricSources: row.metrics_sources_json || [], status: row.status, approvedBy: row.approved_by, approvedAt: row.approved_at, createdAt: row.created_at, updatedAt: row.updated_at });
const assertProject = async (projectId: string, actor: Actor) => {
  const project = await projectRepository.findById(projectId); if (!project) throw notFound('Project not found');
  if (!isSuperAdmin(actor.role) && !(project.owner_id === actor.id || await projectRepository.isMemberAssigned(projectId, actor.id))) throw forbidden('Project is outside your managed scope');
  return project;
};
export const caseStudyService = {
  async getByProject(projectId: string, actor: Actor) { await assertProject(projectId, actor); const row = await caseStudyRepository.findByProject(projectId); return row ? dto(row) : null; },
  async run(projectId: string, actor: Actor) {
    if (!canApproveAgentWork(actor.role)) throw forbidden('Only a Manager or CEO can draft a case study');
    const project: any = await assertProject(projectId, actor);
    if (!['Completed', 'COMPLETED'].includes(project.status) && project.canonical_status !== 'COMPLETED') throw badRequest('Complete the project before generating its case study');
    const run = await agentWorkflowRepository.createRun({ project_id: projectId, agent_type: 'Case Study', trigger_event: 'project.completed', input_snapshot: { projectId, sourcePolicy: 'database-records-only' }, created_by: actor.id });
    await agentWorkflowRepository.updateRun(run.id, { status: 'Working', started_at: new Date().toISOString() });
    try {
      const [tasks, events, blockers] = await Promise.all([projectTaskRepository.findForProject(projectId), activityLogRepository.findProjectEvents(projectId, 500), blockerRepository.findOpenForProjects([projectId])]);
      const done = tasks.filter((task: any) => ['Completed', 'DONE'].includes(task.status) || task.canonical_status === 'DONE');
      const metricSources = [
        { metric: 'tasks completed', value: done.length, sourceType: 'TASK_QUERY', sourceIds: done.map((task: any) => task.id) },
        { metric: 'recorded activity events', value: events.length, sourceType: 'ACTIVITY_EVENT_QUERY', sourceIds: events.map((event: any) => event.id) },
        { metric: 'open blockers at closure', value: blockers.length, sourceType: 'BLOCKER_QUERY', sourceIds: blockers.map((blocker: any) => blocker.id) },
      ];
      if (!validateCaseStudyMetrics(metricSources)) throw badRequest('Case-study metrics are missing verifiable sources');
      const blockerEvents = events.filter((event: any) => event.event_type === 'TASK_BLOCKED');
      const internal = `# Internal Retrospective — ${project.name}\n\n## What worked\n- ${done.length} recorded tasks reached completion.\n- ${events.length} activity events preserve the delivery trail.\n\n## What needs improvement\n- ${blockerEvents.length} blocker event(s) were recorded during delivery. Review their resolution time and repeated causes.\n\n## Estimation and process\nNo estimation variance is claimed unless a source record contains both planned and actual effort.\n\n## Lessons and next actions\nReview the linked blocker, decision, and change events with the delivery team before finalizing lessons learned.`;
      const external = `# ${project.name}\n\n## Context\n${project.client_name ? `Client: ${project.client_name} (publication requires confidentiality review).` : 'Internal initiative.'}\n\n## Challenge\n${project.objective || project.description || 'The source project does not contain a confirmed public challenge statement.'}\n\n## Approach\nThe team planned, implemented, reviewed, and closed the work using the project activity trail.\n\n## Outcome\n${project.expected_outcome || project.final_notes || 'A public outcome statement has not yet been confirmed.'}\n\n## Verified delivery signals\n- ${done.length} tasks are recorded as completed.\n- ${events.length} activity events support the implementation history.\n\n> Metrics beyond these source-backed counts require human evidence before publication.`;
      const demo = `# Demo Video Package — ${project.name}\n\n## 60-second script\n1. State the confirmed challenge.\n2. Show the primary completed workflow.\n3. Demonstrate one measurable, source-backed outcome.\n4. Close with the next action.\n\n## 3-minute walkthrough\nContext → workflow → implementation highlights → verified outcome → lessons.\n\n## Screens to record\nUse approved deliverable links and final project attachments. No screen list was invented because recordings must be selected by the project owner.\n\n## Suggested title\n${project.name}: delivery walkthrough`;
      const flags = [...(project.client_name ? [{ type: 'CLIENT_IDENTITY', message: 'Confirm permission to name the client.' }] : []), { type: 'METRIC_REVIEW', message: 'Only source-backed task and event counts are included.' }];
      const study = await caseStudyRepository.upsert({ organization_id: project.organization_id, project_id: projectId, internal_retrospective_content: internal, external_case_study_content: external, demo_package_content: demo, confidentiality_flags_json: flags, metrics_sources_json: metricSources, status: 'DRAFT', created_by_agent_run_id: run.id, approved_by: null, approved_at: null });
      await agentWorkflowRepository.updateRun(run.id, { status: 'Ready for review', provider: 'Source-grounded application service', output: { caseStudyId: study.id, metricSources }, completed_at: new Date().toISOString() });
      await activityLogRepository.create({ action: 'Case Study Drafted', user_id: actor.id, project_id: projectId, details: `A source-grounded case-study package was drafted for ${project.name}.`, event: { eventType: 'CASE_STUDY_DRAFTED', entityType: 'CASE_STUDY', entityId: study.id, correlationId: randomUUID(), agentRunId: run.id, payload: { metricSourceCount: metricSources.length } } });
      return { runId: run.id, caseStudy: dto(study) };
    } catch (error) { await agentWorkflowRepository.updateRun(run.id, { status: 'Failed', error: error instanceof Error ? error.message : 'Case-study generation failed', completed_at: new Date().toISOString() }); throw error; }
  },
  async get(id: string, actor: Actor) { const row = await caseStudyRepository.findById(id); if (!row) throw notFound('Case study not found'); await assertProject(row.project_id, actor); return dto(row); },
  async update(id: string, input: any, actor: Actor) { if (!canApproveAgentWork(actor.role)) throw forbidden('Only a Manager or CEO can edit case-study drafts'); const row = await caseStudyRepository.findById(id); if (!row) throw notFound('Case study not found'); await assertProject(row.project_id, actor); if (row.status === 'APPROVED') throw badRequest('Approved case studies are read-only'); return dto(await caseStudyRepository.update(id, { internal_retrospective_content: input.internalRetrospective ?? row.internal_retrospective_content, external_case_study_content: input.externalCaseStudy ?? row.external_case_study_content, demo_package_content: input.demoPackage ?? row.demo_package_content, status: input.submitReview ? 'IN_REVIEW' : row.status })); },
  async approve(id: string, actor: Actor) { if (!isSuperAdmin(actor.role)) throw forbidden('Only the CEO can approve external publication'); const row = await caseStudyRepository.findById(id); if (!row) throw notFound('Case study not found'); await assertProject(row.project_id, actor); const updated = await caseStudyRepository.update(id, { status: 'APPROVED', approved_by: actor.id, approved_at: new Date().toISOString() }); await activityLogRepository.create({ action: 'Case Study Approved', user_id: actor.id, project_id: row.project_id, details: 'External case-study publication was approved by the CEO.', event: { eventType: 'CASE_STUDY_APPROVED', entityType: 'CASE_STUDY', entityId: id } }); return dto(updated); },
};
