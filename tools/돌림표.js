#!/usr/bin/env node
'use strict';
/* LAB 돌림표(2026-11-10 LAB 하루 두 편 · 39계정 — 설계 1 · 2 · 3 · 4 · 21 · 22, docs/마케팅/LAB_하루두편_설계_20261110/README.md).
 *
 *   node tools/돌림표.js [--부터 YYYY-MM-DD] [--일수 5] [--json] [--준비무시] [--예비씀] [--다시] [--쓰기]
 *       계정마다(현지 날짜 · 칸) 어느 원본의 어느 판본이 나갈지 셈해 보인다. --쓰기면 빈 칸의 판을 그 원본 편 게시/준비.json 「판」에
 *       더한다(판에 「돌림」: true). 이미 있는 판(예약 · 게시 · 만든 사람이 단 판 · 지난 돌림 판)은 그대로 두고, --다시면 아직 안 건 돌림 판만
 *       지우고 다시 셈한다. 셈 규칙은 tools/lib/돌림.js 머리말.
 *   node tools/돌림표.js --장부 [--부터 …] [--일수 …] [--json]
 *       게시 장부 — LAB 판 전부를 계정 · 현지 날짜 · 칸 · 원본 · 판본 지문 · 상태 · 게시물 ID로 한 표에(같은 칸이 두 번 걸렸는지도).
 *   node tools/돌림표.js --묶음 [--부터 …] [--일수 …] [--json]
 *       같은 언어 묶음표(같은 플랫폼에서 같은 말로 올리는 계정들 — 돌림 ⑥)와 겹침 확인: 이미 있는 판 + 이번 셈에서 같은 원본이 24시간 안에
 *       두 계정에 가거나 같은 파일이 두 계정에 가는 짝, 나라별판이 같은 파일인 원본, 같은 판본 키를 둘이 쓰는 묶음. 하나라도 있으면 종료 1.
 *   node tools/돌림표.js --점검 [--json]   비상 정지 점검(14시 회차가 걸기 전) — 씨앗이 사흘 안에 올린 원본의 씨앗 24시간 평소 대비 배수, 숫자가 있는 씨앗의 과반이 0.3배 밑이면 「급락」(종료 1) · 숫자를 볼 씨앗이 없으면 「판정 불가」
 *   node tools/돌림표.js --멈춤 <편 폴더 이름> --까닭 "<까닭>"
 *       비상 정지(설계 3) — 그 원본의 준비.json 「돌림」.멈춤을 적고 아직 안 건 돌림 판을 뺀다. 이미 예약된 판은 목록으로 보인다
 *       (공개 전 예약을 다른 매일 판 편으로 바꿔 거는 것은 상시 승인 안, 공개된 글을 지우거나 비공개로 돌리는 것은 여쭌다).
 *   공통: --폴더 <편 폴더들이 있는 곳, 기본 docs/마케팅>(시험용) · --지금 <ISO>(시험용)
 *
 * 원본 편의 준비.json 「돌림」:
 *   {"형식": "이야기"|"퀴즈", "쓸날": "YYYY-MM-DD"(그날부터 · 동결 뒤 — 설계 20), "멈춤": null|{"날","까닭"}, "예비": false,
 *    "틀"?, "무대"?(⑯ 퀴즈 — 개그 무대), "판본": {"<판본 키>": {"언어", "파일", "표지"?, "글"(그 판본 글 정본 — 뜻 검사 지문),
 *    "원고": {"<플랫폼>": "<원고.json 또는 게시글 .txt>"}, "검수": {"뜻": {"결과": "통과", "지문"}, "글자": {"결과": "통과", "지문"}, …}}}}
 *   판본 키는 계정의 rotationVersion, 없으면 countryCode(나라마다 첫 2초 카드 · 끝 카드 · 썸네일 · 끝 질문이 다르다 — 설계 6).
 *   판본이 돌림에 드는 조건(설계 22): 파일이 있고, sns-계정.json labRotation.판본검수(기본 뜻 · 글자)가 모두 「통과」이며
 *   글자 검사의 지문 = 지금 영상 SHA-256, 뜻 검사의 지문 = 지금 「글」 파일 SHA-256 — 글을 고치면 뜻 검수가, 영상을 다시 렌더하면 글자
 *   검수가 저절로 무효가 된다.
 * 계정(sns-계정.json): LAB이고 dailyLine · dailyFormats가 있는 계정. rotationSeed는 씨앗(먼저 올림). 씨앗이 아닌 계정은
 * publicProfileComplete가 true이고 postRouteVerified가 true여야 칸을 받는다(설계 4 · 5). postRouteVerified 「첫판」은 첫 판 시험 —
 * 판 하나만 받고, 그 판을 플랫폼 예약 목록에서 확인해 true로 바꾸면 나머지 칸이 열린다. dailyFrom 「미정」은 아직 안 연 계정(칸 없음),
 * dailyTimesFrom 「미정」은 마지막 칸만 연 계정. --준비무시는 준비 · 「미정」을 풀고 셈만 해 본다(--쓰기와 함께 못 쓴다).
 * 걸린 판(예약됨 · 게시됨 · 거는 중 · 작업실 승인 대기 — 다른 작업본이 게시 장부 표에 잡은 것까지)은 --다시 · --멈춤에도 지우지 않는다.
 * 같은 언어 묶음은 계정의 languageGroup, 없으면 language다(같은 플랫폼 안에서만 묶는다). 나라 칸(countryCode)은 그 계정이 겨누는 나라 하나 —
 * 나라를 겨누지 않는 계정(@synkkorean — 전 세계 · 영어)은 countryCode를 비우고 rotationVersion · audience를 적는다.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const T = require('./lib/계정시간.js');
const 돌림 = require('./lib/돌림.js');
const 장부 = require('./게시장부.js');

const REPO = path.resolve(__dirname, '..');
const argValue = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null; };
const has = (name) => process.argv.includes(name);
const ROOT = argValue('--폴더') ? path.resolve(argValue('--폴더')) : path.join(REPO, 'docs', '마케팅');
const DONE = new Set(['예약됨', '게시됨']);
const GONE = new Set(['보류', '취소됨', '지움']);
const CACHE_DIR = process.env.SYNK_ROTATION_DIR || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'synk', '돌림표');

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch { return null; }
}

// 다 쓰고 바꿔 넣는다 — 쓰다 실패해 빈 파일이 남지 않게(현장 노트 git 「공용 문서를 쓰다 실패하면 빈 파일이 남는다」).
function writeJson(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

// 영상 SHA-256 — 경로 · 크기 · 수정 시각이 같으면 지난 값을 쓴다(판본이 수십 개라 매번 다 읽지 않게).
let shaCache = null;
function sha256(file) {
  const st = fs.statSync(file);
  const key = `${path.resolve(file)}|${st.size}|${st.mtimeMs}`;
  if (!shaCache) shaCache = readJson(path.join(CACHE_DIR, '지문.json')) || {};
  if (!shaCache[key]) {
    shaCache[key] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    shaCache.__dirty = true;
  }
  return shaCache[key];
}
function saveShaCache() {
  if (!shaCache?.__dirty) return;
  delete shaCache.__dirty;
  try { fs.mkdirSync(CACHE_DIR, { recursive: true }); writeJson(path.join(CACHE_DIR, '지문.json'), shaCache); } catch { /* 캐시는 없어도 된다 */ }
}

