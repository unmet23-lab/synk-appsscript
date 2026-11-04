'use strict';
// 주문 폭주 캠퍼스 판(2026-11-03) — WORLD 앱(이PC 시범 서버) 안에서 「놀이」 잠김 → 싱크타운 카페 첫 방문 → 열림 → 게임 틀 안 캠퍼스 판을 찍는다.
// 새 손님(기기 기록)으로 처음 실행(언어 · 한글 · 튜터)을 지나고, 카페 방문은 qa/cafe-browser.cjs의 순서(다음 → b → 다음 → c → 다음 → 다음 → a → 다음)를 따른다.
// 게임 틀 안에서는 주문 하나를 틀리게 서빙(다름 표정) → 고쳐 서빙(받음 표정) → 영업 끝(결과)까지 한다. 넘침 · 화면 밖 단추 · 콘솔 오류 · 실패한 요청도 본다.
//   WORLD 앱: SYNK_TALK_ROOT=<SYNK-talk> SYNK_WORLD_PORT=4297 node experiences/synk-world-app/server.mjs
//   node experiences/order-rush/qa/world-campus-20261103/앱화면.cjs   (주소 WORLD_URL, 기본 http://127.0.0.1:4297 · 찍은 것은 공용 작업본 .tmp/order-rush-world-20261103/화면/)
const path = require('node:path'), fs = require('node:fs');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const { 화면시험, 닫기 } = require('../../../../tools/lib/화면시험.cjs');
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const BASE = process.env.WORLD_URL || 'http://127.0.0.1:4297';
const OUT = path.join(공용작업본(path.resolve(__dirname, '../../../..')), '.tmp', 'order-rush-world-20261103', '화면');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let RECIPES = null;   // 주문 id → 컵들(core.mjs의 주문 표 — 게임 틀은 ?qa 없이 열려 확인 창이 없다)
const loadRecipes = async () => {
  const core = await import(require('node:url').pathToFileURL(path.resolve(__dirname, '../../core.mjs')).href);
  RECIPES = Object.fromEntries([...core.ORDERS, ...core.REVIEW, ...core.DELAYED_ORDERS].map((o) => [o.id, o.cups]));
};
/** 지금 손님 주문대로 컵을 만들어 서빙한다(컵을 비우고 처음부터). */
async function serveRight(f) {
  const id = await f.locator('html').evaluate(() => window.synkCafe?.current?.id || null);
  const cups = RECIPES[id];
  if (!cups) throw Error('주문을 모름: ' + id);
  while (await f.locator('#remove-cup').textContent() === '이 컵 빼기') await f.locator('#remove-cup').click();
  await f.locator('#remove-cup').click();
  for (const [i, cup] of cups.entries()) {
    if (i) await f.locator('#add-cup').click();
    if (cup.base) await f.locator(`[data-ingredient=${cup.base}]`).click();
    if (cup.milk) await f.locator('[data-ingredient=milk]').click();
    if (cup.temp === 'cold' && cup.ice) await f.locator('[data-ingredient=ice]').click();
    else if (cup.temp === 'cold') await f.locator('[data-ingredient=cold]').click();
    if (cup.sugar) await f.locator('[data-ingredient=sugar]').click();
  }
  await f.locator('#serve').click();
  return id;
}

