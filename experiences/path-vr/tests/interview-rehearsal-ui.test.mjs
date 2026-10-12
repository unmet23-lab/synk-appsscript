import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createStrictVR } from '../interview/film/strict-vr.mjs';
import { createRehearsalSession, transcriptReviewPages, CLIPS } from '../interview/film/rehearsal-session.mjs';
import { createSpeechTurn } from '../interview/film/speech-turn.mjs';
import { mergeVoiceResults, voiceError } from '../interview/voice.mjs';
import { assessVoiceAnswer, replaceVoiceSpan, rebaseConfirmedSpans } from '../interview/film/voice-assessment.mjs';

// Execute the actual page registration with only its effects replaced. This
// catches the document handler that runs before the preview's window handler.
async function keyboardHarness(previewing) {
  const source = await readFile(new URL('../interview/film/rehearsal.mjs', import.meta.url), 'utf8');
  const start = source.indexOf("document.addEventListener('keydown'");
  const end = source.indexOf('\nconst timer =', start);
  assert.ok(start >= 0 && end > start, 'the page keyboard registration must be present');
  const calls = { pause: 0, close: 0, cancelMicrophoneCheck: 0, preventDefault: 0 };
  let keydown;
  const vr = { previewing, closePreview() { calls.close++; this.previewing = false; } };
  vm.runInNewContext(source.slice(start, end), {
    document: { addEventListener(type, listener) { assert.equal(type, 'keydown'); keydown = listener; } },
    vr,
    cancelMicrophoneCheck() { calls.cancelMicrophoneCheck++; },
    pause() { calls.pause++; },
  });
  return { calls, vr, press(key, repeat = false) { keydown({ key, repeat, preventDefault() { calls.preventDefault++; } }); } };
}

test('Escape closes the room preview without pausing the interview or its answer timer', async () => {
  const h = await keyboardHarness(true);
  h.press('Escape');
  assert.deepEqual(h.calls, { pause: 0, close: 1, cancelMicrophoneCheck: 1, preventDefault: 1 });
  assert.equal(h.vr.previewing, false);
  h.press('Escape', true);
  h.press('Escape', true);
  assert.deepEqual(h.calls, { pause: 0, close: 1, cancelMicrophoneCheck: 1, preventDefault: 1 }, 'holding the same Escape must not pause the newly revealed screen');
});

test('a new Escape on the normal screen still pauses while room navigation keys do not', async () => {
  const h = await keyboardHarness(false);
  for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'Enter']) h.press(key);
  assert.deepEqual(h.calls, { pause: 0, close: 0, cancelMicrophoneCheck: 0, preventDefault: 0 });
  h.press('Escape');
  h.press('Escape', true);
  assert.deepEqual(h.calls, { pause: 1, close: 0, cancelMicrophoneCheck: 1, preventDefault: 0 });
});

