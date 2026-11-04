'use strict';
// 게시판 해독 공개 후보를 실제 공개본 위에서 돌려 본다(2026-11-04, 말의 리듬 후보시험에서): 브라우저 요청 가운데 synk.im/world/의 후보 파일만 후보 폴더에서 내주고 나머지는 지금 공개본 그대로 받는다. 공개본은 바꾸지 않는다.
// ① 공개본 묶음에 넣은 topik2Near가 원천과 같은 답을 내는지 ② 손님으로 연 「놀이」에 잠긴 카드와 길 안내가 나오는지 ③ 게임 틀에서 세탁실 한 판을 끝까지.
//   node experiences/board-decode/qa/후보시험.cjs <후보 new 폴더> <사건 JSON — 후보시험자료.mjs가 쓴다> <사진 폴더>
const path = require('node:path'), fs = require('node:fs');
const { chromium } = require('playwright');
const [DIR, CASES, OUT] = process.argv.slice(2);
if (!DIR || !CASES || !OUT) throw Error('사용법은 파일 머리글');
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.json': 'application/json', '.woff2': 'font/woff2' };
const FRAME = 'https://synk.im/world/__board_frame__';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(view) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: 1, hasTouch: view.width < 700, isMobile: view.width < 700 });
  const page = await ctx.newPage(), errors = [], failed = [], served = new Set();
  page.setDefaultTimeout(30000);
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith('https://synk.im/world/') && !r.url().includes('/api/')) failed.push(`${r.status()} ${r.url()}`); });
  await page.route('https://synk.im/world/**', async (route) => {
    const u = new URL(route.request().url()), rel = decodeURIComponent(u.pathname).replace(/^\//, '');
    if (u.href.startsWith(FRAME)) return route.fulfill({ contentType: TYPES['.html'], body: '<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><link rel=icon href=data:,><style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%;display:block}</style><iframe class="game-frame" allow="autoplay" src="/world/board-decode/index.html?seed=7"></iframe>' });
    const file = path.join(DIR, rel);
    if (fs.existsSync(file) && fs.statSync(file).isFile()) { served.add(rel); return route.fulfill({ contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) }); }
    return route.continue();
  });
  return { browser, page, errors, failed, served };
}

async function nearCheck(cases) {
  const { browser, page, errors } = await open({ width: 800, height: 600 });
  await page.goto('https://synk.im/world/mobile.html?opening=off', { waitUntil: 'domcontentloaded' });
  const out = await page.evaluate(async (list) => {
    const W = await import('/world/world-account.bundle.mjs');
    return list.map((c) => ({ name: c.name, expected: c.expected, got: W.worldTownCheck.topik2Near(c.input), policy: W.worldTownCheck.TOPIK2_NEAR }));
  }, cases);
  await browser.close();
  return { out, errors: errors.filter((e) => /topik2|TOPIK2/.test(e)) };
}

async function guestHome(name, view) {
  const { browser, page, errors, failed, served } = await open(view);
  await page.goto(`https://synk.im/world/${view.width < 700 ? 'mobile' : 'desktop'}.html?opening=off`);
  const click = async (text) => { const hit = page.getByText(text, { exact: true }); if (await hit.count()) await hit.first().click().catch(() => {}); };
  await sleep(2500);
  await click('계속하기'); await sleep(800);
  await click('읽을 수 있어요'); await sleep(800);
  const buddy = page.locator('button:has-text("함께하기")'); if (await buddy.count()) await buddy.first().click().catch(() => {});
  const finish = page.locator('[data-tutor-action=finish]'); if (await finish.count()) await finish.click().catch(() => {});
  await sleep(1200);
  const notes = {};
  await page.locator('[data-view=play]').first().click();
  await page.waitForSelector('[data-game=board]');
  const card = page.locator('[data-game=board]');
  notes.locked = await card.getAttribute('data-locked') !== null;
  notes.lockText = (await card.locator('.play-lock').textContent())?.trim();
  notes.snapStill = await page.locator('[data-game=snap]').count();
  notes.overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await card.scrollIntoViewIfNeeded();
  await sleep(400);
  await page.screenshot({ path: path.join(OUT, `${name}_놀이.png`) });
  await card.click({ force: true });
  await sleep(1000);
  notes.frameOpened = await page.locator('.game-frame').count();
  await page.screenshot({ path: path.join(OUT, `${name}_잠김눌림.png`) });
  await browser.close();
  return { name, notes, errors, failed, served: [...served].filter((f) => !f.includes('board-decode/')) };
}

async function round(name, view) {
  const { browser, page, errors, failed, served } = await open(view);
  await page.goto(FRAME);
  const game = () => page.frames().find((f) => f.url().includes('/board-decode/'));
  for (let i = 0; i < 100 && !game(); i += 1) await sleep(100);
  const f = game();
  await f.waitForFunction(() => !!window.__board);
  await sleep(1000);
  await page.screenshot({ path: path.join(OUT, `${name}_입구.png`) });
  await f.click('[data-tear="1"]'); await sleep(1000);
  const right = () => f.evaluate(() => { const s = window.__board.state(); const list = s.phase === 'patch' ? s.patchOrder : s.order[s.slot]; const k = ['f1', 'f2'][s.slot]; return list.findIndex((o) => s.phase === 'patch' ? o.ok === true : o.ok === s.fork[k]); });
  await f.click('.w >> nth=0'); await sleep(600);
  await f.click('[data-memo] >> nth=0'); await sleep(500);
  await f.click('[data-clue-x]');
  await f.click(`[data-reply="${await right()}"]`); await sleep(600);
  await f.click(`[data-reply="${await right()}"]`); await sleep(1700);
  await page.screenshot({ path: path.join(OUT, `${name}_정정.png`) });
  await f.click(`[data-reply="${await right()}"]`); await sleep(1500);
  await page.screenshot({ path: path.join(OUT, `${name}_끝.png`) });
  const notes = { words: await f.evaluate(() => Object.keys(window.__board.save().words)), overflow: await f.evaluate(() => document.documentElement.scrollWidth - innerWidth), photos: await f.evaluate(() => performance.getEntriesByType('resource').filter((e) => /photo\//.test(e.name)).length) };
  await browser.close();
  return { name, notes, errors, failed, fromCandidate: served.size };
}

(async () => {
  const cases = JSON.parse(fs.readFileSync(CASES, 'utf8'));
  const result = { near: await nearCheck(cases) };
  result.home = [await guestHome('폰', { width: 390, height: 844 }), await guestHome('넓음', { width: 1280, height: 800 })];
  result.round = [await round('폰', { width: 390, height: 844 }), await round('넓음', { width: 1280, height: 800 })];
  console.log(JSON.stringify(result, null, 1));
  const bad = result.near.out.some((c) => c.got !== c.expected) || result.home.some((h) => !h.notes.locked || h.notes.frameOpened || h.notes.overflow > 0) || result.round.some((r) => r.errors.length || r.failed.length || r.notes.overflow > 0);
  console.log(bad ? '✗ 후보 시험 실패' : '✓ 후보 시험 통과');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
