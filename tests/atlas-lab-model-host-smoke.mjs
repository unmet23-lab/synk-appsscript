// UI transport mocks only. No provider, model, account or held-out dataset.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from '../experiences/learning-hub/server.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const output = process.env.SYNK_MODEL_HOST_QA_OUTPUT ? path.resolve(process.env.SYNK_MODEL_HOST_QA_OUTPUT) : fileURLToPath(new URL('../experiences/atlas-lab/qa/model-host/', import.meta.url));
await fs.mkdir(output, { recursive: true });
const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`, browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { at: new Date().toISOString(), status: 'running', kind: 'mock-host-ui', paidModelCalls: 0, errors: [], externalRequests: [], paths: [], screens: [] };
const sourceText = '맥이 편해요.';
const state = page => page.evaluate(() => window.synkAtlasLab.interpretation());
function reply(packet, bad = false) { return { requestId: packet.requestId, revision: packet.revision, extractor: 'mock-host', held: [],
  proposals: [{ id: `${packet.sourceId}:p1`, field: 'os', value: 'mac', subject: 'self', stance: 'current', evidence: [{ sourceId: packet.sourceId, start: 0, end: packet.text.length, quote: bad ? '잘못된 인용' : packet.text }] }] }; }
async function checkPage(width) {
  const context = await browser.newContext({ viewport: { width, height: 900 } }), calls = [], waiting = [];
  let mode = 'success', deleteMode = 'success', deleteWaiting = null, storedResponses = 2; const deleteCalls = [];
  const privacy = () => ({ retentionHours: 24, storedResponses, pendingResponses: waiting.length, canDelete: true, nextExpiryAt: storedResponses ? '2026-10-07T00:00:00.000Z' : null });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) { report.externalRequests.push(url.href); return route.abort(); }
    if (url.pathname === '/api/me') return route.fulfill({ json: { user: { id: 'synthetic-admin' }, csrfToken: 'mock-csrf' } });
    if (url.pathname === '/api/computer-interpretation/privacy') return route.fulfill({ json: privacy() });
    if (url.pathname === '/api/computer-interpretation/delete') {
      deleteCalls.push(request.postDataJSON()); assert.deepEqual(request.postDataJSON(), {});
      assert.equal(request.headers()['x-csrf-token'], 'mock-csrf');
      if (deleteMode === 'hold') { deleteWaiting = route; return; }
      if (deleteMode === 'failure') return route.fulfill({ status: 503, json: { error: 'synthetic delete failure' } });
      storedResponses = 0; return route.fulfill({ json: { ...privacy(), deletedResponses: 2, cancelledPendingResponses: 0 } });
    }
    if (url.pathname !== '/api/computer-interpretation') return route.continue();
    if (request.method() === 'GET') return route.fulfill({ json: { available: true, providerLabel: 'OpenAI', modelLabel: 'mock-model' } });
    const packet = request.postDataJSON(); calls.push(packet);
    assert.deepEqual(Object.keys(packet).sort(), ['id', 'requestId', 'revision', 'sourceId', 'text'].sort());
    assert.equal(request.headers()['x-csrf-token'], 'mock-csrf');
    if (mode === 'hold') { waiting.push({ route, packet }); return; }
    if (mode === 'failure') return route.fulfill({ status: 503, json: { error: 'synthetic failure' } });
    if (mode === 'expired') return route.fulfill({ status: 410, json: { code: 'SYNK_COMPUTER_AI_RESPONSE_REMOVED' } });
    return route.fulfill({ json: reply(packet, mode === 'bad-quote') });
  });
  const page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
  const takeLate = async () => { assert.equal(waiting.length, 1); const delayed = waiting.shift(); await delayed.route.fulfill({ json: reply(delayed.packet) }).catch(() => {}); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); };
  await page.goto(origin + '/atlas-lab/'); await page.waitForFunction(() => !!window.synkAtlasLab);
  await page.locator('#model-host-status').filter({ hasText: 'mock-model' }).waitFor();
  assert.match(await page.locator('#model-host-disclosure').textContent(), /원문을 OpenAI에게 보내요/);
  assert.equal(calls.length, 0, 'opening the page does not send text');
  await page.locator('#consult-text').fill(sourceText); await page.locator('#interpret-ai').click();
  await page.locator('[data-field="os"]').waitFor();
  assert.deepEqual((await state(page)).answers, { uses: [] }, 'AI proposal is not an answer');
  await page.locator('[data-field="os"]').getByRole('button', { name: / 확인$/ }).click();
  assert.equal((await state(page)).answers.os, 'mac');
  mode = 'failure'; await page.locator('#interpret-ai').click();
  await page.locator('#interpret-status').filter({ hasText: 'AI 응답을 반영하지 못했어요' }).waitFor();
  assert.equal((await state(page)).answers.os, 'mac');
  assert.equal(calls.length, 2, 'failure does not automatically retry');
  mode = 'success'; await page.locator('#interpret-ai').click();
  await page.locator('#interpret-status').filter({ hasText: 'AI 제안' }).waitFor();
  await page.locator('[data-field="os"]').getByRole('button', { name: / 확인$/ }).click();
  const beforeDelete = await state(page);
  mode = 'hold'; await page.locator('#interpret-ai').click(); await page.locator('#interpret-cancel').waitFor();
  const deletedPacket = calls.at(-1); deleteMode = 'hold'; await page.locator('#interpret-delete-server').click();
  await page.locator('#model-privacy-status').filter({ hasText: '삭제를 확인하고 있어요' }).waitFor();
  assert.equal(await page.locator('#interpret-ai').isDisabled(), true);
  await takeLate(); assert.deepEqual((await state(page)).answers, beforeDelete.answers);
  assert.deepEqual((await state(page)).proposals, beforeDelete.proposals, 'late response cannot replace reviewed proposals during deletion');
  storedResponses = 0; assert.ok(deleteWaiting);
  await deleteWaiting.fulfill({ json: { ...privacy(), deletedResponses: 2, cancelledPendingResponses: 1 } }); deleteWaiting = null;
  await page.locator('#model-privacy-status').filter({ hasText: '2개를 지웠어요' }).waitFor();
  assert.equal((await state(page)).text, sourceText); assert.deepEqual((await state(page)).answers, beforeDelete.answers);
  assert.deepEqual(deleteCalls, [{}], 'deletion never sends another account identity');
  deleteMode = 'failure'; await page.locator('#interpret-delete-server').click();
  await page.locator('#model-privacy-status').filter({ hasText: '삭제를 확인하지 못했어요' }).waitFor();
  assert.doesNotMatch(await page.locator('#model-privacy-status').textContent(), /지웠어요/);
  mode = 'expired'; await page.locator('#interpret-ai').click();
  await page.locator('#interpret-status').filter({ hasText: '삭제되거나 만료됐어요' }).waitFor();
  assert.notEqual(calls.at(-1).id, deletedPacket.id, 'after deletion the next explicit AI request uses a new UUID');
  const expiredPacket = calls.at(-1); assert.equal(await page.locator('#interpret-ai').textContent(), 'AI로 정리');
  mode = 'success'; await page.locator('#interpret-ai').click();
  await page.locator('#interpret-status').filter({ hasText: 'AI 제안' }).waitFor();
  assert.notEqual(calls.at(-1).id, expiredPacket.id, 'expired replay requires a fresh explicit request');
  assert.deepEqual(calls[2], calls[1], 'explicit retry reuses the exact ledger key and request');
  await page.locator('[data-field="os"]').getByRole('button', { name: / 확인$/ }).click();
  mode = 'bad-quote'; await page.locator('#interpret-ai').click();
  await page.locator('#interpret-status').filter({ hasText: 'AI 응답을 반영하지 못했어요' }).waitFor();
  assert.equal((await state(page)).answers.os, 'mac', 'bad citations preserve prior confirmation');
  mode = 'hold'; await page.locator('#interpret-ai').click();
  await page.locator('#interpret-status').filter({ hasText: 'AI가 원문을 정리하고 있어요' }).waitFor();
  const count = calls.length; await page.evaluate(() => document.getElementById('interpret-ai').click());
  assert.equal(calls.length, count, 'pending button cannot double submit');
  await page.locator('#interpret-cancel').click(); await takeLate();
  assert.equal((await state(page)).answers.os, 'mac');
  assert.match(await page.locator('#interpret-status').textContent(), /서버에서 처리될 수/);
  await page.locator('#interpret-ai').click(); await page.locator('#interpret-cancel').waitFor();
  await page.locator('#consult-text').fill('윈도우가 편해요.'); await takeLate();
  assert.deepEqual((await state(page)).answers, { uses: [] });
  assert.equal((await state(page)).proposals.length, 0);
  await page.locator('#consult-text').fill(sourceText); await page.locator('#interpret-ai').click(); await page.locator('#interpret-cancel').waitFor();
  await page.locator('#uses [data-use="web"]').click(); await takeLate();
  assert.deepEqual((await state(page)).answers, { uses: ['web'] });
  await page.locator('#interpret-ai').click(); await page.locator('#interpret-cancel').waitFor();
  await page.locator('#interpret-extract').click(); await takeLate();
  assert.equal((await state(page)).mode, 'computer-explicit-ko-2');
  assert.deepEqual((await state(page)).answers, { uses: ['web'] });
  mode = 'success'; await page.locator('#interpret-ai').click();
  await page.locator('#interpret-status').filter({ hasText: 'AI 제안' }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const screen = path.join(output, `model-review-${width}.png`); await page.locator('.interpret-input').screenshot({ path: screen }); report.screens.push(screen);
  report.paths.push({ width, checks: ['explicit-send-only', 'csrf-and-wire-fields', 'review-gate', 'no-auto-retry', 'same-UUID-retry', 'bad-quote-preserves-answers', 'duplicate-prevention', 'cancel-late-response', 'edit-stale', 'manual-stale', 'local-stale', 'delete-success-preserves-browser', 'delete-empty-account-scoped-body', 'delete-failure-has-no-success-message', 'delete-blocks-late-AI', 'expired-requires-fresh-UUID', 'no-overflow'], mockPosts: calls.length, mockDeletes: deleteCalls.length });
  await context.close();
}
try {
  await checkPage(1280); await checkPage(390);
  const context = await browser.newContext(), page = await context.newPage(); let requests = 0;
  await context.route('**/api/computer-interpretation', route => { requests += 1; return route.fulfill({ json: { available: false, reason: 'not-configured' } }); });
  await page.goto(origin + '/atlas-lab/'); await page.waitForFunction(() => !!window.synkAtlasLab);
  await page.locator('#model-host-status').filter({ hasText: '연결되지 않았어요' }).waitFor();
  await page.locator('#consult-text').fill(sourceText);
  assert.equal(await page.locator('#interpret-ai').isDisabled(), true);
  await page.locator('#interpret-extract').click(); assert.equal((await state(page)).proposals.length, 1);
  assert.equal(requests, 1); await context.close();
  const member = await browser.newContext(), memberPage = await member.newPage(); let memberDeletes = 0;
  await member.route('**/api/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/me') return route.fulfill({ json: { user: { id: 'synthetic-member' }, csrfToken: 'member-csrf' } });
    const privacy = { retentionHours: 24, storedResponses: 1, pendingResponses: 0, canDelete: true, nextExpiryAt: null };
    if (url.pathname.endsWith('/privacy')) return route.fulfill({ json: privacy });
    if (url.pathname.endsWith('/delete')) {
      memberDeletes += 1; assert.deepEqual(route.request().postDataJSON(), {});
      if (memberDeletes > 1) return route.fulfill({ status: 403, json: { error: 'synthetic session revoked' } });
      return route.fulfill({ json: { ...privacy, storedResponses: 0, deletedResponses: 1, cancelledPendingResponses: 0 } });
    }
    return route.fulfill({ json: { available: false, reason: 'admin-required' } });
  });
  await memberPage.goto(origin + '/atlas-lab/'); await memberPage.locator('#model-privacy-status').filter({ hasText: '내 서버 응답 1개' }).waitFor();
  assert.equal(await memberPage.locator('#interpret-ai').isDisabled(), true); await memberPage.locator('#interpret-delete-server').click();
  await memberPage.locator('#model-privacy-status').filter({ hasText: '1개를 지웠어요' }).waitFor(); assert.equal(memberDeletes, 1);
  await memberPage.locator('#interpret-delete-server').click();
  await memberPage.locator('#model-privacy-status').filter({ hasText: '로그인 권한을 확인하지 못해' }).waitFor();
  assert.equal(await memberPage.locator('#interpret-delete-server').isDisabled(), true); await member.close();
  const share = path.join(output, 'share.html');
  await promisify(execFile)(process.execPath, [fileURLToPath(new URL('../experiences/atlas-lab/build-share.mjs', import.meta.url)), share]);
  const shareHtml = await fs.readFile(share, 'utf8'), shared = await browser.newContext(), sharePage = await shared.newPage(); let shareAPI = 0;
  await shared.route('**/*', route => {
    if (new URL(route.request().url()).pathname === '/shared.html') return route.fulfill({ contentType: 'text/html', body: shareHtml });
    shareAPI += 1; return route.abort();
  });
  await sharePage.goto(origin + '/shared.html'); await sharePage.waitForFunction(() => !!window.synkAtlasLab);
  await sharePage.locator('#consult-text').fill(sourceText); await sharePage.locator('#interpret-extract').click();
  assert.equal(await sharePage.locator('#interpret-ai').isDisabled(), true);
  assert.equal(await sharePage.locator('#model-privacy').isHidden(), true);
  await sharePage.evaluate(() => document.getElementById('interpret-delete-server').click());
  assert.equal(shareAPI, 0, 'share is disconnected even when opened over HTTP');
  report.paths.push({ checks: ['unconfigured-local-fallback', 'nonadmin-can-delete-with-AI-disabled', 'delete-revoked-session-no-success', 'http-share-zero-host-and-privacy-requests'] });
  await shared.close();
  assert.deepEqual(report.errors, []); assert.deepEqual(report.externalRequests, []); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; throw error; }
finally { await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n'); await browser.close(); await new Promise(resolve => server.close(resolve)); }
console.log(JSON.stringify({ status: report.status, pathGroups: report.paths.length, report: path.join(output, 'result.json') }));
