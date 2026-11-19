'use strict';
// 솔리오 「백업·복구」 입구(src/solio-backup.cjs)와 그 글(renderer/solio-backup-model.mjs)의 시험.
// 계약: experiences/solo-backup-rust/STAGE1_DESIGN.md 4.13. 엔진 쪽 요청 검사(engine/src/solio.cjs)로 우리가 쓴 요청을 직접 읽혀 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const B = require('../src/solio-backup.cjs');

const ROOT = path.join(__dirname, '..', '..');
const CONTRACT = path.join(ROOT, 'experiences', 'solo-backup-rust', 'contract', 'solio');
const engineSolio = require(path.join(ROOT, 'experiences', 'solo-backup-rust', 'engine', 'src', 'solio.cjs'));
const ME = { synk_user_id: 'test-owner-0001' };
const OTHER = { synk_user_id: 'someone-else-0002' };
const MINE = [crypto.createHash('sha256').update(B.PREVIEW_SALT + ME.synk_user_id).digest('hex')];
const SENTINEL = 'C:\\Users\\sentinel\\비밀 고객 폴더\\계약서.pdf';

function temp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'solio-backup-')); }
function appdata(dir, { status, space = true } = {}) {
  const solio = path.join(dir, 'SynkWorkBackup', 'solio');
  fs.mkdirSync(solio, { recursive: true });
  if (status !== undefined) fs.writeFileSync(path.join(solio, 'status.json'), typeof status === 'string' ? status : JSON.stringify(status));
  // 공간 보고서에는 경로가 있다. 이 모듈은 읽지 않아야 한다(4.13 「화면 쪽에 넘길 것」)
  if (space) fs.writeFileSync(path.join(solio, 'space.json'), JSON.stringify({ ...JSON.parse(fs.readFileSync(path.join(CONTRACT, 'space.sample.json'), 'utf8')), candidates: [{ n: 1, grade: 'auto', kind: 'cache', bytes: 1, reason: 'x', name: '고객 폴더', path: SENTINEL }] }));
  return { APPDATA: dir };
}
const sample = () => JSON.parse(fs.readFileSync(path.join(CONTRACT, 'status.sample.json'), 'utf8'));

/* 엔진 설치 확인의 가짜: 설치 폴더를 정하면 그 안에 WorkBackupRun.exe를 만든다 */
function fakeEngine(state) {
  return async () => {
    if (!state.dir) return '{}';
    return JSON.stringify({ loc: `"${state.dir}"`, ver: '0.7.0' });
  };
}
function engineDir() { const dir = temp(); fs.writeFileSync(path.join(dir, 'WorkBackupRun.exe'), 'x'); return dir; }

/* minisign 열쇠와 서명을 시험 안에서 만든다(Tauri signer와 같은 「ED」 꼴) */
function minisignKey() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const id = crypto.randomBytes(8), raw = publicKey.export({ format: 'jwk' }).x;
  const line = Buffer.concat([Buffer.from('Ed', 'latin1'), id, Buffer.from(raw, 'base64url')]).toString('base64');
  const pub = Buffer.from(`untrusted comment: minisign public key: ${id.toString('hex').toUpperCase()}\n${line}\n`).toString('base64');
  return { pub, sign(data, comment) {
    const blake = crypto.createHash('blake2b512').update(data).digest();
    const sig = crypto.sign(null, blake, privateKey);
    const global = crypto.sign(null, Buffer.concat([sig, Buffer.from(comment, 'utf8')]), privateKey);
    return Buffer.from(`untrusted comment: signature from tauri secret key\n${Buffer.concat([Buffer.from('ED', 'latin1'), id, sig]).toString('base64')}\ntrusted comment: ${comment}\n${global.toString('base64')}\n`).toString('base64');
  } };
}
function release(key, data, version = '0.7.0', patch = {}) {
  const name = `SynkWorkBackup-${version}-setup.exe`;
  const entry = { signature: key.sign(data, `timestamp:1794880000\tfile:${name}\tversion:${version}`), url: `https://github.com/unmet23-lab/synk-policy/releases/download/workbackup-${version}/${name}`, size: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex'), ...patch };
  return { version, notes: '', pub_date: '2026-11-20T00:00:00Z', platforms: { 'windows-x86_64-nsis': entry, 'windows-x86_64': entry } };
}
/* 피드 · 넘겨주기 · 설치 파일을 주는 가짜 HTTPS. 받은 주소와 머리글을 적어 둔다 */
function fakeNet({ feed = null, file = Buffer.alloc(0), seen = [] } = {}) {
  return async (url, options) => {
    seen.push({ url, options: JSON.stringify(options || {}) });
    if (url === B.FEED_URL) return feed ? { status: 200, headers: {}, body: Readable.from([Buffer.from(JSON.stringify(feed))]) } : { status: 404, headers: {}, body: Readable.from([]) };
    if (url.startsWith('https://github.com/')) return { status: 302, headers: { location: 'https://release-assets.githubusercontent.com/github-production-release-asset/1/setup' }, body: Readable.from([]) };
    if (url.startsWith('https://release-assets.githubusercontent.com/')) return { status: 200, headers: { 'content-length': String(file.length) }, body: Readable.from([file]) };
    return { status: 404, headers: {}, body: Readable.from([]) };
  };
}
/* 설치기를 쥐고 띄우는 일의 가짜. 띄우는 순간의 요청 폴더를 적고, 끝나면 엔진이 깔린 것으로 한다 */
function fakeHold(log, { outcome = 'exited', engineState, afterInstall } = {}) {
  return async file => {
    log.push(['hold', path.basename(file)]);
    return {
      finalPath: file, sha256: shaOf(file),
      release() { log.push(['release']); },
      async run(onStarted) {
        log.push(['run']);
        if (outcome === 'declined') return { outcome };
        onStarted();
        if (afterInstall) afterInstall();
        if (engineState) engineState.dir = engineDir();
        return { outcome, code: 0 };
      },
    };
  };
}
const shaOf = file => { try { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); } catch { return null; } };
const requestsIn = env => { const dir = path.join(env.APPDATA, 'SynkWorkBackup', 'solio', 'requests'); return fs.existsSync(dir) ? fs.readdirSync(dir).filter(n => !n.startsWith('.') && n !== 'claimed') : []; };

