'use strict';
// 솔리오 「사무실」(PC 클라이언트 첫 조각 「보기」, 2026-11-20): 이 PC의 Claude Code · Codex 세션 기록 파일에서
// 「세션이 있다, 기록이 바뀌고 있다」와 작업 폴더, 마지막 차례 줄의 갈래만 알아낸다. 설계: docs/디자인/솔리오_사무실_20261119/구현설계.md 3.1 · 3.3 · 3.4 · 4.4 · 4.5.
//  · Claude Code: <설정 폴더>/projects/<폴더 이름>/<세션 번호>.jsonl. 도우미 기록(<세션 번호>/subagents/*.jsonl)은 세션으로 세지 않고,
//    그 고친 때만 세션의 때에 넣는다(3.4의 4). 세션 번호는 uuid 꼴의 파일 이름만 받는다(옛 판의 agent-*.jsonl은 도우미 기록이다).
//  · Codex: <CODEX_HOME>/sessions/<해>/<달>/<날>/rollout-<때>-<번호>.jsonl. 세션 번호는 파일 이름 끝의 uuid다.
//  · 줄의 형식은 약속된 것이 아니다(3.1). 앞 64KB, 못 찾으면 끝 64KB만 줄마다 읽어 작업 폴더 하나를 찾는다. 못 찾으면 null이고 짐작하지 않는다.
//    파일마다 한 번만 읽고, 못 찾은 파일은 자랐을 때 늘어난 끝만 다시 읽는다.
//  · 본 기록의 끝(64KB, 못 가르면 512KB)에서 마지막 차례 줄의 갈래를 읽는다(4.5, 11-23): 'ended' 차례가 끝남 · 'waiting' 손님의 답을 기다림 ·
//    'working' 차례 중(도구 결과를 기다림 · 답을 쓰는 중). 가르지 못하면 null이고, 화면은 그때 고친 때로만 말한다.
//    작업 폴더와 그 갈래 · 그 줄의 때 말고는 아무것도 남기지도 돌려주지도 않는다. 크기나 고친 때가 바뀐 파일만 다시 읽는다.
//  · 이 PC의 기록은 6,000개쯤이다(3.1). 모두 훑기(파일마다 stat)는 2분에 한 번이다. 15초 틱에는 최근 파일과 고친 때가 바뀐 폴더만 본다.
//    새 세션 파일이 생기면 그 폴더의 고친 때가 바뀐다. 오래 쉬던 파일에 다시 적히는 것은 다음 모두 훑기(2분 안)에 잡힌다.
//  · 돌려주는 것: { kind:'record', sessionId, cwd, tool:'claude'|'codex', changedAt, turn, turnAt, helperAt, seenAt } — 고친 때(도우미 기록까지)가 30분 안인 세션만.
//    turn은 위의 갈래(모르면 null), turnAt은 그 줄에 적힌 때(없으면 null), helperAt은 도우미 기록의 가장 늦은 고친 때(살핀 때를 넘지 않음, 없으면 null), seenAt은 살핀 때.
//  · 이 PC의 Codex 기록은 자라는 동안에도 고친 때(mtime)가 만든 때에 머문다. 바뀐 때(ctime)는 줄을 적을 때마다 움직인다.
//    그래서 Codex 파일은 고친 때 칸에 max(mtime, ctime)를 넣는다. Claude 파일은 내용 없이 ctime이 한꺼번에 바뀐 적이 있어 mtime 그대로다
//    (설계 검토 solio-office-codex-20261123 고칠 것 2, 구현설계 4.5).
//  · 모든 파일 읽기는 비동기이고, 읽지 못한 폴더와 파일은 건너뛴다. 던지지 않는다.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const MIN = 60e3, HOUR = 3600e3;
/* drop은 office-model의 OFFICE_TIMES.drop과 같다(office.cjs가 넘긴다) */
const RECORD_TIMES = Object.freeze({
  drop: 30 * MIN, // 이보다 오래 그대로인 세션은 돌려주지 않는다
  tick: 15e3, // 모두 훑기를 부탁받아도 앞 훑기가 이보다 가까우면 틱으로 갈음한다
  fullEvery: 2 * MIN, // 모두 훑기 간격
  watch: 2 * HOUR, // 이 안에 바뀐 세션 파일은 틱마다 stat한다(돌려주는 것은 drop 안의 것뿐)
  subagents: 12 * HOUR, // 모두 훑기에서 도우미 폴더를 보는 세션: 본 기록이 이 안에 바뀐 것
  codexDay: 48 * HOUR, // Codex의 날 폴더는 그날에만 새 파일이 생긴다. 이보다 오래 그대로인 날 폴더는 틱에서 stat하지 않는다
});
const SLICE = 64 * 1024;
const TAIL_MAX = 512 * 1024; // 끝 64KB에서 갈래를 못 가르면(끝 줄 하나가 아주 긴 때) 한 번 더 이만큼 읽는다
const PARALLEL = 16;
const MAX_FILES = 50000; // 보는 폴더 하나를 한 번 훑을 때 stat하는 세션 파일의 끝
const MAX_SUBAGENT_FILES = 500;
const MAX_CACHE = 2000;
const MAX_RESTING = 16; // 살필 목록에서 잠시 빠진 폴더의 상태를 이만큼 둔다(be8 GA1)
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const CLAUDE_FILE = new RegExp(`^(${UUID})\\.jsonl$`, 'i');
const CODEX_FILE = new RegExp(`^rollout-.+-(${UUID})\\.jsonl$`, 'i');

