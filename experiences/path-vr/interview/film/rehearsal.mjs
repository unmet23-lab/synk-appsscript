import { chooseFilmSources, createFilmPlayer, evaluateFilmReadiness } from '../film-player.mjs';
import { createVoiceInput, voiceError, mergeVoiceResults } from '../voice.mjs';
import { WhisperModel } from '../whisper-model.mjs';
import { assessVoiceAnswer, replaceVoiceSpan, rebaseConfirmedSpans } from './voice-assessment.mjs';
import { CLIPS, QUESTIONS, REHEARSAL_DURATION_PROFILES, createRehearsalSession, safeExitWaitMs, rehearsalMediaQualities, selectRehearsalMedia, transcriptReviewPages } from './rehearsal-session.mjs';
import { createStrictVR } from './strict-vr.mjs';
import { createSpeechTurn } from './speech-turn.mjs';
import { createListeningSequence, LISTENING_CLIP_IDS } from './listening-sequence.mjs';

const $ = (id) => document.getElementById(id);
const ui = Object.fromEntries(['film-stage', 'reference', 'phase-label', 'timer', 'pause-overlay', 'complete-overlay', 'question-caption', 'status', 'turn-label', 'voice-prepare', 'voice-status', 'microphone-check', 'mic-meter', 'mic-check-result', 'room-preview', 'answer-area', 'answer-context', 'answer', 'partial', 'start', 'submit', 'retry', 'repeat', 'pause', 'stop', 'vr', 'vr-status', 'result', 'branch-result', 'vr-stage', 'quality-control', 'quality', 'quality-note', 'media-limit'].map((id) => [id, $(id)]));
const session = createRehearsalSession();
ui.confirm = $('confirm'); ui['recognition-note'] = $('recognition-note');
const durationProfile = REHEARSAL_DURATION_PROFILES.quest;
const speechTurn = createSpeechTurn();
let film = null, manifest = null, mode = 'text', voice = null, busy = false, preparingVoice = false, micActive = false, epoch = 0, disposed = false, lastTick = performance.now(), partial = '', voiceFailed = false, vrSupported = false, voicePrefix = '', micStopping = null, microphoneReady = false, checkingMic = false, micLevel = 0, micPeak = 0, calibrationText = '', settling = false;
// Start light where 4K cannot show or would stall: phone screens, data saver and 2G/3G links.
// downlink is not used: Chrome reports a starting guess (1.45 Mbps in a fresh profile) until it
// has measured the network. The 4K upscale stays the default elsewhere, and a quality the user picks is kept.
function preferredQuality() {
  const connection = globalThis.navigator?.connection;
  const phone = !!globalThis.matchMedia?.('(max-width: 760px), (max-height: 500px) and (pointer: coarse)').matches;
  const slow = !!connection && (connection.saveData === true || /(^|-)2g|3g/.test(connection.effectiveType || ''));
  return phone || slow ? '720p' : '4k';
}
let manifestLoad = null, playbackManifest = null, selectedQuality = preferredQuality(), filmQuality = null, roomLoading = false;
let listeningSequence = null, listeningRun = 0, listeningEnabled = false, scheduledListeningOwner = null;
let voicePrefixResult = { text: '' }, voiceReview = null, reviewPage = 0;
let voiceAssessment = null, clarificationBase = null, confirmedSpans = [];
const abortError = () => new DOMException('취소된 면접 작업입니다.', 'AbortError');
const current = (token) => !disposed && token === epoch;
const guard = (token) => { if (!current(token)) throw abortError(); };
const activePhases = ['preparing', 'question', 'listening', 'confirming', 'reviewing', 'followup', 'repair'];

