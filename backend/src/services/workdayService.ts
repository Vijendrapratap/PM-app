import { activityLogRepository } from '../repositories/activityLogRepository';
import { projectRepository } from '../repositories/projectRepository';
import { projectTaskRepository } from '../repositories/projectTaskRepository';
import { workdayRepository } from '../repositories/workdayRepository';
import { badRequest, forbidden, notFound } from '../utils/httpError';
import { isManager, isSuperAdmin } from '../utils/roles';
import { projectTaskService } from './projectTaskService';
import { WorkdayItemStatus } from '../types/models';
import { workDateForTimezone } from '../utils/workDate';
import { workSessionService } from './workSessionService';
import { requiresCarryoverReason } from '../utils/dailyPlanRules';
import { blockerRepository } from '../repositories/blockerRepository';
import { blockerService } from './blockerService';
import { userRepository } from '../repositories/userRepository';
import { notificationService } from './notificationService';
import { logger } from '../config/logger';
import { projectProgressService } from './projectProgressService';
import { dailyReportRepository } from '../repositories/dailyReportRepository';

interface Actor {
  id: string;
  role: string;
  timezone?: string;
  organizationId?: string;
  departmentId?: string | null;
}

const actorWorkDate = (actor: Actor) => workDateForTimezone(actor.timezone || 'Asia/Dubai');

