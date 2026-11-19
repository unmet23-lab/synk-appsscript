#!/usr/bin/env node
'use strict';
/**
 * 공모 지도 — 공모전과 지원사업이 지금 어느 단계에 있는지 한 장으로 보이는 페이지를 만든다(2026-11-18).
 *
 * 왜: 신청현황.md는 글이 긴 표라 한눈에 안 보였고, 상태 칸의 말이 스무 가지로 제각각이었다.
 *   곁 세션이 맡은 공모는 각 폴더의 제출기록에만 있어 장부에서 빠지기도 했다.
 *   유호님 11-17 「공모전 진행중, 완료 이런거 한눈에 볼수있는 지도같은거」, 「ai영상관련 공모전만 분류해놓으면」.
 *
 * 읽는 것(비공개 보관함, 저장소 밖):
 *   SYNK-보관함/지원사업/신청현황.json — 항목마다 stage(준비 중 · 결과 기다림 · 선정 · 안 됨 · 접음), kind, ai_video,
 *     deadline(준비 중), owner, result({date|text}), next_event({date,text}).
 *   SYNK-보관함/지원사업/통합목록.json — 마감이 안 지난 공고의 ai_video.value(「AI 영상」 · 「영상」 · 「아님」).
 *   SYNK-보관함/지원사업/자격판정.json — 응모 자격 판정(tools/공모자격.js). 「안 됨」은 열린 공모에서 빼고, 판정이 「됨」이 아니면 「자격 확인 필요」를 단다(11-20).
 * 만드는 것: 저장소의 .tmp/공모지도/공모지도.html(git 밖). 그 파일을 Artifact 도구로 공모지도.json의 주소에 다시 올린다.
 *
 * 쓰기:
 *   node tools/공모지도.js            지도를 만들고, 빠진 칸이 있으면 알리고, 올릴 주소를 알려 준다
 *   node tools/공모지도.js --검사      만들지 않고 빠진 칸만 본다(빠진 칸이 있으면 종료 코드 1)
 *   node tools/공모지도.js --보관함 <폴더>   다른 지원사업 폴더를 읽는다(시험용)
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const 그록 = require('./lib/grok-contests.cjs');
const { includeReviews } = require('./lib/contest-map-review.cjs');
const 자격 = require('./lib/contest-eligibility.cjs');

const 단계들 = ['준비 중', '결과 기다림', '선정', '안 됨', '접음'];
const 기본보관함 = path.join(os.homedir(), 'Documents', 'SYNK-보관함', '지원사업');
const 출력폴더 = path.join(__dirname, '..', '.tmp', '공모지도');

/** 한국 시각의 오늘(YYYY-MM-DD). */
function 오늘(지금 = new Date()) {
  return new Date(지금.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
}

/** 화면에 쓸 짧은 이름 — 끝의 괄호 설명(공고 번호, 주최)을 걷는다. 전체 이름은 따로 둔다. */
function 짧은이름(이름) {
  let s = String(이름 || '').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i++) {
    const m = /^(.{8,}?)\s*\((?:[^()]|\([^()]*\))*\)\s*$/.exec(s);
    if (!m) break;
    s = m[1].trim();
  }
  return s;
}

function 정규(t) { return String(t || '').replace(/[^가-힣A-Za-z0-9]/g, '').toLowerCase(); }

/** 통합목록 항목의 마감(YYYY-MM-DD). 모르면 빈 글. */
function 공고마감(o) {
  const r = (o.historical_assessment || {}).record || {};
  return o.grok_contest?.deadline.date || (o.calendar_20261110 || {}).end || r.end || (o.grok_contest ? '' : o.grok_20261117?.end) || '';
}

/** 통합목록 항목의 원문 주소 하나. */
function 공고주소(o) {
  const r = (o.historical_assessment || {}).record || {};
  const 후보 = [o.grok_contest?.officialUrl];
  for (const l of r.links || []) if (l && l.url) 후보.push(l.url);
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (v && typeof v === 'object' && typeof v.url === 'string') 후보.push(v.url);
  }
  return 후보.find((u) => /^https?:\/\//.test(u)) || o.grok_contest?.discoveryUrl || '';
}

/** 신청현황 항목 하나를 지도 카드로 바꾼다. */
function 카드(o) {
  return {
    id: o.id,
    이름: 짧은이름(o.name),
    전체이름: o.name,
    단계: o.stage || '',
    갈래: o.kind || '공모전',
    ai영상: o.ai_video === true,
    마감: o.deadline || '',
    맡은곳: o.owner || '',
    결과: o.result || null,
    다음: o.next_event || null,
  };
}

