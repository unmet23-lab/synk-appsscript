// Shared harness for the 10-17 Blender district comparison.
// It reuses the v10/v20 QA conventions: a fresh in-memory Town store, the local
// preview server, headless Edge with WebGL, native keyboard walking and the
// product camera modes. The only addition is a capture-time debug hook served
// through page.route; product files on disk are not modified by this harness.
const fs = require('node:fs'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const town = path.resolve(__dirname, '../..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const servers = [];

async function fixture() {
  const { createStore, createServer } = await import(pathToFileURL(path.join(town, 'server.mjs')).href);
  const store = createStore({ lifeEnabled: true }), server = createServer({ previewEnabled: true, store });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); servers.push(server);
  return { store, base: `http://127.0.0.1:${server.address().port}` };
}

// Capture-only hook: expose the scene, and let the harness pin the camera to
// an exact recorded pose after the product camera has been placed.
const SCENE_PATCHES = [
  ['world.updateMatrixWorld(true);\n  const fixedSupports',
    'world.updateMatrixWorld(true);\n  globalThis.__townDebug = { THREE, scene, world, camera, renderer, m, environmentArt, buildings, light };\n  const fixedSupports'],
  ['cameraTarget.lerp(target, cameraBlend); camera.lookAt(cameraTarget);',
    'cameraTarget.lerp(target, cameraBlend); camera.lookAt(cameraTarget); if (globalThis.__townCam) { const o = globalThis.__townCam; camera.position.fromArray(o.p); if (camera.fov !== o.fov) { camera.fov = o.fov; camera.updateProjectionMatrix(); } camera.lookAt(o.t[0], o.t[1], o.t[2]); }'],
];

// extra: { "<file>.mjs": [[from, to], ...] } patches other Town modules the same way (capture-only).
async function patchRoutes(page, extra = {}) {
  for (const [file, patches] of Object.entries(extra)) await page.route('**/' + file, async route => {
    let body = fs.readFileSync(path.join(town, file), 'utf8').replace(/\r\n/g, '\n');
    for (const [from, to] of patches) {
      if (!body.includes(from)) throw Error(file + ' patch anchor missing: ' + from.slice(0, 40));
      body = body.replace(from, to);
    }
    await route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body });
  });
  await page.route('**/day-scene.mjs', async route => {
    let body = fs.readFileSync(path.join(town, 'day-scene.mjs'), 'utf8').replace(/\r\n/g, '\n');
    for (const [from, to] of SCENE_PATCHES) {
      if (!body.includes(from)) throw Error('scene patch anchor missing: ' + from.slice(0, 40));
      body = body.replace(from, to);
    }
    await route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body });
  });
}

// gpu: 'default' lets Windows pick (this laptop: the Intel iGPU, like most
// visitors' laptops); 'high' asks Chromium for the discrete RTX GPU.
async function launch({ gpu = 'default' } = {}) {
  return chromium.launch({ channel: 'msedge', headless: true,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--disable-gpu-shader-disk-cache', ...(gpu === 'high' ? ['--force_high_performance_gpu'] : [])] });
}

const metrics = page => page.evaluate(() => globalThis.SYNKTownDay?.metrics());
const walkState = page => metrics(page).then(m => m.walk);
async function until(fn, label, ms = 20000) { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return; await delay(80); } throw Error('timeout: ' + label); }
async function quiet(page) { await until(async () => { const w = await walkState(page); return !w.moving && !w.sending && w.pending === 0 && await page.locator('#day-app').getAttribute('aria-busy') !== 'true'; }, 'input settles'); }
async function focus(page) { await page.bringToFront(); await page.locator('#scene').focus(); }
async function axis(page, dimension, target, tolerance = .10) {
  await focus(page); const end = Date.now() + 22000;
  while (Date.now() < end) {
    const p = await walkState(page), delta = target - p[dimension];
    if (Math.abs(delta) <= tolerance) return p;
    const key = dimension === 'x' ? (delta > 0 ? 'd' : 'a') : (delta > 0 ? 's' : 'w');
    const planned = Math.min(550, Math.max(1, (Math.abs(delta) - .04) / 3.2 * 1000 - 8));
    await page.keyboard.down(key); try { await delay(planned); } finally { await page.keyboard.up(key); }
    await quiet(page);
  }
  throw Error(`axis ${dimension} ${target}`);
}
async function cameraMode(page, mode) {
  for (let i = 0; i < 5; i++) { if ((await metrics(page)).camera === mode) { await delay(550); return; } await page.locator('#camera-toggle').click(); }
  throw Error('camera ' + mode);
}

async function openTown(browser, base, { width, height, query = '', dpr = 1, patches = {} }) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr, bypassCSP: true, ...(width < 700 ? { isMobile: true, hasTouch: true } : {}) });
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(String(e.stack || e)));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('requestfinished', async request => {
    try { const r = await request.response(); const sizes = await request.sizes(); requests.push({ url: request.url().replace(base, ''), status: r?.status(), bytes: sizes.responseBodySize, type: r?.headers()['content-type'] }); } catch { }
  });
  await patchRoutes(page, patches);
  const started = Date.now();
  await page.goto(base + '/day.html?play=walk' + query);
  await page.waitForFunction(() => globalThis.SYNKTownDay?.metrics()?.assetsReady && SYNKTownDay.metrics().walk?.enabled, {}, { timeout: 90000 });
  const readyMs = Date.now() - started;
  // Deferred district parts (the 10-18 outer ring) arrive after the core: wait for them too.
  await page.waitForFunction(() => { const d = SYNKTownDay.metrics().bakedDistrict; return !d?.deferred || d.deferred.loaded || d.deferred.failed; }, {}, { timeout: 90000 });
  await focus(page); await quiet(page); await delay(700);
  return { page, errors, requests, readyMs };
}

