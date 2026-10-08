// Isolated, free browser proof: one candidate through recommendation, introduction and appointment.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const out = fileURLToPath(new URL('../experiences/atlas-lab/qa/dating-continuity/', import.meta.url));
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-dating-continuity-'));
const report = { at: new Date().toISOString(), status: 'running', modelCalls: 0, actualUsers: 0, paths: [], errors: [], externalRequests: [], screenshots: [] };
let server, browser, origin, time = Date.parse('2026-10-06T03:00:00Z');
const snap = page => page.evaluate(() => window.synkDating.snapshot());
const idle = page => page.waitForFunction(() => !document.getElementById('content').hasAttribute('aria-busy'));
async function click(page, action) { await page.locator(`[data-action="${action}"]`).click(); await idle(page); }
async function opened(page, title) { const item = page.locator('details').filter({ has: page.locator('summary', { hasText: title }) }).last(); if (!await item.evaluate(n => n.open)) await item.locator(':scope > summary').click(); return item; }
async function pageFor(role, width) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'Asia/Seoul', serviceWorkers: 'block' });
  await context.route('**/*', route => { const url = new URL(route.request().url()); if (url.origin !== origin) { report.externalRequests.push(url.href); return route.abort(); } return route.continue(); });
  const page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(`${origin}/atlas-lab/dating.html?demo=${role}`); await page.waitForFunction(() => window.synkDating?.snapshot().view); return page;
}
async function shot(page, name) { await page.evaluate(() => document.fonts.ready); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name); await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true }); report.screenshots.push(`${name}.png`); }
async function revealCandidate(page, id) { if (await page.locator('[data-secondary-discovery]').count()) await opened(page, '다른 추천과 내 기준 살펴보기'); const card = page.locator(`[data-candidate="${id}"]`); if (!await card.isVisible()) await opened(page, '다른 후보 살펴보기'); return card; }
try {
  await fs.mkdir(out, { recursive: true }); server = createDatingServer({ databasePath: path.join(tmp, 'demo.sqlite'), clock: () => new Date(time) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const a = await pageFor('adult-a', 390);
  await a.locator('[name="nickname"]').fill('가상 연결 확인'); for (const name of ['adult', 'public', 'invites', 'save']) await a.locator(`[name="${name}"]`).check(); await click(a, 'onboard');
  assert.equal(await a.locator('[data-action="new-context"]').count(), 0);
  for (let i = 0; i < 16; i++) {
    const question = (await snap(a)).view.discovery.question; if (!question) break;
    if (question.optional) { await opened(a, '원할 때 질문 더 답하기'); await click(a, 'stop-questions'); break; }
    await a.locator('[data-question] .choices button').first().click(); await idle(a);
  }
  const available = (await snap(a)).view.discovery.candidates.filter(c => c.status === 'eligible'); assert.equal(available.length, 3);
  assert.equal(await a.locator('[data-candidate]').evaluateAll(nodes => nodes.filter(n => !n.closest('details:not([open])') && n.getClientRects().length).length), 1);
  assert.equal(await a.locator('[data-other-candidates]').evaluate(n => n.open), false);
  const target = available[0]; assert.equal(target.id, target.accountId); assert.match(target.demoRole, /^sample-/);
  const first = await revealCandidate(a, target.id); assert.match(await first.locator('[data-demo-role]').getAttribute('href'), new RegExp(`demo=${target.demoRole}`));
  await shot(a, 'one-recommendation-390'); report.paths.push('one primary recommendation; optional candidates collapsed; exact same account has an introduction action and role link');

  const hiddenId = available[1].id, hiddenCard = await revealCandidate(a, hiddenId);
  const feedback = hiddenCard.locator('details').filter({ has: a.locator('summary', { hasText: '이번 추천이 아쉬웠나요?' }) }); await feedback.locator(':scope > summary').click(); await feedback.locator('[name="hide-days"]').selectOption('30'); await feedback.locator('[data-action="hide-candidate"]').click(); await idle(a);
  const until30 = Date.parse((await snap(a)).view.discovery.snoozedCandidates.find(c => c.id === hiddenId).until); assert.ok(until30 - time >= 30 * 86400000 && until30 - time < 30 * 86400000 + 1000);
  assert.equal(await a.locator(`[data-candidate="${hiddenId}"]`).count(), 0);
  await click(a, 'new-context'); await a.reload(); await a.waitForFunction(() => window.synkDating?.snapshot().view);
  assert.ok((await snap(a)).view.discovery.snoozedCandidates.some(c => c.id === hiddenId));
  await click(a, 'new-context'); assert.equal((await snap(a)).view.discovery.repetition.status, 'unchanged'); await a.waitForSelector('[data-repetition="unchanged"]');
  const peer = await pageFor(available[1].demoRole, 1280); assert.deepEqual((await snap(peer)).view.discovery.snoozedCandidates, []);
  await click(a, 'nav-profile'); const hidden = await opened(a, '숨긴 후보 관리'); await shot(a, 'hidden-candidate-390'); await hidden.locator('[data-action="unhide-candidate"]').click(); await idle(a); assert.deepEqual((await snap(a)).view.discovery.snoozedCandidates, []);
  report.paths.push('explicit 30-day hide survives a new round and reload, remains private, unchanged pool is explained, own unhide restores comparison');

  const disclosure = await opened(a, '상대에게 보여줄 답'); await disclosure.locator('[name="public-availability"]').selectOption('weekend'); await disclosure.locator('[data-action="save-disclosure"]').click(); await idle(a);
  await click(a, 'nav-discover'); const connectedCard = await revealCandidate(a, target.id); await connectedCard.locator('[data-action="connect"]').click(); await idle(a);
  let pair = (await snap(a)).view.pairs[0]; assert.equal(pair.introduction.current.status, 'pending'); assert.ok(pair.view.people.some(p => p.id === target.id)); assert.equal(await a.locator('[data-action="propose"]').count(), 0);
  const pairId = pair.pairId; await click(a, 'nav-discover'); await a.waitForSelector('[data-journey-focus="introduction-waiting"]'); await click(a, 'journey-next'); assert.equal(await a.locator('[data-pair]').first().getAttribute('data-pair'), pairId);
  const partner = await pageFor(target.demoRole, 1280); await partner.waitForSelector('[data-journey-focus="introduction-response"]'); await click(partner, 'journey-next'); assert.equal((await snap(partner)).view.pairs[0].pairId, pairId); await click(partner, 'intro-accept');
  await click(a, 'refresh'); await click(a, 'nav-discover'); await a.waitForSelector('[data-journey-focus="prepare-schedule"]'); await click(a, 'journey-next');
  assert.equal(await a.locator('[data-new-schedule] [name="startsAt"]').inputValue(), ''); assert.equal(await a.locator('[data-new-schedule] [name="endsAt"]').inputValue(), ''); assert.equal(await a.locator('[data-new-schedule] [name="durationMinutes"]').inputValue(), '');
  assert.match(await a.locator('[data-schedule-preparation="ready"]').innerText(), /10월 10일/);
  await shot(a, 'same-person-public-schedule-390');
  report.paths.push('candidate role receives exactly that introduction; only explicit acceptance unlocks preparation; focus moves to same pair; published weekend produces dates with blank time and duration');

  const form = a.locator('[data-new-schedule]'); await form.locator('[name="startsAt"]').fill('2026-10-10T14:00'); assert.equal(await form.locator('[name="endsAt"]').inputValue(), ''); await form.locator('[name="durationMinutes"]').fill('45'); assert.equal(await form.locator('[name="endsAt"]').inputValue(), '2026-10-10T14:45');
  await form.locator('[name="durationMinutes"]').fill(''); assert.equal(await form.locator('[name="endsAt"]').inputValue(), ''); await form.locator('[name="startsAt"]').fill('2026-10-10T14:15'); assert.equal(await form.locator('[name="endsAt"]').inputValue(), ''); await form.locator('[name="durationMinutes"]').fill('45'); assert.equal(await form.locator('[name="endsAt"]').inputValue(), '2026-10-10T15:00');
  await form.locator('[name="endsAt"]').fill('2026-10-10T15:00'); await form.locator('[name="startsAt"]').fill('2026-10-10T14:15'); assert.equal(await form.locator('[name="endsAt"]').inputValue(), '2026-10-10T15:00');
  await form.locator('[name="durationMinutes"]').fill(''); assert.equal(await form.locator('[name="endsAt"]').inputValue(), '2026-10-10T15:00');
  await form.locator('[name="place"]').fill('직접 고른 가상 카페'); await form.locator('[data-action="propose"]').click(); await idle(a); await click(a, 'accept');
  await click(partner, 'refresh'); await click(partner, 'nav-discover'); await partner.waitForSelector('[data-journey-focus="schedule-response"]'); await click(partner, 'journey-next'); await click(partner, 'accept');
  assert.equal((await snap(partner)).view.pairs[0].view.appointments[0].status, 'confirmed'); await click(partner, 'nav-discover'); await partner.waitForSelector('[data-journey-focus="confirmed-schedule"]'); await shot(partner, 'confirmed-next-action-1280');
  await partner.setViewportSize({ width: 320, height: 900 }); await shot(partner, 'confirmed-next-action-320');
  report.paths.push('chosen duration derives end only after chosen start; manual end survives start editing; both people accept; current action shows the confirmed appointment');

  await click(a, 'nav-discover'); const hideAgain = await revealCandidate(a, hiddenId); const f = hideAgain.locator('details').filter({ has: a.locator('summary', { hasText: '이번 추천이 아쉬웠나요?' }) }); await f.locator(':scope > summary').click(); await f.locator('[name="hide-days"]').selectOption('7'); await f.locator('[data-action="hide-candidate"]').click(); await idle(a); time = Date.parse((await snap(a)).view.discovery.snoozedCandidates.find(c => c.id === hiddenId).until);
  await a.reload(); await a.waitForFunction(() => window.synkDating?.snapshot().view); assert.deepEqual((await snap(a)).view.discovery.snoozedCandidates, []); assert.ok((await snap(a)).view.discovery.candidates.some(c => c.id === hiddenId && c.status === 'eligible'));
  report.paths.push('seven-day hide expires at its original deadline and rechecks current eligibility');
  await click(a, 'nav-settings'); const safety = await opened(a, '차단·신고'); await safety.locator('[name="target"]').selectOption(target.id); await safety.locator('[data-action="block"]').click(); await idle(a);
  const blocked = await opened(a, '차단·신고'); await blocked.locator('[data-action="unblock"]').click(); await idle(a); await click(a, 'nav-inbox'); await click(a, 'intro-reopen');
  time += 8 * 86400000; await a.reload(); await a.waitForFunction(() => window.synkDating?.snapshot().view);
  const reopened = (await snap(a)).view.discovery.candidates.find(c => c.id === target.id); assert.equal(reopened.canConnect, true); assert.equal(reopened.pairId, pairId); assert.equal((await snap(a)).view.pairs.find(p => p.pairId === pairId).status, 'closed');
  const reconnect = await revealCandidate(a, target.id); await reconnect.locator('[data-action="connect"]').click(); await idle(a);
  const newPair = (await snap(a)).view.pairs.find(p => p.status === 'active'); assert.notEqual(newPair.pairId, pairId); assert.equal(newPair.introduction.current.status, 'pending'); assert.equal(newPair.introduction.accepted, false);
  assert.equal(await a.locator('[data-pair]').first().getAttribute('data-pair'), newPair.pairId);
  report.paths.push('after block removal, own reopening and waiting period, closed history does not hide a permitted new introduction; old acceptance is not restored');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.externalRequests, []); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; throw error; }
finally { await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(report, null, 2)); await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); console.log(JSON.stringify(report, null, 2)); }