/** 빠진 칸을 찾는다. 지도는 그래도 만들지만 알린다. */
function 검사(현황) {
  const 문제 = [];
  for (const o of 현황.items || []) {
    const 이름 = 짧은이름(o.name);
    if (!단계들.includes(o.stage)) { 문제.push(`${이름}: stage가 없거나 다섯 가지 밖이다(${o.stage || '없음'})`); continue; }
    if (o.stage === '준비 중' && !/^\d{4}-\d{2}-\d{2}/.test(o.deadline || '')) 문제.push(`${이름}: 준비 중인데 deadline(마감)이 없다`);
    if (o.stage === '준비 중' && !o.owner) 문제.push(`${이름}: 준비 중인데 owner(맡은 세션)가 없다`);
    if (o.stage === '결과 기다림' && !(o.result && (o.result.date || o.result.text))) 문제.push(`${이름}: 결과 기다림인데 result(발표일이나 설명)가 없다`);
    if (typeof o.ai_video !== 'boolean') 문제.push(`${이름}: ai_video(참 · 거짓)가 없다`);
  }
  return 문제;
}

/** 접수 중인 영상 공모 — 통합목록에서 ai_video가 「AI 영상」이나 「영상」이고, 마감이 안 지났고, 신청현황에 없고, 자격 판정이 「안 됨」이 아닌 것. */
function 열린영상(통합, 현황, 기준일, 지금, 자격판정 = null) {
  const 현황id = new Set((현황.items || []).map((o) => o.id));
  const 현황이름 = (현황.items || []).map((o) => 정규(짧은이름(o.name)));
  const 겹침 = (제목) => {
    const n = 정규(제목);
    if (n.length < 6) return false;
    return 현황이름.some((x) => x.length >= 6 && (x.includes(n.slice(0, 12)) || n.includes(x.slice(0, 12))));
  };
  const 나옴 = [];
  for (const o of 통합.items || []) {
    const 그록공고 = o.grok_contest;
    if (그록공고?.accepting === false || 그록공고?.ai.status === 'prohibited' || /^(포기|자격 미달|제외)$/.test(o.application_status?.state || o.application_status || '')) continue;
    const 기존값 = o.ai_video?.value;
    const 영상 = 그록공고?.video ?? ['AI 영상', '영상'].includes(기존값);
    const 허용 = { allowed: '허용', conditional: '조건부 허용', unconfirmed: '확인 필요' }[그록공고?.ai.status];
    const 값 = 그록공고
      ? (영상 ? (허용 === '허용' || 허용 === '조건부 허용' ? 'AI 영상' : '영상') : '기타 공모')
      : 기존값;
    if (값 !== 'AI 영상' && 값 !== '영상' && !그록공고) continue;
    const 마감 = 공고마감(o);
    if (마감 && 마감 < 기준일) continue;
    const 시각 = 그록공고?.deadline.kst;
    if (시각 && 지금 && Date.parse(시각) <= +지금) continue;
    if (현황id.has(o.id) || 겹침(o.title)) continue;
    const 판정 = 자격판정 ? 자격.판정찾기(자격판정, o.title) : null;
    if (판정?.status === '안 됨') continue;
    나옴.push({
      id: o.id,
      이름: 짧은이름(o.title),
      전체이름: o.title,
      값,
      마감,
      마감글: 시각 ? 시각.slice(0, 16).replace('T', ' ') + ' KST'
        : 그록공고 ? (그록공고.deadline.date || '') : (o.grok_20261117?.deadline_text || ''),
      근거: 그록공고 ? [
        'AI 사용 ' + 허용,
        그록공고.ai.quote,
        그록공고.deliverables.items.length
          ? '제출물은 ' + 그록공고.deliverables.items.join(', ') + '입니다.'
          : '제출물은 공식 원문에서 확인이 필요합니다.',
      ].filter(Boolean).join('. ').replace(/\.\./g, '.') : (o.ai_video?.basis || ''),
      주소: 공고주소(o),
      원문확인안함: 그록공고 ? !그록공고.officialUrl : !!o.grok_20261117,
      자격: 판정?.status || '확인 전',
      ...(판정?.quote && { 자격근거: 판정.quote }),
      ...(그록공고 && {
        그록: !그록공고.geminiOnly, ...(그록공고.reviewed && { 카본확인: true }), AI허용: 허용, AI주소: 그록공고.ai.url, 마감주소: 그록공고.deadline.url,
        제출물: 그록공고.deliverables.items, 제출물주소: 그록공고.deliverables.url,
      }),
    });
  }
  나옴.sort((a, b) => (a.마감 || '9999') .localeCompare(b.마감 || '9999') || a.이름.localeCompare(b.이름, 'ko'));
  return 나옴;
}

