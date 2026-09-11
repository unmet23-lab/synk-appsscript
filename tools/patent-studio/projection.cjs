'use strict';

const crypto = require('node:crypto');
const canonical = v => v === undefined ? 'null' : v === null || typeof v !== 'object' ? JSON.stringify(v) :
  Array.isArray(v) ? '[' + v.map(canonical).join(',') + ']' :
  '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
const digest = value => crypto.createHash('sha256').update(canonical(value)).digest('hex');

// The cache is scoped by the actual engine source fingerprint supplied by the
// store, not only a manually maintained version. A cache hit requires identical
// declared inputs AND an intact result. Unknown/corrupt entries are recomputed.
function createResolver(previous, engineKey, { forceFull = false } = {}) {
  const usable = !forceFull && previous?.schemaVersion === 1 && previous.engineKey === engineKey && Array.isArray(previous.entries);
  const old = new Map(usable ? previous.entries.filter(e => e && typeof e.key === 'string' && e.result && typeof e.result === 'object').map(e => [e.key, e]) : []);
  const current = new Map();
  const metrics = { requestedCells: 0, evaluatedCells: 0, reusedPreviousCells: 0, reusedWithinRunCells: 0,
    inputFingerprintComparisons: 0, dependencyFieldsCompared: 0, dependencyFieldsHashed: 0, invalidated: [], reusedCellKeys: [] };
  return {
    resolve(key, inputs, compute) {
      metrics.requestedCells++;
      // First compare one whole-input fingerprint. Only changed/new inputs
      // need per-dependency hashes for the explanatory invalidation record.
      // This avoids hashing every unchanged dependency repeatedly.
      const inputSha256 = digest(inputs);
      const sameRun = current.get(key);
      if (sameRun && sameRun.inputSha256 === inputSha256) {
        metrics.reusedWithinRunCells++;
        return structuredClone(sameRun.result);
      }
      const before = old.get(key);
      metrics.inputFingerprintComparisons++;
      const valid = before && before.inputSha256 === inputSha256 && before.resultSha256 === digest(before.result);
      const inputFingerprints = valid ? before.inputFingerprints : Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, digest(v)]));
      const changedInputs = valid ? [] : before ? Object.keys(inputFingerprints).filter(k => before.inputFingerprints?.[k] !== inputFingerprints[k]) : Object.keys(inputFingerprints);
      if (!valid) {
        metrics.dependencyFieldsHashed += Object.keys(inputFingerprints).length;
        if (before) metrics.dependencyFieldsCompared += Object.keys(inputFingerprints).length;
      }
      const result = valid ? structuredClone(before.result) : compute();
      if (valid) { metrics.reusedPreviousCells++; metrics.reusedCellKeys.push(key); }
      else {
        metrics.evaluatedCells++;
        metrics.invalidated.push({ key, changedInputs, reason: before ? changedInputs.length ? 'changed-input' : 'invalid-cache-result' : 'new-or-unavailable-cache' });
      }
      current.set(key, { key, inputFingerprints, inputSha256, resultSha256: digest(result), result: structuredClone(result) });
      return result;
    },
    finish() {
      return { projectionCache: { schemaVersion: 1, engineKey, entries: [...current.values()] },
        computation: { ...metrics, strategy: usable ? 'dependency-fingerprint-reuse' : 'full-projection',
          scope: '효과 판정 함수의 실제 실행 수. 입력 지문·관측 계획·저장 처리는 전체 셀을 순회하므로 전체 실행 시간이 O(영향 셀 수)라는 뜻은 아닙니다.' } };
    }
  };
}

