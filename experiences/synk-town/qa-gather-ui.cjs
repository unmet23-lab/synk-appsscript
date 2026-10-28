// The gathering board on the town screen QA (W8b, vertical slice design §20-8 · W8b note §2-8 · §2-9). Each scene runs its own
// memory store whose clock starts at a chosen Korean instant (what grows is the server's clock). It checks, with the keyboard,
// the mouse, a touch phone and a gamepad stub: the spots' sparkles within a few steps (only the near one takes a press) and
// 「E · 잎 따기」 by one → the board (group 「잎 따기」, focus on the first young leaf) → young leaves picked by keys 1~4, a click
// and Enter, each with a sound at the press and its landing in the basket, the ledger granting each → a dark leaf only sways
// (a rustle, no command) → the branch bare: 「여기는 오늘 다 땄어요」 with where something still grows → the field book's note on a
// first find → walking off folds the board, Esc gives the keys back → 「바로 따기」 on a phone with reduced motion → the pad (A
// opens and picks, LB · RB move) → giving by the cafe owner (G) → her word over her head, the tea board's third jar named for
// the day's tea → the notebook's field book (pictures, no numbers) → no sound while a microphone is open → widths 1440 · 1024 ·
// 820 · 768 · 390 · 844×390 · 667×375 with no overlap of the board, the right column and the walking controls; console errors 0.
// Samples: every gathering sound and one spot's flow, rendered offline from the same scores (day-sfx.mjs) as MP3 for Yuho's ear
// check, with their peak, K-weighted momentary loudness and length.
//   node experiences/synk-town/qa-gather-ui.cjs [--out <dir>] [--only explore,pick,pad,simple,give,choices,book,mic,widths,samples]
const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const output = path.resolve(arg('--out', path.join(__dirname, '../../.tmp/town-w8b-gather')));
const only = arg('--only', '') ? new Set(arg('--only', '').split(',')) : null;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const kst = (date, time) => Date.parse(`${date}T${time}:00+09:00`);
const MIN = 60000, HOUR = 60 * MIN;
const DEVICES = { desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: 'reduce' },
  tablet: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, landscape: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  'landscape-small': { viewport: { width: 667, height: 375 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  'tablet-landscape': { viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, ipad: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  // A short phone (an address bar showing) and a narrow window walked with the keys, where the walking help stands (pub review s2).
  'phone-short': { viewport: { width: 360, height: 560 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, 'narrow-keys': { viewport: { width: 600, height: 800 }, deviceScaleFactor: 1 } };
const known404 = /avatar-textiles-v1/;
const report = { started: new Date().toISOString(), scenes: {}, failures: [] };
const check = (scene, ok, what, detail) => { (report.scenes[scene] ||= { checks: [] }).checks.push({ ok: !!ok, what, ...(detail === undefined ? {} : { detail }) }); if (!ok) report.failures.push(`${scene}: ${what}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`); };
const town = file => import(pathToFileURL(path.join(__dirname, file)).href);
const NUMBERS = /[0-9０-９]|번째|일째|연속|시간|분 |개 /;

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
  const page = await context.newPage(), errors = [], commands = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource|ERR_CONNECTION_REFUSED|Failed to fetch/.test(message.text())) errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400 && !known404.test(response.url()) && !/\/api\/preview\/(command|boundary)/.test(response.url())) errors.push(`${response.status()} ${response.url()}`); });
  page.on('request', request => { if (request.url().endsWith('/api/preview/command')) { try { const body = JSON.parse(request.postData() || '{}'); if (/^GATHER_/.test(body.type)) commands.push(body); } catch {} } });
  await page.goto(`${f.base}/day.html?play=walk&district=townwide-merged`);
  await page.waitForFunction(() => globalThis.SYNKTownDay?.metrics()?.assetsReady && SYNKTownDay.metrics().walk?.enabled, null, { timeout: 120000 });
  await page.waitForFunction(() => { const b = SYNKTownDay.metrics().bakedDistrict; return b && (b.failed || b.loaded); }, null, { timeout: 180000 });
  await delay(1200);
  return { page, context, errors, commands, close: () => context.close() };
}
const gather = page => page.evaluate(() => SYNKTownDay.metrics().gather);
const view = page => page.evaluate(() => SYNKTownDay.snapshot()?.view?.gather ?? null);
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
const ROUTES = {
  bed: [['z', 3.9], ['x', 3], ['z', -4.4], ['x', 0], ['z', -6.0], ['x', -0.45]],
  pots: [['z', 3.9], ['x', -1.0], ['z', -1.3]],
  wall: [['z', 3.9], ['x', 3.3], ['z', -1.3]],
  cafe: [['z', 3.9], ['x', 0], ['z', 2.6]],
  bedToCafe: [['x', 0], ['z', -4.4], ['x', 3], ['z', 3.9], ['x', 0], ['z', 2.6]],
};
const shot = (page, name) => page.screenshot({ path: path.join(output, `${name}.jpg`), type: 'jpeg', quality: 82 });
/** The selectors among these whose visible box lies over this one's. */
const HUD_FOOT = ['#walk-status', '#scene-caption', '#walk-interact', '#walk-joystick', '#stay-sit', '#tea-open'];
const clashes = (page, one, others = HUD_FOOT) => page.evaluate(([one, others]) => {
  const box = s => { const e = document.querySelector(s); if (!e || e.hidden || getComputedStyle(e).display === 'none') return null; const r = e.getBoundingClientRect(); return r.width && r.height ? r : null; };
  const a = box(one); return a ? others.filter(s => { const b = box(s); return b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; }) : [];
}, [one, others]);
const inView = (page, selector) => page.evaluate(s => { const e = document.querySelector(s); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; }, selector);
async function waitGather(page, test, arg, timeout = 8000) { await page.waitForFunction(test, arg, { timeout }); await delay(250); }
const visibleText = page => page.evaluate(() => [...document.querySelectorAll('.gather-board, .gather-actions, .gather-found, .gather-bubble, .gather-toast')].filter(e => !e.hidden).map(e => e.innerText).join(' | '));

