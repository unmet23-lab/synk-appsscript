'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const CLI = path.resolve(__dirname, '../tools/classroom-media/cli.js');

test('check is read-only and prepare/arm stop before credentials or remote work when preflight fails', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-classroom-cli-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const config = {
    expectedChannelId: `UC${'x'.repeat(22)}`, syncUrl: 'https://test.supabase.co/functions/v1/classroom-sync', anonKeyEnv: 'SYNK_TEST_PREFLIGHT_ANON',
    stateDir: path.join(dir, 'state'), inboxDir: path.join(dir, 'inbox'), recordingsRoot: path.join(dir, 'recordings'),
    classes: [{ classId: '11111111-1111-4111-8111-111111111111', playlistId: 'playlist000001', streamId: 'stream001', videoPrivacy: 'private', syncKeyEnv: 'SYNK_TEST_PREFLIGHT_CLASS' }],
  };
  const file = path.join(dir, 'config.json'); fs.writeFileSync(file, JSON.stringify(config));
  for (const command of ['check', 'prepare', 'arm']) {
    const run = spawnSync(process.execPath, [CLI, command, file, path.join(dir, 'no-session.json')], { encoding: 'utf8', env: { ...process.env, SYNK_TEST_PREFLIGHT_ANON: '', SYNK_TEST_PREFLIGHT_CLASS: '' }, timeout: 10000 });
    assert.equal(run.status, 1, run.stderr);
    assert.equal(run.stderr, '');
    const result = JSON.parse(run.stdout);
    assert.equal(result.ok, false); assert.equal(result.scope, 'local-automatic-only');
    assert.ok(result.checks.some(check => check.code === 'DIRECTORY_READY' && check.reason === 'MISSING'));
    assert.ok(result.manualChecksRequired.length >= 5);
    assert.equal(fs.existsSync(config.stateDir), false);
    assert.equal(fs.existsSync(config.inboxDir), false);
  }
  const human = spawnSync(process.execPath, [CLI, 'check', file, '--human'], { encoding: 'utf8', env: { ...process.env, SYNK_TEST_PREFLIGHT_ANON: '', SYNK_TEST_PREFLIGHT_CLASS: '' }, timeout: 10000 });
  assert.equal(human.status, 1, human.stderr);
  assert.match(human.stdout, /로컬 준비 확인 필요/);
  assert.match(human.stdout, /녹화 원본 폴더: 폴더가 없습니다/);
  assert.match(human.stdout, /실제 송출·학생 시청 완료를 뜻하지 않습니다/);
  assert.equal(fs.existsSync(config.stateDir), false);
});

test('a passing check lists manual checks without creating worker state', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-classroom-cli-pass-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const config = {
    expectedChannelId: `UC${'x'.repeat(22)}`, syncUrl: 'https://test.supabase.co/functions/v1/classroom-sync', anonKeyEnv: 'SYNK_TEST_PREFLIGHT_ANON', minimumFreeBytes: 1,
    stateDir: path.join(dir, 'state'), inboxDir: path.join(dir, 'inbox'), recordingsRoot: path.join(dir, 'recordings'),
    classes: [{ classId: '11111111-1111-4111-8111-111111111111', playlistId: 'playlist000001', streamId: 'stream001', videoPrivacy: 'private', syncKeyEnv: 'SYNK_TEST_PREFLIGHT_CLASS' }],
  };
  for (const field of ['stateDir', 'inboxDir', 'recordingsRoot']) fs.mkdirSync(config[field]);
  const file = path.join(dir, 'config.json'); fs.writeFileSync(file, JSON.stringify(config));
  const secret = 'sample-secret-'.repeat(4);
  const run = spawnSync(process.execPath, [CLI, 'check', file], { encoding: 'utf8', env: { ...process.env, SYNK_TEST_PREFLIGHT_ANON: 'public-test', SYNK_TEST_PREFLIGHT_CLASS: secret }, timeout: 10000 });
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(run.stdout); assert.equal(result.ok, true); assert.ok(result.manualChecksRequired.length);
  assert.equal(run.stdout.includes(secret), false);
  assert.deepEqual(fs.readdirSync(config.stateDir), []);
  fs.writeFileSync(path.join(config.stateDir, 'a'.repeat(64) + '.json'), JSON.stringify({ sessionKey: 'synthetic-old-live', title: '합성 수업', status: 'live', syncedAt: '2020-01-01T00:00:00Z', uploadUrl: secret }));
  const status = spawnSync(process.execPath, [CLI, 'status', file, '--human'], { encoding: 'utf8', timeout: 10000 });
  assert.equal(status.status, 0, status.stderr); assert.match(status.stdout, /합성 수업 — 방송 상태 미확인/);
  assert.equal(status.stdout.includes(secret), false);
});
