// 주문 폭주 — 화면과 흐름. 주문·판정·점수는 core.mjs, 학습 기록·순간 맞춤은 learning.mjs(아틀라스), 컵 작업대는 stage.mjs, 손님·컵 이름은 cafe.mjs.
// 손님 한 명: 손님이 와서 한국어로 주문한다(듣는 동안 영업 시간이 멈춘다) → 말풍선에 다시 듣기·글로 보기 → 재료를 눌러 컵에 담고 서빙
// → 맞으면 말풍선에 체크 배지와 점수, 손님이 받아 가고 다음 손님 / 다르면 손님이 무엇이 다른지 말해 주고, 고쳐서 다시 서빙한다.
// 한가한 오픈은 주문 8개(시간 제한 없음), 점심 러시는 90초(손님이 줄을 서고 기다리다 떠난다). 끝까지 마친 판만 공통 코인을 받는다.
import { CafeSession, ORDERS, REVIEW, makeCup, editCup, describeCup, judgeOrder } from './core.mjs';
import {
  orderMetadata, chooseOrder, orderAnswer, FLOW_RUSH, FLOW_PRACTICE, FLOW_SKILLS, FLOW_WORDS, tuningFrom, chooseOrderLive,
  pressureOf, describeChanges, easierSuggestion, closingObservation, assignmentOrders, orderTargetLabel,
} from './learning.mjs';
import { CafeStage, FlatStage } from './stage.mjs';
import { CafeAudio } from './audio.mjs';
import { customerOf, customerName, cupLabel } from './cafe.mjs';
import { $, $$, el, esc, preloadImages, bindSoundToggles } from './kit/lab.mjs';

const QA = new URLSearchParams(location.search).has('qa');
const reduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const announce = (text) => { const n = $('#sr-live'); n.textContent = ''; requestAnimationFrame(() => { n.textContent = text; }); };
const punch = (node) => { if (!node) return; node.classList.remove('punch'); void node.offsetWidth; node.classList.add('punch'); };
// 공통 코인 스크립트(collection.js)를 읽지 못했으면 코인 줄을 숨긴다(모듈은 본문 끝 스크립트 뒤에 돈다).
if (!globalThis.SynkPlayCollection) for (const n of $$('.synk-collection-line')) n.hidden = true;

/* ── 아틀라스: 공통 학습 기록과 다음 주문 고르기 ── */
let coach = null, learningFailed = false, nextPlan = null, audioTicket = null;
try { coach = globalThis.SynkLearning?.createGame({ gameId: 'order-rush', storage: localStorage }) || null; } catch { learningFailed = true; }
function learn(method, ...args) { try { return coach?.[method](...args); } catch { learningFailed = true; return null; } }
const assignment = () => { try { return coach?.assignment?.() || null; } catch { return null; } };
// SYNK WORLD 안에서는 기록이 계정의 것이다: 이 브라우저가 아니라 계정에서 보관하고 지운다.
const hosted = (() => { try { return typeof coach?.assignment === 'function'; } catch { return false; } })();

/* ── 아틀라스 순간 맞춤: 손님 속도·주문 종류를 이 사람에 맞춘다(입구에서 끌 수 있다) ── */
const FLOW_KEY = 'synk.order-rush.flow-mode';
let live = null, flowStart = null, flowSpec = null, flowTimer = 0;
function flowMode() { try { return localStorage.getItem(FLOW_KEY) === 'fixed' ? 'fixed' : 'auto'; } catch { return 'auto'; } }
function setFlowMode(mode) { try { localStorage.setItem(FLOW_KEY, mode); } catch { /* 이번 페이지에서만 */ } renderFlowChoice(); }
function renderFlowChoice() {
  const auto = flowMode() === 'auto', b = $('#flow-toggle');
  b.setAttribute('aria-pressed', String(auto));
  b.textContent = auto ? '나에게 맞춘 속도 켜짐' : '나에게 맞춘 속도 꺼짐';
  $('#flow-note').textContent = auto ? '하는 걸 보고 손님 속도와 주문이 바뀌어요.' : '정해진 속도로 늘 같게 영업해요.';
}
/** 순간 맞춤이 바꾼 것을 카페 말로 한 줄(컵 작업대 위, 잠깐). */
function flowLine(line) {
  const n = $('#flow-line');
  clearTimeout(flowTimer);
  if (!line) { n.hidden = true; n.textContent = ''; return; }
  n.textContent = line.text;
  n.hidden = false;
  flowTimer = setTimeout(() => { n.hidden = true; }, 3200);
}
function startLive(isReview) {
  live = null; flowStart = null; flowSpec = null;
  if (!coach || learningFailed || isReview || typeof coach.live !== 'function') return;
  try {
    flowSpec = state.mode === 'rush' ? FLOW_RUSH : FLOW_PRACTICE;
    live = coach.live(flowSpec, { skillIds: FLOW_SKILLS, declared: flowMode() === 'fixed' ? { mode: 'fixed' } : {}, words: FLOW_WORDS });
    flowStart = live.settings().values;
  } catch { live = null; }
}
function applyFlow(out) {
  if (!out) return;
  if (out.settings && state.session) state.session.tune(tuningFrom(out.settings.values));
  if (out.line) flowLine(out.line);
}
function presentOrder(order) {
  if (live) { try { return live.present(orderMetadata(order)); } catch { live = null; } }
  return learn('present', orderMetadata(order));
}
function answerWithFlow(t, result, flow = {}) {
  if (live) { try { const out = live.answer(t.presentationId, result, flow); applyFlow(out); return out.recorded; } catch { live = null; } }
  return learn('answer', t.presentationId, result);
}
function learningCopy() {
  const target = assignment();
  if (target) return orderTargetLabel(target);
  const s = learn('summary');
  if (!coach || learningFailed || s?.storage?.available === false) return '학습 기록을 저장할 수 없어 이번에는 기본 주문으로 연습해요.';
  return `${nextPlan?.reason || '아직 확인하지 않은 주문 표현부터 만나 봐요.'} ${hosted ? 'WORLD 계정의 연습 기록을 사용해요.' : '이 브라우저의 연습 기록을 사용해요.'}`;
}
function updateLearning() { const text = learningCopy(); for (const id of ['#learning-reason', '#game-learning', '#result-learning']) $(id).textContent = text; }
function selectOrder(orders) {
  if (!coach || learningFailed) return orders[0];
  try {
    const plan = live ? chooseOrderLive(live, orders) : chooseOrder(coach, orders);
    if (plan?.selected) { nextPlan = plan; updateLearning(); return plan.selected; }
  } catch { learningFailed = true; }
  return orders[0];
}
function refreshRecommendation() { if (coach) selectOrder(ORDERS); updateLearning(); }