// Recognizer events below are deliberate test inputs, not an ASR accuracy or
// physical-microphone test. The page callbacks, preview lifecycle, submit and
// answer branching are the production implementations.
async function voicePageHarness() {
  const source = await readFile(new URL('../interview/film/rehearsal.mjs', import.meta.url), 'utf8');
  const section = (from, to) => {
    const start = source.indexOf(from), end = source.indexOf(to, start);
    assert.ok(start >= 0 && end > start, `missing page section: ${from}`);
    return source.slice(start, end);
  };
  const session = createRehearsalSession();
  session.start(); session.prepared(); session.clipEnded(CLIPS.question);
  const calls = { micStop: 0, micStart: 0, filmPause: 0, filmResume: 0, filmStop: 0, continueListening: 0, previewStart: 0, previewStop: 0, xrExit: 0 };
  let callbacks, keydown, finalResolve, finalPending = null, context, capturing = true;
  const voice = { ready: true,
    async start() { calls.micStart++; capturing = true; },
    stop() {
      calls.micStop++;
      if (finalPending) return finalPending;
      if (!capturing) return Promise.resolve(mergeVoiceResults());
      capturing = false;
      finalPending = new Promise((resolve) => { finalResolve = resolve; });
      return finalPending;
    },
  };
  const vr = createStrictVR({ mount: { hidden: true }, onExit() { calls.xrExit++; } }, {
    secure: true, xr: { isSessionSupported: async () => false },
    createStage: async () => ({ startPreview() { calls.previewStart++; }, stopPreview() { calls.previewStop++; }, dispose() {} }),
  });
  const ui = Object.fromEntries(['answer', 'mic-check-result', 'mic-meter', 'voice-status'].map((name) => [name, { value: '', textContent: '' }]));
  context = vm.createContext({
    session, ui, vr, DOMException, performance, speechTurn: createSpeechTurn(), mergeVoiceResults, transcriptReviewPages, voiceError,
    assessVoiceAnswer, replaceVoiceSpan, rebaseConfirmedSpans, CLIPS, WhisperModel: class {},
    document: { addEventListener(type, listener) { assert.equal(type, 'keydown'); keydown = listener; } },
    createVoiceInput(options) { callbacks = options; return voice; },
    film: { pause() { calls.filmPause++; }, async resume() { calls.filmResume++; }, stop() { calls.filmStop++; } },
    render() {}, stopListeningSequence() {}, continueListeningSequence() { calls.continueListening++; },
    // Safe visual exits are covered by the film/session tests. Finish the real
    // session review here so this test checks the selected follow-up question.
    async finishReview() { session.finishReview(); vm.runInContext('busy = false;', context); },
  });
  vm.runInContext([
    "let voice = null, mode = 'voice', checkingMic = false, micActive = true, partial = '', voicePrefix = '', voiceFailed = false, epoch = 0, busy = false, micStopping = null, disposed = false;",
    'let microphoneReady = true, micLevel = 0, micPeak = 0, calibrationText = "", settling = false, preparingVoice = false, lastTick = 0;',
    'let voicePrefixResult = { text: "" }, voiceReview = null, reviewPage = 0;',
    'let voiceAssessment = null, clarificationBase = null, confirmedSpans = [];',
    section('const abortError =', '\nfunction getState()'),
    section('function getState()', '\nfunction render()'),
    section('function getVoice()', '\nasync function prepareVoice()'),
    section('function cancelMicrophoneCheck()', '\nasync function loadManifest()'),
    section('async function startMicrophone(', '\nasync function beginListening('),
    section('function assessResult(', '\nasync function retry()'),
    section('async function retry()', '\nasync function repeat()'),
    section('async function pause()', '\nasync function changeMode('),
    section("document.addEventListener('keydown'", '\nconst timer ='),
    'getVoice();',
  ].join('\n'), context);
  return {
    calls, session, vr, callbacks, ui,
    snapshot: () => vm.runInContext('({ partial, voicePrefix, voicePrefixResult, voiceReview, voiceAssessment, clarificationBase, confirmedSpans, reviewPage, micActive, epoch, busy })', context),
    state: () => vm.runInContext('getState()', context),
    escape(repeat = false) { keydown({ key: 'Escape', repeat, preventDefault() {} }); },
    submit: () => vm.runInContext('submit()', context),
    confirm: () => vm.runInContext('confirm()', context),
    async confirmRemaining() {
      for (let index = 0; index < 24 && session.snapshot().phase === 'confirming'; index++) await vm.runInContext('confirm()', context);
      assert.notEqual(session.snapshot().phase, 'confirming', 'each acknowledged span must advance; confirmation cannot loop forever');
    },
    async confirmUntil(text) {
      for (let index = 0; index < 24 && session.snapshot().phase === 'confirming' && ui.answer.value !== text; index++) await vm.runInContext('confirm()', context);
      assert.equal(session.snapshot().phase, 'confirming'); assert.equal(ui.answer.value, text);
    },
    retry: () => vm.runInContext('retry()', context),
    pause: () => vm.runInContext('pause()', context),
    resume: () => vm.runInContext('resume()', context),
    stop: () => vm.runInContext('stop()', context),
    final(text, confidence = .95, metadata = {}) {
      assert.ok(finalResolve, 'stop must request final recognition first');
      const result = { text, words: text.split(/\s+/u).filter(Boolean).map((word) => ({ word, conf: confidence })), confidence, ...metadata };
      callbacks.onResult(result);
      const resolve = finalResolve; finalResolve = null; finalPending = null; resolve(result);
    },
  };
}

