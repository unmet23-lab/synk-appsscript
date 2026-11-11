import test from 'node:test';
import assert from 'node:assert/strict';
import { mountPortal } from '../src/portal.mjs';
import { RECENT_LOGIN_KEY } from '../src/recent-login.mjs';

// 2026-11-11: Google and e-mail are one pair of buttons that say the same thing (「○○로 로그인」 / 「○○로 가입」), and the
// e-mail fields open under the pair once e-mail is the way. Synthetic DOM and SDK only: no network, account or storage.
class Element {
  constructor(tag = 'div') { this.tagName = tag;this.children = [];this.beforeNodes = [];this.dataset = {};this.hidden = false;this.disabled = false;this.value = '';this.text = '';this.checked = false;this.focusCount = 0;this.classList = { add() {}, remove() {}, toggle() {} }; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(key, value) { this[key] = value; }
  removeAttribute(key) { delete this[key]; }
  getAttribute(key) { return this[key] ?? null; }
  closest() { return this; }
  before(node) { this.beforeNodes.push(node); }
  addEventListener() {}
  focus() { if (!this.disabled && !this.hidden) this.focusCount++; }
  scrollIntoView() {}
  querySelector() { return null; }
  get textContent() { return this.text; }
  set textContent(value) { this.text = String(value); }
}
const memory = (entries = {}) => { const map = new Map(Object.entries(entries));return { map, getItem: key => map.has(key) ? map.get(key) : null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) }; };
const settled = async () => { for (let n = 0; n < 6; n++) await new Promise(resolve => setImmediate(resolve)); };
const recentEmail = { [RECENT_LOGIN_KEY]: JSON.stringify({ v: 2, method: 'email', email: 'member@synthetic.test', masked: 'me***@synthetic.test', at: 1000 }) };
const recentGoogle = { [RECENT_LOGIN_KEY]: JSON.stringify({ v: 2, method: 'google', masked: 'me***@synthetic.test', at: 1000 }) };

async function fixture(t, { loginSettings = { google: true, phone: false }, stored = {}, query = '', replies = {} } = {}) {
  const ids = new Map(), events = new Map(), calls = [], modes = ['login', 'signup', 'recover'].map(value => Object.assign(new Element('button'), { dataset: { view: value } }));
  const get = id => { if (!ids.has(id)) ids.set(id, new Element());return ids.get(id); };
  for (const id of ['auth-panel', 'consent', 'account', 'setup', 'signup-choices']) get(id).hidden = true;
  const localStorage = memory(stored), sessionStorage = memory();
  const original = ['document', 'window', 'location'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  Object.assign(globalThis, { document: { body: new Element(), getElementById: get, createElement: tag => new Element(tag), querySelectorAll: () => modes },
    window: { addEventListener: (type, fn) => events.set(type, fn), localStorage, sessionStorage, history: { state: null, replaceState(_state, _title, url) { location.href = url; } } },
    location: { href: `https://id.example.test/id/${query}`, assign() {}, reload() {} } });
  t.after(() => { events.get('pagehide')?.({});for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor);else delete globalThis[key]; } });
  const invoke = async (method, args) => { calls.push({ method, args });return typeof replies[method] === 'function' ? replies[method](args) : replies[method] || { data: { session: null }, error: null }; };
  const sdk = { auth: { initialize: async () => ({ error: null }), getSession: async () => ({ data: { session: null }, error: null }), getUser: async () => ({ data: { user: null } }), onAuthStateChange: () => ({}),
    signUp: args => invoke('signUp', args), signInWithPassword: args => invoke('signInWithPassword', args), resetPasswordForEmail: (...args) => invoke('resetPasswordForEmail', args), updateUser: args => invoke('updateUser', args), verifyOtp: args => invoke('verifyOtp', args),
    oauth: { getAuthorizationDetails: async () => ({ data: null }), approveAuthorization: async () => ({}), denyAuthorization: async () => ({}) } } };
  await mountPortal({ config: { configured: true, learningUrl: '/', portalUrl: 'https://id.example.test/id/', supabaseUrl: 'https://auth.example.test', supabasePublishableKey: 'synthetic-public-only', clients: {}, authorizationClients: [] }, sdk, loginSettings });
  await settled();
  return { get, calls, localStorage, mode: name => modes.find(button => button.dataset.view === name).onclick(), press: () => get('email-method').onclick(), submit: () => get('auth-form').onsubmit({ preventDefault() {} }),
    state: () => ({ fields: !get('email-fields').hidden, expanded: get('email-method')['aria-expanded'], email: get('email-method-label').textContent, google: get('google-login-label').textContent, heading: get('auth-heading').textContent, pair: !get('method-choices').hidden }) };
}

