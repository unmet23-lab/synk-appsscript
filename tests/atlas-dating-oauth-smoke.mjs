// Finite free browser contract test. The identity endpoint exists only inside
// this test, holds generated credentials in memory and never calls a provider.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const out = fileURLToPath(new URL('../experiences/atlas-lab/qa/dating-oauth/', import.meta.url));
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-dating-oauth-browser-'));
const clientId = 'synthetic-dating-oauth-browser', publicKey = 'sb_publishable_synthetic_dating_oauth';
const accountId = 'synk:synthetic-oauth-account', nickname = '합성 OAuth 저장 계정';
const sources = ['dating-ui.mjs', 'dating-account.mjs', 'dating-auth.mjs', 'dating-server.mjs', 'dating-service.mjs'];
const report = { kind: 'synthetic-dating-oauth-browser', at: new Date().toISOString(), status: 'running', actualUsers: 0, realProviderRequests: 0, modelCalls: 0, externalApiCost: 0,
  credentialInjection: false, verifierInjection: false, paths: [], errors: [], externalRequests: [], screenshots: [],
  counters: { authorize: 0, decisions: 0, tokenRequests: 0, acceptedS256: 0, rejectedTokens: 0, centralIdentityChecks: 0, productActions: 0 } };
const transactions = new Map(), codes = new Map(), access = new Map(), contexts = [];
let browser, identity, server, origin, identityOrigin, callback, successfulCallback;
async function hashes() {
  const result = {};
  for (const name of sources) result[name] = createHash('sha256').update(await fs.readFile(fileURLToPath(new URL('../experiences/atlas-lab/' + name, import.meta.url)))).digest('hex');
  result['synk-account/core.mjs'] = createHash('sha256').update(await fs.readFile(fileURLToPath(new URL('../experiences/synk-account/src/core.mjs', import.meta.url)))).digest('hex');
  result['atlas-dating-oauth-smoke.mjs'] = createHash('sha256').update(await fs.readFile(fileURLToPath(import.meta.url))).digest('hex');
  return result;
}
const listen = (target, port = 0) => new Promise(resolve => target.listen(port, '127.0.0.1', resolve));
async function reservePort() { const reservation = net.createServer(); await listen(reservation); const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve)); return port; }
async function body(req) { let raw = ''; for await (const chunk of req) { raw += chunk; assert.ok(raw.length <= 8192); } return new URLSearchParams(raw); }
function send(res, status, value, headers = {}) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(value)); }
function cors(req, res) { if (req.headers.origin === origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); } }
async function handleIdentity(req, res) {
  const url = new URL(req.url, identityOrigin);
  if (url.pathname === '/auth/v1/oauth/authorize' && req.method === 'GET') {
    assert.equal(url.searchParams.get('client_id'), clientId); assert.equal(url.searchParams.get('redirect_uri'), callback);
    assert.equal(url.searchParams.get('response_type'), 'code'); assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    for (const field of ['state', 'code_challenge']) assert.match(url.searchParams.get(field), /^[A-Za-z0-9_-]{43}$/);
    for (const field of url.searchParams.keys()) assert.equal(url.searchParams.getAll(field).length, 1);
    report.counters.authorize++;
    const ticket = randomUUID(); transactions.set(ticket, { state: url.searchParams.get('state'), challenge: url.searchParams.get('code_challenge') });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': `default-src 'none'; form-action 'self' ${origin}` });
    res.end(`<!doctype html><html lang="ko"><meta charset="utf-8"><title>로컬 OAuth 시험</title><h1>합성 계정 연결 시험</h1><p>외부 인증 서비스와 실제 사용자 정보는 사용하지 않습니다.</p><form method="post" action="/fixture/decision"><input type="hidden" name="ticket" value="${ticket}"><button name="choice" value="approve">시험 계정 연결</button><button name="choice" value="deny">연결 취소</button><button name="choice" value="wrong-state">잘못된 상태 시험</button></form></html>`);
    return;
  }
  if (url.pathname === '/fixture/decision' && req.method === 'POST') {
    const input = await body(req), transaction = transactions.get(input.get('ticket'));
    assert.ok(transaction); transactions.delete(input.get('ticket')); report.counters.decisions++;
    const destination = new URL(callback), choice = input.get('choice');
    destination.searchParams.set('state', choice === 'wrong-state' ? 'synthetic-mismatched-state' : transaction.state);
    if (choice === 'deny') destination.searchParams.set('error', 'access_denied');
    else {
      assert.ok(['approve', 'wrong-state'].includes(choice)); const code = randomUUID();
      codes.set(code, { ...transaction, accountId, used: false }); destination.searchParams.set('code', code);
    }
    if (choice === 'approve' && !successfulCallback) successfulCallback = destination.href;
    res.writeHead(303, { Location: destination.href, 'Cache-Control': 'no-store' }); res.end(); return;
  }
  if (url.pathname === '/auth/v1/oauth/token' && req.method === 'OPTIONS') {
    cors(req, res); res.writeHead(204, { 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'content-type' }); res.end(); return;
  }
  if (url.pathname === '/auth/v1/oauth/token' && req.method === 'POST') {
    cors(req, res); report.counters.tokenRequests++; const input = await body(req), grant = codes.get(input.get('code'));
    const challenge = createHash('sha256').update(input.get('code_verifier') || '').digest('base64url');
    if (input.get('grant_type') !== 'authorization_code' || input.get('client_id') !== clientId || input.get('redirect_uri') !== callback || !grant || grant.used || challenge !== grant.challenge) {
      report.counters.rejectedTokens++; send(res, 400, { error: 'invalid_grant' }); return;
    }
    grant.used = true; report.counters.acceptedS256++;
    const token = randomUUID(); access.set(token, grant.accountId);
    send(res, 200, { access_token: token, refresh_token: randomUUID(), expires_in: 3600, token_type: 'bearer' }); return;
  }
  if (url.pathname === '/functions/v1/synk-account' && req.method === 'GET') {
    const actor = access.get((req.headers.authorization || '').replace(/^Bearer /, ''));
    assert.equal(req.headers.apikey, publicKey); assert.equal(req.headers['x-synk-product'], 'platform'); assert.equal(req.headers['x-synk-contract'], '1');
    report.counters.centralIdentityChecks++;
    send(res, actor ? 200 : 401, actor ? { ok: true, account: { synk_user_id: actor, status: 'active' } } : { ok: false, error: { code: 'AUTH_REQUIRED' } }); return;
  }
  send(res, 404, { ok: false });
}
const snapshot = page => page.evaluate(() => window.synkDating.snapshot());
const waitView = async page => { await page.waitForFunction(() => !!window.synkDating?.snapshot().view); return snapshot(page); };
const idle = page => page.waitForFunction(() => !document.getElementById('content').hasAttribute('aria-busy'));
const hasSession = page => page.evaluate(() => !!sessionStorage.getItem('synk.oauth.session.dating'));
async function cleanURL(page) { assert.equal(page.url(), callback); }
async function pageFor() {
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: 'Asia/Seoul', serviceWorkers: 'block' }); contexts.push(context);
  await context.route('**/*', route => { const requestOrigin = new URL(route.request().url()).origin; if (![origin, identityOrigin].includes(requestOrigin)) { report.externalRequests.push(requestOrigin); return route.abort(); } return route.continue(); });
  const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', error => report.errors.push(error.message));
  page.on('request', req => { if (new URL(req.url()).pathname === '/api/atlas-dating/action' && req.method() === 'POST') report.counters.productActions++; });
  await page.goto(callback); await page.locator('[data-action="signin"]').waitFor(); assert.equal(await hasSession(page), false); assert.equal((await snapshot(page)).view, null); return page;
}
async function begin(page) { await page.locator('[data-action="signin"]').click(); await page.waitForURL(url => url.origin === identityOrigin && url.pathname === '/auth/v1/oauth/authorize'); }
async function decide(page, choice) { await page.locator(`[name="choice"][value="${choice}"]`).click(); await page.waitForURL(url => url.origin === origin && url.pathname === '/atlas-lab/dating.html'); }
async function capture(page, name) {
  await page.evaluate(() => document.fonts.ready); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const filename = name + '.png'; await page.screenshot({ path: path.join(out, filename), fullPage: false }); report.screenshots.push(filename);
}
async function rejected(page, message) {
  await page.locator('#notice').filter({ hasText: message }).waitFor(); await cleanURL(page); assert.equal((await snapshot(page)).view, null); assert.equal(await hasSession(page), false);
}

