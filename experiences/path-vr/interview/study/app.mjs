// 「대학 입학 면접 연습」 화면. 방 · 음성 인식 · VR은 이미 공개된 면접실 파일을 그대로 부르고(고치지 않는다),
// 이 쪽은 여섯 질문의 진행과 AI 꼬리 질문 · 평가만 맡는다. 답과 질문은 저장하지 않는다.
import { chooseFilmSources, resolveFilmClipUrl } from '../film-player.mjs';
import { createVoiceInput, voiceError } from '../voice.mjs';
import { WhisperModel } from '../whisper-model.mjs';
import { createStrictVR } from '../film/strict-vr.mjs';
import { createSpeechTurn } from '../film/speech-turn.mjs';
import { transcriptReviewPages } from '../film/rehearsal-session.mjs';
import { INTERVIEW_PROGRAMS, MAX_ANSWER_CHARS } from '../../../path-app/interview-shape.mjs';
import { createStudyInterview } from './session.mjs';
import { createInterviewAccount } from './account.mjs';
import { CONSENT_KO, CONSENT_MN } from './consent-mn.mjs';

const $ = (id) => document.getElementById(id);
const ids = ['film', 'reference', 'phase-label', 'timer', 'pause-overlay', 'complete-overlay', 'question-caption', 'setup', 'program', 'ai-box', 'ai-signin', 'ai-consent', 'consent-mn', 'topik', 'adult', 'agree', 'status', 'turn-label',
  'voice-prepare', 'microphone-check', 'voice-status', 'mic-meter', 'mic-check-result', 'answer-area', 'answer-label', 'answer', 'partial', 'start', 'listen', 'submit', 'confirm', 'retry', 'repeat', 'pause', 'stop', 'room-preview', 'vr', 'vr-status', 'speech-note',
  'hero', 'result', 'result-title', 'review', 'review-good', 'review-next', 'review-none', 'transcript', 'vr-stage'];
const ui = Object.fromEntries(ids.map((id) => [id, $(id)]));
const interview = createStudyInterview({ seed: Math.floor(Math.random() * 2) });
const account = createInterviewAccount({ onChange: () => accountChanged() });
const speechTurn = createSpeechTurn();
let mode = 'text', kind = 'fixed', disposed = false, busy = false, epoch = 0, lastTick = performance.now();
let voice = null, preparingVoice = false, checkingMic = false, microphoneReady = false, micActive = false, micLevel = 0, micPeak = 0, partial = '', calibration = '', micStopping = null;
let vrSupported = false, reviewPage = 0, session = null, aiNote = '', reviewNote = '', notice = '', micError = '', filmReady = false, filmLoading = null, speechToken = 0;
const ACTIVE = ['question', 'followup', 'listening', 'confirming', 'reviewing'];
const report = (error) => { if (error?.name !== 'AbortError' && !disposed) ui.status.textContent = error?.message || '문제가 생겼어요. 다시 눌러 주세요.'; };
const aiAllowed = () => kind === 'ai' && account.signedIn() && ui.adult.checked && ui.agree.checked;

/* ── 질문 소리 ── 기기 안에 있는 한국어 목소리만 쓴다(원격 목소리는 글이 밖으로 나간다). 없으면 자막만 보인다. */
function localVoice() {
  try { return globalThis.speechSynthesis?.getVoices?.().find((v) => v.localService === true && /^ko\b|^ko[-_]/i.test(v.lang)) || null; } catch { return null; }
}
function renderSpeechNote() {
  ui['speech-note'].textContent = localVoice() ? '질문은 이 기기에 있는 한국어 목소리로도 읽어요.' : '이 기기에는 기기 안의 한국어 목소리가 없어 질문을 글로만 보여요.';
}
function stopSpeaking() { speechToken++; try { globalThis.speechSynthesis?.cancel?.(); } catch { /* 소리 없는 기기 */ } }
function speak(text) {
  stopSpeaking();
  const token = speechToken, voiceLocal = localVoice();
  if (!voiceLocal) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => { if (token === speechToken) resolve(); };
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voiceLocal; u.lang = voiceLocal.lang; u.rate = .92; u.onend = done; u.onerror = done;
      globalThis.speechSynthesis.speak(u);
      setTimeout(done, 15000);
    } catch { resolve(); }
  });
}

