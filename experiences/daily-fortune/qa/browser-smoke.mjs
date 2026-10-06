import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { createServer } from '../server.mjs';
import { emptyState, validateState } from '../account-state.mjs';

const modulePath = process.env.PLAYWRIGHT_MODULE || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const { chromium } = await import(pathToFileURL(modulePath).href);
const syntheticApi = 'https://fortune-browser-smoke.invalid';
const config = { version: 1, supabaseUrl: syntheticApi, accountApiUrl: syntheticApi, portalUrl: 'https://portal.fortune-browser-smoke.invalid',
  supabasePublishableKey: 'sb_publishable_synthetic_fortune_browser', clients: { platform: { clientId: 'synthetic-fortune-browser', redirectUri: 'http://127.0.0.1:4299/' } } };
const server = createServer({ accountConfig: config });
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const directory = path.dirname(fileURLToPath(import.meta.url));
const report = { version: 'fortune-account-20261006', syntheticAccountsOnly: true, viewports: [], clipboard: {}, modeSwitch: {}, birthInput: {}, midnight: {}, keyboard: {}, account: {}, enrichment: {}, errors: [], externalRequests: [], nonReadRequests: [], mockedRequests: [], expectedNetworkErrors: [] };
const contexts = [];
const identities = { a: '11111111-1111-4111-8111-111111111111', b: '22222222-2222-4222-8222-222222222222' };
function mockAccount() {
  const records = { a: { revision: 0, state: emptyState() }, b: { revision: 0, state: emptyState() } };
  let gate, conflict = false, unavailable = false;
  const clone = value => structuredClone(value);
  const pending = () => { let resolve;const promise = new Promise(done => { resolve = done; });return { promise, resolve }; };
  async function route(route) {
    const request = route.request(), location = new URL(request.url());
    const cors = { 'Access-Control-Allow-Origin': url, 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const token = request.headers().authorization;
    const id = token === 'Bearer synthetic-b' ? 'b' : token === 'Bearer synthetic-a' ? 'a' : null;
    assert.ok(id, 'Only explicitly synthetic access tokens may reach the mock');
    report.mockedRequests.push({ method: request.method(), path: location.pathname, account: id });
    const json = (data, status = 200) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(data) });
    if (location.pathname === '/auth/v1/logout') return json({ ok: true });
    assert.equal(request.headers()['x-synk-product'], 'platform');
    if (location.pathname === '/functions/v1/synk-account') return json({ ok: true, account: { synk_user_id: identities[id], profile: { display_name: `합성 계정 ${id.toUpperCase()}` } } });
    assert.equal(location.pathname, '/functions/v1/synk-fortune');
    if (unavailable) return json({ ok: false, error: { code: 'FORTUNE_UNAVAILABLE' } }, 503);
    const record = records[id], currentGate = gate;
    if (currentGate && currentGate.method === request.method()) { gate = null;currentGate.arrived.resolve();await currentGate.release.promise; }
    if (request.method() === 'POST') {
      const body = request.postDataJSON();
      assert.ok(Buffer.byteLength(request.postData()) <= 65536);
      if (conflict || body.expected_revision !== record.revision) { conflict = false;return json({ ok: false, error: { code: 'REVISION_CONFLICT' }, revision: record.revision }, 409); }
      assert.ok(['save', 'delete'].includes(body.action));
      record.state = body.action === 'delete' ? emptyState() : validateState(body.state, '2026-10-06');record.revision++;
    }
    return json({ ok: true, account: { synk_user_id: identities[id] }, ...clone(record) });
  }
  return { route, records, conflict() { conflict = true; }, unavailable(value) { unavailable = value; }, delay(method = 'POST') { gate = { method, arrived: pending(), release: pending() };return gate; } };
}

