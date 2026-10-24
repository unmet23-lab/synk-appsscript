// Time-of-day light and rain QA (W7, vertical slice design §2-2·§15-6). Each scene runs its own memory
// store whose clock starts at a chosen Korean instant (seed synk-town: 2026-10-25 is a clear day,
// 2026-10-29 a rain day, 2026-10-30 an evening shower), so the four bands × clear/rain come from the
// real path: pulse → village clock → lightAt → the screen. It captures the baked town (WORLD's
// default) and the v20 town at desktop and phone sizes and records the frame rate (median and 1 % low
// of rAF intervals) with the scene's own render time, on the GPU the headless browser reports. Phone
// figures are an emulation (DPR 3, 4× CPU) for reference only — the real-phone measurement is W11's
// (§15-6). --sweep runs a whole day at 720× and checks that no shader is compiled as the hour moves.
//   node experiences/synk-town/qa-light-ui.cjs [--out <dir>] [--dir <synk-town copy>] [--baseline]
//     [--only <scene-id,…>] [--seconds 12] [--no-fps] [--sweep]
const fs = require('node:fs'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const flag = name => process.argv.includes(name);
const output = path.resolve(arg('--out', path.join(__dirname, '../../.tmp/town-w7-light')));
const townDir = path.resolve(arg('--dir', __dirname)), baseline = flag('--baseline');
const only = arg('--only', '') ? new Set(arg('--only', '').split(',')) : null;
const seconds = Number(arg('--seconds', 12)), measure = !flag('--no-fps');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const kst = (date, time) => Date.parse(`${date}T${time}:00+09:00`);
const BANDS = [['morning', '08:30'], ['day', '12:30'], ['evening', '18:30'], ['night', '23:45']];
const WEATHER = [['clear', '2026-10-25'], ['rain', '2026-10-29']];
const DEVICES = { desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } };
const TOWNS = { baked: '&district=townwide-merged', v20: '' };
const known404 = /avatar-textiles-v1/;

