'use strict';
// 첫 보호 범위(STAGE1_DESIGN.md 4.17): 보호를 시작하기 전에 지킬 폴더를 미리 채운다. 진단(WorkBackupInventory.exe, 읽기 전용)은
// 찾기에만 짧게 쓰고, 크기는 줄마다 계획기(WorkBackupPlanner.exe)가 끝까지 센다(Fable 설계 검토 F2 · F7). 「보호 시작」은 이 범위의
// 넣은 폴더를 받고, 「추가 보호」는 손님이 고른 폴더를 더한다.
// 범위 파일(range.json)은 엔진 상태 폴더에만 둔다. 경로가 들어 있어 상태 파일 · 측정 · 기록에는 넣지 않는다.
const fs = require('node:fs/promises'), path = require('node:path'), crypto = require('node:crypto'), os = require('node:os');
const { spawn } = require('node:child_process');
const { StringDecoder } = require('node:string_decoder');
const { contains, overlap, atomic, directory } = require('./paths.cjs');
// 새 백업의 빼기 규칙(로그인 폴더 이름, 지킬 폴더로 받지 않는 자리)은 엔진과 같은 것을 쓴다
const { LOGIN_DIRS, skippedPlace } = require('./engine.cjs');

const GB = 1024 ** 3;
const BIG = 20 * GB, BUDGET = 80 * GB, CAP = 100 * GB, INNER = 5 * GB;
// 서버는 보이는 양이 시범 용량의 1.5배를 넘으면 올리기를 멈춘다(4.5) — 미리 채운 합이 이것을 넘으면 「보호 시작」을 막는다(F3)
const STOP = CAP * 1.5;
// 미리 채우는 목록은 24곳까지, 엔진의 폴더 검사(validateSources)는 30곳까지다 — 6곳은 「추가 보호」 몫이다.
const LIST_MAX = 24, ON_MAX = 30;
const DAY = 86400000;
// 진단은 찾기에만 쓴다: 드라이브 찾기(드라이브마다 2만 항목)는 끝나고 크기 세기는 일찍 멈춘다(F7)
const SCAN_ARGS = Object.freeze(['--seconds', '90', '--max-entries', '200000']);
// 계획기는 스스로 300초에서 멈추고 그때까지 센 값을 「다 세지 못함」으로 낸다. 그 값이 진단의 하한보다 훨씬 나으므로 끊지 않고 기다린다
// (11-25 이 PC: 150초에 끊자 88GB가 넘는 문서가 진단의 하한 약 15GB로 남아 시범 용량 안내가 뜨지 않았다)
const SCAN_TIMEOUT = 210000, MEASURE_TIMEOUT = 330000, MEASURE_AT_ONCE = 3;
const KNOWN = Object.freeze({ Desktop: 'desktop', Documents: 'documents', Pictures: 'pictures', Downloads: 'downloads', Music: 'music', Videos: 'videos' });
const CORE = new Set(['desktop', 'documents']);
// 작은 것만 넣는 무리의 차례(작업 폴더는 작은 것부터)
const SMALL = ['work', 'pictures', 'downloads', 'music', 'videos'];
const ORDER = ['desktop', 'documents', 'work', 'pictures', 'downloads', 'music', 'videos', 'added', 'aitool', 'ai'];
const WORK = new Set(['git_marker_name_only', 'project_manifest_name_only', 'workspace_marker_name_only', 'profile_directory_name_hint', 'explicit_root']);
// 넣지 않는 자리: 로그인 정보 · 열쇠, AI 도구와 편집기 설정, 앱이 따로 내보내야 하는 자리, 다시 만들 수 있는 것
const BLOCKED = new Set(['credential_location', 'ai_settings', 'external_manual', 'regenerable']);
// AI 도구 폴더 — 손님이 쓴 스킬 · 에이전트 · 명령이 있어 빼 둔 줄로 보인다(F4). 넣어도 구독 로그인 파일은 엔진이 어디서든 뺀다
const AI_TOOLS = new Set(['.claude', '.codex', '.gemini', '.agents']);
// 「추가 보호」로도 넣지 않는 로그인 자리(F15) — 새 백업이 안쪽을 빼는 폴더와 같은 집합이다(engine.cjs)
const LOGIN = new Set(LOGIN_DIRS);
// 사용자 폴더 맨 위에서 프로젝트로 보는 표시(진단의 project_marker와 같다, F9)
const MARK_FILES = new Set(['package.json', 'cargo.toml', 'pyproject.toml', 'requirements.txt', 'environment.yml']);
const MARK_EXT = new Set(['.sln', '.code-workspace']);

const key = (p) => path.resolve(p).toLowerCase();
const same = (a, b) => key(a) === key(b);
const windowsPath = (p) => typeof p === 'string' && p.length <= 1024 && !p.includes('\0') && /^[A-Za-z]:\\/.test(p) && path.win32.isAbsolute(p);
const segments = (p) => path.win32.normalize(p).split('\\').slice(1).filter(Boolean);
// 숨은 폴더(점으로 시작) 안과 AppData 안은 손님 작업 폴더로 세우지 않는다
const hiddenPlace = (p) => segments(p).some((s) => s.startsWith('.') || s.toLowerCase() === 'appdata');
const bytesOf = (c) => (Number.isSafeInteger(c?.stats?.logical_bytes) && c.stats.logical_bytes >= 0 ? c.stats.logical_bytes : 0);
const filesOf = (c) => (Number.isSafeInteger(c?.stats?.files) && c.stats.files >= 0 ? c.stats.files : 0);
const partialOf = (c) => Array.isArray(c?.stats?.incomplete) && c.stats.incomplete.length > 0;
/** 서로 품는 경로 가운데 바깥 것만 남긴다(entries는 {path}) */
function outermost(entries) {
  const out = [];
  for (const e of [...entries].sort((a, b) => a.path.length - b.path.length || a.path.localeCompare(b.path))) if (!out.some((o) => contains(o.path, e.path))) out.push(e);
  return out;
}
/** 서로 품는 줄 가운데 함께 따로 설 수 있는 가장 많은 수 — 바깥 줄이 빠지면 그 안의 줄이 따로 선다(entries는 {path}) */
const widest = (entries) => outermost(entries).reduce((n, top) => n + Math.max(1, widest(entries.filter((e) => contains(top.path, e.path) && !same(top.path, e.path)))), 0);
const row = (p, kind, c, extra = {}) => ({ path: p, kind, bytes: c ? bytesOf(c) : null, files: c ? filesOf(c) : null, partial: c ? partialOf(c) : true, measured: false, on: false, why: null, inner: null, grouped: 0, ...extra });

