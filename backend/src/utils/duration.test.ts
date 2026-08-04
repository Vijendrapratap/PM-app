import test from 'node:test';
import assert from 'node:assert/strict';
import { elapsedMinutes } from './duration';

test('work-session duration remains correct across midnight', () => {
  assert.equal(elapsedMinutes('2026-08-02T23:45:00.000Z', '2026-08-03T01:15:00.000Z'), 90);
});