/* ── 화면 ── */
function getState() {
  const s = interview.snapshot(), voiceReady = !!voice?.ready && microphoneReady && !preparingVoice && !checkingMic;
  return { ...s, mode, voiceReady, micLevel, micActive, automaticEnd: mode === 'voice', settling: false,
    transcript: s.phase === 'confirming' ? s.draft : partial, reviewPages: transcriptReviewPages(s.draft), reviewPage, reviewPrompt: '들린 말이 맞으면 첫째 단추를, 다르면 「다시 말하기」를 누르세요.', partialReview: false, branch: null, repair: null,
    clarificationPrompt: s.phase === 'listening' && micError && !micActive ? '마이크를 켜지 못했어요. 「답변 완료」를 누르면 다시 켜 봐요. 안 되면 「나가기」를 누르세요.' : null,
    canStart: !busy && (s.phase === 'idle' || s.phase === 'complete') && (kind === 'fixed' || aiAllowed()) && (mode !== 'voice' || voiceReady), canSubmit: !busy && !s.paused && s.phase === 'listening', canConfirm: !busy && !s.paused && s.phase === 'confirming' };
}
const PHASE = { idle: '면접 시작 전', question: '질문', followup: '꼬리 질문', listening: '답변 중', confirming: '들린 말 확인', reviewing: '답을 듣는 중', complete: '면접 완료' };
function render() {
  if (disposed) return;
  const s = getState(), active = ACTIVE.includes(s.phase);
  document.body.classList.toggle('in-session', active || s.phase === 'complete');
  Object.assign(document.body.dataset, { phase: s.paused ? 'paused' : s.phase, mode, mic: micActive ? 'on' : 'off', urgent: mode === 'voice' && s.phase === 'listening' && !s.paused && s.remainingSeconds <= 10 ? 'on' : 'off' });
  ui['phase-label'].textContent = s.paused ? '일시 정지' : PHASE[s.phase] || '';
  ui['turn-label'].textContent = active ? `${s.turn} / ${s.total}` : '';
  ui.timer.textContent = mode === 'voice' && s.phase === 'listening' && !s.paused ? `${s.remainingSeconds}초` : '';
  ui.film.hidden = !filmReady || !active; ui.reference.hidden = filmReady && active;
  ui['pause-overlay'].hidden = !s.paused; ui['complete-overlay'].hidden = s.phase !== 'complete';
  ui['question-caption'].textContent = active && s.phase !== 'reviewing' && !s.paused ? s.question : '';
  // 고르기와 동의
  const waiting = s.phase === 'idle' || s.phase === 'complete';
  ui.hero.hidden = active || s.phase === 'complete';
  ui['ai-box'].hidden = kind !== 'ai';
  ui['ai-signin'].hidden = kind !== 'ai' || account.signedIn();
  ui['ai-consent'].hidden = kind !== 'ai' || !account.signedIn();
  for (const input of document.querySelectorAll('input[name="kind"]')) input.disabled = !waiting;
  ui.program.disabled = ui.topik.disabled = ui.adult.disabled = ui.agree.disabled = !waiting;
  // 답
  ui['answer-area'].hidden = !['listening', 'confirming'].includes(s.phase);
  ui.answer.disabled = s.paused || busy || (mode === 'voice' && s.phase === 'listening');
  ui['answer-label'].textContent = s.phase === 'confirming' ? '들린 말(틀리면 고쳐 쓰세요)' : `질문 · ${s.question}`;
  ui.answer.placeholder = mode === 'voice' ? '말한 내용은 아래에 글로 나와요.' : '질문에 답을 써 주세요.';
  ui.partial.textContent = s.phase === 'listening' && mode === 'voice' ? partial : ''; ui.partial.hidden = !ui.partial.textContent;
  // 단추
  ui.start.hidden = active; ui.start.disabled = !s.canStart; ui.start.textContent = s.phase === 'complete' ? '처음부터 다시' : '면접 시작';
  ui.listen.hidden = !['question', 'followup'].includes(s.phase) || s.paused; ui.listen.disabled = busy;
  ui.submit.hidden = s.phase !== 'listening'; ui.submit.disabled = !s.canSubmit;
  ui.confirm.hidden = s.phase !== 'confirming'; ui.confirm.disabled = !s.canConfirm;
  ui.retry.hidden = s.phase !== 'confirming'; ui.retry.disabled = busy || s.paused;
  // 글로 답할 때는 질문이 칸 위에 보이므로 두지 않는다(누르면 쓰던 답이 지워진다).
  ui.repeat.hidden = !['listening', 'confirming'].includes(s.phase) || mode === 'text' && s.phase === 'listening'; ui.repeat.disabled = busy || s.paused;
  ui.pause.hidden = !active; ui.pause.textContent = s.paused ? '이어서 진행' : '일시 정지'; ui.pause.disabled = s.phase === 'reviewing' && !s.paused;
  ui.stop.hidden = !active && s.phase !== 'complete'; ui.stop.textContent = s.phase === 'complete' ? '처음 화면으로' : '종료';
  ui['voice-prepare'].hidden = mode !== 'voice' || !!voice?.ready; ui['voice-prepare'].disabled = preparingVoice; ui['voice-prepare'].textContent = preparingVoice ? '한국어 음성 준비 중…' : '1. 한국어 음성 준비';
  ui['microphone-check'].hidden = mode !== 'voice' || !voice?.ready || active; ui['microphone-check'].textContent = checkingMic ? '마이크 확인 취소' : microphoneReady ? '마이크 다시 확인' : '2. 마이크 확인';
  ui['mic-meter'].hidden = !checkingMic && !micActive; ui['mic-meter'].value = micLevel;
  ui['mic-check-result'].hidden = mode !== 'voice' || active || !ui['mic-check-result'].textContent;
  // 답하는 중에도 글로 바꿀 수 있다(말이 안 들리거나 마이크가 안 될 때). 말로는 음성 준비가 끝났을 때만.
  for (const input of document.querySelectorAll('input[name="mode"]')) input.disabled = busy || preparingVoice || checkingMic || !!vr?.active || s.paused || active && s.phase !== 'listening' || active && input.value === 'voice' && !s.voiceReady;
  ui['room-preview'].disabled = busy || preparingVoice || checkingMic || !!vr?.active;
  ui.vr.disabled = !vrSupported || !s.voiceReady || mode !== 'voice' || busy || !!vr?.active || !s.canStart && !active;
  ui.vr.textContent = 'Quest 면접실 입장';
  const note = s.note === 'empty' ? '답을 한 줄 써 주세요.' : s.note === 'not-heard' ? '말이 들리지 않았어요. 다시 말하거나 「직접 입력」으로 답해 주세요.' : '';
  const micNote = mode === 'voice' && !micActive && micError ? `${micError} 「질문 다시 보기」로 다시 하거나 「직접 입력」으로 답해 주세요.` : '';
  const status = { idle: notice ? notice : kind === 'ai' && !account.signedIn() ? 'AI 질문을 쓰려면 먼저 PATH 앱에서 로그인해 주세요.' : kind === 'ai' && !aiAllowed() ? '나이와 동의를 확인하면 시작할 수 있어요.' : mode === 'voice' && !s.voiceReady ? '「한국어 음성 준비」와 「마이크 확인」을 마치면 시작할 수 있어요. 글로 답하려면 「직접 입력」을 고르세요.' : '준비되면 「면접 시작」을 누르세요.',
    question: '질문을 읽거나 들은 뒤 「답하기」를 누르세요.', followup: '내 답을 들은 면접관이 이어서 물어요. 「답하기」를 누르세요.',
    listening: micNote || note || (mode === 'voice' ? micActive ? '말해 주세요. 다 말하면 「답변 완료」를 누르거나 잠깐 기다리세요.' : '마이크를 켜고 있어요.' : '답을 쓰고 「답변 완료」를 누르세요.'),
    confirming: note || '들린 말이 맞는지 봐 주세요.', reviewing: s.reviewState === 'waiting' ? '답을 모아 보고 있어요.' : '면접관이 답을 듣고 있어요.', complete: aiNote || reviewNote || '면접을 마쳤어요. 다른 답으로 다시 해 볼 수 있어요.' };
  ui.status.textContent = s.paused ? '잠시 멈췄어요. 「이어서 진행」을 누르면 이어져요.' : status[s.phase] || '';
  renderResult(s);
}
function renderResult(s) {
  ui.result.hidden = s.phase !== 'complete';
  if (s.phase !== 'complete') { if (s.phase === 'idle') { ui.transcript.replaceChildren(); delete ui.transcript.dataset.key; ui['review-good'].textContent = ui['review-next'].textContent = ''; } return; }
  ui.review.hidden = !s.review; ui['review-good'].textContent = s.review?.good || ''; ui['review-next'].textContent = s.review?.next || '';
  ui['review-none'].hidden = !!s.review; ui['review-none'].textContent = kind === 'ai' ? '이번에는 AI 평가를 받지 못했어요. 아래 답을 소리 내어 다시 읽어 보세요.' : '아래 답을 소리 내어 다시 읽어 보세요. 짧은 답에는 까닭이나 예를 하나 더해 보세요.';
  const key = JSON.stringify([s.asked, s.answers, s.sources]);
  if (ui.transcript.dataset.key === key) return;
  ui.transcript.dataset.key = key;
  ui.transcript.replaceChildren(...s.asked.map((q, i) => {
    const li = document.createElement('li'), qp = document.createElement('p'), ap = document.createElement('p');
    qp.className = 'q'; qp.append(q); if (s.sources[i] === 'ai') { const mark = document.createElement('small'); mark.textContent = 'AI 질문'; qp.append(mark); }
    ap.className = 'a'; ap.textContent = s.answers[i] || ''; li.append(qp, ap); return li;
  }));
}

