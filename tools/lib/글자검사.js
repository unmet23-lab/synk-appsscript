'use strict';
/* 글자 검사(2026-11-10 LAB 하루 두 편 · 39계정 — 설계 11, docs/마케팅/LAB_하루두편_설계_20261110/README.md). 읽기만 한다.
 *
 * 렌더 전(판본 글 → 규칙 · 글꼴 · 엔진):
 *   규칙검사  — 정규화 · 보이지 않는 글자 · 섞인 문자(라틴 · 키릴 생김새가 같은 글자) · 결합 글자가 바탕 없이 시작 · 손으로 넣은 줄바꿈의
 *               줄머리 금칙 · 낱말 중간 줄바꿈 · 문장부호(언어 프로필 「틀린꼴」 · 전각 · 스페인어 여는 부호) · 번역 빠짐 · 읽기 시간
 *   글꼴검사  — tools/lib/글꼴재기.py(fontTools cmap + HarfBuzz): 네모 글자 · 결합 깨짐(점선 원) · 라틴 글꼴이 맡은 한자권 부호 · 폭 어림
 *   엔진재기  — 크롬(tools/lib/크롬조종.js, Remotion과 같은 Chromium 조판)으로 상자마다 줄 수 · 줄 폭 · 줄바꿈 자리 · 실제 쓰인 글꼴
 *               (CSS.getPlatformFontsForNode)을 재어 상자 넘침 · 테두리 닿음 · 엔진 줄바꿈의 낱말 중간 · 줄머리 금칙 · 시스템 대체 글꼴 · 안전 영역
 * 렌더 뒤(영상 프레임):
 *   프레임검사 — 0.5초마다 프레임. 글 자리 = 그 언어 OCR 상자(언어 프로필 글자인식.쓸만함일 때) ∪ 기준 영상과의 픽셀 차이 덩어리
 *               (기준 둘이면 둘 다와 다른 곳만 — 기준 글자가 빠진다). 안전 영역(tools/올리기전검사.js SAFE = SNS 키트 cover916) 밖이면
 *               플랫폼 단추 · 글 자리 가림. 넘은 자리가 기준 판 OCR 글 상자 안이면 기준 판 글일 수 있어 확인할 것으로 내린다
 *               (그래서 기준 판은 다른 말 판만 쓴다 — tools/글자검사.js 기준고르기). 글자 인식을 못 믿는 언어는 늘 「인식못함」(못 봄)이다.
 *               여백이 가장 좁은 프레임 셋을 원본 해상도로 잘라(1:1) 파일로 남긴다 — 사람 · 세션이 눈으로 본다.
 * 결과 수준: 고칠 것 · 확인할 것. 확인할 것은 두 갈래다(11-11 Fable 5.2 끝 판 검수 P2-5 — 「검사를 못 했다」도 메모 하나로 통과됐다):
 *   판단 — 기계가 재고 사람이 그대로 둘지 정한다(읽기 시간 · 테두리 닿음 · 기준 판과 같은 자리 넘침 · 좁은 여백 …) → 눈확인 메모로 넘긴다.
 *   못봄 — 기계가 그 칸을 아예 못 쟀다(글없음 · 엔진못함 · 엔진잼없음 · 인식못함 …) → 눈확인으로는 못 넘기고,
 *          「어느 프레임(초)에서 무엇을 봤는지」를 적은 직접봄 메모가 있어야 넘긴다. 코드 → 갈래는 아래 갈래표.
 * 판정 = 고칠 것이 있으면 「고칠 것」, 넘기지 못한 확인할 것이 있으면 「확인할 것」, 없으면 「통과」.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const 프로필 = require('./현지화프로필.js');
const 판본글 = require('./판본글.js');

const REPO = path.resolve(__dirname, '..', '..');
const 고칠 = '고칠 것';
const 확인 = '확인할 것';
const 통과 = '통과';
const 한국어칸 = 판본글.한국어칸;
const 자소 = new Intl.Segmenter('und', { granularity: 'grapheme' });
const 한글식 = /[ᄀ-ᇿㄱ-ㆎ가-힣]/u;
// 이모지 변형 선택자(U+FE0F 등) · 키캡(U+20E3)은 결합 부호(Mn)지만 기호 뒤에 붙는 게 정상이라 뺀다(❤️ · 1️⃣)
const 결합시작식 = /^(?![︀-️⃣])\p{M}/u;
const 결합뒤식 = /[\s\p{P}\p{S}](?![︀-️⃣])\p{M}/u;
const 안보임 = [0x200B, 0x200C, 0x200D, 0x2060, 0xFEFF, 0x00AD];

function 찾음(수준, 코드, 말, 덧 = {}) { return { 수준, 코드, 말, ...덧 }; }
const 자소수 = (s) => [...자소.segment(String(s).replace(/\n/g, ''))].length;
const 줄임 = (s, n = 24) => { const t = String(s).replace(/\n/g, '⏎'); return [...t].length > n ? [...t].slice(0, n).join('') + '…' : t; };

/** SNS 키트 안전 영역 — tools/올리기전검사.js ⑤의 SAFE를 그대로 쓴다(못 읽으면 같은 값). */
let safeCache = null;
function 안전영역() {
  if (!safeCache) {
    try { safeCache = { ...require('../올리기전검사.js').SAFE }; } catch { safeCache = { left: 65, right: 920, top: 269, bottom: 1428 }; }
  }
  return safeCache;
}
const 자리말 = { right: '오른쪽 단추 자리', bottom: '아래 글 자리(캡션 · 계정 이름)', top: '위 머리 자리', left: '왼쪽 가장자리' };
const 플랫폼말 = { tiktok: '틱톡', instagram: '릴스', facebook: '페이스북 릴스', youtube: '쇼츠', douyin: '더우인', xiaohongshu: '샤오훙수', vk: 'VK 클립', rutube: '루튜브', telegram: '텔레그램' };

function 범위식(ranges) {
  const parts = (ranges || []).map((r) => {
    const [a, b] = String(r).split('-');
    return b ? `\\u{${a}}-\\u{${b}}` : `\\u{${a}}`;
  });
  return parts.length ? new RegExp(`[${parts.join('')}]`, 'u') : null;
}

function 낱말경계들(글, 코드) {
  const seg = new Intl.Segmenter(코드, { granularity: 'word' });
  const out = new Set([0, 글.length]);
  for (const s of seg.segment(글)) { out.add(s.index); out.add(s.index + s.segment.length); }
  return out;
}

// ── 띄어 쓰는 언어의 손 줄바꿈 ─────────────────────────────────────────────
// 띄어 쓰는 언어의 손 줄바꿈은 공백 자리(낱말 사이)로 보지만, 줄바꿈에 닿은 조각이 낱말이 못 되면 낱말을 자른 것이다
// (11-11 Fable 5.2 끝 판 검수 P2-5 하위 탐침 — 「Do not ea⏎t it!」 · 「Đừng ă⏎n!」 · 「Не еш⏎ь!」를 못 잡았다). 사전 없이 보는 어림이라 확인할 것(판단)이다.
//   ① 라틴 · 키릴 조각에 모음 글자가 없다(한 자음 낱말 · 말버릇 · 대문자 줄임말은 뺀다)
//   ② 두 조각을 이은 낱말이 같은 판본 글(게시글 포함)에 한 낱말로 있다
// 데바나가리 · 싱할라는 ②만 본다 — 한 자소 낱말(के · है · में · न …)이 흔하고 낱말 끝 비라마도 쓰여(네팔어 · 싱할라) 조각 모양으로는 못 가른다.
const 라틴모음 = /[aeiouyıæøœ]/i;
const 키릴모음 = /[аеёиоуыэюяіїєөүұәў]/i;
const 모음없는낱말 = {
  공통: ['hmm', 'hm', 'mm', 'mmm', 'shh', 'sh', 'psst', 'pst', 'tsk', 'brr', 'grr', 'zzz', 'pfft', 'nth'],
  en: ['mr', 'mrs', 'ms', 'dr', 'st', 'vs'],
  fil: ['ng'],
  id: ['bgt', 'gk', 'gw', 'jg', 'dgn', 'tdk', 'sdh', 'krn', 'sm', 'dr', 'kpn', 'blm', 'lg', 'bs', 'dl', 'tp', 'sy'],
  ms: ['bgt', 'jg', 'dgn', 'tdk', 'sdh', 'krn', 'sm', 'dr', 'kpn', 'blm', 'lg', 'bs', 'dl', 'tp', 'sy'],
  ru: ['в', 'к', 'с', 'б', 'ж'],
  ky: ['в', 'к', 'с'],
  kk: ['в', 'к', 'с'],
  mn: [],
};
function 모음없는조각(조각, L) {
  if (!조각) return false;
  const 키릴 = /키릴/.test(L.문자);
  if (!키릴 && !/라틴/.test(L.문자)) return false;
  const 기본 = 조각.normalize('NFD').replace(/\p{M}/gu, '');
  if ((키릴 ? 키릴모음 : 라틴모음).test(기본)) return false;
  if (자소수(조각) >= 2 && 조각 === 조각.toUpperCase() && 조각 !== 조각.toLowerCase()) return false; // 대문자 줄임말(TV · BTS · KTX)
  const 낮춤 = 조각.toLowerCase();
  return ![...모음없는낱말.공통, ...(모음없는낱말[L.코드] || [])].includes(낮춤);
}
/** 판본 글 전체(한국어 · 읽기 칸 빼고 게시글 포함)의 낱말 — 줄바꿈은 낱말 사이로 본다 */
function 판본낱말들(판본, L) {
  const seg = new Intl.Segmenter(L.코드, { granularity: 'word' });
  const out = new Set();
  for (const z of 판본.줄) {
    if (한국어칸.has(z.칸)) continue;
    for (const s of seg.segment(String(z.글 || '').replace(/\n/g, ' '))) if (s.isWordLike) out.add(s.segment.toLowerCase());
  }
  return out;
}
/** 띄어 쓰는 언어 한 줄의 손 줄바꿈 → 낱말을 자른 것 같은 자리 [{ i, 조각, 까닭 }] */
function 띄어쓰기손줄바꿈(줄들, L, 낱말들) {
  const out = [];
  const 아부기다 = /아부기다/.test(L.문자);
  for (let i = 0; i < 줄들.length - 1; i += 1) {
    const 왼 = (줄들[i].match(/[\p{L}\p{M}]+$/u) || [''])[0];
    const 오 = (줄들[i + 1].match(/^\p{L}[\p{L}\p{M}]*/u) || [''])[0]; // 결합 글자로 시작하는 줄은 「결합시작」(고칠 것)이 잡는다
    if (!왼 || !오) continue;
    const 조각 = `「${줄임(왼, 6)}|${줄임(오, 6)}」`;
    const 까닭 = [];
    if (!아부기다) for (const c of [왼, 오]) if (모음없는조각(c, L)) 까닭.push(`「${c}」에 모음이 없다`);
    const 이은 = (왼 + 오).toLowerCase();
    if (낱말들.has(이은)) 까닭.push(`같은 판본 글에 「${왼 + 오}」가 한 낱말로 있다`);
    if (까닭.length) out.push({ i, 조각, 까닭: 까닭.join(' · ') });
  }
  return out;
}

