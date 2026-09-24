import test from 'node:test';
import assert from 'node:assert/strict';
import { stageForLegacyStatus } from './projectLifecycleStages';

test('legacy project statuses map onto lifecycle stages', () => {
  assert.equal(stageForLegacyStatus('Draft'), 'DRAFT');
  assert.equal(stageForLegacyStatus('Saved'), 'DRAFT');
  assert.equal(stageForLegacyStatus('Planning'), 'PLANNING');
  for (const status of ['In Progress', 'Review', 'Testing']) assert.equal(stageForLegacyStatus(status), 'ACTIVE');
  assert.equal(stageForLegacyStatus('On Hold'), 'ON_HOLD');
  assert.equal(stageForLegacyStatus('Cancelled'), 'CANCELLED');
  assert.equal(stageForLegacyStatus('Completed'), null);
  assert.equal(stageForLegacyStatus('Blocked'), null);
});
