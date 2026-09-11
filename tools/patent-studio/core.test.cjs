'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { VERSION, createSession, applyEvent, evaluate, examples, TARGET } = require('./core.cjs');

const START = '2026-09-11T00:00:00.000Z';
let n = 0;
const session = (options = {}) => createSession({ id: `test-${++n}`, createdAt: START, ...options });
const event = (s, type, payload = {}) => {
  const id = `event-${++n}`;
  const at = payload.at || new Date(Date.parse(START) + n * 1000).toISOString();
  // Legacy happy-path fixtures now state their assumed browser capture times.
  // File timing tests explicitly pass acquisition:'file'.
  const capture = type === 'audio-attached' && !Object.hasOwn(payload, 'acquisition') ? {
    acquisition: 'microphone', captureStartedAt: new Date(Date.parse(at) - 500).toISOString(),
    captureEndedAt: new Date(Date.parse(at) - 100).toISOString(),
  } : {};
  return applyEvent(s, { id, type, at, ...capture, ...payload });
};
const find = (s, id, options) => evaluate(s, options).cells.find(c => c.id === id);
function recorded(text = TARGET, options = {}) {
  let s = session({ mode: 'recording' });
  s = event(s, 'audio-attached', { role: 'original', audioRef: 'local:original.webm', mimeType: 'audio/webm' });
  s = event(s, 'task-confirmed', { roleConfirmed: true, pastIndependent: true, exposureScopeConfirmed: true, ...options });
  return event(s, 'review-original', { text, confirmed: true });
}
function assistedResponse(s, text = TARGET) {
  s = event(s, 'help-presented', { text: TARGET, exposesAnswer: true });
  s = event(s, 'audio-attached', { role: 'response', responseId: 'r1', audioRef: 'local:response.webm', mimeType: 'audio/webm' });
  return event(s, 'review-response', { responseId: 'r1', text, confirmed: true, exposureScopeConfirmed: true });
}
function reviewedFile(text = TARGET) {
  let s = session({ mode: 'recording' });
  s = event(s, 'audio-attached', { acquisition: 'file', audioRef: 'local:file.wav' });
  s = event(s, 'task-confirmed', { roleConfirmed: true, pastIndependent: true, exposureScopeConfirmed: true });
  return event(s, 'review-original', { text, confirmed: true });
}

test('default controlled ambiguity preserves only independent past observation', () => {
  const s = session();
  assert.equal(find(s, 'e0:asr').status, 'held');
  assert.equal(find(s, 'e0:object').status, 'held');
  assert.equal(find(s, 'e0:past').status, 'accepted');
  assert.equal(find(s, 'e0:object').witness.length, 2);
  assert.deepEqual(evaluate(s).metrics, {
    total: 3, accepted: 1, held: 2, excluded: 0, acceptedAsr: 0, acceptedPerformance: 1,
    metricScope: '이 세션의 기록 처리 개수이며 정확도·실력·등록 가능성이 아닙니다.',
  });
});

test('events return a new session and replay does not duplicate a help event', () => {
  const s = session(); const before = structuredClone(s);
  const incoming = { id: 'same-event', type: 'help-presented', text: TARGET, at: '2026-09-11T01:00:00Z' };
  const next = applyEvent(s, incoming);
  assert.deepEqual(s, before); assert.notEqual(next, s);
  assert.equal(next.helpEvents.length, 1);
  const replay = applyEvent(next, incoming);
  assert.equal(replay.helpEvents.length, 1); assert.equal(replay.revision, next.revision);
});

test('unknown scope blocks apparent agreement and clearing it does not invent audio or review', () => {
  let s = session({ exampleId: 'unknown-coverage' });
  assert.equal(evaluate(s).metrics.accepted, 0);
  s = event(s, 'unknown-set', { enabled: false });
  assert.equal(evaluate(s).metrics.accepted, 3);
  let empty = session({ mode: 'recording' });
  empty = event(empty, 'unknown-set', { enabled: false });
  assert.equal(evaluate(empty).metrics.accepted, 0);
});

test('a single confident machine transcript never grants human review or scope', () => {
  let s = session({ mode: 'recording' });
  s = event(s, 'audio-attached', { audioRef: 'local:one.webm' });
  s = event(s, 'task-confirmed', { roleConfirmed: true, pastIndependent: true, exposureScopeConfirmed: true });
  s = event(s, 'transcripts-set', { alternatives: [{ text: TARGET, confidence: 1 }], source: 'machine', scopeConfirmed: true, confirmed: true });
  assert.equal(s.original.scopeConfirmed, false);
  assert.equal(evaluate(s).metrics.accepted, 0);
  s = event(s, 'review-original', { text: TARGET, confirmed: true });
  assert.equal(evaluate(s).metrics.accepted, 3);
});

