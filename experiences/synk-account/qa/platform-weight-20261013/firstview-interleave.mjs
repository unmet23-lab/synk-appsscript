// 여러 판을 번갈아 재서(측정 중 PC 부하 변화를 판마다 고르게) 첫 화면 가운데 값을 비교한다.
// 사용: node firstview-interleave.mjs <out.json> <desktop|mobile> <rounds> name=url ...
import { chromium } from 'file:///C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs';

const [,, outFile, profile = 'mobile', roundsArg = '5', ...pairs] = process.argv;
const variants = pairs.map((p) => { const i = p.indexOf('='); return { name: p.slice(0, i), url: p.slice(i + 1) }; });
const mobile = profile === 'mobile';
const net = mobile ? { offline: false, latency: 150, downloadThroughput: 1638.4 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 } : { offline: false, latency: 40, downloadThroughput: 10240 * 1024 / 8, uploadThroughput: 10240 * 1024 / 8 };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const runs = Object.fromEntries(variants.map((v) => [v.name, []]));
async function once(url) {
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile, colorScheme: 'dark', locale: 'ko-KR' });
  await ctx.addInitScript(() => {
    window.__p = { lcp: 0, fcp: 0 };
    new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__p.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
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
    return { lcp: Math.round(window.__p.lcp), fcp: Math.round(window.__p.fcp), load: Math.round(performance.getEntriesByType('navigation')[0].loadEventEnd), cssEnd: end(/(rehearsal|platform)\.css/), fontEnd: end(/(PathSans-ui|SUIT|SUIT-Variable|SYNKSans-ui)\.woff2/) };
  });
  await ctx.close();
  return { ...p, kb: Math.round(bytes / 1024) };
}
for (let round = 0; round < Number(roundsArg); round++) {
  for (const v of (round % 2 ? [...variants].reverse() : variants)) runs[v.name].push(await once(v.url));
}
await browser.close();
const median = (list, k) => { const v = list.map((r) => r[k]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
const summary = Object.fromEntries(Object.entries(runs).map(([name, list]) => [name, Object.fromEntries(['fcp', 'lcp', 'load', 'kb', 'cssEnd', 'fontEnd'].map((k) => [k, median(list, k)]))]));
fs.writeFileSync(outFile, JSON.stringify({ profile, rounds: Number(roundsArg), runs, summary }, null, 1));
console.log(JSON.stringify(summary));
for (const [name, list] of Object.entries(runs)) console.log(name, list.map((r) => `${r.fcp}/${r.lcp}`).join(' '));
