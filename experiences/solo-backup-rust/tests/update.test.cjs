'use strict';
// The updater's settings, the feed script and the clean-Windows exercise's own rules (STAGE1_DESIGN.md 4.10 · 4.11).
// The updater itself — a package installed only when its signature and signed version are right — runs on a clean
// runner (workbackup-clean-windows `update`, test-support/clean-update.ps1).
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { feed, trustedComment } = require('../scripts/update-feed.cjs');
const data = require('../test-support/clean-data.cjs');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');

test('the release checks one https feed beside the PC app\'s, binds each package to its version and never goes down', () => {
  const config = JSON.parse(read('src-tauri/tauri.conf.json'));
  const updater = config.plugins.updater;
  assert.deepEqual(updater.endpoints, ['https://synk.im/desktop/releases/workbackup.json']);
  assert.equal(updater.requireSignedVersion, true);
  assert.equal(updater.windows.installMode, 'passive');
  for (const key of ['dangerousInsecureTransportProtocol', 'dangerousAcceptInvalidCerts', 'dangerousAcceptInvalidHostnames', 'allowDowngrades']) assert.equal(updater[key], undefined, key);
  assert.equal(typeof updater.pubkey, 'string');
  // The installer is signed on the signing PC after the build, never by the build (no private key in CI).
  assert.equal(config.bundle.createUpdaterArtifacts, undefined);
  assert.equal(config.bundle.windows.allowDowngrades, false);
  assert.match(read('src-tauri/Cargo.toml'), /^tauri-plugin-updater = \{ version = "=2\.14\.1", default-features = false, features = \["rustls-tls", "system-proxy"\] \}$/m);
  // A test override may not reach the bundle (template, hooks, resources).
  assert.match(read('scripts/build.ps1'), /if \(\$override\.ContainsKey\('bundle'\)\) \{ throw/);
});

test('the window app takes the update switches alone, and the release still takes nothing else', () => {
  const main = read('src-tauri/src/main.rs');
  assert.match(main, /if let \[mode\]=std::env::args\(\)\.skip\(1\)\.collect::<Vec<_>>\(\)\.as_slice\(\)\{\n\s+if mode=="--update-check"\|\|mode=="--update-install"/);
  assert.match(main, /let switches:&\[&str\]=if cfg!\(debug_assertions\)\{&\["--background","--test-mode","--smoke"\]\}else\{&\["--background"\]\};/);
  // The notice's click asks first (cancel is the first button), and installing holds the engine lock.
  assert.match(main, /OkCancelCustom\("나중에"\.into\(\),"업데이트"\.into\(\)\)/);
  assert.match(read('src-tauri/src/update.rs'), /let _engine = crate::platform::try_lock\(root, crate::platform::ENGINE_LOCK\)[^\n]+\.ok_or\("RUN_ACTIVE"\)\?;\n\s+let update = find/);
});

function signature({ version, file }) {
  const comment = ['timestamp:1794788230', `file:${file}`, ...(version ? [`version:${version}`] : [])].join('\t');
  return Buffer.from(`untrusted comment: signature from tauri secret key\nRUSUfake\ntrusted comment: ${comment}\nZmFrZQ==\n`).toString('base64');
}

test('update-feed.cjs makes the static feed only for a signature bound to that installer and version', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swb-feed-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const setup = path.join(dir, 'SynkWorkBackup-0.7.1-setup.exe'); fs.writeFileSync(setup, 'MZ test');
  const sig = path.join(dir, 'setup.sig');
  const url = 'https://github.com/unmet23-lab/synk-policy/releases/download/workbackup-0.7.1/SynkWorkBackup-0.7.1-setup.exe';
  fs.writeFileSync(sig, signature({ version: '0.7.1', file: 'SynkWorkBackup-0.7.1-setup.exe' }));
  const { feed: value, sha256 } = feed({ setup, signature: sig, url, now: new Date('2026-11-16T01:02:03.456Z') });
  assert.equal(value.version, '0.7.1');
  assert.equal(value.pub_date, '2026-11-16T01:02:03Z');
  assert.deepEqual(Object.keys(value.platforms), ['windows-x86_64-nsis', 'windows-x86_64']);
  assert.equal(value.platforms['windows-x86_64'].url, url);
  assert.equal(trustedComment(value.platforms['windows-x86_64-nsis'].signature).version, '0.7.1');
  assert.match(sha256, /^[0-9a-f]{64}$/);
  fs.writeFileSync(sig, signature({ version: '0.7.0', file: 'SynkWorkBackup-0.7.1-setup.exe' }));
  assert.throws(() => feed({ setup, signature: sig, url }), /signature is for version 0\.7\.0/);
  fs.writeFileSync(sig, signature({ version: null, file: 'SynkWorkBackup-0.7.1-setup.exe' }));
  assert.throws(() => feed({ setup, signature: sig, url }), /--app-version 0\.7\.1/);
  fs.writeFileSync(sig, signature({ version: '0.7.1', file: 'other.exe' }));
  assert.throws(() => feed({ setup, signature: sig, url }), /signature is for other\.exe/);
  fs.writeFileSync(sig, signature({ version: '0.7.1', file: 'SynkWorkBackup-0.7.1-setup.exe' }));
  assert.throws(() => feed({ setup, signature: sig, url: url.replace('0.7.1-setup', '0.7.2-setup') }), /end in the installer name/);
  const renamed = path.join(dir, 'setup.exe'); fs.copyFileSync(setup, renamed);
  assert.throws(() => feed({ setup: renamed, signature: sig, url }), /SynkWorkBackup-<version>-setup\.exe/);
});

test('D0 comes back only when every file and folder is the same, and a sealed kit opens only with the seed', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swb-d0-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const made = data.make(path.join(dir, 'd'), 1);
  assert.ok(made.longestPath > 260, 'a path over MAX_PATH');
  const list = data.walk(path.join(dir, 'd'));
  assert.ok(list.files['빈 파일.txt'].size === 0 && list.dirs.includes('빈 폴더'));
  assert.ok(Object.keys(list.files).some(f => f.includes(data.LEAK_MARKER)));
  assert.equal(data.compare(list, data.walk(path.join(dir, 'd'))).ok, true);
  fs.rmdirSync(path.join(dir, 'd', '빈 폴더'));
  assert.deepEqual(data.compare(list, data.walk(path.join(dir, 'd'))).dirsMissing, ['빈 폴더']);
  const env = { ...process.env };
  t.after(() => { process.env.WORKBACKUP_CI_SEED = env.WORKBACKUP_CI_SEED; process.env.GITHUB_RUN_ID = env.GITHUB_RUN_ID; });
  Object.assign(process.env, { WORKBACKUP_CI_SEED: 'seed-a', GITHUB_RUN_ID: '7' });
  const sealed = data.seal(Buffer.from('{"kit":1}'));
  assert.ok(!sealed.includes(Buffer.from('kit')));
  assert.equal(data.open(sealed).toString(), '{"kit":1}');
  process.env.GITHUB_RUN_ID = '8';
  assert.throws(() => data.open(sealed));
});

