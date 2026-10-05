// Real Chrome, actual shared Core/Temper, fictional people only. No AI provider.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from '../experiences/learning-hub/server.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const output = fileURLToPath(new URL('../experiences/atlas-lab/qa/matching/', import.meta.url));
await fs.mkdir(output, { recursive: true });
const server = createServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { at: new Date().toISOString(), status: 'running', kind: 'fictional-matching-browser', paidModelCalls: 0, externalRequests: [], errors: [], missing: [], checks: [], screenshots: [] };
const section = '[aria-labelledby="matching-title"]';
try {
  const context = await browser.newContext();
  await context.route('**/*', route => {
    const url = route.request().url();
    if (/^https?:/u.test(url) && !url.startsWith(base + '/')) { report.externalRequests.push(url); return route.abort(); }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', res => { const p = new URL(res.url()).pathname; if (res.status() >= 400 && !['/favicon.ico', '/api/computer-interpretation'].includes(p)) report.missing.push({ path: p, status: res.status() }); });
  const view = () => page.evaluate(() => window.synkAtlasLab.matching());
  const action = key => page.locator(`${section} [data-match-action="${key}"]`);
  const personAction = (person, key) => page.locator(`${section} [data-match-person="${person}"] [data-match-action="${key}"]`);
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    await page.goto(base + '/atlas-lab/', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.synkAtlasLab?.matching);
    assert.equal((await view()).eligibility.status, 'eligible');
    assert.equal(await personAction('person-a', 'accept').isDisabled(), true);
    await action('introduce').click();
    assert.equal((await view()).round.active, true);
    assert.equal(await personAction('person-a', 'accept').isDisabled(), true);
    await personAction('person-a', 'deliver').click();
    await personAction('person-a', 'accept').click();
    let current = await view();
    assert.equal(current.participants.find(p => p.id === 'person-b').intent.value, 'unanswered');
    assert.equal(current.tracking.outcomes.length, 0, 'one acceptance is not mutual success');
    assert.equal(await action('result-person-a').isDisabled(), true);
    await personAction('person-b', 'deliver').click();
    await personAction('person-b', 'accept').click();
    assert.equal(await action('result-person-a').isDisabled(), false);
    await action('result-person-a').click(); await action('result-person-b').click();
    current = await view();
    assert.ok(current.participants.every(p => p.resultDelivered));
    assert.ok(current.tracking.outcomes.length > 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    const screenshot = path.join(output, `matching-mutual-${width}.png`);
    await page.locator(section).screenshot({ path: screenshot });
    report.screenshots.push(screenshot);
    await personAction('person-a', 'withdraw').click();
    assert.equal((await view()).participants.find(p => p.id === 'person-a').intent.value, 'withdraw');
    assert.equal(await action('result-person-b').isDisabled(), true);
    await personAction('person-a', 'consent').click();
    assert.equal((await view()).eligibility.status, 'no-consent');
    assert.equal((await view()).round.active, false);
    await personAction('person-a', 'consent').click();
    assert.equal((await view()).round.active, false, 'renewing consent does not restore old round');
    await action('introduce').click();
    assert.ok((await view()).participants.every(p => p.intent.value === 'unanswered'));
    report.checks.push(`mutual-delivery-withdrawal-new-round-${width}`);
  }
  await page.locator('[data-match-scenario="mismatch"]').click();
  assert.equal((await view()).eligibility.status, 'ineligible'); assert.equal(await action('introduce').isDisabled(), true);
  await page.locator('[data-match-scenario="unknown"]').click();
  assert.equal((await view()).eligibility.status, 'needs-confirmation');
  assert.ok((await view()).nextQuestion); assert.equal(await action('introduce').isDisabled(), true);
  await page.locator('#matching-question [data-match-action="answer-weekend"]').click();
  assert.equal((await view()).eligibility.status, 'eligible');
  report.checks.push('one-sided-mismatch-and-unknown-confirmation');
  await page.locator('[data-match-scenario="no-consent"]').click();
  assert.equal((await view()).eligibility.status, 'needs-confirmation'); assert.equal(await action('introduce').isDisabled(), true);
  report.checks.push('consent-required');

  await page.locator('#uses [data-use="web"]').click();
  assert.match(await page.locator('#advice-scope').textContent(), /예산 미확인/);
  await page.locator('#budget-review summary').click();
  await page.locator('[data-budget="lt100"]').click();
  assert.equal(await page.evaluate(() => window.synkAtlasLab.answers().budget), 'lt100');
  assert.doesNotMatch(await page.locator('#advice-scope').textContent(), /예산 미확인/);
  report.checks.push('unconfirmed-budget-labelled-and-directly-answerable');

  const shareFile = path.join(output, 'matching-share.html');
  await promisify(execFile)(process.execPath, ['experiences/atlas-lab/build-share.mjs', shareFile]);
  const shareHTML = await fs.readFile(shareFile, 'utf8');
  await context.route(base + '/matching-share', route => route.fulfill({ contentType: 'text/html', body: shareHTML }));
  const share = await context.newPage(), requests = [];
  share.on('pageerror', e => report.errors.push(e.message));
  share.on('request', req => { if (/^https?:/u.test(req.url()) && req.url() !== base + '/matching-share') requests.push(req.url()); });
  await share.goto(base + '/matching-share', { waitUntil: 'networkidle' });
  await share.waitForFunction(() => !!window.synkAtlasLab?.matching);
  await share.locator('[data-match-action="introduce"]').click();
  assert.equal(await share.evaluate(() => window.synkAtlasLab.matching().round.active), true);
  assert.deepEqual(requests, []); report.checks.push('standalone-share-zero-subrequests');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.missing, []); assert.deepEqual(report.externalRequests, []);
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; throw error; }
finally { await browser.close(); await new Promise(resolve => server.close(resolve)); await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n'); }
console.log(JSON.stringify({status:report.status,checks:report.checks,paidModelCalls:0}));
