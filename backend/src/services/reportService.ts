import { blockerRepository } from '../repositories/blockerRepository';
import { projectRepository } from '../repositories/projectRepository';
import { projectTaskRepository } from '../repositories/projectTaskRepository';
import { workdayRepository } from '../repositories/workdayRepository';
import { workDateForTimezone } from '../utils/workDate';
import { canViewAllProjects, isManager } from '../utils/roles';
interface Actor { id: string; role: string; organizationId?: string; departmentId?: string | null; timezone?: string }
export const reportService = {
  async overview(actor: Actor) {
    const projects: any[] = canViewAllProjects(actor.role) ? await projectRepository.findAll() : await projectRepository.findForUser(actor.id);
    const taskGroups = await Promise.all(projects.map(async (project) => ({ project, tasks: await projectTaskRepository.findForProject(project.id) })));
    const tasks = taskGroups.flatMap((group) => group.tasks.map((task: any) => ({ ...task, projectName: group.project.name })));
    const active = projects.filter((project) => !['Completed', 'COMPLETED', 'Archived', 'ARCHIVED', 'Cancelled', 'CANCELLED'].includes(project.status));
    const projectIds = projects.map((project) => project.id);
    const blockers = projectIds.length ? await blockerRepository.findOpenForProjects(projectIds) : [];
    const done = tasks.filter((task: any) => ['Completed', 'DONE'].includes(task.status) || task.canonical_status === 'DONE');
    const overdue = tasks.filter((task: any) => task.due_date && !['Completed', 'DONE', 'CANCELLED'].includes(task.status) && new Date(`${task.due_date}T23:59:59Z`) < new Date());
    const personal = !isManager(actor.role) && !canViewAllProjects(actor.role);
    let dailyPlanCompletion: { planned: number; closed: number } | undefined;
    if (!personal && actor.organizationId) {
      const { users, workdays } = await workdayRepository.findTeamForDate(workDateForTimezone(actor.timezone || 'Asia/Dubai'), actor.organizationId);
      dailyPlanCompletion = { planned: workdays.length, closed: workdays.filter((workday: any) => workday.status === 'Completed').length };
      if (!canViewAllProjects(actor.role)) dailyPlanCompletion.planned = Math.min(dailyPlanCompletion.planned, users.filter((user: any) => !actor.departmentId || user.department_id === actor.departmentId).length);
    }
    return {
      scope: personal ? 'PERSONAL' : canViewAllProjects(actor.role) ? 'ORGANIZATION' : 'MANAGED',
      generatedAt: new Date().toISOString(),
      metrics: {
        activeProjects: active.length, onTrackProjects: active.filter((project) => (project.health || project.recommended_health) === 'ON_TRACK').length,
        atRiskProjects: active.filter((project) => ['AT_RISK', 'OFF_TRACK'].includes(project.health || project.recommended_health)).length,
        completedTasks: personal ? done.filter((task: any) => task.assigned_to === actor.id).length : done.length,
        overdueTasks: personal ? overdue.filter((task: any) => task.assigned_to === actor.id).length : overdue.length,
        activeBlockers: personal ? blockers.filter((blocker: any) => blocker.reported_by === actor.id).length : blockers.length,
        dailyPlanCompletion,
      },
      sources: {
        projects: active.map((project) => ({ id: project.id, name: project.name, href: `/projects/${project.id}` })),
        overdueTasks: overdue.slice(0, 25).map((task: any) => ({ id: task.id, title: task.title, project: task.projectName, href: `/projects/${task.project_id}?task=${task.id}` })),
        blockers: blockers.slice(0, 25).map((blocker: any) => ({ id: blocker.id, summary: blocker.summary, projectId: blocker.project_id, href: `/projects/${blocker.project_id}?task=${blocker.task_id}` })),
      },
    };
  },
};
