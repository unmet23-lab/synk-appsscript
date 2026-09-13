'use strict';
// Bounded execution of the three P1 wording examples, using isolated synthetic
// Core API inputs. No microphone, audio file, network, database or production UI.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const core = require('../../core.cjs');
const { buildLedgerEntry } = require('../../projection.cjs');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const files = ['../../core.cjs', '../../temporal-evidence.cjs', '../../projection.cjs', '../../observation-planner.cjs', 'p1-support-cases.cjs'];
const sources = () => Object.fromEntries(files.map(file => [file, sha256(fs.readFileSync(path.resolve(__dirname, file)))]));
const sourceBefore = sources();
const engineKey = sha256(JSON.stringify(Object.entries(sourceBefore).filter(([file]) => file !== 'p1-support-cases.cjs')));
const at = clock => `2026-09-13T${clock}+09:00`;
const initialOptions = { id: 'isolated-synthetic-p1-support', mode: 'recording', createdAt: at('09:58:00.000') };
const preparation = [
  { receivedAt: at('10:00:11.000'), event: { id: 'synthetic-audio', type: 'audio-attached', at: at('10:00:11.000'), payload: {
    audioRef: 'synthetic-logical-audio-A-no-file-read', role: 'original', acquisition: 'microphone',
    captureStartedAt: at('10:00:00.000'), captureEndedAt: at('10:00:10.000'), durationMs: 10000, mimeType: 'audio/wav',
  } } },
  { receivedAt: at('10:00:20.000'), event: { id: 'synthetic-transcript', type: 'transcripts-set', at: at('10:00:20.000'), payload: {
    alternatives: [core.TARGET], source: 'human', confirmed: true, scopeConfirmed: true, exposureScopeConfirmed: true,
  } } },
  { receivedAt: at('10:00:21.000'), event: { id: 'synthetic-conditions', type: 'task-confirmed', at: at('10:00:21.000'), payload: {
    roleConfirmed: true, pastIndependent: true, exposureScopeConfirmed: true,
  } } },
];
const help = { receivedAt: at('10:05:00.000'), event: { id: 'late-pre-capture-object-help', type: 'help-presented', at: at('09:59:30.000'), payload: {
  text: '친구를', skills: ['object'], exposesAnswer: true,
} } };
const scopeUnknown = { receivedAt: at('10:06:00.000'), event: { id: 'mark-exposure-scope-unconfirmed', type: 'task-confirmed', at: at('10:06:00.000'), payload: {
  exposureScopeConfirmed: false,
} } };
const independenceUnknown = { receivedAt: at('10:06:00.000'), event: { id: 'mark-past-independence-unconfirmed', type: 'task-confirmed', at: at('10:06:00.000'), payload: {
  pastIndependent: false,
} } };
const compactCells = cells => cells.map(c => ({
  id: c.id, purpose: c.purpose, skill: c.skill, status: c.status, value: c.value, reasonCode: c.reasonCode,
  assistance: c.assistance, evidenceSource: c.evidenceSource, sourceAudioRef: c.sourceAudioRef,
  blockers: c.blockers.map(b => ({ id: b.id, code: b.code, status: b.status })),
  temporalEvidence: c.temporalEvidence,
}));
const compactTransitions = entry => entry.transitions.map(t => ({
  cellId: t.cellId, action: t.action, changed: t.changed,
  before: { status: t.before.status, value: t.before.value, reasonCode: t.before.reasonCode },
  after: { status: t.after.status, value: t.after.value, reasonCode: t.after.reasonCode },
  withdrawnEffect: t.withdrawnEffect, admittedEffect: t.admittedEffect,
}));
const failures = [];
function equal(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push({ label, actual, expected });
}
function evaluated(state) {
  const before = JSON.stringify(state);
  const cells = core.evaluate(state, { engineKey, forceFull: true }).cells;
  equal(JSON.stringify(state), before, 'Core evaluate preserves its input state');
  return cells;
}
let baseline = core.createSession(initialOptions);
for (const input of preparation) baseline = core.applyEvent(baseline, input.event);
const baselineCells = evaluated(baseline);
const baselineEntry = buildLedgerEntry({ afterCells: baselineCells, event: null, fromRevision: null,
  toRevision: baseline.revision, baselineState: baseline, engineKey });
