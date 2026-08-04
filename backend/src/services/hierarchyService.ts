import { canManageProject } from '../policies/accessPolicy';
import { activityLogRepository } from '../repositories/activityLogRepository';
import { hierarchyRepository } from '../repositories/hierarchyRepository';
import { projectRepository } from '../repositories/projectRepository';
import { badRequest, forbidden, notFound } from '../utils/httpError';

interface Actor { id: string; role: string; organizationId?: string; departmentId?: string | null }

const projectResource = (project: any) => ({
  organizationId: project.organization_id,
  departmentId: project.department_id,
  ownerUserId: project.owner_id,
  members: (project.project_members || []).map((membership: any) => ({ userId: membership.user?.id, projectRole: membership.project_role, permissions: membership.permissions_json })),
});

const assertManage = async (projectId: string, actor: Actor) => {
  const project = await projectRepository.findById(projectId);
  if (!project) throw notFound('Project not found');
  if (!canManageProject(actor, projectResource(project))) throw forbidden('Only a Manager in this project can change its structure');
  if (project.is_locked || project.status === 'Completed') throw badRequest('Completed projects are read-only');
  return project;
};

export const hierarchyService = {
  async list(projectId: string) {
    return hierarchyRepository.listMilestones(projectId);
  },
  async createMilestone(projectId: string, input: any, actor: Actor) {
    await assertManage(projectId, actor);
    const milestone = await hierarchyRepository.createMilestone({
      project_id: projectId, name: input.name.trim(), description: input.description?.trim() || null,
      sequence: input.sequence || 0, owner_user_id: input.ownerUserId || null,
      status: input.status || 'PLANNED', start_date: input.startDate || null, target_date: input.targetDate || null,
    });
    await activityLogRepository.create({ action: 'Milestone Created', user_id: actor.id, project_id: projectId, details: `Milestone ${milestone.name} was created.`, event: { eventType: 'MILESTONE_CREATED', entityType: 'MILESTONE', entityId: milestone.id } });
    return milestone;
  },
  async updateMilestone(id: string, input: any, actor: Actor) {
    const existing = await hierarchyRepository.findMilestone(id);
    if (!existing) throw notFound('Milestone not found');
    await assertManage(existing.project_id, actor);
    const patch = {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.description !== undefined && { description: input.description.trim() || null }),
      ...(input.sequence !== undefined && { sequence: input.sequence }),
      ...(input.ownerUserId !== undefined && { owner_user_id: input.ownerUserId || null }),
      ...(input.status !== undefined && { status: input.status, completed_at: input.status === 'COMPLETED' ? new Date().toISOString() : null }),
      ...(input.startDate !== undefined && { start_date: input.startDate || null }),
      ...(input.targetDate !== undefined && { target_date: input.targetDate || null }),
    };
    const updated = await hierarchyRepository.updateMilestone(id, patch);
    await activityLogRepository.create({ action: input.status === 'COMPLETED' ? 'Milestone Completed' : 'Milestone Updated', user_id: actor.id, project_id: existing.project_id, details: `Milestone ${updated.name} was updated.`, event: { eventType: input.status === 'COMPLETED' ? 'MILESTONE_COMPLETED' : 'MILESTONE_UPDATED', entityType: 'MILESTONE', entityId: id, payload: { changedFields: Object.keys(input) } } });
    return updated;
  },
  async archiveMilestone(id: string, actor: Actor) {
    const existing = await hierarchyRepository.findMilestone(id);
    if (!existing) throw notFound('Milestone not found');
    await assertManage(existing.project_id, actor);
    return hierarchyRepository.updateMilestone(id, { archived_at: new Date().toISOString(), status: 'CANCELLED' });
  },
  async createDeliverable(milestoneId: string, input: any, actor: Actor) {
    const milestone = await hierarchyRepository.findMilestone(milestoneId);
    if (!milestone) throw notFound('Milestone not found');
    await assertManage(milestone.project_id, actor);
    const deliverable = await hierarchyRepository.createDeliverable({
      project_id: milestone.project_id, milestone_id: milestoneId, name: input.name.trim(), description: input.description?.trim() || null,
      owner_user_id: input.ownerUserId || null, status: input.status || 'PLANNED', acceptance_criteria_json: input.acceptanceCriteria || [], target_date: input.targetDate || null,
    });
    await activityLogRepository.create({ action: 'Deliverable Created', user_id: actor.id, project_id: milestone.project_id, details: `Deliverable ${deliverable.name} was created.`, event: { eventType: 'DELIVERABLE_CREATED', entityType: 'DELIVERABLE', entityId: deliverable.id, payload: { milestoneId } } });
    return deliverable;
  },
  async updateDeliverable(id: string, input: any, actor: Actor) {
    const existing = await hierarchyRepository.findDeliverable(id);
    if (!existing) throw notFound('Deliverable not found');
    await assertManage(existing.project_id, actor);
    const updated = await hierarchyRepository.updateDeliverable(id, {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.description !== undefined && { description: input.description.trim() || null }),
      ...(input.ownerUserId !== undefined && { owner_user_id: input.ownerUserId || null }),
      ...(input.status !== undefined && { status: input.status, completed_at: input.status === 'COMPLETED' ? new Date().toISOString() : null }),
      ...(input.acceptanceCriteria !== undefined && { acceptance_criteria_json: input.acceptanceCriteria }),
      ...(input.targetDate !== undefined && { target_date: input.targetDate || null }),
    });
    await activityLogRepository.create({ action: 'Deliverable Updated', user_id: actor.id, project_id: existing.project_id, details: `Deliverable ${updated.name} was updated.`, event: { eventType: 'DELIVERABLE_UPDATED', entityType: 'DELIVERABLE', entityId: id, payload: { changedFields: Object.keys(input) } } });
    return updated;
  },
  async archiveDeliverable(id: string, actor: Actor) {
    const existing = await hierarchyRepository.findDeliverable(id);
    if (!existing) throw notFound('Deliverable not found');
    await assertManage(existing.project_id, actor);
    return hierarchyRepository.updateDeliverable(id, { archived_at: new Date().toISOString(), status: 'CANCELLED' });
  },
};
