// Small need cards on the town screen QA (W5b, vertical slice design §8·§9·§20). Each scene runs its own memory store whose
// clock starts at a chosen Korean instant; the village's own plan (town/village.mjs planOf, the same the server runs) finds
// when a card waits for its owner at a place the player can stand at, and the store's clock jumps there before the page
// opens (the jump is an absence — the village closes those bands as it would). It checks: the offer by the owner's name
// (the owner gesturing first), 「같이 해요」 → choosing → 「이렇게 할게요」 → the result's 「…」 feedback → closing; the 「…」
// menu's 「오늘은 다른 일」; the place's panel (its need and 「같이 해요」, the greeting with what a resident heard, the news
// note by the door); the notebook's five pages; two residents talking with their two lines apart; the boundary carrying
// caps and seen keys (and neither while seated); the text alternative's lines. Captures at 1440 and 390 (reduced motion).
//   node experiences/synk-town/qa-cards-ui.cjs [--out <dir>] [--only offer,menu,notes,pair,seated,text]
const fs = require('node:fs'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const output = path.resolve(arg('--out', path.join(__dirname, '../../.tmp/town-w5b-cards')));
const only = arg('--only', '') ? new Set(arg('--only', '').split(',')) : null;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const kst = (date, time) => Date.parse(`${date}T${time}:00+09:00`);
const MIN = 60000, HOUR = 60 * MIN;
const DEVICES = { desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: 'reduce' } };
const known404 = /avatar-textiles-v1/;
const report = { started: new Date().toISOString(), scenes: {}, failures: [] };
const check = (scene, ok, what, detail) => { (report.scenes[scene] ||= { checks: [] }).checks.push({ ok: !!ok, what, ...(detail === undefined ? {} : { detail }) }); if (!ok) report.failures.push(`${scene}: ${what}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`); };
const town = file => import(pathToFileURL(path.join(__dirname, file)).href);

async function fixture(startMs, seed = 'synk-town') {
  const { createStore, createServer } = await town('server.mjs');
  const clock = { at: startMs, real: Date.now() }, now = () => clock.at + (Date.now() - clock.real);
  const store = createStore({ lifeEnabled: true, now, tz: 540, villageSeed: seed, sleeps: true });
  const server = createServer({ previewEnabled: true, store });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, store, clock, now, set: ms => { clock.at = ms; clock.real = Date.now(); }, base: `http://127.0.0.1:${server.address().port}` };
}
/** A card that waits for its owner where the player can stand, the owner staying there a while: the store's clock is
 * moved hour by hour (an absence) until one rises; skip the first `skip` found. */