const resolveIn = (dir, p) => (p ? (path.isAbsolute(p) ? p : path.join(dir, p)) : null);
const relIn = (dir, file) => path.relative(dir, file).split(path.sep).join('/');

function loadLedger() {
  const ledger = readJson(path.join(ROOT, 'sns-계정.json')) || {};
  return { ledger, accounts: ledger.accounts || {}, cfg: ledger.labRotation || {} };
}

// 돌림 계정 — LAB · dailyLine · dailyFormats. 씨앗이 아니면 프로필 · 경로가 준비돼야 칸을 받는다. postRouteVerified 「첫판」은 첫 판 시험(판 하나만).
// notReady는 칸을 못 받는 계정과 까닭(시작 날 「미정」까지), closedStory는 dailyTimesFrom 「미정」이라 앞 칸이 닫힌 계정.
// ignoreReady(--준비무시)는 준비 · 「미정」을 풀고 셈만 해 본다 — 까닭은 원장 값 그대로 적는다.
function rotationAccounts(accounts, { ignoreReady = false } = {}) {
  const out = {};
  const notReady = [];
  const closedStory = [];
  const open = (v) => (ignoreReady && v === T.PENDING ? undefined : v);
  for (const [key, a] of Object.entries(accounts)) {
    if (a.brand !== 'LAB' || !a.dailyLine || !Array.isArray(a.dailyFormats)) continue;
    const trial = !a.rotationSeed && a.postRouteVerified === 장부.TRIAL;
    const why = [];
    if (a.dailyBlocked) why.push(`막힘 — ${a.dailyBlocked}`);
    if (!a.rotationSeed) {
      if (a.publicProfileComplete !== true) why.push('프로필 빈 칸(publicProfileComplete)');
      if (a.postRouteVerified !== true && !trial) why.push(`예약 경로 확인 전(${a.postRoute || '경로 없음'})`);
    }
    const blocked = why.length && !(ignoreReady && !a.dailyBlocked) ? why.join(' · ') : null;
    if (T.notStarted(a)) why.push('시작 날 미정(dailyFrom)');
    if (why.length) notReady.push({ account: key, why });
    else if (a.dailyTimesFrom === T.PENDING) {
      const closed = T.allSlots(a).slice(0, -1).map((s) => `${s.time} ${s.format || ''}`.trim());
      if (closed.length) closedStory.push({ account: key, closed });
    }
    out[key] = { platform: a.platform, language: a.language || null, group: a.languageGroup || a.language || null, versionKey: a.rotationVersion || a.countryCode || null,
      timeZone: a.timeZone, dailyTimes: a.dailyTimes, dailyFormats: a.dailyFormats, dailyFrom: open(a.dailyFrom), dailyTimesFrom: open(a.dailyTimesFrom),
      seed: Boolean(a.rotationSeed), trial: trial && !ignoreReady, blocked };
  }
  return { rotation: out, notReady, closedStory };
}

