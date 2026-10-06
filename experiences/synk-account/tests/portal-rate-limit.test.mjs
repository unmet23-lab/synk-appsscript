import test from 'node:test';
import assert from 'node:assert/strict';
import { authRateLimit, mountPortal } from '../src/portal.mjs';

// Synthetic DOM and SDK only: no network, real credentials, storage or bundled output.
class Element {
  constructor(tag = 'div') { this.tagName = tag;this.children = [];this.beforeNodes = [];this.dataset = {};this.hidden = false;this.disabled = false;this.value = '';this.textContent = '';this.checked = false;this.focusCount = 0;this.scrollCount = 0;this.classList = { add() {}, remove() {} }; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(key, value) { this[key] = value; }
  closest() { return this; }
  before(node) { this.beforeNodes.push(node); }
  addEventListener() {}
  focus() { this.focusCount++; }
  scrollIntoView() { this.scrollCount++; }
  querySelector() { return null; }
  get textContent() { return this.text || ''; }
  set textContent(value) { this.text = value;this.textWrites = (this.textWrites || 0) + 1; }
}
function clock() {
  let now = 0, id = 0;const timers = new Map();
  return { now: () => now, setTimeout: (fn, ms) => { timers.set(++id, { at: now + ms, fn });return id; }, clearTimeout: id => timers.delete(id),
    pending: () => timers.size, advance(ms) { const end = now + ms;let next;
      while ((next = [...timers].sort((a, b) => a[1].at - b[1].at)[0]) && next[1].at <= end) { now = next[1].at;timers.delete(next[0]);next[1].fn(); }
      now = end;
    } };
}
const waitError = seconds => ({ code: 'over_email_send_rate_limit', status: 429, message: `For security purposes, you can only request this after ${seconds} seconds.` });
const settled = async () => { for (let n = 0; n < 4; n++) await new Promise(resolve => setImmediate(resolve)); };
function deferred() { let resolve;const promise = new Promise(done => { resolve = done; });return { promise, resolve }; }
async function fixture(t, { initial = null, reset = false, consent = false, redirectUri = 'https://app.example.test/', defaultClock = false } = {}) {
  const ids = new Map(), events = new Map(), calls = [], replies = {}, modes = ['login', 'signup', 'recover'].map(value => Object.assign(new Element('button'), { dataset: { view: value } })), time = clock();
  const get = id => { if (!ids.has(id)) ids.set(id, new Element());return ids.get(id); };
  const document = { body: new Element(), getElementById: get, createElement: tag => new Element(tag), querySelectorAll: () => modes };
  for (const id of ['auth-panel', 'consent', 'account', 'setup', 'signup-choices']) get(id).hidden = true;
  get('email').value = 'synthetic@example.test';get('password').value = 'synthetic-password';
  get('signup-age').checked = true;get('signup-learning').checked = true;
  let saved = initial, listener;const destinations = [];
  const original = ['document', 'window', 'location', ...(defaultClock ? ['setTimeout', 'clearTimeout'] : [])].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]), originalNow = Date.now;
  const receivers = [];
  if (defaultClock) {
    Date.now = time.now;
    for (const method of ['setTimeout', 'clearTimeout']) globalThis[method] = function (...args) {
      receivers.push(this);if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
      return time[method](...args);
    };
  }
  Object.assign(globalThis, { document, window: { addEventListener: (type, fn) => events.set(type, fn) }, location: {
    href: `https://id.example.test/?${reset ? 'view=reset' : consent ? 'authorization_id=synthetic-authorization' : ''}`,
    assign: value => destinations.push(value), reload() {},
  } });
  t.after(() => { events.get('pagehide')?.({});for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor);else delete globalThis[key]; }if (defaultClock) Date.now = originalNow; });
  const invoke = async (method, args) => { calls.push({ method, args });return typeof replies[method] === 'function' ? replies[method](args) : replies[method] || { data: { session: null }, error: null }; };
  const sdk = { auth: {
    getSession: async () => ({ data: { session: saved } }), getUser: async () => ({ data: { user: saved?.user } }),
    onAuthStateChange: fn => { listener = fn;return {}; },
    signUp: args => invoke('signUp', args), signInWithPassword: args => invoke('signInWithPassword', args),
    resetPasswordForEmail: (...args) => invoke('resetPasswordForEmail', args), updateUser: args => invoke('updateUser', args),
    oauth: { getAuthorizationDetails: async () => ({ data: { client: { id: 'synthetic-client', name: '합성 앱' }, redirect_uri: redirectUri, scope: 'openid email profile' } }),
      approveAuthorization: (...args) => invoke('approveAuthorization', args), denyAuthorization: (...args) => invoke('denyAuthorization', args) },
  } };
  await mountPortal({ config: { configured: true, learningUrl: '/', portalUrl: 'https://id.example.test/',
    clients: { platform: { clientId: 'synthetic-client', redirectUri } }, authorizationClients: [] }, sdk, ...(defaultClock ? {} : { cooldownClock: time }) });
  return { get, calls, replies, time, receivers, events, destinations, notice: get('notice'), feedback: get('auth-submit').beforeNodes[0], consentFeedback: get('approve').beforeNodes[0],
    mode: name => modes.find(button => button.dataset.view === name).onclick(), submit: () => get('auth-form').onsubmit({ preventDefault() {} }),
    emit: async (event, value) => { saved = value;listener(event, value);await settled(); } };
}

