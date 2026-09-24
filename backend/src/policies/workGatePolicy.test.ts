import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LIMITS, briefGaps, checkCommitments, checkProjectTransition, checkQuickAddTarget,
  checkStartTask, checkWorkTarget, isLoggableProject, type BriefFacts,
} from './workGatePolicy';

const completeBrief: BriefFacts = {
  objective: 'Launch the resort site', successCriteria: ['Live on domain'], ownerId: 'owner', targetDate: '2026-12-01',
  milestoneCount: 1, tasks: [{ assignedTo: 'dev', estimateMinutes: 60, stage: 'BACKLOG' }],
};
const base = {
  kind: 'DELIVERY' as const, isOwner: false, canManage: true, isCeo: false,
  brief: completeBrief, activeCounts: { owner: 0, org: 0 }, limits: DEFAULT_LIMITS,
};

test('brief gaps list every missing item and ignore cancelled tasks', () => {
  assert.deepEqual(briefGaps(completeBrief), []);
  const gaps = briefGaps({ objective: ' ', successCriteria: [], ownerId: null, targetDate: null, milestoneCount: 0,
    tasks: [{ assignedTo: null, estimateMinutes: null, stage: 'BACKLOG' }, { assignedTo: null, estimateMinutes: null, stage: 'CANCELLED' }] });
  assert.deepEqual(gaps, ['objective', 'success criteria', 'owner', 'target date', 'at least one milestone', 'every task needs an assignee and estimate']);
  assert.deepEqual(briefGaps({ ...completeBrief, tasks: [{ assignedTo: 'a', estimateMinutes: 30, stage: 'CANCELLED' }] }), ['at least one task']);
});

test('DRAFT to PLANNING needs a complete brief and owner or manager', () => {
  assert.deepEqual(checkProjectTransition({ ...base, from: 'DRAFT', to: 'PLANNING' }), { ok: true, overrideUsed: false });
  assert.deepEqual(checkProjectTransition({ ...base, canManage: false, isOwner: true, from: 'DRAFT', to: 'PLANNING' }), { ok: true, overrideUsed: false });
  assert.equal(checkProjectTransition({ ...base, canManage: false, from: 'DRAFT', to: 'PLANNING' }).ok, false);
  const incomplete = checkProjectTransition({ ...base, brief: { ...completeBrief, targetDate: null }, from: 'DRAFT', to: 'PLANNING' });
  assert.deepEqual(incomplete, { ok: false, status: 400, message: 'Complete the brief first: target date' });
});

test('activation respects per-owner and org caps, excluding the project itself', () => {
  assert.deepEqual(checkProjectTransition({ ...base, from: 'PLANNING', to: 'ACTIVE', activeCounts: { owner: 1, org: 5 } }), { ok: true, overrideUsed: false });
  const owner = checkProjectTransition({ ...base, from: 'PLANNING', to: 'ACTIVE', activeCounts: { owner: 2, org: 2 } });
  assert.deepEqual(owner, { ok: false, status: 409, message: 'This owner already has 2 active projects (limit 2). Park or finish one first.' });
  const org = checkProjectTransition({ ...base, from: 'ON_HOLD', to: 'ACTIVE', activeCounts: { owner: 0, org: 6 } });
  assert.deepEqual(org, { ok: false, status: 409, message: 'The company already has 6 active projects (limit 6). Park or finish one first.' });
});

test('only a CEO can override a cap, and only with a reason', () => {
  const over = { ...base, from: 'PLANNING' as const, to: 'ACTIVE' as const, activeCounts: { owner: 2, org: 6 } };
  assert.equal(checkProjectTransition({ ...over, override: true, reason: 'Board priority' }).ok, false);
  assert.equal(checkProjectTransition({ ...over, isCeo: true, override: true }).ok, false);
  assert.deepEqual(checkProjectTransition({ ...over, isCeo: true, override: true, reason: 'Board priority' }), { ok: true, overrideUsed: true });
});

test('activation, resume and cancel need a manager; parking allows the owner; reasons required', () => {
  assert.equal(checkProjectTransition({ ...base, canManage: false, isOwner: true, from: 'PLANNING', to: 'ACTIVE' }).ok, false);
  assert.deepEqual(checkProjectTransition({ ...base, canManage: false, isOwner: true, from: 'ACTIVE', to: 'ON_HOLD' }), { ok: false, status: 400, message: 'Give a reason for parking this project' });
  assert.deepEqual(checkProjectTransition({ ...base, canManage: false, isOwner: true, from: 'ACTIVE', to: 'ON_HOLD', reason: 'Client paused' }), { ok: true, overrideUsed: false });
  assert.equal(checkProjectTransition({ ...base, from: 'DRAFT', to: 'CANCELLED' }).ok, false);
  assert.equal(checkProjectTransition({ ...base, from: 'DRAFT', to: 'CANCELLED', reason: 'Duplicate' }).ok, true);
});

