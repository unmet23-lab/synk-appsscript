'use strict';
// Atlas timing windows in the real rhythm game. Isolated headless browser; no user profile.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const base = process.env.SYNK_QA_BASE || 'http://127.0.0.1:4291';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const result = { origin: base, at: new Date().toISOString() }, errors = [];
  try {
    const run = async auto => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: 'reduce' });
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${base}/korean-rhythm/`); await page.locator('#start-button').waitFor();
      if (!auto) { await page.locator('#settings-button').click(); await page.locator('#timing-setting').uncheck(); await page.locator('#settings-dialog [data-close]').last().click(); }
      await page.locator('#start-button').click();
      await page.waitForFunction(() => window.synkRhythm.snapshot().screen === 'game' && window.synkRhythm.snapshot().time > 0, null, { timeout: 60000 });
      // Nobody taps: every passing note is missed.
      await page.waitForFunction(() => (window.synkRhythm.snapshot().notes || []).filter(n => n.state === 'missed').length >= 10, null, { timeout: 90000 });
      const snap = await page.evaluate(() => window.synkRhythm.snapshot());
      if (auto) await page.screenshot({ path: path.join(__dirname, 'flow-timing-game.png') });
      await context.close();
      return { timing: snap.timing, missed: snap.notes.filter(n => n.state === 'missed').length };
    };
    result.auto = await run(true);
    result.fixed = await run(false);
    assert.ok(result.auto.timing > 1, 'missed beats made the windows more forgiving');
    assert.equal(result.fixed.timing, 1, 'switched off: the level keeps its own windows');
    assert.deepEqual(errors, []);
    result.status = 'passed';
  } catch (error) { result.status = 'failed'; result.error = error.message; process.exitCode = 1; }
  finally { result.pageErrors = errors; fs.writeFileSync(path.join(__dirname, 'atlas-timing-smoke.json'), JSON.stringify(result, null, 2) + '\n'); await browser.close(); console.log(JSON.stringify(result)); }
})();