/** Where each spot is in the scene: walking up to it, its sparkle and its entry, and the place it stands by. */
async function exploreScene(browser) {
  const scene = 'explore', f = await fixture(kst('2026-10-28', '10:30'));
  const s = await open(browser, f);
  try {
    const { page } = s, v = await view(page);
    check(scene, v && v.spots.length === 3, 'view.gather에 자리 셋', v && v.spots.map(x => [x.id, x.items]));
    for (const [id, route] of [['greenhouse.bed-edge', ROUTES.bed], ['cafe.pots', ROUTES.pots], ['lane.wall', ROUTES.wall]]) {
      if (id === 'cafe.pots') await walkTo(page, [['x', 0], ['z', -4.4], ['x', 3], ['z', 3.9]]);
      if (id === 'lane.wall') await walkTo(page, [['z', 2.6], ['x', 0.4], ['z', 3.9]]);
      await walkTo(page, route);
      await delay(500);
      const m = await gather(page), w = await walkPoint(page);
      report.scenes[scene].spots = { ...(report.scenes[scene].spots || {}), [id]: { walk: { x: w.x, z: w.z, nearby: w.nearby }, near: m.near, entry: m.entry, marks: m.marks } };
      check(scene, m.near === id, `${id} 곁에서 그 자리가 가깝다`, { near: m.near, walk: [w.x, w.z] });
      await shot(page, `explore-${id}`);
    }
    check(scene, s.errors.length === 0, '콘솔 오류 0', s.errors);
  } finally { await s.close(); await f.close(); }
}

/** Picks at the greenhouse bed by hand: the sparkle and 「E · 잎 따기」, the board, a dark leaf, young leaves by a key, a click and
 * Enter (a sound at the press and at the landing, the ledger granting each), the first find, the bare branch's line, Esc,
 * walking off, and the field book. */
