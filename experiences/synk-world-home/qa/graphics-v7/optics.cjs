const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const checks = [], errors = [], observations = [], check = (name, condition) => { assert.ok(condition, name); checks.push(name); };
const root = path.resolve(__dirname, '../..'), base = 'http://127.0.0.1:4296';
const html = '<!doctype html><style>html,body{margin:0}#scene{width:100vw;height:100vh}</style><div id="scene"></div>';
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const [name, width, height] of [['pc', 1400, 720], ['phone', 390, 465]]) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: name === 'phone' ? 2 : 1, reducedMotion: 'no-preference' });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      await page.route('**/__optics-check', route => route.fulfill({ contentType: 'text/html', body: html }));
      await page.goto(base + '/__optics-check');
      await page.evaluate(async () => {
        const THREE = await import('/scene-assets/three.module.js'), dispose = THREE.Texture.prototype.dispose;
        window.reflectionReleases = 0;
        THREE.Texture.prototype.dispose = function (...args) { if (this.name === 'distant-city-reflection-v7') reflectionReleases++; return dispose.apply(this, args); };
        const { mountHomeScene } = await import('/scene-v3.mjs');
        window.study = await mountHomeScene(document.querySelector('#scene'), { reducedMotion: true }); study.setOutfit('scarf-apron'); study.setTime('sunset');
      });
      await page.waitForFunction(() => study.metrics().frameCount > 0);
      const metric = await page.evaluate(() => study.metrics()); observations.push({ name, initial: metric });
      const before = JSON.parse(fs.readFileSync(path.join(__dirname, 'before-capture.json'))).find(v => v.name === (name === 'pc' ? 'desktop' : 'mobile')).metrics;
      check(name + ' new materials compile without more draw calls', metric.drawCalls <= before.drawCalls);
      check(name + ' whole-frame triangle growth stays below 8 percent', metric.triangles / before.triangles < 1.08);
      check(name + ' no new render target or light for optics', metric.optics.extraRenderTargets === 0 && metric.optics.extraLights === 0);
      check(name + ' reflection represents the existing 70 buildings', metric.optics.reflectedBuildings === 70);
      if (name === 'phone') check('phone balanced retains zero AO buffers', !metric.contactLight.enabled && metric.contactLight.estimatedTargetBytes === 0);
      const first = await page.evaluate(() => study.capture());
      await page.waitForTimeout(250);
      check(name + ' reduced motion holds identical rendered pixels', first === await page.evaluate(() => study.capture()));
      await page.evaluate(() => study.setReducedMotion(false));
      await page.waitForFunction(() => study.metrics().optics.waterTime > .20);
      const moving = await page.evaluate(() => study.capture());
      check(name + ' running scene renders evolving pixels', moving !== first);
      await page.evaluate(() => study.setActive(false));
      const paused = await page.evaluate(() => ({ time: study.metrics().optics.waterTime, image: study.capture() }));
      await page.waitForTimeout(300);
      check(name + ' inactive scene freezes water and export pixels', await page.evaluate(p => study.metrics().optics.waterTime === p.time && study.capture() === p.image, paused));
      await page.evaluate(() => { study.setTime('day'); study.setView('detail'); study.capture({ highResolution: true }); });
      check(name + ' time and photo preserve canvas and interactive size', await page.evaluate(size => document.querySelectorAll('#scene canvas').length === 1 && study.metrics().drawingBuffer.width === size.width && study.metrics().drawingBuffer.height === size.height, metric.drawingBuffer));
      await page.evaluate(() => study.dispose()); await page.evaluate(() => study.dispose());
      check(name + ' reflection texture is released exactly once', await page.evaluate(() => reflectionReleases === 1 && !document.querySelector('canvas')));
      await context.close();
    }
    const context = await browser.newContext({ viewport: { width: 390, height: 465 } }), page = await context.newPage();
    await page.route('**/__optics-check', r => r.fulfill({ contentType: 'text/html', body: html }));
    const broken = fs.readFileSync(path.join(root, 'environment-optics-v7.mjs'), 'utf8').replace('float riverBand=', 'INVALID_OPTICS_GLSL; float riverBand=');
    await page.route('**/environment-optics-v7.mjs', r => r.fulfill({ contentType: 'text/javascript', body: broken }));
    await page.goto(base + '/__optics-check');
    const failure = await page.evaluate(async () => {
      let errors = 0, ready = 0;
      try { const { mountHomeScene } = await import('/scene-v3.mjs'); await mountHomeScene(document.querySelector('#scene'), { reducedMotion: true, onError: () => errors++, onReady: () => ready++ }); }
      catch (e) { return { error: e.message, errors, ready, canvasCount: document.querySelectorAll('canvas').length }; }
    });
    check('new water shader failure rejects, reports once and releases canvas', failure.error === 'SCENE_SHADER_ERROR' && failure.errors === 1 && failure.ready === 0 && failure.canvasCount === 0);
    await context.close(); check('normal flows have no browser or shader errors', errors.length === 0);
    const result = { checkedAt: new Date().toISOString(), passed: checks.length, checks, errors, observations, limits: ['Distant facade reflection atlas is an approximation; it does not reflect nearby or moving objects', 'Browser emulation, not physical mobile GPU/FPS/thermal measurement'] };
    fs.writeFileSync(path.join(__dirname, 'optics.json'), JSON.stringify(result, null, 2)); console.log({ passed: checks.length, errors });
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
