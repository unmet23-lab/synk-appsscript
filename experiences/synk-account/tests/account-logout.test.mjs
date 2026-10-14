import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import { createClient } from '@supabase/supabase-js';
import { createAccountView } from '../src/account-view.mjs';
import { mountPortal } from '../src/portal.mjs';
import { emptyPlayState } from '../../play-common/play-data.mjs';

// Exercise the real view and the built client entry point against a minimal DOM.
// No remote Auth service, browser credentials or production account is used.
class Node {
  constructor(tag = 'div') { this.tagName = tag;this.children = [];this.dataset={};this.textContent = '';this.hidden = false;this.disabled = false;this.classList = { add() {}, remove() {} }; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  addEventListener() {}
  closest() { return this; }
  before() {}
  remove() {}
  setAttribute(key,value){this[key]=value;}
  querySelector(selector){return this.children.find(n=>selector==='[data-sharing-status]'&&Object.hasOwn(n.dataset||{},'sharingStatus'))||null;}
}
function dom() {
  const ids = new Map(), selectors = new Map();
  const get = (map, key) => { if (!map.has(key)) map.set(key, new Node());return map.get(key); };
  const document = { body: new Node('body'), createElement: tag => new Node(tag), getElementById: id => get(ids, id), querySelector: selector => get(selectors, selector), querySelectorAll: () => [],addEventListener(){},removeEventListener(){} };
  const root = document.getElementById('account');root.hidden = true;
  const find = (node, label) => node.tagName === 'button' && node.textContent === label ? node : node.children.map(child => find(child, label)).find(Boolean);
  return { document, root, button: label => { const value = find(root, label) || find(document.getElementById('world-games'), label);assert.ok(value, `button missing: ${label}`);return value; } };
}
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve)); };
const fixture = () => ({ ok: true, account: { synk_user_id: 'synthetic-account', status: 'active', profile: {} }, learning: { enabled: false, revision: 1 }, capabilities: { learningSync: false }, sessions: [
  { id: 'synthetic-current', current: true, revoked: false }, { id: 'synthetic-other', current: false, revoked: false },
] });
async function viewFixture(t, { current = true, oldCallback = false, otherFailure = false } = {}) {
  const page = dom(), calls = [], notices = [], data = fixture();if (!current) data.sessions = [];
  const originals = ['document', 'window'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  Object.assign(globalThis, { document: page.document, window: {} });
  t.after(() => { for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor);else delete globalThis[key]; } });
  let active = true, view;
  const client = { load: async () => { calls.push(['load']);return data; }, revokeSession: async id => { calls.push(['revoke', id]);if (otherFailure) throw new Error('synthetic offline');return { ok: true }; }, revokeAll: async () => { throw new Error('view must delegate global logout'); } };
  const notice = (...args) => notices.push(args);
  const logout = oldCallback ? async note => { calls.push(['legacy-logout', note]);view.stop(); } : async (note, request) => { calls.push(['logout', note, request]);active = false;view.stop();notice('local closed; server status belongs to host'); };
  view = createAccountView({ client, product: 'platform', guard: () => { if (!active) throw new Error('stale account'); }, notice, logout, preview: true });
  await view.load();return { ...page, calls, notices, view };
}

test('current logout delegates to the host without requiring successful server revocation', async t => {
  const page = await viewFixture(t);page.button('이 제품에서 로그아웃').onclick();await settle();
  assert.deepEqual(page.calls, [['load'], ['logout', undefined, { scope: 'current', sessionId: 'synthetic-current' }]]);
  assert.equal(page.root.hidden, true);assert.deepEqual(page.notices, [['local closed; server status belongs to host']]);
});
test('current session row and all-products exit use the same host contract', async t => {
  const page = await viewFixture(t);page.button('종료').onclick();await settle();
  assert.equal(page.calls[1][2].scope, 'current');assert.equal(page.root.hidden, true);
  const all = await viewFixture(t);all.button('모든 제품의 로그인 종료').onclick();await settle();
  assert.equal(all.calls[1][2].scope, 'all');assert.equal(all.root.hidden, true);
});
test('missing server session and legacy preview callbacks still close locally', async t => {
  const page = await viewFixture(t, { current: false });page.button('이 제품에서 로그아웃').onclick();await settle();
  assert.equal(page.calls[1][2].sessionId, null);assert.equal(page.root.hidden, true);
  const legacy = await viewFixture(t, { oldCallback: true });legacy.button('모든 제품의 로그인 종료').onclick();await settle();
  assert.deepEqual(legacy.calls[1], ['legacy-logout', undefined]);assert.equal(legacy.root.hidden, true);
});
test('ending another device keeps this account open and reports remote failure', async t => {
  const page = await viewFixture(t, { otherFailure: true });
  const rows = page.root.children.flatMap(node => node.children).flatMap(node => node.children).filter(node => node.className === 'session-row');
  rows[1].children.find(node => node.tagName === 'button').onclick();await settle();
  assert.deepEqual(page.calls, [['load'], ['revoke', 'synthetic-other']]);assert.equal(page.root.hidden, false);
  assert.deepEqual(page.notices, [['synthetic offline', true]]);
});

