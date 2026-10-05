// Actual company auth/static/API + Chrome + mocked official-provider response.
// Uses an isolated SQLite store. No paid API or production data is accessed.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createCompanyApp } from '../docs/마케팅/온라인마케팅지도/engagement/company/server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const output = fileURLToPath(new URL('../experiences/atlas-lab/qa/model-company/', import.meta.url));
await fs.mkdir(output, { recursive: true });
const directory = await fs.mkdtemp(path.join(tmpdir(), 'synk-computer-browser-'));
const probe = createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const env = {
  OPENAI_API_KEY: 'synthetic-test-key', SYNK_COMPUTER_AI_ENABLED: '1', SYNK_COMPUTER_AI_MODEL: 'gpt-6-luna',
  SYNK_COMPUTER_AI_MAX_OUTPUT_TOKENS: '3000', SYNK_COMPUTER_AI_INPUT_PER_MILLION_MICRO_USD: '125000',
  SYNK_COMPUTER_AI_OUTPUT_PER_MILLION_MICRO_USD: '500000', SYNK_COMPUTER_AI_REQUEST_LIMIT_MICRO_USD: '10000',
  SYNK_COMPUTER_AI_TOTAL_LIMIT_MICRO_USD: '250000',
};
const sample = '저는 웹 AI로 문서를 작성해요.';
let providerCalls = 0, defer = false, release;
async function waitUntil(predicate, message) {
  const deadline = Date.now() + 5000;
  while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
  assert.ok(predicate(), message);
}
const report = { at: new Date().toISOString(), status: 'running', kind: 'company-host-browser-with-mock-provider',
  realCompanyAuthAndApi: true, paidModelCalls: 0, externalNetworkCalls: 0, mockedProviderCalls: 0, checks: [], screenshots: [], errors: [], missing: [] };