test('the clean-Windows workflow keeps secrets and keys to this repository and its own runs', () => {
  const flow = read('../../.github/workflows/workbackup-clean-windows.yml');
  const on = flow.slice(flow.indexOf('\non:'), flow.indexOf('\npermissions:'));
  assert.doesNotMatch(on, /pull_request/);
  assert.match(flow, /\npermissions:\n  contents: read\n/);
  for (const job of ['backup', 'restore']) {
    const head = `\n  ${job}:\n`, body = flow.slice(flow.indexOf(head) + head.length).split(/\n  [a-z]+:\n/)[0];
    assert.match(body, /if: \$\{\{ github\.repository == 'unmet23-lab\/synk-appsscript' \}\}/, job);
    assert.match(body, /WORKBACKUP_CI_SEED: \$\{\{ secrets\.WORKBACKUP_CI_SEED \}\}/, job);
  }
  // Only the CI seed reaches a job; no other secret, and the throwaway keys are never uploaded.
  assert.deepEqual([...new Set(flow.match(/secrets\.[A-Z_]+/g))], ['secrets.WORKBACKUP_CI_SEED']);
  for (const upload of flow.split('actions/upload-artifact').slice(1)) assert.doesNotMatch(upload.split('\n      - ')[0], /keys|\.key\b/);
  assert.match(flow, /name: workbackup-carry\n\s+retention-days: 1\n/);
});
