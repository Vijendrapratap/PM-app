import test from 'node:test';
import assert from 'node:assert/strict';
import { canManageDocumentsLinks } from './documentsLinksPolicy';

test('CEO, Founder, and Super Admin can manage Documents & Links', () => {
  assert.equal(canManageDocumentsLinks({ role: 'CEO', platformRole: 'CEO' }), true);
  assert.equal(canManageDocumentsLinks({ role: 'Founder' }), true);
  assert.equal(canManageDocumentsLinks({ role: 'FOUNDER' }), true);
  assert.equal(canManageDocumentsLinks({ role: 'Super Admin', platformRole: 'CEO' }), true);
});

test('other authenticated roles have read-only Documents & Links access', () => {
  assert.equal(canManageDocumentsLinks({ role: 'Project Manager', platformRole: 'MANAGER' }), false);
  assert.equal(canManageDocumentsLinks({ role: 'Team Member', platformRole: 'TEAM_MEMBER' }), false);
  assert.equal(canManageDocumentsLinks(undefined), false);
});
