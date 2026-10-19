// 다음 판 흐름(하고 싶은 것 → 몇 시간 → 결과 → 지도 창)을 여러 폭에서 돌려 넘침·작은 한글·오류를 재고 캡처한다.
// 사용: node next-check.cjs <url> <출력폴더> [고를것=tea,palace] [시간=3]
const path = require('path');
const fs = require('fs');
const { chromium } = require(require.resolve('playwright', { paths: [path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const [url, out, pickArg = 'tea,palace', hoursArg = '3'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const sizes = [[1440, 900, false, 'pc'], [1280, 720, false, 'pc2'], [1024, 768, false, 'tab-l'], [768, 1024, true, 'tab'], [390, 844, true, 'm'], [360, 740, true, 'm2'], [320, 640, true, 'm3']];
const shotSizes = new Set(['pc', 'm', 'tab']);
const probe = () => {
  const o = { docW: document.documentElement.scrollWidth, innerW: innerWidth, offscreen: [], smallKo: [] };
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('dialog:not([open]),[hidden],details:not([open])>*:not(summary),.visually-hidden,.skip')) continue;
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if ((r.right > innerWidth + 1 || r.left < -1) && !el.closest('.quick-actions,.category-tabs,.condition-chips') && cs.position !== 'fixed') o.offscreen.push((el.id ? '#' + el.id : String(el.className || el.tagName)).slice(0, 40) + ' ' + Math.round(r.left) + '~' + Math.round(r.right));
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('');
    if (/[가-힣]/.test(own) && parseFloat(cs.fontSize) < 13) { const k = el.tagName + '.' + el.className + ' ' + cs.fontSize; if (!seen.has(k)) { seen.add(k); o.smallKo.push(k + ' «' + own.trim().slice(0, 20) + '»'); } }
  }
  o.offscreen = o.offscreen.slice(0, 8); o.smallKo = o.smallKo.slice(0, 12);
  return o;
};
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const [w, h, mobile, name] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !/준비하고/.test(document.querySelector('#load-status')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
    const shot = async (label, full = true) => { if (shotSizes.has(name)) await page.screenshot({ path: path.join(out, `${name}-${label}.png`), fullPage: full }); };
    const report = { size: `${w}x${h}`, errors };
    report.step1 = await page.evaluate(probe);
    for (const id of pickArg.split(',').filter(Boolean)) await page.locator(`[data-intent="${id}"]`).click();
    await page.waitForTimeout(700);
    await shot('1-intent', false);
    await page.locator('#step-intent .button[data-step="2"]').click();
    await page.locator(`[data-hours="${hoursArg}"]`).click();
    await page.waitForTimeout(900);
    report.step2 = await page.evaluate(probe);
    await shot('2-time', false);
    await page.locator('#make-day').click();
    await page.waitForSelector('#result:not([hidden]),#empty-result:not([hidden])', { timeout: 30000 }).catch(() => errors.push('결과 없음'));
    // 확인 질문은 결과 뒤에 워커가 계산해 붙인다(10-19 밤). 질문 칸까지 재려고 붙을 때까지 기다린다.
    await page.waitForFunction(() => document.querySelectorAll('#result-evidence [data-refine]').length > 0, null, { timeout: 8000 }).catch(() => {});
    report.question = await page.locator('#result-evidence [data-refine]').count();
    await page.waitForTimeout(1500);
    report.title = await page.evaluate(() => document.querySelector('#result-title')?.textContent);
    report.stops = await page.evaluate(() => [...document.querySelectorAll('.story')].map(card => card.querySelector('.story-time')?.textContent + ' ' + card.querySelector('h3')?.textContent));
    report.result = await page.evaluate(probe);
    await page.evaluate(() => scrollTo(0, 0));
    await shot('3-result');
    await shot('3-result-top', false);
    const opener = mobile || w <= 900 ? '.map-fab' : '.map-open';
    await page.locator(opener).click();
    await page.waitForTimeout(900);
    report.map = await page.evaluate(() => { const d = document.querySelector('#map-dialog'); const svg = d.querySelector('svg'); return { open: d.open, svg: !!svg, w: Math.round(d.getBoundingClientRect().width), h: Math.round(d.getBoundingClientRect().height) }; });
    await shot('4-map', false);
    console.log(JSON.stringify(report));
    await ctx.close();
  }
  await browser.close();
})();
