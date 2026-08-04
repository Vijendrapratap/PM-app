import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canApplyStructuralAgentProposal,
  canInviteUsers,
  canManageProject,
  canUpdateTask,
  canViewProject,
  type ProjectPolicyResource,
} from './accessPolicy';

const project: ProjectPolicyResource = {
  organizationId: 'org-1',
  departmentId: 'department-1',
  ownerUserId: 'manager-owner',
  members: [
    { userId: 'manager-member', projectRole: 'MANAGER' },
    { userId: 'developer' },
  ],
};

test('only CEO authority can invite organization users', () => {
  assert.equal(canInviteUsers({ id: 'ceo', role: 'CEO' }), true);
  assert.equal(canInviteUsers({ id: 'manager', role: 'MANAGER' }), false);
  assert.equal(canInviteUsers({ id: 'member', role: 'TEAM_MEMBER' }), false);
});

test('project visibility is organization and membership scoped', () => {
  assert.equal(canViewProject({ id: 'ceo', role: 'CEO', organizationId: 'org-1' }, project), true);
  assert.equal(canViewProject({ id: 'developer', role: 'TEAM_MEMBER', organizationId: 'org-1' }, project), true);
  assert.equal(canViewProject({ id: 'outsider', role: 'MANAGER', organizationId: 'org-1' }, project), false);
  assert.equal(canViewProject({ id: 'ceo', role: 'CEO', organizationId: 'org-2' }, project), false);
});

test('only scoped managers can make structural project edits', () => {
  assert.equal(canManageProject({ id: 'manager-owner', role: 'MANAGER', organizationId: 'org-1' }, project), true);
  assert.equal(canManageProject({ id: 'manager-member', role: 'MANAGER', organizationId: 'org-1' }, project), true);
  assert.equal(canManageProject({ id: 'developer', role: 'TEAM_MEMBER', organizationId: 'org-1' }, project), false);
  assert.equal(canApplyStructuralAgentProposal({ id: 'developer', role: 'TEAM_MEMBER', organizationId: 'org-1' }, project), false);
});

test('team members can update only their own task in an accessible project', () => {
  const actor = { id: 'developer', role: 'TEAM_MEMBER', organizationId: 'org-1' };
  assert.equal(canUpdateTask(actor, project, 'developer'), true);
  assert.equal(canUpdateTask(actor, project, 'someone-else'), false);
});
