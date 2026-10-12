// 화질 기본값 확인: PC·휴대폰 세로·휴대폰 가로·느린 망(3G 흉내)·데이터 절약.
import { chromium } from 'file:///C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const overlay = process.argv[2];
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const cases = [
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'tablet', viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true },
  { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { name: 'phone-landscape', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true },
  { name: 'desktop-3g', viewport: { width: 1440, height: 900 }, throttle: { offline: false, latency: 300, downloadThroughput: 50000, uploadThroughput: 50000, connectionType: 'cellular3g' } },
  { name: 'desktop-savedata', viewport: { width: 1440, height: 900 }, saveData: true },
];
for (const c of cases) {
  const ctx = await browser.newContext({ viewport: c.viewport, isMobile: !!c.isMobile, hasTouch: !!c.hasTouch, deviceScaleFactor: c.isMobile ? 2 : 1, locale: 'ko-KR' });
  await ctx.route('https://synk.im/path/**', async (route) => {
    const url = new URL(route.request().url());
    const file = overlay + decodeURIComponent(url.pathname);
    if (fs.existsSync(file) && fs.statSync(file).isFile() && !file.endsWith('.mp4')) return route.fulfill({ status: 200, contentType: types[path.extname(file)], body: fs.readFileSync(file) });
    return route.continue();
  });
  if (c.saveData) await ctx.addInitScript(() => { Object.defineProperty(navigator, 'connection', { value: { saveData: true, effectiveType: '4g', downlink: 10 }, configurable: true }); });
  const page = await ctx.newPage();
  if (c.throttle) { const cdp = await ctx.newCDPSession(page); await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', c.throttle); }
  await page.goto('https://synk.im/path/interview/film/rehearsal.html', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => !document.getElementById('quality-control').hidden, null, { timeout: 120000 }).catch(() => {});
  const info = await page.evaluate(() => ({ quality: document.getElementById('quality').value, connection: navigator.connection ? { type: navigator.connection.effectiveType, downlink: navigator.connection.downlink, saveData: navigator.connection.saveData } : null, coarse: matchMedia('(pointer: coarse)').matches }));
  console.log(c.name, JSON.stringify(info));
  await ctx.close();
}
await browser.close();