const runtime = buildSync({ entryPoints: [fileURLToPath(new URL('../src/client.mjs', import.meta.url))], bundle: true, write: false, format: 'iife', platform: 'browser' }).outputFiles[0].text;
async function clientFixture({ reply = 'offline', sessions = fixture().sessions, removeFailure = false, desktop = false, bridgeThrow = false, product = 'platform' } = {}) {
  const page = dom(), values = new Map([[`synk.oauth.session.${product}`, JSON.stringify({ access_token: 'synthetic-access', refresh_token: 'synthetic-refresh' })]]), calls = [];
  const account = { ...fixture(), sessions };
  const base = `https://${product}.example.test/client.html?product=${product}`;
  const config = { version: 1, supabaseUrl: 'https://auth.example.test', supabasePublishableKey: 'sb_publishable_synthetic', portalUrl: 'https://id.example.test/', clients: { [product]: { clientId: `${product}-web`, redirectUri: base } } };
  let state = { configured: true, signedIn: true, status: 'signed-in', sessionGeneration: 1, account: account.account }, listener,copyToRenderer=value=>value;
  const bridge = {
    getEnvironment: async () => ({ clientId: product }), authStatus: async () => state,
    onAuthChanged: callback => { listener = callback;return () => {}; },
    accountRequest: async operation => { calls.push(operation);if (operation === 'load') return account;if(operation==='classroom')return {ok:true,classes:[]};if(operation==='playLoad')return copyToRenderer({ok:true,scope:'synk-play',accountId:account.account.synk_user_id,revision:0,state:emptyPlayState()});if (bridgeThrow) throw new Error('synthetic IPC failure');return { ok: false }; },
    authSignOut: async () => { calls.push('authSignOut');state = { configured: true, signedIn: false, status: 'signed-out' };listener?.(state);return { ok: true, serverRevoked: false }; },
  };
  const window = { addEventListener() {}, ...(desktop ? { synkDesktop: bridge } : {}) };
  const context = vm.createContext({ document: page.document, window, URL, URLSearchParams, AbortController, TextEncoder, setTimeout, clearTimeout, console,
    location: { href: base }, localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
    sessionStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => { if (removeFailure) throw new Error('synthetic storage denied');values.delete(key); } },
    fetch: async (url, init) => { if (url === './config.json') return { ok: true, json: async () => config };
      if (init?.method === 'GET') return { ok: true, status: 200, json: async () => account };
      calls.push(JSON.parse(init.body).action);if (reply === 'offline') throw new Error('synthetic offline');
      return { ok: true, status: 200, json: async () => ({ ok: true, current: true, refreshRevoked: reply === 'complete', legacyAccessGuard: reply === 'complete' }) };
    },
  });
  copyToRenderer=vm.runInContext('(value)=>JSON.parse(JSON.stringify(value))',context);
  vm.runInContext(runtime, context);await settle();assert.equal(page.root.hidden, false, page.document.getElementById('notice').textContent);
  return { ...page, values, calls, window, state: () => state, notice: () => page.document.getElementById('notice'),
    emit: async next => { state = next;if (state.signedIn && state.account) account.account = state.account;listener?.(state);await settle(); } };
}
test('actual web client clears local credentials when current/all server logout is offline', async () => {
  for (const label of ['이 제품에서 로그아웃', '모든 제품의 로그인 종료']) {
    const page = await clientFixture();page.button(label).onclick();await settle();
    assert.equal(page.values.has('synk.oauth.session.platform'), false);assert.equal(page.root.hidden, true);
    assert.match(page.notice().textContent, /서버의 로그인 종료는 연결 후 다시 확인/);assert.match(page.notice().className, /error/);
  }
});
test('actual web client distinguishes incomplete Auth revocation and no current server session', async () => {
  for (const options of [{ reply: 'partial' }, { sessions: [] }]) {
    const page = await clientFixture(options);page.button('이 제품에서 로그아웃').onclick();await settle();
    assert.equal(page.values.has('synk.oauth.session.platform'), false);assert.match(page.notice().textContent, /서버의 로그인 종료는 연결 후 다시 확인/);
  }
});
test('actual web client keeps storage failure visible and reports completed revocation accurately', async () => {
  const blocked = await clientFixture({ removeFailure: true });blocked.button('이 제품에서 로그아웃').onclick();await settle();
  assert.equal(blocked.root.hidden, true);assert.equal(blocked.values.has('synk.oauth.session.platform'), true);assert.match(blocked.notice().textContent, /브라우저 저장을 지우지 못/);
  const complete = await clientFixture({ reply: 'complete' });complete.button('모든 제품의 로그인 종료').onclick();await settle();
  assert.equal(complete.root.hidden, true);assert.match(complete.notice().textContent, /모든 제품에 로그인 종료를 요청/);assert.doesNotMatch(complete.notice().className, /error/);
});
test('actual desktop client delegates current logout and clears locally after a thrown global request', async () => {
  const current = await clientFixture({ desktop: true });current.button('이 제품에서 로그아웃').onclick();await settle();
  assert.deepEqual(current.calls, ['load', 'atlasSummary', 'authSignOut']);assert.equal(current.root.hidden, true);assert.match(current.notice().textContent, /서버의 로그인 종료는 연결 후 다시 확인/);
  const all = await clientFixture({ desktop: true, bridgeThrow: true });all.button('모든 제품의 로그인 종료').onclick();await settle();
  assert.deepEqual(all.calls, ['load', 'atlasSummary', 'revokeAll', 'authSignOut']);assert.equal(all.root.hidden, true);assert.match(all.notice().textContent, /서버의 로그인 종료는 연결 후 다시 확인/);
});

