import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeOpenRouterModelId } from './openRouterModel';

test('normalizes the requested DeepSeek V4 Flash latest alias', () => {
  assert.equal(normalizeOpenRouterModelId('~deepseek/deepseek-v4-flash-latest'), 'deepseek/deepseek-v4-flash');
});

test('preserves canonical OpenRouter model identifiers', () => {
  assert.equal(normalizeOpenRouterModelId('deepseek/deepseek-v4-flash'), 'deepseek/deepseek-v4-flash');
});
