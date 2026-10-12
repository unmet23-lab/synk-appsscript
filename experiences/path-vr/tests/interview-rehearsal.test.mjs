import test from 'node:test';
import assert from 'node:assert/strict';
import { createRehearsalSession, rehearsalDurationBudget, REHEARSAL_DURATION_PROFILES, safeExitWaitMs, rehearsalMediaQualities, selectRehearsalMedia, CLIPS, QUESTIONS } from '../interview/film/rehearsal-session.mjs';

function listening() {
  const session = createRehearsalSession();
  session.start(); session.prepared(); session.clipEnded(CLIPS.question);
  assert.equal(session.snapshot().phase, 'listening');
  return session;
}

test('answering is enabled at the reviewed speech cue without needing the video tail to end', () => {
  const s = createRehearsalSession();
  s.start(); s.prepared();
  assert.equal(s.snapshot().phase, 'question');
  s.clipEnded('unrelated'); assert.equal(s.snapshot().phase, 'question');
  s.clipEnded(CLIPS.question); assert.equal(s.snapshot().phase, 'listening');
  assert.equal(s.snapshot().remainingMs, 30000);
  s.clipEnded(CLIPS.question); assert.equal(s.snapshot().remainingMs, 30000);
});

test('actual experience chooses the experience question only after a reviewed transition', () => {
  const s = listening();
  s.submit('할머니를 돌봤고 식사를 도와드렸습니다.');
  assert.equal(s.snapshot().phase, 'reviewing');
  assert.equal(s.snapshot().pendingClip, CLIPS.experience);
  assert.equal(s.snapshot().turn, 1);
  s.finishReview();
  assert.equal(s.snapshot().question, QUESTIONS.experience);
  assert.equal(s.snapshot().turn, 2);
  s.clipEnded(CLIPS.experience);
  assert.equal(s.snapshot().remainingMs, 25000);
  s.submit('식사를 준비하고 옆에서 보조했습니다.');
  assert.equal(s.snapshot().phase, 'reviewing');
  s.finishReview(); assert.equal(s.snapshot().phase, 'complete');
});

test('negated experience takes precedence over a past-action phrase', () => {
  const s = listening();
  s.submit('돌봤던 경험이 없습니다. 교육을 받고 준비하겠습니다.');
  assert.equal(s.snapshot().branch.id, 'plan');
  assert.equal(s.snapshot().branch.ruleId, 'no-experience');
  s.finishReview(); assert.equal(s.snapshot().question, QUESTIONS.plan);
});

test('preparation, motivation and unsupported cues use the bounded plan question', () => {
  for (const answer of ['자격증을 준비하고 있습니다.', '어르신께 도움이 되고 싶습니다.', '차분하게 맡은 일에 집중하겠습니다.']) {
    const s = listening(); s.submit(answer); assert.equal(s.snapshot().branch.id, 'plan');
  }
});

test('empty, uncertain, repeated-question request and recognition failures never invent a follow-up', () => {
  for (const [text, options, reason] of [
    ['', {}, 'empty'], ['질문을 다시 말씀해 주세요.', {}, 'repeat'], ['모르겠습니다.', {}, 'uncertain'],
    ['경험이 있습니다.', { confidence: .4 }, 'recognition'], ['경험이 있습니다.', { recognitionError: true }, 'recognition'],
  ]) {
    const s = listening(); s.submit(text, options);
    assert.equal(s.snapshot().phase, 'repair'); assert.equal(s.snapshot().repair.reason, reason);
    assert.equal(s.snapshot().branch, null); assert.equal(s.snapshot().answers.length, 0);
    s.retry(); assert.equal(s.snapshot().phase, 'listening'); assert.equal(s.snapshot().remainingMs, 30000);
  }
});

test('double submit cannot replace the first pending branch or duplicate an answer', () => {
  const s = listening(); s.submit('봉사한 경험이 있습니다.'); s.submit('경험이 없습니다.');
  assert.equal(s.snapshot().branch.id, 'experience'); assert.equal(s.snapshot().answers.length, 1);
});

test('pause freezes the remaining answer time and blocks state transitions until resume', () => {
  const s = listening(); s.tick(4500); s.pause(); s.tick(8000); s.submit('경험이 있습니다.');
  assert.equal(s.snapshot().remainingMs, 25500); assert.equal(s.snapshot().phase, 'listening');
  s.resume(); s.submit('경험이 있습니다.'); s.pause(); s.finishReview();
  assert.equal(s.snapshot().phase, 'reviewing');
  s.resume(); s.finishReview(); assert.equal(s.snapshot().phase, 'followup');
});

test('repeat retains the selected question and does not add answers or jump turns', () => {
  const s = listening(); s.submit('경험이 없습니다.'); s.finishReview(); s.clipEnded(CLIPS.plan); s.repeat();
  assert.equal(s.snapshot().phase, 'followup'); assert.equal(s.snapshot().clip, CLIPS.plan);
  assert.equal(s.snapshot().answers.length, 1); assert.equal(s.snapshot().turn, 2);
});

