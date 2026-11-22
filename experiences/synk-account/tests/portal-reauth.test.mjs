import test from 'node:test';
import assert from 'node:assert/strict';
import { mountPortal, reauthTarget, takeReauthMark, REAUTH_KEY, REAUTH_TTL, ADMIN_REAUTH_MARK_WAIT } from '../src/portal.mjs';
import { readConfig } from '../src/core.mjs';

// Workspace's 「SYNK ID로 다시 확인」: ?reauth=1&next=<authorize address>. Synthetic DOM, SDK and storage only: no network or real credentials.
const AUTH = 'https://auth.example.test', WEB_CALLBACK = 'https://work.example.test/api/synk-id/callback', PC_CALLBACK = 'http://127.0.0.1:43823/synk/oauth/messenger/callback';
const LOCAL_CALLBACK = 'http://127.0.0.1:4191/api/synk-id/callback', PLATFORM_CALLBACK = 'https://id.example.test/account/client.html?product=platform';
const PORTAL = 'https://id.example.test/id/', NOW = 1800000000000;
const PLAIN_COPY = '이메일과 비밀번호로 로그인해요. 처음이면 아래 「가입하기」를 눌러 주세요.';
const LINE = 'Workspace에서 다시 확인을 요청했어요. SYNK ID로 한 번 더 로그인해 주세요.';
const REFUSED = '이 다시 로그인 요청이 등록된 SYNK 서비스에서 왔는지 확인하지 못해 따르지 않았어요. 사용하던 화면에서 다시 시작해 주세요.';
const SIGNOUT_FAILED = '이 브라우저에서 로그아웃하지 못해 다시 로그인을 시작하지 못했어요. Workspace로 돌아가 「SYNK ID로 다시 로그인」을 한 번 더 눌러 주세요.';
const config = readConfig({ version: 1, supabaseUrl: AUTH, supabasePublishableKey: 'sb_publishable_synthetic', portalUrl: PORTAL,
  clients: { messenger: { clientId: 'messenger-web', redirectUri: WEB_CALLBACK }, platform: { clientId: 'platform-web', redirectUri: PLATFORM_CALLBACK } },
  // Like the public config: the Workspace web client also keeps a local company server's address.
  authorizationClients: [{ product: 'messenger', clientId: 'messenger-web', redirectUris: [LOCAL_CALLBACK, WEB_CALLBACK] }, { product: 'messenger', clientId: 'messenger-pc', redirectUris: [PC_CALLBACK] },
    { product: 'world', clientId: 'world-app', redirectUris: ['synktalk://oauth/callback'] }] }, PORTAL);
function authorize(overrides = {}, base = AUTH) {
  const url = new URL('/auth/v1/oauth/authorize', base), fields = { client_id: 'messenger-web', redirect_uri: WEB_CALLBACK, response_type: 'code', state: 'synthetic-state-0123456789',
    code_challenge: 'synthetic-challenge-0123456789abcdefghijklmnopq', code_challenge_method: 'S256', scope: 'openid email profile', ...overrides };
  for (const [key, value] of Object.entries(fields)) if (value !== undefined) url.searchParams.set(key, value);
  return url.href;
}
const reauthUrl = next => `${PORTAL}?reauth=1&next=${encodeURIComponent(next)}`;

test('reauthTarget follows only Workspace authorize requests of this Auth project', () => {
  assert.deepEqual({ ...reauthTarget(authorize(), config) }, { href: authorize(), clientId: 'messenger-web' });
  // Built by string joining with encodeURIComponent instead of URLSearchParams.
  const joined = `${AUTH}/auth/v1/oauth/authorize?client_id=messenger-web&redirect_uri=${encodeURIComponent(WEB_CALLBACK)}&response_type=code&state=s1&code_challenge=c1&code_challenge_method=S256&scope=openid%20email%20profile`;
  assert.equal(reauthTarget(joined, config)?.href, joined);
  // The company server asks for openid and profile only.
  assert.equal(reauthTarget(authorize({ scope: 'openid profile' }), config)?.clientId, 'messenger-web');
});

