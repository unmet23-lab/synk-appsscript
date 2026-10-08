// 말의 리듬 — 화면과 흐름. 보면·판정은 core.mjs, 음악·내레이션과 공통 시계는 audio.mjs, 펠트 무대는 stage.mjs,
// 문항과 능력의 대응·판정 폭 맞춤은 personalization.mjs, 공통 학습 기록은 atlas-learning.js(SynkLearning).
// 한 곡: 곡 고르기 → 무대 열기(음악·내레이션을 받아 한 시계에 예약) → 박자 맞추기와 듣기 O·X 다섯 번
// → 곡이 끝나면 결과(문장 다시 듣기·새 문장 확인·공통 코인). 코인은 곡을 끝까지 마쳤을 때만 받는다.
// 시험(app-learning.test.mjs)이 이 파일을 가짜 DOM에서 그대로 돌린다: 처음 읽을 때는 getElementById·createElement만 쓴다.
import { TRACKS, LEVELS, RoundState } from './core.mjs';
import { MusicPlayer } from './audio.mjs';
import { Stage } from './stage.mjs';
import { rhythmItem, FLOW_RHYTHM, timingObservation, timingSummary, assignmentTracks, assignmentTrack, rhythmTargetLabel, nextTrackLine } from './personalization.mjs';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clock = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
const QA = /[?&]qa(?:[=&]|$)/.test(globalThis.location?.search || '');
const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* 이 페이지에서만 */ } },
};
function announce(text) { const n = $('sr-live'); n.textContent = ''; setTimeout(() => { n.textContent = text; }, 30); }

/* ── 공통 학습 기록(Atlas) ── */
let coach = null, learningAvailable = true;
try { coach = globalThis.SynkLearning?.createGame({ gameId: 'korean-rhythm', storage: localStorage }) || null; } catch { learningAvailable = false; }
function learn(action, fallback = null) { try { return coach ? action(coach) : fallback; } catch { learningAvailable = false; return fallback; } }
const assignment = () => learn((c) => c.assignment?.());
// SYNK WORLD 안에서는 기록이 계정의 것이다: 지우기도 거기서 한다.
const hosted = learn((c) => typeof c.assignment === 'function', false);

/* ── 판정 폭 맞춤(Atlas 순간 맞춤): 고른 난이도 안에서 판정 폭만 이 사람에게 맞춘다 ── */
const TIMING_KEY = 'synk.korean-rhythm.timing-mode';
const timingAuto = () => store.get(TIMING_KEY) !== 'fixed';
let live = null, timingStart = null;
function startTiming() {
  live = null; timingStart = null;
  if (!coach || !learningAvailable || typeof coach.live !== 'function') return;
  try {
    live = coach.live(FLOW_RHYTHM, { declared: timingAuto() ? {} : { mode: 'fixed' } });
    timingStart = live.settings().values.window;
    state.round.scaleTiming(timingStart);
  } catch { live = null; }
}
function followTiming(event) {
  if (!live || !state.round) return;
  const observation = timingObservation(event);
  if (!observation) return;
  try { const out = live.observe(observation); if (out.change) state.round.scaleTiming(out.settings.values.window); } catch { live = null; }
}

/* ── 설정: 배경 음악(내레이션은 늘 들린다) · 효과 줄이기 · 박자 보정 ── */
const MUSIC_KEY = 'synk.korean-rhythm.music', OFFSET_KEY = 'synk.korean-rhythm.offset';
const OFFSET_MAX = 200;
const state = { track: 0, level: 'easy', screen: 'lobby', round: null, pressed: new Set(), paused: false, loading: false,
  offset: Math.max(-OFFSET_MAX, Math.min(OFFSET_MAX, Number(store.get(OFFSET_KEY)) || 0)), musicOn: store.get(MUSIC_KEY) !== 'off',
  reduced: !!matchMedia('(prefers-reduced-motion: reduce)').matches, activeQuestion: null, recallIndex: 0 };
let collectionRoundId = null;

const music = new MusicPlayer({ onDelivery: (q, status) => { q.delivered = status.audio; if (q.presentationId) learn((c) => c.delivery(q.presentationId, status)); } });
music.enabled = state.musicOn;
const pads = [$('pad-0'), $('pad-1')];
const stage = new Stage($('stage'), { pads });
new Stage($('hero-runway'), { preview: true });   // 입구 그림(멈춘 무대)
stage.reduced = state.reduced;
let raf = 0, lastFrame = 0, lastUi = 0, toastTimer = 0, startGeneration = 0, reviewSeq = 0;

/* ── 입구: 곡 셋(쿠션 타일) · 추천 이유 · 박자 난이도 ── */
const SONG_FELT = ['blush', 'lapis', 'butter'];   // 초록(코랄 계열) · 해안선(바다) · 네 시(오후 햇빛)
const songWhat = (track) => track.subtitle.split(' · ').pop();

