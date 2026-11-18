'use strict';
/* 같은 언어 묶음의 나라별판 견주기(2026-11-19). 읽기만 한다.
 *
 * 같은 플랫폼에서 같은 말로 올리는 LAB 계정들(원장 languageGroup, 없으면 판 언어 · 원장 language — 유튜브 영어: EN · US · CA · AU · NZ · PH,
 * 유튜브 스페인어: MX · PY)은 첫 카드 · 그 나라 예문 · 끝 질문 · 게시글이 나라마다 달라야 한다(돌림 ⑥ — 유호님 11-10 「확실히 국가타겟을
 * 정해서 헷갈리면 절대 안 돼」, docs/마케팅/현지화/README.md#같은-언어-묶음).
 *
 * 두 곳이 이 셈 하나를 쓴다.
 *   · tools/올리기전검사.js ⑫-2 — 14시 게시 회차. 같은 편에서 같은 묶음 두 계정에 걸린 판끼리 본다.
 *   · tools/글자검사.js 전 · 판본 — 판본 회차의 렌더 전(과 렌더 뒤 기록). 같은 편에서 같은 묶음 계정에 나갈 짝 판본의 글.json끼리 본다.
 * 11-17 「배」에서 셋째 겹 검수가 멕시코 · 파라과이 판본의 첫 카드를 각각 줄이다 둘 다 「¿Que el coreano es fácil?」가 됐다. 두 판본은
 * 현지어 · 글자 · 뜻 검사를 다 지나고 14시 ⑫-2에서야 막혔다(그 편의 판 전체가 걸리지 못한다). 그래서 렌더 전에도 같은 셈으로 본다.
 *
 * 셈(11-11 Fable 5.2 끝 판 검수 P3-3): 같음은 표기(대소문자 · 띄어쓰기 · 문장부호 · 기호)를 뺀 글로 견준다. 짧은 칸(첫 카드 · 끝 질문)은
 * 낱말 겹침이 절반 이상이면 「바꿔 말한 꼴」로 닮았다고 본다(막지 않는다 — 나라마다 다르게 썼는지 사람이 본다). 예문 · 게시글은 가르치는
 * 한국어 줄이 같아 겹침이 늘 높으니 같음만 본다.
 */
const fs = require('node:fs');
const path = require('node:path');

const VIDEO_PLATFORMS = new Set(['tiktok', 'youtube', 'instagram', 'facebook', 'telegram', 'xiaohongshu', 'douyin', 'vk', 'rutube']);
// 견주는 칸 — [보이는 이름, 판본 글의 칸 이름들]
const COUNTRY_SLOTS = [['첫 카드', ['머리']], ['그 나라 예문', ['예문', '상황']], ['끝 질문', ['끝질문']], ['게시글', ['게시글']]];
const SIMILAR_SLOTS = new Set(['첫 카드', '끝 질문']);
const SIMILAR_AT = 0.5;

/** 같은 언어 묶음 열쇠의 말 — 원장 languageGroup, 없으면 판(판본) 언어, 없으면 원장 language */
const 묶음말 = (account, language) => account?.languageGroup || language || account?.language || '';
/** 계정이 올리는 판본 키 — 원장 rotationVersion, 없으면 countryCode(tools/돌림표.js versionKey와 같다) */
const 판본키 = (account) => account?.rotationVersion || account?.countryCode || null;

const plainOf = (s) => String(s || '').normalize('NFC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
const wordsOf = (s) => new Set(String(s || '').normalize('NFC').toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u).filter((w) => w.length > 1));
function overlapOf(a, b) {
  const [x, y] = [wordsOf(a), wordsOf(b)];
  if (x.size < 2 || y.size < 2) return 0; // 띄어 쓰지 않는 글 · 한 낱말 칸은 겹침으로 가르지 않는다
  let n = 0;
  for (const w of x) if (y.has(w)) n += 1;
  return n / (x.size + y.size - n);
}
const textOf = (lines, names) => lines.filter((l) => l && names.includes(l.칸)).map((l) => String(l.글 || '').trim()).join('\n');

/**
 * 두 판본 글의 줄(판본글/1 「줄」)을 칸마다 견준다 → { same: [보이는 이름…], similar: [{ label, overlap, a, b }], compared: 견준 칸 수 }.
 * 한쪽에 그 칸 글이 없으면 그 칸은 견주지 않는다.
 */
function 칸견주기(lx, ly) {
  const same = [], similar = [];
  let compared = 0;
  if (!Array.isArray(lx) || !Array.isArray(ly)) return { same, similar, compared };
  for (const [label, names] of COUNTRY_SLOTS) {
    const [a, b] = [textOf(lx, names), textOf(ly, names)];
    if (!a || !b) continue;
    compared += 1;
    if (plainOf(a) === plainOf(b)) { if (!same.includes(label)) same.push(label); continue; }
    const overlap = SIMILAR_SLOTS.has(label) ? overlapOf(a, b) : 0;
    if (overlap >= SIMILAR_AT) similar.push({ label, overlap, a, b });
  }
  return { same, similar, compared };
}
const 짧게 = (s) => String(s || '').replace(/\s+/g, ' ').slice(0, 40);
/** 닮은 칸 하나를 알림 글로 — 「첫 카드(낱말 겹침 60% — 「…」 / 「…」)」 */
const 닮음글 = (x) => `${x.label}(낱말 겹침 ${Math.round(x.overlap * 100)}% — 「${짧게(x.a)}」 / 「${짧게(x.b)}」)`;