test('reauthTarget refuses every other address', () => {
  const ok = authorize();
  const refused = {
    'other origin': authorize({}, 'https://evil.example.test'),
    'other port': authorize({}, 'https://auth.example.test:8443'),
    'look-alike host': authorize({}, 'https://auth.example.test.evil.example'),
    'plain http': ok.replace('https:', 'http:'),
    'token path': ok.replace('/oauth/authorize', '/oauth/token'),
    'trailing slash': ok.replace('/oauth/authorize', '/oauth/authorize/'),
    'encoded path': ok.replace('/oauth/authorize', '/oauth/authoriz%65'),
    'other client product': authorize({ client_id: 'platform-web', redirect_uri: PLATFORM_CALLBACK }),
    // Registered Workspace addresses on this device: the PC app and a local company server.
    'PC app client': authorize({ client_id: 'messenger-pc', redirect_uri: PC_CALLBACK }),
    'local company server': authorize({ redirect_uri: LOCAL_CALLBACK }),
    'world app client': authorize({ client_id: 'world-app', redirect_uri: 'synktalk://oauth/callback' }),
    'unknown client': authorize({ client_id: 'messenger-unknown' }),
    'unregistered redirect': authorize({ redirect_uri: 'https://evil.example.test/api/synk-id/callback' }),
    'another client redirect': authorize({ redirect_uri: PC_CALLBACK }),
    'redirect with extra query': authorize({ redirect_uri: WEB_CALLBACK + '?next=https://evil.example.test/' }),
    'redirect carrying a code': authorize({ redirect_uri: WEB_CALLBACK + '?code=synthetic' }),
    'redirect with hash': authorize({ redirect_uri: WEB_CALLBACK + '#x' }),
    hash: ok + '#fragment',
    'bare hash': ok + '#',
    userinfo: ok.replace('https://', 'https://someone:secret@'),
    username: ok.replace('https://', 'https://someone@'),
    javascript: 'javascript:location.href=' + JSON.stringify(ok),
    'javascript comment': 'javascript://' + ok.slice('https://'.length),
    data: 'data:text/html,' + encodeURIComponent(ok),
    relative: ok.slice(AUTH.length),
    'scheme relative': ok.slice('https:'.length),
    'double encoded': encodeURIComponent(ok),
    'double encoded query': ok.replace('response_type=code', 'response_type%3Dcode'),
    'leading space': ' ' + ok,
    newline: ok.replace('?', '\n?'),
    tab: ok.replace('https://', 'https:\t//'),
    backslash: ok.replace('https://', 'https:\\\\'),
    'token response': authorize({ response_type: 'token' }),
    'no challenge': authorize({ code_challenge: undefined }),
    'empty challenge': authorize({ code_challenge: '' }),
    'plain challenge': authorize({ code_challenge_method: 'plain' }),
    'no state': authorize({ state: undefined }),
    'no scope': authorize({ scope: undefined }),
    'wider scope': authorize({ scope: 'openid email profile offline_access' }),
    'repeated scope': authorize({ scope: 'openid openid' }),
    'extra field': authorize({ prompt: 'none' }),
    'repeated client': ok + '&client_id=platform-web',
    'repeated redirect': ok + '&redirect_uri=' + encodeURIComponent(WEB_CALLBACK),
  };
  for (const [name, value] of Object.entries(refused)) assert.equal(reauthTarget(value, config), null, name);
  for (const value of [null, undefined, 42, '', {}]) assert.equal(reauthTarget(value, config), null, String(value));
  assert.equal(reauthTarget(ok, { ...config, supabaseUrl: 'https://other.example.test' }), null);
});

function memoryStore(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { values, getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => { values.set(key, String(value)); }, removeItem: key => { values.delete(key); } };
}
const mark = (fields = {}) => JSON.stringify({ v: 1, clientId: 'messenger-web', until: NOW + REAUTH_TTL, authorizationId: null, ...fields });

test('the mark binds to the first app request that comes back, for five minutes', () => {
  const store = memoryStore({ [REAUTH_KEY]: mark() });
  assert.deepEqual({ ...takeReauthMark(store, 'auth-1', NOW + 1000) }, { clientId: 'messenger-web', until: NOW + REAUTH_TTL });
  assert.equal(JSON.parse(store.getItem(REAUTH_KEY)).authorizationId, 'auth-1');
  // A reload or a Google round trip of the same request finds it again.
  assert.equal(takeReauthMark(store, 'auth-1', NOW + 2000)?.clientId, 'messenger-web');
  // Another request drops it.
  assert.equal(takeReauthMark(store, 'auth-2', NOW + 3000), null);
  assert.equal(store.getItem(REAUTH_KEY), null);
  for (const [name, raw] of [['expired', mark({ until: NOW })], ['too long', mark({ until: NOW + REAUTH_TTL + 1 })], ['no client', mark({ clientId: '' })], ['old shape', mark({ v: 0 })], ['broken', '{']]) {
    const other = memoryStore({ [REAUTH_KEY]: raw });
    assert.equal(takeReauthMark(other, 'auth-1', NOW), null, name);
    assert.equal(other.getItem(REAUTH_KEY), null, name);
  }
  assert.equal(takeReauthMark(memoryStore(), 'auth-1', NOW), null);
  assert.equal(takeReauthMark(null, 'auth-1', NOW), null);
});

