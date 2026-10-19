// 다음 판의 나머지 상황: 둘 다 건너뛰기, 밤이면 내일로, 오늘 카드 건너뛰기, 새 하루 만들기, 자세한 조건 폼, 둘러보기 펠트 그림, 장소 상세.
// 사용: node next-states.cjs <url> <출력폴더>
const path = require('path');
const fs = require('fs');
const { chromium } = require(require.resolve('playwright', { paths: [path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const [url, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const ready = page => page.waitForFunction(() => !/준비하고/.test(document.querySelector('#load-status')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = {};
  const open = async (viewport, mobile, clock) => {
    const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    if (clock) await page.clock.setFixedTime(new Date(clock));
    await page.goto(url, { waitUntil: 'networkidle' });
    await ready(page);
    return { ctx, page, errors };
  };
  // ① 둘 다 건너뛰기 → 기본 3시간
  {
    const { ctx, page, errors } = await open({ width: 1440, height: 900 }, false);
    await page.locator('#step-intent [data-step="2"].link-button').click();
    await page.locator('#make-day').click();
    await page.waitForSelector('#result:not([hidden])', { timeout: 30000 }).catch(() => errors.push('결과 없음'));
    await page.waitForTimeout(1200);
    report.skipAll = await page.evaluate(() => ({ title: document.querySelector('#result-title').textContent, stops: [...document.querySelectorAll('.story h3')].map(h => h.textContent), fit: document.querySelector('#plan-overview .plan-note')?.textContent }));
    // ③ 오늘 카드의 건너뛰기 → 진행 상황 창에서 그 장소가 미리 골라져 있다
    const first = await page.locator('[data-skip-stop]').first().getAttribute('data-skip-stop');
    await page.locator('[data-skip-stop]').first().click();
    await page.waitForTimeout(500);
    report.skipStop = await page.evaluate(id => ({ open: document.querySelector('#progress-dialog').open, value: document.querySelector(`[data-progress-place="${id}"]`)?.value }), first);
    await page.screenshot({ path: path.join(out, 'pc-skip-dialog.png') });
    await page.locator('#progress-dialog .dialog-close').click();
    // ④ 새 하루 만들기 → 고르기 첫 장
    await page.locator('#aside-links [data-action="new-day"]').click();
    await page.waitForTimeout(600);
    report.newTrip = await page.evaluate(() => ({ hasPlan: document.body.classList.contains('has-plan'), chooser: !document.querySelector('#before-result').hidden, step1: !document.querySelector('#step-intent').hidden, backLink: !document.querySelector('#chooser-back').hidden }));
    // ⑤ 자세한 조건 폼 펼치기(결과 전)
    await page.locator('#conditions-panel > summary').click();
    await page.waitForTimeout(400);
    await page.locator('#conditions-panel').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(out, 'pc-conditions-open.png'), fullPage: false });
    report.conditionsOpen = await page.evaluate(() => document.querySelector('#conditions-panel').open);
    // ⑥ 둘러보기 펠트 그림
    await page.locator('#explore').scrollIntoViewIfNeeded();
    await page.evaluate(() => document.querySelector('#place-grid').scrollIntoView());
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(out, 'pc-explore.png') });
    // ⑦ 펠트 그림 장소의 상세
    await page.locator('.place-title[data-place="gaeseong-mandu-koong"]').click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(out, 'pc-place-felt.png') });
    report.errorsA = errors;
    await ctx.close();
  }
  // ② 밤 9시 반이면 내일 10시로
  {
    const { ctx, page, errors } = await open({ width: 390, height: 844 }, true, '2026-10-19T12:30:00Z');
    await page.locator('#step-intent .button[data-step="2"]').click();
    await page.waitForTimeout(400);
    report.night = await page.evaluate(() => ({ context: document.querySelector('#time-context').textContent, range: document.querySelector('#dial-range').textContent, fit: document.querySelector('#fit-text').textContent }));
    await page.locator('[data-hours="8"]').click();
    await page.waitForTimeout(400);
    report.nightDay = await page.evaluate(() => document.querySelector('#dial-range').textContent);
    await page.locator('#make-day').click();
    await page.waitForSelector('#result:not([hidden]),#empty-result:not([hidden])', { timeout: 30000 }).catch(() => errors.push('결과 없음'));
    await page.waitForTimeout(1200);
    report.nightResult = await page.evaluate(() => ({ kicker: document.querySelector('#result-kicker').textContent, title: document.querySelector('#result-title').textContent, stops: [...document.querySelectorAll('.story')].map(c => c.querySelector('.story-time').textContent + ' ' + c.querySelector('h3').textContent), skipButtons: document.querySelectorAll('[data-skip-stop]').length, free: document.querySelector('.free-row strong')?.textContent }));
    await page.screenshot({ path: path.join(out, 'm-night-result.png'), fullPage: true });
    report.errorsB = errors;
    await ctx.close();
  }
  // ⑧ 아침 9시 1시간 → 10시부터
  {
    const { ctx, page, errors } = await open({ width: 390, height: 844 }, true, '2026-10-19T00:05:00Z');
    await page.locator('[data-intent="tea"]').click();
    await page.locator('#step-intent .button[data-step="2"]').click();
    await page.locator('[data-hours="1"]').click();
    await page.waitForTimeout(400);
    report.morning = await page.evaluate(() => document.querySelector('#dial-range').textContent);
    await page.locator('#make-day').click();
    await page.waitForSelector('#result:not([hidden]),#empty-result:not([hidden])', { timeout: 30000 }).catch(() => errors.push('결과 없음'));
    await page.waitForTimeout(1000);
    report.morningResult = await page.evaluate(() => ({ title: document.querySelector('#result-title').textContent, stops: [...document.querySelectorAll('.story')].map(c => c.querySelector('.story-time').textContent + ' ' + c.querySelector('h3').textContent) }));
    await page.screenshot({ path: path.join(out, 'm-one-hour.png'), fullPage: false });
    report.errorsC = errors;
    await ctx.close();
  }
  console.log(JSON.stringify(report, null, 1));
  await browser.close();
})();