/**
 * 짝 판본 — 같은 편에서 판본 키와 같은 플랫폼 · 같은 언어 묶음 계정에 나갈 다른 판본.
 *   키: 이 판본 키 · 판본언어: { 판본 키: 언어 } (이 편에 있는 판본 모두) · accounts: 원장 accounts(LAB 계정만 본다)
 *   → [{ 키, 묶음: ['youtube · es', …] }] (키 차례)
 * 묶음의 말은 원장 languageGroup, 없으면 원장 language다 — 돌림표가 판 「언어」에 원장 language를 적으므로 ⑫-2가 걸린 판에서 보는 묶음과 같다.
 * 원장에 둘 다 없는 계정만 판본 언어로 본다.
 */
function 짝판본(키, 판본언어, accounts) {
  const 묶음들 = (k) => {
    const out = new Set();
    for (const a of Object.values(accounts || {})) {
      if (!a || a.brand !== 'LAB' || !VIDEO_PLATFORMS.has(a.platform) || 판본키(a) !== k) continue;
      const g = 묶음말(a, a.language) || 판본언어[k] || '';
      if (g) out.add(`${a.platform}|${g}`);
    }
    return out;
  };
  const 내 = 묶음들(키);
  const out = [];
  if (!내.size) return out;
  for (const k of Object.keys(판본언어).sort()) {
    if (k === 키) continue;
    const 겹 = [...묶음들(k)].filter((x) => 내.has(x));
    if (겹.length) out.push({ 키: k, 묶음: 겹.map((x) => x.replace('|', ' · ')) });
  }
  return out;
}

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));
/**
 * 원본 편 폴더의 판본 글 모두 → { 판본 키: { 언어, 줄, 글 } }. 준비.json 「돌림」.판본[키].글을 먼저 보고(올리기 전 검사 ⑫-2가 읽는 파일),
 * 아직 돌림에 넣지 않은 판본(렌더 전)은 게시/판본/<키>/글.json을 본다. 못 읽는 글은 뺀다.
 */
function 판본글들(편, prep) {
  const dir = path.resolve(편);
  const out = {};
  const 넣기 = (k, f, 언어) => {
    if (out[k] || !f) return;
    try {
      const j = readJson(f);
      if (Array.isArray(j?.줄)) out[k] = { 언어: j.언어 || 언어 || null, 줄: j.줄, 글: f };
    } catch { /* 못 읽는 글은 견주지 않는다 */ }
  };
  for (const [k, v] of Object.entries(prep?.돌림?.판본 || {})) if (typeof v?.글 === 'string' && v.글) 넣기(k, path.isAbsolute(v.글) ? v.글 : path.join(dir, v.글), v.언어);
  const 판본dir = path.join(dir, '게시', '판본');
  let 키들 = [];
  try { 키들 = fs.readdirSync(판본dir); } catch { /* 판본 폴더가 없다 */ }
  for (const k of 키들) if (/^[A-Z]{2}$/.test(k)) 넣기(k, path.join(판본dir, k, '글.json'), prep?.돌림?.판본?.[k]?.언어);
  return out;
}

/**
 * 한 판본 글을 같은 편의 짝 판본 글과 견준다 → [{ 짝, 묶음, 글, same, similar }] (같거나 닮은 짝만).
 *   편: 원본 편 폴더 · 키: 판본 키 · 줄: 이 판본 글의 줄(없으면 편 폴더에서 읽는다) · 언어: 이 판본 언어 · prep: 준비.json · accounts: 원장 accounts
 * LAB 편(준비.json 브랜드)만 본다.
 */
function 짝견주기({ 편, 키, 줄 = null, 언어 = null, prep, accounts }) {
  if (prep?.브랜드 !== 'LAB') return [];
  const 글들 = 판본글들(편, prep);
  const 내 = { 언어: 언어 || 글들[키]?.언어 || prep?.돌림?.판본?.[키]?.언어 || null, 줄: 줄 || 글들[키]?.줄 || null };
  if (!Array.isArray(내.줄)) return [];
  const 판본언어 = Object.fromEntries(Object.entries(글들).map(([k, v]) => [k, v.언어]));
  판본언어[키] = 내.언어;
  const out = [];
  for (const p of 짝판본(키, 판본언어, accounts)) {
    const 짝글 = 글들[p.키];
    if (!짝글) continue;
    const r = 칸견주기(내.줄, 짝글.줄);
    if (r.same.length || r.similar.length) out.push({ 짝: p.키, 묶음: p.묶음, 글: 짝글.글, same: r.same, similar: r.similar });
  }
  return out;
}

module.exports = { VIDEO_PLATFORMS, COUNTRY_SLOTS, SIMILAR_SLOTS, SIMILAR_AT, 묶음말, 판본키, plainOf, wordsOf, overlapOf, textOf, 칸견주기, 닮음글, 짝판본, 판본글들, 짝견주기 };
