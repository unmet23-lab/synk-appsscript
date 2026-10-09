const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const checks = [], errors = [], observations = [];
const check = (name, value) => { assert.ok(value, name); checks.push(name); };
const html = '<!doctype html><style>html,body{margin:0}#scene{width:100vw;height:100vh}</style><div id="scene"></div>';
const base = 'http://127.0.0.1:4296';
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const [name, width, height] of [['pc', 1400, 720], ['phone', 390, 465], ['small', 320, 465]]) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: width < 600 ? 2 : 1, reducedMotion: 'no-preference' });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      await page.route('**/__river-home-check', r => r.fulfill({ contentType: 'text/html', body: html }));
      await page.goto(base + '/__river-home-check');
      await page.evaluate(async () => {
        const THREE = await import('/scene-assets/three.module.js');
        const add = THREE.Scene.prototype.add;
        THREE.Scene.prototype.add = function (...objects) {
          for (const object of objects) if (object.name === 'han-river-passing-launch-v8') window.testRiverGroup = object;
          return add.apply(this, objects);
        };
        const dispose = THREE.Material.prototype.dispose;
        window.boatMaterialReleases = [];
        THREE.Material.prototype.dispose = function (...args) {
          if (window.testBoatMaterials?.has(this)) boatMaterialReleases.push(this.uuid);
          return dispose.apply(this, args);
        };
        const { mountHomeScene } = await import('/scene-v3.mjs');
        window.study = await mountHomeScene(document.querySelector('#scene'), { reducedMotion: true });
        study.setOutfit('scarf-apron');
        window.testBoatMaterials = new Set(); testRiverGroup.traverse(object => { if (object.material) testBoatMaterials.add(object.material); });
      });
      await page.waitForFunction(() => study.metrics().frameCount > 0);
      const initial = await page.evaluate(() => study.metrics());
      check(name + ' v8 river is present without new lights, textures or targets', initial.visualRevision === 'environment-v8' && initial.riverLife.vesselCount === 1 && initial.riverLife.extraLights === 0 && initial.riverLife.extraRenderTargets === 0 && initial.riverLife.textureCount === 0);
      check(name + ' vessel geometry stays small', initial.riverLife.drawCalls <= 5 && initial.riverLife.triangles < 1600);
      check(name + ' render buffer stays within existing cap', initial.drawingBuffer.width * initial.drawingBuffer.height <= 3000000);
      if (name === 'phone') check('phone balanced has no AO buffer', initial.contactLight.estimatedTargetBytes === 0);
      if (name !== 'small') {
        const before = JSON.parse(fs.readFileSync(path.join(__dirname, 'before-capture.json'))).find(value => value.name === (name === 'pc' ? 'desktop' : 'mobile')).metrics;
        // The v7 reference is sunset. Its sun-shadow frustum sees a different
        // set of casters from daytime, so match time before comparing budgets.
        const budget = await page.evaluate(() => { study.setTime('sunset'); study.capture(); const metric = study.metrics(); study.setTime('day'); study.capture(); return metric; });
        check(name + ' same-time total frame triangles grow less than one percent', budget.triangles / before.triangles < 1.01);
        check(name + ' same-time total calls grow by at most ten', budget.drawCalls <= before.drawCalls + 10);
      }
      // Test the actual opaque vessel pixels after normal scene occlusion. The
      // transparent wake/reflection stays on in both images, so cannot pass this.
      const visible = await page.evaluate(async () => {
        study.setActive(false);
        const vessel = testRiverGroup.getObjectByName('cream-and-navy-river-launch');
        const withBoat = study.capture(); vessel.visible = false;
        const withoutBoat = study.capture(); vessel.visible = true; study.capture();
        const images = await Promise.all([withBoat, withoutBoat].map(async source => { const img = new Image(); img.src = source; await img.decode(); return img; }));
        const c = document.createElement('canvas'); c.width = images[0].width; c.height = images[0].height;
        const ctx = c.getContext('2d'); const arrays = images.map(image => { ctx.drawImage(image, 0, 0); return ctx.getImageData(0, 0, c.width, c.height).data; });
        let changed = 0, minX = c.width, maxX = 0, minY = c.height, maxY = 0;
        for (let i = 0; i < arrays[0].length; i += 4) {
          if (Math.abs(arrays[0][i] - arrays[1][i]) + Math.abs(arrays[0][i + 1] - arrays[1][i + 1]) + Math.abs(arrays[0][i + 2] - arrays[1][i + 2]) < 18) continue;
          changed++; const x = i / 4 % c.width, y = Math.floor(i / 4 / c.width); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
        return { changed, bounds: [minX, minY, maxX, maxY], pixelRatio: study.metrics().pixelRatio };
      });
      check(name + ' opaque boat is visible in the initial home', visible.changed / visible.pixelRatio ** 2 > 35 && (visible.bounds[2] - visible.bounds[0]) / visible.pixelRatio > 14);
      await page.screenshot({ path: path.join(__dirname, 'river-initial-' + name + '.png') });
      const fixed = await page.evaluate(() => ({ image: study.capture(), river: study.metrics().riverLife }));
      await page.waitForTimeout(300);
      check(name + ' inactive scene freezes vessel, wake and pixels', await page.evaluate(value => JSON.stringify(study.metrics().riverLife) === JSON.stringify(value.river) && study.capture() === value.image, fixed));
      const photo = await page.evaluate(() => { const before = study.metrics(); study.capture({ highResolution: true }); const after = study.metrics(); return { before: before.riverLife, after: after.riverLife, restored: JSON.stringify(before.drawingBuffer) === JSON.stringify(after.drawingBuffer) }; });
      check(name + ' high resolution export keeps vessel position and restores size', JSON.stringify(photo.before) === JSON.stringify(photo.after) && photo.restored);
      await page.evaluate(() => study.setTime('sunset'));
      check(name + ' sunset preserves the boat clock and position', await page.evaluate(value => study.metrics().riverLife.time === 'sunset' && study.metrics().riverLife.elapsed === value.elapsed && JSON.stringify(study.metrics().riverLife.position) === JSON.stringify(value.position), fixed.river));
      await page.screenshot({ path: path.join(__dirname, 'river-sunset-' + name + '.png') });
      await page.evaluate(() => { study.setReducedMotion(false); study.setActive(true); });
      await page.waitForFunction(() => study.metrics().riverLife.elapsed > .45);
      const moving = await page.evaluate(() => study.metrics().riverLife);
      check(name + ' vessel travels right in the existing scene loop', moving.position[0] > fixed.river.position[0] && Math.abs(moving.position[0] - fixed.river.position[0] - moving.elapsed * moving.routeSpeed) < .001);
      check(name + ' water and boat share scene elapsed time', await page.evaluate(() => Math.abs(study.metrics().optics.waterTime - study.metrics().riverLife.elapsed) < .001));
      await page.evaluate(() => study.setReducedMotion(true)); await page.waitForTimeout(150);
      const reduced = await page.evaluate(() => ({ frames: study.metrics().frameCount, river: study.metrics().riverLife })); await page.waitForTimeout(300);
      check(name + ' reduced motion sleeps and holds boat state', await page.evaluate(value => study.metrics().frameCount === value.frames && JSON.stringify(study.metrics().riverLife) === JSON.stringify(value.river), reduced));
      await page.evaluate(() => { study.setReducedMotion(false); document.querySelector('#scene').style.transform = 'translateY(200vh)'; });
      await page.waitForFunction(() => study.metrics().paused);
      const hidden = await page.evaluate(() => study.metrics().riverLife.elapsed); await page.waitForTimeout(250);
      check(name + ' offscreen home holds boat time', await page.evaluate(value => study.metrics().riverLife.elapsed === value, hidden));
      await page.evaluate(() => { document.querySelector('#scene').style.transform = ''; study.setReducedMotion(true); });
      await page.waitForFunction(() => !study.metrics().paused);
      await page.evaluate(() => { study.dispose(); study.dispose(); });
      check(name + ' all five boat materials are released exactly once', await page.evaluate(() => boatMaterialReleases.length === 5 && new Set(boatMaterialReleases).size === 5 && study.metrics().riverLife.disposed && !document.querySelector('#scene canvas')));
      observations.push({ name, initial, visible, moving }); await context.close();
    }
    check('no normal-flow browser or shader errors', errors.length === 0);
    const result = { checkedAt: new Date().toISOString(), passed: checks.length, checks, errors, observations, physicalDevices: 0 };
    fs.writeFileSync(path.join(__dirname, 'river-home.json'), JSON.stringify(result, null, 2)); console.log({ passed: checks.length, errors });
  } finally { await browser.close(); }
})().catch(error => { fs.writeFileSync(path.join(__dirname, 'river-home-failure.json'), JSON.stringify({ message: String(error), checks }, null, 2)); console.error(error); process.exitCode = 1; });
