#!/usr/bin/env node
'use strict';
/* 판본 할 일(2026-11-13 유호님 「작게 지금 넘기기」 — LAB 하루 두 편 · 39계정의 나라 판본 제작을 매일 예약 작업 `synk-daily-lab-versions`로).
 * 돌림표의 미리 보기에서 「판본이 없어 비는 이야기 칸」을 찾아, 그 칸을 채울 (원본 편, 판본 키)를 가장 이른 빈 칸부터 줄 세운다.
 * 읽기만 한다 — 준비.json · 원장 · 판을 쓰지 않는다. 절차는 docs/마케팅/기획장부/제작절차.md 「LAB 하루 두 편」 3.
 *
 *   node tools/판본할일.js [--일수 5] [--상한 6] [--json]
 *       돌림표(`node tools/돌림표.js --일수 N --json`)를 불러 셈한다.
 *   시험용: --표 <돌림표 --json 결과 파일>(돌림표를 부르지 않는다) · --원장 <sns-계정.json> · --폴더 <편 폴더들이 있는 곳, 기본 docs/마케팅> · --지금 <ISO>
 *
 * 줄 세우는 법:
 *   ① 계정마다 가장 이른 빈 이야기 칸의 까닭을 가른다 — 「판본」(그 계정 판본 키의 판본이 아직 못 듦) · 「첫판」(첫 판 확인 전 — 14시 회차가
 *      공개를 확인하면 열린다) · 「원본」(그 계정이 이야기 원본을 다 받음 — 판본으로는 못 푼다, 새 원본이 있어야 한다).
 *   ② 「판본」 계정을 빈 칸이 이른 차례로, 그 뒤에 「첫판」 계정을 이른 차례로 둔다(첫 판 확인 전 계정은 확인 뒤에야 받으니 뒤).
 *   ③ 계정의 후보 = 돌림에 오른 이야기 원본(형식 이야기 · 쓸날이 날짜 · 멈춤 · 예비 아님) 가운데 그 키 판본이 아직 못 드는 것.
 *      이미 구워 검수만 남은 판본(「뜻 검수 전」 …)을 글부터 써야 하는 판본(「판본 없음」)보다 앞에 둔다 — 덜 들고 칸을 먼저 채운다.
 *   ④ 같은 키를 기다리는 계정은 한 줄로 묶고(가장 앞선 계정의 갈래 · 빈 칸), 한 키가 상한을 다 쓰지 않게 키 차례로 하나씩 돌아가며 고른다.
 * 씨앗 계정(rotationSeed)의 빈 칸은 줄 편(영어 · 몽골 · 두 채널)이 채우는 칸이라 세지 않는다.
 * 종료 코드: 0 = 셈함(할 일이 없어도 0) · 2 = 사용법 · 실행 오류.  시험: node --test tests/판본할일.test.js
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));

function 갈래(why) {
  const w = String(why || '');
  if (w.includes('판본이 아직 못 듦')) return '판본';
  if (w.includes('첫 판 확인 전')) return '첫판';
  if (w.includes('원본을 다 올림')) return '원본';
  return '그밖';
}

/** 한국 시각 「MM-DD HH:mm」 — 보고에 적는 꼴 */
function 한국시각(iso) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '?';
  const d = new Date(ms + 9 * 3600 * 1000);
  const two = (n) => String(n).padStart(2, '0');
  return `${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
}

/** 편 폴더들의 준비.json에서 「돌림」 머리(형식 · 쓸날 · 멈춤 · 예비)만 읽는다. 못 읽은 편은 빠진다 */
function 원본읽기(root, pieces) {
  const out = new Map();
  for (const piece of pieces) {
    try {
      const r = readJson(path.join(root, piece, '게시', '준비.json')).돌림;
      if (r) out.set(piece, { 형식: r.형식, 쓸날: r.쓸날, 멈춤: Boolean(r.멈춤), 예비: Boolean(r.예비) });
    } catch { /* 못 읽은 편은 후보에서 빠진다 — 돌림표가 그 편을 어떻게 셌는지는 돌림표 출력이 보인다 */ }
  }
  return out;
}

/**
 * @param {{ 표: object, 원장: object, 원본들: Map<string, object>, 상한?: number }} 입력
 * @returns {{ 줄: object[], 남은: number, 원본없음: object[], 첫판전: string[], 키없음: string[] }}
 */
function 할일({ 표, 원장, 원본들, 상한 = 6 }) {
  const accounts = (원장 && 원장.accounts) || {};
  const versions = (표 && 표.versions) || {};
  const story = Object.keys(versions)
    .filter((p) => { const o = 원본들.get(p); return o && o.형식 === '이야기' && !o.멈춤 && !o.예비 && DAY.test(String(o.쓸날 || '')); })
    .sort((a, b) => String(원본들.get(a).쓸날).localeCompare(String(원본들.get(b).쓸날)) || a.localeCompare(b));

  // ① 계정마다 가장 이른 빈 이야기 칸
  const first = new Map();
  for (const c of (표 && 표.cells) || []) {
    if (c.format !== '이야기' || c.taken || c.original) continue;
    const seen = first.get(c.account);
    if (!seen || Date.parse(c.time) < Date.parse(seen.time)) first.set(c.account, c);
  }

  const waiting = [];
  const 원본없음 = [];
  const 키없음 = [];
  for (const [account, cell] of first) {
    const row = accounts[account] || {};
    if (row.rotationSeed) continue; // 씨앗 칸은 줄 편이 채운다
    const kind = 갈래(cell.why);
    if (kind === '원본') { 원본없음.push({ 계정: account, 빈칸: cell.time, 한국: 한국시각(cell.time) }); continue; }
    if (kind !== '판본' && kind !== '첫판') continue;
    const key = String(row.rotationVersion || row.countryCode || '').toUpperCase();
    if (!key) { 키없음.push(account); continue; }
    waiting.push({ 계정: account, 키: key, 갈래: kind, 빈칸: cell.time, 언어: row.language || null });
  }
  // ② 「판본」 계정 먼저, 그 안에서는 빈 칸이 이른 차례
  waiting.sort((a, b) => (a.갈래 === b.갈래 ? 0 : a.갈래 === '판본' ? -1 : 1) || Date.parse(a.빈칸) - Date.parse(b.빈칸) || a.계정.localeCompare(b.계정));
  원본없음.sort((a, b) => Date.parse(a.빈칸) - Date.parse(b.빈칸) || a.계정.localeCompare(b.계정));

  // 같은 키를 기다리는 계정은 한 줄로 묶는다(가장 앞선 계정의 갈래 · 빈 칸) — 한 키가 한 바퀴에 두 번 고르지 않는다
  const lanes = [];
  for (const w of waiting) {
    const lane = lanes.find((l) => l.키 === w.키);
    if (lane) { lane.계정들.push(w.계정); continue; }
    // ③ 그 키 판본이 아직 못 드는 이야기 원본 — 검수만 남은 것을 앞에
    const 후보 = story
      .filter((p) => !(versions[p][w.키] && versions[p][w.키].ready))
      .map((p) => ({ 편: p, 상태: versions[p][w.키] ? (versions[p][w.키].why || '검수 전') : '판본 없음', 있는판본: Boolean(versions[p][w.키]) }))
      .sort((a, b) => Number(b.있는판본) - Number(a.있는판본));
    lanes.push({ 키: w.키, 계정들: [w.계정], 갈래: w.갈래, 빈칸: w.빈칸, 언어: w.언어, 후보 });
  }

  // ④ 키 차례로 하나씩 돌아가며
  const order = [];
  const deepest = lanes.reduce((n, l) => Math.max(n, l.후보.length), 0);
  for (let round = 0; round < deepest; round += 1) {
    for (const lane of lanes) {
      const c = lane.후보[round];
      if (!c) continue;
      order.push({
        편: c.편, 키: lane.키, 언어: lane.언어, 계정들: lane.계정들.slice(), 갈래: lane.갈래, 빈칸: lane.빈칸, 한국: 한국시각(lane.빈칸), 상태: c.상태,
        다음: c.있는판본 ? '확인부터 — node tools/판본글잇기.js 확인 <편 폴더> <키>가 보이는 빠진 걸음' : '글부터 — 채우기 → 뽑기 → 글자검사 전 → 현지어대조 → 판본렌더 → 돌림 → 글자검사 판본 → 뜻검사',
      });
    }
  }
  const cap = Math.max(0, Number(상한) || 0);
  return {
    줄: order.slice(0, cap),
    남은: Math.max(0, order.length - cap),
    원본없음,
    첫판전: waiting.filter((w) => w.갈래 === '첫판').map((w) => w.계정),
    키없음,
  };
}

function 돌림표부르기({ 일수, 폴더, 지금 }) {
  const args = [path.join(__dirname, '돌림표.js'), '--일수', String(일수), '--json'];
  if (폴더) args.push('--폴더', 폴더);
  if (지금) args.push('--지금', 지금);
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`돌림표가 종료 ${r.status}로 끝났다 — ${String(r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' / ')}`);
  const lines = String(r.stdout).split(/\r?\n/);
  const at = lines.findIndex((l) => l === '{');
  if (at < 0) throw new Error('돌림표 --json 출력에서 JSON을 못 찾았다');
  return JSON.parse(lines.slice(at).join('\n'));
}

function main(argv) {
  const value = (name) => { const i = argv.indexOf(name); return i > -1 ? argv[i + 1] : null; };
  const 일수 = Number(value('--일수') || 5);
  const 상한 = Number(value('--상한') || 6);
  if (!Number.isInteger(일수) || 일수 < 1 || !Number.isInteger(상한) || 상한 < 1) {
    console.error('쓰는 법: node tools/판본할일.js [--일수 5] [--상한 6] [--json]');
    return 2;
  }
  const root = value('--폴더') ? path.resolve(value('--폴더')) : path.join(REPO, 'docs', '마케팅');
  let 표;
  let 원장;
  try {
    표 = value('--표') ? readJson(value('--표')) : 돌림표부르기({ 일수, 폴더: value('--폴더'), 지금: value('--지금') });
    원장 = readJson(value('--원장') || path.join(REPO, 'docs', '마케팅', 'sns-계정.json'));
  } catch (e) {
    console.error(`판본 할 일을 셈하지 못했다 — ${e.message}`);
    return 2;
  }
  const out = 할일({ 표, 원장, 원본들: 원본읽기(root, Object.keys(표.versions || {})), 상한 });
  if (argv.includes('--json')) { console.log(JSON.stringify({ from: 표.from, days: 표.days, 상한, ...out }, null, 2)); return 0; }

  console.log(`LAB 판본 할 일 · ${표.from || '?'}부터 ${표.days || 일수}일 · 상한 ${상한}`);
  if (!out.줄.length) console.log('만들 판본 없음 — 판본이 없어 비는 이야기 칸이 없다');
  out.줄.forEach((r, i) => {
    console.log(`${i + 1}. ${r.편}  ${r.키}${r.언어 ? `(${r.언어})` : ''}  ${r.계정들.join(' · ')}  빈 칸 ${r.한국}(한국)${r.갈래 === '첫판' ? ' · 첫 판 확인 뒤' : ''}  ${r.상태}\n   → ${r.다음}`);
  });
  if (out.남은) console.log(`상한 밖에 남은 줄 ${out.남은}`);
  if (out.첫판전.length) console.log(`첫 판 확인 전 계정 ${out.첫판전.length}(14시 회차가 공개를 확인하면 열린다): ${out.첫판전.join(' · ')}`);
  if (out.원본없음.length) console.log(`돌 원본이 없는 계정 ${out.원본없음.length}(판본으로는 못 푼다 — 판본 틀이 든 새 원본이 있어야 한다): ${out.원본없음.map((r) => `${r.계정} ${r.한국}`).join(' · ')}`);
  if (out.키없음.length) console.log(`판본 키가 없는 계정 ${out.키없음.length}(원장 rotationVersion · countryCode): ${out.키없음.join(' · ')}`);
  return 0;
}

module.exports = { 할일, 갈래, 한국시각, 원본읽기 };
if (require.main === module) process.exit(main(process.argv.slice(2)));
