// Free browser verification with the input-continuity fixture: synthetic accounts and isolated SQLite.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, 'experiences/atlas-lab/qa/dating-schedule-validation');
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-dating-schedule-validation-'));
const sourceFiles = ['experiences/atlas-lab/dating-ui.mjs', 'experiences/atlas-lab/dating.css', 'experiences/atlas-lab/dating.html', 'tests/atlas-dating-schedule-validation-smoke.mjs'];
const report = { at: new Date().toISOString(), status: 'running', kind: 'synthetic-schedule-validation-browser', modelCalls: 0, externalApiCost: 0, actualUsers: 0, serverTime: '2026-10-10T03:00:00.000Z', paths: [], errors: [], externalRequests: [], actionPosts: [], screenshots: [] };
let server, browser, origin;
const names = ['startsAt', 'durationMinutes', 'endsAt', 'place', 'note'];
const checkedNames = ['startsAt', 'durationMinutes', 'endsAt', 'place'];
const snap = page => page.evaluate(() => window.synkDating.snapshot());
const idle = page => page.waitForFunction(() => !document.getElementById('content').hasAttribute('aria-busy'));
async function hashes() { return Object.fromEntries(await Promise.all(sourceFiles.map(async name => [name, createHash('sha256').update(await fs.readFile(path.join(root, name))).digest('hex')]))); }
async function click(page, action, scope = page) { await scope.locator(`[data-action="${action}"]`).click(); await idle(page); }
async function reveal(locator) { if (await locator.evaluate(n => n.tagName === 'DETAILS' && !n.open)) await locator.locator(':scope > summary').click(); return locator; }
async function pageFor(role, width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 950 }, timezoneId: 'Asia/Seoul', serviceWorkers: 'block' });
  await context.route('**/*', route => { const url = new URL(route.request().url()); if (url.origin !== origin) { report.externalRequests.push(url.href); return route.abort(); } return route.continue(); });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/atlas-dating/action') {
      const body = request.postDataJSON();
      report.actionPosts.push({ role, kind: body.action?.kind, action: body.action?.action?.kind });
    }
  });
  await page.goto(`${origin}/atlas-lab/dating.html?demo=${role}`);
  await page.waitForFunction(() => !!window.synkDating?.snapshot().view); await idle(page); return page;
}
async function shot(page, name, locator) {
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: horizontal overflow`);
  assert.deepEqual(await page.locator('img').evaluateAll(images => images.filter(i => !i.complete || !i.naturalWidth).map(i => i.src)), []);
  await locator.screenshot({ path: path.join(out, `${name}.png`) }); report.screenshots.push(`${name}.png`);
}
async function prepare(page) {
  for (let i = 0; i < 18; i++) {
    const q = (await snap(page)).view.discovery.question; if (!q || q.optional) break;
    const values = { consent: 'true', availability: 'weekend', 'self.pace': 'lead', 'self.plan': 'planned' };
    await click(page, `answer-${values[q.field] || q.options[0].id}`);
  }
  assert.equal((await snap(page)).view.discovery.status, 'ready');
}
async function connect(a, b) {
  await click(a, 'nav-discover'); const card = a.locator('[data-candidate="demo:sample-3"]');
  if (!await card.isVisible()) await reveal(a.locator('[data-other-candidates]'));
  await click(a, 'connect', card); await click(b, 'nav-inbox'); await click(b, 'refresh'); await click(b, 'intro-accept'); await click(a, 'refresh');
  assert.equal((await snap(a)).view.pairs.at(-1).introduction.accepted, true);
}
async function newSchedule(page) { await click(page, 'nav-inbox'); const detail = await reveal(page.locator('[data-new-schedule]')); return detail.locator('[data-schedule-form]'); }
async function values(form) { return Object.fromEntries(await Promise.all(names.map(async name => [name, await form.locator(`[name="${name}"]`).inputValue()]))); }
async function fill(form, name, value) { await form.locator(`[name="${name}"]`).fill(value); }
async function errors(form, expected) {
  const states = await form.evaluate(node => [...node.querySelectorAll('[data-schedule-error]')].map(error => {
    const input = node.querySelector(`[name="${error.dataset.scheduleError}"]`);
    return { name: input.name, visible: !error.hidden, text: error.textContent, invalid: input.getAttribute('aria-invalid'), linked: input.getAttribute('aria-describedby')?.split(/\s+/).includes(error.id) && !!error.id };
  }));
  assert.deepEqual(states.map(item => item.name), checkedNames);
  assert.equal(states.every(item => item.linked), true, 'every error is connected to its own input');
  assert.deepEqual(states.filter(item => item.visible).map(item => item.name), expected);
  for (const state of states) {
    assert.equal(state.invalid, state.visible ? 'true' : null, `${state.name}: aria-invalid follows visible error`);
    assert.equal(Boolean(state.text), state.visible, `${state.name}: hidden error has no stale text`);
  }
}
async function blocked(page, form, expected, label) {
  const before = report.actionPosts.length, revision = (await snap(page)).view.revision;
  const entered = await values(form), appointments = (await snap(page)).view.pairs.at(-1).view.appointments;
  await click(page, 'propose', form);
  await errors(form, expected);
  const focus = await form.evaluate(node => ({ actual: document.activeElement?.getAttribute('name'), tag: document.activeElement?.tagName, action: document.activeElement?.getAttribute('data-action'), inside: node.contains(document.activeElement) }));
  assert.equal(await form.locator(`[name="${expected[0]}"]`).evaluate(node => document.activeElement === node), true, `${label}: focus first invalid field ${JSON.stringify(focus)}`);
  assert.equal(report.actionPosts.length, before, `${label}: no action POST`);
  assert.equal((await snap(page)).view.revision, revision, `${label}: server revision unchanged`);
  assert.deepEqual((await snap(page)).view.pairs.at(-1).view.appointments, appointments, `${label}: appointment unchanged`);
  assert.deepEqual(await values(form), entered, `${label}: typed values preserved`);
  report.paths.push({ label, invalidFields: expected, actionPostsBefore: before, actionPostsAfter: report.actionPosts.length });
}
async function verify(a, b) {
  await prepare(a); await connect(a, b);
  let form = await newSchedule(a);
  await errors(form, []);
  await form.locator('[name="startsAt"]').focus(); await form.locator('[name="durationMinutes"]').focus();
  await errors(form, ['startsAt']);
  await fill(form, 'startsAt', '2026-10-10T14:00'); await errors(form, []);
  report.paths.push('blur validates the touched start only; correcting it immediately clears its inline and ARIA error');

  await fill(form, 'startsAt', ''); await fill(form, 'note', '유효성 오류가 있어도 보존하는 가상 초안');
  await blocked(a, form, ['startsAt', 'endsAt', 'place'], 'missing-required-fields');
  await a.setViewportSize({ width: 320, height: 950 }); await shot(a, 'required-errors-320', form);
  await fill(form, 'startsAt', '2026-10-10T14:00'); await fill(form, 'durationMinutes', '30'); await fill(form, 'place', '가상 일정 검증 카페');
  assert.equal((await values(form)).endsAt, '2026-10-10T14:30'); await errors(form, []);
  report.paths.push('correcting required fields clears every error before resubmission and 30 minutes automatically fills the ending');

  for (const startsAt of ['2026-10-10T11:59', '2026-10-10T12:00']) {
    await fill(form, 'startsAt', startsAt);
    await blocked(a, form, ['startsAt'], startsAt.endsWith('12:00') ? 'start-equal-to-server-time' : 'start-before-server-time');
  }
  await a.setViewportSize({ width: 390, height: 950 }); await shot(a, 'past-start-error-390', form);
  await fill(form, 'startsAt', '2026-10-10T14:00'); await errors(form, []);

  for (const duration of ['0', '-1', '1.5']) {
    await fill(form, 'endsAt', '2026-10-10T14:30'); await fill(form, 'durationMinutes', duration);
    await blocked(a, form, ['durationMinutes'], `invalid-duration-${duration}`);
  }
  await fill(form, 'durationMinutes', '45'); assert.equal((await values(form)).endsAt, '2026-10-10T14:45'); await errors(form, []);
  await fill(form, 'durationMinutes', ''); await fill(form, 'endsAt', '2026-10-10T14:45'); await errors(form, []);
  report.paths.push('zero, negative and fractional durations are rejected; correcting to 45 restores automatic end calculation; a blank optional duration with a manually supplied ending is valid');

  for (const endsAt of ['2026-10-10T14:00', '2026-10-10T13:59']) {
    await fill(form, 'endsAt', endsAt);
    await blocked(a, form, ['endsAt'], endsAt.endsWith('14:00') ? 'end-equal-to-start' : 'end-before-start');
  }
  await fill(form, 'endsAt', '2026-10-10T14:45'); await fill(form, 'place', '   ');
  await blocked(a, form, ['place'], 'blank-place');
  const entered = await values(form), beforeNavigation = report.actionPosts.length;
  await click(a, 'nav-profile'); form = await newSchedule(a);
  assert.deepEqual(await values(form), entered); assert.equal(report.actionPosts.length, beforeNavigation);
  await blocked(a, form, ['place'], 'invalid-draft-after-navigation');
  report.paths.push('internal navigation retains every draft value, including whitespace and the optional note, without sending an action');

  await fill(form, 'place', '수정한 가상 카페'); await errors(form, []);
  await shot(a, 'corrected-new-schedule-390', form);
  let before = report.actionPosts.length;
  await click(a, 'propose', form);
  assert.equal(report.actionPosts.length, before + 1, 'valid new schedule sends exactly one action');
  let pair = (await snap(a)).view.pairs.at(-1), appointment = pair.view.appointments.at(-1);
  assert.equal(appointment.status, 'pending'); assert.equal(appointment.proposal.schedule.place, '수정한 가상 카페');
  assert.equal(appointment.proposal.schedule.endsAt, '2026-10-10T05:45:00.000Z');
  assert.equal(pair.view.appointments.length, 1);
  report.paths.push('a corrected schedule with a blank optional duration creates exactly one pending appointment');

  const originalVersion = appointment.proposal.version, originalId = appointment.id;
  form = a.locator(`[data-schedule-form="${appointment.id}:${originalVersion}"]`); await reveal(form.locator('..'));
  await errors(form, []);
  await fill(form, 'endsAt', '2026-10-10T14:00');
  await blocked(a, form, ['endsAt'], 'revision-end-equal-to-start');
  const revisionDraft = await values(form);
  await click(a, 'nav-profile'); await click(a, 'nav-inbox'); await reveal(form.locator('..'));
  assert.deepEqual(await values(form), revisionDraft);
  await blocked(a, form, ['endsAt'], 'revision-draft-after-navigation');
  await a.setViewportSize({ width: 320, height: 950 }); await shot(a, 'revision-error-320', form);
  await fill(form, 'durationMinutes', '60'); assert.equal((await values(form)).endsAt, '2026-10-10T15:00');
  await fill(form, 'place', '변경한 가상 카페'); await errors(form, []);
  await shot(a, 'corrected-revision-320', form);
  before = report.actionPosts.length;
  await click(a, 'propose', form);
  assert.equal(report.actionPosts.length, before + 1, 'corrected revision sends exactly one action');
  pair = (await snap(a)).view.pairs.at(-1); appointment = pair.view.appointments.at(-1);
  assert.equal(pair.view.appointments.length, 1); assert.equal(appointment.id, originalId);
  assert.equal(appointment.proposal.version, originalVersion + 1); assert.equal(appointment.status, 'pending');
  assert.equal(appointment.proposal.schedule.endsAt, '2026-10-10T06:00:00.000Z');
  assert.equal(appointment.proposal.schedule.place, '변경한 가상 카페');
  await click(b, 'nav-inbox'); await click(b, 'refresh');
  const received = (await snap(b)).view.pairs.at(-1).view.appointments.at(-1);
  assert.equal(received.proposal.version, appointment.proposal.version);
  assert.equal(received.proposal.schedule.place, '변경한 가상 카페');
  report.paths.push('the same validation blocks an invalid revision without changing the existing appointment; correction updates its version exactly once and the counterpart sees the pending revision');
}

try {
  await fs.mkdir(out, { recursive: true }); report.sourceHashesBefore = await hashes();
  server = createDatingServer({ databasePath: path.join(tmp, 'demo.sqlite'), clock: () => new Date(report.serverTime) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const a = await pageFor('sample-1'), b = await pageFor('sample-3', 1280);
  await verify(a, b);
  assert.deepEqual(report.errors, []); assert.deepEqual(report.externalRequests, []);
  report.sourceHashesAfter = await hashes(); assert.deepEqual(report.sourceHashesAfter, report.sourceHashesBefore, 'verified sources stayed unchanged during the run');
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; throw error; }
finally {
  await fs.mkdir(out, { recursive: true }); await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); console.log(JSON.stringify(report, null, 2));
}
