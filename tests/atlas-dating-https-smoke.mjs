// Finite, free TLS reverse-proxy browser test. All identities and credentials
// are synthetic and local. The generated certificate never enters a trust store.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';

const require = createRequire(import.meta.url), execute = promisify(execFile);
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const out = fileURLToPath(new URL('../experiences/atlas-lab/qa/dating-https/', import.meta.url));
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-dating-https-browser-'));
const clientId = 'synthetic-dating-https-browser', publicKey = 'sb_publishable_synthetic_dating_https';
const accountId = 'synk:synthetic-https-account', nickname = '합성 HTTPS 저장 계정';
const sourcePaths = [
  'experiences/atlas-lab/dating-ui.mjs', 'experiences/atlas-lab/dating-account.mjs',
  'experiences/atlas-lab/dating-auth.mjs', 'experiences/atlas-lab/dating-server.mjs',
  'experiences/atlas-lab/dating-service.mjs', 'experiences/atlas-lab/dating-runtime.mjs', 'experiences/atlas-lab/dating-transport.mjs',
  'experiences/atlas-lab/dating-admission.mjs', 'experiences/atlas-lab/dating-shutdown.mjs', 'experiences/atlas-lab/dating-restore.mjs',
  'experiences/learning-hub/server.mjs', 'experiences/atlas-lab/dating-public.mjs', 'experiences/synk-account/src/core.mjs',
  'tests/atlas-dating-https-smoke.mjs',
];
const report = { kind: 'synthetic-dating-https-browser', at: new Date().toISOString(), status: 'running',
  actualUsers: 0, realProviderRequests: 0, physicalDevices: 0, modelCalls: 0, externalApiCost: 0,
  credentialInjection: false, verifierInjection: false, tlsVerificationGloballyDisabled: false,
  trustStoreModified: false, fixtureBrowserIgnoresSelfSignedCertificate: true,
  paths: [], errors: [], externalRequests: [], failedRequests: [], failedResponses: [], staticResponses: [], callbackRequests: [], screenshots: [],
  counters: { tlsRequests: 0, forwardedRequests: 0, authorize: 0, acceptedS256: 0, centralIdentityChecks: 0, productActions: 0, logout: 0 } };
