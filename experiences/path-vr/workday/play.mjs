/** 일터 체험 진행 제어. One job is one scene table (jobs/<id>/job.json): this file knows no job.
 * It joins the pure session to the interview room's film player, on-device speech recognizer and
 * seated WebXR stage. Answers and speech stay on this device. Progress and choices live in this
 * tab's sessionStorage and go when the tab closes, so the next person on a shared device starts
 * clean; what the learner types into the closing form (name, reasons, reflections) is never stored. */
import { chooseFilmSources, createFilmPlayer, evaluateFilmReadiness } from '../interview/film-player.mjs';
import { createVoiceInput, voiceError } from '../interview/voice.mjs';
import { WhisperModel } from '../interview/whisper-model.mjs';
import { createStrictVR } from '../interview/film/strict-vr.mjs';
import { validateJob, jobTexts, LANGUAGE_NAMES as KOREAN_LANGUAGE_NAMES } from './engine/job-schema.mjs';
import { createWorkdaySession } from './engine/session.mjs';
import { buildRecord, recordLines, recordSerial, RECORD_LIMITS } from './engine/record.mjs';
import { planRecordSheet, paintRecordSheet, sheetText, SHEET, SHEET_FONT } from './engine/record-sheet.mjs';
import { imagePdf } from './engine/pdf.mjs';
import { buildWorkdayStage } from './engine/place-stage.mjs';
import { CANVAS_FONT } from './engine/hud.mjs';
import { questScenePlan, createSilenceGate, clipHoldsStill } from './engine/comfort.mjs';