test('human text input without explicit listening confirmation cannot become audio evidence', () => {
  let s = session({ mode: 'recording' });
  s = event(s, 'audio-attached', { audioRef: 'local:one.webm' });
  s = event(s, 'task-confirmed', { roleConfirmed: true, pastIndependent: true, exposureScopeConfirmed: true });
  s = event(s, 'transcripts-set', { alternatives: [{ text: TARGET }], source: 'human', scopeConfirmed: true });
  assert.equal(evaluate(s).metrics.accepted, 0);
});

test('natural alternative is not called a grammar error without the task role constraint', () => {
  const s = session({ exampleId: 'natural-alternative' });
  const c = find(s, 'e0:object');
  assert.equal(c.status, 'held'); assert.equal(c.reasonCode, 'role-unconfirmed');
  assert.equal(find(s, 'e0:asr').status, 'accepted');
  assert.equal(find(s, 'e0:past').status, 'accepted');
});

test('a reviewed natural expression remains ASR evidence while unsupported grammar effects are held', () => {
  const s = recorded('친구와 카페에서 만났어요');
  assert.equal(find(s, 'e0:asr').status, 'accepted');
  assert.equal(find(s, 'e0:asr').value, '친구와 카페에서 만났어요');
  assert.ok(evaluate(s).cells.filter(c => c.skill !== 'asr').every(c => c.reasonCode === 'unsupported-expression'));
});

test('empty hypotheses and unknown-only text never pass vacuous agreement', () => {
  let s = recorded();
  s = event(s, 'transcripts-set', { source: 'human', alternatives: [], scopeConfirmed: true, confirmed: true });
  assert.equal(evaluate(s).metrics.accepted, 0);
  s = event(s, 'review-original', { text: 'UNKNOWN', confirmed: true });
  assert.equal(evaluate(s).metrics.accepted, 0);
});

test('removing the past independence condition holds past while retaining separate ASR evidence', () => {
  let s = recorded();
  s = event(s, 'task-confirmed', { pastIndependent: false });
  assert.equal(find(s, 'e0:past').reasonCode, 'independence-unconfirmed');
  assert.equal(find(s, 'e0:asr').status, 'accepted');
});

test('a local unknown preserves past only under the explicit independence condition', () => {
  let s = recorded();
  s = event(s, 'unknown-set', { enabled: true, reason: '조사 원인 불명', scope: ['object'] });
  assert.equal(find(s, 'e0:object').status, 'held');
  assert.equal(find(s, 'e0:asr').status, 'held');
  assert.equal(find(s, 'e0:past').status, 'accepted');
  s = event(s, 'task-confirmed', { pastIndependent: false });
  assert.equal(find(s, 'e0:past').status, 'held');
});

test('review of original audio resolves original ambiguity without creating a new response', () => {
  const before = session();
  const after = event(before, 'review-original', { text: TARGET, confirmed: true });
  assert.equal(after.responses.length, 0);
  assert.equal(evaluate(after).metrics.accepted, 3);
  assert.equal(find(after, 'e0:past').value, find(before, 'e0:past').value);
  assert.deepEqual(find(after, 'e0:past').dependencies, find(before, 'e0:past').dependencies);
});

test('late machine completion is preserved separately and never replaces confirmed human hearing', () => {
  const s = recorded();
  const before = structuredClone(s.original);
  const next = event(s, 'transcripts-set', { role: 'original', source: 'machine', alternatives: [{ text: '친구가 만나서 카페에 갔어요' }], scopeConfirmed: false });
  assert.deepEqual(next.original.alternatives, before.alternatives);
  assert.equal(next.original.humanConfirmed, true);
  assert.equal(next.original.source, 'human');
  assert.equal(next.original.machineAlternatives[0].text, '친구가 만나서 카페에 갔어요');
  assert.equal(evaluate(next).metrics.accepted, 3);
});

test('replacement audio invalidates hearing confirmation for the old recording', () => {
  const next = event(recorded(), 'audio-attached', { audioRef: 'local:different.webm' });
  assert.equal(next.original.humanConfirmed, false);
  assert.equal(next.original.alternatives.length, 0);
  assert.equal(evaluate(next).metrics.accepted, 0);
});

