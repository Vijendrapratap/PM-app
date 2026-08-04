import { projectRepository } from '../repositories/projectRepository';
import { updateRepository } from '../repositories/updateRepository';
import { dailyReportRepository } from '../repositories/dailyReportRepository';
import { activityLogRepository } from '../repositories/activityLogRepository';
import { userRepository } from '../repositories/userRepository';
import { getSystemUserId } from '../repositories/systemUser';
import { uploadFiles } from '../lib/storage';
import { notificationService } from './notificationService';
import { mapProject, mapUpdate, mapDailyReport } from './mappers';
import { badRequest, forbidden, notFound } from '../utils/httpError';
import { canApproveAgentWork, canViewAllProjects, isSuperAdmin } from '../utils/roles';
import { agentWorkflowService } from './agentWorkflowService';
import { logger } from '../config/logger';
import { canManageProject, canViewProject } from '../policies/accessPolicy';
import { blockerRepository } from '../repositories/blockerRepository';
import { hierarchyRepository } from '../repositories/hierarchyRepository';
import { projectTaskRepository } from '../repositories/projectTaskRepository';
import { recommendProjectHealth } from '../utils/projectHealth';
import { projectProgressService } from './projectProgressService';

interface Actor {
  id: string;
  role: string;
  organizationId?: string;
  departmentId?: string | null;
}

