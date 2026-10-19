// Exports the approved v20 environment as reference/occluder GLBs for Blender.
// node experiences/synk-town/qa/blender-district-20261017/export-ref.cjs <outDir>
const fs = require('node:fs'), path = require('node:path');
const { fixture, launch, openTown, adapter, closeAll } = require('./lib.cjs');
const { DISTRICT } = require('./district.cjs');
const outDir = path.resolve(process.argv[2] || path.join(__dirname, 'reference'));
(async () => {
  let browser;
  try {
    fs.mkdirSync(outDir, { recursive: true });
    const { base } = await fixture(); browser = await launch();
    const { page, errors } = await openTown(browser, base, { width: 1280, height: 900, bypassCSP: true }); // addScriptTag below is an inline script
    await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'export-browser.js'), 'utf8') });
    const result = await page.evaluate(box => globalThis.__exportTown(box), DISTRICT.bounds);
    fs.writeFileSync(path.join(outDir, 'v20_district_ref.glb'), Buffer.from(result.district, 'base64'));
    fs.writeFileSync(path.join(outDir, 'v20_surroundings.glb'), Buffer.from(result.surroundings, 'base64'));
    const env = await page.evaluate(() => SYNKTownDay.metrics().environment);
    fs.writeFileSync(path.join(outDir, 'export-report.json'), JSON.stringify({ exportedAt: new Date().toISOString(), district: DISTRICT, adapter: await adapter(page), environment: { triangles: env.environmentTriangles, meshes: env.environmentMeshes, instances: env.environmentInstances }, report: result.report, errors }, null, 2) + '\n');
    console.log(JSON.stringify({ district: result.report.district.triangles, surroundings: result.report.surroundings.triangles, errors: errors.length }));
  } catch (e) { console.error(e.stack || e); process.exitCode = 1; } finally { await closeAll(browser); }
})();