async function newPage(width = 390, time = '2026-10-06T03:00:00Z', backend = null, identity = 'a') {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', timezoneId: 'America/Los_Angeles', permissions: ['clipboard-read', 'clipboard-write'] });
  contexts.push(context);
  await context.addInitScript(() => {
    window.storageWrites = 0;
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (...args) { window.storageWrites += 1; return originalSetItem.apply(this, args); };
  });
  const page = await context.newPage();
  await page.route('**/*', async route => {
    const target = new URL(route.request().url());
    if (target.origin === url) {
      if (target.pathname === '/account-config.json') return route.fulfill({ contentType: 'application/json', body: JSON.stringify(backend ? { ...config, clients: { platform: { ...config.clients.platform, redirectUri: `${url}/` } } } : { version: 1 }) });
      return route.continue();
    }
    if (target.origin === syntheticApi && backend) return backend.route(route);
    report.externalRequests.push(target.href);await route.abort('blockedbyclient');
  });
  if (backend) await page.addInitScript(id => {
    if (window.name === 'synthetic-account-seeded') return;
    sessionStorage.setItem('synk.oauth.session.fortune', JSON.stringify({ access_token: `synthetic-${id}`, refresh_token: `synthetic-refresh-${id}`, expires_at: Date.UTC(2026, 9, 7) }));
    window.name = 'synthetic-account-seeded';
  }, identity);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') { if (backend && /Failed to load resource: the server responded with a status of (409|503)/.test(message.text())) report.expectedNetworkErrors.push(message.text());else report.errors.push(message.text()); } });
  page.on('request', request => {
    if (request.url().startsWith(url) && !['GET', 'HEAD'].includes(request.method())) report.nonReadRequests.push({ method: request.method(), url: request.url() });
  });
  await page.clock.install({ time: new Date(time) });
  await page.clock.pauseAt(new Date(time));
  await page.goto(url);
  await page.waitForSelector('html[data-ready="true"]');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth));
  if (backend) await page.waitForFunction(() => document.getElementById('account-status').textContent.includes('운세 정보를 불러왔어요'));
  else await page.waitForFunction(() => document.getElementById('account-status').textContent.includes('설정 전'));
  return page;
}

async function dimensions(page, width, state) {
  const measured = await page.evaluate(() => {
    const visible = element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
    return {
      width: innerWidth, pageWidth: document.documentElement.scrollWidth,
      minButtonHeight: Math.min(...[...document.querySelectorAll('button')].filter(visible).map(button => button.getBoundingClientRect().height)),
      minTextSize: Math.min(...[...document.querySelectorAll('body *')].filter(element => visible(element) && element.textContent.trim()).map(element => parseFloat(getComputedStyle(element).fontSize))),
    };
  });
  assert.ok(measured.pageWidth <= width, `${state}: ${JSON.stringify(measured)}`);
  assert.ok(measured.minButtonHeight >= 44, `${state}: ${JSON.stringify(measured)}`);
  assert.ok(measured.minTextSize >= 11, `${state}: ${JSON.stringify(measured)}`);
  report.viewports.push({ state, ...measured });
}

async function assertInitial(page) {
  assert.equal(await page.locator('[data-mode]').count(), 2);
  assert.deepEqual(await page.locator('[data-mode]').evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-pressed'))), ['false', 'false']);
  for (const id of ['picker', 'saju-input', 'result', 'manual-copy']) assert.equal(await page.locator(`#${id}`).isVisible(), false);
}

async function western(page, sign = 'libra') {
  await page.locator('[data-mode="western"]').click();
  assert.equal(await page.locator('#saju-input').isVisible(), false);
  assert.equal(await page.locator('.sign').count(), 12);
  assert.equal(await page.locator('.sign-english').count(), 12);
  assert.equal(await page.locator('.sign-range').count(), 12);
  const labels = await page.locator('.sign').evaluateAll(buttons => buttons.map(button => button.textContent));
  assert.ok(labels.every(label => /[가-힣]/.test(label) && /[A-Za-z]/.test(label) && /\d+\.\d+–\d+\.\d+/.test(label)));
  await page.locator(`[data-sign="${sign}"]`).click();
  assert.equal(await page.locator(`[data-sign="${sign}"]`).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#saju-details').isVisible(), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'fortune-title');
}

async function saju(page, birthDate = '2000-01-07', birthTime = '10:30') {
  await page.locator('[data-mode="korean"]').click();
  assert.equal(await page.locator('#picker').isVisible(), false);
  assert.equal(await page.locator('#saju-input').isVisible(), true);
  await page.locator('#birth-date').fill(birthDate);
  if (birthTime === null) await page.locator('#time-unknown').check();
  else {
    await page.locator('#time-unknown').uncheck();
    await page.locator('#birth-time').fill(birthTime);
  }
  await page.locator('#saju-form button[type="submit"]').click();
  await page.locator('#saju-details').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#pillars article').count(), 4);
  assert.equal(await page.locator('#elements li').count(), 5);
  assert.match(await page.locator('#result-label').innerText(), /한국 사주/);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'fortune-title');
}

async function denyClipboard(page) {
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } }));
}

