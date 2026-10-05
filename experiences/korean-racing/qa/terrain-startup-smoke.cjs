// Focused browser checks for terrain worker startup and the existing ready guards.
// Use the bundled Playwright via PLAYWRIGHT_MODULE (same as first-run-profile.cjs).
// Usage: node qa/terrain-startup-smoke.cjs [http://127.0.0.1:5197/] [output-directory]
const assert = require('node:assert/strict');
const path = require('node:path');
const {mkdir, writeFile} = require('node:fs/promises');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const pageUrl = new URL(process.argv[2] || 'http://127.0.0.1:5197/').href;
const outputDirectory = process.argv[3] ? path.resolve(process.argv[3]) : __dirname;
const outputPath = path.join(outputDirectory, 'terrain-startup-smoke-20261004.json');
const report = {version: 1, capturedAt: new Date().toISOString(), pageUrl,
  gpu: 'Chrome headless, --enable-gpu --use-angle=d3d11', cases: [], ok: false};

main().catch(error => {console.error(error); process.exitCode = 1;});

async function main() {
  let browser;
  try {
    await mkdir(outputDirectory, {recursive: true});
    browser = await chromium.launch({channel: 'chrome', headless: true, args: ['--enable-gpu', '--use-angle=d3d11']});
    const normal = await runCase(browser, 'normal');
    for (const mode of ['constructor-error', 'script-error', 'delayed-result']) {
      const result = await runCase(browser, mode);
      assert.deepEqual(geometrySignature(result.snapshot), geometrySignature(normal.snapshot), `${mode}: terrain/coast geometry must match normal startup`);
      result.geometryMatchesNormal = true;
    }
    await runCase(browser, 'asset-error');
    report.ok = report.cases.every(result => result.ok);
  } catch (error) {
    report.failure = String(error.stack || error);
    throw error;
  } finally {
    await browser?.close();
    await writeFile(outputPath, JSON.stringify(report, null, 2) + '\n');
    console.log(`${report.ok ? 'PASS' : 'FAIL'}: ${report.cases.length} terrain startup browser cases; ${outputPath}`);
  }
}

async function runCase(browser, mode) {
  const result = {mode, ok: false, pageErrors: [], consoleErrors: [], failedRequests: [], terrainScriptAborts: 0};
  report.cases.push(result);
  const context = await browser.newContext({viewport: {width: 1440, height: 900}});
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => result.pageErrors.push(String(error)));
  page.on('console', message => {if (message.type() === 'error') result.consoleErrors.push(message.text());});
  page.on('requestfailed', request => result.failedRequests.push({url: request.url(), error: request.failure()?.errorText}));
  let releaseAsset;
  const assetGate = new Promise(resolve => {releaseAsset = resolve;});
  try {
    await page.addInitScript(instrumentTerrainWorker, mode);
    if (mode === 'script-error') {
      await context.route(new URL('./terrain-worker.js', pageUrl).href, async route => {
        result.terrainScriptAborts++;
        await route.abort('failed');
      });
    }
    if (mode === 'asset-error') {
      await context.route(new URL('./assets/road.jpg', pageUrl).href, async route => {
        await assetGate;
        await route.abort('failed');
      });
    }
    const response = await page.goto(pageUrl, {waitUntil: 'domcontentloaded', timeout: 90000});
    assert.equal(response?.ok(), true, `${mode}: page must load`);
    if (mode === 'delayed-result') await exercisePendingSelections(page, result);
    if (mode === 'asset-error') {
      // Hold a real terrain result while the asset promise is still pending.
      await page.waitForFunction(() => window.__terrainSmoke?.queued > 0, null, {timeout: 12000});
      result.beforeFailure = await inspect(page);
      assert.equal(result.beforeFailure.snapshot.ready, false);
      assert.equal(result.beforeFailure.worker.terminateCalls, 0);
      releaseAsset();
      await page.waitForFunction(() => window.__racing?.snapshot().startup.phase === 'failed');
      result.afterFailure = await inspect(page);
      assertFailed(result.afterFailure);
      assert.equal(result.afterFailure.worker.terminateCalls, 1);
      // Simulate an already-queued event using the callback captured before cancel.
      await page.evaluate(() => window.__terrainRelease(true));
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      result.afterLateCallback = await inspect(page);
      assertFailed(result.afterLateCallback);
      assert.equal(result.afterLateCallback.worker.terminateCalls, 1);
      assert.equal(result.afterLateCallback.worker.lateDelivered, 1);
      result.snapshot = result.afterLateCallback.snapshot;
      result.worker = result.afterLateCallback.worker;
    } else {
      await page.waitForSelector('#watch:not([disabled])', {timeout: 120000});
      const state = await inspect(page);
      result.snapshot = state.snapshot;
      result.worker = state.worker;
      result.controls = state.controls;
      assertReady(state);
      if (mode === 'constructor-error') {
        assert.equal(state.snapshot.startup.terrainSource, 'fallback');
        assert.equal(state.snapshot.startup.terrainFallback, 'worker-unavailable');
        assert.equal(state.worker.created, 0);
        assert.equal(state.worker.terminateCalls, 0);
      } else {
        assert.equal(state.worker.created, 1);
        assert.equal(state.worker.terminateCalls, 1);
        assert.equal(state.snapshot.startup.terrainSource, mode === 'script-error' ? 'fallback' : 'worker');
        if (mode === 'script-error') {
          assert.equal(result.terrainScriptAborts, 1);
          assert.equal(state.snapshot.startup.terrainFallback, 'worker-error');
        } else {
          assert.equal(state.worker.nativeMessages, 1);
          assert.equal(state.worker.delivered, 1);
          assert(Number.isFinite(state.snapshot.startup.terrainWorkerMs));
        }
      }
      if (mode === 'delayed-result') {
        assert.equal(state.snapshot.stage.id, result.selectedStage);
        assert.equal(state.snapshot.driver.name, 'kkamong');
        assert.equal(state.snapshot.driver.seated, true);
        assert.equal(state.snapshot.quality, 'low');
        assert.equal(state.snapshot.scenery, 'coast');
      }
      if (mode === 'normal') {
        result.screenshot = path.join(outputDirectory, 'terrain-startup-desktop-20261004.jpg');
        await page.screenshot({path: result.screenshot, type: 'jpeg', quality: 90});
        await exerciseAutomaticDrive(page, result);
      }
    }
    assert.deepEqual(result.pageErrors, [], `${mode}: errors must be handled, not page errors`);
    result.ok = true;
    console.log(`PASS ${mode}`);
    return result;
  } catch (error) {
    result.failure = String(error.stack || error);
    result.lastState = await inspect(page).catch(() => null);
    throw error;
  } finally {
    releaseAsset();
    await context.close();
  }
}

