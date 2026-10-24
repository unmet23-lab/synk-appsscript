// Time-of-day light and rain QA (W7, vertical slice design §2-2·§15-6). Each scene runs its own memory
// store whose clock starts at a chosen Korean instant (seed synk-town: 2026-10-25 is a clear day,
// 2026-10-29 a rain day), so the four bands × clear/rain come from the real path: pulse → village
// clock → lightAt → the screen. It captures the baked town (WORLD's default) and the v20 town at
// desktop and phone sizes and records the frame rate (median and 1 % low of rAF intervals) with the
// scene's own render time. Phone figures are an emulation (DPR 3, 4× CPU) for reference only — the
// real-phone measurement is W11's (§15-6).
//   node experiences/synk-town/qa-light-ui.cjs [--out <dir>] [--only <scene-id,…>] [--seconds 12] [--no-fps]
const fs = require('node:fs'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const output = path.resolve(arg('--out', path.join(__dirname, '../../.tmp/town-w7-light')));
const only = arg('--only', '') ? new Set(arg('--only', '').split(',')) : null;
const seconds = Number(arg('--seconds', 12)), measure = !process.argv.includes('--no-fps');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const kst = (date, time) => Date.parse(`${date}T${time}:00+09:00`);
const BANDS = [['morning', '08:30'], ['day', '12:30'], ['evening', '18:30'], ['night', '23:45']];
const WEATHER = [['clear', '2026-10-25'], ['rain', '2026-10-29']];
const DEVICES = { desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } };
const TOWNS = { baked: '&district=townwide-merged', v20: '' };

async function fixture(startMs) {
  const { createStore, createServer } = await import(pathToFileURL(path.join(__dirname, 'server.mjs')).href);
  const realStart = Date.now();
  const store = createStore({ lifeEnabled: true, now: () => startMs + (Date.now() - realStart), tz: 540, villageSeed: 'synk-town', sleeps: true });
  const server = createServer({ previewEnabled: true, store });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}
const quantile = (list, q) => { const s = [...list].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((s.length - 1) * q))]; };

async function scene(browser, { id, band, time, weather, date, device, town, reduced = false }) {
  const { server, base } = await fixture(kst(date, time));
  const context = await browser.newContext({ ...DEVICES[device], reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    await page.goto(`${base}/day.html?play=walk${TOWNS[town]}`);
    await page.waitForFunction(() => globalThis.SYNKTownDay?.metrics()?.assetsReady && SYNKTownDay.metrics().walk?.enabled, null, { timeout: 120000 });
    if (town === 'baked') await page.waitForFunction(() => { const b = SYNKTownDay.metrics().bakedDistrict; return b && (b.failed || b.loaded && (!b.deferred || b.deferred.loaded || b.deferred.failed)); }, null, { timeout: 180000 });
    await page.waitForFunction(() => SYNKTownDay.metrics().light?.applied && SYNKTownDay.metrics().lightClock, null, { timeout: 30000 });
    await delay(1800);
    const metrics = await page.evaluate(() => { const m = SYNKTownDay.metrics(); return { light: m.light, lightClock: m.lightClock, bakedDistrict: m.bakedDistrict && { loaded: m.bakedDistrict.loaded, failed: m.bakedDistrict.failed }, drawCalls: m.drawCalls, triangles: m.triangles, textures: m.textures, dpr: m.dpr, quality: m.quality, rendering: m.rendering }; });
    const file = `${id}.jpg`; await page.screenshot({ path: path.join(output, file), type: 'jpeg', quality: 82 });
    let fps = null;
    if (measure && !reduced) {
      const cdp = device === 'phone' ? await context.newCDPSession(page) : null;
      if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const intervals = await page.evaluate(ms => new Promise(resolve => { const out = []; let last = 0; const end = performance.now() + ms; function tick(now) { if (last) out.push(now - last); last = now; if (now < end) requestAnimationFrame(tick); else resolve(out); } requestAnimationFrame(tick); }), seconds * 1000);
      const cpu = await page.evaluate(() => SYNKTownDay.metrics().cpuRenderMs);
      if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      fps = { frames: intervals.length, median: +(1000 / quantile(intervals, .5)).toFixed(1), low1: +(1000 / quantile(intervals, .99)).toFixed(1), cpuRenderMs: cpu, cpuThrottle: device === 'phone' ? 4 : 1 };
    }
    return { id, band, time, weather, date, device, town, reduced, file, fps, metrics, errors };
  } finally { await context.close(); await new Promise(resolve => server.close(resolve)); }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
  const plan = [];
  for (const town of Object.keys(TOWNS)) for (const device of Object.keys(DEVICES)) for (const [weather, date] of WEATHER) for (const [band, time] of BANDS)
    plan.push({ id: `${town}-${device}-${band}-${weather}`, band, time, weather, date, device, town });
  plan.push({ id: 'baked-desktop-night-rain-reduced', band: 'night', time: '23:45', weather: 'rain', date: '2026-10-29', device: 'desktop', town: 'baked', reduced: true });
  plan.push({ id: 'baked-desktop-dawn-clear', band: 'morning', time: '05:20', weather: 'clear', date: '2026-10-25', device: 'desktop', town: 'baked' });
  const rows = [];
  try {
    for (const item of plan.filter(p => !only || only.has(p.id))) {
      const row = await scene(browser, item); rows.push(row);
      console.log(`${row.errors.length ? 'WARN' : 'OK  '} ${row.id} key=${row.metrics.lightClock?.key?.from}->${row.metrics.lightClock?.key?.to} drawn=${row.metrics.light?.rain?.drawn} ${row.fps ? `fps ${row.fps.median}/${row.fps.low1} cpu ${row.fps.cpuRenderMs?.p50}ms` : ''}${row.errors.length ? ' errors: ' + row.errors.slice(0, 2).join(' | ') : ''}`);
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ when: new Date().toISOString(), seconds, rows }, null, 2));
  console.log(`report: ${path.join(output, 'report.json')}`);
})().catch(error => { console.error(error); process.exit(1); });
