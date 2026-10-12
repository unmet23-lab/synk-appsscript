// 첫 화면 비교(같은 서버·같은 망 제한): LCP·FCP·받은 양·LCP 요소, 여러 번 재고 가운데 값.
// 사용: node firstview.mjs <url> <out.json> <desktop|mobile> [runs]
// desktop = 10Mbps·40ms, mobile = 1.6Mbps·150ms·CPU 4배 느리게(Lighthouse 기본 망 제한과 같은 값)
import { chromium } from 'file:///C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs';

const [,, url, outFile, profile = 'desktop', runsArg = '3'] = process.argv;
const mobile = profile === 'mobile';
const net = mobile ? { offline: false, latency: 150, downloadThroughput: 1638.4 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 } : { offline: false, latency: 40, downloadThroughput: 10240 * 1024 / 8, uploadThroughput: 10240 * 1024 / 8 };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const runs = [];
for (let i = 0; i < Number(runsArg); i++) {
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile, colorScheme: 'dark', locale: 'ko-KR' });
  await ctx.addInitScript(() => {
    window.__p = { lcp: 0, lcpEl: '', fcp: 0 };
    new PerformanceObserver((list) => { for (const e of list.getEntries()) { window.__p.lcp = e.startTime; window.__p.lcpEl = e.element ? (e.element.id || e.element.tagName + '.' + (e.element.className || '')) + ':' + (e.url ? e.url.split('/').pop() : 'text') : ''; } }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => { for (const e of list.getEntries()) if (e.name === 'first-contentful-paint') window.__p.fcp = e.startTime; }).observe({ type: 'paint', buffered: true });
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', net);
  if (mobile) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  let bytes = 0;
  cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; });
  await page.goto(url, { waitUntil: 'load', timeout: 180000 });
  await page.waitForTimeout(4000);
  const p = await page.evaluate(() => {
    const end = (pattern) => { const e = performance.getEntriesByType('resource').find((r) => pattern.test(r.name)); return e ? Math.round(e.responseEnd) : null; };
    return { lcp: Math.round(window.__p.lcp), fcp: Math.round(window.__p.fcp), lcpEl: window.__p.lcpEl, load: Math.round(performance.getEntriesByType('navigation')[0].loadEventEnd), cssEnd: end(/rehearsal\.css/), fontEnd: end(/(PathSans-ui|SUIT)\.woff2/) };
  });
  runs.push({ ...p, kb: Math.round(bytes / 1024) });
  await ctx.close();
}
await browser.close();
const median = (k) => { const v = runs.map((r) => r[k]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
const result = { url, profile, runs, median: { lcp: median('lcp'), fcp: median('fcp'), load: median('load'), kb: median('kb'), cssEnd: median('cssEnd'), fontEnd: median('fontEnd') } };
fs.writeFileSync(outFile, JSON.stringify(result, null, 1));
console.log(JSON.stringify({ profile, median: result.median, lcpEl: runs.map((r) => r.lcpEl) }));
