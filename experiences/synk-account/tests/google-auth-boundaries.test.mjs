import test from 'node:test';
import assert from 'node:assert/strict';
import { mountPortal } from '../src/portal.mjs';
import { createGoogleAccess } from '../src/google-auth.mjs';

// Actual portal/controller; DOM, Auth and account transport are synthetic.
// No real account, phone, OTP, browser storage or network is used.
const PHONE = '+821055550001';
const googleUser = () => ({ id: 'synthetic-google-owner', identities: [{ provider: 'google' }] });
const verifiedUser = () => ({ ...googleUser(), phone: PHONE.slice(1), phone_confirmed_at: '2020-01-01T00:00:00Z', new_phone: '' });
const emailUser = () => ({ id: 'synthetic-email-owner', identities: [{ provider: 'email' }] });
const deferred = () => { let resolve;const promise = new Promise(done => { resolve = done; });return { promise, resolve }; };
const settled = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); };
class Element {
  constructor(tag = 'div', writes = []) {
    Object.assign(this, { tagName: tag, children: [], dataset: {}, hidden: false, disabled: false, value: '', checked: false, textContent: '', classList: { add() {}, remove() {} } });
    return new Proxy(this, { set(target, key, value) { writes.push({ key, value });return Reflect.set(target, key, value); } });
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(key, value) { this[key] = value; }
  closest() { return this; }
  before() {}
  querySelector() { return null; }
  addEventListener() {}
  focus() {}
  scrollIntoView() {}
}
function clock() {
  let now = 0, sequence = 0;const timers = new Map();
  return { now: () => now, setTimeout(fn, ms) { timers.set(++sequence, { at: now + ms, fn });return sequence; }, clearTimeout(id) { timers.delete(id); },
    advance(ms) { now += ms;for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id);timer.fn(); } } };
}
function fixture(t, { user = null, callback = false, initialize = null, loginSettings = { google: true, phone: true },
  callbackQuery = '', pendingFlow = null, initializeError = null, controllerOnly = false, phoneVerificationRequired } = {}) {
  const nodes = new Map(), events = new Map(), calls = [], replies = {}, redirects = [], writes = [], time = clock(), storage = new Map();
  const get = id => { if (!nodes.has(id)) nodes.set(id, new Element('div', writes));return nodes.get(id); };
  const modes = ['login', 'signup', 'recover'].map(view => Object.assign(new Element('button', writes), { dataset: { view } }));
  for (const id of ['account', 'consent', 'auth-panel', 'google-onboarding', 'google-linking', 'setup']) get(id).hidden = true;
  get('email').value = 'synthetic@example.invalid';get('password').value = 'synthetic-password';get('signup-age').checked = true;
  let saved = user ? { user, access_token: 'synthetic-access' } : null, listener, registrationRequired = true;
  const config = { configured: true, portalUrl: 'https://id.example.invalid/account/', learningUrl: '/',
    supabaseUrl: 'https://account.example.invalid', accountApiUrl: 'https://account.example.invalid', supabasePublishableKey: 'synthetic-public-key',
    clients: { platform: { clientId: 'synthetic-client', redirectUri: 'https://platform.example.invalid/' } }, authorizationClients: [] };
  const initialUrl = new URL(config.portalUrl);if (callback) initialUrl.searchParams.set('code', 'synthetic-old-code');
  for (const [key, value] of new URLSearchParams(callbackQuery)) initialUrl.searchParams.append(key, value);
  if (pendingFlow) storage.set('synk.google.pending.v1', JSON.stringify(pendingFlow));
  const pendingStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  const original = ['document', 'window', 'location', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  const emit = (event, value) => { saved = value;listener(event, value); };
  Object.assign(globalThis, {
    document: { body: new Element('body', writes), getElementById: get, createElement: tag => new Element(tag, writes), querySelectorAll: () => modes },
    window: { addEventListener: (name, fn) => events.set(name, fn), history: { state: null, replaceState(_state, _title, url) { location.href = url; } } },
    location: { href: initialUrl.href, assign: url => redirects.push(url), reload() {} },
    fetch: async (url, options) => {
      assert.equal(new URL(url).href.split('?')[0], 'https://account.example.invalid/functions/v1/synk-account');
      const body = options.body ? JSON.parse(options.body) : null;calls.push({ method: options.method, body });
      if (options.method === 'POST') registrationRequired = false;
      return new Response(JSON.stringify({ ok: true, registration: { required: registrationRequired,
        ...(phoneVerificationRequired === undefined ? {} : { phoneVerificationRequired }) } }));
    },
  });
  const invoke = async (method, value) => { calls.push({ method, value });return replies[method] ? replies[method](value) : { data: { session: null } }; };
  const sdk = { auth: {
    initialize: async () => {
      await initialize?.promise;
      const clean = new URL(location.href);for (const key of ['code', 'error', 'error_code', 'error_description']) clean.searchParams.delete(key);location.href = clean.href;
      return { error: initializeError };
    },
    onAuthStateChange: fn => { listener = fn; }, getSession: async () => ({ data: { session: saved } }), getUser: async () => ({ data: { user: saved?.user } }),
    signInWithPassword: value => invoke('password', value), signUp: value => invoke('signup', value),
    signInWithOAuth: value => invoke('google', value), linkIdentity: value => invoke('link', value),
    updateUser: value => invoke('phone', value), verifyOtp: value => invoke('otp', value),
    signOut: async value => { calls.push({ method: 'logout', value });if (replies.cleanup) await replies.cleanup();emit('SIGNED_OUT', null);return {}; },
    oauth: {
      getAuthorizationDetails: async () => { calls.push({ method: 'consent-load' });return { data: { client: { id: 'synthetic-client' }, redirect_uri: 'https://platform.example.invalid/', scope: 'openid email profile' } }; },
      approveAuthorization: async () => { calls.push({ method: 'approve' });return { data: { redirect_url: 'https://platform.example.invalid/?code=synthetic-code&state=synthetic-state' } }; },
      denyAuthorization: async () => { calls.push({ method: 'deny' });return { data: { redirect_url: 'https://platform.example.invalid/?error=access_denied&state=synthetic-state' } }; },
    },
  } };
  replies.google = async () => ({ data: { url: 'https://account.example.invalid/auth/v1/authorize?provider=google' } });
  const accountFactory = () => ({ load: async () => {
    calls.push({ method: 'account' });return { ok: true, account: { synk_user_id: 'synthetic-stable-id', status: 'active', profile: {} }, learning: { enabled: false, revision: 1 }, capabilities: {}, sessions: [] };
  } });
  const access = controllerOnly ? createGoogleAccess({ config, sdk, enabled: loginSettings.google, phoneEnabled: loginSettings.phone,
    storage: pendingStorage, getSession: () => saved, generation: () => 0, setBusy() {}, notice: text => { get('notice').textContent = text; },
    continuePortal: async () => {}, endSession: async () => {}, initialUrl: initialUrl.href }) : null;
  const ready = access ? Promise.resolve() : mountPortal({ config, sdk, accountFactory, loginSettings, cooldownClock: time, googleStorage: pendingStorage });
  t.after(() => { access?.stop();events.get('pagehide')?.({});for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor);else delete globalThis[key]; } });
  return { ready, access, get, calls, replies, redirects, writes, events, time, mode: view => modes.find(button => button.dataset.view === view).onclick(),
    submit: () => get('auth-form').onsubmit({ preventDefault() {} }),
    complete: () => get('google-onboarding-form').onsubmit({ preventDefault() {} }),
    fill() { get('google-country').value = 'KR';get('google-age').value = '24';get('google-gender').value = 'unspecified';get('google-privacy').checked = true; } };
}