class Element {
  constructor(tag = 'div') { Object.assign(this, { tagName: tag, children: [], dataset: {}, hidden: false, disabled: false, value: '', checked: false, text: '', classList: { add() {}, remove() {}, toggle() {} } }); }
  get textContent() { return this.text; }
  set textContent(value) { this.text = value; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(key, value) { this[key] = value; }
  getAttribute(key) { return this[key] ?? null; }
  removeAttribute(key) { delete this[key]; }
  closest() { return this; }
  before() {}
  after() {}
  focus() {}
  scrollIntoView() {}
  querySelector() { return null; }
  addEventListener() {}
}
const settle = async () => { for (let n = 0; n < 12; n++) await new Promise(resolve => setImmediate(resolve)); };
const sessionFor = id => ({ user: { id, email: `${id}@example.test`, identities: [{ provider: 'email' }] }, access_token: `synthetic-access-${id}` });
const accountReply = id => ({ ok: true, account: { synk_user_id: id, status: 'active', profile: {} }, learning: { enabled: false, revision: 1 }, capabilities: {}, sessions: [{ id: '00000000-0000-4000-8000-000000000456', current: true, revoked: false }], dataRequests: [] });

const MESSENGER_DETAILS = { client: { id: 'messenger-web', name: 'Workspace' }, redirect_uri: WEB_CALLBACK, scope: 'openid email profile' };
const WEB_ARRIVAL = `${WEB_CALLBACK}?code=synthetic-code&state=synthetic-state-0123456789`;
// details: what getAuthorizationDetails answers. approveUrl: the redirect_url approveAuthorization answers. markReply: the central's answer to
// admin-reauth-mark (a function returning a Response or a promise). hold: return before the mount settles (for a note that never answers).
async function mount(t, { href, session = null, signOut = null, sessionAfterSignOut = null, store = memoryStore(), framed = false, preview = false,
  details = MESSENGER_DETAILS, approveUrl = WEB_ARRIVAL, markReply = null, hold = false } = {}) {
  const nodes = new Map(), events = new Map(), calls = [], destinations = [], historyUrls = [], marks = [], log = [];
  const get = id => { if (!nodes.has(id)) nodes.set(id, new Element());return nodes.get(id); };
  for (const id of ['auth-panel', 'consent', 'account', 'account-profile', 'setup', 'signup-choices', 'connection-restart']) get(id).hidden = true;
  get('email').value = 'synthetic@example.test';get('password').value = 'synthetic-password';
  const modes = ['login', 'signup', 'recover'].map(view => Object.assign(new Element('button'), { dataset: { view } }));
  let saved = session, listener, now = NOW, timerId = 0;
  const timers = new Map(), clock = { now: () => now, setTimeout: (fn, ms) => { timers.set(++timerId, { at: now + ms, fn });return timerId; }, clearTimeout: id => { timers.delete(id); },
    advance(ms) { now += ms;for (const [id, timer] of [...timers].sort((a, b) => a[1].at - b[1].at)) if (timer.at <= now) { timers.delete(id);timer.fn(); } } };
  const original = ['document', 'window', 'location', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  const location = { href, assign: value => { destinations.push(['assign', value]);log.push('assign'); }, replace: value => destinations.push(['replace', value]), reload() {} };
  Object.assign(globalThis, {
    document: { body: new Element(), getElementById: get, createElement: tag => new Element(tag), querySelectorAll: () => modes },
    window: { addEventListener: (name, fn) => events.set(name, fn), removeEventListener: (name, fn) => { if (events.get(name) === fn) events.delete(name); }, sessionStorage: store,
      history: { state: null, replaceState(_state, _title, url) { historyUrls.push(url);location.href = url; } }, ...(framed ? { top: {}, self: {} } : {}) },
    location,
    fetch: async (url, options = {}) => {
      const target = new URL(url);assert.equal(target.origin, AUTH);assert.equal(target.pathname, '/functions/v1/synk-account');
      if (options.method === 'POST') {
        marks.push({ search: target.search, headers: options.headers, signal: options.signal, body: JSON.parse(options.body) });log.push('mark');
        return markReply ? markReply() : new Response(JSON.stringify({ ok: true, marked: true }));
      }
      if (target.searchParams.get('view') === 'atlas') return new Response(JSON.stringify({ ok: true, shared: 'declared-only', learning: { enabled: false, revision: 1 }, summary: { reasons: [], presentation: null, practice: { answered: 0 }, forReasons: [] } }));
      return new Response(JSON.stringify(accountReply(saved?.user?.id)));
    },
  });
  t.after(() => { events.get('pagehide')?.({});for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor);else delete globalThis[key]; } });
  const sdk = { auth: {
    initialize: async () => ({}),
    onAuthStateChange: fn => { listener = fn;return {}; },
    getSession: async () => { calls.push('getSession');return { data: { session: saved } }; },
    getUser: async () => ({ data: { user: saved?.user } }),
    signOut: async options => {
      calls.push(['signOut', options]);
      if (signOut) return signOut({ clear: () => { saved = null; } });
      saved = sessionAfterSignOut;return { error: null };
    },
    signInWithPassword: async () => { calls.push('signInWithPassword');saved = sessionFor('account-a');return { data: { session: saved }, error: null }; },
    oauth: {
      getAuthorizationDetails: async id => { calls.push(['details', id]);return { data: details }; },
      approveAuthorization: async id => { calls.push(['approve', id]);return { data: { redirect_url: approveUrl } }; },
      denyAuthorization: async id => { calls.push(['deny', id]);return { data: { redirect_url: `${details?.redirect_uri || WEB_CALLBACK}?error=access_denied` } }; },
    },
  } };
  const mounting = mountPortal({ config, sdk, preview, cooldownClock: clock, loginSettings: { google: false, phone: false } });
  if (!hold) await mounting;
  await settle();
  return { get, calls, destinations, historyUrls, store, location, marks, log, clock, mounting, notice: get('notice'), mode: name => modes.find(button => button.dataset.view === name).onclick(),
    submit: async () => { await get('auth-form').onsubmit({ preventDefault() {} });await settle(); } };
}

