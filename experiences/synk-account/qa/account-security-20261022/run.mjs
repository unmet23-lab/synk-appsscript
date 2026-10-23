// SYNK ID 「로그인과 보안」·token-hash reset links, run end to end on this PC: the built portal bundle
// (dist/app.js with the real supabase-js) against a synthetic Auth + account server on 127.0.0.1.
// No production project, real account, mail or password is involved.
//   node experiences/synk-account/qa/account-security-20261022/run.mjs <playwright module dir> <out dir>
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
  ['a', { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'member-a@synthetic.test', password: 'synthetic-pass-a1', identities: ['email'], name: '합성 회원 A' }],
  ['b', { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'member-b@synthetic.test', password: 'synthetic-pass-b1', identities: ['email'], name: '합성 회원 B' }],
  ['g', { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', email: 'member-g@synthetic.test', password: 'synthetic-pass-g1', identities: ['google'], name: '합성 Google 회원' }],
]);
const recoveryTokens = new Map([['pkce_' + 'a1'.repeat(28), 'a'], ['pkce_' + 'a3'.repeat(28), 'a']]);
// E-mail change (secure change on): one token hash per address, as GoTrue puts in each address's mail; mails records them.
const emailTokens = new Map(), mails = [];let emailChanges = 0;
const sessions = new Map(), log = [];
const userJson = key => { const u = users.get(key);return { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, ...(u.newEmail ? { new_email: u.newEmail } : {}),
  created_at: '2026-10-01T00:00:00Z', app_metadata: { provider: u.identities[0], providers: u.identities }, user_metadata: {},
  identities: u.identities.map(provider => ({ id: u.id + provider, user_id: u.id, provider, identity_data: { email: u.email, sub: u.id }, created_at: '2026-10-01T00:00:00Z' })) }; };
const issue = (key, kind) => { const access = 'synthetic-access-' + crypto.randomUUID(), refresh = 'synthetic-refresh-' + crypto.randomUUID();
  sessions.set(access, { key, kind, refresh, live: true });return { access_token: access, refresh_token: refresh, token_type: 'bearer', expires_in: 3600, expires_at: now() + 3600, user: userJson(key) }; };