test('rate limits use SDK codes/status or the observed message and never invent a wait', () => {
  assert.deepEqual(authRateLimit(waitError(41)), { waitSeconds: 41 });
  assert.deepEqual(authRateLimit({ message: waitError(41).message }), { waitSeconds: 41 });
  assert.deepEqual(authRateLimit({ status: 429, message: 'Too many requests' }), { waitSeconds: null });
  assert.deepEqual(authRateLimit({ code: 'over_request_rate_limit', retryAfter: '3' }), { waitSeconds: 3 });
  assert.deepEqual(authRateLimit({ code: 'over_email_send_rate_limit', message: 'Email rate limit exceeded' }), { waitSeconds: null });
  for (const retryAfter of [-1, 0, 1.5, 999999, '3 seconds', NaN]) assert.deepEqual(authRateLimit({ status: 429, retryAfter }), { waitSeconds: null });
  assert.equal(authRateLimit({ message: 'Request failed after 41 seconds.' }), null);
  assert.equal(authRateLimit({ code: 'invalid_credentials', message: 'Invalid login credentials' }), null);
});

test('signup visibly counts down, blocks duplicate requests, retains choices and requires a manual retry', async t => {
  const page = await fixture(t);page.mode('signup');page.replies.signUp = { error: waitError(41) };
  await page.submit();assert.equal(page.get('auth-submit').disabled, true);assert.match(page.get('auth-submit').textContent, /41초/);
  assert.match(page.feedback.textContent, /가입 메일 요청이 잠시 제한/);assert.equal(page.feedback.hidden, false);assert.doesNotMatch(page.notice.textContent, /For security/);
  await page.submit();assert.equal(page.calls.length, 1);
  page.time.advance(40000);assert.match(page.get('auth-submit').textContent, /1초/);assert.equal(page.get('auth-submit').disabled, true);
  page.time.advance(1000);assert.equal(page.get('auth-submit').disabled, false);assert.equal(page.get('auth-submit').textContent, '이메일로 가입');
  assert.equal(page.calls.length, 1);assert.equal(page.time.pending(), 0);assert.match(page.feedback.textContent, /자동으로 다시 보내지 않아요/);
  assert.equal(page.get('signup-age').checked, true);assert.equal(page.get('signup-learning').checked, true);assert.equal(page.get('password').value, 'synthetic-password');
  page.replies.signUp = { data: { session: null } };await page.submit();
  assert.equal(page.calls.length, 2);assert.deepEqual(page.calls[1].args.options.data.synk_signup, { version: 'synk-signup-1', learning: true, age14: true });
  assert.match(page.notice.textContent, /^가입 확인 메일을 요청했어요/);assert.doesNotMatch(page.notice.textContent, /보냈어요|synthetic@example/);
  assert.equal(page.notice.focusCount, 1);assert.equal(page.notice.scrollCount, 1);assert.equal(page.notice.tabindex, '-1');assert.equal(page.feedback.hidden, true);
});

