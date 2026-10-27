// The tea order on the town screen QA (W8, vertical slice design §11 · §22). Each scene runs its own memory store whose clock
// starts at a chosen Korean instant (the village plan is the server's own). It checks, with the keyboard, a touch phone and a
// gamepad stub: 「주문 같이 받기」 → the guests' words one at a time (다시 말해 주세요 underlines, 천천히 shows a group at a time)
// → 「네, 알겠어요」 → a cup made by hand (cup, tea, honey, 「다 됐어요」) with a sound at each press → carried and served →
// a cup the guest wants changed comes back with no sound, one axis said → fixed and served (「딱 좋아요」) → the owner asked →
// the result's 「다음 손님」 · 「오늘은 여기까지」 · 「…」; 「간단히 만들기」 on a phone with reduced motion; card C5's offer only
// with caps tea and its order bound to the card; no sound while a microphone is open; no numbers on the board (G2); console
// errors 0. Captures at 1440 and 390. Samples: every hand sound and one cup's flow, rendered offline from the same scores
// (day-sfx.mjs) as MP3 for Yuho's ear check, with their peak, K-weighted momentary loudness and length.
//   node experiences/synk-town/qa-tea-ui.cjs [--out <dir>] [--only order,simple,pad,card,one-cup,one-cup-simple,mic,samples]
const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const output = path.resolve(arg('--out', path.join(__dirname, '../../.tmp/town-w8-tea')));
const only = arg('--only', '') ? new Set(arg('--only', '').split(',')) : null;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const kst = (date, time) => Date.parse(`${date}T${time}:00+09:00`);
const MIN = 60000, HOUR = 60 * MIN;
const DEVICES = { desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: 'reduce' } };
const known404 = /avatar-textiles-v1/;
const report = { started: new Date().toISOString(), scenes: {}, failures: [] };
const check = (scene, ok, what, detail) => { (report.scenes[scene] ||= { checks: [] }).checks.push({ ok: !!ok, what, ...(detail === undefined ? {} : { detail }) }); if (!ok) report.failures.push(`${scene}: ${what}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`); };
const town = file => import(pathToFileURL(path.join(__dirname, file)).href);
const NUMBERS = /[0-9０-９]|번째|일째|연속|시간|분 /;

async function fixture(startMs, seed = 'synk-town') {
  const { createStore, createServer } = await town('server.mjs');
  const clock = { at: startMs, real: Date.now() }, now = () => clock.at + (Date.now() - clock.real);
  const store = createStore({ lifeEnabled: true, now, tz: 540, villageSeed: seed, sleeps: true });
  const server = createServer({ previewEnabled: true, store });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, store, clock, now, set: ms => { clock.at = ms; clock.real = Date.now(); }, base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}
async function open(browser, f, { device = 'desktop', init = null } = {}) {
  const context = await browser.newContext({ ...DEVICES[device] });
  if (init) await context.addInitScript(init);
  const page = await context.newPage(), errors = [], boundaries = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource|ERR_CONNECTION_REFUSED|Failed to fetch/.test(message.text())) errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400 && !known404.test(response.url()) && !/\/api\/preview\/(command|boundary)/.test(response.url())) errors.push(`${response.status()} ${response.url()}`); });
  page.on('request', request => { if (request.url().endsWith('/api/preview/boundary')) { try { boundaries.push(JSON.parse(request.postData() || '{}')); } catch {} } });
  await page.goto(`${f.base}/day.html?play=walk&district=townwide-merged`);
  await page.waitForFunction(() => globalThis.SYNKTownDay?.metrics()?.assetsReady && SYNKTownDay.metrics().walk?.enabled, null, { timeout: 120000 });
  await page.waitForFunction(() => { const b = SYNKTownDay.metrics().bakedDistrict; return b && (b.failed || b.loaded); }, null, { timeout: 180000 });
  await delay(1200);
  return { page, context, errors, boundaries, close: () => context.close() };
}
const tea = page => page.evaluate(() => SYNKTownDay.metrics().tea);
const order = page => page.evaluate(() => SYNKTownDay.snapshot()?.view?.tea?.open ?? null);
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
// The greenhouse lies behind the row of houses (walk.mjs back walls at z −2): round by the gap between the cafe and the workshop.
const ROUTES = { cafe: [['z', 3.9], ['x', 0], ['z', 2.6]], greenhouse: [['z', 3.9], ['x', 3], ['z', -4.2], ['x', 0]], cafeFromGreenhouse: [['x', 3], ['z', 3.9], ['x', 0], ['z', 2.6]] };
const shot = (page, name) => page.screenshot({ path: path.join(output, `${name}.jpg`), type: 'jpeg', quality: 82 });
const cupFor = request => ({ vessel: request.temp ?? 'warm', tea: request.tea ?? 'barley', honey: request.sweet ?? 1 });
function missOne(request) {
  const cup = cupFor(request);
  if (request.tea) return { cup: { ...cup, tea: request.tea === 'barley' ? 'yuzu' : 'barley' }, axis: 'tea' };
  if (request.temp) return { cup: { ...cup, vessel: request.temp === 'warm' ? 'cold' : 'warm' }, axis: 'temp' };
  return { cup: { ...cup, honey: request.sweet === 2 ? 0 : 2 }, axis: 'sweet' };
}
const JAR = { barley: '3', yuzu: '4', today: '5' }, CUP = { warm: '1', cold: '2' };
/** Makes a cup on the board with the keys (from an empty board, or turning the one there to this cup). */
async function makeWithKeys(page, cup) {
  await page.locator('#tea-board').focus();
  const now = (await tea(page)).board;
  if (now.vessel !== cup.vessel) await page.keyboard.press(CUP[cup.vessel]);
  if (now.tea !== cup.tea) await page.keyboard.press(JAR[cup.tea]);
  for (let i = 0, h = now.honey; i < 3 && h !== cup.honey; i++) { await page.keyboard.press('h'); h = (h + 1) % 3; }
  await delay(150);
  await page.keyboard.press('Enter'); await delay(200);
}
async function waitTea(page, test, arg, timeout = 8000) { await page.waitForFunction(test, arg, { timeout }); await delay(250); }
async function startOrder(page, scene) {
  await walkTo(page, ROUTES.cafe);
  await page.waitForFunction(() => SYNKTownDay.metrics().tea?.entry, null, { timeout: 10000 }).catch(() => {});
  const m = await tea(page); check(scene, m?.entry, '찻집 앞에서 「주문 같이 받기」가 보인다', m);
  await page.locator('#tea-open:visible, #tea-panel .felt:visible').first().click();
  await waitTea(page, () => SYNKTownDay.metrics().tea?.order && SYNKTownDay.metrics().tea.bubbles.length > 0);
}

