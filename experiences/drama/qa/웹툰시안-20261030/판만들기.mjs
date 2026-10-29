#!/usr/bin/env node
/**
 * 1화 그림 시안 페이지 만들기(2026-10-30) — 시안.mjs(판 · 인물 · 화풍) · 대본 정본(experiences/drama/s1/ep01.mjs) · <작업>/닮음.json ·
 * <작업>/보기/목록.json으로 눈으로 고르는 claude.ai 페이지 한 장을 만든다. 1화 목소리 오디션 페이지(../목소리후보-20261030/판만들기.mjs)와 같은 꼴이다.
 * 고른 것은 페이지 저장소(db)의 picks/style · picks/professor · picks/senior · picks/student에 누르는 즉시 남고 Claude가 읽는다
 * (10-30 상대역 오디션에서 「남기기」 단추를 따로 두었다가 고른 것이 두 번 빈 일 — 59ce1e7db).
 *
 *   node 판만들기.mjs <작업>     → <작업>/시안판.html · <작업>/시안판_파일.json(게시할 그림 · 소리 파일 짝)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ep01 from '../../s1/ep01.mjs';
import { 인물, 화풍, 기준안 } from './시안.mjs';
import 글 from './시안판_글.mjs';

const 작업 = process.argv[2];
if (!작업) { console.error('쓰는 법: node 판만들기.mjs <작업 폴더>'); process.exit(2); }
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 소리폴더 = path.resolve(여기, '../../s1/소리');
const 보기 = JSON.parse(fs.readFileSync(path.join(작업, '보기', '목록.json'), 'utf8'));
const 닮음 = JSON.parse(fs.readFileSync(path.join(작업, '닮음.json'), 'utf8'));

const 파일 = {};
const 그림 = (id) => {
 if (!보기[id]) throw new Error(`보기 그림이 없다: ${id} — 보기.py부터`);
 if (!fs.existsSync(path.join(작업, '보기', `${id}.jpg`))) throw new Error(`보기 파일이 없다: ${id}.jpg`);
 const 이름 = `img/${id}.jpg`;
 파일[이름] = path.join(작업, '보기', `${id}.jpg`).replace(/\\/g, '/');
 return { src: 이름, w: 보기[id].가로, h: 보기[id].세로 };
};
const 소리 = (역, 번호) => {
 const 줄 = JSON.parse(fs.readFileSync(path.join(소리폴더, `ep01-${역}.json`), 'utf8')).줄.find((l) => l.번호 === 번호);
 const 이름 = `audio/${줄.파일}`;
 파일[이름] = path.join(소리폴더, 줄.파일).replace(/\\/g, '/');
 return { 말: 줄.말, 소리: 이름, 초: 줄.초 };
};
const 칸그림 = (n) => ep01.칸.find((k) => k.n === n).그림;
const 시트닮음 = (id) => 닮음.시트[id]?.안끼리평균 ?? null;
// 같은 얼굴 표 — 칸마다 가장 큰 얼굴(그 칸의 인물)만, 닮음.py가 쓴 값 그대로.
const 인물말 = { prof: '문 교수', senior: '태오 선배' };
const 얼굴표 = {
 머리: ['칸', '인물', '얼굴 폭', '기준 시트와', '같은 역 다른 안 최고'],
 줄: Object.entries(닮음.칸).sort(([a], [b]) => a.localeCompare(b)).flatMap(([pid, rows]) => rows.filter((r) => r.인물 !== '배경').map((r) => {
  const [, n, 풍] = pid.split('-');
  return [`칸 ${Number(n)} · 화풍 ${풍}`, 인물말[r.인물], `${r.상자[2]}px${r.작음 ? ' (작아서 흔들림)' : ''}`, r.기준시트.toFixed(2), r.같은역다른안최고.toFixed(2)];
 })),
};

// 칸마다 붙이는 대사 — 그 칸에서 들리는 줄(대본 정본의 소리 파일 그대로). 내 대사는 모범 읽기로 표시한다.
const 칸대사 = {
 1: [{ 누가: '감독', ...소리('director', 1), 덧: '리딩을 여는 말' }],
 4: [{ 누가: '문 교수', ...소리('professor', 1) }],
 8: [{ 누가: '문 교수', ...소리('professor', 5) }, { 누가: '나', ...소리('model', 5), 덧: '내 대사 · 모범 읽기' }],
 12: [{ 누가: '태오 선배', ...소리('senior', 2) }],
 14: [{ 누가: '태오 선배', ...소리('senior', 4) }, { 누가: '나', ...소리('model', 9), 덧: '내 대사 · 모범 읽기' }],
};

const 쓸것 = {
 기준안,
 화풍: Object.entries(화풍).map(([id, f]) => ({ id, 이름: f.이름, ...글.화풍[id], 그림: [그림(`panel-01-${id}`), 그림(`panel-08-${id}`)] })),
 역: ['교수', '선배'].map((역) => ({
  id: 역 === '교수' ? 'professor' : 'senior', 역, 이름: 인물[역].이름, 소개: ep01.인물[역].소개, 목소리: 글.목소리[역],
  안: Object.entries(인물[역].안).map(([번호, a]) => {
   const sid = `sheet-${역 === '교수' ? 'prof' : 'senior'}-${번호}`;
   return { 번호: Number(번호), 이름: a.이름, ...글.안[sid], 그림: 그림(sid), 닮음: 시트닮음(sid), 기준: 기준안[역] === Number(번호) };
  }),
 })),
 학생: 글.학생,
 칸: [1, 4, 8, 12, 14].map((n) => ({ n, 그림: 그림(`panel-${String(n).padStart(2, '0')}-A`), 장면: 칸그림(n), ...글.칸[n], 대사: 칸대사[n] })),
 얼굴: { 교수: 그림('face-prof'), 선배: 그림('face-senior'), ...글.얼굴, 표: 얼굴표 },
 방법: 글.방법,
 검수: 글.검수,
 전후: 보기['before-after'] ? 그림('before-after') : null,
 대본: { 제목: ep01.제목, 시즌: ep01.시즌, 줄거리: ep01.줄거리, 칸수: ep01.칸.length },
};
const 자료 = JSON.stringify(쓸것).replace(/</g, '\\u003c');

const html = `<title>1화 그림 시안</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@700;800&family=Noto+Sans+KR:wght@400;500;700&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
/* 배치: 콘티 벽 — 위에서 아래로 고를 것 넷(화풍 → 교수 → 선배 → 학생 자리), 그 아래 핵심 칸 다섯을 폰 폭 웹툰처럼 세로로 */
:root{
 --paper:#f8f8f5; --ink:#1d2126; --muted:#5b636d; --rule:#dfe0da; --card:#ffffff; --sunk:#efefea;
 --accent:#2b56d9; --accent-soft:#e7edff; --pick:#0b7a55; --pick-soft:#dff3ea; --pencil:#c2412f; --warn:#9a5b00;
 --f-display:"Nanum Myeongjo","Noto Serif KR",serif; --f-body:"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif; --f-mono:"IBM Plex Mono",ui-monospace,Consolas,monospace;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
 --paper:#141516; --ink:#e8e6e1; --muted:#a3a9b0; --rule:#2d3034; --card:#1b1d20; --sunk:#202226;
 --accent:#8ea9ff; --accent-soft:#1f2740; --pick:#46c79a; --pick-soft:#12302a; --pencil:#f08a73; --warn:#e3a54a; color-scheme:dark}}
:root[data-theme="dark"]{
 --paper:#141516; --ink:#e8e6e1; --muted:#a3a9b0; --rule:#2d3034; --card:#1b1d20; --sunk:#202226;
 --accent:#8ea9ff; --accent-soft:#1f2740; --pick:#46c79a; --pick-soft:#12302a; --pencil:#f08a73; --warn:#e3a54a; color-scheme:dark}
*{box-sizing:border-box}
body{background:var(--paper);color:var(--ink);font-family:var(--f-body);font-size:16px;line-height:1.65;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:28px 72px}
.wrap{max-width:1040px;margin:0 auto;display:grid;gap:56px}
.slate{font-family:var(--f-mono);font-size:12px;letter-spacing:.08em;color:var(--muted);text-transform:uppercase}
h1,h2,h3{font-family:var(--f-display);text-wrap:balance;margin:0;line-height:1.3}
h1{font-size:clamp(28px,5vw,42px)}
h2{font-size:26px}
h3{font-size:19px}
p{margin:0}
.lead{color:var(--muted);max-width:66ch}
header{display:grid;gap:12px}
.picks{display:flex;flex-wrap:wrap;gap:8px;padding-top:6px}
.chip{font-size:13px;border:1px solid var(--rule);border-radius:999px;padding:4px 12px;background:var(--card);color:var(--muted)}
.chip b{color:var(--ink);font-weight:500}
.chip.on{border-color:var(--pick);background:var(--pick-soft)}
.chip.on b{color:var(--pick)}
section.block{display:grid;gap:18px}
.head{display:grid;gap:6px}
.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
@media (max-width:820px){.grid3,.grid2{grid-template-columns:1fr}}
.toc{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:14px}
.toc a{color:var(--accent);text-decoration:none;border-bottom:1px solid var(--accent-soft)}
.toc a:hover{border-bottom-color:var(--accent)}
.opt{background:var(--card);border:1px solid var(--rule);border-radius:10px;padding:14px;display:grid;gap:10px;min-width:0;align-content:start}
.opt.chosen{border-color:var(--pick);box-shadow:0 0 0 2px var(--pick-soft)}
.opt-top{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.letter{font-family:var(--f-display);font-size:28px;font-weight:800;line-height:1}
.opt .name{font-weight:700}
.tag{font-family:var(--f-mono);font-size:11px;letter-spacing:.06em;color:var(--pencil);border:1px solid currentColor;border-radius:4px;padding:1px 6px;text-transform:uppercase}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.zoom{display:block;padding:0;border:0;background:var(--sunk);border-radius:6px;overflow:hidden;cursor:zoom-in;width:100%}
.zoom img{display:block;width:100%;height:auto}
.cap{font-size:12px;color:var(--muted)}
.lines{display:grid;gap:4px;font-size:14px}
.lines .k{color:var(--muted);font-size:12px}
.good::before{content:"＋ ";color:var(--pick)}
.worry::before{content:"− ";color:var(--warn)}
.btns{display:flex;gap:8px;flex-wrap:wrap}
button{font:inherit;font-size:14px;border-radius:8px;padding:7px 12px;cursor:pointer;border:1px solid var(--rule);background:var(--paper);color:var(--ink)}
button:focus-visible,textarea:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
button.pick{border-color:var(--pick);color:var(--pick)}
.opt.chosen button.pick{background:var(--pick);color:var(--paper)}
button.none{color:var(--muted)}
button.play{border-color:var(--accent);color:var(--accent);background:var(--accent-soft);padding:4px 10px;font-size:13px}
button.play[aria-pressed="true"]{background:var(--accent);color:var(--paper)}
.sheet{display:grid;gap:12px}
.sheet .opt{grid-template-columns:minmax(0,1fr)}
.sheet-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,15rem);gap:16px;align-items:start}
@media (max-width:820px){.sheet-row{grid-template-columns:1fr}}
.foot{display:grid;gap:8px}
.status{font-size:14px;color:var(--muted)}
.status.ok{color:var(--pick)}
label{font-size:14px;color:var(--muted)}
textarea{width:100%;font:inherit;font-size:14px;border:1px solid var(--rule);border-radius:8px;padding:8px 10px;background:var(--card);color:var(--ink);min-height:44px;resize:vertical}
.student{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;align-items:start}
@media (max-width:820px){.student{grid-template-columns:1fr}}
.crops{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.strip{max-width:520px;margin:0 auto;display:grid;gap:30px;width:100%}
.panel{display:grid;gap:10px}
.panel .zoom{border-radius:4px}
.panel-meta{display:flex;justify-content:space-between;gap:8px;align-items:baseline;flex-wrap:wrap}
.cam{font-size:13px;color:var(--pencil)}
.say{display:grid;grid-template-columns:5.2em minmax(0,1fr) auto;gap:6px 10px;align-items:baseline}
.say .who{font-size:13px;color:var(--muted)}
.say .line{font-family:var(--f-display);font-size:17px}
.say.me .line{background:var(--accent-soft);padding:0 4px;border-radius:2px}
.say .sub{grid-column:2 / 4;font-size:12px;color:var(--muted);margin-top:-4px}
.faces{display:grid;gap:14px}
.faceboard{overflow-x:auto;border:1px solid var(--rule);border-radius:8px;background:var(--sunk)}
.faceboard img{display:block;max-width:none;height:150px;width:auto}
table{border-collapse:collapse;font-size:14px;width:100%}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--rule);vertical-align:top}
th{font-weight:500;color:var(--muted);font-size:13px}
td.num{font-family:var(--f-mono);font-variant-numeric:tabular-nums;white-space:nowrap}
.tablewrap{overflow-x:auto}
ul.plain{margin:0;padding-left:20px;display:grid;gap:6px}
details{border:1px solid var(--rule);border-radius:10px;padding:10px 14px;background:var(--card)}
summary{cursor:pointer;font-weight:500}
.note{border-left:3px solid var(--pencil);padding:2px 0 2px 12px;color:var(--muted);font-size:14px}
dialog{border:0;padding:0;background:transparent;max-width:min(96vw,2048px);max-height:94vh}
dialog::backdrop{background:rgba(10,12,14,.82)}
dialog img{display:block;max-width:min(96vw,2048px);max-height:88vh;width:auto;height:auto;border-radius:6px}
dialog .bar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 2px;color:#f2f2ee;font-size:14px}
dialog .bar button{background:#f2f2ee;color:#16181b;border-color:#f2f2ee}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>

<div class="wrap">
 <header>
  <p class="slate">드라마 말하기 · S1 EP01 · 그림 시안</p>
  <h1>1화 그림 시안</h1>
  <p class="lead" id="lead"></p>
  <nav class="toc" aria-label="이 페이지 안"><a href="#style">화풍</a><a href="#professor">문 교수</a><a href="#senior">태오 선배</a><a href="#student">학생 배역</a><a href="#panels">핵심 칸 다섯</a><a href="#faces">같은 얼굴 재기</a><a href="#method">만든 방법 · 검수</a></nav>
  <div class="picks" id="picks" aria-live="polite"></div>
 </header>
 <section class="block" id="style" aria-labelledby="h-style"></section>
 <section class="block" id="professor" aria-labelledby="h-professor"></section>
 <section class="block" id="senior" aria-labelledby="h-senior"></section>
 <section class="block" id="student" aria-labelledby="h-student"></section>
 <section class="block" id="panels" aria-labelledby="h-panels"></section>
 <section class="block" id="faces" aria-labelledby="h-faces"></section>
 <section class="block" id="method" aria-labelledby="h-method"></section>
</div>
<dialog id="zoom" aria-label="크게 보기">
 <div class="bar"><span id="zoom-cap"></span><button type="button" id="zoom-close">닫기</button></div>
 <img id="zoom-img" alt="">
</dialog>

<script>
const D = ${자료};
const $ = (s, el = document) => el.querySelector(s);
const make = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

// 크게 보기
const dlg = $('#zoom');
function zoomBtn(img, cap, alt) {
 const b = make('button', 'zoom'); b.type = 'button'; b.setAttribute('aria-label', cap + ' 크게 보기');
 const i = make('img'); i.src = img.src; i.width = img.w; i.height = img.h; i.alt = alt || cap; i.loading = 'lazy'; i.decoding = 'async';
 b.append(i);
 b.addEventListener('click', () => {
  $('#zoom-img').src = img.src; $('#zoom-img').alt = alt || cap; $('#zoom-cap').textContent = cap;
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
 });
 return b;
}
$('#zoom-close').addEventListener('click', () => dlg.close ? dlg.close() : dlg.removeAttribute('open'));
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

// 소리 — 한 번에 하나
let current = null;
function playBtn(src) {
 const b = make('button', 'play', '듣기'); b.type = 'button'; b.setAttribute('aria-pressed', 'false');
 const a = new Audio(src); a.preload = 'none';
 a.addEventListener('ended', () => { b.textContent = '다시'; b.setAttribute('aria-pressed', 'false'); current = null; });
 b.addEventListener('click', () => {
  if (current && current.a !== a) { current.a.pause(); current.a.currentTime = 0; current.b.textContent = '듣기'; current.b.setAttribute('aria-pressed', 'false'); }
  if (a.paused) { a.play().catch(() => {}); b.textContent = '멈춤'; b.setAttribute('aria-pressed', 'true'); current = { a, b }; }
  else { a.pause(); b.textContent = '듣기'; b.setAttribute('aria-pressed', 'false'); current = null; }
 });
 return b;
}

// 고르기 — 누르는 즉시 페이지 저장소에 남긴다
const choice = {};   // key → {cards:[{val, el, btn}], value, status, note, names}
const chipText = { style: '화풍', professor: '문 교수', senior: '태오 선배', student: '학생 자리' };
function renderChips() {
 const box = $('#picks'); box.textContent = '';
 for (const k of Object.keys(chipText)) {
  const c = choice[k]; const v = c && c.value;
  const chip = make('span', 'chip' + (v != null ? ' on' : ''));
  chip.append(document.createTextNode(chipText[k] + ' '), make('b', null, v == null ? '아직' : (c.names[v] || String(v))));
  box.append(chip);
 }
}
function paint(k) {
 const c = choice[k];
 for (const x of c.cards) { const on = x.val === c.value; x.el.classList.toggle('chosen', on); if (x.btn) x.btn.textContent = on ? '고름' : x.label; }
 renderChips();
}
let db = null, canWrite = true;
const writing = {};
async function save(k) {
 const c = choice[k];
 if (writing[k]) { writing[k].again = true; return; }
 writing[k] = { again: false };
 try {
  do {
   writing[k].again = false;
   await db.doc('picks/' + k).set({ 값: c.value, 이름: c.names[c.value] || '', 한줄: c.note.value.trim().slice(0, 500), 때: new Date().toISOString() });
  } while (writing[k].again);
  c.status.className = 'status ok'; c.status.textContent = '「' + (c.names[c.value] || c.value) + '」(으)로 저장했습니다.';
 } catch (e) {
  c.status.className = 'status'; c.status.textContent = '저장하지 못했습니다(' + (e && e.code || '오류') + '). 채팅에 「' + chipText[k] + ' ' + (c.names[c.value] || c.value) + '」라고 알려 주세요.';
 } finally { delete writing[k]; }
}
function choose(k, val) {
 const c = choice[k]; c.value = val; paint(k);
 if (!db || !canWrite) { c.status.className = 'status'; c.status.textContent = '「' + (c.names[val] || val) + '」를 골랐습니다. 이 화면에서는 저장이 안 되니 채팅에 알려 주세요.'; return; }
 c.status.className = 'status'; c.status.textContent = '저장하는 중…';
 save(k);
}
function footer(k, noteLabel, noneLabel) {
 const c = choice[k];
 const foot = make('div', 'foot');
 const lab = make('label', null, noteLabel); lab.htmlFor = 'note-' + k;
 const note = make('textarea'); note.id = 'note-' + k; note.rows = 2;
 note.addEventListener('change', () => { if (c.value != null && db && canWrite) save(k); });
 const status = make('p', 'status', '아직 고르지 않았습니다.'); status.setAttribute('role', 'status');
 const row = make('div', 'btns');
 if (noneLabel) {
  const none = make('button', 'none', noneLabel); none.type = 'button'; none.id = 'none-' + k;
  none.addEventListener('click', () => choose(k, 0));
  c.cards.push({ val: 0, el: none, btn: none, label: noneLabel });
  c.names[0] = noneLabel;
  row.append(none);
 }
 foot.append(lab, note, row, status);
 c.note = note; c.status = status;
 return foot;
}
function head(id, slate, title, lead) {
 const h = make('div', 'head');
 h.append(make('p', 'slate', slate));
 const t = make('h2', null, title); t.id = 'h-' + id; h.append(t);
 if (lead) h.append(make('p', 'lead', lead));
 return h;
}
function listLines(box, kind, arr) { for (const s of arr || []) box.append(make('span', kind, s)); }

// 화풍
(function () {
 const sec = $('#style');
 sec.append(head('style', '고를 것 1 · 화풍', '화풍', '같은 두 칸(칸 1 정문 지도 앞 · 칸 8 연구실 달력)을 세 화풍으로 그렸습니다. B와 C는 A의 구도를 그대로 두고 그리는 방식만 바꾼 판입니다. 인물 시트와 아래 핵심 칸은 A로 그렸고, 다른 화풍을 고르시면 고른 시트부터 그 화풍으로 다시 그립니다.'));
 const c = choice.style = { cards: [], value: null, names: {} };
 const g = make('div', 'grid3');
 for (const f of D.화풍) {
  c.names[f.id] = f.id + ' · ' + f.이름;
  const card = make('div', 'opt');
  const top = make('div', 'opt-top'); top.append(make('span', 'letter', f.id), make('span', 'name', f.이름));
  if (f.꼬리표) top.append(make('span', 'tag', f.꼬리표));
  const pair = make('div', 'pair');
  pair.append(zoomBtn(f.그림[0], '화풍 ' + f.id + ' · 칸 1', '화풍 ' + f.id + '로 그린 칸 1 — 정문 지도 앞의 학생 뒷모습'), zoomBtn(f.그림[1], '화풍 ' + f.id + ' · 칸 8', '화풍 ' + f.id + '로 그린 칸 8 — 달력을 짚는 문 교수'));
  const lines = make('div', 'lines');
  lines.append(make('p', null, f.설명));
  listLines(lines, 'good', f.좋음); listLines(lines, 'worry', f.걱정);
  const btn = make('button', 'pick', '이 화풍으로'); btn.type = 'button'; btn.id = 'pick-style-' + f.id;
  btn.addEventListener('click', () => choose('style', f.id));
  const btns = make('div', 'btns'); btns.append(btn);
  card.append(top, pair, lines, btns);
  c.cards.push({ val: f.id, el: card, btn, label: '이 화풍으로' });
  g.append(card);
 }
 sec.append(g, footer('style', '화풍에 대해 한 줄(골라도 되고 비워도 됩니다)', '셋 다 아님 — 다른 화풍'));
})();

// 인물 시트
for (const r of D.역) {
 const sec = $('#' + r.id);
 sec.append(head(r.id, '고를 것 ' + (r.역 === '교수' ? 2 : 3) + ' · 인물 시트', r.이름, r.소개 + ' ' + r.목소리));
 const c = choice[r.id] = { cards: [], value: null, names: {} };
 const list = make('div', 'sheet');
 for (const a of r.안) {
  c.names[a.번호] = '안 ' + a.번호 + ' · ' + a.이름;
  const card = make('div', 'opt');
  const top = make('div', 'opt-top'); top.append(make('span', 'letter', String(a.번호)), make('span', 'name', a.이름));
  if (a.기준) top.append(make('span', 'tag', '아래 칸에 쓴 안'));
  const row = make('div', 'sheet-row');
  row.append(zoomBtn(a.그림, r.이름 + ' · 안 ' + a.번호 + ' ' + a.이름, r.이름 + ' 인물 시트 안 ' + a.번호 + ' — 앞 · 뒤 전신, 큰 얼굴, 표정 셋'));
  const side = make('div', 'lines');
  side.append(make('p', null, a.생김));
  listLines(side, 'good', a.좋음); listLines(side, 'worry', a.걱정);
  if (a.닮음 != null) side.append(make('span', 'cap', '시트 안 얼굴끼리 닮음 ' + a.닮음.toFixed(2)));
  const btn = make('button', 'pick', '이 안으로'); btn.type = 'button'; btn.id = 'pick-' + r.id + '-' + a.번호;
  btn.addEventListener('click', () => choose(r.id, a.번호));
  const btns = make('div', 'btns'); btns.append(btn); side.append(btns);
  row.append(side);
  card.append(top, row);
  c.cards.push({ val: a.번호, el: card, btn, label: '이 안으로' });
  list.append(card);
 }
 sec.append(list, footer(r.id, '이 인물에 대해 한 줄 — 고친 점을 적어 주시면 그대로 다시 그립니다', '셋 다 아님 — 새 안'));
}

// 학생 배역의 자리
(function () {
 const s = D.학생; const sec = $('#student');
 sec.append(head('student', '고를 것 4 · 학생 배역', s.제목, null));
 const c = choice.student = { cards: [], value: null, names: {} };
 const wrap = make('div', 'student');
 const left = make('div', 'lines');
 for (const p of s.글) left.append(make('p', null, p));
 const crops = make('div', 'crops');
 for (const x of s.예) crops.append(zoomBtn(D.칸.find((k) => k.n === x.칸).그림, '칸 ' + x.칸 + ' · ' + x.말, x.말));
 const capRow = make('div', 'crops');
 for (const x of s.예) capRow.append(make('span', 'cap', '칸 ' + x.칸 + ' · ' + x.말));
 const right = make('div', 'lines'); right.append(crops, capRow);
 wrap.append(left, right);
 const opts = make('div', s.고르기.length === 2 ? 'grid2' : 'grid3');
 for (const o of s.고르기) {
  c.names[o.값] = o.이름;
  const card = make('div', 'opt');
  card.append(make('span', 'name', o.이름), make('p', 'cap', o.설명));
  const btn = make('button', 'pick', '이쪽으로'); btn.type = 'button'; btn.id = 'pick-student-' + o.값;
  btn.addEventListener('click', () => choose('student', o.값));
  const btns = make('div', 'btns'); btns.append(btn); card.append(btns);
  c.cards.push({ val: o.값, el: card, btn, label: '이쪽으로' });
  opts.append(card);
 }
 sec.append(wrap, opts, footer('student', '학생 배역에 대해 한 줄(골라도 되고 비워도 됩니다)', null));
})();

// 핵심 칸
(function () {
 const sec = $('#panels');
 const a = D.역[0].안.find((x) => x.기준), b = D.역[1].안.find((x) => x.기준);
 sec.append(head('panels', '감 잡기 · 화풍 A · 교수 안 ' + a.번호 + ' · 선배 안 ' + b.번호, '1화 핵심 칸 다섯', D.대본.줄거리 + ' 칸은 폰에서 보는 4:5 한 장씩이고, 아래에 그 칸에서 들리는 대사를 고르신 목소리로 붙였습니다.'));
 const strip = make('div', 'strip');
 for (const k of D.칸) {
  const p = make('article', 'panel'); p.setAttribute('aria-label', '칸 ' + k.n);
  const meta = make('div', 'panel-meta');
  meta.append(make('span', 'slate', '칸 ' + String(k.n).padStart(2, '0') + ' / ' + D.대본.칸수), make('span', 'cam', k.카메라));
  p.append(meta, zoomBtn(k.그림, '칸 ' + k.n, '칸 ' + k.n + ' — ' + k.장면));
  p.append(make('p', 'cap', k.장면));
  for (const l of k.대사 || []) {
   const row = make('div', 'say' + (l.누가 === '나' ? ' me' : ''));
   row.append(make('span', 'who', l.누가), make('span', 'line', l.말), playBtn(l.소리));
   if (l.덧) row.append(make('span', 'sub', l.덧));
   p.append(row);
  }
  if (k.메모) p.append(make('p', 'note', k.메모));
  strip.append(p);
 }
 sec.append(strip);
})();

// 얼굴
(function () {
 const f = D.얼굴; const sec = $('#faces');
 sec.append(head('faces', '같은 얼굴 재기', '얼굴이 칸마다 같은가', f.머리));
 const box = make('div', 'faces');
 for (const [who, img] of [['문 교수', f.교수], ['태오 선배', f.선배]]) {
  box.append(make('h3', null, who + ' — 시트 얼굴 | 칸 얼굴'));
  const fb = make('div', 'faceboard'); const i = make('img'); i.src = img.src; i.alt = who + ' 얼굴을 시트와 칸에서 잘라 한 줄로 놓은 것'; i.loading = 'lazy'; fb.append(i); box.append(fb);
 }
 const tw = make('div', 'tablewrap'); const t = make('table');
 const hr = make('tr'); for (const h of f.표.머리) hr.append(make('th', null, h)); t.append(hr);
 for (const row of f.표.줄) { const tr = make('tr'); row.forEach((v, i) => tr.append(make('td', i ? 'num' : null, String(v)))); t.append(tr); }
 tw.append(t); box.append(tw);
 for (const p of f.해설) box.append(make('p', 'lead', p));
 sec.append(box);
})();

// 만든 방법 · 검수
(function () {
 const sec = $('#method');
 sec.append(head('method', '기록', '만든 방법과 검수', null));
 if (D.방법.length) { const ul = make('ul', 'plain'); for (const s of D.방법) ul.append(make('li', null, s)); sec.append(ul); }
 if (D.검수 && D.검수.length) {
  sec.append(make('h3', null, '보여 드리기 전 검수'));
  const ul2 = make('ul', 'plain'); for (const s of D.검수) ul2.append(make('li', null, s)); sec.append(ul2);
 }
 if (D.전후) {
  const det = make('details'); det.append(make('summary', null, '핵심 칸 — 검수 전과 지금 나란히 보기'));
  const box = make('div', 'lines'); box.style.marginTop = '10px';
  box.append(zoomBtn(D.전후, '핵심 칸 · 검수 전 · 지금', '핵심 칸 다섯을 검수 전(왼쪽)과 지금(오른쪽)으로 나란히 놓은 판'));
  det.append(box); sec.append(det);
 }
})();

$('#lead').textContent = '드라마 말하기 ' + D.대본.제목 + '의 그림 시안입니다. 네 가지를 골라 주세요: 화풍, 문지영 교수, 권태오 선배, 학생 배역을 어떻게 보일지. 고르는 즉시 이 페이지에 저장되고, Claude가 읽어 다음 굽기에 씁니다. 그림을 누르면 크게 봅니다.';
renderChips();

(async () => {
 try {
  db = await window.claude?.use?.('db');
  const u = await window.claude?.use?.('user');
  if (u && typeof u.can === 'function') { const w = await u.can('data.write'); if (w === false) canWrite = false; }
 } catch (e) { db = null; }
 if (!db) return;
 for (const k of Object.keys(choice)) {
  db.doc('picks/' + k).onSnapshot((snap) => {
   if (!snap.exists) return;
   const v = snap.data(); const c = choice[k];
   if (v.값 != null && !writing[k]) { c.value = v.값; paint(k); c.status.className = 'status ok'; c.status.textContent = '「' + (c.names[v.값] || v.값) + '」(으)로 저장되어 있습니다.'; }
   if (v.한줄 && !c.note.value) c.note.value = v.한줄;
  }, () => {});
 }
})();
</script>
`;
fs.writeFileSync(path.join(작업, '시안판.html'), html);
fs.writeFileSync(path.join(작업, '시안판_파일.json'), JSON.stringify(파일, null, 1));
const 바이트 = Object.values(파일).reduce((s, p) => s + fs.statSync(p).size, 0);
console.log(`시안판.html ${(Buffer.byteLength(html) / 1024).toFixed(0)}KB · 파일 ${Object.keys(파일).length}개 ${(바이트 / 1e6).toFixed(1)}MB`);
