'use strict';
// restic's cache and temporary files live in the host's local folder (%LOCALAPPDATA%\SynkWorkBackup —
// STAGE1_DESIGN.md 5.1), outside the roaming state, and that folder is as off-limits for sources and
// targets as the state folder. Without a local root nothing moves (the layout the other engine tests use).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Profiles, appFolders } = require('../src/profiles.cjs');
const { BackupEngine } = require('../src/engine.cjs');
const { RecommendedBackup, RecommendedEngine } = require('../src/recommended.cjs');
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

// 카본 끝판 A1: the recommended backup's own engine refuses its whole folder, its work folder and every protected
// place by itself — not only its vault — when it makes a repository and when it restores.
test('the recommended engine refuses the recommended folders and every protected place on its own', async (t) => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'swb-recforbid-'));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  const root = path.join(base, 'state', 'recommended'), workRoot = path.join(base, 'local', 'recommended'), other = path.join(base, 'other-app');
  const m = new RecommendedBackup({ root, workRoot, resticPath: 'unused', secretStore: {}, protectedPaths: [other] });
  const open = RecommendedEngine.prototype.open;
  RecommendedEngine.prototype.open = async function () {}; // the engine as made, without restic
  try { await m.makeEngine('local'); } finally { RecommendedEngine.prototype.open = open; }
  assert.deepEqual(m.engine.forbiddenPaths.map((p) => path.resolve(p)), [root, workRoot, other].map((p) => path.resolve(p)));

  const source = path.join(base, 'source'), sibling = path.join(workRoot, 'cloud-vault', 'temp');
  await fs.mkdir(source, { recursive: true }); await fs.mkdir(sibling, { recursive: true });
  const engine = new RecommendedEngine({ stateDir: path.join(root, 'vault'), workDir: path.join(workRoot, 'vault'), forbiddenPaths: [root, workRoot], ...options });
  await engine.open();
  await assert.rejects(engine.initialize({ sources: [source] }, { parent: sibling }), /분리된 백업 위치/);
  assert.deepEqual(await fs.readdir(sibling), [], 'no recommended-… repository next to the vault either');
  assert.ok(engine.forbidden().includes(workRoot), 'a restore is refused there as well (restoreWhole checks forbidden())');
});

// 카본 끝판 A2: a root given by an 8.3 short name (a TEMP on some PCs and runners) is spelled out like the engines'
// folders, and a place is compared as written and as it really is.
test('roots given by a short name are the real folders, and a place inside them is refused by either name', {
  skip: process.platform !== 'win32' && 'Windows 8.3 이름을 보는 시험 — Windows에서만',
}, async (t) => {
  // cmd's own quoting, given as is (Node's escaping of the inner quotes is not cmd's).
  const short = (p) => execFileSync('cmd.exe', ['/d', '/s', '/c', `"for %I in ("${p}") do @echo %~sI"`], { encoding: 'utf8', windowsVerbatimArguments: true }).trim();
  // A work disk that makes no 8.3 names (a runner's D:) has no short spelling; the profile folder (`RUNNER~1`) does.
  let base = null;
  for (const parent of [os.tmpdir(), process.env.LOCALAPPDATA, process.env.USERPROFILE].filter(Boolean)) {
    const candidate = await fs.realpath(await fs.mkdtemp(path.join(parent, 'swb-shortname-')));
    t.after(() => fs.rm(candidate, { recursive: true, force: true }));
    if (short(candidate).toLowerCase() !== candidate.toLowerCase()) { base = candidate; break; }
  }
  if (!base) return t.skip('8.3 이름으로 쓸 수 있는 자리가 없다');
  const longRoot = path.join(base, 'StateFolderWithALongName'), longWork = path.join(base, 'LocalFolderWithALongName');
  await fs.mkdir(longRoot); await fs.mkdir(longWork);
  const shortRoot = short(longRoot), shortWork = short(longWork);
  const profiles = new Profiles({ root: shortRoot, workRoot: shortWork, ...options });
  await profiles.open();
  assert.equal(profiles.root.toLowerCase(), longRoot.toLowerCase());
  assert.equal(profiles.workRoot.toLowerCase(), longWork.toLowerCase());
  assert.throws(() => profiles.assertOutput(path.join(longWork, 'vault', 'temp')), /분리된 위치/, 'the long name of a place in the work root');
  const inside = path.join(longRoot, 'PlaceInsideTheState'); await fs.mkdir(inside);
  assert.throws(() => profiles.assertOutput(path.join(short(longRoot), 'PlaceInsideTheState')), /분리된 위치/, 'the short name of a place in the state');
  profiles.assertOutput(path.join(base, 'elsewhere'));
});

// 카본 끝판 B1: with a root of its own (test mode), the worker still keeps every version's folders — 0.5.0, the
// 0.6.1 trial and the installed 0.7.0's state and cache — off-limits for sources, targets and restores.
test('every version\'s folders stay off-limits when the root is elsewhere', async (t) => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'swb-appfolders-'));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  const env = { APPDATA: path.join(base, 'Roaming'), LOCALAPPDATA: path.join(base, 'Local') };
  const folders = appFolders(path.join(base, 'test-state'), env);
  assert.deepEqual(folders, [path.join(env.APPDATA, 'SoloWorkBackup'), path.join(env.APPDATA, 'SoloWorkBackupRustBeta'),
    path.join(env.APPDATA, 'SynkWorkBackup'), path.join(env.LOCALAPPDATA, 'SynkWorkBackup')]);
  for (const folder of folders) await fs.mkdir(path.join(folder, 'inside'), { recursive: true });
  const profiles = new Profiles({ root: path.join(base, 'test-state'), workRoot: path.join(base, 'test-local'), protectedPaths: folders, ...options });
  await profiles.open();
  for (const folder of folders) {
    assert.throws(() => profiles.assertOutput(path.join(folder, 'inside')), /분리된 위치/, folder);
    for (const engine of Object.values(profiles.engines)) assert.ok(engine.forbidden().includes(path.resolve(folder)), folder);
  }
  await fs.mkdir(path.join(base, 'target'));
  await assert.rejects(profiles.engines.local.setup({ sources: [path.join(folders[2], 'inside')], parent: path.join(base, 'target') }), /겹/, 'the installed state as a source');
  assert.deepEqual(await fs.readdir(path.join(base, 'target')), [], 'nothing was made for it');
  assert.deepEqual(appFolders(path.join(base, 'x', 'SynkWorkBackup'), {}).slice(0, 1), [path.join(base, 'x', 'SoloWorkBackup')], 'without APPDATA: next to the root');
});