/* ── 상태 ── */
const state = {
  screen: 'lobby', mode: 'practice', shift: '한가한 오픈', review: false, session: null, ticket: null, served: null,
  cups: [makeCup()], active: 0, paused: false, celebrating: false, pendingServe: false, frame: 0, last: 0, coinRound: null, original: null,
};
let stage = null, celebrationTimer = 0, leaveTimer = 0, tipTimer = 0;
const ticket = () => state.session?.queue.find((t) => t.uid === state.ticket);
/** 말풍선에 보일 손님: 맞게 서빙한 뒤 떠나기 전까지는 그 손님. */
const shownTicket = () => (state.celebrating ? state.served : ticket());

/* ── 소리: 주문 전달과 다시 듣기 ── */
const audio = new CafeAudio((status) => {
  // 끝까지 듣기 전까지는 재생 한 번 한 번이 주문 전달이다. 끝까지 들은 뒤의 재생은 다시 듣기(도움, 시작할 때 기록)이고,
  // 들은 주문을 안 들은 것으로 되돌리지 않는다: 다시 듣는 중에 서빙해도 평가한다.
  const t = audioTicket;
  if (t?.presentationId && !t.heard) {
    if (status === 'playing') t.audioCompleted = false;
    if (status === 'ready') { t.audioCompleted = true; t.heard = true; }
    learn('delivery', t.presentationId, { audio: status === 'ready' ? 'completed' : status === 'error' ? 'failed' : 'pending' });
  }
  if (t) t.voice = status;
  if (t && t === ticket()) renderBubble();
});
// 끝까지 들은 뒤의 재생만 다시 듣기다. 첫 재생이 실패했거나 다른 손님을 눌러 끊긴 뒤의 재생은 아직 첫 듣기다.
function playTicket(t) {
  if (!t) return;
  if (!t.presentationId) t.presentationId = presentOrder(t.order);
  if (!audio.isOn()) { if (!t.textShown) showOrderText(t); return; }   // 소리를 꺼 두었으면 주문을 글로(도움으로 남는다)
  if (t.heard) learn('help', t.presentationId, 'replay');
  t.playCount = (t.playCount || 0) + 1;
  audioTicket = t;
  audio.play(t.order);
}
function showOrderText(t) {
  if (!t.presentationId) t.presentationId = presentOrder(t.order);
  t.textShown = true;
  t.help = true;
  learn('help', t.presentationId, 'text');
  renderBubble();
}
function toggleText() {
  const t = ticket();
  if (!t || state.paused || state.celebrating) return;
  if (t.textShown) { t.textShown = false; renderBubble(); return; }
  showOrderText(t);
}
/** 소리를 끄면: 듣던 주문은 멈추고 글로 보여 준다. */
function onSoundOff() {
  const t = ticket();
  if (!t || state.screen !== 'game') return;
  if (t.voice === 'playing') t.voice = null;
  if (!t.heard && !t.textShown) showOrderText(t); else renderBubble();
}

/* ── 기록: 떠난 손님·결과에 보인 글 ── */
// 서빙하지 못하고 떠난 손님: 언어 오답이 아니라 영업이 빨랐다는 신호다.
function recordUnanswered() {
  for (const t of state.session?.records || []) {
    const close = closingObservation(t);
    if (!close) continue;
    if (close.answer) { answerWithFlow(t, { correct: null, assessable: false, reason: 'unanswered' }, { outcome: close.outcome }); t.learningClosed = true; }
    else { if (live) { try { applyFlow(live.observe({ outcome: close.outcome })); } catch { live = null; } } t.flowClosed = true; }
  }
}
// 결과 목록은 들은 주문의 글을 모두 보여 준다: 글 도움으로 남긴다. 듣기 전에 떠난 손님의 주문은 글도 기록도 없이 둔다(다음에 처음 듣게).
function recordResultText() { for (const t of state.session?.records || []) if (t.presentationId) learn('help', t.presentationId, 'text'); }

/* ── 화면 ── */
function switchScreen(screen) {
  state.screen = screen;
  for (const id of ['lobby', 'game', 'results']) $('#' + id).hidden = id !== screen;
  window.scrollTo({ top: 0, behavior: 'instant' });
}
function tip(text, ms = 0) {
  const n = $('#tip');
  clearTimeout(tipTimer);
  n.hidden = !text;
  if (!text) return;
  n.textContent = text;
  if (ms) tipTimer = setTimeout(() => { n.hidden = true; }, ms);
}

