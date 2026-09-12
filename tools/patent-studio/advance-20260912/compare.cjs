'use strict';

// Reproducible synthetic comparisons. No student data, network or external API.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const { performance } = require('node:perf_hooks');
const started = performance.now();
const studio = path.resolve(__dirname, '..');
const sourceFiles = ['core.cjs', 'projection.cjs', 'temporal-evidence.cjs', 'observation-planner.cjs'];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sourceFingerprints = Object.fromEntries(sourceFiles.map(file => [file, hash(fs.readFileSync(path.join(studio, file)))]));
const { createSession, applyEvent, evaluate, VERSION } = require('../core.cjs');
const { planEvidencePreserving } = require('../observation-planner.cjs');
const { classifyHelpTime } = require('../temporal-evidence.cjs');
const at = seconds => new Date(Date.UTC(2026, 8, 12) + seconds * 1000).toISOString();
const bounds = (low, high, sourceRef = 'synthetic/declared-comparison-bound') => ({ earliestAt: at(low), latestAt: at(high), basis: 'declared-bound', sourceRef });
const sortIds = (a, b) => a < b ? -1 : a > b ? 1 : 0;

function cleanSession(id, ambiguous = false) {
  let state = createSession({ id, mode: 'example', exampleId: ambiguous ? 'particle-ambiguity' : 'unknown-coverage', createdAt: at(100) });
  if (!ambiguous) state = applyEvent(state, { id: `${id}-unknown-clear`, type: 'unknown-set', enabled: false, at: at(101) });
  return state;
}
function addHelp(state, low, high) {
  return applyEvent(state, { id: `${state.id}-help`, type: 'help-presented', at: at(1000), text: '합성 도움 기록',
    skills: ['object'], exposesAnswer: true, timeBounds: bounds(low, high) });
}
const originalCells = analysis => Object.fromEntries(['object', 'past', 'asr'].map(skill => [skill, analysis.cells.find(cell => cell.utteranceId === 'original' && cell.skill === skill).status]));

