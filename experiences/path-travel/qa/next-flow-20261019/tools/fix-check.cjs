// 검수 지적 고친 것 확인: 폼과 고르기 함께, 1시간 맛집, 2시간 전시, 새 하루, 뒤로 가기, 유지 깜빡임·초점, 제목 정직, 덜 걷기.
// 사용: node fix-check.cjs <url> <출력폴더>
const path = require('path');
const fs = require('fs');
const { chromium } = require(require.resolve('playwright', { paths: [path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const [url, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const ready = page => page.waitForFunction(() => !/준비하고/.test(document.querySelector('#load-status')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
const state = page => page.evaluate(() => ({
  hasPlan: document.body.classList.contains('has-plan'), result: !document.querySelector('#result').hidden, chooser: !document.querySelector('#before-result').hidden,
  step: document.querySelector('#step-time').hidden ? 1 : 2, back: !document.querySelector('#chooser-back').hidden,
  title: document.querySelector('#result-title')?.textContent, kicker: document.querySelector('#result-kicker')?.textContent,
  stops: [...document.querySelectorAll('.story')].map(card => card.querySelector('.story-time').textContent + ' ' + card.querySelector('h3').textContent),
  fit: [...document.querySelectorAll('.intent-fit li')].map(li => li.textContent), query: { date: document.querySelector('#trip-date').value, start: document.querySelector('#start-time').value, end: document.querySelector('#end-time').value, adults: document.querySelector('#adults').value, stops: document.querySelector('#stop-count').value } }));
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = {};
  const open = async clock => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    if (clock) await page.clock.setFixedTime(new Date(clock));
    await page.goto(url, { waitUntil: 'networkidle' });
    await ready(page);
    return { ctx, page, errors };
  };
  const make = async page => { await page.locator('#make-day').click(); await page.waitForSelector('#result:not([hidden]),#empty-result:not([hidden])', { timeout: 30000 }); await page.waitForTimeout(900); };
  // ① 폼에서 앞날·성인 2명 → 고르기로 만들기: 날짜·인원 유지
  {
    const { ctx, page, errors } = await open('2026-10-19T03:50:00Z');
    await page.locator('#conditions-panel > summary').click();
    await page.locator('#trip-date').fill('2026-10-24');
    await page.locator('#adults').fill('2');
    await page.evaluate(() => { for (const box of document.querySelectorAll('#trip-form details')) box.open = true; });
    await page.locator('[data-taste="dumplings"]').selectOption('true');
    await page.locator('[name="avoid"][value="history"]').check();
    await page.locator('[data-intent="tea"]').click();
    await page.locator('#step-intent .button[data-step="2"]').click();
    await page.waitForTimeout(400);
    report.formFirst = { range: await page.locator('#dial-range').textContent() };
    await make(page);
    report.formFirst.after = await state(page);
    report.formFirst.prefs = await page.evaluate(() => ({ dumplings: document.querySelector('[data-taste="dumplings"]').value, avoidHistory: document.querySelector('[name="avoid"][value="history"]').checked }));
    // ② 고르기 뒤 폼 단추: 고른 것과 시간을 같이 쓴다
    report.errorsA = errors; await ctx.close();
  }
  {
    const { ctx, page, errors } = await open('2026-10-19T03:50:00Z');
    await page.locator('[data-intent="tea"]').click(); await page.locator('[data-intent="art"]').click();
    await page.locator('#step-intent .button[data-step="2"]').click(); await page.locator('[data-hours="3"]').click();
    await page.locator('#conditions-panel > summary').click();
    await page.locator('#generate').click();
    await page.waitForSelector('#result:not([hidden]),#empty-result:not([hidden])', { timeout: 30000 }); await page.waitForTimeout(900);
    report.formButton = await state(page);
    report.errorsB = errors; await ctx.close();
  }
  // ③ 12:34 1시간 맛집 → 미리 알림, 실패 화면 없음
  {
    const { ctx, page, errors } = await open('2026-10-19T03:34:00Z');
    await page.locator('[data-intent="food"]').click();
    await page.locator('#step-intent .button[data-step="2"]').click(); await page.locator('[data-hours="1"]').click();
    await page.waitForTimeout(400);
    report.oneHourFood = { fit: await page.locator('#fit-text').textContent() };
    await make(page);
    report.oneHourFood.after = await state(page);
    report.oneHourFood.empty = await page.evaluate(() => !document.querySelector('#empty-result').hidden);
    report.errorsC = errors; await ctx.close();
  }
  // ④ 월 13:00 2시간 전시 → 한 곳(미술관), 제목 정직 / 3시간 궁궐 → 진짜 궁
  {
    const { ctx, page, errors } = await open('2026-10-19T03:50:00Z');
    await page.locator('[data-intent="art"]').click();
    await page.locator('#step-intent .button[data-step="2"]').click(); await page.locator('[data-hours="2"]').click();
    await page.waitForTimeout(400);
    report.twoHourArt = { fit: await page.locator('#fit-text').textContent() };
    await make(page);
    report.twoHourArt.after = await state(page);
    // ⑤ 새 하루 → 일정은 그대로, 돌아가기 / 뒤로·앞으로
    await page.locator('#aside-links [data-action="new-day"]').click(); await page.waitForTimeout(500);
    report.newDay = await state(page);
    await page.locator('#chooser-back button').click(); await page.waitForTimeout(500);
    report.backLink = await state(page);
    await page.goBack(); await page.waitForTimeout(500);
    report.historyBack1 = await state(page);
    await page.goBack(); await page.waitForTimeout(500);
    report.historyBack2 = await state(page);
    await page.goForward(); await page.waitForTimeout(500);
    await page.goForward(); await page.waitForTimeout(500);
    report.historyForward = await state(page);
    // ⑥ 유지: 카드가 다시 등장하지 않고 초점이 그 단추에
    const lock = page.locator('[data-lock]').first();
    await lock.focus(); await lock.press('Enter'); await page.waitForTimeout(60);
    report.lock = await page.evaluate(() => ({ opacity: [...document.querySelectorAll('.story')].map(card => getComputedStyle(card).opacity), settled: [...document.querySelectorAll('.story')].every(card => card.classList.contains('settled')), focus: document.activeElement?.getAttribute('data-lock'), label: document.activeElement?.getAttribute('aria-label') }));
    await page.screenshot({ path: path.join(out, 'after-lock.png') });
    report.errorsD = errors; await ctx.close();
  }
  {
    const { ctx, page, errors } = await open('2026-10-19T03:50:00Z');
    await page.locator('[data-intent="palace"]').click(); await page.locator('[data-intent="tea"]').click();
    await page.locator('#step-intent .button[data-step="2"]').click(); await page.locator('[data-hours="3"]').click();
    await make(page);
    report.palace = await state(page);
    await page.locator('[data-adjust="less-walk"]').click(); await page.waitForTimeout(800);
    if (await page.locator('[data-action="accept-change"]').count()) { await page.locator('[data-action="accept-change"]').click(); await page.waitForTimeout(800); }
    report.lessWalk = await state(page);
    await page.screenshot({ path: path.join(out, 'palace-result.png') });
    report.errorsE = errors; await ctx.close();
  }
  console.log(JSON.stringify(report, null, 1));
  await browser.close();
})();