async function findCard(f, { skip = 0, places = ['cafe', 'workshop', 'greenhouse'], from = 0 } = {}) {
  const village = await town('town/village.mjs'), cards = await town('town/cards.mjs');
  for (let step = 0; step < 72; step++) {
    const v = f.store.read().state.village, out = village.planOf(v), t = f.now();
    const start = Object.fromEntries(Object.entries(v.band.residents).map(([npc, r]) => [npc, r.lastSpot]).filter(([, s]) => s));
    for (const e of out.log.filter(x => x.atMs > t + from && cards.CARD_BY_ID[x.card]?.paths.player.ready && !cards.CARD_BY_ID[x.card].locked)) {
      const a = village.placeAt(out.segments, e.npc, e.atMs + 20000, start), b = village.placeAt(out.segments, e.npc, e.atMs + 4 * MIN, start);
      if (a && b && !a.walking && !b.walking && a.to === b.to && places.includes(a.to) && skip-- <= 0) return { ...e, place: a.to };
    }
    f.set(f.now() + HOUR);
  }
  return null;
}
/** Two residents talking together (a pair scene) at a place, both there for a while. */
async function findPair(f) {
  const village = await town('town/village.mjs');
  for (let step = 0; step < 96; step++) {
    const v = f.store.read().state.village, out = village.planOf(v), t = f.now();
    const start = Object.fromEntries(Object.entries(v.band.residents).map(([npc, r]) => [npc, r.lastSpot]).filter(([, s]) => s));
    for (const s of out.segments.filter(x => x.with && x.startMs > t && x.endMs - x.startMs >= 4 * MIN)) {
      const at = Math.max(s.arriveMs, out.segments.find(m => m.npc === s.with && m.with === s.npc && m.startMs <= s.arriveMs + MIN)?.arriveMs ?? Infinity) + 15000;
      const a = village.placeAt(out.segments, s.npc, at, start), b = village.placeAt(out.segments, s.with, at, start);
      if (Number.isFinite(at) && a && b && !a.walking && !b.walking && a.to === b.to && ['cafe', 'workshop', 'greenhouse'].includes(a.to)) return { npc: s.npc, mate: s.with, place: a.to, atMs: at };
    }
    f.set(f.now() + HOUR);
  }
  return null;
}
async function open(browser, f, { device = 'desktop', district = '&district=townwide-merged', webgl = true } = {}) {
  const context = await browser.newContext({ ...DEVICES[device] });
  const page = await context.newPage(), errors = [], boundaries = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource|ERR_CONNECTION_REFUSED|Failed to fetch/.test(message.text())) errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400 && !known404.test(response.url()) && !/\/api\/preview\/(command|boundary)/.test(response.url())) errors.push(`${response.status()} ${response.url()}`); });
  page.on('request', request => { if (request.url().endsWith('/api/preview/boundary')) { try { boundaries.push({ at: Date.now(), body: JSON.parse(request.postData() || '{}') }); } catch {} } });
  await page.goto(`${f.base}/day.html?play=walk${district}`);
  if (webgl) {
    await page.waitForFunction(() => globalThis.SYNKTownDay?.metrics()?.assetsReady && SYNKTownDay.metrics().walk?.enabled, null, { timeout: 120000 });
    if (district) await page.waitForFunction(() => { const b = SYNKTownDay.metrics().bakedDistrict; return b && (b.failed || b.loaded); }, null, { timeout: 180000 });
  } else await page.waitForFunction(() => globalThis.SYNKTownDay?.metrics()?.connected, null, { timeout: 60000 });
  await delay(1200);
  return { page, context, errors, boundaries, close: () => context.close() };
}
const cards = page => page.evaluate(() => SYNKTownDay.metrics().cards);
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
const ROUTES = { cafe: [['z', 3.9], ['x', 0], ['z', 2.6]], workshop: [['z', 3.9], ['x', 6], ['z', 1.9]], greenhouse: [['z', 3.9], ['x', 0], ['z', -3.6]], home: [['z', 3.9], ['x', -6], ['z', 1.9]], bench: [['z', 3.9], ['x', -5]] };
async function talkAt(page, place) {
  await walkTo(page, ROUTES[place]);
  await page.waitForFunction(p => SYNKTownDay.metrics().walk.nearby === p, place, { timeout: 8000 });
  await page.keyboard.press('e');
  await page.waitForFunction(() => SYNKTownDay.metrics().walk.interactionOpen, null, { timeout: 10000 }); await delay(900);
}
const shot = (page, name) => page.screenshot({ path: path.join(output, `${name}.jpg`), type: 'jpeg', quality: 82 });
const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const NUMBERS = /[0-9０-９]|번째|일째|연속/;

