import test from 'node:test';
import assert from 'node:assert/strict';
import { mountPortal } from '../src/portal.mjs';

// Actual portal/view handlers, synthetic DOM/SDK/account transport; no credentials or network.
class Element {
  constructor(tag = 'div') { this.tagName = tag;this.children = [];this.dataset = {};this.hidden = false;this.disabled = false;this.value = '';this.textContent = '';this.classList = { add() {}, remove() {} }; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(key, value) { this[key] = value; }
  closest() { return this; }
  before() {}
  addEventListener() {}
  querySelector() { return null; }
}
const deferred = () => { let resolve, reject;const promise = new Promise((done, fail) => { resolve = done;reject = fail; });return { promise, resolve, reject }; };
const settled = async () => { for (let n = 0; n < 5; n++) await new Promise(resolve => setImmediate(resolve)); };
const syntheticSession = id => ({ user: { id }, access_token: `synthetic-access-${id}` });
const syntheticAccount = id => ({ ok: true, account: { synk_user_id: id, status: 'active', profile: { display_name: id } },
  learning: { enabled: false, revision: 1 }, capabilities: { learningSync: true }, sessions: [{ id: `synthetic-session-${id}`, current: true }] });
function clock() {
  let now = 0, id = 0;const timers = new Map();
  return { now: () => now, setTimeout(fn, ms) { timers.set(++id, { at: now + ms, fn });return id; }, clearTimeout: id => timers.delete(id),
    advance(ms) { now += ms;for (const [key, timer] of [...timers]) if (timer.at <= now) { timers.delete(key);timer.fn(); } } };
}
async function fixture(t, { account } = {}) {
  const ids = new Map(), events = new Map(), get = id => { if (!ids.has(id)) ids.set(id, new Element());return ids.get(id); };
  const controls = ['login', 'signup', 'recover'].map(view => Object.assign(new Element('button'), { dataset: { view } }));
  const calls = [], replies = { cleanup: null, revoke: null, export: null, login: null, getUser: null }, time = clock();
  let saved = syntheticSession('synthetic-a'), listener, downloaded = 0;
  const emit = (event, value) => { saved = value;listener(event, value); };
  const original = ['document', 'window', 'location'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  Object.assign(globalThis, {
    document: { body: new Element(), getElementById: get, createElement: tag => { const node = new Element(tag);node.click = () => { if (tag === 'a') downloaded++; };return node; }, querySelectorAll: () => controls },
    window: { addEventListener: (name, fn) => events.set(name, fn), removeEventListener() {}, history: {} },
    location: { href: 'https://id.example.test/', assign() {}, reload() {} },
  });
  t.after(() => { events.get('pagehide')?.({});for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor);else delete globalThis[key]; } });
  const sdk = { auth: {
    initialize: async () => ({}), onAuthStateChange: fn => { listener = fn; },
    getSession: async () => { calls.push({ method: 'getSession' });return { data: { session: saved } }; },
    getUser: async jwt => { calls.push({ method: 'getUser', jwt });return replies.getUser ? replies.getUser(jwt) : { data: { user: saved?.user } }; },
    signOut: async options => { calls.push({ method: 'signOut', options });if (replies.cleanup) return replies.cleanup();emit('SIGNED_OUT', null);return {}; },
    signInWithPassword: async () => { calls.push({ method: 'signIn' });return replies.login ? replies.login() : { data: { session: null } }; },
  } };
  const factory = ({ guard, getAccessToken, refresh }) => {
    const call = async (method, work) => { guard();const token = getAccessToken();calls.push({ method, token, canRefresh: typeof refresh === 'function' });const result = await work(token);guard();return result; };
    return {
      load: () => call('load', token => (account || syntheticAccount)(token.replace('synthetic-access-', ''))),
      exportPage: () => call('export', () => replies.export()),
      setLearning: () => call('setLearning', () => ({ ok: true })),
      revokeSession: id => call('revokeSession', () => replies.revoke ? replies.revoke(id) : { refreshRevoked: true }),
      revokeAll: () => call('revokeAll', () => replies.revoke ? replies.revoke() : { refreshRevoked: true, legacyAccessGuard: true }),
    };
  };
  await mountPortal({ config: { configured: true, portalUrl: 'https://id.example.test/', learningUrl: '/' }, sdk, accountFactory: factory, cooldownClock: time });
  const walk = node => [node, ...node.children.flatMap(walk)];
  return { get, calls, replies, time, events, downloaded: () => downloaded,
    button: text => walk(get('account')).find(node => node.tagName === 'button' && node.textContent === text),
    emit: async (event, value) => { emit(event, value);await settled(); },
    submit: () => get('auth-form').onsubmit({ preventDefault() {} }),
    clearSdk: () => emit('SIGNED_OUT', null), notice: () => get('notice').textContent,
  };
}

