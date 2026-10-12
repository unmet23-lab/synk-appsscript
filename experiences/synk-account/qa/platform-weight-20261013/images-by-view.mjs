import { chromium } from 'file:///C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const hash of ['', '#benefits', '#benefits/care', '#apps', '#library']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', colorScheme: 'dark' });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page); await cdp.send('Network.enable');
  const urls = new Map(), sizes = new Map();
  cdp.on('Network.responseReceived', (e) => urls.set(e.requestId, e.response.url));
  cdp.on('Network.loadingFinished', (e) => sizes.set(e.requestId, e.encodedDataLength));
  await page.goto('https://synk.im/account/platform.html' + hash, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const rows = [...sizes].map(([id, n]) => ({ u: (urls.get(id) || '').split('?')[0].split('/').slice(-2).join('/'), kb: Math.round(n / 1024) })).filter((r) => /\.(webp|png|avif|jpg|svg|woff2|ttf)$/.test(r.u)).sort((a, b) => b.kb - a.kb);
  const total = [...sizes.values()].reduce((s, n) => s + n, 0);
  const shown = await page.evaluate(() => [...document.images].filter((i) => /member\//.test(i.src)).map((i) => { const r = i.getBoundingClientRect(); return i.src.split('/').pop() + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + (getComputedStyle(i).display === 'none' ? ' hidden' : '') + ' ' + (i.loading || ''); }));
  console.log(hash || '(home)', 'total', Math.round(total / 1024) + 'KB', '|', rows.map((r) => `${r.u} ${r.kb}KB`).join(', '), '| member imgs:', shown.join('; '));
  await ctx.close();
}
await browser.close();
