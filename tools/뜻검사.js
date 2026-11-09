#!/usr/bin/env node
'use strict';
/* 언어판 뜻 검사(2026-11-10 LAB 하루 두 편 · 39계정 — 설계 12 · 24, docs/마케팅/LAB_하루두편_설계_20261110/README.md).
 *
 * 원문(한국어)을 주지 않고 판본 글만 화면 순서대로 시험관에게 주고 셋을 묻는다: 한 문장 요약 · 퀴즈 풀기(보기 셋 가운데 정답이 여전히
 * 하나뿐인가) · 웃음 이유. 더해 못 알아들은 줄 · 이 나라에서 불편한 표현 · 화면 결함. 시험관은 Claude 하위 에이전트(sonnet · haiku …)라
 * CLI가 직접 못 부른다 — tools/낯선이시험.js처럼 이 도구는 질문 재료와 채점만 맡고, 세션이 시험관을 띄워 답을 파일로 넣는다.
 *
 *   node tools/뜻검사.js 재료 <판본 글.json> [--편 <원본 편 폴더>] [--밖 <폴더>]
 *   node tools/뜻검사.js 판본 <편 폴더> <판본 키> [--밖 <폴더>]          ← 준비.json 「돌림」.판본[키].글로 재료를 만든다
 *       → <밖>/질문.md(시험관에게 그대로 줄 글 — 파일을 열 필요 없이 다 들었다) · <밖>/재료.json(채점에 쓸 것)
 *         시험관마다 답을 <밖>/답_<시험관>.md로 넣는다(Agent 최종 답 그대로 — 안에 JSON 하나).
 *   node tools/뜻검사.js 채점 <밖 폴더> [--판정 <사람판정.json>] [--기록]
 *       → <밖>/채점.json · 결과(통과 · 확인할 것 · 고칠 것). --기록이면 재료의 편 · 판본으로 준비.json
 *         「돌림」.판본[키].검수.뜻 = { 결과, 지문: <판본 글 SHA-256>, 시각, 도구, 기록, 시험관, 시험관넷, … }을 쓴다
 *         (tools/돌림표.js가 지문으로 무효를 가른다 — 글을 고치면 다시 본다).
 *
 * 시험관(재료.json 「시험관」): 기본 sonnet · haiku 둘. 「시험관 넷」(새 언어 · 문자 체계 첫 3편 · 새 틀 · 문화 소재 · 같은 실수 다시)이면
 * sonnet · haiku · opus · gpt(구독 Codex — 부르는 법은 재료 끝에 찍는다). 그록은 언어판 시험에서 뺀다(설계 24).
 * 채점 규칙(설계 24): 정답 오류(고른 보기가 정답이 아님) · 정답이 하나가 아님(또있음 + 까닭) · 화면 결함은 시험관 하나가 증거와 함께 짚어도
 * 고칠 것. 요약이 기획 한 문장과 다름 · 안 웃김 · 못 알아들은 줄 · 불편한 표현은 둘 이상이 같이 짚으면 고칠 것, 하나면 확인할 것.
 * 요약 견주기: 기준 「핵심」(낱말 묶음 — 판본 글 「기준」, 없으면 퀴즈 정답 원문 · 기획.md 「한 문장」에서 뽑는다) 가운데 요약이
 * 짚은 묶음 비율 0.6 이상 같음 · 0.3 아래 다름 · 그 사이 모호(확인할 것 — 세션이 --판정으로 정한다).
 * 종료 코드: 0 통과 · 1 고칠 것 · 3 확인할 것 · 2 사용법 · 실행 오류.
 */
const fs = require('node:fs');
const path = require('node:path');
const 판본글 = require('./lib/판본글.js');
const 프로필 = require('./lib/현지화프로필.js');

const REPO = path.resolve(__dirname, '..');
const 도구 = 'tools/뜻검사.js';
const 고칠 = '고칠 것', 확인 = '확인할 것', 통과 = '통과';
const 기본시험관 = ['sonnet', 'haiku'];
const 넷시험관 = ['sonnet', 'haiku', 'opus', 'gpt'];
const 웃음칸 = new Set(['딱지', '개그', '해설']);
const 곳이름 = { tiktok: '틱톡', instagram: '인스타 릴스', facebook: '페이스북 릴스', youtube: '유튜브 쇼츠', douyin: '더우인', xiaohongshu: '샤오훙수', vk: 'VK 클립', rutube: '루튜브', telegram: '텔레그램' };

function kst(ms = Date.now()) {
  return new Date(ms + 9 * 3600 * 1000).toISOString().replace(/\.\d+Z$/, '+09:00');
}
const rel = (p) => path.relative(REPO, p).split(path.sep).join('/');
const 찾음 = (수준, 코드, 말, 덧 = {}) => ({ 수준, 코드, 말, ...덧 });

