// patch-live.mjs's publishing candidate on the real pages — https://synk.im/account/platform.html (③ the account library card)
// and https://synk.im/id/ (④ 「로그인과 보안」) — in the installed Chrome. The candidate files go in with route.fulfill and every
// request to the account project is answered here (a synthetic Auth and account server), so nothing reaches the production
// project or a real account; other origins are cut off.
//   node experiences/synk-account/qa/login-ux-web-20261029/check-live.mjs <playwright module dir> <candidate dir> <out dir> [live]
// <candidate dir> holds id__dist__app.js and account__dist__platform.js (or, after tools/공개.js --후보폴더, id/dist/app.js and
// account/dist/platform.js). With `live` the published files stay: the baseline, where each check expects the old behaviour.
// One JSON line per check; screenshots at 1440 and 390 go to <out dir>.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const [playwrightDir, candidateDir, outDir, mode = 'candidate'] = process.argv.slice(2);
if (!playwrightDir || !candidateDir || !outDir) throw new Error('usage: check-live.mjs <playwright module dir> <candidate dir> <out dir> [live]');
const { chromium } = createRequire(import.meta.url)(path.resolve(playwrightDir));
const project = 'https://qiwxeddwwnzkwalpsuty.supabase.co', live = mode === 'live';
fs.mkdirSync(outDir, { recursive: true });
const candidateFile = pathname => [pathname.slice(1).split('/').join('__'), pathname.slice(1)].map(name => path.join(candidateDir, name)).find(file => fs.existsSync(file));
const FILES = ['/id/dist/app.js', '/account/dist/platform.js'];
for (const pathname of FILES) if (!live && !candidateFile(pathname)) throw new Error('the candidate has no ' + pathname);

// --- synthetic account project ------------------------------------------------------------------------------------------
const USER = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'member-a@synthetic.test', password: 'synthetic-pass-a1' };
let log = [];
const account = () => ({ ok: true, account: { synk_user_id: USER.id, status: 'active', profile: { display_name: '합성 회원 A' }, profile_revision: 1, providers: ['email'] }, memberships: [], entitlements: [],
  learning: { enabled: false, revision: 1 }, capabilities: { learningSync: false }, sessions: [{ id: 'a-current', product: 'platform', label: '', current: true, revoked: false, last_seen: new Date().toISOString() }], dataRequests: [] });
