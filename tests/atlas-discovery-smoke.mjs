// Synthetic candidate discovery in real Chrome. UI actions only; debug access is read-only.
// No accounts, provider calls, remote data or deployment. Run: node tests/atlas-discovery-smoke.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from '../experiences/learning-hub/server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const output = fileURLToPath(new URL('../experiences/atlas-lab/qa/discovery/', import.meta.url));
const report = { version: 1, status: 'running', at: new Date().toISOString(), kind: 'fictional-candidate-discovery-browser-ux',
  modelCalls: 0, externalApiCost: 0, actualPeople: 0, deployed: false, errors: [], missing: [], failedRequests: [], externalRequests: [], unexpectedRequests: [], mockedApi: [], paths: [], screenshots: [] };
const section = '.discovery-lab';
const view = page => page.evaluate(() => window.synkAtlasLab.discovery());
const action = (page, id) => page.locator(`${section} [data-discovery-action="${id}"]`);
const field = (snapshot, id) => snapshot.fields.find(item => item.id === id);
let server, browser, origin;

async function load(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.synkAtlasLab?.discovery);
  assert.equal(await page.evaluate(() => document.characterSet), 'UTF-8');
  assert.equal(await page.locator('#interpret-ai').isDisabled(), true);
  const text = await page.locator(section).innerText();
  assert.match(text, /가상/);
  assert.doesNotMatch(text, /(?:궁합|성공\s*확률|관계\s*점수)\s*[:：]?\s*\d+(?:\.\d+)?\s*%/);
}
async function scenario(page, id) {
  await details(page, `${section} .discovery-reset`);
  await page.locator(`${section} [data-discovery-scenario="${id}"]`).click();
}
async function edit(page, id, optionId, required = false) {
  await details(page, '#discovery-editor');
  await page.locator('#discovery-edit-field').selectOption(id);
  await page.locator('#discovery-edit-value').selectOption(optionId);
  if (id.startsWith('wants.')) await page.locator('#discovery-edit-required').setChecked(required);
  await action(page, 'save').click();
  assert.equal(field(await view(page), id).state, 'known');
}
async function clear(page, id) {
  await details(page, '#discovery-editor');
  await page.locator('#discovery-edit-field').selectOption(id);
  await action(page, 'clear').click();
  assert.notEqual(field(await view(page), id).state, 'known');
}

