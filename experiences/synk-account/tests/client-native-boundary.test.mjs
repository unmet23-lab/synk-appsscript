import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';

const runtime = buildSync({ entryPoints: [fileURLToPath(new URL('../src/client.mjs', import.meta.url))], bundle: true, write: false, format: 'iife', platform: 'browser' }).outputFiles[0].text;
const deferred = () => { let resolve, reject;const promise = new Promise((done, fail) => { resolve = done;reject = fail; });return { promise, resolve, reject }; };
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise(setImmediate); };
const signedIn = (id = 'synthetic-a', sessionGeneration = 1) => ({ configured: true, signedIn: true, status: 'signed-in', sessionGeneration, account: { synk_user_id: id } });
const signedOut = sessionGeneration => ({ configured: true, signedIn: false, status: 'signed-out', sessionGeneration, account: null });
const accountData = id => ({ ok: true, account: { synk_user_id: id, status: 'active', profile: { display_name: id } }, learning: { enabled: false, revision: 1 }, capabilities: { learningSync: false }, sessions: [{ id: 'synthetic-current', current: true }] });
class Element {
  constructor(tag = 'div') { this.tagName = tag;this.children = [];this.dataset = {};this.hidden = false;this.disabled = false;this.textContent = '';this.classList = { add() {}, remove() {} }; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  before() {}
  setAttribute(key, value) { this[key] = value; }
  querySelector() { return null; }
  addEventListener() {}
  remove() {}
  click() { this.clicked = true; }
}
async function fixture({ initial = signedIn(), initialStatus, product = 'platform' } = {}) {
  let state = initial, listener;
  const nodes = [], ids = new Map(), events = new Map(), calls = [], waits = { status: initialStatus, revoke: null, export: null, signIn: null, cancel: null, signOut: null };
  const make = tag => { const node = new Element(tag);nodes.push(node);return node; };
  const get = id => { if (!ids.has(id)) ids.set(id, make('div'));return ids.get(id); };
  const emit = next => { state = next;listener?.(next); };
  const bridge = {
    getEnvironment: async () => ({ clientId: product }),
    authStatus: async () => { calls.push('authStatus');if (waits.status) { const next = waits.status;waits.status = null;return next.promise; }return state; },
    onAuthChanged: fn => { listener = fn;return () => { listener = null; }; },
    authSignIn: async () => { calls.push('authSignIn');return waits.signIn ? waits.signIn.promise : state; },
    authCancelSignIn: async () => { calls.push('authCancelSignIn');const next = signedOut(state.sessionGeneration + 1);emit(next);return waits.cancel ? waits.cancel.promise : next; },
    authSignOut: async () => { calls.push('authSignOut');emit(signedOut(state.sessionGeneration + 1));return waits.signOut ? waits.signOut.promise : { ok: true, serverRevoked: false }; },
    accountRequest: async operation => {
      calls.push(operation);
      if (operation === 'load') return accountData(state.account?.synk_user_id);
      if (operation === 'classroom') return { ok: true, classes: [] };
      if (operation === 'atlasSummary') return { ok: true };
      if (operation === 'exportPage') return waits.export.promise;
      if (operation === 'revokeAll') {
        const expected = state.sessionGeneration, result = waits.revoke ? await waits.revoke.promise : { ok: false };
        if (expected !== state.sessionGeneration) return { ok: false, error: { code: 'AUTH_CHANGED' } };
        if (result.ok) emit(signedOut(state.sessionGeneration + 1));return result;
      }
      return { ok: false };
    },
  };
  const document = { body: make('body'), createElement: make, getElementById: get, querySelector: get, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {} };
  for (const id of ['account', 'setup', 'connect', 'cancel-connect']) get(id).hidden = true;
  const window = { synkDesktop: bridge, addEventListener(name, fn) { if (!events.has(name)) events.set(name, []);events.get(name).push(fn); }, removeEventListener() {} };
  vm.runInContext(runtime, vm.createContext({ document, window, location: { href: `https://native.example.test/client.html?product=${product}` }, URL, URLSearchParams, AbortController, Blob, setTimeout, clearTimeout, console,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }, sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }, fetch: () => { throw new Error('native renderer must use IPC'); } }));
  await settle();
  const walk = node => [node, ...node.children.flatMap(walk)];
  return { get, calls, waits, window, state: () => state, notice: () => get('notice').textContent, downloads: () => nodes.filter(node => node.download && node.clicked).length,
    button: text => { const found = walk(get('account')).concat(walk(get('world-games'))).find(node => node.tagName === 'button' && node.textContent === text);assert.ok(found, `Missing ${text}`);return found; },
    emit: async next => { emit(next);await settle(); }, fire: async name => { for (const fn of events.get(name) || []) fn({});await settle(); } };
}

