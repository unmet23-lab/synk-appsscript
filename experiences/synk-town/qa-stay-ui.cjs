// Staying and the village's sound QA (W7b, vertical slice design §17, village design §4-4·acceptance 11). Each scene
// runs its own memory store whose clock starts at a chosen Korean instant (seed synk-town: 2026-10-25 clear, 2026-10-29
// rain — the W7 days), so seats, light, rain and sound come from the real path. It checks: sitting and standing up
// (F, Esc, a walking key, the button), the card fading and waking, captures at 1440 and 390 by day, evening, deep night
// and rain; the switches kept on the device, never revived (sitting again, reloading, an untrusted click), a
// microphone open in another window and a hidden window silencing the output (the engine's own output tap), a
// browser that cannot store starting both off, a dropped connection leaving the player seated, the first step after
// standing up not pulled back, and the battery measures (rAF wake-ups, frames drawn, render time, requests, audio
// nodes) standing still versus seated. Phone figures are an emulation (DPR 3, 4× CPU) — the real phone is W11's.
//   node experiences/synk-town/qa-stay-ui.cjs [--out <dir>] [--only flows,switches,mic,storage,offline,step,battery,captures,overview,samples]
const fs = require('node:fs'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const output = path.resolve(arg('--out', path.join(__dirname, '../../.tmp/town-w7b-stay')));
const only = arg('--only', '') ? new Set(arg('--only', '').split(',')) : null;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const kst = (date, time) => Date.parse(`${date}T${time}:00+09:00`);
const DEVICES = { desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } };
const known404 = /avatar-textiles-v1/;
const report = { started: new Date().toISOString(), scenes: {}, failures: [] };
const check = (scene, ok, what, detail) => { (report.scenes[scene] ||= { checks: [] }).checks.push({ ok: !!ok, what, ...(detail === undefined ? {} : { detail }) }); if (!ok) report.failures.push(`${scene}: ${what}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`); };

async function fixture(startMs, port = 0, store = null) {
  const { createStore, createServer } = await import(pathToFileURL(path.join(__dirname, 'server.mjs')).href);
  const clock = { at: startMs, real: Date.now() }, now = () => clock.at + (Date.now() - clock.real);
  store ||= createStore({ lifeEnabled: true, now, tz: 540, villageSeed: 'synk-town', sleeps: true });
  const server = createServer({ previewEnabled: true, store });
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  return { server, store, port: server.address().port, base: `http://127.0.0.1:${server.address().port}` };
}
/** Counts rAF callbacks, WebGL programs, audio nodes made and requests — read-only instrumentation. */
async function instrument(context) {
  await context.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window); globalThis.__rafCalls = 0;
    window.requestAnimationFrame = fn => raf(t => { globalThis.__rafCalls++; fn(t); });
    globalThis.__audioNodes = 0; const AC = window.AudioContext;
    if (AC) for (const name of ['createGain', 'createOscillator', 'createBufferSource', 'createBiquadFilter', 'createStereoPanner']) { const real = AC.prototype[name]; if (real) AC.prototype[name] = function (...a) { globalThis.__audioNodes++; return real.apply(this, a); }; }
  });
}
async function open(browser, { start, device = 'desktop', district = '&district=townwide-merged', storage = true, reuse = null, extra = '' }) {
  const { server, base, store, port } = reuse || await fixture(start);
  const context = await browser.newContext({ ...DEVICES[device] });
  await instrument(context);
  if (!storage) await context.addInitScript(() => { for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(window, name, { configurable: true, get() { throw new DOMException('denied', 'SecurityError'); } }); });
  const page = await context.newPage(), errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource|ERR_CONNECTION_REFUSED|Failed to fetch/.test(message.text())) errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400 && !known404.test(response.url())) errors.push(`${response.status()} ${response.url()}`); });
  page.on('request', request => { if (request.url().includes('/api/preview/')) requests.push({ at: Date.now(), path: new URL(request.url()).pathname.split('/').pop() }); });
  await page.goto(`${base}/day.html?play=walk${district}${extra}`);
  await page.waitForFunction(() => globalThis.SYNKTownDay?.metrics()?.assetsReady && SYNKTownDay.metrics().walk?.enabled, null, { timeout: 120000 });
  if (district) await page.waitForFunction(() => { const b = SYNKTownDay.metrics().bakedDistrict; return b && (b.failed || b.loaded); }, null, { timeout: 180000 });
  await delay(1500);
  const close = async () => { await context.close(); if (!reuse) await new Promise(resolve => server.close(resolve)); };
  return { page, context, errors, requests, close, server, store, base, port };
}
const metrics = page => page.evaluate(() => { const m = SYNKTownDay.metrics(); return { stay: m.stay, sound: m.sound, frameCap: m.frameCap, dpr: m.dpr, camera: m.camera, contact: m.rendering?.contactOcclusion,
  walk: { x: m.walk.x, z: m.walk.z, maxCorrection: m.walk.maxCorrection, correction: m.walk.correctionDistance }, foreground: m.foreground, frameCount: m.frameCount, cpuRenderMs: m.cpuRenderMs,
  drawingBuffer: m.drawingBuffer, light: m.lightClock && { key: m.lightClock.key, band: m.lightClock.band, rain: m.lightClock.rain }, connected: m.connected }; });