test('only the owner account sees the real entry; the built-in list keeps no account id in the source', async () => {
  assert.equal(B.previewAllowed(ME, MINE), true);
  assert.equal(B.previewAllowed(OTHER, MINE), false);
  assert.equal(B.previewAllowed(null, MINE), false);
  assert.equal(B.previewAllowed({ synk_user_id: '../x' }, MINE), false);
  assert.ok(B.PREVIEW_ACCOUNTS.length >= 1 && B.PREVIEW_ACCOUNTS.every(h => /^[a-f0-9]{64}$/.test(h)));
  const env = appdata(temp(), { status: sample() });
  const service = B.createSolioBackup({ platform: 'win32', env, run: fakeEngine({}), previewAccounts: MINE });
  assert.deepEqual(await service.snapshot(OTHER), { ok: true, available: false });
  assert.deepEqual(await service.start(OTHER, 'protect'), { ok: false, code: 'NOT_AVAILABLE' });
  assert.deepEqual(await service.open(OTHER, 'restore'), { ok: false, code: 'NOT_AVAILABLE' });
});

test('the status file is read with known fields only; a newer format and broken files are told apart', async () => {
  const known = B.normalizeStatus({ ...sample(), path: SENTINEL, folderNames: ['x'] });
  assert.equal(known.format, 'ok');
  assert.deepEqual(Object.keys(known.status).sort(), ['attention', 'bytes', 'engine', 'folders', 'job', 'lastBackupAt', 'nextRunAt', 'proof', 'state', 'writer', 'writtenAt']);
  assert.equal(known.status.state, 'safe');
  assert.equal(B.normalizeStatus({ ...sample(), v: 2 }).format, 'newer');
  assert.equal(B.normalizeStatus({ v: 'one' }).format, 'invalid');
  assert.equal(B.normalizeStatus({ ...sample(), state: 'exploded', attention: ['space', 'nope', 'status'] }).status.state, 'unknown');
  assert.deepEqual(B.normalizeStatus({ ...sample(), attention: ['space', 'nope', 'status'] }).status.attention, ['status', 'space']);
  const dir = temp();
  assert.equal((await B.readStatus(path.join(dir, 'none.json'))).format, 'missing');
  fs.writeFileSync(path.join(dir, 'big.json'), '{"v":1,"x":"' + 'a'.repeat(70000) + '"}');
  assert.equal((await B.readStatus(path.join(dir, 'big.json'))).format, 'invalid');
  fs.writeFileSync(path.join(dir, 'bad.json'), '{');
  assert.equal((await B.readStatus(path.join(dir, 'bad.json'))).format, 'invalid');
});

test('the screen picks one view: Mac, no engine, engine removed, set-up, newer format, checking, status', () => {
  const ok = { format: 'ok', status: B.normalizeStatus(sample()).status };
  const next = Date.parse(ok.status.nextRunAt);
  const at = (read, engine, now = next, platform = 'win32') => B.decideView({ platform, engine: { installed: engine }, read, now });
  assert.equal(at(ok, true, next, 'darwin'), 'windows-only');
  assert.equal(at({ format: 'missing' }, false), 'no-engine');
  assert.equal(at(ok, false), 'engine-removed', 'an old safe never shows once the engine is gone');
  assert.equal(at({ format: 'newer' }, false), 'engine-removed');
  assert.equal(at({ format: 'missing' }, true), 'needs-setup');
  assert.equal(at({ format: 'ok', status: { ...ok.status, state: 'restore-only' } }, true), 'needs-setup');
  assert.equal(at({ format: 'ok', status: { ...ok.status, state: 'not-set-up' } }, true), 'needs-setup');
  assert.equal(at({ format: 'newer' }, true), 'engine-newer');
  assert.equal(at(ok, true, next + B.CHECKING_AFTER + 60000), 'checking');
  assert.equal(at(ok, true, next + B.CHECKING_AFTER - 60000), 'status');
});

test('the engine counts as installed only with the HKLM uninstall entry and WorkBackupRun.exe in its folder', async () => {
  const dir = engineDir();
  assert.deepEqual(await B.readEngine({ run: async () => JSON.stringify({ loc: `"${dir}"`, ver: '0.7.0' }) }), { installed: true, version: '0.7.0' });
  assert.equal((await B.readEngine({ run: async () => '{}' })).installed, false);
  assert.equal((await B.readEngine({ run: async () => JSON.stringify({ loc: temp(), ver: '0.7.0' }) })).installed, false, 'the entry without the runner is not an engine');
  assert.equal((await B.readEngine({ run: async () => JSON.stringify({ loc: 'relative\\dir' }) })).installed, false);
  assert.equal((await B.readEngine({ run: async () => null })).installed, false);
  assert.match(B.ENGINE_SCRIPT, /Registry64/);
  assert.doesNotMatch(B.ENGINE_SCRIPT, /업무 백업/, 'the Korean key name goes through the environment, not the command line');
});

test('the setup request is the engine contract exactly: the engine validates it, and only an address-shaped hint goes in', async () => {
  const env = appdata(temp());
  const paths = B.statusPaths(env), now = Date.now();
  const name = await B.writeSetupRequest({ paths, mode: 'protect', hint: 'owner@example.com', now });
  assert.match(name, engineSolio.NAME);
  const body = JSON.parse(fs.readFileSync(path.join(paths.requests, name), 'utf8'));
  assert.deepEqual(engineSolio.validate(body, { at: now, now }), { ok: true, value: { kind: 'setup', mode: 'protect', hint: 'owner@example.com', at: now } });
  const other = await B.writeSetupRequest({ paths, mode: 'move', hint: 'not an address', now });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(paths.requests, other), 'utf8')), { v: 1, kind: 'setup', mode: 'move' });
  assert.deepEqual(fs.readdirSync(paths.requests).filter(n => n.endsWith('.tmp')), [], 'no half-written file is left');
  await assert.rejects(B.writeSetupRequest({ paths, mode: 'delete-everything' }), /INVALID/);
});