test('voice callbacks keep their answer across preview close and final flush cannot branch before explicit confirmation', async () => {
  const h = await voicePageHarness();
  try {
    h.callbacks.onResult({ text: '요양원에서 어르신을 돌봤습니다.' });
    await h.vr.preview();
    h.callbacks.onPartial({ text: '요양원에서 어르신을 돌봤습니다. 상태를 확인하고' });
    const before = h.snapshot();
    h.escape(); h.escape(true);
    assert.equal(h.vr.previewing, false);
    assert.equal(h.snapshot().partial, before.partial);
    assert.equal(h.snapshot().epoch, before.epoch);
    assert.equal(h.snapshot().micActive, true);
    assert.equal(h.calls.micStop, 0);
    assert.equal(h.session.snapshot().paused, false);
    const remaining = h.session.snapshot().remainingMs;
    h.session.tick(1000);
    assert.equal(h.session.snapshot().remainingMs, remaining - 1000);

    await h.vr.preview(); h.vr.closePreview();
    h.callbacks.onPartial({ text: '요양원에서 어르신을 돌봤습니다. 상태를 확인하고 담당자에게' });
    assert.equal(h.calls.micStop, 0);
    assert.equal(h.calls.filmPause, 0);
    assert.equal(h.calls.xrExit, 0);
    assert.equal(h.calls.previewStart, 2);
    assert.equal(h.calls.previewStop, 2);

    const submitting = h.submit();
    assert.equal(h.calls.micStop, 1);
    assert.equal(h.snapshot().micActive, false);
    assert.equal(h.session.snapshot().answers.length, 0, 'partial text must not branch before final recognition');
    const finalText = '요양원에서 어르신을 돌봤습니다. 상태를 확인하고 담당자에게 보고했습니다.';
    h.final(finalText); await submitting;
    assert.equal(h.session.snapshot().phase, 'confirming');
    assert.equal(h.session.snapshot().answers.length, 0);
    assert.equal(h.session.snapshot().branch, null);
    assert.equal(h.ui.answer.value, '요양원에서 어르신을 돌봤습니다.');
    assert.equal(h.snapshot().voiceReview.text, finalText);
    assert.equal(h.snapshot().micActive, false);
    await h.confirmRemaining();
    assert.equal(h.session.snapshot().answers[0].text, finalText);
    assert.equal(h.session.snapshot().clip, CLIPS.experience);
    assert.equal(h.session.snapshot().phase, 'followup');
    assert.equal(h.snapshot().partial, finalText);
  } finally { await h.vr.dispose(); }
});

test('even high-confidence wrong words require review and only the user-corrected answer selects the follow-up', async () => {
  const h = await voicePageHarness();
  try {
    const submitting = h.submit();
    h.final('저는 요양원에서 어르신을 돌본 경험이 있습니다.', .999); await submitting;
    assert.equal(h.session.snapshot().phase, 'confirming');
    assert.equal(h.session.snapshot().answers.length, 0);
    assert.equal(h.session.snapshot().pendingClip, null);
    assert.equal(h.snapshot().voiceReview.confidence, .999);
    await h.confirmUntil('경험이 있습니다.');
    assert.equal(h.session.snapshot().answers.length, 0);
    h.ui.answer.value = '경험이 없습니다.';
    await h.confirmRemaining();
    assert.equal(h.session.snapshot().phase, 'followup');
    assert.equal(h.session.snapshot().clip, CLIPS.plan);
    assert.equal(h.session.snapshot().answers[0].text, '저는 요양원에서 어르신을 돌본 경험이 없습니다.');
    assert.equal(h.snapshot().voiceReview, null);
  } finally { await h.vr.dispose(); }
});