async function run(name, view) {
  const browser = await chromium.launch();
  try {
  const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: 2, hasTouch: view.width < 700, isMobile: view.width < 700 });
  const page = await ctx.newPage(), errors = [], failed = [], notes = {};
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && !/\/api\/world\/bootstrap$/.test(new URL(r.url()).pathname)) failed.push(`${r.status()} ${r.url()}`); });
  const shot = async (label) => { await page.mouse.move(2, 2); await page.screenshot({ path: path.join(OUT, `${name}_${label}.png`) }); };   // 마우스가 단추 위에 남아 hover 테가 찍히지 않게
  const frame = () => page.frameLocator('.game-frame');
  await page.goto(`${BASE}/${view.width < 700 ? 'mobile' : 'desktop'}.html?opening=off`);
  // 처음 실행: 화면 언어 → 한글 읽기 → 튜터
  await page.getByText('계속하기', { exact: true }).click();
  await page.getByText('읽을 수 있어요', { exact: true }).click();
  await page.locator('button:has-text("함께하기")').first().click();
  await page.locator('[data-tutor-action=finish]').click();
  await sleep(1200);
  // 「놀이」: 처음에는 주문 폭주가 잠겨 있다
  await page.locator('[data-view=play]').first().click();
  await page.waitForSelector('[data-game=order]');
  notes.lockedBefore = await page.locator('[data-game=order]').getAttribute('data-locked') !== null;
  notes.lockText = (await page.locator('[data-game=order] .play-lock').textContent())?.trim();
  await page.locator('[data-game=order]').scrollIntoViewIfNeeded();
  await shot('01_놀이_잠김');
  await page.locator('[data-game=order]').click({ force: true });   // aria-disabled라 강제로 눌러 본다 — 게임이 열리면 안 된다
  await sleep(500);
  notes.lockedStaysHome = (await page.locator('.game-frame').count()) === 0;
  await page.locator('#panel-close').click();
  await sleep(500);
  // 싱크타운 카페 첫 방문
  await page.evaluate(() => document.querySelector('[data-view=cafe]').click());   // 휴대폰 배치에서는 동네 그림의 「카페」 칸 뒤에 숨은 단추
  await page.locator('.felt-button[data-life-lesson=cafe-apply]').click();
  const next = async () => { if (await page.locator('.cafe-welcome [data-life-cafe-mode=read]').count()) await page.locator('[data-life-cafe-mode=read]').click(); await page.locator('[data-life-cafe-next]:not([disabled])').click(); await sleep(700); };
  const choose = async (id) => { await page.locator(`[data-life-cafe-choice=${id}]:not([disabled])`).click(); await sleep(700); };
  await next(); await choose('b'); await next(); await choose('c'); await next(); await next(); await choose('a'); await next();
  notes.cafeResult = (await page.locator('#panel-title').textContent())?.trim();
  await page.locator('#panel-close').click();
  await sleep(600);
  // 「놀이」: 이제 열려 있다
  await page.locator('[data-view=play]').first().click();
  await page.waitForSelector('[data-game=order]');
  notes.lockedAfter = await page.locator('[data-game=order]').getAttribute('data-locked') !== null;
  await page.locator('[data-game=order]').scrollIntoViewIfNeeded();
  await shot('02_놀이_열림');
  await page.locator('[data-game=order]').click();
  await page.waitForSelector('.game-frame');
  const f = frame();
  await f.locator('#start').waitFor();
  await sleep(1500);
  notes.host = await f.locator('html').getAttribute('data-host');
  notes.mongleInFrame = await f.locator('img[src*="mongle"]').count();
  await shot('03_게임_입구');
  // 영업: 첫 손님 → 일부러 빈 컵을 서빙 → 다름 표정(손님이 무엇이 다른지 말한다) → 고쳐서 서빙 → 받음 표정
  await f.locator('#start').click();
  await sleep(4500);
  await shot('04_영업_주문');
  notes.first = await f.locator('html').evaluate(() => window.synkCafe?.current?.id || null);
  await f.locator('#serve').click();
  await sleep(900);
  notes.moodWrong = await f.locator('#guest').getAttribute('data-mood');
  await shot('05_영업_다름');
  await serveRight(f);
  await sleep(450);
  notes.moodRight = await f.locator('#guest').getAttribute('data-mood');
  await shot('06_영업_받음');
  // 나머지 일곱 주문: 손님이 오면 주문을 끝까지 듣고 맞게 서빙한다
  notes.served = [notes.first];
  for (let k = 0; k < 7; k += 1) {
    await sleep(1600);
    await f.locator('html').evaluate(() => new Promise((done) => { const t = Date.now(); const tick = () => { const c = window.synkCafe?.current; if (c?.audioCompleted || Date.now() - t > 12000) done(); else setTimeout(tick, 200); }; tick(); }));
    if (k === 2) await shot('06b_영업_다른손님');
    notes.served.push(await serveRight(f));
  }
  await f.locator('#results:not([hidden])').waitFor({ timeout: 8000 });
  await sleep(600);
  await shot('07_결과');
  notes.overflow = await f.locator('html').evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  return { name, view, notes, errors, failed };
  } finally { await 닫기(browser); }
}

화면시험({ 분: 20 }, async () => {
  await loadRecipes();
  const out = [];
  for (const [name, view] of [['390', { width: 390, height: 844 }], ['1280', { width: 1280, height: 800 }]]) {
    try { out.push(await run(name, view)); } catch (error) { out.push({ name, error: String(error) }); }
  }
  fs.writeFileSync(path.join(__dirname, '앱화면.json'), JSON.stringify({ at: new Date().toISOString(), base: BASE, out }, null, 1) + '\n');
  console.log(JSON.stringify(out, null, 1));
});
