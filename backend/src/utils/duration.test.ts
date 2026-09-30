import test from 'node:test';
import assert from 'node:assert/strict';
import { elapsedMinutes, workdayHours } from './duration';

test('work-session duration remains correct across midnight', () => {
  assert.equal(elapsedMinutes('2026-08-02T23:45:00.000Z', '2026-08-03T01:15:00.000Z'), 90);
});

test('workday hours compare worked time with expected capacity', () => {
  const now = new Date('2026-09-29T12:00:00.000Z');
  assert.deepEqual(workdayHours({ startAt: '2026-09-29T04:00:00.000Z', endAt: '2026-09-29T11:10:00.000Z', capacityMinutes: 480 }, now), { workedMinutes: 430, expectedMinutes: 480, shortByMinutes: 50 });
  assert.deepEqual(workdayHours({ startAt: '2026-09-29T04:00:00.000Z', endAt: null, capacityMinutes: null }, now), { workedMinutes: 480, expectedMinutes: 480, shortByMinutes: 0 });
  assert.equal(workdayHours({ startAt: '2026-09-29T04:00:00.000Z', endAt: '2026-09-29T13:00:00.000Z', capacityMinutes: 420 }, now).shortByMinutes, 0);
});
