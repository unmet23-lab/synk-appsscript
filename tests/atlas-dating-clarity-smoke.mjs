// Free synthetic browser proof. Only explicit UI actions mutate an isolated local database.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const out = fileURLToPath(new URL('../experiences/atlas-lab/qa/dating-clarity/', import.meta.url));
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-dating-clarity-'));
const report = { at: new Date().toISOString(), status: 'running', kind: 'synthetic-dating-clarity-browser', modelCalls: 0, externalApiCost: 0, actualUsers: 0, paths: [], errors: [], externalRequests: [], screenshots: [] };
let server, browser, origin, time = Date.parse('2026-10-06T03:00:00.000Z');
const snap = page => page.evaluate(() => window.synkDating.snapshot());
const idle = page => page.waitForFunction(() => !document.getElementById('content').hasAttribute('aria-busy'));
const field = (snapshot, id) => snapshot.view.discovery.fields.find(item => item.id === id);
async function click(page, action, scope = page) { await scope.locator(`[data-action="${action}"]`).click(); await idle(page); }
async function wait(page, fn, arg) { await page.waitForFunction(fn, arg); await idle(page); }
async function opened(page, title) {
  const summary = page.locator('summary').filter({ hasText: title }).last(), details = summary.locator('..');
  if (!await details.evaluate(node => node.open)) await summary.click(); return details;
}
async function reveal(locator) { if (await locator.evaluate(node => node.tagName === 'DETAILS' && !node.open)) await locator.locator(':scope > summary').click(); return locator; }
async function pageFor(role, width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 950 }, timezoneId: 'Asia/Seoul', serviceWorkers: 'block' });
  await context.route('**/*', route => { const url = new URL(route.request().url()); if (url.origin !== origin) { report.externalRequests.push(url.href); return route.abort(); } return route.continue(); });
  const page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(`${origin}/atlas-lab/dating.html?demo=${role}`); await wait(page, () => !!window.synkDating?.snapshot().view); return page;
}
async function reload(page) { await page.reload(); await wait(page, () => !!window.synkDating?.snapshot().view); }
async function shot(page, name, locator = page) {
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: horizontal overflow`);
  assert.deepEqual(await page.locator('img').evaluateAll(images => images.filter(image => !image.complete || !image.naturalWidth).map(image => image.src)), [], `${name}: missing images`);
  await locator.screenshot({ path: path.join(out, `${name}.png`), ...(locator === page ? { fullPage: true } : {}) }); report.screenshots.push(`${name}.png`);
}
async function onboard(page) {
  await page.locator('[name="nickname"]').fill('가상 간결함 확인');
  for (const name of ['adult', 'public', 'invites', 'save']) await page.locator(`[name="${name}"]`).check();
  await click(page, 'onboard');
  for (let i = 0; i < 18; i++) {
    const q = (await snap(page)).view.discovery.question; if (!q || q.optional) break;
    const values = { consent: 'true', availability: 'weekend', 'self.pace': 'listen', 'self.plan': 'planned' };
    await click(page, `answer-${values[q.field] || q.options[0].id}`);
  }
  assert.equal((await snap(page)).view.discovery.status, 'ready');
}
async function edit(page, id, value, { target = 'baseline', required, until } = {}) {
  await click(page, 'nav-profile'); const section = await reveal(page.locator(`[data-preference-field="${id}"]`));
  await section.locator('[name="value"]').selectOption(value); await section.locator('[name="scope"]').selectOption(target);
  if (required !== undefined) await section.locator('[name="required"]').setChecked(required);
  if (until !== undefined) await section.locator('[name="until"]').fill(until);
  await click(page, `edit-${id}`, section); await page.waitForSelector('[data-preview="pending"]'); await click(page, 'preview-apply');
  assert.equal(String(field(await snap(page), id).value), value);
}
async function setPriority(page, id) {
  await click(page, 'nav-profile'); const section = await opened(page, '나에게 더 중요한 기준');
  await section.locator(`[name="priority-${id}"]`).check(); await section.locator('[name="priority-scope"]').selectOption('baseline');
  await click(page, 'priority-preview', section); await page.waitForSelector('[data-preview="pending"]'); await click(page, 'preview-apply');
}
async function candidate(page, id) {
  if (await page.locator('[data-secondary-discovery]').count()) await reveal(page.locator('[data-secondary-discovery]'));
  const card = page.locator(`[data-candidate="${id}"]`); if (!await card.isVisible()) await opened(page, '다른 후보 살펴보기'); return card;
}
async function recordDisplayedRecommendation(page) {
  await click(page, 'nav-discover');
  if (await page.locator('[data-secondary-discovery]').count()) await reveal(page.locator('[data-secondary-discovery]'));
  const section = await opened(page, '추천이 내 방향에 맞았나요?'); await click(page, 'experience-start', section);
}

async function summaryPath(page) {
  await edit(page, 'wants.plan', 'planned', { required: true });
  await edit(page, 'wants.contact', 'daily'); await setPriority(page, 'wants.contact');
  await edit(page, 'wants.pace', 'listen', { target: 'context', until: '2026-10-06T12:30' });
  await click(page, 'nav-profile'); const summary = await reveal(page.locator('[data-preference-summary]'));
  for (const group of ['required', 'priorities', 'context', 'unknown']) assert.equal(await summary.locator(`[data-summary-group="${group}"]`).count(), 1);
  const before = await snap(page);
  assert.match(await summary.locator('[data-summary-group="required"]').innerText(), /약속/);
  assert.match(await summary.locator('[data-summary-group="priorities"]').innerText(), /연락/);
  assert.match(await summary.locator('[data-summary-group="context"]').innerText(), /대화/);
  assert.ok((await summary.locator('[data-summary-group="unknown"]').innerText()).length > 0);
  await shot(page, 'current-preference-summary-390');
  await click(page, 'summary-edit-wants.pace', summary);
  const target = page.locator('[data-preference-field="wants.pace"]'); assert.equal(await target.evaluate(node => node.open), true);
  assert.equal(await target.locator('[name="value"]').inputValue(), 'listen');
  assert.equal((await snap(page)).view.revision, before.view.revision, 'opening the exact source answer does not change a preference');
  report.paths.push('four-group current preference summary separates hard criteria, priorities, temporary choices and unknowns; correction opens its exact field without a mutation');
}
async function recommendationChangesPath(page) {
  await recordDisplayedRecommendation(page); time = Date.parse('2026-10-06T03:30:00.000Z'); await reload(page);
  let current = await snap(page);
  assert.ok(current.view.discovery.repetition.reasons.some(reason => reason.kind === 'answer-expired' && reason.field === 'wants.pace'));
  const changes = page.locator('[data-recommendation-changes]'); await reveal(changes); assert.match(await changes.innerText(), /기한|만료/);
  await shot(page, 'recommendation-expiry-reason-390');
  await edit(page, 'wants.contact', 'few-days'); await click(page, 'nav-discover'); current = await snap(page);
  assert.ok(current.view.discovery.repetition.reasons.some(reason => reason.kind === 'answers-changed'));
  const other = await pageFor('sample-3', 1280); await click(other, 'nav-settings'); await other.locator('[name="public"]').uncheck(); await click(other, 'consents');
  await reload(page); const reasons = (await snap(page)).view.discovery.repetition.reasons;
  assert.ok(reasons.some(reason => reason.kind === 'public-candidates-changed'));
  assert.doesNotMatch(JSON.stringify(reasons), /demo:sample-3|가상 예시 도윤/);
  await reveal(page.locator('[data-recommendation-changes]')); await shot(page, 'recommendation-known-changes-390');
  await other.context().close();
  report.paths.push('revisit explains a known answer expiry, own explicit edit and public-pool change without resurrecting a withdrawn candidate identity or inferring attraction');
  await edit(page, 'wants.plan', 'planned', { required: false });
}
async function reschedulePath(page) {
  await click(page, 'nav-discover'); await click(page, 'connect', await candidate(page, 'demo:sample-1'));
  const pairId = (await snap(page)).view.pairs.find(pair => pair.status === 'active').pairId;
  const partner = await pageFor('sample-1', 1280); await click(partner, 'nav-inbox'); await click(partner, 'intro-accept'); await click(page, 'refresh');
  const form = page.locator('[data-new-schedule]');
  await form.locator('[name="startsAt"]').fill('2026-10-06T13:00'); await form.locator('[name="durationMinutes"]').fill('45');
  await form.locator('[name="place"]').fill('직접 정한 가상 카페'); await form.locator('[name="note"]').fill('첫 제안에만 적은 말');
  await click(page, 'propose', form); await click(page, 'accept'); await click(partner, 'refresh'); await click(partner, 'busy');
  let draft = partner.locator('[data-new-schedule]');
  for (const name of ['startsAt', 'endsAt', 'durationMinutes', 'place', 'note']) assert.equal(await draft.locator(`[name="${name}"]`).inputValue(), '', `${name} is not reused before the explicit action`);
  const before = await snap(partner); await click(partner, 'reschedule-reuse'); draft = partner.locator('[data-new-schedule]');
  assert.equal(await draft.locator('[name="place"]').inputValue(), '직접 정한 가상 카페'); assert.equal(await draft.locator('[name="durationMinutes"]').inputValue(), '45');
  for (const name of ['startsAt', 'endsAt', 'note']) assert.equal(await draft.locator(`[name="${name}"]`).inputValue(), '');
  assert.equal((await snap(partner)).view.revision, before.view.revision, 'reusing public schedule fields creates an unsent draft only');
  await shot(partner, 'explicit-reschedule-draft-1280');
  await draft.locator('[name="startsAt"]').fill('2026-10-06T13:30'); await draft.locator('[name="durationMinutes"]').fill('30'); await draft.locator('[name="place"]').fill('내가 수정한 가상 장소');
  await click(partner, 'propose', draft);
  const newAppointment = (await snap(partner)).view.pairs.find(pair => pair.pairId === pairId).view.appointments.at(-1);
  assert.ok(newAppointment.people.every(person => person.response === 'unanswered'));
  assert.equal(newAppointment.proposal.schedule.note, ''); assert.equal(newAppointment.proposal.schedule.place, '내가 수정한 가상 장소');
  await click(partner, 'accept'); await click(page, 'refresh'); await click(page, 'accept');
  report.paths.push('busy closes only the old schedule; explicit reuse copies public place and duration to an unsent editable draft with blank dates and note; the new proposal has no inherited acceptance');
  time = Date.parse('2026-10-06T05:01:00.000Z'); await click(page, 'refresh'); await click(page, 'complete');
  return { partner, pairId, appointmentId: newAppointment.id };
}
async function reflectionPath(page, { partner, pairId, appointmentId }) {
  const reflection = () => page.locator(`[data-meeting-reflection="${appointmentId}"]`);
  const own = snapshot => snapshot.view.pairs.find(pair => pair.pairId === pairId);
  const selectTopic = async value => { const section = await reveal(reflection()); await section.locator('[name="reflection-topic"]').selectOption(value); return reflection(); };
  let section = await reveal(reflection());
  assert.equal(await section.locator('[name="reflection-topic"]').inputValue(), '');
  for (const action of ['reflect', 'comfort-save', 'criterion-save']) assert.equal(await section.locator(`[data-action="${action}"]`).isVisible(), false);
  const before = await snap(page); section = await selectTopic('format');
  assert.equal((await snap(page)).view.revision, before.view.revision); assert.equal(await section.locator('[data-action="comfort-save"]').isVisible(), false); assert.equal(await section.locator('[data-action="criterion-save"]').isVisible(), false);
  await section.locator('[name="reflection"]').selectOption('too-long'); await section.locator('[name="reflection-note"]').fill('가상 본인만 볼 회고');
  await click(page, 'reflect', section); let current = await snap(page);
  assert.equal(own(current).view.me.reflections.length, 1); assert.equal(own(current).view.me.reflections[0].value, 'too-long');
  assert.deepEqual(current.view.experience.records, before.view.experience.records); assert.equal(own(current).criterionReviews.find(r => r.appointmentId === appointmentId).response, null);
  assert.equal(await reflection().locator('[name="reflection-topic"]').inputValue(), 'format');
  await click(page, 'reflection-more', reflection()); assert.equal(await reflection().locator('[name="reflection-topic"]').inputValue(), '');
  section = await selectTopic('comfort'); await section.locator('[name="comfort-response"]').selectOption('mixed'); await click(page, 'comfort-save', section);
  current = await snap(page); assert.equal(current.view.experience.records.filter(r => r.responses.comfort?.value === 'mixed').length, 1); assert.equal(own(current).view.me.reflections[0].value, 'too-long');
  section = await selectTopic('criterion'); await reveal(section.locator('[data-criterion-review]'));
  await section.locator('[name="criterion-field"]').selectOption('wants.contact'); await section.locator('[name="criterion-response"]').selectOption('helped'); await click(page, 'criterion-save', section);
  current = await snap(page); assert.equal(own(current).criterionReviews.find(r => r.appointmentId === appointmentId).response.value, 'helped');
  assert.equal(current.view.experience.records.filter(r => r.responses.comfort?.value === 'mixed').length, 1); assert.equal(own(current).view.me.reflections[0].value, 'too-long');
  await click(partner, 'refresh'); const other = await snap(partner);
  assert.doesNotMatch(JSON.stringify(other.view), /가상 본인만 볼 회고/); assert.equal(own(other).view.me.reflections.length, 0);
  assert.ok(own(other).criterionReviews.every(r => !r.response)); assert.ok(!other.view.experience.records.some(r => r.responses.comfort));
  section = await selectTopic('criterion'); await reveal(section.locator('[data-criterion-review]')); await shot(page, 'one-reflection-at-a-time-390');
  await page.setViewportSize({ width: 320, height: 950 }); await shot(page, 'one-reflection-at-a-time-320');
  report.paths.push('one meeting reflection entry reveals only the explicitly selected topic; topic choice writes nothing and each save changes only its own record; extra topics stay optional and all private responses remain hidden from the other role');
}

try {
  await fs.mkdir(out, { recursive: true }); server = createDatingServer({ databasePath: path.join(tmp, 'demo.sqlite'), clock: () => new Date(time) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true }); const a = await pageFor('adult-a'); await onboard(a);
  await summaryPath(a); await recommendationChangesPath(a); const meeting = await reschedulePath(a); await reflectionPath(a, meeting);
  assert.deepEqual(report.errors, []); assert.deepEqual(report.externalRequests, []); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; throw error; }
finally { await fs.mkdir(out, { recursive: true }); await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); console.log(JSON.stringify(report, null, 2)); }