test('the feed must name this version and file, and the signature must be one of the engine keys', () => {
  const key = minisignKey(), data = crypto.randomBytes(4096);
  const feed = B.validateFeed(release(key, data));
  assert.equal(feed.version, '0.7.0');
  const parsed = B.parseSignature(feed.signature), blake = crypto.createHash('blake2b512').update(data).digest();
  assert.equal(B.verifySignature(blake, parsed, [{ role: 'operating', pub: key.pub }]), 'operating');
  assert.equal(B.verifySignature(crypto.createHash('blake2b512').update(Buffer.from('other')).digest(), parsed, [{ role: 'operating', pub: key.pub }]), null);
  assert.equal(B.verifySignature(blake, parsed, B.ENGINE_KEYS), null, 'a key the engine does not carry is refused');
  assert.throws(() => B.validateFeed(release(key, data, '0.7.0', { url: 'https://evil.example/SynkWorkBackup-0.7.0-setup.exe' })), /FEED_INVALID/);
  assert.throws(() => B.validateFeed(release(key, data, '0.7.0', { sha256: 'x' })), /FEED_INVALID/);
  const wrong = release(key, data); wrong.version = '0.7.1';
  assert.throws(() => B.validateFeed(wrong), /FEED_INVALID/, 'the signed comment names another version');
});

test('the built-in keys are the engine updater keys', () => {
  const conf = JSON.parse(fs.readFileSync(path.join(ROOT, 'experiences', 'solo-backup-rust', 'src-tauri', 'tauri.conf.json'), 'utf8'));
  assert.deepEqual(B.ENGINE_KEYS.map(k => k.pub), [conf.plugins.updater.pubkey, conf.plugins.synkUpdate.recoveryPubkey]);
  assert.equal(conf.plugins.updater.endpoints[0], B.FEED_URL);
  for (const k of B.ENGINE_KEYS) assert.doesNotThrow(() => B.publicKey(k.pub));
});

test('「보호 시작」 downloads, holds, verifies, writes the setup request, then runs the installer while still holding it', async () => {
  const key = minisignKey(), data = crypto.randomBytes(20000), log = [], engineState = {};
  const env = appdata(temp()), cacheRoot = temp();
  let atRun = null;
  const service = B.createSolioBackup({
    platform: 'win32', env, cacheRoot, run: fakeEngine(engineState), request: fakeNet({ feed: release(key, data), file: data }),
    hold: fakeHold(log, { engineState, afterInstall: () => { atRun = requestsIn(env); } }), keys: [{ role: 'operating', pub: key.pub }], previewAccounts: MINE,
  });
  assert.equal((await service.snapshot(ME)).view, 'no-engine');
  assert.deepEqual(await service.start(ME, 'protect', { getHint: async () => 'owner@example.com' }), { ok: true });
  await service.whenIdle();
  const after = await service.snapshot(ME);
  assert.equal(after.install.phase, 'done', JSON.stringify(after.install));
  assert.deepEqual(log.map(x => x[0]), ['hold', 'run']);
  assert.equal(atRun.length, 1, 'the setup request is there before the installer starts');
  const body = JSON.parse(fs.readFileSync(path.join(env.APPDATA, 'SynkWorkBackup', 'solio', 'requests', atRun[0]), 'utf8'));
  assert.deepEqual(body, { v: 1, kind: 'setup', mode: 'protect', hint: 'owner@example.com' });
  assert.deepEqual(fs.readdirSync(cacheRoot), [], 'the download folder is removed after the install');
  assert.equal(after.engine.installed, true);
});

test('a file that does not match is never run, and no setup request is left', async () => {
  const key = minisignKey(), data = crypto.randomBytes(20000), log = [];
  const env = appdata(temp()), cacheRoot = temp();
  const tampered = Buffer.from(data); tampered[5] ^= 1;
  const service = B.createSolioBackup({ platform: 'win32', env, cacheRoot, run: fakeEngine({}), request: fakeNet({ feed: release(key, data), file: tampered }), hold: fakeHold(log), keys: [{ role: 'operating', pub: key.pub }], previewAccounts: MINE });
  await service.start(ME, 'protect');
  await service.whenIdle();
  const snap = await service.snapshot(ME);
  assert.deepEqual([snap.install.phase, snap.install.code, snap.install.mode], ['error', 'VERIFY_FAILED', 'protect']);
  assert.deepEqual(log.map(x => x[0]), ['hold', 'release'], 'held, checked, released — never run');
  assert.deepEqual(requestsIn(env), []);
  assert.deepEqual(fs.readdirSync(cacheRoot), []);
});

test('a refused administrator prompt removes the setup request; a missing feed says it cannot be had yet', async () => {
  const key = minisignKey(), data = crypto.randomBytes(1000), log = [];
  const env = appdata(temp());
  const declined = B.createSolioBackup({ platform: 'win32', env, cacheRoot: temp(), run: fakeEngine({}), request: fakeNet({ feed: release(key, data), file: data }), hold: fakeHold(log, { outcome: 'declined' }), keys: [{ role: 'operating', pub: key.pub }], previewAccounts: MINE });
  await declined.start(ME, 'move');
  await declined.whenIdle();
  assert.equal((await declined.snapshot(ME)).install.code, 'DECLINED');
  assert.deepEqual(requestsIn(env), []);
  const missing = B.createSolioBackup({ platform: 'win32', env: appdata(temp()), cacheRoot: temp(), run: fakeEngine({}), request: fakeNet({ feed: null }), hold: fakeHold([]), previewAccounts: MINE });
  await missing.snapshot(ME);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal((await missing.snapshot(ME)).feed.state, 'missing');
  await missing.start(ME, 'protect');
  await missing.whenIdle();
  assert.equal((await missing.snapshot(ME)).install.code, 'FEED_MISSING');
});

