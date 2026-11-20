'use strict';
// 솔리오 「사무실」의 훅을 받는 서버와 Claude Code 설정 파일 고치기(15절 5단계). 설계: docs/디자인/솔리오_사무실_20261119/구현설계.md
// 3.2 · 3.4의 6 · 7 · 11.1 · 12.1 · 12.2 · 12.3. 설정 파일에는 알림 여섯 가지를 적는다. SessionStart는 HTTP로 오지 않아 적지 않는다(21절 훅 길 확인).
//  · 서버는 127.0.0.1에만 묶는다. 길은 /synk-office/<확인 값> 하나다. POST가 아니거나 확인 값이 틀리면 404로 닫는다.
//    몸이 2MB를 넘으면 더 읽지 않고 413으로 닫는다. JSON이 아니거나 모르는 사건이면 받고(204) 버린다. 답은 몸을 다 받자마자 하고, 접는 일은 그 뒤에 한다.
//  · 받은 값에서 남기는 것은 세션 번호, 작업 폴더, 사건 이름, 도구 이름, 파일 이름(경로의 끝 마디)이나 명령의 첫 낱말, 알림 종류, 도우미 번호, 받은 때다(12.2).
//    명령 전체, 파일 내용, 도구 결과, 마지막 답은 읽자마자 버린다. 받은 값으로는 아무것도 파일에 쓰거나 로그로 남기지 않는다.
//  · 볼 계정이 로그인해 있지 않으면(accepts가 거짓) 몸을 읽지 않고 흘려보낸 뒤 204로 답한다. 훅이 켜져 있는 동안 서버는 열어 둔다(11.1).
//  · 상태 파일은 userData/Office/hooks.json 하나다(켰는지, 포트, 확인 값, 적어 넣은 설정 폴더, 꺼진 까닭). desktop-preferences.json에는 넣지 않는다(12.1).
//  · 실제 설정 파일은 설치본(release 판)만 고친다. 미리보기 · 소스 실행 · 시험 · QA는 SYNK_OFFICE_HOOK_DIRS(경로 구분자로 이은 절대 경로)로
//    넘겨받은 폴더만 고치고, 넘겨받지 않았으면 켜기가 NOT_HERE(「이 실행에서는 켤 수 없습니다」)로 끝난다(12.3).
//  · 설정 파일 고치기는 12.3의 ①~⑥이다. 솔리오의 줄은 HTTP 꼴이고, 주소가 127.0.0.1이고, 길이 /synk-office/로 시작하는 줄이다(셋 다).
//    더하기 전에 표식이 있는 줄을 모두 걷어 내고 새로 적는다. 다른 칸과 다른 훅은 읽은 그대로 둔다. 바뀌는 것이 없으면 쓰지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { defaultRoots } = require('./office-records.cjs');

const EVENTS = Object.freeze(['PostToolUse', 'Notification', 'Stop', 'SubagentStart', 'SubagentStop', 'SessionEnd']);
const HOST = '127.0.0.1';
const PATH_PREFIX = '/synk-office/';
const HOOK_TIMEOUT = 2; // 초. 포트가 열려 있는데 답이 없을 때 기본 600초를 기다리지 않게(12.2)
const BODY_MAX = 2 * 1024 * 1024;
const SETTINGS_MAX = 4 * 1024 * 1024;
const SILENT_MS = 30 * 60e3; // 켠 뒤 이만큼 소식이 하나도 없으면 「알림이 오지 않습니다」(12.2)
const REFRESH_MS = 60e3; // 서버가 열려 있는 동안 상태 파일을 다시 보는 사이(다른 실행의 끄기를 알아채려고)
const STATE_FILE = 'hooks.json';
const SETTINGS = 'settings.json';
const BACKUP = 'settings.json.synk-backup';
const OVERRIDE_ENV = 'SYNK_OFFICE_HOOK_DIRS';
/* 포트는 Windows가 나가는 연결에 쓰는 범위(49152~) 아래에서 고른다. 솔리오가 꺼진 사이 다른 연결이 그 포트를 잡을 일을 줄인다 */
const PORT_RANGE = Object.freeze([30000, 48999]);
const PORT_TRIES = 20;
const FILE_TOOLS = new Set(['Read', 'Edit', 'MultiEdit', 'Write', 'NotebookEdit', 'NotebookRead', 'Grep', 'Glob', 'LS']);
const COMMAND_TOOLS = new Set(['Bash', 'PowerShell']);
const ABSOLUTE = /^(?:[A-Za-z]:[\\/]|\\\\[^\\/]|\/)/;
const CONTROL = /[\u0000-\u001f\u007f]/;
/* 사건마다 넘기는 글의 끝(office.cjs의 HOOK_FIELDS가 다시 본다) */
const LIMITS = Object.freeze({ sessionId: 128, cwd: 1024, toolName: 80, toolDetail: 120, notificationType: 40, agentId: 128 });

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const own = (o, k) => isObject(o) && Object.prototype.hasOwnProperty.call(o, k);
/* __proto__ 같은 열쇠도 제 칸으로 둔다(대입하면 원형을 바꾼다) */
const put = (o, k, v) => { Object.defineProperty(o, k, { value: v, writable: true, enumerable: true, configurable: true }); };
const dirKey = d => path.resolve(String(d)).replace(/[\\/]+$/, '').toLowerCase();
const goodDir = d => typeof d === 'string' && d.length > 0 && d.length <= 1024 && ABSOLUTE.test(d) && !CONTROL.test(d);
function uniqueDirs(list) {
  const seen = new Set(), out = [];
  for (const d of Array.isArray(list) ? list : []) {
    if (!goodDir(d)) continue;
    const k = dirKey(d);
    if (!seen.has(k)) { seen.add(k); out.push(d); }
  }
  return out;
}
const hasDir = (list, d) => list.some(x => dirKey(x) === dirKey(d));

