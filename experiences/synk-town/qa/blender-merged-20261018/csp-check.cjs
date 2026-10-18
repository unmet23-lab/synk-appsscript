// Does a baked set load on the plain local preview when the page's CSP is enforced
// (the QA harness opens pages with bypassCSP)? node experiences/synk-town/qa/blender-merged-20261018/csp-check.cjs <district> [width]
const path = require('node:path');
const L = require(path.resolve('experiences/synk-town/qa/blender-district-20261017/lib.cjs'));
(async () => {
  let b;
  try {
    const [name, w] = process.argv.slice(2), width = Number(w || 1280);
    const { base } = await L.fixture(); b = await L.launch();
    const page = await b.newPage({ viewport: { width, height: width < 700 ? 844 : 900 } });
    const errors = []; page.on('pageerror', e => errors.push(String(e).slice(0, 200))); page.on('console', m => { if (m.type() === 'error' && !/avatar-textiles|404/.test(m.text())) errors.push(m.text().slice(0, 200)); });
    await page.goto(base + '/day.html?play=walk&district=' + name);
    await page.waitForFunction(() => { const d = globalThis.SYNKTownDay?.metrics()?.bakedDistrict; return d && (d.loaded || d.failed); }, {}, { timeout: 90000 }).catch(() => {});
    const d = await page.evaluate(() => { const x = SYNKTownDay.metrics().bakedDistrict; return x && { loaded: x.loaded, failed: x.failed, textureBytes: x.textureBytes }; });
    console.log(JSON.stringify({ name, width, csp: 'enforced', district: d, errors: [...new Set(errors)].slice(0, 6) }, null, 1));
  } catch (e) { console.error(e); } finally { await L.closeAll(b); }
})();
