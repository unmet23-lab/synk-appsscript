'use strict';
// 솔리오 「사무실」의 훅을 받는 서버와 Claude Code 설정 파일 고치기(15절 5단계). 설계: docs/디자인/솔리오_사무실_20261119/구현설계.md
// 3.2 · 3.4의 6 · 7 · 11.1 · 12.1 · 12.2 · 12.3. 설정 파일에는 알림 여섯 가지를 적는다. SessionStart는 HTTP로 오지 않아 적지 않는다(21절 훅 길 확인).
//  · 서버는 127.0.0.1에만 묶는다. 길은 /synk-office/<확인 값> 하나다. POST가 아니거나 확인 값이 틀리면 404로 닫는다.
//    몸이 2MB를 넘으면 더 읽지 않고 413으로 닫는다. JSON이 아니거나 모르는 사건이면 받고(204) 버린다. 답은 몸을 다 받자마자 하고, 접는 일은 그 뒤에 한다.
//  · 받은 값에서 남기는 것은 세션 번호, 작업 폴더, 사건 이름, 도구 이름, 파일 이름(경로의 끝 마디)이나 명령의 첫 낱말, 알림 종류, 도우미 번호, 받은 때다(12.2).
//    명령 전체, 파일 내용, 도구 결과, 마지막 답은 읽자마자 버린다. 받은 값으로는 아무것도 파일에 쓰거나 로그로 남기지 않는다.
//  · 볼 계정이 로그인해 있지 않으면(accepts가 거짓) 몸을 읽지 않고 흘려보낸 뒤 204로 답한다. 계정이 바뀌어도 서버는 닫지 않는다(11.1).
//  · 상태 파일의 두 칸이 하는 일을 가른다(설계 검토 solio-office-hooks-20261121 (나)). dirs는 솔리오의 줄이 있을 수 있는 폴더다. 고치기 전에 늘리고,
//    줄이 없음을 읽어서 확인했을 때만 줄인다. enabled는 「소식을 받는가」다. 켜기가 다 끝나고 저장된 뒤에만 참으로 쓰고, 끄기는 맨 먼저 거짓으로 쓴다.
//    dirs가 비지 않으면 그 줄이 가리키는 포트를 쥐고(남이 그 포트를 열지 않게), enabled일 때만 몸을 읽는다. 메모리의 받기는 닫힌 채로 시작한다.
//    accepts는 요청이 들어온 그 틱에 묻는다. 그때의 계정과 로그인 회차가 그 소식의 묶음이다(GPT 검수 GA2).
//  · 받을지는 메모리의 받기 값(closed와 세대 acceptGen)으로 정한다. 넘기는 틱 안에서 기다림 없이 본다. 끄기(disable)는 부른 틱 안에서,
//    차례에 넣기 전에 받기를 닫는다. 넘길 때 세대를 표로 함께 넘기고, office.cjs의 ingest가 접기 바로 앞에서 accepting(표)로 다시 본다.
//  · 상태 파일을 쓰는 실행은 언제나 하나다(설계 검토의 단일 실행 잠금 설계, GPT 검수 r8 GA2 · r9 GA6 · r10 GA5). 앱은 단일 실행 잠금을 쥔다.
//    --office-unhook은 잠금을 얻으면 혼자 끄고, 못 얻으면 켜진 앱이 second-instance로 받아 끈다(runUnhook). 그래서 다른 실행이 고쳤는지
//    상태 파일을 다시 읽어 맞추지 않는다. 처음 쓸 때 한 번 읽는다. 지우는 실행은 잠금을 청할 때 확인 값(nonce)을 넘기고, 켜진 앱은 끄기를 마친 뒤
//    그 값과 남은 폴더 수를 상태 파일의 unhooked에 적는다. 지우는 실행은 그 값을 보고서야 끝 값을 낸다.
//  · 상태 파일은 userData/Office/hooks.json 하나다(받는지, 포트, 확인 값, 줄이 있을 수 있는 폴더, 한 번이라도 적은 폴더, 꺼진 까닭, 지우는 실행의 확인).
//    desktop-preferences.json에는 넣지 않는다(12.1). 켤 때는 손님 파일을 고치기 전에 고칠 폴더를 먼저 적는다. 적지 못하면 고치지 않는다(GPT 검수 GA3).
//  · 실제 설정 파일은 설치본(release 판)만 고친다. 미리보기 · 소스 실행 · 시험 · QA는 SYNK_OFFICE_HOOK_DIRS(경로 구분자로 이은 절대 경로)로
//    넘겨받은 폴더만 고치고(끌 때도, GA5), 넘겨받지 않았으면 켜기가 NOT_HERE(「이 실행에서는 켤 수 없습니다」)로 끝난다(12.3).
//  · 설정 파일 고치기는 12.3의 ①~⑥이다. 솔리오의 줄은 HTTP 꼴이고, 주소가 127.0.0.1이고, 길이 /synk-office/로 시작하는 줄이다(셋 다).
//    더하기 전에 표식이 있는 줄을 모두 걷어 내고 새로 적는다. 다른 칸과 다른 훅은 읽은 그대로 둔다. 바뀌는 것이 없으면 쓰지 않는다.
//    약속은 「디스크의 바이트가 솔리오가 읽은 바이트와 같을 때만 바꾼다」 하나다. 바꿔 넣기를 시도할 때마다 그 바로 앞에서 다시 읽어 견주고
//    부른 쪽의 계정 묶음(guard)도 본다. 사본을 두지 않고 되돌리지 않는다. 쓴 뒤에는 디스크가 솔리오가 쓴 바이트 그대로인지만 본다(설계 검토 (가)).
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
/* --office-unhook이 켜진 앱의 끄기를 상태 파일로 확인하는 시간. 설치기의 상한(10초, office-unhook.nsh)보다 짧다 */
const UNHOOK_WAIT_MS = 8000;
const UNHOOK_POLL_MS = 100;
/* --office-unhook의 끝 값. 0은 끄기를 마쳤고 남은 폴더가 없을 때뿐이다. 설치기는 이 값으로 멈추지 않는다(기록용) */
const UNHOOK_EXIT = Object.freeze({ OK: 0, FAILED: 1, LEFT: 2, UNCONFIRMED: 3 });
const STATE_FILE = 'hooks.json';
const SETTINGS = 'settings.json';
const VISITED_MAX = 16; // 한 번이라도 줄을 적은 폴더. 앱을 지울 때 dirs와 함께 한 번 더 훑는다(설계 검토 5의 2)
const OVERRIDE_ENV = 'SYNK_OFFICE_HOOK_DIRS';
/* 포트는 Windows가 나가는 연결에 쓰는 범위(49152~) 아래에서 고른다. 솔리오가 꺼진 사이 다른 연결이 그 포트를 잡을 일을 줄인다 */
const PORT_RANGE = Object.freeze([30000, 48999]);
const PORT_TRIES = 20;
const FILE_TOOLS = new Set(['Read', 'Edit', 'MultiEdit', 'Write', 'NotebookEdit', 'NotebookRead', 'Grep', 'Glob', 'LS']);
const COMMAND_TOOLS = new Set(['Bash', 'PowerShell']);
const MISSING = new Set(['ENOENT', 'ENOTDIR']);
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
const stateFileOf = userData => (typeof userData === 'string' && userData ? path.join(userData, 'Office', STATE_FILE) : null);

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
  return (style.bom ? '\uFEFF' : '') + s + (style.final ? style.eol : ''); // BOM은 보이지 않는 글자라 이스케이프로 적는다(0.5.2 공개 검수 C1)
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
    const first = quoted ? quoted[2] : cmd.split(/\s+/)[0] || '';
    // 「이름=값」은 경로를 떼기 전에 본다. 「TOKEN=값/조각」의 끝 마디가 첫 낱말로 넘어가지 않게(GPT 검수 GA4)
    if (first.includes('=')) return null;
    const word = lastSegment(first);
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
  setTimeout: after = setTimeout,
  portRange = PORT_RANGE, listenRetries = 2, listenRetryMs = 1000,
} = {}) {
  const fsp = fsImpl.promises;
  const stateFile = stateFileOf(userData);
  const override = installed ? [] : overrideDirs(env);
  const available = () => !!stateFile && (installed || override.length > 0);
  let state = { enabled: false, port: null, token: null, dirs: [], visited: [], enabledAt: null, notice: null, unhooked: null };
  let raw = null; // 파일의 모르는 칸은 그대로 둔다
  let loaded = false;
  let server = null, listenAt = null, heard = false;
  /* 받기: closed가 참이면 받지 않는다. 닫을 때마다 세대가 하나씩 는다. 넘긴 소식의 표(세대)는 닫힌 뒤에는 맞지 않는다 */
  let closed = true, acceptGen = 0; // 메모리의 받기는 디스크의 enabled보다 먼저 열리지 않는다(설계 검토 (나))
  const lastCodes = new Map(); // 설정 폴더 → 마지막 고치기의 거절 까닭(메모리에만)
  let queue = Promise.resolve();
  const serial = job => { const p = queue.then(job, job); queue = p.catch(() => {}); return p; };
  const notify = () => { try { onChange(); } catch { /* 화면 쪽 잘못은 여기서 멈추지 않는다 */ } };
  const unlinkQuiet = async file => { try { await fsp.unlink(file); } catch { /* 없을 수 있다 */ } };

  /* ── 받기 ── 기다림 없이 부르고 본다 */
  function closeAcceptance() { closed = true; acceptGen += 1; }
  /** 그 표로 넘긴 소식을 아직 접어도 되는지. office.cjs의 ingest가 접기 바로 앞에서 부른다 */
  const accepting = ticket => !closed && ticket === acceptGen;

  /* ── 상태 파일 ── */
  function take(v) {
    raw = isObject(v) ? v : null;
    const port = Number(v?.port), at = Number(v?.enabledAt);
    state = {
      enabled: v?.enabled === true,
      port: Number.isInteger(port) && port > 0 && port < 65536 ? port : null,
      token: typeof v?.token === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(v.token) ? v.token : null,
      dirs: uniqueDirs(v?.dirs),
      visited: uniqueDirs(v?.visited).slice(-VISITED_MAX),
      enabledAt: Number.isFinite(at) ? at : null,
      notice: v?.notice === 'port' ? 'port' : null,
      unhooked: null,
    };
    if (state.enabled && (!state.port || !state.token || !state.dirs.length)) state.enabled = false;
  }
  /* 처음 쓸 때 한 번 읽는다. 그 뒤로는 이 실행만 쓰므로 메모리가 맞다 */
  async function ensure() {
    if (loaded || !stateFile) return;
    let v = null;
    try { v = JSON.parse(await fsp.readFile(stateFile, 'utf8')); } catch { v = null; }
    take(v);
    loaded = true;
  }
  /* 상태 파일을 같은 폴더의 임시 파일에 써서 바꿔 넣는다. @returns 썼는지(GPT 검수 GA3: 못 쓰면 부른 쪽이 성공으로 답하지 않는다) */
  async function save() {
    if (!stateFile) return false;
    const dir = path.dirname(stateFile), tmp = path.join(dir, `${STATE_FILE}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`);
    const out = { ...(raw || {}), enabled: state.enabled, port: state.port, token: state.token, dirs: state.dirs, visited: state.visited, enabledAt: state.enabledAt, notice: state.notice };
    if (state.unhooked) out.unhooked = state.unhooked;
    try {
      await fsp.mkdir(dir, { recursive: true });
      await fsp.writeFile(tmp, JSON.stringify(out, null, 2) + '\n', 'utf8');
      await renameOver(tmp, stateFile);
      raw = out;
      return true;
    } catch {
      await unlinkQuiet(tmp);
      return false;
    }
  }

  /* 줄을 적을 폴더를 dirs와 visited에 더한다 */
  function noteDirs(dirs) {
    state.dirs = uniqueDirs([...state.dirs, ...dirs]);
    state.visited = uniqueDirs([...state.visited, ...dirs]).slice(-VISITED_MAX);
  }

  /* ── 서버(12.2) ── */
  const tokenOk = url => {
    const token = state.token;
    if (typeof token !== 'string' || !token || typeof url !== 'string') return false;
    const want = Buffer.from(PATH_PREFIX + token), got = Buffer.from(url);
    return want.length === got.length && crypto.timingSafeEqual(want, got);
  };
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
    if (req.method !== 'POST' || !tokenOk(req.url) || closed) { refuse(res, req, 404); return; }
    const gen = acceptGen; // 이 요청을 받기 시작한 때의 받기 세대
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > BODY_MAX) { refuse(res, req, 413); return; }
    req.pause();
    if (!heard) { heard = true; notify(); }
    // 볼 계정은 요청이 들어온 이 틱에 묻는다. 그 뒤에 계정이 바뀌어도 이때의 묶음으로만 접는다(GPT 검수 r8 GA1 · GA2)
    let asked;
    try { asked = accepts(); } catch { asked = false; }
    Promise.resolve(asked).catch(() => false).then(ok => receive(req, res, at, ok, gen));
  }
  /* accepts가 돌려준 값(볼 계정)을 그대로 deliver에 넘긴다. 받기가 닫혔거나 세대가 바뀌었으면 넘기지 않는다 */
  function receive(req, res, at, ok, gen) {
    if (closed || acceptGen !== gen) { refuse(res, req, 404); return; }
    let size = 0, chunks = ok ? [] : null, over = false;
    req.on('data', chunk => {
      if (over) return;
      size += chunk.length;
      if (size > BODY_MAX) { over = true; chunks = null; req.pause(); refuse(res, req, 413); return; }
      if (chunks) chunks.push(chunk);
    });
    req.on('end', () => {
      if (over) return;
      if (!chunks) { res.writeHead(204); res.end(); return; } // 볼 계정이 없으면 읽지 않고 버린다(11.1)
      // 넘기는 이 틱에 메모리의 받기 값을 본다. 기다림 없이 deliver까지 간다. 몸을 받는 사이에 끄기가 닫았으면 넘기지 않는다
      if (closed || acceptGen !== gen) { chunks = null; refuse(res, req, 404); return; }
      const body = Buffer.concat(chunks);
      chunks = null;
      res.writeHead(204);
      res.end(); // 접기를 기다리지 않고 답한다
      let value = null;
      try { value = JSON.parse(body.toString('utf8')); } catch { value = null; }
      const event = hookEvent(value, at);
      value = null;
      if (!event) return;
      try { deliver(event, ok, gen); } catch { /* 접지 못해도 받기는 그대로 */ }
    });
    req.resume();
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
  function serve(r) { server = r.server; listenAt = now(); heard = false; }
  async function stop() {
    const s = server;
    server = null; listenAt = null;
    if (s) await new Promise(resolve => { try { s.close(() => resolve()); s.closeAllConnections?.(); } catch { resolve(); } });
  }
  const newToken = () => Buffer.from(randomBytes(32)).toString('base64url');

  /* ── 설정 파일 고치기(12.3 ①~⑥) ── mode 'add'는 표식 줄을 걷고 한 벌 더하기, 'remove'는 걷어 내기만.
     @returns { dir, ok, code?, created?, unchanged?, skipped? }. code: READ(JSON이 아님 · 폴더나 파일을 볼 수 없음), BUSY(바뀌는 중),
     WRITE(쓰지 못함), SIZE(더하면 4MB를 넘음) */
  async function readText(file) {
    let st;
    try { st = await fsp.lstat(file); } catch (e) { return e && e.code === 'ENOENT' ? { missing: true } : { error: true }; }
    // 링크로 이은 파일은 이름을 바꿔 넣으면 링크가 끊긴다. 고치지 않는다
    if (st.isSymbolicLink() || !st.isFile() || st.nlink > 1 || st.size > SETTINGS_MAX) return { refuse: true };
    try { return { text: await fsp.readFile(file, 'utf8') }; } catch (e) { return e && e.code === 'ENOENT' ? { missing: true } : { error: true }; }
  }
  const sameAs = (read, original) => (original == null ? read.missing === true : read.text === original);
  /* Windows에서는 다른 프로그램이 그 파일을 막 읽는 동안 이름 바꾸기가 잠깐 거절된다(지우는 프로그램이 상태 파일을 읽는 때도 그렇다).
     짧게 다시 해 본다. 0.4초쯤까지다 */
  async function renameOver(from, to) {
    for (let i = 0; ; i++) {
      try { await fsp.rename(from, to); return; } catch (e) {
        if (i >= 9 || !['EPERM', 'EBUSY', 'EACCES'].includes(e?.code)) throw e;
        await pause(40);
      }
    }
  }
  /* 같은 폴더의 임시 파일에 쓰고 디스크에 내린(sync) 뒤 바꿔 넣는다. 바꿔 넣기를 시도할 때마다(다시 시도할 때도) 그 바로 앞에서 check()를 부른다.
     check는 손님 파일이 ①과 같은지와 계정 묶음을 보고, 참이 아니면 그 까닭을 돌려준다. check와 이름 바꾸기 사이에는 기다림이 없다(설계 검토 고칠 것 3,
     GPT 검수 be3 GA1 · GA3). @returns true · check가 돌려준 까닭('BUSY' · 'AUTH_CHANGED') · false(쓰지 못함) */
  async function writeAtomic(file, text, check) {
    const tmp = path.join(path.dirname(file), `.${SETTINGS}.synk-${process.pid}-${crypto.randomBytes(4).toString('hex')}.tmp`);
    try {
      await fsp.writeFile(tmp, text, 'utf8');
      try { const h = await fsp.open(tmp, 'r+'); try { await h.sync(); } finally { await h.close(); } } catch { /* 내리지 못해도 바꿔 넣기는 한다 */ }
      for (let i = 0; ; i++) {
        const ok = await check();
        if (ok !== true) { await unlinkQuiet(tmp); return ok; }
        try { await fsp.rename(tmp, file); return true; } catch (e) {
          if (i >= 9 || !['EPERM', 'EBUSY', 'EACCES'].includes(e?.code)) throw e;
          await pause(40);
        }
      }
    } catch { await unlinkQuiet(tmp); return false; }
  }
  /* 솔리오의 줄이 그 주소로 여섯 사건에 다 있는지 */
  function oursIn(value, url) {
    const urls = markedUrls(value);
    return urls.length === EVENTS.length && urls.every(([, u]) => u === url) && EVENTS.every(e => urls.some(([x]) => x === e));
  }
  /* guard: 부른 쪽의 계정 묶음 확인(바꿔 넣기마다 그 바로 앞에서 본다). ok인 'remove'의 답은 그 폴더에 솔리오의 줄이 없음을 확인한 것이다.
     changed: 이번에 손님 파일을 바꿔 넣었다(확인하지 못했어도). 확인하지 못하면 UNCONFIRMED다 */
  async function editDir(dir, mode, url, guard) {
    // 설정 폴더가 없으면 건너뛴다. 있는지 알 수 없으면(권한 등) 건너뛰지 않고 거절로 센다. 적어 둔 폴더는 적힌 채로 남아 다음 끄기가 다시 본다(GPT 검수 GA7)
    let st;
    try { st = await fsp.stat(dir); } catch (e) { return MISSING.has(e?.code) ? { dir, ok: true, skipped: true } : { dir, ok: false, code: 'READ' }; }
    if (!st.isDirectory()) return { dir, ok: true, skipped: true };
    const file = path.join(dir, SETTINGS);
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
        // 더한 줄로 4MB를 넘으면 쓰지 않는다. 넘긴 파일은 다음에 읽지도 끄지도 못한다(GPT 검수 GA8)
        if (Buffer.byteLength(text, 'utf8') > SETTINGS_MAX) return { dir, ok: false, code: 'SIZE' };
        // ④⑤ 같은 폴더의 임시 파일에 써서 바꿔 넣는다. 바꿔 넣기마다 그 바로 앞에서 손님 파일이 ①과 같은지, 계정 묶음이 그대로인지 본다
        const wrote = await writeAtomic(file, text, async () => {
          if (!sameAs(await readText(file), original)) return 'BUSY';
          return typeof guard === 'function' && guard() !== true ? 'AUTH_CHANGED' : true;
        });
        if (wrote === 'BUSY') { if (last) return { dir, ok: false, code: 'BUSY' }; continue; }
        if (wrote === 'AUTH_CHANGED') return { dir, ok: false, code: 'AUTH_CHANGED' };
        if (wrote !== true) return { dir, ok: false, code: 'WRITE' };
        // ⑥ 디스크가 솔리오가 쓴 바이트 그대로인지 본다. 다르면 그 뒤에 남이 쓴 것이라 손대지 않는다(되돌리지도 다시 쓰지도 않는다, 설계 검토 고칠 것 1).
        // 남이 쓴 내용에도 솔리오의 줄이 이 주소로 있으면(지울 때는 없으면) 읽어서 확인한 것으로 센다
        const check = await readText(file);
        if (check.text === text) return { dir, ok: true, changed: true, created: original == null };
        const seen = check.text != null ? parse(check.text) : null;
        if (seen && (mode === 'add' ? oursIn(seen, url) : markedUrls(seen).length === 0)) return { dir, ok: true, changed: true, created: original == null };
        return { dir, ok: false, code: 'UNCONFIRMED', changed: true };
      }
      return { dir, ok: false, code: 'BUSY' };
    } catch {
      return { dir, ok: false, code: 'WRITE' };
    }
  }

  /* 끌 때 보는 폴더. 설치본은 적어 둔 폴더와 기본 설정 폴더다. 그 밖의 실행은 넘겨받은 폴더만 본다(GPT 검수 GA5).
     넘겨받지 않은 적어 둔 폴더는 고치지 않고 적힌 채로 둔다(left). 적어 두지 않은 폴더의 거절은 세지 않는다 */
  /* thorough: 앱을 지울 때. 한 번이라도 줄을 적은 폴더(visited)도 한 번 더 훑는다 */
  function removalTargets(thorough = false) {
    if (!installed) return uniqueDirs(override);
    let extra = [];
    try { extra = typeof baseDirs === 'function' ? baseDirs() : baseDirs; } catch { extra = []; }
    return uniqueDirs([...state.dirs, ...(thorough ? state.visited : []), ...(Array.isArray(extra) ? extra : [])]);
  }
  /* keep: dirs 가운데 줄이 없음을 확인하지 못한 폴더(지우지 못한 폴더와 이 실행이 고칠 수 없는 폴더) */
  async function removeAll(thorough = false) {
    const targets = removalTargets(thorough);
    const results = [];
    for (const dir of targets) results.push(await editDir(dir, 'remove'));
    const clean = new Set(results.filter(r => r.ok).map(r => dirKey(r.dir)));
    const stuck = results.filter(r => !r.ok && hasDir(state.dirs, r.dir));
    const left = state.dirs.filter(d => !hasDir(targets, d));
    for (const r of results) { if (r.ok) lastCodes.delete(dirKey(r.dir)); else if (hasDir(state.dirs, r.dir)) lastCodes.set(dirKey(r.dir), { code: r.code, on: false }); }
    return { results, stuck, left, keep: state.dirs.filter(d => !clean.has(dirKey(d))) };
  }
  /* 켜지 않을 폴더의 줄을 지우고, 줄이 없음을 확인한 폴더만 dirs에서 뺀다 */
  async function tidy(dirs) {
    for (const dir of uniqueDirs(dirs)) {
      const r = await editDir(dir, 'remove');
      if (r.ok) state.dirs = state.dirs.filter(d => dirKey(d) !== dirKey(dir));
    }
  }

  /** 앱을 켤 때(플랫폼 창, 스모크 아님). 줄이 있을 수 있는 폴더가 남아 있으면 저장한 포트를 쥔다. 받는 것은 enabled일 때만이다.
      포트를 다른 프로그램이 쓰고 있으면 받기를 끄고 솔리오의 줄을 바로 지운다(묻지 않는다, 12.3).
      받지 않는데 폴더가 남아 있으면(지우지 못한 폴더) 지우기를 다시 한다. 지우는 방향이라 묻지 않는다(설계 검토 (나)) */
  function start() {
    return serial(async () => {
      await ensure();
      if (server || !available() || !state.dirs.length) return { ok: true, listening: !!server };
      const r = state.port && state.token ? await listenSaved(listenRetries) : { ok: false, code: 'NO_PORT' };
      if (!r.ok) {
        const wasOn = state.enabled;
        state.enabled = false;
        await save(); // 받지 않는다는 것을 먼저 적는다
        const { keep } = await removeAll();
        state.dirs = keep;
        if (wasOn) state.notice = 'port';
        await save();
        notify();
        return { ok: false, code: 'PORT', listening: false };
      }
      serve(r);
      if (state.enabled) { closed = false; return { ok: true, listening: true }; }
      const { keep } = await removeAll();
      state.dirs = keep;
      if (!state.dirs.length) await stop();
      await save();
      notify();
      return { ok: true, listening: !!server };
    });
  }

  /** 켜기(두 번 확인 뒤). roots: 계정의 보는 폴더 가운데 Claude 설정 폴더(설치본만 쓴다). 그 밖의 실행은 넘겨받은 폴더만 고친다 */
  /* guard: 부른 쪽의 로그인 묶음 확인(GPT 검수 GB2). 차례가 와서 돌기 시작할 때와 손님 파일을 고치기 바로 앞에서 부른다. 참이 아니면 AUTH_CHANGED */
  function enable(roots, { guard } = {}) {
    const gen = acceptGen; // 누른 때의 받기 세대. 그 뒤에 끄기가 받기를 닫았으면 켜기를 마쳐도 다시 열지 않는다
    const fine = () => typeof guard !== 'function' || guard() === true;
    return serial(async () => {
      await ensure();
      if (!available()) return { ok: false, code: 'NOT_HERE' };
      if (!fine()) return { ok: false, code: 'AUTH_CHANGED' };
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
      // 손님 파일을 고치기 전에 고칠 폴더와 자리를 상태 파일에 먼저 적는다. 적지 못하면 고치지 않는다(GPT 검수 GA3).
      // 그래야 솔리오의 줄이 든 폴더는 언제나 상태 파일에 있고, 끄기와 지우는 프로그램이 찾는다. 켜기는 dirs를 줄이지 않는다(설계 검토 고칠 것 2)
      const before = state.dirs;
      noteDirs(targets);
      if (!(await save())) {
        state.dirs = before;
        if (opened && !before.length) await stop();
        return { ok: false, code: 'STATE' };
      }
      const url = hookUrl(state.port, state.token);
      const results = [];
      for (const dir of targets) {
        const r = await editDir(dir, 'add', url, guard); // 계정 묶음은 바꿔 넣기마다 본다(설계 검토 고칠 것 3)
        results.push(r);
        if (r.code === 'AUTH_CHANGED') break; // 남은 폴더는 고치지 않는다
      }
      for (const r of results) { if (r.ok && !r.skipped) lastCodes.delete(dirKey(r.dir)); else if (!r.ok && r.code !== 'AUTH_CHANGED') lastCodes.set(dirKey(r.dir), { code: r.code, on: true }); }
      const written = results.filter(r => r.ok && !r.skipped);
      const auth = results.some(r => r.code === 'AUTH_CHANGED');
      // 이번에 새로 적은 폴더 가운데 이번에 바꿔 넣지 않았고 솔리오의 줄도 없는 폴더(없는 폴더, 읽지 못한 파일, 닿지 않은 폴더)는 바로 뺀다.
      // 그 폴더에는 솔리오의 줄이 있을 수 없다(dirs에 없던 폴더는 줄이 없음을 확인하고 뺀 폴더다). 바꿔 넣은 폴더는 확인하지 못했어도 남긴다(설계 검토 고칠 것 2)
      const fresh = targets.filter(d => !hasDir(before, d));
      const untouched = fresh.filter(d => { const r = results.find(x => dirKey(x.dir) === dirKey(d)); return !r || (!r.changed && !(r.ok && !r.skipped)); });
      state.dirs = state.dirs.filter(d => !hasDir(untouched, d));
      if (auth || !written.length) {
        // 켜지 않는다. 이번에 바꿔 넣은 새 폴더와(켜져 있지 않았으면) 이번에 바꿔 넣은 폴더의 줄을 바로 지운다. 받지 않는 포트를 가리키는 줄을 남기지 않는다
        // (설계 검토 고칠 것 7, 카본 검수 solio-office-be2 A1). 줄이 없음을 확인하지 못한 폴더는 dirs에 남아 다음 시작 · 끄기가 다시 본다
        await tidy(results.filter(r => r.changed && (!wasOn || !hasDir(before, r.dir))).map(r => r.dir));
        if (!state.enabled && !state.dirs.length) await stop();
        await save();
        notify();
        const refused = results.find(r => !r.ok);
        return { ok: false, code: auth ? 'AUTH_CHANGED' : refused ? refused.code : 'NO_DIRS', ...summary(results) };
      }
      state.enabled = true;
      state.notice = null;
      if (!wasOn) { state.enabledAt = now(); heard = false; }
      if (!(await save())) {
        // 받는다는 것을 적지 못했다. 메모리의 받기도 열지 않는다. 쓴 줄은 dirs에 적혀 있어 다음 시작 · 끄기가 지운다(GPT 검수 be3 GA6)
        state.enabled = wasOn;
        notify();
        return { ok: false, code: 'STATE', ...summary(results) };
      }
      if (acceptGen === gen) closed = false;
      notify();
      const refused = results.find(r => !r.ok);
      return { ok: true, ...(refused ? { code: refused.code } : {}), ...summary(results) };
    });
  }

  /** 끄기: 부른 틱 안에서 받기를 먼저 닫고(차례와 기다림보다 앞), 받지 않는다는 것을 상태 파일에 먼저 적은 뒤 표식이 있는 줄만 지운다.
      지우지 못한 폴더가 남아도 받지 않는다. 그 폴더는 dirs에 남고 화면이 「지우지 못한 설정 파일」과 「다시 지우기」를 보인다(설계 검토 (나) · 고칠 것 5).
      nonce: 지우는 실행의 확인 값. 끄기를 마친 뒤 남은 폴더 수와 함께 unhooked에 적는다. thorough: 한 번이라도 적은 폴더도 훑는다 */
  function disable({ nonce = null, thorough = false } = {}) {
    closeAcceptance();
    return serial(async () => {
      await ensure();
      state.enabled = false;
      await save();
      const { results, stuck, left, keep } = await removeAll(thorough);
      state.dirs = keep;
      if (!state.dirs.length) { await stop(); state.notice = null; }
      if (typeof nonce === 'string' && nonce) state.unhooked = { nonce, left: state.dirs.length };
      const saved = await save();
      notify();
      if (stuck.length) return { ok: false, code: stuck[0].code, ...summary(results) };
      if (left.length) return { ok: false, code: 'NOT_HERE', ...summary(results) };
      if (!saved) return { ok: false, code: 'STATE', ...summary(results) };
      return { ok: true, ...summary(results) };
    });
  }
  const summary = results => ({ written: results.filter(r => r.ok && !r.skipped && !r.unchanged).length, created: results.filter(r => r.created).length, refused: results.filter(r => !r.ok).length });

  /** 화면에 넘기는 모습. roots: 계정의 Claude 설정 폴더. 포트와 확인 값은 넘기지 않는다.
      { on, left, available, dirs:[{ dir, on, folder, file, code }], message:'port'|'silent'|null }
      on: 소식을 받는다(enabled). left: 받지 않는데 줄이 남았을 수 있는 폴더가 있다(「다시 지우기」).
      폴더마다의 on은 지금 그 파일에 솔리오의 줄이 이 주소로 있는지 읽어서 정한다(dirs에 있다는 것만으로 말하지 않는다) */
  async function status(roots = []) {
    await serial(ensure);
    const list = uniqueDirs([...(installed ? roots : override), ...state.dirs]);
    const url = state.enabled && state.port && state.token ? hookUrl(state.port, state.token) : null;
    const dirs = [];
    for (const dir of list) {
      let folder = false, file = false, on = false;
      try { folder = (await fsp.stat(dir)).isDirectory(); } catch { folder = false; }
      if (folder) { try { file = (await fsp.stat(path.join(dir, SETTINGS))).isFile(); } catch { file = false; } }
      if (file && url) { const t = await readText(path.join(dir, SETTINGS)); const v = t.text != null ? parse(t.text) : null; on = !!v && oursIn(v, url); }
      const last = lastCodes.get(dirKey(dir));
      dirs.push({ dir, on, folder, file, code: last ? last.code : null });
    }
    let message = null;
    if (state.notice === 'port') message = 'port';
    else if (state.enabled && server && !heard && now() - Math.max(state.enabledAt ?? 0, listenAt ?? 0) >= SILENT_MS) message = 'silent';
    return { on: state.enabled, left: !state.enabled && state.dirs.length > 0, available: available(), dirs, message };
  }

  /** --office-unhook: 잠금을 얻은 지우는 실행이 스스로, 못 얻었으면 켜진 앱이 second-instance로 받아 부른다. 한 번이라도 적은 폴더까지 훑는다 */
  const unhook = ({ nonce = null } = {}) => disable({ nonce, thorough: true });

  /** 앱을 끌 때 */
  function closeServer() { return stop(); }

  return { start, enable, disable, unhook, status, accepting, close: closeServer, listening: () => !!server, address: () => (server ? server.address() : null), available, stateFile, override };
}

