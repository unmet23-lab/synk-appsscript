import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createCompanyApp } from './server.mjs';
import { createComputerInterpretationService } from './computer-interpretation-service.mjs';
import { Store } from './store.mjs';

const endpoint = '/api/computer-interpretation';
const at = '2026-10-05T06:00:00.000Z';
const text = '현재 램은 16GB입니다.';
const input = extras => ({ id: randomUUID(), requestId: 'computer-request-1', sourceId: 'computer-source-1', revision: 1, text, ...extras });
const envDefaults = () => ({ SYNK_COMPUTER_AI_ENABLED: '1', SYNK_COMPUTER_AI_MODEL: 'gpt-6-luna', SYNK_COMPUTER_AI_MAX_OUTPUT_TOKENS: '3000',
  SYNK_COMPUTER_AI_INPUT_PER_MILLION_MICRO_USD: '125000', SYNK_COMPUTER_AI_OUTPUT_PER_MILLION_MICRO_USD: '500000',
  SYNK_COMPUTER_AI_REQUEST_LIMIT_MICRO_USD: '10000', SYNK_COMPUTER_AI_TOTAL_LIMIT_MICRO_USD: '250000', OPENAI_API_KEY: 'test-key-never-sent' });
function payload(overrides = {}) {
  return { model: 'gpt-6-luna', status: 'completed', usage: { input_tokens: 1000, output_tokens: 100, total_tokens: 1100 }, output: [
    { type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify({ proposals: [
      { field: 'current.ram', value: '16', subject: 'self', stance: 'current', evidence: [{ quote: text, occurrence: 1 }] },
    ], held: [] }) }] },
  ], ...overrides };
}
const response = value => new Response(JSON.stringify(value ?? payload()), { status: 200, headers: { 'Content-Type': 'application/json' } });
async function fixture(t, { env = envDefaults(), fetchImpl = async () => response() } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'synk-computer-api-')), calls = [], users = {}, sessions = {};
  const f = { env, calls, users, sessions, app: null, base: null, now: at };
  const options = { dataDir: directory, port: 0, allowTestHost: true, schedule: false, clock: () => f.now,
    messengerDriveStorage: { active: null, status: () => ({ configured: false }) },
    computerAIEnv: name => env[name], computerAIFetch: async (...args) => { calls.push(args); return fetchImpl(...args); } };
  const start = async () => { f.app = createCompanyApp(options); const address = await f.app.start(); f.base = `http://127.0.0.1:${address.port}`; };
  await start();
  t.after(async () => { await f.app.stop(); assert.equal(dirname(resolve(directory)), resolve(tmpdir())); assert.ok(directory.includes('synk-computer-api-')); await rm(directory, { recursive: true, force: true }); });
  for (const role of ['admin', 'other', 'member', 'viewer']) {
    users[role] = f.app.store.createUser({ name: `Fixture ${role}`, email: `${role}@computer-api.example.test`, role: role === 'other' ? 'admin' : role });
    sessions[role] = f.app.store.mint('session', users[role].id, { csrfToken: 'computer-csrf' }, 10);
  }
  f.restart = async () => { await f.app.stop(); await start(); };
  f.request = async (path = endpoint, { body, user = 'admin', headers = {}, method = body === undefined ? 'GET' : 'POST' } = {}) => {
    const res = await fetch(f.base + path, { method, headers: { ...(user ? { Cookie: 'synk_company_session=' + sessions[user] } : {}),
      ...(body === undefined ? {} : { Origin: f.app.origin, 'X-CSRF-Token': 'computer-csrf', 'Content-Type': 'application/json' }), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const raw = await res.text();
    return { status: res.status, headers: res.headers, text: raw, data: res.headers.get('content-type')?.includes('application/json') && raw ? JSON.parse(raw) : null };
  };
  f.ledger = () => f.app.store.all('computerAIRequests');
  return f;
}

test('computer AI is off without explicit complete configuration; prices cannot understate the supported model', async t => {
  const f = await fixture(t, { env: {} });
  assert.equal((await f.request()).data.reason, 'disabled');
  assert.equal((await f.request(endpoint, { body: input() })).status, 503);
  Object.assign(f.env, envDefaults());
  const ready = (await f.request()).data;
  assert.equal(ready.available, true); assert.equal(ready.model, 'gpt-6-luna'); assert.equal(ready.maxOutputTokens, 3000);
  for (const [name, value] of [['SYNK_COMPUTER_AI_MODEL', 'another-model'], ['SYNK_COMPUTER_AI_INPUT_PER_MILLION_MICRO_USD', '124999'],
    ['SYNK_COMPUTER_AI_OUTPUT_PER_MILLION_MICRO_USD', '499999'], ['SYNK_COMPUTER_AI_MAX_OUTPUT_TOKENS', '3001'], ['OPENAI_API_KEY', ''], ['SYNK_COMPUTER_AI_TOTAL_LIMIT_MICRO_USD', '']]) {
    const previous = f.env[name]; f.env[name] = value;
    assert.equal((await f.request()).data.available, false); assert.equal((await f.request(endpoint, { body: input() })).status, 503); f.env[name] = previous;
  }
  assert.equal(f.calls.length, 0); assert.equal(f.ledger().length, 0);
});

test('computer AI requires current administrator, session, exact Origin and CSRF before paid dispatch', async t => {
  const f = await fixture(t);
  assert.equal((await f.request(endpoint, { user: null })).data.reason, 'session-required');
  assert.equal((await f.request(endpoint, { user: 'member' })).data.reason, 'admin-required');
  for (const options of [{ user: null }, { user: 'member' }, { user: 'viewer' }, { headers: { Origin: 'https://evil.example.test' } }, { headers: { 'X-CSRF-Token': 'wrong' } }]) {
    assert.equal((await f.request(endpoint, { body: input(), ...options })).status, 403);
  }
  assert.equal(f.calls.length, 0); assert.equal(f.ledger().length, 0);
});

test('server owns model, scope and contract; exact source ID is validated and request fields are bounded', async t => {
  const f = await fixture(t);
  for (const body of [input({ scope: { subject: 'someone-else' } }), input({ model: 'free-form' }), input({ catalog: [] }), input({ sourceId: '__proto__' }),
    input({ sourceId: 'a'.repeat(101) }), input({ revision: -1 }), input({ revision: 1.2 }), input({ id: 'not-a-uuid' }), input({ text: 'x'.repeat(4001) }), input({ text: ' ' })]) {
    assert.equal((await f.request(endpoint, { body })).status, 400);
  }
  assert.equal(f.calls.length, 0);
  const body = input(), result = await f.request(endpoint, { body });
  assert.equal(result.status, 200); assert.equal(result.data.proposals[0].evidence[0].sourceId, body.sourceId);
  assert.equal(result.data.proposals[0].evidence[0].quote, text);
  assert.equal(result.data.requestId, body.requestId); assert.equal(result.data.revision, body.revision);
  assert.equal(result.data.proposals[0].confirmed, undefined);
  const [url, request] = f.calls[0], sent = JSON.parse(request.body);
  assert.equal(url, 'https://api.openai.com/v1/responses'); assert.equal(request.redirect, 'error'); assert.equal(sent.model, 'gpt-6-luna');
  assert.equal(sent.store, false); assert.equal(sent.max_output_tokens, 3000); assert.ok(sent.text.format.strict);
  assert.equal(f.ledger()[0].userId, f.users.admin.id);
});

test('same UUID and payload replay the encrypted result once, including after restart; altered input conflicts', async t => {
  const f = await fixture(t), body = input(), first = await f.request(endpoint, { body });
  assert.equal(first.status, 200);
  for (const changes of [{ text: text + ' ' }, { revision: 2 }, { sourceId: 'different-source' }, { requestId: 'different-request' }]) {
    assert.equal((await f.request(endpoint, { body: { ...body, ...changes } })).status, 409);
  }
  await f.restart();
  assert.deepEqual((await f.request(endpoint, { body })).data, first.data); assert.equal(f.calls.length, 1);
  const row = f.ledger()[0]; assert.equal(row.status, 'completed'); assert.equal(row.accountedMicroUSD, 175); assert.ok(row.reservedMicroUSD > row.accountedMicroUSD);
  assert.ok(!JSON.stringify(row).includes(text)); assert.ok(!JSON.stringify(row).includes('test-key-never-sent'));
  assert.deepEqual(f.app.store.decrypt(row.resultCiphertext), first.data);
});

test('identical UUID from another administrator is isolated and cannot retrieve the first account response', async t => {
  const f = await fixture(t), body = input();
  assert.equal((await f.request(endpoint, { body })).status, 200);
  assert.equal((await f.request(endpoint, { body, user: 'other' })).status, 200);
  assert.equal(f.calls.length, 2); assert.equal(f.ledger().length, 2);
  assert.notEqual(f.ledger()[0].id, f.ledger()[1].id);
});

test('pending duplicate and parallel requests cannot double-spend a persisted reservation', async t => {
  let release, started;
  const ready = new Promise(resolve => { started = resolve; }), wait = new Promise(resolve => { release = resolve; });
  const f = await fixture(t, { fetchImpl: async () => { started(); await wait; return response(); } }), body = input();
  const first = f.request(endpoint, { body }); await ready;
  const reserved = f.ledger()[0]; assert.equal(reserved.status, 'sent');
  f.env.SYNK_COMPUTER_AI_TOTAL_LIMIT_MICRO_USD = String(reserved.accountedMicroUSD);
  assert.equal((await f.request(endpoint, { body })).status, 409);
  assert.equal((await f.request(endpoint, { body: input(), user: 'other' })).status, 429);
  assert.equal(f.calls.length, 1); release(); assert.equal((await first).status, 200);
  assert.equal(f.ledger()[0].accountedMicroUSD, 175);
});

test('request cost cap rejects before dispatch; request body bytes and protocol allowance determine reservation', async t => {
  const env = envDefaults(); env.SYNK_COMPUTER_AI_REQUEST_LIMIT_MICRO_USD = '1';
  const f = await fixture(t, { env });
  assert.equal((await f.request(endpoint, { body: input() })).status, 429); assert.equal(f.calls.length, 0); assert.equal(f.ledger().length, 0);
  f.env.SYNK_COMPUTER_AI_REQUEST_LIMIT_MICRO_USD = '10000';
  assert.equal((await f.request(endpoint, { body: input() })).status, 200);
  const row = f.ledger()[0], bytes = Buffer.byteLength(f.calls[0][1].body, 'utf8');
  assert.equal(row.inputBound, bytes + 4096);
  assert.equal(row.reservedMicroUSD, Math.ceil((bytes + 4096) * 0.125) + 1500);
});

test('network failure preserves the lifetime reservation across restart and never retries the same UUID', async t => {
  const f = await fixture(t, { fetchImpl: async () => { throw new Error('provider echoed secret must not escape'); } }), body = input();
  const failed = await f.request(endpoint, { body }); assert.equal(failed.status, 502); assert.ok(!failed.text.includes('provider echoed'));
  const row = f.ledger()[0]; assert.equal(row.status, 'uncertain'); assert.equal(row.accountedMicroUSD, row.reservedMicroUSD);
  f.env.SYNK_COMPUTER_AI_TOTAL_LIMIT_MICRO_USD = String(row.accountedMicroUSD);
  await f.restart();
  assert.equal((await f.request(endpoint, { body })).status, 409); assert.equal((await f.request(endpoint, { body: input() })).status, 429);
  assert.equal((await f.request()).data.available, false); assert.equal(f.calls.length, 1);
});

test('missing or inconsistent usage holds the full reservation even for a syntactically valid interpretation', async t => {
  let value;
  const f = await fixture(t, { fetchImpl: async () => response(payload({ usage: value })) });
  for (value of [undefined, { input_tokens: 1000, output_tokens: 100 }, { input_tokens: 1000, output_tokens: 100, total_tokens: 1 }, { input_tokens: -1, output_tokens: 100, total_tokens: 99 }]) {
    assert.equal((await f.request(endpoint, { body: input() })).status, 502);
    const row = f.ledger().at(-1); assert.equal(row.status, 'uncertain'); assert.equal(row.accountedMicroUSD, row.reservedMicroUSD);
  }
});

test('invalid model output still settles known usage and cannot be retried as an unpaid validation failure', async t => {
  const f = await fixture(t, { fetchImpl: async () => response(payload({ model: 'unexpected-model' })) }), body = input();
  assert.equal((await f.request(endpoint, { body })).status, 502);
  const row = f.ledger()[0]; assert.equal(row.status, 'invalid'); assert.equal(row.accountedMicroUSD, 175); assert.equal(row.resultCiphertext, undefined);
  assert.equal((await f.request(endpoint, { body })).status, 409); assert.equal(f.calls.length, 1);
});

test('unexpected provider usage above the reserved bound is recorded and blocks subsequent paid dispatch', async t => {
  const f = await fixture(t, { fetchImpl: async () => response(payload({ usage: { input_tokens: 1000000, output_tokens: 100, total_tokens: 1000100 } })) });
  assert.equal((await f.request(endpoint, { body: input() })).status, 502);
  assert.equal(f.ledger()[0].accountedMicroUSD, 125050); assert.equal(f.ledger()[0].usageOverrun, true);
  assert.equal((await f.request()).data.available, false); assert.equal((await f.request(endpoint, { body: input() })).status, 429); assert.equal(f.calls.length, 1);
});

test('session revoked during provider I/O cannot receive the result, while already incurred usage is settled', async t => {
  let release, started;
  const ready = new Promise(resolve => { started = resolve; }), wait = new Promise(resolve => { release = resolve; });
  const f = await fixture(t, { fetchImpl: async () => { started(); await wait; return response(); } }), body = input();
  const pending = f.request(endpoint, { body }); await ready;
  f.app.store.revokeUser(f.users.admin.id); release();
  assert.equal((await pending).status, 401); assert.equal(f.ledger()[0].accountedMicroUSD, 175);
  assert.equal((await f.request(endpoint, { body })).status, 403); assert.equal(f.calls.length, 1);
});

test('Lab static allowlist serves browser dependencies and never exposes model server code, fixtures or storage', async t => {
  const f = await fixture(t, { env: {} });
  for (const path of ['/atlas-lab/', '/atlas-lab/lab.js', '/atlas-lab/lab.css', '/atlas-lab/interpretation.mjs', '/atlas-lab/consultation.mjs',
    '/consult/core/domain.js', '/consult/core/engine.js', '/consult/core/personalization.js', '/consult/core/interpretation.js', '/consult/computer/content.js', '/consult/computer/rules.js',
    '/atlas-lab/meeting.mjs', '/atlas-lab/meeting-ui.mjs', '/atlas-lab/discovery.mjs', '/atlas-lab/discovery-ui.mjs',
    '/learning-hub/atlas-learning.js', '/learning-hub/assets/SUIT-Variable.woff2', '/learning-hub/assets/slab-cream-long.webp',
    '/order-rush/learning.mjs', '/korean-rhythm/personalization.mjs', '/korean-rhythm/core.mjs?v=20261002-flow', '/korean-rhythm/suno-tracks.mjs', '/korean-rhythm/listening.mjs', '/korean-rhythm/narration.mjs']) {
    assert.equal((await f.request(path, { user: null })).status, 200, path);
  }
  for (const path of ['/atlas-lab/model-extraction.mjs', '/atlas-lab/qa/example.json', '/tests/fixtures/example.json', '/computer-interpretation-service.mjs', '/data/company.sqlite', '/encryption.key']) {
    assert.equal((await f.request(path, { user: null })).status, 404, path);
  }
  assert.equal(f.calls.length, 0);
});

test('privacy and deletion need only an active own session and never depend on AI configuration or administrator role', async t => {
  const f = await fixture(t, { env: {} });
  assert.equal((await f.request(endpoint + '/privacy', { user: null })).status, 401);
  assert.equal((await f.request(endpoint + '/delete', { user: null, body: {} })).status, 403);
  for (const user of ['admin', 'member', 'viewer']) {
    const privacy = await f.request(endpoint + '/privacy', { user });
    assert.equal(privacy.status, 200); assert.deepEqual(privacy.data, { retentionHours: 24, storedResponses: 0, pendingResponses: 0, canDelete: true, nextExpiryAt: null });
    assert.equal((await f.request(endpoint + '/delete', { user, body: {} })).status, 200);
  }
  for (const body of [null, [], { userId: f.users.other.id }, { id: randomUUID() }]) assert.equal((await f.request(endpoint + '/delete', { body })).status, 400);
  for (const headers of [{ Origin: 'https://evil.example.test' }, { 'X-CSRF-Token': 'wrong' }]) assert.equal((await f.request(endpoint + '/delete', { body: {}, headers })).status, 403);
  assert.equal((await f.request(endpoint + '/privacy?userId=' + f.users.other.id)).status, 400);
  assert.equal((await f.request(endpoint + '/delete?all=1', { body: {} })).status, 400);
  f.app.store.put('users', f.users.member.id, { ...f.users.member, active: false });
  assert.equal((await f.request(endpoint + '/privacy', { user: 'member' })).status, 401);
  assert.equal((await f.request(endpoint + '/delete', { user: 'member', body: {} })).status, 403);
  assert.equal(f.calls.length, 0);
});

test('deletion removes only own ciphertext, preserves cost and UUID tombstones, and works after role downgrade and restart', async t => {
  const f = await fixture(t), mine = input(), other = input();
  assert.equal((await f.request(endpoint, { body: mine })).status, 200);
  assert.equal((await f.request(endpoint, { body: other, user: 'other' })).status, 200);
  const before = f.ledger().find(row => row.userId === f.users.admin.id);
  assert.equal(before.expiresAt, '2026-10-06T06:00:00.000Z');
  const privacy = (await f.request(endpoint + '/privacy')).data;
  assert.equal(privacy.storedResponses, 1); assert.equal(privacy.nextExpiryAt, before.expiresAt);
  f.app.store.put('users', f.users.admin.id, { ...f.users.admin, role: 'viewer' });
  delete f.env.OPENAI_API_KEY;
  const deleted = await f.request(endpoint + '/delete', { body: {} });
  assert.equal(deleted.status, 200); assert.equal(deleted.data.deletedResponses, 1); assert.equal(deleted.data.cancelledPendingResponses, 0);
  const after = f.ledger().find(row => row.id === before.id);
  assert.equal(Object.hasOwn(after, 'resultCiphertext'), false); assert.equal(after.responseRemovalReason, 'deleted');
  for (const key of ['id', 'digest', 'requestUUID', 'accountedMicroUSD', 'reservedMicroUSD']) assert.equal(after[key], before[key]);
  assert.equal((await f.request(endpoint + '/privacy')).data.storedResponses, 0);
  assert.equal((await f.request(endpoint + '/privacy', { user: 'other' })).data.storedResponses, 1);
  assert.equal((await f.request(endpoint + '/delete', { body: {} })).data.deletedResponses, 0);
  f.app.store.put('users', f.users.admin.id, f.users.admin);
  await f.restart();
  const replayed = await f.request(endpoint, { body: mine });
  assert.equal(replayed.status, 410); assert.equal(replayed.data.code, 'SYNK_COMPUTER_AI_RESPONSE_REMOVED');
  assert.equal(f.calls.length, 2); assert.equal(f.ledger().length, 2);
});

test('response retention is fixed at acceptance: replay before the boundary does not extend it, exact expiry removes ciphertext', async t => {
  const f = await fixture(t), body = input();
  assert.equal((await f.request(endpoint, { body })).status, 200);
  f.now = '2026-10-06T05:59:59.999Z';
  assert.equal((await f.request(endpoint, { body })).status, 200);
  assert.equal(f.ledger()[0].expiresAt, '2026-10-06T06:00:00.000Z');
  f.now = '2026-10-06T06:00:00.000Z';
  assert.equal((await f.request(endpoint, { body })).status, 410);
  const row = f.ledger()[0]; assert.equal(Object.hasOwn(row, 'resultCiphertext'), false); assert.equal(row.responseRemovalReason, 'expired');
  assert.equal(row.accountedMicroUSD, 175); assert.equal((await f.request(endpoint + '/privacy')).data.storedResponses, 0);
  f.now = at; // A clock rollback cannot restore a removed response.
  assert.equal((await f.request(endpoint, { body })).status, 410); assert.equal(f.calls.length, 1);
});

test('startup migrates old encrypted rows from original acceptance time, including rows without expiry metadata', async t => {
  const f = await fixture(t), body = input();
  assert.equal((await f.request(endpoint, { body })).status, 200);
  const row = f.ledger()[0], { expiresAt: _expiresAt, ...legacy } = row;
  f.app.store.put('computerAIRequests', row.id, legacy);
  f.now = '2026-10-06T06:00:00.000Z';
  await f.restart();
  const migrated = f.ledger()[0];
  assert.equal(migrated.expiresAt, '2026-10-06T06:00:00.000Z'); assert.equal(migrated.responseRemovalReason, 'expired');
  assert.equal(Object.hasOwn(migrated, 'resultCiphertext'), false); assert.equal(migrated.accountedMicroUSD, row.accountedMicroUSD);
  assert.equal((await f.request(endpoint, { body })).status, 410); assert.equal(f.calls.length, 1);
});

test('deleting a pending response blocks late storage and delivery while settling incurred usage and preserving other accounts', async t => {
  let release, started;
  const ready = new Promise(resolve => { started = resolve; }), wait = new Promise(resolve => { release = resolve; });
  const f = await fixture(t, { fetchImpl: async () => { started(); await wait; return response(); } }), body = input();
  const pending = f.request(endpoint, { body }); await ready;
  assert.equal((await f.request(endpoint + '/privacy')).data.pendingResponses, 1);
  const deleted = await f.request(endpoint + '/delete', { body: {} });
  assert.equal(deleted.status, 200); assert.equal(deleted.data.cancelledPendingResponses, 1); assert.equal(deleted.data.pendingResponses, 0);
  assert.equal((await f.request(endpoint, { body })).status, 410);
  release(); const late = await pending;
  assert.equal(late.status, 410); assert.ok(!late.text.includes(text));
  const row = f.ledger()[0]; assert.equal(row.responseRemovalReason, 'deleted'); assert.equal(row.accountedMicroUSD, 175);
  assert.equal(Object.hasOwn(row, 'resultCiphertext'), false);
  await f.restart(); assert.equal((await f.request(endpoint, { body })).status, 410); assert.equal(f.calls.length, 1);
  // A deliberate new request is allowed; deletion is not a permanent opt-out.
  assert.equal((await f.request(endpoint, { body: input() })).status, 200); assert.equal(f.calls.length, 2);
});

test('a pending response that reaches its retention deadline is never stored or delivered', async t => {
  let release, started;
  const ready = new Promise(resolve => { started = resolve; }), wait = new Promise(resolve => { release = resolve; });
  const f = await fixture(t, { fetchImpl: async () => { started(); await wait; return response(); } }), body = input();
  const pending = f.request(endpoint, { body }); await ready;
  f.now = '2026-10-06T06:00:00.000Z'; release();
  assert.equal((await pending).status, 410);
  const row = f.ledger()[0]; assert.equal(row.responseRemovalReason, 'expired'); assert.equal(row.accountedMicroUSD, 175);
  assert.equal(Object.hasOwn(row, 'resultCiphertext'), false); assert.equal((await f.request(endpoint, { body })).status, 410);
});

test('deletion during an uncertain provider failure never releases the outstanding cost reservation', async t => {
  let release, started;
  const ready = new Promise(resolve => { started = resolve; }), wait = new Promise(resolve => { release = resolve; });
  const f = await fixture(t, { fetchImpl: async () => { started(); await wait; throw new Error('network failed'); } }), body = input();
  const pending = f.request(endpoint, { body }); await ready;
  assert.equal((await f.request(endpoint + '/delete', { body: {} })).status, 200); release();
  assert.equal((await pending).status, 410);
  const row = f.ledger()[0]; assert.equal(row.status, 'uncertain'); assert.equal(row.accountedMicroUSD, row.reservedMicroUSD);
  assert.equal(Object.hasOwn(row, 'resultCiphertext'), false); assert.equal(row.responseRemovalReason, 'deleted');
});

test('the scheduled expiry removes ciphertext without a request; stopping clears the timer before database closure', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'synk-computer-expiry-')), store = new Store(directory);
  let service, clockAt = at;
  t.after(async () => { await service?.stop(); t.mock.timers.reset(); store.close(); assert.equal(dirname(resolve(directory)), resolve(tmpdir())); assert.ok(directory.includes('synk-computer-expiry-')); await rm(directory, { recursive: true, force: true }); });
  store.put('computerAIRequests', 'legacy', { id: 'legacy', userId: 'legacy-user', at, status: 'completed', accountedMicroUSD: 175, resultCiphertext: store.encrypt({ private: text }) });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  service = createComputerInterpretationService({ store, clock: () => clockAt, getEnv: () => undefined, fetchImpl: () => { throw new Error('No provider call allowed'); } });
  clockAt = '2026-10-06T05:59:59.999Z'; t.mock.timers.tick(86400000 - 1);
  assert.ok(store.get('computerAIRequests', 'legacy').resultCiphertext);
  clockAt = '2026-10-06T06:00:00.000Z'; t.mock.timers.tick(1);
  assert.equal(Object.hasOwn(store.get('computerAIRequests', 'legacy'), 'resultCiphertext'), false);
  assert.equal(store.get('computerAIRequests', 'legacy').responseRemovalReason, 'expired');
  await service.stop();
  store.put('computerAIRequests', 'stop-check', { id: 'stop-check', at: clockAt, status: 'completed', accountedMicroUSD: 175, resultCiphertext: store.encrypt({ private: text }) });
  service = createComputerInterpretationService({ store, clock: () => clockAt, getEnv: () => undefined });
  await service.stop(); clockAt = '2026-10-07T06:00:00.000Z'; t.mock.timers.tick(86400000);
  assert.ok(store.get('computerAIRequests', 'stop-check').resultCiphertext);
});