/* ── 입구 ── */
function renderLobby() {
  const target = assignment();
  for (const b of $$('.modes [data-mode]')) {
    b.hidden = !!target && b.dataset.mode !== 'practice';   // WORLD 과제는 한가한 오픈으로만
    b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode));
  }
  $('.modes').classList.toggle('single', !!target);
  const n = target ? assignmentOrders([...ORDERS, ...REVIEW], target).length : 8;
  $('#l-title').innerHTML = target ? `목표 주문 <b>${n}개</b>` : state.mode === 'rush' ? '점심 러시 <b>90초</b>' : '주문 <b>8개</b>';
  renderFlowChoice();
  $('#sound-note').hidden = audio.isOn();
  const warn = !coach ? '학습 기록을 쓸 수 없어 기본 순서로 진행해요.' : null;
  $('#storage-note').hidden = !warn;
  $('#storage-note').textContent = warn || '';
}
function showLobby() {
  audio.stop();
  switchScreen('lobby');
  refreshRecommendation();
  renderLobby();
}

/* ── 한 판 ── */
function initStage() {
  if (stage) return;
  try { stage = new CafeStage($('#stage'), selectCup, { reducedMotion: reduced }); }
  catch (error) {
    console.warn('3D 작업대를 만들 수 없어 평면 작업대로 바꿔요.', error?.message);
    const old = $('#stage'), canvas = document.createElement('canvas');
    canvas.id = 'stage';
    canvas.setAttribute('aria-hidden', 'true');
    old.replaceWith(canvas);
    stage = new FlatStage(canvas, selectCup);
  }
}

function start(isReview = false) {
  const target = assignment(), targetDeck = target ? assignmentOrders([...ORDERS, ...REVIEW], target) : null;
  if (target && !targetDeck.length) { $('#learning-reason').textContent = '지정 주문을 준비하지 못했어요. WORLD에서 다시 열어 주세요.'; return; }
  if (target) { state.mode = 'practice'; isReview = false; }
  audio.stop();
  clearTimeout(celebrationTimer); clearTimeout(leaveTimer);
  Object.assign(state, { celebrating: false, pendingServe: false, review: isReview, paused: false, ticket: null, served: null, cups: [makeCup()], active: 0 });
  audioTicket = null;
  startLive(isReview);
  state.session = new CafeSession(isReview ? 'practice' : state.mode, Date.now() >>> 0, {
    deck: targetDeck || (isReview ? REVIEW : ORDERS), selectOrder: coach ? selectOrder : null,
    orderLimit: targetDeck?.length || (isReview ? REVIEW.length : 8), tuning: live ? tuningFrom(live.settings().values) : null,
  });
  // 공통 코인(play-common): 이 판의 번호. 끝까지 마친 본 영업(8개·점심 러시)만 받는다 — 처음으로 나가거나 3개짜리 새 주문 연습은 받지 않는다.
  // 코인은 학습 기록에 쓰지 않는다.
  state.coinRound = isReview ? null : globalThis.SynkPlayCollection?.roundId('order-rush') || null;
  state.shift = target ? '나의 목표 주문' : isReview ? '새 주문 연습' : state.mode === 'rush' ? '점심 러시' : '한가한 오픈';
  $('#pause-kicker').textContent = `PAUSED · ${state.mode === 'rush' && !isReview ? 'LUNCH RUSH' : 'OPEN'}`;
  audio.unlock();
  switchScreen('game');
  initStage();
  $('#pop').hidden = true;
  tip(null);
  $('#guest').hidden = true;
  $('#guest').dataset.uid = '';
  flowLine(live?.intro().line || null);
  updateQueue(true);
  metrics();
  state.last = performance.now();
  cancelAnimationFrame(state.frame);
  state.frame = requestAnimationFrame(tick);
}

/** 줄을 다시 그리고, 지금 손님이 없으면 맨 앞 손님을 부른다. */
function updateQueue(selectFirst = false) {
  const queue = state.session.queue;
  if ((selectFirst || !ticket()) && queue.length && !state.celebrating) selectTicket(queue[0].uid);
  if (!queue.length && !state.session.done) {
    audio.stop();
    state.ticket = null;
    showGuest(null);
    tip('다음 손님을 기다리는 중이에요.');
  }
  renderLineUp();
}

function selectTicket(uid) {
  if (state.paused || state.celebrating) return;
  const t = state.session.queue.find((x) => x.uid === uid);
  if (!t) return;
  if (uid === state.ticket) { playTicket(t); return; }   // 같은 손님을 다시 누르면 다시 듣기
  const previous = ticket();
  if (previous) { previous.draft = state.cups.map((c) => ({ ...c })); previous.activeCup = state.active; }
  state.ticket = uid;
  state.cups = t.draft?.map((c) => ({ ...c })) || [makeCup()];
  state.active = t.activeCup || 0;
  t.textShown = false;   // 손님을 바꾸면 글은 접는다(다시 보려면 글로 보기)
  t.note = null;
  tip(null);
  showGuest(t);
  renderCups();
  renderLineUp();
  playTicket(t);
  metrics();
}

/** 계산대의 손님: 바뀌면 한 번 들어온다(반복 움직임 없음). */
function showGuest(t) {
  const g = $('#guest');
  if (!t) { g.hidden = true; g.dataset.uid = ''; $('#bubble').hidden = true; return; }
  if (g.dataset.uid !== String(t.uid)) {
    const img = $('#guest-img');
    img.src = `assets/cast/${customerOf(t.order.id)}.webp`;
    img.alt = customerName(t.order.id);
    g.dataset.uid = String(t.uid);
    g.hidden = false;
    g.classList.remove('enter', 'leave');
    void g.offsetWidth;
    g.classList.add('enter');
    audio.tone('arrive');
  }
  renderBubble();
}