// 판본이 돌림에 드는지(설계 22) — 파일 · 검수 결과 · 지문.
function versionState(dir, v, required) {
  if (!v) return { ready: false, why: '판본 없음' };
  const file = resolveIn(dir, v.파일);
  if (!file || !fs.existsSync(file)) return { ready: false, why: `영상 없음(${v.파일 || '파일 칸 없음'})` };
  const sha = sha256(file);
  for (const name of required) {
    const r = v.검수?.[name];
    if (!r || r.결과 !== '통과') return { ready: false, why: `${name} 검수 ${r?.결과 || '전'}`, sha };
    if (name === '뜻') {
      const text = resolveIn(dir, v.글);
      if (!text || !fs.existsSync(text)) return { ready: false, why: '뜻 검수할 글 파일 없음(판본 「글」)', sha };
      if (r.지문 !== sha256(text)) return { ready: false, why: '뜻 검수 뒤 글이 바뀜', sha };
    } else if (r.지문 !== sha) return { ready: false, why: `${name} 검수 뒤 영상이 바뀜`, sha };
  }
  return { ready: true, sha, file };
}

// 편 폴더 전부 — LAB 편의 판(있는 칸) · 돌림 원본.
function loadPieces(accounts, cfg) {
  const required = Array.isArray(cfg.판본검수) && cfg.판본검수.length ? cfg.판본검수 : ['뜻', '글자'];
  const pieces = [];
  for (const d of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const dir = path.join(ROOT, d.name);
    const prep = readJson(path.join(dir, '게시', '준비.json'));
    if (!prep || prep.브랜드 !== 'LAB') continue;
    const result = readJson(path.join(dir, '게시', '게시결과.json')) || {};
    // 한 편은 한 계정에 한 번만 나가니(돌림 ③) 게시결과는 계정으로 맞춘다 — 게시결과 「시각」은 실제로 나간 때라 판 시각과 다를 수 있다.
    // 한 계정에 줄이 여럿이면(작업실 길은 다시 걸 때마다 줄을 더한다 — 취소됨 · 취소됨 · 예약됨) 걸려 있는 줄, 없으면 마지막 줄(게시 장부 rowOf).
    const stateOf = (plate) => 장부.rowOf(result.판, plate.계정);
    const original = prep.돌림 && ['이야기', '퀴즈'].includes(prep.돌림.형식) ? prep.돌림 : null;
    const versions = {};
    if (original) for (const [k, v] of Object.entries(original.판본 || {})) versions[k] = versionState(dir, v, required);
    pieces.push({ name: d.name, dir, prep, result, stateOf, original, versions, dead: /^버림/.test(String(prep.상태 || '')) });
  }
  return pieces;
}

function originalsOf(pieces) {
  return pieces.filter((p) => p.original && !p.dead).map((p) => ({
    id: p.name, format: p.original.형식, stopped: Boolean(p.original.멈춤), spare: Boolean(p.original.예비),
    readyFrom: p.original.쓸날 || null, versions: p.versions,
  }));
}

// 표에 적힌, 다른 작업본까지 걸려 있는 판 — `${편}|${계정}` → 상태, `${계정}|${현지 날짜}|${칸}` → 편
function holdsOf() {
  const byPlate = new Map();
  const byCell = new Map();
  for (const h of 장부.registryHolds(ROOT)) { byPlate.set(`${h.piece}|${h.account}`, h.state); byCell.set(h.key, h.piece); }
  return { byPlate, byCell };
}

// 이미 있는 판 — 버린 편은 칸을 차지하지 않는다. 나가지 않는 판(보류 · 취소됨 · 지움)은 칸은 비우되, 돌림 원본이면 그 계정이 그 원본을 이미
// 받은 것으로 남긴다(gone — 게시결과는 계정으로 맞추니 같은 원본을 다시 주면 옛 줄이 새 판을 가린다). 걸린 판(예약됨 · 게시됨 · 거는 중 ·
// 작업실 승인 대기 — holds: 다른 작업본이 표에 잡은 것까지)은 --다시 · 멈춤에도 남는다. --다시면 아직 안 건 돌림 판을 뺀다.
function existingPlates(pieces, { replan = false, stopped = new Set(), holds = new Map() } = {}) {
  const out = [];
  for (const piece of pieces) {
    if (piece.dead) continue;
    const plated = new Set();
    for (const plate of piece.prep.판 || []) {
      plated.add(plate.계정);
      const row = piece.stateOf(plate);
      const elsewhere = holds.get(`${piece.name}|${plate.계정}`) || null;
      const base = { original: piece.original ? piece.name : null, account: plate.계정, time: plate.시각, generated: Boolean(plate.돌림), piece: piece.name, state: row?.상태 || elsewhere || null,
        file: piece.original ? plateSha(piece, plate) : null };
      if (!elsewhere && GONE.has(row?.상태)) { if (piece.original) out.push({ ...base, booked: false, gone: true }); continue; }
      const booked = 장부.held(row) || Boolean(elsewhere);
      if (plate.돌림 && !booked && (replan || stopped.has(piece.name))) continue;
      out.push({ ...base, booked });
    }
    if (!piece.original) continue;
    // 판은 빠졌는데 게시결과 줄만 남은 계정(--다시가 취소된 돌림 판을 뺀 뒤) — 그 원본을 이미 받았다. 걸려 있고 시각이 있으면 칸도 찼다.
    for (const account of new Set((piece.result.판 || []).map((r) => r && r.계정).filter(Boolean))) {
      if (plated.has(account)) continue;
      const row = 장부.rowOf(piece.result.판, account);
      const base = { original: piece.name, account, generated: false, piece: piece.name, state: row?.상태 || null };
      if (장부.held(row)) {
        const timed = Number.isFinite(Date.parse(row.시각 || ''));
        out.push({ ...base, time: timed ? row.시각 : null, booked: true, gone: !timed });
      } else if (GONE.has(row?.상태)) out.push({ ...base, time: null, booked: false, gone: true });
    }
  }
  return out;
}

