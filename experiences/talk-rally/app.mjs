// 말 랠리 — 화면과 흐름. 구성·점수·공 속도는 core.mjs, 3D 탁구대는 stage.mjs, 공통 학습 기록과 추천은 learning.mjs(아틀라스).
// 한 번 주고받기: 몽글이 말을 시작하면 대답 카드 셋이 나온다 → 말이 끝나는 순간 몽글이 친다 → 카드를 위로 긋거나 누르면 그 칸으로 받아친다
// (멈칫·번쩍임·‘톡’, 맞으면 ‘팅’과 점수, 세 번 연속마다 스매시). 공이 라켓에 닿기 전에 고르면 ‘빠르게!’ 보너스.
// 공은 고를 때까지 기다려 준다(10-03 유호님 「공이 기다려 줘요」): 아직 못 골랐으면 라켓 바로 앞에서 부드럽게 멈추고, 그동안 다시 듣기·글로 보기를
// 쓸 수 있다(도움으로 기록). 시간이 지나 놓치는 일은 없다. 틀린 칸이면 맞는 대답과 이유가 나온다.
import { ITEMS, PRACTICE, SKILL_LABEL, KIND_LABEL } from './content.mjs';
import { shuffled, composeRound, pointsFor, isSmash, scoreRound, flightTime, swipeLane } from './core.mjs';
import { GAME_ID, rankItems, createExchange, skillReport, FLOW_RALLY, FLOW_WORDS, rallyObservation } from './learning.mjs';
import * as sound from './audio.mjs';
import { swingPower } from './sfx.mjs';
import { createStage, LANES, WALL_SRC } from './stage.mjs';
import { fitText, preloadImages } from './kit/lab.mjs';
import { DAILY_KEY, seoulDate, dailyRound, dailyOptions, emptyRecords, normalizeRecords, recordDaily, dailyStatus, recentDays } from './daily.mjs';
import { NARRATION, NARRATION_LINES, resultLine } from './narration.mjs';
import { createGearPanel, DEFAULT_GEAR } from './gear.mjs';

// Restore the verified account before reading progress or enabling play.
await globalThis.SynkPlayAccount.ready();
const progressStorage = globalThis.SynkPlayAccount.storage();

const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const announce = (text) => { const n = $('#sr-live'); n.textContent = ''; requestAnimationFrame(() => { n.textContent = text; }); };
const buzz = (ms) => { try { if (sound.isOn() && navigator.vibrate) navigator.vibrate(ms); } catch { /* 진동 없는 기기 */ } };
const punch = (node) => { if (!node) return; node.classList.remove('punch'); void node.offsetWidth; node.classList.add('punch'); };
const QA = new URLSearchParams(location.search).has('qa');
// 공통 코인 스크립트(collection.js)를 읽지 못했으면 코인 줄을 숨긴다(모듈은 본문 끝 스크립트 뒤에 돈다).
if (!globalThis.SynkPlayCollection) for (const n of document.querySelectorAll('.synk-collection-line')) n.hidden = true;
const impacts = [];   // 확인용(?qa): 받아친 순간의 시각·판정

/* ── 저장: 판 수·연습 여부·천천히 모드·최고 기록. 학습 기록은 아틀라스가 따로 맡는다 ── */
const KEY = 'synk.talk-rally.v1';
let saved = true;
function load() {
  try { const p = JSON.parse(progressStorage.getItem(KEY) || 'null'); if (p && p.v === 1) return p; } catch { saved = false; }
  return { v: 1, plays: 0, practiced: false, slow: false, best: null };
}
const progress = load();
const save = () => { try { progressStorage.setItem(KEY, JSON.stringify(progress)); saved = true; } catch { saved = false; } };
/* ── 하루 도전 기록(이 브라우저, 날짜마다 최고·판 수). 저장이 막혀도 게임은 그대로이고 기록만 남지 않는다 ── */
let dailySaved = true;
function loadDaily() { try { const r = normalizeRecords(JSON.parse(progressStorage.getItem(DAILY_KEY) || 'null')); dailySaved = true; return r; } catch { dailySaved = false; return emptyRecords(); } }
function saveDaily(records) { try { progressStorage.setItem(DAILY_KEY, JSON.stringify(records)); dailySaved = true; } catch { dailySaved = false; } return dailySaved; }
const num = (n) => Number(n).toLocaleString('ko-KR');
const monthDay = (d) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;

/* ── 아틀라스 ── */
let coach = null;
try { coach = window.SynkLearning?.createGame({ gameId: GAME_ID, storage: window.localStorage }) || null; } catch { coach = null; }
const atlas = (fn, fallback = null) => { if (!coach) return fallback; try { return fn(coach); } catch { return fallback; } };

/* ── 상태 ── */
const state = { run: 0, queue: [], index: 0, results: [], rally: 0, score: 0, cur: null, practice: false, paused: false, ranked: null,
  flow: null, tired: false, pausedMs: 0, pausedAt: 0, coinRound: null, mode: 'normal', dailyDate: null };