// ── 렌더 전 규칙 ──────────────────────────────────────────────────────────
/** 판본(판본글.읽기 결과 또는 { 줄: [...] }) · 언어 프로필 → 찾음 목록 */
function 규칙검사(판본, 언어p) {
  const out = [];
  const L = 언어p;
  const 이음 = new Set([...(L.이음글자 || []), ...(/데바나가리|싱할라/.test(L.문자) ? ['200C', '200D'] : [])].map((h) => parseInt(h, 16)));
  const 대상 = 범위식(L.문자범위);
  const 라틴키릴 = /라틴|키릴/.test(L.문자);
  const 머리금지 = new Set([...(L.줄머리금지 || '')]);
  const 끝금지 = new Set([...(L.줄끝금지 || '')]);
  const 낱말자동 = L.낱말경계 === 'Intl.Segmenter';
  const 띄어씀 = L.낱말경계 === '띄어쓰기';
  const 한자권 = /한자|가나/.test(L.문자);
  let 낱말들 = null; // 띄어 쓰는 언어의 손 줄바꿈을 볼 때만 만든다
  for (const 줄 of 판본.줄) {
    if (한국어칸.has(줄.칸)) continue; // 한국어 · 읽기 줄은 학습 내용 — 이 언어 규칙을 대지 않는다
    const t = String(줄.글 || '');
    const 곳 = { 줄: 줄.id };
    if (!t.trim()) continue;
    if (t !== t.normalize('NFC')) out.push(찾음(L.코드 === 'vi' ? 고칠 : 확인, '정규화', `합친 글자(NFC)가 아니다 — 결합 부호로 친 글은 글꼴에 따라 부호가 어긋난다(「${줄임(t)}」)`, 곳));
    for (const ch of t) {
      const cp = ch.codePointAt(0);
      if (안보임.includes(cp) && !이음.has(cp)) {
        out.push(찾음(확인, '보이지않는글자', `보이지 않는 글자 U+${cp.toString(16).toUpperCase().padStart(4, '0')}가 들었다 — 일부러 넣은 이음 글자가 아니면 뺀다`, 곳));
        break;
      }
    }
    if (/^[ \t]|[ \t]$/.test(t) || /[ \t]\n|\n[ \t]/.test(t)) out.push(찾음(확인, '공백', '줄 앞뒤에 공백이 있다', 곳));
    if (/ {2,}/.test(t)) out.push(찾음(확인, '공백', '공백이 두 칸 넘게 이어진다', 곳));
    if (라틴키릴 && /\S [,.!?:;](?!\.)/u.test(t)) out.push(찾음(확인, '문장부호', `문장부호 앞에 공백이 있다(「${줄임(t.match(/\S [,.!?:;]/u)[0], 8)}」)`, 곳));
    for (const w of t.match(/[\p{L}\p{M}]+/gu) || []) {
      const 문자들 = ['Latin', 'Cyrillic', 'Greek'].filter((s) => new RegExp(`\\p{Script=${s}}`, 'u').test(w));
      if (문자들.length > 1) out.push(찾음(고칠, '섞인문자', `한 낱말에 ${문자들.join(' · ')} 글자가 섞였다(「${w}」) — 생김새만 같은 다른 글자다`, 곳));
    }
    const 줄들 = t.split('\n');
    줄들.forEach((l, i) => {
      if (결합시작식.test(l)) out.push(찾음(고칠, '결합시작', `${i + 1}째 줄이 결합 글자(바탕 없이 붙는 부호)로 시작한다(「${줄임(l, 8)}」)`, 곳));
      if (i > 0 && l && 머리금지.has([...l][0])) out.push(찾음(고칠, '줄머리금칙', `${i + 1}째 줄이 「${[...l][0]}」로 시작한다 — 줄머리에 오면 안 되는 부호`, 곳));
      if (i < 줄들.length - 1 && l && 끝금지.has([...l].slice(-1)[0])) out.push(찾음(고칠, '줄끝금칙', `${i + 1}째 줄이 「${[...l].slice(-1)[0]}」로 끝난다 — 여는 부호는 줄 끝에 두지 않는다`, 곳));
    });
    if (결합뒤식.test(t.replace(/\n/g, ' '))) out.push(찾음(고칠, '결합시작', `공백 · 부호 바로 뒤에 결합 글자가 붙었다(「${줄임(t.match(결합뒤식)[0], 6)}」) — 바탕 글자가 없다`, 곳));
    // 손으로 넣은 줄바꿈이 낱말 가운데인가 — 띄어 쓰는 언어는 줄바꿈을 공백 자리로 보되, 조각이 낱말이 못 되면 확인할 것(위 띄어쓰기손줄바꿈)
    if (띄어씀 && 줄들.length > 1 && 줄.칸 !== '게시글') {
      if (!낱말들) 낱말들 = 판본낱말들(판본, L);
      for (const r of 띄어쓰기손줄바꿈(줄들, L, 낱말들)) {
        out.push(찾음(확인, '낱말중간줄바꿈', `${r.i + 1}째 줄바꿈이 낱말 가운데일 수 있다(${r.조각}) — ${r.까닭}. 띄어 쓰는 말이라 사전 없이 본 어림이다`, 곳));
      }
    }
    if (낱말자동 && 줄들.length > 1) {
      let k = -1;
      const 이은 = 줄들.join('');
      let 자리 = 0;
      for (let i = 0; i < 줄들.length - 1; i += 1) {
        자리 += 줄들[i].length;
        k = 자리;
        const 앞 = 이은[k - 1], 뒤 = 이은[k];
        if (!앞 || !뒤 || /\s/.test(앞) || /\s/.test(뒤)) continue;
        if (!낱말경계들(이은, L.코드).has(k)) {
          out.push(찾음(한자권 ? 확인 : 고칠, '낱말중간줄바꿈', `${i + 1}째 줄바꿈이 낱말 가운데다(「${줄임(이은.slice(Math.max(0, k - 4), k), 6)}|${줄임(이은.slice(k, k + 4), 6)}」)`, 곳));
        }
      }
    }
    // 문장부호 — 언어 프로필의 틀린꼴
    for (const r of L.문장부호?.틀린꼴 || []) {
      const re = new RegExp(r.찾기, 'gu');
      const m = t.match(re);
      if (m) out.push(찾음(r.수준, '문장부호', `${r.까닭} — ${m.length}곳(「${줄임(m[0], 6)}」)`, 곳));
    }
    if (L.문장부호?.전각) {
      const 반각 = L.코드 === 'ja' ? /(?<=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])[!?:;]/u : /(?<=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])(?:[,!?:;]|\.(?!\d))/u;
      const m = t.match(반각);
      if (m) out.push(찾음(L.코드 === 'ja' ? 확인 : 고칠, '문장부호', `한자 · 가나 뒤에 반각 부호 「${m[0]}」 — 전각(，。！？：；)으로 쓴다`, 곳));
    }
    const 여는 = L.문장부호?.여는부호;
    if (여는) {
      for (const 문장 of t.split(/(?<=[.!?…])\s+|\n/)) {
        for (const [끝, 앞] of Object.entries(여는)) {
          if (문장.trim().endsWith(끝) && !문장.includes(앞)) out.push(찾음(고칠, '문장부호', `「${끝}」로 끝나는 문장에 여는 「${앞}」가 없다(「${줄임(문장.trim(), 14)}」)`, 곳));
        }
      }
    }
    if (t.includes('"') && !(L.문장부호?.따옴표 || []).some((q) => q.includes('"'))) out.push(찾음(확인, '문장부호', `곧은 따옴표(")를 썼다 — ${(L.문장부호?.따옴표 || ['“”']).join(' · ')}를 쓴다`, 곳));
    if (!라틴키릴 && 대상 && 줄.칸 !== '게시글') {
      const 글자 = t.match(/\p{L}/gu) || [];
      if (글자.length >= 4 && !대상.test(t) && !한글식.test(t)) out.push(찾음(확인, '번역빠짐', `이 줄에 ${L.문자} 글자가 없다 — 옮기지 않은 줄인지 본다(「${줄임(t)}」)`, 곳));
    }
  }
  out.push(...읽기시간검사(판본, L));
  return out;
}