const transactions = new Map(), codes = new Map(), access = new Map(), contexts = [];
let browser, identity, server, proxy, origin, identityOrigin, callback, backendOrigin;
async function hashes() {
  const result = {};
  for (const name of sourcePaths) result[name] = createHash('sha256').update(await fs.readFile(fileURLToPath(new URL('../' + name, import.meta.url)))).digest('hex');
  return result;
}
const listen = (target, port = 0) => new Promise((resolve, reject) => { target.once('error', reject); target.listen(port, '127.0.0.1', resolve); });
async function reservePort() { const target = net.createServer(); await listen(target); const port = target.address().port; await new Promise(resolve => target.close(resolve)); return port; }
async function body(req) { let raw = ''; for await (const chunk of req) { raw += chunk; assert.ok(raw.length <= 8192); } return new URLSearchParams(raw); }
function send(res, status, value, headers = {}) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(value)); }
function cors(req, res) { if (req.headers.origin === origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); } }
async function handleIdentity(req, res) {
  const url = new URL(req.url, identityOrigin);
  if (url.pathname === '/auth/v1/oauth/authorize' && req.method === 'GET') {
    assert.equal(url.searchParams.get('client_id'), clientId); assert.equal(url.searchParams.get('redirect_uri'), callback);
    assert.equal(url.searchParams.get('response_type'), 'code'); assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    for (const name of ['state', 'code_challenge']) assert.match(url.searchParams.get(name), /^[A-Za-z0-9_-]{43}$/);
    report.counters.authorize++;
    const ticket = randomUUID(); transactions.set(ticket, { state: url.searchParams.get('state'), challenge: url.searchParams.get('code_challenge') });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': `default-src 'none'; form-action 'self' ${origin}` });
    res.end(`<!doctype html><html lang="ko"><meta charset="utf-8"><title>로컬 HTTPS 로그인 시험</title><h1>합성 계정 연결 시험</h1><p>이 화면은 로컬 시험 전용입니다.</p><form method="post" action="/fixture/decision"><input type="hidden" name="ticket" value="${ticket}"><button>시험 계정 연결</button></form></html>`); return;
  }
  if (url.pathname === '/fixture/decision' && req.method === 'POST') {
    const input = await body(req), transaction = transactions.get(input.get('ticket')); assert.ok(transaction); transactions.delete(input.get('ticket'));
    const destination = new URL(callback), code = randomUUID(); codes.set(code, { ...transaction, used: false });
    destination.searchParams.set('state', transaction.state); destination.searchParams.set('code', code);
    res.writeHead(303, { Location: destination.href, 'Cache-Control': 'no-store' }); res.end(); return;
  }
  if (req.method === 'OPTIONS' && ['/auth/v1/oauth/token', '/auth/v1/logout'].includes(url.pathname)) {
    cors(req, res); res.writeHead(204, { 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'content-type,authorization,apikey', 'Access-Control-Allow-Private-Network': 'true' }); res.end(); return;
  }
  if (url.pathname === '/auth/v1/oauth/token' && req.method === 'POST') {
    cors(req, res); const input = await body(req), grant = codes.get(input.get('code'));
    assert.equal(input.get('grant_type'), 'authorization_code'); assert.equal(input.get('client_id'), clientId); assert.equal(input.get('redirect_uri'), callback);
    assert.ok(grant && !grant.used); assert.equal(createHash('sha256').update(input.get('code_verifier') || '').digest('base64url'), grant.challenge);
    grant.used = true; report.counters.acceptedS256++; const token = randomUUID(); access.set(token, accountId);
    send(res, 200, { access_token: token, refresh_token: randomUUID(), expires_in: 3600, token_type: 'bearer' }); return;
  }
  if (url.pathname === '/auth/v1/logout' && req.method === 'POST') {
    cors(req, res); assert.equal(url.searchParams.get('scope'), 'local');
    const token = (req.headers.authorization || '').replace(/^Bearer /, ''); assert.equal(access.get(token), accountId);
    access.delete(token); report.counters.logout++; send(res, 200, { ok: true }); return;
  }
  if (url.pathname === '/functions/v1/synk-account' && req.method === 'GET') {
    assert.equal(req.headers.apikey, publicKey); assert.equal(req.headers['x-synk-product'], 'platform'); assert.equal(req.headers['x-synk-contract'], '1');
    const actor = access.get((req.headers.authorization || '').replace(/^Bearer /, '')); report.counters.centralIdentityChecks++;
    send(res, actor ? 200 : 401, actor ? { ok: true, account: { synk_user_id: actor, status: 'active' } } : { ok: false, error: { code: 'AUTH_REQUIRED' } }); return;
  }
  send(res, 404, { ok: false });
}
function forward(req, res) {
  try {
    assert.equal(req.socket.encrypted, true); assert.equal(req.headers.host, new URL(origin).host); report.counters.tlsRequests++;
    if (new URL(req.url, origin).searchParams.has('code')) report.callbackRequests.push({ method: req.method, path: new URL(req.url, origin).pathname, fetchSite: req.headers['sec-fetch-site'] || null, origin: req.headers.origin || null });
    const headers = { ...req.headers };
    for (const key of Object.keys(headers)) if (key === 'forwarded' || key.startsWith('x-forwarded-')) delete headers[key];
    headers.host = new URL(backendOrigin).host; headers['x-forwarded-host'] = new URL(origin).host; headers['x-forwarded-proto'] = 'https';
    report.counters.forwardedRequests++;
    const upstream = http.request(new URL(req.url, backendOrigin), { method: req.method, headers }, response => { res.writeHead(response.statusCode, response.headers); response.pipe(res); });
    upstream.on('error', () => { report.errors.push('loopback reverse proxy request failed'); if (!res.headersSent) send(res, 502, { ok: false }); else res.end(); }); req.pipe(upstream);
  } catch (error) { report.errors.push(error.message); send(res, 500, { ok: false }); }
}
const snapshot = page => page.evaluate(() => window.synkDating.snapshot());
async function waitView(page) { await page.waitForFunction(() => !!window.synkDating?.snapshot().view); return snapshot(page); }
const idle = page => page.waitForFunction(() => !document.getElementById('content').hasAttribute('aria-busy'));
const hasSession = page => page.evaluate(() => !!sessionStorage.getItem('synk.oauth.session.dating'));
async function pageFor(width) {
  // This exception is confined to these local fixture browser contexts. It
  // neither disables Node TLS verification nor trusts a certificate globally.
  const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'Asia/Seoul', serviceWorkers: 'block', ignoreHTTPSErrors: true }); contexts.push(context);
  await context.route('**/*', route => { const requestOrigin = new URL(route.request().url()).origin; if (![origin, identityOrigin].includes(requestOrigin)) { report.externalRequests.push(requestOrigin); return route.abort(); } return route.continue(); });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('requestfailed', req => report.failedRequests.push({ path: new URL(req.url()).pathname, error: req.failure()?.errorText }));
  page.on('response', response => {
    const url = new URL(response.url()); if (response.status() >= 400) report.failedResponses.push({ path: url.pathname, status: response.status() });
    if (url.origin === origin && !url.pathname.startsWith('/api/')) report.staticResponses.push({ path: url.pathname, status: response.status(), contentType: response.headers()['content-type'] || null });
  });
  page.on('request', req => { if (new URL(req.url()).pathname === '/api/atlas-dating/action' && req.method() === 'POST') report.counters.productActions++; });
  await page.goto(callback); await page.locator('[data-action="signin"]').waitFor();
  assert.equal(await hasSession(page), false); assert.equal((await snapshot(page)).view, null); assert.equal(await page.evaluate(() => isSecureContext), true);
  assert.equal(await page.locator('#lab-link').isVisible(), false);
  return page;
}
async function login(page) {
  await page.locator('[data-action="signin"]').click(); await page.waitForURL(url => url.origin === identityOrigin && url.pathname === '/auth/v1/oauth/authorize');
  await page.getByRole('button', { name: '시험 계정 연결', exact: true }).click(); await page.waitForURL(callback); await waitView(page);
  assert.equal(page.url(), callback); assert.equal(await page.evaluate(() => sessionStorage.getItem('dating.synk.oauth.pending.platform')), null);
}
async function capture(page, name) {
  await page.evaluate(() => document.fonts.ready); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const filename = name + '.png'; await page.screenshot({ path: path.join(out, filename), fullPage: false }); report.screenshots.push(filename);
}
try {
  assert.notEqual(process.env.NODE_TLS_REJECT_UNAUTHORIZED, '0'); await fs.mkdir(out, { recursive: true }); report.sourceBefore = await hashes();
  const openssl = process.env.SYNK_QA_OPENSSL || (process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/openssl.exe' : 'openssl');
  const keyPath = path.join(tmp, 'fixture-key.pem'), certPath = path.join(tmp, 'fixture-cert.pem');
  await execute(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes', '-keyout', keyPath, '-out', certPath, '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { windowsHide: true, timeout: 15000 });
  const productPort = await reservePort(); origin = `https://127.0.0.1:${productPort}`; callback = origin + '/atlas-lab/dating.html';
  identity = http.createServer((req, res) => { void handleIdentity(req, res).catch(() => { report.errors.push('synthetic identity fixture assertion failed'); if (!res.headersSent) send(res, 500, { error: 'fixture_error' }); else res.end(); }); });
  await listen(identity); identityOrigin = `http://127.0.0.1:${identity.address().port}`;
  server = createDatingServer({ mode: 'account', databasePath: path.join(tmp, 'account.sqlite'),
    transport: { publicOrigin: origin, trustedProxyIPs: ['127.0.0.1'] },
    accountConfig: { version: 1, supabaseUrl: identityOrigin, supabasePublishableKey: publicKey, accountApiUrl: identityOrigin,
      portalUrl: identityOrigin + '/id/', clients: { platform: { clientId, redirectUri: callback } } } });
  await listen(server); backendOrigin = `http://127.0.0.1:${server.address().port}`;
  proxy = https.createServer({ key: await fs.readFile(keyPath), cert: await fs.readFile(certPath) }, forward); await listen(proxy, productPort);
  browser = await chromium.launch({ channel: 'chrome', headless: true });

  const first = await pageFor(390); await capture(first, 'https-signed-out-390'); await login(first);
  assert.equal((await snapshot(first)).view.accountId, accountId); assert.equal(report.counters.acceptedS256, 1);
  const form = first.locator('[data-onboarding-form]'); await form.locator('[name="nickname"]').fill(nickname); await form.locator('[name="adult"]').check();
  await form.locator('[data-action="onboard"]').click(); await idle(first);
  const saved = (await snapshot(first)).view; assert.equal(saved.onboarding.complete, true); assert.equal(saved.profile.nickname, nickname);
  assert.equal(saved.consents.profilePublic, false); assert.equal(saved.consents.receiveInvitations, false); assert.equal(saved.consents.storePreferences, false);
  await first.reload(); await waitView(first); assert.equal((await snapshot(first)).view.revision, saved.revision); assert.equal((await snapshot(first)).view.profile.nickname, nickname);
  assert.equal(await first.evaluate(name => JSON.stringify({ session: { ...sessionStorage }, local: { ...localStorage } }).includes(name), nickname), false);
  await capture(first, 'https-private-account-saved-390');
  report.paths.push('A real TLS connection terminates at a loopback reverse proxy, which overwrites forwarding headers before the account backend. The UI completes PKCE S256 through a separate synthetic identity service and saves first setup with every optional consent off. Reload restores the private profile from SQLite.');

  const second = await pageFor(1280); await login(second); assert.equal((await snapshot(second)).view.profile.nickname, nickname); assert.equal((await snapshot(second)).view.revision, saved.revision);
  assert.equal(report.counters.acceptedS256, 2); assert.equal(report.counters.productActions, 1); await capture(second, 'https-independent-account-restored-1280');
  report.paths.push('An independent desktop-sized browser context starts without credentials, completes its own PKCE flow over the TLS product origin and restores the same account without copying browser storage or resubmitting the profile.');

  await first.locator('[data-action="nav-settings"]').click();
  const logoutResponse = first.waitForResponse(response => new URL(response.url()).pathname === '/auth/v1/logout' && response.request().method() === 'POST');
  await first.locator('[data-action="signout"]').click();
  const loggedOut = await logoutResponse; assert.equal(loggedOut.status(), 200);
  // Private UI disappears immediately; wait for the action to release its
  // disabled controls before starting the reload that tests persistence.
  await first.waitForFunction(() => { const button = document.querySelector('[data-action="signin"]'); return button && !button.disabled; });
  assert.equal((await first.locator('#notice').innerText()).includes('서버의 로그인 종료는 다시 확인'), false);
  await idle(first); await first.locator('[data-action="signin"]').waitFor();
  assert.equal(await hasSession(first), false); assert.equal((await snapshot(first)).view, null); assert.equal((await first.locator('body').innerText()).includes(nickname), false);
  assert.equal(report.counters.logout, 1); await capture(first, 'https-logged-out-390'); await first.reload(); await first.locator('[data-action="signin"]').waitFor();
  assert.equal(await hasSession(first), false); await second.reload(); await waitView(second); assert.equal((await snapshot(second)).view.profile.nickname, nickname);
  report.paths.push('Logging out through the TLS origin removes local credentials and private UI, revokes only that synthetic session, and stays signed out after reload. The independent desktop session remains authorized.');

  const loaded = new Set(report.staticResponses.filter(row => row.status === 200).map(row => row.path));
  for (const pathname of ['/atlas-lab/dating.html', '/atlas-lab/dating.css', '/atlas-lab/dating-ui.mjs', '/atlas-lab/dating-account.mjs', '/synk-account/src/core.mjs']) assert.ok(loaded.has(pathname), `Required static dependency was not loaded: ${pathname}`);
  assert.ok([...loaded].some(name => /\.(?:webp|png)$/.test(name)), 'No felt image asset was loaded');
  assert.ok([...loaded].some(name => /\.woff2$/.test(name)), 'No font asset was loaded');
  assert.ok(report.counters.tlsRequests > 0); assert.equal(report.counters.tlsRequests, report.counters.forwardedRequests); assert.ok(report.counters.centralIdentityChecks >= 4);
  assert.equal(report.callbackRequests.length, 2); assert.ok(report.callbackRequests.every(request => request.method === 'GET' && request.fetchSite === 'cross-site'));
  assert.deepEqual(report.errors, []); assert.deepEqual(report.failedRequests, []); assert.deepEqual(report.failedResponses, []); assert.deepEqual(report.externalRequests, []);
  report.staticResponses = [...new Map(report.staticResponses.map(row => [row.path, row])).values()].sort((a, b) => a.path.localeCompare(b.path));
  report.paths.push('All browser-requested app modules, styles, fonts and felt assets load through the HTTPS static allowlist without failed requests, HTTP errors, page errors, external requests or horizontal overflow at 390 and 1280 pixels.');
  assert.deepEqual(await hashes(), report.sourceBefore); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; process.exitCode = 1; }
finally {
  report.sourceSha256 = await hashes(); report.sourceStable = JSON.stringify(report.sourceBefore) === JSON.stringify(report.sourceSha256);
  await fs.mkdir(out, { recursive: true }); await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  for (const context of contexts) await context.close().catch(() => {}); await browser?.close();
  for (const target of [proxy, server, identity]) if (target) { target.closeAllConnections(); await new Promise(resolve => target.close(resolve)); }
  const target = path.resolve(tmp); assert.equal(path.dirname(target), path.resolve(os.tmpdir())); assert.ok(path.basename(target).startsWith('synk-dating-https-browser-')); await fs.rm(target, { recursive: true, force: true });
  console.log(JSON.stringify({ status: report.status, paths: report.paths.length, counters: report.counters, sourceStable: report.sourceStable, errors: report.errors, failedRequests: report.failedRequests, failedResponses: report.failedResponses, externalRequests: report.externalRequests, failure: report.failure, report: path.join(out, 'result.json') }, null, 2));
}
