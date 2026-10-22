import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductAccount } from '../src/product-account.mjs';
import { createPlatformEntry, platformPublicEntry, platformCompanyEntry } from '../src/platform-entry.mjs';
import { createFortuneAccount } from '../../daily-fortune/account.mjs';
import { emptyState } from '../../daily-fortune/account-state.mjs';

// Synthetic identities, storage and HTTP only. The real OAuth/PKCE functions run locally.
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const deferred = () => { let resolve;const promise = new Promise(done => { resolve = done; });return { promise, resolve }; };
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(setImmediate); };
function fixture(product, { owner = A, session = false, intent = A } = {}) {
  const oauthProduct = product === 'fortune' ? 'platform' : product, base = `https://synk.im/${product}/`;
  const config = { version: 1, supabaseUrl: 'https://auth.example.invalid', accountApiUrl: 'https://api.example.invalid', supabasePublishableKey: 'sb_publishable_synthetic', portalUrl: 'https://id.example.invalid/', clients: { [oauthProduct]: { clientId: `synthetic-${product}`, redirectUri: base } } };
  const values = new Map(), events = [], calls = [], navigations = [], replacements = [];
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { if (key === `synk.platform.entry.${product}` && (state.entryStorageError || ++state.entryWrites > state.entryStorageAfter)) throw new Error('Synthetic entry storage failure');values.set(key, String(value)); }, removeItem: key => { if (state.allRemoveError || state.entryRemoveError && key === `synk.platform.entry.${product}`) throw new Error('Synthetic entry removal failure');return values.delete(key); } };
  const state = { owner, gate: null, error: null, tokenError: null, configError: null, entryStorageError: false, entryRemoveError: false, allRemoveError: false, entryWrites: 0, entryStorageAfter: Infinity, replaceError: false };
  const location = { href: base + (intent === null ? '' : `#synk-platform-account=${intent}`), assign: url => navigations.push(url) };
  const key = `synk.oauth.session.${product}`, entryKey = `synk.platform.entry.${product}`;
  if (session) storage.setItem(key, JSON.stringify({ access_token: 'synthetic-access', refresh_token: null, expires_at: Date.now() + 3600000,
    configKey: [config.supabaseUrl, config.accountApiUrl, config.clients[oauthProduct].clientId, base].join('|') }));
  storage.setItem('synthetic.guest.original', '{"draft":"guest original"}');
  const fetcher = async (input, options = {}) => {
    const url = String(input);calls.push({ url, method: options.method || 'GET', body: options.body });
    if (url === './account-config.json' || url.endsWith('/api/account-config')) return state.configError ? json({}, state.configError) : json(config);
    if (url.endsWith('/oauth/token')) return state.tokenError ? json({ error: 'invalid_grant' }, state.tokenError) : json({ access_token: 'synthetic-exchanged', expires_in: 3600 });
    if (url.includes('/auth/v1/logout')) return json({});
    if (state.gate) await state.gate.promise;
    if (state.error) return json({ ok: false, error: { code: state.error } }, 401);
    if (url.endsWith('/synk-account')) return json({ ok: true, account: { synk_user_id: state.owner }, sessions: [] });
    if (product === 'fortune') return json({ ok: true, account: { synk_user_id: state.owner }, revision: 0, state: emptyState() });
    return json({ ok: true, scope: product === 'care' ? 'synk-care' : 'synk-personal', ...(product === 'care' ? {} : { resource: product }), accountId: state.owner, revision: 0, state: { owner: state.owner } });
  };
  const replaceUrl = next => { if (state.replaceError) throw new Error('Synthetic URL replacement failure');replacements.push(next);location.href = next; };
  const create = () => product === 'fortune'
    ? createFortuneAccount({ native: null, storage, location, replaceURL: replaceUrl, fetcher, onState: value => events.push(value) })
    : createProductAccount({ clientKey: product, endpoint: product === 'care' ? 'synk-care' : 'synk-personal', scope: product === 'care' ? 'synk-care' : 'synk-personal', resource: product === 'care' ? null : product,
      validateState: value => { assert.equal(value.owner, state.owner);return value; }, storage, getUrl: () => location.href, replaceUrl, navigate: location.assign, fetcher, onStatus: value => events.push(value) });
  const callback = error => {
    const pending = JSON.parse(storage.getItem(`synk.oauth.pending.${oauthProduct}`));
    location.href = `${base}?${error ? 'error=access_denied' : 'code=synthetic-code'}&state=${pending.state}`;
  };
  const start = async client => { try { return await client.start(); } catch (error) { if (product !== 'fortune') throw error;return error; } };
  return { create, start, key, entryKey, storage, values, events, calls, navigations, replacements, state, location, callback, base };
}

