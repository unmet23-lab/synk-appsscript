'use strict';
// 로컬 소개서의 변경한 첫 부분만 검사한다. 게시·계약·교육 효과 검증은 아니다.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.SYNK_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../../..');
const { loadVisions } = require(path.join(root, 'tools/lib/비전정본.js'));
const visions = loadVisions();

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const rows = [];
  try {
    const page = await browser.newPage();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(pathToFileURL(path.join(root, 'docs/소개서_지면.html')).href);
      await page.evaluate(() => document.fonts.ready);
      for (const [tab, key] of [['lab', 'lab'], ['corp', 'synk'], ['shift', 'shift']]) {
        await page.locator('[data-key="' + tab + '"]').click();
        const pane = page.locator('#판-' + tab);
        const text = await pane.innerText();
        if (!text.includes(visions[key].headline)) throw new Error(key + ' 비전 누락');
        if (visions[key].subtext && !text.includes(visions[key].subtext)) throw new Error(key + ' 부연 누락');
        await page.evaluate(() => window.scrollTo(0, 0));
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        const screenshot = tab + '-' + width + '.png';
        await page.screenshot({ path: path.join(__dirname, screenshot) });
        rows.push({ file: 'docs/소개서_지면.html', tab, width, overflow, screenshot });
      }
      await page.goto(pathToFileURL(path.join(root, 'docs/SHIFT/SYNK_SHIFT_소개서.html')).href);
      await page.evaluate(() => document.fonts.ready);
      const text = await page.locator('body').innerText();
      if (!text.includes(visions.shift.headline) || !text.includes(visions.shift.subtext)) throw new Error('SHIFT 단독 지면 비전 누락');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      const screenshot = 'shift-single-' + width + '.png';
      await page.screenshot({ path: path.join(__dirname, screenshot) });
      rows.push({ file: 'docs/SHIFT/SYNK_SHIFT_소개서.html', width, overflow, screenshot });
    }
    fs.writeFileSync(path.join(__dirname, '화면검증.json'), JSON.stringify(rows, null, 2) + '\n');
    console.log(JSON.stringify(rows));
    if (rows.some(row => row.overflow > 1)) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