test('reloaded onboarding resumes a server-confirmed phone without sending another OTP', async t => {
  const f = fixture(t, { user: verifiedUser() });await f.ready;
  assert.equal(f.get('google-onboarding').hidden, false);assert.equal(f.get('google-phone').value, PHONE);
  assert.match(f.get('google-phone-status').textContent, /인증을 확인/);assert.equal(f.get('google-phone-code').disabled, true);
  f.fill();await f.complete();
  assert.equal(f.calls.filter(call => ['phone', 'otp'].includes(call.method)).length, 0);
  assert.equal(f.calls.filter(call => call.method === 'POST').length, 1);assert.equal(f.calls.filter(call => call.method === 'account').length, 1);
  assert.equal(f.get('google-onboarding').hidden, true);
});

test('the actual portal accepts deferred Google signup without a phone service and loads its same SYNK account', async t => {
  const f = fixture(t, { user: googleUser(), loginSettings: { google: true, phone: false }, phoneVerificationRequired: false });await f.ready;
  assert.equal(f.get('google-onboarding').hidden, false);assert.equal(f.get('google-phone-fields').hidden, true);
  assert.equal(f.get('google-complete').disabled, false);assert.equal(f.calls.filter(call => call.method === 'account').length, 0);
  f.fill();await f.complete();
  assert.equal(f.calls.filter(call => ['phone', 'otp'].includes(call.method)).length, 0);
  assert.equal(f.calls.filter(call => call.method === 'POST').length, 1);assert.equal(f.calls.filter(call => call.method === 'account').length, 1);
  assert.equal(f.get('google-onboarding').hidden, true);assert.equal(f.get('account').hidden, false);
});