/** 말풍선: 듣는 중(점 셋) → 다시 듣기·글로 보기 / 글로 본 주문 / 다르게 만든 조건 / 고마워요(체크 배지). */
function renderBubble() {
  const t = shownTicket(), b = $('#bubble');
  if (!t || state.screen !== 'game') { b.hidden = true; return; }
  b.hidden = false;
  const thanks = state.celebrating ? t.thanks : null;
  const listening = !thanks && t.voice === 'playing' && audio.busy;
  b.classList.toggle('right', !!thanks);
  $('#b-dots').hidden = !listening;
  let cap = '';
  if (thanks) cap = '';
  else if (listening) cap = state.session?.mode === 'rush' ? '주문하는 중이에요 · 듣는 동안 시간은 멈춰요' : '주문하는 중이에요';
  else if (t.voice === 'error') cap = '소리를 재생하지 못했어요. 다시 듣기나 글로 보기를 눌러 주세요.';
  else if (t.note) cap = '';
  else if (!audio.isOn()) cap = '소리를 꺼 두어서 주문을 글로 보여 드려요.';
  else if (!t.textShown) cap = t.heard ? '주문을 다 들었어요. 컵에 담아 주세요.' : '주문을 들어 보세요.';
  $('#b-cap').textContent = cap;
  $('#b-cap').hidden = !cap;
  $('#order-text').textContent = `“${t.order.text}”`;
  $('#order-text').hidden = !t.textShown || !!thanks;
  // 다르게 만든 조건은 손님 말로, 그 아래 할 일 한 줄
  const note = $('#b-note');
  note.hidden = !(thanks || t.note);
  note.classList.toggle('thanks', !!thanks);
  if (thanks) note.textContent = thanks;
  else if (t.note) note.replaceChildren(t.note, el('small', '', '컵을 고쳐서 다시 서빙해 주세요.'));
  $('#b-tools').hidden = !!thanks || (listening && !t.heard);
  $('#listen').hidden = !audio.isOn();
  $('#show-text').setAttribute('aria-pressed', String(!!t.textShown));
  $('#show-text').textContent = t.textShown ? '글 접기' : '글로 보기';
  $('#b-patience').hidden = state.session?.mode !== 'rush' || !!thanks;
  fitBubble();
}
/** 말풍선이 계산대 칸보다 길면 글자만 조금씩 줄인다(작은 화면에서 긴 주문 + 고칠 조건). */
function fitBubble() {
  const b = $('#bubble');
  b.style.removeProperty('--say');
  if (b.hidden) return;
  let size = parseFloat(getComputedStyle($('#order-text')).fontSize) || 18;
  while (b.scrollHeight > b.clientHeight + 1 && size > 12.5) { size -= 0.5; b.style.setProperty('--say', `${size}px`); }
}

/** 줄 선 손님(점심 러시): 계산대 위 작은 종이 표 — 얼굴과 기다림 막대. 누르면 그 손님 주문으로 바꾼다. */
function renderLineUp() {
  const box = $('#queue'), s = state.session;
  const waiting = s ? s.queue.filter((t) => t.uid !== state.ticket) : [];
  box.hidden = !waiting.length;
  box.replaceChildren(...waiting.map((t) => {
    const b = el('button', 'ticket');
    b.type = 'button';
    b.dataset.uid = String(t.uid);
    b.setAttribute('aria-label', `줄 선 ${customerName(t.order.id)}: 주문 듣기`);
    b.innerHTML = `<img src="assets/cast/face/${customerOf(t.order.id)}.webp" alt=""><span class="patience" aria-hidden="true"><i></i></span>`;
    b.onclick = () => selectTicket(t.uid);
    return b;
  }));
  metrics();
}

function selectCup(index) {
  if (state.paused || state.celebrating || index >= state.cups.length) return;
  state.active = index;
  renderCups();
}
/** 컵 탭·컵 이름·재료 쿠션의 눌림 상태를 맞추고 작업대에 보낸다. change: 방금 넣은 재료(붓기·떨어지기). */
function renderCups(change = null) {
  $('#cup-tabs').replaceChildren(...state.cups.map((c, i) => {
    const b = el('button', 'chip-btn cup-tab', `컵 ${i + 1}`);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(i === state.active));
    b.setAttribute('aria-label', `컵 ${i + 1}: ${cupLabel(c)}`);
    b.onclick = () => selectCup(i);
    return b;
  }));
  $('#add-cup').hidden = state.cups.length >= 2;
  $('#remove-cup').textContent = state.cups.length > 1 ? '이 컵 빼기' : '비우기';
  const c = state.cups[state.active];
  $('#bench').classList.toggle('served', state.celebrating);
  $('#cup-description').textContent = state.cups.length > 1 ? `컵 ${state.active + 1} · ${cupLabel(c)}` : cupLabel(c);
  for (const b of $$('[data-ingredient]')) {
    const k = b.dataset.ingredient;
    const on = k === 'coffee' || k === 'tea' ? c.base === k : k === 'cold' ? c.temp === 'cold' : c[k];
    b.setAttribute('aria-pressed', String(!!on));
  }
  stage?.sync(state.cups, state.active, change);
}
function ingredient(action) {
  if (state.screen !== 'game' || state.paused || state.celebrating || !ticket()) return;
  state.cups[state.active] = editCup(state.cups[state.active], action);
  audio.tone('tap');
  renderCups(action);
}
function addCup() {
  if (state.paused || state.celebrating || !ticket() || state.cups.length >= 2) return;
  state.cups.push(makeCup());
  state.active = state.cups.length - 1;
  renderCups();
}
function removeCup() {
  if (state.paused || state.celebrating || !ticket()) return;
  if (state.cups.length > 1) { state.cups.splice(state.active, 1); state.active = 0; } else state.cups[0] = makeCup();
  renderCups();
}