async function pickScene(browser) {
  const scene = 'pick', f = await fixture(kst('2026-10-28', '10:30'));
  const s = await open(browser, f);
  try {
    const { page } = s;
    await walkTo(page, ROUTES.bed);
    await page.waitForFunction(() => SYNKTownDay.metrics().gather?.entry, null, { timeout: 8000 }).catch(() => {});
    let m = await gather(page);
    check(scene, m.entry && m.marks.some(k => k.id === 'greenhouse.bed-edge' && k.near), '화단 곁에서 반짝임과 「E · 잎 따기」', { entry: m.entry, marks: m.marks });
    const entryText = await page.locator('#gather-open').innerText();
    check(scene, /^E · 잎 따기$/.test(entryText), '단추 글: E · 잎 따기', entryText);
    check(scene, !(await clashes(page, '#gather-open')).length, '「잎 따기」가 이야기 단추 · 앉기 · 상태 줄 · 조이스틱과 겹치지 않는다', await clashes(page, '#gather-open'));
    await shot(page, 'gather-entry-1440');
    await page.keyboard.press('e');
    await waitGather(page, () => SYNKTownDay.metrics().gather.open);
    m = await gather(page);
    const leaves = m.leaves, young = leaves.filter(l => l.item), dark = leaves.filter(l => !l.item);
    check(scene, leaves.length === 4 && young.length === 3 && dark.length === 1, '가지에 잎 넷 — 어린잎 셋(남은 몫) · 짙은 잎 하나', leaves);
    const label = await page.locator('#gather-board').getAttribute('aria-label'), role = await page.locator('#gather-board').getAttribute('role');
    check(scene, label === '잎 따기' && role === 'group', '판은 group 「잎 따기」', { label, role });
    const focused = await page.evaluate(() => document.activeElement?.closest?.('.gather-leaf')?.dataset.index ?? null);
    check(scene, focused !== null && leaves[Number(focused)]?.item, '열면 초점이 첫 어린잎', focused);
    check(scene, await inView(page, '#gather-board'), '판이 화면 안');
    await shot(page, 'gather-board-1440');
    // A dark leaf: a rustle, no command.
    let before = (await gather(page)).sounds.length, sent = s.commands.length;
    await page.locator(`.gather-leaf[data-index="${dark[0].index}"]`).click(); await delay(500);
    m = await gather(page);
    check(scene, m.sounds.slice(before).join() === 'sway' && s.commands.length === sent && !m.picked.includes(dark[0].index), '짙은 잎은 「사락」뿐 — 명령도 소모도 없다', { sounds: m.sounds.slice(before), commands: s.commands.length - sent });
    // Young leaves: a key, a click, Enter on the leaf the keys moved to.
    before = m.sounds.length;
    const pictures = () => page.evaluate(() => document.querySelectorAll('.gather-basket-leaf').length);
    const inBasket = await pictures();
    await page.keyboard.press(String(young[0].index + 1)); await delay(120);
    const midAir = await pictures(); await delay(780);
    m = await gather(page);
    const one = m.sounds.slice(before);
    check(scene, midAir === inBasket && await pictures() === inBasket + 1, '잎이 바구니에 닿을 때 그림이 든다(날아가는 동안은 그대로)', { before: inBasket, midAir, after: await pictures() });
    check(scene, one[0] === 'leaf' && one.includes('basket'), '키로 딴 잎 — 누른 순간 「톡」, 바구니에 닿으면 「폭」', one);
    let v = await view(page);
    check(scene, v.basket.some(b => b.item === 'leaf-young' && b.qty === 1) && v.book.includes('leaf-young'), '서버가 원장에 지급 · 도감에 적음', { basket: v.basket, book: v.book });
    check(scene, one.includes('discover') || (await gather(page)).found === 'leaf-young', '처음 딴 재료 — 「도감에 적었어요」 카드와 세 음', one);
    await shot(page, 'gather-found-1440');
    // The keys stay where they were (the dark leaf clicked before) — never lost to the page.
    const kept = await page.evaluate(() => document.activeElement?.closest?.('.gather-leaf')?.dataset.index ?? document.activeElement?.tagName);
    check(scene, kept === String(dark[0].index), '키로 따도 초점은 있던 잎에 남는다', kept);
    // A refusal of the town's own (screen review A1): the leaf comes back pressable, and it never lands in the basket. The second
    // comes as through a WORLD account — the code alone, the town's words nested away — and the board still says why (pub review).
    const refusals = [{ error: 'gather-too-far', message: '조금 더 가까이 가서 따 주세요.' }, { error: 'gather-full', message: 'gather-full' }];
    await page.route('**/api/preview/command', async route => { const body = JSON.parse(route.request().postData() || '{}');
      if (refusals.length && body.type === 'GATHER_PICK') return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify(refusals.shift()) });
      return route.continue(); });
    before = (await gather(page)).sounds.length;
    await page.locator(`.gather-leaf[data-index="${young[1].index}"]`).click(); await delay(900);
    m = await gather(page);
    const returned = await page.evaluate(i => { const b = document.querySelector(`.gather-leaf[data-index="${i}"]`); return { gone: b.classList.contains('gone'), disabled: b.disabled }; }, young[1].index);
    check(scene, !returned.gone && !returned.disabled && !m.picked.includes(young[1].index) && !m.sounds.slice(before).includes('basket') && /가까이/.test(m.line || ''), '거절된 잎은 가지로 돌아와 다시 눌린다 · 바구니 소리 없음 · 까닭 한 줄', { returned, sounds: m.sounds.slice(before), line: m.line });
    check(scene, !(await page.evaluate(() => document.getElementById('error') && !document.getElementById('error').hidden)), '도메인 거절은 연결 오류로 띄우지 않는다');
    await page.locator(`.gather-leaf[data-index="${young[1].index}"]`).click(); await delay(900);
    m = await gather(page);
    check(scene, m.line === '바구니가 가득 찼어요.', '코드만 온 거절(WORLD 계정 꼴)도 까닭은 마을 말로', m.line);
    await page.unroute('**/api/preview/command');
    before = (await gather(page)).sounds.length;
    await page.locator(`.gather-leaf[data-index="${young[1].index}"]`).click(); await delay(900);
    await page.locator(`.gather-leaf[data-index="${young[2].index}"]`).focus(); await page.keyboard.press('Enter'); await delay(1200);
    m = await gather(page);
    const after = await page.evaluate(() => document.activeElement?.closest?.('.gather-leaf')?.dataset.index ?? (document.activeElement?.classList.contains('gather-close') ? 'close' : document.activeElement?.tagName));
    check(scene, after === String(dark[0].index) || after === 'close', 'Enter로 딴 잎이 날아가면 초점은 남은 잎(또는 닫기)으로', after);
    const run = m.sounds.slice(before);
    check(scene, run.filter(x => x === 'leaf').length === 2 && run.filter(x => x === 'basket').length === 2, '마우스 · Enter로 나머지 둘 — 소리 둘씩', run);
    v = await view(page);
    check(scene, v.basket.find(b => b.item === 'leaf-young')?.qty === 3 && v.spots[0].items[0].left === 0, '셋 다 지급 · 남은 몫 0', { basket: v.basket, left: v.spots[0].items[0].left });
    check(scene, /다 땄어요/.test(m.line) && /찻집 화분에서 딸 수 있어요/.test(m.line), '빈 가지 — 「여기는 오늘 다 땄어요」 + 지금 딸 것이 있는 다른 자리', m.line);
    const words = await visibleText(page);
    check(scene, !NUMBERS.test(words), '판의 보이는 글에 숫자 없음(G2)', words);
    check(scene, s.commands.filter(c => c.type === 'GATHER_PICK').length === 5 && s.commands.every(c => c.payload.surfaceId && Number.isSafeInteger(c.payload.fence)), '명령 다섯(거절 둘 포함) · 창 울타리(surfaceId · fence) 실림', s.commands.map(c => c.type));
    await shot(page, 'gather-done-1440');
    await page.keyboard.press('Escape'); await delay(400);
    m = await gather(page);
    const back = await page.evaluate(() => document.activeElement?.id || document.activeElement?.className);
    check(scene, !m.open && back === 'gather-open', 'Esc로 닫고 초점은 「잎 따기」로', back);
    // By the greenhouse door the bed's spot and the place's talk reach meet (screen review F1): the talk button talks there.
    await walkTo(page, [['z', -5.95], ['x', -0.3]]); await delay(500);
    const both = await page.evaluate(() => ({ entry: SYNKTownDay.metrics().gather.entry, gnear: SYNKTownDay.metrics().gather.near, open: SYNKTownDay.metrics().gather.open, at: [SYNKTownDay.metrics().walk.x, SYNKTownDay.metrics().walk.z], near: SYNKTownDay.metrics().walk.nearby, panel: SYNKTownDay.metrics().walk.interactionOpen, talk: !document.getElementById('walk-interact').disabled, label: document.getElementById('walk-interact').textContent }));
    if (both.entry && both.near === 'greenhouse') {
      await page.locator('#walk-interact').click(); await delay(1200);
      const after = await page.evaluate(() => ({ panel: document.body.classList.contains('walk-engaged'), board: SYNKTownDay.metrics().gather.open }));
      check(scene, both.talk && !/^E · /.test(both.label) && after.panel && !after.board, '온실 문 쪽 겹친 자리 — 이야기 단추(키 표시 없음)는 장소 판을 연다(검수 F1)', { both, after });
      await page.keyboard.press('Escape'); await delay(400);
    } else check(scene, false, '온실 문 쪽에서 잎 따기와 말 걸기가 함께 보이는 자리에 섰다', both);
    // Opened again and walked off: the board folds by itself.
    await page.keyboard.press('e'); await waitGather(page, () => SYNKTownDay.metrics().gather.open);
    await walkTo(page, [['x', 0.4], ['z', -4.6]]); await delay(400);
    m = await gather(page);
    check(scene, !m.open, '자리에서 멀어지면 판이 저절로 접힌다', m.open);
    // The field book: the found one's picture, name and line; the rest silhouettes; no numbers.
    await page.locator('#journal-open').click(); await delay(300);
    await page.locator('#notebook-tab-book').click(); await delay(400);
    const cells = await page.evaluate(() => [...document.querySelectorAll('.notebook-book .book-cell')].map(c => ({ found: c.classList.contains('found'), text: c.innerText })));
    check(scene, cells.length === 5 && cells.filter(c => c.found).length === 1 && /어린 찻잎/.test(cells.find(c => c.found)?.text || ''), '도감 다섯 칸 — 딴 것 하나는 그림·이름·설명', cells);
    check(scene, cells.every(c => !NUMBERS.test(c.text)), '도감에 숫자 · 몇 개 모음 없음', cells.map(c => c.text));
    await shot(page, 'gather-book-1440');
    await page.locator('#notebook-close').click();
    check(scene, s.errors.length === 0, '콘솔 오류 0', s.errors);
  } finally { await s.close(); await f.close(); }
}

