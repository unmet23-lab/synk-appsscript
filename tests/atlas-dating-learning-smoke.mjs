// Free synthetic Chrome proof. Isolated SQLite; UI mutations only; snapshots are read-only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const out = fileURLToPath(new URL('../experiences/atlas-lab/qa/dating-learning/', import.meta.url));
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-dating-learning-'));
const report = { at: new Date().toISOString(), status: 'running', kind: 'synthetic-explicit-learning-browser', modelCalls: 0, externalApiCost: 0, actualUsers: 0, paths: [], errors: [], externalRequests: [], screenshots: [] };
let server, browser, origin, time = Date.parse('2026-10-06T03:00:00.000Z');
const snap = page => page.evaluate(() => window.synkDating.snapshot());
const idle = page => page.waitForFunction(() => !document.getElementById('content').hasAttribute('aria-busy'));
const field = (snapshot, id) => snapshot.view.discovery.fields.find(item => item.id === id);
async function click(page, action, scope = page) { await scope.locator(`[data-action="${action}"]`).click(); await idle(page); }
async function wait(page, fn, arg) { await page.waitForFunction(fn, arg); await idle(page); }
async function opened(page, title) {
  const summary = page.locator('summary').filter({ hasText: title }).last(), details = summary.locator('..');
  if (!await details.evaluate(node => node.open)) await summary.click();
  return details;
}
async function pageFor(role, width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 950 }, timezoneId: 'Asia/Seoul', serviceWorkers: 'block' });
  await context.route('**/*', route => { const url = new URL(route.request().url()); if (url.origin !== origin) { report.externalRequests.push(url.href); return route.abort(); } return route.continue(); });
  const page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(`${origin}/atlas-lab/dating.html?demo=${role}`);
  await wait(page, () => !!window.synkDating?.snapshot().view);
  return page;
}
async function shot(page, name, locator = page) {
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: horizontal overflow`);
  assert.deepEqual(await page.locator('img').evaluateAll(images => images.filter(image => !image.complete || !image.naturalWidth).map(image => image.src)), [], `${name}: missing images`);
  const filename = path.join(out, `${name}.png`);
  await locator.screenshot({ path: filename, ...(locator === page ? { fullPage: true } : {}) }); report.screenshots.push(`${name}.png`);
}
async function onboard(page, nickname) {
  await page.locator('[name="nickname"]').fill(nickname);
  for (const name of ['adult', 'public', 'invites', 'save']) await page.locator(`[name="${name}"]`).check();
  await click(page, 'onboard'); await wait(page, () => window.synkDating.snapshot().view.consents.storePreferences);
  for (let i = 0; i < 18; i++) {
    const q = (await snap(page)).view.discovery.question; if (!q || q.optional) break;
    const values = { consent: 'true', availability: 'weekend', 'self.pace': 'listen', 'self.plan': 'planned' };
    const answer = values[q.field] || q.options[0].id;
    await click(page, `answer-${answer}`);
  }
  assert.equal((await snap(page)).view.discovery.status, 'ready');
}
async function editPreview(page, id, value, { target = 'baseline', required, until } = {}) {
  await click(page, 'nav-profile');
  const section = page.locator(`[data-preference-field="${id}"]`);
  if (!await section.evaluate(node => node.open)) await section.locator(':scope > summary').click();
  await section.locator('[name="value"]').selectOption(value); await section.locator('[name="scope"]').selectOption(target);
  if (required !== undefined) await section.locator('[name="required"]').setChecked(required);
  if (until !== undefined) await section.locator('[name="until"]').fill(until);
  await click(page, `edit-${id}`, section); await page.waitForSelector('[data-preview="pending"]');
}
async function edit(page, id, value, options = {}) {
  await editPreview(page, id, value, options); await click(page, 'preview-apply');
  await wait(page, ({ id, value }) => String(window.synkDating.snapshot().view.discovery.fields.find(f => f.id === id).value) === value, { id, value });
}
async function revealCandidate(page, id) {
  if (await page.locator('[data-secondary-discovery]').count()) await opened(page, '다른 추천과 내 기준 살펴보기');
  const card = page.locator(`[data-candidate="${id}"]`); if (!await card.isVisible()) await opened(page, '다른 후보 살펴보기'); return card;
}
async function reflection(page) {
  await click(page, 'nav-discover');
  if (await page.locator('[data-secondary-discovery]').count()) await opened(page, '다른 추천과 내 기준 살펴보기');
  return opened(page, '추천이 내 방향에 맞았나요?');
}
async function recordRecommendation(page, response = 'partly') {
  let section = await reflection(page); await click(page, 'experience-start', section);
  section = await reflection(page); await section.locator('[name="intent-response"]').selectOption(response);
  await click(page, 'experience-respond', section);
  const record = (await snap(page)).view.experience.records.filter(record => record.kind === 'recommendation').at(-1);
  if (['partly', 'no'].includes(response)) assert.equal(await page.locator(`[data-experience="${record.id}"] [data-action="experience-correct"]`).isVisible(), true,
    'after saving a dissatisfied response the correction action is visible without reopening details');
  return record;
}
async function makeWorseFollowup(page, id, value) {
  const source = await recordRecommendation(page);
  let section = await reflection(page); await click(page, 'experience-correct', section);
  await edit(page, id, value); const next = await recordRecommendation(page, 'no');
  assert.equal(next.followup.sourceDecisionId, source.id);
  section = await reflection(page); await section.locator('[name="followup-response"]').selectOption('worse');
  await click(page, 'followup-save', section);
  assert.equal(await page.locator(`[data-followup="${next.id}"] [data-action="restore-preview"]`).isVisible(), true,
    'after saving worse the recovery action is visible without reopening details');
  return (await snap(page)).view.experience.records.find(record => record.id === next.id);
}
async function runQuestionValue(page) {
  const controls = await opened(page, '질문은 내 속도로');
  await controls.locator('[name="question-mode"]').selectOption('thorough'); await click(page, 'question-mode-save', controls);
  const before = await snap(page), question = before.view.discovery.question;
  assert.ok(question?.optional, 'synthetic choices leave a useful optional comparison question');
  assert.equal(question.valueBasis, 'declared-decision-value');
  await opened(page, '원할 때 질문 더 답하기');
  const explanation = page.locator('[data-question-value]');
  assert.equal(await explanation.innerText(), question.valueReason);
  assert.match(question.valueReason, /기준|비교/); assert.doesNotMatch(question.valueReason, /\d+\s*%|호감.*확률|궁합.*점수/);
  await shot(page, 'question-value-390'); await click(page, 'unknown');
  const after = await snap(page), answer = field(after, question.field);
  assert.equal(answer.value, null); assert.notEqual(answer.state, 'known');
  assert.equal(after.view.discovery.questionControl.usedToday, before.view.discovery.questionControl.usedToday + 1);
  report.paths.push('optional question explains declared decision value without probabilities; explicit unknown remains unknown and uses one question without fabricated preferences');
}
async function runWhatIf(page) {
  // Independently authored expectation: sample 3 is spontaneous, sample 2 is
  // explicitly hidden, and sample 1 is planned. Changing our day may restore
  // sample 1, but it must never relax the hard plan rule or the hide decision.
  await edit(page, 'wants.plan', 'planned', { required: true });
  await click(page, 'nav-discover');
  const hidden = await revealCandidate(page, 'demo:sample-2');
  const feedback = hidden.locator('details').filter({ has: page.locator('summary', { hasText: '이번 추천이 아쉬웠나요?' }) });
  await feedback.locator(':scope > summary').click(); await feedback.locator('[name="hide-days"]').selectOption('7');
  await click(page, 'hide-candidate', feedback);
  const priorExperience = await recordRecommendation(page);
  await edit(page, 'availability', 'weekday'); await click(page, 'nav-discover');
  const before = await snap(page), beforeFields = before.view.discovery.fields;
  assert.equal(before.view.discovery.candidates.filter(c => c.status === 'eligible').length, 0);
  const option = before.view.discovery.whatIf.options.find(item => item.value === 'weekend');
  assert.ok(option); assert.equal(option.field, 'availability'); assert.equal(option.result.eligibleCount, 1);
  const openPanel = async () => {
    const box = page.locator('[data-what-if="available"]');
    if (await box.evaluate(node => node.tagName === 'DETAILS' && !node.open)) await box.locator(':scope > summary').click();
    await box.locator('[name="what-if-option"]').selectOption(option.id); return box;
  };
  // The old response is still valid, but leaving its correction screen must
  // detach that intention. A normal discovery preview must not silently create
  // an experience correction link using a previously chosen source.
  const previousReflection = await reflection(page); await click(page, 'experience-correct', previousReflection);
  await click(page, 'nav-discover');
  const requestPromise = page.waitForRequest(request => request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/preview'));
  await click(page, 'what-if-preview', await openPanel()); const request = await requestPromise;
  assert.equal(Object.hasOwn(request.postDataJSON(), 'sourceDecisionId'), false, 'profile departure clears the earlier source from an ordinary discovery preview');
  assert.ok((await snap(page)).view.experience.records.find(r => r.id === priorExperience.id).responses.intent, 'the source remains valid, so this proves navigation detachment');
  await page.waitForSelector('[data-preview="pending"]');
  assert.deepEqual((await snap(page)).view.discovery.fields, beforeFields);
  await shot(page, 'empty-result-one-condition-preview-390');
  await click(page, 'preview-cancel'); assert.deepEqual((await snap(page)).view.discovery.fields, beforeFields);
  await click(page, 'what-if-preview', await openPanel()); await page.waitForSelector('[data-preview="pending"]');
  await click(page, 'preview-apply');
  const after = await snap(page);
  assert.deepEqual(after.view.discovery.candidates.filter(c => c.status === 'eligible').map(c => c.id), ['demo:sample-1']);
  assert.equal(field(after, 'wants.plan').required, true);
  assert.ok(after.view.discovery.snoozedCandidates.some(c => c.id === 'demo:sample-2'));
  assert.equal(field(after, 'availability').value, 'weekend');
  report.paths.push('empty recommendations: one explicit availability preview preserves fields until apply, keeps hard criteria and hidden candidates, restores only the eligible candidate, and does not inherit a correction source after leaving its profile screen');
  // Return to a known baseline for the meeting and correction examples.
  await edit(page, 'availability', 'weekend');
  await edit(page, 'wants.plan', 'planned', { required: false });
  await click(page, 'nav-profile'); const hiddenSettings = await opened(page, '숨긴 후보 관리');
  await click(page, 'unhide-candidate', hiddenSettings);
}
async function connectAndComplete(page) {
  await click(page, 'nav-profile'); const priorities = await opened(page, '나에게 더 중요한 기준');
  await priorities.locator('[name="priority-wants.plan"]').check(); await priorities.locator('[name="priority-scope"]').selectOption('baseline');
  await click(page, 'priority-preview', priorities); await page.waitForSelector('[data-preview="pending"]'); await click(page, 'preview-apply');
  assert.deepEqual((await snap(page)).view.discovery.priorities.effective, ['wants.plan']);
  await click(page, 'nav-discover'); const candidate = await revealCandidate(page, 'demo:sample-1'); await click(page, 'connect', candidate);
  const pairId = (await snap(page)).view.pairs.find(p => p.status === 'active').pairId;
  const partner = await pageFor('sample-1', 1280); await click(partner, 'nav-inbox'); await click(partner, 'intro-accept');
  await click(page, 'refresh');
  const form = page.locator('[data-new-schedule]');
  await form.locator('[name="startsAt"]').fill('2026-10-06T14:00');
  await form.locator('[name="durationMinutes"]').fill('60');
  await form.locator('[name="place"]').fill('합성 시험 카페'); await click(page, 'propose', form); await click(page, 'accept');
  await click(partner, 'refresh'); await click(partner, 'accept');
  time = Date.parse('2026-10-06T06:01:00.000Z');
  await click(page, 'refresh'); await click(page, 'complete');
  const pair = (await snap(page)).view.pairs.find(p => p.pairId === pairId), appointment = pair.view.appointments[0];
  assert.equal(appointment.status, 'partially-completed');
  assert.equal(appointment.people.find(p => p.id === 'demo:sample-1').completedAt, null);
  return { partner, pairId, appointmentId: appointment.id };
}
async function runCriterionReview(page, { partner, pairId, appointmentId }) {
  const review = () => page.locator(`[data-criterion-review="${appointmentId}"]`);
  const ownReview = snapshot => snapshot.view.pairs.find(p => p.pairId === pairId).criterionReviews.find(r => r.appointmentId === appointmentId);
  const openReview = async () => {
    const entry = page.locator(`[data-meeting-reflection="${appointmentId}"]`);
    if (!await entry.evaluate(node => node.open)) await entry.locator(':scope > summary').click();
    await entry.locator('[name="reflection-topic"]').selectOption('criterion');
    return review();
  };
  assert.deepEqual(ownReview(await snap(page)).criteria.map(c => c.field), ['wants.plan']);
  assert.equal(ownReview(await snap(page)).canRespond, true, 'own completion is enough; the other person has not completed');
  let section = await openReview(); await section.locator('[name="criterion-field"]').selectOption('wants.plan');
  await section.locator('[name="criterion-response"]').selectOption('less-important');
  const before = await snap(page); await click(page, 'criterion-save', section);
  const saved = await snap(page); assert.equal(ownReview(saved).response.value, 'less-important');
  assert.equal(field(saved, 'wants.plan').value, 'planned'); assert.deepEqual(saved.view.discovery.priorities.effective, before.view.discovery.priorities.effective);
  await click(partner, 'refresh');
  const peer = (await snap(partner)).view.pairs.find(p => p.pairId === pairId);
  assert.ok((peer.criterionReviews || []).every(item => item.response?.value !== 'less-important'));
  assert.equal(peer.view.appointments[0].people.find(p => p.id === 'demo:sample-1').completedAt, null);
  if (await page.locator('[data-action="preview-noted"]').count()) await click(page, 'preview-noted');
  await openReview();
  await shot(page, 'own-criterion-reflection-390');
  section = await openReview(); await click(page, 'criterion-preview', section); await page.waitForSelector('[data-preview="pending"]');
  assert.deepEqual((await snap(page)).view.discovery.priorities.effective, ['wants.plan']); await click(page, 'preview-cancel');
  section = await openReview(); await click(page, 'criterion-preview', section); await page.waitForSelector('[data-preview="pending"]');
  time += 6 * 60000; await click(page, 'preview-apply');
  assert.match(await page.locator('#notice').innerText(), /미리보기 시간이 끝|최신 상태/);
  assert.deepEqual((await snap(page)).view.discovery.priorities.effective, ['wants.plan']);
  await click(page, 'preview-cancel'); await click(page, 'refresh');
  section = await openReview(); await click(page, 'criterion-preview', section); await page.waitForSelector('[data-preview="pending"]');
  await shot(page, 'criterion-priority-preview-390'); await click(page, 'preview-apply');
  const applied = await snap(page); assert.deepEqual(applied.view.discovery.priorities.effective, []);
  assert.deepEqual(applied.view.discovery.priorities.baseline, ['wants.plan']);
  assert.equal(field(applied, 'wants.plan').value, 'planned'); assert.equal(field(applied, 'wants.plan').required, false);
  await edit(page, 'wants.plan', 'spontaneous'); await click(page, 'nav-inbox');
  assert.equal(ownReview(await snap(page)).canPreview, false, 'a later declaration cannot be changed using an earlier reflection');
  assert.equal(field(await snap(page), 'wants.plan').value, 'spontaneous');
  report.paths.push('own completed meeting enables one private source-bound criterion review; peer completion is independent; response and cancel preserve preferences; expired preview is rejected; explicit apply changes only context priority; a later declaration blocks reuse');
  await edit(page, 'wants.plan', 'planned');
}
async function runCorrectionRestore(page, partner) {
  await edit(page, 'wants.pace', 'lead');
  const record = await makeWorseFollowup(page, 'wants.plan', 'spontaneous');
  assert.equal(record.followup.canRestore, true);
  await edit(page, 'self.contact', 'daily');
  let section = await reflection(page), followup = section.locator(`[data-followup="${record.id}"]`);
  await click(page, 'restore-preview', followup); await page.waitForSelector('[data-preview="pending"]');
  assert.equal(field(await snap(page), 'wants.plan').value, 'spontaneous');
  await shot(page, 'worse-source-restore-preview-390'); await click(page, 'preview-cancel');
  assert.equal(field(await snap(page), 'wants.plan').value, 'spontaneous');
  section = await reflection(page); followup = section.locator(`[data-followup="${record.id}"]`);
  await click(page, 'restore-preview', followup); await page.waitForSelector('[data-preview="pending"]'); await click(page, 'preview-apply');
  assert.equal(field(await snap(page), 'wants.plan').value, 'planned');
  assert.equal(field(await snap(page), 'self.contact').value, 'daily', 'unrelated later edits survive source-bound restoration');
  const second = await makeWorseFollowup(page, 'wants.plan', 'spontaneous');
  await edit(page, 'wants.plan', 'any'); section = await reflection(page);
  const stale = (await snap(page)).view.experience.records.find(r => r.id === second.id);
  assert.equal(stale.followup.canRestore, false); assert.equal(await section.locator(`[data-followup="${second.id}"] [data-action="restore-preview"]`).count(), 0);
  assert.equal(field(await snap(page), 'wants.plan').value, 'any');
  await click(partner, 'refresh');
  assert.ok((await snap(partner)).view.experience.records.every(r => r.responses.followup?.value !== 'worse'));
  report.paths.push('worse followup offers a source-bound restore preview, cancel keeps the edit, apply restores only that field and preserves unrelated later answers; a later edit of the same field disables restoration and peer sees no private followup');
}

try {
  await fs.mkdir(out, { recursive: true });
  server = createDatingServer({ databasePath: path.join(tmp, 'demo.sqlite'), clock: () => new Date(time) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const a = await pageFor('adult-a', 390); await onboard(a, '가상 학습 확인');
  await runQuestionValue(a); await runWhatIf(a);
  const meeting = await connectAndComplete(a); await runCriterionReview(a, meeting);
  await runCorrectionRestore(a, meeting.partner);
  await a.setViewportSize({ width: 320, height: 950 }); await shot(a, 'final-private-recovery-320');
  await shot(meeting.partner, 'peer-private-isolation-1280');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.externalRequests, []); report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack; throw error;
} finally {
  await fs.mkdir(out, { recursive: true }); await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); console.log(JSON.stringify(report, null, 2));
}
