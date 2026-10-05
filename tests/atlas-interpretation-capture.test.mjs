// Transport-only fixtures: no heldout sentences/answers are sent, scored or printed.
// Every HTTP response is an injected mock; no provider credentials are read.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { captureEvaluation, createEvaluationPlan, main } from '../tools/capture-atlas-interpretation-evaluation.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const FREEZE = path.join(ROOT, 'docs/_ops/qa/atlas-model-20261005/freeze.json');
const DATASET = path.join(ROOT, 'tests/fixtures/atlas-interpretation-heldout-v1.json');
const SEAL = path.join(ROOT, 'tests/fixtures/atlas-interpretation-heldout-v1.manifest.json');
const digest = value => createHash('sha256').update(value).digest('hex');
const json = async filename => JSON.parse(await fs.readFile(filename, 'utf8'));
const save = (filename, value) => fs.writeFile(filename, JSON.stringify(value, null, 2) + '\n');
const fixtureEnv = Object.freeze({ SYNK_COMPUTER_EVALUATION_APPROVED: '1', SYNK_COMPUTER_EVALUATION_ORIGIN: 'http://127.0.0.1:4191',
  SYNK_COMPUTER_EVALUATION_SESSION_COOKIE: 'fixture-cookie-never-print', SYNK_COMPUTER_EVALUATION_CSRF: 'fixture-csrf-never-print' });
const reply = (value, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(value) });
const forbiddenFetch = async () => { assert.fail('A rejected/offline operation must never request HTTP.'); };
let originalFreeze, originalDataset, originalSeal, originals;

before(async () => {
  originalFreeze = await json(FREEZE); originalDataset = await json(DATASET); originalSeal = await json(SEAL);
  originals = await Promise.all([FREEZE, DATASET, SEAL, ...originalFreeze.artifacts.map(row => path.join(ROOT, row.path))]
    .map(async filename => ({ filename, sha256: digest(await fs.readFile(filename)) })));
  for (const artifact of originalFreeze.artifacts) assert.equal(digest(await fs.readFile(path.join(ROOT, artifact.path))), artifact.sha256, 'The test starts from unchanged frozen code.');
});
after(async () => {
  for (const original of originals) assert.equal(digest(await fs.readFile(original.filename)), original.sha256, 'A source or frozen manifest changed during transport tests.');
});

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-interpretation-capture-test-'));
  t.after(async () => {
    const target = await fs.realpath(directory);
    assert.ok(target.startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert.ok(path.basename(target).startsWith('synk-interpretation-capture-test-'));
    await fs.rm(target, { recursive: true, force: true });
  });
  // Clone only the dataset structure/vocabulary, replacing all heldout material.
  // This is NOT an interpretation benchmark and must never be scored as one.
  const dataset = { ...structuredClone(originalDataset), description: 'Transport mock fixture only.', cases: Array.from({ length: 30 }, (_, index) => ({
    id: `transport-${index + 1}`, tags: ['transport-only'],
    source: { id: `transport-source-${index + 1}`, text: `전송 형식 시험용 입력 ${index + 1}: 🧪`, at: originalSeal.frozenAt, actor: 'self' },
    expected: { facts: { owned: 'have' }, permittedFacts: {}, unknownFields: [], mustNotAssert: [] }, rationale: 'Never sent or scored; transport assertion only.',
  })) };
  const datasetPath = path.join(directory, 'dataset.json'); await save(datasetPath, dataset);
  const sha256 = digest(await fs.readFile(datasetPath));
  const seal = structuredClone(originalSeal); seal.dataset.sha256 = sha256;
  seal.dataset.path = datasetPath; seal.dataset.bytes = (await fs.stat(datasetPath)).size;
  const datasetManifest = path.join(directory, 'dataset.manifest.json'); await save(datasetManifest, seal);
  const freeze = structuredClone(originalFreeze); freeze.dataset.sha256 = sha256;
  const freezeManifest = path.join(directory, 'freeze.json'); await save(freezeManifest, freeze);
  const outputDir = path.join(directory, 'outputs');
  const options = { dataset: datasetPath, datasetManifest, freezeManifest, outputDir, maxCalls: 30 };
  const artifacts = freeze.artifacts.filter(row => row.path !== 'atlas/temper-interpretation.js')
    .map(row => ({ path: row.path, sha256: row.sha256 })).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const buildProof = { version: 1, buildId: digest(JSON.stringify(artifacts)), startedAt: '2026-10-05T00:00:00.000Z', runtimeAttested: true, artifacts };
  const availability = { available: true, providerLabel: freeze.model.provider, modelLabel: 'Human-readable label', model: freeze.model.id, maxOutputTokens: freeze.model.maxOutputTokens, buildProof };
  return { directory, dataset, freeze, options, availability, outputDir,
    ledger: () => json(path.join(outputDir, 'request-manifest.json')), outputs: () => json(path.join(outputDir, 'outputs.json')),
    errors: () => json(path.join(outputDir, 'errors.json')) };
}
const dependencies = fetchImpl => ({ env: fixtureEnv, fetchImpl });
function successfulHost(f, onPost = () => {}) {
  return async (_url, request) => {
    if (request.method === 'GET') return reply(f.availability);
    const body = JSON.parse(request.body); await onPost(body, request);
    return reply({ requestId: body.requestId, revision: body.revision, proposals: [], held: [], extractor: 'transport-mock', buildId: f.availability.buildProof.buildId });
  };
}