function serve() {
  if (state.screen !== 'game' || state.paused || state.celebrating || !ticket()) return;
  const t = ticket(), judged = judgeOrder(t.order, state.cups);
  const evidence = t.presentationId ? answerWithFlow(t, { ...orderAnswer(judged, t), attemptNo: t.attempts + 1 },
    { pressure: pressureOf(t, state.session), ...(t.audioCompleted === true || t.help ? {} : { outcome: 'void' }) }) : null;
  if (!t.attempts) { t.learningFirstResult = evidence; t.firstErrorKind = judged.correct ? null : judged.kind; }
  const before = state.session.score;
  const result = state.session.submit(t.uid, state.cups);
  if (!result) return;
  if (result.correct) {
    // 맞음: 체크 배지·점수, 컵이 손님 쪽으로 나가고 손님이 받아 간다
    audio.stop();
    audio.tone('serve');
    state.celebrating = true;
    state.served = t;
    t.thanks = result.feedback;
    t.note = null;
    renderBubble();
    stage?.served();
    $('#bench').classList.add('served');
    const pts = state.session.score - before;
    popScore(pts, state.session.combo);
    punch($('#g-score-wrap'));
    if (state.session.combo >= 2) punch($('#g-combo-wrap'));
    metrics();
    announce(`${result.feedback} ${pts}점.`);
    const wait = reduced() ? 800 : 1100;   // 움직임 줄이기: 점수 글자가 움직이지 않으니 조금 더 오래 보인다
    // 손님이 받아 가며 한 번 나간다(움직임 줄이기에서는 다음 손님으로 바로 바뀐다)
    if (!reduced()) leaveTimer = setTimeout(() => { if (state.served === t) $('#guest').classList.add('leave'); }, wait - 380);
    celebrationTimer = setTimeout(completeServe, wait);
  } else {
    // 다름: 손님이 무엇이 다른지 말한다(실패음·빨간 표시 없음). 고쳐서 다시 서빙한다.
    audio.tone('wrong');
    t.note = result.feedback;
    if (t.presentationId) learn('help', t.presentationId, 'hint');
    renderBubble();
    metrics();
    announce(`${result.feedback} 고쳐서 다시 서빙할 수 있어요.`);
  }
  updateLearning();
}
function completeServe() {
  if (state.paused) { state.pendingServe = true; return; }
  state.pendingServe = false;
  state.celebrating = false;
  state.served = null;
  $('#pop').hidden = true;   // 점수 글자는 이 손님과 함께 거둔다(기다림 안내와 겹치지 않게)
  if (state.screen !== 'game') return;
  if (state.session.done) { finish(); return; }
  state.ticket = null;
  state.cups = [makeCup()];
  state.active = 0;
  renderCups();
  updateQueue(true);
}

function popScore(points, combo) {
  const p = $('#pop'), arena = $('#arena').getBoundingClientRect(), bubble = $('#bubble').getBoundingClientRect();
  p.textContent = combo >= 2 ? `+${points} · 콤보 ${combo}` : `+${points}`;
  p.dataset.tier = combo >= 6 ? '3' : combo >= 3 ? '2' : '1';
  const x = bubble.width ? bubble.left - arena.left + bubble.width / 2 : arena.width / 2;
  const y = bubble.height ? bubble.bottom - arena.top + 26 : arena.height / 2;
  p.style.left = `${Math.min(arena.width - 70, Math.max(70, x))}px`;
  p.style.top = `${Math.min(arena.height - 24, y)}px`;
  p.hidden = false;
  p.classList.remove('go');
  void p.offsetWidth;
  p.classList.add('go');
  clearTimeout(popScore.t);
  popScore.t = setTimeout(() => { p.hidden = true; }, 900);
}

function metrics() {
  const s = state.session;
  if (!s) return;
  $('#g-score').textContent = String(s.score);
  $('#g-combo').textContent = String(s.combo);
  $('#g-combo-wrap').dataset.tier = s.combo >= 6 ? '3' : s.combo >= 3 ? '2' : '1';
  if (s.mode === 'rush') { $('#g-count-label').textContent = '시간'; $('#g-count').textContent = String(Math.max(0, Math.ceil(s.tuning.duration - s.time))); }
  else { $('#g-count-label').textContent = '손님'; $('#g-count').textContent = `${Math.min(s.serial, s.orderLimit)} / ${s.orderLimit}`; }
  if (s.mode !== 'rush') return;
  // 기다림 막대: 손님이 기다려 줄 시간이 얼마나 남았는지
  const left = (t) => Math.max(0, 1 - (s.time - t.born) / t.patience);
  for (const b of $('#queue').children) {
    const t = s.queue.find((x) => x.uid === Number(b.dataset.uid));
    if (t) setPatience(b.querySelector('.patience'), left(t));
  }
  const cur = ticket();
  if (cur) setPatience($('#b-patience'), left(cur));
}
function setPatience(node, k) {
  node.style.setProperty('--left', k.toFixed(3));
  node.dataset.level = k < 0.25 ? 'low' : k < 0.5 ? 'mid' : 'ok';
}

