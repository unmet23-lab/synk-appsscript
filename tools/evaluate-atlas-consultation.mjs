#!/usr/bin/env node
// Offline development comparison of two existing computer-question policies.
// No model, network, inferred user answers, or independent hardware oracle.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import Ask from '../atlas/ask.js';
import content from '../docs/마케팅/맞춤도구/computer/content.js';
import rules from '../docs/마케팅/맞춤도구/computer/rules.js';
import { createComputerConsultation, QUESTION_POLICY, COMPLETION_POLICY } from '../experiences/atlas-lab/consultation.mjs';

const consultation = createComputerConsultation({ Ask, content, rules });
const own = (o, key) => Object.hasOwn(o, key);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const canonical = value => JSON.stringify(value, (_key, x) => plain(x) ? Object.fromEntries(Object.keys(x).sort().map(key => [key, x[key]])) : x);
const clone = value => JSON.parse(JSON.stringify(value));
const fail = message => { throw new TypeError(`Consultation evaluation: ${message}`); };
const fields = new Map();
for (const step of content.steps) {
  for (const field of step.type === 'group' ? step.fields : [step]) fields.set(step.type === 'group' ? `${step.id}.${field.id}` : step.id,
    { multi: field.type === 'multi', options: field.options.map(o => o.id) });
}
function validAnswer(id, value) {
  const field = fields.get(id);
  return !!field && (field.multi ? Array.isArray(value) && (value.length > 0 || id === 'uses') && new Set(value).size === value.length && value.every(item => field.options.includes(item)) : field.options.includes(value));
}
const checkPaths = new Set(['form', 'os', 'ram', 'storage', 'gpu.kind', 'gpu.vram', 'current.verdict', 'current.gb', 'current.actions', 'keep', 'osConflicts', 'budgetWarning', 'budgetTight']);

export function validateDataset(dataset) {
  if (!plain(dataset) || dataset.version !== 1 || typeof dataset.id !== 'string' || !dataset.id || !plain(dataset.protocol)
    || !Number.isInteger(dataset.protocol.maxQuestions) || dataset.protocol.maxQuestions < 1 || dataset.protocol.maxQuestions > 30
    || !Array.isArray(dataset.cases) || !dataset.cases.length || dataset.cases.length > 100) fail('invalid dataset/protocol');
  const ids = new Set();
  for (const item of dataset.cases) {
    if (!plain(item) || typeof item.id !== 'string' || !item.id || ids.has(item.id) || !plain(item.initialAnswers) || !Array.isArray(item.initialAnswers.uses)
      || !plain(item.responses) || !Array.isArray(item.requiredAnswers) || new Set(item.requiredAnswers).size !== item.requiredAnswers.length || !Array.isArray(item.checks)) fail('invalid or duplicate case');
    ids.add(item.id);
    for (const [id, value] of Object.entries(item.initialAnswers)) if (!validAnswer(id, value)) fail(`invalid initial answer ${item.id}:${id}`);
    for (const [id, reply] of Object.entries(item.responses)) {
      if (!fields.has(id) || id === 'uses' || own(item.initialAnswers, id) || !plain(reply) || !['answered', 'unknown', 'no_response', 'conflict'].includes(reply.status)) fail(`invalid response ${item.id}:${id}`);
      const expectedKeys = reply.status === 'answered' ? ['status', 'value'] : reply.status === 'conflict' ? ['status', 'values'] : ['status'];
      if (Object.keys(reply).length !== expectedKeys.length || expectedKeys.some(key => !own(reply, key))) fail('unexpected response payload');
      if (reply.status === 'answered' && !validAnswer(id, reply.value)) fail(`invalid answer ${item.id}:${id}`);
      if (reply.status === 'conflict' && (!Array.isArray(reply.values) || reply.values.length < 2 || new Set(reply.values.map(canonical)).size < 2 || reply.values.some(value => !validAnswer(id, value)))) fail('invalid conflicting answers');
    }
    for (const id of item.requiredAnswers) if (!fields.has(id)) fail('unknown required field');
    const checkIds = new Set();
    for (const check of item.checks) {
      if (!plain(check) || typeof check.id !== 'string' || !check.id || checkIds.has(check.id) || !checkPaths.has(check.path) || !['eq', 'gte', 'includes'].includes(check.op)
        || !own(check, 'value') || check.value === null || !['string', 'number', 'boolean'].includes(typeof check.value)
        || check.op === 'gte' && (typeof check.value !== 'number' || !Number.isFinite(check.value))) fail('invalid authored check');
      checkIds.add(check.id);
    }
  }
  return dataset;
}