for (const product of ['care', 'fortune']) {
  test(`${product}: removes the fragment before HTTP and opens one existing PKCE flow with no session`, async () => {
    const f = fixture(product), client = f.create();await f.start(client);
    assert.equal(f.location.href, f.base);assert.deepEqual(f.replacements, [f.base]);
    assert.equal(f.navigations.length, 1);assert.equal(f.calls.length, 1);
    const destination = new URL(f.navigations[0]);assert.equal(destination.pathname, '/auth/v1/oauth/authorize');
    assert.equal(destination.searchParams.get('code_challenge_method'), 'S256');assert.equal(destination.searchParams.get('scope'), 'openid email profile');
    assert.equal(destination.href.includes(A), false);assert.equal(destination.href.includes('synthetic-access'), false);
    assert.equal(JSON.parse(f.storage.getItem(f.entryKey)).attempted, true);
    await f.start(client);assert.equal(f.navigations.length, 1);
    assert.equal(f.events.some(value => value.signedIn || value.account || value.ready), false);
    assert.equal(f.storage.getItem('synthetic.guest.original'), '{"draft":"guest original"}');client.dispose();
  });
  test(`${product}: a matching saved session stays hidden until server verification and is reused`, async () => {
    const f = fixture(product, { session: true }), client = f.create();f.state.gate = deferred();
    const pending = f.start(client);await settle();
    assert.equal(f.events.some(value => value.account || value.signedIn || value.ready), false);
    f.state.gate.resolve();await pending;
    assert.equal(f.navigations.length, 0);assert.equal(f.events.at(-1).account.synk_user_id, A);
    assert.equal(f.calls.some(call => call.url.includes('/oauth/') || call.method === 'POST'), false);client.dispose();
  });
  test(`${product}: direct entry keeps its own account and a new explicit Platform launch replaces the expectation`, async () => {
    const f = fixture(product, { session: true, intent: null }), direct = f.create();await f.start(direct);
    assert.equal(f.events.at(-1).account.synk_user_id, A);assert.equal(f.storage.getItem(f.entryKey), null);direct.dispose();
    f.events.length = 0;f.location.href = `${f.base}#synk-platform-account=${B}`;
    const switched = f.create();await f.start(switched);
    assert.equal(f.events.some(value => value.account || value.signedIn || value.ready), false);
    assert.equal(f.navigations.length, 1);switched.dispose();f.callback();f.state.owner = B;
    const returned = f.create();await f.start(returned);assert.equal(f.events.at(-1).account.synk_user_id, B);returned.dispose();
  });
  test(`${product}: an initial manual click coalesces with automatic entry and later explicit retry remains possible`, async () => {
    const f = fixture(product), client = f.create();await client.signIn();
    assert.equal(f.navigations.length, 1);
    // The user may explicitly retry after returning from the browser. Only
    // automatic redirects are limited; the account-match condition is retained.
    await client.signIn();assert.equal(f.navigations.length, 2);
    assert.equal(JSON.parse(f.storage.getItem(f.entryKey)).accountId, A);client.dispose();
  });
  test(`${product}: an old account cannot expose data and the callback must match the Platform account`, async () => {
    const f = fixture(product, { session: true, owner: B }), old = f.create();await f.start(old);
    assert.equal(f.navigations.length, 1);assert.equal(f.storage.getItem(f.key), null);
    assert.equal(f.events.some(value => value.account || value.signedIn || value.ready), false);
    if (product === 'fortune') assert.equal(f.calls.some(call => call.url.endsWith('/synk-fortune')), false);
    old.dispose();f.callback();f.state.owner = A;
    const returned = f.create();await f.start(returned);
    assert.equal(f.events.at(-1).account.synk_user_id, A);assert.equal(f.navigations.length, 1);
    assert.equal(f.calls.filter(call => call.method === 'POST').length, 1);
    assert.equal(f.storage.getItem('synthetic.guest.original'), '{"draft":"guest original"}');returned.dispose();
  });
  for (const outcome of ['different-account', 'cancel', 'token-error']) test(`${product}: ${outcome} after OAuth stops without a navigation loop or foreign identity`, async () => {
    const f = fixture(product), first = f.create();await f.start(first);first.dispose();f.callback(outcome === 'cancel');
    f.state.owner = B;if (outcome === 'token-error') f.state.tokenError = 400;
    const returned = f.create();await f.start(returned);await f.start(returned);
    assert.equal(f.navigations.length, 1);assert.equal(f.events.some(value => value.account || value.signedIn || value.ready), false);
    assert.equal(f.storage.getItem(f.key), null);returned.dispose();
    const reopened = f.create();await f.start(reopened);assert.equal(f.navigations.length, 1);reopened.dispose();
  });
  test(`${product}: logout prevents both an in-flight verification and automatic login on reload`, async () => {
    const f = fixture(product, { session: true }), client = f.create();f.state.gate = deferred();
    const pending = f.start(client);await settle();
    const ending = client.signOut();f.state.gate.resolve();await ending;await pending;
    assert.equal(f.events.some(value => value.account || value.signedIn || value.ready), false);
    assert.equal(f.navigations.length, 0);client.dispose();const reopened = f.create();await f.start(reopened);
    assert.equal(f.navigations.length, 0);assert.equal(f.storage.getItem(f.key), null);reopened.dispose();
  });
  for (const phase of ['verifying', 'ready']) for (const removalFails of [false, true]) test(`${product}: ${phase} logout survives failed intent writes${removalFails ? ' and removals' : ''} across reload`, async () => {
    const f = fixture(product, { session: true }), client = f.create();if (phase === 'verifying') f.state.entryStorageAfter = 1;
    if (phase === 'verifying') f.state.gate = deferred();
    const pending = f.start(client);await settle();
    if (phase === 'ready') { await pending;assert.equal(f.events.some(value => value.account?.synk_user_id === A), true); }
    f.state.entryStorageError = true;f.state.entryRemoveError = removalFails;
    const ending = client.signOut();f.state.gate?.resolve();await ending;await pending;
    assert.equal(f.events.at(-1).account, null);assert.equal(f.navigations.length, 0);assert.equal(f.storage.getItem(f.key), null);
    assert.equal(new URL(f.location.href).hash, `#synk-platform-cancelled=${product}`);
    if (!removalFails) assert.equal(f.storage.getItem(f.entryKey), null);
    client.dispose();f.state.entryStorageAfter = Infinity;f.state.entryStorageError = false;f.state.entryRemoveError = false;f.events.length = 0;
    for (let reload = 0; reload < 2; reload++) { const opened = f.create();await f.start(opened);assert.equal(f.navigations.length, 0);assert.equal(f.events.some(value => value.account || value.signedIn || value.ready), false);opened.dispose(); }
    const manual = f.create();await f.start(manual);await manual.signIn();assert.equal(f.navigations.length, 1);manual.dispose();
    // Cancellation is scoped to this application and does not erase other apps.
    f.storage.setItem('synk.platform.entry.other-app', JSON.stringify({ version: 1, accountId: B, attempted: false }));
    const other = createPlatformEntry({ clientKey: 'other-app', getUrl: () => f.location.href, replaceUrl() {} });other.capture(f.storage);other.restore(f.storage);assert.equal(other.beginAttempt(), true);
  });
  test(`${product}: logout reports inability to preserve cancellation when storage and URL both fail`, async () => {
    const f = fixture(product, { session: true }), client = f.create();f.state.entryStorageAfter = 1;await f.start(client);
    f.state.entryRemoveError = true;f.state.replaceError = true;
    const result = await client.signOut();assert.equal(result.ok, false);assert.equal(f.events.at(-1).account, null);
    assert.match(f.events.at(-1).error?.message || f.events.at(-1).message, /이 창을 닫아/);assert.equal(f.storage.getItem(f.key), null);client.dispose();
  });
  test(`${product}: cancellation also blocks an undeleted saved token until explicit login`, async () => {
    const f = fixture(product, { session: true }), client = f.create();await f.start(client);
    f.state.entryStorageError = true;f.state.allRemoveError = true;await client.signOut();client.dispose();
    assert.notEqual(f.storage.getItem(f.key), null);f.state.entryStorageError = false;f.state.allRemoveError = false;f.events.length = 0;f.calls.length = 0;
    const reload = f.create();await f.start(reload);assert.equal(f.navigations.length, 0);assert.equal(f.calls.length, 1);
    assert.equal(f.events.some(value => value.account || value.signedIn || value.ready), false);
    await reload.signIn();assert.equal(f.navigations.length, 1);reload.dispose();
  });
  test(`${product}: an invalid or duplicated expected ID is stripped and fails closed`, async () => {
    for (const intent of ['not-an-id', `${A}&synk-platform-account=${B}`]) {
      const f = fixture(product, { session: true, intent }), client = f.create();await f.start(client);
      assert.equal(f.location.href, f.base);assert.equal(f.events.some(value => value.account || value.signedIn || value.ready), false);
      assert.equal(f.calls.length, 1);assert.equal(f.navigations.length, 0);client.dispose();
    }
  });
  test(`${product}: configuration failure retains the Platform account condition across reload`, async () => {
    const f = fixture(product, { session: true, owner: B }), first = f.create();f.state.configError = 503;
    await f.start(first);first.dispose();
    assert.equal(f.location.href, f.base);
    assert.equal(JSON.parse(f.storage.getItem(f.entryKey)).accountId, A);
    assert.equal(f.storage.getItem(f.key) !== null, true);
    f.state.configError = null;f.events.length = 0;
    const reloaded = f.create();await f.start(reloaded);
    assert.equal(f.events.some(value => value.account || value.signedIn || value.ready), false);
    assert.equal(f.navigations.length, 1);assert.equal(f.storage.getItem(f.key), null);reloaded.dispose();
  });
  test(`${product}: failed intent storage leaves the fragment and blocks reload until storage recovers`, async () => {
    const f = fixture(product, { session: true, owner: B });f.state.entryStorageError = true;
    for (let reload = 0; reload < 2; reload++) {
      const client = f.create();await f.start(client);client.dispose();
      assert.equal(f.location.href, `${f.base}#synk-platform-account=${A}`);
      assert.equal(f.storage.getItem(f.entryKey), null);assert.equal(f.calls.length, 0);
      assert.equal(f.events.some(value => value.account || value.signedIn || value.ready), false);
      assert.equal(f.navigations.length, 0);
    }
    f.state.entryStorageError = false;
    const recovered = f.create();await f.start(recovered);
    assert.equal(f.location.href, f.base);assert.equal(JSON.parse(f.storage.getItem(f.entryKey)).accountId, A);
    assert.equal(f.events.some(value => value.account || value.signedIn || value.ready), false);
    assert.equal(f.navigations.length, 1);recovered.dispose();
  });
  test(`${product}: invalid intent remains a durable rejection after an early configuration failure`, async () => {
    const f = fixture(product, { session: true, owner: B, intent: 'invalid-id' }), first = f.create();f.state.configError = 503;
    await f.start(first);first.dispose();
    assert.equal(f.location.href, f.base);assert.deepEqual(JSON.parse(f.storage.getItem(f.entryKey)), { version: 1, invalid: true });
    f.state.configError = null;f.events.length = 0;
    for (let reload = 0; reload < 2; reload++) {
      const client = f.create();await f.start(client);client.dispose();
      assert.equal(f.events.some(value => value.account || value.signedIn || value.ready), false);
      assert.equal(f.navigations.length, 0);
      assert.deepEqual(JSON.parse(f.storage.getItem(f.entryKey)), { version: 1, invalid: true });
    }
  });
}

