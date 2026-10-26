// 지금 화면(구운 동네 전체 판)과 디오라마 시안을 같은 시각 · 같은 카메라 · 같은 기기 크기로 찍고 잰다.
// 시계 · 기기 · 프레임 재는 법은 qa-light-ui.cjs(W7)와 같다: 낮 12:30 · 해 질 녘 17:20 · 저녁 18:30 · 밤 23:45,
// 맑은 날 2026-10-25 · 비 오는 날 2026-10-29, PC 1440×900 · 휴대폰 390×844 DPR 3(CPU ×4 늦춤, 참고값).
//   node experiences/synk-town/qa/look-diorama-20261026/capture.cjs [--out <dir>] [--only id,…] [--seconds 12] [--no-fps] [--walk]
// --walk adds the walking rows (a key held for the whole measurement, so every frame is drawn).
const fs = require('node:fs'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const flag = name => process.argv.includes(name);
const here = __dirname, town = path.resolve(here, '../..');
const output = path.resolve(arg('--out', path.join(town, '../../.tmp/look-diorama-20261026/capture')));
const only = arg('--only', '') ? new Set(arg('--only', '').split(',')) : null;
const seconds = Number(arg('--seconds', 12)), measure = !flag('--no-fps');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const kst = (date, time) => Date.parse(`${date}T${time}:00+09:00`);
const BANDS = [['day', '12:30'], ['sunset', '17:20'], ['evening', '18:30'], ['night', '23:45']];
const DEVICES = { desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } };
const LOOKS = { now: 'townwide-merged', diorama: 'diorama' };
const ART = /assets\/district\/|rendering\/(basis\/|GLTFLoader|KTX2Loader|meshopt|WorkerPool|ktx-parse|zstddec|BufferGeometryUtils)|\/look\/|day-district/;
const known404 = /avatar-textiles-v1/;

async function fixture(startMs) {
  const { createStore, createServer } = await import(pathToFileURL(path.join(town, 'server.mjs')).href);
  const { withLook } = await import(pathToFileURL(path.join(here, 'serve.mjs')).href);
  const real = Date.now(), now = () => startMs + (Date.now() - real);
  const store = createStore({ lifeEnabled: true, now, tz: 540, villageSeed: 'synk-town', sleeps: true });
  const server = withLook(createServer({ previewEnabled: true, store }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}
const quantile = (list, q) => { const s = [...list].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((s.length - 1) * q))]; };

