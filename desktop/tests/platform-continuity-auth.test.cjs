'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { configuration } = require('../src/auth-config.cjs');
const { createAuthService } = require('../src/auth-service.cjs');
const { createTokenStore } = require('../src/auth-store.cjs');

const origin = 'https://platform-contract.invalid';
const clients = ['platform', 'world', 'messenger', 'teacher', 'fortune', 'care', 'rehearsal', 'family-album', 'path'];
const raw = {
  version: 1, supabaseUrl: origin, accountApiUrl: origin, supabasePublishableKey: 'sb_publishable_synthetic',
  clients: Object.fromEntries(clients.map((id, index) => [id, {
    clientId: 'synthetic-' + id,
    redirectUri: `http://127.0.0.1:${21000 + index}/synk/oauth/${id}/callback`,
  }])),
};
// The pre-clientKey Platform vault was bound to these complete identity fields.
function legacyPlatformFingerprint(value = raw) {
  return crypto.createHash('sha256').update(JSON.stringify({
    version: 1, supabaseUrl: value.supabaseUrl, accountApiUrl: value.accountApiUrl,
    publishableKey: value.supabasePublishableKey, clientId: value.clients.platform.clientId,
    redirectUri: value.clients.platform.redirectUri, product: 'platform',
  })).digest('hex');
}
const secure = {
  isEncryptionAvailable: () => true,
  encryptString(text) {
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.alloc(32, 7), Buffer.alloc(12, 9));
    return Buffer.concat([cipher.update(text), cipher.final(), cipher.getAuthTag()]);
  },
  decryptString(data) {
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.alloc(32, 7), Buffer.alloc(12, 9));
    decipher.setAuthTag(data.subarray(-16));
    return Buffer.concat([decipher.update(data.subarray(0, -16)), decipher.final()]).toString();
  },
};
const document = () => ({ version: 1, consent: true, favorites: ['world'], recent: [], rememberRecent: true, notes: [] });

async function fixture(t, client = 'platform') {
  const tempRoot = path.resolve(os.tmpdir()), directory = await fs.mkdtemp(path.join(tempRoot, 'synk-platform-contract-'));
  const config = configuration(raw, client, 'development');
  const makeStore = configFingerprint => createTokenStore({ directory, safeStorage: secure, scope: client, configFingerprint, platform: 'win32' });
  const oldStore = makeStore(client === 'platform' ? legacyPlatformFingerprint() : config.fingerprint);
  await oldStore.save({ refreshToken: 'synthetic-refresh-initial', subject: 'synthetic-auth-subject' });
  const store = makeStore(config.fingerprint), requests = [];
  let row = { revision: 0, state: null };
  const reply = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  const fetcher = async (url, options = {}) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, origin, 'only the injected synthetic transport may be called');
    requests.push({ path: parsed.pathname, query: Object.fromEntries(parsed.searchParams), method: options.method || 'GET', body: options.body, headers: options.headers });
    if (parsed.pathname === '/auth/v1/oauth/token') {
      assert.equal(options.body.get('grant_type'), 'refresh_token');
      assert.equal(options.body.get('client_id'), raw.clients[client].clientId);
      return reply({ token_type: 'bearer', access_token: 'synthetic-access', refresh_token: 'synthetic-refresh-rotated', expires_in: 3600 });
    }
    if (parsed.pathname === '/auth/v1/user') return reply({ id: 'synthetic-auth-subject' });
    if (parsed.pathname === '/functions/v1/synk-account') return reply({ ok: true, account: { synk_user_id: 'synthetic-synk-owner', status: 'active', profile: {} }, sessions: [], memberships: [], entitlements: [] });
    assert.equal(parsed.pathname, '/functions/v1/synk-personal');
    const body = options.body === undefined ? null : JSON.parse(options.body);
    assert.equal(body ? body.resource : parsed.searchParams.get('resource'), 'platform-library');
    if (body) {
      if (body.expected_revision !== row.revision) return reply({ ok: false, error: { code: 'REVISION_CONFLICT' }, revision: row.revision }, 409);
      assert.ok(['save', 'delete'].includes(body.action));
      row = { revision: row.revision + 1, state: body.action === 'save' ? body.state : null };
    }
    return reply({ ok: true, scope: 'synk-personal', resource: 'platform-library', accountId: 'synthetic-synk-owner', updatedAt: null, ...row });
  };
  const service = createAuthService({ config, store, fetcher, openExternal: async () => assert.fail('no browser or real login is used'), now: () => 1000000 });
  t.after(async () => {
    service.dispose();
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), tempRoot);
    assert.ok(path.basename(resolved).startsWith('synk-platform-contract-'));
    await fs.rm(resolved, { recursive: true, force: true });
  });
  assert.equal((await service.initialize()).signedIn, true, 'the encrypted synthetic session must restore through normal configuration');
  return { config, service, store, oldStore, makeStore, requests };
}