test('logout immediately closes the account and fences a pending export while SDK and revocation wait', async t => {
  const page = await fixture(t), exporting = deferred(), cleanup = deferred(), revoking = deferred();
  page.replies.export = () => exporting.promise;page.replies.cleanup = () => cleanup.promise;page.replies.revoke = () => revoking.promise;
  const exportButton = page.button('내려받기'), deleteButton = page.button('계정 삭제 요청');
  exportButton.onclick();await settled();page.button('로그아웃').onclick();
  assert.equal(page.get('account').hidden, true);assert.equal(page.get('account').children.length, 0);
  await settled();assert.equal(page.calls.filter(call => call.method === 'signOut').length, 0);
  assert.equal(page.get('auth-submit').disabled, true);
  await page.emit('TOKEN_REFRESHED', syntheticSession('synthetic-a'));
  assert.equal(page.get('account').hidden, true);
  exporting.resolve({ events: [], cursor: 0, until: 0, hasMore: false });await settled();deleteButton.onclick();await settled();
  assert.equal(page.downloaded(), 0);assert.equal(document.body.children.length, 0);
  assert.doesNotMatch(page.notice(), /내려받았어요/);
  const revokeCall = page.calls.find(call => call.method === 'revokeSession');
  assert.equal(revokeCall.token, 'synthetic-access-synthetic-a');assert.equal(revokeCall.canRefresh, false);
  revoking.resolve({ refreshRevoked: true });await settled();assert.equal(page.calls.filter(call => call.method === 'signOut').length, 1);
  page.clearSdk();cleanup.resolve({});await settled();
  assert.equal(page.get('auth-submit').disabled, false);assert.match(page.notice(), /이 브라우저에서 로그아웃했어요/);
});

test('server revocation failure still clears the SDK session and reports its incomplete server result', async t => {
  const page = await fixture(t), revoking = deferred();page.replies.revoke = () => revoking.promise;
  page.button('모든 SYNK 앱에서 로그아웃').onclick();await settled();
  assert.equal(page.get('account').hidden, true);assert.equal(page.get('auth-submit').disabled, true);
  revoking.reject(new Error('synthetic unavailable'));await settled();
  assert.equal(page.get('auth-submit').disabled, false);
  assert.match(page.notice(), /이 브라우저에서 로그아웃했어요.*서버의 로그인 종료는 연결 후/);
  assert.equal(page.get('notice').className, 'notice error');assert.equal(page.get('notice')['data-kind'], 'error');
  assert.equal(page.calls.filter(call => call.method === 'signOut').length, 1);
});

test('an SDK cleanup timeout keeps this tab sign-in locked until the real cleanup settles', async t => {
  const page = await fixture(t), cleanup = deferred();page.replies.cleanup = () => cleanup.promise;
  page.button('로그아웃').onclick();await settled();page.time.advance(12000);await settled();
  assert.equal(page.get('auth-submit').disabled, true);assert.match(page.notice(), /브라우저의 로그인 종료가 아직 끝나지/);
  await page.submit();assert.equal(page.calls.some(call => call.method === 'signIn'), false);
  page.clearSdk();cleanup.resolve({});await settled();assert.equal(page.get('auth-submit').disabled, false);
});