const app = createCompanyApp({ dataDir: directory, port, schedule: false,
  messengerDriveStorage: { active: async () => null, status: async () => ({ provider: 'local' }) },
  synkIdentityFetch: async () => { throw Error('External identity calls prohibited in this fixture'); },
  contentFetch: async () => { throw Error('External content calls prohibited in this fixture'); },
  computerAIEnv: key => env[key],
  computerAIFetch: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.method, 'POST'); providerCalls++;
    const request = JSON.parse(options.body), source = JSON.parse(request.input[0].content[0].text).source_text;
    assert.equal(request.store, false); assert.equal(source, sample);
    if (defer) await new Promise(resolve => { release = resolve; });
    return new Response(JSON.stringify({ id: 'mock-provider-response', model: request.model, status: 'completed',
      usage: { input_tokens: 1200, output_tokens: 200, total_tokens: 1400 },
      output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify({
        proposals: [{ field: 'uses.web', value: true, subject: 'self', stance: 'current', evidence: [{ quote: source, occurrence: 1 }] }], held: [],
      }) }] }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  },
});
let browser;
try {
  await app.start();
  const admin = app.store.createUser({ email: 'browser@example.test', name: '상담 시험 관리자', role: 'admin' });
  const token = app.store.mint('session', admin.id, { csrfToken: 'browser-test-csrf' }, 60);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  await context.addCookies([{ name: 'synk_company_session', value: token, url: origin, httpOnly: true, sameSite: 'Lax' }]);
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (/^https?:/u.test(url) && !url.startsWith(origin + '/')) { report.externalNetworkCalls++; return route.abort(); }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) report.missing.push({ url: new URL(response.url()).pathname, status: response.status() }); });
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(origin + '/atlas-lab/', { waitUntil: 'networkidle' });
    await page.locator('#interpret-ai').waitFor();
    await page.waitForFunction(() => document.querySelector('#model-host-status')?.textContent.includes('연결'));
    await page.locator('#consult-text').fill(sample);
    await page.locator('#interpret-ai').click();
    await page.waitForFunction(() => window.synkAtlasLab.interpretation().proposals.length === 1);
    const before = await page.evaluate(() => window.synkAtlasLab.interpretation());
    assert.deepEqual(before.answers, { uses: [] });
    assert.equal(before.proposals[0].evidence[0].quote, sample);
    await page.locator('[data-field="uses.web"]').getByRole('button', { name: / 확인$/u }).click();
    assert.deepEqual(await page.evaluate(() => window.synkAtlasLab.answers().uses), ['web']);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    assert.equal(overflow, false, `overflow at ${width}`);
    const screenshot = path.join(output, `company-ai-${width}.png`);
    await page.locator('[aria-labelledby="consult-title"]').screenshot({ path: screenshot });
    report.screenshots.push({ width, section: 'computer-consultation', file: path.basename(screenshot) });
    report.checks.push(`authenticated-ai-review-${width}`);
  }
  const beforeLocal = providerCalls;
  await page.locator('#interpret-extract').click();
  assert.equal(providerCalls, beforeLocal);
  report.checks.push('local-button-no-provider');

  defer = true;
  await page.locator('#interpret-ai').click();
  await page.waitForFunction(() => document.querySelector('#interpret-status').textContent.includes('정리하고'));
  for (let i = 0; i < 100 && !release; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(release, 'request reached mocked provider');
  await page.locator('#consult-text').fill('지금 조건을 다시 적고 있어요.');
  release(); defer = false;
  await page.waitForTimeout(150);
  assert.deepEqual(await page.evaluate(() => window.synkAtlasLab.interpretation().proposals), []);
  report.checks.push('late-response-after-edit-discarded');
  assert.equal(providerCalls, 4);
  const rows = app.store.all('computerAIRequests');
  assert.equal(rows.length, 4);
  report.requestLedgerRows = rows.length;
  report.checks.push('provider-request-ledger-persisted');

  await waitUntil(() => app.store.all('computerAIRequests').every(row => row.status === 'completed'), 'initial responses settled');
  const beforeDelete = await page.evaluate(() => window.synkAtlasLab.interpretation());
  const settledCost = app.store.all('computerAIRequests').reduce((sum, row) => sum + row.accountedMicroUSD, 0);
  await page.locator('#interpret-delete-server').click();
  await page.waitForFunction(() => document.querySelector('#model-privacy-status').textContent.includes('4개를 지웠어요'));
  assert.deepEqual(await page.evaluate(() => window.synkAtlasLab.interpretation()), beforeDelete);
  assert.ok(app.store.all('computerAIRequests').every(row => !row.resultCiphertext && row.responseRemovedAt));
  assert.equal(app.store.all('computerAIRequests').reduce((sum, row) => sum + row.accountedMicroUSD, 0), settledCost);
  assert.equal(providerCalls, 4);
  report.checks.push('server-delete-preserves-browser-and-billing');

  await page.locator('#consult-text').fill(sample);
  defer = true; release = undefined;
  await page.locator('#interpret-ai').click();
  await waitUntil(() => !!release, 'pending deletion request reached provider');
  const beforePendingDelete = await page.evaluate(() => window.synkAtlasLab.interpretation());
  await page.locator('#interpret-delete-server').click();
  await page.waitForFunction(() => document.querySelector('#model-privacy-status').textContent.includes('처리 중 1개 응답도 보관하지 않아요'));
  assert.deepEqual(await page.evaluate(() => window.synkAtlasLab.interpretation()), beforePendingDelete);
  release(); defer = false;
  await waitUntil(() => app.store.all('computerAIRequests').every(row => row.usage), 'deleted pending request usage settled');
  assert.equal(providerCalls, 5);
  assert.ok(app.store.all('computerAIRequests').every(row => !row.resultCiphertext && row.responseRemovedAt));
  assert.deepEqual(await page.evaluate(() => window.synkAtlasLab.interpretation()), beforePendingDelete);
  assert.ok(app.store.all('computerAIRequests').reduce((sum, row) => sum + row.accountedMicroUSD, 0) > settledCost);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  const deletedScreenshot = path.join(output, 'company-deleted-320.png');
  await page.locator('[aria-labelledby="consult-title"]').screenshot({ path: deletedScreenshot });
  report.screenshots.push({ width: 320, section: 'server-response-deleted', file: path.basename(deletedScreenshot) });
  report.checks.push('pending-delete-no-late-response-or-ciphertext-restoration');
  report.requestLedgerRows = app.store.all('computerAIRequests').length;
  assert.deepEqual(report.errors, []); assert.deepEqual(report.missing, []);
  assert.equal(report.externalNetworkCalls, 0);
  report.mockedProviderCalls = providerCalls; report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; throw error; }
finally {
  release?.();
  await browser?.close(); await app.stop();
  const base = path.resolve(tmpdir()), target = path.resolve(directory);
  assert.ok(target.startsWith(base + path.sep) && path.basename(target).startsWith('synk-computer-browser-'));
  await fs.rm(target, { recursive: true, force: true });
  await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ status: report.status, checks: report.checks, mockedProviderCalls: providerCalls, externalNetworkCalls: report.externalNetworkCalls, paidModelCalls: 0 }));
