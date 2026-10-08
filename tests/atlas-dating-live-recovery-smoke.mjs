// Free browser checks against isolated synthetic identities and SQLite only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const out = fileURLToPath(new URL('../experiences/atlas-lab/qa/dating-live-recovery/', import.meta.url));
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-dating-live-recovery-'));
const tokenOnly = process.argv.includes('--token-boundary');
const report = { at: new Date().toISOString(), status: 'running', kind: 'synthetic-live-recovery-browser', actualUsers: 0, modelCalls: 0, externalApiCost: 0, paths: [], errors: [], externalRequests: [], screenshots: [] };
let browser;
const fixtures = [];
const snap = page => page.evaluate(() => window.synkDating.snapshot());
const idle = page => page.waitForFunction(() => !document.getElementById('content').hasAttribute('aria-busy'));
const poll = page => page.evaluate(() => window.synkDating.refreshUpdates());
async function click(page, action, scope = page) { await scope.locator(`[data-action="${action}"]`).click(); await idle(page); }
async function reveal(locator) { if (await locator.evaluate(n => n.tagName === 'DETAILS' && !n.open)) await locator.locator(':scope > summary').click(); return locator; }
async function fixture(name) {
  let time = Date.parse('2026-10-10T03:00:00.000Z');
  const server = createDatingServer({ databasePath: path.join(tmp, `${name}.sqlite`), clock: () => new Date(time) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const item = { server, origin: `http://127.0.0.1:${server.address().port}`, setTime: value => { time = Date.parse(value); } };
  fixtures.push(item); return item;
}
async function pageFor(f, role, width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 950 }, timezoneId: 'Asia/Seoul', serviceWorkers: 'block' });
  await context.route('**/*', route => { const url = new URL(route.request().url()); if (url.origin !== f.origin) { report.externalRequests.push(url.href); return route.abort(); } return route.continue(); });
  const page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', error => report.errors.push(error.message));
  page.on('dialog', dialog => dialog.accept()); // Each synthetic navigation explicitly leaves unsaved work.
  await page.goto(`${f.origin}/atlas-lab/dating.html?demo=${role}`); await page.waitForFunction(() => !!window.synkDating?.snapshot().view); await idle(page); return page;
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
async function newSchedule(page) { await click(page, 'nav-inbox'); return reveal(page.locator('[data-new-schedule]')); }
async function fill(form, { place = '전송 전 가상 장소', note = '전송 전 비공개 초안' } = {}) {
  await form.locator('[name="startsAt"]').fill('2026-10-10T14:00'); await form.locator('[name="durationMinutes"]').fill('30');
  await form.locator('[name="place"]').fill(place); await form.locator('[name="note"]').fill(note);
}
const appointment = s => s.view.pairs.at(-1).view.appointments.at(-1);
async function revisionForm(page, a) { const form = page.locator(`[data-schedule-form="${a.id}:${a.proposal.version}"]`); await reveal(form.locator('..')); return form; }
async function ownIntro(page, text) {
  await click(page, 'nav-settings'); const box = page.locator('details').filter({ has: page.locator(':scope > summary', { hasText: '내 소개 수정' }) });
  await reveal(box); const input = box.locator('[name="intro"]'); await input.fill(text); return input;
}
async function shot(page, name) {
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: horizontal overflow`);
  assert.deepEqual(await page.locator('img').evaluateAll(images => images.filter(i => !i.complete || !i.naturalWidth).map(i => i.src)), []);
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true }); report.screenshots.push(`${name}.png`);
}
async function tokenBoundaryPath() {
  const f = await fixture('token-boundary'), a = await pageFor(f, 'sample-1'); await prepare(a);
  const intro = await ownIntro(a, '만료된 추천 확인을 갱신해도 유지할 비공개 작성 내용'); await intro.focus();
  const before = await snap(a), priorRecords = before.view.experience.records.length;
  assert.equal(typeof before.view.experience.recommendationToken, 'string');
  const content = view => ({ fields: view.discovery.fields, candidates: view.discovery.candidates, topCandidateId: view.discovery.topCandidateId, criteria: view.discovery.priorities });
  f.setTime('2026-10-10T03:06:00.000Z'); await poll(a); const next = await snap(a);
  assert.equal(next.view.revision, before.view.revision); assert.deepEqual(content(next.view), content(before.view));
  assert.equal(next.hasNewResponse, false); assert.equal(await a.locator('[data-live-notice]').count(), 0);
  assert.equal(await intro.inputValue(), '만료된 추천 확인을 갱신해도 유지할 비공개 작성 내용'); assert.equal(await intro.evaluate(n => n === document.activeElement), true);
  const renewed = next.view.experience.recommendationToken !== before.view.experience.recommendationToken;
  // Navigating tabs renders the held view; it does not perform another state GET.
  await click(a, 'nav-discover'); const start = a.locator('[data-action="experience-start"]');
  const sections = start.locator('xpath=ancestor::details'); for (let i = 0; i < await sections.count(); i++) await reveal(sections.nth(i));
  const reviewResponse = a.waitForResponse(response => new URL(response.url()).pathname.endsWith('/action'));
  await click(a, 'experience-start'); const response = await reviewResponse, result = await response.json();
  report.recommendationReceiptBoundary = { elapsedMinutes: 6, tokenRenewed: renewed, ownRevisionUnchanged: next.view.revision === before.view.revision,
    hasNewResponse: next.hasNewResponse, reviewHttpStatus: response.status(), reviewErrorCode: result.error?.code || null,
    recordsAdded: (await snap(a)).view.experience.records.length - priorRecords, opaqueValuesRecorded: false };
  // Compare only the boolean. Opaque recommendation receipt values never enter logs.
  assert.equal(renewed, true, 'the unchanged production poll must accept the renewed recommendation receipt');
  assert.equal((await snap(a)).view.experience.records.length, priorRecords + 1);
  assert.doesNotMatch(await a.locator('#notice').innerText(), /기준이나 후보 정보가 바뀌었|미리보기/);
  report.paths.push('after the five-minute recommendation receipt expires, the unchanged production poll renews only the authorized receipt without changing recommendation content, own revision, focused input or response flags; the current recommendation review still saves successfully');
  await a.context().close();
}
async function idleAndBaselinePaths() {
  const f = await fixture('idle-baseline'), a = await pageFor(f, 'sample-1'), b = await pageFor(f, 'sample-3', 1280);
  await prepare(a); await connect(a, b);
  await reveal(b.locator('[data-alignment]')); await click(b, 'alignment-yes', b.locator('[data-alignment]')); await poll(a);
  assert.equal((await snap(a)).view.pairs.at(-1).alignment.partner.value, 'yes'); assert.equal((await snap(a)).hasNewResponse, false);
  await click(b, 'alignment-different', b.locator('[data-alignment]')); await poll(a);
  assert.equal((await snap(a)).view.pairs.at(-1).alignment.partner.value, 'different'); assert.equal((await snap(a)).hasNewResponse, false);
  assert.equal(await a.locator('[data-live-notice]').count(), 0);
  report.paths.push('two successive ordinary counterpart responses apply immediately when no input was edited; restoring untouched controls never creates an artificial dirty state or unnecessary response banner');

  await click(a, 'nav-profile'); const disclosure = a.locator('details').filter({ has: a.locator(':scope > summary', { hasText: '상대에게 보여줄 답 정하기' }) });
  await reveal(disclosure); assert.equal(await disclosure.locator('[name="public-self.plan"]').inputValue(), 'planned');
  await disclosure.locator('[name="public-self.plan"]').selectOption('spontaneous');
  const other = await pageFor(f, 'sample-1', 1280); await click(other, 'nav-profile');
  const remote = other.locator('details').filter({ has: other.locator(':scope > summary', { hasText: '상대에게 보여줄 답 정하기' }) });
  await reveal(remote); await remote.locator('[name="public-self.plan"]').selectOption(''); await click(other, 'save-disclosure', remote);
  await poll(a); assert.equal((await snap(a)).hasNewResponse, false); assert.equal(Object.hasOwn((await snap(a)).view.profile.values, 'self.plan'), false);
  await reveal(a.locator('details').filter({ has: a.locator(':scope > summary', { hasText: '상대에게 보여줄 답 정하기' }) }));
  assert.equal(await a.locator('[name="public-self.plan"]').inputValue(), '');
  report.paths.push('editing a public-answer draft does not restore it across a changed public baseline saved in another authenticated tab; the current authorized baseline replaces the stale draft');
  await a.context().close(); await b.context().close(); await other.context().close();
}
async function livePaths() {
  const f = await fixture('live'), a = await pageFor(f, 'sample-1'), b = await pageFor(f, 'sample-3', 1280);
  await prepare(a); await connect(a, b);
  let form = await newSchedule(a); await fill(form);
  const note = form.locator('[name="note"]'); await note.focus();
  const oldAlignment = (await snap(a)).view.pairs.at(-1).alignment;
  await reveal(b.locator('[data-alignment]')); await click(b, 'alignment-yes', b.locator('[data-alignment]'));
  await poll(a); let state = await snap(a);
  assert.equal(state.hasNewResponse, true); assert.equal(state.view.pairs.at(-1).alignment.partner.value, oldAlignment.partner.value);
  assert.equal(await note.inputValue(), '전송 전 비공개 초안'); assert.equal(await note.evaluate(n => n === document.activeElement), true);
  assert.equal(await a.locator('[data-live-notice]').count(), 1);
  await shot(a, 'ordinary-response-keeps-focused-draft-390');
  await click(a, 'live-apply'); form = await reveal(a.locator('[data-new-schedule]'));
  assert.equal((await snap(a)).view.pairs.at(-1).alignment.partner.value, 'yes');
  assert.equal((await snap(a)).hasNewResponse, false); assert.equal(await form.locator('[name="note"]').inputValue(), '전송 전 비공개 초안');
  report.paths.push('the production poll queues an ordinary counterpart alignment response while typing; the banner preserves the focused draft, and explicit apply shows the new response without sending a schedule');

  await click(a, 'propose', form); const initial = appointment(await snap(a));
  form = await revisionForm(a, initial); await form.locator('[name="place"]').fill('없어져야 할 이전 버전 초안');
  const introDraft = await ownIntro(a, '다른 연결 변경에도 유지할 내 소개 초안');
  const other = await pageFor(f, 'sample-1', 1280); await click(other, 'nav-inbox'); const remote = await revisionForm(other, initial);
  await remote.locator('[name="place"]').fill('다른 탭에서 저장한 현재 장소'); await click(other, 'propose', remote);
  await poll(a); assert.equal((await snap(a)).hasNewResponse, false);
  assert.equal(await a.locator('[name="intro"]').inputValue(), '다른 연결 변경에도 유지할 내 소개 초안');
  await click(a, 'nav-inbox'); const current = appointment(await snap(a)); assert.equal(current.proposal.version, initial.proposal.version + 1);
  form = await revisionForm(a, current); assert.equal(await form.locator('[name="place"]').inputValue(), '다른 탭에서 저장한 현재 장소');
  assert.doesNotMatch(await a.locator('body').innerText(), /없어져야 할 이전 버전 초안/);
  report.paths.push('a changed server proposal version immediately invalidates the older schedule edit while preserving an unrelated unsent own introduction');
  await other.context().close();

  await form.locator('[name="note"]').fill('소개 취소 후 복원하면 안 되는 메모');
  await click(b, 'refresh'); await click(b, 'intro-withdraw'); await poll(a);
  assert.equal((await snap(a)).view.pairs.at(-1).introduction.accepted, false);
  assert.equal(await a.locator('[data-schedule-form]').count(), 0); assert.doesNotMatch(await a.locator('body').innerText(), /소개 취소 후 복원하면 안 되는 메모/);
  report.paths.push('counterpart introduction withdrawal applies during typing and removes schedule editing authority and the invalid draft without requiring a manual refresh');

  await ownIntro(a, '공개 철회와 무관한 내 소개 초안');
  await click(b, 'nav-settings'); await b.locator('[name="public"]').uncheck(); await click(b, 'consents'); await poll(a);
  state = await snap(a); assert.equal(state.view.pairs.at(-1).status, 'closed'); assert.equal(state.view.pairs.at(-1).view, null);
  assert.equal(state.view.candidates.some(c => c.accountId === 'demo:sample-3'), false);
  assert.equal(await a.locator('[name="intro"]').inputValue(), '공개 철회와 무관한 내 소개 초안');
  await a.setViewportSize({ width: 320, height: 950 }); await shot(a, 'public-withdrawal-preserves-only-own-draft-320');
  report.paths.push('counterpart public withdrawal immediately removes the disclosed candidate and pair projection; unrelated own introduction input remains');
  await a.context().close(); await b.context().close();
}
async function recoveryPaths() {
  const f = await fixture('delivery'), a = await pageFor(f, 'sample-1'), b = await pageFor(f, 'sample-3', 1280);
  await prepare(a); await connect(a, b); let form = await newSchedule(a);
  await fill(form, { place: '응답을 잃어도 한번 저장할 장소', note: '유실 응답에도 남기는 원문' });
  await click(a, 'nav-profile'); form = await newSchedule(a);
  assert.match(await form.innerText(), /아직 상대에게 보내지 않았/);
  const actions = [], receipts = []; let mode = 'after', applied;
  const routeHandler = async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.pathname.endsWith('/receipt')) { receipts.push(url.searchParams.get('requestId')); return route.continue(); }
    if (request.method() !== 'POST') return route.continue();
    const body = request.postDataJSON(); actions.push({ body, forwarded: mode !== 'before' });
    if (mode === 'before') return route.abort('connectionreset');
    if (mode === 'after') { const result = await route.fetch(); assert.equal(result.status(), 200); applied = await result.json(); return route.abort('connectionreset'); }
    return route.continue();
  };
  await a.route('**/api/atlas-dating/{action,receipt}*', routeHandler);
  await click(a, 'propose', form); let state = await snap(a);
  assert.equal(state.hasPendingDelivery, true); assert.equal(actions.length, 1);
  assert.equal(await form.locator('[name="note"]').inputValue(), '유실 응답에도 남기는 원문'); assert.equal(await form.locator('[name="note"]').isDisabled(), true);
  assert.equal(await a.locator('[data-action="propose"]').isDisabled(), true); assert.equal(await a.locator('[data-action="nav-settings"]').isDisabled(), true);
  assert.doesNotMatch(await form.innerText(), /아직 상대에게 보내지 않았|아직 상대에게 전송하지 않았|아직 저장하지 않았/);
  report.paths.push('an uncertain schedule POST never retains a caption claiming it has not yet been sent; recovery wording acknowledges that the server may already have stored the original request');
  await shot(a, 'lost-response-keeps-draft-and-locks-mutations-390');
  mode = 'pass'; await click(a, 'delivery-check'); state = await snap(a);
  assert.equal(state.hasPendingDelivery, false); assert.equal(actions.length, 1); assert.equal(receipts.length, 1); assert.equal(receipts[0], actions[0].body.requestId);
  assert.equal(state.view.pairs.at(-1).view.appointments.length, 1); assert.equal(appointment(state).proposal.schedule.place, '응답을 잃어도 한번 저장할 장소');
  assert.equal(appointment(state).proposal.version, 1); assert.equal(state.view.revision, applied.view.revision);
  report.paths.push('aborting only the actual server-applied POST response leaves the original draft and locks further mutations; the receipt GET recovers the single stored appointment without another POST');

  form = await revisionForm(a, appointment(state)); await form.locator('[name="place"]').fill('같은 요청으로 다시 보낼 새 장소'); await form.locator('[name="note"]').fill('바꾸지 않고 다시 보낼 원문');
  mode = 'before'; await click(a, 'propose', form); assert.equal((await snap(a)).hasPendingDelivery, true); const beforeRetry = structuredClone(actions.at(-1).body);
  assert.equal(actions.at(-1).forwarded, false); mode = 'pass'; await click(a, 'delivery-check');
  assert.equal((await snap(a)).hasPendingDelivery, true); assert.match(await a.locator('#notice').innerText(), /처리 중일 수도/);
  assert.equal(actions.length, 2); assert.equal(await a.locator('[data-action="propose"]').isDisabled(), true);
  assert.equal(await a.locator('[name="place"]').inputValue(), '같은 요청으로 다시 보낼 새 장소');
  await a.setViewportSize({ width: 320, height: 950 }); await shot(a, 'missing-receipt-stays-uncertain-320');
  await click(a, 'delivery-retry'); state = await snap(a);
  assert.deepEqual(actions.at(-1).body, beforeRetry); assert.equal(actions.length, 3); assert.equal(actions.filter(action => action.forwarded).length, 2);
  assert.equal(state.hasPendingDelivery, false); assert.equal(state.view.pairs.at(-1).view.appointments.length, 1);
  assert.equal(appointment(state).proposal.version, 2); assert.equal(appointment(state).proposal.schedule.note, '바꾸지 않고 다시 보낼 원문');
  report.paths.push('aborting before delivery and receiving a missing receipt never declares the request unsaved; explicit retry sends the identical UUID, revision and body and revises the appointment exactly once');

  form = await revisionForm(a, appointment(state)); await form.locator('[name="note"]').fill('다른 계정에게 보이면 안 되는 전송 원문');
  mode = 'before'; await click(a, 'propose', form); assert.equal((await snap(a)).hasPendingDelivery, true);
  await a.unroute('**/api/atlas-dating/{action,receipt}*', routeHandler);
  await a.goto(`${f.origin}/atlas-lab/dating.html?demo=sample-3`); await a.waitForFunction(() => window.synkDating?.snapshot().view?.accountId === 'demo:sample-3'); await idle(a);
  assert.equal((await snap(a)).hasPendingDelivery, false); assert.doesNotMatch(await a.locator('body').innerText(), /다른 계정에게 보이면 안 되는 전송 원문/);
  await a.goto(`${f.origin}/atlas-lab/dating.html?demo=sample-1`); await a.waitForFunction(() => window.synkDating?.snapshot().view?.accountId === 'demo:sample-1'); await idle(a); await click(a, 'nav-inbox');
  assert.equal((await snap(a)).hasPendingDelivery, false); assert.equal(appointment(await snap(a)).proposal.schedule.note, '바꾸지 않고 다시 보낼 원문');
  report.paths.push('changing the actual demo actor URL clears memory-only pending delivery and never transfers an unsent request to another identity or silently retries it after returning');

  form = await revisionForm(a, appointment(await snap(a))); await form.locator('[name="note"]').fill('만료 즉시 지워야 하는 비공개 전송 초안');
  mode = 'before'; await a.route('**/api/atlas-dating/{action,receipt}*', routeHandler); await click(a, 'propose', form);
  assert.equal((await snap(a)).hasPendingDelivery, true); f.setTime('2026-10-11T04:00:00.000Z'); await poll(a);
  state = await snap(a); assert.equal(state.view, null); assert.equal(state.hasPendingDelivery, false); assert.equal(state.hasNewResponse, false);
  assert.equal(await a.locator('[data-schedule-form]').count(), 0); assert.equal(await a.locator('[data-delivery-notice]').count(), 0);
  assert.doesNotMatch(await a.locator('body').innerText(), /만료 즉시 지워야 하는 비공개 전송 초안|응답을 잃어도 한번 저장할 장소/);
  report.paths.push('an actual expired demo bearer receives HTTP 401 from the local service during pending delivery; polling clears the private view, drafts and recovery request instead of retaining stale private DOM');
  await a.context().close(); await b.context().close();
}
async function forbiddenRecoveryPath() {
  const f = await fixture('suspension'), a = await pageFor(f, 'sample-1'), b = await pageFor(f, 'sample-3', 1280);
  await prepare(a); await connect(a, b); const form = await newSchedule(a);
  await fill(form, { place: '정지 뒤 지워야 하는 개인 장소', note: '정지 뒤 유지하면 안 되는 미확인 원문' });
  await a.route('**/api/atlas-dating/action', route => route.abort('connectionreset'));
  await click(a, 'propose', form); assert.equal((await snap(a)).hasPendingDelivery, true);
  await click(b, 'nav-settings'); const safety = b.locator('details').filter({ has: b.locator(':scope > summary', { hasText: '차단·신고와 처리 상황' }) });
  await reveal(safety); await safety.locator('[name="target"]').selectOption('demo:sample-1');
  await safety.locator('[name="report"]').fill('합성 시험용 신고'); await click(b, 'report', safety);
  const operator = await pageFor(f, 'operator', 1280); await operator.waitForSelector('[data-action="admin-report"]');
  await operator.locator('[name="status"]').selectOption('resolved'); await operator.locator('[name="decision"]').selectOption('suspend-target');
  await click(operator, 'admin-report');
  const denied = a.waitForResponse(response => new URL(response.url()).pathname.endsWith('/receipt'));
  await click(a, 'delivery-check'); assert.equal((await denied).status(), 403);
  const state = await snap(a); assert.equal(state.view, null); assert.equal(state.hasPendingDelivery, false); assert.equal(state.hasNewResponse, false);
  assert.equal(await a.locator('[data-schedule-form]').count(), 0); assert.equal(await a.locator('[data-delivery-notice]').count(), 0);
  assert.doesNotMatch(await a.locator('body').innerText(), /정지 뒤 지워야 하는 개인 장소|정지 뒤 유지하면 안 되는 미확인 원문/);
  report.paths.push('a real synthetic operator suspension makes the pending receipt GET return HTTP 403 account-suspended; recovery clears the private view and unsent request instead of presenting a retry under revoked authority');
  await a.context().close(); await b.context().close(); await operator.context().close();
}
try {
  await fs.mkdir(out, { recursive: true }); browser = await chromium.launch({ channel: 'chrome', headless: true });
  await tokenBoundaryPath();
  if (!tokenOnly) { await idleAndBaselinePaths(); await livePaths(); await recoveryPaths(); await forbiddenRecoveryPath(); }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.externalRequests, []); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; throw error; }
finally {
  await fs.mkdir(out, { recursive: true }); await fs.writeFile(path.join(out, tokenOnly ? 'token-boundary-result.json' : 'result.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close(); for (const f of fixtures) await new Promise(resolve => f.server.close(resolve));
  const resolved = path.resolve(tmp), allowed = path.resolve(os.tmpdir()) + path.sep;
  if (!resolved.startsWith(allowed)) throw new Error('Refusing to clean an unexpected temporary directory');
  await fs.rm(resolved, { recursive: true, force: true }); console.log(JSON.stringify(report, null, 2));
}
