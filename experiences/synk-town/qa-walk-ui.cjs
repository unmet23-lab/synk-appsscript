// Direct browser input against an isolated Town host. The test never writes a pose
// or game state. Gamepad and mobile touch use synthetic device input and are not
// physical-controller or phone validation. A temporary input probes focus safety.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = path.join(__dirname, 'qa'), servers = [], checks = [], errors = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const check = (name, ok, details) => { checks.push({ name, ok: !!ok, ...(details === undefined ? {} : { details }) }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) throw Error(name); };
async function until(fn, name, ms = 30000) { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return; await delay(80); } throw Error(`Timeout: ${name}`); }
const walk = page => page.evaluate(() => SYNKTownDay.metrics().walk);
async function quiet(page) {
  await until(async () => { const w = await walk(page); return w.pending === 0 && !w.sending && !w.moving && await page.locator('#day-app').getAttribute('aria-busy') !== 'true'; }, 'movement queue settles');
  if (await page.locator('#error').isVisible()) throw Error(await page.locator('#error').textContent());
}
async function focus(page) { await page.bringToFront(); await page.locator('#scene').focus(); }
async function hold(page, key, ms) { await focus(page); await page.keyboard.down(key); try { await delay(ms); } finally { await page.keyboard.up(key); } await quiet(page); }
async function axis(page, dimension, target, tolerance = .13) {
  await focus(page); const p = await walk(page), sign = Math.sign(target - p[dimension]); if (Math.abs(target - p[dimension]) <= tolerance) return;
  const key = dimension === 'x' ? sign > 0 ? 'd' : 'a' : sign > 0 ? 's' : 'w';
  await page.keyboard.down(key);
  try { await until(async () => sign * (target - (await walk(page))[dimension]) <= tolerance, `walk ${dimension} to ${target}`, 12000); }
  finally { await page.keyboard.up(key); }
  await quiet(page);
}
async function click(page, type, data = {}) {
  const attrs = Object.entries(data).map(([k, v]) => `[data-${k}="${v}"]`).join('');
  await page.locator(`[data-command="${type}"]${attrs}`).filter({ visible: true }).first().click();
  await until(() => page.locator('#day-app').getAttribute('aria-busy').then(v => v !== 'true'), `${type} completes`);
  if (await page.locator('#error').isVisible()) throw Error(await page.locator('#error').textContent());
}
async function fixture() {
  const { createStore, createServer } = await import(pathToFileURL(path.join(__dirname, 'server.mjs')).href);
  const store = createStore({ lifeEnabled: true }), server = createServer({ previewEnabled: true, store });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); servers.push(server);
  return { store, url: `http://127.0.0.1:${server.address().port}/day.html` };
}
async function initialize(page, url, { gamepad = false } = {}) {
  page.on('pageerror', e => errors.push(e.message));
  if (gamepad) await page.addInitScript(() => { globalThis.__qaPad = null; Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => globalThis.__qaPad ? [globalThis.__qaPad] : [] }); });
  await page.goto(url); await page.waitForFunction(() => globalThis.SYNKTownDay?.snapshot()?.view.day && document.querySelector('#day-app').getAttribute('aria-busy') === 'false');
  await until(() => page.evaluate(() => SYNKTownDay.metrics().walk?.enabled || SYNKTownDay.metrics().fallback), 'walking or text fallback available');
  await focus(page); await quiet(page);
}
async function pad(page, { x = 0, z = 0, pressed = [] } = {}) {
  await page.evaluate(({ x, z, pressed }) => { globalThis.__qaPad = { id: 'QA synthetic standard gamepad', index: 0, connected: true, mapping: 'standard', axes: [x, z, 0, 0], buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), touched: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })), timestamp: performance.now() }; }, { x, z, pressed });
}
async function touchDrag(page, { x, z, ms }) {
  const box = await page.locator('#walk-joystick').boundingBox(), c = { x: box.x + box.width / 2, y: box.y + box.height / 2 }, radius = box.width * .35;
  const client = await page.context().newCDPSession(page);
  try {
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...c, id: 1 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c.x + x * radius, y: c.y + z * radius, id: 1 }] });
    await delay(ms); await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally { await client.detach(); }
  await quiet(page);
}
(async () => {
  let browser, failure = null; const startedAt = new Date().toISOString(), metrics = {}, observations = {};
  const hashFiles = ['walk.mjs', 'walk-controls.mjs', 'day.mjs', 'core.mjs', 'server.mjs', 'day-app.mjs', 'day-style.css', 'day.html', 'day-scene.mjs'];
  const sourceHashes = Object.fromEntries(hashFiles.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, file))).digest('hex')]));
  try {
    fs.mkdirSync(output, { recursive: true });
    const { WALK_BOUNDS, WALK_SPAWNS, isWalkable } = await import(pathToFileURL(path.join(__dirname, 'walk.mjs')).href);
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
    const { store, url } = await fixture(), context = await browser.newContext({ viewport: { width: 1280, height: 900 } }), page = await context.newPage();
    await initialize(page, url, { gamepad: true });
    const initial = await walk(page);
    check('default-is-direct-walking-with-follow-camera-and-no-place-menu', initial.enabled && !initial.interactionOpen && await page.locator('#destinations').isHidden() && await page.evaluate(() => SYNKTownDay.metrics().camera === 'follow'));
    await page.screenshot({ path: path.join(output, 'WALK-home-desktop.png') });
    await page.keyboard.press('e'); await until(() => walk(page).then(w => w.interactionOpen), 'home E interaction');
    check('nearby-e-opens-life-without-teleporting', store.read().state.day.location === 'home' && distance(initial, await walk(page)) < .08);
    await click(page, 'DAY_HOME_PREVIEW', { slot: 'table' }); await click(page, 'DAY_HOME_CONFIRM');
    check('nearby-home-life-commits-the-existing-cushion-choice', store.read().state.day.home.slot === 'table');
    await page.locator('#walk-close').click(); await hold(page, 'd', 450); const firstStep = await walk(page);
    check('wasd-moves-the-character-continuously-and-closes-life-panel', firstStep.x > initial.x + .6 && Math.abs(firstStep.z - initial.z) < .15 && !firstStep.interactionOpen);
    await axis(page, 'x', -3); await axis(page, 'z', 2.6);
    check('walking-between-places-does-not-open-questions', !(await walk(page)).nearby && !(await walk(page)).interactionOpen && store.read().state.day.location === 'home');
    await page.keyboard.press('e'); await delay(200);
    check('e-out-of-range-has-no-life-effect', !(await walk(page)).interactionOpen && await page.locator('#walk-interact').isDisabled());
    const beforeArrow = await walk(page); await hold(page, 'ArrowRight', 450);
    check('arrow-keys-use-the-same-ground-movement', (await walk(page)).x > beforeArrow.x + .6 && isWalkable(await walk(page)));
    await axis(page, 'x', WALK_SPAWNS.cafe.x); await axis(page, 'z', WALK_SPAWNS.cafe.z);
    const cafeBefore = await walk(page); await page.keyboard.press('e'); await until(() => walk(page).then(w => w.interactionOpen), 'cafe E interaction');
    check('walk-from-home-to-cafe-opens-only-on-interaction', cafeBefore.nearby === 'cafe' && store.read().state.day.location === 'cafe' && distance(cafeBefore, await walk(page)) < .08);
    await click(page, 'CHOOSE', { branch: 'inside' }); await click(page, 'NEXT'); await click(page, 'PLACE');
    await until(() => store.read().state.delivered, 'FT10 actual use and observation from the walking screen', 40000);
    check('direct-walking-connects-to-a-complete-existing-life-result', store.read().state.served && store.read().state.delivered && store.read().state.day.home.slot === 'table');
    await page.screenshot({ path: path.join(output, 'WALK-cafe-life-desktop.png') }); await page.locator('#walk-close').click();

    await axis(page, 'x', -3); await hold(page, 's', 1600); const edge = await walk(page);
    await hold(page, 's', 400);
    check('ground-boundary-stops-held-input-without-leaving-world', edge.z <= WALK_BOUNDS.maxZ && edge.z > WALK_BOUNDS.maxZ - .1 && distance(edge, await walk(page)) < .05 && isWalkable(await walk(page)));
    await axis(page, 'z', WALK_SPAWNS.home.z); await axis(page, 'x', WALK_SPAWNS.home.x); await hold(page, 'w', 2100); const obstacle = await walk(page);
    await hold(page, 'w', 400);
    check('walls-or-furniture-block-movement-without-crossing-solid-geometry', obstacle.z < 2 && distance(obstacle, await walk(page)) < .07 && isWalkable(await walk(page)));
    await axis(page, 'z', WALK_SPAWNS.home.z); await axis(page, 'x', WALK_SPAWNS.cafe.x); await axis(page, 'z', WALK_SPAWNS.cafe.z);
    const beforeModal = await walk(page); await page.locator('#settings-open').click(); await page.keyboard.down('d'); await delay(500); await page.keyboard.up('d');
    check('modal-dialog-stops-walking-input', distance(beforeModal, await walk(page)) < .08);
    await page.locator('#settings-close').click(); await focus(page); await delay(250); await quiet(page);
    check('closing-dialog-does-not-resume-a-held-key', distance(beforeModal, await walk(page)) < .08);

    await page.evaluate(() => { const input = document.createElement('textarea'); input.id = 'qa-walk-focus'; input.setAttribute('aria-label', 'QA focus safety probe'); Object.assign(input.style, { position: 'fixed', zIndex: 1000, left: '400px', top: '250px' }); document.body.append(input); input.focus(); });
    const beforeInput = await walk(page); await page.keyboard.type('wasd'); await delay(300);
    check('focused-input-receives-text-without-moving-player', await page.locator('#qa-walk-focus').inputValue() === 'wasd' && distance(beforeInput, await walk(page)) < .08);
    await page.locator('#qa-walk-focus').evaluate(el => el.remove()); await focus(page);
    const other = await page.context().newPage(); await other.goto('about:blank'); await other.bringToFront();
    observations.nativeHeadlessBackgroundState = await page.evaluate(() => ({ hidden: document.hidden, focus: document.hasFocus() }));
    await other.close(); await focus(page);
    await page.keyboard.down('d'); await delay(180);
    await page.evaluate(() => { Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => false }); window.dispatchEvent(new Event('blur')); });
    await page.keyboard.up('d'); await quiet(page); const blurred = structuredClone(store.read().state.day.walk); await delay(450);
    check('synthetic-blur-stops-committed-movement', distance(blurred, store.read().state.day.walk) < .08 && !(await walk(page)).moving);
    await page.evaluate(() => { delete document.hasFocus; window.dispatchEvent(new Event('focus')); }); await delay(250); await focus(page);
    await page.keyboard.down('a'); await delay(180);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.keyboard.up('a'); await quiet(page); const hidden = structuredClone(store.read().state.day.walk); await delay(450);
    check('synthetic-hidden-document-stops-committed-movement', distance(hidden, store.read().state.day.walk) < .08 && !(await walk(page)).moving);
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); }); await delay(250); await focus(page); await quiet(page); const afterReturn = await walk(page); await delay(350);
    check('returning-from-hidden-state-requires-new-movement-input', distance(afterReturn, await walk(page)) < .08);

    await axis(page, 'x', WALK_SPAWNS.cafe.x); await pad(page); await delay(250); const beforePad = await walk(page);
    await pad(page, { x: .75 }); await delay(600); await pad(page); await quiet(page);
    check('synthetic-standard-gamepad-left-stick-moves-player', (await walk(page)).x > beforePad.x + .5 && (await walk(page)).input === 'gamepad');
    await axis(page, 'x', WALK_SPAWNS.cafe.x); await pad(page); await delay(150);
    await pad(page, { pressed: [0] }); await until(() => walk(page).then(w => w.interactionOpen), 'gamepad A opens interaction'); await delay(500);
    check('synthetic-gamepad-a-opens-once-without-auto-selecting-next-life', (await walk(page)).interactionOpen && !store.read().state.day.episode);
    await pad(page); await delay(150); await pad(page, { pressed: [1] }); await until(() => walk(page).then(w => !w.interactionOpen), 'gamepad B closes interaction'); await pad(page); await quiet(page);
    const saved = structuredClone(store.read().state.day.walk); await page.reload(); await page.waitForFunction(() => globalThis.SYNKTownDay?.metrics()?.walk?.enabled); await focus(page); await quiet(page);
    const reloaded = await walk(page), savedHeading = Math.atan2(saved.headingX, saved.headingZ);
    check('reload-restores-the-committed-player-position-and-heading', distance(saved, reloaded) < .08 && Math.cos(reloaded.heading - savedHeading) > .999);
    await page.emulateMedia({ reducedMotion: 'reduce' }); const reduceStart = await walk(page); await hold(page, 'ArrowLeft', 300);
    check('reduced-motion-keeps-direct-control-and-the-same-world-rules', await page.evaluate(() => SYNKTownDay.metrics().reducedMotion) && (await walk(page)).x < reduceStart.x - .3 && isWalkable(await walk(page)));
    metrics.desktop = await page.evaluate(() => SYNKTownDay.metrics()); await page.screenshot({ path: path.join(output, 'WALK-follow-desktop.png') }); await page.close();

    for (const width of [390, 320]) {
      const mobileFixture = await fixture(), mobile = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
      await initialize(mobile, mobileFixture.url); const origin = await walk(mobile);
      await touchDrag(mobile, { x: 1, z: 0, ms: 650 }); const moved = await walk(mobile);
      check(`mobile-${width}-touch-joystick-moves-through-the-ground`, moved.x > origin.x + .7 && moved.input === 'touch' && !moved.interactionOpen && isWalkable(moved));
      await delay(350); check(`mobile-${width}-releasing-touch-stops-movement`, distance(moved, await walk(mobile)) < .08);
      check(`mobile-${width}-hud-controls-fit-without-horizontal-overflow`, await mobile.evaluate(() => { const j = document.querySelector('#walk-joystick').getBoundingClientRect(), b = document.querySelector('#walk-interact').getBoundingClientRect(); return document.documentElement.scrollWidth <= innerWidth + 1 && j.left >= 0 && j.bottom <= innerHeight && b.right <= innerWidth && b.bottom <= innerHeight && j.right <= b.left; }));
      await mobile.screenshot({ path: path.join(output, `WALK-touch-${width}.png`) });
      await touchDrag(mobile, { x: 1, z: 0, ms: 1150 });
      check(`mobile-${width}-walking-near-cafe-does-not-auto-open-life`, (await walk(mobile)).nearby === 'cafe' && !(await walk(mobile)).interactionOpen);
      await mobile.locator('#walk-interact').tap(); await until(() => walk(mobile).then(w => w.interactionOpen), 'mobile nearby interaction');
      check(`mobile-${width}-nearby-button-opens-the-existing-cafe-life`, mobileFixture.store.read().state.day.location === 'cafe' && await mobile.locator('#nearby-panel').isVisible());
      check(`mobile-${width}-camera-button-does-not-cover-the-caption`, await mobile.evaluate(() => { const a = document.querySelector('#scene-caption').getBoundingClientRect(), b = document.querySelector('#camera-toggle').getBoundingClientRect(); return a.bottom <= b.top || b.bottom <= a.top || a.right <= b.left || b.right <= a.left; }));
      await mobile.screenshot({ path: path.join(output, `WALK-cafe-${width}.png`) }); metrics[`mobile${width}`] = await mobile.evaluate(() => SYNKTownDay.metrics()); await mobile.close();
    }
    const alternativeFixture = await fixture(), alternative = await browser.newPage({ viewport: { width: 390, height: 900 } });
    await alternative.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (kind, ...args) { return String(kind).startsWith('webgl') || kind === 'experimental-webgl' ? null : original.call(this, kind, ...args); }; });
    await initialize(alternative, alternativeFixture.url);
    check('webgl-failure-keeps-an-explicit-text-place-alternative', await alternative.evaluate(() => SYNKTownDay.metrics().fallback) && !(await walk(alternative)).enabled && await alternative.locator('#destinations').isVisible());
    await click(alternative, 'DAY_HOME_PREVIEW', { slot: 'table' }); await click(alternative, 'DAY_HOME_CONFIRM');
    check('text-fallback-still-commits-the-same-home-life-result', alternativeFixture.store.read().state.day.home.slot === 'table');
    await alternative.screenshot({ path: path.join(output, 'WALK-text-fallback.png') }); metrics.fallback = await alternative.evaluate(() => SYNKTownDay.metrics());
    check('no-page-javascript-errors', errors.length === 0, errors);
  } catch (e) { failure = e.stack || String(e); }
  finally {
    const sourceHashesAtFinish = Object.fromEntries(hashFiles.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, file))).digest('hex')]));
    fs.writeFileSync(path.join(output, 'WALK-ui.json'), JSON.stringify({ status: failure ? 'failed' : 'passed', startedAt, finishedAt: new Date().toISOString(), sourceHashes, sourceHashesAtFinish,
      sourceUnchangedDuringRun: JSON.stringify(sourceHashes) === JSON.stringify(sourceHashesAtFinish), environment: 'Headless Microsoft Edge on Windows; desktop and emulated mobile viewports',
      inputEvidence: { keyboard: 'Playwright browser keyboard events', touch: 'CDP synthetic touch contacts driving the visible joystick', gamepad: 'synthetic navigator.getGamepads standard device; no physical controller', textFocus: 'temporary textarea for the editing-focus guard; no game-state writes', blurAndHidden: 'synthetic document focus/hidden conditions and corresponding DOM events; native headless tab focus behavior is recorded separately' },
      checks, metrics, observations, errors, failure, stateMutationForSetup: false, liveDeployment: false, realPlayers: 0, physicalDevices: 0 }, null, 2) + '\n');
    await browser?.close(); await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))));
  }
  console.log(JSON.stringify({ checks: checks.length, passed: checks.filter(c => c.ok).length, failure })); if (failure) process.exitCode = 1;
})();