/** The whole order with the keyboard on a desktop: listening, a cup made by hand, one changed, the owner, the result. */
async function orderScene(browser) {
  const scene = 'order', f = await fixture(kst('2026-10-28', '13:00'));
  const s = await open(browser, f);
  try {
    const { page } = s;
    await startOrder(page, scene);
    let o = await order(page), m = await tea(page);
    check(scene, o?.kind === 'order' && o.guests.length === 2, '주문이 열리고 손님이 둘이다', o && { kind: o.kind, guests: o.guests.map(g => [g.slot, g.who, g.request]) });
    check(scene, m.bubbles.join() === 'a', '손님 말은 한 사람씩 — 앞 손님 먼저', m.bubbles);
    await shot(page, 'tea-listen-1440');
    const bubble = page.locator('.tea-bubble[data-slot="a"]');
    const said = await bubble.locator('.tea-words').innerText();
    check(scene, said.length > 4 && !NUMBERS.test(said), '앞 손님의 요청 글(숫자 없음)', said);
    await bubble.getByRole('button', { name: '다시 말해 주세요' }).click(); await delay(200);
    check(scene, await bubble.locator('u').count() > 0, '「다시 말해 주세요」는 핵심 낱말에 밑줄', await bubble.locator('.tea-words').innerHTML());
    await bubble.getByRole('button', { name: '천천히 말해 주세요' }).click(); await delay(200);
    const slow = await bubble.locator('.tea-words').innerText();
    check(scene, slow.length < said.length + 3 && await bubble.getByRole('button', { name: '다음 말' }).count() === 1, '「천천히」는 어절 묶음씩 — 누를 때마다 다음', slow);
    const focusKey = () => page.evaluate(() => document.activeElement?.dataset?.focus ?? document.activeElement?.tagName);
    check(scene, await focusKey() === 'a:ask:slower', '다시 그려도 누른 단추에 초점이 남는다(「다음 말」, 검수 A3)', await focusKey());
    await bubble.getByRole('button', { name: '네, 알겠어요' }).click();
    await waitTea(page, () => SYNKTownDay.metrics().tea.bubbles.join() === 'b');
    check(scene, await focusKey() === 'b:heard', '앞 손님 말을 접으면 초점이 뒤 손님의 「네, 알겠어요」로(검수 A3)', await focusKey());
    await page.locator('.tea-bubble[data-slot="b"]').getByRole('button', { name: '네, 알겠어요' }).click();
    await waitTea(page, () => SYNKTownDay.metrics().tea.phase === 'make');
    m = await tea(page); check(scene, m.boardShown && !m.bubbles.length, '둘 다 들으면 판으로 — 말풍선은 쪽지로 접힌다', m);
    // A cup the guest asked otherwise: made by hand with a sound at each press.
    const a = o.guests[0], miss = missOne(a.request), before = (await tea(page)).sounds.length;
    await makeWithKeys(page, miss.cup);
    m = await tea(page);
    const made = m.sounds.slice(before);
    check(scene, made.includes('cup') && made.includes('pour') && made.includes('done'), '누를 때마다 소리(잔·따르기·다 됐어요)', made);
    check(scene, m.tray.some(Boolean) && !m.board.vessel, '「다 됐어요」 → 쟁반으로', { tray: m.tray, board: m.board });
    await shot(page, 'tea-made-1440');
    await page.keyboard.press('6'); await delay(200);
    m = await tea(page); check(scene, m.chip && m.hand === 0, '쟁반 잔을 들면 손 칩', m);
    // Folded with a cup in hand: 「차 만들기 펼치기」 stays reachable and T opens the board again (screen review F1).
    await page.locator('#tea-board .tea-fold').click(); await delay(300);
    const reach = await page.evaluate(() => { const u = document.querySelector('.tea-unfold'), r = u.getBoundingClientRect(), top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !u.hidden && (top === u || u.contains(top)); });
    await page.keyboard.press('t'); await delay(300);
    check(scene, reach && !(await tea(page)).folded, '잔을 든 채 접어도 펼치기 단추가 가려지지 않고 T로 다시 펼친다(검수 F1)', { reach });
    const quiet = (await tea(page)).sounds.length;
    await page.locator('#tea-hand').getByRole('button', { name: /앞 손님에게 내기|단골손님에게 내기/ }).click();
    await waitTea(page, () => SYNKTownDay.snapshot().view.tea.open?.guests[0].tries === 1, null, 10000);
    await delay(700);
    o = await order(page); m = await tea(page);
    check(scene, !o.guests[0].done && o.guests[0].react?.axis === miss.axis, '다르면 손님은 기다리고 다른 축 하나만 말한다', o.guests[0].react);
    check(scene, m.sounds.slice(quiet).join() === 'serve', '조금 달라요에는 소리가 없다(내려놓기 소리만)', m.sounds.slice(quiet));
    check(scene, m.board.vessel === miss.cup.vessel && m.board.tea === miss.cup.tea, '그 잔이 그대로 판으로 돌아온다', m.board);
    const react = await page.locator('.tea-bubble.tea-react').first().innerText().catch(() => '');
    check(scene, react && !NUMBERS.test(react), '반응 한마디가 말풍선으로', react);
    await shot(page, 'tea-react-1440');
    // That axis only, fixed and served: 「딱 좋아요」.
    await makeWithKeys(page, cupFor(a.request)); await page.keyboard.press('6'); await delay(200);
    const pleasedFrom = (await tea(page)).sounds.length;
    await page.locator('#tea-hand').getByRole('button', { name: /앞 손님에게 내기|단골손님에게 내기/ }).click();
    await waitTea(page, () => !!SYNKTownDay.snapshot().view.tea.open?.guests[0].done, null, 10000); await delay(800);
    m = await tea(page); check(scene, m.sounds.slice(pleasedFrom).includes('match'), '맞으면 「딱 좋아요」 두 음', m.sounds.slice(pleasedFrom));
    // The guest behind, given to the owner (any time — review F3).
    await page.locator('.tea-note[data-slot="b"]').click(); await delay(250);
    await page.locator('.tea-bubble[data-slot="b"]').getByRole('button', { name: '주인에게 부탁하기' }).click();
    await waitTea(page, () => SYNKTownDay.snapshot().view.tea.open?.done === true, null, 10000);
    const result = await page.locator('.tea-result').innerText();
    check(scene, /다음 손님/.test(result) && /오늘은 여기까지/.test(result), '결과: 「다음 손님」 · 「오늘은 여기까지」', result);
    await page.locator('.tea-result .feedback-more').click(); await page.locator('.tea-result').getByRole('button', { name: '좋았어요' }).click();
    await page.waitForFunction(() => (SYNKTownDay.snapshot().state.prefs?.feedback || []).some(x => x.canonicalActivityId === 'tea-order'), null, { timeout: 8000 }).then(() => check(scene, true, '「…」 응답이 그날 함께한 일에 남는다'), e => check(scene, false, '「…」 응답이 그날 함께한 일에 남는다', e.message));
    await shot(page, 'tea-result-1440');
    const boardText = await page.locator('#tea-board').innerText();
    check(scene, !NUMBERS.test(boardText), '판 글에 숫자·시간 말 없음(G2)', boardText);
    await page.locator('.tea-result').getByRole('button', { name: '오늘은 여기까지' }).click();
    await waitTea(page, () => !SYNKTownDay.snapshot().view.tea.open);
    m = await tea(page); check(scene, !m.boardShown && !m.order, '닫으면 판이 내려간다', m);
    check(scene, s.errors.length === 0, '콘솔 오류 0', s.errors);
  } finally { await s.close(); await f.close(); }
}