function getState() {
  const state = session.snapshot();
  return { ...state, mode, voiceReady: !!voice?.ready && microphoneReady, micLevel, micActive, automaticEnd: mode === 'voice', settling, transcript: state.phase === 'confirming' ? ui.answer.value : mode === 'voice' ? partial : ui.answer.value, reviewPages: transcriptReviewPages(ui.answer.value), reviewPage, reviewPrompt: voiceAssessment?.issue?.prompt || '', partialReview: !!voiceAssessment?.issue, clarificationPrompt: clarificationBase ? `이 부분만 다시 말씀하세요: “${clarificationBase.result.text.slice(clarificationBase.issue.start, clarificationBase.issue.end)}”` : '', canConfirm: state.phase === 'confirming' && !state.paused && !busy && !!ui.answer.value.trim(), remainingSeconds: Math.ceil(state.remainingMs / 1000), canSubmit: state.phase === 'listening' && !state.paused && !busy, canStart: ['idle', 'complete', 'error'].includes(state.phase) && !busy && !checkingMic && !preparingVoice && (mode === 'text' || !!voice?.ready && microphoneReady) };
}
function render() {
  if (disposed) return;
  const state = getState(), active = activePhases.includes(state.phase);
  const qualities = rehearsalMediaQualities(manifest);
  ui['quality-control'].hidden = qualities.length < 2;
  ui.quality.disabled = active || busy || preparingVoice || checkingMic || !!vr?.active;
  ui.quality.value = selectedQuality;
  if (manifest) {
    const sourceHeight = manifest.clips.find((clip) => clip.id === CLIPS.question)?.height;
    const selectedHeight = qualities.includes(selectedQuality) ? manifest.clips.find((clip) => clip.id === CLIPS.question).variants[selectedQuality].height : sourceHeight;
    const hasUpscale = qualities.includes('4k') && qualities.includes('720p');
    ui['quality-note'].textContent = selectedQuality === '4k' && hasUpscale ? '영상은 720p→4K 확대본입니다. 주변 벽·창문·천장은 재질 디테일을 새로 보강한 4K 이미지로 이어집니다. 재생이 버거우면 영상은 720p로 선택할 수 있습니다.' : '영상은 생성된 720p 원본입니다. 주변 벽·창문·천장은 재질 디테일을 새로 보강한 4K 이미지로 이어집니다. 화질은 면접을 마친 뒤 바꿀 수 있습니다.';
    ui['media-limit'].textContent = hasUpscale && selectedQuality === '4k' ? '면접관은 720p 원본을 4K로 확대한 단안 영상이라 몸을 크게 옮겨 옆모습을 볼 수는 없습니다.' : `면접관은 ${selectedHeight || 480}p 단안 영상이라 몸을 크게 옮겨 옆모습을 볼 수는 없습니다.`;
  }
  document.body.classList.toggle('in-session', active || state.phase === 'complete');
  // Styling hooks only: the status dots and on-air ring read these attributes.
  Object.assign(document.body.dataset, { phase: state.paused ? 'paused' : state.phase, mode, mic: state.micActive ? 'on' : 'off', urgent: state.phase === 'listening' && !state.paused && state.remainingSeconds <= 10 ? 'on' : 'off' });
  const labels = { idle: '면접 시작 전', preparing: '영상 준비', question: '첫 번째 질문', followup: '후속 질문', listening: '답변 중', confirming: '애매한 부분 확인', reviewing: '답변 검토', repair: '답변 확인', complete: '면접 종료', error: '연결 확인' };
  ui['phase-label'].textContent = state.paused ? '일시 정지' : labels[state.phase] || '';
  ui['turn-label'].textContent = active ? `${state.turn} / 2` : '2 QUESTIONS';
  ui.timer.textContent = state.phase === 'listening' && !state.paused ? `${state.remainingSeconds}초` : '';
  ui.reference.hidden = !!film?.current;
  ui['pause-overlay'].hidden = !state.paused;
  ui['complete-overlay'].hidden = state.phase !== 'complete';
  ui['question-caption'].textContent = ['question', 'followup'].includes(state.phase) && !state.paused ? state.question : '';
  ui['answer-area'].hidden = !['listening', 'repair', 'confirming'].includes(state.phase);
  const answerQuote = state.branch?.evidence?.quote || '';
  const briefQuote = answerQuote.length > 160 ? `${answerQuote.slice(0, 160)}…` : answerQuote;
  ui['answer-context'].hidden = !answerQuote || !['reviewing', 'followup', 'listening', 'repair'].includes(state.phase);
  ui['answer-context'].textContent = answerQuote ? `첫 답변에서 확인한 내용: “${briefQuote}”` : '';
  ui.answer.disabled = state.paused || busy || mode === 'voice' && state.phase !== 'confirming';
  ui.answer.placeholder = state.phase === 'confirming' ? '이 부분이 다르게 들렸다면 고쳐 주세요.' : mode === 'voice' ? '말한 내용이 아래에 표시됩니다. 명확하게 인식되면 자동으로 이어집니다.' : '질문에 대한 답변을 입력하세요.';
  ui.partial.textContent = partial;
  ui.partial.hidden = state.phase === 'confirming';
  ui.confirm.hidden = state.phase !== 'confirming'; ui.confirm.disabled = !state.canConfirm;
  ui.confirm.textContent = '이 부분이 맞아요';
  ui['recognition-note'].hidden = state.phase !== 'confirming';
  ui['recognition-note'].textContent = `${state.reviewPrompt || '이 부분을 정확히 들었는지 확인해 주세요.'} 맞으면 확인하고, 다르면 고치거나 이 부분만 다시 말해 주세요. 나머지 답변은 유지됩니다.`;
  $('answer-label').textContent = state.phase === 'confirming' ? '확인할 부분' : clarificationBase ? '이 부분만 다시 답변' : '내 답변';
  $('recognized-full').hidden = state.phase !== 'confirming';
  $('recognized-full-text').textContent = voiceReview?.text || '';
  ui.start.hidden = active; ui.start.disabled = !state.canStart; ui.start.textContent = state.phase === 'idle' ? '면접 시작' : '처음부터 다시';
  ui.submit.hidden = state.phase !== 'listening'; ui.submit.disabled = !state.canSubmit;
  ui.retry.hidden = !['repair', 'confirming'].includes(state.phase); ui.retry.disabled = busy || state.paused; ui.retry.textContent = state.phase === 'confirming' ? '이 부분만 다시 말하기' : mode === 'text' && ui.answer.value.trim() ? '수정한 답변 제출' : '다시 답변';
  ui.repeat.hidden = !['listening', 'repair'].includes(state.phase); ui.repeat.disabled = busy || state.paused;
  ui.pause.hidden = !active; ui.pause.textContent = state.paused ? '이어서 진행' : '일시 정지'; ui.pause.disabled = state.phase === 'preparing' || roomLoading;
  ui.stop.hidden = !active;
  ui['voice-prepare'].hidden = mode !== 'voice' || !!voice?.ready;
  ui['voice-prepare'].disabled = preparingVoice || active && state.phase !== 'repair';
  ui['voice-prepare'].textContent = preparingVoice ? '한국어 음성 준비 중…' : '1. 한국어 음성 준비';
  ui['microphone-check'].hidden = mode !== 'voice' || !voice?.ready || active;
  ui['microphone-check'].textContent = checkingMic ? '마이크 확인 취소' : microphoneReady ? '마이크 다시 확인' : '2. 마이크 확인';
  ui['mic-meter'].hidden = !checkingMic && !micActive;
  ui['mic-meter'].value = micLevel;
  ui['mic-check-result'].hidden = mode !== 'voice' || active;
  ui['room-preview'].disabled = preparingVoice || checkingMic || busy || roomLoading || !!vr?.active;
  for (const input of document.querySelectorAll('input[name="mode"]')) input.disabled = active && !['repair', 'listening'].includes(state.phase) || !!clarificationBase || busy || preparingVoice || checkingMic || !!vr?.active;
  ui.vr.disabled = !vrSupported || !state.voiceReady || mode !== 'voice' || busy || !!vr?.active;
  ui.vr.textContent = vrSupported ? 'Quest 면접실 입장' : 'Quest에서 VR 입장';
  const messages = {
    idle: mode === 'voice' ? state.voiceReady ? '마이크 확인 완료. 앉은 상태에서 면접실에 입장하세요.' : '한국어 음성을 준비하고 마이크를 확인하세요.' : '화면에서는 직접 입력하거나 마이크로 연습할 수 있습니다.', preparing: settling ? '자리에 앉아 정면을 바라보세요. 곧 질문을 시작합니다.' : '면접 장면을 기기에서 준비하고 있습니다.',
    question: '면접관의 질문을 들으세요.', followup: '첫 답변에 따른 후속 질문입니다.',
    listening: busy ? (mode === 'voice' ? voice?.state === 'processing' ? '마이크가 꺼졌습니다. 마지막 말을 확인하고 있습니다.' : '마이크를 연결하고 있습니다.' : '답변 화면을 준비하고 있습니다.') : state.clarificationPrompt || (mode === 'voice' ? '말씀하세요. 답변을 마치면 자동으로 이어지며, 애매한 부분만 확인합니다.' : '답변을 입력한 뒤 완료를 누르세요.'),
    confirming: '마이크가 꺼졌습니다. 아래 부분만 확인해 주세요. 확인 시간은 답변 시간에 포함되지 않습니다.',
    reviewing: '면접관이 답변을 검토하고 있습니다.', repair: state.repair?.message,
    complete: '면접을 마쳤습니다. 다른 답변으로 다시 연습할 수 있습니다.', error: state.error,
  };
  ui.status.textContent = state.paused ? '진행을 멈췄습니다. 이어서 진행하면 마이크를 다시 엽니다.' : messages[state.phase] || '';
  ui.result.hidden = state.phase !== 'complete';
  const branchRows = state.phase === 'complete' ? [['answer', '내 답변', answerQuote && `“${answerQuote}”`], ['reason', '질문 의도', state.branch?.reason || ''], ['followup', '후속 질문', state.branch?.question && `“${state.branch.question}”`]].filter((row) => row[2]) : [];
  const branchKey = JSON.stringify(branchRows);
  if (ui['branch-result'].dataset.key !== branchKey) {
    ui['branch-result'].dataset.key = branchKey;
    ui['branch-result'].replaceChildren(...branchRows.map(([kind, label, text]) => {
      const row = document.createElement('div'), term = document.createElement('dt'), detail = document.createElement('dd');
      row.className = kind; term.textContent = label; detail.textContent = text; row.append(term, detail);
      return row;
    }));
  }
}
function report(error) {
  if (error?.name === 'AbortError' || disposed) return;
  stopListeningSequence();
  epoch++; busy = false; micActive = false; speechTurn.reset(); film?.pause(); void voice?.stop().catch(() => {});
  session.fail(error?.message || '면접을 불러오지 못했습니다. 다시 시작해 주세요.'); render();
}
function stopListeningSequence() {
  listeningEnabled = false; listeningRun++; scheduledListeningOwner = null;
  film?.cancelQueued();
}
function readyListeningIds() {
  return LISTENING_CLIP_IDS.filter((id) => evaluateFilmReadiness(playbackManifest, [id]).ready);
}
function scheduleListeningSuccessor(record) {
  if (!listeningEnabled || !record || record.kind !== 'listening' || scheduledListeningOwner === record.playbackId) return;
  listeningSequence.observe(record);
  const run = listeningRun, owner = record.playbackId;
  scheduledListeningOwner = owner;
  // playing is also emitted when a queue becomes ready. One owner ID consumes
  // one sequence item; pause/resume retains that ID and its deferred queue.
  queueMicrotask(() => {
    if (!listeningEnabled || run !== listeningRun || disposed || film?.current?.playbackId !== owner) return;
    if (session.snapshot().paused) { scheduledListeningOwner = null; return; }
    const id = listeningSequence.next({ sourceClipId: record.id, remainingMs: session.snapshot().remainingMs, currentRemainingMs: Math.max(0, record.duration - record.time) * 1000 });
    if (!id) return;
    void film.queue(id, { loop: false }).catch((error) => {
      if (error?.name !== 'AbortError' && listeningEnabled && run === listeningRun) report(error);
    });
  });
}
function continueListeningSequence() {
  listeningEnabled = true; listeningRun++; scheduledListeningOwner = null;
  const active = film?.current;
  if (active?.kind === 'listening') scheduleListeningSuccessor(active);
  else if (active && listeningSequence) {
    const id = listeningSequence.next({ sourceClipId: active.id, remainingMs: session.snapshot().remainingMs, currentRemainingMs: Math.max(0, active.duration - active.time) * 1000 });
    if (id) void film.queue(id, { loop: false }).catch(report);
  }
}
function getVoice() {
  if (!voice) voice = createVoiceInput({
    modelFactory: () => new WhisperModel(),
    modelNotice: '한국어 음성을 준비합니다. 처음에는 약 103MB를 내려받으며, 이후 이 기기에서 재사용합니다.',
    finalTimeoutMs: 45_000,
    onPartial({ text }) { if (checkingMic) { calibrationText = text || calibrationText; ui['mic-check-result'].textContent = text || '“면접 연습을 시작하겠습니다”라고 말해 보세요.'; } else if (session.snapshot().phase === 'listening' && mode === 'voice') { partial = [voicePrefix, text].filter(Boolean).join(' '); speechTurn.transcript(partial); render(); } },
    onResult({ text }) { if (checkingMic) { calibrationText = text || calibrationText; ui['mic-check-result'].textContent = text || '목소리를 확인하고 있습니다.'; } else if (session.snapshot().phase === 'listening' && mode === 'voice') { partial = [voicePrefix, text].filter(Boolean).join(' '); speechTurn.transcript(partial); render(); } },
    onLevel(value) { micLevel = value; if (checkingMic) micPeak = Math.max(micPeak, value); if (micActive) speechTurn.level(value); ui['mic-meter'].value = value; },
    onStatus(event) {
      ui['voice-status'].textContent = event.state === 'loading' ? (event.progress ? `음성 모델 준비 ${Math.round(event.progress * 100)}%` : '음성 모델을 기기에서 준비하고 있습니다.') : event.state === 'ready' ? '음성 입력 준비 완료 · 기기 안에서 처리' : event.state === 'listening' ? '마이크 켜짐' : event.state === 'processing' ? '마이크 꺼짐 · 마지막 말 확인 중' : event.state === 'error' ? event.message : '';
      if (event.state === 'error' && micActive) { voiceFailed = true; micActive = false; }
      render();
    },
  });
  return voice;
}
async function prepareVoice() {
  if (preparingVoice || voice?.ready) return;
  const token = epoch; preparingVoice = true; render();
  try { await getVoice().prepare(); guard(token); ui['mic-check-result'].textContent = '준비됐습니다. 마이크 확인을 눌러 짧게 말해 보세요.'; }
  catch (error) { microphoneReady = false; if (error?.name !== 'AbortError') ui['voice-status'].textContent = voiceError(error).message; }
  finally { preparingVoice = false; render(); }
}
async function waitActive(ms, token) {
  const until = performance.now() + ms;
  while (performance.now() < until) { guard(token); await new Promise(resolve => setTimeout(resolve, Math.min(50, until - performance.now()))); }
  guard(token);
}
async function checkMicrophone() {
  if (checkingMic) { cancelMicrophoneCheck(); return; }
  if (!voice?.ready || activePhases.includes(session.snapshot().phase)) return;
  const token = epoch; checkingMic = true; microphoneReady = false; micPeak = 0; calibrationText = ''; render();
  ui['mic-check-result'].textContent = '마이크 권한을 허용한 뒤 “면접 연습을 시작하겠습니다”라고 말해 보세요.';
  try {
    await micStopping?.catch(() => {}); guard(token); micPeak = 0; calibrationText = '';
    await getVoice().start(); guard(token); await waitActive(6500, token);
    const result = await (micStopping = getVoice().stop()); guard(token);
    microphoneReady = micPeak > .015 && !!result.text?.trim();
    ui['mic-check-result'].textContent = microphoneReady ? `마이크 확인 완료 · 인식: “${result.text}”` : micPeak <= .015 ? '목소리가 들리지 않았습니다. 마이크 권한과 음소거를 확인한 뒤 다시 시도하세요.' : '소리는 들어왔지만 말을 확인하지 못했습니다. 또렷하게 한 문장 말해 주세요.';
  } catch (error) { if (current(token)) ui['mic-check-result'].textContent = voiceError(error).message; }
  finally { if (current(token)) { checkingMic = false; calibrationText = ''; render(); } }
}
function cancelMicrophoneCheck() {
  if (!checkingMic) return;
  epoch++; checkingMic = false; microphoneReady = false; calibrationText = ''; micLevel = 0;
  micStopping = voice?.stop(); void micStopping?.catch(() => {});
  ui['mic-check-result'].textContent = '마이크 확인을 취소했습니다. 마이크가 닫혔습니다.'; render();
}
async function loadManifest() {
  if (manifest) return manifest;
  if (!manifestLoad) manifestLoad = (async () => {
    const response = await fetch('./strict-manifest.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('면접 영상 목록을 불러오지 못했습니다.');
    const source = await chooseFilmSources(await response.json());
    const ready = evaluateFilmReadiness(source, Object.values(CLIPS));
    if (!ready.ready) throw new Error('면접 영상의 제작·검수가 아직 완료되지 않았습니다.');
    manifest = source;
    const available = rehearsalMediaQualities(manifest);
    if (available.length && !available.includes(selectedQuality)) selectedQuality = available[0];
    return manifest;
  })().finally(() => { manifestLoad = null; });
  return manifestLoad;
}
async function ensureFilm(token) {
  await loadManifest(); guard(token);
  if (film && filmQuality === selectedQuality) return;
  const selected = selectRehearsalMedia(manifest, selectedQuality);
  const ready = evaluateFilmReadiness(selected, Object.values(CLIPS));
  if (!ready.ready) throw new Error('선택한 화질의 면접 영상을 확인하지 못했습니다.');
  if (film) {
    // stop invalidates pending decoding before replacing sources. Keep the
    // same two video elements already shared with the room's VideoTextures.
    film.stop(); playbackManifest.clips = selected.clips; filmQuality = selectedQuality; return;
  }
  playbackManifest = selected; filmQuality = selectedQuality;
  listeningSequence = createListeningSequence({ availableClipIds: readyListeningIds() });
  film = createFilmPlayer({ mount: ui['film-stage'], manifest: playbackManifest, transitionMs: 150,
    onState(event) { if (event.state === 'error') report(new Error(event.message)); else { render(); if (event.state === 'playing') scheduleListeningSuccessor(event.current); } },
    onEnded(event) {
      if (session.snapshot().paused || !['question', 'followup'].includes(session.snapshot().phase)) return;
      session.clipEnded(event.id);
      if (session.snapshot().phase === 'listening') void beginListening(epoch).catch(report);
    },
  });
}
async function start() {
  if (!getState().canStart) return;
  stopListeningSequence();
  const token = ++epoch; busy = true; partial = ''; voicePrefix = ''; voicePrefixResult = { text: '' }; voiceReview = null; voiceAssessment = null; clarificationBase = null; confirmedSpans = []; reviewPage = 0; voiceFailed = false; speechTurn.reset(); ui.answer.value = ''; session.start(); render();
  try {
    film?.stop(); await ensureFilm(token); guard(token);
    // Upload the room before speech/video run together. Opening it mid-answer
    // must not compile its first 4K textures during a short film handoff.
    // A headset check or an earlier look-around has already begun the room; a
    // flat screen that never opened it skips the 7.9MB build (openRoomPreview).
    await vr.prepareRoom({ onlyIfStarted: true }); guard(token);
    listeningSequence?.resetSession();
    await film.prepare(Object.values(CLIPS)); guard(token);
    await vr.warmVideoFrames(); guard(token);
    settling = true; render(); await waitActive(durationProfile.leadInMs, token); settling = false;
    await film.play(CLIPS.question); guard(token); session.prepared(); busy = false; render();
  } catch (error) { if (current(token)) report(error); }
}
async function startMicrophone(token) {
  if (mode !== 'voice') return;
  voiceFailed = false;
  try { await micStopping?.catch(() => {}); guard(token); speechTurn.start(); await getVoice().start(); guard(token); micActive = true; speechTurn.transcript(voicePrefix); }
  catch (error) {
    if (!current(token)) throw abortError();
    micActive = false; voiceFailed = true; session.submit('', { recognitionError: true });
    ui['voice-status'].textContent = voiceError(error).message;
  }
}
async function beginListening(token, retainSilentTail = false) {
  busy = true; partial = ''; voicePrefix = ''; voicePrefixResult = { text: '' }; voiceReview = null; voiceAssessment = null; clarificationBase = null; confirmedSpans = []; reviewPage = 0; ui.answer.value = ''; render();
  // The question's speech ends before the 10-second clip. Open input at its
  // reviewed audio cue while the same actors continue listening in that tail.
  stopListeningSequence();
  listeningSequence ??= createListeningSequence({ availableClipIds: readyListeningIds() });
  listeningSequence.reset(film.current?.id);
  const active = film.current;
  const next = listeningSequence.next({ sourceClipId: active?.id, remainingMs: session.snapshot().remainingMs, currentRemainingMs: retainSilentTail && active ? Math.max(0, active.duration - active.time) * 1000 : 0 });
  if (!next) throw new Error('검수된 경청 영상을 찾을 수 없습니다.');
  listeningEnabled = true;
  await Promise.all([retainSilentTail ? film.queue(next, { loop: false }) : film.play(next, { loop: false }), startMicrophone(token)]);
  guard(token); busy = false; lastTick = performance.now(); render();
  if (mode === 'text' && session.snapshot().phase === 'listening' && !vr.previewing && !vr.active) ui.answer.focus({ preventScroll: true });
}
async function safeExit(token) {
  while (true) {
    guard(token);
    const active = film.current;
    if (!active) return;
    const reviewed = playbackManifest?.clips.find((clip) => clip.id === active.id);
    const windows = reviewed?.safeExitWindowsSeconds;
    const wait = active.ended ? 0
      : windows || active.id === CLIPS.listening ? safeExitWaitMs(active.time, active.duration, windows)
      : active.time >= 8 ? 0 : (8 - active.time) * 1000;
    if (wait === 0) return;
    await new Promise((resolve) => setTimeout(resolve, Math.min(60, wait ?? 60)));
  }
}
async function finishReview(token) {
  if (session.snapshot().turn === 2) await waitActive(durationProfile.closingMs, token);
  await safeExit(token); guard(token);
  const state = session.finishReview();
  if (state.phase === 'complete') film.pause();
  else if (state.phase === 'followup') await film.play(state.clip);
  guard(token); busy = false; render();
}
function assessResult(result) {
  return assessVoiceAnswer(result, { turn: session.snapshot().turn, availableClipIds: [CLIPS.experience, CLIPS.plan], confirmedSpans });
}
function showVoiceIssue(result, assessment) {
  voiceReview = result; voiceAssessment = assessment; reviewPage = 0;
  const issue = assessment.issue;
  ui.answer.value = issue ? result.text.slice(issue.start, issue.end) : result.text;
  session.reviewTranscript(result.text); continueListeningSequence(); busy = false; render();
}
async function submit() {
  if (!getState().canSubmit) return;
  stopListeningSequence();
  const token = epoch; busy = true;
  speechTurn.reset();
  // stop() closes tracks synchronously before its local final-recognition wait.
  let stopped = null;
  if (mode === 'voice') { micActive = false; stopped = micStopping = getVoice().stop(); }
  render();
  try {
    let result = stopped ? { ...await stopped } : { text: ui.answer.value }; guard(token);
    let recognitionError = mode === 'voice' && voiceFailed;
    if (mode === 'voice') {
      result = mergeVoiceResults([voicePrefixResult, result]); partial = result.text;
      if (!voiceFailed && result.text.trim()) {
        if (clarificationBase) {
          confirmedSpans = rebaseConfirmedSpans(clarificationBase.result.text, clarificationBase.issue, result.text, clarificationBase.confirmedSpans || []);
          result = replaceVoiceSpan(clarificationBase.result, clarificationBase.issue, result);
          clarificationBase = null; partial = result.text;
        }
        voiceAssessment = assessResult(result);
        if (voiceAssessment.decision === 'clarify') { showVoiceIssue(result, voiceAssessment); return; }
        recognitionError = voiceAssessment.decision === 'retry';
      }
    }
    voiceReview = null; voiceAssessment = null;
    const state = session.submit(result.text, { recognitionError });
    if (state.phase === 'repair') { continueListeningSequence(); busy = false; render(); return; }
    render(); await finishReview(token);
  } catch (error) {
    if (!current(token)) return;
    if (mode === 'voice') { voiceFailed = true; session.submit('', { recognitionError: true }); continueListeningSequence(); busy = false; ui['voice-status'].textContent = voiceError(error).message; render(); }
    else report(error);
  }
}
async function confirm() {
  if (!getState().canConfirm) return;
  const token = epoch; busy = true; stopListeningSequence();
  const issue = voiceAssessment?.issue;
  let result = voiceReview || { text: ui.answer.value.trim() };
  let rejected = false;
  if (issue) {
    const replacement = ui.answer.value.trim();
    if (replacement !== result.text.slice(issue.start, issue.end)) {
      confirmedSpans = rebaseConfirmedSpans(result.text, issue, replacement, confirmedSpans);
      result = replaceVoiceSpan(result, issue, replacement);
    }
    confirmedSpans.push({ start: issue.start, end: issue.start + replacement.length, text: replacement });
    const assessment = assessResult(result);
    if (assessment.decision === 'clarify') { showVoiceIssue(result, assessment); return; }
    rejected = assessment.decision === 'retry';
  }
  const state = session.confirmTranscript(rejected ? '' : result.text);
  partial = result.text; voiceReview = null; voiceAssessment = null; reviewPage = 0; confirmedSpans = [];
  if (state.phase === 'repair') { continueListeningSequence(); busy = false; render(); return; }
  render(); await finishReview(token);
}
async function retry() {
  if (busy || session.snapshot().paused || !['repair', 'confirming'].includes(session.snapshot().phase)) return;
  if (session.snapshot().phase === 'confirming' && voiceReview && voiceAssessment?.issue) clarificationBase = { result: voiceReview, issue: voiceAssessment.issue, confirmedSpans: [...confirmedSpans] };
  const token = epoch; session.retry();
  if (mode === 'text' && ui.answer.value.trim()) { render(); return submit(); }
  busy = true; partial = ''; voicePrefix = ''; voicePrefixResult = { text: '' }; voiceReview = null; voiceAssessment = null; confirmedSpans = []; reviewPage = 0; ui.answer.value = ''; render();
  // Keep the current silent actors moving; a recognition repair must not reset
  // a pen halfway through a note or discard a typed correction.
  await startMicrophone(token); guard(token); busy = false; lastTick = performance.now(); render();
}
async function repeat() {
  if (busy || session.snapshot().paused || !['listening', 'repair'].includes(session.snapshot().phase)) return;
  stopListeningSequence(); clarificationBase = null; voiceAssessment = null; confirmedSpans = [];
  const token = epoch; busy = true; micActive = false; speechTurn.reset(); const stopped = voice?.stop(); render();
  await stopped?.catch(() => {}); guard(token); await safeExit(token); guard(token);
  const state = session.repeat(); await film.play(state.clip); guard(token); busy = false; render();
}
async function pause() {
  const state = session.snapshot(); if (state.paused || !activePhases.includes(state.phase)) return;
  const token = ++epoch; micActive = false; speechTurn.reset(); const stopped = micStopping = voice?.stop();
  film?.pause(); busy = false; session.pause(); render();
  const result = await stopped?.catch(() => null);
  if (current(token) && result?.text) { voicePrefixResult = mergeVoiceResults([voicePrefixResult, result]); voicePrefix = voicePrefixResult.text; partial = voicePrefix; ui.answer.value = partial; render(); }
}
async function resume() {
  const state = session.snapshot(); if (!state.paused || busy || roomLoading) return;
  const token = epoch; busy = true; session.resume(); render();
  if (state.phase === 'preparing') { session.reset(); busy = false; return start(); }
  await film.resume(); guard(token);
  if (state.phase === 'reviewing') return finishReview(token);
  if (state.phase === 'listening') await startMicrophone(token);
  guard(token); busy = false; lastTick = performance.now(); render();
}
async function stop() {
  stopListeningSequence();
  epoch++; busy = false; micActive = false; settling = false; checkingMic = false; speechTurn.reset(); const stopped = micStopping = voice?.stop(); film?.stop(); session.reset(); partial = ''; voicePrefix = ''; voicePrefixResult = { text: '' }; voiceReview = null; voiceAssessment = null; clarificationBase = null; confirmedSpans = []; reviewPage = 0; ui.answer.value = ''; render();
  await stopped?.catch(() => {});
}
async function changeMode(next) {
  if (next === mode || busy || vr.active || clarificationBase || session.snapshot().phase === 'confirming') return;
  const token = ++epoch; mode = next; micActive = false; busy = true; speechTurn.reset();
  const stopped = voice?.stop(); render();
  const result = await stopped?.catch(() => null); guard(token);
  if (result?.text) ui.answer.value = [voicePrefix, result.text].filter(Boolean).join(' ');
  const state = session.snapshot();
  if (next === 'voice' && ['listening', 'repair'].includes(state.phase)) { voicePrefix = ui.answer.value.trim(); voicePrefixResult = { text: voicePrefix }; partial = voicePrefix; }
  if (next === 'voice' && state.phase === 'listening' && !state.paused) {
    if (!voice?.ready) session.submit('', { recognitionError: true });
    else await startMicrophone(token);
  }
  busy = false; render();
}
async function action(name) {
  const operations = { start, submit, confirm, reviewNext: () => { if (session.snapshot().phase === 'confirming' && !session.snapshot().paused) { const pages = transcriptReviewPages(ui.answer.value); reviewPage = (reviewPage + 1) % pages.length; render(); } }, pause, resume, stop, retry, repeat, exit: () => vr.exit() };
  try { return await operations[name]?.(); } catch (error) { report(error); }
}
const vr = createStrictVR({ mount: ui['vr-stage'], getFrameState: () => film?.getVideos() || [], getState, onAction: action, onExit: () => void pause(), onStatus(event) { ui['vr-status'].textContent = event.message; } });
for (const name of ['start', 'submit', 'confirm', 'retry', 'repeat', 'stop']) ui[name].addEventListener('click', () => void action(name));
ui.pause.addEventListener('click', () => void action(session.snapshot().paused ? 'resume' : 'pause'));
ui['voice-prepare'].addEventListener('click', () => void prepareVoice());
ui['microphone-check'].addEventListener('click', () => void checkMicrophone());
// The first look-around builds the room. Mid-interview, pause first and hold
// resume until the room opens (pause can wait seconds for the last voice
// transcript), so its downloads and 4K uploads never run under the film's
// timed handoffs.
async function openRoomPreview() {
  if (vr.roomReady || !activePhases.includes(session.snapshot().phase)) { await vr.preview(); return; }
  roomLoading = true; ui['vr-status'].textContent = '좌석 주변 공간을 처음 준비하는 동안 면접을 잠시 멈춥니다.'; render();
  try {
    await pause();
    await vr.preview();
    if (!vr.roomReady && session.snapshot().paused) ui['vr-status'].textContent = '방 둘러보기를 준비하지 못했습니다. 「이어서 진행」으로 면접을 계속할 수 있습니다.';
  } finally { roomLoading = false; render(); }
}
ui['room-preview'].addEventListener('click', () => { void openRoomPreview().catch(report); });
ui.vr.addEventListener('click', () => { void vr.enter().catch(report); });
ui.quality.addEventListener('change', () => {
  if (activePhases.includes(session.snapshot().phase) || busy || preparingVoice || checkingMic || vr.active || !rehearsalMediaQualities(manifest).includes(ui.quality.value)) { render(); return; }
  selectedQuality = ui.quality.value;
  // A finished session may still display its last frame. Clear it now so
  // the selected-quality label never describes a previous-quality frame.
  film?.stop(); render();
});
for (const input of document.querySelectorAll('input[name="mode"]')) input.addEventListener('change', () => { if (input.checked) void changeMode(input.value).catch(report); });
ui.answer.addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void action(session.snapshot().phase === 'confirming' ? 'confirm' : 'submit'); } });
ui.answer.addEventListener('input', () => { reviewPage = 0; render(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && !vr.active && !vr.pending) { cancelMicrophoneCheck(); if (preparingVoice) { epoch++; void voice?.stop().catch(() => {}); } void pause(); } });
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || event.repeat) return;
  cancelMicrophoneCheck();
  // This document handler runs before the preview's window listener. Closing
  // the room keeps the current answer running; holding Esc must not pause it.
  if (vr.previewing) { event.preventDefault(); vr.closePreview(); return; }
  void pause();
});
const timer = setInterval(() => {
  const now = performance.now(), delta = now - lastTick; lastTick = now;
  const snapshot = session.snapshot(), activeClip = film?.current;
  if (!busy && !snapshot.paused && ['question', 'followup'].includes(snapshot.phase) && activeClip?.id === snapshot.clip) {
    const cue = playbackManifest?.clips.find((clip) => clip.id === activeClip.id)?.answerStartSeconds;
    if (Number.isFinite(cue) && activeClip.time >= cue) { session.clipEnded(activeClip.id); void beginListening(epoch, true).catch(report); return; }
  }
  if (busy || disposed || session.snapshot().paused || session.snapshot().phase !== 'listening') return;
  const state = session.tick(Math.min(delta, 500)); render();
  if (state.remainingMs === 0 || mode === 'voice' && micActive && speechTurn.poll().submit) void submit();
}, 100);
window.addEventListener('pagehide', () => { stopListeningSequence(); disposed = true; epoch++; clearInterval(timer); session.dispose(); film?.dispose(); void voice?.dispose(); void vr.dispose(); }, { once: true });
render();
void loadManifest().then(render).catch(() => { /* Start retries a failed manifest request and reports its error. */ });
void vr.check().then((supported) => { vrSupported = supported; if (supported && session.snapshot().phase === 'idle') { mode = 'voice'; document.querySelector('input[name="mode"][value="voice"]').checked = true; } render(); }).catch(() => { vrSupported = false; render(); });
