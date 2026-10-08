// UI-only regression in an isolated synthetic database. No participants or paid calls.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const out = fileURLToPath(new URL('../experiences/atlas-lab/qa/dating-conditional-draft/', import.meta.url));
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-dating-conditional-draft-'));
const reproduceOnly = process.argv.includes('--reproduce-only');
const report = { at: new Date().toISOString(), status: 'running', kind: 'synthetic-dating-conditional-draft-browser',
  modelCalls: 0, externalApiCost: 0, actualUsers: 0, paths: [], errors: [], externalRequests: [], screenshots: [], observations: [] };
let server, browser, origin;
const snap = page => page.evaluate(() => window.synkDating.snapshot());
const idle = page => page.waitForFunction(() => !document.getElementById('content').hasAttribute('aria-busy'));
async function click(page, action, scope = page) { await scope.locator(`[data-action="${action}"]`).click(); await idle(page); }
async function reveal(locator) { if (!await locator.evaluate(node => node.open)) await locator.locator(':scope > summary').click(); return locator; }
async function openRole(page, role) {
  await page.goto(`${origin}/atlas-lab/dating.html?demo=${role}`);
  await page.waitForFunction(() => !!window.synkDating?.snapshot().view); await idle(page);
}
async function pageFor(role, width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 950 }, timezoneId: 'Asia/Seoul', serviceWorkers: 'block' });
  await context.route('**/*', route => { const url = new URL(route.request().url());
    if (url.origin !== origin) { report.externalRequests.push(url.href); return route.abort(); } return route.continue(); });
  const page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', error => report.errors.push(error.message));
  await openRole(page, role); return page;
}
async function onboard(page) {
  await click(page, 'nav-discover');
  for (let i = 0; i < 18; i++) { const q = (await snap(page)).view.discovery.question; if (!q || q.optional) break;
    const answers = { consent: 'true', availability: 'weekend', 'self.pace': 'lead', 'self.plan': 'planned' };
    await click(page, `answer-${answers[q.field] || q.options[0].id}`); }
}
async function section(page) {
  await click(page, 'nav-profile'); await reveal(page.locator('[data-preference-field="wants.contact"]'));
  return reveal(page.locator('[data-conditional-preference]'));
}
const inputs = async box => ({ scope: await box.locator('[name="conditional-scope"]').inputValue(), until: await box.locator('[name="conditional-until"]').inputValue() });
async function draft(box, scope, until) { await box.locator('[name="conditional-scope"]').selectOption(scope); await box.locator('[name="conditional-until"]').fill(until); }
async function privateContact(page, value = 'daily', target = 'baseline') {
  await click(page, 'nav-profile'); const box = await reveal(page.locator('[data-preference-field="wants.contact"]'));
  await box.locator('[name="value"]').selectOption(value); await box.locator('[name="scope"]').selectOption(target);
  if (target === 'baseline') await box.locator('[name="required"]').setChecked(false);
  await click(page, 'edit-wants.contact', box); await page.waitForSelector('[data-preview="pending"]'); await click(page, 'preview-apply');
}
async function publicNotice(page, value) {
  await click(page, 'nav-profile'); const box = page.locator('details').filter({ has: page.locator(':scope > summary', { hasText: '상대에게 보여줄 답 정하기' }) });
  await reveal(box); await box.locator('[name="public-self.notice"]').selectOption(value); await click(page, 'save-disclosure', box);
}
async function shot(page, name, locator = page) {
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: overflow`);
  assert.deepEqual(await page.locator('img').evaluateAll(images => images.filter(image => !image.complete || !image.naturalWidth).map(image => image.src)), []);
  await locator.screenshot({ path: path.join(out, `${name}.png`), ...(locator === page ? { fullPage: true } : {}) }); report.screenshots.push(`${name}.png`);
}
const stored = snapshot => snapshot.view.discovery.conditionalPreference;
try {
  await fs.mkdir(out, { recursive: true });
  server = createDatingServer({ databasePath: path.join(tmp, 'demo.sqlite'), clock: () => new Date('2026-10-07T03:00:00.000Z') });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const a = await pageFor('sample-1'), b = await pageFor('sample-3', 1280);
  await onboard(a);
  await privateContact(a); let box = await section(a); await draft(box, 'baseline', '2026-10-09T18:30');
  const before = await snap(a), expected = await inputs(box); await click(a, 'conditional-preview', box); await a.waitForSelector('[data-preview="pending"]');
  assert.equal((await snap(a)).view.revision, before.view.revision); await click(a, 'preview-cancel'); box = await section(a);
  const actual = await inputs(box), after = await snap(a);
  report.observations.push({ behavior: 'conditional preview cancellation preserves scope and deadline', source: 'experiences/atlas-lab/dating-ui.mjs:527', expected, actual,
    accountRevisionBefore: before.view.revision, accountRevisionAfter: after.view.revision, profileUnchanged: JSON.stringify(after.view.profile) === JSON.stringify(before.view.profile),
    storedRuleUnchanged: JSON.stringify(stored(after)) === JSON.stringify(stored(before)) });
  await shot(a, reproduceOnly ? 'before-fix-cancelled-draft-390' : 'cancelled-draft-preserved-390', box);
  assert.deepEqual(actual, expected, 'preview cancellation must preserve unsaved scope and deadline');
  assert.equal(after.view.revision, before.view.revision); assert.deepEqual(after.view.profile, before.view.profile); assert.deepEqual(stored(after), stored(before));
  report.paths.push('baseline scope and future deadline survive cancellation without writing account, public profile or rule');
  if (!reproduceOnly) {
    await draft(box, 'context', '2026-10-10T16:40'); await click(a, 'conditional-preview', box); await click(a, 'preview-apply');
    let current = await snap(a); assert.equal(stored(current).effective.status, 'active'); assert.equal(stored(current).effective.rule.target, 'context');
    assert.equal(stored(current).effective.rule.until, '2026-10-10T07:40:00.000Z'); assert.deepEqual(current.view.profile, before.view.profile);
    box = await section(a); assert.deepEqual(await inputs(box), { scope: 'context', until: '2026-10-10T16:40' });
    const contactInfo = await box.locator('[data-conditional-layer="context"]').innerText();
    const summaryInfo = await a.locator('[data-summary-conditional] [data-conditional-layer="context"]').innerText();
    for (const text of [contactInfo, summaryInfo]) {
      assert.match(text, /사용 범위: 이번 추천/); assert.match(text, /종료 시점/); assert.match(text, /2026.*10.*10/); assert.match(text, /4:40|16:40|4시 40분|16시 40분/);
    }
    report.observations.push({ behavior: 'saved context scope and exact deadline are visible in the editor and preference summary', contactInfo, summaryInfo });
    await shot(a, 'saved-scope-and-deadline-390', box);
    report.paths.push('editing the cancelled draft and applying its new preview saves the exact selected scope and deadline');

    await draft(box, 'baseline', '2026-10-11T19:20'); const staleBefore = await snap(a);
    await click(a, 'conditional-preview', box); await publicNotice(b, 'when-free');
    await a.evaluate(() => window.synkDating.refreshUpdates()); await idle(a);
    assert.equal(await a.locator('[data-preview="pending"]').count(), 0);
    assert.equal((await snap(a)).view.revision, staleBefore.view.revision, 'refreshing a peer change must not mutate the own account'); box = await section(a);
    assert.deepEqual(await inputs(box), { scope: 'baseline', until: '2026-10-11T19:20' });
    await shot(a, 'stale-preview-cancel-preserves-own-draft-390', box);
    report.paths.push('a peer change invalidates its old preview during the production refresh while preserving the unsubmitted own draft whose source is unchanged');

    await click(a, 'nav-discover'); const oldContext = (await snap(a)).view.discovery.context.id; await click(a, 'new-context');
    assert.notEqual((await snap(a)).view.discovery.context.id, oldContext); box = await section(a);
    assert.notEqual((await inputs(box)).until, '2026-10-11T19:20', 'a new recommendation context cannot reuse its previous conditional draft');
    report.paths.push('starting a new recommendation context discards the old unsaved conditional draft');

    await draft(box, 'baseline', '2026-10-12T17:10'); await click(a, 'conditional-preview', box); await click(a, 'preview-cancel');
    await privateContact(a, 'few-days'); box = await section(a); assert.equal(await box.locator('[name="conditional-scope"]').count(), 0);
    await privateContact(a, 'daily'); box = await section(a); assert.notEqual((await inputs(box)).until, '2026-10-12T17:10');
    report.paths.push('changing the original contact declaration and restoring its value does not resurrect the superseded conditional draft');

    const sameActor = await pageFor('sample-1', 1280);
    await draft(box, 'baseline', '2026-10-14T18:50'); const sourceBefore = await snap(a);
    await click(a, 'conditional-preview', box); await privateContact(sameActor, 'daily'); const sourceLatest = await snap(sameActor);
    assert.ok(sourceLatest.view.revision > sourceBefore.view.revision);
    await a.evaluate(() => window.synkDating.refreshUpdates()); await idle(a);
    assert.equal(await a.locator('[data-preview="pending"]').count(), 0); box = await section(a);
    const refreshed = await snap(a), refreshedInputs = await inputs(box);
    report.observations.push({ behavior: 'a same-actor second surface redeclares the same value; production refresh loads its newer source and drops the old preview and draft',
      expectedRevision: sourceLatest.view.revision, actualRevision: refreshed.view.revision,
      oldDraftDeadline: '2026-10-14T18:50', actualDeadline: refreshedInputs.until });
    assert.equal(refreshed.view.revision, sourceLatest.view.revision, 'production refresh must fetch the latest account declaration');
    assert.notEqual(refreshedInputs.until, '2026-10-14T18:50', 'the same selected value with a newer declaration cannot inherit the old draft');
    assert.deepEqual(refreshed.view.discovery.fields.find(field => field.id === 'wants.contact').baseline.provenance,
      sourceLatest.view.discovery.fields.find(field => field.id === 'wants.contact').baseline.provenance);
    await shot(a, 'same-actor-source-refresh-drops-old-draft-390', box);
    report.paths.push('a same-actor second surface redeclaring daily invalidates the reviewed preview and draft when the production refresh loads its new source');

    await draft(box, 'baseline', '2026-10-15T19:35'); const differentBefore = await snap(a);
    await click(a, 'conditional-preview', box); await privateContact(sameActor, 'few-days'); const differentLatest = await snap(sameActor);
    assert.ok(differentLatest.view.revision > differentBefore.view.revision);
    await a.evaluate(() => window.synkDating.refreshUpdates()); await idle(a);
    assert.equal(await a.locator('[data-preview="pending"]').count(), 0); box = await section(a);
    const blocked = await snap(a); assert.equal(blocked.view.revision, differentLatest.view.revision);
    assert.equal(blocked.view.discovery.fields.find(field => field.id === 'wants.contact').value, 'few-days');
    assert.equal(stored(blocked).available, false); assert.equal(await box.locator('[name="conditional-scope"]').count(), 0);
    assert.equal(await box.locator('[data-action="conditional-preview"]').count(), 0);
    report.paths.push('a same-actor second surface changing the source to few-days invalidates the old preview and blocks the conditional editor during production refresh');
    await privateContact(a, 'daily'); box = await section(a);

    await draft(box, 'baseline', '2026-10-13T20:15'); await click(a, 'conditional-preview', box); await click(a, 'preview-cancel');
    await openRole(a, 'sample-3'); await onboard(a); await privateContact(a); box = await section(a); assert.notEqual((await inputs(box)).until, '2026-10-13T20:15');
    assert.equal((await snap(a)).view.accountId, 'demo:sample-3');
    await openRole(a, 'sample-1'); box = await section(a); assert.notEqual((await inputs(box)).until, '2026-10-13T20:15');
    report.paths.push('switching synthetic actors in the same browser surface clears private drafts and returning does not recover unsaved data');
    await a.setViewportSize({ width: 320, height: 950 }); await shot(a, 'source-bound-draft-reset-320', box);
    await a.setViewportSize({ width: 1280, height: 950 }); await shot(a, 'source-bound-draft-reset-1280', box);

    await draft(box, 'baseline', '2026-10-19T09:00'); await click(a, 'conditional-preview', box); await click(a, 'preview-apply');
    box = await section(a); await draft(box, 'context', '2026-10-18T10:20'); await click(a, 'conditional-preview', box); await click(a, 'preview-apply');
    box = await section(a); const bothLayers = await snap(a);
    assert.equal(stored(bothLayers).baseline.status, 'active'); assert.equal(stored(bothLayers).context.status, 'active');
    await click(a, 'conditional-clear-baseline', box); const layerCaption = await a.locator('[data-preview-changes]').innerText();
    assert.match(layerCaption, /평소 허용\(앞으로도\): 없음/); assert.match(layerCaption, /이번 허용\(이번 추천에서만\): 사용 가능/);
    assert.match(layerCaption, /현재 사용하는 허용 조건은 그대로/); assert.match(layerCaption, /원래 연락 답은 바뀌지/);
    assert.equal((await snap(a)).view.revision, bothLayers.view.revision); assert.equal(stored(await snap(a)).baseline.status, 'active');
    assert.equal(stored(await snap(a)).context.status, 'active');
    report.observations.push({ behavior: 'withdrawing the saved baseline allowance describes each layer and keeps the active context allowance', layerCaption });
    await a.setViewportSize({ width: 320, height: 950 }); await shot(a, 'baseline-withdrawal-keeps-context-preview-320', a.locator('[data-preview="pending"]'));
    await click(a, 'preview-apply'); box = await section(a); const onlyContext = await snap(a);
    assert.equal(stored(onlyContext).baseline.rule, null); assert.equal(stored(onlyContext).context.status, 'active'); assert.equal(stored(onlyContext).target, 'context');
    assert.match(await box.locator('[data-conditional-layer="baseline"]').innerText(), /저장한 허용 조건이 없어요/);
    assert.match(await box.locator('[data-conditional-layer="context"]').innerText(), /지금 추천에 사용하고 있어요/);
    assert.deepEqual(onlyContext.view.profile, bothLayers.view.profile);
    report.paths.push('withdrawing a saved baseline allowance explains both layers before saving and leaves the current context allowance active after explicit apply');
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.externalRequests, []); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; process.exitCode = 1; }
finally {
  await fs.mkdir(out, { recursive: true }); await fs.writeFile(path.join(out, reproduceOnly ? 'pre-fix-result.json' : 'result.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); console.log(JSON.stringify(report, null, 2));
}
