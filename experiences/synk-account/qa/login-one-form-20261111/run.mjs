// SYNK ID sign-in: Google and e-mail as one pair of buttons (2026-11-11), end to end on this PC — the built portal
// bundle (dist/app.js with the real supabase-js) against a synthetic Auth + account server on 127.0.0.1, in the
// installed Chrome. No production project, real account, mail or password is involved.
//   node experiences/synk-account/qa/login-one-form-20261111/run.mjs <playwright module dir> <out dir>
// SYNK_QA_FILES=<dir> serves a publishing candidate (id__index.html, id__style.css or id__id.css, id__dist__app.js) instead of this checkout.
// SYNK_QA_GOOGLE=off answers the settings request without Google (the e-mail-only state).
// Prints one JSON line per check and writes screenshots (1440 and 390 wide) to <out dir>.
// It also walks the sign-in that ends in an app (authorization_id): a web app, an app on this PC, one approved before, a gone request.
// The synthetic servers follow ../login-ux-20261027/run.mjs, with the Google round trip added (authorize → code → PKCE token).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const [playwrightDir, outDir] = process.argv.slice(2);
if (!playwrightDir || !outDir) throw new Error('usage: run.mjs <playwright module dir> <out dir>');
const { chromium } = createRequire(import.meta.url)(path.resolve(playwrightDir));
const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
fs.mkdirSync(outDir, { recursive: true });
const googleOn = process.env.SYNK_QA_GOOGLE !== 'off';

