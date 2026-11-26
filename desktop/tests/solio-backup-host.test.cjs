'use strict';
// 솔리오 백업 방의 호스트(src/solio-backup-host.cjs) 시험. 가짜 호스트(fixtures/fake-workbackup-host.cjs)가 2.6 꼴을 흉내 낸다.
// 실제 엔진 · 설치 폴더 · %APPDATA%\SynkWorkBackup · 레지스트리는 쓰지 않는다. 띄우는 것은 node와 시험 폴더뿐이다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const H = require('../src/solio-backup-host.cjs');

const FAKE = path.join(__dirname, 'fixtures', 'fake-workbackup-host.cjs');
const EXE = 'C:\\Program Files\\SYNK 업무 백업\\WorkBackup.exe';
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'solio-host-'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, ms = 5000) { const end = Date.now() + ms; while (Date.now() < end) { if (check()) return true; await sleep(15); } return check(); }
const lines = file => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : []);

/* 실행 파일 대신 node로 가짜 호스트를 띄운다. 받은 실행 파일 · 인자 · 설정은 적어 둔다 */
function fakeSpawn(mode, seen = [], log = null) {
  return (file, args, options) => {
    seen.push({ file, args, options });
    return spawn(process.execPath, [FAKE, typeof mode === 'function' ? mode(seen.length) : mode, ...args], { ...options, cwd: undefined, env: { ...options.env, ...(log ? { SWB_FAKE_LOG: log } : {}) } });
  };
}
function host(mode, extra = {}) {
  const seen = [], log = path.join(temp(), 'host.log'), states = [], changes = [];
  const h = H.createBackupHost({ spawn: fakeSpawn(mode, seen, log), onState: v => states.push(v), onChange: s => changes.push(s.phase), ...extra });
  return { h, seen, log, states, changes };
}

test('versions: only HOST_MIN and up has a host; the window handle goes as a 64-bit decimal', () => {
  assert.equal(H.HOST_MIN, '0.8.0');
  assert.equal(H.hostCapable('0.8.0'), true);
  assert.equal(H.hostCapable('0.10.1'), true);
  assert.equal(H.hostCapable('0.7.9'), false);
  assert.equal(H.hostCapable(null), false);
  assert.equal(H.hostCapable('0.8'), false);
  const b = Buffer.alloc(8); b.writeBigUInt64LE(0x1_2345_6789n);
  assert.equal(H.windowHandleText(b), String(0x1_2345_6789));
  const big = Buffer.alloc(8); big.writeBigUInt64LE(18446744073709551615n);
  assert.equal(H.windowHandleText(big), '18446744073709551615', 'the full 64 bits, never a rounded Number');
  assert.equal(H.windowHandleText(Buffer.alloc(8)), null);
  assert.equal(H.windowHandleText('123'), null);
});

test('lines: the 2.6 table exactly; a line with an unknown field is dropped', () => {
  assert.deepEqual(H.readLine('{"hello":{"v":1,"version":"0.8.0"}}'), { kind: 'hello', version: '0.8.0' });
  assert.deepEqual(H.readLine('{"hello":{"v":1,"busy":true}}'), { kind: 'hello', busy: true });
  assert.deepEqual(H.readLine('{"hello":{"v":2,"anything":1}}'), { kind: 'hello', newer: true, v: 2 });
  assert.equal(H.readLine('{"hello":{"v":1,"version":"0.8.0","x":1}}'), null);
  assert.equal(H.readLine('{"hello":{"v":1,"version":"0.8.0"},"x":1}'), null);
  assert.deepEqual(H.readLine('{"id":3,"result":{"ok":true,"value":1}}'), { kind: 'result', id: 3, result: { ok: true, value: 1 } });
  assert.deepEqual(H.readLine('{"id":3,"result":{"bad":1}}'), { kind: 'result', id: 3, result: null });
  assert.equal(H.readLine('{"id":0,"result":{"ok":true}}'), null);
  assert.deepEqual(H.readLine('{"state":{"a":1}}'), { kind: 'state', state: { a: 1 } });
  assert.deepEqual(H.readLine('{"ask":1,"native":"openPath","arg":"C:\\\\x"}'), { kind: 'ask', ask: 1, native: 'openPath', arg: 'C:\\x' });
  assert.equal(H.readLine('{"ask":1,"native":"run","arg":"x"}'), null);
  assert.deepEqual(H.readLine('{"failed":"WORKER_DIED"}'), { kind: 'failed', code: 'WORKER_DIED' });
  assert.equal(H.readLine('{"failed":"no spaces"}'), null);
  assert.equal(H.readLine('not json'), null);
  assert.equal(H.readLine('[1]'), null);
});

