import { ideaRepository } from '../repositories/ideaRepository';
import { activityLogRepository } from '../repositories/activityLogRepository';
import { projectService } from './projectService';
import { badRequest, forbidden, notFound } from '../utils/httpError';
import { canApproveAgentWork, isSuperAdmin } from '../utils/roles';
import { calculateIdeaPriority } from '../utils/ideaScore';

interface Actor { id: string; role: string; organizationId?: string; departmentId?: string | null }
const scores = (input: any) => {
  const values = [input.businessValueScore, input.strategicAlignmentScore, input.urgencyScore, input.deliveryEffortScore];
  return values.every((value) => value !== undefined) ? calculateIdeaPriority(Number(values[0]), Number(values[1]), Number(values[2]), Number(values[3])) : undefined;
};
const toDto = (idea: any) => ({
  _id: idea.id, title: idea.title, description: idea.problem || idea.description, problem: idea.problem || idea.description,
  proposedSolution: idea.proposed_solution, beneficiary: idea.beneficiary, expectedValue: idea.expected_value,
  status: idea.status ?? 'INBOX', impact: idea.impact ?? 'Medium', effort: idea.effort ?? 'Medium', category: idea.category ?? null,
  departmentId: idea.department_id, department: idea.department || null,
  businessValueScore: idea.business_value_score, strategicAlignmentScore: idea.strategic_alignment_score,
  urgencyScore: idea.urgency_score, deliveryEffortScore: idea.delivery_effort_score, priorityScore: idea.priority_score,
  aiRefinement: idea.ai_refinement_json, convertedProject: idea.converted_project || null,
  createdBy: idea.creator ? { _id: idea.creator.id, name: idea.creator.name, photo: idea.creator.photo } : null,
  createdAt: idea.created_at, updatedAt: idea.updated_at,
});
const assertOrganization = (idea: any, actor: Actor) => {
  if (actor.organizationId && idea.organization_id && idea.organization_id !== actor.organizationId) throw forbidden('Idea is outside your organization');
};

export const ideaService = {
  async list(actor: Actor) { return (await ideaRepository.list(actor.organizationId)).map(toDto); },
  async get(id: string, actor: Actor) { const idea = await ideaRepository.findById(id); if (!idea) throw notFound('Idea not found'); assertOrganization(idea, actor); return toDto(idea); },
  async create(input: any, actor: Actor) {
    const idea = await ideaRepository.create({ title: input.title, description: input.problem || input.description, problem: input.problem || input.description, proposed_solution: input.proposedSolution, beneficiary: input.beneficiary, expected_value: input.expectedValue, category: input.category, impact: input.impact, effort: input.effort, department_id: input.departmentId || actor.departmentId, organization_id: actor.organizationId, submitted_by: actor.id, created_by: actor.id, status: 'INBOX' });
    await activityLogRepository.create({ action: 'Idea Created', user_id: actor.id, details: `Idea ${idea.title} was submitted.`, event: { eventType: 'IDEA_CREATED', entityType: 'IDEA', entityId: idea.id } });
    return toDto(idea);
  },
  async update(id: string, input: any, actor: Actor) {
    const existing: any = await ideaRepository.findById(id); if (!existing) throw notFound('Idea not found'); assertOrganization(existing, actor);
    const manager = canApproveAgentWork(actor.role);
    if (!manager && (existing.created_by !== actor.id || existing.status !== 'INBOX')) throw forbidden('Ideas can only be edited by their author before review');
    const patch: Record<string, unknown> = {};
    const mapping: Record<string, string> = { title: 'title', problem: 'problem', description: 'description', proposedSolution: 'proposed_solution', beneficiary: 'beneficiary', expectedValue: 'expected_value', category: 'category', impact: 'impact', effort: 'effort', departmentId: 'department_id', businessValueScore: 'business_value_score', strategicAlignmentScore: 'strategic_alignment_score', urgencyScore: 'urgency_score', deliveryEffortScore: 'delivery_effort_score' };
    Object.entries(mapping).forEach(([source, target]) => { if (input[source] !== undefined) patch[target] = input[source]; });
    if (manager && input.status) patch.status = input.status;
    const priority = scores(input); if (priority !== undefined) patch.priority_score = priority;
    const updated = await ideaRepository.update(id, patch);
    await activityLogRepository.create({ action: 'Idea Updated', user_id: actor.id, details: `Idea ${existing.title} was updated.`, event: { eventType: 'IDEA_UPDATED', entityType: 'IDEA', entityId: id, payload: { changedFields: Object.keys(patch) } } });
    return toDto(updated);
  },
  async transition(id: string, status: string, actor: Actor, note?: string) {
    if (!canApproveAgentWork(actor.role)) throw forbidden('Only an authorized Manager or CEO can review ideas');
    const existing: any = await ideaRepository.findById(id); if (!existing) throw notFound('Idea not found'); assertOrganization(existing, actor);
    const updated = await ideaRepository.update(id, { status });
    const eventType = status === 'APPROVED' ? 'IDEA_APPROVED' : status === 'REJECTED' ? 'IDEA_REJECTED' : 'IDEA_REVIEWED';
    await activityLogRepository.create({ action: 'Idea Reviewed', user_id: actor.id, details: `${existing.title} moved to ${status}.`, event: { eventType, entityType: 'IDEA', entityId: id, payload: { status, note } } });
    return toDto(updated);
  },
  async convert(id: string, actor: Actor) {
    if (!isSuperAdmin(actor.role)) throw forbidden('CEO approval is required to convert an idea to a project');
    const idea: any = await ideaRepository.findById(id); if (!idea) throw notFound('Idea not found'); assertOrganization(idea, actor);
    if (idea.status !== 'APPROVED') throw badRequest('Approve the idea before converting it');
    if (idea.converted_project_id) throw badRequest('Idea has already been converted');
    const project: any = await projectService.createProject({ name: idea.title, description: idea.problem || idea.description, department: idea.department?.name || idea.category, priority: idea.impact === 'High' ? 'High' : 'Medium', status: 'Draft', actorId: actor.id, actorRole: actor.role, organizationId: actor.organizationId, sourceIdeaId: id, files: [] });
    await ideaRepository.update(id, { status: 'CONVERTED_TO_PROJECT', converted_project_id: project._id });
    await activityLogRepository.create({ action: 'Idea Converted', user_id: actor.id, project_id: project._id, details: `${idea.title} was converted to a draft project.`, event: { eventType: 'IDEA_CONVERTED', entityType: 'IDEA', entityId: id, payload: { projectId: project._id } } });
    return { idea: toDto(await ideaRepository.findById(id)), project };
  },
  async remove(id: string, actor: Actor) { if (!isSuperAdmin(actor.role)) throw forbidden('Only the CEO can archive ideas'); const existing: any = await ideaRepository.findById(id); if (!existing) throw notFound('Idea not found'); assertOrganization(existing, actor); await ideaRepository.remove(id); return { message: 'Idea archived successfully' }; },
};