test('offline/default plans reveal lengths and hashes without source text or authored answers', async t => {
  const f = await fixture(t), { maxCalls, ...options } = f.options;
  const report = await createEvaluationPlan(options);
  assert.equal(report.mode, 'plan'); assert.equal(report.counts.cases, 30); assert.equal(report.freezeVerified, true);
  assert.equal(report.networkCalls, 0); assert.equal(report.modelCalls, 0);
  for (const row of report.sources) assert.deepEqual(Object.keys(row).sort(), ['index', 'sourceSha256', 'utf16Length', 'utf8Bytes']);
  assert.equal(JSON.stringify(report).includes(f.dataset.cases[0].source.text), false);
  assert.equal(JSON.stringify(report).includes('permittedFacts'), false);
  const result = await main(['--dataset', options.dataset, '--dataset-manifest', options.datasetManifest], dependencies(forbiddenFetch));
  assert.equal(result.mode, 'plan'); assert.equal(result.freezeVerified, false);
});

test('capture requires explicit approval before any HTTP request', async t => {
  const f = await fixture(t);
  for (const value of [undefined, '0', 'true']) await assert.rejects(captureEvaluation(f.options, {
    env: { ...fixtureEnv, SYNK_COMPUTER_EVALUATION_APPROVED: value }, fetchImpl: forbiddenFetch,
  }), /CAPTURE_EXPLICIT_APPROVAL_REQUIRED/);
});

test('only the explicit loopback origin and safe authentication header values are accepted', async t => {
  const f = await fixture(t);
  for (const origin of ['https://example.test', 'http://localhost:4191', 'http://127.0.0.1:4191/path', 'http://secret@127.0.0.1:4191']) {
    await assert.rejects(captureEvaluation(f.options, { env: { ...fixtureEnv, SYNK_COMPUTER_EVALUATION_ORIGIN: origin }, fetchImpl: forbiddenFetch }), /LOOPBACK/);
  }
  for (const patch of [{ SYNK_COMPUTER_EVALUATION_SESSION_COOKIE: '' }, { SYNK_COMPUTER_EVALUATION_CSRF: 'bad\r\nheader' }]) {
    await assert.rejects(captureEvaluation(f.options, { env: { ...fixtureEnv, ...patch }, fetchImpl: forbiddenFetch }), /HOST_AUTHENTICATION_REQUIRED/);
  }
});

test('capture requires a freeze manifest and an unchanged dataset seal', async t => {
  const f = await fixture(t), { freezeManifest, ...withoutFreeze } = f.options;
  await assert.rejects(captureEvaluation(withoutFreeze, dependencies(forbiddenFetch)), /FREEZE_MANIFEST_REQUIRED/);
  const seal = await json(f.options.datasetManifest); seal.dataset.sha256 = '0'.repeat(64); await save(f.options.datasetManifest, seal);
  await assert.rejects(captureEvaluation(f.options, dependencies(forbiddenFetch)), /DATASET_SEAL_MISMATCH/);
});