/* ── 면접관 영상 ── 공개된 면접실의 「듣는 장면」을 되풀이한다. 없거나 아끼는 연결이면 사진만 보인다. */
function prepareFilm() {
  if (filmReady || globalThis.navigator?.connection?.saveData === true) return Promise.resolve();
  return (filmLoading ||= loadFilm().finally(() => { filmLoading = null; }));
}
async function loadFilm() {
  const url = new URL('../film/strict-manifest.json', import.meta.url);
  const response = await fetch(url.href, { cache: 'no-store', signal: globalThis.AbortSignal?.timeout?.(15000) });
  if (!response.ok) return;
  const manifest = await chooseFilmSources(await response.json());
  const clip = manifest.clips?.find((c) => c.id === 'strict-listening'), src = resolveFilmClipUrl(clip?.variants?.['720p']?.src || clip?.src || '', { moduleUrl: new URL('../film-player.mjs', import.meta.url).href });
  if (!src) return;
  ui.film.src = src; ui.film.load();
  await new Promise((resolve, reject) => { ui.film.addEventListener('canplay', resolve, { once: true }); ui.film.addEventListener('error', () => reject(new Error('film')), { once: true }); setTimeout(() => reject(new Error('film')), 20000); });
  await ui.film.play();
  filmReady = true;
}
const playFilm = () => { if (filmReady) void ui.film.play().catch(() => {}); };