test('Google signup preserves the launcher authorization request and approves only after deferred registration completes', async t => {
  const f = fixture(t, { user: googleUser(), loginSettings: { google: true, phone: false }, phoneVerificationRequired: false,
    callbackQuery: 'authorization_id=synthetic-authorization' });await f.ready;
  assert.equal(f.calls.filter(call => ['account', 'consent-load', 'approve'].includes(call.method)).length, 0);assert.equal(f.redirects.length, 0);
  f.fill();await f.complete();
  assert.equal(f.calls.filter(call => ['phone', 'otp'].includes(call.method)).length, 0);
  assert.equal(f.calls.filter(call => call.method === 'POST').length, 1);assert.equal(f.calls.filter(call => call.method === 'approve').length, 1);
  assert.ok(f.calls.findIndex(call => call.method === 'POST') < f.calls.findIndex(call => call.method === 'approve'));
  assert.equal(f.redirects.length, 1);assert.match(f.redirects[0], /platform\.example\.invalid/);
});

test('unverified, pending-change or malformed Auth phone proof cannot be restored after reload', async t => {
  for (const override of [{ phone_confirmed_at: null }, { phone_confirmed_at: 'invalid-date' }, { new_phone: '821055550002' }, { phone: 'invalid-phone' }]) {
    await t.test(JSON.stringify(override), async child => {
      const f = fixture(child, { user: { ...verifiedUser(), ...override } });await f.ready;f.fill();await f.complete();
      assert.equal(f.calls.filter(call => call.method === 'POST').length, 0);assert.equal(f.calls.filter(call => call.method === 'account').length, 0);
      assert.doesNotMatch(f.get('google-phone-status').textContent, /인증을 확인/);
    });
  }
});

test('a finite Auth-confirmed phone is restored even when the PC clock is behind the Auth timestamp', async t => {
  const originalNow = Date.now;Date.now = () => Date.parse('2019-01-01T00:00:00Z');t.after(() => { Date.now = originalNow; });
  const owner = verifiedUser();assert.ok(Date.parse(owner.phone_confirmed_at) > Date.now());
  const f = fixture(t, { user: owner });await f.ready;
  assert.equal(f.get('google-phone').value, PHONE);assert.match(f.get('google-phone-status').textContent, /인증을 확인/);
  f.fill();await f.complete();assert.equal(f.calls.filter(call => ['phone', 'otp'].includes(call.method)).length, 0);
  assert.equal(f.calls.filter(call => call.method === 'POST').length, 1);assert.equal(f.get('google-onboarding').hidden, true);
  // This UI fixture does not weaken the separate server-time future-proof rejection test.
});

test('pending email signup blocks Google OAuth and cannot have its busy lock cleared by a Google click', async t => {
  const f = fixture(t), pending = deferred();await f.ready;f.mode('signup');f.replies.signup = () => pending.promise;
  const signing = f.submit();await settled();assert.equal(f.get('auth-submit').disabled, true);assert.equal(f.get('google-login').disabled, true);
  await f.get('google-login').onclick();assert.equal(f.calls.filter(call => call.method === 'google').length, 0);assert.equal(f.redirects.length, 0);
  assert.equal(f.get('auth-submit').disabled, true);await f.submit();assert.equal(f.calls.filter(call => call.method === 'signup').length, 1);
  pending.resolve({ data: { session: null } });await signing;assert.equal(f.get('google-login').disabled, false);
});

test('an unresolved PKCE callback cannot start a new Google flow before initialization finishes', async t => {
  const pending = deferred(), f = fixture(t, { callback: true, initialize: pending });await settled();
  try {
    assert.equal(f.get('google-login').disabled, true);await f.get('google-login').onclick();
    assert.equal(f.calls.filter(call => call.method === 'google').length, 0);assert.equal(f.redirects.length, 0);
  } finally { pending.resolve();await f.ready; }
  assert.equal(f.get('google-login').disabled, false);
});