/** 「간단히 만들기」 on a phone with reduced motion (its first value there): pick a finished cup per guest. */
async function simpleScene(browser) {
  const scene = 'simple', f = await fixture(kst('2026-10-28', '15:00'));
  const s = await open(browser, f, { device: 'phone' });
  try {
    const { page } = s;
    await startOrder(page, scene);
    await shot(page, 'tea-listen-390');
    for (const slot of ['a', 'b']) { await page.locator(`.tea-bubble[data-slot="${slot}"]`).getByRole('button', { name: '네, 알겠어요' }).click(); await delay(300); }
    const m = await tea(page); check(scene, m.simple === true, '움직임 줄이기 기기는 간단히 만들기가 처음 켜져 있다', m.simple);
    const box = await page.locator('#tea-board').boundingBox();
    check(scene, box && box.x >= 0 && box.x + box.width <= 390.5, '판이 휴대폰 폭 안에', box);
    await shot(page, 'tea-simple-390');
    const { previewCups } = await town('town/activities/tea-order.mjs');
    const o = await order(page);
    for (const [i, g] of o.guests.entries()) {
      const cups = previewCups(o, g), want = cups.findIndex(c => (g.request.tea === undefined || c.tea === g.request.tea) && (g.request.temp === undefined || c.vessel === g.request.temp) && (g.request.sweet === undefined || c.honey === g.request.sweet));
      const row = page.locator('.tea-simple-row').nth(0);
      await row.locator('.tea-simple-cup').nth(want).click(); await row.getByRole('button', { name: '이대로 낼게요' }).click();
      await waitTea(page, idx => !!SYNKTownDay.snapshot().view.tea.open?.guests[idx].done, i, 10000);
      check(scene, true, `${i ? '뒤' : '앞'} 손님에게 고른 잔을 냈다`);
    }
    await waitTea(page, () => SYNKTownDay.snapshot().view.tea.open?.done === true);
    await shot(page, 'tea-result-390');
    check(scene, s.errors.length === 0, '콘솔 오류 0', s.errors);
  } finally { await s.close(); await f.close(); }
}

