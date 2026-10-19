// 새 화면에서 기존 기능이 그대로 이어지는지: 유지·바꾸기·빠른 변경·다른 안·질문·내 여행·진행 상황·지도 확대.
// 사용: node next-features.cjs <url> <출력폴더>
const path = require('path');
const fs = require('fs');
const { chromium } = require(require.resolve('playwright', { paths: [path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const [url, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  const page = await ctx.newPage();
  const errors = [], log = {};
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !/준비하고/.test(document.querySelector('#load-status')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
  const stops = () => page.evaluate(() => [...document.querySelectorAll('.story h3')].map(h => h.textContent));
  const toast = () => page.evaluate(() => document.querySelector('#toast').hidden ? '' : document.querySelector('#toast').textContent);
  await page.locator('[data-intent="tea"]').click();
  await page.locator('[data-intent="art"]').click();
  await page.locator('#step-intent .button[data-step="2"]').click();
  await page.locator('[data-hours="5"]').click();
  await page.locator('#make-day').click();
  await page.waitForSelector('#result:not([hidden])', { timeout: 30000 });
  log.made = { title: await page.locator('#result-title').textContent(), stops: await stops() };
  // 유지
  await page.locator('[data-lock]').first().click();
  log.lock = { toast: await toast(), label: await page.locator('[data-lock]').first().textContent() };
  // 바꾸기 → 미리보기 → 적용
  await page.locator('[data-swap]').nth(1).click();
  await page.waitForTimeout(300);
  const swapCount = await page.locator('#swap-dialog [data-replace-to]').count();
  if (swapCount) {
    await page.locator('#swap-dialog [data-replace-to]').first().click();
    await page.waitForTimeout(600);
    log.swapPreview = await page.evaluate(() => !document.querySelector('#plan-change').hidden && document.querySelector('#plan-change h4')?.textContent);
    if (await page.locator('[data-action="accept-change"]').count()) { await page.locator('[data-action="accept-change"]').click(); await page.waitForTimeout(800); }
    log.swapped = await stops();
  } else log.swap = '대안 없음';
  // 빠른 변경
  await page.locator('[data-adjust="less-walk"]').click();
  await page.waitForTimeout(800);
  log.lessWalk = await page.evaluate(() => !document.querySelector('#plan-change').hidden && document.querySelector('#plan-change h4')?.textContent);
  if (await page.locator('[data-action="cancel-change"]').count()) await page.locator('[data-action="cancel-change"]').first().click();
  // 다른 안
  const alts = await page.locator('[data-alternative]').count();
  log.alternatives = alts;
  if (alts) { await page.locator('[data-alternative]').first().click(); await page.waitForTimeout(500); log.altPreview = await page.evaluate(() => document.querySelector('#plan-change h4')?.textContent); await page.locator('[data-action="cancel-change"]').first().click(); }
  // 질문
  const refine = await page.locator('[data-refine]').count();
  log.question = refine ? await page.locator('.refinement h4').first().textContent() : '질문 없음';
  // 내 여행
  await page.locator('#save-open').click();
  await page.waitForTimeout(300);
  log.memory = await page.evaluate(() => document.querySelector('#memory-dialog').open);
  await page.locator('#memory-dialog .dialog-close').click();
  // 지도 창·확대
  await page.locator('.map-open').click();
  await page.waitForTimeout(500);
  await page.locator('#map-zoom-in').click();
  await page.waitForTimeout(900);
  log.map = await page.evaluate(() => ({ open: document.querySelector('#map-dialog').open, markers: document.querySelectorAll('#route-map .map-point').length }));
  await page.screenshot({ path: path.join(out, 'map-zoomed.png') });
  await page.locator('#route-map [data-place]').first().click();
  await page.waitForTimeout(300);
  log.mapPlace = await page.evaluate(() => document.querySelector('#place-dialog').open);
  await page.locator('#place-dialog .dialog-close').click();
  await page.locator('#map-dialog .dialog-close').click();
  // 진행 상황: 첫 곳 다녀왔다고 하고 남은 일정 비교 → 적용
  if (await page.locator('#aside-links [data-action="open-progress"]').count()) {
    await page.locator('#aside-links [data-action="open-progress"]').click();
    await page.waitForTimeout(300);
    await page.locator('[data-progress-place]').first().selectOption('completed');
    await page.locator('#progress-budget').fill('30000');
    await page.locator('#progress-form button[type="submit"]').click();
    await page.waitForTimeout(1200);
    log.progressPreview = await page.evaluate(() => document.querySelector('#plan-change h4')?.textContent || document.querySelector('#progress-error')?.textContent);
    if (await page.locator('[data-action="accept-change"]').count()) { await page.locator('[data-action="accept-change"]').click(); await page.waitForTimeout(800); }
    log.progress = { title: await page.locator('#result-title').textContent(), stops: await stops(), summary: await page.evaluate(() => !document.querySelector('#progress-summary').hidden) };
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(out, 'after-progress.png') });
  log.errors = errors;
  console.log(JSON.stringify(log, null, 1));
  await browser.close();
})();
