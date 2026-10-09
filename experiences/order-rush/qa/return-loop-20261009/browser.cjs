'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http'), crypto = require('node:crypto');
const { chromium } = require(require.resolve('playwright', { paths: [path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const root = path.resolve(__dirname, '../../..'), out = __dirname, key = 'synk.order-rush.beginner.v1';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); let file = path.resolve(root, '.' + pathname); if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; } if (pathname.endsWith('/')) file = path.join(file, 'index.html'); fs.readFile(file, (error, data) => { if (error) { res.writeHead(404).end(); return; } res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(data); }); });
const report = { at: new Date().toISOString(), evidence: 'Isolated Chrome, local guest and synthetic progress only; current approved MP3 ended events; not human listening or physical device proof', checks: [], errors: [], remoteRequests: [], audioEvents: null };
const story = progress => Object.fromEntries(['seed', 'completed', 'stage', 'records', 'checkpoint', 'finished', 'roundId'].map(field => [field, progress[field]]));
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ channel: 'chrome', headless: true }); const context = await browser.newContext({ viewport: { width: 320, height: 800 }, reducedMotion: 'reduce' });
  await context.route('**/*', route => { if (new URL(route.request().url()).origin !== origin) { report.remoteRequests.push(route.request().url()); return route.abort(); } return route.continue(); });
  const page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
  await page.addInitScript(() => { window.__voiceEnds = 0; window.__voicePlays = 0; const play = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function(...args) { __voicePlays++; if (!this.dataset.qaTracked) { this.dataset.qaTracked = '1'; this.addEventListener('ended', () => __voiceEnds++); } return play.apply(this, args); }; });
  const url = origin + '/order-rush/beginner.html', core = await import('../../beginner-core.mjs'), helpers = await import('../../beginner-return.mjs');
  const getProgress = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key), ready = () => page.waitForFunction(() => !!document.querySelector('[data-item]:not(:disabled)'));
  const audioTotal = { plays: 0, ended: 0 }, collectAudio = async () => { const events = await page.evaluate(() => ({ plays: __voicePlays, ended: __voiceEnds })); audioTotal.plays += events.plays; audioTotal.ended += events.ended; };
  const seed = async value => { await collectAudio(); await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key, value }); await page.reload(); await page.locator('[data-action=start],[data-action=visit]').first().waitFor(); };
  const shot = async name => { assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); assert.equal(await page.locator('#beginner img').evaluateAll(images => images.filter(image => !image.complete || !image.naturalWidth).length), 0); await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true }); };
  try {
    await page.goto(url); await page.locator('[data-action=start]').waitFor(); assert.equal(await page.locator('.b-memory-entry').count(), 0);
    report.checks.push('A fresh guest gets the free first lesson; no invented missed expressions or required memory gate appear.');
    const fixture = core.readProgress({ ...core.newProgress(42), completed: [0, 1], records: [{ voice: 'bread-please', stage: 1, heard: true, firstCorrect: false, independent: false, helped: true, guest: 'rabbit' }, { voice: 'apple-2', stage: 2, heard: true, firstCorrect: true, independent: false, replayed: true, guest: 'bear' }], roundId: 'order-rush:qa-preserve', checkpoint: { stage: 2, phase: 'order', index: 1, touched: true, tray: ['bread'], hint: true, firstCorrect: false, attempts: 1 } });
    await seed(fixture); await page.locator('.b-memory-entry').waitFor(); assert.equal(await page.evaluate(() => __voicePlays), 0); await shot('memory-entry-320');
    const before = story(await getProgress()), coins = (await page.evaluate(() => SynkPlayCollection.load())).coins, counts = await page.evaluate(() => SynkLearning.createGame({ gameId: 'order-rush', storage: localStorage }).summary().counts);
    const round = helpers.nextMemoryRound(fixture); await page.locator('[data-action=memory]').click(); await ready();
    assert.equal(await page.locator('.b-hint').count(), 0); assert.equal(await page.locator('.b-audio-label').innerText().then(text => round.orders.some(order => text.includes(order.text))), false); await shot('memory-first-answer-320');
    const first = round.orders[0], originalShelf = core.shuffle(core.STAGES[first.stage].items, fixture.seed + first.storyIndex + first.stage * 71); assert.notDeepEqual(await page.locator('[data-item]').evaluateAll(nodes => nodes.map(node => node.dataset.item)), originalShelf);
    await page.locator(`[data-item=${first.item}]`).click(); await page.locator('#menu-button').click(); await page.locator('#b-resume').click(); assert.equal(await page.locator('[data-remove]').count(), 1);
    while (await page.locator('[data-remove]').count()) await page.locator('[data-action=undo]').click();
    const wrong = first.item === 'bread' ? 'apple' : 'bread'; await page.locator(`[data-item=${wrong}]`).click(); await page.locator('[data-action=serve]').click(); assert.equal(await page.locator('.b-hint').count(), 1); await shot('memory-correction-320');
    for (let i = 0; i < round.orders.length; i++) {
      await ready(); const order = round.orders[i]; assert.notEqual(order.guest, order.previousGuest);
      if (i > 0) { assert.equal(await page.locator('.b-hint').count(), 0); await page.locator('[data-action=hint]').click(); }
      while (await page.locator('[data-remove]').count()) await page.locator('[data-action=undo]').click();
      for (let n = 0; n < order.count; n++) await page.locator(`[data-item=${order.item}]`).click(); await page.locator('[data-action=serve]').click(); await page.locator('[data-action=next]').click();
    }
    await page.locator('.b-memory-finish').waitFor(); assert.equal(await page.locator('.b-stat').count(), 0); assert.deepEqual(story(await getProgress()), before); assert.equal((await page.evaluate(() => SynkPlayCollection.load())).coins, coins);
    assert.deepEqual(await page.evaluate(() => SynkLearning.createGame({ gameId: 'order-rush', storage: localStorage }).summary().counts), counts); await shot('memory-complete-320');
    report.checks.push('Two familiar requests reuse approved audio, new customers and a changed shelf. First answers reveal no target picture/text; wrong/help correction is available; pause keeps the partial tray. Story, coins and Atlas counts are unchanged and completion has no independent score.');
    await page.locator('[data-action=home]').click(); await page.locator('[data-action=start]').click(); await ready(); assert.equal(await page.locator('[data-remove]').count(), 1); assert.equal(await page.locator('.b-hint').count(), 1); assert.equal((await getProgress()).checkpoint.firstCorrect, false);
    await page.locator('#menu-button').click(); await page.locator('#b-home').click(); report.checks.push('Returning from memory retains the main chapter, partial tray, help and original first wrong answer.');
    const completed = core.readProgress({ ...core.newProgress(411), completed: [0, 1, 2, 3], roundId: 'order-rush:qa-festival', records: fixture.records }); await seed(completed); const completeBefore = story(completed);
    let previous = core.stageOrders(3, completed.seed + 3); const sequences = [];
    for (let visit = 0; visit < 3; visit++) {
      const round = helpers.nextFestivalRound(await getProgress()); await page.locator('[data-action=visit]').first().click(); await ready(); const stored = (await getProgress()).festivalPractice;
      assert.notDeepEqual(stored.previous.voices, previous.map(order => order.voice)); assert.notDeepEqual(stored.previous.guests, previous.map(order => order.guest)); assert.deepEqual(stored.previous.voices, round.orders.map(order => order.voice)); assert.equal(await page.locator('.b-hint').count(), 0); assert.equal(await page.locator('#b-time').count(), 0); assert.deepEqual(story(await getProgress()), completeBefore); sequences.push(stored.previous);
      if (visit === 0) {
        await page.setViewportSize({ width: 390, height: 844 }); await shot('festival-varied-390');
        for (const order of round.orders) { await ready(); for (let n = 0; n < order.count; n++) await page.locator(`[data-item=${order.item}]`).click(); await page.locator('[data-action=serve]').click(); await page.locator('[data-action=next]').click(); }
        await page.locator('h1').filter({ hasText: '축제가 따뜻하게' }).waitFor(); assert.deepEqual(story(await getProgress()), completeBefore); assert.equal((await page.evaluate(() => SynkPlayCollection.load())).coins, coins); await shot('festival-complete-390'); await page.locator('[data-action=home]').click();
      } else { await page.locator('#menu-button').click(); await page.locator('#b-home').click(); }
      previous = round.orders; if (visit === 1) { await collectAudio(); await page.reload(); await page.locator('[data-action=visit]').first().waitFor(); }
    }
    report.checks.push('Three free festival entries change both voice and guest sequences, including after reload; all nine familiar recipes remain. A full nine-order replay is untimed, earns no coins and preserves main story records/seed.'); report.festivalSequences = sequences;
    const savedHistory = (await getProgress()).festivalPractice;
    await page.evaluate(key => { const native = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v) { if (k === key) throw Error('QA existing progress write blocked'); return native.call(this, k, v); }; }, key);
    await page.locator('[data-action=visit]').first().click(); await ready(); await page.locator('.b-picnic-save-note').waitFor(); assert.deepEqual((await getProgress()).festivalPractice, savedHistory); await page.setViewportSize({ width: 320, height: 800 }); await shot('festival-write-failure-320'); await page.locator('#menu-button').click(); await page.locator('#b-home').click();
    await page.locator('[data-action=visit]').first().click(); await ready(); await page.locator('.b-picnic-save-note').waitFor(); assert.deepEqual(story(await getProgress()), completeBefore); report.checks.push('Blocked existing-key history writes show a truthful warning, retain persisted state and keep free replay usable.');
    await page.locator('#menu-button').click(); await page.locator('#b-home').click(); await page.locator('[data-action=decorate]').first().click(); const shopRoute = page.locator('#b-decor[open] [data-decor-learn]'); await shopRoute.waitFor(); assert.match(await shopRoute.getAttribute('href'), /^\//); await shopRoute.focus(); assert.equal(await shopRoute.evaluate(node => node === document.activeElement), true); await shot('shop-next-lesson-320');
    report.checks.push('An unaffordable playset exposes a keyboard reachable next-learning/free route using the existing felt CTA; the basic game remains available.');
    await collectAudio(); report.audioEvents = audioTotal; assert.ok(report.audioEvents.ended >= 9); assert.deepEqual(report.errors, []); assert.deepEqual(report.remoteRequests, []);
    report.sourceSha256 = Object.fromEntries(['beginner.mjs', 'beginner-core.mjs', 'beginner-return.mjs', 'beginner-shop.mjs', 'beginner.css'].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'order-rush', file))).digest('hex')]));
    fs.writeFileSync(path.join(out, 'browser-results.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ checks: report.checks.length, audio: report.audioEvents, errors: report.errors, remote: report.remoteRequests, out }));
  } catch (error) { fs.writeFileSync(path.join(out, 'browser-failure-' + Date.now() + '.json'), JSON.stringify({ ...report, error: error.stack }, null, 2)); await page.screenshot({ path: path.join(out, 'browser-failure-' + Date.now() + '.png'), fullPage: true }); throw error; }
  finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