/**
 * 진단 결과(inventory.json)와 사용자 폴더 맨 위에서 찾은 프로젝트(extra)로 범위의 줄을 고른다. 디스크를 보지 않는 순수 함수다.
 * 크기는 진단이 센 하한이고 넣기는 아직 정하지 않는다(decide). 줄: { path, kind, bytes, files, partial, measured, on, why, inner, grouped }
 */
function pickRange(inventory, { forbidden = [], extra = [] } = {}) {
  if (!inventory || !Array.isArray(inventory.candidates) || inventory.candidates.length > 5000) throw new Error('진단 결과를 읽지 못했습니다.'); // find()가 받아 「다 읽지 못했습니다」로 남긴다 — 부호를 내도 받는 곳이 없다(GPT P2)
  const all = inventory.candidates.filter((c) => windowsPath(c?.path?.raw) && typeof c.category === 'string' && Array.isArray(c.evidence));
  const blocked = [...all.filter((c) => BLOCKED.has(c.category)).map((c) => c.path.raw), ...forbidden.filter((p) => typeof p === 'string')];
  // 부모로 묶지 않는 자리 — 로그인 · 설정 · 따로 내보낼 자리(다시 만들 수 있는 폴더는 엔진이 백업에서 빼므로 묶어도 된다)
  const guard = [...all.filter((c) => BLOCKED.has(c.category) && c.category !== 'regenerable').map((c) => c.path.raw), ...forbidden.filter((p) => typeof p === 'string')];
  const near = (p) => forbidden.some((f) => typeof f === 'string' && overlap(f, p));
  const present = all.filter((c) => c.state === 'present');

  // 알려진 폴더 — 서로 품어도 모두 둔다. 바깥 줄이 커서 빠져도 안쪽의 바탕화면 · 문서는 남아야 하고, 둘 다 넣으면 안쪽 줄은
  // 「함께 지킵니다」가 된다(GPT GA4). 드라이브 전체로 옮긴 폴더는 넣지 않고 그 까닭을 보인다(F11)
  const known = [];
  for (const c of present) {
    const name = c.evidence.map((e) => /^known_folder_(\w+)$/.exec(e)?.[1]).find((n) => n && KNOWN[n]);
    if (name && !known.some((k) => same(k.path, c.path.raw))) known.push({ path: c.path.raw, kind: KNOWN[name], c, whole: segments(c.path.raw).length < 1 || near(c.path.raw) });
  }
  // 넣지 않는 드라이브 전체 줄은 다른 줄을 가리지 않는다(GA4)
  const inKnown = (p) => known.some((k) => !k.whole && (contains(k.path, p) || contains(p, k.path)));
  // 찾아낸 작업 폴더와 AI 모델 · 자료 폴더
  const fromScan = present.flatMap((c) => {
    if (c.category !== 'irreplaceable' || c.evidence.some((e) => e.startsWith('known_folder_'))) return [];
    const work = c.evidence.some((e) => WORK.has(e)), ai = c.evidence.includes('ai_directory_name_hint');
    return work || ai ? [{ path: c.path.raw, kind: work ? 'work' : 'ai', c }] : [];
  });
  const fromHome = extra.filter((p) => windowsPath(p)).map((p) => ({ path: p, kind: 'work', c: null }));
  // 사용자 폴더 맨 위의 프로젝트는 homeProjects가 숨은 이름과 AppData를 이미 걸렀다 — 사용자 폴더가 놓인 자리로 다시 거르지 않는다(GA15)
  // 새 백업이 통째로 빼는 자리(node_modules 안 · 로그인 폴더)는 줄로 세우지 않는다 — 넣으면 빈 폴더로 성공한다(Fable 설계 검토 자리 1)
  const found = outermost([...fromScan, ...fromHome].filter(({ path: p, c }) => segments(p).length >= 1 && (!c || !hiddenPlace(p)) && !skippedPlace(p) && !inKnown(p) && !near(p) && !blocked.some((b) => contains(b, p))));
  // AI 도구 폴더(사용자 폴더 바로 아래의 .claude 등)
  const tools = present.filter((c) => c.category === 'ai_settings' && AI_TOOLS.has(path.win32.basename(c.path.raw).toLowerCase()) && !near(c.path.raw)).map((c) => ({ path: c.path.raw, kind: 'aitool', c }));
  let rows = [...known, ...found, ...tools].map(({ path: p, kind, c, whole }) => row(p, kind, c, whole ? { why: 'whole' } : {}));

  // 24곳 상한: 빼 둔 채 보이는 AI 폴더부터 큰 것을 덜고, 그래도 넘치면 작업 폴더를 같은 부모끼리 묶는다
  let more = 0;
  const over = () => rows.length - LIST_MAX;
  while (over() > 0 && rows.some((r) => r.kind === 'ai')) { const ai = rows.filter((r) => r.kind === 'ai').sort((a, b) => b.bytes - a.bytes)[0]; rows = rows.filter((r) => r !== ai); more++; }
  while (over() > 0) {
    const groups = new Map();
    for (const r of rows.filter((x) => x.kind === 'work')) {
      const parent = path.win32.dirname(r.path);
      if (segments(parent).length < 1 || hiddenPlace(parent) || inKnown(parent) || near(parent) || guard.some((b) => overlap(b, parent))) continue;
      // 사용자 폴더 뿌리(알려진 폴더의 부모)로는 묶지 않고, 작업 폴더가 아닌 줄을 품는 부모로도 묶지 않는다(F13)
      if (known.some((k) => same(path.win32.dirname(k.path), parent)) || rows.some((x) => x.kind !== 'work' && contains(parent, x.path))) continue;
      groups.set(key(parent), [...(groups.get(key(parent)) || []), r]);
    }
    const best = [...groups.values()].filter((g) => g.length > 1).sort((a, b) => b.length - a.length)[0];
    if (!best) break;
    const parent = path.win32.dirname(best[0].path);
    rows = rows.filter((r) => !best.includes(r) && !contains(parent, r.path));
    // 묶은 부모의 크기는 계획기가 센 뒤에만 넣기를 정한다(F13)
    rows.push(row(parent, 'work', null, { grouped: best.reduce((n, r) => n + (r.grouped || 1), 0) }));
  }
  while (over() > 0) { const w = rows.filter((r) => r.kind === 'work').sort((a, b) => (b.bytes || 0) - (a.bytes || 0))[0]; if (!w) break; rows = rows.filter((r) => r !== w); more++; }

  // 큰 폴더의 가장 큰 안쪽 프로젝트(그 줄을 빼고 안의 폴더만 고를지 정하게)
  for (const r of rows) {
    const inner = present.filter((c) => c.category === 'irreplaceable' && !c.evidence.some((e) => e.startsWith('known_folder_')) && !same(c.path.raw, r.path) && contains(r.path, c.path.raw) && bytesOf(c) >= INNER)
      .sort((a, b) => bytesOf(b) - bytesOf(a))[0];
    if (inner) r.inner = { name: path.win32.basename(inner.path.raw), bytes: bytesOf(inner), partial: partialOf(inner) };
  }
  return { folders: sortRows(rows), more, complete: inventory.scan_complete === true };
}
const sortRows = (rows) => rows.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || ((a.kind === 'work' || a.kind === 'ai') ? (a.bytes || 0) - (b.bytes || 0) : 0) || a.path.localeCompare(b.path));

