// Same-viewpoint capture for one Town variant.
// node capture.cjs <variant> [--district=<name>] [--poses=<poses.json>] [--out=<dir>]
//   v20:     the approved code-built district (records the camera poses)
//   others:  ?district=<name> swaps the cafe district for assets/district/<name>.glb
// Each view: PNG, renderer.info, a 6 s stationary completed-frame rate.
const fs = require('node:fs'), path = require('node:path');
const L = require('./lib.cjs');
const args = Object.fromEntries(process.argv.slice(3).map(a => a.replace(/^--/, '').split('=')));
const variant = process.argv[2];
if (!/^[a-z0-9-]+$/.test(variant || '')) throw Error('variant name required');
const out = path.resolve(args.out || path.join(__dirname, 'captures', variant));
const posesFile = path.resolve(args.poses || path.join(__dirname, 'captures', 'poses.json'));
const query = args.district ? '&district=' + args.district : '';
const VIEWPORTS = [{ width: 1280, height: 900 }, { width: 390, height: 844 }];
const VIEWS = ['follow', 'close', 'wide'];

async function walkToCafe(page) {
  await L.axis(page, 'x', -3); await L.axis(page, 'z', 2.5); await L.axis(page, 'x', 0);
  const w = await L.walkState(page); if (w.nearby !== 'cafe') throw Error('not near cafe: ' + JSON.stringify(w));
  return w;
}

(async () => {
  let browser; const report = { variant, query, startedAt: new Date().toISOString(), viewports: {} };
  const recordPoses = !fs.existsSync(posesFile) || args.record === '1';
  const poses = recordPoses ? {} : JSON.parse(fs.readFileSync(posesFile, 'utf8'));
  try {
    fs.mkdirSync(out, { recursive: true });
    const { base } = await L.fixture(); browser = await L.launch({ gpu: args.gpu || 'default' });
    for (const viewport of VIEWPORTS) {
      const key = viewport.width + 'x' + viewport.height;
      const { page, errors, readyMs } = await L.openTown(browser, base, { ...viewport, query });
      const row = report.viewports[key] = { adapter: await L.adapter(page), readyMs, entry: await L.entryBytes(page), views: {} };
      const m0 = await L.metrics(page); row.environment = m0.environment && { triangles: m0.environment.environmentTriangles, meshes: m0.environment.environmentMeshes };
      row.district = (await L.metrics(page)).bakedDistrict;
      row.walk = await walkToCafe(page);
      for (const view of VIEWS) {
        await L.cameraMode(page, view === 'close' ? 'close' : view === 'wide' ? 'wide' : 'follow');
        await L.delay(600);
        const poseKey = key + '-' + view;
        if (recordPoses) { const m = await L.metrics(page); poses[poseKey] = { p: m.cameraPosition, t: m.cameraTarget, fov: m.cameraFov }; }
        await page.evaluate(pose => { globalThis.__townCam = pose; }, poses[poseKey]);
        await L.delay(900);
        const fps = await L.stationaryFps(page, 6);
        const file = `${variant}-${key}-${view}.png`;
        await page.screenshot({ path: path.join(out, file) });
        const m = await L.metrics(page);
        row.views[view] = { file, pose: poses[poseKey], appliedCamera: { p: m.cameraPosition, t: m.cameraTarget }, player: m.playerPose, ...fps };
        await page.evaluate(() => { globalThis.__townCam = null; });
      }
      row.errors = errors;
      await page.close();
    }
    if (recordPoses) fs.writeFileSync(posesFile, JSON.stringify(poses, null, 2) + '\n');
  } catch (e) { report.failure = String(e.stack || e); console.error(report.failure); process.exitCode = 1; }
  finally {
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    await L.closeAll(browser);
    const brief = Object.fromEntries(Object.entries(report.viewports).map(([k, v]) => [k, { entryKB: Math.round(v.entry.bytes / 1024), views: Object.fromEntries(Object.entries(v.views).map(([n, x]) => [n, { fps: x.fps, tris: x.triangles, calls: x.drawCalls }])) }]));
    console.log(JSON.stringify(brief));
  }
})();