function renderTracks() {
  const grid = $('track-grid'), allowed = assignmentTracks(assignment());
  grid.replaceChildren();
  for (const track of TRACKS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `song ${SONG_FELT[track.id]}`;
    b.dataset.track = String(track.id);
    b.setAttribute('aria-pressed', String(state.track === track.id));
    b.setAttribute('aria-label', `${track.title}. ${songWhat(track)}. ${Math.round(track.bpm)} BPM, ${clock(track.duration)}`);
    b.innerHTML = `<span class="song-title">${esc(track.title)}</span><span class="song-what">${esc(songWhat(track))}</span>`
      + `<span class="song-meta"><span class="bpm">${Math.round(track.bpm)} BPM</span><span class="len">&nbsp;· ${clock(track.duration)}</span></span>`;
    b.disabled = !allowed.some((c) => c.trackId === track.id);
    b.addEventListener('click', () => selectTrack(track.id));
    grid.append(b);
  }
}
function selectTrack(id) {
  if (!assignmentTracks(assignment()).some((c) => c.trackId === id)) return;
  state.track = id;
  for (const x of $('track-grid').children) x.setAttribute('aria-pressed', String(Number(x.dataset.track) === id));
  $('l-song').textContent = TRACKS[id].title;
}
/** 내 기록에 맞는 다음 곡(Atlas). 지정 과제가 있으면 그 곡만 고를 수 있다. */
function renderRecommendation(select = false) {
  const target = assignment(), candidates = assignmentTracks(target);
  const recommendation = learn((c) => c.recommend(candidates, { audioAvailable: true }));
  const candidate = recommendation?.selected || (target ? candidates[0] : null);
  for (const x of $('track-grid').children) x.classList.toggle('rec', !!candidate && Number(x.dataset.track) === candidate.trackId);
  $('recommendation-reason').textContent = target ? rhythmTargetLabel(target)
    : recommendation?.reason || '맞춤 추천을 불러오지 못했어요. 원하는 곡은 그대로 플레이할 수 있어요.';
  const summary = learn((c) => c.summary());
  $('learning-scope').textContent = !coach || !learningAvailable ? '학습 기록을 연결하지 못했어요.'
    : summary?.storage.available ? (hosted ? '학습 기록은 WORLD 계정에 이어지고, 공유와 삭제는 WORLD 계정 설정에서 할 수 있어요.' : '학습 기록은 이 브라우저에만 저장되고, 아직 학생 계정과는 이어지지 않아요.')
      : '기록을 저장할 수 없어서 이 페이지에서만 기억해요.';
  $('reset-learning').hidden = hosted;
  if (candidate && select) selectTrack(candidate.trackId);
  return { candidate, reason: recommendation?.reason || null };
}
function selectLevel(level) {
  if (!LEVELS[level]) return;
  state.level = level;
  syncSettings();
}

function syncSettings() {
  for (const b of document.querySelectorAll('[data-sound-toggle]')) {
    b.setAttribute('aria-pressed', String(state.musicOn));
    if (b.hasAttribute('data-sound-label')) b.textContent = state.musicOn ? '배경 음악 켜짐' : '배경 음악 꺼짐';
    else b.setAttribute('aria-label', state.musicOn ? '배경 음악 끄기' : '배경 음악 켜기');
  }
  for (const b of document.querySelectorAll('[data-effects-toggle]')) { b.setAttribute('aria-pressed', String(state.reduced)); b.textContent = state.reduced ? '효과 줄임' : '효과 줄이기'; }
  for (const b of document.querySelectorAll('[data-timing-toggle]')) { b.setAttribute('aria-pressed', String(timingAuto())); b.textContent = timingAuto() ? '판정 폭 맞춤 켜짐' : '판정 폭 맞춤 꺼짐'; }
  for (const o of document.querySelectorAll('[data-offset-value]')) o.textContent = `${state.offset > 0 ? '+' : ''}${state.offset}ms`;
  for (const b of document.querySelectorAll('[data-level]')) b.setAttribute('aria-pressed', String(b.dataset.level === state.level));
  $('game').classList.toggle('calm', state.reduced);
}
function setMusic(on) { state.musicOn = on; store.set(MUSIC_KEY, on ? 'on' : 'off'); music.setSound(on); syncSettings(); }
function setReduced(on) { state.reduced = on; stage.reduced = on; syncSettings(); }
function nudgeOffset(ms) { state.offset = Math.max(-OFFSET_MAX, Math.min(OFFSET_MAX, state.offset + ms)); store.set(OFFSET_KEY, String(state.offset)); syncSettings(); }

/* ── 화면 ── */
function show(name) {
  for (const s of ['lobby', 'game', 'results']) $(s).hidden = s !== name;
  state.screen = name;
  document.body.classList.toggle('playing', name === 'game');
  if (name !== 'game') window.scrollTo({ top: 0, behavior: 'instant' });
  if (name === 'game') stage.resize();
}
function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4200); }
function tip(text) { $('tip').hidden = !text; if (text) $('tip').textContent = text; }

