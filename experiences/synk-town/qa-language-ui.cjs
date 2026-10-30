// The town's language on the screen QA (W9 — bridge design §3-3·§4-3, vertical slice design §12·§13-1·§20-3). Each scene runs
// its own store whose clock starts at a chosen Korean instant. The placement: a store under the preview's --placement suggests L3,
// the mascot's card asks 「처음 이야기는 이 말로 해 볼까요?」 with the first conversation's line in those words (no close, no
// picture, never reported drawn), opening the tea order before answering brings the card forward instead, and the answer opens
// the order in the chosen words. Widening: a world where the question stands draws the mascot's card (「나중에」 is its close),
// its drawn key rides a boundary, 「넓혀 볼래요」 moves the ladder; and end to end, five easy scenes then the tea order closed at
// the cafe ask the host (LANGUAGE_OFFER with the scene's format) and the card stands. The conversation C4 (Atlas — help buttons,
// the three turns) and the notebook's 「이야기 말」 are captured for the screen review. Captures at 1440 and 390.
//   node experiences/synk-town/qa-language-ui.cjs [--out <dir>] [--only placement,widen,offer,c4,first,notebook]
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const output = path.resolve(arg('--out', path.join(__dirname, '../../.tmp/town-w9-language')));
const only = arg('--only', '') ? new Set(arg('--only', '').split(',')) : null;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const kst = (date, time) => Date.parse(`${date}T${time}:00+09:00`);
const MIN = 60000;
const DEVICES = { desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: 'reduce' } };
const known404 = /avatar-textiles-v1/;
const report = { started: new Date().toISOString(), scenes: {}, failures: [] };
const check = (scene, ok, what, detail) => { (report.scenes[scene] ||= { checks: [] }).checks.push({ ok: !!ok, what, ...(detail === undefined ? {} : { detail }) }); if (!ok) report.failures.push(`${scene}: ${what}${detail === undefined ? '' : ` — ${JSON.stringify(detail).slice(0, 400)}`}`); };
const town = file => import(pathToFileURL(path.join(__dirname, file)).href);
const LEVEL_WORDS = /L[1-4]|[0-9０-９]|단계 [0-9]/;

