// The residents' authored lines on the screen QA (W10 — vertical slice design §16: greetings, routines, the new tea's goodbye).
// Each scene runs its own store whose clock starts at a chosen Korean instant. own: walking to the cafe while its owner works
// there and has nothing heard to tell, the place's panel says the owner's own greeting (one of its authored greetings), the
// greeting counts as seen, and the panel opened again says what the owner is doing (its routine line). bye: C4's talk left
// with 「그만할래요」 on its first turn — the goodbye stands at the top of the place's panel while it is open and, the panel
// closed, by the cafe owner's name, then goes. text: with no WebGL, the text alternative's row for the owner reads its
// routine line. Captures at 1440 and 390.
//   node experiences/synk-town/qa-lines-ui.cjs [--out <dir>] [--only own,bye,text]
const fs = require('node:fs'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const output = path.resolve(arg('--out', path.join(__dirname, '../../.tmp/town-w10-lines')));
const only = arg('--only', '') ? new Set(arg('--only', '').split(',')) : null;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const kst = (date, time) => Date.parse(`${date}T${time}:00+09:00`);
const MIN = 60000;
const DEVICES = { desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: 'reduce' } };
const known404 = /avatar-textiles-v1/;
const report = { started: new Date().toISOString(), scenes: {}, failures: [] };
const check = (scene, ok, what, detail) => { (report.scenes[scene] ||= { checks: [] }).checks.push({ ok: !!ok, what, ...(detail === undefined ? {} : { detail }) }); if (!ok) report.failures.push(`${scene}: ${what}${detail === undefined ? '' : ` — ${JSON.stringify(detail).slice(0, 300)}`}`); };
const town = file => import(pathToFileURL(path.join(__dirname, file)).href);

async function fixture(startMs) {
  const { createStore, createServer } = await town('server.mjs');
  const c = { at: startMs, real: Date.now() }, now = () => c.at + (Date.now() - c.real);
  const store = createStore({ lifeEnabled: true, now, tz: 540, villageSeed: 'acct-w10', sleeps: true });
  const server = createServer({ previewEnabled: true, store });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, store, now, set: ms => { c.at = ms; c.real = Date.now(); }, base: `http://127.0.0.1:${server.address().port}`, stop: () => new Promise(resolve => server.close(resolve)) };
}
async function open(browser, f, { device = 'desktop' } = {}) {
  const context = await browser.newContext({ ...DEVICES[device] });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource|ERR_CONNECTION_REFUSED|Failed to fetch/.test(message.text())) errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400 && !known404.test(response.url()) && !/\/api\/preview\/(command|boundary)/.test(response.url())) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(`${f.base}/day.html?play=walk&district=townwide-merged`);
  await page.waitForFunction(() => globalThis.SYNKTownDay?.metrics()?.assetsReady && SYNKTownDay.metrics().walk?.enabled, null, { timeout: 120000 });
  await page.waitForFunction(() => { const b = SYNKTownDay.metrics().bakedDistrict; return b && (b.failed || b.loaded); }, null, { timeout: 180000 });
  await delay(1200);
  return { page, context, errors, close: () => context.close() };
}
const walkPoint = page => page.evaluate(() => SYNKTownDay.metrics().walk);
async function walkTo(page, steps) {
  await page.locator('#scene').focus();
  for (const [dimension, target] of steps) {
    const at = async () => (await walkPoint(page))[dimension];
    const sign = Math.sign(target - await at()); if (!sign || Math.abs(target - await at()) <= .1) continue;
    const key = dimension === 'x' ? (sign > 0 ? 'd' : 'a') : (sign > 0 ? 's' : 'w');
    await page.keyboard.down(key);
    for (const end = Date.now() + 12000; Date.now() < end && sign * (target - await at()) > .1;) await delay(40);
    await page.keyboard.up(key); await delay(400);
  }
}
const ROUTES = { cafe: [['z', 3.9], ['x', 0], ['z', 2.6]], workshop: [['z', 3.9], ['x', 6], ['z', 1.9]], greenhouse: [['z', 3.9], ['x', 0], ['z', -3.6]] };
async function talkAt(page, place = 'cafe') {
  await walkTo(page, ROUTES[place]);
  await page.waitForFunction(p => SYNKTownDay.metrics().walk.nearby === p, place, { timeout: 8000 });
  await page.keyboard.press('e');
  await page.waitForFunction(() => SYNKTownDay.metrics().walk.interactionOpen, null, { timeout: 10000 }); await delay(900);
}
const shot = (page, name) => page.screenshot({ path: path.join(output, `${name}.jpg`), type: 'jpeg', quality: 82 });
const fits = page => page.evaluate(() => ({ wide: document.documentElement.scrollWidth > innerWidth + 1 }));