/** A time from start on when the cafe owner stands at the cafe (prep or counter) for the next minutes — giving is done there. */
async function ownerAtCafe(f, start, minutes = 6) {
  const village = await town('town/village.mjs');
  for (let t = start, i = 0; i < 60; i++, t += 10 * MIN) {
    f.set(t); const state = f.store.read().state, v = state.village; if (!v?.band) continue;
    const out = village.planOf(v), from = Object.fromEntries(Object.entries(v.band.residents || {}).map(([npc, r]) => [npc, r.lastSpot]).filter(([, x]) => x));
    const a = village.placeAt(out.segments, 'cafe-owner', t + 20000, from), b = village.placeAt(out.segments, 'cafe-owner', t + minutes * MIN, from);
    if (a && b && !a.walking && !b.walking && a.to === 'cafe' && b.to === 'cafe' && ['cafe.prep', 'cafe.counter'].includes(a.spot) && a.spot === b.spot) return { at: t, spot: a.spot };
  }
  return null;
}
/** Giving at the cafe: picks at the pots beside the owner, 「찻집 주인에게 드리기」 (G), her word over her head once, the tea
 * board's third jar named for the day's tea. */
async function giveScene(browser) {
  const scene = 'give', f = await fixture(kst('2026-10-28', '12:00'));
  try {
    const found = await ownerAtCafe(f, kst('2026-10-28', '12:00'));
    check(scene, found, '찻집 주인이 찻집(준비대 · 계산대)에 선 때', found);
    if (!found) return;
    f.set(found.at);
    const s = await open(browser, f);
    try {
      const { page } = s;
      await walkTo(page, ROUTES.pots);
      await page.keyboard.press('e'); await waitGather(page, () => SYNKTownDay.metrics().gather.open);
      let m = await gather(page);
      const first = m.leaves.find(l => l.item);
      check(scene, first, '찻집 화분에 딸 것이 있다', m.leaves);
      for (const leaf of m.leaves.filter(l => l.item)) { await page.keyboard.press(String(leaf.index + 1)); await delay(700); }
      await delay(800); await page.keyboard.press('Escape'); await delay(500);
      m = await gather(page);
      check(scene, m.give, '깨어 선 찻집 주인 곁에서 「찻집 주인에게 드리기」', { give: m.give, owner: found });
      check(scene, !(await clashes(page, '#gather-give')).length && !(await clashes(page, '#gather-give', ['#gather-open'])).length, '드리기 칩이 다른 단추와 겹치지 않는다', await clashes(page, '#gather-give'));
      await shot(page, 'gather-give-1440');
      const basket = (await view(page)).basket;
      await page.keyboard.press('g'); await delay(500);
      m = await gather(page);
      if (m.giveChoices) { await page.locator('.gather-give-one').first().click(); }
      await page.waitForFunction(() => !!SYNKTownDay.snapshot()?.view?.gather?.today, null, { timeout: 8000 }).catch(() => {});
      await delay(600);
      m = await gather(page); const v = await view(page);
      check(scene, v.today?.tea && v.basket.length < basket.length, '드리면 바구니에서 잎 통으로 · 그날의 차', { today: v.today, before: basket, after: v.basket });
      check(scene, m.sounds.includes('give'), '「사르륵 톡」', m.sounds.slice(-4));
      check(scene, m.bubble && /고마워요|마침/.test(m.bubble), '그날 첫 드리기 — 주인 머리 위 한 줄', m.bubble);
      await shot(page, 'gather-gave-1440');
      // The tea board's third jar shows the day's tea under 「오늘의 차」.
      await walkTo(page, [['z', 2.6], ['x', 0]]);
      await page.waitForFunction(() => SYNKTownDay.metrics().tea?.entry, null, { timeout: 8000 }).catch(() => {});
      if ((await page.evaluate(() => SYNKTownDay.metrics().tea?.entry))) {
        await page.keyboard.press('t'); await page.waitForFunction(() => SYNKTownDay.metrics().tea?.order, null, { timeout: 8000 }).catch(() => {});
        for (let i = 0; i < 2; i++) { const heard = page.locator('.tea-bubble .tea-heard').first(); if (await heard.count()) { await heard.click(); await delay(400); } }
        const jar = await page.evaluate(() => { const b = document.querySelector('.tea-jar[data-tea="today"]'); return b ? { sub: b.querySelector('.tea-jar-sub')?.textContent ?? null, label: b.getAttribute('aria-label') } : null; });
        check(scene, jar?.sub && /차$/.test(jar.sub), '찻집 판 셋째 통 이름표에 그날 드린 차', jar);
        await shot(page, 'gather-tea-jar-1440');
      } else check(scene, false, '찻집 앞에서 주문을 열 수 있다(셋째 통 확인)');
      check(scene, s.errors.length === 0, '콘솔 오류 0', s.errors);
    } finally { await s.close(); }
  } finally { await f.close(); }
}