/* ── 한 곡 ── */
async function start() {
  if (state.loading) return;
  state.loading = true;
  const generation = ++startGeneration;
  $('start-button').disabled = true; $('replay-button').disabled = true;
  try {
    if (!window.AudioContext) throw new Error('이 브라우저는 음악 재생을 지원하지 않아요. 최신 Chrome 또는 Edge에서 열어 주세요.');
    const target = assignment(), track = assignmentTrack(TRACKS[state.track], target);
    if (!track) throw new Error('과제 문항이 있는 곡을 준비하지 못했어요. WORLD에서 다시 열어 주세요.');
    const round = new RoundState(track, state.level, crypto.getRandomValues(new Uint32Array(1))[0]);
    const loading = music.prepare(track, round.questions);   // 소리 길은 누른 그 순간에 연다(휴대폰 자동 재생 규칙)
    state.round = round; state.pressed.clear(); state.paused = false;
    resetQuestion(); resetHud(round);
    show('game');
    tip('노래와 문장을 준비하고 있어요…');
    stage.ready.then(() => { if (state.loading && state.round === round) stage.draw(round, -99, state.pressed, 0); });
    const [buffer] = await Promise.all([loading, stage.ready]);
    if (generation !== startGeneration) return;
    collectionRoundId = globalThis.SynkPlayCollection?.roundId('rhythm') || null;
    stage.reset(); startTiming(); tip(null); setMongle('smile');
    music.start(buffer, round.beat);
    lastFrame = performance.now(); lastUi = 0;
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    $('pause-button').focus({ preventScroll: true });
    announce(`${track.title}. 네 박자 뒤에 시작해요. 노트가 크림색 선에 닿을 때 눌러요.`);
  } catch (error) {
    if (generation !== startGeneration) return;
    music.stop(); state.round = null; tip(null); show('lobby');
    toast(error?.message || '곡을 준비하지 못했어요. 다시 시작해 주세요.');
  } finally {
    state.loading = false;
    $('start-button').disabled = false; $('replay-button').disabled = false;
  }
}

function resetHud(round) {
  $('score').textContent = '0'; $('combo').textContent = '0'; $('combo-wrap').dataset.tier = '1';
  $('learning-count').textContent = `0 / ${round.questions.length}`;
  $('song-fill').style.width = '0%';
  $('now-title').textContent = round.track.title;
  $('now-meta').textContent = `${LEVELS[round.levelName].label} · ${Math.round(round.track.bpm)} BPM`;
  $('now-time').textContent = `0:00 / ${clock(round.duration)}`;
  $('countdown').hidden = true;
}
function renderHud(round, t) {
  $('score').textContent = String(round.score);
  $('combo').textContent = String(round.combo);
  const tier = round.combo >= 30 ? '3' : round.combo >= 10 ? '2' : '1', wrap = $('combo-wrap');
  if (wrap.dataset.tier !== tier) { wrap.dataset.tier = tier; if (tier !== '1') punch(wrap); }
  const started = round.questions.filter((q) => t >= q.showTime).length;
  $('learning-count').textContent = `${started} / ${round.questions.length}`;
  $('song-fill').style.width = `${Math.min(100, Math.max(0, (t / round.duration) * 100))}%`;
  $('now-time').textContent = `${clock(t)} / ${clock(round.duration)}`;
}
function punch(node) { if (state.reduced) return; node.classList.remove('punch'); void node.offsetWidth; node.classList.add('punch'); }

function frame(now) {
  if (state.screen !== 'game' || !state.round) return;
  const round = state.round, dt = Math.min(0.04, (now - lastFrame) / 1000);
  lastFrame = now;
  const t = music.time;
  if (!state.paused) {
    if (QA) qaFrame(t);
    for (const e of round.update(t - state.offset / 1000, state.pressed)) eventEffect(e);
    const q = round.activeQuestion(t);
    showQuestion(q); questionPhase(q, t); countdown(round, t);
    if (now - lastUi > 60) { lastUi = now; renderHud(round, t); }
    if (t > round.duration + 0.8) { finish(); return; }
  }
  stage.draw(round, t, state.pressed, state.paused ? 0 : dt);
  raf = requestAnimationFrame(frame);
}
/** 시작 전 네 박자: 크림 펠트 배지에 4·3·2·1 */
function countdown(round, t) {
  const box = $('countdown');
  if (t >= 0) { if (!box.hidden) { box.hidden = true; tip(null); } return; }
  const n = String(Math.max(1, Math.min(4, Math.ceil(-t / round.beat))));
  if (box.hidden) { box.hidden = false; tip('노트가 크림색 선에 닿을 때 눌러요'); }
  if ($('countdown-number').textContent !== n) { $('countdown-number').textContent = n; punch(box); }
}

