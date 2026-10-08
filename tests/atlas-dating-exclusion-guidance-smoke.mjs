// UI-only navigation and individual exclusion recovery with isolated synthetic accounts.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const out = fileURLToPath(new URL('../experiences/atlas-lab/qa/dating-exclusion-guidance/', import.meta.url));
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-exclusion-guidance-'));
const report = { at: new Date().toISOString(), status: 'running', kind: 'synthetic-exclusion-guidance-browser', modelCalls: 0, externalApiCost: 0, actualUsers: 0, paths: [], errors: [], externalRequests: [], screenshots: [] };
let server, browser, origin;
const snap = page => page.evaluate(() => window.synkDating.snapshot());
const idle = page => page.waitForFunction(() => !document.getElementById('content').hasAttribute('aria-busy'));
async function click(page, action, scope = page) { await scope.locator(`[data-action="${action}"]`).click(); await idle(page); }
async function reveal(locator) { if (await locator.evaluate(node => node.tagName === 'DETAILS' && !node.open)) await locator.locator(':scope > summary').click(); return locator; }
async function pageFor(role, width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 950 }, timezoneId: 'Asia/Seoul', serviceWorkers: 'block' });
  await context.route('**/*', route => { const url = new URL(route.request().url()); if (url.origin !== origin) { report.externalRequests.push(url.href); return route.abort(); } return route.continue(); });
  const page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(`${origin}/atlas-lab/dating.html?demo=${role}`); await page.waitForFunction(() => !!window.synkDating?.snapshot().view); await idle(page); return page;
}
async function shot(page, name) {
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: horizontal overflow`);
  assert.deepEqual(await page.locator('img').evaluateAll(images => images.filter(image => !image.complete || !image.naturalWidth).map(image => image.src)), []);
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true }); report.screenshots.push(`${name}.png`);
}
async function prepare(page) {
  await page.locator('[name="nickname"]').fill('가상 제외 안내 확인');
  for (const name of ['adult', 'public', 'invites', 'save']) await page.locator(`[name="${name}"]`).check();
  await click(page, 'onboard');
  for (let count = 0; count < 18; count++) {
    const question = (await snap(page)).view.discovery.question;
    if (!question || question.optional) break;
    const answer = { consent: 'true', availability: 'weekend', 'self.pace': 'lead', 'self.plan': 'planned' }[question.field];
    assert.ok(answer, `unexpected required synthetic question: ${question.field}`); await click(page, `answer-${answer}`);
  }
  assert.equal((await snap(page)).view.discovery.status, 'ready');
}
async function edit(page, fieldId, value, target) {
  await click(page, 'nav-profile'); const section = await reveal(page.locator(`[data-preference-field="${fieldId}"]`));
  await section.locator('[name="value"]').selectOption(value); await section.locator('[name="scope"]').selectOption(target);
  await click(page, `edit-${fieldId}`, section); await click(page, 'preview-apply');
}
async function exclude(page, candidateId) {
  await click(page, 'nav-discover'); const card = page.locator(`[data-candidate="${candidateId}"]`);
  if (!await card.isVisible()) await reveal(page.locator('[data-other-candidates]'));
  await reveal(card.locator('details').filter({ has: page.locator('[data-action="exclude"]') })); await click(page, 'exclude', card);
}
async function refresh(page) { await click(page, 'nav-settings'); await click(page, 'reload'); await click(page, 'nav-discover'); }
async function withdraw(page) { await click(page, 'nav-settings'); await page.locator('[name="public"]').uncheck(); await click(page, 'consents'); }
function unchangedAnswers(before, after) {
  assert.equal(after.view.discovery.context.id, before.view.discovery.context.id);
  assert.deepEqual(after.view.discovery.fields, before.view.discovery.fields);
  assert.deepEqual(after.view.discovery.priorities, before.view.discovery.priorities);
  assert.equal(after.view.discovery.selection, null); assert.equal(after.view.pairs.length, 0); assert.equal(after.view.introductions.length, 0);
}
try {
  await fs.mkdir(out, { recursive: true });
  server = createDatingServer({ databasePath: path.join(tmp, 'demo.sqlite'), clock: () => new Date('2026-10-07T03:00:00.000Z') });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const owner = await pageFor('adult-a'), peer = await pageFor('sample-1', 1280); await prepare(owner);
  await edit(owner, 'wants.contact', 'daily', 'baseline'); await edit(owner, 'wants.plan', 'spontaneous', 'context');
  await click(owner, 'nav-discover'); const original = await snap(owner), ids = original.view.discovery.candidates.filter(person => person.status === 'eligible').map(person => person.id);
  assert.deepEqual(ids.sort(), ['demo:sample-1', 'demo:sample-2', 'demo:sample-3']);
  for (const id of ids) await exclude(owner, id);
  const allExcluded = await snap(owner), guidance = owner.locator('[data-guidance="all-current-candidates-skipped"]');
  assert.equal(await guidance.locator('[data-action="guidance-action"]').innerText(), '이번에 넘긴 사람 확인하기');
  assert.equal(await owner.locator('[data-action="new-context"]').count(), 1, 'new context remains a separate explicit choice');
  await click(owner, 'guidance-action', guidance);
  assert.equal(await owner.locator('[data-excluded-candidates]').evaluate(node => node.open), true);
  assert.equal(await owner.evaluate(() => document.activeElement?.dataset.action), 'restore-candidate');
  assert.doesNotMatch(await owner.locator('#content').innerText(), /지금 밝힌 필수조건을 모두 충족하는 후보가 없어요/, 'an explicit exclusion-only result is not described as a hard-condition mismatch');
  const opened = await snap(owner); assert.deepEqual(opened, allExcluded, 'opening/focusing the existing list has no storage or context effects');
  await shot(owner, 'current-exclusion-list-first-390');
  await click(owner, 'restore-candidate', owner.locator('[data-excluded-candidate="demo:sample-1"]'));
  const restored = await snap(owner); unchangedAnswers(original, restored);
  assert.deepEqual(restored.view.discovery.excludedCandidates.map(person => person.id).sort(), ['demo:sample-2', 'demo:sample-3']);
  assert.ok(restored.view.discovery.feedback.find(item => item.id === allExcluded.view.discovery.excludedCandidates.find(person => person.id === 'demo:sample-1').feedbackId)?.restoredAt);
  report.paths.push('empty-result guidance opens and focuses the current exclusion list without mutation; restoring one candidate retains the same context, all declarations, other exclusions and source history, without selection or introduction');

  await click(owner, 'nav-profile'); const profileBefore = await snap(owner); await reveal(owner.locator('[data-excluded-candidates]'));
  assert.equal(await owner.locator('[data-excluded-candidate]').count(), 2); assert.deepEqual(await snap(owner), profileBefore);
  await click(owner, 'nav-discover'); unchangedAnswers(original, await snap(owner));
  report.paths.push('the recommendation and preference pages reuse the same current exclusion list, without starting another context or changing answers');

  await exclude(owner, 'demo:sample-1'); const withdrawnName = (await snap(peer)).view.profile.nickname;
  await withdraw(peer); await refresh(owner); const hidden = await snap(owner);
  assert.equal(hidden.view.discovery.excludedCandidates.some(person => person.id === 'demo:sample-1'), false);
  assert.equal(await owner.locator('[data-excluded-candidate="demo:sample-1"]').count(), 0);
  assert.equal((await owner.locator('#content').innerText()).includes(withdrawnName), false);
  await click(owner, 'guidance-action', owner.locator('[data-guidance="all-current-candidates-skipped"]'));
  assert.equal(await owner.locator('[data-excluded-candidate]').count(), 2);
  await owner.setViewportSize({ width: 320, height: 950 }); await shot(owner, 'authorized-exclusions-only-320');
  report.paths.push('after public withdrawal, the focused list contains only currently authorized candidates; the withdrawn name and restore button are absent at 320px');

  const beforeRestart = await snap(owner); await click(owner, 'new-context'); const restarted = await snap(owner);
  assert.notEqual(restarted.view.discovery.context.id, beforeRestart.view.discovery.context.id); assert.deepEqual(restarted.view.discovery.excludedCandidates, []);
  assert.equal(restarted.view.discovery.fields.find(field => field.id === 'wants.contact').baseline.value, 'daily');
  assert.equal(restarted.view.discovery.fields.find(field => field.id === 'wants.plan').context.state, 'inherit');
  assert.equal(restarted.view.discovery.selection, null); assert.equal(restarted.view.pairs.length, 0);
  report.paths.push('only the separate explicit new-context action ends current-only answers and exclusions; the ongoing baseline remains and no past selection returns');

  const second = await pageFor('sample-2'), third = await pageFor('sample-3'); await withdraw(second); await withdraw(third); await refresh(owner);
  assert.equal(await owner.locator('[data-guidance="visible-pool-empty"]').count(), 1);
  assert.equal(await owner.locator('[data-excluded-candidates]').count(), 0);
  assert.equal(await owner.locator('[data-action="restore-candidate"]').count(), 0);
  assert.equal((await owner.locator('#content').innerText()).includes(withdrawnName), false);
  report.paths.push('an empty public pool offers refresh instead of a stale or fictional exclusion-restoration list');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.externalRequests, []); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; throw error; }
finally {
  await fs.mkdir(out, { recursive: true }); await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); console.log(JSON.stringify(report, null, 2));
}