async function walkTo(page, steps) {
  await page.locator('#scene').focus();
  for (const [dimension, target] of steps) {
    const at = async () => (await page.evaluate(() => SYNKTownDay.metrics().walk))[dimension];
    const sign = Math.sign(target - await at()); if (!sign || Math.abs(target - await at()) <= .1) continue;
    const key = dimension === 'x' ? (sign > 0 ? 'd' : 'a') : (sign > 0 ? 's' : 'w');
    await page.keyboard.down(key);
    for (const end = Date.now() + 12000; Date.now() < end && sign * (target - await at()) > .1;) await delay(40);
    await page.keyboard.up(key); await delay(500);
  }
}
const ROUTES = { bench: [['z', 3.9], ['x', -5]], home: [['z', 3.9], ['x', -6.5], ['z', .05], ['x', -5.2]], benchRight: [['z', 3.9], ['x', 5]] };
async function sitAt(page, seat) {
  await walkTo(page, ROUTES[seat]);
  await page.waitForFunction(() => SYNKTownDay.metrics().stay?.sitShown, null, { timeout: 10000 });
  await page.keyboard.press('f');
  await page.waitForFunction(() => SYNKTownDay.metrics().stay?.seated, null, { timeout: 10000 }); await delay(1200);
}
const shot = (page, name) => page.screenshot({ path: path.join(output, `${name}.jpg`), type: 'jpeg', quality: 82 });
const level = async (page, ms = 600) => { let peak = 0; for (const end = Date.now() + ms; Date.now() < end; await delay(60)) peak = Math.max(peak, await page.evaluate(() => SYNKTownDay.metrics().sound.level)); return peak; };