/* ── 듣기 문제 카드: 듣기 → 생각 → 답(박자에 맞춰 O·X) → 답한 뒤 ── */
function resetQuestion() {
  state.activeQuestion = null;
  const card = $('phrase-card');
  card.hidden = true; card.dataset.phase = ''; card.dataset.result = ''; card.classList.remove('texted');
  $('q-say').hidden = true; $('q-text-btn').hidden = false;
  $('now').hidden = false;
  for (let i = 0; i < 2; i += 1) {
    pads[i].disabled = false;
    pads[i].classList.remove('intent', 'right', 'waiting');
    $(`answer-${i}`).textContent = i === 0 ? '맞아요' : '아니에요';
  }
}
function showQuestion(q) {
  if (state.activeQuestion === q) return;
  state.activeQuestion = q;
  if (!q) { resetQuestion(); setMongle('smile'); return; }
  if (!q.presentationId) q.presentationId = learn((c) => c.present(rhythmItem(state.round.track.id, q)));
  const n = state.round.questions.indexOf(q) + 1, card = $('phrase-card');
  card.hidden = false; card.dataset.phase = ''; card.dataset.result = '';
  $('now').hidden = true;
  $('q-tag').textContent = `듣기 ${n} / ${state.round.questions.length}`;
  $('q-say').hidden = !q.texted; $('q-text-btn').hidden = !!q.texted; card.classList.toggle('texted', !!q.texted);
  if (q.texted) showText(q);
  setMongle('focus');
  announce(`듣기 ${n}번. 문장을 끝까지 들어요.`);
}
function questionPhase(q, t) {
  if (!q) return;
  const ready = t >= q.answerOpen, answered = q.state !== 'pending';
  // 듣는 동안은 단추를 쉬게 둔다(그때 누른 것은 답이 아니다). 색은 그대로 두고 글만 ‘듣는 중’으로. 답한 뒤에는 바로 다음 노트를 칠 수 있게 연다.
  for (let i = 0; i < 2; i += 1) {
    const wait = !ready;
    if (pads[i].disabled === wait) continue;
    pads[i].disabled = wait; pads[i].classList.toggle('waiting', wait);
    $(`answer-${i}`).textContent = wait ? '듣는 중' : i === 0 ? '맞아요' : '아니에요';
    if (wait && state.pressed.has(i)) release(i);
  }
  const phase = answered ? 'answered' : t < q.voiceEnd ? 'listening' : ready ? 'answer' : 'think';
  const card = $('phrase-card');
  if (card.dataset.phase === phase) return;
  card.dataset.phase = phase;
  if (answered) return;   // 답한 뒤의 글은 answered()가 쓴다
  $('q-ask').textContent = phase === 'listening' ? '잘 들어 보세요' : phase === 'think' ? '맞는 내용일까요?' : '들은 내용과 맞으면 O, 아니면 X';
  $('q-hint').textContent = phase === 'answer' ? '노트가 크림색 선에 닿을 때 눌러요' : '끝까지 들은 뒤에 답해요';
  if (phase === 'answer') announce('들은 내용과 맞으면 O, 아니면 X. 노트가 선에 닿을 때 눌러요.');
}
/** 글로 보기: 들은 문장과 질문을 글로 보여 준다. 이 문제는 도움을 받은 답으로 남는다. */
function showText(q) {
  $('q-say').innerHTML = `<b>“${esc(q.prompt)}”</b><span>${esc(q.question)}</span>`;
  $('q-say').hidden = false; $('q-text-btn').hidden = true;
  $('phrase-card').classList.add('texted');
}
$('q-text-btn').addEventListener('click', () => {
  const q = state.activeQuestion;
  if (!q || q.state !== 'pending' || state.paused) return;
  if (!q.texted) { q.texted = true; if (q.presentationId) learn((c) => c.help(q.presentationId, 'text')); }
  showText(q);
  announce(`${q.prompt} ${q.question}`);
});

function eventEffect(event) {
  if (!event) return;
  followTiming(event);
  if (event.type === 'listening') return;
  if (event.type === 'intent') {
    pads.forEach((b, i) => b.classList.toggle('intent', i === event.lane));
    $('q-hint').textContent = '골랐어요. 노트가 선에 닿을 때 한 번 더 눌러요.';
    return;
  }
  if (event.quality > 0) { stage.hit(event.lane, event.quality); music.hit(event.lane); judgment(event.lane, event.quality); }
  if (event.q) answered(event);
}
/** 답이 정해졌다(박자에 맞춰 눌렀거나, 고른 채 선을 지났거나, 답하지 않았다). 기록하고 정답을 보여 준다. */
function answered(event) {
  const q = event.q;
  if (!q.presentationId) q.presentationId = learn((c) => c.present(rhythmItem(state.round.track.id, q)));
  if (q.presentationId && !q.evidenceSaved) {
    q.evidenceSaved = true;
    q.learning = learn((c) => c.answer(q.presentationId, { correct: q.response === null ? null : event.correct, assessable: q.response !== null, reason: q.response === null ? 'unanswered' : undefined }));
  }
  const result = q.response === null ? 'none' : event.correct ? 'ok' : 'ko', card = $('phrase-card');
  card.dataset.phase = 'answered'; card.dataset.result = result;
  $('q-text-btn').hidden = true;
  $('q-ask').textContent = result === 'ok' ? '잘 들었어요!' : result === 'ko' ? '다시 들어 봐요' : '다음에 다시 들어 봐요';
  $('q-hint').textContent = `정답은 ${q.answer} · 해설은 곡이 끝나면 볼 수 있어요`;
  const right = q.options.indexOf(q.answer);
  pads.forEach((b, i) => { b.classList.toggle('right', i === right); b.classList.toggle('intent', i === q.response); });
  if (q.presentationId) learn((c) => c.help(q.presentationId, 'answer'));
  setMongle(result === 'ok' ? 'cheer' : 'curious');
  announce(`${$('q-ask').textContent} 정답은 ${q.answer === 'O' ? '오' : '엑스'}.`);
}