test('review keeps the microphone off and preserves an edited draft across preview, pause and resume', async () => {
  const h = await voicePageHarness();
  try {
    const submitting = h.submit(); h.final('요양보호사 교육을 받고 있습니다.'); await submitting;
    h.ui.answer.value = '저는 할머니의 식사를 도와드렸습니다.';
    const remaining = h.session.snapshot().remainingMs;
    await h.vr.preview(); h.escape();
    assert.equal(h.session.snapshot().phase, 'confirming');
    assert.equal(h.calls.micStop, 1); assert.equal(h.calls.filmPause, 0);
    h.session.tick(120000);
    assert.equal(h.session.snapshot().remainingMs, remaining);
    await h.pause(); await h.confirm();
    assert.equal(h.session.snapshot().answers.length, 0);
    assert.equal(h.ui.answer.value, '저는 할머니의 식사를 도와드렸습니다.');
    await h.resume();
    assert.equal(h.session.snapshot().phase, 'confirming');
    assert.equal(h.calls.micStart, 0, 'resuming review must not reopen microphone capture');
    assert.equal(h.snapshot().micActive, false);
    h.callbacks.onResult({ text: '뒤늦게 도착한 인식문' });
    assert.equal(h.ui.answer.value, '저는 할머니의 식사를 도와드렸습니다.');
    await h.confirm();
    assert.equal(h.session.snapshot().clip, CLIPS.experience);
    assert.equal(h.session.snapshot().answers[0].text, '저는 할머니의 식사를 도와드렸습니다.');
  } finally { await h.vr.dispose(); }
});

test('rerecording an unknown-engine review replaces its unconfirmed span and opens one capture without resetting the film', async () => {
  const h = await voicePageHarness();
  try {
    let submitting = h.submit(); h.final('돌봄 경험이 있습니다.'); await submitting;
    await h.retry();
    assert.equal(h.session.snapshot().phase, 'listening');
    assert.equal(h.session.snapshot().answers.length, 0);
    assert.equal(h.calls.micStart, 1); assert.equal(h.snapshot().micActive, true);
    assert.equal(h.calls.filmPause, 0); assert.equal(h.calls.filmStop, 0);
    assert.equal(h.ui.answer.value, ''); assert.equal(h.snapshot().partial, '');
    assert.equal(h.snapshot().voiceReview, null);
    submitting = h.submit(); h.final('저는 돌봄 경험이 없습니다. 교육을 받고 준비하고 있습니다.'); await submitting;
    await h.confirmRemaining();
    assert.equal(h.session.snapshot().clip, CLIPS.plan);
    assert.equal(h.session.snapshot().answers.length, 1);
  } finally { await h.vr.dispose(); }
});

test('a final recognition arriving after reset cannot create a review or an answer in the new session', async () => {
  const h = await voicePageHarness();
  try {
    const submitting = h.submit(), stopping = h.stop();
    h.final('저는 요양원에서 어르신을 돌봤습니다.'); await Promise.all([submitting, stopping]);
    assert.equal(h.session.snapshot().phase, 'idle');
    assert.equal(h.session.snapshot().answers.length, 0);
    assert.equal(h.session.snapshot().branch, null);
    assert.equal(h.snapshot().voiceReview, null);
    assert.equal(h.ui.answer.value, '');
    await h.confirm();
    assert.equal(h.session.snapshot().phase, 'idle');
  } finally { await h.vr.dispose(); }
});

test('normal-screen Escape still closes voice capture and retains its final answer for resume', async () => {
  const h = await voicePageHarness();
  try {
    h.callbacks.onPartial({ text: '어르신 식사를' });
    h.escape();
    assert.equal(h.calls.micStop, 1);
    assert.equal(h.calls.filmPause, 1);
    assert.equal(h.snapshot().micActive, false);
    assert.equal(h.session.snapshot().paused, true);
    const remaining = h.session.snapshot().remainingMs;
    h.session.tick(1000);
    assert.equal(h.session.snapshot().remainingMs, remaining);
    h.final('어르신 식사를 도와드렸습니다.');
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(h.snapshot().voicePrefix, '어르신 식사를 도와드렸습니다.');
    assert.equal(h.snapshot().partial, h.snapshot().voicePrefix);
    assert.equal(h.session.snapshot().answers.length, 0);
  } finally { await h.vr.dispose(); }
});

function whisperMetadata(text, { engine = 'whisper-tiny', uncertain = [] } = {}) {
  return { engine, words: text.split(/\s+/u).map((word) => ({ word, conf: uncertain.includes(word) ? .1 : .92 })) };
}
const CLEAR_EXPERIENCE = '저는 할머니 식사를 도왔습니다.';

