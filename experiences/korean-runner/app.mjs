// 바람길 — 화면과 흐름. 판정·코스는 core.mjs, 3D 펠트 길은 world.mjs, 좌표 기준은 course-motion.mjs, 학습 기록 연결은 learning.mjs(아틀라스).
// 한 판: 90초. 바람이 짧은 한국어 부탁(방향·동작·하지 말라는 말·두 동작의 순서)을 하면 표시선 전에 그대로 움직인다(←·→·점프·숙이기).
// 달리는 중에는 부탁의 글을 보이지 않는다 — ‘글로 보기’를 누르면 그 부탁만 보이고 도움으로 남는다. 목소리를 틀 수 없으면 달리기를 멈춘다
// (읽기로 바꾸지 않는다). 동작은 장면을 보고도 할 수 있어 늘 ‘평가하지 않음’으로 남고, 듣기 실력 기록은 따로 여는 ‘듣기 확인’이 맡는다.
// 보상은 공통 코인 하나: 90초를 끝까지 달린 판에만 결과 화면에서 받는다(그만두면 받지 않는다). 예전 바람상점·여행 목표는 열지도 읽지도 않는다
// (이 브라우저의 synk.windrun.shop.v1 기록은 지우지 않고 그대로 둔다).
import { RunnerModel } from './core.mjs';
import { INSTRUCTIONS, actionLabel } from './instructions.mjs';
import { KeyboardInput, KEY_ACTIONS } from './controls.mjs';
import { InstructionAudio } from './audio.mjs';
import { instructionMetadata, chooseInstruction, actionEvidence, FLOW_RUN, TIRED_RUN, FLOW_WORDS, paceOf, runObservation } from './learning.mjs';
import { mountListeningCheck } from './listening-check-ui.mjs';
import { scoreRun, skillReport, skillOf, SKILL_LABEL, STEP_WORD } from './report.mjs';
import { drawHeroRoad } from './hero.mjs';
import { preloadImages } from './kit/lab.mjs';
import {runnerSupport,obstacleSupport,runnerCheckSupport} from '../brand-opening/game-tutor-support.mjs';

let gameTutor=null;
const tutorEvent=(kind,detail)=>gameTutor?.emit(kind,detail);

const byId = (id) => document.getElementById(id);
const QA = /[?&]qa(?:[=&]|$)/.test(location.search);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const announce = (text) => { const n = byId('sr-live'); n.textContent = ''; requestAnimationFrame(() => { n.textContent = text; }); };
const punch = (node) => { if (!node || reduced()) return; node.classList.remove('punch'); void node.offsetWidth; node.classList.add('punch'); };
const meters = (n) => `${Math.floor(n).toLocaleString('ko-KR')}m`;
// 공통 코인 스크립트(collection.js)를 읽지 못했으면 코인 줄을 숨긴다(모듈은 본문 끝 스크립트 뒤에 돈다).
if (!globalThis.SynkPlayCollection) for (const n of document.querySelectorAll('.synk-collection-line')) n.hidden = true;

/* ── 저장: 최고 거리만(이 브라우저의 synk.windrun.*). 학습 기록은 아틀라스가 따로 맡는다 ── */
let storageAvailable = true;
function stored(key, fallback) { try { return localStorage.getItem('synk.windrun.' + key) ?? fallback; } catch { storageAvailable = false; return fallback; } }
function store(key, value) { try { localStorage.setItem('synk.windrun.' + key, String(value)); } catch { storageAvailable = false; } }
let best = Number(stored('best', '0')) || 0;

/* ── 아틀라스: 다음 부탁 고르기 · 기록 · 순간 맞춤(달리기 속도만) ── */
let coach = null, learningFailed = false, nextPlan = null;
try { coach = globalThis.SynkLearning?.createGame({ gameId: 'korean-runner', storage: localStorage }) || null; } catch { learningFailed = true; }
function learn(method, ...args) { try { return coach?.[method](...args); } catch { learningFailed = true; return null; } }
// WORLD 안에서는 기록이 계정의 것이다: 지우기·보관은 WORLD에서 한다.
const hosted = (() => { try { return typeof coach?.assignment === 'function'; } catch { return false; } })();
function selectInstruction(items) {
  if (!coach || learningFailed) return items[0];
  try { const plan = chooseInstruction(coach, items); if (plan?.selected) { nextPlan = plan; return plan.selected; } } catch { learningFailed = true; }
  return items[0];
}
function refreshRecommendation() { if (coach) selectInstruction(INSTRUCTIONS); }
const learningBroken = () => { const s = learn('summary'); return !coach || learningFailed || s?.storage?.available === false; };
const reasonText = () => (learningBroken() ? '학습 기록을 저장할 수 없어서 기본 부탁으로 달려요.' : nextPlan?.reason || '아직 안 들어 본 부탁부터 준비했어요.');
let live = null;
function startLive() {
  live = null;
  if (!coach || learningFailed || typeof coach.live !== 'function') return null;
  try { const tired = coach.today?.() === 'tired'; live = coach.live(FLOW_RUN, { words: FLOW_WORDS, ...(tired ? { declared: TIRED_RUN } : {}) }); return paceOf(live.settings().values); }
  catch { live = null; return null; }
}
function followPace(notice) {
  const observation = live && runObservation(notice); if (!observation) return;
  try { const out = live.observe(observation); if (out.change) { model.tune(paceOf(out.settings.values)); if (out.line) tip(out.line.text, 2400); } } catch { live = null; }
}
function endLive() { try { live?.end(); } catch { /* 이어 달리기 기억은 편의 */ } live = null; }