const WORDS = [[1, '딱!', 'perfect'], [0.8, '좋아요', 'great'], [0, '아쉬워요', 'good']];
function judgment(lane, quality) {
  const at = stage.judgeAt?.(lane), p = $(`pop-${lane}`);
  if (!at) return;
  const [, word, kind] = WORDS.find(([min]) => quality >= min);
  p.textContent = word; p.dataset.kind = kind; p.hidden = false;
  p.style.left = `${at.x}px`; p.style.top = `${at.y - 44}px`;
  p.classList.remove('go'); void p.offsetWidth; p.classList.add('go');
  clearTimeout(p.timer); p.timer = setTimeout(() => { p.hidden = true; }, 760);
}

let mongleFace = '';
function setMongle(face) {
  if (face === mongleFace) return;
  mongleFace = face;
  $('stage-mongle').src = `kit/brand/mongle-${face}.webp`;
}

/* ── 입력: 두 단추(누르고 있기) · F·J · ←·→ ── */
function input(lane) {
  if (state.screen !== 'game' || state.paused || state.loading || state.pressed.has(lane) || !state.round) return;
  state.pressed.add(lane);
  pads[lane].classList.add('active');
  if (music.time < -0.15) return;
  eventEffect(state.round.input(lane, music.time - state.offset / 1000));
}
function release(lane) {
  state.pressed.delete(lane);
  pads[lane].classList.remove('active');
  if (state.round && state.screen === 'game' && !state.paused) eventEffect(state.round.release(lane, music.time - state.offset / 1000));
}
const pointers = new Map();
pads.forEach((b, lane) => {
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); pointers.set(e.pointerId, lane); b.setPointerCapture?.(e.pointerId); input(lane); });
  b.addEventListener('pointerup', (e) => { if (pointers.has(e.pointerId)) { pointers.delete(e.pointerId); release(lane); } });
  b.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); release(lane); });
  b.addEventListener('lostpointercapture', (e) => { if (pointers.has(e.pointerId)) { pointers.delete(e.pointerId); release(lane); } });
  b.addEventListener('click', (e) => { if (e.detail === 0) { input(lane); setTimeout(() => release(lane), 120); } });   // 키보드로 단추를 눌렀을 때
});
const KEY_LANES = { KeyF: 0, KeyJ: 1, ArrowLeft: 0, ArrowRight: 1 };
document.addEventListener('keydown', (e) => {
  if (state.screen !== 'game' || e.altKey || e.ctrlKey || e.metaKey) return;
  if ($('pause-dialog').open) {
    if (e.code === 'Space' || e.code === 'Escape') { e.preventDefault(); if (!e.repeat) resume(); }
    return;
  }
  if (e.code === 'Escape' || e.code === 'Space') { e.preventDefault(); if (!e.repeat) pause(); return; }
  if (Object.hasOwn(KEY_LANES, e.code)) { e.preventDefault(); if (!e.repeat) input(KEY_LANES[e.code]); }
});
document.addEventListener('keyup', (e) => {
  if (!Object.hasOwn(KEY_LANES, e.code)) return;
  if (state.screen === 'game') e.preventDefault();
  release(KEY_LANES[e.code]);
});

/* ── 멈춤 ── */
async function pause() {
  if (state.screen !== 'game' || state.paused || !state.round) return;   // 준비 중에도 멈춰서 처음으로 나갈 수 있다(받기가 오래 걸릴 때)
  state.paused = true;
  for (const lane of [...state.pressed]) release(lane);
  state.pressed.clear();
  await music.pause();
  $('pause-where').textContent = state.loading ? `${state.round.track.title} · 준비 중`
    : `${state.round.track.title} · ${clock(music.time)} / ${clock(state.round.duration)}`;
  if (!$('pause-dialog').open) $('pause-dialog').showModal();
  $('resume-button').focus({ preventScroll: true });
}
let resuming = false;
async function resume() {
  if (!state.paused || resuming) return;
  resuming = true;
  try {
    await music.resume();
    if (music.state !== 'running') throw new Error('suspended');
    state.paused = false;
    if ($('pause-dialog').open) $('pause-dialog').close();
    lastFrame = performance.now();
    $('pause-button').focus({ preventScroll: true });
  } catch { toast('소리를 다시 켜지 못했어요. 이어 하기를 한 번 더 눌러 주세요.'); }
  finally { resuming = false; }
}
/** 곡 중간에 나가기: 코인은 받지 않는다. */
function leave() {
  startGeneration += 1;
  music.stop(); cancelAnimationFrame(raf);
  state.pressed.clear(); state.paused = false; state.round = null;
  if ($('pause-dialog').open) $('pause-dialog').close();
  tip(null); resetQuestion();
  show('lobby'); renderRecommendation();
  $('start-button').focus({ preventScroll: true });
}

