#!/usr/bin/env node
/**
 * 한국어 동아리장 고르기 페이지 만들기 (2026-11-26) — 새여자선배-20261117/판만들기.mjs의 짜임을 옮겼다.
 * 얼굴(후보.mjs로 구운 판과 지금 얼굴) · 목소리(목소리.mjs로 구운 판) · 이름 후보를 한 장에 놓는다. 유호님이 누른 것은 페이지 저장소(db)의
 * picks/club-head 문서에 남고 Claude가 읽는다. 무엇을 보일지는 같은 폴더의 시안.mjs가 정한다.
 *
 *   node experiences/world-front/qa/동아리장후보_20261126/판만들기.mjs
 *   → 공용 작업본 .tmp/club-head-pick/index.html · img/*.jpg · snd/*.mp3 · 파일.json(게시할 파일 짝)
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
const 소리폴더 = path.join(공용, '.tmp', 'club-head-voice');
const 끝 = path.join(공용, '.tmp', 'club-head-pick');
const 시안 = (await import(`./시안.mjs?${Date.now()}`)).default;
const 받아 = JSON.parse(fs.readFileSync(path.join(소리폴더, '받아쓰기.json'), 'utf8'));
for (const d of ['img', 'snd']) fs.rmSync(path.join(끝, d), { recursive: true, force: true });
fs.mkdirSync(path.join(끝, 'img'), { recursive: true });
fs.mkdirSync(path.join(끝, 'snd'), { recursive: true });

// ── 그림: 긴 변 1,600으로 줄인 JPEG ──
const 줄일 = [];
const 그림 = (원본, 이름, 긴변 = 1600) => { 줄일.push([원본, path.join(끝, 'img', `${이름}.jpg`), 긴변]); return `img/${이름}.jpg`; };
const 지금 = { src: 그림(path.join(뿌리, 시안.지금.그림), 'now'), 대조: 시안.지금.대조 };
const 튜터 = 시안.튜터.map((t, i) => ({ 이름: t.이름, src: 그림(path.join(뿌리, t.그림), `tutor${i + 1}`, 700) }));
const 얼굴들 = 시안.얼굴.map((f) => ({ id: f.id, 이름: f.이름, 한줄: f.한줄, 판들: f.판.map((p) => ({ ...p, 대조: 시안.대조[p.id] || '실존 인물 대조 중입니다.', src: 그림(path.join(얼굴폴더, 'out', `${p.id}.png`), p.id) })) }));
const r = spawnSync('python', ['-X', 'utf8', '-c', `
import json, sys
from PIL import Image
for src, dst, side in json.loads(sys.argv[1]):
    im = Image.open(src).convert('RGB')
    k = side / max(im.size)
    if k < 1: im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    im.save(dst, quality=86, optimize=True)
`, JSON.stringify(줄일)], { encoding: 'utf8' });
if (r.status !== 0) { console.error('그림 줄이기 실패', r.stderr); process.exit(1); }

// ── 소리: 후보 듣기 판 ──
const 소리들 = 시안.목소리순서.map((k, i) => {
  fs.copyFileSync(path.join(소리폴더, '판', `${k}.mp3`), path.join(끝, 'snd', `v${i + 1}.mp3`));
  return { id: k, 번호: i + 1, src: `snd/v${i + 1}.mp3`, 초: 받아[k].초, 음높이: 받아[k].음높이, 일치: 받아[k].일치, 결: 목소리후보[k].결 };
});

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const 자료 = { 지금, 튜터, 얼굴: 얼굴들, 목소리: 소리들, 이름: 시안.이름, 추천: 시안.추천 };
const 학생 = ['아직 한글도 몰라요.', '', '(세 튜터 가운데 한 명을 고른다)', ''];
const 대본 = 줄들.map((l, i) => `<div class="say"><span class="who">동아리장</span><p>${esc(l.text)}</p></div>${학생[i] ? `<div class="say you"><span class="who">학생</span><p>${esc(학생[i])}</p></div>` : ''}`).join('\n');
const 제이슨 = JSON.stringify(자료).replace(/</g, '\\u003c');

const html = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>동아리장 후보 고르기</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap">
<style>
/* VOICE: 동아리방 게시판에 붙은 「새 동아리장 뽑기」 한 장. 담백하고 손에 잡히게.
   IDEA: 동아리방 문에 붙은 사진 게시판 — 지금 얼굴과 새 후보 셋이 나란히 붙고, 아래에 목소리 줄과 이름표.
   PICTURE: 첫 화면은 사진 넷이 차지한다. 사진이 곧 고를 것이다.
   COLOUR · TYPE: 종이색 바탕, 먹색 글, 동아리 맨투맨의 짙은 초록 하나(고른 것). Noto Sans KR 하나를 굵기로 나눈다.
   LAYOUT: 머리 → 지금 고른 것 한 줄 → 얼굴 → 목소리(대본 | 듣기) → 이름 → 한 줄 메모. 600px 아래는 한 줄로 쌓는다. */
