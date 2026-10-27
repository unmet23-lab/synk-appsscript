// The returning visit and the mascot's question on the town screen QA (W6b, vertical slice design §10-2·§20-3·§20-4·§20-5).
// Each scene runs its own store whose clock starts at a chosen Korean instant. 「그동안 달라진 것」: a window's pulse opens a visit,
// the clock jumps days ahead (an absence the village lives through), the next pulse opens the visit that shows the board — once,
// first line large, the rest under 「더 보기」, only lines in sight count as seen. The questions: a one-file store is given the
// world the engine asks in (the player opened cafe life four times itself · the visit did something with a resident), the page
// walks to the cafe and stands there, and the next safe boundary opens the question: the card draws (「아니요」 first), its drawn
// key rides a boundary (asked — no command), and the answer is the town's command. The notebook shows the time-of-day switch
// and the evaluation record's row (stop with one more confirm). Captures at 1440 and 390 (reduced motion).
//   node experiences/synk-town/qa-ask-ui.cjs [--out <dir>] [--only meanwhile,taste,consent]
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const output = path.resolve(arg('--out', path.join(__dirname, '../../.tmp/town-w6b-ask')));
const only = arg('--only', '') ? new Set(arg('--only', '').split(',')) : null;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const kst = (date, time) => Date.parse(`${date}T${time}:00+09:00`);
const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const DEVICES = { desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: 'reduce' },
  // The short windows the final review measured (F1): a small phone and a phone held sideways.
  small: { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' }, landscape: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: 'reduce' } };
const known404 = /avatar-textiles-v1/;
const report = { started: new Date().toISOString(), scenes: {}, failures: [] };
const check = (scene, ok, what, detail) => { (report.scenes[scene] ||= { checks: [] }).checks.push({ ok: !!ok, what, ...(detail === undefined ? {} : { detail }) }); if (!ok) report.failures.push(`${scene}: ${what}${detail === undefined ? '' : ` — ${JSON.stringify(detail).slice(0, 400)}`}`); };
const town = file => import(pathToFileURL(path.join(__dirname, file)).href);
const NUMBERS = /[0-9０-９]|번째|일째|연속/;
const PERIOD = /며칠|오랜만|만에|그\s?사이|기다[리려렸]|보고\s?싶|왜\s?안|이제야|덕분에/;

/** A store and its preview server at a moved clock; with file, the world is the one-file shape the harness can edit. */
async function fixture(startMs, { file = null, clock = null } = {}) {
  const { createStore, createServer } = await town('server.mjs');
  const c = clock || { at: startMs, real: Date.now() }, now = () => c.at + (Date.now() - c.real);
  const store = createStore({ lifeEnabled: true, now, tz: 540, villageSeed: 'acct-w6b', sleeps: true, ...(file ? { file } : {}) });
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
const ROUTES = { cafe: [['z', 3.9], ['x', 0], ['z', 2.6]] };
/** Talk at the cafe (it becomes the player's place), close the panel and stand still: a safe point for the boundary. */
async function standAtCafe(page) {
  await walkTo(page, ROUTES.cafe);
  await page.waitForFunction(() => SYNKTownDay.metrics().walk.nearby === 'cafe', null, { timeout: 8000 });
  await page.keyboard.press('e');
  await page.waitForFunction(() => SYNKTownDay.metrics().walk.interactionOpen, null, { timeout: 10000 }); await delay(600);
  await page.keyboard.press('Escape'); await delay(600);
}
const shot = (page, name) => page.screenshot({ path: path.join(output, `${name}.jpg`), type: 'jpeg', quality: 82 });
const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
/** The world as saved in a one-file store: edit it and open a new store on it. */
function editWorld(file, edit) {
  const doc = JSON.parse(fs.readFileSync(file, 'utf8')), world = doc.state ?? doc.world ?? doc;
  edit(world); fs.writeFileSync(file, JSON.stringify(doc));
}

/** 「그동안 달라진 것」 on a desktop and a phone. */
async function meanwhile(browser) {
  const f = await fixture(kst('2026-10-24', '09:00'));
  try {
    const pulse = () => f.store.pulse({ surfaceId: 'qa-meanwhile', surface: 'day', foreground: true, safe: true });
    pulse(); f.store.read();
    // The village lives through an absence until a returning visit has lines (the settlement chooses them, at most three).
    let lines = [];
    // A visit opens on the first step a window holds after the last one ended: pulse a few seconds before reading.
    for (let day = 1; day <= 7 && !lines.length; day++) {
      f.set(kst('2026-10-24', '09:00') + day * DAY + 80 * MIN); pulse();
      for (let i = 0; i < 5; i++) { f.set(f.now() + 1000); pulse(); }
      lines = f.store.read().view.day.scene.village.meanwhile?.lines || [];
    }
    check('meanwhile', lines.length > 0 && lines.length <= 3, '돌아온 방문에 달라진 것 1~3줄', lines);
    const { PRESENCE_LEASE_MS } = await town('presence.mjs');
    for (const device of ['desktop', 'phone']) {
      f.set(f.now() + PRESENCE_LEASE_MS + 500);
      const s = await open(browser, f, { device });
      try {
        await s.page.waitForFunction(() => SYNKTownDay.metrics().notices.meanwhile, null, { timeout: 15000 }).catch(() => {});
        const board = (await notices(s.page)).meanwhile, words = await s.page.$eval('#meanwhile-card', el => el.textContent).catch(() => '');
        check('meanwhile', board && board.lines.length === 1 && board.lines[0] === lines[0].id, `${device}: 판이 서고 첫 줄만 보인다`, board);
        check('meanwhile', !NUMBERS.test(words) && !PERIOD.test(words.replace('그동안 달라진 것', '')), `${device}: 판에 숫자·날짜·기간 말 없음`, words);
        await shot(s.page, `meanwhile-${device}-1`);
        await delay(1600);
        const pending = await s.page.evaluate(() => SYNKTownDay.metrics().cards.seenPending);
        check('meanwhile', pending.includes(`line:${lines[0].id}`) && lines.slice(1).every(l => !pending.includes(`line:${l.id}`)), `${device}: 보인 첫 줄만 본 것(접힌 줄은 아직)`, pending);
        const camera = await s.page.$eval('#camera-toggle', el => el.getBoundingClientRect().toJSON()), map = await s.page.$eval('#town-map', el => ({ ...el.getBoundingClientRect().toJSON(), visible: getComputedStyle(el).visibility }));
        check('meanwhile', !overlap(board.rect, camera) && (map.visible === 'hidden' || !overlap(board.rect, map)), `${device}: 판이 시점 단추·지도를 덮지 않는다`, { board: board.rect, camera, map });
        if (lines.length > 1) {
          await s.page.click('.meanwhile-more'); await delay(1700);
          const opened = (await notices(s.page)).meanwhile, after = await s.page.evaluate(() => SYNKTownDay.metrics().cards.seenPending);
          check('meanwhile', opened.lines.length === lines.length && lines.every(l => after.includes(`line:${l.id}`)), `${device}: 더 보기 → 나머지 줄도 보이고 본 것으로`, { opened, after });
          await shot(s.page, `meanwhile-${device}-2-more`);
        }
        await s.page.click('.meanwhile-close'); await delay(400);
        check('meanwhile', !(await notices(s.page)).meanwhile, `${device}: 닫으면 이 방문에는 다시 안 뜬다`);
        await walkTo(s.page, [['z', 3.9]]); await delay(500);
        check('meanwhile', !(await notices(s.page)).meanwhile, `${device}: 걸어도 다시 안 뜬다`);
        check('meanwhile', !s.errors.length, `${device}: 오류·실패 요청 0`, s.errors);
      } finally { await s.close(); }
    }
  } finally { await f.stop(); }
}

/** A world the engine asks in: the one-file store saved after a window's first pulse, edited, then opened again. */
async function askWorld(name, edit) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `qa-ask-${name}-`)), file = path.join(dir, 'town.json');
  const first = await fixture(kst('2026-10-26', '13:00'), { file });
  // The visit opens on the first steps the window holds (a few seconds of pulses), then the world is edited.
  const pulse = () => first.store.pulse({ surfaceId: `qa-${name}`, surface: 'day', foreground: true, safe: true });
  pulse(); for (let i = 0; i < 5; i++) { first.set(first.now() + 1000); pulse(); } first.store.read();
  const clock = first.clock; await first.stop();
  editWorld(file, world => edit(world, world.village.band.lifeDay));
  const f = await fixture(null, { file, clock });
  const { PRESENCE_LEASE_MS } = await town('presence.mjs');
  f.set(f.now() + PRESENCE_LEASE_MS + 500);
  return f;
}
const CAFE_USES = ['C1', 'C2', 'C3', 'C6'].map(card => ({ useId: `20000.day.${card}`, canonicalActivityId: `card.${card}`, storyFamily: 'cafe-life', direct: true }));
/** Waits for the question to stand on the screen (the first safe boundary after the visit's first 45 seconds). */
async function waitAsk(s, kind) {
  await s.page.waitForFunction(k => SYNKTownDay.metrics().notices.ask?.kind === k, kind, { timeout: 180000 });
  await delay(400);
  return (await notices(s.page)).ask;
}

