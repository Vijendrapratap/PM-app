export const requiresCarryoverReason = (carryoverCount: number, endState?: string | null) =>
  carryoverCount >= 2 || endState === 'BACKLOG';

export const capacityWarning = (plannedMinutes: number, capacityMinutes?: number | null) =>
  Boolean(capacityMinutes && plannedMinutes > capacityMinutes);