const $ = (id) => document.getElementById(id);
const STORE_KEY = 'synk.path.workday.v2', QUEST_SEEN_KEY = 'synk.path.workday.quest-seen';
const LANGUAGE_NAMES = Object.freeze({ mn: 'Монгол хэл', vi: 'Tiếng Việt', en: 'English', uz: 'Oʻzbekcha', ne: 'नेपाली', id: 'Bahasa Indonesia', zh: '中文', ru: 'Русский', my: 'မြန်မာ', km: 'ខ្មែរ', th: 'ไทย' });
const FADE_MS = 400, HOLD_MS = 450;
const HEADSET = /OculusBrowser|Quest|PicoBrowser/i.test(navigator.userAgent || '');
const IN_APP = /KAKAOTALK|FBAN|FBAV|FB_IAB|Instagram|Line\/|NAVER\(inapp|Zalo/i.test(navigator.userAgent || '');
const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const jobId = new URLSearchParams(location.search).get('job') || '';

let job = null, session = null, jobBase = null, manifest = null, film = null, readyClips = new Set();
let mode = 'text', hintLanguage = '', closingForm = { name: '', hard: '', decision: '', reasons: {}, ladder: {}, serial: '' };
let voice = null, preparingVoice = false, checkingMic = false, microphoneReady = false, micActive = false, micLevel = 0, micPeak = 0, heard = '', micNote = '';
let epoch = 0, busy = false, moving = false, lineDone = false, replaying = false, hintShown = false, shownSerial = -1, lastTick = performance.now();
let fade = { from: 0, to: 0, start: 0 }, vr = null, stageRef = null, vrChecked = false, vrSupported = false, vrEnteredAt = 0, vrScenes = 0, questFirstVisit = false, usedQuest = false;
let filmOff = false, unheard = false, placeNote = '', loadError = '', held = false, transcribing = false, notePage = { key: '', index: 0 };
// A spoken turn ends on quiet after speech (about two seconds), without waiting for recognised words.
const silence = createSilenceGate({ quietMs: 1800 });
let gateState = 'waiting';
const abortError = () => new DOMException('취소된 작업이에요.', 'AbortError');
const current = (token) => token === epoch;
const guard = (token) => { if (!current(token)) throw abortError(); };

/* ---------- storage ---------- */
function readStore() { try { return JSON.parse(sessionStorage.getItem(STORE_KEY) || '{}') || {}; } catch { return {}; } }
function save() {
  if (!job || !session) return;
  // Only progress, choices and settings. Name, reasons, reflections and the ladder stay in memory.
  try { const store = readStore(); store[job.id] = { data: session.serialize(), mode, hintLanguage, usedQuest, serial: closingForm.serial }; sessionStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* private mode or full storage: the run still works in memory */ }
}
function clearSaved() { try { const store = readStore(); delete store[job.id]; sessionStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* nothing to clear */ } }
function wipe() {
  if (!job || !session) return;
  if (!confirm('이 기기에 남은 진행과 고른 것, 맺음에 쓴 글을 지울까요?')) return;
  ++epoch; busy = false; moving = false; held = false; replaying = false; placeNote = '';
  stopMic(); sayPointName(null); film?.stop();
  clearSaved(); closingForm = { name: '', hard: '', decision: '', reasons: {}, ladder: {}, serial: '' }; usedQuest = false;
  // A shared device: the next person is treated as a first headset visit again.
  try { localStorage.removeItem(QUEST_SEEN_KEY); } catch { /* nothing kept */ }
  session.reset(); showPlace(job.scenes[0].place); shownSerial = -1;
  fade = { from: 0, to: 0, start: 0 }; $('veil').classList.remove('on');
  render();
}
// One bit kept on the device: whether a headset was ever used here (a first visit is one scene).
const questSeen = () => { try { return localStorage.getItem(QUEST_SEEN_KEY) === '1'; } catch { return false; } };
const markQuestSeen = () => { try { localStorage.setItem(QUEST_SEEN_KEY, '1'); } catch { /* the visit is still limited by time */ } };

/* ---------- loading ---------- */
async function getJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url} ${response.status}`);
  return response.json();
}
async function boot() {
  try {
    const index = await getJson(new URL('./jobs/index.json', import.meta.url));
    const entry = index.jobs.find((item) => item.id === jobId && item.status === 'open') || (!jobId && index.jobs.find((item) => item.status === 'open'));
    if (!entry) throw Object.assign(new Error('열려 있는 직업을 찾지 못했어요. 직업 고르기에서 다시 골라 주세요.'), { shown: true });
    jobBase = new URL(`./jobs/${entry.id}/`, import.meta.url);
    const [table, clips] = await Promise.all([getJson(new URL('job.json', jobBase)), getJson(new URL('manifest.json', jobBase)).catch(() => null)]);
    const checked = validateJob(table, clips);
    if (!checked.ok) { console.error('장면표 확인 실패', checked.errors); throw Object.assign(new Error('이 직업의 장면표에 문제가 있어 열지 못했어요.'), { shown: true }); }
    job = table;
    await prepareManifest(clips);
    const saved = readStore()[job.id] || {};
    session = createWorkdaySession(job, { saved: saved.data });
    mode = saved.mode === 'voice' ? 'voice' : 'text';
    hintLanguage = job.hintLanguages.includes(saved.hintLanguage) ? saved.hintLanguage : '';
    usedQuest = saved.usedQuest === true;
    if (typeof saved.serial === 'string') closingForm.serial = saved.serial;
    fillStatic();
    showPlace(job.scenes[0].place);
    initVR();
  } catch (error) {
    console.error('일터 불러오기 실패', error);
    loadError = error?.shown ? error.message : '일터를 불러오지 못했어요. 인터넷 연결을 확인하고 새로 고쳐 주세요.';
  }
  render();
}
/** Film sources are written relative to the job folder; the player wants addresses it can load
 * from its own folder, so hand it absolute same-origin (or media bucket) URLs. */
async function prepareManifest(source) {
  readyClips = new Set(); manifest = null;
  if (!source || !Array.isArray(source.clips) || !source.clips.length) return;
  const absolute = (value) => typeof value === 'string' && value ? new URL(value, jobBase).href : value;
  const chosen = await chooseFilmSources({ ...source, clips: source.clips.map((clip) => ({ ...clip, src: absolute(clip.src), ...(clip.fallbackSrc ? { fallbackSrc: absolute(clip.fallbackSrc) } : {}) })) });
  manifest = chosen;
  for (const clip of chosen.clips) if (evaluateFilmReadiness(chosen, [clip.id]).ready) readyClips.add(clip.id);
}
const clipOf = (id) => manifest?.clips.find((clip) => clip.id === id) || null;
const placeUrl = (id) => new URL(job.places[id].photo, jobBase).href;
/** A step plays its clip only when that clip is reviewed and films have not failed in this run. */
const canPlay = (id) => !filmOff && readyClips.has(id);
/** Every photograph a scene can show, so the headset has them uploaded before they are needed. */
function scenePlaceUrls(sceneId) {
  const scene = job.scenes.find((item) => item.id === sceneId), ids = new Set();
  const walk = (steps) => { for (const step of steps || []) {
    if (step.place) ids.add(step.place);
    if (step.type === 'tour') { ids.add(step.home); for (const id of step.board) ids.add(id); }
    for (const option of step.options || []) walk(option.then);
    if (step.type === 'report') { walk(step.then.included); walk(step.then.omitted); }
  } };
  if (scene) { ids.add(scene.place); walk(scene.steps); }
  return [...ids].map(placeUrl);
}
const preloadFor = (sceneId) => (stageRef ? stageRef.preload(scenePlaceUrls(sceneId)).catch(() => false) : Promise.resolve(false));

/* ---------- film ---------- */
function ensureFilm() {
  if (film) return film;
  // Short limits: a clip that does not start within seconds is dropped for the photograph.
  film = createFilmPlayer({ mount: $('film-stage'), manifest, transitionMs: 150, prepareTimeoutMs: 9000, startTimeoutMs: 5000, stallTimeoutMs: 5000,
    onState(event) { if (event.state === 'error' || event.state === 'blocked') filmFailed(); },
    onEnded(event) { clipEnded(event.id); },
  });
  return film;
}
/** A clip that fails to load or play must not stop the day: this run goes on with photographs and
 * captions, and the learner can ask for the films again. The player's own messages are not shown. */
function filmFailed() {
  filmOff = true; replaying = false; film?.stop();
  const state = session?.snapshot();
  if (state?.phase === 'line' && !lineDone) lineDone = true;
  render();
}
function retryFilm() {
  filmOff = false; film?.dispose(); film = null;
  const state = session.snapshot();
  if (state.phase === 'line' && !state.paused && canPlay(state.line.clip)) void playLine(state, epoch).catch(report);
  else if (state.phase === 'say' && !state.paused) void startListening(state);
  render();
}
function clipEnded(id) {
  const state = session.snapshot();
  if (replaying) { replaying = false; if (state.phase === 'say') void startListening(state); else if (state.phase === 'line') { lineDone = true; render(); } return; }
  if (state.phase === 'line' && state.line?.clip === id && !lineDone && !state.paused) finishLine();
}
function finishLine() {
  const token = epoch;
  session.advance(); save();
  void drive(token).catch(report);
}
async function playLine(state, token) {
  lineDone = false; hintShown = false; heard = ''; render();
  const id = state.line.clip;
  if (!canPlay(id)) { film?.pause(); lineDone = true; render(); return; }
  try { await ensureFilm().play(id); guard(token); }
  catch (error) { if (error?.name === 'AbortError' || !current(token)) throw abortError(); filmOff = true; lineDone = true; }
  render();
}
async function startListening(state) {
  const id = state.say?.listen;
  if (!film || !id || !canPlay(id)) return;
  try { if (film.current) await film.queue(id, { loop: true }); else await film.play(id, { loop: true }); }
  catch { /* the last frame of the line stays on screen */ }
}

/* ---------- place and fade ---------- */
function showPlace(id) {
  const place = job.places[id], photo = $('place-photo');
  photo.src = placeUrl(id); photo.alt = place.alt;
  $('place-chip').textContent = place.name;
}
const fadeValue = () => { const t = Math.min(1, Math.max(0, (performance.now() - fade.start) / FADE_MS)); return fade.from + (fade.to - fade.from) * t; };
function fadeTo(value) { fade = { from: fadeValue(), to: value, start: performance.now() }; }
/** Darken, change the picture behind the dark, brighten. The way there is never shown. */
async function movePlace(state, token) {
  shownSerial = state.placeSerial;
  const veil = $('veil'), stepMs = reducedMotion ? 0 : FADE_MS;
  $('veil-caption').textContent = state.placeCaption || '';
  placeNote = '';
  veil.classList.add('on'); fadeTo(1);
  await wait(stepMs); guard(token);
  film?.stop();
  showPlace(state.place);
  // In the headset the view stays dark until the next photograph is uploaded and on the plane.
  // If that takes long, the desk card (which stays visible in the dark) says so.
  const staged = (async () => {
    if (!(vr?.active || vr?.previewing) || !stageRef) return;
    const late = setTimeout(() => { placeNote = '다음 자리를 준비하고 있어요.'; }, 1500);
    const placed = await stageRef.placeReady(placeUrl(state.place));
    clearTimeout(late);
    placeNote = placed ? '' : '자리 사진을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.';
  })();
  await Promise.all([$('place-photo').decode?.().catch(() => {}), staged, wait(reducedMotion ? 0 : HOLD_MS)]);
  guard(token);
  veil.classList.remove('on'); fadeTo(0);
  await wait(stepMs); guard(token);
}

/* ---------- driving the session ---------- */
async function drive(token = epoch) {
  let state = session.snapshot();
  if (state.place && state.placeSerial !== shownSerial) {
    busy = true; moving = true; render();
    try { await movePlace(state, token); } finally { if (current(token)) { busy = false; moving = false; } }
  }
  state = session.snapshot();
  // Paused while the place was changing: nothing plays until 「이어서 하기」 starts this step again.
  if (state.paused) { held = true; save(); render(); return; }
  if (state.phase === 'line') await playLine(state, token);
  else {
    hintShown = false;
    // A tour or a note shows the photograph: no clip stays on the stage from the line before.
    if (state.phase === 'tour' || state.phase === 'note') film?.stop();
    if (state.phase === 'say') { heard = ''; micNote = ''; unheard = false; $('answer').value = ''; void startListening(state); }
    if (state.phase === 'scene-end') { film?.pause(); const following = nextOpenScene(state); if (following) void preloadFor(following.id); }
    if (state.phase === 'closing') { film?.stop(); fillClosing(); }
  }
  save(); render();
  if (state.phase === 'say' && mode === 'text' && !vr?.active && !vr?.previewing) $('answer').focus({ preventScroll: true });
}
function report(error) {
  if (error?.name === 'AbortError') return;
  console.error(error); busy = false; moving = false; lineDone = true; render();
}
const openScene = (scene) => !scene.done && scene.waitsFor.length === 0;
/** The scene 「다음 장면」 leads to: the next unfinished one that is not waiting for another. */
function nextOpenScene(state) {
  const scenes = state.progress.scenes, from = state.scene ? state.scene.index + 1 : 0;
  return scenes.slice(from).find(openScene) || scenes.find(openScene) || null;
}
/** Inside a headset a scene opens only if it fits the ten-minute visit (and a first visit is one scene). */
function questPlan(sceneId) {
  if (!vr?.active) return { open: true, reason: '' };
  const scene = job.scenes.find((item) => item.id === sceneId);
  return questScenePlan({ insideMs: performance.now() - vrEnteredAt, sceneMinutes: scene?.minutes || 0, firstVisit: questFirstVisit, scenesThisVisit: vrScenes });
}
function startFrom(sceneId) {
  if (!questPlan(sceneId).open) { render(); return; }
  const token = ++epoch; stopMic(); busy = false; transcribing = false;
  const state = session.startScene(sceneId);
  if (state.scene?.id !== sceneId) { render(); return; }
  if (vr?.active) { usedQuest = true; vrScenes++; markQuestSeen(); }
  void preloadFor(sceneId);
  void drive(token).catch(report);
}
function firstOpenScene() { const progress = session.snapshot().progress; return (progress.scenes.find(openScene) || progress.scenes[0]).id; }

/* ---------- voice ---------- */
function getVoice() {
  if (!voice) voice = createVoiceInput({
    modelFactory: () => new WhisperModel(),
    modelNotice: '한국어 음성 모델을 준비해요. 처음 한 번 103MB쯤 내려받고, 다음부터는 받아 둔 것을 써요.',
    finalTimeoutMs: 45_000,
    onPartial({ text }) { if (micActive || checkingMic) { heard = text || heard; renderHeard(); } },
    onResult({ text }) { if (micActive || checkingMic) { heard = text || heard; renderHeard(); } },
    onLevel(value) { micLevel = value; if (checkingMic) micPeak = Math.max(micPeak, value); if (micActive) gateState = silence.push(value, performance.now()); $('mic-meter').value = value; },
    onStatus(event) {
      $('voice-status').textContent = event.state === 'loading' ? (event.progress ? `음성 모델 준비 ${Math.round(event.progress * 100)}%` : '음성 모델을 이 기기에 준비하고 있어요.') : event.state === 'ready' ? '음성 입력을 준비했어요. 이 기기 안에서만 처리해요.' : event.state === 'error' ? event.message : $('voice-status').textContent;
      render();
    },
  });
  return voice;
}
async function prepareVoice() {
  if (preparingVoice || voice?.ready) return;
  preparingVoice = true; render();
  try { await getVoice().prepare(); }
  catch (error) { microphoneReady = false; if (error?.name !== 'AbortError') $('voice-status').textContent = voiceError(error).message; }
  finally { preparingVoice = false; render(); }
}
async function checkMicrophone() {
  if (checkingMic || !voice?.ready) return;
  checkingMic = true; microphoneReady = false; micPeak = 0; heard = ''; render();
  $('voice-status').textContent = '마이크 권한을 물으면 허용하고, “안녕하세요. 잘 부탁드립니다.”라고 말해 보세요.';
  try {
    await getVoice().start(); await wait(5500);
    const result = await getVoice().stop();
    const text = String(result.text || '').replace(/[([（【][^)\]）】]*[)\]）】]/gu, '').trim();
    microphoneReady = micPeak > 0.015 && !!text;
    $('voice-status').textContent = microphoneReady ? `마이크 확인을 마쳤어요. 들린 말: “${text}”` : micPeak <= 0.015 ? '목소리가 들리지 않았어요. 마이크가 꺼져 있지 않은지 보고 다시 눌러 주세요.' : '소리는 들렸는데 말로 알아듣지 못했어요. 한 문장을 또렷하게 다시 말해 주세요.';
  } catch (error) { $('voice-status').textContent = voiceError(error).message; }
  finally { checkingMic = false; heard = ''; render(); }
}
function stopMic() { if (micActive) { micActive = false; silence.reset(); gateState = 'waiting'; void voice?.stop().catch(() => {}); } }
async function toggleMic() {
  const state = session.snapshot();
  if (state.phase !== 'say' || state.paused || !state.say.ready || busy) return;
  const token = epoch;
  if (!micActive) {
    if (!voice?.ready) { micNote = '말로 답하려면 먼저 시작 화면에서 「한국어 음성 준비」를 눌러 주세요. 지금은 글로 답할 수 있어요.'; mode = vr?.active ? mode : 'text'; render(); return; }
    heard = ''; micNote = ''; unheard = false; busy = true; render();
    try { await getVoice().start(); guard(token); silence.reset(); gateState = 'waiting'; micActive = true; }
    catch (error) { if (current(token)) micNote = voiceError(error).message; }
    busy = false; render(); return;
  }
  const spoke = silence.heardSpeech();
  micActive = false; silence.reset(); gateState = 'waiting'; busy = true; transcribing = true; render();
  let text = '';
  try { text = String((await getVoice().stop()).text || '').trim(); } catch (error) { if (current(token)) micNote = voiceError(error).message; }
  transcribing = false;
  if (!current(token)) { render(); return; }
  busy = false; heard = text;
  if (session.canSubmit('voice', text)) return submit('voice', text);
  // Sound was there but no words came out of the recogniser: that is the device's miss, not the
  // learner's. They may say it again or move on, and the record does not count it either way.
  unheard = spoke;
  micNote = micNote || (spoke ? '기기가 말을 알아듣지 못했어요. 한 번 더 말하거나 「이대로 넘어가기」를 눌러요. 기록에는 세지 않아요.' : '말이 들리지 않았어요. 「말하기」를 누르고 한 번 더 말해 주세요.');
  render();
}
function submit(kind, text = '') {
  if (!session.canSubmit(kind, text)) return;
  const token = ++epoch; stopMic();
  film?.cancelQueued();
  session.submitSay({ mode: kind, text }); save();
  void drive(token).catch(report);
}

/* ---------- actions (page buttons and the Quest desk panel share these) ---------- */
async function action(name) {
  if (!session) return;
  const state = session.snapshot();
  const [kind, id] = name.split(':');
  try {
    if (kind === 'start') return startFrom(id || firstOpenScene());
    if (kind === 'pause') return pause();
    if (kind === 'resume') return resume();
    if (kind === 'leave') return leave();
    if (kind === 'exit') return vr?.exit();
    if (state.paused || busy) return;
    if (kind === 'hint') { session.openHint(); hintShown = true; save(); return render(); }
    if (kind === 'replay') return replay();
    if (kind === 'next') {
      if (state.phase === 'line' && lineDone) return finishLine();
      if (state.phase === 'note') { const token = ++epoch; session.advance(); return void drive(token).catch(report); }
      if (state.phase === 'tour') { const token = ++epoch; session.finishTour(); return void drive(token).catch(report); }
      if (state.phase === 'scene-end') return nextScene();
      return;
    }
    if (kind === 'opt') { stopMic(); session.choose(id); hintShown = false; return render(); }
    if (kind === 'work') { const token = ++epoch; stopMic(); session.choose(id); hintShown = false; save(); return void drive(token).catch(report); }
    if (kind === 'item') { session.toggleItem(id); return render(); }
    if (kind === 'example') { session.openExample(); save(); return render(); }
    if (kind === 'use-example') return submit('example');
    if (kind === 'skip-unheard') return unheard ? submit('unheard') : undefined;
    if (kind === 'retry-film') return retryFilm();
    if (kind === 'mic') return toggleMic();
    if (kind === 'answer') return submit(outward(state.say) ? 'own-text' : 'text', $('answer').value);
    if (kind === 'own-voice') return submit('own-voice');
    if (kind === 'go') { const token = ++epoch; session.goTo(id); hintShown = false; return void drive(token).catch(report); }
    if (kind === 'point') { session.hear(id); hintShown = false; sayPointName(session.snapshot().tour?.openPoint); save(); return render(); }
    if (kind === 'close-point') { session.closePoint(); return render(); }
    if (kind === 'note-next') { notePage = { ...notePage, index: notePage.index + 1 }; return render(); }
    if (kind === 'note-prev') { notePage = { ...notePage, index: Math.max(0, notePage.index - 1) }; return render(); }
  } catch (error) { report(error); }
}
function nextScene() {
  const state = session.snapshot(), following = nextOpenScene(state);
  if (!following) {
    // Nothing left to open: the closing is on the page, outside the headset.
    if (vr?.active) { void vr.exit(); return; }
    const token = ++epoch; session.nextScene();
    return void drive(token).catch(report);
  }
  startFrom(following.id);
}
function replay() {
  const id = session.replay(); save();
  if (!id) return;
  if (!canPlay(id)) { render(); return; }
  stopMic(); replaying = true; lineDone = false;
  void ensureFilm().play(id).catch((error) => { replaying = false; lineDone = true; if (error?.name !== 'AbortError') filmOff = true; render(); });
  render();
}
let pointAudio = null;
/** A point's name is always shown. It is also spoken when the job supplies a recording, or when
 * this device has a Korean voice of its own; otherwise it stays silent. */
function sayPointName(point) {
  pointAudio?.pause(); pointAudio = null;
  const synth = globalThis.speechSynthesis;
  try { synth?.cancel(); } catch { /* no voice engine */ }
  if (!point) return;
  if (point.audio) { pointAudio = new Audio(new URL(point.audio, jobBase).href); void pointAudio.play().catch(() => {}); return; }
  try {
    const korean = synth?.getVoices().find((item) => /^ko(?:[-_]|$)/i.test(item.lang));
    if (!korean) return;
    const words = new SpeechSynthesisUtterance(point.label);
    words.lang = 'ko-KR'; words.voice = korean; words.rate = 0.9;
    synth.speak(words);
  } catch { /* the name stays on screen without sound */ }
}
function pause() {
  const state = session.snapshot();
  if (state.paused || !['line', 'say', 'tour', 'note'].includes(state.phase)) return;
  stopMic(); sayPointName(null); film?.pause(); session.pause(); render();
}
function resume() {
  if (!session.snapshot().paused) return;
  session.resume(); lastTick = performance.now();
  if (held) { held = false; void drive(epoch).catch(report); render(); return; }
  void film?.resume().catch(() => { lineDone = true; render(); });
  render();
}
function leave() {
  ++epoch; busy = false; moving = false; held = false; transcribing = false; stopMic(); sayPointName(null); film?.stop(); replaying = false;
  session.leave(); save();
  if (vr?.active) void vr.exit();
  showPlace(job.scenes[0].place); shownSerial = -1; fade = { from: 0, to: 0, start: 0 }; $('veil').classList.remove('on');
  render();
}

/* ---------- rendering ---------- */
const hintOf = (value) => (hintLanguage && value?.[hintLanguage]) || '';
const TOOL_NAMES = Object.freeze({ screen: '업무 화면', paper: '서류', phone: '전화', chat: '채팅' });
const CHANNEL_NAMES = Object.freeze({ phone: '전화', chat: '채팅' });
/** relay out: Korean words said on to a guest in the learner's own language. Nothing is transcribed. */
const outward = (say) => say?.kind === 'relay' && say.direction === 'out';
/** The example a turn offers: Korean, or for relay out the same words in the learner's language. */
const exampleOf = (say) => (outward(say) ? foreignOf(say.foreign) : say?.example ? { code: '', text: say.example } : null);
/** A guest's words in the learner's language: the chosen hint language, English when none was chosen. */
/** A person's words: their one language if they have one, else the learner's language. */
const spokenOf = (person, words) => (person?.language ? { code: person.language, text: words?.[person.language] || '' } : localOf(words));
const foreignOf = (foreign) => spokenOf(foreign, foreign?.text);
/** 「내 나라 말로」, or 「영어로」 for a guest who speaks English to every learner. */
const sayOnIn = (say) => (say?.foreign?.language ? `${KOREAN_LANGUAGE_NAMES[say.foreign.language] || say.foreign.language}로` : '내 나라 말로');
/** A value written once per language (a guest's words, name or booking cell) in the learner's language, else English.
 * A plain Korean text stays as it is (code ''). */
function localOf(value) {
  if (typeof value === 'string') return { code: '', text: value };
  const code = value?.[hintLanguage] ? hintLanguage : 'en';
  return { code, text: value?.[code] || '' };
}
const nameOf = (person) => (person?.names ? localOf(person.names) : { code: '', text: person?.name || '' });
/** An element holding words that may be in another script: lang lets the device font draw them whole. */
function localNode(tag, value) {
  const { code, text } = localOf(value), node = Object.assign(document.createElement(tag), { textContent: text });
  if (code) node.lang = code;
  return node;
}
/** 「이름 · 역할」 with the name in the learner's language. */
function setWho(id, person, rest) {
  const node = $(id), name = person ? nameOf(person) : null, key = JSON.stringify([name, rest]);
  if (node.dataset.key === key) return;
  node.dataset.key = key;
  if (!name) { node.replaceChildren(); return; }
  const span = Object.assign(document.createElement('span'), { textContent: name.text });
  if (name.code) span.lang = name.code;
  node.replaceChildren(span, rest);
}
const toolText = (tool) => [...(tool?.rows || []).map(([label, value]) => `${label}: ${localOf(value).text}`), ...(tool?.lines || []).map((row) => localOf(row).text), tool?.note || ''].filter(Boolean).join('\n');
/** 「바리스타는」, 「제조 현장은」: 은 after a final consonant, 는 otherwise (and for a name not ending in Hangul). */
function withTopic(word) {
  const last = String(word).trim().slice(-1), code = last.charCodeAt(0) - 0xAC00;
  return `${word}${code >= 0 && code < 11172 && code % 28 ? '은' : '는'}`;
}
function setText(id, text) { const node = $(id); if (node.textContent !== text) node.textContent = text; }
function renderHeard() { $('heard').textContent = heard ? `들린 말: ${heard}` : ''; }
function fillStatic() {
  document.title = `SYNK PATH · ${job.title}`;
  setText('job-role', job.role); setText('job-title-main', job.title); setText('job-summary', job.summary);
  setText('gauge-scenes', String(job.scenes.length)); setText('gauge-minutes', String(job.minutes));
  setText('review-note', job.reviewNote || ''); $('review-note').hidden = !job.reviewNote;
  $('in-app-note').hidden = !IN_APP;
  const select = $('hint-language');
  for (const code of job.hintLanguages) { const option = document.createElement('option'); option.value = code; option.textContent = LANGUAGE_NAMES[code] || code; select.append(option); }
  select.value = hintLanguage;
  $('hint-field').hidden = job.hintLanguages.length === 0;
  document.querySelector(`input[name="mode"][value="${mode}"]`).checked = true;
}
function button(label, onClick, { pressed, className, disabled } = {}) {
  const node = document.createElement('button'); node.type = 'button'; node.textContent = label; node.disabled = !!disabled;
  if (className) node.className = className;
  if (pressed !== undefined) node.setAttribute('aria-pressed', String(pressed));
  node.addEventListener('click', onClick); return node;
}
function renderList(container, key, build) {
  if (container.dataset.key === key) return;
  // A rebuilt list keeps keyboard focus on the button in the same place.
  const focused = container.contains(document.activeElement) ? [...container.querySelectorAll('button')].indexOf(document.activeElement) : -1;
  container.dataset.key = key; container.replaceChildren(...build());
  if (focused >= 0) container.querySelectorAll('button')[focused]?.focus({ preventScroll: true });
}
function render() {
  const body = document.body;
  if (loadError || !session) {
    body.dataset.phase = loadError ? 'error' : 'loading';
    setText('status', loadError || '일터를 불러오고 있어요.');
    $('setup').hidden = true; $('play').hidden = true; return;
  }
  const state = session.snapshot(), phase = state.paused ? 'paused' : state.phase;
  const active = ['line', 'say', 'tour', 'note', 'scene-end'].includes(state.phase);
  body.dataset.phase = phase; body.dataset.mode = mode; body.dataset.mic = micActive ? 'on' : 'off';
  body.classList.toggle('in-session', active); body.classList.toggle('in-closing', state.phase === 'closing');
  // progress slots
  renderList($('slots'), JSON.stringify([state.progress.scenes, state.scene?.id, state.phase, checkingMic]), () => [...state.progress.scenes.map((scene, index) => {
    const waits = scene.waitsFor.length ? `「${scene.waitsFor.join('」, 「')}」 장면을 마치면 열려요` : '';
    const item = document.createElement('li'), node = button(`${index + 1} ${scene.title}`, () => { if (!active && !checkingMic) startFrom(scene.id); });
    node.disabled = active || !!waits || checkingMic; if (scene.done) item.classList.add('done'); if (waits) item.classList.add('waits'); if (state.scene?.id === scene.id) item.classList.add('now');
    node.setAttribute('aria-label', `장면 ${index + 1} ${scene.title}${scene.done ? ' · 마침' : ''}${waits ? ` · ${waits}` : ''}`);
    if (waits) node.title = waits;
    item.append(node); return item;
  }), (() => { const item = document.createElement('li'); item.className = `last${state.phase === 'closing' ? ' now' : ''}`; const node = button('맺음', () => openClosing()); node.disabled = active || !state.progress.anyDone; item.append(node); return item; })()]);
  setText('scene-chip', state.scene ? `장면 ${state.scene.index + 1} / ${state.scene.total} · ${state.scene.title}` : state.phase === 'closing' ? '맺음' : '시작 전');
  $('pause-overlay').hidden = !state.paused;
  // caption: never over the dark while the place changes
  const line = state.line, showLine = !!line && ['line', 'say'].includes(state.phase) && !moving;
  $('caption').hidden = !showLine;
  for (const id of ['caption-hint', 'help-hint', 'point-hint', 'note-hint']) { if (hintLanguage) $(id).lang = hintLanguage; else $(id).removeAttribute('lang'); }
  if (showLine) {
    $('caption').classList.toggle('action', line.action);
    $('caption').classList.toggle('phone', line.channel === 'phone');
    $('caption').classList.toggle('chat', line.channel === 'chat');
    setWho('caption-who', line.action ? null : line, ` · ${line.role}${CHANNEL_NAMES[line.channel] ? ` · ${CHANNEL_NAMES[line.channel]}` : ''}`);
    // A person speaking the learner's language: their words first, the Korean meaning under them.
    const said = line.foreign ? spokenOf(line, line.foreign) : { code: '', text: line.text };
    setText('caption-text', said.text);
    if (said.code) $('caption-text').lang = said.code; else $('caption-text').removeAttribute('lang');
    $('caption-meaning').hidden = !line.foreign; setText('caption-meaning', line.foreign ? `뜻: ${line.text}` : '');
    const lineHint = state.phase === 'line' && hintShown ? hintOf(line.hint) : '';
    $('caption-hint').hidden = !lineHint; setText('caption-hint', lineHint);
  }
  $('setup').hidden = state.phase !== 'idle'; $('play').hidden = !active; $('closing').hidden = state.phase !== 'closing';
  if (state.phase === 'idle') renderSetup(state);
  if (active) renderPlay(state);
  renderPoints(state);
}
function renderSetup(state) {
  const started = state.progress.anyDone, upNext = state.progress.scenes.find(openScene);
  setText('status', state.progress.allDone ? '장면을 모두 마쳤어요. 맺음에서 체험 기록을 받을 수 있어요.' : started ? '하던 곳부터 이어서 할 수 있어요. 다른 사람이 하던 것이면 「처음부터 새로 하기」를 눌러요.' : '의자에 앉아서 시작해요. 장면마다 2~3분쯤 걸려요.');
  // The voice model may still be downloading: answering in writing can start at once, as the hint says.
  $('start').disabled = checkingMic || (preparingVoice && mode === 'voice');
  $('preview').disabled = checkingMic;
  // With every scene finished the main button leads to the closing; a scene is run again from its slot.
  setText('start', !upNext ? '맺음과 체험 기록 보기' : started ? `이어서 하기 · ${upNext.title}` : '시작');
  $('restart').hidden = !started;
  $('voice-prepare').hidden = mode !== 'voice' || !!voice?.ready; $('voice-prepare').disabled = preparingVoice;
  setText('voice-prepare', preparingVoice ? '한국어 음성 준비 중…' : '1. 한국어 음성 준비');
  $('microphone-check').hidden = mode !== 'voice' || !voice?.ready; $('microphone-check').disabled = checkingMic;
  setText('microphone-check', checkingMic ? '듣고 있어요…' : microphoneReady ? '마이크 다시 확인' : '2. 마이크 확인');
  $('voice-hint').hidden = mode !== 'voice' || !!voice?.ready;
  $('mic-meter').hidden = !checkingMic;
  $('open-closing').hidden = !started || !upNext; $('open-closing').disabled = checkingMic;
  // The headset stage is built only on a headset browser, or after the learner asks for the check.
  $('vr').disabled = vrChecked ? (!vrSupported || mode !== 'voice' || !voice?.ready || !microphoneReady || !!vr?.active) : false;
  setText('vr', !vrChecked ? 'VR 기기인지 확인' : vrSupported ? 'Quest로 들어가기' : 'Quest에서 VR 입장');
  for (const input of document.querySelectorAll('input[name="mode"]')) { input.disabled = checkingMic; input.checked = input.value === mode; }
}
function renderPlay(state) {
  const phase = state.phase, say = state.say, tour = state.tour;
  const status = state.paused ? '잠시 멈췄어요. 마이크도 껐어요.'
    : phase === 'line' ? (state.line.action ? '지금 일어난 일을 봐요.' : state.line.channel === 'chat' ? '메시지를 읽고 「다음」을 눌러요.' : !canPlay(state.line.clip) ? '자막을 읽고 「다음」을 눌러요.' : lineDone ? '다 들었으면 「다음」을 눌러요.' : `${nameOf(state.line).text}의 말을 들어요.`)
    : phase === 'say' ? (micActive ? '듣고 있어요. 말을 마치면 알아서 넘어가요.' : transcribing ? '말한 것을 글로 바꾸고 있어요. 잠시만 기다려요.' : say.kind === 'work' ? '화면과 서류를 보고 골라요.' : outward(say) ? (mode === 'voice' ? `${sayOnIn(say)} 소리 내어 전하고 「말로 전했어요」를 눌러요.` : `${sayOnIn(say)} 쓰고 「답하기」를 눌러요.${say.foreign.language ? '' : ' 어떤 글자로 써도 돼요.'}`) : say.kind === 'relay' ? '외국인의 말을 한국어로 전해요.' : say.kind === 'fork' && !say.chosen ? '어떻게 할지 먼저 골라요.' : say.kind === 'report' && !say.ready ? '보고할 일을 골라요.' : mode === 'voice' ? '「말하기」를 누르고 한국어로 말해요.' : '한국어로 쓰고 「답하기」를 눌러요.')
    : phase === 'tour' ? '둘러보는 중이에요. 점을 누르면 이름이 나와요.'
    : phase === 'note' ? '읽고 「다음」을 눌러요.'
    : '한 장면을 마쳤어요.';
  setText('status', micNote && phase === 'say' && !micActive ? micNote : status);
  $('film-note').hidden = !filmOff || !manifest;
  // say
  $('say-panel').hidden = phase !== 'say';
  if (phase === 'say') {
    setText('say-prompt', say.prompt);
    setText('example-label', say.kind === 'fork' ? '이 선택의 말' : '예시 문장');
    const list = say.kind === 'report' ? say.items.map((item) => ({ id: `item:${item.id}`, label: item.text, pressed: item.selected })) : say.options.map((item) => ({ id: `${say.kind === 'work' ? 'work' : 'opt'}:${item.id}`, label: item.label, pressed: say.chosen === item.id, disabled: item.tried }));
    // The tool card: a work screen, paper, phone or chat drawn from the scene table's words.
    const tool = say.kind === 'work' ? say.tool : null;
    $('tool-card').hidden = !tool;
    if (tool) {
      $('tool-card').dataset.kind = tool.kind;
      setText('tool-kind', TOOL_NAMES[tool.kind] || ''); setText('tool-title', tool.title);
      renderList($('tool-rows'), JSON.stringify([say.id, tool.rows || [], hintLanguage]), () => (tool.rows || []).flatMap(([label, value]) => [Object.assign(document.createElement('dt'), { textContent: label }), localNode('dd', value)]));
      $('tool-rows').hidden = !(tool.rows || []).length;
      renderList($('tool-lines'), JSON.stringify([say.id, tool.lines || [], hintLanguage]), () => (tool.lines || []).map((row) => localNode('p', row)));
      $('tool-lines').hidden = !(tool.lines || []).length;
      setText('tool-note', tool.note || ''); $('tool-note').hidden = !tool.note;
    }
    // in: a guest speaking the learner's language. out: the Korean words to say on to that guest.
    const out = outward(say), foreign = say.kind === 'relay' ? (out ? { code: 'ko', text: say.meaning } : foreignOf(say.foreign)) : null;
    $('foreign').hidden = !foreign;
    $('foreign').classList.toggle('out', out);
    if (foreign) {
      setWho('foreign-who', say.foreign, out ? `님께 전할 말${say.channel === 'phone' ? ' · 전화' : ''}` : ` · ${say.foreign.role}${say.channel === 'phone' ? ' · 전화' : ''}`);
      setText('foreign-text', foreign.text); $('foreign-text').lang = foreign.code;
    }
    renderList($('options'), JSON.stringify([say.id, list]), () => list.map((item) => button(item.label, () => void action(item.id), { pressed: item.pressed, disabled: item.disabled, className: say.kind === 'report' ? 'check' : 'option' })));
    $('options').hidden = list.length === 0;
    const example = exampleOf(say);
    $('example').hidden = !say.exampleOpen || !example; setText('example-text', example?.text || '');
    if (example?.code) $('example-text').lang = example.code; else $('example-text').removeAttribute('lang');
    const chosen = say.options.find((item) => item.id === say.chosen);
    const selectedHints = say.kind === 'report' ? say.items.filter((item) => item.selected).map((item) => hintOf(item.hint)) : [];
    const helpHint = hintShown ? [hintOf(say.hint), hintOf(chosen?.hint), ...selectedHints].filter(Boolean).join('\n') : '';
    $('help-hint').hidden = !helpHint; setText('help-hint', helpHint);
    $('answer-area').hidden = !say.ready;
    $('answer').hidden = mode !== 'text'; $('answer-label').hidden = mode !== 'text'; $('answer').disabled = state.paused || busy;
    setText('answer-label', out ? `${sayOnIn(say)} 쓰기` : '내 말'); $('answer').placeholder = !out ? '한국어로 써 주세요.' : say.foreign.language ? `${sayOnIn(say)} 써 주세요.` : '어떤 글자로 써도 돼요.';
    renderHeard();
  }
  // tour
  $('tour-panel').hidden = phase !== 'tour';
  if (phase === 'tour') {
    setText('tour-prompt', tour.prompt + (hintShown && !tour.openPoint && hintOf(tour.hint) ? `\n${hintOf(tour.hint)}` : ''));
    const places = [{ id: tour.home, name: job.places[tour.home].name, visited: true }, ...tour.board];
    renderList($('board'), JSON.stringify([places, tour.current]), () => places.map((item) => button(item.name, () => void action(`go:${item.id}`), { pressed: tour.current === item.id, className: 'option' })));
    const point = tour.openPoint;
    $('point-card').hidden = !point || !!point.note;
    if (point) { setText('point-label', point.label); const text = hintShown ? hintOf(point.hint) : ''; $('point-hint').hidden = !text; setText('point-hint', text); }
  }
  // note (a step, or a point that opens a note during the tour)
  const note = state.note || tour?.openPoint?.note || null;
  $('note-panel').hidden = !note;
  if (note) {
    setText('note-title', note.title); setText('note-lead', note.lead || '');
    renderList($('note-body'), note.id, () => note.rows ? [Object.assign(document.createElement('dl'), { className: 'timetable' })].map((list) => { for (const [time, what] of note.rows) { const term = document.createElement('dt'), detail = document.createElement('dd'); term.textContent = time; detail.textContent = what; list.append(term, detail); } return list; }) : note.body.map((text) => Object.assign(document.createElement('p'), { textContent: text })));
    const text = hintShown ? hintOf(note.hint) : ''; $('note-hint').hidden = !text; setText('note-hint', text);
  }
  // rest card
  const nextUp = phase === 'scene-end' ? nextOpenScene(state) : null;
  $('rest-panel').hidden = phase !== 'scene-end';
  if (phase === 'scene-end') { setText('rest-title', `「${state.scene.title}」 장면을 마쳤어요.`); setText('rest-text', nextUp ? '쉬었다가 이어서 해도 돼요. 이 창을 닫기 전까지 진행이 남아요.' : '맺음에서 오늘 고른 것을 돌아보고 체험 기록을 받아요.'); }
  // buttons
  const primary = $('primary');
  const primaryLabel = state.paused ? '이어서 하기'
    : phase === 'line' ? '다음'
    : phase === 'say' ? (mode === 'voice' ? (outward(say) ? '말로 전했어요' : micActive ? '말 끝내기' : transcribing ? '글로 바꾸는 중' : '말하기') : '답하기')
    : phase === 'tour' ? (tour.openPoint?.note ? '닫기' : '둘러보기 마치기')
    : phase === 'note' ? '다음'
    : nextUp ? `다음 장면 · ${nextUp.title}` : '맺음 보기';
  setText('primary', primaryLabel);
  // A tool step ends on its options; it has no main button of its own.
  primary.hidden = phase === 'line' && !lineDone && !state.paused || phase === 'say' && say.kind === 'work' && !state.paused;
  primary.disabled = busy && !state.paused || phase === 'say' && !state.paused && (!say.ready || mode === 'text' && !session.canSubmit(outward(say) ? 'own-text' : 'text', $('answer').value));
  const hintAvailable = hintAvailableFor(state);
  $('hint-button').hidden = !hintAvailable || hintShown;
  // 「다시 듣기」 only when there is a film to hear again; with photographs and captions there is nothing to replay.
  $('replay').hidden = state.paused || !['line', 'say'].includes(phase) || !state.line || state.line.action || micActive || !canPlay(state.line.clip);
  $('example-button').hidden = state.paused || phase !== 'say' || !exampleOf(say) || say.exampleOpen;
  setText('example-button', say?.kind === 'fork' ? '이 선택의 말 보기' : '예시 문장 보기');
  $('use-example').hidden = state.paused || phase !== 'say' || !say.ready || micActive || !(say.exampleOpen || say.kind === 'report');
  setText('use-example', useExampleLabel(say));
  $('skip-unheard').hidden = state.paused || phase !== 'say' || !unheard || micActive;
  $('finish-here').hidden = phase !== 'scene-end' || !nextUp;
  $('pause').hidden = state.paused || phase === 'scene-end' || moving;
  setText('leave', phase === 'scene-end' ? '시작 화면으로' : '그만하기');
}
function useExampleLabel(say) { return say?.kind === 'report' ? '말하지 않고 보고하기' : say?.kind === 'fork' ? '이 말 그대로 답하기' : outward(say) ? '예시를 보고 전했어요' : '예시 문장으로 답하기'; }
/** Whether this step has a hint in the chosen language: the page and the desk card show the button on the same rule. */
function hintAvailableFor(state) {
  if (!hintLanguage || state.paused) return false;
  const say = state.say, tour = state.tour, chosen = say?.options?.find((item) => item.id === say.chosen);
  if (state.phase === 'line') return !!hintOf(state.line?.hint);
  if (state.phase === 'say') return !!(hintOf(say.hint) || hintOf(chosen?.hint) || (say.kind === 'report' && say.items.some((item) => item.selected && hintOf(item.hint))));
  if (state.phase === 'tour') return !!hintOf(tour.openPoint ? (tour.openPoint.note?.hint || tour.openPoint.hint) : tour.hint);
  if (state.phase === 'note') return !!hintOf(state.note?.hint);
  return false;
}
/** A note's words split into pages that fit the desk card's three body rows. */
const NOTE_PAGE_CHARS = 120;
function notePages(note, text) {
  const pieces = text ? [text] : [note.lead, ...(note.rows ? note.rows.map(([time, what]) => `${time}  ${what}`) : note.body || [])].filter(Boolean);
  const sentences = pieces.flatMap((piece) => piece.length <= NOTE_PAGE_CHARS ? [piece] : (piece.match(/[^.?!。]+[.?!。]?\s*/gu) || [piece]).map((part) => part.trim()).filter(Boolean));
  const pages = [];
  for (const sentence of sentences) {
    const last = pages.at(-1);
    if (last && last.length + sentence.length + 1 <= NOTE_PAGE_CHARS && (!note.rows || last.split('\n').length < 3)) pages[pages.length - 1] = `${last}${note.rows ? '\n' : ' '}${sentence}`;
    else pages.push(sentence);
  }
  return pages.length ? pages : [''];
}
function notePaged(view, note, doneAction, doneLabel) {
  const key = `${note.id}|${hintShown ? hintLanguage : ''}`;
  if (notePage.key !== key) notePage = { key, index: 0 };
  const pages = notePages(note, hintShown ? hintOf(note.hint) : '');
  const index = Math.min(notePage.index, pages.length - 1);
  view.status = pages.length > 1 ? `읽기 · ${index + 1}/${pages.length}쪽` : '읽기';
  view.title = note.title; view.body = pages[index];
  const main = (id, label, extra = {}) => view.buttons.push({ id, label, row: 'main', ...extra });
  if (index > 0) main('note-prev', '앞 쪽');
  if (index < pages.length - 1) main('note-next', '다음 쪽', { primary: true });
  else main(doneAction, doneLabel, { primary: true });
}
function renderPoints(state) {
  // The next place's points appear only after the dark, never over the photograph being left.
  const tour = state.phase === 'tour' && !state.paused && !moving ? state.tour : null;
  const points = tour ? tour.points : [];
  renderList($('points'), JSON.stringify([points, tour?.openPoint?.id, tour?.current]), () => points.map((point) => {
    const node = button('', () => void action(`point:${point.id}`), { className: 'point' });
    node.style.left = `${point.x * 100}%`; node.style.top = `${point.y * 100}%`;
    node.setAttribute('aria-label', point.heard ? point.label : '이름 보기');
    if (point.x >= 0.7) node.classList.add('left');
    if (point.heard || tour.openPoint?.id === point.id) { node.classList.add('named'); const tag = document.createElement('span'); tag.textContent = point.label; node.append(tag); }
    node.setAttribute('aria-expanded', String(tour.openPoint?.id === point.id));
    if (tour.openPoint?.id === point.id) node.classList.add('open');
    return node;
  }));
}

/* ---------- closing and record ---------- */
function openClosing() {
  if (!session.snapshot().progress.anyDone) return;
  ++epoch; stopMic();
  session.openClosing();
  void drive().catch(report);
}
function currentRecord() {
  if (!closingForm.serial) { const bytes = new Uint8Array(6); crypto.getRandomValues(bytes); closingForm.serial = recordSerial(new Date(), bytes); }
  return buildRecord(job, session.serialize(), { ...closingForm, view: usedQuest ? 'quest' : 'screen', date: new Date(), serial: closingForm.serial, films: readyClips.size > 0 });
}
function field(labelText, input, helpText) {
  const wrap = document.createElement('div'); wrap.className = 'field';
  const label = document.createElement('label'); label.textContent = labelText; label.htmlFor = input.id;
  wrap.append(label, input);
  if (helpText) wrap.append(Object.assign(document.createElement('p'), { className: 'small', textContent: helpText }));
  return wrap;
}
/** A closing item's hint in the chosen language, always shown: the closing is what the learner decides on. */
function closingHint(hint) {
  const text = hintOf(hint);
  return text ? [Object.assign(document.createElement('p'), { className: 'hint closing-hint', textContent: text, lang: hintLanguage })] : [];
}
function fillClosing() {
  const closing = job.closing, data = session.serialize();
  setText('closing-lead', closing.lead);
  const principles = new Map(closing.principles.map((item) => [item.id, item]));
  setText('closing-title', session.snapshot().progress.allDone ? '오늘 하루를 마쳤어요.' : '여기까지 한 것을 돌아봐요.');
  // Only forks of finished scenes, the same rule as the record below.
  $('forks').replaceChildren(...closing.forks.filter((fork) => data.forks[fork.id] && data.scenes?.[data.forkScene?.[fork.id]]?.done === true).map((fork) => {
    const principle = principles.get(fork.principle), row = document.createElement('div'); row.className = 'fork';
    const scene = Object.assign(document.createElement('p'), { className: 'fork-scene', textContent: fork.scene });
    const mine = document.createElement('div'); mine.className = 'fork-mine';
    mine.append(Object.assign(document.createElement('span'), { textContent: '오늘 나는' }), Object.assign(document.createElement('p'), { textContent: fork.mine[data.forks[fork.id]] }));
    const theirs = document.createElement('div'); theirs.className = 'fork-principle';
    theirs.append(Object.assign(document.createElement('span'), { textContent: withTopic(job.role) }), Object.assign(document.createElement('strong'), { textContent: principle.title }), Object.assign(document.createElement('p'), { textContent: principle.body }), ...closingHint(principle.hint));
    // One sentence the occupation would say here, shown whatever was chosen.
    const model = document.createElement('p'); model.className = 'fork-say';
    model.append(Object.assign(document.createElement('span'), { textContent: '이렇게 말해요' }), document.createTextNode(fork.say));
    theirs.append(model);
    const reason = Object.assign(document.createElement('input'), { type: 'text', id: `reason-${fork.id}`, maxLength: RECORD_LIMITS.reason, value: closingForm.reasons[fork.id] || '' });
    reason.addEventListener('input', () => { closingForm.reasons[fork.id] = reason.value; closingChanged(); });
    row.append(scene, mine, theirs, field('왜 그렇게 골랐나요? (안 써도 돼요)', reason, '모국어로 써도 돼요.'));
    return row;
  }));
  setText('conditions-lead', closing.conditions.lead);
  $('conditions').replaceChildren(...closing.conditions.items.flatMap((item) => {
    const term = Object.assign(document.createElement('dt'), { textContent: item.title }), detail = Object.assign(document.createElement('dd'), { textContent: item.body });
    detail.append(...closingHint(item.hint));
    if (item.source) detail.append(Object.assign(document.createElement('small'), { textContent: item.source }));
    return [term, detail];
  }));
  const reflection = closing.reflection;
  setText('decision-label', reflection.decisionLabel); setText('decision-note', reflection.decisionNote || '');
  const decisions = $('decisions');
  for (const node of [...decisions.querySelectorAll('label')]) node.remove();
  for (const item of reflection.decisions) {
    const label = document.createElement('label'), input = Object.assign(document.createElement('input'), { type: 'radio', name: 'decision', value: item.id, checked: closingForm.decision === item.id });
    input.addEventListener('change', () => { closingForm.decision = item.id; closingChanged(); });
    label.append(input, Object.assign(document.createElement('span'), { textContent: item.label }), ...closingHint(item.hint)); decisions.append(label);
  }
  setText('hard-label', reflection.hardLabel); setText('hard-help', reflection.hardHelp || ''); $('hard').value = closingForm.hard || '';
  setText('ladder-lead', closing.ladder.lead);
  $('ladder').replaceChildren(...closing.ladder.items.map((item) => {
    const input = Object.assign(document.createElement('input'), { type: 'text', id: `ladder-${item.id}`, maxLength: RECORD_LIMITS.ladder, value: closingForm.ladder[item.id] || '', placeholder: item.placeholder || '' });
    input.addEventListener('input', () => { closingForm.ladder[item.id] = input.value; closingChanged(); });
    const wrap = field(item.label, input);
    wrap.append(...closingHint(item.hint));
    return wrap;
  }));
  $('name').value = closingForm.name || '';
  const next = closing.next, link = $('next-link');
  link.hidden = !next;
  if (next) { link.href = new URL(next.href, new URL('./', import.meta.url)).href; setText('next-label', next.label); setText('next-body', next.body || ''); }
  renderPaper();
}
function closingChanged() { renderPaper(); }
function renderPaper() {
  const lines = recordLines(currentRecord()), paper = $('paper');
  const make = (tag, className, text) => Object.assign(document.createElement(tag), { className, textContent: text });
  const sections = lines.sections.map((section) => { const wrap = document.createElement('section'); wrap.append(make('h4', '', section.title)); const list = document.createElement('ul'); for (const row of section.rows) list.append(make('li', '', row)); wrap.append(list); return wrap; });
  const notice = document.createElement('div'); notice.className = 'paper-notice'; for (const row of lines.notice) notice.append(make('p', '', row));
  paper.replaceChildren(make('p', 'paper-brand', 'SYNK PATH · 일터 체험'), make('h3', '', lines.heading), make('p', 'paper-edition', lines.edition), make('p', 'paper-meta', lines.meta.join('   ·   ')), ...sections, notice, make('p', 'paper-serial', lines.serial));
}
/** The record as a PDF file made on this device: one A4 sheet, or two when the learner wrote a lot. */
async function recordPdfFile() {
  const record = currentRecord(), lines = recordLines(record), text = sheetText(lines);
  // The canvas only uses a font that has finished loading; wait for every weight the sheet draws.
  await Promise.all([500, 600, 800].map((weight) => document.fonts?.load(`${weight} 30px ${SHEET_FONT}`, text))).catch(() => {});
  const canvas = document.createElement('canvas'); canvas.width = SHEET.width; canvas.height = SHEET.height;
  const context = canvas.getContext('2d'), plan = planRecordSheet(context, lines), pages = [];
  for (let index = 0; index < plan.pages.length; index++) {
    paintRecordSheet(context, plan, lines, index);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) throw new Error('canvas');
    pages.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), width: SHEET.width, height: SHEET.height });
  }
  const pdf = imagePdf({ pages, title: lines.heading, date: new Date() });
  return new File([pdf], `체험기록_${job.title.replace(/\s+/g, '')}_${record.issuedAt.replaceAll('-', '')}.pdf`, { type: 'application/pdf' });
}
async function makePdf() {
  const status = $('pdf-status'), trigger = $('make-pdf');
  trigger.disabled = true; status.textContent = '체험 기록을 만들고 있어요.';
  try {
    const file = await recordPdfFile(), url = URL.createObjectURL(file);
    const link = Object.assign(document.createElement('a'), { href: url, download: file.name });
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    status.textContent = '체험 기록 PDF를 내려받았어요. 지원할 때 본인이 직접 내요.'; save();
  } catch { status.textContent = 'PDF를 만들지 못했어요. 「인쇄하기」에서 PDF로 저장할 수 있어요.'; }
  finally { trigger.disabled = false; }
}
/** Phones: hand the same file to the device's own share sheet (files, mail, messenger). The
 * learner picks where it goes; nothing is sent by this page. */
async function shareRecord() {
  const status = $('pdf-status');
  try {
    const file = await recordPdfFile();
    if (!navigator.canShare?.({ files: [file] })) { status.textContent = '이 기기에서는 보내기를 쓸 수 없어요. 「PDF로 받기」를 눌러 주세요.'; return; }
    await navigator.share({ files: [file], title: file.name });
    status.textContent = '체험 기록을 넘겼어요.';
  } catch (error) { if (error?.name !== 'AbortError') status.textContent = '보내지 못했어요. 「PDF로 받기」를 눌러 주세요.'; }
}

/* ---------- Quest and the seated window ---------- */
// This page writes its own words for each state and never shows the interview room's messages.
const VR_STATUS = Object.freeze({
  unsupported: 'VR은 Quest 브라우저에서 이 주소를 열면 쓸 수 있어요. 화면으로도 끝까지 할 수 있어요.',
  ready: 'VR을 쓸 수 있어요. 「말로 답하기」의 음성 준비와 마이크 확인을 마치면 들어갈 수 있어요. 한 번에 10분 안쪽으로 써요.',
  starting: 'VR을 연결하고 있어요. 의자에 앉아 정면을 봐 주세요.',
  active: '고개를 돌려 둘러볼 수 있어요. 책상 위 안내판의 단추를 컨트롤러로 가리켜 눌러 주세요.',
  'preview-loading': '앉은 자리를 불러오고 있어요.',
  preview: '좌우 단추로 30도씩 돌아볼 수 있어요. 「정면」을 누르면 바로 앞으로 돌아와요.',
});
function questMinutes() { return vr?.active && vrEnteredAt ? Math.floor((performance.now() - vrEnteredAt) / 60000) : 0; }
/** What the desk panel says. The stage draws exactly this and reports which button was hit. */
function hudView(state) {
  const system = [];
  const view = { status: '', dot: '#8A8F98', corner: '', title: '', body: '', buttons: [] };
  const main = (id, label, extra = {}) => view.buttons.push({ id, label, row: 'main', ...extra });
  const minutes = questMinutes();
  view.corner = [state.scene ? `장면 ${state.scene.index + 1}/${state.scene.total}` : '', vr?.active ? `${minutes}분` : ''].filter(Boolean).join(' · ');
  // Before a scene opens: does it still fit this headset visit? If not, the only thing offered is taking it off.
  const upNext = ['idle', 'closing', 'scene-end'].includes(state.phase) ? nextOpenScene(state) : null;
  const plan = upNext ? questPlan(upNext.id) : { open: true, reason: '' };
  const rest = () => {
    view.status = '쉬는 시간'; view.dot = '#D9A21B';
    view.title = '헤드셋을 벗고 쉬어요.';
    view.body = plan.reason === 'first-visit' ? '처음 쓰는 날은 한 장면만 해요. 다음 장면은 화면에서 이어서 하거나, 쉬었다가 다시 들어와요.' : '한 번에 10분 안쪽으로 써요. 쉬었다가 다시 들어오면 이어서 할 수 있어요.';
    main('exit', '헤드셋을 벗고 쉬어요', { primary: true });
  };
  if (state.paused) { view.status = '일시 정지 · 마이크 꺼짐'; view.title = '잠시 멈췄어요.'; view.body = '계속하려면 「이어서 하기」를 눌러 주세요.'; main('resume', '이어서 하기', { primary: true }); }
  else if (state.phase === 'idle' || state.phase === 'closing') {
    if (upNext && !plan.open) rest();
    else {
      view.status = job.title; view.title = upNext ? '의자에 앉아 정면을 봐 주세요.' : '장면을 모두 마쳤어요.';
      view.body = upNext ? '준비되면 「시작」을 눌러 주세요.' : 'VR에서 나가 화면에서 맺음과 체험 기록을 봐요.';
      if (upNext) main(`start:${upNext.id}`, state.progress.anyDone ? `이어서 하기 · ${upNext.title}` : '시작', { primary: true });
      else main('exit', 'VR에서 나가기', { primary: true });
    }
  } else if (state.phase === 'line') {
    const channel = CHANNEL_NAMES[state.line.channel] ? ` · ${CHANNEL_NAMES[state.line.channel]}` : '';
    view.status = state.line.action ? '지금 일어난 일' : `${nameOf(state.line).text} · ${state.line.role}${channel}`; view.dot = '#3D6BC9';
    view.title = state.line.foreign ? spokenOf(state.line, state.line.foreign).text : state.line.text;
    view.body = [state.line.foreign ? `뜻: ${state.line.text}` : '', hintShown ? hintOf(state.line.hint) : ''].filter(Boolean).join('\n');
    if (lineDone) main('next', '다음', { primary: true });
  } else if (state.phase === 'say') {
    const say = state.say, chosen = say.options.find((item) => item.id === say.chosen);
    // Speaking is the only way to answer inside the headset view: with no voice ready the card says how to answer in writing.
    const canSpeak = mode === 'voice' && !!voice?.ready;
    view.dot = micActive ? '#E5483B' : '#4E8A3A'; view.status = micActive ? '듣고 있어요 · 말을 마치면 넘어가요' : '내 차례';
    view.title = say.prompt;
    if (say.kind === 'work') {
      view.status = `일의 도구 · ${TOOL_NAMES[say.tool.kind] || ''}`; view.dot = '#3D6BC9';
      view.body = [`${say.tool.title}`, toolText(say.tool), hintShown ? hintOf(say.hint) : ''].filter(Boolean).join('\n');
      for (const option of say.options) main(`work:${option.id}`, option.label, { enabled: !option.tried });
      return finishHud(view, state, system);
    }
    const selectedHints = say.kind === 'report' ? say.items.filter((item) => item.selected).map((item) => hintOf(item.hint)) : [];
    const hint = hintShown ? [hintOf(say.hint), hintOf(chosen?.hint), ...selectedHints].filter(Boolean).join(' ') : '';
    const out = outward(say), shown = exampleOf(say);
    const example = say.exampleOpen && shown ? `${say.kind === 'fork' ? '이 선택의 말' : '예시'}: ${shown.text}` : '';
    const lead = micNote && !micActive ? micNote : heard ? `들린 말: ${heard}` : !canSpeak && !out && (say.kind !== 'fork' || say.chosen) ? '이 보기에서는 말로만 답해요. 글로 답하려면 화면으로 돌아가요.' : chosen && !example ? `고른 것: ${chosen.label}` : '';
    const foreignLine = out ? `${nameOf(say.foreign).text}님께 전할 말: ${say.meaning}` : say.kind === 'relay' ? `${nameOf(say.foreign).text}: ${foreignOf(say.foreign).text}` : '';
    view.body = [foreignLine, lead, example, hint].filter(Boolean).join('\n');
    if (say.kind === 'fork' && !say.chosen) for (const option of say.options) main(`opt:${option.id}`, option.label);
    else {
      if (say.kind === 'report') for (const item of say.items) main(`item:${item.id}`, item.text, { pressed: item.selected });
      // Said on aloud in the learner's own language: no recogniser is needed, so the desk card always offers it.
      if (out) main('own-voice', '말로 전했어요', { primary: true, enabled: say.ready && !busy });
      else if (canSpeak) main('mic', micActive ? '말 끝내기' : '말하기', { primary: true, enabled: say.ready && !busy });
      if (unheard && !micActive) main('skip-unheard', '이대로 넘어가기');
      if (shown && !say.exampleOpen) main('example', say.kind === 'fork' ? '이 선택의 말 보기' : '예시 문장 보기');
      // The same rule as the page: a report can be sent without speaking, an example once it is open.
      if (say.ready && !micActive && (say.exampleOpen || say.kind === 'report')) main('use-example', useExampleLabel(say), { primary: !canSpeak && !out });
      if (!canSpeak && !out) main('exit', vr?.previewing ? '화면으로 돌아가기' : 'VR에서 나가기');
    }
  } else if (state.phase === 'tour') {
    const tour = state.tour, point = tour.openPoint;
    view.dot = '#D9A21B';
    if (point?.note) {
      // A note opened from a point is read on the desk card, page by page, then closed.
      notePaged(view, point.note, 'close-point', '닫기');
    } else {
      view.status = `둘러보기 · ${job.places[tour.current].name}`;
      view.title = point ? point.label : tour.prompt;
      view.body = point ? (hintShown ? hintOf(point.hint) : '') : hintShown ? hintOf(tour.hint) : '점을 가리켜 누르면 이름이 나와요.';
      for (const place of [{ id: tour.home, name: job.places[tour.home].name }, ...tour.board]) main(`go:${place.id}`, place.name, { pressed: tour.current === place.id });
      main('next', '둘러보기 마치기', { primary: true });
    }
  } else if (state.phase === 'note') {
    notePaged(view, state.note, 'next', '다음');
  } else if (state.phase === 'scene-end') {
    if (upNext && !plan.open) rest();
    else {
      view.status = '한 장면을 마쳤어요'; view.dot = '#4E8A3A';
      view.title = upNext ? `「${state.scene.title}」 장면을 마쳤어요.` : '장면을 모두 마쳤어요.';
      view.body = upNext ? '쉬었다가 이어서 해도 돼요.' : 'VR에서 나가 화면에서 맺음과 체험 기록을 봐요.';
      if (upNext) main('next', `다음 장면 · ${upNext.title}`, { primary: true }); else main('exit', 'VR에서 나가기', { primary: true });
    }
  }
  return finishHud(view, state, system);
}
/** The parts every desk card shares: the place note and the system row. */
function finishHud(view, state, system) {
  // While the view is dark for a place change, the card says what it is waiting for.
  if (placeNote) view.status = placeNote;
  const live = ['line', 'say', 'tour', 'note'].includes(state.phase) && !state.paused;
  if (live && state.line && !state.line.action && ['line', 'say'].includes(state.phase) && !micActive && canPlay(state.line.clip)) system.push({ id: 'replay', label: '다시 듣기' });
  if (live && !hintShown && hintAvailableFor(state)) system.push({ id: 'hint', label: '힌트' });
  if (live && !moving) system.push({ id: 'pause', label: '일시 정지' });
  system.push({ id: 'exit', label: '나가기' });
  for (const item of system) view.buttons.push({ ...item, row: 'system' });
  return view;
}
function stageState() {
  const state = session.snapshot(), tour = state.phase === 'tour' && !state.paused && !moving ? state.tour : null;
  const placeId = state.place || job.scenes[0].place, playing = film?.current?.id;
  return {
    mode, voiceReady: !!voice?.ready && microphoneReady, hud: hudView(state), fade: fadeValue(),
    // live: the part of the photograph a film may replace. film: only a clip measured to hold its
    // background still is drawn in the stage; any other clip is heard while the photograph stays.
    place: { photo: placeUrl(placeId), live: job.places[placeId].live || null, film: !!playing && clipHoldsStill(clipOf(playing)?.still), points: tour ? tour.points.map((point) => ({ ...point, open: tour.openPoint?.id === point.id })) : [] },
  };
}
function initVR() {
  vr = createStrictVR({
    mount: $('vr-stage'), getFrameState: () => film?.getVideos() || [], getState: stageState,
    onAction: (name) => action(name),
    onExit() { vrEnteredAt = 0; pause(); render(); },
    onStatus(event) {
      $('vr-status').textContent = VR_STATUS[event.status] || VR_STATUS.unsupported;
      if (event.status === 'active') { vrEnteredAt = performance.now(); vrScenes = 0; questFirstVisit = !questSeen(); }
      render();
    },
  }, { createStage: async (options) => {
    // The desk card is a canvas: it can only use a font that has already arrived.
    await document.fonts?.load(`700 32px ${CANVAS_FONT}`, jobTexts(job).join(' ')).catch(() => {});
    stageRef = await buildWorkdayStage(options);
    void preloadFor(session.snapshot().scene?.id || firstOpenScene());
    return stageRef;
  } });
  // A phone that claims VR support would otherwise build the 3D stage for nothing.
  if (HEADSET) void checkVR();
}
async function checkVR() {
  try { vrSupported = await vr.check(); } catch { vrSupported = false; }
  vrChecked = true; render();
}

/* ---------- wiring ---------- */
$('start').addEventListener('click', () => { if (session.snapshot().progress.scenes.some(openScene)) startFrom(firstOpenScene()); else openClosing(); });
$('restart').addEventListener('click', wipe);
$('wipe-record').addEventListener('click', wipe);
$('share-record').addEventListener('click', () => void shareRecord());
$('share-record').hidden = typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function';
$('primary').addEventListener('click', () => {
  const state = session.snapshot();
  if (state.paused) return void action('resume');
  if (state.phase === 'say') return void action(mode === 'voice' ? (outward(state.say) ? 'own-voice' : 'mic') : 'answer');
  if (state.phase === 'tour' && state.tour.openPoint?.note) return void action('close-point');
  void action('next');
});
for (const [id, name] of [['replay', 'replay'], ['example-button', 'example'], ['hint-button', 'hint'], ['use-example', 'use-example'], ['skip-unheard', 'skip-unheard'], ['retry-film', 'retry-film'], ['pause', 'pause'], ['leave', 'leave']]) $(id).addEventListener('click', () => void action(name));
$('finish-here').addEventListener('click', openClosing);
$('voice-prepare').addEventListener('click', () => void prepareVoice());
$('microphone-check').addEventListener('click', () => void checkMicrophone());
$('open-closing').addEventListener('click', openClosing);
$('back-to-scenes').addEventListener('click', leave);
$('clear-data').addEventListener('click', wipe);
$('preview').addEventListener('click', () => void vr?.preview());
$('vr').addEventListener('click', () => void (vrChecked ? vr?.enter() : checkVR()));
$('make-pdf').addEventListener('click', () => void makePdf());
$('print-record').addEventListener('click', () => print());
$('hint-language').addEventListener('change', (event) => { hintLanguage = event.target.value; hintShown = false; save(); render(); });
$('name').addEventListener('input', (event) => { closingForm.name = event.target.value; closingChanged(); });
$('hard').addEventListener('input', (event) => { closingForm.hard = event.target.value; closingChanged(); });
$('answer').addEventListener('input', render);
$('answer').addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void action('answer'); } });
for (const input of document.querySelectorAll('input[name="mode"]')) input.addEventListener('change', () => { if (input.checked) { mode = input.value; save(); render(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden && !vr?.active && !vr?.pending) pause(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !event.repeat && vr?.previewing) { event.preventDefault(); vr.closePreview(); } });
const timer = setInterval(() => {
  if (!session) return;
  const now = performance.now(), delta = now - lastTick; lastTick = now;
  const state = session.snapshot();
  session.addActiveMs(delta);
  if (state.paused) return;
  // The line's speech ends before its clip does: open the next step at the reviewed cue.
  const playing = film?.current;
  if (state.phase === 'line' && !lineDone && !replaying && playing && playing.id === state.line.clip) {
    const cue = clipOf(playing.id)?.answerStartSeconds;
    if (Number.isFinite(cue) && playing.time >= cue) finishLine();
  }
  if (micActive && state.phase === 'say' && gateState === 'done') void toggleMic();
}, 100);
addEventListener('pagehide', () => { clearInterval(timer); save(); ++epoch; film?.dispose(); void voice?.dispose(); void vr?.dispose(); }, { once: true });
render();
void boot();