test('response audio fixes the epoch and help scope before delayed transcription finishes', () => {
  let s = session();
  s = event(s, 'help-presented', { text: TARGET, exposesAnswer: true });
  s = event(s, 'audio-attached', { role: 'response', responseId: 'r1', audioRef: 'local:r1.webm' });
  const captured = structuredClone(s.responses[0]);
  s = event(s, 'help-presented', { text: '두 번째 안내', exposesAnswer: true });
  s = event(s, 'transcripts-set', { role: 'response', responseId: 'r1', source: 'machine', alternatives: [{ text: TARGET }], scopeConfirmed: false });
  assert.equal(s.responses.length, 1); assert.equal(s.responses[0].epoch, captured.epoch);
  assert.equal(s.responses[0].at, captured.at); assert.deepEqual(s.responses[0].helpIds, captured.helpIds);
  assert.equal(find(s, 'e1:asr').status, 'held');
  assert.equal(find(s, 'e0:object').status, 'held');
});

test('actual assisted response is useful in its new epoch and cannot prove the original performance', () => {
  const s = assistedResponse(session());
  assert.equal(find(s, 'e0:object').status, 'held');
  assert.equal(find(s, 'e1:asr').status, 'accepted');
  assert.equal(find(s, 'e1:object').status, 'accepted');
  assert.equal(find(s, 'e1:object').assistance, 'after-help');
  assert.equal(find(s, 'e1:earlier-proof').status, 'excluded');
  assert.equal(s.original.alternatives.length, 2);
});

test('typed response without a response audio reference cannot turn into an ASR training pair', () => {
  let s = session();
  s = event(s, 'help-presented', { text: TARGET });
  s = event(s, 'response-added', { text: TARGET, confirmed: true, scopeConfirmed: true });
  assert.equal(find(s, 'e1:asr').reasonCode, 'missing-audio');
  assert.equal(find(s, 'e0:object').status, 'held');
});

test('late prior help invalidates only affected original performance; ASR and independent past survive', () => {
  let s = recorded();
  s = event(s, 'help-presented', { text: '친구를', skills: ['object'], exposesAnswer: true,
    at: '2026-09-11T00:00:00.500Z' });
  assert.equal(find(s, 'e0:object').status, 'excluded');
  assert.equal(find(s, 'e0:asr').status, 'accepted');
  assert.equal(find(s, 'e0:past').status, 'accepted');
});

test('unknown external or missing app help coverage is not inferred from an empty log', () => {
  const s = recorded(TARGET, { exposureScopeConfirmed: false });
  assert.equal(find(s, 'e0:object').reasonCode, 'exposure-scope-unconfirmed');
  assert.equal(find(s, 'e0:past').status, 'held');
  assert.equal(find(s, 'e0:asr').status, 'accepted');
});

test('four ablations evaluate the same input and never mutate main or invent actual responses', () => {
  const s = session(); const snapshot = structuredClone(s);
  const main = evaluate(s);
  assert.equal(main.comparisons.length, 4);
  const noPurpose = evaluate(s, { ablation: 'no-purpose' });
  assert.equal(noPurpose.metrics.accepted, 0);
  assert.equal(noPurpose.comparedWithMain.retainedRecordsLost, 1);
  const noTarget = evaluate(s, { ablation: 'no-target' });
  assert.equal(noTarget.selectedAction, 'ask-unrelated-preference');
  assert.equal(main.selectedAction, 'review-original');
  assert.equal(noTarget.actions.find(a => a.id === 'ask-unrelated-preference').expectedResolution.max, 0);
  const prediction = evaluate(s, { ablation: 'predicted-response' });
  assert.equal(prediction.cells.find(c => c.id === 'e0:object').evidenceSource, 'prediction-not-observation');
  assert.equal(prediction.comparedWithMain.promotedWithoutMainSupport, 2);
  assert.equal(find(s, 'e0:object').status, 'held');
  assert.equal(s.responses.length, 0); assert.deepEqual(s, snapshot);
});

