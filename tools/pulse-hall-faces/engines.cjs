// 크롬과 WebKit(사파리 엔진)이 같은 제목 크기 · 단추 자리 · 오른쪽 칸 꼴 · 값 안내 자리를 내는지 견준다(11-17 — 중첩 min · max 한계식 확인).
// node tools/pulse-hall-faces/engines.cjs <후보 pulse-v12.css> — 라이브 쪽에 그 CSS를 끼운다. 줄: 쪽 크기 C(크롬) W(WebKit) = 제목px 단추아래/화면높이 오른쪽칸display 값안내위
const { webkit, chromium } = require('playwright');
const fs = require('node:fs');
const CSS = process.argv[2];
const sizes = [[1920,650],[1920,1080],[1440,600],[2560,700],[3840,600],[844,390],[568,320],[690,829],[1440,900]];
(async () => {
  const out = {};
  for (const [name, bt] of [['webkit', webkit], ['chromium', chromium]]) {
    let browser;
    try { browser = await bt.launch(name === 'chromium' ? { channel: 'chrome' } : {}); } catch (e) { out[name] = '못 띄움 ' + String(e).split('\n')[0].slice(0, 120); continue; }
    for (const pg of ['/pulse/', '/en/pulse/']) {
      const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
      const page = await ctx.newPage();
      await page.route(/\/assets\/v10\/pulse-v12\.css/, r => r.fulfill({ body: fs.readFileSync(CSS), contentType: 'text/css; charset=utf-8' }));
      await page.goto('https://synk.im' + pg + '?probe=' + Date.now(), { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      for (const [w, h] of sizes) {
        await page.setViewportSize({ width: w, height: h });
        await page.waitForTimeout(150);
        const v = await page.evaluate(() => { const t = document.querySelector('.pv-h1'), p = document.querySelector('.pv-side .k-pv-price'), c = document.querySelector('.btn.pv-cta').getBoundingClientRect(); return [parseFloat(getComputedStyle(t).fontSize).toFixed(1), Math.round(c.bottom) + '/' + innerHeight, getComputedStyle(document.querySelector('.pv-side')).display, Math.round(p.getBoundingClientRect().top)]; });
        (out[name] ||= {})[`${pg} ${w}x${h}`] = v.join(' ');
      }
      await ctx.close();
    }
    await browser.close();
  }
  const keys = Object.keys(out.chromium || {});
  for (const k of keys) console.log(k.padEnd(22), 'C', (out.chromium[k]||'').padEnd(24), 'W', String((out.webkit||{})[k]||out.webkit).padEnd(24), '');
})().catch(e => { console.error(e); process.exit(1); });
