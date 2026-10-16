'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { requestSpec } = require('../src/account-requests.cjs');
const { createAuthService } = require('../src/auth-service.cjs');
const { LIMITS } = require('../src/personal-requests.cjs');
const document = () => ({ version: 1, reviews: [], overrides: [] });
async function fixture(t, { owner = 'synthetic-owner', scope = 'synk-personal', resource = 'member-understanding', product = 'platform', clientKey = 'platform', delay, oversized = false } = {}) {
  let vault = { refreshToken: 'synthetic-refresh', subject: 'synthetic-subject' }, row = { revision: 0, state: null };
  const requests = [];
  const config = { product, clientKey, clientId: 'synthetic-client', supabaseUrl: 'https://synthetic.invalid', accountApiUrl: 'https://synthetic.invalid', publishableKey: 'synthetic-key' };
  const reply = (value, status = 200) => new Response(JSON.stringify(value), { status });
  const service = createAuthService({ config, now: () => 1000, openExternal: async () => assert.fail('No UI or login'),
    store: { available: () => true, load: async () => vault, save: async value => { vault = value; }, clear: async () => { vault = null; } },
    fetcher: async (url, options = {}) => {
      requests.push({ url, ...options });
      if (url.endsWith('/auth/v1/oauth/token')) return reply({ token_type: 'bearer', access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', expires_in: 3600 });
      if (url.endsWith('/auth/v1/user')) return reply({ id: 'synthetic-subject' });
      if (url.endsWith('/functions/v1/synk-account')) return reply({ ok: true, account: { synk_user_id: 'synthetic-owner', status: 'active', profile: {} }, sessions: [] });
      assert.ok(url.includes('/functions/v1/synk-personal'));
      const body = options.body && JSON.parse(options.body);
      assert.equal(body?.resource || new URL(url).searchParams.get('resource'), 'member-understanding');
      if (body) {
        if (body.expected_revision !== row.revision) return reply({ ok: false, error: { code: 'REVISION_CONFLICT' }, revision: row.revision }, 409);
        row = { revision: row.revision + 1, state: body.action === 'delete' ? null : body.state };
      }
      await delay?.();
      return reply({ ok: true, scope, resource, accountId: owner, updatedAt: null, ...row, ...oversized ? { extra: 'x'.repeat(300000) } : {} });
    } });
  t.after(() => service.dispose());
  assert.equal((await service.initialize()).signedIn, true);
  return { service, requests, vault: () => vault };
}

test('understanding operations fix member-understanding resource and accept only the Platform host', () => {
  assert.equal(requestSpec('understandingLoad', {}, '1', 'platform', 'platform').path, 'synk-personal?resource=member-understanding');
  assert.deepEqual(requestSpec('understandingSave', { expected_revision: 2, state: document() }, '1', 'platform', 'platform').body,
    { resource: 'member-understanding', action: 'save', expected_revision: 2, state: document() });
  assert.equal(requestSpec('understandingDelete', { expected_revision: 2 }, '1', 'platform', 'platform').body.action, 'delete');
  for (const [product, client] of [['world', 'world'], ['messenger', 'messenger'], ['platform', 'path'], ['platform', 'member-understanding'], ['platform', undefined]])
    for (const operation of ['understandingLoad', 'understandingSave', 'understandingDelete']) assert.throws(() => requestSpec(operation, {}, '1', product, client), { code: 'INVALID_REQUEST' });
  for (const params of [{ accountId: 'other' }, { resource: 'platform-library' }, { url: 'https://other.invalid' }])
    assert.throws(() => requestSpec('understandingLoad', params, '1', 'platform', 'platform'), { code: 'INVALID_REQUEST' });
  assert.throws(() => requestSpec('personalLoad', {}, '1', 'platform', 'member-understanding'), { code: 'INVALID_REQUEST' });
  assert.throws(() => requestSpec('understandingSave', { expected_revision: 0, state: { body: 'x'.repeat(LIMITS['member-understanding']) } }, '1', 'platform', 'platform'), { code: 'INVALID_REQUEST' });
});

test('understanding account path preserves CAS load/save/delete semantics and strips credentials', async t => {
  const f = await fixture(t);
  assert.equal((await f.service.accountRequest('understandingLoad', {})).state, null);
  const saved = await f.service.accountRequest('understandingSave', { expected_revision: 0, state: document() });
  assert.equal(saved.revision, 1);assert.deepEqual(saved.state, document());
  assert.equal((await f.service.accountRequest('understandingSave', { expected_revision: 0, state: document() })).error.code, 'REVISION_CONFLICT');
  assert.equal((await f.service.accountRequest('understandingDelete', { expected_revision: 1 })).state, null);
  assert.equal(f.service.status().signedIn, true);
  assert.doesNotMatch(JSON.stringify(saved), /synthetic-access|synthetic-refresh/);
});

test('document-version deletion acknowledgement is confined to member-understanding and survives transport', async t => {
  for (const document_version of [1, 2, 3, 4, 5, 6, 7]) assert.deepEqual(requestSpec('understandingDelete', { expected_revision: 7, document_version }, '1', 'platform', 'platform').body,
    { resource: 'member-understanding', action: 'delete', expected_revision: 7, document_version });
  for (const document_version of [0, 8, '2', null, undefined]) assert.throws(() => requestSpec('understandingDelete', { expected_revision: 7, document_version }, '1', 'platform', 'platform'), { code: 'INVALID_REQUEST' });
  for (const operation of ['platformDelete', 'insightDelete']) assert.throws(() => requestSpec(operation, { expected_revision: 7, document_version: 2 }, '1', 'platform', 'platform'), { code: 'INVALID_REQUEST' });
  const f = await fixture(t), state = { version: 2, reviews: [], overrides: [], statements: [] };
  await f.service.accountRequest('understandingSave', { expected_revision: 0, state });
  const deleted = await f.service.accountRequest('understandingDelete', { expected_revision: 1, document_version: 3 });
  assert.equal(deleted.state, null);assert.equal(deleted.revision, 2);
  assert.deepEqual(JSON.parse(f.requests.at(-1).body), { resource: 'member-understanding', action: 'delete', expected_revision: 1, document_version: 3 });
});

test('foreign account, scope, or resource never reaches the renderer and clears the invalid session', async t => {
  for (const altered of [{ owner: 'other-account' }, { scope: 'synk-care' }, { resource: 'platform-library' }]) {
    const f = await fixture(t, altered), result = await f.service.accountRequest('understandingLoad', {});
    assert.equal(result.ok, false);assert.equal(result.error.code, 'AUTH_REQUIRED');
    assert.equal(result.state, undefined);assert.equal(f.service.status().signedIn, false);assert.equal(f.vault(), null);
  }
});

test('other native clients are rejected before transport and oversized replies cannot reach the screen', async t => {
  for (const entry of [{ product: 'world', clientKey: 'world' }, { product: 'messenger', clientKey: 'messenger' }, { product: 'platform', clientKey: 'path' }]) {
    const f = await fixture(t, entry), count = f.requests.length;
    assert.equal((await f.service.accountRequest('understandingLoad', {})).error.code, 'INVALID_REQUEST');
    assert.equal(f.requests.length, count);
  }
  const f = await fixture(t, { oversized: true });
  assert.equal((await f.service.accountRequest('understandingLoad', {})).error.code, 'AUTH_FAILED');
});

test('a reply from a previous account epoch is rejected after disposal', async t => {
  let release;const gate = new Promise(resolve => { release = resolve; });
  let entered;const called = new Promise(resolve => { entered = resolve; });
  const f = await fixture(t, { delay: () => { entered();return gate; } });
  const reading = f.service.accountRequest('understandingLoad', {});await called;f.service.dispose();release();
  assert.equal((await reading).error.code, 'AUTH_CHANGED');
});
