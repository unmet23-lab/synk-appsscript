#!/usr/bin/env node
'use strict';
/**
 * 사본 장부 — 등록된 작업 사본(git worktree)마다 「누가 쓰는가」를 붙여 보인다(2026-11-11, 작업 방식 정리 2단계). 읽기만 한다.
 *
 * 왜: 사본이 80곳쯤 되는데(11-10) 어느 것이 어느 세션 것인지 적힌 곳이 없어, 치울 때마다 하나씩 조사했다. 새 장부를 사람이 적으면 또 낡는다.
 *   그래서 이미 있는 두 기록을 맞대기만 한다 — git의 사본 목록과 Claude 앱의 세션 기록(세션마다 일하는 폴더 · 제목 · 보관 여부 · 마지막 활동).
 *   사본 ↔ 세션: 세션 기록의 cwd · worktreePath · shellFolders(셸이 들어간 폴더)가 사본 경로이거나 그 아래다.
 *     세션 임시 폴더(scratchpad) 아래 사본은 경로 속 세션 id로 잇는다.
 *   세션이 안 붙은 Claude 자리 사본(에이전트 격리 · 끝난 예약 회차 · 손으로 만든 사본)은 조건을 본다:
 *     잠기지 않음 · 그 경로를 쓰는 프로세스 없음 · 3일 넘게 조용 · 올리지 않은 변경 없음 · HEAD가 origin의 어느 가지에 있음.
 *     조건이 다 차도 갈래는 셋이다 — 끝난(보관된) 세션의 사본이면 「치워도 됨」, 어떤 세션 기록에도 없으면 「임자 모름」
 *     (세션이 `git worktree add`로 만들어 절대 경로로만 쓰는 사본은 기록에 안 남는다 — 살아 있는 세션 것일 수 있다),
 *     다시 만들 수 없는 git 밖 파일이 있으면 「옮긴 뒤 치움」.
 *   세션 기록을 못 읽었거나 못 읽은 기록이 하나라도 있으면 판정하지 않는다(쓰는 사본을 치워도 된다고 하지 않게).
 *   GPT 사본은 공간 지킴이가 같은 조건으로 스스로 치운다(SYNK_원본창고/공간지킴이.py). 여기서는 갈래와 마지막 움직임만 보이고, --전부면 같이 판정한다.
 *   이 도구는 아무것도 지우지 않는다.
 *
 *   node tools/사본장부.js              표
 *   node tools/사본장부.js --내것       이 세션에 붙은 사본만(환경의 세션 id로) — 세션을 닫기 전에 남은 사본을 본다
 *   node tools/사본장부.js --전부       GPT · 도구 자리 사본도 조건을 본다(사본마다 git status라 몇 분 걸린다)
 *   node tools/사본장부.js --크기 [초]  크기를 다시 잰다(기본 120초까지만, 나머지는 기억해 둔 값 · 다음에 이어 잰다)
 *   node tools/사본장부.js --적기       오늘 한 줄을 공용 작업본 output/크레딧작업/사본장부/자동.jsonl에(지킴이가 하루 한 번)
 *   node tools/사본장부.js --추이 [N]   날마다 남긴 한 줄
 *   공통: --json · --저장소 <폴더> · --세션방 <폴더>(앱 세션 기록 폴더, 시험용)
 *
 * 시험: node --test tests/사본장부.test.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { 공용작업본 } = require('./lib/공용작업본.js');

const 하루 = 86400000;
const 조용한날 = 3;   // 공간 지킴이 COPY_QUIET_DAYS와 같다
/** 다시 만들 수 있는 무시 폴더(공간 지킴이 REGENERABLE과 같다) — 이것뿐이면 치울 때 잃는 것이 없다 */
const 다시만듦 = new Set(['node_modules', '__pycache__', '.cache', 'coverage', 'test-results', 'playwright-report', '.pytest_cache', '.venv']);
const 회차표시이름 = 'synk-sched-run';   // tools/예약사본.js가 예약 회차 사본의 git 폴더에 남긴다

const 고른 = (p) => String(p || '').replace(/\\/g, '/').replace(/\/+$/, '');
const 열쇠 = (p) => 고른(p).toLowerCase();
const 집 = () => 고른(os.homedir());
const 로컬 = () => 고른(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'));

function git부르기(폴더, 인자, { 한도 = 300000 } = {}) {
  const r = spawnSync('git', ['-c', 'core.quotepath=false', ...인자], { cwd: 폴더, windowsHide: true, maxBuffer: 1 << 28, timeout: 한도, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } });
  return { 코드: r.error ? -1 : r.status, 글: r.stdout ? r.stdout.toString('utf8') : '' };
}

