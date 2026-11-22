'use strict';
// The updater's settings, the feed script and the clean-Windows exercise's own rules (STAGE1_DESIGN.md 4.10 · 4.11).
// The updater itself — a package installed only when its signature and signed version are right — runs on a clean
// runner (workbackup-clean-windows `update`, test-support/clean-update.ps1).
const test = require('node:test'), assert = require('node:assert/strict');
const crypto = require('node:crypto'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
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
  // The operating key the updater checks and the recovery key tried next (11-16 유호님 「추천대로 만들어」), both made once on
  // the signing PC (scripts/update-keys.cjs make). Replacing one strands every installed copy, so their ids are pinned here.
  const keys = require('../scripts/update-keys.cjs');
  assert.equal(keys.publicKey(updater.pubkey).id, 'a906d76e18dc50e4');
  assert.equal(keys.publicKey(config.plugins.synkUpdate.recoveryPubkey).id, '6afbfdd8e4d59f4d');
  // The installer is signed on the signing PC after the build, never by the build (no private key in CI).
  assert.equal(config.bundle.createUpdaterArtifacts, undefined);
  assert.equal(config.bundle.windows.allowDowngrades, false);
  assert.match(read('src-tauri/Cargo.toml'), /^tauri-plugin-updater = \{ version = "=2\.14\.1", default-features = false, features = \["rustls-tls", "system-proxy"\] \}$/m);
  // A test override may not reach the bundle (template, hooks, resources).
  assert.match(read('scripts/build.ps1'), /if \(\$override\.ContainsKey\('bundle'\)\) \{ throw/);
});

test('the window app takes the update switches alone, and the release still takes nothing else', () => {
  const main = read('src-tauri/src/main.rs');
  assert.match(main, /if let \[mode\]=std::env::args\(\)\.skip\(1\)\.collect::<Vec<_>>\(\)\.as_slice\(\)\{\n\s+if mode=="--update-check"\|\|mode=="--update-check-due"\|\|mode=="--update-install"/);
  // The run executable starts the check that looks at its due time again under the check lock.
  assert.match(read('src-tauri/src/bin/run.rs'), /Command::new\(app\)\.arg\("--update-check-due"\)/);
  // Not due after all ends with its own exit code, which the run's record keeps apart from a check (GPT run-check GA2):
  // 4, which no other ending of the window app uses (GPT run-check-main GA3).
  assert.match(read('src-tauri/src/update.rs'), /pub const NOT_DUE_EXIT: i32 = 4;/);
  const endings = main.slice(main.indexOf('match outcome{'), main.indexOf('match outcome{') + 900);
  const codes = [...endings.matchAll(/(?:=>\s*|\);\s*)(-?\d+)\b/g)].map(m => Number(m[1]));
  assert.ok(codes.includes(3) && codes.includes(75) && !codes.includes(4), `the window app's other exit codes: ${codes}`);
  assert.match(main, /due_for\(&update::read\(&root\),epoch_ms\(\),own\.as_deref\(\)\)\{return Err\("NOT_DUE"\);\}/);
  assert.match(main, /Err\("NOT_DUE"\)=>\{println!\("\{\}",json!\(\{"ok":true,"result":\{"due":false\}\}\)\);update::NOT_DUE_EXIT\}/);
  assert.match(main, /let switches:&\[&str\]=if cfg!\(debug_assertions\)\{&\["--background","--test-mode","--smoke"\]\}else\{&\["--background"\]\};/);
  // The notice's click asks first (cancel is the first button), and installing holds the engine lock.
  assert.match(main, /OkCancelCustom\("나중에"\.into\(\),"업데이트"\.into\(\)\)/);
  assert.match(read('src-tauri/src/update.rs'), /let _engine = crate::platform::try_lock\(root, crate::platform::ENGINE_LOCK\)[^\n]+\.ok_or\("RUN_ACTIVE"\)\?;\n\s+let mut update = find\(app, DOWNLOAD_TIMEOUT, None\)/);
  // Only a signature the operating key does not verify is checked again, and only against the built-in recovery key.
  assert.match(read('src-tauri/src/update.rs'), /Err\(Error::Minisign\(_\)\) if recovery_key\(app\.config\(\)\.plugins\.0\.get\("synkUpdate"\)\)\.is_some\(\) => \{/);
});

// A minisign key pair and signature made with Node alone, the way `tauri signer sign` makes them (prehashed 「ED」).
function minisign() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519'), id = crypto.randomBytes(8);
  const raw = Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url');
  const pub = Buffer.from(`untrusted comment: minisign public key\n${Buffer.concat([Buffer.from('Ed'), id, raw]).toString('base64')}\n`).toString('base64');
  const sign = (file, version) => {
    const value = crypto.sign(null, crypto.createHash('blake2b512').update(fs.readFileSync(file)).digest(), privateKey);
    const comment = `timestamp:1794788230\tfile:${path.basename(file)}\tversion:${version}`;
    const global = crypto.sign(null, Buffer.concat([value, Buffer.from(comment)]), privateKey);
    return Buffer.from(`untrusted comment: signature from tauri secret key\n${Buffer.concat([Buffer.from('ED'), id, value]).toString('base64')}\ntrusted comment: ${comment}\n${global.toString('base64')}\n`).toString('base64');
  };
  return { pub, sign };
}

