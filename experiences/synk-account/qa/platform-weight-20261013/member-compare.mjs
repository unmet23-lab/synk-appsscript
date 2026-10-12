import { chromium } from 'file:///C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const swaps = { 'teacher-cover.png': ['teacher-cover-720-png8.png', 'image/png'], 'fortune-star.avif': ['fortune-star-960-q70.avif', 'image/avif'], 'care-note.webp': ['care-note-q90.webp', 'image/webp'] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const [hash, name] of [['#benefits/rehearsal', 'teacher-cover.png'], ['#benefits/fortune', 'fortune-star.avif'], ['#benefits/care', 'care-note.webp']]) {
  for (const tag of ['orig', 'new']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'ko-KR', colorScheme: 'dark' });
    if (tag === 'new') for (const [file, [local, type]] of Object.entries(swaps)) await ctx.route(`https://synk.im/account/assets/member/${file}`, (r) => r.fulfill({ status: 200, contentType: type, body: fs.readFileSync(local) }));
    const page = await ctx.newPage();
    await page.goto('https://synk.im/account/platform.html' + hash, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const imgs = page.locator(`img[src*="${name.split('.')[0]}"]`);
    let best = null;
    for (let i = 0; i < await imgs.count(); i++) { const b = await imgs.nth(i).boundingBox(); if (b && (!best || b.width > best.width)) best = b; }
    if (best) await page.screenshot({ path: `m-${name.split('.')[0]}-${tag}.png`, clip: { x: best.x, y: best.y, width: best.width, height: best.height } });
    console.log(hash, tag, JSON.stringify(best && { w: Math.round(best.width), h: Math.round(best.height) }));
    await ctx.close();
  }
}
await browser.close();