async function assertSajuCopy(text, page) {
  assert.match(text, /한국 사주/);
  for (const label of ['연주', '월주', '일주', '시주', '일간']) assert.ok(text.includes(label), `Missing ${label} in copied saju`);
  const pillars = await page.locator('#pillars article').evaluateAll(cards => cards.map(card => [...card.querySelectorAll('.hanja')].map(part => part.textContent).join('')));
  for (const pillar of pillars) assert.ok(text.includes(pillar), `Missing displayed pillar ${pillar} in copied saju`);
}

async function saveButton(page, backend, selector = '#save-reading', identity = 'a') {
  const revision = backend.records[identity].revision;
  await page.locator(selector).click();
  await page.waitForFunction(() => document.getElementById('notice').textContent.includes('계정에 저장했어요.'));
  await page.waitForFunction(() => !document.getElementById('save-reading').disabled);
  assert.equal(backend.records[identity].revision, revision + 1);
}

async function restorePage(page) {
  await page.reload();await page.waitForSelector('html[data-ready="true"]');
  await page.waitForFunction(() => document.getElementById('account-status').textContent.includes('운세 정보를 불러왔어요'));
}

async function accountChecks() {
  const noBirth = await newPage();
  await western(noBirth);await noBirth.locator('[data-view="week"]').click();
  assert.equal(await noBirth.locator('#week-panel').isVisible(), true);
  await noBirth.locator('[data-mode="korean"]').click();
  assert.equal(await noBirth.locator('#week-panel').isVisible(), false);
  assert.equal(await noBirth.locator('#result').isVisible(), false);
  report.enrichment.switchingToSajuWithoutBirthHidesWesternWeek = true;
  await noBirth.context().close();
  const backend = mockAccount(), page = await newPage(390, undefined, backend);
  assert.equal(await page.locator('#account-logout').isVisible(), true);
  await saju(page);
  await page.locator('#reflection-note').fill('합성 기록: 산책하고 다시 생각했어요.');
  await page.locator('#complete-action').check();
  assert.equal(backend.records.a.revision, 0, 'Typing and ticking must never auto-save');
  await saveButton(page, backend, '#save-profile');
  assert.deepEqual(backend.records.a.state.profile, { birthDate: '2000-01-07', birthTime: '10:30', calendar: 'solar', timeZone: 'Asia/Seoul' });
  assert.equal(backend.records.a.state.entries.length, 0);
  await saveButton(page, backend);
  assert.equal(backend.records.a.state.entries.length, 1);
  assert.equal(backend.records.a.state.entries[0].completed, true);
  assert.equal(backend.records.a.state.entries[0].note, '합성 기록: 산책하고 다시 생각했어요.');
  report.account.explicitProfileAndReadingSave = true;
  report.account.noAutoSave = true;
  await page.locator('#reflection-note').fill('저장 대기 중인 메모 A');
  const editGate = backend.delay();await page.locator('#save-reading').click();await editGate.arrived.promise;
  await page.locator('#reflection-note').fill('대기 중 추가한 최신 메모 B');
  editGate.release.resolve();await page.waitForFunction(() => !document.getElementById('save-reading').disabled);
  assert.equal(backend.records.a.state.entries[0].note, '저장 대기 중인 메모 A');
  assert.equal(await page.locator('#reflection-note').inputValue(), '대기 중 추가한 최신 메모 B');
  await western(page);await page.locator('[data-mode="korean"]').click();
  assert.equal(await page.locator('#reflection-note').inputValue(), '대기 중 추가한 최신 메모 B');
  await page.locator('[data-view="week"]').click();await page.locator('.week-card button').nth(2).click();
  assert.equal(await page.locator('#reflection-note').inputValue(), '');
  await page.locator('[data-view="week"]').click();await page.locator('.week-card button').nth(1).click();
  assert.equal(await page.locator('#reflection-note').inputValue(), '대기 중 추가한 최신 메모 B');
  report.account.editsDuringSaveRemainDraftAcrossModeAndDate = true;
  await page.locator('#reflection-note').fill('합성 기록: 산책하고 다시 생각했어요.');await saveButton(page, backend);

  await page.locator('#guide-title').click();
  assert.match(await page.locator('#guide-content').innerText(), /연주[\s\S]*월주[\s\S]*일주[\s\S]*시주[\s\S]*일간/);
  assert.equal(await page.locator('#guide-content article').count(), 10);
  await western(page);
  await page.locator('#zodiac-birth').fill('2000-10-06');
  await page.locator('#find-zodiac').click();
  assert.match(await page.locator('#zodiac-hint').innerText(), /천칭자리/);
  assert.equal(await page.locator('[data-sign="libra"]').getAttribute('aria-pressed'), 'true');
  assert.match(await page.locator('#guide-content').innerText(), /문화적 상징/);
  await page.locator('#reflection-note').fill('합성 기록: 오늘의 작은 행동을 기억해요.');
  await saveButton(page, backend);
  assert.equal(backend.records.a.state.entries.length, 2);
  report.enrichment.birthdaySuggestionAndBothGuides = true;

  await page.locator('[data-view="week"]').click();
  assert.equal(await page.locator('.week-card').count(), 7);
  assert.equal(await page.locator('.week-card.is-today').count(), 1);
  assert.equal(await page.locator('#week-range').innerText(), '2026-10-05 – 2026-10-11');
  await page.locator('.week-card button').nth(2).click();
  assert.match(await page.locator('#result-label').innerText(), /2026\.10\.07/);
  await page.locator('#reflection-note').fill('저장하지 않은 다음 날 메모');
  await page.locator('[data-view="week"]').click();await page.locator('.week-card button').nth(3).click();
  await page.locator('#reflection-note').fill('또 다른 날짜의 임시 메모');
  await page.locator('[data-view="week"]').click();await page.locator('.week-card button').nth(2).click();
  assert.equal(await page.locator('#reflection-note').inputValue(), '저장하지 않은 다음 날 메모');
  await page.locator('[data-mode="korean"]').click();
  await page.locator('[data-mode="western"]').click();
  assert.equal(await page.locator('#reflection-note').inputValue(), '저장하지 않은 다음 날 메모');
  report.enrichment.weekSevenDatesAndSelectDay = true;
  report.enrichment.unsavedDraftAcrossModes = true;
  report.enrichment.unsavedDraftsAreIndependentByDate = true;
  await restorePage(page);
  assert.match(await page.locator('#result-label').innerText(), /2026\.10\.06.*천칭자리/);
  assert.equal(await page.locator('#birth-date').inputValue(), '2000-01-07');
  assert.equal(await page.locator('#birth-time').inputValue(), '10:30');
  assert.equal(await page.locator('#reflection-note').inputValue(), '합성 기록: 오늘의 작은 행동을 기억해요.');
  report.account.revisitRestoresProfilePreferencesAndEntries = true;
  const browserStorage = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
  assert.deepEqual(browserStorage.local, {});
  assert.deepEqual(Object.keys(browserStorage.session), ['synk.oauth.session.fortune']);
  assert.doesNotMatch(JSON.stringify(browserStorage), /2000-01-07|산책|작은 행동|entries|birthDate/);
  report.account.storageContainsOnlySyntheticAuthTokens = true;

  await page.locator('[data-view="history"]').click();
  assert.equal(await page.locator('.history-card').count(), 2);
  await page.locator('#history-filter').selectOption('korean');
  assert.equal(await page.locator('.history-card').count(), 1);
  await page.locator('.history-card button').first().click();
  assert.equal(await page.locator('#reflection-note').inputValue(), '합성 기록: 산책하고 다시 생각했어요.');
  assert.equal(await page.locator('#complete-action').isChecked(), true);
  await page.locator('#reflection-note').fill('충돌로 저장되지 않아야 하는 합성 메모');
  const beforeConflict = structuredClone(backend.records.a);
  backend.conflict();await page.locator('#save-reading').click();
  await page.waitForFunction(() => document.getElementById('notice').textContent.includes('다른 화면에서 저장한 변경'));
  assert.deepEqual(backend.records.a, beforeConflict);
  assert.equal(await page.locator('#reflection-note').inputValue(), '충돌로 저장되지 않아야 하는 합성 메모');
  await page.locator('#account-reload').click();
  await page.waitForFunction(() => document.getElementById('notice').textContent.includes('최신 정보를 불러왔어요'));
  assert.equal(await page.locator('#reflection-note').inputValue(), '합성 기록: 오늘의 작은 행동을 기억해요.');
  report.account.conflictPreservesServerAndDraftUntilReload = true;
  backend.unavailable(true);await page.locator('#account-reload').click();
  await page.waitForFunction(() => /계정 저장을 완료하지 못했어요|계정 저장 서비스가 아직 준비되지 않았어요/.test(document.getElementById('account-status').textContent));
  assert.equal(await page.locator('#save-reading').isDisabled(), true);
  assert.equal(await page.locator('#account-reload').isDisabled(), false, 'A temporary account API failure must leave reload usable');
  backend.unavailable(false);await page.locator('#account-reload').click();
  await page.waitForFunction(() => document.getElementById('notice').textContent.includes('최신 정보를 불러왔어요'));
  report.account.unavailableBlocksSaveButAllowsRetry = true;
  await page.locator('[data-view="history"]').click();
  await page.locator('#history-filter').selectOption('western');assert.equal(await page.locator('.history-card').count(), 1);
  await page.locator('#history-filter').selectOption('completed');assert.equal(await page.locator('.history-card').count(), 1);
  await page.locator('#history-filter').selectOption('all');
  const downloadPromise = page.waitForEvent('download');await page.locator('#export-records').click();const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'synk-fortune.json');
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.deepEqual(exported.profile, backend.records.a.state.profile);
  assert.deepEqual(exported.entries, backend.records.a.state.entries);
  assert.equal(exported.entries.length, 2);assert.ok(exported.exportedAt);
  report.account.jsonExportIncludesProfileAndNotes = true;
  report.account.filtersAndReopen = true;
  // Finish the real transient notification before measuring and capturing the collection.
  await page.clock.runFor(4600);

  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await dimensions(page, width, 'signed-in-history');
    await page.screenshot({ path: path.join(directory, `account-history-${width}.png`), fullPage: true });
    if (width === 1280) {
      await page.evaluate(() => window.scrollTo(0, document.querySelector('.account-card').offsetTop - 24));
      await page.screenshot({ path: path.join(directory, 'account-collection-preview-1280.png') });
    }
    await page.locator('[data-view="today"]').click();
    await saju(page);
    if ((await page.locator('.reading-guide').getAttribute('open')) === null) await page.locator('#guide-title').click();
    await dimensions(page, width, 'signed-in-saju-guide');
    await page.screenshot({ path: path.join(directory, `account-guide-${width}.png`), fullPage: true });
    await page.locator('[data-view="week"]').click();
    await dimensions(page, width, 'signed-in-week');
    await page.screenshot({ path: path.join(directory, `account-week-${width}.png`), fullPage: true });
    await page.locator('[data-view="history"]').click();
  }
  await page.locator('.history-card').first().getByRole('button', { name: '기록 삭제', exact: true }).click();
  await page.waitForFunction(() => document.getElementById('history-count').textContent === '1');
  assert.equal(backend.records.a.state.entries.length, 1);
  await page.locator('#delete-data').click();await page.locator('#cancel-delete-data').click();
  assert.equal(backend.records.a.state.entries.length, 1);
  await page.locator('#delete-data').click();await page.locator('#confirm-delete-data').click();
  await page.waitForFunction(() => document.getElementById('notice').textContent.includes('운세 정보와 기록을 삭제했어요'));
  assert.deepEqual(backend.records.a.state, emptyState());
  assert.equal(await page.locator('#account-logout').isVisible(), true);
  assert.equal(await page.locator('#birth-date').inputValue(), '');
  await restorePage(page);assert.equal(await page.locator('#history-count').innerText(), '0');
  assert.equal(await page.locator('#birth-date').inputValue(), '');
  report.account.individualDeleteAndConfirmedWholeDeletePersist = true;
  await page.context().close();

  const isolation = mockAccount(), first = await newPage(390, undefined, isolation);
  await saju(first);await first.locator('#reflection-note').fill('A 계정만의 합성 메모');await saveButton(first, isolation);
  const second = await newPage(390, undefined, isolation, 'b');
  assert.equal(await second.locator('#history-count').innerText(), '0');
  assert.equal(await second.locator('#birth-date').inputValue(), '');
  assert.doesNotMatch(await second.locator('body').innerText(), /A 계정만의 합성 메모/);
  await first.evaluate(() => sessionStorage.setItem('synk.oauth.session.fortune', JSON.stringify({ access_token: 'synthetic-b', refresh_token: 'synthetic-refresh-b', expires_at: Date.UTC(2026, 9, 7) })));
  await restorePage(first);
  assert.equal(await first.locator('#history-count').innerText(), '0');assert.equal(await first.locator('#birth-date').inputValue(), '');
  report.account.twoAccountsNeverShareProfileOrHistory = true;
  await first.context().close();await second.context().close();

  const delayedPage = await newPage(390, undefined, isolation);
  assert.equal(await delayedPage.locator('#reflection-note').inputValue(), 'A 계정만의 합성 메모');
  await delayedPage.locator('#reflection-note').fill('로그아웃보다 늦는 합성 응답');
  const gate = isolation.delay();await delayedPage.locator('#save-reading').click();await gate.arrived.promise;
  await delayedPage.locator('#account-logout').click();
  assert.equal(await delayedPage.locator('#history-count').innerText(), '0');assert.equal(await delayedPage.locator('#birth-date').inputValue(), '');
  gate.release.resolve();
  await delayedPage.waitForFunction(() => !document.getElementById('account-login').disabled);
  assert.equal(await delayedPage.locator('#history-count').innerText(), '0');assert.equal(await delayedPage.locator('#result').isVisible(), false);
  assert.doesNotMatch(await delayedPage.locator('#notice').innerText(), /저장했어요/);
  assert.equal(await delayedPage.evaluate(() => sessionStorage.length), 0);
  await delayedPage.reload();await delayedPage.waitForFunction(() => document.getElementById('account-status').textContent.includes('로그인하면'));
  assert.equal(await delayedPage.locator('#birth-date').inputValue(), '');
  report.account.logoutFencesDelayedSaveAndRemovesSession = true;
  await delayedPage.context().close();
}

