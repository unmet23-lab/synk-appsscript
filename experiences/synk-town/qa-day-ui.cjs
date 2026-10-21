// Local browser exercise: story decisions use visible controls, while assertions
// read the isolated server's state. No production save or external service is used.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), { pathToFileURL } = require('node:url');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = path.join(__dirname, 'qa'), checks = [], errors = [], servers = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const check = (name, ok, details) => { checks.push({ name, ok: !!ok, ...(details === undefined ? {} : { details }) }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) throw new Error(name); };
async function until(fn, name, ms = 25000) { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return; await delay(100); } throw Error(`Timeout: ${name}`); }
async function click(page, type, data = {}) {
  const attributes = Object.entries(data).map(([k, v]) => `[data-${k}="${v}"]`).join('');
  const button = page.locator(`[data-command="${type}"]${attributes}`).filter({ visible: true }).first();
  await button.waitFor({ state: 'visible' }); await button.click();
  await until(() => page.locator('#day-app').getAttribute('aria-busy').then(v => v !== 'true'), `${type} finishes`);
  const error = await page.locator('#error').isVisible(); if (error) throw new Error(await page.locator('#error').textContent());
}
async function look(page) { await page.locator('#scene').scrollIntoViewIfNeeded(); await page.evaluate(() => document.querySelector('#scene').scrollIntoView({ block: 'start', behavior: 'instant' })); }
async function startServer() {
  const { createStore, createServer } = await import(pathToFileURL(path.join(__dirname, 'server.mjs')).href);
  const store = createStore({ lifeEnabled: true }), server = createServer({ previewEnabled: true, store });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); servers.push(server);
  return { store, url: `http://127.0.0.1:${server.address().port}/day.html?controls=classic` };
}
async function initialized(page, url) {
  page.on('pageerror', error => errors.push(error.message)); await page.goto(url);
  await page.waitForFunction(() => globalThis.SYNKTownDay?.snapshot()?.view.day && document.querySelector('#day-app').getAttribute('aria-busy') === 'false');
}
(async () => {
  let browser, failure = null; const startedAt = new Date().toISOString(), metrics = {};
  const sourceHashes = Object.fromEntries(['day-scene.mjs', 'day-app.mjs', 'day-style.css', 'day.html'].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, file))).digest('hex')]));
  try {
    fs.mkdirSync(output, { recursive: true }); browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
    const { store, url } = await startServer(), page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });
    await initialized(page, url); await page.waitForFunction(() => SYNKTownDay.metrics().ready); await look(page); await delay(1000);
    check('starts-at-home-with-real-webgl-and-four-actors', store.read().state.day.location === 'home' && await page.evaluate(() => SYNKTownDay.metrics().actorCount === 4 && !SYNKTownDay.metrics().fallback));
    await page.screenshot({ path: path.join(output, 'day-home-desktop.png') });
    await click(page, 'DAY_HOME_PREVIEW', { slot: 'table' });
    check('home-preview-does-not-commit', store.read().state.day.home.slot === 'window' && store.read().state.day.home.previewSlot === 'table');
    await click(page, 'DAY_HOME_CANCEL'); check('home-cancel-keeps-original-placement', store.read().state.day.home.slot === 'window' && store.read().state.day.home.previewSlot === null);
    await click(page, 'DAY_HOME_PREVIEW', { slot: 'table' }); await click(page, 'DAY_HOME_CONFIRM');
    check('home-confirm-persists-one-choice', store.read().state.day.home.slot === 'table');
    await click(page, 'DAY_MOVE', { location: 'cafe' });
    check('leaving-home-is-an-explicit-second-choice', store.read().state.day.location === 'home' && store.read().state.day.home.exitTarget === 'cafe');
    await click(page, 'DAY_EXIT'); await click(page, 'CHOOSE', { branch: 'inside' }); await click(page, 'NEXT'); await click(page, 'PLACE'); await look(page);
    await until(() => store.read().state.delivered, 'FT real execution and visible acknowledgement', 35000);
    check('first-seat-uses-authoritative-execution-before-delivery', store.read().state.served && store.read().state.delivered);
    check('legacy-owner-is-not-cloned', await page.evaluate(() => SYNKTownDay.metrics().actorCount <= 5));
    await page.screenshot({ path: path.join(output, 'day-cafe-desktop.png') });
    await page.locator('#settings-open').click(); await page.locator('#contact-options [data-mode="quiet"]').click(); await until(() => store.read().state.life.mode === 'quiet', 'quiet saved'); await page.locator('#settings-close').click();
    await page.locator('#life-open').waitFor({ state: 'visible', timeout: 25000 }); await page.locator('#life-open').click();
    await click(page, 'LIFE_ROLE', { role: 'planner' }); await click(page, 'LIFE_DIRECTION', { direction: 'near' }); await click(page, 'LIFE_CONFIRM'); await look(page);
    await until(() => store.read().state.life.episode?.delivered, 'C1 shared body result is observed', 25000);
    check('c1-uses-the-same-owner-and-records-visible-direct-help', store.read().state.life.currentAgreement.direction === 'near' && await page.evaluate(() => SYNKTownDay.metrics().actorCount <= 5));
    await click(page, 'LIFE_CLOSE');
    await click(page, 'DAY_START', { kind: 'tea' }); await click(page, 'DAY_ROLE', { role: 'planner' }); await click(page, 'DAY_CHOICE', { choice: 'sequence' }); await look(page);
    await until(() => store.read().state.day.episode.stage === 'awaitContinue', 'tea demonstration waits'); await click(page, 'DAY_CONTINUE'); await click(page, 'DAY_CONFIRM'); await look(page);
    await until(() => store.read().state.day.episode.stage === 'awaitTea', 'picture awaits explicit tea choice');
    check('tea-sequence-does-not-skip-the-picture-choice', store.read().state.day.history.length === 0 && store.read().state.day.episode.part === 0);
    await page.screenshot({ path: path.join(output, 'day-tea-picture.png') }); await click(page, 'DAY_TEA_NEXT'); await look(page);
    await until(() => Number.isFinite(store.read().state.day.history.at(-1)?.observedU), 'tea result observed');
    check('tea-uses-explicit-next-and-keeps-role-memory', store.read().state.day.history.at(-1)?.kind === 'tea' && store.read().state.day.history.at(-1)?.role === 'planner');
    await click(page, 'DAY_CLOSE'); await page.locator('#settings-open').click(); await click(page, 'DAY_SUPPORT', { mode: 'plan' }); await page.locator('#settings-close').click();
    await click(page, 'DAY_START', { kind: 'coordination' }); await click(page, 'DAY_ROLE', { role: 'planner' }); await click(page, 'DAY_CHOICE', { choice: 'silent' }); await look(page);
    await until(() => store.read().state.day.episode.stage === 'awaitConfirm', 'plan rehearsal waits for confirmation');
    check('planning-rehearsal-does-not-commit-a-new-agreement', store.read().state.day.history.length === 1 && !store.read().state.day.agreement);
    await click(page, 'DAY_CONFIRM'); await look(page); await until(() => Number.isFinite(store.read().state.day.history.at(-1)?.observedU) && store.read().state.day.history.length === 2, 'coordination result observed');
    check('silent-coordination-preserves-chosen-habit-and-three-npcs', store.read().state.day.agreement.choice === 'silent' && await page.evaluate(() => SYNKTownDay.metrics().actorCount === 4));
    await page.screenshot({ path: path.join(output, 'day-coordination.png') });
    await click(page, 'DAY_CLOSE'); await page.locator('#settings-open').click(); await click(page, 'DAY_SUPPORT', { mode: 'demo' }); await page.locator('#settings-close').click();
    await click(page, 'DAY_MOVE', { location: 'workshop' }); await click(page, 'DAY_START', { kind: 'help' }); await click(page, 'DAY_CHOICE', { choice: 'hold' }); await look(page);
    await until(() => store.read().state.day.episode.stage === 'awaitContinue', 'demo reaches player choice');
    check('demonstration-waits-for-player-continuation', store.read().state.day.history.length === 2);
    await click(page, 'DAY_CONTINUE'); await click(page, 'DAY_CONFIRM'); await look(page);
    await until(() => store.read().state.day.episode.stage === 'awaitFinish', 'helper holds until direction choice');
    await click(page, 'DAY_HELP_DIRECTION', { direction: 'near' });
    check('helper-keeps-the-requested-direction-pending', store.read().state.day.episode.direction === 'near' && store.read().state.day.history.length === 2);
    await click(page, 'DAY_HELP_FINISH'); await look(page);
    await until(() => store.read().state.day.history.length === 3 && Number.isFinite(store.read().state.day.history.at(-1)?.observedU), 'help result is actually observed');
    check('quiet-mode-still-allows-direct-cooperation-and-memory', store.read().state.life.mode === 'quiet' && store.read().state.day.history.at(-1)?.role === 'planner');
    await page.screenshot({ path: path.join(output, 'day-workshop-desktop.png') });
    await click(page, 'DAY_CLOSE'); await click(page, 'DAY_JOB_START'); await click(page, 'DAY_MOVE', { location: 'home' });
    check('return-home-keeps-chosen-placement-and-running-job', store.read().state.day.home.slot === 'table' && store.read().state.day.job.status === 'preparing');
    await click(page, 'DAY_MOVE', { location: 'greenhouse' }); await click(page, 'DAY_EXIT');
    check('next-outing-increments-visit-without-erasing-memory', store.read().state.day.visit === 2 && store.read().state.day.history.length === 3);
    await look(page);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 900 }); await look(page); await delay(350);
      check(`mobile-${width}-no-horizontal-overflow-or-broken-images`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && [...document.images].every(i => i.complete && i.naturalWidth > 0)));
      await page.screenshot({ path: path.join(output, `day-ui-${width}.png`) });
    }
    await page.setViewportSize({ width: 1280, height: 1000 }); await look(page); await delay(1500); metrics.balanced = await page.evaluate(() => SYNKTownDay.metrics());
    await page.locator('#settings-open').click(); await page.locator('#quality-experience').click(); await page.locator('#settings-close').click(); await look(page); await delay(1400); metrics.experience = await page.evaluate(() => SYNKTownDay.metrics());
    check('quality-changes-independently-of-camera', metrics.experience.quality === 'experience' && metrics.experience.camera === metrics.balanced.camera);
    await page.emulateMedia({ reducedMotion: 'reduce' }); await delay(250); check('reduced-motion-is-respected', await page.evaluate(() => SYNKTownDay.metrics().reducedMotion));
    await until(() => store.read().state.day.job.status === 'ready', 'server-time preparation finishes', 40000);
    await click(page, 'DAY_MOVE', { location: 'workshop' }); await click(page, 'DAY_JOB_COLLECT');
    check('prepared-object-is-used-without-inventory-or-credit-farming', store.read().state.day.job.status === 'collected');
    await click(page, 'DAY_MOVE', { location: 'home' }); await page.reload(); await page.waitForFunction(() => globalThis.SYNKTownDay?.snapshot()?.view.day); await look(page);
    check('reload-preserves-home-choice-completed-help-and-job', store.read().state.day.home.slot === 'table' && store.read().state.day.history.length === 3 && store.read().state.day.job.status === 'collected');
    await page.close();

    const mobileFixture = await startServer(), mobile = await browser.newPage({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 3 });
    await initialized(mobile, mobileFixture.url); await click(mobile, 'DAY_MOVE', { location: 'cafe' }); await click(mobile, 'DAY_EXIT');
    await click(mobile, 'CHOOSE', { branch: 'inside' }); await click(mobile, 'NEXT'); await click(mobile, 'PLACE'); await look(mobile);
    await until(() => mobileFixture.store.read().state.delivered, 'mobile real WebGL FT acknowledgement', 35000);
    check('mobile-390-ft-ack-needs-only-the-visible-scene', mobileFixture.store.read().state.served && mobileFixture.store.read().state.delivered);
    metrics.mobileDpr3 = await mobile.evaluate(() => SYNKTownDay.metrics()); check('mobile-balanced-caps-dpr', metrics.mobileDpr3.dpr <= 1.25);
    await mobile.screenshot({ path: path.join(output, 'day-ft-mobile.png') }); await mobile.close();

    const fallbackFixture = await startServer(), alternative = await browser.newPage({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
    await alternative.addInitScript(() => { const get = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (kind, ...args) { return String(kind).startsWith('webgl') || kind === 'experimental-webgl' ? null : get.call(this, kind, ...args); }; });
    await initialized(alternative, fallbackFixture.url);
    check('webgl-failure-is-honest-and-keeps-actions', await alternative.evaluate(() => SYNKTownDay.metrics().fallback && !document.querySelector('#scene-fallback').hidden && document.querySelectorAll('#day-actions button').length > 0));
    await click(alternative, 'DAY_HOME_PREVIEW', { slot: 'table' }); await click(alternative, 'DAY_HOME_CONFIRM'); await click(alternative, 'DAY_MOVE', { location: 'cafe' }); await click(alternative, 'DAY_EXIT');
    await click(alternative, 'CHOOSE', { branch: 'inside' }); await click(alternative, 'NEXT'); await click(alternative, 'PLACE'); await look(alternative);
    await until(() => fallbackFixture.store.read().state.delivered, 'fallback explicit visual alternative can finish FT', 35000);
    check('fallback-finishes-the-same-seat-flow', fallbackFixture.store.read().state.served && fallbackFixture.store.read().state.day.home.slot === 'table');
    await alternative.screenshot({ path: path.join(output, 'day-fallback-mobile.png') }); metrics.fallback = await alternative.evaluate(() => SYNKTownDay.metrics());
    check('no-page-javascript-errors', errors.length === 0, errors);
  } catch (error) { failure = error.stack || String(error); }
  finally {
    fs.writeFileSync(path.join(output, 'day-ui.json'), JSON.stringify({ status: failure ? 'failed' : 'passed', startedAt, finishedAt: new Date().toISOString(), sourceHashes, environment: 'Headless Microsoft Edge on Windows; viewport emulation, not physical phone', checks, metrics, errors, failure, liveDeployment: false, realPlayers: 0, physicalDevices: 0 }, null, 2) + '\n');
    await browser?.close(); await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))));
  }
  console.log(JSON.stringify({ checks: checks.length, passed: checks.filter(c => c.ok).length, failure })); if (failure) process.exitCode = 1;
})();