const live = (run) => run === state.run;
// 순간 맞춤: 공이 오는 시간(= ‘빠르게!’를 받을 시간)만 이 사람에 맞춘다(연습 공 제외). 피곤한 날은 랠리가 이어져도 빨라지지 않는다.
function startFlow() {
  try { state.flow?.end(); } catch { /* 이어 하기 기억은 편의 */ }
  state.tired = atlas((c) => c.today?.() === 'tired', false);
  state.flow = atlas((c) => c.live?.(FLOW_RALLY, { words: FLOW_WORDS }) ?? null);
  return atlas(() => state.flow?.intro().line?.text) || null;
}
function endFlow() { const flow = state.flow; state.flow = null; if (flow) atlas(() => flow.end()); }
const flightScale = () => atlas(() => state.flow?.settings().values.flight, 1) || 1;
/** 한 번 주고받은 결과를 순간 맞춤에 넘긴다. 공이 기다린 뒤에 고르면 압박이 1보다 크다. 바뀐 것이 있으면 한 줄로만 알린다. */
function followFlow(cur, lane) {
  if (!state.flow || !cur?.serveAt || state.practice) return;
  const used = cur.choseAt <= cur.serveAt ? 0 : (cur.choseAt - cur.serveAt - (cur.chosePausedMs - cur.pausedBase)) / cur.flightMs;
  const out = atlas(() => state.flow.observe(rallyObservation({ choice: cur.options[lane], answer: cur.item.answer, used, assisted: !!(cur.replayed || cur.texted) })));
  cur.serveAt = 0;
  if (out?.line) { tip(out.line.text); const run = state.run; setTimeout(() => { if (live(run) && $('#tip').textContent === out.line.text) tip(null); }, 2200); }
}
let stage = null;
// 꾸미기: 공통 코인으로 산 라켓·공의 색(gear.mjs). 무대가 아직 없으면 만들 때 입힌다
let gear = { ...DEFAULT_GEAR };
const gearPanel = createGearPanel({ root: $('#gear'), onGear: (colors) => { gear = colors; stage?.setGear(colors); } });
// 안내 음성(나레이션): 이번 접속에서 들려준 시작 안내(보통 판·하루 도전 각각 한 번)
const heardIntro = new Set();
let lineVoice = null;   // 다시 듣기·천천히 듣기·해설·결과에서 듣는 몽글의 말(한 번에 하나만)
function playLine(item, { slow = false } = {}) { stopLine(); lineVoice = slow ? sound.speakSlow(item) : sound.speak(item); }
function stopLine() { lineVoice?.stop(); lineVoice = null; }

