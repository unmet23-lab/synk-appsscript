const fs = require('node:fs');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const scene = JSON.parse(fs.readFileSync('scenes.json', 'utf8')).find(s => s.id === 'repeat-memo');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto('http://127.0.0.1:5197/video-v17/index.html');
  await page.evaluate(() => document.fonts.ready);
  const results = [];
  for (const offset of [2.8, 3.5, 6.5]) {
    const state = await page.evaluate(t => {
      document.querySelectorAll('.clip').forEach(e => e.style.display = e.id === 'repeat-memo' ? 'block' : 'none');
      window.__timelines.main.seek(t);
      return [
        Number(getComputedStyle(document.querySelector('#repeat-memo .cam-mask')).opacity),
        Number(getComputedStyle(document.querySelector('#repeat-memo .cam-mask-later')).opacity),
      ];
    }, scene.start + offset);
    await page.screenshot({ path: `verification/repeat-memo-${offset}.png` });
    results.push({ offset, requestMask: state[0], memoMask: state[1] });
  }
  await browser.close();
  if (!(results[0].requestMask > .9 && results[0].memoMask > .9 &&
        results[1].requestMask < .1 && results[1].memoMask > .9 &&
        results[2].requestMask < .1 && results[2].memoMask < .1)) {
    throw Error(JSON.stringify(results));
  }
  console.log(JSON.stringify(results));
})();