test('a different SDK account arriving after central revocation during cleanup owns the screen afterwards', async t => {
  const page = await fixture(t), cleanup = deferred(), revoking = deferred();page.replies.cleanup = () => cleanup.promise;page.replies.revoke = () => revoking.promise;
  page.button('로그아웃').onclick();await settled();revoking.resolve({ refreshRevoked: true });await settled();
  await page.emit('SIGNED_IN', syntheticSession('synthetic-b'));
  cleanup.resolve({});await settled();
  assert.equal(page.get('account').hidden, false);const notice = page.notice();
  assert.ok(page.calls.some(call => call.method === 'load' && call.token === 'synthetic-access-synthetic-b'));
  await settled();
  assert.equal(page.get('account').hidden, false);assert.equal(page.notice(), notice);
  assert.equal(page.calls.filter(call => call.method === 'signOut').length, 1);
});

test('a newer sign-in intent keeps its pending notice when a timed-out old revocation later completes', async t => {
  const page = await fixture(t), revoking = deferred(), login = deferred();page.replies.revoke = () => revoking.promise;page.replies.login = () => login.promise;
  page.button('로그아웃').onclick();await settled();page.time.advance(12000);await settled();
  const signingIn = page.submit();await settled();
  const notice = page.notice();revoking.resolve({ refreshRevoked: true });await settled();
  assert.equal(page.notice(), notice);assert.equal(page.get('auth-submit').disabled, true);
  await page.emit('SIGNED_IN', syntheticSession('synthetic-b'));login.resolve({ data: { session: syntheticSession('synthetic-b') } });await signingIn;
  assert.equal(page.get('account').hidden, false);assert.match(page.notice(), /로그인됐어요/);
});

test('unconfirmed SDK storage cleanup reports a warning without reopening the old account', async t => {
  const page = await fixture(t);page.replies.cleanup = async () => { throw new Error('synthetic storage unavailable'); };
  page.button('로그아웃').onclick();await settled();
  assert.equal(page.get('account').hidden, true);assert.match(page.notice(), /로그인 저장이 지워졌는지 확인하지 못했어요/);
  const notice = page.notice();await page.emit('SIGNED_IN', syntheticSession('synthetic-a'));await page.emit('TOKEN_REFRESHED', syntheticSession('synthetic-a'));
  assert.equal(page.get('account').hidden, true);assert.equal(page.notice(), notice);
  page.replies.login = async () => { await page.emit('SIGNED_IN', syntheticSession('synthetic-a'));return { error: { code: 'invalid_credentials' } }; };
  await page.submit();assert.equal(page.get('account').hidden, true);assert.match(page.notice(), /이메일 또는 비밀번호/);
  page.replies.login = async () => { await page.emit('SIGNED_IN', syntheticSession('synthetic-a'));return { data: { session: syntheticSession('synthetic-a') } }; };
  await page.submit();assert.equal(page.get('account').hidden, false);assert.match(page.notice(), /로그인됐어요/);
});

test('leaving during logout prevents late notices and account reads', async t => {
  const page = await fixture(t), cleanup = deferred(), revoking = deferred();page.replies.cleanup = () => cleanup.promise;page.replies.revoke = () => revoking.promise;
  page.button('로그아웃').onclick();await settled();const notice = page.notice(), reads = page.calls.filter(call => call.method === 'getSession').length;
  page.events.get('pagehide')({});cleanup.resolve({});revoking.resolve({ refreshRevoked: true });await settled();
  assert.equal(page.notice(), notice);assert.equal(page.calls.filter(call => call.method === 'getSession').length, reads);
});

