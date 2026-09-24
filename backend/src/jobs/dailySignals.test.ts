import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LIMITS } from '../policies/workGatePolicy';
import { detectSignals, workingDaysBetween } from './dailySignals';

const project = { id: 'p1', ownerId: 'o1', kind: 'DELIVERY' as const, stage: 'ACTIVE', targetDate: null, lastLogDate: '2026-09-24', activatedDate: '2026-09-01' };
const task = { id: 't1', projectId: 'p1', assignedTo: 'u1', stage: 'IN_PROGRESS', lastLogDate: '2026-09-24', startedDate: '2026-09-20', carryForwardCount: 0 };
const kinds = (facts: Parameters<typeof detectSignals>[0]) => detectSignals(facts, DEFAULT_LIMITS, '2026-09-25').map((signal) => `${signal.kind}:${signal.subjectId}`);

test('working days skip Saturday and Sunday', () => {
  assert.equal(workingDaysBetween('2026-09-18', '2026-09-25'), 5); // Fri → Fri
  assert.equal(workingDaysBetween('2026-09-25', '2026-09-25'), 0);
});

test('a healthy project and task produce no signals', () => {
  assert.deepEqual(kinds({ projects: [project], tasks: [task] }), []);
});

test('stale project after 5 working days without a log; standing and inactive projects ignored', () => {
  const stale = { ...project, lastLogDate: '2026-09-18' };
  assert.deepEqual(kinds({ projects: [stale], tasks: [] }), ['STALE_PROJECT:p1']);
  assert.deepEqual(kinds({ projects: [{ ...stale, kind: 'STANDING' }], tasks: [] }), []);
  assert.deepEqual(kinds({ projects: [{ ...stale, stage: 'ON_HOLD' }], tasks: [] }), []);
  assert.deepEqual(kinds({ projects: [{ ...project, lastLogDate: null, activatedDate: '2026-09-10' }], tasks: [] }), ['STALE_PROJECT:p1']);
});

test('overdue delivery project', () => {
  assert.deepEqual(kinds({ projects: [{ ...project, targetDate: '2026-09-24' }], tasks: [] }), ['OVERDUE_PROJECT:p1']);
  assert.deepEqual(kinds({ projects: [{ ...project, targetDate: '2026-09-25' }], tasks: [] }), []);
});

test('stale in-progress task, unassigned open task, repeated carry', () => {
  assert.deepEqual(kinds({ projects: [project], tasks: [{ ...task, lastLogDate: '2026-09-21' }] }), ['STALE_TASK:t1']);
  assert.deepEqual(kinds({ projects: [project], tasks: [{ ...task, stage: 'READY', assignedTo: null }] }), ['UNASSIGNED_READY_TASK:t1']);
  assert.deepEqual(kinds({ projects: [project], tasks: [{ ...task, carryForwardCount: 3 }] }), ['REPEATED_CARRY:t1']);
});
