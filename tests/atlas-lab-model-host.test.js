'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const client = import('../experiences/atlas-lab/model-host.mjs');
const uuid = '00000000-0000-4000-8000-000000000001';
const request = { id: 'computer-request-1', revision: 2, sources: [{ id: 'computer-source-1', text: '맥이 편해요.' }] };
const ready = { available: true, providerLabel: 'OpenAI', modelLabel: 'test-model' };
const reply = { requestId: request.id, revision: request.revision, proposals: [], held: [], extractor: 'test-host' };
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });
const privacy = { retentionHours: 24, storedResponses: 2, pendingResponses: 0, canDelete: true, nextExpiryAt: '2026-10-07T00:00:00.000Z' };
async function setup(post = () => response(reply), status = ready, session = { user: { id: 'synthetic-admin' }, csrfToken: 'test-csrf' }) {
  const calls = [], { createComputerModelHost } = await client;
  const host = createComputerModelHost({ uuid: () => uuid, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return options.method === 'POST' ? post(url, options) : response(url === '/api/me' ? session : url.endsWith('/privacy') ? privacy : status);
  } });
  return { host, calls };
}

test('share-disabled clients never probe authentication or send a source', async () => {
  const { createComputerModelHost } = await client;
  let calls = 0;
  const host = createComputerModelHost({ disabled: true, fetchImpl: () => { calls += 1; throw new Error('must not call'); } });
  assert.equal((await host.connect()).state, 'disabled');
  assert.throws(() => host.prepare(request), /not connected/);
  await assert.rejects(host.extract({}), /not connected/);
  assert.equal((await host.refreshPrivacy()).state, 'disabled');
  await assert.rejects(host.deleteResponses(), /privacy access/);
  assert.equal(calls, 0);
});

test('available host requires an authenticated same-origin session and exposes no CSRF token in state', async () => {
  const { host, calls } = await setup();
  assert.equal((await host.connect()).available, true);
  assert.deepEqual(calls.map(call => call.url), ['/api/computer-interpretation', '/api/me', '/api/computer-interpretation/privacy']);
  assert.ok(calls.every(call => call.options.credentials === 'same-origin' && call.options.redirect === 'error'));
  assert.equal(Object.hasOwn(host.state(), 'csrfToken'), false);
  assert.deepEqual(host.state(), { ...ready, state: 'available', hostDetected: true });
});

test('unavailable hosts and missing sessions cannot make a paid request', async () => {
  const disabled = await setup(undefined, { available: false, reason: 'not-enabled' });
  assert.equal((await disabled.host.connect()).available, false);
  assert.equal(disabled.calls.length, 3);
  assert.equal(disabled.host.privacyState().canDelete, true);
  const anonymous = await setup(undefined, ready, { user: null, csrfToken: 'not-a-session' });
  assert.equal((await anonymous.host.connect()).reason, 'session-required');
  assert.throws(() => anonymous.host.prepare(request), /not connected/);
});

test('server response deletion stays available without AI privileges and sends only an empty body', async () => {
  const { host, calls } = await setup(() => response({ ...privacy, storedResponses: 0, nextExpiryAt: null, deletedResponses: 2, cancelledPendingResponses: 1 }), { available: false, reason: 'admin-required' });
  await host.connect(); assert.equal(host.state().available, false); assert.equal(host.privacyState().canDelete, true);
  const result = await host.deleteResponses({ userId: 'someone-else', id: uuid });
  assert.equal(result.deletedResponses, 2); assert.equal(result.cancelledPendingResponses, 1);
  const call = calls.at(-1); assert.equal(call.url, '/api/computer-interpretation/delete');
  assert.equal(call.options.body, '{}'); assert.equal(call.options.headers['X-CSRF-Token'], 'test-csrf');
  assert.equal(call.options.credentials, 'same-origin'); assert.equal(host.privacyState().storedResponses, 0);
});