test('a signature counts only when a built-in key verifies the file and the version it names', () => {
  const keys = require('../scripts/update-keys.cjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swb-keys-'));
  try {
    const file = path.join(dir, 'SynkWorkBackup-0.7.2-setup.exe');
    fs.writeFileSync(file, crypto.randomBytes(50000));
    const operating = minisign(), recovery = minisign(), stranger = minisign();
    const builtIn = [{ role: 'operating', pub: operating.pub }, { role: 'recovery', pub: recovery.pub }];
    assert.equal(keys.whichKey(file, operating.sign(file, '0.7.2'), builtIn).role, 'operating');
    const byRecovery = keys.whichKey(file, recovery.sign(file, '0.7.2'), builtIn);
    assert.equal(byRecovery.role, 'recovery');
    assert.equal(byRecovery.comment.version, '0.7.2');
    assert.equal(keys.whichKey(file, stranger.sign(file, '0.7.2'), builtIn), null);
    // The trusted comment is covered: a version changed after signing fails the global signature.
    const forged = Buffer.from(Buffer.from(recovery.sign(file, '0.7.2'), 'base64').toString().replace('version:0.7.2', 'version:0.7.3')).toString('base64');
    assert.equal(keys.whichKey(file, forged, builtIn), null);
    const signed = operating.sign(file, '0.7.2');
    fs.appendFileSync(file, 'x');
    assert.equal(keys.whichKey(file, signed, builtIn), null);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

function signature({ version, file }) {
  const comment = ['timestamp:1794788230', `file:${file}`, ...(version ? [`version:${version}`] : [])].join('\t');
  // minisign's shape (ED, key id, signature; the 64-byte global signature), not a signature any key verifies.
  const raw = Buffer.concat([Buffer.from('ED'), Buffer.alloc(72, 7)]).toString('base64'), global = Buffer.alloc(64, 9).toString('base64');
  return Buffer.from(`untrusted comment: signature from tauri secret key\n${raw}\ntrusted comment: ${comment}\n${global}\n`).toString('base64');
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
  // SYNK 솔리오's engine install reads the same entry: the installer's size and SHA-256 (11-20).
  const bytes = fs.readFileSync(setup);
  for (const target of ['windows-x86_64-nsis', 'windows-x86_64']) {
    assert.equal(value.platforms[target].size, bytes.length, target);
    assert.equal(value.platforms[target].sha256, crypto.createHash('sha256').update(bytes).digest('hex'), target);
  }
  assert.equal(sha256, value.platforms['windows-x86_64-nsis'].sha256);
  // Where SYNK 솔리오 downloads from (STAGE1_DESIGN 4.10 「업데이트 자리」), or this PC for the clean-Windows exercise.
  assert.throws(() => feed({ setup, signature: sig, url: url.replace('unmet23-lab/synk-policy', 'someone/else') }), /download url must be https:\/\/github\.com\/unmet23-lab\/synk-policy\/releases\/download\/workbackup-0\.7\.1\//);
  assert.throws(() => feed({ setup, signature: sig, url: url.replace('https:', 'http:') }), /download url must be/);
  const local = 'http://127.0.0.1:8765/SynkWorkBackup-0.7.1-setup.exe';
  assert.throws(() => feed({ setup, signature: sig, url: local }), /download url must be/, 'this PC only when the exercise asks');
  assert.equal(feed({ setup, signature: sig, url: local, localTest: true }).feed.platforms['windows-x86_64'].url, local);
  assert.throws(() => feed({ setup, signature: sig, url: 'http://127.0.0.1:8765/nested/SynkWorkBackup-0.7.1-setup.exe', localTest: true }), /download url must be/);
  // A signature cut short, or one missing its global signature, is not minisign's whole.
  const whole = fs.readFileSync(sig, 'utf8');
  fs.writeFileSync(sig, whole.slice(0, -20));
  assert.throws(() => feed({ setup, signature: sig, url }), /not a whole minisign signature/);
  fs.writeFileSync(sig, Buffer.from(Buffer.from(whole, 'base64').toString('utf8').split('\n').slice(0, 3).join('\n')).toString('base64'));
  assert.throws(() => feed({ setup, signature: sig, url }), /not a whole minisign signature/);
  fs.writeFileSync(sig, whole);
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
  const padded = path.join(dir, 'SynkWorkBackup-0.07.1-setup.exe'); fs.copyFileSync(setup, padded);
  assert.throws(() => feed({ setup: padded, signature: sig, url }), /SynkWorkBackup-<version>-setup\.exe/, 'a version SYNK 솔리오 would refuse');
  fs.writeFileSync(setup, '');
  assert.throws(() => feed({ setup, signature: sig, url }), /installer must be 1 to/);
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

// Not skipped anywhere (an unregistered skip turns conditional-qa red): off Windows Node makes the junction a plain
// symbolic link, and both kinds are listed the same.
test('D0 special entries: a restore must leave out links and names ending in a dot, and say so', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swb-d0s-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const src = path.join(dir, 'src'), back = path.join(dir, 'back');
  data.make(src, 1); data.make(back, 1);
  // The two that need no right to make: the runner's administrator makes the symbolic links too (specials).
  fs.symlinkSync(path.join(src, '문서'), path.join(src, data.SPECIALS.junction), 'junction');
  fs.writeFileSync(path.join(src, data.SPECIALS.oddName), 'odd');
  const list = data.walk(src);
  assert.deepEqual(list.links, ['연결점'], 'a junction is listed as a link and not gone through');
  assert.ok(!Object.keys(list.files).some(f => f.startsWith('연결점/')));
  assert.ok(list.files[data.SPECIALS.oddName], 'a name ending in a dot is kept as named');
  // A restore without the two: every other file back, both left out.
  const good = data.compare(list, data.walk(back));
  assert.equal(good.ok, true, JSON.stringify(good));
  assert.deepEqual(good.leftOut, ['연결점', data.SPECIALS.oddName]);
  const said = item => [{ skipped: { count: item.length, items: item.map(name => ({ name: `C/work/src/${name}`, kind: 'link' })) } }];
  // The link is counted; the name ending in a dot never reached a Windows backup (restic 0.19.1, run 44152169842), so
  // the restore has nothing to count for it. Counting it means the backup changed: the expectation is to be turned.
  const kept = data.leftOutSaid(good.leftOut, said(['연결점']));
  assert.equal(kept.ok, true, JSON.stringify(kept));
  assert.deepEqual(kept.notBackedUp, [data.SPECIALS.oddName]);
  assert.deepEqual(data.leftOutSaid(good.leftOut, said(good.leftOut)).saidOdd, [data.SPECIALS.oddName], 'the odd name counted');
  assert.equal(data.leftOutSaid(good.leftOut, said(good.leftOut)).ok, false);
  assert.deepEqual(data.leftOutSaid(good.leftOut, []).unsaid, ['연결점'], 'a link the restore did not count');
  assert.equal(data.leftOutSaid(good.leftOut, []).ok, false);
  // The junction gone through (its folder restored as a copy) and the odd name restored are both wrong.
  fs.cpSync(path.join(back, '문서', '메모 0'), path.join(back, '연결점', '메모 0'), { recursive: true });
  fs.writeFileSync(path.join(back, data.SPECIALS.oddName), 'odd');
  const bad = data.compare(list, data.walk(back));
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.leftIn.sort(), ['연결점', data.SPECIALS.oddName].sort());
  assert.ok(bad.extra.some(f => f.startsWith('연결점/')));
  // Any link in the restore, under any name, and an odd name back as a folder are wrong too (GPT GA1).
  const listed = data.walk(back);
  for (const actual of [{ ...listed, links: ['새 링크'] }, { ...listed, links: [data.SPECIALS.oddName] }, { ...listed, dirs: [...listed.dirs, '폴더.'] }]) {
    const fresh = data.compare(list, { ...actual, files: Object.fromEntries(Object.entries(actual.files).filter(([f]) => !f.startsWith('연결점/') && f !== data.SPECIALS.oddName)), dirs: actual.dirs.filter(d => d !== '연결점' && !d.startsWith('연결점/')) });
    assert.equal(fresh.ok, false, JSON.stringify(actual.links));
    assert.equal(fresh.leftIn.length, 1);
  }
  // specials() itself, where this account may make symbolic links (the CI runner's administrator).
  const full = path.join(dir, 'full'); data.make(full, 1);
  try { data.specials(full); } catch (e) { if (e.code === 'EPERM') return t.diagnostic('no right to make symbolic links here: specials() is run on the runner'); throw e; }
  assert.deepEqual(data.walk(full).links, ['링크/메모 링크.txt', '링크/폴더 링크', '연결점']);
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

test('one version everywhere the app says what it is', () => {
  // SYNK 솔리오 reads update.json against the engine's APP_VERSION, and the server and the manifest get it too: a release
  // that moves one of these and not the rest would show a version already installed as an update (11-20 저녁 설계 검토).
  const version = JSON.parse(read('src-tauri/tauri.conf.json')).version;
  assert.match(version, /^[0-9]+\.[0-9]+\.[0-9]+$/);
  assert.equal(JSON.parse(read('package.json')).version, version, 'package.json');
  assert.equal(read('src-tauri/Cargo.toml').match(/^version = "([^"]+)"$/m)[1], version, 'Cargo.toml');
  assert.equal(require('../engine/src/account.cjs').APP_VERSION, version, 'engine APP_VERSION');
  assert.equal(read('scripts/stage-resources.cjs').match(/appVersion:'([^']+)'/)[1], version, 'resource manifest');
  const handlers = read('worker/handlers.cjs');
  assert.match(handlers, /\.\.\.profiles\.getState\(\),\s*version\s*:\s*APP_VERSION\b/, 'the window state says APP_VERSION');
  assert.doesNotMatch(handlers, /\bversion\s*:\s*['"`]/, 'and no version of its own');
});