test('no-epoch ablation visibly misattributes actual assisted response while main keeps the boundary', () => {
  const s = assistedResponse(session());
  const main = evaluate(s); const unsafe = evaluate(s, { ablation: 'no-epoch' });
  assert.equal(main.cells.find(c => c.id === 'e0:object').status, 'held');
  assert.equal(unsafe.cells.find(c => c.id === 'e0:object').status, 'accepted');
  assert.equal(unsafe.cells.find(c => c.id === 'e0:object').evidenceEpoch, 'e1');
  assert.ok(unsafe.comparedWithMain.promotedWithoutMainSupport >= 2);
  assert.equal(find(s, 'e1:earlier-proof').status, 'excluded');
});

test('changing purpose changes targets, not the truth or event history of individual cells', () => {
  const s = session();
  const next = event(s, 'purpose-set', { purpose: 'asr-data' });
  assert.deepEqual(evaluate(next).cells, evaluate(s).cells);
  assert.deepEqual(evaluate(next).actions[0].targets, ['e0:asr']);
  assert.deepEqual(evaluate(s).actions[0].targets, ['e0:object']);
});

test('available examples are independently serializable and invalid events fail explicitly', () => {
  for (const example of examples) {
    const s = session({ exampleId: example.id });
    assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
    assert.equal(evaluate(s).cells.length, 3);
  }
  assert.throws(() => event(session(), 'transcripts-set', { source: 'fixture', alternatives: [] }), /source/);
  assert.throws(() => event(session(), 'review-response', { responseId: 'missing', text: TARGET, confirmed: true }), /responseId/);
  assert.throws(() => evaluate(session(), { ablation: 'made-up' }), /비교/);
});

test('unrecognized unknown scope remains broad and cannot silently disable the unknown', () => {
  const s = event(recorded(), 'unknown-set', { enabled: true, scope: ['unmapped-cause'] });
  assert.deepEqual(s.unknown.scope, ['all']);
  assert.equal(evaluate(s).metrics.accepted, 0);
});

test('a changed task cannot inherit the controlled sentence semantic eligibility', () => {
  let s = event(recorded(), 'task-confirmed', { prompt: '친구가 혼자 카페에 간 일을 말해 주세요.', roleConfirmed: true, pastIndependent: true });
  s = event(s, 'task-confirmed', { roleConfirmed: true, pastIndependent: true });
  assert.equal(find(s, 'e0:object').reasonCode, 'unsupported-task');
  assert.equal(find(s, 'e0:past').status, 'held');
  assert.equal(find(s, 'e0:asr').status, 'accepted');
});

test('reattaching the same original audio does not move its capture after later help', () => {
  let s = recorded(); const capturedAt = s.original.at;
  s = event(s, 'help-presented', { text: TARGET });
  s = event(s, 'audio-attached', { audioRef: 'local:original.webm' });
  assert.equal(s.original.at, capturedAt);
  assert.equal(find(s, 'e0:object').status, 'accepted');
});

test('ASR accepts unrelated reviewed speech without semantic task eligibility', () => {
  const s = recorded('오늘은 집에서 쉬었어요', { roleConfirmed: false, pastIndependent: false, exposureScopeConfirmed: false });
  assert.equal(find(s, 'e0:asr').status, 'accepted');
  assert.equal(find(s, 'e0:asr').value, '오늘은 집에서 쉬었어요');
  assert.equal(find(s, 'e0:object').status, 'held');
  assert.equal(find(s, 'e0:past').status, 'held');
});

test('semantic and exposure unknowns do not contaminate confirmed ASR text', () => {
  for (const kind of ['semantic', 'exposure']) {
    const s = event(recorded(), 'unknown-set', { enabled: true, kind, scope: ['all'], reason: '의미 또는 도움 범위 불명' });
    assert.equal(find(s, 'e0:asr').status, 'accepted');
    assert.equal(find(s, 'e0:object').status, 'held');
    assert.equal(find(s, 'e0:past').status, 'held');
  }
  const uncertainWords = event(recorded(), 'unknown-set', { enabled: true, kind: 'transcription', scope: ['all'] });
  assert.equal(find(uncertainWords, 'e0:asr').status, 'held');
});

test('unintelligibility markers are not accepted as arbitrary confirmed ASR sentences', () => {
  for (const marker of ['[불명]', '[청취 불명]', '[inaudible]', 'UNKNOWN', '???']) {
    assert.equal(find(recorded(marker), 'e0:asr').reasonCode, 'unknown-transcript');
  }
});

