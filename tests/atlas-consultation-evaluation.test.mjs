import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { evaluateConsultation, validateDataset } from '../tools/evaluate-atlas-consultation.mjs';
import Ask from '../atlas/ask.js';
import content from '../docs/마케팅/맞춤도구/computer/content.js';
import rules from '../docs/마케팅/맞춤도구/computer/rules.js';
import { createComputerConsultation, COMPLETION_POLICY } from '../experiences/atlas-lab/consultation.mjs';

const dataset = JSON.parse(await readFile(new URL('./fixtures/atlas-consultation-cases.json', import.meta.url), 'utf8'));
const copy = value => structuredClone(value);
const only = id => ({ ...copy(dataset), cases: [copy(dataset.cases.find(item => item.id === id))] });
const consultation = createComputerConsultation({ Ask, content, rules });

test('both real policies receive exactly the same scripted answers, without mutating the fixture or inventing user measures', t => {
  const before = copy(dataset), fetch = t.mock.method(globalThis, 'fetch', () => { throw Error('Evaluation must be offline'); });
  const result = evaluateConsultation(dataset);
  assert.deepEqual(dataset, before); assert.equal(fetch.mock.callCount(), 0);
  assert.equal(result.execution.actualUsers, 0); assert.equal(result.execution.modelCalls, 0);
  assert.equal(result.version, 2); assert.equal(result.versions.completionPolicy, COMPLETION_POLICY);
  for (const item of result.cases) for (const policy of ['fixed', 'atlas']) {
    const supplied = dataset.cases.find(source => source.id === item.id), run = item[policy];
    assert.equal(run.questionCount, run.trace.length); assert.equal(new Set(run.trace.map(q => q.id)).size, run.trace.length);
    assert.ok(run.questionCount <= dataset.protocol.maxQuestions);
    for (const q of run.trace.filter(q => q.responseStatus === 'answered')) assert.deepEqual(q.value, supplied.responses[q.id].value);
    assert.equal(run.userCompletionTime, null); assert.equal(run.userCorrectionCount, null); assert.ok(Number.isFinite(run.computeTimeMs));
    assert.deepEqual(run.productCompletion, consultation.completion(run.answers), 'both policies use the product adapter completion contract');
    assert.deepEqual(run.productCompletion, consultation.choose(run.answers).completion, 'the production selector exposes the same completion state');
    assert.deepEqual(run.missingRequiredAnswers, supplied.requiredAnswers.filter(id => consultation.answerState(id, run.answers[id]) !== 'known'));
    assert.equal(run.productQualityGatePassed, run.scriptedQualityGatePassed && run.productCompletion.status === 'ready');
    assert.equal(run.decisionStatus, !run.decision ? 'not-shown' : run.productCompletion.status === 'ready' ? 'requirements-confirmed' : 'provisional-only');
    assert.equal(Object.hasOwn(run, 'completed'), false);
    for (const [id, value] of Object.entries(run.answers)) assert.deepEqual(value, Object.hasOwn(supplied.initialAnswers, id) ? supplied.initialAnswers[id] : supplied.responses[id].value);
  }
});

test('fewer questions alone cannot pass an authored mandatory check, even with identical advice', () => {
  // Since 001d225cf (10-08, computer-question-value-4) Atlas asks every unanswered product-required
  // confirmation, so it now asks the budget here. The authored gate must still reject an answer the case
  // author made mandatory that Atlas skips because it would not change the advice (multitask).
  const data = only('web-new-light'); data.cases[0].requiredAnswers.push('multitask');
  const result = evaluateConsultation(data), item = result.cases[0];
  assert.ok(item.atlas.trace.some(row => row.about === 'budget'), 'the required budget is asked');
  assert.ok(item.atlas.questionCount < item.fixed.questionCount);
  assert.equal(item.comparison.finalDecisionsEqual, true); assert.equal(item.atlas.matchesCompleteScriptReference, true);
  assert.deepEqual(item.atlas.missingRequiredAnswers, ['multitask']);
  assert.equal(item.fixed.scriptedQualityGatePassed, true); assert.equal(item.atlas.scriptedQualityGatePassed, false);
  assert.equal(item.atlas.questionSelectionFinished, true);
  assert.equal(item.atlas.productCompletion.status, 'ready', 'the product requirements alone are met');
  assert.equal(item.atlas.decisionStatus, 'requirements-confirmed'); assert.equal(item.atlas.productQualityGatePassed, false);
  assert.equal(item.fixed.productCompletion.status, 'ready'); assert.equal(item.fixed.decisionStatus, 'requirements-confirmed');
  assert.equal(item.comparison.authoredQualityComparable, false);
  assert.equal(item.comparison.fewerQuestionsWithQualityMaintained, false); assert.equal(result.summary.qualityComparableCases, 0);
});