test('a signed-in browser signs out locally, then leaves for the authorize address', async t => {
  const page = await mount(t, { href: reauthUrl(authorize()), session: sessionFor('account-a') });
  assert.deepEqual(page.calls, ['getSession', ['signOut', { scope: 'local' }], 'getSession']);
  assert.deepEqual(page.destinations, [['replace', authorize()]]);
  assert.equal(page.historyUrls.at(-1), PORTAL, 'reauth and next leave the address bar first');
  assert.deepEqual(JSON.parse(page.store.getItem(REAUTH_KEY)), { v: 1, clientId: 'messenger-web', until: NOW + REAUTH_TTL, authorizationId: null });
  assert.equal(page.notice.textContent, 'Workspace에서 다시 확인을 요청했어요. 로그인 화면으로 옮기고 있어요…');
  assert.equal(page.get('auth-panel').hidden, true);
});

test('a signed-out browser leaves at once', async t => {
  const page = await mount(t, { href: reauthUrl(authorize({ scope: 'openid profile' })) });
  assert.deepEqual(page.calls, ['getSession']);
  assert.deepEqual(page.destinations, [['replace', authorize({ scope: 'openid profile' })]]);
  assert.equal(JSON.parse(page.store.getItem(REAUTH_KEY)).clientId, 'messenger-web');
});

test('a sign-out whose server call fails still leaves once the session here is gone', async t => {
  // auth-js signOut({ scope: 'local' }) clears this browser's session even when Auth's logout call fails, and answers that error.
  const page = await mount(t, { href: reauthUrl(authorize()), session: sessionFor('account-a'), signOut: ({ clear }) => { clear();return { error: Object.assign(new Error('synthetic 500'), { status: 500 }) }; } });
  assert.deepEqual(page.calls, ['getSession', ['signOut', { scope: 'local' }], 'getSession']);
  assert.deepEqual(page.destinations, [['replace', authorize()]]);
});

