#!/usr/bin/env node
/**
 * 듣기 판 만들기(2026-10-29) — 결과.json(녹음.mjs 엮기) + 대본.mjs로 유호님이 귀로 고르는 비교 페이지(아티팩트 본문)를 만든다.
 *   node 판만들기.mjs   → 이 폴더 듣기판.html (발행할 때 소리/*.mp3를 audio/로 함께 싣는다)
 * 엔진 이름은 처음에 가리고(A · B · C …, 장면마다 순서가 다름) 「이름 보기」로 연다. 고른 것은 페이지 저장소 picks/main에 남아
 * Claude가 ArtifactData로 읽는다. 서체는 tools/lib/브랜드폰트.js로 SUIT를 심는다(아티팩트 CSP는 바깥 서체 CSS를 Google Fonts만 연다).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import 대본 from './대본.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 저장소 = path.resolve(여기, '..', '..', '..', '..', '..');
const 폰트 = createRequire(import.meta.url)(path.join(저장소, 'tools', 'lib', '브랜드폰트.js'));
const 결과 = JSON.parse(fs.readFileSync(path.join(여기, '결과.json'), 'utf8'));

const 목소리설명 = {
  'live_noeul': { 엔진: 'GPT-Live', 목소리: 'Noeul', 결: '여성 · 한국어 전용 목소리' },
  'live_cedar': { 엔진: 'GPT-Live', 목소리: 'cedar', 결: '남성 · 다국어 목소리(추가 후보)' },
  'realtime_marin': { 엔진: 'Realtime 2.1', 목소리: 'marin', 결: '여성 · 다국어 목소리' },
  'realtime_cedar': { 엔진: 'Realtime 2.1', 목소리: 'cedar', 결: '남성 · 다국어 목소리' },
  'gemini_Kore': { 엔진: 'Gemini 3.8 Live', 목소리: 'Kore', 결: '여성 · 단단한 목소리 · 비교용(학생에게는 못 씀)' },
  'gemini_Aoede': { 엔진: 'Gemini 3.8 Live', 목소리: 'Aoede', 결: '여성 · 산뜻한 목소리 · 비교용(학생에게는 못 씀)' },
  'gemini_Puck': { 엔진: 'Gemini 3.8 Live', 목소리: 'Puck', 결: '남성 · 밝은 목소리 · 비교용(학생에게는 못 씀)' },
  'live_marin': { 엔진: 'GPT-Live', 목소리: 'marin', 결: '여성 · 다국어 목소리(2차 후보)' },
  'live_coral': { 엔진: 'GPT-Live', 목소리: 'coral', 결: '여성 · 다국어 목소리(2차 후보)' },
  'live_shimmer': { 엔진: 'GPT-Live', 목소리: 'shimmer', 결: '낮은 목소리 · 다국어(2차 후보, 재 보니 cedar와 비슷한 높이)' },
  'live_sage': { 엔진: 'GPT-Live', 목소리: 'sage', 결: '여성 · 다국어 목소리(2차 후보)' },
};
// 1차(10-29) 일곱 판은 글자 A~G를 그대로 둔다 — 유호님이 그 글자로 평가했다(결정 10-30). 2차(10-30 여성 배역 후보)는 가 · 나 · 다 · 라.
const 일차 = new Set(['gemini_Aoede', 'gemini_Kore', 'gemini_Puck', 'live_cedar', 'live_noeul', 'realtime_cedar', 'realtime_marin']);
const 아이디 = (p) => `${p.엔진}_${p.목소리}`;
// 장면마다 다른 순서(고정 씨앗) — 같은 글자가 같은 엔진이라고 외우지 않게
function 섞기(목록, 씨앗) {
  const a = [...목록];
  let s = 씨앗;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const 테이크로 = (글자들) => (p, i) => {
      const 지연 = p.줄.map((l) => l.지연ms).filter((v) => typeof v === 'number');
      return {
        글자: 글자들[i], 아이디: 아이디(p), 소리: `audio/${path.basename(p.파일)}`, 초: p.초,
        최저일치: Math.min(...p.줄.map((l) => (l.빠짐 ? 0 : l.일치))),
        지연평균: 지연.length ? Math.round(지연.reduce((x, y) => x + y, 0) / 지연.length) : null,
        다른줄: p.줄.filter((l) => l.빠짐 || l.일치 < 0.98).map((l) => ({ 번호: l.번호, 대본: l.대본, 받아쓰기: l.빠짐 ? '(빠짐)' : l.받아쓰기, 일치: l.일치 })),
        어림값USD: p.어림값USD, 시도: p.시도,
      };
    };
const 판들 = 대본.장면.map((장면, n) => {
  const 받은 = 결과.판들.filter((p) => p.장면 === 장면.id);
  return {
    id: 장면.id, 이름: 장면.이름, 상대역: 장면.상대역, 연기: 장면.연기, 줄: 장면.줄,
    테이크: 섞기(받은.filter((p) => 일차.has(아이디(p))), 7 + n * 13).map(테이크로('ABCDEFG')),
    둘째: 섞기(받은.filter((p) => !일차.has(아이디(p))), 101 + n * 17).map(테이크로(['가', '나', '다', '라', '마', '바'])),
  };
});
const 표 = Object.keys(목소리설명).filter((k) => 결과.판들.some((p) => 아이디(p) === k)).map((k) => {
  const 내것 = 결과.판들.filter((p) => 아이디(p) === k);
  const 지연 = 내것.flatMap((p) => p.줄.map((l) => l.지연ms)).filter((v) => typeof v === 'number');
  const 일치들 = 내것.flatMap((p) => p.줄.map((l) => (l.빠짐 ? 0 : l.일치)));
  return {
    아이디: k, ...목소리설명[k],
    지연평균: 지연.length ? Math.round(지연.reduce((x, y) => x + y, 0) / 지연.length) : null,
    지연최대: 지연.length ? Math.max(...지연) : null,
    일치평균: 일치들.length ? Number((일치들.reduce((x, y) => x + y, 0) / 일치들.length).toFixed(3)) : null,
    값USD: Number(내것.reduce((n, p) => n + p.어림값USD, 0).toFixed(3)),
    끼어듦: 내것.reduce((n, p) => n + (p.끼어듦 || 0), 0),
    무료등급: 내것.some((p) => p.무료등급),
    유료였다면USD: Number(내것.reduce((n, p) => n + (p.유료였다면USD || 0), 0).toFixed(3)),
  };
});
const 자료 = { 판: 대본.판, 때: 결과.때, 목표LUFS: 결과.목표LUFS, 줄사이초: 결과.줄사이초, 목소리설명, 판들, 표, 합계USD: 결과.합계어림USD };

const 본문 = `<title>상대역 오디션</title>
<meta name="claude:viewport-fit-sides" content="cover">
${폰트.블록()}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter+Tight:wght@500;700&display=swap">
<style>
/* 오디션 대본 한 장: 왼쪽은 대본, 오른쪽(좁으면 아래)은 테이크 카드. 브랜드 바탕 Paper · Black과 청금석 실 색만 쓴다. */
:root {
  --bg: #FFFFFF; --fg: #0B0B0C; --muted: #5A6170; --rule: #E2E5EB; --panel: #F5F7FA;
  --accent-text: #24448C; --accent-face: #3D6BC9; --accent-soft: #C5D6F5; --on-accent: #FFFFFF; --warn: #9A4B00;
  --font-ko: 'SUIT Variable', 'Inter Tight', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
  --font-latin: 'Inter Tight', 'SUIT Variable', system-ui, sans-serif;
  --font-mono: 'DM Mono', 'SUIT Variable', 'Malgun Gothic', ui-monospace, monospace; /* 한글은 SUIT로 — 모노 대체 서체는 한글 사이를 띄운다 */
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #000000; --fg: #F3F4F6; --muted: #A2A9B6; --rule: #262A31; --panel: #0E1117;
  --accent-text: #A9C1F2; --accent-face: #3D6BC9; --accent-soft: #1A2B50; --on-accent: #FFFFFF; --warn: #F0B070; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #000000; --fg: #F3F4F6; --muted: #A2A9B6; --rule: #262A31; --panel: #0E1117;
  --accent-text: #A9C1F2; --accent-face: #3D6BC9; --accent-soft: #1A2B50; --on-accent: #FFFFFF; --warn: #F0B070; color-scheme: dark }
* { box-sizing: border-box }
body { background: var(--bg); color: var(--fg); font-family: var(--font-ko); font-size: 15px; line-height: 1.6;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 28px 64px }
.wrap { max-width: 1080px; margin: 0 auto; display: grid; gap: 40px }
h1, h2, h3 { margin: 0; text-wrap: balance; letter-spacing: -0.01em }
h1 { font-size: clamp(28px, 4.4vw, 40px); font-weight: 800 }
h2 { font-size: 22px; font-weight: 750 }
p { margin: 0 }
.eyebrow { font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.06em; color: var(--muted); text-transform: uppercase }
.lead { max-width: 62ch; color: var(--fg); font-size: 16px }
.note { max-width: 62ch; color: var(--muted); font-size: 14px }
header { display: grid; gap: 12px }
.bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center }
button { font: inherit; cursor: pointer; border-radius: 999px; border: 1px solid var(--rule); background: var(--bg); color: var(--fg); padding: 7px 14px; font-size: 14px }
button:hover { border-color: var(--accent-text) }
button:focus-visible, select:focus-visible, textarea:focus-visible, audio:focus-visible { outline: 2px solid var(--accent-face); outline-offset: 2px }
button[aria-pressed="true"] { background: var(--accent-face); border-color: var(--accent-face); color: var(--on-accent) }
.scene { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 28px; padding-top: 28px; border-top: 1px solid var(--rule) }
.round2 { grid-column: 1 / -1; display: grid; gap: 10px; padding-top: 18px; border-top: 1px dashed var(--rule) }
.round2 h3 { font-size: 17px; margin: 0 }
.round2 .takes { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)) }
.scene-head { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 6px 16px; align-items: baseline }
.role { color: var(--muted); font-size: 14px }
.script { display: grid; gap: 10px; align-content: start; margin: 0; padding: 0; list-style: none }
.script li { display: grid; grid-template-columns: 4.2em minmax(0, 1fr); gap: 10px }
.who { font-size: 12px; color: var(--muted); padding-top: 3px }
.script li.ai .line { font-weight: 700 }
.script li.learner .line { color: var(--muted) }
.direction { font-size: 13px; color: var(--muted); border-left: 2px solid var(--accent-soft); padding-left: 10px; margin-top: 6px }
.takes { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; align-content: start }
.take { border: 1px solid var(--rule); border-radius: 14px; padding: 14px; display: grid; gap: 10px; background: var(--bg) }
.take.picked { border-color: var(--accent-face); box-shadow: 0 0 0 1px var(--accent-face) inset }
.take-top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px }
.letter { font-family: var(--font-latin); font-weight: 700; font-size: 22px }
.who-is { font-size: 13px; color: var(--accent-text); text-align: right }
.who-is[hidden] { display: none }
audio { width: 100%; height: 40px }
.stats { display: flex; flex-wrap: wrap; gap: 6px 14px; font-family: var(--font-mono); font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums }
.diff { font-size: 12.5px; color: var(--warn); display: grid; gap: 2px }
.picks { background: var(--panel); border-radius: 16px; padding: 18px; display: grid; gap: 14px }
.picks-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px 16px }
.picks label { font-size: 13px; color: var(--muted); display: grid; gap: 4px }
select, textarea { font: inherit; color: var(--fg); background: var(--bg); border: 1px solid var(--rule); border-radius: 10px; padding: 8px 10px; width: 100% }
textarea { min-height: 72px; resize: vertical }
.saved { font-size: 13px; color: var(--muted) }
.primary { background: var(--accent-face); border-color: var(--accent-face); color: var(--on-accent); font-weight: 700 }
.how { display: grid; gap: 14px }
.table-wrap { overflow-x: auto }
table { border-collapse: collapse; min-width: 560px; width: 100%; font-size: 14px }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--rule) }
th { font-size: 12px; color: var(--muted); font-weight: 600 }
td.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; text-align: right }
ul.facts { margin: 0; padding-left: 1.1em; display: grid; gap: 6px; max-width: 72ch; color: var(--fg) }
@media (max-width: 760px) { .scene { grid-template-columns: minmax(0, 1fr) } }
@media (prefers-reduced-motion: reduce) { * { transition: none !important } }
</style>

