import { chromium } from 'file:///C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const [vw, hash] of [[1440, ''], [1440, '#benefits'], [390, ''], [390, '#benefits/rehearsal'], [1440, '#app/path']]) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vw < 600 ? 844 : 900 }, deviceScaleFactor: vw < 600 ? 3 : 1, locale: 'ko-KR', colorScheme: 'dark' });
  const page = await ctx.newPage();
  const errors = [], files = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
  page.on('pageerror', (e) => errors.push('pageerror ' + e.message.slice(0, 120)));
  page.on('response', (r) => { if (/\.(woff2|ttf|webp|avif|png)$/.test(r.url()) && /account\/assets/.test(r.url())) files.push(r.url().split('/').pop() + ':' + r.status()); });
  await page.goto('https://synk.im/account/platform.html' + hash, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(800);
  const fam = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  console.log(vw, hash || '(home)', '| family:', fam, '| errors:', errors.length, errors.join(' / '), '| files:', [...new Set(files)].join(', '));
  await ctx.close();
}
await browser.close();
