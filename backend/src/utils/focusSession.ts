export const DEFAULT_FOCUS_BLOCK_MINUTES = 90;
export const MAX_FOCUS_BLOCK_MINUTES = 120;

// A forgotten timer must not turn an overnight browser session into reported
// productive time. Longer tasks can continue in another explicitly-started
// focus block, while every individual block is bounded by the task estimate.
export const focusBlockLimitMinutes = (plannedEstimateMinutes?: number | null) => {
  if (!plannedEstimateMinutes || plannedEstimateMinutes <= 0) return DEFAULT_FOCUS_BLOCK_MINUTES;
  return Math.min(plannedEstimateMinutes, MAX_FOCUS_BLOCK_MINUTES);
};

export const boundedFocusMinutes = (elapsedMinutes: number, plannedEstimateMinutes?: number | null) =>
  Math.max(0, Math.min(elapsedMinutes, focusBlockLimitMinutes(plannedEstimateMinutes)));
