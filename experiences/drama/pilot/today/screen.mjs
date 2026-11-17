// 「오늘」 한 장 화면(11-14, 깃발 ?today=1 뒤 — pilot.mjs startToday가 부른다). 둘째 날부터 첫 화면 대신:
//   일력 한 장(11-16 뼈대 다시 짜기 — 카본 맹검에서 옛 A안 3점 · 이 판 6점) — 큰 날짜 숫자가 주인공이고, 태오는 큰 말(왼쪽)과 1화 식당 장면 한 컷(오른쪽)으로
//   한마디 한다(11-18 아래 절 다시 짓기 — GPT 맹검에서 옛 판 5점 기각 · 이 판 7점).
//   종이 아래 끝의 먹색 띠 단추(「오늘 시작 · N분」) + 오늘 할 것 세 줄(복습 · 오늘 공부 · 점검)과 줄마다 앱이 본 것 한 문장(「자세히」로 나머지 까닭과 근거) →
//   누르면 장이 들려 어두운 장면으로, 고르는 화면 없이 차례로 → 끝나면 그 장의 날짜에 동그라미, 오늘 달라진 것(전은 줄을 긋고 후는 체크),
//   다음에 할 것(날짜별 다음 장) → 「오늘은 여기까지」로 이 장을 뜯으면 다음 장이 보인다.
// 값은 plan.mjs 계약(today · after)만 읽는다. 차례는 드라마 장면 함수를 그대로 부른다(새 상황 = runTransfer('today'),
// 틀린 장면 복습 = runReview — 첫 화면과 같은 복습 화면이고, 「오늘」에서 열면 결과 화면의 「마치기」가 다음 차례로 간다).
// 입장 검사는 드라마 틀 밖이라 부모 창 통로(SYNKTodayHost.open)로 연다 — 지금은 시연 대역(qa/오늘한장-20261114/오늘시험.mjs)에만 있다.
// 중간에 나가도(창을 닫거나 다른 게임으로 가도) 버튼을 누른 때의 「오늘」과 한 차례가 이 탭(sessionStorage)에 남아 다시 열면 이어진다.
// 목소리: 태오 한 줄을 구운 영상(content.mjs TAEO_MEDIA)이 있으면 장면 컷 안에서 소리와 함께 한 번 튼다. 막히면 컷이나 「듣기」를 눌러 듣는다.
// 없으면 듣는 고리 영상과 글로만 보인다.
import { buildToday, buildAfter, dayKey, dayStart, proofLine as proof } from './plan.mjs';
import { poolItem, TEXT } from './content.mjs';
import { findLearningHost, readEvents, readRevisit, readEntry } from './gather.mjs';
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
  // item: 지금 여는 새 상황(runTransfer('today')가 읽는다). review: 지금 여는 틀린 장면 복습 { lineId, mistake }(runReview가 읽는다).
  lesson, strings, text: TEXT, run: store.get(), root: null, item: null, review: null,
  attempts(lineId) { if (!lineAttempts.has(lineId)) lineAttempts.set(lineId, ctx.newAttemptState()); return lineAttempts.get(lineId); },
  // 차례 하나를 마쳤다(새 상황 마치기 · 테이크 2 뒤 다음) → 다음 차례.
  finish() { markDone(); return next(); },
  // 나중에 하기 · 받아쓰기가 막혀 남겨 둠 → 「오늘」로 돌아간다(그 차례는 남는다).
  leave() { T.item = null; T.review = null; return show(); },
 };
 S.today = T;

 async function gather() {
  const [events, revisit, entry] = await Promise.all([readEvents({ host, D }), readRevisit({ trail: S.trail, lesson }), readEntry({ host }).catch(() => null)]);
  return { events, revisit, entry };
 }
 function markDone() {
  const r = T.run; if (!r) return;
  if (r.current != null && !r.done.includes(r.current)) r.done.push(r.current);
  r.current = null; r.opened = null; store.set(r);
  T.item = null; T.review = null;
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
   T.root.querySelector('[data-go]')?.addEventListener('click', (e) => {
    e.currentTarget.disabled = true;
    if (!T.run) { T.run = { day: dayKey(Date.now()), startAt: Date.now(), start: today, done: [], current: null, opened: null, entryTarget: null }; store.set(T.run); }
    // 장이 위로 들리고 어두운 장면이 드러난 뒤 첫 차례를 연다(움직임 줄이기 설정이면 바로).
    motion('lifting', 640).then(next);
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
  if (it.open.type === 'review') {
   T.review = { lineId: it.open.lineId, mistake: it.mistake || null };
   return ctx.runReview(it.open.lineId);
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
  const after = buildAfter({ events: g.events, lesson, start: r.start, startAt: r.startAt, now: Date.now(), revisit: g.revisit, entryAfter: g.entry, entryTarget: r.entryTarget, strings });
  paint(viewAfter(after), () => {
   T.root.querySelector('[data-close]')?.addEventListener('click', (e) => {
    e.currentTarget.disabled = true;
    // 다음 장의 태오 한마디를 구웠으면 그 목소리가 끝인사를 맡는다 — 코치 녹음과 겹치지 않게 코치 녹음은 틀지 않는다.
    const a = after.line?.media?.video ? null : S.boot.lesson.coach?.wrap?.audio;
    if (a) try { const v = new Audio(a); v.play().catch(() => {}); } catch { /* 소리 없음 */ }
    // 이 장을 뜯으면 밑의 다음 장(내일)이 보이고 그대로 둔다. 드러난 장은 화면 낭독기에도 읽히게 숨김을 풀고 초점을 옮긴다(11-16 GPT 검수 GA2).
    motion('tearing', 950).then(() => {
     if (!T.root) return;
     T.root.classList.add('torn');
     const under = T.root.querySelector('.td-under');
     // 뜯기 전에는 밑장이 inert라 키보드로도 닿지 않는다(11-16 GPT 다시 검수 GA1). 뜯은 뒤에는 윗장을 막고 밑장을 연다.
     const top = T.root.querySelector('.td-top');
     if (top) { top.setAttribute('aria-hidden', 'true'); top.inert = true; }
     if (under) voice(under.querySelector('.td-say')); // 다음 장의 태오 한마디(구웠으면) — 「오늘은 여기까지」를 누른 뒤라 소리가 막히지 않는다
     if (under) { under.inert = false; under.removeAttribute('inert'); under.removeAttribute('aria-hidden'); under.setAttribute('tabindex', '-1'); under.focus({ preventScroll: true }); }
     // 머리의 연월은 다음 장의 것으로(11월 30일을 뜯으면 12월).
     const [y, m] = (under?.dataset.ym || '').split('|');
     const b = T.root.querySelectorAll('.td-bind span');
     if (y && b.length === 2) { b[0].textContent = y; b[1].textContent = `${m}월`; }
    });
   });
   // 다음 장의 「드라마 처음 화면」 — 오늘 할 것을 다 한 뒤 갈 곳.
   T.root.querySelector('.td-under [data-episode]')?.addEventListener('click', () => { hide(); S.today = null; ctx.intro(); });
  });
 }
 // 장을 들거나 뜯는 움직임 — 끝날 때까지 기다린다. 움직임 줄이기 설정이면 기다리지 않는다.
 function motion(cls, ms) {
  const root = T.root;
  if (!root) return Promise.resolve();
  const reduce = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
  root.classList.add(cls);
  return reduce ? Promise.resolve() : new Promise((r) => setTimeout(r, ms));
 }

 /* ── 그리기 — 일력 한 장(11-16) ── */
 function hide() { if (T.root) { T.root.remove(); T.root = null; } }
 function paint(html, bind) {
  hide();
  const root = document.createElement('div');
  root.className = 'td td-cal';
  root.innerHTML = html;
  document.body.append(root);
  T.root = root;
  root.querySelectorAll('[data-card]').forEach((c) => c.addEventListener('click', () => { c.classList.toggle('open'); c.setAttribute('aria-expanded', c.classList.contains('open')); }));
  voice(root.querySelector('.td-sheet:not(.td-under) .td-say'));
  bind?.();
 }
 // 태오 한마디를 구운 영상이 있으면 소리 내어 한 번 — 끝나면 듣는 고리로 돌아간다. 소리 자동 재생이 막히면 이름 옆에 「듣기」가 뜨고,
 // 장면 컷이나 「듣기」를 누르면 듣는다. 파일이 없는 사본(재생 사본은 git 밖이다)이면 단추를 접고 듣는 고리로만 둔다.
 // 오늘 장은 그릴 때, 다음 장(장을 뜯으면 보임)은 뜯은 뒤에 부른다.
 function voice(say) {
  const bub = say?.querySelector('[data-say]');
  const video = bub?.querySelector('video');
  if (!bub || !video) return;
  const a = assets();
  const loop = () => { say.classList.remove('speaking'); video.muted = true; video.loop = true; video.src = a.listenLoop; video.play().catch(() => {}); };
  const speak = () => { say.classList.remove('tap'); say.classList.add('speaking'); video.muted = false; video.loop = false; video.src = bub.dataset.say; video.addEventListener('ended', loop, { once: true }); return video.play(); };
  const failed = (e) => { if (video.error || e?.name === 'NotSupportedError') { bub.disabled = true; say.classList.remove('tap'); } else say.classList.add('tap'); loop(); };
  speak().catch(failed);
  for (const b of say.querySelectorAll('[data-say], .td-listen')) b.addEventListener('click', () => speak().catch(failed));
 }
 const assets = () => ({ ...{ listenLoop: 'media/taeo-listen.mp4', poster: 'media/taeo-still.webp' }, ...(lesson.assets || {}) });
 // 일력의 풀칠한 머리 — 연월을 종이색으로 찍는다(11-16 카본: 아무 글 없는 검은 띠는 어색했다).
 const band = (ms) => { const d = new Date(ms); return `<div class="td-bind"><span>${d.getFullYear()}</span><span>${d.getMonth() + 1}월</span></div>`; };
 // 태오의 한마디 — 말이 먼저이고, 그 말을 한 사람은 오른쪽 장면 사진 한 장(1화 학생 식당의 태오, 듣는 고리 영상)과 그 아래 이름으로 붙는다.
 // 11-18 GPT 맹검: 동그란 얼굴 · 이름 · 따옴표 묶음이 홈페이지 추천사 같았다 — 동그라미와 따옴표를 버리고 1화에서 만난 그 장면을 보인다.
 // 구운 한마디가 있으면 사진이 단추가 되고 그 영상을 튼다.
 function sayBlock(line, { delay = 80 } = {}) {
  const a = assets(), media = line?.media;
  const v = `<video src="${esc(a.listenLoop)}" poster="${esc(a.poster)}" autoplay muted loop playsinline></video>`;
  const bub = media?.video ? `<button type="button" class="td-bub" data-say="${esc(media.video)}" aria-label="태오 말 듣기">${v}</button>` : `<span class="td-bub" aria-hidden="true">${v}</span>`;
  const listen = media?.video ? '<button type="button" class="td-listen">듣기</button>' : '';
  return `<section class="td-say rise" style="animation-delay:${delay}ms"><p class="td-line">${words(line?.text || '')}</p><figure class="td-pic">${bub}<figcaption class="td-who"><span>태오</span>${listen}</figcaption></figure></section>`;
 }
 // 일력 머리 — 큰 날짜 숫자(일요일 빨강 · 토요일 파랑)와 요일. done이면 숫자 위에 형광펜으로 동그라미가 그어진다.
 function dateHead(ms, { sub = '', done = false, small = false } = {}) {
  const d = new Date(ms), w = d.getDay();
  const ring = done ? '<svg class="td-ring" viewBox="0 0 220 140" aria-hidden="true"><path d="M150 16C96 2 30 14 16 58c-12 40 34 70 96 70 66 0 104-28 100-62C208 30 160 10 104 12 70 13 44 22 30 34" pathLength="1"/></svg>' : '';
  return `<header class="td-date${small ? ' small' : ''} rise"><div class="td-dn"><span class="td-num${w === 0 ? ' sun' : w === 6 ? ' sat' : ''}">${d.getDate()}${ring}</span><span class="td-wd"><b>${WD[w]}요일</b>${sub ? `<span>${esc(sub)}</span>` : ''}</span></div></header>`;
 }
 function viewToday(t, { resume = false, empty = false } = {}) {
  const day = dayStart(Date.now()); // 학습일 날짜(새벽 4시 전이면 전날)
  const say = sayBlock(t.line || t.empty);
  if (empty) return `${band(day)}<article class="td-sheet td-into-sheet"><div class="td-l">${dateHead(day)}${say}</div>
   <div class="td-r"><p class="td-why td-empty rise" style="animation-delay:200ms">${esc(t.empty?.text || '')}</p>
   <div class="td-foot td-into rise" style="animation-delay:300ms"><button type="button" class="td-go" data-episode>1화 처음부터<span class="td-arr"></span></button></div></div></article>`;
  // 줄마다 왼쪽 여백 칸(무엇 · 몇 분)과 오른쪽 본문(제목 · 앱이 본 것 한 문장)을 세로 먹줄 하나로 가른다 — 일력의 인쇄 여백처럼.
  // 11-18 GPT 맹검: 가로줄 · 회색 설명 · 오른쪽 「자세히」 줄이 생산성 앱 목록 같았다. 가로줄을 없애고 이유 문장은 흐리게 두지 않는다.
  // 「자세히」는 이유 문장 끝에 붙고 아래 꺾쇠가 달린다(11-18 맹검 1차: 여백 칸에 세 번 되풀이된 밑줄 「자세히」가 옛 웹의 보조 링크 같았다.
  // 2차: 굵은 먹색 글만으로는 누르는 것보다 문장 속 강조처럼 보였다).
  const rows = t.items.map((it, i) => {
   const lead = it.why.lead || it.why.text;
   const rest = [it.why.text.replace(lead, '').trim(), it.why.next || ''].filter(Boolean).join(' ');
   return `<button type="button" class="td-row td-item rise" data-card aria-expanded="false" style="animation-delay:${240 + i * 60}ms">
    <span class="td-k">${KIND[it.kind]}<b>${it.minutes}분</b></span><span class="td-body"><h3>${esc(it.title)}</h3><p class="td-why">${tail(lead, '<span class="td-tog" aria-hidden="true"><span class="o">자세히</span><span class="c">접기</span></span>')}</p>
    <span class="td-more"><span>${rest ? `<span class="td-rest">${yo(rest)}</span>` : ''}<span class="td-proof">${esc(proof(it))}</span></span></span></span></button>`;
  }).join('');
  // 걸리는 시간은 단추 한 곳에만(11-16 카본: 칸 머리와 단추에 「5분」이 겹쳤다).
  // 단추는 종이 아래의 어두운 장면이 드러난 자리다 — 누르면 이 종이가 들려 그 어둠이 장면이 된다(11-18, 둥근 검정 단추를 버림).
  return `${band(day)}<article class="td-sheet td-today td-into-sheet"><div class="td-l">${dateHead(day)}${say}</div>
   <div class="td-r"><p class="td-sec td-lead rise" style="animation-delay:200ms"><span>${resume ? '남은 것' : '오늘 할 것'}</span></p><div class="td-list">${rows}</div>
   <div class="td-foot td-into rise" style="animation-delay:${300 + t.items.length * 60}ms"><button type="button" class="td-go" data-go>${resume ? '이어서' : '오늘 시작'}<span class="td-m">${t.minutes}분</span><span class="td-arr"></span></button></div></div></article>`;
 }
 function viewAfter(a) {
  const day = dayStart(Date.now());
  // 다음에 할 것은 날짜(일력의 다음 장)로 묶는다. 3일 규칙으로 다시 나오는 날이 섞이면 칸 이름은 「다음에 할 것」이다.
  const pages = [];
  for (const x of a.tomorrow) {
   const k = x.date ? `${x.date.year}-${x.date.month}-${x.date.day}` : x.when;
   let p = pages.find((q) => q.k === k);
   if (!p) pages.push(p = { k, date: x.date || null, when: x.when, items: [] });
   p.items.push(x);
  }
  const tmHead = a.tomorrow.every((x) => x.when === '내일') ? '내일 할 것' : '다음에 할 것';
  const next = pages.length ? `<section class="td-next rise" style="animation-delay:${260 + a.changed.length * 70}ms"><p class="td-sec"><span>${tmHead}</span></p>
   ${pages.map((p) => `<div class="td-pg"><span class="td-pd">${p.date ? `${p.date.day}<small>${WD[p.date.weekday]}</small>` : esc(p.when)}</span><span class="td-pt">${p.items.map((x) => `<span>${esc(x.title)}</span>`).join('')}</span></div>`).join('')}</section>` : '';
  const changed = a.changed.length
   ? `<p class="td-sec rise" style="animation-delay:120ms"><span>오늘 달라진 것</span></p>${a.changed.map((c, i) => `<div class="td-chg rise" style="animation-delay:${180 + i * 70}ms"><p class="td-k">${yo(c.what)}</p><p class="td-was">${esc(c.before)}</p><p class="td-now" style="--d:${520 + i * 160}ms">${esc(c.after)}</p></div>`).join('')}`
   : `<p class="td-sec rise" style="animation-delay:120ms"><span>오늘 기록</span></p><p class="td-why rise" style="animation-delay:180ms">오늘 한 것이 기록에 남았어요.</p>`;
  // 끝 화면의 단추는 종이 위의 마지막 줄이다 — 누르면 이 장을 뜯는다(어두운 장면으로 가는 단추가 아니라 종이색 · 윗변 먹줄).
  const close = `<div class="td-foot td-turn rise" style="animation-delay:${320 + a.changed.length * 70}ms"><button type="button" class="td-go" data-close>오늘은 여기까지<span class="td-m">이 장 뜯기</span><span class="td-arr"></span></button></div>`;
  // 뜯으면 보이는 다음 장 — 다음에 할 것의 첫 날짜(없으면 내일), 태오의 한마디, 그날 할 것, 드라마로 가는 길.
  const first = pages[0];
  // 연도까지 계획이 준다 — 12월 31일의 「내일」은 다음 해 1월 1일이다(11-16 GPT 검수 GA1).
  const nd = first?.date ? new Date(first.date.year, first.date.month - 1, first.date.day, 12) : new Date(day + 864e5);
  const under = `<article class="td-sheet td-under" aria-hidden="true" inert data-ym="${nd.getFullYear()}|${nd.getMonth() + 1}"><div class="td-l">${dateHead(nd.getTime())}${sayBlock(a.line, { delay: 0 })}</div>
   <div class="td-r">${first ? `<p class="td-sec"><span>${first.when === '내일' ? '내일 할 것' : `${first.when}에 할 것`}</span></p><div class="td-list">${first.items.map((x) => `<div class="td-row"><span class="td-k">${NEXT_KIND[x.kind]}</span><h3>${esc(x.title)}</h3></div>`).join('')}</div>` : ''}
   <div class="td-foot td-turn"><button type="button" class="td-go" data-episode>드라마 처음 화면<span class="td-arr"></span></button></div></div></article>`;
  return `${band(day)}<div class="td-stack">${under}<article class="td-sheet td-top"><div class="td-l">${dateHead(day, { sub: '오늘 공부 끝', done: true, small: true })}${next}</div><div class="td-r">${changed}${close}</div></article></div>`;
 }
 return show();
}

/* ── 글 도우미 ── */
const WD = '일월화수목금토';
// 다음 장(내일 이후)의 칸 이름 — 「오늘 공부」는 내일 장에 맞지 않는다(11-16 카본: 「내일 · 오늘 공부」가 어색했다).
const NEXT_KIND = { again: '복습', new: '새 상황', check: '점검' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// 「요」 한 글자는 낫표로 묶는다 — 따옴표 속 '요'만(11-16 카본 맹검: 노란 바탕은 군더더기로, 11-14 그림 검수: 따옴표는 좌우가 벌어져 보였다).
const yo = (s) => esc(s).replace(/&#39;요&#39;/g, '<em class="td-yo">「요」</em>');
// 이유 문장의 마지막 낱말과 「자세히」를 한 덩이로 묶는다 — 줄바꿈에 따라 「자세히」만 홀로 다음 줄에 떨어지지 않게(11-18 맹검 2차).
// tail과 words는 시험(tests/drama-today.test.mjs)이 경계 사례를 보려고 내보낸다.
export const tail = (s, after) => { const t = String(s ?? '').trim(); const k = t.lastIndexOf(' '); return k < 0 ? `<span class="td-end">${yo(t)} ${after}</span>` : `${yo(t.slice(0, k))} <span class="td-end">${yo(t.slice(k + 1))} ${after}</span>`; };
// 태오의 말은 문장마다 새 줄에서 시작하고, 쉼표로 나뉜 짧은 마디(12자 이하)는 한 줄 안에 붙여 둔다 — 「오늘 한 번 / 더 해요」처럼
// 마디 가운데서 끊기지 않게(11-18 GPT 맹검: 말을 빠듯한 폭에 밀어 넣어 줄바꿈이 설계되지 않았다). 낱말은 하나씩 떠오른다.
export const words = (s) => {
 let i = 0;
 const w = (x) => `<span class="w" style="animation-delay:${160 + i++ * 60}ms">${yo(x)}</span>`;
 return String(s).trim().split(/(?<=[.?!])\s+/).map((sent) => `<span class="s">${sent.split(/(?<=,)\s+/).map((cl) => {
  const ws = cl.split(' ').map(w).join(' ');
  return [...cl].length <= 12 ? `<span class="cl">${ws}</span>` : ws;
 }).join(' ')}</span>`).join(' ');
};
function css() {
 if (document.querySelector('link[data-today]')) return Promise.resolve();
 return new Promise((res) => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./today.css', import.meta.url).href; l.dataset.today = '1'; l.onload = l.onerror = res; document.head.append(l); });
}
