'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const base = process.env.RUSH_URL || 'http://127.0.0.1:4317/', key = 'synk.order-rush.beginner.v1';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const result = { at: new Date().toISOString(), base, checks: [], errors: [] };
  async function open() { const c = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }); const p = await c.newPage(); p.on('pageerror', e => result.errors.push(e.message)); await p.goto(new URL('beginner.html', base).href); return { c, p }; }
  const failure = await open();
  await failure.p.route('**/assets/beginner/audio/water.mp3', r => r.fulfill({ status: 503, body: 'Not ready' }));
  await failure.p.locator('[data-action=start]').click(); await failure.p.locator('.b-error').waitFor(); assert.equal(await failure.p.locator('[data-item]').count(), 0);
  await failure.p.unroute('**/assets/beginner/audio/water.mp3'); await failure.p.locator('[data-action=start]').click(); await failure.p.waitForFunction(() => !!document.querySelector('[data-item]:not(:disabled)')); result.checks.push('missing audio blocks all play and retry loads actual files'); await failure.c.close();
  const decode = await open();
  await decode.p.route('**/assets/beginner/audio/water.mp3', r => r.fulfill({ contentType: 'audio/mpeg', body: Buffer.alloc(200, 65) }));
  await decode.p.locator('[data-action=start]').click(); await decode.p.locator('.b-bubble .b-error').waitFor(); assert.equal(await decode.p.locator('[data-item]:not(:disabled)').count(), 0); assert.equal(await decode.p.locator('[data-action=serve]').isDisabled(), true);
  await decode.p.unroute('**/assets/beginner/audio/water.mp3'); await decode.p.locator('[data-action=listen]').click(); await decode.p.waitForFunction(() => !!document.querySelector('[data-item]:not(:disabled)'));
  result.checks.push('undecodable audio blocks submit and retry refetches healthy audio');
  await decode.p.keyboard.press('Digit1'); assert.equal(await decode.p.locator('[data-remove]').count(), 1); await decode.p.locator('#beginner').focus(); await decode.p.keyboard.press('Space'); await decode.p.locator('[data-action=next]').waitFor(); await decode.p.keyboard.press('Escape'); assert.equal(await decode.p.locator('#b-pause').evaluate(n => n.open), true); await decode.p.keyboard.press('Escape'); assert.equal(await decode.p.locator('#b-pause').evaluate(n => n.open), false); result.checks.push('number key adds, Space gives, Escape pauses and resumes');
  assert.equal(await decode.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); await decode.p.screenshot({ path: path.join(__dirname, 'beginner-real', 'demo-mobile.png'), fullPage: true }); await decode.c.close();
  const rush = await open();
  await rush.p.evaluate(key => localStorage.setItem(key, JSON.stringify({ version: 1, seed: 411, stage: 3, completed: [0, 1, 2, 3], records: [], checkpoint: null, finished: true })), key); await rush.p.reload(); await rush.p.locator('[data-action=rush]').click(); await rush.p.waitForFunction(() => !!document.querySelector('[data-item]:not(:disabled)'));
  // Keep the real browser clock and wait for the optional rush's actual 60-second finish.
  await rush.p.locator('h1').filter({ hasText: '바쁜 영업도 마쳤어요!' }).waitFor({ timeout: 70000 });
  assert.equal(await rush.p.locator('.b-stat b').first().textContent(), '0');
  const s = await rush.p.evaluate(() => SynkLearning.createGame({ gameId: 'order-rush', storage: localStorage }).summary().counts); assert.equal(s.independent?.incorrect || 0, 0); assert.equal(s.attempts, 1); assert.equal(s.unassessed + s.skipped, 1);
  result.checks.push('real 60-second clock ends the rush; unserved request is not a language error'); await rush.c.close();
  assert.deepEqual(result.errors, []); fs.writeFileSync(path.join(__dirname, 'beginner-real', 'edge-results.json'), JSON.stringify(result, null, 2)); await browser.close(); console.log(JSON.stringify(result, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
