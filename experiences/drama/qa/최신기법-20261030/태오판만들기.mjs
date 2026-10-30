#!/usr/bin/env node
/**
 * 1화 태오 선배 「살아 있는 상대역」 실사 영상 시험 페이지 만들기(2026-10-30) — 유호님 「실사로」 · 「지금 구워」 뒤 구운 대사 컷(Seedance 2.5) ·
 * 듣는 컷(2.0)을 한 무대에서 끊김 없이 이어 붙인다(살아있는판만들기.mjs의 두 비디오 번갈아 쓰기). 학생 줄은 모범 읽기(Hana),
 * 선배 줄은 「영상이 낸 목소리」와 「원래 녹음(Julian)」을 바꿔 들을 수 있다. 고른 목소리는 db picks/voice에 누르는 즉시 남는다.
 *
 *   node 태오판만들기.mjs <작업>     <작업>/영상/태오결과.json을 읽어 → <작업>/태오판.html · <작업>/태오판_파일.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ep01 from '../../s1/ep01.mjs';
import 글 from './태오판_글.mjs';

const 작업 = process.argv[2];
if (!작업) { console.error('쓰는 법: node 태오판만들기.mjs <작업 폴더>'); process.exit(2); }
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 소리폴더 = path.resolve(여기, '../../s1/소리');
const 결과 = JSON.parse(fs.readFileSync(path.join(작업, '영상', '태오결과.json'), 'utf8'));

const 파일 = {};
const 붙임 = (이름, 원본) => {
 if (!fs.existsSync(원본)) throw new Error(`파일이 없다: ${원본}`);
 파일[이름] = path.resolve(원본).replace(/\\/g, '/');
 return 이름;
};
// 포스터는 듣는 컷의 첫 프레임 — GPT 시작 그림을 줄여 쓰면 「장면 보기」 첫 0.22초에 눈 · 머리 · 피부 결 · 뒤 사람이 바뀐다(포스터 ↔ 첫 화면 차 15.5, 10-30 Fable).
const 포스터 = (영상, 이름) => {
 const 나갈 = path.join(작업, '보기', `${이름}-poster.jpg`);
 const r = spawnSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-i', 영상, '-frames:v', '1', '-q:v', '2', 나갈]);
 if (r.status !== 0) throw new Error(`포스터 실패: ${이름} ${r.stderr}`);
 return 붙임(`img/${이름}-poster.jpg`, 나갈);
};
const 줄찾기 = (역, 번호) => {
 const 줄 = JSON.parse(fs.readFileSync(path.join(소리폴더, `ep01-${역}.json`), 'utf8')).줄.find((l) => l.번호 === 번호);
 const 대본줄 = ep01.촬영일.flatMap((d) => d.줄 || []).find((l) => l.말 === 줄.말);
 return { 말: 줄.말, 뜻: 대본줄?.뜻 || '', 소리: 붙임(`audio/${줄.파일}`, path.join(소리폴더, 줄.파일)), 초: 줄.초 };
};

const 쓸것 = {
 포스터: 포스터(path.join(작업, 결과.listen.파일), 'senior-listen'),
 talk: { own: 붙임('video/senior-talk2-own.mp4', path.join(작업, 결과.talk.own)), julian: 붙임('video/senior-talk2-julian.mp4', path.join(작업, 결과.talk.julian)) },
 listen: 붙임('video/senior-listen.mp4', path.join(작업, 결과.listen.파일)),
 선배: 줄찾기('senior', 2),
 학생: { a: 줄찾기('model', 6), b: 줄찾기('model', 7) },
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
/* 배치: 촬영장 모니터 한 대 — 왼쪽 세로 무대, 오른쪽 조작 · 목소리 고르기 */
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
button.said{border-color:var(--pick);color:var(--pick)}
button[disabled]{opacity:.45;cursor:default}
button.voice[aria-pressed="true"]{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.theatre{display:grid;grid-template-columns:minmax(0,400px) minmax(0,1fr);gap:24px;align-items:start}
@media (max-width:760px){.theatre{grid-template-columns:minmax(0,1fr)}}
.stage{position:relative;width:100%;aspect-ratio:9/16;overflow:hidden;border-radius:22px;background:var(--stage);box-shadow:0 0 0 1px var(--rule)}
.stage video,.stage img.poster{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
/* 끝 화면이 첫 화면과 표정 · 뒤 사람이 조금 달라(얼굴 차 13.9 ↔ 첫 화면끼리 7.4, 10-30) 0.22초 겹쳐 바꾼다 */
.stage video{opacity:0;transition:opacity 220ms linear}
.stage video.on{opacity:1}
.turn{position:absolute;top:14px;left:14px;font-size:12px;font-weight:700;background:rgba(210,59,47,.92);color:#fff;border-radius:999px;padding:3px 10px;visibility:hidden}
.turn.on{visibility:visible}
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
@media (prefers-reduced-motion:reduce){.stage video{transition:none}}
</style>

<div class="wrap">
 <header>
  <p class="slate">드라마 말하기 · S1 EP01 · 영상 시험 · 실사</p>
  <h1>태오 선배 영상 시험</h1>
  <p class="lead" id="lead"></p>
 </header>
 <section aria-labelledby="h-see" style="display:grid;gap:16px">
  <h2 id="h-see" class="slate" style="font-family:var(--f-mono);font-size:12px;font-weight:500">봄 캠퍼스 · 길 잃은 신입생과 태오 선배</h2>
  <div class="theatre">
   <div class="stage" id="stage">
    <img class="poster" id="poster" alt="태오 선배가 봄 캠퍼스 광장에서 나를 바라보는 첫 화면">
    <video id="vA" playsinline preload="auto"></video>
    <video id="vB" playsinline preload="auto"></video>
    <span class="turn" id="turn">● 내 차례</span>
    <div class="dialog" id="dialog"><span class="who" id="who"></span><span class="line" id="line"></span><span class="gloss" id="gloss"></span></div>
   </div>
   <div class="side">
    <p class="cap" id="before"></p>
    <div class="controls"><button type="button" class="play" id="play" aria-pressed="false">장면 보기</button><button type="button" id="try" aria-pressed="false">내가 말해 보기</button></div>
    <div class="controls"><button type="button" class="said" id="said" disabled>말했어요</button><span class="cap">「내가 말해 보기」에서는 학생 줄을 직접 말한 뒤 누르세요(소리는 받지 않습니다).</span></div>
    <div class="box" id="voicebox">
     <h3 style="font-size:17px">선배 목소리</h3>
     <div class="controls" role="group" aria-label="선배 목소리" id="voices"></div>
     <p class="cap" id="voicecap"></p>
     <label for="note">한 줄(골라도 되고 비워도 됩니다)</label>
     <textarea id="note" rows="2"></textarea>
     <p class="status" id="status" role="status">목소리를 고르면 바로 저장됩니다.</p>
    </div>
   </div>
  </div>
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
$('#poster').src = D.포스터;
for (const s of D.기록) $('#rec').append(make('li', null, s));
for (const s of D.글.걸림) $('#warn').append(make('li', null, s));

// ── 무대: 두 비디오를 번갈아 써서 컷 경계에서 끊김 없이 넘긴다 ──
let run = 0, mode = null, said = false, voice = 'own';
const vids = [$('#vA'), $('#vB')]; let cur = 0;
const student = new Audio(); student.preload = 'auto';
for (const s of [D.talk.own, D.talk.julian, D.listen]) { const v = document.createElement('video'); v.preload = 'auto'; v.muted = true; v.src = s; }
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
   next.play().then(() => { next.classList.add('on'); prev.classList.remove('on'); prev.pause(); cur = 1 - cur; }).catch(() => resolve(false));
  };
  next.onended = () => resolve(token === run);
  if (next.getAttribute('src') !== src) { next.src = src; next.oncanplay = () => { next.oncanplay = null; go(); }; next.load(); } else go();
 });
}
function stop() {
 run++; mode = null; said = false; student.pause();
 for (const v of vids) { v.pause(); v.classList.remove('on'); }
 show(null, null); $('#play').setAttribute('aria-pressed', 'false'); $('#try').setAttribute('aria-pressed', 'false'); $('#said').disabled = true;
}
async function listen(line, token) {
 show('나', line, true); said = false;
 let done = mode === 'try';
 if (mode === 'auto') { student.src = line.소리; setTimeout(() => { if (token === run) student.play().catch(() => {}); }, 250); student.onended = () => { done = true; }; }
 if (mode === 'try') $('#said').disabled = false;
 for (let i = 0; i < 6; i++) {
  if (!(await clip(D.listen, token))) return false;
  if ((mode === 'auto' && done) || (mode === 'try' && said)) break;
 }
 $('#said').disabled = true;
 return token === run;
}
async function scene(m) {
 stop(); mode = m; const token = run;
 $(m === 'auto' ? '#play' : '#try').setAttribute('aria-pressed', 'true');
 if (!(await listen(D.학생.a, token))) return;
 show('태오 선배', D.선배, false);
 if (!(await clip(voice === 'own' ? D.talk.own : D.talk.julian, token))) return;
 if (!(await listen(D.학생.b, token))) return;
 show(null, null);
 for (let i = 0; i < 2 && token === run; i++) if (!(await clip(D.listen, token))) return;
 if (token === run) { $('#play').setAttribute('aria-pressed', 'false'); $('#try').setAttribute('aria-pressed', 'false'); mode = null; }
}
$('#play').addEventListener('click', () => ($('#play').getAttribute('aria-pressed') === 'true' ? stop() : scene('auto')));
$('#try').addEventListener('click', () => ($('#try').getAttribute('aria-pressed') === 'true' ? stop() : scene('try')));
$('#said').addEventListener('click', () => { said = true; $('#said').disabled = true; });