test('same-session desktop refresh preserves the running WORLD iframe, host and account guard', async () => {
  const page = await clientFixture({ desktop: true, product: 'world' }), signedIn = page.state();
  page.button('한국어 레이싱').onclick();await settle();
  const world = page.document.getElementById('world-games'), frame = world.children.find(node => node.tagName === 'iframe');
  const host = page.window.SYNKLearningHost, head = page.root.children[0], source = frame.src;
  assert.equal(frame.hidden, false);assert.match(source, /korean-racing/);
  await page.emit({ ...signedIn, status: 'restoring', signedIn: false, account: null });
  assert.equal(page.root.hidden, false);assert.equal(page.root.children[0], head);assert.equal(page.window.SYNKLearningHost, host);
  assert.equal(world.children.find(node => node.tagName === 'iframe'), frame);assert.equal(frame.src, source);assert.equal(frame.hidden, false);
  assert.equal(page.document.getElementById('connect').hidden, true);assert.doesNotThrow(() => host.retry());
  await page.emit(signedIn);
  assert.equal(page.window.SYNKLearningHost, host);assert.equal(page.root.children[0], head);assert.equal(frame.src, source);
  assert.deepEqual(page.calls.filter(x=>x!=='playLoad'), ['classroom','load','atlasSummary']);assert.ok(page.calls.includes('playLoad'));assert.doesNotThrow(() => host.retry());
});
test('a new session generation, revoked session or restore error closes the previous WORLD host', async () => {
  for (const change of [
    { status: 'restoring', sessionGeneration: 2 },
    { status: 'signed-out' },
    { status: 'error', error: { code: 'SESSION_REVOKED', message: 'synthetic revoked' } },
    { status: 'restoring', error: { code: 'AUTH_UNAVAILABLE', message: 'synthetic restore error' } },
  ]) {
    const page = await clientFixture({ desktop: true, product: 'world' }), host = page.window.SYNKLearningHost;
    await page.emit({ ...page.state(), signedIn: false, account: null, ...change });
    assert.equal(page.root.hidden, true);assert.equal(page.window.SYNKLearningHost, undefined);
    assert.equal(page.document.getElementById('world-games').children.length, 0);assert.throws(() => host.retry(), /바뀌|ended/);
  }
});
test('switching account within a signed-in desktop event replaces and fences the previous WORLD host', async () => {
  const page = await clientFixture({ desktop: true, product: 'world' }), host = page.window.SYNKLearningHost;
  await page.emit({ ...page.state(), sessionGeneration: 2, account: { synk_user_id: 'synthetic-new-account', profile: {}, status: 'active' } });
  assert.equal(page.root.hidden, false);assert.notEqual(page.window.SYNKLearningHost, host);assert.throws(() => host.retry(), /바뀌|ended/);
  assert.doesNotThrow(() => page.window.SYNKLearningHost.retry());assert.deepEqual(page.calls.filter(x=>x!=='playLoad'), ['classroom','load','atlasSummary', 'classroom','load','atlasSummary']);
});

