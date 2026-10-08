#!/usr/bin/env node
// Narrow capture client for the frozen 30-case computer interpretation evaluation.
// Default is an offline plan. This file does not call a model/provider directly.
// Expected answers stay local and NEVER enter an HTTP request.
import { readFile, writeFile, mkdir, open, rename, unlink } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import Temper from '../atlas/temper-interpretation.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DEFAULT_DATASET = resolve(ROOT, 'tests/fixtures/atlas-interpretation-heldout-v1.json');
const DEFAULT_SEAL = resolve(ROOT, 'tests/fixtures/atlas-interpretation-heldout-v1.manifest.json');
const VERSION = 1, LIMIT = 30;
const REQUIRED_ARTIFACTS = [
  'experiences/atlas-lab/model-extraction.mjs', 'experiences/atlas-lab/interpretation.mjs',
  'docs/마케팅/맞춤도구/computer/content.js', 'atlas/interpretation.js', 'atlas/domain.js', 'atlas/temper-interpretation.js',
];
const RUNTIME_ARTIFACTS = REQUIRED_ARTIFACTS.filter(path => path !== 'atlas/temper-interpretation.js');
const USAGE = `Offline default:
  node tools/capture-atlas-interpretation-evaluation.mjs --plan [--output-dir DIR] [--freeze-manifest FILE]
Approved capture through the authenticated LOCAL company host only:
  node tools/capture-atlas-interpretation-evaluation.mjs --capture --max-calls N --output-dir DIR --freeze-manifest FILE
Optional --dataset FILE and --dataset-manifest FILE must still identify the frozen 30-case dataset.
Capture environment: SYNK_COMPUTER_EVALUATION_APPROVED=1,
 SYNK_COMPUTER_EVALUATION_ORIGIN=http://127.0.0.1:PORT,
 SYNK_COMPUTER_EVALUATION_SESSION_COOKIE and SYNK_COMPUTER_EVALUATION_CSRF.
No automatic retries. A later explicit capture invocation reuses saved request UUIDs.
Only an authenticated host receipt binding this request and frozen build can close an invalid result.
Such failures remain failed evaluation runs; pending/uncertain or unproved replies stop capture.
Capture requires proof of the five actually loaded host modules, matching the frozen build on every request and response.
Old capture directories without runtime attestation cannot be resumed.
At most 30 POST attempts over this output directory's lifetime; --max-calls also limits this invocation.
No expected answers, source text, authentication headers or remote error messages are printed.
Score outputs.json separately with tools/evaluate-atlas-interpretation.mjs and the heldout --dataset.`;

class CaptureError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = code => { throw new CaptureError(code); };
const hash = value => createHash('sha256').update(value).digest('hex');
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const token = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,100}$/.test(value);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);
const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const isoTime = value => validTime(value) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const now = () => new Date().toISOString();
const safeCode = error => error instanceof CaptureError ? error.code : 'CAPTURE_LOCAL_IO_OR_VALIDATION_FAILURE';