test('reviewed note-taking window is not interrupted; neutral exits are immediate', () => {
  assert.equal(safeExitWaitMs(.2), 0);
  assert.equal(safeExitWaitMs(.36), 5040);
  assert.equal(safeExitWaitMs(2), 3400.0000000000005);
  assert.equal(safeExitWaitMs(5.5), 0);
  assert.equal(safeExitWaitMs(6), 1500);
  assert.equal(safeExitWaitMs(8), 0);
  assert.equal(safeExitWaitMs(10), 0);
  assert.equal(safeExitWaitMs(NaN), null);
});

test('regenerated clips use their own reviewed exits, including a question silent tail', () => {
  const windows = [[0, .2], [6.2, 6.6], [9.2, 10]];
  assert.equal(safeExitWaitMs(5.5, 10.08, windows), 700.0000000000002, 'the old 5.4 second exit must not interrupt a new note');
  assert.equal(safeExitWaitMs(6.4, 10.08, windows), 0);
  assert.equal(safeExitWaitMs(8.5, 10.08, [[9, 10]]), 500, 'question tails also wait for their reviewed neutral pose');
  assert.equal(safeExitWaitMs(3, 10, []), 7000, 'no approved exits means waiting for the end');
  assert.throws(() => safeExitWaitMs(2, 10, [[6, 7], [3, 4]]), RangeError);
});

test('duration estimate follows regenerated speech and note-taking cues', () => {
  const manifest = { clips: [
    { id: CLIPS.question, answerStartSeconds: 5, durationSeconds: 10, safeExitWindowsSeconds: [[9, 10]] },
    { id: CLIPS.experience, answerStartSeconds: 6, durationSeconds: 10, safeExitWindowsSeconds: [[9, 10]] },
    { id: CLIPS.listening, durationSeconds: 10, safeExitWindowsSeconds: [[0, 1], [3, 10]] },
  ] };
  const budget = rehearsalDurationBudget({ manifest });
  assert.deepEqual(budget.fullAnswerEstimateMs, [69800, 76800]);
});

function variantManifest() {
  return { projection: 'rectilinear-mono', stereo: false, clips: Object.values(CLIPS).map((id) => ({
    id, src: `/480/${id}.mp4`, width: 854, height: 480, durationSeconds: 10, fps: '24/1', sha256: 'a'.repeat(64),
    answerStartSeconds: 4.2, safeExitWindowsSeconds: [[8.5, 10]], transition: { validated: true },
    variants: Object.fromEntries([['4k', 3840, 2160], ['720p', 1280, 720]].map(([key, width, height]) => [key, { src: `/${key}/${id}.mp4`, width, height, durationSeconds: 10, fps: '24/1', sha256: (key === '4k' ? 'b' : 'c').repeat(64) }])),
  })) };
}

test('all four clips switch quality together without overwriting reviewed performance or source manifest', () => {
  const original = variantManifest(), before = structuredClone(original);
  assert.deepEqual(rehearsalMediaQualities(original), ['4k', '720p']);
  for (const [quality, height] of [['4k', 2160], ['720p', 720]]) {
    const playback = selectRehearsalMedia(original, quality);
    for (const clip of playback.clips) {
      assert.equal(clip.height, height); assert.equal(clip.src, `/${quality}/${clip.id}.mp4`);
      assert.equal(clip.answerStartSeconds, 4.2); assert.deepEqual(clip.safeExitWindowsSeconds, [[8.5, 10]]);
      assert.deepEqual(clip.transition, { validated: true });
    }
  }
  assert.deepEqual(original, before);
  assert.equal(selectRehearsalMedia(original).clips[0].height, 2160, '4K is the default');
  delete original.clips[2].variants['720p'];
  assert.deepEqual(rehearsalMediaQualities(original), ['4k']);
  assert.throws(() => selectRehearsalMedia(original, '720p'), RangeError, 'a missing follow-up must not mix resolutions');
});

test('legacy 480p manifests have no quality switch and retain original media', () => {
  const original = variantManifest(); for (const clip of original.clips) delete clip.variants;
  assert.deepEqual(rehearsalMediaQualities(original), []);
  assert.deepEqual(selectRehearsalMedia(original), original);
});

test('timer clamps at zero and reset/dispose release all previous answer contents', () => {
  const s = listening(); s.tick(50000); assert.equal(s.snapshot().remainingMs, 0);
  s.submit('경험이 있습니다.'); s.reset(); assert.equal(s.snapshot().answers.length, 0); assert.equal(s.snapshot().branch, null);
  s.dispose(); assert.equal(s.snapshot().phase, 'disposed'); assert.equal(s.snapshot().answers.length, 0);
});

test('Quest duration profile fits the 60–90 second budget for both full-answer branches', () => {
  for (const followup of ['experience', 'plan']) {
    const budget = rehearsalDurationBudget({ followup });
    assert.deepEqual(budget.answerLimitsMs, [30000, 25000]);
    assert.equal(budget.leadInMs, 2000); assert.equal(budget.closingMs, 1500);
    assert.ok(budget.fullAnswerEstimateMs[0] >= 60000);
    assert.ok(budget.fullAnswerEstimateMs[1] <= 90000);
    assert.deepEqual(budget.targetRangeMs, [60000, 90000]);
    assert.equal(budget.earlyCompletionAllowed, true);
    for (const reason of ['pause', 'repeat', 'answer-repair', 'recognition-repair', 'loading', 'microphone-finalization']) assert.ok(budget.extraTimeReasons.includes(reason));
  }
});

