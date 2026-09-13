'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { compileObservationContracts: compile, applyObservationReceipt: apply } = require('./observation-contract.cjs');
const { fixture, receipt, cells, TARGET, ALT, PRESENT, AT } = require('./fixtures.cjs');
const { applyEvent } = require('../../core.cjs');
const setup = options => { const f = fixture(options); return { ...f, contract: compile(f.state, { alignments: f.alignments }).contracts[0] }; };
const status = (state, id) => cells(state).find(cell => cell.id === id).status;
function unchangedFailure(f, value, reason) {
  const snapshot = structuredClone(f.state);
  const result = apply(f.state, f.contract, value);
  assert.equal(result.ok, false);
  if (reason) assert.equal(result.reason, reason);
  assert.deepEqual(result.state, snapshot);
  assert.deepEqual(f.state, snapshot);
}
test('planning is pure; uncertainty targets exclude already valid past tense', () => {
  const f = fixture(), snapshot = structuredClone(f.state);
  const result = compile(f.state, { alignments: f.alignments });
  assert.deepEqual(f.state, snapshot);
  assert.equal(result.contracts.length, 1);
  assert.deepEqual(result.contracts[0].targetIds, ['e0:asr', 'e0:object']);
  assert.equal(status(f.state, 'e0:past'), 'accepted');
  assert.deepEqual(result.contracts[0].range, { startMs: 0, endMs: 550, basis: 'supplied-candidate-difference-enclosing-range' });
});
test('valid source review refines ASR and object while preserving audio and past record', () => {
  const f = setup(), snapshot = structuredClone(f.state), beforePast = cells(f.state).find(c => c.id === 'e0:past');
  const result = apply(f.state, f.contract, receipt(f.contract));
  assert.equal(result.ok, true);
  assert.equal(status(result.state, 'e0:asr'), 'accepted');
  assert.equal(status(result.state, 'e0:object'), 'accepted');
  assert.deepEqual(cells(result.state).find(c => c.id === 'e0:past'), beforePast);
  assert.deepEqual(result.state.original.audio, snapshot.original.audio);
  assert.deepEqual(f.state, snapshot);
});
test('same waveform bytes assigned to a new attempt cannot refine the old attempt', () => {
  const f = setup(); unchangedFailure(f, receipt(f.contract, { source: { ...f.contract.source, utteranceId: 'response-1', epoch: 'e1' } }), 'source-or-attempt-mismatch');
});
test('different waveform cannot refine original even with the same utterance and attempt', () => {
  const f = setup(); unchangedFailure(f, receipt(f.contract, { source: { ...f.contract.source, audioRef: 'other-audio' } }), 'source-or-attempt-mismatch');
});
test('a new answer or current-intent confirmation is not a source-audio review', () => {
  for (const kind of ['new-response', 'current-intent-confirmation']) { const f = setup(); unchangedFailure(f, receipt(f.contract, { kind }), 'result-kind-ineligible'); }
});
test('partial listening metadata cannot cover a larger required span', () => {
  const f = setup(); unchangedFailure(f, receipt(f.contract, { range: { startMs: 50, endMs: 500 } }), 'review-range-insufficient');
});
test('valid full-audio coverage can satisfy a narrower requested range', () => {
  const f = setup(); assert.equal(apply(f.state, f.contract, receipt(f.contract, { range: { startMs: 0, endMs: 3000 } })).ok, true);
});
test('unconfirmed, empty, duplicate and out-of-set results do not promote data', () => {
  for (const change of [{ confirmed: false }, { remainingCandidateTexts: [] }, { remainingCandidateTexts: [TARGET, TARGET] }, { remainingCandidateTexts: [PRESENT] }]) {
    const f = setup(); unchangedFailure(f, receipt(f.contract, change));
  }
});
test('contract field mutation is rejected', () => {
  const f = setup(), value = receipt(f.contract); f.contract.range.endMs = 500; unchangedFailure(f, value, 'contract-integrity-mismatch');
});
test('new event after planning invalidates the original plan', () => {
  const f = setup(); f.state = applyEvent(f.state, { id: 'new-task-event', type: 'task-confirmed', at: AT, roleConfirmed: true });
  unchangedFailure(f, receipt(f.contract), 'stale-revision');
});
test('same revision with changed evidence is also rejected', () => {
  const f = setup(); f.state.task.roleConfirmed = false; unchangedFailure(f, receipt(f.contract), 'evidence-fingerprint-mismatch');
});
test('all supplied candidate differences are covered, including a third candidate at the end', () => {
  const f = setup({ texts: [TARGET, ALT, PRESENT] });
  assert.equal(f.contract.range.endMs, 2350);
  assert.equal(f.contract.rangeEvidence.comparisonPairs.length, 3);
  unchangedFailure(f, receipt(f.contract, { range: { startMs: 0, endMs: 550 } }), 'review-range-insufficient');
});
test('missing alignment uses full audio, rather than claiming a narrow span', () => {
  const f = fixture(), result = compile(f.state); assert.equal(result.contracts[0].range.endMs, 3000);
  assert.equal(result.contracts[0].range.basis, 'whole-source-audio-fallback');
});
test('malformed, duplicate, out-of-source and missing provenance alignments fall back', () => {
  for (const mutate of [a => { a[0].words[0].endMs = 9000; }, a => a.push(structuredClone(a[0])), a => { a[0].audioRef = 'wrong'; }, a => { delete a[0].sourceRef; }]) {
    const f = fixture(); mutate(f.alignments);
    assert.equal(compile(f.state, { alignments: f.alignments }).contracts[0].range.basis, 'whole-source-audio-fallback');
  }
});
test('insertions or ambiguous edit alignment require whole-source review', () => {
  const f = setup({ texts: [TARGET, '저는 친구를 만나서 카페에 갔어요'] });
  assert.equal(f.contract.range.basis, 'whole-source-audio-fallback');
});
test('no audio or no duration produces unresolved reason and no executable contract', () => {
  for (const mutate of [s => { s.original.audio = null; }, s => { s.original.audio.durationMs = null; }]) {
    const f = fixture(); mutate(f.state); const result = compile(f.state, { alignments: f.alignments });
    assert.equal(result.contracts.length, 0); assert.ok(result.unresolved.length > 0);
  }
});
test('review receipt may retain ambiguity rather than forcing a single answer', () => {
  const f = setup(), result = apply(f.state, f.contract, receipt(f.contract, { remainingCandidateTexts: [TARGET, ALT] }));
  assert.equal(result.ok, true); assert.equal(status(result.state, 'e0:asr'), 'held'); assert.equal(status(result.state, 'e0:object'), 'held');
});
test('audio review cannot clear independent task, coverage, or unknown blockers', () => {
  for (const mutate of [s => { s.task.roleConfirmed = false; }, s => { s.original.scopeConfirmed = false; }, s => { s.unknown = { enabled: true, kind: 'all', reason: 'fixture-unknown', scope: ['all'] }; }]) {
    const f = fixture(); mutate(f.state); f.contract = compile(f.state, { alignments: f.alignments }).contracts[0];
    const result = apply(f.state, f.contract, receipt(f.contract)); assert.equal(result.ok, true);
    assert.notEqual(status(result.state, 'e0:object'), 'accepted');
  }
});
test('known preceding object hint stays disqualifying while source transcript becomes usable', () => {
  const f = fixture(); f.state = applyEvent(f.state, { id: 'known-object-hint', type: 'help-presented', at: '2026-09-13T08:59:00.000Z', text: '목적격 조사는 를', skills: ['object'], exposesAnswer: true });
  f.contract = compile(f.state, { alignments: f.alignments }).contracts[0];
  const before = status(f.state, 'e0:object'), result = apply(f.state, f.contract, receipt(f.contract));
  assert.equal(result.ok, true); assert.equal(status(result.state, 'e0:asr'), 'accepted');
  assert.equal(status(result.state, 'e0:object'), before); assert.notEqual(before, 'accepted');
  assert.equal(status(result.state, 'e0:past'), 'accepted');
});
test('identical receipt replay is idempotent; event-id reuse with changed data fails', () => {
  const f = setup(), value = receipt(f.contract), first = apply(f.state, f.contract, value);
  const second = apply(first.state, f.contract, value); assert.equal(second.ok, true); assert.equal(second.reason, 'idempotent-replay');
  assert.deepEqual(second.state, first.state);
  assert.equal(apply(first.state, f.contract, { ...value, remainingCandidateTexts: [ALT] }).reason, 'event-id-conflict');
});
test('the stored result event replays through Core to the same evaluated records', () => {
  const f = setup(), first = apply(f.state, f.contract, receipt(f.contract));
  const replayed = applyEvent(f.state, first.record.event); assert.deepEqual(cells(replayed), cells(first.state));
  assert.deepEqual(replayed.original, first.state.original);
});
test('same VERSION with different code content is rejected even with a valid data seal', () => {
  const crypto = require('node:crypto');
  const canonical = value => value === null || typeof value !== 'object' ? JSON.stringify(value) : Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  const digest = value => crypto.createHash('sha256').update(canonical(value)).digest('hex');
  const f = setup();
  const { integrity, id, ...body } = f.contract;
  body.engineIdentity.modules[0].sha256 = '0'.repeat(64);
  const { fingerprint, ...identityBody } = body.engineIdentity;
  body.engineIdentity.fingerprint = digest(identityBody);
  const data = { ...body, id: 'observation:' + digest(body).slice(0, 32) };
  f.contract = { ...data, integrity: { algorithm: 'sha256', digest: digest(data) } };
  unchangedFailure(f, receipt(f.contract), 'engine-identity-mismatch');
});