/** A gamepad (a stub behind navigator.getGamepads): B folds the words, LB a warm cup, RB a jar, Y honey, A 「다 됐어요」,
 * RT the tray's cup, A by the guest serves (review F7). */
async function padScene(browser) {
  const scene = 'pad', f = await fixture(kst('2026-10-29', '13:30'));
  const s = await open(browser, f);
  try {
    const { page } = s;
    await walkTo(page, ROUTES.cafe);
    await page.evaluate(() => { const pad = { id: 'qa pad', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
      globalThis.__qaPad = pad; Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad, null, null, null] }); });
    const press = async (button, ms = 120) => { await page.evaluate(b => { globalThis.__qaPad.buttons[b].pressed = true; globalThis.__qaPad.buttons[b].value = 1; }, button); await delay(ms);
      await page.evaluate(b => { globalThis.__qaPad.buttons[b].pressed = false; globalThis.__qaPad.buttons[b].value = 0; }, button); await delay(350); };
    await press(3); await waitTea(page, () => SYNKTownDay.metrics().tea?.order && SYNKTownDay.metrics().tea.bubbles.length > 0);
    check(scene, (await tea(page)).order, 'Y — 찻집 앞에서 주문을 연다');
    await press(1); const after1 = await page.evaluate(() => ({ tea: SYNKTownDay.metrics().tea, walk: SYNKTownDay.metrics().walk.input, focus: document.activeElement?.className, hasFocus: document.hasFocus() }));
    await press(1);
    let m = await tea(page); check(scene, m.phase === 'make', 'B 두 번 — 두 손님 말을 접는다', { phase: m.phase, after1 });
    await press(4); await press(5); await press(3);
    m = await tea(page); check(scene, m.board.vessel === 'warm' && !!m.board.tea && m.board.honey === 1, 'LB 잔 · RB 차 · Y 꿀', m.board);
    await press(0); m = await tea(page); check(scene, m.tray.some(Boolean), 'A — 판에 차가 있으면 「다 됐어요」', m.tray);
    await press(7); m = await tea(page); check(scene, m.hand !== null, 'RT — 쟁반 잔을 든다', m.hand);
    await walkTo(page, [['z', 1.0]]);
    const near = await walkPoint(page);
    if (Math.hypot(near.x - -.05, near.z - .25) < 1.6) {
      await press(0); await page.waitForFunction(() => SYNKTownDay.snapshot().view.tea.open?.guests.some(g => g.tries > 0 || g.done), null, { timeout: 10000 })
        .then(() => check(scene, true, '손님 곁에서 A — 든 잔을 낸다'), e => check(scene, false, '손님 곁에서 A — 든 잔을 낸다', e.message));
    } else check(scene, true, '손님 곁까지 걷지 못함(찻집 벽) — A 내기는 건너뜀', near);
    check(scene, s.errors.length === 0, '콘솔 오류 0', s.errors);
  } finally { await s.close(); await f.close(); }
}