/** Giving on a low landscape phone with two kinds in the basket: the choices open left of the right column, never under the
 * top bar (pub review s2 FA1 — the first one sat under 「수첩」 · 「내 속도」 there), and the first choice takes its own tap. */
async function choicesScene(browser) {
  const scene = 'choices';
  for (const device of ['landscape-small', 'landscape']) {
    const f = await fixture(kst('2026-10-28', '12:00'));
    try {
      const found = await ownerAtCafe(f, kst('2026-10-28', '12:00')), size = `${DEVICES[device].viewport.width}x${DEVICES[device].viewport.height}`;
      check(scene, found, `${size} — 찻집 주인이 찻집에 선 때`, found);
      if (!found) continue;
      f.set(found.at);
      const s = await open(browser, f, { device });
      try {
        const { page } = s;
        await walkTo(page, ROUTES.pots);
        await page.keyboard.press('e'); await waitGather(page, () => SYNKTownDay.metrics().gather.open);
        let m = await gather(page);
        for (const leaf of m.leaves.filter(l => l.item)) { await page.keyboard.press(String(leaf.index + 1)); await delay(700); }
        await delay(800); await page.keyboard.press('Escape'); await delay(500);
        const before = (await view(page)).basket;
        check(scene, before.length >= 2, `${size} — 바구니에 두 가지(고르기 목록이 서는 때)`, before);
        await page.keyboard.press('g'); await delay(500);
        m = await gather(page);
        const first = await page.evaluate(() => {
          const b = document.querySelector('.gather-give-one'); if (!b) return null;
          const r = b.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          const bar = [...document.querySelectorAll('.topbar .brand, #journal-open, #settings-open, #camera-toggle, #town-map')].map(e => e.getBoundingClientRect()).filter(q => q.width && q.height);
          return { box: [r.left, r.top, r.right, r.bottom].map(Math.round), own: !!hit && b.contains(hit), under: bar.some(q => r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top),
            inView: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth };
        });
        check(scene, m.giveChoices && first?.own && !first.under && first.inView, `${size} — 고르기 첫 단추가 화면 안 · 위쪽 막대 · 지도 밖 · 제 누름을 받는다`, first);
        await shot(page, `gather-choices-${size}`);
        await page.locator('.gather-give-one').first().click();
        await page.waitForFunction(() => !!SYNKTownDay.snapshot()?.view?.gather?.today, null, { timeout: 8000 }).catch(() => {});
        await delay(600);
        const after = (await view(page)).basket, count = b => b.reduce((n, x) => n + x.qty, 0);
        check(scene, count(after) < count(before), `${size} — 첫 단추로 드렸다`, { before, after });
        check(scene, s.errors.length === 0, `${size} — 콘솔 오류 0`, s.errors);
      } finally { await s.close(); }
    } finally { await f.close(); }
  }
}