/* ── 말 ── */
function getVoice() {
  if (!voice) voice = createVoiceInput({
    modelFactory: () => new WhisperModel(), modelNotice: '한국어 음성 모델을 준비해요. 처음 한 번 103MB쯤 내려받고, 다음부터는 받아 둔 것을 써요.', finalTimeoutMs: 45000,
    onPartial({ text }) { if (checkingMic) calibration = text || calibration; else if (interview.snapshot().phase === 'listening') { partial = text || partial; if (micActive) speechTurn.transcript(partial); } render(); },
    onResult({ text }) { if (checkingMic) calibration = text || calibration; else if (interview.snapshot().phase === 'listening') { partial = text || partial; if (micActive) speechTurn.transcript(partial); } render(); },
    onLevel(value) { micLevel = value; if (checkingMic) micPeak = Math.max(micPeak, value); if (micActive) speechTurn.level(value); ui['mic-meter'].value = value; },
    onStatus(event) {
      ui['voice-status'].textContent = event.state === 'loading' ? (event.progress ? `음성 모델 준비 ${Math.round(event.progress * 100)}%` : '음성 모델을 이 기기에 준비하고 있어요.') : event.state === 'ready' ? '음성 입력을 준비했어요.' : event.state === 'error' ? voiceError(event.error || event).message : '';
      if (event.state === 'error' && micActive) { micActive = false; micError = voiceError(event.error || event).message; }
      render();
    }
  });
  return voice;
}
async function prepareVoice() {
  if (preparingVoice || voice?.ready) return;
  preparingVoice = true; render();
  try { await getVoice().prepare(); } catch (error) { if (error?.name !== 'AbortError') ui['voice-status'].textContent = voiceError(error).message; }
  finally { preparingVoice = false; render(); }
  // 누른 단추가 사라져 초점이 없어졌으면 다음 단추로 옮긴다.
  if (voice?.ready && [document.body, ui['voice-prepare']].includes(document.activeElement)) ui['microphone-check'].focus({ preventScroll: true });
}
const wait = (ms, token) => new Promise((resolve, reject) => setTimeout(() => (token === epoch && !disposed ? resolve() : reject(new DOMException('취소', 'AbortError'))), ms));
async function checkMicrophone() {
  if (checkingMic) { epoch++; checkingMic = false; micStopping = voice?.stop(); void micStopping?.catch(() => {}); ui['mic-check-result'].textContent = '마이크 확인을 취소했어요.'; render(); return; }
  if (!voice?.ready || ACTIVE.includes(interview.snapshot().phase)) return;
  const token = epoch; checkingMic = true; microphoneReady = false; micPeak = 0; calibration = '';
  ui['mic-check-result'].textContent = '마이크 권한을 물으면 허용하고, “면접 연습을 시작하겠습니다”라고 말해 보세요.'; render();
  try {
    await micStopping?.catch(() => {}); await getVoice().start();
    if (token !== epoch) { void voice.stop().catch(() => {}); return; }
    await wait(6500, token);
    const result = await (micStopping = getVoice().stop()); if (token !== epoch) return;
    const heard = String(result.text || calibration || '').replace(/[([（【][^)\]）】]*[)\]）】]/gu, '').trim(); microphoneReady = micPeak > .015 && !!heard;
    ui['mic-check-result'].textContent = microphoneReady ? `마이크 확인을 마쳤어요. 들린 말: “${heard}”` : micPeak <= .015 ? '목소리가 들리지 않았어요. 마이크가 음소거돼 있지 않은지 보고 다시 눌러 주세요.' : '말을 또렷하게 듣지 못했어요. 조금 더 크게 다시 말해 주세요.';
  } catch (error) { if (token === epoch) ui['mic-check-result'].textContent = voiceError(error).message; }
  finally { if (token === epoch) { checkingMic = false; render(); } }
}
async function startMicrophone(token) {
  if (mode !== 'voice') return;
  partial = ''; micError = '';
  try { await micStopping?.catch(() => {}); if (token !== epoch) return; speechTurn.reset(); speechTurn.start(); await getVoice().start(); if (token !== epoch) { void voice.stop().catch(() => {}); return; } micActive = true; }
  catch (error) { if (token !== epoch) return; micActive = false; micError = voiceError(error).message; ui['voice-status'].textContent = micError; }
  render();
}
async function stopMicrophone() {
  micActive = false; speechTurn.reset();
  if (!voice || mode !== 'voice') return '';
  const result = await (micStopping = voice.stop()).catch(() => null);
  return result?.text || partial || '';
}