for (const [name, options] of [
  ['sign-out throws', { signOut: async () => { throw new Error('synthetic offline'); } }],
  // auth-js keeps the session only when it cannot reach its own storage step (a lock or storage failure); a failed server call alone clears it.
  ['sign-out answers an error before clearing the session here', { signOut: async () => ({ error: Object.assign(new Error('synthetic storage lock'), { name: 'NavigatorLockAcquireTimeoutError' }) }) }],
  ['sign-out leaves a session behind', { sessionAfterSignOut: sessionFor('account-a') }],
]) test(`no trip when the session is not gone: ${name}`, async t => {
  const page = await mount(t, { href: reauthUrl(authorize()), session: sessionFor('account-a'), ...options });
  assert.equal(page.calls.filter(call => call[0] === 'signOut').length, 1);
  assert.deepEqual(page.destinations, [], 'following next with the old sign-in would send Workspace straight back');
  assert.equal(page.store.getItem(REAUTH_KEY), null);
  assert.equal(page.historyUrls.at(-1), PORTAL);
  assert.equal(page.get('account').hidden, false, 'the usual signed-in screen');
  assert.equal(page.notice.textContent, SIGNOUT_FAILED);
  assert.equal(page.notice.className, 'notice error');
});

for (const [name, href] of [
  ['other origin', reauthUrl(authorize({}, 'https://evil.example.test'))],
  ['javascript', reauthUrl('javascript:alert(1)')],
  ['double encoded', reauthUrl(encodeURIComponent(authorize()))],
  ['relative', reauthUrl('/auth/v1/oauth/authorize')],
  ['unregistered redirect', reauthUrl(authorize({ redirect_uri: 'https://evil.example.test/cb' }))],
  ['no next', `${PORTAL}?reauth=1`],
  ['two nexts', `${reauthUrl(authorize())}&next=${encodeURIComponent(authorize())}`],
  ['other reauth value', `${PORTAL}?reauth=true&next=${encodeURIComponent(authorize())}`],
]) test(`a refused next is never followed and nothing is signed out: ${name}`, async t => {
  const page = await mount(t, { href });
  assert.deepEqual(page.calls.filter(call => call[0] === 'signOut'), []);
  assert.deepEqual(page.destinations, []);
  assert.equal(page.store.getItem(REAUTH_KEY), null);
  assert.equal(page.historyUrls.at(-1), PORTAL);
  assert.equal(page.get('auth-panel').hidden, false, 'the usual sign-in screen');
  assert.equal(page.notice.textContent, REFUSED);
  assert.equal(page.notice.className, 'notice error');
  assert.equal(page.get('auth-copy').textContent, PLAIN_COPY);
});

test('a refused next keeps a signed-in account signed in', async t => {
  const page = await mount(t, { href: reauthUrl(authorize({ client_id: 'platform-web' })), session: sessionFor('account-a') });
  assert.deepEqual(page.calls.filter(call => call[0] === 'signOut'), []);
  assert.deepEqual(page.destinations, []);
  assert.equal(page.get('account').hidden, false);
  assert.equal(page.notice.textContent, REFUSED);
});

test('the address keeps its other parts, and a page that carries more is refused', async t => {
  const page = await mount(t, { href: `${reauthUrl(authorize())}&view=signup` });
  assert.deepEqual(page.destinations, []);
  assert.equal(page.historyUrls.at(-1), `${PORTAL}?view=signup`);
  assert.equal(page.notice.textContent, REFUSED);
});

test('a framed page never signs out or leaves', async t => {
  const framed = await mount(t, { href: reauthUrl(authorize()), framed: true });
  assert.deepEqual(framed.calls.filter(call => call[0] === 'signOut'), []);
  assert.deepEqual(framed.destinations, []);
  assert.equal(framed.notice.textContent, REFUSED);
});

test('the synthetic preview ignores the request', async t => {
  const preview = await mount(t, { href: reauthUrl(authorize()), preview: true });
  assert.deepEqual(preview.calls.filter(call => call[0] === 'signOut'), []);
  assert.deepEqual(preview.destinations, []);
  assert.notEqual(preview.notice.textContent, REFUSED);
});

