import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';

// Exercise the real browser client with synthetic HTTP/DOM only; no remote auth.
const runtime = buildSync({ entryPoints: [fileURLToPath(new URL('../src/client.mjs', import.meta.url))], bundle: true, write: false, format: 'iife', platform: 'browser' }).outputFiles[0].text;
const KEY = 'synk.oauth.session.platform', BASE = 'https://platform.example.invalid/client.html?product=platform';
const config = { version: 1, supabaseUrl: 'https://auth.example.invalid', supabasePublishableKey: 'sb_publishable_synthetic', portalUrl: 'https://id.example.invalid/', clients: { platform: { clientId: 'platform-fixture', redirectUri: BASE } } };
const accountData = () => ({ ok: true, account: { synk_user_id: 'synthetic-user', profile: { display_name: '합성 사용자' }, status: 'active' },
  sessions: [{ id: 'synthetic-current', current: true, revoked: false }], learning: { enabled: false, revision: 1 }, capabilities: { learningSync: false } });
const deferred = () => { let resolve;const promise = new Promise(done => { resolve = done; });return { promise, resolve }; };
const settle = async () => { for (let i = 0; i < 18; i++) await new Promise(setImmediate); };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

class Node {
  constructor(tag = 'div') { this.tagName = tag;this.children = [];this.dataset = {};this.hidden = false;this.disabled = false;this.textContent = '';this.classList = { add() {}, remove() {} }; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  before() {}
  setAttribute(key, value) { this[key] = value; }
  querySelector() { return null; }
  addEventListener() {}
  click() { this.clicked = true; }
  remove() {}
}
async function fixture(options = {}) {
  const nodes = [], ids = new Map(), windowEvents = new Map(), documentEvents = new Map(), values = new Map();
  const make = tag => { const node = new Node(tag);nodes.push(node);return node; };
  const get = id => nodes.find(node => node.id === id) || ids.get(id) || (() => { const node = make('div');ids.set(id, node);return node; })();
  const add = (events, type, fn) => { if (!events.has(type)) events.set(type, []);events.get(type).push(fn); };
  const state = { config: 'ok', account: 'ok', token: 'ok', accountWait: null, nextAccountReply: null, revokeWait: null, exportWait: null, revocationNeedsRefresh: false, data: accountData(), ...options };
  const calls = { config: 0, account: 0, token: 0, revoke: 0, atlas: 0, export: 0 }, exchanged = [], navigations = [];
  values.set(KEY, JSON.stringify({ access_token: 'synthetic-access', refresh_token: 'synthetic-refresh' }));
  let href = BASE;
  if (options.callback) {
    values.delete(KEY);href += '&code=synthetic-code&state=synthetic-state';
    values.set('synk.oauth.pending.platform', JSON.stringify({ product: 'platform', clientId: 'platform-fixture', redirectUri: BASE, state: 'synthetic-state', verifier: 'synthetic-verifier', createdAt: Date.now() }));
  }
  const location = { href, assign: url => navigations.push(String(url)), reload() { navigations.push('reload'); } };
  const document = { body: make('body'), visibilityState: 'visible', createElement: make, getElementById: get, querySelector: get, querySelectorAll: () => [], addEventListener: (type, fn) => add(documentEvents, type, fn), removeEventListener() {} };
  for (const id of ['account', 'setup', 'connect', 'cancel-connect']) get(id).hidden = true;
  const context = vm.createContext({ document, window: { addEventListener: (type, fn) => add(windowEvents, type, fn), removeEventListener() {} }, location,
    history: { replaceState: (_state, _title, url) => { location.href = String(url); } },
    URL, URLSearchParams, AbortController, AbortSignal, Response, Blob, TextEncoder, setTimeout, clearTimeout, btoa, atob, crypto: webcrypto, console,
    sessionStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    fetch: async (url, init) => {
      if (String(url) === './config.json') { calls.config++;if (state.config === 'offline') throw new Error('Synthetic offline');return state.config === 'missing' ? json({}, 404) : json(config); }
      const target = new URL(url);
      if (target.pathname.endsWith('/oauth/token')) { calls.token++;exchanged.push(Object.fromEntries(init.body));if (state.token === 'offline') return json({ error: 'temporarily_unavailable' }, 503);if (state.token === 'revoked') return json({ error: 'invalid_grant' }, 400);return json({ access_token: 'synthetic-renewed', refresh_token: 'synthetic-rotated', expires_in: 3600 }); }
      if (init.method === 'GET' && target.searchParams.get('view') === 'atlas') { calls.atlas++;return json({ ok: true }); }
      if (init.method === 'GET' && target.searchParams.get('view') === 'export') { calls.export++;if(state.exportWait)await state.exportWait.promise;return json({ ok: true, events: [], cursor: 0, until: 0, hasMore: false }); }
      if (init.method === 'GET') { calls.account++;if(state.nextAccountReply){const pending=state.nextAccountReply;state.nextAccountReply=null;return pending.promise;}if (state.accountWait) await state.accountWait.promise;if (state.account === 'offline') throw new Error('Synthetic offline');if (state.account === 'revoked') return json({ ok: false, error: { code: 'AUTH_REQUIRED' } }, 401);return json(state.data); }
      const body = JSON.parse(init.body);assert.ok(['revoke-session', 'revoke-all-sessions'].includes(body.action));calls.revoke++;
      if (state.revokeWait) await state.revokeWait.promise;
      if (state.revocationNeedsRefresh && init.headers.Authorization !== 'Bearer synthetic-renewed') return json({ ok: false, error: { code: 'AUTH_REQUIRED' } }, 401);
      return json({ ok: true, refreshRevoked: true, legacyAccessGuard: true });
    },
  });
  vm.runInContext(runtime, context);await settle();
  const findButton = (node, text) => node.tagName === 'button' && node.textContent === text ? node : node.children.map(child => findButton(child, text)).find(Boolean);
  const allButtons = (node, text) => [...(node.tagName === 'button' && node.textContent === text ? [node] : []), ...node.children.flatMap(child => allButtons(child, text))];
  const allText = node => [node.textContent, ...node.children.map(allText)].join(' ');
  return { state, calls, values, get, exchanged, navigations, document, notice: () => get('notice').textContent, accountText: () => allText(get('account')), buttons: text => allButtons(get('account'), text), downloads: () => nodes.filter(node => node.download && node.clicked).length,
    button: text => { const button = findButton(get('account'), text) || nodes.find(node => node.tagName === 'button' && node.textContent === text);assert.ok(button, `Missing ${text}`);return button; },
    fireWindow: async type => { for (const fn of windowEvents.get(type) || []) fn({ persisted: false });await settle(); },
    visible: async () => { document.visibilityState = 'visible';await Promise.all((documentEvents.get('visibilitychange') || []).map(fn => fn()));await settle(); },
    retry: async () => { get('retry-connect').onclick();await settle(); },
  };
}

test('temporary configuration failure exposes recovery and preserves the existing login', async () => {
  const page = await fixture({ config: 'offline' }), before = page.values.get(KEY);
  assert.equal(page.get('setup').hidden, true);assert.equal(page.get('retry-connect').hidden, false);assert.match(page.notice(), /설정을 불러오지 못/);
  page.state.config = 'ok';await page.retry();
  assert.equal(page.get('account').hidden, false);assert.equal(page.values.get(KEY), before);assert.equal(page.calls.token, 0);assert.deepEqual(page.navigations, []);
});

test('real missing configuration stays a setup state and can be retried after registration', async () => {
  const page = await fixture({ config: 'missing' });assert.equal(page.get('setup').hidden, false);assert.match(page.notice(), /SSO 설정 전/);
  page.state.config = 'ok';await page.retry();assert.equal(page.get('setup').hidden, true);assert.equal(page.get('account').hidden, false);
});

test('initial account read failure retries the saved session without starting OAuth again', async () => {
  const page = await fixture({ account: 'offline' }), before = page.values.get(KEY);
  assert.equal(page.get('account').hidden, true);assert.equal(page.get('connect').hidden, true);assert.equal(page.get('retry-connect').hidden, false);
  page.state.account = 'ok';await page.retry();
  assert.equal(page.get('account').hidden, false);assert.equal(page.values.get(KEY), before);assert.equal(page.calls.token, 0);assert.deepEqual(page.navigations, []);
});

test('pagehide during the first account read prevents a late response from opening the account', async () => {
  const pending = deferred(), page = await fixture({ accountWait: pending });assert.equal(page.calls.account, 1);
  await page.fireWindow('pagehide');pending.resolve();await settle();
  assert.equal(page.get('account').hidden, true);assert.equal(page.calls.atlas, 0);assert.doesNotMatch(page.notice(), /서버가 확인한 계정으로 연결했어요/);
});

test('temporary callback exchange failure can retry the same in-memory PKCE fields', async () => {
  const page = await fixture({ callback: true, token: 'offline' });assert.equal(page.values.has(KEY), false);assert.equal(page.get('retry-connect').hidden, false);
  page.state.token = 'ok';await page.retry();assert.equal(page.get('account').hidden, false);
  assert.equal(page.exchanged.length, 2);assert.deepEqual(page.exchanged[1], page.exchanged[0]);assert.equal(page.exchanged[0].code, 'synthetic-code');assert.deepEqual(page.navigations, []);
  assert.deepEqual([...page.values.keys()], [KEY]);
});

test('returning to the same verified account preserves the existing view', async () => {
  const page = await fixture(), head = page.get('account').children[0], reads = page.calls.account;
  await page.visible();assert.equal(page.calls.account, reads + 1);assert.equal(page.get('account').children[0], head);
});

test('returning updates profile, memberships, rights and session rows without refetching configuration', async () => {
  const initial = accountData();initial.account.profile.display_name = '이전 이름';initial.memberships = [{ role: 'student', student_code: 'OLD-SYNTHETIC' }];initial.entitlements = [{ key: 'library.world', status: 'active' }];initial.sessions.push({ id: 'synthetic-second', label: '다른 기기', revoked: false });
  const page = await fixture({ data: initial }), reads = page.calls.account, configs = page.calls.config;
  page.state.data = structuredClone(initial);page.state.data.account.profile.display_name = '새 이름';page.state.data.memberships = [{ role: 'teacher', student_code: 'NEW-SYNTHETIC' }];page.state.data.entitlements = [{ key: 'library.path', status: 'active' }];page.state.data.sessions[1].revoked = true;
  await page.visible();const text = page.accountText();
  assert.match(text, /새 이름/);assert.match(text, /NEW-SYNTHETIC/);assert.match(text, /library\.path/);assert.match(text, /다른 기기 · 종료됨/);
  assert.doesNotMatch(text, /이전 이름|OLD-SYNTHETIC|library\.world/);assert.equal(page.buttons('종료').length, 1);
  assert.equal(page.calls.account, reads + 1);assert.equal(page.calls.config, configs);assert.equal(page.calls.token, 0);
});

test('a newer explicit read after ending another session wins over an older return response', async () => {
  const initial = accountData();initial.sessions.push({ id: 'synthetic-second', label: '다른 기기', revoked: false });
  const page = await fixture({ data: initial }), previous = structuredClone(initial), pending = deferred();page.state.nextAccountReply = pending;
  const returning = page.visible();await settle();
  page.state.data = structuredClone(initial);page.state.data.sessions[1].revoked = true;page.buttons('종료')[1].onclick();await settle();
  assert.match(page.accountText(), /다른 기기 · 종료됨/);
  pending.resolve(json(previous));await returning;
  assert.match(page.accountText(), /다른 기기 · 종료됨/);assert.equal(page.buttons('종료').length, 1);
});

test('a revoked session discovered on return closes the account and presents login', async () => {
  const page = await fixture();page.state.account = 'revoked';page.state.token = 'revoked';await page.visible();
  assert.equal(page.get('account').hidden, true);assert.equal(page.values.has(KEY), false);assert.equal(page.get('connect').hidden, false);
});

test('temporary return verification failure preserves the session and can be recovered explicitly', async () => {
  const page = await fixture(), before = page.values.get(KEY);page.state.account = 'offline';await page.visible();
  assert.equal(page.values.get(KEY), before);assert.equal(page.get('retry-connect').hidden, false);assert.match(page.notice(), /로그인 정보는 유지/);
  page.state.account = 'ok';await page.retry();assert.equal(page.get('account').hidden, false);assert.equal(page.get('retry-connect').hidden, true);
});

test('logout closes the device before a delayed server reply and cannot delete a later tab session', async () => {
  const pending = deferred(), page = await fixture({ revokeWait: pending });
  page.button('이 제품에서 로그아웃').onclick();await settle();
  assert.equal(page.get('account').hidden, true);assert.equal(page.values.has(KEY), false);assert.match(page.notice(), /이 기기에서 로그아웃/);
  await page.fireWindow('pagehide');const nextSession = JSON.stringify({ access_token: 'synthetic-other', refresh_token: 'synthetic-other-refresh' });page.values.set(KEY, nextSession);
  pending.resolve();await settle();assert.equal(page.values.get(KEY), nextSession);
});

test('logout token refresh never writes credentials back into the cleared device session', async () => {
  const page = await fixture({ revocationNeedsRefresh: true });page.button('이 제품에서 로그아웃').onclick();await settle();
  assert.equal(page.calls.token, 1);assert.equal(page.calls.revoke, 2);assert.equal(page.values.has(KEY), false);assert.equal(page.get('account').hidden, true);
  assert.match(page.notice(), /이 브라우저에서 로그아웃했어요/);
});

test('logout immediately fences a pending record export while its own server request is still pending', async () => {
  const exported = deferred(), revoked = deferred(), page = await fixture({ exportWait: exported, revokeWait: revoked });
  page.button('연결된 연습 기록 내려받기').onclick();await settle();assert.equal(page.calls.export, 1);
  page.button('이 제품에서 로그아웃').onclick();await settle();assert.equal(page.get('account').hidden, true);
  exported.resolve();await settle();assert.equal(page.downloads(), 0);assert.doesNotMatch(page.notice(), /기록을 내려받았어요/);
  revoked.resolve();await settle();assert.equal(page.values.has(KEY), false);
});

test('starting a new login fences the old pending logout notice before navigation completes', async () => {
  const pending = deferred(), page = await fixture({ revokeWait: pending });page.button('이 제품에서 로그아웃').onclick();await settle();
  await page.get('connect').onclick();await settle();assert.equal(page.navigations.length, 1);assert.equal(new URL(page.navigations[0]).pathname, '/auth/v1/oauth/authorize');
  const message = page.notice();assert.match(message, /로그인 화면으로 이동/);
  pending.resolve();await settle();assert.equal(page.notice(), message);assert.equal(page.get('connect').disabled, true);
});