// ── 목소리: 바꿔 듣기 + 고른 것은 db picks/voice에 바로 저장 ──
const names = {};
function paintVoice() {
 for (const b of document.querySelectorAll('button.voice')) b.setAttribute('aria-pressed', String(b.dataset.v === voice));
 const o = D.글.목소리.find((x) => x.값 === voice); $('#voicecap').textContent = o ? o.설명 : '';
}
for (const o of D.글.목소리) {
 names[o.값] = o.이름; const b = make('button', 'voice', o.이름); b.type = 'button'; b.dataset.v = o.값;
 b.addEventListener('click', () => { voice = o.값; paintVoice(); choose(o.값); }); $('#voices').append(b);
}
paintVoice();
let db = null, canWrite = true, writing = false, again = false, chosen = null;
async function save() {
 if (writing) { again = true; return; }
 writing = true;
 try { do { again = false; await db.doc('picks/voice').set({ 값: chosen, 이름: names[chosen] || '', 한줄: $('#note').value.trim().slice(0, 500), 때: new Date().toISOString() }); } while (again);
  $('#status').className = 'status ok'; $('#status').textContent = '「' + names[chosen] + '」(으)로 저장했습니다.'; $('#voicebox').classList.add('chosen');
 } catch (e) { $('#status').className = 'status'; $('#status').textContent = '저장하지 못했습니다(' + (e && e.code || '오류') + '). 채팅에 「' + names[chosen] + '」라고 알려 주세요.'; }
 finally { writing = false; }
}
function choose(v) {
 chosen = v;
 if (!db || !canWrite) { $('#status').className = 'status'; $('#status').textContent = '「' + names[v] + '」로 바꿔 들려 드립니다. 이 화면에서는 저장이 안 되니 고르시면 채팅에 알려 주세요.'; return; }
 $('#status').className = 'status'; $('#status').textContent = '저장하는 중…'; save();
}
$('#note').addEventListener('change', () => { if (chosen != null && db && canWrite) save(); });
(async () => {
 try { db = await window.claude?.use?.('db'); const u = await window.claude?.use?.('user'); if (u && typeof u.can === 'function') { const w = await u.can('data.write'); if (w === false) canWrite = false; } } catch (e) { db = null; }
 if (!db) return;
 db.doc('picks/voice').onSnapshot((snap) => {
  if (!snap.exists) return; const v = snap.data();
  if (v.값 && !writing) { chosen = v.값; voice = v.값; paintVoice(); $('#voicebox').classList.add('chosen'); $('#status').className = 'status ok'; $('#status').textContent = '「' + (names[v.값] || v.값) + '」(으)로 저장되어 있습니다.'; }
  if (v.한줄 && !$('#note').value) $('#note').value = v.한줄;
 }, () => {});
})();
</script>
`;

fs.writeFileSync(path.join(작업, '태오판.html'), html);
fs.writeFileSync(path.join(작업, '태오판_파일.json'), JSON.stringify(파일, null, 1));
console.log(`태오판.html · 파일 ${Object.keys(파일).length}개`);