const queueKey = () => state.session.queue.map((t) => t.uid).join(',');
function tick(now) {
  if (state.screen !== 'game') return;
  const dt = Math.min(0.1, Math.max(0, (now - state.last) / 1000));
  state.last = now;
  // 영업 시간은 주문을 듣는 동안·멈춤·서빙 축하·다른 탭에서는 흐르지 않는다
  if (!state.paused && !audio.busy && !state.celebrating && !document.hidden) {
    const before = queueKey(), cur = state.ticket;
    state.session.step(dt);
    recordUnanswered();
    if (state.session.done) { finish(); return; }
    if (before !== queueKey()) {
      const left = cur != null && !ticket();   // 지금 손님이 기다리다 떠났다
      if (left) audio.stop();
      updateQueue();
      if (left) { announce('손님이 기다리다 떠났어요.'); if (!ticket()) tip('손님이 기다리다 떠났어요. 다음 손님을 기다리는 중이에요.'); }
    }
    metrics();
  }
  if (!state.paused && !document.hidden) stage?.render(dt);
  state.frame = requestAnimationFrame(tick);
}

/* ── 멈춤 ── */
function pause() {
  if (state.screen !== 'game' || state.paused) return;
  state.paused = true;
  audio.pause();
  if (!$('#pause-dialog').open) $('#pause-dialog').showModal();
}
function resume() {
  state.paused = false;
  if ($('#pause-dialog').open) $('#pause-dialog').close();
  state.last = performance.now();
  if (state.pendingServe) { completeServe(); return; }
  if (audio.isOn()) audio.resume(); else onSoundOff();
  renderBubble();
}
/** 처음으로: 끝까지 마치지 않은 판은 결과·코인 없이 입구로. 들었지만 답하지 않은 주문은 응답 없음으로 닫는다(평가하지 않음). */
function quit() {
  if (state.screen !== 'game') return;
  audio.stop();
  cancelAnimationFrame(state.frame);
  clearTimeout(celebrationTimer); clearTimeout(leaveTimer);
  Object.assign(state, { celebrating: false, pendingServe: false, paused: false, served: null, coinRound: null });
  if ($('#pause-dialog').open) $('#pause-dialog').close();
  state.session.finish();
  recordUnanswered();
  if (live) { try { live.end(); } catch { /* 이어 하기 기억은 편의 */ } }
  live = null;
  flowLine(null);
  showLobby();
}

/* ── 결과 ── */
function finish() {
  if (state.screen !== 'game') return;
  state.session.finish();
  audio.stop();
  cancelAnimationFrame(state.frame);
  clearTimeout(celebrationTimer); clearTimeout(leaveTimer);
  state.celebrating = false;
  state.served = null;
  if ($('#pause-dialog').open) $('#pause-dialog').close();
  recordUnanswered();
  recordResultText();
  const flowEnd = live ? (() => { try { return live.end(); } catch { return null; } })() : null;
  const flowChanges = flowEnd && flowSpec ? describeChanges(flowSpec, flowStart, flowEnd.settings.values) : [];
  const s = state.session, stats = s.stats();
  renderFlowBox(flowEnd, flowChanges, easierSuggestion(flowSpec, flowEnd, stats));
  live = null;
  flowLine(null);
  refreshRecommendation();
  if (!state.review) state.original = { stats, score: s.score, records: s.records.map((r) => ({ ...r })) };
  awardCoins(s);
  renderResults(s, stats);
  switchScreen('results');
  audio.tone('done');
  $('#r-title').focus({ preventScroll: true });
}

function awardCoins(s) {
  // 완주 15 + 첫 서빙에 맞힌 비율 × 10(다른 게임과 같은 규칙). 손님 수는 이번 판에 온 손님 전부(떠난 손님 포함).
  const round = state.coinRound, total = s.records.length, correct = s.records.filter((r) => r.first === true).length;
  state.coinRound = null;
  $('#r-coins').textContent = '';
  if (!round || !total) { if (state.review && globalThis.SynkPlayCollection) $('#r-coins').textContent = '새 주문 연습은 코인 없이 연습해요.'; return; }
  globalThis.SynkPlayCollection?.award({ game: 'order-rush', total, correct, completed: true, automatic: false, roundId: round })
    .then((result) => { $('#r-coins').textContent = globalThis.SynkPlayCollection.rewardText(result); });
}

function renderFlowBox(flowEnd, changes, suggestion) {
  const box = $('#result-flow');
  box.hidden = !flowEnd;
  if (!flowEnd) return;
  const lines = changes.length ? changes : [flowEnd.settings.adaptive === false ? '정해진 속도로 영업했어요.' : '이번 영업은 처음 속도 그대로였어요.'];
  box.querySelector('ul').replaceChildren(...lines.concat(suggestion ? [suggestion] : []).map((text) => el('li', text === suggestion ? 'suggest' : '', text)));
}