test('explicit sample profile preserves the earlier 20/15 second preview without changing methods', () => {
  const s = createRehearsalSession({ durationProfile: 'sample' });
  s.start(); s.prepared(); s.clipEnded(CLIPS.question);
  assert.equal(s.snapshot().remainingMs, 20000);
  assert.equal(s.snapshot().durationProfile, 'sample');
  s.submit('경험이 없습니다.'); s.finishReview(); s.clipEnded(CLIPS.plan);
  assert.equal(s.snapshot().remainingMs, 15000);
  assert.equal(rehearsalDurationBudget({ durationProfile: 'sample' }).targetRangeMs, null);
});

test('early answers advance through reviewed exits without waiting for a nominal minimum duration', () => {
  const s = listening();
  s.tick(1000); s.submit('봉사 경험이 있습니다.');
  assert.equal(s.snapshot().remainingMs, 29000);
  s.finishReview(); assert.equal(s.snapshot().phase, 'followup');
  s.clipEnded(CLIPS.experience); s.tick(500); s.submit('직접 식사를 준비했습니다.');
  assert.equal(s.snapshot().remainingMs, 24500);
  s.finishReview(); assert.equal(s.snapshot().phase, 'complete');
});

test('retry/repeat restart only the active turn and cannot consume the other answer window', () => {
  const s = listening(); s.tick(30000); s.submit(''); s.retry();
  assert.equal(s.snapshot().remainingMs, 30000); assert.equal(s.snapshot().turn, 1);
  s.submit('교육을 받고 있습니다.'); s.finishReview(); s.clipEnded(CLIPS.plan);
  s.tick(24000); s.repeat(); s.clipEnded(CLIPS.plan);
  assert.equal(s.snapshot().remainingMs, 25000); assert.equal(s.snapshot().turn, 2);
  assert.equal(s.snapshot().answers.length, 1);
});

test('time options are copied, validated and independent of mutable caller snapshots', () => {
  const limits = [31000, 26000], s = createRehearsalSession({ limits });
  limits[0] = 1000;
  const view = s.snapshot(); view.answerLimitsMs[0] = 2000;
  s.start(); s.prepared(); s.clipEnded(CLIPS.question);
  assert.equal(s.snapshot().remainingMs, 31000);
  assert.deepEqual(REHEARSAL_DURATION_PROFILES.quest.answerLimitsMs, [30000, 25000]);
  for (const options of [{ durationProfile: 'unknown' }, { limits: [0, 25000] }, { limits: [Infinity, 25000] }, { limits: [30000] }, { limits: [30000, 121000] }]) assert.throws(() => createRehearsalSession(options), RangeError);
});


test('mixed negative facility experience preserves the concrete family experience and original quote', () => {
  const answer = '  요양원에서 일한 경험은 없지만 집에서 할머니 식사를 도왔습니다.  ';
  const s = listening(); s.submit(answer);
  const branch = s.snapshot().branch;
  assert.equal(branch.id, 'experience');
  assert.equal(branch.clip, CLIPS.experience);
  assert.equal(answer.slice(branch.evidence.start, branch.evidence.end), branch.evidence.quote);
  assert.match(branch.evidence.quote, /할머니/);
  assert.equal(s.snapshot().answers[0].text, answer);
  s.finishReview(); assert.equal(s.snapshot().question, QUESTIONS.experience);
});

test('other-person and hypothetical actions cannot select a recorded personal-experience question', () => {
  for (const answer of ['동료가 어르신 식사를 도왔습니다. 저는 교육부터 받겠습니다.', '제가 어르신을 돌봤다면 차분히 도왔을 겁니다.']) {
    const s = listening(); s.submit(answer);
    assert.equal(s.snapshot().branch.id, 'plan');
    assert.equal(s.snapshot().pendingClip, CLIPS.plan);
    s.finishReview(); assert.equal(s.snapshot().question, QUESTIONS.plan);
  }
});

test('all ready listening variants share a quality; planned scripts do not activate a quality', () => {
  const manifest = variantManifest();
  const tail = {...structuredClone(manifest.clips[1]), id:'strict-listen-question-tail', status:'ready', kind:'listening'};
  manifest.clips.push(tail, {id:'strict-followup-meal',status:'awaiting_generation'});
  assert.deepEqual(rehearsalMediaQualities(manifest), ['4k','720p']);
  delete tail.variants['720p'];
  assert.deepEqual(rehearsalMediaQualities(manifest), ['4k']);
  assert.throws(() => selectRehearsalMedia(manifest, '720p'), RangeError);
  delete tail.variants['4k'];
  assert.throws(() => selectRehearsalMedia(manifest), RangeError);
});
