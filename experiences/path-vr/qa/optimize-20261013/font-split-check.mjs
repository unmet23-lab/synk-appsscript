// 글꼴 두 조각 동작 확인: 첫 화면은 화면판만, 입력에 나머지판 글자가 나오면 그때 나머지판을 받아 같은 글꼴로 그린다.
// 사용: node font-split-check.mjs <url>
import { chromium } from 'file:///C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const url = process.argv[2];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const throttle of [false, true]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
  const page = await ctx.newPage();
  if (throttle) { const cdp = await ctx.newCDPSession(page); await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 204800, uploadThroughput: 96000 }); }
  const fonts = [];
  page.on('request', (r) => { if (/\.woff2/.test(r.url())) fonts.push({ t: Date.now(), f: r.url().split('/').pop() }); });
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(throttle ? 6000 : 2500);
  const firstView = fonts.map((x) => x.f);
  // 시작 전엔 답변 칸이 숨어 있으니, 입력한 글이 화면에 나온 것처럼 글 한 줄을 붙인다.
  await page.evaluate(() => { const p = document.createElement('p'); p.id = 'probe'; p.textContent = '줘쉽꿈 뷔햇볕 쌀껍닭'; p.style.cssText = 'font-size:40px;font-weight:700;color:#fff'; document.body.prepend(p); });
  await page.waitForTimeout(throttle ? 8000 : 2500);
  const after = fonts.map((x) => x.f);
  const status = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.family.includes('PATH')).map((f) => f.status + ':' + f.unicodeRange.slice(0, 24)); });
  // 나머지판 글자가 PATH Sans로 그려졌는지: 같은 글자를 PATH Sans만으로·기본 글꼴만으로 잰 폭과 비교
  const widths = await page.evaluate(() => {
    const c = document.createElement('canvas').getContext('2d');
    const w = (font) => { c.font = font; return Math.round(c.measureText('줘쉽꿈뷔햇볕쌀껍닭').width * 10) / 10; };
    return { path: w('700 40px "PATH Sans"'), fallback: w('700 40px sans-serif'), checkRest: document.fonts.check('700 40px "PATH Sans"', '줘쉽꿈') };
  });
  console.log(throttle ? 'slow' : 'fast', JSON.stringify({ firstView, after, status, widths }));
  await ctx.close();
}
await browser.close();
