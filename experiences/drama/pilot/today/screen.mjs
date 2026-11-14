// 「오늘」 한 장 화면(11-14, 깃발 ?today=1 뒤 — pilot.mjs startToday가 부른다). 둘째 날부터 첫 화면 대신:
//   태오의 한마디 + 단추 하나(「오늘 시작 · N분」) + 오늘 할 것 세 가지(복습 · 오늘 공부 · 점검)와 그 이유 → 누르면 고르는 화면 없이 차례로 →
//   끝나면 오늘 달라진 것(전 → 후)과 내일 할 것.
// 값은 plan.mjs 계약(today · after)만 읽는다. 차례는 드라마 장면 함수를 그대로 부른다(새 상황 = runTransfer('today'), 장면 줄 다시 = runRetake).
// 입장 검사는 드라마 틀 밖이라 부모 창 통로(SYNKTodayHost.open)로 연다 — 지금은 시연 대역(qa/오늘한장-20261114/오늘시험.mjs)에만 있다.
// 중간에 나가도(창을 닫거나 다른 게임으로 가도) 버튼을 누른 때의 「오늘」과 한 차례가 이 탭(sessionStorage)에 남아 다시 열면 이어진다.
// 목소리: 태오 한 줄은 녹음 길이 정해질 때까지 글로만(자막 결) 보인다 — 듣는 고리 영상(손 인사)은 있는 것을 쓴다.
import { buildToday, buildAfter, dayKey, dayStart, proofLine as proof } from './plan.mjs';
import { poolItem, TEXT } from './content.mjs';
import { findLearningHost, readEvents, readDelayed, readEntry } from './gather.mjs';
import { STR } from '../strings.mjs';

const RUN = 'synk.drama.today.run';
const KIND = { again: '복습', new: '오늘 공부', check: '점검' };
const store = {
 get() { try { const r = JSON.parse(sessionStorage.getItem(RUN) || 'null'); return r && r.day === dayKey(Date.now()) ? r : null; } catch { return null; } },
 set(r) { try { sessionStorage.setItem(RUN, JSON.stringify(r)); } catch { /* 이 탭만 — 못 남기면 처음부터 */ } },
 clear() { try { sessionStorage.removeItem(RUN); } catch { /* 없음 */ } },
};

