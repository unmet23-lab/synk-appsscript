'use strict';
// Isolated browser QA. The flow fixture is a short silent WAV, NOT production speech.
// It verifies delivery states/flow; it cannot verify Korean pronunciation or human enjoyment.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const base = process.env.RUSH_URL || 'http://127.0.0.1:4317/';
const realVoice = process.env.REAL_VOICE === '1';
const out = path.join(__dirname, realVoice ? 'beginner-real' : 'beginner'); fs.mkdirSync(out, { recursive: true });
const key = 'synk.order-rush.beginner.v1';
const wav = Buffer.alloc(44 + 2205 * 2); wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(22050, 24); wav.writeUInt32LE(44100, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const report = { base, at: new Date().toISOString(), speech: realVoice ? 'ACTUAL_TYPECAST_FILES_BROWSER_ENDED_VERIFIED_NOT_HUMAN_LISTENED' : 'SILENT_TEST_FIXTURE_ONLY', checks: [], errors: [] };
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }); const page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(new URL('beginner.html', base).href); await page.locator('h1').waitFor();
  await page.screenshot({ path: path.join(out, 'home-desktop.png'), fullPage: true });
  const actualManifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/beginner/voices.json')));
  await page.route('**/assets/beginner/voices.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...actualManifest, approved: false }) }));
  await page.locator('[data-action=start]').click(); await page.locator('.b-error').waitFor(); assert.equal(await page.locator('[data-item]').count(), 0); report.checks.push('unapproved audio blocks start');
  await page.unroute('**/assets/beginner/voices.json');
  if (!realVoice) {
    await page.route('**/assets/beginner/voices.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...actualManifest, approved: true }) }));
    await page.route('**/assets/beginner/audio/*', route => route.fulfill({ contentType: 'audio/wav', body: wav }));
  }
  await page.locator('[data-action=start]').click(); await page.waitForFunction(() => !!document.querySelector('[data-item]:not(:disabled)'));
  await page.screenshot({ path: path.join(out, 'demo-desktop.png'), fullPage: true });
  const core = await import('../beginner-core.mjs');
  async function checkpoint() { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), key); }
  let tests = { wrong: false, help: false, replay: false, resumed: false }, visited = 0;
  while (await page.locator('[data-action=serve]').count()) {
    await page.waitForFunction(() => !!document.querySelector('[data-item]:not(:disabled)'));
    const p = await checkpoint(), c = p.checkpoint;
    const line = c.phase === 'demo' ? core.STAGES[c.stage].demos[c.index] : null;
    const order = line ? { item: line.startsWith('count-') ? 'bread' : line.split('-')[0], count: /-[123]$/.test(line) ? Number(line.at(-1)) : 1 } : core.stageOrders(c.stage, p.seed + c.stage)[c.index];
    if (c.phase === 'order' && !tests.wrong) {
      const other = order.item === 'water' ? 'bread' : 'water'; await page.locator(`[data-item=${other}]`).click(); await page.locator('[data-action=serve]').click();
      assert.equal(await page.locator('.b-hint').count(), 1); tests.wrong = true;
      // Save/reload after a mistake: first failure survives and is never promoted.
      await page.reload(); await page.locator('[data-action=start]').click(); await page.waitForFunction(() => !!document.querySelector('[data-item]:not(:disabled)'));
      const resumed = await checkpoint(); assert.equal(resumed.checkpoint.firstCorrect, false); tests.resumed = true;
    } else if (c.phase === 'order' && !tests.help) { await page.locator('[data-action=hint]').click(); tests.help = true; }
    else if (c.phase === 'order' && !tests.replay) { await page.locator('[data-action=listen]').click(); await page.waitForFunction(() => !!document.querySelector('[data-item]:not(:disabled)')); tests.replay = true; }
    for (let n = 0; n < order.count; n++) await page.locator(`[data-item=${order.item}]`).click();
    await page.locator('[data-action=serve]').click(); await page.locator('[data-action=next]').waitFor();
    if (c.stage === 2 && c.phase === 'order' && c.index === 0) {
      await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: path.join(out, 'quantity-mobile.png'), fullPage: true }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.setViewportSize({ width: 320, height: 720 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); await page.screenshot({ path: path.join(out, 'quantity-320.png'), fullPage: true });
      await page.setViewportSize({ width: 1280, height: 900 });
    }
    await page.locator('[data-action=next]').click(); visited++;
    if (await page.locator('[data-action=continue]').count()) await page.locator('[data-action=continue]').click();
  }
  const final = await checkpoint(); assert.equal(final.finished, true); assert.equal(final.records.length, 27); assert.equal(final.records[0].firstCorrect, false); assert.equal(final.records[0].independent, false); assert.equal(final.records[0].resumed, true);
  await page.waitForFunction(() => (document.querySelector('#b-coins')?.textContent || '').length > 0);
  const firstCoins = await page.evaluate(async () => (await SynkPlayCollection.load()).coins); assert.equal(firstCoins, 24);
  await page.locator('[data-action=home]').click(); await page.locator('[data-action=results]').click(); await page.waitForFunction(() => (document.querySelector('#b-coins')?.textContent || '').length > 0);
  assert.equal(await page.evaluate(async () => (await SynkPlayCollection.load()).coins), firstCoins); report.checks.push('full-story reward is issued exactly once across result revisits');
  report.gameRecords = final.records;
  report.atlas = await page.evaluate(() => { const s = globalThis.SynkLearning.createGame({ gameId: 'order-rush', storage: localStorage }).summary(); return { counts: s.counts, storage: s.storage, skills: s.skills.filter(v => v.n || v.assisted || v.unassessed).map(v => ({ id: v.id, responseFormat: v.responseFormat, n: v.n, correct: v.correct, incorrect: v.incorrect, cupComposition: v.formats['cup-compose'].n })) }; });
  assert.ok(report.atlas.skills.every(s => s.responseFormat === 'action' && s.cupComposition === 0));
  assert.equal(final.records.filter(r => r.independent).length, 24); assert.equal(visited, 37); report.checks.push('all 10 demos and 27 orders finish', 'mistake/help/replay remain separated', 'resume after error retains first wrong', '390 and 320 no horizontal overflow');
  await page.screenshot({ path: path.join(out, 'results-desktop.png'), fullPage: true });
  await page.locator('[data-action=rush]').click(); await page.waitForFunction(() => !!document.querySelector('[data-item]:not(:disabled)'));
  await page.locator('#menu-button').click(); const before = await page.locator('#b-time').textContent(); await page.waitForTimeout(1200); assert.equal(await page.locator('#b-time').textContent(), before); await page.locator('#b-resume').click(); report.checks.push('rush pause freezes clock');
  await page.locator('#menu-button').click(); await page.locator('#b-home').click(); await page.locator('[data-action=visit]').click(); await page.waitForFunction(() => !!document.querySelector('[data-item]:not(:disabled)')); assert.equal(await page.locator('#b-time').count(), 0); report.checks.push('free repeat remains untimed');
  await page.goto(base); await page.locator('.beginner-entry a').waitFor(); assert.equal(await page.locator('[data-mode]').count(), 2); report.checks.push('original modes preserved and beginner entry visible');
  assert.deepEqual(report.errors, []); fs.writeFileSync(path.join(out, 'browser-results.json'), JSON.stringify(report, null, 2)); await browser.close(); console.log(JSON.stringify({ ...report, gameRecords: `${report.gameRecords.length} saved in report`, atlas: report.atlas.counts }, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