const bearer = req => sessions.get((req.headers.authorization || '').replace(/^Bearer /, ''));
const send = (res, status, body, extra = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'x-supabase-api-version', 'x-supabase-api-version': '2024-01-01', ...extra });res.end(body === undefined ? '' : JSON.stringify(body)); };
const fail = (res, status, code, message) => send(res, status, { code, message });
const auth = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS', 'Access-Control-Max-Age': '600' });res.end();return; }
  const url = new URL(req.url, 'http://127.0.0.1');let body = '';for await (const chunk of req) body += chunk;const data = body ? JSON.parse(body) : {};
  const session = bearer(req);log.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body: data, token: session ? session.kind : null, user: session?.key || null });
  if (url.pathname === '/auth/v1/settings') return send(res, 200, { external: { email: true, google: false }, disable_signup: false });
  if (url.pathname === '/auth/v1/verify' && req.method === 'POST' && data.type === 'email_change') {
    const row = emailTokens.get(data.token_hash);if (!row) return fail(res, 403, 'otp_expired', 'Email link is invalid or has expired');
    emailTokens.delete(data.token_hash);const u = users.get(row.key);
    // The first address answers with a message and no session; the second changes the e-mail and signs in.
    if ([...emailTokens.values()].some(other => other.change === row.change)) return send(res, 200, { msg: 'Confirmation link accepted. Please proceed to confirm link sent to the other email', code: '200' });
    u.email = u.newEmail;delete u.newEmail;return send(res, 200, issue(row.key, 'email_change'));
  }
  if (url.pathname === '/auth/v1/verify' && req.method === 'POST') {
    const key = recoveryTokens.get(data.token_hash);if (data.type !== 'recovery' || !key) return fail(res, 403, 'otp_expired', 'Email link is invalid or has expired');
    recoveryTokens.delete(data.token_hash);return send(res, 200, issue(key, 'recovery'));
  }
  if (url.pathname === '/auth/v1/token') {
    if (url.searchParams.get('grant_type') === 'password') {
      const key = [...users].find(([, u]) => u.email === data.email)?.[0];
      if (!key || users.get(key).password !== data.password) return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, { 'x-supabase-api-version': '' });
      return send(res, 200, issue(key, req.headers['x-client-info'] ? 'browser' : 'check'));
    }
    const old = [...sessions].find(([, s]) => s.refresh === data.refresh_token && s.live);if (!old) return fail(res, 400, 'refresh_token_not_found', 'Invalid Refresh Token');
    old[1].live = false;return send(res, 200, issue(old[1].key, old[1].kind));
  }
  if (url.pathname === '/auth/v1/user') {
    if (!session?.live) return fail(res, 401, 'session_not_found', 'Session not found');
    const u = users.get(session.key);
    if (req.method === 'PUT') {
      if (data.password) { if (data.password === u.password) return fail(res, 422, 'same_password', 'New password should be different from the old password.');u.password = data.password;
        // GoTrue keeps only the session that asked (LogoutAllExceptMe).
        for (const [token, other] of sessions) if (other.key === session.key && token !== (req.headers.authorization || '').replace(/^Bearer /, '')) other.live = false; }
      if (data.email) { if ([...users.values()].some(other => other.email === data.email)) return fail(res, 422, 'email_exists', 'A user with this email address has already been registered');u.newEmail = data.email;
        for (const [token, row] of emailTokens) if (row.key === session.key) emailTokens.delete(token);
        const change = ++emailChanges, current = 'pkce_' + crypto.randomBytes(28).toString('hex'), next = 'pkce_' + crypto.randomBytes(28).toString('hex');
        emailTokens.set(current, { key: session.key, change });emailTokens.set(next, { key: session.key, change });
        mails.push({ type: 'email_change', change, to: u.email, token_hash: current }, { type: 'email_change', change, to: data.email, token_hash: next }); }
    }
    return send(res, 200, userJson(session.key));
  }
  if (url.pathname === '/auth/v1/logout') { if (session) session.live = false;res.writeHead(204, { 'Access-Control-Allow-Origin': '*' });res.end();return; }
  if (url.pathname === '/auth/v1/recover') return send(res, 200, {});
  if (url.pathname === '/functions/v1/synk-account') {
    if (!session?.live) return send(res, 401, { ok: false, error: { code: 'AUTH_REQUIRED' } });
    const u = users.get(session.key), view = url.searchParams.get('view');
    if (view === 'registration') return send(res, 200, { ok: true, registration: { required: false, completed: true, phoneVerificationRequired: false } });
    if (view === 'atlas') return send(res, 200, { ok: true, shared: 'declared-only', learning: { enabled: false, revision: 1 }, summary: { reasons: [], presentation: null, practice: { answered: 0 }, forReasons: [] } });
    if (req.method === 'POST') return send(res, 200, { ok: true, current: false, refreshRevoked: true });
    return send(res, 200, { ok: true, account: { synk_user_id: u.id, status: 'active', profile: { display_name: u.name }, profile_revision: 1, providers: u.identities }, memberships: [], entitlements: [], learning: { enabled: false, revision: 1 }, capabilities: { learningSync: false },
      sessions: [{ id: crypto.randomUUID(), product: 'platform', label: '', current: true, revoked: false, last_seen: new Date().toISOString() }], dataRequests: [] });
  }
  send(res, 404, { code: 'not_found' });
});
// --- the portal's own files from this checkout, with a loopback config ----------------------------
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json' };
let config = null;
const portal = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  if (pathname === '/config.json') { res.writeHead(200, { 'Content-Type': 'application/json' });res.end(JSON.stringify(config));return; }
  // SYNK_QA_FILES=<dir>: serve a publishing candidate (patch-live.mjs output) instead of this checkout's page, style and bundle.
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
// The installed Chrome; this PC's Playwright copy carries no browser of its own.
const browser = await chromium.launch({ channel: process.env.SYNK_QA_CHANNEL || 'chrome' });
async function page(width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: width > 500 ? 1000 : 844 } }), tab = await context.newPage(), errors = [];
  tab.on('pageerror', error => errors.push(String(error).slice(0, 200)));tab.on('console', message => { // The checks provoke 400·403·422 on purpose (wrong password, used link, taken e-mail); the browser logs those requests.
    if (message.type() === 'error' && !/atlas-learning|404|status of (?:400|403|422)/.test(message.text())) errors.push(message.text().slice(0, 200)); });
  return { context, tab, errors };
}
const shot = async (tab, name) => { await tab.screenshot({ path: path.join(outDir, name + '.png'), fullPage: true });return name + '.png'; };
const text = tab => tab.evaluate(() => document.body.innerText);
// Waits for the card's status line; a timeout names what the line said instead.
const waitStatus = async (tab, pattern) => { try { await tab.waitForFunction(source => new RegExp(source).test(document.getElementById('security-status').textContent), pattern.source, { timeout: 15000 }); } catch { throw new Error('security-status: ' + await tab.textContent('#security-status') + ' | notice: ' + await tab.textContent('#notice')); } };
const overflow = tab => tab.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
async function signIn(tab, key) {
  await tab.goto(base, { waitUntil: 'networkidle' });await tab.fill('#email', users.get(key).email);await tab.fill('#password', users.get(key).password);
  await tab.click('#auth-submit');await tab.waitForSelector('#account:not([hidden])');
}
try {
  for (const width of [1440, 390]) {
    // 1. A reset link opened in a browser with no session (another device, the phone's mail app's browser).
    { const token = width === 1440 ? 'pkce_' + 'a1'.repeat(28) : 'pkce_' + 'a3'.repeat(28);
      const { context, tab, errors } = await page(width), before = log.length;await tab.goto(`${base}?view=reset&token_hash=${token}&type=recovery`, { waitUntil: 'networkidle' });
      const address = new URL(tab.url());
      check(`reset link waits for a tap, token off the address (${width})`, !address.searchParams.has('token_hash') && (await tab.textContent('#auth-submit')).trim() === '링크 확인하고 계속' && await tab.isHidden('#password-label') && !log.slice(before).some(row => row.path === '/auth/v1/verify'),
        { address: address.pathname + address.search, screenshot: await shot(tab, `reset-1-link-${width}`) });
      await tab.click('#auth-submit');await tab.waitForSelector('#password-confirm-label:not([hidden])');
      const copy = await tab.textContent('#auth-copy');
      check(`reset link opens the new-password form for its account (${width})`, copy.includes('member-a@synthetic.test') && log.slice(before).some(row => row.path === '/auth/v1/verify' && row.body.token_hash === token), { copy, screenshot: await shot(tab, `reset-2-form-${width}`) });
      await tab.fill('#password', 'synthetic-new-' + width);await tab.fill('#password-confirm', 'synthetic-other');await tab.click('#auth-submit');
      check(`unmatched new passwords never reach Auth (${width})`, (await tab.textContent('#notice')).includes('두 칸이 서로 달라요') && !log.slice(before).some(row => row.method === 'PUT'));
      await tab.fill('#password', 'synthetic-new-' + width);await tab.fill('#password-confirm', 'synthetic-new-' + width);await tab.click('#auth-submit');await tab.waitForSelector('#account:not([hidden])');
      const put = log.slice(before).find(row => row.method === 'PUT' && row.path === '/auth/v1/user');
      check(`the new password is saved with the recovery session and the account opens (${width})`, put?.token === 'recovery' && put.body.password === 'synthetic-new-' + width && (await tab.textContent('#notice')).includes('새 비밀번호를 저장했어요') && !(await tab.isHidden('#account-security')),
        { overflow: await overflow(tab), errors, screenshot: await shot(tab, `reset-3-saved-${width}`) });
      users.get('a').password = 'synthetic-pass-a1';await context.close(); }
  }
  // 2. The same (now used) link again: the recover form with a plain explanation.
  { const { context, tab, errors } = await page();await tab.goto(`${base}?view=reset&token_hash=${'pkce_' + 'a1'.repeat(28)}&type=recovery`, { waitUntil: 'networkidle' });
    await tab.click('#auth-submit');await tab.waitForSelector('#notice.error');
    check('a used link offers a new mail in the recover form', (await tab.textContent('#notice')).includes('이미 썼거나 만료') && (await tab.textContent('#auth-submit')).trim() === '재설정 메일 보내기', { errors, screenshot: await shot(tab, 'reset-4-used') });
    await context.close(); }
  // 3. Signed into B, a link for A: the page says whose password it sets.
  { recoveryTokens.set('pkce_' + 'a4'.repeat(28), 'a');const { context, tab, errors } = await page();await signIn(tab, 'b');
    await tab.goto(`${base}?view=reset&token_hash=${'pkce_' + 'a4'.repeat(28)}&type=recovery`, { waitUntil: 'networkidle' });
    const linkStep = (await tab.textContent('#auth-submit')).trim() === '링크 확인하고 계속';await tab.click('#auth-submit');await tab.waitForSelector('#password-confirm-label:not([hidden])');
    const copy = await tab.textContent('#auth-copy');
    check('a link opened where another account is signed in names both', linkStep && copy.includes('member-a@synthetic.test') && copy.includes('member-b@synthetic.test'), { copy, errors, screenshot: await shot(tab, 'reset-5-other-account') });
    await context.close(); }
  // 4. 「로그인과 보안」: current password checked by a separate session, change on this browser's session.
  for (const width of [1440, 390]) {
    const { context, tab, errors } = await page(width);await signIn(tab, 'a');await tab.goto(`${base}?view=security`, { waitUntil: 'networkidle' });await tab.waitForSelector('#account-security:not([hidden])');
    check(`?view=security opens the card with this browser's account (${width})`, (await tab.textContent('#security-email')).trim() === 'member-a@synthetic.test', { screenshot: await shot(tab, `security-1-card-${width}`) });
    await tab.fill('#current-password', 'synthetic-wrong');await tab.fill('#new-password', 'synthetic-next-' + width);await tab.fill('#new-password-confirm', 'synthetic-next-' + width);await tab.click('#password-change-submit');
    await waitStatus(tab, /맞지 않아요/);
    const before = log.length;
    await tab.fill('#current-password', 'synthetic-pass-a1');await tab.click('#password-change-submit');await waitStatus(tab, /바꿨어요/);
    const rows = log.slice(before), grant = rows.find(row => row.path === '/auth/v1/token' && row.query.grant_type === 'password'), put = rows.find(row => row.method === 'PUT' && row.path === '/auth/v1/user');
    check(`password change: separate check session ended, change on the browser session (${width})`, grant?.body.password === 'synthetic-pass-a1' && rows.some(row => row.path === '/auth/v1/logout' && row.token === 'check') && put?.token === 'browser' && put.body.password === 'synthetic-next-' + width,
      { errors, screenshot: await shot(tab, `security-2-changed-${width}`) });
    if (width === 1440) {
      await tab.fill('#new-email', 'member-b@synthetic.test');await tab.click('#email-change-submit');await waitStatus(tab, /다른 SYNK 계정/);
      await tab.fill('#new-email', 'member-a-next@synthetic.test');await tab.click('#email-change-submit');await tab.waitForSelector('#security-pending-email:not([hidden])');
      const change = log.findLast(row => row.method === 'PUT' && row.body.email);
      check('e-mail change asks for two confirmations and comes back to the card', change.body.email === 'member-a-next@synthetic.test' && /view=security/.test(change.query.redirect_to || '') && !!change.body.code_challenge,
        { screenshot: await shot(tab, 'security-3-email-pending') });
      delete users.get('a').newEmail;
      await tab.goto(`${base}?view=reset`, { waitUntil: 'networkidle' });await tab.waitForSelector('#account-security:not([hidden])');
      check('a plain signed-in ?view=reset shows the card, not a new-password form', await tab.isHidden('#auth-panel'));
    }
    users.get('a').password = 'synthetic-pass-a1';check(`no page errors (${width})`, !errors.length, { errors, overflow: await overflow(tab) });await context.close();
  }
  // 5. Google-only: the card starts from the mail that sets a password.
  { const { context, tab, errors } = await page();await signIn(tab, 'g');await tab.waitForSelector('#account-security:not([hidden])');
    const before = log.length;await tab.click('#password-mail');await waitStatus(tab, /메일을 보냈어요/);
    const recover = log.slice(before).find(row => row.path === '/auth/v1/recover');
    check('a Google-only account gets 「비밀번호 만들기」 and a reset mail to its address', (await tab.textContent('#password-mail-heading')).trim() === '비밀번호 만들기' && recover?.body.email === 'member-g@synthetic.test' && /view=reset/.test(recover.query.redirect_to || ''),
      { errors, screenshot: await shot(tab, 'security-4-google-only') });
    await context.close(); }
  // 6. An e-mail change confirmed from two other browsers by the token-hash links in the two mails (10-23).
  { const asker = await page();await signIn(asker.tab, 'a');await asker.tab.goto(`${base}?view=security`, { waitUntil: 'networkidle' });await asker.tab.waitForSelector('#account-security:not([hidden])');
    await asker.tab.fill('#new-email', 'member-a-new@synthetic.test');await asker.tab.click('#email-change-submit');await asker.tab.waitForSelector('#security-pending-email:not([hidden])');
    const [toCurrent, toNew] = mails.filter(mail => mail.change === emailChanges);await asker.context.close();
    const link = mail => `${base}?view=security&token_hash=${mail.token_hash}&type=email_change`;
    // The phone's mail app: no session in this browser.
    { const { context, tab, errors } = await page(390), before = log.length;await tab.goto(link(toCurrent), { waitUntil: 'networkidle' });
      const address = new URL(tab.url());
      check('e-mail-change link waits for a tap, token off the address', !address.searchParams.has('token_hash') && address.searchParams.get('view') === 'security' && (await tab.textContent('#auth-submit')).trim() === '이메일 변경 확인하기'
        && await tab.isHidden('#password-label') && await tab.isHidden('#email') && !log.slice(before).some(row => row.path === '/auth/v1/verify'), { address: address.pathname + address.search, screenshot: await shot(tab, 'email-1-link-390') });
      await tab.click('#auth-submit');await tab.waitForFunction(() => /이 주소를 확인했어요/.test(document.getElementById('notice').textContent));
      check('the first address asks for the other mail, signed out', log.slice(before).some(row => row.path === '/auth/v1/verify' && row.body.type === 'email_change' && row.body.token_hash === toCurrent.token_hash)
        && users.get('a').email === 'member-a@synthetic.test' && await tab.isHidden('#account') && (await tab.textContent('#auth-submit')).trim() === '로그인', { overflow: await overflow(tab), errors, screenshot: await shot(tab, 'email-2-first-390') });
      await context.close(); }
    // Another device: the new address's mail finishes the change and signs this browser in with it.
    { const { context, tab, errors } = await page(), before = log.length;await tab.goto(link(toNew), { waitUntil: 'networkidle' });await tab.click('#auth-submit');await tab.waitForSelector('#account-security:not([hidden])');
      const notice = await tab.textContent('#notice');
      check('the second address changes the login e-mail and shows it in 「로그인과 보안」', users.get('a').email === 'member-a-new@synthetic.test' && (await tab.textContent('#security-email')).trim() === 'member-a-new@synthetic.test'
        && notice.includes('이메일 변경을 마쳤어요') && log.slice(before).some(row => row.path === '/auth/v1/verify' && row.body.token_hash === toNew.token_hash), { notice, errors, screenshot: await shot(tab, 'email-3-done') });
      await context.close(); }
    // The same link again: used.
    { const { context, tab, errors } = await page();await tab.goto(link(toNew), { waitUntil: 'networkidle' });await tab.click('#auth-submit');await tab.waitForSelector('#notice.error');
      const notice = await tab.textContent('#notice');
      check('a used e-mail-change link points to the other mail first', notice.includes('이미 썼거나 만료') && notice.includes('다른 주소로 간 메일') && !notice.includes('로그인하지 않아도'), { notice, errors, screenshot: await shot(tab, 'email-4-used') });
      check('no page errors in the e-mail-change checks', !errors.length, { errors });
      await context.close(); }
    users.get('a').email = 'member-a@synthetic.test'; }
} finally {
  await browser.close();auth.close();portal.close();
}
fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify({ at: new Date().toISOString(), results }, null, 2) + '\n');
process.exitCode = results.every(row => row.ok) ? 0 : 1;
