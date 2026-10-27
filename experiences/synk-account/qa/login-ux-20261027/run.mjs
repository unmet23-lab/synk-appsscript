// SYNK ID sign-in and 「내 계정」 convenience pass (2026-10-27), end to end on this PC: the built portal bundle
// (dist/app.js with the real supabase-js) against a synthetic Auth + account server on 127.0.0.1, in the installed Chrome.
// No production project, real account, mail or password is involved.
//   node experiences/synk-account/qa/login-ux-20261027/run.mjs <playwright module dir> <out dir>
// SYNK_QA_FILES=<dir> serves a publishing candidate (id__index.html, id__style.css, id__dist__app.js) instead of this checkout.
// Prints one JSON line per check and writes screenshots (1440 and 390 wide) to <out dir>.
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

// --- synthetic Auth (GoTrue-shaped) and account server -------------------------------------------
const now = () => Math.floor(Date.now() / 1000);
const users = new Map([
  ['a', { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'member-a@synthetic.test', password: 'synthetic-pass-a1', identities: ['email'], name: '합성 회원 A', revision: 1 }],
  ['g', { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', email: 'member-g@synthetic.test', password: 'synthetic-pass-g1', identities: ['google'], name: '', revision: 1 }],
  ['u', { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', email: 'member-u@synthetic.test', password: 'synthetic-pass-u1', identities: ['email'], name: '확인 전 회원', unconfirmed: true, revision: 1 }],
]);
const recoveryTokens = new Map([['pkce_' + 'a1'.repeat(28), 'a']]);
const sessions = new Map(), log = [], revoked = new Set();
// Forty account-server rows the way a long-used account has them: many products, many ended.
const accountRows = key => Array.from({ length: 40 }, (_, n) => ({ id: `${key}-row-${String(n).padStart(2, '0')}`, product: ['platform', 'messenger', 'world'][n % 3], label: '', current: false,
  revoked: n % 4 === 3 || revoked.has(`${key}-row-${String(n).padStart(2, '0')}`), last_seen: new Date(Date.now() - n * 3600_000 * 7).toISOString() }));
const userJson = key => { const u = users.get(key);return { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, ...(u.newEmail ? { new_email: u.newEmail } : {}), created_at: '2026-10-01T00:00:00Z', app_metadata: { provider: u.identities[0], providers: u.identities }, user_metadata: {},
  identities: u.identities.map(provider => ({ id: u.id + provider, user_id: u.id, provider, identity_data: { email: u.email, sub: u.id }, created_at: '2026-10-01T00:00:00Z' })) }; };
const issue = (key, kind) => { const access = 'synthetic-access-' + crypto.randomUUID(), refresh = 'synthetic-refresh-' + crypto.randomUUID();
  sessions.set(access, { key, kind, refresh, live: true });return { access_token: access, refresh_token: refresh, token_type: 'bearer', expires_in: 3600, expires_at: now() + 3600, user: userJson(key) }; };
const bearer = req => sessions.get((req.headers.authorization || '').replace(/^Bearer /, ''));
const send = (res, status, body, extra = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'x-supabase-api-version', 'x-supabase-api-version': '2024-01-01', ...extra });res.end(body === undefined ? '' : JSON.stringify(body)); };
const fail = (res, status, code, message) => send(res, status, { code, error_code: code, msg: message, message });
const auth = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS', 'Access-Control-Max-Age': '600' });res.end();return; }
  const url = new URL(req.url, 'http://127.0.0.1');let body = '';for await (const chunk of req) body += chunk;const data = body ? JSON.parse(body) : {};
  const session = bearer(req);log.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body: data, token: session ? session.kind : null, user: session?.key || null });
  if (url.pathname === '/auth/v1/settings') return send(res, 200, { external: { email: true, google: true }, disable_signup: false });
  if (url.pathname === '/auth/v1/verify' && req.method === 'POST') {
    const key = recoveryTokens.get(data.token_hash);if (data.type !== 'recovery' || !key) return fail(res, 403, 'otp_expired', 'Email link is invalid or has expired');
    recoveryTokens.delete(data.token_hash);return send(res, 200, issue(key, 'recovery'));
  }
  if (url.pathname === '/auth/v1/token') {
    if (url.searchParams.get('grant_type') === 'password') {
      const key = [...users].find(([, u]) => u.email === data.email)?.[0];
      if (!key || users.get(key).password !== data.password) return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, { 'x-supabase-api-version': '' });
      if (users.get(key).unconfirmed) return send(res, 400, { code: 400, error_code: 'email_not_confirmed', msg: 'Email not confirmed' });
      return send(res, 200, issue(key, req.headers['x-client-info'] ? 'browser' : 'check'));
    }
    const old = [...sessions].find(([, s]) => s.refresh === data.refresh_token && s.live);if (!old) return fail(res, 400, 'refresh_token_not_found', 'Invalid Refresh Token');
    old[1].live = false;return send(res, 200, issue(old[1].key, old[1].kind));
  }
  if (url.pathname === '/auth/v1/resend') return send(res, 200, {});
  if (url.pathname === '/auth/v1/user') {
    if (!session?.live) return fail(res, 401, 'session_not_found', 'Session not found');
    const u = users.get(session.key);
    if (req.method === 'PUT' && data.password) { if (data.password === u.password) return fail(res, 422, 'same_password', 'New password should be different from the old password.');u.password = data.password; }
    if (req.method === 'PUT' && data.email) u.newEmail = data.email;
    return send(res, 200, userJson(session.key));
  }
  if (url.pathname === '/auth/v1/logout') { if (session) session.live = false;res.writeHead(204, { 'Access-Control-Allow-Origin': '*' });res.end();return; }
  if (url.pathname === '/auth/v1/recover') return send(res, 200, {});
  if (url.pathname === '/functions/v1/synk-account') {
    if (!session?.live) return send(res, 401, { ok: false, error: { code: 'AUTH_REQUIRED' } });
    const u = users.get(session.key), view = url.searchParams.get('view');
    if (view === 'registration') return send(res, 200, { ok: true, registration: { required: false, completed: true, phoneVerificationRequired: false } });
    if (view === 'atlas') return send(res, 200, { ok: true, shared: 'declared-only', learning: { enabled: false, revision: 1 }, summary: { reasons: ['travel'], presentation: null, practice: { answered: 6, independent: 2, assisted: 4, skills: [] }, forReasons: [] } });
    if (req.method === 'POST' && data.action === 'profile-update') { if (data.expected_profile_revision !== u.revision) return send(res, 409, { ok: false, error: { code: 'PROFILE_CONFLICT' } });u.name = data.profile.display_name;u.revision++;return send(res, 200, { ok: true, account: { synk_user_id: u.id, status: 'active', profile: { display_name: u.name }, profile_revision: u.revision, providers: u.identities } }); }
    if (req.method === 'POST' && data.action === 'revoke-session') { revoked.add(data.session_id);return send(res, 200, { ok: true, current: false, refreshRevoked: true }); }
    if (req.method === 'POST') return send(res, 200, { ok: true, current: false, refreshRevoked: true, legacyAccessGuard: true });
    return send(res, 200, { ok: true, account: { synk_user_id: u.id, status: 'active', profile: u.name ? { display_name: u.name } : {}, profile_revision: u.revision, providers: u.identities }, memberships: session.key === 'a' ? [{ kind: 'staff', role: 'teacher', staff_id: 'synthetic-staff' }] : [], entitlements: [], learning: { enabled: false, revision: 1 }, capabilities: { learningSync: true },
      sessions: [{ id: `${session.key}-current`, product: 'platform', label: '', current: true, revoked: false, last_seen: new Date().toISOString() }, ...accountRows(session.key)], dataRequests: [] });
  }
  send(res, 404, { code: 'not_found' });
});
// --- the portal's own files from this checkout (or a publishing candidate), with a loopback config -----
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json' };
let config = null;
const portal = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  if (pathname === '/config.json') { res.writeHead(200, { 'Content-Type': 'application/json' });res.end(JSON.stringify(config));return; }
  const candidate = process.env.SYNK_QA_FILES && { '/': 'id__index.html', '/index.html': 'id__index.html', '/style.css': 'id__style.css', '/dist/app.js': 'id__dist__app.js' }[pathname];
  if (candidate) { res.writeHead(200, { 'Content-Type': types[candidate === 'id__dist__app.js' ? '.js' : candidate === 'id__style.css' ? '.css' : '.html'] });res.end(fs.readFileSync(path.join(process.env.SYNK_QA_FILES, candidate)));return; }
  const file = path.join(portalRoot, pathname === '/' ? 'index.html' : pathname);
  if (!file.startsWith(portalRoot) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404);res.end('missing');return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });res.end(fs.readFileSync(file));
});
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const authPort = await listen(auth), portalPort = await listen(portal), base = `http://127.0.0.1:${portalPort}/`, authBase = `http://127.0.0.1:${authPort}`;
config = { version: 1, supabaseUrl: authBase, accountApiUrl: authBase, supabasePublishableKey: 'sb_publishable_synthetic_local', portalUrl: base, learningUrl: base };