// ── 사본 목록 ───────────────────────────────────────────────────────────────

/** git worktree list --porcelain -z → [{경로, 머리, 가지, 잠김, 떼어짐}] (첫 줄이 공용 작업본). 못 읽으면 null. */
function 등록사본(뿌리) {
  const r = git부르기(뿌리, ['worktree', 'list', '--porcelain', '-z']);
  if (r.코드 !== 0) return null;
  const 목록 = [];
  let 지금 = null;
  for (const 칸 of r.글.split('\0')) {
    if (!칸) { if (지금) 목록.push(지금); 지금 = null; continue; }
    const 사이 = 칸.indexOf(' ');
    const 이름 = 사이 < 0 ? 칸 : 칸.slice(0, 사이), 값 = 사이 < 0 ? '' : 칸.slice(사이 + 1);
    if (이름 === 'worktree') 지금 = { 경로: 고른(값), 머리: null, 가지: null, 잠김: false, 떼어짐: false };
    else if (!지금) continue;
    else if (이름 === 'HEAD') 지금.머리 = 값;
    else if (이름 === 'branch') 지금.가지 = 값.replace(/^refs\/heads\//, '');
    else if (이름 === 'locked') 지금.잠김 = 값 || true;
    else if (이름 === 'detached') 지금.떼어짐 = true;
  }
  if (지금) 목록.push(지금);
  return 목록;
}

/** 사본이 놓인 자리의 갈래. 경로만 보고 정한다. */
function 갈래(경로, 뿌리, 첫째) {
  const p = 열쇠(경로), 공용 = 열쇠(뿌리), home = 열쇠(집()), local = 열쇠(로컬());
  if (첫째 || p === 공용) return '공용 작업본';
  if (p.startsWith(`${local}/synk/ops/`)) return '운영 사본';
  if (p.includes('/hermes/runtime/')) return '헤르메스';
  if (p.startsWith(`${local}/synk/기록닫기/`)) return '도구 임시';
  if (/\/temp\/claude\/.+\/scratchpad\//.test(p)) return '세션 임시';
  if (p.startsWith(`${공용}/.claude/worktrees/`) || /^[a-z]:\/synk-worktrees\/synk-appsscript\//.test(p)) return 'Claude 사본';
  if (p.startsWith(`${home}/.codex/worktrees/`) || p.startsWith(`${공용}/.codex/worktrees/`) || p.startsWith(`${home}/documents/synk-worktrees/`)) return 'GPT 사본';
  return '그 밖';
}

/** 사본의 git 관리 폴더(.git 파일이 가리키는 곳). 못 읽으면 null. */
function 관리폴더(경로) {
  try {
    const m = /^gitdir:\s*(.+?)\s*$/m.exec(fs.readFileSync(path.join(경로, '.git'), 'utf8'));
    return m ? path.resolve(경로, m[1]) : null;
  } catch { return null; }
}

/**
 * 관리 폴더의 HEAD · index · logs/HEAD 가운데 가장 늦은 때(ms). logs/HEAD는 수정 시각과 끝 줄에 적힌 시각 가운데 이른 쪽
 * — 내용은 그대로인데 수정 시각만 날마다 새것이 되는 일이 있었다(공간 지킴이 11-09 재기).
 */
function 관리움직임(관리) {
  if (!관리) return 0;
  let 늦은 = 0;
  for (const n of ['HEAD', 'index', 'logs/HEAD']) {
    let 때;
    try { 때 = fs.statSync(path.join(관리, n)).mtimeMs; } catch { continue; }
    if (n === 'logs/HEAD') {
      try {
        const 끝 = fs.readFileSync(path.join(관리, n), 'utf8').trimEnd().split('\n').pop() || '';
        const m = /> (\d{9,}) [+-]\d{4}/.exec(끝);
        if (m) 때 = Math.min(때, Number(m[1]) * 1000);
      } catch { /* 수정 시각을 쓴다 */ }
    }
    if (때 > 늦은) 늦은 = 때;
  }
  return 늦은;
}

function 회차표시(관리) {
  if (!관리) return null;
  try { return JSON.parse(fs.readFileSync(path.join(관리, 회차표시이름), 'utf8')); } catch { return null; }
}

// ── 앱 세션 기록 ─────────────────────────────────────────────────────────────

/** Claude 앱이 세션마다 남기는 기록 폴더 후보(계정 · 조직마다 하나, 세션 공유 미러가 같은 내용으로 맞춘다). */
function 세션방후보() {
  const 뿌리들 = [];
  const 아래 = (d) => { try { return fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => path.join(d, e.name)); } catch { return []; } };
  for (const d of 아래(path.join(로컬(), 'Claude-Data'))) 뿌리들.push(path.join(d, 'claude-code-sessions'));
  for (const d of 아래(path.join(로컬(), 'Packages'))) if (/^claude_/i.test(path.basename(d))) 뿌리들.push(path.join(d, 'LocalCache', 'Roaming', 'Claude', 'claude-code-sessions'));
  if (process.env.APPDATA) 뿌리들.push(path.join(process.env.APPDATA, 'Claude', 'claude-code-sessions'));
  const 방 = [];
  for (const r of 뿌리들) for (const 계정 of 아래(r)) for (const 조직 of 아래(계정)) 방.push(조직);
  return 방;
}

const 기록파일 = (f) => /^local_.*\.json$/.test(f);

/** 기록이 가장 늦게 바뀐 방 하나를 고른다(미러가 맞춰 두므로 어느 방이든 같지만, 막 바뀐 방이 가장 새것이다). 없으면 null. */
function 세션방고르기(후보 = 세션방후보()) {
  let 고름 = null, 늦은 = -1;
  for (const 방 of 후보) {
    let 때 = -1;
    try { for (const f of fs.readdirSync(방)) { if (!기록파일(f)) continue; const t = fs.statSync(path.join(방, f)).mtimeMs; if (t > 때) 때 = t; } } catch { continue; }
    if (때 > 늦은) { 늦은 = 때; 고름 = 방; }
  }
  return 고름;
}

/**
 * 세션 기록 → { 세션: [{id, cli, 폴더들[], 제목, 보관, 마지막(ms), 예약}], 못읽음: 수 }. 방이 없으면 null.
 * 못 읽은 파일(앱이 쓰는 중이었거나 깨짐)은 다른 방의 같은 이름 파일로 한 번 더 읽어 본다. 그래도 못 읽으면 못읽음에 센다.
 */
function 세션읽기(방, 다른방들 = []) {
  if (!방) return null;
  let 파일들;
  try { 파일들 = fs.readdirSync(방).filter(기록파일); } catch { return null; }
  const 세션 = [];
  let 못읽음 = 0;
  for (const f of 파일들) {
    let j = null;
    for (const 곳 of [방, ...다른방들.filter((x) => x !== 방)]) {
      try { j = JSON.parse(fs.readFileSync(path.join(곳, f), 'utf8')); if (j && j.sessionId) break; j = null; } catch { j = null; }
    }
    if (!j) { 못읽음++; continue; }
    세션.push({
      id: j.sessionId, cli: j.cliSessionId || null,
      // 제폴더들: 그 세션이 사는 자리(cwd · 앱이 만들어 준 사본). 폴더들: 거기에 셸이 들어간 폴더까지 — 살아 있는 세션은 어느 쪽이든 「쓰는 중」이다
      제폴더들: [...new Set([j.cwd, j.worktreePath].filter(Boolean).map(열쇠))],
      폴더들: [...new Set([j.cwd, j.worktreePath, ...(Array.isArray(j.shellFolders) ? j.shellFolders.filter((x) => typeof x === 'string') : [])].filter(Boolean).map(열쇠))],
      제목: String(j.title || '').slice(0, 60), 보관: Boolean(j.isArchived),
      마지막: Number(j.lastActivityAt) || 0, 예약: j.scheduledTaskId || null,
    });
  }
  return { 세션, 못읽음 };
}

/** 사본 경로 → 붙은 세션들. 세션의 폴더가 사본이거나 그 아래면 붙는다. 세션 임시 폴더 아래 사본은 경로 속 세션 id(cliSessionId)로도 잇는다. */
function 세션잇기(경로, 세션들) {
  const k = 열쇠(경로);
  const 붙음 = 세션들.filter((s) => s.폴더들.some((f) => f === k || f.startsWith(`${k}/`)));
  const m = /\/temp\/claude\/[^/]+\/([0-9a-f-]{36})\/scratchpad\//.exec(k);
  if (m) for (const s of 세션들) if (s.cli === m[1] && !붙음.includes(s)) 붙음.push(s);
  return 붙음;
}

/** 그 세션이 이 사본에 사는가(셸로 들르기만 한 것이 아니라) — 세션의 cwd · 앱이 만들어 준 사본이 이 경로이거나, 세션 임시 폴더의 임자다. */
function 제사본인가(경로, s) {
  const k = 열쇠(경로);
  if ((s.제폴더들 || s.폴더들).some((f) => f === k || f.startsWith(`${k}/`))) return true;
  const m = /\/temp\/claude\/[^/]+\/([0-9a-f-]{36})\/scratchpad\//.exec(k);
  return Boolean(m && s.cli === m[1]);
}

// ── 치워도 되는지 ────────────────────────────────────────────────────────────

/** 실행 중인 모든 프로세스의 명령줄(소문자, 빗금은 /로). 못 읽으면 null. */
function 명령줄들() {
  if (process.platform !== 'win32') return '';
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    '[Console]::OutputEncoding=[Text.Encoding]::UTF8; (Get-CimInstance Win32_Process | ForEach-Object { $_.CommandLine }) -join "`n"'],
  { encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 28, timeout: 120000 });
  if (r.error || r.status !== 0) return null;
  return r.stdout.toLowerCase().replace(/\\+/g, '/');
}

