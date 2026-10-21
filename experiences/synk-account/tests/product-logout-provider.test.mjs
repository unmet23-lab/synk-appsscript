import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductAccount } from '../src/product-account.mjs';

// Run the actual shared browser account service with synthetic credentials,
// storage and HTTP replies. No provider, production account or browser is used.
const PRODUCTS = ['care', 'path', 'path-travel'];
const CURRENT_ID = 'synthetic-current-session';
const complete = { ok: true, current: true, refreshRevoked: true };
const response = (data, status = 200) => status === 204
  ? new Response(null, { status }) : Response.json(data, { status });
const deferred = () => { let resolve;const promise = new Promise(done => { resolve = done; });return { promise, resolve }; };

async function actor(t, {
  product = 'care', central = complete, centralStatus = 200,
  providerStatus = 403, centralOffline = false, loadOffline = false,
  providerOffline = false, sessions = [{ id: CURRENT_ID, current: true, revoked: false }],
  centralLoad, restored = true, storageFailure = false,
} = {}) {
  const endpoint = product === 'care' ? 'synk-care' : 'synk-personal';
  const operations = product === 'care' ? { load: 'careLoad', save: 'careSave', delete: 'careDelete' }
    : { load: 'personalLoad', save: 'personalSave', delete: 'personalDelete' };
  const resource = product === 'care' ? null : product;
  const redirectUri = 'http://127.0.0.1:4298/';
  const config = { version: 1, supabaseUrl: 'https://auth.example.test', accountApiUrl: 'https://api.example.test',
    supabasePublishableKey: 'sb_publishable_synthetic', portalUrl: 'https://id.example.test/',
    clients: { [product]: { clientId: `synthetic-${product}`, redirectUri } } };
  const key = `synk.oauth.session.${product}`;
  const values = new Map(PRODUCTS.filter(value => value !== product).map(value => [`synk.oauth.session.${value}`, `untouched-${value}`]));
  values.set('synthetic.local-draft', 'preserved-user-draft');
  if (restored) values.set(key, JSON.stringify({ access_token: 'synthetic-private-access', refresh_token: 'synthetic-private-refresh',
    expires_at: Date.now() + 3600000, configKey: [config.supabaseUrl, config.accountApiUrl, config.clients[product].clientId, redirectUri].join('|') }));
  const otherStorage = new Map([...values].filter(([name]) => name !== key));
  const calls = [], states = [];
  const account = createProductAccount({ clientKey: product, endpoint, scope: endpoint, resource, operations,
    validateState: value => value, getUrl: () => redirectUri, onStatus: state => states.push(state),
    storage: { getItem: name => values.get(name) ?? null, setItem: (name, value) => values.set(name, value),
      removeItem: name => { if (storageFailure && name === key) throw Error('synthetic storage denial');values.delete(name); } },
    fetcher: async (input, options = {}) => {
      const url = new URL(input);
      assert.ok(['http://127.0.0.1:4298', 'https://api.example.test', 'https://auth.example.test'].includes(url.origin));
      if (url.pathname === '/api/account-config') return response(config);
      assert.equal(options.credentials, 'omit');assert.equal(options.cache, 'no-store');assert.equal(options.redirect, 'error');
      assert.equal(options.headers.Authorization, 'Bearer synthetic-private-access');
      assert.equal(options.headers.apikey, 'sb_publishable_synthetic');
      assert.equal(options.headers['X-SYNK-Product'], 'platform');assert.equal(options.headers['X-SYNK-Contract'], '1');
      const body = options.body === undefined ? undefined : JSON.parse(options.body);
      calls.push({ path: url.pathname, method: options.method, scope: url.searchParams.get('scope'), body });
      if (url.pathname === `/functions/v1/${endpoint}`) {
        assert.equal(options.method, 'GET');
        assert.equal(url.searchParams.get('resource'), resource);
        return response({ ok: true, scope: endpoint, ...(resource ? { resource } : {}), accountId: 'synthetic-owner', revision: 0, state: null });
      }
      if (url.pathname === '/functions/v1/synk-account') {
        if (options.method === 'GET') {
          if (loadOffline) throw TypeError('synthetic offline while reading sessions');
          return centralLoad ? await centralLoad() : response({ ok: true, sessions });
        }
        assert.equal(options.method, 'POST');assert.deepEqual(body, { action: 'revoke-session', session_id: CURRENT_ID });
        if (centralOffline) throw TypeError('synthetic offline while revoking current session');
        return response(central, centralStatus);
      }
      assert.equal(url.pathname, '/auth/v1/logout');assert.equal(url.origin, 'https://auth.example.test');
      assert.equal(options.method, 'POST');assert.equal(url.search, '?scope=local');assert.deepEqual(body, {});
      if (providerOffline) throw TypeError('synthetic provider offline');
      return response({ code: providerStatus === 403 ? 'session_not_found' : 'synthetic-provider-result' }, providerStatus);
    },
  });
  t.after(() => account.dispose());
  const initial = await account.start();assert.equal(initial.signedIn, restored);
  const providerCalls = () => calls.filter(call => call.path === '/auth/v1/logout');
  const centralPosts = () => calls.filter(call => call.path === '/functions/v1/synk-account' && call.method === 'POST');
  function assertLocal(result) {
    assert.equal(result.status.signedIn, false);assert.equal(account.status().accountId, null);
    assert.equal(values.has(key), storageFailure && restored);
    assert.deepEqual(new Map([...values].filter(([name]) => name !== key)), otherStorage);
    for (const value of [result, account.status(), states]) {
      assert.equal(JSON.stringify(value).includes('synthetic-private-access'), false);
      assert.equal(JSON.stringify(value).includes('synthetic-private-refresh'), false);
    }
  }
  return { account, values, key, calls, states, providerCalls, centralPosts,
    logout: async () => { const result = await account.signOut();assertLocal(result);return result; }, assertLocal };
}

