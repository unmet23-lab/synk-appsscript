// Real loopback company API + official loader provenance + capture client.
// The only provider is a mocked fetch. No heldout sentences are read or sent.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import { createServer } from 'node:net';
import { createHash } from 'node:crypto';
import { createCompanyApp } from '../docs/마케팅/온라인마케팅지도/engagement/company/server.mjs';
import { captureEvaluation } from '../tools/capture-atlas-interpretation-evaluation.mjs';

async function fixture(t, failure = null) {
  const directory = await fs.mkdtemp(join(tmpdir(), 'synk-capture-company-'));
  let app;
  t.after(async () => {
    await app?.stop();
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep) && directory.includes('synk-capture-company-'));
    await fs.rm(directory, { recursive: true, force: true });
  });
  const probe = createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const origin = `http://127.0.0.1:${port}`, sourceText = '저는 웹 AI로 문서를 작성해요.';
  const env = { OPENAI_API_KEY: 'mock-key', SYNK_COMPUTER_AI_ENABLED: '1', SYNK_COMPUTER_AI_MODEL: 'gpt-6-luna',
    SYNK_COMPUTER_AI_MAX_OUTPUT_TOKENS: '3000', SYNK_COMPUTER_AI_INPUT_PER_MILLION_MICRO_USD: '125000',
    SYNK_COMPUTER_AI_OUTPUT_PER_MILLION_MICRO_USD: '500000', SYNK_COMPUTER_AI_REQUEST_LIMIT_MICRO_USD: '10000', SYNK_COMPUTER_AI_TOTAL_LIMIT_MICRO_USD: '250000' };
  let providerCalls = 0;
  app = createCompanyApp({ dataDir: join(directory, 'company'), port, schedule: false,
    messengerDriveStorage: { active: async () => null, status: async () => ({ provider: 'local' }) },
    computerAIEnv: name => env[name], computerAIFetch: async (url, options) => {
      assert.equal(url, 'https://api.openai.com/v1/responses'); providerCalls++;
      const body = JSON.parse(options.body), input = JSON.parse(body.input[0].content[0].text);
      assert.equal(input.source_text, sourceText); assert.equal(input.expected, undefined);
      if (failure === 'uncertain' && providerCalls === 3) throw new Error('private provider transport failure');
      if (failure === 'rejected' && providerCalls === 3) return new Response(JSON.stringify({ error: { type: 'invalid_request_error', code: 'invalid_api_key', message: 'private provider key failure' } }), { status: 401 });
      const quote = failure === 'invalid' && providerCalls === 3 ? 'provider invented quotation' : sourceText;
      return new Response(JSON.stringify({ status: 'completed', model: 'gpt-6-luna', usage: { input_tokens: 1200, output_tokens: 200, total_tokens: 1400 },
        output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify({
          proposals: [{ field: 'uses.web', value: true, subject: 'self', stance: 'current', evidence: [{ quote, occurrence: 1 }] }], held: [],
        }) }] }],
      }), { headers: { 'Content-Type': 'application/json' } });
    } });
  await app.start();
  const user = app.store.createUser({ name: '연결 시험', email: 'capture@example.test', role: 'admin' });
  const token = app.store.mint('session', user.id, { csrfToken: 'capture-csrf' }, 10);
  const headers = { Cookie: `synk_company_session=${token}`, Origin: origin, 'X-CSRF-Token': 'capture-csrf', 'Content-Type': 'application/json' };
  const status = await (await fetch(origin + '/api/computer-interpretation', { headers })).json();
  assert.equal(status.buildProof.runtimeAttested, true);

  // A new, explicitly transport-only fixture, not the heldout source or labels.
  const dataset = { id: 'computer-ko-heldout', version: '1', kind: 'authored-synthetic-sources', description: 'Transport fixture only.',
    fields: [{ id: 'uses.web', kind: 'boolean' }], cases: Array.from({ length: 30 }, (_, i) => ({
      id: `transport-${i + 1}`, tags: ['transport-only'], source: { id: `transport-source-${i + 1}`, at: '2026-10-06T00:00:00.000Z', actor: 'self', text: sourceText },
      expected: { facts: { 'uses.web': true }, permittedFacts: {}, unknownFields: [], mustNotAssert: [] }, rationale: 'Transport test, not accuracy evidence.',
    })) };
  const datasetBytes = JSON.stringify(dataset), sha256 = createHash('sha256').update(datasetBytes).digest('hex');
  const freeze = JSON.parse(await fs.readFile(new URL('../docs/_ops/qa/atlas-model-20261005/freeze.json', import.meta.url), 'utf8'));
  freeze.dataset.sha256 = sha256;
  for (const artifact of freeze.artifacts) artifact.sha256 = createHash('sha256').update(await fs.readFile(new URL('../' + artifact.path, import.meta.url))).digest('hex');
  const datasetPath = join(directory, 'dataset.json'), datasetManifest = join(directory, 'seal.json'), freezeManifest = join(directory, 'freeze.json');
  await fs.writeFile(datasetPath, datasetBytes);
  await fs.writeFile(datasetManifest, JSON.stringify({ manifestVersion: 1, frozenAt: '2026-10-06T00:00:00.000Z', dataset: { id: dataset.id, version: dataset.version, sha256, caseCount: 30 } }));
  await fs.writeFile(freezeManifest, JSON.stringify(freeze));
  const options = { dataset: datasetPath, datasetManifest, freezeManifest, outputDir: join(directory, 'capture'), maxCalls: 1 };
  const dependencies = { env: { SYNK_COMPUTER_EVALUATION_APPROVED: '1', SYNK_COMPUTER_EVALUATION_ORIGIN: origin,
    SYNK_COMPUTER_EVALUATION_SESSION_COOKIE: headers.Cookie, SYNK_COMPUTER_EVALUATION_CSRF: 'capture-csrf' } };
  const post = async (path, data) => fetch(origin + path, { method: 'POST', headers, body: JSON.stringify(data) });
  const ledger = async () => JSON.parse(await fs.readFile(join(options.outputDir, 'request-manifest.json'), 'utf8'));
  return { app, options, dependencies, post, ledger, status, sourceText, providerCalls: () => providerCalls };
}

