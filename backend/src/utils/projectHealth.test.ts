import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendProjectHealth } from './projectHealth';

const base = { overdueMilestones: 0, overdueActiveTasks: 0, activeTasks: 12, criticalBlockers: 0, oldestBlockerAgeDays: 0, repeatedCarryovers: 0, staleDays: 1 };
test('critical blockers make project health off track', () => assert.equal(recommendProjectHealth({ ...base, criticalBlockers: 1 }), 'OFF_TRACK'));
test('a smaller overdue signal makes project health at risk', () => assert.equal(recommendProjectHealth({ ...base, overdueActiveTasks: 1 }), 'AT_RISK'));
test('a project without risk signals is on track', () => assert.equal(recommendProjectHealth(base), 'ON_TRACK'));