// --- synthetic Auth (GoTrue-shaped) and account server -------------------------------------------
const now = () => Math.floor(Date.now() / 1000);
const users = new Map([
  ['a', { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'member-a@synthetic.test', password: 'synthetic-pass-a1', identities: ['email'], name: '합성 회원 A', revision: 1 }],
  ['g', { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', email: 'member-g@synthetic.test', password: 'synthetic-pass-g1', identities: ['google'], name: '합성 회원 G', revision: 1 }],
]);
const sessions = new Map(), log = [], codes = new Set();
// App connections (authorization_id): a web app, an app on this PC, one on this PC that was approved before, and one that is gone.
// The page published on 11-11 also carries master's 「이 PC 앱 연결은 한 번 누름」, so the sign-in that ends in an app is checked here too.
const WEB_ARRIVAL = 'https://synthetic-app.invalid/client.html?product=world', DEVICE_ARRIVAL = 'http://127.0.0.1:43999/synk/oauth/messenger/callback';
const CLIENTS = { clients: { world: { clientId: 'synthetic-world', redirectUri: WEB_ARRIVAL } }, authorizationClients: [{ product: 'messenger', clientId: 'synthetic-desktop', redirectUris: [DEVICE_ARRIVAL] }] };
const authorizations = new Map([
  ['web-1', { client: { id: 'synthetic-world', name: '합성 WORLD' }, redirect_uri: WEB_ARRIVAL, scope: 'openid email profile' }],
  ['device-1', { client: { id: 'synthetic-desktop', name: '합성 Workspace' }, redirect_uri: DEVICE_ARRIVAL, scope: 'openid email profile' }],
  ['device-approved', { redirect_url: DEVICE_ARRIVAL + '?code=synthetic-approved-code&state=synthetic-state' }],
]);
const userJson = key => { const u = users.get(key);return { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, created_at: '2026-10-01T00:00:00Z', app_metadata: { provider: u.identities[0], providers: u.identities }, user_metadata: {},
  identities: u.identities.map(provider => ({ id: u.id + provider, user_id: u.id, provider, identity_data: { email: u.email, sub: u.id }, created_at: '2026-10-01T00:00:00Z' })) }; };
const issue = key => { const access = 'synthetic-access-' + crypto.randomUUID(), refresh = 'synthetic-refresh-' + crypto.randomUUID();
  sessions.set(access, { key, refresh, live: true });return { access_token: access, refresh_token: refresh, token_type: 'bearer', expires_in: 3600, expires_at: now() + 3600, user: userJson(key) }; };
const bearer = req => sessions.get((req.headers.authorization || '').replace(/^Bearer /, ''));
const send = (res, status, body, extra = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'x-supabase-api-version', 'x-supabase-api-version': '2024-01-01', ...extra });res.end(body === undefined ? '' : JSON.stringify(body)); };
const fail = (res, status, code, message) => send(res, status, { code, error_code: code, msg: message, message });
const auth = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS', 'Access-Control-Max-Age': '600' });res.end();return; }
  const url = new URL(req.url, 'http://127.0.0.1');let body = '';for await (const chunk of req) body += chunk;const data = body ? JSON.parse(body) : {};
  const session = bearer(req);log.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body: data, user: session?.key || null });
  if (url.pathname === '/auth/v1/settings') return send(res, 200, { external: { email: true, google: googleOn }, disable_signup: false });
  // The Google round trip: the provider page is skipped, the code comes straight back to the page that asked.
  if (url.pathname === '/auth/v1/authorize' && url.searchParams.get('provider') === 'google') {
    const back = new URL(url.searchParams.get('redirect_to')), code = 'synthetic-code-' + crypto.randomUUID();codes.add(code);back.searchParams.set('code', code);
    res.writeHead(302, { Location: back.href });res.end();return;
  }
  const connect = url.pathname.match(/^\/auth\/v1\/oauth\/authorizations\/([\w-]+)(\/consent)?$/);
  if (connect) {
    if (!session?.live) return fail(res, 401, 'session_not_found', 'Session not found');
    const record = authorizations.get(connect[1]);
    if (!record) return fail(res, 404, 'oauth_authorization_not_found', 'authorization not found');
    if (!connect[2]) return send(res, 200, { authorization_id: connect[1], ...record, user: { id: users.get(session.key).id, email: users.get(session.key).email } });
    const back = new URL(record.redirect_uri);back.searchParams.set(...(data.action === 'approve' ? ['code', 'synthetic-consent-code'] : ['error', 'access_denied']));back.searchParams.set('state', 'synthetic-state');
    return send(res, 200, { redirect_url: back.href });
  }
  if (url.pathname === '/auth/v1/token') {
    if (url.searchParams.get('grant_type') === 'password') {
      const key = [...users].find(([, u]) => u.email === data.email)?.[0];
      if (!key || users.get(key).password !== data.password || !users.get(key).identities.includes('email')) return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, { 'x-supabase-api-version': '' });
      return send(res, 200, issue(key));
    }
    if (url.searchParams.get('grant_type') === 'pkce') {
      if (!codes.delete(data.auth_code) || !data.code_verifier) return fail(res, 400, 'flow_state_not_found', 'invalid flow state');
      return send(res, 200, issue('g'));
    }
    const old = [...sessions].find(([, s]) => s.refresh === data.refresh_token && s.live);if (!old) return fail(res, 400, 'refresh_token_not_found', 'Invalid Refresh Token');
    old[1].live = false;return send(res, 200, issue(old[1].key));
  }
  if (url.pathname === '/auth/v1/user') { if (!session?.live) return fail(res, 401, 'session_not_found', 'Session not found');return send(res, 200, userJson(session.key)); }
  if (url.pathname === '/auth/v1/logout') { if (session) session.live = false;res.writeHead(204, { 'Access-Control-Allow-Origin': '*' });res.end();return; }
  if (url.pathname === '/auth/v1/recover' || url.pathname === '/auth/v1/resend') return send(res, 200, {});
  if (url.pathname === '/auth/v1/signup') return send(res, 200, { id: crypto.randomUUID(), email: data.email, confirmation_sent_at: new Date().toISOString(), identities: [{ provider: 'email' }] });
  if (url.pathname === '/functions/v1/synk-account') {
    if (!session?.live) return send(res, 401, { ok: false, error: { code: 'AUTH_REQUIRED' } });
    const u = users.get(session.key), view = url.searchParams.get('view');
    if (view === 'registration') return send(res, 200, { ok: true, registration: { required: false, completed: true, phoneVerificationRequired: false } });
    if (view === 'atlas') return send(res, 200, { ok: true, shared: 'declared-only', learning: { enabled: false, revision: 1 }, summary: { reasons: [], presentation: null, practice: { answered: 0, independent: 0, assisted: 0, skills: [] }, forReasons: [] } });
    if (req.method === 'POST') return send(res, 200, { ok: true, current: false, refreshRevoked: true, legacyAccessGuard: true });
    return send(res, 200, { ok: true, account: { synk_user_id: u.id, status: 'active', profile: { display_name: u.name }, profile_revision: u.revision, providers: u.identities }, memberships: [], entitlements: [], learning: { enabled: false, revision: 1 }, capabilities: { learningSync: true },
      sessions: [{ id: `${session.key}-current`, product: 'platform', label: '', current: true, revoked: false, last_seen: new Date().toISOString() }], dataRequests: [] });
  }
  send(res, 404, { code: 'not_found' });
});
// --- the portal's own files from this checkout (or a publishing candidate), with a loopback config -----
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml' };
let config = null;
const portal = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  if (pathname === '/config.json') { res.writeHead(200, { 'Content-Type': 'application/json' });res.end(JSON.stringify(config));return; }
  const candidate = process.env.SYNK_QA_FILES && { '/': 'id__index.html', '/index.html': 'id__index.html', '/style.css': 'id__style.css', '/id.css': 'id__id.css', '/dist/app.js': 'id__dist__app.js' }[pathname];
  if (candidate) { res.writeHead(200, { 'Content-Type': types[candidate === 'id__dist__app.js' ? '.js' : /.css$/.test(candidate) ? '.css' : '.html'] });res.end(fs.readFileSync(path.join(process.env.SYNK_QA_FILES, candidate)));return; }
  const file = path.join(portalRoot, pathname === '/' ? 'index.html' : pathname);
  if (!file.startsWith(portalRoot) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404);res.end('missing');return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });res.end(fs.readFileSync(file));
});
const listen = (server, port = 0) => new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve(server.address().port)));
const authPort = await listen(auth, Number(process.env.SYNK_QA_AUTH_PORT) || 0), portalPort = await listen(portal, Number(process.env.SYNK_QA_PORT) || 0), base = `http://127.0.0.1:${portalPort}/`, localAuth = `http://127.0.0.1:${authPort}`;
// The portal sends a Google sign-in only to an https Auth address (google-auth.mjs googleDestination), so the checks give it
// an https name that the browser context answers from the loopback server. A look by hand (SYNK_QA_SERVE=1) talks to the
// loopback server directly: everything but the Google press works there.
const authBase = process.env.SYNK_QA_SERVE ? localAuth : 'https://synthetic-auth.invalid';
config = { version: 1, supabaseUrl: authBase, accountApiUrl: authBase, supabasePublishableKey: 'sb_publishable_synthetic_local', portalUrl: base, learningUrl: base, ...CLIENTS };
if (process.env.SYNK_QA_SERVE) { console.log(JSON.stringify({ serving: base, auth: authBase, google: googleOn }));await new Promise(() => {}); }
const PASSED = ['authorization', 'apikey', 'content-type', 'x-client-info', 'x-supabase-api-version', 'access-control-request-headers', 'access-control-request-method', 'x-synk-contract', 'x-synk-product', 'x-synk-app-version'];
async function relay(route) {
  const request = route.request(), target = new URL(request.url()), method = request.method();
  const headers = Object.fromEntries(Object.entries(request.headers()).filter(([name]) => PASSED.includes(name)));
  const response = await fetch(localAuth + target.pathname + target.search, { method, headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(method) ? undefined : request.postData() ?? undefined, redirect: 'manual' });
  // The synthetic provider step answers with a redirect; a page that goes there keeps the browser on a real navigation.
  if (response.status === 302) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><script>location.replace(${JSON.stringify(response.headers.get('location'))})</script>` });
  return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
}

const results = [];
const check = (name, ok, details = {}) => { results.push({ name, ok: !!ok, ...details });console.log(JSON.stringify({ name, ok: !!ok, ...details })); };
const browser = await chromium.launch({ channel: process.env.SYNK_QA_CHANNEL || 'chrome' });
async function page(width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: width > 500 ? 1000 : 844 } });await context.route(authBase + '/**', relay);
  for (const arrival of [WEB_ARRIVAL, DEVICE_ARRIVAL]) await context.route(new URL(arrival).origin + '/**', route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><title>synthetic arrival</title>' }));
  const tab = await context.newPage(), errors = [];
  tab.on('pageerror', error => errors.push(String(error).slice(0, 200)));tab.on('console', message => {
    if (message.type() === 'error' && !/atlas-learning|404|status of (?:400|401|403|422)/.test(message.text())) errors.push(message.text().slice(0, 200)); });
  return { context, tab, errors };
}
const shot = async (tab, name, fullPage = true) => { await tab.screenshot({ path: path.join(outDir, name + '.png'), fullPage });return name + '.png'; };
const visible = (tab, selector) => tab.isVisible(selector);
const textOf = (tab, selector) => tab.textContent(selector).then(value => (value || '').trim());
const overflow = tab => tab.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
const recentStored = tab => tab.evaluate(() => JSON.parse(localStorage.getItem('synk.id.recent-login.v1:/') || 'null'));
// What makes the two buttons 「the same form」: box, type, colours, and where the mark and the words sit inside.
const pair = tab => tab.evaluate(() => ['google-login', 'email-method'].map(id => {
  const node = document.getElementById(id), box = node.getBoundingClientRect(), style = getComputedStyle(node);
  const mark = node.querySelector('.method-mark').getBoundingClientRect(), label = node.querySelector('.method-label').getBoundingClientRect();
  return { width: Math.round(box.width), height: Math.round(box.height), left: Math.round(box.left), font: `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`, color: style.color, background: style.backgroundColor, border: `${style.borderTopWidth} ${style.borderTopColor}`, radius: style.borderTopLeftRadius,
    markLeft: Math.round(mark.left - box.left), markSize: `${Math.round(mark.width)}x${Math.round(mark.height)}`, labelLeft: Math.round(label.left - box.left), text: node.querySelector('.method-label').textContent.trim() };
}));
const same = (a, b, keys) => keys.every(key => a[key] === b[key]);
const SHAPE = ['width', 'height', 'left', 'font', 'color', 'background', 'border', 'radius', 'markLeft', 'markSize', 'labelLeft'];
async function open(tab) { await tab.goto(base, { waitUntil: 'networkidle' });await tab.waitForSelector('#auth-panel:not([hidden])');await tab.waitForFunction(() => !document.getElementById('google-availability').textContent.includes('확인하고'));
  // The Google button eases from its waiting colours (.15s); measure once it has settled.
  await tab.waitForTimeout(300); }
async function signOut(tab) { await tab.click('#account-profile [data-profile-action="logout"], #account-profile button:has-text("로그아웃")');await tab.waitForSelector('#auth-panel:not([hidden])');await tab.waitForFunction(() => /로그아웃했어요/.test(document.getElementById('notice').textContent)); }
try {
  if (!googleOn) {
    // Google off: the e-mail fields are simply there, and the page says why one button waits.
    for (const width of [1440, 390]) {
      const { context, tab, errors } = await page(width);await open(tab);
      check(`without Google the e-mail fields are open and the page says so (${width})`, await visible(tab, '#email') && await visible(tab, '#auth-submit') && await tab.isDisabled('#google-login') && await tab.getAttribute('#email-method', 'aria-expanded') === 'true'
        && /Google 로그인을 쓸 수 없어요/.test(await textOf(tab, '#google-availability')) && await textOf(tab, '#auth-heading') === '이메일로 로그인해요.' && !await visible(tab, '#google-privacy-note') && await overflow(tab) === 0, { screenshot: await shot(tab, `g0-no-google-${width}`) });
      await tab.fill('#email', users.get('a').email);await tab.fill('#password', users.get('a').password);await tab.click('#auth-submit');await tab.waitForSelector('#account-profile:not([hidden])');
      check(`without Google the password sign-in still reaches the account (${width})`, (await recentStored(tab))?.method === 'email' && !errors.length, { errors });
      await context.close();
    }
  } else for (const width of [1440, 390]) {
    const { context, tab, errors } = await page(width);
    // 1. First visit: the two ways are one pair — same box, same type, same place for mark and words — and nothing else asks to be filled in.
    await open(tab);
    const [g, e] = await pair(tab);
    check(`first visit shows two ways of the same form (${width})`, same(g, e, SHAPE) && g.text === 'Google로 로그인' && e.text === '이메일로 로그인' && g.height >= 48
      && !await visible(tab, '#email') && !await visible(tab, '#password') && !await visible(tab, '#auth-submit') && !await visible(tab, '#recent-login') && await tab.getAttribute('#email-method', 'aria-expanded') === 'false'
      && await textOf(tab, '#auth-heading') === '로그인 방법을 골라 주세요.' && await textOf(tab, '#google-availability') === '' && await visible(tab, '#google-privacy-note') && await textOf(tab, '#switch-copy') === '처음이세요?'
      && await tab.getAttribute('#notice', 'data-kind') === 'idle' && await overflow(tab) === 0, { google: g, email: e, screenshot: await shot(tab, `1-first-visit-${width}`) });
    // 2. E-mail: one press opens its fields under the pair and puts the keyboard in the first one; a second press folds them.
    await tab.click('#email-method');
    const opened = await visible(tab, '#email') && await visible(tab, '#password') && await visible(tab, '#auth-submit') && await visible(tab, '#forgot-row') && await tab.getAttribute('#email-method', 'aria-expanded') === 'true'
      && await tab.evaluate(() => document.activeElement?.id) === 'email' && await textOf(tab, '#auth-submit') === '로그인';
    const [g2, e2] = await pair(tab), stillPair = same(g2, e2, ['width', 'height', 'left', 'font', 'radius', 'markLeft', 'markSize', 'labelLeft']);
    const openShot = await shot(tab, `2-email-open-${width}`);
    await tab.click('#email-method');const folded = !await visible(tab, '#email') && await tab.getAttribute('#email-method', 'aria-expanded') === 'false';await tab.click('#email-method');
    check(`「이메일로 로그인」 opens its fields under the pair, and folds again (${width})`, opened && stillPair && folded && await visible(tab, '#email') && await overflow(tab) === 0, { opened, stillPair, folded, screenshot: openShot });
    // 3. A wrong password names the other way by the words on its button.
    await tab.fill('#email', users.get('a').email);await tab.fill('#password', 'synthetic-wrong');await tab.click('#auth-submit');await tab.waitForFunction(() => /맞지 않아요/.test(document.getElementById('notice').textContent));
    check(`a wrong password points to 「Google로 로그인」 (${width})`, /「Google로 로그인」/.test(await textOf(tab, '#notice')) && !/계속하기/.test(await tab.evaluate(() => document.body.innerText)), { screenshot: await shot(tab, `3-wrong-password-${width}`, false) });
    // 4. Signing in by e-mail, then coming back: the e-mail way is marked and already open, with the address filled in.
    await tab.fill('#password', users.get('a').password);await tab.click('#auth-submit');await tab.waitForSelector('#account-profile:not([hidden])');
    const storedEmail = await recentStored(tab);await signOut(tab);
    check(`after an e-mail sign-in the e-mail way is marked and open (${width})`, storedEmail?.method === 'email' && await visible(tab, '#email-recent') && !await visible(tab, '#google-recent') && await visible(tab, '#email')
      && await tab.inputValue('#email') === users.get('a').email && await tab.getAttribute('#email-method', 'aria-expanded') === 'true' && await textOf(tab, '#auth-heading') === '다시 오셨네요.' && await overflow(tab) === 0, { screenshot: await shot(tab, `4-recent-email-${width}`) });
    // 5. Sign-up is the same pair with the same words turned: 「○○로 가입」; e-mail sign-up asks its own questions.
    await tab.click('#switch-row [data-view="signup"]');
    const [gs, es] = await pair(tab);
    // The e-mail way was open and stays open here, so its button carries the chosen look; the box and the insides still match.
    const signupPair = gs.text === 'Google로 가입' && es.text === '이메일로 가입' && same(gs, es, ['width', 'height', 'left', 'font', 'radius', 'markLeft', 'markSize', 'labelLeft']) && await textOf(tab, '#auth-heading') === '가입 방법을 골라 주세요.' && await textOf(tab, '#switch-copy') === '이미 계정이 있나요?';
    const signupShot = await shot(tab, `5-signup-${width}`);
    if (!await visible(tab, '#email')) await tab.click('#email-method');
    check(`sign-up is the same pair, 「Google로 가입」 and 「이메일로 가입」 (${width})`, signupPair && await visible(tab, '#signup-choices') && await textOf(tab, '#auth-submit') === '가입하기' && await tab.getAttribute('#email', 'autocomplete') === 'email' && await overflow(tab) === 0,
      { google: gs.text, email: es.text, screenshot: signupShot, open: await shot(tab, `5b-signup-email-${width}`) });
    // 6. 「비밀번호를 잊었어요」 is an e-mail step with no pair; the way back lands on the e-mail fields.
    await tab.click('#switch-row [data-view="login"]');if (!await visible(tab, '#email')) await tab.click('#email-method');
    await tab.click('#forgot-row [data-view="recover"]');
    const recover = !await visible(tab, '#method-choices') && await visible(tab, '#email') && !await visible(tab, '#password') && /「Google로 로그인」/.test(await textOf(tab, '#auth-copy')) && !await visible(tab, '#google-privacy-note');
    const recoverShot = await shot(tab, `6-recover-${width}`);
    await tab.click('#switch-row [data-view="login"]');
    check(`the password step has no pair, and coming back keeps the e-mail fields (${width})`, recover && await visible(tab, '#method-choices') && await visible(tab, '#email') && await visible(tab, '#password'), { screenshot: recoverShot });
    // 7. Google: the same kind of press goes out to Google and comes back signed in; next time the Google way is marked and the e-mail fields stay folded.
    await tab.evaluate(() => localStorage.clear());await open(tab);
    const before = log.length;
    await tab.click('#google-login');await tab.waitForSelector('#account-profile:not([hidden])');
    const asked = log.slice(before).find(row => row.path === '/auth/v1/authorize'), storedGoogle = await recentStored(tab);
    await signOut(tab);
    check(`「Google로 로그인」 signs in, and next time it carries 「최근 사용」 (${width})`, asked?.query.provider === 'google' && storedGoogle?.method === 'google' && await visible(tab, '#google-recent') && !await visible(tab, '#email-recent')
      && !await visible(tab, '#email') && await tab.getAttribute('#email-method', 'aria-expanded') === 'false' && same(...await pair(tab), ['width', 'height', 'left', 'font', 'markLeft', 'labelLeft']) && await overflow(tab) === 0, { screenshot: await shot(tab, `7-recent-google-${width}`) });
    // 8. Keyboard: Tab reaches the two ways one after the other, and Enter on the e-mail way opens its fields.
    await tab.evaluate(() => localStorage.clear());await open(tab);
    await tab.focus('#google-login');await tab.keyboard.press('Tab');const second = await tab.evaluate(() => document.activeElement?.id);await tab.keyboard.press('Enter');
    check(`keyboard: the two ways follow each other, Enter opens e-mail (${width})`, second === 'email-method' && await visible(tab, '#email') && await tab.evaluate(() => document.activeElement?.id) === 'email', { second });
    // 9. App connections. Signed out with an app waiting: the same pair, and the e-mail way signs in and goes on to the app.
    //    A web app is connected without another press (as before); an app on this PC names the account and waits for 「연결하기」.
    await tab.evaluate(() => localStorage.clear());await tab.goto(base + '?authorization_id=web-1', { waitUntil: 'networkidle' });await tab.waitForSelector('#auth-panel:not([hidden])');
    const [gc, ec] = await pair(tab), pairWithApp = same(gc, ec, ['width', 'height', 'left', 'font', 'radius', 'markLeft', 'markSize', 'labelLeft']) && gc.text === 'Google로 로그인' && ec.text === '이메일로 로그인' && !await visible(tab, '#consent');
    await tab.click('#email-method');await tab.fill('#email', users.get('a').email);await tab.fill('#password', users.get('a').password);
    await Promise.all([tab.waitForURL(url => url.origin === new URL(WEB_ARRIVAL).origin), tab.click('#auth-submit')]);
    const web = new URL(tab.url());
    check(`signing in for a web app goes straight on to that app (${width})`, pairWithApp && web.pathname === '/client.html' && web.searchParams.get('code') === 'synthetic-consent-code' && web.searchParams.get('product') === 'world', { arrived: web.origin + web.pathname });
    // Still signed in here: an app on this PC shows the card with the account and does nothing until the press.
    const consentBefore = log.length;
    await tab.goto(base + '?authorization_id=device-1', { waitUntil: 'networkidle' });await tab.waitForSelector('#consent:not([hidden])');await tab.waitForTimeout(600);
    const waited = !log.slice(consentBefore).some(row => /\/consent$/.test(row.path)) && new URL(tab.url()).origin === new URL(base).origin
      && await textOf(tab, '#consent-account') === `로그인한 계정: ${users.get('a').email}` && await visible(tab, '#consent-native') && !await visible(tab, '#auth-panel') && await overflow(tab) === 0;
    const deviceShot = await shot(tab, `9-device-consent-${width}`);
    await Promise.all([tab.waitForURL(url => url.href.startsWith(DEVICE_ARRIVAL)), tab.click('#approve')]);
    const device = new URL(tab.url());
    check(`an app on this PC names the account and waits for 「연결하기」 (${width})`, waited && device.searchParams.get('code') === 'synthetic-consent-code', { waited, screenshot: deviceShot });
    // Approved before, on this PC: no silent hand-over either; 「취소」 answers the app with a refusal and no code.
    await tab.goto(base + '?authorization_id=device-approved', { waitUntil: 'networkidle' });await tab.waitForSelector('#consent:not([hidden])');await tab.waitForTimeout(600);
    const held = new URL(tab.url()).origin === new URL(base).origin && !/synthetic-approved-code/.test(await textOf(tab, '#consent-destination'));
    await Promise.all([tab.waitForURL(url => url.href.startsWith(DEVICE_ARRIVAL)), tab.click('#deny')]);
    const refused = new URL(tab.url());
    check(`an app on this PC approved before still waits, and 「취소」 sends no code (${width})`, held && refused.searchParams.get('error') === 'access_denied' && !refused.searchParams.has('code') && refused.searchParams.get('state') === 'synthetic-state', { held });
    // A request that is gone: signed in, the restart card and no sign-in form.
    await tab.goto(base + '?authorization_id=gone-1', { waitUntil: 'networkidle' });await tab.waitForSelector('#connection-restart:not([hidden])');
    check(`a gone app request shows the restart card, not the pair (${width})`, !await visible(tab, '#auth-panel') && !await visible(tab, '#consent'));
    check(`no page errors (${width})`, !errors.length, { errors });
    await context.close();
  }
} finally {
  await browser.close();auth.close();portal.close();
  const failed = results.filter(result => !result.ok);
  fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify({ google: googleOn, candidate: process.env.SYNK_QA_FILES || null, passed: results.length - failed.length, total: results.length, results }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: results.length - failed.length, total: results.length }));
  if (failed.length) process.exitCode = 1;
}
