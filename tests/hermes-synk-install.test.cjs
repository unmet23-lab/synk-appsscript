'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { planConfig, installPluginOnly } = require('../tools/hermes-synk/install.cjs');
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

function pluginFixture(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-plugin-only-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const source = path.join(home, 'source');
  fs.mkdirSync(path.join(source, 'plugin'), { recursive: true });
  fs.mkdirSync(path.join(home, 'plugins/synk-work'), { recursive: true });
  for (const name of ['plugin.yaml', '__init__.py', 'tip_intake.py']) fs.writeFileSync(path.join(source, 'plugin', name), 'new-' + name);
  for (const name of ['plugin.yaml', '__init__.py']) fs.writeFileSync(path.join(home, 'plugins/synk-work', name), 'old-' + name);
  // Deliberately invalid YAML: this route must not parse, normalize or rewrite it.
  const config = Buffer.from('\ufeffkeep: [original bytes\r\nmodel: private-config-fixture\r\n', 'utf8');
  fs.writeFileSync(path.join(home, 'config.yaml'), config);
  fs.mkdirSync(path.join(home, 'skills/existing'), { recursive: true });
  fs.writeFileSync(path.join(home, 'skills/existing/SKILL.md'), 'keep-original-skill');
  return { home, source, config };
}

test('plugin-only preview does not mutate configuration, skills or installed files', t => {
  const { home, source, config } = pluginFixture(t);
  const receipt = installPluginOnly({ home, source });
  assert.equal(receipt.pluginOnly, true);
  assert.equal(receipt.applied, false);
  assert.equal(receipt.files.length, 3);
  assert.deepEqual(fs.readFileSync(path.join(home, 'config.yaml')), config);
  assert.equal(fs.readFileSync(path.join(home, 'plugins/synk-work/__init__.py'), 'utf8'), 'old-__init__.py');
  assert.equal(fs.existsSync(path.join(home, 'backups')), false);
});

test('plugin-only applies exactly three plugin files and preserves config bytes and skills', t => {
  const { home, source, config } = pluginFixture(t);
  const receipt = installPluginOnly({ home, source, apply: true });
  assert.equal(receipt.installed, true);
  assert.equal(receipt.configPreserved, true);
  assert.deepEqual(fs.readFileSync(path.join(home, 'config.yaml')), config);
  assert.equal(fs.readFileSync(path.join(home, 'skills/existing/SKILL.md'), 'utf8'), 'keep-original-skill');
  for (const name of ['plugin.yaml', '__init__.py', 'tip_intake.py']) assert.equal(fs.readFileSync(path.join(home, 'plugins/synk-work', name), 'utf8'), 'new-' + name);
  assert.equal(fs.readFileSync(path.join(home, receipt.backup, '__init__.py'), 'utf8'), 'old-__init__.py');
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, receipt.backup, 'receipt.json'))).installed, true);
});

test('plugin-only missing source is rejected before any installed bytes change', t => {
  const { home, source, config } = pluginFixture(t);
  fs.unlinkSync(path.join(source, 'plugin/tip_intake.py'));
  assert.throws(() => installPluginOnly({ home, source, apply: true }));
  assert.equal(fs.existsSync(path.join(home, 'backups')), false);
  assert.deepEqual(fs.readFileSync(path.join(home, 'config.yaml')), config);
  assert.equal(fs.readFileSync(path.join(home, 'plugins/synk-work/plugin.yaml'), 'utf8'), 'old-plugin.yaml');
});

test('plugin-only partial replacement restores original plugin bytes and preserves evidence', t => {
  const { home, source, config } = pluginFixture(t);
  let count = 0;
  assert.throws(() => installPluginOnly({ home, source, apply: true, replace: (from, to) => {
    if (++count === 2) throw new Error('fixture replacement failure');
    fs.renameSync(from, to);
  } }), /fixture replacement failure/);
  for (const name of ['plugin.yaml', '__init__.py']) assert.equal(fs.readFileSync(path.join(home, 'plugins/synk-work', name), 'utf8'), 'old-' + name);
  assert.equal(fs.existsSync(path.join(home, 'plugins/synk-work/tip_intake.py')), false);
  assert.deepEqual(fs.readFileSync(path.join(home, 'config.yaml')), config);
  const backup = fs.readdirSync(path.join(home, 'backups'))[0];
  const receipt = JSON.parse(fs.readFileSync(path.join(home, 'backups', backup, 'receipt.json')));
  assert.equal(receipt.failed, true);
  assert.deepEqual(receipt.rollbackBlocked, []);
  assert.deepEqual(fs.readdirSync(path.join(home, 'plugins/synk-work')).sort(), ['__init__.py', 'plugin.yaml']);
});

test('plugin-only never overwrites a concurrent configuration change', t => {
  const { home, source } = pluginFixture(t);
  let count = 0;
  assert.throws(() => installPluginOnly({ home, source, apply: true, replace: (from, to) => {
    fs.renameSync(from, to);
    if (++count === 1) fs.writeFileSync(path.join(home, 'config.yaml'), 'concurrent-user-edit');
  } }), /PLUGIN_CONFIG_CHANGED/);
  assert.equal(fs.readFileSync(path.join(home, 'config.yaml'), 'utf8'), 'concurrent-user-edit');
  assert.equal(fs.readFileSync(path.join(home, 'plugins/synk-work/__init__.py'), 'utf8'), 'old-__init__.py');
});