<div class="wrap">
  <header>
    <p class="eyebrow">실시간 음성 상황극 · 듣기 시험 · 2026-10-29</p>
    <h1>상대역 오디션</h1>
    <p class="lead">같은 대본과 같은 학습자 목소리를 엔진마다 넣고, AI 상대역이 받아친 목소리만 받았어요. 장면마다 들어 보고 상대역으로 쓰고 싶은 판을 골라 주세요.</p>
    <p class="note">엔진 이름은 가려 두었어요(A · B …, 장면마다 순서가 달라요). 다 들으신 뒤 「이름 보기」를 누르면 어느 엔진 · 목소리인지 나와요. 학습자 줄은 모든 판에 같은 소리이고, 소리 크기는 줄마다 맞췄어요.</p>
    <div class="bar">
      <button id="reveal" type="button" aria-pressed="false">이름 보기</button>
    </div>
  </header>
  <main id="scenes" class="wrap" style="gap: 40px"></main>
  <section class="picks" aria-labelledby="picks-title">
    <h2 id="picks-title">고른 것</h2>
    <div class="picks-grid" id="picks-grid"></div>
    <label for="overall">전체로 하나만 쓴다면<select id="overall"></select></label>
    <label for="memo">한마디(좋았던 점 · 걸린 점)<textarea id="memo" placeholder="예: B가 제일 사람 같음, 팬미팅은 남자 목소리가 낫겠다"></textarea></label>
    <div class="bar"><button id="save" class="primary" type="button">고른 것 남기기</button><span class="saved" id="saved">아직 남긴 것이 없어요</span></div>
  </section>
  <section class="how" aria-labelledby="how-title">
    <h2 id="how-title">어떻게 받았나</h2>
    <ul class="facts" id="facts"></ul>
    <div class="table-wrap"><table id="table"><thead><tr><th>엔진 · 목소리</th><th>결</th><th>학습자 말이 끝나고 첫 소리까지(평균 · 최대)</th><th>대본 일치(평균)</th><th>말 도중 끼어들 뻔함</th><th>쓴 값(세 장면)</th></tr></thead><tbody></tbody></table></div>
  </section>