test('cancelled Google onboarding keeps email and Google sign-in locked until SDK logout actually settles', async t => {
  const f = fixture(t, { user: googleUser() }), pending = deferred();await f.ready;f.replies.cleanup = () => pending.promise;
  const cancelling = f.get('google-cancel').onclick();await settled();
  assert.equal(f.get('google-onboarding').hidden, true);assert.equal(f.get('auth-submit').disabled, true);assert.equal(f.get('google-login').disabled, true);
  await f.submit();await f.get('google-login').onclick();assert.equal(f.calls.filter(call => ['password', 'google'].includes(call.method)).length, 0);
  f.time.advance(12000);await settled();assert.equal(f.get('auth-submit').disabled, true);assert.equal(f.get('google-login').disabled, true);
  pending.resolve();await cancelling;assert.equal(f.calls.filter(call => call.method === 'logout').length, 1);
  assert.equal(f.get('auth-submit').disabled, false);assert.equal(f.get('google-login').disabled, false);
  assert.match(f.get('notice').textContent, /가입을 완료하지 않고.*로그아웃했어요/);
  assert.equal(f.get('notice').className, 'notice');assert.equal(f.get('notice')['data-kind'], 'info');
});

test('cancelled Google onboarding preserves an error when SDK session cleanup cannot be confirmed', async t => {
  const f = fixture(t, { user: googleUser(), phoneVerificationRequired: false });await f.ready;
  f.replies.cleanup = async () => { throw new Error('synthetic browser storage failure'); };
  await f.get('google-cancel').onclick();
  assert.equal(f.get('google-onboarding').hidden, true);assert.equal(f.get('account').hidden, true);
  assert.match(f.get('notice').textContent, /로그인 저장이 지워졌는지 확인하지 못했어요/);
  assert.equal(f.get('notice').className, 'notice error');assert.equal(f.get('notice')['data-kind'], 'error');
});

test('slow provider discovery leaves email login and PKCE callback initialization available', async t => {
  for (const callback of [false, true]) await t.test(callback ? 'PKCE callback' : 'ordinary sign-in', async child => {
    const pending = deferred(), f = fixture(child, { callback, loginSettings: pending.promise });await f.ready;
    assert.equal(f.get('auth-submit').disabled, false);assert.equal(f.get('google-login').disabled, true);
    await f.submit();assert.equal(f.calls.filter(call => call.method === 'password').length, 1);
    await f.get('google-login').onclick();assert.equal(f.calls.filter(call => call.method === 'google').length, 0);
    pending.resolve({ google: true, phone: true });await settled();assert.equal(f.get('google-login').disabled, false);
    await f.get('google-login').onclick();assert.equal(f.calls.filter(call => call.method === 'google').length, 1);assert.equal(f.redirects.length, 1);
  });
});

test('late provider settings perform no UI writes after pagehide', async t => {
  const pending = deferred(), f = fixture(t, { loginSettings: pending.promise });await f.ready;
  f.events.get('pagehide')({});const before = f.writes.length;
  pending.resolve({ google: true, phone: true });await settled();
  assert.equal(f.writes.length, before);assert.equal(f.calls.filter(call => call.method === 'google').length, 0);
});

test('an explicit cancelled Google callback keeps a verified email account usable without approving the old app request', async t => {
  const nonce = 'synthetic-google-cancel-nonce-0001', authorizationId = 'synthetic-authorization';
  const f = fixture(t, { user: emailUser(),
    callbackQuery: new URLSearchParams({ error: 'access_denied', error_code: 'access_denied', error_description: 'Synthetic Google cancellation', google_flow: nonce, authorization_id: authorizationId }).toString(),
    pendingFlow: { version: 1, action: 'link', nonce, createdAt: Date.now(), authorizationId, subject: emailUser().id },
    initializeError: { code: 'access_denied' } });
  await f.ready;
  assert.equal(f.get('account').hidden, false);assert.equal(f.get('auth-panel').hidden, true);assert.equal(f.get('account-next').hidden, true);
  assert.equal(f.calls.filter(call => call.method === 'account').length, 1);
  assert.equal(f.calls.filter(call => ['consent-load', 'approve', 'deny'].includes(call.method)).length, 0);assert.equal(f.redirects.length, 0);
  assert.match(f.get('notice').textContent, /Google/);assert.match(f.get('notice').textContent, /취소|완료하지|마치지/);
  assert.doesNotMatch(f.get('notice').textContent, /메일|이메일/);
  const cleaned = new URL(location.href);assert.equal(cleaned.searchParams.get('authorization_id'), authorizationId);
  assert.equal(cleaned.searchParams.has('google_flow'), false);assert.equal(cleaned.searchParams.has('error'), false);
});

