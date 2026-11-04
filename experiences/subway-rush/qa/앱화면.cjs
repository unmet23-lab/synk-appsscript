'use strict';
// 환승 러시(2026-11-04) — WORLD 앱(이PC 시범 서버) 안에서 「놀이」 잠김 → 생활 레슨(싱크타운 카페 첫 방문) 하나 마침 → 열림 · 바람길 카드 내림 → 게임 틀 안 입구 · 한 판을 찍는다.
// 넘침 · 콘솔 오류 · 실패한 요청을 함께 적는다. 게임은 틀 안에서 직접 손짓으로 끝까지 간다(자동 진행 표시 없이 — 실제 입구에서 단말기를 누른다).
//   WORLD 앱: SYNK_TALK_ROOT=<SYNK-talk> SYNK_WORLD_PORT=4297 node experiences/synk-world-app/server.mjs
//   node experiences/subway-rush/qa/앱화면.cjs   (주소 WORLD_URL, 기본 http://127.0.0.1:4297 · 찍은 것은 공용 작업본 .tmp/subway-rush-20261104/앱화면/)
const path = require('node:path'), fs = require('node:fs');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../node_modules')] }));
const { 화면시험, 닫기 } = require('../../../tools/lib/화면시험.cjs');
const { 공용작업본 } = require('../../../tools/lib/공용작업본.js');
const BASE = process.env.WORLD_URL || 'http://127.0.0.1:4297';
const OUT = path.join(공용작업본(path.resolve(__dirname, '../../..')), '.tmp', 'subway-rush-20261104', '앱화면');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(name, view) {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--headless=new', '--autoplay-policy=no-user-gesture-required', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
  try {
  const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: 2, hasTouch: view.width < 700, isMobile: view.width < 700 });
  const page = await ctx.newPage(), errors = [], failed = [], notes = {};
  page.setDefaultTimeout(30000);
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && !/\/api\/world\/bootstrap$/.test(new URL(r.url()).pathname)) failed.push(`${r.status()} ${r.url()}`); });
  const shot = async (label) => { await page.mouse.move(2, 2); await page.screenshot({ path: path.join(OUT, `${name}_${label}.png`) }); };
  const frame = () => page.frameLocator('.game-frame');
  await page.goto(`${BASE}/${view.width < 700 ? 'mobile' : 'desktop'}.html?opening=off`);
  // 처음 실행: 화면 언어 → 한글 읽기 → 튜터
  await page.getByText('계속하기', { exact: true }).click();
  await page.getByText('읽을 수 있어요', { exact: true }).click();
  await page.locator('button:has-text("함께하기")').first().click();
  await page.locator('[data-tutor-action=finish]').click();
  await sleep(1200);
  // 「놀이」: 처음에는 환승 러시가 잠겨 있고 바람길이 그대로 있다
  await page.locator('[data-view=play]').first().click();
  await page.waitForSelector('[data-game=subway]');
  notes.lockedBefore = await page.locator('[data-game=subway]').getAttribute('data-locked') !== null;
  notes.lockText = (await page.locator('[data-game=subway] .play-lock').textContent())?.trim();
  notes.runnerBefore = await page.locator('[data-game=runner]').count();
  await page.locator('[data-game=subway]').scrollIntoViewIfNeeded();
  await shot('01_놀이_잠김');
  await page.locator('[data-game=subway]').click({ force: true });   // aria-disabled라 강제로 눌러 본다 — 게임이 열리면 안 된다
  await sleep(500);
  notes.lockedStaysHome = (await page.locator('.game-frame').count()) === 0;
  await page.locator('#panel-close').click();
  await sleep(500);
  // 생활 레슨 하나: 싱크타운 카페 첫 방문
  await page.evaluate(() => document.querySelector('[data-view=cafe]').click());
  await page.locator('.felt-button[data-life-lesson=cafe-apply]').click();
  const next = async () => { if (await page.locator('.cafe-welcome [data-life-cafe-mode=read]').count()) await page.locator('[data-life-cafe-mode=read]').click(); await page.locator('[data-life-cafe-next]:not([disabled])').click(); await sleep(700); };
  const choose = async (id) => { await page.locator(`[data-life-cafe-choice=${id}]:not([disabled])`).click(); await sleep(700); };
  await next(); await choose('b'); await next(); await choose('c'); await next(); await next(); await choose('a'); await next();
  await page.locator('#panel-close').click();
  await sleep(600);
  // 「놀이」: 열리고 바람길 카드는 내려간다
  await page.locator('[data-view=play]').first().click();
  await page.waitForSelector('[data-game=subway]');
  notes.lockedAfter = await page.locator('[data-game=subway]').getAttribute('data-locked') !== null;
  notes.runnerAfter = await page.locator('[data-game=runner]').count();
  notes.playNew = await page.locator('[data-game=subway]').getAttribute('data-new') !== null;
  await page.locator('[data-game=subway]').scrollIntoViewIfNeeded();
  await shot('02_놀이_열림');
  await page.locator('[data-game=subway]').click();
  await page.waitForSelector('.game-frame');
  const f = frame();
  await f.locator('#reader').waitFor();
  await f.locator('html[data-ready]').waitFor({ timeout: 60000 });
  await sleep(1500);
  notes.host = await f.locator('html').getAttribute('data-host');
  notes.mascot = await f.locator('img[src*="mongle"],img[src*="kkamong"],img[src*="marin"]').count();
  await shot('03_게임_입구');
  // 단말기를 눌러 출발 → 고를 차례마다 정답(자동 표시 없이 실제 칸을 누른다) · 만남은 첫 대답
  await f.locator('#reader').click();
  const t0 = Date.now(); let shots = 0, picks = 0, wrong = false;
  while (Date.now() - t0 < 420000) {
    await sleep(700);
    const st = await f.locator('html').evaluate(() => ({ done: document.documentElement.dataset.done || '', err: document.body.dataset.error || '', zones: !document.getElementById('zones').hidden, replies: !document.getElementById('replies').hidden }));
    if (st.err) { notes.gameError = st.err; break; }
    if (st.done) break;
    if (st.replies) { if (shots < 6) { await shot(`04_만남${++shots}`); } await f.locator('#replies button').first().click(); await sleep(400); continue; }
    if (st.zones) {
      await sleep(500);
      if (picks === 0) await shot('05_첫_고르기');
      // 첫 판은 가운데, 둘째는 왼쪽 … 틀려도 늘 도착하는지 함께 본다
      const i = picks % 3; picks += 1;
      await f.locator(`#zones button`).nth(i).click();
      await sleep(600);
      if (!wrong && !(await f.locator('#notice').evaluate((n) => n.hidden))) { wrong = true; await shot('06_쪽지'); }
    }
  }
  notes.picks = picks; notes.seconds = Math.round((Date.now() - t0) / 1000);
  await sleep(2500);
  await shot('07_결과');
  await f.locator('#result').evaluate((r) => { r.scrollTop = r.scrollHeight; });
  await sleep(600);
  await shot('08_결과_아래');
  notes.resultOverflow = await f.locator('#result').evaluate((r) => r.scrollWidth > r.clientWidth + 1);
  notes.coin = (await f.locator('#coin-row').textContent().catch(() => ''))?.trim();
  // 「우리 동네로」
  await f.locator('#btn-home').click();
  await sleep(1500);
  notes.backHome = (await page.locator('.game-frame').count()) === 0;
  await shot('09_돌아옴');
  console.log(JSON.stringify({ name, ...notes, errors: errors.slice(0, 12), failed: failed.slice(0, 12) }, null, 0));
  } finally { await 닫기(browser); }
}
화면시험({ 분: 20 }, async () => { await run('폰', { width: 390, height: 844 }); await run('넓은창', { width: 1280, height: 800 }); });