// 판 파일의 지문(같은 언어 묶음의 같은 파일 확인 — 돌림 ⑥). 돌림 판은 돌림표가 적은 지문, 손으로 단 판은 파일을 읽는다(없으면 null).
function plateSha(piece, plate) {
  if (plate.지문) return plate.지문;
  const file = resolveIn(piece.dir, plate.파일);
  try { return file && fs.statSync(file).isFile() ? sha256(file) : null; } catch { return null; }
}

// 같은 언어 묶음표와 겹침 확인(돌림 ⑥) — 묶음, 같은 판본 키를 둘이 쓰는 묶음, 원본마다 나라별판이 같은 파일인 짝, 판 겹침(이미 있는 판 + 이번 셈).
function sameLanguageReport(run) {
  const bundles = 돌림.bundlesOf(run.rotation).map((b) => ({ platform: b.platform, group: b.group,
    members: b.accounts.map((k) => ({ account: k, version: run.rotation[k].versionKey, language: run.rotation[k].language, timeZone: run.rotation[k].timeZone, seed: run.rotation[k].seed })) }));
  const sharedKeys = [];
  const sameFiles = [];
  for (const b of bundles) {
    const byKey = new Map();
    for (const m of b.members) byKey.set(m.version, [...(byKey.get(m.version) || []), m.account]);
    for (const [version, accounts] of byKey) if (accounts.length > 1) sharedKeys.push({ platform: b.platform, group: b.group, version, accounts });
    for (const o of run.originals) {
      const seen = new Map(); // 지문 → 판본 키
      for (const key of byKey.keys()) {
        const sha = o.versions?.[key]?.sha;
        if (!sha) continue;
        if (seen.has(sha)) sameFiles.push({ original: o.id, platform: b.platform, group: b.group, versions: [seen.get(sha), key] });
        else seen.set(sha, key);
      }
    }
  }
  return { bundles, sharedKeys, sameFiles, overlaps: 돌림.overlaps(run.result.plates, run.rotation, run.cfg.셈 || {}) };
}
const overlapLine = (o) => `${o.original}: ${o.a} · ${o.b}(${o.platform} · ${o.group}${o.hours !== null ? ` · ${o.hours}시간` : ''}${o.sameFile ? ' · 같은 파일' : ''})`;

function firstPlateValue(prep, key) {
  for (const p of prep.판 || []) if (p[key] !== undefined) return p[key];
  return undefined;
}

// 칸 하나 → 판(그 원본 편 준비.json에 더할 꼴)
function plateFor(cell, piece, account, versionKey) {
  const v = piece.original.판본[versionKey];
  const manuscript = v.원고?.[account.platform] || null;
  const plate = { 계정: cell.account, 파일: v.파일, 시각: cell.time, 언어: account.language || undefined, 돌림: true };
  if (v.표지) plate.표지 = v.표지;
  if (manuscript) plate[/\.json$/i.test(manuscript) ? '원고' : '게시글'] = manuscript;
  const ai = firstPlateValue(piece.prep, 'AI표시');
  if (ai !== undefined) plate.AI표시 = ai;
  const sha = piece.versions[versionKey]?.sha;
  if (sha) plate.지문 = sha;
  return plate;
}

function todayKst(now) { return T.localDate(now, 'Asia/Seoul'); }

function runPlan(opts) {
  const { accounts, cfg } = loadLedger();
  const { rotation, notReady, closedStory } = rotationAccounts(accounts, { ignoreReady: opts.ignoreReady });
  const pieces = loadPieces(accounts, cfg);
  const originals = originalsOf(pieces);
  const stopped = new Set(originals.filter((o) => o.stopped).map((o) => o.id));
  const holds = holdsOf();
  const existing = existingPlates(pieces, { replan: opts.replan, stopped, holds: holds.byPlate });
  const result = 돌림.plan({ accounts: rotation, originals, existing, from: opts.from, days: opts.days, cfg: cfg.셈 || {}, useSpares: opts.useSpares });
  saveShaCache();
  return { accounts, rotation, notReady, closedStory, holds, pieces, originals, existing, result, cfg };
}

