#!/usr/bin/env node
/**
 * 1화 「살아 있는 상대역」 영상 시험 페이지 만들기(2026-10-30) — 영상시험.mjs의 시작 그림으로 구운 Seedance 클립(입맞춤.py로 원본 녹음을 얹은 것)을
 * 한 무대에서 끊김 없이 이어 붙여 보이는 claude.ai 페이지 한 장을 만든다. 결(실사 · 3D 애니메이션 · 게임 쪽)을 바꿔 가며 같은 대화를 보고,
 * 아래 「셋 나란히」에서 같은 대사를 세 결이 동시에 말한다. 고른 결은 페이지 저장소(db) picks/look에 누르는 즉시 남는다.
 *
 *   node 살아있는판만들기.mjs <작업>     <작업>/영상/결과.json을 읽어 → <작업>/살아있는판.html · <작업>/살아있는판_파일.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ep01 from '../../s1/ep01.mjs';
import 글 from './살아있는판_글.mjs';

const 작업 = process.argv[2];
if (!작업) { console.error('쓰는 법: node 살아있는판만들기.mjs <작업 폴더>'); process.exit(2); }
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 소리폴더 = path.resolve(여기, '../../s1/소리');
const 결과 = JSON.parse(fs.readFileSync(path.join(작업, '영상', '결과.json'), 'utf8'));

const 파일 = {};
const 붙임 = (이름, 원본) => {
 if (!fs.existsSync(원본)) throw new Error(`파일이 없다: ${원본}`);
 파일[이름] = path.resolve(원본).replace(/\\/g, '/');
 return 이름;
};
const 포스터 = (id) => {
 const 나갈 = path.join(작업, '보기', `${id}-poster.jpg`);
 if (!fs.existsSync(나갈)) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(작업, '받음', `${id}.png`), '-vf', 'scale=576:-2', '-q:v', '3', 나갈]);
  if (r.status !== 0) throw new Error(`포스터 실패: ${id} ${r.stderr}`);
 }
 return 붙임(`img/${id}-poster.jpg`, 나갈);
};
const 줄찾기 = (역, 번호) => {
 const 줄 = JSON.parse(fs.readFileSync(path.join(소리폴더, `ep01-${역}.json`), 'utf8')).줄.find((l) => l.번호 === 번호);
 const 대본줄 = ep01.촬영일.flatMap((d) => d.줄 || []).find((l) => l.말 === 줄.말);
 return { 말: 줄.말, 뜻: 대본줄?.뜻 || '', 소리: 붙임(`audio/${줄.파일}`, path.join(소리폴더, 줄.파일)), 초: 줄.초 };
};

const 결이름 = Object.fromEntries(글.결.map((g) => [g.값, g.이름]));
const 결 = {};
for (const 값 of ['real', '3d', 'game']) {
 const r = 결과[값];
 if (!r) throw new Error(`결과.json에 ${값}가 없다`);
 결[값] = { 이름: 결이름[값], 포스터: 포스터(`vid-${값}`) };
 for (const 클립 of ['talk5', 'talk6', 'listen']) {
  const c = r[클립];
  if (!c) throw new Error(`결과.json에 ${값}/${클립}가 없다`);
  결[값][클립] = { src: 붙임(`video/${값}-${클립}.mp4`, path.join(작업, c.파일)), 말시작: c.어긋남초 ?? null, 초: c.영상초 };
 }
}
const 쓸것 = {
 결, 순서: ['real', '3d', 'game'],
 교수: { talk5: 줄찾기('professor', 5), talk6: 줄찾기('professor', 6) },
 학생: { q: 줄찾기('model', 4), ok: 줄찾기('model', 5) },
 글,
};
const 자료 = JSON.stringify(쓸것).replace(/</g, '\\u003c');

const html = `<title>1화 살아 있는 상대역</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@700;800&family=Noto+Sans+KR:wght@400;500;700&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
/* 배치: 촬영장 모니터 한 대 — 결을 바꿔 가며 같은 대화를 크게 보고, 아래에서 세 결이 같은 대사를 동시에 말한다 */
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
button[aria-pressed="true"].look{background:var(--ink);color:var(--paper);border-color:var(--ink)}
button.play{border-color:var(--rec);color:var(--rec)}
button.play[aria-pressed="true"]{background:var(--rec);color:#fff}
button.said{border-color:var(--pick);color:var(--pick)}
button[disabled]{opacity:.45;cursor:default}
.theatre{display:grid;grid-template-columns:minmax(0,420px) minmax(0,1fr);gap:24px;align-items:start}
@media (max-width:760px){.theatre{grid-template-columns:minmax(0,1fr)}}
.stage{position:relative;width:100%;aspect-ratio:9/16;overflow:hidden;border-radius:22px;background:var(--stage);box-shadow:0 0 0 1px var(--rule)}
.stage video,.stage img.poster{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.stage video{opacity:0;transition:opacity 90ms linear}
.stage video.on{opacity:1}
.turn{position:absolute;top:14px;left:14px;font-size:12px;font-weight:700;background:rgba(210,59,47,.92);color:#fff;border-radius:999px;padding:3px 10px;visibility:hidden}
.turn.on{visibility:visible}
.dialog{position:absolute;left:4%;right:4%;bottom:3.5%;background:rgba(255,255,255,.93);color:#16181b;border-radius:14px;padding:22px 14px 12px;display:grid;gap:4px;box-shadow:0 6px 18px rgba(0,0,0,.25);visibility:hidden}
.dialog.on{visibility:visible}
.dialog .who{position:absolute;top:-13px;left:12px;background:#16181b;color:#fff;font-size:12px;font-weight:700;border-radius:999px;padding:3px 10px}
.dialog.me .who{background:#d23b2f}
.dialog .line{font-family:var(--f-display);font-size:15px;line-height:1.5}
.dialog .gloss{font-size:11.5px;color:#4a5058;line-height:1.4}
.side{display:grid;gap:14px;align-content:start}
.cap{font-size:13px;color:var(--muted)}
.trio{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.trio figure{margin:0;display:grid;gap:6px;min-width:0}
.trio .stage{border-radius:14px}
.trio figcaption{font-size:13px;text-align:center}
.notes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
@media (max-width:760px){.notes{grid-template-columns:minmax(0,1fr)}}
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
@media (prefers-reduced-motion:reduce){.stage video{transition:none}}
</style>

<div class="wrap">
 <header>
  <p class="slate">드라마 말하기 · S1 EP01 · 영상 시험</p>
  <h1>1화 살아 있는 상대역</h1>
  <p class="lead" id="lead"></p>
 </header>
 <section aria-labelledby="h-see" style="display:grid;gap:16px">
  <h2 id="h-see" class="slate" style="font-family:var(--f-mono);font-size:12px;font-weight:500">연구실 · 문 교수 · 과제 기한을 여쭙는 장면</h2>
  <div class="controls" role="group" aria-label="결" id="looks"></div>
  <div class="theatre">
   <div class="stage" id="stage">
    <img class="poster" id="poster" alt="">
    <video id="vA" playsinline preload="auto"></video>
    <video id="vB" playsinline preload="auto"></video>
    <span class="turn" id="turn">● 내 차례</span>
    <div class="dialog" id="dialog"><span class="who" id="who"></span><span class="line" id="line"></span><span class="gloss" id="gloss"></span></div>
   </div>
   <div class="side">
    <div class="controls"><button type="button" class="play" id="play" aria-pressed="false">장면 보기</button><button type="button" id="try" aria-pressed="false">내가 말해 보기</button></div>
    <div class="controls"><button type="button" class="said" id="said" disabled>말했어요</button><span class="cap" id="hint">「내가 말해 보기」에서는 학생 줄을 직접 말한 뒤 누르세요.</span></div>
    <p class="cap" id="playcap">대화: 학생이 과제 기한을 묻고 → 교수가 단호하게 답하고 → 학생이 인사하면 → 교수가 따뜻하게 받습니다.</p>
   </div>
  </div>
 </section>
 <section aria-labelledby="h-trio" style="display:grid;gap:14px">
  <div style="display:grid;gap:6px"><p class="slate">셋 나란히</p><h2 id="h-trio">같은 대사, 세 결</h2></div>
  <div class="controls"><button type="button" class="play" id="trioPlay" aria-pressed="false">셋 같이 듣기</button><span class="cap">「다음 주 금요일 오후 여섯 시까지예요. 늦게 내면 안 돼요.」 — 말이 시작하는 자리에 맞춰 셋을 같이 틉니다.</span></div>
  <div class="trio" id="trio"></div>
 </section>
 <section aria-labelledby="h-pick" style="display:grid;gap:16px">
  <div style="display:grid;gap:6px"><p class="slate">고르기</p><h2 id="h-pick">어느 결로 갈까요</h2></div>
  <div class="notes" id="notes"></div>
  <div class="others" id="others"></div>
  <div class="foot">
   <label for="note-look">한 줄(골라도 되고 비워도 됩니다)</label>
   <textarea id="note-look" rows="2"></textarea>
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
for (const s of D.글.방법) $('#how').append(make('li', null, s));

// ── 무대: 두 비디오를 번갈아 써서 컷 경계에서 끊김 없이 넘긴다(모든 컷이 같은 자세로 시작 · 끝) ──
let look = D.순서[0], run = 0, mode = null, said = false;
const vids = [$('#vA'), $('#vB')]; let cur = 0;
const voice = new Audio(); voice.preload = 'auto';
const warm = {};
function preload(k) { for (const c of ['talk5', 'talk6', 'listen']) { const s = D.결[k][c].src; if (warm[s]) continue; const v = document.createElement('video'); v.preload = 'auto'; v.muted = true; v.src = s; warm[s] = v; } }
function setLook(k) {
 look = k; stop();
 $('#poster').src = D.결[k].포스터; $('#poster').alt = D.결[k].이름 + ' — 문 교수가 책상 너머에서 바라보는 첫 화면';
 for (const b of document.querySelectorAll('button.look')) b.setAttribute('aria-pressed', String(b.dataset.k === k));
 preload(k);
}
for (const k of D.순서) { const b = make('button', 'look', D.결[k].이름); b.type = 'button'; b.dataset.k = k; b.addEventListener('click', () => setLook(k)); $('#looks').append(b); }
function show(who, line, me) {
 const d = $('#dialog');
 if (!line) { d.classList.remove('on'); $('#turn').classList.remove('on'); return; }
 $('#who').textContent = who; $('#line').textContent = line.말; $('#gloss').textContent = line.뜻;
 d.classList.toggle('me', !!me); d.classList.add('on'); $('#turn').classList.toggle('on', !!me);
}
function clip(src, token) {
 return new Promise((resolve) => {
  const next = vids[1 - cur], prev = vids[cur];
  const go = () => {
   if (token !== run) return resolve(false);
   next.currentTime = 0;
   next.play().then(() => {
    next.classList.add('on'); prev.classList.remove('on'); prev.pause(); cur = 1 - cur;
   }).catch(() => resolve(false));
  };
  next.onended = () => resolve(token === run);
  if (next.getAttribute('src') !== src) { next.src = src; next.oncanplay = () => { next.oncanplay = null; go(); }; next.load(); } else go();
 });
}
function stop() {
 run++; mode = null; said = false; voice.pause();
 for (const v of vids) { v.pause(); v.classList.remove('on'); }
 show(null, null); $('#play').setAttribute('aria-pressed', 'false'); $('#try').setAttribute('aria-pressed', 'false'); $('#said').disabled = true;
}
async function listen(line, token) {
 // 학생 줄: 교수가 듣는 컷을 돌리고, 모범 읽기(또는 내 말)가 끝난 뒤 컷 경계에서 넘긴다
 show('나', line, true); said = false;
 let voiceDone = mode === 'try';
 if (mode === 'auto') { voice.src = line.소리; setTimeout(() => { if (token === run) voice.play().catch(() => {}); }, 250); voice.onended = () => { voiceDone = true; }; }
 if (mode === 'try') $('#said').disabled = false;
 for (let i = 0; i < 6; i++) {
  if (!(await clip(D.결[look].listen.src, token))) return false;
  if ((mode === 'auto' && voiceDone) || (mode === 'try' && said)) break;
 }
 $('#said').disabled = true;
 return token === run;
}
async function talk(name, token) { show('문 교수', D.교수[name], false); return clip(D.결[look][name].src, token); }
async function scene(m) {
 stop(); mode = m; const token = run;
 $(m === 'auto' ? '#play' : '#try').setAttribute('aria-pressed', 'true');
 const steps = [() => listen(D.학생.q, token), () => talk('talk5', token), () => listen(D.학생.ok, token), () => talk('talk6', token)];
 for (const s of steps) if (!(await s())) return;
 show(null, null);
 for (let i = 0; i < 2 && token === run; i++) if (!(await clip(D.결[look].listen.src, token))) return;
 if (token === run) { $('#play').setAttribute('aria-pressed', 'false'); $('#try').setAttribute('aria-pressed', 'false'); mode = null; }
}
$('#play').addEventListener('click', () => ($('#play').getAttribute('aria-pressed') === 'true' ? stop() : scene('auto')));
$('#try').addEventListener('click', () => ($('#try').getAttribute('aria-pressed') === 'true' ? stop() : scene('try')));
$('#said').addEventListener('click', () => { said = true; $('#said').disabled = true; });
setLook(look);

// ── 셋 나란히: 원본 녹음 하나를 틀고, 각 클립을 말이 시작하는 자리부터 같이 튼다 ──
const trio = [], trioAudio = new Audio(D.교수.talk5.소리); trioAudio.preload = 'auto';
for (const k of D.순서) {
 const f = make('figure'); const st = make('div', 'stage'); const v = document.createElement('video');
 v.muted = true; v.playsInline = true; v.preload = 'metadata'; v.src = D.결[k].talk5.src; v.poster = D.결[k].포스터; v.classList.add('on');
 st.append(v); f.append(st, make('figcaption', null, D.결[k].이름)); $('#trio').append(f); trio.push({ k, v });
}
function trioStop() { trioAudio.pause(); for (const t of trio) t.v.pause(); $('#trioPlay').setAttribute('aria-pressed', 'false'); }
$('#trioPlay').addEventListener('click', async () => {
 if ($('#trioPlay').getAttribute('aria-pressed') === 'true') return trioStop();
 stop(); $('#trioPlay').setAttribute('aria-pressed', 'true');
 for (const t of trio) t.v.currentTime = Math.max(0, D.결[t.k].talk5.말시작 || 0);
 trioAudio.currentTime = 0;
 await Promise.all([trioAudio.play().catch(() => {}), ...trio.map((t) => t.v.play().catch(() => {}))]);
});
trioAudio.addEventListener('ended', () => setTimeout(trioStop, 600));

// ── 고르기: 누르는 즉시 db picks/look에 저장 ──
const names = {}, cards = [];
for (const o of D.글.결) {
 names[o.값] = o.이름;
 const c = make('div', 'opt'); c.append(make('h3', null, o.이름));
 const ls = make('div', 'lines'); for (const s of o.좋음) ls.append(make('span', 'good', s)); for (const s of o.걱정) ls.append(make('span', 'worry', s)); c.append(ls);
 const b = make('button', 'pick', '이 결로'); b.type = 'button'; b.addEventListener('click', () => choose(o.값)); c.append(b);
 cards.push({ v: o.값, el: c, b, label: '이 결로' }); $('#notes').append(c);
}
for (const o of D.글.다른길) {
 names[o.값] = o.이름; const b = make('button', null, o.이름); b.type = 'button'; b.title = o.설명 || '';
 b.addEventListener('click', () => choose(o.값)); cards.push({ v: o.값, el: b, b, label: o.이름 }); $('#others').append(b);
}
let value = null, db = null, canWrite = true, writing = false, again = false;
function paint() { for (const x of cards) { const on = x.v === value; x.el.classList.toggle('chosen', on); if (x.el.classList.contains('opt')) x.b.textContent = on ? '고름' : x.label; } }
async function save() {
 if (writing) { again = true; return; }
 writing = true;
 try { do { again = false; await db.doc('picks/look').set({ 값: value, 이름: names[value] || '', 한줄: $('#note-look').value.trim().slice(0, 500), 때: new Date().toISOString() }); } while (again);
  $('#status').className = 'status ok'; $('#status').textContent = '「' + names[value] + '」(으)로 저장했습니다.';
 } catch (e) { $('#status').className = 'status'; $('#status').textContent = '저장하지 못했습니다(' + (e && e.code || '오류') + '). 채팅에 「' + names[value] + '」라고 알려 주세요.'; }
 finally { writing = false; }
}
function choose(v) {
 value = v; paint();
 if (!db || !canWrite) { $('#status').className = 'status'; $('#status').textContent = '「' + names[v] + '」를 골랐습니다. 이 화면에서는 저장이 안 되니 채팅에 알려 주세요.'; return; }
 $('#status').className = 'status'; $('#status').textContent = '저장하는 중…'; save();
}
$('#note-look').addEventListener('change', () => { if (value != null && db && canWrite) save(); });
(async () => {
 try { db = await window.claude?.use?.('db'); const u = await window.claude?.use?.('user'); if (u && typeof u.can === 'function') { const w = await u.can('data.write'); if (w === false) canWrite = false; } } catch (e) { db = null; }
 if (!db) return;
 db.doc('picks/look').onSnapshot((snap) => {
  if (!snap.exists) return; const v = snap.data();
  if (v.값 != null && !writing) { value = v.값; paint(); $('#status').className = 'status ok'; $('#status').textContent = '「' + (names[v.값] || v.값) + '」(으)로 저장되어 있습니다.'; }
  if (v.한줄 && !$('#note-look').value) $('#note-look').value = v.한줄;
 }, () => {});
})();
</script>
`;

fs.writeFileSync(path.join(작업, '살아있는판.html'), html);
fs.writeFileSync(path.join(작업, '살아있는판_파일.json'), JSON.stringify(파일, null, 1));
console.log(`살아있는판.html · 파일 ${Object.keys(파일).length}개`);
