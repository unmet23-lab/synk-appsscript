#!/usr/bin/env node
/**
 * 1화 목소리 오디션 페이지 만들기(2026-10-30) — 대본 정본(experiences/drama/s1/ep01.mjs)과 굽기 기록(<작업>/기록.json · 받아쓰기.json)으로
 * 귀로 고르는 claude.ai 페이지 한 장을 만든다. 엔진 이름은 고르기 전에는 가리고(역마다 엔진이 섞인 고정 순서), 고른 것은 페이지 저장소(db)의
 * picks/professor · picks/senior에 남아 Claude가 읽는다.
 *
 *   node 판만들기.mjs <작업 폴더>     → <작업>/오디션.html, <작업>/오디션_파일.json(게시할 소리 파일 짝)
 */
import fs from 'node:fs';
import path from 'node:path';
import ep01 from '../../s1/ep01.mjs';

const 작업 = process.argv[2];
if (!작업) { console.error('쓰는 법: node 판만들기.mjs <작업 폴더>'); process.exit(2); }
const 기록 = JSON.parse(fs.readFileSync(path.join(작업, '기록.json'), 'utf8'));
const 받아 = JSON.parse(fs.readFileSync(path.join(작업, '받아쓰기.json'), 'utf8'));

// 역마다 엔진이 섞이게 고정한 듣는 순서(귀로만 고르게).
// 페이지에는 이 순서로 놓인다 — 10-30에 더한 감독 · 모범 읽기가 위, 이미 고른 교수 · 선배가 아래.
const 순서 = {
 감독: ['감독_eleven_Harrison', '감독_inworld_Yoona', '감독_openai_ash', '감독_eleven_Nora', '감독_inworld_Hyunwoo', '감독_eleven_Mark'],
 모범: ['모범_inworld_Minji', '모범_eleven_Kevin', '모범_openai_coral', '모범_eleven_Hana', '모범_inworld_Seojun', '모범_eleven_Zoe'],
 교수: ['교수_inworld_Yoona', '교수_eleven_Nora', '교수_openai_marin', '교수_eleven_Elena', '교수_inworld_Minji', '교수_eleven_Vesper'],
 선배: ['선배_eleven_Julian', '선배_inworld_Hyunwoo', '선배_openai_cedar', '선배_eleven_Kevin', '선배_inworld_Seojun', '선배_eleven_Cillian'],
};
const 엔진말 = { eleven: '일레븐 v4 · 힉스필드', inworld: 'Inworld 한국어 원어민 · 힉스필드', openai: 'OpenAI Realtime 2.1' };
const 값말 = { eleven: '이번 판 1.6크레딧 안팎', inworld: '이번 판 2크레딧', openai: '월 API 크레딧(돈 안 나감)' };
const 덧말 = {
 '교수_eleven_Nora': '힉스필드 나이 칸 「middle_aged」.',
 '교수_eleven_Elena': '힉스필드 나이 칸 「middle_aged」.',
 '교수_eleven_Vesper': '미리듣기 음높이가 여자 후보 가운데 가장 낮았다.',
 '교수_openai_marin': 'OpenAI 목소리는 앱에 「합성 목소리」 표시가 필요하다(OpenAI 정책).',
 '선배_openai_cedar': '받아쓰기에서 「정문」·「선배라고」가 「적은」·「손대라고」로 나왔다 — 발음이 흐린 곳이 있다. OpenAI 정책상 「합성 목소리」 표시가 필요하다.',
 '감독_eleven_Nora': '여자 목소리 — 감독의 성별은 아직 정하지 않았다. 교수 후보였던 목소리다.',
 '감독_inworld_Yoona': '여자 목소리 — 감독의 성별은 아직 정하지 않았다.',
 '감독_openai_ash': 'OpenAI 목소리는 앱에 「합성 목소리」 표시가 필요하다(OpenAI 정책).',
 '모범_eleven_Kevin': '선배 후보였던 목소리다.',
 '모범_openai_coral': 'OpenAI 목소리는 앱에 「합성 목소리」 표시가 필요하다(OpenAI 정책).',
};
const 파일 = {};
const 후보 = {};
for (const [역, 열쇠들] of Object.entries(순서)) {
 후보[역] = 열쇠들.map((열쇠, i) => {
  const 판 = 기록.판[열쇠];
  if (!판?.판) throw new Error(`${열쇠}의 맞춘 소리가 없다 — 굽기.mjs 맞추기부터`);
  const 이름 = `audio/${{ 교수: 'professor', 선배: 'senior', 감독: 'director', 모범: 'model' }[역]}-${i + 1}.mp3`;
  파일[이름] = path.join(작업, 판.판).replace(/\\/g, '/');
  return { 번호: i + 1, 소리: 이름, 초: 판.초, 엔진: 엔진말[판.엔진], 목소리: 판.이름, 값: 값말[판.엔진], 일치: 받아[열쇠]?.일치 ?? null, 덧말: 덧말[열쇠] || '' };
 });
}
const 줄 = (역) => JSON.parse(fs.readFileSync(path.join(작업, `${역}_줄.json`), 'utf8')).map((l) => ({ 말: l.말, 지문: l.지문, 되묻기: l.되묻기 }));
const 쓸것 = {
 역: [
  { id: 'director', 역: '감독', 제목: '감독', 장면: '촬영장 · 테이크마다', 소개: '배우 출신의 가상 감독. 테이크가 끝날 때마다 짧게 말하고, 사람이 아니라 테이크에 대해서만 말한다. 마지막 두 줄(노트 · 칭찬)은 시안이다 — 유호님 연출 원칙 인터뷰 뒤 다시 쓴다.', 줄: 줄('감독'), 후보: 후보.감독 },
  { id: 'model', 역: '모범', 제목: '학생 모범 읽기', 장면: '따라 말하기 · 내 대사 아홉 줄', 소개: '학습자가 듣고 따라 말할 모범 읽기. 교수님께는 공손하게, 선배에게는 밝게 — 또박또박 자연스러운 속도로.', 줄: 줄('모범'), 후보: 후보.모범 },
  { id: 'professor', 역: '교수', 제목: '문지영 교수 역', 장면: '장면 1 · 연구실 · 10-30 고름', 소개: ep01.인물.교수.소개, 줄: 줄('교수'), 후보: 후보.교수 },
  { id: 'senior', 역: '선배', 제목: '권태오 선배 역', 장면: '장면 2 · 학생 식당 · 10-30 고름', 소개: ep01.인물.선배.소개, 줄: 줄('선배'), 후보: 후보.선배 },
 ],
 대본: { 제목: ep01.제목, 시즌: ep01.시즌, 줄거리: ep01.줄거리, 배운것: ep01.배운것, 촬영일: ep01.촬영일, 처음보는대사: ep01.처음보는대사.map(({ 상황, 말, 뜻 }) => ({ 상황, 말, 뜻 })), 카드: ep01.카드, 예고: ep01.예고, 칸수: ep01.칸.length },
};
const 자료 = JSON.stringify(쓸것).replace(/</g, '\\u003c');

