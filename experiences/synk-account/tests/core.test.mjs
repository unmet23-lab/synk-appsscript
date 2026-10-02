import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readConfig, beginOAuth, consumeCallback, trustedConsentRedirect, authorizationProduct, scopedStorage, tokenRequest } from '../src/core.mjs';
const base = 'https://id.example.test/index.html';
const raw = { version: 1, supabaseUrl: 'https://auth.example.test', supabasePublishableKey: 'sb_publishable_example', portalUrl: base,
  clients: { platform: { clientId: 'platform-web', redirectUri: 'https://platform.example.test/client.html?product=platform' }, world: { clientId: 'world-web', redirectUri: 'https://world.example.test/client.html?product=world' } },
  authorizationClients: [{ product: 'world', clientId: 'world-native', redirectUris: ['synktalk://oauth/callback'] }] };
const config = readConfig(raw, base);
const memory = () => { const values = new Map();return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; };
async function pending(product = 'world') { const storage = memory();const auth = new URL(await beginOAuth({ config, product, storage, cryptoAPI: webcrypto, now: 1000 }));const callback = new URL(config.clients[product].redirectUri);callback.searchParams.set('state', auth.searchParams.get('state'));callback.searchParams.set('code', 'one-use-code');return { storage, auth, callback }; }
test('missing public configuration stays unconfigured; private fields/keys/HTTP are refused', () => {
  assert.equal(readConfig({ version: 1 }, base).configured, false);
  for (const changed of [{ clientSecret: 'secret' }, { supabasePublishableKey: 'sb_secret_private' }, { supabaseUrl: 'http://live.example.test' }]) assert.throws(() => readConfig({ ...raw, ...changed }, base));
  const jwt = `a.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.b`;
  assert.throws(() => readConfig({ ...raw, supabasePublishableKey: jwt }, base));
  assert.throws(() => readConfig({ ...raw, clients: { world: { ...raw.clients.world, clientSecret: 'private' } } }, base));
});
test('PKCE uses random verifier/state and S256, stores verifier only in transaction', async () => {
  const { storage, auth, callback } = await pending(), stored = JSON.parse(storage.getItem('synk.oauth.pending.world'));
  assert.equal(stored.verifier.length, 43);assert.notEqual(stored.state, stored.verifier);
  assert.equal(auth.searchParams.get('code_challenge'), createHash('sha256').update(stored.verifier).digest('base64url'));
  assert.equal(auth.searchParams.get('code_challenge_method'), 'S256');assert.equal(auth.searchParams.has('code_verifier'), false);
  const fields = consumeCallback({ config, product: 'world', url: callback, storage, now: 2000 });
  assert.equal(fields.code_verifier, stored.verifier);assert.equal(storage.getItem('synk.oauth.pending.world'), null);
  assert.throws(() => consumeCallback({ config, product: 'world', url: callback, storage, now: 2000 }));
});
test('wrong state, wrong product, wrong callback and expired requests cannot exchange', async () => {
  for (const change of [u => u.searchParams.set('state', 'wrong'), u => u.searchParams.set('product', 'platform'), u => { u.hostname = 'attacker.example.test'; }, u => { u.pathname = '/else'; }]) {
    const { storage, callback } = await pending();change(callback);assert.throws(() => consumeCallback({ config, product: 'world', url: callback, storage, now: 2000 }));
  }
  const { storage, callback } = await pending();assert.throws(() => consumeCallback({ config, product: 'platform', url: callback, storage, now: 2000 }));
  assert.throws(() => consumeCallback({ config, product: 'world', url: callback, storage, now: 602000 }));
});
test('denied request consumes transaction without token exchange', async () => {
  const { storage, callback } = await pending();callback.searchParams.delete('code');callback.searchParams.set('error', 'access_denied');
  assert.throws(() => consumeCallback({ config, product: 'world', url: callback, storage, now: 2000 }), /취소/);
  assert.equal(storage.getItem('synk.oauth.pending.world'), null);
});
test('consent redirects restrict browser/native scheme, host, path and registered query', () => {
  assert.equal(authorizationProduct('world-native', config), 'world');assert.equal(authorizationProduct('unknown', config), null);
  assert.equal(trustedConsentRedirect('synktalk://oauth/callback?code=opaque&state=opaque', config), 'synktalk://oauth/callback?code=opaque&state=opaque');
  assert.ok(trustedConsentRedirect(raw.clients.world.redirectUri + '&code=opaque', config));
  for (const url of ['https://evil.example.test/client.html?product=world', 'synktalk://evil/callback', 'synktalk://oauth/other', 'https://world.example.test/client.html?product=platform', 'https://name:pass@world.example.test/client.html?product=world', 'https://world.example.test/client.html?product=world#token', 'javascript:alert(1)']) assert.throws(() => trustedConsentRedirect(url, config));
});
test('account and consent revisions isolate storage, stale guards refuse writes', () => {
  const storage = memory();storage.setItem('synk-learning.device', 'guest');let active = true;
  const guard = () => { if (!active) throw new Error('stale'); };
  const a = scopedStorage(storage, 'A', 1, guard), b = scopedStorage(storage, 'B', 1, guard), later = scopedStorage(storage, 'A', 2, guard);
  a.setItem('learning', 'A-evidence');assert.equal(b.getItem('learning'), null);assert.equal(later.getItem('learning'), null);assert.equal(storage.getItem('synk-learning.device'), 'guest');
  active = false;assert.throws(() => a.setItem('learning', 'stale'));assert.equal(storage.getItem('synk.account.A.r1.learning'), 'A-evidence');
});
test('callback duplicates, fragments, token delivery and a different client redirect are rejected', async () => {
  for (const mutate of [u => u.searchParams.append('state', 'second'), u => u.searchParams.append('code', 'second'), u => u.searchParams.set('access_token', 'forbidden'), u => { u.hash = 'token'; }, u => u.searchParams.set('error', 'access_denied')]) {
    const { storage, callback } = await pending();mutate(callback);
    assert.throws(() => consumeCallback({ config, product: 'world', url: callback, storage, now: 2000 }));
  }
  assert.throws(() => trustedConsentRedirect(raw.clients.world.redirectUri + '&code=opaque', config, 'platform-web'));
  assert.ok(trustedConsentRedirect(raw.clients.world.redirectUri + '&code=opaque', config, 'world-web'));
});
test('central consent recognizes messenger and separate mobile/desktop registered callbacks', () => {
  const value = readConfig({ ...raw, authorizationClients: [
    { product: 'messenger', clientId: 'messenger-pc', redirectUris: ['http://127.0.0.1:49303/oauth/callback'] },
    { product: 'platform', clientId: 'platform-ios', redirectUris: ['im.synk.platform://oauth/callback'] },
  ] }, base);
  assert.equal(authorizationProduct('messenger-pc', value), 'messenger');
  assert.ok(trustedConsentRedirect('http://127.0.0.1:49303/oauth/callback?state=s&code=c', value, 'messenger-pc'));
  assert.throws(() => trustedConsentRedirect('http://127.0.0.1:49304/oauth/callback?state=s&code=c', value, 'messenger-pc'));
  assert.ok(trustedConsentRedirect('im.synk.platform://oauth/callback?code=c', value, 'platform-ios'));
});
test('public token exchange sends form PKCE and no client secret, rejects non-token result', async () => {
  const { storage, callback } = await pending(), fields = consumeCallback({ config, product: 'world', url: callback, storage, now: 2000 });
  const session = await tokenRequest(config, fields, async (url, init) => { assert.equal(url.pathname, '/auth/v1/oauth/token');assert.equal(init.credentials, 'omit');assert.equal(init.body.get('client_secret'), null);assert.equal(init.body.get('code'), 'one-use-code');assert.ok(init.signal);return { ok: true, json: async () => ({ access_token: 'synthetic-token', expires_in: 3600 }) }; });
  assert.equal(session.access_token, 'synthetic-token');
  await assert.rejects(tokenRequest(config, fields, async () => ({ ok: false, json: async () => ({ error: 'invalid_grant' }) })));
});