function renderResults(s, stats) {
  const total = s.records.length, firstOk = s.records.filter((r) => r.first === true).length;
  const stars = total && firstOk === total ? 3 : firstOk >= total - 2 && total > 2 ? 2 : firstOk >= Math.ceil(total / 2) ? 1 : 0;
  $('#r-kicker').textContent = `주문 폭주 · ${state.shift}`;
  $('#r-title').textContent = state.review ? '연습 끝!' : '영업 끝!';
  $('#r-correct').textContent = String(firstOk);
  $('#r-total').textContent = String(total);
  $('#r-stars').innerHTML = [1, 2, 3].map((i) => `<i class="${i <= stars ? 'on' : ''}" style="animation-delay:${0.3 + (i - 1) * 0.22}s"></i>`).join('');
  $('#r-stars').setAttribute('aria-label', `별 3개 중 ${stars}개`);
  for (let i = 0; i < stars; i++) setTimeout(() => audio.tone('star'), 300 + i * 220);
  $('#r-mongle').src = stars >= 2 ? 'kit/brand/mongle-cheer.webp' : 'kit/brand/mongle-smile.webp';
  const notes = [`서빙 점수 ${s.score}점`, `최고 콤보 ${s.best}`, `서빙 완료 ${stats.served}개`];
  if (stats.help) notes.push(`글로 확인한 주문 ${stats.help}개`);
  if (stats.unanswered) notes.push(`미응답 ${stats.unanswered}개`);
  $('#r-note').innerHTML = notes.map((n) => `<span class="nb">${esc(n)}</span>`).join(' · ');   // 항목 안에서는 줄을 바꾸지 않는다
  renderLog(s);
  const entries = [['서빙 점수', `${s.score}점`], ['최고 콤보', String(s.best)], ['서빙 완료', `${stats.served}개 주문`],
    ['첫 제출 정확도', stats.answered ? `${Math.round(stats.firstCorrect / stats.answered * 100)}%` : '—'],
    ['글로 확인한 주문', `${stats.help} / ${stats.answered}`], ['미응답 주문', `${stats.unanswered}`]];
  $('#result-metrics').replaceChildren(...entries.flatMap(([label, value]) => [el('dt', '', label), el('dd', '', value)]));
  // 다음: 영업 뒤에는 시간 제한 없는 새 주문 3개, 새 주문 연습 뒤에는 다시 영업
  $('#review-start').hidden = state.review;
  const replay = $('#replay');
  replay.className = state.review ? 'felt-cta coral' : 'chip-btn';
  replay.innerHTML = state.review ? '<span>다시 영업하기</span><i class="disc" aria-hidden="true"></i>' : '다시 영업하기';
  $('#r-next-reason').textContent = state.review
    ? '처음 듣는 문장도 만들어 봤어요. 다시 영업하며 오늘 주문을 이어서 연습해요.'
    : '이번에는 시간 제한 없이, 처음 듣는 주문 3개를 만들어 봐요. 새 문장도 이해했는지 확인해요.';
}

/** 이번 영업의 주문: 들은 주문은 문장·결과·다시 듣기·주문대로 만든 컵, 듣기 전에 떠난 손님은 문장 없이. */
function renderLog(s) {
  const log = $('#r-log');
  if (!s.records.length) { log.replaceChildren(el('li', 'empty', '이번 영업에는 제출한 주문이 없어요.')); return; }
  log.replaceChildren(...s.records.map((r) => {
    if (!r.presentationId) {
      const li = el('li', 'skip');
      li.innerHTML = '<span class="mark" aria-label="듣기 전에 떠난 손님">–</span>'
        + '<span class="body"><span class="sent">듣기 전에 떠난 손님</span><small>이 주문은 다음 영업에서 처음 듣게 돼요.</small></span>';
      return li;
    }
    const ok = r.first === true, fixed = r.first === false && r.outcome === 'served';
    const li = el('li', ok ? 'ok' : r.first === false ? 'ko' : 'skip');
    const status = r.first === null ? `미응답${r.outcome === 'missed' ? ' · 기다리다 떠난 손님' : ''}`
      : ok ? '첫 서빙에 맞힘' : fixed ? '고쳐서 서빙' : '조건을 다시 확인 · 서빙 미완료';
    const mark = ok ? '<img src="kit/felt/badge-check.webp" alt="">' : fixed ? '고침' : '–';
    const info = `${customerName(r.order.id)} · ${status}${r.help ? ' · 글로 확인' : ''} · 연습: ${r.order.skill.replaceAll(' · ', '·')}`;
    // 주문대로 만든 컵(펼치면 정답 보기 도움으로 남긴다). 말하지 않은 얼음·설탕은 채점하지 않는다
    const skipped = r.order.cups.some((c) => !('sugar' in c) || !('ice' in c));
    const recipe = r.order.cups.map((c) => describeCup({ ...makeCup(), ...c })).join(' / ') + (skipped ? ' (말하지 않은 재료 조건은 채점에서 제외했어요.)' : '');
    li.innerHTML = `<span class="mark" aria-label="${esc(status)}">${mark}</span>
      <span class="body"><span class="sent">“${esc(r.order.text)}”</span><small>${esc(info)}</small>
      <details class="recipe"><summary>주문대로 만든 컵</summary><p>${esc(recipe)}</p></details></span>`
      + (audio.isOn() ? `<button class="chip-btn say-again" type="button" aria-label="이 주문 다시 듣기: ${esc(r.order.text)}">듣기</button>` : '');
    li.querySelector('details').addEventListener('toggle', (e) => {
      if (e.target.open && !r.answerRevealed) { if (r.presentationId) learn('help', r.presentationId, 'answer'); r.answerRevealed = true; }
    });
    li.querySelector('.say-again')?.addEventListener('click', () => {
      if (!r.replayed) { learn('help', r.presentationId, 'replay'); r.replayed = true; }
      audioTicket = null;
      audio.unlock();
      audio.play(r.order);
    });
    return li;
  }));
}