function referenceFor(item) {
  const answers = clone(item.initialAnswers);
  for (const [id, reply] of Object.entries(item.responses)) if (reply.status === 'answered') answers[id] = clone(reply.value);
  const available = consultation.questions(answers), eligible = new Set(['uses', ...available.map(q => q.about)]);
  for (const id of Object.keys(answers)) if (!eligible.has(id)) fail(`answer to an ineligible question ${item.id}:${id}`);
  const unresolved = available.filter(q => !own(answers, q.about)).map(q => ({ id: q.id, status: item.responses[q.id]?.status || 'not_scripted' }));
  const complete = answers.uses.length > 0 && unresolved.length === 0;
  return { basis: 'same-product-rules-consistency-only', complete, unresolved, answers,
    decision: complete ? consultation.decision(answers) : null, containsExplicitUnknown: Object.entries(answers).some(([id, value]) => consultation.answerState(id, value) === 'unknown') };
}
function checkDecision(decision, checks) {
  return checks.map(check => {
    const actual = check.path.split('.').reduce((value, key) => value?.[key], decision.content);
    const pass = check.op === 'eq' ? actual === check.value : check.op === 'gte' ? typeof actual === 'number' && actual >= check.value : Array.isArray(actual) && actual.includes(check.value);
    return { ...check, actual: actual ?? null, pass };
  });
}
export function runConsultationCase(item, { policy, maxQuestions = 20, reference = referenceFor(item) } = {}) {
  if (!['fixed', 'atlas'].includes(policy) || !Number.isInteger(maxQuestions) || maxQuestions < 1 || maxQuestions > 30) fail('invalid run policy/budget');
  const start = performance.now(), answers = clone(item.initialAnswers), trace = [];
  let stopReason, questionSelectionFinished = false, policyAbstained = false;
  if (!answers.uses.length) stopReason = 'no-selected-use';
  while (!stopReason) {
    const choice = policy === 'atlas' ? consultation.choose(answers) : null;
    const question = policy === 'atlas' ? choice.question : consultation.questions(answers).find(q => !own(answers, q.about));
    if (!question) {
      stopReason = policy === 'atlas' ? choice.reason : 'all-eligible-questions-answered';
      questionSelectionFinished = true; policyAbstained = policy === 'atlas'; break;
    }
    if (trace.length >= maxQuestions) { stopReason = 'question-limit'; break; }
    if (trace.some(row => row.id === question.id)) fail('question repeated without a supplied answer');
    const reply = item.responses[question.id] || { status: 'not_scripted' };
    const row = { id: question.id, about: question.about, responseStatus: reply.status,
      ...(policy === 'atlas' ? { declaredValue: choice.value, basis: choice.basis } : {}) };
    trace.push(row);
    if (reply.status !== 'answered') { stopReason = `unresolved-${reply.status}`; break; }
    const value = clone(reply.value);
    // Only a supplied catalog answer is ever written. Unknown/conflict/refusal
    // are evaluation stops, not fabricated answers or production UI features.
    answers[question.about] = value; row.value = value;
  }
  const computeTimeMs = performance.now() - start;
  const productCompletion = consultation.completion(answers);
  const decision = answers.uses.length ? consultation.decision(answers) : null;
  const authoredChecks = decision ? checkDecision(decision, item.checks) : [];
  const missingRequiredAnswers = item.requiredAnswers.filter(id => consultation.answerState(id, answers[id]) !== 'known');
  const sameReference = questionSelectionFinished && decision && reference.complete ? canonical(decision) === canonical(reference.decision) : null;
  const scriptedQualityGatePassed = questionSelectionFinished && !!decision && missingRequiredAnswers.length === 0 && authoredChecks.every(check => check.pass);
  return { policy: policy === 'atlas' ? QUESTION_POLICY : 'computer-content-order-1', questionCount: trace.length,
    answeredCount: trace.filter(row => row.responseStatus === 'answered').length, stopReason, questionSelectionFinished, policyAbstained, productCompletion,
    decisionStatus: !decision ? 'not-shown' : productCompletion.status === 'ready' ? 'requirements-confirmed' : 'provisional-only', trace, answers, decision,
    missingRequiredAnswers, authoredChecks, authoredCheckFailures: authoredChecks.filter(check => !check.pass).map(check => check.id),
    scriptedQualityGatePassed, productQualityGatePassed: productCompletion.status === 'ready' && scriptedQualityGatePassed,
    matchesCompleteScriptReference: sameReference,
    declaredPolicyLossAgainstReference: decision && reference.complete ? consultation.evaluate({ decision, answers: reference.answers }).loss : null,
    computeTimeMs, userCompletionTime: null, userCorrectionCount: null };
}

