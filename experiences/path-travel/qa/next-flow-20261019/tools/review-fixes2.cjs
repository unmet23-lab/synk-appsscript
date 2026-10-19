// Fable 재검수(10-19 저녁) P1·P3를 고친 뒤 확인: 저녁 궁궐(운영 시각 밖 금지), 질문을 나중에 붙이는 하루 만들기,
// 폼에서 넷 켠 뒤 고르기 세 개 제한, 앞날 15:00에 하루를 고를 때 알림, 2시간 한 곳 모드 뒤 1장 안내.
// 사용: node review-fixes2.cjs <url> <출력폴더>  — 결과는 <출력폴더>/report.json
const path = require('path');
const fs = require('fs');
const { chromium } = require(require.resolve('playwright', { paths: [path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const [url, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = {};
  const open = async (clock = '2026-10-19T03:50:00Z') => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.clock.setFixedTime(new Date(clock));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !/준비하고/.test(document.querySelector('#load-status')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
    return { ctx, page, errors };
  };
  const toTime = page => page.locator('#step-intent .button[data-step="2"]').click().then(() => page.waitForTimeout(300));
  const stops = page => page.evaluate(() => [...document.querySelectorAll('.story')].map(c => c.querySelector('.story-time').textContent + ' ' + c.querySelector('h3').textContent));
  // ① 월 14:59 차+궁궐 3시간: 경복궁(18시 폐장, 17시 입장 마감)을 운영 시각 밖에 넣지 않는다
  { const { ctx, page, errors } = await open('2026-10-19T05:59:00Z');
    await page.locator('[data-intent="tea"]').click(); await page.locator('[data-intent="palace"]').click(); await toTime(page);
    const fit = await page.locator('#fit-text').textContent();
    await page.locator('#make-day').click(); await page.waitForSelector('#result:not([hidden]),#empty-result:not([hidden])'); await page.waitForTimeout(400);
    report.eveningPalace = { fit, title: await page.locator('#result-title').textContent().catch(() => ''), stops: await stops(page), errors };
    await ctx.close(); }
  // ② 하루 맛집+궁궐+차: 결과가 보이는 데 걸린 시간과 질문이 나중에 붙는지
  { const { ctx, page, errors } = await open();
    for (const id of ['food', 'palace', 'tea']) await page.locator(`[data-intent="${id}"]`).click();
    await toTime(page); await page.locator('.time-chips [data-hours="8"]').click(); await page.waitForTimeout(300);
    const t0 = Date.now(); await page.locator('#make-day').click(); await page.waitForSelector('#result:not([hidden])'); const shown = Date.now() - t0;
    const questionAtShow = await page.locator('#result-evidence .question, #result-evidence [data-refine]').count();
    await page.waitForFunction(() => document.querySelectorAll('#result-evidence [data-refine]').length > 0, null, { timeout: 8000 }).catch(() => {});
    const askedAfter = Date.now() - t0;
    report.deferredQuestion = { shownMs: shown, questionAtShow, questionLaterMs: askedAfter, refineButtons: await page.locator('#result-evidence [data-refine]').count(), title: await page.locator('#result-title').textContent(), errors };
    await ctx.close(); }
  // ③ 폼에서 넷을 켠 뒤 고르기를 하나 더 누르면 셋으로 줄인다
  { const { ctx, page, errors } = await open();
    await page.locator('#conditions-panel > summary').click(); await page.evaluate(() => { for (const box of document.querySelectorAll('#trip-form details')) box.open = true; });
    for (const value of ['food', 'tea', 'art']) await page.locator(`[name="preference"][value="${value}"]`).check();
    await page.locator('[data-taste="marketFood"]').selectOption('true');
    const four = await page.$$eval('[data-intent][aria-pressed="true"]', bs => bs.map(b => b.dataset.intent));
    await page.locator('[data-intent="palace"]').click(); await page.waitForTimeout(200);
    report.fourFromForm = { four, after: await page.$$eval('[data-intent][aria-pressed="true"]', bs => bs.map(b => b.dataset.intent)), note: await page.locator('#pick-note').textContent(),
      form: await page.evaluate(() => ({ food: document.querySelector('[name="preference"][value="food"]').checked, tea: document.querySelector('[name="preference"][value="tea"]').checked, art: document.querySelector('[name="preference"][value="art"]').checked, history: document.querySelector('[name="preference"][value="history"]').checked, market: document.querySelector('[data-taste="marketFood"]').value })), errors };
    await ctx.close(); }
  // ④ 앞날 15:00을 직접 정하고 하루를 고르면 당긴 까닭을 알린다
  { const { ctx, page, errors } = await open();
    await page.locator('#conditions-panel > summary').click();
    await page.locator('#trip-date').fill('2026-10-24'); await page.locator('#trip-date').dispatchEvent('change');
    await page.locator('#start-time').fill('15:00'); await page.locator('#start-time').dispatchEvent('change');
    await page.locator('[data-intent="tea"]').click(); await toTime(page);
    const three = { range: await page.locator('#dial-range').textContent(), fit: await page.locator('#fit-text').textContent() };
    await page.locator('.time-chips [data-hours="8"]').click(); await page.waitForTimeout(300);
    report.handLate = { three, day: { range: await page.locator('#dial-range').textContent(), fit: await page.locator('#fit-text').textContent() }, errors };
    await ctx.close(); }
  // ⑤ 2시간 전시+차(한 곳 모드) 뒤 1장으로 돌아가면 안내가 그 사실을 말한다
  { const { ctx, page, errors } = await open();
    await page.locator('[data-intent="art"]').click(); await page.locator('[data-intent="tea"]').click(); await toTime(page);
    await page.locator('.time-chips [data-hours="2"]').click(); await page.waitForTimeout(300);
    await page.locator('[data-step="1"]').click(); await page.waitForTimeout(200);
    report.singleBack = { note: await page.locator('#pick-note').textContent(), pressed: await page.$$eval('[data-intent][aria-pressed="true"]', bs => bs.map(b => b.dataset.intent)), errors };
    await ctx.close(); }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
  await browser.close();
})();
