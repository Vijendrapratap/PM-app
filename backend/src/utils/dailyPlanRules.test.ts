import test from 'node:test';
import assert from 'node:assert/strict';
import { capacityWarning, requiresCarryoverReason } from './dailyPlanRules';

test('a third carryover requires a reason', () => {
  assert.equal(requiresCarryoverReason(1, 'CARRY_OVER'), false);
  assert.equal(requiresCarryoverReason(2, 'CARRY_OVER'), true);
});

test('returning committed work to backlog requires a reason', () => {
  assert.equal(requiresCarryoverReason(0, 'BACKLOG'), true);
});

test('daily capacity is a warning rather than a submission blocker', () => {
  assert.equal(capacityWarning(510, 480), true);
  assert.equal(capacityWarning(420, 480), false);
});