test('web Platform app destinations carry only a verified account ID and remain fixed public URLs', () => {
  for (const [id, plain] of [['world', 'https://synk.im/world/'], ...['care', 'fortune'].map(id => [id, `https://synk.im/${id}/`])]) {
    assert.equal(platformPublicEntry(id, { signedIn: true, status: 'signed-in', accountId: A }), `${plain}#synk-platform-account=${A}`);
    for (const identity of [null, { signedIn: false, status: 'signed-in', accountId: A }, { signedIn: true, status: 'restoring', accountId: A }, { signedIn: true, status: 'signed-in', accountId: 'invalid' }]) assert.equal(platformPublicEntry(id, identity), plain);
  }
  for (const id of ['__proto__', 'constructor', 'unknown', 'https://attacker.invalid/']) assert.equal(platformPublicEntry(id, { signedIn: true, status: 'signed-in', accountId: A }), null);
});

test('tab intent preserves unrelated anchors and rejects corrupt persisted state', () => {
  let url = `https://synk.im/care/#tab=people&synk-platform-account=${A}`;
  const values = new Map(), storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const first = createPlatformEntry({ clientKey: 'care', getUrl: () => url, replaceUrl: next => { url = next; } });first.capture(storage);first.restore(storage);
  assert.equal(url, 'https://synk.im/care/#tab=people');assert.equal(first.accountId(), A);assert.equal(first.beginAttempt(), true);assert.equal(first.beginAttempt(), false);
  const restored = createPlatformEntry({ clientKey: 'care', getUrl: () => url, replaceUrl() {} });restored.capture(storage);restored.restore(storage);assert.equal(restored.beginAttempt(), false);
  values.set('synk.platform.entry.care', '{bad');const bad = createPlatformEntry({ clientKey: 'care', getUrl: () => url, replaceUrl() {} });bad.capture(storage);assert.throws(() => bad.restore(storage), { code: 'PLATFORM_ACCOUNT_MISMATCH' });
});

test('company entry adds only a verified expectation to the fixed production route',()=>{
  const identity={signedIn:true,status:'signed-in',accountId:A};
  for(const path of ['','?tab=home','?tab=messenger']){
    const base='https://workspace.synk.im/'+path,tagged=base+'#synk-platform-account='+A;
    assert.equal(platformCompanyEntry(base,identity),tagged);
    assert.equal(platformCompanyEntry(tagged,{...identity,status:'restoring'}),base);
  }
  for(const href of ['https://other.invalid/?tab=messenger','http://127.0.0.1:4191/?tab=messenger','https://workspace.synk.im/private','https://workspace.synk.im/?tab=messenger&tab=home','https://workspace.synk.im/?next=elsewhere','https://workspace.synk.im/#invite=private','https://user:pass@workspace.synk.im/'])assert.equal(platformCompanyEntry(href,identity),href);
});