/* ── 결과 ── */
function finish() {
  const r = state.round;
  for (const event of r.update(r.duration + 3, new Set())) eventEffect(event);
  music.stop(); cancelAnimationFrame(raf);
  state.pressed.clear(); state.paused = false;
  resetQuestion(); tip(null);
  show('results');
  const correct = r.correctCount, total = r.questions.length, stars = correct >= total ? 3 : correct >= total - 1 ? 2 : correct >= Math.ceil(total / 2) ? 1 : 0;
  $('r-kicker').textContent = `${r.track.title} · ${LEVELS[r.levelName].label}`;
  $('r-correct').textContent = String(correct); $('r-total').textContent = String(total);
  $('r-stars').innerHTML = [1, 2, 3].map((i) => `<i class="${i <= stars ? 'on' : ''}"></i>`).join('');   // 별이 차례로 붙는 시차는 style.css(로컬 서버의 CSP가 인라인 style을 막는다)
  $('r-stars').setAttribute('aria-label', `별 3개 중 ${stars}개`);
  $('r-mongle').src = stars >= 2 ? 'kit/brand/mongle-cheer.webp' : 'kit/brand/mongle-smile.webp';
  $('result-score').textContent = String(r.score);
  $('result-accuracy').textContent = `${((r.earned / r.possible) * 100).toFixed(1)}%`;
  $('result-combo').textContent = String(r.maxCombo);
  const texted = r.questions.filter((q) => q.texted).length;
  $('r-note').textContent = `들은 문장 ${correct}개를 맞혔어요.${texted ? ` 글로 본 문장 ${texted}개는 도움을 받은 답으로 남겨요.` : ''}`;
  renderLog(r);
  renderSkills(r);
  // 공통 코인(play-common): 곡을 끝까지 마쳤을 때만. 완주 15 + 정답 비율 × 10.
  const coins = $('r-coins');
  coins.textContent = '공통 코인을 계산하고 있어요.';
  globalThis.SynkPlayCollection?.award({ game: 'rhythm', total, correct, completed: true, automatic: false, roundId: collectionRoundId })
    .then((result) => { if (state.round === r) coins.textContent = globalThis.SynkPlayCollection.rewardText(result); });
  const next = renderRecommendation();
  $('r-next-reason').textContent = next.candidate
    ? nextTrackLine(next.candidate.label, next.reason)
    : '다음에는 다른 곡이나 박자 난이도로 들어 봐요.';
  state.recallIndex = 0;
  $('recall-content').hidden = true; $('recall-intro').hidden = false;
  $('recall-button').hidden = false; $('recall-button').textContent = '다른 문장 듣기';
  $('result-title').focus({ preventScroll: true });
}

function renderLog(r) {
  const list = $('review-list');
  list.replaceChildren();
  r.questions.forEach((q, i) => {
    const ok = q.response !== null && q.options[q.response] === q.answer;
    const li = document.createElement('li');
    li.className = ok ? 'ok' : 'ko';
    const chose = q.response === null ? '답하지 않았어요' : `고른 답 ${q.options[q.response]}`;
    li.innerHTML = `<span class="mark ${ok ? 'ok' : 'again'}" aria-label="${ok ? '맞음' : '다시 볼 문장'}">${ok ? '' : i + 1}</span>`
      + `<span class="body"><span class="line">“${esc(q.prompt)}”</span><span class="sent">${esc(q.question)} <b>정답 ${esc(q.answer)}</b></span>`
      + `<small>${esc(q.category)} · ${esc(chose)}${q.texted ? ' · 글로 봄' : ''}</small><span class="why">${esc(q.explanation)}</span></span>`
      + `<button class="chip-btn say-again" type="button" aria-label="${esc(`${i + 1}번 문장 다시 듣기`)}">다시 듣기</button>`;
    li.querySelector('.say-again').addEventListener('click', () => playReview(q.voice));
    list.append(li);
  });
}
const SKILL_NAME = { detail: '세부 내용', negation: '부정 표현', condition: '조건 표현', reason: '이유', main: '중심 내용' };
function renderSkills(r) {
  const rows = new Map();
  for (const q of r.questions) {
    const id = rhythmItem(r.track.id, q).skillId.split('.').pop(), row = rows.get(id) || { n: 0, ok: 0 };
    row.n += 1; if (q.response !== null && q.options[q.response] === q.answer) row.ok += 1;
    rows.set(id, row);
  }
  $('r-skills').innerHTML = [...rows].map(([id, row]) => `<li class="${row.ok === row.n ? 'good' : ''}"><b>${esc(SKILL_NAME[id] || '듣기')}</b><em>이번 ${row.ok}/${row.n}</em></li>`).join('');
  const timingEnd = live ? (() => { try { return live.end().settings.values.window; } catch { return null; } })() : null;
  live = null;
  $('result-timing').textContent = timingEnd === null ? '' : timingAuto() ? timingSummary(timingStart, timingEnd) : '정해진 판정 폭으로 연주했어요.';
  $('result-timing').hidden = !$('result-timing').textContent;
  const independent = r.questions.filter((q) => q.learning?.independent).length;
  $('result-learning-note').textContent = `도움을 받거나 다시 들은 답을 빼고, 새로 답한 ${independent}개를 맞춤 추천에 참고해요. 이 곡으로 읽기 실력을 판단하지는 않아요.`;
}
/** 결과에서 문장 소리를 튼다. 다른 소리로 끊기면 끝까지 들은 것으로 치지 않는다. */
async function playReview(voice) {
  const id = ++reviewSeq;
  try { await music.review(voice); return id === reviewSeq; } catch { return false; }
}