/** 읽기 시간 — 화면에 있는 초 × 초당 글자. 끝 초가 같은(±0.25) 줄은 한 화면에 함께 있으니 묶어서도 본다. */
function 읽기시간검사(판본, L) {
  const cps = L.읽기속도?.초당글자;
  if (!(cps > 0)) return [];
  const 줄들 = 판본.줄.filter((z) => Array.isArray(z.초) && !한국어칸.has(z.칸) && z.칸 !== '게시글' && String(z.글 || '').trim());
  const 묶음 = [];
  for (const z of [...줄들].sort((a, b) => a.초[1] - b.초[1])) {
    const g = 묶음.find((x) => Math.abs(x.끝 - z.초[1]) <= 0.25);
    if (g) { g.줄.push(z); g.시작 = Math.min(g.시작, z.초[0]); g.끝 = Math.max(g.끝, z.초[1]); } else 묶음.push({ 줄: [z], 시작: z.초[0], 끝: z.초[1] });
  }
  const out = [];
  for (const g of 묶음) {
    const 글자 = g.줄.reduce((s, z) => s + 자소수(z.글), 0);
    const 있음 = g.끝 - g.시작;
    const 필요 = 글자 / cps;
    if (있음 >= 필요) continue;
    const 수준 = 있음 < 필요 * 0.6 ? 고칠 : 확인;
    out.push(찾음(수준, '읽기시간', `${g.줄.map((z) => z.id).join(' · ')} — 화면 ${있음.toFixed(1)}초에 ${글자}자, 읽는 데 ${필요.toFixed(1)}초(초당 ${cps}자${L.읽기속도.어림 ? ' 어림' : ''}). 글을 줄이거나 화면에 더 둔다`, { 줄: g.줄.map((z) => z.id).join(',') }));
  }
  return out;
}

// ── 글꼴(파이썬 fontTools · HarfBuzz) ─────────────────────────────────────
function 파이썬() {
  return process.env.SYNK_PYTHON || 'python';
}