function writePlates(run, opts) {
  const byPiece = new Map();
  for (const cell of run.result.cells) {
    if (!cell.original || cell.taken) continue;
    if (!byPiece.has(cell.original)) byPiece.set(cell.original, []);
    byPiece.get(cell.original).push(cell);
  }
  const holds = holdsOf(); // 셈하는 동안 다른 작업본이 잡았을 수 있어 표를 다시 읽는다
  const written = [];
  const skipped = [];
  for (const piece of run.pieces) {
    const cells = byPiece.get(piece.name);
    const removeUnbooked = opts.replan || Boolean(piece.original?.멈춤);
    if (!cells && !removeUnbooked) continue;
    const file = path.join(piece.dir, '게시', '준비.json');
    const fresh = readJson(file); // 셈하는 동안 다른 칸이 바뀌었을 수 있어 다시 읽고 판만 바꾼다
    if (!fresh) continue;
    // 걸린 판(예약됨 · 게시됨 · 거는 중 · 작업실 승인 대기 — 다른 작업본이 표에 잡은 것까지)은 지우지 않는다 — 게시결과도 지금 것을 다시 읽는다
    const rows = readJson(path.join(piece.dir, '게시', '게시결과.json'))?.판 || [];
    const heldNow = (p) => 장부.held(장부.rowOf(rows, p.계정)) || holds.byPlate.has(`${piece.name}|${p.계정}`);
    const keep = (fresh.판 || []).filter((p) => !(p.돌림 && removeUnbooked && !heldNow(p)));
    const already = new Set(keep.map((p) => p.계정));
    const add = [];
    for (const c of cells || []) {
      const other = holds.byCell.get(`${c.account}|${c.day}|${c.slot}`);
      if (already.has(c.account)) { skipped.push({ piece: piece.name, account: c.account, why: '이 편에 그 계정 판이 이미 있다' }); continue; }
      if (other && other !== piece.name) { skipped.push({ piece: piece.name, account: c.account, why: `그 칸(${c.day} ${c.slot})을 ${other}가 잡고 있다` }); continue; }
      add.push(plateFor(c, piece, run.rotation[c.account], run.rotation[c.account].versionKey));
      already.add(c.account);
    }
    const removed = (fresh.판 || []).length - keep.length;
    if (!add.length && !removed) continue;
    fresh.판 = [...keep, ...add];
    writeJson(file, fresh);
    written.push({ piece: piece.name, added: add.length, removed });
  }
  return { written, skipped };
}

function ledgerRows(run, opts) {
  const rows = [];
  const lastDay = 돌림.addDays(opts.from, opts.days - 1);
  for (const piece of run.pieces) {
    for (const plate of piece.prep.판 || []) {
      const a = run.accounts[plate.계정];
      const ms = Date.parse(plate.시각 || '');
      if (!a || a.brand !== 'LAB' || !Number.isFinite(ms)) continue;
      const tz = T.tzOf(a);
      const day = T.localDate(ms, tz);
      if (day < opts.from || day > lastDay) continue;
      const r = piece.stateOf(plate) || {};
      const elsewhere = 장부.held(r) ? null : run.holds?.byPlate.get(`${piece.name}|${plate.계정}`) || null;
      const slot = T.slotFor(plate.시각, a);
      rows.push({ 계정: plate.계정, 플랫폼: a.platform, 현지날짜: day, 칸: slot.time || T.localTime(ms, tz), 형식: slot.format || null, 시각: plate.시각,
        원본: piece.name, 판본: plate.파일 || null, 지문: plate.지문 || r.지문 || null, 상태: elsewhere ? `${elsewhere}(다른 작업본)` : r.상태 || (piece.dead ? '버린 편' : '건 전'),
        게시물ID: r.게시물ID || r.작업 || null, 주소: r.주소 || null, 돌림: Boolean(plate.돌림) });
    }
  }
  rows.sort((x, y) => x.현지날짜.localeCompare(y.현지날짜) || x.계정.localeCompare(y.계정) || String(x.칸).localeCompare(String(y.칸)));
  // 같은 칸 두 번(나가지 않는 판 말고)
  const seen = new Map();
  const doubles = [];
  for (const r of rows) {
    if (GONE.has(r.상태) || r.상태 === '버린 편') continue;
    const k = `${r.계정}|${r.현지날짜}|${r.칸}`;
    if (seen.has(k) && seen.get(k) !== r.원본) doubles.push(`${k} — ${seen.get(k)} · ${r.원본}`);
    else seen.set(k, r.원본);
  }
  // 같은 언어 묶음 겹침(돌림 ⑥) — 이 기간의 나가는 판 가운데 같은 원본이 24시간 안에, 또는 같은 파일로 같은 묶음 두 계정에 걸린 짝
  const live = rows.filter((r) => !GONE.has(r.상태) && r.상태 !== '버린 편');
  const sameLanguage = 돌림.overlaps(live.map((r) => ({ original: r.원본, account: r.계정, ms: Date.parse(r.시각), file: r.지문 })), run.rotation, run.cfg.셈 || {});
  return { rows, doubles, sameLanguage };
}

function stopPiece(name, why, now) {
  const file = path.join(ROOT, name, '게시', '준비.json');
  const prep = readJson(file);
  if (!prep?.돌림) { console.error(`${name}: 돌림 원본이 아니다(준비.json 「돌림」 없음)`); process.exit(2); }
  const rows = readJson(path.join(ROOT, name, '게시', '게시결과.json'))?.판 || [];
  const holds = holdsOf().byPlate;
  // 걸린 판(예약됨 · 게시됨 · 거는 중 · 작업실 승인 대기 — 다른 작업본이 표에 잡은 것까지)은 남긴다. 지우면 플랫폼에 걸린 예약이 장부에서 사라진다.
  const heldState = (p) => { const row = 장부.rowOf(rows, p.계정); return 장부.held(row) ? row.상태 : holds.get(`${name}|${p.계정}`) || null; };
  const plates = (prep.판 || []).filter((p) => p.돌림);
  const claiming = plates.filter((p) => heldState(p) === 장부.CLAIM);
  const booked = plates.filter((p) => heldState(p) && heldState(p) !== 장부.CLAIM && Date.parse(p.시각) > now);
  prep.돌림.멈춤 = { 날: todayKst(now), 까닭: why };
  const before = (prep.판 || []).length;
  prep.판 = (prep.판 || []).filter((p) => !(p.돌림 && !heldState(p)));
  writeJson(file, prep);
  return { removed: before - prep.판.length, booked, claiming };
}

