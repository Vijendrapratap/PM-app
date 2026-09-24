import type { ProjectStage } from '../policies/workGatePolicy';

const LEGACY_TO_STAGE: Record<string, ProjectStage> = {
  Draft: 'DRAFT', Saved: 'DRAFT', Planning: 'PLANNING', 'In Progress': 'ACTIVE', Review: 'ACTIVE', Testing: 'ACTIVE',
  'On Hold': 'ON_HOLD', Cancelled: 'CANCELLED',
};
// Legacy `status` is still shown by the current UI; the lifecycle writes both.
export const STAGE_TO_LEGACY: Partial<Record<ProjectStage, string>> = {
  DRAFT: 'Draft', PLANNING: 'Planning', ACTIVE: 'In Progress', ON_HOLD: 'On Hold', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
};

export const stageForLegacyStatus = (status: string): ProjectStage | null => LEGACY_TO_STAGE[status] ?? null;