const CORS = { 'Access-Control-Allow-Origin': 'https://synk.im', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Expose-Headers': '*', 'x-supabase-api-version': '2024-01-01' };
async function answer(route) {
  const request = route.request(), url = new URL(request.url()), method = request.method();
  if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
  let body = {};try { body = request.postData() ? JSON.parse(request.postData()) : {}; } catch { body = Object.fromEntries(new URLSearchParams(request.postData() || '')); }
  log.push({ method, path: url.pathname, query: Object.fromEntries(url.searchParams), product: (await request.allHeaders())['x-synk-product'] || null, body: Object.keys(body) });
  const json = (status, data) => route.fulfill({ status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const user = { id: USER.id, aud: 'authenticated', role: 'authenticated', email: USER.email, ...(body.email ? { new_email: body.email } : {}), created_at: '2026-10-01T00:00:00Z', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {},
    // 「로그인과 보안」 reads the sign-in methods from identities: an e-mail account, as the real one is.
    identities: [{ id: USER.id + 'email', user_id: USER.id, provider: 'email', identity_data: { email: USER.email, sub: USER.id }, created_at: '2026-10-01T00:00:00Z' }] };
  const session = () => ({ access_token: 'synthetic-access-' + crypto.randomUUID(), refresh_token: 'synthetic-refresh-' + crypto.randomUUID(), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user });
  if (url.pathname === '/auth/v1/settings') return json(200, { external: { email: true, google: true }, disable_signup: false });
  if (url.pathname === '/auth/v1/token') return json(200, session());
  if (url.pathname === '/auth/v1/user') return json(200, user);
  if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers: CORS, body: '' });
  if (url.pathname === '/functions/v1/synk-town/records') return json(200, { ok: true, scope: 'synk-town-records', accountId: USER.id, records: { available: false } });
  if (url.pathname === '/functions/v1/synk-account') {
    const view = url.searchParams.get('view');
    if (view === 'registration') return json(200, { ok: true, registration: { required: false, completed: true, phoneVerificationRequired: false } });
    if (view === 'atlas') return json(200, { ok: true, shared: 'declared-only', learning: { enabled: false, revision: 1 }, summary: { reasons: [], presentation: null, practice: { answered: 0, independent: 0, assisted: 0, skills: [] }, forReasons: [] } });
    if (method === 'POST') return json(200, { ok: true, current: false, refreshRevoked: true, legacyAccessGuard: true });
    return json(200, account());
  }
  return json(404, { ok: false, error: { code: 'NOT_FOUND', message: 'not in this check' } });
}

// --- pages ---------------------------------------------------------------------------------------------------------------
const results = [];
const check = (name, ok, details = {}) => { results.push({ name, ok: !!ok, ...details });console.log(JSON.stringify({ name, ok: !!ok, ...details })); };
const browser = await chromium.launch({ channel: process.env.SYNK_QA_CHANNEL || 'chrome', headless: true });
async function open(url, width, { session = false } = {}) {
  log = [];
  const context = await browser.newContext({ viewport: { width, height: width > 500 ? 1000 : 844 } }), errors = [];
  // A signed-in web platform keeps its SYNK ID session in this tab's sessionStorage (createPlatformAccount, SESSION_KEY).
  if (session) await context.addInitScript(() => { if (location.origin === 'https://synk.im') sessionStorage.setItem('synk.oauth.session.platform', JSON.stringify({ access_token: 'synthetic-platform-access', refresh_token: 'synthetic-platform-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600 })); });
  await context.route(`${project}/**`, answer);
  await context.route(request => { const u = new URL(request); return u.origin === 'https://synk.im' && FILES.includes(u.pathname); }, async route => {
    if (live) return route.continue();
    await route.fulfill({ status: 200, headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' }, body: fs.readFileSync(candidateFile(new URL(route.request().url()).pathname)) });
  });
  await context.route(request => { const u = new URL(request); return u.origin !== 'https://synk.im' && u.origin !== project && !/^(?:data|blob):/.test(u.protocol); }, route => route.abort());
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(String(error).slice(0, 200)));
  page.on('console', message => { if (message.type() === 'error' && !/status of 404|ERR_FAILED|net::ERR/.test(message.text())) errors.push(message.text().slice(0, 200)); });
  await page.goto(`${url}${url.includes('?') ? '&' : '?'}probe=login-ux-web-${Date.now()}`, { waitUntil: 'domcontentloaded' });
  return { context, page, errors };
}
const overflow = page => page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
const card = 'aside[aria-label="계정 라이브러리"]';
const label = page => page.locator(`${card} [data-connect-button]`).first().textContent();
const want = (candidate, old) => live ? old : candidate;
try {
  // ③ a guest on the web platform: the card's way in is the SYNK ID sign-in, the same page as the header's.
  for (const width of [1440, 390]) {
    const { context, page, errors } = await open('https://synk.im/account/platform.html', width);
    await page.waitForSelector(`${card} [data-connect-button]`);
    const expected = want('SYNK ID로 로그인', '계정 라이브러리 연결');
    const settled = await page.waitForFunction(([selector, text]) => document.querySelector(selector)?.textContent === text, [`${card} [data-connect-button]`, expected], { timeout: 15000 }).then(() => true, () => false);
    const header = await page.locator('.account-entry').first().getAttribute('aria-label');
    await page.locator(card).first().scrollIntoViewIfNeeded();
    const shot = `platform-guest-${mode}-${width}.png`;await page.locator(card).first().screenshot({ path: path.join(outDir, shot) });
    await page.screenshot({ path: path.join(outDir, `platform-guest-page-${mode}-${width}.png`), fullPage: false });
    check(`platform ${width} guest: the card button says ${expected}`, settled && header === 'SYNK ID로 로그인' && await overflow(page) === 0 && !errors.length, { button: await label(page), header, overflow: await overflow(page), errors, screenshot: shot });
    if (width === 1440) {
      const navigated = page.waitForURL(/\/account\/client\.html\?product=platform$/, { waitUntil: 'commit', timeout: 8000 }).then(() => true, () => false);
      await page.locator(`${card} [data-connect-button]`).first().click();
      const went = await navigated;
      check(`platform guest: pressing it ${want('opens client.html?product=platform (the header sign-in)', 'stays on the page (the old library connect)')}`, went === !live, { url: page.url() });
    }
    await context.close();
  }
  // ③ signed in (synthetic account): the card keeps 「계정 라이브러리 연결」 and pressing it stays on the page.
  { const { context, page, errors } = await open('https://synk.im/account/platform.html', 1440, { session: true });
    const signedIn = await page.waitForFunction(() => document.querySelector('.account-entry')?.getAttribute('aria-label') === 'SYNK ID 계정 관리', null, { timeout: 15000 }).then(() => true, () => false);
    await page.waitForTimeout(500);
    const text = await label(page);
    await page.locator(`${card} [data-connect-button]`).first().click();await page.waitForTimeout(1500);
    const shot = `platform-signed-in-${mode}-1440.png`;await page.locator(card).first().screenshot({ path: path.join(outDir, shot) });
    check('platform signed in: the card keeps 계정 라이브러리 연결 and pressing it stays on the page', signedIn && text === '계정 라이브러리 연결' && /\/account\/platform\.html/.test(page.url())
      && log.some(row => row.path === '/functions/v1/synk-account' && row.product === 'platform') && !errors.length, { signedIn, button: text, url: page.url(), errors, screenshot: shot });
    await context.close(); }
  // ④ 「로그인과 보안」: after a password or e-mail change the folded form's toggle has the focus.
  for (const width of [1440, 390]) {
    const { context, page, errors } = await open('https://synk.im/id/', width);
    await page.waitForSelector('#auth-panel:not([hidden])');await page.fill('#email', USER.email);await page.fill('#password', USER.password);await page.click('#auth-submit');
    await page.waitForSelector('#account-security:not([hidden])', { timeout: 20000 });
    await page.click('#password-form-toggle');await page.fill('#current-password', USER.password);await page.fill('#new-password', 'synthetic-pass-a2');await page.fill('#new-password-confirm', 'synthetic-pass-a2');
    await page.locator('#password-change-form [type=submit]').click();
    await page.waitForFunction(() => /비밀번호를 바꿨어요/.test(document.querySelector('#security-status')?.textContent || ''), null, { timeout: 15000 });await page.waitForTimeout(300);
    const afterPassword = await page.evaluate(() => ({ focus: document.activeElement?.id || document.activeElement?.tagName, folded: document.querySelector('#password-change-form').hidden, disabled: document.querySelector('#password-form-toggle').disabled }));
    const shot = `id-security-password-${mode}-${width}.png`;await page.locator('#account-security').screenshot({ path: path.join(outDir, shot) });
    check(`id ${width}: after a password change the focus ${want('is on 비밀번호 바꾸기', 'is lost (old)')}`, afterPassword.folded && !afterPassword.disabled && (afterPassword.focus === 'password-form-toggle') === !live
      && log.some(row => row.path === '/auth/v1/user' && row.method === 'PUT') && await overflow(page) === 0 && !errors.length, { ...afterPassword, overflow: await overflow(page), errors, screenshot: shot });
    await page.click('#email-form-toggle');await page.fill('#new-email', 'member-a2@synthetic.test');
    await page.locator('#email-change-form [type=submit]').click();
    await page.waitForFunction(() => /두 주소로 확인 메일을 보냈어요/.test(document.querySelector('#security-status')?.textContent || ''), null, { timeout: 15000 });await page.waitForTimeout(300);
    const afterEmail = await page.evaluate(() => ({ focus: document.activeElement?.id || document.activeElement?.tagName, folded: document.querySelector('#email-change-form').hidden, disabled: document.querySelector('#email-form-toggle').disabled }));
    check(`id ${width}: after an e-mail change the focus ${want('is on 이메일 바꾸기', 'is lost (old)')}`, afterEmail.folded && !afterEmail.disabled && (afterEmail.focus === 'email-form-toggle') === !live && !errors.length, { ...afterEmail, errors });
    await context.close();
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(outDir, `results-${mode}.json`), JSON.stringify({ at: new Date().toISOString(), mode, results }, null, 2) + '\n');
process.exitCode = results.every(row => row.ok) ? 0 : 1;
