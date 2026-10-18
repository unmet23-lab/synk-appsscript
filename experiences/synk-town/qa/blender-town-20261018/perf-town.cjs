// Stationary frame rate of the core-town variants (one measurement at a time:
// check that no other measurement, blender.exe or agy.exe is running first).
//   node perf-town.cjs --variants=v20,town-claude,town-argon --rounds=7 --dpr=2 --poses=<poses.json> --out=<json> [--views=core,follow,cafe-close,home-close] [--gpu=default]
// Variants alternate their order every round so drift spreads evenly. The out
// file is rewritten after every view, so an interrupted run still keeps its rows.
const fs = require('node:fs'), path = require('node:path');
const L = require('../blender-district-20261017/lib.cjs');
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const variants = (args.variants || 'v20').split(','), rounds = +(args.rounds || 7), seconds = +(args.seconds || 8);
const views = (args.views || 'core,follow,cafe-close,home-close').split(',');
const poses = JSON.parse(fs.readFileSync(path.resolve(args.poses), 'utf8'));
const VIEWPORTS = [{ width: 1280, height: 900 }, { width: 390, height: 844 }];
const median = list => { const s = [...list].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const rows = [], started = new Date().toISOString();
function save(final = false) {
  const summary = {};
  for (const row of rows.filter(row => !row.failed)) {
    const k = `${row.variant}|${row.viewport}|${row.view}`;
    (summary[k] ||= { variant: row.variant, viewport: row.viewport, view: row.view, fps: [], drawCalls: row.drawCalls, triangles: row.triangles, adapter: row.adapter?.renderer });
    summary[k].fps.push(row.fps);
  }
  for (const s of Object.values(summary)) s.fpsMedian = median(s.fps);
  fs.writeFileSync(path.resolve(args.out), JSON.stringify({ started, finished: final ? new Date().toISOString() : null, gpu: args.gpu || 'default', dpr: +(args.dpr || 1), rounds, seconds, views, summary: Object.values(summary), rows }, null, 2) + '\n');
}
(async () => {
  let browser;
  try {
    const { base } = await L.fixture(); browser = await L.launch({ gpu: args.gpu || 'default' });
    for (let r = 0; r < rounds; r++) {
      const order = variants.map((_, i) => variants[(i + r) % variants.length]);
      for (const variant of order) for (const viewport of VIEWPORTS) {
        const key = viewport.width + 'x' + viewport.height, query = variant === 'v20' ? '' : '&district=' + variant;
        let opened;
        try {
          opened = await L.openTown(browser, base, { ...viewport, query, dpr: +(args.dpr || 1) });
          const { page, errors, readyMs } = opened;
          // The camera is pinned to recorded poses; the walk only parks the player in front of the cafe.
          await L.axis(page, 'x', -3, .25); await L.axis(page, 'z', 2.5, .25); await L.axis(page, 'x', 0, .25);
          const district = (await L.metrics(page)).bakedDistrict || null;
          for (const view of views) {
            await page.evaluate(pose => { globalThis.__townCam = pose; }, poses[key + '-' + view]);
            await L.delay(1500);
            const fps = await L.stationaryFps(page, seconds);
            rows.push({ round: r, variant, viewport: key, view, readyMs, adapter: await L.adapter(page), textureBytes: district?.textureBytes ?? 0, ...fps, errors: errors.filter(e => !/404/.test(e)).length });
            await page.evaluate(() => { globalThis.__townCam = null; });
            console.log(JSON.stringify({ r, variant, key, view, fps: fps.fps, calls: fps.drawCalls }));
            save();
          }
          await page.close();
        } catch (error) {
          rows.push({ round: r, variant, viewport: key, failed: String(error.message || error) }); console.log(JSON.stringify({ r, variant, key, failed: String(error.message || error) }));
          await opened?.page.close().catch(() => {}); save();
        }
      }
    }
  } catch (e) { console.error(e.stack || e); process.exitCode = 1; }
  finally { await L.closeAll(browser); save(true); }
})();
