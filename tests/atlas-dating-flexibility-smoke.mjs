// Free UI-only actions in an isolated synthetic database; no real participants.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const out = fileURLToPath(new URL('../experiences/atlas-lab/qa/dating-flexibility/', import.meta.url));
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-dating-flexibility-'));
const report = { at: new Date().toISOString(), status: 'running', kind: 'synthetic-dating-flexibility-browser', modelCalls: 0, externalApiCost: 0, actualUsers: 0, paths: [], errors: [], externalRequests: [], screenshots: [] };
let server, browser, origin, time = Date.parse('2026-10-07T03:00:00.000Z');
const snap = page => page.evaluate(() => window.synkDating.snapshot());
const idle = page => page.waitForFunction(() => !document.getElementById('content').hasAttribute('aria-busy'));
async function click(page, action, scope = page) { await scope.locator(`[data-action="${action}"]`).click(); await idle(page); }
async function reveal(locator) { if (!await locator.evaluate(node => node.open)) await locator.locator(':scope > summary').click(); return locator; }
async function pageFor(role, width) {
  const context = await browser.newContext({ viewport: { width, height: 950 }, timezoneId: 'Asia/Seoul', serviceWorkers: 'block' });
  await context.route('**/*', route => { const url = new URL(route.request().url()); if (url.origin !== origin) { report.externalRequests.push(url.href); return route.abort(); } return route.continue(); });
  const page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(`${origin}/atlas-lab/dating.html?demo=${role}`);
  await page.waitForFunction(() => !!window.synkDating?.snapshot().view); await idle(page); return page;
}
async function shot(page, name, locator = page) {
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: horizontal overflow`);
  assert.deepEqual(await page.locator('img').evaluateAll(images => images.filter(i => !i.complete || !i.naturalWidth).map(i => i.src)), []);
  await locator.screenshot({ path: path.join(out, `${name}.png`), ...(locator === page ? { fullPage: true } : {}) }); report.screenshots.push(`${name}.png`);
}
async function disclosure(page, value) {
  await click(page, 'nav-profile');
  const section = page.locator('details').filter({ has: page.locator(':scope > summary', { hasText: '상대에게 보여줄 답 정하기' }) });
  await reveal(section); await section.locator('[name="public-self.plan"]').selectOption(value); await click(page, 'save-disclosure', section);
  await click(page, 'nav-inbox');
}
async function privateContact(page, value, { target = 'baseline', required = false, until } = {}) {
  await click(page, 'nav-profile'); const section = await reveal(page.locator('[data-preference-field="wants.contact"]'));
  await section.locator('[name="value"]').selectOption(value); await section.locator('[name="scope"]').selectOption(target);
  if (target === 'baseline') await section.locator('[name="required"]').setChecked(required);
  if (until !== undefined) await section.locator('[name="until"]').fill(until);
  await click(page, 'edit-wants.contact', section); await page.waitForSelector('[data-preview="pending"]'); await click(page, 'preview-apply');
}
async function publicContact(page, value, notice) {
  await click(page, 'nav-profile');
  const section = page.locator('details').filter({ has: page.locator(':scope > summary', { hasText: '상대에게 보여줄 답 정하기' }) });
  await reveal(section); await section.locator('[name="public-self.contact"]').selectOption(value); await section.locator('[name="public-self.notice"]').selectOption(notice);
  await click(page, 'save-disclosure', section);
}
async function conditionSection(page) {
  await click(page, 'nav-profile'); await reveal(page.locator('[data-preference-field="wants.contact"]'));
  return reveal(page.locator('[data-conditional-preference]'));
}
async function refreshDiscovery(page) { await click(page, 'nav-inbox'); await click(page, 'refresh'); await click(page, 'nav-discover'); }
async function conditionalPaths(a, b) {
  await privateContact(a, 'daily'); await publicContact(b, 'few-days', 'advance');
  const own = (await snap(a)).view.profile, candidate = snapshot => snapshot.view.discovery.candidates.find(c => c.id === 'demo:sample-3');
  const reason = snapshot => candidate(snapshot).reasonDetails.find(r => r.field === 'wants.contact' && r.owner === 'self');
  await refreshDiscovery(a); assert.equal(reason(await snap(a)).comparison, 'different');
  let section = await conditionSection(a); await section.locator('[name="conditional-scope"]').selectOption('baseline');
  const before = await snap(a); await click(a, 'conditional-preview', section);
  assert.equal((await snap(a)).view.revision, before.view.revision); assert.match(await a.locator('[data-preview-changes]').innerText(), /条件|조건/);
  await click(a, 'preview-cancel'); assert.equal((await snap(a)).view.discovery.conditionalPreference.effective.status, 'none');
  section = await conditionSection(a); await section.locator('[name="conditional-scope"]').selectOption('baseline'); await click(a, 'conditional-preview', section); await click(a, 'preview-apply');
  let current = await snap(a); assert.equal(current.view.discovery.conditionalPreference.effective.status, 'active');
  assert.equal(current.view.discovery.fields.find(f => f.id === 'wants.contact').value, 'daily'); assert.deepEqual(current.view.profile, own);
  assert.equal(reason(current).comparison, 'conditional'); assert.equal(reason(current).conditionStatus, 'satisfied');
  assert.match(await a.locator('[data-summary-conditional]').innerText(), /허용|간격/);
  section = await conditionSection(a); await a.setViewportSize({ width: 390, height: 950 }); await shot(a, 'explicit-conditional-preference-390', section);
  await publicContact(b, 'few-days', ''); await refreshDiscovery(a);
  current = await snap(a); assert.equal(reason(current).comparison, 'different'); assert.equal(reason(current).conditionStatus, 'unknown');
  await publicContact(b, 'few-days', 'when-free'); await refreshDiscovery(a); assert.equal(reason(await snap(a)).conditionStatus, 'different');
  await publicContact(b, 'few-days', 'advance'); await refreshDiscovery(a); assert.equal(reason(await snap(a)).comparison, 'conditional');
  report.paths.push('conditional preference uses preview and explicit apply; primary and public answers stay unchanged; only a currently public qualifying notice permits the alternative');

  await privateContact(a, 'daily', { required: true }); current = await snap(a);
  assert.notEqual(current.view.discovery.conditionalPreference.effective.status, 'active'); assert.equal(candidate(current).status, 'excluded');
  section = await conditionSection(a); assert.equal(await section.locator('[data-action="conditional-preview"]').count(), 0); assert.match(await section.innerText(), /필수조건/);
  await privateContact(a, 'daily'); assert.notEqual((await snap(a)).view.discovery.conditionalPreference.effective.status, 'active');
  report.paths.push('making the primary criterion required excludes the alternative; removing that requirement does not resurrect an older allowance');

  section = await conditionSection(a); await section.locator('[name="conditional-scope"]').selectOption('context'); await section.locator('[name="conditional-until"]').fill('2026-10-07T13:10');
  await click(a, 'conditional-preview', section); await click(a, 'preview-apply');
  assert.equal((await snap(a)).view.discovery.conditionalPreference.effective.status, 'active');
  time = Date.parse('2026-10-07T04:11:00.000Z'); await refreshDiscovery(a);
  current = await snap(a); assert.notEqual(current.view.discovery.conditionalPreference.effective.status, 'active'); assert.equal(reason(current).comparison, 'different');
  report.paths.push('an explicitly limited temporary allowance expires without changing the original daily preference or reviving an older rule');
}
try {
  await fs.mkdir(out, { recursive: true });
  server = createDatingServer({ databasePath: path.join(tmp, 'demo.sqlite'), clock: () => new Date(time) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const a = await pageFor('sample-1', 390), b = await pageFor('sample-3', 1280);
  for (let i = 0; i < 18; i++) {
    const q = (await snap(a)).view.discovery.question; if (!q || q.optional) break;
    const answers = { consent: 'true', availability: 'weekend', 'self.pace': 'lead', 'self.plan': 'planned' };
    await click(a, `answer-${answers[q.field] || q.options[0].id}`);
  }
  const candidate = a.locator('[data-candidate="demo:sample-3"]');
  if (!await candidate.isVisible()) await reveal(a.locator('[data-other-candidates]'));
  await click(a, 'connect', candidate); assert.equal(await a.locator('[data-alignment]').count(), 0);
  await click(b, 'nav-inbox'); await click(b, 'refresh'); await click(b, 'intro-accept'); await click(a, 'refresh');
  const pairId = (await snap(a)).view.pairs[0].pairId;
  const pair = snapshot => snapshot.view.pairs.find(p => p.pairId === pairId);
  const alignment = page => page.locator(`[data-pair="${pairId}"] [data-alignment]`);
  const initial = await snap(a); assert.equal(pair(initial).alignment.status, 'optional');
  assert.equal(await alignment(a).evaluate(node => node.open), false);
  await reveal(alignment(a)); assert.equal((await snap(a)).view.revision, initial.view.revision);
  assert.match(await alignment(a).innerText(), /아직 답하지 않았어요/);
  await shot(a, 'optional-public-difference-390', alignment(a));
  report.paths.push('only a mutually accepted introduction offers one optional question from different public answers; opening it records no response');

  const preparedForm = a.locator('[data-new-schedule]');
  await preparedForm.locator('[name="startsAt"]').fill('2026-10-07T13:20'); await preparedForm.locator('[name="durationMinutes"]').fill('30');
  await preparedForm.locator('[name="place"]').fill('전송하지 않은 가상 초안'); await preparedForm.locator('[name="note"]').fill('내가 작성 중인 메모');
  await click(a, 'alignment-yes', alignment(a));
  assert.equal(await a.locator('[data-new-schedule] [name="place"]').inputValue(), '전송하지 않은 가상 초안');
  assert.equal(await a.locator('[data-new-schedule] [name="note"]').inputValue(), '내가 작성 중인 메모');
  await a.locator('[data-new-schedule] [name="startsAt"]').fill('2026-10-07T14:00');
  assert.equal(await a.locator('[data-new-schedule] [name="endsAt"]').inputValue(), '2026-10-07T14:30', 'coordination response preserves automatic end-time calculation');
  assert.equal(pair(await snap(a)).view.appointments.length, 0);
  await click(b, 'refresh');
  assert.equal(pair(await snap(b)).alignment.status, 'waiting'); assert.equal(pair(await snap(b)).alignment.me.value, null);
  await click(b, 'alignment-different', alignment(b)); await click(a, 'refresh');
  assert.equal(pair(await snap(a)).alignment.status, 'different'); assert.match(await alignment(a).innerText(), /아직 합의하지 않았어요/);
  await click(a, 'nav-inbox'); await shot(a, 'different-is-not-agreement-390', alignment(a));
  await click(b, 'alignment-yes', alignment(b)); await click(a, 'refresh');
  assert.equal(pair(await snap(a)).alignment.status, 'agreed'); assert.equal(pair(await snap(a)).view.appointments.length, 0);
  const stableExperience = ({ recommendationToken, ...rest }) => rest;
  assert.deepEqual(stableExperience((await snap(a)).view.experience), stableExperience(initial.view.experience));
  await click(b, 'nav-inbox'); await shot(b, 'two-explicit-answers-1280', alignment(b));
  await click(a, 'nav-inbox'); await a.setViewportSize({ width: 320, height: 950 }); await shot(a, 'two-explicit-answers-320', alignment(a));
  await click(a, 'alignment-withdraw', alignment(a)); assert.equal(pair(await snap(a)).alignment.me.value, null);
  assert.equal(pair(await snap(a)).alignment.status, 'waiting');
  report.paths.push('unanswered and different remain unagreed; only two explicit yes answers agree; own withdrawal clears agreement and no preference or appointment is inferred');

  await click(a, 'alignment-different', alignment(a));
  const alternatives = alignment(a).locator('[data-alignment-alternatives]');
  assert.equal(await alternatives.evaluate(node => node.open), true);
  const beforeOption = await snap(a); await alternatives.locator('[name="alignment-option"]').selectOption('full-plan');
  assert.equal((await snap(a)).view.revision, beforeOption.view.revision, 'selecting a draft alternative sends nothing');
  await click(a, 'alignment-propose-option', alternatives);
  let next = pair(await snap(a)).alignment;
  assert.equal(next.selectedOptionId, 'full-plan'); assert.equal(next.proposalVersion, 1);
  assert.equal(next.me.value, null); assert.equal(next.partner.value, null);
  assert.notEqual(next.key, pair(beforeOption).alignment.key);
  await click(b, 'refresh'); assert.match(await alignment(b).innerText(), /상대가 새로 제안/);
  await click(b, 'alignment-yes', alignment(b)); await click(a, 'refresh');
  assert.equal(pair(await snap(a)).alignment.status, 'waiting');
  await click(a, 'alignment-yes', alignment(a)); await click(a, 'nav-inbox');
  assert.equal(pair(await snap(a)).alignment.status, 'agreed');
  await shot(a, 'new-option-two-new-answers-320', alignment(a));
  await click(b, 'refresh'); await reveal(alignment(b).locator('[data-alignment-alternatives]'));
  await alignment(b).locator('[name="alignment-option"]').selectOption('on-day');
  await click(b, 'alignment-propose-option', alignment(b)); await click(a, 'refresh');
  assert.equal(pair(await snap(a)).alignment.selectedOptionId, 'on-day');
  assert.equal(await alignment(a).locator('[data-action="alignment-cancel-option"]').count(), 0);
  await click(b, 'alignment-cancel-option', alignment(b)); await click(a, 'refresh');
  next = pair(await snap(a)).alignment; assert.equal(next.selectedOptionId, 'baseline');
  assert.equal(next.me.value, null); assert.equal(next.partner.value, null); assert.equal(next.proposalVersion, 3);
  assert.notEqual(next.key, pair(initial).alignment.key);
  report.paths.push('explicit alternative submission clears both answers; each person must confirm the new option; another proposal and cancellation cannot revive old agreement');

  const form = await reveal(a.locator('[data-new-schedule]'));
  await form.locator('[name="startsAt"]').fill('2026-10-07T13:00'); await form.locator('[name="durationMinutes"]').fill('30');
  await form.locator('[name="place"]').fill('가상 만남 장소'); await click(a, 'propose', form);
  let meeting = pair(await snap(a)).view.appointments.at(-1);
  assert.equal(meeting.status, 'pending'); assert.ok(meeting.people.every(person => person.response === 'unanswered'));
  await click(a, 'accept'); await click(b, 'refresh'); await click(b, 'accept'); await click(a, 'refresh');
  assert.equal(pair(await snap(a)).view.appointments.at(-1).status, 'confirmed');
  await click(a, 'alignment-yes', alignment(a));
  report.paths.push('scheduling works while alignment is unanswered and still requires each independent appointment acceptance');

  await disclosure(b, 'planned'); await click(a, 'refresh'); assert.equal(await alignment(a).count(), 0);
  await disclosure(b, 'spontaneous'); await click(a, 'refresh');
  const reset = pair(await snap(a)).alignment;
  assert.equal(reset.status, 'optional'); assert.equal(reset.me.value, null); assert.equal(reset.partner.value, null);
  assert.notEqual(reset.key, pair(initial).alignment.key);
  assert.equal(pair(await snap(a)).view.appointments.at(-1).status, 'confirmed');
  await reveal(alignment(a)); await shot(a, 'public-change-clears-old-agreement-320', alignment(a));
  report.paths.push('changing public evidence and changing it back never revives old agreement or changes an already confirmed appointment');

  time = Date.parse('2026-10-07T04:01:00.000Z'); await click(a, 'refresh');
  assert.equal(await alignment(a).count(), 0);
  report.paths.push('after the first confirmed meeting starts, its preparation answer cannot be reused for another meeting');

  await conditionalPaths(a, b);

  const guide = await browser.newPage({ viewport: { width: 390, height: 950 } });
  await guide.route('**/*', route => { const url = new URL(route.request().url()); if (url.origin !== origin) { report.externalRequests.push(url.href); return route.abort(); } return route.continue(); });
  guide.on('pageerror', error => report.errors.push(error.message));
  await guide.goto(`${origin}/atlas-lab/usability.html`); assert.equal((await guide.title()).includes('사용성'), true);
  await shot(guide, 'free-usability-guide-390'); await guide.setViewportSize({ width: 794, height: 1123 }); await guide.emulateMedia({ media: 'print' });
  await shot(guide, 'free-usability-guide-print', guide.locator('.observation').first());
  report.paths.push('the local facilitator guide opens at mobile width and produces a printable blank observation sheet without external requests');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.externalRequests, []); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; throw error; }
finally {
  await fs.mkdir(out, { recursive: true }); await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); console.log(JSON.stringify(report, null, 2));
}
