// Browser evidence for the source -> review -> existing recommendation path.
// Synthetic text only; no provider/model, login, storage or external request.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from '../experiences/learning-hub/server.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const output = fileURLToPath(new URL('../experiences/atlas-lab/qa/interpretation/', import.meta.url));
await fs.mkdir(output, { recursive: true });
const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { at: new Date().toISOString(), status: 'running', kind: 'synthetic-browser-paths', paidModelCalls: 0, deployed: false, errors: [], missing: [], externalRequests: [], screens: [], paths: [] };
const sample = '프리미어로 4K 영상을 편집해요. 램 8GB 노트북이 있어요. 매일 들고 다녀요.';
const state = page => page.evaluate(() => window.synkAtlasLab.interpretation());
const card = (page, field) => page.locator(`[data-field="${field}"]`);
async function analyze(page, text) {
  await page.locator('#consult-text').fill(text);
  await page.getByRole('button', { name: '이 기기에서 정리', exact: true }).click();
}
async function confirm(page, field) { await card(page, field).getByRole('button', { name: / 확인$/, exact: false }).click(); }
async function checkBasic(page, label) {
  await analyze(page, sample);
  let s = await state(page);
  assert.equal(s.proposals.length, 7);
  assert.deepEqual(s.answers, { uses: [] });
  for (const p of s.proposals) for (const e of p.evidence) assert.equal(sample.slice(e.start, e.end), e.quote);
  assert.match(await page.locator('#advice').textContent(), /하고 싶은 일/);
  await confirm(page, 'uses.video');
  assert.deepEqual((await state(page)).answers.uses, ['video']);
  assert.equal(await page.locator('#uses [data-use="video"]').getAttribute('aria-pressed'), 'true');
  await card(page, 'video.app').getByRole('button', { name: / 수정$/ }).click();
  await card(page, 'video.app').locator('select').selectOption({ label: '캡컷' });
  await card(page, 'video.app').getByRole('button', { name: '수정한 값으로 반영', exact: true }).click();
  assert.equal((await state(page)).answers['video.app'], 'capcut');
  await confirm(page, 'owned'); await confirm(page, 'current.ram');
  assert.equal((await state(page)).answers['current.ram'], '8');
  await card(page, 'current.ram').getByRole('button', { name: /확인 취소$/ }).click();
  assert.equal(Object.hasOwn((await state(page)).answers, 'current.ram'), false);
  await card(page, 'video.res').getByRole('button', { name: / 제외$/ }).click();
  assert.equal(Object.hasOwn((await state(page)).answers, 'video.res'), false);
  const recommendation = await page.evaluate(() => {
    const a = window.synkAtlasLab.answers(), nested = {};
    for (const [key, value] of Object.entries(a)) { const [group, field] = key.split('.'); if (field) (nested[group] ||= {})[field] = value; else nested[group] = value; }
    return globalThis.SynkComputerRules.compute(nested).headline.title;
  });
  assert.equal(await page.locator('#advice').textContent(), recommendation);
  await page.locator('#uses [data-use="web"]').click();
  await page.getByRole('button', { name: '원문 지우기', exact: true }).click();
  assert.deepEqual((await state(page)).answers, { uses: ['web'] });
  report.paths.push({ label, checks: ['pending-no-answers', 'exact-quotes', 'confirm', 'correct', 'withdraw', 'reject', 'original-rules-result', 'clear-preserves-manual'] });
}
try {
  for (const width of [1280, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.route('**/*', async route => {
      if (!route.request().url().startsWith(origin) && !route.request().url().startsWith('data:')) { report.externalRequests.push(route.request().url()); return route.abort(); }
      if (new URL(route.request().url()).pathname === '/api/computer-interpretation') return route.fulfill({ json: { available: false, reason: 'test-no-host' } });
      if (new URL(route.request().url()).pathname === '/api/me') return route.fulfill({ json: { user: null } });
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) report.missing.push(response.url()); });
    await page.goto(origin + '/atlas-lab/'); await page.waitForFunction(() => !!window.synkAtlasLab);
    await checkBasic(page, String(width));
    await analyze(page, '맥이 편해요. 윈도우가 편해요.');
    assert.ok((await state(page)).proposals.every(p => p.status === 'conflict'));
    for (const button of await page.locator('[data-field="os"]').getByRole('button', { name: / 확인$/ }).all()) assert.equal(await button.isDisabled(), true);
    await card(page, 'os').last().getByRole('button', { name: / 제외$/ }).click();
    await card(page, 'os').first().getByRole('button', { name: / 확인$/ }).click();
    assert.equal((await state(page)).answers.os, 'mac');
    const os = card(page, 'os').first();
    await os.getByRole('button', { name: / 수정$/ }).click();
    await os.locator('select').selectOption({ label: '상관없어요, 골라 주세요' });
    await os.getByRole('button', { name: '수정한 값으로 반영', exact: true }).click();
    assert.equal((await state(page)).answers.os, 'any');
    await analyze(page, '민수는 맥이 편해요. 예전에는 영상 편집해요.');
    assert.equal((await state(page)).proposals.length, 0);
    assert.equal((await state(page)).held.length, 2);
    // The host hook cannot apply a response after an intervening input edit.
    const request = await page.evaluate(() => window.synkAtlasLab.buildExtractionRequest());
    await page.locator('#consult-text').fill('웹 AI를 써요.');
    const stale = await page.evaluate(request => { try { window.synkAtlasLab.ingestProposals({requestId:request.id, revision:request.revision, proposals:[]}); return false; } catch { return true; } }, request);
    assert.equal(stale, true);
    await analyze(page, sample);
    await page.locator('.interpret-input').scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px overflow`);
    const screenshot = path.join(output, `review-${width}.png`);
    await page.locator('.interpret-input').screenshot({ path: screenshot }); report.screens.push(screenshot);
    report.paths.push({ label: String(width), checks: ['conflict-blocks-confirm', 'reject-resolves-conflict', 'explicit-correction', 'other-and-past-held', 'stale-response-rejected', 'no-overflow'] });
    await context.close();
  }
  const share = path.join(output, 'share.html');
  await promisify(execFile)(process.execPath, [fileURLToPath(new URL('../experiences/atlas-lab/build-share.mjs', import.meta.url)), share]);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', error => report.errors.push(error.message));
  const shareRequests = [];
  page.on('request', request => { if (/^https?:/.test(request.url())) shareRequests.push(request.url()); });
  await page.goto(pathToFileURL(share).href); await page.waitForFunction(() => !!window.synkAtlasLab);
  await checkBasic(page, 'file-share'); assert.deepEqual(shareRequests, []); assert.match(await page.locator('#model-host-status').textContent(), /공유판/); report.share = share; await page.close();
  assert.deepEqual(report.errors, []); assert.deepEqual(report.missing, []); assert.deepEqual(report.externalRequests, []);
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; throw error; }
finally { await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n'); await browser.close(); await new Promise(resolve => server.close(resolve)); }
console.log(JSON.stringify({ status: report.status, pathGroups: report.paths.length, report: path.join(output, 'result.json') }));
