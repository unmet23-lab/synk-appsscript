// Fable 검수(10-19 오후) P2·P3를 고친 뒤 같은 재현 순서로 다시 확인한다.
// 사용: node review-fixes.cjs <url> <출력폴더>  — 결과는 <출력폴더>/report.json
const path = require('path');
const fs = require('fs');
const { chromium } = require(require.resolve('playwright', { paths: [path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const [url, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const ready = page => page.waitForFunction(() => !/준비하고/.test(document.querySelector('#load-status')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = {};
  const open = async ({ viewport = { width: 1280, height: 860 }, mobile = false, clock = '2026-10-19T03:50:00Z' } = {}) => {
    const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push('console: ' + m.text()); });
    if (clock) await page.clock.setFixedTime(new Date(clock));
    await page.goto(url, { waitUntil: 'networkidle' });
    await ready(page);
    return { ctx, page, errors };
  };
  const make = async page => { const t0 = Date.now(); await page.locator('#make-day').click(); await page.waitForSelector('#result:not([hidden]),#empty-result:not([hidden]),#form-error:not([hidden])', { timeout: 40000 }); const ms = Date.now() - t0; await page.waitForTimeout(500); return ms; };
  const stops = page => page.evaluate(() => [...document.querySelectorAll('.story')].map(c => c.querySelector('.story-time').textContent + ' ' + c.querySelector('h3').textContent));
  const fit = page => page.locator('#fit-text').textContent();
  const openForm = async page => { await page.locator('#conditions-panel > summary').click(); await page.evaluate(() => { for (const box of document.querySelectorAll('#trip-form details')) box.open = true; }); };
  const toTime = page => page.locator('#step-intent .button[data-step="2"]').click().then(() => page.waitForTimeout(300));
  // P2-1 2시간 전시+차
  { const { ctx, page, errors } = await open();
    await page.locator('[data-intent="art"]').click(); await page.locator('[data-intent="tea"]').click(); await toTime(page);
    await page.locator('.time-chips [data-hours="2"]').click(); await page.waitForTimeout(300);
    const before = { fit: await fit(page), objs: await page.locator('#fit-objs img').count(), circles: await page.locator('#fit-objs i').count() };
    const ms = await make(page);
    report.p2_1 = { ...before, ms, title: await page.locator('#result-title').textContent(), stops: await stops(page), fitList: await page.$$eval('.intent-fit li', lis => lis.map(li => li.textContent)), errors };
    await ctx.close(); }
  // P2-2 식사 필수를 손으로 켰다 끄면 안내도 따른다
  { const { ctx, page, errors } = await open();
    await openForm(page); await page.locator('#require-food').check(); await page.locator('#require-food').uncheck();
    await page.locator('[data-intent="palace"]').click(); await toTime(page);
    await page.locator('.time-chips [data-hours="8"]').click(); await page.waitForTimeout(300);
    report.p2_2 = { fit: await fit(page), requireFood: await page.isChecked('#require-food'), errors };
    await ctx.close(); }
  // P2-3 오늘 손으로 정한 출발 15:00
  { const { ctx, page, errors } = await open();
    await openForm(page); await page.locator('#start-time').fill('15:00'); await page.locator('#start-time').dispatchEvent('change'); await page.locator('#end-time').fill('18:00');
    await page.locator('[data-intent="tea"]').click(); await toTime(page);
    const first = { range: await page.locator('#dial-range').textContent(), formStart: await page.inputValue('#start-time'), formEnd: await page.inputValue('#end-time') };
    await page.locator('.time-chips [data-hours="8"]').click(); await page.waitForTimeout(200);
    const eight = await page.locator('#dial-range').textContent();
    await page.locator('.time-chips [data-hours="2"]').click(); await page.waitForTimeout(200);
    report.p2_3 = { first, eight, backToTwo: await page.locator('#dial-range').textContent(), errors };
    await ctx.close(); }
  // P2-5 이 시간 밖의 예약, 빈 예산
  { const { ctx, page, errors } = await open();
    await openForm(page);
    await page.locator('#appointment-place-0').selectOption('gaeseong-mandu-koong'); await page.locator('#appointment-time-0').fill('18:30');
    await page.locator('[data-intent="tea"]').click(); await toTime(page);
    await page.locator('.time-chips [data-hours="2"]').click(); await page.waitForTimeout(300);
    const step2 = { fit: await fit(page), formAppt: [await page.inputValue('#appointment-place-0'), await page.inputValue('#appointment-time-0')] };
    await page.locator('.time-chips [data-hours="8"]').click(); await page.waitForTimeout(300);
    const eight = { fit: await fit(page), range: await page.locator('#dial-range').textContent(), formAppt: [await page.inputValue('#appointment-place-0'), await page.inputValue('#appointment-time-0')] };
    await page.locator('.time-chips [data-hours="2"]').click(); await page.waitForTimeout(300);
    const ms = await make(page);
    const made = { ms, result: await page.locator('#result').isVisible(), stops: await stops(page), note: await page.locator('#plan-overview').textContent().then(t => /약속/.test(t)) };
    report.p2_5a = { step2, eight, made, errors };
    await ctx.close(); }
  { const { ctx, page, errors } = await open();
    await openForm(page); await page.locator('#budget').fill('');
    await page.locator('[data-intent="tea"]').click(); await toTime(page);
    const step2 = { fit: await fit(page) };
    await make(page);
    report.p2_5b = { step2, formError: await page.locator('#form-error').textContent(), panelOpen: await page.evaluate(() => document.querySelector('#conditions-panel').open), focus: await page.evaluate(() => document.activeElement?.id), errors };
    await ctx.close(); }
  // P2-6 폼에서 켠 취향과 고른 것
  { const { ctx, page, errors } = await open();
    await openForm(page);
    await page.locator('[name="preference"][value="art"]').check(); await page.locator('[data-taste="marketFood"]').selectOption('true'); await page.locator('[data-taste="dumplings"]').selectOption('false');
    const pressed = await page.$$eval('[data-intent][aria-pressed="true"]', bs => bs.map(b => b.dataset.intent));
    await toTime(page);
    const afterStep2 = await page.evaluate(() => ({ art: document.querySelector('[name="preference"][value="art"]').checked, market: document.querySelector('[data-taste="marketFood"]').value, dumplings: document.querySelector('[data-taste="dumplings"]').value }));
    await page.locator('[data-step="1"]').click(); await page.waitForTimeout(200);
    await page.locator('[data-intent="food"]').click();
    const foodChecked = await page.isChecked('[name="preference"][value="food"]');
    await page.locator('[name="preference"][value="food"]').uncheck();
    const pressedAfterUncheck = await page.$$eval('[data-intent][aria-pressed="true"]', bs => bs.map(b => b.dataset.intent));
    await page.locator('#generate').click();
    await page.waitForSelector('#result:not([hidden]),#empty-result:not([hidden]),#form-error:not([hidden])', { timeout: 40000 }); await page.waitForTimeout(500);
    report.p2_6 = { pressed, afterStep2, foodChecked, pressedAfterUncheck, title: await page.locator('#result-title').textContent(), fitList: await page.$$eval('.intent-fit li', lis => lis.map(li => li.textContent)), food: await page.isChecked('[name="preference"][value="food"]'), errors };
    await ctx.close(); }
  // 3시간 차+궁궐 곳 수 어림, 비용 글, 건너뛰기 링크, 뒤로·앞으로 초점, 여행 중 뒤로
  { const { ctx, page, errors } = await open();
    await page.locator('[data-intent="tea"]').click(); await page.locator('[data-intent="palace"]').click(); await toTime(page);
    const step2 = { fit: await fit(page), objs: await page.locator('#fit-objs img').count(), circles: await page.locator('#fit-objs i').count() };
    await make(page);
    const result = { title: await page.locator('#result-title').textContent(), stops: await stops(page), cost: await page.locator('.facts > div:nth-child(3)').textContent(), partial: await page.locator('#plan-overview .plan-note').allTextContents() };
    await page.focus('.skip'); await page.waitForTimeout(100);
    const skipFocused = await page.evaluate(() => document.activeElement?.className);
    await page.keyboard.press('Enter'); await page.waitForTimeout(300);
    const skipTarget = await page.evaluate(() => document.activeElement?.id);
    await page.locator('[data-action="new-day"]').click(); await page.waitForTimeout(300);
    await page.goBack(); await page.waitForTimeout(500);
    const afterBack = { result: await page.locator('#result').isVisible(), focus: await page.evaluate(() => document.activeElement?.id) };
    await page.goForward(); await page.waitForTimeout(500);
    const afterForward = { chooser: await page.locator('#before-result').isVisible(), focus: await page.evaluate(() => document.activeElement?.id) };
    await page.goBack(); await page.waitForTimeout(500);
    // 여행 중: 진행 상황 적용 뒤 뒤로
    await page.locator('[data-action="open-progress"]').first().click(); await page.waitForTimeout(300);
    const first = await page.locator('[data-progress-place]').first().getAttribute('data-progress-place');
    await page.locator(`[data-progress-place="${first}"]`).selectOption('completed');
    await page.locator('#progress-budget').fill('30000');
    await page.locator('#progress-form button[type=submit]').click(); await page.waitForTimeout(1500);
    const preview = await page.locator('#plan-change').textContent().catch(() => '');
    await page.locator('[data-action="accept-change"]').click().catch(() => {}); await page.waitForTimeout(800);
    const remaining = await stops(page);
    await page.goBack(); await page.waitForTimeout(500);
    const progressBack = { result: await page.locator('#result').isVisible(), chooser: await page.locator('#before-result').isVisible(), state: await page.evaluate(() => history.state?.pathView) };
    report.flow = { step2, result, skipFocused, skipTarget, afterBack, afterForward, completed: first, preview: preview.slice(0, 160), remaining, progressBack, errors };
    await ctx.close(); }
  // 휴대폰 지도 단추가 아래로 읽을 때 비키는지
  { const { ctx, page, errors } = await open({ viewport: { width: 390, height: 844 }, mobile: true });
    await page.locator('[data-intent="food"]').click(); await toTime(page); await make(page);
    const fab = () => page.evaluate(() => { const b = document.querySelector('.map-fab'); return { away: b.classList.contains('is-away'), opacity: getComputedStyle(b).opacity }; });
    const top = await fab();
    await page.mouse.wheel(0, 900); await page.waitForTimeout(600);
    const down = await fab();
    await page.screenshot({ path: path.join(out, 'm-scrolled-down.png') });
    await page.mouse.wheel(0, -300); await page.waitForTimeout(600);
    const up = await fab();
    await page.screenshot({ path: path.join(out, 'm-scrolled-up.png') });
    report.fab = { top, down, up, errors };
    await ctx.close(); }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
  await browser.close();
})();