</div>

<script>
const DATA = ${JSON.stringify(자료).replace(/</g, '\\u003c')};
const state = { reveal: false, picks: {}, overall: '', memo: '' };
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs = {}, ...kids) => { const n = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else n.setAttribute(k, v); } for (const k of kids) if (k) n.append(k); return n; };
const sec = (ms) => (ms == null ? '–' : (ms / 1000).toFixed(2) + '초');
const pct = (v) => (v == null ? '–' : Math.round(v * 100) + '%');
const nameOf = (id) => { const d = DATA.목소리설명[id]; return d ? d.엔진 + ' · ' + d.목소리 : id; };

function renderScenes() {
  const root = $('#scenes');
  root.textContent = '';
  for (const s of DATA.판들) {
    const art = el('section', { class: 'scene', id: s.id, 'aria-labelledby': 'h-' + s.id });
    art.append(el('div', { class: 'scene-head' }, el('h2', { id: 'h-' + s.id, text: s.이름 }), el('span', { class: 'role', text: '상대역: ' + s.상대역 })));
    const ol = el('ol', { class: 'script' });
    for (const l of s.줄) ol.append(el('li', { class: l.누가 === '상대역' ? 'ai' : 'learner' }, el('span', { class: 'who', text: l.누가 === '상대역' ? '상대역' : '학습자' }), el('span', { class: 'line', text: l.말 })));
    const left = el('div', {}, ol, el('p', { class: 'direction', text: '연기 지시: ' + s.연기 }));
    const takes = el('div', { class: 'takes' });
    const 카드 = (t, 기준) => {
      const card = el('article', { class: 'take' + (state.picks[s.id] === t.아이디 ? ' picked' : ''), 'data-scene': s.id, 'data-id': t.아이디 });
      const who = el('span', { class: 'who-is', text: nameOf(t.아이디) + ' — ' + (DATA.목소리설명[t.아이디]?.결 || '') });
      who.hidden = !state.reveal;
      card.append(el('div', { class: 'take-top' }, el('span', { class: 'letter', text: 기준 ? '기준 ' + t.글자 : t.글자 }), who));
      const audio = el('audio', { controls: '', preload: 'none', src: t.소리, 'aria-label': s.이름 + ' ' + t.글자 + ' 판' });
      audio.addEventListener('play', () => { for (const a of document.querySelectorAll('audio')) if (a !== audio) a.pause(); });
      card.append(audio);
      card.append(el('div', { class: 'stats' }, el('span', { text: '대본 일치 ' + pct(t.최저일치) + (t.최저일치 < 1 ? '(가장 낮은 줄)' : '') }), el('span', { text: '첫 소리까지 ' + sec(t.지연평균) }), el('span', { text: t.초.toFixed(1) + '초' })));
      if (t.다른줄.length) {
        const d = el('div', { class: 'diff' });
        for (const l of t.다른줄) d.append(el('span', { text: l.번호 + '번 줄이 대본과 달라요: 「' + l.받아쓰기 + '」' }));
        card.append(d);
      }
      const b = el('button', { type: 'button', 'aria-pressed': String(state.picks[s.id] === t.아이디), text: state.picks[s.id] === t.아이디 ? '고름' : '이 판으로' });
      b.addEventListener('click', () => { state.picks[s.id] = state.picks[s.id] === t.아이디 ? '' : t.아이디; markDirty(); render(); });
      card.append(b);
      return card;
    };
    for (const t of s.테이크) takes.append(카드(t));
    art.append(left, takes);
    if (s.둘째.length) {
      const 기준 = s.테이크.find((t) => t.아이디 === 'gemini_Kore');
      const grid2 = el('div', { class: 'takes' });
      if (기준) grid2.append(카드(기준, true));
      for (const t of s.둘째) grid2.append(카드(t));
      art.append(el('div', { class: 'round2' }, el('h3', { text: '여성 배역 2차 후보 · 가 나 다 라' }), el('p', { class: 'note', text: '1차에서 「좋네」라고 하신 A(학생에게는 못 쓰는 엔진)를 기준으로 맨 앞에 두었어요. 가~라는 학생에게 쓸 수 있는 엔진의 여성 목소리예요.' }), grid2));
    }
    root.append(art);
  }
}
function renderPicks() {
  const g = $('#picks-grid');
  g.textContent = '';
  for (const s of DATA.판들) {
    const id = state.picks[s.id];
    const t = [...s.테이크, ...s.둘째].find((x) => x.아이디 === id);
    g.append(el('label', {}, el('span', { text: s.이름 }), el('strong', { text: t ? t.글자 + (state.reveal ? ' · ' + nameOf(id) : '') : '아직' })));
  }
  const sel = $('#overall');
  if (!sel.options.length) {
    sel.append(el('option', { value: '', text: '아직 안 정함' }));
    for (const r of DATA.표) sel.append(el('option', { value: r.아이디, text: r.엔진 + ' · ' + r.목소리 + '(' + r.결 + ')' }));
    sel.append(el('option', { value: 'mixed', text: '장면(배역)마다 다르게' }));
    sel.addEventListener('change', () => { state.overall = sel.value; markDirty(); });
  }
  sel.value = state.overall;
  const memo = $('#memo');
  if (document.activeElement !== memo) memo.value = state.memo;
}
function renderHow() {
  const f = $('#facts');
  f.textContent = '';
  const facts = [
    '학습자 줄은 한 번 구운 같은 소리를 엔진마다 마이크처럼 실제 속도(0.1초씩)로 넣었어요. 상대역 1번 줄은 엔진이 먼저 말했어요.',
    '차례 넘기기는 엔진 것을 그대로 썼어요 — GPT-Live는 모델이 스스로 듣고 끼어들 때를 정하고, Realtime 2.1과 Gemini는 학습자가 머뭇거려도 기다리는 설정(2.1은 semantic VAD · low, Gemini는 말끝 감도 낮음 · 침묵 1초)이에요.',
    'Gemini 3.8 Live는 결제를 붙이지 않은 무료 등급 키로 받아 돈이 들지 않았어요. 무료 등급은 보낸 내용이 구글 학습에 쓰일 수 있어 지어낸 내부 대본만 넣었어요. 학생용으로는 Gemini 약관이 18세 미만이 쓰는 서비스와 미얀마를 막아서 쓸 수 없어요 — 목소리 비교용이에요.',
    '판 안의 줄 사이는 ' + DATA.줄사이초 + '초로 똑같이 이었어요. 실제로 얼마나 빨리 받아쳤는지는 카드의 「첫 소리까지」와 아래 표 숫자예요(이 노트북에서 잰 값, 학생 기기 · 회선에 따라 달라져요).',
    '「말 도중 끼어들 뻔함」은 학습자가 한 줄 안에서 잠깐 쉰 자리(예: 「저는 뚜자라고 합니다. / 잘 부탁드립니다.」)를 말끝으로 알고 답을 시작했다가, 학습자가 이어 말해 취소된 횟수예요. 판에는 취소된 소리가 들어가지 않았지만 실제 수업에서는 상대역이 말허리를 자르는 것처럼 들릴 수 있어요.',
    '줄마다 소리 크기를 ' + DATA.목표LUFS + ' LUFS로 맞춰 큰 소리가 더 좋게 들리는 쏠림을 줄였어요.',
    'OpenAI 쪽 쓴 값은 결제 수단 없는 synk.yuh 조직의 월 API 크레딧이에요(돈이 나가지 않아요). 이번 시험 전체 어림 $' + DATA.합계USD + ', Gemini는 0원.',
  ];
  for (const t of facts) f.append(el('li', { text: t }));
  const tb = $('#table tbody');
  tb.textContent = '';
  for (const r of DATA.표) tb.append(el('tr', {}, el('td', { text: r.엔진 + ' · ' + r.목소리 }), el('td', { text: r.결 }), el('td', { class: 'num', text: sec(r.지연평균) + ' · ' + sec(r.지연최대) }), el('td', { class: 'num', text: pct(r.일치평균) }), el('td', { class: 'num', text: r.끼어듦 + '번' }), el('td', { class: 'num', text: r.무료등급 ? '$0 (무료 등급 · 유료면 $' + r.유료였다면USD.toFixed(3) + ')' : '$' + r.값USD.toFixed(3) })));
}
function render() { renderScenes(); renderPicks(); }
let dirty = false;
function markDirty() { dirty = true; $('#saved').textContent = '바꾼 것이 있어요 — 「고른 것 남기기」를 눌러 주세요'; }
$('#memo').addEventListener('input', (e) => { state.memo = e.target.value; markDirty(); });
$('#reveal').addEventListener('click', (e) => { state.reveal = !state.reveal; e.currentTarget.setAttribute('aria-pressed', String(state.reveal)); e.currentTarget.textContent = state.reveal ? '이름 가리기' : '이름 보기'; render(); });
render();
renderHow();

