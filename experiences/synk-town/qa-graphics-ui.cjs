// Local graphics comparison and direct-input checks. Each page has an isolated
// in-memory Town store; production saves and account data are never accessed.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), { pathToFileURL } = require('node:url');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = path.join(__dirname, 'qa'), before = process.argv.includes('--before'), stage = before ? 'before' : 'after';
const servers = [], errors = [], checks = [], shots = [], metrics = {};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const check = (name, ok, details) => { checks.push({ name, ok: !!ok, ...(details === undefined ? {} : { details }) }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) throw Error(name); };
async function until(fn, name, ms = 25000) { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return; await delay(75); } throw Error(`Timeout: ${name}`); }
async function fixture() {
  const { createStore, createServer } = await import(pathToFileURL(path.join(__dirname, 'server.mjs')).href);
  const store = createStore({ lifeEnabled: true }), server = createServer({ previewEnabled: true, store });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); servers.push(server);
  return { store, url: `http://127.0.0.1:${server.address().port}/day.html` };
}
async function initialize(page, url) {
  page.on('pageerror', error => errors.push(error.message)); await page.goto(url);
  await page.waitForFunction(() => globalThis.SYNKTownDay?.snapshot()?.view.day && document.querySelector('#day-app').getAttribute('aria-busy') === 'false');
  await until(() => page.evaluate(() => SYNKTownDay.metrics().ready && SYNKTownDay.metrics().walk?.enabled), '3D walking ready');
  if (!before) await until(() => page.evaluate(() => SYNKTownDay.metrics().assetsReady === true), 'verified local graphics assets ready');
  await page.bringToFront(); await page.locator('#scene').focus(); await delay(1200);
}
async function shot(page, name) {
  const filename = `GRAPHICS-${stage}-${name}.png`; await page.screenshot({ path: path.join(output, filename) }); shots.push(filename);
}
const walk = page => page.evaluate(() => SYNKTownDay.metrics().walk);
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
async function quiet(page) {
  await until(async () => { const w = await walk(page); return !w.moving && !w.sending && w.pending === 0 && await page.locator('#day-app').getAttribute('aria-busy') !== 'true'; }, 'input queue settles');
  if (await page.locator('#error').isVisible()) throw Error(await page.locator('#error').textContent());
}
async function focus(page) { await page.bringToFront(); await page.locator('#scene').focus(); }
async function axis(page, dimension, target, tolerance = .12) {
  await focus(page); const p = await walk(page), sign = Math.sign(target - p[dimension]);
  if (Math.abs(target - p[dimension]) <= tolerance) return;
  const key = dimension === 'x' ? sign > 0 ? 'd' : 'a' : sign > 0 ? 's' : 'w';
  await page.keyboard.down(key);
  try { await until(async () => sign * (target - (await walk(page))[dimension]) <= tolerance, `walk ${dimension} to ${target}`, 12000); }
  finally { await page.keyboard.up(key); }
  await quiet(page);
}
async function click(page, command) {
  await page.locator(`[data-command="${command}"]`).filter({ visible: true }).first().click();
  await until(() => page.locator('#day-app').getAttribute('aria-busy').then(value => value !== 'true'), `${command} completes`);
  if (await page.locator('#error').isVisible()) throw Error(await page.locator('#error').textContent());
}
async function camera(page, name) {
  for (let i = 0; i < 5; i++) {
    if (await page.evaluate(() => SYNKTownDay.metrics().camera) === name) { await delay(600); return; }
    await page.locator('#camera-toggle').click(); await delay(400);
  }
  throw Error(`camera ${name} unavailable`);
}
async function inspectCamera(page, label) {
  const m = await page.evaluate(() => SYNKTownDay.metrics());
  const p = m.cameraPosition, t = m.cameraTarget, pose = m.playerPose;
  const d = Array.isArray(p) && pose ? Math.hypot(p[0] - pose.x, p[1], p[2] - pose.z) : 0;
  check(`${label}-camera-stays-above-ground-and-outside-the-player`, Array.isArray(p) && p.every(Number.isFinite)
    && Array.isArray(t) && t.every(Number.isFinite) && p[1] > .8 && d > 1.5 && !m.contextLost
    && m.playerScreen?.inFrustum === true && m.cameraNear > 0 && d > m.cameraNear * 10,
  { position: p, target: t, playerDistance: d, playerScreen: m.playerScreen, cameraNear: m.cameraNear, fadedBuildings: m.obscuredBuildingCount, fadedProps: m.obscuredPropCount });
  return m;
}
async function layout(page, width, label) {
  const result = await page.evaluate(() => {
    const selectors = ['#walk-joystick', '#walk-interact', '#camera-toggle'], rects = {};
    for (const selector of selectors) {
      const element = document.querySelector(selector), r = element?.getBoundingClientRect();
      if (r && r.width && r.height) rects[selector] = { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    }
    const overlap = (a, b) => a && b && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
    const caption = document.querySelector('#scene-caption')?.getBoundingClientRect();
    const projected = SYNKTownDay.metrics().playerScreen, canvas = document.querySelector('canvas').getBoundingClientRect();
    const player = projected ? { x: projected.x + canvas.left, y: projected.y + canvas.top } : null;
    return { overflow: document.documentElement.scrollWidth > innerWidth + 1, rects,
      controlsFit: Object.values(rects).every(r => r.left >= -.5 && r.right <= innerWidth + .5 && r.top >= -.5 && r.bottom <= innerHeight + .5),
      controlsOverlap: overlap(rects[selectors[0]], rects[selectors[1]]) || overlap(rects[selectors[0]], rects[selectors[2]]) || overlap(rects[selectors[1]], rects[selectors[2]]),
      captionCovered: caption?.width > 0 && overlap(caption, rects['#camera-toggle']),
      playerCovered: player && Object.values(rects).some(r => player.x > r.left && player.x < r.right && player.y > r.top && player.y < r.bottom) };
  });
  check(`${width}-${label}-hud-controls-fit-and-do-not-overlap`, !result.overflow && result.controlsFit && !result.controlsOverlap && !result.captionCovered && !result.playerCovered, result);
}
async function faceOutsidePanel(page, label) {
  await delay(850);
  const result = await page.evaluate(() => {
    const m = SYNKTownDay.metrics(), canvas = document.querySelector('canvas').getBoundingClientRect(), panel = document.querySelector('#nearby-panel').getBoundingClientRect();
    const h = m.playerHeadScreen, head = h ? { x: h.x + canvas.left, y: h.y + canvas.top, inFrustum: h.inFrustum } : null;
    return { head, panel: { left: panel.left, right: panel.right, top: panel.top, bottom: panel.bottom },
      participants: (m.conversationHeads || []).map(h => ({ id: h.id, x: h.x + canvas.left, y: h.y + canvas.top })),
      canvas: { left: canvas.left, right: canvas.right, bottom: canvas.bottom },
      covered: head && head.x >= panel.left && head.x <= panel.right && head.y >= panel.top && head.y <= panel.bottom };
  });
  check(`${label}-close-life-panel-keeps-player-face-visible`, result.head?.inFrustum && !result.covered, result);
  if (['320', '390', '700'].includes(label)) check(`${label}-close-life-panel-keeps-both-conversation-faces-visible`, result.participants.length >= 2
    && result.participants.some(p => p.id === 'player') && result.participants.some(p => p.id === 'cafe-owner')
    && result.participants.every(p => p.x > result.canvas.left && p.x < result.canvas.right && p.y > result.panel.bottom + 6 && p.y < result.canvas.bottom - 140), result);
}
async function afterChecks(page, store, width) {
  const initial = await walk(page);
  await layout(page, width, 'follow'); await camera(page, 'close');
  const closeHome = await inspectCamera(page, `${width}-home-close`);
  check(`${width}-close-view-preserves-avatar-location-and-direct-walking`, distance(initial, await walk(page)) < .08 && !closeHome.walk.interactionOpen && closeHome.walk.enabled);
  await shot(page, `home-close-${width}`); await layout(page, width, 'close');
  await focus(page); await page.keyboard.down('s'); await delay(120); await page.keyboard.up('s'); await quiet(page); await delay(450);
  const faceView = await page.evaluate(() => SYNKTownDay.metrics());
  await shot(page, `character-front-close-${width}`);
  check(`${width}-foreground-furniture-fades-around-the-close-character`, faceView.obscuredPropCount > 0, { fadedObjects: faceView.obscuredPropCount });
  await camera(page, 'follow');
  if (width < 700) {
    const beforeTouch = await walk(page), box = await page.locator('#walk-joystick').boundingBox();
    const c = { x: box.x + box.width / 2, y: box.y + box.height / 2 }, client = await page.context().newCDPSession(page);
    try {
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...c, id: 1 }] });
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c.x + box.width * .35, y: c.y, id: 1 }] });
      await delay(450); await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } finally { await client.detach(); }
    await quiet(page); const touchResult = await walk(page);
    check(`${width}-new-surface-keeps-touch-joystick-control`, touchResult.x > beforeTouch.x + .4 && touchResult.input === 'touch');
    await shot(page, `touch-follow-${width}`);
  }
  await axis(page, 'x', -3); await axis(page, 'z', 2.5); await axis(page, 'x', 0);
  const cafe = await walk(page);
  check(`${width}-new-graphics-retain-actual-walk-to-cafe`, cafe.nearby === 'cafe' && !cafe.interactionOpen && cafe.x > initial.x + 5);
  await camera(page, 'close'); await inspectCamera(page, `${width}-cafe-close`); await shot(page, `cafe-close-${width}`);
  await page.locator('#walk-interact').click(); await until(() => walk(page).then(w => w.interactionOpen), 'cafe interaction');
  check(`${width}-nearby-life-panel-opens-without-moving-player`, distance(cafe, await walk(page)) < .08 && store.read().state.day.location === 'cafe');
  await faceOutsidePanel(page, String(width));
  await shot(page, `cafe-panel-${width}`);
  if (width === 1280) {
    await click(page, 'CHOOSE'); await click(page, 'NEXT');
    if (store.read().state.phase === 'color') { await click(page, 'COLOR'); await click(page, 'CRAFT'); }
    await click(page, 'PLACE'); await until(() => store.read().state.delivered, 'existing first life actual use remains functional', 40000);
    check('new-graphics-retain-actual-first-seat-use-and-delivery', store.read().state.served && store.read().state.delivered);
    await shot(page, 'cafe-life-desktop');
  }
  const openCameraDistance = await page.evaluate(() => SYNKTownDay.metrics().cameraDistance);
  await page.locator('#walk-close').click(); await delay(700);
  if (width < 700) {
    const closed = await page.evaluate(() => SYNKTownDay.metrics());
    check(`${width}-closing-dialogue-restores-close-view`, closed.camera === 'close' && closed.conversationHeads.length === 0 && closed.cameraDistance < openCameraDistance - .3);
  }
  await camera(page, 'follow'); await axis(page, 'x', -3);
  await focus(page); const movingStart = await walk(page); await page.keyboard.down('d'); await delay(350);
  await page.locator('#camera-toggle').click(); await delay(250); await page.keyboard.up('d'); await quiet(page);
  const changed = await walk(page);
  check(`${width}-camera-switch-during-input-does-not-teleport-or-open-life`, distance(movingStart, changed) > .2 && distance(movingStart, changed) < 3 && !changed.interactionOpen);
  await inspectCamera(page, `${width}-moving-switch`);
  if (width === 1280) {
    await camera(page, 'follow'); await axis(page, 'x', -3); await axis(page, 'z', -3.5); await axis(page, 'x', -6);
    await delay(600); const behind = await inspectCamera(page, 'behind-home-follow');
    check('building-between-camera-and-player-becomes-transparent', behind.obscuredBuildingCount > 0, { count: behind.obscuredBuildingCount, player: behind.playerPose });
    await shot(page, 'behind-home-follow'); await camera(page, 'close'); await inspectCamera(page, 'behind-home-close'); await shot(page, 'behind-home-close');
    await camera(page, 'wide'); await shot(page, 'town-overview');
  }
  await page.emulateMedia({ reducedMotion: 'reduce' }); await camera(page, 'close'); await focus(page);
  const reduced = await walk(page); await page.keyboard.down('a'); await delay(250); await page.keyboard.up('a'); await quiet(page);
  check(`${width}-reduced-motion-retains-live-walking`, await page.evaluate(() => SYNKTownDay.metrics().reducedMotion) && (await walk(page)).x < reduced.x - .15);
  await inspectCamera(page, `${width}-reduced-close`);
  metrics[`${width}-final`] = await page.evaluate(() => SYNKTownDay.metrics());
}
(async () => {
  let browser, failure = null; const startedAt = new Date().toISOString();
  const files = ['day-scene.mjs', 'day-character.mjs', 'day-residents.mjs', 'day-environment.mjs', 'day-app.mjs', 'day-style.css', 'day.html', 'walk.mjs', 'walk-controls.mjs', 'town-environment.mjs', '../synk-world-home/avatar-v3.mjs'].filter(f => fs.existsSync(path.join(__dirname, f)));
  const sourceHashes = Object.fromEntries(files.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, file))).digest('hex')]));
  try {
    fs.mkdirSync(output, { recursive: true }); browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
    for (const width of [1280, 390, 320]) {
      const { store, url } = await fixture(), page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1, ...(width < 700 ? { isMobile: true, hasTouch: true } : {}) });
      await initialize(page, url); const m = await page.evaluate(() => SYNKTownDay.metrics());
      check(`${width}-initial-home-is-real-webgl`, !m.fallback && store.read().state.day.location === 'home' && m.walk.enabled, { x: m.walk.x, z: m.walk.z, camera: m.camera });
      if (!before) check(`${width}-new-material-assets-load-without-fallback`, m.graphicsVersion === 2 && m.assetsReady && !m.assetFailures?.length, { graphicsVersion: m.graphicsVersion, assetsReady: m.assetsReady, assetFailures: m.assetFailures });
      await shot(page, `home-${width}`); metrics[width] = m;
      if (!before) await afterChecks(page, store, width);
      await page.close();
    }
    if (!before) {
      const tabletFixture = await fixture(), tablet = await browser.newPage({ viewport: { width: 700, height: 900 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      await initialize(tablet, tabletFixture.url); await axis(tablet, 'x', -3); await axis(tablet, 'z', 2.5); await axis(tablet, 'x', 0); await camera(tablet, 'close');
      await tablet.locator('#walk-interact').tap(); await until(() => walk(tablet).then(w => w.interactionOpen), 'tablet cafe interaction');
      await faceOutsidePanel(tablet, '700'); await shot(tablet, 'cafe-panel-700'); metrics.tablet = await tablet.evaluate(() => SYNKTownDay.metrics());
      await tablet.close();
      const { store, url } = await fixture(), page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      await initialize(page, url); await layout(page, 844, 'landscape-follow'); await shot(page, 'landscape-follow');
      await camera(page, 'close'); await inspectCamera(page, 'landscape-close'); await shot(page, 'landscape-close');
      await page.locator('#walk-interact').tap(); await until(() => walk(page).then(w => w.interactionOpen), 'landscape home interaction');
      await page.locator('[data-command="DAY_HOME_PREVIEW"][data-slot="table"]').click(); await click(page, 'DAY_HOME_CONFIRM');
      check('landscape-short-panel-scrolls-to-real-usable-life-actions', store.read().state.day.home.slot === 'table'
        && await page.evaluate(() => { const p = document.querySelector('#nearby-panel').getBoundingClientRect(); return p.top >= 0 && p.bottom <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1; }));
      await faceOutsidePanel(page, 'landscape');
      await shot(page, 'landscape-panel'); metrics.landscape = await page.evaluate(() => SYNKTownDay.metrics()); await page.close();
    }
    check('no-browser-errors', errors.length === 0, errors);
    const changedFiles = Object.entries(sourceHashes).filter(([file, hash]) => crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, file))).digest('hex') !== hash).map(([file]) => file);
    check('source-files-remain-stable-during-capture', changedFiles.length === 0, { changedFiles });
  } catch (error) { failure = error.stack || String(error); console.error(failure); }
  finally {
    await browser?.close(); await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))));
    fs.writeFileSync(path.join(output, `graphics-${stage}.json`), JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), sourceHashes, checks, screenshots: shots, metrics, errors, failure,
      limits: ['Headless Microsoft Edge with software/host GPU; no physical phone or human enjoyment claim', 'Fresh isolated in-memory store for every viewport; no user-save reset'] }, null, 2));
    if (failure) process.exitCode = 1;
  }
})();