test('optional evaluation build identity is authenticated, validated before reservation and bound to response and replay', async t => {
  const f = await fixture(t), state = (await f.request()).data;
  assert.equal((await f.request(endpoint, { user: 'member' })).data.buildProof, undefined);
  assert.equal(state.buildProof.runtimeAttested, true); assert.match(state.buildProof.buildId, /^[0-9a-f]{64}$/);
  for (const expectedBuildId of [null, 'short', 'z'.repeat(64)]) assert.equal((await f.request(endpoint, { body: input({ expectedBuildId }) })).status, 400);
  assert.equal((await f.request(endpoint, { body: input({ expectedBuildId: '0'.repeat(64) }) })).status, 409);
  assert.equal(f.calls.length, 0); assert.equal(f.ledger().length, 0);
  const body = input({ expectedBuildId: state.buildProof.buildId }), result = await f.request(endpoint, { body });
  assert.equal(result.status, 200); assert.equal(result.data.buildId, state.buildProof.buildId); assert.equal(f.ledger()[0].buildId, state.buildProof.buildId);
  assert.deepEqual((await f.request(endpoint, { body })).data, result.data);
  const row = f.ledger()[0]; f.app.store.put('computerAIRequests', row.id, { ...row, buildId: '1'.repeat(64) });
  const mismatch = await f.request(endpoint, { body }); assert.equal(mismatch.status, 409); assert.equal(mismatch.data.code, 'SYNK_COMPUTER_AI_BUILD_MISMATCH');
  assert.equal(f.calls.length, 1);
});