/** 판본 · 언어 프로필 → 찾음. 파이썬 · 모듈이 없으면 확인할 것 하나. */
function 글꼴검사(판본, L, { 굵기 = 700 } = {}) {
  const out = [];
  const 볼 = L.문장부호?.라틴글꼴부호 || '';
  const 줄들 = [];
  const 모름 = new Set();
  for (const z of 판본.줄) {
    if (!String(z.글 || '').trim() || z.칸 === '게시글') continue; // 게시글은 영상에 그리지 않는다
    const 줄 = z.상자?.글꼴 || L.글꼴줄;
    const { 파일, 모름: m } = 프로필.글꼴줄파일(줄, z.상자?.굵기 || 굵기);
    m.forEach((x) => 모름.add(x));
    줄들.push({ z, 입력: { 글: z.글, 언어: L.코드, 크기: z.상자?.글자크기 || 100, 볼글자: 한국어칸.has(z.칸) ? '' : 볼, 글꼴: 파일.map((f) => ({ 이름: f.이름, 파일: f.파일, 번호: f.번호 })) } });
  }
  if (모름.size) out.push(찾음(확인, '모르는글꼴', `글꼴 표(docs/마케팅/현지화/언어프로필.json 「글꼴」)에 없는 글꼴: ${[...모름].join(' · ')} — 네모 글자 검사에서 뺐다. 표에 더한다`));
  if (!줄들.length) return { 찾음: out, 줄: [] };
  const r = spawnSync(파이썬(), ['-X', 'utf8', path.join(__dirname, '글꼴재기.py')], { input: JSON.stringify({ 크기: 100, 줄들: 줄들.map((x) => x.입력) }), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  let 답 = null;
  try { 답 = JSON.parse(String(r.stdout || '')); } catch { /* 아래 */ }
  if (r.error || !답 || 답.오류 || !Array.isArray(답.줄들)) {
    out.push(찾음(확인, '글꼴검사못함', `글꼴 검사를 못 했다(${(답 && 답.오류) || (r.error && r.error.message) || String(r.stderr || '').trim().split('\n').pop() || '알 수 없음'}) — 네모 글자 · 결합 깨짐은 눈으로 본다`));
    return { 찾음: out, 줄: [] };
  }
  const 줄결과 = [];
  답.줄들.forEach((a, i) => {
    const z = 줄들[i].z;
    const 곳 = { 줄: z.id };
    줄결과.push({ id: z.id, ...a });
    if (a.오류) { out.push(찾음(확인, '글꼴검사못함', `이 줄 글꼴 검사 실패: ${a.오류}`, 곳)); return; }
    if (a.없는글자?.length) out.push(찾음(고칠, '네모글자', `글꼴 줄에 없는 글자 ${a.없는글자.length}개(${a.없는글자.slice(0, 6).join(', ')}) — 화면에 네모로 나온다`, 곳));
    if (a.기호대체?.length) out.push(찾음(확인, '기호대체', `이모지 · 기호 ${a.기호대체.length}개(${a.기호대체.slice(0, 4).join(', ')})는 글꼴 줄 밖 시스템 글꼴이 그린다 — 렌더 화면에서 꼴을 본다`, 곳));
    if (a.점선원 > 0) out.push(찾음(고칠, '결합깨짐', `결합 글자가 바탕 없이 · 틀린 순서로 쳐져 조판에 점선 원(◌)이 ${a.점선원}개 생긴다`, 곳));
    else if (a.빈글리프 > 0 && !a.없는글자?.length) out.push(찾음(고칠, '빈글리프', `조판 뒤 빈 글리프(.notdef)가 ${a.빈글리프}개 — 글꼴이 이 글자 묶음을 못 그린다`, 곳));
    const 라틴 = Object.entries(a.볼글자글꼴 || {}).filter(([, f]) => f && f !== L.글꼴);
    if (라틴.length) out.push(찾음(확인, '라틴글꼴부호', `「${라틴.map(([c]) => c).join('')}」를 ${[...new Set(라틴.map(([, f]) => f))].join(' · ')}가 맡는다 — ${L.이름} 꼴(가운데 점 · 전각 폭)이 아니다. 글꼴 줄에서 ${L.글꼴}를 앞에 두거나 그 부호만 감싼다`, 곳));
    const 상자 = z.상자;
    if (상자 && a.폭 > 0) {
      const 줄수 = Math.max(1, 상자.최대줄 || 1);
      if (상자.줄바꿈 === 'nowrap' || 줄수 === 1 ? a.폭 > 상자.폭 + 1 : a.폭 > 상자.폭 * 줄수) {
        out.push(찾음(확인, '넘침어림', `조판 폭 어림 ${Math.round(a.폭)}px > 상자 ${상자.폭}px × ${줄수}줄 — 엔진 잼으로 다시 본다`, 곳));
      }
    }
  });
  return { 찾음: out, 줄: 줄결과 };
}

// ── 엔진 잼(크롬) ────────────────────────────────────────────────────────
function 저장소글꼴css() {
  const 등록 = 프로필.언어파일().글꼴;
  const css = [];
  for (const [이름, g] of Object.entries(등록)) {
    if (g.곳 !== '저장소') continue;
    for (const [w, p] of Object.entries(g.파일)) {
      const { 파일 } = 프로필.경로풀기(p);
      if (!fs.existsSync(파일)) continue;
      const ext = path.extname(파일).slice(1).toLowerCase();
      const 꼴 = { ttf: 'truetype', otf: 'opentype', woff2: 'woff2', woff: 'woff' }[ext] || ext;
      const 굵기 = 이름 === 'SUIT' ? '100 900' : (Number(w) >= 700 ? '700 900' : w);
      css.push(`@font-face{font-family:'${이름}';src:url(data:font/${ext};base64,${fs.readFileSync(파일).toString('base64')}) format('${꼴}');font-weight:${굵기};font-display:block}`);
    }
  }
  return css.join('\n');
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function 엔진html(줄들, L) {
  let y = 20;
  const 상자들 = 줄들.map((z, i) => {
    const s = z.상자;
    const ws = s.줄바꿈 === 'nowrap' ? 'nowrap' : 'pre-line';
    const wb = s.줄바꿈 === 'keep-all' ? 'keep-all' : (s.줄바꿈 === 'anywhere' ? 'normal' : 'normal');
    const ow = s.줄바꿈 === 'anywhere' ? 'anywhere' : 'normal';
    const style = [
      'position:absolute', 'left:20px', `top:${y}px`, `width:${s.폭}px`, s.높이 ? `height:${s.높이}px` : '',
      `font-family:${s.글꼴 || L.글꼴줄}`, `font-size:${s.글자크기}px`, `font-weight:${s.굵기 || 700}`, `line-height:${s.줄높이 || 1.2}`,
      `letter-spacing:${s.자간 || 'normal'}`, `text-align:${s.가운데 ? 'center' : 'left'}`, `white-space:${ws}`, `word-break:${wb}`, `overflow-wrap:${ow}`,
      'overflow:visible', 'padding:0', 'margin:0', 'box-sizing:content-box',
    ].filter(Boolean).join(';');
    y += (s.높이 || s.글자크기 * (s.줄높이 || 1.2) * Math.max(4, (s.최대줄 || 1) * 3)) + 40;
    return `<div class="box" data-i="${i}" lang="${esc(L.코드)}" style="${esc(style)}">${esc(z.글)}</div>`;
  });
  return `<!doctype html><html><head><meta charset="utf-8"><style>${저장소글꼴css()}\nhtml,body{margin:0;background:#fff;width:2400px;height:${y + 100}px}</style></head><body>${상자들.join('\n')}</body></html>`;
}

// 지면 안에서 상자마다 줄을 잰다 — 자소마다 Range 사각형을 모아 위치(top)로 줄을 가른다.
const 재기식 = `(() => {
  const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  return [...document.querySelectorAll('.box')].map((el) => {
    const node = el.firstChild;
    const text = el.textContent;
    const box = el.getBoundingClientRect();
    const lines = [];
    if (node) for (const g of seg.segment(text)) {
      if (g.segment === '\\n') continue;
      const r = document.createRange();
      r.setStart(node, g.index); r.setEnd(node, g.index + g.segment.length);
      const rects = [...r.getClientRects()].filter((x) => x.width > 0.01 && x.height > 0);
      if (!rects.length) continue;
      const rc = rects[0];
      let line = lines.find((l) => Math.abs(l.top - rc.top) < Math.max(4, rc.height * 0.45));
      const blank = /^\\s+$/.test(g.segment);
      if (!line) {
        line = { top: rc.top, bottom: rc.bottom, left: blank ? Infinity : rc.left, right: blank ? -Infinity : rc.right, start: g.index, end: g.index + g.segment.length };
        lines.push(line);
      } else {
        if (!blank) { line.left = Math.min(line.left, rc.left); line.right = Math.max(line.right, rc.right); }
        line.start = Math.min(line.start, g.index); line.end = Math.max(line.end, g.index + g.segment.length);
        line.bottom = Math.max(line.bottom, rc.bottom); line.top = Math.min(line.top, rc.top);
      }
    }
    lines.sort((a, b) => a.top - b.top);
    return { i: Number(el.dataset.i), boxLeft: box.left, boxRight: box.right, boxTop: box.top, boxBottom: box.bottom,
      scrollW: el.scrollWidth, clientW: el.clientWidth, scrollH: el.scrollHeight, clientH: el.clientHeight,
      lines: lines.map((l) => ({ top: l.top, bottom: l.bottom, left: Number.isFinite(l.left) ? l.left : null, right: Number.isFinite(l.right) ? l.right : null, start: l.start, end: l.end })) };
  });
})()`;

const 이름맞춤 = (s) => String(s || '').toLowerCase().replace(/['"\s]/g, '');
// 크롬이 그 나라 말 이름으로 알리는 윈도우 글꼴 → 글꼴 줄에 적는 이름
const 글꼴다른이름 = { 微軟正黑體: 'Microsoft JhengHei', 微软雅黑: 'Microsoft YaHei', 游ゴシック: 'Yu Gothic', 맑은고딕: 'Malgun Gothic' };

/** 엔진 잼 결과(지면에서 잰 값) → 찾음. 크롬 없이 시험할 수 있게 따로 둔다. */
function 엔진판정(줄들, 잰것, 글꼴들, L) {
  const out = [];
  const 머리금지 = new Set([...(L.줄머리금지 || '')]);
  const 한자권 = /한자|가나/.test(L.문자);
  const 확인줄바꿈 = L.자동줄바꿈 === '확인' || ['my', 'km'].includes(L.코드);
  const SAFE = 안전영역();
  for (const m of 잰것) {
    const z = 줄들[m.i];
    const s = z.상자;
    const 곳 = { 줄: z.id };
    const t = z.글;
    const 손줄 = t.split('\n').length;
    const lines = m.lines.filter((l) => l.left !== null);
    const 폭 = lines.length ? Math.max(...lines.map((l) => l.right - l.left)) : 0;
    const 넘은 = lines.filter((l) => l.right > m.boxRight + 0.75 || l.left < m.boxLeft - 0.75);
    if (넘은.length) out.push(찾음(고칠, '상자넘침', `글이 상자 밖으로 나간다 — 가장 긴 줄 ${Math.round(폭)}px > 상자 ${s.폭}px(「${줄임(t.slice(넘은[0].start, 넘은[0].end), 14)}」)`, 곳));
    if (s.최대줄 && lines.length > s.최대줄) out.push(찾음(고칠, '줄수넘침', `${lines.length}줄로 갈린다 — 이 상자는 ${s.최대줄}줄까지`, 곳));
    if (s.높이 && m.scrollH > m.clientH + 1) out.push(찾음(고칠, '상자넘침', `글 높이 ${m.scrollH}px > 상자 높이 ${s.높이}px`, 곳));
    const 여유 = s.여유 ?? Math.round((s.글자크기 || 40) * 0.15);
    if (!넘은.length && 폭 > s.폭 - 2 * 여유) out.push(찾음(확인, '테두리닿음', `가장 긴 줄이 상자 폭의 ${Math.round((폭 / s.폭) * 100)}% — 양쪽 여유 ${여유}px보다 좁다`, 곳));
    if (lines.length > 손줄 && s.줄바꿈 !== 'nowrap') {
      const 경계 = 낱말경계들(t, L.코드);
      for (const l of lines.slice(1)) {
        const k = l.start;
        const 앞 = t[k - 1], 뒤 = t[k];
        if (!앞 || 앞 === '\n' || /\s/.test(앞) || /\s/.test(뒤 || '')) continue;
        if (앞 === '-' || 앞 === '‐') continue;
        const 조각 = `「${줄임(t.slice(Math.max(0, k - 4), k), 6)}|${줄임(t.slice(k, k + 4), 6)}」`;
        if (!경계.has(k)) out.push(찾음(한자권 ? 확인 : 고칠, '낱말중간줄바꿈', `엔진이 낱말 가운데서 줄을 바꿨다 ${조각}`, 곳));
        else if (확인줄바꿈) out.push(찾음(확인, '자동줄바꿈', `엔진이 공백 아닌 자리에서 줄을 바꿨다 ${조각} — ${L.이름} 사전 낱말 가르기가 틀릴 수 있다. 낱말 중간이면 U+2060(낱말 이음)을 넣거나 줄바꿈을 손으로 정한다`, 곳));
        if (뒤 && 머리금지.has(뒤)) out.push(찾음(고칠, '줄머리금칙', `엔진 줄바꿈 뒤 줄이 「${뒤}」로 시작한다`, 곳));
        if (뒤 && /\p{M}/u.test(뒤)) out.push(찾음(고칠, '결합시작', `엔진 줄바꿈 뒤 줄이 결합 글자로 시작한다 ${조각}`, 곳));
      }
    }
    if (Number.isFinite(s.x) && Number.isFinite(s.y)) {
      for (const l of lines) {
        const x0 = s.x + (l.left - m.boxLeft), x1 = s.x + (l.right - m.boxLeft);
        const y0 = s.y + (l.top - m.boxTop), y1 = s.y + (l.bottom - m.boxTop);
        const 넘음 = [];
        if (x1 > SAFE.right) 넘음.push(`${자리말.right} x ${Math.round(x1)} > ${SAFE.right}`);
        if (x0 < SAFE.left) 넘음.push(`${자리말.left} x ${Math.round(x0)} < ${SAFE.left}`);
        if (y0 < SAFE.top) 넘음.push(`${자리말.top} y ${Math.round(y0)} < ${SAFE.top}`);
        if (y1 > SAFE.bottom) 넘음.push(`${자리말.bottom} y ${Math.round(y1)} > ${SAFE.bottom}`);
        if (넘음.length) { out.push(찾음(고칠, '안전영역', `글이 안전 영역 밖이다 — ${넘음.join(' · ')}`, 곳)); break; }
      }
    }
    // 가변 글꼴은 크롬이 내부 이름으로 알린다(글꼴 줄 'SUIT' → 「SUIT Variable Thin」) — 선언한 이름으로 시작하면 선언한 글꼴이다
    // (11-10 판본 시범: 끝 카드의 한글 세 글자가 판본마다 「대체글꼴」로 떴다).
    const 선언 = 프로필.글꼴줄이름(s.글꼴 || L.글꼴줄).map(이름맞춤);
    // 윈도우 한자권 글꼴은 그 나라 말 이름으로도 온다(Microsoft JhengHei → 「微軟正黑體」 — 번체판 줄마다 「대체글꼴」로 떴다).
    const 선언됨 = (이름) => { const n = 이름맞춤(글꼴다른이름[이름맞춤(이름)] || 이름); return 선언.some((d) => n === d || n.startsWith(`${d}variable`)); };
    const 대체 = (글꼴들?.[m.i] || []).filter((f) => !선언됨(f.familyName) && f.glyphCount > 0);
    if (대체.length) out.push(찾음(확인, '대체글꼴', `글꼴 줄에 없는 시스템 글꼴이 글자를 맡았다: ${대체.map((f) => `${f.familyName} ${f.glyphCount}자`).join(' · ')} — 그 글자를 덮는 글꼴을 글꼴 줄에 넣는다`, 곳));
  }
  return out;
}

/** 크롬으로 상자 있는 줄을 잰다 → { 찾음, 잰것 } */
async function 엔진재기(판본, L) {
  const 줄들 = 판본.줄.filter((z) => z.상자 && z.칸 !== '게시글' && String(z.글 || '').trim() && z.상자.폭 > 0 && z.상자.글자크기 > 0);
  if (!줄들.length) return { 찾음: [찾음(확인, '엔진못함', '판본 글에 「상자」(폭 · 글자크기)가 있는 줄이 없다 — 상자 넘침 · 테두리 닿음은 렌더 뒤 프레임과 눈으로 본다')], 잰것: [] };
  const { 지면열기 } = require('./크롬조종.js');
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-글자검사-'));
  const html = path.join(방, 'page.html');
  fs.writeFileSync(html, 엔진html(줄들, L), 'utf8');
  let 열린 = null;
  try {
    열린 = await 지면열기(html, { 최대초: 60 });
    const { c } = 열린;
    const r = await c.보냄('Runtime.evaluate', { expression: 재기식, returnByValue: true });
    const 잰것 = r?.result?.value;
    if (!Array.isArray(잰것)) throw new Error('지면에서 잰 값이 없다');
    const 글꼴들 = {};
    try {
      await c.보냄('DOM.enable');
      await c.보냄('CSS.enable');
      const doc = await c.보냄('DOM.getDocument', { depth: -1 });
      const { nodeIds } = await c.보냄('DOM.querySelectorAll', { nodeId: doc.root.nodeId, selector: '.box' });
      for (let i = 0; i < nodeIds.length; i += 1) {
        const f = await c.보냄('CSS.getPlatformFontsForNode', { nodeId: nodeIds[i] });
        글꼴들[i] = f.fonts || [];
      }
    } catch { /* 글꼴 목록을 못 받아도 줄 잼은 쓴다 */ }
    return { 찾음: 엔진판정(줄들, 잰것, 글꼴들, L), 잰것: 잰것.map((m) => ({ id: 줄들[m.i].id, 줄수: m.lines.length, 줄: m.lines, 글꼴: (글꼴들[m.i] || []).map((f) => `${f.familyName}(${f.glyphCount})`) })) };
  } catch (e) {
    return { 찾음: [찾음(확인, '엔진못함', `크롬 잼을 못 했다(${e.message}) — 상자 넘침 · 테두리 닿음은 눈으로 본다`)], 잰것: [] };
  } finally {
    if (열린) 열린.닫기();
    try { fs.rmSync(방, { recursive: true, force: true }); } catch { /* 청소 실패는 결과와 무관 */ }
  }
}

// ── 렌더 뒤 프레임 ───────────────────────────────────────────────────────
const 반폭 = 540, 반높이 = 960, 간격 = 0.5;

function ffmpeg(args, what, opts = {}) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { windowsHide: true, maxBuffer: 2 * 1024 * 1024 * 1024, ...opts });
  if (r.status !== 0) throw new Error(`ffmpeg 실패(${what}): ${String(r.stderr || '').trim().split('\n').slice(-2).join(' ')}`);
  return r;
}

function 길이(video) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', video], { encoding: 'utf8', windowsHide: true });
  const j = JSON.parse(r.stdout || '{}');
  return { 초: Number(j.format?.duration) || 0, 폭: Number(j.streams?.[0]?.width) || 0, 높이: Number(j.streams?.[0]?.height) || 0 };
}

/** 기준 판을 시간축에서 미는 필터 앞머리(11-12 나라 인사 카드) — 이 판에만 훅 앞 인사 장면이 있으면 원본은 그 길이만큼 밀려 시작한다.
 *  밀림 > 0: 기준 판을 그만큼 뒤로 민다(앞 빈 구간은 기준 판 첫 프레임이 채운다 — 인사 구간은 기준 판과 견줄 것이 없어 픽셀 차이는 확인할 것까지만).
 *  밀림 < 0: 기준 판에만 인사가 있다 — 그만큼 잘라 낸다. 0이면 빈 글. 프레임 표본(fps)은 이 뒤에 붙는다. */
function 밀기필터(밀림 = 0) {
  const s = Math.round((Number(밀림) || 0) * 1000) / 1000;
  if (!s) return '';
  return s > 0 ? `setpts=PTS+${s}/TB,` : `trim=start=${-s},setpts=PTS-STARTPTS,`;
}
const 표본필터 = (밀림 = 0) => `${밀기필터(밀림)}fps=${1 / 간격}${밀림 > 0 ? ':start_time=0' : ''}`;

/** 회색 반쪽 해상도 프레임(0.5초마다) — 밀림(초)을 주면 그만큼 시간축을 민 프레임 */
function 회색프레임(video, 밀림 = 0) {
  const r = ffmpeg(['-i', video, '-vf', `${표본필터(밀림)},scale=${반폭}:${반높이}:flags=area,format=gray`, '-f', 'rawvideo', '-'], '회색 프레임');
  const 크기 = 반폭 * 반높이;
  const n = Math.floor(r.stdout.length / 크기);
  return { n, at: (i) => r.stdout.subarray(i * 크기, (i + 1) * 크기) };
}

/** 차이 덩어리 — 판본 프레임 a가 기준 프레임들과 모두 다른 화소(문턱 48)를 3칸 팽창해 이은 덩어리. 1080×1920 좌표.
 *  이웃(0.5초 앞이나 뒤 판본 프레임)을 주면 그 사이 바뀐 화소(튀어나오는 판 · 움직이는 소품)는 뺀다 — 글은 머물러 있다.
 *  (11-10 퀴즈 #2 태국어판 실측: 말풍선이 커지며 튀는 순간 판 크기가 판본마다 달라 오른쪽 단추 자리 「글」로 잘못 잡혔다.) */
function 차이덩어리(a, 기준들, { 문턱 = 48, 팽창 = 3, 최소 = 60, 이웃 = null, 기준이웃 = [], 안정 = 16 } = {}) {
  const W = 반폭, H = 반높이, N = W * H;
  const m = new Uint8Array(N);
  for (let i = 0; i < N; i += 1) {
    if (이웃 && Math.abs(a[i] - 이웃[i]) > 안정) continue;
    let 다름 = true;
    for (let k = 0; k < 기준들.length; k += 1) {
      const b = 기준들[k];
      if (Math.abs(a[i] - b[i]) <= 문턱 || (기준이웃[k] && Math.abs(b[i] - 기준이웃[k][i]) > 안정)) { 다름 = false; break; }
    }
    if (다름) m[i] = 1;
  }
  const h = new Uint8Array(N);
  for (let y = 0; y < H; y += 1) {
    let run = -1e9;
    for (let x = 0; x < W; x += 1) { if (m[y * W + x]) run = x; if (x - run <= 팽창) h[y * W + x] = 1; }
    run = 1e9;
    for (let x = W - 1; x >= 0; x -= 1) { if (m[y * W + x]) run = x; if (run - x <= 팽창) h[y * W + x] = 1; }
  }
  const d = new Uint8Array(N);
  for (let x = 0; x < W; x += 1) {
    let run = -1e9;
    for (let y = 0; y < H; y += 1) { if (h[y * W + x]) run = y; if (y - run <= 팽창) d[y * W + x] = 1; }
    run = 1e9;
    for (let y = H - 1; y >= 0; y -= 1) { if (h[y * W + x]) run = y; if (run - y <= 팽창) d[y * W + x] = 1; }
  }
  const lab = new Int32Array(N).fill(-1);
  const out = [];
  const stack = [];
  for (let i = 0; i < N; i += 1) {
    if (!d[i] || lab[i] >= 0) continue;
    const id = out.length;
    let x0 = W, y0 = H, x1 = 0, y1 = 0, px = 0;
    stack.push(i); lab[i] = id;
    while (stack.length) {
      const p = stack.pop();
      const x = p % W, y = (p / W) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (m[p]) px += 1;
      if (x > 0 && d[p - 1] && lab[p - 1] < 0) { lab[p - 1] = id; stack.push(p - 1); }
      if (x < W - 1 && d[p + 1] && lab[p + 1] < 0) { lab[p + 1] = id; stack.push(p + 1); }
      if (y > 0 && d[p - W] && lab[p - W] < 0) { lab[p - W] = id; stack.push(p - W); }
      if (y < H - 1 && d[p + W] && lab[p + W] < 0) { lab[p + W] = id; stack.push(p + W); }
    }
    out.push({ x0: x0 * 2, y0: y0 * 2, x1: (x1 + 1) * 2, y1: (y1 + 1) * 2, px });
  }
  return out.filter((r) => r.px >= 최소 && r.x1 - r.x0 >= 12 && r.y1 - r.y0 >= 12);
}

function 글자인식(dir) {
  const r = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, '글자인식.ps1'), '-Dir', dir],
    { encoding: 'utf8', windowsHide: true, maxBuffer: 256 * 1024 * 1024, timeout: 600000 });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(String(r.stderr || '').trim().slice(0, 300) || `종료 코드 ${r.status}`);
  const text = String(r.stdout || '').replace(/^﻿/, '').trim();
  return text ? [].concat(JSON.parse(text)) : [];
}

