export type TodoRecurrence = 'NONE' | 'DAILY' | 'WEEKDAYS' | 'WEEKLY';

const parseDate = (value: string) => new Date(`${value}T12:00:00.000Z`);
const formatDate = (value: Date) => value.toISOString().slice(0, 10);

const addDays = (value: Date, days: number) => {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const nextWeekday = (value: Date) => {
  let next = addDays(value, 1);
  while (next.getUTCDay() === 0 || next.getUTCDay() === 6) next = addDays(next, 1);
  return next;
};

export const nextRecurringDueDate = (dueDate: string, recurrence: TodoRecurrence, today: string): string | null => {
  if (recurrence === 'NONE' || dueDate >= today) return null;

  let next = parseDate(dueDate);
  const target = parseDate(today);
  while (next < target) {
    next = recurrence === 'WEEKLY'
      ? addDays(next, 7)
      : recurrence === 'WEEKDAYS'
        ? nextWeekday(next)
        : addDays(next, 1);
  }
  return formatDate(next);
};