test('hello → ready: detached, hidden, three pipes, --solio, a clean environment; calls round-trip and the window handle follows hello', async t => {
  const r = host('ok');
  t.after(() => r.h.bye());
  r.h.setWindow('123456789012');
  r.h.start(EXE);
  assert.equal(r.h.state().phase, 'starting');
  assert.deepEqual(r.seen[0].args, ['--solio']);
  assert.equal(r.seen[0].file, EXE);
  assert.deepEqual([r.seen[0].options.detached, r.seen[0].options.windowsHide, r.seen[0].options.shell, r.seen[0].options.stdio], [true, true, false, ['pipe', 'pipe', 'pipe']]);
  assert.ok(!Object.keys(r.seen[0].options.env).some(k => /^ELECTRON_|^NODE_OPTIONS$/i.test(k)), 'no Electron or NODE_OPTIONS variables reach the worker');
  assert.ok(await until(() => r.h.state().phase === 'ready'));
  assert.equal(r.h.state().version, '0.8.0');
  assert.deepEqual(await r.h.call('getState', []), { ok: true, value: { method: 'getState', args: [] } });
  assert.deepEqual(await r.h.call('rangeSet', ['a', { b: 1 }]), { ok: true, value: { method: 'rangeSet', args: ['a', { b: 1 }] } });
  assert.deepEqual(await r.h.call('emitState', []), { ok: true, value: null });
  assert.ok(await until(() => r.states.length === 1));
  assert.deepEqual(r.states[0], { stage: 'restore', percent: 37 });
  // 모르는 칸이 있는 답은 버리고 다음 줄을 받는다. 꼴이 틀린 봉투는 고정 실패 봉투다
  assert.deepEqual(await r.h.call('junk', []), { ok: true, value: 'clean' });
  assert.equal((await r.h.call('badEnvelope', [])).code, 'HOST_BAD_REPLY');
  // 창 핸들은 hello 뒤에 한 번, 바뀌면 다시
  r.h.setWindow('987');
  assert.ok(await until(() => lines(r.log).filter(l => l.got?.window).length === 2));
  assert.deepEqual(lines(r.log).filter(l => l.got?.window).map(l => l.got), [{ window: '123456789012' }, { window: '987' }]);
  r.h.setWindow('987');
  r.h.setWindow('not a handle');
  await sleep(50);
  assert.equal(lines(r.log).filter(l => l.got?.window).length, 2, 'the same handle is not sent twice; a malformed one is never sent');
});

test('calls: the name shape, at most two arguments, 64KB, 64 at once, and nothing before ready', async t => {
  const r = host('ok');
  t.after(() => r.h.bye());
  assert.equal((await r.h.call('getState', [])).code, 'HOST_NOT_READY');
  r.h.start(EXE);
  assert.ok(await until(() => r.h.state().phase === 'ready'));
  for (const bad of ['', 'a.b', 'x'.repeat(65), 'get state', '__proto__']) assert.equal((await r.h.call(bad, [])).code, 'INVALID_REQUEST', bad);
  assert.equal((await r.h.call('getState', [1, 2, 3])).code, 'INVALID_REQUEST');
  assert.equal((await r.h.call('getState', 'x')).code, 'INVALID_REQUEST');
  assert.equal((await r.h.call('getState', ['x'.repeat(70 * 1024)])).code, 'INVALID_REQUEST');
  const hanging = Array.from({ length: H.CALLS_MAX }, () => r.h.call('never', []));
  assert.equal((await r.h.call('getState', [])).code, 'HOST_BUSY', 'the 65th call at once is refused');
  r.h.bye();
  const settled = await Promise.all(hanging);
  assert.ok(settled.every(x => x.ok === false && x.code === 'HOST_GONE'), 'bye ends every waiting call');
});

