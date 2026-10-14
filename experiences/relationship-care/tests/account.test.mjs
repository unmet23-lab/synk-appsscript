import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createCareAccount } from '../account.mjs';
import { createCareSync } from '../care-sync.mjs';
import { createProductAccount } from '../../synk-account/src/product-account.mjs';
import { emptyState, makePerson, rememberDraft, importBackup } from '../model.mjs';
import * as core from '../../synk-account/src/core.mjs';

const SESSION = 'synk.oauth.session.care';
const config = { version: 1, supabaseUrl: 'https://auth.example.test', accountApiUrl: 'https://api.example.test', supabasePublishableKey: 'sb_publishable_fixture', portalUrl: 'https://portal.example.test', clients: { care: { clientId: 'fixture-care', redirectUri: 'http://127.0.0.1:4296/' } } };
const configKey = [config.supabaseUrl, config.accountApiUrl, config.clients.care.clientId, config.clients.care.redirectUri].join('|');
const reply = (data, status = 200) => new Response(status === 204 ? null : JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const envelope = (accountId = 'fixture-a', state = null, revision = 0) => ({ ok: true, scope: 'synk-care', accountId, revision, updatedAt: null, state });
const pushEnvelope = (accountId = 'fixture-a') => ({ ok: true, scope: 'synk-care-push', accountId, enabled: false, hour: 9, minute: 0, timeZone: 'Asia/Seoul', publicKey: 'B'.repeat(87) });
function memoryStorage() { const values = new Map(); return { get length() { return values.size; }, key: index => [...values.keys()][index] ?? null, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key), values }; }
function setup({ restored = true, configValue = config, storage = memoryStorage(), handler } = {}) {
  const calls = [], statuses = []; let url = 'http://127.0.0.1:4296/', navigated = null;
  if (restored) storage.setItem(SESSION, JSON.stringify({ access_token: 'fixture-access', refresh_token: 'fixture-refresh', expires_at: Date.now() + 3600000, configKey }));
  const fetcher = async (input, options = {}) => {
    const call = { url: String(input), ...options }; calls.push(call);
    const custom = await handler?.(call); if (custom) return custom;
    if (call.url.endsWith('/api/account-config')) return reply(configValue);
    if (call.url.endsWith('/auth/v1/oauth/token')) return reply({ access_token: 'fixture-rotated', refresh_token: 'fixture-rotated-refresh', expires_in: 3600 });
    if (call.url.endsWith('/functions/v1/synk-care')) return reply(envelope());
    if (call.url.endsWith('/functions/v1/synk-account')) return reply(options.method === 'GET' ? { ok: true, sessions: [{ id: 'fixture-session', current: true, revoked: false }] } : { ok: true });
    if (call.url.endsWith('/auth/v1/logout?scope=local')) return reply(null, 204);
    throw Error('Unexpected fixture URL');
  };
  const options = { onStatus: s => statuses.push(s), storage, fetcher, getUrl: () => url, replaceUrl: next => { url = next; }, navigate: next => { navigated = next; }, loadCore: async () => core, cryptoAPI: webcrypto };
  return { create: () => createCareAccount(options), calls, statuses, storage, setUrl: value => { url = value; }, getUrl: () => url, navigated: () => navigated, options };
}

test('push settings use the same private session and a fixed Care-only route', async () => {
  const f = setup({ handler: call => call.url.endsWith('/synk-care-push') ? reply(pushEnvelope()) : null }), account = f.create();
  await account.start();
  assert.equal((await account.requestPush('status')).enabled, false);
  const call = f.calls.at(-1);
  assert.equal(call.url, 'https://api.example.test/functions/v1/synk-care-push');
  assert.deepEqual(JSON.parse(call.body), { action: 'status' });
  assert.equal(call.headers.Authorization, 'Bearer fixture-access'); assert.equal(call.redirect, 'error');
  const count = f.calls.length;
  for (const [action, body] of [['dispatch', {}], ['status', { accountId: 'foreign' }], ['update', { endpoint: 'https://fcm.googleapis.com/fcm/send/fixture', hour: 24, minute: 0 }], ['unsubscribe', { endpoint: 'http://localhost/' }]]) await assert.rejects(account.requestPush(action, body));
  assert.equal(f.calls.length, count);
  assert.equal(JSON.stringify(account.status()).includes('fixture-access'), false); account.dispose();
});

test('push response from another account is refused and clears the old session', async () => {
  const f = setup({ handler: call => call.url.endsWith('/synk-care-push') ? reply(pushEnvelope('foreign')) : null }), account = f.create();
  await account.start(); await assert.rejects(account.requestPush('status'), { code: 'ACCOUNT_CHANGED' });
  assert.equal(account.status().signedIn, false); account.dispose();
});

test('push gateway 401 after one refresh clears the rejected login', async () => {
  const f = setup({ handler: call => call.url.endsWith('/synk-care-push') ? reply({ code: 401, message: 'Invalid JWT' }, 401) : null }), account = f.create();
  await account.start(); await assert.rejects(account.requestPush('status'), { code: 'AUTH_REQUIRED' });
  assert.equal(f.calls.filter(call => call.url.endsWith('/oauth/token')).length, 1);
  assert.equal(account.status().signedIn, false); account.dispose();
});

