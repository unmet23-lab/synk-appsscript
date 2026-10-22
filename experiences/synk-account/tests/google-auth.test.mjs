import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beginGoogleFlow, consumeGoogleFlow, createGoogleAccess, googleDestination,
  publicLoginSettings, registrationFields, verifiedGoogleUser,
} from '../src/google-auth.mjs';

// Actual controller and validators; only DOM, SDK, storage and transport are synthetic.
// No account credentials, real phone numbers, network or SMS are used.
const config = { portalUrl: 'https://id.example.invalid/account/?obsolete=1#discard',
  supabaseUrl: 'https://account.example.invalid', supabasePublishableKey: 'synthetic-public-key' };
const NONCE = 'synthetic-google-flow-nonce-0001', PHONE = '+821055550001', SECOND_PHONE = '+821055550002';
const syntheticUser = id => ({ id, identities: [{ provider: 'google' }] });
const confirmedUser = id => ({ ...syntheticUser(id), phone: PHONE.slice(1), phone_confirmed_at: '2026-10-09T00:00:00Z', new_phone: '' });
const deferred = () => { let resolve, reject;const promise = new Promise((yes, no) => { resolve = yes;reject = no; });return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function memoryStorage() {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
const validFields = { country: 'KR', age: '24', gender: 'unspecified', genderText: '', privacyAccepted: true, learning: false };

class Element {
  constructor(tag, id, writes) {
    Object.assign(this, { tagName: tag, id, children: [], ownText: '', hidden: false, disabled: false, value: '', checked: false, required: false });
    return new Proxy(this, { set(target, key, value) { writes.push({ id, key, value });return Reflect.set(target, key, value); } });
  }
  get textContent() { return this.ownText + this.children.map(child => child.textContent).join(''); }
  set textContent(value) { this.children = [];this.ownText = String(value); }
  append(...children) { this.children.push(...children); }
  setAttribute(key, value) { this[key] = value; }
  querySelector(selector) { return selector === 'span:last-child' ? this.children.at(-1) : null; }
}
function fixture(t, { enabled = true, phoneEnabled = true, phoneVerificationRequired, storage = memoryStorage() } = {}) {
  const writes = [], notices = [], calls = [], nodes = new Map(), redirects = [], continued = [];
  for (const id of ['google-login', 'google-link', 'google-availability', 'google-onboarding', 'google-onboarding-form',
    'google-phone', 'google-phone-send', 'google-phone-code', 'google-phone-verify', 'google-phone-status', 'google-country',
    'google-age', 'google-gender', 'google-gender-text', 'google-gender-text-label', 'google-privacy', 'google-learning',
    'google-complete', 'google-cancel', 'google-linking', 'google-link-status', 'google-signin', 'email-divider',
    'google-phone-fields', 'google-onboarding-copy', 'google-privacy-fields', 'google-privacy-action-note', 'google-cancel-phone-note'])
    nodes.set(id, new Element('div', id, writes));
  for (const id of ['google-onboarding', 'google-linking', 'google-gender-text-label']) nodes.get(id).hidden = true;
  for (const id of ['google-login', 'google-link']) {
    const label = new Element('span', `${id}-label`, writes);nodes.set(label.id, label);
    nodes.get(id).append(new Element('span', `${id}-mark`, writes), label);
  }
  let session = { user: syntheticUser('synthetic-a'), access_token: 'synthetic-access-a' }, epoch = 1, time = 1000000;
  const replies = {}, originals = ['document', 'location', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  Object.assign(globalThis, {
    document: { getElementById: id => nodes.get(id) || null, createElement: tag => new Element(tag, '', writes) },
    location: { href: 'https://id.example.invalid/account/', assign: url => redirects.push(url) },
    fetch: async () => { throw new Error('A test attempted to use a real network transport'); },
  });
  const sdk = { auth: {
    signInWithOAuth: async value => { calls.push({ method: 'oauth', value });return { data: { url: `${config.supabaseUrl}/auth/v1/authorize?provider=google` } }; },
    linkIdentity: async value => { calls.push({ method: 'link', value });return { data: { url: `${config.supabaseUrl}/auth/v1/user/identities/authorize?provider=google` } }; },
    updateUser: async value => { calls.push({ method: 'updateUser', value });return replies.updateUser ? replies.updateUser(value) : { data: { user: session.user } }; },
    verifyOtp: async value => { calls.push({ method: 'verifyOtp', value });return replies.verifyOtp ? replies.verifyOtp(value) : { data: {} }; },
    getUser: async () => { calls.push({ method: 'getUser' });return replies.getUser ? replies.getUser() : { data: { user: confirmedUser(session.user.id) } }; },
  } };
  const fetcher = async (url, options) => {
    const entry = { method: options.method, url: String(url), options, body: options.body ? JSON.parse(options.body) : null };calls.push(entry);
    assert.equal(new URL(url).origin, config.supabaseUrl);assert.equal(new URL(url).pathname, '/functions/v1/synk-account');
    return replies.fetch ? replies.fetch(entry) : new Response(JSON.stringify({ ok: true, registration: { required: options.method !== 'POST',
      ...(phoneVerificationRequired === undefined ? {} : { phoneVerificationRequired }) } }), { status: 200 });
  };
  const access = createGoogleAccess({ config, sdk, enabled, phoneEnabled, storage, getSession: () => session, generation: () => epoch,
    setBusy: value => writes.push({ id: 'portal', key: 'busy', value }), notice: (...args) => { notices.push(args);writes.push({ id: 'portal', key: 'notice', value: args }); },
    continuePortal: async () => continued.push(session?.user?.id), endSession: async () => { session = null;epoch++; },
    fetcher, now: () => time, initialUrl: location.href });
  const get = id => { const node = nodes.get(id);assert.ok(node, `Expected fixture node ${id}`);return node; };
  const guard = () => {};
  const check = () => access.check(session.user, guard);
  const click = id => get(id).onclick();
  const submit = () => get('google-onboarding-form').onsubmit({ preventDefault() {} });
  const fill = (fields = validFields) => {
    for (const [name, id] of [['country', 'google-country'], ['age', 'google-age'], ['gender', 'google-gender'], ['genderText', 'google-gender-text']]) if (name in fields) get(id).value = fields[name];
    if ('privacyAccepted' in fields) get('google-privacy').checked = fields.privacyAccepted;
    if ('learning' in fields) get('google-learning').checked = fields.learning;
  };
  const verify = async () => { get('google-privacy').checked = true;get('google-phone').value = PHONE;await click('google-phone-send');get('google-phone-code').value = '123456';await click('google-phone-verify'); };
  const switchAccount = async () => { epoch++;session = { user: syntheticUser('synthetic-b'), access_token: 'synthetic-access-b' };access.reset();await check(); };
  t.after(() => { access.stop();for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor);else delete globalThis[key]; } });
  return { access, get, check, click, submit, fill, verify, switchAccount, calls, replies, writes, notices, redirects, continued, storage, advance: ms => { time += ms; } };
}

test('Google callback keeps authorization intent, is single-use, and expires after ten minutes', () => {
  const storage = memoryStorage(), now = 1000000;
  const started = beginGoogleFlow({ config, storage, authorizationId: 'synthetic-authorization-id', action: 'login', now, nonce: NONCE });
  const callback = new URL(started.redirectTo);
  assert.equal(callback.searchParams.get('authorization_id'), 'synthetic-authorization-id');assert.equal(callback.hash, '');assert.equal(callback.searchParams.has('obsolete'), false);
  assert.doesNotMatch([...storage.values.values()].join(''), /access_token|refresh_token|123456|82105555/);
  assert.equal(consumeGoogleFlow({ storage, url: callback.href, now: now + 600000 }).action, 'login');
  assert.equal(storage.values.size, 0);
  assert.throws(() => consumeGoogleFlow({ storage, url: callback.href, now: now + 600000 }), { code: 'GOOGLE_FLOW_INVALID' });
  for (const elapsed of [600001, -1]) {
    const flow = beginGoogleFlow({ config, storage, now, nonce: NONCE });
    assert.throws(() => consumeGoogleFlow({ storage, url: flow.redirectTo, now: now + elapsed }), { code: 'GOOGLE_FLOW_INVALID' });
    assert.equal(storage.values.size, 0);
  }
});

test('tampered callback or a different account cannot complete an existing-account Google link', () => {
  for (const mutate of [url => url.searchParams.set('google_flow', 'different-synthetic-nonce'), url => url.searchParams.append('google_flow', NONCE), url => url.searchParams.set('authorization_id', 'different-intent')]) {
    const storage = memoryStorage(), flow = beginGoogleFlow({ config, storage, action: 'link', subject: 'synthetic-a', authorizationId: 'original-intent', now: 1000, nonce: NONCE });
    const url = new URL(flow.redirectTo);mutate(url);
    assert.throws(() => consumeGoogleFlow({ storage, url: url.href, now: 1001 }), { code: 'GOOGLE_FLOW_INVALID' });assert.equal(storage.values.size, 0);
  }
  assert.throws(() => verifiedGoogleUser(syntheticUser('synthetic-b'), { action: 'link', subject: 'synthetic-a' }), { code: 'GOOGLE_ACCOUNT_CHANGED' });
  assert.throws(() => verifiedGoogleUser({ id: 'synthetic-a', identities: [{ provider: 'email' }] }), { code: 'GOOGLE_IDENTITY_REQUIRED' });
});

test('unavailable pending storage stops OAuth before the SDK or browser is called', async t => {
  for (const storage of [{ setItem() { throw new Error('Synthetic blocked storage'); }, getItem() { return null; } }, { setItem() {}, getItem() { return null; } }])
    assert.throws(() => beginGoogleFlow({ config, storage, nonce: NONCE }), { code: 'GOOGLE_STORAGE_UNAVAILABLE' });
  const f = fixture(t, { storage: { setItem() { throw new Error('Synthetic quota'); }, getItem() { return null; }, removeItem() {} } });
  await f.click('google-login');assert.equal(f.calls.length, 0);assert.equal(f.redirects.length, 0);assert.match(f.notices.at(-1)[0], /시작할 수 없어요/);
});

test('disabled Google and unavailable public settings fail closed without OAuth', async t => {
  const f = fixture(t, { enabled: false });await f.click('google-login');assert.equal(f.get('google-login').disabled, true);
  assert.equal(f.calls.length, 0);assert.equal(f.storage.values.size, 0);assert.equal(f.redirects.length, 0);
  assert.deepEqual(await publicLoginSettings(config, async () => new Response('{}', { status: 503 })), { google: false, phone: false });
  assert.deepEqual(await publicLoginSettings(config, async () => { throw new Error('Synthetic offline'); }), { google: false, phone: false });
  assert.deepEqual(await publicLoginSettings(config, async (url, options) => {
    assert.equal(new URL(url).pathname, '/auth/v1/settings');assert.equal(options.credentials, 'omit');assert.equal('Authorization' in options.headers, false);
    return new Response(JSON.stringify({ external: { google: true, phone: false } }));
  }), { google: true, phone: true });
  assert.deepEqual(await publicLoginSettings(config, async () =>
    new Response(JSON.stringify({ external: { google: false, phone: true } }))), { google: false, phone: false });
});

test('OAuth destination rejects untrusted hosts, credentials, paths and fragments', () => {
  for (const url of ['https://attacker.example.invalid/auth/v1/authorize', `${config.supabaseUrl}/other`, 'http://accounts.google.com/o/oauth2/v2/auth', 'https://fake:secret@accounts.google.com/o/oauth2/v2/auth', 'https://accounts.google.com/o/oauth2/v2/auth#secret'])
    assert.throws(() => googleDestination(url, config), { code: 'GOOGLE_REDIRECT_INVALID' });
  assert.equal(googleDestination('https://accounts.google.com/o/oauth2/v2/auth?state=synthetic', config), 'https://accounts.google.com/o/oauth2/v2/auth?state=synthetic');
});

test('a verified Google user with required registration stays in onboarding instead of continuing to apps', async t => {
  const f = fixture(t);assert.equal(await f.check(), false);assert.equal(f.get('google-onboarding').hidden, false);assert.equal(f.continued.length, 0);
  assert.equal(f.calls.length, 1);assert.equal(new URL(f.calls[0].url).searchParams.get('view'), 'registration');
  assert.equal(f.calls[0].options.credentials, 'omit');assert.equal(f.calls[0].options.headers['x-synk-product'], 'platform');
  assert.equal(f.get('google-learning').checked, false);
});

test('phone-change proof precedes registration; completion sends profile and consent without phone, OTP or credentials', async t => {
  const f = fixture(t);await f.check();f.fill();await f.verify();
  assert.deepEqual(f.calls.filter(call => ['updateUser', 'verifyOtp', 'getUser'].includes(call.method)).map(call => ({ method: call.method, value: call.value })), [
    { method: 'updateUser', value: { phone: PHONE } }, { method: 'verifyOtp', value: { phone: PHONE, token: '123456', type: 'phone_change' } }, { method: 'getUser', value: undefined },
  ]);
  assert.equal(f.get('google-phone-code').value, '');await f.submit();
  const post = f.calls.find(call => call.method === 'POST');assert.ok(post);
  assert.equal(post.options.headers['x-synk-app-version'], '0.2.0');
  assert.deepEqual(post.body, { action: 'complete-google-registration', country: 'KR', age: 24, gender: 'unspecified', genderText: '', privacyAccepted: true, privacyVersion: 'google-registration-1', learning: false });
  assert.doesNotMatch(post.options.body, /phone|123456|access_token|refresh_token|password/);
  assert.deepEqual(f.continued, ['synthetic-a']);assert.equal(f.get('google-onboarding').hidden, true);
});

test('completion before verification, an old-number OTP, and editing a confirmed number cannot register', async t => {
  const f = fixture(t);await f.check();f.fill();f.get('google-phone').value = PHONE;await f.submit();assert.equal(f.calls.some(call => call.method === 'POST'), false);
  await f.click('google-phone-send');f.get('google-phone').value = SECOND_PHONE;f.get('google-phone').oninput();f.get('google-phone-code').value = '123456';await f.click('google-phone-verify');
  assert.equal(f.calls.some(call => call.method === 'verifyOtp'), false);
  f.advance(60000);await f.verify();assert.match(f.get('google-phone-status').textContent, /확인했/);
  f.get('google-phone').value = SECOND_PHONE;f.get('google-phone').oninput();await f.submit();
  assert.equal(f.calls.some(call => call.method === 'POST'), false);assert.equal(f.continued.length, 0);assert.doesNotMatch(f.get('google-phone-status').textContent, /확인했/);
});

test('age, country, gender and consent validation reject incomplete or malformed registration', async t => {
  const invalid = [
    { country: '' }, { country: 'ZZ' }, { country: 'kr' }, { age: '13' }, { age: '121' }, { age: '24.5' }, { age: '24 years' }, { age: Number.NaN },
    { gender: '' }, { gender: 'unknown' }, { gender: 'other', genderText: '' }, { gender: 'other', genderText: 'x'.repeat(61) }, { gender: 'other', genderText: 'test\u0000value' }, { privacyAccepted: false },
  ];
  for (const fields of invalid) assert.throws(() => registrationFields({ ...validFields, ...fields }), error => /COUNTRY_REQUIRED|AGE_INVALID|GENDER_REQUIRED|GENDER_INVALID|PRIVACY_REQUIRED/.test(error.code));
  const f = fixture(t);await f.check();await f.verify();
  for (const fields of [{ country: '' }, { age: '13' }, { gender: '' }, { gender: 'other', genderText: '' }, { privacyAccepted: false }]) { f.fill({ ...validFields, ...fields });await f.submit(); }
  assert.equal(f.calls.some(call => call.method === 'POST'), false);assert.equal(f.continued.length, 0);
});

test('OTP success alone cannot register without a fresh matching Google owner and confirmed phone', async t => {
  const f = fixture(t);await f.check();f.fill();
  const proofs = [
    { ...confirmedUser('synthetic-a'), phone_confirmed_at: null }, { ...confirmedUser('synthetic-a'), phone: SECOND_PHONE.slice(1) },
    { ...confirmedUser('synthetic-a'), new_phone: SECOND_PHONE.slice(1) }, confirmedUser('synthetic-b'),
    { ...confirmedUser('synthetic-a'), identities: [{ provider: 'email' }] },
  ];
  for (const owner of proofs) { f.replies.getUser = async () => ({ data: { user: owner } });f.advance(60000);await f.verify();await f.submit(); }
  assert.equal(f.calls.some(call => call.method === 'POST'), false);assert.equal(f.continued.length, 0);
});

test('a phone send belonging to the previous account cannot write the new account UI after it resolves', async t => {
  const f = fixture(t), gate = deferred();await f.check();f.fill();f.get('google-phone').value = PHONE;f.replies.updateUser = () => gate.promise;
  const pending = f.click('google-phone-send');await tick();await f.switchAccount();const writes = f.writes.length, notices = f.notices.length;
  gate.resolve({ data: { user: syntheticUser('synthetic-a') } });await pending;
  assert.equal(f.writes.length, writes);assert.equal(f.notices.length, notices);assert.equal(f.continued.length, 0);
});

test('a pending phone proof cannot clear a new account OTP or alter its UI', async t => {
  const f = fixture(t), gate = deferred();await f.check();f.fill();f.get('google-phone').value = PHONE;await f.click('google-phone-send');
  f.replies.getUser = () => gate.promise;f.get('google-phone-code').value = '123456';const pending = f.click('google-phone-verify');await tick();
  await f.switchAccount();f.get('google-phone-code').value = '654321';const writes = f.writes.length, notices = f.notices.length;
  gate.resolve({ data: { user: confirmedUser('synthetic-a') } });await pending;
  assert.equal(f.get('google-phone-code').value, '654321');assert.equal(f.writes.length, writes);assert.equal(f.notices.length, notices);
});

test('a phone is never transmitted before the privacy notice is acknowledged', async t => {
  const f = fixture(t);await f.check();f.get('google-phone').value = PHONE;
  await f.click('google-phone-send');assert.equal(f.calls.filter(call => call.method === 'updateUser').length, 0);
  assert.match(f.notices.at(-1)[0], /번호를 보내기 전에/);
  f.get('google-privacy').checked = true;await f.click('google-phone-send');
  assert.equal(f.calls.filter(call => call.method === 'updateUser').length, 1);
});

test('same verified phone and formatting-only edits retain proof without another SMS', async t => {
  const f = fixture(t);await f.check();f.fill();await f.verify();
  f.get('google-phone').value = '+82 (10) 5555-0001';f.get('google-phone').oninput();
  await f.click('google-phone-send');assert.equal(f.calls.filter(call => call.method === 'updateUser').length, 1);
  assert.match(f.get('google-phone-status').textContent, /인증을 확인/);
  await f.submit();assert.equal(f.calls.filter(call => call.method === 'POST').length, 1);
});

test('an Auth no-op response for an already-confirmed phone keeps completion available', async t => {
  const f = fixture(t);await f.check();f.fill();f.get('google-phone').value = PHONE;
  f.replies.updateUser = async () => ({ data: { user: confirmedUser('synthetic-a') } });
  await f.click('google-phone-send');await f.submit();
  assert.equal(f.calls.filter(call => call.method === 'verifyOtp').length, 0);
  assert.equal(f.calls.filter(call => call.method === 'POST').length, 1);
});

test('restoring the SMS target after editing still verifies the original code without a resend', async t => {
  const f = fixture(t);await f.check();f.fill();f.get('google-phone').value = PHONE;await f.click('google-phone-send');
  f.get('google-phone').value = '';f.get('google-phone').oninput();
  f.get('google-phone').value = SECOND_PHONE;f.get('google-phone').oninput();
  f.get('google-phone').value = PHONE;f.get('google-phone').oninput();
  f.get('google-phone-code').value = '123456';await f.click('google-phone-verify');await f.submit();
  assert.equal(f.calls.filter(call => call.method === 'updateUser').length, 1);
  assert.equal(f.calls.filter(call => call.method === 'verifyOtp').length, 1);assert.equal(f.calls.filter(call => call.method === 'POST').length, 1);
});

test('restoring the old confirmed phone while another change is pending does not falsely report SMS sent', async t => {
  const f = fixture(t);await f.check();f.fill();await f.verify();f.advance(60000);
  f.replies.updateUser = async () => ({ data: { user: { ...confirmedUser('synthetic-a'), new_phone: SECOND_PHONE.slice(1) } } });
  f.get('google-phone').value = SECOND_PHONE;f.get('google-phone').oninput();await f.click('google-phone-send');f.advance(60000);
  f.get('google-phone').value = PHONE;f.get('google-phone').oninput();await f.click('google-phone-send');
  assert.match(f.notices.at(-1)[0], /다른 번호로 인증을/);assert.doesNotMatch(f.notices.at(-1)[0], /요청했어요/);
  await f.submit();assert.equal(f.calls.filter(call => call.method === 'POST').length, 0);
});

test('unchanged live status text is not rewritten on a control refresh', async t => {
  const f = fixture(t);await f.check();const count = () => f.writes.filter(write => ['google-availability', 'google-phone-status', 'google-link-status'].includes(write.id) && write.key === 'textContent').length;
  const before = count();f.access.refreshControls();f.access.refreshControls();assert.equal(count(), before);
});

test('phone-already-in-use reports an actionable account message', async t => {
  const f = fixture(t);await f.check();f.fill();f.get('google-phone').value = PHONE;
  f.replies.updateUser = async () => ({ error: { code: 'phone_exists' } });await f.click('google-phone-send');
  assert.match(f.notices.at(-1)[0], /다른 계정.*휴대폰/);assert.equal(f.calls.filter(call => call.method === 'POST').length, 0);
});

test('a completed registration response for the previous account cannot continue apps or repaint the new account', async t => {
  const f = fixture(t), gate = deferred();await f.check();f.fill();await f.verify();
  f.replies.fetch = call => call.method === 'POST' ? gate.promise : new Response(JSON.stringify({ ok: true, registration: { required: true } }));
  const pending = f.submit();await tick();await f.switchAccount();const writes = f.writes.length, notices = f.notices.length;
  gate.resolve(new Response(JSON.stringify({ ok: true, registration: { required: false } })));await pending;
  assert.equal(f.continued.length, 0);assert.equal(f.writes.length, writes);assert.equal(f.notices.length, notices);
});

test('server-deferred signup completes without a phone service or SDK phone proof and keeps the original account', async t => {
  const f = fixture(t, { phoneEnabled: false, phoneVerificationRequired: false });await f.check();f.fill();
  assert.equal(f.get('google-phone-fields').hidden, true);assert.equal(f.get('google-phone').required, false);
  for (const id of ['google-phone', 'google-phone-code', 'google-phone-send', 'google-phone-verify']) assert.equal(f.get(id).disabled, true);
  assert.equal(f.get('google-complete').disabled, false);assert.equal(f.get('google-privacy-fields').textContent, '국가·나이·성별');
  await f.click('google-phone-send');await f.click('google-phone-verify');await f.submit();
  assert.equal(f.calls.filter(call => ['updateUser', 'verifyOtp', 'getUser'].includes(call.method)).length, 0);
  const posts = f.calls.filter(call => call.method === 'POST');assert.equal(posts.length, 1);
  assert.deepEqual(posts[0].body, { action: 'complete-google-registration', country: 'KR', age: 24, gender: 'unspecified', genderText: '',
    privacyAccepted: true, privacyVersion: 'google-registration-1', learning: false });
  assert.deepEqual(f.continued, ['synthetic-a']);assert.equal(f.get('google-onboarding').hidden, true);
});

test('missing or malformed phone policy never bypasses verification', async t => {
  for (const policy of [undefined, null, 'false', 0, {}, true]) await t.test(String(policy), async child => {
    const f = fixture(child, { phoneVerificationRequired: policy });await f.check();f.fill();await f.submit();
    assert.equal(f.get('google-phone-fields').hidden, false);assert.equal(f.get('google-phone').required, true);
    assert.equal(f.calls.filter(call => call.method === 'POST').length, 0);assert.equal(f.continued.length, 0);
  });
});

test('deferred SMS leaves profile and privacy validation mandatory', async t => {
  const f = fixture(t, { phoneEnabled: false, phoneVerificationRequired: false });await f.check();
  for (const invalid of [{ country: '' }, { age: '13' }, { gender: '' }, { privacyAccepted: false }]) {
    f.fill({ ...validFields, ...invalid });await f.submit();
  }
  assert.equal(f.calls.filter(call => call.method === 'POST').length, 0);assert.equal(f.continued.length, 0);
  assert.equal(f.calls.filter(call => ['updateUser', 'verifyOtp', 'getUser'].includes(call.method)).length, 0);
});

test('render restores other-gender visibility and validation without a select change event', async t => {
  const f = fixture(t, { phoneEnabled: false, phoneVerificationRequired: false });await f.check();
  f.fill({ ...validFields, gender: 'other', genderText: '' });f.access.refreshControls();
  assert.equal(f.get('google-gender-text-label').hidden, false);
  assert.equal(f.get('google-gender-text').required, true);assert.equal(f.get('google-gender-text').disabled, false);
  await f.submit();assert.equal(f.calls.filter(call => call.method === 'POST').length, 0);
  f.get('google-gender').value = 'unspecified';f.access.refreshControls();
  assert.equal(f.get('google-gender-text-label').hidden, true);
  assert.equal(f.get('google-gender-text').required, false);assert.equal(f.get('google-gender-text').disabled, true);
  f.get('google-gender').value = 'other';f.access.refreshControls();f.get('google-gender-text').value = '직접 입력한 성별';
  await f.submit();const posts = f.calls.filter(call => call.method === 'POST');assert.equal(posts.length, 1);
  assert.equal(posts[0].body.gender, 'other');assert.equal(posts[0].body.genderText, '직접 입력한 성별');
  assert.deepEqual(f.continued, ['synthetic-a']);
});

test('deferred signup cannot carry its policy or late completion into a different account', async t => {
  const f = fixture(t, { phoneEnabled: false, phoneVerificationRequired: false }), gate = deferred();await f.check();f.fill();
  f.replies.fetch = call => call.method === 'POST' ? gate.promise : new Response(JSON.stringify({ ok: true, registration: { required: true } }));
  const pending = f.submit();await tick();await f.switchAccount();const writes = f.writes.length, notices = f.notices.length;
  assert.equal(f.get('google-phone-fields').hidden, false);assert.equal(f.get('google-phone').required, true);
  gate.resolve(new Response(JSON.stringify({ ok: true, registration: { required: false, phoneVerificationRequired: false } })));await pending;
  assert.equal(f.continued.length, 0);assert.equal(f.writes.length, writes);assert.equal(f.notices.length, notices);
});