async function fixture(startMs) {
  const { createStore, createServer } = await import(pathToFileURL(path.join(townDir, 'server.mjs')).href);
  // The town clock runs at real speed until a sweep speeds it up (a page cannot settle on a racing clock).
  const clock = { at: startMs, real: Date.now(), speed: 1 }, now = () => clock.at + Math.round((Date.now() - clock.real) * clock.speed);
  const store = createStore({ lifeEnabled: true, now, tz: 540, villageSeed: 'synk-town', sleeps: true });
  const server = createServer({ previewEnabled: true, store });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}`, speed: speed => Object.assign(clock, { at: now(), real: Date.now(), speed }) };
}
const quantile = (list, q) => { const s = [...list].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((s.length - 1) * q))]; };
const metricsOf = page => page.evaluate(() => { const m = SYNKTownDay.metrics(); return { light: m.light || null, lightClock: m.lightClock || null, camera: m.camera, location: m.location,
  bakedDistrict: m.bakedDistrict && { loaded: m.bakedDistrict.loaded, failed: m.bakedDistrict.failed }, drawCalls: m.drawCalls, triangles: m.triangles, textures: m.textures, dpr: m.dpr, frameCount: m.frameCount, quality: m.quality, webglPrograms: globalThis.__webglPrograms ?? null }; });

async function open(browser, item) {
  const { server, base, speed } = await fixture(kst(item.date, item.time));
  const context = await browser.newContext({ ...DEVICES[item.device], reducedMotion: item.reduced ? 'reduce' : 'no-preference' });
  // Every program the page links, whatever build it runs (the W7 rig's own count is not in an older build).
  await context.addInitScript(() => { const p = WebGL2RenderingContext.prototype, create = p.createProgram; p.createProgram = function (...a) { globalThis.__webglPrograms = (globalThis.__webglPrograms || 0) + 1; return create.apply(this, a); }; });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400 && !known404.test(response.url())) errors.push(`${response.status()} ${response.url()}`); });
  const close = async () => { await context.close(); await new Promise(resolve => server.close(resolve)); };
  try {
    await page.goto(`${base}/day.html?${item.classic ? 'controls=classic' : 'play=walk'}${TOWNS[item.town]}`);
    await page.waitForFunction(classic => globalThis.SYNKTownDay?.metrics()?.assetsReady && (classic || SYNKTownDay.metrics().walk?.enabled), !!item.classic, { timeout: 120000 });
    if (item.town === 'baked') await page.waitForFunction(() => { const b = SYNKTownDay.metrics().bakedDistrict; return b && (b.failed || b.loaded && (!b.deferred || b.deferred.loaded || b.deferred.failed)); }, null, { timeout: 180000 });
    if (!baseline) await page.waitForFunction(() => SYNKTownDay.metrics().light?.applied && SYNKTownDay.metrics().lightClock, null, { timeout: 30000 });
    return { page, context, errors, close, speed };
  } catch (error) { await close(); throw error; }
}

/** Walks the player by keys, one axis at a time (best effort: a wall stops it where it stands). */
async function walkTo(page, steps) {
  await page.locator('#scene').focus();
  for (const [dimension, target] of steps) {
    const at = async () => (await page.evaluate(() => SYNKTownDay.metrics().walk))[dimension];
    const sign = Math.sign(target - await at()); if (!sign || Math.abs(target - await at()) <= .12) continue;
    await page.keyboard.down(dimension === 'x' ? (sign > 0 ? 'd' : 'a') : (sign > 0 ? 's' : 'w'));
    for (const end = Date.now() + 12000; Date.now() < end && sign * (target - await at()) > .12;) await delay(60);
    await page.keyboard.up(dimension === 'x' ? (sign > 0 ? 'd' : 'a') : (sign > 0 ? 's' : 'w')); await delay(400);
  }
}

async function scene(browser, item) {
  const { page, context, errors, close } = await open(browser, item);
  try {
    // A move sent while the app is still busy is dropped (command() returns): wait, send, and try again.
    for (let attempt = 0; item.classic && attempt < 3; attempt++) {
      await page.waitForFunction(() => document.querySelector('#day-app')?.getAttribute('aria-busy') !== 'true', null, { timeout: 20000 });
      await page.locator(`[data-command="DAY_MOVE"][data-location="${item.classic}"]`).filter({ visible: true }).first().click();
      if (await page.waitForFunction(at => SYNKTownDay.metrics().location === at, item.classic, { timeout: 8000 }).then(() => true, () => false)) break;
    }
    if (item.walk) await walkTo(page, item.walk);
    if (item.camera) for (let i = 0; i < 4 && (await page.evaluate(() => SYNKTownDay.metrics().camera)) !== item.camera; i++) { await page.locator('#camera-toggle').click(); await delay(400); }
    await delay(1800);
    const metrics = await metricsOf(page);
    const file = `${item.id}.jpg`; await page.screenshot({ path: path.join(output, file), type: 'jpeg', quality: 82 });
    let fps = null;
    if (measure && !item.reduced) {
      const cdp = item.device === 'phone' ? await context.newCDPSession(page) : null;
      if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const intervals = await page.evaluate(ms => new Promise(resolve => { const out = []; let last = 0; const end = performance.now() + ms; function tick(now) { if (last) out.push(now - last); last = now; if (now < end) requestAnimationFrame(tick); else resolve(out); } requestAnimationFrame(tick); }), seconds * 1000);
      const scene = await page.evaluate(() => { const m = SYNKTownDay.metrics(); return { cpuRenderMs: m.cpuRenderMs, frameIntervalMs: m.frameIntervalMs }; });
      if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      fps = { frames: intervals.length, median: +(1000 / quantile(intervals, .5)).toFixed(1), low1: +(1000 / quantile(intervals, .99)).toFixed(1), ...scene, cpuThrottle: item.device === 'phone' ? 4 : 1 };
    }
    return { ...item, file, fps, metrics, errors };
  } finally { await close(); }
}

/** A day at 300× once the page is up (five real minutes; under reduced motion one and a half): the light must
 * move through every band and the rain, and compile nothing once warm; a still screen must still repaint. */
async function sweep(browser, reduced) {
  const item = { id: `${baseline ? 'base-' : ''}sweep-baked-desktop${reduced ? '-reduced' : ''}`, date: '2026-10-30', time: '04:00', device: 'desktop', town: 'baked', reduced };
  const { page, errors, close, speed } = await open(browser, item);
  try {
    const samples = []; speed(300);
    for (let i = 0; i < (reduced ? 30 : 100); i++) { const m = await metricsOf(page); samples.push({ band: m.lightClock?.band, key: m.lightClock?.key?.to, raining: m.lightClock?.rain?.raining, drawn: m.light?.rain?.drawn, programs: m.webglPrograms, frameCount: m.frameCount }); await delay(3000); }
    const warm = samples.slice(3).map(s => s.programs).filter(n => n !== null && n !== undefined);
    return { id: item.id, reduced, bands: [...new Set(samples.map(s => s.band))], keys: [...new Set(samples.map(s => s.key))], rained: samples.some(s => s.raining), drew: Math.max(...samples.map(s => s.drawn || 0)),
      programsFirst: warm[0], programsLast: warm.at(-1), programsMax: Math.max(...warm), framesFirst: samples[3].frameCount, framesLast: samples.at(-1).frameCount, errors, samples };
  } finally { await close(); }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
  const gpu = await (async () => { const page = await browser.newPage(); await page.setContent('<canvas></canvas>'); const r = await page.evaluate(() => { const gl = document.querySelector('canvas').getContext('webgl2'), e = gl?.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : null; }); await page.close(); return r; })();
  const plan = [];
  for (const town of Object.keys(TOWNS)) for (const device of Object.keys(DEVICES)) for (const [weather, date] of WEATHER) for (const [band, time] of BANDS)
    plan.push({ id: `${baseline ? 'base-' : ''}${town}-${device}-${band}-${weather}`, band, time, weather, date, device, town });
  if (!baseline) plan.push(
    { id: 'baked-desktop-night-rain-reduced', band: 'night', time: '23:45', weather: 'rain', date: '2026-10-29', device: 'desktop', town: 'baked', reduced: true },
    { id: 'baked-desktop-dawn-clear', band: 'morning', time: '05:20', weather: 'clear', date: '2026-10-25', device: 'desktop', town: 'baked' },
    { id: 'baked-desktop-sunset-clear', band: 'evening', time: '17:30', weather: 'clear', date: '2026-10-25', device: 'desktop', town: 'baked' },
    { id: 'baked-desktop-cafe-rain', band: 'day', time: '12:30', weather: 'rain', date: '2026-10-29', device: 'desktop', town: 'baked', walk: [['x', -3], ['z', 2.5], ['x', 0], ['z', .4]], camera: 'close' },
    { id: 'baked-desktop-overview-rain', band: 'day', time: '12:30', weather: 'rain', date: '2026-10-29', device: 'desktop', town: 'baked', camera: 'wide' });
  const rows = [], sweeps = [], file = path.join(output, `report${baseline ? '-baseline' : ''}.json`);
  // Written after every scene: a failure later keeps what was measured.
  const save = () => fs.writeFileSync(file, JSON.stringify({ when: new Date().toISOString(), gpu, seconds, townDir, rows, sweeps }, null, 2));
  try {
    for (const item of plan.filter(p => !only || only.has(p.id))) {
      const row = await scene(browser, item).catch(error => ({ ...item, failed: String(error.message || error).split('\n')[0], errors: [], metrics: {} })); rows.push(row); save();
      if (row.failed) { console.log(`FAIL ${row.id} ${row.failed}`); continue; }
      console.log(`${row.errors.length ? 'WARN' : 'OK  '} ${row.id} key=${row.metrics.lightClock?.key?.from ?? '-'}->${row.metrics.lightClock?.key?.to ?? '-'} drawn=${row.metrics.light?.rain?.drawn ?? '-'} ${row.fps ? `fps ${row.fps.median}/${row.fps.low1} cpu ${row.fps.cpuRenderMs?.p50}ms` : ''}${row.errors.length ? ' errors: ' + row.errors.slice(0, 2).join(' | ') : ''}`);
    }
    if (flag('--sweep')) for (const reduced of [false, true]) {
      const s = await sweep(browser, reduced).catch(error => ({ id: `sweep${reduced ? '-reduced' : ''}`, failed: String(error.message || error).split('\n')[0], bands: [], errors: [] })); sweeps.push(s); save();
      if (s.failed) { console.log(`FAIL ${s.id} ${s.failed}`); continue; }
      console.log(`${s.errors.length ? 'WARN' : 'OK  '} ${s.id} bands=${s.bands.join(',')} rained=${s.rained} programs ${s.programsFirst}→${s.programsLast} (max ${s.programsMax}) frames ${s.framesFirst}→${s.framesLast}`);
    }
  } finally { await browser.close(); }
  save(); console.log(`gpu: ${gpu}\nreport: ${file}`);
})().catch(error => { console.error(error); process.exit(1); });