let ref = null;
(async () => {
  const db = window.claude && window.claude.use ? await window.claude.use('db').catch(() => null) : null;
  if (!db) { $('#saved').textContent = '이 화면에서는 남기기가 안 돼요 — 고른 것을 말로 알려 주세요'; $('#save').disabled = true; return; }
  ref = db.doc('picks/main');
  ref.onSnapshot((snap) => {
    if (!snap.exists || dirty) return;
    const d = snap.data() || {};
    state.picks = Object.assign({}, d.장면 || {});
    state.overall = d.전체 || '';
    state.memo = d.메모 || '';
    $('#saved').textContent = d.때 ? '남긴 때 ' + new Date(d.때).toLocaleString('ko-KR') : '남긴 것이 있어요';
    render();
  }, () => { $('#saved').textContent = '남긴 것을 불러오지 못했어요 — 새로 고침해 주세요'; });
})();
$('#save').addEventListener('click', async () => {
  if (!ref) return;
  const btn = $('#save');
  btn.disabled = true;
  try {
    const 때 = new Date().toISOString();
    await ref.set({ 장면: state.picks, 전체: state.overall, 메모: state.memo, 때, 판: DATA.판 });
    dirty = false;
    $('#saved').textContent = '남겼어요 · ' + new Date(때).toLocaleString('ko-KR');
  } catch (e) {
    $('#saved').textContent = '남기지 못했어요(' + (e && e.code ? e.code : '오류') + ') — 잠시 뒤 다시 눌러 주세요';
  } finally { btn.disabled = false; }
});
</script>
`;
fs.writeFileSync(path.join(여기, '듣기판.html'), 본문);
console.log(`[판만들기] 듣기판.html · 장면 ${판들.length} · 테이크 ${판들.reduce((n, s) => n + s.테이크.length, 0)} · ${(Buffer.byteLength(본문) / 1024).toFixed(0)}KB`);
