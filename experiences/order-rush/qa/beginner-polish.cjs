'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const base = process.env.RUSH_URL || 'http://127.0.0.1:4340/order-rush/', out = path.join(__dirname, 'beginner-polish'); fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true }); // Default autoplay policy, no bypass flags.
  const context = await browser.newContext({ viewport: { width: 320, height: 720 }, reducedMotion: 'reduce' }); const page = await context.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { window.__audioEvents = []; const nativePlay = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function (...args) { if (!this.dataset.qaTracked) { this.dataset.qaTracked = '1'; this.addEventListener('playing', () => window.__audioEvents.push({ event: 'playing', at: performance.now() })); this.addEventListener('ended', () => window.__audioEvents.push({ event: 'ended', at: performance.now() })); this.addEventListener('pause', () => window.__audioEvents.push({ event: 'pause', at: performance.now() })); } return nativePlay.apply(this, args); }; });
  await page.goto(new URL('beginner.html', base).href); await page.locator('[data-action=start]').click(); await page.waitForFunction(() => !!document.querySelector('[data-item]:not(:disabled)'));
  const report = { base, at: new Date().toISOString(), browser: 'Chrome default autoplay policy', checks: [], errors };
  async function loadFixture(id, state) { await page.addInitScript(({ id, state }) => { if (sessionStorage.getItem(id)) return; localStorage.setItem('synk.order-rush.beginner.v1', JSON.stringify(state)); sessionStorage.setItem(id, '1'); }, { id, state }); await page.reload(); }
  assert.ok((await page.evaluate(() => __audioEvents)).some(e => e.event === 'ended')); report.checks.push('first user click plays and completes real Korean audio without autoplay overrides');
  await page.locator('[data-item=water]').click(); await page.locator('[data-action=serve]').click(); await page.locator('[data-action=next]').click();
  report.afterNextScroll = await page.evaluate(() => scrollY);
  await page.waitForFunction(() => !!document.querySelector('[data-item]:not(:disabled)')); await page.screenshot({ path: path.join(out, 'demo-320.png'), fullPage: true });
  if (process.env.AUDIT_ONLY === '1') { fs.writeFileSync(path.join(out, 'before.json'), JSON.stringify(report, null, 2)); await browser.close(); console.log(JSON.stringify(report, null, 2)); return; }
  assert.ok(report.afterNextScroll < 80); report.checks.push('next scene returns to the customer instead of leaving a phone scrolled below the order');
  // Resume the same partially filled quantity tray, including picture help.
  await loadFixture('qa.quantity', { version: 1, seed: 42, stage: 2, completed: [0, 1], records: [], checkpoint: { phase: 'order', stage: 2, index: 0 } });
  await page.locator('[data-action=start]').click(); await page.waitForFunction(() => !!document.querySelector('[data-item]:not(:disabled)'));
  await page.locator('[data-item=bread]').click(); await page.locator('[data-item=bread]').click(); await page.locator('[data-action=hint]').click();
  assert.equal(await page.locator('[data-action=hint]').evaluate(n => n === document.activeElement), true);
  await page.locator('#menu-button').click(); await page.locator('#b-home').click(); await page.locator('[data-action=start]').click(); await page.waitForFunction(() => !!document.querySelector('[data-item]:not(:disabled)'));
  assert.equal(await page.locator('[data-remove]').count(), 2); assert.equal(await page.locator('.b-hint').count(), 1);
  await page.locator('[data-action=undo]').click(); await page.reload(); await page.locator('[data-action=start]').click(); await page.waitForFunction(() => !!document.querySelector('[data-item]:not(:disabled)')); assert.equal(await page.locator('[data-remove]').count(), 1);
  report.checks.push('pause/home/reload preserves the partial tray, help and subsequent removals');
  await page.locator('[data-action=undo]').click(); assert.equal(await page.evaluate(() => !!document.activeElement?.matches('[data-item]')), true);
  await page.keyboard.press('Digit1'); await page.keyboard.press('KeyG'); assert.ok(await page.locator('[data-action=next], .b-hint').count()); report.checks.push('removing the last item keeps keyboard focus; G serves without conflicting with native Space');
  // Pause actually stops a replay already in progress, then resume keeps the tray.
  await loadFixture('qa.replay', { version: 1, seed: 42, stage: 2, completed: [0, 1], records: [], checkpoint: { phase: 'order', stage: 2, index: 2 } });
  await page.locator('[data-action=start]').click(); await page.waitForFunction(() => !!document.querySelector('[data-item]:not(:disabled)'));
  const countsBefore = await page.evaluate(() => SynkLearning.createGame({ gameId: 'order-rush', storage: localStorage }).summary().counts);
  await page.locator('[data-action=listen]').click(); await page.locator('#menu-button').click(); const pausedEvents = await page.evaluate(() => __audioEvents.filter(e => e.event !== 'pause').length); await page.waitForTimeout(1600); assert.equal(await page.evaluate(() => __audioEvents.filter(e => e.event !== 'pause').length), pausedEvents); await page.locator('#b-resume').click();
  const core = await import('../beginner-core.mjs'), order = core.stageOrders(2, 44)[2]; for (let i = 0; i < order.count; i++) await page.locator(`[data-item=${order.item}]`).click(); await page.locator('[data-action=serve]').click(); await page.locator('[data-action=next]').waitFor();
  const countsAfter = await page.evaluate(() => SynkLearning.createGame({ gameId: 'order-rush', storage: localStorage }).summary().counts); assert.equal(countsAfter.attempts, countsBefore.attempts + 1); assert.equal(countsAfter.unassessed, countsBefore.unassessed);
  report.checks.push('pause stops replay, preserves the earlier completed listen and records the resumed answer as assisted rather than audio-failed');
  await loadFixture('qa.correction', { version: 1, seed: 42, stage: 2, completed: [0, 1], records: [], checkpoint: { phase: 'order', stage: 2, index: 0 } });
  await page.locator('[data-action=start]').click(); await page.waitForFunction(() => !!document.querySelector('[data-item]:not(:disabled)'));
  const correctionOrder = core.stageOrders(2, 44)[0], wrongItem = correctionOrder.item === 'bread' ? 'apple' : 'bread';
  await page.locator(`[data-item=${wrongItem}]`).click(); await page.keyboard.press('KeyG');
  assert.match(await page.locator('.b-feedback .b-en').textContent(), /Remove the wrong items/); assert.equal(await page.locator('[data-action=hint]').evaluate(n => n === document.activeElement), true);
  await page.keyboard.press('Backspace');
  for (let i = 0; i < (correctionOrder.count === 1 ? 2 : 1); i++) await page.locator(`[data-item=${correctionOrder.item}]`).click();
  await page.keyboard.press('KeyG'); assert.match(await page.locator('.b-feedback .b-en').textContent(), /Match the number/);
  while (await page.locator('[data-remove]').count()) await page.keyboard.press('Backspace');
  for (let i = 0; i < 4; i++) await page.locator(`[data-item=${correctionOrder.item}]`).click();
  assert.equal(await page.locator('[data-remove]').count(), 3); assert.match(await page.locator('.b-feedback .b-en').textContent(), /tray holds three items/); assert.equal(await page.locator('[data-action=undo]').evaluate(n => n === document.activeElement), true);
  await page.screenshot({ path: path.join(out, 'correction-320.png'), fullPage: true });
  await page.keyboard.press('Backspace'); assert.doesNotMatch(await page.locator('.b-feedback').textContent(), /tray holds three items/);
  report.checks.push('wrong item, wrong quantity and full tray have distinct English feedback; correction and full tray keep a useful keyboard focus');
  await page.route('**/assets/beginner/audio/water.mp3', r => r.fulfill({ contentType: 'audio/mpeg', body: Buffer.alloc(200, 65) }));
  await loadFixture('qa.bad-audio-focus', { version: 1, seed: 42, stage: 0, completed: [], records: [], checkpoint: null });
  await page.locator('[data-action=start]').focus(); await page.keyboard.press('Enter'); await page.locator('.b-bubble .b-error').waitFor();
  assert.equal(await page.locator('[data-action=listen]').evaluate(n => n === document.activeElement), true); assert.equal(await page.locator('[data-item]:not(:disabled)').count(), 0);
  await page.unroute('**/assets/beginner/audio/water.mp3'); await page.keyboard.press('Enter'); await page.waitForFunction(() => !!document.querySelector('[data-item]:not(:disabled)'));
  assert.equal(await page.locator('[data-item]').first().evaluate(n => n === document.activeElement), true);
  report.checks.push('failed audio focuses the retry control and keyboard Enter reloads the real voice, then returns focus to the items');
  const completeRecords = JSON.parse(fs.readFileSync(path.join(__dirname, 'beginner-real/browser-results.json'))).gameRecords;
  await loadFixture('qa.complete', { version: 1, seed: 99, stage: 3, completed: [0, 1, 2, 3], records: completeRecords, checkpoint: null, roundId: 'order-rush:polish', finished: true });
  await page.locator('[data-action=results]').click(); await page.locator('a[href="/learning-hub/#beginner-title"]').waitFor(); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(out, 'result-320.png'), fullPage: true });
  await page.locator('[data-rehear=water]').click(); await page.locator('[data-action=home]').click(); const homeEvents = await page.evaluate(() => __audioEvents.filter(e => e.event !== 'pause').length); await page.waitForTimeout(1300); assert.equal(await page.evaluate(() => __audioEvents.filter(e => e.event !== 'pause').length), homeEvents);
  await page.locator('a[href="/learning-hub/#beginner-title"]').click(); await page.waitForURL('**/learning-hub/#beginner-title'); assert.equal((await page.request.get(page.url())).status(), 200); report.checks.push('results name the two replay choices and link to other beginner games; leaving stops word audio');
  assert.deepEqual(errors, []); fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2)); await browser.close(); console.log(JSON.stringify(report, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