async function fixture(startMs, { file = null, clock = null, placement = null } = {}) {
  const { createStore, createServer } = await town('server.mjs');
  const c = clock || { at: startMs, real: Date.now() }, now = () => c.at + (Date.now() - c.real);
  const store = createStore({ lifeEnabled: true, now, tz: 540, villageSeed: 'acct-w9', sleeps: true, ...(file ? { file } : {}), ...(placement ? { placement } : {}) });
  const server = createServer({ previewEnabled: true, store });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, store, clock: c, now, set: ms => { c.at = ms; c.real = Date.now(); }, base: `http://127.0.0.1:${server.address().port}`, stop: () => new Promise(resolve => server.close(resolve)) };
}
async function open(browser, f, { device = 'desktop' } = {}) {
  const context = await browser.newContext({ ...DEVICES[device] });
  const page = await context.newPage(), errors = [], boundaries = [], commands = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource|ERR_CONNECTION_REFUSED|Failed to fetch/.test(message.text())) errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400 && !known404.test(response.url()) && !/\/api\/preview\/(command|boundary)/.test(response.url())) errors.push(`${response.status()} ${response.url()}`); });
  page.on('request', request => {
    const url = request.url();
    if (url.endsWith('/api/preview/boundary') || url.endsWith('/api/preview/command')) { try { (url.endsWith('boundary') ? boundaries : commands).push({ at: Date.now(), body: JSON.parse(request.postData() || '{}') }); } catch {} }
  });
  await page.goto(`${f.base}/day.html?play=walk&district=townwide-merged`);
  await page.waitForFunction(() => globalThis.SYNKTownDay?.metrics()?.assetsReady && SYNKTownDay.metrics().walk?.enabled, null, { timeout: 120000 });
  await page.waitForFunction(() => { const b = SYNKTownDay.metrics().bakedDistrict; return b && (b.failed || b.loaded); }, null, { timeout: 180000 });
  await delay(1200);
  return { page, context, errors, boundaries, commands, close: () => context.close() };
}
const notices = page => page.evaluate(() => SYNKTownDay.metrics().notices);
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
const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
/** The card inside the window, off the joystick, the talk button and the status line; the page never scrolls sideways. */
async function cardFits(page) {
  return page.evaluate(() => {
    const card = document.getElementById('ask-card').getBoundingClientRect();
    const hud = ['walk-joystick', 'walk-interact', 'walk-status'].map(id => document.getElementById(id))
      .filter(el => el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width).map(el => ({ id: el.id, r: el.getBoundingClientRect().toJSON() }));
    return { card: card.toJSON(), inner: { w: innerWidth, h: innerHeight }, hud, wide: document.documentElement.scrollWidth > innerWidth + 1 || innerWidth > (visualViewport?.width ?? innerWidth) + 1 };
  });
}
function fitOk(fit) {
  const c = fit.card, box = { x: c.left, y: c.top, width: c.width, height: c.height };
  return c.top >= 0 && c.left >= 0 && c.right <= fit.inner.w + 1 && c.bottom <= fit.inner.h + 1 && !fit.wide
    && fit.hud.every(h => !overlap(box, { x: h.r.left, y: h.r.top, width: h.r.width, height: h.r.height }));
}
/** The world as saved in a one-file store: edit it and open a new store on it. */
function editWorld(file, edit) {
  const doc = JSON.parse(fs.readFileSync(file, 'utf8')), world = doc.state ?? doc.world ?? doc;
  edit(world); fs.writeFileSync(file, JSON.stringify(doc));
}
/** A world past its first visited life day: the one-file store saved after a window's first pulses, edited, then opened again. */
async function editedWorld(name, startMs, edit) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `qa-w9-${name}-`)), file = path.join(dir, 'town.json');
  const first = await fixture(startMs, { file });
  const pulse = () => first.store.pulse({ surfaceId: `qa-${name}`, surface: 'day', foreground: true, safe: true });
  pulse(); for (let i = 0; i < 5; i++) { first.set(first.now() + 1000); pulse(); } first.store.read();
  const clock = first.clock; await first.stop();
  const { initialLadder } = await town('town/language-ladder.mjs');
  editWorld(file, world => { world.languageLadder ||= initialLadder({ reading: 'L2', listening: 'L2' }, first.now()); world.townVisit = { ...world.townVisit, firstDay: world.village.band.lifeDay - 1 };
    edit(world, world.village.band.lifeDay); });
  const f = await fixture(null, { file, clock });
  const { PRESENCE_LEASE_MS } = await town('presence.mjs');
  f.set(f.now() + PRESENCE_LEASE_MS + 500);
  return f;
}
async function waitAsk(s, kind, timeout = 60000) {
  await s.page.waitForFunction(k => SYNKTownDay.metrics().notices.ask?.kind === k, kind, { timeout });
  await delay(400);
  return (await notices(s.page)).ask;
}
const orderOpen = page => page.evaluate(() => SYNKTownDay.snapshot()?.view?.tea?.open ?? null);

