import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canApplyStructuralAgentProposal,
  canInviteUsers,
  canManageProject,
  canUpdateTask,
  canViewProject,
  toPolicyResource,
  type ProjectPolicyResource,
} from './accessPolicy';

const project: ProjectPolicyResource = {
  organizationId: 'org-1',
  departmentId: 'department-1',
  ownerUserId: 'manager-owner',
  verticalOwnerUserId: 'aptushire-head',
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

test('managers see every project in the organization; team members only their own', () => {
  assert.equal(canViewProject({ id: 'ceo', role: 'CEO', organizationId: 'org-1' }, project), true);
  assert.equal(canViewProject({ id: 'developer', role: 'TEAM_MEMBER', organizationId: 'org-1' }, project), true);
  assert.equal(canViewProject({ id: 'any-head', role: 'MANAGER', organizationId: 'org-1' }, project), true);
  assert.equal(canViewProject({ id: 'lead-head', role: 'Lead', organizationId: 'org-1' }, project), true);
  assert.equal(canViewProject({ id: 'outsider', role: 'TEAM_MEMBER', organizationId: 'org-1' }, project), false);
  assert.equal(canViewProject({ id: 'ceo', role: 'CEO', organizationId: 'org-2' }, project), false);
  assert.equal(canViewProject({ id: 'any-head', role: 'MANAGER', organizationId: 'org-2' }, project), false);
});

test('a vertical head manages their vertical only', () => {
  assert.equal(canManageProject({ id: 'aptushire-head', role: 'MANAGER', organizationId: 'org-1' }, project), true);
  assert.equal(canManageProject({ id: 'frontdesk-head', role: 'MANAGER', organizationId: 'org-1' }, project), false);
  assert.equal(canManageProject({ id: 'aptushire-head', role: 'TEAM_MEMBER', organizationId: 'org-1' }, project), false);
  assert.equal(canManageProject({ id: 'aptushire-head', role: 'MANAGER', organizationId: 'org-1' }, { ...project, verticalOwnerUserId: null }), false);
  assert.equal(canManageProject({ id: 'ceo', role: 'CEO', organizationId: 'org-1' }, { ...project, verticalOwnerUserId: null }), true);
});

test('toPolicyResource maps a project row including its vertical head', () => {
  const resource = toPolicyResource({
    organization_id: 'org-1', department_id: 'd', owner_id: 'o', vertical: { id: 'v', owner_user_id: 'head' },
    project_members: [{ user: { id: 'u' }, project_role: 'MANAGER', permissions_json: { manageTasks: true } }],
  });
  assert.deepEqual(resource, {
    organizationId: 'org-1', departmentId: 'd', ownerUserId: 'o', verticalOwnerUserId: 'head',
    members: [{ userId: 'u', projectRole: 'MANAGER', permissions: { manageTasks: true } }],
  });
  assert.equal(toPolicyResource({ organization_id: 'org-1', owner_id: 'o' }).verticalOwnerUserId, null);
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