test('supported Whisper metadata and a clear personal experience advance after final flush without confirmation', async () => {
  for (const engine of ['whisper-tiny', 'whisper-base']) {
    const h = await voicePageHarness();
    try {
      const submitting = h.submit();
      assert.equal(h.session.snapshot().answers.length, 0);
      h.final(CLEAR_EXPERIENCE, .92, whisperMetadata(CLEAR_EXPERIENCE, { engine })); await submitting;
      assert.equal(h.session.snapshot().phase, 'followup', engine);
      assert.equal(h.session.snapshot().clip, CLIPS.experience);
      assert.equal(h.session.snapshot().answers[0].text, CLEAR_EXPERIENCE);
      assert.equal(h.snapshot().voiceReview, null);
      assert.equal(h.snapshot().voiceAssessment, null);
      assert.equal(h.calls.micStop, 1);
      assert.equal(h.snapshot().micActive, false);
    } finally { await h.vr.dispose(); }
  }
});

test('a low-score decisive word asks only for that span while retaining the complete answer', async () => {
  const h = await voicePageHarness();
  try {
    const submitting = h.submit();
    h.final(CLEAR_EXPERIENCE, .92, whisperMetadata(CLEAR_EXPERIENCE, { uncertain: ['도왔습니다.'] })); await submitting;
    assert.equal(h.session.snapshot().phase, 'confirming');
    assert.equal(h.session.snapshot().answers.length, 0);
    assert.equal(h.ui.answer.value, '도왔습니다.');
    assert.equal(h.snapshot().voiceReview.text, CLEAR_EXPERIENCE);
    assert.equal(h.state().partialReview, true);
    assert.equal(h.snapshot().micActive, false);
    const remaining = h.session.snapshot().remainingMs;
    h.session.tick(100000); assert.equal(h.session.snapshot().remainingMs, remaining);
    await h.confirm();
    assert.equal(h.session.snapshot().phase, 'followup');
    assert.equal(h.session.snapshot().answers[0].text, CLEAR_EXPERIENCE);
    assert.equal(h.session.snapshot().clip, CLIPS.experience);
  } finally { await h.vr.dispose(); }
});

test('editing one uncertain span retains the rest verbatim and only the corrected meaning selects a follow-up', async () => {
  const h = await voicePageHarness();
  try {
    const submitting = h.submit();
    h.final(CLEAR_EXPERIENCE, .92, whisperMetadata(CLEAR_EXPERIENCE, { uncertain: ['도왔습니다.'] })); await submitting;
    h.ui.answer.value = '도운 경험이 없습니다.';
    await h.confirm();
    assert.equal(h.session.snapshot().answers.length, 1);
    assert.equal(h.session.snapshot().answers[0].text, '저는 할머니 식사를 도운 경험이 없습니다.');
    assert.equal(h.session.snapshot().clip, CLIPS.plan);
    assert.equal(h.snapshot().partial, '저는 할머니 식사를 도운 경험이 없습니다.');
    assert.equal(h.snapshot().voiceReview, null);
  } finally { await h.vr.dispose(); }
});

test('rerecording only the uncertain span keeps the original sentence and does not restart the actors', async () => {
  const h = await voicePageHarness();
  try {
    let submitting = h.submit();
    h.final(CLEAR_EXPERIENCE, .92, whisperMetadata(CLEAR_EXPERIENCE, { uncertain: ['도왔습니다.'] })); await submitting;
    await h.retry();
    assert.equal(h.session.snapshot().phase, 'listening');
    assert.equal(h.snapshot().clarificationBase.result.text, CLEAR_EXPERIENCE);
    assert.match(h.state().clarificationPrompt, /도왔습니다/);
    assert.equal(h.calls.micStart, 1); assert.equal(h.calls.filmPause, 0); assert.equal(h.calls.filmStop, 0);
    const replacement = '도운 경험이 없습니다.';
    submitting = h.submit(); h.final(replacement, .92, whisperMetadata(replacement)); await submitting;
    assert.equal(h.session.snapshot().phase, 'confirming', 'a new recording can still flip the decisive polarity');
    assert.equal(h.ui.answer.value, '경험이 없습니다.');
    await h.confirm();
    assert.equal(h.session.snapshot().answers.length, 1);
    assert.equal(h.session.snapshot().answers[0].text, '저는 할머니 식사를 도운 경험이 없습니다.');
    assert.equal(h.session.snapshot().clip, CLIPS.plan);
    assert.equal(h.snapshot().clarificationBase, null);
  } finally { await h.vr.dispose(); }
});

