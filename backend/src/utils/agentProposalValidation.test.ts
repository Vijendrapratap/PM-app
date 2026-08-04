import assert from 'node:assert/strict'; import test from 'node:test'; import { validateAgentProposalActions } from './agentProposalValidation';
test('accepts only allowlisted application-service actions', () => assert.equal(validateAgentProposalActions([{ type: 'PUBLISH_PLAN', planId: 'x' }]), true));
test('rejects direct SQL and unknown agent actions', () => assert.equal(validateAgentProposalActions([{ type: 'RUN_SQL', sql: 'delete' }]), false));