test('with the engine installed but no status, 「보호 시작」 writes only the setup request and opens the engine window', async () => {
  const opened = [], env = appdata(temp()), hold = async () => { throw Error('must not download'); };
  const service = B.createSolioBackup({ platform: 'win32', env, run: fakeEngine({ dir: engineDir() }), request: async () => { throw Error('no network'); }, hold, openExternal: async url => opened.push(url), previewAccounts: MINE });
  assert.equal((await service.snapshot(ME)).view, 'needs-setup');
  await service.start(ME, 'protect');
  await service.whenIdle();
  assert.deepEqual(opened, ['synk-workbackup:open?topic=status']);
  assert.equal(requestsIn(env).length, 1);
  assert.equal((await service.snapshot(ME)).install.phase, 'opened');
  assert.deepEqual(await service.open(ME, 'restore'), { ok: true });
  assert.deepEqual(await service.open(ME, 'move'), { ok: true });
  assert.deepEqual(await service.open(ME, 'open?topic=x'), { ok: false, code: 'INVALID' });
  assert.deepEqual(opened.slice(1), ['synk-workbackup:open?topic=restore', 'synk-workbackup:open?topic=move']);
  assert.deepEqual(B.OPEN_TOPICS, ['status', 'folders', 'changes', 'devices', 'restore', 'space', 'signin', 'update', 'move'], 'the nine words of the engine (notify.rs TOPICS)');
});

test('the space report paths never leave: not read, not in answers, logs, errors or network requests', async () => {
  const key = minisignKey(), data = crypto.randomBytes(500), seen = [], said = [];
  const keep = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  for (const k of Object.keys(keep)) console[k] = (...args) => said.push(args.map(String).join(' '));
  try {
    for (const status of [sample(), { ...sample(), v: 2 }, undefined]) {
      const env = appdata(temp(), { status });
      const engineState = { dir: status ? engineDir() : null };
      const service = B.createSolioBackup({ platform: 'win32', env, cacheRoot: temp(), run: fakeEngine(engineState), request: fakeNet({ feed: release(key, data), file: data, seen }), hold: fakeHold([], { engineState }), keys: [{ role: 'operating', pub: key.pub }], openExternal: async url => said.push(url), previewAccounts: MINE });
      const answers = [await service.snapshot(ME), await service.start(ME, 'protect'), await service.whenIdle(), await service.snapshot(ME), await service.open(ME, 'space'), await service.snapshot(ME)];
      const text = JSON.stringify(answers);
      assert.ok(!text.includes('sentinel') && !text.includes('고객 폴더'), text);
      assert.ok(!text.includes(env.APPDATA.replace(/\\/g, '\\\\')), 'no local path in answers');
    }
  } finally { Object.assign(console, keep); }
  const everything = JSON.stringify([seen, said]);
  assert.ok(!everything.includes('sentinel') && !everything.includes('고객 폴더'));
  assert.ok(seen.every(r => r.url === B.FEED_URL || r.url.startsWith('https://github.com/unmet23-lab/synk-policy/releases/download/') || r.url.startsWith('https://release-assets.githubusercontent.com/')), 'only the feed and the installer are fetched');
  for (const file of ['src/solio-backup.cjs', 'renderer/solio-backup-model.mjs']) {
    const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    assert.doesNotMatch(src, /space\.json|space-report|candidates/, `${file} does not touch the space report`);
  }
});

test('the screen words: one urgent sentence first, safe only when safe, buttons only from the fixed words', async () => {
  const { solioBackupView } = await import('../renderer/solio-backup-model.mjs');
  const base = { ok: true, available: true, engine: { installed: true, version: '0.7.0' }, feed: { state: 'available' }, install: { phase: 'idle' } };
  const status = B.normalizeStatus(sample()).status, now = Date.parse(status.writtenAt);
  const views = {
    off: solioBackupView({ ok: true, available: false }),
    mac: solioBackupView({ ...base, view: 'windows-only' }, now),
    none: solioBackupView({ ...base, view: 'no-engine', engine: { installed: false } }, now),
    missing: solioBackupView({ ...base, view: 'no-engine', engine: { installed: false }, feed: { state: 'missing' } }, now),
    removed: solioBackupView({ ...base, view: 'engine-removed', engine: { installed: false } }, now),
    setup: solioBackupView({ ...base, view: 'needs-setup', status: null }, now),
    newer: solioBackupView({ ...base, view: 'engine-newer', status: null }, now),
    checking: solioBackupView({ ...base, view: 'checking', status }, now),
    safe: solioBackupView({ ...base, view: 'status', status }, now),
    attention: solioBackupView({ ...base, view: 'status', status: { ...status, state: 'attention', attention: ['signin'] } }, now),
    admin: solioBackupView({ ...base, view: 'no-engine', engine: { installed: false }, install: { phase: 'admin' } }, now),
    failed: solioBackupView({ ...base, view: 'no-engine', engine: { installed: false }, install: { phase: 'error', code: 'VERIFY_FAILED', mode: 'move' } }, now),
  };
  assert.equal(views.off.visible, false);
  for (const [name, v] of Object.entries(views)) {
    if (name === 'off') continue;
    assert.ok(v.visible && typeof v.say === 'string' && v.say.length > 5 && !/\n/.test(v.say), name);
    assert.equal((v.say.match(/[.!?]\s/g) || []).length, 0, `${name}: the top line is one sentence`);
    for (const a of v.acts) assert.ok(['backup-start', 'backup-open', 'backup-dismiss'].includes(a.act) && (a.act !== 'backup-open' || B.OPEN_TOPICS.includes(a.arg)) && (a.act !== 'backup-start' || ['protect', 'move'].includes(a.arg)), `${name}: ${JSON.stringify(a)}`);
    if (name !== 'safe') assert.doesNotMatch(v.say, /지키고 있습니다/, `${name} never says safe`);
  }
  assert.match(views.safe.say, /업무 폴더 4개를 지키고 있습니다/);
  assert.match(views.mac.say, /Windows/);
  assert.deepEqual(views.none.acts.map(a => [a.label, a.arg]), [['보호 시작', 'protect'], ['이 PC로 옮겨 오기', 'move']]);
  assert.equal(views.missing.acts[0].disabled, true);
  assert.match(views.missing.note, /아직 받을 수 없음/);
  assert.match(views.removed.say, /지워져서/);
  assert.match(views.newer.then, /솔리오.*업데이트/);
  assert.match(views.checking.say, /확인하는 중/);
  assert.deepEqual(views.attention.acts[0], { label: '엔진 창에서 확인', act: 'backup-open', arg: 'signin', primary: true });
  assert.deepEqual(views.safe.acts.map(a => a.arg), ['restore', 'move', 'status']);
  assert.deepEqual(views.failed.acts[0], { label: '다시 받기', act: 'backup-start', arg: 'move', primary: true });
  assert.ok(views.admin.busy);
});