/** Waits for a card's offer on the screen; if it never comes, the check carries what the host held every 15 s (the visit's
 * play time — the offer waits for 45 s of it —, the contacts, the card's status, where the day stands). */
async function waitOffer(scene, page, f, cardId, what) {
  const waited = [], why = () => { const { state, view } = f.store.read(), life = state.life || {};
    return { playMs: (life.uMs ?? 0) - (life.visitStartU ?? 0), contacts: (life.contacts || []).map(c => [c.card || 'C1', c.status]), mode: life.mode,
      card: (view?.day?.scene?.village?.cards || []).filter(c => c.card === cardId).map(c => c.status), location: state.day?.location, take: view?.day?.scene?.village?.take?.status ?? null }; };
  const tick = setInterval(() => { try { waited.push(why()); } catch {} }, 15000);
  await page.waitForFunction(() => !!document.querySelector('#card-offers .offer-card:not([hidden])'), null, { timeout: 150000 })
    .then(() => check(scene, true, what), e => check(scene, false, what, { error: e.message, waited }))
    .finally(() => clearInterval(tick));
}

/** Card C5 「손님이 몰렸어요」: its offer reaches only a screen with caps tea (this one), 「같이 해요」 opens the order bound to it. */
async function cardScene(browser) {
  const scene = 'card', f = await fixture(kst('2026-10-23', '12:00'), 'acct-together');
  try {
    const village = await town('town/village.mjs');
    let found = null;
    // The owner by the cafe when it stands and still there four minutes on (the offer waits for the visit's first 45 s).
    for (let step = 0; step < 48 && !found; step++) {
      const v = f.store.read().state.village, out = village.planOf(v), t = f.now();
      const start = Object.fromEntries(Object.entries(v.band.residents).map(([npc, r]) => [npc, r.lastSpot]).filter(([, x]) => x));
      const e = out.log.find(x => x.atMs > t && x.card === 'C5');
      const a = e && village.placeAt(out.segments, e.npc, e.atMs + 20000, start), b = e && village.placeAt(out.segments, e.npc, e.atMs + 4 * MIN, start);
      if (a && b && !a.walking && !b.walking && a.to === 'cafe' && b.to === 'cafe') found = e; else f.set(f.now() + HOUR);
    }
    check(scene, found, 'C5가 찻집에서 서는 때를 찾았다', found && { key: found.key });
    if (!found) return;
    // Open once it stands (W5 QA's way): the offer needs the card triggered and the visit's first 45 s of play behind it.
    f.set(found.atMs + 5000);
    const s = await open(browser, f);
    try {
      const { page } = s;
      // A boundary is safe where the player stood still after talking there (W5b — day.location is the cafe): walk up, talk (E),
      // then close the place's panel (Esc) — no offer is drawn over an open panel — and wait.
      await walkTo(page, ROUTES.cafe); await page.keyboard.press('e'); await delay(1500); await page.keyboard.press('Escape'); await delay(600);
      await waitOffer(scene, page, f, 'C5', 'caps tea 화면에 C5 제안이 뜬다');
      check(scene, s.boundaries.some(b => (b.caps || []).includes('tea')), '경계 신호에 caps tea', s.boundaries.map(b => b.caps));
      await delay(400); // past the offer card's .24s fade-in, so the shot shows it as it stays (W5 QA)
      await shot(page, 'tea-c5-offer-1440');
      await page.locator('#card-offers .offer-card:not([hidden]) button').filter({ hasText: /같이/ }).first().click();
      await waitTea(page, () => SYNKTownDay.snapshot().view.tea.open?.card?.id === 'C5', null, 10000);
      const m = await tea(page), dialogOpen = await page.evaluate(() => document.querySelector('#card-dialog').open);
      check(scene, m.boardShown || m.bubbles.length, '「같이 해요」가 C5에 묶인 주문을 연다', m);
      check(scene, !dialogOpen, '생활 카드는 고르기 판(대화 상자)을 띄우지 않는다', dialogOpen);
      check(scene, s.errors.length === 0, '콘솔 오류 0', s.errors);
    } finally { await s.close(); }
  } finally { await f.close(); }
}

/** Card R6 「밤새 관찰해서 졸려요」: the one-cup board — 「같이 해요」 by the researcher, the cup made at the cafe, carried
 * back and given by the researcher's side (review F15); a cup served at the cafe is not offered there, and a cup in hand
 * never makes the greenhouse a counter (screen review A1). simple: the same on a phone in 「간단히 만들기」 — the cup picked
 * at the cafe and given by the researcher (A2). */