/** 「바로 따기」 on a phone with reduced motion (간단히 만들기 is on there by default): one button, the sound and the basket stay. */
async function simpleScene(browser) {
  const scene = 'simple', f = await fixture(kst('2026-10-28', '10:30'));
  const s = await open(browser, f, { device: 'phone' });
  try {
    const { page } = s;
    await walkTo(page, ROUTES.bed);
    await page.waitForFunction(() => SYNKTownDay.metrics().gather?.entry, null, { timeout: 8000 }).catch(() => {});
    // A touch on the joystick makes touch the input (walking here was by keys): the button then names no key.
    const pad = await page.locator('#walk-joystick').boundingBox(); await page.touchscreen.tap(pad.x + pad.width / 2, pad.y + pad.height / 2); await delay(500);
    const entry = await page.locator('#gather-open').innerText();
    check(scene, entry === '잎 따기', '터치로 걸으면 단추 글에 키가 없다', entry);
    check(scene, !(await clashes(page, '#gather-open')).length, '휴대폰 — 「잎 따기」가 걷기 줄 · 조이스틱 · 이야기 단추와 겹치지 않는다', await clashes(page, '#gather-open'));
    await shot(page, 'gather-entry-390');
    await page.locator('#gather-open').tap();
    await waitGather(page, () => SYNKTownDay.metrics().gather.open);
    let m = await gather(page);
    check(scene, m.simple && await page.locator('.gather-quick').isVisible() && !(await page.locator('.gather-branch').isVisible()), '움직임 줄이기 — 가지 대신 「바로 따기」 하나', { simple: m.simple });
    check(scene, await inView(page, '#gather-board'), '판이 화면 안(390)');
    await shot(page, 'gather-simple-390');
    // Keys on 「바로 따기」 (screen review A2): pressed by Enter, the keys stay on it while something is left.
    await page.locator('.gather-quick').focus(); await page.keyboard.press('Enter'); await delay(900);
    const kept = await page.evaluate(() => document.activeElement?.classList.contains('gather-quick'));
    check(scene, kept, '키로 바로 따기를 눌러도 초점은 그 단추에 남는다', await page.evaluate(() => document.activeElement?.className));
    for (let i = 0; i < 2; i++) { await page.locator('.gather-quick').tap(); await delay(900); }
    m = await gather(page); const v = await view(page);
    check(scene, v.basket.find(b => b.item === 'leaf-young')?.qty === 3 && m.sounds.filter(x => x === 'leaf').length === 3, '「바로 따기」 셋 — 소리는 남고 바구니가 찬다', { basket: v.basket, sounds: m.sounds });
    check(scene, /다 땄어요/.test(m.line || ''), '다 따면 단추 대신 한 줄', m.line);
    await shot(page, 'gather-simple-done-390');
    check(scene, s.errors.length === 0, '콘솔 오류 0', s.errors);
  } finally { await s.close(); await f.close(); }
}

/** A gamepad: A opens by the spot and picks the ringed leaf, RB moves the ring, B closes. */
async function padScene(browser) {
  const scene = 'pad', f = await fixture(kst('2026-10-28', '10:30'));
  const s = await open(browser, f);
  try {
    const { page } = s;
    await walkTo(page, ROUTES.bed);
    await page.evaluate(() => { const pad = { id: 'qa pad', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
      globalThis.__qaPad = pad; Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad, null, null, null] }); });
    const press = async (button, ms = 120) => { await page.evaluate(b => { globalThis.__qaPad.buttons[b].pressed = true; globalThis.__qaPad.buttons[b].value = 1; }, button); await delay(ms);
      await page.evaluate(b => { globalThis.__qaPad.buttons[b].pressed = false; globalThis.__qaPad.buttons[b].value = 0; }, button); await delay(400); };
    await press(5); await press(0);
    await waitGather(page, () => SYNKTownDay.metrics().gather.open).catch(() => {});
    let m = await gather(page);
    check(scene, m.open, 'A — 자리 곁에서 판을 연다', m);
    const ring = await page.evaluate(() => document.querySelector('.gather-leaf.cursor')?.dataset.index ?? null);
    check(scene, ring !== null && m.leaves[Number(ring)]?.item, '패드는 고리가 첫 어린잎에', ring);
    await press(0); await delay(600);
    m = await gather(page);
    check(scene, m.picked.length === 1 && m.sounds.includes('leaf'), 'A — 고리 친 잎을 딴다', m.picked);
    const ring2 = await page.evaluate(() => document.querySelector('.gather-leaf.cursor')?.dataset.index ?? null);
    await press(5);
    const ring3 = await page.evaluate(() => document.querySelector('.gather-leaf.cursor')?.dataset.index ?? null);
    check(scene, ring2 !== null && ring3 !== null && ring2 !== ring3, 'RB — 고리가 다음 잎으로', { ring2, ring3 });
    await press(1); m = await gather(page);
    check(scene, !m.open, 'B — 판을 닫는다', m.open);
    check(scene, s.errors.length === 0, '콘솔 오류 0', s.errors);
  } finally { await s.close(); await f.close(); }
}