/** The placement before the first conversation: drawn, the order held behind it, answered (desktop 이대로 · phone 더 쉬운 말로). */
async function placement(browser) {
  for (const [device, answer, expected] of [['desktop', 'keep', 'L3'], ['phone', 'easier', 'L2']]) {
    const f = await fixture(kst('2026-10-28', '13:00'), { placement: { reading: 'L3', listening: 'L3' } });
    try {
      const s = await open(browser, f, { device });
      try {
        const ask = await waitAsk(s, 'placement');
        const words = await s.page.$eval('#ask-card', el => el.innerText);
        check('placement', ask.line === '처음 이야기는 이 말로 해 볼까요?' && words.includes('요즘 새 차를 만들고 있거든요. 손님한테 내기 전에 맛 좀 봐 줄래요?'), `${device}: 첫 대화 한 줄을 제안 판(L3) 말로 보인다`, words);
        check('placement', ask.close === null && ask.picture === false, `${device}: 닫기 없음 · 그림 없음(말만)`, ask);
        const first = await s.page.$eval('#ask-card .ask-actions .felt', el => ({ answer: el.dataset.answer, primary: el.classList.contains('primary'), text: el.textContent }));
        check('placement', first.answer === 'keep' && first.primary && first.text === '이대로', `${device}: 「이대로」가 먼저이고 기본 단추`, first);
        check('placement', !LEVEL_WORDS.test(words.replace(/[「」]/g, '')), `${device}: 판 이름·숫자 없음`, words);
        const fit = await cardFits(s.page); check('placement', fitOk(fit), `${device}: 카드가 창 안 · 조이스틱·이야기 단추·상태 줄을 덮지 않는다 · 가로 넘침 없음`, fit);
        await shot(s.page, `placement-${device}-1-card`);
        // The order asked for before the answer: the card comes forward instead (the order waits).
        await walkTo(s.page, ROUTES.cafe);
        await s.page.waitForFunction(() => SYNKTownDay.metrics().tea?.entry, null, { timeout: 10000 }).catch(() => {});
        await s.page.locator('#tea-open:visible, #tea-panel .felt:visible').first().click(); await delay(1500);
        const held = await notices(s.page), focus = await s.page.evaluate(() => document.activeElement?.dataset?.answer ?? null);
        check('placement', !(await orderOpen(s.page)) && held.placement.waiting && focus === 'keep', `${device}: 답 전에 주문을 누르면 열지 않고 카드로 초점`, { held: held.placement, focus });
        await shot(s.page, `placement-${device}-2-held`);
        await s.page.click(`#ask-card [data-answer="${answer}"]`);
        await s.page.waitForFunction(() => !!SYNKTownDay.snapshot()?.view?.tea?.open, null, { timeout: 15000 }).catch(() => {});
        const o = await orderOpen(s.page), ladder = f.store.peek().state.languageLadder;
        check('placement', o && o.level === expected, `${device}: 답하면 그 주문이 고른 말(${expected})로 열린다`, o && { level: o.level });
        check('placement', ladder.reading.stable === expected && ladder.reading.source === 'placement' && ladder.listening.stable === expected, `${device}: 사다리 두 자리가 고른 배치로`, ladder);
        check('placement', !(await notices(s.page)).ask, `${device}: 답한 카드는 거둬진다`);
        check('placement', !s.boundaries.some(b => b.body.asked === 'placement') && !s.commands.some(c => c.body.type === 'PLACEMENT'), `${device}: 배치는 그린 보고·마을 명령으로 가지 않는다`);
        await delay(800); await shot(s.page, `placement-${device}-3-order`);
        check('placement', !s.errors.length, `${device}: 오류·실패 요청 0`, s.errors);
      } finally { await s.close(); }
    } finally { await f.stop(); }
  }
}