export function evaluateConsultation(dataset) {
  validateDataset(dataset);
  const cases = dataset.cases.map(item => {
    const reference = referenceFor(item), options = { maxQuestions: dataset.protocol.maxQuestions, reference };
    const fixed = runConsultationCase(item, { ...options, policy: 'fixed' }), atlas = runConsultationCase(item, { ...options, policy: 'atlas' });
    const authoredQualityComparable = fixed.scriptedQualityGatePassed && atlas.scriptedQualityGatePassed && fixed.matchesCompleteScriptReference === true && atlas.matchesCompleteScriptReference === true;
    const qualityComparable = authoredQualityComparable && fixed.productQualityGatePassed && atlas.productQualityGatePassed;
    return { id: item.id, description: item.description, reference, fixed, atlas,
      comparison: { questionsReduced: fixed.questionCount - atlas.questionCount, finalDecisionsEqual: fixed.questionSelectionFinished && atlas.questionSelectionFinished && fixed.decision && atlas.decision ? canonical(fixed.decision) === canonical(atlas.decision) : null,
        authoredQualityComparable, fewerQuestionsWithAuthoredQualityMaintained: authoredQualityComparable && atlas.questionCount < fixed.questionCount,
        qualityComparable, fewerQuestionsWithQualityMaintained: qualityComparable && atlas.questionCount < fixed.questionCount } };
  });
  const summary = {};
  for (const policy of ['fixed', 'atlas']) summary[policy] = {
    cases: cases.length, questionCount: cases.reduce((sum, item) => sum + item[policy].questionCount, 0),
    questionSelectionFinished: cases.filter(item => item[policy].questionSelectionFinished).length,
    stoppedUnresolvedOrLimited: cases.filter(item => !item[policy].questionSelectionFinished).length,
    productReady: cases.filter(item => item[policy].productCompletion.status === 'ready').length,
    productProvisional: cases.filter(item => item[policy].productCompletion.status === 'provisional').length,
    productNotStarted: cases.filter(item => item[policy].productCompletion.status === 'not-started').length,
    missingRequiredAnswerCount: cases.reduce((sum, item) => sum + item[policy].missingRequiredAnswers.length, 0),
    authoredCheckFailureCount: cases.reduce((sum, item) => sum + item[policy].authoredCheckFailures.length, 0),
    scriptedQualityGatePassed: cases.filter(item => item[policy].scriptedQualityGatePassed).length,
    productQualityGatePassed: cases.filter(item => item[policy].productQualityGatePassed).length,
    referenceComparable: cases.filter(item => item[policy].matchesCompleteScriptReference !== null).length,
    matchingCompleteScriptReference: cases.filter(item => item[policy].matchesCompleteScriptReference === true).length,
    totalComputeTimeMs: cases.reduce((sum, item) => sum + item[policy].computeTimeMs, 0),
  };
  const comparableQuestionCounts = field => {
    const comparable = cases.filter(item => item.comparison[field]);
    const fixed = comparable.reduce((total, item) => total + item.fixed.questionCount, 0), atlas = comparable.reduce((total, item) => total + item.atlas.questionCount, 0);
    return { fixed, atlas, reduced: fixed - atlas };
  };
  return { version: 2, kind: 'synthetic-computer-question-policy-comparison', dataset: { id: dataset.id, version: dataset.version, basis: dataset.basis },
    protocol: clone(dataset.protocol), versions: { ask: Ask.VERSION, questionPolicy: QUESTION_POLICY, completionPolicy: COMPLETION_POLICY, rules: rules.VERSION || null },
    comparisonScope: { decision: 'Existing consultation.decision.content only: form, OS, RAM, storage, GPU, current-device actions, keep advice and budget warnings.',
      excludes: ['CPU/NPU detail', 'all displayed wording/tips', 'live prices or hardware validation'],
      completion: 'Question selection finished means only that the chosen policy has no next question. Product readiness uses the shared specification-guidance completion contract.',
      scriptedQuality: 'Authored requiredAnswers and checks remain independent development criteria; the scripted gate includes question-selection completion. The product gate additionally requires product readiness.',
      qualityComparison: 'authoredQualityComparable preserves the authored-only comparison. qualityComparable and fewerQuestionsWithQualityMaintained also require both product quality gates.',
      referenceComplete: 'All eligible scripted questions have answers, including explicit unknown options; this is not product readiness.',
      computeTime: 'Question selection and scripted answer application only, excluding input loading, result scoring and any human time.' },
    summary: { ...summary, authoredQualityComparableCases: cases.filter(item => item.comparison.authoredQualityComparable).length,
      fewerQuestionsWithAuthoredQualityMaintained: cases.filter(item => item.comparison.fewerQuestionsWithAuthoredQualityMaintained).length,
      authoredQualityComparableQuestionCounts: comparableQuestionCounts('authoredQualityComparable'),
      qualityComparableCases: cases.filter(item => item.comparison.qualityComparable).length,
      qualityComparableQuestionCounts: comparableQuestionCounts('qualityComparable'),
      fewerQuestionsWithQualityMaintained: cases.filter(item => item.comparison.fewerQuestionsWithQualityMaintained).length }, cases,
    adoptionDecision: 'not-assessed-no-actual-users-and-only-authored-development-criteria',
    limits: ['Hand-authored development cases, not a population sample or held-out efficacy test.',
      'Reference equality reuses the product rules; it is not independent recommendation correctness.',
      'Authored checks cover only the stated conditions, not every hardware constraint or current market specification.',
      'A finished question policy can still leave required product conditions unresolved. Product readiness is specification guidance, not a verified purchase decision.',
      'Missing/refused/conflicting answers halt this offline script; the current UI would wait for a usable answer.',
      'Ask probabilities, zero question cost and loss weights remain declared policy, not measured user behavior.',
      'Computation duration excludes reading, answering and correction; no user or causal improvement is claimed.'],
    execution: { networkCalls: 0, modelCalls: 0, actualUsers: 0, externalApiCost: 0 } };
}