const formatTrackedTime = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder}m`;
  return `${hours}h ${remainder}m`;
};

const dailyLeadIds = async (actor: Actor, projectIds: string[]) => {
  const ids = new Set<string>();
  const [member, ceos, projects] = await Promise.all([
    userRepository.findById(actor.id),
    userRepository.findActiveByPlatformRoles(['CEO'], actor.organizationId),
    Promise.all([...new Set(projectIds)].map((projectId) => projectRepository.findById(projectId))),
  ]);
  if (member?.manager_user_id) ids.add(member.manager_user_id);
  ceos.forEach((ceo) => ids.add(ceo.id));
  projects.forEach((project) => {
    if (!project) return;
    if (project.owner_id) ids.add(project.owner_id);
    (project.project_members || []).forEach((membership: any) => {
      if (membership.user?.platform_role === 'MANAGER') ids.add(membership.user.id);
    });
  });
  ids.delete(actor.id);
  return { ids: [...ids], member };
};

const notifyDailyLeads = async (actor: Actor, projectIds: string[], notification: {
  type: string;
  title: string;
  message: string;
  link: string;
  relatedType?: string;
  relatedId?: string;
}) => {
  try {
    const { ids } = await dailyLeadIds(actor, projectIds);
    await Promise.all(ids.map((userId) => notificationService.notify(userId, notification.type, notification.title, notification.message, {
      link: notification.link,
      relatedType: notification.relatedType,
      relatedId: notification.relatedId,
    })));
  } catch (error) {
    logger.error('Failed to route daily-work notification', { actorId: actor.id, error: error instanceof Error ? error.message : error });
  }
};

const mapWorkday = (row: any) => row ? ({
  _id: row.id,
  userId: row.user_id,
  user: row.user ? {
    _id: row.user.id,
    name: row.user.name,
    email: row.user.email,
    role: row.user.role,
    department: row.user.department,
    photo: row.user.photo,
  } : null,
  workDate: row.work_date,
  status: row.status,
  planStatus: row.plan_status || (row.status === 'Completed' ? 'CLOSED' : 'ACTIVE'),
  focus: row.focus,
  checkInAt: row.check_in_at,
  checkOutAt: row.check_out_at,
  completedSummary: row.completed_summary,
  blockers: row.blockers,
  remarks: row.remarks,
  items: (row.items || [])
    .map((item: any) => ({
      _id: item.id,
      projectId: item.project_id,
      project: item.project ? { _id: item.project.id, name: item.project.name, status: item.project.status, progress: item.project.progress } : null,
      taskId: item.task_id,
      task: item.task ? { _id: item.task.id, title: item.task.title, status: item.task.status, priority: item.task.priority } : null,
      title: item.title,
      plannedOutcome: item.planned_outcome,
      status: item.status,
      progressNote: item.progress_note,
      blockerReason: item.blocker_reason,
      source: item.source || 'ASSIGNED',
      plannedEstimateMinutes: item.planned_estimate_minutes,
      orderIndex: item.order_index || 0,
      endState: item.end_state,
      carryoverReason: item.carryover_reason,
      carryoverCount: item.carryover_count || 0,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }))
    .sort((a: any, b: any) => a.createdAt.localeCompare(b.createdAt)),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
}) : null;

const taskStatusFor = (status: WorkdayItemStatus) => {
  // Planning/deferment is workday context, not a reason to regress a task
  // that may already be in progress or review in the project board.
  if (status === 'Planned' || status === 'Deferred') return undefined;
  return status === 'Blocked' ? 'In Progress' : status;
};

export const workdayService = {
  async getToday(actor: Actor) {
    const workday = await workdayRepository.findForUserAndDate(actor.id, actorWorkDate(actor));
    // Older seed data could create the plan header without any executable
    // items. Treat that incomplete shell as "not planned" so the member can
    // run Plan My Day and repair it through the normal workflow.
    if (workday?.status === 'Open' && !(workday.items || []).length) return null;
    return mapWorkday(workday);
  },

  async getById(id: string, actor: Actor) {
    const workday = await workdayRepository.findById(id);
    if (!workday) throw notFound('Daily plan not found');
    if (workday.user_id !== actor.id && !isSuperAdmin(actor.role)) throw forbidden('You can only view your own daily plan');
    return mapWorkday(workday);
  },

  async getCarryover(actor: Actor) {
    const previous = mapWorkday(await workdayRepository.findLatestBeforeDate(actor.id, actorWorkDate(actor)));
    if (!previous) return [];
    return previous.items.filter((item: any) =>
      Boolean(item.project) &&
      item.status !== 'Completed' &&
      item.task?.status !== 'Completed' &&
      item.project?.status !== 'Completed'
    );
  },

  async start(input: {
    focus: string;
    remarks?: string;
    items: Array<{ projectId: string; taskId?: string; title: string; plannedOutcome: string; remarks?: string; source?: 'CARRYOVER' | 'ASSIGNED' | 'ADDED_TODAY'; plannedEstimateMinutes?: number; carriedFromItemId?: string; carryoverReason?: string; priority?: 'Low' | 'Medium' | 'High' | 'Critical' }>;
  }, actor: Actor) {
    const existing = await workdayRepository.findForUserAndDate(actor.id, actorWorkDate(actor));
    if (existing && (existing.items || []).length) return mapWorkday(existing);
    if (input.items.length < 1 || input.items.length > 20) throw badRequest('Choose between one and twenty tasks for today');
    if (!actor.organizationId) throw badRequest('Your account is not assigned to an organization');

    const projectById = new Map<string, any>();
    for (const item of input.items) {
      const project = await projectRepository.findById(item.projectId);
      if (!project || project.archived || project.status === 'Completed') throw badRequest('Choose an active project for every outcome');
      projectById.set(item.projectId, project);
      if (!isSuperAdmin(actor.role) && !(await projectRepository.isMemberAssigned(item.projectId, actor.id))) {
        throw forbidden('You can only plan work for projects assigned to you');
      }
      if (item.taskId) {
        const task = await projectTaskRepository.findById(item.taskId);
        if (!task || task.project_id !== item.projectId) throw badRequest('The selected task does not belong to this project');
        if (!isSuperAdmin(actor.role) && task.assigned_to !== actor.id) throw forbidden('You can only select tasks assigned to you');
      }
    }

    // A task added inside Plan My Day must remain visible after the planning
    // drawer closes. Materialize it as an owned project task before creating
    // the daily-plan item so Tasks, Kanban and Today all reference one record.
    const resolvedItems = await Promise.all(input.items.map(async (item) => {
      if (item.taskId) return item;
      const project = projectById.get(item.projectId);
      const task = await projectTaskRepository.create({
        organization_id: actor.organizationId!,
        project_id: item.projectId,
        department_type: String(project?.department || 'OTHER').toUpperCase(),
        task_type: 'Task',
        title: item.title.trim(),
        description: item.plannedOutcome.trim(),
        assigned_to: actor.id,
        created_by: actor.id,
        reporter_user_id: actor.id,
        status: 'Pending',
        canonical_status: 'READY',
        priority: item.priority || 'Medium',
        due_date: actorWorkDate(actor),
      });
      await activityLogRepository.create({
        action: 'Task Created', user_id: actor.id, project_id: item.projectId, details: `${task.title} was added from Plan My Day.`,
        event: { eventType: 'TASK_CREATED', entityType: 'TASK', entityId: task.id, payload: { source: 'DAILY_PLAN', assignedTo: actor.id } },
      });
      await projectProgressService.sync(item.projectId);
      return { ...item, taskId: task.id };
    }));

    const preparedItems = await Promise.all(resolvedItems.map(async (item, index) => {
      const previous = item.carriedFromItemId ? await workdayRepository.findItemById(item.carriedFromItemId) : null;
      const carryoverCount = previous ? Number(previous.carryover_count || 0) + 1 : 0;
      if (item.source === 'CARRYOVER' && requiresCarryoverReason(carryoverCount) && !item.carryoverReason?.trim() && !item.remarks?.trim()) {
        throw badRequest('Add a reason for work carried over more than twice');
      }
      return {
        project_id: item.projectId,
        task_id: item.taskId || null,
        title: item.title.trim(),
        planned_outcome: item.plannedOutcome.trim(),
        progress_note: item.remarks?.trim() || null,
        source: item.source || 'ASSIGNED',
        planned_estimate_minutes: item.plannedEstimateMinutes || null,
        order_index: index,
        carried_from_item_id: item.carriedFromItemId || null,
        carryover_reason: item.carryoverReason?.trim() || null,
        carryover_count: carryoverCount,
      };
    }));

    const workday = existing
      ? await workdayRepository.activateEmptyPlan(existing.id, {
        focus: input.focus.trim(), primary_outcome: input.focus.trim(), remarks: input.remarks?.trim() || null,
      })
      : await workdayRepository.create({
        user_id: actor.id,
        work_date: actorWorkDate(actor),
        focus: input.focus.trim(),
        organization_id: actor.organizationId,
        timezone: actor.timezone || 'Asia/Dubai',
        plan_status: 'ACTIVE',
        primary_outcome: input.focus.trim(),
        remarks: input.remarks?.trim() || null,
      });
    await workdayRepository.addItems(workday.id, preparedItems);
    await workSessionService.start({ dailyPlanId: workday.id }, actor);
    await activityLogRepository.create({
      action: 'Workday Started', user_id: actor.id, project_id: resolvedItems[0]?.projectId,
      details: `Committed to ${resolvedItems.length} outcome${resolvedItems.length === 1 ? '' : 's'} for today.`,
      event: { eventType: 'DAILY_PLAN_STARTED', entityType: 'DAILY_PLAN', entityId: workday.id, payload: { taskCount: resolvedItems.length } },
    });
    return mapWorkday(await workdayRepository.findById(workday.id));
  },

  async updateItem(itemId: string, input: {
    status?: WorkdayItemStatus;
    progressNote?: string;
    blockerReason?: string;
  }, actor: Actor, options: { notify?: boolean } = {}) {
    const item = await workdayRepository.findItemById(itemId);
    if (!item) throw notFound('Work item not found');
    const workday = await workdayRepository.findById(item.workday_id);
    if (!workday) throw notFound('Workday not found');
    if (workday.user_id !== actor.id && !isSuperAdmin(actor.role)) throw forbidden('You can only update your own workday');
    if (workday.status === 'Completed') throw badRequest('This workday is already closed');
    if (input.status === 'Blocked' && !input.blockerReason?.trim() && !item.blocker_reason) {
      throw badRequest('Add a blocker reason before marking this outcome blocked');
    }

    await workdayRepository.updateItem(itemId, {
      ...(input.status !== undefined && { status: input.status }),
      ...(input.progressNote !== undefined && { progress_note: input.progressNote.trim() || null }),
      ...(input.blockerReason !== undefined && { blocker_reason: input.blockerReason.trim() || null }),
    });

    if (input.status && item.task_id && item.project_id) {
      const taskStatus = taskStatusFor(input.status);
      if (taskStatus) {
        await projectTaskService.update(item.project_id, item.task_id, {
          status: taskStatus,
          ...(input.status === 'Blocked' && { blockerReason: input.blockerReason || item.blocker_reason || '' }),
        }, actor);
      }
      if (input.status === 'Blocked' && !(await blockerRepository.findOpenForTask(item.task_id))) {
        await blockerService.report(item.task_id, {
          summary: input.blockerReason || item.blocker_reason || 'Work is blocked',
          details: input.progressNote,
          waitingOnType: 'OTHER',
          severity: 'MEDIUM',
        }, actor);
      }
      if (input.status === 'Completed') await workSessionService.closeActiveTask(item.task_id, actor);
    }
    const hasMeaningfulUpdate = input.status !== undefined || input.progressNote !== undefined || input.blockerReason !== undefined;
    if (options.notify !== false && hasMeaningfulUpdate && item.project_id) {
      const member = await userRepository.findById(actor.id).catch(() => null);
      const state = input.status || item.status;
      const note = input.progressNote?.trim();
      const blocker = input.blockerReason?.trim();
      if (input.progressNote !== undefined || input.blockerReason !== undefined) {
        const details = `${item.title}: ${String(state)}${note ? ` - ${note}` : ''}${blocker ? ` (Blocker: ${blocker})` : ''}`;
        await activityLogRepository.create({
          action: 'Daily Task Updated', user_id: actor.id, project_id: item.project_id, details,
          event: { eventType: 'DAILY_TASK_UPDATED', entityType: 'TASK', entityId: item.task_id, payload: { details, status: state, taskTitle: item.title } },
        });
      }
      await notifyDailyLeads(actor, [item.project_id], {
        type: input.status === 'Blocked' ? 'critical_blocker' : 'daily_task_update',
        title: `${member?.name || 'A team member'} updated daily work`,
        message: `“${item.title}” is ${String(state).toLowerCase()}${note ? ` — ${note}` : ''}.`,
        link: `/projects/${item.project_id}`,
      });
    }
    return mapWorkday(await workdayRepository.findById(item.workday_id));
  },

  async finish(input: {
    completedSummary: string;
    blockers?: string;
    remarks?: string;
    items: Array<{ id: string; status: WorkdayItemStatus; progressNote?: string; blockerReason?: string; endState?: 'DONE' | 'CARRY_OVER' | 'RESCHEDULED' | 'BACKLOG' | 'BLOCKED' | 'NO_LONGER_REQUIRED'; carryoverReason?: string }>;
  }, actor: Actor) {
    const workday = await workdayRepository.findForUserAndDate(actor.id, actorWorkDate(actor));
    if (!workday) throw notFound('Start your workday before closing it');
    if (workday.status === 'Completed') return mapWorkday(workday);

    const ownedIds = new Set((workday.items || []).map((item: any) => item.id));
    if (input.items.some((item) => !ownedIds.has(item.id))) throw forbidden('A submitted item does not belong to your workday');
    for (const item of input.items) {
      const existingItem = (workday.items || []).find((candidate: any) => candidate.id === item.id);
      if (requiresCarryoverReason(Number(existingItem?.carryover_count || 0), item.endState) && !item.carryoverReason?.trim()) {
        throw badRequest('Add a reason before carrying this work again or returning it to backlog');
      }
      await this.updateItem(item.id, {
        status: item.status,
        progressNote: item.progressNote,
        blockerReason: item.blockerReason,
      }, actor, { notify: false });
      await workdayRepository.updateItem(item.id, {
        end_state: item.endState || (item.status === 'Completed' ? 'DONE' : item.status === 'Blocked' ? 'BLOCKED' : item.status === 'Deferred' ? 'CARRY_OVER' : null),
        carryover_reason: item.carryoverReason?.trim() || null,
      });
    }

    const member = await userRepository.findById(actor.id).catch(() => null);
    const submittedItems = new Map(input.items.map((item) => [item.id, item]));
    const itemsByProject = new Map<string, string[]>();
    for (const item of workday.items || []) {
      if (!item.project_id) continue;
      const submitted = submittedItems.get(item.id);
      const status = submitted?.status || item.status;
      const note = submitted?.progressNote?.trim() || item.progress_note;
      const blocker = submitted?.blockerReason?.trim() || item.blocker_reason;
      const line = `${item.title}: ${status}${note ? ` - ${note}` : ''}${blocker ? ` (Blocker: ${blocker})` : ''}`;
      itemsByProject.set(item.project_id, [...(itemsByProject.get(item.project_id) || []), line]);
    }

    await Promise.all([...itemsByProject].map(([projectId, projectItems]) => dailyReportRepository.upsert({
      project_id: projectId,
      member_id: actor.id,
      team_member_name: member?.name || 'Team member',
      role: member?.role || actor.role,
      report_date: workday.work_date,
      work_date: workday.work_date,
      description: [
        input.completedSummary.trim(),
        projectItems.map((item) => `- ${item}`).join('\n'),
        input.blockers?.trim() ? `Blockers: ${input.blockers.trim()}` : '',
        input.remarks?.trim() ? `Remarks: ${input.remarks.trim()}` : '',
      ].filter(Boolean).join('\n\n'),
      created_by: actor.id,
    })));

    await workSessionService.closeActive(actor);
    const timeSummary = await workSessionService.summary(workday.id, actor);
    await workdayRepository.finish(workday.id, {
      completed_summary: input.completedSummary.trim(),
      blockers: input.blockers?.trim(),
      remarks: input.remarks?.trim(),
    });
    await activityLogRepository.create({
      action: 'Workday Closed', user_id: actor.id,
      details: 'Daily outcomes, blockers and remarks were recorded.',
      event: { eventType: 'DAILY_PLAN_CLOSED', entityType: 'DAILY_PLAN', entityId: workday.id, payload: { completedSummary: input.completedSummary.trim(), trackedMinutes: timeSummary.totalMinutes } },
    });
    const completedCount = input.items.filter((item) => item.status === 'Completed').length;
    const projectIds = (workday.items || []).map((item: any) => item.project_id).filter(Boolean);
    await notifyDailyLeads(actor, projectIds, {
      type: 'daily_plan_closed',
      title: `${member?.name || 'A team member'} closed the workday`,
      message: `${completedCount}/${input.items.length} tasks completed · ${formatTrackedTime(timeSummary.totalMinutes)} tracked${input.blockers?.trim() ? ' · blockers need attention' : ''}.`,
      link: `/workday?view=team`,
      relatedType: 'daily_plan',
      relatedId: workday.id,
    });
    return mapWorkday(await workdayRepository.findById(workday.id));
  },

  async reopen(id: string, actor: Actor) {
    const workday = await workdayRepository.findById(id);
    if (!workday) throw notFound('Daily plan not found');
    if (workday.user_id !== actor.id) throw forbidden('You can only reopen your own daily plan');
    if (workday.status !== 'Completed') return mapWorkday(workday);
    const reopened = await workdayRepository.reopen(id, Number(workday.reopened_count || 0) + 1);
    await workSessionService.start({ dailyPlanId: id, note: 'Daily plan reopened' }, actor);
    await activityLogRepository.create({
      action: 'Daily Plan Reopened', user_id: actor.id, details: 'The daily plan was reopened with audit history.',
      event: { eventType: 'DAILY_PLAN_REOPENED', entityType: 'DAILY_PLAN', entityId: id, payload: { reopenedCount: Number(workday.reopened_count || 0) + 1 } },
    });
    return mapWorkday(reopened);
  },

  async getTeam(date: string, actor: Actor) {
    if (!isSuperAdmin(actor.role) && !isManager(actor.role)) throw forbidden('Only managers can view the team pulse');
    if (!actor.organizationId) throw badRequest('Your account is not assigned to an organization');
    let { users, workdays } = await workdayRepository.findTeamForDate(date || actorWorkDate(actor), actor.organizationId);
    if (!isSuperAdmin(actor.role)) {
      const projects = await projectRepository.findForUser(actor.id);
      const scopedUserIds = new Set<string>([actor.id]);
      projects.forEach((project: any) => {
        if (project.owner_id === actor.id || (project.project_members || []).some((membership: any) => membership.user?.id === actor.id && membership.project_role === 'MANAGER')) {
          (project.project_members || []).forEach((membership: any) => membership.user?.id && scopedUserIds.add(membership.user.id));
        }
      });
      users = users.filter((user: any) => scopedUserIds.has(user.id) || (actor.departmentId && user.department_id === actor.departmentId));
      const visibleIds = new Set(users.map((user: any) => user.id));
      workdays = workdays.filter((workday: any) => visibleIds.has(workday.user_id));
    }
    const workdayByUser = new Map(workdays.map((workday: any) => [workday.user_id, workday]));
    return users.map((user: any) => ({
      user: { _id: user.id, name: user.name, email: user.email, role: user.role, department: user.department, departmentId: user.department_id, photo: user.photo },
      availability: user.availability,
      state: !workdayByUser.has(user.id) ? 'Not started' : workdayByUser.get(user.id)?.status === 'Completed' ? 'Closed' : 'Working',
      workday: mapWorkday(workdayByUser.get(user.id)),
    }));
  },
};
