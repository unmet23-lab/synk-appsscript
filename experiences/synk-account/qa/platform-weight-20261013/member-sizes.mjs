import { chromium } from 'file:///C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const [vw, dpr] of [[1440, 1], [1920, 1], [768, 2], [390, 3]]) {
  for (const hash of ['#benefits', '#benefits/care', '#benefits/fortune', '#benefits/rehearsal', '#benefits/family']) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vw < 600 ? 844 : 900 }, deviceScaleFactor: dpr, locale: 'ko-KR', colorScheme: 'dark' });
    const page = await ctx.newPage();
    await page.goto('https://synk.im/account/platform.html' + hash, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const max = await page.evaluate((dpr) => { const out = {}; for (const i of document.images) { const n = (i.currentSrc || i.src).split('/').pop(); if (!/care-note|fortune-star|teacher-cover|studio-camera/.test(n)) continue; const r = i.getBoundingClientRect(); const need = Math.round(Math.max(r.width, r.height * (i.naturalWidth / Math.max(1, i.naturalHeight))) * dpr); out[n] = Math.max(out[n] || 0, need); } return out; }, dpr);
    console.log(vw + 'x' + dpr, hash, JSON.stringify(max));
    await ctx.close();
  }
}
await browser.close();
