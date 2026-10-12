// 공개본과 최적화본의 첫 화면을 같은 조건에서 찍는다(글꼴 다 받은 뒤).
// 사용: node shot-compare.mjs <outDir> <overlayRoot>
import { chromium } from 'file:///C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const [,, out = 'cmp', overlayRoot] = process.argv;
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const [tag, overlay] of [['live', null], ['new', overlayRoot]]) {
  for (const vw of [1440, 390]) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vw < 600 ? 844 : 900 }, deviceScaleFactor: vw < 600 ? 3 : 1, colorScheme: 'dark', locale: 'ko-KR' });
    if (overlay) await ctx.route('https://synk.im/path/**', async (route) => {
      const url = new URL(route.request().url());
      const file = overlay + decodeURIComponent(url.pathname);
      if (fs.existsSync(file) && fs.statSync(file).isFile() && !file.endsWith('.mp4')) return route.fulfill({ status: 200, contentType: types[path.extname(file)], body: fs.readFileSync(file) });
      return route.continue();
    });
    const page = await ctx.newPage();
    const fonts = [];
    page.on('response', (r) => { if (/\.woff2/.test(r.url())) fonts.push(r.url().split('/').pop()); });
    await page.goto('https://synk.im/path/interview/film/rehearsal.html', { waitUntil: 'networkidle', timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => ({ font: getComputedStyle(document.querySelector('h1')).fontFamily, poster: document.getElementById('reference').currentSrc.split('/').pop(), felt: document.querySelector('.poster img')?.currentSrc?.split('/').pop() || null, loaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + ':' + (f.unicodeRange.length > 40 ? f.unicodeRange.slice(0, 20) + '…' : f.unicodeRange)) }));
    await page.screenshot({ path: path.join(out, `${tag}-${vw}.png`), fullPage: true });
    console.log(tag, vw, JSON.stringify({ ...info, fonts }));
    await ctx.close();
  }
}
await browser.close();
