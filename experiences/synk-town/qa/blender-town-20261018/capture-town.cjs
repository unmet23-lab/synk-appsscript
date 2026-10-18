// Same-viewpoint capture of the core town for one variant (PNG + renderer.info,
// no fps: fps runs separately in perf-town.cjs, one at a time).
//   node capture-town.cjs <variant> [--district=<name>] [--poses=<poses.json>] [--record=1] [--out=<dir>]
// Views per viewport: core (a mid-height overview, set by hand on 10-18), follow / wide /
// cafe-close (the 10-17 poses) and
// home-close / workshop-close / greenhouse-close (recorded on the first v20 run).
const fs = require('node:fs'), path = require('node:path');
const L = require('../blender-district-20261017/lib.cjs');
const args = Object.fromEntries(process.argv.slice(3).map(a => a.replace(/^--/, '').split('=')));
const variant = process.argv[2];
if (!/^[a-z0-9-]+$/.test(variant || '')) throw Error('variant name required');
const out = path.resolve(args.out || path.join(__dirname, 'captures', variant));
const posesFile = path.resolve(args.poses || path.join(__dirname, 'poses.json'));
const oldPoses = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../../.tmp/town-blender-20261017/captures/poses.json'), 'utf8'));
const query = args.district ? '&district=' + args.district : '';
const VIEWPORTS = [{ width: 1280, height: 900 }, { width: 390, height: 844 }];
const PLACES = [['home', -6], ['workshop', 6]];

async function walkTo(page, place) {
  if (place === 'cafe') { await L.axis(page, 'x', -3); await L.axis(page, 'z', 2.5); await L.axis(page, 'x', 0); }
  else if (place === 'greenhouse') { await L.axis(page, 'x', -3); await L.axis(page, 'z', 2.5); await L.axis(page, 'z', -4); await L.axis(page, 'x', 0); }
  else { const x = PLACES.find(p => p[0] === place)[1]; await L.axis(page, 'z', 2.5); await L.axis(page, 'x', x); await L.axis(page, 'z', 1.8); }
  const w = await L.walkState(page); if (w.nearby !== place) throw Error(`not near ${place}: ` + JSON.stringify(w));
}

(async () => {
  let browser; const report = { variant, query, startedAt: new Date().toISOString(), viewports: {} };
  const record = args.record === '1' || !fs.existsSync(posesFile);
  const poses = record ? {} : JSON.parse(fs.readFileSync(posesFile, 'utf8'));
  try {
    fs.mkdirSync(out, { recursive: true });
    const { base } = await L.fixture(); browser = await L.launch({ gpu: args.gpu || 'default' });
    for (const viewport of VIEWPORTS) {
      const key = viewport.width + 'x' + viewport.height;
      const { page, errors, readyMs } = await L.openTown(browser, base, { ...viewport, query });
      const row = report.viewports[key] = { adapter: await L.adapter(page), readyMs, entry: await L.entryBytes(page), views: {} };
      row.district = (await L.metrics(page)).bakedDistrict || null;
      const shoot = async (view) => {
        const pose = poses[key + '-' + view];
        await page.evaluate(p => { globalThis.__townCam = p; }, pose); await L.delay(1200);
        const file = `${variant}-${key}-${view}.png`;
        await page.screenshot({ path: path.join(out, file) });
        const m = await L.metrics(page);
        row.views[view] = { file, pose, drawCalls: m.drawCalls, triangles: m.triangles, geometries: m.geometries, textures: m.textures };
        await page.evaluate(() => { globalThis.__townCam = null; });
      };
      // Every variant walks the same route so the player stands in the same place in each shot.
      await walkTo(page, 'cafe');
      await shoot('core');
      for (const view of ['follow', 'wide']) { if (record) poses[key + '-' + view] = oldPoses[key + '-' + view]; await shoot(view); }
      if (record) poses[key + '-cafe-close'] = oldPoses[key + '-close'];
      await shoot('cafe-close');
      // --cafe-only=1: the compression test changes the cafe alone; skip the walk to the other places.
      for (const place of args['cafe-only'] === '1' ? [] : ['home', 'workshop', 'greenhouse']) {
        const view = place + '-close';
        await walkTo(page, place);
        if (record) {
          await L.cameraMode(page, 'close'); await L.delay(900);
          const m = await L.metrics(page); poses[key + '-' + view] = { p: m.cameraPosition, t: m.cameraTarget, fov: m.cameraFov };
          await L.cameraMode(page, 'follow');
        }
        await shoot(view);
      }
      row.errors = errors.filter(e => !/avatar-textiles-v1|404/.test(e));
      await page.close();
    }
    if (record) fs.writeFileSync(posesFile, JSON.stringify(poses, null, 2) + '\n');
  } catch (e) { report.failure = String(e.stack || e); console.error(report.failure); process.exitCode = 1; }
  finally {
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    await L.closeAll(browser);
    console.log(JSON.stringify(Object.fromEntries(Object.entries(report.viewports).map(([k, v]) => [k, { entryKB: Math.round(v.entry.bytes / 1024), calls: v.views.follow?.drawCalls, tris: v.views.follow?.triangles }]))));
  }
})();
