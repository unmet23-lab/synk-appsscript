#!/usr/bin/env node
/**
 * 1화 2D 라이브 · 실사 비교 페이지 만들기(2026-10-30) — 라이브실사.mjs가 구운 판과 라이브조각.py가 만든 조각(<작업>/보기/라이브.json)으로
 * 두 화면을 나란히 보이는 claude.ai 페이지 한 장을 만든다. 장면 탭과 「대사 듣기」 하나가 두 화면을 같이 움직인다.
 * 2D 라이브: 배경 + 오린 입신이 숨 쉬고(살짝 흔들림) 눈을 깜빡이며, 대사를 들으면 소리 크기에 맞춰 입 조각을 켰다 끈다.
 * 실사: 같은 장면의 스틸이 천천히 다가간다. 고른 쪽은 페이지 저장소(db) picks/direction에 누르는 즉시 남는다.
 *
 *   node 비교판만들기.mjs <작업>     → <작업>/비교판.html · <작업>/비교판_파일.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ep01 from '../../s1/ep01.mjs';
import 글 from './비교판_글.mjs';

const 작업 = process.argv[2];
if (!작업) { console.error('쓰는 법: node 비교판만들기.mjs <작업 폴더>'); process.exit(2); }
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 소리폴더 = path.resolve(여기, '../../s1/소리');
const 보기 = path.join(작업, '보기');
const 조각 = JSON.parse(fs.readFileSync(path.join(보기, '라이브.json'), 'utf8'));

const 파일 = {};
const 붙임 = (이름, 원본) => {
 if (!fs.existsSync(원본)) throw new Error(`파일이 없다: ${원본}`);
 파일[이름] = 원본.replace(/\\/g, '/');
 return 이름;
};
const 간격 = 0.04;
function 봉투(파일) {
 const r = spawnSync('ffmpeg', ['-v', 'error', '-i', 파일, '-ac', '1', '-ar', '8000', '-f', 's16le', '-'], { maxBuffer: 64 * 1024 * 1024 });
 if (r.status !== 0) throw new Error(`ffmpeg 실패: ${파일} ${r.stderr}`);
 const s = new Int16Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.length / 2));
 const n = Math.round(8000 * 간격); const 값 = [];
 for (let i = 0; i < s.length; i += n) { let q = 0; const e = Math.min(s.length, i + n); for (let j = i; j < e; j++) q += s[j] * s[j]; 값.push(Math.sqrt(q / Math.max(1, e - i))); }
 const 큰 = Math.max(...값) || 1;
 return 값.map((v) => Math.round((v / 큰) * 100) / 100);
}
const 줄찾기 = (역, 번호) => {
 const 줄 = JSON.parse(fs.readFileSync(path.join(소리폴더, `ep01-${역}.json`), 'utf8')).줄.find((l) => l.번호 === 번호);
 const 대본줄 = ep01.촬영일.flatMap((d) => d.줄 || []).find((l) => l.말 === 줄.말);
 const 원본 = path.join(소리폴더, 줄.파일);
 return { 말: 줄.말, 뜻: 대본줄?.뜻 || '', 소리: 붙임(`audio/${줄.파일}`, 원본), 초: 줄.초, 간격, 봉투: 봉투(원본) };
};
const 라이브 = (id, bg) => ({
 bg: 붙임(`img/${bg}.jpg`, path.join(보기, `${bg}.jpg`)),
 몸: 붙임(`img/${id}-cut.webp`, path.join(보기, `${id}-cut.webp`)),
 눈: 붙임(`img/${id}-blink.png`, path.join(보기, `${id}-blink.png`)),
 입: 붙임(`img/${id}-talk.png`, path.join(보기, `${id}-talk.png`)),
 눈자리: 조각[id]['눈%'],
 입자리: 조각[id]['입%'],
});

// 실사: 스틸 + 눈 · 입 조각(10-30 Fable 검수 #3 — 두 화면이 같은 방식으로 깜빡이고 말하게)
const 실사 = (id) => ({
 사진: 붙임(`img/${id}.jpg`, path.join(보기, `${id}.jpg`)),
 눈: 붙임(`img/${id}-blink.png`, path.join(보기, `${id}-blink.png`)),
 입: 붙임(`img/${id}-talk.png`, path.join(보기, `${id}-talk.png`)),
 눈자리: 조각[id]['눈%'],
 입자리: 조각[id]['입%'],
});
const 쓸것 = {
 장면: [
  { id: 'office', 이름: '연구실 · 문 교수', 누가: '문 교수', 대사: 줄찾기('professor', 2), 라이브: { game: 라이브('live-prof-g', 'live-bg-office'), webtoon: 라이브('live-prof', 'live-bg-office') }, 실사: 실사('real-prof') },
  { id: 'cafeteria', 이름: '식당 · 태오 선배', 누가: '태오 선배', 대사: 줄찾기('senior', 2), 라이브: { game: 라이브('live-senior-g', 'live-bg-cafeteria'), webtoon: 라이브('live-senior', 'live-bg-cafeteria') }, 앞층: 63.4, 실사: 실사('real-senior') },
 ],
 글,
};
const 자료 = JSON.stringify(쓸것).replace(/</g, '\\u003c');

const html = `<title>1화 라이브 · 실사 비교</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@700;800&family=Noto+Sans+KR:wght@400;500;700&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
/* 배치: 촬영장 모니터 두 대 — 같은 장면 · 같은 대사를 왼쪽 2D 라이브, 오른쪽 실사로 나란히, 아래에 고르기 */
:root{
 --paper:#f6f6f3; --ink:#1d2126; --muted:#5b636d; --rule:#dcddd7; --card:#ffffff; --stage:#0f1114;
 --accent:#2b56d9; --accent-soft:#e7edff; --pick:#0b7a55; --pick-soft:#dff3ea; --rec:#d23b2f; --warn:#9a5b00;
 --f-display:"Nanum Myeongjo","Noto Serif KR",serif; --f-body:"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif; --f-mono:"IBM Plex Mono",ui-monospace,Consolas,monospace;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
 --paper:#131416; --ink:#e8e6e1; --muted:#a3a9b0; --rule:#2d3034; --card:#1b1d20; --stage:#000000;
 --accent:#8ea9ff; --accent-soft:#1f2740; --pick:#46c79a; --pick-soft:#12302a; --rec:#ff6f61; --warn:#e3a54a; color-scheme:dark}}
:root[data-theme="dark"]{
 --paper:#131416; --ink:#e8e6e1; --muted:#a3a9b0; --rule:#2d3034; --card:#1b1d20; --stage:#000000;
 --accent:#8ea9ff; --accent-soft:#1f2740; --pick:#46c79a; --pick-soft:#12302a; --rec:#ff6f61; --warn:#e3a54a; color-scheme:dark}
*{box-sizing:border-box}
body{background:var(--paper);color:var(--ink);font-family:var(--f-body);font-size:16px;line-height:1.65;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:28px 72px}
.wrap{max-width:980px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr);gap:40px}
.wrap > *{min-width:0}
.slate{font-family:var(--f-mono);font-size:12px;letter-spacing:.08em;color:var(--muted);text-transform:uppercase}
h1,h2,h3{font-family:var(--f-display);text-wrap:balance;margin:0;line-height:1.3}
h1{font-size:clamp(28px,5vw,40px)}
h2{font-size:24px}
h3{font-size:18px}
p{margin:0}
.lead{color:var(--muted);max-width:66ch}
header{display:grid;gap:10px}
.controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
button{font:inherit;font-size:14px;border-radius:8px;padding:8px 14px;cursor:pointer;border:1px solid var(--rule);background:var(--card);color:var(--ink)}
button:focus-visible,textarea:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
button.tab[aria-selected="true"]{background:var(--ink);color:var(--paper);border-color:var(--ink)}
button.play{border-color:var(--rec);color:var(--rec)}
.looks{display:flex;gap:4px}
.looks button{font-size:12px;padding:3px 9px;border-radius:999px}
.looks button[aria-pressed="true"]{background:var(--ink);color:var(--paper);border-color:var(--ink)}
button.play[aria-pressed="true"]{background:var(--rec);color:#fff}
.monitors{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;justify-items:center}
@media (max-width:640px){.monitors{grid-template-columns:minmax(0,1fr)}}
.monitor{display:grid;gap:8px;width:100%;max-width:380px}
.mon-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.mon-head .name{font-family:var(--f-display);font-size:20px;font-weight:800}
.stage{position:relative;width:100%;aspect-ratio:9/16;max-width:100%;overflow:hidden;border-radius:22px;background:var(--stage);box-shadow:0 0 0 1px var(--rule)}
.stage img{display:block;user-select:none;-webkit-user-drag:none}
.stage .bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.photo{position:absolute;inset:0;animation:kb 16s ease-in-out infinite alternate;transform-origin:50% 40%}
.photo img.still{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.stage .fg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none}
@keyframes kb{from{transform:scale(1)}to{transform:scale(1.06) translateY(-1%)}}
.char{position:absolute;inset:0;transform-origin:50% 100%;animation:breathe 3.8s ease-in-out infinite alternate}
.sway{position:absolute;inset:0;transform-origin:50% 100%;animation:sway 7.4s ease-in-out infinite alternate}
@keyframes breathe{from{transform:translateY(0) scale(1)}to{transform:translateY(-0.45%) scale(1.005)}}
@keyframes sway{from{transform:rotate(-0.28deg)}to{transform:rotate(0.28deg)}}
.char .body{position:absolute;inset:0;width:100%;height:100%}
.patch{position:absolute;visibility:hidden}
.patch.on{visibility:visible}
.dialog{position:absolute;left:4%;right:4%;bottom:3.5%;background:rgba(255,255,255,.93);color:#16181b;border-radius:14px;padding:22px 14px 12px;display:grid;gap:4px;box-shadow:0 6px 18px rgba(0,0,0,.25)}
.dialog .who{position:absolute;top:-13px;left:12px;background:#16181b;color:#fff;font-size:12px;font-weight:700;border-radius:999px;padding:3px 10px}
.dialog .line{font-family:var(--f-display);font-size:15px;line-height:1.5}
.dialog .gloss{font-size:11.5px;color:#4a5058;line-height:1.4}
.cap{font-size:13px;color:var(--muted)}
.notes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
@media (max-width:640px){.notes{grid-template-columns:minmax(0,1fr)}}
.opt{background:var(--card);border:1px solid var(--rule);border-radius:10px;padding:14px;display:grid;gap:8px;align-content:start;min-width:0}
.opt.chosen{border-color:var(--pick);box-shadow:0 0 0 2px var(--pick-soft)}
.opt .lines{display:grid;gap:4px;font-size:14px}
.good::before{content:"＋ ";color:var(--pick)}
.worry::before{content:"− ";color:var(--warn)}
button.pick{border-color:var(--pick);color:var(--pick)}
.opt.chosen button.pick{background:var(--pick);color:var(--paper)}
.others{display:flex;flex-wrap:wrap;gap:8px}
.others button.chosen{background:var(--pick);color:var(--paper);border-color:var(--pick)}
.foot{display:grid;gap:8px}
.status{font-size:14px;color:var(--muted)}
.status.ok{color:var(--pick)}
label{font-size:14px;color:var(--muted)}
textarea{width:100%;font:inherit;font-size:14px;border:1px solid var(--rule);border-radius:8px;padding:8px 10px;background:var(--card);color:var(--ink);min-height:44px;resize:vertical}
ul.plain{margin:0;padding-left:20px;display:grid;gap:6px;overflow-wrap:anywhere}
a{color:var(--accent)}
@media (prefers-reduced-motion:reduce){.photo,.char,.sway{animation:none}}
</style>

<div class="wrap">
 <header>
  <p class="slate">드라마 말하기 · S1 EP01 · 2D 라이브 · 실사 비교</p>
  <h1>1화 라이브 · 실사 비교</h1>
  <p class="lead" id="lead"></p>
 </header>
 <section aria-labelledby="h-see" style="display:grid;gap:16px">
  <h2 id="h-see" class="slate" style="font-family:var(--f-mono);font-size:12px;font-weight:500">같은 장면 · 같은 대사</h2>
  <div class="controls" role="tablist" aria-label="장면" id="tabs"></div>
  <div class="controls"><button type="button" class="play" id="play" aria-pressed="false">대사 듣기</button><span class="cap" id="playcap"></span></div>
  <div class="monitors">
   <div class="monitor"><div class="mon-head"><span class="name">2D 라이브</span><span class="looks" id="looks" role="group" aria-label="2D 라이브 그림 결"></span></div><div class="stage" id="stage-live"></div><span class="cap">숨 · 눈 깜빡임 · 말할 때 입. 그림 결은 위 단추로 바꿔 봅니다.</span></div>
   <div class="monitor"><div class="mon-head"><span class="name">실사 느낌</span><span class="cap">GPT 2.5 Sunburst · 숨 대신 천천히 다가감</span></div><div class="stage" id="stage-photo"></div></div>
  </div>
 </section>
 <section aria-labelledby="h-pick" style="display:grid;gap:16px">
  <div style="display:grid;gap:6px"><p class="slate">고르기</p><h2 id="h-pick">어느 쪽으로 갈까요</h2></div>
  <div class="notes" id="notes"></div>
  <div class="others" id="others"></div>
  <div class="foot">
   <label for="note-direction">한 줄(골라도 되고 비워도 됩니다)</label>
   <textarea id="note-direction" rows="2"></textarea>
   <p class="status" id="status" role="status">아직 고르지 않았습니다.</p>
  </div>
 </section>
 <section aria-labelledby="h-how" style="display:grid;gap:10px">
  <div style="display:grid;gap:6px"><p class="slate">기록</p><h2 id="h-how">만든 방법과 검수</h2></div>
  <ul class="plain" id="how"></ul>
 </section>
</div>

<script>
const D = ${자료};
const $ = (s) => document.querySelector(s);
const make = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
$('#lead').textContent = D.글.머리;

// 무대 만들기
const live = {}, photo = {};
function dialog(sc) {
 const d = make('div', 'dialog'); d.append(make('span', 'who', sc.누가), make('span', 'line', sc.대사.말), make('span', 'gloss', sc.대사.뜻));
 return d;
}
function pos(el, p) { el.style.left = p[0] + '%'; el.style.top = p[1] + '%'; el.style.width = p[2] + '%'; el.style.height = p[3] + '%'; }
const LOOKS = [['game', '게임 쪽'], ['webtoon', '웹툰 쪽']];
let look = 'game';
for (const sc of D.장면) {
 live[sc.id] = {};
 for (const [lk] of LOOKS) {
  const v = sc.라이브[lk];
  const L = make('div'); L.hidden = true; L.style.position = 'absolute'; L.style.inset = '0';
  const bg = make('img', 'bg'); bg.src = v.bg; bg.alt = sc.이름 + ' 배경';
  const ch = make('div', 'char'); const sw = make('div', 'sway');
  const body = make('img', 'body'); body.src = v.몸; body.alt = sc.누가 + ' — 2D 라이브 입신(' + lk + ')';
  const eye = make('img', 'patch'); eye.src = v.눈; eye.alt = ''; pos(eye, v.눈자리);
  const mouth = make('img', 'patch'); mouth.src = v.입; mouth.alt = ''; pos(mouth, v.입자리);
  sw.append(body, eye, mouth); ch.append(sw); L.append(bg, ch);
  if (sc.앞층) { const fg = make('img', 'fg'); fg.src = v.bg; fg.alt = ''; fg.style.clipPath = 'inset(' + sc.앞층 + '% 0 0 0)'; L.append(fg); }
  L.append(dialog(sc));
  $('#stage-live').append(L); live[sc.id][lk] = { box: L, eye, mouth };
 }
 const P = make('div'); P.hidden = true; P.style.position = 'absolute'; P.style.inset = '0';
 const ph = make('div', 'photo');
 const still = make('img', 'still'); still.src = sc.실사.사진; still.alt = sc.누가 + ' — 실사 느낌 스틸';
 const peye = make('img', 'patch'); peye.src = sc.실사.눈; peye.alt = ''; pos(peye, sc.실사.눈자리);
 const pmouth = make('img', 'patch'); pmouth.src = sc.실사.입; pmouth.alt = ''; pos(pmouth, sc.실사.입자리);
 ph.append(still, peye, pmouth); P.append(ph, dialog(sc)); $('#stage-photo').append(P); photo[sc.id] = { box: P, eye: peye, mouth: pmouth };
}

// 그림 결 단추
for (const [lk, nm] of LOOKS) {
 const b = make('button', null, nm); b.type = 'button'; b.id = 'look-' + lk; b.setAttribute('aria-pressed', String(lk === look));
 b.addEventListener('click', () => { look = lk; for (const [k] of LOOKS) $('#look-' + k).setAttribute('aria-pressed', String(k === look)); show(cur); });
 $('#looks').append(b);
}
// 장면 탭
let cur = D.장면[0].id;
for (const sc of D.장면) {
 const b = make('button', 'tab', sc.이름); b.type = 'button'; b.setAttribute('role', 'tab'); b.id = 'tab-' + sc.id;
 b.addEventListener('click', () => show(sc.id)); $('#tabs').append(b);
}
function show(id) {
 stop(); cur = id;
 for (const sc of D.장면) {
  for (const [lk] of LOOKS) live[sc.id][lk].box.hidden = !(sc.id === id && lk === look);
  photo[sc.id].box.hidden = sc.id !== id;
  $('#tab-' + sc.id).setAttribute('aria-selected', String(sc.id === id));
 }
 const sc = D.장면.find((s) => s.id === id); $('#playcap').textContent = sc.누가 + ' · ' + sc.대사.초.toFixed(1) + '초';
}

// 눈 깜빡임 — 보이는 장면의 2D 라이브만
function blinkOnce(eye) {
 eye.classList.add('on');
 setTimeout(() => { eye.classList.remove('on'); if (Math.random() < 0.2) setTimeout(() => { eye.classList.add('on'); setTimeout(() => eye.classList.remove('on'), 110); }, 170); }, 120);
}
function blinkLive() { blinkOnce(live[cur][look].eye); setTimeout(blinkLive, 2400 + Math.random() * 3200); }
function blinkPhoto() { blinkOnce(photo[cur].eye); setTimeout(blinkPhoto, 2600 + Math.random() * 3400); }
setTimeout(blinkLive, 1500); setTimeout(blinkPhoto, 2300);

// 대사 — 소리 크기로 입 조각을 켰다 끈다(분석이 안 되면 박자로)
const audios = {}; let playing = null; let raf = 0;
function audioFor(id) { if (!audios[id]) { const sc = D.장면.find((s) => s.id === id); const a = new Audio(sc.대사.소리); a.preload = 'auto'; a.addEventListener('ended', stop); audios[id] = a; } return audios[id]; }
function stop() {
 if (playing) { playing.pause(); playing.currentTime = 0; }
 playing = null; cancelAnimationFrame(raf); for (const k in live) { for (const [lk] of LOOKS) live[k][lk].mouth.classList.remove('on'); photo[k].mouth.classList.remove('on'); }
 $('#play').setAttribute('aria-pressed', 'false'); $('#play').textContent = '대사 듣기';
}
$('#play').addEventListener('click', async () => {
 if (playing) { stop(); return; }
 const a = audioFor(cur); const sc = D.장면.find((s) => s.id === cur); const env = sc.대사.봉투, step = sc.대사.간격;
 a.currentTime = 0; try { await a.play(); } catch (e) { return; }
 playing = a; $('#play').setAttribute('aria-pressed', 'true'); $('#play').textContent = '멈춤';
 let open = false, last = 0, beat = 0;
 const tick = (t) => {
  if (!playing) return;
  const mouth = live[cur][look].mouth;
  for (const [lk] of LOOKS) if (lk !== look) live[cur][lk].mouth.classList.remove('on');
  if (env && env.length) { const v = env[Math.min(env.length - 1, Math.floor(a.currentTime / step))] || 0; if (!open && v > 0.32 && t - last > 70) { open = true; last = t; } else if (open && v < 0.2 && t - last > 60) { open = false; last = t; } }
  else if (t - beat > 120 + Math.random() * 60) { open = !open; beat = t; }
  mouth.classList.toggle('on', open); photo[cur].mouth.classList.toggle('on', open); raf = requestAnimationFrame(tick);
 };
 raf = requestAnimationFrame(tick);
});
show(cur);

// 고르기 — 누르는 즉시 페이지 저장소에
const names = {}; const cards = [];
function card(o, box) {
 names[o.값] = o.이름;
 const c = make('div', 'opt'); c.append(make('h3', null, o.이름));
 const ls = make('div', 'lines'); for (const s of o.좋음 || []) ls.append(make('span', 'good', s)); for (const s of o.걱정 || []) ls.append(make('span', 'worry', s)); c.append(ls);
 const b = make('button', 'pick', '이쪽으로'); b.type = 'button'; b.id = 'pick-' + o.값; b.addEventListener('click', () => choose(o.값)); c.append(b);
 cards.push({ v: o.값, el: c, b, label: '이쪽으로' }); box.append(c);
}
for (const o of D.글.고르기) card(o, $('#notes'));
for (const o of D.글.다른길) {
 names[o.값] = o.이름; const b = make('button', null, o.이름); b.type = 'button'; b.id = 'pick-' + o.값; b.title = o.설명 || '';
 b.addEventListener('click', () => choose(o.값)); cards.push({ v: o.값, el: b, b, label: o.이름 }); $('#others').append(b);
}
for (const s of D.글.방법) $('#how').append(make('li', null, s));
let value = null, db = null, canWrite = true, writing = false, again = false;
function paint() { for (const x of cards) { const on = x.v === value; x.el.classList.toggle('chosen', on); if (x.el.classList.contains('opt')) x.b.textContent = on ? '고름' : x.label; } }
async function save() {
 if (writing) { again = true; return; }
 writing = true;
 try { do { again = false; await db.doc('picks/direction').set({ 값: value, 이름: names[value] || '', 한줄: $('#note-direction').value.trim().slice(0, 500), 때: new Date().toISOString() }); } while (again);
  $('#status').className = 'status ok'; $('#status').textContent = '「' + names[value] + '」(으)로 저장했습니다.';
 } catch (e) { $('#status').className = 'status'; $('#status').textContent = '저장하지 못했습니다(' + (e && e.code || '오류') + '). 채팅에 「' + names[value] + '」라고 알려 주세요.'; }
 finally { writing = false; }
}
function choose(v) {
 value = v; paint();
 if (!db || !canWrite) { $('#status').className = 'status'; $('#status').textContent = '「' + names[v] + '」를 골랐습니다. 이 화면에서는 저장이 안 되니 채팅에 알려 주세요.'; return; }
 $('#status').className = 'status'; $('#status').textContent = '저장하는 중…'; save();
}
$('#note-direction').addEventListener('change', () => { if (value != null && db && canWrite) save(); });
(async () => {
 try { db = await window.claude?.use?.('db'); const u = await window.claude?.use?.('user'); if (u && typeof u.can === 'function') { const w = await u.can('data.write'); if (w === false) canWrite = false; } } catch (e) { db = null; }
 if (!db) return;
 db.doc('picks/direction').onSnapshot((snap) => {
  if (!snap.exists) return; const v = snap.data();
  if (v.값 != null && !writing) { value = v.값; paint(); $('#status').className = 'status ok'; $('#status').textContent = '「' + (names[v.값] || v.값) + '」(으)로 저장되어 있습니다.'; }
  if (v.한줄 && !$('#note-direction').value) $('#note-direction').value = v.한줄;
 }, () => {});
})();
</script>
`;
fs.writeFileSync(path.join(작업, '비교판.html'), html);
fs.writeFileSync(path.join(작업, '비교판_파일.json'), JSON.stringify(파일, null, 1));
const 바이트 = Object.values(파일).reduce((s, p) => s + fs.statSync(p).size, 0);
console.log(`비교판.html ${(Buffer.byteLength(html) / 1024).toFixed(0)}KB · 파일 ${Object.keys(파일).length}개 ${(바이트 / 1e6).toFixed(1)}MB`);