test('push request cannot commit after logout while network was pending', async () => {
  const pending = deferred(), f = setup({ handler: call => call.url.endsWith('/synk-care-push') ? pending.promise : null }), account = f.create();
  await account.start(); const request = account.requestPush('status');
  await account.signOut(); pending.resolve(reply(pushEnvelope()));
  await assert.rejects(request, { code: 'ACCOUNT_CHANGED' }); account.dispose();
});

test('push server unavailability preserves notebook login and rotated auth is reused', async () => {
  let unavailable = false;
  const f = setup({ handler: call => call.url.endsWith('/synk-care-push') ? unavailable ? reply({ ok: false, error: { code: 'PUSH_UNAVAILABLE' } }, 503) : call.headers.Authorization === 'Bearer fixture-access' ? reply({ ok: false }, 401) : reply(pushEnvelope()) : null }), account = f.create();
  await account.start(); await account.requestPush('status');
  assert.equal(f.calls.filter(call => call.url.endsWith('/oauth/token')).length, 1);
  unavailable = true; await assert.rejects(account.requestPush('status'), { code: 'PUSH_UNAVAILABLE' });
  assert.equal(account.status().signedIn, true); account.dispose();
});

test('missing config stays explicitly unconfigured without auth or care traffic', async () => {
  const f = setup({ configValue: { version: 1 } }), account = f.create();
  assert.equal((await account.start()).status, 'unconfigured');
  await assert.rejects(account.signIn(), { code: 'AUTH_CONFIG' });
  assert.equal(f.calls.length, 1); account.dispose();
});

test('temporary notebook outage preserves the browser login and reconnects without another OAuth redirect', async () => {
  let unavailable = true;
  const f = setup({ handler: call => unavailable && call.url.endsWith('/synk-care') ? reply({ ok: false }, 503) : null }), account = f.create();
  const failed = await account.start();
  assert.equal(failed.signedIn, false); assert.equal(failed.accountId, null); assert.equal(failed.error.retryable, true);
  assert.ok(f.storage.getItem(SESSION), 'temporary failure must not erase the saved login');
  await assert.rejects(account.request('careLoad'), { code: 'AUTH_REQUIRED' });
  unavailable = false;
  assert.equal((await account.signIn()).accountId, 'fixture-a');
  assert.equal(f.navigated(), null); assert.equal(f.calls.filter(call => call.url.endsWith('/oauth/token')).length, 0);
  account.dispose();
});

test('configuration network failure is retryable and never presented as missing setup', async () => {
  let unavailable = true;
  const f = setup({ handler: call => { if (unavailable && call.url.endsWith('/api/account-config')) throw Error('offline'); } }), account = f.create();
  const failed = await account.start();
  assert.equal(failed.status, 'error'); assert.equal(failed.error.code, 'NETWORK'); assert.equal(failed.error.retryable, true);
  assert.ok(f.storage.getItem(SESSION));
  unavailable = false;
  assert.equal((await account.signIn()).signedIn, true); assert.equal(f.navigated(), null); account.dispose();
});

test('reconnect coalesces concurrent starts and logout cancels a late restoration', async () => {
  const pending = deferred(); let phase = 'offline';
  const f = setup({ handler: call => call.url.endsWith('/synk-care') ? phase === 'offline' ? reply({ ok: false }, 503) : pending.promise : null }), account = f.create();
  await account.start(); phase = 'waiting';
  const first = account.start(), second = account.start();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.calls.filter(call => call.url.endsWith('/synk-care')).length, 2);
  await account.signOut(); pending.resolve(reply(envelope())); await Promise.all([first, second]);
  assert.equal(account.status().status, 'signed-out'); assert.equal(account.status().accountId, null); assert.equal(f.storage.getItem(SESSION), null);
  assert.equal((await account.start()).signedIn, false); account.dispose();
});

test('rejected browser restoration clears credentials instead of allowing a transient retry', async () => {
  const f = setup({ handler: call => call.url.endsWith('/synk-care') ? reply({ ok: false }, 401) : null }), account = f.create();
  const failed = await account.start();
  assert.equal(failed.error.code, 'AUTH_REQUIRED'); assert.equal(failed.error.retryable, false);
  assert.equal(f.storage.getItem(SESSION), null); account.dispose();
});

test('expired login survives a temporary refresh outage and uses rotated credentials when retried', async () => {
  let unavailable = true;
  const f = setup({ handler: call => unavailable && call.url.endsWith('/oauth/token') ? reply({ error: 'temporary' }, 503) : null });
  const session = JSON.parse(f.storage.getItem(SESSION)); session.expires_at = Date.now() - 1000; f.storage.setItem(SESSION, JSON.stringify(session));
  const account = f.create();
  assert.equal((await account.start()).error.retryable, true); assert.ok(f.storage.getItem(SESSION));
  unavailable = false;
  assert.equal((await account.signIn()).signedIn, true); assert.equal(f.navigated(), null);
  assert.equal(f.calls.at(-1).headers.Authorization, 'Bearer fixture-rotated'); account.dispose();
});