// 비상 정지 점검(설계 3) — 14시 게시 회차가 걸기 전에 돌린다. 씨앗이 지난 사흘 안에 올린 원본마다 씨앗 판의 24시간 「평소 대비 배수」
// (게시/성과.json 자동판정 — tools/게시성과.js가 3시간마다 쓴다)를 본다. 실제로 나간 씨앗 판(예약됨 · 게시됨이고 시각이 지난 판)만 세고,
// 숫자가 있는 씨앗의 과반이 0.3배 밑이면 「급락」(→ --멈춤), 숫자가 아직 올 때가 아니면(나간 지 40시간 안) 「판정 전」, 숫자를 볼 씨앗이
// 하나도 없으면(숫자를 못 읽는 플랫폼 · 씨앗 판이 안 나감) 「판정 불가」 — 눈으로 본다. 줄마다 「판정할 수 있는 씨앗 n/N」을 적는다.
// 「고칠 실수」(댓글 · 시험관이 짚은 오류)와 「대상국 큰 사건」(재난 · 애도일)은 회차가 따로 본다.
function checkStops(run, now, { days = 3, low = 0.3, waitHours = 40 } = {}) {
  const out = [];
  for (const piece of run.pieces.filter((p) => p.original && !p.original.멈춤 && !p.dead)) {
    const seedPlates = (piece.prep.판 || []).filter((pl) => run.accounts[pl.계정]?.rotationSeed && Number.isFinite(Date.parse(pl.시각 || '')));
    if (!seedPlates.length) continue;
    const stateOf = (pl) => piece.stateOf(pl)?.상태 || null;
    const isOut = (pl) => DONE.has(stateOf(pl)) && Date.parse(pl.시각) <= now;
    const outPlates = seedPlates.filter(isOut);
    const first = Math.min(...(outPlates.length ? outPlates : seedPlates).map((pl) => Date.parse(pl.시각)));
    if (first > now || now - first > days * 86400000) continue;
    const pending = (piece.prep.판 || []).filter((pl) => pl.돌림 && Date.parse(pl.시각 || '') > now).length;
    const perf = readJson(path.join(piece.dir, '게시', '성과.json'))?.자동판정?.판 || [];
    const rows = seedPlates.map((pl) => {
      const out1 = isOut(pl);
      const ageH = Math.round((now - Date.parse(pl.시각)) / 360000) / 10;
      const m = out1 ? perf.find((x) => x.계정 === pl.계정)?.시점?.['24시간']?.평소대비?.배수 : null;
      const multiple = Number.isFinite(m) ? m : null;
      return { account: pl.계정, state: stateOf(pl) || '건 전', out: out1, ageH, multiple, low: multiple !== null && multiple < low, late: out1 && multiple === null && ageH >= waitHours };
    });
    const known = rows.filter((r) => r.multiple !== null);
    const lows = known.filter((r) => r.low);
    const waiting = rows.filter((r) => r.out && r.multiple === null && !r.late);
    const verdict = known.length ? (lows.length * 2 > known.length ? '급락' : '괜찮음') : waiting.length ? '판정 전' : '판정 불가';
    out.push({ piece: piece.name, format: piece.original.형식, seededAt: T.isoAt(first, 'Asia/Seoul'), pending, verdict, known: known.length, seeds: rows.length, rows });
  }
  return out;
}