/** The widening question standing: drawn, reported beside a boundary, answered 「넓혀 볼래요」 (desktop) or 「나중에」 (phone). */
async function widen(browser) {
  for (const [device, how] of [['desktop', 'accepted'], ['phone', 'later']]) {
    const f = await editedWorld(`widen-${device}`, kst('2026-10-28', '13:00'), (world, lifeDay) => {
      world.languageLadder.reading.lastOffer = { at: world.lifeHost?.lastForegroundAt ?? 1, answer: null, evidence: 5, day: lifeDay };
      world.asks = { lastLifeDay: null, asked: {}, open: { kind: 'widen', key: 'widen:reading:L3', lifeDay, delivered: false } };
    });
    try {
      const s = await open(browser, f, { device });
      try {
        const ask = await waitAsk(s, 'widen'), words = await s.page.$eval('#ask-card', el => el.innerText);
        check('widen', ask.line === '말을 조금 더 넓혀 볼까요?' && /다음 이야기부터 조금 더 긴 말로 해요/.test(words) && /「내 속도」의 「이야기 말」/.test(words), `${device}: 내 마스코트 카드에 넓히기 물음과 쉬운 설명 두 줄`, words);
        check('widen', ask.close === '나중에' && ask.picture === false && /몽글/.test(words), `${device}: 「나중에」가 닫기 · 마스코트 이름 · 그림 없음`, ask);
        const first = await s.page.$eval('#ask-card .ask-actions .felt', el => ({ answer: el.dataset.answer, primary: el.classList.contains('primary') }));
        check('widen', first.answer === 'accepted' && first.primary, `${device}: 「넓혀 볼래요」가 먼저`, first);
        check('widen', !LEVEL_WORDS.test(words), `${device}: 판 이름·숫자 없음`, words);
        const fit = await cardFits(s.page); check('widen', fitOk(fit), `${device}: 카드가 창 안 · 걷기 단추를 덮지 않는다 · 가로 넘침 없음`, fit);
        await shot(s.page, `widen-${device}-1-card`);
        await s.page.waitForFunction(() => !SYNKTownDay.metrics().notices.askReport && SYNKTownDay.metrics().notices.ask?.drawn, null, { timeout: 60000 }).catch(() => {});
        const told = s.boundaries.find(b => b.body.asked === 'widen:reading:L3'), saved = f.store.peek().state;
        check('widen', !!told && saved.asks.open?.delivered === true && saved.asks.lastLifeDay === saved.asks.open.lifeDay, `${device}: 그린 물음을 경계 옆에 보내 그날 물음으로 센다`, { told: !!told, asks: saved.asks });
        if (how === 'accepted') await s.page.click('#ask-card [data-answer="accepted"]');
        else await s.page.click('#ask-card .ask-close');
        await s.page.waitForFunction(() => !SYNKTownDay.metrics().notices.ask, null, { timeout: 10000 }).catch(() => {});
        const after = f.store.peek().state;
        if (how === 'accepted') check('widen', after.languageLadder.reading.stable === 'L3' && after.languageLadder.reading.source === 'offer' && after.asks.open === undefined, `${device}: 넓혀 볼래요 → 읽는 말 한 단계`, after.languageLadder.reading);
        else check('widen', after.asks.open === undefined && after.languageLadder.reading.lastOffer.answer === null && after.languageLadder.reading.stable === 'L2', `${device}: 나중에 → 물음만 닫힘(거절 아님)`, { asks: after.asks, reading: after.languageLadder.reading });
        check('widen', !(await notices(s.page)).ask, `${device}: 카드가 거둬진다`);
        await shot(s.page, `widen-${device}-2-after`);
        check('widen', !s.errors.length, `${device}: 오류·실패 요청 0`, s.errors);
      } finally { await s.close(); }
    } finally { await f.stop(); }
  }
}

/** End to end: five easy scenes on record, the tea order opened and stopped at the cafe → the host is asked with the scene's
 * format → the card stands. */
async function offer(browser) {
  const f = await editedWorld('offer', kst('2026-10-28', '13:00'), world => { world.languageLadder.reading.smoothStreak = 5; });
  try {
    const s = await open(browser, f);
    try {
      // The visit's first seconds pass before the mascot may ask (45, params asks.quietAfterVisitSeconds) — away from the cafe,
      // so no resident's card offer stands at the cafe when the scene ends (an offer standing is something the player is in).
      await s.page.waitForFunction(() => { const l = SYNKTownDay.snapshot()?.state?.life; return l && l.uMs - l.visitStartU >= 47000; }, null, { timeout: 90000 }).catch(() => {});
      await walkTo(s.page, ROUTES.cafe);
      await s.page.waitForFunction(() => SYNKTownDay.metrics().tea?.entry, null, { timeout: 10000 }).catch(() => {});
      check('offer', (await s.page.evaluate(() => SYNKTownDay.snapshot().view.language.askReady)) === true, '오늘 물을 수 있다(askReady)');
      await s.page.locator('#tea-open:visible, #tea-panel .felt:visible').first().click();
      await s.page.waitForFunction(() => !!SYNKTownDay.snapshot()?.view?.tea?.open, null, { timeout: 15000 });
      await delay(800);
      await s.page.locator('.tea-stop:visible').first().click();
      await s.page.waitForFunction(() => !SYNKTownDay.snapshot()?.view?.tea?.open, null, { timeout: 15000 }).catch(() => {});
      const asked = await waitAsk(s, 'widen', 20000).catch(() => null);
      const sent = s.commands.find(c => c.body.type === 'LANGUAGE_OFFER'), saved = f.store.peek().state;
      check('offer', sent?.body.payload.format === 'cup-compose', '찻집 주문이 끝나면 끝난 장면의 꼴(cup-compose)로 묻는다', sent?.body.payload);
      check('offer', asked?.key === 'widen:reading:L3' && saved.asks.open?.kind === 'widen', '넓히기 물음이 서고 카드로 그려진다', { asked, asks: saved.asks, life: saved.life?.contacts?.map(c => c.status) });
      if (asked) await shot(s.page, 'offer-desktop-1-card');
      check('offer', !s.errors.length, '오류·실패 요청 0', s.errors);
    } finally { await s.close(); }
  } finally { await f.stop(); }
}