/** 예산과 상관없이 그 줄을 빼 둘 까닭(세는 중 · 다 세지 못함 · 20GB 넘음 · AI 폴더) — 없으면 null */
function ownReason(r) {
  if (r.kind === 'ai' || r.kind === 'aitool') return r.kind;
  if (!SMALL.includes(r.kind)) return null;
  if (!r.measured) return 'measuring';
  if (r.partial) return 'unsure';
  if (r.bytes > BIG) return 'big';
  return null;
}
/**
 * 넣기를 정한다: 바탕화면 · 문서는 늘, 나머지는 계획기가 끝까지 세어 20GB 이하이고 80GB 예산 안일 때만(다 세지 못하면 빼 둔다, F2),
 * AI 모델 폴더와 AI 도구 폴더는 보이기만 한다. 손님이 넣고 뺀 것(choices — 경로를 소문자로 한 열쇠)이 먼저다: 뺀 줄은 예산에 들지 않고,
 * 넣은 줄은 먼저 예산에 든다. 그래서 큰 문서를 빼면 그 자리에 작은 폴더들이 들어온다. 새 줄을 돌려준다
 */
function decide(rows, choices = {}) {
  const out = rows.map((r) => ({ ...r, on: false, why: r.why === 'whole' || r.why === 'unreadable' ? r.why : null }));
  const chosen = (r) => choices[key(r.path)];
  const open = out.filter((r) => !r.why);
  for (const r of open.filter((x) => chosen(x) === false)) r.why = ownReason(r) || 'user';
  for (const r of open.filter((x) => chosen(x) === true || (CORE.has(x.kind) && chosen(x) === undefined))) r.on = true;
  // 예산은 넣은 줄의 합으로 잰다 — 서로 품는 줄은 바깥 것만 센다(GA4)
  for (const kind of SMALL) {
    for (const r of open.filter((x) => x.kind === kind && chosen(x) === undefined).sort((a, b) => (a.bytes || 0) - (b.bytes || 0))) {
      r.why = ownReason(r);
      if (r.why) continue;
      r.on = true;
      if (totals(out).bytes > BUDGET) { r.on = false; r.why = 'budget'; }
    }
  }
  for (const r of open.filter((y) => (y.kind === 'ai' || y.kind === 'aitool') && chosen(y) === undefined)) r.why = r.kind;
  return out;
}

/** 범위 줄의 합(넣은 것만, 서로 품으면 바깥 것만). partial이면 다 세지 못한 줄이 있다 */
function totals(folders) {
  const on = outermost(folders.filter((f) => f.on));
  return { bytes: on.reduce((n, f) => n + (Number.isSafeInteger(f.bytes) ? f.bytes : 0), 0), files: on.reduce((n, f) => n + (Number.isSafeInteger(f.files) ? f.files : 0), 0),
    partial: on.some((f) => f.partial || !f.measured || !Number.isSafeInteger(f.bytes)), count: on.length };
}