test('logout during a reconnect click cannot start another OAuth flow after the late response', async () => {
  const pending = deferred(); let phase = 'offline';
  const f = setup({ handler: call => call.url.endsWith('/synk-care') ? phase === 'offline' ? reply({ ok: false }, 503) : pending.promise : null }), account = f.create();
  await account.start(); phase = 'waiting';
  const reconnect = account.signIn();
  const rejected = assert.rejects(reconnect, { code: 'ACCOUNT_CHANGED' });
  await new Promise(resolve => setImmediate(resolve));
  await account.signOut(); pending.resolve(reply(envelope())); await rejected;
  assert.equal(f.navigated(), null); assert.equal(account.status().signedIn, false); account.dispose();
});

test('reconnect discovers a revoked session and opens fresh authentication on the same click', async () => {
  let status = 503;
  const f = setup({ handler: call => call.url.endsWith('/synk-care') ? reply({ ok: false }, status) : null }), account = f.create();
  await account.start(); status = 401;
  await account.signIn();
  assert.equal(account.status().status, 'signing-in'); assert.equal(f.storage.getItem(SESSION), null);
  assert.equal(new URL(f.navigated()).pathname, '/auth/v1/oauth/authorize'); account.dispose();
});

test('an interrupted login module download preserves credentials and can be retried', async () => {
  let unavailable = true;
  const f = setup(), account = createCareAccount({ ...f.options, loadCore: async () => { if (unavailable) throw new TypeError('module download failed'); return core; } });
  assert.equal((await account.start()).error.retryable, true); assert.ok(f.storage.getItem(SESSION));
  unavailable = false; assert.equal((await account.signIn()).signedIn, true); assert.equal(f.navigated(), null); account.dispose();
});

test('logout during callback module loading cannot exchange a code or restore the account', async () => {
  const module = deferred(), f = setup({ restored: false });
  const auth = new URL(await core.beginOAuth({ config: core.readConfig(config, f.getUrl()), product: 'care', storage: f.storage, cryptoAPI: webcrypto }));
  f.setUrl('http://127.0.0.1:4296/?code=fixture-code&state=' + auth.searchParams.get('state'));
  const account = createCareAccount({ ...f.options, loadCore: () => module.promise });
  const starting = account.start(); await account.signOut(); module.resolve(core); await starting;
  assert.equal(account.status().signedIn, false); assert.equal(account.status().accountId, null);
  assert.equal(f.calls.length, 0); assert.equal(f.storage.getItem(SESSION), null); account.dispose();
});

test('public subpath config stays same-origin and uses the registered public callback', async () => {
  const redirectUri = 'https://care.example.test/care/';
  const publicConfig = { ...config, clients: { care: { clientId: 'fixture-public-care', redirectUri } } };
  const f = setup({ restored: false, handler: call => call.url === redirectUri + 'config.json' ? reply(publicConfig) : null });
  f.setUrl(redirectUri);
  const account = createCareAccount({ ...f.options, configUrl: './config.json' });
  assert.equal((await account.start()).configured, true); await account.signIn();
  const authorization = new URL(f.navigated());
  assert.equal(f.calls[0].url, redirectUri + 'config.json'); assert.equal(f.calls[0].credentials, 'omit'); assert.equal(f.calls[0].redirect, 'error');
  assert.equal(authorization.searchParams.get('client_id'), 'fixture-public-care');
  assert.equal(authorization.searchParams.get('redirect_uri'), redirectUri); account.dispose();
});

test('a public config override never fetches another origin or credential-bearing URL', async () => {
  for (const configUrl of ['https://other.example.test/config.json', 'http://user:pass@127.0.0.1:4296/config.json', './config.json#fragment']) {
    const f = setup({ restored: false }); const account = createCareAccount({ ...f.options, configUrl });
    assert.equal((await account.start()).error.code, 'AUTH_CONFIG'); assert.equal(f.calls.length, 0); account.dispose();
  }
});

test('browser login reuses canonical PKCE and publishes identity only after care verification', async () => {
  const verification = deferred(); let block = false;
  const f = setup({ restored: false, handler: call => block && call.url.endsWith('/synk-care') ? verification.promise : null });
  let account = f.create(); await account.start(); await account.signIn();
  const authorize = new URL(f.navigated()), pending = JSON.parse(f.storage.getItem('synk.oauth.pending.care'));
  assert.equal(authorize.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(authorize.searchParams.get('client_id'), 'fixture-care');
  assert.equal(authorize.searchParams.get('code_challenge'), core.base64url(new Uint8Array(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(pending.verifier)))));
  account.dispose(); f.setUrl(`http://127.0.0.1:4296/?code=fixture-code&state=${pending.state}`); block = true;
  account = f.create(); const starting = account.start();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(account.status().accountId, null); assert.equal(account.status().signedIn, false);
  verification.resolve(reply(envelope())); await starting;
  assert.equal(account.status().accountId, 'fixture-a');
  assert.equal(new URL(f.getUrl()).search, '');
  assert.equal(f.storage.getItem('synk.oauth.pending.care'), null);
  const fields = f.calls.find(call => call.url.endsWith('/oauth/token')).body;
  assert.equal(fields.get('code_verifier'), pending.verifier);
  assert.equal(JSON.stringify(f.statuses).includes('fixture-rotated'), false);
  account.dispose();
});

