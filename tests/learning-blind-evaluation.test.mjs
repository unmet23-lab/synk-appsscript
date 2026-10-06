// Offline contract tests with explicitly synthetic responses, never real model results.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, relative, isAbsolute, sep } from 'node:path';
import { preparePacket, readPacket, evaluateRows, evaluatePacket, makeBlindReview, seededShuffle, RESULTS_VERSION } from '../tools/learning-blind/evaluation.mjs';

const providers = Object.fromEntries(['alpha', 'beta', 'gamma'].map(name => [name, { model: `mock-${name}`, inputPerMillion: 2, outputPerMillion: name === 'gamma' ? 0 : 10, maxOutputTokens: name === 'gamma' ? null : 20 }]));
const bundle = () => ({ schemaVersion: 'learning-blind-test-fixture-1', evaluationSplit: 'development-only', sourceFiles: [], cases: [0, 1].map(stage => ({
  id: `test-stage-${stage}`, groupId: 'synthetic-learner', stage, label: `개발 시험 ${stage}`, input: { context: { audioAvailable: false }, observations: [
    { id: 'reading-history', kind: 'language-item-summary', skillId: 'read', difficulty: 1, responseFormat: 'choice', independentIncorrect: 3 },
    { id: 'listen-history', kind: 'language-item-summary', skillId: 'listen', difficulty: 1, responseFormat: 'choice', independentCorrect: 4 },
  ], candidates: [
    { id: 'read-next', label: '안내문 읽기', skillId: 'read', difficulty: 1, responseFormat: 'choice', modality: 'reading' },
    { id: 'listen-next', label: '나레이션 듣기', skillId: 'listen', difficulty: 1, responseFormat: 'choice', modality: 'listening', audioRequired: true },
  ] }, baseline: { candidateId: 'read-next', evidenceId: 'reading-history' }, rubric: { acceptableCandidateIds: ['read-next'], forbiddenCandidateIds: ['listen-next'], note: 'private rubric note' },
})) });
const buildRequest = (provider, input, orders) => ({ model: providers[provider].model, state: input, criteria: Object.fromEntries(orders.candidateOrder.map(id => [id, id])), evidence: orders.evidenceOrder });
const normalizeResponse = (_provider, body) => { if (body.bad) throw new Error('private normalization failure: mock-alpha'); return { ...body, status: 'completed', model: 'private-model-marker', confidence: 0.91, usage: { inputTokens: 20, outputTokens: 8 } }; };
async function directory(t) {
  const base = resolve(tmpdir()), dir = await mkdtemp(join(base, 'synk-learning-blind-test-'));
  t.after(async () => { const rel = relative(base, resolve(dir)); assert.ok(rel && !rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel) && rel.startsWith('synk-learning-blind-test-')); await rm(dir, { recursive: true, force: true }); });
  return dir;
}
async function prepared(t, extra = {}) { const dir = await directory(t); return { dir, ...await preparePacket({ outDir: join(dir, 'packet'), caseBundle: bundle(), providers, buildRequest, preparedAt: '2026-10-06T00:00:00Z', ...extra }) }; }
const resultsFor = (manifest, select = () => ({ candidateId: 'read-next', evidenceId: 'reading-history' })) => ({ schemaVersion: RESULTS_VERSION, packetSha256: manifest.packetSha256,
  rows: manifest.requests.map(row => ({ caseId: row.caseId, trial: row.trial, provider: row.provider, requestSha256: row.requestSha256, status: 'completed', body: select(row) })) });