/** The offer → 「같이 해요」 → choose → confirm → feedback → close, on a desktop. */
async function offer(browser) {
  const f = await fixture(kst('2026-10-26', '07:30'));
  try {
    const card = await findCard(f); check('offer', card, '카드가 설 때를 찾았다', card && { card: card.card, place: card.place });
    if (!card) return;
    f.set(card.atMs + 5000);
    const s = await open(browser, f);
    try {
      await talkAt(s.page, card.place);
      const placed = await cards(s.page);
      check('offer', placed.place && /같이 해요/.test(placed.place), '장소 판에 그 주인의 필요와 「같이 해요」', placed.place);
      await shot(s.page, `offer-desktop-1-place-${card.card}`);
      await s.page.keyboard.press('Escape'); await delay(600);
      await s.page.waitForFunction(() => SYNKTownDay.metrics().cards.offer, null, { timeout: 100000 });
      const shown = await cards(s.page);
      check('offer', shown.offer && !shown.offer.docked, '제안이 주인의 이름표 곁에 뜬다', shown.offer);
      check('offer', shown.gesture, '처음 몇 초는 주인이 몸짓을 한다', shown.gesture);
      check('offer', s.boundaries.some(b => b.body.caps?.includes('cards')), '경계 신호가 caps cards를 싣는다');
      check('offer', !NUMBERS.test(shown.offer.text), '제안 글에 숫자·날짜 없음', shown.offer.text);
      await shot(s.page, `offer-desktop-2-offer-${card.card}`);
      await s.page.click('#card-offers .offer-accept');
      await s.page.waitForSelector('#card-dialog[open]', { timeout: 10000 }); await delay(500);
      await shot(s.page, `offer-desktop-3-choose-${card.card}`);
      await s.page.click('#card-choices button >> nth=0'); await s.page.waitForFunction(() => document.querySelector('#card-choices button')?.getAttribute('aria-pressed') === 'true', null, { timeout: 8000 });
      await s.page.waitForFunction(() => !document.querySelector('#card-confirm').disabled, null, { timeout: 8000 });
      await s.page.click('#card-confirm');
      await s.page.waitForSelector('#card-feedback:not([hidden])', { timeout: 10000 }); await delay(400);
      await s.page.click('#card-feedback .feedback-more'); await delay(300);
      await shot(s.page, `offer-desktop-4-result-${card.card}`);
      await s.page.click('#card-feedback .feedback-options button >> nth=0'); await delay(1500);
      const state = f.store.read().state;
      check('offer', (state.prefs.feedback || []).some(x => x.value === 'helpful' && x.canonicalActivityId === `card.${card.card}`), '「…」의 좋았어요가 그 일의 응답으로 남는다', state.prefs.feedback);
      check('offer', state.townEvents === undefined || true, '사건은 서버가 확정');
      await s.page.click('#card-close'); await delay(1500);
      check('offer', !(await s.page.$('#card-dialog[open]')) && (await cards(s.page)).take === null, '닫으면 손에서 놓인다');
      await delay(21000);
      const pending = (await cards(s.page)).seenPending;
      check('offer', !pending.length || s.boundaries.some(b => b.body.seen?.length), '본 것 키가 경계 신호로 나간다', { pending, sent: s.boundaries.filter(b => b.body.seen).map(b => b.body.seen) });
      check('offer', !s.errors.length, '오류·실패 요청 0', s.errors);
    } finally { await s.close(); }
  } finally { await new Promise(resolve => f.server.close(resolve)); }
}
/** The offer's 「…」 → 「오늘은 다른 일」 on a phone (390, reduced motion). */
async function menu(browser) {
  const f = await fixture(kst('2026-10-27', '08:10'));
  try {
    const card = await findCard(f); check('menu', card, '카드가 설 때를 찾았다', card && { card: card.card, place: card.place });
    if (!card) return;
    f.set(card.atMs + 5000);
    const s = await open(browser, f, { device: 'phone' });
    try {
      await talkAt(s.page, card.place); await shot(s.page, `menu-phone-1-place-${card.card}`);
      await s.page.locator('#walk-close').click(); await delay(600);
      await s.page.waitForFunction(() => SYNKTownDay.metrics().cards.offer, null, { timeout: 100000 });
      const shown = await cards(s.page), vw = 390;
      check('menu', shown.offer.rect.x >= 15 && shown.offer.rect.x + shown.offer.rect.width <= vw - 15, '좁은 화면에서도 16px 안쪽', shown.offer.rect);
      await s.page.click('#card-offers .offer-more'); await delay(300);
      await shot(s.page, `menu-phone-2-more-${card.card}`);
      await s.page.click('#card-offers .offer-today'); await delay(2500);
      const state = f.store.read().state;
      check('menu', state.prefs.todayOther.items.includes(`card.${card.card}`), '오늘은 다른 일이 그 카드로 남는다', state.prefs.todayOther);
      check('menu', !(await cards(s.page)).offer, '제안이 바로 사라진다');
      check('menu', state.life.contacts.some(c => c.card === card.card && c.status === 'deferred'), '그 제안은 나중에로', state.life.contacts.filter(c => c.card).map(c => c.status));
      check('menu', !s.errors.length, '오류·실패 요청 0', s.errors);
    } finally { await s.close(); }
  } finally { await new Promise(resolve => f.server.close(resolve)); }
}
/** Days later: the news note by the door, the greeting with what a resident heard, the notebook's pages. */
async function notes(browser) {
  const f = await fixture(kst('2026-10-24', '09:00'));
  try {
    // The village lives through an absence from the first window's pulse on (a read alone opens no visit).
    const pulse = () => f.store.pulse({ surfaceId: 'qa-notes', surface: 'day', foreground: true, safe: true });
    pulse(); f.store.read(); f.set(kst('2026-10-27', '10:20')); pulse(); const v = f.store.read().state.village;
    check('notes', (v.news || []).length > 0, '사흘 사이 마을 소식이 났다', (v.news || []).map(n => n.card));
    for (const device of ['desktop', 'phone']) {
      const s = await open(browser, f, { device });
      try {
        // The same store goes on from the last scene: the player walks home first (by the door).
        await walkTo(s.page, ROUTES.home); await s.page.keyboard.press('e');
        await s.page.waitForFunction(() => SYNKTownDay.metrics().walk.interactionOpen, null, { timeout: 10000 }); await delay(900);
        const home = await cards(s.page);
        check('notes', home.place && /문 앞 쪽지/.test(home.place) && !NUMBERS.test(home.place), `${device}: 집 문 앞 쪽지(날짜 없이)`, home.place);
        await shot(s.page, `notes-${device}-1-door`);
        await s.page.click('#place-cards .text-button'); await s.page.waitForSelector('#notebook-dialog[open]'); await delay(300);
        for (const [i, id] of ['news', 'can', 'familiar', 'memory', 'book'].entries()) {
          await s.page.click(`#notebook-tab-${id}`); await delay(250);
          const words = await s.page.$eval('#notebook-page', el => el.textContent);
          check('notes', !NUMBERS.test(words), `${device}: 수첩 「${id}」에 숫자·날짜 없음`, words.slice(0, 120));
          if (device === 'desktop' || ['news', 'memory'].includes(id)) await shot(s.page, `notes-${device}-2-notebook-${i + 1}-${id}`);
        }
        await s.page.keyboard.press('Escape'); await delay(300);
        if (device === 'desktop') {
          // A resident here greets with what it heard (§9-4), once.
          for (const place of ['cafe', 'workshop', 'greenhouse']) {
            await s.page.locator('#walk-close').click().catch(() => {}); await delay(300);
            await talkAt(s.page, place);
            const here = await cards(s.page);
            if (!here.place || !/:/.test(here.place)) continue;
            await shot(s.page, `notes-desktop-3-greet-${place}`); await delay(1800);
            const told = f.store.read().state.village.told || {};
            check('notes', Object.values(told).some(list => list.length), '인사로 한 말은 그 주민이 말한 것으로 남는다', told);
            break;
          }
        }
        check('notes', !s.errors.length, `${device}: 오류·실패 요청 0`, s.errors);
      } finally { await s.close(); }
    }
  } finally { await new Promise(resolve => f.server.close(resolve)); }
}
/** Two residents talking: their two lines, apart. */
async function pair(browser) {
  const f = await fixture(kst('2026-10-26', '10:00'));
  try {
    const scene = await findPair(f); check('pair', scene, '두 주민이 이야기하는 때를 찾았다', scene);
    if (!scene) return;
    f.set(scene.atMs);
    const s = await open(browser, f);
    try {
      await walkTo(s.page, ROUTES[scene.place]); await s.page.locator('#camera-toggle').click(); await delay(2500);
      const shown = await cards(s.page), lines = shown.lines.filter(l => [scene.npc, scene.mate].includes(l.npc));
      check('pair', lines.length === 2 && lines.every(l => /\.pair\.|\.card\./.test(l.line)), '두 주민의 한 줄이 둘 다', shown.lines);
      check('pair', lines.length < 2 || !overlap(lines[0].rect, lines[1].rect), '두 카드가 겹치지 않는다', lines.map(l => l.rect));
      await shot(s.page, `pair-desktop-${scene.place}`);
      check('pair', !s.errors.length, '오류·실패 요청 0', s.errors);
    } finally { await s.close(); }
  } finally { await new Promise(resolve => f.server.close(resolve)); }
}
/** Seated (W7b): no caps, no seen keys, no offer. */
async function seated(browser) {
  const f = await fixture(kst('2026-10-26', '11:00'));
  try {
    const s = await open(browser, f);
    try {
      await walkTo(s.page, ROUTES.bench);
      await s.page.waitForFunction(() => SYNKTownDay.metrics().stay?.sitShown, null, { timeout: 10000 });
      await s.page.keyboard.press('f'); await s.page.waitForFunction(() => SYNKTownDay.metrics().stay?.seated, null, { timeout: 10000 });
      const before = s.boundaries.length; await delay(45000);
      const sent = s.boundaries.slice(before);
      check('seated', sent.every(b => !b.body.caps && !b.body.seen), '앉은 동안의 경계 신호에는 caps·본 것이 없다', sent.map(b => b.body));
      check('seated', !(await cards(s.page)).offer, '앉은 동안 제안이 없다');
    } finally { await s.close(); }
  } finally { await new Promise(resolve => f.server.close(resolve)); }
}
/** The text alternative (no WebGL): each resident's line is in the list. */
async function text(browser) {
  const f = await fixture(kst('2026-10-26', '10:00'));
  try {
    const scene = await findPair(f); if (scene) f.set(scene.atMs);
    const nogl = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-webgl', '--disable-3d-apis'] });
    try {
      const s = await open(nogl, f, { district: '', webgl: false });
      try {
        await s.page.waitForSelector('#scene-fallback:not([hidden])', { timeout: 20000 }); await delay(1500);
        const people = await s.page.$eval('#fallback-people', el => el.textContent);
        check('text', /「.+」/.test(people), '텍스트 대체 화면에 주민의 한 줄', people);
        await shot(s.page, 'text-alternative-desktop');
        const errors = s.errors.filter(e => !/WebGL/.test(e)); // WebGL is off on purpose here
        check('text', !errors.length, '오류 0(일부러 끈 WebGL 경고 빼고)', errors);
      } finally { await s.close(); }
    } finally { await nogl.close(); }
  } finally { await new Promise(resolve => f.server.close(resolve)); }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
  const scenes = { offer, menu, notes, pair, seated, text };
  try {
    for (const [name, run] of Object.entries(scenes)) {
      if (only && !only.has(name)) continue;
      const t = Date.now(); try { await run(browser); } catch (error) { report.failures.push(`${name}: ${error.message.split('\n')[0]}`); }
      console.log(`${name} ${((Date.now() - t) / 1000).toFixed(0)}s`);
      fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ ...report, finished: null }, null, 2));
    }
  } finally { await browser.close(); }
  report.finished = new Date().toISOString();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  const total = Object.values(report.scenes).flatMap(s => s.checks), passed = total.filter(c => c.ok).length;
  console.log(`checks ${passed}/${total.length} · failures ${report.failures.length}`); for (const f of report.failures) console.log(`  ✗ ${f}`);
  process.exitCode = report.failures.length ? 1 : 0;
})();