const results = [];
const check = (name, ok, details = {}) => { results.push({ name, ok: !!ok, ...details });console.log(JSON.stringify({ name, ok: !!ok, ...details })); };
const browser = await chromium.launch({ channel: process.env.SYNK_QA_CHANNEL || 'chrome' });
async function page(width = 1440, context = null) {
  const own = context || await browser.newContext({ viewport: { width, height: width > 500 ? 1000 : 844 } }), tab = await own.newPage(), errors = [];
  tab.on('pageerror', error => errors.push(String(error).slice(0, 200)));tab.on('console', message => {
    if (message.type() === 'error' && !/atlas-learning|404|status of (?:400|401|403|422)/.test(message.text())) errors.push(message.text().slice(0, 200)); });
  return { context: own, tab, errors };
}
const shot = async (tab, name, fullPage = true) => { await tab.screenshot({ path: path.join(outDir, name + '.png'), fullPage });return name + '.png'; };
const visible = (tab, selector) => tab.isVisible(selector);
const textOf = (tab, selector) => tab.textContent(selector).then(value => (value || '').trim());
const overflow = tab => tab.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
const height = tab => tab.evaluate(() => document.documentElement.scrollHeight);
// The loopback portal sits at /, so its hint carries that path (synk.im/id/ uses the plain key).
const recentStored = tab => tab.evaluate(() => JSON.parse(localStorage.getItem('synk.id.recent-login.v1:/') || 'null'));
async function signIn(tab, key) {
  await tab.fill('#email', users.get(key).email);await tab.fill('#password', users.get(key).password);
  await tab.click('#auth-submit');await tab.waitForSelector('#account-profile:not([hidden])');
}
try {
  for (const width of [1440, 390]) {
    const { context, tab, errors } = await page(width);
    // 1. First visit: one way down the card, nothing about a previous sign-in, a quiet status line.
    await tab.goto(base, { waitUntil: 'networkidle' });await tab.waitForSelector('#auth-panel:not([hidden])');
    const passwordName = await tab.evaluate(() => { const input = document.getElementById('password');return [...input.labels].map(label => label.textContent.trim()).join('|'); });
    check(`the password field is named by its own label only (${width})`, passwordName === '비밀번호', { passwordName });
    check(`first visit names the start, not a return (${width})`, await textOf(tab, '#auth-heading') === 'SYNK 계정으로 시작해요.' && !await visible(tab, '#recent-login') && !await visible(tab, '#google-recent')
      && await visible(tab, '#forgot-row') && await textOf(tab, '#switch-copy') === '처음이세요?' && await tab.getAttribute('#notice', 'data-kind') === 'idle' && await tab.getAttribute('#email', 'autocomplete') === 'username',
      { overflow: await overflow(tab), screenshot: await shot(tab, `1-first-visit-${width}`) });
    // 2. The password field shows what was typed; a wrong password names the Google way without saying the account exists.
    await tab.fill('#email', users.get('a').email);await tab.fill('#password', 'synthetic-wrong');await tab.click('#password-toggle');
    const shown = await tab.getAttribute('#password', 'type');await tab.click('#password-toggle');
    await tab.click('#auth-submit');await tab.waitForFunction(() => /맞지 않아요/.test(document.getElementById('notice').textContent));
    check(`password can be shown, and a wrong one points to Google too (${width})`, shown === 'text' && await tab.getAttribute('#password', 'type') === 'password' && /Google로 가입했다면/.test(await textOf(tab, '#notice')), { screenshot: await shot(tab, `2-wrong-password-${width}`, false) });
    // 3. Sign in: the profile is on top with the sign-out, the page stays short, ended sign-ins are out of the list.
    await tab.fill('#password', users.get('a').password);await tab.click('#auth-submit');await tab.waitForSelector('#account-profile:not([hidden])');await tab.waitForSelector('.session-list');
    const rows = await tab.locator('.session-list .session-row').count(), pageHeight = await height(tab);
    const order = await tab.evaluate(() => [...document.querySelectorAll('main > section')].filter(node => !node.hidden).map(node => node.id || node.className));
    check(`the account opens with who and sign-out first (${width})`, order.indexOf('account-profile') >= 0 && order.indexOf('account-profile') < order.indexOf('account-security') && order.indexOf('account-security') < order.indexOf('account')
      && /합성 회원 A/.test(await textOf(tab, '#account-profile-heading')) && /member-a@synthetic\.test/.test(await textOf(tab, '.profile-email')) && await visible(tab, '[data-action="sign-out"]')
      && /내 SYNK 계정/.test(await textOf(tab, '#hero-title')) && /강사/.test(await textOf(tab, '.profile-facts')) && /2026년 10월 1일/.test(await textOf(tab, '.profile-facts')),
      { order, screenshot: await shot(tab, `3-account-${width}`) });
    check(`「로그인한 곳」 shows six live places first and drops ended ones (${width})`, rows === 6 && /이미 끝난 로그인 10곳/.test(await textOf(tab, '.session-ended')) && /25곳 더 보기/.test(await tab.locator('.account-block').first().textContent())
      && !/종료됨/.test(await tab.locator('.session-list').textContent()) && pageHeight < (width > 500 ? 3600 : 6400), { rows, pageHeight });
    // The 「더 보기」 toggle keeps the keyboard on itself though its words change; the password field's name is just its label.
    await tab.focus('[data-key="sessions-more"]');await tab.keyboard.press('Enter');await tab.waitForFunction(() => /줄여 보기/.test(document.querySelector('[data-key="sessions-more"]')?.textContent || ''));
    const focusKept = await tab.evaluate(() => document.activeElement?.dataset?.key === 'sessions-more' && document.querySelectorAll('.session-list .session-row').length > 6);
    await tab.keyboard.press('Enter');
    check(`「더 보기」 keeps the keyboard where it was (${width})`, focusKept && await tab.locator('.session-list .session-row').count() === 6);
    check(`password and e-mail forms stay folded until asked (${width})`, !await visible(tab, '#password-change-form') && !await visible(tab, '#email-change-form') && await textOf(tab, '#password-form-toggle') === '비밀번호 바꾸기');
    const stored = await recentStored(tab);
    check(`the e-mail sign-in is remembered on this browser only (${width})`, stored?.v === 2 && stored.method === 'email' && stored.email === 'member-a@synthetic.test' && stored.masked === 'me***@synthetic.test');
    // 4. Back again after a sign-out: the way and the address are there.
    await tab.click('[data-action="sign-out"]');await tab.waitForSelector('#auth-panel:not([hidden])');await tab.waitForFunction(() => /로그아웃했어요/.test(document.getElementById('notice').textContent));
    check(`after a sign-out the page says how this browser signed in (${width})`, await textOf(tab, '#auth-heading') === '다시 오셨네요.' && /지난번에 이메일로 로그인했어요 · me\*\*\*@synthetic\.test/.test(await textOf(tab, '#recent-login-text'))
      && await visible(tab, '#email-recent') && !await visible(tab, '#google-recent') && await tab.inputValue('#email') === 'member-a@synthetic.test' && /SYNK 계정/.test(await textOf(tab, '#hero-title')) && !/내 SYNK 계정/.test(await textOf(tab, '#hero-title')),
      { overflow: await overflow(tab), screenshot: await shot(tab, `4-returning-${width}`) });
    // 5. Forgetting the hint empties the address too.
    await tab.click('#recent-login-forget');
    check(`「이 기기에서 지우기」 removes the hint and the filled address (${width})`, !await visible(tab, '#recent-login') && await tab.inputValue('#email') === '' && await recentStored(tab) === null && await textOf(tab, '#auth-heading') === 'SYNK 계정으로 시작해요.');
    // 6. Sign-up and password steps keep only what belongs to them.
    await tab.click('[data-view="signup"]');
    check(`sign-up: own heading, no 「비밀번호를 잊었어요」, e-mail autocomplete (${width})`, await textOf(tab, '#auth-heading') === 'SYNK 계정을 만들어요.' && !await visible(tab, '#forgot-row') && await textOf(tab, '#switch-copy') === '이미 계정이 있나요?'
      && await tab.getAttribute('#email', 'autocomplete') === 'email' && await visible(tab, '#signup-choices') && await textOf(tab, '#google-availability') === 'Google로 가입하면 비밀번호를 따로 만들지 않아요.', { screenshot: await shot(tab, `6-signup-${width}`) });
    await tab.click('[data-view="login"]');await tab.click('#forgot-row button');
    check(`「비밀번호를 잊었어요」 opens the mail step without sign-up beside it (${width})`, await textOf(tab, '#auth-heading') === '비밀번호를 다시 정해요.' && !await visible(tab, '#password-label') && !await visible(tab, 'button[data-view="signup"]') && await visible(tab, 'button[data-view="login"]'),
      { screenshot: await shot(tab, `6-recover-${width}`, false) });
    check(`no page errors (${width})`, !errors.length, { errors });
    await context.close();
  }
  // 7. The PC app's links: ?view=recover lands on the mail step; ?view=security&focus=password opens that form.
  { const { context, tab, errors } = await page();await tab.goto(`${base}?view=recover`, { waitUntil: 'networkidle' });await tab.waitForSelector('#auth-panel:not([hidden])');
    check('?view=recover opens 「비밀번호를 다시 정해요」', await textOf(tab, '#auth-heading') === '비밀번호를 다시 정해요.' && await textOf(tab, '#auth-submit') === '재설정 메일 보내기');
    await tab.fill('#email', users.get('a').email);await tab.click('#auth-submit');await tab.waitForFunction(() => /재설정 메일을 요청했어요/.test(document.getElementById('notice').textContent));
    check('after the mail the same button sends it again for that address', await textOf(tab, '#auth-submit') === '메일 다시 보내기' && !/member-a/.test(await textOf(tab, '#notice')));
    await tab.goto(base, { waitUntil: 'networkidle' });await signIn(tab, 'a');
    // 8. Name, and 「이 브라우저만 남기고 로그아웃」.
    await tab.click('.profile-facts .link-button');await tab.fill('#profile-name-input', '새 이름 A');await tab.click('.profile-name-form button[type=submit]');
    await tab.waitForFunction(() => /새 이름 A/.test(document.getElementById('account-profile-heading').textContent));
    check('the name is changed right from the profile', users.get('a').name === '새 이름 A' && log.some(row => row.body?.action === 'profile-update' && row.body.expected_profile_revision === 1 && row.body.profile.display_name === '새 이름 A'));
    await tab.waitForLoadState('networkidle');const beforeOthers = log.length, others = await tab.locator('.account-block .actions .sb-btn').first().textContent();await tab.locator('.account-block .actions .sb-btn').first().click();
    await tab.waitForFunction(() => /다른 \d+곳의 로그인을 끝냈어요/.test(document.getElementById('notice').textContent));
    check('「이 브라우저만 남기고 로그아웃」 ends every other live place and keeps this one', /\(30곳\)/.test(others) && log.slice(beforeOthers).filter(row => row.body?.action === 'revoke-session').length === 30 && !log.slice(beforeOthers).some(row => row.body?.session_id === 'a-current')
      && await visible(tab, '#account-profile'), { others: others.trim(), revokes: log.slice(beforeOthers).filter(row => row.body?.action === 'revoke-session').length, profileVisible: await visible(tab, '#account-profile'), errors, screenshot: await shot(tab, '8-after-others') });
    await tab.goto(`${base}?view=security&focus=password`, { waitUntil: 'networkidle' });await tab.waitForSelector('#password-change-form:not([hidden])');
    check('?view=security&focus=password opens the password form with the cursor in it', await tab.evaluate(() => document.activeElement?.id) === 'current-password', { screenshot: await shot(tab, '7-security-password', false) });
    // The password change still checks the current password with a separate, ended session.
    await tab.fill('#current-password', 'synthetic-pass-a1');await tab.fill('#new-password', 'synthetic-next-a1');await tab.fill('#new-password-confirm', 'synthetic-next-a1');
    const before = log.length;await tab.click('#password-change-submit');await tab.waitForFunction(() => /바꿨어요/.test(document.getElementById('security-status').textContent));
    const rows = log.slice(before);
    check('the password change keeps its separate current-password check', rows.some(row => row.path === '/auth/v1/token' && row.query.grant_type === 'password') && rows.some(row => row.path === '/auth/v1/logout' && row.token === 'check')
      && rows.some(row => row.method === 'PUT' && row.token === 'browser') && !await visible(tab, '#password-change-form'));
    users.get('a').password = 'synthetic-pass-a1';
    // The PC app's 「이메일 바꾸기」: ?view=security&focus=email opens that form; the change still asks for two confirmations.
    await tab.goto(`${base}?view=security&focus=email`, { waitUntil: 'networkidle' });await tab.waitForSelector('#email-change-form:not([hidden])');
    const emailFocused = await tab.evaluate(() => document.activeElement?.id) === 'new-email';
    await tab.fill('#new-email', 'member-a-next@synthetic.test');await tab.click('#email-change-submit');await tab.waitForSelector('#security-pending-email:not([hidden])');
    check('?view=security&focus=email opens the e-mail form and the change waits for both mails', emailFocused && users.get('a').newEmail === 'member-a-next@synthetic.test' && !await visible(tab, '#email-change-form')
      && log.some(row => row.method === 'PUT' && row.body.email === 'member-a-next@synthetic.test' && /view=security/.test(row.query.redirect_to || '')), { screenshot: await shot(tab, '7-security-email', false) });
    delete users.get('a').newEmail;
    // 9. 「모든 SYNK 앱에서 로그아웃」 also forgets this device's hint.
    await tab.waitForLoadState('networkidle');await tab.waitForTimeout(500);await tab.click('text=모든 SYNK 앱에서 로그아웃');await tab.waitForSelector('#auth-panel:not([hidden])');
    check('「모든 SYNK 앱에서 로그아웃」 leaves no sign-in hint behind', await recentStored(tab) === null && !await visible(tab, '#recent-login') && log.some(row => row.body?.action === 'revoke-all-sessions'));
    check('no page errors (links, name, places)', !errors.length, { errors });
    await context.close(); }
  // 10. A Google-only account and an unconfirmed sign-up.
  { const { context, tab, errors } = await page();await tab.goto(base, { waitUntil: 'networkidle' });await signIn(tab, 'g');
    check('a Google-only account: no name yet, Google as the way, a mail that sets a password', /SYNK 회원/.test(await textOf(tab, '#account-profile-heading')) && /정하기/.test(await textOf(tab, '.profile-facts'))
      && await textOf(tab, '#security-methods') === 'Google' && await textOf(tab, '#password-mail-heading') === 'Google로 가입한 계정이에요' && await textOf(tab, '#password-form-toggle') === '이미 만든 비밀번호 바꾸기', { screenshot: await shot(tab, '10-google-only') });
    await tab.click('[data-action="sign-out"]');await tab.waitForSelector('#auth-panel:not([hidden])');
    await tab.fill('#email', users.get('u').email);await tab.fill('#password', users.get('u').password);await tab.click('#auth-submit');await tab.waitForSelector('#resend-confirm:not([hidden])');
    const before = log.length;await tab.click('#resend-confirm');await tab.waitForFunction(() => /확인 메일을 다시 요청했어요/.test(document.getElementById('notice').textContent));
    check('an unconfirmed sign-up gets 「확인 메일 다시 받기」 that resends for that address', log.slice(before).some(row => row.path === '/auth/v1/resend' && row.body.email === 'member-u@synthetic.test' && row.body.type === 'signup')
      && await tab.evaluate(() => [...document.querySelectorAll('#auth-form .notice.error')].every(node => node.hidden)), { errors, screenshot: await shot(tab, '10-resend', false) });
    check('no page errors (google-only, resend)', !errors.length, { errors });
    await context.close(); }
  // 11. A reset link still waits for a tap and opens the new-password form for its account.
  { const { context, tab, errors } = await page(390), before = log.length;await tab.goto(`${base}?view=reset&token_hash=${'pkce_' + 'a1'.repeat(28)}&type=recovery`, { waitUntil: 'networkidle' });
    const waits = await textOf(tab, '#auth-submit') === '링크 확인하고 계속' && !log.slice(before).some(row => row.path === '/auth/v1/verify');
    await tab.click('#auth-submit');await tab.waitForSelector('#password-confirm-label:not([hidden])');
    check('a reset link waits for a tap, then the new-password form names its account', waits && /member-a@synthetic\.test/.test(await textOf(tab, '#auth-copy')) && !await visible(tab, '#forgot-row') && await visible(tab, '#password-confirm-toggle'), { errors, screenshot: await shot(tab, '11-reset-390') });
    await context.close(); }
} finally {
  await browser.close();auth.close();portal.close();
}
fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify({ at: new Date().toISOString(), results }, null, 2) + '\n');
process.exitCode = results.every(row => row.ok) ? 0 : 1;