/** 넘겨받은 설정 폴더(설치본이 아닌 실행만 쓴다). 없거나 빈 값이면 [] */
function overrideDirs(env = process.env) {
  const v = env?.[OVERRIDE_ENV];
  return typeof v === 'string' && v.trim() ? uniqueDirs(v.split(path.delimiter).map(s => s.trim())) : [];
}

/* ── 솔리오의 줄(표식) ── HTTP 꼴, 주소가 127.0.0.1, 길이 /synk-office/로 시작. 셋 다 맞아야 한다(12.3, 검토 2차) */
function isMarked(h) {
  if (!isObject(h) || h.type !== 'http' || typeof h.url !== 'string') return false;
  let u;
  try { u = new URL(h.url); } catch { return false; }
  return u.hostname === HOST && u.pathname.startsWith(PATH_PREFIX);
}
const hookUrl = (port, token) => `http://${HOST}:${port}${PATH_PREFIX}${token}`;
/** 솔리오의 줄 한 벌: 사건마다 묶음 하나, matcher 없음, 시간 제한 2초, onFailure 없음(기본값이 「이어 간다」) */
const ourGroup = url => ({ hooks: [{ type: 'http', url, timeout: HOOK_TIMEOUT }] });

/** 표식이 있는 줄을 걷어 낸다(주어진 값을 고친다). 솔리오가 비운 묶음 · 사건 배열 · hooks 칸만 지운다. @returns 걷어 낸 줄 수 */
function stripMarked(settings) {
  const hooks = settings.hooks;
  if (!isObject(hooks)) return 0;
  let removed = 0;
  const hadEvents = Object.keys(hooks).length > 0;
  for (const event of Object.keys(hooks)) {
    const groups = hooks[event];
    if (!Array.isArray(groups)) continue;
    const kept = [];
    let touched = false;
    for (const g of groups) {
      if (isObject(g) && Array.isArray(g.hooks)) {
        const rest = g.hooks.filter(h => !isMarked(h));
        if (rest.length !== g.hooks.length) {
          removed += g.hooks.length - rest.length;
          touched = true;
          if (!rest.length) continue; // 솔리오의 줄만 든 묶음
          put(g, 'hooks', rest);
        }
      }
      kept.push(g);
    }
    if (!touched) continue;
    if (kept.length) put(hooks, event, kept); else delete hooks[event];
  }
  if (removed && hadEvents && Object.keys(hooks).length === 0) delete settings.hooks;
  return removed;
}
/** 솔리오의 줄 한 벌을 더한다. 같은 사건의 배열이 있으면 그 끝에. hooks나 사건 칸이 모르는 꼴이면 null(고치지 않는다) */
function addOurs(settings, url) {
  if (settings.hooks === undefined) put(settings, 'hooks', {});
  if (!isObject(settings.hooks)) return null;
  for (const event of EVENTS) {
    const cur = own(settings.hooks, event) ? settings.hooks[event] : undefined;
    if (cur === undefined) put(settings.hooks, event, [ourGroup(url)]);
    else if (Array.isArray(cur)) cur.push(ourGroup(url));
    else return null;
  }
  return settings;
}
function markedUrls(settings) {
  const out = [];
  if (!isObject(settings?.hooks)) return out;
  for (const event of Object.keys(settings.hooks)) {
    const groups = settings.hooks[event];
    if (!Array.isArray(groups)) continue;
    for (const g of groups) if (isObject(g) && Array.isArray(g.hooks)) for (const h of g.hooks) if (isMarked(h)) out.push([event, h.url]);
  }
  return out;
}