test('preview and pause preserve a partial edit, while late recognition cannot change the reviewed span', async () => {
  const h = await voicePageHarness();
  try {
    const submitting = h.submit();
    h.final(CLEAR_EXPERIENCE, .92, whisperMetadata(CLEAR_EXPERIENCE, { uncertain: ['도왔습니다.'] })); await submitting;
    h.ui.answer.value = '도운 경험이 없습니다.';
    const issue = h.snapshot().voiceAssessment.issue;
    await h.vr.preview(); h.escape();
    await h.pause(); await h.confirm();
    assert.equal(h.session.snapshot().answers.length, 0);
    assert.equal(h.ui.answer.value, '도운 경험이 없습니다.');
    assert.equal(h.snapshot().voiceAssessment.issue, issue);
    await h.resume();
    h.callbacks.onPartial({ text: '뒤늦은 부분 결과' }); h.callbacks.onResult({ text: '뒤늦은 최종 결과' });
    assert.equal(h.ui.answer.value, '도운 경험이 없습니다.');
    assert.equal(h.snapshot().voiceReview.text, CLEAR_EXPERIENCE);
    assert.equal(h.calls.micStart, 0);
    await h.confirm();
    assert.equal(h.session.snapshot().clip, CLIPS.plan);
    assert.equal(h.session.snapshot().answers[0].text, '저는 할머니 식사를 도운 경험이 없습니다.');
  } finally { await h.vr.dispose(); }
});

test('reset during partial rerecording discards its delayed final and original clarification owner', async () => {
  const h = await voicePageHarness();
  try {
    let submitting = h.submit();
    h.final(CLEAR_EXPERIENCE, .92, whisperMetadata(CLEAR_EXPERIENCE, { uncertain: ['도왔습니다.'] })); await submitting;
    await h.retry();
    submitting = h.submit(); const stopping = h.stop();
    h.final('도운 경험이 없습니다.', .92, whisperMetadata('도운 경험이 없습니다.'));
    await Promise.all([submitting, stopping]);
    assert.equal(h.session.snapshot().phase, 'idle');
    assert.equal(h.session.snapshot().answers.length, 0);
    assert.equal(h.snapshot().clarificationBase, null);
    assert.equal(h.snapshot().voiceAssessment, null);
    assert.equal(h.ui.answer.value, '');
    await h.confirm(); assert.equal(h.session.snapshot().phase, 'idle');
  } finally { await h.vr.dispose(); }
});

test('pausing a span rerecording preserves its flushed prefix and resumes without losing the rest of the answer', async () => {
  const h = await voicePageHarness();
  try {
    let submitting = h.submit();
    h.final(CLEAR_EXPERIENCE, .92, whisperMetadata(CLEAR_EXPERIENCE, { uncertain: ['도왔습니다.'] })); await submitting;
    await h.retry();
    const pausing = h.pause();
    h.final('도운 경험이', .92, whisperMetadata('도운 경험이')); await pausing;
    assert.equal(h.session.snapshot().paused, true);
    assert.equal(h.snapshot().clarificationBase.result.text, CLEAR_EXPERIENCE);
    assert.equal(h.snapshot().voicePrefixResult.engine, 'whisper-tiny');
    await h.resume();
    assert.equal(h.snapshot().voicePrefix, '도운 경험이');
    assert.equal(h.calls.micStart, 2);
    submitting = h.submit(); h.final('없습니다.', .92, whisperMetadata('없습니다.')); await submitting;
    assert.equal(h.session.snapshot().phase, 'confirming');
    assert.equal(h.ui.answer.value, '경험이 없습니다.');
    await h.confirm();
    assert.equal(h.session.snapshot().answers.length, 1);
    assert.equal(h.session.snapshot().answers[0].text, '저는 할머니 식사를 도운 경험이 없습니다.');
    assert.equal(h.session.snapshot().clip, CLIPS.plan);
    assert.equal(h.calls.filmStop, 0);
  } finally { await h.vr.dispose(); }
});

