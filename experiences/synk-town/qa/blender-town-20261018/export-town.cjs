// Exports the approved v20 core town as per-part reference GLBs for Blender.
//   node experiences/synk-town/qa/blender-town-20261018/export-town.cjs <outDir>
// Writes v20_<part>.glb for home, cafe, workshop, greenhouse, town_ground, live
// and export-report.json. Product files are not modified: material keys are
// attached only in the served copy of day-environment.mjs (capture-time patch).
const fs = require('node:fs'), path = require('node:path');
const L = require('../blender-district-20261017/lib.cjs');
const CORE = { minX: -13.6, maxX: 13.6, minZ: -12.2, maxZ: 8.7 };
const KEYED = ['stem', 'foliage', 'flowers', 'bark', 'stone', 'paving', 'mortar', 'gravel', 'gardenSoil', 'homePlaster', 'cafePlaster', 'workshopPlaster',
  'shutters', 'metal', 'glassBacking', 'interiorPlaster', 'farFoliage', 'cloth', 'guideCloth', 'coral', 'butter', 'terrainMaterial', 'cliffMaterial', 'greenhouseGlass'];
const PATCHES = { 'day-environment.mjs': [
  ["  const ground = root('town-landscape', [0, .20, 0]);",
    `  for (const [k, v] of Object.entries({ ${KEYED.join(', ')} })) if (v && !v.userData.synkKey) v.userData.synkKey = k;\n  const ground = root('town-landscape', [0, .20, 0]);`],
  ["const grass = material({ color: '#ffffff', roughness: .93, side: THREE.DoubleSide });",
    "const grass = material({ color: '#ffffff', roughness: .93, side: THREE.DoubleSide }); grass.userData.synkKey = 'grass';"],
] };
module.exports = { CORE, PATCHES };
if (require.main === module) (async () => {
  const outDir = path.resolve(process.argv[2] || path.join(__dirname, 'reference'));
  let browser;
  try {
    fs.mkdirSync(outDir, { recursive: true });
    const { base } = await L.fixture(); browser = await L.launch();
    const { page, errors } = await L.openTown(browser, base, { width: 1280, height: 900, patches: PATCHES });
    await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'export-town-browser.js'), 'utf8') });
    const result = await page.evaluate(core => globalThis.__exportCoreTown(core), CORE);
    const names = { home: 'v20_home', cafe: 'v20_cafe', workshop: 'v20_workshop', greenhouse: 'v20_greenhouse', ground: 'v20_town_ground', live: 'v20_live' };
    for (const [part, file] of Object.entries(names)) fs.writeFileSync(path.join(outDir, file + '.glb'), Buffer.from(result.files[part], 'base64'));
    for (const [file, data] of Object.entries(result.mapFiles)) fs.writeFileSync(path.join(outDir, file), Buffer.from(data, 'base64'));
    const summary = Object.fromEntries(Object.entries(result.report).map(([k, r]) => [k, { meshes: r.meshes, triangles: r.triangles }]));
    fs.writeFileSync(path.join(outDir, 'export-report.json'), JSON.stringify({ exportedAt: new Date().toISOString(), core: CORE, adapter: await L.adapter(page), summary, groundInstances: result.groundInstances, report: result.report, errors }, null, 2) + '\n');
    console.log(JSON.stringify({ summary, groundInstances: result.groundInstances, errors: errors.filter(e => !/404/.test(e)).length }));
  } catch (e) { console.error(e.stack || e); process.exitCode = 1; } finally { await L.closeAll(browser); }
})();
