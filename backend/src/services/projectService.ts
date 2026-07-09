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
import { isSuperAdmin } from '../utils/roles';

interface Actor {
  id: string;
  role: string;
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
  files: Express.Multer.File[];
}

export const projectService = {
  // Every authenticated user can view every project (the portal is
  // transparent by design), but only a Super Admin or an assigned member may
  // change it. This is the single gate every project-mutating endpoint below
  // routes through - never rely on the frontend hiding a button.
  async assertProjectEditAccess(projectId: string, actor: Actor) {
    if (isSuperAdmin(actor.role)) return;
    const assigned = await projectRepository.isMemberAssigned(projectId, actor.id);
    if (!assigned) throw forbidden('Only assigned members can edit this project');
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

    const full = await projectRepository.findById(project.id);
    return mapProject(full);
  },

  async getProjects(includeArchived = false) {
    const rows = await projectRepository.findAll(includeArchived);
    return rows.map(mapProject);
  },

  async getProjectById(id: string) {
    const row = await projectRepository.findById(id);
    if (!row) throw notFound('Project not found');
    return mapProject(row);
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
    }>
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
    });
    if (!updated) throw notFound('Project not found');

    const full = await projectRepository.findById(id);
    return mapProject(full);
  },

  async archiveProject(id: string) {
    const updated = await projectRepository.update(id, { archived: true });
    if (!updated) throw notFound('Project not found');
    return mapProject(await projectRepository.findById(id));
  },

  async restoreProject(id: string) {
    const updated = await projectRepository.update(id, { archived: false });
    if (!updated) throw notFound('Project not found');
    return mapProject(await projectRepository.findById(id));
  },

  async deleteProject(id: string) {
    const existing = await projectRepository.findById(id);
    if (!existing) throw notFound('Project not found');
    // Every child table (project_members, updates, daily_reports, project
    // tasks, documents, links) already has `on delete cascade` back to
    // projects(id) - see 0001_init.sql / 0002 migration - so this is safe.
    await projectRepository.remove(id);
    return { message: 'Project deleted successfully' };
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
    actorId?: string;
  }) {
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
    progress: number;
    status: string;
    comments?: string;
    links?: unknown;
    files: Express.Multer.File[];
    actorId?: string;
  }) {
    const project = await projectRepository.findById(input.projectId);
    if (!project) throw notFound('Project not found');
    if (project.is_locked) throw badRequest('Project is locked and cannot be updated');

    const actorId = input.actorId || (await getSystemUserId());

    const update = await updateRepository.create({
      project_id: input.projectId,
      title: input.title,
      description: input.description,
      progress: input.progress,
      status: input.status,
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

    await projectRepository.updateProgressAndStatus(input.projectId, input.progress, input.status);

    await activityLogRepository.create({
      action: 'Project Updated',
      user_id: actorId,
      project_id: input.projectId,
      details: `Project updated: ${input.title}`,
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
    input: { github?: string; googleDrive?: string; liveWebsite?: string; finalNotes?: string; actorId?: string }
  ) {
    const project = await projectRepository.findById(id);
    if (!project) throw notFound('Project not found');

    const updated = await projectRepository.finish(id, {
      final_github: input.github,
      final_google_drive: input.googleDrive,
      final_live_website: input.liveWebsite,
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