test('a real hold on Windows: while held nobody can write, rename or delete the file, but reading works', { skip: process.platform !== 'win32' }, async () => {
  const dir = temp(), file = path.join(dir, 'SynkWorkBackup-0.7.0-setup.exe');
  fs.writeFileSync(file, 'original bytes');
  const holder = await B.holdSetup(file);
  try {
    assert.equal(holder.finalPath.replace(/^\\\\\?\\/, '').toLowerCase(), fs.realpathSync.native(file).toLowerCase(), 'the holder names the file its handle really holds');
    assert.equal(fs.readFileSync(file, 'utf8'), 'original bytes');
    assert.throws(() => fs.writeFileSync(file, 'swapped'), /EBUSY|EPERM|EACCES/);
    assert.throws(() => fs.renameSync(file, file + '.x'), /EBUSY|EPERM|EACCES/);
    assert.throws(() => fs.unlinkSync(file), /EBUSY|EPERM|EACCES/);
    assert.throws(() => fs.renameSync(dir, dir + '-moved'), /EBUSY|EPERM|EACCES/, 'the folder holding it cannot be moved away either');
    const digest = await B.digestFile(file, 1000);
    assert.equal(digest.sha256, crypto.createHash('sha256').update('original bytes').digest('hex'));
    assert.equal(holder.sha256, digest.sha256, 'the holder hashes the bytes through its own handle');
  } finally { holder.release(); }
  for (let i = 0; i < 50; i++) { try { fs.unlinkSync(file); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
  assert.equal(fs.existsSync(file), false, 'released after QUIT');
});

/* ── 설계 검토(Fable 5.2, 11-20) 지적의 시험 ── */
const quiet = { wait: async () => {} };

test('P1: two quick presses start one install only', async () => {
  const key = minisignKey(), data = crypto.randomBytes(1000), log = [], engineState = {};
  const run = async () => { await new Promise(r => setTimeout(r, 200)); return engineState.dir ? JSON.stringify({ loc: `"${engineState.dir}"`, ver: '0.7.0' }) : '{}'; };
  const service = B.createSolioBackup({ platform: 'win32', env: appdata(temp()), cacheRoot: temp(), run, request: fakeNet({ feed: release(key, data), file: data }), hold: fakeHold(log, { engineState }), keys: [{ role: 'operating', pub: key.pub }], previewAccounts: MINE, ...quiet });
  const answers = await Promise.all([service.start(ME, 'protect'), service.start(ME, 'protect')]);
  await service.whenIdle();
  assert.deepEqual(answers.map(a => a.ok), [true, false]);
  assert.equal(answers[1].code, 'BUSY');
  assert.equal(log.filter(x => x[0] === 'run').length, 1);
});

test('P1: a folder swapped for a junction after the hold is caught before anything runs', { skip: process.platform !== 'win32' }, async () => {
  const key = minisignKey(), data = crypto.randomBytes(1000), log = [], other = temp();
  fs.writeFileSync(path.join(other, 'SynkWorkBackup-0.7.0-setup.exe'), data);
  const hold = async file => {
    // 쥔 척하는 가짜라 실제로 막지 않는다. 쥔 뒤 담은 폴더를 다른 폴더로 가는 연결점으로 바꾼다
    const dir = path.dirname(file);
    fs.renameSync(dir, dir + '-gone');
    fs.symlinkSync(other, dir, 'junction');
    log.push(['hold']);
    return { finalPath: file, sha256: shaOf(file), release() { log.push(['release']); }, async run() { log.push(['run']); return { outcome: 'exited', code: 0 }; } };
  };
  const env = appdata(temp());
  const service = B.createSolioBackup({ platform: 'win32', env, cacheRoot: temp(), run: fakeEngine({}), request: fakeNet({ feed: release(key, data), file: data }), hold, keys: [{ role: 'operating', pub: key.pub }], previewAccounts: MINE, ...quiet });
  await service.start(ME, 'protect');
  await service.whenIdle();
  assert.equal((await service.snapshot(ME)).install.code, 'VERIFY_FAILED');
  assert.deepEqual(log.map(x => x[0]), ['hold', 'release']);
  assert.deepEqual(requestsIn(env), []);
});

test('a cache folder that is itself a junction is resolved before the download folder is made', { skip: process.platform !== 'win32' }, async () => {
  const key = minisignKey(), data = crypto.randomBytes(1000), engineState = {}, real = temp(), link = path.join(temp(), 'cache');
  fs.symlinkSync(real, link, 'junction');
  let heldAt = null;
  const inner = fakeHold([], { engineState });
  const service = B.createSolioBackup({ platform: 'win32', env: appdata(temp()), cacheRoot: link, run: fakeEngine(engineState), request: fakeNet({ feed: release(key, data), file: data }), hold: async file => { heldAt = file; return inner(file); }, keys: [{ role: 'operating', pub: key.pub }], previewAccounts: MINE, ...quiet });
  await service.start(ME, 'protect');
  await service.whenIdle();
  assert.equal((await service.snapshot(ME)).install.phase, 'done');
  assert.ok(heldAt.toLowerCase().startsWith(fs.realpathSync.native(real).toLowerCase()), heldAt);
});

test('P2: a failed engine check is not 「no engine」 and does not reinstall', async () => {
  const env = appdata(temp(), { status: sample() });
  const service = B.createSolioBackup({ platform: 'win32', env, run: async () => null, previewAccounts: MINE, ...quiet });
  assert.equal((await service.snapshot(ME)).view, 'engine-unknown');
  assert.deepEqual(await service.start(ME, 'protect'), { ok: false, code: 'ENGINE_UNKNOWN' });
  let calls = 0, t = 0;
  const dir = engineDir();
  const kept = B.createSolioBackup({ platform: 'win32', env, run: async () => (++calls === 1 ? JSON.stringify({ loc: `"${dir}"`, ver: '0.7.0' }) : null), previewAccounts: MINE, now: () => (t += 120000) });
  assert.equal((await kept.snapshot(ME)).engine.installed, true);
  assert.equal((await kept.snapshot(ME)).engine.installed, true, 'a later failed check keeps the earlier answer');
  assert.equal(calls, 2);
});

test('P2: an unreadable status file with the engine installed opens the engine instead of offering 보호 시작', async () => {
  const env = appdata(temp(), { status: '{' });
  const service = B.createSolioBackup({ platform: 'win32', env, run: fakeEngine({ dir: engineDir() }), previewAccounts: MINE });
  assert.equal((await service.snapshot(ME)).view, 'status-unreadable');
  assert.deepEqual(await service.start(ME, 'protect'), { ok: false, code: 'NOT_NEEDED' });
  const { solioBackupView } = await import('../renderer/solio-backup-model.mjs');
  const v = solioBackupView(await service.snapshot(ME));
  assert.match(v.say, /읽지 못했습니다/);
  assert.equal(v.acts[0].arg, 'status');
});

test('P2: if the holder dies after the installer started, the request stays and the engine is looked for again', async () => {
  const key = minisignKey(), data = crypto.randomBytes(1000), env = appdata(temp()), engineState = {};
  const hold = async file => ({ finalPath: file, sha256: shaOf(file), release() {}, async run(onStarted) { onStarted(); setTimeout(() => { engineState.dir = engineDir(); }, 5); return { outcome: 'gone' }; } });
  const service = B.createSolioBackup({ platform: 'win32', env, cacheRoot: temp(), run: fakeEngine(engineState), request: fakeNet({ feed: release(key, data), file: data }), hold, keys: [{ role: 'operating', pub: key.pub }], previewAccounts: MINE, wait: () => new Promise(r => setTimeout(r, 20)) });
  await service.start(ME, 'protect');
  await service.whenIdle();
  assert.equal((await service.snapshot(ME)).install.code, 'INSTALL_UNCONFIRMED', 'not 「done」 without the exit code (GPT 다시 검수 GA4)');
  assert.equal(requestsIn(env).length, 1);
});

test('the installer download refuses an unknown redirect and a wrong length', async () => {
  const key = minisignKey(), data = crypto.randomBytes(1000);
  const net = patch => async url => {
    if (url === B.FEED_URL) return { status: 200, headers: {}, body: Readable.from([Buffer.from(JSON.stringify(release(key, data)))]) };
    if (url.startsWith('https://github.com/')) return { status: 302, headers: { location: patch.location }, body: Readable.from([]) };
    return { status: 200, headers: { 'content-length': String(patch.length ?? data.length) }, body: Readable.from([data]) };
  };
  const cases = [[{ location: 'https://evil.example/github-production-release-asset/1' }, 'UNTRUSTED_REDIRECT'], [{ location: 'https://release-assets.githubusercontent.com/github-production-release-asset/1', length: 5 }, 'VERIFY_FAILED']];
  for (const [patch, code] of cases) {
    const service = B.createSolioBackup({ platform: 'win32', env: appdata(temp()), cacheRoot: temp(), run: fakeEngine({}), request: net(patch), hold: fakeHold([]), keys: [{ role: 'operating', pub: key.pub }], previewAccounts: MINE, ...quiet });
    await service.start(ME, 'protect');
    await service.whenIdle();
    assert.equal((await service.snapshot(ME)).install.code, code);
  }
});

test('P2: safe with attention words leads with them; the engine-present failures have their own words', async () => {
  const { solioBackupView } = await import('../renderer/solio-backup-model.mjs');
  const status = { ...B.normalizeStatus(sample()).status, attention: ['update'] };
  const base = { ok: true, available: true, engine: { installed: true }, feed: {}, install: { phase: 'idle' } };
  const v = solioBackupView({ ...base, view: 'status', status });
  assert.match(v.then, /엔진 업데이트/);
  assert.deepEqual([v.acts[0].arg, v.note], ['update', '확인 필요']);
  const failed = solioBackupView({ ...base, view: 'needs-setup', status: null, install: { phase: 'error', code: 'OPEN_FAILED', mode: 'protect' } });
  assert.match(failed.say, /엔진 창을 열지 못했습니다/);
  assert.equal(failed.acts[0].label, '다시 하기');
});

/* ── GPT 검수(GA) · 카본 검수(A) 지적의 시험(11-20) ── */
test('GA1: a holder whose handle points elsewhere is never run', async () => {
  const key = minisignKey(), data = crypto.randomBytes(500), log = [], env = appdata(temp());
  const hold = async () => ({ finalPath: path.join(temp(), 'elsewhere.exe'), release() { log.push('release'); }, async run() { log.push('run'); return { outcome: 'exited', code: 0 }; } });
  const service = B.createSolioBackup({ platform: 'win32', env, cacheRoot: temp(), run: fakeEngine({}), request: fakeNet({ feed: release(key, data), file: data }), hold, keys: [{ role: 'operating', pub: key.pub }], previewAccounts: MINE, ...quiet });
  await service.start(ME, 'protect'); await service.whenIdle();
  assert.equal((await service.snapshot(ME)).install.code, 'VERIFY_FAILED');
  assert.deepEqual(log, ['release']);
});

test('GA2: the hint is asked for the account that pressed the button', async () => {
  const asked = [], env = appdata(temp());
  const service = B.createSolioBackup({ platform: 'win32', env, run: fakeEngine({ dir: engineDir() }), openExternal: async () => {}, previewAccounts: MINE });
  await service.start(ME, 'protect', { getHint: async account => { asked.push(account); return null; } });
  await service.whenIdle();
  assert.deepEqual(asked, [ME]);
  const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.cjs'), 'utf8');
  assert.ok(main.includes('result.accountId!==account.synk_user_id)return null'), 'main gives no hint once another account is signed in');
});

test('GA3: an installer that exits with an error is not 「done」 even if an engine is there', async () => {
  const key = minisignKey(), data = crypto.randomBytes(500), engineState = { dir: null }, env = appdata(temp());
  const hold = async file => ({ finalPath: file, sha256: shaOf(file), release() {}, async run(onStarted) { onStarted(); engineState.dir = engineDir(); return { outcome: 'exited', code: 2 }; } });
  const service = B.createSolioBackup({ platform: 'win32', env, cacheRoot: temp(), run: fakeEngine(engineState), request: fakeNet({ feed: release(key, data), file: data }), hold, keys: [{ role: 'operating', pub: key.pub }], previewAccounts: MINE, ...quiet });
  await service.start(ME, 'protect'); await service.whenIdle();
  assert.equal((await service.snapshot(ME)).install.code, 'INSTALL_STOPPED');
  assert.deepEqual(requestsIn(env), [], 'the request of a failed install is removed');
});

test('GA4: an engine that appeared while downloading is opened, not installed again', async () => {
  const key = minisignKey(), data = crypto.randomBytes(500), engineState = { dir: null }, env = appdata(temp()), log = [], opened = [];
  const hold = async file => { engineState.dir = engineDir(); return { finalPath: file, sha256: shaOf(file), release() { log.push('release'); }, async run() { log.push('run'); return { outcome: 'exited', code: 0 }; } }; };
  const service = B.createSolioBackup({ platform: 'win32', env, cacheRoot: temp(), run: fakeEngine(engineState), request: fakeNet({ feed: release(key, data), file: data }), hold, openExternal: async url => opened.push(url), keys: [{ role: 'operating', pub: key.pub }], previewAccounts: MINE, ...quiet });
  await service.start(ME, 'move'); await service.whenIdle();
  assert.equal((await service.snapshot(ME)).install.phase, 'opened');
  assert.deepEqual(log, ['release']);
  assert.deepEqual(opened, ['synk-workbackup:open?topic=move']);
  assert.equal(requestsIn(env).length, 1);
});

test('GA7: a failed engine-window open leaves no setup request behind', async () => {
  const env = appdata(temp());
  const service = B.createSolioBackup({ platform: 'win32', env, run: fakeEngine({ dir: engineDir() }), openExternal: async () => { throw Error('no handler'); }, previewAccounts: MINE });
  await service.start(ME, 'protect'); await service.whenIdle();
  assert.equal((await service.snapshot(ME)).install.code, 'OPEN_FAILED');
  assert.deepEqual(requestsIn(env), []);
});

test('GA5: a status file reached through a junction is not read', { skip: process.platform !== 'win32' }, async () => {
  const real = temp(); fs.writeFileSync(path.join(real, 'status.json'), JSON.stringify(sample()));
  const link = path.join(temp(), 'solio'); fs.symlinkSync(real, link, 'junction');
  assert.equal((await B.readStatus(path.join(link, 'status.json'))).format, 'invalid');
  assert.equal((await B.readStatus(path.join(real, 'status.json'))).format, 'ok');
});

test('A2 · A3 · A4 · A5: move opens the move screen, 「매시간」 only while running, proof words read right, unknown topics never sent', async () => {
  const { solioBackupView } = await import('../renderer/solio-backup-model.mjs');
  const base = { ok: true, available: true, engine: { installed: true }, feed: {}, install: { phase: 'idle' } };
  const opened = solioBackupView({ ...base, view: 'needs-setup', status: null, install: { phase: 'opened', mode: 'move' } });
  assert.equal(opened.acts[0].arg, 'move');
  const done = solioBackupView({ ...base, view: 'no-engine', install: { phase: 'done', mode: 'move' } });
  assert.match(done.then, /옮겨 오기/);
  const st = B.normalizeStatus(sample()).status;
  const notes = v => JSON.stringify(v.rows);
  assert.doesNotMatch(notes(solioBackupView({ ...base, view: 'status', status: { ...st, state: 'off' } })), /매시간/);
  assert.doesNotMatch(notes(solioBackupView({ ...base, view: 'status', status: { ...st, state: 'paused' } })), /매시간/);
  assert.doesNotMatch(notes(solioBackupView({ ...base, view: 'needs-setup', status: null })), /매시간/);
  assert.match(notes(solioBackupView({ ...base, view: 'status', status: st })), /매시간/);
  const failed = solioBackupView({ ...base, view: 'status', status: { ...st, proof: { at: st.proof.at, result: 'failed' } } });
  assert.match(failed.then, /증명 결과는 「실패」입니다/);
  assert.doesNotMatch(failed.then, /실패이라|undefined/);
  const unknown = solioBackupView({ ...base, view: 'status', status: { ...st, state: 'attention', attention: ['new-topic', 'signin'] } });
  assert.equal(unknown.acts[0].arg, 'signin');
});

/* ── GPT 다시 검수 · Fable 최종 검수 지적의 시험(11-20) ── */
test('GPT GA1 (again): a real hold reports a Korean path intact', { skip: process.platform !== 'win32' }, async () => {
  const dir = path.join(temp(), '한글 폴더'); fs.mkdirSync(dir);
  const file = path.join(dir, 'SynkWorkBackup-0.7.0-setup.exe'); fs.writeFileSync(file, 'x');
  const holder = await B.holdSetup(file);
  try { assert.equal(holder.finalPath.replace(/^\\\\\?\\/, ''), fs.realpathSync.native(file)); }
  finally { await holder.release(); }
});

test('GPT GA3 (again): the request keeps no hint once another account is signed in', async () => {
  const key = minisignKey(), data = crypto.randomBytes(500), engineState = {}, env = appdata(temp());
  let current = true;
  const service = B.createSolioBackup({ platform: 'win32', env, cacheRoot: temp(), run: fakeEngine(engineState), request: fakeNet({ feed: release(key, data), file: data }),
    hold: async file => { current = false; return fakeHold([], { engineState })(file); }, keys: [{ role: 'operating', pub: key.pub }], previewAccounts: MINE, ...quiet });
  let written = null;
  const watch = setInterval(() => { const names = requestsIn(env); if (names[0] && !written) written = JSON.parse(fs.readFileSync(path.join(env.APPDATA, 'SynkWorkBackup', 'solio', 'requests', names[0]), 'utf8')); }, 1);
  await service.start(ME, 'protect', { getHint: async () => 'owner@example.com', isCurrent: () => current });
  await service.whenIdle(); clearInterval(watch);
  const names = requestsIn(env);
  const body = written || JSON.parse(fs.readFileSync(path.join(env.APPDATA, 'SynkWorkBackup', 'solio', 'requests', names[0]), 'utf8'));
  assert.equal(body.hint, undefined);
});

test('GPT GA4 (again): a lost exit code is 「not confirmed」, never 「done」, and the request stays', async () => {
  const key = minisignKey(), data = crypto.randomBytes(500), env = appdata(temp()), engineState = {};
  for (const ran of [{ outcome: 'gone' }, { outcome: 'exited', code: null }]) {
    engineState.dir = null;
    const hold = async file => ({ finalPath: file, sha256: shaOf(file), release() {}, async run(onStarted) { onStarted(); engineState.dir = engineDir(); return ran; } });
    const service = B.createSolioBackup({ platform: 'win32', env, cacheRoot: temp(), run: fakeEngine(engineState), request: fakeNet({ feed: release(key, data), file: data }), hold, keys: [{ role: 'operating', pub: key.pub }], previewAccounts: MINE, ...quiet });
    await service.start(ME, 'protect'); await service.whenIdle();
    assert.equal((await service.snapshot(ME)).install.code, 'INSTALL_UNCONFIRMED', JSON.stringify(ran));
  }
  assert.equal(requestsIn(env).length, 2);
});

test('GPT GA5 (again): a failed engine check right before the prompt launches nothing', async () => {
  const key = minisignKey(), data = crypto.randomBytes(500), env = appdata(temp()), log = [];
  let checks = 0;
  const run = async () => (++checks <= 1 ? '{}' : null);
  const hold = async file => ({ finalPath: file, sha256: shaOf(file), release() { log.push('release'); }, async run() { log.push('run'); return { outcome: 'exited', code: 0 }; } });
  const service = B.createSolioBackup({ platform: 'win32', env, cacheRoot: temp(), run, request: fakeNet({ feed: release(key, data), file: data }), hold, keys: [{ role: 'operating', pub: key.pub }], previewAccounts: MINE, ...quiet });
  await service.start(ME, 'protect'); await service.whenIdle();
  assert.equal((await service.snapshot(ME)).install.code, 'ENGINE_UNKNOWN');
  assert.deepEqual(log, ['release']);
  assert.deepEqual(requestsIn(env), []);
});

test('Fable F1 · F3: a finished install result yields to the protection state; refusals get one line', async () => {
  const { solioBackupView, backupActionNotice } = await import('../renderer/solio-backup-model.mjs');
  const st = B.normalizeStatus(sample()).status;
  for (const phase of ['done', 'opened', 'error']) {
    const v = solioBackupView({ ok: true, available: true, view: 'status', status: st, engine: { installed: true }, feed: {}, install: { phase, code: 'INSTALL_STOPPED', mode: 'protect' } });
    assert.match(v.say, /지키고 있습니다/, phase);
    assert.equal(v.note, '지키는 중');
  }
  const busy = solioBackupView({ ok: true, available: true, view: 'status', status: st, engine: { installed: true }, feed: {}, install: { phase: 'download', progress: 30 } });
  assert.match(busy.say, /30%/, 'a running step still shows');
  assert.match(backupActionNotice({ ok: false, code: 'OPEN_FAILED' }), /열지 못했습니다/);
  assert.match(backupActionNotice({ ok: false, code: 'WHATEVER' }), /처리하지 못했습니다/);
  assert.equal(backupActionNotice({ ok: true }), '');
  const face = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'orb-face.mjs'), 'utf8');
  assert.match(face, /backupNotice = text \? \{ text, at: now\(\) \} : null;/);
  assert.match(face, /if \(r\.loading && again\) \{ r\.again = true; return; \}/, 'a re-read asked during a read runs after it (Fable F5)');
});