/** A while the cafe owner stands at one place the walk reaches — from a minute after now (the page opens) for eight minutes
 * (the talk) — the clock moved to its start in ten-minute steps. null: none in three days. */
async function ownerStays(f, village) {
  for (let step = 0; step < 432; step++) {
    const v = f.store.read().state.village, out = village.planOf(v), t = f.now();
    const start = Object.fromEntries(Object.entries(v.band.residents).map(([npc, r]) => [npc, r.lastSpot]).filter(([, at]) => at));
    const a = village.placeAt(out.segments, 'cafe-owner', t + MIN, start), b = village.placeAt(out.segments, 'cafe-owner', t + 8 * MIN, start);
    if (a && b && !a.walking && !b.walking && a.to === b.to && Object.hasOwn(ROUTES, a.to)) return { place: a.to, at: new Date(t).toISOString() };
    f.set(t + 10 * MIN);
  }
  return null;
}
const firstRise = (f, village) => village.planOf(f.store.peek().state.village).log.find(e => e.card === 'C4') ?? null;
/** The new tea's talk to its end: the first choice of each turn, then 「이렇게 할게요」. */
async function talkToEnd(page) {
  for (let turn = 0; turn < 5; turn++) {
    const choice = page.locator('#card-choices button').first();
    if (!(await choice.count()) || !(await choice.isVisible())) break;
    await choice.click(); await page.waitForFunction(() => !document.querySelector('#card-confirm').disabled, null, { timeout: 8000 }).catch(() => {});
    await page.click('#card-confirm'); await delay(900);
  }
}
/** C4's first, end to end (§8-4 · §12, 10-30 first-C4 fix): a new world; the player walks to the cafe owner (no talk) — the card
 * rises then; her offer comes within the first-word budget; 「같이 해요」 brings the placement card first (W9's first-scene door);
 * the answer opens the talk; to its end → dialogue.closed (desktop). The phone lets the offer pass: the card still waits, the
 * notebook's 「할 수 있는 생활」 lists it, a talk to her (E) shows 「같이 해요」 in the place's panel, 「그만할래요」 leaves it 「하던 생활」
 * and 「이어서 하기」 takes it to its end. */