async function callbackFixture(handler) {
  const f = setup({ restored: false, handler });
  const auth = new URL(await core.beginOAuth({ config: core.readConfig(config, f.getUrl()), product: 'care', storage: f.storage, cryptoAPI: webcrypto }));
  f.setUrl(`http://127.0.0.1:4296/?code=fixture-code&state=${auth.searchParams.get('state')}`);
  return f;
}

test('a temporary callback exchange failure retries the verified PKCE request without another login', async () => {
  let fail = true;
  const f = await callbackFixture(call => fail && call.url.endsWith('/oauth/token') ? reply({ error: 'temporarily_unavailable' }, 503) : null);
  const account = f.create();
  assert.equal((await account.start()).error.retryable, true);
  assert.equal(new URL(f.getUrl()).search, '');
  assert.equal(f.storage.getItem('synk.oauth.pending.care'), null);
  assert.equal(f.storage.getItem(SESSION), null);
  fail = false;
  assert.equal((await account.signIn()).accountId, 'fixture-a');
  assert.equal(f.navigated(), null);
  const exchanges = f.calls.filter(call => call.url.endsWith('/oauth/token'));
  assert.equal(exchanges.length, 2);
  assert.equal(exchanges[0].body.toString(), exchanges[1].body.toString());
  assert.equal(JSON.stringify(f.statuses).includes('fixture-code'), false);
  account.dispose();
});

test('logout discards an interrupted callback exchange before another connection attempt', async () => {
  const f = await callbackFixture(call => call.url.endsWith('/oauth/token') ? reply({}, 503) : null), account = f.create();
  await account.start(); await account.signOut(); await account.start();
  assert.equal(account.status().signedIn, false);
  assert.equal(f.calls.filter(call => call.url.endsWith('/oauth/token')).length, 1);
  assert.equal(f.storage.getItem(SESSION), null);
  account.dispose();
});

test('an interrupted callback is never exchanged against a changed issuer configuration', async () => {
  let changed = false;
  const f = await callbackFixture(call => {
    if (call.url.endsWith('/oauth/token')) return reply({}, 503);
    if (changed && call.url.endsWith('/api/account-config')) return reply({ ...config, supabaseUrl: 'https://changed.example.test' });
  }), account = f.create();
  await account.start(); changed = true;
  const result = await account.start();
  assert.equal(result.signedIn, false);
  assert.equal(result.error?.code, 'AUTH_REQUIRED');
  assert.equal(f.calls.filter(call => call.url.endsWith('/oauth/token')).length, 1);
  account.dispose();
});

test('a rejected callback retry opens fresh login instead of looping the consumed code', async () => {
  let denied = false;
  const f = await callbackFixture(call => call.url.endsWith('/oauth/token') ? reply({}, denied ? 400 : 503) : null), account = f.create();
  await account.start(); denied = true; await account.signIn();
  assert.equal(account.status().status, 'signing-in');
  assert.ok(f.navigated());
  assert.equal(f.calls.filter(call => call.url.endsWith('/oauth/token')).length, 2);
  assert.equal(f.storage.getItem(SESSION), null);
  account.dispose();
});

test('stored login is bound to issuer, API and care OAuth configuration', async () => {
  const f = setup(); const stored = JSON.parse(f.storage.getItem(SESSION)); stored.configKey += '-changed'; f.storage.setItem(SESSION, JSON.stringify(stored));
  const account = f.create(); assert.equal((await account.start()).signedIn, false);
  assert.equal(f.storage.getItem(SESSION), null); assert.equal(f.calls.length, 1); account.dispose();
});

test('care CRUD has fixed route, platform scope, validated snapshot and no public tokens', async () => {
  const f = setup(), account = f.create(); await account.start();
  const state = emptyState(); state.people.push(makePerson({ name: '합성 사람' }));
  await account.request('careSave', { expected_revision: 0, state }); await account.request('careDelete', { expected_revision: 1 });
  const writes = f.calls.filter(call => call.method === 'POST');
  assert.equal(writes.length, 2);
  assert.ok(writes.every(call => call.url === 'https://api.example.test/functions/v1/synk-care' && call.headers['X-SYNK-Product'] === 'platform' && call.redirect === 'error'));
  assert.equal(JSON.parse(writes[0].body).action, 'save');
  assert.equal(Object.hasOwn(JSON.parse(writes[0].body), 'messageLibraryVersion'), false, 'legacy callers keep the unmarked save contract');
  assert.equal(Object.hasOwn(JSON.parse(writes[0].body), 'checkinPreferenceVersion'), false);
  assert.deepEqual(JSON.parse(writes[1].body), { action: 'delete', expected_revision: 1 });
  for (const [operation, body] of [['load', {}], ['careLoad', { accountId: 'other' }], ['careDelete', { expected_revision: -1 }], ['careSave', { expected_revision: 0, state: {} }]]) await assert.rejects(account.request(operation, body));
  assert.equal(JSON.stringify(account.status()).includes('fixture-access'), false);
  account.dispose();
});

