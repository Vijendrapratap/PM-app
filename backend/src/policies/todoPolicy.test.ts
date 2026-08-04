import assert from 'node:assert/strict';
import test from 'node:test';
import { canCreateTodoFor } from './todoPolicy';

test('team members can create a personal to-do for themselves', () => {
  assert.equal(canCreateTodoFor({ id: 'member-1', role: 'Team Member' }, 'member-1'), true);
});

test('team members cannot assign a personal to-do to another person', () => {
  assert.equal(canCreateTodoFor({ id: 'member-1', role: 'Team Member' }, 'member-2'), false);
});

test('CEO can create a personal to-do for any team member', () => {
  assert.equal(canCreateTodoFor({ id: 'ceo-1', role: 'Super Admin' }, 'member-2'), true);
});
