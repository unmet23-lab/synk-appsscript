#!/usr/bin/env node
'use strict';
/* 돌림 원본 후보(2026-11-13 LAB 하루 두 편 · 39계정 — 유호님 「이어서 만들기」). 아직 돌림 원본이 아닌 이야기 편 가운데
 * 씨앗 계정에 나간 뒤의 숫자로 「돌림에 올릴 만한 편」을 고른다. 읽기만 한다 — 장부 · 준비.json · 원장을 고치지 않는다.
 *
 *   node tools/원본후보.js [--언어 mn] [--부터 YYYYMMDD] [--json]
 *   시험용: --장부 <게시성과.jsonl> --원장 <sns-계정.json> --마케팅 <편 폴더들이 든 폴더> --지금 <ISO 시각>
 *
 * 고르는 선(제작 절차 9 「관문은 실수 잡기에, 잘될 편 고르기는 숫자로」 · 「검증된 틀은 실제 성과로만」과 같은 선):
 *   그 편 언어의 씨앗 계정(원장 rotationSeed) 가운데 하나라도, 72시간 또는 7일 판정에서
 *     ① 판정 때 조회가 그 계정 안 상위 25%(standing.views.label = top25)
 *     ② 조회가 **지금** 그 계정 평소값의 1.5배 이상 — 평소값 = 최근 30일에 나간 그 계정의 다른 글들의 같은 나이 조회 가운데값(다섯 글 이상일 때).
 *        글이 모자라면 장부의 판정 때 배수(multiple.value)를 쓴다. 판정 때 배수만 보면 계정이 작던 때의 300회짜리 편이 「3배」로 걸린다(11-13 첫 실행).
 *     ③ 저장 + 공유가 1 이상 — 그 숫자를 적는 계정만(둘 다 안 적히는 계정은 이 칸을 보지 않는다).
 * 갈래: 올릴 만함 · 기다림(72시간 · 7일 판정이 아직 없다) · 못 미침 · 이미 원본.
 * 판정 줄은 같은 글 · 같은 나이로 여러 번 적힌다 — 자리가 적힌 가장 늦은 줄을 쓴다(나중 줄이 견줄 글이 모자라 빈 값이면 앞 줄).
 * 올릴 만한 편을 실제로 올리는 차례는 docs/마케팅/기획장부/제작절차.md 「새 원본 올리기」.
 * 시험: node --test tests/원본후보.test.js
 */
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const 선 = Object.freeze({ 나이: ['72h', '7d'], 자리: 'top25', 배수: 1.5, 저장공유: 1, 평소일수: 30, 평소글: 5 });
const 나이순 = { '24h': 0, '72h': 1, '7d': 2 };
const 나이말 = { '24h': '24시간', '72h': '72시간', '7d': '7일' };
const 자리말 = { top25: '상위', middle: '가운데', bottom25: '하위' };

const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')); } catch { return null; } };

function 장부읽기(file) {
  if (!fs.existsSync(file)) return [];
  const out = [];
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    let j; try { j = JSON.parse(line); } catch { continue; }
    if (j && j.kind === '판정' && j.account && j.point in 나이순) out.push(j);
  }
  return out;
}

// 그 언어의 LAB 씨앗 계정 id들
function 씨앗계정(원장, 언어) {
  const accounts = (원장 && 원장.accounts) || {};
  return Object.entries(accounts)
    .filter(([, a]) => a && a.brand === 'LAB' && a.rotationSeed && String(a.language || '').toLowerCase().split('-')[0] === 언어)
    .map(([id]) => id).sort();
}