test('401 refreshes once through canonical tokenRequest and retries with rotated token', async () => {
  let fail = false;
  const f = setup({ handler: call => fail && call.url.endsWith('/synk-care') && call.headers.Authorization === 'Bearer fixture-access' ? reply({ ok: false }, 401) : null });
  const account = f.create(); await account.start(); fail = true;
  assert.equal((await account.request('careLoad')).accountId, 'fixture-a');
  const tokens = f.calls.filter(call => call.url.endsWith('/oauth/token'));
  assert.equal(tokens.length, 1); assert.equal(tokens[0].body.get('grant_type'), 'refresh_token'); assert.equal(tokens[0].body.get('client_id'), 'fixture-care');
  assert.equal(f.calls.at(-1).headers.Authorization, 'Bearer fixture-rotated'); account.dispose();
});

test('conflict preserves login and conveys current revision without retrying a write', async () => {
  const f = setup({ handler: call => call.url.endsWith('/synk-care') && call.method === 'POST' ? reply({ ok: false, error: { code: 'REVISION_CONFLICT' }, revision: 4 }, 409) : null });
  const account = f.create(); await account.start();
  await assert.rejects(account.request('careDelete', { expected_revision: 0 }), error => error.code === 'REVISION_CONFLICT' && error.status === 409 && error.revision === 4);
  assert.equal(account.status().signedIn, true); assert.equal(f.calls.filter(call => call.method === 'POST').length, 1); account.dispose();
});

test('foreign account response is rejected and cannot remain a signed-in identity', async () => {
  let foreign = false;
  const f = setup({ handler: call => foreign && call.url.endsWith('/synk-care') ? reply(envelope('fixture-b')) : null });
  const account = f.create(); await account.start(); foreign = true;
  await assert.rejects(account.request('careLoad'), { code: 'ACCOUNT_CHANGED' });
  assert.equal(account.status().accountId, null); assert.equal(f.storage.getItem(SESSION), null); account.dispose();
});

test('late response after logout does not restore identity; server sessions are explicitly revoked', async () => {
  const pending = deferred(); let block = false;
  const f = setup({ handler: call => block && call.url.endsWith('/synk-care') ? pending.promise : null });
  const account = f.create(); await account.start(); block = true;
  const request = account.request('careLoad'); const logout = await account.signOut();
  pending.resolve(reply(envelope())); await assert.rejects(request, { code: 'ACCOUNT_CHANGED' });
  assert.equal(account.status().signedIn, false); assert.equal(logout.serverRevoked, true);
  assert.equal(f.storage.getItem(SESSION), null);
  assert.ok(f.calls.some(call => call.url.endsWith('/synk-account') && call.body === JSON.stringify({ action: 'revoke-session', session_id: 'fixture-session' })));
  account.dispose();
});

test('a bootstrap response arriving after logout cannot replace signed-out state with error', async () => {
  const pending = deferred(); const f = setup({ handler: call => call.url.endsWith('/synk-care') ? pending.promise : null }), account = f.create();
  const starting = account.start(); await new Promise(resolve => setImmediate(resolve)); await account.signOut();
  pending.resolve(reply(envelope())); await starting;
  assert.equal(account.status().status, 'signed-out'); assert.equal(account.status().error, null); account.dispose();
});

test('native uses main-owned auth, verifies care owner and ignores older auth snapshots', async () => {
  let listener, source = { configured: true, signedIn: true, status: 'signed-in', sessionGeneration: 2, account: { synk_user_id: 'fixture-a', display_name: '합성 계정' } };
  const calls = [], statuses = [], pending = deferred(); let first = true;
  const bridge = { getEnvironment: async () => ({ clientId: 'care' }), onAuthChanged: fn => { listener = fn; return () => { listener = null; }; }, authStatus: async () => source, authSignIn: async () => source, authSignOut: async () => { source = { configured: true, signedIn: false, status: 'signed-out', sessionGeneration: 4, account: null }; listener(source); return { ok: true }; }, accountRequest: async (action, body) => { calls.push({ action, body }); if (first) { first = false; return pending.promise; } return envelope(source.account.synk_user_id); } };
  const account = createCareAccount({ bridge, onStatus: value => statuses.push(value), fetcher: () => { throw Error('Renderer must not make native auth requests'); } });
  const starting = account.start(); await new Promise(resolve => setImmediate(resolve)); assert.equal(account.status().accountId, null);
  pending.resolve(envelope()); await starting;
  assert.equal(account.status().accountId, 'fixture-a'); assert.equal(calls[0].action, 'careLoad');
  listener({ configured: true, signedIn: false, status: 'signed-out', sessionGeneration: 1 });
  assert.equal(account.status().signedIn, true);
  source = { ...source, sessionGeneration: 3, account: { synk_user_id: 'fixture-b' } }; listener(source);
  await new Promise(resolve => setImmediate(resolve)); assert.equal(account.status().accountId, 'fixture-b');
  await account.signOut(); assert.equal(account.status().accountId, null); account.dispose(); assert.equal(listener, null);
  assert.equal(JSON.stringify(statuses).includes('access_token'), false);
});

