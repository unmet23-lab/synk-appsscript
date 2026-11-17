#!/usr/bin/env node
/**
 * 새 여자 선배 시안 고르기 페이지 만들기 (2026-11-17).
 * 얼굴(후보.mjs로 구운 판) · 목소리(목소리.mjs로 구운 판) · 이름 후보를 한 장에 놓는다. 유호님이 누른 것은 페이지 저장소(db)의
 * picks/senior-f 문서에 남고 Claude가 읽는다. 무엇을 보일지는 같은 폴더의 시안.mjs가 정한다(보일 판, 실존 대조 결과, 이름 후보, 추천).
 *
 *   node experiences/drama/qa/새여자선배-20261117/판만들기.mjs
 *   → 공용 작업본 .tmp/senior-f-face/고르기/index.html · img/*.jpg · snd/*.mp3 · 파일.json(게시할 파일 짝)
 *
 * 그림과 소리는 저장소에 넣지 않는다(git 밖). 그림을 줄일 때 파이썬 PIL을 부른다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { 후보 as 목소리후보, 줄들 } from './목소리.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..');
const { 공용작업본 } = createRequire(import.meta.url)(path.join(뿌리, 'tools', 'lib', '공용작업본.js'));
const 공용 = 공용작업본(뿌리);
const 얼굴폴더 = path.join(공용, '.tmp', 'senior-f-face');
const 소리폴더 = path.join(공용, '.tmp', 'senior-f-voice');
const 끝 = path.join(얼굴폴더, '고르기');
const 시안 = (await import('./시안.mjs')).default;
const 받아 = JSON.parse(fs.readFileSync(path.join(소리폴더, '받아쓰기.json'), 'utf8'));
// 앞서 지은 판의 줄인 그림 · 소리 사본은 치우고 새로 만든다(이 폴더의 img · snd는 모두 이 도구가 만든 사본이다)
for (const d of ['img', 'snd']) fs.rmSync(path.join(끝, d), { recursive: true, force: true });
fs.mkdirSync(path.join(끝, 'img'), { recursive: true });
fs.mkdirSync(path.join(끝, 'snd'), { recursive: true });

// ── 그림: 긴 변 1,800으로 줄인 JPEG(얼굴을 크게 볼 수 있게) ──
const 줄일 = [];
const 그림 = (원본, 이름) => { 줄일.push([원본, path.join(끝, 'img', `${이름}.jpg`)]); return `img/${이름}.jpg`; };
const 태오그림 = 그림(path.join(공용, 시안.태오.그림), 'taeo');
const 얼굴들 = 시안.얼굴.map((f) => ({ ...f, 판들: f.판.map((p) => ({ id: p, src: 그림(path.join(얼굴폴더, 'out', `${p}.png`), p) })) }));
const r = spawnSync('python', ['-X', 'utf8', '-c', `
import json, sys
from PIL import Image
for src, dst in json.loads(sys.argv[1]):
    im = Image.open(src).convert('RGB')
    k = 1800 / max(im.size)
    if k < 1: im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    im.save(dst, quality=86, optimize=True)
`, JSON.stringify(줄일)], { encoding: 'utf8' });
if (r.status !== 0) { console.error('그림 줄이기 실패', r.stderr); process.exit(1); }

// ── 소리: 후보 듣기 판과 태오 1화 첫 줄 ──
const 소리들 = 시안.목소리순서.map((k, i) => {
  const 원본 = path.join(소리폴더, '판', `${k}.mp3`);
  fs.copyFileSync(원본, path.join(끝, 'snd', `v${i + 1}.mp3`));
  return { 열쇠: k, 번호: i + 1, src: `snd/v${i + 1}.mp3`, 초: 받아[k].초, 음높이: 받아[k].음높이, 결: 목소리후보[k].결, 이름: 목소리후보[k].이름 };
});
fs.copyFileSync(path.join(뿌리, 시안.태오.소리), path.join(끝, 'snd', 'taeo.mp3'));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const 자료 = {
  얼굴: 얼굴들.map((f) => ({ id: f.id, 이름: f.이름, 한줄: f.한줄, 대조: f.대조, 판들: f.판들 })),
  목소리: 소리들.map((s) => ({ id: s.열쇠, 번호: s.번호, src: s.src, 초: s.초, 음높이: s.음높이, 결: s.결 })),
  이름: 시안.이름,
  추천: 시안.추천,
  얼굴대기: 시안.얼굴대기 || '', // 얼굴을 아직 굽는 중이면 그 까닭 한 줄 — 후보 카드 대신 이 글을 보인다
};

const 학생줄 = ['네, 맞아요. 길을 잃어서 한참 헤맸어요.', '네, 선배님! 그런데 혹시 도서관이 어디에 있는지 아세요?', '정말요? 선배님 덕분에 살았어요.', '네, 꼭 살게요!'];
const 대본 = 줄들.map((l, i) => `<div class="say"><span class="who">선배</span><p>${esc(l.text)}</p></div><div class="say you"><span class="who">학생</span><p>${esc(학생줄[i])}</p></div>`).join('\n');

const html = `<title>새 여자 선배 시안</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@700;800&family=Noto+Sans+KR:wght@400;500;700&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
/* 배치: 학교 게시판의 「선배 소개」. 이미 정해진 태오가 왼쪽에 붙어 있고 그 옆으로 새 선배 후보가 나란히 붙는다. 아래로 목소리(대본과 듣기 줄), 이름표, 한 줄 메모. */
:root{
 --paper:#f3f4f0; --ink:#141c33; --muted:#5a6377; --rule:#d7dad0; --card:#ffffff;
 --navy:#1b2a57; --cream:#efe6cf; --sansuyu:#d9a400; --sansuyu-soft:#fbf1c9;
 --pick:#0c7a52; --pick-soft:#dcf1e6; --warn:#9a5b00;
 --f-display:"Nanum Myeongjo","Noto Serif KR",serif; --f-body:"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif; --f-mono:"IBM Plex Mono",ui-monospace,Consolas,monospace;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
 --paper:#0f1424; --ink:#ecebe4; --muted:#9ba4ba; --rule:#27304d; --card:#171e36;
 --navy:#aebcf2; --cream:#2a3150; --sansuyu:#f0c531; --sansuyu-soft:#3a3212;
 --pick:#4fd09d; --pick-soft:#12362b; --warn:#e3a54a; color-scheme:dark}}
:root[data-theme="dark"]{
 --paper:#0f1424; --ink:#ecebe4; --muted:#9ba4ba; --rule:#27304d; --card:#171e36;
 --navy:#aebcf2; --cream:#2a3150; --sansuyu:#f0c531; --sansuyu-soft:#3a3212;
 --pick:#4fd09d; --pick-soft:#12362b; --warn:#e3a54a; color-scheme:dark}
*{box-sizing:border-box}
body{background:var(--paper);color:var(--ink);font-family:var(--f-body);font-size:16px;line-height:1.65;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:28px 64px}
.wrap{max-width:1120px;margin:0 auto;display:flex;flex-direction:column;gap:44px}
.slate{font-family:var(--f-mono);font-size:12px;letter-spacing:.08em;color:var(--muted)}
h1,h2,h3{font-family:var(--f-display);text-wrap:balance;margin:0;line-height:1.3}
h1{font-size:clamp(28px,4.4vw,40px);font-weight:800}
h2{font-size:24px;font-weight:800}
p{margin:0}
.lead{max-width:62ch;color:var(--muted)}
header{display:flex;flex-direction:column;gap:12px}
.now{display:flex;flex-wrap:wrap;gap:8px 20px;align-items:center;border-top:2px solid var(--ink);border-bottom:1px solid var(--rule);padding:12px 0;font-size:14px}
.now b{font-weight:700}
.now .v{color:var(--muted)}
.now .v.on{color:var(--pick);font-weight:700}
.now .state{margin-left:auto;font-family:var(--f-mono);font-size:12px;color:var(--muted)}
section{display:flex;flex-direction:column;gap:18px}
.head{display:flex;flex-direction:column;gap:6px}
.head p{color:var(--muted);max-width:66ch;font-size:15px}
.faces{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:18px;align-items:start}
.face{display:flex;flex-direction:column;gap:10px;min-width:0}
.photo{position:relative;border:0;padding:0;background:var(--cream);border-radius:4px;overflow:hidden;cursor:zoom-in;aspect-ratio:9/16;max-width:100%;display:block;width:100%}
.photo img{width:100%;height:100%;object-fit:cover;display:block}
.photo:focus-visible,.btn:focus-visible,.take:focus-visible,textarea:focus-visible{outline:3px solid var(--sansuyu);outline-offset:2px}
.face.fixed .photo{outline:1px solid var(--rule)}
.tag{position:absolute;left:8px;top:8px;background:var(--navy);color:var(--paper);font-size:12px;font-weight:700;padding:3px 8px;border-radius:2px}
.tag.rec{background:var(--sansuyu);color:#141c33}
.face h3{font-size:19px}
.face .one{font-size:14px;color:var(--muted);min-height:3.2em}
.face .chk{font-family:var(--f-mono);font-size:12px;color:var(--muted)}
.pending{border:1.5px dashed var(--rule);border-radius:4px;padding:18px;color:var(--muted);font-size:15px;align-self:stretch;display:flex;align-items:center}
.takes{display:flex;gap:6px;flex-wrap:wrap}
.take{font:inherit;font-size:13px;border:1px solid var(--rule);background:transparent;color:var(--ink);padding:3px 10px;border-radius:999px;cursor:pointer}
.take[aria-pressed="true"]{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.btn{font:inherit;font-weight:700;font-size:15px;border:1.5px solid var(--ink);background:transparent;color:var(--ink);padding:9px 14px;border-radius:4px;cursor:pointer;text-align:center}
.btn:hover{background:var(--sansuyu-soft)}
.btn[aria-pressed="true"]{background:var(--pick);border-color:var(--pick);color:#fff}
.btn.none{border-style:dashed;font-weight:500;align-self:flex-start}
.btn.none[aria-pressed="true"]{background:var(--warn);border-color:var(--warn);border-style:solid;color:#fff}
.voice{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:28px;align-items:start}
.script{border-left:3px solid var(--navy);padding-left:16px;display:flex;flex-direction:column;gap:10px}
.say{display:grid;grid-template-columns:3.2em minmax(0,1fr);gap:10px;font-family:var(--f-display);font-size:17px;line-height:1.55}
.say .who{font-family:var(--f-body);font-size:12px;color:var(--muted);padding-top:5px}
.say.you{color:var(--muted);font-size:15px}
.rows{display:flex;flex-direction:column}
.row{display:grid;grid-template-columns:2.2em minmax(0,1fr) auto;gap:6px 14px;align-items:center;padding:12px 0;border-bottom:1px solid var(--rule)}
.row:first-child{border-top:1px solid var(--rule)}
.row .num{font-family:var(--f-display);font-size:24px;font-weight:800}
.row .meta{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline;font-size:14px}
.row .meta .dur{font-family:var(--f-mono);font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.row .meta .rec{background:var(--sansuyu);color:#141c33;font-size:12px;font-weight:700;padding:1px 7px;border-radius:2px}
.row audio{grid-column:2 / 4;width:100%;height:36px}
.row.pair{background:var(--cream);padding:12px;border:0;border-radius:4px;margin-bottom:10px}
.row.pair .num{font-size:15px;font-family:var(--f-body);font-weight:700}
.names{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px}
.name{display:flex;flex-direction:column;gap:10px;border-top:3px solid var(--navy);padding-top:12px;min-width:0}
.name .big{font-family:var(--f-display);font-size:34px;font-weight:800;line-height:1.2}
.name .big small{font-family:var(--f-body);font-size:13px;font-weight:500;color:var(--muted);margin-left:8px}
.name .big .rec{font-family:var(--f-body);font-size:12px;font-weight:700;background:var(--sansuyu);color:#141c33;padding:2px 7px;border-radius:2px;margin-left:8px;vertical-align:middle}
.name ul{margin:0;padding-left:1.1em;font-size:14px;color:var(--muted);display:flex;flex-direction:column;gap:3px}
.memo{display:flex;flex-direction:column;gap:8px;max-width:720px}
textarea{font:inherit;color:var(--ink);background:var(--card);border:1px solid var(--rule);border-radius:4px;padding:10px 12px;min-height:88px;resize:vertical;width:100%}
details{font-size:14px;color:var(--muted);max-width:76ch}
details summary{cursor:pointer;color:var(--ink);font-weight:500}
details ul{padding-left:1.1em;display:flex;flex-direction:column;gap:4px}
.box{position:fixed;inset:0;background:rgba(8,10,20,.88);display:flex;align-items:center;justify-content:center;padding:max(12px,env(safe-area-inset-top,0px)) 12px max(12px,env(safe-area-inset-bottom,0px));z-index:20;cursor:zoom-out}
.box img{max-width:100%;max-height:100%;object-fit:contain;border-radius:4px}
@media (max-width:760px){.voice{grid-template-columns:minmax(0,1fr)}.now .state{margin-left:0;width:100%}.face .one{min-height:0}}
</style>
<div class="wrap">
<header>
 <p class="slate">SYNK WORLD · 시즌 1 · 선배 소개</p>
 <h1>새 여자 선배를 골라 주세요</h1>
 <p class="lead">태오와 나란히 「선배 소개」에 서는 선배입니다. 같은 과 3학년이고, 무심한 듯 챙기는 사람입니다. 걸음이 빠르고 군말이 없습니다. 얼굴, 목소리, 이름을 하나씩 누르시면 바로 저장됩니다. 마음에 드는 것이 없으면 「이 가운데 없다」를 누르고 아래에 한 줄 남겨 주세요.</p>
 <div class="now" id="now" aria-live="polite"></div>
</header>

<section aria-labelledby="h-face">
 <div class="head"><h2 id="h-face">얼굴</h2>
 <p>참고 사진 없이 글로만 새로 구운 얼굴입니다. 자리와 옷은 태오 기준 사진과 같은 3월 첫 주 학생 식당, 같은 과 점퍼로 맞췄습니다. 사진을 누르면 크게 보입니다.</p></div>
 <div class="faces" id="faces"></div>
 <button class="btn none" id="face-none" type="button">얼굴은 이 가운데 없다</button>
</section>

<section aria-labelledby="h-voice">
 <div class="head"><h2 id="h-voice">목소리</h2>
 <p>1화 식당 장면의 선배 대사 네 줄을 새 선배의 말투로 쓴 예시입니다. 여섯 목소리가 같은 줄을 같은 크기로 읽습니다. 이름은 아직 정하지 않아 대사에 넣지 않았습니다. ${esc(시안.목소리말 || '')}</p></div>
 <div class="voice">
  <div class="script">${대본}</div>
  <div>
   <div class="row pair"><span class="num">태오</span><span class="meta">이미 정해진 태오의 1화 첫 줄입니다. 나란히 놓였을 때를 가늠하실 때 들어 보세요.</span><audio controls preload="none" src="snd/taeo.mp3"></audio></div>
   <div class="rows" id="voices"></div>
   <p style="margin-top:14px"><button class="btn none" id="voice-none" type="button">목소리는 이 가운데 없다</button></p>
  </div>
 </div>
</section>

<section aria-labelledby="h-name">
 <div class="head"><h2 id="h-name">이름</h2>
 <p>태오처럼 받침 없이 끝나는 두 글자 이름으로 골랐습니다. 그러면 「태오 선배가」와 「○○ 선배가」처럼 뒤에 붙는 말이 같아서 학생이 말하는 줄을 두 판이 함께 쓸 수 있습니다. 서하, 하린, 지호와 소리가 겹치지 않는 이름만 남겼습니다.</p></div>
 <div class="names" id="names"></div>
 <button class="btn none" id="name-none" type="button">이름은 이 가운데 없다</button>
</section>

<section aria-labelledby="h-memo">
 <div class="head"><h2 id="h-memo">한 줄</h2><p>바꾸고 싶은 곳이나 떠오르는 이름이 있으면 적어 주세요. 「저장」을 누르면 남습니다.</p></div>
 <div class="memo"><textarea id="memo" placeholder="예: 가 얼굴에 나 머리 길이면 좋겠다"></textarea><button class="btn" id="memo-save" type="button" style="align-self:flex-start">저장</button></div>
</section>

<details><summary>어떻게 만들었나</summary>
 <ul>
  ${시안.만든법.map((m) => `<li>${esc(m)}</li>`).join('\n  ')}
 </ul>
</details>
</div>
<script>
const DATA = ${JSON.stringify(자료)};
const TAEO = ${JSON.stringify({ src: 태오그림 })};
let picks = { face: null, take: {}, voice: null, name: null, memo: '' };
let ref = null, saving = Promise.resolve(), state = '불러오는 중';
const $ = (id) => document.getElementById(id);
const h = (tag, attrs, kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (k === 'text') e.textContent = v; else if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn); else e.setAttribute(k, v); } for (const c of [].concat(kids || [])) if (c) e.append(c); return e; };
const faceName = (id) => id === 'none' ? '이 가운데 없다' : (DATA.얼굴.find((f) => f.id === id) || {}).이름;
const voiceName = (id) => id === 'none' ? '이 가운데 없다' : (DATA.목소리.find((v) => v.id === id) ? DATA.목소리.find((v) => v.id === id).번호 + '번' : null);
const nameName = (id) => id === 'none' ? '이 가운데 없다' : (DATA.이름.find((n) => n.id === id) || {}).이름;

function open(src, alt) { const b = h('div', { class: 'box', role: 'dialog', 'aria-label': alt + ' 크게 보기', tabindex: '-1', on: { click: () => b.remove(), keydown: (e) => { if (e.key === 'Escape') b.remove(); } } }, h('img', { src, alt })); document.body.append(b); b.focus(); }

function renderNow() {
  const it = (label, v) => h('span', {}, [h('b', { text: label + ' ' }), h('span', { class: 'v' + (v ? ' on' : ''), text: v || '아직' })]);
  $('now').replaceChildren(it('얼굴', picks.face && faceName(picks.face)), it('목소리', picks.voice && voiceName(picks.voice)), it('이름', picks.name && nameName(picks.name)), h('span', { class: 'state', text: state }));
}
function renderFaces() {
  const cards = [h('div', { class: 'face fixed' }, [
    h('button', { class: 'photo', type: 'button', 'aria-label': '태오 기준 사진 크게 보기', on: { click: () => open(TAEO.src, '태오') } }, [h('img', { src: TAEO.src, alt: '권태오 기준 사진', loading: 'lazy' }), h('span', { class: 'tag', text: '이미 정해진 선배' })]),
    h('h3', { text: '권태오' }), h('p', { class: 'one', text: '장난기 있는 3학년. 덧니가 보이는 웃음. 새 선배는 이 사진 옆에 놓입니다.' })])];
  for (const f of DATA.얼굴) {
    const shown = picks.take[f.id] || f.판들[0].id;
    const cur = f.판들.find((p) => p.id === shown) || f.판들[0];
    cards.push(h('div', { class: 'face' }, [
      h('button', { class: 'photo', type: 'button', 'aria-label': f.이름 + ' 크게 보기', on: { click: () => open(cur.src, f.이름) } }, [h('img', { src: cur.src, alt: f.이름 + ' 후보 사진', loading: 'lazy' }), DATA.추천.얼굴 === f.id ? h('span', { class: 'tag rec', text: 'Claude 추천' }) : null]),
      h('h3', { text: f.이름 }), h('p', { class: 'one', text: f.한줄 }),
      f.판들.length > 1 ? h('div', { class: 'takes', role: 'group', 'aria-label': f.이름 + ' 다른 판' }, f.판들.map((p, i) => h('button', { class: 'take', type: 'button', 'aria-pressed': String(p.id === cur.id), text: (i + 1) + '번 판', on: { click: () => { picks.take = { ...picks.take, [f.id]: p.id }; renderFaces(); if (picks.face === f.id) save({}); } } }))) : null,
      h('p', { class: 'chk', text: f.대조 }),
      h('button', { class: 'btn', type: 'button', 'aria-pressed': String(picks.face === f.id), text: picks.face === f.id ? '이 얼굴로 골랐습니다' : '이 얼굴로', on: { click: () => save({ face: f.id, take: { ...picks.take, [f.id]: cur.id } }) } })]));
  }
  if (DATA.얼굴대기) cards.push(h('p', { class: 'pending', text: DATA.얼굴대기 }));
  $('faces').replaceChildren(...cards);
  $('face-none').hidden = !DATA.얼굴.length;
  $('face-none').setAttribute('aria-pressed', String(picks.face === 'none'));
}
function renderVoices() {
  $('voices').replaceChildren(...DATA.목소리.map((v) => h('div', { class: 'row' }, [
    h('span', { class: 'num', text: String(v.번호) }),
    h('span', { class: 'meta' }, [h('span', { text: v.결 }), h('span', { class: 'dur', text: v.초.toFixed(1) + '초 · ' + v.음높이 + 'Hz' }), DATA.추천.목소리 === v.id ? h('span', { class: 'rec', text: 'Claude 추천' }) : null]),
    h('button', { class: 'btn', type: 'button', 'aria-pressed': String(picks.voice === v.id), text: picks.voice === v.id ? '골랐습니다' : '이 목소리로', on: { click: () => save({ voice: v.id }) } }),
    h('audio', { controls: '', preload: 'none', src: v.src })])));
  $('voice-none').setAttribute('aria-pressed', String(picks.voice === 'none'));
}
function renderNames() {
  $('names').replaceChildren(...DATA.이름.map((n) => h('div', { class: 'name' }, [
    h('p', { class: 'big' }, [document.createTextNode(n.이름), h('small', { text: n.부름 }), DATA.추천.이름 === n.id ? h('span', { class: 'rec', text: 'Claude 추천' }) : null]),
    h('ul', {}, n.까닭.map((t) => h('li', { text: t }))),
    h('button', { class: 'btn', type: 'button', 'aria-pressed': String(picks.name === n.id), text: picks.name === n.id ? '골랐습니다' : '이 이름으로', on: { click: () => save({ name: n.id }) } })])));
  $('name-none').setAttribute('aria-pressed', String(picks.name === 'none'));
}
function render() { renderNow(); renderFaces(); renderVoices(); renderNames(); }
function save(patch) {
  picks = { ...picks, ...patch };
  state = ref ? '저장하는 중' : '이 화면에서는 저장되지 않습니다. 고르신 것을 대화로 알려 주세요.';
  render();
  if (!ref) return;
  const body = { face: picks.face, take: picks.take, voice: picks.voice, name: picks.name, memo: picks.memo, 때: new Date().toISOString() };
  saving = saving.then(() => ref.set(body)).then(() => { state = '저장했습니다'; renderNow(); }, () => { state = '저장하지 못했습니다. 고르신 것을 대화로 알려 주세요.'; renderNow(); });
}
$('face-none').addEventListener('click', () => save({ face: 'none' }));
$('voice-none').addEventListener('click', () => save({ voice: 'none' }));
$('name-none').addEventListener('click', () => save({ name: 'none' }));
$('memo-save').addEventListener('click', () => save({ memo: $('memo').value.trim().slice(0, 1000) }));
document.addEventListener('play', (e) => { for (const a of document.querySelectorAll('audio')) if (a !== e.target) a.pause(); }, true);
render();
(async () => {
  const db = window.claude && window.claude.use ? await window.claude.use('db') : null;
  if (!db) { state = '이 화면에서는 저장되지 않습니다. 고르신 것을 대화로 알려 주세요.'; renderNow(); return; }
  ref = db.doc('picks/senior-f');
  const timer = setTimeout(() => { state = '저장소에 아직 닿지 못했습니다. 조금 뒤에 다시 눌러 주세요.'; renderNow(); }, 10000);
  let first = true;
  ref.onSnapshot((snap) => {
    clearTimeout(timer);
    if (snap.exists) { const d = snap.data(); picks = { ...picks, face: d.face ?? null, take: d.take || {}, voice: d.voice ?? null, name: d.name ?? null, memo: d.memo || '' }; if (first || document.activeElement !== $('memo')) $('memo').value = picks.memo; }
    if (state === '불러오는 중' || state.startsWith('저장소에')) state = snap.exists ? '앞서 고르신 것을 불러왔습니다' : '아직 고르신 것이 없습니다';
    first = false; render();
  }, () => { clearTimeout(timer); ref = null; state = '저장소에 닿지 못했습니다. 고르신 것을 대화로 알려 주세요.'; renderNow(); });
})();
</script>
`;
fs.writeFileSync(path.join(끝, 'index.html'), html);
const 파일 = {};
for (const f of fs.readdirSync(path.join(끝, 'img'))) 파일[`img/${f}`] = path.join(끝, 'img', f).replace(/\\/g, '/');
for (const f of fs.readdirSync(path.join(끝, 'snd'))) 파일[`snd/${f}`] = path.join(끝, 'snd', f).replace(/\\/g, '/');
fs.writeFileSync(path.join(끝, '파일.json'), JSON.stringify(파일, null, 1));
console.log('만듦', path.join(끝, 'index.html'), `· 그림 ${줄일.length} · 소리 ${소리들.length + 1}`);