/* ── 소리: 미리 만든 MP3 목소리(InstructionAudio) + 작은 효과음·배경 가락(사운드킷 규칙: 사인·트라이앵글, 400ms 이하, C 펜타토닉, 실패음 없음) ── */
let audio = null, master = null, voiceGain = null, voiceBank = null, sound = true, previewRevision = 0;
function audioInit() {
  if (!audio || audio.state === 'closed') {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    audio = new AC(); master = audio.createGain(); master.gain.value = 0.13; master.connect(audio.destination);
    voiceGain = audio.createGain(); voiceGain.gain.value = sound ? 0.88 : 0; voiceGain.connect(audio.destination);
    voiceBank = new InstructionAudio(audio, voiceGain, master, undefined, onVoice);
    audio.onstatechange = () => { if (running && !paused && !model?.finished && audio.state !== 'running') pause(); };
  }
  return true;
}
function onVoice(status, item) {
  if (item.presentationId) learn('delivery', item.presentationId, { audio: status });
  if (status === 'completed' && model?.currentMission === item && byId('say').dataset.phase === 'listening') sayPhase('move');
}
async function ensureVoices() { try { if (!audioInit() || !await voiceBank.resume()) return false; return await voiceBank.prepare(INSTRUCTIONS); } catch { return false; } }
function cancelVoice() { previewRevision += 1; voiceBank?.stop(); }
function tone(freq, dur = 0.16, type = 'sine', gain = 0.25, delay = 0, to = null) {
  if (!sound || !audio || audio.state !== 'running' || !master) return;
  const t = audio.currentTime + delay, o = audio.createOscillator(), g = audio.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.8);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
const SFX = {
  step: () => tone(1046.5, 0.16, 'sine', 0.24),                                                     // 등불이 켜짐: 도
  correct: () => [523.25, 659.26, 783.99, 1046.5].forEach((f, i) => tone(f, 0.22, 'sine', 0.2, 0.05 + i * 0.07)),   // 해낸 부탁: 도·미·솔·도
  jump: () => tone(587.33, 0.12, 'sine', 0.1, 0, 880),                                             // 레 → 라
  slide: () => tone(293.66, 0.12, 'triangle', 0.13),
  bump: () => tone(130.81, 0.14, 'triangle', 0.28),                                                 // 부딪힘: 낮은 도 한 번(내려가는 버저 없음)
  shield: () => { tone(1046.5, 0.18, 'sine', 0.18); tone(1318.51, 0.2, 'sine', 0.16, 0.09); },
  block: () => tone(783.99, 0.2, 'sine', 0.2),
  finish: () => [523.25, 659.26, 783.99, 1046.5, 1318.51].forEach((f, i) => tone(f, 0.3, 'sine', 0.2, i * 0.09)),
};
const TUNE = [392, 0, 523.25, 587.33, 0, 659.26, 587.33, 523.25, 392, 0, 329.63, 392, 523.25, 0, 587.33, 0];
let musicClock = 0, musicStep = 0;

/* ── 상태 ── */
let world = null, worldReady = null, model = null, running = false, paused = false, ending = false, starting = false, resuming = false;
let pendingInstruction = null, retryAudio = null, collectionRoundId = null, resolvedSeen = 0, shields = 0, screen = 'lobby', lastFrame = performance.now();
const keyboard = new KeyboardInput();
const qa = { scale: 1, auto: false, plan: [] };

function show(id) {
  screen = id;
  if(id==='lobby')tutorEvent('lobby');
  for (const s of ['lobby', 'game', 'results']) byId(s).hidden = s !== id;
  document.body.classList.toggle('playing', id === 'game');
  window.scrollTo(0, 0);
  if (id === 'lobby') requestAnimationFrame(() => drawHeroRoad(byId('hero-road')));
  if (id === 'game') requestAnimationFrame(() => world?.resize());
}
const dialogs = ['pause-dialog', 'audio-dialog'];
function openDialog(id) { for (const d of dialogs) if (d !== id && byId(d).open) byId(d).close(); if (!byId(id).open) byId(id).showModal(); }
function closeDialogs() { for (const d of dialogs) if (byId(d).open) byId(d).close(); }

/* ── 입구 ── */
function renderLobby() {
  refreshRecommendation();
  const assignment = (() => { try { return coach?.assignment?.() || null; } catch { return null; } })();   // WORLD 안의 선생님 과제
  byId('l-reason').textContent = `${reasonText()}${assignment ? ' 선생님이 정한 ‘듣기 확인’이 있어요.' : ''}`;
  byId('best-line').hidden = !best; byId('best-line').textContent = best ? `최고 거리 ${meters(best)}` : '';
  const warn = !storageAvailable ? '이 브라우저에 최고 거리를 저장할 수 없어요.' : null;
  byId('storage-note').hidden = !warn; byId('storage-note').textContent = warn || '';
  const need = assignment?.requiredAttempts;
  byId('listening-check').textContent = `듣기 확인 ${Number.isInteger(need) && need > 0 && need < 3 ? need : 3}문제`;
  syncToggles();
  show('lobby');
}