export async function start(ctx) {
 const { S } = ctx;
 const host = findLearningHost(), D = window.DramaLearning;
 if (!host || !D || !ctx.inWorld()) return ctx.intro();
 if (S.trail === undefined || S.trail === null) S.trail = ctx.setupTrail();
 await css();
 const lesson = S.boot.lesson;
 const strings = { delayedTitle: STR.ko.delayedTitle, delayedLead: STR.ko.delayedLead };
 const lineAttempts = new Map();
 const T = {
  lesson, strings, text: TEXT, run: store.get(), root: null, item: null, retake: false,
  attempts(lineId) { if (!lineAttempts.has(lineId)) lineAttempts.set(lineId, ctx.newAttemptState()); return lineAttempts.get(lineId); },
  // 차례 하나를 마쳤다(새 상황 마치기 · 테이크 2 뒤 다음) → 다음 차례.
  finish() { markDone(); return next(); },
  // 나중에 하기 · 받아쓰기가 막혀 남겨 둠 → 「오늘」로 돌아간다(그 차례는 남는다).
  leave() { T.item = null; T.retake = false; return show(); },
 };
 S.today = T;

 async function gather() {
  const [events, delayedDue, entry] = await Promise.all([readEvents({ host, D }), readDelayed({ trail: S.trail, lesson }), readEntry({ host }).catch(() => null)]);
  return { events, delayedDue, entry };
 }
 function markDone() {
  const r = T.run; if (!r) return;
  if (r.current != null && !r.done.includes(r.current)) r.done.push(r.current);
  r.current = null; r.opened = null; store.set(r);
  T.item = null; T.retake = false;
 }
 const remaining = () => (T.run ? T.run.start.items.map((it, i) => ({ it, i })).filter(({ i }) => !T.run.done.includes(i)) : []);

 // 다른 게임(입장 검사)에서 돌아왔다 — 그 차례는 연 것으로 끝났다.
 if (T.run?.opened === 'game') markDone();

 async function show() {
  ctx.newScope(); ctx.hideMic(); ctx.subs(null); ctx.hideSlate(); ctx.stageMode('still');
  if (T.run && !remaining().length) return end();
  const g = await gather();
  const today = buildToday({ ...g, lesson, now: Date.now(), strings });
  if (!T.run && today.firstDay) { S.today = null; return ctx.intro(); }
  // 버튼을 누른 뒤면 그때의 「오늘」(남은 차례)을, 아니면 지금 기록으로 지은 「오늘」을 보인다.
  const view = T.run ? { ...T.run.start, items: remaining().map(({ it }) => it), minutes: remaining().reduce((s, { it }) => s + it.minutes, 0) } : today;
  if (!T.run && !today.items.length) return paint(viewToday(today, { empty: true }));
  paint(viewToday(view, { resume: !!T.run }), () => {
   T.root.querySelector('[data-go]')?.addEventListener('click', () => {
    if (!T.run) { T.run = { day: dayKey(Date.now()), startAt: Date.now(), start: today, done: [], current: null, opened: null, entryTarget: null }; store.set(T.run); }
    next();
   });
   T.root.querySelector('[data-episode]')?.addEventListener('click', () => { hide(); S.today = null; ctx.intro(); });
  });
 }

 function next() {
  const left = remaining();
  if (!left.length) return end();
  const { it, i } = left[0];
  T.run.current = i; store.set(T.run);
  if (it.open.type === 'game') return openGame(it);
  hide();
  if (it.open.type === 'situation') {
   T.item = itemOf(it);
   return ctx.runTransfer('today');
  }
  if (it.open.type === 'retake') {
   T.retake = true;
   S.retake = { lineId: it.open.lineId, mode: 'note', note: { kind: it.note }, noteTakeId: null, take2Id: null };
   return ctx.runRetake();
  }
  // 장면 끝까지: 지금 장면 흐름 그대로(끝은 지금 기록 화면). 이 차례는 연 것으로 친다.
  markDone();
  S.today = null;
  return ctx.runScene(0);
 }

 function itemOf(it) {
  if (it.open.source === 'transfer') return lesson.transfer;
  if (it.open.source === 'delayed') return lesson.delayed;
  const p = poolItem(it.open.lineId);
  return { id: p.id, skill: p.skill, prompt: p.prompt, promptKo: p.situation, reviewed: true, answerSec: p.answerSec, text: p.text, meaning: p.meaning };
 }

 function openGame(it) {
  const parentHost = (() => { try { return window.parent !== window && window.parent.location.origin === location.origin ? window.parent.SYNKTodayHost || null : null; } catch { return null; } })();
  T.run.opened = 'game';
  T.run.entryTarget = it.why.evidence.itemKey ? { itemKey: it.why.evidence.itemKey } : null;
  store.set(T.run);
  if (parentHost?.open?.({ game: it.open.game, venueId: it.open.venueId })) return;
  // 통로가 없는 곳(지금 WORLD 공개본)에서는 열 수 없다 — 그 차례를 건너뛰고 끝으로.
  markDone();
  return next();
 }

 async function end() {
  ctx.newScope(); ctx.hideMic(); ctx.subs(null); ctx.hideSlate(); ctx.stageMode('still');
  const r = T.run;
  const g = await gather();
  const after = buildAfter({ events: g.events, lesson, start: r.start, startAt: r.startAt, now: Date.now(), entryAfter: g.entry, entryTarget: r.entryTarget, strings });
  paint(viewAfter(after), () => {
   T.root.querySelector('[data-close]')?.addEventListener('click', (e) => {
    e.currentTarget.disabled = true;
    const a = S.boot.lesson.coach?.wrap?.audio;
    if (a) try { const v = new Audio(a); v.play().catch(() => {}); } catch { /* 소리 없음 */ }
    T.root.classList.add('closing');
   });
  });
 }

 /* ── 그리기 ── */
 function hide() { if (T.root) { T.root.remove(); T.root = null; } }
 function paint(html, bind) {
  hide();
  const root = document.createElement('div');
  root.className = 'td td-a';
  root.innerHTML = html;
  document.body.append(root);
  T.root = root;
  root.querySelectorAll('[data-card]').forEach((c) => c.addEventListener('click', () => c.classList.toggle('open')));
  // 태오 한 줄을 구운 영상이 있으면 소리 내어 한 번 — 막히거나 끝나면 듣는 고리로 돌아간다.
  const say = root.querySelector('video[data-say]');
  if (say) {
   const loop = () => { say.removeAttribute('data-say'); say.muted = true; say.loop = true; say.src = assets().listenLoop; say.play().catch(() => {}); };
   say.addEventListener('ended', loop, { once: true });
   say.play().catch(loop);
  }
  bind?.();
 }
 const assets = () => ({ ...{ listenLoop: 'media/taeo-listen.mp4', poster: 'media/taeo-still.webp' }, ...(lesson.assets || {}) });
 function stage(video, media = null) {
  const a = assets();
  const v = media?.video ? `<video src="${esc(media.video)}" poster="${esc(a.poster)}" playsinline data-say></video>`
   : `<video src="${esc(a.listenLoop)}" poster="${esc(a.poster)}" autoplay muted loop playsinline></video>`;
  return `<div class="td-stage">${video ? v : `<img src="${esc(a.poster)}" alt="">`}<div class="td-shade"></div><div class="td-grain"></div></div>`;
 }
 function viewToday(t, { resume = false, empty = false } = {}) {
  const tag = dateTag(dayStart(Date.now())); // 학습일 날짜(새벽 4시 전이면 전날)
  const line = `<section class="td-talk"><span class="td-who">태오</span><p class="td-line">${words(t.line?.text || t.empty?.text || '')}</p></section>`;
  if (empty) return `${stage(true, t.line?.media)}<header class="td-top"><span class="td-tag">${tag}</span></header><div class="td-right"><div class="td-top-d"><span class="td-tag">${tag}</span></div>${line}
   <p class="td-why td-empty">${esc(t.empty?.text || '')}</p><button type="button" class="td-go" data-episode>1화 처음부터</button></div>`;
  const go = `<button type="button" class="td-go rise" data-go style="animation-delay:${420 + t.items.length * 60}ms"><span class="td-play"></span>${resume ? '이어서' : '오늘 시작'} <span class="td-min">· ${t.minutes}분</span></button>`;
  return `${stage(true, t.line?.media)}<header class="td-top"><span class="td-tag">${tag}</span></header>
  <div class="td-right"><div class="td-top-d"><span class="td-tag">${tag}</span></div>${line}
  <section class="td-deck">${t.items.map((it, i) => `<button type="button" class="td-card td-item rise" data-card style="animation-delay:${420 + i * 60}ms">${head(it, null)}<h3>${esc(it.title)}</h3><p class="td-why">${yo(it.why.text)}</p><p class="td-proof">${esc(proof(it))}</p></button>`).join('')}${go}</section></div>`;
 }
 function viewAfter(a) {
  const tm = a.tomorrow.length ? `<p class="td-sec rise" style="animation-delay:340ms">내일 할 것</p><div class="td-tm rise" style="animation-delay:380ms">${a.tomorrow.map((x) => `<span><b>${esc(x.when)}</b>${esc(x.title)}</span>`).join('')}</div>` : '';
  const close = `<button type="button" class="td-go rise" data-close style="animation-delay:440ms">오늘은 여기까지</button>`;
  const head = `<header class="td-top"><span class="td-tag">오늘 공부 끝</span></header>`;
  if (!a.changed.length) return `${stage(false)}${head}<div class="td-right td-after"><div class="td-top-d"><span class="td-tag">오늘 공부 끝</span></div><section class="td-sheet"><h2 class="rise">오늘 기록</h2><p class="td-why rise">오늘 한 것이 기록에 남았어요.</p>${tm}${close}</section></div>`;
  return `${stage(false)}${head}<div class="td-right td-after"><div class="td-top-d"><span class="td-tag">오늘 공부 끝</span></div><section class="td-sheet"><h2 class="rise">오늘 달라진 것</h2>
   ${a.changed.map((c, i) => `<div class="td-card td-chg rise" style="animation-delay:${120 + i * 60}ms"><p class="td-eyebrow">${yo(c.what)}</p><p class="td-before">${esc(c.before)}</p><p class="td-now">${esc(c.after)}</p></div>`).join('')}${tm}${close}</section></div>`;
 }
 return show();
}

/* ── 글 도우미 ── */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// '요' 강조는 뜻이 있는 자리 하나(따옴표 속 '요')만.
// 화면에서는 따옴표를 빼고 「요」 한 글자에 옅은 바탕을 깐다(11-14 카본 그림 검수 — 따옴표의 좌우 간격이 벌어져 보였다).
const yo = (s) => esc(s).replace(/&#39;요&#39;/g, '<em class="td-yo">요</em>');
const words = (s) => String(s).split(' ').map((w, i) => `<span class="w" style="animation-delay:${120 + i * 70}ms">${yo(w)}</span>`).join(' ');
const head = (it, i) => `<div class="td-eyebrow">${i != null ? `<span class="mono">0${i + 1}</span>` : ''}<span>${KIND[it.kind]}</span><span class="td-end">${it.minutes}분</span></div>`;
function dateTag(ms) { const d = new Date(ms); return `${d.getMonth() + 1}월 ${d.getDate()}일 ${'일월화수목금토'[d.getDay()]}요일`; }
function css() {
 if (document.querySelector('link[data-today]')) return Promise.resolve();
 return new Promise((res) => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./today.css', import.meta.url).href; l.dataset.today = '1'; l.onload = l.onerror = res; document.head.append(l); });
}
