import { canManageProject } from '../policies/accessPolicy';
import { checkProjectTransition, type ProjectStage } from '../policies/workGatePolicy';
import { activityLogRepository } from '../repositories/activityLogRepository';
import { projectRepository } from '../repositories/projectRepository';
import { projectStage, workGateRepository } from '../repositories/workGateRepository';
import { HttpError, notFound } from '../utils/httpError';
import { isSuperAdmin } from '../utils/roles';
import { mapProject } from './mappers';
import { STAGE_TO_LEGACY } from './projectLifecycleStages';

interface Actor { id: string; role: string; organizationId?: string; departmentId?: string | null }

const resourceFor = (project: any) => ({
  organizationId: project.organization_id, departmentId: project.department_id, ownerUserId: project.owner_id,
  members: (project.project_members || []).map((membership: any) => ({ userId: membership.user?.id, projectRole: membership.project_role, permissions: membership.permissions_json })),
});

export const projectLifecycleService = {
  async transition(projectId: string, to: ProjectStage, options: { reason?: string; override?: boolean }, actor: Actor) {
    const project = await projectRepository.findById(projectId);
    if (!project) throw notFound('Project not found');
    const from = projectStage(project);
    const [limits, activeCounts, brief] = await Promise.all([
      workGateRepository.limits(project.organization_id),
      workGateRepository.activeProjectCounts(project.organization_id, project.owner_id, project.id),
      workGateRepository.briefFacts(project),
    ]);
    const result = checkProjectTransition({
      from, to, kind: project.kind || 'DELIVERY', isOwner: project.owner_id === actor.id,
      canManage: canManageProject(actor, resourceFor(project)), isCeo: isSuperAdmin(actor.role),
      reason: options.reason, override: options.override, brief, activeCounts, limits,
    });
    if (!result.ok) throw new HttpError(result.status, result.message);
    await projectRepository.update(projectId, { canonical_status: to, status: STAGE_TO_LEGACY[to] as any } as any);
    await activityLogRepository.create({
      action: 'Project Stage Changed', user_id: actor.id, project_id: projectId,
      details: `${project.name} moved from ${from} to ${to}${options.reason ? `: ${options.reason.trim()}` : ''}.`,
      event: { eventType: result.overrideUsed ? 'PROJECT_CAP_OVERRIDDEN' : 'PROJECT_STAGE_CHANGED', entityType: 'PROJECT', entityId: projectId, payload: { from, to, reason: options.reason?.trim() || null, override: Boolean(result.overrideUsed) } },
    });
    return mapProject(await projectRepository.findById(projectId));
  },
};
