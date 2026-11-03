// 주문 폭주 — 화면과 흐름. 주문·판정·점수는 core.mjs, 학습 기록·순간 맞춤은 learning.mjs(아틀라스), 컵 작업대는 stage.mjs, 손님·컵 이름은 cafe.mjs.
// 손님 한 명: 손님이 와서 한국어로 주문한다(듣는 동안 영업 시간이 멈춘다) → 말풍선에 다시 듣기·글로 보기 → 재료를 눌러 컵에 담고 서빙
// → 맞으면 말풍선에 체크 배지와 점수, 손님이 받아 가고 다음 손님 / 다르면 손님이 무엇이 다른지 말해 주고, 고쳐서 다시 서빙한다.
// 한가한 오픈은 주문 8개(시간 제한 없음), 점심 러시는 90초(손님이 줄을 서고 기다리다 떠난다). 끝까지 마친 판만 공통 코인을 받는다.
import { CafeSession, ORDERS, REVIEW, DELAYED_ORDERS, makeCup, editCup, describeCup, judgeOrder } from './core.mjs';
import {
  orderMetadata, chooseOrder, orderAnswer, FLOW_RUSH, FLOW_PRACTICE, FLOW_SKILLS, FLOW_WORDS, tuningFrom, chooseOrderLive,
  pressureOf, describeChanges, easierSuggestion, closingObservation, assignmentOrders, orderTargetLabel, delayedOrders,
} from './learning.mjs';
import { CafeStage, FlatStage } from './stage.mjs';
import { CafeAudio } from './audio.mjs';
import { customerOf, customerName, cupLabel } from './cafe.mjs';
import { $, $$, el, esc, preloadImages, bindSoundToggles } from './kit/lab.mjs';

// Restore the verified account before reading progress or enabling play.
await globalThis.SynkPlayAccount.ready();
const progressStorage = globalThis.SynkPlayAccount.storage();
// ── WORLD 안(2026-11-03 캠퍼스 판): world-host.js가 붙인 data-host=world일 때만 실사 손님(world-cast.mjs) · 문구 · 결과 「우리 동네로」.
// LAB 화면(펠트 동물 · 몽글)은 그대로다 — 손님 파일도 WORLD에서만 불러온다.
const WORLD = globalThis.document?.documentElement?.dataset?.host === 'world';
const cast = WORLD ? await import('./world-cast.mjs') : null;
// 2판(11-03): 사건마다 소리 · 음악 · 움직임은 world-play.mjs가 맡는다. 앱 「효과음 · 진동」 설정도 거기서 같은 열쇠로 읽는다 —
// brand-opening/world-sound.mjs는 들이지 않는다(첫 손짓에 오디오 문맥을 하나 더 만들어 첫 탭이 0.5초 멈췄다, 11-03 추적).
const worldPlay = WORLD ? await import('./world-play.mjs') : null;

const QA = new URLSearchParams(location.search).has('qa');
const reduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const announce = (text) => { const n = $('#sr-live'); n.textContent = ''; requestAnimationFrame(() => { n.textContent = text; }); };
const punch = (node) => { if (!node) return; node.classList.remove('punch'); void node.offsetWidth; node.classList.add('punch'); };
// 공통 코인 스크립트(collection.js)를 읽지 못했으면 코인 줄을 숨긴다(모듈은 본문 끝 스크립트 뒤에 돈다).
if (!globalThis.SynkPlayCollection) for (const n of $$('.synk-collection-line')) n.hidden = true;

/* ── 아틀라스: 공통 학습 기록과 다음 주문 고르기 ── */
let coach = null, learningFailed = false, nextPlan = null, audioTicket = null;
try { coach = globalThis.SynkLearning?.createGame({ gameId: 'order-rush', storage: localStorage, followups:true }) || null; } catch { learningFailed = true; }
// 저장 차례를 기다리는 STORAGE_BUSY(WORLD 과제 실행 중 호스트가 던진다)는 영구 실패가 아니다.
let hostStorageBusy = false;
function noteLearningError(error) { if (error?.code === 'STORAGE_BUSY') hostStorageBusy = true; else learningFailed = true; }
// 요약 읽기가 된 것만으로는 차례가 돌아왔다고 보지 않는다: 쓰기 성공이나 요약의 저장 상태(storageStatus)로만 대기를 푼다.
function learn(method, ...args) { try { const value = coach?.[method](...args); if (method !== 'summary') hostStorageBusy = false; return value; } catch (error) { noteLearningError(error); return null; } }
const assignment = () => { try { return coach?.assignment?.() || null; } catch { return null; } };
// SYNK WORLD 안에서는 기록이 계정의 것이다: 이 브라우저가 아니라 계정에서 보관하고 지운다.
const hosted = (() => { try { return typeof coach?.assignment === 'function'; } catch { return false; } })();