test('editing a later uncertain word does not ask again for an earlier word the user already confirmed', async () => {
  const h = await voicePageHarness();
  try {
    const submitting = h.submit();
    h.final(CLEAR_EXPERIENCE, .92, whisperMetadata(CLEAR_EXPERIENCE, { uncertain: ['저는', '도왔습니다.'] })); await submitting;
    assert.equal(h.ui.answer.value, '저는');
    await h.confirm();
    assert.equal(h.ui.answer.value, '도왔습니다.');
    assert.equal(h.session.snapshot().answers.length, 0);
    h.ui.answer.value = '도와드렸습니다.';
    await h.confirm();
    assert.equal(h.session.snapshot().phase, 'followup', 'two separate uncertain words require two confirmations, even when the second is edited');
    assert.equal(h.session.snapshot().answers[0].text, '저는 할머니 식사를 도와드렸습니다.');
    assert.equal(h.session.snapshot().clip, CLIPS.experience);
  } finally { await h.vr.dispose(); }
});

test('high-confidence absent-to-present substitution cannot branch before a narrow correction, including room toggles', async () => {
  const h = await voicePageHarness();
  try {
    const decoded = '저는 돌봄 경험이 있습니다. 앞으로 교육을 받겠습니다.';
    h.callbacks.onPartial({ text: decoded });
    await h.vr.preview(); h.escape();
    assert.equal(h.calls.micStop, 0);
    const submitting = h.submit();
    h.final(decoded, .999, { engine: 'whisper-base', words: decoded.split(/\s+/u).map(word => ({ word, conf: .999 })) });
    await submitting;
    assert.equal(h.session.snapshot().phase, 'confirming');
    assert.equal(h.session.snapshot().answers.length, 0);
    assert.equal(h.session.snapshot().branch, null);
    assert.equal(h.ui.answer.value, '경험이 있습니다.');
    h.ui.answer.value = '경험이 없습니다.';
    await h.vr.preview(); h.escape();
    assert.equal(h.ui.answer.value, '경험이 없습니다.');
    assert.equal(h.calls.filmPause, 0);
    await h.confirm();
    assert.equal(h.session.snapshot().phase, 'followup');
    assert.equal(h.session.snapshot().clip, CLIPS.plan);
    assert.equal(h.session.snapshot().answers[0].text, '저는 돌봄 경험이 없습니다. 앞으로 교육을 받겠습니다.');
    assert.equal(h.calls.micStart, 0);
  } finally { await h.vr.dispose(); }
});

test('confirming a correct high-score experience claim proceeds once without rerecording or another review', async () => {
  const h = await voicePageHarness();
  try {
    const decoded = '저는 어르신의 식사를 도운 적이 있습니다.';
    const submitting = h.submit();
    h.final(decoded, .99, whisperMetadata(decoded, { engine: 'whisper-base' })); await submitting;
    assert.equal(h.session.snapshot().phase, 'confirming');
    assert.equal(h.ui.answer.value, '도운 적이 있습니다.');
    await h.confirm();
    assert.equal(h.session.snapshot().phase, 'followup');
    assert.equal(h.session.snapshot().clip, CLIPS.experience);
    assert.equal(h.session.snapshot().answers[0].text, decoded);
    assert.equal(h.calls.micStart, 0);
    assert.equal(h.snapshot().voiceReview, null);
  } finally { await h.vr.dispose(); }
});

test('a short spoken no-experience reply reaches preparation after one local confirmation without forcing a new answer', async () => {
  for (const decoded of ['저는 아직 안 해봤어요.', '아직안해봤어요.']) {
    const h = await voicePageHarness();
    try {
      const submitting = h.submit();
      h.final(decoded, .99, whisperMetadata(decoded, { engine: 'whisper-base' })); await submitting;
      assert.equal(h.session.snapshot().phase, 'confirming');
      assert.equal(h.session.snapshot().answers.length, 0);
      await h.confirm();
      assert.equal(h.session.snapshot().phase, 'followup', decoded);
      assert.equal(h.session.snapshot().clip, CLIPS.plan);
      assert.equal(h.session.snapshot().answers[0].text, decoded);
      assert.equal(h.calls.micStart, 0);
      assert.equal(h.snapshot().voiceReview, null);
    } finally { await h.vr.dispose(); }
  }
});