test('export preserves exact permutations, contains no rubric/baseline and produces only not_run templates', async t => {
  const f = await prepared(t); assert.equal(f.manifest.recordCount, 12);
  const packet = await readPacket(f.outDir); assert.equal(packet.bundle.cases.length, 2);
  const template = JSON.parse(await readFile(join(f.outDir, 'results-template.json'), 'utf8'));
  assert.ok(template.rows.every(row => row.status === 'not_run' && row.body === undefined));
  for (const row of f.manifest.requests) {
    const body = JSON.parse(await readFile(join(f.outDir, row.path), 'utf8'));
    assert.deepEqual(Object.keys(body.criteria), row.candidateOrder);
    assert.doesNotMatch(JSON.stringify(body), /private rubric note|acceptableCandidateIds|forbiddenCandidateIds|baseline|rubric/);
    const other = f.manifest.requests.find(x => x.caseId === row.caseId && x.provider === row.provider && x.trial !== row.trial);
    assert.deepEqual(row.candidateOrder, [...other.candidateOrder].reverse());
    assert.deepEqual(row.evidenceOrder, [...other.evidenceOrder].reverse());
  }
  assert.equal(f.costEstimate.actualUsage, null); assert.equal(f.costEstimate.actualBilling, null);
  assert.ok(f.costEstimate.estimatedTotalUSD > 0); assert.match(f.costEstimate.limitation, /not.*billing guarantee/);
});

test('deterministic seed and input yield identical request hashes and card mappings', async t => {
  const a = await prepared(t), b = await prepared(t);
  assert.deepEqual(a.manifest.requests.map(row => row.requestSha256), b.manifest.requests.map(row => row.requestSha256));
  assert.deepEqual(seededShuffle([1, 2, 3, 4, 5], 'same'), seededShuffle([1, 2, 3, 4, 5], 'same'));
  const evaluation = evaluateRows({ manifest: a.manifest, bundle: bundle(), results: resultsFor(a.manifest), providers, normalizeResponse });
  assert.deepEqual(makeBlindReview({ manifest: a.manifest, bundle: bundle(), evaluation }), makeBlindReview({ manifest: a.manifest, bundle: bundle(), evaluation }));
});

test('private evaluation fields and empty candidates fail before creating any packet', async t => {
  const dir = await directory(t), privateBundle = bundle(); privateBundle.cases[0].input.rubric = { expected: 'read-next' };
  await assert.rejects(preparePacket({ outDir: join(dir, 'bad'), caseBundle: privateBundle, providers, buildRequest }), /fixed candidates|private evaluation/);
  const nested = bundle(); nested.cases[0].input.context.expectedCandidateId = 'read-next';
  await assert.rejects(preparePacket({ outDir: join(dir, 'bad2'), caseBundle: nested, providers, buildRequest }), /private evaluation/);
  const empty = bundle(); empty.cases[0].input.candidates = [];
  await assert.rejects(preparePacket({ outDir: join(dir, 'empty'), caseBundle: empty, providers, buildRequest }), /nonempty/);
  await assert.rejects(readFile(join(dir, 'empty', 'manifest.json')), /ENOENT/);
});

test('duplicate, unexpected and mismatched-hash responses are not silently accepted', async t => {
  const f = await prepared(t), call = results => evaluateRows({ manifest: f.manifest, bundle: bundle(), results, providers, normalizeResponse });
  const duplicate = resultsFor(f.manifest); duplicate.rows.push(duplicate.rows[0]); assert.throws(() => call(duplicate), /duplicate/);
  const foreign = resultsFor(f.manifest); foreign.rows[0].caseId = 'foreign-case'; assert.throws(() => call(foreign), /unexpected/);
  const hash = resultsFor(f.manifest); hash.rows[0].requestSha256 = '0'.repeat(64); assert.throws(() => call(hash), /hash mismatch/);
  const packet = resultsFor(f.manifest); packet.packetSha256 = '0'.repeat(64); assert.throws(() => call(packet), /another packet/);
  const field = resultsFor(f.manifest); field.rows[0].estimatedGrade = 4; assert.throws(() => call(field), /unexpected result field/);
  const changed = { ...providers, alpha: { ...providers.alpha, model: 'changed-model' } };
  assert.throws(() => evaluateRows({ manifest: f.manifest, bundle: bundle(), results: resultsFor(f.manifest), providers: changed, normalizeResponse }), /model changed/);
});

