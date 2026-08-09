import type { Project } from '../types';

export type ProjectProgressTone = 'complete' | 'almost' | 'mid' | 'early' | 'not-started';

export const projectProgressTone = (project: Pick<Project, 'progress' | 'status'>): ProjectProgressTone => {
  if (project.status === 'Completed' || project.progress >= 100) return 'complete';
  if (project.progress >= 80) return 'almost';
  if (project.progress >= 50) return 'mid';
  if (project.progress > 0) return 'early';
  return 'not-started';
};

export const projectProgressLabel = (project: Pick<Project, 'progress' | 'status'>) => ({
  complete: 'Completed',
  almost: 'Nearly complete',
  mid: 'In progress',
  early: 'Getting started',
  'not-started': 'Not started',
}[projectProgressTone(project)]);
