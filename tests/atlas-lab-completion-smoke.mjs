// Real-browser regression for consultation completion, separate from Ask priority.
// Synthetic manual choices only. Every API is mocked; external requests are blocked.
// Run: node tests/atlas-lab-completion-smoke.mjs
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
const output = fileURLToPath(new URL('../experiences/atlas-lab/qa/completion/', import.meta.url));
const report = { version: 1, at: new Date().toISOString(), status: 'running', kind: 'synthetic-consultation-completion-browser',
  modelCalls: 0, externalApiCost: 0, deployed: false, errors: [], missing: [], failedRequests: [], externalRequests: [], unexpectedApiRequests: [], apiMocks: [], paths: [], screenshots: [] };
const completion = page => page.evaluate(() => window.synkAtlasLab.consult().completion);
const answers = page => page.evaluate(() => window.synkAtlasLab.answers());
const primaryChoices = { owned: 'new', os: 'win', place: 'home', multitask: 'light', budget: 'lt100', localai: ['large', 'image'] };
const reuseChoices = { owned: 'have', os: 'any', place: 'home', multitask: 'light', budget: 'unknown',
  'current.kind': 'desktop', 'current.ram': '32', 'current.os': 'win11', 'current.feel': 'ok' };
let server, browser, origin;

async function openDetails(page, id) {
  const details = page.locator(`#${id}`);
  assert.equal(await details.isVisible(), true, `${id} must be available in the actual UI`);
  if (!(await details.evaluate(element => element.open))) await details.locator(':scope > summary').click();
}
async function chooseBudget(page, value) {
  await openDetails(page, 'budget-review');
  await page.locator(`#budget-options [data-budget="${value}"]`).click();
  assert.equal((await answers(page)).budget, value);
}
async function finishAsk(page, choices) {
  const trace = [];
  for (let i = 0; i < 20; i += 1) {
    const question = await page.evaluate(() => window.synkAtlasLab.consult().question ?? null);
    if (!question) return trace;
    assert.ok(Object.hasOwn(choices, question.id), `unscripted Ask question ${question.id}`);
    const values = Array.isArray(choices[question.id]) ? choices[question.id] : [choices[question.id]];
    for (const value of values) {
      const option = (question.displayOptions || question.options).find(item => item.id === value);
      assert.ok(option, `unknown scripted option ${question.id}:${value}`);
      await page.locator('#ask').getByRole('button', { name: option.label, exact: true }).click();
    }
    if (question.selection === 'multiple') await page.locator('#ask').getByRole('button', { name: '선택한 작업으로 확인', exact: true }).click();
    trace.push({ field: question.id, value: choices[question.id] });
  }
  throw new Error('Ask exceeded the scripted question limit');
}
async function chooseRequired(page, id, value) {
  await openDetails(page, 'required-review');
  await page.locator('#required-field').selectOption(id);
  for (const item of Array.isArray(value) ? value : [value]) await page.locator(`#required-options [data-required-answer="${item}"]`).click();
  if (Array.isArray(value)) await page.locator('#required-review [data-required-confirm]').click();
  assert.deepEqual((await answers(page))[id], value);
}
async function finishRequired(page, choices) {
  const trace = [];
  for (let i = 0; i < 20; i += 1) {
    const status = await completion(page);
    if (status.status === 'ready') return trace;
    const id = status.unresolvedRequiredFields[0];
    assert.ok(id && Object.hasOwn(choices, id), `unscripted completion field ${id}`);
    if (id === 'budget') await chooseBudget(page, choices[id]);
    else await chooseRequired(page, id, choices[id]);
    trace.push({ field: id, value: choices[id] });
  }
  throw new Error('Required review did not reach ready');
}
async function snapshot(page) {
  return { completion: await completion(page), answers: await answers(page),
    statusText: (await page.locator('#completion-status').textContent()).trim(), statusAttribute: await page.locator('#completion-status').getAttribute('data-status'),
    detailsText: (await page.locator('#completion-details').textContent()).trim(),
    adviceScope: (await page.locator('#advice-scope').textContent()).trim() };
}
async function checkLayout(page, label) {
  await page.evaluate(() => document.fonts.ready);
  const layout = await page.evaluate(() => ({ viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll('.consult *')].filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && (rect.right > innerWidth + 1 || rect.left < -1);
    }).slice(0, 10).map(element => ({ tag: element.tagName, id: element.id, className: String(element.className) })) }));
  assert.ok(layout.documentWidth <= layout.viewport, `${label}: document overflow ${JSON.stringify(layout)}`);
  assert.deepEqual(layout.overflowing, [], `${label}: visible element overflow`);
  return layout;
}
async function capture(page, label) {
  const image = path.join(output, `${label}.png`);
  await page.locator('.consult .result-card').screenshot({ path: image });
  report.screenshots.push(image);
  return image;
}
async function load(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => !!window.synkAtlasLab?.consult().completion);
  await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('#interpret-ai').isDisabled(), true, 'no enabled model host in browser QA');
}
async function purchaseAndBranch(page, label) {
  const initial = await snapshot(page);
  assert.equal(initial.completion.status, 'not-started');
  assert.equal(initial.statusAttribute, 'not-started'); assert.equal(initial.completion.path, 'undetermined');
  await page.locator('#uses [data-use="web"]').click();
  const askTrace = await finishAsk(page, primaryChoices);
  assert.deepEqual(askTrace.map(row => row.field).sort(), ['os', 'owned', 'place'], 'completion must not change the existing web Ask sequence');
  assert.equal(await page.locator('#ask .ask-card').count(), 0);
  const provisional = await snapshot(page);
  assert.equal(provisional.completion.status, 'provisional');
  assert.equal(provisional.completion.path, 'purchase');
  assert.deepEqual(provisional.completion.unresolvedRequiredFields, ['budget']);
  assert.equal(provisional.completion.budget.required, true);
  assert.equal(provisional.completion.budget.state, 'missing'); assert.equal(provisional.statusAttribute, 'provisional');
  assert.equal(Object.hasOwn(provisional.answers, 'budget'), false);
  assert.ok(provisional.statusText.length > 0); assert.match(provisional.detailsText, /예산/);
  await openDetails(page, 'budget-review');
  const provisionalLayout = await checkLayout(page, label + '-purchase-provisional');
  await capture(page, label + '-purchase-provisional');
  await chooseBudget(page, 'lt100');
  const ready = await snapshot(page);
  assert.equal(ready.completion.status, 'ready'); assert.deepEqual(ready.completion.unresolvedRequiredFields, []);
  assert.equal(ready.completion.budget.state, 'known'); assert.equal(ready.statusAttribute, 'ready');
  assert.notEqual(ready.statusText, provisional.statusText, 'the visible status must distinguish ready from provisional');
  await chooseBudget(page, 'unknown');
  const unknown = await snapshot(page);
  assert.equal(unknown.completion.status, 'provisional'); assert.ok(unknown.completion.unresolvedRequiredFields.includes('budget'));
  assert.equal(unknown.completion.budget.state, 'unknown'); assert.equal(unknown.statusAttribute, 'provisional');
  assert.match(unknown.detailsText, /예산/);
  await chooseBudget(page, 'lt100');
  assert.equal((await completion(page)).status, 'ready');

  // New work invalidates completion. Answer via the separate required-review UI,
  // without injecting answers or answering the normal Ask card.
  await page.locator('#uses [data-use="localai"]').click();
  const branchMissing = await snapshot(page);
  assert.equal(branchMissing.completion.status, 'provisional'); assert.ok(branchMissing.completion.unresolvedRequiredFields.includes('localai'));
  await openDetails(page, 'required-review');
  await page.locator('#required-field').selectOption('localai');
  const confirm = page.locator('#required-review [data-required-confirm]');
  assert.equal(await confirm.isDisabled(), true);
  const large = page.locator('#required-options [data-required-answer="large"]');
  await large.click();
  assert.equal(Object.hasOwn(await answers(page), 'localai'), false, 'selection is not committed before explicit confirmation');
  await large.click(); assert.equal(await confirm.isDisabled(), true, 'empty multi-selection cannot be confirmed');
  await large.click(); await page.locator('#required-options [data-required-answer="image"]').click();
  await checkLayout(page, label + '-required-multiple');
  await capture(page, label + '-required-multiple');
  await confirm.click();
  assert.deepEqual((await answers(page)).localai, ['large', 'image']);
  const requiredTrace = await finishRequired(page, primaryChoices);
  const branchReady = await snapshot(page);
  assert.equal(branchReady.completion.status, 'ready');
  await page.locator('#uses [data-use="localai"]').click();
  assert.equal((await completion(page)).status, 'ready');
  assert.equal(Object.hasOwn(await answers(page), 'localai'), false, 'removed work does not keep its dependent answer');
  await page.locator('#uses [data-use="localai"]').click();
  assert.ok((await completion(page)).unresolvedRequiredFields.includes('localai'), 'reselected work must be confirmed again');
  await chooseRequired(page, 'localai', ['large', 'image']);
  assert.equal((await completion(page)).status, 'ready');
  report.paths.push({ label, kind: 'purchase-and-new-work', initial, askTrace, provisional, provisionalLayout, ready, unknown, branchMissing, requiredTrace, branchReady });
}
async function reuse(page, label) {
  await page.locator('#uses [data-use="web"]').click();
  const askTrace = await finishAsk(page, reuseChoices), requiredTrace = await finishRequired(page, reuseChoices);
  let result = await snapshot(page);
  assert.equal(result.completion.path, 'reuse'); assert.equal(result.completion.status, 'ready');
  assert.equal(result.completion.budget.required, false); assert.ok(!result.completion.requiredFields.includes('budget'));
  assert.equal(Object.hasOwn(result.answers, 'budget'), false, 'reuse reaches ready without declaring a purchase budget');
  await chooseBudget(page, 'unknown'); result = await snapshot(page);
  assert.equal(result.completion.status, 'ready', 'unknown purchase budget must not block reuse');
  assert.equal(result.completion.budget.required, false);
  const layout = await checkLayout(page, label + '-reuse-ready');
  await capture(page, label + '-reuse-ready');
  await page.locator('#uses [data-use="web"]').click();
  assert.equal((await completion(page)).status, 'not-started');
  report.paths.push({ label, kind: 'reuse-without-purchase-budget', askTrace, requiredTrace, result, layout });
}
async function contextFor(viewport, label, shared = false) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (['data:', 'blob:', 'file:'].includes(url.protocol)) return route.continue();
    if (shared || url.origin !== origin) { report.externalRequests.push({ label, url: request.url() }); return route.abort(); }
    if (url.pathname.startsWith('/api/')) {
      if (request.method() !== 'GET') { report.unexpectedApiRequests.push({ label, path: url.pathname, method: request.method() }); return route.abort(); }
      report.apiMocks.push({ label, path: url.pathname });
      if (url.pathname === '/api/computer-interpretation') return route.fulfill({ json: { available: false, reason: 'test-no-host' } });
      if (url.pathname === '/api/me') return route.fulfill({ json: { user: null } });
      report.unexpectedApiRequests.push({ label, path: url.pathname, method: request.method() }); return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => report.errors.push({ label, message: error.message }));
  page.on('response', response => { if (response.status() >= 400 && !new URL(response.url()).pathname.endsWith('/favicon.ico')) report.missing.push({ label, status: response.status(), url: response.url() }); });
  page.on('requestfailed', request => { if (!new URL(request.url()).pathname.endsWith('/favicon.ico')) report.failedRequests.push({ label, url: request.url(), error: request.failure()?.errorText }); });
  return { context, page };
}