test('unsupported transitions and standing projects are rejected', () => {
  assert.deepEqual(checkProjectTransition({ ...base, from: 'ACTIVE', to: 'COMPLETED' }), { ok: false, status: 400, message: 'Use Finish project to deliver a project' });
  assert.equal(checkProjectTransition({ ...base, from: 'DRAFT', to: 'ACTIVE' }).ok, false);
  assert.deepEqual(checkProjectTransition({ ...base, kind: 'STANDING', from: 'ACTIVE', to: 'ON_HOLD', reason: 'x' }), { ok: false, status: 400, message: 'Standing ops projects are always active' });
  assert.equal(checkProjectTransition({ ...base, from: 'CANCELLED', to: 'ACTIVE' }).ok, false);
});

test('commitments: 1..max, no duplicates', () => {
  assert.deepEqual(checkCommitments({ taskIds: ['a'], limits: DEFAULT_LIMITS }), { ok: true });
  assert.deepEqual(checkCommitments({ taskIds: [], limits: DEFAULT_LIMITS }), { ok: false, status: 400, message: 'Commit to at least one task for today' });
  assert.deepEqual(checkCommitments({ taskIds: ['a', 'b', 'c', 'd'], limits: DEFAULT_LIMITS }), { ok: false, status: 400, message: 'Commit to at most 3 tasks per day' });
  assert.deepEqual(checkCommitments({ taskIds: ['a', 'a'], limits: DEFAULT_LIMITS }), { ok: false, status: 400, message: 'Each task can be committed once' });
});

test('work target: must be your open task in an active or standing project', () => {
  const project = { kind: 'DELIVERY' as const, stage: 'ACTIVE' as const };
  assert.deepEqual(checkWorkTarget({ actorId: 'me', task: { assignedTo: 'me', collaboratorIds: [], stage: 'IN_PROGRESS' }, project }), { ok: true });
  assert.deepEqual(checkWorkTarget({ actorId: 'me', task: { assignedTo: 'you', collaboratorIds: ['me'], stage: 'BACKLOG' }, project }), { ok: true });
  assert.deepEqual(checkWorkTarget({ actorId: 'me', task: { assignedTo: 'you', collaboratorIds: [], stage: 'READY' }, project }), { ok: false, status: 403, message: 'You can only record work on tasks assigned to you' });
  assert.deepEqual(checkWorkTarget({ actorId: 'me', task: { assignedTo: 'me', collaboratorIds: [], stage: 'DONE' }, project }), { ok: false, status: 400, message: 'This task is closed' });
  assert.deepEqual(checkWorkTarget({ actorId: 'me', task: { assignedTo: 'me', collaboratorIds: [], stage: 'READY' }, project: { kind: 'DELIVERY', stage: 'DRAFT' } }), { ok: false, status: 400, message: 'This project is not active' });
  assert.equal(isLoggableProject({ kind: 'STANDING', stage: 'ACTIVE' }), true);
  assert.equal(isLoggableProject({ kind: 'DELIVERY', stage: 'ON_HOLD' }), false);
});

test('quick-add: standing projects for anyone, active delivery projects for members', () => {
  assert.deepEqual(checkQuickAddTarget({ project: { kind: 'STANDING', stage: 'ACTIVE' }, isMember: false }), { ok: true });
  assert.deepEqual(checkQuickAddTarget({ project: { kind: 'DELIVERY', stage: 'ACTIVE' }, isMember: true }), { ok: true });
  assert.deepEqual(checkQuickAddTarget({ project: { kind: 'DELIVERY', stage: 'ACTIVE' }, isMember: false }), { ok: false, status: 403, message: 'You can only add tasks to projects you are a member of' });
  assert.deepEqual(checkQuickAddTarget({ project: { kind: 'DELIVERY', stage: 'PLANNING' }, isMember: true }), { ok: false, status: 400, message: 'This project is not active' });
});

test('WIP limit on starting a task', () => {
  assert.deepEqual(checkStartTask({ inProgressCount: 1, limits: DEFAULT_LIMITS }), { ok: true });
  assert.deepEqual(checkStartTask({ inProgressCount: 2, limits: DEFAULT_LIMITS }), { ok: false, status: 409, message: 'You already have 2 tasks in progress (limit 2). Finish, pause or send one for review first.' });
});