test('contradictory authored requirements fail even though the same product rules generate both recommendations', () => {
  const data = only('combined-local-ai');
  data.cases[0].checks.push({ id: 'impossible-memory', path: 'ram', op: 'gte', value: 999 });
  const result = evaluateConsultation(data).cases[0];
  for (const policy of ['fixed', 'atlas']) {
    assert.equal(result[policy].matchesCompleteScriptReference, true);
    assert.ok(result[policy].authoredCheckFailures.includes('impossible-memory'));
    assert.equal(result[policy].scriptedQualityGatePassed, false);
  }
  assert.equal(result.comparison.fewerQuestionsWithQualityMaintained, false);
});

test('unknown, conflicting and absent responses are recorded without coercion and never become final quality successes', () => {
  for (const [id, question, status] of [['unknown-local-workload', 'localai', 'unknown'], ['conflicting-current-memory', 'current.ram', 'conflict'], ['budget-no-response', 'budget', 'no_response']]) {
    const item = evaluateConsultation(only(id)).cases[0];
    assert.equal(item.reference.complete, false); assert.equal(item.comparison.finalDecisionsEqual, null);
    for (const policy of ['fixed', 'atlas']) {
      const run = item[policy]; assert.equal(run.stopReason, 'unresolved-' + status);
      assert.equal(Object.hasOwn(run.answers, question), false); assert.equal(run.questionSelectionFinished, false);
      assert.equal(run.decisionStatus, 'provisional-only'); assert.equal(run.scriptedQualityGatePassed, false);
      assert.equal(run.matchesCompleteScriptReference, null); assert.equal(run.declaredPolicyLossAgainstReference, null);
    }
  }
});

test('an explicitly selected unknown catalog option is retained but does not satisfy a known-capacity requirement', () => {
  const item = evaluateConsultation(only('explicit-unknown-memory')).cases[0];
  for (const policy of ['fixed', 'atlas']) {
    assert.equal(item[policy].answers['current.ram'], 'unknown');
    assert.equal(item[policy].decision.content.current.verdict, 'unknown');
    assert.ok(item[policy].missingRequiredAnswers.includes('current.ram'));
    assert.equal(item[policy].scriptedQualityGatePassed, false);
    assert.equal(item[policy].authoredCheckFailures.length, 0, 'uncertainty warning can be correct without knowing capacity');
  }
});

test('missing fixture responses are not converted to an enum or scored as successful skips', () => {
  const data = only('huge-ai-low-budget'); delete data.cases[0].responses.budget;
  const item = evaluateConsultation(data).cases[0];
  for (const policy of ['fixed', 'atlas']) {
    assert.equal(item[policy].stopReason, 'unresolved-not_scripted');
    assert.equal(Object.hasOwn(item[policy].answers, 'budget'), false);
    assert.equal(item[policy].scriptedQualityGatePassed, false);
  }
});

test('the common question cap halts both policies without claiming full recommendation equality', () => {
  const data = only('slow-old-desktop'); data.protocol.maxQuestions = 1;
  const item = evaluateConsultation(data).cases[0];
  for (const policy of ['fixed', 'atlas']) {
    assert.equal(item[policy].questionCount, 1); assert.equal(item[policy].stopReason, 'question-limit');
    assert.equal(item[policy].questionSelectionFinished, false); assert.equal(item[policy].scriptedQualityGatePassed, false);
  }
  assert.equal(item.comparison.finalDecisionsEqual, null); assert.equal(item.comparison.qualityComparable, false);
});

test('no selected use preserves the existing product no-advice entry state', () => {
  const item = evaluateConsultation(only('no-selected-use')).cases[0];
  for (const policy of ['fixed', 'atlas']) {
    assert.equal(item[policy].questionCount, 0); assert.equal(item[policy].decisionStatus, 'not-shown');
    assert.equal(item[policy].decision, null); assert.equal(item[policy].scriptedQualityGatePassed, false);
    assert.equal(item[policy].productCompletion.status, 'not-started'); assert.equal(item[policy].productQualityGatePassed, false);
  }
});

test('reusing a sufficient existing computer does not manufacture a missing purchase budget', () => {
  const item = evaluateConsultation(only('reuse-enough-win10')).cases[0];
  for (const policy of ['fixed', 'atlas']) {
    const completion = item[policy].productCompletion;
    assert.equal(completion.path, 'reuse'); assert.equal(completion.status, 'ready');
    assert.equal(completion.budget.required, false);
    assert.equal(completion.requiredFields.includes('budget'), false);
    assert.equal(completion.unresolvedRequiredFields.includes('budget'), false);
    assert.equal(item[policy].productQualityGatePassed, true);
  }
  assert.equal(item.atlas.productCompletion.budget.state, 'missing');
});