/** 실행 파일 하나를 창 없이 돌리고 표준 출력을 받는다(끝내기 · 시간 넘김 · 출력 상한) */
function run(executable, args, { input, timeoutMs, onChild } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try { child = spawn(executable, args, { windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] }); } catch (e) { reject(e); return; }
    onChild?.(child, true);
    let output = '', error = '', bytes = 0, large = false;
    const decoder = new StringDecoder('utf8');
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on('data', (b) => { bytes += b.length; output += decoder.write(b); if (bytes > 4 * 1024 * 1024) { large = true; child.kill(); } });
    child.stderr.setEncoding('utf8'); child.stderr.on('data', (b) => { error = (error + b).slice(-2000); });
    child.on('error', (e) => { clearTimeout(timer); onChild?.(child, false); reject(e); });
    child.stdin.on('error', () => {});
    child.on('close', (code) => { clearTimeout(timer); onChild?.(child, false); output += decoder.end(); if (code !== 0 || large) reject(Object.assign(new Error(error.trim() || `exit ${code}`), { exitCode: code })); else resolve(output); });
    child.stdin.end(input === undefined ? undefined : JSON.stringify(input));
  });
}

/** 한 단계 아래 폴더에 프로젝트 표시가 있는가(.git, package.json 등 — 이름만 본다) */
async function marked(dir) {
  let names;
  try { names = await fs.readdir(dir, { withFileTypes: true }); } catch { return false; }
  return names.slice(0, 2000).some((d) => (d.name.toLowerCase() === '.git') || (d.isFile() && (MARK_FILES.has(d.name.toLowerCase()) || MARK_EXT.has(path.extname(d.name).toLowerCase()))));
}
/**
 * 사용자 폴더 맨 위의 프로젝트(F9): 맨 위 폴더 자체나 그 바로 아래에 프로젝트 표시가 있으면 맨 위 폴더를 작업 폴더로 낸다.
 * 숨은 폴더 · AppData · OneDrive · 알려진 폴더(와 그것을 품은 폴더)는 보지 않는다. 연결 폴더는 따라가지 않는다
 */
async function homeProjects(home, knownPaths = []) {
  let top;
  try { top = await fs.readdir(home, { withFileTypes: true }); } catch { return []; }
  const out = [];
  for (const d of top.slice(0, 300)) {
    const n = d.name, low = n.toLowerCase();
    // 사용자 폴더에서 잘못 깐 node_modules는 프로젝트가 아니다(Fable 설계 검토 자리 1)
    if (!d.isDirectory() || d.isSymbolicLink() || n.startsWith('.') || low === 'appdata' || low === 'node_modules' || low.startsWith('onedrive')) continue;
    const p = path.join(home, n);
    if (knownPaths.some((k) => contains(p, k) || contains(k, p))) continue;
    if (await marked(p)) { out.push(p); continue; }
    let kids; try { kids = await fs.readdir(p, { withFileTypes: true }); } catch { continue; }
    for (const k of kids.slice(0, 200)) { if (k.isDirectory() && !k.isSymbolicLink() && !k.name.startsWith('.') && await marked(path.join(p, k.name))) { out.push(p); break; } }
    if (out.length >= 20) break;
  }
  return out;
}