test('mode-specific cooldowns do not block other actions or multiply timers', async t => {
  const page = await fixture(t);page.mode('signup');page.replies.signUp = { error: waitError(41) };await page.submit();
  page.mode('login');assert.equal(page.get('auth-submit').disabled, false);assert.equal(page.feedback.hidden, true);assert.doesNotMatch(page.notice.textContent, /가입 메일/);
  page.replies.signInWithPassword = { error: { status: 429, message: 'Too many requests' } };await page.submit();
  assert.equal(page.get('auth-submit').disabled, false);assert.match(page.feedback.textContent, /서버가 대기 시간을 알려 주지 않았어요/);
  for (let n = 0; n < 8; n++) { page.mode('signup');page.mode('recover'); }
  assert.equal(page.time.pending(), 1);page.time.advance(10000);page.mode('signup');assert.match(page.get('auth-submit').textContent, /31초/);
  assert.equal(page.time.pending(), 1);assert.equal(page.get('signup-learning').checked, true);
});

for (const [mode, method, label] of [['login', 'signInWithPassword', '로그인'], ['recover', 'resetPasswordForEmail', '비밀번호 재설정 메일'], ['reset', 'updateUser', '비밀번호 변경']]) {
  test(`${mode} shows the correct localized action and returns to a manual request after the wait`, async t => {
    const page = await fixture(t, { reset: mode === 'reset' });if (mode !== 'reset') page.mode(mode);
    page.replies[method] = { error: waitError(2) };await page.submit();
    assert.equal(page.calls[0].method, method);assert.match(page.feedback.textContent, new RegExp(label));assert.equal(page.get('auth-submit').disabled, true);
    page.time.advance(2000);assert.equal(page.get('auth-submit').disabled, false);assert.equal(page.calls.length, 1);
  });
}

test('signup age validation still prevents sending and preserves optional learning choice', async t => {
  const page = await fixture(t);page.mode('signup');page.get('signup-age').checked = false;page.get('signup-learning').checked = false;
  await page.submit();assert.equal(page.calls.length, 0);assert.match(page.notice.textContent, /만 14세/);assert.equal(page.get('signup-learning').checked, false);
  assert.equal(page.get('auth-submit').disabled, false);assert.equal(page.time.pending(), 0);
});

test('an in-flight request cannot be sent twice or reassigned to another form mode', async t => {
  const page = await fixture(t), pending = deferred();page.mode('signup');page.replies.signUp = () => pending.promise;
  const first = page.submit();await page.submit();page.mode('recover');
  assert.equal(page.get('auth-heading').textContent, '나만의 SYNK를 시작해요.');assert.equal(page.calls.length, 1);assert.equal(page.get('auth-submit').disabled, true);
  pending.resolve({ data: { session: null } });await first;assert.match(page.notice.textContent, /^가입 확인 메일/);assert.equal(page.get('auth-submit').disabled, false);
});

test('successful recovery reveals the mailbox instruction without claiming whether an email account exists', async t => {
  const page = await fixture(t);page.mode('recover');await page.submit();
  assert.match(page.notice.textContent, /^비밀번호 재설정 메일을 요청했어요/);assert.match(page.notice.textContent, /메일함.*스팸함/);
  assert.equal(page.notice.focusCount, 1);assert.equal(page.notice.scrollCount, 1);assert.doesNotMatch(page.notice.textContent, /synthetic@example/);
});

test('consent retries share a cooldown, preserve the authorization and never automatically approve or deny', async t => {
  const page = await fixture(t, { consent: true, initial: { user: { id: 'synthetic-owner' } } });
  page.replies.approveAuthorization = { error: waitError(2) };await page.get('approve').onclick();
  assert.equal(page.get('approve').disabled, true);assert.equal(page.get('deny').disabled, true);assert.match(page.consentFeedback.textContent, /계정 연결/);assert.match(page.get('approve').textContent, /2초/);
  await page.get('approve').onclick();await page.get('deny').onclick();assert.equal(page.calls.length, 1);
  page.time.advance(2000);assert.equal(page.calls.length, 1);assert.equal(page.get('deny').disabled, false);
  page.replies.denyAuthorization = { data: { redirect_url: 'https://app.example.test/?error=access_denied&state=synthetic-state' } };
  await page.get('deny').onclick();assert.equal(page.calls[1].method, 'denyAuthorization');assert.equal(page.calls[1].args[0], 'synthetic-authorization');
  assert.equal(page.destinations.length, 1);assert.match(page.destinations[0], /error=access_denied/);
  assert.equal(page.get('approve').disabled, true);assert.equal(page.get('deny').disabled, true);
  await page.get('approve').onclick();await page.get('deny').onclick();assert.equal(page.calls.length, 2);
});