try {
  await fs.mkdir(output, { recursive: true });
  server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const width of [1280, 390, 320]) {
    const label = `local-${width}`, { context, page } = await contextFor({ width, height: 900 }, label);
    try { await load(page, origin + '/atlas-lab/'); await purchaseAndBranch(page, label); await load(page, origin + '/atlas-lab/'); await reuse(page, label); }
    finally { await context.close(); }
  }
  const share = path.join(output, 'share.html');
  await promisify(execFile)(process.execPath, [fileURLToPath(new URL('../experiences/atlas-lab/build-share.mjs', import.meta.url)), share]);
  const { context, page } = await contextFor({ width: 390, height: 844 }, 'file-share-390', true);
  try {
    await load(page, pathToFileURL(share).href); assert.match(await page.locator('#model-host-status').textContent(), /공유판/);
    await purchaseAndBranch(page, 'file-share-390');
    await load(page, pathToFileURL(share).href); await reuse(page, 'file-share-390');
    report.share = share;
  } finally { await context.close(); }
  for (const field of ['errors', 'missing', 'failedRequests', 'externalRequests', 'unexpectedApiRequests']) assert.deepEqual(report[field], [], field);
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; process.exitCode = 1; }
finally {
  await browser?.close();
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, pathGroups: report.paths.length, report: path.join(output, 'result.json'), ...(report.failure ? { failure: report.failure } : {}) }));
}