// Stationary rate: completed product frames per second over a fixed window.
async function stationaryFps(page, seconds = 6) {
  return page.evaluate(async seconds => {
    const m0 = SYNKTownDay.metrics(), t0 = performance.now();
    const intervals = []; let last = t0, lastCount = m0.frameCount;
    await new Promise(resolve => {
      const tick = now => {
        const count = SYNKTownDay.metrics().frameCount;
        if (count !== lastCount) { intervals.push(now - last); last = now; lastCount = count; }
        if (now - t0 < seconds * 1000) requestAnimationFrame(tick); else resolve();
      };
      requestAnimationFrame(tick);
    });
    const m1 = SYNKTownDay.metrics(), elapsed = (performance.now() - t0) / 1000;
    const sorted = [...intervals].sort((a, b) => a - b), q = f => sorted.length ? +sorted[Math.floor((sorted.length - 1) * f)].toFixed(2) : null;
    return { seconds: +elapsed.toFixed(2), frames: m1.frameCount - m0.frameCount, fps: +((m1.frameCount - m0.frameCount) / elapsed).toFixed(2),
      intervalMs: { p50: q(.5), p95: q(.95) }, cpuRenderMs: m1.cpuRenderMs, drawCalls: m1.drawCalls, triangles: m1.triangles, geometries: m1.geometries, textures: m1.textures, dpr: m1.dpr, drawingBuffer: m1.drawingBuffer };
  }, seconds);
}

// Bytes the first entry downloads: document + every resource (no-store server,
// so encodedBodySize is the wire body; nothing comes from cache).
async function entryBytes(page) {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0], rows = performance.getEntriesByType('resource').map(e => ({ name: new URL(e.name).pathname, bytes: e.encodedBodySize, decoded: e.decodedBodySize, ms: Math.round(e.duration) }));
    const byType = {}; for (const r of rows) { const t = (r.name.match(/\.([a-z0-9]+)$/) || [, 'other'])[1]; byType[t] = (byType[t] || 0) + r.bytes; }
    return { documentBytes: nav?.encodedBodySize || 0, resources: rows.length, bytes: (nav?.encodedBodySize || 0) + rows.reduce((n, r) => n + r.bytes, 0), byType, district: rows.filter(r => /\/assets\/district\/|GLTFLoader|BufferGeometryUtils|day-district/.test(r.name)) };
  });
}

async function adapter(page) {
  return page.evaluate(() => { const gl = document.querySelector('#scene canvas').getContext('webgl2'), e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? { vendor: gl.getParameter(e.UNMASKED_VENDOR_WEBGL), renderer: gl.getParameter(e.UNMASKED_RENDERER_WEBGL) } : { available: false }; });
}

async function closeAll(browser) {
  try { await browser?.close(); } catch { }
  for (const server of servers) { server.closeAllConnections?.(); await new Promise(resolve => server.close(resolve)); }
}

module.exports = { town, delay, fixture, launch, openTown, metrics, walkState, quiet, focus, axis, cameraMode, stationaryFps, entryBytes, adapter, closeAll };