/* ── 글 꼴: 손님 파일의 들여쓰기, 줄 끝, 마지막 줄바꿈, BOM을 그대로 쓴다 ── */
function styleOf(text) {
  if (text == null) return { indent: 2, eol: '\n', final: true, bom: false };
  const bom = text.charCodeAt(0) === 0xfeff;
  const body = bom ? text.slice(1) : text;
  const m = /\n([ \t]+)\S/.exec(body);
  const indent = m ? (m[1].includes('\t') ? '\t' : Math.min(8, m[1].length)) : 2;
  return { indent, eol: body.includes('\r\n') ? '\r\n' : '\n', final: /\n$/.test(body), bom };
}
function render(value, style) {
  let s = JSON.stringify(value, null, style.indent);
  if (style.eol !== '\n') s = s.replace(/\n/g, style.eol);
  return (style.bom ? '﻿' : '') + s + (style.final ? style.eol : '');
}
/* 손님 파일을 읽는다. 글자 그대로, BOM을 떼고 읽은 값. JSON 객체가 아니면(주석 포함) value가 없다 */
function parse(text) {
  if (typeof text !== 'string' || text.length > SETTINGS_MAX) return null;
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  try { const v = JSON.parse(body); return isObject(v) ? v : null; } catch { return null; }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ── 받은 값 고르기(12.2) ── */
const str = (v, max) => (typeof v === 'string' && v && v.length <= max ? v : null);
const lastSegment = p => String(p).replace(/[\\/]+$/, '').split(/[\\/]+/).filter(Boolean).pop() || '';
/** 도구의 자세한 것: 파일 도구는 경로의 끝 마디, 명령 도구는 명령의 첫 낱말(경로를 떼고, 「이름=값」 같은 것은 버린다). 그 밖에는 없다 */
function toolDetailOf(toolName, input) {
  if (!isObject(input) || typeof toolName !== 'string') return null;
  if (FILE_TOOLS.has(toolName)) {
    for (const k of ['file_path', 'notebook_path', 'path']) {
      const v = input[k];
      if (typeof v === 'string' && v.trim() && v.length <= 4096) { const seg = lastSegment(v.trim()); return seg && !CONTROL.test(seg) ? seg.slice(0, LIMITS.toolDetail) : null; }
    }
    return null;
  }
  if (COMMAND_TOOLS.has(toolName) && typeof input.command === 'string') {
    const cmd = input.command.trimStart().slice(0, 4096);
    const quoted = /^(["'])([^"'\r\n]*)\1/.exec(cmd); // 「"C:\Program Files\git.exe" status」처럼 따옴표로 싼 첫 낱말
    const word = lastSegment(quoted ? quoted[2] : cmd.split(/\s+/)[0] || '');
    return /^[\p{L}\p{N}._+-]{1,40}$/u.test(word) ? word : null;
  }
  return null;
}
/** 훅의 몸 하나를 office.cjs ingest의 꼴로. 모르는 사건이나 세션 번호가 없으면 null */
function hookEvent(body, at) {
  if (!isObject(body)) return null;
  const event = body.hook_event_name;
  if (!EVENTS.includes(event)) return null;
  const sessionId = str(body.session_id, LIMITS.sessionId);
  if (!sessionId) return null;
  const out = { kind: 'hook', event, sessionId, at };
  const cwd = str(body.cwd, LIMITS.cwd);
  if (cwd) out.cwd = cwd;
  if (event === 'PostToolUse') {
    const toolName = str(body.tool_name, LIMITS.toolName);
    if (toolName) {
      out.toolName = toolName;
      const detail = toolDetailOf(toolName, body.tool_input);
      if (detail) out.toolDetail = detail;
    }
  }
  if (event === 'Notification') { const n = str(body.notification_type, LIMITS.notificationType); if (n) out.notificationType = n; }
  const agentId = str(body.agent_id, LIMITS.agentId);
  if (agentId) out.agentId = agentId;
  return out;
}

function createOfficeHooks({
  userData, installed = false, env = process.env, fsImpl = fs, httpImpl = http, now = () => Date.now(),
  randomBytes = n => crypto.randomBytes(n), randomInt = (a, b) => crypto.randomInt(a, b + 1),
  baseDirs = () => defaultRoots().claude, // 설치본이 끌 때 함께 보는 기본 설정 폴더
  accepts = () => false, deliver = () => {}, onChange = () => {},
  setTimeout: after = setTimeout, setInterval: every = setInterval, clearInterval: stopEvery = clearInterval,
  portRange = PORT_RANGE, listenRetries = 2, listenRetryMs = 1000,
} = {}) {
  const fsp = fsImpl.promises;
  const stateFile = typeof userData === 'string' && userData ? path.join(userData, 'Office', STATE_FILE) : null;
  const override = installed ? [] : overrideDirs(env);
  const available = () => !!stateFile && (installed || override.length > 0);
  let state = { enabled: false, port: null, token: null, dirs: [], enabledAt: null, notice: null };
  let raw = null; // 파일의 모르는 칸은 그대로 둔다
  let loaded = null, fileMark = null; // 마지막으로 읽거나 쓴 상태 파일의 고친 때와 크기
  let server = null, listenAt = null, heard = false, watchTimer = null;
  const lastCodes = new Map(); // 설정 폴더 → 마지막 고치기의 거절 까닭(메모리에만)
  let queue = Promise.resolve();
  const serial = job => { const p = queue.then(job, job); queue = p.catch(() => {}); return p; };
  const notify = () => { try { onChange(); } catch { /* 화면 쪽 잘못은 여기서 멈추지 않는다 */ } };

  /* ── 상태 파일 ── */
  function take(v) {
    raw = isObject(v) ? v : null;
    const port = Number(v?.port), at = Number(v?.enabledAt);
    state = {
      enabled: v?.enabled === true,
      port: Number.isInteger(port) && port > 0 && port < 65536 ? port : null,
      token: typeof v?.token === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(v.token) ? v.token : null,
      dirs: uniqueDirs(v?.dirs),
      enabledAt: Number.isFinite(at) ? at : null,
      notice: v?.notice === 'port' ? 'port' : null,
    };
    if (state.enabled && (!state.port || !state.token)) state.enabled = false;
  }
  async function stamp() { try { const s = await fsp.stat(stateFile); return s.mtimeMs + ':' + s.size; } catch { return null; } }
  /* 고친 때와 크기는 읽기 전에 잡는다. 읽는 사이에 다른 실행이 고쳤으면 다음 refresh가 다시 읽는다(GPT 검수 r9 GA6) */
  async function load() {
    if (!stateFile) return;
    const mark = await stamp();
    let v = null;
    try { v = JSON.parse(await fsp.readFile(stateFile, 'utf8')); } catch { v = null; }
    take(v);
    fileMark = mark;
    loaded = true;
  }
  async function save() {
    if (!stateFile) return;
    const dir = path.dirname(stateFile), tmp = path.join(dir, `${STATE_FILE}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`);
    const out = { ...(raw || {}), enabled: state.enabled, port: state.port, token: state.token, dirs: state.dirs, enabledAt: state.enabledAt, notice: state.notice };
    try {
      await fsp.mkdir(dir, { recursive: true });
      await fsp.writeFile(tmp, JSON.stringify(out, null, 2) + '\n', 'utf8');
      await fsp.rename(tmp, stateFile);
      raw = out;
    } catch { try { await fsp.unlink(tmp); } catch { /* 없을 수 있다 */ } }
    fileMark = null; // 쓴 뒤에 다른 실행이 고쳤을 수 있다. 다음 refresh가 한 번 다시 읽는다
  }
  /* 다른 실행(--office-unhook)이 상태 파일을 고쳤으면 다시 읽는다. 꺼졌으면 서버를 닫는다 */
  async function refresh() {
    if (!loaded) { await load(); return; }
    const mark = await stamp();
    if (mark === fileMark) return;
    await load();
    if (!state.enabled && server) await stop();
  }

  /* ── 서버(12.2) ── */
  const tokenIs = (url, token) => {
    if (typeof token !== 'string' || !token || typeof url !== 'string') return false;
    const want = Buffer.from(PATH_PREFIX + token), got = Buffer.from(url);
    return want.length === got.length && crypto.timingSafeEqual(want, got);
  };
  const tokenOk = url => tokenIs(url, state.token);
  /* 훅을 받을지는 소식마다 상태 파일을 새로 읽어 정한다. 기억해 둔 값이나 고친 때로 정하지 않는다(GPT 검수 r8 GA2 · r9 GA6, 12.2 「받을지 정하는 때」).
     켜져 있고 확인 값이 있으면 그 값을, 아니면 null. 다른 실행(--office-unhook)이 끈 뒤에 정하는 소식은 모두 받지 않는다 */
  async function liveToken() {
    if (!stateFile) return null;
    try { const v = JSON.parse(await fsp.readFile(stateFile, 'utf8')); return isObject(v) && v.enabled === true && typeof v.token === 'string' && v.token ? v.token : null; } catch { return null; }
  }
  /* 꺼진 것을 본 요청은 메모리의 상태도 맞추고 서버를 닫게 한다 */
  const resync = () => { void serial(refresh).catch(() => {}); };
  /* 버리는 답: 연결을 닫고 남은 몸은 읽지 않는다 */
  function refuse(res, req, status) {
    res.writeHead(status, { 'Content-Length': '0', Connection: 'close' });
    res.on('finish', () => req.destroy());
    res.end();
  }
  function handle(req, res) {
    const at = now();
    req.on('error', () => {});
    res.on('error', () => {});
    if (req.method !== 'POST' || !tokenOk(req.url)) { refuse(res, req, 404); return; }
    const tooBig = () => refuse(res, req, 413);
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > BODY_MAX) { tooBig(); return; }
    req.pause();
    // 받기 전에 상태 파일을 새로 읽는다. 꺼졌거나 확인 값이 바뀌었으면 받지 않는다
    liveToken().then(token => {
      if (!tokenIs(req.url, token)) { refuse(res, req, 404); resync(); return; }
      if (!heard) { heard = true; notify(); }
      return receive(req, res, at, tooBig, token);
    });
  }
  /* accepts가 돌려준 값(볼 계정)을 그대로 deliver에 넘긴다. 받는 사이에 계정이 바뀌어도 받기를 허락한 계정으로만 접는다(GPT 검수 r8 GA1) */
  function receive(req, res, at, tooBig, token) {
    return Promise.resolve().then(() => accepts()).catch(() => false).then(ok => {
      let size = 0, chunks = ok ? [] : null, over = false;
      req.on('data', chunk => {
        if (over) return;
        size += chunk.length;
        if (size > BODY_MAX) { over = true; chunks = null; req.pause(); tooBig(); return; }
        if (chunks) chunks.push(chunk);
      });
      req.on('end', () => {
        if (over) return;
        if (!chunks) { res.writeHead(204); res.end(); return; } // 볼 계정이 없으면 읽지 않고 버린다(11.1)
        const body = Buffer.concat(chunks);
        chunks = null;
        // 몸을 다 받은 뒤, 넘기기 바로 앞에서 상태 파일을 한 번 더 새로 읽는다. 받는 사이에 꺼졌거나 확인 값이 바뀌었으면 넘기지 않는다(r9 GA6)
        liveToken().then(now => {
          if (now !== token) { refuse(res, req, 404); resync(); return; }
          res.writeHead(204);
          res.end(); // 접기를 기다리지 않고 답한다
          let value = null;
          try { value = JSON.parse(body.toString('utf8')); } catch { value = null; }
          const event = hookEvent(value, at);
          value = null;
          if (!event) return;
          try { deliver(event, ok); } catch { /* 접지 못해도 받기는 그대로 */ }
        });
      });
      req.resume();
    });
  }
  function listenOn(port) {
    return new Promise(resolve => {
      const s = httpImpl.createServer(handle);
      s.headersTimeout = 5000;
      s.requestTimeout = 15000;
      s.keepAliveTimeout = 2000;
      s.maxHeadersCount = 40;
      const fail = error => { s.removeListener('listening', ok); try { s.close(); } catch { /* 열리지 않았다 */ } resolve({ ok: false, code: error?.code || 'LISTEN' }); };
      const ok = () => { s.removeListener('error', fail); s.on('error', () => {}); s.unref?.(); resolve({ ok: true, server: s, port: s.address().port }); };
      s.once('error', fail);
      s.once('listening', ok);
      try { s.listen({ host: HOST, port, exclusive: true }); } catch (error) { fail(error); }
    });
  }
  const pause = ms => new Promise(resolve => { const t = after(resolve, ms); t?.unref?.(); });
  /* 저장한 포트로 연다. 앞의 실행이 아직 닫히는 중일 수 있어 잠깐 기다려 다시 해 본다 */
  async function listenSaved(retries) {
    let r = await listenOn(state.port);
    for (let i = 0; !r.ok && r.code === 'EADDRINUSE' && i < retries; i++) { await pause(listenRetryMs); r = await listenOn(state.port); }
    return r;
  }
  /* 처음 켤 때 빈 포트를 고른다 */
  async function listenFresh() {
    for (let i = 0; i < PORT_TRIES; i++) {
      const r = await listenOn(randomInt(portRange[0], portRange[1]));
      if (r.ok) return r;
    }
    return listenOn(0);
  }
  /* 서버가 열려 있는 동안 1분마다 상태 파일을 본다. 다른 실행이 훅을 껐으면 소식이 오지 않아도 서버를 닫는다(GPT 검수 r8 GA2) */
  function serve(r) {
    server = r.server; listenAt = now(); heard = false;
    if (!watchTimer) { watchTimer = every(() => { void serial(refresh).catch(() => {}); }, REFRESH_MS); watchTimer?.unref?.(); }
  }
  async function stop() {
    const s = server;
    server = null; listenAt = null;
    if (watchTimer) { stopEvery(watchTimer); watchTimer = null; }
    if (s) await new Promise(resolve => { try { s.close(() => resolve()); s.closeAllConnections?.(); } catch { resolve(); } });
  }
  const newToken = () => Buffer.from(randomBytes(32)).toString('base64url');

  /* ── 설정 파일 고치기(12.3 ①~⑥) ── mode 'add'는 표식 줄을 걷고 한 벌 더하기, 'remove'는 걷어 내기만.
     @returns { dir, ok, code?, created?, unchanged?, skipped? }. code: READ(JSON이 아님), BUSY(바뀌는 중), WRITE(쓰지 못함) */
  async function readText(file) {
    let st;
    try { st = await fsp.lstat(file); } catch (e) { return e && e.code === 'ENOENT' ? { missing: true } : { error: true }; }
    // 링크로 이은 파일은 이름을 바꿔 넣으면 링크가 끊긴다. 고치지 않는다
    if (st.isSymbolicLink() || !st.isFile() || st.nlink > 1 || st.size > SETTINGS_MAX) return { refuse: true };
    try { return { text: await fsp.readFile(file, 'utf8') }; } catch (e) { return e && e.code === 'ENOENT' ? { missing: true } : { error: true }; }
  }
  /* Windows에서는 다른 프로그램이 그 파일을 막 읽는 동안 이름 바꾸기가 잠깐 거절된다. 짧게 몇 번 다시 해 본다 */
  async function renameOver(from, to) {
    for (let i = 0; ; i++) {
      try { await fsp.rename(from, to); return; } catch (e) {
        if (i >= 4 || !['EPERM', 'EBUSY', 'EACCES'].includes(e?.code)) throw e;
        await pause(40);
      }
    }
  }
  async function writeAtomic(file, text) {
    const tmp = path.join(path.dirname(file), `.${SETTINGS}.synk-${process.pid}-${crypto.randomBytes(4).toString('hex')}.tmp`);
    try { await fsp.writeFile(tmp, text, 'utf8'); await renameOver(tmp, file); return true; } catch { try { await fsp.unlink(tmp); } catch { /* 없을 수 있다 */ } return false; }
  }
  async function editDir(dir, mode, url) {
    try { if (!(await fsp.stat(dir)).isDirectory()) return { dir, ok: true, skipped: true }; } catch { return { dir, ok: true, skipped: true }; } // 설정 폴더가 없으면 건너뛴다
    const file = path.join(dir, SETTINGS), backup = path.join(dir, BACKUP);
    let backedUp = false;
    try {
      for (let pass = 0; pass < 2; pass++) {
        const last = pass === 1;
        // ① 읽는다 ② JSON 객체가 아니면 고치지 않는다
        const first = await readText(file);
        if (first.error || first.refuse) return { dir, ok: false, code: 'READ' };
        if (first.missing && mode === 'remove') return { dir, ok: true, unchanged: true };
        const original = first.missing ? null : first.text;
        const base = original == null ? {} : parse(original);
        if (!base) return { dir, ok: false, code: 'READ' };
        // ③ 고친 내용을 만든다
        const next = original == null ? {} : parse(original);
        stripMarked(next);
        if (mode === 'add' && !addOurs(next, url)) return { dir, ok: false, code: 'READ' };
        if (original != null && same(next, base)) return { dir, ok: true, unchanged: true };
        const text = render(next, styleOf(original));
        // ④ 쓰기 직전에 다시 읽어 ①과 같은지 본다
        const again = await readText(file);
        if (original == null ? !again.missing : again.text !== original) { if (last) return { dir, ok: false, code: 'BUSY' }; continue; }
        // ⑤ 옛 내용의 사본을 두고, 같은 폴더의 임시 파일에 써서 이름을 바꿔 넣는다
        if (original != null) { await fsp.writeFile(backup, original, 'utf8'); backedUp = true; }
        if (!(await writeAtomic(file, text))) return { dir, ok: false, code: 'WRITE' };
        // ⑥ 다시 읽어 솔리오의 줄이 있고 나머지가 그대로인지 본다
        const check = await readText(file);
        const written = check.text != null ? parse(check.text) : null;
        if (!written) {
          // 깨졌을 때만 사본으로 되돌린다(사본의 이름을 바꿔 넣으면 사본도 없어진다). 새로 만든 파일은 되돌릴 옛 내용이 없어 그대로 둔다
          let restored = false;
          if (check.text != null && backedUp) { try { await renameOver(backup, file); backedUp = false; restored = true; } catch { /* 아래에서 사본을 지운다 */ } }
          return { dir, ok: false, code: 'WRITE', restored };
        }
        const urls = markedUrls(written);
        const rest = parse(check.text); stripMarked(rest);
        const want = parse(text); stripMarked(want);
        const oursOk = mode === 'add' ? urls.length === EVENTS.length && urls.every(([, u]) => u === url) && EVENTS.every(e => urls.some(([x]) => x === e)) : urls.length === 0;
        if (oursOk && same(rest, want)) return { dir, ok: true, created: original == null };
        // 읽히는데 다르면 그사이 다른 프로그램이 고친 것이다. 되돌리지 않고 처음부터 한 번 더 한다
        if (last) return { dir, ok: false, code: 'BUSY' };
      }
      return { dir, ok: false, code: 'BUSY' };
    } catch {
      return { dir, ok: false, code: 'WRITE' };
    } finally {
      // 설정 파일의 env에는 비밀값이 있을 수 있어 사본을 남기지 않는다(어느 쪽이든 지운다)
      if (backedUp) { try { await fsp.unlink(backup); } catch { /* 이미 없다 */ } }
    }
  }

  /* 끌 때 보는 폴더: 적어 둔 폴더와, 설치본이면 기본 설정 폴더, 아니면 넘겨받은 폴더. 적어 두지 않은 폴더의 거절은 세지 않는다 */
  function removalTargets() {
    let extra = [];
    if (installed) { try { extra = typeof baseDirs === 'function' ? baseDirs() : baseDirs; } catch { extra = []; } } else extra = override;
    return uniqueDirs([...state.dirs, ...(Array.isArray(extra) ? extra : [])]);
  }
  async function removeAll() {
    const results = [];
    for (const dir of removalTargets()) results.push(await editDir(dir, 'remove'));
    const stuck = results.filter(r => !r.ok && hasDir(state.dirs, r.dir));
    for (const r of results) { if (r.ok) lastCodes.delete(dirKey(r.dir)); else if (hasDir(state.dirs, r.dir)) lastCodes.set(dirKey(r.dir), { code: r.code, on: false }); }
    return { results, stuck };
  }

  /** 앱을 켤 때(플랫폼 창, 스모크 아님). 켜져 있으면 저장한 포트로 연다. 다른 프로그램이 쓰고 있으면 솔리오의 줄을 바로 지운다(묻지 않는다, 12.3) */
  function start() {
    return serial(async () => {
      await load();
      if (!state.enabled || server || !available()) return { ok: true, listening: !!server };
      const r = await listenSaved(listenRetries);
      if (r.ok) { serve(r); return { ok: true, listening: true }; }
      const { stuck } = await removeAll();
      state.dirs = stuck.map(x => x.dir);
      state.enabled = state.dirs.length > 0;
      state.notice = 'port';
      await save();
      notify();
      return { ok: false, code: 'PORT', listening: false };
    });
  }

  /** 켜기(두 번 확인 뒤). roots: 계정의 보는 폴더 가운데 Claude 설정 폴더(설치본만 쓴다). 그 밖의 실행은 넘겨받은 폴더만 고친다 */
  function enable(roots) {
    return serial(async () => {
      await refresh();
      if (!available()) return { ok: false, code: 'NOT_HERE' };
      const targets = installed ? uniqueDirs(roots) : override;
      if (!targets.length) return { ok: false, code: 'NO_DIRS' };
      const wasOn = state.enabled;
      let opened = false;
      if (!server) {
        let r = state.port && state.token ? await listenSaved(0) : { ok: false };
        if (!r.ok) {
          r = await listenFresh();
          if (!r.ok) return { ok: false, code: 'PORT' };
          state.port = r.port;
          state.token = newToken(); // 새 자리는 새 확인 값으로
        }
        serve(r); opened = true;
      }
      if (!state.token) state.token = newToken();
      const url = hookUrl(state.port, state.token);
      const results = [];
      for (const dir of targets) results.push(await editDir(dir, 'add', url));
      for (const r of results) { if (r.ok && !r.skipped) lastCodes.delete(dirKey(r.dir)); else if (!r.ok) lastCodes.set(dirKey(r.dir), { code: r.code, on: true }); }
      const written = results.filter(r => r.ok && !r.skipped).map(r => r.dir);
      state.dirs = uniqueDirs([...state.dirs, ...written]);
      if (!state.dirs.length) {
        if (opened) await stop();
        const refused = results.find(r => !r.ok);
        return { ok: false, code: refused ? refused.code : 'NO_DIRS', ...summary(results) };
      }
      state.enabled = true;
      state.notice = null;
      if (!wasOn) { state.enabledAt = now(); heard = false; }
      await save();
      notify();
      const refused = results.find(r => !r.ok);
      return { ok: true, ...(refused ? { code: refused.code } : {}), ...summary(results) };
    });
  }

  /** 끄기: 표식이 있는 줄만 지운다. 지우지 못한 폴더가 남으면 그 폴더는 켜진 채로 두고 까닭을 보인다 */
  function disable() {
    return serial(async () => {
      await refresh();
      // 끔을 상태 파일에 먼저 적고 줄을 지운다. 켜져 있던 다른 실행은 이때부터 소식을 받지 않는다(r9 GA6). 지우지 못한 폴더가 남으면 아래에서 다시 켬으로 적는다
      if (state.enabled) { state.enabled = false; await save(); }
      const { results, stuck } = await removeAll();
      state.dirs = stuck.map(x => x.dir);
      state.enabled = state.dirs.length > 0;
      if (!state.enabled) { await stop(); state.notice = null; }
      await save();
      notify();
      return stuck.length ? { ok: false, code: stuck[0].code, ...summary(results) } : { ok: true, ...summary(results) };
    });
  }
  const summary = results => ({ written: results.filter(r => r.ok && !r.skipped && !r.unchanged).length, created: results.filter(r => r.created).length, refused: results.filter(r => !r.ok).length });

  /** 화면에 넘기는 모습. roots: 계정의 Claude 설정 폴더. 포트와 확인 값은 넘기지 않는다.
      { on, available, dirs:[{ dir, on, folder, file, code }], message:'port'|'silent'|null } */
  async function status(roots = []) {
    await serial(refresh);
    const list = uniqueDirs([...(installed ? roots : override), ...state.dirs]);
    const dirs = [];
    for (const dir of list) {
      let folder = false, file = false;
      try { folder = (await fsp.stat(dir)).isDirectory(); } catch { folder = false; }
      if (folder) { try { file = (await fsp.stat(path.join(dir, SETTINGS))).isFile(); } catch { file = false; } }
      const last = lastCodes.get(dirKey(dir));
      dirs.push({ dir, on: state.enabled && hasDir(state.dirs, dir), folder, file, code: last ? last.code : null });
    }
    let message = null;
    if (state.notice === 'port') message = 'port';
    else if (state.enabled && server && !heard && now() - Math.max(state.enabledAt ?? 0, listenAt ?? 0) >= SILENT_MS) message = 'silent';
    return { on: state.enabled, available: available(), dirs, message };
  }

  /** --office-unhook(지우는 프로그램): 서버 없이 솔리오의 줄만 지운다 */
  const unhook = () => disable();

  /** 앱을 끌 때 */
  function closeServer() { return stop(); }

  return { start, enable, disable, unhook, status, close: closeServer, listening: () => !!server, address: () => (server ? server.address() : null), available, stateFile, override };
}

module.exports = { createOfficeHooks, isMarked, stripMarked, addOurs, hookEvent, toolDetailOf, overrideDirs, hookUrl, EVENTS, OVERRIDE_ENV, BODY_MAX, SILENT_MS, PATH_PREFIX, HOST, PORT_RANGE };