test('all six frozen artifact hashes are independently checked using temporary manifest mutations', async t => {
  const f = await fixture(t);
  assert.equal(f.freeze.artifacts.length, 6);
  for (let index = 0; index < f.freeze.artifacts.length; index++) {
    const changed = structuredClone(f.freeze); changed.artifacts[index].sha256 = '0'.repeat(64);
    await save(f.options.freezeManifest, changed);
    await assert.rejects(captureEvaluation(f.options, dependencies(forbiddenFetch)), /FROZEN_ARTIFACT_CHANGED/);
  }
  await save(f.options.freezeManifest, f.freeze);
  const plan = await createEvaluationPlan(f.options); assert.equal(plan.freezeVerified, true);
});

test('the output directory and an explicit 1 through 30 call budget are required', async t => {
  const f = await fixture(t);
  for (const maxCalls of [undefined, 0, 31, 1.5]) await assert.rejects(captureEvaluation({ ...f.options, maxCalls }, dependencies(forbiddenFetch)), /MAX_CALLS_REQUIRED/);
  await assert.rejects(captureEvaluation({ ...f.options, outputDir: undefined }, dependencies(forbiddenFetch)), /MAX_CALLS_REQUIRED/);
});

test('unavailable hosts or differing model IDs/output ceilings cannot dispatch a POST', async t => {
  const f = await fixture(t);
  for (const [patch, code] of [[{ available: false }, /HOST_MODEL_UNAVAILABLE/], [{ model: 'different-model' }, /HOST_MODEL_DIFFERS_FROM_FREEZE/],
    [{ maxOutputTokens: f.availability.maxOutputTokens - 1 }, /HOST_MODEL_DIFFERS_FROM_FREEZE/]]) {
    const host = async (_url, request) => { assert.equal(request.method, 'GET'); return reply({ ...f.availability, ...patch }); };
    await assert.rejects(captureEvaluation(f.options, dependencies(host)), code);
  }
});

test('all UUIDs are persisted before the first POST and only whitelisted source fields are sent', async t => {
  const f = await fixture(t); let posts = 0;
  const host = successfulHost(f, async (body, request) => {
    posts++;
    assert.deepEqual(Object.keys(body).sort(), ['expectedBuildId', 'id', 'requestId', 'revision', 'sourceId', 'text']);
    assert.equal(body.expectedBuildId, f.availability.buildProof.buildId);
    assert.equal(Object.hasOwn(body, 'expected'), false); assert.equal(Object.hasOwn(body, 'catalog'), false);
    assert.equal(request.headers.Cookie, fixtureEnv.SYNK_COMPUTER_EVALUATION_SESSION_COOKIE);
    assert.equal(request.headers['X-CSRF-Token'], fixtureEnv.SYNK_COMPUTER_EVALUATION_CSRF);
    assert.equal(request.headers.Origin, fixtureEnv.SYNK_COMPUTER_EVALUATION_ORIGIN); assert.equal(request.redirect, 'error');
    const ledger = await f.ledger(); assert.equal(ledger.requests.length, 30);
    assert.equal(new Set(ledger.requests.map(row => row.id)).size, 30);
    assert.equal(ledger.requests[0].id, body.id); assert.equal(ledger.requests[0].status, 'dispatching');
    assert.equal(ledger.hostPromptSnapshotAttested, true); assert.equal(ledger.hostBuildId, f.availability.buildProof.buildId);
    assert.equal(ledger.hostStartedAt, f.availability.buildProof.startedAt); assert.equal(ledger.hostInvocations.length, 1);
  });
  const report = await captureEvaluation({ ...f.options, maxCalls: 1 }, dependencies(host));
  assert.equal(posts, 1); assert.equal(report.status, 'partial-limit'); assert.equal(report.counts.recordedRuns, 1);
});

test('a transport failure stops immediately, records an unknown missing run and never records the exception text', async t => {
  const f = await fixture(t); let posts = 0;
  const host = async (_url, request) => {
    if (request.method === 'GET') return reply(f.availability);
    posts++; throw Error(fixtureEnv.SYNK_COMPUTER_EVALUATION_SESSION_COOKIE);
  };
  const report = await captureEvaluation(f.options, dependencies(host)), errors = await f.errors();
  assert.equal(posts, 1); assert.equal(report.status, 'stopped'); assert.equal(report.counts.recordedRuns, 0);
  assert.equal(report.counts.missingRuns, 30); assert.equal(report.automaticRetries, 0);
  assert.equal(errors.entries[0].result, 'unknown'); assert.equal(errors.entries[0].runRecorded, false);
  assert.equal(JSON.stringify([report, errors]).includes(fixtureEnv.SYNK_COMPUTER_EVALUATION_SESSION_COOKIE), false);
});

