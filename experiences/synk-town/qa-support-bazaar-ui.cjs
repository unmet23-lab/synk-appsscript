// Browser inputs exercise an isolated local host; assertions read its committed state.
// No account, sample student profile, production save or paid service is involved.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = path.join(__dirname, 'qa'), servers = [], checks = [], errors = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const check = (name, ok, details) => { checks.push({ name, ok: !!ok, ...(details === undefined ? {} : { details }) }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) throw Error(name); };
async function until(fn, name, ms = 30000) { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return; await delay(100); } throw Error(`Timeout: ${name}`); }
async function settled(page, name) {
  await until(() => page.locator('#day-app').getAttribute('aria-busy').then(value => value !== 'true'), `${name} completed`);
  if (await page.locator('#error').isVisible()) throw Error(await page.locator('#error').textContent());
}
async function click(page, type, data = {}, label = null) {
  const attrs = Object.entries(data).map(([key, value]) => `[data-${key}="${value}"]`).join('');
  let locator = page.locator(`[data-command="${type}"]${attrs}`).filter({ visible: true });
  if (label) locator = locator.filter({ hasText: label });
  await locator.first().click(); await settled(page, type);
}
async function look(page) { await page.locator('#scene').scrollIntoViewIfNeeded(); await page.evaluate(() => document.querySelector('#scene').scrollIntoView({ block: 'start', behavior: 'instant' })); }
async function settings(page, work) { await page.locator('#settings-open').click(); await work(); await page.locator('#settings-close').click(); }
async function serverFixture() {
  const { createStore, createServer } = await import(pathToFileURL(path.join(__dirname, 'server.mjs')).href);
  const store = createStore({ lifeEnabled: true }), server = createServer({ previewEnabled: true, store });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); servers.push(server);
  return { store, url: `http://127.0.0.1:${server.address().port}/day.html?controls=classic` };
}
async function load(page, url) {
  page.on('pageerror', error => errors.push(error.message)); await page.goto(url);
  await page.waitForFunction(() => globalThis.SYNKTownDay?.snapshot()?.view.support && document.querySelector('#day-app').getAttribute('aria-busy') === 'false');
}
async function setMode(page, mode) { await settings(page, () => click(page, 'SUPPORT_SET', { mode })); }
async function setRoleMode(page, mode) { await settings(page, () => click(page, 'DAY_SUPPORT', { mode })); }
async function makeSeat(page, store) {
  await click(page, 'DAY_MOVE', { location: 'cafe' });
  if (store.read().state.day.location === 'home') await click(page, 'DAY_EXIT');
  await click(page, 'CHOOSE', { branch: 'inside' }); await click(page, 'NEXT'); await click(page, 'PLACE'); await look(page);
  await until(() => store.read().state.delivered, 'seat actual execution and visible result');
  await until(() => store.read().view.bazaar.actions.some(a => a.type === 'BAZAAR_START'), 'cafe owner ready for current requests');
}
(async () => {
  let browser, failure = null; const startedAt = new Date().toISOString(), metrics = {};
  const hashFiles = ['support.mjs', 'bazaar.mjs', 'day.mjs', 'core.mjs', 'server.mjs', 'day-app.mjs', 'day-style.css', 'day.html', 'day-scene.mjs'];
  const sourceHashes = Object.fromEntries(hashFiles.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, file))).digest('hex')]));
  try {
    fs.mkdirSync(output, { recursive: true });
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
    const { READING_CHECKS } = await import(pathToFileURL(path.join(__dirname, 'understanding.mjs')).href);
    const { store, url } = await serverFixture(), page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    await load(page, url); await look(page);
    check('empty-history-does-not-label-proficiency-or-restrict-life', !store.read().view.support.proposal && store.read().view.support.profile.grade === null && store.read().view.day.actions.length > 0);
    await page.locator('#settings-open').click(); await page.locator('#reading-open').click();
    await until(() => page.locator('#reading-dialog').isVisible(), 'reading dialog');
    let sequence = false;
    for (let i = 0; i < 18 && !sequence; i++) {
      const reading = store.read().view.support.reading, item = READING_CHECKS.find(item => item.id === reading.item.id);
      sequence = item.skill === 'sequence';
      const choice = sequence ? (item.correct + 1) % item.choices.length : item.correct;
      await click(page, 'SUPPORT_ANSWER', {}, item.choices[choice]);
      if (!sequence) await click(page, 'SUPPORT_NEXT');
    }
    check('visible-reading-answer-is-server-scored-with-exact-core-evidence', sequence && store.read().view.support.proposal?.mode === 'stepwise' && store.read().state.support.attempts.at(-1)?.correct === false);
    await page.screenshot({ path: path.join(output, 'support-reading-desktop.png') });
    await click(page, 'SUPPORT_NEXT'); await click(page, 'SUPPORT_HINT');
    check('hint-is-delivered-only-after-request', !!store.read().view.support.reading.hint && await page.locator('#reading-hint').isVisible());
    const helped = store.read().view.support.reading, helpedItem = READING_CHECKS.find(item => item.id === helped.item.id);
    await click(page, 'SUPPORT_ANSWER', {}, helpedItem.choices[helpedItem.correct]);
    check('hinted-correct-response-is-not-counted-as-independent-reading', store.read().view.support.reading.feedback.assisted === true && store.read().view.support.reading.feedback.independent === false && store.read().view.support.profile.skills.find(row => row.id === 'ko.reading.sequence').n === 1);
    await page.setViewportSize({ width: 320, height: 900 });
    check('reading-dialog-at-320-keeps-all-content-without-horizontal-scroll', await page.evaluate(() => { const d = document.querySelector('#reading-dialog'); return d.scrollWidth <= d.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1; }));
    await page.screenshot({ path: path.join(output, 'support-reading-320.png') });
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.locator('#reading-close').click(); await settled(page, 'reading close');
    await click(page, 'SUPPORT_ACCEPT'); await page.locator('#settings-close').click();
    check('help-proposal-requires-explicit-acceptance', store.read().state.support.selection.mode === 'stepwise' && store.read().state.support.selection.source === 'accepted-proposal');
    await setRoleMode(page, 'plan');
    await click(page, 'DAY_MOVE', { location: 'greenhouse' }); await click(page, 'DAY_EXIT');
    await click(page, 'DAY_START', { kind: 'coordination' });
    check('short-stepwise-language-and-planning-role-coexist', store.read().state.day.episode.languageSupport === 'stepwise' && store.read().state.day.episode.support === 'plan' && store.read().state.day.episode.guideStep === 0);
    const sceneBasis = structuredClone(store.read().state.day.episode.languageSupportBasis);
    await setMode(page, 'plain');
    check('changing-next-language-setting-does-not-rewrite-accepted-scene', store.read().state.support.selection.mode === 'plain' && store.read().state.day.episode.languageSupport === 'stepwise');
    check('accepted-scene-retains-original-recommendation-version-and-evidence', sceneBasis.source === 'accepted-proposal' && sceneBasis.basis.policy === 'learning-priority-3' && sceneBasis.basis.evidence.length > 0 && JSON.stringify(store.read().state.day.episode.languageSupportBasis) === JSON.stringify(sceneBasis));
    await click(page, 'DAY_GUIDE_NEXT');
    check('each-guide-step-waits-for-an-explicit-player-command', store.read().state.day.episode.guideStep === 1 && !store.read().state.day.episode.role);
    await click(page, 'DAY_GUIDE_NEXT'); await click(page, 'DAY_ROLE', { role: 'planner' }); await click(page, 'DAY_CHOICE', { choice: 'silent' }); await look(page);
    await until(() => store.read().state.day.episode.stage === 'awaitConfirm', 'planning rehearsal');
    check('stepwise-language-keeps-player-final-planning-choice', store.read().state.day.episode.choice === 'silent' && store.read().state.day.history.length === 0);
    await click(page, 'DAY_CONFIRM'); await look(page);
    await until(() => store.read().state.day.episode.stage === 'result', 'coordination completion');
    await click(page, 'DAY_CLOSE');
    await makeSeat(page, store); await setMode(page, 'stepwise'); await setRoleMode(page, 'cooperate');
    await settings(page, async () => { await page.locator('#contact-options [data-mode="quiet"]').click(); await settled(page, 'quiet contacts'); });
    const readingAttemptsBeforeBazaar = store.read().state.support.attempts.length;
    await click(page, 'BAZAAR_START', { kind: 'requests' }); await click(page, 'BAZAAR_ROLE', { role: 'planner' }); await click(page, 'BAZAAR_ASK');
    check('stepwise-request-keeps-second-speaker-waiting', store.read().state.bazaar.episode.stage === 'requestContinue' && store.read().state.bazaar.episode.requestsHeard === 1);
    await click(page, 'BAZAAR_CONTINUE'); await click(page, 'BAZAAR_CHOICE', { choice: 'waterFirst' });
    await click(page, 'BAZAAR_MATCH', { recipient: 'reader', menu: 'tea', sweetener: 'sweet' });
    await click(page, 'BAZAAR_MATCH', { recipient: 'companion', menu: 'water', sweetener: 'none' });
    const before = structuredClone(store.read().state.materials);
    await click(page, 'BAZAAR_CONFIRM');
    check('wrong-request-asks-for-correction-without-consuming-a-story-portion', store.read().state.bazaar.episode.stage === 'correction' && store.read().state.bazaar.allocation.portions.every(p => p.status === 'available') && JSON.stringify(store.read().state.materials) === JSON.stringify(before));
    await page.screenshot({ path: path.join(output, 'bazaar-request-correction.png') });
    await click(page, 'BAZAAR_MATCH', { recipient: 'reader', menu: 'tea', sweetener: 'none' }); await click(page, 'BAZAAR_CONFIRM'); await look(page);
    await until(() => store.read().state.bazaar.episode.stage === 'awaitTea', 'water served while tea waits');
    await delay(1800);
    check('water-first-requires-explicit-next-tea-and-keeps-the-unsent-portion', store.read().state.bazaar.episode.stage === 'awaitTea' && store.read().state.bazaar.allocation.portions.find(p => p.id === 'companion').status === 'served' && store.read().state.bazaar.allocation.portions.find(p => p.id === 'reader').status !== 'served');
    const portionsBeforeReturn = structuredClone(store.read().state.bazaar.allocation.portions);
    await click(page, 'DAY_MOVE', { location: 'home' }); await look(page);
    check('return-home-preserves-pending-tea-and-already-served-water', store.read().state.day.location === 'home' && store.read().state.bazaar.episode.stage === 'awaitTea' && JSON.stringify(store.read().state.bazaar.allocation.portions) === JSON.stringify(portionsBeforeReturn));
    await click(page, 'DAY_MOVE', { location: 'cafe' }); await click(page, 'DAY_EXIT'); await look(page);
    await until(() => page.locator('[data-command="BAZAAR_TEA_NEXT"]').filter({ visible: true }).count().then(n => n > 0), 'returned cafe offers the pending tea without an actor reservation deadlock');
    check('revisit-cafe-reopens-pending-tea-without-duplicating-water', store.read().state.day.location === 'cafe' && store.read().state.day.visit === 2 && store.read().state.bazaar.episode.stage === 'awaitTea' && JSON.stringify(store.read().state.bazaar.allocation.portions) === JSON.stringify(portionsBeforeReturn));
    await page.screenshot({ path: path.join(output, 'bazaar-return-await-tea.png') });
    await click(page, 'BAZAAR_TEA_NEXT'); await look(page);
    await until(() => store.read().state.bazaar.history.length === 1, 'two portions actually delivered');
    check('two-different-requests-create-two-deliveries-and-no-language-attempt', store.read().state.bazaar.allocation.portions.every(p => p.status === 'served') && store.read().state.support.attempts.length === readingAttemptsBeforeBazaar);
    await click(page, 'BAZAAR_CLOSE'); await click(page, 'BAZAAR_START', { kind: 'pictureMenu' }); await click(page, 'BAZAAR_ROLE', { role: 'planner' }); await click(page, 'BAZAAR_CHOICE', { choice: 'picturesFirst' }); await click(page, 'BAZAAR_CONFIRM'); await look(page);
    await until(() => store.read().state.bazaar.history.length === 2, 'picture menu actual installed and viewed');
    check('picture-menu-keeps-food-delivery-count-and-creates-its-own-resident-meeting', store.read().state.bazaar.history.at(-1).servings === 0 && store.read().state.bazaar.allocation.portions.filter(p => p.status === 'served').length === 2 && store.read().state.bazaar.emitted.includes('BAZAAR:LS02.3:pictureMenu:firstConversation'));
    check('foodless-picture-menu-hides-empty-request-cards', !(await page.locator('#bazaar-panel').isVisible()));
    await page.screenshot({ path: path.join(output, 'bazaar-picture-menu-desktop.png') });
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 900 }); await look(page); await delay(200);
      check(`mobile-${width}-no-horizontal-overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: path.join(output, `support-bazaar-${width}.png`) });
      await settings(page, async () => check(`mobile-${width}-language-options-fit`, await page.evaluate(() => { const d = document.querySelector('#settings-dialog'); return !d || d.scrollWidth <= d.clientWidth + 1; })));
    }
    metrics.mobile320 = await page.evaluate(() => SYNKTownDay.metrics());
    await page.reload(); await page.waitForFunction(() => globalThis.SYNKTownDay?.snapshot()?.view.support);
    check('reload-preserves-accepted-support-reading-and-one-time-servings', store.read().state.support.selection.mode === 'stepwise' && store.read().state.bazaar.history.length === 2 && store.read().state.support.attempts.length > 0);
    await page.close();
    const fallback = await serverFixture(), alt = await browser.newPage({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
    await alt.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (kind, ...args) { return String(kind).startsWith('webgl') || kind === 'experimental-webgl' ? null : original.call(this, kind, ...args); }; });
    await load(alt, fallback.url); await setMode(alt, 'stepwise'); await click(alt, 'DAY_MOVE', { location: 'greenhouse' }); await click(alt, 'DAY_EXIT'); await click(alt, 'DAY_START', { kind: 'coordination' }); await click(alt, 'DAY_GUIDE_NEXT');
    check('webgl-fallback-preserves-the-same-explicit-guide-choice', await alt.evaluate(() => SYNKTownDay.metrics().fallback) && fallback.store.read().state.day.episode.guideStep === 1);
    await alt.screenshot({ path: path.join(output, 'support-guide-fallback.png') }); metrics.fallback = await alt.evaluate(() => SYNKTownDay.metrics());
    check('no-page-javascript-errors', errors.length === 0, errors);
  } catch (error) { failure = error.stack || String(error); }
  finally {
    fs.writeFileSync(path.join(output, 'support-bazaar-ui.json'), JSON.stringify({ status: failure ? 'failed' : 'passed', startedAt, finishedAt: new Date().toISOString(), sourceHashes,
      environment: 'Headless Microsoft Edge on Windows; emulated viewports, not physical phones', checks, metrics, errors, failure, liveDeployment: false, realPlayers: 0, physicalDevices: 0 }, null, 2) + '\n');
    await browser?.close(); await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))));
  }
  console.log(JSON.stringify({ checks: checks.length, passed: checks.filter(c => c.ok).length, failure })); if (failure) process.exitCode = 1;
})();
