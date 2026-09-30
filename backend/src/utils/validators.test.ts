import test from 'node:test';
import assert from 'node:assert/strict';
import { updateUserSchema } from './validators';

test('updateUserSchema keeps designation so PUT /api/users/:id can set it (Team page profile edit)', () => {
  const result = updateUserSchema.safeParse({ designation: 'Head of AptusHire' });
  assert.equal(result.success, true);
  assert.equal(result.success && result.data.designation, 'Head of AptusHire');
});