async function first(browser) {
  const village = await town('town/village.mjs');
  for (const device of ['desktop', 'phone']) {
    const f = await fixture(kst('2026-10-28', '11:30'), device === 'desktop' ? { placement: { reading: 'L3', listening: 'L3' } } : {});
    try {
      const stays = await ownerStays(f, village);
      check('first', !!stays, `${device}: 찻집 주인이 머무는 때와 자리`, stays);
      if (!stays) continue;
      const s = await open(browser, f, { device });
      try {
        check('first', !firstRise(f, village), `${device}: 집에 있는 동안은 C4가 없다`);
        await walkTo(s.page, ROUTES[stays.place]);
        await s.page.waitForFunction(p => SYNKTownDay.metrics().walk.nearby === p, stays.place, { timeout: 8000 });
        await delay(1500);
        const rise = firstRise(f, village), saved = f.store.peek().state.village;
        check('first', rise?.first === true && saved.playerStays?.at(-1)?.place === stays.place, `${device}: 걸어서 주인 곁에 가자(말 걸기 전) 첫 C4가 섰다`, { rise, stays: saved.playerStays });
        // A talk to her (E) opens the place's panel with 「같이 해요」; Esc closes it so her own offer may come (the panel holds
        // offers back, W5b — the W5 offer scene's order). Play time counts only while the walking window has the focus.
        await talkAt(s.page, stays.place);
        const panel = s.page.locator('#place-cards .place-need .felt').first();
        check('first', await panel.count() > 0 && /같이 해요/.test(await panel.textContent()), `${device}: 주인에게 먼저 말을 걸면 장소 판에 「같이 해요」`, await panel.count() ? await panel.textContent() : null);
        await s.page.keyboard.press('Escape'); await delay(600); await s.page.bringToFront();
        // The offer within the first-word budget (45 s of play). A placement card already standing (the first-scene door, W9)
        // is answered first — what the screen does with it is the placement scene's; here it only must not keep the offer away.
        let offered = null, placedFirst = false;
        for (const end = Date.now() + 150000; Date.now() < end && !offered;) {
          offered = await s.page.evaluate(() => SYNKTownDay.metrics().cards.offer);
          if (!offered && device === 'desktop' && !placedFirst && (await notices(s.page)).ask?.kind === 'placement') {
            await shot(s.page, 'first-desktop-0-placement-before'); await s.page.click('#ask-card [data-answer="keep"]'); placedFirst = true;
          }
          if (!offered) await delay(2000);
        }
        if (!offered) {
          const st = f.store.peek().state, c4 = f.store.read().view.day.scene.village.cards.find(c => c.card === 'C4');
          check('first', false, `${device}: 제안이 오지 않았다`, { contacts: st.life.contacts, u: st.life.uMs - st.life.visitStartU, c4, location: st.day.location, walk: await walkPoint(s.page), notices: await notices(s.page) });
          continue;
        }
        check('first', /새 차/.test(offered.text), `${device}: 찻집 주인이 먼저 건넨다(예산 안)`, offered);
        await delay(400); await shot(s.page, `first-${device}-1-offer`);
        if (device === 'desktop') {
          await s.page.click('#card-offers .offer-accept');
          if (!placedFirst) {
            const ask = await waitAsk(s, 'placement', 15000);
            check('first', ask?.line === '처음 이야기는 이 말로 해 볼까요?', 'desktop: 「같이 해요」 → 배치 카드가 먼저(첫 장면 문)', ask);
            await shot(s.page, 'first-desktop-2-placement');
            await s.page.click('#ask-card [data-answer="keep"]');
          }
          await s.page.waitForSelector('#card-dialog[open]', { timeout: 15000 }); await delay(700);
          const line = await s.page.$eval('#card-line', el => el.textContent);
          check('first', /새 차/.test(line), 'desktop: 답하면 대화가 고른 말로 열린다', line);
          await shot(s.page, 'first-desktop-3-talk');
          await talkToEnd(s.page);
          await shot(s.page, 'first-desktop-4-end');
        } else {
          // Passed: twenty seconds with no answer and the offer goes — the card waits.
          await s.page.waitForFunction(() => !SYNKTownDay.metrics().cards.offer, null, { timeout: 40000 });
          const c4 = f.store.read().view.day.scene.village.cards.find(c => c.card === 'C4');
          check('first', c4?.status === 'triggered', 'phone: 제안을 지나쳐도 카드는 기다린다', c4);
          await s.page.click('#journal-open'); await s.page.waitForSelector('#notebook-dialog[open]');
          await s.page.click('#notebook-tab-can'); await delay(500);
          const can = await s.page.$eval('#notebook-page', el => el.innerText);
          check('first', /새 차 맛 좀 봐 줄래요\?/.test(can) && /말을 걸면/.test(can), 'phone: 수첩 「할 수 있는 생활」에 남는다', can);
          await shot(s.page, 'first-phone-2-notebook');
          await s.page.click('#notebook-close'); await delay(400);
          await talkAt(s.page, stays.place);
          const go = s.page.locator('#place-cards .place-need .felt').first();
          await go.waitFor({ timeout: 10000 });
          check('first', /같이 해요/.test(await go.textContent()), 'phone: 주인에게 먼저 말을 걸면 장소 판에 「같이 해요」', await go.textContent());
          await shot(s.page, 'first-phone-3-talk-first');
          await go.click(); await s.page.waitForSelector('#card-dialog[open]', { timeout: 15000 }); await delay(600);
          await s.page.click('#card-close'); await delay(900);
          const paused = f.store.peek().state.village.takes.find(t => t.card === 'C4');
          check('first', paused?.status === 'paused', 'phone: 「그만할래요」 → 하던 생활', paused && { status: paused.status });
          await talkAt(s.page, stays.place);
          const again = s.page.locator('#place-cards .place-need .felt').first();
          await again.waitFor({ timeout: 10000 });
          check('first', /이어서 하기/.test(await again.textContent()), 'phone: 다시 말을 걸면 「이어서 하기」', await again.textContent());
          await again.click(); await s.page.waitForSelector('#card-dialog[open]', { timeout: 15000 }); await delay(600);
          await talkToEnd(s.page);
          await shot(s.page, 'first-phone-4-end');
        }
        const saved2 = f.store.peek().state, take = saved2.village.takes.find(t => t.card === 'C4');
        const closed = (saved2.townEvents || []).filter(e => e.kind === 'dialogue.closed');
        check('first', take?.status === 'resolved' && closed.some(e => e.outcome !== 'stopped'), `${device}: 대화 끝 → 플레이어와 풀림 · dialogue.closed`, { take: take?.status, closed: closed.map(e => e.outcome) });
        const fit = await s.page.evaluate(() => ({ wide: document.documentElement.scrollWidth > innerWidth + 1 }));
        check('first', !fit.wide, `${device}: 가로 넘침 없음`);
        check('first', !s.errors.length, `${device}: 오류·실패 요청 0`, s.errors);
      } finally { await s.close(); }
    } finally { await f.stop(); }
  }
}