function syncToggles() {
  for (const t of document.querySelectorAll('[data-sound-toggle]')) {
    t.setAttribute('aria-pressed', String(sound));
    if (t.hasAttribute('data-sound-label')) t.textContent = sound ? '소리 켜짐' : '소리 꺼짐';
    else t.setAttribute('aria-label', sound ? '소리 끄기' : '소리 켜기');
  }
  byId('resume').querySelector('span').textContent = sound ? '이어 하기' : '소리 켜고 이어 하기';
  byId('pause-copy').textContent = sound ? '바람과 목소리가 함께 멈췄어요. 이어 하면 멈춘 곳부터 다시 들려요.' : '바람길은 소리를 듣고 달려요. 이어 하면 소리가 켜지고 멈춘 곳부터 이어서 들려요.';
  byId('sound-note').hidden = sound;
}
function setSound(value) {
  if (!value && listeningCheck?.open) listeningCheck.interrupt();
  if (!value && running && !model?.finished && !paused) pause();
  sound = !!value; if (voiceGain) voiceGain.gain.value = sound ? 0.88 : 0;
  syncToggles();
}

/* ── 한 판 ── */
function ensureWorld() {
  if (!worldReady) {
    worldReady = import('./world.mjs').then(({ createWorld }) => createWorld(byId('world'), { reduced }))
      .then((w) => { world = w; return w; })
      .catch((e) => { worldReady = null; throw e; });
  }
  return worldReady;
}

async function start() {
  if (starting || listeningCheck.open) return;
  starting = true; running = false; paused = false; ending = false; model = null;
  keyboard.reset(); cancelVoice(); setSound(true); closeDialogs(); document.activeElement?.blur?.();   // 초점이 단추에 남으면 Space(점프)가 그 단추를 누른다
  show('game'); resetRunUI(); world?.clear(); tip('바람을 부르고 있어요…', 0, { silent: true });
  try {
    const [, voices] = await Promise.all([ensureWorld(), ensureVoices()]);
    if (!voices) { starting = false; tip(null); audioFault(() => start()); return; }
  } catch {
    starting = false; renderLobby();
    byId('storage-note').hidden = false; byId('storage-note').textContent = '이 브라우저에서는 3D 화면을 띄울 수 없어요. 크롬·엣지·사파리 최신판으로 열어 주세요.';
    return;
  }
  endLive();
  model = new RunnerModel({ mode: 'tour', learning: 'listen', chooseInstruction: coach ? selectInstruction : null, pace: startLive() || undefined });
  // 공통 코인(play-common): 이 판의 번호. 90초를 끝까지 달린 판만 받는다(그만두거나 부딪혀 멈추면 받지 않는다). 코인은 학습 기록에 쓰지 않는다.
  collectionRoundId = globalThis.SynkPlayCollection?.roundId('runner') || null;
  resolvedSeen = 0; shields = 0; pendingInstruction = null; ending = false; paused = false; running = true; musicClock = 0; musicStep = 0;
  world.clear(); world.resize(); updateHud(true);
  lastFrame = performance.now();
  const opening = (() => { try { return live?.intro().line?.text || null; } catch { return null; } })();
  tip(opening || '바람이 길을 알려 줘요. 잘 듣고 움직여요!', 2600);
  announce('한국어 부탁을 듣고 바람길을 달려요. 왼쪽·오른쪽 화살표로 길을 바꾸고, 위는 점프, 아래는 숙이기예요.');
  starting = false;
  tutorEvent('playing');
}

function resetRunUI() {
  sayHide(); byId('pop').hidden = true; hud.last = {};
  for (const n of byId('stage').querySelectorAll('.spark')) n.remove();
}

/** 부탁 하나가 시작된다: 기록에 내보이고 목소리를 튼다. 틀 수 없으면 달리기를 멈추고 소리를 다시 준비하게 한다. */
function showInstruction(m) {
  if (!m.presentationId) m.presentationId = learn('present', instructionMetadata(m.instruction));
  m.texted = false;
  sayShow(m);
  if (!voiceBank?.play(m)) { pendingInstruction = m; audioFault(resume); return; }
  announce('바람이 말해요. 잘 듣고 움직여요.');
}
function recordAction(m, correct) { if (!m.presentationId || m.learningClosed) return; learn('answer', m.presentationId, actionEvidence(m, correct)); m.learningClosed = true; }
function closeUnanswered() {
  for (const m of model?.missions || []) if (m.presentationId && !m.learningClosed) { learn('answer', m.presentationId, { correct: null, assessable: false, reason: 'unanswered' }); m.learningClosed = true; }
}

function handle(n) {
  switch (n.type) {
    case 'instruction': showInstruction(n.mission); tutorEvent('listening'); break;
    case 'stepResult': renderSteps(n.mission); break;
    case 'step': world?.light(n.step); SFX.step(); sparkle(); break;
    case 'correct': {
      const rec = model.answers[resolvedSeen++]; if (rec) rec.texted = !!n.mission.texted;
      recordAction(n.mission, true); sayDone(n.mission); SFX.correct();
      tutorEvent('success',{answer:true});
      popText(model.combo >= 3 ? `좋아요! 연속 ${model.combo}` : '좋아요!', 'ok', model.combo);
      punch(byId('g-combo-wrap')); break;
    }
    case 'wrong': {
      const rec = model.answers[resolvedSeen++]; if (rec) rec.texted = !!n.mission.texted;
      recordAction(n.mission, false); sayMissed(n.mission, n.record || rec); tutorEvent('retry',{answer:true,support:runnerSupport(n.record||rec)}); break;
    }
    case 'earnedShield': shields += 1; SFX.shield(); setTimeout(() => { if (running && !model?.finished) popText('바람막!', 'shield'); }, 520);
      if (shields === 1) tip('세 번 연속! 바람막이 한 번은 부딪혀도 지켜 줘요.', 2600); break;
    case 'shield': world?.knock(model); SFX.block(); popText('막았어요!', 'shield'); break;
    case 'hit': world?.knock(model); SFX.bump(); popText('쿵!', 'bump'); punch(byId('g-guard')); tutorEvent('retry',{reason:'obstacle',support:n.mission?[]:obstacleSupport(n.obstacle)}); break;
    case 'jump': SFX.jump(); break;
    case 'slide': SFX.slide(); break;
    case 'finish': finish(); break;
    default: break;
  }
  followPace(n);
}

