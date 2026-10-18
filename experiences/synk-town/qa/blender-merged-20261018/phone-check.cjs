// Open the same-Wi-Fi relay like a phone would (390x844, touch) and check the panel and the reports.
//   node experiences/synk-town/qa/blender-merged-20261018/phone-check.cjs <url> <name>
const path = require('node:path');
const L = require(path.resolve('experiences/synk-town/qa/blender-district-20261017/lib.cjs'));
(async () => {
  let b;
  try {
    const [url, name] = process.argv.slice(2);
    b = await L.launch();
    const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const errors = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(url);
    await page.waitForFunction(() => globalThis.SYNKTownDay?.metrics()?.assetsReady && SYNKTownDay.metrics().walk?.enabled, {}, { timeout: 90000 });
    await page.waitForFunction(() => { const d = SYNKTownDay.metrics().bakedDistrict; return !d?.deferred || d.deferred.loaded || d.deferred.failed; }, {}, { timeout: 90000 });
    await L.delay(7000);
    await page.screenshot({ path: `.tmp/town-merged-20261018/phone-${name}.png` });
    const panel = await page.evaluate(() => [...document.querySelectorAll('body > div')].map(d => d.textContent).find(t => /fps/.test(t)));
    console.log(JSON.stringify({ name, panel, errors: errors.filter(e => !/avatar-textiles|404/.test(e)) }, null, 1));
  } catch (e) { console.error(e); } finally { await L.closeAll(b); }
})();