test('a first visit shows the two ways with the same words and no fields to fill in', async t => {
  const page = await fixture(t);
  assert.deepEqual(page.state(), { fields: false, expanded: 'false', email: '이메일로 로그인', google: 'Google로 로그인', heading: '로그인 방법을 골라 주세요.', pair: true });
  assert.equal(page.get('google-login').disabled, false);assert.equal(page.get('google-availability').textContent, '');assert.equal(page.get('google-privacy-note').hidden, false);
  assert.match(page.get('auth-copy').textContent, /가입할 때 쓴 방법/);
  // The pair carries its own name for a screen reader, turned with the step.
  assert.equal(page.get('method-choices')['aria-label'], '로그인 방법');
  page.mode('signup');assert.equal(page.get('method-choices')['aria-label'], '가입 방법');
});

test('pressing the e-mail way opens its fields with the keyboard in the first one, and folds them again', async t => {
  const page = await fixture(t);
  page.press();
  assert.equal(page.state().fields, true);assert.equal(page.state().expanded, 'true');assert.equal(page.get('email').focusCount, 1);assert.equal(page.get('auth-submit').textContent, '로그인');
  page.press();
  assert.equal(page.state().fields, false);assert.equal(page.state().expanded, 'false');assert.equal(page.get('email').focusCount, 1);
});

test('an address already in the field puts the keyboard in the password instead', async t => {
  const page = await fixture(t);
  page.get('email').value = 'member@synthetic.test';page.press();
  assert.equal(page.get('password').focusCount, 1);assert.equal(page.get('email').focusCount, 0);
});

test('sign-up is the same pair with the words turned, and keeps the fields the way they were', async t => {
  const page = await fixture(t);
  page.mode('signup');
  assert.deepEqual(page.state(), { fields: false, expanded: 'false', email: '이메일로 가입', google: 'Google로 가입', heading: '가입 방법을 골라 주세요.', pair: true });
  // The pressed link hid itself; the keyboard lands on the first way, not on a hidden field.
  assert.equal(page.get('google-login').focusCount, 1);assert.equal(page.get('email').focusCount, 0);
  page.press();
  assert.equal(page.state().fields, true);assert.equal(page.get('auth-submit').textContent, '가입하기');assert.equal(page.get('signup-choices').hidden, false);
  page.mode('login');
  assert.equal(page.state().fields, true);assert.equal(page.state().email, '이메일로 로그인');assert.equal(page.state().google, 'Google로 로그인');
});

test('the way used last time on this device decides whether the fields start open', async t => {
  const byEmail = await fixture(t, { stored: recentEmail });
  assert.equal(byEmail.state().fields, true);assert.equal(byEmail.state().expanded, 'true');assert.equal(byEmail.get('email').value, 'member@synthetic.test');
  assert.equal(byEmail.get('email-recent').hidden, false);assert.equal(byEmail.get('google-recent').hidden, true);assert.equal(byEmail.state().heading, '다시 오셨네요.');
  // A new account is a fresh choice: the hint opens the fields for signing in only.
  byEmail.mode('signup');assert.equal(byEmail.state().fields, false);
});

test('a Google sign-in last time marks the Google way and leaves the fields folded', async t => {
  const byGoogle = await fixture(t, { stored: recentGoogle });
  assert.equal(byGoogle.state().fields, false);assert.equal(byGoogle.get('google-recent').hidden, false);assert.equal(byGoogle.get('email-recent').hidden, true);
});

