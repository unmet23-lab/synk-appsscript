// Actual public WORLD account page and JS; only account/style.css and its
// stylesheet version token in account/client.html are replaced.
// All account-project requests are synthetic; no credentials or real writes.
// node experiences/synk-account/qa/study-town-style-20261028/check.mjs <playwright module directory> [candidate directory] [live]
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { emptyPlayState, PLAY_SCOPE } from '../../../play-common/play-data.mjs';
import wardrobe from '../../src/generated/wardrobe-client.cjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const [playwrightDir, outputArg, mode = 'candidate'] = process.argv.slice(2);
assert.ok(playwrightDir, 'pass the existing Playwright module directory');
assert.ok(['candidate', 'live'].includes(mode), 'mode must be candidate or live');
const out = path.resolve(outputArg || path.join(root, '.tmp/study-town-style-20261028'));
const manifest = JSON.parse(fs.readFileSync(path.join(out, 'candidate.json'), 'utf8'));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const base = fs.readFileSync(path.join(out, 'account__style.before.css'));
const candidate = fs.readFileSync(path.join(out, 'account__style.css'));
const htmlBase = fs.readFileSync(path.join(out, 'account__client.before.html'));
const htmlCandidate = fs.readFileSync(path.join(out, 'account__client.html'));
assert.equal(sha(base), manifest.baseSha256);
assert.equal(sha(candidate), manifest.candidateSha256);
assert.equal(sha(htmlBase), manifest.html.baseSha256);
assert.equal(sha(htmlCandidate), manifest.html.candidateSha256);
assert.deepEqual(candidate.subarray(0, base.length), base);
const { chromium } = createRequire(import.meta.url)(path.resolve(playwrightDir));
const project = 'https://qiwxeddwwnzkwalpsuty.supabase.co';
const USER = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'member-a@synthetic.test' };
const CORS = { 'Access-Control-Allow-Origin': 'https://synk.im', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Expose-Headers': '*', 'x-supabase-api-version': '2024-01-01' };
const records = state => state === 'new' ? { available: true, started: false } : {
  available: true, started: true, revision: 7, sections: [
    { id: 'known', title: '주민이 아는 나', empty: '주민이 기억하는, 같이 한 일이 아직 없어요.', rows: [
      { text: '찻집 주인 · 찻집 일 — 같이 했어요', action: { type: 'MEMORY_FORGET', payload: { npc: 'cafe-owner', eventId: '20749.tea-order' }, label: '잊어 주세요' } },
      { text: '연구원 · 관찰 카드가 날려요 — 같이 했어요', action: { type: 'MEMORY_FORGET', payload: { npc: 'researcher', eventId: '20748.R1' }, label: '잊어 주세요' } }] },
    { id: 'settings', title: '마을이 맞춰 둔 것', rows: [
      { text: '내가 자주 오는 때에 맞춰 마을 자리를 채워요', action: { type: 'PREF_VISIT_BANDS', payload: { on: false }, label: '끄기' } },
      { text: '요즘 자주 한 생활 · 찻집 생활', action: { type: 'OBSERVED_CORRECT', payload: { family: 'cafe-life' }, label: '그때만 한 거예요' } },
      { text: '먼저 보여 줄 생활 · 찻집 생활' },
      { text: '내가 남긴 응답 · 찻집 주문 · 좋았어요', action: { type: 'FEEDBACK_REMOVE', payload: { eventId: 'E-5' }, label: '응답 지우기' } }], note: '단추가 없는 줄은 마을 안 이웃 수첩에서 바꿀 수 있어요.' },
    { id: 'familiar', title: '익숙한 생활', rows: [{ text: '쟁반이 기울어요' }, { text: '찻집 주인과 차를 골라요' }], note: '본 것 기록을 비우면 모두 다시 새 이야기로 보여요.',
      actions: [{ type: 'SEEN_CLEAR', payload: {}, label: '본 것 기록 비우기', confirm: '본 것 기록을 비울까요? 모두 다시 새 이야기로 보여요.' }] },
    { id: 'clear', title: '맞춤 기록 모두 비우기', lines: ['주민이 아는 나는 그대로 두고, 마을이 맞춰 둔 것과 익숙한 생활을 비워요.'],
      actions: [{ type: 'MEMORY_CLEAR', payload: {}, label: '비우기', confirm: '맞춤 기록을 모두 비울까요? 되돌릴 수 없어요.' }] },
  ],
};
const account = { ok: true, account: { synk_user_id: USER.id, status: 'active', profile: { display_name: '합성 회원 A' }, profile_revision: 1, providers: ['email'] }, memberships: [], entitlements: [], learning: { enabled: false, revision: 1 }, capabilities: { learningSync: true }, sessions: [{ id: 'a-current', product: 'world', label: '', current: true, revoked: false, last_seen: '2026-10-28T00:00:00Z' }], dataRequests: [] };
const results = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const cases = mode === 'live' ? [['live', 390, 'entered'], ['live', 1440, 'entered']] : [
    ['before', 390, 'entered'], ['after', 390, 'entered'], ['before', 1440, 'entered'], ['after', 1440, 'entered'], ['after', 390, 'new'], ['after', 390, 'fail'],
  ];
  for (const [phase, width, state] of cases) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' });
    const requests = [], violations = [], errors = [], failed = [], badResponses = [], cssDigests = [], htmlDigests = [], scriptDigests = [];
    let cssOverrides = 0, htmlOverrides = 0;
    await context.addInitScript(() => { if (location.origin === 'https://synk.im') sessionStorage.setItem('synk.oauth.session.world', JSON.stringify({ access_token: 'synthetic-world-access', refresh_token: 'synthetic-world-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600 })); });
    await context.route('**/*', async route => {
      const req = route.request(), u = new URL(req.url()), method = req.method();
      if (u.origin === project) {
        const headers = await req.allHeaders();
        requests.push({ method, path: u.pathname, view: u.searchParams.get('view'), product: headers['x-synk-product'] || null });
        if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
        const json = (status, body) => route.fulfill({ status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (u.pathname === '/auth/v1/settings') return json(200, { external: { email: true, google: true }, disable_signup: false });
        if (u.pathname === '/auth/v1/user') return json(200, { ...USER, aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [] });
        if (u.pathname === '/functions/v1/synk-classroom/api/classes' && method === 'GET') return json(200, { ok: true, classes: [] });
        if (u.pathname === '/functions/v1/synk-wardrobe' && method === 'GET') return json(200, { ok: true, wardrobe: wardrobe.starterWardrobe(), progress: { completedActivities: 0, learningConnected: false, nextMilestone: null } });
        if (u.pathname === '/functions/v1/synk-play' && method === 'GET') return json(200, { ok: true, scope: PLAY_SCOPE, accountId: USER.id, revision: 0, state: emptyPlayState() });
        if (u.pathname === '/functions/v1/synk-town/records' && method === 'GET') return json(state === 'fail' ? 503 : 200, state === 'fail' ? { ok: false, error: { code: 'TOWN_UNAVAILABLE', message: 'synthetic outage' } } : { ok: true, scope: 'synk-town-records', accountId: USER.id, records: records(state) });
        if (u.pathname === '/functions/v1/synk-account' && method === 'GET') {
          if (u.searchParams.get('view') === 'registration') return json(200, { ok: true, registration: { required: false, completed: true, phoneVerificationRequired: false } });
          if (u.searchParams.get('view') === 'atlas') return json(200, { ok: true, shared: 'declared-only', learning: account.learning, summary: { reasons: ['travel'], presentation: null, practice: { answered: 6, independent: 2, assisted: 4, skills: [] }, forReasons: [] } });
          return json(200, account);
        }
        violations.push(`${method} ${u.pathname}`);
        return json(404, { ok: false, error: { code: 'NOT_IN_THIS_CHECK' } });
      }
      if (u.origin === 'https://synk.im' && ['GET', 'HEAD'].includes(method)) {
        if (u.pathname === '/account/client.html' && phase !== 'live') {
          htmlOverrides++;
          return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: phase === 'before' ? htmlBase : htmlCandidate });
        }
        if (u.pathname === '/account/style.css' && phase !== 'live') {
          cssOverrides++;
          return route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: phase === 'before' ? base : candidate });
        }
        return route.continue();
      }
      violations.push(`${method} ${u.origin}${u.pathname}`);
      return route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', request => failed.push({ url: request.url().split('?')[0], error: request.failure()?.errorText }));
    page.on('response', response => {
      const u = new URL(response.url());
      if (response.status() >= 400) badResponses.push({ status: response.status(), url: `${u.origin}${u.pathname}` });
      if (u.origin === 'https://synk.im' && u.pathname === '/account/style.css') cssDigests.push(response.body().then(sha));
      if (u.origin === 'https://synk.im' && u.pathname === '/account/client.html') htmlDigests.push(response.body().then(sha));
      if (u.origin === 'https://synk.im' && u.pathname === '/account/dist/client.js') scriptDigests.push(response.body().then(sha));
    });
    await page.goto('https://synk.im/account/client.html?product=world&probe=study-town-style-20261028', { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForSelector('#account:not([hidden]) .town-card .town-records:not([data-phase=loading])', { timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);
    const card = page.locator('#account .town-card');
    await card.scrollIntoViewIfNeeded();
    const metrics = await card.evaluate(element => {
      const content = element.querySelector('.town-records'), row = element.querySelector('.town-records-row'), rows = element.querySelector('.town-records-rows'), section = element.querySelector('.town-records-section');
      const style = node => node ? getComputedStyle(node) : null;
      return { phase: content.dataset.phase, display: style(content).display, gap: style(content).gap, rowDisplay: style(row)?.display, rowColumns: style(row)?.gridTemplateColumns, listStyle: style(rows)?.listStyleType, sectionPadding: style(section)?.paddingTop,
        overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth), innerWidth, visualWidth: visualViewport.width,
        cardOverflow: Math.max(0, element.scrollWidth - element.clientWidth), cardWidth: element.getBoundingClientRect().width,
        buttons: [...element.querySelectorAll('button')].map(button => ({ label: button.textContent.trim(), width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })),
        text: element.textContent.trim(), messageBackground: style(element.querySelector('.town-records-message'))?.backgroundColor };
    });
    const screenshot = `${phase}-${state}-${width}`;
    await card.screenshot({ path: path.join(out, `${screenshot}-card.png`) });
    await page.screenshot({ path: path.join(out, `${screenshot}-page.png`), fullPage: true });
    const digests = await Promise.all(cssDigests);
    const htmlHashes = await Promise.all(htmlDigests), scriptHashes = await Promise.all(scriptDigests);
    const baseline = phase === 'before';
    const expectedError = state === 'fail' ? errors.filter(error => /status of 503/.test(error)) : [];
    const unexpectedErrors = errors.filter(error => !expectedError.includes(error));
    const unexpectedResponses = badResponses.filter(response => !(state === 'fail' && response.status === 503 && response.url === `${project}/functions/v1/synk-town/records`));
    const checks = {
      cssHash: digests.length === 1 && digests[0] === (baseline ? manifest.baseSha256 : manifest.candidateSha256),
      cssOverridesOnly: cssOverrides === (phase === 'live' ? 0 : 1),
      htmlHash: htmlHashes.length === 1 && htmlHashes[0] === (baseline ? manifest.html.baseSha256 : manifest.html.candidateSha256),
      htmlTokenOnly: htmlOverrides === (phase === 'live' ? 0 : 1),
      samePublicScript: scriptHashes.length === 1 && (!results.length || scriptHashes[0] === results[0].publicClientSha256),
      syntheticReadOnly: violations.length === 0 && requests.every(request => ['GET', 'OPTIONS'].includes(request.method)),
      worldProduct: requests.some(request => request.path.endsWith('/synk-town/records') && request.product === 'world'),
      noUnexpectedErrors: !unexpectedErrors.length && !failed.length && !unexpectedResponses.length,
      noOverflow: metrics.overflow === 0 && metrics.cardOverflow <= 1 && metrics.innerWidth <= metrics.visualWidth + 1,
      layout: baseline ? metrics.display !== 'grid' : metrics.display === 'grid' && metrics.gap === '16px',
      stateMatches: metrics.phase === ({ entered: 'ready', new: 'empty', fail: 'failed' })[state],
      rows: state !== 'entered' || baseline || (metrics.rowDisplay === 'grid' && metrics.listStyle === 'none' && metrics.sectionPadding === '14px' && metrics.rowColumns.split(' ').length === (width > 700 ? 2 : 1)),
      buttonSize: baseline || metrics.buttons.every(button => button.width >= 44 && button.height >= 44),
      message: state !== 'fail' || (metrics.text.includes('마을 기록을 불러오지 못했어요. 계정은 그대로 쓸 수 있어요.') && metrics.buttons.some(button => button.label === '다시 불러오기') && expectedError.length === 1 && badResponses.length === 1),
    };
    const result = { phase, width, state, ok: Object.values(checks).every(Boolean), checks, metrics, cssSha256: digests, htmlSha256: htmlHashes, publicClientSha256: scriptHashes[0], cssOverrides, htmlOverrides, requests, violations, errors, failed, badResponses, screenshot: `${screenshot}-card.png` };
    results.push(result);
    console.log(JSON.stringify({ phase, width, state, ok: result.ok, checks, errors, violations, failed }));
    await context.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(out, `${mode}-report.json`), JSON.stringify({ checkedAt: new Date().toISOString(), mode, publicBaseSha256: manifest.baseSha256, candidateSha256: manifest.candidateSha256, ok: results.length === (mode === 'live' ? 2 : 6) && results.every(result => result.ok), results }, null, 2) + '\n');
}
if (results.some(result => !result.ok)) process.exitCode = 1;