/** The taste question: drawn, reported beside a boundary, answered 「아니요」 (desktop) and 「네」 (phone). */
async function taste(browser) {
  for (const [device, answer] of [['desktop', 'no'], ['phone', 'yes']]) {
    const f = await askWorld(`taste-${device}`, (world, lifeDay) => { world.recentLifeUse = CAFE_USES; world.townVisit = { ...world.townVisit, firstDay: lifeDay - 1 }; });
    try {
      const s = await open(browser, f, { device });
      try {
        await standAtCafe(s.page);
        const ask = await waitAsk(s, 'taste');
        const words = await s.page.$eval('#ask-card', el => el.textContent), first = await s.page.$eval('#ask-card .ask-actions .felt', el => ({ answer: el.dataset.answer, primary: el.classList.contains('primary') }));
        check('taste', ask.key === 'taste:cafe-life' && /찻집 일을 먼저 보여 드릴까요/.test(words), `${device}: 마스코트 카드에 취향 물음`, { ask, words });
        check('taste', first.answer === 'no' && first.primary, `${device}: 「아니요」가 먼저이고 기본 단추`, first);
        check('taste', await s.page.$eval('#ask-card img', img => img.complete && img.naturalWidth > 0 && /mongle-taste\.webp/.test(img.src)), `${device}: 몽글 그림이 뜬다(튜터를 모르는 기기)`);
        check('taste', await s.page.evaluate(() => !document.querySelector('dialog[open]')), `${device}: 모달이 아니다(대화 상자 없음)`);
        await shot(s.page, `taste-${device}-1-card`);
        // The drawn key rides the next boundary (never a command): the host counts it and shows the family as observed.
        await s.page.waitForFunction(() => !SYNKTownDay.metrics().notices.askReport && SYNKTownDay.metrics().notices.ask?.drawn, null, { timeout: 60000 }).catch(() => {});
        const told = s.boundaries.find(b => b.body.asked === 'taste:cafe-life'), saved = f.store.peek().state;
        check('taste', !!told && told.body.caps?.includes('asks'), `${device}: 그린 물음을 경계 신호 옆에 보냈다(caps asks)`, s.boundaries.map(b => ({ caps: b.body.caps, asked: b.body.asked })));
        check('taste', !s.commands.some(c => c.body.type === 'ASK_ACK') && saved.asks.open?.delivered === true && saved.prefs.observed === 'cafe-life', `${device}: 명령 없이 그린 것으로 셈`, saved.asks);
        await s.page.click(`#ask-card [data-answer="${answer}"]`);
        await s.page.waitForFunction(() => !SYNKTownDay.metrics().notices.ask, null, { timeout: 10000 }).catch(() => {});
        const after = f.store.peek().state;
        check('taste', !(await notices(s.page)).ask && after.asks.open === undefined, `${device}: 답하면 카드가 거둬진다`);
        check('taste', answer === 'no' ? after.prefs.denied.includes('cafe-life') : after.prefs.preferredFamily === 'cafe-life', `${device}: 답(${answer})이 취향에 남는다`, after.prefs);
        if (answer === 'yes') {
          await s.page.click('#journal-open'); await s.page.waitForSelector('#notebook-dialog[open]'); await s.page.click('#notebook-tab-memory'); await delay(400);
          const page = await s.page.$eval('#notebook-page', el => el.textContent);
          check('taste', /먼저 보여 줄 생활 · 찻집 생활/.test(page) && /내가 자주 오는 때에 맞춰 마을 자리를 채워요/.test(page), `${device}: 수첩에 먼저 보여 줄 생활과 자주 오는 때 줄`, page.slice(0, 300));
          const tabs = await s.page.$eval('.notebook-tabs', el => ({ scroll: el.scrollWidth, client: el.clientWidth, rows: new Set([...el.children].map(c => Math.round(c.getBoundingClientRect().top))).size }));
          check('taste', tabs.scroll <= tabs.client + 1, `${device}: 좁은 폭 수첩 탭이 가로로 넘치지 않는다(F6)`, tabs);
          await shot(s.page, `taste-${device}-2-notebook`);
          await s.page.click('#notebook-page [data-focus^="set:내가 자주 오는 때"]'); await delay(600);
          check('taste', f.store.peek().state.visitBands.off === true && /꺼 둠/.test(await s.page.$eval('#notebook-page', el => el.textContent)), `${device}: 자주 오는 때 끄기 → 꺼 둠(PREF_VISIT_BANDS)`);
          await s.page.keyboard.press('Escape'); await delay(300);
        }
        check('taste', !s.errors.length, `${device}: 오류·실패 요청 0`, s.errors);
      } finally { await s.close(); }
    } finally { await f.stop(); }
  }
}