try {
  for (const width of [320, 390, 768, 1280]) {
    const page = await newPage(width);
    await assertInitial(page);
    await dimensions(page, width, 'home');
    await page.screenshot({ path: path.join(directory, `account-home-${width}.png`), fullPage: true });
    await western(page);
    assert.equal(await page.locator('#result-label').innerText(), '2026.10.06 · 별자리 운세 · 천칭자리');
    await dimensions(page, width, 'western-result');
    await page.screenshot({ path: path.join(directory, `account-western-result-${width}.png`), fullPage: true });
    if (width === 390) {
      await page.locator('#copy').click();
      await page.waitForFunction(() => document.getElementById('notice').textContent === '결과를 복사했어요.');
      const text = await page.evaluate(() => navigator.clipboard.readText());
      assert.match(text, /2026-10-06 · 별자리 운세 · 천칭자리/);
      report.clipboard.westernNative = 'passed';
    }
    await saju(page);
    assert.equal(await page.locator('#pillars .hanja').count(), 8);
    assert.equal(await page.locator('#pillars .hangul').count(), 8);
    assert.match(await page.locator('#birth-summary').innerText(), /양력 2000-01-07 · 10:30 · 한국 표준시/);
    await dimensions(page, width, 'saju-result');
    await page.screenshot({ path: path.join(directory, `account-saju-result-${width}.png`), fullPage: true });
    if (width === 390) {
      await page.locator('#copy').click();
      await page.waitForFunction(() => document.getElementById('notice').textContent === '결과를 복사했어요.');
      await assertSajuCopy(await page.evaluate(() => navigator.clipboard.readText()), page);
      report.clipboard.sajuNative = 'passed';
    }
    await page.context().close();
  }

  const page = await newPage();
  await denyClipboard(page);
  await western(page);
  await page.locator('#copy').click();
  assert.equal(await page.locator('#manual-copy').isVisible(), true);
  assert.match(await page.locator('#copy-text').inputValue(), /2026-10-06 · 별자리 운세 · 천칭자리/);
  report.clipboard.westernFallback = 'passed';
  await page.locator('[data-mode="korean"]').click();
  assert.equal(await page.locator('#result').isVisible(), false);
  assert.equal(await page.locator('#manual-copy').isVisible(), false);
  assert.equal(await page.locator('#copy-text').inputValue(), '');
  report.modeSwitch.unselectedModeHidesPreviousResult = true;
  await saju(page);
  const knownPillars = await page.locator('#pillars').innerText();
  await page.locator('#copy').click();
  await assertSajuCopy(await page.locator('#copy-text').inputValue(), page);
  report.clipboard.sajuFallback = 'passed';
  await page.locator('[data-mode="western"]').click();
  assert.equal(await page.locator('[data-sign="libra"]').getAttribute('aria-pressed'), 'true');
  assert.match(await page.locator('#result-label').innerText(), /천칭자리/);
  assert.equal(await page.locator('#manual-copy').isVisible(), false);
  await page.locator('[data-mode="korean"]').click();
  assert.equal(await page.locator('#pillars').innerText(), knownPillars);
  assert.equal(await page.locator('#birth-date').inputValue(), '2000-01-07');
  assert.equal(await page.locator('#birth-time').inputValue(), '10:30');
  assert.equal(await page.locator('#copy-text').inputValue(), '');
  report.modeSwitch.eachModeRestoresSelectionAndInput = true;
  report.modeSwitch.staleCopyCleared = true;
  await page.locator('#copy').click();
  await page.locator('#birth-time').fill('11:30');
  assert.equal(await page.locator('#result').isVisible(), false);
  assert.equal(await page.locator('#manual-copy').isVisible(), false);
  assert.equal(await page.locator('#copy-text').inputValue(), '');
  report.birthInput.editInvalidatesPreviousResultAndCopy = true;

  await saju(page, '2000-01-07', null);
  assert.equal(await page.locator('#birth-time').isDisabled(), true);
  assert.equal(await page.locator('#birth-time').getAttribute('required'), null);
  assert.match(await page.locator('[data-pillar="hour"]').innerText(), /—[\s\S]*시각 확인 필요/);
  assert.equal(await page.locator('#pillars .hangul').count(), 6);
  await page.screenshot({ path: path.join(directory, 'account-time-unknown-390.png'), fullPage: true });
  report.birthInput.unknownTimeLeavesHourEmpty = true;
  await saju(page, '2024-02-04', null);
  for (const pillar of ['year', 'month', 'hour']) assert.match(await page.locator(`[data-pillar="${pillar}"]`).innerText(), /시각 확인 필요/);
  assert.equal(await page.locator('[data-pillar="day"] .hangul').count(), 2);
  assert.match(await page.locator('#saju-notes').innerText(), /입춘|절기|절입/);
  await page.screenshot({ path: path.join(directory, 'account-boundary-unknown-390.png'), fullPage: true });
  report.birthInput.unknownTimeBoundaryWithholdsUncertainPillars = true;
  await page.locator('#birth-date').fill('2026-10-07');
  assert.equal(await page.locator('#birth-date').evaluate(input => input.validity.rangeOverflow), true);
  await page.locator('#saju-form button[type="submit"]').click();
  assert.equal(await page.locator('#result').isVisible(), false);
  report.birthInput.futureDateBlocked = true;
  await page.locator('#birth-date').fill('1899-12-31');
  assert.equal(await page.locator('#birth-date').evaluate(input => input.validity.rangeUnderflow), true);
  await page.locator('#saju-form button[type="submit"]').click();
  assert.equal(await page.locator('#result').isVisible(), false);
  report.birthInput.before1900Blocked = true;

  await western(page);
  const signs = await page.locator('.sign').evaluateAll(buttons => buttons.map(button => ({ id: button.dataset.sign, label: button.querySelector('.sign-label').textContent })));
  for (const sign of signs) {
    await page.locator(`[data-sign="${sign.id}"]`).click();
    assert.equal(await page.locator('.sign[aria-pressed="true"]').count(), 1);
    assert.ok((await page.locator('#result-label').innerText()).includes(sign.label));
    for (const field of ['fortune-title', 'overall', 'relationship', 'focus', 'action', 'color', 'number']) assert.ok((await page.locator(`#${field}`).innerText()).length > 0);
  }
  report.allWesternSigns = signs.length;
  await page.locator('#change').click();
  assert.equal(await page.evaluate(() => document.activeElement.dataset.sign), 'pisces');

  await saju(page);
  for (const resolution of ['resolve', 'reject']) {
    await page.locator('[data-mode="korean"]').click();
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => new Promise((resolve, reject) => { window.clipboardResolve = resolve; window.clipboardReject = reject; }) } }));
    await page.locator('#copy').click();
    await page.locator('[data-mode="western"]').click();
    await page.evaluate(method => window[method === 'resolve' ? 'clipboardResolve' : 'clipboardReject'](), resolution);
    assert.equal(await page.locator('#notice').innerText(), '');
    assert.equal(await page.locator('#manual-copy').isVisible(), false);
    assert.equal(await page.locator('#copy-text').inputValue(), '');
    report.clipboard[`late${resolution === 'resolve' ? 'Success' : 'Failure'}AfterModeChange`] = 'passed';
  }
  await page.locator('#clear-input').click();
  await assertInitial(page);
  assert.equal(await page.locator('#birth-date').inputValue(), '');
  assert.equal(await page.locator('#birth-time').inputValue(), '');
  assert.equal(await page.locator('#time-unknown').isChecked(), false);
  assert.equal(await page.locator('#birth-time').isDisabled(), false);
  assert.equal(await page.locator('#pillars article').count(), 0);
  assert.equal(await page.locator('#birth-summary').innerText(), '');
  assert.equal(await page.locator('#copy-text').inputValue(), '');
  await page.locator('[data-mode="western"]').click();
  assert.equal(await page.locator('.sign[aria-pressed="true"]').count(), 0);
  assert.equal(await page.locator('#result').isVisible(), false);
  await page.locator('[data-mode="korean"]').click();
  assert.equal(await page.locator('#result').isVisible(), false);
  report.clearInputAndResults = 'passed';
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  assert.equal(await page.evaluate(() => window.storageWrites), 0);
  assert.equal((await page.context().cookies()).length, 0);
  report.guestStorageWrites = await page.evaluate(() => window.storageWrites);
  report.guestCookies = 0;
  await page.reload();
  await page.waitForSelector('html[data-ready="true"]');
  await assertInitial(page);
  assert.equal(await page.locator('#birth-date').inputValue(), '');
  assert.equal(await page.locator('#birth-time').inputValue(), '');
  report.reloadStartsEmpty = true;
  await page.context().close();

  const keyboardPage = await newPage();
  await keyboardPage.keyboard.press('Tab');
  assert.equal(await keyboardPage.evaluate(() => document.activeElement.className), 'skip');
  await keyboardPage.locator('[data-mode=western]').focus();
  assert.equal(await keyboardPage.evaluate(() => document.activeElement.dataset.mode), 'western');
  await keyboardPage.keyboard.press('Enter');
  assert.equal(await keyboardPage.evaluate(() => document.activeElement.id), 'choose-title');
  await keyboardPage.locator('[data-sign=aries]').focus();
  assert.equal(await keyboardPage.evaluate(() => document.activeElement.dataset.sign), 'aries');
  await keyboardPage.keyboard.press('Space');
  assert.equal(await keyboardPage.evaluate(() => document.activeElement.id), 'fortune-title');
  await keyboardPage.locator('#change').click();
  assert.equal(await keyboardPage.evaluate(() => document.activeElement.dataset.sign), 'aries');
  await keyboardPage.locator('[data-mode="korean"]').focus();
  await keyboardPage.keyboard.press('Space');
  assert.equal(await keyboardPage.evaluate(() => document.activeElement.id), 'saju-title');
  await keyboardPage.keyboard.press('Tab');
  assert.equal(await keyboardPage.evaluate(() => document.activeElement.id), 'birth-date');
  await keyboardPage.locator('#birth-date').fill('2000-01-07');
  await keyboardPage.locator('#birth-time').fill('10:30');
  await keyboardPage.locator('#saju-form button[type="submit"]').focus();
  await keyboardPage.keyboard.press('Enter');
  assert.equal(await keyboardPage.evaluate(() => document.activeElement.id), 'fortune-title');
  await keyboardPage.locator('#change').click();
  assert.equal(await keyboardPage.evaluate(() => document.activeElement.id), 'birth-date');
  report.keyboard = { modeEnterAndSpace: true, signSpace: true, sajuSubmitEnter: true, resultTitleFocus: true, returnToSelectedSignOrBirth: true };
  await keyboardPage.context().close();

  for (const mode of ['western', 'korean']) {
    const midnightPage = await newPage(390, '2026-10-06T14:59:58Z');
    await denyClipboard(midnightPage);
    if (mode === 'western') await western(midnightPage);
    else await saju(midnightPage);
    await midnightPage.locator('#copy').click();
    assert.equal(await midnightPage.locator('#manual-copy').isVisible(), true);
    const oldTitle = await midnightPage.locator('#fortune-title').innerText();
    const oldPillars = mode === 'korean' ? await midnightPage.locator('#pillars').innerText() : null;
    await midnightPage.clock.runFor(2200);
    assert.match(await midnightPage.locator('#result-label').innerText(), /2026\.10\.07/);
    if (mode === 'western') assert.notEqual(await midnightPage.locator('#fortune-title').innerText(), oldTitle);
    else assert.equal(await midnightPage.locator('#pillars').innerText(), oldPillars);
    assert.equal(await midnightPage.locator('#manual-copy').isVisible(), false);
    assert.equal(await midnightPage.locator('#copy-text').inputValue(), '');
    await midnightPage.locator('#copy').click();
    assert.match(await midnightPage.locator('#copy-text').inputValue(), /2026-10-07/);
    report.midnight[mode] = { timezone: 'America/Los_Angeles', oldDay: '2026-10-06', newDay: '2026-10-07', inputPreserved: true, westernTitleChanged: mode === 'western', birthPillarsUnchanged: mode === 'korean', staleCopyHidden: true, freshCopyDate: true };
    await midnightPage.context().close();
  }

  await accountChecks();
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.externalRequests, []);
  assert.deepEqual(report.nonReadRequests, []);
  await writeFile(path.join(directory, 'account-browser-smoke.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  for (const context of contexts) await context.close().catch(() => {});
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
