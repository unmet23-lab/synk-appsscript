'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const url = new URL('beginner.html', process.env.RUSH_URL || 'http://127.0.0.1:4340/order-rush/').href, out = path.join(__dirname, 'beginner-picnic-replay');
const mainKey = 'synk.order-rush.beginner.v1', visitsKey = 'synk.order-rush.picnic.v1', picnicId = 'order-playset-picnic'; fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true }), context = await browser.newContext({ viewport: { width: 390, height: 800 }, reducedMotion: 'reduce' }), page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { window.__plays = 0; window.__ends = 0; const original = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function(...args) { __plays++; if (!this.dataset.qa) { this.dataset.qa = '1'; this.addEventListener('ended', () => __ends++); } return original.apply(this, args); }; });
  const report = { at: new Date().toISOString(), url, evidence: 'Isolated Chrome context; default autoplay; real approved audio; no new provider calls', checks: [], visits: [], errors };
  const fixture = { version: 1, seed: 73, completed: [0, 1, 2], records: [], roundId: 'order-rush:replay-preserve', checkpoint: { phase: 'order', index: 2, stage: 3, touched: true, tray: ['bread'], hint: true } };
  await page.goto(url); await page.evaluate(async ({ mainKey, fixture, picnicId }) => { localStorage.setItem(mainKey, JSON.stringify(fixture)); const s = await SynkPlayCollection.load(); s.owned.push(picnicId); await SynkPlayCollection.save(s); }, { mainKey, fixture, picnicId });
  const readMain = () => page.evaluate(k => localStorage.getItem(k), mainKey), readVisits = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), visitsKey), ready = () => page.waitForFunction(() => !!document.querySelector('[data-item]:not(:disabled)'));
  const shot = async name => { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); assert.equal(await page.locator('#beginner img').evaluateAll(ns => ns.filter(n => !n.complete || !n.naturalWidth).length), 0); await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true }); };
  const before = await readMain();
  await page.goto(`${url}?play=picnic`); await page.locator('.b-picnic-entry [data-action=picnic]').waitFor(); await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => __plays), 0); assert.equal(await readVisits(), null); assert.equal(await readMain(), before);
  await shot('owned-ready-390'); await page.setViewportSize({ width: 320, height: 800 }); await shot('owned-ready-320');
  await page.locator('[data-action=home]').click(); assert.equal(await readMain(), before);
  await page.goto(`${url}?play=picnic`); await page.locator('.b-picnic-entry [data-action=picnic]').waitFor();
  report.checks.push('Owned deep link opens a bilingual ready screen at 320/390px without audio or history writes. Returning to the free shop preserves the exact main checkpoint.');
  const core = await import('../beginner-core.mjs');
  const solve = async (voices = null, guests = null) => {
    const observed = { voices: [], friends: [] };
    for (let index = 0; index < 3; index++) {
      await ready(); const friend = (await page.locator(`#beginner .b-picnic-friend.friend-${index}`).getAttribute('src')).split('/').pop().replace('.webp', ''); observed.friends.push(friend); if (guests) assert.equal(friend, guests[index]);
      let voice = voices?.[index];
      if (!voice) { await page.locator('[data-action=hint]').click(); const text = await page.locator('.b-hint strong').innerText(); voice = core.VOICE_LINES.find(line => line.text === text)?.id; assert.ok(voice); }
      observed.voices.push(voice); const item = voice.split('-')[0], count = /-[123]$/.test(voice) ? Number(voice.at(-1)) : 1;
      for (let n = 0; n < count; n++) await page.locator(`[data-item=${item}]`).click(); await page.locator('[data-action=serve]').click();
      assert.equal(await page.locator(`#beginner .b-picnic-food.food-${index} img`).count(), count); assert.equal(await page.locator('#beginner .b-picnic-food').count(), index + 1);
      await page.locator('[data-action=next]').click();
    }
    await page.locator('.b-picnic-finish').waitFor(); assert.equal(await readMain(), before); assert.equal((await page.evaluate(() => SynkPlayCollection.load())).coins, 0); return observed;
  };
  let last = null;
  for (let visit = 0; visit < 5; visit++) {
    if (visit === 2) { const stored = await readVisits(); await page.reload(); await page.locator('.b-picnic-entry [data-action=picnic]').waitFor(); assert.deepEqual(await readVisits(), stored); assert.equal(await page.evaluate(() => __plays), 0); }
    await page.locator('[data-action=picnic]').first().click(); await ready(); const state = await readVisits(); assert.equal(state.visits, visit + 1);
    if (last) { assert.notDeepEqual(state.previous.voices, last.voices); assert.notDeepEqual(state.previous.friends, last.friends); }
    assert.equal(await page.locator('.b-hint').count(), 0); assert.ok(state.previous.voices.every(v => ['water-please', 'bread-please', 'apple-please', 'bread-1', 'bread-2', 'bread-3', 'apple-1', 'apple-2', 'apple-3'].includes(v)));
    if (visit === 1) { await page.setViewportSize({ width: 390, height: 800 }); await shot('varied-play-390'); }
    await solve(state.previous.voices, state.previous.friends); last = state.previous; report.visits.push(state.previous);
  }
  assert.ok(await page.evaluate(() => __ends >= 9)); await shot('varied-complete-390');
  report.checks.push('Five same-level rounds, including a page reload, each change both order and friend sequences, reuse only learned request/count clips and reveal no answer before help. Foods align with their actual friends; main checkpoint and coins stay unchanged.');
  const persisted = await readVisits(); await page.evaluate(k => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === k) throw Error('QA picnic history blocked'); return original.call(this, key, value); }; }, visitsKey);
  await page.locator('[data-action=picnic]').first().click(); await ready(); await page.locator('.b-picnic-save-note').waitFor(); await page.setViewportSize({ width: 320, height: 800 }); await shot('save-failure-320'); const failedFirst = await solve();
  await page.locator('[data-action=picnic]').first().click(); await ready(); const failedSecond = await solve(); assert.notDeepEqual(failedFirst.voices, failedSecond.voices); assert.notDeepEqual(failedFirst.friends, failedSecond.friends); assert.deepEqual(await readVisits(), persisted);
  assert.match(await page.locator('.b-picnic-save-note').innerText(), /새로고침하면 같은 소풍/);
  report.checks.push('Blocked history writes show an honest bilingual warning during play and completion. Two free replays still vary in memory; persisted visit history, main story and coins are not overwritten.');
  await page.goto(`${url}?play=picnic`); await page.locator('.b-picnic-entry [data-action=picnic]').waitFor();
  await page.evaluate(async id => { const s = await SynkPlayCollection.load(); s.owned = s.owned.filter(item => item !== id); await SynkPlayCollection.save(s); }, picnicId);
  await page.goto(`${url}?play=picnic`); await page.locator('[data-action=picnic-shop]').waitFor(); assert.equal(await page.locator('[data-action=picnic]').count(), 0); assert.equal(await page.evaluate(() => __plays), 0); assert.equal(await readMain(), before); await shot('unowned-ready-320');
  await page.locator('[data-action=picnic-shop]').click(); await page.locator('#b-decor[open]').waitFor(); assert.equal(await page.locator('[data-decor-pick="order-playset-picnic"]').getAttribute('aria-pressed'), 'true'); assert.equal(await page.locator('[data-decor-play]').count(), 0);
  await page.goto(`${url}?shop=1`); await page.locator('#b-decor[open]').waitFor(); assert.equal(await page.locator('.b-picnic-entry').count(), 0);
  report.checks.push('Unowned deep links expose only the playset/shop route and cannot start picnic. Existing ?shop=1 still opens the shop directly.');
  const blocked = await browser.newContext({ viewport: { width: 320, height: 800 } }); await blocked.addInitScript(() => { const original = Storage.prototype.getItem; Storage.prototype.getItem = function(k) { if (k === 'SYNK_PLAY_COLLECTION_V1') throw Error('QA wallet blocked'); return original.call(this, k); }; });
  const blockedPage = await blocked.newPage(); await blockedPage.goto(`${url}?play=picnic`); await blockedPage.locator('[data-action=picnic-ready]').waitFor(); assert.equal(await blockedPage.locator('[data-action=picnic]').count(), 0); await blockedPage.locator('[data-action=home]').click(); await blockedPage.locator('[data-action=start]').waitFor(); await blocked.close();
  report.checks.push('Unreadable ownership shows retry rather than claimed ownership; the free shop remains reachable.');
  assert.deepEqual(errors, []); fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2)); await browser.close(); console.log(JSON.stringify({ checks: report.checks.length, variedVisits: report.visits.length, errors, out }));
})().catch(e => { console.error(e); process.exit(1); });
