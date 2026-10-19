// 사용: node flow.cjs <url> <출력폴더> <접두어>
// 첫 화면을 끝까지 스크롤(지연 사진 로드) → 화면 조각 캡처 → 예시 01 → 하루 만들기 → 결과 캡처
const path = require('path');
const fs = require('fs');
const { chromium } = require(require.resolve('playwright', { paths: [path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));

async function scrollAll(page) {
  await page.evaluate(async () => {
    const step = innerHeight * 0.8;
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
    scrollTo(0, 0);
  });
  await page.waitForTimeout(800);
}
async function slices(page, out, name) {
  await scrollAll(page);
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
}

(async () => {
  const [url, out, prefix = 'flow'] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = {};
  const sizes = [['pc', { width: 1440, height: 900 }, false], ['m', { width: 390, height: 844 }, true]];
  for (const [name, viewport, mobile] of sizes) {
    const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !/준비하고/.test(document.querySelector('#load-status')?.textContent || ''), null, { timeout: 15000 }).catch(() => errors.push('load-status 그대로'));
    await slices(page, out, `${prefix}-${name}-1start`);
    const preset = page.locator('[data-preset="culture"]');
    await preset.scrollIntoViewIfNeeded();
    await preset.click();
    await page.waitForTimeout(600);
    await page.locator('#generate').scrollIntoViewIfNeeded();
    await page.locator('#generate').click();
    await page.waitForSelector('#result:not([hidden])', { timeout: 20000 }).catch(() => errors.push('결과가 안 뜸'));
    await page.waitForTimeout(1500);
    await slices(page, out, `${prefix}-${name}-2result`);
    // 결과 부분만 화면 높이로 캡처
    const r = await page.locator('#result').boundingBox();
    report[name] = { errors, resultBox: r, overflow: await page.evaluate(() => ({ docW: document.documentElement.scrollWidth, innerW: innerWidth, vvW: visualViewport.width })) };
    await ctx.close();
  }
  await browser.close();
  console.log(JSON.stringify(report, null, 1));
})();