async function main(args) {
  const options = {};
  if (args.includes('--help')) { console.log('node tools/evaluate-atlas-consultation.mjs [--dataset FILE] [--report FILE]\nOffline synthetic comparison only. No API calls.'); return; }
  for (let i = 0; i < args.length; i += 2) {
    if (!['--dataset', '--report'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--') || options[args[i]]) fail('invalid CLI arguments');
    options[args[i]] = args[i + 1];
  }
  const path = options['--dataset'] ? resolve(options['--dataset']) : fileURLToPath(new URL('../tests/fixtures/atlas-consultation-cases.json', import.meta.url));
  const raw = await readFile(path); if (raw.length > 1000000) fail('dataset too large');
  const artifacts = ['atlas/ask.js', 'experiences/atlas-lab/consultation.mjs', 'docs/마케팅/맞춤도구/computer/content.js', 'docs/마케팅/맞춤도구/computer/rules.js', 'tools/evaluate-atlas-consultation.mjs'];
  const hashes = await Promise.all(artifacts.map(async relative => ({ path: relative, sha256: createHash('sha256').update(await readFile(new URL('../' + relative, import.meta.url))).digest('hex') })));
  const result = { ...evaluateConsultation(JSON.parse(raw.toString('utf8'))), evaluatedAt: new Date().toISOString(),
    sourceHashes: hashes, datasetSha256: createHash('sha256').update(raw).digest('hex') };
  const json = JSON.stringify(result, null, 2) + '\n';
  if (options['--report']) {
    const report = resolve(options['--report']);
    if (report === path || hashes.some(file => fileURLToPath(new URL('../' + file.path, import.meta.url)) === report)) fail('report cannot overwrite source');
    await mkdir(dirname(report), { recursive: true }); await writeFile(report, json, 'utf8');
    console.log(JSON.stringify({ report, summary: result.summary, execution: result.execution }));
  } else console.log(json.trimEnd());
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