async function oneCupScene(browser, { simple = false } = {}) {
  const scene = simple ? 'one-cup-simple' : 'one-cup', f = await fixture(kst('2026-10-23', '12:00'), 'acct-together');
  try {
    const village = await town('town/village.mjs');
    let found = null;
    // R6 follows a night up (R4) in a lived village: an hourly pulse plays the days as tests/town-tea.test.js does.
    for (let step = 0; step < 72 && !found; step++) {
      f.store.pulse({ surfaceId: 'qa-search', surface: 'day', foreground: true, safe: true });
      const v = f.store.read().state.village, out = village.planOf(v), t = f.now();
      const start = Object.fromEntries(Object.entries(v.band.residents).map(([npc, r]) => [npc, r.lastSpot]).filter(([, x]) => x));
      const e = out.log.find(x => x.atMs > t && x.card === 'R6');
      const a = e && village.placeAt(out.segments, e.npc, e.atMs + 20000, start), b = e && village.placeAt(out.segments, e.npc, e.atMs + 6 * MIN, start);
      if (a && b && !a.walking && !b.walking && a.to === 'greenhouse' && b.to === 'greenhouse') found = e; else f.set(f.now() + HOUR);
    }
    check(scene, found, 'R6가 온실에서 서는 때를 찾았다', found && { key: found.key });
    if (!found) return;
    f.set(found.atMs + 5000);
    const s = await open(browser, f, simple ? { device: 'phone' } : {});
    const width = simple ? 390 : 1440;
    try {
      const { page } = s;
      await walkTo(page, ROUTES.greenhouse);
      const by = await walkPoint(page); check(scene, by.nearby === 'greenhouse', '온실 곁까지 걸었다', by);
      await page.keyboard.press('e'); await delay(1500); await page.keyboard.press('Escape'); await delay(600);
      await waitOffer(scene, page, f, 'R6', '연구원 곁에 R6 제안이 뜬다');
      await page.locator('#card-offers .offer-card:not([hidden]) button').filter({ hasText: /같이/ }).first().click();
      await waitTea(page, () => SYNKTownDay.snapshot().view.tea.open?.card?.id === 'R6', null, 10000);
      let m = await tea(page);
      check(scene, m.kind === 'one-cup' && m.boardShown && m.simple === simple, '「같이 해요」가 한 잔 판을 연다', m);
      const hint = await page.locator('#tea-board .tea-hint').innerText(), pick = simple ? '#tea-board .tea-simple-cup' : '#tea-board .tea-cup-pick';
      check(scene, /찻집에서/.test(hint) && await page.locator(pick).first().isDisabled(), '온실에서는 「찻집에서 한 잔 만들어 가요」 — 판은 찻집에서만 담긴다', hint);
      await shot(page, `tea-r6-board-${width}`);
      await walkTo(page, ROUTES.cafeFromGreenhouse);
      await page.waitForFunction(p => !document.querySelector(p)?.disabled, pick, { timeout: 10000 }).catch(() => {});
      // The giving button: the hand chip's when the cup is made by hand, the picked cup's row in 「간단히 만들기」 (review A2).
      const give = simple ? page.locator('#tea-board .tea-simple-row').getByRole('button', { name: '연구원에게 드리기' }) : page.locator('#tea-hand').getByRole('button', { name: '연구원에게 드리기' });
      if (simple) {
        await page.locator(pick).first().click(); await delay(250);
        const carried = await page.locator('#tea-board .tea-hint').innerText();
        check(scene, /들고/.test(carried) && await page.locator(pick).first().getAttribute('aria-pressed') === 'true', '찻집에서 잔을 골랐다 — 「잔을 들고 연구원 곁에서 드려요」', carried);
      } else {
        await makeWithKeys(page, { vessel: 'warm', tea: 'barley', honey: 2 }); await page.keyboard.press('6'); await delay(250);
        m = await tea(page); check(scene, m.chip && m.hand !== null, '찻집에서 만든 잔을 들었다', { chip: m.chip, hand: m.hand, tray: m.tray });
      }
      check(scene, await give.isDisabled(), '찻집에서는 「연구원에게 드리기」가 닫혀 있다');
      await walkTo(page, ROUTES.greenhouse);
      if (!simple) {
        // A cup in hand never makes the greenhouse a counter (screen review A1): no pouring by key, no 「판에 놓기」.
        const before = (await tea(page)).board; await page.locator('#tea-board').focus().catch(() => {}); await page.keyboard.press('4'); await delay(200);
        m = await tea(page);
        check(scene, JSON.stringify(m.board) === JSON.stringify(before) && await page.locator(pick).first().isDisabled() && await page.locator('#tea-hand').getByRole('button', { name: '판에 놓기' }).isDisabled(),
          '온실에서는 잔을 든 채로도 판이 잠긴다(검수 A1)', { before, after: m.board });
      } else check(scene, await page.locator(pick).first().isDisabled(), '온실에서는 잔을 다시 고르지 않는다(검수 A2)');
      await page.waitForFunction(([sel, name]) => [...document.querySelectorAll(sel)].some(b => b.textContent === name && !b.disabled), [simple ? '#tea-board .tea-simple-row button' : '#tea-hand button', '연구원에게 드리기'], { timeout: 10000 })
        .then(() => check(scene, true, '온실에 오면 「연구원에게 드리기」가 열린다'), e => check(scene, false, '온실에 오면 「연구원에게 드리기」가 열린다', e.message));
      await give.click();
      await page.waitForFunction(() => SYNKTownDay.snapshot().view.day?.scene?.village?.take?.card === 'R6' && SYNKTownDay.snapshot().view.day.scene.village.take.status === 'resolved', null, { timeout: 10000 })
        .then(() => check(scene, true, '연구원 곁에서 내면 R6가 풀린다'), e => check(scene, false, '연구원 곁에서 내면 R6가 풀린다', e.message));
      await delay(900);
      const result = await page.locator('.tea-result').innerText().catch(() => '');
      check(scene, /연구원/.test(result) && /닫기/.test(result) && !/다음 손님/.test(result), '결과: 연구원의 한마디와 「닫기」(다음 손님 없음)', result);
      await shot(page, `tea-r6-result-${width}`);
      check(scene, s.errors.length === 0, '콘솔 오류 0', s.errors);
    } finally { await s.close(); }
  } finally { await f.close(); }
}

