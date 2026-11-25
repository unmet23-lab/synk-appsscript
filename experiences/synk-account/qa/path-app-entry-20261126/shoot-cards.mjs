// 공개된 PATH 앱(synk.im/path/app/) 첫 화면의 「줄에 매단 카드 세 장」을 배경 없이 떠서 플랫폼의 PATH 그림으로 쓴다(2026-11-26).
//   node shoot-cards.mjs <출력 png>
// 앱의 마크업 그대로 찍고, 무대의 바탕만 투명하게 한다. 카드는 고르기 전 상태다.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = process.argv[2];
if (!out) { console.error('쓰기: node shoot-cards.mjs <출력 png>'); process.exit(2); }
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ bypassCSP: true, viewport: { width: 600, height: 1300 }, deviceScaleFactor: 3, reducedMotion: 'reduce' });
const page = await context.newPage(); 
await page.goto('https://synk.im/path/app/', { waitUntil: 'networkidle' });
await page.waitForSelector('.ob-stage .hang', { state: 'attached' });
await page.waitForTimeout(1500);
await page.addStyleTag({ content: 'html,body,.ob,.ob-stage{background:transparent!important}.ob-stage::before,.ob-stage::after{display:none!important}' });
const box = await page.evaluate(() => {
  const els = [...document.querySelectorAll('.ob-stage .hang, .ob-stage .rod')];
  const r = els.map(e => e.getBoundingClientRect()).filter(b => b.width);
  const hangs = [...document.querySelectorAll('.ob-stage .hang *')].map(e => e.getBoundingClientRect()).filter(b => b.width);
  const x0 = Math.min(...hangs.map(b => b.left)) - 24, x1 = Math.max(...hangs.map(b => b.right)) + 24;
  const y0 = Math.min(...r.map(b => b.top)) - 4, y1 = Math.max(...hangs.map(b => b.bottom)) + 40;
  return { x: x0, y: y0 + scrollY, width: x1 - x0, height: y1 - y0 };
});
await page.screenshot({ path: out, clip: box, omitBackground: true, fullPage: true });
console.log(JSON.stringify(box));
await browser.close();