async function readJSON(path, optional = false) {
  let bytes;
  try { bytes = await readFile(path); }
  catch (error) { if (optional && error.code === 'ENOENT') return null; throw error; }
  if (bytes.length > 10000000) fail('INPUT_TOO_LARGE');
  let value;
  try { value = JSON.parse(bytes.toString('utf8')); } catch { fail('INVALID_LOCAL_JSON'); }
  return { value, sha256: hash(bytes) };
}
async function atomicJSON(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
  await rename(temporary, path);
}
function artifactPath(path) {
  if (typeof path !== 'string' || isAbsolute(path)) fail('INVALID_FROZEN_ARTIFACT_PATH');
  const full = resolve(ROOT, path), local = relative(ROOT, full);
  if (local === '..' || local.startsWith('..\\') || local.startsWith('../') || isAbsolute(local)) fail('INVALID_FROZEN_ARTIFACT_PATH');
  return full;
}
async function loadDataset(options) {
  const datasetPath = resolve(options.dataset || DEFAULT_DATASET), sealPath = resolve(options.datasetManifest || DEFAULT_SEAL);
  const data = await readJSON(datasetPath), seal = await readJSON(sealPath);
  Temper.validateDataset(data.value);
  if (data.value.id !== 'computer-ko-heldout' || data.value.version !== '1' || data.value.cases.length !== LIMIT
    || seal.value.manifestVersion !== 1 || seal.value.dataset?.id !== data.value.id
    || seal.value.dataset?.version !== data.value.version || seal.value.dataset?.sha256 !== data.sha256
    || seal.value.dataset?.caseCount !== LIMIT || !validTime(seal.value.frozenAt)) fail('DATASET_SEAL_MISMATCH');
  return { ...data, datasetPath, sealPath, sealSha256: seal.sha256 };
}
async function verifyFreeze(path, dataset) {
  if (!path) fail('FREEZE_MANIFEST_REQUIRED');
  const frozen = await readJSON(resolve(path)), value = frozen.value;
  if (value.manifestVersion !== 1 || !validTime(value.frozenAt) || value.dataset?.id !== dataset.value.id
    || value.dataset?.version !== dataset.value.version || value.dataset?.sha256 !== dataset.sha256
    || value.model?.provider !== 'OpenAI' || !token(value.model?.id)
    || !Number.isInteger(value.model?.maxOutputTokens) || value.model.maxOutputTokens < 1 || value.model.maxOutputTokens > 3000
    || !Array.isArray(value.artifacts) || value.artifacts.length !== REQUIRED_ARTIFACTS.length) fail('INVALID_FREEZE_MANIFEST');
  const seen = new Set();
  for (const artifact of value.artifacts) {
    if (!plain(artifact) || !REQUIRED_ARTIFACTS.includes(artifact.path) || seen.has(artifact.path) || !digest(artifact.sha256)) fail('INVALID_FROZEN_ARTIFACT');
    seen.add(artifact.path);
    if (hash(await readFile(artifactPath(artifact.path))) !== artifact.sha256) fail('FROZEN_ARTIFACT_CHANGED');
  }
  return { ...frozen, path: resolve(path) };
}
const datasetReference = data => ({ id: data.value.id, version: data.value.version, sha256: data.sha256 });
const runtimeArtifacts = frozen => frozen.value.artifacts.filter(row => RUNTIME_ARTIFACTS.includes(row.path))
  .map(row => ({ path: row.path, sha256: row.sha256 })).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
function verifyHostProof(proof, frozen) {
  if (!plain(proof) || proof.version !== 1 || proof.runtimeAttested !== true || !digest(proof.buildId) || !isoTime(proof.startedAt)
    || !Array.isArray(proof.artifacts) || proof.artifacts.length !== RUNTIME_ARTIFACTS.length) fail('HOST_RUNTIME_PROOF_REQUIRED');
  const expected = runtimeArtifacts(frozen);
  for (let index = 0; index < expected.length; index++) {
    const actual = proof.artifacts[index];
    if (!plain(actual) || Object.keys(actual).length !== 2 || actual.path !== expected[index].path || actual.sha256 !== expected[index].sha256) fail('HOST_RUNTIME_DIFFERS_FROM_FREEZE');
  }
  // Canonical path/sha256 property order is part of the shared build-ID contract.
  if (proof.buildId !== hash(JSON.stringify(expected)) || proof.buildId !== hash(JSON.stringify(proof.artifacts))) fail('HOST_RUNTIME_BUILD_ID_INVALID');
  return { version: 1, buildId: proof.buildId, startedAt: proof.startedAt, runtimeAttested: true, artifacts: expected };
}
function requestBody(item, request, expectedBuildId) {
  // Deliberate whitelist: do not spread the authored case or source into the body.
  return { id: request.id, requestId: request.requestId, revision: request.revision, sourceId: item.source.id, text: item.source.text, expectedBuildId };
}
const TERMINAL_FAILURE = 'SYNK_COMPUTER_AI_RESPONSE_INVALID';
const failureOutput = () => ({ proposals: null });
function verifyFailureReceipt(receipt, request, buildId) {
  const fields = ['version', 'id', 'requestId', 'revision', 'buildId', 'status'];
  if (!plain(receipt) || Object.keys(receipt).length !== fields.length || !fields.every(key => Object.hasOwn(receipt, key))
    || receipt.version !== 1 || receipt.status !== 'invalid' || receipt.id !== request.id
    || receipt.requestId !== request.requestId || receipt.revision !== request.revision || receipt.buildId !== buildId) fail('HOST_FAILURE_RECEIPT_MISMATCH');
  return { version: 1, id: receipt.id, requestId: receipt.requestId, revision: receipt.revision, buildId: receipt.buildId, status: 'invalid' };
}
function recordFailure(errors, request, index) {
  if (!errors.entries.some(row => row.requestId === request.requestId && row.result === 'failed' && row.category === TERMINAL_FAILURE)) {
    errors.entries.push({ at: request.completedAt, index: index + 1, requestId: request.requestId,
      category: TERMINAL_FAILURE, result: 'failed', runRecorded: true, automaticRetry: false });
  }
}