test('an explicit later invocation reuses the same UUID while counting both dispatch attempts', async t => {
  const f = await fixture(t); let initialId;
  const first = async (_url, request) => {
    if (request.method === 'GET') return reply(f.availability);
    initialId = JSON.parse(request.body).id; return reply({ privateError: 'do not log this' }, 503);
  };
  await captureEvaluation(f.options, dependencies(first));
  const report = await captureEvaluation({ ...f.options, maxCalls: 1 }, dependencies(successfulHost(f, body => assert.equal(body.id, initialId))));
  assert.equal(report.counts.recordedRuns, 1); assert.equal(report.counts.lifetimePostAttempts, 2);
  assert.equal((await f.ledger()).requests[0].attempts, 2); assert.equal((await f.outputs()).runs.length, 1);
  assert.equal(JSON.stringify(await f.errors()).includes('privateError'), false);
});

test('thirty successful mock calls exhaust the lifetime limit and completed reruns send no POST', async t => {
  const f = await fixture(t); let posts = 0;
  const host = successfulHost(f, () => posts++);
  const first = await captureEvaluation(f.options, dependencies(host));
  assert.equal(first.status, 'complete'); assert.equal(posts, 30); assert.equal(first.counts.lifetimePostAttempts, 30);
  const second = await captureEvaluation(f.options, dependencies(host));
  assert.equal(second.status, 'complete'); assert.equal(second.counts.postsThisInvocation, 0); assert.equal(posts, 30);
  assert.equal((await f.outputs()).backend.kind, 'model'); assert.equal((await f.outputs()).mode, 'extractor-output');
});

test('persisted output recovers a crash between output and ledger writes; changed capture identity is rejected', async t => {
  const f = await fixture(t);
  await captureEvaluation({ ...f.options, maxCalls: 1 }, dependencies(successfulHost(f)));
  const ledger = await f.ledger(); ledger.requests[0].status = 'dispatching';
  await save(path.join(f.outputDir, 'request-manifest.json'), ledger);
  const recovery = successfulHost(f, body => assert.equal(body.requestId, 'evaluation-2'));
  const report = await captureEvaluation({ ...f.options, maxCalls: 1 }, dependencies(recovery));
  assert.equal(report.counts.recordedRuns, 2); assert.equal(report.counts.lifetimePostAttempts, 2);
  const changed = await f.ledger(); changed.freezeManifestSha256 = '0'.repeat(64);
  await save(path.join(f.outputDir, 'request-manifest.json'), changed);
  const noPost = async (_url, request) => { assert.equal(request.method, 'GET'); return reply(f.availability); };
  await assert.rejects(captureEvaluation(f.options, dependencies(noPost)), /CAPTURE_IDENTITY_CHANGED/);
});

test('mismatched/invalid responses remain missing, while malformed returned proposals remain scoreable failures', async t => {
  const f = await fixture(t);
  const mismatch = async (_url, request) => request.method === 'GET' ? reply(f.availability) : reply({ requestId: 'wrong', revision: 1, proposals: [] });
  const failed = await captureEvaluation(f.options, dependencies(mismatch));
  assert.equal(failed.counts.recordedRuns, 0); assert.equal(failed.stopCategory, 'HOST_RESPONSE_IDENTITY_MISMATCH');
  const malformed = async (_url, request) => {
    if (request.method === 'GET') return reply(f.availability);
    const body = JSON.parse(request.body); return reply({ requestId: body.requestId, revision: body.revision, proposals: 'not-an-array', buildId: f.availability.buildProof.buildId });
  };
  const captured = await captureEvaluation({ ...f.options, maxCalls: 1 }, dependencies(malformed));
  assert.equal(captured.counts.recordedRuns, 1); assert.equal((await f.outputs()).runs[0].output.proposals, 'not-an-array');
});

test('legacy or incomplete runtime proofs cannot dispatch any POST', async t => {
  const f = await fixture(t);
  for (const proof of [undefined, null, { ...f.availability.buildProof, runtimeAttested: false },
    { ...f.availability.buildProof, startedAt: 'yesterday' }, { ...f.availability.buildProof, artifacts: [] }]) {
    let posts = 0;
    const host = async (_url, request) => { if (request.method === 'POST') posts++; return reply({ ...f.availability, buildProof: proof }); };
    await assert.rejects(captureEvaluation(f.options, dependencies(host)), /HOST_RUNTIME_PROOF_REQUIRED/);
    assert.equal(posts, 0);
  }
});

