import test from 'node:test';
import assert from 'node:assert/strict';
import { workDateForTimezone } from '../utils/workDate';

test('daily-plan work date follows the user timezone across UTC midnight', () => {
  const instant = new Date('2026-08-02T21:30:00.000Z');
  assert.equal(workDateForTimezone('Asia/Dubai', instant), '2026-08-03');
  assert.equal(workDateForTimezone('America/New_York', instant), '2026-08-02');
});
