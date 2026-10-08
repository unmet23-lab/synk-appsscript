// Free local browser checks: opt-in memory, cross-tab revisions, and two isolated roles.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from '../experiences/learning-hub/server.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const output = fileURLToPath(new URL('../experiences/atlas-lab/qa/next/', import.meta.url));
const report = { at: new Date().toISOString(), status: 'running', modelCalls: 0, actualUsers: 0, externalRequests: [], errors: [], paths: [], screenshots: [] };
let server, browser, origin;
const action = (p, name) => p.locator(`[data-participant-action="${name}"]`);
const inspect = p => p.evaluate(() => window.synkAtlasParticipant.snapshot());
async function details(page, selector) { if (!(await page.locator(selector).evaluate(n => n.open))) await page.locator(selector + ' > summary').click(); }
async function ready(page) { await details(page, '.discovery-reset'); await page.locator('[data-discovery-scenario="ready"]').click(); }
async function select(page, candidate = 'candidate-1') { await page.locator(`[data-discovery-select="${candidate}"]`).click(); }
async function load(page) { await page.goto(origin + '/atlas-lab/', { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForFunction(() => !!window.synkAtlasLab?.memory); }
async function screenshot(page, label, selector) {
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(overflow, false, label + ' overflow');
  const file = path.join(output, label + '.png'); await page.locator(selector).screenshot({ path: file }); report.screenshots.push(file);
}
async function context(width) {
  const ctx = await browser.newContext({ viewport: { width, height: 950 }, serviceWorkers: 'block' });
  await ctx.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) { report.externalRequests.push(url.href); return route.abort(); }
    if (url.pathname === '/api/computer-interpretation') return route.fulfill({ json: { available: false, reason: 'no-paid-host' } });
    if (url.pathname === '/api/me') return route.fulfill({ json: { user: null } });
    return route.continue();
  });
  ctx.on('page', page => { page.setDefaultTimeout(15000); page.on('pageerror', e => report.errors.push(e.message)); });
  return ctx;
}
async function memoryPath(width) {
  const ctx = await context(width), page = await ctx.newPage();
  await load(page); await ready(page); await select(page); await page.locator('[data-discovery-action="start-meeting"]').click();
  assert.equal((await page.evaluate(() => window.synkAtlasLab.memory())).enabled, false);
  await details(page, '.journey-memory:has(#journey-memory)');
  await page.locator('[data-memory-action="enable"]').click();
  await page.waitForFunction(() => window.synkAtlasLab.memory().enabled);
  const before = await page.evaluate(() => ({ d: window.synkAtlasLab.discovery(), m: window.synkAtlasLab.meeting() }));
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal((await page.evaluate(() => window.synkAtlasLab.discovery())).selection, null);
  await details(page, '.journey-memory:has(#journey-memory)'); await page.locator('[data-memory-action="resume"]').click();
  await page.waitForFunction(() => window.synkAtlasLab.memory().enabled);
  const after = await page.evaluate(() => ({ d: window.synkAtlasLab.discovery(), m: window.synkAtlasLab.meeting() }));
  assert.equal(after.d.selection.candidateId, before.d.selection.candidateId); assert.equal(after.m.connection.key, before.m.connection.key);
  // Same browser and DB, stale tab must not overwrite or resurrect a deletion.
  const other = await ctx.newPage(); await load(other); await details(other, '.journey-memory:has(#journey-memory)');
  await other.locator('[data-memory-action="resume"]').click(); await other.waitForFunction(() => window.synkAtlasLab.memory().enabled);
  await page.locator('[data-memory-action="forget"]').click(); await page.waitForFunction(() => !window.synkAtlasLab.memory().enabled);
  await other.locator('[data-discovery-action="unselect"]').click();
  await other.waitForFunction(() => !window.synkAtlasLab.memory().enabled);
  assert.match(await other.locator('#journey-memory-status').innerText(), /다른 탭/);
  await page.reload({ waitUntil: 'networkidle' }); await details(page, '.journey-memory:has(#journey-memory)');
  await page.locator('[data-memory-action="resume"]').click(); await page.waitForFunction(() => document.getElementById('journey-memory-status').textContent.includes('없어요'));
  assert.equal((await page.evaluate(() => window.synkAtlasLab.discovery())).selection, null);
  await screenshot(page, `memory-${width}`, '#journey-memory');
  report.paths.push({ label: `memory-${width}`, checks: ['default-no-save', 'opt-in', 'reload-resume', 'same-candidate', 'atomic-stale-tab-rejection', 'deletion-not-resurrected'] });
  await ctx.close();
}
async function contextPath(width) {
  const ctx = await context(width), page = await ctx.newPage(); await load(page); await ready(page);
  const snapshot = () => page.evaluate(() => window.synkAtlasLab.discovery());
  const pace = view => view.fields.find(f => f.id === 'wants.pace');
  assert.equal(pace(await snapshot()).baseline.value, 'lead');
  await details(page, '#discovery-editor'); await page.locator('#discovery-edit-value').selectOption('listen');
  await page.locator('#discovery-edit-target').selectOption('context');
  assert.equal(await page.locator('#discovery-edit-value').inputValue(), 'listen', 'changing scope must retain the unsaved answer');
  await page.locator('[data-discovery-action="preview"]').click();
  assert.equal(pace(await snapshot()).value, 'lead');
  await page.locator('[data-discovery-action="preview-apply"]').click();
  let field = pace(await snapshot()); assert.equal(field.baseline.value, 'lead'); assert.equal(field.value, 'listen');
  await screenshot(page, `context-${width}`, '#discovery-profile');
  await details(page, '#discovery-editor'); await page.locator('[data-discovery-action="mark-unknown"]').click();
  field = pace(await snapshot()); assert.equal(field.state, 'unknown'); assert.equal(field.baseline.value, 'lead');
  await details(page, '#discovery-editor'); await page.locator('[data-discovery-action="revert-context"]').click();
  assert.equal(pace(await snapshot()).value, 'lead');
  await select(page); await page.locator('[data-discovery-action="start-meeting"]').click();
  const prior = (await snapshot()).context.id; await page.locator('[data-discovery-action="close-context"]').click();
  assert.equal((await snapshot()).context.closed, true); assert.equal((await snapshot()).selection, null);
  assert.equal(await page.evaluate(() => window.synkAtlasLab.meeting()), null);
  await page.locator('[data-discovery-action="start-context"]').click();
  assert.notEqual((await snapshot()).context.id, prior); assert.equal(pace(await snapshot()).value, 'lead');
  const expiry = await page.evaluate(() => {
    const d = new Date(Date.now() + 10 * 60000), pad = n => String(n).padStart(2, '0');
    const input = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return { input, iso: new Date(input).toISOString() };
  });
  await page.locator('#discovery-context-expiry').fill(expiry.input); await page.locator('[data-discovery-action="start-context"]').click();
  assert.equal((await snapshot()).context.expiresAt, expiry.iso); assert.equal((await snapshot()).context.closed, false);
  report.paths.push({ label: `context-${width}`, checks: ['scope-edit-retains-answer', 'baseline-context-preview', 'apply-without-overwriting-baseline', 'explicit-unknown', 'revert', 'close-invalidates-meeting', 'new-context-preserves-baseline', 'real-current-time-future-deadline'] });
  console.log(`passed context-${width}`); await ctx.close();
}
async function click(page, name) { await action(page, name).click(); await page.waitForFunction(() => ![...document.querySelectorAll('[data-participant-action="refresh"]')].some(b => b.disabled)); }
async function latest(page) { await click(page, 'refresh'); }
async function participantPath(width) {
  const ctx = await context(width), lab = await ctx.newPage(); await load(lab); await ready(lab); await select(lab);
  await details(lab, '.journey-memory:has(#journey-participants)'); await lab.locator('[data-participant-action="create"]').click();
  const linkA = lab.locator('[data-participant-role="person-a"]'), linkB = lab.locator('[data-participant-role="person-b"]'); await linkB.waitFor();
  // Both pages deliberately share one browser cookie jar. Session cookie paths isolate roles.
  const a = await ctx.newPage(), b = await ctx.newPage(); await a.goto(await linkA.getAttribute('href')); await b.goto(await linkB.getAttribute('href'));
  await a.waitForFunction(() => !!window.synkAtlasParticipant?.snapshot()); await b.waitForFunction(() => !!window.synkAtlasParticipant?.snapshot());
  assert.equal(new URL(a.url()).hash, ''); assert.equal(new URL(b.url()).hash, '');
  assert.equal((await inspect(a)).me.id, 'person-a'); assert.equal((await inspect(b)).me.id, 'person-b');
  await click(a, 'answer-consent-true'); await latest(b); await click(b, 'answer-consent-true'); await latest(a);
  await click(a, 'propose'); await latest(b); await click(a, 'view'); await latest(b); await click(b, 'view');
  await latest(a); await click(a, 'accept'); await latest(b); await click(b, 'accept'); await latest(a);
  await click(a, 'met'); await latest(b);
  assert.equal((await inspect(b)).proposal.people.find(p => p.id === 'person-b').met, false);
  await click(a, 'feedback-too-long'); await click(a, 'intent-yes'); await latest(b);
  const own = await inspect(a), peer = await inspect(b);
  assert.equal(own.me.feedback.length, 1); assert.equal(peer.me.feedback.length, 0); assert.equal(peer.reconnect.me.intent, null);
  assert.ok(!JSON.stringify(peer).includes('too-long'));
  await details(a, '.meeting-editor:has(#participant-invitation)'); await a.locator('#participant-invitation').fill('다음에 짧게 이야기 나눠 볼까요?');
  await click(a, 'send-invitation'); await latest(b);
  assert.equal((await inspect(b)).reconnect.invitation.message, '다음에 짧게 이야기 나눠 볼까요?');
  await click(b, 'invite-busy'); await latest(a);
  assert.equal((await inspect(a)).reconnect.canSend, false);
  await click(b, 'reopen'); await latest(a);
  await screenshot(a, `participant-${width}-private`, '#participant-content');
  await click(b, 'block'); await latest(a);
  assert.equal((await inspect(a)).access.allowed, false); assert.ok(!JSON.stringify(await inspect(a)).includes('too-long'));
  assert.equal(await a.locator('#participant-invitation').count(), 0);
  await screenshot(a, `participant-${width}-closed`, '.participant-page');
  await click(b, 'block'); await latest(a); assert.equal((await inspect(a)).me.id, 'person-a');
  await a.reload(); await a.waitForFunction(() => !!window.synkAtlasParticipant?.snapshot()); assert.equal((await inspect(a)).me.id, 'person-a');
  await click(a, 'delete'); await latest(b); assert.equal(await inspect(b), null);
  report.paths.push({ label: `participant-${width}`, checks: ['same-cookie-jar-role-isolation', 'separate-consent', 'mutual-concrete-acceptance', 'self-only-completion-feedback', 'private-intent', 'explicit-send', 'busy-reopen', 'block-redaction', 'own-session-reload', 'pair-delete'] });
  await ctx.close();
}
try {
  await fs.mkdir(output, { recursive: true }); server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  await contextPath(1280); await contextPath(320); await memoryPath(1280); await memoryPath(390); await participantPath(1280); await participantPath(320);
  assert.deepEqual(report.errors, []); assert.deepEqual(report.externalRequests, []); report.status = 'passed';
} catch (e) { report.status = 'failed'; report.failure = e.stack; process.exitCode = 1; }
finally { await browser?.close(); if (server?.listening) await new Promise(resolve => server.close(resolve)); await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ status: report.status, groups: report.paths.length, failure: report.failure })); }
