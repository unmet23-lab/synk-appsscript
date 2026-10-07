import test from 'node:test';
import assert from 'node:assert/strict';
import { authErrorMessage, authRateLimit, cleanAuthCallbackUrl, mountPortal } from '../src/portal.mjs';

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
async function fixture(t, { initial = null, reset = false, consent = false, redirectUri = 'https://app.example.test/', consentDetails = null, defaultClock = false, callbackQuery = '', initializeError = null, sessionError = null, accountResponse = null, onInitialize = null, duringGetSession = null, beforeMountComplete = null } = {}) {
  const ids = new Map(), events = new Map(), calls = [], replies = {}, modes = ['login', 'signup', 'recover'].map(value => Object.assign(new Element('button'), { dataset: { view: value } })), time = clock();
  const get = id => { if (!ids.has(id)) ids.set(id, new Element());return ids.get(id); };
  const document = { body: new Element(), getElementById: get, createElement: tag => new Element(tag), querySelectorAll: () => modes };
  for (const id of ['auth-panel', 'consent', 'account', 'setup', 'signup-choices']) get(id).hidden = true;
  get('email').value = 'synthetic@example.test';get('password').value = 'synthetic-password';
  get('signup-age').checked = true;get('signup-learning').checked = true;
  let saved = initial, listener;const destinations = [], historyUrls = [], metrics = { consentLoads: 0, accountLoads: 0, userChecks: 0, checkedUsers: [] };
  const original = ['document', 'window', 'location', ...(defaultClock ? ['setTimeout', 'clearTimeout'] : [])].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]), originalNow = Date.now;
  const receivers = [];
  if (defaultClock) {
    Date.now = time.now;
    for (const method of ['setTimeout', 'clearTimeout']) globalThis[method] = function (...args) {
      receivers.push(this);if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
      return time[method](...args);
    };
  }
  Object.assign(globalThis, { document, window: { addEventListener: (type, fn) => events.set(type, fn), history: { state: null, replaceState(_state, _title, url) { historyUrls.push(url);location.href = url; } } }, location: {
    href: `https://id.example.test/?${reset ? 'view=reset' : consent ? 'authorization_id=synthetic-authorization' : ''}${callbackQuery}`,
    assign: value => destinations.push(value), reload() {},
  } });
  t.after(() => { events.get('pagehide')?.({});for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor);else delete globalThis[key]; }if (defaultClock) Date.now = originalNow; });
  const invoke = async (method, args) => { calls.push({ method, args });return typeof replies[method] === 'function' ? replies[method](args) : replies[method] || { data: { session: null }, error: null }; };
  const sdk = { auth: {
    initialize: async () => { await onInitialize?.({ emit: (event, value) => { saved = value;listener(event, value); }, setUrl: url => { location.href = url; } });return { error: initializeError }; },
    getSession: async () => { const snapshot = saved;await duringGetSession?.({ emit: (event, value) => { saved = value;listener(event, value); } });return { data: { session: snapshot }, error: sessionError }; },
    getUser: async () => { metrics.userChecks++;metrics.checkedUsers.push(saved?.user?.id || null);return { data: { user: saved?.user } }; },
    onAuthStateChange: fn => { listener = fn;return {}; },
    signUp: args => invoke('signUp', args), signInWithPassword: args => invoke('signInWithPassword', args),
    resetPasswordForEmail: (...args) => invoke('resetPasswordForEmail', args), updateUser: args => invoke('updateUser', args),
    oauth: { getAuthorizationDetails: async () => { metrics.consentLoads++;return { data: consentDetails || { client: { id: 'synthetic-client', name: '합성 앱' }, redirect_uri: redirectUri, scope: 'openid email profile' } }; },
      approveAuthorization: (...args) => invoke('approveAuthorization', args), denyAuthorization: (...args) => invoke('denyAuthorization', args) },
  } };
  const mounting = mountPortal({ config: { configured: true, learningUrl: '/', portalUrl: 'https://id.example.test/',
    clients: { platform: { clientId: 'synthetic-client', redirectUri } }, authorizationClients: [] }, sdk, ...(defaultClock ? {} : { cooldownClock: time }), ...(accountResponse ? { accountFactory: () => ({ load: async () => { metrics.accountLoads++;return accountResponse; } }) } : {}) });
  await beforeMountComplete?.({ time, get, metrics, historyUrls, mounting });await mounting;
  return { get, calls, replies, time, receivers, events, destinations, historyUrls, metrics, notice: get('notice'), feedback: get('auth-submit').beforeNodes[0], consentFeedback: get('approve').beforeNodes[0],
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
  assert.equal(page.notice.focusCount, 2);assert.equal(page.notice.scrollCount, 2);assert.equal(page.notice.tabindex, '-1');assert.equal(page.feedback.hidden, false);assert.equal(page.feedback['data-kind'], 'success');
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
    const page = await fixture(t, { reset: mode === 'reset', ...(mode === 'reset' ? { initial: syntheticSession('reset-owner') } : {}) });if (mode !== 'reset') page.mode(mode);
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
  assert.equal(page.notice['data-kind'], 'pending');assert.equal(page.feedback['data-kind'], 'pending');assert.equal(page.feedback.hidden, false);
  assert.match(page.feedback.textContent, /요청을 보내고 있어요/);
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
  assert.match(page.notice.textContent, /요청을 마치지 못했어요/);assert.equal(page.get('approve').disabled, false);assert.equal(page.get('deny').disabled, false);
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

const syntheticSession = id => ({ user: { id }, access_token: `synthetic-access-${id}` });
const syntheticAccount = id => ({ ok: true, account: { synk_user_id: id, status: 'active', profile: { display_name: '합성 사용자' } },
  learning: { enabled: false, revision: 1 }, capabilities: { learningSync: false }, sessions: [] });

test('auth errors explain credentials, confirmation, expired links and connection failures in Korean', () => {
  for (const [error, expected] of [
    [{ code: 'invalid_credentials' }, /이메일 또는 비밀번호가 맞지 않아요/],
    [{ message: 'Invalid login credentials' }, /입력 내용을 확인/],
    [{ code: 'email_not_confirmed' }, /이메일 확인이 아직 끝나지/],
    [{ message: 'Email not confirmed' }, /받은 메일의 확인 버튼/],
    [{ code: 'weak_password' }, /비밀번호.*8자/],
    [{ code: 'same_password' }, /다른 새 비밀번호/],
    [{ code: 'otp_expired' }, /확인 링크가 만료/],
    [{ code: 'bad_code_verifier' }, /가입을 시작한 브라우저/],
    [{ code: 'flow_state_not_found' }, /이메일 확인을 이미 마쳤다면/],
    [{ message: 'Failed to fetch' }, /인터넷 연결/],
    [{ status: 503 }, /계정 서버가 잠시 응답하지/],
  ]) assert.match(authErrorMessage(error), expected);
  assert.equal(authErrorMessage(new Error('만 14세 이상인지 확인해 주세요.')), '만 14세 이상인지 확인해 주세요.');
  assert.equal(authErrorMessage({ message: 'Internal auth failure synthetic-private-detail' }), '요청을 마치지 못했어요. 입력 내용을 확인하고 다시 시도해 주세요.');
});

test('callback URL cleanup removes authentication material while preserving the current origin and UI parameters', () => {
  const clean = new URL(cleanAuthCallbackUrl('https://id.example.test/subpath/?authorization_id=synthetic-authorization&view=reset&keep=one&keep=two&code=synthetic-code&code=duplicate-code&sb_flow_id=synthetic-flow&error=access_denied&error_code=otp_expired&error_description=synthetic-detail#settings'));
  assert.equal(clean.origin, 'https://id.example.test');assert.equal(clean.pathname, '/subpath/');
  assert.equal(clean.searchParams.get('authorization_id'), 'synthetic-authorization');assert.equal(clean.searchParams.get('view'), 'reset');
  assert.deepEqual(clean.searchParams.getAll('keep'), ['one', 'two']);assert.equal(clean.hash, '#settings');
  for (const key of ['code', 'sb_flow_id', 'error', 'error_code', 'error_description']) assert.equal(clean.searchParams.has(key), false);
  for (const fragment of ['error=access_denied&error_description=synthetic-detail', 'access_token=synthetic-access&refresh_token=synthetic-refresh&type=recovery']) {
    const result = new URL(cleanAuthCallbackUrl(`https://id.example.test/?authorization_id=synthetic-authorization&view=reset#${fragment}`));
    assert.equal(result.hash, '');assert.equal(result.searchParams.get('authorization_id'), 'synthetic-authorization');assert.equal(result.searchParams.get('view'), 'reset');
  }
});

for (const callbackQuery of ['&error=access_denied&error_code=otp_expired&error_description=synthetic-detail&keep=one', '&keep=one#error=access_denied&error_description=synthetic-detail']) {
  test(`an error callback (${callbackQuery.includes('#') ? 'fragment' : 'query'}) is explained and cleaned without opening consent`, async t => {
    const page = await fixture(t, { consent: true, callbackQuery });
    assert.match(page.notice.textContent, /확인 링크가 만료|이 브라우저에서 처리할 수 없어요/);assert.equal(page.notice['data-kind'], 'error');
    assert.equal(page.feedback.hidden, false);assert.equal(page.feedback.textContent, page.notice.textContent);
    assert.equal(page.get('auth-panel').hidden, false);assert.equal(page.get('consent').hidden, true);assert.equal(page.get('account-next').hidden, true);
    assert.equal(page.metrics.consentLoads, 0);assert.equal(page.destinations.length, 0);assert.equal(page.calls.length, 0);
    assert.equal(page.historyUrls.length, 1);const clean = new URL(page.historyUrls[0]);
    assert.equal(clean.searchParams.get('authorization_id'), 'synthetic-authorization');assert.equal(clean.searchParams.get('keep'), 'one');
    assert.equal(clean.searchParams.has('error'), false);assert.equal(clean.hash, '');assert.doesNotMatch(page.notice.textContent, /synthetic-detail/);
  });
}

test('an unconsumed code keeps the existing account but blocks automatic consent and the next-service CTA', async t => {
  const current = syntheticSession('existing-owner');
  const page = await fixture(t, { consent: true, initial: current, accountResponse: syntheticAccount('existing-owner'), callbackQuery: '&code=synthetic-code&sb_flow_id=synthetic-flow&keep=one' });
  assert.match(page.notice.textContent, /확인 링크가 만료/);assert.match(page.notice.textContent, /현재 로그인된 계정을 확인/);
  assert.equal(page.get('account').hidden, false);assert.equal(page.get('account-next').hidden, true);assert.equal(page.get('consent').hidden, true);
  assert.equal(page.metrics.accountLoads, 1);assert.equal(page.metrics.consentLoads, 0);assert.equal(page.destinations.length, 0);
  const clean = new URL(page.historyUrls[0]);assert.equal(clean.searchParams.has('code'), false);assert.equal(clean.searchParams.has('sb_flow_id'), false);
  assert.equal(clean.searchParams.get('authorization_id'), 'synthetic-authorization');assert.equal(clean.searchParams.get('keep'), 'one');
  const head = page.get('account').children[0], warning = page.notice.textContent;
  await page.emit('SIGNED_IN', current);await page.emit('TOKEN_REFRESHED', { ...current, access_token: 'synthetic-new-access' });
  assert.equal(page.get('account').children[0], head);assert.equal(page.notice.textContent, warning);assert.equal(page.metrics.consentLoads, 0);assert.equal(page.metrics.accountLoads, 1);
});

test('an initialization error remains visible even when the SDK has already removed the callback code', async t => {
  const page = await fixture(t, { consent: true, initial: syntheticSession('existing-owner'), accountResponse: syntheticAccount('existing-owner'),
    callbackQuery: '&code=synthetic-code&keep=one', initializeError: { code: 'flow_state_not_found' },
    onInitialize: ({ setUrl }) => setUrl('https://id.example.test/?authorization_id=synthetic-authorization&keep=one') });
  assert.match(page.notice.textContent, /확인 링크가 만료/);assert.equal(page.get('consent').hidden, true);assert.equal(page.get('account-next').hidden, true);
  assert.equal(page.metrics.consentLoads, 0);assert.equal(page.metrics.accountLoads, 1);assert.equal(page.get('account').hidden, false);
  assert.equal(new URL(location.href).searchParams.get('keep'), 'one');assert.equal(page.destinations.length, 0);
});

test('getSession failure is visible on the login form and never looks like successful sign-in', async t => {
  const page = await fixture(t, { sessionError: { status: 503, message: 'Service unavailable' } });
  assert.match(page.notice.textContent, /계정 서버가 잠시 응답하지/);assert.equal(page.notice['data-kind'], 'error');
  assert.equal(page.feedback.hidden, false);assert.equal(page.feedback['data-kind'], 'error');assert.equal(page.get('auth-panel').hidden, false);
  assert.equal(page.get('account').hidden, true);assert.equal(page.get('account-next').hidden, true);assert.equal(page.metrics.userChecks, 0);
  assert.equal(page.get('auth-submit').disabled, false);assert.equal(page.notice.focusCount, 1);
});

test('same-user SIGNED_IN and TOKEN_REFRESHED preserve the account screen and its notice', async t => {
  const current = syntheticSession('same-owner'), page = await fixture(t, { initial: current, accountResponse: syntheticAccount('same-owner') });
  assert.equal(page.get('account').hidden, false);assert.equal(page.get('account-next').hidden, false);
  const head = page.get('account').children[0], message = page.notice.textContent, writes = page.notice.textWrites;
  await page.emit('SIGNED_IN', current);await page.emit('TOKEN_REFRESHED', { ...current, access_token: 'synthetic-refresh' });await page.emit('SIGNED_IN', current);
  assert.equal(page.metrics.accountLoads, 1);assert.equal(page.metrics.userChecks, 1);assert.equal(page.get('account').children[0], head);
  assert.equal(page.notice.textContent, message);assert.equal(page.notice.textWrites, writes);assert.equal(page.get('account-next').hidden, false);
});

test('same-user events preserve consent without fetching its details again', async t => {
  const current = syntheticSession('same-owner'), page = await fixture(t, { initial: current, consent: true });
  assert.equal(page.get('consent-name').textContent, 'SYNK 플랫폼');
  const scopes = page.get('scopes').children, message = page.notice.textContent;
  await page.emit('SIGNED_IN', current);await page.emit('TOKEN_REFRESHED', { ...current, access_token: 'synthetic-refresh' });
  assert.equal(page.metrics.consentLoads, 1);assert.equal(page.metrics.userChecks, 1);assert.equal(page.get('scopes').children, scopes);
  assert.equal(page.notice.textContent, message);assert.equal(page.get('consent').hidden, false);assert.equal(page.get('account-next').hidden, true);
});

test('a sign-in event while getSession waits takes priority over its stale signed-out snapshot', async t => {
  const page = await fixture(t, { consent: true, duringGetSession: ({ emit }) => emit('SIGNED_IN', syntheticSession('new-owner')) });
  assert.equal(page.get('consent').hidden, false);assert.equal(page.get('auth-panel').hidden, true);
  assert.equal(page.metrics.consentLoads, 1);assert.equal(page.metrics.userChecks, 1);assert.doesNotMatch(page.notice.textContent, /로그인하거나/);
});

test('a sign-out event while getSession waits prevents the stale account snapshot from reopening', async t => {
  const page = await fixture(t, { consent: true, initial: syntheticSession('old-owner'), duringGetSession: ({ emit }) => emit('SIGNED_OUT', null) });
  assert.equal(page.get('auth-panel').hidden, false);assert.equal(page.get('account').hidden, true);assert.equal(page.get('consent').hidden, true);
  assert.equal(page.get('account-next').hidden, true);assert.equal(page.metrics.userChecks, 0);assert.equal(page.metrics.consentLoads, 0);
});

test('a successfully consumed callback enters the original consent request exactly once', async t => {
  const page = await fixture(t, { consent: true, callbackQuery: '&code=synthetic-code&keep=one',
    onInitialize: ({ emit, setUrl }) => {
      assert.equal(new URL(location.href).searchParams.get('code'), 'synthetic-code', 'the SDK must see the callback before URL cleanup');
      setUrl('https://id.example.test/?authorization_id=synthetic-authorization&keep=one');emit('SIGNED_IN', syntheticSession('confirmed-owner'));
    } });
  assert.equal(page.get('consent').hidden, false);assert.equal(page.get('auth-panel').hidden, true);assert.equal(page.get('account-next').hidden, true);
  assert.equal(page.metrics.consentLoads, 1);assert.equal(page.metrics.userChecks, 1);assert.equal(page.notice['data-kind'], 'info');
  assert.doesNotMatch(page.notice.textContent, /만료|처리할 수 없어요/);assert.equal(new URL(location.href).searchParams.get('keep'), 'one');
  assert.equal(page.calls.length, 0);assert.equal(page.destinations.length, 0);
});

test('a successfully consumed direct ID callback shows the verified account and service CTA', async t => {
  const page = await fixture(t, { callbackQuery: 'code=synthetic-code&keep=one', accountResponse: syntheticAccount('confirmed-owner'),
    onInitialize: ({ emit, setUrl }) => { setUrl('https://id.example.test/?keep=one');emit('SIGNED_IN', syntheticSession('confirmed-owner')); } });
  assert.equal(page.get('account').hidden, false);assert.equal(page.get('account-next').hidden, false);assert.equal(page.get('auth-panel').hidden, true);
  assert.equal(page.notice['data-kind'], 'success');assert.match(page.notice.textContent, /로그인됐어요/);assert.equal(page.metrics.accountLoads, 1);
  assert.equal(page.metrics.consentLoads, 0);assert.equal(page.destinations.length, 0);
});

test('PASSWORD_RECOVERY from callback opens password reset before any account or consent screen', async t => {
  const page = await fixture(t, { reset: true, callbackQuery: '&code=synthetic-code', accountResponse: syntheticAccount('recovery-owner'),
    onInitialize: ({ emit, setUrl }) => { setUrl('https://id.example.test/?view=reset&keep=one');emit('PASSWORD_RECOVERY', syntheticSession('recovery-owner')); } });
  assert.equal(page.get('auth-panel').hidden, false);assert.equal(page.get('auth-submit').textContent, '새 비밀번호 저장');
  assert.equal(page.get('email').required, false);assert.equal(page.get('password').required, true);assert.equal(page.metrics.accountLoads, 0);assert.equal(page.metrics.consentLoads, 0);
  assert.match(page.notice.textContent, /새 비밀번호를 저장/);assert.equal(page.get('account-next').hidden, true);
  page.get('password').value = 'synthetic-new-password';page.replies.updateUser = { data: { user: { id: 'recovery-owner' } } };await page.submit();
  assert.equal(page.calls[0].method, 'updateUser');assert.equal(page.get('password').value, '');assert.equal(page.metrics.accountLoads, 1);
  assert.equal(page.get('account').hidden, false);assert.equal(page.get('account-next').hidden, false);
  assert.equal(new URL(location.href).searchParams.has('view'), false);assert.equal(new URL(location.href).searchParams.get('keep'), 'one');
  assert.match(page.notice.textContent, /새 비밀번호를 저장했어요/);assert.equal(page.notice['data-kind'], 'success');
});

test('view=reset without a session offers a recovery link request instead of a password update', async t => {
  const page = await fixture(t, { reset: true, callbackQuery: '&authorization_id=synthetic-authorization&keep=one' });
  assert.equal(page.get('auth-panel').hidden, false);assert.equal(page.get('auth-submit').textContent, '재설정 메일 보내기');
  assert.equal(page.get('password-label').hidden, true);assert.equal(page.get('password').required, false);assert.equal(page.get('email').required, true);
  assert.match(page.notice.textContent, /비밀번호 재설정 링크를 먼저 열어 주세요/);assert.equal(page.feedback.hidden, false);assert.equal(page.notice['data-kind'], 'error');
  assert.equal(page.get('consent').hidden, true);assert.equal(page.get('account').hidden, true);assert.equal(page.get('account-next').hidden, true);
  assert.equal(page.calls.length, 0);assert.equal(page.metrics.consentLoads, 0);
  await page.submit();assert.equal(page.calls.length, 1);assert.equal(page.calls[0].method, 'resetPasswordForEmail');
  const destination = new URL(page.calls[0].args[1].redirectTo);
  assert.equal(destination.searchParams.get('view'), 'reset');assert.equal(destination.searchParams.get('authorization_id'), 'synthetic-authorization');
  assert.match(page.notice.textContent, /비밀번호 재설정 메일을 요청했어요/);
});

for (const [kind, callback] of [
  ['unconsumed code', '&code=synthetic-code&sb_flow_id=synthetic-flow'],
  ['error query', '&error=access_denied&error_code=otp_expired&error_description=synthetic-detail'],
  ['error fragment', '#error=access_denied&error_description=synthetic-detail'],
]) test(`a failed reset callback (${kind}) offers a new recovery email with recovery-specific guidance`, async t => {
  const page = await fixture(t, { reset: true, callbackQuery: `&authorization_id=synthetic-authorization&keep=one${callback}` });
  assert.equal(page.get('auth-panel').hidden, false);assert.equal(page.get('auth-submit').textContent, '재설정 메일 보내기');
  assert.equal(page.get('password-label').hidden, true);assert.equal(page.get('password').required, false);assert.equal(page.get('email').required, true);
  assert.equal(page.notice.textContent, authErrorMessage({ code: 'AUTH_RECOVERY_CALLBACK' }));assert.match(page.notice.textContent, /재설정 링크.*재설정 메일을 다시 요청/);
  assert.doesNotMatch(page.notice.textContent, /가입을 시작한 브라우저|이메일 확인을 이미|synthetic-detail/);
  assert.equal(page.notice['data-kind'], 'error');assert.equal(page.feedback.hidden, false);assert.equal(page.feedback.textContent, page.notice.textContent);
  assert.equal(page.get('consent').hidden, true);assert.equal(page.get('account').hidden, true);assert.equal(page.get('account-next').hidden, true);
  assert.equal(page.metrics.consentLoads, 0);assert.equal(page.calls.length, 0);assert.equal(page.destinations.length, 0);
  assert.equal(page.historyUrls.length, 1);const clean = new URL(location.href);
  assert.equal(clean.searchParams.get('authorization_id'), 'synthetic-authorization');assert.equal(clean.searchParams.get('view'), 'reset');assert.equal(clean.searchParams.get('keep'), 'one');
  for (const key of ['code', 'sb_flow_id', 'error', 'error_code', 'error_description']) assert.equal(clean.searchParams.has(key), false);
  assert.equal(clean.hash, '');await page.submit();
  assert.equal(page.calls.length, 1);assert.equal(page.calls[0].method, 'resetPasswordForEmail');assert.equal(page.get('auth-submit').disabled, false);
  const destination = new URL(page.calls[0].args[1].redirectTo);
  assert.equal(destination.searchParams.get('view'), 'reset');assert.equal(destination.searchParams.get('authorization_id'), 'synthetic-authorization');
  assert.match(page.notice.textContent, /^비밀번호 재설정 메일을 요청했어요/);assert.equal(page.notice['data-kind'], 'success');
});

for (const event of ['TOKEN_REFRESHED', 'SIGNED_IN']) test(`a session arriving by ${event} after the exact startup timeout can still open the original consent`, async t => {
  const pending = deferred();
  const page = await fixture(t, { consent: true, onInitialize: () => pending.promise,
    beforeMountComplete: async ({ time, mounting, metrics }) => {
      let completed = false;mounting.then(() => { completed = true; });
      assert.equal(time.pending(), 1);time.advance(11999);await settled();assert.equal(completed, false);
      assert.equal(metrics.consentLoads, 0);time.advance(1);await settled();assert.equal(completed, true);
    } });
  assert.match(page.notice.textContent, /연결을 확인하는 데 시간이 걸려요/);assert.equal(page.notice['data-kind'], 'error');
  assert.equal(page.get('auth-panel').hidden, false);assert.equal(page.get('consent').hidden, true);assert.equal(page.metrics.consentLoads, 0);
  assert.equal(page.time.pending(), 0);assert.equal(page.historyUrls.length, 0);assert.equal(page.calls.length, 0);
  await page.emit(event, syntheticSession('late-owner'));
  assert.equal(page.get('consent').hidden, false);assert.equal(page.get('auth-panel').hidden, true);assert.equal(page.get('account-next').hidden, true);
  assert.equal(page.metrics.consentLoads, 1);assert.equal(page.metrics.userChecks, 1);assert.equal(page.notice['data-kind'], 'info');
  assert.match(page.notice.textContent, /제품과 연결할 정보를 확인/);assert.doesNotMatch(page.notice.textContent, /만료|시간이 걸려요/);
  assert.equal(new URL(location.href).searchParams.get('authorization_id'), 'synthetic-authorization');assert.equal(page.calls.length, 0);assert.equal(page.destinations.length, 0);
  pending.resolve();await settled();assert.equal(page.metrics.consentLoads, 1);assert.equal(page.time.pending(), 0);
});

test('late SDK initialization can consume the callback code after the timeout and continue to consent', async t => {
  const pending = deferred();let consumed = false;
  const page = await fixture(t, { consent: true, callbackQuery: '&code=synthetic-code&keep=one',
    onInitialize: async ({ emit, setUrl }) => {
      await pending.promise;assert.equal(new URL(location.href).searchParams.get('code'), 'synthetic-code', 'timeout must not remove a code before the SDK consumes it');
      consumed = true;setUrl('https://id.example.test/?authorization_id=synthetic-authorization&keep=one');emit('SIGNED_IN', syntheticSession('late-confirmed-owner'));
    }, beforeMountComplete: async ({ time }) => { time.advance(12000);await settled(); } });
  assert.equal(consumed, false);assert.match(page.notice.textContent, /확인 링크 처리 중/);
  assert.equal(new URL(location.href).searchParams.get('code'), 'synthetic-code');assert.equal(page.historyUrls.length, 0);assert.equal(page.metrics.consentLoads, 0);
  pending.resolve();await settled();assert.equal(consumed, true);
  const clean = new URL(location.href);assert.equal(clean.searchParams.has('code'), false);assert.equal(clean.searchParams.get('authorization_id'), 'synthetic-authorization');assert.equal(clean.searchParams.get('keep'), 'one');
  assert.equal(page.get('consent').hidden, false);assert.equal(page.get('auth-panel').hidden, true);assert.equal(page.metrics.consentLoads, 1);assert.equal(page.metrics.userChecks, 1);
  assert.doesNotMatch(page.notice.textContent, /만료|시간이 걸려요/);assert.equal(page.notice['data-kind'], 'info');assert.equal(page.calls.length, 0);assert.equal(page.destinations.length, 0);
});

for (const outcome of ['success', 'failure']) test(`an unresolved callback locks every auth view and direct submit until SDK ${outcome}`, async t => {
  const pending = deferred();
  const page = await fixture(t, { consent: true, callbackQuery: '&code=synthetic-code', initializeError: outcome === 'failure' ? { code: 'flow_state_not_found' } : null,
    onInitialize: async ({ emit, setUrl }) => { await pending.promise;setUrl('https://id.example.test/?authorization_id=synthetic-authorization');emit('INITIAL_SESSION', null); },
    beforeMountComplete: async ({ time, get }) => {
      await settled();assert.equal(get('auth-submit').disabled, true);assert.equal(get('auth-submit').textContent, '확인 링크 처리 중…');
      time.advance(12000);await settled();
    } });
  assert.match(page.notice.textContent, /확인 링크 처리 중.*새로고침/);assert.equal(page.notice['data-kind'], 'pending');
  for (const mode of ['login', 'signup', 'recover', 'login']) {
    page.mode(mode);assert.equal(page.get('auth-submit').disabled, true);assert.equal(page.get('auth-submit').textContent, '확인 링크 처리 중…');
    await page.submit();assert.equal(page.calls.length, 0);assert.match(page.notice.textContent, /확인 링크 처리 중/);assert.equal(page.feedback['data-kind'], 'pending');
  }
  assert.equal(page.get('email').value, 'synthetic@example.test');assert.equal(page.get('password').value, 'synthetic-password');
  assert.equal(page.get('signup-age').checked, true);assert.equal(page.get('signup-learning').checked, true);
  pending.resolve();await settled();assert.equal(page.get('auth-submit').disabled, false);assert.equal(page.get('auth-submit').textContent, '로그인');
  assert.doesNotMatch(page.notice.textContent, /확인 링크 처리 중|요청을 보내고 있어요/);assert.equal(page.notice['data-kind'], outcome === 'failure' ? 'error' : 'info');
  page.mode('signup');assert.equal(page.feedback.hidden, true);page.mode('recover');assert.equal(page.feedback.hidden, true);page.mode('login');
  page.replies.signInWithPassword = { error: { code: 'invalid_credentials' } };await page.submit();
  assert.equal(page.calls.length, 1);assert.equal(page.calls[0].method, 'signInWithPassword');assert.match(page.notice.textContent, /이메일 또는 비밀번호가 맞지 않아요/);
});

for (const reset of [false, true]) test(`a failed ${reset ? 'recovery' : 'login'} callback completed before INITIAL_SESSION(null) replaces the waiting screen exactly once`, async t => {
  const pending = deferred();
  const page = await fixture(t, { reset, consent: !reset, callbackQuery: `${reset ? '&authorization_id=synthetic-authorization' : ''}&code=synthetic-code`,
    initializeError: { code: 'flow_state_not_found' }, onInitialize: () => pending.promise,
    beforeMountComplete: async ({ time }) => { time.advance(12000);await settled(); } });
  assert.equal(page.get('auth-submit').disabled, true);assert.match(page.notice.textContent, /확인 링크 처리 중/);
  pending.resolve();await settled();assert.equal(page.get('auth-submit').disabled, false);
  // The real SDK emits its empty initial session after its initialization promise has settled.
  await page.emit('INITIAL_SESSION', null);
  assert.equal(page.get('auth-submit').textContent, reset ? '재설정 메일 보내기' : '로그인');assert.equal(page.get('auth-panel').hidden, false);
  assert.equal(page.get('password-label').hidden, reset);assert.equal(page.get('password').required, !reset);assert.equal(page.get('email').required, true);
  assert.equal(page.notice.textContent, authErrorMessage({ code: reset ? 'AUTH_RECOVERY_CALLBACK' : 'AUTH_CALLBACK_INCOMPLETE' }));
  assert.equal(page.notice['data-kind'], 'error');assert.equal(page.feedback.textContent, page.notice.textContent);assert.equal(page.feedback.hidden, false);
  assert.doesNotMatch(page.notice.textContent, /확인 링크 처리 중|요청을 보내고 있어요/);assert.equal(page.metrics.consentLoads, 0);assert.equal(page.metrics.accountLoads, 0);
  assert.equal(page.get('consent').hidden, true);assert.equal(page.get('account').hidden, true);assert.equal(page.get('account-next').hidden, true);
  const writes = page.notice.textWrites, focus = page.notice.focusCount;
  await page.emit('INITIAL_SESSION', null);assert.equal(page.notice.textWrites, writes);assert.equal(page.notice.focusCount, focus);
  if (!reset) page.replies.signInWithPassword = { error: { code: 'invalid_credentials' } };
  await page.submit();assert.equal(page.calls.length, 1);assert.equal(page.calls[0].method, reset ? 'resetPasswordForEmail' : 'signInWithPassword');
  if (reset) assert.match(page.notice.textContent, /^비밀번호 재설정 메일을 요청했어요/);
  assert.equal(new URL(location.href).searchParams.has('code'), false);assert.equal(new URL(location.href).searchParams.get('authorization_id'), 'synthetic-authorization');assert.equal(page.destinations.length, 0);
});

test('an account changed in another tab gets neutral callback guidance without claiming the previous account was retained', async t => {
  const account = syntheticAccount('first-owner');
  const page = await fixture(t, { consent: true, initial: syntheticSession('first-owner'), accountResponse: account, callbackQuery: '&code=synthetic-code' });
  account.account.synk_user_id = 'second-owner';await page.emit('SIGNED_IN', syntheticSession('second-owner'));
  assert.deepEqual(page.metrics.checkedUsers, ['first-owner', 'second-owner']);assert.equal(page.metrics.accountLoads, 2);
  assert.equal(page.get('account').hidden, false);assert.equal(page.get('account-next').hidden, true);assert.equal(page.get('consent').hidden, true);
  assert.match(page.notice.textContent, /현재 로그인된 계정을 확인해 주세요/);assert.doesNotMatch(page.notice.textContent, /계정은 유지|계정을 유지/);
  assert.equal(page.notice['data-kind'], 'error');assert.equal(page.metrics.consentLoads, 0);assert.equal(page.destinations.length, 0);
});

for (const outcome of ['exchange error', 'unconsumed code']) test(`a late ${outcome} cannot authorize the different account restored by INITIAL_SESSION`, async t => {
  const pending = deferred(), restored = syntheticSession('different-existing-owner');
  const page = await fixture(t, { consent: true, callbackQuery: '&code=synthetic-code&keep=one', accountResponse: syntheticAccount('different-existing-owner'),
    consentDetails: { redirect_url: 'https://app.example.test/?code=synthetic-authorized-code&state=synthetic-state' },
    initializeError: outcome === 'exchange error' ? { code: 'flow_state_not_found' } : null,
    onInitialize: async ({ setUrl }) => { await pending.promise;if (outcome === 'exchange error') setUrl('https://id.example.test/?authorization_id=synthetic-authorization&keep=one'); },
    beforeMountComplete: async ({ time }) => { time.advance(12000);await settled(); } });
  const timeoutText = page.notice.textContent;
  await page.emit('INITIAL_SESSION', restored);await page.emit('TOKEN_REFRESHED', restored);
  assert.equal(page.notice.textContent, timeoutText);assert.equal(page.metrics.userChecks, 0);assert.equal(page.metrics.accountLoads, 0);assert.equal(page.metrics.consentLoads, 0);
  assert.equal(page.destinations.length, 0);assert.equal(page.get('consent').hidden, true);assert.equal(new URL(location.href).searchParams.get('code'), 'synthetic-code');
  pending.resolve();await settled();
  assert.equal(page.get('account').hidden, false);assert.equal(page.get('account-next').hidden, true);assert.equal(page.get('consent').hidden, true);
  assert.equal(page.metrics.accountLoads, 1);assert.deepEqual(page.metrics.checkedUsers, ['different-existing-owner']);assert.equal(page.metrics.consentLoads, 0);
  assert.match(page.notice.textContent, /확인 링크가 만료/);assert.match(page.notice.textContent, /현재 로그인된 계정을 확인/);assert.equal(page.notice['data-kind'], 'error');
  const clean = new URL(location.href);assert.equal(clean.searchParams.has('code'), false);assert.equal(clean.searchParams.get('authorization_id'), 'synthetic-authorization');assert.equal(clean.searchParams.get('keep'), 'one');
  await page.emit('SIGNED_IN', restored);await page.emit('INITIAL_SESSION', restored);
  assert.equal(page.metrics.accountLoads, 1);assert.equal(page.metrics.consentLoads, 0);assert.equal(page.calls.length, 0);assert.equal(page.destinations.length, 0);
});

test('an early session before the timeout cannot bypass the still-pending callback during startup rendering', async t => {
  const pending = deferred();
  const page = await fixture(t, { consent: true, callbackQuery: '&code=synthetic-code', initializeError: { code: 'flow_state_not_found' }, accountResponse: syntheticAccount('stored-owner'),
    consentDetails: { redirect_url: 'https://app.example.test/?code=synthetic-authorized-code&state=synthetic-state' },
    onInitialize: async ({ emit }) => { emit('INITIAL_SESSION', syntheticSession('stored-owner'));await pending.promise; },
    beforeMountComplete: async ({ time }) => { await settled();time.advance(12000);await settled(); } });
  assert.match(page.notice.textContent, /확인 링크 처리 중/);assert.equal(page.metrics.userChecks, 0);assert.equal(page.metrics.consentLoads, 0);assert.equal(page.destinations.length, 0);
  pending.resolve();await settled();assert.equal(page.metrics.accountLoads, 1);assert.equal(page.metrics.consentLoads, 0);assert.equal(page.destinations.length, 0);
  assert.match(page.notice.textContent, /현재 로그인된 계정을 확인/);assert.equal(page.get('account-next').hidden, true);
});

test('a repeated same-user event during retained-account loading cannot erase the late callback failure notice', async t => {
  const pending = deferred(), account = deferred(), current = syntheticSession('retained-owner');
  const page = await fixture(t, { consent: true, callbackQuery: '&code=synthetic-code', initializeError: { code: 'flow_state_not_found' }, accountResponse: account.promise,
    onInitialize: () => pending.promise, beforeMountComplete: async ({ time }) => { time.advance(12000);await settled(); } });
  await page.emit('INITIAL_SESSION', current);pending.resolve();await settled();assert.equal(page.metrics.accountLoads, 1);
  await page.emit('TOKEN_REFRESHED', current);account.resolve(syntheticAccount('retained-owner'));await settled();
  assert.equal(page.get('account').hidden, false);assert.equal(page.get('account-next').hidden, true);assert.equal(page.metrics.accountLoads, 1);assert.equal(page.metrics.consentLoads, 0);
  assert.match(page.notice.textContent, /확인 링크가 만료/);assert.match(page.notice.textContent, /현재 로그인된 계정을 확인/);assert.equal(page.notice['data-kind'], 'error');
});

test('early sign-in events wait for successful SDK cleanup and resume only the latest account once', async t => {
  const pending = deferred(), latest = syntheticSession('latest-confirmed-owner');
  const page = await fixture(t, { consent: true, callbackQuery: '&code=synthetic-code&keep=one',
    onInitialize: async ({ setUrl }) => { await pending.promise;setUrl('https://id.example.test/?authorization_id=synthetic-authorization&keep=one'); },
    beforeMountComplete: async ({ time }) => { time.advance(12000);await settled(); } });
  await page.emit('SIGNED_IN', syntheticSession('superseded-owner'));await page.emit('SIGNED_IN', latest);await page.emit('TOKEN_REFRESHED', latest);
  assert.equal(page.metrics.userChecks, 0);assert.equal(page.metrics.consentLoads, 0);assert.equal(page.historyUrls.length, 0);assert.equal(page.destinations.length, 0);
  assert.equal(new URL(location.href).searchParams.get('code'), 'synthetic-code');assert.match(page.notice.textContent, /확인 링크 처리 중/);
  pending.resolve();await settled();
  assert.equal(page.get('consent').hidden, false);assert.equal(page.get('auth-panel').hidden, true);assert.equal(page.get('account-next').hidden, true);
  assert.equal(page.metrics.consentLoads, 1);assert.deepEqual(page.metrics.checkedUsers, ['latest-confirmed-owner']);assert.equal(page.notice['data-kind'], 'info');
  assert.doesNotMatch(page.notice.textContent, /만료|시간이 걸려요/);assert.equal(new URL(location.href).searchParams.has('code'), false);
  await page.emit('INITIAL_SESSION', latest);assert.equal(page.metrics.consentLoads, 1);assert.equal(page.calls.length, 0);assert.equal(page.destinations.length, 0);
});

test('sign-out while a late callback settles fences the prior account and its automatic redirect', async t => {
  const pending = deferred();
  const page = await fixture(t, { consent: true, callbackQuery: '&code=synthetic-code',
    consentDetails: { redirect_url: 'https://app.example.test/?code=synthetic-authorized-code&state=synthetic-state' },
    onInitialize: async ({ setUrl }) => { await pending.promise;setUrl('https://id.example.test/?authorization_id=synthetic-authorization'); },
    beforeMountComplete: async ({ time }) => { time.advance(12000);await settled(); } });
  await page.emit('SIGNED_IN', syntheticSession('signed-out-owner'));await page.emit('SIGNED_OUT', null);pending.resolve();await settled();
  assert.equal(page.get('auth-panel').hidden, false);assert.equal(page.get('consent').hidden, true);assert.equal(page.get('account').hidden, true);assert.equal(page.get('account-next').hidden, true);
  assert.equal(page.metrics.userChecks, 0);assert.equal(page.metrics.consentLoads, 0);assert.equal(page.calls.length, 0);assert.equal(page.destinations.length, 0);
});

test('pagehide fences callback cleanup and account rendering from a late initialization failure', async t => {
  const pending = deferred();
  const page = await fixture(t, { consent: true, callbackQuery: '&code=synthetic-code', initializeError: { code: 'flow_state_not_found' },
    onInitialize: () => pending.promise, beforeMountComplete: async ({ time }) => { time.advance(12000);await settled(); } });
  await page.emit('INITIAL_SESSION', syntheticSession('stored-owner'));const writes = page.notice.textWrites;
  page.events.get('pagehide')({});pending.resolve();await settled();await page.emit('SIGNED_IN', syntheticSession('later-owner'));
  assert.equal(page.notice.textWrites, writes);assert.equal(page.historyUrls.length, 0);assert.equal(new URL(location.href).searchParams.get('code'), 'synthetic-code');
  assert.equal(page.metrics.userChecks, 0);assert.equal(page.metrics.accountLoads, 0);assert.equal(page.metrics.consentLoads, 0);assert.equal(page.destinations.length, 0);assert.equal(page.calls.length, 0);
});

test('a getSession error does not permanently block a later authenticated consent request', async t => {
  const page = await fixture(t, { consent: true, sessionError: { status: 503, message: 'Service unavailable' } });
  assert.match(page.notice.textContent, /계정 서버가 잠시 응답하지/);assert.equal(page.get('consent').hidden, true);assert.equal(page.metrics.consentLoads, 0);
  await page.emit('TOKEN_REFRESHED', syntheticSession('recovered-owner'));
  assert.equal(page.get('consent').hidden, false);assert.equal(page.get('auth-panel').hidden, true);assert.equal(page.get('account-next').hidden, true);
  assert.equal(page.metrics.consentLoads, 1);assert.equal(page.metrics.userChecks, 1);assert.equal(page.notice['data-kind'], 'info');
  assert.equal(new URL(location.href).searchParams.get('authorization_id'), 'synthetic-authorization');assert.equal(page.calls.length, 0);assert.equal(page.destinations.length, 0);
});

test('successful password update removes reset view while preserving the original authorization request', async t => {
  const page = await fixture(t, { reset: true, initial: syntheticSession('reset-owner'), callbackQuery: '&authorization_id=synthetic-authorization&keep=one' });
  assert.equal(page.get('auth-submit').textContent, '새 비밀번호 저장');assert.equal(page.metrics.consentLoads, 0);
  page.get('password').value = 'synthetic-new-password';page.replies.updateUser = { data: { user: { id: 'reset-owner' } } };await page.submit();
  assert.equal(page.calls.length, 1);assert.equal(page.calls[0].method, 'updateUser');assert.equal(page.get('password').value, '');
  const destination = new URL(location.href);
  assert.equal(destination.searchParams.has('view'), false);assert.equal(destination.searchParams.get('authorization_id'), 'synthetic-authorization');assert.equal(destination.searchParams.get('keep'), 'one');
  assert.equal(page.historyUrls.at(-1), destination.href);assert.equal(page.get('auth-panel').hidden, true);assert.equal(page.get('consent').hidden, false);
  assert.equal(page.metrics.consentLoads, 1);assert.equal(page.destinations.length, 0);assert.equal(page.get('account-next').hidden, true);
  assert.match(page.notice.textContent, /제품과 연결할 정보를 확인/);assert.notEqual(page.notice['data-kind'], 'error');
});

for (const [code, expected] of [['invalid_credentials', /이메일 또는 비밀번호가 맞지 않아요/], ['email_not_confirmed', /이메일 확인이 아직 끝나지/]]) {
  test(`${code} stays beside the submit button in Korean and preserves entered values`, async t => {
    const page = await fixture(t);page.replies.signInWithPassword = { error: { code, message: 'Synthetic raw provider message' } };await page.submit();
    assert.equal(page.feedback.hidden, false);assert.equal(page.feedback['data-kind'], 'error');assert.match(page.feedback.textContent, expected);
    assert.equal(page.notice.textContent, page.feedback.textContent);assert.equal(page.notice['data-kind'], 'error');assert.doesNotMatch(page.notice.textContent, /Synthetic raw/);
    assert.equal(page.get('email').value, 'synthetic@example.test');assert.equal(page.get('password').value, 'synthetic-password');assert.equal(page.get('auth-submit').disabled, false);
    assert.equal(page.notice.focusCount, 1);assert.equal(page.feedback.role, undefined);assert.equal(page.feedback['aria-live'], undefined);
    assert.equal(page.get('account-next').hidden, true);
  });
}

test('the public Care callback displays SYNK Pleasure although its registered product is platform', async t => {
  const page = await fixture(t, { consent: true, initial: syntheticSession('care-owner'), redirectUri: 'https://synk.im/care/',
    consentDetails: { client: { id: 'synthetic-client', name: 'SYNK 플랫폼' }, redirect_uri: 'https://synk.im/care/', scope: 'openid email profile' } });
  assert.equal(page.get('consent').hidden, false);assert.equal(page.get('consent-name').textContent, 'SYNK 플레저');
  assert.equal(page.get('consent-destination').textContent, 'https://synk.im/care/');assert.equal(page.get('account-next').hidden, true);
  assert.equal(page.metrics.consentLoads, 1);assert.equal(page.destinations.length, 0);
});

test('a convincing consent name cannot bypass the registered callback check', async t => {
  const page = await fixture(t, { consent: true, initial: syntheticSession('care-owner'), redirectUri: 'https://synk.im/care/',
    consentDetails: { client: { id: 'synthetic-client', name: 'SYNK 플레저 — 검증된 앱' }, redirect_uri: 'https://unregistered.example.test/care/', scope: 'openid email profile' } });
  assert.equal(page.get('consent').hidden, true);assert.equal(page.get('auth-panel').hidden, false);assert.equal(page.get('account-next').hidden, true);
  assert.equal(page.get('consent-name').textContent, '');assert.equal(page.get('consent-destination').textContent, '');
  assert.match(page.notice.textContent, /등록한 SYNK 제품의 도착 주소를 확인하지 못/);assert.equal(page.notice['data-kind'], 'error');
  assert.equal(page.destinations.length, 0);assert.equal(page.calls.length, 0);
});