test('version 2 preserves the original question policies and authored gates while exposing product gaps', () => {
  const report = evaluateConsultation(dataset);
  // 10-08 policy (001d225cf): Atlas still asks fewer questions but no longer skips product-required confirmations.
  assert.equal(report.summary.fixed.questionCount, 53); assert.equal(report.summary.atlas.questionCount, 38);
  assert.equal(report.summary.fixed.scriptedQualityGatePassed, 6); assert.equal(report.summary.atlas.scriptedQualityGatePassed, 6);
  assert.equal(report.summary.fixed.questionSelectionFinished, 7); assert.equal(report.summary.atlas.questionSelectionFinished, 7);
  assert.equal(report.summary.authoredQualityComparableCases, 6);
  assert.equal(report.summary.fewerQuestionsWithAuthoredQualityMaintained, 6);
  assert.deepEqual(report.summary.authoredQualityComparableQuestionCounts, { fixed: 39, atlas: 30, reduced: 9 });
  const productComparable = report.cases.filter(item => item.comparison.qualityComparable);
  assert.equal(productComparable.length, 6);
  assert.equal(report.summary.qualityComparableCases, productComparable.length);
  assert.equal(report.summary.fewerQuestionsWithQualityMaintained, 6);
  for (const item of report.cases) {
    assert.equal(item.comparison.qualityComparable, item.comparison.authoredQualityComparable && item.fixed.productQualityGatePassed && item.atlas.productQualityGatePassed);
    assert.equal(item.comparison.fewerQuestionsWithQualityMaintained, item.comparison.qualityComparable && item.atlas.questionCount < item.fixed.questionCount);
  }
  for (const policy of ['fixed', 'atlas']) {
    const summary = report.summary[policy];
    assert.equal(Object.hasOwn(summary, 'completed'), false);
    assert.equal(summary.productReady, report.cases.filter(item => item[policy].productCompletion.status === 'ready').length);
    assert.equal(summary.productProvisional, report.cases.filter(item => item[policy].productCompletion.status === 'provisional').length);
    assert.equal(summary.productNotStarted, report.cases.filter(item => item[policy].productCompletion.status === 'not-started').length);
    assert.equal(summary.productQualityGatePassed, report.cases.filter(item => item[policy].productQualityGatePassed).length);
    assert.equal(summary.productReady + summary.productProvisional + summary.productNotStarted, summary.cases);
  }
  assert.ok(report.cases.filter(item => item.atlas.scriptedQualityGatePassed).every(item => item.atlas.productCompletion.status === 'ready'),
    'Atlas asks product-required confirmations, so its authored passes are product-ready in this dataset');
  // The authored and product gates stay independent: an author who does not require the memory the user
  // explicitly cannot tell gets an authored pass while the product still keeps the advice provisional.
  const variant = copy(dataset.cases.find(item => item.id === 'explicit-unknown-memory'));
  variant.requiredAnswers = variant.requiredAnswers.filter(id => id !== 'current.ram');
  const provisionalAuthoredPasses = evaluateConsultation({ ...copy(dataset), cases: [variant] }).cases
    .filter(item => item.atlas.scriptedQualityGatePassed && item.atlas.productCompletion.status === 'provisional');
  assert.ok(provisionalAuthoredPasses.length > 0, 'independent authored criteria must not be silently replaced by product criteria');
  assert.ok(provisionalAuthoredPasses.every(item => !item.atlas.productQualityGatePassed));
  assert.ok(provisionalAuthoredPasses.every(item => item.comparison.authoredQualityComparable && !item.comparison.qualityComparable && !item.comparison.fewerQuestionsWithQualityMaintained));
});

test('invalid answers, duplicate cases and fabricated conflict values fail the dataset contract', () => {
  for (const change of [data => { data.cases.push(copy(data.cases[0])); }, data => { data.cases[0].responses.budget.value = 'invented-price'; },
    data => { data.cases[0].responses.budget = { status: 'no_response', value: 'lt100' }; },
    data => { data.cases[0].responses.budget = { status: 'conflict', values: ['lt100', 'lt100'] }; },
    data => { data.protocol.maxQuestions = 0; }]) {
    const data = only('web-new-light'); change(data); assert.throws(() => validateDataset(data), /Consultation evaluation/);
  }
});

test('CLI writes a reproducible source manifest, explicit simulation limits and report totals', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'synk-consultation-eval-'));
  t.after(async () => { assert.equal(dirname(resolve(directory)), resolve(tmpdir())); assert.ok(directory.includes('synk-consultation-eval-')); await rm(directory, { recursive: true, force: true }); });
  const output = join(directory, 'report.json');
  await promisify(execFile)(process.execPath, ['tools/evaluate-atlas-consultation.mjs', '--report', output], { cwd: resolve('.') });
  const report = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(report.version, 2); assert.equal(report.versions.completionPolicy, COMPLETION_POLICY);
  assert.equal(report.cases.length, dataset.cases.length); assert.match(report.datasetSha256, /^[a-f0-9]{64}$/);
  assert.ok(report.sourceHashes.some(file => file.path === 'atlas/ask.js'));
  assert.equal(report.execution.networkCalls, 0); assert.match(report.adoptionDecision, /not-assessed/);
  for (const policy of ['fixed', 'atlas']) assert.equal(report.summary[policy].questionCount, report.cases.reduce((n, row) => n + row[policy].questionCount, 0));
});
