// 공개 전 확인: 실제 주소 synk.im/try/travel/을 열고 바뀐 파일만 후보로 끼워 넣는다(나머지는 실제 공개본).
// 사용: node route-check.cjs [후보 폴더] [live]  — live를 주면 끼워 넣지 않고 공개본 그대로 연다(공개 뒤 확인).
const path = require('path');
const fs = require('fs');
const { chromium } = require(require.resolve('playwright', { paths: [path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const dir = process.argv[2] || path.join(__dirname, 'candidate'), live = process.argv[3] === 'live';
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp' };
const files = new Set(); const walk = (d, rel = '') => { for (const name of fs.readdirSync(d)) { const p = path.join(d, name), r = rel ? rel + '/' + name : name; if (fs.statSync(p).isDirectory()) walk(p, r); else if (name !== 'report.json') files.add(r); } }; walk(dir);
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = {};
  const open = async (url, viewport = { width: 1280, height: 860 }) => {
    const ctx = await browser.newContext({ viewport, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
    const served = [], failed = [], errors = [], csp = [];
    if (!live) await ctx.route('https://synk.im/try/travel/**', route => {
      const u = new URL(route.request().url()); let rel = decodeURIComponent(u.pathname.replace(/^\/try\/travel\//, '')); if (rel === '') rel = 'index.html';
      if (files.has(rel)) { served.push(rel); return route.fulfill({ status: 200, contentType: types[path.extname(rel)] || 'application/octet-stream', body: fs.readFileSync(path.join(dir, rel)) }); }
      return route.continue();
    });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') { (/Content Security Policy|CSP/.test(m.text()) ? csp : errors).push(m.text().slice(0, 200)); } });
    page.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url().replace('https://synk.im', '')); });
    page.on('requestfailed', r => failed.push('실패 ' + r.url().replace('https://synk.im', '')));
    await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
    return { ctx, page, served, failed, errors, csp };
  };
  { const { ctx, page, served, failed, errors, csp } = await open('https://synk.im/try/travel/');
    await page.waitForFunction(() => !/준비하고/.test(document.querySelector('#load-status')?.textContent || ''), null, { timeout: 30000 }).catch(() => {});
    const first = { title: await page.locator('#chooser-title').textContent().catch(() => null), intents: await page.locator('[data-intent]').count(), feltLoaded: await page.evaluate(() => [...document.querySelectorAll('.intent img')].filter(i => i.complete && i.naturalWidth > 0).length) };
    await page.locator('[data-intent="tea"]').click(); await page.locator('[data-intent="art"]').click();
    await page.locator('#step-intent .button[data-step="2"]').click(); await page.waitForTimeout(500);
    const time = { range: await page.locator('#dial-range').textContent(), fit: await page.locator('#fit-text').textContent() };
    await page.locator('#make-day').click(); await page.waitForSelector('#result:not([hidden]),#empty-result:not([hidden])', { timeout: 60000 }); await page.waitForTimeout(2500);
    const result = { title: await page.locator('#result-title').textContent().catch(() => null), stories: await page.locator('.story').count(), question: await page.locator('#result-evidence [data-refine]').count(), feltInCards: await page.evaluate(() => [...document.querySelectorAll('.story img, .route-pin img')].filter(i => i.complete && i.naturalWidth > 0).length) };
    await page.locator('#result .map-open, .map-fab').first().click().catch(() => {}); await page.waitForTimeout(800);
    const map = await page.evaluate(() => ({ open: !!document.querySelector('#map-dialog')?.open, svg: !!document.querySelector('#route-map svg') }));
    report.planner = { served: [...new Set(served)].length, first, time, result, map, failed, errors, csp };
    await ctx.close(); }
  { const { ctx, page, served, failed, errors, csp } = await open('https://synk.im/try/travel/legacy.html');
    await page.waitForTimeout(1500);
    report.legacy = { served: [...new Set(served)], title: await page.title(), failed, errors, csp };
    await ctx.close(); }
  console.log(JSON.stringify(report, null, 1));
  await browser.close();
})();