export async function createEvaluationPlan(options = {}) {
  const data = await loadDataset(options);
  const frozen = options.freezeManifest ? await verifyFreeze(options.freezeManifest, data) : null;
  const lengths = data.value.cases.map((item, index) => ({ index: index + 1, utf16Length: item.source.text.length,
    utf8Bytes: Buffer.byteLength(item.source.text, 'utf8'), sourceSha256: hash(item.source.text) }));
  const bodyBytes = data.value.cases.map((item, index) => Buffer.byteLength(JSON.stringify(requestBody(item, {
    id: '00000000-0000-4000-8000-000000000000', requestId: `evaluation-${index + 1}`, revision: index + 1,
  }, frozen ? hash(JSON.stringify(runtimeArtifacts(frozen))) : '0'.repeat(64))), 'utf8'));
  const plan = { version: VERSION, mode: 'plan', at: now(), datasetSha256: data.sha256, datasetManifestSha256: data.sealSha256,
    freezeManifestSha256: frozen?.sha256 || null, freezeVerified: !!frozen, counts: { cases: lengths.length,
      totalSourceUtf16Length: lengths.reduce((n, row) => n + row.utf16Length, 0),
      maxSourceUtf16Length: Math.max(...lengths.map(row => row.utf16Length)),
      totalSourceUtf8Bytes: lengths.reduce((n, row) => n + row.utf8Bytes, 0),
      totalHostRequestBodyBytes: bodyBytes.reduce((a, b) => a + b, 0), maxHostRequestBodyBytes: Math.max(...bodyBytes),
      maxPostAttempts: LIMIT, totalMaximumOutputTokens: frozen ? LIMIT * frozen.value.model.maxOutputTokens : null },
    sources: lengths, networkCalls: 0, modelCalls: 0, expectedAnswersIncludedInRequests: false,
    pricingCalculated: false, providerInputTokenCountCalculated: false };
  if (options.outputDir) {
    const directory = resolve(options.outputDir); await mkdir(directory, { recursive: true });
    await atomicJSON(resolve(directory, 'plan.json'), plan);
  }
  return plan;
}

