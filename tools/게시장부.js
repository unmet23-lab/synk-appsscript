#!/usr/bin/env node
'use strict';
/* 게시 장부 잠금(2026-11-10 LAB 하루 두 편 · 39계정 — 설계 4 「게시 장부로 같은 칸이 두 번 걸리지 않게 막는다. 끊긴 뒤 다시 할 때는
 * 예약 목록부터 읽는다」). 판 하나를 걸기 전에 「거는 중」을 적고, 건 뒤 「예약됨」 · 「게시됨」(게시물 ID · 주소 · 지문)으로 끝낸다.
 *
 *   node tools/게시장부.js 걸기 <편 폴더> <계정> [--방법 <ego|크롬|작업실…>]
 *       그 편 게시/준비.json에 그 계정 판이 있고, 판 파일 SHA-256(지문)이 판에 적힌 「지문」(돌림 판)과 같고, 그 계정의 같은 현지 날짜 ·
 *       칸에 다른 편이 「예약됨」 · 「게시됨」 · 「거는 중」이 아니고, 이 판이 이미 걸린 판이 아니면 게시결과.json에 {상태:「거는 중」} 을 적는다.
 *       아니면 종료 1 — 까닭을 보인다. 2시간 안의 다른 「거는 중」도 막는다(다른 세션이 거는 중).
 *   node tools/게시장부.js 끝 <편 폴더> <계정> --상태 예약됨|게시됨|실패 [--게시물ID <id>] [--주소 <url>] [--확인 "<예약 목록에서 읽은 것>"]
 *   node tools/게시장부.js 풀기 <편 폴더> <계정> --까닭 "<플랫폼 예약 목록에 없음을 확인함 등>"   「거는 중」을 거둔다
 *   node tools/게시장부.js 걸던것 [--폴더 <docs/마케팅>]      모든 편의 「거는 중」 — 끊긴 회차가 다시 할 때 이 판들은 플랫폼 예약 목록부터 읽는다
 * 게시결과.json은 그 계정 줄만 바꾸고, 읽은 뒤 그새 파일이 바뀌었으면 쓰지 않고 멈춘다(tools/작업실예약.js와 같은 셈). 장부 표는
 * node tools/돌림표.js --장부.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const T = require('./lib/계정시간.js');

const REPO = path.resolve(__dirname, '..');
const DONE = new Set(['예약됨', '게시됨']);
const CLAIM = '거는 중';
const CLAIM_LIVE_MS = 2 * 3600000;
const argValue = (args, name) => { const i = args.indexOf(name); return i > -1 ? args[i + 1] : null; };

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch { return null; }
}
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function pieceDir(given, root) {
  const dir = path.isAbsolute(given) || fs.existsSync(given) ? path.resolve(given) : path.join(root, given);
  if (!fs.existsSync(path.join(dir, '게시', '준비.json'))) throw new Error(`편 폴더가 아니다(게시/준비.json 없음): ${given}`);
  return dir;
}

// 판 파일 경로 — 판 「파일」이 편 폴더 기준(게시/…)이거나 저장소 기준(docs/…)일 수 있다.
function plateFile(dir, plate, repo) {
  const p = plate.파일 || '';
  for (const base of [dir, repo]) { const f = path.isAbsolute(p) ? p : path.join(base, p); if (p && fs.existsSync(f)) return f; }
  return null;
}

// 게시결과.json 그 계정 줄만 바꾸기 — 읽은 바이트가 쓰기 직전에도 같아야 쓴다.
function updateResult(dir, account, change) {
  const file = path.join(dir, '게시', '게시결과.json');
  const raw = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  const result = raw ? JSON.parse(raw.replace(/^﻿/, '')) : { 판: [] };
  if (!result || typeof result !== 'object' || Array.isArray(result) || (result.판 != null && !Array.isArray(result.판))) throw new Error('게시결과.json 모양이 달라 건드리지 않았다');
  result.판 = result.판 || [];
  const i = result.판.findIndex((p) => p.계정 === account);
  const next = change(i > -1 ? { ...result.판[i] } : null);
  if (next === undefined) return null;
  if (next === null) { if (i > -1) result.판.splice(i, 1); } else if (i > -1) result.판[i] = next; else result.판.push(next);
  if ((fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null) !== raw) throw new Error('게시결과가 그새 바뀌어 쓰기를 멈췄다 — 다시 돌린다');
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(result, null, 2) + '\n');
  fs.renameSync(tmp, file);
  return next;
}

// 같은 계정 · 같은 현지 날짜 · 같은 칸에 걸린(또는 거는 중인) 다른 편
function sameCell(root, dir, account, time, accounts) {
  const a = accounts[account];
  const ms = Date.parse(time || '');
  if (!a || !Number.isFinite(ms)) return null;
  const tz = T.tzOf(a);
  const want = `${T.localDate(ms, tz)}|${T.slotFor(time, a).time}`;
  for (const d of fs.readdirSync(root, { withFileTypes: true })) {
    if (!d.isDirectory() || path.join(root, d.name) === dir) continue;
    const prep = readJson(path.join(root, d.name, '게시', '준비.json'));
    const result = readJson(path.join(root, d.name, '게시', '게시결과.json'));
    if (!prep || !result) continue;
    const r = (result.판 || []).find((p) => p.계정 === account && (DONE.has(p.상태) || p.상태 === CLAIM));
    const plate = (prep.판 || []).find((p) => p.계정 === account);
    const t = plate?.시각 || r?.시각;
    if (!r || !Number.isFinite(Date.parse(t || ''))) continue;
    if (`${T.localDate(Date.parse(t), tz)}|${T.slotFor(t, a).time}` === want) return { piece: d.name, state: r.상태 };
  }
  return null;
}

function claim({ dir, account, method = null, root, repo = REPO, accounts, now = Date.now() }) {
  const prep = readJson(path.join(dir, '게시', '준비.json'));
  const plate = (prep?.판 || []).find((p) => p.계정 === account);
  if (!plate) return { ok: false, why: `준비.json에 ${account} 판이 없다` };
  const file = plateFile(dir, plate, repo);
  if (!file) return { ok: false, why: `판 파일이 없다: ${plate.파일}` };
  const sha = sha256(file);
  if (plate.지문 && plate.지문 !== sha) return { ok: false, why: `판 파일이 돌림표가 적은 지문과 다르다(검수 뒤 바뀜) — node tools/돌림표.js --다시 · 판본 검수부터` };
  const clash = sameCell(root, dir, account, plate.시각, accounts);
  if (clash) return { ok: false, why: `같은 칸에 이미 ${clash.piece}(${clash.state})가 있다` };
  let why = null;
  const next = updateResult(dir, account, (cur) => {
    if (cur && DONE.has(cur.상태)) { why = `이미 ${cur.상태}`; return undefined; }
    if (cur && cur.상태 === CLAIM && now - Date.parse(cur.거는중 || 0) < CLAIM_LIVE_MS) { why = `다른 회차가 ${cur.거는중}부터 거는 중 — 그 플랫폼 예약 목록부터 읽는다`; return undefined; }
    return { ...(cur || {}), 계정: account, 상태: CLAIM, 거는중: new Date(now).toISOString(), 시각: plate.시각, 지문: sha, ...(method ? { 방법: method } : {}) };
  });
  return next ? { ok: true, entry: next } : { ok: false, why };
}

function finish({ dir, account, state, id = null, url = null, seen = null, now = Date.now() }) {
  if (!['예약됨', '게시됨', '실패'].includes(state)) return { ok: false, why: '--상태는 예약됨 · 게시됨 · 실패' };
  const next = updateResult(dir, account, (cur) => {
    const base = { ...(cur || { 계정: account }) };
    delete base.거는중;
    return { ...base, 상태: state, ...(id ? { 게시물ID: id } : {}), ...(url ? { 주소: url } : {}), ...(seen ? { 확인: seen } : {}), 기록시각: new Date(now).toISOString() };
  });
  return { ok: true, entry: next };
}

function release({ dir, account, why }) {
  let out = null;
  updateResult(dir, account, (cur) => {
    if (!cur || cur.상태 !== CLAIM) { out = { ok: false, why: '「거는 중」이 아니다' }; return undefined; }
    out = { ok: true };
    const { 거는중, 지문, 상태, ...rest } = cur;
    return Object.keys(rest).length > 1 ? { ...rest, 풀림: why } : null;
  });
  return out;
}

function pendingClaims(root) {
  const out = [];
  for (const d of fs.readdirSync(root, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const result = readJson(path.join(root, d.name, '게시', '게시결과.json'));
    for (const p of result?.판 || []) if (p.상태 === CLAIM) out.push({ piece: d.name, account: p.계정, since: p.거는중, time: p.시각 });
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
      console.log(list.length ? list.map((c) => `거는 중 · ${c.account} · ${c.piece} · 판 ${c.time} · ${c.since}부터`).join('\n') + '\n— 이 판들은 그 플랫폼 예약 목록부터 읽고 「끝」이나 「풀기」로 닫는다' : '거는 중인 판 없음');
      return 0;
    }
    if (!['걸기', '끝', '풀기'].includes(cmd) || pos.length < 2) {
      console.error('쓰는 법: node tools/게시장부.js 걸기|끝|풀기 <편 폴더> <계정> … · node tools/게시장부.js 걸던것');
      return 2;
    }
    const dir = pieceDir(pos[0], root);
    const account = pos[1];
    const r = cmd === '걸기' ? claim({ dir, account, method: argValue(rest, '--방법'), root, accounts })
      : cmd === '끝' ? finish({ dir, account, state: argValue(rest, '--상태'), id: argValue(rest, '--게시물ID'), url: argValue(rest, '--주소'), seen: argValue(rest, '--확인') })
        : release({ dir, account, why: argValue(rest, '--까닭') || '까닭 없음' });
    if (!r.ok) { console.error(`${cmd} 못 함 — ${account} · ${path.basename(dir)}: ${r.why}`); return 1; }
    console.log(`${cmd} · ${account} · ${path.basename(dir)}${r.entry ? ` → ${r.entry.상태}` : ''}`);
    return 0;
  } catch (error) { console.error(error.message); return 1; }
}

module.exports = { claim, finish, release, pendingClaims, sameCell, CLAIM };
if (require.main === module) process.exitCode = main(process.argv.slice(2));