test('no outputs and template placeholders remain not_run, never success or synthetic completions', async t => {
  const f = await prepared(t), results = { schemaVersion: RESULTS_VERSION, packetSha256: f.manifest.packetSha256, rows: [] };
  const evaluated = evaluateRows({ manifest: f.manifest, bundle: bundle(), results, providers, normalizeResponse });
  assert.equal(evaluated.summary.denominator, 12); assert.equal(evaluated.summary.notRun, 12); assert.equal(evaluated.summary.completed, 0);
  assert.equal(evaluated.summary.contractPassRateCompleted, null); assert.equal(evaluated.summary.teachingQuality, null); assert.equal(evaluated.summary.modelWinner, null);
  assert.equal(evaluated.summary.knownUsageCostEstimateUSD, null);
  const blind = makeBlindReview({ manifest: f.manifest, bundle: bundle(), evaluation: evaluated });
  assert.equal(blind.review.cases.length, 0); assert.match(blind.markdown, /비교 카드를 만들지/);
  const template = JSON.parse(await readFile(join(f.outDir, 'results-template.json'), 'utf8'));
  assert.equal(evaluateRows({ manifest: f.manifest, bundle: bundle(), results: template, providers, normalizeResponse }).summary.notRun, 12);
});

test('partial results label their subset and failures stay in the complete expected denominator', async t => {
  const f = await prepared(t), results = resultsFor(f.manifest); results.rows = results.rows.slice(0, 2);
  results.rows[1] = { ...results.rows[1], status: 'failed', error: { message: 'RAW_FAILURE provider-beta private-model-marker' } }; delete results.rows[1].body;
  const evaluated = evaluateRows({ manifest: f.manifest, bundle: bundle(), results, providers, normalizeResponse });
  assert.equal(evaluated.summary.denominator, 12); assert.equal(evaluated.summary.notRun, 10); assert.equal(evaluated.summary.failed, 1); assert.equal(evaluated.summary.completed, 1);
  assert.equal(evaluated.summary.contractPassRateAllExpected, 1 / 12);
  const blind = makeBlindReview({ manifest: f.manifest, bundle: bundle(), evaluation: evaluated });
  assert.equal(blind.review.reviewScope, 'completed-subset'); assert.equal(blind.review.cases[0].comparisonScope, 'completed-subset'); assert.equal(blind.review.cases[0].cards.length, 2);
  assert.doesNotMatch(JSON.stringify(blind.review) + blind.markdown, /RAW_FAILURE|provider-beta|private-model-marker|confidence|usage|alpha|beta|gamma/);
});

test('unknown IDs, unavailable audio and authored criteria are reported separately from policy agreement', async t => {
  const f = await prepared(t), results = resultsFor(f.manifest, row => row.provider === 'alpha' ? { candidateId: 'outside-secret-alpha', evidenceId: 'outside' }
    : row.provider === 'beta' ? { candidateId: 'listen-next', evidenceId: 'listen-history' } : { candidateId: 'read-next', evidenceId: 'none' });
  const evaluated = evaluateRows({ manifest: f.manifest, bundle: bundle(), results, providers, normalizeResponse });
  assert.equal(evaluated.summary.completed, 12); assert.equal(evaluated.summary.contractPassed, 4); assert.equal(evaluated.summary.policyAgreementCount, 0);
  assert.ok(evaluated.rows.find(row => row.provider === 'alpha').reasons.includes('candidate-outside-vocabulary'));
  assert.ok(evaluated.rows.find(row => row.provider === 'beta').reasons.includes('audio-not-available'));
  assert.equal(evaluated.rows.find(row => row.provider === 'gamma').authoredCriterion, 'acceptable');
  assert.equal(evaluated.rows.find(row => row.provider === 'gamma').teachingQuality, null);
  const blind = makeBlindReview({ manifest: f.manifest, bundle: bundle(), evaluation: evaluated });
  assert.doesNotMatch(JSON.stringify(blind.review), /outside-secret-alpha|private-model-marker|confidence|usage/);
  assert.ok(blind.review.cases.flatMap(c => c.cards).some(card => card.candidateLabel === '허용 목록 밖 선택'));
});