/** 새 문장 확인: 수나 시간만 바꾼 새 문장을 먼저 소리로 듣고 O·X로 답한 뒤 글을 본다(원문과 같은 문항군의 연습). */
async function recall() {
  const questions = state.round.questions;
  if (state.recallIndex >= questions.length) { $('recall-feedback').textContent = '다른 문장도 확인했어요. 다음 곡에서 다시 만나요.'; $('recall-button').hidden = true; return; }
  const source = questions[state.recallIndex], q = source.recall;
  if (source.recallPresentationId) learn((c) => c.help(source.recallPresentationId, 'replay'));
  else source.recallPresentationId = learn((c) => c.present(rhythmItem(state.round.track.id, source, { recall: true })));
  const presentationId = source.recallPresentationId;
  $('recall-content').hidden = false; $('recall-intro').hidden = true;
  $('recall-sentence').textContent = ''; $('recall-question').textContent = '먼저 들어요';
  $('recall-feedback').textContent = ''; $('recall-button').hidden = true;
  const options = $('recall-options');
  options.replaceChildren();
  const generation = startGeneration;
  for (const option of ['O', 'X']) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = `ox ${option === 'O' ? 'o' : 'x'}`; b.textContent = option; b.disabled = true;
    b.setAttribute('aria-label', option === 'O' ? 'O, 맞아요' : 'X, 아니에요');
    b.addEventListener('click', () => {
      for (const x of options.children) x.disabled = true;
      if (presentationId) source.recallLearning = learn((c) => c.answer(presentationId, { correct: option === q.answer, assessable: true }));
      b.classList.add('chosen');
      options.children[q.answer === 'O' ? 0 : 1].classList.add('right');   // 맞는 답에 펠트 체크(틀린 답에 X 표시 없음)
      $('recall-sentence').textContent = `“${q.prompt}”`; $('recall-question').textContent = q.question;
      $('recall-feedback').textContent = option === q.answer ? '잘 들었어요.' : `이 문장의 답은 ${q.answer}예요.`;
      if (presentationId) learn((c) => c.help(presentationId, 'answer'));
      state.recallIndex += 1;
      renderRecommendation();
      $('recall-button').textContent = state.recallIndex < questions.length ? '다음 문장 듣기' : '확인 마치기';
      $('recall-button').hidden = false;
    });
    options.append(b);
  }
  const heard = await playReview(q.voice);
  if (generation !== startGeneration || state.screen !== 'results') return;
  if (heard) {
    if (presentationId) learn((c) => c.delivery(presentationId, { audio: 'completed' }));
    $('recall-question').textContent = '맞으면 O, 아니면 X';
    for (const b of options.children) b.disabled = false;
  } else {
    if (presentationId) learn((c) => c.delivery(presentationId, { audio: 'failed' }));
    $('recall-question').textContent = '소리를 끝까지 듣지 못했어요';
    $('recall-button').textContent = '다시 듣기'; $('recall-button').hidden = false;
  }
}