for (const action of ['approve', 'deny']) test(`successful ${action} to a native callback keeps both controls locked`, async t => {
  const page = await fixture(t, { consent: true, initial: { user: { id: 'synthetic-owner' } }, redirectUri: 'synktalk://oauth/callback' });
  const method = action === 'approve' ? 'approveAuthorization' : 'denyAuthorization';
  page.replies[method] = { data: { redirect_url: `synktalk://oauth/callback?${action === 'approve' ? 'code=synthetic-code' : 'error=access_denied'}&state=synthetic-state` } };
  await page.get(action).onclick();assert.equal(page.destinations.length, 1);
  assert.equal(page.get('approve').disabled, true);assert.equal(page.get('deny').disabled, true);
  await page.get('approve').onclick();await page.get('deny').onclick();assert.equal(page.calls.length, 1);
});

test('invalid consent destinations and failed navigation unlock only the failed operation', async t => {
  const page = await fixture(t, { consent: true, initial: { user: { id: 'synthetic-owner' } } });
  page.replies.approveAuthorization = { data: { redirect_url: 'https://unregistered.example.test/' } };
  await page.get('approve').onclick();assert.equal(page.destinations.length, 0);assert.equal(page.get('approve').disabled, false);assert.equal(page.get('deny').disabled, false);
  page.replies.approveAuthorization = { data: { redirect_url: 'https://app.example.test/?code=synthetic-code&state=synthetic-state' } };
  location.assign = () => { throw new Error('synthetic navigation failure'); };await page.get('approve').onclick();
  assert.match(page.notice.textContent, /synthetic navigation failure/);assert.equal(page.get('approve').disabled, false);assert.equal(page.get('deny').disabled, false);
});

test('an old consent response cannot redirect or unlock a newer account operation', async t => {
  const page = await fixture(t, { consent: true, initial: { user: { id: 'synthetic-owner' } } }), old = deferred(), next = deferred();
  page.replies.approveAuthorization = () => old.promise;const oldWork = page.get('approve').onclick();
  await page.emit('SIGNED_IN', { user: { id: 'synthetic-other' } });assert.equal(page.get('approve').disabled, false);
  page.replies.denyAuthorization = () => next.promise;const nextWork = page.get('deny').onclick();
  old.resolve({ data: { redirect_url: 'https://app.example.test/?code=synthetic-code&state=synthetic-state' } });await oldWork;
  assert.equal(page.destinations.length, 0);assert.equal(page.get('approve').disabled, true);assert.equal(page.get('deny').disabled, true);
  next.resolve({ data: { redirect_url: 'https://app.example.test/?error=access_denied&state=synthetic-state' } });await nextWork;
  assert.equal(page.destinations.length, 1);assert.equal(page.get('approve').disabled, true);assert.equal(page.get('deny').disabled, true);
});

test('leaving during consent blocks late navigation and further SDK calls', async t => {
  const page = await fixture(t, { consent: true, initial: { user: { id: 'synthetic-owner' } } }), pending = deferred();
  page.replies.approveAuthorization = () => pending.promise;const work = page.get('approve').onclick();page.events.get('pagehide')({});
  pending.resolve({ data: { redirect_url: 'https://app.example.test/?code=synthetic-code&state=synthetic-state' } });await work;
  await page.get('deny').onclick();assert.equal(page.destinations.length, 0);assert.equal(page.calls.length, 1);
});