/* 보는 폴더의 짜임. depth 0이 맨 위 폴더이고 leafDepth의 폴더에 세션 파일이 있다 */
const LAYOUTS = Object.freeze({
  claude: { top: root => path.join(root, 'projects'), leafDepth: 1, child: () => true, sessionOf: name => CLAUDE_FILE.exec(name)?.[1] ?? null },
  codex: { top: root => root, leafDepth: 3, child: (depth, name) => (depth === 0 ? /^\d{4}$/ : /^\d{2}$/).test(name), sessionOf: name => CODEX_FILE.exec(name)?.[1] ?? null },
});

/** 처음 보는 폴더: Claude는 설정 폴더(CLAUDE_CONFIG_DIR이 있으면 그것, 없으면 ~/.claude), Codex는 <CODEX_HOME 또는 ~/.codex>/sessions. 구독 방의 계정 폴더는 넣지 않는다(3.4의 5) */
function defaultRoots(env = process.env, platform = process.platform, homedir = os.homedir) {
  const p = platform === 'win32' ? path.win32 : path.posix;
  let home = '';
  try { home = typeof homedir === 'function' ? homedir() : homedir; } catch { home = ''; }
  const claude = env?.CLAUDE_CONFIG_DIR || (home ? p.join(home, '.claude') : '');
  const codexHome = env?.CODEX_HOME || (home ? p.join(home, '.codex') : '');
  return { claude: claude ? [claude] : [], codex: codexHome ? [p.join(codexHome, 'sessions')] : [] };
}

const ABSOLUTE = /^(?:[A-Za-z]:[\\/]|\\\\[^\\/]|\/)/;
const CONTROL = /[\u0000-\u001f\u007f]/;
/* 기록에서 읽은 작업 폴더는 절대 경로인 글자일 때만 받는다 */
const goodCwd = v => typeof v === 'string' && v.length <= 1024 && ABSOLUTE.test(v) && !CONTROL.test(v);
function cwdOfLine(line, tool) {
  if (!line.includes('"cwd"')) return null;
  let o; try { o = JSON.parse(line); } catch { return null; }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  if (tool === 'codex') return (o.type === 'session_meta' || o.type === 'turn_context') && goodCwd(o.payload?.cwd) ? o.payload.cwd : null;
  return goodCwd(o.cwd) ? o.cwd : null;
}

/* 마지막 차례 줄의 갈래(4.5). 줄 하나를 보고 'ended' · 'waiting' · 'working'을, 차례와 상관없는 줄이면 undefined를 돌려준다.
   Claude Code: 도우미의 줄(isSidechain)과 앱이 덧붙인 줄(isMeta · 압축 요약, 대기열 · 제목 · 시스템 줄)은 건너뛴다. 끝낸 답(end_turn 등) · 오류로 멈춘 답 ·
   「[Request interrupted by user…」(손님이 멈춤, 스스로 보관함)는 끝이다. 묻는 도구(AskUserQuestion · ExitPlanMode)는 손님의 답을 기다린다.
   그 밖의 답(도구를 부름)과 손님의 말 · 도구 결과 · api-request는 차례 중이다. 앱 안 명령(/usage 같은)의 줄은 모델의 차례가 아니라 건너뛴다.
   Codex: task_complete · turn_aborted가 끝, task_started가 차례 중이다. 한 차례가 몇 시간 이어질 수 있어 둘 다 못 찾으면 turnInText가 가른다 */