// ── 견주기 ────────────────────────────────────────────────────────────────
const 맞춤 = (s) => String(s || '').normalize('NFC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
const 꼬리 = ['입니다', '이에요', '에서', '에게', '으로', '이다', '해요', '예요', '하다', '한다', '했다', '하는', '이', '가', '은', '는', '을', '를', '에', '의', '도', '로', '와', '과', '만', '요', '다', '음', '기', '게'];
const 용언끝 = new Set(['는', '은', '을', '던', '었', '았', '겠', '고', '게', '지', '어', '아', '여', '운', '울', '긴', '길']);
const 빈말 = new Set(['아주', '매우', '정말', '너무', '그것', '이것', '저것', '그리고', '또는', '하지만', '영상', '한국어', '한국', '말', '것', '수', '때', '등', '같은', '있는', '없는', '하는', '되는']);

/** 한국어 낱말 → 견줄 줄기(조사 · 어미 하나를 떼고, 두 글자 넘게 남을 때만). */
function 줄기(낱말) {
  let w = 맞춤(낱말);
  for (const t of 꼬리) {
    if (w.endsWith(t) && [...w].length - [...t].length >= 2) { w = w.slice(0, w.length - t.length); break; }
  }
  return w;
}
function 낱말들(글) {
  return String(글 || '').split(/[\s\p{P}\p{S}]+/u).filter(Boolean).filter((w) => !빈말.has(w) && [...맞춤(w)].length >= 2);
}

/** 기준 → 핵심 낱말 묶음들. 판본 글 「기준.핵심」이 있으면 그것, 없으면 퀴즈 정답 원문 · 한 문장에서 뽑는다. */
function 핵심묶음(재료) {
  const 기준 = 재료.기준 || {};
  if (Array.isArray(기준.핵심) && 기준.핵심.length) return { 묶음: 기준.핵심.map((g) => [].concat(g).map(맞춤).filter(Boolean)), 출처: '판본 글 기준.핵심' };
  // 퀴즈는 문제마다 정답 원문(진짜 뜻)의 줄기 한 묶음. 관용구 이름은 넣지 않는다 — 이름만 대고 뜻을 모르는 요약을 「같음」으로 세지 않게.
  // 용언 줄기(웃는 · 먹은 …)는 끝 음절을 뗀 뿌리(웃)도 같이 본다 — 「웃긴다」 · 「웃겨서」도 짚은 것으로.
  const 묶음 = [];
  for (const q of 재료.퀴즈 || []) {
    const 열쇠 = [];
    for (const s of 낱말들(q.정답원문 || '').map(줄기).filter((w) => [...w].length >= 2)) {
      열쇠.push(s);
      const 글자 = [...s];
      if (글자.length >= 2 && 용언끝.has(글자[글자.length - 1])) 열쇠.push(글자.slice(0, -1).join(''));
    }
    if (열쇠.length) 묶음.push([...new Set(열쇠)]);
  }
  if (묶음.length) return { 묶음, 출처: '퀴즈 정답 원문' };
  const 한문장 = 기준.한문장 || '';
  const 줄기들 = [...new Set(낱말들(한문장).map(줄기).filter((w) => [...w].length >= 2))];
  return { 묶음: 줄기들.map((w) => [w]), 출처: 한문장 ? '한 문장' : '없음' };
}

/** 요약 → 같음 · 다름 · 모호 */
function 요약견주기(요약, 재료) {
  const { 묶음, 출처 } = 핵심묶음(재료);
  if (!묶음.length) return { 판정: '모호', 비율: null, 짚은: [], 출처, 까닭: '견줄 기준(한 문장 · 핵심)이 없다' };
  const s = 맞춤(요약);
  const 짚은 = 묶음.filter((g) => g.some((w) => w && s.includes(w)));
  const 비율 = 짚은.length / 묶음.length;
  const 판정 = !s ? '다름' : 비율 >= 0.6 ? '같음' : 비율 < 0.3 ? '다름' : '모호';
  return { 판정, 비율: Math.round(비율 * 100) / 100, 짚은: 짚은.map((g) => g[0]), 빠진: 묶음.filter((g) => !짚은.includes(g)).map((g) => g[0]), 출처 };
}

/** 웃음 → 같음 · 다름 · 안 웃김 · 모호 */
function 웃음견주기(웃음, 재료) {
  if (!웃음 || typeof 웃음 !== 'object') return { 판정: '모호', 까닭: '웃음 답이 없다' };
  if (웃음.웃김 === false) return { 판정: '안 웃김', 까닭: 웃음.까닭 || '' };
  const 줄들 = [].concat(웃음.줄 || []).map(Number).filter((n) => n >= 1);
  const 웃음줄 = (재료.줄 || []).filter((z) => z.웃음).map((z) => z.번호);
  if (줄들.some((n) => 웃음줄.includes(n))) return { 판정: '같음', 까닭: `웃음 칸 줄(${줄들.join(', ')})을 짚었다` };
  const 기준말 = 낱말들(재료.기준?.웃음 || '').map(줄기).filter((w) => [...w].length >= 2);
  const s = 맞춤(`${웃음.까닭 || ''} ${웃음.자리 || ''}`);
  if (기준말.length && 기준말.some((w) => s.includes(w))) return { 판정: '같음', 까닭: '기획의 재미 자리 낱말을 짚었다' };
  if (!줄들.length && !기준말.length) return { 판정: '모호', 까닭: '견줄 웃음 줄 · 기획 재미 칸이 없다' };
  return { 판정: '다름', 까닭: `다른 자리를 웃음으로 봤다(줄 ${줄들.join(', ') || '없음'})` };
}

/** 답 글에서 JSON 하나를 꺼낸다(코드 울타리 · 앞뒤 말 허용). */
function 답읽기(text) {
  const t = String(text || '').replace(/^﻿/, '');
  const 울 = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  const 몸 = 울 ? 울[1] : t;
  const a = 몸.indexOf('{'), b = 몸.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('답에 JSON이 없다');
  return JSON.parse(몸.slice(a, b + 1));
}

const 글자번호 = (x) => {
  if (x === null || x === undefined || x === '') return null;
  if (typeof x === 'number') return x;
  const s = String(x).trim().toUpperCase();
  if (/^\d+$/.test(s)) return Number(s);
  const m = s.match(/^[A-Z]/);
  return m ? m[0].charCodeAt(0) - 64 : null;
};

// ── 시험관 넷 판단 ────────────────────────────────────────────────────────
const 문자갈래 = (문자) => (/라틴/.test(문자) ? '라틴' : /키릴/.test(문자) ? '키릴' : /한자|가나/.test(문자) ? '한자' : /아부기다/.test(문자) ? '아부기다' : 문자 || '모름');

/** 저장소의 지난 뜻 검사 기록(돌림.판본.*.검수.뜻) — 편 폴더마다 */
function 지난기록(뿌리 = process.env.SYNK_MARKETING_DIR || path.join(REPO, 'docs', '마케팅')) {
  const out = [];
  let names = [];
  try { names = fs.readdirSync(뿌리, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return out; }
  for (const name of names) {
    const f = path.join(뿌리, name, '게시', '준비.json');
    if (!fs.existsSync(f)) continue;
    let prep;
    try { prep = 판본글.readJson(f); } catch { continue; }
    for (const [키, v] of Object.entries(prep.돌림?.판본 || {})) {
      const 뜻 = v.검수?.뜻;
      if (뜻) out.push({ 편: name, 판본: 키, 언어: 뜻.언어 || v.언어, 문자: 뜻.문자 || null, 틀: 뜻.틀 || prep.돌림?.틀 || prep.돌림?.형식 || null, 결과: 뜻.결과, 걸린것: 뜻.걸린것 || [], 다음은넷: Boolean(뜻.다음은넷), 시각: 뜻.시각 || '' });
    }
  }
  return out;
}

/** 시험관 넷인가 — 새 언어 · 문자 체계 첫 3편 · 새 틀 · 문화 소재 · 같은 실수 다시(설계 9 · 12) */
function 넷판단({ 언어, 틀, 문화소재 = false, 딱지경고 = [], 기록 = [] }) {
  const L = 프로필.언어(언어);
  const 갈래 = 문자갈래(L?.문자);
  const 까닭 = [];
  const 통과들 = 기록.filter((r) => r.결과 === 통과);
  if (!통과들.some((r) => r.언어 === 언어)) 까닭.push(`새 언어(${L?.이름 || 언어} 뜻 검사 통과 기록 없음)`);
  const 같은문자 = 통과들.filter((r) => 문자갈래(r.문자 || 프로필.언어(r.언어)?.문자) === 갈래).length;
  if (같은문자 < 3) 까닭.push(`문자 체계(${갈래}) 첫 3편 — 지금까지 ${같은문자}편`);
  if (틀 && !통과들.some((r) => r.언어 === 언어 && r.틀 === 틀)) 까닭.push(`새 틀(${틀} — 이 언어 통과 기록 없음)`);
  if (문화소재) 까닭.push('문화 소재(판본 글 「문화소재」)');
  if (딱지경고.length) 까닭.push(`문화 소재(관용구 대응 경고 ${딱지경고.length}개)`);
  const 마지막 = 기록.filter((r) => r.언어 === 언어).sort((a, b) => String(b.시각).localeCompare(String(a.시각)))[0];
  if (마지막?.다음은넷) 까닭.push(`같은 실수가 다시 나옴(지난 ${마지막.편} · ${마지막.판본})`);
  return { 넷: 까닭.length > 0, 까닭 };
}

// ── 재료 ─────────────────────────────────────────────────────────────────
function 재료만들기(글파일, { 편 = null, 밖, 기록 = null } = {}) {
  const 판 = 판본글.읽기(글파일);
  const d = 판.자료;
  const L = 프로필.언어(d.언어);
  if (!L) throw new Error(`언어 프로필에 없는 언어: ${d.언어}`);
  const 나라들 = [].concat(d.나라 || L.나라 || []);
  const 나라이름 = 나라들.map((cc) => 프로필.나라(cc)?.이름).filter(Boolean);
  // 화면 순서 — 모든 줄에 초가 있으면 시작 초 순, 아니면 파일 순서(게시글은 화면 글이 아니라 뺀다)
  const 화면줄 = 판.줄.filter((z) => z.칸 !== '게시글');
  const 다초 = 화면줄.every((z) => Array.isArray(z.초));
  const 줄들 = 다초 ? 화면줄.map((z, i) => ({ z, i })).sort((a, b) => a.z.초[0] - b.z.초[0] || a.i - b.i).map(({ z }) => z) : 화면줄;
  const 번호 = new Map();
  const 보일줄 = [];
  let 앞장면 = null;
  for (const z of 줄들) {
    const n = 번호.size + 1;
    번호.set(z.id, n);
    const 초 = Array.isArray(z.초) ? `${z.초[0]}초` : '';
    // 그림 설명은 그 줄 끝에 붙인다(11-10 실측: 줄 사이에 따로 두니 시험관이 앞 줄의 그림으로 읽었다)
    const 그림 = z.장면 && z.장면 !== 앞장면 ? `   [그림: ${z.장면}]` : '';
    if (z.장면) 앞장면 = z.장면;
    if (판본글.한국어칸.has(z.칸)) 보일줄.push(`${n}. ${초 ? `(${초}) ` : ''}[한국어 글 · 소리 — 너는 아직 뜻을 모른다]${그림}`);
    else 보일줄.push(`${n}. ${초 ? `(${초}) ` : ''}${String(z.글).replace(/\n/g, ' / ')}${그림}`);
  }
  const 퀴즈 = (d.퀴즈 || []).map((q) => {
    const 보기 = q.보기.map((id) => 번호.get(id));
    const 정답줄 = 판.줄.find((z) => z.id === q.보기[q.정답 - 1]);
    return { 문제: q.문제, 관용구: q.관용구 || null, 보기, 보기id: q.보기, 정답: q.정답, 정답원문: 정답줄?.원문 || '', 딱지: q.딱지 ? 번호.get(q.딱지) : null };
  });
  const 기획 = 편 ? 판본글.기획기준(편) : { 한문장: null, 웃음: null };
  const 기준 = { 한문장: d.기준?.한문장 || 기획.한문장 || null, 핵심: d.기준?.핵심 || null, 웃음: d.기준?.웃음 || 기획.웃음 || null, 기획: 기획.파일 ? rel(기획.파일) : null };
  const 딱지경고 = 퀴즈.filter((q) => q.관용구).map((q) => 프로필.오답딱지경고(q.관용구, L.코드)).filter(Boolean);
  const 이편 = 편 ? path.basename(path.resolve(편)) : d.편 || null;
  const 넷 = 넷판단({ 언어: L.코드, 틀: d.틀 || null, 문화소재: Boolean(d.문화소재), 딱지경고, 기록: (기록 || 지난기록()).filter((r) => !(r.편 === 이편 && r.판본 === d.판본)) });
  const 시험관 = 넷.넷 ? 넷시험관 : 기본시험관;
  const 곳 = d.곳 || (d.플랫폼 ? 곳이름[d.플랫폼] : null) || '짧은 영상 앱';
  const 질문 = [
    `너는 ${나라이름.join(' · ') || L.이름 + ' 쓰는 나라'} 사람이고 ${L.이름}로 생각한다. 한국어는 이제 막 배우기 시작해서 한글과 한국어 소리는 아직 뜻을 모른다. ${곳}에서 한국어를 가르치는 짧은 영상을 처음 봤다.`,
    '아래는 그 영상 화면에 나온 글을 나온 순서대로 적은 것이다. 줄 끝 [그림: …]은 그 줄이 나올 때 화면에 보이는 그림이고, [한국어 …] 줄은 한국어 글 · 소리라 너는 뜻을 모른다(그 줄을 모른다고 적지 않아도 된다). 이 글만 보고 답해라 — 파일 · 인터넷 · 도구는 쓰지 않는다.',
    '',
    ...보일줄,
    '',
    ...(퀴즈.length ? ['이 영상의 퀴즈:', ...퀴즈.map((q) => `- 문제 ${q.문제}: ${q.보기.map((n, k) => `${String.fromCharCode(65 + k)}(줄 ${n})`).join(' · ')}`), ''] : []),
    '아래 JSON 하나로만 답해라(앞뒤 설명 없이, 한국어로). 모르는 것은 모른다고 쓰고 겉치레 칭찬은 하지 않는다.',
    '{',
    '  "요약": "이 영상이 말하려는 것 — 친구에게 전하듯 한 문장",',
    ...(퀴즈.length ? [
      '  "풀기": [{"문제": 1, "고름": "A · B · C 가운데 진짜 뜻에 맞는 보기 하나", "까닭": "몇 번 줄 때문에"}],',
      '  "유일": [{"문제": 1, "또있음": null 또는 "그 문제에서 함께 맞을 수 있는 다른 보기(A · B · C)", "까닭": "또있음이면 왜 그 보기도 맞는지"}],',
    ] : []),
    '  "웃음": {"웃김": true 또는 false, "줄": [웃기려는 자리의 줄 번호], "까닭": "왜 웃긴지(안 웃기면 왜 안 웃긴지)"},',
    '  "모름줄": [{"줄": 줄 번호, "까닭": "무슨 말인지 모르겠는 까닭 — 박자 · 길이 · 흐름 불만도 여기"}],',
    '  "불편": [{"줄": 줄 번호, "까닭": "이 나라 사람으로서 불편하거나 거슬리는 표현 · 그림"}],',
    '  "결함": [{"줄": 줄 번호, "까닭": "글 자체가 망가진 것만 — 네모 · 이상한 기호로 보이는 글자, 다른 언어 글자가 섞임, 문장이 중간에 끊김, 같은 말이 두 번"}]',
    '}',
    '없는 칸은 빈 목록 []으로 둔다. 결함은 글이 망가진 것만 적는다(뜻 · 박자 불만은 모름줄).',
    '',
  ].join('\n');
  fs.mkdirSync(밖, { recursive: true });
  for (const f of fs.readdirSync(밖)) if (/^답_.*\.md$/.test(f) || f === '채점.json') fs.rmSync(path.join(밖, f), { force: true });
  fs.writeFileSync(path.join(밖, '질문.md'), 질문);
  const 재료 = {
    도구, 시각: kst(), 글: path.resolve(글파일), 지문: 판.지문, 편: 편 ? path.basename(path.resolve(편)) : d.편 || null, 편폴더: 편 ? path.resolve(편) : null,
    판본: d.판본 || null, 언어: L.코드, 문자: L.문자, 나라: 나라들, 틀: d.틀 || null, 기준, 퀴즈,
    줄: 줄들.map((z) => ({ 번호: 번호.get(z.id), id: z.id, 칸: z.칸, 웃음: 웃음칸.has(z.칸) || z.대조 === '웃음' })),
    딱지경고, 시험관, 시험관넷: 넷,
  };
  fs.writeFileSync(path.join(밖, '재료.json'), JSON.stringify(재료, null, 2) + '\n');
  return 재료;
}

function 부르는법(밖, 시험관) {
  const q = path.join(밖, '질문.md');
  return 시험관.map((s) => (s === 'gpt'
    ? `  gpt    → node tools/codex계정.js exec --skip-git-repo-check -C <빈 폴더> -s read-only -o "${path.join(밖, '답_gpt.md')}" - < "${q}"`
    : `  ${s.padEnd(6)} → 이 대화 맥락이 없는 새 Agent(model: ${s})에게 질문.md 내용을 그대로 주고, 최종 답을 ${path.join(밖, `답_${s}.md`)}에 넣는다`)).join('\n');
}

// ── 채점 ─────────────────────────────────────────────────────────────────
function 채점하기(밖, { 사람판정 = {} } = {}) {
  const 재료 = 판본글.readJson(path.join(밖, '재료.json'));
  const out = [];
  const 시험관답 = {};
  for (const s of 재료.시험관) {
    const f = path.join(밖, `답_${s}.md`);
    if (!fs.existsSync(f)) { out.push(찾음(확인, '답없음', `시험관 ${s}의 답이 없다(${path.basename(f)})`)); continue; }
    try { 시험관답[s] = 답읽기(fs.readFileSync(f, 'utf8')); } catch (e) { out.push(찾음(확인, '답못읽음', `시험관 ${s}의 답을 못 읽었다(${e.message})`)); }
  }
  // 재료에 없는 시험관이 답을 넣었으면 같이 센다
  for (const f of fs.readdirSync(밖)) {
    const m = f.match(/^답_(.+)\.md$/);
    if (m && !시험관답[m[1]] && !재료.시험관.includes(m[1])) { try { 시험관답[m[1]] = 답읽기(fs.readFileSync(path.join(밖, f), 'utf8')); } catch { /* 넣은 답이 깨졌으면 뺀다 */ } }
  }
  const id = (n) => 재료.줄.find((z) => z.번호 === Number(n))?.id || `줄 ${n}`;
  // 한국어 · 읽기 줄은 시험관이 못 읽는 게 정상이다 — 그 줄의 「모름줄」 · 「결함」은 세지 않는다(11-10 실측: 둘 다 한국어 줄을 짚어 「같이 짚음」이 났다)
  const 한국어줄 = (n) => 판본글.한국어칸.has(재료.줄.find((z) => z.번호 === Number(n))?.칸);
  const 시험관별 = {};
  const 줄짚음 = { 모름줄: new Map(), 불편: new Map() };
  const 요약다름 = [], 요약모호 = [], 웃음안됨 = [], 웃음모호 = [];
  for (const [s, a] of Object.entries(시험관답)) {
    const 요약 = 요약견주기(a.요약, 재료);
    const 웃음 = 웃음견주기(a.웃음, 재료);
    const 사람 = 사람판정[s] || {};
    if (사람.요약) { 요약.판정 = 사람.요약; 요약.사람 = true; }
    if (사람.웃음) { 웃음.판정 = 사람.웃음; 웃음.사람 = true; }
    시험관별[s] = { 요약: { 글: a.요약 || '', ...요약 }, 웃음: { ...웃음, 줄: a.웃음?.줄 || [] }, 풀기: [] };
    if (요약.판정 === '다름') 요약다름.push(s); else if (요약.판정 === '모호') 요약모호.push(s);
    if (웃음.판정 === '안 웃김' || 웃음.판정 === '다름') 웃음안됨.push(s); else if (웃음.판정 === '모호') 웃음모호.push(s);
    for (const q of 재료.퀴즈 || []) {
      const 답 = [].concat(a.풀기 || []).find((x) => Number(x.문제) === Number(q.문제));
      const 고름 = 글자번호(답?.고름);
      시험관별[s].풀기.push({ 문제: q.문제, 고름, 맞음: 고름 === q.정답 });
      if (!답 || !고름) out.push(찾음(확인, '풀기없음', `${s}: 문제 ${q.문제}를 풀지 않았다`, { 시험관: s }));
      else if (고름 !== q.정답) {
        out.push(찾음(고칠, '정답오류', `${s}가 문제 ${q.문제}에서 ${String.fromCharCode(64 + 고름)}(${id(q.보기[고름 - 1])})를 골랐다 — 정답은 ${String.fromCharCode(64 + q.정답)}(${id(q.보기[q.정답 - 1])}). 까닭: ${답.까닭 || '(없음)'}`, { 시험관: s, 줄: q.보기id[q.정답 - 1] }));
      }
      const 유 = [].concat(a.유일 || []).find((x) => Number(x.문제) === Number(q.문제));
      const 또 = 글자번호(유?.또있음);
      if (또 && 또 !== q.정답) {
        out.push(찾음(유.까닭 ? 고칠 : 확인, '유일성', `${s}: 문제 ${q.문제}에서 ${String.fromCharCode(64 + 또)}(${id(q.보기[또 - 1])})도 맞을 수 있다 — ${유.까닭 || '까닭 없음'}`, { 시험관: s, 줄: q.보기id[또 - 1] }));
      }
    }
    for (const 칸 of ['모름줄', '불편']) {
      for (const x of [].concat(a[칸] || [])) {
        if (!x || x.줄 === undefined) continue;
        if (칸 === '모름줄' && 한국어줄(x.줄)) continue;
        const k = id(x.줄);
        if (!줄짚음[칸].has(k)) 줄짚음[칸].set(k, []);
        줄짚음[칸].get(k).push(`${s}: ${x.까닭 || ''}`);
      }
    }
    for (const x of [].concat(a.결함 || [])) {
      if (!x || x.줄 === undefined || 한국어줄(x.줄)) continue;
      out.push(찾음(고칠, '화면결함', `${s}가 화면 결함을 짚었다 — ${id(x.줄)}: ${x.까닭 || ''}`, { 시험관: s, 줄: id(x.줄) }));
    }
  }
  const n = Object.keys(시험관답).length;
  if (요약다름.length >= 2) out.push(찾음(고칠, '요약다름', `시험관 ${요약다름.join(' · ')}의 요약이 기준과 다르다(${재료.기준?.한문장 || '핵심 낱말'})`));
  else if (요약다름.length === 1) out.push(찾음(확인, '요약다름', `시험관 ${요약다름[0]}의 요약이 기준과 다르다 — 「${시험관별[요약다름[0]].요약.글}」`));
  for (const s of 요약모호) out.push(찾음(확인, '요약모호', `시험관 ${s}의 요약이 기준과 같은지 가르지 못했다(짚은 핵심 ${시험관별[s].요약.비율 ?? '-'}) — 「${시험관별[s].요약.글}」. --판정으로 정한다`));
  if (웃음안됨.length >= 2) out.push(찾음(고칠, '웃음안됨', `시험관 ${웃음안됨.join(' · ')}가 웃음 자리를 못 찾거나 안 웃기다고 했다`));
  else if (웃음안됨.length === 1) out.push(찾음(확인, '웃음안됨', `시험관 ${웃음안됨[0]}: ${시험관별[웃음안됨[0]].웃음.판정} — ${시험관별[웃음안됨[0]].웃음.까닭}`));
  for (const s of 웃음모호) out.push(찾음(확인, '웃음모호', `시험관 ${s}의 웃음 답을 가르지 못했다 — --판정으로 정한다`));
  for (const [칸, map] of Object.entries(줄짚음)) {
    for (const [k, list] of map) {
      const 코드 = 칸 === '모름줄' ? '같이짚음' : '불편';
      if (list.length >= 2) out.push(찾음(고칠, 코드, `${k}를 시험관 ${list.length}이 같이 짚었다 — ${list.join(' / ')}`, { 줄: k }));
      else out.push(찾음(확인, 코드, `${k} — ${list[0]}`, { 줄: k }));
    }
  }
  for (const w of 재료.딱지경고 || []) out.push(찾음(w.수준, '오답딱지', w.말));
  if (n < (재료.시험관 || []).length) out.push(찾음(확인, '시험관모자람', `시험관 ${재료.시험관.length} 가운데 ${n}의 답만 있다`));
  const 결과 = out.some((f) => f.수준 === 고칠) ? 고칠 : out.some((f) => f.수준 === 확인) ? 확인 : 통과;
  const 걸린것 = [...new Set(out.filter((f) => f.수준 === 고칠).map((f) => f.코드))];
  const 기록 = 지난기록().filter((r) => r.언어 === 재료.언어 && r.결과 === 고칠 && !(r.편 === 재료.편 && r.판본 === 재료.판본));
  const 다시 = 걸린것.filter((c) => 기록.some((r) => (r.걸린것 || []).includes(c)));
  const 채점 = { 도구, 시각: kst(), 글: 재료.글, 지문: 재료.지문, 편: 재료.편, 판본: 재료.판본, 언어: 재료.언어, 결과, 찾음: out, 시험관별, 걸린것, 다음은넷: 다시.length > 0, 다시나온것: 다시, 시험관넷: 재료.시험관넷 };
  fs.writeFileSync(path.join(밖, '채점.json'), JSON.stringify(채점, null, 2) + '\n');
  return { 재료, 채점 };
}

function 보이기(채점, 밖) {
  console.log(`뜻 검사 · ${채점.편 || ''} ${채점.판본 || ''} · ${채점.언어} · ${채점.결과}`);
  for (const 수준 of [고칠, 확인]) {
    const xs = 채점.찾음.filter((f) => f.수준 === 수준);
    if (xs.length) { console.log(`${수준} ${xs.length}`); xs.forEach((f) => console.log(`  ${수준 === 고칠 ? '✗' : '?'} ${f.말}`)); }
  }
  for (const [s, v] of Object.entries(채점.시험관별)) console.log(`  ${s}: 요약 ${v.요약.판정}(${v.요약.비율 ?? '-'}) · 웃음 ${v.웃음.판정} · 풀기 ${v.풀기.map((p) => (p.맞음 ? 'O' : 'X')).join('') || '-'}`);
  if (채점.다음은넷) console.log(`  다음 판은 시험관 넷 — 같은 실수가 다시 나왔다(${채점.다시나온것.join(' · ')})`);
  console.log(`  채점: ${rel(path.join(밖, '채점.json'))}`);
}

const 종료코드 = (결과) => (결과 === 고칠 ? 1 : 결과 === 확인 ? 3 : 0);

function main(argv) {
  const 위치 = [], 값 = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--기록') 값.기록 = true;
    else if (argv[i].startsWith('--')) { 값[argv[i].slice(2)] = argv[i + 1]; i += 1; } else 위치.push(argv[i]);
  }
  const 명령 = 위치[0];
  const 쓰는법 = '쓰는 법: node tools/뜻검사.js 재료 <판본 글.json> [--편 <원본 편 폴더>] [--밖 <폴더>] | 판본 <편 폴더> <판본 키> [--밖 <폴더>] | 채점 <밖 폴더> [--판정 <json>] [--기록]';
  const 도장 = kst().replace(/[-:]/g, '').slice(0, 13);
  if (명령 === '재료' || 명령 === '판본') {
    let 글파일, 편 = 값.편 || null, 키 = null;
    if (명령 === '판본') {
      [, 편, 키] = 위치;
      if (!편 || !키) { console.error(쓰는법); return 2; }
      const 찾은 = 판본글.판본찾기(편, 키);
      if (!찾은.글 || !fs.existsSync(찾은.글)) { console.error(`판본 ${키}의 「글」 파일이 없다(${찾은.판본.글 || '칸 없음'})`); return 2; }
      글파일 = 찾은.글;
    } else {
      글파일 = 위치[1];
      if (!글파일) { console.error(쓰는법); return 2; }
    }
    const 이름 = 편 ? `${path.basename(path.resolve(편))}/${키 || path.basename(글파일, '.json')}` : `${path.basename(글파일, '.json')}-${도장}`;
    const 밖 = path.resolve(값.밖 || path.join(REPO, '.tmp', '뜻검사', 이름));
    const 재료 = 재료만들기(글파일, { 편, 밖 });
    if (키 && !재료.판본) { 재료.판본 = 키; fs.writeFileSync(path.join(밖, '재료.json'), JSON.stringify(재료, null, 2) + '\n'); }
    console.log(`재료: ${rel(밖)} · ${재료.언어} · 줄 ${재료.줄.length} · 퀴즈 ${재료.퀴즈.length}문제 · 기준 「${재료.기준.한문장 || '없음'}」`);
    console.log(`시험관 ${재료.시험관.length}${재료.시험관넷.넷 ? ` — 시험관 넷: ${재료.시험관넷.까닭.join(' · ')}` : ''}`);
    for (const w of 재료.딱지경고) console.log(`  ${w.수준 === 고칠 ? '✗' : '?'} ${w.말}`);
    console.log('다음 — 서로 답을 보이지 않고:');
    console.log(부르는법(밖, 재료.시험관));
    console.log(`그다음: node tools/뜻검사.js 채점 "${밖}"${재료.편폴더 ? ' --기록' : ''}`);
    return 0;
  }
  if (명령 === '채점') {
    const 밖 = 위치[1] && path.resolve(위치[1]);
    if (!밖 || !fs.existsSync(path.join(밖, '재료.json'))) { console.error(`${쓰는법}\n  (재료.json이 있는 폴더)`); return 2; }
    const 사람판정 = 값.판정 ? 판본글.readJson(값.판정) : {};
    const { 재료, 채점 } = 채점하기(밖, { 사람판정 });
    if (값.기록) {
      if (!재료.편폴더 || !재료.판본) { console.error('재료에 편 폴더 · 판본이 없어 기록하지 못했다 — 「판본」 명령이나 --편으로 재료를 만든다'); return 2; }
      const 지금지문 = 판본글.sha256(재료.글);
      if (지금지문 !== 재료.지문) { console.error(`재료를 만든 뒤 판본 글이 바뀌었다 — 재료부터 다시 만든다(${rel(재료.글)})`); return 2; }
      const 기록 = { 결과: 채점.결과, 지문: 재료.지문, 시각: 채점.시각, 도구, 기록: rel(path.join(밖, '채점.json')), 시험관: Object.keys(채점.시험관별), 시험관넷: 재료.시험관넷.넷,
        언어: 재료.언어, 문자: 재료.문자, 틀: 재료.틀, 걸린것: 채점.걸린것 };
      if (채점.다음은넷) 기록.다음은넷 = true;
      const 준비 = 판본글.검수쓰기(재료.편폴더, 재료.판본, '뜻', 기록);
      console.log(`준비.json 「돌림」.판본[${재료.판본}].검수.뜻 = ${채점.결과} (${rel(준비)})`);
    }
    보이기(채점, 밖);
    return 종료코드(채점.결과);
  }
  console.error(쓰는법);
  return 2;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exitCode = 2; }
}

module.exports = { main, 재료만들기, 채점하기, 요약견주기, 웃음견주기, 핵심묶음, 답읽기, 줄기, 넷판단, 지난기록, 문자갈래, 기본시험관, 넷시험관 };
