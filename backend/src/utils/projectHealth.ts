export type ProjectHealth = 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'NOT_SET';

export interface ProjectHealthSignals {
  overdueMilestones: number;
  overdueActiveTasks: number;
  activeTasks: number;
  criticalBlockers: number;
  oldestBlockerAgeDays: number;
  repeatedCarryovers: number;
  staleDays: number;
}

export const recommendProjectHealth = (signals: ProjectHealthSignals): ProjectHealth => {
  const overdueRatio = signals.activeTasks ? signals.overdueActiveTasks / signals.activeTasks : 0;
  if (signals.criticalBlockers > 0 || signals.overdueMilestones > 0 && overdueRatio >= 0.25 || overdueRatio >= 0.5) return 'OFF_TRACK';
  if (signals.overdueMilestones > 0 || signals.overdueActiveTasks > 0 || signals.oldestBlockerAgeDays >= 3 || signals.repeatedCarryovers > 0 || signals.staleDays >= 5) return 'AT_RISK';
  return 'ON_TRACK';
};