test('back on the app request the login step says why, once, and the connection goes on as before', async t => {
  const store = memoryStore({ [REAUTH_KEY]: mark() });
  const page = await mount(t, { href: `${PORTAL}?authorization_id=auth-1`, store });
  assert.equal(page.get('auth-panel').hidden, false);
  assert.equal(page.get('auth-copy').textContent, LINE);
  assert.equal(JSON.parse(store.getItem(REAUTH_KEY)).authorizationId, 'auth-1');
  // Other steps keep their own words; the login step says it again.
  page.mode('signup');assert.notEqual(page.get('auth-copy').textContent, LINE);
  page.mode('login');assert.equal(page.get('auth-copy').textContent, LINE);
  await page.submit();
  assert.equal(store.getItem(REAUTH_KEY), null, 'used once');
  assert.deepEqual(page.calls.filter(call => Array.isArray(call) && ['details', 'approve'].includes(call[0])), [['details', 'auth-1'], ['approve', 'auth-1']]);
  assert.deepEqual(page.destinations, [['assign', WEB_ARRIVAL]]);
  assert.deepEqual(page.log, ['mark', 'assign']);
});

test('a reload of the same request still says it', async t => {
  const store = memoryStore({ [REAUTH_KEY]: mark({ authorizationId: 'auth-1' }) });
  const again = await mount(t, { href: `${PORTAL}?authorization_id=auth-1`, store });
  assert.equal(again.get('auth-copy').textContent, LINE);
  assert.equal(JSON.parse(store.getItem(REAUTH_KEY)).authorizationId, 'auth-1');
});

test('another app request does not say it and drops the mark', async t => {
  const store = memoryStore({ [REAUTH_KEY]: mark({ authorizationId: 'auth-1' }) });
  const other = await mount(t, { href: `${PORTAL}?authorization_id=auth-2`, store });
  assert.equal(other.get('auth-copy').textContent, PLAIN_COPY);
  assert.equal(store.getItem(REAUTH_KEY), null);
});

test('a mark older than five minutes does not say it and goes', async t => {
  const store = memoryStore({ [REAUTH_KEY]: mark({ until: NOW - 1 }) });
  const late = await mount(t, { href: `${PORTAL}?authorization_id=auth-1`, store });
  assert.equal(late.get('auth-copy').textContent, PLAIN_COPY);
  assert.equal(store.getItem(REAUTH_KEY), null);
});

test('the page without an app request does not say it', async t => {
  const store = memoryStore({ [REAUTH_KEY]: mark() });
  const home = await mount(t, { href: PORTAL, store });
  assert.equal(home.get('auth-copy').textContent, PLAIN_COPY);
  assert.notEqual(store.getItem(REAUTH_KEY), null, 'kept for the request still on its way');
});

test('a sign-in that left the page and came back without finishing keeps the line', async t => {
  const store = memoryStore({ [REAUTH_KEY]: mark({ authorizationId: 'auth-1' }) });
  const page = await mount(t, { href: `${PORTAL}?authorization_id=auth-1&google_flow=1&error=access_denied&error_description=cancelled`, store });
  assert.equal(page.get('auth-panel').hidden, false);
  assert.equal(page.get('auth-copy').textContent, LINE);
  assert.equal(page.notice.className, 'notice error');
  assert.equal(JSON.parse(store.getItem(REAUTH_KEY)).authorizationId, 'auth-1');
  assert.deepEqual(page.destinations, []);
});

// Workspace admin grants (관리자 직접 부여, Fable 설계 검토 P1-1): every Messenger approval this page receives is noted before the browser goes.
const PC_DETAILS = { client: { id: 'messenger-pc', name: 'Workspace' }, redirect_uri: PC_CALLBACK, scope: 'openid email profile' };
const PC_ARRIVAL = `${PC_CALLBACK}?code=synthetic-pc-code&state=synthetic-state-0123456789`;
const signedIn = { href: `${PORTAL}?authorization_id=auth-1`, session: sessionFor('account-a') };
const deferred = () => { let resolve;const promise = new Promise(done => { resolve = done; });return { promise, resolve }; };

test('an approval Auth gives at once (approved before) is noted, then the browser goes', async t => {
  const page = await mount(t, { ...signedIn, details: { redirect_url: WEB_ARRIVAL } });
  assert.equal(page.marks.length, 1);
  const [note] = page.marks;
  assert.deepEqual(note.body, { action: 'admin-reauth-mark', authorizationId: 'auth-1' });
  assert.equal(note.search, '');
  assert.equal(note.headers['X-SYNK-Product'], 'platform');
  assert.equal(note.headers['X-SYNK-Contract'], '1');
  assert.equal(note.headers.Authorization, 'Bearer synthetic-access-account-a');
  assert.equal(note.headers.apikey, 'sb_publishable_synthetic');
  assert.deepEqual(page.log, ['mark', 'assign']);
  assert.deepEqual(page.destinations, [['assign', WEB_ARRIVAL]]);
  assert.equal(page.calls.some(call => call[0] === 'approve'), false);
});