/** OCR 그림 하나 → 1080×1920 좌표 줄 상자(9px 아래 · 한 글자 줄은 무늬로 본다) */
function OCR상자(image) {
  const sx = 1080 / image.width, sy = 1920 / image.height;
  const out = [];
  for (const line of [].concat(image.lines || [])) {
    const ws = [].concat(line.words || []).filter((w) => w && w.w > 0 && w.h > 0);
    if (!ws.length || String(line.text || '').replace(/\s/g, '').length < 2) continue;
    const x0 = Math.min(...ws.map((w) => w.x)) * sx, y0 = Math.min(...ws.map((w) => w.y)) * sy;
    const x1 = Math.max(...ws.map((w) => w.x + w.w)) * sx, y1 = Math.max(...ws.map((w) => w.y + w.h)) * sy;
    if ((y1 - y0) < 9) continue;
    out.push({ x0, y0, x1, y1, text: line.text });
  }
  return out;
}

function 넘은자리(b, SAFE) {
  const out = [];
  if (b.x1 > SAFE.right) out.push({ 자리: 'right', 넘음: b.x1 - SAFE.right, 점: { x: SAFE.right, y: (b.y0 + b.y1) / 2 } });
  if (b.x0 < SAFE.left) out.push({ 자리: 'left', 넘음: SAFE.left - b.x0, 점: { x: SAFE.left, y: (b.y0 + b.y1) / 2 } });
  if (b.y0 < SAFE.top) out.push({ 자리: 'top', 넘음: SAFE.top - b.y0, 점: { x: (b.x0 + b.x1) / 2, y: SAFE.top } });
  if (b.y1 > SAFE.bottom) out.push({ 자리: 'bottom', 넘음: b.y1 - SAFE.bottom, 점: { x: (b.x0 + b.x1) / 2, y: SAFE.bottom } });
  return out;
}
function 여백(b, SAFE) {
  const 후보 = [
    { 값: SAFE.right - b.x1, 자리: 'right', 점: { x: Math.min(b.x1, 1079), y: (b.y0 + b.y1) / 2 } },
    { 값: b.x0 - SAFE.left, 자리: 'left', 점: { x: Math.max(b.x0, 0), y: (b.y0 + b.y1) / 2 } },
    { 값: b.y0 - SAFE.top, 자리: 'top', 점: { x: (b.x0 + b.x1) / 2, y: Math.max(b.y0, 0) } },
    { 값: SAFE.bottom - b.y1, 자리: 'bottom', 점: { x: (b.x0 + b.x1) / 2, y: Math.min(b.y1, 1919) } },
  ];
  return 후보.reduce((a, c) => (c.값 < a.값 ? c : a));
}
const 덮음 = (b, 상자들, 덤 = 32) => 상자들.some((o) => b.x0 >= o.x0 - 덤 && b.x1 <= o.x1 + 덤 && b.y0 >= o.y0 - 덤 && b.y1 <= o.y1 + 덤);

