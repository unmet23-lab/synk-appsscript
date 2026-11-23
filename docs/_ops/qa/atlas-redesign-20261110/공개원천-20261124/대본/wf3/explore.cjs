'use strict';
// 라이브 synk.im/world 첫 흐름 살피기: 여는 화면을 누른 뒤 보이는 단추 목록과 화면을 찍는다(후보 덧씌우기 경로를 고르려고).
//   node explore.cjs <결과 폴더> [<누를 글 …>]
const path = require('node:path'), fs = require('node:fs');
const { chromium } = require(require.resolve('playwright', { paths: ['C:/Users/q1212/Documents/SYNK-appsscript/node_modules'] }));
const OUT = path.resolve(process.argv[2]); fs.mkdirSync(OUT, { recursive: true });
const steps = process.argv.slice(3);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Users/q1212/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.goto('https://synk.im/world/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await sleep(7000);
  const list = async tag => {
    const items = await page.evaluate(() => [...document.querySelectorAll('button, a, [role=button], [data-action], [data-view], [data-world]')]
      .filter(b => { const r = b.getBoundingClientRect(); const s = getComputedStyle(b); return r.width > 4 && r.height > 4 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < innerHeight && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('button, a, [role=button], [data-action], [data-view], [data-world]') === b; })
      .map(b => ({ text: (b.innerText || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40), id: b.id, data: Object.entries(b.dataset).map(([k, v]) => k + '=' + v).join(',').slice(0, 80) })));
    console.log(`-- ${tag}: 보이는 단추 ${items.length}`); for (const it of items.slice(0, 40)) console.log('   ', JSON.stringify(it));
    await page.screenshot({ path: path.join(OUT, tag + '.png') });
  };
  await list('0');
  // 여는 화면: 가운데를 누른다
  await page.mouse.click(195, 740); await sleep(6000); await list('1-start');
  let i = 2;
  for (const want of steps) {
    const ok = await page.evaluate(w => { const b = [...document.querySelectorAll('button, a, [role=button], [data-action], [data-view], [data-world]')].find(x => (x.innerText || x.getAttribute('aria-label') || '').includes(w) && x.getBoundingClientRect().width > 0); if (!b) return false; b.click(); return true; }, want);
    await sleep(4000); await list(`${i++}-${want}${ok ? '' : '(없음)'}`);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
