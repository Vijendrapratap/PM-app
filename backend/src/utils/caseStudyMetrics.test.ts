import assert from 'node:assert/strict'; import test from 'node:test'; import { validateCaseStudyMetrics } from './caseStudyMetrics';
test('accepts metrics with explicit query provenance', () => assert.equal(validateCaseStudyMetrics([{ metric: 'tasks completed', value: 4, sourceType: 'TASK_QUERY', sourceIds: ['a'] }]), true));
test('rejects invented or non-numeric metric values', () => assert.equal(validateCaseStudyMetrics([{ metric: 'conversion lift', value: Number.NaN, sourceType: '', sourceIds: [] }]), false));