// 편 폴더 하나: 준비.json · 게시결과.json에서 필요한 것만
function 편읽기(마케팅, 이름) {
  const 폴더 = path.join(마케팅, 이름);
  const 준비 = readJson(path.join(폴더, '게시', '준비.json')) || {};
  const 결과 = readJson(path.join(폴더, '게시', '게시결과.json')) || {};
  const 돌림 = 준비.돌림 && typeof 준비.돌림 === 'object' ? 준비.돌림 : null;
  const 판 = Array.isArray(결과.판) ? 결과.판 : [];
  const 글ID = new Set();
  for (const p of 판) {
    if (p && p.게시물ID) 글ID.add(String(p.게시물ID));
    const m = p && typeof p.주소 === 'string' && p.주소.match(/\/(?:reel|p|video|shorts)\/([A-Za-z0-9_-]{6,})/);
    if (m) 글ID.add(m[1]);
  }
  return {
    편: 이름, 폴더, 돌림형식: 돌림 ? (돌림.형식 || null) : null, 쓸날: 돌림 ? (돌림.쓸날 || null) : null,
    틀: fs.existsSync(path.join(폴더, '판본지도.json')), 영상틀: fs.existsSync(path.join(폴더, 'remotion')),
    맹검: fs.existsSync(path.join(폴더, '게시', '미학맹검.json')), 판, 글ID,
  };
}

function 편들(마케팅, 언어, 부터) {
  if (!fs.existsSync(마케팅)) return [];
  const 꼴 = new RegExp(`^LAB_.+_${언어}_(\\d{8})$`);
  return fs.readdirSync(마케팅)
    .filter((n) => { const m = n.match(꼴); return m && (!부터 || m[1] >= 부터) && !/^LAB_(퀴즈|노래)_|TOPIK/.test(n); })
    .sort((a, b) => a.slice(-8).localeCompare(b.slice(-8)) || a.localeCompare(b))
    .map((n) => 편읽기(마케팅, n));
}

const 자리있나 = (r) => Boolean(r && r.standing && r.standing.views && r.standing.views.label);
const 조회 = (r) => (r && r.metrics && Number.isFinite(r.metrics.views) ? r.metrics.views : null);

// 한 계정 · 한 나이의 줄들에서 쓸 줄: 자리가 적힌 가장 늦은 줄, 없으면 가장 늦은 줄
function 쓸줄(rows) {
  const 늦은순 = rows.slice().sort((x, y) => String(y.at).localeCompare(String(x.at)));
  return 늦은순.find(자리있나) || 늦은순[0] || null;
}

// 지금 평소값의 재료: 계정 · 나이마다 최근 평소일수 안에 나간 글들의 조회(글마다 가장 늦은 줄)
function 평소표(장부, 지금) {
  const 글 = new Map();
  for (const r of 장부) {
    if (!선.나이.includes(r.point) || !r.post || 조회(r) == null) continue;
    const k = `${r.account}|${r.point}|${r.post}`;
    const had = 글.get(k);
    if (!had || String(r.at) > String(had.at)) 글.set(k, r);
  }
  const 부터 = 지금 - 선.평소일수 * 86400e3;
  const 표 = new Map();
  for (const r of 글.values()) {
    const 나간때 = Date.parse(r.publishedAt || r.at);
    if (!(나간때 >= 부터)) continue;
    const k = `${r.account}|${r.point}`;
    if (!표.has(k)) 표.set(k, []);
    표.get(k).push({ post: r.post, 조회: 조회(r) });
  }
  return 표;
}

function 평소값(표, 계정, 나이, 뺄글) {
  const v = (표.get(`${계정}|${나이}`) || []).filter((x) => x.post !== 뺄글).map((x) => x.조회).sort((x, y) => x - y);
  if (v.length < 선.평소글) return { 가운데: null, n: v.length };
  const m = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
  return { 가운데: m, n: v.length };
}

