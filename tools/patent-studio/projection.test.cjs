'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const core = require('./core.cjs');
const { StudioStore } = require('./store.cjs');
const { verifyExport } = require('./projection-replay.cjs');
const { digest } = require('./projection.cjs');
const START = '2026-09-11T00:00:00.000Z';
const clean = result => { const { projectionCache, computation, ...semantic } = result; return semantic; };
const apply = (s, type, data = {}) => core.applyEvent(s, { id: `event-${s.revision + 1}`, type,
  at: new Date(Date.parse(START) + (s.revision + 1) * 1000).toISOString(), ...data });
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'synk-projection-'));

test('purpose-only change reuses every judgment while rebuilding the observation plan', () => {
  const state = core.createSession({ id: 'purpose', createdAt: START });
  const first = core.evaluate(state);
  const next = apply(state, 'purpose-set', { purpose: 'asr-data' });
  const result = core.evaluate(next, { previousProjection: first.projectionCache });
  assert.equal(result.computation.evaluatedCells, 0);
  assert.ok(result.computation.reusedPreviousCells > 0);
  assert.deepEqual(result.cells, first.cells);
  assert.notDeepEqual(result.actions[0].targets, first.actions[0].targets);
  assert.deepEqual(clean(result), clean(core.evaluate(next, { forceFull: true })));
});

test('a semantic UNKNOWN invalidates role effects but keeps reviewed ASR and independent past', () => {
  let state = core.createSession({ id: 'locality', createdAt: START });
  state = apply(state, 'review-original', { text: core.TARGET, confirmed: true });
  const first = core.evaluate(state);
  const next = apply(state, 'unknown-set', { enabled: true, kind: 'semantic', scope: ['object'], reason: '역할 조건 재확인' });
  const result = core.evaluate(next, { previousProjection: first.projectionCache });
  assert.equal(result.cells.find(c => c.skill === 'object').status, 'held');
  assert.equal(result.cells.find(c => c.skill === 'asr').status, 'accepted');
  assert.equal(result.cells.find(c => c.skill === 'past').status, 'accepted');
  assert.ok(result.computation.invalidated.every(c => c.key.endsWith(':object')));
  assert.ok(result.computation.invalidated.every(c => c.changedInputs.includes('unknown')));
  assert.deepEqual(clean(result), clean(core.evaluate(next, { forceFull: true })));
});

test('late recognizer alternatives cannot invalidate already human-reviewed cells', () => {
  let state = core.createSession({ id: 'late-machine', createdAt: START });
  state = apply(state, 'review-original', { text: core.TARGET, confirmed: true });
  const first = core.evaluate(state);
  const next = apply(state, 'transcripts-set', { source: 'machine', alternatives: ['전혀 다른 말'] });
  const result = core.evaluate(next, { previousProjection: first.projectionCache });
  assert.equal(result.computation.evaluatedCells, 0);
  assert.deepEqual(clean(result), clean(core.evaluate(next, { forceFull: true })));
});

test('cache corruption and a different engine fingerprint cause safe recomputation', () => {
  const state = core.createSession({ id: 'cache', createdAt: START });
  const first = core.evaluate(state, { engineKey: 'engine-one' });
  const cache = structuredClone(first.projectionCache);
  cache.entries[0].result.status = 'accepted';
  const repaired = core.evaluate(state, { previousProjection: cache, engineKey: 'engine-one' });
  assert.equal(repaired.computation.evaluatedCells, 1);
  assert.deepEqual(clean(repaired), clean(first));
  const invalidated = core.evaluate(state, { previousProjection: cache, engineKey: 'engine-two' });
  assert.equal(invalidated.computation.reusedPreviousCells, 0);
  assert.deepEqual(clean(invalidated), clean(first));
  const malformed = core.evaluate(state, { previousProjection: { schemaVersion: 1, engineKey: 'engine-one' }, engineKey: 'engine-one' });
  assert.equal(malformed.computation.reusedPreviousCells, 0);
  assert.deepEqual(clean(malformed), clean(first));
});