/* ── 바람의 말 카드 ── */
const say = byId('say');
let sayTimer = 0;
function sayShow(m) {
  clearTimeout(sayTimer);
  say.hidden = false; say.dataset.phase = 'listening'; say.classList.remove('texted', 'soon');
  byId('say-tag').textContent = '바람';
  byId('say-line').textContent = '잘 들어 보세요';
  byId('say-hint').textContent = m.steps.length > 1 ? '두 가지를 차례로 부탁해요.' : '';
  byId('say-text').hidden = false;
  renderSteps(m); placeTip();
}
function sayPhase(p) {
  say.dataset.phase = p;
  if (p === 'move' && !say.classList.contains('texted')) byId('say-line').textContent = '들은 대로 움직여요!';
}
function sayText(m) {
  say.classList.add('texted'); byId('say-line').textContent = `“${m.text}”`; byId('say-text').hidden = true; placeTip();
  announce(`바람: ${m.text}`);
}
function sayDone(m) {
  clearTimeout(sayTimer);
  say.dataset.phase = 'done'; say.classList.remove('texted');
  byId('say-line').textContent = '좋아요!';
  byId('say-hint').textContent = m.steps.length > 1 ? '두 동작 모두 해냈어요. 등불이 켜졌어요.' : '해냈어요. 등불이 켜졌어요.';
  byId('say-text').hidden = true; renderSteps(m); placeTip();
  sayTimer = setTimeout(sayHide, reduced() ? 1600 : 1300);
}
/** 놓친 부탁: 무엇을 부탁했는지 짧은 종이 쪽지로(빨간 X·실패음 없음). 기록은 이미 닫혔으니 글을 보여 줘도 된다. */
function sayMissed(m, record) {
  clearTimeout(sayTimer);
  say.dataset.phase = 'missed'; say.classList.remove('texted', 'soon');
  byId('say-tag').textContent = '이렇게 부탁했어요';
  byId('say-line').textContent = `“${m.text}”`;
  const steps = record?.steps || m.steps, timingOnly = steps.every((s) => s.status === 'done' || s.status === 'timing') && steps.some((s) => s.status === 'timing');
  const hint = byId('say-hint'); hint.textContent = '';
  if (timingOnly) hint.append('동작은 맞았어요. 표시선 가까이에서 해 봐요.');
  else { hint.append('해야 했던 동작: '); steps.forEach((s, i) => { if (i) hint.append(' → '); const b = document.createElement('b'); b.textContent = actionLabel(s); hint.append(b); }); }
  byId('say-text').hidden = true; renderSteps(m); placeTip();
  announce(`놓친 부탁. 바람: ${m.text}`);
  sayTimer = setTimeout(() => { if (say.dataset.phase === 'missed') sayHide(); }, 2900);
}
function sayHide() { say.hidden = true; placeTip(); }
function renderSteps(m) {
  const box = byId('say-steps'); box.textContent = '';
  if (!m || m.steps.length < 2) return;
  const now = m.steps.findIndex((s) => !s.resolved);
  m.steps.forEach((s, i) => {
    if (i) { const arrow = document.createElement('b'); arrow.textContent = '→'; box.append(arrow); }
    const dot = document.createElement('i'); dot.textContent = String(i + 1);
    dot.className = s.resolved && s.executed ? 'done' : i === now && say.dataset.phase !== 'missed' ? 'now' : '';
    box.append(dot);
  });
}
byId('say-text').addEventListener('click', () => {
  const m = model?.currentMission;
  if (!running || paused || !m || m.texted) return;
  m.texted = true; if (m.presentationId && !m.learningClosed) learn('help', m.presentationId, 'text');
  sayText(m);
});
function placeTip() {
  const stage = byId('stage');
  stage.style.setProperty('--tip-top', `${say.hidden ? 12 : say.offsetTop + say.offsetHeight + 10}px`);
}
let tipTimer = 0;
function tip(text, ms = 0, { silent = false } = {}) {
  clearTimeout(tipTimer);
  const n = byId('tip'); n.hidden = !text; if (!text) return;
  n.textContent = text; placeTip(); if (!silent) announce(text);
  if (ms) tipTimer = setTimeout(() => { n.hidden = true; }, ms);
}
let toastTimer = 0;
function toast(text) { clearTimeout(toastTimer); const n = byId('toast'); n.textContent = text; n.hidden = false; announce(text); toastTimer = setTimeout(() => { n.hidden = true; }, 2400); }