// 판정 줄 하나를 선에 대 본다
function 재기(r, 표 = new Map()) {
  const v = 조회(r);
  const 평소 = 평소값(표, r.account, r.point, r.post);
  const 판정때 = r.multiple && Number.isFinite(r.multiple.value) ? r.multiple.value : null;
  const 지금배수 = 평소.가운데 > 0 && v != null ? v / 평소.가운데 : null;
  const 날배수 = 지금배수 != null ? 지금배수 : 판정때; // 선에는 반올림하지 않은 값을 댄다(1.499배가 1.5배로 넘지 않게)
  const 배수 = 날배수 == null ? null : Math.round(날배수 * 100) / 100;
  const 자리 = 자리있나(r) ? r.standing.views.label : null;
  const m = r.metrics || {};
  const 적힘 = Number.isFinite(m.saves) || Number.isFinite(m.shares);
  const 저장공유 = 적힘 ? (Number(m.saves) || 0) + (Number(m.shares) || 0) : null;
  const 넘음 = 선.나이.includes(r.point) && 자리 === 선.자리 && 날배수 != null && 날배수 >= 선.배수 && (!적힘 || 저장공유 >= 선.저장공유);
  return { 나이: r.point, 조회: v, 자리, 배수, 배수근거: 지금배수 != null ? '지금' : (판정때 != null ? '판정 때' : null), 평소글: 평소.n, 저장공유, 넘음 };
}

function 계정칸(계정, rows, 표) {
  const 잰 = [];
  for (const 나이 of Object.keys(나이순)) {
    const r = 쓸줄(rows.filter((x) => x.point === 나이));
    if (r) 잰.push(재기(r, 표));
  }
  if (!잰.length) return null;
  const 익은순 = 잰.slice().sort((x, y) => 나이순[y.나이] - 나이순[x.나이]);
  const 보일 = 익은순.find((x) => x.넘음) || 익은순[0]; // 넘은 판정이 있으면 그것, 없으면 가장 익은 판정
  return { 계정, ...보일, 넘음: 잰.some((x) => x.넘음), 익음: 잰.some((x) => 선.나이.includes(x.나이)) };
}

function 후보({ 장부, 원장, 마케팅, 언어 = 'mn', 부터 = null, 지금 = Date.now() }) {
  const 씨앗 = 씨앗계정(원장, 언어);
  const 표 = 평소표(장부, 지금);
  const 줄 = [];
  for (const e of 편들(마케팅, 언어, 부터)) {
    if (e.돌림형식 && e.돌림형식 !== '이야기') continue; // 노래 · 퀴즈 원본은 이 표의 일이 아니다
    const rows = 장부.filter((r) => r.folder === e.편 || (!r.folder && [...e.글ID].some((id) => String(r.post || '').endsWith(`:${id}`))));
    const 계정 = 씨앗.map((a) => 계정칸(a, rows.filter((r) => r.account === a), 표)).filter(Boolean);
    const 씨앗판 = e.판.filter((p) => p && 씨앗.includes(p.계정) && p.시각).map((p) => p.시각).sort();
    const 넘은계정 = 계정.filter((c) => c.넘음).map((c) => c.계정);
    let 갈래;
    if (e.돌림형식 === '이야기') 갈래 = '이미 원본';
    else if (넘은계정.length) 갈래 = '올릴 만함';
    else if (계정.some((c) => c.익음)) 갈래 = '못 미침';
    else 갈래 = '기다림';
    let 다음 = null;
    if (갈래 === '올릴 만함') {
      if (!e.영상틀) 다음 = '영상 틀(remotion)이 없는 편 — 올릴 수 없다';
      else if (!e.틀) 다음 = '판본 틀로 옮긴다 — 제작 절차 「새 원본 올리기」';
      else 다음 = `node tools/판본글잇기.js 돌림 "docs/마케팅/${e.편}" 전부 --형식 이야기 --쓸날 <날짜>`;
    }
    줄.push({ 편: e.편, 갈래, 틀: e.틀, 쓸날: e.쓸날, 맹검: e.맹검, 씨앗첫판: 씨앗판[0] || null, 계정, 넘은계정, 다음 });
  }
  const 차례 = { '올릴 만함': 0, '기다림': 1, '못 미침': 2, '이미 원본': 3 };
  const 가장큰배수 = (r) => Math.max(0, ...r.계정.filter((c) => c.넘음).map((c) => c.배수 || 0));
  줄.sort((a, b) => 차례[a.갈래] - 차례[b.갈래] || b.넘은계정.length - a.넘은계정.length || 가장큰배수(b) - 가장큰배수(a) || a.편.slice(-8).localeCompare(b.편.slice(-8)));
  return { 선: { ...선 }, 언어, 씨앗, 줄 };
}