test('forgetting the hint keeps the fields where they are', async t => {
  const page = await fixture(t, { stored: recentEmail });
  page.get('recent-login-forget').onclick();
  assert.equal(page.localStorage.map.size, 0);assert.equal(page.state().fields, true);assert.equal(page.get('recent-login').hidden, true);assert.equal(page.get('email-recent').hidden, true);
});

test('without Google the e-mail fields are simply there and the page says why one button waits', async t => {
  const page = await fixture(t, { loginSettings: { google: false, phone: false } });
  assert.equal(page.state().fields, true);assert.equal(page.state().expanded, 'true');assert.equal(page.state().heading, '이메일로 로그인해요.');
  assert.equal(page.get('google-login').disabled, true);assert.match(page.get('google-availability').textContent, /Google 로그인을 쓸 수 없어요/);assert.equal(page.get('google-privacy-note').hidden, true);
  // Nothing else to choose: a press cannot fold the only way in.
  page.press();assert.equal(page.state().fields, true);
  page.mode('signup');assert.equal(page.state().heading, '이메일로 가입해요.');assert.match(page.get('google-availability').textContent, /Google로 가입할 수 없어요/);assert.equal(page.state().fields, true);
});

test('while Google is still being looked up the pair waits folded, and opens e-mail only if Google turns out off', async t => {
  let answer;const pending = new Promise(resolve => { answer = resolve; });
  const page = await fixture(t, { loginSettings: pending });
  assert.equal(page.state().fields, false);assert.equal(page.get('google-login').disabled, true);assert.equal(page.get('google-availability').textContent, 'Google 로그인을 확인하고 있어요.');
  assert.equal(page.state().heading, '로그인 방법을 골라 주세요.');
  answer({ google: false, phone: false });await settled();
  assert.equal(page.state().fields, true);assert.equal(page.state().heading, '이메일로 로그인해요.');assert.match(page.get('google-availability').textContent, /쓸 수 없어요/);
});

test('once Google is found the waiting line goes quiet and the pair stays folded', async t => {
  let on;const page = await fixture(t, { loginSettings: new Promise(resolve => { on = resolve; }) });
  on({ google: true, phone: false });await settled();
  assert.equal(page.state().fields, false);assert.equal(page.get('google-login').disabled, false);assert.equal(page.get('google-availability').textContent, '');
});

test('the password steps have no pair, and the way back from them stays on e-mail', async t => {
  const page = await fixture(t);
  page.press();page.mode('recover');
  assert.equal(page.state().pair, false);assert.equal(page.state().fields, true);assert.equal(page.get('google-privacy-note').hidden, true);assert.match(page.get('auth-copy').textContent, /「Google로 로그인」/);
  page.mode('login');
  assert.equal(page.state().pair, true);assert.equal(page.state().fields, true);
});

test('opened straight on the reset-mail step (the PC app\'s 「비밀번호를 잊었어요」), coming back is still the e-mail way', async t => {
  const direct = await fixture(t, { query: '?view=recover' });
  assert.equal(direct.state().pair, false);assert.equal(direct.state().fields, true);
  direct.mode('login');assert.equal(direct.state().fields, true);assert.equal(direct.state().expanded, 'true');
});

test('a wrong password names the other way by the words on its button', async t => {
  const page = await fixture(t, { replies: { signInWithPassword: { data: { session: null }, error: { code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' } } } });
  page.press();page.get('email').value = 'member@synthetic.test';page.get('password').value = 'synthetic-wrong';await page.submit();
  assert.match(page.get('notice').textContent, /「Google로 로그인」/);assert.doesNotMatch(page.get('notice').textContent, /계속하기/);assert.equal(page.state().fields, true);
});

test('a mail link that comes back lands on the e-mail fields', async t => {
  const mail = await fixture(t, { query: '?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid' });
  assert.equal(mail.state().fields, true);
});

test('a Google return does not open the e-mail fields', async t => {
  const google = await fixture(t, { query: '?google_flow=' + 'n'.repeat(24) });
  assert.equal(google.state().fields, false);
});