/** The consent question: the contract's easy version with the picture, 「자세히」, 「아니요」 (desktop) and 「좋아요」 → the
 * notebook's row → 「그만 쓰기」 with one more confirm (phone). The tutor this device remembers draws its own picture. */
async function consent(browser) {
  const { EVAL_CONSENT } = await town('town/data.gen.mjs');
  for (const [device, answer] of [['desktop', 'no'], ['phone', 'yes'], ['small', 'no'], ['landscape', 'no']]) {
    const f = await askWorld(`consent-${device}`, (world, lifeDay) => { world.recentLifeUse = []; world.townVisit = { ...world.townVisit, firstDay: lifeDay - 1, done: true }; });
    try {
      const s = await open(browser, f, { device });
      try {
        if (device === 'phone') { await s.page.evaluate(() => localStorage.setItem('synk.world.tutor.v1:acct-qa', JSON.stringify({ version: 1, completed: true, tutor: 'marin' }))); await s.page.reload();
          await s.page.waitForFunction(() => globalThis.SYNKTownDay?.metrics()?.assetsReady && SYNKTownDay.metrics().walk?.enabled, null, { timeout: 120000 }); await delay(1200); s.boundaries.length = 0; }
        await standAtCafe(s.page);
        const ask = await waitAsk(s, 'consent');
        const words = await s.page.$eval('#ask-card', el => el.innerText);
        check('consent', [EVAL_CONSENT.easy.ask, EVAL_CONSENT.easy.where, EVAL_CONSENT.easy.keep].every(t => words.includes(t)), `${device}: 계약의 쉬운 판 문구 그대로`, words.slice(0, 300));
        const img = await s.page.$eval('#ask-card img', el => ({ ok: el.complete && el.naturalWidth > 0, src: el.src }));
        check('consent', img.ok && (device === 'phone' ? /marin-consent/.test(img.src) : /mongle-consent/.test(img.src)), `${device}: 그림(${device === 'phone' ? '마린 — 이 기기의 튜터' : '몽글'})`, img);
        await shot(s.page, `consent-${device}-1-card`);
        // The card stays inside the notices: inside the window, off the joystick, the talk button and the status line; its
        // answers are reachable (in sight, or by scrolling the card itself — final review F1).
        const fit = await s.page.evaluate(() => { const card = document.getElementById('ask-card').getBoundingClientRect(), hud = ['walk-joystick', 'walk-interact', 'walk-status']
          .map(id => document.getElementById(id)).filter(el => el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width).map(el => ({ id: el.id, r: el.getBoundingClientRect().toJSON() }));
          const c = document.getElementById('ask-card'); return { card: card.toJSON(), inner: innerHeight, hud, scrolls: c.scrollHeight > c.clientHeight + 1 }; });
        check('consent', fit.card.bottom <= fit.inner + 1 && fit.card.top >= 0, `${device}: 카드가 창 안에 선다`, fit.card);
        check('consent', fit.hud.every(h => !overlap({ x: fit.card.left, y: fit.card.top, width: fit.card.width, height: fit.card.height }, { x: h.r.left, y: h.r.top, width: h.r.width, height: h.r.height })), `${device}: 카드가 조이스틱·이야기 단추·상태 줄을 덮지 않는다`, fit);
        // The picture keeps its own row: it never lies over the mascot's name or the question (a squashed grid row did, F1 fix).
        const rows = await s.page.evaluate(() => ['.ask-picture', '.ask-head', '#ask-line'].map(sel => document.querySelector(`#ask-card ${sel}`).getBoundingClientRect().toJSON()));
        const [pic, head, ln] = rows.map(r => ({ x: r.left, y: r.top, width: r.width, height: r.height }));
        check('consent', !overlap(pic, head) && !overlap(pic, ln) && pic.height > 40, `${device}: 그림이 이름 줄·물음과 겹치지 않는다`, rows);
        await s.page.locator(`#ask-card [data-answer="${answer}"]`).scrollIntoViewIfNeeded();
        if (device === 'desktop') {
          await s.page.click('#ask-card .ask-more'); await delay(300);
          const detail = await s.page.$eval('#ask-detail', el => ({ hidden: el.hidden, text: el.innerText }));
          check('consent', !detail.hidden && detail.text.includes(EVAL_CONSENT.detail.notUsed) && detail.text.includes(EVAL_CONSENT.detail.contact), `${device}: 자세히 → 전체 문안`, detail.text.slice(0, 200));
          await shot(s.page, `consent-${device}-2-detail`);
        }
        await s.page.waitForFunction(() => SYNKTownDay.metrics().notices.ask?.drawn, null, { timeout: 10000 }).catch(() => {});
        await s.page.click(`#ask-card [data-answer="${answer}"]`);
        await s.page.waitForFunction(() => !SYNKTownDay.metrics().notices.ask, null, { timeout: 10000 }).catch(() => {});
        const after = f.store.peek().state;
        check('consent', after.consents.evalSignals.state === (answer === 'yes' ? 'granted' : 'declined') && after.asks.open === undefined && after.asks.asked.consent !== undefined, `${device}: 답(${answer})이 동의 상태로, 다시 먼저 묻지 않음`, { consents: after.consents, asks: after.asks });
        if (answer === 'yes') {
          await s.page.click('#journal-open'); await s.page.waitForSelector('#notebook-dialog[open]'); await s.page.click('#notebook-tab-memory'); await delay(400);
          const page = await s.page.$eval('#notebook-page', el => el.textContent);
          check('consent', /마을을 낫게 하는 데 쓰는 기록/.test(page) && /쓰고 있어요/.test(page), `${device}: 수첩에 「쓰고 있어요」`, page.slice(0, 300));
          await s.page.locator('#notebook-page [data-focus="eval:stop"]').scrollIntoViewIfNeeded(); await shot(s.page, `consent-${device}-2-notebook`);
          await s.page.click('#notebook-page [data-focus="eval:stop"]'); await delay(300);
          check('consent', await s.page.$('#notebook-page [data-focus="confirm:EVAL_STOP"]') !== null, `${device}: 그만 쓰기는 한 번 더 묻는다`);
          await s.page.click('#notebook-page [data-focus="confirm:EVAL_STOP"]'); await delay(700);
          check('consent', f.store.peek().state.consents.evalSignals.state === 'withdrawn' && /쓰지 않고 있어요/.test(await s.page.$eval('#notebook-page', el => el.textContent)), `${device}: 그만 쓰기 → 철회`);
          await s.page.keyboard.press('Escape'); await delay(300);
        }
        check('consent', !s.errors.length, `${device}: 오류·실패 요청 0`, s.errors);
      } finally { await s.close(); }
    } finally { await f.stop(); }
  }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
  const scenes = { meanwhile, taste, consent };
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