test('real authenticated host and capture agree on loaded build; deletion preserves billing tombstones', async t => {
  const f = await fixture(t), { app, options, dependencies, post, status, sourceText } = f;
  const captured = await captureEvaluation(options, dependencies);
  assert.equal(captured.status, 'partial-limit'); assert.equal(captured.hostPromptSnapshotAttested, true);
  assert.equal(f.providerCalls(), 1);
  const manifest = await f.ledger();
  assert.equal(manifest.hostBuildId, status.buildProof.buildId);
  const request = manifest.requests[0], body = { id: request.id, requestId: request.requestId, revision: request.revision,
    sourceId: request.sourceId, text: sourceText, expectedBuildId: status.buildProof.buildId };
  const replay = await post('/api/computer-interpretation', body);
  assert.equal(replay.status, 200); assert.equal((await replay.json()).buildId, status.buildProof.buildId); assert.equal(f.providerCalls(), 1);
  assert.equal((await post('/api/computer-interpretation', { ...body, expectedBuildId: '0'.repeat(64) })).status, 409);
  assert.equal(f.providerCalls(), 1);
  const before = app.store.all('computerAIRequests')[0];
  assert.equal((await post('/api/computer-interpretation/delete', {})).status, 200);
  const after = app.store.all('computerAIRequests')[0];
  assert.equal(after.resultCiphertext, undefined); assert.equal(after.accountedMicroUSD, before.accountedMicroUSD);
  assert.equal((await post('/api/computer-interpretation', body)).status, 410); assert.equal(f.providerCalls(), 1);
});

