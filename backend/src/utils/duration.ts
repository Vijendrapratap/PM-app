export const elapsedMinutes = (startedAt: string | Date, endedAt: string | Date) =>
  Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60_000));

export const DEFAULT_WORKDAY_MINUTES = 480;

// Worked = start → end (or now while the day is open). No break tracking.
// A day the cron auto-closed never got a real end time from the employee, so
// counting up to the cron's close time would overstate the day. For those,
// worked = start → the last work log (0 if there were no logs at all).
export const workdayHours = (
  day: {
    startAt: string;
    endAt: string | null;
    capacityMinutes?: number | null;
    lastActivityAt?: string | null;
    autoClosed?: boolean;
  },
  now = new Date()
) => {
  const workedMinutes = day.autoClosed
    ? (day.lastActivityAt ? elapsedMinutes(day.startAt, day.lastActivityAt) : 0)
    : elapsedMinutes(day.startAt, day.endAt || now);
  const expectedMinutes = day.capacityMinutes || DEFAULT_WORKDAY_MINUTES;
  return { workedMinutes, expectedMinutes, shortByMinutes: Math.max(0, expectedMinutes - workedMinutes) };
};
