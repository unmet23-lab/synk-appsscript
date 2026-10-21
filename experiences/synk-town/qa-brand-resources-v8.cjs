// Real WebGL lifecycle check, using only static assets and no account/save APIs.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const town = __dirname, home = path.resolve(town, '../synk-world-home');
const outputFlag = process.argv.indexOf('--output');
if (outputFlag >= 0 && (!process.argv[outputFlag + 1] || process.argv[outputFlag + 1].startsWith('--'))) throw Error('--output requires a report path relative to synk-town');
const outputPath = path.resolve(town, outputFlag >= 0 ? process.argv[outputFlag + 1] : 'qa/graphics-v8/resources.json');
const routes = Object.fromEntries(['day-scene.mjs', 'day-character.mjs', 'day-residents.mjs', 'day-environment.mjs', 'day-materials.mjs', 'day-rendering.mjs'].map(name => [`/${name}`, path.join(town, name)]));
for (const name of ['Pass', 'RenderPass', 'EffectComposer', 'ShaderPass', 'MaskPass', 'OutputPass', 'CopyShader', 'OutputShader', 'SSAOPass', 'SSAOShader', 'SimplexNoise']) routes[`/rendering/${name}.js`] = path.join(town, 'rendering', `${name}.js`);
routes['/avatar-v3.mjs'] = path.join(home, 'avatar-v3.mjs');
routes['/avatar-textiles.mjs'] = path.join(home, 'avatar-textiles.mjs');
for (const name of ['three.module.js', 'three.core.js']) routes[`/scene-assets/${name}`] = path.join(home, 'scene-assets', name);
for (const name of ['azure-sky-v3.jpg', 'azure-sky-v3-mobile.jpg', 'terrain-normal.jpg', 'cliff-normal.jpg']) routes[`/day-assets/${name}`] = path.join(home, 'scene-assets/graphics-v2', name);
for (const prefix of ['assets', 'day-assets']) routes[`/${prefix}/felt-coral.webp`] = path.join(home, 'assets/felt-coral.webp');
const sourceNames = ['day-scene.mjs', 'day-character.mjs', 'day-residents.mjs', 'day-environment.mjs', 'day-materials.mjs', 'day-rendering.mjs'];
const sourceHashes = () => Object.fromEntries(sourceNames.map(name => [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(town, name))).digest('hex')]));
const report = { scope: 'isolated static scene including authored memory/table/cushion presentation fixtures; no accounts, commands, saved state or external requests; authoritative completion truth verified separately', sourceHashes: sourceHashes(), cases: [], errors: [] };
const server = http.createServer((request, response) => {
  if (request.url === '/') { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end('<!doctype html><meta charset="utf-8"><style>body{margin:0}canvas{display:block;width:100vw;height:100vh}</style><canvas></canvas>'); return; }
  const file = routes[request.url]; if (!file) { response.writeHead(404).end(); return; }
  const type = /\.webp$/.test(file) ? 'image/webp' : /\.jpg$/.test(file) ? 'image/jpeg' : 'text/javascript';
  response.writeHead(200, { 'Content-Type': type }); response.end(fs.readFileSync(file));
});
async function prepare(page, base) {
  page.on('pageerror', error => report.errors.push(error.message)); await page.goto(base);
  await page.evaluate(async () => {
    const created = new Set(), deleted = new Set(), instances = new Set(), disposed = new Set(), contexts = new Set();
    for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      const make = proto.createBuffer, drop = proto.deleteBuffer;
      proto.createBuffer = function (...args) { contexts.add(this); const buffer = make.apply(this, args); if (buffer) created.add(buffer); return buffer; };
      proto.deleteBuffer = function (...args) { if (created.has(args[0])) deleted.add(args[0]); return drop.apply(this, args); };
    }
    const T = await import('/scene-assets/three.module.js'), add = T.Object3D.prototype.add, drop = T.InstancedMesh.prototype.dispose;
    T.Object3D.prototype.add = function (...objects) { objects.forEach(o => { if (o.isInstancedMesh) instances.add(o); }); return add.apply(this, objects); };
    T.InstancedMesh.prototype.dispose = function (...args) { disposed.add(this); return drop.apply(this, args); };
    window.probe = {
      snapshot: () => ({ createdBuffers: created.size, deletedBuffers: deleted.size, remainingBuffers: created.size - deleted.size, contextReleased: contexts.size > 0 && [...contexts].every(gl => gl.isContextLost()), instances: instances.size, disposedInstances: disposed.size }),
      disposeInstances: () => instances.forEach(o => o.dispose()),
    };
    window.makeScene = (await import('/day-scene.mjs')).createDayScene;
  });
}
async function startScene(page) {
  await page.evaluate(() => {
    window.study = makeScene(document.querySelector('canvas'));
    study.render({ freeWalk: true, location: 'cafe', player: { x: 0, z: 2.5 }, npcs: [], props: [{id:'qa-table',kind:'bazaar-table',x:0,z:1},{id:'qa-cushion',kind:'cushion',x:-6,z:0}], memories: [{resultId:'QA:presentation-only',kind:'tea',role:'planner',location:'cafe',choice:'separate'}] }, { camera: 'wide', reducedMotion: true });
  });
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
    const base = `http://127.0.0.1:${server.address().port}/`;
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } }); await prepare(page, base); await startScene(page);
    await page.waitForFunction(() => study.stats().assetsReady && study.stats().ready);
    report.loadedStats = await page.evaluate(() => study.stats());
    assert.equal(report.loadedStats.graphicsVersion, 8);
    assert.equal(report.loadedStats.brandArt.materialVersion, 8);
    assert.equal(report.loadedStats.brandArt.memoryMarkers.length, 1, 'Presentation memory textile is actually created before disposal');
    assert.equal(report.loadedStats.propCount, 2, 'Table and cushion textile fixtures are actually created before disposal');
    const normal = await page.evaluate(() => {
      const before = probe.snapshot(); study.dispose(); const after = probe.snapshot();
      probe.disposeInstances(); return { name: 'loaded-scene-disposal', before, after, afterExplicitInstanceDisposal: probe.snapshot() };
    }); report.cases.push(normal);
    assert.equal(normal.after.disposedInstances, normal.after.instances, 'Every environment/avatar instance must release its own matrix/color buffers');
    assert.equal(normal.afterExplicitInstanceDisposal.deletedBuffers, normal.after.deletedBuffers, 'Manual instance disposal must not find leaked buffers');
    assert.equal(normal.after.contextReleased, true, 'The scene-owned context must release renderer-internal VSM resources');
    await page.close();
    const slow = await browser.newPage({ viewport: { width: 390, height: 844 } }); await prepare(slow, base);
    await slow.route(/\.(webp|jpg)$/, async route => { await new Promise(resolve => setTimeout(resolve, 350)); await route.continue(); });
    const immediate = await slow.evaluate(() => {
      window.study = makeScene(document.querySelector('canvas'));
      study.dispose(); return probe.snapshot();
    });
    await slow.waitForFunction(() => study.stats().assetsReady); const settled = await slow.evaluate(() => probe.snapshot());
    report.cases.push({ name: 'dispose-before-textures-and-avatar-resolve', immediatelyDisposed: immediate, afterPendingLoads: settled });
    assert.equal(settled.createdBuffers, immediate.createdBuffers, 'Late asset completion must not allocate new GPU buffers after disposal');
    assert.equal(settled.disposedInstances, settled.instances, 'Late avatar geometry must also be disposed');
    assert.equal(settled.contextReleased, true, 'The context must remain released after late asset completion');
    assert.deepEqual(report.errors, []);
    report.sourceHashesAfter = sourceHashes();
    assert.deepEqual(report.sourceHashesAfter, report.sourceHashes, 'Product sources must stay unchanged through resource capture');
    report.passed = true;
  } finally {
    await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  }
  console.log(JSON.stringify(report, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