const 천 = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
function 계정글(c) {
  const 이름 = c.계정.replace(/^lab-/, '');
  const 덧 = [c.배수 == null ? null : `${c.배수}배${c.배수근거 === '판정 때' ? '*' : ''}`, c.자리 ? 자리말[c.자리] || c.자리 : null].filter(Boolean).join(' · ');
  return `${이름} ${나이말[c.나이] || c.나이} ${c.조회 == null ? '?' : 천(c.조회)}회${덧 ? `(${덧})` : ''}${c.넘음 ? ' ✓' : ''}`;
}

function 보이기(r) {
  const out = [];
  out.push(`돌림 원본 후보(${r.언어}) — 씨앗 계정 ${r.씨앗.length}곳의 ${r.선.나이.map((k) => 나이말[k]).join(' · ')} 판정에서 조회 상위 25% + 지금 그 계정 평소의 ${r.선.배수}배 이상(✓)인 계정이 하나라도 있는 편`);
  for (const 갈래 of ['올릴 만함', '기다림', '못 미침', '이미 원본']) {
    const rows = r.줄.filter((x) => x.갈래 === 갈래);
    out.push('');
    out.push(`${갈래} ${rows.length}`);
    for (const x of rows) {
      const 숫자 = x.계정.length ? x.계정.map(계정글).join(' · ') : (x.씨앗첫판 ? `판정 전 · 씨앗 첫 판 ${String(x.씨앗첫판).slice(0, 16).replace('T', ' ')}` : '씨앗 계정에 나간 기록 없음');
      out.push(`  ${x.편} — ${숫자}${갈래 === '이미 원본' ? ` | 쓸 날 ${x.쓸날 || '-'}` : ''}`);
      if (x.다음) out.push(`      다음: ${x.다음}`);
    }
  }
  out.push('');
  out.push(`배수 = 조회 ÷ 지금 그 계정 평소값(최근 ${r.선.평소일수}일에 나간 다른 글들의 같은 나이 가운데값). 글이 ${r.선.평소글}개가 안 되면 판정 때 배수를 쓰고 *를 붙인다. 자리는 판정 때 그 계정 안 자리다.`);
  return out.join('\n');
}

function main(argv) {
  const 값 = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--json') 값.json = true;
    else if (a.startsWith('--')) 값[a.slice(2)] = argv[++i];
    else { console.error('쓰는 법: node tools/원본후보.js [--언어 mn] [--부터 YYYYMMDD] [--json]'); return 2; }
  }
  if (값.부터 && !/^\d{8}$/.test(값.부터)) { console.error('--부터는 YYYYMMDD'); return 2; }
  const 지금 = 값.지금 ? Date.parse(값.지금) : Date.now();
  if (!Number.isFinite(지금)) { console.error('--지금은 ISO 시각'); return 2; }
  const 원장 = readJson(값.원장 || path.join(REPO, 'docs', '마케팅', 'sns-계정.json'));
  if (!원장) { console.error('계정 원장을 못 읽었다'); return 2; }
  const r = 후보({
    장부: 장부읽기(값.장부 || path.join(REPO, 'docs', '_ops', '게시성과.jsonl')),
    원장, 마케팅: 값.마케팅 || path.join(REPO, 'docs', '마케팅'), 언어: 값.언어 || 'mn', 부터: 값.부터 || null, 지금,
  });
  console.log(값.json ? JSON.stringify(r, null, 1) : 보이기(r));
  return 0;
}

module.exports = { 후보, 재기, 쓸줄, 평소표, 평소값, 씨앗계정, 장부읽기, 보이기, 선 };
if (require.main === module) process.exitCode = main(process.argv.slice(2));
