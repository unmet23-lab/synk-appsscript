// Stationary frame rate, alternating variants so drift (heat, background load)
// spreads evenly. Same walk to the cafe, same pinned camera poses as capture.cjs.
// node perf.cjs --variants=v20,cafe-claude,cafe-argon --rounds=3 --gpu=default --poses=<json> --out=<json>
const fs = require('node:fs'), path = require('node:path');
const L = require('./lib.cjs');
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const variants = (args.variants || 'v20').split(','), rounds = +(args.rounds || 3), seconds = +(args.seconds || 8);
const poses = JSON.parse(fs.readFileSync(path.resolve(args.poses), 'utf8'));
const VIEWPORTS = [{ width: 1280, height: 900 }, { width: 390, height: 844 }], VIEWS = ['follow', 'close', 'wide'];
const median = list => { const s = [...list].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
(async () => {
  let browser; const rows = [], started = new Date().toISOString();
  try {
    const { base } = await L.fixture(); browser = await L.launch({ gpu: args.gpu || 'default' });
    for (let r = 0; r < rounds; r++) {
      const order = variants.map((_, i) => variants[(i + r) % variants.length]);
      for (const variant of order) for (const viewport of VIEWPORTS) {
        const key = viewport.width + 'x' + viewport.height;
        const query = variant === 'v20' ? '' : '&district=' + variant;
        let opened;
        try {
        opened = await L.openTown(browser, base, { ...viewport, query, dpr: +(args.dpr || 1) });
        const { page, errors, readyMs } = opened;
        // The camera is pinned to the recorded pose, so the walk only needs to reach the cafe front.
        await L.axis(page, 'x', -3, .25); await L.axis(page, 'z', 2.5, .25); await L.axis(page, 'x', 0, .25);
        for (const view of VIEWS) {
          await L.cameraMode(page, view === 'wide' ? 'wide' : view);
          await page.evaluate(pose => { globalThis.__townCam = pose; }, poses[key + '-' + view]);
          await L.delay(1500);
          const fps = await L.stationaryFps(page, seconds);
          rows.push({ round: r, variant, viewport: key, view, readyMs, adapter: await L.adapter(page), ...fps, errors: errors.filter(e => !/404/.test(e)).length });
          await page.evaluate(() => { globalThis.__townCam = null; });
          console.log(JSON.stringify({ r, variant, key, view, fps: fps.fps, p50: fps.intervalMs.p50, cpu: fps.cpuRenderMs?.p50 }));
        }
        await page.close();
        } catch (error) {
          rows.push({ round: r, variant, viewport: key, failed: String(error.message || error) }); console.log(JSON.stringify({ r, variant, key, failed: String(error.message || error) }));
          await opened?.page.close().catch(() => {});
        }
      }
    }
  } catch (e) { console.error(e.stack || e); process.exitCode = 1; }
  finally {
    await L.closeAll(browser);
    const summary = {};
    for (const row of rows.filter(row => !row.failed)) {
      const k = `${row.variant}|${row.viewport}|${row.view}`;
      (summary[k] ||= { variant: row.variant, viewport: row.viewport, view: row.view, fps: [], intervalP50: [], cpuP50: [], triangles: row.triangles, drawCalls: row.drawCalls, adapter: row.adapter?.renderer });
      summary[k].fps.push(row.fps); summary[k].intervalP50.push(row.intervalMs.p50); summary[k].cpuP50.push(row.cpuRenderMs?.p50);
    }
    for (const s of Object.values(summary)) { s.fpsMedian = median(s.fps); s.intervalP50Median = median(s.intervalP50); s.cpuP50Median = median(s.cpuP50.filter(Number.isFinite)); }
    fs.writeFileSync(path.resolve(args.out), JSON.stringify({ started, finished: new Date().toISOString(), gpu: args.gpu || 'default', dpr: +(args.dpr || 1), rounds, seconds, summary: Object.values(summary), rows }, null, 2) + '\n');
  }
})();