for (const product of PRODUCTS) test(`${product}: current server confirmation avoids a duplicate provider request and preserves success`, async t => {
  const f = await actor(t, { product }), result = await f.logout();
  assert.equal(result.ok, true);assert.equal(result.serverSessionRevoked, true);
  assert.equal(result.refreshRevoked, true);assert.equal(result.serverRevoked, true);
  assert.equal(f.centralPosts().length, 1);assert.equal(f.providerCalls().length, 0);
});

test('explicit false provider confirmation uses one successful local fallback', async t => {
  const f = await actor(t, { central: { ...complete, refreshRevoked: false }, providerStatus: 204 }), result = await f.logout();
  assert.equal(result.serverSessionRevoked, true);assert.equal(result.refreshRevoked, true);assert.equal(result.serverRevoked, true);
  assert.equal(f.providerCalls().length, 1);
});

test('missing, non-current and truthy flags cannot suppress the local fallback', async t => {
  for (const central of [
    { ok: true, current: true }, { ok: true, refreshRevoked: true }, { ok: true, current: false, refreshRevoked: true },
    { ...complete, current: 'true' }, { ...complete, current: 1 },
    { ...complete, refreshRevoked: 'true' }, { ...complete, refreshRevoked: 1 },
    { current: true, refreshRevoked: true }, { ...complete, ok: false }, { ...complete, ok: 'true' }, { ...complete, ok: 1 },
  ]) {
    const f = await actor(t, { central }), result = await f.logout();
    assert.equal(result.serverSessionRevoked, central.ok === true);
    assert.equal(result.refreshRevoked, false);assert.equal(result.serverRevoked, false);
    assert.equal(f.providerCalls().length, 1);
  }
});

test('HTTP failure cannot confer current provider authority even when the body claims full success', async t => {
  for (const centralStatus of [401, 403, 500]) {
    const f = await actor(t, { centralStatus, providerStatus: 204 }), result = await f.logout();
    assert.equal(result.serverSessionRevoked, false);assert.equal(result.refreshRevoked, true);assert.equal(result.serverRevoked, false);
    assert.equal(f.providerCalls().length, 1);
  }
});

test('offline central revocation still closes local credentials and attempts the provider without claiming the fence', async t => {
  const f = await actor(t, { centralOffline: true, providerStatus: 204 }), result = await f.logout();
  assert.equal(result.ok, true);assert.equal(result.serverSessionRevoked, false);
  assert.equal(result.refreshRevoked, true);assert.equal(result.serverRevoked, false);assert.equal(f.providerCalls().length, 1);
});