test('target ablation shares every candidate and cost, changing only the target filter', () => {
  const s = session(); const main = evaluate(s); const comparison = evaluate(s, { ablation: 'no-target' });
  assert.deepEqual(main.candidateSet, comparison.candidateSet);
  assert.deepEqual(main.flags, { separatePurposes: true, respectEpoch: true, targetEffects: true, requireActual: true });
  assert.deepEqual(comparison.flags, { ...main.flags, targetEffects: false });
  assert.equal(main.actions.find(a => a.id === 'ask-unrelated-preference').selectable, false);
  assert.equal(comparison.actions.find(a => a.id === 'ask-unrelated-preference').selectable, true);
  assert.equal(comparison.selectedAction, 'ask-unrelated-preference');
  const sorted = comparison.actions.filter(a => a.selectable).sort((a, b) => a.cost.seconds - b.cost.seconds);
  assert.equal(sorted[0].id, comparison.selectedAction);
  assert.equal(sorted[0].cost.basis, 'controlled-assumption-not-measured');
});

test('conditional hearing branches remain visibly hypothetical until actual review', () => {
  const s = session(); const main = evaluate(s);
  assert.equal(main.conditionalEvidence.actual, false);
  assert.equal(main.conditionalEvidence.usedForJudgment, false);
  const p = evaluate(s, { ablation: 'predicted-response' });
  assert.equal(p.conditionalEvidence.usedForJudgment, true);
  assert.equal(p.flags.requireActual, false);
  assert.equal(p.cells.find(c => c.id === 'e0:asr').value, main.conditionalEvidence.text);
  assert.equal(find(s, 'e0:asr').status, 'held');
  assert.equal(s.eventLog.length, 0);
  assert.equal(main.version, VERSION);
});

test('unsupported task conditions produce no misleading original-hearing selection', () => {
  const s = recorded('오늘은 집에서 쉬었어요');
  const result = evaluate(s);
  assert.equal(result.selectedAction, null);
  assert.equal(result.actions.find(a => a.id === 'review-original').allowed, false);
});

test('file upload time is not performance time; verified ASR remains usable', () => {
  const s = reviewedFile();
  assert.equal(s.original.audio.recordedAt, null);
  assert.equal(s.original.audio.attachedAt, s.original.at);
  assert.equal(s.original.performanceTimeConfirmed, false);
  assert.equal(s.original.performanceTimeSource, 'unknown');
  assert.equal(find(s, 'e0:asr').status, 'accepted');
  assert.equal(find(s, 'e0:object').reasonCode, 'performance-time-unconfirmed');
  assert.equal(find(s, 'e0:past').status, 'held');
  assert.equal(find(s, 'e0:object').observedAt, null);
});

test('file response needs explicit performance occurrence confirmation after help', () => {
  let s = event(session(), 'help-presented', { text: TARGET });
  s = event(s, 'audio-attached', { role: 'response', responseId: 'file-response', acquisition: 'file', audioRef: 'local:response-file.wav' });
  s = event(s, 'review-response', { responseId: 'file-response', text: TARGET, confirmed: true, exposureScopeConfirmed: true });
  assert.equal(find(s, 'e1:asr').status, 'accepted');
  assert.equal(find(s, 'e1:object').reasonCode, 'performance-time-unconfirmed');
  s = event(s, 'review-response', { responseId: 'file-response', text: TARGET, confirmed: true, performanceTimeConfirmed: true });
  assert.equal(find(s, 'e1:object').status, 'accepted');
  assert.equal(find(s, 'e1:object').assistance, 'after-help');
  assert.equal(s.responses[0].performanceTimeSource, 'human-review');
  assert.equal(s.responses[0].performanceInterval, null);
  assert.equal(s.responses[0].audio.recordedAt, null);
  assert.equal(find(s, 'e0:object').status, 'held');
  assert.equal(find(s, 'e1:earlier-proof').status, 'excluded');
});

test('human original-order confirmation does not fabricate a capture date', () => {
  let s = reviewedFile();
  s = event(s, 'help-presented', { text: TARGET });
  s = event(s, 'review-original', { text: TARGET, confirmed: true, performanceTimeConfirmed: true });
  assert.equal(find(s, 'e0:object').status, 'accepted');
  assert.equal(s.original.performanceRelation, 'before-recorded-help');
  assert.equal(s.original.performanceInterval, null);
  assert.equal(s.original.audio.recordedAt, null);
  assert.equal(s.original.performanceTimeSource, 'human-review');
});