// Baseline eligibility is separately implemented against the public input
// contract. All comparisons use the same available actions and scope flags.
function isSafe(action, byId, originalGoal, visiting = new Set()) {
  if (!action || action.available === false || visiting.has(action.id)) return false;
  if (originalGoal && (action.exposesAnswer || action.createsEpoch || action.eligibleForOriginal === false)) return false;
  const next = new Set([...visiting, action.id]);
  return (action.requires || []).every(id => isSafe(byId.get(id), byId, originalGoal, next));
}
function assessSelection(targets, selected) {
  const selectedById = new Map(selected.map(action => [action.id, action]));
  let fullyQualifiedTargets = 0, coveredBlockers = 0;
  for (const target of targets) {
    const covered = new Set(selected.filter(action => isSafe(action, selectedById, target.purpose === 'original-performance')).flatMap(action => action.resolves));
    const ids = [...new Set(target.blockers.map(blocker => blocker.id))];
    coveredBlockers += ids.filter(id => covered.has(id)).length;
    if (ids.every(id => covered.has(id))) fullyQualifiedTargets++;
  }
  return { fullyQualifiedTargets, coveredBlockers, costUnits: selected.reduce((sum, action) => sum + action.costUnits, 0), actionCount: selected.length };
}
function compareResults(a, b) {
  const rank = value => [-value.score.fullyQualifiedTargets, -value.score.coveredBlockers, value.score.costUnits, value.score.actionCount,
    JSON.stringify([...value.selectedActionIds].sort(sortIds))];
  const left = rank(a), right = rank(b);
  const differing = left.findIndex((value, index) => value !== right[index]);
  return differing === -1 ? 0 : left[differing] < right[differing] ? -1 : 1;
}
function exhaustiveBaseline({ targets, actions, budget, maxDepth }) {
  assert.ok(actions.length <= 16, 'This independent reference is restricted to small inputs.');
  let best = null, examinedSubsets = 0;
  const sorted = [...actions].sort((a, b) => sortIds(a.id, b.id));
  for (let mask = 0; mask < 2 ** sorted.length; mask++) {
    examinedSubsets++;
    const selected = sorted.filter((_, index) => Math.floor(mask / 2 ** index) % 2 === 1);
    if (selected.length > maxDepth || selected.some(action => action.available === false)) continue;
    if (selected.reduce((sum, action) => sum + action.costUnits, 0) > budget) continue;
    const ids = new Set(selected.map(action => action.id));
    if (selected.some(action => (action.requires || []).some(id => !ids.has(id)))) continue;
    const completed = new Set();
    for (let pass = 0; pass < selected.length; pass++) for (const action of selected) {
      if ((action.requires || []).every(id => completed.has(id))) completed.add(action.id);
    }
    if (completed.size !== selected.length) continue;
    const candidate = { selectedActionIds: selected.map(action => action.id), score: assessSelection(targets, selected) };
    if (!best || compareResults(candidate, best) < 0) best = candidate;
  }
  return { ...best, examinedSubsets, implementation: 'enumerate-all-subsets-then-validate-with-string-sets', conditionalOnly: true };
}
function greedyBaseline(input, mode) {
  const selected = [], byId = new Map(input.actions.map(action => [action.id, action]));
  while (selected.length < input.maxDepth) {
    const current = assessSelection(input.targets, selected);
    if (current.fullyQualifiedTargets === input.targets.length) break;
    const selectedIds = new Set(selected.map(action => action.id));
    const candidates = input.actions.filter(action => !selectedIds.has(action.id) && action.available !== false &&
      (action.requires || []).every(id => selectedIds.has(id)) && current.costUnits + action.costUnits <= input.budget).map(action => {
      const next = assessSelection(input.targets, [...selected, action]);
      return { action, gain: next.coveredBlockers - current.coveredBlockers };
    }).filter(row => row.gain > 0 && input.targets.some(target => isSafe(row.action, byId, target.purpose === 'original-performance')));
    candidates.sort((a, b) => {
      if (mode === 'coverage-per-cost') {
        const ratioA = a.action.costUnits === 0 ? Infinity : a.gain / a.action.costUnits;
        const ratioB = b.action.costUnits === 0 ? Infinity : b.gain / b.action.costUnits;
        if (ratioA !== ratioB) return ratioA > ratioB ? -1 : 1;
      }
      return a.action.costUnits - b.action.costUnits || sortIds(a.action.id, b.action.id);
    });
    if (!candidates.length) break;
    selected.push(candidates[0].action);
  }
  return { selectedActionIds: selected.map(action => action.id), score: assessSelection(input.targets, selected), conditionalOnly: true };
}
function planningCase(id, state, expectedCost) {
  const originalSnapshot = JSON.stringify(state);
  const analysis = evaluate(state);
  const contract = analysis.evidencePlan;
  const input = { targets: contract.targets, actions: contract.actions, ...contract.bounds };
  const optimizer = planEvidencePreserving(input);
  const reference = exhaustiveBaseline(input);
  const cheapestRelated = greedyBaseline(input, 'cheapest-related');
  const coveragePerCost = greedyBaseline(input, 'coverage-per-cost');
  assert.deepEqual(optimizer.score, reference.score, `${id} optimum score`);
  assert.deepEqual(optimizer.selectedActionIds, reference.selectedActionIds, `${id} optimum actions`);
  assert.deepEqual(optimizer.score, contract.score, `${id} core integration score`);
  assert.equal(optimizer.score.costUnits, expectedCost, `${id} declared expected cost`);
  assert.equal(JSON.stringify(state), originalSnapshot, `${id} planning cannot mutate actual evidence`);
  assert.equal(optimizer.actualEvidenceChanged, false);
  const coreBefore = originalCells(analysis);
  assert.ok(Object.values(coreBefore).includes('held'));
  return { id, declaredInput: input, coreBefore, coreAfterPlanning: originalCells(evaluate(state)),
    optimizer: { selectedActionIds: optimizer.selectedActionIds, score: optimizer.score, optimalWithinBounds: optimizer.optimalWithinBounds, exploredStates: optimizer.exploredStates },
    independentExhaustive: reference, cheapestRelatedRepeat: cheapestRelated, coveragePerCostRepeat: coveragePerCost,
    sameOptimumAsStrongBaseline: true, actualEvidenceChanged: false,
    qualificationAssumption: optimizer.projectedQualification.assumption, requiresSupportingOutcomes: true,
    successProbabilityEstimated: false, costsMeasured: false };
}