/** Ten-minute steps from the store's clock to the first moment npc stays at place for four minutes (and, when given, more). */
async function stayAt(f, npc, place, more = () => true) {
  const village = await town('town/village.mjs');
  for (let step = 0; step < 432; step++) {
    const v = f.store.read().state.village, out = village.planOf(v), t = f.now();
    const start = Object.fromEntries(Object.entries(v.band.residents).map(([id, r]) => [id, r.lastSpot]).filter(([, at]) => at));
    const a = village.placeAt(out.segments, npc, t + 20000, start), b = village.placeAt(out.segments, npc, t + 4 * MIN, start);
    if (a && b && !a.walking && !b.walking && a.to === place && b.to === place && more(v, out, t)) return { at: t, archetype: a.archetype };
    f.set(t + 10 * MIN);
  }
  return null;
}

async function own(browser) {
  const { TOWN_LINES } = await town('town/data.gen.mjs');
  const said = (kind, level = 'L2') => new Set(TOWN_LINES.filter(l => l.npc === 'cafe-owner' && l.kind === kind).map(l => `찻집 주인: ${l.levels[level]}`));
  for (const device of ['desktop', 'phone']) {
    const f = await fixture(kst('2026-10-29', '12:20'));
    try {
      const found = await stayAt(f, 'cafe-owner', 'cafe', () => !Object.keys(f.store.read().view.day.scene?.village?.hearsay || {}).length);
      check('own', !!found, `${device}: 찻집 주인이 찻집에 머물고 전할 소식이 없는 때`, found);
      if (!found) continue;
      const s = await open(browser, f, { device });
      try {
        await talkAt(s.page, 'cafe');
        const first = await s.page.$eval('#place-cards .place-greet', el => el.textContent).catch(() => null);
        check('own', said('greet').has(first), `${device}: 장소 판 — 주인 자기 인사`, first);
        await shot(s.page, `own-${device}-1-greet`);
        // Seen once it stood in sight a moment: waiting for the next boundary, or already in the store's ledger.
        let counted = false;
        for (const end = Date.now() + 25000; !counted && Date.now() < end; await delay(500)) {
          const keys = [...await s.page.evaluate(() => SYNKTownDay.metrics().cards.seenPending), ...Object.keys(f.store.read().seen || {})];
          counted = keys.some(k => /^line:cafe-owner\.greet\./.test(k));
        }
        check('own', counted, `${device}: 인사가 보인 것으로 셈(line: 키)`);
        await s.page.keyboard.press('Escape'); await delay(700);
        await s.page.keyboard.press('e');
        await s.page.waitForFunction(() => SYNKTownDay.metrics().walk.interactionOpen, null, { timeout: 10000 }); await delay(900);
        const again = await s.page.$eval('#place-cards .place-greet', el => el.textContent).catch(() => null);
        check('own', said('routine').has(again), `${device}: 다시 열면 지금 하는 일`, again);
        await shot(s.page, `own-${device}-2-routine`);
        check('own', !(await fits(s.page)).wide, `${device}: 가로 넘침 없음`);
        check('own', !s.errors.length, `${device}: 오류·실패 요청 0`, s.errors);
      } finally { await s.close(); }
    } finally { await f.stop(); }
  }
}

