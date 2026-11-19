'use strict';
// 솔리오 「사무실」(PC 클라이언트 첫 조각 「보기」, 2026-11-20): 이 PC의 Claude Code · Codex 세션 기록 파일에서
// 「세션이 있다, 기록이 바뀌고 있다」와 작업 폴더만 알아낸다. 설계: docs/디자인/솔리오_사무실_20261119/구현설계.md 3.1 · 3.3 · 3.4 · 4.4.
//  · Claude Code: <설정 폴더>/projects/<폴더 이름>/<세션 번호>.jsonl. 도우미 기록(<세션 번호>/subagents/*.jsonl)은 세션으로 세지 않고,
//    그 고친 때만 세션의 때에 넣는다(3.4의 4). 세션 번호는 uuid 꼴의 파일 이름만 받는다(옛 판의 agent-*.jsonl은 도우미 기록이다).
//  · Codex: <CODEX_HOME>/sessions/<해>/<달>/<날>/rollout-<때>-<번호>.jsonl. 세션 번호는 파일 이름 끝의 uuid다.
//  · 줄의 형식은 약속된 것이 아니다(3.1). 앞 64KB, 못 찾으면 끝 64KB만 줄마다 읽어 작업 폴더 하나를 찾는다. 못 찾으면 null이고 짐작하지 않는다.
//    작업 폴더 말고는 아무것도 남기지도 돌려주지도 않는다. 파일마다 한 번만 읽고, 못 찾은 파일은 자랐을 때 늘어난 끝만 다시 읽는다.
//  · 이 PC의 기록은 6,000개쯤이다(3.1). 모두 훑기(파일마다 stat)는 2분에 한 번이다. 15초 틱에는 최근 파일과 고친 때가 바뀐 폴더만 본다.
//    새 세션 파일이 생기면 그 폴더의 고친 때가 바뀐다. 오래 쉬던 파일에 다시 적히는 것은 다음 모두 훑기(2분 안)에 잡힌다.
//  · 돌려주는 것: { kind:'record', sessionId, cwd, tool:'claude'|'codex', changedAt } — 고친 때(도우미 기록까지)가 30분 안인 세션만.
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
const PARALLEL = 16;
const MAX_FILES = 50000; // 보는 폴더 하나를 한 번 훑을 때 stat하는 세션 파일의 끝
const MAX_SUBAGENT_FILES = 500;
const MAX_CACHE = 2000;
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