test('a Google identity already linked elsewhere preserves the email account and explains the conflict without suggesting cancellation retry', async t => {
  const nonce = 'synthetic-google-conflict-nonce-0001', authorizationId = 'synthetic-authorization';
  const f = fixture(t, { user: emailUser(),
    callbackQuery: new URLSearchParams({ error: 'server_error', error_code: 'identity_already_exists', error_description: 'Synthetic identity conflict', google_flow: nonce, authorization_id: authorizationId }).toString(),
    pendingFlow: { version: 1, action: 'link', nonce, createdAt: Date.now(), authorizationId, subject: emailUser().id },
    initializeError: { code: 'identity_already_exists' } });
  await f.ready;
  assert.equal(f.get('account').hidden, false);assert.equal(f.get('auth-panel').hidden, true);assert.equal(f.get('account-next').hidden, true);
  assert.equal(f.calls.filter(call => call.method === 'account').length, 1);
  assert.equal(f.calls.filter(call => ['consent-load', 'approve', 'deny', 'logout', 'password', 'google', 'link'].includes(call.method)).length, 0);
  assert.equal(f.redirects.length, 0);
  assert.match(f.get('notice').textContent, /Google 계정은 다른 SYNK 계정에 연결/);
  assert.match(f.get('notice').textContent, /현재 로그인된 SYNK 계정은 유지/);
  assert.doesNotMatch(f.get('notice').textContent, /취소|다시 계속|재시도/);
  const cleaned = new URL(location.href);assert.equal(cleaned.searchParams.get('authorization_id'), authorizationId);
  assert.equal(cleaned.searchParams.has('google_flow'), false);assert.equal(cleaned.searchParams.has('error_code'), false);
});

test('a successful SDK Google callback with a different nonce remains fail closed', async t => {
  const authorizationId = 'synthetic-authorization';
  const f = fixture(t, { user: verifiedUser(), callback: true,
    callbackQuery: new URLSearchParams({ google_flow: 'synthetic-wrong-google-nonce-0001', authorization_id: authorizationId }).toString(),
    pendingFlow: { version: 1, action: 'login', nonce: 'synthetic-original-google-nonce-0001', createdAt: Date.now(), authorizationId, subject: null } });
  await f.ready;
  assert.equal(f.get('account').hidden, true);assert.equal(f.get('auth-panel').hidden, false);assert.equal(f.get('account-next').hidden, true);
  assert.equal(f.get('google-onboarding').hidden, true);
  assert.equal(f.calls.filter(call => ['account', 'GET', 'POST', 'consent-load', 'approve'].includes(call.method)).length, 0);assert.equal(f.redirects.length, 0);
  assert.match(f.get('notice').textContent, /Google 로그인 요청/);
});

test('an existing email account hides Google linking until asynchronous provider enablement', async t => {
  const pending = deferred(), f = fixture(t, { user: emailUser(), loginSettings: pending.promise });await f.ready;
  assert.equal(f.get('account').hidden, false);assert.equal(f.get('google-linking').hidden, true);assert.equal(f.get('google-link').disabled, true);
  pending.resolve({ google: true, phone: true });await settled();
  assert.equal(f.get('account').hidden, false);assert.equal(f.get('google-linking').hidden, false);assert.equal(f.get('google-link').disabled, false);
  assert.equal(f.calls.filter(call => ['google', 'link'].includes(call.method)).length, 0);
});

test('disabling Google hides its linking card on the same authenticated account', async t => {
  const owner = emailUser(), f = fixture(t, { user: owner, controllerOnly: true, loginSettings: { google: false, phone: false } });await f.ready;
  await f.access.check(owner, () => {});f.access.showAccount(true);assert.equal(f.get('google-linking').hidden, true);
  await Promise.resolve().then(() => f.access.settings({ google: true, phone: true }));assert.equal(f.get('google-linking').hidden, false);
  await Promise.resolve().then(() => f.access.settings({ google: false, phone: true }));
  assert.equal(f.get('google-linking').hidden, true);assert.equal(f.get('google-link').disabled, true);
  assert.equal(f.calls.filter(call => ['google', 'link'].includes(call.method)).length, 0);
});
