import test from 'node:test';
import assert from 'node:assert/strict';
import { createRehearsalSession, transcriptReviewPages, CLIPS } from '../interview/film/rehearsal-session.mjs';
import { getStrictVRControls, pickStrictVRControl } from '../interview/film/strict-vr.mjs';

// These are session and controller-hit tests. No speech model, real microphone
// or Quest hardware is exercised; browser/ASR verification remains separate.
function listeningSession() {
  const session = createRehearsalSession();
  session.start(); session.prepared(); session.clipEnded(CLIPS.question);
  return session;
}

test('unconfirmed speech freezes the answer clock and cannot create an answer, branch or video transition', () => {
  const session = listeningSession(); session.tick(4300);
  const remaining = session.snapshot().remainingMs;
  const text = '저는 요양원에서 어르신을 돌봤습니다.';
  const state = session.reviewTranscript(text);
  assert.equal(state.phase, 'confirming'); assert.equal(state.transcriptDraft, text);
  for (const elapsed of [1000, 30000, 300000]) session.tick(elapsed);
  session.finishReview(); session.clipEnded(CLIPS.question);
  session.submit('저는 돌봄 경험이 있습니다.');
  assert.equal(session.snapshot().remainingMs, remaining);
  assert.equal(session.snapshot().phase, 'confirming');
  assert.equal(session.snapshot().answers.length, 0);
  assert.equal(session.snapshot().branch, null);
  assert.equal(session.snapshot().pendingClip, null);
  assert.equal(session.snapshot().clip, CLIPS.question);
});

test('confirmation uses the corrected answer and still enforces ordinary semantic validation', () => {
  const session = listeningSession();
  session.reviewTranscript('저는 돌봄 경험이 있습니다.');
  const corrected = '저는 돌봄 경험이 없습니다. 요양보호사 교육을 받고 준비하고 있습니다.';
  let state = session.confirmTranscript(corrected);
  assert.equal(state.phase, 'reviewing');
  assert.equal(state.transcriptDraft, '');
  assert.equal(state.pendingClip, CLIPS.plan);
  assert.equal(state.answers[0].text, corrected);
  session.finishReview(); session.clipEnded(CLIPS.plan);
  session.reviewTranscript('제가 식사 보조를 배워 준비하겠습니다.');
  state = session.confirmTranscript('');
  assert.equal(state.phase, 'repair');
  assert.equal(state.answers.length, 1, 'confirming an empty correction must not accept a second answer');
});

test('paused confirmation cannot accept, replace or restart a transcript until resumed', () => {
  const session = listeningSession(), text = '저는 할머니의 식사를 도와드렸습니다.';
  session.reviewTranscript(text); session.pause();
  const paused = session.snapshot();
  session.confirmTranscript('저는 돌봄 경험이 없습니다.');
  session.reviewTranscript('바뀐 인식문'); session.retry(); session.tick(300000);
  assert.deepEqual(session.snapshot(), paused);
  session.resume(); session.confirmTranscript(text);
  assert.equal(session.snapshot().answers.length, 1);
  assert.equal(session.snapshot().pendingClip, CLIPS.experience);
});

test('reset, retry and non-review states reject stale confirmation without accepting old words', () => {
  const text = '저는 할머니의 식사를 도와드렸습니다.';
  const session = listeningSession();
  session.reviewTranscript(text); session.retry();
  const retried = session.snapshot();
  assert.equal(retried.phase, 'listening'); assert.equal(retried.transcriptDraft, '');
  assert.equal(retried.remainingMs, retried.answerLimitsMs[0]);
  session.confirmTranscript(text);
  assert.deepEqual(session.snapshot(), retried);
  session.reviewTranscript(text); session.reset();
  const reset = session.snapshot(); session.confirmTranscript(text);
  assert.deepEqual(session.snapshot(), reset);
  session.start(); session.prepared();
  const question = session.snapshot(); session.confirmTranscript(text);
  assert.deepEqual(session.snapshot(), question);
  session.clipEnded(CLIPS.question); session.reviewTranscript(text);
  session.confirmTranscript(text);
  const accepted = session.snapshot(); session.confirmTranscript('뒤늦은 확인');
  assert.deepEqual(session.snapshot(), accepted, 'a duplicate confirmation must not append an answer');
});

test('the second voice answer also remains unaccepted until confirmation', () => {
  const session = listeningSession();
  session.reviewTranscript('저는 요양보호사 교육을 받고 있습니다.');
  session.confirmTranscript('저는 요양보호사 교육을 받고 있습니다.');
  session.finishReview(); session.clipEnded(CLIPS.plan);
  session.reviewTranscript('저는 교육을 받고 안전 수칙을 배워 준비하겠습니다.');
  session.tick(120000); session.finishReview();
  assert.equal(session.snapshot().phase, 'confirming');
  assert.equal(session.snapshot().answers.length, 1);
  session.confirmTranscript('저는 교육을 받고 안전 수칙을 배워 준비하겠습니다.');
  session.finishReview();
  assert.equal(session.snapshot().phase, 'complete');
  assert.equal(session.snapshot().answers.length, 2);
});

test('transcript pages preserve every character including whitespace, punctuation and Unicode through the maximum answer length', () => {
  for (const text of ['', '짧은 답변', '가'.repeat(90), '가'.repeat(91), '할머니를 도왔습니다.\n 아직 배워야 할 점도 있습니다. '.repeat(45), '🙂가족 👩‍⚕️ 경험'.repeat(25), '가'.repeat(2000)]) {
    const pages = transcriptReviewPages(text);
    assert.ok(pages.length > 0);
    assert.equal(pages.join(''), text, 'review pagination must never summarize, trim or omit words');
    assert.ok(pages.every((page) => Array.from(page).length <= 90));
    assert.equal(pages.length, Math.max(1, Math.ceil(Array.from(text).length / 90)));
  }
});

test('the VR primary controller offers next-page until the last transcript page, then confirmation', () => {
  const primaryUV = { x: 332 / 1536, y: 1 - 338 / 400 };
  const retryUV = { x: 856 / 1536, y: 1 - 338 / 400 };
  const exitUV = { x: 1292 / 1536, y: 1 - 338 / 400 };
  const reviewPages = transcriptReviewPages('저는 할머니를 돌보며 식사를 도와드렸습니다. '.repeat(12));
  assert.ok(reviewPages.length > 2);
  for (let reviewPage = 0; reviewPage < reviewPages.length; reviewPage++) {
    const state = { phase: 'confirming', canConfirm: true, reviewPage, reviewPages, paused: false };
    const expected = reviewPage === reviewPages.length - 1 ? 'confirm' : 'reviewNext';
    assert.equal(getStrictVRControls(state)[0].action, expected);
    assert.equal(pickStrictVRControl(primaryUV, state), expected);
    assert.equal(pickStrictVRControl(retryUV, state), 'retry');
    assert.equal(pickStrictVRControl(exitUV, state), 'exit');
    assert.equal(pickStrictVRControl(primaryUV, { ...state, canConfirm: false }), null);
    assert.equal(pickStrictVRControl(primaryUV, { ...state, paused: true }), 'resume');
  }
  assert.equal(pickStrictVRControl(primaryUV, { phase: 'confirming', canConfirm: true, reviewPage: 0, reviewPages: ['한 페이지'] }), 'confirm');
});