/** Sitting and standing at the two kinds of seat, the card, and the quiet drawing's figures. */
async function flows(browser) {
  for (const device of ['desktop', 'phone']) {
    const scene = `flows-${device}`, s = await open(browser, { start: kst('2026-10-25', '12:30'), device });
    try {
      const { page } = s;
      await sitAt(page, 'bench');
      let m = await metrics(page);
      check(scene, m.stay.seated === 'street-bench-left', 'F로 길가 벤치에 앉는다', m.stay);
      check(scene, m.camera === 'stay' && m.frameCap === 24 && m.dpr <= 1 && m.contact === false, '앉으면 고정 구도·24fps 상한·픽셀 비율 1·접촉 그늘 끔', { camera: m.camera, frameCap: m.frameCap, dpr: m.dpr, contact: m.contact });
      check(scene, m.stay.cardAwake && m.stay.dim > .3, '판이 밝고 막이 어둡다', m.stay);
      check(scene, m.foreground === true, '앉은 창은 앞에 둔 창', m.foreground);
      check(scene, await page.evaluate(() => !document.querySelector('.walk-hud') || getComputedStyle(document.querySelector('.walk-hud')).display === 'none'), '걷기 HUD가 숨는다');
      await shot(page, `${device}-day-bench-awake`);
      await delay(7500); m = await metrics(page);
      check(scene, !m.stay.cardAwake, '혼자 두면 판이 옅어진다', m.stay);
      check(scene, await page.evaluate(() => getComputedStyle(document.querySelector('.stay-face')).pointerEvents === 'none' && getComputedStyle(document.querySelector('.stay-stand')).opacity > .5), '옅은 판은 누름을 받지 않고 「일어나기」는 보인다');
      await shot(page, `${device}-day-bench-faded`);
      await page.mouse.click(DEVICES[device].viewport.width / 2, DEVICES[device].viewport.height * .3); await delay(400);
      m = await metrics(page); check(scene, m.stay.cardAwake && m.stay.seated, '화면을 누르면 판이 밝아지고 앉은 채다', m.stay);
      await page.keyboard.press('Escape'); await delay(800);
      m = await metrics(page); check(scene, !m.stay.seated && m.camera !== 'stay' && m.frameCap === 60, 'Esc로 일어나 걷기 구도로', { stay: m.stay, camera: m.camera });
      await sitAt(page, 'home');
      m = await metrics(page); check(scene, m.stay.seated === 'home-window-bench' && m.sound.sheltered === true, '창가 벤치에 앉으면 처마 밑 소리', { seat: m.stay.seated, sheltered: m.sound.sheltered });
      await shot(page, `${device}-day-home-awake`);
      await page.locator('#stay-card .stay-stand').click(); await delay(800);
      m = await metrics(page); check(scene, !m.stay.seated, '「일어나기」 단추로 일어난다', m.stay);
      await page.keyboard.press('f'); await delay(1200); await page.keyboard.down('s'); await delay(800); await page.keyboard.up('s'); await delay(600);
      m = await metrics(page); check(scene, !m.stay.seated, '걷기 키로 바로 일어난다', m.stay);
      check(scene, s.errors.length === 0, '오류 없음', s.errors);
    } finally { await s.close(); }
  }
}

/** Captures: evening, deep night and rain at both seats, desktop and phone. */
async function captures(browser) {
  const plan = [['evening', '2026-10-25', '18:40'], ['night', '2026-10-25', '23:45'], ['rain', '2026-10-29', '14:00']];
  for (const device of ['desktop', 'phone']) for (const [name, date, time] of plan) {
    const scene = `captures-${device}-${name}`, s = await open(browser, { start: kst(date, time), device });
    try {
      for (const seat of ['bench', 'home']) {
        await sitAt(s.page, seat); await delay(seat === 'bench' ? 9000 : 1500);
        const m = await metrics(s.page);
        check(scene, !!m.stay.seated, `${seat} 앉음`, { seat: m.stay.seated, light: m.light, layers: m.sound.layers, dim: m.stay.dim });
        await shot(s.page, `${device}-${name}-${seat}${seat === 'bench' ? '-faded' : '-awake'}`);
        await s.page.keyboard.press('Escape'); await delay(800);
      }
      check(scene, s.errors.length === 0, '오류 없음', s.errors);
    } finally { await s.close(); }
  }
}