test('valid browser capture provides a bounded interval independently of upload time', () => {
  const s = recorded();
  assert.equal(s.original.performanceTimeConfirmed, true);
  assert.equal(s.original.performanceTimeSource, 'browser-recorder');
  assert.ok(Date.parse(s.original.performanceInterval.endedAt) < Date.parse(s.original.audio.attachedAt));
  assert.equal(s.original.audio.recordedAt, s.original.performanceInterval.startedAt);
  assert.equal(find(s, 'e0:object').observedAt, s.original.performanceInterval.startedAt);
});

test('invalid, reversed and future browser capture metadata never grant performance timing', () => {
  for (const shape of ['invalid', 'reversed', 'future']) {
    let s = session({ mode: 'recording' });
    const received = Date.parse(START) + (n + 1) * 1000;
    const start = shape === 'invalid' ? 'not-a-date' : new Date(received - 500).toISOString();
    const end = new Date(shape === 'future' ? received + 1000 : shape === 'reversed' ? received - 700 : received - 100).toISOString();
    s = event(s, 'audio-attached', { acquisition: 'microphone', audioRef: `local:${shape}.wav`,
      at: new Date(received).toISOString(), captureStartedAt: start, captureEndedAt: end });
    s = event(s, 'task-confirmed', { roleConfirmed: true, pastIndependent: true, exposureScopeConfirmed: true });
    s = event(s, 'review-original', { text: TARGET, confirmed: true });
    assert.equal(s.original.performanceTimeConfirmed, false, shape);
    assert.equal(s.original.audio.recordedAt, null, shape);
    assert.equal(find(s, 'e0:object').reasonCode, 'performance-time-unconfirmed', shape);
    assert.equal(find(s, 'e0:asr').status, 'accepted', shape);
  }
});

test('help overlapping a capture interval holds affected performance but not ASR', () => {
  let s = session({ mode: 'recording' });
  s = event(s, 'help-presented', { text: TARGET, at: '2026-09-11T00:00:10Z' });
  s = event(s, 'audio-attached', { audioRef: 'local:overlap.wav', acquisition: 'microphone',
    captureStartedAt: '2026-09-11T00:00:09Z', captureEndedAt: '2026-09-11T00:00:11Z', at: '2026-09-11T00:00:12Z' });
  s = event(s, 'task-confirmed', { roleConfirmed: true, pastIndependent: true, exposureScopeConfirmed: true });
  s = event(s, 'review-original', { text: TARGET, confirmed: true });
  assert.equal(find(s, 'e0:object').reasonCode, 'help-overlaps-capture');
  assert.equal(find(s, 'e0:past').status, 'held');
  assert.equal(find(s, 'e0:asr').status, 'accepted');
});

test('help after capture but before upload does not contaminate original timing', () => {
  let s = session({ mode: 'recording' });
  s = event(s, 'help-presented', { text: TARGET, at: '2026-09-11T00:00:20Z' });
  s = event(s, 'audio-attached', { audioRef: 'local:before-help.wav', acquisition: 'microphone',
    captureStartedAt: '2026-09-11T00:00:09Z', captureEndedAt: '2026-09-11T00:00:11Z', at: '2026-09-11T00:00:22Z' });
  s = event(s, 'task-confirmed', { roleConfirmed: true, pastIndependent: true, exposureScopeConfirmed: true });
  s = event(s, 'review-original', { text: TARGET, confirmed: true });
  assert.equal(find(s, 'e0:object').status, 'accepted');
  assert.equal(find(s, 'e0:object').assistance, 'no-recorded-help');
});

test('late help outside a prior human file-order confirmation reopens only affected performance', () => {
  let s = reviewedFile();
  s = event(s, 'review-original', { text: TARGET, confirmed: true, performanceTimeConfirmed: true, at: '2026-09-11T02:00:00Z' });
  s = event(s, 'help-presented', { text: '친구를', skills: ['object'], at: '2026-09-11T00:00:01Z' });
  assert.equal(find(s, 'e0:object').reasonCode, 'help-time-order-unknown');
  assert.equal(find(s, 'e0:past').status, 'accepted');
  assert.equal(find(s, 'e0:asr').status, 'accepted');
});

test('file capture metadata is not silently promoted to browser-recorded timing', () => {
  let s = session({ mode: 'recording' });
  s = event(s, 'audio-attached', { audioRef: 'local:old-file.wav', acquisition: 'file',
    recordedAt: START, captureStartedAt: START, captureEndedAt: START });
  assert.equal(s.original.performanceTimeConfirmed, false);
  assert.equal(s.original.audio.recordedAt, null);
});