/* ── 이벤트 ── */
for (const b of $$('.modes [data-mode]')) {
  b.addEventListener('click', () => {
    if (assignment() && b.dataset.mode !== 'practice') return;
    state.mode = b.dataset.mode;
    renderLobby();
  });
}
$('#flow-toggle').addEventListener('click', () => setFlowMode(flowMode() === 'auto' ? 'fixed' : 'auto'));
$('#start').addEventListener('click', () => start());
$('#replay').addEventListener('click', () => { audio.stop(); start(); });
$('#review-start').addEventListener('click', () => { audio.stop(); start(true); });
$('#home').addEventListener('click', () => showLobby());
for (const b of $$('[data-ingredient]')) b.addEventListener('click', () => ingredient(b.dataset.ingredient));
$('#add-cup').addEventListener('click', addCup);
$('#remove-cup').addEventListener('click', removeCup);
$('#serve').addEventListener('click', serve);
$('#listen').addEventListener('click', () => { if (!state.paused && !state.celebrating && ticket()) playTicket(ticket()); });
$('#show-text').addEventListener('click', toggleText);
$('#pause').addEventListener('click', pause);
$('#resume').addEventListener('click', () => { audio.unlock(); resume(); });
$('#quit').addEventListener('click', quit);
$('#pause-dialog').addEventListener('cancel', (e) => { e.preventDefault(); resume(); });
bindSoundToggles({
  isOn: () => audio.isOn(),
  setOn: (on) => {
    audio.setOn(on);
    if (on) { audio.unlock(); audio.tone('tap'); } else onSoundOff();
    $('#sound-note').hidden = on;
    if (state.screen === 'game') renderBubble();
  },
});
const KEYS = { 1: 'coffee', 2: 'tea', 3: 'milk', 4: 'ice', 5: 'sugar', 6: 'cold' };
document.addEventListener('keydown', (e) => {
  if (state.screen !== 'game' || state.paused || e.repeat || e.target.closest?.('input,textarea,select') || e.altKey || e.metaKey || e.ctrlKey) return;
  const key = e.key.toLowerCase(), code = e.code;
  if (key === 'escape') { e.preventDefault(); pause(); return; }
  if (key === 'enter') return;
  // 한글 자판이 켜져 있어도 같은 자리의 키로 듣는다(Q=ㅂ, R=ㄱ)
  const n = /^(?:Digit|Numpad)([1-6])$/.exec(code)?.[1] ?? (KEYS[key] ? key : null);
  if (n) { e.preventDefault(); ingredient(KEYS[n]); }
  else if (code === 'KeyQ' || key === 'q') { e.preventDefault(); addCup(); }
  else if (code === 'KeyR' || key === 'r') { e.preventDefault(); if (ticket() && !state.celebrating) playTicket(ticket()); }
  else if (key === 'backspace') { e.preventDefault(); removeCup(); }
  else if (key === ' ' || code === 'Space') { e.preventDefault(); serve(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && state.screen === 'game' && !state.paused) pause(); });
window.addEventListener('pagehide', () => { audio.stop(); if (state.screen === 'game' && !state.paused) pause(); });
let fitTimer = 0;
window.addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitBubble, 120); });

// 학습 기록 지우기: WORLD 계정이면 계정 설정에서 하므로 숨긴다
$('#learning-reset').hidden = hosted;
if (hosted) {
  $('#learning-scope').textContent = '연습 기록은 WORLD 계정에 이어지고, 공유와 삭제는 WORLD 계정 설정에서 관리해요.';
  $('#result-scope').textContent = '한국어 주문 음성은 합성 음성이에요. 학습 효과는 학생 검증 전이에요. 연습 기록은 WORLD 계정에 이어지고, 공유와 삭제는 WORLD 계정 설정에서 관리해요.';
}
$('#learning-reset').addEventListener('click', () => {
  if (!window.confirm('같은 주소에서 연 모든 SYNK 게임의 학습 기록을 지울까요? 공통 코인은 그대로 남아요.')) return;
  try { coach?.reset(); learningFailed = !coach; nextPlan = null; }
  catch (error) { if (error?.code !== 'ACCOUNT_RESET_REQUIRED') learningFailed = true; }
  refreshRecommendation();
});

refreshRecommendation();
renderLobby();
// 영업에 쓰는 펠트 그림을 입구에서 미리 받아 두고, 컵 작업대(3D)도 미리 만든다(첫 손님 때 쿠션·재료가 늦게 뜨거나 셰이더 준비로 멈칫하지 않게)
(window.requestIdleCallback || ((fn) => setTimeout(fn, 600)))(() => {
  initStage();
  preloadImages(['assets/felt/cushion-cream-tile.webp', 'assets/felt/cushion-blush-tile.webp', 'kit/felt/badge-check.webp',
    'kit/felt/tex-cream.webp', 'kit/felt/tex-coral.webp', 'kit/felt/wide-cream.webp']);
}, { timeout: 2500 });

// 다른 화면(아틀라스 실험실 등)과 확인 도구가 읽는 관찰 창
window.synkCafe = {
  get flow() { return live ? { settings: live.settings(), trace: live.trace() } : null; },
  get tuning() { return state.session ? { ...state.session.tuning } : null; },
  get learning() { return learn('summary'); },
  get current() { const t = ticket(); return t ? { id: t.order.id, presentationId: t.presentationId, audioCompleted: !!t.audioCompleted } : null; },
};

// 시험·확인용(?qa)
if (QA) {
  window.__rush = {
    state: () => {
      const s = state.session, t = shownTicket();
      return {
        screen: state.screen, mode: state.mode, review: state.review, paused: state.paused, celebrating: state.celebrating,
        done: !!s?.done, score: s?.score ?? 0, combo: s?.combo ?? 0, best: s?.best ?? 0, time: s?.time ?? 0, serial: s?.serial ?? 0,
        queue: (s?.queue || []).map((x) => ({ uid: x.uid, id: x.order.id })),
        current: t && { uid: t.uid, id: t.order.id, recipe: t.order.cups.map((c) => ({ ...c })), heard: !!t.heard, audioCompleted: !!t.audioCompleted,
          voice: t.voice || null, textShown: !!t.textShown, help: !!t.help, note: t.note || null, attempts: t.attempts },
        cups: state.cups.map((c) => ({ ...c })), active: state.active,
        records: (s?.records || []).map((r) => ({ id: r.order.id, first: r.first, outcome: r.outcome, help: !!r.help, attempts: r.attempts, heard: !!r.presentationId })),
      };
    },
    finish: () => finish(),   // 확인 도구가 영업을 바로 끝낼 때(예전 ‘영업 마치기’ 자리)
    stage: () => stage,
    sound: (on) => { audio.setOn(on); },
  };
}