test('native rejects a care response for an account different from main verified identity', async () => {
  const source = { configured: true, signedIn: true, status: 'signed-in', sessionGeneration: 1, account: { synk_user_id: 'fixture-a' } };
  const account = createCareAccount({ bridge: { getEnvironment: async () => ({ clientId: 'care' }), onAuthChanged: () => () => {}, authStatus: async () => source, accountRequest: async () => envelope('fixture-b') } });
  const result = await account.start(); assert.equal(result.signedIn, false); assert.equal(result.error.code, 'ACCOUNT_CHANGED'); account.dispose();
});

function nativeRecoveryFixture({ load, signIn, initial, document } = {}) {
  let listener = null, source = initial || { configured: true, signedIn: false, status: 'error', sessionGeneration: 1, account: null, error: { code: 'AUTH_UNAVAILABLE', message: '연결을 다시 확인해 주세요.', retryable: true } };
  const calls = [], emit = next => { source = next; listener?.(source); };
  const signedIn = { configured: true, signedIn: true, status: 'signed-in', sessionGeneration: 1, account: { synk_user_id: 'fixture-a' }, error: null };
  const bridge = {
    getEnvironment: async () => ({ clientId: 'care' }),
    onAuthChanged: fn => { listener = fn; return () => { listener = null; }; },
    authStatus: async () => source,
    authSignIn: async () => { calls.push('oauth'); if (signIn) return signIn({ emit, signedIn }); emit({ ...source, signedIn: false, account: null, status: 'signing-in', error: null }); return source; },
    authSignOut: async () => { calls.push('logout'); emit({ configured: true, signedIn: false, status: 'signed-out', sessionGeneration: source.sessionGeneration + 1, account: null, error: null }); return { ok: true }; },
    accountRequest: async action => { calls.push(action); if (action === 'load') { if (load) return load({ emit, signedIn }); emit(signedIn); return { ok: true }; } assert.equal(action, 'careLoad'); return document ? document() : envelope(); },
  };
  return { bridge, calls, emit, signedIn, create: () => createCareAccount({ bridge }) };
}

test('native retry verifies the main-held saved login through load without starting OAuth', async () => {
  const f = nativeRecoveryFixture(), account = f.create();
  assert.equal((await account.start()).error.retryable, true);
  assert.equal((await account.signIn()).accountId, 'fixture-a');
  assert.deepEqual(f.calls, ['load', 'careLoad']); account.dispose();
});

test('native repeated connectivity failure stays retryable and a later retry restores the same account', async () => {
  let offline = true;
  const f = nativeRecoveryFixture({ load: ({ emit, signedIn }) => { if (offline) return { ok: false, error: { code: 'NETWORK', message: '연결을 다시 확인해 주세요.', retryable: true } }; emit(signedIn); return { ok: true }; } }), account = f.create();
  await account.start(); await assert.rejects(account.signIn(), { code: 'AUTH_UNAVAILABLE', retryable: true });
  assert.equal(account.status().accountId, null); await assert.rejects(account.request('careLoad'), { code: 'AUTH_REQUIRED' });
  offline = false; assert.equal((await account.signIn()).accountId, 'fixture-a'); assert.equal(f.calls.includes('oauth'), false); account.dispose();
});

test('native rejected saved credentials require the next explicit login click before a new OAuth flow', async () => {
  const f = nativeRecoveryFixture({ load: ({ emit }) => { const error = { code: 'AUTH_REQUIRED', message: 'SYNK ID로 다시 로그인해 주세요.', retryable: false }; emit({ configured: true, signedIn: false, status: 'signed-out', sessionGeneration: 2, account: null, error }); return { ok: false, error }; } }), account = f.create();
  await account.start(); await assert.rejects(account.signIn(), { code: 'AUTH_REQUIRED' }); assert.deepEqual(f.calls, ['load']);
  assert.equal((await account.signIn()).status, 'signing-in'); assert.deepEqual(f.calls, ['load', 'oauth']); account.dispose();
});

test('native logout and cancellation during saved-login retry cannot open OAuth or restore a stale identity', async () => {
  for (const action of ['logout', 'cancel']) {
    const pending = deferred(), f = nativeRecoveryFixture({ load: () => pending.promise }), account = f.create();
    await account.start(); const retry = account.signIn(), rejected = assert.rejects(retry, { code: action === 'logout' ? 'ACCOUNT_CHANGED' : 'AUTH_CANCELLED' });
    await new Promise(resolve => setImmediate(resolve));
    if (action === 'logout') await account.signOut();
    else f.emit({ configured: true, signedIn: false, status: 'signed-out', sessionGeneration: 2, account: null, error: { code: 'AUTH_CANCELLED', message: '로그인을 취소했어요.', retryable: false } });
    pending.resolve({ ok: true }); await rejected;
    assert.equal(account.status().signedIn, false); assert.equal(account.status().accountId, null); assert.equal(f.calls.includes('oauth'), false); assert.equal(f.calls.includes('careLoad'), false); account.dispose();
  }
});

