'use strict';
// Settings reload for the window under the two locks (STAGE1_DESIGN.md 4.1): the window
// reads the settings again when it takes the engine lock. Review GA2 · GA3 (11-13).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { BackupEngine } = require('../src/engine.cjs');

const plain = { encrypt: text => Buffer.from('fixture-only:' + text), decrypt: bytes => bytes.toString().slice(13) };
const runner = async args => args[0] === 'cat' ? JSON.stringify({ id: 'e'.repeat(64) }) : '';

async function configured() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'solo-reload-'));
  const source = path.join(root, 'source'), target = path.join(root, 'target'), state = path.join(root, 'state');
  await Promise.all([source, target].map(p => fs.mkdir(p)));
  const run = new BackupEngine({ stateDir: state, resticPath: 'fixture', secretStore: plain, runner });
  await run.open();
  await run.setup({ sources: [source], parent: target });
  return { root, state, settings: path.join(state, 'settings.json') };
}
async function rewrite(file, change) {
  const value = JSON.parse(await fs.readFile(file, 'utf8')); change(value);
  await fs.writeFile(file + '.tmp', JSON.stringify(value, null, 2)); await fs.rename(file + '.tmp', file);
}

test('a run writing while the window opens is read by the next reload (GA2)', async () => {
  const { state, settings } = await configured();
  let once = true;
  // The credential is opened after the settings are read; the run writes right then.
  const racing = { ...plain, decrypt: async bytes => { if (once) { once = false; await rewrite(settings, v => { v.warning = 'written by the run'; }); } return plain.decrypt(bytes); } };
  const window = new BackupEngine({ stateDir: state, resticPath: 'fixture', secretStore: racing, runner });
  await window.open();
  assert.equal(window.config.warning ?? null, null, 'opened with the file as it was read');
  assert.equal(await window.reload(), true, 'the stamp was taken before reading, so the newer file is seen');
  assert.equal(window.config.warning, 'written by the run');
  assert.equal(await window.reload(), false, 'nothing new');
  await window.save();
  assert.equal(await window.reload(), false, 'its own save is not a change');
});

test('a window waiting for a recovery key reloads without failing (GA3)', async () => {
  const { state, settings } = await configured();
  const broken = { ...plain, decrypt: async () => { throw new Error('DPAPI unavailable'); } };
  const window = new BackupEngine({ stateDir: state, resticPath: 'fixture', secretStore: broken, runner });
  await assert.rejects(window.open(), e => e.code === 'RECOVERY_REQUIRED');
  assert.ok(window.config, 'settings were read');
  assert.equal(await window.reload(), false, 'same settings: no reopen, no error');
  await rewrite(settings, v => { v.warning = 'later'; });
  assert.equal(await window.reload(), true, 'changed settings are read even without a credential');
  assert.equal(window.config.warning, 'later');
  assert.equal(window.secret, null);
});