test('ask: openExternal only https, openPath only an existing folder outside the state folder; answered on the same line number', async t => {
  const opened = [], folders = [];
  const dir = temp(), state = path.join(dir, 'SynkWorkBackup'), plain = path.join(dir, 'restored');
  fs.mkdirSync(state); fs.mkdirSync(plain);
  const fsWin = { lstat: p => fs.promises.lstat(p), realpath: p => fs.promises.realpath(p), stat: p => fs.promises.stat(p) };
  const r = host('ok', { openExternal: async url => { opened.push(url); }, openPath: async p => { folders.push(p); return ''; }, stateRoot: state, fsImpl: fsWin });
  t.after(() => r.h.bye());
  r.h.start(EXE);
  assert.ok(await until(() => r.h.state().phase === 'ready'));
  const ask = (native, arg) => r.h.call('ask', [native, arg]).then(x => x.value);
  assert.equal(await ask('openExternal', 'https://accounts.google.com/o/oauth2/v2/auth?x=1'), true);
  for (const bad of ['http://example.com/', 'file:///C:/Windows', 'https://user:pw@example.com/', 'https://example.com:8443/', 'javascript:alert(1)', 'https://exa mple.com/']) assert.equal(await ask('openExternal', bad), false, bad);
  assert.deepEqual(opened, ['https://accounts.google.com/o/oauth2/v2/auth?x=1']);
  if (process.platform === 'win32') {
    assert.equal(await ask('openPath', plain), true);
    assert.equal(await ask('openPath', state), false, 'not the engine state folder');
    assert.equal(await ask('openPath', path.join(dir, 'missing')), false);
    assert.equal(await ask('openPath', 'relative\\dir'), false);
    assert.equal(await ask('openPath', '\\\\?\\C:\\Windows'), false);
    assert.deepEqual(folders, [plain]);
  }
  const answers = lines(r.log).filter(l => l.got && 'answer' in l.got).map(l => l.got);
  assert.ok(answers.every(a => Number.isInteger(a.answer) && typeof a.ok === 'boolean' && Object.keys(a).length === 2));
});

test('busy: the host says busy and ends; while the room shows it is started again every few seconds, not while hidden', async t => {
  let shown = true;
  const r = host(n => (n < 3 ? 'busy' : 'ok'), { shown: () => shown, busyAgainMs: 60 });
  t.after(() => r.h.bye());
  r.h.start(EXE);
  assert.ok(await until(() => r.h.state().phase === 'busy'));
  assert.ok(await until(() => r.h.state().phase === 'ready', 4000), JSON.stringify(r.changes));
  assert.equal(r.seen.length, 3, 'busy, busy again, then the free host');
  // 숨은 동안은 다시 띄우지 않는다
  const q = host('busy', { shown: () => shown, busyAgainMs: 40 });
  t.after(() => q.h.bye());
  shown = false;
  q.h.start(EXE);
  assert.ok(await until(() => q.h.state().phase === 'busy'));
  await sleep(300);
  assert.equal(q.seen.length, 1, 'no retry while the room is hidden');
  shown = true;
  q.h.visible(true);
  assert.ok(await until(() => q.seen.length === 2), 'shown again: started again');
});

