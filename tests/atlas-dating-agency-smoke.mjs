// Explicit UI actions against isolated synthetic accounts. No real participants or AI.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const out = fileURLToPath(new URL('../experiences/atlas-lab/qa/dating-agency/', import.meta.url));
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-dating-agency-'));
const report = { at: new Date().toISOString(), status: 'running', kind: 'synthetic-dating-agency-browser', modelCalls: 0, externalApiCost: 0, actualUsers: 0, paths: [], errors: [], externalRequests: [], screenshots: [] };
let server, browser, origin, time = Date.parse('2026-10-07T03:00:00.000Z');
const snap = page => page.evaluate(() => window.synkDating.snapshot());
const idle = page => page.waitForFunction(() => !document.getElementById('content').hasAttribute('aria-busy'));
const ownField = (s, id) => s.view.discovery.fields.find(f => f.id === id);
const record = (s, id) => s.view.experience.records.find(r => r.id === id);
async function click(page, action, scope = page) { await scope.locator(`[data-action="${action}"]`).click(); await idle(page); }
async function reveal(locator) { if (await locator.evaluate(n => n.tagName === 'DETAILS' && !n.open)) await locator.locator(':scope > summary').click(); return locator; }
async function namedDetails(page, title) { return reveal(page.locator('summary').filter({ hasText: title }).last().locator('..')); }
async function pageFor(role, width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 950 }, timezoneId: 'Asia/Seoul', serviceWorkers: 'block' });
  await context.route('**/*', route => { const url = new URL(route.request().url()); if (url.origin !== origin) { report.externalRequests.push(url.href); return route.abort(); } return route.continue(); });
  const page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(`${origin}/atlas-lab/dating.html?demo=${role}`); await page.waitForFunction(() => !!window.synkDating?.snapshot().view); await idle(page); return page;
}
async function shot(page, name, locator = page) {
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: horizontal overflow`);
  assert.deepEqual(await page.locator('img').evaluateAll(images => images.filter(i => !i.complete || !i.naturalWidth).map(i => i.src)), []);
  await locator.screenshot({ path: path.join(out, `${name}.png`), ...(locator === page ? { fullPage: true } : {}) }); report.screenshots.push(`${name}.png`);
}
async function prepare(page, blank = false) {
  if (blank) {
    await page.locator('[name="nickname"]').fill('가상 주도권 확인');
    for (const name of ['adult', 'public', 'invites', 'save']) await page.locator(`[name="${name}"]`).check();
    await click(page, 'onboard');
  }
  for (let i = 0; i < 18; i++) {
    const q = (await snap(page)).view.discovery.question; if (!q || q.optional) break;
    const values = { consent: 'true', availability: 'weekend', 'self.pace': 'lead', 'self.plan': 'planned' };
    await click(page, `answer-${values[q.field] || q.options[0].id}`);
  }
  assert.equal((await snap(page)).view.discovery.status, 'ready');
}
async function refresh(page) { await click(page, 'nav-settings'); await click(page, 'reload'); await click(page, 'nav-discover'); }
async function edit(page, id, value, { target = 'baseline', required = false, until = '' } = {}) {
  await click(page, 'nav-profile'); const section = await reveal(page.locator(`[data-preference-field="${id}"]`));
  await section.locator('[name="value"]').selectOption(value); await section.locator('[name="scope"]').selectOption(target);
  if (target === 'baseline' && await section.locator('[name="required"]').count()) await section.locator('[name="required"]').setChecked(required);
  await section.locator('[name="until"]').fill(until); await click(page, `edit-${id}`, section); await click(page, 'preview-apply');
  assert.equal(ownField(await snap(page), id).value, value);
}
async function candidate(page, id) {
  if (await page.locator('[data-secondary-discovery]').count()) await reveal(page.locator('[data-secondary-discovery]'));
  const card = page.locator(`[data-candidate="${id}"]`);
  if (!await card.isVisible()) await reveal(page.locator('[data-other-candidates]'));
  return card;
}
async function exclude(page, id) {
  await click(page, 'nav-discover'); const card = await candidate(page, id);
  await reveal(card.locator('details').filter({ has: page.locator('[data-action="exclude"]') })); await click(page, 'exclude', card);
  assert.equal(await page.locator('[data-action="preview-noted"]').count(), 0, 'a new exclusion clears an older applied-preview summary');
}
async function publicVisibility(page, enabled) {
  await click(page, 'nav-settings'); await page.locator('[name="public"]').setChecked(enabled); await click(page, 'consents');
}
async function allowance(page, { target = 'baseline', until = '' } = {}) {
  await click(page, 'nav-profile'); await reveal(page.locator('[data-preference-field="wants.contact"]'));
  const section = await reveal(page.locator('[data-conditional-preference]'));
  await section.locator('[name="conditional-scope"]').selectOption(target); await section.locator('[name="conditional-until"]').fill(until);
  await click(page, 'conditional-preview', section); await click(page, 'preview-apply');
  assert.equal((await snap(page)).view.discovery.conditionalPreference.effective.status, 'active');
}
async function viewResult(page) {
  await click(page, 'nav-discover');
  if (await page.locator('[data-secondary-discovery]').count()) await reveal(page.locator('[data-secondary-discovery]'));
  const section = await namedDetails(page, '추천이 내 방향에 맞았나요?'); await click(page, 'experience-start', section);
  const current = (await snap(page)).view.experience.records.at(-1); assert.equal(current.kind, 'recommendation'); return current.id;
}
async function reviewAllowance(page, id, value) {
  await namedDetails(page, '추천이 내 방향에 맞았나요?');
  const section = page.locator(`[data-allowance-review="${id}"]`);
  await section.locator('[name="allowance-response"]').selectOption(value); await click(page, 'allowance-review-save', section); return section;
}
try {
  await fs.mkdir(out, { recursive: true });
  server = createDatingServer({ databasePath: path.join(tmp, 'demo.sqlite'), clock: () => new Date(time) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const a = await pageFor('adult-a'), peer = await pageFor('sample-1', 1280), b = await pageFor('sample-3', 1280);
  await prepare(a, true);
  await edit(a, 'wants.contact', 'daily'); await click(a, 'nav-discover');
  const before = await snap(a);
  await exclude(a, 'demo:sample-1'); await exclude(a, 'demo:sample-2');
  const third = await candidate(a, 'demo:sample-3'); await reveal(third.locator('details').filter({ has: a.locator('[data-action="hide-candidate"]') })); await click(a, 'hide-candidate', third);
  assert.equal(await a.locator('[data-action="preview-noted"]').count(), 0, 'a timed hide clears an older applied-preview summary');
  let current = await snap(a), firstSource = current.view.discovery.excludedCandidates.find(c => c.id === 'demo:sample-1'); assert.ok(firstSource?.feedbackId);
  const exclusions = await reveal(a.locator('[data-excluded-candidates]'));
  await shot(a, 'individual-exclusions-390', exclusions);
  await click(a, 'restore-candidate', a.locator('[data-excluded-candidate="demo:sample-1"]'));
  assert.equal(await a.locator('[data-action="preview-noted"]').count(), 0, 'restoration cannot leave an obsolete preview summary');
  current = await snap(a);
  assert.equal(current.view.discovery.context.id, before.view.discovery.context.id);
  assert.deepEqual(current.view.discovery.fields, before.view.discovery.fields);
  assert.equal(current.view.discovery.excludedCandidates.some(c => c.id === 'demo:sample-1'), false);
  assert.equal(current.view.discovery.excludedCandidates.some(c => c.id === 'demo:sample-2'), true);
  assert.equal(current.view.discovery.snoozedCandidates.some(c => c.id === 'demo:sample-3'), true);
  assert.equal(current.view.discovery.selection, null); assert.equal(current.view.pairs.length, 0);
  assert.ok(current.view.discovery.feedback.find(f => f.id === firstSource.feedbackId)?.restoredAt);
  report.paths.push('restore one explicit current exclusion, preserving its source history, the same context, other answers, another exclusion and a timed hide; no selection or introduction is inferred');

  await exclude(a, 'demo:sample-1'); await publicVisibility(peer, false); await refresh(a);
  assert.equal((await snap(a)).view.discovery.excludedCandidates.some(c => c.id === 'demo:sample-1'), false);
  assert.equal(await a.locator('[data-excluded-candidate="demo:sample-1"]').count(), 0);
  assert.equal((await snap(a)).view.discovery.excludedCandidates.some(c => c.id === 'demo:sample-2'), true);
  report.paths.push('a counterpart who withdraws public visibility is absent from the exclusion-restore UI without revealing the withdrawn profile');
  await a.setViewportSize({ width: 320, height: 950 }); await reveal(a.locator('[data-excluded-candidates]')); await shot(a, 'remaining-exclusion-320');
  await click(a, 'new-context'); current = await snap(a);
  assert.notEqual(current.view.discovery.context.id, before.view.discovery.context.id);
  assert.deepEqual(current.view.discovery.excludedCandidates, []); assert.equal(current.view.discovery.selection, null);
  assert.equal(current.view.discovery.snoozedCandidates.some(c => c.id === 'demo:sample-3'), true);
  report.paths.push('starting a new recommendation cannot restore a past-context exclusion, while the independent timed hide remains');

  await publicVisibility(peer, true); await prepare(b);
  await edit(b, 'wants.pace', 'lead', { required: true }); await edit(b, 'wants.plan', 'planned', { required: true }); await edit(b, 'wants.contact', 'daily');
  assert.equal((await snap(b)).view.discovery.topCandidateId, 'demo:sample-1');
  const legacyId = await viewResult(b); assert.equal(record(await snap(b), legacyId).allowance ?? null, null);
  await allowance(b); const originalProfile = (await snap(b)).view.profile, initialRule = (await snap(b)).view.discovery.conditionalPreference.baseline.rule;
  const firstId = await viewResult(b); let captured = record(await snap(b), firstId);
  assert.equal(captured.selectedId, 'demo:sample-1'); assert.ok(captured.allowance); assert.equal(captured.allowance.target, 'baseline');
  assert.equal(record(await snap(b), legacyId).allowance ?? null, null);
  await reviewAllowance(b, firstId, 'keep'); assert.equal(record(await snap(b), firstId).allowance.response.value, 'keep');
  assert.deepEqual((await snap(b)).view.discovery.conditionalPreference.baseline.rule, initialRule);
  await refresh(peer); assert.equal((await snap(peer)).view.experience.records.length, 0);
  report.paths.push('only an explicitly viewed qualifying recommendation captures its allowance; older records infer nothing and the private keep response neither changes preferences nor appears to the counterpart');

  await reviewAllowance(b, firstId, 'stop'); let panel = b.locator(`[data-allowance-review="${firstId}"]`);
  assert.equal(record(await snap(b), firstId).allowance.canPreviewClear, true);
  assert.deepEqual((await snap(b)).view.discovery.conditionalPreference.baseline.rule, initialRule);
  await shot(b, 'private-allowance-review-1280', panel);
  await click(b, 'allowance-clear-preview', panel); await click(b, 'preview-cancel');
  assert.deepEqual((await snap(b)).view.discovery.conditionalPreference.baseline.rule, initialRule);
  await namedDetails(b, '추천이 내 방향에 맞았나요?'); await click(b, 'allowance-clear-preview', b.locator(`[data-allowance-review="${firstId}"]`)); await click(b, 'preview-apply');
  current = await snap(b); assert.equal(current.view.discovery.conditionalPreference.baseline.rule, null);
  assert.equal(ownField(current, 'wants.contact').value, 'daily'); assert.deepEqual(current.view.profile, originalProfile); assert.equal(current.view.pairs.length, 0);
  report.paths.push('stop is a private reflection only; preview cancellation preserves the rule and explicit apply alone withdraws the captured layer while preserving the original daily preference, public profile and introduction state');

  await allowance(b); const secondId = await viewResult(b); await reviewAllowance(b, secondId, 'stop');
  await edit(b, 'wants.contact', 'daily'); await click(b, 'nav-discover');
  captured = record(await snap(b), secondId); assert.equal(captured.allowance.valid, false); assert.equal(captured.allowance.canPreviewClear, false);
  await namedDetails(b, '추천이 내 방향에 맞았나요?'); panel = b.locator(`[data-allowance-review="${secondId}"]`);
  assert.equal(await panel.locator('[data-action="allowance-clear-preview"]').count(), 0);
  await click(b, 'allowance-review-withdraw', panel); assert.equal(record(await snap(b), secondId).allowance.response ?? null, null);
  report.paths.push('a later explicit primary declaration invalidates an old allowance review action without reviving its source; the private response can still be withdrawn');

  await allowance(b, { target: 'context', until: '2026-10-07T12:10' }); const thirdId = await viewResult(b); await reviewAllowance(b, thirdId, 'stop');
  time = Date.parse('2026-10-07T03:11:00.000Z'); await refresh(b);
  captured = record(await snap(b), thirdId); assert.equal(captured.allowance.valid, false); assert.equal(captured.allowance.canPreviewClear, false);
  assert.equal(ownField(await snap(b), 'wants.contact').value, 'daily');
  report.paths.push('the captured conditional allowance expires at its own deadline; the old review cannot withdraw a later rule and the original preference remains');

  await allowance(b); const fourthId = await viewResult(b); await reviewAllowance(b, fourthId, 'stop');
  await publicVisibility(peer, false); await refresh(b); captured = record(await snap(b), fourthId);
  assert.equal(captured.selectedLabel ?? null, null); assert.equal(captured.allowance.canPreviewClear, false);
  await namedDetails(b, '추천이 내 방향에 맞았나요?'); panel = b.locator(`[data-allowance-review="${fourthId}"]`);
  await click(b, 'allowance-review-withdraw', panel);
  assert.equal(record(await snap(b), fourthId).allowance.response ?? null, null);
  await click(b, 'nav-settings'); await b.locator('[name="save"]').uncheck(); await click(b, 'consents');
  assert.deepEqual((await snap(b)).view.experience.records, []);
  report.paths.push('counterpart public withdrawal disables the old source action and removes its label; own response withdrawal still works, and revoking preference storage removes the private records');

  const guide = await b.context().newPage(); await guide.setViewportSize({ width: 390, height: 950 });
  guide.on('pageerror', error => report.errors.push(error.message));
  await guide.goto(`${origin}/atlas-lab/usability.html`);
  assert.match(await guide.locator('body').innerText(), /실제.*0|참가자.*0/);
  assert.match(await guide.locator('body').innerText(), /제외.*취소|개별.*취소/);
  assert.match(await guide.locator('body').innerText(), /허용.*회고|허용.*돌아/);
  await shot(guide, 'usability-agency-guide-390');
  await guide.setViewportSize({ width: 320, height: 950 }); await shot(guide, 'usability-agency-guide-320');
  await guide.setViewportSize({ width: 794, height: 1123 }); await guide.emulateMedia({ media: 'print' });
  await shot(guide, 'usability-agency-observation-print', guide.locator('.observation').first());
  report.paths.push('the expanded optional-task guide is readable at 320 and 390px and its print-CSS blank observation sheet is captured; physical printing and actual participants are not claimed');

  assert.deepEqual(report.errors, []); assert.deepEqual(report.externalRequests, []); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; throw error; }
finally {
  await fs.mkdir(out, { recursive: true }); await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); console.log(JSON.stringify(report, null, 2));
}