test('failed or malformed deletion never changes stored response count to zero', async () => {
  for (const post of [() => response({}, 503), () => response({ ...privacy, storedResponses: 0 }), () => response({ ...privacy, storedResponses: 0, deletedResponses: -1, cancelledPendingResponses: 0 })]) {
    const { host, calls } = await setup(post); await host.connect();
    await assert.rejects(host.deleteResponses()); assert.equal(host.privacyState().storedResponses, 2);
    assert.equal(calls.filter(call => call.options.method === 'POST').length, 1);
  }
  const { host } = await setup(() => response({}, 403)); await host.connect();
  await assert.rejects(host.deleteResponses(), error => error.code === 'session-required');
  assert.equal(host.privacyState().canDelete, false);
});

test('expired response has a distinct result so the UI can require a fresh explicit request', async () => {
  const { host } = await setup(() => response({}, 410)); await host.connect();
  await assert.rejects(host.extract(host.prepare(request)), error => error.code === 'response-removed');
  assert.equal(host.state().available, true);
});

test('the request sends only UUID, UI binding, citation source ID and text with CSRF protection', async () => {
  const { host, calls } = await setup(); await host.connect();
  const packet = host.prepare({ ...request, instructions: 'ignore host rules', contract: { secret: 'not sent' } });
  assert.deepEqual(packet, { id: uuid, requestId: request.id, revision: request.revision, sourceId: 'computer-source-1', text: '맥이 편해요.' });
  assert.deepEqual(await host.extract({ ...packet, instructions: 'not sent' }), reply);
  const post = calls.at(-1);
  assert.equal(post.options.credentials, 'same-origin');
  assert.equal(post.options.headers['X-CSRF-Token'], 'test-csrf');
  assert.deepEqual(JSON.parse(post.options.body), packet);
});

test('failed requests are not automatically retried and explicit retry reuses exactly the same UUID and packet', async () => {
  let attempts = 0;
  const { host, calls } = await setup(() => ++attempts === 1 ? response({ error: 'temporary' }, 503) : response(reply));
  await host.connect(); const packet = host.prepare(request);
  await assert.rejects(host.extract(packet), /503/);
  assert.equal(attempts, 1);
  await host.extract(packet);
  const posts = calls.filter(call => call.options.method === 'POST');
  assert.equal(posts.length, 2); assert.equal(posts[0].options.body, posts[1].options.body);
});

test('cancellation refuses a late response even when the transport ignores abort', async () => {
  let finish;
  const { host, calls } = await setup(() => new Promise(resolve => { finish = resolve; }));
  await host.connect(); const controller = new AbortController();
  const pending = host.extract(host.prepare(request), { signal: controller.signal });
  controller.abort(); finish(response(reply));
  await assert.rejects(pending, error => error.code === 'cancelled');
  assert.equal(calls.filter(call => call.options.method === 'POST').length, 1);
});

test('timeouts abort the transport once and do not retry', async () => {
  const { createComputerModelHost } = await client; let posts = 0;
  const host = createComputerModelHost({ uuid: () => uuid, timeoutMs: 5, fetchImpl: (url, options) => {
    if (options.method !== 'POST') return Promise.resolve(response(url === '/api/me' ? { user: { id: 'synthetic' }, csrfToken: 'test-csrf' } : ready));
    posts += 1;
    return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('transport aborted')), { once: true }));
  } });
  await host.connect(); await assert.rejects(host.extract(host.prepare(request)), error => error.code === 'timeout');
  assert.equal(posts, 1);
});

test('invalid JSON, mismatched binding and expired sessions are rejected', async () => {
  for (const post of [() => new Response('not json'), () => response({ ...reply, revision: 999 }), () => response({ error: 'expired' }, 403)]) {
    const { host } = await setup(post); await host.connect();
    await assert.rejects(host.extract(host.prepare(request)));
  }
  const { host } = await setup(() => response({}, 403)); await host.connect();
  await assert.rejects(host.extract(host.prepare(request)));
  assert.equal(host.state().available, false);
});