test('refused (exit 77), newer protocol, failed line, a crash and a silent host each get their own state', async t => {
  const refused = host('refuse');
  refused.h.start(EXE);
  assert.ok(await until(() => refused.h.state().phase === 'refused'));
  assert.equal(refused.h.state().code, 'PARENT_REFUSED');

  const newer = host('newer');
  newer.h.start(EXE);
  assert.ok(await until(() => newer.h.state().phase === 'newer'));
  assert.ok(await until(() => lines(newer.log).some(l => l.got?.bye === true)), 'an unknown protocol gets bye');
  // starting에서 곧바로 newer: 그 사이 idle을 알리지 않는다. 방은 idle에서 화면 자리를 닫는다(Fable workbackup-solio-one-ui-20261127 F3)
  assert.deepEqual(newer.changes, ['starting', 'newer']);

  const failed = host('ok');
  failed.h.start(EXE);
  assert.ok(await until(() => failed.h.state().phase === 'ready'));
  const pending = failed.h.call('never', []);
  await failed.h.call('failNow', []).catch(() => null);
  assert.ok(await until(() => failed.h.state().phase === 'failed'));
  assert.equal(failed.h.state().code, 'WORKER_DIED');
  assert.equal((await pending).code, 'HOST_GONE');

  const crash = host('crash');
  crash.h.start(EXE);
  assert.ok(await until(() => crash.h.state().phase === 'failed', 4000));
  assert.equal(crash.h.state().code, 'HOST_EXITED');

  const silent = host('silent', { helloWaitMs: 150 });
  t.after(() => silent.h.bye());
  silent.h.start(EXE);
  assert.ok(await until(() => silent.h.state().phase === 'failed'));
  assert.equal(silent.h.state().code, 'HELLO_TIMEOUT');
  assert.deepEqual(silent.changes, ['starting', 'failed'], 'no idle on the way to HELLO_TIMEOUT (F3)');

  // 이 실행 파일 이름이 아니면 띄우지 않는다
  const wrong = host('ok');
  wrong.h.start('C:\\Windows\\System32\\cmd.exe');
  assert.deepEqual([wrong.h.state().phase, wrong.seen.length], ['failed', 0]);
});

test('lines before hello and lines over 2MB are dropped; hello still counts', async t => {
  for (const mode of ['pre', 'big']) {
    const r = host(mode);
    t.after(() => r.h.bye());
    r.h.start(EXE);
    assert.ok(await until(() => r.h.state().phase === 'ready'), mode);
    assert.deepEqual(r.states, [], `${mode}: nothing taken before hello`);
  }
});

test('bye: sent as one line, stdin closed, never killed; leaving the room says bye after the idle wait only when nothing runs', async t => {
  let job = true;
  const r = host('ok', { idleByeMs: 80, idle: () => !job });
  t.after(() => r.h.bye());
  r.h.start(EXE);
  assert.ok(await until(() => r.h.state().phase === 'ready'));
  const proc = r.seen.length;
  r.h.visible(false);
  await sleep(250);
  assert.equal(r.h.state().phase, 'ready', 'a running job keeps the host past the idle wait');
  job = false;
  assert.ok(await until(() => r.h.state().phase === 'idle', 2000));
  assert.ok(await until(() => lines(r.log).some(l => l.got?.bye === true)));
  assert.equal(r.seen.length, proc);
  // 다시 보이면 시계가 멈춘다
  r.h.start(EXE);
  assert.ok(await until(() => r.h.state().phase === 'ready'));
  r.h.visible(false); r.h.visible(true);
  await sleep(200);
  assert.equal(r.h.state().phase, 'ready');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'solio-backup-host.cjs'), 'utf8');
  assert.doesNotMatch(src, /\.kill\(/, 'the host is never killed');
});

