// Free browser checks using local synthetic accounts and injected HTTP failures.
// This tests the real account/delivery UI; it is not a public provider/load test.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const out = fileURLToPath(new URL('../experiences/atlas-lab/qa/dating-operations/', import.meta.url));
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-dating-operations-browser-'));
const accounts = [1, 2, 3].map(i => ({ id: `83000000-0000-4000-8000-00000000000${i}`, token: `synthetic-operations-${i}` }));
const sourceNames = ['experiences/atlas-lab/dating-account.mjs', 'experiences/atlas-lab/dating-ui.mjs', 'experiences/atlas-lab/dating-delivery.mjs', 'experiences/atlas-lab/dating-checkpoint.mjs', 'experiences/atlas-lab/onboarding-drafts.mjs', 'experiences/atlas-lab/dating-server.mjs', 'experiences/atlas-lab/dating-service.mjs', 'tests/atlas-dating-operations-smoke.mjs'];
sourceNames.push('experiences/atlas-lab/dating-admission.mjs', 'experiences/atlas-lab/dating-shutdown.mjs', 'experiences/atlas-lab/dating-restore.mjs', 'experiences/atlas-lab/dating-runtime.mjs', 'experiences/learning-hub/server.mjs');
const report = { kind: 'synthetic-dating-operations-browser', at: new Date().toISOString(), status: 'running', actualUsers: 0, realProviderRequests: 0, physicalDevices: 0, modelCalls: 0, externalApiCost: 0, syntheticSessionInjection: true, syntheticVerifierInjection: true, injectedHttpFailures: true, paths: [], errors: [], externalRequests: [], screenshots: [], posts: [] };
let browser, server, origin, accountConfig;
async function hashes() { const value = {}; for (const name of sourceNames) value[name] = createHash('sha256').update(await fs.readFile(fileURLToPath(new URL('../' + name, import.meta.url)))).digest('hex'); return value; }
const listen = target => new Promise((resolve, reject) => { target.once('error', reject); target.listen(0, '127.0.0.1', resolve); });
const snap = page => page.evaluate(() => window.synkDating.snapshot());
const idle = page => page.waitForFunction(() => !document.getElementById('content').hasAttribute('aria-busy'));
const form = page => page.locator('[data-onboarding-form]');
const hasSession = page => page.evaluate(() => !!sessionStorage.getItem('synk.oauth.session.dating'));
async function values(page) { const result = {}; for (const name of ['nickname', 'region', 'intro']) result[name] = await form(page).locator(`[name="${name}"]`).inputValue(); for (const name of ['adult', 'public', 'invites', 'save']) result[name] = await form(page).locator(`[name="${name}"]`).isChecked(); return result; }
async function fill(page, index) { for (const [name, value] of Object.entries({ nickname: `연결 대기 시험 ${index}`, region: '합성 시험 지역', intro: '잠시 기다린 뒤 그대로 저장할 합성 소개' })) await form(page).locator(`[name="${name}"]`).fill(value); await form(page).locator('[name="adult"]').check(); return values(page); }
async function click(page, key) { await page.locator(`[data-action="${key}"]`).click(); await idle(page); }
async function stored(index) { const response = await fetch(origin + '/api/atlas-dating/state', { headers: { Origin: origin, Authorization: 'Bearer ' + accounts[index].token } }); assert.equal(response.status, 200); return (await response.json()).view; }
async function capture(page, name) { await page.evaluate(() => document.fonts.ready); await page.locator('#notice').scrollIntoViewIfNeeded(); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); assert.deepEqual(await page.locator('img').evaluateAll(nodes => nodes.filter(node => !node.complete || !node.naturalWidth).map(node => node.src)), []); const file = name + '.png'; await page.screenshot({ path: path.join(out, file), fullPage: true }); report.screenshots.push(file); }
async function pageFor(index, width) {
  const context = await browser.newContext({ viewport: { width, height: 950 }, timezoneId: 'Asia/Seoul', serviceWorkers: 'block' });
  await context.route('**/*', route => { const url = new URL(route.request().url()); if (url.origin !== origin) { report.externalRequests.push(url.origin); return route.abort(); } return route.continue(); });
  await context.addInitScript(({ config, token }) => sessionStorage.setItem('synk.oauth.session.dating', JSON.stringify({ binding: [config.supabaseUrl, config.accountApiUrl, config.clients.platform.clientId, config.clients.platform.redirectUri].join('|'), session: { access_token: token, refresh_token: 'synthetic-unused', expires_at: Date.now() + 3600000 } })), { config: accountConfig, token: accounts[index].token });
  const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', error => report.errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
  page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/atlas-dating/action') { const body = request.postDataJSON(); report.posts.push({ account: index, requestId: body.requestId, expectedRevision: body.expectedRevision, kind: body.action?.kind }); } });
  await page.goto(origin + '/atlas-lab/dating.html'); await page.waitForFunction(() => !!window.synkDating?.snapshot().view); await idle(page); return page;
}
const rejection = (status, code) => ({ status, contentType: 'application/json', headers: { 'Retry-After': '1' }, body: JSON.stringify({ ok: false, error: { code } }) });
const posts = index => report.posts.filter(row => row.account === index);
async function definiteRejection(index, status, code, width) {
  const page = await pageFor(index, width), entered = await fill(page, index), before = await stored(index);
  const reject = route => route.fulfill(rejection(status, code)); await page.route('**/api/atlas-dating/action', reject);
  await click(page, 'onboard'); assert.equal(posts(index).length, 1); assert.equal((await snap(page)).hasPendingDelivery, false); assert.equal(await page.locator('[data-delivery-notice]').count(), 0);
  assert.equal(await hasSession(page), true); assert.deepEqual(await values(page), entered); assert.match(await page.locator('#notice').innerText(), /잠시 뒤 다시 시도/);
  for (const name of Object.keys(entered)) assert.equal(await form(page).locator(`[name="${name}"]`).isEnabled(), true);
  assert.equal(await page.locator('[data-action="nav-settings"]').isEnabled(), true); assert.equal((await stored(index)).revision, before.revision);
  await capture(page, `${code}-retains-first-setup-${width}`);
  // A full second after the advertised Retry-After must not replay a mutation.
  await page.waitForTimeout(1100); assert.equal(posts(index).length, 1);
  await page.unroute('**/api/atlas-dating/action', reject); await click(page, 'onboard');
  const after = await stored(index); assert.equal(after.onboarding.complete, true); assert.equal(after.profile.nickname, entered.nickname); assert.equal(after.revision, before.revision + 1); assert.equal(posts(index).length, 2); assert.notEqual(posts(index)[0].requestId, posts(index)[1].requestId); assert.equal(await hasSession(page), true); assert.equal((await snap(page)).hasPendingDelivery, false);
  report.paths.push({ status, code, width, result: 'An explicit rejection retains every first-setup text/checkbox and session, unlocks inputs/navigation without a receipt checkpoint, and performs no automatic POST. A user click succeeds once with a fresh request ID and exactly one saved revision.' }); await page.context().close();
}
async function ambiguous503KeepsReceipt() {
  const index = 2, page = await pageFor(index, 390), entered = await fill(page, index), before = await stored(index);
  const committedUnavailable = async route => { const response = await route.fetch(); assert.equal(response.status(), 200); await response.body(); return route.fulfill(rejection(503, 'service-error')); };
  await page.route('**/api/atlas-dating/action', committedUnavailable); await click(page, 'onboard'); await page.unroute('**/api/atlas-dating/action', committedUnavailable);
  assert.equal((await snap(page)).hasPendingDelivery, true); assert.equal((await stored(index)).revision, before.revision + 1); assert.deepEqual(await values(page), entered); assert.equal(posts(index).length, 1); assert.equal(await hasSession(page), true);
  const restartingReceipt = route => route.fulfill(rejection(503, 'service-restarting')); await page.route('**/api/atlas-dating/receipt?*', restartingReceipt); await click(page, 'delivery-check');
  assert.equal((await snap(page)).hasPendingDelivery, true); assert.equal(await page.locator('[data-action="nav-settings"]').isDisabled(), true); assert.equal(posts(index).length, 1); assert.deepEqual(await values(page), entered);
  await capture(page, 'ambiguous-save-and-restarting-receipt-stay-pending-390'); await page.unroute('**/api/atlas-dating/receipt?*', restartingReceipt); await click(page, 'delivery-check');
  const view = (await snap(page)).view; assert.equal(view.onboarding.complete, true); assert.equal(view.profile.nickname, entered.nickname); assert.equal(view.revision, before.revision + 1); assert.equal((await snap(page)).hasPendingDelivery, false); assert.equal(posts(index).length, 1); assert.equal(await hasSession(page), true);
  report.paths.push({ status: 503, code: 'service-error', width: 390, result: 'A genuinely committed local save followed by generic 503 stays uncertain. A receipt GET returning explicit service-restarting does not erase that uncertainty or unlock mutations. A later receipt GET resolves the single committed save without another POST.' }); await page.context().close();
}
try {
  await fs.mkdir(out, { recursive: true }); report.sourceBefore = await hashes();
  const reservation = net.createServer(); await listen(reservation); const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve)); origin = `http://127.0.0.1:${port}`;
  accountConfig = { version: 1, supabaseUrl: 'https://synthetic-identity.example.test', supabasePublishableKey: 'sb_publishable_synthetic_fixture', accountApiUrl: 'https://synthetic-identity.example.test', portalUrl: 'https://synthetic-identity.example.test/id/', clients: { platform: { clientId: 'synthetic-operations-browser', redirectUri: origin + '/atlas-lab/dating.html' } } };
  server = createDatingServer({ mode: 'account', databasePath: path.join(tmp, 'account.sqlite'), accountConfig, verify: async token => { const actor = accounts.find(item => item.token === token); return actor ? { accountId: actor.id } : null; } });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); }); browser = await chromium.launch({ channel: 'chrome', headless: true });
  await definiteRejection(0, 429, 'account-busy', 390); await definiteRejection(1, 503, 'service-restarting', 320); await ambiguous503KeepsReceipt();
  assert.deepEqual(report.errors, []); assert.deepEqual(report.externalRequests, []); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; process.exitCode = 1; }
finally {
  report.sourceAfter = await hashes(); report.sourceStable = JSON.stringify(report.sourceBefore) === JSON.stringify(report.sourceAfter);
  await browser?.close(); if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  const target = path.resolve(tmp); assert.equal(path.dirname(target), path.resolve(os.tmpdir())); assert.ok(path.basename(target).startsWith('synk-dating-operations-browser-'));
  await fs.rm(target, { recursive: true, force: true });
  await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ status: report.status, paths: report.paths.length, errors: report.errors, externalRequests: report.externalRequests, sourceStable: report.sourceStable, failure: report.failure || null, output: out }));
}
