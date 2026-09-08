'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
test('GPT는 프로젝트의 옛 Claude 훅·허용 목록·권한 덮어쓰기를 상속하지 않는다', () => {
  const settings = JSON.parse(fs.readFileSync(path.join(root, '.claude/settings.json'), 'utf8'));
  assert.deepEqual(settings.hooks || {}, {});
  assert.deepEqual(settings.permissions || {}, {});
  assert.equal(fs.existsSync(path.join(root, 'tools/codex-hook-bridge.js')), false);
  const config = fs.readFileSync(path.join(root, '.codex/config.toml'), 'utf8');
  assert.doesNotMatch(config, /^\s*(?:approval_policy|sandbox_mode|model_reasoning_effort)\s*=/m);
});
