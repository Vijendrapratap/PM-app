import assert from 'node:assert/strict'; import test from 'node:test'; import { calculateIdeaPriority } from './ideaScore';
test('idea priority adds value, alignment and urgency then subtracts effort', () => assert.equal(calculateIdeaPriority(5, 4, 3, 2), 10));
test('high effort can lower but never silently change the inputs', () => assert.equal(calculateIdeaPriority(1, 1, 1, 5), -2));
