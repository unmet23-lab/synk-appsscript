// Real local SQLite failures through HTTP and the existing browser UI. Synthetic
// accounts only; no HTTP response mocking, provider calls or physical disk fill.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';
import { captureDatingDatabase, armReceiptFull } from './lib/dating-sqlite-faults.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const out = fileURLToPath(new URL('../experiences/atlas-lab/qa/dating-storage/', import.meta.url));
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-dating-storage-browser-'));
const sources = ['experiences/atlas-lab/dating-store.mjs', 'experiences/atlas-lab/dating-service.mjs', 'experiences/atlas-lab/dating-server.mjs', 'experiences/atlas-lab/dating-account.mjs', 'experiences/atlas-lab/dating-ui.mjs', 'experiences/atlas-lab/dating-delivery.mjs', 'experiences/atlas-lab/dating-checkpoint.mjs', 'experiences/atlas-lab/onboarding-drafts.mjs', 'tests/atlas-dating-storage-smoke.mjs', 'tests/lib/dating-sqlite-faults.mjs'];
const report = { kind: 'synthetic-dating-live-sqlite-storage-browser', at: new Date().toISOString(), status: 'running', actualUsers: 0, realProviderRequests: 0, physicalDevices: 0, modelCalls: 0, externalApiCost: 0, syntheticSessionInjection: true, syntheticVerifierInjection: true, injectedHttpFailures: false, physicalDiskExhaustion: false, sqliteFaults: ['query_only', 'max_page_count with a test-only receipt trigger allocation'], paths: [], errors: [], externalRequests: [], screenshots: [], posts: [], responses: [] };
let browser, server;
const listen = (target, port = 0) => new Promise((resolve, reject) => { target.once('error', reject); target.listen(port, '127.0.0.1', resolve); });
async function hashes() { const result = {}; for (const name of sources) result[name] = createHash('sha256').update(await fs.readFile(fileURLToPath(new URL('../' + name, import.meta.url)))).digest('hex'); return result; }
const snapshot = page => page.evaluate(() => window.synkDating.snapshot());
const idle = page => page.waitForFunction(() => !document.getElementById('content').hasAttribute('aria-busy'));
const form = page => page.locator('[data-onboarding-form]');
const posts = label => report.posts.filter(row => row.scenario === label);
const replies = (label, endpoint) => report.responses.filter(row => row.scenario === label && row.endpoint === endpoint);
const marker = page => page.evaluate(() => JSON.parse(sessionStorage.getItem('synk.dating.delivery.checkpoint.v1')));
async function values(page) { const result = {}; for (const name of ['nickname', 'region', 'intro']) result[name] = await form(page).locator(`[name="${name}"]`).inputValue(); for (const name of ['adult', 'public', 'invites', 'save']) result[name] = await form(page).locator(`[name="${name}"]`).isChecked(); return result; }
async function click(page, key) { await page.locator(`[data-action="${key}"]`).click(); await idle(page); }
async function capture(page, name) {
  await page.evaluate(() => document.fonts.ready); await page.locator('[data-delivery-notice]').scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(await page.locator('img').evaluateAll(nodes => nodes.filter(node => !node.complete || !node.naturalWidth).map(node => node.src)), []);
  for (const fullPage of [false, true]) { const file = `${name}${fullPage ? '-full' : ''}.png`; await page.screenshot({ path: path.join(out, file), fullPage }); report.screenshots.push(file); }
}
async function retained(page, entered, expectedMarker) {
  assert.deepEqual(await values(page), entered); assert.equal((await snapshot(page)).hasPendingDelivery, true);
  assert.equal(await page.evaluate(() => !!sessionStorage.getItem('synk.oauth.session.dating')), true);
  assert.deepEqual(await marker(page), expectedMarker);
  assert.deepEqual(Object.keys(expectedMarker).sort(), ['version', 'requestId', 'actorId', 'demo', 'binding', 'createdAt'].sort());
  for (const name of Object.keys(entered)) assert.equal(await form(page).locator(`[name="${name}"]`).isDisabled(), true);
  assert.equal(await page.locator('[data-action="nav-settings"]').isDisabled(), true);
  assert.equal(await page.locator('[data-action="delivery-check"]').isEnabled(), true);
  assert.equal(await page.locator('[data-action="delivery-retry"]').isEnabled(), true);
}
async function scenario(label, width, accountIndex) {
  const reservation = net.createServer(); await listen(reservation); const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  const origin = `http://127.0.0.1:${port}`, actorId = `84000000-0000-4000-8000-00000000000${accountIndex}`, token = `synthetic-storage-${accountIndex}`;
  const config = { version: 1, supabaseUrl: 'https://synthetic-identity.example.test', supabasePublishableKey: 'sb_publishable_synthetic_fixture', accountApiUrl: 'https://synthetic-identity.example.test', portalUrl: 'https://synthetic-identity.example.test/id/', clients: { platform: { clientId: 'synthetic-storage-browser', redirectUri: origin + '/atlas-lab/dating.html' } } };
  const captured = captureDatingDatabase(() => createDatingServer({ mode: 'account', databasePath: path.join(tmp, `${label}.sqlite`), accountConfig: config, verify: async value => value === token ? { accountId: actorId } : null }));
  server = captured.value; const db = captured.database; await listen(server, port);
  const context = await browser.newContext({ viewport: { width, height: 950 }, timezoneId: 'Asia/Seoul', serviceWorkers: 'block' });
  await context.route('**/*', route => { const url = new URL(route.request().url()); if (url.origin !== origin) { report.externalRequests.push(url.origin); return route.abort(); } return route.continue(); });
  await context.addInitScript(({ config, token }) => sessionStorage.setItem('synk.oauth.session.dating', JSON.stringify({ binding: [config.supabaseUrl, config.accountApiUrl, config.clients.platform.clientId, config.clients.platform.redirectUri].join('|'), session: { access_token: token, refresh_token: 'synthetic-unused', expires_at: Date.now() + 3600000 } })), { config, token });
  const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', error => report.errors.push(error.message));
  const pendingResponses = [];
  page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/atlas-dating/action') { const body = request.postDataJSON(); report.posts.push({ scenario: label, requestId: body.requestId, expectedRevision: body.expectedRevision, kind: body.action?.kind }); } });
  page.on('response', response => { const endpoint = new URL(response.url()).pathname; if (['/api/atlas-dating/action', '/api/atlas-dating/receipt'].includes(endpoint)) pendingResponses.push((async () => { const body = await response.json(); report.responses.push({ scenario: label, endpoint, httpStatus: response.status(), ...(body.error ? { errorCode: body.error.code } : {}), ...(body.status ? { receiptStatus: body.status } : {}), ...(body.replayed !== undefined ? { replayed: body.replayed } : {}) }); })()); });
  await page.goto(origin + '/atlas-lab/dating.html'); await page.waitForFunction(() => !!window.synkDating?.snapshot().view); await idle(page);
  const originalRow = { ...db.prepare('SELECT * FROM dating_accounts WHERE id=?').get(actorId) };
  for (const [name, value] of Object.entries({ nickname: `저장 복구 시험 ${accountIndex}`, region: '합성 시험 지역', intro: '저장이 잠시 어려워도 내가 작성한 내용과 선택을 유지해 주세요.' })) await form(page).locator(`[name="${name}"]`).fill(value);
  await form(page).locator('[name="adult"]').check(); await form(page).locator('[name="public"]').check(); await form(page).locator('[name="save"]').check();
  const entered = await values(page); let recover;
  if (label === 'readonly') { db.exec('PRAGMA query_only=ON'); recover = () => db.exec('PRAGMA query_only=OFF'); } else recover = armReceiptFull(db);
  await click(page, 'onboard'); await Promise.all(pendingResponses);
  assert.equal(posts(label).length, 1); assert.equal(replies(label, '/api/atlas-dating/action')[0].httpStatus, 503);
  assert.equal(replies(label, '/api/atlas-dating/action')[0].errorCode, 'storage-unavailable');
  const checkpoint = await marker(page); assert.equal(checkpoint.requestId, posts(label)[0].requestId); await retained(page, entered, checkpoint);
  assert.deepEqual({ ...db.prepare('SELECT * FROM dating_accounts WHERE id=?').get(actorId) }, originalRow);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM dating_receipts WHERE actor=?').get(actorId).n, 0);
  await click(page, 'delivery-check'); await Promise.all(pendingResponses); await retained(page, entered, checkpoint);
  const during = replies(label, '/api/atlas-dating/receipt').at(-1);
  if (label === 'readonly') { assert.equal(during.httpStatus, 503); assert.equal(during.errorCode, 'storage-unavailable'); }
  else { assert.equal(during.httpStatus, 200); assert.equal(during.receiptStatus, 'not-found'); }
  await capture(page, `${label}-retains-input-and-pending-receipt-${width}`);
  await page.waitForTimeout(1200); assert.equal(posts(label).length, 1);
  recover(); await click(page, 'delivery-check'); await Promise.all(pendingResponses);
  assert.equal(replies(label, '/api/atlas-dating/receipt').at(-1).receiptStatus, 'not-found'); await retained(page, entered, checkpoint);
  assert.match(await page.locator('#notice').innerText(), /저장 확인 기록이 아직 없어요/); assert.equal(posts(label).length, 1);
  await capture(page, `${label}-recovered-awaits-user-retry-${width}`);
  await page.waitForTimeout(1200); assert.equal(posts(label).length, 1);
  await click(page, 'delivery-retry'); await Promise.all(pendingResponses);
  assert.equal(posts(label).length, 2); assert.deepEqual(posts(label)[1], posts(label)[0]);
  const view = (await snapshot(page)).view, row = db.prepare('SELECT * FROM dating_accounts WHERE id=?').get(actorId);
  assert.equal(view.onboarding.complete, true); assert.equal(view.profile.nickname, entered.nickname); assert.equal(view.profile.region, entered.region); assert.equal(view.profile.intro, entered.intro);
  assert.equal(view.adult.selfDeclared, entered.adult); assert.deepEqual(view.consents, { profilePublic: entered.public, receiveInvitations: entered.invites, storePreferences: entered.save });
  assert.equal(view.revision, originalRow.revision + 1); assert.equal(row.revision, view.revision);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM dating_receipts WHERE actor=?').get(actorId).n, 1);
  assert.equal((await snapshot(page)).hasPendingDelivery, false); assert.equal(await marker(page), null);
  assert.equal(await page.evaluate(() => !!sessionStorage.getItem('synk.oauth.session.dating')), true);
  assert.equal(replies(label, '/api/atlas-dating/action').at(-1).httpStatus, 200); assert.equal(replies(label, '/api/atlas-dating/action').at(-1).replayed, false);
  report.paths.push({ scenario: label, width, initialStatus: 503, receiptDuringFault: during.httpStatus, result: 'Real SQLite failure rolls back all onboarding data and its receipt. The browser keeps all text, checkboxes, session and receipt-only checkpoint; no automatic POST occurs. Recovery returns not-found; an explicit same-request retry stores exactly one revision and receipt.' });
  await context.close(); await server.shutdownDating(); server = null;
}
try {
  await fs.mkdir(out, { recursive: true }); report.sourceBefore = await hashes(); browser = await chromium.launch({ channel: 'chrome', headless: true });
  await scenario('readonly', 320, 1); await scenario('full', 390, 2);
  assert.deepEqual(report.errors, []); assert.deepEqual(report.externalRequests, []); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; process.exitCode = 1; }
finally {
  report.sourceAfter = await hashes(); report.sourceStable = JSON.stringify(report.sourceBefore) === JSON.stringify(report.sourceAfter);
  await browser?.close(); if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  const target = path.resolve(tmp); assert.equal(path.dirname(target), path.resolve(os.tmpdir())); assert.ok(path.basename(target).startsWith('synk-dating-storage-browser-')); await fs.rm(target, { recursive: true, force: true });
  const file = report.status === 'failed' ? `failed-${Date.now()}.json` : 'result.json'; await fs.writeFile(path.join(out, file), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, paths: report.paths.length, errors: report.errors, externalRequests: report.externalRequests, sourceStable: report.sourceStable, failure: report.failure || null, output: path.join(out, file) }));
}