const WAIT_TOOLS = new Set(['AskUserQuestion', 'ExitPlanMode']);
const ENDED_STOPS = new Set(['end_turn', 'stop_sequence', 'max_tokens', 'refusal']);
const STOPPED_TEXT = /^\[Request interrupted by user/;
const LOCAL_TEXT = /^<(?:command-name|command-message|command-args|local-command-stdout|local-command-stderr|local-command-caveat)>/;
const firstText = c => (typeof c === 'string' ? c : Array.isArray(c) ? String(c.find(x => x && x.type === 'text')?.text ?? '') : '');
function claudeTurnOf(o) {
  if (o.isSidechain) return undefined;
  if (o.type === 'assistant') {
    if (o.isApiErrorMessage) return 'ended';
    const m = o.message && typeof o.message === 'object' ? o.message : {};
    const tools = Array.isArray(m.content) ? m.content.filter(c => c && c.type === 'tool_use').map(c => String(c.name ?? '')) : [];
    if (tools.some(n => WAIT_TOOLS.has(n))) return 'waiting';
    return ENDED_STOPS.has(m.stop_reason) ? 'ended' : 'working';
  }
  if (o.type === 'user') {
    if (o.isMeta || o.isCompactSummary) return undefined; // 압축 요약 줄도 건너뛴다. 차례 중이면 뒤따르는 api-request가 알린다(설계 검토 solio-office-turn 고칠 것 6)
    const text = firstText(o.message?.content).trimStart();
    if (STOPPED_TEXT.test(text)) return 'ended';
    if (LOCAL_TEXT.test(text)) return undefined;
    return 'working';
  }
  return o.type === 'api-request' ? 'working' : undefined;
}
function codexTurnOf(o) {
  if (o.type !== 'event_msg') return undefined;
  const t = o.payload && typeof o.payload === 'object' ? o.payload.type : undefined;
  return t === 'task_complete' || t === 'turn_aborted' ? 'ended' : t === 'task_started' ? 'working' : undefined;
}
/* 글의 끝에서 앞으로 줄마다 읽어 처음 가른 갈래를 돌려준다. dropFirst면 첫 조각(줄 가운데부터 읽은 것)을 버린다.
   JSON으로 읽히지 않는 줄(쓰는 중인 끝 줄, 앞이 잘린 줄)은 건너뛴다. Codex는 경계를 못 찾았어도 차례 안의 줄(response_item)이 있으면 차례 중이다.
   차례가 끝나면 task_complete가 그 차례의 줄들 뒤에 오기 때문이다. Codex가 차례 중이면 at은 끝에서 본 가장 늦은 줄의 때다.
   task_started는 몇 시간 전일 수 있고, 차례 중의 12분은 마지막으로 적힌 때부터 재야 하기 때문이다.
   @returns { turn, at } | null */
function turnInText(text, tool, dropFirst) {
  const lines = text.split('\n');
  if (dropFirst) lines.shift();
  let item = false, latest = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line.startsWith('{')) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    if (!o || typeof o !== 'object' || Array.isArray(o)) continue;
    const at = Date.parse(o.timestamp);
    if (latest == null && Number.isFinite(at)) latest = at;
    const turn = tool === 'codex' ? codexTurnOf(o) : claudeTurnOf(o);
    if (turn) return { turn, at: tool === 'codex' && turn === 'working' && latest != null ? latest : Number.isFinite(at) ? at : null };
    if (tool === 'codex' && o.type === 'response_item') item = true;
  }
  return item ? { turn: 'working', at: latest } : null;
}

async function eachLimit(items, fn, limit = PARALLEL) {
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const item = items[next++];
      try { await fn(item); } catch { /* 읽지 못한 것은 건너뛴다 */ }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
}

