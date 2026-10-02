// Disposable fixture database only. No real SNS credentials, API calls, or company records.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createCompanyApp } from './server.mjs';

if (!process.env.SYNK_PLAYWRIGHT_MODULE || !process.env.SYNK_BROWSER_EXE) throw new Error('SYNK_PLAYWRIGHT_MODULE과 SYNK_BROWSER_EXE를 지정하세요.');
const { chromium } = await import(pathToFileURL(process.env.SYNK_PLAYWRIGHT_MODULE));
const here = dirname(fileURLToPath(import.meta.url));
const directory = await mkdtemp(join(tmpdir(), 'synk-company-hype-browser-'));
const artifacts = join(here, 'verification'), checks = [];
const at = new Date(), iso = minutes => new Date(at.getTime() + minutes * 60_000).toISOString();
let collectorCalls = 0, browser;
const app = createCompanyApp({ dataDir: directory, port: 4193, schedule: false, clock: () => at.toISOString(),
  collector: async () => { collectorCalls++; throw new Error('External collection must not run in browser fixtures.'); } });
const mark = name => checks.push(name);
try {
  await app.start();
  const admin = app.store.createUser({ name: '검증 관리자', email: 'hype-admin@example.test', role: 'admin', password: 'hype-test-password' });
  const member = app.store.createUser({ name: '검증 팀원', email: 'hype-member@example.test', role: 'member', password: 'hype-member-password' });
  const channels = [
    { id: 'hype-a', ownerIds: [admin.id], displayName: '검증 전용 SYNK LAB', canonicalUrl: 'https://youtube.com/@hypefixturea' },
    { id: 'hype-b', ownerIds: [member.id], displayName: '다른 담당자의 검증 채널', canonicalUrl: 'https://youtube.com/@hypefixtureb' },
  ].map(channel => ({ ...channel, platform: 'youtube', active: true, status: 'not-connected', createdAt: iso(-2880) }));
  channels.forEach(channel => app.store.put('channels', channel.id, channel));
  browser = await chromium.launch({ headless: true, executablePath: process.env.SYNK_BROWSER_EXE });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(), errors = [], responses = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (new URL(response.url()).pathname === '/api/hype') responses.push(response.status()); });
  // Any external asset request is a fixture bug; no SNS page is navigated here.
  await context.route('**/*', route => new URL(route.request().url()).origin === app.origin ? route.continue() : route.abort());
  const login = async (target, email, password) => {
    await target.goto(app.origin);
    await target.locator('[name="email"]').fill(email);
    await target.locator('[name="password"]').fill(password);
    await target.locator('[data-form="auth"] button[type="submit"]').click();
    await target.getByRole('heading', { name: '우리 팀의 성장을 한눈에.', exact: true }).waitFor();
  };
  await login(page, admin.email, 'hype-test-password');
  await page.getByRole('heading', { name: '다음 주인공은 우리 팀에 있어요', exact: true }).waitFor();
  assert.equal(await page.locator('.hype-card').count(), 0);
  assert.equal(app.store.all('hypeObservations').length, 0);
  mark('disconnected-empty-state-no-fabricated-performance');
  await page.locator('[data-action="hype-preview"]').click();
  await page.getByRole('heading', { name: '하이라이트는 이렇게 보여요', exact: true }).waitFor();
  await page.getByText('예시 · 실제 성과 아님', { exact: true }).waitFor();
  assert.match(await page.locator('.modal-body').innerText(), /실제 회사 실적이 아닙니다|실제 화면에는/);
  await mkdir(artifacts, { recursive: true });
  await page.screenshot({ path: join(artifacts, 'hype-preview-example.png'), fullPage: false, animations: 'disabled' });
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-action="hype-preview"]').evaluate(element => document.activeElement === element), true);
  assert.equal(app.store.all('hypeObservations').length, 0);
  mark('explicit-example-label-and-close-focus');

  for (const channel of channels) {
    const postId = channel.id + ':abcdefghijk';
    app.store.setSecret('channel:' + channel.id, { apiKey: 'FIXTURE_NOT_A_REAL_KEY', connectedBy: channel.ownerIds[0] });
    app.store.put('channels', channel.id, { ...channel, status: 'success', lastCollectedAt: iso(-1), recentStatus: 'success', recentLastCollectedAt: iso(-1) });
    app.store.put('posts', postId, { id: postId, channelId: channel.id, title: channel.id === 'hype-a' ? '검증용 · 사진 한 장으로 광고 세 컷 만들기' : '권한 분리 검증용 콘텐츠',
      externalId: 'abcdefghijk', url: 'https://www.youtube.com/watch?v=abcdefghijk', publishedAt: iso(-2880), publishedDate: iso(-2880).slice(0, 10), source: 'api:youtube' });
    // Six comparable 30-minute intervals: five +500 baselines, then +1,200.
    [1000, 1500, 2000, 2500, 3000, 3500, 4700].forEach((views, index) => {
      const id = `${postId}:${index}`;
      app.store.put('hypeObservations', id, { id, postId, channelId: channel.id, checkedAt: iso(-181 + index * 30),
        source: 'api:youtube', ownership: { known: true, ownerIds: channel.ownerIds }, views, likes: null, comments: null, shares: null, saves: null, reach: null });
    });
  }
  await page.reload();
  await page.locator('.hype-card').first().waitFor();
  const feedResponse = await context.request.get(app.origin + '/api/hype');
  assert.equal(feedResponse.status(), 200);
  const feed = await feedResponse.json();
  assert.equal(feed.items.length, 2);
  const expected = feed.items.find(item => item.channelId === 'hype-a');
  assert.equal(expected.kind, 'acceleration');
  assert.equal(expected.delta, 1200);
  assert.equal(expected.normalizedDelta, 1200);
  assert.equal(expected.ratio, 2.4);
  assert.equal(expected.evidence.intervalMinutes, 30);
  assert.equal(expected.evidence.baselineMedian, 500);
  assert.equal(expected.evidence.baselineCount, 5);
  assert.equal(expected.evidence.source, 'api:youtube');
  assert.match(expected.summary, /담당/);
  assert.equal(feed.collection.connectedChannels, 2);
  mark('actual-hype-api-fixture-2.4x-verified');
  await page.locator(`[data-action="hype-evidence"][data-id="${expected.id}"]`).click();
  await page.getByRole('heading', { name: '이 콘텐츠를 주목한 이유', exact: true }).waitFor();
  const evidence = await page.locator('.hype-detail').innerText();
  assert.match(evidence, /\+1,200/);
  assert.match(evidence, /30분 동안/);
  assert.match(evidence, /중앙값 500/);
  const original = page.getByRole('link', { name: '게시물 보러 가기', exact: false });
  assert.equal(await original.getAttribute('href'), 'https://www.youtube.com/watch?v=abcdefghijk');
  assert.equal(await original.getAttribute('target'), '_blank');
  assert.match(await original.getAttribute('rel'), /noopener/);
  assert.match(await original.getAttribute('rel'), /noreferrer/);
  await page.screenshot({ path: join(artifacts, 'hype-evidence-fixture.png'), fullPage: false, animations: 'disabled' });
  await page.keyboard.press('Escape');
  mark('evidence-real-interval-delta-baseline-and-safe-original-link');

  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, `overview ${width}px must fit`);
    if (width === 1440) await page.locator('#hype-spotlight').screenshot({ path: join(artifacts, 'hype-overview-fixture.png'), animations: 'disabled' });
    else await page.screenshot({ path: join(artifacts, `hype-mobile-${width}-fixture.png`), fullPage: true, animations: 'disabled' });
    await page.locator(`[data-action="hype-evidence"][data-id="${expected.id}"]`).click();
    await page.locator('.hype-detail').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, `evidence ${width}px must fit`);
    if (width === 390) await page.screenshot({ path: join(artifacts, 'hype-evidence-mobile-fixture.png'), fullPage: false, animations: 'disabled' });
    await page.keyboard.press('Escape');
  }
  mark('1440-390-320-responsive-overview-and-evidence');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('[data-action="scope"][data-scope="mine"]').click();
  await page.waitForFunction(() => document.querySelectorAll('.hype-card').length === 1);
  assert.match(await page.locator('.hype-card').innerText(), /검증 전용 SYNK LAB/);
  assert.doesNotMatch(await page.locator('#hype-spotlight').innerText(), /다른 담당자의 검증 채널|권한 분리 검증용 콘텐츠/);
  mark('mine-scope-highlights-no-other-owner-content');
  const memberContext = await browser.newContext(), memberPage = await memberContext.newPage();
  await login(memberPage, member.email, 'hype-member-password');
  await memberPage.locator('.hype-card').waitFor();
  for (const suffix of ['', '?scope=all', '?scope=mine']) {
    const response = await memberContext.request.get(app.origin + '/api/hype' + suffix), data = await response.json();
    assert.equal(response.status(), 200);
    assert.equal(data.items.length, 1);
    assert.equal(data.items[0].channelId, 'hype-b');
    assert.ok(!JSON.stringify(data).includes('hype-a'));
    assert.ok(!JSON.stringify(data).includes(admin.name));
  }
  mark('member-api-cannot-read-other-owner-highlights');
  assert.equal(collectorCalls, 0);
  assert.ok(responses.length >= 3 && responses.every(status => status === 200));
  assert.deepEqual(errors, []);
  mark('no-platform-calls-and-zero-console-errors');
  const report = { ok: true, fixtureOnly: true, checks, count: checks.length, consoleErrors: errors, platformCalls: collectorCalls, screenshots: artifacts };
  await writeFile(join(artifacts, 'hype-browser-result.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser?.close();
  await app.stop();
  const resolved = resolve(directory), parent = resolve(tmpdir());
  if (!resolved.startsWith(parent + '\\synk-company-hype-browser-') && !resolved.startsWith(parent + '/synk-company-hype-browser-')) throw new Error('Unexpected temporary fixture path');
  await rm(directory, { recursive: true, force: true });
}