/* ── 아틀라스 순간 맞춤: 손님 속도·주문 종류를 이 사람에 맞춘다(입구에서 끌 수 있다) ── */
const FLOW_KEY = 'synk.order-rush.flow-mode';
let live = null, flowStart = null, flowSpec = null, flowTimer = 0;
function flowMode() { try { return progressStorage.getItem(FLOW_KEY) === 'fixed' ? 'fixed' : 'auto'; } catch { return 'auto'; } }
function setFlowMode(mode) { try { progressStorage.setItem(FLOW_KEY, mode); } catch { /* 이번 페이지에서만 */ } renderFlowChoice(); }
function renderFlowChoice() {
  const auto = flowMode() === 'auto', b = $('#flow-toggle');
  b.setAttribute('aria-pressed', String(auto));
  b.textContent = auto ? '나에게 맞춘 속도 켜짐' : '나에게 맞춘 속도 꺼짐';
  $('#flow-note').textContent = auto ? '내가 하는 걸 보고 손님 속도와 주문이 달라져요.' : '늘 같은 속도로 영업해요.';
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
    live = coach.live(flowSpec, { skillIds: FLOW_SKILLS, responseFormat: 'cup-compose', declared: flowMode() === 'fixed' ? { mode: 'fixed' } : {}, words: FLOW_WORDS });
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
/* 저장 상태는 알림 종류로 굳히지 않고 엔진의 지금 상태에서 읽는다: 기록을 못 읽은 저장소도 storage-ready를 보내고, 쓰기 실패는 다음 쓰기가 되면 append로만 풀린다. */
const storagePort = (() => { try { return typeof coach?.syncPort?.subscribe === 'function' ? coach.syncPort : null; } catch { return null; } })();
let storageView = null, storageCheckQueued = false, storageReadyPending = false;
function storageStatus(s) {
  if (!coach || learningFailed) return 'failed';
  // 엔진은 차례를 잃으면 쓰기를 막고 available을 false로 내리므로 true는 회복 신호다. 경고가 따로 있으면 그 경고로 대기와 저장 실패를 가른다.
  if (s?.storage?.available === true) { hostStorageBusy = false; return 'ready'; }
  if (hostStorageBusy && !s?.storage?.warning) return 'waiting';
  if (s?.storage?.available !== false) return 'ready';
  // Web Locks가 없는 환경은 차례가 오지 않는다. syncPort가 없는 호스트는 엔진의 대기 문구로만 구분할 수 있다.
  const waiting = storagePort ? storagePort.canPersist?.() === false : /^다른 탭에서/.test(s.storage.warning || '');
  return waiting && globalThis.navigator?.locks ? 'waiting' : 'failed';
}
function learningCopy() {
  const target = assignment();
  if (target) return orderTargetLabel(target);
  const s = learn('summary');
  storageView = storageStatus(s);
  if (storageView === 'waiting') return '기록을 쓸 수 있을 때까지 기다리는 중이에요. 다른 탭에서 쓰고 있다면 그 탭을 닫아 주세요.';
  if (storageView === 'failed') return s?.storage?.warning || '학습 기록을 저장할 수 없어서 이번에는 기본 주문으로 연습해요.';
  // 근거를 다 받지 못해 엔진이 unseen 기본으로 돌아가면 기록이 적은지도, 기록을 보고 골랐는지도 알 수 없다.
  if (s?.evidenceComplete === false && (nextPlan?.state ?? 'unseen') === 'unseen') return '아직 학습 기록을 다 받지 못했어요. 이번에는 짧은 주문으로 확인해 봐요.';
  const basis = hosted ? 'WORLD 계정의 연습 기록을 보고 골랐어요.' : '이 브라우저에 남은 연습 기록을 보고 골랐어요.';
  const missed = missedChangeSource(s);
  if (missed) return `${missed}에서 빼거나 바꿔 달라는 요청을 놓친 적이 있어요. ${basis}`;
  const reason = nextPlan?.reason || '아직 안 들어 본 주문 표현부터 들어 봐요.';
  return isFirstPractice(s) ? reason : `${reason} ${basis}`;
}
// 답한 주문이 하나도 없으면 기록을 보고 고른 것이 아니다.
function isFirstPractice(s) { return s?.evidenceComplete === true && s?.counts?.attempts === 0 && nextPlan?.state === 'unseen'; }
// 고른 능력·상태와 그 칸의 최근 독립 오답(엔진의 practice: 3개 이상 중 2개 이상)이 모두 맞을 때만 오답을 말한다.
// 듣기 근거는 게임끼리 공유하고 접어 둔 기록은 출처를 알 수 없어, '지난 주문'은 오답 기록이 주문 폭주의 것으로 확인될 때만 쓴다.
function missedChangeSource(s) {
  const plan = nextPlan;
  if (plan?.focusSkillId !== 'ko.listening.negation' || plan.state !== 'practice' || plan.responseFormat !== 'cup-compose') return null;
  const cell = s?.skills?.find((skill) => skill.id === plan.focusSkillId)?.levels?.[plan.selected?.difficulty]?.formats?.['cup-compose'];
  if (!s?.evidenceComplete || cell?.status !== 'practice' || !(cell.incorrect >= 2)) return null;
  try {
    const events = coach.events(), ids = new Set(cell.evidence);
    const tasks = new Map(events.filter((e) => e.type === 'practice.presented').map((e) => [e.id, e.taskId]));
    const own = events.some((e) => e.type === 'practice.attempted' && ids.has(e.id) && e.verdict === 'incorrect' && tasks.get(e.presentationId)?.startsWith('order-rush.'));
    return own ? '지난 주문' : '지난 듣기 연습';
  } catch { return '지난 듣기 연습'; }
}
// 입구에서만 보이는 듣기 안내: 주문을 푸는 중에는 힌트가 되지 않게 멈춤·결과 화면에는 넣지 않는다. 정답이나 말의 위치는 말하지 않는다.
function lobbyTip() {
  if (assignment() || storageView !== 'ready') return '';
  const s = learn('summary');
  if (missedChangeSource(s)) return '이번엔 손님이 무엇을 빼거나 바꿔 달라고 하는지 들어 보세요.';
  return isFirstPractice(s) && nextPlan.focusSkillId === 'ko.listening.detail' && nextPlan.selected?.difficulty === 1
    ? '먼저 기본 주문 하나로, 손님이 어떤 음료를 어떤 온도로 달라고 하는지 들어 보세요.' : '';
}
function updateLearning() {
  const text = learningCopy(), tip = lobbyTip();
  for (const id of ['#game-learning', '#result-learning']) $(id).textContent = text;
  $('#learning-reason').textContent = tip ? `${text} ${tip}` : text;
}
function selectOrder(orders) {
  if (!coach || learningFailed) return orders[0];
  try {
    const plan = live ? chooseOrderLive(live, orders) : chooseOrder(coach, orders);
    if (plan?.selected) { nextPlan = plan; updateLearning(); return plan.selected; }
  } catch (error) { noteLearningError(error); }
  return orders[0];
}
function refreshRecommendation() { if (coach) selectOrder(ORDERS); updateLearning(); refreshDelayed(); }
// 영업 중에는 글만 고친다: live.pick은 순간 맞춤 상태를 건드리고, 다음 손님은 어차피 새로 고른다.
function applyStorageChange() { paintResetNotice(); if (state.screen === 'game') updateLearning(); else refreshRecommendation(); }
// 엔진의 호출 도중에 알림이 올 수 있어 호출이 끝난 뒤 한 번만 읽고, 쓰기마다 다시 그리지 않게 상태가 바뀔 때만 그린다.
// 추천·요약은 읽기뿐이라 기록을 만들지 않고, 여기서 다시 알림이 돌아오지 않는다.
function onStorageEvent(change) {
  if (change?.kind === 'storage-ready') storageReadyPending = true;
  else if (!['storage-wait', 'storage-error'].includes(change?.kind) && storageView === 'ready') return;
  if (storageCheckQueued) return;
  storageCheckQueued = true;
  queueMicrotask(() => {
    storageCheckQueued = false;
    const ready = storageReadyPending, next = storageStatus(learn('summary')), changed = next !== storageView;
    storageReadyPending = false;
    storageView = next;
    if (ready || changed) applyStorageChange();
  });
}
// syncPort를 주지 않는 호스트는 알림이 없어 처음 기다리는 동안만 짧게 다시 본다(입구로 돌아올 때도 다시 읽는다).
function watchHostStorage(checks = 40) {
  if (storagePort || storageView !== 'waiting' || !checks) return;
  setTimeout(() => { applyStorageChange(); watchHostStorage(checks - 1); }, 250);
}
function refreshDelayed(){
 const available=!assignment()&&!learningFailed&&delayedOrders(coach,DELAYED_ORDERS).length>0;
 for(const id of ['#followup-start','#followup-result']){const button=$(id);if(button)button.hidden=!available;}
}
function startDelayed(){const next=!assignment()&&!learningFailed?delayedOrders(coach,DELAYED_ORDERS)[0]:null;if(next)start(false,next);else refreshDelayed();}

/* ── 상태 ── */
const state = {
  screen: 'lobby', mode: 'practice', shift: '한가한 오픈', review: false, session: null, ticket: null, served: null,
  cups: [makeCup()], active: 0, paused: false, celebrating: false, pendingServe: false, frame: 0, last: 0, coinRound: null, original: null,
};
let stage = null, celebrationTimer = 0, leaveTimer = 0, tipTimer = 0, guests = null;
const ticket = () => state.session?.queue.find((t) => t.uid === state.ticket);
/** 말풍선에 보일 손님: 맞게 서빙한 뒤 떠나기 전까지는 그 손님. */
const shownTicket = () => (state.celebrating ? state.served : ticket());
/** 손님 그림: LAB은 주문마다 정한 펠트 동물, WORLD는 지금 줄 · 계산대와 겹치지 않게 고른 실사 손님(표에 worldGuest로 붙는다). */
const guestOf = (t) => (guests ? guests.of(t, [...(state.session?.queue || []), state.served].filter(Boolean)) : customerOf(t.order.id));
const guestName = (t) => (cast ? cast.worldGuestName(t.worldGuest) : customerName(t.order.id));
const guestFace = (t) => (cast ? cast.worldGuestFace(guestOf(t)) : `assets/cast/face/${customerOf(t.order.id)}.webp`);
/** WORLD 손님 표정: order(주문하는 중) · thanks(받아 감) · puzzled(주문과 다름). 계산대에 선 그 손님일 때만 바꾼다. */
function setMood(t, mood) {
  if (!cast || !t?.worldGuest || $('#guest').dataset.uid !== String(t.uid) || t.mood === mood) return;
  t.mood = mood;
  world.face(cast.worldGuestImage(t.worldGuest, mood), mood);   // 두 장을 겹쳐 바꾼다(받음은 서빙 뒤 120ms)
  $('#guest').dataset.mood = mood;
}

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
  world?.voice(status, t);   // WORLD: 음악 · 효과음 덕킹, 목소리 막대, 처음 다 들은 순간
});
const world = worldPlay?.createWorldPlay({ audio, stage: () => stage, cupLabel }) || null;
/** LAB의 짧은 효과음(audio.mjs). WORLD는 같은 자리에서 world-play.mjs가 소리 · 움직임을 낸다. */
const tone = (kind) => { if (!world) audio.tone(kind); };
// 끝까지 들은 뒤의 재생만 다시 듣기다. 첫 재생이 실패했거나 다른 손님을 눌러 끊긴 뒤의 재생은 아직 첫 듣기다.
function playTicket(t) {
  if (!t) return;
  t.chimeHold = false;
  if (!t.presentationId) t.presentationId = presentOrder(t.order);
  if (!audio.isOn()) { if (!t.textShown) showOrderText(t); return; }   // 소리를 꺼 두었으면 주문을 글로(도움으로 남는다)
  if (t.heard) learn('help', t.presentationId, 'replay');
  setMood(t, 'order');   // WORLD: 다시 주문하는 얼굴로
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
  const n = target ? assignmentOrders([...ORDERS, ...REVIEW, ...DELAYED_ORDERS], target).length : 8;
  $('#l-title').innerHTML = target ? `목표 주문 <b>${n}개</b>` : state.mode === 'rush' ? '점심 러시 <b>90초</b>' : '주문 <b>8개</b>';
  renderFlowChoice();
  $('#sound-note').hidden = audio.isOn();
  const warn = !coach ? '학습 기록을 쓸 수 없어서 기본 순서로 진행해요.' : null;
  $('#storage-note').hidden = !warn;
  $('#storage-note').textContent = warn || '';
}
function showLobby() {
  audio.stop();
  world?.lobby();
  switchScreen('lobby');
  refreshRecommendation();
  renderLobby();
}