/** The switches: kept on the device, never revived, an untrusted click cannot turn one on. */
async function switches(browser) {
  const scene = 'switches', s = await open(browser, { start: kst('2026-10-25', '12:30') });
  try {
    const { page } = s, village = '#stay-card .stay-switch[data-sound-pref="village"]';
    await sitAt(page, 'bench');
    let m = await metrics(page);
    check(scene, m.sound.prefs.village === true && m.sound.prefs.music === false, '처음 값: 마을 소리 켬·음악 끔', m.sound.prefs);
    check(scene, await page.evaluate(() => document.querySelector('#stay-card .stay-switch[data-sound-pref="music"]').closest('.stay-switch-row').hidden), '곡이 없으면 음악 스위치 줄이 없다');
    check(scene, (await level(page, 1500)) > .002, '마을 소리가 난다', await level(page));
    await page.locator(village).click(); await delay(2500);
    m = await metrics(page); check(scene, m.sound.prefs.village === false, '직접 누르면 꺼진다', m.sound.prefs);
    check(scene, (await level(page, 800)) < .0005, '끄면 출력 0', await level(page));
    await page.keyboard.press('Escape'); await delay(600); await page.keyboard.press('f'); await delay(1500);
    check(scene, (await metrics(page)).sound.prefs.village === false, '다시 앉아도 꺼진 채');
    await page.evaluate(sel => document.querySelector(sel).click(), village); await delay(500);
    check(scene, (await metrics(page)).sound.prefs.village === false, '비신뢰 클릭(element.click)으로는 켜지지 않는다');
    await page.evaluate(() => { const b = document.querySelector('#stay-card .stay-switch[data-sound-pref="village"]'); b.dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await delay(300);
    check(scene, (await metrics(page)).sound.prefs.village === false, '만든 MouseEvent로도 켜지지 않는다');
    await page.reload();
    await page.waitForFunction(() => globalThis.SYNKTownDay?.metrics()?.assetsReady && SYNKTownDay.metrics().walk?.enabled, null, { timeout: 120000 }); await delay(1500);
    check(scene, (await metrics(page)).sound.prefs.village === false, '다시 열어도 꺼진 채(기기에 남음)');
    await sitAt(page, 'bench'); await page.locator(village).click(); await delay(2500);
    m = await metrics(page); check(scene, m.sound.prefs.village === true && (await level(page, 1500)) > .002, '직접 다시 누르면 켜지고 소리가 난다', m.sound.prefs);
    check(scene, s.errors.length === 0, '오류 없음', s.errors);
  } finally { await s.close(); }
}

/** A microphone open in another window of this origin, and a hidden window: the output goes to 0. */
async function mic(browser) {
  const scene = 'mic', s = await open(browser, { start: kst('2026-10-25', '12:30') });
  try {
    const { page, context, base } = s;
    await sitAt(page, 'bench'); await delay(2500);
    check(scene, (await level(page, 1200)) > .002, '앉아서 소리가 난다');
    const other = await context.newPage(); await other.goto(`${base}/day-style.css`);
    await other.evaluate(() => { localStorage.setItem('synk.world.mic', String(Date.now())); new BroadcastChannel('synk-world-audio').postMessage({ type: 'mic', open: true }); });
    await delay(250);
    let m = await metrics(page); check(scene, m.sound.recording === true && m.sound.buses.village === 0 && m.sound.buses.music === 0, '다른 창이 마이크를 열면 두 갈래 0', m.sound);
    check(scene, (await level(page, 600)) < .0005, '마이크가 열린 동안 출력 0', await level(page));
    // The recording window goes on saying it is open; then it closes.
    await other.evaluate(() => localStorage.setItem('synk.world.mic', String(Date.now()))); await delay(400);
    check(scene, (await metrics(page)).sound.recording === true, '열린 동안 계속 0');
    await other.evaluate(() => { localStorage.removeItem('synk.world.mic'); new BroadcastChannel('synk-world-audio').postMessage({ type: 'mic', open: false }); }); await delay(3000);
    check(scene, (await metrics(page)).sound.recording === false && (await level(page, 1200)) > .002, '닫히면 소리가 돌아온다');
    // A recording window that died mid-recording: its last stamp goes stale.
    await other.evaluate(() => localStorage.setItem('synk.world.mic', String(Date.now() - 20000))); await delay(400);
    check(scene, (await metrics(page)).sound.recording === false, '15초 넘게 소식 없는 열림은 닫힌 것으로 본다');
    // A town opened while a microphone is already open reads the key at once.
    await other.evaluate(() => localStorage.setItem('synk.world.mic', String(Date.now())));
    const late = await context.newPage(); await late.goto(`${base}/day.html?play=walk&district=townwide-merged`);
    await late.waitForFunction(() => globalThis.SYNKTownDay?.metrics()?.assetsReady, null, { timeout: 120000 }); await delay(1500);
    check(scene, (await late.evaluate(() => SYNKTownDay.metrics().sound.recording)) === true, '늦게 연 마을도 열린 마이크를 안다');
    await late.close(); await other.evaluate(() => localStorage.removeItem('synk.world.mic')); await other.close(); await delay(2500);
    // Hidden (the page's own visibility): silent, the audio stops working, and it comes back when seen.
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    await delay(900); m = await metrics(page);
    check(scene, m.sound.buses.village === 0 && ['suspended', 'interrupted'].includes(m.sound.context), '숨으면 0이고 오디오가 멈춘다', m.sound);
    await page.evaluate(() => { delete document.hidden; delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); }); await delay(3000);
    check(scene, (await level(page, 1200)) > .002, '다시 보이면 소리가 돌아온다');
    check(scene, s.errors.length === 0, '오류 없음', s.errors);
  } finally { await s.close(); }
}

/** A browser that refuses storage starts both off — a sound turned off can never come back by being forgotten. */
async function storage(browser) {
  const scene = 'storage', s = await open(browser, { start: kst('2026-10-25', '12:30'), storage: false });
  try {
    await sitAt(s.page, 'bench');
    const m = await metrics(s.page);
    check(scene, m.sound.storage === false && m.sound.prefs.village === false && m.sound.prefs.music === false, '저장이 막힌 창은 둘 다 끔으로 시작', m.sound);
    check(scene, (await level(s.page, 1000)) < .0005, '그 창은 소리가 없다');
  } finally { await s.close(); }
}

/** A dropped connection leaves the player seated with its sound; the town comes back by itself. */
async function offline(browser) {
  const scene = 'offline', start = kst('2026-10-25', '12:30'), first = await fixture(start);
  const s = await open(browser, { start, reuse: first });
  try {
    const { page } = s;
    await sitAt(page, 'bench'); await delay(1500);
    await new Promise(resolve => first.server.close(resolve)); first.server.closeAllConnections?.();
    await delay(6000);
    let m = await metrics(page);
    check(scene, m.connected === false && m.stay.seated === 'street-bench-left', '연결이 끊겨도 앉은 채', { connected: m.connected, seated: m.stay.seated });
    check(scene, (await level(page, 1000)) > .002, '연결이 끊겨도 소리는 그대로');
    const again = await fixture(start, first.port, first.store);
    await page.waitForFunction(() => SYNKTownDay.metrics().connected, null, { timeout: 30000 }).catch(() => {});
    m = await metrics(page);
    check(scene, m.connected === true && m.stay.seated === 'street-bench-left', '저절로 다시 이어지고 여전히 앉은 채', { connected: m.connected, seated: m.stay.seated });
    await new Promise(resolve => again.server.close(resolve));
  } finally { await s.context.close(); }
}

/** After a long sit, the first steps are not pulled back (the walk clock goes on under the seated pulse). */
async function step(browser) {
  const scene = 'step', s = await open(browser, { start: kst('2026-10-25', '12:30') });
  try {
    const { page } = s;
    await sitAt(page, 'bench'); await delay(30000);
    const before = (await metrics(page)).walk;
    await page.keyboard.down('d'); await delay(900); await page.keyboard.up('d'); await delay(1200);
    const after = (await metrics(page)).walk;
    check(scene, after.x - before.x > .8, '일어나 걷는다', { before, after });
    check(scene, after.maxCorrection - before.maxCorrection < .05, '첫 걸음이 되돌려지지 않는다(보정 거리)', { before: before.maxCorrection, after: after.maxCorrection });
    check(scene, s.errors.length === 0, '오류 없음', s.errors);
  } finally { await s.close(); }
}

/** Battery measures: standing still in the walking view versus seated (dry and in the rain), and seated but hidden. */
async function battery(browser) {
  const seconds = Number(arg('--seconds', 20)), rows = [];
  for (const device of ['desktop', 'phone']) for (const [name, date, time] of [['dry', '2026-10-25', '12:30'], ['rain', '2026-10-29', '14:00']]) {
    const s = await open(browser, { start: kst(date, time), device });
    try {
      const { page, context } = s, cdp = device === 'phone' ? await context.newCDPSession(page) : null;
      if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const sample = async state => {
        const a = await page.evaluate(() => ({ raf: globalThis.__rafCalls, frames: SYNKTownDay.metrics().frameCount, nodes: globalThis.__audioNodes })), req0 = s.requests.length, t0 = Date.now();
        await delay(seconds * 1000);
        const b = await page.evaluate(() => ({ raf: globalThis.__rafCalls, frames: SYNKTownDay.metrics().frameCount, nodes: globalThis.__audioNodes })), m = await metrics(page), dt = (Date.now() - t0) / 1000;
        rows.push({ device, weather: name, state, rafPerSecond: +((b.raf - a.raf) / dt).toFixed(1), framesPerSecond: +((b.frames - a.frames) / dt).toFixed(1), cpuRenderMsP50: m.cpuRenderMs?.p50 ?? null,
          drawingBuffer: m.drawingBuffer, dpr: m.dpr, requestsPerMinute: +((s.requests.length - req0) / dt * 60).toFixed(1), audioNodesPerSecond: +((b.nodes - a.nodes) / dt).toFixed(1), cpuThrottle: cdp ? 4 : 1 });
      };
      await walkTo(page, ROUTES.bench); await delay(1500); await sample('서서 가만히');
      await page.keyboard.press('f'); await delay(2000); await sample('머물기');
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
      await sample('머물기 + 숨김');
      if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    } finally { await s.close(); }
  }
  report.battery = rows;
  const md = ['| 기기 | 날씨 | 상태 | rAF/초 | 그린 프레임/초 | 렌더 CPU p50(ms) | 드로잉 버퍼 | 요청/분 | 오디오 노드/초 |', '|---|---|---|---:|---:|---:|---|---:|---:|',
    ...rows.map(r => `| ${r.device}${r.cpuThrottle > 1 ? ' (CPU 4배 느림)' : ''} | ${r.weather === 'dry' ? '맑음' : '비'} | ${r.state} | ${r.rafPerSecond} | ${r.framesPerSecond} | ${r.cpuRenderMsP50 ?? '-'} | ${r.drawingBuffer ? `${r.drawingBuffer.width}×${r.drawingBuffer.height}` : '-'} | ${r.requestsPerMinute} | ${r.audioNodesPerSecond} |`)];
  fs.writeFileSync(path.join(output, 'battery.md'), md.join('\n') + '\n');
}

/** W7's follow-up ④: the map overview at night — far hills are not painted over by the sky dome. */
async function overview(browser) {
  for (const device of ['desktop', 'phone']) {
    const s = await open(browser, { start: kst('2026-10-25', '21:30'), device });
    try {
      for (let i = 0; i < 4 && (await s.page.evaluate(() => SYNKTownDay.metrics().camera)) !== 'wide'; i++) { await s.page.locator('#camera-toggle').click(); await delay(500); }
      await delay(1500); await shot(s.page, `${device}-night-overview`);
      check(`overview-${device}`, (await s.page.evaluate(() => SYNKTownDay.metrics().camera)) === 'wide', '지도 보기 캡처');
    } finally { await s.close(); }
    const v20 = await open(browser, { start: kst('2026-10-25', '21:30'), device, district: '' });
    try { await walkTo(v20.page, [['z', 2.2], ['x', -6.2]]); await delay(1500); await shot(v20.page, `${device}-night-v20-lanterns`); } finally { await v20.close(); }
  }
}

/** Listening samples for Yuho's ear check (village design §4-4 — the crickets wait for it): each a 20-second mix the
 * screen's own engine renders offline from that hour's levels, saved as MP3 next to the captures. */
async function samples(browser) {
  const { server, base } = await fixture(kst('2026-10-25', '12:00')), page = await browser.newPage(), dir = path.join(output, 'samples');
  fs.mkdirSync(dir, { recursive: true });
  const plan = [
    ['01-가을낮-길가벤치', '2026-10-25', '10:30', { x: -5, z: 3.06, sheltered: false }, 1, {}],
    ['02-가을저녁-길가벤치', '2026-10-25', '18:40', { x: -5, z: 3.06, sheltered: false }, 1, {}],
    ['03-가을깊은밤-길가벤치(지금-귀뚜라미끔)', '2026-10-25', '23:45', { x: -5, z: 3.06, sheltered: false }, 1, {}],
    ['04-가을깊은밤-귀뚜라미를켠다면(귀검수)', '2026-10-25', '23:45', { x: -5, z: 3.06, sheltered: false }, 1, { crickets: .22 }],
    ['05-비오는날-창가벤치', '2026-10-29', '14:00', { x: -5.18, z: -.7, sheltered: true }, 1, {}],
    ['06-비오는날-길가벤치', '2026-10-29', '14:00', { x: -5, z: 3.06, sheltered: false }, 1, {}],
    ['07-6월밤-연못곁', '2026-06-20', '22:00', { x: 5, z: -3, sheltered: false }, 1, {}],
    ['08-걸을때-찻집앞-낮', '2026-10-25', '12:30', { x: 0, z: 2.5, sheltered: false }, .4, {}],
  ];
  try {
    await page.goto(`${base}/day-style.css`);
    for (const [name, date, time, listener, bus, gains] of plan) {
      const wav = await page.evaluate(async ({ ms, listener, bus, gains }) => {
        const { renderMix } = await import('/day-sound.mjs'), { soundscapeAt } = await import('/town/soundscape.mjs'), { lightAt } = await import('/town/light.mjs');
        const { layers } = soundscapeAt({ light: lightAt({ villageSeed: 'synk-town', tz: 540, ms }), ms, listener, awake: { 'cafe-owner': true } });
        const audio = await renderMix({ layers, seconds: 20, bus, gains }), frames = audio.length, data = new DataView(new ArrayBuffer(44 + frames * 4));
        const text = (at, s) => [...s].forEach((c, i) => data.setUint8(at + i, c.charCodeAt(0)));
        text(0, 'RIFF'); data.setUint32(4, 36 + frames * 4, true); text(8, 'WAVEfmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 2, true);
        data.setUint32(24, audio.sampleRate, true); data.setUint32(28, audio.sampleRate * 4, true); data.setUint16(32, 4, true); data.setUint16(34, 16, true); text(36, 'data'); data.setUint32(40, frames * 4, true);
        const l = audio.getChannelData(0), r = audio.getChannelData(1);
        for (let i = 0; i < frames; i++) { data.setInt16(44 + i * 4, Math.max(-1, Math.min(1, l[i])) * 32767, true); data.setInt16(46 + i * 4, Math.max(-1, Math.min(1, r[i])) * 32767, true); }
        let s = ''; const bytes = new Uint8Array(data.buffer); for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode(...bytes.subarray(i, i + 32768));
        return { b64: btoa(s), layers };
      }, { ms: kst(date, time), listener, bus, gains });
      const file = path.join(dir, `${name}.wav`); fs.writeFileSync(file, Buffer.from(wav.b64, 'base64'));
      const mp3 = file.replace(/\.wav$/, '.mp3'), made = require('node:child_process').spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-b:a', '160k', mp3]);
      if (made.status === 0) fs.rmSync(file);
      check('samples', fs.existsSync(made.status === 0 ? mp3 : file), name, Object.fromEntries(Object.entries(wav.layers).filter(([, v]) => v > .01).map(([k, v]) => [k, +v.toFixed(2)])));
    }
  } finally { await page.close(); await new Promise(resolve => server.close(resolve)); }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const gpu = await (async () => { const page = await browser.newPage(); await page.setContent('<canvas></canvas>'); const r = await page.evaluate(() => { const gl = document.querySelector('canvas').getContext('webgl2'), e = gl?.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : null; }); await page.close(); return r; })();
  report.gpu = gpu;
  const scenes = { flows, captures, switches, mic, storage, offline, step, battery, overview, samples };
  try {
    for (const [name, run] of Object.entries(scenes)) {
      if (only && !only.has(name)) continue;
      const t = Date.now(); try { await run(browser); } catch (error) { report.failures.push(`${name}: ${error.message}`); }
      console.log(`${name} ${((Date.now() - t) / 1000).toFixed(0)}s`);
      fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ ...report, finished: null }, null, 2));
    }
  } finally { await browser.close(); }
  report.finished = new Date().toISOString();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  const total = Object.values(report.scenes).flatMap(s => s.checks), passed = total.filter(c => c.ok).length;
  console.log(`checks ${passed}/${total.length} · failures ${report.failures.length}`); for (const f of report.failures) console.log(`  ✗ ${f}`);
  process.exitCode = report.failures.length ? 1 : 0;
})();
