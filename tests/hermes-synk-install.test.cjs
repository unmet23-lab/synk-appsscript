'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { planConfig } = require('../tools/hermes-synk/install.cjs');
function fixture() { return { model: { provider: 'custom', default: 'local' }, platforms: { telegram: { enabled: true, channel_overrides: { 'allowed': { model: 'existing-model', provider: 'openai-codex', system_prompt: 'intake' } } }, other: { enabled: true } }, agent: { reasoning_overrides: { 'existing-model': 'xhigh' } }, platform_toolsets: { telegram: ['terminal', 'vision', 'skills'] }, fallback_providers: [{ provider: 'custom' }], fallback_model: { model: 'old' } }; }
test('keeps model, reasoning, local default and original intake routing while removing automatic fallback', () => {
  const input = fixture(), next = planConfig(input, 'allowed');
  assert.deepEqual(next.model, input.model);
  assert.deepEqual(next.agent, input.agent);
  assert.equal(next.platforms.telegram.channel_overrides.allowed.model, 'existing-model');
  assert.match(next.platforms.telegram.channel_overrides.allowed.system_prompt, /기존 synk-tip-review/);
  assert.deepEqual(next.fallback_providers, []);
  assert.equal('fallback_model' in next, false);
  assert.deepEqual(next.platforms.other, input.platforms.other);
  assert.equal(input.fallback_providers.length, 1);
});
test('installation plan is idempotent and does not duplicate tools', () => {
  const once = planConfig(fixture(), 'allowed');
  assert.deepEqual(planConfig(once, 'allowed'), once);
  assert.deepEqual(once.platform_toolsets.telegram, ['terminal', 'vision', 'skills', 'synk-work']);
});
test('unknown channel or another provider fails without inventing a route', () => {
  assert.throws(() => planConfig(fixture(), 'missing'));
  const input = fixture(); input.platforms.telegram.channel_overrides.allowed.provider = 'custom';
  assert.throws(() => planConfig(input, 'allowed'));
});
test('the Claude intake route used since 10-19 is kept like the earlier GPT route', () => {
  const input = fixture(); input.platforms.telegram.channel_overrides.allowed.provider = 'anthropic';
  const next = planConfig(input, 'allowed');
  assert.equal(next.platforms.telegram.channel_overrides.allowed.provider, 'anthropic');
  assert.equal(next.platforms.telegram.channel_overrides.allowed.model, 'existing-model');
  assert.deepEqual(next.fallback_providers, []);
});