async function checkLayout(page, label) {
  await page.evaluate(() => document.fonts.ready);
  const result = await page.evaluate(selector => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll(selector + ' *')].filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1);
    }).slice(0, 10).map(element => ({ id: element.id, tag: element.tagName, className: String(element.className) })) }), section);
  assert.ok(result.documentWidth <= result.width, `${label}: document overflow ${JSON.stringify(result)}`);
  assert.deepEqual(result.overflowing, [], `${label}: discovery control overflow`);
  return result;
}
async function screenshot(page, label, selector = section) {
  await checkLayout(page, label);
  const file = path.join(output, label + '.png');
  await page.locator(selector).screenshot({ path: file }); report.screenshots.push(file);
}
async function details(page, selector) {
  const element = page.locator(selector);
  if (!(await element.evaluate(node => node.open))) await element.locator(':scope > summary').click();
}
async function keyboardActivate(page, locator) {
  // Follow native tab order; do not focus or mutate a node through the debug API.
  let reached = false;
  for (let step = 0; step < 220; step += 1) {
    await page.keyboard.press('Tab');
    if (await locator.evaluate(element => element === document.activeElement)) { reached = true; break; }
  }
  assert.equal(reached, true, 'primary discovery answer is reachable through keyboard tab order');
  const focus = await locator.evaluate(element => ({ visible: element.matches(':focus-visible'), outline: getComputedStyle(element).outlineStyle, width: getComputedStyle(element).outlineWidth }));
  assert.equal(focus.visible, true); assert.notEqual(focus.outline, 'none'); assert.ok(parseFloat(focus.width) >= 2);
  await page.keyboard.press('Enter');
  return focus;
}
async function answer(page, value, keyboard = false) {
  const q = (await view(page)).question;
  assert.ok(q, 'a question is available');
  const option = q.options.find(item => item.value === value);
  assert.ok(option, `question ${q.field} has the requested answer`);
  const control = page.locator(`${section} [data-discovery-field="${q.field}"][data-discovery-answer="${option.id}"]`);
  const focus = keyboard ? await keyboardActivate(page, control) : (await control.click(), null);
  assert.equal(field(await view(page), q.field).value, value, `${q.field} answer is accepted`);
  assert.equal(await page.locator('#discovery-summary').evaluate(element => element === document.activeElement), true, 'answer moves focus to the updated result');
  return { field: q.field, value, ...(focus ? { focus } : {}) };
}
async function candidateState(page, id, status) {
  const row = (await view(page)).candidates.find(item => item.id === id);
  assert.ok(row, `public candidate ${id} is present`); assert.equal(row.status, status);
  assert.equal(await page.locator(`${section} [data-discovery-candidate="${id}"]`).getAttribute('data-discovery-status'), status);
  assert.equal(await page.locator(`${section} [data-discovery-select="${id}"]`).count(), status === 'eligible' ? 1 : 0);
  return row;
}
async function mainJourney(page, label) {
  const initial = await view(page);
  assert.equal(initial.question.field, 'consent'); assert.deepEqual(initial.candidates, []); assert.equal(initial.selection, null);
  await page.locator(section).scrollIntoViewIfNeeded();
  const trace = [await answer(page, true, true)];
  // The additional axes are answered explicitly. Unrestricted wants preserve the
  // original pace/plan journey; they are not substituted for missing answers.
  const choices = { availability: 'weekend', 'self.pace': 'listen', 'self.plan': 'planned', 'wants.pace': 'lead', 'wants.plan': 'planned',
    'self.purpose': 'gradual', 'wants.purpose': 'any', 'self.contact': 'few-days', 'wants.contact': 'any', 'self.rhythm': 'early', 'wants.rhythm': 'any',
    'self.notice': 'advance', 'wants.notice': 'any' };
  const answered = new Set();
  for (let step = 0; step < Object.keys(choices).length; step += 1) {
    const q = (await view(page)).question;
    if (!q) break;
    assert.ok(Object.hasOwn(choices, q.field), `unexpected question ${q.field}`);
    assert.equal(answered.has(q.field), false, `answered question ${q.field} must not repeat`); answered.add(q.field);
    trace.push(await answer(page, choices[q.field]));
  }
  let ready = await view(page);
  // Ask may omit a question that cannot change the present decision. Missing
  // self.plan is not silently assumed; fill it explicitly through the editor.
  if (field(ready, 'self.plan').state === 'unknown') {
    assert.equal(field(ready, 'self.plan').value, null);
    assert.ok(ready.candidates.some(item => item.unknown.some(text => /내 방식/.test(text))));
    await edit(page, 'self.plan', 'planned'); trace.push({ field: 'self.plan', value: 'planned', via: 'explicit-editor' });
    ready = await view(page);
  }
  // Synthetic candidates have not restricted these self declarations, so Ask
  // may omit them. Exercise the actual editor instead of inventing those facts.
  for (const id of ['self.purpose', 'self.contact', 'self.rhythm', 'self.notice']) {
    if (field(ready, id).state === 'unknown') {
      assert.equal(field(ready, id).value, null);
      await edit(page, id, choices[id]); trace.push({ field: id, value: choices[id], via: 'explicit-editor' }); ready = await view(page);
    }
  }
  for (const [id, value] of Object.entries(choices)) assert.equal(field(ready, id).value, value, `the situation questionnaire covers ${id}`);
  assert.equal(ready.status, 'ready'); assert.equal(ready.topCandidateId, 'candidate-1');
  assert.deepEqual(ready.candidates.filter(item => item.status === 'eligible').map(item => item.id).sort(), ['candidate-1', 'candidate-2', 'candidate-3']);
  assert.ok(!JSON.stringify(ready).includes('hidden-no-consent'));
  await details(page, '#discovery-held-details');
  const reciprocal = await candidateState(page, 'candidate-4', 'excluded');
  const pending = await candidateState(page, 'candidate-5', 'pending');
  assert.ok(reciprocal.reciprocal.some(text => /꼭/.test(text) && /달라요/.test(text)), 'other person\'s mandatory condition explains exclusion');
  assert.ok(pending.unknown.some(text => /일정/.test(text)), 'missing schedule is disclosed');
  await screenshot(page, label + '-initial-candidates');
  await page.locator('[data-discovery-select="candidate-1"]').click();
  assert.equal((await view(page)).selection.candidateId, 'candidate-1');
  assert.match(await page.locator('#discovery-selection').innerText(), /상호 수락.*뜻하지/);

  // The expected change was specified before reading implementation: a listener
  // preference puts synthetic candidate 2 before candidate 1.
  await edit(page, 'wants.pace', 'listen');
  const changed = await view(page);
  assert.equal(changed.topCandidateId, 'candidate-2'); assert.equal(changed.selection, null);
  assert.equal(changed.change.beforeId, 'candidate-1'); assert.equal(changed.change.afterId, 'candidate-2');
  assert.match(changed.change.reason, /대화 방식/); assert.match(changed.change.reason, /차분히 듣고 응답/);
  assert.match(await page.locator('#discovery-change').innerText(), /가상 성인 1 → 가상 성인 2/);
  assert.equal((await candidateState(page, 'candidate-4', 'excluded')).status, 'excluded');
  assert.equal((await candidateState(page, 'candidate-5', 'pending')).status, 'pending');
  await screenshot(page, label + '-changed-preference');

  await page.locator('[data-discovery-select="candidate-2"]').click();
  const selected = await view(page);
  await action(page, 'unselect').click();
  const cancelled = await view(page);
  assert.equal(cancelled.selection, null); assert.deepEqual(cancelled.fields, selected.fields);
  assert.equal(cancelled.topCandidateId, selected.topCandidateId);
  assert.equal(await page.locator('#discovery-selection').innerText(), '');
  await page.locator('[data-discovery-select="candidate-2"]').click();
  await edit(page, 'consent', 'false');
  const withdrawn = await view(page);
  assert.deepEqual(withdrawn.candidates, []); assert.equal(withdrawn.selection, null); assert.equal(withdrawn.topCandidateId, null);
  assert.equal(await page.locator(`${section} [data-discovery-candidate]`).count(), 0);
  assert.match(await page.locator('#discovery-summary').innerText(), /중단/);
  assert.equal(await page.locator('#discovery-change').innerText(), '');
  await edit(page, 'consent', 'true');
  assert.equal((await view(page)).topCandidateId, 'candidate-2'); assert.equal((await view(page)).selection, null);
  await clear(page, 'consent');
  assert.deepEqual((await view(page)).candidates, []); assert.equal((await view(page)).question.field, 'consent');
  await screenshot(page, label + '-consent-cleared');
  report.paths.push({ label, checks: ['keyboard-consent-and-visible-focus', 'questionnaire-self-and-wants-separate', 'expanded-purpose-contact-rhythm-explicit-answers', 'five-public-candidates', 'reciprocal-required-exclusion', 'unknown-schedule-pending', 'preference-changes-candidate-and-reason', 'change-clears-selection', 'cancel-does-not-infer-dislike', 'consent-withdrawal-hides-results', 'reconsent-does-not-restore-selection', 'unknown-consent-hides-results'],
    onboardingTrace: trace, beforeCandidate: 'candidate-1', afterCandidate: changed.topCandidateId, changeReason: changed.change.reason, layout: await checkLayout(page, label) });
}
async function boundaries(page) {
  await scenario(page, 'ready');
  await clear(page, 'wants.pace');
  let current = await view(page);
  assert.equal(current.question.field, 'wants.pace'); assert.equal(current.question.optional, true);
  const before = structuredClone(current.candidates), top = current.topCandidateId;
  await action(page, 'skip').click();
  current = await view(page);
  assert.equal(field(current, 'wants.pace').state, 'unknown'); assert.equal(field(current, 'wants.pace').value, null);
  assert.deepEqual(current.candidates, before); assert.equal(current.topCandidateId, top);
  assert.match(await page.locator('#discovery-notice').innerText(), /미확인.*평소 답이나 상관없다는 답으로 채우지/);
  await edit(page, 'wants.pace', 'listen', true);
  current = await view(page);
  assert.equal(field(current, 'wants.pace').required, true);
  assert.deepEqual(current.candidates.filter(item => item.status === 'eligible').map(item => item.id), ['candidate-2']);
  await candidateState(page, 'candidate-1', 'excluded');
  await clear(page, 'wants.pace');
  current = await view(page);
  assert.equal(field(current, 'wants.pace').state, 'unknown'); assert.equal(field(current, 'wants.pace').required, true);
  assert.equal(current.topCandidateId, null); assert.equal(current.candidates.filter(item => item.status === 'eligible').length, 0);
  assert.equal(current.question.field, 'wants.pace'); assert.equal(current.question.optional, false);
  assert.equal(await action(page, 'skip').count(), 0, 'missing required preference cannot be skipped');
  await answer(page, 'listen');
  assert.equal(field(await view(page), 'wants.pace').required, true, 'answering preserves the declared requirement');
  assert.equal((await view(page)).topCandidateId, 'candidate-2');
  await clear(page, 'self.pace');
  // This candidate can also be excluded by the user's new mandatory wish; test
  // the reciprocal missing-self gate with the user's wish made unrestricted.
  await edit(page, 'wants.pace', 'any');
  await candidateState(page, 'candidate-4', 'pending');
  await edit(page, 'self.pace', 'lead');
  await candidateState(page, 'candidate-4', 'eligible');
  await screenshot(page, 'desktop-reciprocal-confirmed');
  await scenario(page, 'boundary');
  const blocked = await view(page);
  assert.equal(blocked.topCandidateId, null); assert.equal(blocked.selection, null);
  assert.equal(blocked.candidates.filter(item => item.status === 'eligible').length, 0);
  assert.equal(await page.locator(`${section} [data-discovery-select]`).count(), 0);
  await details(page, '#discovery-held-details');
  await screenshot(page, 'desktop-no-eligible');
  await scenario(page, 'first');
  const reset = await view(page);
  assert.ok(reset.fields.every(item => item.state === 'unknown')); assert.deepEqual(reset.candidates, []); assert.equal(reset.selection, null);
  report.paths.push({ label: 'desktop-extra-boundaries', checks: ['unknown-skip-does-not-answer-or-rerank', 'own-required-condition-excludes', 'clearing-required-answer-keeps-requirement-and-holds-recommendation', 'required-question-cannot-be-skipped', 'required-answer-preserves-requirement', 'missing-self-keeps-reciprocal-check-pending', 'explicit-self-releases-reciprocal-check', 'no-eligible-does-not-relax-conditions', 'reset-clears-answers-and-selection'] });
}
async function newPage(viewport, label, shareURL, shareHTML) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (shareURL && request.url() === shareURL) return route.fulfill({ contentType: 'text/html', body: shareHTML });
    if (['file:', 'data:', 'blob:'].includes(url.protocol)) return route.continue();
    if (shareHTML || url.origin !== origin) { report.externalRequests.push({ label, url: request.url() }); return route.abort(); }
    if (url.pathname.startsWith('/api/')) {
      if (request.method() === 'GET' && url.pathname === '/api/computer-interpretation') { report.mockedApi.push({ label, path: url.pathname }); return route.fulfill({ json: { available: false, reason: 'test-no-host' } }); }
      if (request.method() === 'GET' && url.pathname === '/api/me') { report.mockedApi.push({ label, path: url.pathname }); return route.fulfill({ json: { user: null } }); }
      report.unexpectedRequests.push({ label, url: request.url(), method: request.method() }); return route.abort();
    }
    if (request.method() !== 'GET') { report.unexpectedRequests.push({ label, url: request.url(), method: request.method() }); return route.abort(); }
    return route.continue();
  });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
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
    const label = `local-${width}`, { context, page } = await newPage({ width, height: 950 }, label);
    try { await load(page, origin + '/atlas-lab/#discovery-title'); await mainJourney(page, label); if (width === 1280) await boundaries(page); }
    finally { await context.close(); }
  }
  const share = path.join(output, 'share.html');
  await promisify(execFile)(process.execPath, [fileURLToPath(new URL('../experiences/atlas-lab/build-share.mjs', import.meta.url)), share]);
  const html = await fs.readFile(share, 'utf8');
  for (const mode of ['file', 'http']) {
    const label = `${mode}-share-390`, url = mode === 'file' ? pathToFileURL(share).href : origin + '/discovery-share';
    const { context, page } = await newPage({ width: 390, height: 844 }, label, mode === 'http' ? url : null, html);
    try { await load(page, url); assert.match(await page.locator('#model-host-status').innerText(), /공유판/); await mainJourney(page, label); }
    finally { await context.close(); }
  }
  report.share = share;
  for (const key of ['errors', 'missing', 'failedRequests', 'externalRequests', 'unexpectedRequests']) assert.deepEqual(report[key], [], key);
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; process.exitCode = 1; }
finally {
  await browser?.close(); if (server?.listening) await new Promise(resolve => server.close(resolve));
  await fs.mkdir(output, { recursive: true }); await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, pathGroups: report.paths.length, report: path.join(output, 'result.json'), ...(report.failure ? { failure: report.failure } : {}) }));
}