/* 상태 파일의 unhooked가 이 확인 값인지. 맞으면 { left }, 아직이면 false, 읽지 못했으면 null */
async function unhookedOnDisk(stateFile, fsImpl, nonce) {
  try {
    const v = JSON.parse(await fsImpl.promises.readFile(stateFile, 'utf8'));
    const u = isObject(v) ? v.unhooked : null;
    return isObject(u) && u.nonce === nonce ? { left: Number.isInteger(u.left) && u.left >= 0 ? u.left : 1 } : false;
  } catch { return null; }
}
/** 켜진 앱이 이 확인 값으로 끄기를 마치기를 상태 파일로 기다린다. waitMs 안에 보면 { left }, 못 보면 null.
    이전 실행이 남긴 꺼짐은 이 확인 값이 아니므로 끝으로 보지 않는다(GPT 검수 be3 GA12, 카본 be2 A2).
    읽는 동안에는 켜진 앱의 이름 바꾸기가 거절되므로, 고친 때나 크기가 바뀐 때만 연다(처음 한 번은 연다) */
async function waitUnhooked({ stateFile, nonce, fsImpl = fs, now = () => Date.now(), setTimeout: after = setTimeout, waitMs = UNHOOK_WAIT_MS, pollMs = UNHOOK_POLL_MS } = {}) {
  const end = now() + waitMs;
  let mark;
  for (;;) {
    let st = null;
    try { st = stateFile ? await fsImpl.promises.stat(stateFile) : null; } catch { st = null; }
    const next = st ? st.mtimeMs + ':' + st.size : null;
    if (next !== null && next !== mark) { const seen = await unhookedOnDisk(stateFile, fsImpl, nonce); if (seen !== null) mark = next; if (seen) return seen; }
    if (now() >= end) return null;
    await new Promise(resolve => { after(resolve, Math.min(pollMs, Math.max(1, end - now()))); }); // 이 실행은 기다리는 동안 살아 있어야 한다(unref하지 않는다)
  }
}
/**
 * --office-unhook 한 번(지우는 프로그램이 앱을 끈 뒤 돌린다. 구현설계.md 12.3 「앱을 지울 때」).
 * 단일 실행 잠금을 먼저 청한다(lock()은 부른 틱에 부른다). 얻었으면 켜진 앱이 없다. 이 실행이 도는 동안 새로 켠 앱은 잠금에 져서 끝난다.
 * 이 실행이 끄고 끝난다. 못 얻었으면 켜진 앱이 second-instance로 이 실행의 확인 값(lock에 넘긴 nonce, Electron의 additionalData)을 받아
 * 받기를 닫고 끈 뒤 그 값을 상태 파일에 적는다. 이 실행은 그 값이 보일 때까지 8초까지 본다(설계 검토 고칠 것 6).
 * baseDirs를 주면 설치본의 기본 설정 폴더 대신 그 목록을 본다. 사무실을 꺼 둔 판은 빈 목록을 줘 적어 둔 폴더에서만 지운다.
 * @returns 끝 값(UNHOOK_EXIT). 0은 끄기를 마쳤고 남은 폴더가 없을 때뿐이다
 */
