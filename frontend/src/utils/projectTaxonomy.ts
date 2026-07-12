import type { Project } from '../types';

export const PROJECT_PORTFOLIOS = ['Internal Projects', 'Client Projects', 'Recruitment', 'Real Estate'] as const;
export type ProjectPortfolio = (typeof PROJECT_PORTFOLIOS)[number];

// Normalize legacy/free-form metadata into a small, stable business taxonomy.
// Explicit domain signals win; otherwise client delivery is separated from
// internal product, research, AI and automation work.
export const getProjectPortfolio = (project: Project): ProjectPortfolio => {
  const context = [project.name, project.category, project.department, ...(project.tags || [])].filter(Boolean).join(' ').toLowerCase();

  if (/recruit|hiring|ats|candidate|interview/.test(context)) return 'Recruitment';
  if (/real[ -]?estate|property|realtor|broker/.test(context)) return 'Real Estate';
  if (/client|customer|delivery/.test(context)) return 'Client Projects';
  return 'Internal Projects';
};
