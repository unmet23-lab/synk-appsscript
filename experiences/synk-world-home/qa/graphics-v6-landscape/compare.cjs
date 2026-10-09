const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.resolve(__dirname, '../..');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const ridgeOnly=process.argv.includes('--ridge'),prefix=ridgeOnly?'ridge-':'',baselineFixture=ridgeOnly?'before-ridge-v6.mjs':'before-garden.mjs';

(async () => {
  // Freeze both garden sources and reuse one scene/avatar source for the pair.
  // This isolates landscape costs while the shared scene is being improved.
  const sceneSource = fs.readFileSync(path.join(root, 'scene-v3.mjs'), 'utf8');
  const beforeGarden = fs.readFileSync(path.join(__dirname, baselineFixture), 'utf8');
  const currentGarden = fs.readFileSync(path.join(root, 'scene-v3-garden.mjs'), 'utf8');
  const landscapeMarker = 'export function makeLandscape';
  const gardenSources = {
    before: currentGarden.slice(0,currentGarden.indexOf(landscapeMarker))+beforeGarden.slice(beforeGarden.indexOf(landscapeMarker)),
    after: currentGarden,
  };
  const result = { checkedAt: new Date().toISOString(),baselineFixture, sourceSha256: { scene: sha(sceneSource), beforeGarden: sha(gardenSources.before), afterGarden: sha(gardenSources.after) }, views: [], assertions: [] };
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const [name, width, height, dpr] of [['desktop', 1400, 720, 1], ['mobile', 390, 465, 2]]) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, reducedMotion: 'reduce' });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.route('**/__landscape-v6', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><style>html,body{margin:0}#scene{width:100vw;height:100vh}</style><main id="scene"></main>' }));
      for (const version of ['before', 'after']) {
        await page.route(`**/__landscape-${version}-scene.mjs`, route => route.fulfill({ contentType: 'text/javascript', body: sceneSource.replace("'./scene-v3-garden.mjs'", `'/__landscape-${version}-garden.mjs'`) }));
        await page.route(`**/__landscape-${version}-garden.mjs`, route => route.fulfill({ contentType: 'text/javascript', body: gardenSources[version] }));
      }
      await page.goto('http://127.0.0.1:4296/__landscape-v6');
      for (const version of ['before', 'after']) {
        await page.evaluate(async version => { window.study?.dispose(); const { mountHomeScene } = await import(`/__landscape-${version}-scene.mjs`); window.study = await mountHomeScene(document.querySelector('#scene'), { reducedMotion: true }); study.setOutfit('scarf-apron'); }, version);
        await page.waitForFunction(() => study.metrics().frameCount > 0, null, { timeout: 60000 });
        for (const time of ['day', 'sunset']) {
          const previous = await page.evaluate(time => { const frame = study.metrics().frameCount; study.setTime(time); return frame; }, time);
          await page.waitForFunction(previous => study.metrics().frameCount > previous, previous);
          await page.screenshot({ path: path.join(__dirname, `${prefix}${version}-${name}-${time}.png`) });
        }
        const samples = [];
        for (let n = 0; n < 10; n++) {
          const previous = await page.evaluate(n => { const frame = study.metrics().frameCount; study.setTime(n % 2 ? 'day' : 'sunset'); return frame; }, n);
          await page.waitForFunction(previous => study.metrics().frameCount > previous, previous);
          if (n > 2) samples.push(await page.evaluate(() => study.metrics().renderSubmissionMs));
        }
        samples.sort((a, b) => a - b);
        result.views.push({ name, version, metrics: await page.evaluate(() => study.metrics()), cpuSubmissionMs: { samples: samples.length, median: samples[Math.floor(samples.length / 2)], min: samples[0], max: samples.at(-1) } });
      }
      result.assertions.push({ check: `${name}: no runtime or shader errors`, pass: errors.length === 0, errors });
      result.assertions.push({ check: `${name}: exactly one live scene`, pass: await page.locator('#scene canvas').count() === 1 });
      if (name === 'desktop') {
        const contract = await page.evaluate(async () => {
          const THREE = await import('/scene-assets/three.module.js'), { makeLandscape } = await import('/__landscape-after-garden.mjs');
          const build = () => {
            const scene = new THREE.Scene(), water = new THREE.MeshPhysicalMaterial(), value = makeLandscape(scene, { water });
            const summary = { stats: value.group.userData.landscapeStats, meshes: [], positionsFinite: true, normalsFinite: true, matricesFinite: true, shadowCasters: 0, sharedWater: false };
            value.group.traverse(object => {
              if (!object.isMesh) return;
              const p = object.geometry.attributes.position, normals = object.geometry.attributes.normal;
              summary.positionsFinite &&= Array.from(p.array).every(Number.isFinite);
              summary.normalsFinite &&= Array.from(normals.array).every(Number.isFinite);
              summary.matricesFinite &&= !object.isInstancedMesh || Array.from(object.instanceMatrix.array).every(Number.isFinite);
              summary.shadowCasters += object.castShadow ? 1 : 0;
              summary.sharedWater ||= object.name === 'han-river-water' && object.material === water;
              const weighted = array => Array.from(array).reduce((sum, n, i) => sum + n * (i % 31 + 1), 0);
              summary.meshes.push({ name: object.name, positions: weighted(p.array), matrices: object.isInstancedMesh ? weighted(object.instanceMatrix.array) : null, instances: object.count || 1 });
            });
            // Mirror scene ownership: every geometry/material has one disposal.
            const geometries = new Set(), materials = new Set();
            value.group.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) materials.add(object.material); });
            geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose());
            return summary;
          };
          const first = build(), second = build(); return { ...first, deterministic: JSON.stringify(first) === JSON.stringify(second) };
        });
        result.contract = contract;
        for (const check of ['positionsFinite', 'normalsFinite', 'matricesFinite', 'sharedWater', 'deterministic']) result.assertions.push({ check, pass: contract[check] });
      }
      await context.close();
    }
    for (const name of ['desktop', 'mobile']) {
      const before = result.views.find(v => v.name === name && v.version === 'before').metrics;
      const after = result.views.find(v => v.name === name && v.version === 'after').metrics;
      result.assertions.push({ check: `${name}: triangles at most 4% above baseline`, pass: after.triangles <= before.triangles * 1.04, before: before.triangles, after: after.triangles });
      // Current renderer metrics include the shadow geometry pass and optional
      // AO normal pass. The landscape adds two batches, not two total passes.
      const geometryPasses=1+Number(Boolean(after.renderStatsIncludeShadows))+Number(Boolean(after.contactLight?.enabled));
      result.assertions.push({ check: `${name}: at most two added batches per geometry pass`, pass: after.drawCalls <= before.drawCalls + 2*geometryPasses, geometryPasses, before: before.drawCalls, after: after.drawCalls });
    }
    result.assertions.push({check:'Building and canopy counts do not increase',pass:result.contract.stats.buildings===70&&result.contract.stats.treeCanopies===185});
    result.assertions.push({check:'Window count is lower than v5',pass:result.contract.stats.windowPanes<2872});
    result.limits = ['Headless desktop browser only; no physical phone or sustained thermal measurement.', 'CPU render submission is not a GPU timer or an FPS guarantee.', 'Both landscape revisions use the same captured current scene, courtyard and cached avatar, not different historical lighting or near foliage.'];
    fs.writeFileSync(path.join(__dirname, `${prefix}comparison.json`), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ assertions: result.assertions, views: result.views.map(v => ({ name: v.name, version: v.version, calls: v.metrics.drawCalls, triangles: v.metrics.triangles, cpu: v.cpuSubmissionMs })), stats: result.contract.stats }, null, 2));
    if (result.assertions.some(a => !a.pass)) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