const html = `<title>1화 목소리 오디션</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@700;800&family=Noto+Sans+KR:wght@400;500;700&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
/* 배치: 대본 한 권 — 위에는 역마다 오디션 카드 여섯, 아래는 배우가 자기 대사에 형광펜을 그은 대본 */
:root{
 --paper:#fbfbf8; --ink:#1c2024; --muted:#5d6570; --rule:#e1e2dc; --card:#ffffff;
 --hl:#eef59a; --hl-ink:#1c2024; --accent:#2b56d9; --accent-soft:#e7edff; --pick:#0b7a55; --pick-soft:#dff3ea; --warn:#9a5b00;
 --f-display:"Nanum Myeongjo","Noto Serif KR",serif; --f-body:"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif; --f-mono:"IBM Plex Mono",ui-monospace,Consolas,monospace;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
 --paper:#141516; --ink:#e8e6e1; --muted:#a3a9b0; --rule:#2c2f33; --card:#1b1d1f;
 --hl:#4a4f17; --hl-ink:#f3f1e8; --accent:#8ea9ff; --accent-soft:#1f2740; --pick:#46c79a; --pick-soft:#12302a; --warn:#e3a54a; color-scheme:dark}}
:root[data-theme="dark"]{
 --paper:#141516; --ink:#e8e6e1; --muted:#a3a9b0; --rule:#2c2f33; --card:#1b1d1f;
 --hl:#4a4f17; --hl-ink:#f3f1e8; --accent:#8ea9ff; --accent-soft:#1f2740; --pick:#46c79a; --pick-soft:#12302a; --warn:#e3a54a; color-scheme:dark}
*{box-sizing:border-box}
body{background:var(--paper);color:var(--ink);font-family:var(--f-body);font-size:16px;line-height:1.65;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:28px 64px}
.wrap{max-width:820px;margin:0 auto;display:grid;gap:40px}
.slate{font-family:var(--f-mono);font-size:12px;letter-spacing:.08em;color:var(--muted);text-transform:uppercase}
h1,h2,h3{font-family:var(--f-display);text-wrap:balance;margin:0;line-height:1.3}
h1{font-size:clamp(28px,5vw,40px)}
h2{font-size:24px}
h3{font-size:18px}
p{margin:0}
.lead{color:var(--muted);max-width:62ch}
header{display:grid;gap:10px}
.how{display:grid;gap:6px;border-top:1px solid var(--rule);padding-top:14px;color:var(--muted);font-size:14px}
section.role{display:grid;gap:16px}
.role-head{display:grid;gap:4px}
.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
@media (max-width:640px){.cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:420px){.cards{grid-template-columns:1fr}}
.card{background:var(--card);border:1px solid var(--rule);border-radius:10px;padding:14px;display:grid;gap:10px;min-width:0}
.card.chosen{border-color:var(--pick);box-shadow:0 0 0 2px var(--pick-soft)}
.card-top{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.num{font-family:var(--f-display);font-size:26px;font-weight:800}
.dur{font-family:var(--f-mono);font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.btns{display:flex;gap:8px;flex-wrap:wrap}
button{font:inherit;font-size:14px;border-radius:8px;padding:7px 12px;cursor:pointer;border:1px solid var(--rule);background:var(--paper);color:var(--ink)}
button:focus-visible,textarea:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
button.play{border-color:var(--accent);color:var(--accent);background:var(--accent-soft)}
button.play[aria-pressed="true"]{background:var(--accent);color:var(--paper)}
button.pick{border-color:var(--pick);color:var(--pick)}
.card.chosen button.pick{background:var(--pick);color:var(--paper)}
.bar{height:3px;background:var(--rule);border-radius:2px;overflow:hidden}
.bar i{display:block;height:100%;width:0;background:var(--accent)}
.reveal{font-size:13px;color:var(--muted);display:grid;gap:2px;border-top:1px dashed var(--rule);padding-top:8px}
.reveal b{color:var(--ink);font-weight:700}
.reveal .warn{color:var(--warn)}
.role-foot{display:grid;gap:8px}
.status{font-size:14px;color:var(--muted)}
.status.ok{color:var(--pick)}
label{font-size:14px;color:var(--muted)}
textarea{width:100%;font:inherit;font-size:14px;border:1px solid var(--rule);border-radius:8px;padding:8px 10px;background:var(--card);color:var(--ink);min-height:44px;resize:vertical}
details{border:1px solid var(--rule);border-radius:10px;padding:10px 14px;background:var(--card)}
summary{cursor:pointer;font-weight:500}
ol.lines{margin:10px 0 0;padding-left:22px;display:grid;gap:6px;font-size:15px}
.dir{color:var(--muted);font-size:13px}
.script{display:grid;gap:22px}
.scene{display:grid;gap:10px}
.scene-head{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
.say{display:grid;grid-template-columns:5.5em minmax(0,1fr);gap:4px 12px;font-family:var(--f-display);font-size:17px}
.say .who{font-family:var(--f-body);font-size:13px;color:var(--muted);padding-top:4px}
.say .gloss{grid-column:2;font-family:var(--f-body);font-size:13px;color:var(--muted);margin-top:-2px}
.say.me .line{background:var(--hl);color:var(--hl-ink);box-decoration-break:clone;-webkit-box-decoration-break:clone;padding:0 4px;border-radius:2px}
.say .dir{grid-column:2;font-family:var(--f-body)}
.pool{display:grid;gap:10px}
.pool .item{display:grid;gap:2px;border-left:3px solid var(--rule);padding-left:12px}
.pool .sit{font-size:13px;color:var(--muted)}
.pool .line{font-family:var(--f-display);font-size:17px}
.cardbox{border:1px solid var(--rule);border-radius:10px;padding:14px 16px;display:grid;gap:8px;background:var(--card)}
.cardbox ul{margin:0;padding-left:20px;display:grid;gap:4px}
.muted{color:var(--muted)}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>

<div class="wrap">
 <header>
  <p class="slate">드라마 말하기 · S1 EP01 · 목소리 오디션</p>
  <h1>1화 목소리 오디션</h1>
  <p class="lead">역마다 여섯 목소리가 같은 대사를 읽습니다. 귀로만 들어 보고 역마다 하나를 골라 주세요. 엔진 이름은 고른 다음에 보입니다. 교수님 · 선배 역은 10-30에 고르셨고, 이번에 감독과 학생 모범 읽기를 더했습니다.</p>
  <div class="how">
   <p>모든 판은 같은 크기(−18 LUFS)로 맞췄고, 역마다 그 역이 말하는 줄을 모두 읽습니다(상대 인물은 끝에 되묻기 셋).</p>
   <p>고른 것은 이 페이지에 저장되고, Claude가 읽어 다음 굽기에 씁니다.</p>
  </div>
 </header>
 <div id="roles"></div>
 <section class="script" aria-labelledby="script-title">
  <div class="role-head">
   <p class="slate" id="script-slate"></p>
   <h2 id="script-title"></h2>
   <p class="lead" id="script-sum"></p>
  </div>
  <div id="script"></div>
 </section>
</div>

<script>
const D = ${자료};
const $ = (s, el = document) => el.querySelector(s);
const make = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const fmt = (s) => s == null ? '' : (Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0'));
let current = null;
const roleState = {};

function renderRole(r) {
 const sec = make('section', 'role'); sec.id = 'role-' + r.id; sec.setAttribute('aria-labelledby', 'h-' + r.id);
 const head = make('div', 'role-head');
 head.append(make('p', 'slate', r.장면));
 const h = make('h2', null, r.제목); h.id = 'h-' + r.id; head.append(h);
 head.append(make('p', 'lead', r.소개));
 sec.append(head);
 const grid = make('div', 'cards');
 const st = roleState[r.id] = { cards: [], chosen: null, revealed: false, r };
 for (const c of r.후보) {
  const card = make('div', 'card');
  const top = make('div', 'card-top');
  top.append(make('span', 'num', String(c.번호)), make('span', 'dur', fmt(c.초)));
  const audio = new Audio(c.소리); audio.preload = 'none';
  const bar = make('div', 'bar'); const fill = make('i'); bar.append(fill);
  const btns = make('div', 'btns');
  const play = make('button', 'play', '듣기'); play.type = 'button'; play.id = 'play-' + r.id + '-' + c.번호; play.setAttribute('aria-pressed', 'false');
  const pick = make('button', 'pick', '이 목소리로'); pick.type = 'button'; pick.id = 'pick-' + r.id + '-' + c.번호;
  btns.append(play, pick);
  const rev = make('div', 'reveal'); rev.hidden = true;
  const line1 = make('span'); const b = make('b', null, c.목소리); line1.append(b, document.createTextNode(' · ' + c.엔진));
  rev.append(line1, make('span', null, c.값 + (c.일치 != null ? ' · 받아쓰기 일치 ' + c.일치.toFixed(2) : '')));
  if (c.덧말) rev.append(make('span', /표시|흐린/.test(c.덧말) ? 'warn' : null, c.덧말));
  card.append(top, bar, btns, rev);
  grid.append(card);
  audio.addEventListener('timeupdate', () => { if (audio.duration) fill.style.width = (100 * audio.currentTime / audio.duration) + '%'; });
  audio.addEventListener('ended', () => { play.textContent = '다시 듣기'; play.setAttribute('aria-pressed', 'false'); fill.style.width = '100%'; current = null; });
  play.addEventListener('click', () => {
   if (current && current.audio !== audio) { current.audio.pause(); current.play.textContent = '듣기'; current.play.setAttribute('aria-pressed', 'false'); }
   if (audio.paused) { audio.play().catch(() => {}); play.textContent = '멈춤'; play.setAttribute('aria-pressed', 'true'); current = { audio, play }; }
   else { audio.pause(); play.textContent = '이어 듣기'; play.setAttribute('aria-pressed', 'false'); current = null; }
  });
  pick.addEventListener('click', () => choose(r.id, c.번호, true));
  st.cards.push({ c, card, rev, pick });
 }
 sec.append(grid);
 const foot = make('div', 'role-foot');
 const lab = make('label', null, '좋았던 점이나 아쉬운 점 한 줄(골라도 되고 비워도 됩니다)'); lab.htmlFor = 'note-' + r.id;
 const note = make('textarea'); note.id = 'note-' + r.id; note.rows = 2;
 const status = make('p', 'status', '아직 고르지 않았습니다.'); status.setAttribute('role', 'status');
 const reveal = make('button', null, '고르지 않고 엔진 보기'); reveal.type = 'button'; reveal.id = 'reveal-' + r.id;
 reveal.addEventListener('click', () => showEngines(r.id));
 foot.append(lab, note, status, reveal);
 st.note = note; st.status = status; st.revealBtn = reveal;
 sec.append(foot);
 const det = make('details'); det.append(make('summary', null, '이 역이 읽는 대사 ' + r.줄.length + '줄'));
 const ol = make('ol', 'lines');
 for (const l of r.줄) { const li = make('li'); li.append(document.createTextNode(l.말 + ' '), make('span', 'dir', '(' + l.지문 + ')')); ol.append(li); }
 det.append(ol); sec.append(det);
 return sec;
}
function showEngines(id) { const st = roleState[id]; st.revealed = true; for (const x of st.cards) x.rev.hidden = false; st.revealBtn.hidden = true; }
function paint(id) {
 const st = roleState[id];
 for (const x of st.cards) { const on = x.c.번호 === st.chosen; x.card.classList.toggle('chosen', on); x.pick.textContent = on ? '고름' : '이 목소리로'; }
}
let db = null, canWrite = true;
async function choose(id, num, user) {
 const st = roleState[id];
 st.chosen = num; paint(id); showEngines(id);
 if (!user) return;
 if (!db || !canWrite) { st.status.className = 'status'; st.status.textContent = num + '번을 골랐습니다. 이 화면에서는 저장이 안 되니 채팅에 「' + st.r.역 + ' ' + num + '번」이라고 알려 주세요.'; return; }
 st.status.className = 'status'; st.status.textContent = '저장하는 중…';
 const c = st.r.후보.find((x) => x.번호 === num);
 try {
  await db.doc('picks/' + id).set({ 역: st.r.역, 번호: num, 목소리: c.목소리, 엔진: c.엔진, 한줄: st.note.value.trim().slice(0, 500), 때: new Date().toISOString() });
  st.status.className = 'status ok'; st.status.textContent = num + '번(' + c.목소리 + ')으로 저장했습니다.';
 } catch (e) {
  st.status.className = 'status'; st.status.textContent = '저장하지 못했습니다(' + (e && e.code || '오류') + '). 채팅에 「' + st.r.역 + ' ' + num + '번」이라고 알려 주세요.';
 }
}

function renderScript() {
 const s = D.대본;
 $('#script-slate').textContent = s.시즌 + ' · 웹툰 칸 ' + s.칸수;
 $('#script-title').textContent = s.제목;
 $('#script-sum').textContent = s.줄거리;
 const box = $('#script');
 const learn = make('p', 'muted', '배우는 것 — ' + s.배운것); box.append(learn);
 for (const d of s.촬영일) {
  const sc = make('div', 'scene');
  const hd = make('div', 'scene-head'); hd.append(make('span', 'slate', '촬영일 ' + d.n), make('h3', null, d.이름)); sc.append(hd);
  if (d.장소) sc.append(make('p', 'muted', d.장소));
  if (d.하는일) sc.append(make('p', null, d.하는일));
  for (const l of d.줄 || []) {
   const me = l.누가 === '학생';
   const row = make('div', 'say' + (me ? ' me' : ''));
   row.append(make('span', 'who', me ? '나(학생)' : (l.누가 === '교수' ? '문 교수' : '태오 선배')));
   const t = make('span'); t.append(make('span', 'line', l.말)); row.append(t);
   if (l.지문) row.append(make('span', 'dir', l.지문));
   row.append(make('span', 'gloss', l.뜻));
   sc.append(row);
  }
  box.append(sc);
 }
 const pool = make('div', 'scene');
 const ph = make('div', 'scene-head'); ph.append(make('span', 'slate', '촬영일 4'), make('h3', null, '처음 보는 대사 ' + s.처음보는대사.length + '줄')); pool.append(ph);
 pool.append(make('p', 'muted', '같은 표현을 다른 상황·다른 사람에게 — 이것만 「혼자 해냄」으로 셉니다.'));
 const pl = make('div', 'pool');
 for (const t of s.처음보는대사) { const it = make('div', 'item'); it.append(make('span', 'sit', t.상황), make('span', 'line', t.말), make('span', 'sit', t.뜻)); pl.append(it); }
 pool.append(pl); box.append(pool);
 const cb = make('div', 'cardbox'); cb.append(make('span', 'slate', '말투 · 문화 카드'), make('h3', null, s.카드.제목));
 const ul = make('ul'); for (const x of s.카드.줄) ul.append(make('li', null, x)); cb.append(ul); box.append(cb);
 const pv = make('div', 'cardbox'); pv.append(make('span', 'slate', '다음 회 예고'), make('h3', null, s.예고.제목), make('p', null, s.예고.한줄)); box.append(pv);
}

const roles = $('#roles'); roles.className = 'wrap'; roles.style.gap = '40px';
for (const r of D.역) roles.append(renderRole(r));
renderScript();

(async () => {
 try {
  db = await window.claude?.use?.('db');
  const u = await window.claude?.use?.('user');
  if (u && typeof u.can === 'function') { const w = await u.can('data.write'); if (w === false) canWrite = false; }
 } catch (e) { db = null; }
 if (!db) return;
 for (const r of D.역) {
  db.doc('picks/' + r.id).onSnapshot((snap) => {
   if (!snap.exists) return;
   const v = snap.data(); const st = roleState[r.id];
   if (typeof v.번호 === 'number') { st.chosen = v.번호; paint(r.id); showEngines(r.id); st.status.className = 'status ok'; st.status.textContent = v.번호 + '번(' + v.목소리 + ')으로 저장되어 있습니다.'; }
   if (v.한줄 && !st.note.value) st.note.value = v.한줄;
  }, () => {});
 }
})();
</script>
`;
fs.writeFileSync(path.join(작업, '오디션.html'), html);
fs.writeFileSync(path.join(작업, '오디션_파일.json'), JSON.stringify(파일, null, 1));
console.log(`오디션.html ${(Buffer.byteLength(html) / 1024).toFixed(0)}KB · 소리 ${Object.keys(파일).length}개`);