function rng(seed) { let x = seed >>> 0; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; }; }
function randomEvent(state, random) {
  const pick = values => values[Math.floor(random() * values.length)];
  const response = pick(state.responses);
  const type = Math.floor(random() * 10);
  const phrase = pick([core.TARGET, '친구가 만나서 카페에 갔어요', '친구를 만나서 카페에 가요', '오늘은 집에서 쉬었어요', '[불명]', '']);
  if (type === 0) return ['purpose-set', { purpose: pick(['asr-data', 'original-performance']) }];
  if (type === 1) return ['unknown-set', { enabled: random() > .3, kind: pick(['all', 'semantic', 'exposure', 'transcription']), scope: [pick(['all', 'asr', 'object', 'past'])], reason: `scope-${Math.floor(random() * 3)}` }];
  if (type === 2) return ['task-confirmed', { roleConfirmed: random() > .3, pastIndependent: random() > .3, exposureScopeConfirmed: random() > .3 }];
  if (type === 3) return ['help-presented', { text: '친구를', skills: [pick(['object', 'past', 'all'])], exposesAnswer: random() > .2,
    at: new Date(Date.parse(START) + Math.floor(random() * (state.revision + 1)) * 1000).toISOString() }];
  if (type === 4 && state.responses.length < 8) return ['response-added', { responseId: `r-${state.revision}`, text: phrase, confirmed: random() > .3, scopeConfirmed: true }];
  if (type === 5) return ['transcripts-set', { ...(response && random() > .5 ? { role: 'response', responseId: response.id } : {}), source: 'machine', alternatives: [phrase || core.TARGET] }];
  if (type === 6 && response) return ['audio-attached', { role: 'response', responseId: response.id, audioRef: `local:${state.revision}.wav`, acquisition: pick(['file', 'microphone']),
    captureStartedAt: START, captureEndedAt: new Date(Date.parse(START) + state.revision * 1000).toISOString() }];
  if (type === 7) return ['task-confirmed', { prompt: pick([state.task.prompt, '다른 문항']) }];
  return [response && random() > .5 ? 'review-response' : 'review-original', { responseId: response?.id, text: phrase, confirmed: random() > .2,
    scopeConfirmed: random() > .2, performanceTimeConfirmed: random() > .2, exposureScopeConfirmed: random() > .2 }];
}

test('1,280 deterministic random event transitions match full recomputation including all four ablations', () => {
  let transitions = 0, reused = 0;
  for (let seed = 1; seed <= 16; seed++) {
    const random = rng(seed);
    let state = core.createSession({ id: `random-${seed}`, mode: seed % 2 ? 'example' : 'recording', createdAt: START });
    state = apply(state, 'audio-attached', { audioRef: 'local:original.wav', acquisition: 'microphone', captureStartedAt: START, captureEndedAt: START });
    let previous = core.evaluate(state);
    for (let i = 0; i < 80; i++) {
      const [type, data] = randomEvent(state, random);
      state = apply(state, type, data);
      const incremental = core.evaluate(state, { previousProjection: previous.projectionCache });
      const full = core.evaluate(state, { forceFull: true });
      assert.deepEqual(clean(incremental), clean(full), `seed=${seed}, step=${i}, event=${type}`);
      reused += incremental.computation.reusedPreviousCells;
      transitions++;
      previous = incremental;
    }
  }
  assert.equal(transitions, 1280);
  assert.ok(reused > 1000);
});

test('effect ledger preserves ASR/past while withdrawing only an original role effect on late help', () => {
  const store = new StudioStore(temp());
  try {
    let s = store.create({ mode: 'example' });
    s = store.apply(s.id, s.revision, { id: 'heard', type: 'review-original', text: core.TARGET, confirmed: true });
    const beforeRevision = s.revision;
    const event = { id: 'late-help', type: 'help-presented', text: '친구를', skills: ['object'], at: '2000-01-01T00:00:00.000Z' };
    s = store.apply(s.id, s.revision, event);
    const last = s.effectLedger.entries.at(-1);
    assert.equal(last.fromRevision, beforeRevision);
    assert.equal(last.toRevision, beforeRevision + 1);
    assert.equal(last.cause.eventId, 'late-help');
    assert.equal(last.cause.eventSha256, digest(event));
    assert.equal(last.transitions.find(t => t.cellId === 'e0:object').action, 'withdrawn');
    assert.equal(last.transitions.find(t => t.cellId === 'e0:asr').action, 'retained');
    assert.equal(last.transitions.find(t => t.cellId === 'e0:past').action, 'retained');
    assert.equal(last.transitions.find(t => t.cellId === 'e0:object').after.status, 'excluded');
    assert.equal(store.verify(s.id).valid, true);
    const exported = store.export(s.id);
    assert.equal(verifyExport(exported).valid, true);
    const damaged = structuredClone(exported);
    damaged.session.effectLedger.entries[1].transitions[0].after.value = 'invented';
    assert.equal(verifyExport(damaged).valid, false);
    const duplicate = store.apply(s.id, beforeRevision, event);
    assert.equal(duplicate.effectLedger.entries.length, s.effectLedger.entries.length);
  } finally { store.close(); }
});