/* ── 한 판 ── */
function initStage() {
  if (stage) return;
  const theme = WORLD ? 'world' : 'lab';
  try { stage = new CafeStage($('#stage'), selectCup, { reducedMotion: reduced, theme }); }
  catch (error) {
    console.warn('3D 작업대를 만들 수 없어 평면 작업대로 바꿔요.', error?.message);
    const old = $('#stage'), canvas = document.createElement('canvas');
    canvas.id = 'stage';
    canvas.setAttribute('aria-hidden', 'true');
    old.replaceWith(canvas);
    stage = new FlatStage(canvas, selectCup, { theme });
  }
}

function start(isReview = false, delayed = null) {
  if(delayed&&!delayedOrders(coach,DELAYED_ORDERS).some(order=>order.id===delayed.id)){refreshDelayed();return;}
  const target = assignment(), targetDeck = target ? assignmentOrders([...ORDERS, ...REVIEW, ...DELAYED_ORDERS], target) : null;
  if(delayed&&target)return;
  if (target && !targetDeck.length) { $('#learning-reason').textContent = '과제 주문을 불러오지 못했어요. WORLD에서 다시 열어 주세요.'; return; }
  if (target) { state.mode = 'practice'; isReview = false; }
  if(delayed){state.mode='practice';isReview=true;}
  clearResetNotice();
  audio.stop();
  clearTimeout(celebrationTimer); clearTimeout(leaveTimer);
  Object.assign(state, { celebrating: false, pendingServe: false, review: isReview, paused: false, ticket: null, served: null, cups: [makeCup()], active: 0 });
  audioTicket = null;
  startLive(isReview);
  const seed = Date.now() >>> 0;
  guests = cast ? cast.createGuestPicker(seed) : null;
  state.session = new CafeSession(isReview ? 'practice' : state.mode, seed, {
    deck: delayed?[delayed]:targetDeck || (isReview ? REVIEW : ORDERS), selectOrder: coach ? selectOrder : null,
    orderLimit: delayed?1:targetDeck?.length || (isReview ? REVIEW.length : 8), tuning: live ? tuningFrom(live.settings().values) : null,
  });
  // 공통 코인(play-common): 이 판의 번호. 끝까지 마친 본 영업(8개·점심 러시)만 받는다 — 처음으로 나가거나 3개짜리 새 주문 연습은 받지 않는다.
  // 코인은 학습 기록에 쓰지 않는다.
  state.coinRound = isReview ? null : globalThis.SynkPlayCollection?.roundId('order-rush') || null;
  state.shift = delayed?'며칠 뒤 주문 확인':target ? '나의 목표 주문' : isReview ? '새 주문 연습' : state.mode === 'rush' ? '점심 러시' : '한가한 오픈';
  $('#pause-kicker').textContent = `PAUSED · ${state.mode === 'rush' && !isReview ? 'LUNCH RUSH' : 'OPEN'}`;
  audio.unlock();
  world?.start(state.mode === 'rush' && !isReview ? 'rush' : 'calm');
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
  // WORLD: 손님이 들어오며 울린 문 종이 첫 음절을 덮지 않게 320ms 뒤에 말한다(그사이 멈추면 이어 할 때 말한다)
  if (world) t.chimeHold = true;   // 그 320ms는 듣는 시간처럼 영업 시간을 세우지 않는다
  if (world) world.later(world.chimeDelay(), () => { if (!t.chimeHold || ticket() !== t || state.screen !== 'game' || state.celebrating) return; if (state.paused) t.pendingVoice = true; else playTicket(t); });   // 그사이 손님을 눌러 이미 말했으면(chimeHold 풀림) 처음부터 다시 말하지 않는다
  else playTicket(t);
  metrics();
}

