// 원래(4303)와 새 구조(4304)를 같은 조건으로: 첫 화면·결과 화면 × PC·휴대폰, 화면 높이 그대로
const path = require('path');
const fs = require('fs');
const { chromium } = require(require.resolve('playwright', { paths: [path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const [label, url] of [['orig', 'http://127.0.0.1:4303/'], ['new', 'http://127.0.0.1:4304/']]) {
    for (const [name, viewport, mobile] of [['pc', { width: 1440, height: 900 }, false], ['m', { width: 390, height: 844 }, true]]) {
      const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
      const page = await ctx.newPage();
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => !/준비하고/.test(document.querySelector('#load-status')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
      await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } scrollTo(0, 0); });
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(out, `${label}-${name}-start.png`) });
      await page.locator('[data-preset="culture"]').click();
      await page.locator('#generate').click();
      await page.waitForSelector('#result:not([hidden])', { timeout: 20000 });
      await page.waitForTimeout(6200);
      // 결과 화면은 결과 머리가 맨 위에 오도록
      await page.evaluate(() => { const el = document.querySelector('#result'); scrollTo(0, Math.max(0, el.getBoundingClientRect().top + scrollY - (innerWidth > 900 ? 120 : 140))); });
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(out, `${label}-${name}-result.png`) });
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(out, `${label}-${name}-result-top.png`) });
      await ctx.close();
    }
  }
  await browser.close();
  console.log('done');
})();
