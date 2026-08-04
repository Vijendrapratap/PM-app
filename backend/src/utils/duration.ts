export const elapsedMinutes = (startedAt: string | Date, endedAt: string | Date) =>
  Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60_000));
