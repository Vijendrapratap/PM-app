import { projectRepository } from '../repositories/projectRepository';
import { projectTaskRepository } from '../repositories/projectTaskRepository';

export interface ProjectExecutionSnapshot {
  progress: number;
  status: string;
  totalTasks: number;
  completedTasks: number;
  blockedTasks: number;
  reviewTasks: number;
}

export const projectProgressService = {
  async calculate(projectId: string): Promise<ProjectExecutionSnapshot> {
    const [project, rows] = await Promise.all([
      projectRepository.findById(projectId),
      projectTaskRepository.findForProject(projectId),
    ]);
    if (!project) throw new Error('Project not found');

    const tasks = rows.filter((task: any) => !['Cancelled', 'CANCELLED'].includes(task.status) && task.canonical_status !== 'CANCELLED');
    const completedTasks = tasks.filter((task: any) => task.status === 'Completed' || task.canonical_status === 'DONE').length;
    const blockedTasks = tasks.filter((task: any) => task.status === 'Blocked' || task.blocked).length;
    const reviewTasks = tasks.filter((task: any) => task.status === 'In Review' || task.canonical_status === 'IN_REVIEW').length;
    const inProgressTasks = tasks.filter((task: any) => task.status === 'In Progress' || task.canonical_status === 'IN_PROGRESS').length;
    const progress = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : Number(project.progress || 0);

    let status = project.status;
    if (project.status !== 'Completed' && !project.is_locked) {
      if (blockedTasks > 0) status = 'Blocked';
      else if (tasks.length > 0 && completedTasks === tasks.length) status = 'Review';
      else if (tasks.length > 0 && completedTasks + reviewTasks === tasks.length && reviewTasks > 0) status = 'Review';
      else if (inProgressTasks > 0 || completedTasks > 0 || reviewTasks > 0) status = 'In Progress';
      else if (tasks.length > 0) status = 'Planning';
    }

    return { progress, status, totalTasks: tasks.length, completedTasks, blockedTasks, reviewTasks };
  },

  async sync(projectId: string): Promise<ProjectExecutionSnapshot> {
    const snapshot = await this.calculate(projectId);
    await projectRepository.updateProgressAndStatus(projectId, snapshot.progress, snapshot.status);
    return snapshot;
  },
};