test('an approval made by 「연결하기」 is noted, then the browser goes', async t => {
  const page = await mount(t, { ...signedIn, details: PC_DETAILS, approveUrl: PC_ARRIVAL });
  assert.equal(page.get('consent').hidden, false);
  assert.deepEqual(page.marks, [], 'nothing is approved before the press');
  await page.get('approve').onclick();await settle();
  assert.deepEqual(page.marks.map(note => note.body), [{ action: 'admin-reauth-mark', authorizationId: 'auth-1' }]);
  assert.deepEqual(page.log, ['mark', 'assign']);
  assert.deepEqual(page.destinations, [['assign', PC_ARRIVAL]]);
});

test('an earlier approval for an address on this device is noted once, before its card', async t => {
  const page = await mount(t, { ...signedIn, details: { redirect_url: PC_ARRIVAL } });
  assert.equal(page.get('consent').hidden, false);
  assert.equal(page.marks.length, 1);
  await page.get('approve').onclick();await settle();
  assert.equal(page.marks.length, 1);
  assert.deepEqual(page.destinations, [['assign', PC_ARRIVAL]]);
});

for (const [name, options] of [
  ['another product approved now', { details: { client: { id: 'platform-web', name: 'SYNK 플랫폼' }, redirect_uri: PLATFORM_CALLBACK, scope: 'openid email profile' }, approveUrl: `${PLATFORM_CALLBACK}&code=synthetic-code&state=synthetic-state` }],
  ['another product approved before', { details: { redirect_url: `${PLATFORM_CALLBACK}&code=synthetic-code&state=synthetic-state` } }],
]) test(`no note for ${name}`, async t => {
  const page = await mount(t, { ...signedIn, ...options });
  assert.deepEqual(page.marks, []);
  assert.equal(page.destinations.length, 1);
  assert.equal(page.destinations[0][0], 'assign');
});

test('no note when the person presses 「취소」', async t => {
  const page = await mount(t, { ...signedIn, details: PC_DETAILS });
  await page.get('deny').onclick();await settle();
  assert.deepEqual(page.marks, []);
  assert.deepEqual(page.destinations, [['assign', `${PC_CALLBACK}?error=access_denied`]]);
});

test('no note in the synthetic preview', async t => {
  const page = await mount(t, { ...signedIn, preview: true });
  await page.get('approve').onclick();await settle();
  assert.deepEqual(page.marks, []);
  assert.deepEqual(page.destinations, [['assign', WEB_ARRIVAL]]);
});

for (const [name, markReply] of [
  ['the central refuses', () => new Response(JSON.stringify({ ok: false, error: { code: 'REAUTH_UNAVAILABLE' } }), { status: 503 })],
  ['the connection fails', () => { throw new TypeError('synthetic offline'); }],
  ['the answer is not JSON', () => new Response('<html>', { status: 502 })],
]) test(`the browser still goes when ${name}`, async t => {
  const page = await mount(t, { ...signedIn, details: { redirect_url: WEB_ARRIVAL }, markReply });
  assert.equal(page.marks.length, 1);
  assert.deepEqual(page.destinations, [['assign', WEB_ARRIVAL]]);
  assert.equal(page.notice.className, 'notice', 'no error is shown');
});

test('the browser goes after four seconds when the note does not answer', async t => {
  const wait = deferred();
  const page = await mount(t, { ...signedIn, details: { redirect_url: WEB_ARRIVAL }, markReply: () => wait.promise, hold: true });
  assert.equal(page.marks.length, 1);
  assert.deepEqual(page.destinations, []);
  page.clock.advance(ADMIN_REAUTH_MARK_WAIT - 1);await settle();
  assert.deepEqual(page.destinations, []);
  page.clock.advance(1);await settle();
  assert.deepEqual(page.destinations, [['assign', WEB_ARRIVAL]]);
  assert.equal(page.marks[0].signal.aborted, true, 'the late note is called off');
  await page.mounting;
  wait.resolve(new Response(JSON.stringify({ ok: true, marked: true })));await settle();
  assert.equal(page.destinations.length, 1);
});
