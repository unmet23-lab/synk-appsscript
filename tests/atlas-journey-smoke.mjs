// Synthetic discovery -> same-person meeting journey in real Chrome.
// UI actions only; debug access is read-only. No provider calls or deployment.
// Run: node tests/atlas-journey-smoke.mjs
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
const output = fileURLToPath(new URL('../experiences/atlas-lab/qa/journey/', import.meta.url));
const report = { version: 1, status: 'running', at: new Date().toISOString(), kind: 'fictional-discovery-meeting-journey-browser-ux',
  modelCalls: 0, externalApiCost: 0, actualPeople: 0, deployed: false, errors: [], missing: [], failedRequests: [], externalRequests: [], unexpectedRequests: [], mockedApi: [], paths: [], screenshots: [] };
const discovery = page => page.evaluate(() => window.synkAtlasLab.discovery());
const preview = page => page.evaluate(() => window.synkAtlasLab.discoveryPreview());
const meeting = (page, person) => page.evaluate(person => window.synkAtlasLab.meeting(person), person);
const dAction = (page, id) => page.locator(`.discovery-lab [data-discovery-action="${id}"]`);
const mAction = (page, id) => page.locator(`.meeting-lab [data-meeting-action="${id}"]`);
const mRole = (page, person) => page.locator(`.meeting-lab [data-meeting-role="${person}"]`).click();
const mField = (view, id) => view.me.fields.find(item => item.id === id);
let server, browser, origin;