test('a real host invalid quotation closes that evaluation case and continues without rebilling it', async t => {
  const f = await fixture(t, 'invalid'), options = { ...f.options, maxCalls: 30 };
  const report = await captureEvaluation(options, f.dependencies);
  assert.equal(report.status, 'complete'); assert.equal(report.counts.recordedRuns, 30);
  assert.equal(report.counts.failedRuns, 1); assert.equal(f.providerCalls(), 30);
  const manifest = await f.ledger(), failed = manifest.requests[2];
  assert.equal(failed.status, 'failed'); assert.equal(failed.attempts, 1);
  const billed = f.app.store.all('computerAIRequests'), row = billed.find(row => row.requestUUID === failed.id);
  assert.equal(row.status, 'invalid'); assert.equal(row.accountedMicroUSD, 250); assert.equal(row.resultCiphertext, undefined);
  const before = billed.map(row => ({ id: row.id, accountedMicroUSD: row.accountedMicroUSD, reservedMicroUSD: row.reservedMicroUSD }));
  const response = await f.post('/api/computer-interpretation', { id: failed.id, requestId: failed.requestId, revision: failed.revision,
    sourceId: failed.sourceId, text: f.sourceText, expectedBuildId: f.status.buildProof.buildId });
  assert.equal(response.status, 409);
  const data = await response.json();
  assert.equal(data.code, 'SYNK_COMPUTER_AI_RESPONSE_INVALID');
  assert.deepEqual(data.captureReceipt, failed.failureReceipt);
  assert.deepEqual(Object.keys(data.captureReceipt).sort(), ['buildId', 'id', 'requestId', 'revision', 'status', 'version']);
  assert.equal(JSON.stringify(data).includes(f.sourceText), false);
  assert.equal(JSON.stringify(data).includes('provider invented'), false);
  assert.equal((await captureEvaluation(options, f.dependencies)).counts.postsThisInvocation, 0);
  assert.equal(f.providerCalls(), 30);
  assert.deepEqual(f.app.store.all('computerAIRequests').map(row => ({ id: row.id, accountedMicroUSD: row.accountedMicroUSD, reservedMicroUSD: row.reservedMicroUSD })), before);
});

test('real uncertain provider dispatch remains missing, reserves its cost and blocks advancement on explicit replay', async t => {
  const f = await fixture(t, 'uncertain'), options = { ...f.options, maxCalls: 30 };
  const report = await captureEvaluation(options, f.dependencies);
  assert.equal(report.status, 'stopped'); assert.equal(report.counts.recordedRuns, 2); assert.equal(report.counts.failedRuns, 0);
  assert.equal(f.providerCalls(), 3);
  const first = await f.ledger(), held = f.app.store.all('computerAIRequests').find(row => row.requestUUID === first.requests[2].id);
  assert.equal(held.status, 'uncertain'); assert.equal(held.accountedMicroUSD, held.reservedMicroUSD);
  const replay = await captureEvaluation(options, f.dependencies), after = await f.ledger();
  assert.equal(replay.status, 'stopped'); assert.equal(replay.counts.recordedRuns, 2); assert.equal(f.providerCalls(), 3);
  assert.equal(after.requests[2].id, first.requests[2].id); assert.equal(after.requests[2].status, 'unknown');
  assert.equal(after.requests[3].attempts, 0);
  const unchanged = f.app.store.all('computerAIRequests').find(row => row.id === held.id);
  assert.equal(unchanged.accountedMicroUSD, held.accountedMicroUSD); assert.equal(unchanged.reservedMicroUSD, held.reservedMicroUSD);
});

test('provider key rejection stops capture for configuration review without consuming the cost reservation or retrying', async t => {
  const f = await fixture(t, 'rejected'), options = { ...f.options, maxCalls: 30 };
  const report = await captureEvaluation(options, f.dependencies);
  assert.equal(report.status, 'stopped'); assert.equal(report.counts.recordedRuns, 2); assert.equal(report.counts.failedRuns, 0);
  const first = await f.ledger(), rejected = f.app.store.all('computerAIRequests').find(row => row.requestUUID === first.requests[2].id);
  assert.equal(rejected.status, 'rejected'); assert.equal(rejected.accountedMicroUSD, 0); assert.ok(rejected.reservedMicroUSD > 0);
  assert.equal((await captureEvaluation(options, f.dependencies)).status, 'stopped');
  const after = await f.ledger();
  assert.equal(after.requests[2].id, first.requests[2].id); assert.equal(after.requests[3].attempts, 0); assert.equal(f.providerCalls(), 3);
});