function advance(state, cells, previousEntry, input) {
  const before = JSON.stringify(state);
  const nextState = core.applyEvent(state, input.event);
  equal(JSON.stringify(state), before, `Core applyEvent preserves input: ${input.event.id}`);
  const nextCells = evaluated(nextState);
  const ledger = buildLedgerEntry({ beforeCells: cells, afterCells: nextCells, event: input.event,
    fromRevision: state.revision, toRevision: nextState.revision, previousSha256: previousEntry.sha256, engineKey });
  return { state: nextState, cells: nextCells, ledger };
}
const A = advance(baseline, baselineCells, baselineEntry, help);
const B = advance(A.state, A.cells, A.ledger, scopeUnknown);
const C = advance(A.state, A.cells, A.ledger, independenceUnknown);
const expected = {
  baseline: [
    ['e0:asr', 'accepted', 'invariant-and-eligible'],
    ['e0:object', 'accepted', 'invariant-and-eligible'],
    ['e0:past', 'accepted', 'invariant-and-eligible'],
  ],
  A: [
    ['e0:asr', 'accepted', 'invariant-and-eligible'],
    ['e0:object', 'excluded', 'original-was-assisted'],
    ['e0:past', 'accepted', 'invariant-and-eligible'],
  ],
  B: [
    ['e0:asr', 'accepted', 'invariant-and-eligible'],
    ['e0:object', 'held', 'exposure-scope-unconfirmed'],
    ['e0:past', 'held', 'exposure-scope-unconfirmed'],
  ],
  C: [
    ['e0:asr', 'accepted', 'invariant-and-eligible'],
    ['e0:object', 'excluded', 'original-was-assisted'],
    ['e0:past', 'held', 'independence-unconfirmed'],
  ],
};
for (const [name, cells] of Object.entries({ baseline: baselineCells, A: A.cells, B: B.cells, C: C.cells })) {
  equal(cells.map(c => [c.id, c.status, c.reasonCode]), expected[name], `${name} final states and primary reasons`);
}
equal(A.ledger.transitions.map(t => [t.cellId, t.action]), [['e0:asr','retained'],['e0:object','withdrawn'],['e0:past','retained']], 'baseline to A actions');
equal(B.ledger.transitions.map(t => [t.cellId, t.action]), [['e0:asr','retained'],['e0:object','held'],['e0:past','withdrawn']], 'A to B actions');
equal(C.ledger.transitions.map(t => [t.cellId, t.action]), [['e0:asr','retained'],['e0:object','excluded'],['e0:past','withdrawn']], 'A to C actions');
equal(B.cells.find(c => c.id === 'e0:object').blockers.map(b => [b.code, b.status]),
  [['exposure-scope-unconfirmed','held'],['original-was-assisted','excluded']], 'B retains both the earlier held reason and later excluded reason');