:root{color-scheme:light dark;
 --paper:light-dark(#f4f1ea,#14130f);--card:light-dark(#fffdf8,#1d1c17);--ink:light-dark(#1b1a16,#eeebe2);--muted:light-dark(#625e54,#a9a496);
 --rule:light-dark(#dcd6c8,#34322a);--pick:light-dark(#1f5b3f,#6fc79b);--pick-ink:light-dark(#ffffff,#0f1a14);--soft:light-dark(#e6efe8,#1d2a22);--warn:light-dark(#9a5b00,#e3a54a);--rec:light-dark(#f3dc8c,#4a3f16)}
:root[data-theme=light]{color-scheme:light}:root[data-theme=dark]{color-scheme:dark}
*{box-sizing:border-box;min-width:0}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 "Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif;overflow-x:clip}
.wrap{max-width:1180px;margin:0 auto;padding:clamp(24px,4vw,48px) max(4vw,16px) 72px;display:flex;flex-direction:column;gap:48px}
h1,h2,h3{margin:0;line-height:1.15;text-wrap:balance}
h1{font-size:clamp(30px,4.6vw,46px);font-weight:900}
h2{font-size:26px;font-weight:900}
h3{font-size:19px;font-weight:700}
p{margin:0}
header{display:flex;flex-direction:column;gap:14px}
.lead{max-width:64ch;color:var(--muted);font-size:17px}
.now{display:flex;flex-wrap:wrap;gap:8px 22px;align-items:center;border-top:2px solid var(--ink);border-bottom:1px solid var(--rule);padding:12px 0;font-size:15px}
.now .v{color:var(--muted)}.now .v.on{color:var(--pick);font-weight:700}
.now .state{margin-left:auto;font-size:13px;color:var(--muted)}
section{display:flex;flex-direction:column;gap:18px}
.head{display:flex;flex-direction:column;gap:6px}.head p{color:var(--muted);max-width:68ch;font-size:15px}
.faces{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;align-items:start}
.face{display:flex;flex-direction:column;gap:10px;background:var(--card);border:1px solid var(--rule);border-radius:6px;padding:10px 10px 14px}
.photo{position:relative;border:0;padding:0;background:var(--rule);border-radius:4px;overflow:hidden;cursor:zoom-in;aspect-ratio:3/4;width:100%;display:block}
.photo img{width:100%;height:100%;object-fit:cover;display:block}
.tag{position:absolute;left:8px;top:8px;background:var(--ink);color:var(--paper);font-size:12px;font-weight:700;padding:3px 8px;border-radius:3px}
.tag.rec{background:var(--rec);color:#1b1a16}
.face .one{font-size:14px;color:var(--muted)}
.face .chk{font-size:13px;color:var(--muted);border-top:1px dashed var(--rule);padding-top:8px}
.takes{display:flex;gap:6px;flex-wrap:wrap}
.take{font:inherit;font-size:14px;border:1px solid var(--rule);background:transparent;color:var(--ink);min-height:36px;padding:4px 12px;border-radius:999px;cursor:pointer}
.take[aria-pressed="true"]{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.btn{font:inherit;font-weight:700;font-size:15px;border:1.5px solid var(--ink);background:transparent;color:var(--ink);min-height:44px;padding:8px 14px;border-radius:5px;cursor:pointer}
.btn:hover{background:var(--soft)}
.btn[aria-pressed="true"]{background:var(--pick);border-color:var(--pick);color:var(--pick-ink)}
.btn.none{border-style:dashed;font-weight:500;align-self:flex-start}
.btn.none[aria-pressed="true"]{background:var(--warn);border-color:var(--warn);border-style:solid;color:#fff}
.photo:focus-visible,.btn:focus-visible,.take:focus-visible,textarea:focus-visible{outline:3px solid var(--pick);outline-offset:2px}
.tutors{display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:14px;color:var(--muted)}
.tutors span{display:flex;align-items:center;gap:8px}
.tutors img{width:44px;height:44px;border-radius:50%;object-fit:cover;border:1px solid var(--rule)}
.voice{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:28px;align-items:start}
.script{border-left:3px solid var(--pick);padding-left:16px;display:flex;flex-direction:column;gap:10px}
.say{display:grid;grid-template-columns:4.2em minmax(0,1fr);gap:10px;font-size:17px;line-height:1.55}
.say .who{font-size:12px;color:var(--muted);padding-top:5px}
.say.you{color:var(--muted);font-size:15px}
.row{display:grid;grid-template-columns:2.2em minmax(0,1fr) auto;gap:6px 14px;align-items:center;padding:12px 0;border-bottom:1px solid var(--rule)}
.row:first-child{border-top:1px solid var(--rule)}
.row .num{font-size:24px;font-weight:900}
.row .meta{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline;font-size:15px}
.row .dur{font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}
.row .rec{background:var(--rec);color:#1b1a16;font-size:12px;font-weight:700;padding:1px 7px;border-radius:3px}
.row audio{grid-column:2 / 4;width:100%;height:40px}
.names{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
.name{display:flex;flex-direction:column;gap:10px;border-top:3px solid var(--ink);padding-top:12px}
.name .big{font-size:36px;font-weight:900;line-height:1.15}
.name .big small{font-size:14px;font-weight:500;color:var(--muted);margin-left:8px}
.name .big .rec{font-size:12px;font-weight:700;background:var(--rec);color:#1b1a16;padding:2px 7px;border-radius:3px;margin-left:8px;vertical-align:middle}
.name .sub{font-size:14px;color:var(--muted)}
.name ul{margin:0;padding-left:1.1em;font-size:14px;color:var(--muted);display:flex;flex-direction:column;gap:3px}
.memo{display:flex;flex-direction:column;gap:8px;max-width:720px}
textarea{font:inherit;font-size:16px;color:var(--ink);background:var(--card);border:1px solid var(--rule);border-radius:5px;padding:10px 12px;min-height:88px;resize:vertical;width:100%}
details{font-size:14px;color:var(--muted);max-width:78ch}
details summary{cursor:pointer;color:var(--ink);font-weight:500;min-height:32px}
details ul{padding-left:1.1em;display:flex;flex-direction:column;gap:4px}
.box{position:fixed;inset:0;background:rgba(10,10,8,.9);display:flex;align-items:center;justify-content:center;padding:12px;z-index:20;cursor:zoom-out}
.box img{max-width:100%;max-height:100%;object-fit:contain;border-radius:4px}
@media (max-width:960px){.faces{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:760px){.voice{grid-template-columns:minmax(0,1fr)}.names{grid-template-columns:minmax(0,1fr)}.now .state{margin-left:0;width:100%}}
@media (max-width:420px){.faces{grid-template-columns:minmax(0,1fr)}}
</style></head><body>
<div class="wrap">
<header>
 <h1>한국어 동아리장을 골라 주세요</h1>
 <p class="lead">서울행 내 길에서 학생에게 먼저 말을 거는 사람입니다. 4학년이고, 새로 온 유학생 이름을 첫날 다 외우는 수다스럽고 따뜻한 선배입니다. 지금 쓰는 「민우」 얼굴과 이름은 임시입니다. 얼굴, 목소리, 이름을 하나씩 눌러 주세요. 누르시면 바로 저장됩니다.</p>
 <div class="now" id="now" aria-live="polite"></div>
</header>

<section aria-labelledby="h-face">
 <div class="head"><h2 id="h-face">얼굴</h2>
 <p>지금 얼굴과 같은 셀카(동아리방 문간, 손 인사, 초록 맨투맨, 같은 빛)에서 얼굴만 세 방향으로 바꿔 새로 구웠습니다. 방향마다 두 판이 있어 「1번 · 2번」으로 넘겨 보실 수 있습니다. 사진을 누르면 크게 보입니다.</p>${시안.얼굴말 ? `<p>${esc(시안.얼굴말)}</p>` : ''}</div>
 <div class="tutors" id="tutors"></div>
 <div class="faces" id="faces"></div>
 <button class="btn none" id="face-none" type="button">얼굴은 이 가운데 없다</button>
</section>

<section aria-labelledby="h-voice">
 <div class="head"><h2 id="h-voice">목소리</h2>
 <p>처음 만남에서 동아리장이 실제로 하는 반말 네 줄입니다. 여섯 목소리가 같은 줄을 같은 크기로 읽습니다. 이름은 아직 정하지 않아 넣지 않았습니다. ${esc(시안.목소리말 || '')}</p></div>
 <div class="voice">
  <div class="script">${대본}</div>
  <div><div id="voices"></div><p style="margin-top:14px"><button class="btn none" id="voice-none" type="button">목소리는 이 가운데 없다</button></p></div>
 </div>
</section>

<section aria-labelledby="h-name">
 <div class="head"><h2 id="h-name">이름</h2>
 <p>받침 없이 끝나는 두 글자 이름입니다. 「○○야」로 소개하고, 서하 · 하린 · 지호 · 태오 · 유나와 소리가 겹치지 않습니다. 성은 설정에만 두고 화면에는 이름만 나옵니다.</p></div>
 <div class="names" id="names"></div>
 <button class="btn none" id="name-none" type="button">이름은 이 가운데 없다</button>
</section>

<section aria-labelledby="h-memo">
 <div class="head"><h2 id="h-memo">한 줄</h2><p>바꾸고 싶은 곳이나 떠오르는 이름이 있으면 적어 주세요. 「저장」을 누르면 남습니다.</p></div>
 <div class="memo"><textarea id="memo" placeholder="예: 나 얼굴에 가 머리면 좋겠다"></textarea><button class="btn" id="memo-save" type="button" style="align-self:flex-start">저장</button></div>
</section>

<details><summary>어떻게 만들었나</summary><ul>
 ${시안.만든법.map((m) => `<li>${esc(m)}</li>`).join('\n ')}
</ul></details>
</div>
<script>
{
const DATA = ${제이슨};
let picks = { face: null, take: {}, voice: null, name: null, memo: '' };
let ref = null, saving = Promise.resolve(), state = '불러오는 중';
const $ = (id) => document.getElementById(id);
const h = (tag, attrs, kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (k === 'text') e.textContent = v; else if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn); else e.setAttribute(k, v); } for (const c of [].concat(kids || [])) if (c) e.append(c); return e; };
const takeOf = (dir) => { const f = DATA.얼굴.find((x) => x.id === dir); return f ? (f.판들.find((p) => p.id === picks.take[dir]) || f.판들[0]) : null; };
const faceName = (id) => { if (id === 'none') return '이 가운데 없다'; if (id === 'now') return '지금 얼굴'; const f = DATA.얼굴.find((x) => x.id === id); const p = takeOf(id); return f ? f.이름 + (p ? ' ' + p.이름 : '') : null; };
const voiceName = (id) => id === 'none' ? '이 가운데 없다' : (DATA.목소리.find((v) => v.id === id) ? DATA.목소리.find((v) => v.id === id).번호 + '번' : null);
const nameName = (id) => id === 'none' ? '이 가운데 없다' : (DATA.이름.find((n) => n.id === id) || {}).이름;
function open(src, alt) { const b = h('div', { class: 'box', role: 'dialog', 'aria-label': alt + ' 크게 보기', tabindex: '-1', on: { click: () => b.remove(), keydown: (e) => { if (e.key === 'Escape') b.remove(); } } }, h('img', { src, alt })); document.body.append(b); b.focus(); }
function renderNow() {
  const it = (label, v) => h('span', {}, [h('b', { text: label + ' ' }), h('span', { class: 'v' + (v ? ' on' : ''), text: v || '아직' })]);
  $('now').replaceChildren(it('얼굴', picks.face ? faceName(picks.face) : null), it('목소리', picks.voice ? voiceName(picks.voice) : null), it('이름', picks.name ? nameName(picks.name) : null), h('span', { class: 'state', text: state }));
}
function card(kids) { return h('div', { class: 'face' }, kids); }
function renderFaces() {
  const nowPicked = picks.face === 'now';
  const cards = [card([
    h('button', { class: 'photo', type: 'button', 'aria-label': '지금 얼굴 크게 보기', on: { click: () => open(DATA.지금.src, '지금 얼굴') } }, [h('img', { src: DATA.지금.src, alt: '지금 쓰는 동아리장 얼굴', loading: 'lazy' }), h('span', { class: 'tag', text: '지금 얼굴(임시)' })]),
    h('h3', { text: '지금 얼굴' }), h('p', { class: 'one', text: '옆 가르마 짧은 머리와 활짝 웃음. 지금 앱에 나오는 얼굴입니다.' }),
    h('p', { class: 'chk', text: DATA.지금.대조 }),
    h('button', { class: 'btn', type: 'button', 'aria-pressed': String(nowPicked), text: nowPicked ? '지금 얼굴로 골랐습니다' : '지금 얼굴 그대로', on: { click: () => save({ face: 'now' }) } })])];
  for (const f of DATA.얼굴) {
    const cur = takeOf(f.id), picked = picks.face === f.id;
    cards.push(card([
      h('button', { class: 'photo', type: 'button', 'aria-label': f.이름 + ' ' + cur.이름 + ' 크게 보기', on: { click: () => open(cur.src, f.이름) } }, [h('img', { src: cur.src, alt: f.이름 + ' 후보 사진', loading: 'lazy' }), DATA.추천.얼굴 === f.id ? h('span', { class: 'tag rec', text: 'Claude 추천' }) : null]),
      h('h3', { text: f.이름 }), h('p', { class: 'one', text: f.한줄 }),
      h('div', { class: 'takes', role: 'group', 'aria-label': f.이름 + ' 판' }, f.판들.map((p) => h('button', { class: 'take', type: 'button', 'aria-pressed': String(p.id === cur.id), text: p.이름, on: { click: () => { picks.take = { ...picks.take, [f.id]: p.id }; if (picked) save({}); else renderFaces(); } } }))),
      h('p', { class: 'chk', text: cur.대조 }),
      h('button', { class: 'btn', type: 'button', 'aria-pressed': String(picked), text: picked ? '이 얼굴로 골랐습니다' : '이 얼굴로', on: { click: () => save({ face: f.id, take: { ...picks.take, [f.id]: cur.id } }) } })]));
  }
  $('faces').replaceChildren(...cards);
  $('face-none').setAttribute('aria-pressed', String(picks.face === 'none'));
}
function renderVoices() {
  $('voices').replaceChildren(...DATA.목소리.map((v) => {
    const on = picks.voice === v.id;
    return h('div', { class: 'row' }, [
      h('span', { class: 'num', text: String(v.번호) }),
      h('span', { class: 'meta' }, [h('span', { text: v.결 }), h('span', { class: 'dur', text: v.초.toFixed(1) + '초 · ' + v.음높이 + 'Hz · 받아쓰기 ' + Math.round(v.일치 * 100) + '%' }), DATA.추천.목소리 === v.id ? h('span', { class: 'rec', text: 'Claude 추천' }) : null]),
      h('button', { class: 'btn', type: 'button', 'aria-pressed': String(on), text: on ? '골랐습니다' : '이 목소리로', on: { click: () => save({ voice: v.id }) } }),
      h('audio', { controls: '', preload: 'none', src: v.src })]);
  }));
  $('voice-none').setAttribute('aria-pressed', String(picks.voice === 'none'));
}
function renderNames() {
  $('names').replaceChildren(...DATA.이름.map((n) => {
    const on = picks.name === n.id;
    return h('div', { class: 'name' }, [
      h('p', { class: 'big' }, [document.createTextNode(n.이름), h('small', { text: n.성명 }), DATA.추천.이름 === n.id ? h('span', { class: 'rec', text: 'Claude 추천' }) : null]),
      h('p', { class: 'sub', text: n.부름 }),
      h('ul', {}, n.까닭.map((t) => h('li', { text: t }))),
      h('button', { class: 'btn', type: 'button', 'aria-pressed': String(on), text: on ? '골랐습니다' : '이 이름으로', on: { click: () => save({ name: n.id }) } })]);
  }));
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
$('tutors').replaceChildren(h('span', { text: '함께 나오는 튜터:' }), ...DATA.튜터.map((t) => h('span', {}, [h('img', { src: t.src, alt: t.이름 + ' 얼굴', loading: 'lazy' }), document.createTextNode(t.이름)])));
$('face-none').addEventListener('click', () => save({ face: 'none' }));
$('voice-none').addEventListener('click', () => save({ voice: 'none' }));
$('name-none').addEventListener('click', () => save({ name: 'none' }));
$('memo-save').addEventListener('click', () => save({ memo: $('memo').value.trim().slice(0, 1000) }));
document.addEventListener('play', (e) => { for (const a of document.querySelectorAll('audio')) if (a !== e.target) a.pause(); }, true);
render();
(async () => {
  let db = null;
  try { db = window.claude && window.claude.use ? await window.claude.use('db') : null; } catch { db = null; }
  if (!db) { state = '이 화면에서는 저장되지 않습니다. 고르신 것을 대화로 알려 주세요.'; renderNow(); return; }
  ref = db.doc('picks/club-head');
  const timer = setTimeout(() => { state = '저장소에 아직 닿지 못했습니다. 조금 뒤에 다시 눌러 주세요.'; renderNow(); }, 10000);
  let first = true;
  ref.onSnapshot((snap) => {
    clearTimeout(timer);
    if (snap.exists) { const d = snap.data(); picks = { ...picks, face: d.face ?? null, take: d.take || {}, voice: d.voice ?? null, name: d.name ?? null, memo: d.memo || '' }; if (first || document.activeElement !== $('memo')) $('memo').value = picks.memo; }
    if (state === '불러오는 중' || state.startsWith('저장소에')) state = snap.exists ? '앞서 고르신 것을 불러왔습니다' : '아직 고르신 것이 없습니다';
    first = false; render();
  }, () => { clearTimeout(timer); ref = null; state = '저장소에 닿지 못했습니다. 고르신 것을 대화로 알려 주세요.'; renderNow(); });
})();
}
</script>
</body></html>
`;
fs.writeFileSync(path.join(끝, 'index.html'), html);
const 파일 = {};
for (const f of fs.readdirSync(path.join(끝, 'img'))) 파일[`img/${f}`] = path.join(끝, 'img', f).replace(/\\/g, '/');
for (const f of fs.readdirSync(path.join(끝, 'snd'))) 파일[`snd/${f}`] = path.join(끝, 'snd', f).replace(/\\/g, '/');
fs.writeFileSync(path.join(끝, '파일.json'), JSON.stringify(파일, null, 1));
console.log('만듦', path.join(끝, 'index.html'), `· 그림 ${줄일.length} · 소리 ${소리들.length}`);
