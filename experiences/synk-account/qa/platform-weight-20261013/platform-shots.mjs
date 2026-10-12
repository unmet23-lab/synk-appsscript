// 플랫폼 공개본(old)과 최적화본(new)을 같은 로컬 서버에서 같은 조건으로 찍는다(글꼴 다 받은 뒤).
import { chromium } from 'file:///C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs';

const out = 'platform-shots';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const views = ['', '#benefits', '#benefits/care', '#benefits/rehearsal', '#app/path', '#library', '#apps'];
for (const [tag, port] of [['old', 4411], ['new', 4412]]) {
  for (const [vw, dpr] of [[1440, 1], [390, 3]]) {
    for (const hash of views) {
      const ctx = await browser.newContext({ viewport: { width: vw, height: vw < 600 ? 844 : 900 }, deviceScaleFactor: dpr, locale: 'ko-KR', colorScheme: 'dark' });
      const page = await ctx.newPage();
      const fonts = [];
      page.on('response', (r) => { if (/\.(woff2|ttf)$/.test(r.url())) fonts.push(r.url().split('/').pop()); });
      await page.goto(`http://127.0.0.1:${port}/account/platform.html${hash}`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(800);
      const name = `${tag}-${vw}-${(hash || '#home').slice(1).replace('/', '_')}`;
      await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
      fs.writeFileSync(`${out}/${name}.fonts.txt`, [...new Set(fonts)].join('\n'));
      await ctx.close();
    }
  }
}
await browser.close();
console.log('done');