const originalPast = baselineCells.find(c => c.id === 'e0:past').value;
equal(A.cells.find(c => c.id === 'e0:past').value, originalPast, 'A retains exactly the baseline past contribution');
for (const [label, branch] of [['B', B], ['C', C]]) {
  equal(branch.ledger.transitions.find(t => t.cellId === 'e0:past').withdrawnEffect, originalPast, `${label} withdraws the previously accepted past contribution`);
}
const initialById = new Map(baselineCells.map(c => [c.id, c]));
const netFromInitiallyAccepted = cells => cells.map(c => ({ cellId: c.id,
  initially: { status: initialById.get(c.id).status, value: initialById.get(c.id).value },
  finally: { status: c.status, value: c.value },
  initialContributionStillPresent: c.status === 'accepted' && c.value === initialById.get(c.id).value,
  initialContributionNoLongerPresent: c.status !== 'accepted',
}));
function outputCase(id, description, branch, inputs) {
  return { id, description, inputEventsAfterBaseline: inputs,
    finalRevision: branch.state.revision,
    finalConditions: { exposureScopeConfirmed: branch.state.original.exposureScopeConfirmed,
      pastIndependent: branch.state.task.pastIndependent, roleConfirmed: branch.state.task.roleConfirmed },
    cells: compactCells(branch.cells),
    actualImmediateTransition: { fromRevision: branch.ledger.fromRevision, toRevision: branch.ledger.toRevision,
      causeEventId: branch.ledger.cause.eventId, transitions: compactTransitions(branch.ledger) },
    netComparisonWithInitiallyAccepted: { scope: 'Comparison only; not a single-event ledger or attribution of every withdrawal to the last event.',
      cells: netFromInitiallyAccepted(branch.cells) },
    ledgerEntriesAfterBaseline: id === 'A' ? [A.ledger] : [A.ledger, branch.ledger],
  };
}
const sourceAfter = sources();
equal(sourceAfter, sourceBefore, 'Source files unchanged during execution');
const result = {
  schemaVersion: 1, generatedAt: new Date().toISOString(), runtime: process.version, coreVersion: core.VERSION,
  command: 'node tools/patent-studio/grant-path-20260913/decision/p1-support-cases.cjs',
  scope: 'Three bounded synthetic P1 wording examples through existing Core API and actual projection ledger function; no software feature changes.',
  inputProvenance: {
    kind: 'isolated-authored-logical-inputs', actualAudioRead: false, actualMicrophoneCapture: false,
    actualHumanReview: false, actualHelpDisplay: false, operationalDatabaseUsed: false, externalServiceUsed: false,
    captureNote: 'acquisition=microphone and source=human are simulated API fields for this controlled example. They are not observations of real recording or review.',
    receivedAtNote: 'receivedAt in the input envelopes is the authored receipt timeline. Core receives event.at as occurrence time; this run does not exercise store receipt timestamps.',
    fixtureDecision: 'Read existing lab/fixtures.cjs. It supplies a zero-length assumed capture interval and directly restores timing fields; used isolated public Core API events instead to expose a nonzero capture interval and all condition changes.',
  },
  sources: sourceBefore,
  baselineInput: { initialOptions, preparation },
  initiallyAccepted: { state: baseline, cells: compactCells(baselineCells), ledgerEntry: baselineEntry },
  cases: [
    outputCase('A', '발화 전 조사 도움 + 과거형 독립 확인 참', A, [help]),
    outputCase('B', 'A에서 도움 관측 범위 확인값만 거짓으로 변경', B, [help, scopeUnknown]),
    outputCase('C', 'A에서 과거형 독립 확인값만 거짓으로 변경', C, [help, independenceUnknown]),
  ],
  validation: { matchedExpectedStatesAndTransitions: failures.length === 0, failures,
    supportRepairInferenceMismatch: false,
    scopeOfConclusion: 'The final states predicted by P1_SUPPORT_REPAIR.md match if validation succeeds. No patentability, general language ability, actual independence or complete assistance detection is established.',
  },
  interpretation: [
    'A preserves the past contribution and ASR contribution while withdrawing only the original object-performance contribution.',
    'B has both original performance records held; ASR remains accepted. The object blocker list retains original-was-assisted after the primary exposure-scope-unconfirmed blocker.',
    'B does not withdraw the object contribution twice: the help event already withdrew it in baseline-to-A; A-to-B changes excluded to held and newly withdraws only the past contribution.',
    'C newly withdraws only the past contribution after A; object remains excluded and ASR remains accepted.',
    'Independent confirmation and assistance observation scope are separate stored conditions; neither boolean authenticates an external fact.',
  ],
};
result.validation.supportRepairInferenceMismatch = failures.some(f => /final states and primary reasons/.test(f.label));
fs.writeFileSync(path.join(__dirname, 'P1_SUPPORT_CASES.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ matched: result.validation.matchedExpectedStatesAndTransitions, failures,
  cases: result.cases.map(c => ({ id: c.id, final: c.cells.map(x => ({ id: x.id, status: x.status, reason: x.reasonCode })),
    immediateTransitions: c.actualImmediateTransition.transitions.map(t => ({ id: t.cellId, action: t.action, withdrawn: t.withdrawnEffect })) })) }));
if (failures.length) process.exitCode = 1;
