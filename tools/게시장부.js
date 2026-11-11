#!/usr/bin/env node
'use strict';
/* 게시 장부 잠금(2026-11-10 LAB 하루 두 편 · 39계정 — 설계 4 「게시 장부로 같은 칸이 두 번 걸리지 않게 막는다. 끊긴 뒤 다시 할 때는
 * 예약 목록부터 읽는다」). 판 하나를 걸기 전에 「거는 중」을 적고, 건 뒤 「예약됨」 · 「게시됨」(게시물 ID · 주소 · 확인)으로 끝낸다.
 *
 *   node tools/게시장부.js 걸기 <편 폴더> <계정> [--방법 <ego|크롬|작업실…>]
 *       그 편 게시/준비.json에 그 계정 판이 있고, 판 파일 SHA-256(지문)이 판에 적힌 「지문」(돌림 판)과 같고, 그 계정의 같은 현지 날짜 ·
 *       칸에 다른 편이 걸려 있지 않고, 이 판이 이미 걸린 판이 아니면 게시결과.json에 {상태:「거는 중」} 을 적는다. 아니면 종료 1 — 까닭을 보인다.
 *       「걸려 있다」 = 「예약됨」 · 「게시됨」 · 「거는 중」, 그리고 작업실 길이 서버에 등록한 줄(「승인 대기」 · 「확인 필요」 + 작업 ID).
 *       남아 있는 「거는 중」은 몇 시간이 지났든 덮지 않는다 — 끊긴 회차가 플랫폼에 이미 걸었을 수 있다. 그 플랫폼 예약 목록을 읽고
 *       걸려 있으면 「끝 --상태 예약됨 --확인 …」, 없으면 「풀기 --까닭 …」 뒤에 다시 건다.
 *       원장 postRouteVerified가 「첫판」인 계정(첫 판 시험)은 판 하나만 잡을 수 있다 — 그 판을 플랫폼 예약 목록에서 확인하고 true로 바꾼 뒤 다음 판.
 *   node tools/게시장부.js 끝 <편 폴더> <계정> --상태 예약됨|게시됨|실패 [--게시물ID <id>] [--주소 <url>] [--확인 "<예약 목록에서 읽은 것>"] [--승인 "<승인 근거>"]
 *       「예약됨」 · 「게시됨」은 앞선 「걸기」(또는 예약됨 → 게시됨)와 이번에 읽은 증거(게시물 ID · 주소 · 확인 가운데 하나)가 있어야 한다.
 *       「게시됨」은 다른 상태로 바꾸지 않는다. 「예약됨」을 「실패」로 내리려면 --확인이 있어야 한다. 걸지 않은 판은 실패로도 적지 않는다.
 *   node tools/게시장부.js 풀기 <편 폴더> <계정> --까닭 "<플랫폼 예약 목록에 없음을 확인함 등>"   「거는 중」을 거둔다
 *   node tools/게시장부.js 걸던것 [--폴더 <docs/마케팅>]      모든 편의 「거는 중」 — 끊긴 회차가 다시 할 때 이 판들은 플랫폼 예약 목록부터 읽는다
 *
 * 작업본을 넘는 칸 장부(11-10 Fable 검수): 14시 회차는 제 워크트리에서 걸기 때문에 게시결과.json만으로는 다른 사본의 「거는 중」이 올라오기
 * 전까지 안 보인다. 그래서 걸기 · 끝 · 풀기는 공용 작업본의 .tmp/게시장부/칸.json(git 밖)에 「계정|현지 날짜|칸 → 편 · 상태 · 작업본」을
 * 같이 적고, 걸 때 그 표도 본다. 참은 언제나 그 작업본의 게시결과.json이다 — 표의 줄이 가리키는 작업본에서 이미 풀렸으면 그 줄은 버리고,
 * 그 작업본을 읽을 수 없으면(지워진 워크트리) 표를 믿고 막는다(예약 목록을 읽은 뒤 「풀기 --까닭」으로 거둔다). 저장소 밖 폴더(--폴더,
 * 시험)는 그 폴더의 .게시장부/칸.json을 쓴다. 세 명령은 표 옆 잠금 파일 하나로 차례를 선다(같은 판을 여럿이 한꺼번에 걸어도 하나만).
 * 작업실 길(tools/작업실예약.js)은 이 표에 적지 않는다 — 등록하자마자 올려서 git으로 보인다.
 * 게시결과.json은 그 계정 줄만 바꾸고, 읽은 뒤 그새 파일이 바뀌었으면 쓰지 않고 멈춘다(tools/작업실예약.js와 같은 셈). 장부 표는
 * node tools/돌림표.js --장부. 한 계정에 줄이 여럿이면(작업실 길은 다시 걸 때마다 줄을 더한다 — 취소됨 · 취소됨 · 예약됨) 뒤에서부터 읽어
 * 걸려 있는 줄이나 거둔 줄(보류 · 지움)을 먼저 만나면 그 줄, 없으면 마지막 줄이 그 계정의 줄이다(rowOf). 이 파일 안의 읽기(같은 칸 ·
 * 첫 판 · 표의 참)도 모두 rowOf다 — 걸린 줄 뒤에 보류를 덧붙인 판을 예약큐는 빈 칸으로, 걸기는 찬 칸으로 보던 것(11-11 Fable 5.2 다시 검수 P2-1).
 * 쓰기(걸기 · 끝 · 풀기)가 고칠 줄은 그 계정의 「거는 중」 줄이 있으면 그 줄(뒤에 보류가 붙어 있어도 끊긴 걸기부터 닫는다), 없으면 rowOf다.
 * 걸기는 거둔 줄 · 작업 ID가 적힌 죽은 줄을 덮지 않고 새 줄을 더하고, 걸린 줄로 적은 줄은 늘 그 계정의 줄(rowOf)이 되게 맨 뒤에 둔다.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const T = require('./lib/계정시간.js');
const { 공용작업본, 미디어경로 } = require('./lib/공용작업본.js');

const REPO = path.resolve(__dirname, '..');
const DONE = new Set(['예약됨', '게시됨']);
const CLAIM = '거는 중';
const WAITING = new Set(['승인 대기', '확인 필요']); // 작업실 길 — 작업 ID가 있으면 서버에 등록된 줄
const CLAIM_LIVE_MS = 2 * 3600000;
const LOCK_STALE_MS = 30000;
const LOCK_WAIT_MS = 20000;
const KEEP_DAYS = 14;
const argValue = (args, name) => { const i = args.indexOf(name); return i > -1 ? args[i + 1] : null; };

// 그 칸을 잡고 있는 줄인가
const held = (row) => Boolean(row) && (DONE.has(row.상태) || row.상태 === CLAIM || (WAITING.has(row.상태) && Boolean(row.작업)));
// 「첫 판 시험」 — 원장 postRouteVerified가 이 값인 계정은 판 하나만 걸 수 있다(그 판을 플랫폼 예약 목록에서 확인하고 true로 바꾸면 풀린다)
const TRIAL = '첫판';
// 거둔 줄 — 걸린 줄 뒤에 오면 그 예약을 거둔 것이다(11-09 유호님 「11월 14일까지 전부 삭제하고 다시 제작」 때 예약됨 뒤에 보류를 덧붙였다)
const WITHDRAWN = new Set(['보류', '지움']);
// 한 계정에 줄이 여럿일 수 있다(작업실 길은 다시 걸 때마다 줄을 더한다 — 취소됨 · 취소됨 · 예약됨). 뒤에서부터 읽어 걸려 있는 줄이나
// 거둔 줄(보류 · 지움)을 먼저 만나면 그 줄, 없으면 마지막 줄. 다른 작업의 「취소됨」은 앞의 걸린 줄을 덮지 않지만, 바로 앞 걸린 줄과 같은
// 작업의 「취소됨」은 그 예약이 취소된 것이라 덮는다(11-11 Fable 5.2 검수 P1-2 — 예약됨 → 보류 20줄이 「예약됨」으로 읽혀 그 칸이 채움으로 보였다).
// 안 닫힌 「거는 중」 줄이 있으면 그 줄이 먼저다 — 끊긴 걸기 뒤에 보류를 덧붙인 [거는 중, 보류]를 뒤의 보류로 읽으면, 쓰는 쪽(updateResult)은 거는 중을 닫는데
// 읽는 쪽(같은 칸 · 표의 참 · 첫 판 한도)은 빈 칸으로 보아 같은 칸에 다른 편이 걸린다(11-11 Fable 5.2 다시 검수 P1-팔7).
function rowOf(rows, account) {
  const mine = (rows || []).filter((p) => p && p.계정 === account);
  const open = mine.filter((p) => p.상태 === CLAIM).pop();
  if (open) return open;
  for (let i = mine.length - 1; i >= 0; i -= 1) {
    const row = mine[i];
    if (held(row) || WITHDRAWN.has(row.상태)) return row;
    if (row.상태 === '취소됨' && row.작업) {
      const before = mine.slice(0, i).reverse().find(held);
      if (before && before.작업 === row.작업) return row;
    }
  }
  return mine[mine.length - 1] || null;
}
const norm = (p) => { const r = path.resolve(String(p || '')); return process.platform === 'win32' ? r.toLowerCase() : r; };
const samePath = (a, b) => Boolean(a) && Boolean(b) && norm(a) === norm(b);

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch { return null; }
}
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function pieceDir(given, root) {
  const dir = path.isAbsolute(given) || fs.existsSync(given) ? path.resolve(given) : path.join(root, given);
  if (!fs.existsSync(path.join(dir, '게시', '준비.json'))) throw new Error(`편 폴더가 아니다(게시/준비.json 없음): ${given}`);
  return dir;
}

// 판 파일 경로 — 판 「파일」이 편 폴더 기준(게시/…)이거나 저장소 기준(docs/…)일 수 있다. 14시 회차의 워크트리에는 git 밖 영상이 없으니
// 이 작업본에 없으면 공용 작업본의 같은 경로에서 찾는다(미디어경로).
function plateFile(dir, plate, repo) {
  const p = plate.파일 || '';
  for (const base of [dir, repo]) { const f = p ? 미디어경로(path.isAbsolute(p) ? p : path.join(base, p)) : null; if (f && fs.existsSync(f)) return f; }
  return null;
}

// 게시결과.json 그 계정 줄만 바꾸기 — 읽은 바이트가 쓰기 직전에도 같아야 쓴다.
function updateResult(dir, account, change) {
  const file = path.join(dir, '게시', '게시결과.json');
  const raw = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  const result = raw ? JSON.parse(raw.replace(/^﻿/, '')) : { 판: [] };
  if (!result || typeof result !== 'object' || Array.isArray(result) || (result.판 != null && !Array.isArray(result.판))) throw new Error('게시결과.json 모양이 달라 건드리지 않았다');
  result.판 = result.판 || [];
  // 고칠 줄 — 그 계정의 「거는 중」 줄이 있으면 그 줄(뒤에 보류를 덧붙였어도 끊긴 걸기는 끝 · 풀기로 닫을 수 있어야 한다 — 11-11 P3-1), 없으면 rowOf
  const claimed = result.판.filter((p) => p && p.계정 === account && p.상태 === CLAIM).pop();
  const i = result.판.indexOf(claimed || rowOf(result.판, account));
  let add = false;
  const next = change(i > -1 ? { ...result.판[i] } : null, () => { add = true; });
  if (next === undefined) return null;
  if (next === null) { if (i > -1) result.판.splice(i, 1); } else if (i > -1 && !add) {
    result.판[i] = next;
    // 걸린 줄로 적었는데 뒤에 거둔 줄이 남아 그 계정의 줄(rowOf)이 못 되면 맨 뒤로 옮긴다 — [거는 중, 보류]를 「끝 예약됨」으로 닫았는데
    // 장부가 보류로 읽으면 플랫폼에는 걸려 있고 칸은 비어 보여 한 번 더 걸린다
    if (held(next) && rowOf(result.판, account) !== next) { result.판.splice(i, 1); result.판.push(next); }
  } else result.판.push(next);
  if ((fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null) !== raw) throw new Error('게시결과가 그새 바뀌어 쓰기를 멈췄다 — 다시 돌린다');
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(result, null, 2) + '\n');
  fs.renameSync(tmp, file);
  return next;
}

// ── 작업본을 넘는 칸 장부 ─────────────────────────────────────────────────────────────────────────────────
// 그 폴더가 든 git 작업본의 뿌리(없으면 null)
function topOf(dir) {
  for (let d = path.resolve(dir); ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, '.git'))) return d;
    if (path.dirname(d) === d) return null;
  }
}

// 칸 장부 파일과, 워크트리일 때 공용 작업본 쪽의 같은 폴더(참을 한 번 더 읽을 자리)
function placeOf(root, given = null) {
  const top = topOf(root);
  const main = top ? 공용작업본(top) : null;
  return {
    file: given ? path.resolve(given) : main ? path.join(main, '.tmp', '게시장부', '칸.json') : path.join(root, '.게시장부', '칸.json'),
    shared: main && !samePath(main, top) ? path.join(main, path.relative(top, path.resolve(root))) : null,
  };
}

function readRegistry(file) {
  const j = readJson(file);
  const ok = j && typeof j === 'object' && !Array.isArray(j) && j.칸 && typeof j.칸 === 'object' && !Array.isArray(j.칸);
  return { 칸: ok ? j.칸 : {}, 풀림: ok && Array.isArray(j.풀림) ? j.풀림 : [] };
}

function writeRegistry(file, reg, now) {
  const floor = new Date(now - KEEP_DAYS * 86400000).toISOString().slice(0, 10);
  for (const k of Object.keys(reg.칸)) if ((k.split('|')[1] || '') < floor) delete reg.칸[k];
  reg.풀림 = reg.풀림.slice(-50);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(reg, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

// 걸기 · 끝 · 풀기는 칸 장부 옆 잠금 파일 하나로 차례를 선다(읽기 → 판단 → 쓰기 사이에 다른 회차가 끼지 못하게).
function withLock(regFile, fn) {
  fs.mkdirSync(path.dirname(regFile), { recursive: true });
  const lock = `${regFile}.lock`;
  const until = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try { fs.closeSync(fs.openSync(lock, 'wx')); break; } catch (e) {
      if (e.code !== 'EEXIST' && e.code !== 'EPERM' && e.code !== 'EBUSY') throw e;
      let made = 0;
      try { made = fs.statSync(lock).mtimeMs; } catch { continue; }
      if (Date.now() - made > LOCK_STALE_MS) { // 쓰다 죽은 회차의 잠금 — 그새 다른 회차가 새로 잡았으면(시각이 다르면) 두고 다시 돈다
        try { if (fs.statSync(lock).mtimeMs === made) fs.unlinkSync(lock); } catch {}
        continue;
      }
      if (Date.now() > until) throw new Error('게시 장부를 다른 회차가 쓰는 중이다 — 잠시 뒤 다시 돌린다');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50 + Math.floor(Math.random() * 100));
    }
  }
  try { return fn(); } finally { try { fs.unlinkSync(lock); } catch {} }
}

// 계정|현지 날짜|칸
function cellKey(account, time, accounts) {
  const a = accounts?.[account];
  const ms = Date.parse(time || '');
  if (!a || !Number.isFinite(ms)) return null;
  return `${account}|${T.localDate(ms, T.tzOf(a))}|${T.slotFor(time, a).time}`;
}

// 줄의 시각 — 기록시각 · 거는중 가운데 늦은 것(없으면 -Infinity). 걸기 · 끝은 표의 줄 「때」와 게시결과 줄에 같은 시각을 적는다 — 둘이 같으면 같은 예약이다.
const stampOf = (row) => Math.max(Date.parse(row?.기록시각 || '') || -Infinity, Date.parse(row?.거는중 || '') || -Infinity);

// 표의 줄이 가리키는 참. held: 아직 걸려 있다 · gone: 그 작업본에서 풀렸다(줄을 버려도 된다) · lost: 그 작업본을 읽을 수 없다(표를 믿는다)
// 건 작업본 · 공용 작업본 · 이 작업본 가운데 하나라도 걸려 있으면 걸린 것이다. 「나중에 적힌 줄이 이긴다」로 읽지 않는다 — 낡은 사본이 옛 예약을 늦게 닫을 때
// 다른 사본의 새 예약이 풀려 같은 칸이 두 번 걸린다(11-11 Fable 5.2 다시 검수 8-4: 후보를 경합 20꼴로 재어 열림 9). 풀린 것으로 읽는 것은 한 가지뿐이다:
// 어느 작업본이 표 줄의 바로 그 예약(걸린 줄의 기록시각 = 표 줄의 때)을 들고 있고, 그 줄 뒤에 거둔 줄(보류 · 지움)을 붙였을 때.
function truthOf(entry, account, here, shared, read = readJson) {
  const seen = [];
  let holder = null;
  for (const r of [entry.자리, shared, here]) {
    if (!r || seen.some((s) => samePath(s, r))) continue;
    seen.push(r);
    const rows = (read(path.join(r, entry.편, '게시', '게시결과.json'))?.판 || []).filter((p) => p && p.계정 === account);
    const row = rowOf(rows, account);
    const same = rows.findIndex((p) => held(p) && p.기록시각 && p.기록시각 === entry.때);
    if (row && WITHDRAWN.has(row.상태) && same > -1 && rows.indexOf(row) > same) return { kind: 'gone' };
    if (held(row) && !holder) holder = { kind: 'held', state: row.상태, at: r };
  }
  if (holder) return holder;
  return { kind: entry.자리 && fs.existsSync(path.join(entry.자리, entry.편, '게시', '준비.json')) ? 'gone' : 'lost' };
}

// 이 판을 막는 표의 줄 — 같은 칸의 다른 편(어느 작업본이든), 또는 이 편 · 이 계정을 다른 작업본이 잡은 줄
function blocker(reg, key, name, account, root, shared) {
  for (const [k, e] of Object.entries(reg.칸)) {
    if (!k.startsWith(`${account}|`) || !e || typeof e !== 'object' || !e.편) continue;
    if (e.편 === name && samePath(e.자리, root)) continue; // 이 작업본의 이 판 — 게시결과 줄이 판단한다
    if (k !== key && e.편 !== name) continue;
    const truth = truthOf(e, account, root, shared);
    if (truth.kind === 'gone') { delete reg.칸[k]; continue; }
    return { key: k, entry: e, truth };
  }
  return null;
}

// 표에 적힌, 아직 걸려 있는 판(읽기만 — 돌림표가 --다시 · --멈춤 때 다른 작업본이 잡은 판을 지우지 않게). 풀린 줄(gone)은 뺀다.
function registryHolds(root, { registry = null } = {}) {
  const place = placeOf(root, registry);
  const memo = new Map();
  const read = (file) => { if (!memo.has(file)) memo.set(file, readJson(file)); return memo.get(file); };
  const out = [];
  for (const [k, e] of Object.entries(readRegistry(place.file).칸)) {
    if (!e || typeof e !== 'object' || !e.편) continue;
    const [account, day, slot] = k.split('|');
    const truth = truthOf(e, account, root, place.shared, read);
    if (truth.kind === 'gone') continue;
    out.push({ key: k, account, day, slot, piece: e.편, state: truth.kind === 'held' ? truth.state : e.상태, where: truth.kind === 'held' ? truth.at : e.자리, lost: truth.kind === 'lost' });
  }
  return out;
}

// 첫 판 확인 전 계정(postRouteVerified 「첫판」)이 이미 잡고 있는 다른 편 — 이 작업본의 게시결과, 그리고 표(다른 작업본)
function firstPlateHeld(root, dir, name, account, reg, shared) {
  for (const d of fs.readdirSync(root, { withFileTypes: true })) {
    if (!d.isDirectory() || samePath(path.join(root, d.name), dir)) continue;
    const r = rowOf(readJson(path.join(root, d.name, '게시', '게시결과.json'))?.판, account);
    if (held(r)) return { piece: d.name, state: r.상태 };
  }
  for (const [k, e] of Object.entries(reg.칸)) {
    if (!k.startsWith(`${account}|`) || !e || typeof e !== 'object' || !e.편 || e.편 === name) continue;
    const truth = truthOf(e, account, root, shared);
    if (truth.kind !== 'gone') return { piece: e.편, state: truth.kind === 'held' ? truth.state : e.상태 };
  }
  return null;
}

// ── 같은 작업본 안 ───────────────────────────────────────────────────────────────────────────────────────
// 같은 계정 · 같은 현지 날짜 · 같은 칸에 걸린(또는 거는 중인) 다른 편
function sameCell(root, dir, account, time, accounts) {
  const a = accounts[account];
  const ms = Date.parse(time || '');
  if (!a || !Number.isFinite(ms)) return null;
  const tz = T.tzOf(a);
  const want = `${T.localDate(ms, tz)}|${T.slotFor(time, a).time}`;
  for (const d of fs.readdirSync(root, { withFileTypes: true })) {
    if (!d.isDirectory() || samePath(path.join(root, d.name), dir)) continue;
    const prep = readJson(path.join(root, d.name, '게시', '준비.json'));
    const result = readJson(path.join(root, d.name, '게시', '게시결과.json'));
    if (!prep || !result) continue;
    const r = rowOf(result.판, account);
    const plate = (prep.판 || []).find((p) => p.계정 === account);
    const t = plate?.시각 || r?.시각;
    if (!held(r) || !Number.isFinite(Date.parse(t || ''))) continue;
    if (`${T.localDate(Date.parse(t), tz)}|${T.slotFor(t, a).time}` === want) return { piece: d.name, state: r.상태 };
  }
  return null;
}

const READ_LIST = '그 플랫폼 예약 목록을 읽고 걸려 있으면 「끝 --상태 예약됨 --확인 …」, 없으면 「풀기 --까닭 …」 뒤에 다시 건다';

// 닫힌 계정 · 닫힌 칸(11-11 Fable 5.2 끝 판 검수 P2-8) — 하루 칸(dailyTimes)이 있는 계정에서: 아직 안 연 계정(dailyFrom 「미정」이거나 그 날짜 전)이면
// 어느 판이든, 돌림 판이면 그 현지 날짜에 그 칸이 안 열렸을 때(dailyTimesFrom · dailyFormatsFrom)도 까닭 글을 준다. 열려 있으면 null.
// 손으로 단 판의 칸은 「가장 가까운 칸」으로 세는 것이라(새벽에 올리는 판 등) 닫힌 칸까지는 가리지 않는다 — 칸 시각은 올리기 전 검사 ⑩-2가 본다.
// 걸기(claim)와 올리기 전 검사 ⑩이 같이 쓴다: 닫힌 계정에 손으로 단 판 · 계정을 닫은 뒤 남은 돌림 판을 아무 관문도 막지 않았다.
function closedCell(a, timeIso, { rotation = false } = {}) {
  if (!a || !Array.isArray(a.dailyTimes) || !a.dailyTimes.length) return null;
  const at = Date.parse(timeIso || '');
  if (!Number.isFinite(at)) return null;
  if (T.notStarted(a)) return '아직 안 연 계정이다(원장 dailyFrom 「미정」)';
  const day = T.localDate(at, T.tzOf(a));
  if (a.dailyFrom && day < a.dailyFrom) return `이 계정은 현지 ${a.dailyFrom}부터 연다(이 판은 현지 ${day})`;
  if (!rotation) return null;
  const slot = T.slotFor(timeIso, a);
  if (!T.slotsOn(a, day).some((s) => s.time === slot.time)) return `현지 ${day}에 이 계정의 ${slot.time}${slot.format ? ` ${slot.format}` : ''} 칸은 닫혀 있다(원장 dailyTimesFrom · dailyFormatsFrom)`;
  return null;
}

function claim({ dir, account, method = null, root = path.dirname(dir), repo = REPO, accounts, now = Date.now(), registry = null }) {
  const place = placeOf(root, registry);
  return withLock(place.file, () => {
    const name = path.basename(dir);
    const prep = readJson(path.join(dir, '게시', '준비.json'));
    const plate = (prep?.판 || []).find((p) => p.계정 === account);
    if (!plate) return { ok: false, why: `준비.json에 ${account} 판이 없다` };
    if (!accounts?.[account]) return { ok: false, why: `원장(sns-계정.json)에 ${account}가 없어 칸을 셀 수 없다` };
    const file = plateFile(dir, plate, repo);
    if (!file) return { ok: false, why: `판 파일이 없다: ${plate.파일}` };
    const sha = sha256(file);
    if (plate.지문 && plate.지문 !== sha) return { ok: false, why: `판 파일이 돌림표가 적은 지문과 다르다(검수 뒤 바뀜) — node tools/돌림표.js --다시 · 판본 검수부터` };
    const closed = closedCell(accounts[account], plate.시각, { rotation: Boolean(plate.돌림) });
    if (closed) return { ok: false, why: `${closed} — 닫힌 계정 · 칸에는 걸지 않는다(돌림 판이면 node tools/돌림표.js --다시 --쓰기로 다시 짜고, 손으로 단 판이면 뺀다. 계정 · 칸을 여는 것은 조율 세션 몫)` };
    const clash = sameCell(root, dir, account, plate.시각, accounts);
    if (clash) return { ok: false, why: `같은 칸에 이미 ${clash.piece}(${clash.state})가 있다` };
    const reg = readRegistry(place.file);
    const key = cellKey(account, plate.시각, accounts);
    const b = blocker(reg, key, name, account, root, place.shared);
    if (b) {
      const what = b.entry.편 === name ? '이 판' : `같은 칸의 ${b.entry.편}`;
      if (b.truth.kind === 'held') return { ok: false, why: `${what}이(가) 다른 작업본에서 ${b.truth.state}다(${b.truth.at}) — 거기서 끝내거나 푼다` };
      return { ok: false, why: `${what}이(가) 다른 작업본에서 ${b.entry.상태}로 적혔는데 그 작업본을 읽을 수 없다(${b.entry.자리}) — 그 플랫폼 예약 목록을 읽은 뒤 「풀기 ${b.entry.편} ${account} --까닭 …」으로 그 줄을 거둔다. 목록에 걸려 있었으면 다시 올리지 않고 걸기 → 「끝 --상태 예약됨 --확인 …」으로 이 작업본에 적고, 없었으면 걸기부터 다시 한다` };
    }
    if (!accounts[account].rotationSeed && accounts[account].postRouteVerified === TRIAL) {
      const first = firstPlateHeld(root, dir, name, account, reg, place.shared);
      if (first) return { ok: false, why: `첫 판 확인 전 계정이다(원장 postRouteVerified 「${TRIAL}」) — 이미 ${first.piece}(${first.state})가 걸려 있다. 그 판을 플랫폼 예약 목록에서 확인하고 원장 postRouteVerified를 true로 바꾼 뒤 다음 판을 건다` };
    }
    // 표에 먼저 적고 게시결과를 쓴다 — 사이에 죽어도 표의 줄은 참(게시결과)과 맞춰 보고 버려진다
    const stamp = new Date(now).toISOString();
    const before = key ? reg.칸[key] : undefined;
    if (key) {
      for (const [k, e] of Object.entries(reg.칸)) if (k !== key && k.startsWith(`${account}|`) && e?.편 === name && samePath(e.자리, root)) delete reg.칸[k];
      reg.칸[key] = { 편: name, 상태: CLAIM, 때: stamp, 자리: path.resolve(root) };
      writeRegistry(place.file, reg, now);
    }
    let why = null;
    let next = null;
    try {
      next = updateResult(dir, account, (cur, addRow) => {
        if (cur && DONE.has(cur.상태)) { why = `이미 ${cur.상태}`; return undefined; }
        if (cur && WAITING.has(cur.상태) && cur.작업) { why = `작업실에 이미 등록된 판이다(${cur.상태} · 작업 ${cur.작업}) — node tools/작업실예약.js 상태로 본다`; return undefined; }
        if (cur && cur.상태 === CLAIM) {
          why = now - Date.parse(cur.거는중 || 0) < CLAIM_LIVE_MS
            ? `다른 회차가 ${cur.거는중}부터 거는 중 — 그 플랫폼 예약 목록부터 읽는다`
            : `끊긴 회차의 「거는 중」이 남아 있다(${cur.거는중}부터) — 덮지 않는다. ${READ_LIST}`;
          return undefined;
        }
        // 작업 ID가 적힌 죽은 줄(작업실 길의 취소됨 · 놓침)은 그 작업의 기록이다 — 덮거나 물려받지 않고 새 줄을 더한다.
        // 물려받으면 작업실예약 「상태」가 그 작업 ID로 이 줄을 다시 찾아 「취소됨」으로 내린다.
        // 거둔 줄(보류 · 지움)도 같다(11-11 P3-2) — 덮으면 「보류」 글 칸이 새 줄에 딸려 가고, 그 판을 풀면 상태 없는 줄이 남아
        // 앞의 「예약됨」이 그 계정의 줄로 되살아난다.
        if (cur && (cur.작업 || WITHDRAWN.has(cur.상태))) { addRow(); cur = null; }
        return { ...(cur || {}), 계정: account, 상태: CLAIM, 거는중: stamp, 시각: plate.시각, 지문: sha, ...(method ? { 방법: method } : {}) };
      });
    } finally {
      if (!next && key) { if (before) reg.칸[key] = before; else delete reg.칸[key]; writeRegistry(place.file, reg, now); }
    }
    return next ? { ok: true, entry: next } : { ok: false, why };
  });
}

// 「끝」을 받지 않는 까닭(받으면 null)
function refuseFinish(cur, state, proof) {
  const st = cur?.상태 || null;
  if (st === '게시됨' && state !== '게시됨') return '이미 게시됨 — 공개된 판은 다른 상태로 바꾸지 않는다(지우기 · 비공개 전환은 유호님께 묻는 일)';
  if (WAITING.has(st) && cur.작업) return `작업실에 등록된 판이다(${st} · 작업 ${cur.작업}) — 상태는 node tools/작업실예약.js 상태가 적는다`;
  if (state === '실패') {
    if (st === CLAIM || st === '실패') return null;
    if (st === '예약됨') return proof.seen ? null : '「예약됨」을 「실패」로 내리려면 --확인(그 플랫폼 예약 목록 · 게시물에서 읽은 것)이 있어야 한다';
    return '앞선 「걸기」가 없다 — 걸지 않은 판은 실패로 적지 않는다';
  }
  const any = Boolean(proof.id || proof.url || proof.seen);
  if (st === state) return any ? null : `이미 ${st} — 더할 게시물 ID · 주소 · 확인이 없다`;
  if (st !== CLAIM && !(st === '예약됨' && state === '게시됨')) return `앞선 「걸기」가 없다(지금 상태: ${st || '없음'}) — node tools/게시장부.js 걸기부터`;
  if (!any) return '--게시물ID · --주소 · --확인 가운데 하나(그 플랫폼 예약 목록 · 게시물에서 이번에 읽은 것)가 있어야 한다';
  return null;
}

function finish({ dir, account, state, id = null, url = null, seen = null, approval = null, root = path.dirname(dir), accounts = null, now = Date.now(), registry = null }) {
  if (!['예약됨', '게시됨', '실패'].includes(state)) return { ok: false, why: '--상태는 예약됨 · 게시됨 · 실패' };
  const place = placeOf(root, registry);
  return withLock(place.file, () => {
    const name = path.basename(dir);
    let why = null;
    let was = null; // 닫기 직전의 줄
    const next = updateResult(dir, account, (cur) => {
      why = refuseFinish(cur, state, { id, url, seen });
      if (why) return undefined;
      was = cur ? { ...cur } : null;
      const base = { ...cur };
      delete base.거는중;
      return { ...base, 상태: state, ...(id ? { 게시물ID: id } : {}), ...(url ? { 주소: url } : {}), ...(seen ? { 확인: seen } : {}), ...(approval ? { 승인: approval } : {}), 기록시각: new Date(now).toISOString() };
    });
    if (!next) return { ok: false, why };
    const reg = readRegistry(place.file);
    // 이 작업본이 적은 표의 줄, 그리고 다른 작업본이 적었어도 **같은 예약**인 줄(표 줄의 때 = 닫기 직전 줄의 시각)을 고친다. 건 회차 사본이 아닌 곳에서
    // 닫는 것이 제작 절차의 보통 길인데(올라온 줄을 공용 · 다음 날 사본에서 닫는다), 「자리」가 같은 줄만 고치면 「실패」로 내린 판의 표 줄이 남아 그 칸 · 그 편 ·
    // (첫 판 계정은) 계정 전체가 보름 넘게 막힌다(11-11 내린 세 판 — P1-팔9). 다른 자리의 살아 있는 「거는 중」(2시간 안)은 건드리지 않는다 — 그 회차가 올리는 중이다.
    const same = (k) => Date.parse(reg.칸[k].때 || '') === stampOf(was) && !(reg.칸[k].상태 === CLAIM && now - Date.parse(reg.칸[k].때) < CLAIM_LIVE_MS);
    const mine = Object.keys(reg.칸).filter((k) => k.startsWith(`${account}|`) && reg.칸[k]?.편 === name && (samePath(reg.칸[k].자리, root) || same(k)));
    if (state === '실패') for (const k of mine) delete reg.칸[k];
    else {
      const ledger = accounts || readJson(path.join(root, 'sns-계정.json'))?.accounts || {};
      const plate = (readJson(path.join(dir, '게시', '준비.json'))?.판 || []).find((p) => p.계정 === account);
      const key = mine[0] || cellKey(account, next.시각 || plate?.시각, ledger);
      for (const k of mine.slice(1)) delete reg.칸[k];
      if (key && (!reg.칸[key] || mine.includes(key))) reg.칸[key] = { 편: name, 상태: state, 때: new Date(now).toISOString(), 자리: path.resolve(root) };
    }
    writeRegistry(place.file, reg, now);
    return { ok: true, entry: next };
  });
}

function release({ dir, account, why, root = path.dirname(dir), now = Date.now(), registry = null }) {
  const place = placeOf(root, registry);
  return withLock(place.file, () => {
    const name = path.basename(dir);
    let local = false;
    let was = null; // 풀기 직전의 줄
    updateResult(dir, account, (cur) => {
      if (!cur || cur.상태 !== CLAIM) return undefined;
      local = true;
      was = { ...cur };
      const { 거는중, 지문, 상태, ...rest } = cur;
      return Object.keys(rest).length > 1 ? { ...rest, 풀림: why } : null;
    });
    // 표에서는 이 편 · 이 계정 줄 가운데 참이 더는 잡고 있지 않은 것(방금 푼 줄 · 읽을 수 없는 작업본의 줄)을 거둔다
    const reg = readRegistry(place.file);
    let dropped = 0;
    let elsewhere = null;
    for (const [k, e] of Object.entries(reg.칸)) {
      if (!k.startsWith(`${account}|`) || e?.편 !== name) continue;
      const truth = truthOf(e, account, root, place.shared);
      // 다른 작업본에 걸려 있는 줄은 두되, 방금 푼 줄과 같은 걸기(표 줄의 때 = 푼 줄의 시각)이고 2시간이 지난 끊긴 「거는 중」이면 같이 거둔다(P1-팔9 · P2-팔13)
      const sameStale = truth.kind === 'held' && local && !samePath(truth.at, root) && Date.parse(e.때 || '') === stampOf(was) && now - Date.parse(e.때) >= CLAIM_LIVE_MS;
      if (truth.kind === 'held' && !sameStale) { if (!samePath(truth.at, root)) elsewhere = truth; continue; }
      delete reg.칸[k];
      dropped += 1;
    }
    if (!local && !dropped) return { ok: false, why: elsewhere ? `다른 작업본에서 ${elsewhere.state}다(${elsewhere.at}) — 거기서 푼다` : '「거는 중」이 아니다' };
    reg.풀림.push({ 계정: account, 편: name, 까닭: why, 때: new Date(now).toISOString(), 자리: path.resolve(root), ...(local ? {} : { 다른작업본줄: true }) });
    writeRegistry(place.file, reg, now);
    return { ok: true, note: local ? null : '다른 작업본이 남긴 장부 줄을 거뒀다' };
  });
}

// 이 작업본의 「거는 중」 + 표에 적힌 다른 작업본의 「거는 중」
function pendingClaims(root, { registry = null } = {}) {
  const out = [];
  for (const d of fs.readdirSync(root, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const result = readJson(path.join(root, d.name, '게시', '게시결과.json'));
    for (const p of result?.판 || []) if (p.상태 === CLAIM) out.push({ piece: d.name, account: p.계정, since: p.거는중, time: p.시각 });
  }
  for (const [k, e] of Object.entries(readRegistry(placeOf(root, registry).file).칸)) {
    if (e?.상태 !== CLAIM || samePath(e.자리, root)) continue;
    const [account, day, slot] = k.split('|');
    out.push({ piece: e.편, account, since: e.때, time: `${day} ${slot}`, where: e.자리 });
  }
  return out;
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const root = argValue(rest, '--폴더') ? path.resolve(argValue(rest, '--폴더')) : path.join(REPO, 'docs', '마케팅');
  const accounts = (readJson(path.join(root, 'sns-계정.json')) || {}).accounts || {};
  const pos = rest.filter((a, i) => !a.startsWith('--') && !(i > 0 && rest[i - 1].startsWith('--')));
  try {
    if (cmd === '걸던것') {
      const list = pendingClaims(root);
      console.log(list.length ? list.map((c) => `거는 중 · ${c.account} · ${c.piece} · 판 ${c.time} · ${c.since}부터${c.where ? ` · 다른 작업본 ${c.where}` : ''}`).join('\n') + '\n— 이 판들은 그 플랫폼 예약 목록부터 읽고 「끝」이나 「풀기」로 닫는다' : '거는 중인 판 없음');
      return 0;
    }
    if (!['걸기', '끝', '풀기'].includes(cmd) || pos.length < 2) {
      console.error('쓰는 법: node tools/게시장부.js 걸기|끝|풀기 <편 폴더> <계정> … · node tools/게시장부.js 걸던것');
      return 2;
    }
    const dir = pieceDir(pos[0], root);
    const account = pos[1];
    const r = cmd === '걸기' ? claim({ dir, account, method: argValue(rest, '--방법'), root, accounts })
      : cmd === '끝' ? finish({ dir, account, state: argValue(rest, '--상태'), id: argValue(rest, '--게시물ID'), url: argValue(rest, '--주소'), seen: argValue(rest, '--확인'), approval: argValue(rest, '--승인'), root, accounts })
        : release({ dir, account, why: argValue(rest, '--까닭') || '까닭 없음', root });
    if (!r.ok) { console.error(`${cmd} 못 함 — ${account} · ${path.basename(dir)}: ${r.why}`); return 1; }
    console.log(`${cmd} · ${account} · ${path.basename(dir)}${r.entry ? ` → ${r.entry.상태}` : ''}${r.note ? ` (${r.note})` : ''}`);
    return 0;
  } catch (error) { console.error(error.message); return 1; }
}

module.exports = { claim, finish, release, pendingClaims, sameCell, closedCell, held, rowOf, registryHolds, CLAIM, TRIAL, WITHDRAWN };
if (require.main === module) process.exitCode = main(process.argv.slice(2));