function createOfficeRecords({ roots = () => defaultRoots(), fsImpl = fs, now = () => Date.now(), times = {}, caseInsensitive = process.platform === 'win32' } = {}) {
  const fsp = fsImpl.promises;
  const T = { ...RECORD_TIMES, ...times };
  const rootStates = new Map(); // 열쇠 → { key, tool, top, layout, lastFullAt, dirs, sessions }
  const cwdCache = new Map(); // 세션 파일 → { cwd, size, rootKey }
  let running = null;

  const stat = async p => { try { return await fsp.stat(p); } catch { return null; } };
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

  function changedOf(s) {
    let at = s.mtimeMs;
    for (const m of s.subFiles.values()) if (m > at) at = m;
    return at;
  }

  /* 도우미 폴더: 고친 때가 바뀌었거나 처음이면 다시 늘어놓고, 아니면 최근 도우미 파일만 stat한다 */
  async function subagents(s, t, full) {
    const dir = path.join(s.dir, s.id, 'subagents');
    const st = await stat(dir);
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
    const old = rs.sessions.get(file) || before?.get(file);
    const s = old ? { ...old } : { id, file, dir, tool: rs.tool, subDir: null, subDirMtime: null, subFiles: new Map() };
    s.mtimeMs = st.mtimeMs; s.size = st.size;
    if (rs.tool === 'claude' && node.names.has(id) && t - s.mtimeMs < T.subagents) await subagents(s, t, true);
    else { s.subDir = null; s.subDirMtime = null; s.subFiles = new Map(); }
    if (t - changedOf(s) < T.watch) rs.sessions.set(file, s); else rs.sessions.delete(file);
  }

  /* 폴더 하나를 끝까지 늘어놓는다. 고친 때는 늘어놓기 전에 읽는다(그 사이에 생긴 파일은 다음 틱에 고친 때가 달라 잡힌다) */
  async function walk(rs, dir, depth, t, before) {
    const st = await stat(dir);
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
    for (const [file, c] of cwdCache) if (c.rootKey === rs.key && !rs.seen.has(file)) cwdCache.delete(file); // 지워진 파일
    rs.seen = null;
    rs.lastFullAt = t;
  }

  async function tick(rs, t) {
    rs.touched = new Set(); rs.budget = MAX_FILES;
    for (const [dir, node] of [...rs.dirs]) {
      if (rs.tool === 'codex' && node.leaf && t - node.mtimeMs > T.codexDay) continue;
      const st = await stat(dir);
      if (!st || !st.isDirectory()) { rs.dirs.delete(dir); continue; }
      if (st.mtimeMs === node.mtimeMs) continue;
      const entries = await list(dir);
      if (!entries) continue;
      const added = entries.filter(e => !node.names.has(e.name));
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
      const n = { ...s, mtimeMs: st.mtimeMs, size: st.size };
      if (rs.tool === 'claude' && (n.subDir || rs.dirs.get(n.dir)?.names.has(n.id))) await subagents(n, t, false);
      if (t - changedOf(n) < T.watch) rs.sessions.set(s.file, n); else rs.sessions.delete(s.file);
    });
  }

  /* [start, end) 바이트에서 온전한 줄만 본다. start가 줄 가운데면 그 첫 조각을, end가 파일 끝이 아니면 마지막 조각을 버린다 */
  async function cwdInSlice(handle, start, end, size, tool) {
    if (end <= start) return null;
    const from = start > 0 ? start - 1 : 0;
    const buf = Buffer.alloc(end - from);
    const { bytesRead } = await handle.read(buf, 0, buf.length, from);
    const data = buf.subarray(0, bytesRead);
    let begin = 0;
    if (start > 0) { const nl = data.indexOf(10); if (nl < 0) return null; begin = nl + 1; }
    let stop = data.length;
    if (from + data.length < size) { const nl = data.lastIndexOf(10); if (nl < begin) return null; stop = nl + 1; }
    for (const line of data.toString('utf8', begin, stop).split('\n')) {
      const cwd = cwdOfLine(line.trim(), tool);
      if (cwd) return cwd;
    }
    return null;
  }

  async function readCwd(file, tool, size, grownFrom) {
    let handle;
    try { handle = await fsp.open(file, 'r'); } catch { return null; }
    try {
      if (grownFrom > 0) return await cwdInSlice(handle, Math.max(grownFrom, size - SLICE), size, size, tool);
      const head = await cwdInSlice(handle, 0, Math.min(SLICE, size), size, tool);
      if (head || size <= SLICE) return head;
      return await cwdInSlice(handle, size - SLICE, size, size, tool);
    } catch { return null; } finally {
      try { await handle.close(); } catch { /* 닫지 못해도 넘어간다 */ }
    }
  }

  async function cwdOf(s, rootKey) {
    const c = cwdCache.get(s.file);
    if (c && s.size >= c.size && (c.cwd !== null || s.size === c.size)) return c.cwd;
    const grownFrom = c && c.cwd === null && s.size > c.size ? c.size : 0; // 줄어든 파일은 처음부터 다시 읽는다
    const cwd = await readCwd(s.file, s.tool, s.size, grownFrom);
    cwdCache.delete(s.file);
    cwdCache.set(s.file, { cwd, size: s.size, rootKey });
    while (cwdCache.size > MAX_CACHE) cwdCache.delete(cwdCache.keys().next().value);
    return cwd;
  }

  async function observations(t) {
    const found = [];
    for (const rs of rootStates.values()) {
      for (const s of rs.sessions.values()) {
        const changedAt = Math.min(changedOf(s), t); // 앞날의 고친 때(시계가 바뀜)는 지금으로 친다
        if (t - changedAt < T.drop) found.push({ s, changedAt, rootKey: rs.key, cwd: null });
      }
    }
    await eachLimit(found, async f => { f.cwd = await cwdOf(f.s, f.rootKey); });
    const byId = new Map();
    for (const f of found) {
      const prev = byId.get(f.s.id);
      const obs = { kind: 'record', sessionId: f.s.id, cwd: f.cwd, tool: f.s.tool, changedAt: f.changedAt };
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
      rootStates.delete(key);
      for (const [file, c] of cwdCache) if (c.rootKey === key) cwdCache.delete(file);
    }
    for (const [key, { tool, root }] of want) {
      let rs = rootStates.get(key);
      if (!rs) {
        const layout = LAYOUTS[tool];
        rs = { key, tool, top: layout.top(root), layout, lastFullAt: null, dirs: new Map(), sessions: new Map(), seen: null, touched: new Set(), budget: MAX_FILES };
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
   * @returns Promise<{ kind:'record', sessionId, cwd, tool, changedAt }[]> — 살피는 중에 다시 부르면 그 살피기를 같이 기다린다
   */
  function scan({ full = false, roots: given } = {}) {
    if (!running) running = run(full, given).catch(() => []).finally(() => { running = null; });
    return running;
  }
  return { scan };
}

module.exports = { createOfficeRecords, defaultRoots, RECORD_TIMES, SLICE };