test('status without administrator rights opens no ledger transaction, and the retained input fingerprint is keyed', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'synk-computer-status-')), store = new Store(directory), env = envDefaults();
  let service;
  t.after(async () => { await service?.stop(); store.close(); assert.equal(dirname(resolve(directory)), resolve(tmpdir())); assert.ok(directory.includes('synk-computer-status-')); await rm(directory, { recursive: true, force: true }); });
  const admin = store.createUser({ name: 'Fixture admin', email: 'admin@computer-status.example.test', role: 'admin' });
  const member = store.createUser({ name: 'Fixture member', email: 'member@computer-status.example.test', role: 'member' });
  service = createComputerInterpretationService({ store, clock: () => at, getEnv: name => env[name], fetchImpl: async () => response() });
  let transactions = 0; const transaction = store.transaction.bind(store);
  store.transaction = fn => { transactions++; return transaction(fn); };
  // GET /api/computer-interpretation is reachable without a login.
  assert.equal(service.state(null).reason, 'session-required'); assert.equal(service.state(member).reason, 'admin-required');
  assert.equal(transactions, 0);
  assert.equal(service.state(admin).available, true); assert.ok(transactions > 0);
  const body = input(), first = await service.interpret(admin, body), row = store.all('computerAIRequests')[0];
  assert.match(row.digest, /^[0-9a-f]{64}$/);
  // The other request fields stay in the same row after deletion or expiry. An unkeyed
  // hash would let that row alone confirm a guessed source sentence.
  const retained = { id: row.requestUUID, requestId: row.requestId, sourceId: row.sourceId, revision: row.revision, text };
  assert.notEqual(row.digest, createHash('sha256').update(JSON.stringify(retained)).digest('hex'));
  assert.deepEqual(await service.interpret(admin, body), first);
  await assert.rejects(service.interpret(admin, { ...body, text: text + ' 추가' }), { code: 'SYNK_COMPUTER_AI_CONFLICT' });
  service.removeResponses(admin, {});
  assert.equal(store.all('computerAIRequests')[0].digest, row.digest);
});