test('native restored login waits for product ownership verification and logout fences that late document', async () => {
  for (const logout of [false, true]) {
    const document = deferred(), f = nativeRecoveryFixture({
      load: ({ emit, signedIn }) => { emit({ ...signedIn, signedIn: false, account: null, status: 'restoring' }); emit(signedIn); return { ok: true }; },
      document: () => document.promise,
    }), account = f.create();
    await account.start(); const retry = account.signIn();
    const rejected = logout ? assert.rejects(retry, { code: 'ACCOUNT_CHANGED' }) : null;
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(account.status().signedIn, false); assert.equal(account.status().accountId, null); assert.equal(f.calls.filter(action => action === 'careLoad').length, 1);
    if (logout) await account.signOut();
    document.resolve(envelope());
    if (logout) { await rejected; assert.equal(account.status().accountId, null); }
    else assert.equal((await retry).accountId, 'fixture-a');
    assert.equal(f.calls.includes('oauth'), false); account.dispose();
  }
});

test('native OAuth response arriving after explicit logout cannot restore the old account', async () => {
  const pending = deferred(), f = nativeRecoveryFixture({ initial: { configured: true, signedIn: false, status: 'signed-out', sessionGeneration: 1, account: null, error: null }, signIn: () => pending.promise }), account = f.create();
  await account.start(); const login = account.signIn(), rejected = assert.rejects(login, { code: 'ACCOUNT_CHANGED' });
  await new Promise(resolve => setImmediate(resolve)); await account.signOut(); pending.resolve(f.signedIn); await rejected;
  assert.equal(account.status().signedIn, false); assert.equal(f.calls.includes('careLoad'), false); account.dispose();
});

test('an interrupted successful token response preserves the saved browser login for the next retry', async () => {
  let interrupted = true;
  const f = setup({ handler: call => interrupted && call.url.endsWith('/oauth/token') ? new Response(new ReadableStream({ start(controller) { controller.error(new TypeError('transport interrupted')); } }), { status: 200 }) : null });
  const saved = JSON.parse(f.storage.getItem(SESSION)); saved.expires_at = Date.now() - 1000; f.storage.setItem(SESSION, JSON.stringify(saved));
  const account = f.create(), failed = await account.start();
  assert.equal(failed.error.code, 'NETWORK'); assert.equal(failed.error.retryable, true); assert.ok(f.storage.getItem(SESSION));
  assert.equal(failed.accountId, null); await assert.rejects(account.request('careLoad'), { code: 'AUTH_REQUIRED' });
  interrupted = false; assert.equal((await account.signIn()).accountId, 'fixture-a'); assert.equal(f.navigated(), null); account.dispose();
});

function libraryFixture() {
  return rememberDraft({ ...emptyState(), people: [makePerson({ id: 'fixture-person', name: '합성 문구 사람', checkinIntervalDays: 0 })] }, {
    personId: 'fixture-person', eventId: '', eventType: 'checkin', checkinIntent: 'thanks', text: '지난번 도와주셔서 감사해요.',
  }, new Date('2026-10-08T00:00:00.000Z'));
}

test('signed-in browser sync forwards the library capability through the real account adapter to the save HTTP body', async t => {
  let remote = null, revision = 0;
  const f = setup({ handler: call => {
    if (!call.url.endsWith('/functions/v1/synk-care')) return null;
    if (call.method === 'POST') {
      const body = JSON.parse(call.body);
      assert.equal(body.action, 'save');
      assert.equal(body.messageLibraryVersion, 1);
      assert.equal(body.checkinPreferenceVersion, 1);
      assert.equal(body.expected_revision, revision);
      remote = importBackup(body.state); revision++;
    }
    return reply(envelope('fixture-a', remote, revision));
  } });
  const account = f.create(), states = [], statuses = [];
  const sync = createCareSync({ transport: (action, body) => account.request(action, body), storage: memoryStorage(), onState: value => states.push(value), onStatus: value => statuses.push(value) });
  t.after(() => { sync.close(); account.dispose(); });
  assert.equal((await account.start()).signedIn, true);
  assert.equal(await sync.open(account.status().accountId), true);
  const state = libraryFixture(); sync.change(state);

  assert.equal(await sync.flush(), true);

  assert.equal(statuses.at(-1).status, 'synced');
  assert.deepEqual(remote, state);
  const saves = f.calls.filter(call => call.method === 'POST');
  assert.equal(saves.length, 1);
  assert.deepEqual(JSON.parse(saves[0].body), { action: 'save', expected_revision: 0, state, messageLibraryVersion: 1, checkinPreferenceVersion: 1 });
  assert.equal(saves[0].headers.Authorization, 'Bearer fixture-access');
  assert.equal(saves[0].url, 'https://api.example.test/functions/v1/synk-care');
  assert.equal(account.status().signedIn, true);
  assert.equal(f.calls.filter(call => call.method === 'GET').every(call => !Object.hasOwn(call, 'body')), true);
});

