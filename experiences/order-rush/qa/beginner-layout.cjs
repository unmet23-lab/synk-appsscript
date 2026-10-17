'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const records = JSON.parse(fs.readFileSync(path.join(__dirname, 'beginner-real/browser-results.json'))).gameRecords;
  const context = await browser.newContext({ reducedMotion: 'reduce' }); const page = await context.newPage();
  await page.addInitScript(({ records }) => localStorage.setItem('synk.order-rush.beginner.v1', JSON.stringify({ version: 1, seed: 411, stage: 3, completed: [0, 1, 2, 3], records, checkpoint: null, roundId: 'order-rush:layout-review', finished: true })), { records });
  const results = [];
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1280 ? 900 : 844 }); await page.goto(new URL('beginner.html', process.env.RUSH_URL || 'http://127.0.0.1:4317/').href); await page.locator('[data-action=results]').click(); await page.waitForFunction(() => document.fonts.status === 'loaded');
    const bounds = await page.evaluate(() => { const selectors = ['.b-stats', '.b-explain', '.b-practice-note', '.b-learned', '#b-coins', '[data-action=visit]']; return selectors.map(selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { selector, top: r.top, bottom: r.bottom }; }); });
    for (let i = 1; i < bounds.length; i++) assert.ok(bounds[i].top >= bounds[i - 1].bottom - 1, `${width}: ${bounds[i].selector} overlaps previous content`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(__dirname, 'beginner-real', width === 1280 ? 'results-desktop.png' : `results-${width}.png`), fullPage: true }); results.push({ width, bounds, overflow: false });
  }
  fs.writeFileSync(path.join(__dirname, 'beginner-real/layout-results.json'), JSON.stringify(results, null, 2)); await browser.close(); console.log('Result layout 1280 / 390 / 320: no overlaps or horizontal overflow.');
})().catch(e => { console.error(e); process.exit(1); });