test('normalization failures never become empty successful answers or leak raw provider errors to blind review', async t => {
  const f = await prepared(t), results = resultsFor(f.manifest, () => ({ bad: true }));
  const evaluated = evaluateRows({ manifest: f.manifest, bundle: bundle(), results, providers, normalizeResponse });
  assert.equal(evaluated.summary.failed, 12); assert.equal(evaluated.summary.completed, 0); assert.equal(evaluated.summary.rowsWithUnknownUsageOrBilling, 12);
  assert.equal(makeBlindReview({ manifest: f.manifest, bundle: bundle(), evaluation: evaluated }).review.cases.length, 0);
  const malformed = resultsFor(f.manifest); malformed.rows[0].status = 'not_run'; assert.throws(() => evaluateRows({ manifest: f.manifest, bundle: bundle(), results: malformed, providers, normalizeResponse }), /not_run cannot/);
});

test('authored recommendation judgments do not become input/output contract failures', async t => {
  const c = bundle(); c.cases[0].rubric = { acceptableCandidateIds: [], forbiddenCandidateIds: ['read-next'], note: 'A semantic teaching judgment only' };
  const f = await prepared(t, { caseBundle: c });
  const evaluated = evaluateRows({ manifest: f.manifest, bundle: c, results: resultsFor(f.manifest), providers, normalizeResponse });
  const row = evaluated.rows.find(item => item.caseId === c.cases[0].id);
  assert.equal(row.contractPassed, true); assert.deepEqual(row.reasons, []);
  assert.equal(row.authoredCriterion, 'unacceptable'); assert.equal(row.policyAgreement.both, true);
  assert.equal(row.teachingQuality, null);
});

test('frozen saved requests and case snapshots are verified before reading results', async t => {
  const f = await prepared(t), path = join(f.outDir, f.manifest.requests[0].path);
  await writeFile(path, '{}\n'); await assert.rejects(readPacket(f.outDir), /saved request hash mismatch/);
  const g = await prepared(t); await writeFile(join(g.outDir, 'private/cases.json'), '{}\n'); await assert.rejects(readPacket(g.outDir), /case snapshot hash mismatch/);
});

test('preparing and evaluating refuse existing output directories and preserve their contents', async t => {
  const f = await prepared(t), old = await readFile(join(f.outDir, 'manifest.json'), 'utf8');
  await assert.rejects(preparePacket({ outDir: f.outDir, caseBundle: bundle(), providers, buildRequest }), /already exists/);
  assert.equal(await readFile(join(f.outDir, 'manifest.json'), 'utf8'), old);
  const resultsPath = join(f.dir, 'saved-mock-results.json'); await writeFile(resultsPath, JSON.stringify(resultsFor(f.manifest)));
  const first = await evaluatePacket({ packetDir: f.outDir, resultsPath, outDir: join(f.dir, 'review'), providers, normalizeResponse });
  assert.equal(first.summary.completed, 12);
  await assert.rejects(evaluatePacket({ packetDir: f.outDir, resultsPath, outDir: first.outDir, providers, normalizeResponse }), /already exists/);
  const publicReview = await readFile(join(first.outDir, 'blind-review.json'), 'utf8');
  assert.doesNotMatch(publicReview, /private-model-marker|confidence|usage|alpha|beta|gamma/);
  assert.ok((await readFile(join(first.outDir, 'private/reveal.json'), 'utf8')).includes('alpha'));
});

test('this offline module and CLI contain no provider transport or environment access', async () => {
  for (const path of ['../tools/learning-blind/evaluation.mjs', '../tools/learning-blind-test.mjs']) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\bfetch\s*\(|process\s*\.\s*env|node:https|node:http/);
  }
});
