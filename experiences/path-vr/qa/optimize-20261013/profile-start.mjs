// 면접 시작 직후 메인 스레드 CPU 프로필: 어떤 함수·파일이 시간을 쓰는지, 시작 뒤 받는 파일.
// 사용: node profile-start.mjs <url> <out.json> [quality] [width] [overlayRoot]
import { chromium } from 'file:///C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs';

const [,, url, outFile, quality = '4k', vwArg = '1440', overlayRoot = ''] = process.argv;
const vw = Number(vwArg), vh = vw < 600 ? 844 : 900;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: vw < 600 ? 3 : 1, colorScheme: 'dark', locale: 'ko-KR' });
if (overlayRoot) {
  const host = new URL(url).origin;
  await ctx.route(host + '/**', async (route) => {
    const u = new URL(route.request().url());
    const file = overlayRoot + decodeURIComponent(u.pathname);
    if (fs.existsSync(file) && fs.statSync(file).isFile() && !file.endsWith('.mp4')) {
      const type = file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : /\.m?js$/.test(file) ? 'text/javascript; charset=utf-8' : file.endsWith('.json') ? 'application/json' : file.endsWith('.webp') ? 'image/webp' : file.endsWith('.jpg') ? 'image/jpeg' : file.endsWith('.woff2') ? 'font/woff2' : undefined;
      return route.fulfill({ status: 200, contentType: type, body: fs.readFileSync(file) });
    }
    return route.continue();
  });
}
await ctx.addInitScript(() => {
  window.__lt = [];
  new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__lt.push({ start: Math.round(e.startTime), dur: Math.round(e.duration) }); }).observe({ type: 'longtask', buffered: true });
});
const page = await ctx.newPage();
const after = [];
let started = false;
page.on('request', (req) => { if (started) after.push({ url: req.url().split('?')[0].split('/').slice(-2).join('/'), type: req.resourceType(), t: Date.now() }); });
await page.goto(url, { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(2500);
await page.selectOption('#quality', quality).catch(() => {});
await page.waitForTimeout(300);
const client = await ctx.newCDPSession(page);
await client.send('Profiler.enable');
await client.send('Profiler.setSamplingInterval', { interval: 200 });
await client.send('Profiler.start');
const clickAt = await page.evaluate(() => performance.now());
const t0 = Date.now(); started = true;
await page.click('#start');
await page.waitForTimeout(9000);
const { profile } = await client.send('Profiler.stop');
const lt = await page.evaluate((from) => window.__lt.filter((x) => x.start >= from).map((x) => ({ at: Math.round(x.start - from), dur: x.dur })), clickAt);
// self time per node
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const self = new Map();
const deltas = profile.timeDeltas; const samples = profile.samples;
for (let i = 0; i < samples.length; i++) { const n = byId.get(samples[i]); const dt = (deltas[i + 1] ?? 0) / 1000; const cf = n.callFrame; const key = (cf.functionName || '(anon)') + ' @ ' + (cf.url ? cf.url.split('/').slice(-2).join('/') : '') + ':' + (cf.lineNumber + 1); self.set(key, (self.get(key) || 0) + dt); }
const top = [...self].filter(([k]) => !k.startsWith('(idle)') && !k.startsWith('(program)') && !k.startsWith('(garbage')).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => ({ fn: k, ms: Math.round(v) }));
const meta = { idle: Math.round(self.get('(idle) @ :0') || 0), program: Math.round(self.get('(program) @ :0') || 0), gc: Math.round(self.get('(garbage collector) @ :0') || 0) };
// per-url totals
const byUrl = new Map();
for (const [k, v] of self) { const u = k.split(' @ ')[1].split(':')[0] || '(native)'; byUrl.set(u, (byUrl.get(u) || 0) + v); }
const urls = [...byUrl].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([u, v]) => ({ url: u, ms: Math.round(v) }));
const requests = after.map((r) => ({ ...r, t: r.t - t0 }));
const result = { quality, width: vw, longTasks: lt, meta, urls, top, requests };
fs.writeFileSync(outFile, JSON.stringify(result, null, 1));
console.log(JSON.stringify({ longTasks: lt, meta, urls: urls.slice(0, 10), top: top.slice(0, 14) }, null, 1));
console.log('requests after start:', requests.map((r) => `${r.t}ms ${r.url}`).join(' | '));
await browser.close();