function authenticatedOrigin(env) {
  if (env.SYNK_COMPUTER_EVALUATION_APPROVED !== '1') fail('CAPTURE_EXPLICIT_APPROVAL_REQUIRED');
  let origin;
  try { origin = new URL(env.SYNK_COMPUTER_EVALUATION_ORIGIN); } catch { fail('LOOPBACK_ORIGIN_REQUIRED'); }
  if (origin.protocol !== 'http:' || origin.hostname !== '127.0.0.1' || !origin.port || origin.username || origin.password
    || origin.pathname !== '/' || origin.search || origin.hash) fail('LOOPBACK_ORIGIN_REQUIRED');
  const cookie = env.SYNK_COMPUTER_EVALUATION_SESSION_COOKIE, csrf = env.SYNK_COMPUTER_EVALUATION_CSRF;
  if (typeof cookie !== 'string' || !cookie.trim() || cookie.length > 10000 || /[\r\n]/.test(cookie)
    || typeof csrf !== 'string' || !csrf.trim() || csrf.length > 1000 || /[\r\n]/.test(csrf)) fail('HOST_AUTHENTICATION_REQUIRED');
  return { origin: origin.origin, headers: { Cookie: cookie, 'X-CSRF-Token': csrf, Origin: origin.origin } };
}
function validateManifest(manifest, data, frozen, origin, proof) {
  if (!plain(manifest) || manifest.version !== VERSION || !same(manifest.dataset, datasetReference(data))
    || manifest.datasetManifestSha256 !== data.sealSha256 || manifest.freezeManifestSha256 !== frozen.sha256
    || !same(manifest.model, frozen.value.model) || manifest.origin !== origin || manifest.lifetimePostLimit !== LIMIT
    || !Array.isArray(manifest.requests) || manifest.requests.length !== LIMIT) fail('CAPTURE_IDENTITY_CHANGED');
  if (manifest.hostPromptSnapshotAttested !== true || manifest.hostBuildId !== proof.buildId || !isoTime(manifest.hostStartedAt)
    || !Array.isArray(manifest.hostInvocations) || manifest.hostInvocations.some(invocation => !plain(invocation)
      || invocation.hostBuildId !== proof.buildId || !isoTime(invocation.hostStartedAt) || !isoTime(invocation.at))) fail('CAPTURE_RUNTIME_ATTESTATION_CHANGED');
  const ids = new Set(); let totalAttempts = 0;
  manifest.requests.forEach((request, index) => {
    const item = data.value.cases[index];
    if (!plain(request) || !uuid(request.id) || ids.has(request.id) || request.caseId !== item.id
      || request.sourceId !== item.source.id || request.textSha256 !== hash(item.source.text)
      || request.requestId !== `evaluation-${index + 1}` || request.revision !== index + 1
      || !Number.isInteger(request.attempts) || request.attempts < 0
      || !['planned', 'dispatching', 'succeeded', 'failed', 'unknown'].includes(request.status)
      || request.status === 'planned' && request.attempts !== 0 || request.status !== 'planned' && request.attempts < 1) fail('INVALID_CAPTURE_REQUEST_LEDGER');
    if (Object.hasOwn(request, 'failureReceipt')) {
      if (!['dispatching', 'failed'].includes(request.status) || !isoTime(request.completedAt)) fail('INVALID_CAPTURE_REQUEST_LEDGER');
      verifyFailureReceipt(request.failureReceipt, request, proof.buildId);
    } else if (request.status === 'failed') fail('INVALID_CAPTURE_REQUEST_LEDGER');
    ids.add(request.id); totalAttempts += request.attempts;
  });
  if (totalAttempts > LIMIT) fail('CAPTURE_LIFETIME_LIMIT_EXCEEDED');
  return totalAttempts;
}
function outputBundle(data, frozen, runs) {
  return { version: 1, dataset: { id: data.value.id, version: data.value.version }, mode: 'extractor-output',
    backend: { id: 'openai', version: frozen.value.model.id, kind: 'model' }, runs };
}
async function readResponse(response) {
  const text = await response.text();
  if (text.length > 1000000) fail('HOST_RESPONSE_TOO_LARGE');
  try { return JSON.parse(text); } catch { fail('HOST_RESPONSE_INVALID_JSON'); }
}