class FirstRange {
  /**
   * root: 엔진 상태 폴더(range.json) · work: 진단 보고서를 잠깐 둘 폴더 · forbidden(): 엔진 폴더와 다른 백업 저장소 ·
   * inventoryPath · plannerPath: 엔진에 실린 진단 · 계획기 · exec: 시험이 갈아 끼우는 실행기 · home: 사용자 폴더
   */
  constructor({ root, work = null, inventoryPath, plannerPath, forbidden = () => [], exec = run, now = () => Date.now(), home = os.homedir() }) {
    Object.assign(this, { root: path.resolve(root), work: work ? path.resolve(work) : null, inventoryPath, plannerPath, forbidden, exec, now, home });
    this.file = path.join(this.root, 'range.json');
    this.data = null; this.status = 'idle'; this.error = null; this.children = new Set(); this.closing = false; this.finding = null; this.measuring = new Set(); this.queue = []; this.active = 0;
    // 「보호 시작」 때 없던 넣은 폴더(뽑은 외장 드라이브 따위) — 손님이 뺀 것이 아니므로 고른 것에 적지 않고, 다시 찾거나 다시 넣을 때까지 빼 둔다(GA13)
    this.gone = new Set();
    this.onChange = () => {};
  }
  /** 띄운 진단 · 계획기를 기억한다. 창을 닫는 중에 막 뜬 것은 바로 끊는다(GA11) */
  track(child, alive) {
    if (!alive) { this.children.delete(child); return; }
    this.children.add(child);
    if (this.closing) { try { child.kill(); } catch { } }
  }
  async open() {
    try {
      const d = JSON.parse(await fs.readFile(this.file, 'utf8'));
      if (d?.v === 2 && Array.isArray(d.folders) && Array.isArray(d.added) && d.choices && typeof d.choices === 'object') this.data = d;
    } catch { /* 없거나 깨졌으면 다시 찾는다 */ }
    // 앞서 도중에 끝난 진단이 남긴 보고서 폴더(경로와 프로그램 목록이 든다)를 지운다(F14)
    for (const base of new Set([this.work || this.root, this.root])) {
      try { for (const n of await fs.readdir(base)) if (/^range-scan-[0-9a-f-]{36}$/.test(n)) await fs.rm(path.join(base, n), { recursive: true, force: true }).catch(() => {}); } catch { }
    }
    if (this.data) { this.settleChoices(await this.forbiddenNow()); this.status = this.data.failed ? 'failed' : 'ready'; this.error = this.data.failed || null; }
    // 세다 만 줄은 다시 센다
    for (const f of [...(this.data?.folders || []), ...(this.data?.added || [])]) if (this.wantsMeasure(f)) this.measure(f.path);
  }
  /** 다시 찾을 때인가 — 범위가 없거나 하루가 지났거나 앞서 실패했다(찾는 중이면 아니다) */
  stale() { return !this.finding && (!this.data?.at || !(this.now() - Date.parse(this.data.at) < DAY) || !!this.data.failed); }
  /** 손님이 「넣기」를 누르기 전인 확인할 줄인가(settleChoices) — 같은 폴더가 미리 채운 줄로도 있으면 함께 세지 않는다 */
  asked(p) { return this.data?.choices[key(p)] === false && this.data.added.some((a) => a.asked && same(a.path, p)); }
  wantsMeasure(f) { return !f.measured && f.why !== 'whole' && f.why !== 'unreadable' && !this.asked(f.path) && (f.kind !== 'ai' && f.kind !== 'aitool' || this.data?.choices[key(f.path)] === true); }
  folders() {
    const d = this.data; if (!d) return [];
    const added = d.added.map((a) => ({ path: a.path, kind: 'added', bytes: a.bytes ?? null, files: a.files ?? null, partial: !!a.partial, measured: !!a.measured, unknown: !!a.unknown, on: true, why: null, inner: null, grouped: 0 }));
    // 넣기는 손님이 넣고 뺀 것과 함께 정한다(decide). 「추가 보호」 줄은 늘 넣음이고 손님이 빼면 빠진다
    const picked = decide(d.folders.filter((f) => !added.some((a) => same(a.path, f.path))), d.choices);
    const list = [...picked, ...added.map((a) => (d.choices[key(a.path)] === false ? { ...a, on: false, why: 'user' } : a))]
      .map((f) => ({ ...f, measuring: this.measuring.has(key(f.path)) }));
    for (const f of list) if (f.on && this.gone.has(key(f.path))) Object.assign(f, { on: false, why: 'gone' });
    // 엔진의 폴더 검사는 30곳까지다(GA8 · r2 GA5 · r3 GA3). 넘치면 손님이 고르지 않고 저절로 넣은 작은 것만 넣는 무리를 큰 것부터 뺀다.
    // 바탕화면 · 문서와 손님이 고른 줄은 빼지 않는다 — 그래도 넘치면 「보호 시작」이 RANGE_FULL로 멈춰 손님이 고른다(blocker, Fable 설계 검토 자리 2)
    while (totals(list).count > ON_MAX) {
      const r = list.filter((f) => f.on && SMALL.includes(f.kind) && d.choices[key(f.path)] === undefined).sort((a, b) => (b.bytes || 0) - (a.bytes || 0))[0];
      if (!r) break;
      Object.assign(r, { on: false, why: 'full' });
    }
    // 넣은 줄 안의 줄은 그 줄과 함께 올라간다 — 손님이 뺐거나 저절로 빠진 줄도 그대로 「함께 지킵니다」로 보인다(GA5)
    const holders = list.filter((f) => f.on);
    for (const f of list) {
      const holder = f.why === 'whole' || f.why === 'unreadable' || f.why === 'gone' ? null : holders.find((o) => o !== f && contains(o.path, f.path) && !same(o.path, f.path));
      f.within = holder ? holder.path : null;
      if (holder) Object.assign(f, { on: true, why: null });
    }
    return sortRows(list);
  }
  state() {
    const folders = this.folders();
    // 넣기를 정하는 줄(바탕화면 · 문서 · 작은 것만 넣는 무리)과 넣은 줄을 세는 동안은 「세는 중」이다(진단이 실패한 뒤 더한 폴더도)
    const measuring = this.status !== 'scanning' && folders.some((f) => f.measuring && (f.on || CORE.has(f.kind) || SMALL.includes(f.kind)));
    return { status: this.status, measuring, at: this.data?.at || null, complete: typeof this.data?.complete === 'boolean' ? this.data.complete : null, error: this.error, more: this.data?.more || 0,
      folders, total: totals(folders), cap: CAP, budget: BUDGET, stop: STOP };
  }
  /** 범위 파일 쓰기는 한 줄로 세운다 — 더하기와 크기 세기가 함께 쓰면 Windows의 바꿔 넣기가 EPERM으로 실패한다. 쓸 때의 최신 범위를 쓴다 */
  save() {
    const write = async () => { await fs.mkdir(this.root, { recursive: true }); await atomic(this.file, JSON.stringify(this.data)); };
    const next = (this.saving || Promise.resolve()).catch(() => {}).then(write);
    this.saving = next;
    return next;
  }
  /**
   * target까지 넣을 때 30곳에 세는 수(r4 GA3) — 저절로 빠지고 들어오는 줄이 손님이 고른 줄과 같은 한도를 쓰게 한다. 두 수의 큰 쪽이다.
   * 하나는 지금 이 줄을 넣으면 선 곳 수다(저절로 넣은 작은 무리도 센다). 하나는 손님이 넣은 줄과 바탕화면 · 문서가 어느 조합으로 남아도
   * 따로 설 수 있는 가장 많은 수다 — 찾을 수 없거나 열리지 않아 지금 빠져 있는 줄도 다시 꽂으면 들어오고, 바깥 줄이 빠지면(손님이 빼거나,
   * 찾을 수 없거나, 다시 세어 저절로 빠지거나) 안쪽 줄이 따로 선다(Fable 설계 검토 P2 · 0.7.5 GPT GA3). 아직 찾지 못했거나 드라이브 전체라
   * 넣을 수 없는 바탕화면 · 문서는 자리를 남겨 둔다. 저절로 넣은 작은 무리는 folders()가 양보시키므로 뒤의 수에 넣지 않는다
   */
  claimed(list, target) {
    const { folders, choices } = this.data;
    const chosen = (f) => same(f.path, target) || choices[key(f.path)];
    const all = list.some((f) => same(f.path, target)) ? list : [...list, { path: target, kind: 'added', on: true }];
    const now = totals(all.map((f) => (same(f.path, target) ? { ...f, on: true } : f))).count;
    const may = all.filter((f) => f.why !== 'whole' && (chosen(f) === true || (chosen(f) === undefined && (CORE.has(f.kind) || f.kind === 'added'))));
    return Math.max(now, widest(may)) + [...CORE].filter((k) => !folders.some((f) => f.kind === k && f.why !== 'whole')).length;
  }
  blank() { return { v: 2, at: null, complete: null, failed: null, more: 0, folders: [], added: [], choices: {} }; }
  /** 진단을 뒤에서 돌린다. 도는 진단은 하나뿐이다(F14) */
  find() {
    if (this.finding) return this.finding;
    if (this.closing) return Promise.resolve(this.state());
    this.status = 'scanning'; this.error = null; this.onChange();
    this.finding = (async () => {
      const base = this.work || this.root, out = path.join(base, `range-scan-${crypto.randomUUID()}`);
      try {
        await fs.mkdir(base, { recursive: true });
        // 폴더를 만드는 사이 창을 닫았으면 진단을 띄우지 않는다(GA11)
        if (this.closing) throw new Error('closing');
        await this.exec(this.inventoryPath, ['--output', out, ...SCAN_ARGS], { timeoutMs: SCAN_TIMEOUT, onChild: (c, alive) => this.track(c, alive) });
        const stat = await fs.lstat(path.join(out, 'inventory.json'));
        if (!stat.isFile() || stat.size > 64 * 1024 * 1024) throw new Error('진단 결과가 너무 큽니다.');
        const inventory = JSON.parse(await fs.readFile(path.join(out, 'inventory.json'), 'utf8'));
        const forbidden = await this.forbiddenNow();
        const knownPaths = (inventory.candidates || []).filter((c) => c?.evidence?.some?.((e) => /^known_folder_/.test(e)) && windowsPath(c?.path?.raw)).map((c) => c.path.raw);
        const picked = pickRange(inventory, { forbidden, extra: await homeProjects(this.home, knownPaths) });
        const folders = await this.checked(picked.folders, forbidden);
        // 손님이 넣은 줄을 이번 진단이 놓쳤으면(시간 제한 따위) 그 줄을 그대로 둔다(GA6)
        const kept = (this.data?.folders || []).filter((o) => this.data.choices[key(o.path)] === true && o.why !== 'whole' && !folders.some((n) => same(n.path, o.path)));
        folders.push(...await this.checked(kept.map((o) => ({ ...o, why: null })), forbidden));
        if (this.closing) return this.state();
        // 하루가 지났으므로 모든 줄의 크기를 다시 센다 — 「추가 보호」로 더한 줄도(GA7)
        for (const f of folders) f.measured = false;
        this.data = { ...(this.data || this.blank()), at: new Date(this.now()).toISOString(), complete: picked.complete, failed: null, more: picked.more, folders };
        for (const a of this.data.added) a.measured = false;
        this.gone.clear();
        this.settleChoices(forbidden);
        await this.save(); this.status = 'ready';
        for (const f of [...folders, ...this.data.added]) if (this.wantsMeasure(f)) this.measure(f.path);
      } catch (e) {
        if (this.closing) { this.status = 'idle'; return this.state(); }
        this.error = /ENOENT/.test(String(e?.code || e?.message)) ? '진단 도구를 찾지 못했습니다.' : '이 PC의 폴더를 다 읽지 못했습니다.';
        this.data = { ...(this.data || this.blank()), at: new Date(this.now()).toISOString(), failed: this.error };
        await this.save().catch(() => {}); this.status = 'failed';
      } finally {
        this.finding = null;
        await fs.rm(out, { recursive: true, force: true }).catch(() => {});
        this.onChange();
      }
      return this.state();
    })();
    return this.finding;
  }
  async forbiddenNow() { try { return [...await this.forbidden()].filter((p) => typeof p === 'string'); } catch { return []; } }
  /** 폴더가 지금 열리는가 — 엔진의 폴더 검사와 같은 길(연결 폴더 · 정션 거절)로 열고 목록을 읽는다. 실제 철자를 돌려준다 */
  async opens(p) { const real = await directory(p); await fs.readdir(real); return real; }
  /** 진단 뒤 실제로 열리는 폴더만 넣는다 — 연결 폴더 · 정션 아래나 열 수 없는 폴더는 까닭과 함께 빼 두고(엔진의 폴더 검사와 같은 길, F11), 실제 철자로 둔다 */
  async checked(rows, forbidden) {
    const out = [];
    for (const r of rows) {
      if (r.why === 'whole') { out.push(r); continue; }
      try {
        const real = await directory(r.path); await fs.readdir(real);
        if (forbidden.some((f) => overlap(f, real)) || out.some((o) => same(o.path, real))) continue;
        out.push({ ...r, path: real });
      } catch {
        // 손님이 넣은 줄(AI 폴더도)은 열리지 않아도 빼 둔 줄로 남긴다 — 다시 꽂으면 들어올 줄이라 30곳에 센다(0.7.5 GPT GA4)
        if (CORE.has(r.kind) || SMALL.includes(r.kind) || this.data?.choices[key(r.path)] === true) out.push({ ...r, why: 'unreadable' });
      }
    }
    return out;
  }
  /** 넣기 · 빼기. 빼 둔 채 세지 않은 줄을 넣으면 그때 센다 */
  async set(target, on) {
    if (typeof target !== 'string' || typeof on !== 'boolean') throw Object.assign(new Error('고를 폴더를 다시 눌러 주세요.'), { code: 'BAD_INPUT' });
    // 엔진 폴더 · 다른 백업 저장소와 겹치게 된 줄은 넣지 않는다 — 넣으면 엔진의 폴더 검사가 시작을 거절한다(0.7.5 GPT r6 GA2)
    const forbidden = on ? await this.forbiddenNow() : [];
    let list = this.folders(), f = list.find((y) => same(y.path, target));
    if (!f) throw Object.assign(new Error('범위에 없는 폴더입니다. 다시 찾아 주세요.'), { code: 'NOT_FOUND' });
    // 없어져 빼 둔 줄은 다시 열리면 넣는다(드라이브를 다시 꽂은 뒤). 30곳 검사를 지난 뒤에만 표시를 지운다(다시 검수 GA2)
    if (on && f.why === 'gone') {
      try { await this.opens(f.path); } catch { throw Object.assign(new Error('이 폴더를 아직 찾을 수 없습니다.'), { code: 'RANGE_GONE' }); }
      // 여는 동안 「추가 보호」가 끝났을 수 있다 — 지금 목록으로 센다(Fable 설계 검토)
      list = this.folders(); f = list.find((y) => same(y.path, target)) || f;
    }
    if (on && (f.why === 'unreadable' || f.why === 'whole' || forbidden.some((p) => overlap(p, f.path)))) throw Object.assign(new Error('이 폴더는 넣을 수 없습니다.'), { code: 'SOURCES_MISSING' });
    if (on && !(f.on && this.data.choices[key(f.path)] === true) && this.claimed(list, f.path) > ON_MAX) throw Object.assign(new Error('지킬 폴더는 30곳까지입니다.'), { code: 'RANGE_FULL' });
    if (on) this.gone.delete(key(f.path));
    this.data.choices[key(f.path)] = on;
    await this.save();
    const stored = [...this.data.folders, ...this.data.added].find((y) => same(y.path, f.path));
    if (on && stored && this.wantsMeasure(stored)) this.measure(stored.path);
    this.onChange(); return this.state();
  }
  /** 추가 보호 — 고른 폴더를 범위에 넣음으로 더하고 크기는 뒤에서 센다. 돌려주는 skipped는 더하지 않은 까닭 */
  async add(paths) {
    if (!Array.isArray(paths) || !paths.length || paths.length > ON_MAX) throw Object.assign(new Error('더할 폴더를 다시 골라 주세요.'), { code: 'BAD_INPUT' });
    this.data ||= this.blank();
    const forbidden = await this.forbiddenNow(), skipped = [];
    for (const given of paths) {
      let real;
      try { real = await directory(given); await fs.readdir(real); } catch { skipped.push({ path: String(given).slice(0, 1024), why: 'unreadable' }); continue; }
      if (segments(real).length < 1) { skipped.push({ path: real, why: 'drive' }); continue; }
      if (forbidden.some((f) => overlap(f, real))) { skipped.push({ path: real, why: 'engine' }); continue; }
      // 로그인 자리와 앱이 쓰는 자리(AppData)는 넣지 않는다. 앱 설정은 옮겨 오기 꾸러미가 허용 목록으로 지킨다(F15)
      if (segments(real).some((s) => LOGIN.has(s.toLowerCase())) || overlap(path.join(this.home, 'AppData'), real)) { skipped.push({ path: real, why: 'login' }); continue; }
      // node_modules 안은 새 백업이 담지 않아 빈 폴더로 성공한다(Fable 설계 검토 자리 1)
      if (skippedPlace(real)) { skipped.push({ path: real, why: 'rebuild' }); continue; }
      const list = this.folders();
      const holder = list.find((f) => f.on && contains(f.path, real));
      if (holder) { skipped.push({ path: real, why: 'inside', holder: holder.path }); continue; }
      // 세는 중인 줄은 다 세면 들어올 수 있으므로 넣은 것으로 친다(GA8)
      if (this.claimed(list.map((f) => (f.why === 'measuring' ? { ...f, on: true } : f)), real) > ON_MAX) { skipped.push({ path: real, why: 'full' }); continue; }
      // 없어져 빼 둔 줄을 다시 고르면 30곳 검사를 지난 뒤에만 표시를 지운다(set과 같은 길, Fable 설계 검토 자리 2)
      this.gone.delete(key(real));
      // 미리 채운 줄(커서 빼 둔 동영상 따위)을 고르면 새 줄을 만들지 않고 그 줄을 넣는다 — 센 크기가 그 줄에 남는다(GA3)
      const existing = this.data.folders.find((f) => same(f.path, real) && f.why !== 'unreadable' && f.why !== 'whole');
      if (existing) {
        // 그 안의 「추가 보호」 줄은 걷는다 — 바깥 줄을 나중에 빼도 안쪽 줄이 따로 남아 곳 수를 늘리지 않게(다시 검수 GA3)
        this.dropInside(real);
        this.data.choices[key(real)] = true;
        if (this.wantsMeasure(existing)) this.measure(existing.path);
        continue;
      }
      // 고른 폴더가 품는 「추가 보호」 줄은 걷는다(고른 폴더 하나로 둔다). 미리 채운 줄은 남겨 「함께 지킵니다」로 보인다
      this.dropInside(real);
      this.data.added.push({ path: real, bytes: null, files: null, partial: true, measured: false });
      this.data.choices[key(real)] = true;
      this.measure(real);
    }
    await this.save(); this.onChange();
    return { ...this.state(), skipped };
  }
  /**
   * 줄이 없는데 「넣음」만 남은 것을 손님이 확인할 줄로 바꾼다(0.7.5 GPT r2 ~ r5). 0.7.4는 열리지 않는 AI 폴더의 줄을 버리고, 바깥 폴더를 더하며
   * 걷은 줄도 「넣음」을 남겼다 — 파일만으로 가를 수 없어 저절로 넣지도 말없이 버리지도 않는다. 뺀 줄로 보이고(「넣기」로 되돌린다), 「보호 시작」을
   * 한 번 멈춰 목록을 보게 한다(sources). 넣은 바깥 줄 안의 것은 「함께 지킵니다」로 보이고, 바깥 줄이 빠지면 뺀 줄로 남는다. 엔진 폴더와 겹치는 것만 걷는다
   */
  settleChoices(forbidden = []) {
    const { folders, added, choices } = this.data, rows = [...folders, ...added];
    for (const k of Object.keys(choices)) {
      if (choices[k] !== true || rows.some((f) => key(f.path) === k)) continue;
      delete choices[k]; this.data.ask = true;
      if (!windowsPath(k) || forbidden.some((p) => overlap(p, k))) continue;
      // asked: 손님이 「넣기」를 누르기 전에는 세지 않는다
      added.push({ path: k, bytes: null, files: null, partial: true, measured: false, asked: true });
      choices[k] = false;
    }
  }
  /** 바깥 폴더를 고르면 그 안의 「추가 보호」 줄과 그 줄의 「넣음」을 걷는다 — 손님이 뺀 것과 미리 채운 줄의 것은 남긴다(0.7.5 GPT r2 GA1) */
  dropInside(real) {
    const { folders, choices } = this.data, inside = this.data.added.filter((a) => contains(real, a.path));
    this.data.added = this.data.added.filter((a) => !inside.includes(a));
    for (const a of inside) if (choices[key(a.path)] === true && !folders.some((f) => same(f.path, a.path))) delete choices[key(a.path)];
  }
  /** 한 줄의 크기를 계획기로 센다(뒤에서, 셋까지 함께). 시간을 넘기면 「다 세지 못함」으로 둔다 */
  measure(target) {
    const k = key(target);
    if (this.measuring.has(k) || this.closing) return;
    this.measuring.add(k); this.queue.push(target); this.pump();
  }
  pump() {
    while (this.active < MEASURE_AT_ONCE && this.queue.length && !this.closing) {
      const target = this.queue.shift(); this.active++;
      (async () => {
        let plan = null;
        try { plan = JSON.parse(await this.exec(this.plannerPath, [], { input: { sources: [target], exclusions: [] }, timeoutMs: MEASURE_TIMEOUT, onChild: (c, alive) => this.track(c, alive) })); } catch { /* 다 세지 못함 */ }
        this.measuring.delete(key(target));
        // 같은 경로의 줄이 미리 채운 줄과 더한 줄에 함께 있을 수 있다 — 둘 다 적는다(GA3)
        const matches = this.data ? [...this.data.folders, ...this.data.added].filter((y) => same(y.path, target)) : [];
        if (matches.length && !this.closing) {
          for (const f of matches) {
            if (plan && plan.schema === 1 && Number.isSafeInteger(plan.bytes) && Number.isSafeInteger(plan.files)) Object.assign(f, { bytes: plan.bytes, files: plan.files, partial: plan.complete !== true, measured: true, unknown: false });
            else Object.assign(f, { partial: true, measured: true, unknown: f.bytes === null });
          }
          await this.save().catch(() => {});
        }
      })().finally(() => { this.active--; this.onChange(); this.pump(); });
    }
  }
  /**
   * 「보호 시작」 · 「이어서 백업」에 넘길 폴더 — 넣은 줄(서로 품으면 바깥 것만). 범위가 없거나 찾는 중이면 null(워커가 다른 길의 폴더를 쓴다).
   * 그사이 없어진 폴더가 있으면 시작하지 않는다: 그 줄을 「찾을 수 없어 빼 둠」으로 보이고 손님이 확인한 뒤 다시 누르게 한다(GA13 · Fable F5)
   */
  async sources() {
    if (!this.data || this.finding) return null;
    // 앞 판의 범위 파일에서 줄을 잃은 폴더를 뺀 줄로 보였으면 한 번 멈춰 목록을 보게 한다(settleChoices)
    if (this.data.ask) { this.data.ask = false; await this.save(); this.onChange(); throw this.goneError(); }
    const all = this.folders().filter((f) => f.on), on = outermost(all);
    if (!on.length) return null;
    const out = [];
    let missing = 0;
    for (const f of on) {
      try { out.push(await this.opens(f.path)); continue; } catch { }
      this.gone.add(key(f.path)); missing++;
      // 그 안의 넣은 줄은 하나씩 열어 본다 — 열리지 않는 줄(뽑은 드라이브의 문서 따위)만 함께 빼 두어 다시 눌렀을 때 또 멈추지 않게 하고
      // (다시 검수 GA4), 바깥 폴더만 목록 권한이 막혔으면 열리는 안쪽 줄은 그대로 넣는다(r3 GA2)
      for (const g of all.filter((x) => !same(x.path, f.path) && contains(f.path, x.path))) {
        try { await this.opens(g.path); } catch { this.gone.add(key(g.path)); }
      }
    }
    if (missing) { this.onChange(); throw this.goneError(); }
    return out;
  }
  goneError() { return Object.assign(new Error('찾을 수 없는 폴더를 목록에서 빼 두었습니다. 목록을 확인하고 다시 눌러 주세요.'), { code: 'RANGE_GONE' }); }
  /** 「보호 시작」을 막을 까닭 — 찾는 중 · 세는 중 · 시범 용량의 1.5배 넘김(F3) · 30곳 넘김(손님이 넣은 줄만으로 넘친 때, 다시 검수 GA3 · GA5) */
  blocker() {
    const s = this.state();
    if (s.status === 'scanning' || s.measuring) return 'RANGE_BUSY';
    if (s.total.bytes > STOP) return 'RANGE_TOO_BIG';
    if (s.total.count > ON_MAX) return 'RANGE_FULL';
    return null;
  }
  async stop() { this.closing = true; this.queue = []; for (const c of this.children) { try { c.kill(); } catch { } } await this.finding?.catch(() => {}); }
}

module.exports = { FirstRange, pickRange, decide, totals, outermost, homeProjects, hiddenPlace, GB, BIG, BUDGET, CAP, STOP, INNER, LIST_MAX, ON_MAX };