/** 계산대의 손님: 바뀌면 한 번 들어온다(반복 움직임 없음). */
function showGuest(t) {
  const g = $('#guest');
  if (!t) {
    const hide = () => { g.hidden = true; g.dataset.uid = ''; $('#bubble').hidden = true; };
    if (world && !g.hidden && g.dataset.uid) { g.dataset.uid = ''; world.hideGuest(hide); } else hide();   // WORLD: 200ms에 걸쳐 사라진다
    return;
  }
  if (g.dataset.uid !== String(t.uid)) {
    const wasShown = !g.hidden && !!g.dataset.uid;   // WORLD: 앞 손님 위로 새 손님이 스며든다
    g.dataset.uid = String(t.uid);
    g.hidden = false;
    if (cast) {
      // WORLD: 얼굴 두 장 · 오른쪽에서 제자리 · 손님마다 다른 문 종(world-play.mjs)
      const id = guestOf(t);
      t.mood = 'order';
      g.dataset.mood = 'order';
      world.guest(t, id, cast.worldGuestImage(id, 'order'), guestName(t), wasShown);
      world.warm(['thanks', 'puzzled'].map((mood) => cast.worldGuestImage(id, mood)));   // 표정이 바뀔 때 비지 않게 미리 푼다
    } else {
      const img = $('#guest-img');
      img.src = `assets/cast/${customerOf(t.order.id)}.webp`;
      img.alt = guestName(t);
      g.classList.remove('enter', 'leave');
      void g.offsetWidth;
      g.classList.add('enter');
      tone('arrive');
    }
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
  if (world) b.toggleAttribute('data-turn', !thanks && !listening && !!t.heard && !t.note);   // WORLD: 다 들은 뒤 「내 차례」 LED
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
    const face = guestFace(t);
    b.setAttribute('aria-label', `줄 선 ${guestName(t)}: 주문 듣기`);
    b.innerHTML = `<img src="${face}" alt=""><span class="patience" aria-hidden="true"><i></i></span>`;
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
  world?.cups(state.cups, state.active);
}
function ingredient(action) {
  if (state.screen !== 'game' || state.paused || state.celebrating || !ticket()) return;
  const before = state.cups[state.active];
  state.cups[state.active] = editCup(before, action);
  tone('tap');
  renderCups(action);
  world?.ingredient(action, before, state.cups[state.active], $(`[data-ingredient="${action}"]`));
}
function addCup() {
  if (state.paused || state.celebrating || !ticket() || state.cups.length >= 2) return;
  state.cups.push(makeCup());
  state.active = state.cups.length - 1;
  renderCups();
  world?.cup('add');
}
function removeCup() {
  if (state.paused || state.celebrating || !ticket()) return;
  if (state.cups.length > 1) { state.cups.splice(state.active, 1); state.active = 0; } else state.cups[0] = makeCup();
  renderCups();
  world?.cup('remove');
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
    tone('serve');
    world?.correct(t, { combo: state.session.combo });   // WORLD 한 박자: 서빙 소리 → 얼굴 +120 → 맞음 소리 · 점수 굴림 +180(점수를 쓰기 전에 부른다)
    state.celebrating = true;
    state.served = t;
    t.thanks = result.feedback;
    t.note = null;
    setMood(t, 'thanks');
    renderBubble();
    stage?.served();
    $('#bench').classList.add('served');
    const pts = state.session.score - before;
    popScore(pts, state.session.combo);
    punch($('#g-score-wrap'));
    if (state.session.combo >= 2) punch($('#g-combo-wrap'));
    metrics();
    announce(`${result.feedback} ${pts}점.`);
    // 움직임 줄이기: 점수 글자가 움직이지 않으니 조금 더 오래 보인다. WORLD는 한 박자 표(world-play.mjs BEAT)대로
    const wait = world ? world.BEAT.next : reduced() ? 800 : 1100;
    // 손님이 받아 가며 한 번 나간다(LAB 움직임 줄이기에서는 다음 손님으로 바로 바뀐다)
    if (world) leaveTimer = setTimeout(() => { if (state.served === t) world.leave(); }, world.BEAT.leave);
    else if (!reduced()) leaveTimer = setTimeout(() => { if (state.served === t) $('#guest').classList.add('leave'); }, wait - 380);
    celebrationTimer = setTimeout(completeServe, wait);
  } else {
    // 다름: 손님이 무엇이 다른지 말한다(실패음·빨간 표시 없음). 고쳐서 다시 서빙한다.
    tone('wrong');
    world?.differ(t);
    t.note = result.feedback;
    setMood(t, 'puzzled');
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
  world?.metrics(s);
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
  if (!state.paused && !audio.busy && !state.celebrating && !document.hidden && !ticket()?.chimeHold) {
    const before = queueKey(), cur = state.ticket, line = world ? [...state.session.queue] : null;
    state.session.step(dt);
    recordUnanswered();
    if (state.session.done) { finish(); return; }
    if (before !== queueKey()) {
      const gone = line?.find((x) => !state.session.queue.includes(x));
      if (gone) world.left(gone);   // WORLD: 기다리다 떠난 손님의 문 종을 작게
      const left = cur != null && !ticket();   // 지금 손님이 기다리다 떠났다
      if (left) audio.stop();
      updateQueue();
      if (left) { announce('손님이 기다리다 떠났어요.'); if (!ticket()) tip('손님이 기다리다 떠났어요. 다음 손님을 기다리는 중이에요.'); }
    }
    metrics();
  }
  if (!state.paused && !document.hidden) stage?.render(dt);
  world?.frame();
  state.frame = requestAnimationFrame(tick);
}

/* ── 멈춤 ── */
function pause() {
  if (state.screen !== 'game' || state.paused) return;
  state.paused = true;
  audio.pause();
  world?.pause();
  if (!$('#pause-dialog').open) $('#pause-dialog').showModal();
}
function resume() {
  state.paused = false;
  if ($('#pause-dialog').open) $('#pause-dialog').close();
  state.last = performance.now();
  world?.resume();
  if (state.pendingServe) { completeServe(); return; }
  if (audio.isOn()) { audio.resume(); if (audio.busy) world?.voice('playing', audioTicket); } else onSoundOff();   // WORLD: 말하던 음성을 잇는 동안 음악을 다시 내리고 막대를 다시 움직인다
  const cur = ticket();
  if (cur?.pendingVoice) { cur.pendingVoice = false; playTicket(cur); }   // WORLD: 문 종 뒤에 말하려던 사이 멈췄으면 이제 말한다
  renderBubble();
}
/** 처음으로: 끝까지 마치지 않은 판은 결과·코인 없이 입구로. 들었지만 답하지 않은 주문은 응답 없음으로 닫는다(평가하지 않음). */
function quit() {
  if (state.screen !== 'game') return;
  audio.stop();
  world?.quit();
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
  tone('done');
  world?.finish({ records: s.records, firstOk: s.records.filter((r) => r.first === true).length, total: s.records.length, nameOf: guestName });
  $('#r-title').focus({ preventScroll: true });
}

function awardCoins(s) {
  // 완주 15 + 첫 서빙에 맞힌 비율 × 10(다른 게임과 같은 규칙). 손님 수는 이번 판에 온 손님 전부(떠난 손님 포함).
  const round = state.coinRound, total = s.records.length, correct = s.records.filter((r) => r.first === true).length;
  state.coinRound = null;
  $('#r-coins').textContent = '';
  if (!round || !total) { if (state.review && globalThis.SynkPlayCollection) $('#r-coins').textContent = '새 주문 연습에서는 코인을 받지 않아요.'; return; }
  globalThis.SynkPlayCollection?.award({ game: 'order-rush', total, correct, completed: true, automatic: false, roundId: round })
    .then((result) => { $('#r-coins').textContent = globalThis.SynkPlayCollection.rewardText(result); world?.coin(); });
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
  if (!world) for (let i = 0; i < stars; i++) setTimeout(() => audio.tone('star'), 300 + i * 220);   // WORLD는 별 대신 영수증(world-play.mjs)
  if (!WORLD) $('#r-mongle').src = stars >= 2 ? 'kit/brand/mongle-cheer.webp' : 'kit/brand/mongle-smile.webp';   // WORLD에는 몽글이 없다(10-31 ④)
  const notes = [`서빙 점수 ${s.score}점`, `최고 콤보 ${s.best}`, `서빙 완료 ${stats.served}개`];
  if (stats.help) notes.push(`글로 확인한 주문 ${stats.help}개`);
  if (stats.unanswered) notes.push(`답하지 않은 주문 ${stats.unanswered}개`);
  $('#r-note').innerHTML = notes.map((n) => `<span class="nb">${esc(n)}</span>`).join(' · ');   // 항목 안에서는 줄을 바꾸지 않는다
  renderLog(s);
  const entries = [['서빙 점수', `${s.score}점`], ['최고 콤보', String(s.best)], ['서빙 완료', `${stats.served}개 주문`],
    ['첫 서빙 정확도', stats.answered ? `${Math.round(stats.firstCorrect / stats.answered * 100)}%` : '—'],
    ['글로 확인한 주문', `${stats.help} / ${stats.answered}`], ['답하지 않은 주문', `${stats.unanswered}`]];
  $('#result-metrics').replaceChildren(...entries.flatMap(([label, value]) => [el('dt', '', label), el('dd', '', value)]));
  // 다음: 영업 뒤에는 시간 제한 없는 새 주문 3개, 새 주문 연습 뒤에는 다시 영업
  $('#review-start').hidden = state.review;
  const replay = $('#replay');
  replay.className = state.review ? 'felt-cta coral' : 'chip-btn';
  replay.innerHTML = state.review ? '<span>다시 영업하기</span><i class="disc" aria-hidden="true"></i>' : '다시 영업하기';
  $('#r-next-reason').textContent = state.review
    ? '처음 듣는 주문도 만들어 봤어요. 다시 영업하면서 오늘 주문을 이어서 연습해 봐요.'
    : '이번에는 시간 제한 없이 처음 듣는 주문 3개를 만들어 봐요. 새 문장도 알아듣는지 확인해요.';
}

/** 이번 영업의 주문: 들은 주문은 문장·결과·다시 듣기·주문대로 만든 컵, 듣기 전에 떠난 손님은 문장 없이. */
function renderLog(s) {
  const log = $('#r-log');
  if (!s.records.length) { log.replaceChildren(el('li', 'empty', '이번 영업에서는 서빙한 주문이 없어요.')); return; }
  log.replaceChildren(...s.records.map((r) => {
    if (!r.presentationId) {
      const li = el('li', 'skip');
      li.innerHTML = '<span class="mark" aria-label="듣기 전에 떠난 손님">–</span>'
        + '<span class="body"><span class="sent">듣기 전에 떠난 손님</span><small>이 주문은 다음 영업에서 처음 듣게 돼요.</small></span>';
      return li;
    }
    const ok = r.first === true, fixed = r.first === false && r.outcome === 'served';
    const li = el('li', ok ? 'ok' : r.first === false ? 'ko' : 'skip');
    const status = r.first === null ? `답하지 않음${r.outcome === 'missed' ? ' · 기다리다 떠난 손님' : ''}`
      : ok ? '첫 서빙에 맞힘' : fixed ? '고쳐서 서빙' : '주문과 달랐어요 · 서빙하지 못함';
    const mark = ok ? '<img src="kit/felt/badge-check.webp" alt="">' : fixed ? '고침' : '–';
    const info = `${guestName(r)} · ${status}${r.help ? ' · 글로 확인' : ''} · 연습: ${r.order.skill.replaceAll(' · ', '·')}`;
    // 주문대로 만든 컵(펼치면 정답 보기 도움으로 남긴다). 말하지 않은 얼음·설탕은 채점하지 않는다
    const skipped = r.order.cups.some((c) => !('sugar' in c) || !('ice' in c));
    const recipe = r.order.cups.map((c) => describeCup({ ...makeCup(), ...c })).join(' / ') + (skipped ? ' (손님이 말하지 않은 재료는 채점하지 않았어요.)' : '');
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

/* ── WORLD 안: 입구 · 결과 문구, 몽글 걷기, 결과 아래 흰 알약 「우리 동네로」(말의 리듬 WORLD 분기와 같은 꼴) ── */
const WORLD_COPY = [
  ['#lobby .hero-copy>.kicker', 'SYNK TOWN CAFÉ'],
  ['#lobby .hero .lede', '손님 주문을 끝까지 듣고 딱 맞는 음료를 만들어요'],
  ['#lobby .hero .sub', '따뜻하게? 얼음 없이? 두 잔? 싱크타운 카페에 손님이 왔어요. 주문과 다르게 만들면 손님이 어디가 다른지 말해 줘요.'],
  ['#how-title', '하는 법'],
  ['#quit', '게임 처음으로'],
  ['#home', '게임 처음으로'],
];
function setupWorld() {
  for (const [sel, text] of WORLD_COPY) { const n = document.querySelector(sel); if (n) n.textContent = text; }
  for (const n of $$('.hero-mongle,#r-mongle,.hero-guest,.hero-bit')) n.remove();   // 몽글 · 펠트 그림은 앱에 두지 않는다(그림은 world-skin.css의 실사 사진)
  $('.beginner-entry')?.remove();   // 처음 여는 작은 가게(몽글 시범 · 펠트 동물)는 LAB에만 — WORLD의 처음 한국어는 한글 · 드라마가 맡는다
  world.setup();   // 2판: 입구 세 층 · 재료 사진 · 목소리 막대 · 얼굴 두 장 · 영수증 · 멈춤 창 크기
  const bar = document.createElement('div'); bar.className = 'w-room-bar';
  bar.innerHTML = '<button id="w-room" class="felt-cta w-room" type="button"><span>우리 동네로</span><i class="disc" aria-hidden="true"></i></button>';
  bar.firstChild.addEventListener('click', backToRoom); $('#results').append(bar);
}
/** 결과 → 우리 동네: WORLD 홈이 동네로 돌아가기(goTown)를 알면 그걸 부르고, 아니면 게임 창의 닫기(#panel-close)를 누른다(같은 출처 틀). 닿지 않으면 게임 입구로. */
function backToRoom() {
  audio.stop();
  world?.quit();
  try { const town = window.parent?.__synkHome?.goTown; if (town) { town(); return; } const close = window.parent?.document?.getElementById('panel-close'); if (close) { close.click(); return; } } catch { /* 다른 출처 */ }
  showLobby();
}
if (WORLD) setupWorld();

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
$('#followup-start')?.addEventListener('click',startDelayed);
$('#followup-result')?.addEventListener('click',startDelayed);
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
    if (on) { audio.unlock(); tone('tap'); } else onSoundOff();
    world?.sound(on);
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
  $('#learning-scope').textContent = '연습 기록은 WORLD 계정에 이어지고, 공유와 삭제는 WORLD 계정 설정에서 할 수 있어요.';
  $('#result-scope').textContent = '주문 음성은 합성 음성이에요. 학습 효과는 아직 학생들과 확인하지 않았어요. 연습 기록은 WORLD 계정에 이어지고, 공유와 삭제는 WORLD 계정 설정에서 할 수 있어요.';
}
// 지우기 결과는 누른 단추 바로 옆(#learning-scope)에 남긴다: 추천·대기 글이 쓰는 칸이 아니라 덮이지 않고, 화면 읽기는 #sr-live로 듣는다.
const RESET_NOTICE = {
  done: '이 브라우저의 모든 게임 학습 기록을 지웠어요. 공통 코인은 그대로 남아요.',
  busy: '학습 기록을 지우지 못했어요. 다른 탭을 닫고 다시 시도해 주세요.',
  retry: '학습 기록은 아직 지워지지 않았어요. 이제 다시 지울 수 있어요.',
  unsupported: '이 환경에서는 학습 기록을 안전하게 쓸 수 없어 지우지 못했어요. 기록은 그대로 남아 있어요.',
  account: '이 기록은 WORLD 계정에 있어서 여기서는 지우지 않았어요. WORLD 계정 설정에서 지워 주세요.',
  storage: '이 브라우저에 저장하지 못해 학습 기록을 모두 지우지 못했어요. 남은 기록이 있을 수 있으니 저장 공간을 확인하고 다시 시도해 주세요.',
  error: '오류로 학습 기록을 모두 지우지 못했어요. 남은 기록이 있을 수 있으니 새로 고친 뒤 다시 시도해 주세요.',
  unavailable: '학습 기록 기능을 불러오지 못해 지우지 못했어요. 새로 고친 뒤 다시 시도해 주세요.',
};
let resetNotice = null, resetNoticeShown = null, learningScopeText = null;
function resetFailure(error) {
  if (error?.code === 'ACCOUNT_RESET_REQUIRED') return 'account';
  if (error?.code === 'STORAGE_BUSY') return globalThis.navigator?.locks ? 'busy' : 'unsupported';
  return error?.code === 'STORAGE_ERROR' ? 'storage' : 'error';
}
// 대기는 굳히지 않는다: 저장 권한을 얻으면 '다시 지울 수 있어요'로, 다시 잃으면 '다른 탭을 닫고'로 지금 상태를 따른다.
function paintResetNotice(force = false) {
  const text = RESET_NOTICE[resetNotice === 'busy' && storagePort?.canPersist?.() === true ? 'retry' : resetNotice] || null;
  if (!text && !resetNoticeShown) return;
  const scope = $('#learning-scope');
  learningScopeText ??= scope.textContent;
  const notice = document.createElement('strong');
  notice.textContent = text || '';
  if (text) scope.replaceChildren(`${learningScopeText} `, notice); else scope.textContent = learningScopeText;
  if (text && state.screen === 'lobby' && (force || text !== resetNoticeShown)) announce(text);
  resetNoticeShown = text;
}
function showResetNotice(kind) { resetNotice = kind; paintResetNotice(true); }
function clearResetNotice() { resetNotice = null; paintResetNotice(); }
$('#learning-reset').addEventListener('click', () => {
  if (!coach) { showResetNotice('unavailable'); return; }
  if (!window.confirm('같은 주소에서 연 모든 SYNK 게임의 학습 기록을 지울까요? 공통 코인은 그대로 남아요.')) return;
  let outcome;
  try {
    const summary = coach.reset();
    learningFailed = false; nextPlan = null;
    // 엔진이 저장 가능한 상태로 돌아왔고 공유 원장이 실제로 비었을 때만 지웠다고 말한다.
    outcome = summary?.storage?.available !== true ? 'storage' : coach.events().length === 0 ? 'done' : 'error';
  } catch (error) { outcome = resetFailure(error); }
  showResetNotice(outcome);
  refreshRecommendation();
});

try { storagePort?.subscribe(onStorageEvent); } catch { /* 닫힌 게임: 상태는 입구를 그릴 때 읽는다 */ }
refreshRecommendation();
watchHostStorage();
renderLobby();
world?.lobby({ prepare: initStage });   // WORLD: 처음 한 번 — 사진이 그려지고 3D 작업대 · 오디오를 준비한 뒤 제목이 잔 뒤에서 올라온다
// 영업에 쓰는 펠트 그림을 입구에서 미리 받아 두고, 컵 작업대(3D)도 미리 만든다(첫 손님 때 쿠션·재료가 늦게 뜨거나 셰이더 준비로 멈칫하지 않게)
(window.requestIdleCallback || ((fn) => setTimeout(fn, 600)))(() => {
  if (!world) initStage();   // WORLD는 위 lobby가 제목 등장 전에 만든다(셰이더 굽기가 움직임과 겹치지 않게)
  if (cast) world.warm(cast.WORLD_GUESTS.map((g) => cast.worldGuestImage(g.id, 'order')));   // WORLD: 손님 사진을 미리 풀어 둔다(작업대 · 재료 · 마감 사진은 world-play가)
  else preloadImages(['assets/felt/cushion-cream-tile.webp', 'assets/felt/cushion-blush-tile.webp', 'kit/felt/badge-check.webp',
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
    world: () => world?.state() || null,
  };
}