/** Widths: the board, the right column and the walking controls never overlap; the board stays inside the screen. */
async function widthsScene(browser) {
  const scene = 'widths';
  for (const device of ['desktop', 'tablet-landscape', 'ipad', 'tablet', 'phone', 'landscape', 'landscape-small', 'phone-short', 'narrow-keys']) {
    const f = await fixture(kst('2026-10-28', '10:30')), s = await open(browser, f, { device });
    try {
      const { page } = s, size = `${DEVICES[device].viewport.width}x${DEVICES[device].viewport.height}`;
      await walkTo(page, ROUTES.bed);
      await page.waitForFunction(() => SYNKTownDay.metrics().gather?.entry, null, { timeout: 8000 }).catch(() => {});
      const entryClash = await clashes(page, '#gather-open', [...HUD_FOOT, '#town-map', '.walk-help']);
      check(scene, (await gather(page)).entry && !entryClash.length && await inView(page, '#gather-open'), `${size} — 「잎 따기」가 화면 안 · 겹침 없음`, entryClash);
      // The toast (a gift's word or why it could not be given) with its longest line: clear of the map, 「가까이 보기」, the top
      // bar, the right column and the keys' walking help (pub reviews F1 · s2 FA2 · FA3) — walked by the keys as here, and on
      // a touch screen (where the help hides).
      await page.evaluate(() => { const t = document.querySelector('.gather-toast'); t.textContent = '찻집 주인은 지금 자고 있어요. 아침에 다시 만나요.'; t.hidden = false; });
      const walkInput = await page.evaluate(() => document.body.dataset.walkInput ?? null);
      for (const input of ['keys', 'touch']) {
        if (input === 'touch') await page.evaluate(() => { document.body.dataset.walkInput = 'touch'; });
        const toastClash = await clashes(page, '.gather-toast', ['#town-map', '#camera-toggle', '.topbar .brand', '#journal-open', '#settings-open', '#gather-open', '.gather-actions', '.walk-help', ...HUD_FOOT]);
        const mapShown = await page.evaluate(() => { const e = document.querySelector('#town-map'); return !!e && getComputedStyle(e).display !== 'none'; });
        const box = await page.evaluate(() => { const r = document.querySelector('.gather-toast').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(Math.round); });
        check(scene, mapShown && await inView(page, '.gather-toast') && !toastClash.length, `${size} · ${input === 'keys' ? '키' : '터치'} — 토스트(가장 긴 글)가 화면 안 · 지도 · 가까이 보기 · 위쪽 막대 · 오른쪽 열 · 걷기 도움말과 겹치지 않는다`, { toastClash, mapShown, box, walkInput });
        if (input === 'touch' && device === 'phone') await shot(page, 'gather-toast-390x844');
      }
      await page.evaluate(was => { const t = document.querySelector('.gather-toast'); t.hidden = true; if (was === null) delete document.body.dataset.walkInput; else document.body.dataset.walkInput = was; }, walkInput);
      await page.locator('#gather-open').click(); await waitGather(page, () => SYNKTownDay.metrics().gather.open).catch(() => {});
      const boardClash = await clashes(page, '#gather-board', [...HUD_FOOT, '#gather-open', '#town-map', '.topbar .brand', '#journal-open', '#settings-open']);
      check(scene, (await gather(page)).open && await inView(page, '#gather-board') && !boardClash.length, `${size} — 판이 화면 안 · 걷기 조작 · 지도 · 위쪽 막대와 겹치지 않는다`, boardClash);
      // 「바로 따기」 (reduced motion there) has one button instead of the leaves.
      const leaves = await page.evaluate(() => [...document.querySelectorAll('.gather-branch:not([hidden]) .gather-leaf:not(.gone)'), ...document.querySelectorAll('.gather-quick:not([hidden])')].map(b => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height); }));
      check(scene, leaves.length && leaves.every(w => w >= 44), `${size} — 잎 단추(또는 바로 따기)가 44px 넘게`, leaves);
      if (['desktop', 'phone', 'landscape', 'landscape-small'].includes(device)) await shot(page, `gather-board-${size}`);
      check(scene, s.errors.length === 0, `${size} — 콘솔 오류 0`, s.errors);
    } finally { await s.close(); await f.close(); }
  }
}

