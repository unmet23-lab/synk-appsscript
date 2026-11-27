'use strict';
// 솔리오 백업 방의 호스트(experiences/solo-backup-rust/SOLIO_ONE_CLIENT.md 2.1 · 2.4 · 2.6, 2026-11-26).
// 깔린 엔진의 `WorkBackup.exe --solio`를 창 없이 띄우고 표준 입출력의 JSON 줄로만 말한다. 줄의 꼴은 2.6 표가 정본이다.
// - 엔진 판이 HOST_MIN 이상일 때만 띄운다. 그 아래 판은 호스트가 없어 지금의 열기 주소 길을 쓴다(solio-backup.cjs).
// - detached로 띄운다. 솔리오가 끝나도 호스트는 하던 되살리기 · 옮겨 오기를 마친다(F2). 그래서 죽이지 않고 bye만 보낸다.
// - 표준 오류는 읽지 않고 버린다. 호스트 → 솔리오 한 줄은 2MB, 솔리오 → 호스트 한 줄은 128KB를 넘지 않는다. 모르는 칸이 있는 줄은 버린다.
// - 메서드 목록은 들고 있지 않다. 이름의 꼴 · 인자 수 · 크기만 보고, 메서드 검사는 호스트가 한다(2.2 F7).
// - ask는 호스트가 거른 열기다. 여기서 한 번 더 거른 뒤 연다: openExternal은 https만, openPath는 있는 폴더만(2.1).
// spawn · 시계 · 열기 · 폴더 확인을 주입받는다. 시험: desktop/tests/solio-backup-host.test.cjs.
const path = require('node:path');
const fs = require('node:fs');
const { spawn: nodeSpawn } = require('node:child_process');

const HOST_MIN = '0.8.0';
const PROTOCOL = 1;
const FROM_HOST_MAX = 2 * 1024 * 1024;
const TO_HOST_MAX = 128 * 1024;
const ARGS_MAX = 64 * 1024;
const CALLS_MAX = 64;
const BUSY_AGAIN = 5000;
const IDLE_BYE = 5 * 60000;
const HELLO_WAIT = 30000;
const REFUSED_EXIT = 77;
const VERSION = /^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/;
const METHOD = /^[A-Za-z][A-Za-z0-9]{0,63}$/;
const FAILED_CODE = /^[A-Z0-9_]{1,64}$/;
const SAFE_ERROR = '백업 화면과의 연결이 끊겼습니다. 「다시 열기」를 눌러 주세요.';

const isPlain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const onlyKeys = (value, keys) => Object.keys(value).every(k => keys.includes(k));

/* 판 비교. 꼴이 틀리면 null */
function compareVersion(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !VERSION.test(a) || !VERSION.test(b)) return null;
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}
/* 호스트가 있는 엔진인가(HOST_MIN 이상) */
const hostCapable = version => (compareVersion(version, HOST_MIN) ?? -1) >= 0;

/* getNativeWindowHandle()의 버퍼(64비트 HWND)를 10진 글로. 0이나 꼴이 틀리면 null */
function windowHandleText(buffer) {
  try {
    if (!Buffer.isBuffer(buffer) || (buffer.length !== 8 && buffer.length !== 4)) return null;
    const value = buffer.length === 8 ? buffer.readBigUInt64LE(0) : BigInt(buffer.readUInt32LE(0));
    return value > 0n ? value.toString(10) : null;
  } catch { return null; }
}

/* 부름의 봉투는 지금 bridge.js의 isEnvelope와 같은 꼴이다(2.6 「봉투는 지금 backup_call과 같다」) */
const envelope = value => isPlain(value) && (value.ok === true || (value.ok === false && typeof value.error === 'string')) ? value : null;
const failure = code => ({ ok: false, error: SAFE_ERROR, code });