test('corrected effect is explicit withdrawal plus addition; failed persistence leaves no ledger entry', () => {
  const store = new StudioStore(temp());
  try {
    let s = store.create({ mode: 'example' });
    s = store.apply(s.id, 0, { id: 'heard', type: 'review-original', text: core.TARGET, confirmed: true });
    s = store.apply(s.id, 1, { id: 'corrected', type: 'review-original', text: '친구를 만나서 카페에 가요', confirmed: true });
    const past = s.effectLedger.entries.at(-1).transitions.find(t => t.cellId === 'e0:past');
    assert.equal(past.action, 'replaced');
    assert.equal(past.withdrawnEffect, '과거형 사용 관측');
    assert.equal(past.admittedEffect, '과거 시제 요구 재확인');
    assert.throws(() => store.apply(s.id, 2, { id: 'fail', type: 'purpose-set', purpose: 'asr-data' }, () => { throw new Error('storage failure'); }));
    assert.deepEqual(store.get(s.id), s);
    assert.equal(store.verify(s.id).valid, true);
  } finally { store.close(); }
});

test('a legacy session receives an honest current-revision baseline and replays later events after restart', () => {
  const dir = temp(); let store = new StudioStore(dir);
  let s = store.create({ mode: 'example' });
  s = store.apply(s.id, 0, { id: 'past-event', type: 'purpose-set', purpose: 'asr-data' });
  store.db.prepare('DELETE FROM effect_ledger WHERE session_id=?').run(s.id);
  store.close(); store = new StudioStore(dir);
  try {
    s = store.get(s.id);
    assert.equal(s.effectLedger.legacyBaseline, true);
    assert.equal(s.effectLedger.startsAtRevision, 1);
    assert.equal(s.effectLedger.entries.length, 1);
    s = store.apply(s.id, 1, { id: 'new-event', type: 'review-original', text: core.TARGET, confirmed: true });
    assert.equal(store.verify(s.id).valid, true);
    assert.equal(verifyExport(store.export(s.id)).valid, true);
  } finally { store.close(); }
});

test('forty-response correction reuses unrelated projections and gives the same complete result', () => {
  let state = core.createSession({ id: 'scale', createdAt: START });
  for (let i = 0; i < 40; i++) {
    state = apply(state, 'audio-attached', { role: 'response', responseId: `scale-${i}`, audioRef: `local:${i}.wav` });
    state = apply(state, 'review-response', { responseId: `scale-${i}`, text: core.TARGET, confirmed: true, performanceTimeConfirmed: true, exposureScopeConfirmed: true });
  }
  const previous = core.evaluate(state);
  state = apply(state, 'review-response', { responseId: 'scale-20', text: '친구가 만나서 카페에 갔어요', confirmed: true, performanceTimeConfirmed: true });
  const result = core.evaluate(state, { previousProjection: previous.projectionCache });
  const full = core.evaluate(state, { forceFull: true });
  assert.deepEqual(clean(result), clean(full));
  assert.ok(result.computation.evaluatedCells < full.computation.evaluatedCells / 10);
  assert.ok(result.computation.reusedPreviousCells > 400);
  assert.ok(result.computation.invalidated.every(c => c.key.includes('scale-20')));
});

test('standalone replay verifies exported audio occurrences and detects audio or event alteration', () => {
  const directory = temp(), store = new StudioStore(directory);
  try {
    let state = store.create({ mode: 'recording' });
    const bytes = Buffer.alloc(44); bytes.write('RIFF'); bytes.writeUInt32LE(36, 4); bytes.write('WAVEfmt ', 8);
    bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
    bytes.writeUInt32LE(16000, 24); bytes.writeUInt32LE(32000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36);
    state = store.attach(state.id, 0, { eventId: 'authored-empty-wave', role: 'original', bytes, mimeType: 'audio/wav' });
    const exported = store.export(state.id);
    const filename = path.join(directory, 'authored-export.json');
    fs.writeFileSync(filename, JSON.stringify(exported));
    const report = JSON.parse(execFileSync(process.execPath, [path.join(__dirname, 'projection-replay.cjs'), filename], { encoding: 'utf8' }));
    assert.equal(report.valid, true);
    assert.equal(report.checkedAudioOccurrences, 1);
    const audioChanged = structuredClone(exported);
    audioChanged.files[0].data = Buffer.from('changed bytes').toString('base64');
    assert.ok(verifyExport(audioChanged).failures.some(x => x.startsWith('audio-content:')));
    const eventChanged = structuredClone(exported);
    eventChanged.replay.events[0].event.audioRef = 'local:changed';
    assert.equal(verifyExport(eventChanged).valid, false);
    const engineChanged = structuredClone(exported);
    engineChanged.session.effectLedger.entries[0].engineKey = 'unavailable-engine';
    assert.ok(verifyExport(engineChanged).failures.some(x => x.startsWith('engine-source-mismatch:')));
  } finally { store.close(); }
});