/** 넘은 자리 하나가 기준 판 글 자리로 설명되나 —
 *  ① 그 자리의 넘은 띠가 기준 판 OCR 글 상자 안에 들어가거나(덤 32px),
 *  ② 기준 판 글 상자도 같은 안전선을 같은 자리(선을 따라 겹치는 구간)에서 넘고, 이 판이 그보다 원본덤(40px) 넘게 더 나가지 않을 때.
 *     11-10 화날때: 판본마다 글 길이가 달라, 원본부터 안전선 밖에 있던 화 게이지 이름표 · 말풍선 끝 · 끝 카드를 ①로는 못 덮어
 *     미국판과 같은 자리에서 같이 넘는 판본 여덟이 「단추가림」 고칠 것으로 남았다. 40px 넘게 더 나간 판은 그대로 고칠 것이다. */
const 원본덤 = 40;
function 기준글자리(b, 자리, SAFE, 기준상자) {
  const 띠 = { ...b };
  if (자리 === 'right') 띠.x0 = SAFE.right;
  if (자리 === 'left') 띠.x1 = SAFE.left;
  if (자리 === 'top') 띠.y1 = SAFE.top;
  if (자리 === 'bottom') 띠.y0 = SAFE.bottom;
  if (덮음(띠, 기준상자)) return true;
  const 내넘음 = 넘은자리(b, SAFE).find((n) => n.자리 === 자리)?.넘음 || 0;
  const 선따라겹침 = (o) => (자리 === 'right' || 자리 === 'left')
    ? Math.min(b.y1, o.y1) > Math.max(b.y0, o.y0)
    : Math.min(b.x1, o.x1) > Math.max(b.x0, o.x0);
  return 기준상자.some((o) => {
    const 그넘음 = 넘은자리(o, SAFE).find((n) => n.자리 === 자리);
    return Boolean(그넘음) && 선따라겹침(o) && 내넘음 <= 그넘음.넘음 + 원본덤;
  });
}

const 겹침 = (a, b) => Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0) && Math.min(a.y1, b.y1) > Math.max(a.y0, b.y0);

/** 상자에서 안전 영역 밖으로 나간 띠들(1080×1920 좌표) */
function 넘은띠들(b, SAFE) {
  const out = [];
  if (b.x1 > SAFE.right) out.push({ ...b, x0: Math.max(b.x0, SAFE.right) });
  if (b.x0 < SAFE.left) out.push({ ...b, x1: Math.min(b.x1, SAFE.left) });
  if (b.y0 < SAFE.top) out.push({ ...b, y1: Math.min(b.y1, SAFE.top) });
  if (b.y1 > SAFE.bottom) out.push({ ...b, y0: Math.max(b.y0, SAFE.bottom) });
  return out;
}
/** 회색 반 크기 프레임 둘에서 상자(1080×1920 좌표) 안의 다른 화소 비율(문턱 48 — 차이덩어리와 같다) */
function 다른화소비율(a, b, 상자, 문턱 = 48) {
  const x0 = Math.max(0, Math.floor(상자.x0 / 2)), x1 = Math.min(반폭, Math.ceil(상자.x1 / 2));
  const y0 = Math.max(0, Math.floor(상자.y0 / 2)), y1 = Math.min(반높이, Math.ceil(상자.y1 / 2));
  let n = 0, 다름 = 0;
  for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) { n += 1; if (Math.abs(a[y * 반폭 + x] - b[y * 반폭 + x]) > 문턱) 다름 += 1; }
  return n ? 다름 / n : 0;
}

/** 프레임 판정(시험할 수 있게 따로) — 프레임마다 { 초, 번호, 판본상자[{x0,y0,x1,y1,출처: 'ocr'|'차이'}], 기준상자[] } → { 찾음, 좁은[] }
 *  고칠 것은 OCR이 읽은 판본 글이 안전 영역 밖에 0.5초 넘게(이웃 장면에서 겹친 자리로) 머물고 기준 판 글 자리로 설명되지 않을 때만이다.
 *  픽셀 차이 덩어리는 글 크기에 맞춰 커지는 판 · 말풍선 테두리까지 잡혀(11-10 퀴즈 #2 실측) 확인할 것으로만 낸다 — 좁은 여백 그림으로 눈으로 본다. */