// 「로그인 방법 한 쌍」 ① (11-12): a sign-in in another tab reaches this tab as an event before this tab's stored session follows.
// Only this tab's own SDK session can open the account (every later request goes with it); the event's token is never used to ask.
const waits = async page => { for (const ms of [100, 200, 400, 800]) { page.time.advance(ms);await settled(); } };
for (const stored of [null, 'synthetic-a']) test(`a sign-in from another tab opens that account once the session stored here follows (${stored ? 'the old account' : 'nothing'} at first)`, async t => {
  const page = await fixture(t);let asked = 0;
  page.replies.getUser = () => ++asked > 2 ? { data: { user: { id: 'synthetic-b' } } }
    : stored ? { data: { user: { id: stored } } } : { data: { user: null }, error: { name: 'AuthSessionMissingError', message: 'Auth session missing!' } };
  const before = page.calls.length;await page.emit('SIGNED_IN', syntheticSession('synthetic-b'));
  assert.equal(page.get('account').hidden, true, 'not before this tab\'s own session is the event\'s account');
  await waits(page);
  assert.equal(page.get('account').hidden, false);assert.match(page.notice(), /로그인됐어요/);
  assert.deepEqual(page.calls.slice(before).filter(call => call.method === 'getUser').map(call => call.jwt), [undefined, undefined, undefined]);
  assert.ok(page.calls.slice(before).some(call => call.method === 'load' && call.token === 'synthetic-access-synthetic-b'));
});
test('a stored session that answers for the event is enough — asked once', async t => {
  const page = await fixture(t), before = page.calls.length;
  await page.emit('SIGNED_IN', syntheticSession('synthetic-b'));
  assert.equal(page.get('account').hidden, false);
  assert.deepEqual(page.calls.slice(before).filter(call => call.method === 'getUser').map(call => call.jwt), [undefined]);
});
// A browser whose tabs keep their own session (site data blocked — the SDK keeps it in this tab's memory): the event says another
// account, this tab's SDK still holds the first one. The screen must not open the event's account over the first one's session.
test('when this tab\'s own session never becomes the event\'s account, the tab closes as before and never asks with the event token', async t => {
  const page = await fixture(t);page.replies.getUser = () => ({ data: { user: { id: 'synthetic-a' } } });
  const before = page.calls.length;await page.emit('SIGNED_IN', syntheticSession('synthetic-b'));await waits(page);
  assert.equal(page.get('account').hidden, true);assert.match(page.notice(), /로그인 상태를 확인하지 못했어요/);
  assert.deepEqual(page.calls.slice(before).filter(call => call.method === 'getUser').map(call => call.jwt), [undefined, undefined, undefined, undefined, undefined]);
  assert.equal(page.calls.slice(before).some(call => call.method === 'load'), false, 'no account read for the event\'s account');
});
// r5 G1 (11-12): 「로그아웃시키기」 that fails for a reason that says nothing about it is told in its own words.
const twoPlaces = id => ({ ...syntheticAccount(id), sessions: [{ id: `synthetic-session-${id}`, current: true }, { id: 'synthetic-other', current: false, product: 'world', label: 'Phone' }] });
for (const [code, message, said] of [
  ['SERVICE_UNAVAILABLE', '계정 정보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.', '로그아웃시키지 못했어요. 다시 눌러 주세요.'],
  ['NETWORK', '연결을 확인하지 못했어요. 기록은 이 기기에 남겨 두고 다시 시도해요.', '로그아웃시키지 못했어요. 다시 눌러 주세요.'],
  ['SOMETHING_NEW', '계정 정보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.', '로그아웃시키지 못했어요. 다시 눌러 주세요.'],
  ['ACCOUNT_UNAVAILABLE', '계정 삭제를 요청한 상태라 저장할 수 없어요.', '지금 이 계정 상태에서는 할 수 없어요.'],
  ['AUTH_REQUIRED', '다시 로그인해 주세요.', '다시 로그인해 주세요.'],
]) test(`a failed 「로그아웃시키기」 (${code}) says ${said}`, async t => {
  const page = await fixture(t, { account: twoPlaces });page.replies.revoke = async () => { throw Object.assign(new Error(message), { code }); };
  page.button('로그아웃시키기').onclick();await settled();
  assert.equal(page.notice(), said);
});
// Carbon A1 (11-12): when the change went through and only reading the account again fails, its success line stays and no
// failure is drawn (load() takes a new epoch, so the change's own catch stands aside).
test('a change that went through keeps its success line when only the read after it fails', async t => {
  let reads = 0;
  const account = id => { if (++reads > 1) throw Object.assign(new Error('계정 정보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.'), { code: 'SERVICE_UNAVAILABLE' });return twoPlaces(id); };
  const page = await fixture(t, { account });
  page.button('로그아웃시키기').onclick();await settled();
  assert.equal(page.notice(), '그곳의 로그인을 끝냈어요.');assert.equal(page.get('notice')['data-kind'], 'success');
  assert.equal(reads, 2, 'the account was read again after the change');
});