test('resolved Platform configuration restores its vault and reaches library load, CAS save and delete through auth service', async t => {
  const f = await fixture(t);
  const loaded = await f.service.accountRequest('platformLoad');
  assert.equal(loaded.ok, true, JSON.stringify(loaded));
  assert.equal(f.config.clientKey, 'platform');
  assert.equal(loaded.state, null);
  assert.equal(loaded.resource, 'platform-library');
  const state = document();
  const saved = await f.service.accountRequest('platformSave', { expected_revision: 0, state });
  assert.equal(saved.ok, true); assert.equal(saved.revision, 1); assert.deepEqual(saved.state, state);
  const conflict = await f.service.accountRequest('platformSave', { expected_revision: 0, state: { ...state, favorites: ['care'] } });
  assert.equal(conflict.error.code, 'REVISION_CONFLICT'); assert.equal(conflict.revision, 1); assert.equal(conflict.error.status, 409);
  assert.deepEqual((await f.service.accountRequest('platformLoad')).state, state);
  const removed = await f.service.accountRequest('platformDelete', { expected_revision: 1 });
  assert.equal(removed.ok, true); assert.equal(removed.revision, 2); assert.equal(removed.state, null);
  const calls = f.requests.filter(request => request.path === '/functions/v1/synk-personal');
  assert.equal(calls.length, 5); assert.deepEqual(calls[0].query, { resource: 'platform-library' });
  assert.deepEqual(JSON.parse(calls[1].body), { resource: 'platform-library', action: 'save', expected_revision: 0, state });
  assert.deepEqual(JSON.parse(calls[4].body), { resource: 'platform-library', action: 'delete', expected_revision: 1 });
  for (const call of calls) { assert.equal(call.headers['X-SYNK-Product'], 'platform'); assert.equal(call.headers.Authorization, 'Bearer synthetic-access'); }
  assert.doesNotMatch(JSON.stringify({ loaded, saved, removed, status: f.service.status() }), /synthetic-access|synthetic-refresh/);
});

test('derived Platform clientKey preserves only its legacy vault binding while identity changes remain fenced', async t => {
  const f = await fixture(t);
  assert.equal(f.config.fingerprint, legacyPlatformFingerprint());
  assert.deepEqual(await f.oldStore.load(), await f.store.load(), 'the pre-update encrypted vault remains readable after refresh');
  for (const changed of [
    { ...raw, supabaseUrl: 'https://different-auth.invalid' },
    { ...raw, accountApiUrl: 'https://different-account.invalid' },
    { ...raw, supabasePublishableKey: 'sb_publishable_different' },
    { ...raw, clients: { ...raw.clients, platform: { ...raw.clients.platform, clientId: 'different-oauth-audience' } } },
    { ...raw, clients: { ...raw.clients, platform: { ...raw.clients.platform, redirectUri: 'http://127.0.0.1:24000/synk/oauth/platform/callback' } } },
  ]) {
    const config = configuration(changed, 'platform', 'development');
    assert.notEqual(config.fingerprint, f.config.fingerprint);
    await assert.rejects(f.makeStore(config.fingerprint).load(), /INVALID_TOKEN_STORE/);
  }
  for (const client of ['world', 'messenger']) assert.notEqual(configuration(raw, client, 'development').fingerprint, f.config.fingerprint);
});

test('other configured native clients cannot use Platform library operations', async t => {
  for (const client of clients.filter(id => id !== 'platform')) {
    const f = await fixture(t, client), before = f.requests.length;
    for (const [operation, params] of [['platformLoad', {}], ['platformSave', { expected_revision: 0, state: document() }], ['platformDelete', { expected_revision: 0 }]]) {
      const result = await f.service.accountRequest(operation, params);
      assert.equal(result.error.code, 'INVALID_REQUEST', client + '/' + operation);
    }
    assert.equal(f.requests.length, before, 'another client must not send a library request');
    assert.equal(f.service.status().signedIn, true);
  }
});

test('Platform library parameters cannot replace resource, action or account owner', async t => {
  const f = await fixture(t), before = f.requests.length;
  for (const [operation, params] of [
    ['platformLoad', { resource: 'family-album' }],
    ['platformSave', { expected_revision: 0, state: document(), resource: 'family-album' }],
    ['platformDelete', { expected_revision: 0, action: 'save' }],
    ['platformLoad', { accountId: 'another-synthetic-owner' }],
  ]) assert.equal((await f.service.accountRequest(operation, params)).error.code, 'INVALID_REQUEST');
  assert.equal(f.requests.length, before);
});
