'use strict';
// 레슨 화면 살피기(한 번만): 손님으로 첫 실행을 지나 배우기 → 시작하기를 누르고, 걸음마다 보이는 단추와 글을 적는다. 라이브 그대로(덧씌움은 1단계 후보).
const path = require('node:path'), fs = require('node:fs');
const { chromium } = require(require.resolve('playwright', { paths: ['C:/Users/q1212/Documents/SYNK-appsscript/node_modules'] }));
const OUT = process.argv[2], OVER = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json' };
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Users/q1212/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (u.hostname === 'synk.im') {
      if (!['GET', 'HEAD'].includes(route.request().method())) return route.abort();
      const rel = decodeURIComponent(u.pathname).replace(/^\//, '');
      const f = path.join(OVER, rel);
      if (rel.startsWith('world/') && fs.existsSync(f) && fs.statSync(f).isFile()) return route.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
      return route.continue();
    }
    return route.abort();
  });
  const page = await ctx.newPage();
  await page.goto('https://synk.im/world/?opening=off', { waitUntil: 'domcontentloaded', timeout: 90000 });
  for (let round = 0; round < 14; round++) {
    await sleep(1500);
    const s = await page.evaluate(() => ({ lang: !!document.querySelector('[data-lang-picker]'), hangul: !!document.querySelector('dialog[open] [data-first-hangul]'), tutor: !!document.querySelector('.tutor-option'), ready: document.querySelector('.world-shell')?.dataset.entry === 'ready' })).catch(() => ({}));
    if (s.lang) { await page.locator('[data-lang-choice="ko"]').click().catch(() => {}); await page.locator('[data-lang-confirm]').click().catch(() => {}); continue; }
    if (s.hangul) { await page.locator('dialog[open] [data-first-hangul="reads"]').click().catch(() => {}); continue; }
    if (s.tutor) { await page.locator('.tutor-option[data-tutor-id="mongle"]').first().click().catch(() => {}); await page.locator('.tutor-primary').first().click().catch(() => {}); await sleep(600); await page.locator('.tutor-primary[data-tutor-action="finish"]').click().catch(() => {}); continue; }
    if (s.ready) break;
  }
  await sleep(2500);
  await page.locator('.world-nav [data-view="packs"]').first().click().catch(() => {});
  await sleep(2000);
  await page.getByRole('button', { name: /시작하기/ }).first().click().catch(e => console.log('시작하기 못 누름', String(e).slice(0, 100)));
  for (let i = 0; i < 20; i++) {
    await sleep(2200);
    const info = await page.evaluate(() => {
      const vis = b => { const r = b.getBoundingClientRect(); const s = getComputedStyle(b); return r.width > 4 && r.height > 4 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < innerHeight; };
      const btns = [...document.querySelectorAll('button, [role=button], a[href]')].filter(vis).filter(b => !b.closest('.world-nav, .town-map, header') && !b.classList.contains('town-pin')).map(b => {
        const attrs = [...b.attributes].filter(a => a.name.startsWith('data-') || a.name === 'class' || a.name === 'aria-pressed' || a.name === 'disabled').map(a => `${a.name}=${a.value.slice(0, 40)}`).join(' ');
        return `[${(b.innerText || b.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 30)}] ${attrs}`;
      });
      return { btns: btns.slice(0, 30), text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 300) };
    });
    console.log(`--- 걸음 ${i}: ${info.text}`);
    for (const b of info.btns) console.log('   ' + b);
    await page.screenshot({ path: path.join(OUT, `lesson-${i}.png`) });
    // 살피기용으로만: 「다음」 · 「계속」 류가 있으면 누르고, 없으면 보기(첫 것)를 누른다
    const order = ["[data-life-begin]:visible","[data-life-scene-next]:visible","[data-life-choice]:visible","[data-life-option]:visible","[data-life-answer]:visible","[data-choice]:visible","[data-life-next]:visible","[data-life-continue]:visible","[data-life-finish]:visible",".felt-button:visible"];
    let done = false;
    for (const sel of order) { const l = page.locator(sel); if (await l.count()) { console.log("   >> 누름 " + sel); await l.first().click({ timeout: 4000 }).catch(e => console.log("   !! " + String(e).slice(0, 80))); done = true; break; } }
    if (!done) console.log("   >> 누를 것 없음");
  }
  await browser.close();
})();
