import assert from 'node:assert/strict';
import test from 'node:test';
import { boundedFocusMinutes, focusBlockLimitMinutes } from './focusSession';

test('a focus block uses the task estimate when it is shorter than two hours', () => {
  assert.equal(focusBlockLimitMinutes(45), 45);
  assert.equal(boundedFocusMinutes(80, 45), 45);
});

test('long and missing estimates cannot create an overnight active-time total', () => {
  assert.equal(focusBlockLimitMinutes(300), 120);
  assert.equal(boundedFocusMinutes(600, 300), 120);
  assert.equal(boundedFocusMinutes(600, null), 90);
});
