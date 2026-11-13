'use strict';
// restic's cache and temporary files live in the host's local folder (%LOCALAPPDATA%\SynkWorkBackup —
// STAGE1_DESIGN.md 5.1), outside the roaming state, and that folder is as off-limits for sources and
// targets as the state folder. Without a local root nothing moves (the layout the other engine tests use).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Profiles } = require('../src/profiles.cjs');
const { BackupEngine } = require('../src/engine.cjs');
const { RecommendedEngine } = require('../src/recommended.cjs');
const b2 = require('../src/b2.cjs');

const options = { resticPath: 'unused', secretStore: {}, runner: async () => ({ code: 0, stdout: '', stderr: '' }) };

test('restic cache and temp go under the local work root, which no profile may back up or use as a target', async (t) => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'swb-workroot-'));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  const root = path.join(base, 'state'), workRoot = path.join(base, 'local');
  const profiles = new Profiles({ root, workRoot, ...options });
  await profiles.open();
  for (const [name, folder] of [['local', 'vault'], ['b2', 'cloud-vault']]) {
    const engine = profiles.engines[name];
    assert.equal(engine.workDir, await fs.realpath(path.join(workRoot, folder)), name);
    assert.notEqual(engine.workDir, engine.stateDir, name);
    await fs.access(path.join(engine.workDir, 'cache'));
    await fs.access(path.join(engine.workDir, 'temp'));
    assert.ok(engine.forbiddenPaths.includes(path.resolve(workRoot)), `${name} may not back up or target the work root`);
    assert.ok(engine.forbiddenPaths.includes(path.resolve(root)), `${name} may not back up or target the state`);
  }
  const { env } = b2.childOptions(null, null, profiles.engines.local.workDir, {}, 'test-only');
  assert.equal(env.RESTIC_CACHE_DIR, path.join(profiles.engines.local.workDir, 'cache'));
  assert.equal(env.TEMP, path.join(profiles.engines.local.workDir, 'temp'));
  assert.equal(env.TMP, env.TEMP);

  const plain = new Profiles({ root: path.join(base, 'plain'), ...options });
  await plain.open();
  for (const engine of Object.values(plain.engines)) assert.equal(engine.workDir, engine.stateDir);
});

// Review GA2: the work folder is off-limits for every location a person picks, not only for sources —
// a recommended-backup target, a key file, a restore — and each engine refuses it on its own too.
test('no target, key file or restore may land in the work folder', async (t) => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'swb-worktarget-'));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  const root = path.join(base, 'state'), workRoot = path.join(base, 'local'), source = path.join(base, 'source');
  await fs.mkdir(source);
  const profiles = new Profiles({ root, workRoot, ...options });
  await profiles.open();
  const temp = path.join(profiles.engines.local.workDir, 'temp');
  assert.throws(() => profiles.assertOutput(temp), /분리된 위치/);
  assert.throws(() => profiles.assertOutput(workRoot), /분리된 위치/);
  profiles.assertOutput(path.join(base, 'elsewhere'));

  // Engines on their own, without the profile's forbidden list.
  const engine = new BackupEngine({ stateDir: path.join(base, 'bare-state'), workDir: path.join(base, 'bare-work'), ...options });
  await engine.open();
  assert.deepEqual(engine.own(), [engine.stateDir, engine.workDir]);
  assert.ok(engine.forbidden().includes(engine.workDir));
  await assert.rejects(engine.setup({ sources: [source], parent: path.join(engine.workDir, 'temp') }), /분리된 백업 폴더/);
  assert.deepEqual(await fs.readdir(path.join(engine.workDir, 'temp')), []);

  const recommended = new RecommendedEngine({ stateDir: path.join(base, 'rec-state'), workDir: path.join(base, 'rec-work'), ...options });
  await recommended.open();
  const recTemp = path.join(recommended.workDir, 'temp');
  await assert.rejects(recommended.initialize({ sources: [source] }, { parent: recTemp }), /분리된 백업 위치/);
  assert.deepEqual(await fs.readdir(recTemp), [], 'no recommended-… repository was made in the work folder');
});