/* ── Fable 설계 재검토(11-20) ── */
test('a holder whose own hash differs from the feed is never run, whatever the path says', async () => {
  const key = minisignKey(), data = crypto.randomBytes(500), log = [], env = appdata(temp());
  const hold = async file => ({ finalPath: file, sha256: 'f'.repeat(64), release() { log.push('release'); }, async run() { log.push('run'); return { outcome: 'exited', code: 0 }; } });
  const service = B.createSolioBackup({ platform: 'win32', env, cacheRoot: temp(), run: fakeEngine({}), request: fakeNet({ feed: release(key, data), file: data }), hold, keys: [{ role: 'operating', pub: key.pub }], previewAccounts: MINE, ...quiet });
  await service.start(ME, 'protect'); await service.whenIdle();
  assert.equal((await service.snapshot(ME)).install.code, 'VERIFY_FAILED');
  assert.deepEqual(log, ['release']);
});

test('a clean installer exit followed by failed engine checks is 「not confirmed」, not 「stopped」', async () => {
  const key = minisignKey(), data = crypto.randomBytes(500), env = appdata(temp());
  let checks = 0;
  const run = async () => (++checks <= 2 ? '{}' : null);
  const hold = async file => ({ finalPath: file, sha256: shaOf(file), release() {}, async run(onStarted) { onStarted(); return { outcome: 'exited', code: 0 }; } });
  const service = B.createSolioBackup({ platform: 'win32', env, cacheRoot: temp(), run, request: fakeNet({ feed: release(key, data), file: data }), hold, keys: [{ role: 'operating', pub: key.pub }], previewAccounts: MINE, ...quiet });
  await service.start(ME, 'protect'); await service.whenIdle();
  assert.equal((await service.snapshot(ME)).install.code, 'INSTALL_UNCONFIRMED');
});

test('GPT third round GA1: a slow earlier engine check never overwrites a newer 「installed」', async () => {
  const dir = engineDir(), opened = [];
  let calls = 0;
  const run = async () => { const n = ++calls; if (n === 1) { await new Promise(r => setTimeout(r, 150)); return '{}'; } return JSON.stringify({ loc: `"${dir}"`, ver: '0.7.0' }); };
  const service = B.createSolioBackup({ platform: 'win32', env: appdata(temp(), { status: sample() }), run, openExternal: async url => opened.push(url), previewAccounts: MINE });
  const slow = service.snapshot(ME);
  await new Promise(r => setTimeout(r, 20));
  await service.start(ME, 'protect');
  await slow; await service.whenIdle();
  assert.deepEqual(await service.open(ME, 'status'), { ok: true });
  assert.equal((await service.snapshot(ME)).engine.installed, true);
});