/** 멈춤을 아는 지연: 쉬는 동안은 시간이 흐르지 않고, 판이 바뀌면 취소된다. */
function after(ms, fn) {
  const run = state.run; let left = ms, last = performance.now();
  const tick = () => {
    if (!live(run)) return;
    const now = performance.now(); if (!state.paused) left -= now - last; last = now;
    if (left <= 0) fn(); else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const show = (id) => {
  for (const s of ['lobby', 'game', 'results']) $('#' + s).hidden = s !== id;
  stage?.setActive(id === 'game');
  window.scrollTo(0, 0);
};

/* ── 입구 ── */
function renderLobby() {
  state.run += 1; stopVoices(state.cur); sound.stopNarration(); state.cur = null; stage?.clear(); hideWait(); hideExplain(); renderCards(null);
  state.ranked = progress.plays === 0 ? null : atlas((c) => rankItems(c, ITEMS, { audioAvailable: sound.isOn() }));
  $('#l-reason').textContent = progress.plays === 0 ? '처음이니까 쉬운 말부터 해요. 첫 공은 연습이에요.'
    : state.ranked?.reason ? `${state.ranked.reason} 그 말들을 먼저 넣었어요.` : '새 말을 섞어 한 판을 만들어요.';
  const best = progress.best;
  $('#best-line').hidden = !best; if (best) $('#best-line').textContent = `최고 ${best.score}점 · 랠리 ${best.rally}번`;
  renderDailyLine();
  gearPanel.refresh();   // 한 판 뒤 코인이 늘었으면 살 수 있는 것이 바뀐다
  const warn = atlas((c) => c.summary().storage?.warning) || (!coach ? '학습 기록을 쓸 수 없어 기본 순서로 진행해요.' : null) || (!saved ? '이 브라우저에 진행을 저장할 수 없어요.' : null);
  $('#storage-note').hidden = !warn; $('#storage-note').textContent = warn || '';
  syncToggles();
  show('lobby');
}

/** 입구의 하루 도전 한 줄: 오늘 했는지·오늘 최고·연속 일수(오늘 아직이면 오늘 하면 며칠째인지). */
function renderDailyLine() {
  const today = seoulDate(), st = dailyStatus(loadDaily(), today);
  $('#daily-line').textContent = !dailySaved ? '이 브라우저에 기록을 남길 수 없지만 도전은 할 수 있어요.'
    : st.played ? `오늘 최고 ${num(st.best.score)}점 · ${st.streak}일 연속`
      : st.streak ? `오늘 아직 안 했어요 · 오늘 하면 ${st.streak + 1}일 연속` : '오늘 아직 안 했어요 · 연속 0일';
}

function syncToggles() {
  for (const t of document.querySelectorAll('[data-sound-toggle]')) {
    t.setAttribute('aria-pressed', String(sound.isOn()));
    if (t.hasAttribute('data-sound-label')) t.textContent = sound.isOn() ? '소리 켜짐' : '소리 꺼짐';
  }
  $('#sound-note').hidden = sound.isOn();
  for (const t of [$('#slow-toggle'), $('#slow-toggle-2')]) { t.setAttribute('aria-pressed', String(progress.slow)); t.textContent = progress.slow ? '천천히 모드 켜짐' : '천천히 모드 꺼짐'; }
  const n = $('#narration-toggle'); n.setAttribute('aria-pressed', String(sound.narrationIsOn())); n.textContent = sound.narrationIsOn() ? '안내 음성 켜짐' : '안내 음성 꺼짐';
}

/* ── 한 판 ── */
let stageReady = null;
function ensureStage() {
  if (!stageReady) {
    stageReady = createStage({ host: $('#arena'), overlay: $('#fx'), onBounce, onOpponentHit, onHold, onArrive, onPadLanded, onCaught, onMissed, reducedMotion: reduced })
      .then((s) => { stage = s; s.setGear(gear); return s; })
      .catch((e) => { stageReady = null; throw e; });
  }
  return stageReady.then((s) => { s.setActive(!$('#game').hidden); s.resize(); return s; });
}

/**
 * 한 판 시작. mode 'daily'는 하루 도전: 그날(서울 날짜) 모두에게 같은 12번(daily.mjs — 학습 기록을 읽지 않는다).
 * 연습 공(처음 한 번)·아틀라스 기록·순간 맞춤·공통 코인은 보통 판과 같다.
 */
async function startRound(mode = 'normal') {
  show('game');
  state.run += 1;
  sound.stopNarration();
  const run = state.run;
  const opening = startFlow();
  const daily = mode === 'daily', date = daily ? seoulDate() : null;
  Object.assign(state, { index: 0, results: [], rally: 0, score: 0, cur: null, practice: false, paused: false, mode: daily ? 'daily' : 'normal', dailyDate: date,
    queue: daily ? dailyRound(date) : composeRound(ITEMS, { ranked: state.ranked?.order, firstTime: progress.plays === 0, seed: progress.plays + 1 }) });
  $('.game-title').textContent = daily ? '하루 도전' : '말 랠리';
  // 공통 코인(play-common): 이 판의 번호. 끝까지 마친 판만 받는다(그만두면 받지 않는다). 코인은 학습 기록에 쓰지 않는다.
  state.coinRound = globalThis.SynkPlayCollection?.roundId('talk-rally') || null;
  updateHud(); renderCards(null); tip('공을 준비하고 있어요…', { silent: true });
  await sound.unlock();
  try { await Promise.all([ensureStage(), sound.preloadVoices([PRACTICE, ...state.queue]), sound.preloadNarration(NARRATION_LINES)]); }
  catch {
    renderLobby();
    $('#storage-note').hidden = false;
    $('#storage-note').textContent = '이 브라우저에서는 3D 화면을 만들 수 없어요. 다른 브라우저(크롬·사파리 최신판)로 열어 주세요.';
    return;
  }
  if (!live(run)) return;
  tip(null);
  stage.pause(state.paused);
  // 시작 안내 음성: 이번 접속에서 처음 여는 보통 판·하루 도전에 한 번. 같은 문장을 안내 글로도 보인다. 끝나야 몽글이 말한다(틀 수 없으면 곧바로)
  const intro = daily ? NARRATION.dailyIntro : NARRATION.intro;
  if (!heardIntro.has(intro.id) && sound.canNarrate(intro.id)) {
    heardIntro.add(intro.id);
    tip(intro.text);
    await sound.narrate(intro.id);
    if (!live(run)) return;
    tip(null);
  }
  if (!progress.practiced) { state.practice = true; tip('연습이에요! 공은 고를 때까지 기다려 줘요. 빛나는 카드를 위로 쓸어 올리거나 눌러 보세요.'); }
  else if (opening) { tip(opening); setTimeout(() => { if (live(run) && $('#tip').textContent === opening) tip(null); }, 2600); }
  after(opening && !state.practice ? 1200 : 500, () => nextItem());
}

function updateHud() {
  const n = state.queue.length;
  $('#g-count').textContent = state.practice ? '연습' : `${Math.min(state.index + 1, n)} / ${n}`;
  $('#g-score').textContent = String(state.score);
  $('#g-rally').textContent = String(state.rally);
  $('#g-rally-wrap').dataset.tier = state.rally >= 6 ? '3' : state.rally >= 3 ? '2' : '1';
}

/** 대답 카드 셋(왼쪽부터 칸 1·2·3). null이면 비운다. */
function renderCards(cur) {
  const box = $('#cards'); box.replaceChildren(); box.classList.remove('locked');
  box.hidden = !cur;
  if (!cur) return;
  cur.options.forEach((word, i) => {
    const b = el('button', `card l${i}`); b.type = 'button'; b.dataset.lane = String(i); b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<span class="no" aria-hidden="true">${i + 1}</span><span class="say">${esc(word)}</span>`;
    b.setAttribute('aria-label', `${i + 1}번 대답: ${word}`);
    b.onclick = () => choose(i, { tapped: true });
    if (cur.hint && word === cur.item.answer) b.classList.add('hint');
    box.append(b);
  });
  fitCards();
}

/** 대답 카드 글자 맞춤(키트 fitText): 한 줄에 안 들어가면 쉼표 뒤에서(‘아니요, / 물이 커요.’), 아니면 어절 단위로 고르게 접고,
 *  낱말이 펠트 면보다 길면(‘다녀오겠습니다.’) 그 카드만 글자를 줄인다. 낱말 중간에서 끊지 않는다. */
function fitCards() { for (const b of $('#cards').children) { const say = b.querySelector('.say'); if (say) fitText(say); } }
/** 대답 카드의 펠트 판을 입구에서 미리 받아 둔다. 카드는 첫 공에서야 그려져 그때 받으면 첫 카드가 잠깐 펠트 없이 글자만 보였다
 *  (라피스 위 크림 글자가 바닥에 묻힘 — 10-06 움직임 줄이기 확인에서 찾음). 다 받기 전에는 같은 색 납작한 판으로 보인다(style.css .felt-ready). */
let feltSize = '';
function preloadFelt() {
  const size = matchMedia('(max-width:500px)').matches ? 'phone' : matchMedia('(max-width:700px)').matches ? 'mid' : 'wide';
  if (size === feltSize) return;
  feltSize = size; $('#cards').classList.remove('felt-ready');
  const urls = ['blush', 'butter', 'lapis'].map((c) => `kit/felt/cushion-${c}-${size}.webp`).concat('kit/felt/badge-check.webp');
  preloadImages(urls)
    .then(() => { if (feltSize === size) $('#cards').classList.add('felt-ready'); });
}
// 배경 벽 그림도 입구에서 받아 둔다(카드 펠트를 기다리게 하지 않게 따로). 무대는 이 그림을 받은 뒤에 첫 장면을 그린다(stage.mjs)
preloadImages([WALL_SRC]);
preloadFelt();
let fitTimer = 0;
window.addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(() => { preloadFelt(); fitCards(); }, 120); });
document.fonts?.ready.then(fitCards);

function nextItem() {
  if (!state.practice && state.index >= state.queue.length) return finish();
  const item = state.practice ? PRACTICE : state.queue[state.index];
  if (state.cur?.texted) tip(null);   // 앞의 말을 글로 보여 줬으면 지운다(다음 말이 소리로 나올 때 앞 글이 남지 않게)
  // 하루 도전의 대답 카드 순서는 그날 모두에게 같다(연습 공은 따로 섞는다)
  const options = state.mode === 'daily' && !state.practice ? dailyOptions(item, state.dailyDate) : shuffled(item.options);
  const cur = { item, ex: state.practice ? null : atlas((c) => createExchange(c, item)), options, choice: null,
    phase: 'talk', token: 0, hint: state.practice, waiting: false, quick: false, replayed: false, texted: false };
  state.cur = cur;
  hideExplain(); hideWait(); renderCards(cur); updateHud();
  stage.setLane(null); stage.setFace('talk');
  announce(`${state.practice ? '연습. ' : `${state.index + 1}번째 공. `}몽글이 말해요. 대답: ${cur.options.map((w, i) => `${i + 1} ${w}`).join(', ')}`);
  speakCur(cur);
}

/** 몽글이 말한다. 끝나는 순간 공을 친다. 소리를 꺼 두었으면 말을 글로 보여 준다(그 답은 도움으로 남는다). */
function speakCur(cur) {
  const run = state.run;
  $('#speech').hidden = false;
  if (!sound.isOn()) { cur.ex?.help('text'); cur.texted = true; tip(`몽글: “${cur.item.line}”`, { silent: false }); }
  cur.speech = sound.speak(cur.item, { onEnd: (heard) => {
    if (!live(run) || state.cur !== cur || cur.phase !== 'talk') return;
    $('#speech').hidden = true;
    // 소리가 도중에 끊겨 끝까지 못 들려줬으면(소리 장치 멈춤 등 — audio.mjs VOICE_GUARD) 말을 글로 보여 준다. 그 답은 도움으로 남는다
    if (!heard && sound.isOn() && !cur.texted) { cur.ex?.help('text'); cur.texted = true; tip(`몽글: “${cur.item.line}”`); }
    cur.ex?.heard(heard);
    serve(cur);
  } });
  // 소리를 켰는데도 틀 수 없으면(브라우저가 소리를 막음 등) 말을 글로 보여 준다
  if (sound.isOn() && !cur.speech.heard) { cur.ex?.help('text'); cur.texted = true; tip(`몽글: “${cur.item.line}”`); }
}

function serve(cur) {
  cur.phase = 'flight'; stage.setFace('idle');
  const slow = progress.slow || state.practice;
  // 피곤한 날은 랠리 가속을 쓰지 않는다. 순간 맞춤의 배율은 그 사람의 기본 속도를 맞춘다(연습 공은 맞춤 없이 1.3배 느리게)
  cur.flight = flightTime({ rally: state.tired ? 0 : state.rally, difficulty: cur.item.difficulty, slow }) * (state.practice ? 1.3 : flightScale());
  cur.serveAt = performance.now(); cur.flightMs = cur.flight * 1000; cur.pausedBase = state.pausedMs;
  cur.token = stage.serve({ flight: cur.flight });
  if (cur.choice != null) stage.release(cur.token);   // 몽글이 말하는 중에 이미 골랐으면 공은 기다리지 않고 와서 받아친다
}

/** 대답 고르기(카드 누르기·위로 긋기·숫자 키). 처음 고른 것이 그 공의 대답이다. 공이 기다리고 있었으면 그때 와서 받아친다. */
function choose(lane, { tapped = false, power = 0.5 } = {}) {
  const cur = state.cur;
  if (!cur || state.paused || cur.choice != null || !['talk', 'flight'].includes(cur.phase) || lane == null) return false;
  if (cur.hint && cur.options[lane] !== cur.item.answer) {   // 연습: 맞는 카드만 받는다(빛나는 카드)
    tip('빛나는 카드가 맞는 대답이에요. 그 카드를 골라 보세요.'); return false;
  }
  cur.choice = lane; cur.choseAt = performance.now(); cur.chosePausedMs = state.pausedMs;
  cur.quick = !cur.waiting;   // 공이 라켓 앞에서 기다리기 전에 골랐다
  stopLine(); hideWait();
  const cards = $('#cards'); cards.classList.add('locked');
  for (const b of cards.children) { const on = Number(b.dataset.lane) === lane; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('dim', !on); }
  stage.setLane(lane);
  sound.sfx('swing', { power: tapped ? 0.35 : power, x: 0, to: LANES[lane] * 1.6 });
  if (cur.phase === 'flight') stage.release(cur.token);
  return true;
}

/* ── 무대에서 오는 순간들 ── */
function onOpponentHit({ x }) { sound.sfx('opponent', { power: 0.5 + 0.3 * Math.min(1, state.rally / 6), x }); }
function onBounce({ near, x }) { sound.sfx('bounce', { near, x }); }

/** 아직 고르지 않았는데 공이 라켓 앞에 다 왔다: 공이 느려져 기다린다. 다시 듣기·글로 보기를 꺼내 둔다. */
function onHold(token) {
  const cur = state.cur;
  if (!cur || token !== cur.token || cur.choice != null) return;
  cur.waiting = true;
  showWait(cur);
}

/** 공이 내 라켓에 닿았다(고른 뒤에만 닿는다): 고른 칸으로 받아친다(판정·기록·손맛). */
function onArrive(token) {
  const cur = state.cur;
  if (!cur || token !== cur.token || cur.choice == null) return null;
  cur.phase = 'hit';
  const word = cur.options[cur.choice], correct = word === cur.item.answer;
  const rec = cur.ex?.confirm(word);
  cur.recorded = !!rec && rec.verdict !== 'unassessed';
  followFlow(cur, cur.choice);
  if (correct) state.rally += 1; else state.rally = 0;
  const smash = correct && isSmash(state.rally) && !state.practice;
  const quick = correct && cur.quick && !state.practice;
  const pts = correct && !state.practice ? pointsFor(state.rally, { quick }) : 0;
  sound.sfx('hit', { correct, rally: Math.max(1, state.rally), smash, power: 0.7, x: LANES[cur.choice] * 1.6 });
  buzz(smash ? 26 : correct ? 16 : 10);
  if (QA) impacts.push({ t: performance.now(), verdict: correct ? 'ok' : 'wrong', smash, quick, waited: cur.waiting, lane: cur.choice });
  if (!state.practice) state.results.push({ itemId: cur.item.id, skill: cur.item.skill, choice: word, correct, points: pts, quick, helped: !!(cur.replayed || cur.texted), recorded: cur.recorded });
  if (correct) {
    if (!state.practice) state.score += pts;
    const at = stage.hitPoint();
    if (pts) popText(smash ? `스매시! +${pts}` : quick ? `빠르게! +${pts}` : state.rally >= 2 ? `+${pts} · 랠리 ${state.rally}` : `+${pts}`, at.x, at.y - 40, state.rally, smash ? 'smash' : quick ? 'quick' : '');
    if (smash) after(260, () => sound.play(sound.pick('joy1', 'joy2')));
    else if (quick) after(110, () => sound.play('earn'));   // 빠르게: 받아친 ‘팅’ 뒤에 사운드킷 ‘획득’(픽)
    punch($('#g-rally-wrap'));
  }
  updateHud();
  cur.verdict = correct ? 'ok' : 'wrong'; cur.smash = smash;
  return { lane: cur.choice, verdict: cur.verdict, smash };
}

/** 받아친 공이 대답 칸에 닿았다. 맞으면 칸이 빛나고, 틀리면 맞는 카드를 보이고 이유를 알려 준다(실패음 없음). */
function onPadLanded({ lane, verdict }) {
  const cur = state.cur; if (!cur) return;
  sound.sfx('bounce', { near: 0, x: LANES[lane] });
  const right = cur.options.indexOf(cur.item.answer);
  if (verdict === 'ok') { $('#cards').children[lane]?.classList.add('right'); stage.setFace('happy'); return; }
  $('#cards').children[right]?.classList.add('right'); $('#cards').children[right]?.classList.remove('dim');
  stage.setFace('calm');
  if (state.practice) return;
  after(240, () => sound.play(sound.pick('calm1', 'calm2')));
  after(520, () => showExplain(cur, { chose: cur.options[lane] }));
}

/** 몽글이 맞게 받아친 공을 잡았다 → 다음 말(랠리가 이어진다). */
function onCaught() {
  const cur = state.cur; if (!cur) return;
  cur.phase = 'done';
  if (state.practice) {
    progress.practiced = true; save(); state.practice = false; state.rally = 0;
    // 안내 음성 「좋아요! 이제 시작해요.」가 끝나고(그리고 원래처럼 1.4초가 지나고) 첫 말로. 틀 수 없으면 1.4초만 기다린다
    tip(`${NARRATION.practiceDone.text} 공이 닿기 전에 고르면 ‘빠르게!’ 보너스예요.`);
    const run = state.run;
    let waited = false, said = !sound.canNarrate(NARRATION.practiceDone.id);
    const go = () => { if (waited && said && live(run)) { tip(null); nextItem(); } };
    if (!said) sound.narrate(NARRATION.practiceDone.id).then(() => { said = true; go(); });
    after(1400, () => { waited = true; go(); });
    return;
  }
  after(380, () => { state.index += 1; nextItem(); });
}

/** 만일의 길: 고르기 전에는 공이 라켓에 닿지 않는다. 그래도 놓쳤다면 같은 말을 다시 친다(기록·랠리는 그대로). */
function onMissed(token) {
  const cur = state.cur; if (!cur || token !== cur.token || cur.choice != null) return;
  after(300, () => { if (state.cur === cur && cur.choice == null) serve(cur); });
}

/* ── 공이 기다릴 때: 위쪽에 짧은 안내와 다시 듣기·글로 보기 ── */
function showWait(cur) {
  tip(null);
  const shown = cur.texted;
  $('#wait-line').hidden = !shown; if (shown) $('#wait-line').textContent = `몽글: “${cur.item.line}”`;
  $('#wait-replay').hidden = !sound.isOn(); $('#wait-slow').hidden = !sound.isOn();
  $('#wait-text').hidden = shown;
  $('#wait').hidden = false;
  if (sound.isOn()) sound.prepareSlow(cur.item);
  announce(`공이 기다려요. 천천히 골라도 돼요.${sound.isOn() ? ' 다시 듣기·천천히 듣기' : ''}${shown ? '' : ' 글로 보기'} 단추도 있어요.`);
}
function hideWait() { $('#wait').hidden = true; }
function stopVoices(cur) { cur?.speech?.stop(); stopLine(); }
function replayWaiting(slow) {
  const cur = state.cur; if (!cur || cur.choice != null || state.paused || !cur.waiting) return;
  if (!cur.replayed) cur.ex?.help('replay');   // 천천히 듣기도 ‘다시 듣기’ 도움으로 남긴다
  cur.replayed = true; playLine(cur.item, { slow });
}
$('#wait-replay').onclick = () => replayWaiting(false);
$('#wait-slow').onclick = () => replayWaiting(true);
$('#wait-text').onclick = () => {
  const cur = state.cur; if (!cur || cur.choice != null || !cur.waiting) return;
  if (!cur.texted) cur.ex?.help('text');
  cur.texted = true; showWait(cur);
};

/* ── 해설 ── */
function showExplain(cur, { chose = null } = {}) {
  $('#cards').hidden = true;
  const item = cur.item;
  $('#x-kicker').textContent = `받아친 대답 ‘${chose}’`;
  $('#x-line').textContent = `몽글: “${item.line}”`;
  $('#x-answer').innerHTML = `알맞은 대답: <b>${esc(item.answer)}</b>`;
  $('#x-why').textContent = item.why;
  state.explained = item; $('#x-tools').hidden = !sound.isOn();
  $('#explain').hidden = false;
  $('#btn-next').querySelector('span').textContent = state.index + 1 >= state.queue.length ? '결과 보기' : '다음 공';
  $('#btn-next').focus({ preventScroll: true });
  announce(`${$('#x-kicker').textContent}. 몽글: ${item.line} 알맞은 대답: ${item.answer}. 왜? ${item.why}`);
}
function hideExplain() { $('#explain').hidden = true; }
$('#x-replay').onclick = () => { if (state.explained && !state.paused) playLine(state.explained); };
$('#x-slow').onclick = () => { if (state.explained && !state.paused) playLine(state.explained, { slow: true }); };
$('#btn-next').onclick = () => {
  if ($('#explain').hidden) return;
  stopLine(); sound.play('tap'); hideExplain(); stage.clear();
  state.index += 1; nextItem();
};

function popText(text, x, y, rally = 0, kind = '') {
  const p = $('#pop'), a = $('#arena').getBoundingClientRect();
  p.textContent = text; p.hidden = false; p.dataset.kind = kind;
  p.dataset.tier = rally >= 6 ? '3' : rally >= 3 ? '2' : '1';
  p.style.left = `${x ?? a.width / 2}px`; p.style.top = `${y ?? a.height * 0.6}px`;
  p.classList.remove('go'); void p.offsetWidth; p.classList.add('go');
  clearTimeout(popText.t); popText.t = setTimeout(() => { p.hidden = true; }, 900);
}
function tip(text, { silent = false } = {}) { $('#tip').hidden = !text; if (text) { $('#tip').textContent = text; if (!silent) announce(text); } }

/* ── 결과 ── */
function finish() {
  endFlow();
  state.cur = null; stage.clear(); renderCards(null); tip(null); hideWait();
  stopLine();
  const s = scoreRound(state.results), prevBest = progress.best, daily = state.mode === 'daily';
  progress.plays += 1;
  // 보통 판의 최고 기록과 하루 도전의 날짜별 기록은 따로 둔다(하루 도전은 그날 모두 같은 판이라 그날끼리만 견준다)
  if (!daily && (!progress.best || s.score > progress.best.score)) progress.best = { score: s.score, rally: s.bestRally, correct: s.correct, total: s.total };
  save();
  const dres = daily ? recordDaily(loadDaily(), state.dailyDate, s) : null;
  if (dres) saveDaily(dres.records);
  sound.play('achieve');
  // 완주 15 + 정답 비율 × 10(다른 게임과 같은 규칙). 맞힌 수는 결과 화면 그대로다 — 연습 공은 세지 않는다.
  const coinRound = state.coinRound; state.coinRound = null; $('#r-coins').textContent = '';
  if (coinRound) globalThis.SynkPlayCollection?.award({ game: 'talk-rally', total: s.total, correct: s.correct, completed: true, automatic: false, roundId: coinRound })
    .then((result) => { $('#r-coins').textContent = globalThis.SynkPlayCollection.rewardText(result); });
  // 제목은 결과 안내 음성과 같은 문장(첫 문장은 제목, 나머지는 그 아래 한 줄)
  const tier = resultLine(s.stars);
  $('#r-title').textContent = tier.title; $('#r-say').textContent = tier.say; $('#r-say').hidden = !tier.say;
  $('#r-kicker').textContent = daily ? `말 랠리 · 하루 도전 ${monthDay(state.dailyDate)}${dres.newBest ? ' · 새 최고 기록!' : ''}`
    : prevBest && s.score > prevBest.score ? `말 랠리 · 새 최고 기록! (전 ${prevBest.score}점)` : '말 랠리 · 한 판';
  renderDailyResult(dres, s);
  $('#r-correct').textContent = String(s.correct); $('#r-total').textContent = String(s.total);
  $('#r-stars').innerHTML = [1, 2, 3].map((i) => `<i class="${i <= s.stars ? 'on' : ''}" style="animation-delay:${0.3 + (i - 1) * 0.22}s"></i>`).join('');
  $('#r-stars').setAttribute('aria-label', `별 3개 중 ${s.stars}개`);
  for (let i = 0; i < s.stars; i++) setTimeout(() => sound.sfx('star', { i }), 300 + i * 220);
  // 결과 안내 음성: 성취음·별 뒤에 제목과 같은 문장, 하루 도전에서 그날 기록을 넘었으면 이어서 「오늘 최고 기록이에요!」.
  // 복습의 「듣기」(몽글의 말)나 다음 판·처음으로가 누르는 순간 멈춘다
  const sayLines = [tier.id, ...(dres?.newBest ? [NARRATION.dailyBest.id] : [])];
  after(1050, async () => {
    const run = state.run;
    for (const id of sayLines) { if (!live(run) || $('#results').hidden) return; if (!(await sound.narrate(id))) return; }
  });
  $('#r-mongle').src = s.stars >= 2 ? 'kit/brand/mongle-cheer.webp' : 'kit/brand/mongle-smile.webp';
  const notes = [`점수 ${s.score}점`, `최고 랠리 ${s.bestRally}번`, `빠른 대답 ${s.quick}번`];
  if (s.helped) notes.push(`다시 듣기·글로 보기를 쓴 말 ${s.helped}개`);
  $('#r-note').textContent = notes.join(' · ');
  const log = $('#r-log'); log.textContent = '';
  for (const r of state.results) {
    const item = ITEMS.find((x) => x.id === r.itemId);
    const li = el('li', r.correct ? 'ok' : 'ko');
    const mark = r.correct ? '맞음' : '다시 볼 것';
    li.innerHTML = `<span class="mark" aria-label="${mark}">${r.correct ? '○' : '×'}</span>
      <span class="body"><span class="line">몽글: “${esc(item.line)}”</span><span class="sent">→ <b>${esc(item.answer)}</b></span>
      <small>${esc(KIND_LABEL[item.kind] || '')}${r.correct ? '' : ` · 고른 대답 ‘${esc(r.choice)}’`}${r.quick ? ' · 빠르게' : ''}${r.helped ? ' · 다시 듣기·글로 보기' : ''}</small></span>`
      + (sound.isOn() ? `<button class="chip-btn say-again" type="button" aria-label="몽글의 말 다시 듣기: ${esc(item.line)}">듣기</button>` : '');
    li.querySelector('.say-again')?.addEventListener('click', () => playLine(item));
    log.append(li);
  }
  const next = atlas((c) => rankItems(c, ITEMS, { audioAvailable: sound.isOn() }));
  state.ranked = next;
  renderSkills(next);
  $('#r-next-reason').textContent = nextLine(next);
  $('#r-hub').hidden = !location.pathname.includes('/talk-rally/');
  show('results');
  $('#r-title').focus({ preventScroll: true });
}

/** 하루 도전 결과 판: 오늘 최고(넘었으면 「새 최고 기록!」), 연속 일수, 오늘 몇 번째인지, 최근 7일. 보통 판에서는 숨긴다. */
function renderDailyResult(dres, s) {
  const card = $('#r-daily'), grid = card.closest('.res-grid');
  card.hidden = !dres; grid.classList.toggle('daily-on', !!dres);
  if (!dres) return;
  const date = state.dailyDate, st = dailyStatus(dres.records, date);
  $('#r-daily-best').textContent = `오늘 최고 ${num(dres.best.score)}점`;
  $('#r-daily-new').hidden = !dres.newBest;
  $('#r-daily-note').textContent = [dres.newBest ? `${NARRATION.dailyBest.text} 전 ${num(dres.prevBest)}점 → 이번 ${num(s.score)}점` : `이번 ${num(s.score)}점`,
    `${st.streak}일 연속`, `오늘 ${dres.plays}번째 도전`].join(' · ') + (dailySaved ? '' : ' · 이 브라우저에 기록을 남기지 못했어요');
  const week = $('#r-week'); week.textContent = '';
  for (const d of recentDays(dres.records, date)) {
    const li = el('li', `${d.best != null ? 'done' : 'empty'}${d.today ? ' today' : ''}`);
    li.setAttribute('aria-label', `${monthDay(d.date)} ${d.weekday}요일 · ${d.best != null ? `최고 ${num(d.best)}점` : '안 함'}`);
    li.innerHTML = `<small aria-hidden="true">${d.today ? '오늘' : d.weekday}</small><i aria-hidden="true"></i><b aria-hidden="true">${d.best != null ? num(d.best) : '–'}</b>`;
    week.append(li);
  }
}

function nextLine(next) {
  if (!next?.reason) return '다음 판에는 새 말을 섞어요.';
  const first = ITEMS.find((x) => x.id === next.order?.[0]);
  const what = first ? `${first.difficulty >= 2 ? '조금 어려운 ' : ''}‘${KIND_LABEL[first.kind]}’ 말` : '그 말';
  return `${next.reason} 다음 판에는 ${what}부터 넣을게요.`;
}

function renderSkills(next) {
  const ul = $('#r-skills'); ul.textContent = '';
  const report = atlas((c) => skillReport(c.summary(), { focusSkillId: next?.skillId }), []);
  const rows = report.length ? report : Object.keys(SKILL_LABEL).map((id) => ({ id, label: SKILL_LABEL[id], text: '기록을 쓸 수 없어요', tone: 'quiet' }));
  for (const r of rows) {
    const mine = state.results.filter((x) => x.skill === r.id), ok = mine.filter((x) => x.correct === true).length, focus = r.tone === 'focus';
    const li = el('li', focus ? 'focus' : r.tone === 'good' ? 'good' : '');
    li.innerHTML = `<b>${esc(r.label)}${focus ? ' <i class="next-tag">다음 연습</i>' : ''}</b><em>이번 ${ok}/${mine.length}</em><span>${esc(r.text)}${r.n ? ` · 처음 들은 말 ${r.n}개 중 ${r.correct}개는 혼자 맞힘` : ''}</span>`;
    ul.append(li);
  }
}

/* ── 멈춤 ── */
function pause(open = true) {
  if (open && $('#game').hidden) return;
  const cur = state.cur;
  if (open && !state.paused && cur?.phase === 'talk') { cur.speech?.stop(); cur.speechCut = true; }   // 말하던 중이면 멈추고, 이어 하면 처음부터 다시 말한다
  if (open && !state.paused) { stopLine(); sound.stopNarration(); }   // 다시 듣기·안내 음성은 멈추고, 이어 하면 단추로 다시 듣는다
  // 쉬는 시간은 순간 맞춤의 ‘고르기까지 쓴 시간’에서 뺀다
  if (open && !state.paused) state.pausedAt = performance.now();
  if (!open && state.paused && state.pausedAt) { state.pausedMs += performance.now() - state.pausedAt; state.pausedAt = 0; }
  state.paused = open; stage?.pause(open);
  if (open && !$('#pause-dialog').open) $('#pause-dialog').showModal();
  if (!open && $('#pause-dialog').open) $('#pause-dialog').close();
  if (!open && cur?.speechCut && cur.phase === 'talk' && state.cur === cur) { cur.speechCut = false; speakCur(cur); }
}
$('#pause').onclick = () => pause(true);
$('#resume').onclick = () => { sound.unlock(); pause(false); };
$('#pause-dialog').addEventListener('cancel', (e) => { e.preventDefault(); pause(false); });
$('#quit').onclick = () => {
  // 대답하지 않은 말은 응답 없음으로 닫는다(평가하지 않음)
  const cur = state.cur;
  if (cur && !['hit', 'done'].includes(cur.phase)) cur.ex?.cancel();
  stopVoices(cur);
  pause(false); endFlow(); state.cur = null; tip(null); hideExplain(); hideWait(); renderLobby();
};
document.addEventListener('visibilitychange', () => { if (document.hidden && !$('#game').hidden) pause(true); });

/* ── 긋기: 탁구대 위 어디서든 위로 그으면 그 방향 칸을 고른다 ── */
let drag = null;
const arenaXY = (e) => { const r = $('#arena').getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
$('#arena').addEventListener('pointerdown', (e) => {
  if (e.target.closest('button, .paper')) return;
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
  stage?.strokeStart(...arenaXY(e));
});
window.addEventListener('pointermove', (e) => { if (drag && e.pointerId === drag.id) stage?.strokeMove(...arenaXY(e)); });
window.addEventListener('pointerup', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y, ms = Math.max(1, performance.now() - drag.t);
  drag = null;
  const lane = swipeLane(dx, dy);
  const ok = lane != null && choose(lane, { power: swingPower(Math.hypot(dx, dy) / ms) });
  stage?.strokeEnd(ok);   // 대답을 골랐으면 금빛 자국, 아니면 크림색으로 사라진다
});
window.addEventListener('pointercancel', () => { drag = null; stage?.strokeEnd(false); });

/* ── 이벤트 ── */
$('#btn-start').onclick = () => startRound();
$('#btn-daily').onclick = () => startRound('daily');
$('#r-again').onclick = () => { stopLine(); startRound(); };
$('#r-daily-again').onclick = () => { stopLine(); startRound('daily'); };
$('#r-home').onclick = () => { stopLine(); renderLobby(); };
for (const t of document.querySelectorAll('[data-sound-toggle]')) t.onclick = () => { sound.setOn(!sound.isOn()); syncToggles(); if (sound.isOn()) { sound.unlock(); sound.play('tap'); } };
for (const t of [$('#slow-toggle'), $('#slow-toggle-2')]) t.onclick = () => { progress.slow = !progress.slow; save(); syncToggles(); };
$('#narration-toggle').onclick = () => { sound.setNarration(!sound.narrationIsOn()); syncToggles(); };
$('#reset-learning').onclick = () => {
  if (!coach) return;
  if (!window.confirm('같은 주소에서 연 모든 SYNK 게임의 학습 기록을 지울까요? 최고 기록은 그대로 남아요.')) return;
  atlas((c) => c.reset()); renderLobby();
};
document.addEventListener('keydown', (e) => {
  if ($('#game').hidden || $('#pause-dialog').open || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === 'Escape') { e.preventDefault(); pause(true); return; }
  if (!$('#explain').hidden) { if ((e.key === 'Enter' || e.key === ' ') && document.activeElement !== $('#btn-next')) { e.preventDefault(); $('#btn-next').click(); } return; }
  const n = Number(/^(?:Digit|Numpad)([1-3])$/.exec(e.code)?.[1] ?? (/^[1-3]$/.test(e.key) ? e.key : NaN));
  if (!(n >= 1 && n <= 3) || e.repeat) return;
  e.preventDefault();
  choose(n - 1, { tapped: true });
});

syncToggles();
renderLobby();
// 3D 무대를 입구에서 미리 만든다(셰이더 미리 데우기가 시작 단추를 누른 뒤의 멈춤이 되지 않게)
(window.requestIdleCallback || ((fn) => setTimeout(fn, 600)))(() => { ensureStage().catch(() => { /* 시작할 때 다시 시도하고 안내한다 */ }); }, { timeout: 2500 });

// 시험·확인용 관찰(?qa)
if (QA) {
  window.__rally = {
    state: () => ({ index: state.index, queue: state.queue.map((x) => x.id), results: state.results.map((r) => ({ ...r })), rally: state.rally, score: state.score, practice: state.practice,
      mode: state.mode, dailyDate: state.dailyDate,
      cur: state.cur && { id: state.cur.item.id, answer: state.cur.item.answer, options: [...state.cur.options], choice: state.cur.choice, phase: state.cur.phase,
        waiting: state.cur.waiting, quick: state.cur.quick } }),
    choose: (lane) => choose(lane, { tapped: true }),
    progress: () => JSON.parse(JSON.stringify(progress)), summary: () => atlas((c) => c.summary()), daily: () => loadDaily(),
    flow: () => (state.flow ? { flight: flightScale(), tired: state.tired } : null),
    sound: { start: () => sound.startLog(), take: () => sound.takeLog(), slow: () => sound.slowState() },
    impacts: () => impacts.splice(0),
    stage: () => stage,
    gear: () => ({ ...gear }),
    fitCards: () => fitCards(),   // qa/cards-fit.cjs: 모든 대답을 카드에 넣어 볼 때
  };
}