/** No hand sound while a microphone is open in this origin (WORLD's recording keeps synk.world.mic fresh). */
async function micScene(browser) {
  const scene = 'mic', f = await fixture(kst('2026-10-28', '13:00'));
  const s = await open(browser, f, { init: () => { const keep = () => { try { localStorage.setItem('synk.world.mic', String(Date.now())); } catch {} }; keep(); setInterval(keep, 500); } });
  try {
    const { page } = s;
    await startOrder(page, scene);
    for (const slot of ['a', 'b']) { await page.locator(`.tea-bubble[data-slot="${slot}"]`).getByRole('button', { name: '네, 알겠어요' }).click(); await delay(300); }
    await makeWithKeys(page, { vessel: 'warm', tea: 'yuzu', honey: 1 });
    const m = await tea(page); check(scene, m.sounds.length === 0 && m.sound.quiet === true, '녹음 중에는 손맛 소리 0', { sounds: m.sounds, sound: m.sound });
    check(scene, m.tray.some(Boolean), '소리가 없어도 판은 그대로 움직인다', m.tray);
  } finally { await s.close(); await f.close(); }
}

/** The samples: every hand sound and one cup's flow from the same scores, rendered offline (48 kHz stereo) → MP3, measured. */
async function samplesScene(browser) {
  const f = await fixture(kst('2026-10-28', '12:00')), page = await browser.newPage(), dir = path.join(output, 'samples');
  fs.mkdirSync(dir, { recursive: true });
  const plan = [
    ['01-잔-따뜻한잔', [['cup', { vessel: 'warm' }, 0]]], ['02-잔-찬잔', [['cup', { vessel: 'cold' }, 0]]],
    ['03-따르기-보리차', [['pour', { tea: 'barley' }, 0]]], ['04-따르기-유자차', [['pour', { tea: 'yuzu' }, 0]]], ['05-따르기-오늘의차', [['pour', { tea: 'today' }, 0]]],
    ['06-꿀-한숟가락', [['spoon', { honey: 1 }, 0]]], ['07-꿀-두숟가락', [['spoon', { honey: 2 }, 0]]], ['08-꿀-빼기', [['spoon', { honey: 0 }, 0]]],
    ['09-다됐어요', [['done', {}, 0]]], ['10-잔비우기', [['empty', {}, 0]]], ['11-들기', [['pick', {}, 0]]], ['12-내기', [['serve', {}, 0]]],
    ['13-딱좋아요', [['match', {}, 0]]], ['14-마지막손님', [['final', {}, 0]]],
    ['15-한잔흐름', [['cup', { vessel: 'warm' }, 0], ['pour', { tea: 'yuzu' }, .55], ['spoon', { honey: 1 }, 1.25], ['spoon', { honey: 2, variant: 1 }, 1.6], ['done', {}, 2.2], ['pick', {}, 2.9], ['serve', {}, 3.6], ['match', {}, 4.05]]],
    ['16-고쳐내기흐름', [['cup', { vessel: 'warm' }, 0], ['pour', { tea: 'barley' }, .5], ['done', {}, 1.1], ['pick', {}, 1.7], ['serve', {}, 2.3], ['pour', { tea: 'yuzu' }, 3.4], ['done', {}, 4.0], ['pick', {}, 4.6], ['serve', {}, 5.2], ['match', {}, 5.65], ['final', {}, 6.0]]],
  ];
  try {
    await page.goto(`${f.base}/day-style.css`);
    const files = [];
    for (const [name, notes] of plan) {
      const wav = await page.evaluate(async notes => {
        const { score, render, createBus, LEVEL, lengthOf } = await import('/day-sfx.mjs');
        const end = Math.max(...notes.map(([n, o, t]) => t + lengthOf(score(n, o)))) + .35, rate = 48000;
        const c = new OfflineAudioContext({ numberOfChannels: 2, length: Math.ceil(end * rate), sampleRate: rate }), bus = createBus(c);
        for (const [n, o, t] of notes) render(bus, score(n, o), t + .05, LEVEL[n]);
        const audio = await c.startRendering(), frames = audio.length, data = new DataView(new ArrayBuffer(44 + frames * 4));
        const text = (at, s) => [...s].forEach((ch, i) => data.setUint8(at + i, ch.charCodeAt(0)));
        text(0, 'RIFF'); data.setUint32(4, 36 + frames * 4, true); text(8, 'WAVEfmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 2, true);
        data.setUint32(24, rate, true); data.setUint32(28, rate * 4, true); data.setUint16(32, 4, true); data.setUint16(34, 16, true); text(36, 'data'); data.setUint32(40, frames * 4, true);
        const l = audio.getChannelData(0), r = audio.getChannelData(1);
        for (let i = 0; i < frames; i++) { data.setInt16(44 + i * 4, Math.max(-1, Math.min(1, l[i])) * 32767, true); data.setInt16(46 + i * 4, Math.max(-1, Math.min(1, r[i])) * 32767, true); }
        let s = ''; const bytes = new Uint8Array(data.buffer); for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode(...bytes.subarray(i, i + 32768));
        return btoa(s);
      }, notes);
      const file = path.join(dir, `${name}.wav`); fs.writeFileSync(file, Buffer.from(wav, 'base64')); files.push(file);
    }
    // Measured with blank-slice's meter (the kit's 「획득」 is -20.8 LUFS momentary): peak, loudness, audible length.
    const meter = path.join(__dirname, '../blank-slice/qa');
    const py = spawnSync('python', ['-I', '-c', `import sys,json; sys.path.insert(0, sys.argv[1]); from sound_check import measure; print(json.dumps({f: measure(f) for f in sys.argv[2:]}))`, meter, ...files], { encoding: 'utf8' });
    const levels = py.status === 0 ? JSON.parse(py.stdout) : null;
    check('samples', levels, '소리 재기(sound_check.measure)', py.stderr?.slice(0, 300));
    const table = [];
    for (const file of files) {
      const name = path.basename(file, '.wav'), lv = levels?.[file];
      if (lv) { table.push(`| ${name} | ${lv.peak_dbfs} | ${lv.loudness_lufs_m} | ${lv.audible_ms} | ${lv.clipped_samples} |`);
        check('samples', lv.clipped_samples === 0 && lv.peak_dbfs <= -.5, `${name} 깎임 없음`, lv);
        if (!/흐름/.test(name)) check('samples', lv.loudness_lufs_m <= -20.3, `${name} 크기 ≤ 획득(−20.8)+0.5`, lv.loudness_lufs_m); }
      const mp3 = file.replace(/\.wav$/, '.mp3'), made = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-b:a', '160k', mp3]);
      if (made.status === 0) fs.rmSync(file);
      check('samples', fs.existsSync(made.status === 0 ? mp3 : file), `${name} 표본`);
    }
    fs.writeFileSync(path.join(dir, 'README.md'), ['# 찻집 주문 손맛 소리 표본 (W8, 귀검수용)', '', '게임과 같은 합성 코드(`experiences/synk-town/day-sfx.mjs`의 score·render·createBus)를 오프라인으로 그린 것. 사운드킷 규칙 4(400ms 이하·실패음 없음·사인·트라이앵글·C 펜타토닉). 「조금 달라요」(손님이 다른 잔을 받음)에는 소리가 없다 — 15·16의 흐름에서 내려놓기 뒤 아무 소리 없는 자리가 그것이다.', '',
      '| 표본 | 최고(dBFS) | 순간 음량(LUFS, 획득 −20.8) | 들리는 길이(ms) | 깎임 |', '|---|---|---|---|---|', ...table, ''].join('\n'));
  } finally { await page.close(); await f.close(); }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const scenes = { order: orderScene, simple: simpleScene, pad: padScene, card: cardScene, 'one-cup': oneCupScene, 'one-cup-simple': b => oneCupScene(b, { simple: true }), mic: micScene, samples: samplesScene };
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