function printPlan(run, opts) {
  const { result, notReady, rotation } = run;
  const filled = result.cells.filter((c) => c.original && !c.taken);
  const empty = result.cells.filter((c) => !c.original && !c.taken);
  console.log(`LAB 돌림표 · ${opts.from}부터 ${opts.days}일 · 돌림 계정 ${Object.keys(rotation).length} · 원본 ${run.originals.length}(이야기 ${run.originals.filter((o) => o.format === '이야기').length} · 퀴즈 ${run.originals.filter((o) => o.format === '퀴즈').length})`);
  console.log(`새로 채울 칸 ${filled.length} · 빈 칸 ${empty.length} · 이미 찬 칸 ${result.cells.filter((c) => c.taken).length}`);
  for (const day of result.range) {
    const today = result.cells.filter((c) => c.day === day && !c.taken);
    if (!today.length) continue;
    console.log(`\n${day}`);
    for (const format of ['이야기', '퀴즈']) {
      const list = today.filter((c) => c.format === format).sort((x, y) => rotation[x.account].platform.localeCompare(rotation[y.account].platform) || x.account.localeCompare(y.account));
      if (!list.length) continue;
      console.log(`  ${format}: ` + list.map((c) => `${c.account} ${c.original ? `← ${c.original}` : `· ${c.why}`}`).join(' | '));
    }
  }
  const why = new Map();
  for (const c of empty) why.set(c.why, (why.get(c.why) || 0) + 1);
  if (why.size) console.log(`\n빈 칸 까닭: ${[...why].map(([w, n]) => `${w} ${n}`).join(' · ')}`);
  const real = opts.ignoreReady ? '(--준비무시 — 셈만 해 본 것) 실제로는 ' : '';
  if (notReady.length) console.log(`${real}칸을 못 받는 계정 ${notReady.length}: ${notReady.map((x) => `${x.account}(${x.why.join(' · ')})`).join(' · ')}`);
  if (run.closedStory.length) console.log(`${real}앞 칸이 닫힌 계정 ${run.closedStory.length}(dailyTimesFrom 「미정」 — 마지막 칸만 열림): ${run.closedStory.map((x) => `${x.account}(${x.closed.join(' · ')})`).join(' · ')}`);
  const lang = sameLanguageReport(run);
  console.log(`같은 언어 묶음 ${lang.bundles.length}(${lang.bundles.map((b) => `${b.platform} ${b.group} ${b.members.length}곳`).join(' · ') || '없음'}) · 판 겹침 ${lang.overlaps.length} · 같은 파일인 나라별판 ${lang.sameFiles.length}${lang.overlaps.length || lang.sameFiles.length ? ' — node tools/돌림표.js --묶음' : ''}`);
  const notVersion = run.originals.flatMap((o) => Object.entries(o.versions).filter(([, v]) => !v.ready).map(([k, v]) => `${o.id}/${k} ${v.why}`));
  if (notVersion.length) console.log(`돌림에 못 드는 판본 ${notVersion.length}: ${notVersion.slice(0, 30).join(' · ')}${notVersion.length > 30 ? ' …' : ''}`);
}