/* ── 진행 ── */
const meta = () => ({ sessionId: session, program: ui.program.value, topik: Number(ui.topik.value), lang: 'ko' });
async function start() {
  if (!getState().canStart) return;
  epoch++; stopSpeaking(); aiNote = reviewNote = notice = micError = ''; session = crypto.randomUUID(); ui.answer.value = ''; partial = ''; reviewPage = 0;
  interview.start(); render();
  // 영상은 기다리지 않는다. 준비되면 붙고, 그사이 멈췄거나 끝났으면 영상도 멈춰 둔다.
  void prepareFilm().then(() => { if (disposed) return; const s = interview.snapshot(); if (s.paused || !ACTIVE.includes(s.phase)) ui.film.pause(); render(); }, () => { filmReady = false; });
  if (vr.active || vr.previewing) void vr.prepareRoom?.({ onlyIfStarted: true })?.catch?.(() => {});
  await present();
}
/** 질문을 보이고 읽는다. VR에서는 소리가 끝나면(없으면 잠시 뒤) 저절로 답을 받는다. */
async function present() {
  const token = epoch; playFilm(); render();
  const s = interview.snapshot();
  const spoken = speak(s.question);
  if (!vr.active) { ui.listen.focus({ preventScroll: true }); return; }
  await Promise.all([spoken, wait(2500 + s.question.length * 120, token).catch(() => {})]);
  if (token === epoch && vr.active && !interview.snapshot().paused) await listen();
}
async function listen() {
  if (busy || !['question', 'followup'].includes(interview.snapshot().phase)) return;
  stopSpeaking(); interview.listen(); ui.answer.value = ''; partial = ''; lastTick = performance.now(); render();
  if (mode !== 'voice') { ui.answer.focus({ preventScroll: true }); return; }
  if (!vr.active) ui.submit.focus({ preventScroll: true });
  await startMicrophone(epoch);
}
async function submit() {
  if (!getState().canSubmit) return;
  const token = epoch; busy = true; render();
  const spoken = mode === 'voice', text = spoken ? await stopMicrophone() : ui.answer.value;
  if (token !== epoch) return;
  busy = false;
  const s = interview.submit(text, { spoken });
  if (s.phase === 'confirming') { reviewPage = 0; ui.answer.value = s.draft; render(); ui.confirm.focus({ preventScroll: true }); return; }
  if (s.phase === 'listening') { partial = ''; render(); if (!spoken) { ui.answer.focus({ preventScroll: true }); return; } if (!vr.active) ui.submit.focus({ preventScroll: true }); await startMicrophone(token); return; }
  await next(s);
}
async function confirm() {
  if (!getState().canConfirm) return;
  const s = interview.submit(vr.active ? interview.snapshot().draft : ui.answer.value);
  if (s.phase === 'confirming') { render(); ui.answer.focus({ preventScroll: true }); return; }
  await next(s);
}
async function next(s) {
  ui.answer.value = ''; partial = '';
  if (s.phase === 'reviewing') return s.reviewState === 'waiting' ? finish() : follow();
  await present();
}
async function follow() {
  const token = epoch, s = interview.snapshot(); busy = true; render();
  let question = null;
  if (aiAllowed()) {
    try { const r = await account.turn(meta(), { track: s.track, answer: s.answers[s.step] }); question = r.question; aiNote = noteOf(r.status) || aiNote; }
    catch { aiNote = 'AI 질문을 받지 못해 정해 둔 질문으로 이어 갔어요.'; }
  }
  if (token !== epoch) return;
  busy = false; interview.followup(question); await present();
}
async function finish() {
  const token = epoch; busy = true; render();
  let review = null;
  if (aiAllowed()) {
    try { const r = await account.review(meta(), interview.reviewAnswers()); review = r.status === 'done' ? { good: r.good, next: r.next } : null; reviewNote = r.status === 'limit' ? '오늘 쓸 수 있는 AI 면접을 다 써서 평가는 받지 못했어요. 울란바토르 시각 08:00(서울 09:00)에 다시 채워져요.' : ''; }
    catch { /* 평가를 못 받은 것은 결과 칸이 말한다 */ }
  }
  if (token !== epoch) return;
  busy = false; ui.film.pause(); interview.complete(review); render();
  if (!vr.active) { ui['result-title'].focus({ preventScroll: false }); }
}
const noteOf = (status) => ({ limit: '오늘 쓸 수 있는 AI 면접을 다 썼어요. 정해 둔 질문으로 이어 갔어요. 울란바토르 시각 08:00(서울 09:00)에 다시 채워져요.', unavailable: 'AI 질문이 잠시 쉬어요. 정해 둔 질문으로 이어 갔어요.', busy: 'AI 질문이 늦어져 정해 둔 질문으로 이어 갔어요.', refused: '', done: '', done_before: '' }[status] ?? '');
/** 이 쪽에 남은 답과 고른 것을 화면에서 지운다(떠날 때, 그리고 브라우저가 앞 화면의 칸을 되채웠을 때). */
function wipe() {
  interview.reset(); ui.answer.value = ''; ui.transcript.replaceChildren();
  for (const id of ['review-good', 'review-next', 'partial', 'question-caption']) ui[id].textContent = '';
  ui.adult.checked = ui.agree.checked = false;
}
/** 로그아웃했거나 다른 계정으로 바뀌었다. 앞 사람의 답과 나이 · 동의 표시를 지우고 처음으로 돌린다. */
function accountChanged() {
  ui.adult.checked = ui.agree.checked = false;
  if (interview.snapshot().phase === 'idle') { render(); return; }
  void stop().catch(report);
  notice = '로그인이 끝났거나 계정이 바뀌어 답을 지웠어요. AI 질문을 쓰려면 PATH 앱에서 다시 로그인해 주세요.';
  render();
}
/** 답하는 방식을 바꾼다. 말로 답하던 중이면 마이크부터 끈다. */
function changeMode(next) {
  if (next === mode) return;
  const listening = interview.snapshot().phase === 'listening';
  if (listening && mode === 'voice') { epoch++; void stopMicrophone(); }
  mode = next; partial = ''; micError = ''; interview.clearNote(); lastTick = performance.now(); render();
  if (listening && mode === 'voice') void startMicrophone(epoch).catch(report);
}
async function retry() { if (interview.snapshot().phase !== 'confirming' || busy) return; interview.retry(); ui.answer.value = ''; partial = ''; lastTick = performance.now(); render(); if (mode !== 'voice') return; if (!vr.active) ui.submit.focus({ preventScroll: true }); await startMicrophone(epoch); }
async function repeat() { if (busy) return; const token = ++epoch; await stopMicrophone(); if (token !== epoch) return; interview.repeat(); ui.answer.value = ''; partial = ''; render(); await present(); }
async function pause() {
  const s = interview.snapshot(); if (s.paused || !ACTIVE.includes(s.phase) || s.phase === 'reviewing') return;
  epoch++; stopSpeaking(); ui.film.pause(); interview.pause(); busy = false; render(); await stopMicrophone(); render();
}
async function resume() {
  if (!interview.snapshot().paused) return;
  epoch++; interview.resume(); playFilm(); lastTick = performance.now(); render();
  const s = interview.snapshot();
  if (s.phase === 'listening') await startMicrophone(epoch); else if (['question', 'followup'].includes(s.phase)) await present();
}
async function stop() { epoch++; stopSpeaking(); busy = checkingMic = false; aiNote = reviewNote = notice = micError = ''; ui.film.pause(); interview.reset(); ui.answer.value = ''; partial = ''; render(); await stopMicrophone(); $('room-title').focus(); }
async function action(name) {
  const operations = { start, submit, confirm, retry, repeat, pause, resume, stop,
    reviewNext: () => { const pages = transcriptReviewPages(interview.snapshot().draft); reviewPage = (reviewPage + 1) % pages.length; render(); } };
  try { return await operations[name]?.(); } catch (error) { report(error); }
}
const vr = createStrictVR({ mount: ui['vr-stage'], getFrameState: () => (filmReady && ACTIVE.includes(interview.snapshot().phase) ? [{ video: ui.film, opacity: 1 }] : []), getState, onAction: action, onExit: () => void pause(), onStatus(event) { ui['vr-status'].textContent = event.message; } });