async function exerciseAutomaticDrive(page, result) {
  await page.locator('#watch').click();
  await page.waitForFunction(() => window.__racing?.snapshot().running, null, {timeout: 30000});
  const before = (await inspect(page)).snapshot;
  const chunkLength = before.terrain.chunkLength;
  const boundary = -150 + (Math.floor((before.playerS + 150) / chunkLength) + 1) * chunkLength;
  const targetS = boundary + chunkLength + 15;
  await page.waitForFunction(({targetS, activeRange}) => {
    const snapshot = window.__racing.snapshot();
    return snapshot.running && snapshot.auto && snapshot.playerS >= targetS &&
      JSON.stringify(snapshot.terrain.activeRange) !== JSON.stringify(activeRange);
  }, {targetS, activeRange: before.terrain.activeRange}, {timeout: 30000});
  const after = (await inspect(page)).snapshot;
  const summarize = snapshot => ({playerS: snapshot.playerS, running: snapshot.running, auto: snapshot.auto,
    renderedFrames: snapshot.render.renderedFrames, terrain: snapshot.terrain});
  result.automaticDrive = {boundary, targetS, before: summarize(before), after: summarize(after)};
  assert.equal(after.roundWasDemo, true);
  assert(after.playerS > boundary + chunkLength);
  assert(after.terrain.updates > before.terrain.updates);
  assert(after.render.renderedFrames > before.render.renderedFrames);
  assert(after.terrain.submittedTriangles > 0);
  assert(after.terrain.submittedTriangles <= after.terrain.activeTriangles);
  assert.deepEqual(geometrySignature(after), geometrySignature(before));
  assert.equal(after.startup.terrainSource, 'worker');
  await page.locator('#pause').click();
}

async function exercisePendingSelections(page, result) {
  await page.waitForFunction(() => window.__terrainSmoke?.queued > 0 && window.__racing?.snapshot().startup.phase === 'terrain', null, {timeout: 12000});
  result.beforeSelections = await inspect(page);
  assertPending(result.beforeSelections);
  // Course cards remain accessible below the loading overlay. The overlay covers
  // the driver/quality controls, so exercise their real keyboard/change handlers.
  await page.locator('#collection-words').click();
  const nextCourse = page.locator('#stage-grid .stage-card').nth(1);
  result.selectedStage = await nextCourse.getAttribute('data-stage');
  await nextCourse.click();
  await page.locator('#quality').selectOption('low');
  await page.locator('#driver-kkamong').focus();
  await page.keyboard.press('Enter');
  // Disabled buttons normally suppress click. Dispatching directly additionally
  // proves that the start/watch/garage function guards refuse an incomplete world.
  for (const selector of ['#start', '#watch', '#card-play', '#nav-garage']) {
    await page.locator(selector).dispatchEvent('click');
  }
  result.duringSelections = await inspect(page);
  assertPending(result.duringSelections);
  assert.equal(result.duringSelections.snapshot.stage.id, result.selectedStage);
  assert.equal(result.duringSelections.snapshot.driver.name, 'kkamong');
  assert.equal(result.duringSelections.snapshot.quality, 'low');
  assert.equal(result.duringSelections.worker.terminateCalls, 0);
  await page.evaluate(() => window.__terrainRelease(false));
}