function 프레임판정(프레임들, { 플랫폼 = null, 언어p = null } = {}) {
  const SAFE = 안전영역();
  const out = [];
  const 걸림 = new Map(); // 자리 → [{초, 넘음, 기준, 상자}]
  const 여백들 = [];
  for (const f of 프레임들) {
    for (const b of f.판본상자) {
      const 기준글 = 덮음(b, f.기준상자 || [], 8);
      const g = 여백(b, SAFE);
      // 여백 순위: OCR 글 먼저, 기준 판 글로 덮인 차이 덩어리는 뒤로
      여백들.push({ 초: f.초, 번호: f.번호, ...g, 점수: g.값 + (b.출처 === '차이' ? 40 : 0) + (기준글 && b.출처 === '차이' ? 2000 : 0), 상자: b });
      for (const n of 넘은자리(b, SAFE)) {
        const 기준 = 기준글자리(b, n.자리, SAFE, f.기준상자 || []) || Boolean(b.정본같음);
        if (!걸림.has(n.자리)) 걸림.set(n.자리, []);
        걸림.get(n.자리).push({ 초: f.초, 넘음: n.넘음, 기준, 상자: b });
      }
    }
  }
  const 곳말 = 플랫폼 ? `(${플랫폼말[플랫폼] || 플랫폼})` : '(틱톡 · 릴스 · 쇼츠 공통)';
  const 초들 = (xs) => [...new Set(xs.map((x) => x.초))].slice(0, 6).map((x) => `${x}초`).join(' · ');
  const 많이 = (xs) => Math.round(Math.max(...xs.map((x) => x.넘음)));
  for (const [자리, list] of 걸림) {
    const 판OCR = list.filter((x) => !x.기준 && x.상자.출처 !== '차이');
    const 머문 = 판OCR.filter((x) => 판OCR.some((y) => y !== x && Math.abs(Math.abs(y.초 - x.초) - 간격) < 0.01 && 겹침(x.상자, y.상자)));
    if (머문.length) out.push(찾음(고칠, '단추가림', `${자리말[자리]}${곳말}에 글이 0.5초 넘게 들어가 있다(글자 인식) — ${머문.length}장면 · 가장 많이 ${많이(머문)}px(${초들(머문)})`));
    const 잠깐 = 판OCR.filter((x) => !머문.includes(x));
    if (잠깐.length) out.push(찾음(확인, '단추가림', `${자리말[자리]}${곳말}에 글이 잠깐 들어간다(글자 인식) — ${잠깐.length}장면 · 가장 많이 ${많이(잠깐)}px(${초들(잠깐)}) — 들어오고 나가는 움직임일 수 있다`));
    const 차이 = list.filter((x) => !x.기준 && x.상자.출처 === '차이');
    if (차이.length) out.push(찾음(확인, '단추가림차이', `${자리말[자리]}${곳말}에 기준 판과 다른 것이 걸린다(픽셀 차이) — ${차이.length}장면 · 가장 많이 ${많이(차이)}px(${초들(차이)}). 이 판 글인지, 글 길이에 맞춰 커진 판 · 말풍선인지 좁은 여백 그림으로 본다`));
    const 기준것 = list.filter((x) => x.기준);
    if (기준것.length) out.push(찾음(확인, '단추가림기준', `${자리말[자리]}${곳말}에 걸린 것이 기준 판 글 자리와 겹치거나 기준 판과 화소가 같다(정본의 그림 · 글) — ${기준것.length}장면 · 가장 많이 ${많이(기준것)}px(${초들(기준것)}). 이 판 글도 넘는지 좁은 여백 그림으로 본다`));
  }
  // 여백이 가장 좁은 장면 셋 — 1초 넘게 떨어지고 서로 다른 글 자리로
  const 좁은 = [];
  for (const m of [...여백들].sort((a, b) => a.점수 - b.점수)) {
    if (좁은.some((x) => Math.abs(x.초 - m.초) < 1 || 겹침(x.상자, m.상자))) continue;
    좁은.push(m);
    if (좁은.length === 3) break;
  }
  // 글자 인식을 못 믿는 언어(my · th · km · si · hi · ne · vi)는 기준이 있어도 렌더 뒤 「고칠 것」을 낼 수 없다(픽셀 차이는 확인할 것까지만) —
  // 기계가 이 판 글을 못 읽었으니 「못 봄」이다. 넘기려면 글이 바뀌는 장면의 프레임을 직접 보고 --직접봄으로 적는다(11-11 P2-5).
  if (언어p && 언어p.글자인식 && 언어p.글자인식.쓸만함 === false) {
    const 몫 = `윈도우 OCR이 ${언어p.이름} 글 자리를 ${Math.round((언어p.글자인식.줄위치 || 0) * 100)}%만 잡아 글자 인식을 쓰지 않았다`;
    out.push(찾음(확인, '인식못함', 프레임들.some((f) => f.기준있음)
      ? `${몫} — 글 자리는 기준 판과의 픽셀 차이로만 잡아 렌더 뒤 「고칠 것」(단추 가림)을 낼 수 없다. 글이 바뀌는 장면의 프레임을 직접 본다`
      : `${몫} — 기준 영상(--기준)이 없어 픽셀 차이로도 보지 못했다. 단추 가림은 글이 바뀌는 장면의 프레임을 직접 본다`));
  }
  if (!프레임들.length) out.push(찾음(확인, '프레임없음', '영상에서 프레임을 하나도 못 뽑았다 — 렌더 뒤 검사(안전 영역 · 단추 가림 · 좁은 여백)를 못 했다'));
  return { 찾음: out, 좁은 };
}

/** OCR 상자 하나가 정본의 그림 · 글인가 — 안전 영역 밖으로 나간 띠마다 기준 판 하나와라도 화소가 같으면 그렇다(판프레임 · 기준프레임들은 회색 반 크기 프레임).
 *  기준 판은 다른 말 판이다(판본 명령이 같은 말 판을 뺀다 — P2-5). 다른 말 판과 화소가 같은 띠는 말에 따라 달라지지 않는 것(그림 · 한글 딱지)이지
 *  이 판본이 옮긴 글이 아니다. 차이 덩어리가 「모든 기준과 다른 화소」만 이 판 것으로 보는 것과 같은 잣대다.
 *  「모든 기준과 같을 때」로 두면 틀이 다른 기준 판이 하나 섞일 때 정본 자리가 고칠 것이 된다(11-11 실측 — 화날때 몽골판은 hookMotion false라
 *  첫 화면에 한글 딱지가 없다. 같은 말 판을 기준에서 뺀 뒤 영어 판본이 MN + BR을 기준으로 받아 딱지 넷이 「단추가림」 고칠 것으로 떴다). */
function 정본같은가(b, 판프레임, 기준프레임들, SAFE = 안전영역()) {
  const 띠들 = 넘은띠들(b, SAFE);
  return 기준프레임들.length > 0 && 띠들.length > 0 && 띠들.every((t) => 기준프레임들.some((r) => 다른화소비율(판프레임, r, t) < 0.02));
}

/** 기준 판마다 읽은 OCR 상자(판마다 프레임별 배열)를 i번째 프레임에서 하나로 모은다 — 못 읽은 판(null)은 건너뛴다 */
function 기준상자모으기(읽은들, i) {
  return 읽은들.flatMap((r) => (r && r[i]) || []);
}

/** 영상(판본) [+ 기준 영상] → 프레임 판정 + 좁은 여백 세 장(원본 해상도 1:1 잘라 냄).
 *  기준밀림[k](초) — 기준 판 k를 시간축에서 미는 값(이 판의 인사 길이 − 기준 판의 인사 길이, 렌더.json 「인사초」). 안 밀면 인사가 있는 판은
 *  모든 프레임이 인사 길이만큼 어긋난 기준 프레임과 견줘져, 정본의 그림을 글로 읽은 OCR 헛글이 「정본과 같은 화소」로 내려가지 못한다(11-12 「미안 · 죄송합니다」
 *  영어권 넷 ← 몽골판: 5.5~10초 몽글 몸 · 원두 분쇄기가 실행마다 다른 판본에서 「단추가림」 고칠 것). */
