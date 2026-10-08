// Free Chromium + real IndexedDB checks. All state is synthetic in a fresh browser context.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from '../experiences/learning-hub/server.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const phase = process.argv.includes('--clone-before') ? 'clone-before' : process.argv.includes('--before') ? 'before' : 'after';
const output = fileURLToPath(new URL('../experiences/atlas-lab/qa/memory-recovery/', import.meta.url));
const report = { at: new Date().toISOString(), phase, status: 'running', modelCalls: 0, actualUsers: 0, externalRequests: [], errors: [], checks: [] };
let server, browser, origin, activePage;
async function raw(page, value, write = false) {
  return page.evaluate(({ value, write }) => new Promise((resolve, reject) => {
    const request = indexedDB.open('synk-atlas-fictional-journey-v1', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('snapshot', write ? 'readwrite' : 'readonly'), store = tx.objectStore('snapshot'); let result;
      tx.oncomplete = () => { db.close(); resolve(result); }; tx.onerror = () => { db.close(); reject(tx.error); };
      if (write) { store.put(value, 'current'); result = value; } else { const get = store.get('current'); get.onsuccess = () => { result = get.result; }; }
    };
  }), { value, write });
}
async function load(page) {
  await page.goto(origin + '/atlas-lab/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.synkAtlasLab?.memory);
  await page.locator('.journey-memory:has(#journey-memory) > summary').click();
}
async function memoryClick(page, action) {
  await page.locator(`[data-memory-action="${action}"]`).evaluate(async button => { await button.onclick(); });
}
async function context() {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 850 }, serviceWorkers: 'block' });
  await ctx.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) { report.externalRequests.push(url.href); return route.abort(); }
    if (url.pathname === '/api/computer-interpretation') return route.fulfill({ json: { available: false, reason: 'paid-work-deferred' } });
    if (url.pathname === '/api/me') return route.fulfill({ json: { user: null } });
    return route.continue();
  });
  ctx.on('page', page => { page.setDefaultTimeout(10000); page.on('pageerror', error => report.errors.push(error.message)); });
  return ctx;
}
async function runCase(label, corrupt) {
  const ctx = await context();
  const page = await ctx.newPage(); activePage = page; await load(page);
  await page.locator('.discovery-reset > summary').click(); await page.locator('[data-discovery-scenario="ready"]').click();
  await page.locator('[data-discovery-select="candidate-1"]').click(); await memoryClick(page, 'enable');
  assert.equal(await page.evaluate(() => window.synkAtlasLab.memory().enabled), true);
  const saved = await raw(page), stale = await ctx.newPage(); await load(stale); await memoryClick(stale, 'resume');
  assert.equal(await stale.evaluate(() => window.synkAtlasLab.memory().enabled), true);
  const broken = corrupt(saved); await raw(page, broken, true);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.journey-memory:has(#journey-memory) > summary').click();
  assert.equal(await page.evaluate(() => window.synkAtlasLab.memory().enabled), false);
  assert.deepEqual(await raw(page), broken, 'loading invalid data must not automatically erase or repair it');
  await memoryClick(page, 'forget');
  const deleted = await raw(page);
  report.checks.push({ label, stage: 'explicit-delete', storedVersion: deleted?.version, enabled: deleted?.enabled,
    retainedValue: deleted?.value !== null, notice: await page.locator('#journey-memory-status').innerText() });
  assert.equal(deleted.enabled, false, `${label}: explicit deletion must work despite an unreadable envelope`);
  assert.equal(deleted.value, null); assert.equal(deleted.version, 2); assert.match(deleted.epoch, /^[a-f0-9-]{36}$/);
  assert.equal(await page.evaluate(() => window.synkAtlasLab.memory().enabled), false);
  await stale.locator('[data-discovery-action="unselect"]').click();
  await stale.waitForFunction(() => !window.synkAtlasLab.memory().enabled);
  assert.match(await stale.locator('#journey-memory-status').innerText(), /다른 탭/);
  assert.deepEqual(await raw(page), deleted, 'the old live tab cannot resurrect its saved answers');
  await memoryClick(page, 'enable'); const reenabled = await raw(page);
  assert.equal(reenabled.enabled, true); assert.equal(reenabled.epoch, deleted.epoch);
  assert.equal(await page.evaluate(() => window.synkAtlasLab.memory().enabled), true);
  const results = await page.evaluate(async ({ saved, reenabled }) => {
    const memory = (await import('/atlas-lab/journey-memory.mjs')).createJourneyMemory();
    const attempt = async fn => { try { await fn(); return 'accepted'; } catch (error) { return error.message; } };
    return {
      oldSave: await attempt(() => memory.save({ ...saved, value: saved.value })),
      oldForget: await attempt(() => memory.forget(saved)),
      epochOnly: await attempt(() => memory.save({ ...reenabled, epoch: saved.epoch, value: saved.value, enable: true }))
    };
  }, { saved, reenabled });
  assert.deepEqual(results, { oldSave: 'storage-conflict', oldForget: 'storage-conflict', epochOnly: 'storage-conflict' });
  assert.deepEqual(await raw(page), reenabled);
  await page.locator('#journey-memory').screenshot({ path: path.join(output, `${phase}-${label}.png`) });
  report.checks.push({ label, stage: 'recovery-complete', noAutomaticConsent: true, oldTabRejected: true, reenabledExplicitly: true, staleSaveAndForgetRejected: true });
  await ctx.close(); activePage = null;
}
async function legacyAndNormalDelete() {
  const ctx = await context(), page = await ctx.newPage(); activePage = page; await load(page); await memoryClick(page, 'enable');
  const saved = await raw(page), legacy = { ...saved, version: 1 }; delete legacy.epoch; await raw(page, legacy, true);
  const result = await page.evaluate(async () => {
    const memory = (await import('/atlas-lab/journey-memory.mjs')).createJourneyMemory(), prior = await memory.read();
    const upgraded = await memory.save({ ...prior, value: prior.value });
    let staleResult; try { await memory.forget(prior); staleResult = 'accepted'; } catch (error) { staleResult = error.message; }
    const preserved = await memory.read(), deleted = await memory.forget(upgraded);
    let oldSave; try { await memory.save({ ...upgraded, value: upgraded.value, enable: true }); oldSave = 'accepted'; } catch (error) { oldSave = error.message; }
    return { prior, upgraded, staleResult, preserved, deleted, oldSave };
  });
  assert.equal(result.prior.version, 1); assert.equal(result.upgraded.version, 2); assert.deepEqual(result.upgraded.value, legacy.value);
  assert.equal(result.staleResult, 'storage-conflict'); assert.deepEqual(result.preserved, result.upgraded);
  assert.equal(result.deleted.value, null); assert.equal(result.deleted.enabled, false); assert.equal(result.deleted.generation, result.upgraded.generation + 1);
  assert.notEqual(result.deleted.epoch, result.upgraded.epoch); assert.equal(result.oldSave, 'storage-conflict');
  report.checks.push({ label: 'valid-v1-and-normal-forget', version1Readable: true, version2WrittenOnExplicitSave: true, staleForgetRejected: true,
    validForgetAccepted: true, oldSaveRejectedAfterForget: true });
  await ctx.close(); activePage = null;
}
async function unreadablePayload() {
  const ctx = await context(), page = await ctx.newPage(); activePage = page; await load(page); await memoryClick(page, 'enable');
  await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('synk-atlas-fictional-journey-v1', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('snapshot', 'readwrite'), store = tx.objectStore('snapshot'), get = store.get('current');
      get.onsuccess = () => { const row = get.result; row.value.bigNumber = 1n; row.value.discovery.cycle = row.value.discovery; store.put(row, 'current'); };
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }));
  await page.reload({ waitUntil: 'networkidle' }); await page.locator('.journey-memory:has(#journey-memory) > summary').click();
  const outcome = await page.locator('[data-memory-action="forget"]').evaluate(button => Promise.race([
    Promise.resolve(button.onclick()).then(() => 'completed'), new Promise(resolve => setTimeout(() => resolve('queue-stuck'), 1000))
  ]));
  report.checks.push({ label: 'non-json-indexeddb-payload', outcome, notice: await page.locator('#journey-memory-status').innerText() });
  assert.equal(outcome, 'completed', 'a clone failure must reject the read so the explicit deletion queue remains usable');
  const deleted = await raw(page); assert.equal(deleted.enabled, false); assert.equal(deleted.value, null);
  await memoryClick(page, 'enable'); assert.equal((await raw(page)).enabled, true);
  await ctx.close(); activePage = null;
}
try {
  await fs.mkdir(output, { recursive: true }); server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`; browser = await chromium.launch({ channel: 'chrome', headless: true });
  if (phase === 'clone-before') await unreadablePayload();
  else {
    await runCase('old-version', row => ({ ...row, version: 0 }));
    await runCase('malformed-counters', row => ({ ...row, revision: 'unreadable', generation: -5 }));
    await legacyAndNormalDelete(); await unreadablePayload();
  }
  assert.deepEqual(report.externalRequests, []); assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack; process.exitCode = 1;
  if (activePage) await activePage.locator('#journey-memory').screenshot({ path: path.join(output, `${phase}-failure.png`) }).catch(() => {});
} finally {
  await browser?.close(); if (server?.listening) await new Promise(resolve => server.close(resolve));
  await fs.writeFile(path.join(output, `result-${phase}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, phase, checks: report.checks.length, failure: report.failure, output }));
}