function nativeFixture({ clientKey = 'care', endpoint = 'synk-care', resource = null } = {}) {
  const calls = [];
  let state = null, revision = 0;
  const source = { configured: true, signedIn: true, status: 'signed-in', sessionGeneration: 1, account: { synk_user_id: 'fixture-a' } };
  const bridge = {
    getEnvironment: async () => ({ clientId: clientKey }), onAuthChanged: () => () => {}, authStatus: async () => source,
    accountRequest: async (action, body) => {
      calls.push({ action, body });
      if (action === 'careSave') { state = importBackup(body.state); revision++; }
      else if (action === 'careDelete') { state = null; revision++; }
      return { ...envelope('fixture-a', state, revision), scope: endpoint, ...(resource ? { resource } : {}) };
    },
  };
  return { calls, bridge, create: () => createProductAccount({ clientKey, endpoint, resource, scope: endpoint, validateState: importBackup, bridge }), remote: () => state };
}

test('native sync forwards the library capability to the fixed bridge while legacy save, load and delete stay unmarked', async t => {
  const f = nativeFixture(), account = createCareAccount({ bridge: f.bridge });
  const sync = createCareSync({ transport: (action, body) => account.request(action, body), storage: memoryStorage() });
  t.after(() => { sync.close(); account.dispose(); });
  assert.equal((await account.start()).signedIn, true);
  await account.request('careSave', { expected_revision: 0, state: emptyState() });
  assert.equal(Object.hasOwn(f.calls.at(-1).body, 'messageLibraryVersion'), false);
  assert.equal(Object.hasOwn(f.calls.at(-1).body, 'checkinPreferenceVersion'), false);
  await sync.open('fixture-a');
  const state = libraryFixture(); sync.change(state);

  assert.equal(await sync.flush(), true);

  assert.deepEqual(f.calls.at(-1), { action: 'careSave', body: { expected_revision: 1, state, messageLibraryVersion: 1, checkinPreferenceVersion: 1 } });
  assert.deepEqual(f.remote(), state);
  assert.equal(await sync.remove(), true);
  assert.deepEqual(f.calls.at(-1), { action: 'careDelete', body: { expected_revision: 2 } });
  for (const call of f.calls.filter(call => call.action === 'careLoad')) assert.deepEqual(call.body, {});
});

test('browser and native reject invalid save capabilities and markers on load or delete before transport', async t => {
  for (const native of [false, true]) {
    const f = native ? nativeFixture() : setup();
    const account = native ? createCareAccount({ bridge: f.bridge }) : f.create();
    t.after(() => account.dispose());
    await account.start(); const before = f.calls.length;
    for (const capability of ['messageLibraryVersion', 'checkinPreferenceVersion']) {
      for (const value of [0, 2, -1, 1.5, '1', true, null, undefined, NaN]) {
        await assert.rejects(account.request('careSave', { expected_revision: 0, state: emptyState(), [capability]: value }), { code: 'INVALID_REQUEST' });
      }
      await assert.rejects(account.request('careLoad', { [capability]: 1 }), { code: 'INVALID_REQUEST' });
      await assert.rejects(account.request('careDelete', { expected_revision: 0, [capability]: 1 }), { code: 'INVALID_REQUEST' });
    }
    assert.equal(f.calls.length, before);
    assert.equal(account.status().signedIn, true);
    await account.request('careSave', { expected_revision: 0, state: libraryFixture(), checkinPreferenceVersion: 1 });
    const body = native ? f.calls.at(-1).body : JSON.parse(f.calls.at(-1).body);
    assert.equal(body.checkinPreferenceVersion, 1, 'the new capability is independently optional');
    assert.equal(Object.hasOwn(body, 'messageLibraryVersion'), false);
  }
});

test('both save capabilities are restricted to the care client, care endpoint and null resource together', async t => {
  for (const config of [
    { clientKey: 'path' }, { clientKey: 'rehearsal' }, { clientKey: 'family-album' },
    { endpoint: 'synk-personal' }, { resource: 'path' },
    { clientKey: 'family-album', endpoint: 'synk-personal', resource: 'family-album' },
  ]) {
    const f = nativeFixture(config), account = f.create(); t.after(() => account.dispose());
    assert.equal((await account.start()).signedIn, true);
    const before = f.calls.length;
    for (const capability of ['messageLibraryVersion', 'checkinPreferenceVersion']) await assert.rejects(account.request('careSave', { expected_revision: 0, state: emptyState(), [capability]: 1 }), { code: 'INVALID_REQUEST' });
    assert.equal(f.calls.length, before);
    await account.request('careSave', { expected_revision: 0, state: emptyState() });
    assert.equal(Object.hasOwn(f.calls.at(-1).body, 'messageLibraryVersion'), false);
  }
});
