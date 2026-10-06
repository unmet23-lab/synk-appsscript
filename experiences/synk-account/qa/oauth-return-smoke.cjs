'use strict';
// Isolated local server + fulfilled synthetic portal. No provider login, tokens or personal storage.
const fs = require('node:fs/promises'), path = require('node:path'), net = require('node:net'), os = require('node:os');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = path.join(__dirname, 'oauth-return-20261007');

async function runProduct(product) {
  const care = product === 'care', prefix = care ? 'care' : 'family';
  const { createServer } = await import(care ? '../../relationship-care/server.mjs' : '../../family-album/server.mjs');
  const reservation = net.createServer(); await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const accountConfig = { version: 1, supabaseUrl: 'https://auth.example.test', supabasePublishableKey: 'sb_publishable_fixture',
    portalUrl: 'https://id.example.test/', clients: { [product]: { clientId: 'fixture-' + product, redirectUri: base + '/' } } };
  const report = { at: new Date().toISOString(), mode: 'synthetic-portal-local-' + prefix + '-browser-return', checks: [], receivedNavigations: [],
    errors: [], blockedExternal: [], realAuthentication: false, tokenExchange: false, existingProfilesTouched: false, runtime4296Changed: false };
  const check = (name, ok, detail) => report.checks.push({ name, ok, ...(detail === undefined ? {} : { detail }) });
  let temporary;
  if (care) {
    temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-oauth-return-'));
    await fs.writeFile(path.join(temporary, 'public-config.json'), JSON.stringify(accountConfig), { mode: 0o600 });
  }
  const server = care ? createServer({ port, accountConfigPath: path.join(temporary, 'public-config.json'),
    transcriber: { status: async () => ({ available: false, reason: 'synthetic-no-audio' }), close: async () => {} } }) : createServer({ port, accountConfig });
  server.on('request', req => { if (req.headers['sec-fetch-site'] === 'cross-site') report.receivedNavigations.push({
    path: new URL(req.url, base).pathname, method: req.method, mode: req.headers['sec-fetch-mode'], destination: req.headers['sec-fetch-dest'] }); });
  await server.start(); const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const [kind, query] of [['approved-shape', 'code=synthetic-code&state=synthetic-state'], ['denied-shape', 'error=access_denied&state=synthetic-state']]) {
      const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
      const portal = 'https://id.example.test/qa-return';
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin === base) return route.continue();
        if (url.href === portal) return route.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><a id="return" href="${base}/?${query}">Synthetic ${kind} callback</a>` });
        report.blockedExternal.push({ origin: url.origin, path: url.pathname }); return route.abort();
      });
      const page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
      await page.goto(portal); const responsePromise = page.waitForResponse(response => response.url().startsWith(base + '/?'));
      await page.locator('#return').click(); const response = await responsePromise;
      const signIn = care ? '#account-signin' : '[data-notebook=signin]';
      await page.locator(signIn).waitFor({ state: 'visible' });
      if (care) await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
      check(kind + ' reaches the actual ' + prefix + ' shell', response.status() === 200 && await page.locator(signIn).isVisible());
      check(kind + ' renders without 375px overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      check(kind + ' with no pending login never exchanges a token', report.blockedExternal.length === 0);
      await fs.mkdir(out, { recursive: true }); await page.screenshot({ path: path.join(out, prefix + '-' + kind + '-375.png'), fullPage: false });
      await context.close();
    }
    check('both actual Chrome requests are cross-site GET document navigations', report.receivedNavigations.length === 2
      && report.receivedNavigations.every(value => value.path === '/' && value.method === 'GET' && value.mode === 'navigate' && value.destination === 'document'));
    check('no browser runtime errors or external provider calls', report.errors.length === 0 && report.blockedExternal.length === 0);
  } finally {
    await browser.close(); await server.stop();
    if (temporary) {
      const absolute = path.resolve(temporary), tempRoot = path.resolve(os.tmpdir());
      if (path.dirname(absolute) !== tempRoot || !path.basename(absolute).startsWith('synk-oauth-return-')) throw Error('Unsafe temporary config path');
      await fs.rm(absolute, { recursive: true, force: true });
    }
  }
  report.ok = report.checks.every(value => value.ok); report.passed = report.checks.filter(value => value.ok).length; report.total = report.checks.length;
  await fs.mkdir(out, { recursive: true }); await fs.writeFile(path.join(out, prefix + '-result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2)); if (!report.ok) process.exitCode = 1;
}

(async () => {
  const option = process.argv.slice(2);
  if (option.length > 1 || option.length && !['--product=care', '--product=family-album'].includes(option[0])) throw Error('Use --product=care or --product=family-album, or omit to run both');
  for (const product of option.length ? [option[0].slice('--product='.length)] : ['family-album', 'care']) await runProduct(product);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