/** refuse: 글자 → Promise<boolean|null>. 보고 직전에 맨 위의 실제 위치를 묻는다. false가 아니면 그 폴더의 세션을 보고하지 않는다(설계 검토 be9 고칠 것 1) */
function createOfficeRecords({ roots = () => defaultRoots(), fsImpl = fs, now = () => Date.now(), times = {}, caseInsensitive = process.platform === 'win32', refuse = null } = {}) {
  const fsp = fsImpl.promises;
  const T = { ...RECORD_TIMES, ...times };
  const rootStates = new Map(); // 열쇠 → { key, tool, top, layout, lastFullAt, dirs, sessions }
  // 판정이 늦어 한 번 빠졌다 돌아온 폴더가 처음 본 때(앞날의 때 표시)를 잃지 않게 빠진 폴더의 상태를 둔다(GPT 검수 be8 GA1)
  const restingStates = new Map();
  const cwdCache = new Map(); // 세션 파일 → { cwd, size, rootKey }
  const turnCache = new Map(); // 세션 파일 → { size, mtimeMs, found, rootKey } — 마지막 차례 줄의 갈래(4.5)
  let running = null;

  // 맨 위 폴더 아래의 연결(junction · symlink)은 따라가지 않는다. 구독 방 계정 폴더 판정은 맨 위까지만 보므로, 그 아래 연결이 계정 폴더를 가리킬 수 있다.
  // 그래서 맨 위 밖의 stat은 lstat이고 연결이면 없는 것으로 본다. 넘겨받은 fs에 lstat이 없으면 stat이다(설계 검토 be8 고칠 것 2)
  const stat = async p => {
    try { const st = await (typeof fsp.lstat === 'function' ? fsp.lstat(p) : fsp.stat(p)); return st && st.isSymbolicLink?.() ? null : st; } catch { return null; }
  };
  const statTop = async p => { try { return await fsp.stat(p); } catch { return null; } };
  // 보고 직전의 자리 확인(GPT 검수 be9 GA1): 세션 파일과 도우미 폴더의 실제 위치가 보는 폴더 맨 위의 실제 위치 안일 때만 보고한다.
  // 늘어놓기나 남은 캐시가 중간의 연결을 따라갔어도 이 확인이 막는다. 구독 방 계정 폴더 판정은 맨 위까지만 보기 때문이다
  const realpathOf = async p => { try { return await (typeof fsp.realpath === 'function' ? fsp.realpath(p) : fs.promises.realpath(p)); } catch { return null; } };
  const caseKey = v => (caseInsensitive ? v.toLowerCase() : v);
  const inside = (real, top) => {
    if (typeof real !== 'string' || typeof top !== 'string' || !real || !top) return false;
    const r = caseKey(real), base = caseKey(top).replace(/[\\/]+$/, '');
    return r === base || r.startsWith(base + '\\') || r.startsWith(base + '/');
  };
  const list = async p => { try { return await fsp.readdir(p, { withFileTypes: true }); } catch { return null; } };
  const keyOf = (tool, dir) => { const r = path.resolve(dir); return tool + '|' + (caseInsensitive ? r.toLowerCase() : r); };

  function wanted(given) {
    const out = new Map();
    let value = given;
    if (typeof value === 'function') { try { value = value(); } catch { value = null; } }
    for (const tool of ['claude', 'codex']) {
      const dirs = Array.isArray(value?.[tool]) ? value[tool] : [];
      for (const dir of dirs) {
        if (typeof dir !== 'string' || !dir.trim()) continue;
        const key = keyOf(tool, dir);
        if (!out.has(key)) out.set(key, { tool, root: path.resolve(dir) });
      }
    }
    return out;
  }

  /* 세션 파일의 고친 때. Codex는 max(mtime, ctime)이다(위 머리글). 지켜보기 · 틱 · 30분 · 갈래 캐시의 열쇠가 모두 이 값을 따른다.
     ctime은 내용 없이 속성만 바뀌어도 움직인다. 그래서 앞서 본 크기와 같으면 ctime을 새로 받지 않고 앞서 정한 때를 둔다
     (GPT 검수 solio-office-turn-r5 GA1). 크기와 그때는 Codex 파일마다 rs.codexSeen에 기억한다(Codex 기록은 많지 않다) */
  function fileTimeOf(rs, file, st) {
    if (rs.tool !== 'codex') return st.mtimeMs;
    const seen = rs.codexSeen.get(file);
    const byCtime = Number.isFinite(st.ctimeMs) && st.ctimeMs > st.mtimeMs ? st.ctimeMs : st.mtimeMs;
    const at = seen && seen.size === st.size ? Math.max(st.mtimeMs, seen.at) : byCtime;
    rs.codexSeen.set(file, { size: st.size, at });
    return at;
  }

  function changedOf(s) {
    let at = s.mtimeMs;
    for (const m of s.subFiles.values()) if (m > at) at = m;
    return at;
  }

  /* 도우미 폴더: 고친 때가 바뀌었거나 처음이면 다시 늘어놓고, 아니면 최근 도우미 파일만 stat한다 */
  async function subagents(s, t, full) {
    const dir = path.join(s.dir, s.id, 'subagents');
    const idDir = await stat(path.join(s.dir, s.id)); // 세션 번호 폴더가 연결이어도 따라가지 않는다
    const st = idDir && idDir.isDirectory() ? await stat(dir) : null;
    if (!st || !st.isDirectory()) { s.subDir = null; s.subDirMtime = null; s.subFiles = new Map(); return; }
    const next = new Map();
    if (full || s.subDir !== dir || s.subDirMtime !== st.mtimeMs) {
      const entries = ((await list(dir)) || []).filter(e => e.isFile() && e.name.toLowerCase().endsWith('.jsonl')).slice(0, MAX_SUBAGENT_FILES);
      await eachLimit(entries, async e => { const p = path.join(dir, e.name); const f = await stat(p); if (f && f.isFile()) next.set(p, f.mtimeMs); });
    } else {
      for (const [p, m] of s.subFiles) next.set(p, m);
      await eachLimit([...s.subFiles].filter(([, m]) => t - m < T.watch), async ([p]) => { const f = await stat(p); if (f && f.isFile()) next.set(p, f.mtimeMs); else next.delete(p); });
    }
    s.subDir = dir; s.subDirMtime = st.mtimeMs; s.subFiles = next;
  }

  /* 세션 파일 하나를 stat해 최근이면 틱마다 볼 목록에 둔다 */
  async function consider(rs, dir, node, name, t, before) {
    if (rs.budget <= 0) return;
    rs.budget -= 1;
    const id = rs.layout.sessionOf(name);
    const file = path.join(dir, name);
    if (rs.seen) rs.seen.add(file);
    rs.touched.add(file);
    const st = await stat(file);
    if (!st || !st.isFile()) { rs.sessions.delete(file); return; }
    const old = rs.sessions.get(file) || before?.get(file) || rs.forgotten?.get(file); // 잊은 세션도 처음 본 때를 잇는다(설계 검토 be9 고칠 것 2)
    rs.forgotten?.delete(file);
    const s = old ? { ...old } : { id, file, dir, tool: rs.tool, subDir: null, subDirMtime: null, subFiles: new Map() };
    s.mtimeMs = fileTimeOf(rs, file, st); s.size = st.size;
    if (rs.tool === 'claude' && node.names.has(id) && t - s.mtimeMs < T.subagents) await subagents(s, t, true);
    else { s.subDir = null; s.subDirMtime = null; s.subFiles = new Map(); }
    if (t - changedOf(s) < T.watch) rs.sessions.set(file, s); else rs.sessions.delete(file);
  }

  /* 폴더 하나를 끝까지 늘어놓는다. 고친 때는 늘어놓기 전에 읽는다(그 사이에 생긴 파일은 다음 틱에 고친 때가 달라 잡힌다) */
  async function walk(rs, dir, depth, t, before) {
    const st = await (dir === rs.top ? statTop(dir) : stat(dir));
    if (!st || !st.isDirectory()) return;
    const entries = await list(dir);
    if (!entries) return;
    const node = { mtimeMs: st.mtimeMs, names: new Set(entries.map(e => e.name)), depth, leaf: depth === rs.layout.leafDepth };
    rs.dirs.set(dir, node);
    if (!node.leaf) {
      for (const e of entries) if (e.isDirectory() && rs.layout.child(depth, e.name)) await walk(rs, path.join(dir, e.name), depth + 1, t, before);
      return;
    }
    await eachLimit(entries.filter(e => e.isFile() && rs.layout.sessionOf(e.name)), e => consider(rs, dir, node, e.name, t, before));
  }

  async function fullList(rs, t) {
    const before = rs.sessions;
    rs.dirs = new Map(); rs.sessions = new Map(); rs.seen = new Set(); rs.touched = new Set(); rs.budget = MAX_FILES;
    await walk(rs, rs.top, 0, t, before);
    for (const file of [...rs.codexSeen.keys()]) if (!rs.seen.has(file)) rs.codexSeen.delete(file); // 지워진 Codex 파일
    for (const [file, c] of cwdCache) if (c.rootKey === rs.key && !rs.seen.has(file)) cwdCache.delete(file); // 지워진 파일
    for (const [file, c] of turnCache) if (c.rootKey === rs.key && !rs.seen.has(file)) turnCache.delete(file);
    rs.seen = null;
    rs.lastFullAt = t;
  }

  /* 없어졌거나 연결로 바뀐 폴더는 그 아래에 기억한 폴더와 세션까지 잊는다(be9 GA1).
     잊은 세션은 보고하지 않되 따로 두어, 다시 늘어놓을 때 처음 본 때(앞날의 때 표시)를 잇는다(설계 검토 be9 고칠 것 2) */
  function forgetUnder(rs, dir) {
    const pre = dir.replace(/[\\/]+$/, '') + path.sep;
    rs.dirs.delete(dir);
    for (const d of [...rs.dirs.keys()]) if (d.startsWith(pre)) rs.dirs.delete(d);
    rs.forgotten ??= new Map();
    for (const [file, s] of [...rs.sessions]) {
      if (!file.startsWith(pre)) continue;
      rs.sessions.delete(file);
      rs.forgotten.delete(file);
      rs.forgotten.set(file, s);
    }
    while (rs.forgotten.size > MAX_CACHE) rs.forgotten.delete(rs.forgotten.keys().next().value);
  }

  async function tick(rs, t) {
    rs.touched = new Set(); rs.budget = MAX_FILES;
    for (const [dir, node] of [...rs.dirs]) {
      if (!rs.dirs.has(dir)) continue; // 위 폴더와 함께 잊었다
      if (rs.tool === 'codex' && node.leaf && t - node.mtimeMs > T.codexDay) continue;
      const st = await (dir === rs.top ? statTop(dir) : stat(dir));
      if (!st || !st.isDirectory()) { forgetUnder(rs, dir); continue; }
      if (st.mtimeMs === node.mtimeMs) continue;
      const entries = await list(dir);
      if (!entries) continue;
      // 처음 보는 이름과, 이름은 알지만 늘어놓은 폴더 목록에 없는 진짜 폴더(연결이었다가 같은 이름의 폴더로 돌아온 것)를 새로 본다(GPT 검수 be10 GA1 · P2 묶음 GA2)
      const added = entries.filter(e => !node.names.has(e.name) || (!node.leaf && e.isDirectory() && rs.layout.child(node.depth, e.name) && !rs.dirs.has(path.join(dir, e.name))));
      node.mtimeMs = st.mtimeMs;
      node.names = new Set(entries.map(e => e.name));
      if (!node.leaf) {
        for (const e of added) if (e.isDirectory() && rs.layout.child(node.depth, e.name)) await walk(rs, path.join(dir, e.name), node.depth + 1, t, null);
        continue;
      }
      await eachLimit(added.filter(e => e.isFile() && rs.layout.sessionOf(e.name)), e => consider(rs, dir, node, e.name, t, null));
    }
    await eachLimit([...rs.sessions.values()].filter(s => !rs.touched.has(s.file)), async s => {
      const st = await stat(s.file);
      if (!st || !st.isFile()) { rs.sessions.delete(s.file); return; }
      const n = { ...s, mtimeMs: fileTimeOf(rs, s.file, st), size: st.size };
      if (rs.tool === 'claude' && (n.subDir || rs.dirs.get(n.dir)?.names.has(n.id))) await subagents(n, t, false);
      if (t - changedOf(n) < T.watch) rs.sessions.set(s.file, n); else rs.sessions.delete(s.file);
    });
  }

  /* [start, end) 바이트에서 온전한 줄만 본다. start가 줄 가운데면 그 첫 조각을, end가 파일 끝이 아니면 마지막 조각을 버린다.
     @returns { cwd, upTo } — upTo는 다 본 온전한 줄의 끝이다(다음에 이어 읽을 자리). 파일 끝의 줄바꿈 없는 줄은 아직 쓰는 중일 수 있어
     그 줄의 처음을 upTo로 둔다. 다음 살피기가 그 줄을 처음부터 다시 읽는다(GPT 검수 GA12) */
  async function cwdInSlice(handle, start, end, size, tool) {
    if (end <= start) return { cwd: null, upTo: start };
    const from = start > 0 ? start - 1 : 0;
    const buf = Buffer.alloc(end - from);
    const { bytesRead } = await handle.read(buf, 0, buf.length, from);
    const data = buf.subarray(0, bytesRead);
    let begin = 0;
    if (start > 0) { const nl = data.indexOf(10); if (nl < 0) return { cwd: null, upTo: start }; begin = nl + 1; }
    let stop = data.length;
    if (from + data.length < size) { const nl = data.lastIndexOf(10); if (nl < begin) return { cwd: null, upTo: from + begin }; stop = nl + 1; }
    for (const line of data.toString('utf8', begin, stop).split('\n')) {
      const cwd = cwdOfLine(line.trim(), tool);
      if (cwd) return { cwd, upTo: from + stop };
    }
    const last = stop > begin ? data.lastIndexOf(10, stop - 1) : -1;
    return { cwd: null, upTo: from + (last >= begin ? last + 1 : begin) };
  }

  async function readCwd(handle, tool, size, grownFrom) {
    try {
      if (grownFrom > 0) return await cwdInSlice(handle, Math.max(grownFrom, size - SLICE), size, size, tool);
      const head = await cwdInSlice(handle, 0, Math.min(SLICE, size), size, tool);
      if (head.cwd || size <= SLICE) return head;
      return await cwdInSlice(handle, size - SLICE, size, size, tool);
    } catch { return { cwd: null, upTo: grownFrom }; }
  }

  /* 마지막 차례 줄의 갈래. 끝 64KB에서 못 가르면 512KB를 한 번 더 읽는다. stat한 크기까지만 읽으므로, 그 뒤에 덧붙는 줄은 다음 살피기가 본다 */
  /* @returns { found, ok } — ok가 아니면(읽다 실패) 캐시하지 않고 다음 살피기가 다시 읽는다(GPT 검수 solio-office-turn GA6).
     줄 가운데부터 읽지 않게 시작점 한 바이트 앞부터 읽어 첫 줄바꿈까지 버린다. 시작점이 줄의 첫 바이트면 그 줄은 남는다(GA5) */
  async function readTurn(handle, tool, size) {
    try {
      for (const want of [SLICE, TAIL_MAX]) {
        const len = Math.max(0, Math.min(want, size)), from = size - len, start = from > 0 ? from - 1 : 0;
        const buf = Buffer.alloc(size - start);
        const { bytesRead } = await handle.read(buf, 0, buf.length, start);
        const found = turnInText(buf.toString('utf8', 0, bytesRead), tool, start > 0);
        if (found || from === 0) return { found, ok: true };
      }
    } catch { return { found: null, ok: false }; }
    return { found: null, ok: true };
  }

  /* 작업 폴더와 끝 줄의 갈래. 둘 다 앞서 읽은 것을 쓸 수 있으면 파일을 열지 않고, 아니면 한 번 열어 필요한 것만 읽는다.
     작업 폴더: 찾은 파일은 다시 읽지 않는다. 못 찾은 파일이 자랐으면 다 본 온전한 줄의 끝(upTo)부터 읽고, 줄어든 파일은 처음부터 다시 읽는다.
     갈래: 크기와 고친 때가 그대로면 앞서 읽은 것을 쓴다(4.5) */
  async function factsOf(s, rootKey) {
    const c = cwdCache.get(s.file), k = turnCache.get(s.file);
    const cwdKnown = !!c && s.size >= c.size && (c.cwd !== null || s.size === c.size);
    const turnKnown = !!k && k.size === s.size && k.mtimeMs === s.mtimeMs;
    if (cwdKnown && turnKnown) return { cwd: c.cwd, turn: k.found };
    const grownFrom = c && c.cwd === null && s.size > c.size ? Math.min(c.upTo ?? c.size, c.size) : 0;
    let handle = null;
    try { handle = await fsp.open(s.file, 'r'); } catch { handle = null; }
    try {
      let cwd = cwdKnown ? c.cwd : null;
      // 열지 못했으면 작업 폴더도 기억하지 않고 다음 살피기가 처음부터 다시 연다(GPT 검수 solio-office-turn-r4 GA2).
      // 앞서 읽은 자리도 버린다. 그 사이 다시 쓴 파일을 옛 자리부터 읽지 않게 한다(-r5 GA2)
      if (!cwdKnown && !handle) cwdCache.delete(s.file);
      if (!cwdKnown && handle) {
        const read = await readCwd(handle, s.tool, s.size, grownFrom);
        cwd = read.cwd;
        cwdCache.delete(s.file);
        cwdCache.set(s.file, { cwd, size: s.size, upTo: read.upTo, rootKey });
        while (cwdCache.size > MAX_CACHE) cwdCache.delete(cwdCache.keys().next().value);
      }
      let turn = turnKnown ? k.found : null;
      if (!turnKnown) {
        const read = handle ? await readTurn(handle, s.tool, s.size) : { found: null, ok: false };
        turn = read.found;
        turnCache.delete(s.file);
        if (read.ok) turnCache.set(s.file, { size: s.size, mtimeMs: s.mtimeMs, found: turn, rootKey });
        while (turnCache.size > MAX_CACHE) turnCache.delete(turnCache.keys().next().value);
      }
      return { cwd, turn };
    } finally {
      try { await handle?.close(); } catch { /* 닫지 못해도 넘어간다 */ }
    }
  }

  /* 바뀐 때. 앞날의 고친 때(시계를 뒤로 돌렸다)는 그 값을 처음 본 때로 친다. 그대로인 파일은 그때에 머물러 30분 뒤 내린다.
     매번 지금으로 치면 바뀌지 않은 파일이 살필 때마다 새 소식이 된다(GPT 검수 GA13). 처음 본 때는 세션 기억(s)에 둔다.
     지금이 그 앞날의 때를 지나도 파일이 그대로면(고친 때와 크기가 같으면) 처음 본 때에 머문다. 아니면 그 순간 새 소식이 된다(GPT 검수 be4 GA13) */
  function changedAtOf(s, t) {
    const raw = changedOf(s);
    // 도우미 기록이 바뀐 것도 바뀐 것이다. 본 기록이 앞날의 때여도 놓치지 않는다(GPT 검수 be5 GA6).
    // 도우미 파일을 이름 차례로 늘어놓아 stat이 끝난 차례와 상관없이 같은 표시가 된다(be6 GA2).
    // 이름에 어떤 글자가 와도 다른 목록이 같은 표시가 되지 않게 JSON으로 적는다(be7 GA3)
    const subs = [...s.subFiles].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const mark = JSON.stringify([raw, s.size, subs]);
    if (s.future && s.future.mark === mark) return s.future.at;
    if (raw <= t) { s.future = null; return raw; }
    s.future = { mark, at: t };
    return t;
  }

  async function observations(t) {
    const found = [], tops = new Map();
    for (const rs of rootStates.values()) {
      for (const s of rs.sessions.values()) {
        const changedAt = changedAtOf(s, t);
        if (t - changedAt < T.drop) found.push({ s, changedAt, rootKey: rs.key, cwd: null, ok: false });
      }
      if (!found.some(f => f.rootKey === rs.key)) continue;
      let top = await realpathOf(rs.top);
      if (top && typeof refuse === 'function') {
        let no;
        try { no = await refuse(top); } catch { no = true; }
        if (no !== false) top = null; // 판정 뒤 맨 위가 계정 폴더로 이어졌으면 그 폴더의 세션은 보고하지 않는다
      }
      tops.set(rs.key, top);
    }
    const allowed = async f => {
      const top = tops.get(f.rootKey);
      if (!inside(await realpathOf(f.s.file), top)) return false; // 맨 위 밖(연결을 따라간 자리)의 기록은 보고하지 않는다
      return !(f.s.subFiles.size && !inside(await realpathOf(path.join(f.s.dir, f.s.id, 'subagents')), top));
    };
    await eachLimit(found, async f => {
      if (!(await allowed(f))) return;
      f.ok = true;
      const facts = await factsOf(f.s, f.rootKey);
      f.cwd = facts.cwd;
      f.turn = facts.turn;
    });
    const byId = new Map();
    for (const f of found) {
      if (!f.ok) continue;
      const prev = byId.get(f.s.id);
      // 도우미 기록의 고친 때 가운데 살핀 때를 넘지 않는 것만 넣는다. 앞날로 적힌 도우미는 changedAt으로만 센다(설계 검토 solio-office-turn 고칠 것 3).
      // 앞날로 적힌 것을 본 도우미는 같은 고친 때인 동안 시계가 그때에 닿아도 넣지 않는다(GPT 검수 solio-office-turn GA4)
      let helperAt = null;
      for (const [p, m] of f.s.subFiles) {
        if (m > t) { (f.s.futureSubs ??= new Map()).set(p, m); continue; }
        if (f.s.futureSubs?.get(p) === m) continue;
        if (helperAt == null || m > helperAt) helperAt = m;
      }
      // seenAt은 살핀 때다. 상태는 고친 때가 아니라 이것으로 가장 늦은 살피기를 고른다(GA3)
      // 갈래를 가른 줄에 때가 없으면 본 기록의 고친 때(도우미 기록은 빼고, 살핀 때를 넘지 않게)를 그 줄의 때로 둔다.
      // changedAt에는 도우미 기록이 들어 있어, 그것으로 견주면 끝 뒤에 적은 도우미를 가리지 못한다(GPT 검수 solio-office-turn-r2 GA3)
      const turnAt = f.turn ? f.turn.at ?? Math.min(f.s.mtimeMs, t) : null;
      const obs = { kind: 'record', sessionId: f.s.id, cwd: f.cwd, tool: f.s.tool, changedAt: f.changedAt, turn: f.turn?.turn ?? null, turnAt, helperAt, seenAt: t };
      if (!prev) byId.set(f.s.id, obs);
      else byId.set(f.s.id, { ...(obs.changedAt > prev.changedAt ? obs : prev), cwd: prev.cwd ?? obs.cwd });
    }
    return [...byId.values()].sort((a, b) => b.changedAt - a.changedAt);
  }

  async function run(full, given) {
    const t = now();
    const want = wanted(given !== undefined ? given : roots);
    for (const key of [...rootStates.keys()]) {
      if (want.has(key)) continue;
      const left = rootStates.get(key);
      rootStates.delete(key);
      restingStates.delete(key);
      restingStates.set(key, left);
      while (restingStates.size > MAX_RESTING) restingStates.delete(restingStates.keys().next().value);
      for (const [file, c] of cwdCache) if (c.rootKey === key) cwdCache.delete(file);
      for (const [file, c] of turnCache) if (c.rootKey === key) turnCache.delete(file);
    }
    for (const [key, { tool, root }] of want) {
      let rs = rootStates.get(key);
      // 돌아온 폴더는 처음부터 다시 늘어놓는다. 쉬는 동안 바뀐 하위 폴더를 옛 캐시로 따라가지 않는다. 세션의 처음 본 때는 늘어놓기가 잇는다(be9 GA1)
      if (!rs && restingStates.has(key)) { rs = restingStates.get(key); restingStates.delete(key); rs.lastFullAt = null; rootStates.set(key, rs); }
      if (!rs) {
        const layout = LAYOUTS[tool];
        rs = { key, tool, top: layout.top(root), layout, lastFullAt: null, dirs: new Map(), sessions: new Map(), codexSeen: new Map(), seen: null, touched: new Set(), budget: MAX_FILES };
        rootStates.set(key, rs);
      }
      const since = rs.lastFullAt == null ? Infinity : t - rs.lastFullAt;
      try {
        if (since >= T.fullEvery || (full && since >= T.tick)) await fullList(rs, t);
        else await tick(rs, t);
      } catch { /* 이 폴더는 이번에 건너뛴다 */ }
    }
    return observations(t);
  }

  /**
   * 기록을 한 번 살핀다. 처음과 2분마다는 모두 훑고, 그 사이는 틱이다.
   * @param full 모두 훑기를 부탁한다(방이 열릴 때). 앞 모두 훑기가 15초 안이면 틱으로 갈음한다
   * @param roots 이번에 볼 폴더 { claude:[설정 폴더…], codex:[sessions 폴더…] }. 없으면 만들 때 받은 것
   * @returns Promise<{ kind:'record', sessionId, cwd, tool, changedAt, turn, turnAt, helperAt, seenAt }[]> — 살피는 중에 다시 부르면 그 살피기를 같이 기다린다
   */
  function scan({ full = false, roots: given } = {}) {
    if (!running) running = run(full, given).catch(() => []).finally(() => { running = null; });
    return running;
  }
  return { scan };
}

module.exports = { createOfficeRecords, defaultRoots, RECORD_TIMES, SLICE, TAIL_MAX, turnInText };
