import { activityLogRepository } from '../repositories/activityLogRepository';
import { projectRepository } from '../repositories/projectRepository';
import { projectTaskRepository } from '../repositories/projectTaskRepository';
import { workdayRepository } from '../repositories/workdayRepository';
import { badRequest, forbidden, notFound } from '../utils/httpError';
import { isSuperAdmin } from '../utils/roles';
import { projectTaskService } from './projectTaskService';
import { WorkdayItemStatus } from '../types/models';

interface Actor {
  id: string;
  role: string;
}

const dubaiDate = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
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
      task: item.task ? { _id: item.task.id, title: item.task.title, status: item.task.status } : null,
      title: item.title,
      plannedOutcome: item.planned_outcome,
      status: item.status,
      progressNote: item.progress_note,
      blockerReason: item.blocker_reason,
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
  return status;
};

export const workdayService = {
  async getToday(actor: Actor) {
    return mapWorkday(await workdayRepository.findForUserAndDate(actor.id, dubaiDate()));
  },

  async getCarryover(actor: Actor) {
    const previous = mapWorkday(await workdayRepository.findLatestBeforeDate(actor.id, dubaiDate()));
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
    items: Array<{ projectId: string; taskId?: string; title: string; plannedOutcome: string; remarks?: string }>;
  }, actor: Actor) {
    const existing = await workdayRepository.findForUserAndDate(actor.id, dubaiDate());
    if (existing) return mapWorkday(existing);
    if (input.items.length < 1 || input.items.length > 20) throw badRequest('Choose between one and twenty tasks for today');

    for (const item of input.items) {
      const project = await projectRepository.findById(item.projectId);
      if (!project || project.archived || project.status === 'Completed') throw badRequest('Choose an active project for every outcome');
      if (!isSuperAdmin(actor.role) && !(await projectRepository.isMemberAssigned(item.projectId, actor.id))) {
        throw forbidden('You can only plan work for projects assigned to you');
      }
      if (item.taskId) {
        const task = await projectTaskRepository.findById(item.taskId);
        if (!task || task.project_id !== item.projectId) throw badRequest('The selected task does not belong to this project');
        if (!isSuperAdmin(actor.role) && task.assigned_to !== actor.id) throw forbidden('You can only select tasks assigned to you');
      }
    }

    const workday = await workdayRepository.create({
      user_id: actor.id,
      work_date: dubaiDate(),
      focus: input.focus.trim(),
      remarks: input.remarks?.trim() || null,
    });
    await workdayRepository.addItems(workday.id, input.items.map((item) => ({
      project_id: item.projectId,
      task_id: item.taskId || null,
      title: item.title.trim(),
      planned_outcome: item.plannedOutcome.trim(),
      progress_note: item.remarks?.trim() || null,
    })));
    await activityLogRepository.create({
      action: 'Workday Started', user_id: actor.id, project_id: input.items[0]?.projectId,
      details: `Committed to ${input.items.length} outcome${input.items.length === 1 ? '' : 's'} for today.`,
    });
    return mapWorkday(await workdayRepository.findById(workday.id));
  },

  async updateItem(itemId: string, input: {
    status?: WorkdayItemStatus;
    progressNote?: string;
    blockerReason?: string;
  }, actor: Actor) {
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
    }
    return mapWorkday(await workdayRepository.findById(item.workday_id));
  },

  async finish(input: {
    completedSummary: string;
    blockers?: string;
    remarks?: string;
    items: Array<{ id: string; status: WorkdayItemStatus; progressNote?: string; blockerReason?: string }>;
  }, actor: Actor) {
    const workday = await workdayRepository.findForUserAndDate(actor.id, dubaiDate());
    if (!workday) throw notFound('Start your workday before closing it');
    if (workday.status === 'Completed') return mapWorkday(workday);

    const ownedIds = new Set((workday.items || []).map((item: any) => item.id));
    if (input.items.some((item) => !ownedIds.has(item.id))) throw forbidden('A submitted item does not belong to your workday');
    for (const item of input.items) {
      await this.updateItem(item.id, {
        status: item.status,
        progressNote: item.progressNote,
        blockerReason: item.blockerReason,
      }, actor);
    }

    await workdayRepository.finish(workday.id, {
      completed_summary: input.completedSummary.trim(),
      blockers: input.blockers?.trim(),
      remarks: input.remarks?.trim(),
    });
    await activityLogRepository.create({
      action: 'Workday Closed', user_id: actor.id,
      details: 'Daily outcomes, blockers and remarks were recorded.',
    });
    return mapWorkday(await workdayRepository.findById(workday.id));
  },

  async getTeam(date: string, actor: Actor) {
    if (!['Super Admin', 'Project Manager'].includes(actor.role)) throw forbidden('Only managers can view the team pulse');
    const { users, workdays } = await workdayRepository.findTeamForDate(date || dubaiDate());
    const workdayByUser = new Map(workdays.map((workday: any) => [workday.user_id, workday]));
    return users.map((user: any) => ({
      user: { _id: user.id, name: user.name, email: user.email, role: user.role, department: user.department, photo: user.photo },
      availability: user.availability,
      state: !workdayByUser.has(user.id) ? 'Not started' : workdayByUser.get(user.id)?.status === 'Completed' ? 'Closed' : 'Working',
      workday: mapWorkday(workdayByUser.get(user.id)),
    }));
  },
};
