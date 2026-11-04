'use strict';
// 게시판 해독 — WORLD 앱(이 PC 시범 서버) 안에서 「놀이」 잠김 → 길 안내 → 열림 → 게임 틀 안에서 입구 → 세탁실 한 판 끝까지.
// 넘침 · 콘솔 오류 · 실패한 요청을 잰다. 찰칵 낱말 앱화면.cjs와 같은 꼴.
//   WORLD 앱: SYNK_TALK_ROOT=<SYNK-talk> SYNK_WORLD_PORT=4304 node experiences/synk-world-app/server.mjs
//   WORLD_URL=http://127.0.0.1:4304 node experiences/board-decode/qa/앱화면.cjs <출력 폴더>
const path = require('node:path'), fs = require('node:fs');
const { chromium } = require('playwright');
const { 화면시험, 닫기 } = require('../../../tools/lib/화면시험.cjs');
const BASE = process.env.WORLD_URL || 'http://127.0.0.1:4304';
const OUT = process.argv[2] || path.join(__dirname, '화면');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(name, view) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
  const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: view.width < 700 ? 2 : 1, hasTouch: view.width < 700, isMobile: view.width < 700, reducedMotion: process.env.QA_REDUCED ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage(), errors = [], failed = [], notes = {};
  page.setDefaultTimeout(25000);
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && !/\/api\/world\/bootstrap$/.test(new URL(r.url()).pathname)) failed.push(`${r.status()} ${r.url()}`); });
  const shot = async (label) => { await page.mouse.move(2, 2); await page.screenshot({ path: path.join(OUT, `${name}_${label}.png`) }); };
  const game = () => page.frames().find((x) => x.url().includes('/board-decode/'));
  await page.goto(`${BASE}/${view.width < 700 ? 'mobile' : 'desktop'}.html?opening=off`);
  await page.getByText('계속하기', { exact: true }).click();
  await page.getByText('읽을 수 있어요', { exact: true }).click();
  await page.locator('button:has-text("함께하기")').first().click();
  await page.locator('[data-tutor-action=finish]').click();
  await sleep(1200);
  await page.locator('[data-view=play]').first().click();
  await page.waitForSelector('[data-game=board]');
  notes.lockedBefore = await page.locator('[data-game=board]').getAttribute('data-locked') !== null;
  notes.lockText = (await page.locator('[data-game=board] .play-lock').textContent())?.trim();
  await page.locator('[data-game=board]').scrollIntoViewIfNeeded();
  await shot('01_놀이_잠김');
  await page.locator('[data-game=board]').click({ force: true });
  await sleep(900);
  notes.lockedStaysHome = (await page.locator('.game-frame').count()) === 0;
  await shot('02_잠김_길안내');
  // 한 번 열린 판(「새로 열림」을 본 판)은 기록이 없어도 열린다. 실력 기록 규칙 자체는 synk-world-app/qa/town-check.test.mjs가 본다.
  await page.evaluate(() => { for (const key of Object.keys(localStorage)) if (key.startsWith('synk.world.play-seen.')) localStorage.removeItem(key); const owner = Object.keys(localStorage).find((k) => k.startsWith('synk.life-korean.progress.v1:'))?.split(':').slice(1).join(':') || 'guest'; localStorage.setItem(`synk.world.play-seen.${owner}`, JSON.stringify(['board'])); });
  await page.goto(`${BASE}/${view.width < 700 ? 'mobile' : 'desktop'}.html?opening=off`);
  await sleep(1500);
  await page.locator('[data-view=play]').first().click();
  await page.waitForSelector('[data-game=board]');
  notes.lockedAfter = await page.locator('[data-game=board]').getAttribute('data-locked') !== null;
  await page.locator('[data-game=board]').scrollIntoViewIfNeeded();
  await shot('03_놀이_열림');
  await page.locator('[data-game=board]').click();
  await page.waitForSelector('.game-frame');
  for (let i = 0; i < 100 && !game(); i += 1) await sleep(100);
  const f = game();
  await f.waitForFunction(() => !!window.__board);
  await sleep(1200);
  await shot('04_입구');
  await f.click('[data-tear="1"]'); await sleep(1000);
  await shot('05_세탁실');
  await f.click('.w >> nth=0'); await sleep(700);
  await f.click('[data-memo] >> nth=0'); await sleep(600);
  await shot('06_단서메모');
  await f.click('[data-clue-x]');
  const right = () => f.evaluate(() => { const s = window.__board.state(); const list = s.phase === 'patch' ? s.patchOrder : s.order[s.slot]; const k = ['f1', 'f2'][s.slot]; return list.findIndex((o) => (s.phase === 'patch' ? o.ok === true : o.ok === s.fork[k])); });
  await f.click(`[data-reply="${await right()}"]`); await sleep(600);
  await f.click(`[data-reply="${await right()}"]`); await sleep(1700);
  await shot('07_정정');
  await f.click(`[data-reply="${await right()}"]`); await sleep(1500);
  await shot('08_끝');
  notes.words = await f.evaluate(() => Object.keys(window.__board.save().words));
  notes.overflow = await f.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  // 학습 기록에 ko2 사건이 남지 않았는지
  notes.ko2Events = await page.evaluate(() => { const ev = window.__synkEducation?.townEvidence?.(); return (ev?.events || []).filter((e) => JSON.stringify(e).includes('board-decode')).length; });
  return { name, errors, failed, notes };
  } finally { await 닫기(browser); }
}

화면시험({ 분: 20 }, async () => {
  const out = [];
  out.push(await run('폰', { width: 390, height: 844 }));
  out.push(await run('넓음', { width: 1280, height: 800 }));
  console.log(JSON.stringify(out, null, 1));
});
