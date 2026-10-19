// 여러 폭에서 가로 넘침·화면 밖 요소·13px 미만 한글·겹침을 잰다. 사용: node measure.cjs <url>
const path = require('path');
const { chromium } = require(require.resolve('playwright', { paths: [path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const url = process.argv[2];
const sizes = [[1440, 900, false], [1280, 720, false], [1024, 768, false], [900, 1000, false], [768, 1024, true], [390, 844, true], [360, 740, true], [320, 640, true]];
const probe = () => {
  const out = { docW: document.documentElement.scrollWidth, innerW: innerWidth, vvW: Math.round(visualViewport.width), offscreen: [], smallKo: [] };
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('dialog:not([open]),[hidden],details:not([open])>*:not(summary),.visually-hidden,.skip')) continue;
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if (r.right > innerWidth + 1 && !el.closest('.presets,.quick-actions,.category-tabs,.condition-chips') && cs.position !== 'fixed') out.offscreen.push((el.id ? '#' + el.id : el.className || el.tagName) + ' ' + Math.round(r.right));
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('');
    if (/[가-힣]/.test(own) && parseFloat(cs.fontSize) < 13) { const k = el.tagName + '.' + el.className + ' ' + cs.fontSize; if (!seen.has(k)) { seen.add(k); out.smallKo.push(k + ' «' + own.trim().slice(0, 20) + '»'); } }
  }
  out.offscreen = out.offscreen.slice(0, 8); out.smallKo = out.smallKo.slice(0, 12);
  return out;
};
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const [w, h, mobile] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !/준비하고/.test(document.querySelector('#load-status')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
    const start = await page.evaluate(probe);
    await page.locator('[data-preset="food"]').click();
    await page.locator('#generate').click();
    await page.waitForSelector('#result:not([hidden])', { timeout: 20000 }).catch(() => errors.push('결과 없음'));
    await page.waitForTimeout(800);
    const result = await page.evaluate(probe);
    console.log(JSON.stringify({ size: `${w}x${h}`, errors, start, result }));
    await ctx.close();
  }
  await browser.close();
})();
