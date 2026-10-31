#!/usr/bin/env node
/**
 * 1화 태오 선배 한 테이크 실사 영상 시험 페이지 만들기(2026-10-31) — 유호님 「한 테이크로 구워」(Fable 추천): 학생 줄 → 선배 2번 → 웃으며 기다리는 끝까지
 * Seedance 2.5 한 컷. 앞 판(태오판만들기.mjs)의 두 컷 이어 붙이기는 컷마다 뒤 학생 · 눈웃음이 처음 자리로 돌아갔다.
 * 비디오 하나를 재생 위치(학생 · 선배 구간, 한테이크결과.json)에 맞춰 대사 상자를 바꾸고, 「내가 말해 보기」는 학생 구간만 소리를 끈다.
 * 목소리는 「영상이 낸 목소리」와 「원래 녹음(Hana · Julian)」을 바꿔 들을 수 있고, 고른 것은 db picks/voice에 누르는 즉시 남는다.
 * 구도 · 깜빡임을 고정한 판(10-31 유호님 「다음 판 구워」)부터는 나란히 재생하는 칸을 더했다(고친 일은 전후를 보게 보고).
 * 나노바나나 판(10-31 유호님 「같은 태오 2.1이랑 글로만 벚꽃 2.1 둘 다 테스트해보자」)부터는 판을 바꿔 보고 셋을 나란히 재생하며, 고른 판은 db picks/look에 남는다.
 * 같은 claude.ai 주소(태오판.html)로 다시 올린다.
 *
 *   node 태오한테이크판만들기.mjs <작업>     <작업>/영상/한테이크4결과.json → <작업>/태오판.html · <작업>/태오판_파일.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ep01 from '../../s1/ep01.mjs';
import 글 from './태오한테이크판_글.mjs';

const 작업 = process.argv[2];
if (!작업) { console.error('쓰는 법: node 태오한테이크판만들기.mjs <작업 폴더>'); process.exit(2); }
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 소리폴더 = path.resolve(여기, '../../s1/소리');
const 결과 = JSON.parse(fs.readFileSync(path.join(작업, '영상', '한테이크4결과.json'), 'utf8'));

const 파일 = {};
const 붙임 = (이름, 원본) => {
 if (!fs.existsSync(원본)) throw new Error(`파일이 없다: ${원본}`);
 파일[이름] = path.resolve(원본).replace(/\\/g, '/');
 return 이름;
};
// 포스터는 영상의 첫 프레임 — 시작 그림을 줄여 쓰면 재생하는 순간 얼굴 · 뒤 사람이 바뀐다(10-30 Fable).
const 포스터 = (영상, 이름) => {
 const 나갈 = path.join(작업, '보기', `${이름}-poster.jpg`);
 const r = spawnSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-i', 영상, '-frames:v', '1', '-q:v', '2', 나갈]);
 if (r.status !== 0) throw new Error(`포스터 실패: ${이름} ${r.stderr}`);
 return 붙임(`img/${이름}-poster.jpg`, 나갈);
};
const 줄 = (역, 번호) => {
 const l = JSON.parse(fs.readFileSync(path.join(소리폴더, `ep01-${역}.json`), 'utf8')).줄.find((x) => x.번호 === 번호);
 const 대본줄 = ep01.촬영일.flatMap((d) => d.줄 || []).find((x) => x.말 === l.말);
 return { 말: l.말, 뜻: 대본줄?.뜻 || '' };
};

const 쓸것 = {
 판: 결과.판.map((p) => ({
  값: p.값, 이름: p.이름, 설명: p.설명,
  포스터: 포스터(path.join(작업, p.own), `senior-${p.값}`),
  own: 붙임(`video/senior-${p.값}-own.mp4`, path.join(작업, p.own)),
  original: 붙임(`video/senior-${p.값}-original.mp4`, path.join(작업, p.original)),
  학생구간: p.학생, 선배구간: p.선배,
 })),
 학생: 줄('model', 6), 선배: 줄('senior', 2),
 기록: 결과.기록 || [],
 글,
};
const 자료 = JSON.stringify(쓸것).replace(/</g, '\\u003c');

const html = `<title>태오 선배 영상 시험</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@700;800&family=Noto+Sans+KR:wght@400;500;700&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
/* 배치: 촬영장 모니터 한 대 — 왼쪽 세로 무대(한 테이크), 오른쪽 조작 · 목소리 고르기 */
:root{
 --paper:#f6f6f3; --ink:#1d2126; --muted:#5b636d; --rule:#dcddd7; --card:#ffffff; --stage:#0f1114;
 --accent:#2b56d9; --pick:#0b7a55; --pick-soft:#dff3ea; --rec:#d23b2f; --warn:#9a5b00;
 --f-display:"Nanum Myeongjo","Noto Serif KR",serif; --f-body:"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif; --f-mono:"IBM Plex Mono",ui-monospace,Consolas,monospace;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
 --paper:#131416; --ink:#e8e6e1; --muted:#a3a9b0; --rule:#2d3034; --card:#1b1d20; --stage:#000000;
 --accent:#8ea9ff; --pick:#46c79a; --pick-soft:#12302a; --rec:#ff6f61; --warn:#e3a54a; color-scheme:dark}}
:root[data-theme="dark"]{
 --paper:#131416; --ink:#e8e6e1; --muted:#a3a9b0; --rule:#2d3034; --card:#1b1d20; --stage:#000000;
 --accent:#8ea9ff; --pick:#46c79a; --pick-soft:#12302a; --rec:#ff6f61; --warn:#e3a54a; color-scheme:dark}
*{box-sizing:border-box}
body{background:var(--paper);color:var(--ink);font-family:var(--f-body);font-size:16px;line-height:1.65;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:28px 72px}
.wrap{max-width:980px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr);gap:36px}
.wrap > *{min-width:0}
.slate{font-family:var(--f-mono);font-size:12px;letter-spacing:.08em;color:var(--muted);text-transform:uppercase}
h1,h2,h3{font-family:var(--f-display);text-wrap:balance;margin:0;line-height:1.3}
h1{font-size:clamp(28px,5vw,40px)}
h2{font-size:22px}
p{margin:0}
.lead{color:var(--muted);max-width:66ch}
header{display:grid;gap:10px}
.controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
button{font:inherit;font-size:14px;border-radius:8px;padding:8px 14px;cursor:pointer;border:1px solid var(--rule);background:var(--card);color:var(--ink)}
button:focus-visible,textarea:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
button.play{border-color:var(--rec);color:var(--rec)}
button.play[aria-pressed="true"]{background:var(--rec);color:#fff}
button.voice[aria-pressed="true"],button.look[aria-pressed="true"]{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.theatre{display:grid;grid-template-columns:minmax(0,400px) minmax(0,1fr);gap:24px;align-items:start}
@media (max-width:760px){.theatre{grid-template-columns:minmax(0,1fr)}}
.stage{position:relative;width:100%;aspect-ratio:9/16;overflow:hidden;border-radius:22px;background:var(--stage);box-shadow:0 0 0 1px var(--rule)}
.stage video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.turn{position:absolute;top:14px;left:14px;font-size:12px;font-weight:700;background:rgba(210,59,47,.92);color:#fff;border-radius:999px;padding:3px 10px;visibility:hidden}
.turn.on{visibility:visible}
.bar{position:absolute;left:0;top:0;height:4px;background:#d23b2f;width:0;visibility:hidden}
.bar.on{visibility:visible}
.dialog{position:absolute;left:4%;right:4%;bottom:3.5%;background:rgba(255,255,255,.93);color:#16181b;border-radius:14px;padding:22px 14px 12px;display:grid;gap:4px;box-shadow:0 6px 18px rgba(0,0,0,.25);visibility:hidden}
.dialog.on{visibility:visible}
.dialog .who{position:absolute;top:-13px;left:12px;background:#16181b;color:#fff;font-size:12px;font-weight:700;border-radius:999px;padding:3px 10px}
.dialog.me .who{background:#d23b2f}
.dialog .line{font-family:var(--f-display);font-size:15px;line-height:1.5}
.dialog .gloss{font-size:11.5px;color:#4a5058;line-height:1.4}
.side{display:grid;gap:16px;align-content:start}
.cap{font-size:13px;color:var(--muted)}
.box{background:var(--card);border:1px solid var(--rule);border-radius:10px;padding:14px;display:grid;gap:10px}
.box.chosen{border-color:var(--pick);box-shadow:0 0 0 2px var(--pick-soft)}
.status{font-size:14px;color:var(--muted)}
.status.ok{color:var(--pick)}
label{font-size:14px;color:var(--muted)}
textarea{width:100%;font:inherit;font-size:14px;border:1px solid var(--rule);border-radius:8px;padding:8px 10px;background:var(--card);color:var(--ink);min-height:44px;resize:vertical}
ul.plain{margin:0;padding-left:20px;display:grid;gap:6px;overflow-wrap:anywhere}
.pair{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;max-width:760px}
.pair figure{margin:0;display:grid;gap:6px}
.pair video{width:100%;aspect-ratio:9/16;object-fit:cover;border-radius:14px;background:var(--stage);display:block}
.pair figcaption{font-size:13px;color:var(--muted)}
</style>

<div class="wrap">
 <header>
  <p class="slate">드라마 말하기 · S1 EP01 · 영상 시험 · 실사 · 한 테이크</p>
  <h1>태오 선배 영상 시험</h1>
  <p class="lead" id="lead"></p>
 </header>
 <section aria-labelledby="h-see" style="display:grid;gap:16px">
  <h2 id="h-see" class="slate" style="font-family:var(--f-mono);font-size:12px;font-weight:500">봄 캠퍼스 · 길 잃은 신입생과 태오 선배</h2>
  <div class="theatre">
   <div class="stage" id="stage">
    <video id="v" playsinline preload="auto"></video>
    <span class="bar" id="bar"></span>
    <span class="turn" id="turn">● 내 차례</span>
    <div class="dialog" id="dialog"><span class="who" id="who"></span><span class="line" id="line"></span><span class="gloss" id="gloss"></span></div>
   </div>
   <div class="side">
    <p class="cap" id="before"></p>
    <div class="box" id="lookbox">
     <h3 style="font-size:17px">어느 판이 좋은가요?</h3>
     <div class="controls" role="group" aria-label="판" id="looks"></div>
     <p class="cap" id="lookcap"></p>
     <label for="looknote">한 줄(골라도 되고 비워도 됩니다)</label>
     <textarea id="looknote" rows="2"></textarea>
     <p class="status" id="lookstatus" role="status">판을 고르면 바로 저장됩니다.</p>
    </div>
    <div class="controls"><button type="button" class="play" id="play" aria-pressed="false">장면 보기</button><button type="button" id="try" aria-pressed="false">내가 말해 보기</button></div>
    <p class="cap" id="trycap"></p>
    <div class="box" id="voicebox">
     <h3 style="font-size:17px">목소리</h3>
     <div class="controls" role="group" aria-label="목소리" id="voices"></div>
     <p class="cap" id="voicecap"></p>
     <label for="note">한 줄(골라도 되고 비워도 됩니다)</label>
     <textarea id="note" rows="2"></textarea>
     <p class="status" id="status" role="status">목소리를 고르면 바로 저장됩니다.</p>
    </div>
   </div>
  </div>
 </section>
 <section aria-labelledby="h-cmp" style="display:grid;gap:12px">
  <div style="display:grid;gap:6px"><p class="slate">셋을 나란히</p><h2 id="h-cmp">같은 장면, 세 판</h2></div>
  <p class="cap" id="cmpcap"></p>
  <div class="controls"><button type="button" class="play" id="both" aria-pressed="false">셋 다 재생</button></div>
  <div class="pair" id="pair"></div>
 </section>
 <section aria-labelledby="h-rec" style="display:grid;gap:10px">
  <div style="display:grid;gap:6px"><p class="slate">기록</p><h2 id="h-rec">이번 판에서 잰 것</h2></div>
  <ul class="plain" id="rec"></ul>
  <ul class="plain" id="warn"></ul>
 </section>
</div>

<script>
const D = ${자료};
const $ = (s) => document.querySelector(s);
const make = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
$('#lead').textContent = D.글.머리;
$('#before').textContent = D.글.앞상황;
$('#trycap').textContent = D.글.해보기;
$('#cmpcap').textContent = D.글.나란히;
for (const s of D.기록) $('#rec').append(make('li', null, s));
for (const s of D.글.걸림) $('#warn').append(make('li', null, s));

// ── 무대: 비디오 하나, 재생 위치로 대사 상자 · 내 차례 · 소리 끄기를 바꾼다 ──
const v = $('#v');
let look = D.판[0].값, voice = 'original', mode = null, raf = 0;   // 목소리는 유호님이 고른 원래 녹음부터(10-31 picks/voice)
const cur = () => D.판.find((p) => p.값 === look);
const srcOf = (p) => (voice === 'own' ? p.own : p.original);
function srcFor() { return srcOf(cur()); }
v.poster = cur().포스터;
v.src = srcFor();
function show(who, line, me) {
 const d = $('#dialog');
 if (!line) { d.classList.remove('on'); $('#turn').classList.remove('on'); return; }
 $('#who').textContent = who; $('#line').textContent = line.말; $('#gloss').textContent = line.뜻;
 d.classList.toggle('me', !!me); d.classList.add('on'); $('#turn').classList.toggle('on', !!me);
}
// 대사 상자는 바뀔 때만 다시 쓴다(매 프레임 쓰면 DOM이 1초에 60번 바뀐다 — 10-31 앱 안 브라우저 재생 기록 1,500줄)
let shown = '';
function setState(k) {
 if (k === shown) return;
 shown = k;
 if (k === 'me') show('나', D.학생, true); else if (k === 'senior') show('태오 선배', D.선배, false); else show(null, null);
}
// 화면 갱신(requestAnimationFrame)은 창이 뒤로 가면 멈춘다(10-31 앱 안 브라우저에서 「내가 말해 보기」 소리가 안 켜짐) → 재생 시각 알림(timeupdate)으로도 갱신한다.
function update() {
 const t = v.currentTime, [s0, s1] = cur().학생구간, [t0, t1] = cur().선배구간;
 // 내 차례는 선배가 웃기 시작하기 직전까지 — 말이 끝나고 1초쯤 선배가 웃으며 듣는 사이에 선배 대사가 먼저 뜨지 않게 하고, 말해 보는 사람에게 그만큼 여유를 준다.
 // 내 상자가 닫히는 자리에서 바로 선배 상자를 연다 — 사이를 두면 0.12초 상자가 사라졌다 뜬다(10-31 Fable P3)
 if (t < t0 - 0.1) {
  setState('me');
  v.muted = mode === 'try';
  const on = mode === 'try';
  $('#bar').classList.toggle('on', on); if (on) $('#bar').style.width = Math.min(100, Math.max(0, (t - s0) / (s1 - s0) * 100)) + '%';
 } else {
  v.muted = false; $('#bar').classList.remove('on');
  setState(t < t1 + 0.4 ? 'senior' : 'none');
 }
}
function tick() { if (!mode) return; update(); raf = requestAnimationFrame(tick); }
v.addEventListener('timeupdate', () => { if (mode) update(); });
function stop() {
 mode = null; cancelAnimationFrame(raf); v.pause(); v.muted = false; setState('none'); $('#bar').classList.remove('on');
 $('#play').setAttribute('aria-pressed', 'false'); $('#try').setAttribute('aria-pressed', 'false');
}
function scene(m) {
 stop(); stopBoth(); mode = m;
 $(m === 'auto' ? '#play' : '#try').setAttribute('aria-pressed', 'true');
 if (v.getAttribute('src') !== srcFor()) v.src = srcFor();
 v.currentTime = 0; v.muted = m === 'try';
 v.play().then(() => { raf = requestAnimationFrame(tick); }).catch(() => stop());
}
v.addEventListener('ended', () => { setState('none'); $('#bar').classList.remove('on'); mode = null; cancelAnimationFrame(raf); $('#play').setAttribute('aria-pressed', 'false'); $('#try').setAttribute('aria-pressed', 'false'); });
$('#play').addEventListener('click', () => ($('#play').getAttribute('aria-pressed') === 'true' ? stop() : scene('auto')));
$('#try').addEventListener('click', () => ($('#try').getAttribute('aria-pressed') === 'true' ? stop() : scene('try')));

// ── 셋을 나란히: 고른 판의 소리만 낸다 ──
const trio = D.판.map((p) => {
 const f = make('figure'), w = document.createElement('video');
 w.playsInline = true; w.muted = true; w.preload = 'metadata'; w.poster = p.포스터; w.src = srcOf(p);
 f.append(w, make('figcaption', null, p.이름)); $('#pair').append(f);
 return { p, w };
});
function stopBoth() { for (const { w } of trio) w.pause(); $('#both').setAttribute('aria-pressed', 'false'); }
$('#both').addEventListener('click', () => {
 if ($('#both').getAttribute('aria-pressed') === 'true') { stopBoth(); return; }
 stop(); $('#both').setAttribute('aria-pressed', 'true');
 for (const { p, w } of trio) { w.muted = p.값 !== look; w.currentTime = 0; }
 Promise.all(trio.map(({ w }) => w.play())).catch(stopBoth);
});
trio[0].w.addEventListener('ended', stopBoth);
function resrc() { for (const { p, w } of trio) { if (w.getAttribute('src') !== srcOf(p)) w.src = srcOf(p); } }

// ── 판 고르기: 무대를 그 판으로 바꾸고 db picks/look에 바로 저장 ──
function paintLook() {
 for (const b of document.querySelectorAll('button.look')) b.setAttribute('aria-pressed', String(b.dataset.v === look));
 $('#lookcap').textContent = cur().설명 || '';
}
function setLook(k) { look = k; stop(); stopBoth(); v.poster = cur().포스터; v.src = srcFor(); paintLook(); }
for (const p of D.판) {
 const b = make('button', 'look', p.이름); b.type = 'button'; b.dataset.v = p.값;
 b.addEventListener('click', () => { setLook(p.값); chooseLook(p.값); }); $('#looks').append(b);
}
paintLook();

// ── 목소리: 바꿔 듣기 + 고른 것은 db picks/voice에 바로 저장 ──
const names = {};
function paintVoice() {
 for (const b of document.querySelectorAll('button.voice')) b.setAttribute('aria-pressed', String(b.dataset.v === voice));
 const o = D.글.목소리.find((x) => x.값 === voice); $('#voicecap').textContent = o ? o.설명 : '';
}
for (const o of D.글.목소리) {
 names[o.값] = o.이름; const b = make('button', 'voice', o.이름); b.type = 'button'; b.dataset.v = o.값;
 b.addEventListener('click', () => { voice = o.값; paintVoice(); stop(); stopBoth(); v.src = srcFor(); resrc(); choose(o.값); }); $('#voices').append(b);
}
paintVoice();
let db = null, canWrite = true, writing = false, again = false, chosen = null;
async function save() {
 if (writing) { again = true; return; }
 writing = true;
 try { do { again = false; await db.doc('picks/voice').set({ 값: chosen, 이름: names[chosen] || '', 한줄: $('#note').value.trim().slice(0, 500), 때: new Date().toISOString() }); } while (again);
  $('#status').className = 'status ok'; $('#status').textContent = '「' + names[chosen] + '」(으)로 저장했습니다.'; $('#voicebox').classList.add('chosen');
 } catch (e) { $('#status').className = 'status'; $('#status').textContent = '저장하지 못했습니다(' + (e && e.code || '오류') + '). 고르신 목소리를 채팅에 알려 주세요.'; }
 finally { writing = false; }
}
function choose(c) {
 chosen = c;
 if (!db || !canWrite) { $('#status').className = 'status'; $('#status').textContent = '「' + names[c] + '」(으)로 바꿔 들려 드립니다. 이 화면에서는 저장이 안 되니 고르시면 채팅에 알려 주세요.'; return; }
 $('#status').className = 'status'; $('#status').textContent = '저장하는 중…'; save();
}
$('#note').addEventListener('change', () => { if (chosen != null && db && canWrite) save(); });
let lookChosen = null, lookWriting = false, lookAgain = false;
async function saveLook() {
 if (lookWriting) { lookAgain = true; return; }
 lookWriting = true;
 const name = () => (D.판.find((p) => p.값 === lookChosen) || {}).이름 || '';
 try { do { lookAgain = false; await db.doc('picks/look').set({ 값: lookChosen, 이름: name(), 한줄: $('#looknote').value.trim().slice(0, 500), 때: new Date().toISOString() }); } while (lookAgain);
  $('#lookstatus').className = 'status ok'; $('#lookstatus').textContent = '「' + name() + '」(으)로 저장했습니다.'; $('#lookbox').classList.add('chosen');
 } catch (e) { $('#lookstatus').className = 'status'; $('#lookstatus').textContent = '저장하지 못했습니다(' + (e && e.code || '오류') + '). 고르신 판을 채팅에 알려 주세요.'; }
 finally { lookWriting = false; }
}
function chooseLook(k) {
 lookChosen = k;
  if (!db || !canWrite) { $('#lookstatus').className = 'status'; $('#lookstatus').textContent = '이 화면에서는 저장이 안 됩니다. 고르신 판을 채팅에 알려 주세요.'; return; }
 $('#lookstatus').className = 'status'; $('#lookstatus').textContent = '저장하는 중…'; saveLook();
}
$('#looknote').addEventListener('change', () => { if (lookChosen != null && db && canWrite) saveLook(); });
(async () => {
 try { db = await window.claude?.use?.('db'); const u = await window.claude?.use?.('user'); if (u && typeof u.can === 'function') { const w = await u.can('data.write'); if (w === false) canWrite = false; } } catch (e) { db = null; }
 if (!db) return;
 db.doc('picks/look').onSnapshot((snap) => {
  if (!snap.exists) return; const d = snap.data();
  if (d.값 && D.판.some((p) => p.값 === d.값) && !lookWriting) { lookChosen = d.값; if (d.값 !== look && !mode) setLook(d.값); $('#lookbox').classList.add('chosen'); $('#lookstatus').className = 'status ok'; $('#lookstatus').textContent = '「' + d.이름 + '」(으)로 저장되어 있습니다.'; }
  if (d.한줄 && !$('#looknote').value) $('#looknote').value = d.한줄;
 }, () => {});
 db.doc('picks/voice').onSnapshot((snap) => {
  if (!snap.exists) return; const d = snap.data();
  if (d.값 && names[d.값] && !writing) { chosen = d.값; voice = d.값; paintVoice(); if (!mode) { v.src = srcFor(); resrc(); } $('#voicebox').classList.add('chosen'); $('#status').className = 'status ok'; $('#status').textContent = '「' + names[d.값] + '」(으)로 저장되어 있습니다.'; }
  if (d.한줄 && !$('#note').value) $('#note').value = d.한줄;
 }, () => {});
})();
</script>
`;

fs.writeFileSync(path.join(작업, '태오판.html'), html);
fs.writeFileSync(path.join(작업, '태오판_파일.json'), JSON.stringify(파일, null, 1));
console.log(`태오판.html(한 테이크) · 파일 ${Object.keys(파일).length}개`);