async function portalFixture(t, { server = 'offline', clear = true, preview = false, switchAccount = false } = {}) {
  const page = dom(), calls = [], cleanupAccounts = [], initial = { access_token: 'synthetic-access', user: { id: 'synthetic-user' } };
  let saved = initial, listener;
  const originals = ['document', 'window', 'location'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  Object.assign(globalThis, { document: page.document, window: { addEventListener() {} }, location: { href: 'https://id.example.test/index.html' } });
  t.after(() => { for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor);else delete globalThis[key]; } });
  const sdk = { auth: {
    getSession: async () => ({ data: { session: saved } }), getUser: async () => ({ data: { user: saved.user } }),
    onAuthStateChange: fn => { listener = fn;return {}; },
    signOut: async ({ scope }) => { calls.push(`sdk:${scope}`);cleanupAccounts.push(saved?.user?.id);if (clear) { saved = null;listener('SIGNED_OUT', null); }return { error: server === 'offline' ? new Error('synthetic offline') : null }; },
  } };
  const revoke = async action => {
    calls.push(action);
    if (switchAccount) { saved = { access_token: 'synthetic-new-access', user: { id: 'synthetic-new-user' } };listener('SIGNED_IN', saved);await settle(); }
    if (server === 'offline') throw new Error('synthetic offline');
    return { refreshRevoked: server === 'complete', legacyAccessGuard: server === 'complete' };
  };
  const client = { load: async () => { const data = fixture();data.account.synk_user_id = saved?.user?.id;return data; }, revokeSession: async id => { assert.equal(id, 'synthetic-current');return revoke('current'); }, revokeAll: () => revoke('all') };
  await mountPortal({ config: { configured: true, learningUrl: '/', accountApiUrl: 'https://auth.example.test', supabasePublishableKey: 'synthetic-public' }, sdk, accountFactory: () => client, preview });
  return { ...page, calls, cleanupAccounts, saved: () => saved, notice: () => page.document.getElementById('notice') };
}
test('actual portal forwards global revocation but SDK local cleanup still runs when server is offline', async t => {
  const page = await portalFixture(t);page.button('모든 제품의 로그인 종료').onclick();await settle();
  assert.deepEqual(page.calls, ['all', 'sdk:local']);assert.equal(page.saved(), null);assert.equal(page.root.hidden, true);
  assert.match(page.notice().textContent, /서버의 로그인 종료는 연결 후 다시 확인/);
});
test('actual portal separates server completion, local storage failure and synthetic preview', async t => {
  const complete = await portalFixture(t, { server: 'complete' });complete.button('모든 제품의 로그인 종료').onclick();await settle();
  assert.match(complete.notice().textContent, /모든 제품에 로그인 종료를 요청/);assert.doesNotMatch(complete.notice().className, /error/);
  const blocked = await portalFixture(t, { clear: false });blocked.button('이 제품에서 로그아웃').onclick();await settle();
  assert.notEqual(blocked.saved(), null);assert.match(blocked.notice().textContent, /로그인 저장이 지워졌는지 확인하지 못/);
  const example = await portalFixture(t, { preview: true });example.button('모든 제품의 로그인 종료').onclick();await settle();
  assert.match(example.notice().textContent, /실제 다른 제품의 로그인은 종료하지 않았/);
});
test('portal logout cannot clear a newer account received while revocation was pending', async t => {
  const page = await portalFixture(t, { switchAccount: true });page.button('모든 제품의 로그인 종료').onclick();await settle();
  assert.deepEqual(page.calls, ['all']);assert.deepEqual(page.cleanupAccounts, [], 'SDK cleanup must not sign out the newer account received during revocation');
  assert.equal(page.saved().user.id, 'synthetic-new-user');assert.equal(page.root.hidden, false);
  const text = node => [node.textContent, ...node.children.map(text)].join(' ');
  assert.match(text(page.root), /SYNK ID · synthetic-new-user/);assert.match(page.notice().textContent, /로그인됐어요/);
});

test('installed Auth SDK removes its persisted local session even when remote logout returns 503', async () => {
  const key = 'synk-synthetic-sdk-logout', values = new Map([[key, JSON.stringify({
    access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: 'synthetic-user' },
  })]]), calls = [];
  const sdk = createClient('https://auth.example.test', 'sb_publishable_synthetic', {
    auth: { persistSession: true, storageKey: key, autoRefreshToken: false, detectSessionInUrl: false,
      storage: { getItem: name => values.get(name) ?? null, setItem: (name, value) => values.set(name, value), removeItem: name => values.delete(name) } },
    global: { fetch: async url => { calls.push(String(url));return new Response(JSON.stringify({ message: 'synthetic unavailable' }), { status: 503, headers: { 'Content-Type': 'application/json' } }); } },
  });
  try {
    const result = await sdk.auth.signOut({ scope: 'local' });
    assert.ok(result.error);assert.equal(values.has(key), false);
    assert.equal((await sdk.auth.getSession()).data.session, null);
    assert.equal(calls.length, 1);assert.match(calls[0], /\/logout\?scope=local$/);
  } finally { await sdk.auth.dispose(); }
});