test('each stale loaded module and malformed build identity is rejected before dispatch', async t => {
  const f = await fixture(t);
  const proofs = [];
  for (let index = 0; index < 5; index++) {
    const proof = structuredClone(f.availability.buildProof); proof.artifacts[index].sha256 = '0'.repeat(64);
    proof.buildId = digest(JSON.stringify(proof.artifacts)); proofs.push(proof);
  }
  proofs.push({ ...f.availability.buildProof, buildId: '0'.repeat(64) });
  const reordered = structuredClone(f.availability.buildProof); reordered.artifacts.reverse(); reordered.buildId = digest(JSON.stringify(reordered.artifacts)); proofs.push(reordered);
  for (const proof of proofs) {
    let posts = 0;
    const host = async (_url, request) => { if (request.method === 'POST') posts++; return reply({ ...f.availability, buildProof: proof }); };
    await assert.rejects(captureEvaluation(f.options, dependencies(host)), /HOST_RUNTIME_(?:DIFFERS_FROM_FREEZE|BUILD_ID_INVALID)/);
    assert.equal(posts, 0);
  }
});

test('a different response build or legacy missing build stops after one dispatch without saving a run', async t => {
  const f = await fixture(t);
  for (const buildId of [undefined, '0'.repeat(64)]) {
    const outputDir = path.join(f.directory, buildId ? 'wrong-response' : 'legacy-response'); let posts = 0;
    const host = async (_url, request) => {
      if (request.method === 'GET') return reply(f.availability);
      posts++; const body = JSON.parse(request.body); assert.equal(body.expectedBuildId, f.availability.buildProof.buildId);
      return reply({ requestId: body.requestId, revision: body.revision, proposals: [], ...(buildId ? { buildId } : {}) });
    };
    const result = await captureEvaluation({ ...f.options, outputDir }, dependencies(host));
    assert.equal(posts, 1); assert.equal(result.status, 'stopped'); assert.equal(result.stopCategory, 'HOST_RESPONSE_BUILD_MISMATCH');
    assert.equal(result.counts.recordedRuns, 0); assert.equal((await json(path.join(outputDir, 'outputs.json'))).runs.length, 0);
  }
});

test('the same loaded build may restart while preserving the first start and every invocation timestamp', async t => {
  const f = await fixture(t); const initialStartedAt = f.availability.buildProof.startedAt;
  await captureEvaluation({ ...f.options, maxCalls: 1 }, dependencies(successfulHost(f)));
  const before = await f.ledger(), nextId = before.requests[1].id;
  f.availability.buildProof.startedAt = '2026-10-06T00:00:00.000Z';
  await captureEvaluation({ ...f.options, maxCalls: 1 }, dependencies(successfulHost(f, body => assert.equal(body.id, nextId))));
  const ledger = await f.ledger();
  assert.equal(ledger.hostStartedAt, initialStartedAt); assert.equal(ledger.hostInvocations.length, 2);
  assert.deepEqual(ledger.hostInvocations.map(row => row.hostStartedAt), [initialStartedAt, f.availability.buildProof.startedAt]);
  assert.ok(ledger.hostInvocations.every(row => row.hostBuildId === f.availability.buildProof.buildId));
  assert.equal(ledger.requests[1].lastHostStartedAt, f.availability.buildProof.startedAt);
});

test('an unproved legacy capture or a changed recorded build cannot be resumed under a proved host', async t => {
  const f = await fixture(t);
  await captureEvaluation({ ...f.options, maxCalls: 1 }, dependencies(successfulHost(f)));
  const base = await f.ledger();
  for (const mutate of [row => { row.hostPromptSnapshotAttested = false; }, row => { delete row.hostPromptSnapshotAttested; },
    row => { row.hostBuildId = '0'.repeat(64); }, row => { delete row.hostInvocations; }]) {
    const changed = structuredClone(base); mutate(changed); await save(path.join(f.outputDir, 'request-manifest.json'), changed);
    let posts = 0;
    const host = async (_url, request) => { if (request.method === 'POST') posts++; return reply(f.availability); };
    await assert.rejects(captureEvaluation(f.options, dependencies(host)), /CAPTURE_RUNTIME_ATTESTATION_CHANGED/);
    assert.equal(posts, 0);
  }
});