async function bye(browser) {
  const village = await town('town/village.mjs'), { goodbye } = await town('new-tea.mjs');
  for (const device of ['desktop', 'phone']) {
    const f = await fixture(kst('2026-10-28', '07:30'));
    try {
      // A band's rises join the plan only once that band is planned: look every ten minutes (an hour's step skips them).
      let rise = null;
      for (let step = 0; step < 432 && !rise; step++) {
        const v = f.store.read().state.village, out = village.planOf(v), t = f.now();
        const start = Object.fromEntries(Object.entries(v.band.residents).map(([npc, r]) => [npc, r.lastSpot]).filter(([, at]) => at));
        const from = e => Math.max(e.atMs, t);
        const hit = out.log.map(e => ({ e, a: village.placeAt(out.segments, e.npc, from(e) + 20000, start), b: village.placeAt(out.segments, e.npc, from(e) + 4 * MIN, start) }))
          .find(({ e, a, b }) => e.card === 'C4' && e.atMs >= t - 15 * MIN && a && b && !a.walking && !b.walking && a.to === b.to && Object.hasOwn(ROUTES, a.to));
        rise = hit ? { ...hit.e, atMs: from(hit.e), place: hit.a.to } : null;
        if (!rise) f.set(f.now() + 10 * MIN);
      }
      check('bye', !!rise, `${device}: C4 주인이 머무는 때와 자리`, rise && { place: rise.place });
      if (!rise) continue;
      f.set(rise.atMs + 5000);
      const s = await open(browser, f, { device });
      try {
        await talkAt(s.page, rise.place);
        const go = s.page.locator('#place-cards .place-need .felt').first();
        await go.waitFor({ timeout: 10000 }); await go.click();
        await s.page.waitForSelector('#card-dialog[open]', { timeout: 10000 }); await delay(700);
        const level = await s.page.evaluate(() => SYNKTownDay.metrics().cards.take ?? null);
        await s.page.click('#card-close');
        await s.page.waitForFunction(() => !document.querySelector('#card-dialog[open]'), null, { timeout: 10000 }); await delay(900);
        const words = await s.page.$eval('#place-cards .place-bye', el => el.textContent).catch(() => null);
        check('bye', ['L1', 'L2', 'L3', 'L4'].some(l => words === `찻집 주인: ${goodbye(l)}`), `${device}: 걷기 판이 열린 채 — 판 맨 위에 작별 줄`, { words, level });
        await shot(s.page, `bye-${device}-1-panel`);
        await s.page.keyboard.press('Escape');
        const card = await s.page.waitForSelector('.mood-card[data-line="cafe-alley.day.new-tea.stop"]:not([hidden])', { timeout: 4000 }).then(el => el.evaluate(n => n.textContent)).catch(() => null);
        check('bye', !!card && ['L1', 'L2', 'L3', 'L4'].some(l => card.includes(goodbye(l))), `${device}: 판을 닫으면 주인 이름 곁에 작별 줄`, card);
        await shot(s.page, `bye-${device}-2-name`);
        await delay(9000);
        const gone = await s.page.$('.mood-card[data-line="cafe-alley.day.new-tea.stop"]');
        check('bye', !gone, `${device}: 잠시 뒤 사라진다`);
        check('bye', !(await fits(s.page)).wide, `${device}: 가로 넘침 없음`);
        check('bye', !s.errors.length, `${device}: 오류·실패 요청 0`, s.errors);
      } finally { await s.close(); }
    } finally { await f.stop(); }
  }
}

/** The text alternative (no WebGL): the owner's row reads what it is doing in its own words. */
async function text() {
  const { TOWN_LINES } = await town('town/data.gen.mjs');
  const routines = TOWN_LINES.filter(l => l.npc === 'cafe-owner' && l.kind === 'routine').map(l => `찻집 주인: ${l.levels.L2}`);
  const f = await fixture(kst('2026-10-29', '12:20'));
  const nogl = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-webgl', '--disable-3d-apis'] });
  try {
    const found = await stayAt(f, 'cafe-owner', 'cafe');
    check('text', !!found, '찻집 주인이 깨어 찻집에 있는 때', found);
    const context = await nogl.newContext({ ...DEVICES.desktop }), page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(`${f.base}/day.html?play=walk`);
      await page.waitForFunction(() => globalThis.SYNKTownDay?.metrics()?.connected, null, { timeout: 60000 });
      await page.waitForSelector('#scene-fallback:not([hidden])', { timeout: 20000 }); await delay(1500);
      const people = await page.$$eval('#fallback-people li', items => items.map(li => li.textContent));
      const row = people.find(p => p.startsWith('찻집 주인: ')) ?? null;
      check('text', !!row && routines.some(line => row.startsWith(line)), '글 대체 화면 — 주인 줄은 지금 하는 일 한 줄', { row, archetype: found?.archetype });
      await shot(page, 'text-alternative-desktop');
      check('text', !errors.filter(e => !/WebGL/.test(e)).length, '오류 0(일부러 끈 WebGL 빼고)', errors);
    } finally { await context.close(); }
  } finally { await nogl.close(); await f.stop(); }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const [name, run] of Object.entries({ own, bye, text })) {
      if (only && !only.has(name)) continue;
      try { await run(browser); } catch (error) { check(name, false, 'scene threw', error.stack || String(error)); }
    }
  } finally { await browser.close(); }
  report.finished = new Date().toISOString();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  const all = Object.values(report.scenes).flatMap(s => s.checks);
  console.log(`checks ${all.length} · ok ${all.filter(c => c.ok).length} · failures ${report.failures.length}`);
  for (const failure of report.failures) console.log(`✗ ${failure}`);
  process.exitCode = report.failures.length ? 1 : 0;
})();
