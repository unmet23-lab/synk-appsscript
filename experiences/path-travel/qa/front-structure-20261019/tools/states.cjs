// 사용: node states.cjs <url> <출력폴더> <접두어>
// 결과를 만든 뒤 화면 높이 그대로: PC 스크롤 중 지도, 조건 고치기 열기, 장소 상세 / 휴대폰 지도 탭, 조건 열기
const path = require('path');
const fs = require('fs');
const { chromium } = require(require.resolve('playwright', { paths: [path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
(async () => {
  const [url, out, prefix = 'st'] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const shot = (page, name) => page.screenshot({ path: path.join(out, `${prefix}-${name}.png`) });
  const report = {};
  for (const [name, viewport, mobile] of [['pc', { width: 1440, height: 900 }, false], ['m', { width: 390, height: 844 }, true]]) {
    const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !/준비하고/.test(document.querySelector('#load-status')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
    await page.locator('[data-preset="culture"]').click();
    await page.locator('#generate').click();
    await page.waitForSelector('#result:not([hidden])', { timeout: 20000 });
    await page.waitForTimeout(6000); // 알림이 사라질 때까지
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(300);
    await shot(page, `${name}-a-top`);
    if (!mobile) {
      await page.evaluate(() => scrollTo(0, 1100));
      await page.waitForTimeout(400);
      await shot(page, `${name}-b-scrolled`);
      await page.evaluate(() => scrollTo(0, 0));
      await page.locator('#conditions-panel > summary').click();
      await page.waitForTimeout(400);
      await shot(page, `${name}-c-conditions`);
      await page.locator('#conditions-panel > summary').click();
    } else {
      await page.locator('[data-view="map"]').click();
      await page.waitForTimeout(500);
      await page.waitForTimeout(400);
      await shot(page, `${name}-b-map`);
      await page.locator('[data-view="timeline"]').click();
      await page.evaluate(() => scrollTo(0, 0));
      await page.locator('#conditions-panel > summary').click();
      await page.waitForTimeout(400);
      await shot(page, `${name}-c-conditions`);
      await page.locator('#conditions-panel > summary').click();
    }
    await page.locator('#timeline [data-place]').first().click();
    await page.waitForTimeout(500);
    await shot(page, `${name}-d-detail`);
    await page.keyboard.press('Escape');
    await page.locator('#timeline [data-swap]').first().click();
    await page.waitForTimeout(500);
    await shot(page, `${name}-e-swap`);
    await page.keyboard.press('Escape');
    report[name] = { errors, overflow: await page.evaluate(() => ({ docW: document.documentElement.scrollWidth, innerW: innerWidth, vvW: visualViewport.width })) };
    await ctx.close();
  }
  await browser.close();
  console.log(JSON.stringify(report));
})();