test('update install: --update-install --quiet (plain for old engines), JSON lines decide the outcome', async () => {
  const run = (lines, code, quiet = true) => {
    const seen = [];
    const spawnImpl = (file, args, options) => { seen.push({ file, args, options }); return spawn(process.execPath, ['-e', `for (const l of ${JSON.stringify(lines)}) console.log(l); process.exit(${code});`], { ...options, env: process.env }); };
    return H.runUpdateInstall({ spawn: spawnImpl, executable: EXE, quiet }).then(result => ({ result, seen }));
  };
  let r = await run(['{"ok":false,"error":"RUN_ACTIVE"}'], 75);
  assert.deepEqual(r.result, { outcome: 'run-active', code: 'RUN_ACTIVE' });
  assert.deepEqual(r.seen[0].args, ['--update-install', '--quiet']);
  assert.deepEqual([r.seen[0].options.detached, r.seen[0].options.windowsHide], [true, true]);
  r = await run(['{"ok":false,"error":"UPDATE_START"}'], 1, false);
  assert.deepEqual(r.result, { outcome: 'declined', code: 'UPDATE_START' });
  assert.deepEqual(r.seen[0].args, ['--update-install'], 'an engine without a host gets no --quiet');
  r = await run(['{"ok":true,"installing":"0.8.1"}', '{"ok":true,"result":{}}'], 0);
  assert.deepEqual(r.result, { outcome: 'installing', code: null, version: '0.8.1' });
  r = await run(['{"ok":true,"result":{"available":null}}'], 0);
  assert.deepEqual(r.result, { outcome: 'up-to-date', code: null });
  r = await run(['noise', '{"ok":false,"error":"UPDATE_SIGNATURE"}'], 3);
  assert.deepEqual(r.result, { outcome: 'error', code: 'UPDATE_SIGNATURE' });
  assert.deepEqual(await H.runUpdateInstall({ spawn: () => { throw Error('no'); }, executable: EXE }), { outcome: 'error', code: 'UPDATE_SPAWN' });
  assert.deepEqual(await H.runUpdateInstall({ executable: 'C:\\x\\other.exe' }), { outcome: 'error', code: 'HOST_PATH' });
});

test('「백업 창 따로 열기」 starts --window detached; open when it stays up, held when it ends at once (the lock is taken), failed when it cannot start', async () => {
  const { EventEmitter } = require('node:events');
  const seen = [];
  const child = () => { const c = new EventEmitter(); c.unref = () => seen.push('unref'); return c; };
  let proc;
  const spawnIt = (file, args, options) => { seen.push({ file, args, options }); proc = child(); return proc; };
  assert.equal(await H.openEmergencyWindow({ executable: EXE, spawn: spawnIt, settleMs: 20 }), 'open');
  assert.deepEqual([seen[0].file, seen[0].args, seen[0].options.detached, seen[0].options.stdio, seen[1]], [EXE, ['--window'], true, 'ignore', 'unref']);
  const held = H.openEmergencyWindow({ executable: EXE, spawn: spawnIt, settleMs: 5000 });
  proc.emit('exit', 0);
  assert.equal(await held, 'held');
  const broken = H.openEmergencyWindow({ executable: EXE, spawn: spawnIt, settleMs: 5000 });
  proc.emit('error', Error('ENOENT'));
  assert.equal(await broken, 'failed');
  assert.equal(await H.openEmergencyWindow({ executable: 'WorkBackup.exe', spawn: () => { throw Error('must not start'); } }), 'failed', 'only an absolute path');
  assert.equal(await H.openEmergencyWindow({ executable: EXE, spawn: () => { throw Error('cannot'); } }), 'failed');
});

test('a host that writes busy and ends is busy even when exit comes before its last line (GPT workbackup-solio-one-be-20261127 A8)', async () => {
  const { EventEmitter } = require('node:events'), { PassThrough } = require('node:stream');
  const changes = [];
  const h = H.createBackupHost({ spawn: () => {
    const c = new EventEmitter(); c.stdout = new PassThrough(); c.stdin = new PassThrough(); c.stderr = new PassThrough();
    setImmediate(() => { c.emit('exit', 0); setTimeout(() => { c.stdout.end('{"hello":{"v":1,"busy":true}}\n'); }, 30); });
    return c;
  }, onChange: s => changes.push(s.phase) });
  h.start(EXE);
  assert.ok(await until(() => changes.includes('busy') || changes.includes('failed'), 3000), JSON.stringify(changes));
  assert.equal(changes.includes('busy'), true, JSON.stringify(changes));
  h.bye();
});
