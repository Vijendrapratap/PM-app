import assert from 'node:assert/strict'; import test from 'node:test'; import { notificationDelivery } from './notificationRouting';
test('critical blockers route immediately', () => assert.equal(notificationDelivery('critical_blocker'), 'IMMEDIATE'));
test('routine completion routes to digest', () => assert.equal(notificationDelivery('task_completed'), 'DIGEST'));