async function details(page, selector) {
  const element = page.locator(selector);
  if (!(await element.evaluate(node => node.open))) await element.locator(':scope > summary').click();
}
async function scenario(page, id) {
  await details(page, '.discovery-lab .discovery-reset');
  await page.locator(`.discovery-lab [data-discovery-scenario="${id}"]`).click();
}
async function meetingEdit(page, id, value) {
  await details(page, '#meeting-editor');
  await page.locator('#meeting-edit-field').selectOption(id);
  await page.locator('#meeting-edit-value').selectOption(value);
  await page.locator('#meeting-edit-period').selectOption('ongoing');
  for (const [name, checked] of [['share', true], ['required', false]]) {
    const control = page.locator(`#meeting-edit-${name}`);
    if (!(await control.isDisabled())) await control.setChecked(checked);
  }
  await mAction(page, 'save-setting').click();
  assert.equal(String(mField(await meeting(page), id).value), String(value));
}
async function answerMeeting(page, value) {
  const q = (await meeting(page)).nextQuestion;
  assert.ok(q, 'meeting asks a separate question');
  await mRole(page, q.person);
  const option = q.options.find(item => item.value === value);
  assert.ok(option, `meeting question ${q.field} has the answer`);
  await page.locator(`#meeting-inputs [data-meeting-field="${q.field}"][data-meeting-answer="${option.id}"]`).click();
  assert.equal(mField(await meeting(page, q.person), q.field).value, value);
  return { person: q.person, field: q.field, value };
}
async function completeLinkedMeeting(page) {
  const consents = [];
  assert.equal((await meeting(page)).canPropose, false);
  assert.equal((await meeting(page)).nextQuestion.field, 'consent');
  consents.push(await answerMeeting(page, true));
  assert.equal((await meeting(page)).canPropose, false, 'one meeting consent is insufficient');
  assert.equal((await meeting(page)).nextQuestion.field, 'consent');
  consents.push(await answerMeeting(page, true));
  assert.notEqual(consents[0].person, consents[1].person);
  for (const person of ['person-a', 'person-b']) {
    await mRole(page, person);
    for (const [id, value] of [['atmosphere', 'quiet'], ['duration', '90'], ['activity', 'cafe']]) await meetingEdit(page, id, value);
  }
  await mRole(page, 'person-a'); await mAction(page, 'propose').click();
  assert.equal((await meeting(page)).proposal.plan.minutes, 90);
  for (const person of ['person-a', 'person-b']) {
    await mRole(page, person); await mAction(page, 'view').click(); await mAction(page, 'accept').click();
  }
  assert.equal((await meeting(page)).proposal.canMeet, true);
  for (const person of ['person-a', 'person-b']) { await mRole(page, person); await mAction(page, 'met').click(); }
  await mRole(page, 'person-a');
  assert.equal((await meeting(page)).encounter.completed, true);
  await mAction(page, 'feedback-too-long').click();
  const completed = await meeting(page);
  assert.equal(completed.me.feedback.length, 1); assert.equal(completed.me.pendingProposals.length, 1);
  return { consents, completed };
}
async function startCandidate(page, candidateId) {
  if ((await discovery(page)).selection?.candidateId !== candidateId) await page.locator(`[data-discovery-select="${candidateId}"]`).click();
  await dAction(page, 'start-meeting').click();
  const linked = await meeting(page);
  assert.equal(linked.connection.candidateId, candidateId);
  assert.equal(linked.people.find(person => person.id === 'person-b').label, `가상 성인 ${candidateId.split('-').at(-1)}`);
  assert.equal(linked.connection.label, linked.people.find(person => person.id === 'person-b').label);
  return linked;
}
async function assertFreshPair(page, candidateId) {
  for (const person of ['person-a', 'person-b']) {
    const view = await meeting(page, person);
    assert.equal(view.connection.candidateId, candidateId);
    assert.equal(mField(view, 'availability').value, 'weekend');
    assert.equal(mField(view, 'availability').state, 'known');
    for (const field of ['consent', 'atmosphere', 'duration', 'activity']) {
      assert.equal(mField(view, field).state, 'unknown', `${person} ${field} is not inferred from discovery`);
      assert.equal(mField(view, field).value, null);
    }
    assert.equal(view.proposal, null); assert.equal(view.encounter.completed, false);
    assert.deepEqual(view.me.feedback, []); assert.deepEqual(view.me.pendingProposals, []);
  }
}
async function editDraft(page, id, optionId, required = false) {
  await details(page, '#discovery-editor');
  await page.locator('#discovery-edit-field').selectOption(id);
  await page.locator('#discovery-edit-value').selectOption(optionId);
  if (id.startsWith('wants.')) await page.locator('#discovery-edit-required').setChecked(required);
  await dAction(page, 'preview').click();
}
async function mainJourney(page, label) {
  await scenario(page, 'ready');
  const first = await startCandidate(page, 'candidate-1');
  await assertFreshPair(page, 'candidate-1');
  assert.match(await page.locator('#meeting-stage').innerText(), /나|가상 성인 1/);
  assert.match(await page.locator('#meeting-roles').innerText(), /가상 성인 1/);
  const before = { discovery: await discovery(page), a: await meeting(page, 'person-a'), b: await meeting(page, 'person-b') };
  await editDraft(page, 'wants.pace', 'listen');
  const draft = await preview(page);
  assert.equal(draft.before.topCandidateId, 'candidate-1'); assert.equal(draft.after.topCandidateId, 'candidate-2');
  assert.equal(draft.selectionWillClear, true);
  assert.deepEqual(await discovery(page), before.discovery, 'preview is not a saved preference');
  assert.deepEqual(await meeting(page, 'person-a'), before.a, 'preview preserves the current meeting');
  assert.deepEqual(await meeting(page, 'person-b'), before.b, 'preview does not change the other role');
  assert.match(await page.locator('#discovery-preview').innerText(), /아직 적용하지 않았/);
  await screenshot(page, label + '-preview', '#discovery-preview');
  await dAction(page, 'preview-cancel').click();
  assert.equal(await preview(page), null);
  assert.deepEqual(await discovery(page), before.discovery);
  assert.deepEqual(await meeting(page, 'person-a'), before.a); assert.deepEqual(await meeting(page, 'person-b'), before.b);
  await editDraft(page, 'wants.pace', 'listen'); await dAction(page, 'preview-apply').click();
  const applied = await discovery(page);
  assert.equal(applied.topCandidateId, 'candidate-2'); assert.equal(applied.selection, null); assert.equal(await preview(page), null);
  assert.equal(await meeting(page), null, 'applying a changed discovery condition closes the linked meeting');
  assert.equal(await mAction(page, 'accept').count(), 0); assert.equal(await mAction(page, 'feedback-too-long').count(), 0);
  assert.match(await page.locator('.meeting-lab').innerText(), /연결.*해제|다시 골라/);
  await screenshot(page, label + '-closed', '.meeting-lab');
  const second = await startCandidate(page, 'candidate-2');
  assert.notEqual(second.connection.key, first.connection.key);
  await assertFreshPair(page, 'candidate-2');
  await screenshot(page, label + '-same-candidate', '.meeting-lab');
  const { consents, completed } = await completeLinkedMeeting(page);
  assert.equal(completed.proposal.people.find(person => person.id === 'person-b').label, '가상 성인 2');
  assert.equal((await meeting(page, 'person-b')).me.feedback.length, 0);
  const completedA = await meeting(page, 'person-a'), completedB = await meeting(page, 'person-b');
  await dAction(page, 'start-meeting').click();
  assert.deepEqual(await meeting(page, 'person-a'), completedA, 'reopening the same selection preserves its meeting and feedback');
  assert.deepEqual(await meeting(page, 'person-b'), completedB);
  await screenshot(page, label + '-feedback-retained', '#meeting-reflection');
  await page.locator('[data-discovery-select="candidate-1"]').click();
  assert.equal(await meeting(page), null, 'selecting another candidate closes the old pair immediately');
  await startCandidate(page, 'candidate-1'); await assertFreshPair(page, 'candidate-1');
  assert.notEqual((await meeting(page)).connection.key, first.connection.key, 'a new selection is a new connection');
  await page.locator('[data-discovery-select="candidate-2"]').click();
  await startCandidate(page, 'candidate-2'); await assertFreshPair(page, 'candidate-2');
  assert.notEqual((await meeting(page)).connection.key, second.connection.key, 'discarded pair records are not resurrected');
  report.paths.push({ label, checks: ['same-candidate-label-and-schedule', 'no-inferred-meeting-consent-or-preferences', 'preview-preserves-actual-state-and-selection', 'cancel-preserves-both-roles', 'apply-clears-selection-and-meeting', 'separate-bilateral-meeting-consent', 'both-accept-and-simulated-meeting', 'private-feedback', 'same-selection-reentry-preserves-record', 'candidate-switch-clears-records', 'old-candidate-return-does-not-resurrect-records'],
    beforeCandidate: first.connection.candidateId, afterCandidate: second.connection.candidateId, consents, layout: await checkLayout(page, label) });
}
async function boundaries(page) {
  await scenario(page, 'ready'); await startCandidate(page, 'candidate-1');
  const original = { discovery: await discovery(page), meeting: await meeting(page) };
  await details(page, '#discovery-editor');
  await page.locator('#discovery-edit-field').selectOption('consent');
  await page.locator('#discovery-edit-value').selectOption('false');
  assert.equal(await dAction(page, 'preview').isVisible(), false, 'discovery consent cannot be previewed into access');
  assert.deepEqual(await discovery(page), original.discovery); assert.deepEqual(await meeting(page), original.meeting);
  await editDraft(page, 'wants.pace', 'listen');
  await page.locator('#discovery-edit-value').selectOption('lead');
  assert.equal(await preview(page), null); assert.equal(await dAction(page, 'preview-apply').count(), 0, 'a changed form discards its stale draft');
  assert.deepEqual(await discovery(page), original.discovery);
  await editDraft(page, 'wants.pace', 'listen');
  await page.locator('[data-discovery-select="candidate-3"]').click();
  assert.equal(await preview(page), null); assert.equal(await meeting(page), null);
  await dAction(page, 'start-meeting').click(); await assertFreshPair(page, 'candidate-3');
  await dAction(page, 'unselect').click(); assert.equal(await meeting(page), null);
  await screenshot(page, 'desktop-cancelled-selection', '.meeting-lab');
  report.paths.push({ label: 'desktop-extra-boundaries', checks: ['consent-has-no-preview-action', 'unapplied-consent-form-preserves-pair', 'editing-form-discards-stale-preview', 'candidate-selection-discards-preview-and-old-pair', 'unselect-closes-pair'] });
}
async function checkLayout(page, label) {
  await page.evaluate(() => document.fonts.ready);
  const result = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll('.discovery-lab *, .meeting-lab *')].filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1);
    }).slice(0, 10).map(element => ({ id: element.id, tag: element.tagName, className: String(element.className) })) }));
  assert.ok(result.documentWidth <= result.width, `${label}: document overflow ${JSON.stringify(result)}`);
  assert.deepEqual(result.overflowing, [], `${label}: journey control overflow`);
  return result;
}
async function screenshot(page, label, selector) {
  await checkLayout(page, label);
  const file = path.join(output, label + '.png');
  await page.locator(selector).screenshot({ path: file }); report.screenshots.push(file);
}
async function load(page, url) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => !!window.synkAtlasLab?.discovery && !!window.synkAtlasLab?.meeting);
  assert.equal(await page.evaluate(() => document.characterSet), 'UTF-8');
  assert.equal(await page.locator('#interpret-ai').isDisabled(), true);
  assert.match(await page.locator('.discovery-lab').innerText(), /가상/);
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
    const label = `${mode}-share-390`, url = mode === 'file' ? pathToFileURL(share).href : origin + '/journey-share';
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
