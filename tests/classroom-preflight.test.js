'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { checkLocal, DEFAULT_MINIMUM_FREE_BYTES } = require('../tools/classroom-media/preflight');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-classroom-preflight-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const config = { syncUrl: 'https://synthetic.supabase.co/functions/v1/classroom-sync', anonKeyEnv: 'ANON', classes: [{ syncKeyEnv: 'CLASS_ONE' }, { syncKeyEnv: 'CLASS_TWO' }] };
  for (const key of ['stateDir', 'inboxDir', 'recordingsRoot']) {
    config[key] = path.join(root, key);
    fs.mkdirSync(config[key]);
  }
  const env = { ANON: 'synthetic-anon-secret', CLASS_ONE: 'one-secret-'.repeat(5), CLASS_TWO: 'two-secret-'.repeat(5) };
  const fsImpl = {
    statSync: fs.statSync, accessSync: fs.accessSync,
    statfsSync: () => ({ bsize: 4096n, bavail: BigInt(DEFAULT_MINIMUM_FREE_BYTES / 4096), bfree: 999999999n }),
  };
  return { root, config, env, fsImpl, run: options => checkLocal(config, { env, fsImpl, ...options }) };
}
const check = (result, code, directory) => result.checks.find(item => item.code === code && (!directory || item.directory === directory));

test('read-only preflight passes local prerequisites without claiming manual media checks passed', t => {
  const f = fixture(t), before = fs.readdirSync(f.root, { recursive: true });
  const result = f.run();
  assert.equal(result.ok, true);
  assert.equal(result.scope, 'local-automatic-only');
  assert.equal(check(result, 'RECORDING_DISK_SPACE').freeBytes, DEFAULT_MINIMUM_FREE_BYTES);
  for (const code of ['OBS_STREAM_AND_RECORDING_SETTINGS', 'CAMERA_INPUT', 'MICROPHONE_AND_AUDIO', 'LOCAL_RECORDING_PLAYBACK', 'STUDENT_PRIVATE_VIDEO_ACCESS']) {
    assert.ok(result.manualChecksRequired.some(item => item.code === code));
  }
  assert.deepEqual(fs.readdirSync(f.root, { recursive: true }), before);
});

test('placeholder config and missing or short credentials fail, then recover with corrected values', t => {
  const f = fixture(t);
  f.config.syncUrl = 'https://YOUR_PROJECT.supabase.co/functions/v1/classroom-sync';
  f.config.rooms = [{ streamId: 'REPLACE_ROOM_STREAM_1' }];
  delete f.env.ANON; f.env.CLASS_ONE = 'too-short'; f.env.CLASS_TWO = '';
  let result = f.run();
  assert.equal(result.ok, false);
  assert.equal(check(result, 'CONFIG_PLACEHOLDERS').count, 2);
  assert.equal(check(result, 'ANON_KEY').reason, 'MISSING');
  assert.deepEqual(result.checks.filter(item => item.code === 'CLASS_SYNC_KEY').map(item => item.reason), ['TOO_SHORT', 'MISSING']);
  f.config.syncUrl = 'https://synthetic.supabase.co/functions/v1/classroom-sync';
  f.config.rooms[0].streamId = 'synthetic-stream';
  f.env.ANON = 'synthetic-public-key'; f.env.CLASS_ONE = 'a'.repeat(32); f.env.CLASS_TWO = 'b'.repeat(32);
  result = f.run();
  assert.equal(result.ok, true);
});

test('environment placeholder and newline values cannot pass as configured credentials', t => {
  const f = fixture(t);
  f.env.ANON = 'REPLACE_ANON_KEY'; f.env.CLASS_TWO = 'x'.repeat(40) + '\n';
  const result = f.run();
  assert.equal(check(result, 'ANON_KEY').reason, 'PLACEHOLDER');
  assert.equal(result.checks.find(item => item.code === 'CLASS_SYNC_KEY' && item.classIndex === 2).reason, 'INVALID_FORMAT');
});

test('missing directory is reported without creating it; file cannot substitute for directory', t => {
  const f = fixture(t);
  fs.rmdirSync(f.config.inboxDir);
  fs.rmdirSync(f.config.stateDir); fs.writeFileSync(f.config.stateDir, 'fixture');
  const result = f.run();
  assert.equal(result.ok, false);
  assert.equal(check(result, 'DIRECTORY_READY', 'inboxDir').reason, 'MISSING');
  assert.equal(fs.existsSync(f.config.inboxDir), false);
  assert.equal(check(result, 'DIRECTORY_READY', 'stateDir').reason, 'NOT_DIRECTORY');
});

test('read and write access failures are checked independently without leaking exception contents', t => {
  const f = fixture(t);
  f.fsImpl.accessSync = (directory, mode) => {
    if ((directory === f.config.stateDir && mode === fs.constants.R_OK) || (directory === f.config.inboxDir && mode === fs.constants.W_OK)) {
      throw new Error(`secret ${f.env.CLASS_ONE} ${directory}`);
    }
  };
  const result = f.run();
  assert.equal(check(result, 'DIRECTORY_READY', 'stateDir').reason, 'NOT_READABLE');
  assert.equal(check(result, 'DIRECTORY_READY', 'inboxDir').reason, 'NOT_WRITABLE');
  const output = JSON.stringify(result);
  for (const secret of [...Object.values(f.env), ...['stateDir', 'inboxDir', 'recordingsRoot'].map(key => f.config[key])]) assert.equal(output.includes(secret), false);
});

test('uses available disk space, rejects shortfall, and honors a positive configured or explicit threshold', t => {
  const f = fixture(t);
  f.fsImpl.statfsSync = () => ({ bsize: 4096n, bavail: 1n, bfree: 999999999999n });
  let result = f.run();
  assert.equal(result.ok, false);
  assert.equal(check(result, 'RECORDING_DISK_SPACE').reason, 'INSUFFICIENT_SPACE');
  assert.equal(check(result, 'RECORDING_DISK_SPACE').freeBytes, 4096);
  f.config.minimumFreeBytes = 4096;
  assert.equal(f.run().ok, true);
  assert.equal(f.run({ minimumFreeBytes: 4097 }).ok, false);
  assert.equal(f.run({ minimumFreeBytes: 1 }).ok, true);
  for (const minimumFreeBytes of [0, -1, NaN, Infinity, 1.5, '4096']) {
    result = f.run({ minimumFreeBytes });
    assert.equal(check(result, 'MINIMUM_FREE_BYTES').ok, false);
  }
});

test('disk metadata errors fail closed and do not reveal path, token, stream or error values', t => {
  const f = fixture(t);
  const stream = 'synthetic-private-stream-value'; f.config.rooms = [{ streamId: stream }];
  f.fsImpl.statfsSync = () => { throw new Error([f.config.recordingsRoot, stream, ...Object.values(f.env)].join(' ')); };
  const result = f.run(), output = JSON.stringify(result);
  assert.equal(result.ok, false);
  assert.equal(check(result, 'RECORDING_DISK_SPACE').reason, 'SPACE_UNAVAILABLE');
  for (const secret of [f.config.recordingsRoot, stream, ...Object.values(f.env)]) assert.equal(output.includes(secret), false);
  assert.equal(checkLocal(f.config, { env: f.env, fsImpl: { ...f.fsImpl, statfsSync: () => ({ bsize: 4096n, bavail: -1n }) } }).ok, false);
});