/* 호스트가 쓴 줄 하나를 꼴대로 읽는다. 모르는 꼴 · 모르는 칸이면 null(버린다) */
function readLine(text) {
  let value;
  try { value = JSON.parse(text); } catch { return null; }
  if (!isPlain(value)) return null;
  const keys = Object.keys(value);
  if (keys.length === 1 && keys[0] === 'hello') {
    const h = value.hello;
    if (!isPlain(h) || !Number.isSafeInteger(h.v) || h.v < 1) return null;
    // 솔리오가 모르는 꼴 번호(엔진이 새 판)는 다른 칸을 읽지 않는다
    if (h.v > PROTOCOL) return { kind: 'hello', newer: true, v: h.v };
    if (onlyKeys(h, ['v', 'version']) && typeof h.version === 'string' && VERSION.test(h.version)) return { kind: 'hello', version: h.version };
    if (onlyKeys(h, ['v', 'busy']) && h.busy === true) return { kind: 'hello', busy: true };
    return null;
  }
  if (keys.length === 2 && onlyKeys(value, ['id', 'result'])) {
    if (!Number.isSafeInteger(value.id) || value.id < 1) return null;
    return { kind: 'result', id: value.id, result: envelope(value.result) };
  }
  if (keys.length === 1 && keys[0] === 'state') return { kind: 'state', state: value.state };
  if (keys.length === 3 && onlyKeys(value, ['ask', 'native', 'arg'])) {
    if (!Number.isSafeInteger(value.ask) || value.ask < 1 || !['openExternal', 'openPath'].includes(value.native) || typeof value.arg !== 'string' || value.arg.length > 4096) return null;
    return { kind: 'ask', ask: value.ask, native: value.native, arg: value.arg };
  }
  if (keys.length === 1 && keys[0] === 'failed') {
    if (typeof value.failed !== 'string' || !FAILED_CODE.test(value.failed)) return null;
    return { kind: 'failed', code: value.failed };
  }
  return null;
}

/* 바깥 주소 열기의 두 번째 거르기: https, 사용자 · 비밀번호 · 포트 없음, 2KB 이하 */
function externalAllowed(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u001f\s]/.test(value)) return false;
  let url;
  try { url = new URL(value); } catch { return false; }
  return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password && !url.port;
}
/* 폴더 열기의 두 번째 거르기: 절대 경로의 있는 폴더, 길에 연결점이 없고, 엔진의 상태 폴더와 겹치지 않음 */
async function folderAllowed(value, { fsImpl = fs.promises, stateRoot = null } = {}) {
  if (typeof value !== 'string' || value.length > 1024 || /[\u0000-\u001f]/.test(value) || !path.win32.isAbsolute(value) || /^\\\\[?.]\\/.test(value)) return false;
  const norm = p => path.win32.resolve(p).replace(/\\+$/, '').toLowerCase();
  const overlap = (a, b) => { const x = norm(a), y = norm(b); return x === y || x.startsWith(y + '\\') || y.startsWith(x + '\\'); };
  if (stateRoot && overlap(value, stateRoot)) return false;
  try {
    for (let part = path.win32.resolve(value); ; part = path.win32.dirname(part)) {
      const stat = await fsImpl.lstat(part);
      if (stat.isSymbolicLink()) return false;
      if (path.win32.dirname(part) === part) break;
    }
    const real = await fsImpl.realpath(value);
    if (stateRoot && overlap(real, stateRoot)) return false;
    return (await fsImpl.stat(real)).isDirectory();
  } catch { return false; }
}

/* 호스트에 넘기는 환경. Electron · Node를 바꾸는 변수는 엔진의 Node 워커에 넘기지 않는다 */
function hostEnv(env = process.env) {
  const out = { ...env };
  for (const key of Object.keys(out)) if (/^(ELECTRON_|NODE_OPTIONS$|NODE_EXTRA_CA_CERTS$|NODE_PATH$)/i.test(key)) delete out[key];
  return out;
}