const toArray = (value: unknown): unknown[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

interface CreateProjectInput {
  name: string;
  description?: string;
  category?: string;
  department?: string;
  priority?: string;
  startDate?: string;
  estimatedCompletionDate?: string;
  deadline?: string;
  budget?: number;
  assignedMembers?: unknown;
  tags?: unknown;
  status?: string;
  actorId?: string;
  actorRole?: string;
  organizationId?: string;
  sourceIdeaId?: string;
  useAiPlanning?: boolean | string;
  files: Express.Multer.File[];
}

export const projectService = {
  // CEO has organization-wide authority. A Manager can edit a project they
  // own or manage through membership; a Team Member can only update their own
  // assigned work through task services. Never rely on hidden client controls.
  async assertProjectEditAccess(projectId: string, actor: Actor) {
    const project = await projectRepository.findById(projectId);
    if (!project) throw notFound('Project not found');
    if (canManageProject(actor, {
      organizationId: project.organization_id,
      departmentId: project.department_id,
      ownerUserId: project.owner_id,
      members: (project.project_members || []).map((membership: any) => ({
        userId: membership.user?.id,
        projectRole: membership.project_role,
        permissions: membership.permissions_json,
      })),
    })) return;
    throw forbidden('Only the project owner or an assigned Manager can edit this project');
  },

  async assertProjectContributionAccess(projectId: string, actor: Actor) {
    const project = await projectRepository.findById(projectId);
    if (!project) throw notFound('Project not found');
    if (canViewProject(actor, {
      organizationId: project.organization_id,
      departmentId: project.department_id,
      ownerUserId: project.owner_id,
      members: (project.project_members || []).map((membership: any) => ({
        userId: membership.user?.id,
        projectRole: membership.project_role,
        permissions: membership.permissions_json,
      })),
    })) return;
    throw forbidden('Only assigned project members can post to this work log');
  },

  async createProject(input: CreateProjectInput) {
    const existing = await projectRepository.findByName(input.name);
    if (existing) throw badRequest('Project name already taken');

    const requestedMemberIds = toArray(input.assignedMembers) as string[];
    const activeMembers = requestedMemberIds.length
      ? await userRepository.findManyActiveByIds(requestedMemberIds)
      : [];

    const ownerId = input.actorId || (await getSystemUserId());

    const project = await projectRepository.create({
      name: input.name,
      description: input.description,
      category: input.category,
      department: input.department,
      priority: (input.priority as any) || 'Medium',
      start_date: input.startDate || null,
      estimated_completion_date: input.estimatedCompletionDate || null,
      deadline: input.deadline || null,
      budget: input.budget,
      status: (input.status as any) || 'Draft',
      tags: toArray(input.tags) as string[],
      owner_id: ownerId,
      organization_id: input.organizationId,
      source_idea_id: input.sourceIdeaId,
      created_by: ownerId,
      objective: input.description || input.name,
    });

    await projectRepository.addMembers(
      project.id,
      activeMembers.map((member) => member.id)
    );

    for (const member of activeMembers) {
      await notificationService.notify(member.id, 'project_assigned', 'Project Assigned', `You were assigned to "${project.name}".`, {
        link: `/projects/${project.id}`,
        relatedType: 'project',
        relatedId: project.id,
      });
    }

    if (input.files.length > 0) {
      const uploaded = await uploadFiles(`projects/${project.id}`, input.files);
      await projectRepository.addInitialDocuments(
        project.id,
        uploaded.map((file) => ({ name: file.name, storage_path: file.storagePath }))
      );
    }

    await activityLogRepository.create({
      action: 'Project Created',
      user_id: ownerId,
      project_id: project.id,
      details: `Project ${project.name} was created.`,
    });

    // A project remains valid even if the drafting side effect fails (for
    // example before the additive migration is applied). The failed run can
    // be retried from the project workspace without duplicating the project.
    if (input.useAiPlanning !== false && input.useAiPlanning !== 'false') {
      try {
        await agentWorkflowService.runProjectManagerAgent(project.id, { id: ownerId, role: input.actorRole || 'Super Admin' });
      } catch (error) {
        logger.error('Failed to trigger Project Manager Agent', {
          projectId: project.id, error: error instanceof Error ? error.message : error,
        });
      }
    }

    const full = await projectRepository.findById(project.id);
    return mapProject(full);
  },

  async getProjects(includeArchived = false, actor?: Actor) {
    const rows = actor && !canViewAllProjects(actor.role)
      ? await projectRepository.findForUser(actor.id, includeArchived)
      : await projectRepository.findAll(includeArchived);
    return rows.map(mapProject);
  },

  async getProjectById(id: string) {
    const row = await projectRepository.findById(id);
    if (!row) throw notFound('Project not found');
    return mapProject(row);
  },

  async getOverview(id: string) {
    const project = await projectRepository.findById(id);
    if (!project) throw notFound('Project not found');
    const [milestones, tasks, blockers] = await Promise.all([
      hierarchyRepository.listMilestones(id), projectTaskRepository.findForProject(id), blockerRepository.findOpenForProjects([id]),
    ]);
    const now = new Date();
    const activeTasks = tasks.filter((task: any) => !['Completed', 'Cancelled'].includes(task.status));
    const overdueActiveTasks = activeTasks.filter((task: any) => task.due_date && new Date(`${task.due_date}T23:59:59Z`) < now).length;
    const overdueMilestones = milestones.filter((milestone: any) => milestone.status !== 'COMPLETED' && milestone.target_date && new Date(`${milestone.target_date}T23:59:59Z`) < now).length;
    const oldestBlockerAgeDays = blockers.length ? Math.max(...blockers.map((blocker: any) => Math.floor((now.getTime() - new Date(blocker.created_at).getTime()) / 86_400_000))) : 0;
    const signals = { overdueMilestones, overdueActiveTasks, activeTasks: activeTasks.length, criticalBlockers: blockers.filter((blocker: any) => blocker.severity === 'CRITICAL').length, oldestBlockerAgeDays, repeatedCarryovers: 0, staleDays: Math.floor((now.getTime() - new Date(project.updated_at).getTime()) / 86_400_000) };
    return { project: mapProject(project), milestones, blockers, taskSummary: { total: tasks.length, active: activeTasks.length, overdue: overdueActiveTasks, done: tasks.filter((task: any) => task.status === 'Completed').length }, health: { current: project.health, recommended: recommendProjectHealth(signals), signals } };
  },

  async setHealth(id: string, health: 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'NOT_SET', note: string | undefined, actor: Actor) {
    await this.assertProjectEditAccess(id, actor);
    const updated = await projectRepository.update(id, { health, health_note: note?.trim() || null, health_updated_by: actor.id, health_updated_at: new Date().toISOString() } as any);
    if (!updated) throw notFound('Project not found');
    await activityLogRepository.create({ action: 'Project Health Changed', user_id: actor.id, project_id: id, details: `Project health changed to ${health}.`, event: { eventType: 'PROJECT_HEALTH_CHANGED', entityType: 'PROJECT', entityId: id, payload: { health, note } } });
    return mapProject(await projectRepository.findById(id));
  },

  async addProjectDocuments(id: string, files: Express.Multer.File[], actorId: string) {
    const project = await projectRepository.findById(id);
    if (!project) throw notFound('Project not found');
    if (!files.length) throw badRequest('Select at least one document');
    const uploaded = await uploadFiles(`projects/${id}`, files);
    await projectRepository.addInitialDocuments(id, uploaded.map((file) => ({ name: file.name, storage_path: file.storagePath })));
    await activityLogRepository.create({ action: 'Project Documents Added', user_id: actorId, project_id: id, details: `${files.length} document${files.length === 1 ? '' : 's'} added to ${project.name}.` });
    return mapProject(await projectRepository.findById(id));
  },

  async updateProject(
    id: string,
    patch: Partial<{
      name: string;
      description: string;
      category: string;
      department: string;
      priority: string;
      startDate: string;
      estimatedCompletionDate: string;
      deadline: string;
      budget: number;
      status: string;
      github: string;
      demoVideo: string;
    }>,
    actorId?: string,
  ) {
    const existing = await projectRepository.findById(id);
    if (!existing) throw notFound('Project not found');

    const updated = await projectRepository.update(id, {
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.description !== undefined && { description: patch.description }),
      ...(patch.category !== undefined && { category: patch.category }),
      ...(patch.department !== undefined && { department: patch.department }),
      ...(patch.priority !== undefined && { priority: patch.priority as any }),
      ...(patch.startDate !== undefined && { start_date: patch.startDate }),
      ...(patch.estimatedCompletionDate !== undefined && { estimated_completion_date: patch.estimatedCompletionDate }),
      ...(patch.deadline !== undefined && { deadline: patch.deadline }),
      ...(patch.budget !== undefined && { budget: patch.budget }),
      ...(patch.status !== undefined && { status: patch.status as any }),
      ...(patch.github !== undefined && { final_github: patch.github || null }),
      ...(patch.demoVideo !== undefined && { final_demo_video: patch.demoVideo || null }),
    });
    if (!updated) throw notFound('Project not found');

    if (actorId) await activityLogRepository.create({
      action: 'Project Updated', user_id: actorId, project_id: id,
      details: `Project ${updated.name} was updated.`,
      event: { eventType: 'PROJECT_UPDATED', entityType: 'PROJECT', entityId: id, payload: { changedFields: Object.keys(patch) } },
    });

    const full = await projectRepository.findById(id);
    return mapProject(full);
  },

  async archiveProject(id: string, actorId?: string) {
    const updated = await projectRepository.update(id, { archived: true, archived_at: new Date().toISOString() });
    if (!updated) throw notFound('Project not found');
    if (actorId) await activityLogRepository.create({ action: 'Project Archived', user_id: actorId, project_id: id, details: `Project ${updated.name} was archived.`, event: { eventType: 'PROJECT_ARCHIVED', entityType: 'PROJECT', entityId: id } });
    return mapProject(await projectRepository.findById(id));
  },

  async restoreProject(id: string, actorId?: string) {
    const updated = await projectRepository.update(id, { archived: false, archived_at: null });
    if (!updated) throw notFound('Project not found');
    if (actorId) await activityLogRepository.create({ action: 'Project Restored', user_id: actorId, project_id: id, details: `Project ${updated.name} was restored.`, event: { eventType: 'PROJECT_RESTORED', entityType: 'PROJECT', entityId: id } });
    return mapProject(await projectRepository.findById(id));
  },

  async deleteProject(id: string, actorId?: string) {
    const existing = await projectRepository.findById(id);
    if (!existing) throw notFound('Project not found');
    // Preserve project history and all child records. Destructive cleanup is
    // intentionally outside the v1 lifecycle.
    await projectRepository.remove(id);
    if (actorId) await activityLogRepository.create({ action: 'Project Archived', user_id: actorId, project_id: id, details: `Project ${existing.name} was archived through the delete action.`, event: { eventType: 'PROJECT_ARCHIVED', entityType: 'PROJECT', entityId: id, payload: { requestedAction: 'delete' } } });
    return { message: 'Project archived successfully' };
  },

  async getProjectDailyReports(projectId: string) {
    const rows = await dailyReportRepository.findByProject(projectId);
    return rows.map(mapDailyReport);
  },

  async saveDailyReport(input: {
    projectId: string;
    reportDate: string;
    memberId: string;
    description: string;
    files: Express.Multer.File[];
    actorId: string;
    actorRole: string;
  }) {
    // A member may only submit their own daily report - never one on behalf
    // of another assigned member. Only a Super Admin may write on someone
    // else's behalf (e.g. correcting a missed entry).
    if (!isSuperAdmin(input.actorRole) && input.actorId !== input.memberId) {
      throw forbidden('You can only submit your own daily report');
    }

    const project = await projectRepository.findById(input.projectId);
    if (!project) throw notFound('Project not found');
    if (project.status === 'Completed' || project.is_locked) {
      throw badRequest('Project is completed and read-only');
    }

    const member = await userRepository.findById(input.memberId);
    if (!member) throw notFound('Team member not found');

    const memberAssigned = await projectRepository.isMemberAssigned(input.projectId, input.memberId);
    if (!memberAssigned) throw badRequest('Team member is not assigned to this project');

    const workDate = input.reportDate.slice(0, 10);

    const uploaded = input.files.length
      ? await uploadFiles(`daily-reports/${input.projectId}`, input.files)
      : [];

    const report = await dailyReportRepository.upsert({
      project_id: input.projectId,
      member_id: input.memberId,
      team_member_name: member.name,
      role: member.role,
      report_date: workDate,
      work_date: workDate,
      description: input.description,
      document_url: uploaded[0]?.url,
      created_by: input.actorId || input.memberId,
    });

    if (uploaded.length > 0) {
      await dailyReportRepository.addDocuments(
        report.id,
        uploaded.map((file) => ({ name: file.name, storage_path: file.storagePath }))
      );
    }

    await activityLogRepository.create({
      action: 'Daily Report Saved',
      user_id: input.actorId || input.memberId,
      project_id: input.projectId,
      details: `Daily report saved for ${workDate}`,
    });

    const full = await dailyReportRepository.findById(report.id);
    return mapDailyReport(full);
  },

  async addUpdate(input: {
    projectId: string;
    title: string;
    description: string;
    progress?: number;
    status?: string;
    comments?: string;
    links?: unknown;
    files: Express.Multer.File[];
    actorId?: string;
  }) {
    const project = await projectRepository.findById(input.projectId);
    if (!project) throw notFound('Project not found');
    if (project.is_locked) throw badRequest('Project is locked and cannot be updated');

    const actorId = input.actorId || (await getSystemUserId());
    // Progress and lifecycle status are execution facts. Recalculate them
    // from the task board instead of trusting a manually entered percentage
    // or letting a comment silently move the project.
    const execution = await projectProgressService.sync(input.projectId);

    const update = await updateRepository.create({
      project_id: input.projectId,
      title: input.title,
      description: input.description,
      progress: execution.progress,
      status: execution.status,
      comments: input.comments,
      created_by: actorId,
    });

    const links = toArray(input.links) as { url: string; label?: string }[];
    await updateRepository.addLinks(update.id, links);

    if (input.files.length > 0) {
      const uploaded = await uploadFiles(`updates/${update.id}`, input.files);
      await updateRepository.addDocuments(
        update.id,
        uploaded.map((file) => ({ name: file.name, storage_path: file.storagePath }))
      );
    }

    await activityLogRepository.create({
      action: 'Project Work Log Updated',
      user_id: actorId,
      project_id: input.projectId,
      details: `${input.title}: ${input.description}`,
      event: { eventType: 'PROJECT_WORK_LOG_UPDATED', entityType: 'PROJECT', entityId: input.projectId, payload: { updateId: update.id, progress: execution.progress, status: execution.status } },
    });

    const rows = await updateRepository.findByProject(input.projectId);
    return mapUpdate(rows[0]);
  },

  async getProjectUpdates(projectId: string) {
    const rows = await updateRepository.findByProject(projectId);
    return rows.map(mapUpdate);
  },

  async finishProject(
    id: string,
    input: { github?: string; googleDrive?: string; liveWebsite?: string; demoVideo?: string; finalNotes?: string; actorId?: string }
  ) {
    const project = await projectRepository.findById(id);
    if (!project) throw notFound('Project not found');
    const validation = await this.validateCompletion(id);
    if (!validation.valid) throw badRequest(`Project cannot be completed: ${(validation.errors || []).join(' ')}`);

    const updated = await projectRepository.finish(id, {
      final_github: input.github,
      final_google_drive: input.googleDrive,
      final_live_website: input.liveWebsite,
      final_demo_video: input.demoVideo,
      final_notes: input.finalNotes,
    });

    await activityLogRepository.create({
      action: 'Project Completed',
      user_id: input.actorId || (await getSystemUserId()),
      project_id: id,
      details: `Project ${updated.name} was marked as completed.`,
    });

    const full = await projectRepository.findById(id);
    return mapProject(full);
  },

  async addMember(projectId: string, userId: string, actorId?: string) {
    const project = await projectRepository.findById(projectId);
    if (!project) throw notFound('Project not found');

    const member = await userRepository.findById(userId);
    if (!member || member.status !== 'Active' || member.deleted_at) throw badRequest('Team member is not available');

    const alreadyAssigned = await projectRepository.isMemberAssigned(projectId, userId);
    if (alreadyAssigned) throw badRequest('Team member is already assigned to this project');

    await projectRepository.addMembers(projectId, [userId]);

    await notificationService.notify(userId, 'project_assigned', 'Project Assigned', `You were assigned to "${project.name}".`, {
      link: `/projects/${projectId}`,
      relatedType: 'project',
      relatedId: projectId,
    });

    await activityLogRepository.create({
      action: 'Project Member Added',
      user_id: actorId || (await getSystemUserId()),
      project_id: projectId,
      details: `${member.name} was assigned to the project.`,
    });

    const full = await projectRepository.findById(projectId);
    return mapProject(full);
  },

  async removeMember(projectId: string, userId: string, actorId?: string) {
    const project = await projectRepository.findById(projectId);
    if (!project) throw notFound('Project not found');

    await projectRepository.removeMember(projectId, userId);

    await activityLogRepository.create({
      action: 'Project Member Removed',
      user_id: actorId || (await getSystemUserId()),
      project_id: projectId,
      details: 'A team member was removed from the project.',
    });

    const full = await projectRepository.findById(projectId);
    return mapProject(full);
  },

  async validateCompletion(id: string) {
    const project = await projectRepository.findById(id);
    if (!project) throw notFound('Project not found');

    const errors: string[] = [];
    if (!project.name) errors.push('Project name is missing.');
    if (!project.description) errors.push('Project description is missing.');
    if (!project.project_members || project.project_members.length === 0) {
      errors.push('At least one team member must be assigned.');
    }
    const [tasks, milestones, blockers] = await Promise.all([
      projectTaskRepository.findForProject(id), hierarchyRepository.listMilestones(id), blockerRepository.findOpenForProjects([id]),
    ]);
    if (tasks.some((task: any) => !['Completed', 'Cancelled'].includes(task.status))) errors.push('Every open task must be completed, cancelled, or transferred.');
    if (blockers.length) errors.push('Open blockers must be resolved or transferred.');
    if (milestones.some((milestone: any) => milestone.status !== 'COMPLETED' && milestone.status !== 'CANCELLED')) errors.push('Every milestone must be completed or cancelled.');
    if (milestones.some((milestone: any) => (milestone.deliverables || []).some((deliverable: any) => !['COMPLETED', 'CANCELLED'].includes(deliverable.status)))) errors.push('Every deliverable must be completed or cancelled.');
    if (
      project.start_date &&
      project.estimated_completion_date &&
      new Date(project.start_date) > new Date(project.estimated_completion_date)
    ) {
      errors.push('Start date cannot be later than expected completion date.');
    }

    if (errors.length > 0) return { valid: false, errors };
    return { valid: true };
  },
};
