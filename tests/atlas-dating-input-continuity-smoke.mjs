// Free, UI-only verification against isolated synthetic accounts and SQLite.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const reproduceOnly = process.argv.includes('--reproduce-only');
const out = fileURLToPath(new URL('../experiences/atlas-lab/qa/dating-input-continuity/', import.meta.url));
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-dating-input-continuity-'));
const report = { at: new Date().toISOString(), status: 'running', kind: reproduceOnly ? 'synthetic-input-reproduction' : 'synthetic-input-continuity-browser', modelCalls: 0, externalApiCost: 0, actualUsers: 0, paths: [], errors: [], externalRequests: [], screenshots: [] };
let server, browser, origin, time = Date.parse('2026-10-10T03:00:00.000Z');
const names = ['startsAt', 'durationMinutes', 'endsAt', 'place', 'note'];
const snap = page => page.evaluate(() => window.synkDating.snapshot());
const idle = page => page.waitForFunction(() => !document.getElementById('content').hasAttribute('aria-busy'));
const field = (s, id) => s.view.discovery.fields.find(f => f.id === id);
async function click(page, action, scope = page) { await scope.locator(`[data-action="${action}"]`).click(); await idle(page); }
async function reveal(locator) { if (await locator.evaluate(n => n.tagName === 'DETAILS' && !n.open)) await locator.locator(':scope > summary').click(); return locator; }
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
async function prepare(page) {
  for (let i = 0; i < 18; i++) {
    const q = (await snap(page)).view.discovery.question; if (!q || q.optional) break;
    const values = { consent: 'true', availability: 'weekend', 'self.pace': 'lead', 'self.plan': 'planned' };
    await click(page, `answer-${values[q.field] || q.options[0].id}`);
  }
  assert.equal((await snap(page)).view.discovery.status, 'ready');
}
async function preference(page, id) { await click(page, 'nav-profile'); return reveal(page.locator(`[data-preference-field="${id}"]`)); }
async function newSchedule(page) { await click(page, 'nav-inbox'); return reveal(page.locator('[data-new-schedule]')); }
async function values(form) { return Object.fromEntries(await Promise.all(names.map(async name => [name, await form.locator(`[name="${name}"]`).inputValue()]))); }
async function fillSchedule(form, { startsAt = '2026-10-10T14:00', durationMinutes = '30', endsAt, place = '가상 초안 카페', note = '아직 전송하지 않은 가상 메모' } = {}) {
  await form.locator('[name="startsAt"]').fill(startsAt); await form.locator('[name="durationMinutes"]').fill(durationMinutes);
  if (endsAt) await form.locator('[name="endsAt"]').fill(endsAt);
  await form.locator('[name="place"]').fill(place); await form.locator('[name="note"]').fill(note); return values(form);
}
async function connect(a, b) {
  await click(a, 'nav-discover'); const card = a.locator('[data-candidate="demo:sample-3"]');
  if (!await card.isVisible()) await reveal(a.locator('[data-other-candidates]'));
  await click(a, 'connect', card); await click(b, 'nav-inbox'); await click(b, 'refresh'); await click(b, 'intro-accept'); await click(a, 'refresh');
  assert.equal((await snap(a)).view.pairs.at(-1).introduction.accepted, true);
}
async function reproduce(a, b) {
  const notice = await preference(a, 'wants.notice'), before = await snap(a);
  assert.equal(field(before, 'wants.notice').value, null);
  const visibleValue = await notice.locator('[name="value"]').inputValue(); assert.equal(visibleValue, 'advance');
  await shot(a, 'before-unknown-select-390', notice);
  report.paths.push({ issue: 'unknown-answer-has-default-selection', sourceValue: null, displayedValue: visibleValue, mutation: false });
  await connect(a, b); await a.setViewportSize({ width: 1280, height: 950 });
  let form = await newSchedule(a); const entered = await fillSchedule(form, { endsAt: '2026-10-10T15:10' });
  await shot(a, 'before-navigation-entered-1280', form);
  await click(a, 'nav-profile'); form = await newSchedule(a); const returned = await values(form);
  assert.deepEqual(returned, Object.fromEntries(names.map(name => [name, ''])));
  await shot(a, 'before-navigation-lost-1280', form);
  assert.equal((await snap(a)).view.pairs.at(-1).view.appointments.length, 0);
  report.paths.push({ issue: 'new-schedule-draft-lost-on-tab-navigation', entered, returned, appointmentSent: false });
}
async function verify(a, b) {
  let notice = await preference(a, 'wants.notice'), before = await snap(a);
  assert.equal(field(before, 'wants.notice').value, null);
  assert.equal(await notice.locator('[name="value"]').inputValue(), '');
  async function blockedPreview(section) {
    const button = section.locator('[data-action="edit-wants.notice"]');
    if (!await button.isDisabled()) await click(a, 'edit-wants.notice', section);
    assert.equal(await a.locator('[data-preview="pending"]').count(), 0);
    assert.equal((await snap(a)).view.revision, before.view.revision);
    assert.equal(field(await snap(a), 'wants.notice').value, null);
  }
  await blockedPreview(notice); await notice.locator('[name="required"]').check(); await blockedPreview(notice);
  assert.equal(field(await snap(a), 'wants.notice').required, false);
  await shot(a, 'unknown-is-unselected-390', notice);
  report.paths.push('an unknown answer stays unselected; neither a preview attempt nor a required-checkbox change silently declares the first option');

  await notice.locator('[name="required"]').uncheck(); await notice.locator('[name="value"]').selectOption('advance');
  await click(a, 'edit-wants.notice', notice); assert.equal(field(await snap(a), 'wants.notice').value, null);
  await click(a, 'preview-cancel'); notice = await preference(a, 'wants.notice');
  assert.equal(await notice.locator('[name="value"]').inputValue(), 'advance');
  assert.equal(field(await snap(a), 'wants.notice').value, null);
  await click(a, 'edit-wants.notice', notice); await click(a, 'preview-apply');
  assert.equal(field(await snap(a), 'wants.notice').value, 'advance');
  report.paths.push('an explicitly selected draft survives preview cancellation and becomes a declaration only after separate apply');

  notice = await preference(a, 'wants.notice'); await click(a, 'clear-wants.notice', notice); notice = await preference(a, 'wants.notice');
  assert.equal(await notice.locator('[name="value"]').inputValue(), '');
  await notice.locator('[name="value"]').selectOption('advance'); await notice.locator('[name="until"]').fill('2026-10-10T12:10');
  await click(a, 'edit-wants.notice', notice); await click(a, 'preview-apply');
  time = Date.parse('2026-10-10T03:11:00.000Z'); await click(a, 'nav-settings'); await click(a, 'reload');
  notice = await preference(a, 'wants.notice'); assert.equal(field(await snap(a), 'wants.notice').value, null);
  assert.equal(await notice.locator('[name="value"]').inputValue(), '');
  await a.setViewportSize({ width: 320, height: 950 }); await shot(a, 'expired-answer-is-unselected-320', notice);
  report.paths.push('clearing an answer and reaching an explicit expiry both return the editor to an unselected state without reviving the old value');

  await connect(a, b); await a.setViewportSize({ width: 390, height: 950 });
  let form = await newSchedule(a), entered = await fillSchedule(form);
  assert.equal(entered.endsAt, '2026-10-10T14:30');
  await click(a, 'nav-profile'); form = await newSchedule(a); assert.deepEqual(await values(form), entered);
  await click(a, 'refresh'); form = await reveal(a.locator('[data-new-schedule]')); assert.deepEqual(await values(form), entered);
  await form.locator('[name="startsAt"]').fill('2026-10-10T14:10'); assert.equal(await form.locator('[name="endsAt"]').inputValue(), '2026-10-10T14:40');
  await shot(a, 'new-schedule-retained-390', form);
  assert.equal((await snap(a)).view.pairs.at(-1).view.appointments.length, 0);
  report.paths.push('tab navigation and an unchanged refresh preserve the unsent schedule and its automatic end-time mode without creating an appointment');

  await form.locator('[name="endsAt"]').fill('2026-10-10T15:10'); entered = await values(form);
  await click(a, 'nav-profile'); form = await newSchedule(a); await click(a, 'refresh'); form = await reveal(a.locator('[data-new-schedule]'));
  assert.deepEqual(await values(form), entered);
  await form.locator('[name="startsAt"]').fill('2026-10-10T14:20'); assert.equal(await form.locator('[name="endsAt"]').inputValue(), '2026-10-10T15:10');
  await form.locator('[name="durationMinutes"]').fill('45'); assert.equal(await form.locator('[name="endsAt"]').inputValue(), '2026-10-10T15:05');
  report.paths.push('a manually edited ending stays manual across navigation and refresh; explicitly choosing a new duration restores automatic end calculation');

  await click(a, 'nav-settings'); await click(a, 'pause'); await click(a, 'pause'); form = await newSchedule(a);
  assert.deepEqual(await values(form), Object.fromEntries(names.map(name => [name, ''])));
  report.paths.push('pausing and resuming does not resurrect a previously unsent schedule draft');

  await fillSchedule(form, { place: '전송한 가상 카페', note: '전송한 가상 메모' }); await click(a, 'propose', form);
  let pair = (await snap(a)).view.pairs.at(-1), appointment = pair.view.appointments.at(-1);
  assert.equal(appointment.proposal.schedule.place, '전송한 가상 카페'); assert.equal(appointment.status, 'pending');
  await click(b, 'nav-inbox'); await click(b, 'refresh'); await click(b, 'busy'); await click(a, 'refresh');
  form = await newSchedule(a); assert.deepEqual(await values(form), Object.fromEntries(names.map(name => [name, ''])));
  report.paths.push('successful proposal clears the sent draft; after the counterpart marks only the time as unsuitable, an ordinary new proposal starts blank');

  await click(b, 'reschedule-reuse'); const copied = await reveal(b.locator('[data-new-schedule]'));
  assert.deepEqual(await values(copied), { startsAt: '', durationMinutes: '30', endsAt: '', place: '전송한 가상 카페', note: '' });
  await click(b, 'nav-settings'); await b.locator('[name="save"]').uncheck(); await click(b, 'consents');
  await b.locator('[name="save"]').check(); await click(b, 'consents');
  const afterConsent = await newSchedule(b); assert.deepEqual(await values(afterConsent), Object.fromEntries(names.map(name => [name, ''])));
  report.paths.push('explicit reuse copies only the previous place and duration; turning storage consent off and on discards that seed instead of reviving it on returning to the inbox');

  await fillSchedule(form, { startsAt: '2026-10-10T16:00', place: '새로 보낸 가상 카페' }); await click(a, 'propose', form);
  pair = (await snap(a)).view.pairs.at(-1); appointment = pair.view.appointments.at(-1);
  const proposalKey = `${appointment.id}:${appointment.proposal.version}`, revisionForm = page => page.locator(`[data-schedule-form="${proposalKey}"]`);
  form = revisionForm(a); await reveal(form.locator('..')); await form.locator('[name="place"]').fill('버려져야 하는 오래된 편집');
  await form.locator('[name="note"]').fill('나중 버전에 복원하면 안 되는 초안');
  const otherTab = await pageFor('sample-1', 1280); await click(otherTab, 'nav-inbox');
  const remote = revisionForm(otherTab); await reveal(remote.locator('..'));
  await remote.locator('[name="place"]').fill('다른 탭에서 확정한 새 제안'); await remote.locator('[name="note"]').fill('서버의 새 제안 메모'); await click(otherTab, 'propose', remote);
  await click(a, 'refresh'); pair = (await snap(a)).view.pairs.at(-1); appointment = pair.view.appointments.at(-1);
  assert.equal(appointment.proposal.version, Number(proposalKey.split(':').at(-1)) + 1);
  form = a.locator(`[data-schedule-form="${appointment.id}:${appointment.proposal.version}"]`); await reveal(form.locator('..'));
  assert.equal(await form.locator('[name="place"]').inputValue(), '다른 탭에서 확정한 새 제안');
  assert.equal(await form.locator('[name="note"]').inputValue(), '서버의 새 제안 메모');
  await a.setViewportSize({ width: 1280, height: 950 }); await shot(a, 'new-version-discards-old-edit-1280', form);
  await otherTab.context().close();
  report.paths.push('a new proposal version written through another role-authenticated tab discards the older local edit and shows the current server proposal');

  await form.locator('[name="place"]').fill('다른 역할로 넘기면 안 되는 장소'); await form.locator('[name="note"]').fill('역할 전환 비공개 초안');
  const roleURL = await a.locator('[data-demo-role="sample-3"]').first().getAttribute('href');
  await a.goto(new URL(roleURL, a.url()).href); await a.waitForFunction(() => window.synkDating?.snapshot().view?.accountId === 'demo:sample-3'); await idle(a);
  await click(a, 'nav-inbox'); assert.doesNotMatch(await a.locator('body').innerText(), /역할 전환 비공개 초안|다른 역할로 넘기면 안 되는 장소/);
  await a.goto(`${origin}/atlas-lab/dating.html?demo=sample-1`); await a.waitForFunction(() => window.synkDating?.snapshot().view?.accountId === 'demo:sample-1'); await idle(a); await click(a, 'nav-inbox');
  form = a.locator(`[data-schedule-form="${appointment.id}:${appointment.proposal.version}"]`); await reveal(form.locator('..'));
  assert.equal(await form.locator('[name="place"]').inputValue(), '다른 탭에서 확정한 새 제안');
  assert.equal(await form.locator('[name="note"]').inputValue(), '서버의 새 제안 메모');
  report.paths.push('navigating the real demo-role link in the same tab never transfers an unsent draft to another actor or restores it after returning');

  await form.locator('[name="place"]').fill('공개 철회 후 버려야 하는 초안');
  await click(b, 'nav-settings'); await b.locator('[name="public"]').uncheck(); await click(b, 'consents'); await click(a, 'refresh');
  assert.equal(await a.locator('[data-schedule-form]').count(), 0); assert.doesNotMatch(await a.locator('body').innerText(), /공개 철회 후 버려야 하는 초안/);
  await b.locator('[name="public"]').check(); await click(b, 'consents'); await click(a, 'refresh');
  assert.equal(await a.locator('[data-schedule-form]').count(), 0);
  assert.equal((await snap(a)).view.pairs.at(-1).status, 'closed');
  report.paths.push('a counterpart public withdrawal removes the draft and closes the connection; restoring public visibility alone does not revive the old draft or acceptance');
}
try {
  await fs.mkdir(out, { recursive: true });
  server = createDatingServer({ databasePath: path.join(tmp, 'demo.sqlite'), clock: () => new Date(time) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const a = await pageFor('sample-1'), b = await pageFor('sample-3', 1280); await prepare(a);
  if (reproduceOnly) await reproduce(a, b); else await verify(a, b);
  assert.deepEqual(report.errors, []); assert.deepEqual(report.externalRequests, []); report.status = reproduceOnly ? 'reproduced' : 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; throw error; }
finally {
  await fs.mkdir(out, { recursive: true }); await fs.writeFile(path.join(out, reproduceOnly ? 'reproduction.json' : 'result.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); console.log(JSON.stringify(report, null, 2));
}
