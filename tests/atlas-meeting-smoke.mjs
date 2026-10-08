// Fictional meeting UX in real Chrome. UI actions only; the debug API is read-only.
// No accounts, remote data, provider calls or deployment. Run: node tests/atlas-meeting-smoke.mjs
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
const output = fileURLToPath(new URL('../experiences/atlas-lab/qa/meeting/', import.meta.url));
const report = { version: 1, status: 'running', at: new Date().toISOString(), kind: 'fictional-meeting-browser-ux',
  modelCalls: 0, externalApiCost: 0, actualMeetings: 0, deployed: false, errors: [], missing: [], failedRequests: [], externalRequests: [], unexpectedRequests: [], mockedApi: [], paths: [], screenshots: [] };
const section = '.meeting-lab';
const view = (page, person) => page.evaluate(person => window.synkAtlasLab.meeting(person), person);
const action = (page, id) => page.locator(`${section} [data-meeting-action="${id}"]`);
const role = (page, person) => page.locator(`${section} [data-meeting-role="${person}"]`).click();
const field = (snapshot, id) => snapshot.me.fields.find(item => item.id === id);
const personResponse = (snapshot, person) => snapshot.proposal.people.find(item => item.id === person);
let server, browser, origin;

async function details(page, selector) {
  const element = page.locator(selector);
  if (!(await element.evaluate(node => node.open))) await element.locator(':scope > summary').click();
}
async function scenario(page, id) {
  await details(page, `${section} .meeting-record`);
  await page.locator(`${section} [data-meeting-scenario="${id}"]`).click();
}
async function edit(page, id, value, { duration = 'once', share = false, required = false, expectCurrent = true } = {}) {
  await details(page, '#meeting-editor');
  await page.locator('#meeting-edit-field').selectOption(id);
  await page.locator('#meeting-edit-value').selectOption(value);
  await page.locator('#meeting-edit-period').selectOption(duration);
  for (const [name, checked] of [['share', share], ['required', required]]) {
    const control = page.locator(`#meeting-edit-${name}`);
    if (!(await control.isDisabled())) await control.setChecked(checked);
  }
  await action(page, 'save-setting').click();
  if (expectCurrent) assert.equal(String(field(await view(page), id).value), String(value));
}
async function checkLayout(page, label) {
  await page.evaluate(() => document.fonts.ready);
  const result = await page.evaluate(selector => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll(selector + ' *')].filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1);
    }).slice(0, 10).map(element => ({ id: element.id, tag: element.tagName, className: String(element.className) })) }), section);
  assert.ok(result.documentWidth <= result.width, `${label}: document overflow ${JSON.stringify(result)}`);
  assert.deepEqual(result.overflowing, [], `${label}: meeting control overflow`);
  return result;
}
async function screenshot(page, label, selector = section) {
  await checkLayout(page, label);
  const file = path.join(output, label + '.png');
  await page.locator(selector).screenshot({ path: file }); report.screenshots.push(file);
}
async function load(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.synkAtlasLab?.meeting);
  assert.equal(await page.evaluate(() => document.characterSet), 'UTF-8', 'standalone documents declare their own encoding');
  assert.equal(await page.locator('#interpret-ai').isDisabled(), true);
  const text = await page.locator(section).innerText();
  assert.match(text, /가상/);
  assert.doesNotMatch(text, /(?:궁합|성공\s*확률|관계\s*점수)\s*[:：]?\s*\d+(?:\.\d+)?\s*%/);
}
async function onboarding(page) {
  const choices = { availability: 'weekend', consent: true, atmosphere: 'quiet', duration: '90', activity: 'cafe' }, trace = [];
  for (let step = 0; step < 15; step += 1) {
    const current = await view(page), q = current.nextQuestion;
    if (!q) break;
    assert.ok(Object.hasOwn(choices, q.field), `unexpected onboarding field ${q.field}`);
    await role(page, q.person);
    const active = await view(page), question = active.nextQuestion;
    assert.equal(question.person, q.person);
    const option = question.options.find(item => String(item.value) === String(choices[q.field]));
    assert.ok(option, `missing onboarding option ${q.field}`);
    await page.locator(`#meeting-inputs [data-meeting-field="${q.field}"][data-meeting-answer="${option.id}"]`).click();
    trace.push({ person: q.person, field: q.field, value: option.value });
  }
  await role(page, 'person-a');
  for (const [id, value] of [['atmosphere', 'quiet'], ['duration', '90'], ['activity', 'cafe']]) {
    if (String(field(await view(page), id)?.value) !== value) await edit(page, id, value, { duration: 'ongoing', share: true });
  }
  const result = await view(page);
  assert.equal(result.canPropose, true); assert.equal(result.recommendation.plan.minutes, 90);
  return trace;
}
async function completeMeeting(page) {
  await role(page, 'person-a');
  let current = await view(page);
  if (!current.proposal?.valid) await action(page, 'propose').click();
  for (const person of ['person-a', 'person-b']) {
    await role(page, person); current = await view(page);
    if (!personResponse(current, person).seen) await action(page, 'view').click();
    if (personResponse(await view(page), person).response !== 'accept') await action(page, 'accept').click();
  }
  assert.equal((await view(page)).proposal.canMeet, true);
  for (const person of ['person-a', 'person-b']) {
    await role(page, person);
    if (!personResponse(await view(page), person).met) await action(page, 'met').click();
  }
  assert.equal((await view(page)).encounter.completed, true);
  await role(page, 'person-a');
}
async function mainJourney(page, label) {
  const initial = await view(page), onboardingTrace = await onboarding(page);
  assert.equal(initial.proposal, null);
  await action(page, 'propose').click();
  let current = await view(page);
  assert.equal(current.proposal.plan.minutes, 90);
  assert.equal(await action(page, 'accept').isDisabled(), true, 'proposal must be viewed before acceptance');
  await action(page, 'view').click(); await action(page, 'accept').click();
  current = await view(page);
  assert.equal(personResponse(current, 'person-b').response, 'unanswered');
  assert.equal(current.proposal.canMeet, false, 'one acceptance does not authorize a meeting');
  await role(page, 'person-b'); await action(page, 'view').click();
  const beforeBusy = await view(page);
  await action(page, 'busy').click();
  const busy = await view(page);
  assert.equal(personResponse(busy, 'person-b').response, 'busy'); assert.equal(busy.proposal.canMeet, false);
  assert.deepEqual(busy.me.fields, beforeBusy.me.fields, 'busy does not infer a dislike or change a preference');
  assert.deepEqual(busy.me.feedback, beforeBusy.me.feedback);
  assert.match(await page.locator('#meeting-plan').innerText(), /싫어.*기록하지/);
  await action(page, 'accept').click();
  assert.equal((await view(page)).proposal.canMeet, true);
  await action(page, 'met').click();
  assert.equal((await view(page)).encounter.completed, false, 'one simulated attendance is not a completed pair meeting');
  await role(page, 'person-a'); await action(page, 'met').click();
  const met = await view(page);
  assert.equal(met.encounter.completed, true); assert.equal(met.me.feedback.length, 0);
  const beforeFeedback = structuredClone(met.me.fields), beforeNext = met.me.nextPreview.recommendation.plan;
  await action(page, 'feedback-too-long').click();
  const pending = await view(page);
  assert.deepEqual(pending.me.fields, beforeFeedback, 'recording feedback cannot automatically change a preference');
  assert.deepEqual(pending.me.nextPreview.recommendation.plan, beforeNext);
  assert.equal(pending.me.feedback.length, 1); assert.equal(pending.me.pendingProposals.length, 1);
  assert.equal(pending.proposal.plan.minutes, 90);
  const feedbackId = pending.me.feedback[0].id, proposalId = pending.me.pendingProposals[0].id;
  await screenshot(page, label + '-private-pending');
  await role(page, 'person-b');
  const other = await view(page), otherJson = JSON.stringify(other);
  assert.equal(other.me.feedback.length, 0); assert.equal(other.me.pendingProposals.length, 0);
  assert.ok(!otherJson.includes(JSON.stringify(feedbackId)), 'other viewer must not receive private feedback records');
  assert.ok(!otherJson.includes(JSON.stringify(proposalId)), 'other viewer must not receive private change proposals');
  assert.equal(await page.locator(`[data-meeting-proposal="${proposalId}"]`).count(), 0);
  await role(page, 'person-a'); await action(page, 'apply-ongoing').click();
  const applied = await view(page);
  assert.equal(applied.me.pendingProposals.length, 0); assert.equal(applied.me.nextPreview.recommendation.plan.minutes, 40);
  assert.equal(applied.proposal.plan.minutes, 90, 'private preview is not a new shared promise');
  await role(page, 'person-b');
  const otherAfterApply = await view(page);
  assert.equal(otherAfterApply.proposal.plan.minutes, 90);
  assert.equal(otherAfterApply.me.nextPreview.recommendation.plan.minutes, 90);
  assert.ok(!JSON.stringify(otherAfterApply).includes('feedback-confirmed'), 'private reasoning does not leak through the other perspective');
  await role(page, 'person-a');
  await screenshot(page, label + '-explicit-change', '#meeting-reflection');
  await action(page, 'next').click();
  const next = await view(page);
  assert.equal(next.encounter.index, met.encounter.index + 1); assert.equal(next.recommendation.plan.minutes, 40);
  assert.equal(field(next, 'duration').source, 'feedback-confirmed');
  assert.equal(next.proposal, null, 'old acceptance is not carried into the next encounter');
  assert.ok(next.recommendation.reasons.some(text => /피드백|확인.*반영|직접.*반영/.test(text)));
  const layout = await checkLayout(page, label + '-next');
  await screenshot(page, label + '-next');
  report.paths.push({ label, checks: ['wanted-experience', 'view-before-accept', 'one-sided-hold', 'busy-not-dislike', 'both-accept', 'both-simulated-met', 'feedback-does-not-apply', 'private-perspective', 'explicit-ongoing-change', 'next-encounter-reason'],
    onboardingTrace, beforeMinutes: 90, nextMinutes: next.recommendation.plan.minutes, layout, nextReasons: next.recommendation.reasons });
}
async function lifetimeAndRevision(page) {
  await scenario(page, 'ready');
  await edit(page, 'duration', '40', { duration: 'once' });
  assert.equal((await view(page)).recommendation.plan.minutes, 40);
  await completeMeeting(page); await action(page, 'next').click();
  assert.equal(field(await view(page), 'duration').value, '90', 'one-encounter correction expires');
  await edit(page, 'duration', '40', { duration: 'ongoing' });
  await completeMeeting(page); await action(page, 'next').click();
  assert.equal(field(await view(page), 'duration').value, '40', 'ongoing correction survives');

  await scenario(page, 'ready'); await completeMeeting(page); await action(page, 'feedback-too-long').click();
  await action(page, 'apply-once').click(); await action(page, 'next').click();
  assert.equal((await view(page)).recommendation.plan.minutes, 40);
  await completeMeeting(page); await action(page, 'next').click();
  assert.equal((await view(page)).recommendation.plan.minutes, 90, 'apply-once affects exactly the next encounter');

  // A user may leave the reflection before deciding. The pending proposal must
  // remain reviewable next time, without being silently applied or discarded.
  await scenario(page, 'ready'); await completeMeeting(page); await action(page, 'feedback-too-long').click();
  const pendingId = (await view(page)).me.pendingProposals[0].id;
  await action(page, 'next').click();
  const deferred = await view(page);
  assert.equal(deferred.recommendation.plan.minutes, 90);
  assert.ok(deferred.me.pendingProposals.some(proposal => proposal.id === pendingId));
  assert.equal(await page.locator(`[data-meeting-proposal="${pendingId}"]`).isVisible(), true);
  assert.match(await action(page, 'apply-once').innerText(), /이번 만남/, 'the label tracks the proposal target after advancing');
  await screenshot(page, 'desktop-deferred-feedback');
  await action(page, 'apply-ongoing').click();
  assert.equal((await view(page)).recommendation.plan.minutes, 40);
  assert.equal((await view(page)).me.pendingProposals.length, 0);

  await scenario(page, 'ready'); await action(page, 'propose').click();
  for (const person of ['person-a', 'person-b']) { await role(page, person); await action(page, 'view').click(); await action(page, 'accept').click(); }
  const oldPlan = (await view(page)).proposal.plan.id;
  await page.locator('#meeting-plan').getByText('다른 만남 방식 살펴보기', { exact: true }).click();
  await action(page, 'edit-plan').first().click();
  const revised = await view(page);
  assert.notEqual(revised.proposal.plan.id, oldPlan); assert.equal(revised.proposal.canMeet, false);
  assert.ok(revised.proposal.people.every(person => person.response === 'unanswered' && !person.seen));

  // Once either person records attendance, corrections belong to the next
  // encounter. They cannot invalidate a meeting that is already being completed.
  await scenario(page, 'ready'); await action(page, 'propose').click();
  for (const person of ['person-a', 'person-b']) { await role(page, person); await action(page, 'view').click(); await action(page, 'accept').click(); }
  await role(page, 'person-a'); await action(page, 'met').click();
  await role(page, 'person-b'); const started = await view(page);
  assert.equal(started.encounter.started, true); assert.equal(started.encounter.completed, false);
  await details(page, '#meeting-editor');
  assert.match(await page.locator('#meeting-edit-period option[value="once"]').innerText(), /다음 만남/);
  await edit(page, 'duration', '40', { duration: 'once', expectCurrent: false });
  const nextOnly = await view(page);
  assert.equal(nextOnly.proposal.valid, true); assert.equal(nextOnly.proposal.plan.id, started.proposal.plan.id);
  assert.equal(nextOnly.me.nextPreview.recommendation.plan.minutes, 40);
  assert.ok(nextOnly.proposal.people.every(person => person.response === 'accept'));
  assert.equal(await action(page, 'busy').isDisabled(), true);
  await action(page, 'met').click(); assert.equal((await view(page)).encounter.completed, true);
  await action(page, 'next').click(); assert.equal((await view(page)).recommendation.plan.minutes, 40);
  await scenario(page, 'boundary');
  const boundary = await view(page);
  assert.equal(boundary.recommendation.status, 'blocked'); assert.equal(boundary.recommendation.plan, null);
  assert.equal(boundary.canPropose, false); assert.equal(await action(page, 'propose').count(), 0);
  assert.match(await page.locator('#meeting-plan').innerText(), /맞는 만남이 없/);
  await screenshot(page, 'desktop-boundary');
  await scenario(page, 'first');
  for (let step = 0; step < 5; step += 1) {
    const q = (await view(page)).nextQuestion;
    if (q.optional) break;
    await role(page, q.person);
    const wanted = q.field === 'consent' ? true : 'weekend', option = q.options.find(item => item.value === wanted);
    assert.ok(option);
    await page.locator(`#meeting-inputs [data-meeting-field="${q.field}"][data-meeting-answer="${option.id}"]`).click();
  }
  const optional = (await view(page)).nextQuestion;
  assert.equal(optional.optional, true); await role(page, optional.person);
  const beforeSkip = field(await view(page), optional.field);
  await action(page, 'skip-question').click();
  assert.deepEqual(field(await view(page), optional.field), beforeSkip, 'skipping is not an inferred answer');
  assert.notEqual((await view(page)).nextQuestion?.field, optional.field);
  await completeMeeting(page); await action(page, 'next').click();
  assert.equal((await view(page)).nextQuestion?.field, optional.field, 'a skipped question is deferred only for this encounter');
  report.paths.push({ label: 'desktop-extra-boundaries', checks: ['once-expires', 'ongoing-survives', 'feedback-apply-once-next-only', 'deferred-feedback-remains-reviewable', 'edit-resets-both-acceptances', 'partial-attendance-correction-targets-next', 'finite-pool-blocked', 'optional-skip-stays-unknown-and-expires'] });
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
    try { await load(page, origin + '/atlas-lab/#meeting-title'); await mainJourney(page, label); if (width === 1280) await lifetimeAndRevision(page); }
    finally { await context.close(); }
  }
  const share = path.join(output, 'share.html');
  await promisify(execFile)(process.execPath, [fileURLToPath(new URL('../experiences/atlas-lab/build-share.mjs', import.meta.url)), share]);
  const html = await fs.readFile(share, 'utf8');
  for (const mode of ['file', 'http']) {
    const label = `${mode}-share-390`, url = mode === 'file' ? pathToFileURL(share).href : origin + '/meeting-share';
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