/* ── 이벤트 ── */
$('start-button').addEventListener('click', start);
$('replay-button').addEventListener('click', start);
$('pause-button').addEventListener('click', () => pause());
$('resume-button').addEventListener('click', () => resume());
$('pause-dialog').addEventListener('cancel', (e) => { e.preventDefault(); resume(); });
$('leave-button').addEventListener('click', leave);
$('back-button').addEventListener('click', () => { music.stop(); show('lobby'); renderRecommendation(); $('start-button').focus({ preventScroll: true }); });
$('other-song').addEventListener('click', () => { music.stop(); show('lobby'); renderRecommendation(true); $('track-grid').scrollIntoView?.({ block: 'center' }); $('start-button').focus({ preventScroll: true }); });
$('recall-button').addEventListener('click', recall);
$('settings-button').addEventListener('click', () => $('settings-dialog').showModal());
$('settings-close').addEventListener('click', () => $('settings-dialog').close());
for (const b of document.querySelectorAll('[data-level]')) b.addEventListener('click', () => selectLevel(b.dataset.level));
for (const b of document.querySelectorAll('[data-sound-toggle]')) b.addEventListener('click', () => setMusic(!state.musicOn));
for (const b of document.querySelectorAll('[data-effects-toggle]')) b.addEventListener('click', () => setReduced(!state.reduced));
for (const b of document.querySelectorAll('[data-timing-toggle]')) b.addEventListener('click', () => { store.set(TIMING_KEY, timingAuto() ? 'fixed' : 'auto'); syncSettings(); });
for (const b of document.querySelectorAll('[data-offset]')) b.addEventListener('click', () => nudgeOffset(Number(b.dataset.offset)));
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('blur', () => pause());
$('reset-learning').addEventListener('click', () => {
  let message = '학습 기록을 지우지 못했어요. 다시 시도해 주세요.';
  try {
    const result = coach?.reset();
    learningAvailable = result?.storage?.available === true;
    if (learningAvailable) message = '이 브라우저의 모든 게임 학습 기록을 지웠어요.';
  } catch (error) {
    if (error?.code === 'ACCOUNT_RESET_REQUIRED') message = '계정의 학습 기록은 SYNK WORLD에서 관리해 주세요.';
    else learningAvailable = false;
  }
  renderRecommendation(); toast(message);
});
// 공통 코인 스크립트(collection.js)를 읽지 못했으면 코인 줄을 숨긴다.
if (!globalThis.SynkPlayCollection) for (const n of document.querySelectorAll('.synk-collection-line')) n.hidden = true;

renderTracks(); renderRecommendation(true); syncSettings();

// 확인용 읽기 창(예전 확인 도구와 같은 모양). 입력은 실제 키·단추로만 한다.
window.synkRhythm = {
  snapshot: () => ({ timing: state.round?.timing ?? null, screen: state.screen, paused: state.paused, loading: state.loading, time: music.time, audioState: music.state,
    recording: music.recording, signalLevel: music.signalLevel, voiceLevel: music.voiceLevel, activeVoice: music.activeVoice, scheduledVoices: music.scheduledVoices,
    score: state.round?.score, combo: state.round?.combo, correct: state.round?.correctCount, processed: state.round?.processed,
    notes: state.round?.notes.map((n) => ({ time: n.time, lane: n.lane, duration: n.duration, state: n.state })),
    questions: state.round?.questions.map((q) => ({ time: q.time, showTime: q.showTime, voiceEnd: q.voiceEnd, answerOpen: q.answerOpen, voice: q.voice, state: q.state, response: q.response, options: q.options, answer: q.answer, prompt: q.prompt })),
    duration: state.round?.duration, level: state.level, track: state.track }),
  audio: () => music.context,
};

/* ── 시험·확인용(?qa): 자동으로 치기 · 문제마다 맞게/틀리게 답하기 · 곡 안에서 건너뛰기 ── */
const qa = { auto: false, plan: [] };
function qaFrame(t) {
  if (!qa.auto || t < 0) return;
  const round = state.round, at = t - state.offset / 1000;
  for (const n of round.notes) {
    if (n.time > at + 0.02) break;
    if (n.state === 'pending' && at >= n.time - 0.004) { input(n.lane); if (!n.duration) release(n.lane); }
    else if (n.state === 'holding' && at >= n.endTime - 0.02) release(n.lane);
  }
  round.questions.forEach((q, i) => {
    const want = qa.plan[i];
    if (!want || want === 'none' || q.state !== 'pending' || t < q.answerOpen) return;
    const lane = want === 'right' ? q.options.indexOf(q.answer) : 1 - q.options.indexOf(q.answer);
    if (q.intent === null && t >= q.answerOpen + 0.05) { input(lane); release(lane); }
    else if (at >= q.time - 0.004) { input(lane); release(lane); }
  });
}
if (QA) {
  window.__rhythm = {
    state: () => {
      const r = state.round;
      return { screen: state.screen, loading: state.loading, paused: state.paused, time: music.time, track: state.track, level: state.level,
        phase: $('phrase-card').hidden ? null : $('phrase-card').dataset.phase, result: $('phrase-card').dataset.result || null,
        score: r?.score ?? 0, combo: r?.combo ?? 0, maxCombo: r?.maxCombo ?? 0, processed: r?.processed ?? 0, duration: r?.duration ?? 0,
        hits: r ? r.notes.filter((n) => n.state === 'hit' || n.state === 'holding').length : 0, missed: r ? r.notes.filter((n) => n.state === 'missed').length : 0,
        questions: r ? r.questions.map((q) => ({ state: q.state, response: q.response, answer: q.answer, correct: q.response !== null && q.options[q.response] === q.answer,
          texted: !!q.texted, delivered: q.delivered || null, showTime: q.showTime, voiceEnd: q.voiceEnd, answerOpen: q.answerOpen, time: q.time, closeTime: q.closeTime,
          independent: q.learning?.independent ?? null })) : [],
        frames: stage.frames };
    },
    autoplay: (on = true) => { qa.auto = !!on; },
    plan: (list) => { qa.plan = [...list]; },
    seek: (t) => music.seek(t),   // 곡의 t초로 건너뛴다(기다림만 줄인다 — 화면·판정은 그대로)
    stage: () => stage,
  };
}