/*
  호스트 하나의 수명. 상태(phase):
    idle       아직 띄우지 않았거나 bye로 끝남
    starting   띄웠고 hello를 기다림
    ready      hello v1을 받음(version이 있다)
    busy       다른 호스트나 창이 창 잠금을 쥠. 방이 보이는 동안 5초마다 다시 띄운다
    newer      hello의 꼴 번호를 솔리오가 모름 → 「솔리오를 업데이트해 주세요」
    refused    종료 77(부모 확인 거절) → 「백업 창 따로 열기」만
    failed     failed 줄 · 예기치 않은 종료 · 띄우기 실패 → 「백업 화면이 멈췄습니다 — 다시 열기」
*/
function createBackupHost({
  spawn = nodeSpawn, env = process.env, timers = globalThis, now = Date.now,
  openExternal = async () => { throw Error('OPEN_UNAVAILABLE'); }, openPath = async () => 'unavailable',
  fsImpl = fs.promises, stateRoot = null,
  shown = () => false, idle = () => true, onState = () => {}, onChange = () => {},
  busyAgainMs = BUSY_AGAIN, idleByeMs = IDLE_BYE, helloWaitMs = HELLO_WAIT,
} = {}) {
  let child = null, phase = 'idle', version = null, code = null, exe = null, windowText = null, sentWindow = null;
  let buffer = Buffer.alloc(0), skipping = false, nextId = 1, gen = 0;
  let helloTimer = null, busyTimer = null, idleTimer = null;
  const calls = new Map();
  const snapshot = () => ({ phase, version, code, calls: calls.size });
  const changed = () => { try { onChange(snapshot()); } catch { /* 알림은 화면 일이다 */ } };
  const clear = timer => { if (timer) timers.clearTimeout(timer); return null; };
  function set(next, extra = {}) { phase = next; if ('version' in extra) version = extra.version; if ('code' in extra) code = extra.code; changed(); }

  function write(value) {
    if (!child) return false;
    const line = JSON.stringify(value);
    if (Buffer.byteLength(line, 'utf8') > TO_HOST_MAX) return false;
    try { child.stdin.write(line + '\n'); return true; } catch { return false; }
  }
  function settleCalls(answer) { for (const [, resolve] of calls) resolve(answer); calls.clear(); }
  function sendWindow() {
    if (phase !== 'ready' || !windowText || windowText === sentWindow) return;
    if (write({ window: windowText })) sentWindow = windowText;
  }

  function start(executable) {
    if (typeof executable !== 'string' || !path.win32.isAbsolute(executable) || path.win32.basename(executable).toLowerCase() !== 'workbackup.exe') { set('failed', { code: 'HOST_PATH' }); return snapshot(); }
    if (child && ['starting', 'ready'].includes(phase)) return snapshot();
    busyTimer = clear(busyTimer);
    exe = executable;
    const mine = ++gen;
    buffer = Buffer.alloc(0); skipping = false; sentWindow = null;
    set('starting', { version: null, code: null });
    let proc;
    try {
      proc = spawn(executable, ['--solio'], { detached: true, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'], env: hostEnv(env), cwd: path.win32.dirname(executable) });
    } catch { child = null; set('failed', { code: 'HOST_SPAWN' }); return snapshot(); }
    child = proc;
    // 표준 오류는 읽지 않는다. 다만 파이프가 차서 호스트가 멈추지 않게 흘려 버린다(2.6 끝)
    try { proc.stderr?.resume?.(); } catch {}
    proc.stdout.on('data', chunk => { if (mine === gen) take(chunk); });
    proc.stdin.on?.('error', () => {});
    proc.once('error', () => { if (mine === gen) ended(null, 'HOST_SPAWN'); });
    // 끝은 마지막 줄까지 읽은 뒤에 판정한다. exit가 표준 출력의 마지막 조각보다 먼저 올 수 있다(busy 뒤 끝 따위).
    // 출력이 끝나기를 0.5초까지만 기다린다. 물려받은 손자가 파이프를 쥐어도 끝 판정이 늦지 않게 한다(GPT workbackup-solio-one-be-20261127 A8)
    proc.once('exit', exitCode => {
      if (mine !== gen) return;
      let fired = false;
      const finish = () => { if (fired) return; fired = true; if (mine === gen) ended(exitCode, null); };
      if (proc.stdout.readableEnded) { finish(); return; }
      proc.stdout.once('end', finish);
      timers.setTimeout(finish, 500)?.unref?.();
    });
    helloTimer = clear(helloTimer);
    helloTimer = timers.setTimeout(() => { if (mine === gen && phase === 'starting') { bye({ quiet: true }); set('failed', { code: 'HELLO_TIMEOUT' }); } }, helloWaitMs);
    helloTimer?.unref?.();
    return snapshot();
  }

  function take(chunk) {
    buffer = buffer.length ? Buffer.concat([buffer, chunk]) : Buffer.from(chunk);
    for (;;) {
      const at = buffer.indexOf(10);
      if (at < 0) {
        // 2MB를 넘는 줄은 끝까지 버린다
        if (buffer.length > FROM_HOST_MAX) { skipping = true; buffer = Buffer.alloc(0); }
        return;
      }
      const raw = buffer.subarray(0, at); buffer = buffer.subarray(at + 1);
      if (skipping) { skipping = false; continue; }
      if (raw.length > FROM_HOST_MAX) continue;
      let text = raw.toString('utf8');
      if (text.endsWith('\r')) text = text.slice(0, -1);
      if (!text) continue;
      handle(readLine(text));
    }
  }

  function handle(line) {
    if (!line) return;
    if (line.kind === 'hello') {
      if (phase !== 'starting') return;
      helloTimer = clear(helloTimer);
      if (line.newer) { bye({ quiet: true }); set('newer'); return; }
      // 다른 호스트나 창이 창 잠금을 쥐었다. 호스트는 쓰고 바로 끝난다. 방이 보이는 동안 5초마다 다시 띄운다(2.4)
      if (line.busy) { set('busy'); return; }
      set('ready', { version: line.version });
      sendWindow();
      return;
    }
    // hello 전의 줄은 버린다(2.6 「이 줄 전에는 아무것도 쓰지 않는다」)
    if (phase !== 'ready') return;
    if (line.kind === 'result') {
      const resolve = calls.get(line.id);
      if (!resolve) return;
      calls.delete(line.id);
      resolve(line.result || failure('HOST_BAD_REPLY'));
      return;
    }
    if (line.kind === 'state') { try { onState(line.state); } catch {} return; }
    if (line.kind === 'ask') { void answerAsk(line); return; }
    if (line.kind === 'failed') { set('failed', { code: line.code }); }
  }

  async function answerAsk(line) {
    const mine = gen;
    let ok = false;
    try {
      if (line.native === 'openExternal') { if (externalAllowed(line.arg)) { await openExternal(line.arg); ok = true; } }
      else if (await folderAllowed(line.arg, { fsImpl, stateRoot })) { const error = await openPath(line.arg); ok = !error; }
    } catch { ok = false; }
    if (mine === gen && phase === 'ready') write({ answer: line.ask, ok });
  }

  /* bye 뒤의 끝은 세대(gen)가 달라 여기 오지 않는다. 여기 오는 끝은 모두 호스트가 스스로 끝난 것이다 */
  function ended(exitCode, spawnCode) {
    helloTimer = clear(helloTimer);
    child = null;
    gen++;
    const before = phase;
    settleCalls(failure('HOST_GONE'));
    if (spawnCode) { set('failed', { code: spawnCode }); return; }
    if (before === 'busy') { scheduleBusy(); return; }
    if (before === 'starting' && exitCode === REFUSED_EXIT) { set('refused', { code: 'PARENT_REFUSED' }); return; }
    if (before === 'failed') return;
    set('failed', { code: before === 'starting' ? 'HOST_NO_HELLO' : 'HOST_EXITED' });
  }

  /* busy 동안 5초마다 다시 띄운다. 방이 보이지 않으면 멈추고, 다시 보일 때(visible) 띄운다 */
  function scheduleBusy() {
    busyTimer = clear(busyTimer);
    busyTimer = timers.setTimeout(() => {
      busyTimer = null;
      if (phase === 'busy' && !child && shown()) start(exe);
    }, busyAgainMs);
    busyTimer?.unref?.();
  }

  /* 부름 하나 → 봉투. 준비 전이거나 꼴이 틀리면 고정 실패 봉투다 */
  function call(method, args = []) {
    if (phase !== 'ready' || !child) return Promise.resolve(failure('HOST_NOT_READY'));
    if (typeof method !== 'string' || !METHOD.test(method)) return Promise.resolve(failure('INVALID_REQUEST'));
    if (!Array.isArray(args) || args.length > 2) return Promise.resolve(failure('INVALID_REQUEST'));
    let argsText;
    try { argsText = JSON.stringify(args); } catch { return Promise.resolve(failure('INVALID_REQUEST')); }
    if (typeof argsText !== 'string' || Buffer.byteLength(argsText, 'utf8') > ARGS_MAX) return Promise.resolve(failure('INVALID_REQUEST'));
    if (calls.size >= CALLS_MAX) return Promise.resolve(failure('HOST_BUSY'));
    const id = nextId++;
    if (nextId > Number.MAX_SAFE_INTEGER - 1) nextId = 1;
    return new Promise(resolve => {
      calls.set(id, resolve);
      if (!write({ id, call: method, args: JSON.parse(argsText) })) { calls.delete(id); resolve(failure('HOST_WRITE')); }
    });
  }

  /* 끝내기. 죽이지 않는다. 일이 있으면 호스트가 마친 뒤 끝난다(2.1 「끝」) */
  /* quiet: 곧바로 newer · failed로 바꿀 때. 그 사이 idle을 알리지 않는다. 방은 idle을 받으면 화면 자리를 닫아 그 두 안내가 보이지 않았다(Fable workbackup-solio-one-ui-20261127 F3) */
  function bye({ quiet = false } = {}) {
    idleTimer = clear(idleTimer);
    busyTimer = clear(busyTimer);
    helloTimer = clear(helloTimer);
    const proc = child;
    gen++; child = null;
    if (proc) {
      try { proc.stdin.write(JSON.stringify({ bye: true }) + '\n'); } catch {}
      try { proc.stdin.end(); } catch {}
    }
    settleCalls(failure('HOST_GONE'));
    if (phase !== 'idle' && !quiet) set('idle', { code: null });
  }

  /* 방이 보이는지. 보이면 5분 시계를 멈추고, 떠나면 5분 뒤 일이 없을 때 bye */
  function visible(on) {
    if (on) { idleTimer = clear(idleTimer); if (phase === 'busy' && !busyTimer && !child && exe) start(exe); return; }
    if (idleTimer || !['ready', 'starting', 'busy'].includes(phase)) return;
    const arm = () => {
      idleTimer = timers.setTimeout(() => {
        idleTimer = null;
        let quiet = true;
        try { quiet = calls.size === 0 && idle() !== false; } catch { quiet = false; }
        if (quiet) bye(); else arm();
      }, idleByeMs);
      idleTimer?.unref?.();
    };
    arm();
  }

  function setWindow(text) { windowText = typeof text === 'string' && /^[1-9]\d{0,19}$/.test(text) ? text : null; sendWindow(); }

  return { start, call, bye, visible, setWindow, state: snapshot };
}

/* ── 업데이트 설치(3.2): `WorkBackup.exe --update-install [--quiet]`을 관리자 권한 없이 띄우고 JSON 줄을 읽는다 ──
   엔진의 업데이터가 엔진 잠금 · 서명과 판 확인 · 판 내림 막기 · 설치기 넘겨받기를 한 길에서 한다. 설치기가 관리자 확인을 부른다.
   줄: {"ok":true,"installing":"<판>"} 뒤에 {"ok":true,"result":…} 또는 {"ok":false,"error":"<부호>"}(main.rs update_mode) */
function runUpdateInstall({ spawn = nodeSpawn, executable, quiet = true, env = process.env, timers = globalThis, timeoutMs = 30 * 60000 } = {}) {
  return new Promise(resolve => {
    if (typeof executable !== 'string' || !path.win32.isAbsolute(executable) || path.win32.basename(executable).toLowerCase() !== 'workbackup.exe') { resolve({ outcome: 'error', code: 'HOST_PATH' }); return; }
    let proc, out = '', done = false, installing = null, last = null;
    const finish = value => { if (done) return; done = true; timers.clearTimeout(timer); resolve(value); };
    try { proc = spawn(executable, quiet ? ['--update-install', '--quiet'] : ['--update-install'], { detached: true, windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'ignore'], env: hostEnv(env) }); }
    catch { resolve({ outcome: 'error', code: 'UPDATE_SPAWN' }); return; }
    const timer = timers.setTimeout(() => finish({ outcome: installing ? 'installing' : 'error', code: installing ? null : 'UPDATE_TIMEOUT', version: installing }), timeoutMs);
    timer?.unref?.();
    proc.stdout.setEncoding?.('utf8');
    proc.stdout.on('data', chunk => {
      if (out.length > 65536) return;
      out += chunk;
      let at;
      while ((at = out.indexOf('\n')) >= 0) {
        const text = out.slice(0, at).trim(); out = out.slice(at + 1);
        let value; try { value = JSON.parse(text); } catch { continue; }
        if (!isPlain(value)) continue;
        if (value.ok === true && typeof value.installing === 'string' && VERSION.test(value.installing)) installing = value.installing;
        else if (value.ok === true && 'result' in value) last = { ok: true, upToDate: isPlain(value.result) && value.result.available === null };
        else if (value.ok === false && typeof value.error === 'string' && FAILED_CODE.test(value.error)) last = { ok: false, code: value.error };
      }
    });
    proc.once('error', () => finish({ outcome: 'error', code: 'UPDATE_SPAWN' }));
    proc.once('close', exitCode => {
      if (last?.ok === false) finish({ outcome: last.code === 'RUN_ACTIVE' ? 'run-active' : last.code === 'UPDATE_START' ? 'declined' : 'error', code: last.code });
      else if (last?.ok && last.upToDate && !installing) finish({ outcome: 'up-to-date', code: null });
      else if (last?.ok || exitCode === 0) finish({ outcome: installing ? 'installing' : 'done', code: null, version: installing });
      else finish({ outcome: 'error', code: exitCode === 75 ? 'RUN_ACTIVE' : 'UPDATE_FAILED' });
    });
  });
}

/* 「백업 창 따로 열기」: HOST_MIN 이상 엔진의 비상 창(`--window`, 2.5 표). 기다리지 않는다 */
/* 「백업 창 따로 열기」. 'open'(settleMs가 지나도 떠 있다) · 'woke'(곧바로 0으로 끝났다: 떠 있던 창을 깨웠다) ·
   'held'(곧바로 75로 끝났다: 깨울 창 없이 호스트가 창 잠금을 쥐었다, platform.rs state_root · main.rs window_exit) ·
   'failed'(띄우지 못했거나 다른 부호로 끝났다). 기다리지 않고 떼어 놓는다(GPT workbackup-solio-one-be-20261127-r3 GA1) */
const WINDOW_HELD_EXIT = 75;
function openEmergencyWindow({ spawn = nodeSpawn, executable, env = process.env, settleMs = 1500, timers = globalThis } = {}) {
  if (typeof executable !== 'string' || !path.win32.isAbsolute(executable) || path.win32.basename(executable).toLowerCase() !== 'workbackup.exe') return Promise.resolve('failed');
  let proc;
  try { proc = spawn(executable, ['--window'], { detached: true, windowsHide: false, shell: false, stdio: 'ignore', env: hostEnv(env) }); } catch { return Promise.resolve('failed'); }
  return new Promise(resolve => {
    let done = false;
    const finish = value => { if (done) return; done = true; timers.clearTimeout(timer); try { proc.unref?.(); } catch {} resolve(value); };
    const timer = timers.setTimeout(() => finish('open'), settleMs);
    try { proc.once?.('error', () => finish('failed')); proc.once?.('exit', code => finish(code === 0 ? 'woke' : code === WINDOW_HELD_EXIT ? 'held' : 'failed')); } catch { finish('open'); }
  });
}

module.exports = {
  createBackupHost, runUpdateInstall, openEmergencyWindow, readLine, externalAllowed, folderAllowed, windowHandleText, compareVersion, hostCapable, hostEnv,
  HOST_MIN, PROTOCOL, FROM_HOST_MAX, TO_HOST_MAX, CALLS_MAX, BUSY_AGAIN, IDLE_BYE, REFUSED_EXIT, WINDOW_HELD_EXIT,
};