function 자료만들기(현황, 통합, 지금 = new Date(), 자격판정 = null) {
  const 기준일 = 오늘(지금);
  return {
    기준: new Date(지금.getTime() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' '),
    기준일,
    진행: (현황.items || []).map(카드),
    열린: 열린영상(통합, 현황, 기준일, 지금, 자격판정),
  };
}

const 안전 = (s) => String(s).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

function 페이지(자료, 폰트블록 = '') {
  return `<title>공모 지도</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="claude:viewport-fit-sides" content="cover">
${폰트블록}
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter+Tight:wght@600;800&display=swap">
<style>
/* 판: 밤 바탕 위 큰 한글 제목, 1px 선으로 나눈 계기판, 단계 넷을 왼쪽에서 오른쪽으로 흐르는 판, 아래에 낼 수 있는 AI 영상 공모 */
:root {
  --bg: #060709; --panel: #0C0D10; --s1: #121317; --s2: #191A1F;
  --ink: #FAFAF9; --ink2: rgba(250,250,249,.72); --ink3: rgba(250,250,249,.52); --ink4: rgba(250,250,249,.22);
  --line: rgba(255,255,255,.075); --line2: rgba(255,255,255,.14);
  --berry: #99295D; --berry-ink: #FFFFFF; --berry-soft: rgba(153,41,93,.28);
  --led-prep: #F5C445; --led-wait: #6F95E0; --led-win: #7DB38A; --led-end: rgba(250,250,249,.32);
  --warn: #F96859; --warn-soft: rgba(249,104,89,.14);
  --sel-bg: #FAFAF9; --sel-ink: #08090C;
  --f-ko: 'SUIT Variable', 'SUIT', 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif;
  --f-mono: 'DM Mono', ui-monospace, 'Cascadia Mono', Consolas, monospace;
  --f-lat: 'Inter Tight', 'Inter', system-ui, sans-serif;
  color-scheme: dark;
}
@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) {
  --bg: #ECECEA; --panel: #FFFFFF; --s1: #F5F5F4; --s2: #EDEDEB;
  --ink: #08090C; --ink2: rgba(8,9,12,.70); --ink3: rgba(8,9,12,.56); --ink4: rgba(8,9,12,.20);
  --line: rgba(0,0,0,.08); --line2: rgba(0,0,0,.15);
  --berry: #99295D; --berry-ink: #FFFFFF; --berry-soft: rgba(153,41,93,.12);
  --led-prep: #C99A12; --led-wait: #3D6BC9; --led-win: #3F7A4E; --led-end: rgba(8,9,12,.28);
  --warn: #C8412F; --warn-soft: rgba(200,65,47,.10);
  --sel-bg: #08090C; --sel-ink: #FAFAF9;
  color-scheme: light;
} }
:root[data-theme="light"] {
  --bg: #ECECEA; --panel: #FFFFFF; --s1: #F5F5F4; --s2: #EDEDEB;
  --ink: #08090C; --ink2: rgba(8,9,12,.70); --ink3: rgba(8,9,12,.56); --ink4: rgba(8,9,12,.20);
  --line: rgba(0,0,0,.08); --line2: rgba(0,0,0,.15);
  --berry: #99295D; --berry-ink: #FFFFFF; --berry-soft: rgba(153,41,93,.12);
  --led-prep: #C99A12; --led-wait: #3D6BC9; --led-win: #3F7A4E; --led-end: rgba(8,9,12,.28);
  --warn: #C8412F; --warn-soft: rgba(200,65,47,.10);
  --sel-bg: #08090C; --sel-ink: #FAFAF9;
  color-scheme: light;
}
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--ink); font-family: var(--f-ko); font-size: 15px; line-height: 1.5; word-break: keep-all; overflow-wrap: anywhere; }
.wrap { max-width: 1480px; margin: 0 auto; padding-block: 28px 64px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; gap: 28px; }
.label { font-family: var(--f-mono); font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink3); }
.num { font-family: var(--f-mono); font-variant-numeric: tabular-nums; }
header { display: grid; gap: 14px; }
.top { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; border-bottom: 1px solid var(--line2); padding-bottom: 10px; }
h1 { margin: 0; font-weight: 800; font-size: clamp(64px, 13vw, 168px); line-height: .9; letter-spacing: -.065em; text-wrap: balance; }
.sub { margin: 0; color: var(--ink2); max-width: 62ch; }
.dials { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); border: 1px solid var(--line2); border-radius: 14px; background: var(--panel); overflow: hidden; }
.dial { padding: 14px 16px; display: grid; gap: 4px; border-left: 1px solid var(--line); min-width: 0; }
.dial:first-child { border-left: 0; }
.dial b { font-family: var(--f-mono); font-weight: 500; font-size: clamp(26px, 3.4vw, 40px); line-height: 1; font-variant-numeric: tabular-nums; }
.dial span { font-size: 13px; color: var(--ink2); display: flex; align-items: center; gap: 7px; }
.dial.warn b { color: var(--warn); }
.led { width: 8px; height: 8px; border-radius: 50%; flex: none; background: var(--led-end); }
.led.prep { background: var(--led-prep); } .led.wait { background: var(--led-wait); } .led.win { background: var(--led-win); } .led.warn { background: var(--warn); }
.bar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.pill { font: inherit; font-size: 14px; border: 1px solid var(--line2); background: transparent; color: var(--ink); padding: 7px 14px; border-radius: 999px; cursor: pointer; }
.pill[aria-pressed="true"] { background: var(--sel-bg); color: var(--sel-ink); border-color: var(--sel-bg); }
.pill:focus-visible, a:focus-visible, summary:focus-visible { outline: 2px solid var(--led-wait); outline-offset: 2px; }
.board { display: grid; grid-template-columns: 1.05fr 1.35fr 1fr .9fr; gap: 12px; align-items: start; }
.col { background: var(--panel); border: 1px solid var(--line2); border-radius: 16px; min-width: 0; display: grid; }
.col > h2 { margin: 0; padding: 14px 16px; font-size: 17px; font-weight: 700; display: flex; align-items: center; gap: 9px; border-bottom: 1px solid var(--line); }
.col > h2 .num { margin-left: auto; font-size: 13px; color: var(--ink3); font-weight: 400; }
.list { display: grid; }
.item { padding: 13px 16px; border-top: 1px solid var(--line); display: grid; gap: 5px; min-width: 0; }
.item:first-child { border-top: 0; }
.item .name { font-weight: 650; line-height: 1.35; }
.item .meta { font-size: 13px; color: var(--ink2); display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; }
.item .note { font-size: 13px; color: var(--ink3); }
.dday { font-family: var(--f-mono); font-variant-numeric: tabular-nums; font-size: 26px; line-height: 1; font-weight: 500; letter-spacing: -.02em; }
.dday.hot { color: var(--warn); }
.prep .item { grid-template-columns: 64px minmax(0, 1fr); column-gap: 12px; }
.prep .item > .dday { grid-row: span 3; padding-top: 2px; }
.tags { display: flex; gap: 6px; flex-wrap: wrap; }
.tag { font-size: 12px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--line2); color: var(--ink2); white-space: nowrap; }
.tag.ai { background: var(--berry); border-color: var(--berry); color: var(--berry-ink); }
.tag.warn { background: var(--warn-soft); border-color: transparent; color: var(--warn); }
.tag.kind { color: var(--ink3); }
.when { font-family: var(--f-mono); font-variant-numeric: tabular-nums; font-size: 12.5px; color: var(--ink2); white-space: nowrap; }
.sec { font-size: 12px; color: var(--ink3); padding: 10px 16px 6px; border-top: 1px solid var(--line); }
details > summary { list-style: none; cursor: pointer; padding: 11px 16px; border-top: 1px solid var(--line); color: var(--ink2); font-size: 14px; display: flex; gap: 8px; align-items: center; }
details > summary::-webkit-details-marker { display: none; }
details > summary::before { content: '+'; font-family: var(--f-mono); color: var(--ink3); width: 12px; }
details[open] > summary::before { content: '−'; }
.end .item .name { font-weight: 500; color: var(--ink2); }
.empty { padding: 16px; color: var(--ink3); font-size: 14px; }
section.open { display: grid; gap: 14px; }
section.open h2 { margin: 0; font-size: clamp(28px, 4vw, 44px); font-weight: 800; letter-spacing: -.04em; line-height: 1.05; }
.open-head { display: flex; justify-content: space-between; align-items: end; gap: 12px; flex-wrap: wrap; border-bottom: 1px solid var(--line2); padding-bottom: 12px; }
.rows { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); column-gap: 28px; }
.row { display: grid; grid-template-columns: 64px minmax(0, 1fr); column-gap: 12px; row-gap: 4px; padding: 14px 0; border-bottom: 1px solid var(--line); min-width: 0; align-content: start; }
.row > .dday { grid-row: span 3; font-size: 22px; padding-top: 2px; }
.row .name { font-weight: 650; line-height: 1.35; }
.row .name a { color: inherit; text-decoration: none; border-bottom: 1px solid var(--line2); }
.row .name a:hover { border-bottom-color: currentColor; }
.row .note { font-size: 13px; color: var(--ink3); }
.row > :not(.dday), .prep .item > :not(.dday) { grid-column: 2; }
.foot { font-size: 13px; color: var(--ink3); border-top: 1px solid var(--line2); padding-top: 12px; display: grid; gap: 4px; }
@media (max-width: 1100px) { .board { grid-template-columns: 1fr 1fr; } }
@media (max-width: 720px) {
  .board { grid-template-columns: 1fr; }
  .dials { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .dial:nth-child(4) { border-left: 0; }
  .dial:nth-child(n+4) { border-top: 1px solid var(--line); }
}
@media (prefers-reduced-motion: no-preference) { .pill { transition: background .15s, color .15s; } }
</style>

<div class="wrap">
  <header>
    <div class="top"><span class="label">SYNK · Contest map</span><span class="label num" id="asof"></span></div>
    <h1>공모 지도</h1>
    <p class="sub">낸 공모와 준비 중인 공모가 지금 어느 단계에 있는지 한 장에 모았습니다. 남은 날은 이 페이지를 연 때를 기준으로 셉니다.</p>
    <div class="dials" id="dials"></div>
    <div class="bar" role="group" aria-label="보기 고르기">
      <button class="pill" id="f-all" type="button" aria-pressed="true">전체</button>
      <button class="pill" id="f-ai" type="button" aria-pressed="false">AI 영상만</button>
    </div>
  </header>
  <div class="board" id="board"></div>
  <section class="open" aria-labelledby="open-title">
    <div class="open-head">
      <div><span class="label">Open calls · AI video</span><h2 id="open-title">낼 수 있는 AI 영상 공모</h2></div>
      <div class="bar" role="group" aria-label="영상 공모 고르기">
        <button class="pill" id="o-ai" type="button" aria-pressed="true">AI 영상</button>
        <button class="pill" id="o-all" type="button" aria-pressed="false">AI 확인 필요 영상까지</button>
      </div>
    </div>
    <div class="rows" id="open"></div>
  </section>
  <div class="foot">
    <span>자료: 비공개 보관함 지원사업 폴더의 신청현황과 통합목록. 세션이 장부를 고친 뒤 지도를 다시 만들어 올립니다.</span>
    <span>「그록 보고」 표시는 그록 봇이 찾아 알려 준 공고로, 아직 원문을 열어 확인하지 않았습니다.</span>
  </div>
</div>

<script>
const 자료 = ${안전(JSON.stringify(자료))};
const 요일 = ['일','월','화','수','목','금','토'];
function kstNow() { return new Date(Date.now() + 9 * 3600e3); }
function 날(iso) { return new Date(iso.slice(0, 10) + 'T00:00:00Z'); }
function 남은날(iso) { const t = kstNow(); const 오늘 = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())); return Math.round((날(iso) - 오늘) / 864e5); }
function 날글(iso) { if (!iso) return ''; const d = 날(iso); const s = String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0') + '(' + 요일[d.getUTCDay()] + ')'; const tm = iso.length > 10 ? ' ' + iso.slice(11, 16) : ''; return s + tm; }
function 디데이(iso) { const n = 남은날(iso); if (n === 0) return '오늘'; return n > 0 ? 'D-' + n : 'D+' + (-n); }
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function 태그들(o) { const t = el('div', 'tags'); if (o.ai영상) t.append(el('span', 'tag ai', 'AI 영상')); if (o.갈래 !== '공모전') t.append(el('span', 'tag kind', o.갈래)); return t; }
function 결과지남(o) { return o.단계 === '결과 기다림' && o.결과 && o.결과.date && 남은날(o.결과.date) < 0; }
let 보기 = 'all', 열린보기 = 'ai';
try { 보기 = localStorage.getItem('공모지도-보기') || 'all'; 열린보기 = localStorage.getItem('공모지도-열린') || 'ai'; } catch (e) {}

function 계기판(목록) {
  const box = document.getElementById('dials'); box.textContent = '';
  const 셈 = (f) => 목록.filter(f).length;
  const 칸 = [
    ['준비 중', 'prep', 셈((o) => o.단계 === '준비 중')],
    ['결과 기다림', 'wait', 셈((o) => o.단계 === '결과 기다림')],
    ['선정', 'win', 셈((o) => o.단계 === '선정')],
    ['안 됨', '', 셈((o) => o.단계 === '안 됨')],
    ['접음', '', 셈((o) => o.단계 === '접음')],
    ['결과 확인 필요', 'warn', 셈(결과지남)],
  ];
  for (const [이름, 색, n] of 칸) {
    const d = el('div', 'dial' + (색 === 'warn' && n ? ' warn' : ''));
    d.append(el('b', '', String(n)));
    const s = el('span'); s.append(el('i', 'led ' + 색), document.createTextNode(이름)); d.append(s);
    box.append(d);
  }
}

function 칸(제목, 색, n, cls) {
  const c = el('section', 'col ' + (cls || ''));
  const h = el('h2'); h.append(el('i', 'led ' + 색), document.createTextNode(제목), el('span', 'num', n + '건'));
  c.append(h);
  return c;
}

function 준비칸(목록) {
  const xs = 목록.filter((o) => o.단계 === '준비 중').sort((a, b) => (a.마감 || '9').localeCompare(b.마감 || '9'));
  const c = 칸('준비 중', 'prep', xs.length, 'prep');
  const l = el('div', 'list');
  if (!xs.length) l.append(el('div', 'empty', '지금 준비하는 공모가 없습니다.'));
  for (const o of xs) {
    const it = el('article', 'item');
    const n = o.마감 ? 남은날(o.마감) : null;
    it.append(el('div', 'dday' + (n != null && n <= 2 ? ' hot' : ''), o.마감 ? 디데이(o.마감) : '—'));
    const nm = el('div', 'name', o.이름); nm.title = o.전체이름; it.append(nm);
    const m = el('div', 'meta'); if (o.마감) m.append(el('span', 'when', '마감 ' + 날글(o.마감))); if (o.맡은곳) m.append(el('span', '', o.맡은곳)); it.append(m);
    it.append(태그들(o));
    l.append(it);
  }
  c.append(l); return c;
}

function 기다림항목(o) {
  const it = el('article', 'item');
  const nm = el('div', 'name', o.이름); nm.title = o.전체이름; it.append(nm);
  const m = el('div', 'meta');
  if (o.결과 && o.결과.date) m.append(el('span', 'when', '발표 ' + 날글(o.결과.date)));
  if (o.결과 && o.결과.text) m.append(el('span', '', o.결과.text));
  it.append(m);
  if (o.다음 && o.다음.date) it.append(el('div', 'note', 날글(o.다음.date) + ' ' + (o.다음.text || '')));
  const t = 태그들(o); if (결과지남(o)) t.prepend(el('span', 'tag warn', '발표일 지남 · 결과 확인'));
  if (t.childNodes.length) it.append(t);
  return it;
}

function 기다림칸(목록) {
  const xs = 목록.filter((o) => o.단계 === '결과 기다림');
  const 지남 = xs.filter(결과지남).sort((a, b) => a.결과.date.localeCompare(b.결과.date));
  const 날있음 = xs.filter((o) => !결과지남(o) && o.결과 && o.결과.date).sort((a, b) => a.결과.date.localeCompare(b.결과.date));
  const 날없음 = xs.filter((o) => !(o.결과 && o.결과.date));
  const c = 칸('결과 기다림', 'wait', xs.length);
  const l = el('div', 'list');
  if (!xs.length) l.append(el('div', 'empty', '결과를 기다리는 공모가 없습니다.'));
  for (const o of 지남) l.append(기다림항목(o));
  if (날있음.length) { if (지남.length) l.append(el('div', 'sec', '발표일 순서')); for (const o of 날있음) l.append(기다림항목(o)); }
  c.append(l);
  if (날없음.length) {
    const d = el('details'); const s = el('summary'); s.append(document.createTextNode('발표일을 모르는 것 '), el('span', 'num', 날없음.length + '건')); d.append(s);
    const l2 = el('div', 'list'); for (const o of 날없음) l2.append(기다림항목(o)); d.append(l2); c.append(d);
  }
  return c;
}

function 선정칸(목록) {
  const xs = 목록.filter((o) => o.단계 === '선정').sort((a, b) => ((a.다음 || {}).date || '9').localeCompare((b.다음 || {}).date || '9'));
  const c = 칸('선정 · 본선', 'win', xs.length);
  const l = el('div', 'list');
  if (!xs.length) l.append(el('div', 'empty', '아직 뽑힌 공모가 없습니다.'));
  for (const o of xs) {
    const it = el('article', 'item');
    const nm = el('div', 'name', o.이름); nm.title = o.전체이름; it.append(nm);
    if (o.다음) { const m = el('div', 'meta'); if (o.다음.date) m.append(el('span', 'when', '다음 ' + 날글(o.다음.date) + ' · ' + 디데이(o.다음.date))); it.append(m); if (o.다음.text) it.append(el('div', 'note', o.다음.text)); }
    const t = 태그들(o); if (t.childNodes.length) it.append(t);
    l.append(it);
  }
  c.append(l); return c;
}

function 끝칸(목록) {
  const xs = 목록.filter((o) => o.단계 === '안 됨' || o.단계 === '접음');
  const c = 칸('끝남', '', xs.length, 'end');
  const l = el('div', 'list');
  if (!xs.length) l.append(el('div', 'empty', '끝난 공모가 없습니다.'));
  for (const o of xs) {
    const it = el('article', 'item');
    const nm = el('div', 'name', o.이름); nm.title = o.전체이름; it.append(nm);
    const m = el('div', 'meta'); m.append(el('span', 'tag', o.단계)); if (o.결과 && o.결과.text) m.append(el('span', '', o.결과.text)); it.append(m);
    l.append(it);
  }
  c.append(l); return c;
}

function 판() {
  const 목록 = 보기 === 'ai' ? 자료.진행.filter((o) => o.ai영상) : 자료.진행;
  계기판(목록);
  const b = document.getElementById('board'); b.textContent = '';
  b.append(준비칸(목록), 기다림칸(목록), 선정칸(목록), 끝칸(목록));
  document.getElementById('f-all').setAttribute('aria-pressed', String(보기 === 'all'));
  document.getElementById('f-ai').setAttribute('aria-pressed', String(보기 === 'ai'));
}

function 열린판() {
  const xs = 자료.열린.filter((o) => 열린보기 === 'all' || o.값 === 'AI 영상');
  const box = document.getElementById('open'); box.textContent = '';
  if (!xs.length) box.append(el('div', 'empty', '지금 열린 AI 영상 공모가 없습니다.'));
  for (const o of xs) {
    const r = el('article', 'row');
    const n = o.마감 ? 남은날(o.마감) : null;
    r.append(el('div', 'dday' + (n != null && n <= 3 ? ' hot' : ''), o.마감 ? 디데이(o.마감) : '미정'));
    const nm = el('div', 'name');
    if (o.주소) { const a = el('a', '', o.이름); a.href = o.주소; a.target = '_blank'; a.rel = 'noopener'; nm.append(a); } else nm.textContent = o.이름;
    r.append(nm);
    const m = el('div', 'meta'); m.append(el('span', 'when', o.마감 ? '마감 ' + (o.마감글 || 날글(o.마감)) : '마감 미정(다음 접수 예상)'));
    r.append(m);
    const t = el('div', 'tags');
    t.append(el('span', o.값 === 'AI 영상' ? 'tag ai' : 'tag', o.값 === 'AI 영상' ? 'AI 영상' : 'AI 확인 필요'));
    if (o.원문확인안함) t.append(el('span', 'tag warn', '그록 보고 · 원문 확인 전'));
    if (o.자격 && o.자격 !== '됨') t.append(el('span', 'tag warn', '자격 확인 필요'));
    r.append(t);
    if (o.근거) r.append(el('div', 'note', o.근거));
    box.append(r);
  }
  document.getElementById('o-ai').setAttribute('aria-pressed', String(열린보기 === 'ai'));
  document.getElementById('o-all').setAttribute('aria-pressed', String(열린보기 === 'all'));
}

function 저장() { try { localStorage.setItem('공모지도-보기', 보기); localStorage.setItem('공모지도-열린', 열린보기); } catch (e) {} }
document.getElementById('f-all').onclick = () => { 보기 = 'all'; 저장(); 판(); };
document.getElementById('f-ai').onclick = () => { 보기 = 'ai'; 저장(); 판(); };
document.getElementById('o-ai').onclick = () => { 열린보기 = 'ai'; 저장(); 열린판(); };
document.getElementById('o-all').onclick = () => { 열린보기 = 'all'; 저장(); 열린판(); };
document.getElementById('asof').textContent = '장부 기준 ' + 자료.기준 + ' KST';
판(); 열린판();
</script>
`;
}