test('native global logout closes immediately and blocks late export while revocation waits', async () => {
  const page = await fixture(), exporting = deferred(), revoking = deferred();page.waits.export = exporting;page.waits.revoke = revoking;
  page.button('연습 기록 내려받기').onclick();await settle();page.button('모든 SYNK 앱에서 로그아웃').onclick();
  assert.equal(page.get('account').hidden, true);assert.equal(page.get('account').children.length, 0);
  exporting.resolve({ ok: true, events: [], cursor: 0, until: 0, hasMore: false });await settle();assert.equal(page.downloads(), 0);
  revoking.resolve({ ok: false, error: { code: 'NETWORK' } });await settle();
  assert.equal(page.calls.filter(call => call === 'authSignOut').length, 1);assert.equal(page.get('account').hidden, true);
  assert.match(page.notice(), /서버의 로그인 종료는 연결 후 다시 확인/);
});

for (const snapshotGeneration of [1, 2]) test(`a late initial native auth snapshot (${snapshotGeneration}) cannot replace a newer signed-in event`, async () => {
  const pending = deferred(), page = await fixture({ initial: signedOut(1), initialStatus: pending });
  await page.emit(signedIn('synthetic-b', 2));assert.equal(page.get('account').hidden, false);
  const head = page.get('account').children[0];pending.resolve(signedOut(snapshotGeneration));await settle();
  assert.equal(page.get('account').hidden, false);assert.equal(page.get('account').children[0], head);
});

test('an old global logout failure cannot sign out a newer native account', async () => {
  const page = await fixture(), pending = deferred();page.waits.revoke = pending;
  page.button('모든 SYNK 앱에서 로그아웃').onclick();await settle();await page.emit(signedIn('synthetic-b', 2));
  const notice = page.notice();pending.resolve({ ok: false, error: { code: 'NETWORK' } });await settle();
  assert.equal(page.state().account.synk_user_id, 'synthetic-b');assert.equal(page.get('account').hidden, false);
  assert.equal(page.calls.includes('authSignOut'), false);assert.equal(page.notice(), notice);
});

test('native login cancellation rejects its older in-flight sign-in snapshot', async () => {
  const page = await fixture({ initial: signedOut(1) }), pending = deferred();page.waits.signIn = pending;
  const login = page.get('connect').onclick();await settle();await page.emit({ ...signedOut(2), status: 'signing-in' });
  await page.get('cancel-connect').onclick();const notice = page.notice();
  pending.resolve({ ...signedOut(2), status: 'signing-in' });await login;
  assert.equal(page.get('cancel-connect').hidden, true);assert.equal(page.get('connect').disabled, false);assert.equal(page.notice(), notice);
});

test('global WORLD logout stops the game host and same-session refresh cannot reopen it', async () => {
  const page = await fixture({ product: 'world' }), pending = deferred();page.waits.revoke = pending;
  page.button('한국어 레이싱').onclick();await settle();const host = page.window.SYNKLearningHost;
  page.button('모든 SYNK 앱에서 로그아웃').onclick();assert.equal(page.window.SYNKLearningHost, undefined);
  assert.equal(page.get('world-games').children.length, 0);assert.throws(() => host.retry(), /바뀌|ended/);
  await page.emit({ ...signedIn(), status: 'restoring', signedIn: false, account: null });await page.emit(signedIn());
  assert.equal(page.get('account').hidden, true);assert.equal(page.window.SYNKLearningHost, undefined);
  pending.resolve({ ok: true, refreshRevoked: true, legacyAccessGuard: true });await settle();
  assert.equal(page.calls.includes('authSignOut'), false);assert.match(page.notice(), /모든 제품에 로그인 종료를 요청/);
});

test('a stale native signed-in event cannot reopen a revoked session', async () => {
  const page = await fixture();await page.emit({ ...signedOut(2), error: { code: 'AUTH_REQUIRED', message: '다시 로그인해 주세요.' } });const notice = page.notice();
  await page.emit(signedIn());assert.equal(page.get('account').hidden, true);assert.equal(page.get('connect').disabled, false);assert.equal(page.notice(), notice);
});