test('a failed current-session read still attempts the provider and does not claim central completion', async t => {
  const f = await actor(t, { loadOffline: true, providerStatus: 204 }), result = await f.logout();
  assert.equal(result.serverSessionRevoked, false);assert.equal(result.refreshRevoked, true);assert.equal(result.serverRevoked, false);
  assert.equal(f.centralPosts().length, 0);assert.equal(f.providerCalls().length, 1);
});

test('a missing or already revoked current session cannot be replaced by another device row', async t => {
  for (const sessions of [[], [{ id: 'synthetic-other-session', current: false, revoked: false }], [{ id: CURRENT_ID, current: true, revoked: true }]]) {
    const f = await actor(t, { sessions, providerStatus: 204 }), result = await f.logout();
    assert.equal(result.serverSessionRevoked, false);assert.equal(result.refreshRevoked, true);assert.equal(result.serverRevoked, false);
    assert.equal(f.centralPosts().length, 0);assert.equal(f.providerCalls().length, 1);
  }
});

test('fallback401 is confirmation only after successful SYNK session revocation', async t => {
  for (const centralStatus of [200, 503]) {
    const f = await actor(t, { central: { ...complete, refreshRevoked: false }, centralStatus, providerStatus: 401 }), result = await f.logout();
    assert.equal(result.serverSessionRevoked, centralStatus === 200);
    assert.equal(result.refreshRevoked, centralStatus === 200);assert.equal(result.serverRevoked, centralStatus === 200);
    assert.equal(f.providerCalls().length, 1);
  }
});

test('provider404 confirms its local cleanup while central404 remains an unconfirmed SYNK fence', async t => {
  for (const centralStatus of [200, 404]) {
    const f = await actor(t, { central: { ok: true }, centralStatus, providerStatus: 404 }), result = await f.logout();
    assert.equal(result.refreshRevoked, true);assert.equal(result.serverSessionRevoked, centralStatus === 200);
    assert.equal(result.serverRevoked, centralStatus === 200);assert.equal(f.providerCalls().length, 1);
  }
});

test('generic provider403 including session_not_found cannot confirm refresh revocation without server authority', async t => {
  const f = await actor(t, { central: { ...complete, refreshRevoked: false } }), result = await f.logout();
  assert.equal(result.serverSessionRevoked, true);assert.equal(result.refreshRevoked, false);assert.equal(result.serverRevoked, false);
  assert.equal(f.providerCalls().length, 1);
});

test('failed or offline provider fallback retains an incomplete result without restoring credentials', async t => {
  for (const options of [{ providerStatus: 503 }, { providerOffline: true }]) {
    const f = await actor(t, { central: { ok: true }, ...options }), result = await f.logout();
    assert.equal(result.ok, true);assert.equal(result.serverSessionRevoked, true);
    assert.equal(result.refreshRevoked, false);assert.equal(result.serverRevoked, false);assert.equal(f.providerCalls().length, 1);
  }
});

test('logout clears local identity immediately while the central response is still pending', async t => {
  const waiting = deferred(), f = await actor(t, { centralLoad: () => waiting.promise });
  const operation = f.account.signOut();
  assert.equal(f.account.status().signedIn, false);assert.equal(f.account.status().accountId, null);assert.equal(f.values.has(f.key), false);
  assert.equal(f.providerCalls().length, 0);
  waiting.resolve(response({ ok: true, sessions: [{ id: CURRENT_ID, current: true, revoked: false }] }));
  const result = await operation;f.assertLocal(result);
  assert.equal(result.serverRevoked, true);assert.equal(f.providerCalls().length, 0);
});

test('local storage failure remains visible even when the server confirms provider completion', async t => {
  const f = await actor(t, { storageFailure: true }), result = await f.logout();
  assert.equal(result.ok, false);assert.equal(result.status.error.code, 'STORAGE');
  assert.equal(result.serverSessionRevoked, true);assert.equal(result.refreshRevoked, true);assert.equal(result.serverRevoked, true);
  assert.equal(f.providerCalls().length, 0);
});

test('an already signed-out product requires no remote logout and preserves other products', async t => {
  const f = await actor(t, { restored: false }), result = await f.logout();
  assert.equal(result.ok, true);assert.equal(result.serverSessionRevoked, true);assert.equal(result.refreshRevoked, true);assert.equal(result.serverRevoked, true);
  assert.equal(f.calls.length, 0);
});