function main() {
  const now = argValue('--지금') ? Date.parse(argValue('--지금')) : Date.now();
  if (!Number.isFinite(now)) { console.error('--지금은 ISO 시각으로 준다'); process.exit(2); }
  const from = argValue('--부터') || 돌림.addDays(todayKst(now), 1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) { console.error('--부터는 YYYY-MM-DD'); process.exit(2); }
  const days = Math.max(1, Math.min(60, Number(argValue('--일수') || 5) || 5));
  const opts = { from, days, ignoreReady: has('--준비무시'), useSpares: has('--예비씀'), replan: has('--다시') };
  if (opts.ignoreReady && has('--쓰기')) {
    console.error('--준비무시는 셈만 해 보는 길이다 — --쓰기와 함께 쓰지 않는다(준비 안 된 계정 · 시작 날 「미정」 칸에 판이 써진다). 원장 값을 고친 뒤 --쓰기.');
    process.exit(2);
  }
  if (has('--멈춤')) {
    const name = argValue('--멈춤');
    const why = argValue('--까닭');
    if (!name || !why) { console.error('--멈춤 <편 폴더 이름> --까닭 "<까닭>"'); process.exit(2); }
    const r = stopPiece(name, why, now);
    console.log(`${name} 멈춤 — 안 건 돌림 판 ${r.removed}개를 뺐다.`);
    if (r.booked.length) console.log(`이미 예약된 판 ${r.booked.length}개는 플랫폼 예약을 다른 매일 판 편으로 바꿔 건다(공개 전이면 상시 승인 안): ${r.booked.map((p) => `${p.계정} ${p.시각}`).join(' · ')}`);
    if (r.claiming.length) console.log(`거는 중인 판 ${r.claiming.length}개는 그 플랫폼 예약 목록부터 읽는다(node tools/게시장부.js 걸던것) — 걸렸으면 「끝」 뒤 위와 같이 바꿔 걸고, 안 걸렸으면 「풀기」 뒤 --멈춤을 다시 돌려 뺀다: ${r.claiming.map((p) => `${p.계정} ${p.시각}`).join(' · ')}`);
    console.log('빈 칸은 node tools/돌림표.js --예비씀 --쓰기 로 다시 채운다(예비편 · 다른 원본).');
    return;
  }
  const run = runPlan(opts);
  if (has('--점검')) {
    const list = checkStops(run, now);
    if (has('--json')) { console.log(JSON.stringify(list, null, 2)); } else {
      console.log(`비상 정지 점검(설계 3) · ${T.isoAt(now, 'Asia/Seoul').slice(0, 16)} · 씨앗이 사흘 안에 올린 원본 ${list.length}`);
      const seedCell = (r) => `${r.account} ${!r.out ? `안 나감(${r.state})` : r.multiple !== null ? `${r.multiple}배${r.low ? '↓' : ''}` : r.late ? `24시간 숫자 없음(${r.ageH}시간)` : `24시간 숫자 전(${r.ageH}시간)`}`;
      for (const x of list) console.log(`  ${x.verdict === '급락' || x.verdict === '판정 불가' ? '!' : '·'} ${x.verdict} · ${x.piece}(${x.format}) · 씨앗 ${x.seededAt.slice(5, 16)} · 판정할 수 있는 씨앗 ${x.known}/${x.seeds} · 남은 돌림 판 ${x.pending} · `
        + x.rows.map(seedCell).join(', '));
      if (list.some((x) => x.verdict === '급락')) console.log('  급락 원본은 node tools/돌림표.js --멈춤 <편> --까닭 "씨앗 24시간 평소의 0.3배 밑" 뒤 --예비씀 --쓰기(판정할 수 있는 씨앗이 하나뿐이면 그 씨앗 글을 먼저 눈으로 본다)');
      if (list.some((x) => x.verdict === '판정 불가')) console.log('  판정 불가 원본은 씨앗 판에 24시간 숫자가 없다(숫자를 못 읽는 플랫폼이거나 씨앗 판이 안 나갔다) — 씨앗 글의 조회 · 댓글을 눈으로 보고 나쁘면 --멈춤, 괜찮으면 그대로 간다. 씨앗 판이 안 나갔으면 씨앗부터 다시 건다');
      console.log('  사람 눈으로 더 볼 것: 고칠 실수(댓글 · 시험관 지적) · 대상국 큰 사건(재난 · 애도일 — 그날 칸의 나라)');
    }
    if (list.some((x) => x.verdict === '급락')) process.exitCode = 1;
    return;
  }
  if (has('--묶음')) {
    const lang = sameLanguageReport(run);
    const bad = lang.overlaps.length + lang.sameFiles.length + lang.sharedKeys.length;
    if (has('--json')) console.log(JSON.stringify({ from, days, ...lang }, null, 2));
    else {
      console.log(`같은 언어 묶음(같은 플랫폼에서 같은 말로 올리는 계정) ${lang.bundles.length} — 같은 원본은 24시간 안에 둘이 받지 않고, 같은 파일은 날이 달라도 둘이 받지 않는다`);
      for (const b of lang.bundles) console.log(`  ${b.platform} · ${b.group}(${b.members.length}): ${b.members.map((m) => `${m.account}[${m.version || '판본 키 없음'}${m.language !== b.group ? ` · 판 ${m.language}` : ''}${m.seed ? ' · 씨앗' : ''}]`).join(' · ')}`);
      console.log(`같은 판본 키를 둘이 쓰는 묶음 ${lang.sharedKeys.length}${lang.sharedKeys.length ? `: ${lang.sharedKeys.map((s) => `${s.platform} ${s.group} ${s.version}(${s.accounts.join(' · ')})`).join(' · ')} — 계정마다 나라별판 키를 따로 둔다` : ''}`);
      console.log(`나라별판이 같은 파일인 원본 ${lang.sameFiles.length}${lang.sameFiles.length ? `: ${lang.sameFiles.map((s) => `${s.original} ${s.versions.join(' = ')}`).join(' · ')} — 첫 카드 · 그 나라 예문 · 끝 질문 · 표지를 나라마다 다르게 다시 만든다(배속 · 색만 바꾸지 않는다)` : ''}`);
      console.log(`판 겹침(이미 있는 판 + ${from}부터 ${days}일 셈 · 24시간 안이거나 같은 파일) ${lang.overlaps.length}${lang.overlaps.length ? `: ${lang.overlaps.map(overlapLine).join(' · ')}` : ''}`);
    }
    if (bad) process.exitCode = 1;
    return;
  }
  if (has('--장부')) {
    const { rows, doubles, sameLanguage } = ledgerRows(run, opts);
    if (has('--json')) { console.log(JSON.stringify({ from, days, rows, doubles, sameLanguage }, null, 2)); if (doubles.length || sameLanguage.length) process.exitCode = 1; return; }
    console.log(`LAB 게시 장부 · ${from}부터 ${days}일 · 판 ${rows.length}`);
    console.log('| 현지 날짜 | 칸 | 계정 | 원본 | 상태 | 게시물 ID | 지문 |');
    console.log('|---|---|---|---|---|---|---|');
    for (const r of rows) console.log(`| ${r.현지날짜} | ${r.칸}${r.형식 ? ` ${r.형식}` : ''} | ${r.계정} | ${r.원본} | ${r.상태} | ${r.게시물ID || '—'} | ${r.지문 ? r.지문.slice(0, 10) : '—'} |`);
    if (doubles.length) { console.log(`\n! 같은 칸 두 번: ${doubles.join(' · ')}`); process.exitCode = 1; }
    if (sameLanguage.length) { console.log(`\n! 같은 언어 묶음 겹침: ${sameLanguage.map(overlapLine).join(' · ')}`); process.exitCode = 1; }
    return;
  }
  if (has('--json')) {
    console.log(JSON.stringify({ from, days, cells: run.result.cells.map(({ ms, ...c }) => c), notReady: run.notReady, closedStory: run.closedStory, sameLanguage: sameLanguageReport(run),
      versions: Object.fromEntries(run.originals.map((o) => [o.id, Object.fromEntries(Object.entries(o.versions).map(([k, v]) => [k, { ready: v.ready, why: v.why || null }]))])) }, null, 2));
  } else printPlan(run, opts);
  if (has('--쓰기')) {
    const { written, skipped } = writePlates(run, opts);
    console.log(written.length ? `\n준비.json에 썼다: ${written.map((w) => `${w.piece} +${w.added}${w.removed ? ` −${w.removed}` : ''}`).join(' · ')}` : '\n더할 판 없음');
    if (skipped.length) console.log(`건너뛴 판 ${skipped.length}: ${skipped.map((s) => `${s.piece} ${s.account}(${s.why})`).join(' · ')}`);
  }
}

module.exports = { rotationAccounts, versionState, loadPieces, existingPlates, ledgerRows, plateFor, checkStops, holdsOf, sameLanguageReport };
if (require.main === module) main();