test('countdown status changes only on start and expiry while only the button ticks', async t => {
  const page = await fixture(t);page.mode('signup');page.replies.signUp = { error: waitError(8) };await page.submit();
  const initial = { notice: page.notice.textWrites, feedback: page.feedback.textWrites, text: page.notice.textContent };
  assert.equal(page.feedback.role, undefined);assert.equal(page.feedback['aria-live'], undefined);
  page.time.advance(7000);assert.match(page.get('auth-submit').textContent, /1초/);
  assert.equal(page.notice.textWrites, initial.notice);assert.equal(page.feedback.textWrites, initial.feedback);assert.equal(page.notice.textContent, initial.text);
  page.time.advance(1000);assert.equal(page.notice.textWrites, initial.notice + 1);assert.equal(page.feedback.textWrites, initial.feedback + 1);
  assert.match(page.notice.textContent, /대기 시간이 지났어요/);assert.equal(page.get('auth-submit').disabled, false);
  page.time.advance(10000);assert.equal(page.notice.textWrites, initial.notice + 1);assert.equal(page.calls.length, 1);
});

test('switching away and back presents the correct countdown phase once without repeated live text writes', async t => {
  const page = await fixture(t);page.mode('signup');page.replies.signUp = { error: waitError(4) };await page.submit();
  page.mode('login');const unrelated = page.notice.textContent, writes = page.notice.textWrites;page.time.advance(2000);
  assert.equal(page.notice.textContent, unrelated);assert.equal(page.notice.textWrites, writes);
  page.mode('signup');assert.equal(page.notice.textWrites, writes + 1);assert.match(page.notice.textContent, /가입 메일 요청이 잠시 제한/);
  assert.match(page.get('auth-submit').textContent, /2초/);page.time.advance(1000);assert.equal(page.notice.textWrites, writes + 1);
  page.mode('login');page.time.advance(1000);page.mode('signup');assert.match(page.notice.textContent, /대기 시간이 지났어요/);
  assert.equal(page.get('auth-submit').disabled, false);
});

test('the default clock does not pass its own object as a native timer receiver', async t => {
  const page = await fixture(t, { defaultClock: true });page.mode('signup');page.replies.signUp = { error: waitError(2) };
  await page.submit();assert.equal(page.time.pending(), 1);assert.equal(page.get('auth-submit').disabled, true);
  page.time.advance(1000);assert.match(page.get('auth-submit').textContent, /1초/);page.time.advance(1000);
  assert.equal(page.get('auth-submit').disabled, false);assert.equal(page.time.pending(), 0);assert.equal(page.calls.length, 1);
  assert.ok(page.receivers.length > 0);assert.ok(page.receivers.every(value => value === undefined || value === globalThis));
});

test('a stale auth error cannot overwrite a different account arriving during the request', async t => {
  const page = await fixture(t, { consent: true }), pending = deferred();page.replies.signInWithPassword = () => pending.promise;
  const work = page.submit();await page.emit('SIGNED_IN', { user: { id: 'synthetic-other' } });pending.resolve({ error: waitError(41) });await work;
  assert.equal(page.get('consent').hidden, false);assert.equal(page.get('auth-panel').hidden, true);assert.doesNotMatch(page.notice.textContent, /제한|41초/);
  assert.equal(page.time.pending(), 0);assert.equal(page.feedback.hidden, true);
});

test('the SDK event from the successful sign-in still enters the intended consent screen', async t => {
  const page = await fixture(t, { consent: true }), session = { user: { id: 'synthetic-owner' } };
  page.replies.signInWithPassword = async () => { await page.emit('SIGNED_IN', session);return { data: { session } }; };
  await page.submit();assert.equal(page.get('consent').hidden, false);assert.equal(page.get('auth-panel').hidden, true);assert.equal(page.time.pending(), 0);
});

test('leaving the page cancels timers and fences a late request error and account event', async t => {
  const page = await fixture(t), pending = deferred();page.mode('signup');page.replies.signUp = () => pending.promise;
  const work = page.submit(), before = page.notice.textContent;page.events.get('pagehide')({});pending.resolve({ error: waitError(41) });await work;
  await page.emit('SIGNED_IN', { user: { id: 'synthetic-other' } });assert.equal(page.notice.textContent, before);assert.equal(page.time.pending(), 0);
  assert.equal(page.get('signup-learning').checked, true);assert.equal(page.get('signup-age').checked, true);
});

test('leaving during a countdown clears its only scheduled callback', async t => {
  const page = await fixture(t);page.mode('signup');page.replies.signUp = { error: waitError(41) };await page.submit();
  assert.equal(page.time.pending(), 1);page.events.get('pagehide')({});assert.equal(page.time.pending(), 0);page.time.advance(50000);assert.equal(page.calls.length, 1);
});