async function runUnhook({ userData, installed = false, baseDirs, lock, nonce = crypto.randomBytes(16).toString('hex'), createHooks = options => createOfficeHooks(options), fsImpl = fs, now, setTimeout: after, waitMs, pollMs } = {}) {
  let held = false;
  try { held = typeof lock === 'function' && lock(nonce) === true; } catch { held = false; }
  if (held) {
    let r;
    try { r = await createHooks({ userData, installed, ...(baseDirs ? { baseDirs } : {}) }).unhook({ nonce }); } catch { return UNHOOK_EXIT.FAILED; }
    if (r && r.ok === true) return UNHOOK_EXIT.OK;
    return r && r.code === 'STATE' ? UNHOOK_EXIT.UNCONFIRMED : UNHOOK_EXIT.LEFT;
  }
  const options = { stateFile: stateFileOf(userData), nonce, fsImpl };
  if (now) options.now = now;
  if (after) options.setTimeout = after;
  if (waitMs != null) options.waitMs = waitMs;
  if (pollMs != null) options.pollMs = pollMs;
  try { const seen = await waitUnhooked(options); return !seen ? UNHOOK_EXIT.UNCONFIRMED : seen.left === 0 ? UNHOOK_EXIT.OK : UNHOOK_EXIT.LEFT; } catch { return UNHOOK_EXIT.FAILED; }
}

module.exports = { createOfficeHooks, runUnhook, waitUnhooked, isMarked, stripMarked, addOurs, hookEvent, toolDetailOf, overrideDirs, hookUrl, EVENTS, OVERRIDE_ENV, BODY_MAX, SETTINGS_MAX, SILENT_MS, PATH_PREFIX, HOST, PORT_RANGE, UNHOOK_EXIT, UNHOOK_WAIT_MS };