/* 점수 글자·반짝이: 몽글 머리 위(움직임 줄이기에서는 글자만 잠깐) */
function popText(text, kind = '', combo = 0) {
  if (!world || !model) return;
  const p = byId('pop'), at = world.runnerScreen(model);
  p.textContent = text; p.hidden = false; p.dataset.kind = kind; p.dataset.tier = combo >= 6 ? '3' : combo >= 3 ? '2' : '1';
  p.style.left = `${at.x}px`; p.style.top = `${Math.max(40, at.y)}px`;
  p.classList.remove('go'); void p.offsetWidth; p.classList.add('go');
  clearTimeout(popText.t); popText.t = setTimeout(() => { p.hidden = true; }, 900);
}
function sparkle() {
  if (reduced() || !world || !model) return;
  const stage = byId('stage'), at = world.runnerScreen(model);
  for (let i = 0; i < 5; i++) {
    const s = document.createElement('i'); s.className = 'spark'; s.style.left = `${at.x - 11}px`; s.style.top = `${at.y + 10}px`; stage.append(s);
    const a = -Math.PI / 2 + (i - 2) * 0.55, d = 46 + (i % 2) * 18;
    s.animate([{ transform: 'translate(0,0) scale(.5)', opacity: 0 }, { transform: `translate(${Math.cos(a) * d * 0.5}px,${Math.sin(a) * d * 0.5}px) scale(1)`, opacity: 1, offset: 0.3 },
      { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) scale(.7)`, opacity: 0 }], { duration: 620, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = () => s.remove();
  }
}

/* ── 위 막대 알약 ── */
const hud = { last: {} };
function setHud(key, value, write) { if (hud.last[key] === value) return; hud.last[key] = value; write(value); }
function updateHud() {
  if (!model) return;
  setHud('time', Math.max(0, Math.ceil(90 - model.elapsed)), (v) => { byId('g-time').textContent = String(v); });
  setHud('done', model.correct, (v) => { byId('g-done').textContent = String(v); });
  setHud('combo', model.combo, (v) => { byId('g-combo').textContent = String(v); byId('g-combo-wrap').dataset.tier = v >= 3 ? '3' : v >= 2 ? '2' : '1'; });
  setHud('hearts', model.hearts, (v) => { [...byId('g-hearts').children].forEach((h, i) => h.classList.toggle('off', i >= v)); });
  setHud('shield', model.shield > 0, (v) => { byId('g-guard').classList.toggle('shield', v); });
  setHud('guard', `${model.hearts}:${model.shield > 0}`, () => { byId('g-guard').setAttribute('aria-label', `보호 ${model.hearts}번${model.shield > 0 ? ' · 바람막 있음' : ''}`); });
  const m = model.currentMission, step = model.currentStep;
  if (m && step && !say.hidden && (say.dataset.phase === 'listening' || say.dataset.phase === 'move')) {
    const left = step.d - model.distance;
    byId('say-near').style.transform = `scaleX(${Math.max(0, Math.min(1, left / m.cueDistance)).toFixed(3)})`;
    say.classList.toggle('soon', left < 11);
  }
}

/* ── 그림 돌리기: 멈춤을 아는 시간. 한 걸음은 0.05초까지(확인용 빨리 감기도 같은 걸음으로 나눈다) ── */
function frame(now) {
  requestAnimationFrame(frame);
  const real = Math.min((now - lastFrame) / 1000, 0.05); lastFrame = now;
  if (screen !== 'game' || !world) return;
  if (running && !paused && model && !model.finished) {
    let left = real * qa.scale;
    while (left > 1e-6 && running && !paused && !model.finished) {
      const dt = Math.min(0.05, left); left -= dt;
      if (QA && qa.auto) autopilot(model);
      model.step(dt);
      for (const n of model.drain()) handle(n);
    }
    if (sound && !paused && model && !model.finished) {
      musicClock += real;
      if (musicClock > 0.4) { musicClock = 0; const f = TUNE[musicStep++ % TUNE.length]; if (f) tone(f, 0.3, 'sine', 0.075); }
    }
    updateHud();
  }
  if (paused) { if (now - pausedDrawAt < 250) return; pausedDrawAt = now; }   // 멈춘 동안은 장면이 그대로라 가끔만 다시 그린다(크기가 바뀌어도 비지 않게)
  world.render(paused ? 0 : real, model);
}
let pausedDrawAt = 0;
requestAnimationFrame(frame);

/* ── 멈춤 · 목소리 문제 · 처음으로 ── */
function pause() {
  if (!running || !model || model.finished || paused) return;
  paused = true; keyboard.reset(); gesture = null; voiceBank?.pause().catch(() => {});
  openDialog('pause-dialog'); announce('잠깐 멈췄어요.');
  tutorEvent('paused');
}
function audioFault(retry) {
  retryAudio = retry;
  if (running) { paused = true; keyboard.reset(); voiceBank?.pause().catch(() => {}); }
  openDialog('audio-dialog');
  tutorEvent('paused');
}
async function resume() {
  if (!running || !model || model.finished || resuming) return;
  resuming = true; setSound(true);
  try {
    if (!await ensureVoices()) { audioFault(resume); return; }
    if (pendingInstruction) { if (!voiceBank.play(pendingInstruction)) { audioFault(resume); return; } pendingInstruction = null; }
    closeDialogs(); document.activeElement?.blur?.(); lastFrame = performance.now(); paused = false;
    tutorEvent('playing');
  } catch { audioFault(resume); } finally { resuming = false; }
}
function home() {
  closeUnanswered(); endLive();
  running = false; paused = false; ending = false; model = null; pendingInstruction = null;
  keyboard.reset(); cancelVoice(); closeDialogs(); tip(null); sayHide(); world?.clear();
  renderLobby();
}
byId('pause-button').addEventListener('click', () => pause());
byId('resume').addEventListener('click', () => resume());
byId('pause-dialog').addEventListener('cancel', (e) => { e.preventDefault(); resume(); });
byId('back-home').addEventListener('click', () => home());
byId('audio-retry').addEventListener('click', () => retryAudio?.());
byId('audio-home').addEventListener('click', () => home());
byId('audio-dialog').addEventListener('cancel', (e) => e.preventDefault());

/* ── 끝: 90초를 다 달렸거나(도착) 보호를 다 써서 멈췄다 ── */
function finish() {
  updateHud(); closeUnanswered(); endLive(); keyboard.reset(); cancelVoice(); clearTimeout(sayTimer); sayHide(); tip(null);
  ending = true; refreshRecommendation();
  const completed = model.reason === 'tour', distance = Math.floor(model.distance), newBest = distance > best;
  if (newBest) { best = distance; store('best', best); }
  SFX.finish(); popText(completed ? '도착!' : '여기까지!', 'end');
  renderResults({ completed, distance, newBest });
  tutorEvent('finish',{completed});
  announce(`달리기 끝. ${distance}미터, 부탁 ${model.correct}개를 해냈어요.`);
  setTimeout(() => { if (ending && screen === 'game') { ending = false; show('results'); byId('r-title').focus({ preventScroll: true }); } }, reduced() ? 700 : 1500);
}

function renderResults({ completed, distance, newBest }) {
  const s = scoreRun(model.answers, { completed });
  byId('r-kicker').textContent = newBest && best > 0 ? `바람길 · 새 최고 거리 ${meters(distance)}` : `바람길 · 90초`;
  byId('r-title').textContent = completed ? '도착!' : '여기까지 왔어요!';
  byId('r-correct').textContent = String(s.correct); byId('r-total').textContent = String(s.total);
  byId('r-stars').innerHTML = [1, 2, 3].map((i) => `<i class="${i <= s.stars ? 'on' : ''}"></i>`).join('');
  byId('r-stars').setAttribute('aria-label', `별 3개 중 ${s.stars}개`);
  for (let i = 0; i < s.stars; i++) tone([523.25, 659.26, 783.99][i], 0.22, 'sine', 0.2, 0.5 + i * 0.22);
  byId('r-mongle').src = s.stars >= 2 ? 'kit/brand/mongle-cheer.webp' : 'kit/brand/mongle-smile.webp';
  const notes = [`달린 거리 ${meters(distance)}`, `최고 연속 ${model.maxCombo}번`];
  if (shields) notes.push(`바람막 ${shields}번`);
  if (s.texted) notes.push(`글로 본 부탁 ${s.texted}개`);
  if (!completed) notes.unshift('보호를 다 써서 90초 전에 멈췄어요');
  byId('r-note').textContent = notes.join(' · ');
  // 공통 코인: 끝까지 마친 판에 완주 15 + 해낸 비율 × 10(다른 게임과 같은 규칙). 부딪혀 멈춘 판·그만둔 판은 받지 않는다.
  const coinRound = collectionRoundId; collectionRoundId = null;
  const coins = byId('r-coins'); coins.textContent = '공통 코인을 계산하고 있어요.';
  const award = globalThis.SynkPlayCollection?.award({ game: 'runner', total: s.total, correct: s.correct, completed, automatic: false, roundId: coinRound });
  if (award) award.then((result) => { coins.textContent = globalThis.SynkPlayCollection.rewardText(result); });
  else coins.textContent = '';
  // 이번 달리기의 부탁(지난 순서). 해낸 것은 펠트 체크, 다시 들을 것은 크림 원에 번호. 다시 듣기는 MP3 그대로
  const log = byId('r-log'); log.textContent = '';
  s.total || log.append(Object.assign(document.createElement('li'), { className: 'empty', textContent: '이번에는 부탁을 끝까지 듣기 전에 멈췄어요.' }));
  model.answers.forEach((a, i) => {
    const li = document.createElement('li'); li.className = a.correct ? 'ok' : 'ko';
    const acts = a.steps.map((st) => `<b>${esc(st.label)}</b>`).join(' → ');
    const state = a.correct ? '해냈어요' : a.steps.map((st) => `${st.label} ${STEP_WORD[st.status] || ''}`).join(' · ');
    li.innerHTML = `<span class="mark" aria-label="${a.correct ? '해냄' : '다시 들어 볼 부탁'}">${a.correct ? '' : i + 1}</span>
      <span class="body"><span class="line">“${esc(a.text)}”</span><span class="acts">→ ${acts}</span>
      <small>${esc(SKILL_LABEL[skillOf(a)] || a.skill)} · ${esc(state)}${a.texted ? ' · 글로 봄' : ''}</small>${a.correct ? '' : `<span class="why">${esc(a.explanation)}</span>`}</span>
      <button class="chip-btn say-again" type="button" aria-label="다시 듣기: ${esc(a.text)}">다시 듣기</button>`;
    li.querySelector('.say-again').addEventListener('click', () => preview(a));
    log.append(li);
  });
  byId('r-log-note').textContent = s.timing ? `동작은 맞았지만 표시선에서 조금 이르거나 늦은 곳 ${s.timing}개는 ‘타이밍 놓침’으로 남겼어요.` : '';
  byId('r-log-note').hidden = !s.timing;
  renderSkills(s);
  byId('r-next-reason').textContent = learningBroken() ? '학습 기록을 저장할 수 없어서 다음에도 기본 부탁으로 달려요.'
    : `${nextPlan?.reason || '아직 안 들어 본 부탁부터 준비해요.'} 다음 달리기에는 그런 부탁을 먼저 넣어요.`;
}
function renderSkills(s) {
  const ul = byId('r-skills'); ul.textContent = '';
  const report = skillReport(learn('summary'));
  const rows = report.length ? report : Object.entries(SKILL_LABEL).map(([id, label]) => ({ id, label, text: '기록을 쓸 수 없어요', tone: 'quiet', n: 0 }));
  for (const r of rows) {
    const mine = s.bySkill[r.id] || { heard: 0, done: 0 };
    const li = document.createElement('li'); li.className = r.tone === 'focus' ? 'focus' : r.tone === 'good' ? 'good' : '';
    li.innerHTML = `<b>${esc(r.label)}</b><em>${mine.heard ? `이번 ${mine.done}/${mine.heard}` : "이번 없음"}</em><span>${esc(r.text)}${r.n ? ` · 듣기 확인 ${r.n}개 중 ${r.correct}개 맞힘` : ''}</span>`;
    ul.append(li);
  }
}
async function preview(item) {
  cancelVoice(); const revision = previewRevision; setSound(true);
  if (!await ensureVoices()) { if (revision === previewRevision) toast('목소리를 준비하지 못했어요. 다시 듣기를 한 번 더 눌러 주세요.'); return; }
  if (revision !== previewRevision || screen !== 'results') return;
  if (!voiceBank.play(item)) toast('목소리를 틀지 못했어요. 다시 듣기를 한 번 더 눌러 주세요.');
}
byId('restart').addEventListener('click', () => { cancelVoice(); start(); });
byId('result-home').addEventListener('click', () => { cancelVoice(); home(); });
byId('start').addEventListener('click', () => start());

/* ── 움직이기: 키보드 · 아래 펠트 단추 · 화면 밀기 ── */
function action(value) { if (running && !paused && model && !model.finished) model.input(value); }
const moveBtn = (value) => document.querySelector(`.move[data-action="${value}"]`);
function flash(value) { const b = moveBtn(value); if (!b) return; b.classList.add('on'); clearTimeout(b.flashT); b.flashT = setTimeout(() => b.classList.remove('on'), 130); }
for (const b of document.querySelectorAll('.move')) {
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); action(b.dataset.action); });
  b.addEventListener('click', (e) => { if (e.detail === 0) action(b.dataset.action); });   // 화면 읽기 프로그램의 누르기(포인터 없이 온 click)
  b.addEventListener('contextmenu', (e) => e.preventDefault());
}
window.addEventListener('keydown', (e) => {
  if (screen !== 'game' || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.code === 'Escape') { if (e.repeat) return; if (byId('audio-dialog').open) return; if (running && model && !model.finished && !paused) { e.preventDefault(); pause(); } return; }
  if (!running || paused || !model || model.finished || byId('pause-dialog').open) return;
  if (KEY_ACTIONS[e.code]) { e.preventDefault(); const value = keyboard.down(e.code, e.repeat); if (value) { action(value); flash(value); } }
});
window.addEventListener('keyup', (e) => keyboard.up(e.code));
let gesture = null;
const stageEl = byId('stage');
byId('world').addEventListener('pointerdown', (e) => { if (!running || paused) return; gesture = { x: e.clientX, y: e.clientY, id: e.pointerId }; try { byId('world').setPointerCapture(e.pointerId); } catch { /* 이미 놓음 */ } });
byId('world').addEventListener('pointerup', (e) => {
  if (!gesture || gesture.id !== e.pointerId) return;
  const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y; gesture = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
  const value = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'slide' : 'jump';
  action(value); flash(value);
});
function cancelGesture(e) { if (!e || gesture?.id === e.pointerId) gesture = null; }
byId('world').addEventListener('pointercancel', cancelGesture);
byId('world').addEventListener('lostpointercapture', cancelGesture);
stageEl.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden && running && !paused && model && !model.finished) pause(); });
window.addEventListener('blur', () => { keyboard.reset(); if (running && !paused && model && !model.finished) pause(); });

/* ── 입구의 소리 단추 · 학습 기록 지우기 · 듣기 확인 ── */
for (const t of document.querySelectorAll('[data-sound-toggle]')) t.addEventListener('click', () => { setSound(!sound); if (sound) { audioInit(); audio?.resume?.().catch(() => {}); tone(1046.5, 0.12, 'sine', 0.18); } });
byId('learning-reset').hidden = hosted;
if (hosted) byId('learning-scope').textContent = '학습 기록은 WORLD 계정에 이어져요. 기록 공유와 삭제는 WORLD 계정 설정에서 할 수 있어요.';
byId('learning-reset').addEventListener('click', () => {
  if (!coach) return;
  if (!window.confirm('같은 주소에서 연 모든 SYNK 게임의 학습 기록을 지울까요? 최고 거리는 그대로 남아요.')) return;
  try { coach.reset(); for (const m of model?.missions || []) m.presentationId = null; learningFailed = false; nextPlan = null; }
  catch (error) { if (error?.code !== 'ACCOUNT_RESET_REQUIRED') learningFailed = true; }
  renderLobby();
});
const listeningCheck = mountListeningCheck({ coach, beforeOpen: () => { if (running && !model?.finished) return false; cancelVoice(); return true; },onListen:()=>tutorEvent('listening'),onFeedback:(correct,detail)=>tutorEvent(correct?'success':'retry',{answer:true,support:!correct&&detail?runnerCheckSupport(detail.item,detail.choice,detail.feedback):[]}),onClose:()=>tutorEvent('lobby') });

let resizeT = 0;
window.addEventListener('resize', () => { cancelGesture(); clearTimeout(resizeT); resizeT = setTimeout(() => { if (screen === 'lobby') drawHeroRoad(byId('hero-road')); placeTip(); }, 140); });
// 입구에서 펠트 그림과 3D 무대를 미리 받아 둔다(시작 단추를 누른 뒤 기다림이 짧게)
preloadImages(['tex-cream', 'tex-coral', 'badge-cream', 'badge-check', 'badge-coral', 'sparkle', 'cushion-blush-strip', 'cushion-butter-strip', 'cushion-lapis-strip'].map((n) => `kit/felt/${n}.webp`));
(window.requestIdleCallback || ((fn) => setTimeout(fn, 700)))(() => { ensureWorld().catch(() => { /* 시작할 때 다시 시도하고 안내한다 */ }); }, { timeout: 2500 });
document.fonts?.ready.then(() => { if (screen === 'lobby') drawHeroRoad(byId('hero-road')); });
renderLobby();

/* ── 확인용 ── */
// 예전 확인 도구와 같은 읽기 창(입력은 실제 키·단추로만 한다)
window.synkRunner = { get info() {
  return { version: 7, ready: true, running, paused, best, sound, voiceClips: voiceBank?.info.clips || 0, audio: voiceBank?.info || null, world: world?.info || null,
    model: model ? { distance: model.distance, elapsed: model.elapsed, lane: model.lane, x: model.x, y: model.y, slide: model.slide, hearts: model.hearts, shield: model.shield,
      combo: model.combo, correct: model.correct, answers: model.answers, finished: model.finished, reason: model.reason,
      current: model.currentMission ? { id: model.currentMission.id, text: model.currentMission.text, steps: model.currentMission.steps.map((s) => ({ action: s.action, target: s.target, remaining: s.d - model.distance, resolved: s.resolved, status: s.status })) } : null } : null };
} };

/** ?qa 자동 달리기: 부탁마다 계획(ok·miss·text)대로, 부탁 밖에서는 장애물을 피한다. 입력은 키·단추와 같은 action()으로 넣는다. */
function autopilot(m) {
  const mission = m.currentMission, step = m.currentStep, mode = mission ? qa.plan[mission.index] || 'ok' : null;
  const go = (lane) => { for (let k = 0; k < 2 && m.lane !== lane; k++) action(m.lane < lane ? 'right' : 'left'); };
  if (step && mode) {
    const ahead = step.d - m.distance;
    if (mode === 'miss') {   // 못 알아들은 사람처럼: 길은 엉뚱한 칸, 그대로 달리라면 뛰고, 뛰기·숙이기는 하지 않는다
      if (step.action === 'lane' && m.lane === step.target) action(step.target === 0 ? 'right' : 'left');
      if (step.action === 'stay' && ahead < m.speed * 0.32 && ahead > 0 && m.y === 0 && !step.qaJumped) { step.qaJumped = true; action('jump'); }
      return;
    }
    if (step.action === 'lane') go(step.target);
    if (step.action === 'jump' && ahead < m.speed * 0.32 && ahead > 0 && m.y === 0) action('jump');
    if (step.action === 'slide' && ahead < m.speed * 0.4 && ahead > 0 && m.slide === 0) action('slide');
    return;
  }
  const next = m.events.filter((e) => e.kind === 'obstacle' && !e.mission && !e.resolved && e.d > m.distance).sort((a, b) => a.d - b.d)[0];
  if (next && next.d - m.distance < 15) {
    const same = m.events.filter((e) => e.kind === 'obstacle' && !e.resolved && Math.abs(e.d - next.d) < 0.1);
    if (same.some((e) => e.lane === m.lane)) { const free = [0, 1, 2].filter((l) => !same.some((e) => e.lane === l)).sort((a, b) => Math.abs(a - m.lane) - Math.abs(b - m.lane))[0]; if (free != null) go(free); }
  }
}
if (QA) {
  window.__runner = {
    state: () => ({ screen, running, paused, ending, starting, sound,
      finished: !!model?.finished, reason: model?.reason || null, elapsed: model?.elapsed ?? 0, distance: model?.distance ?? 0, speed: model?.speed ?? 0,
      lane: model?.lane ?? 1, x: model?.x ?? 0, y: model?.y ?? 0, slide: model?.slide ?? 0, hearts: model?.hearts ?? 3, shield: model?.shield ?? 0, combo: model?.combo ?? 0,
      correct: model?.correct ?? 0, answers: (model?.answers || []).map((a) => ({ id: a.id, correct: a.correct, texted: !!a.texted, steps: a.steps.map((s) => s.status) })),
      current: model?.currentMission ? { index: model.currentMission.index, id: model.currentMission.id, text: model.currentMission.text, steps: model.currentMission.steps.map((s) => s.action),
        texted: !!model.currentMission.texted, phase: say.hidden ? null : say.dataset.phase } : null,
      card: say.hidden ? null : { phase: say.dataset.phase, line: byId('say-line').textContent, hint: byId('say-hint').textContent, texted: say.classList.contains('texted') },
      voice: voiceBank?.info || null, coins: byId('r-coins').textContent }),
    plan: (list) => { qa.plan = [...list]; },
    auto: (on = true) => { qa.auto = !!on; },
    fast: (k = 1) => { qa.scale = Math.max(0, Number(k) || 0); },
    motion: () => world?.motion(model) || null,
    sample: () => world?.sample(model) || null,
    world: () => world?.info || null,
    check: () => listeningCheck.state(),
    summary: () => learn('summary'),
  };
}

// Install after the game's pause/check state exists.
if(globalThis.parent&&globalThis.parent!==globalThis)void import('../brand-opening/game-tutor-channel.mjs').then(({connectGameTutor})=>{
 gameTutor=connectGameTutor('runner',{onHelp:()=>{pause();if(listeningCheck.open){listeningCheck.interrupt();tutorEvent('paused');}},onPracticeComplete:()=>{if(listeningCheck.open)return;if(screen==='game'&&running&&!model?.finished)void resume();else void start();},onResumeAfterHelp:()=>{if(screen==='game'&&running&&!model?.finished)void resume();}});
 if(screen==='game'&&running&&!model?.finished)tutorEvent(paused?'paused':'playing');else if(screen==='results')tutorEvent('finish',{completed:model?.reason==='tour'});else tutorEvent('lobby');
}).catch(()=>{});