function 읽기(폴더) {
  const 현황 = JSON.parse(fs.readFileSync(path.join(폴더, '신청현황.json'), 'utf8'));
  const 통합 = JSON.parse(fs.readFileSync(path.join(폴더, '통합목록.json'), 'utf8'));
  let 설정 = {};
  try { 설정 = JSON.parse(fs.readFileSync(path.join(폴더, '공모지도.json'), 'utf8')); } catch {}
  return { 현황, 통합: 그록.합치기(통합, includeReviews(폴더, 그록.보고서읽기(폴더))), 설정, 자격판정: 자격.판정읽기(폴더) };
}

async function main(argv) {
  function 값(옵션) {
    if (!argv.includes(옵션)) return '';
    const value = argv[argv.indexOf(옵션) + 1];
    if (!value || value.startsWith('--')) throw Error(옵션 + ' 다음에 파일이나 폴더 경로를 적어 주세요.');
    return value;
  }
  const 보관함 = 값('--보관함') || 기본보관함;
  const 그록보고서 = 값('--그록보고서');
  if (그록보고서 && argv.includes('--검사')) throw Error('--검사는 장부만 읽습니다.');
  if (그록보고서) {
    const 읽음 = await 그록.가져오기(보관함, JSON.parse(fs.readFileSync(그록보고서, 'utf8').replace(/^\uFEFF/, '')));
    console.log(읽음.already ? '이미 읽은 그록 보고서' : '그록 보고서 공고 ' + 읽음.items.length + '건 읽음');
  }
  const { 현황, 통합, 설정, 자격판정 } = 읽기(보관함);
  const 문제 = 검사(현황);
  if (argv.includes('--검사')) {
    if (문제.length) { console.log(`빠진 칸 ${문제.length}곳:`); for (const p of 문제) console.log('  - ' + p); return 1; }
    console.log('빠진 칸 없음'); return 0;
  }
  const 자료 = 자료만들기(현황, 통합, new Date(), 자격판정);
  let 폰트 = '';
  try { 폰트 = require('./lib/브랜드폰트.js').블록(); } catch (e) { console.log('브랜드 폰트를 못 심었다(대체 서체로 보인다): ' + e.message); }
  const 파일 = path.resolve(값('--출력') || path.join(출력폴더, '공모지도.html'));
  fs.mkdirSync(path.dirname(파일), { recursive: true });
  const 준비파일 = 파일 + '.' + randomUUID() + '.tmp';
  try {
    fs.writeFileSync(준비파일, 페이지(자료, 폰트), { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(준비파일, 파일);
  } finally {
    fs.rmSync(준비파일, { force: true });
  }
  const 셈 = (s) => 자료.진행.filter((o) => o.단계 === s).length;
  console.log(`만들었다: ${파일}`);
  console.log(`  준비 중 ${셈('준비 중')} · 결과 기다림 ${셈('결과 기다림')} · 선정 ${셈('선정')} · 안 됨 ${셈('안 됨')} · 접음 ${셈('접음')} · 열린 영상 공모 ${자료.열린.length}(AI 영상 ${자료.열린.filter((o) => o.값 === 'AI 영상').length})`);
  if (문제.length) { console.log(`  빠진 칸 ${문제.length}곳(지도에는 그대로 실었다):`); for (const p of 문제) console.log('    - ' + p); }
  if (설정.artifact_url) console.log(`올리기: Artifact 도구로 이 파일을 url ${설정.artifact_url} 에 publish 한다(처음 보는 세션은 action "read"로 한 번 읽은 뒤).`);
  else console.log('올리기: 아직 올린 주소가 없다. 처음 올린 뒤 그 주소를 지원사업 폴더의 공모지도.json {"artifact_url": "…"}에 적는다.');
  return 0;
}

if (require.main === module) main(process.argv.slice(2)).then((code) => { process.exitCode = code; })
  .catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { 단계들, 오늘, 짧은이름, 공고마감, 공고주소, 카드, 검사, 열린영상, 자료만들기, 페이지, 읽기, 기본보관함 };