/** git status -z(무시 파일 포함) → { 변경: 올리지 않은 것 수, 살필무시: 다시 만들 수 없는 무시 경로들 } */
function 상태읽기(글) {
  let 변경 = 0;
  const 살필무시 = [];
  for (const 칸 of 글.split('\0')) {
    if (!칸) continue;
    const 표 = 칸.slice(0, 2), 곳 = 칸.slice(3).replace(/\/$/, '');
    if (표 !== '!!') { 변경++; continue; }
    if (!곳.split('/').some((part) => 다시만듦.has(part))) 살필무시.push(곳);
  }
  return { 변경, 살필무시 };
}

/**
 * 세션이 안 붙은 사본 하나가 조건을 다 채우는지. 걸리는 첫 까닭에서 멈춘다(뒤 검사가 더 비싸다).
 * 돌려주는 것: { 조건참, 까닭, 살필무시? } — 조건이 차도 「치워도 됨」인지는 부르는 쪽이 임자를 보고 정한다.
 */
function 판정(사본, { 뿌리, 지금, 명령줄 }) {
  if (!fs.existsSync(사본.경로)) return { 조건참: false, 까닭: '폴더가 없다(등록만 남음)' };
  if (사본.잠김) return { 조건참: false, 까닭: `잠겨 있다${typeof 사본.잠김 === 'string' ? ` — ${사본.잠김.slice(0, 60)}` : ''}` };
  if (명령줄 === null) return { 조건참: false, 까닭: '프로세스 목록을 못 읽었다' };
  if (명령줄.includes(열쇠(사본.경로))) return { 조건참: false, 까닭: '이 경로를 쓰는 프로세스가 있다' };
  if (지금 - 사본.움직임 < 조용한날 * 하루) return { 조건참: false, 까닭: `${조용한날}일 안에 움직였다` };
  const s = git부르기(사본.경로, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignored=matching']);
  if (s.코드 !== 0) return { 조건참: false, 까닭: 'git status를 못 읽었다' };
  const { 변경, 살필무시 } = 상태읽기(s.글);
  if (변경) return { 조건참: false, 까닭: `올리지 않은 변경 ${변경}개` };
  const c = 사본.머리 ? git부르기(뿌리, ['branch', '-r', '--contains', 사본.머리]) : { 코드: 1, 글: '' };
  if (c.코드 !== 0 || !c.글.trim()) return { 조건참: false, 까닭: 'origin에 없는 커밋이 있다' };
  return { 조건참: true, 까닭: `깨끗 · origin에 있음 · ${조용한날}일 조용`, ...(살필무시.length ? { 살필무시: 살필무시.slice(0, 20) } : {}) };
}

// ── 크기 ────────────────────────────────────────────────────────────────────

/** 폴더 크기(연결은 따라가지 않는다). 한도 시각을 넘기면 null. */
function 크기재기(폴더, 한도때) {
  let 바이트 = 0, 파일 = 0, 본 = 0;
  const 쌓기 = [폴더];
  while (쌓기.length) {
    const 지금 = 쌓기.pop();
    let 항목;
    try { 항목 = fs.readdirSync(지금, { withFileTypes: true }); } catch { continue; }
    for (const e of 항목) {
      if (e.isSymbolicLink()) continue;
      const p = path.join(지금, e.name);
      if (e.isDirectory()) { 쌓기.push(p); continue; }
      try { 바이트 += fs.lstatSync(p).size; 파일++; } catch { /* 그새 사라짐 */ }
      if (++본 % 4000 === 0 && Date.now() > 한도때) return null;
    }
  }
  return { 바이트, 파일 };
}

/** 기억해 둔 크기를 쓰고, 한도 초 안에서 다시 잰다. 기억은 장부 폴더의 크기.json. */
function 크기붙이기(사본들, 장부폴더, 한도초, 지금 = Date.now()) {
  const 파일 = path.join(장부폴더, '크기.json');
  let 기억 = {};
  try { 기억 = JSON.parse(fs.readFileSync(파일, 'utf8')) || {}; } catch { 기억 = {}; }
  if (한도초 > 0) {
    const 살아있는 = new Set(사본들.map((s) => 열쇠(s.경로)));
    for (const k of Object.keys(기억)) if (!살아있는.has(k)) delete 기억[k];
    const 한도때 = 지금 + 한도초 * 1000;
    // 다시 잴 것: 한 번도 안 잰 것 · 잰 뒤에 움직인 것 · 잰 지 7일 넘은 것. 안 잰 것부터, 그다음은 잰 지 오래된 순(날마다 움직이는 사본에 밀려 굶는 사본이 없게)
    const 잰때 = (s) => (기억[열쇠(s.경로)] ? 기억[열쇠(s.경로)].잰때 : 0);
    const 다시 = 사본들.filter((s) => { const g = 기억[열쇠(s.경로)]; return !g || s.움직임 > g.잰때 || 지금 - g.잰때 > 7 * 하루; }).sort((a, b) => 잰때(a) - 잰때(b));
    for (const s of 다시) {
      if (Date.now() > 한도때) break;
      if (!fs.existsSync(s.경로)) continue;
      const r = 크기재기(s.경로, 한도때);
      if (r) 기억[열쇠(s.경로)] = { ...r, 잰때: Date.now() };
    }
    try { fs.mkdirSync(장부폴더, { recursive: true }); fs.writeFileSync(파일, JSON.stringify(기억)); } catch { /* 못 적으면 다음에 다시 잰다 */ }
  }
  for (const s of 사본들) { const g = 기억[열쇠(s.경로)]; s.GB = g ? Math.round(g.바이트 / 1024 ** 3 * 100) / 100 : null; s.잰때 = g ? g.잰때 : null; }
}

// ── 장부 만들기 ─────────────────────────────────────────────────────────────

const 임자자리 = (자리) => 자리 === 'Claude 사본' || 자리 === '세션 임시';

/**
 * 옵션: 저장소 · 세션방 · 전부(GPT · 도구 자리도 조건을 본다) · 크기초 · 지금 · 명령줄들() · 세션들 · 못읽음(시험용)
 * 돌려주는 것: { 때, 뿌리, 세션방, 세션수, 못읽은세션, 사본: [...], 요약 } 또는 { 멈춤 }
 * 사본의 상태: 쓰는 중 · 치워도 됨 · 옮긴 뒤 치움 · 임자 모름 · 남김 · 세션 모름 · 지킴이 몫 · 도구 자리
 */
function 장부만들기(옵션 = {}) {
  const 뿌리 = 고른(공용작업본(옵션.저장소 || path.resolve(__dirname, '..')));
  const 지금 = 옵션.지금 || Date.now();
  const 목록 = 등록사본(뿌리);
  if (!목록) return { 멈춤: '사본 목록을 읽지 못했다(git worktree list)' };
  let 방 = null, 세션들 = 옵션.세션들 || null, 못읽음 = 옵션.못읽음 || 0;
  if (!세션들) {
    const 후보 = 옵션.세션방 ? [옵션.세션방] : 세션방후보();
    방 = 옵션.세션방 || 세션방고르기(후보);
    const 읽음 = 세션읽기(방, 후보);
    if (읽음) { 세션들 = 읽음.세션; 못읽음 = 읽음.못읽음; }
  }
  let 명령줄; let 읽었나 = false;
  const 명령 = () => { if (!읽었나) { 명령줄 = (옵션.명령줄들 || 명령줄들)(); 읽었나 = true; } return 명령줄; };
  const 사본 = [];
  목록.forEach((w, i) => {
    const 자리 = 갈래(w.경로, 뿌리, i === 0);
    if (자리 === '공용 작업본') return;
    const 관리 = 관리폴더(w.경로);
    const 붙은 = 세션들 ? 세션잇기(w.경로, 세션들) : [];
    const 산 = 붙은.filter((s) => !s.보관);
    const 표시 = 회차표시(관리);
    const 움직임 = Math.max(관리움직임(관리), ...붙은.map((s) => s.마지막), 0);
    const 행 = {
      경로: w.경로, 이름: w.경로.split('/').filter((x) => x.toLowerCase() !== 'synk-appsscript').pop() || w.경로, 갈래: 자리,
      머리: w.머리 ? w.머리.slice(0, 9) : null, 가지: w.가지, 잠김: w.잠김, 움직임,
      세션: 붙은.map((s) => ({ id: s.id, 제목: s.제목, 보관: s.보관, 마지막: s.마지막, 예약: s.예약 })),
      ...(표시 ? { 회차: { 종류: 표시.종류 || '예약 회차', 시작: 표시.시작 || null, 끝: 표시.끝 ? 표시.끝.때 || true : null } } : {}),
    };
    if (산.length) Object.assign(행, { 상태: '쓰는 중', 까닭: `세션 「${산[0].제목}」${산.length > 1 ? ` 외 ${산.length - 1}` : ''}` });
    else if (임자자리(자리) && !세션들) Object.assign(행, { 상태: '세션 모름', 까닭: '앱 세션 기록을 읽지 못했다' });
    else if (임자자리(자리) && 못읽음) Object.assign(행, { 상태: '세션 모름', 까닭: `못 읽은 세션 기록이 ${못읽음}개 있다(그 세션 것일 수 있다)` });
    else if (임자자리(자리) || 옵션.전부) {
      const v = 판정({ ...w, 움직임 }, { 뿌리, 지금, 명령줄: 명령() });
      // 임자가 끝났다고 볼 수 있는 것은 끝난(보관된) 세션이 「제 사본」으로 쓰던 때뿐이다 — 셸로 들르기만 한 끝난 세션은 임자가 아니다
      const 끝난임자 = 붙은.find((s) => 제사본인가(w.경로, s));
      const 덧 = v.살필무시 ? ` · git 밖 파일 ${v.살필무시.length}곳을 먼저 옮길 것` : '';
      if (!v.조건참) Object.assign(행, { 상태: '남김', 까닭: v.까닭 });
      else if (임자자리(자리) && !끝난임자) Object.assign(행, { 상태: '임자 모름', 까닭: `${v.까닭}${덧} · ${붙은.length ? '끝난 세션이 셸로 들르기만 한 사본' : '세션 기록에 없는 사본'}(살아 있는 세션이 손으로 만들어 쓰는 사본일 수 있다)` });
      else if (v.살필무시) Object.assign(행, { 상태: '옮긴 뒤 치움', 까닭: `${v.까닭}${덧}` });
      else Object.assign(행, { 상태: '치워도 됨', 까닭: v.까닭 });
      if (v.살필무시) 행.살필무시 = v.살필무시;
      if (끝난임자) 행.끝난세션 = 끝난임자.제목;
    } else Object.assign(행, { 상태: 자리 === 'GPT 사본' ? '지킴이 몫' : '도구 자리', 까닭: 자리 === 'GPT 사본' ? '공간 지킴이가 조건이 차면 치운다' : '' });
    사본.push(행);
  });
  const 장부폴더 = 옵션.장부폴더 || path.join(뿌리, 'output', '크레딧작업', '사본장부');
  크기붙이기(사본, 장부폴더, 옵션.크기초 || 0, 지금);
  return { 때: new Date(지금).toISOString(), 뿌리, 세션방: 방, 세션수: 세션들 ? 세션들.length : null, 못읽은세션: 못읽음, 사본, 요약: 요약하기(사본) };
}

function 요약하기(사본) {
  const 합 = (rows) => ({ 곳: rows.length, GB: Math.round(rows.reduce((s, r) => s + (r.GB || 0), 0) * 10) / 10, 안잼: rows.filter((r) => r.GB === null || r.GB === undefined).length });
  const 임자없음 = 사본.filter((r) => 임자자리(r.갈래) && r.상태 !== '쓰는 중');
  const 상태로 = (이름) => 합(임자없음.filter((r) => r.상태 === 이름));
  return {
    등록: 사본.length,
    쓰는중: 합(사본.filter((r) => r.상태 === '쓰는 중')),
    임자없음: { ...합(임자없음), 치워도됨: 상태로('치워도 됨'), 옮긴뒤치움: 상태로('옮긴 뒤 치움'), 임자모름: 상태로('임자 모름') },
    GPT: 합(사본.filter((r) => r.갈래 === 'GPT 사본' && r.상태 !== '쓰는 중')),
    도구: 합(사본.filter((r) => ['운영 사본', '헤르메스', '도구 임시', '그 밖'].includes(r.갈래) && r.상태 !== '쓰는 중')),
  };
}

/** 이 세션(환경의 세션 id)에 붙은 사본만 */
function 내것만(장부, env = process.env) {
  const 앱 = env.CLAUDE_CODE_HOST_SESSION_ID || null, cli = env.CLAUDE_CODE_SESSION_ID || null;
  if (!앱 && !cli) return { ...장부, 사본: [], 내세션: null };
  const 사본 = 장부.사본.filter((r) => r.세션.some((s) => s.id === 앱) || (cli && 열쇠(r.경로).includes(`/${cli.toLowerCase()}/scratchpad/`)));
  return { ...장부, 사본, 내세션: 앱 || cli };
}

// ── 날마다 한 줄 ────────────────────────────────────────────────────────────

function 적기(장부, 장부폴더) {
  fs.mkdirSync(장부폴더, { recursive: true });
  fs.appendFileSync(path.join(장부폴더, '자동.jsonl'), `${JSON.stringify({ 때: 장부.때, 못읽은세션: 장부.못읽은세션, ...장부.요약 })}\n`);
}

function 추이(장부폴더, 수 = 14) {
  let 줄 = [];
  try { 줄 = fs.readFileSync(path.join(장부폴더, '자동.jsonl'), 'utf8').split('\n').filter(Boolean); } catch { return []; }
  return 줄.slice(-수).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

// ── 화면 ────────────────────────────────────────────────────────────────────

const 날 = (ms) => { if (!ms) return '모름       '; const d = new Date(ms); const p = (n) => String(n).padStart(2, '0'); return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const 기가 = (r) => (r.GB === null || r.GB === undefined ? '  안 잼' : `${r.GB.toFixed(1).padStart(5)}GB`);
const 짧은경로 = (p, 뿌리) => { const k = 열쇠(p), r = 열쇠(뿌리), h = 열쇠(집()); return k.startsWith(`${r}/`) ? p.slice(뿌리.length + 1) : k.startsWith(`${h}/`) ? `~/${p.slice(집().length + 1)}` : p; };
const 폭맞춤 = (글, 폭) => { let w = 0, out = ''; for (const ch of 글) { const cw = /[ᄀ-ᇿ⺀-꓏가-힣＀-￯]/.test(ch) ? 2 : 1; if (w + cw > 폭) { out += '…'; w++; break; } out += ch; w += cw; } return out + ' '.repeat(Math.max(0, 폭 - w)); };

function 글로(장부, { 내것 = false } = {}) {
  if (장부.멈춤) return `[멈춤] ${장부.멈춤}`;
  const 줄 = [];
  const y = 장부.요약;
  줄.push(`사본 장부 · ${날(Date.parse(장부.때))} · 등록 사본 ${y.등록}곳(공용 작업본 빼고)${장부.세션수 === null ? ' · 앱 세션 기록을 못 읽음' : ` · 앱 세션 ${장부.세션수}개와 맞댐${장부.못읽은세션 ? `(못 읽은 기록 ${장부.못읽은세션}개)` : ''}`}`);
  if (내것) { 줄.push(장부.내세션 ? `이 세션(${장부.내세션})에 붙은 사본 ${장부.사본.length}곳 — 손으로 만들어 절대 경로로만 쓴 사본은 여기 안 나온다` : '이 셸에는 세션 id가 없다(CLAUDE_CODE_HOST_SESSION_ID) — 전체 표는 --내것 없이'); }
  const 묶음 = [
    ['세션이 쓰는 사본', (r) => r.상태 === '쓰는 중'],
    ['세션이 안 붙은 Claude 사본', (r) => 임자자리(r.갈래) && r.상태 !== '쓰는 중'],
    ['GPT 사본', (r) => r.갈래 === 'GPT 사본' && r.상태 !== '쓰는 중'],
    ['도구 자리(운영 사본 · 헤르메스 · 그 밖)', (r) => ['운영 사본', '헤르메스', '도구 임시', '그 밖'].includes(r.갈래) && r.상태 !== '쓰는 중'],
  ];
  for (const [제목, 거름] of 묶음) {
    const rows = 장부.사본.filter(거름).sort((a, b) => b.움직임 - a.움직임);
    if (!rows.length) continue;
    const GB = rows.reduce((s, r) => s + (r.GB || 0), 0), 안잼 = rows.filter((r) => r.GB === null || r.GB === undefined).length;
    줄.push('', `■ ${제목} ${rows.length}곳 · ${GB.toFixed(1)}GB${안잼 ? `(안 잰 곳 ${안잼})` : ''}`);
    for (const r of rows) {
      const 말 = r.상태 === '쓰는 중' ? r.까닭 : ['지킴이 몫', '도구 자리'].includes(r.상태) ? (r.까닭 || r.상태) : `${r.상태} — ${r.까닭}`;
      줄.push(`  ${폭맞춤(짧은경로(r.경로, 장부.뿌리), 58)} ${날(r.움직임)} ${기가(r)}  ${말}${r.회차 ? ' · 예약 회차' : ''}${r.끝난세션 ? ` · 끝난 세션 「${r.끝난세션}」` : ''}`);
    }
  }
  if (!내것) {
    const m = y.임자없음;
    const 몫 = (이름, v) => (v.곳 ? ` · ${이름} ${v.곳}곳 ${v.GB}GB` : '');
    줄.push('', `세션이 안 붙은 Claude 사본 ${m.곳}곳 가운데 치워도 되는 것 ${m.치워도됨.곳}곳${m.치워도됨.곳 ? ` ${m.치워도됨.GB}GB` : ''}${몫('옮긴 뒤 치울 것', m.옮긴뒤치움)}${몫('임자 모름(조건은 참)', m.임자모름)}. 이 도구는 지우지 않는다.`);
  }
  return 줄.join('\n');
}

function 추이글(행들) {
  if (!행들.length) return '아직 남긴 줄이 없다.';
  const 줄 = ['때                 등록   쓰는 중(곳 · GB)   세션 없는 Claude(곳 · GB · 치워도 됨 · 임자 모름)   GPT(곳 · GB)   도구'];
  for (const r of 행들) {
    const m = r.임자없음 || {};
    줄.push(`${날(Date.parse(r.때)).padEnd(16)}   ${String(r.등록).padStart(4)}   ${String(r.쓰는중.곳).padStart(3)} · ${String(r.쓰는중.GB).padStart(6)}       ${String(m.곳).padStart(3)} · ${String(m.GB).padStart(6)} · ${String((m.치워도됨 || {}).곳 ?? '-').padStart(2)} · ${String((m.임자모름 || {}).곳 ?? '-').padStart(2)}                         ${String(r.GPT.곳).padStart(3)} · ${String(r.GPT.GB).padStart(6)}   ${String(r.도구.곳).padStart(3)}`);
  }
  return 줄.join('\n');
}

const 쓰는법 = '쓰는 법: node tools/사본장부.js [--내것] [--전부] [--크기 [초]] [--적기] [--json] [--저장소 <폴더>] [--세션방 <폴더>] | --추이 [N]';

function 인자읽기(argv) {
  const o = { 내것: false, 전부: false, 크기초: 0, 적기: false, json: false, 추이: null, 저장소: undefined, 세션방: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const 값 = () => { if (i + 1 >= argv.length) throw new Error(`${a} 뒤에 값이 없다\n${쓰는법}`); return argv[++i]; };
    const 수 = (기본) => (argv[i + 1] && /^\d+$/.test(argv[i + 1]) ? Number(argv[++i]) : 기본);
    if (a === '--내것') o.내것 = true;
    else if (a === '--전부') o.전부 = true;
    else if (a === '--크기') o.크기초 = 수(120);
    else if (a === '--적기') o.적기 = true;
    else if (a === '--json') o.json = true;
    else if (a === '--추이') o.추이 = 수(14);
    else if (a === '--저장소') o.저장소 = path.resolve(값());
    else if (a === '--세션방') o.세션방 = path.resolve(값());
    else throw new Error(`모르는 선택지: ${a}\n${쓰는법}`);
  }
  return o;
}

function 실행(argv) {
  const o = 인자읽기(argv);
  const 뿌리 = 공용작업본(o.저장소 || path.resolve(__dirname, '..'));
  const 장부폴더 = path.join(뿌리, 'output', '크레딧작업', '사본장부');
  if (o.추이 !== null) { const 행 = 추이(장부폴더, o.추이); return { 코드: 0, 글: o.json ? JSON.stringify(행) : 추이글(행) }; }
  let 장부 = 장부만들기({ ...o, 장부폴더 });
  if (장부.멈춤) return { 코드: 1, 글: o.json ? JSON.stringify(장부) : 글로(장부) };
  if (o.적기) 적기(장부, 장부폴더);
  if (o.내것) 장부 = 내것만(장부);
  return { 코드: 0, 글: o.json ? JSON.stringify(장부) : 글로(장부, o) };
}

if (require.main === module) {
  try { const r = 실행(process.argv.slice(2)); process.stdout.write(`${r.글}\n`); process.exitCode = r.코드; }
  catch (e) { process.stderr.write(`${e.message}\n`); process.exitCode = 1; }
}

module.exports = { 등록사본, 갈래, 관리폴더, 관리움직임, 세션방후보, 세션방고르기, 세션읽기, 세션잇기, 제사본인가, 상태읽기, 판정, 크기재기, 크기붙이기, 장부만들기, 요약하기, 내것만, 적기, 추이, 글로, 추이글, 인자읽기, 실행, 쓰는법, 조용한날 };