/** C4's conversation (Atlas, §12): the panel's 「같이 해요」, the line with its three asks, 「무슨 뜻이에요?」, then the turns to the end. */
async function c4(browser) {
  const village = await town('town/village.mjs');
  for (const device of ['desktop', 'phone']) {
    const f = await fixture(kst('2026-10-28', '07:30'));
    try {
      // C4's first rises the moment the player stays where the cafe owner is (§8-4, 10-30): find a while she stands at a place
      // the walk reaches, from a little after the page opens until the talk is done.
      const rise = await ownerStays(f, village);
      check('c4', !!rise, `${device}: 찻집 주인이 머무는 때와 자리를 찾았다`, rise);
      if (!rise) continue;
      const s = await open(browser, f, { device });
      try {
        await talkAt(s.page, rise.place);
        check('c4', firstRise(f, village)?.first === true, `${device}: 주인 곁에 가자 첫 C4가 섰다`, firstRise(f, village));
        const go = s.page.locator('#place-cards .place-need .felt').first();
        await go.waitFor({ timeout: 10000 }); await go.click();
        await s.page.waitForSelector('#card-dialog[open]', { timeout: 10000 }); await delay(700);
        const help = await s.page.$$eval('#card-dialog-help button', bs => bs.map(b => b.textContent));
        check('c4', help.join() === '다시 말해 주세요,천천히 말해 주세요,무슨 뜻이에요?', `${device}: 되묻기 단추 셋`, help);
        const line = await s.page.$eval('#card-line', el => el.textContent);
        check('c4', /새 차/.test(line), `${device}: 첫 줄`, line);
        await shot(s.page, `c4-${device}-1-line`);
        await s.page.click('#card-dialog-help button:nth-child(3)'); await delay(700);
        check('c4', (await s.page.$eval('#card-line', el => el.textContent)) !== line || await s.page.$('#card-line span') !== null, `${device}: 「무슨 뜻이에요?」 → 그 줄이 쉬워진다`, await s.page.$eval('#card-line', el => el.textContent));
        await shot(s.page, `c4-${device}-2-meaning`);
        // The keyboard stays on an ask (W9 screen review A1 · B1): Enter twice asks twice and never closes the talk.
        await s.page.focus('#card-dialog-help button:nth-child(1)'); await s.page.keyboard.press('Enter'); await delay(800); await s.page.keyboard.press('Enter'); await delay(800);
        const asked = await s.page.evaluate(() => ({ open: !!document.querySelector('#card-dialog[open]'), help: document.activeElement?.dataset?.help ?? null, text: document.activeElement?.textContent ?? null }));
        check('c4', asked.open && asked.help === 'repeat', `${device}: 되묻기를 키보드로 두 번 → 초점이 그 단추 · 대화 그대로`, asked);
        for (let turn = 0; turn < 4; turn++) {
          const choice = s.page.locator('#card-choices button').first();
          if (!(await choice.count()) || !(await choice.isVisible())) break;
          await choice.click(); await s.page.waitForFunction(() => !document.querySelector('#card-confirm').disabled, null, { timeout: 8000 }).catch(() => {});
          if (turn > 0) { await s.page.click('#card-confirm'); await delay(900); continue; }
          // 「이렇게 할게요」 by the keyboard: the next turn's first choice has it (W9 F4), not 「그만할래요」.
          await s.page.focus('#card-confirm'); await s.page.keyboard.press('Enter'); await delay(900);
          const next = await s.page.evaluate(() => ({ open: !!document.querySelector('#card-dialog[open]'), choice: document.activeElement?.dataset?.choice ?? null, text: document.activeElement?.textContent ?? null }));
          check('c4', next.open && !!next.choice, `${device}: 「이렇게 할게요」를 키보드로 → 초점이 다음 차례 고르기`, next);
        }
        await shot(s.page, `c4-${device}-3-end`);
        const closed = (f.store.peek().state.townEvents || []).find(e => e.kind === 'dialogue.closed');
        check('c4', !closed || closed.paramsVer && closed.arm, `${device}: 장면 닫힘에 판·회차`, closed);
        const fit = await s.page.$eval('#card-dialog', el => { const r = el.getBoundingClientRect(); return { r: r.toJSON(), w: innerWidth, h: innerHeight, wide: document.documentElement.scrollWidth > innerWidth + 1 }; });
        check('c4', fit.r.left >= 0 && fit.r.right <= fit.w + 1 && !fit.wide, `${device}: 대화 상자가 창 안 · 가로 넘침 없음`, fit);
        check('c4', !s.errors.length, `${device}: 오류·실패 요청 0`, s.errors);
      } finally { await s.close(); }
    } finally { await f.stop(); }
  }
}