function 프레임검사({ 영상, 기준 = [], 기준밀림 = [], 언어p, 플랫폼 = null, 밖 }) {
  fs.mkdirSync(밖, { recursive: true });
  for (const f of fs.readdirSync(밖)) if (/^좁은여백_/.test(f)) fs.rmSync(path.join(밖, f), { force: true });
  const 정보 = 길이(영상);
  const out = [];
  if (정보.폭 && (정보.폭 !== 1080 || 정보.높이 !== 1920)) out.push(찾음(확인, '해상도', `영상이 ${정보.폭}×${정보.높이}다 — 안전 영역은 1080×1920 기준으로 늘려 본다`));
  const 판 = 회색프레임(영상);
  const 기준들 = 기준.map((v, k) => ({ 파일: v, 밀림: Number(기준밀림[k]) || 0, f: 회색프레임(v, Number(기준밀림[k]) || 0) }));
  for (const b of 기준들) if (Math.abs(b.f.n - 판.n) > 1) out.push(찾음(확인, '기준길이', `기준 영상 ${path.basename(b.파일)}의 길이가 다르다(프레임 ${b.f.n} ↔ ${판.n}) — 같은 정본에서 렌더한 판이 아니면 차이가 엉뚱하게 잡힌다`));
  const n = Math.min(판.n, ...기준들.map((b) => b.f.n));
  // OCR — 판본(믿을 만한 언어만) · 기준(모든 기준 판, 넘은 자리 가르기용). 첫째 기준만 읽으면 틀이 다른 판이 첫째일 때(화날때 영어 판본의
  // 기본 기준은 MN + BR — 몽골판은 첫 화면 꼴이 다르다) 같은 틀 둘째 기준에 있는 정본 글 자리(한글 딱지 · 게이지 이름표 · 말풍선 끝)를 못 덮는다(11-11).
  const ocr방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-글자검사-ocr-'));
  let 판OCR = null, 기준OCR = null;
  try {
    const 뽑기 = (video, sub, 밀림 = 0) => {
      const d = path.join(ocr방, sub);
      fs.mkdirSync(d, { recursive: true });
      ffmpeg(['-i', video, '-vf', 표본필터(밀림), '-q:v', '3', path.join(d, 'f%04d.jpg')], `${sub} 프레임`);
      return 글자인식(d).sort((a, b) => a.name.localeCompare(b.name)).map(OCR상자);
    };
    if (!언어p || 언어p.글자인식?.쓸만함 !== false) {
      try { 판OCR = 뽑기(영상, '판'); } catch (e) { out.push(찾음(확인, '글자인식실패', `판본 글자 인식 실패(${e.message})`)); }
    }
    if (기준들.length) {
      const 읽은들 = 기준들.map((b, k) => {
        try { return 뽑기(b.파일, `기준${k}`, b.밀림); } catch (e) {
          out.push(찾음(확인, '글자인식실패', `기준 판 ${path.basename(path.dirname(b.파일))}/${path.basename(b.파일)} 글자 인식 실패(${e.message}) — 넘은 자리를 그 기준 판 글과 가르지 못한다`));
          return null;
        }
      });
      if (읽은들.some(Boolean)) 기준OCR = 읽은들;
    }
  } finally {
    try { fs.rmSync(ocr방, { recursive: true, force: true }); } catch { /* 청소 실패는 결과와 무관 */ }
  }
  const 프레임들 = [];
  for (let i = 0; i < n; i += 1) {
    const j = i > 0 ? i - 1 : Math.min(i + 1, n - 1);
    const 덩어리 = 기준들.length
      ? 차이덩어리(판.at(i), 기준들.map((b) => b.f.at(i)), { 이웃: 판.at(j), 기준이웃: 기준들.map((b) => b.f.at(j)) }).map((b) => ({ ...b, 출처: '차이' }))
      : [];
    // OCR이 그림(펠트 결 · 병 · 전등)을 글로 읽는 일이 잦고, 그 헛글은 판본마다 다르게 잡혀 기준 판 OCR 상자로는 설명이 안 된다(11-10 판본 시범 —
    // 같은 영상이 기준 판에 따라 통과 · 고칠 것을 오갔다). 안전 영역 밖으로 나간 띠의 화소가 기준 판(다른 말 판)과 같으면 정본의 그림 · 글이지 이 판본 글이 아니다(정본같은가).
    const 기준프레임들 = 기준들.map((r) => r.f.at(i));
    const ocr = (판OCR?.[i] || []).map((b) => ({ ...b, 출처: 'ocr', 정본같음: 정본같은가(b, 판.at(i), 기준프레임들) }));
    프레임들.push({ 초: Math.round(i * 간격 * 10) / 10, 번호: i, 판본상자: [...ocr, ...덩어리], 기준상자: 기준OCR ? 기준상자모으기(기준OCR, i) : [], 기준있음: 기준들.length > 0 });
  }
  const 판정 = 프레임판정(프레임들, { 플랫폼, 언어p });
  out.push(...판정.찾음);
  const SAFE = 안전영역();
  const 그림 = [];
  판정.좁은.forEach((m, k) => {
    // 차이를 잰 것과 같은 프레임(fps 필터의 m.번호째)을 뽑는다 — -ss로 찾으면 한 프레임 어긋나 다른 순간이 나온다(11-10 실측)
    const 고르기 = `fps=${1 / 간격},select=eq(n\\,${m.번호})`;
    const 크기 = 600;
    const cx = Math.max(0, Math.min(1080 - 크기, Math.round(m.점.x - 크기 / 2)));
    const cy = Math.max(0, Math.min(1920 - 크기, Math.round(m.점.y - 크기 / 2)));
    const b = m.상자;
    const 선 = `drawbox=x=${SAFE.left}:y=${SAFE.top}:w=${SAFE.right - SAFE.left}:h=${SAFE.bottom - SAFE.top}:color=lime@0.85:t=3,drawbox=x=${Math.round(b.x0)}:y=${Math.round(b.y0)}:w=${Math.max(2, Math.round(b.x1 - b.x0))}:h=${Math.max(2, Math.round(b.y1 - b.y0))}:color=red@0.85:t=3`;
    const 이름 = `좁은여백_${k + 1}_${m.초.toFixed(1)}초_${m.자리}`;
    const 자른 = path.join(밖, `${이름}.png`);
    const 전체 = path.join(밖, `${이름}_전체.png`);
    try {
      ffmpeg(['-i', 영상, '-vf', `${고르기},scale=1080:1920,${선},crop=${크기}:${크기}:${cx}:${cy}`, '-frames:v', '1', 자른], '좁은 여백 자르기');
      ffmpeg(['-i', 영상, '-vf', `${고르기},scale=1080:1920,${선}`, '-frames:v', '1', 전체], '좁은 여백 전체');
      그림.push({ 초: m.초, 여백: Math.round(m.값), 자리: 자리말[m.자리], 자른, 전체 });
    } catch (e) {
      out.push(찾음(확인, '그림실패', `좁은 여백 그림을 못 만들었다(${e.message})`));
    }
  });
  if (그림.length) out.push(찾음(확인, '좁은여백', `여백이 가장 좁은 장면 ${그림.length}장(${그림.map((g) => `${g.초}초 ${g.자리} ${g.여백}px`).join(' · ')})을 원본 해상도로 잘라 두었다 — 눈으로 본다(${path.relative(REPO, 밖).split(path.sep).join('/')})`));
  return { 찾음: out, 좁은: 그림, 프레임수: n, OCR: { 판본: Boolean(판OCR), 기준: Boolean(기준OCR) } };
}

// ── 확인할 것의 두 갈래(11-11 Fable 5.2 끝 판 검수 P2-5) ─────────────────
// 판단: 기계가 재고 사람이 그대로 둘지 정한다 → --눈확인 메모로 넘긴다.
// 못봄: 기계가 그 칸을 아예 못 쟀다 → --눈확인으로는 못 넘기고, --직접봄 "<어느 프레임(초)에서 무엇을 봤는지>"가 있어야 넘긴다.
// 표에 없는 코드는 못봄으로 본다(새 코드를 더하고 표를 잊어도 메모 하나로 통과되지 않게) — 시험이 두 파일의 코드가 다 표에 있는지 본다.
const 판단 = '판단', 못봄 = '못봄';
const 갈래말 = { [판단]: '판단', [못봄]: '못 봄' };
const 갈래표 = {
  [판단]: [
    '정규화', '보이지않는글자', '공백', '문장부호', '낱말중간줄바꿈', '번역빠짐', '읽기시간', // 렌더 전 규칙
    '기호대체', '라틴글꼴부호', '넘침어림', // 글꼴 — 시스템 글꼴 · 라틴 글꼴이 맡은 글자는 쟀고, 꼴이 괜찮은지는 사람이 본다
    '테두리닿음', '자동줄바꿈', '대체글꼴', // 엔진 잼
    '해상도', '단추가림', '단추가림차이', '단추가림기준', '좁은여백', // 렌더 뒤 — 잰 자리 · 그림을 사람이 본다
    '기준같은말', // 같은 말 판을 기준으로 줘서 뺐다 — 알림
    '기준검수없음', // 글자 검사 통과 기록이 지금 영상과 맞지 않는 판을 기준에서 뺐다 · 씨앗 판만 기준으로 썼다 — 알림(P1-글1)
  ],
  [못봄]: [
    '글없음', '글이음', // 판본 글이 없거나 지도가 뽑는 글이 아니다 — 렌더 전 검사를 (바른 글로) 못 했다
    '글꼴검사못함', '모르는글꼴', // 네모 글자 · 결합 깨짐을 못 쟀다
    '엔진못함', '엔진잼없음', // 크롬 잼을 못 했다 · --엔진없이로 건너뛰었다
    '인식못함', '글자인식실패', '기준길이', '프레임없음', '그림실패', // 렌더 뒤 글 자리를 못 읽었다 · 기준 판을 맞춰 보지 못했다 · 볼 그림이 없다
  ],
};
function 갈래(코드) {
  return 갈래표[판단].includes(코드) ? 판단 : 못봄;
}
/** 확인할 것에 「갈래」를 붙인 새 목록(고칠 것은 그대로) */
function 갈래붙이기(찾음들) {
  return 찾음들.map((f) => (f.수준 === 확인 ? { ...f, 갈래: 갈래(f.코드) } : f));
}
const 메모있음 = (s) => typeof s === 'string' && s.trim().length > 0;

/** 찾음 목록 → { 판정, 판단 · 못봄(확인할 것 코드), 넘긴 · 남은({ 판단, 못봄 } 코드) }.
 *  고칠 것은 어떤 메모로도 못 넘긴다. 판단은 눈확인으로, 못봄은 직접봄으로만 넘긴다(직접봄이 판단까지 넘기지 않는다 — 두 메모는 따로 남는다). */
function 판정풀이(찾음들, { 눈확인 = null, 직접봄 = null } = {}) {
  const 코드 = (g) => [...new Set(찾음들.filter((f) => f.수준 === 확인 && 갈래(f.코드) === g).map((f) => f.코드))];
  const 갈래별 = { [판단]: 코드(판단), [못봄]: 코드(못봄) };
  const 넘김 = { [판단]: 메모있음(눈확인), [못봄]: 메모있음(직접봄) };
  const 넘긴 = {}, 남은 = {};
  for (const g of [판단, 못봄]) (넘김[g] ? 넘긴 : 남은)[g] = 갈래별[g];
  const 남음 = Object.values(남은).some((xs) => xs.length);
  const 판정 = 찾음들.some((f) => f.수준 === 고칠) ? 고칠 : (남음 ? 확인 : 통과);
  return { 판정, ...갈래별, 넘긴: { [판단]: 넘긴[판단] || [], [못봄]: 넘긴[못봄] || [] }, 남은: { [판단]: 남은[판단] || [], [못봄]: 남은[못봄] || [] } };
}

/** 찾음 목록 → 판정. 판단만 남았으면 눈확인 메모로, 못봄이 있으면 직접봄 메모까지 있어야 통과. */
function 판정하기(찾음들, 메모 = {}) {
  return 판정풀이(찾음들, 메모).판정;
}

module.exports = {
  고칠, 확인, 통과, 규칙검사, 읽기시간검사, 글꼴검사, 엔진재기, 엔진판정, 엔진html, 프레임검사, 프레임판정, 차이덩어리, OCR상자, 넘은띠들, 다른화소비율,
  정본같은가, 기준상자모으기, 밀기필터,
  판정하기, 판정풀이, 갈래, 갈래표, 갈래말, 갈래붙이기, 판단, 못봄, 안전영역, 낱말경계들, 자소수, 찾음, 띄어쓰기손줄바꿈, 모음없는조각,
};