for (const [id, name] of Object.entries(INTERVIEW_PROGRAMS)) { const o = document.createElement('option'); o.value = id; o.textContent = `${name} 학부`; ui.program.append(o); }
// 앱에서 넘어오면 고른 과정과 급수를 같은 탭에서 읽는다(주소에 싣지 않는다).
try { const v = JSON.parse(sessionStorage.getItem('synk-path-interview') || 'null'); if (v && Object.hasOwn(INTERVIEW_PROGRAMS, v.program)) ui.program.value = v.program; if (v && Number.isInteger(v.topik) && v.topik >= 0 && v.topik <= 6) ui.topik.value = String(v.topik); } catch { /* 저장이 막힌 탭 */ }
$('consent-ask').before(...CONSENT_KO.map(([k, v]) => { const row = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; row.append(dt, dd); return row; }));
ui['consent-mn'].replaceChildren(...CONSENT_MN.map((text) => { const p = document.createElement('p'); p.textContent = text; return p; }));
ui.answer.maxLength = MAX_ANSWER_CHARS;
for (const name of ['start', 'submit', 'confirm', 'retry', 'repeat', 'stop']) ui[name].addEventListener('click', () => void action(name));
ui.listen.addEventListener('click', () => void listen().catch(report));
ui.pause.addEventListener('click', () => void action(interview.snapshot().paused ? 'resume' : 'pause'));
ui['voice-prepare'].addEventListener('click', () => void prepareVoice());
ui['microphone-check'].addEventListener('click', () => void checkMicrophone());
ui['room-preview'].addEventListener('click', () => { void (async () => { if (ACTIVE.includes(interview.snapshot().phase)) await pause(); await vr.preview(); })().catch(report); });
// 화면에서 질문을 받은 채로 들어가면 VR에는 「답하기」가 없으므로, 그 질문을 다시 읽고 저절로 답을 받는다.
ui.vr.addEventListener('click', () => { void (async () => { const s = (await vr.enter()) ? interview.snapshot() : null; if (s && !s.paused && ['question', 'followup'].includes(s.phase)) await present(); })().catch(report); });
for (const input of document.querySelectorAll('input[name="kind"]')) input.addEventListener('change', () => { if (input.checked) { kind = input.value; notice = ''; if (kind === 'ai') void account.start().then(render, render); render(); } });
for (const input of document.querySelectorAll('input[name="mode"]')) input.addEventListener('change', () => { if (input.checked) changeMode(input.value); });
for (const el of [ui.adult, ui.agree, ui.topik, ui.program]) el.addEventListener('change', render);
ui.answer.addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void action(interview.snapshot().phase === 'confirming' ? 'confirm' : 'submit'); } });
ui.answer.addEventListener('input', () => { if (interview.snapshot().note) { interview.clearNote(); render(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden && !vr.active && !vr.pending) void pause(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !event.repeat && vr.previewing) { event.preventDefault(); vr.closePreview(); } });
try { globalThis.speechSynthesis?.addEventListener?.('voiceschanged', renderSpeechNote); } catch { /* 소리 없는 기기 */ }
const timer = setInterval(() => {
  const now = performance.now(), delta = now - lastTick; lastTick = now;
  const s = interview.snapshot();
  // 마이크가 켜져 있을 때만 시간이 간다(권한을 묻는 동안이나 못 켠 때는 말할 수 없다).
  if (mode !== 'voice' || !micActive || busy || s.paused || s.phase !== 'listening') return;
  interview.tick(Math.min(delta, 500)); render();
  if (interview.snapshot().remainingMs === 0 || speechTurn.poll().submit) void submit().catch(report);
}, 200);
// 뒤로 가기로 되살아난 쪽은 멈춰 있고 앞 사람의 답이 보일 수 있어 새로 읽는다.
window.addEventListener('pageshow', (event) => { if (event.persisted) location.reload(); });
window.addEventListener('pagehide', () => { wipe(); disposed = true; epoch++; clearInterval(timer); stopSpeaking(); account.dispose(); void voice?.dispose(); void vr.dispose(); }, { once: true });
wipe();
for (const input of document.querySelectorAll('input[name="kind"], input[name="mode"]')) input.checked = input.value === (input.name === 'kind' ? kind : mode);
renderSpeechNote(); render();
void vr.check().then((supported) => { vrSupported = supported; if (supported && interview.snapshot().phase === 'idle') { mode = 'voice'; document.querySelector('input[name="mode"][value="voice"]').checked = true; } render(); }).catch(() => {});