/** The notebook's 「이야기 말」 (Atlas): two seats, four choices; 「한 단계 쉽게」 fixes the seat and says so. */
async function notebook(browser) {
  for (const device of ['desktop', 'phone']) {
    const f = await fixture(kst('2026-10-28', '13:00'));
    try {
      const s = await open(browser, f, { device });
      try {
        await s.page.click('#settings-open'); await s.page.waitForSelector('#settings-dialog[open]');
        const field = s.page.locator('#settings-dialog fieldset', { hasText: '이야기 말' });
        await field.scrollIntoViewIfNeeded(); await delay(300);
        const text = await field.innerText();
        check('notebook', /읽는 말/.test(text) && /듣는 말/.test(text) && /알아서 맞춰 주세요/.test(text), `${device}: 이야기 말 — 두 자리 · 네 고르기`, text);
        await shot(s.page, `notebook-${device}-1-language`);
        await field.getByRole('button', { name: '한 단계 쉽게' }).first().click(); await delay(900);
        const after = await field.innerText(), seat = f.store.peek().state.languageLadder.reading;
        check('notebook', /내가 고른 말로 이어 가요/.test(after) && seat.fixed && seat.source === 'self', `${device}: 한 단계 쉽게 → 내가 고른 말로(고정)`, { after, seat });
        const wide = await s.page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        check('notebook', !wide, `${device}: 가로 넘침 없음`);
        await shot(s.page, `notebook-${device}-2-fixed`);
        check('notebook', !s.errors.length, `${device}: 오류·실패 요청 0`, s.errors);
      } finally { await s.close(); }
    } finally { await f.stop(); }
  }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
  const scenes = { placement, widen, offer, c4, first, notebook };
  try {
    for (const [name, run] of Object.entries(scenes)) {
      if (only && !only.has(name)) continue;
      const t = Date.now(); try { await run(browser); } catch (error) { report.failures.push(`${name}: ${error.message.split('\n')[0]}`); }
      (report.scenes[name] ||= { checks: [] }).seconds = Math.round((Date.now() - t) / 1000);
    }
  } finally { await browser.close(); }
  report.finished = new Date().toISOString();
  const all = Object.values(report.scenes).flatMap(s => s.checks);
  report.summary = { checks: all.length, passed: all.filter(c => c.ok).length, failures: report.failures.length };
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary), report.failures.length ? `\n${report.failures.join('\n')}` : '');
  process.exitCode = report.failures.length ? 1 : 0;
})();
