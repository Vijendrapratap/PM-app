export const elapsedMinutes = (startedAt: string | Date, endedAt: string | Date) =>
  Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60_000));

export const DEFAULT_WORKDAY_MINUTES = 480;

// Worked = start → end (or now while the day is open). No break tracking.
export const workdayHours = (day: { startAt: string; endAt: string | null; capacityMinutes?: number | null }, now = new Date()) => {
  const workedMinutes = elapsedMinutes(day.startAt, day.endAt || now);
  const expectedMinutes = day.capacityMinutes || DEFAULT_WORKDAY_MINUTES;
  return { workedMinutes, expectedMinutes, shortByMinutes: Math.max(0, expectedMinutes - workedMinutes) };
};
