import { blockerRepository } from '../repositories/blockerRepository';
import { notificationRepository } from '../repositories/notificationRepository';
import { projectRepository } from '../repositories/projectRepository';
import { projectTaskRepository } from '../repositories/projectTaskRepository';
import { userRepository } from '../repositories/userRepository';
import { badRequest } from '../utils/httpError';
import { isManager, isSuperAdmin, toPlatformRole } from '../utils/roles';
import { workDateForTimezone } from '../utils/workDate';
import { workdayService } from './workdayService';

interface Actor {
  id: string;
  role: string;
  organizationId?: string;
  departmentId?: string | null;
  timezone?: string;
}

const taskStatus = (task: any) => task.canonical_status || ({
  Pending: 'BACKLOG',
  'In Progress': 'IN_PROGRESS',
  'In Review': 'IN_REVIEW',
  Completed: 'DONE',
  Blocked: 'IN_PROGRESS',
} as Record<string, string>)[task.status] || 'BACKLOG';

const mapTask = (task: any) => ({
  _id: task.id,
  projectId: task.project_id,
  project: task.project ? { _id: task.project.id, name: task.project.name } : null,
  title: task.title,
  status: taskStatus(task),
  legacyStatus: task.status,
  priority: task.priority,
  blocked: Boolean(task.blocked || task.status === 'Blocked'),
  estimateMinutes: task.estimate_minutes,
  remainingEstimateMinutes: task.remaining_estimate_minutes,
  dueDate: task.due_date,
});

const mapBlocker = (blocker: any) => ({
  _id: blocker.id,
  task: blocker.task ? { _id: blocker.task.id, title: blocker.task.title } : null,
  project: blocker.project ? { _id: blocker.project.id, name: blocker.project.name } : null,
  summary: blocker.summary,
  details: blocker.details,
  waitingOnType: blocker.waiting_on_type,
  severity: blocker.severity,
  status: blocker.status,
  suggestedNextAction: blocker.suggested_next_action,
  createdAt: blocker.created_at,
});

export const todayService = {
  async get(actor: Actor) {
    if (!actor.organizationId) throw badRequest('Your account is not assigned to an organization');
    const user = await userRepository.findById(actor.id);
    if (!user) throw badRequest('User account not found');
    const workDate = workDateForTimezone(actor.timezone || user.timezone || 'Asia/Dubai');
    const [dailyPlan, carryovers, assignedRows, notifications, projects] = await Promise.all([
      workdayService.getToday(actor),
      workdayService.getCarryover(actor),
      projectTaskRepository.findAssignedToUser(actor.id),
      notificationRepository.findForUser(actor.id, 10),
      isSuperAdmin(actor.role) ? projectRepository.findAll() : projectRepository.findForUser(actor.id),
    ]);

    const assigned = assignedRows.map(mapTask);
    const open = assigned.filter((task) => task.status !== 'DONE' && task.status !== 'CANCELLED');
    const suggestions = open
      .map((task) => ({
        ...task,
        recommendationReason: task.dueDate && task.dueDate < workDate
          ? 'Overdue and still assigned to you.'
          : task.dueDate === workDate
            ? 'Due today.'
            : ['Critical', 'High'].includes(task.priority)
              ? `${task.priority} priority work in an assigned project.`
              : 'Assigned work available for planning.',
      }))
      .sort((a, b) => {
        const rank = (task: typeof a) => task.dueDate && task.dueDate < workDate ? 0 : task.dueDate === workDate ? 1 : task.priority === 'Critical' ? 2 : task.priority === 'High' ? 3 : 4;
        return rank(a) - rank(b);
      });
    const upcoming = open.filter((task) => task.dueDate && task.dueDate > workDate).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')).slice(0, 5);
    const blockers = (await blockerRepository.findOpenReportedBy(actor.id)).map(mapBlocker);

    let roleSummary: Record<string, unknown> = {
      kind: 'TEAM_MEMBER',
      planned: dailyPlan?.items.length || 0,
      completed: dailyPlan?.items.filter((item: any) => item.status === 'Completed').length || 0,
      remaining: dailyPlan?.items.filter((item: any) => item.status !== 'Completed').length || 0,
      activeTask: dailyPlan?.items.find((item: any) => item.status === 'In Progress') || null,
    };

    if (isManager(actor.role) || isSuperAdmin(actor.role)) {
      const teamPulse = await workdayService.getTeam(workDate, actor);
      const projectIds = projects.map((project: any) => project.id);
      const scopedBlockers = await blockerRepository.findOpenForProjects(projectIds);
      roleSummary = {
        kind: isSuperAdmin(actor.role) ? 'CEO' : 'MANAGER',
        teamPulse: {
          planned: teamPulse.filter((entry: any) => entry.state !== 'Not started').length,
          notPlanned: teamPulse.filter((entry: any) => entry.state === 'Not started').length,
          blocked: teamPulse.filter((entry: any) => entry.workday?.items.some((item: any) => item.status === 'Blocked')).length,
          closed: teamPulse.filter((entry: any) => entry.state === 'Closed').length,
        },
        activeProjects: projects.filter((project: any) => !['Completed', 'Cancelled'].includes(project.status)).length,
        atRiskProjects: projects.filter((project: any) => project.health === 'AT_RISK' || project.health === 'OFF_TRACK').length,
        criticalBlockers: scopedBlockers.filter((blocker: any) => blocker.severity === 'CRITICAL').length,
        blockers: scopedBlockers.slice(0, 8).map(mapBlocker),
      };
    }

    return {
      workDate,
      user: {
        _id: user.id,
        name: user.name,
        role: user.role,
        platformRole: user.platform_role || toPlatformRole(user.role),
        designation: user.designation,
        timezone: user.timezone,
        dailyCapacityMinutes: user.daily_capacity_minutes,
      },
      dailyPlan,
      carryovers,
      suggestedTasks: suggestions,
      todayTasks: dailyPlan?.items || [],
      blockers,
      upcomingTasks: upcoming,
      notifications: notifications.map((notification) => ({
        _id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        link: notification.link,
        read: notification.read,
        createdAt: notification.created_at,
      })),
      roleSummary,
    };
  },
};
