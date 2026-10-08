'use strict';
// Routes only an explicit static build and synthetic OAuth/CAS fixtures. Never contacts production.
const fs = require('node:fs/promises'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '../../..'), out = path.join(__dirname, 'public-web-20261007');
const target = 'https://care.example.test/care/', appOrigin = new URL(target).origin;
const config = { version: 1, supabaseUrl: 'https://auth.example.test', accountApiUrl: 'https://api.example.test',
  supabasePublishableKey: 'sb_publishable_fixture', portalUrl: 'https://id.example.test/',
  clients: { care: { clientId: 'fixture-care-public', redirectUri: target } } };
const mime = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain' };
const report = { synthetic: true, at: new Date().toISOString(), checks: [], errors: [], missing: [], unexpected: [], staticRequests: [], apiActions: [], authorization: [], realProviderCalls: false, physicalTwoDevices: false };
const check = (name, ok, detail) => { report.checks.push({ name, ok: !!ok, ...(detail ? { detail } : {}) }); assert.ok(ok, name); };

(async () => {
  const { prepareCarePublic } = await import('../../../tools/prepare-care-public.mjs'), model = await import('../model.mjs');
  const artifact = path.join(root, '.tmp', 'synk-care-public-qa-' + crypto.randomUUID());
  const built = await prepareCarePublic({ out: artifact, config, targetUrl: target });
  report.artifact = path.relative(root, artifact); report.buildFiles = built.fileCount;
  const allowed = new Set([...built.manifest.files.map(file => file.name), 'build-manifest.json']);
  const row = { revision: 0, state: null }, pending = new Map();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const cors = { 'access-control-allow-origin': appOrigin, 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,apikey,authorization,x-synk-product,x-synk-contract' };
  async function device(width) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'Asia/Seoul' });
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });
      if (url.origin === appOrigin && url.pathname.startsWith('/care/')) {
        const file = decodeURIComponent(url.pathname.slice('/care/'.length)) || 'index.html'; report.staticRequests.push(url.pathname);
        if (!allowed.has(file)) { report.missing.push(url.pathname); return route.fulfill({ status: 404, body: 'Not a public artifact' }); }
        return route.fulfill({ status: 200, contentType: mime[path.extname(file)], body: await fs.readFile(path.join(artifact, file)) });
      }
      if (url.origin === config.supabaseUrl && url.pathname === '/auth/v1/oauth/authorize') {
        const code = crypto.randomUUID(); pending.set(code, url.searchParams.get('code_challenge'));
        report.authorization.push({ clientMatches: url.searchParams.get('client_id') === config.clients.care.clientId, callbackMatches: url.searchParams.get('redirect_uri') === target, method: url.searchParams.get('code_challenge_method') });
        return route.fulfill({ status: 302, headers: { location: target + '?code=' + code + '&state=' + encodeURIComponent(url.searchParams.get('state')) } });
      }
      if ([config.supabaseUrl, config.accountApiUrl].includes(url.origin) && request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      if (url.origin === config.supabaseUrl && url.pathname === '/auth/v1/oauth/token') {
        const fields = new URLSearchParams(request.postData()), expected = pending.get(fields.get('code'));
        const actual = crypto.createHash('sha256').update(fields.get('code_verifier') || '').digest('base64url');
        if (!expected || actual !== expected || fields.get('redirect_uri') !== target || fields.get('client_id') !== config.clients.care.clientId) return json({ error: 'invalid_grant' }, 400);
        pending.delete(fields.get('code')); return json({ access_token: 'synthetic-public-owner', refresh_token: 'synthetic-refresh', expires_in: 3600 });
      }
      if (url.origin === config.accountApiUrl && url.pathname === '/functions/v1/synk-care') {
        const headers = await request.allHeaders(); assert.equal(headers['x-synk-product'], 'platform'); assert.equal(headers.authorization, 'Bearer synthetic-public-owner');
        const body = request.postDataJSON(), action = request.method() === 'GET' ? 'load' : body.action; report.apiActions.push(action);
        if (action !== 'load') {
          if (body.expected_revision !== row.revision) return json({ ok: false, error: { code: 'REVISION_CONFLICT' }, revision: row.revision }, 409);
          row.state = action === 'delete' ? null : model.importBackup(body.state); row.revision++;
        }
        return json({ ok: true, scope: 'synk-care', accountId: 'synthetic-public-owner', revision: row.revision, updatedAt: null, state: row.state });
      }
      report.unexpected.push({ origin: url.origin, path: url.pathname, method: request.method() }); return route.abort();
    });
    const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(target); await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
    return { page, context };
  }
  const synced = async page => {
    try { await page.waitForFunction(() => document.getElementById('account-status')?.textContent.includes('계정에 저장했어요'), null, { timeout: 15000 }); }
    catch (error) { report.failureView = await page.evaluate(() => ({ path: location.origin + location.pathname, text: document.body?.innerText.slice(0, 700) })); throw error; }
  };
  const confirm = page => page.locator('#confirm-dialog button[value=confirm]').click();
  const refresh = async page => { await page.locator('#account-refresh').click(); if (await page.locator('#confirm-dialog').isVisible()) await confirm(page); await synced(page); };
  async function shot(page, name) { await page.evaluate(() => document.fonts.ready); await fs.mkdir(out, { recursive: true }); await page.screenshot({ path: path.join(out, name + '.png'), fullPage: false }); }
  try {
    const a = await device(375);
    check('public web loads its local static config and enabled account entry', !await a.page.locator('#account-signin').isDisabled() && report.staticRequests.includes('/care/config.json'));
    check('public web disables local transcription before any file is selected', await a.page.locator('#transcribe-button').isDisabled() && await a.page.locator('#transcription-status').textContent().then(text => text.includes('공개 웹에서는 녹음 받아쓰기')));
    await shot(a.page, 'public-home-375');
    await a.page.locator('#account-signin').click(); await synced(a.page);
    check('public PKCE return keeps the subpath and removes code/state from URL', a.page.url() === target && report.authorization[0].clientMatches && report.authorization[0].callbackMatches && report.authorization[0].method === 'S256');
    await a.page.locator('#add-person').click(); await a.page.locator('#new-person-name').fill('QA 공개 수첩'); await a.page.locator('#person-form button[type=submit]').click(); await synced(a.page);
    check('public browser saves canonical synthetic data through the care API', row.state.people.length === 1 && row.state.people[0].name === 'QA 공개 수첩' && report.apiActions.includes('save'));
    const b = await device(320); await b.page.locator('#account-signin').click(); await synced(b.page);
    check('second isolated browser retrieves the first browser synthetic notebook', await b.page.locator('[data-person]').count() === 1 && await b.page.locator('[data-person]').first().textContent().then(text => text.includes('QA 공개 수첩')));
    await b.page.locator('[data-person]').first().click(); await b.page.locator('#edit-person').click(); await b.page.locator('#new-person-notes').fill('QA 두 번째 화면 확인'); await b.page.locator('#person-form button[type=submit]').click(); await synced(b.page);
    await refresh(a.page); await a.page.locator('[data-person]').first().click(); await a.page.locator('#edit-person').click();
    check('explicit refresh retrieves the other browser edit', await a.page.locator('#new-person-notes').inputValue() === 'QA 두 번째 화면 확인');
    await a.page.locator('#close-person-dialog').click(); await a.page.locator('#tab-conversation').click(); await a.page.locator('#input-audio-tab').click();
    check('public audio panel states playback-only and hides local-processing consent', await a.page.locator('#audio-processing-note').textContent().then(text => text.includes('서버로 보내지 않아요')) && !await a.page.locator('#audio-consent').isVisible());
    await shot(a.page, 'public-audio-limit-375');
    for (const width of [320, 375, 1440]) { await a.page.setViewportSize({ width, height: 900 }); await a.page.locator('#show-home').click(); check('public home fits ' + width + 'px', await a.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await shot(a.page, 'public-synced-' + width); }
    await a.page.locator('[data-person]').first().click(); await a.page.locator('#edit-person').click(); await a.page.locator('#delete-person').click(); await confirm(a.page); await synced(a.page); await refresh(b.page);
    check('deleting only the synthetic person is visible in the other browser', row.state.people.length === 0 && await b.page.locator('[data-person]').count() === 0);
    check('all app files remain under care and no local API or unrelated origin is requested', report.unexpected.length === 0 && report.missing.length === 0 && report.staticRequests.every(value => value.startsWith('/care/')));
    check('public browser has no runtime errors', report.errors.length === 0);
    await a.context.close(); await b.context.close(); report.ok = true;
  } finally { await browser.close(); report.staticRequests = [...new Set(report.staticRequests)]; await fs.mkdir(out, { recursive: true }); await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