let tri = cleanSession('three-blockers', true);
tri = applyEvent(tri, { id: 'three-blockers-role', type: 'task-confirmed', roleConfirmed: false, at: at(102) });
tri = addHelp(tri, 95, 105);
const timeOnly = addHelp(cleanSession('time-only'), 95, 105);
const planning = [planningCase('three-blockers', tri, 15), planningCase('transcript-only', cleanSession('transcript-only', true), 8), planningCase('time-only', timeOnly, 3)];
assert.equal(planning[0].cheapestRelatedRepeat.score.costUnits, 16);
assert.equal(planning[0].coveragePerCostRepeat.score.costUnits, 16);
for (const row of planning.slice(1)) assert.equal(row.optimizer.score.costUnits, row.cheapestRelatedRepeat.score.costUnits);

// An independent oracle enumerates every possible integer help instant. It does
// not use the module's endpoint inequalities. The event domain is declared here.
function enumerationOracle(low, high) {
  const possibleRelations = new Set();
  for (let instant = low; instant <= high; instant++) possibleRelations.add(instant < 100 ? 'before' : instant > 100 ? 'after' : 'overlap');
  const relation = possibleRelations.size === 1 ? [...possibleRelations][0] : 'unknown';
  const object = relation === 'before' ? 'excluded' : relation === 'after' ? 'accepted' : 'held';
  return { relation, possibleRelations: [...possibleRelations].sort(sortIds), cells: { object, past: 'accepted', asr: 'accepted' } };
}
function conservativeIntervalPurpose(low, high) {
  const object = high < 100 ? 'excluded' : low > 100 ? 'accepted' : 'held';
  return { object, past: 'accepted', asr: 'accepted' };
}
function midpointPurpose(low, high) {
  const midpoint = (low + high) / 2;
  return { object: midpoint < 100 ? 'excluded' : midpoint > 100 ? 'accepted' : 'held', past: 'accepted', asr: 'accepted' };
}
const temporalCases = [];
for (let low = 95; low <= 105; low++) for (let high = low; high <= 105; high++) {
  const state = addHelp(cleanSession(`interval-${low}-${high}`), low, high);
  const oracle = enumerationOracle(low, high);
  const moduleRelation = classifyHelpTime(state.helpEvents[0], state.original).relation;
  const core = originalCells(evaluate(state));
  const strongBaseline = conservativeIntervalPurpose(low, high);
  const midpoint = midpointPurpose(low, high);
  assert.equal(moduleRelation, oracle.relation, `${low}..${high} relation`);
  assert.deepEqual(core, oracle.cells, `${low}..${high} core qualification`);
  assert.deepEqual(strongBaseline, oracle.cells, `${low}..${high} strong baseline`);
  temporalCases.push({ low, high, possibleRelations: oracle.possibleRelations, oracleRelation: oracle.relation,
    core, strongIntervalPurposeBaseline: strongBaseline, midpointPurposeBaseline: midpoint,
    midpointMatchesOracle: midpoint.object === oracle.cells.object });
}
const temporalMetrics = {
  cases: temporalCases.length, coreOracleMismatches: 0, strongBaselineOracleMismatches: 0,
  midpointOracleMismatches: temporalCases.filter(row => !row.midpointMatchesOracle).length,
  midpointPrematureAdmissions: temporalCases.filter(row => row.midpointPurposeBaseline.object === 'accepted' && row.core.object !== 'accepted').length,
  midpointPrematureExclusions: temporalCases.filter(row => row.midpointPurposeBaseline.object === 'excluded' && row.core.object !== 'excluded').length,
  strongBaselineTiesCore: true,
};
assert.equal(temporalMetrics.cases, 66);
assert.ok(temporalMetrics.midpointPrematureAdmissions > 0 && temporalMetrics.midpointPrematureExclusions > 0);

const beforeOutcome = originalCells(evaluate(timeOnly));
const noResponse = originalCells(evaluate(timeOnly));
assert.deepEqual(noResponse, beforeOutcome);
const contrary = applyEvent(timeOnly, { id: 'actual-synthetic-contrary-review', type: 'help-refined', helpId: `${timeOnly.id}-help`,
  at: at(1001), sourceRef: 'synthetic/contrary-review', timeBounds: bounds(95, 99, 'synthetic/contrary-review') });
const supporting = applyEvent(timeOnly, { id: 'actual-synthetic-supporting-review', type: 'help-refined', helpId: `${timeOnly.id}-help`,
  at: at(1001), sourceRef: 'synthetic/supporting-review', timeBounds: bounds(101, 105, 'synthetic/supporting-review') });