function assertPending(state) {
  assert.equal(state.snapshot.ready, false);
  assert.equal(state.snapshot.running, false);
  assert.equal(state.snapshot.collection.garageOpen, false);
  assert.equal(state.controls.startDisabled, true);
  assert.equal(state.controls.watchDisabled, true);
  assert.equal(state.controls.loadingHidden, false);
}

function assertFailed(state) {
  assert.equal(state.snapshot.startup.phase, 'failed');
  assert.equal(state.snapshot.ready, false);
  assert.equal(state.snapshot.running, false);
  assert.equal(state.controls.startDisabled, true);
  assert.equal(state.controls.watchDisabled, true);
  assert.equal(state.controls.errorHidden, false);
  assert.equal(state.controls.loadingHidden, true);
  assert(state.racingError);
  assert.equal(state.snapshot.startup.readyMs, undefined);
  assert.equal(state.snapshot.terrain, undefined);
}

function assertReady(state) {
  const {snapshot} = state, {startup} = snapshot;
  assert.equal(snapshot.ready, true);
  assert.equal(startup.phase, 'ready');
  assert.equal(snapshot.running, false);
  assert.equal(state.racingError, null);
  assert.equal(state.controls.loadingHidden, true);
  assert.equal(state.controls.errorHidden, true);
  assert.equal(state.controls.watchDisabled, false);
  assert.equal(state.controls.startDisabled, false);
  assert(startup.compilePasses >= 1);
  assert(Number.isFinite(startup.shadersMs));
  assert(Number.isFinite(startup.firstFrameMs));
  assert(startup.shadersMs <= startup.firstFrameMs);
  assert(startup.firstFrameMs <= startup.readyMs);
  assert(snapshot.render.renderedFrames >= 1);
  assert(snapshot.render.programs > 0);
  assert(snapshot.terrain.storedTriangles > 0);
  assert(snapshot.landscape.triangles > 0);
}

function geometrySignature(snapshot) {
  const terrain = snapshot.terrain;
  return {terrain: Object.fromEntries(['chunkCount', 'chunkLength', 'sourceTriangles', 'storedTriangles', 'storedVertices'].map(key => [key, terrain[key]])), landscape: snapshot.landscape};
}

function inspect(page) {
  return page.evaluate(() => ({snapshot: window.__racing?.snapshot(), racingError: window.__racingError || null,
    worker: {...window.__terrainSmoke}, controls: {
      startDisabled: document.querySelector('#start')?.disabled,
      watchDisabled: document.querySelector('#watch')?.disabled,
      loadingHidden: document.querySelector('#loading')?.hidden,
      errorHidden: document.querySelector('#error')?.hidden,
    }}));
}

function instrumentTerrainWorker(mode) {
  const NativeWorker = window.Worker;
  const state = window.__terrainSmoke = {mode, attempts: 0, created: 0, otherWorkers: 0,
    terminateCalls: 0, nativeMessages: 0, delivered: 0, lateDelivered: 0, queued: 0, errors: 0};
  const queued = [];
  window.__terrainRelease = late => {
    for (const item of queued.splice(0)) {
      const handler = late ? item.handler : item.facade.onmessage;
      if (handler) {state.delivered++; if (late) state.lateDelivered++; handler(item.event);}
    }
    state.queued = queued.length;
  };
  window.Worker = class extends NativeWorker {
    constructor(url, options) {
      const isTerrain = new URL(String(url), location.href).pathname.endsWith('/terrain-worker.js');
      if (!isTerrain) {state.otherWorkers++; return new NativeWorker(url, options);}
      state.attempts++;
      if (mode === 'constructor-error') throw new Error('QA: terrain Worker constructor blocked');
      const native = new NativeWorker(url, options);
      state.created++;
      const facade = {onmessage: null, onerror: null, onmessageerror: null,
        postMessage: (...args) => native.postMessage(...args),
        terminate: () => {state.terminateCalls++; native.terminate();}};
      native.addEventListener('message', event => {
        state.nativeMessages++;
        if (mode === 'delayed-result' || mode === 'asset-error') {
          queued.push({event, handler: facade.onmessage, facade}); state.queued = queued.length;
        } else if (facade.onmessage) {state.delivered++; facade.onmessage(event);}
      });
      native.addEventListener('error', event => {state.errors++; facade.onerror?.(event);});
      native.addEventListener('messageerror', event => facade.onmessageerror?.(event));
      return facade;
    }
  };
}
