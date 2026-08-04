import test from 'node:test';
import assert from 'node:assert/strict';
import { nextRecurringDueDate } from './recurringTodo';

test('moves a daily routine to today', () => {
  assert.equal(nextRecurringDueDate('2026-08-01', 'DAILY', '2026-08-03'), '2026-08-03');
});

test('skips weekends for weekday routines', () => {
  assert.equal(nextRecurringDueDate('2026-07-31', 'WEEKDAYS', '2026-08-02'), '2026-08-03');
});

test('keeps the weekly cadence', () => {
  assert.equal(nextRecurringDueDate('2026-07-20', 'WEEKLY', '2026-08-03'), '2026-08-03');
});

test('does not reschedule one-off work', () => {
  assert.equal(nextRecurringDueDate('2026-08-01', 'NONE', '2026-08-03'), null);
});