const contraryCells = originalCells(evaluate(contrary)), supportingCells = originalCells(evaluate(supporting));
assert.equal(contraryCells.object, 'excluded');
assert.equal(supportingCells.object, 'accepted');
assert.deepEqual(originalCells(evaluate(timeOnly)), beforeOutcome);

for (const file of sourceFiles) assert.equal(hash(fs.readFileSync(path.join(studio, file))), sourceFingerprints[file], `source changed during comparison: ${file}`);
const result = {
  schema: 'synk.patent-advance.fair-synthetic-comparison.v1', generatedAt: new Date().toISOString(), engineVersion: VERSION,
  scope: '선언된 합성 입력에 대한 기술 처리 자체 비교. 특허 신규성·진보성, 학생 성과, 실제 운영 속도 또는 등록 확률의 증명이 아님.',
  controls: { sameInputsAcrossPolicies: true, sameCandidateActionsAcrossPlanningPolicies: true, irrelevantDecoyActionsUsed: false,
    costs: '선언 모델 단위. 실측 초·원 또는 성공률이 아님.', budget: 32, maxDepth: 8,
    predictionIsObservation: false, externalApiCalls: 0, studentRecordsUsed: 0 },
  planning,
  temporal: { domain: '고정 수행 구간 [100,100], 도움의 가능한 시점은 95..105의 정수. 모든 닫힌 부분 구간 66개.',
    purposeInputs: { helpedSkill: 'object', untouchedSkill: 'past', separatePurpose: 'asr-data' }, metrics: temporalMetrics, cases: temporalCases,
    interpretation: 'Core는 독립 전수 oracle 및 일반적인 보수적 구간·목적 baseline과 동일. midpoint 방식의 손실은 시간범위를 한 점으로 버린 영향이며, 강한 기존 방식보다 우월하다는 결론이 아님.' },
  observedSyntheticOutcomes: {
    note: '아래 분기는 서로 다른 합성 확인 결과를 독립 적용한 실행이며 실제 학생 관측이나 성공률 표본이 아님.', before: beforeOutcome,
    noResponse: { appliedObservation: false, cells: noResponse, newlyAcceptedOriginalPerformance: 0 },
    contraryResult: { appliedSyntheticObservation: true, eventId: 'actual-synthetic-contrary-review', cells: contraryCells, newlyAcceptedOriginalPerformance: 0 },
    supportingResult: { appliedSyntheticObservation: true, eventId: 'actual-synthetic-supporting-review', cells: supportingCells,
      actualEngineTransition: 'held-to-accepted-under-synthetic-supporting-bounds' },
  },
  conclusions: [
    '세 보류 입력에서는 좁은 관련 확인을 반복하면 선언 비용16, 전체 자료를 함께 확인하는 선택은15였다.',
    '전사 하나 또는 시간 하나만 확인하면 되는 경우에는 planner와 관련 확인 baseline이 각각8과3으로 같았다.',
    '독립 완전탐색 baseline은 세 사례 모두 planner와 같은 최적 집합을 냈다. 새로운 최적화 이론을 주장하지 않는다.',
    '66개 시간 구간에서는 강한 보수적 구간·목적 baseline과 Core가 모두 oracle와 일치했다.',
    '계획 생성은 보류를 실제 반영으로 바꾸지 않았고, 무응답은 유지, 반대 확인은 제외, 뒷받침 확인만 해당 합성 조건의 보류를 해소했다.',
  ],
  sourceFingerprints, scriptSha256: hash(fs.readFileSync(__filename)),
  runtime: { measuredOnce: true, includesAssertionsAndSourceReads: true, node: process.version, platform: process.platform,
    architecture: process.arch, osRelease: os.release(), elapsedMs: Math.round((performance.now() - started) * 1000) / 1000 },
};
const output = `${JSON.stringify(result, null, 2)}\n`;
assert.ok(Buffer.byteLength(output) < 100000, 'Comparison artifact must remain below 100KB.');
fs.writeFileSync(path.join(__dirname, 'compare.json'), output, 'utf8');
process.stdout.write(`${JSON.stringify({ ok: true, planningCases: planning.length, temporalMetrics, bytes: Buffer.byteLength(output), elapsedMs: result.runtime.elapsedMs, output: path.join(__dirname, 'compare.json') })}\n`);