export async function captureEvaluation(options = {}, dependencies = {}) {
  const env = dependencies.env || process.env, fetchImpl = dependencies.fetchImpl || globalThis.fetch;
  const auth = authenticatedOrigin(env);
  if (!options.outputDir || !Number.isInteger(options.maxCalls) || options.maxCalls < 1 || options.maxCalls > LIMIT) fail('CAPTURE_OUTPUT_DIRECTORY_AND_MAX_CALLS_REQUIRED');
  if (typeof fetchImpl !== 'function') fail('FETCH_UNAVAILABLE');
  const data = await loadDataset(options), frozen = await verifyFreeze(options.freezeManifest, data);
  const directory = resolve(options.outputDir); await mkdir(directory, { recursive: true });
  const paths = { manifest: resolve(directory, 'request-manifest.json'), outputs: resolve(directory, 'outputs.json'), errors: resolve(directory, 'errors.json'), lock: resolve(directory, 'capture.lock') };
  let lock;
  try { lock = await open(paths.lock, 'wx'); } catch { fail('CAPTURE_DIRECTORY_BUSY'); }
  let postsThisInvocation = 0;
  try {
    let availability;
    try {
      const response = await fetchImpl(`${auth.origin}/api/computer-interpretation`, { method: 'GET', headers: auth.headers,
        redirect: 'error', signal: AbortSignal.timeout(60000) });
      if (!response.ok) fail('HOST_AVAILABILITY_HTTP_FAILURE');
      availability = await readResponse(response);
    } catch (error) { if (error instanceof CaptureError) throw error; fail('HOST_AVAILABILITY_TRANSPORT_FAILURE'); }
    if (availability.available !== true) fail('HOST_MODEL_UNAVAILABLE');
    if (availability.providerLabel !== frozen.value.model.provider || availability.model !== frozen.value.model.id
      || availability.maxOutputTokens !== frozen.value.model.maxOutputTokens) fail('HOST_MODEL_DIFFERS_FROM_FREEZE');
    const proof = verifyHostProof(availability.buildProof, frozen);
    const previous = await readJSON(paths.manifest, true), previousOutputs = await readJSON(paths.outputs, true), previousErrors = await readJSON(paths.errors, true);
    if (!previous && (previousOutputs || previousErrors)) fail('ORPHANED_CAPTURE_FILES');
    const manifest = previous?.value || { version: VERSION, dataset: datasetReference(data), datasetManifestSha256: data.sealSha256,
      freezeManifestSha256: frozen.sha256, model: frozen.value.model, origin: auth.origin, createdAt: now(), lifetimePostLimit: LIMIT,
      hostPromptSnapshotAttested: true, hostBuildId: proof.buildId, hostStartedAt: proof.startedAt, hostInvocations: [],
      requests: data.value.cases.map((item, index) => ({ caseId: item.id, sourceId: item.source.id,
        textSha256: hash(item.source.text), id: randomUUID(), requestId: `evaluation-${index + 1}`, revision: index + 1, attempts: 0, status: 'planned' })) };
    let totalAttempts = validateManifest(manifest, data, frozen, auth.origin, proof);
    const saved = previousOutputs?.value || outputBundle(data, frozen, []), expectedBundle = outputBundle(data, frozen, []);
    if (saved.version !== 1 || !same(saved.dataset, expectedBundle.dataset) || saved.mode !== expectedBundle.mode
      || !same(saved.backend, expectedBundle.backend) || !Array.isArray(saved.runs) || saved.runs.length > LIMIT) fail('SAVED_OUTPUT_IDENTITY_CHANGED');
    const runs = new Map();
    for (const run of saved.runs) {
      const request = manifest.requests.find(row => row.caseId === run.caseId);
      if (!plain(run) || !request || !Object.hasOwn(run, 'output') || runs.has(run.caseId)
        || !['dispatching', 'succeeded', 'failed'].includes(request.status)
        || request.failureReceipt && !same(run.output, failureOutput())) fail('SAVED_OUTPUT_LEDGER_MISMATCH');
      runs.set(run.caseId, run.output);
      // Recover an interrupted save between outputs.json and ledger persistence.
      request.status = request.failureReceipt ? 'failed' : 'succeeded';
    }
    if (manifest.requests.some(row => row.status === 'succeeded' && !runs.has(row.caseId))) fail('SAVED_OUTPUT_MISSING');
    const errors = previousErrors?.value || { version: VERSION, datasetSha256: data.sha256, freezeManifestSha256: frozen.sha256, entries: [] };
    if (errors.version !== VERSION || errors.datasetSha256 !== data.sha256 || errors.freezeManifestSha256 !== frozen.sha256 || !Array.isArray(errors.entries)) fail('SAVED_ERROR_LEDGER_MISMATCH');
    // A bound terminal receipt is saved before outputs/errors. If those later
    // writes were interrupted, recover the failed run without dispatching again.
    manifest.requests.forEach((request, index) => {
      if (!request.failureReceipt) return;
      runs.set(request.caseId, failureOutput()); request.status = 'failed'; recordFailure(errors, request, index);
    });
    // A restart with identical loaded code is allowed. Preserve the original
    // start time and record the current host instance for every invocation.
    manifest.hostInvocations.push({ at: now(), hostBuildId: proof.buildId, hostStartedAt: proof.startedAt });
    // UUID list is durably saved before any POST; a later invocation reuses it.
    await atomicJSON(paths.manifest, manifest);
    await atomicJSON(paths.outputs, outputBundle(data, frozen, [...runs].map(([caseId, output]) => ({ caseId, output }))));
    await atomicJSON(paths.errors, errors);
    let stopped = null;
    for (let index = 0; index < data.value.cases.length; index++) {
      const item = data.value.cases[index], request = manifest.requests[index];
      if (runs.has(item.id)) continue;
      if (postsThisInvocation >= options.maxCalls || totalAttempts >= LIMIT) { stopped = 'CALL_LIMIT'; break; }
      const rechecked = await verifyFreeze(options.freezeManifest, data);
      if (rechecked.sha256 !== frozen.sha256) fail('FREEZE_MANIFEST_CHANGED');
      if (hash(await readFile(data.datasetPath)) !== data.sha256 || hash(await readFile(data.sealPath)) !== data.sealSha256) fail('DATASET_SEAL_CHANGED');
      request.attempts++; request.status = 'dispatching'; request.lastDispatchedAt = now(); request.lastHostStartedAt = proof.startedAt;
      totalAttempts++; postsThisInvocation++;
      // Reserve one attempt before sending. A crash may conservatively consume a
      // slot without sending; it cannot silently permit more than 30 sends.
      await atomicJSON(paths.manifest, manifest);
      let response, payload, receipt;
      try {
        response = await fetchImpl(`${auth.origin}/api/computer-interpretation`, { method: 'POST', headers: { ...auth.headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody(item, request, proof.buildId)), redirect: 'error', signal: AbortSignal.timeout(60000) });
        payload = await readResponse(response);
        if (!response.ok) {
          if (payload?.code !== TERMINAL_FAILURE || ![409, 502].includes(response.status) || !Object.hasOwn(payload, 'captureReceipt')) fail('HOST_CAPTURE_HTTP_FAILURE');
          receipt = verifyFailureReceipt(payload.captureReceipt, request, proof.buildId);
        } else {
          if (!plain(payload) || payload.requestId !== request.requestId || payload.revision !== request.revision) fail('HOST_RESPONSE_IDENTITY_MISMATCH');
          if (payload.buildId !== proof.buildId) fail('HOST_RESPONSE_BUILD_MISMATCH');
        }
      } catch (error) {
        request.status = 'unknown'; request.lastFailureAt = now();
        stopped = error instanceof CaptureError ? error.code : 'HOST_CAPTURE_TRANSPORT_FAILURE';
        errors.entries.push({ at: now(), index: index + 1, requestId: request.requestId, category: stopped,
          ...(response ? { httpStatus: response.status } : {}), result: 'unknown', runRecorded: false, automaticRetry: false });
        await atomicJSON(paths.errors, errors); await atomicJSON(paths.manifest, manifest);
        break;
      }
      if (receipt) {
        // This is a completed invalid attempt, never an empty successful extraction.
        // Persist only the receipt and fixed code, not provider/host error text.
        request.failureReceipt = receipt; request.completedAt = now();
        await atomicJSON(paths.manifest, manifest);
        runs.set(item.id, failureOutput()); recordFailure(errors, request, index);
        await atomicJSON(paths.outputs, outputBundle(data, frozen, [...runs].map(([caseId, output]) => ({ caseId, output }))));
        await atomicJSON(paths.errors, errors);
        request.status = 'failed'; await atomicJSON(paths.manifest, manifest);
        continue;
      }
      // Preserve malformed returned proposals for offline failure accounting.
      // Missing/non-JSON/identity-mismatched responses instead remain missing runs.
      const output = { proposals: Object.hasOwn(payload, 'proposals') ? payload.proposals : null,
        ...(Object.hasOwn(payload, 'held') ? { held: payload.held } : {}), ...(Object.hasOwn(payload, 'extractor') ? { extractor: payload.extractor } : {}) };
      runs.set(item.id, output);
      await atomicJSON(paths.outputs, outputBundle(data, frozen, [...runs].map(([caseId, result]) => ({ caseId, output: result }))));
      request.status = 'succeeded'; request.completedAt = now();
      await atomicJSON(paths.manifest, manifest);
    }
    return { version: VERSION, mode: 'capture', status: runs.size === LIMIT ? 'complete' : stopped === 'CALL_LIMIT' ? 'partial-limit' : 'stopped',
      datasetSha256: data.sha256, freezeManifestSha256: frozen.sha256, counts: { cases: LIMIT, recordedRuns: runs.size,
        missingRuns: LIMIT - runs.size, failedRuns: manifest.requests.filter(row => row.status === 'failed').length,
        postsThisInvocation, lifetimePostAttempts: totalAttempts, errors: errors.entries.length },
      ...(stopped ? { stopCategory: stopped } : {}), expectedAnswersIncludedInRequests: false, automaticRetries: 0,
      hostPromptSnapshotAttested: true, hostBuildId: proof.buildId, hostStartedAt: proof.startedAt,
      generalAccuracyEstablished: false, performanceScored: false };
  } finally { await lock.close(); await unlink(paths.lock); }
}

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const options = {}, names = { '--dataset': 'dataset', '--dataset-manifest': 'datasetManifest', '--freeze-manifest': 'freezeManifest', '--output-dir': 'outputDir', '--max-calls': 'maxCalls' };
  let mode = 'plan', modeChosen = false;
  if (argv.length === 1 && argv[0] === '--help') return { help: USAGE };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--plan' || arg === '--capture') {
      if (modeChosen) fail('DUPLICATE_MODE'); modeChosen = true; mode = arg.slice(2); continue;
    }
    const key = names[arg], value = argv[++index];
    if (!key || Object.hasOwn(options, key) || !value || value.startsWith('--')) fail('INVALID_ARGUMENTS');
    if (key === 'maxCalls' && !/^[1-9][0-9]*$/.test(value)) fail('INVALID_MAX_CALLS');
    options[key] = key === 'maxCalls' ? Number(value) : value;
  }
  if (mode === 'plan' && options.maxCalls !== undefined) fail('MAX_CALLS_BELONGS_TO_CAPTURE');
  return mode === 'capture' ? captureEvaluation(options, dependencies) : createEvaluationPlan(options);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const result = await main();
    if (result.help) console.log(result.help); else console.log(JSON.stringify(result));
    if (result.status === 'stopped') process.exitCode = 1;
  } catch (error) { console.error(JSON.stringify({ status: 'refused', category: safeCode(error) })); process.exitCode = 1; }
}