function effectSnapshot(cell) {
  if (!cell) return null;
  return { cellId: cell.id, purpose: cell.purpose, skill: cell.skill, epoch: cell.epoch,
    evidenceEpoch: cell.evidenceEpoch, utteranceId: cell.utteranceId, status: cell.status, value: cell.value,
    effectSet: cell.effectSet, reasonCode: cell.reasonCode, reason: cell.reason, dependencies: cell.dependencies,
    evidenceSource: cell.evidenceSource, assistance: cell.assistance, observedAt: cell.observedAt,
    sourceAudioRef: cell.sourceAudioRef, receivedAt: cell.receivedAt,
    supportScope: cell.supportScope, synthetic: cell.synthetic,
    performanceTimeSource: cell.performanceTimeSource, witness: cell.witness || null };
}
function actionFor(before, after) {
  if (!before) return after.status === 'accepted' ? 'added' : after.status === 'held' ? 'held' : 'excluded';
  if (before.status === 'accepted' && after?.status !== 'accepted') return 'withdrawn';
  if (after?.status === 'accepted' && before.status !== 'accepted') return 'added';
  if (before.status === 'accepted' && after?.status === 'accepted') return canonical(before.value) === canonical(after.value) ? 'retained' : 'replaced';
  if (!after) return 'removed';
  return after.status === 'held' ? 'held' : 'excluded';
}
function buildLedgerEntry({ beforeCells = [], afterCells, event, fromRevision, toRevision, previousSha256 = null, baselineState = null, engineKey }) {
  const before = new Map(beforeCells.map(c => [c.id, effectSnapshot(c)]));
  const after = new Map(afterCells.map(c => [c.id, effectSnapshot(c)]));
  const transitions = [...new Set([...before.keys(), ...after.keys()])].map(cellId => {
    const a = before.get(cellId) || null, b = after.get(cellId) || null;
    const action = actionFor(a, b);
    return { cellId, action, changed: canonical(a) !== canonical(b), before: a, after: b,
      withdrawnEffect: a?.status === 'accepted' && ['withdrawn', 'replaced'].includes(action) ? a.value : null,
      admittedEffect: b?.status === 'accepted' && ['added', 'replaced'].includes(action) ? b.value : null };
  });
  const payload = { schemaVersion: 1, engineKey, fromRevision, toRevision,
    cause: event ? { eventId: event.id, type: event.type, at: event.at, eventSha256: digest(event) } :
      { eventId: null, type: 'baseline', at: baselineState.createdAt, eventSha256: null },
    previousSha256, transitions,
    summary: Object.fromEntries(['added', 'retained', 'withdrawn', 'replaced', 'held', 'excluded', 'removed'].map(k => [k, transitions.filter(t => t.action === k).length])),
    cellsSha256: digest(afterCells), ...(baselineState ? { baselineState } : {}) };
  return { ...payload, sha256: digest(payload) };
}

function verifyLedger({ entries, events, finalState, finalCells, engineKey }, core) {
  const failures = [];
  if (!entries.length || !entries[0].baselineState) return { valid: false, failures: ['baseline-missing'], checkedRevisions: 0 };
  let state = structuredClone(entries[0].baselineState), previous = null;
  const byRevision = new Map(events.map(e => [e.revision, e]));
  let beforeCells = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (engineKey && entry.engineKey !== engineKey) failures.push(`engine-source-mismatch:${entry.toRevision}`);
    const { sha256, ...payload } = entry;
    if (digest(payload) !== sha256 || entry.previousSha256 !== previous) failures.push(`chain:${entry.toRevision}`);
    let event = null;
    if (i > 0) {
      const saved = byRevision.get(entry.toRevision);
      if (!saved) { failures.push(`event-missing:${entry.toRevision}`); break; }
      const { revision, recordedAt, ...raw } = saved;
      event = saved.event || raw;
      if (digest(event) !== entry.cause.eventSha256) failures.push(`event-digest:${entry.toRevision}`);
      state = core.applyEvent(state, event);
    }
    const cells = core.evaluate(state, { forceFull: true }).cells;
    if (digest(cells) !== entry.cellsSha256) failures.push(`projection:${entry.toRevision}`);
    const expected = buildLedgerEntry({ beforeCells, afterCells: cells, event,
      fromRevision: i ? state.revision - 1 : null, toRevision: state.revision,
      previousSha256: previous, baselineState: i ? null : state, engineKey: entry.engineKey });
    if (canonical(expected) !== canonical(entry)) failures.push(`ledger-record:${entry.toRevision}`);
    beforeCells = cells; previous = sha256;
  }
  if (digest(state) !== digest(finalState)) failures.push('final-state');
  if (digest(beforeCells) !== digest(finalCells)) failures.push('final-cells');
  return { valid: failures.length === 0, failures, checkedRevisions: entries.length,
    startsAtRevision: entries[0].toRevision, throughRevision: state.revision,
    scope: '저장된 사건으로 판정을 재현하고 내용 지문 연쇄를 확인합니다. 외부 신뢰 시각·서명 또는 기록되지 않은 사건의 존재까지 증명하지 않습니다.' };
}
module.exports = { canonical, digest, createResolver, buildLedgerEntry, verifyLedger, effectSnapshot };