try {
  await fs.mkdir(out, { recursive: true }); report.sourceBefore = await hashes();
  const productPort = await reservePort(); origin = `http://127.0.0.1:${productPort}`; callback = origin + '/atlas-lab/dating.html';
  identity = http.createServer((req, res) => { void handleIdentity(req, res).catch(() => { report.errors.push('synthetic identity fixture assertion failed'); if (!res.headersSent) send(res, 500, { error: 'fixture_error' }); else res.end(); }); });
  await listen(identity); identityOrigin = `http://127.0.0.1:${identity.address().port}`;
  server = createDatingServer({ mode: 'account', databasePath: path.join(tmp, 'account.sqlite'), accountConfig: { version: 1, supabaseUrl: identityOrigin, supabasePublishableKey: publicKey,
    accountApiUrl: identityOrigin, portalUrl: identityOrigin + '/id/', clients: { platform: { clientId, redirectUri: callback } } } });
  await listen(server, productPort); browser = await chromium.launch({ channel: 'chrome', headless: true });

  const first = await pageFor(); await begin(first); await decide(first, 'approve'); await waitView(first); await cleanURL(first);
  assert.equal((await snapshot(first)).view.accountId, accountId); assert.equal(report.counters.acceptedS256, 1); assert.ok(report.counters.centralIdentityChecks > 0);
  const form = first.locator('[data-onboarding-form]'); await form.locator('[name="nickname"]').fill(nickname); await form.locator('[name="adult"]').check();
  await form.locator('[data-action="onboard"]').click(); await idle(first); assert.equal((await snapshot(first)).view.onboarding.complete, true);
  const revision = (await snapshot(first)).view.revision; await first.reload(); await waitView(first); await cleanURL(first);
  assert.equal((await snapshot(first)).view.profile.nickname, nickname); assert.equal((await snapshot(first)).view.revision, revision); assert.equal(report.counters.acceptedS256, 1);
  assert.equal(await first.evaluate(() => sessionStorage.getItem('dating.synk.oauth.pending.platform')), null);
  assert.equal(await first.evaluate(name => JSON.stringify({ session: { ...sessionStorage }, local: { ...localStorage } }).includes(name), nickname), false);
  report.paths.push('Actual dating sign-in -> separate loopback consent -> valid S256 code exchange -> default server identity verifier; private first setup persists across reload without a second token exchange or profile storage in the browser.');
  await capture(first, 'oauth-saved-account-390');

  const second = await pageFor(); await begin(second); await decide(second, 'approve'); await waitView(second); await cleanURL(second);
  assert.equal((await snapshot(second)).view.profile.nickname, nickname); assert.equal((await snapshot(second)).view.revision, revision);
  assert.equal(report.counters.acceptedS256, 2); assert.equal(report.counters.productActions, 1);
  report.paths.push('A second isolated browser context starts signed out, obtains its own PKCE session and restores the same saved account from SQLite without copying browser credentials or resubmitting profile data.');
  await capture(second, 'oauth-second-context-restored-390');

  const cancelled = await pageFor(), beforeCancel = report.counters.tokenRequests; await begin(cancelled); await decide(cancelled, 'deny');
  await rejected(cancelled, '제품 연결을 취소했어요'); assert.equal(report.counters.tokenRequests, beforeCancel);
  assert.equal(await cancelled.evaluate(() => sessionStorage.getItem('dating.synk.oauth.pending.platform')), null);
  report.paths.push('A real access_denied callback removes the pending transaction and OAuth URL fields, shows cancellation, and creates no token request or account view.');
  await capture(cancelled, 'oauth-cancelled-390');

  const mismatch = await pageFor(), beforeMismatch = report.counters.tokenRequests; await begin(mismatch); await decide(mismatch, 'wrong-state');
  await rejected(mismatch, '로그인 요청이 만료되었거나 상태가 달라졌어요'); assert.equal(report.counters.tokenRequests, beforeMismatch);
  await capture(mismatch, 'oauth-state-rejected-390'); await begin(mismatch); await decide(mismatch, 'approve'); await waitView(mismatch); await cleanURL(mismatch);
  assert.equal((await snapshot(mismatch)).view.profile.nickname, nickname); assert.equal(report.counters.acceptedS256, 3);
  report.paths.push('A mismatched-state callback is cleaned and rejected before token exchange; an explicit new sign-in creates a fresh PKCE transaction and restores the account successfully.');

  const beforeReplay = report.counters.tokenRequests; await first.goto(successfulCallback);
  await first.locator('#notice').filter({ hasText: '이 브라우저에서 시작한 로그인 요청이 아니에요' }).waitFor(); await cleanURL(first);
  assert.equal((await snapshot(first)).view, null); assert.equal(report.counters.tokenRequests, beforeReplay);
  assert.equal((await first.locator('body').innerText()).includes(nickname), false); await capture(first, 'oauth-replay-rejected-390');
  await first.reload(); await waitView(first); assert.equal((await snapshot(first)).view.profile.nickname, nickname);
  report.paths.push('Replaying an already-consumed callback makes no second token request and exposes no profile in the rejected page; a clean reload uses the still-valid prior account session.');

  assert.deepEqual(report.errors, []); assert.deepEqual(report.externalRequests, []); assert.equal(report.counters.productActions, 1);
  assert.equal(report.counters.acceptedS256, 3); assert.equal(report.counters.rejectedTokens, 0); assert.deepEqual(await hashes(), report.sourceBefore); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; process.exitCode = 1; }
finally {
  report.sourceSha256 = await hashes(); report.sourceStable = JSON.stringify(report.sourceBefore) === JSON.stringify(report.sourceSha256);
  await fs.mkdir(out, { recursive: true }); await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  for (const context of contexts) await context.close().catch(() => {}); await browser?.close();
  for (const target of [server, identity]) if (target) { target.closeAllConnections(); await new Promise(resolve => target.close(resolve)); }
  const target = path.resolve(tmp); assert.equal(path.dirname(target), path.resolve(os.tmpdir())); assert.ok(path.basename(target).startsWith('synk-dating-oauth-browser-')); await fs.rm(target, { recursive: true, force: true });
  console.log(JSON.stringify(report, null, 2));
}
