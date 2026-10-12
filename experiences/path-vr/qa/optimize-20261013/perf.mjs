// 면접실 성능 측정: 첫 불러오기 용량·LCP·시작 단추 표시, 4K/720p 재생 중 놓친 프레임·긴 작업.
// 사용: node perf.mjs <url> <out.json> [quality] [width] [overlayRoot]
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
  window.__perf = { lcp: 0, longTasks: [], fcp: 0 };
  new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__perf.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__perf.longTasks.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: true });
  new PerformanceObserver((list) => { for (const e of list.getEntries()) if (e.name === 'first-contentful-paint') window.__perf.fcp = e.startTime; }).observe({ type: 'paint', buffered: true });
});
const page = await ctx.newPage();
const responses = [];
page.on('response', async (res) => {
  try { const body = await res.body(); responses.push({ url: res.url().split('?')[0], type: res.request().resourceType(), bytes: body.length, status: res.status() }); } catch {}
});
const t0 = Date.now();
await page.goto(url, { waitUntil: 'load', timeout: 90000 });
const loadMs = Date.now() - t0;
await page.waitForTimeout(3000);
const initial = await page.evaluate(() => ({ lcp: Math.round(window.__perf.lcp), fcp: Math.round(window.__perf.fcp), longTasks: window.__perf.longTasks.slice(), startTop: Math.round(document.getElementById('start').getBoundingClientRect().top), quality: document.getElementById('quality')?.value }));
const initialBytes = responses.reduce((sum, r) => sum + r.bytes, 0);
const byType = {};
for (const r of responses) byType[r.type] = (byType[r.type] || 0) + r.bytes;
const biggest = [...responses].sort((a, b) => b.bytes - a.bytes).slice(0, 8).map((r) => ({ file: r.url.split('/').slice(-2).join('/'), kb: Math.round(r.bytes / 1024) }));
// 재생 중 놓친 프레임
if (quality === '720p') { await page.selectOption('#quality', '720p'); await page.waitForTimeout(300); }
else if (quality === '4k') { await page.selectOption('#quality', '4k').catch(() => {}); await page.waitForTimeout(300); }
await page.evaluate(() => { window.__perf.longTasks = []; });
await page.click('#start');
let playback = null;
for (let i = 0; i < 90; i++) {
  await page.waitForTimeout(1000);
  const s = await page.evaluate(() => {
    const v = [...document.querySelectorAll('#film-stage video')].find((x) => !x.paused && x.style.opacity === '1');
    if (!v) return null;
    const q = v.getVideoPlaybackQuality();
    return { src: v.currentSrc.split('/').pop(), t: v.currentTime, dropped: q.droppedVideoFrames, total: q.totalVideoFrames };
  });
  if (s && s.t > 7) { playback = s; break; }
}
const during = await page.evaluate(() => ({ longTasks: window.__perf.longTasks.slice() }));
const result = { url, quality, width: vw, loadMs, initialKB: Math.round(initialBytes / 1024), byTypeKB: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, Math.round(v / 1024)])), biggest, ...initial, playback, playbackLongTasks: during.longTasks.length, playbackLongTaskMax: Math.max(0, ...during.longTasks) };
fs.writeFileSync(outFile, JSON.stringify(result, null, 1));
console.log(JSON.stringify(result));
await browser.close();