/** No hand sound while a microphone is open in this origin (WORLD's recording keeps synk.world.mic fresh). */
async function micScene(browser) {
  const scene = 'mic', f = await fixture(kst('2026-10-28', '10:30'));
  const s = await open(browser, f, { init: () => { const keep = () => { try { localStorage.setItem('synk.world.mic', String(Date.now())); } catch {} }; keep(); setInterval(keep, 500); } });
  try {
    const { page } = s;
    await walkTo(page, ROUTES.bed); await page.keyboard.press('e'); await waitGather(page, () => SYNKTownDay.metrics().gather.open);
    const m0 = await gather(page), leaf = m0.leaves.find(l => l.item);
    await page.keyboard.press(String(leaf.index + 1)); await delay(900);
    const m = await gather(page);
    check(scene, m.sounds.length === 0 && m.sound.quiet === true, '녹음 중에는 따기 소리 0', { sounds: m.sounds, sound: m.sound });
    check(scene, m.picked.length === 1 && (await view(page)).basket.length === 1, '소리가 없어도 따기는 그대로', m.picked);
  } finally { await s.close(); await f.close(); }
}

/** The samples: every gathering sound and one spot's flow from the same scores, rendered offline (48 kHz stereo) → MP3, measured. */
async function samplesScene(browser) {
  const f = await fixture(kst('2026-10-28', '12:00')), page = await browser.newPage(), dir = path.join(output, 'samples');
  fs.mkdirSync(dir, { recursive: true });
  const TARGET = { leaf: -24, basket: -27, sway: -34, give: -23, discover: -21.5 };
  const plan = [
    ['01-따기-첫잎', [['leaf', { step: 0 }, 0]], 'leaf'], ['02-따기-둘째', [['leaf', { step: 1 }, 0]], 'leaf'], ['03-따기-셋째', [['leaf', { step: 2 }, 0]], 'leaf'], ['04-따기-마지막잎', [['leaf', { step: 2, last: true }, 0]], 'leaf'],
    ['05-바구니', [['basket', {}, 0]], 'basket'], ['06-짙은잎-사락', [['sway', {}, 0]], 'sway'], ['07-드리기', [['give', {}, 0]], 'give'], ['08-도감에-처음', [['discover', {}, 0]], 'discover'],
    ['09-한자리-다따기흐름', [['sway', {}, 0], ['leaf', { step: 0 }, .7], ['basket', {}, 1.1], ['discover', {}, 1.25], ['leaf', { step: 1 }, 2.0], ['basket', { variant: 1 }, 2.4], ['leaf', { step: 2, last: true }, 3.0], ['basket', {}, 3.4]], null],
    ['10-드리기흐름', [['give', {}, 0], ['leaf', { step: 0 }, 1.2], ['basket', {}, 1.6], ['give', {}, 2.4]], null],
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
    const meter = path.join(__dirname, '../blank-slice/qa');
    const py = spawnSync('python', ['-I', '-c', `import sys,json; sys.path.insert(0, sys.argv[1]); from sound_check import measure; print(json.dumps({f: measure(f) for f in sys.argv[2:]}))`, meter, ...files], { encoding: 'utf8' });
    const levels = py.status === 0 ? JSON.parse(py.stdout) : null;
    check('samples', levels, '소리 재기(sound_check.measure)', py.stderr?.slice(0, 300));
    const table = [];
    for (const [i, file] of files.entries()) {
      const name = path.basename(file, '.wav'), lv = levels?.[file], target = TARGET[plan[i][2]];
      if (lv) { table.push(`| ${name} | ${lv.peak_dbfs} | ${lv.loudness_lufs_m} | ${target ?? '—'} | ${lv.audible_ms} | ${lv.clipped_samples} |`);
        check('samples', lv.clipped_samples === 0 && lv.peak_dbfs <= -.5, `${name} 깎임 없음`, lv);
        if (target !== undefined) check('samples', Math.abs(lv.loudness_lufs_m - target) <= 1.5, `${name} 크기 ${target} ±1.5`, lv.loudness_lufs_m);
        if (!/흐름/.test(name)) check('samples', lv.audible_ms <= 420, `${name} 400ms 안`, lv.audible_ms); }
      const mp3 = file.replace(/\.wav$/, '.mp3'), made = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-b:a', '160k', mp3]);
      if (made.status === 0) fs.rmSync(file);
      check('samples', fs.existsSync(made.status === 0 ? mp3 : file), `${name} 표본`);
    }
    report.samples = table;
    fs.writeFileSync(path.join(dir, 'README.md'), ['# 잎 따기 손맛 소리 표본 (W8b, 귀검수용)', '', '게임과 같은 합성 코드(`experiences/synk-town/day-sfx.mjs`의 score·render·createBus)를 오프라인으로 그린 것. 사운드킷 규칙 4(400ms 이하·실패음 없음·사인·트라이앵글·C 펜타토닉). 짙은 잎 「사락」은 음이 없는 잡음뿐이다(틀림이 아니다). 따기는 잎마다 한 칸씩 오르고(미 · 솔 · 라) 마지막 잎은 도 · 미를 함께 울린다.', '',
      '| 표본 | 최고(dBFS) | 순간 음량(LUFS) | 목표 | 들리는 길이(ms) | 깎임 |', '|---|---|---|---|---|---|', ...table, ''].join('\n'));
  } finally { await page.close(); await f.close(); }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const scenes = { explore: exploreScene, pick: pickScene, give: giveScene, choices: choicesScene, simple: simpleScene, pad: padScene, widths: widthsScene, mic: micScene, samples: samplesScene };
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