async function scene(browser, item) {
  const { server, base } = await fixture(kst(item.date, item.time));
  const context = await browser.newContext({ ...DEVICES[item.device] });
  const page = await context.newPage(), errors = [], bytes = { total: 0, art: 0, artFiles: {}, all: {} };
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text()); });
  page.on('response', async response => {
    if (response.status() >= 400 && !known404.test(response.url())) errors.push(`${response.status()} ${response.url()}`);
    // Network only: blob: URLs are textures the loaders unpack in memory, not downloads.
    if (!/^https?:/.test(response.url())) return;
    const body = await response.body().catch(() => null); if (!body) return;
    bytes.total += body.length; const u = new URL(response.url()).pathname;
    if (ART.test(u)) { bytes.art += body.length; bytes.artFiles[u] = body.length; }
    bytes.all[response.url()] = (bytes.all[response.url()] || 0) + body.length;
  });
  try {
    const t0 = Date.now();
    await page.goto(`${base}/day.html?play=walk&district=${LOOKS[item.look]}`);
    await page.waitForFunction(() => globalThis.SYNKTownDay?.metrics()?.assetsReady && SYNKTownDay.metrics().walk?.enabled, null, { timeout: 120000 });
    if (item.look === 'now') await page.waitForFunction(() => { const b = SYNKTownDay.metrics().bakedDistrict; return b && (b.failed || b.loaded && (!b.deferred || b.deferred.loaded || b.deferred.failed)); }, null, { timeout: 180000 });
    else await page.waitForFunction(() => globalThis.__lookDiorama?.loaded, null, { timeout: 60000 });
    await page.waitForFunction(() => SYNKTownDay.metrics().light?.applied, null, { timeout: 30000 });
    const readyMs = Date.now() - t0;
    if (item.camera) for (let i = 0; i < 4 && (await page.evaluate(() => SYNKTownDay.metrics().camera)) !== item.camera; i++) { await page.locator('#camera-toggle').click(); await delay(500); }
    await delay(2200);
    const metrics = await page.evaluate(() => { const m = SYNKTownDay.metrics(); return { camera: m.camera, drawCalls: m.drawCalls, triangles: m.triangles, textures: m.textures, dpr: m.dpr, quality: m.quality,
      light: m.light && { band: m.light.band, sunMode: m.light.sunMode, rain: m.light.rain }, baked: m.bakedDistrict && { loaded: m.bakedDistrict.loaded, textureBytes: m.bakedDistrict.textureBytes, triangles: m.bakedDistrict.triangles, downloadBytes: m.bakedDistrict.downloadBytes, deferred: m.bakedDistrict.deferred },
      look: globalThis.__lookDiorama ? { meshes: __lookDiorama.meshes, triangles: __lookDiorama.triangles, buildMs: __lookDiorama.buildMs, textureBytes: __lookDiorama.textureBytes, harvested: __lookDiorama.harvested } : null,
      gpuMemory: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null }; });
    const file = `${item.id}.jpg`; await page.screenshot({ path: path.join(output, file), type: 'jpeg', quality: 86 });
    let fps = null;
    if (measure) {
      const cdp = item.device === 'phone' ? await context.newCDPSession(page) : null;
      if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      // Walking rows hold a key so the camera moves every frame (the heavy case: every frame is drawn).
      if (item.walk) await page.locator('#scene').focus();
      const measuring = page.evaluate(ms => new Promise(resolve => { const out = []; let last = 0; const end = performance.now() + ms; function tick(now) { if (last) out.push(now - last); last = now; if (now < end) requestAnimationFrame(tick); else resolve(out); } requestAnimationFrame(tick); }), seconds * 1000);
      if (item.walk) { const half = seconds * 500; await page.keyboard.down('d'); await delay(half); await page.keyboard.up('d'); await page.keyboard.down('a'); await delay(half - 300); await page.keyboard.up('a'); }
      const intervals = await measuring;
      const sceneTimes = await page.evaluate(() => { const m = SYNKTownDay.metrics(); return { cpuRenderMs: m.cpuRenderMs, frameIntervalMs: m.frameIntervalMs }; });
      if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      fps = { frames: intervals.length, median: +(1000 / quantile(intervals, .5)).toFixed(1), low1: +(1000 / quantile(intervals, .99)).toFixed(1), ...sceneTimes, cpuThrottle: item.device === 'phone' ? 4 : 1 };
    }
    return { ...item, file, readyMs, fps, metrics, bytes, errors };
  } finally { await context.close(); await new Promise(resolve => server.close(resolve)); }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
  const gpu = await (async () => { const page = await browser.newPage(); await page.setContent('<canvas></canvas>'); const r = await page.evaluate(() => { const gl = document.querySelector('canvas').getContext('webgl2'), e = gl?.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : null; }); await page.close(); return r; })();
  const plan = [];
  for (const look of Object.keys(LOOKS)) for (const device of Object.keys(DEVICES)) {
    for (const [band, time] of BANDS) plan.push({ id: `${look}-${device}-${band}`, look, device, band, time, date: '2026-10-25', weather: 'clear' });
    plan.push({ id: `${look}-${device}-rain`, look, device, band: 'day', time: '12:30', date: '2026-10-29', weather: 'rain' });
    plan.push({ id: `${look}-${device}-overview`, look, device, band: 'day', time: '12:30', date: '2026-10-25', weather: 'clear', camera: 'wide' });
    plan.push({ id: `${look}-${device}-overview-night`, look, device, band: 'night', time: '23:45', date: '2026-10-25', weather: 'clear', camera: 'wide' });
    plan.push({ id: `${look}-${device}-walk`, look, device, band: 'day', time: '12:30', date: '2026-10-25', weather: 'clear', walk: true, extra: true });
  }
  const rows = [], file = path.join(output, 'report.json');
  const save = () => fs.writeFileSync(file, JSON.stringify({ when: new Date().toISOString(), gpu, seconds, rows }, null, 2));
  try {
    for (const item of plan.filter(p => only ? only.has(p.id) : !p.extra || flag('--walk'))) {
      const row = await scene(browser, item).catch(error => ({ ...item, failed: String(error.message || error).split('\n')[0], errors: [] })); rows.push(row); save();
      if (row.failed) { console.log(`FAIL ${row.id} ${row.failed}`); continue; }
      console.log(`${row.errors.length ? 'WARN' : 'OK  '} ${row.id} ready ${row.readyMs}ms draw ${row.metrics.drawCalls} tri ${row.metrics.triangles} art ${(row.bytes.art / 1e6).toFixed(2)}MB${row.fps ? ` fps ${row.fps.median}/${row.fps.low1} cpu ${row.fps.cpuRenderMs?.p50}ms` : ''}${row.errors.length ? ' ' + row.errors.slice(0, 2).join(' | ') : ''}`);
    }
  } finally { await browser.close(); }
  save(); console.log(`gpu: ${gpu}\nreport: ${file}`);
})().catch(error => { console.error(error); process.exit(1); });
