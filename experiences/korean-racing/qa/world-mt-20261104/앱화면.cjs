'use strict';
// MT 바닷가 레이스(2026-11-04) — WORLD 앱(이PC 시범 서버) 안에서 「놀이」 잠김 → 열림 → 게임 틀 안 입구 → 자전거 고르기 → 연습 건너뛰기 → 한 판 → 결과를 찍는다.
// 잠김은 실제 기록으로 보고, 열림은 해금 표(play-unlocks.mjs)의 규칙만 바꿔 낸 판으로 본다 — 지도 이야기를 끝까지 하는 길은 qa/play-unlocks.test.mjs가 잰다.
// 넘침 · 콘솔 오류 · 실패한 요청 · 틀 안 마스코트 그림 · 학습 기록 호스트 상태도 본다.
//   WORLD 앱: .claude/launch.json 「WORLD앱MT」(포트 4306)
//   node experiences/korean-racing/qa/world-mt-20261104/앱화면.cjs   (주소 WORLD_URL · 찍은 것은 공용 작업본 .tmp/world-mt-20261104/앱/)
const path = require('node:path'), fs = require('node:fs');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const { 화면시험, 닫기 } = require('../../../../tools/lib/화면시험.cjs');
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const BASE = process.env.WORLD_URL || 'http://127.0.0.1:4306';
const OUT = path.join(공용작업본(path.resolve(__dirname, '../../../..')), '.tmp', 'world-mt-20261104', '앱');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(name, view, 끝까지) {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--headless=new', '--autoplay-policy=no-user-gesture-required', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
  const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: view.width < 700 ? 2 : 1, hasTouch: view.width < 700, isMobile: false });
  const page = await ctx.newPage(), errors = [], failed = [], notes = {};
  page.setDefaultTimeout(30000);
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && !/\/api\/world\/bootstrap$/.test(new URL(r.url()).pathname)) failed.push(`${r.status()} ${r.url()}`); });
  const shot = async (label) => { await page.mouse.move(2, 2); await page.screenshot({ path: path.join(OUT, `${name}_${label}.jpg`), type: 'jpeg', quality: 86 }); };
  const entry = `${BASE}/${view.width < 700 ? 'mobile' : 'desktop'}.html?opening=off`;
  try {
  await page.goto(entry);
  // 처음 실행: 화면 언어 → 한글 읽기 → 튜터
  await page.getByText('계속하기', { exact: true }).click();
  await page.getByText('읽을 수 있어요', { exact: true }).click();
  await page.locator('button:has-text("함께하기")').first().click();
  await page.locator('[data-tutor-action=finish]').click();
  await sleep(1200);
  // 「놀이」: 처음에는 레이스가 잠겨 있다
  await page.locator('[data-view=play]').first().click();
  await page.waitForSelector('[data-game=racing]');
  notes.lockedBefore = await page.locator('[data-game=racing]').getAttribute('data-locked') !== null;
  notes.lockText = (await page.locator('[data-game=racing] .play-lock').textContent())?.trim();
  await page.locator('[data-game=racing]').scrollIntoViewIfNeeded();
  await shot('01_놀이_잠김');
  await page.locator('[data-game=racing]').click({ force: true });
  await sleep(500);
  notes.lockedStaysHome = (await page.locator('.game-frame').count()) === 0;
  await page.locator('#panel-close').click();
  // 열린 상태: 해금 규칙만 바꿔 낸 판으로 다시 읽는다
  await page.route('**/play-unlocks.mjs*', async (route) => {
    const res = await route.fetch(), text = await res.text();
    if (!text.includes('record.directionsDone >= 1')) throw Error('해금 규칙 모양이 바뀜');
    await route.fulfill({ response: res, body: text.replace('record.directionsDone >= 1', 'true') });
  });
  await page.goto(entry);
  await sleep(1500);
  await page.locator('[data-view=play]').first().click();
  await page.waitForSelector('[data-game=racing]');
  notes.lockedAfter = await page.locator('[data-game=racing]').getAttribute('data-locked') !== null;
  notes.cardImage = await page.locator('[data-game=racing] img').first().getAttribute('src').catch(() => null);
  await page.locator('[data-game=racing]').scrollIntoViewIfNeeded();
  await shot('02_놀이_열림');
  await page.locator('[data-game=racing]').click();
  await page.waitForSelector('.game-frame');
  const f = page.frameLocator('.game-frame');
  await f.locator('#start').waitFor();
  await sleep(2500);
  notes.host = await f.locator('html').getAttribute('data-host');
  notes.mongleInFrame = await f.locator('img[src*="mongle"],img[src*="mascots"]').count();
  notes.lobbyTitle = (await f.locator('#lobby h1').textContent())?.trim();
  await shot('03_게임_입구');
  await f.locator('.w-bike[data-bike=hybrid]').first().click();
  await sleep(600);
  notes.bikeChecked = await f.locator('.w-bike[data-bike=hybrid]').first().getAttribute('aria-checked');
  notes.bikeSaved = await f.locator('html').evaluate(() => { try { return localStorage.getItem('synk.racing.bike'); } catch { return 'x'; } });
  if (끝까지) {
    await f.locator('#start').click();
    await f.locator('#tutorial-skip').waitFor({ timeout: 120000 });
    await sleep(1500);
    await shot('04_게임_연습');
    await f.locator('#tutorial-skip').click();
    await sleep(3000);
    await shot('05_게임_문제');
    // 한 판: 답을 맞히든 틀리든 멈추지 않는다 — 나오는 대로 「이 길로」를 눌러 도착까지 간다
    const started = Date.now();
    for (;;) {
      if (Date.now() - started > 400000) throw Error('도착을 못 함: ' + JSON.stringify(await f.locator('html').evaluate(() => window.__racing.snapshot().screen)));
      const state = await f.locator('html').evaluate(() => {
        const go = document.getElementById('go'), done = document.getElementById('cruise-action');
        if (done && !done.hidden) return 'done';
        if (go && !go.hidden) go.click();
        return window.__racing.snapshot().screen;
      });
      if (state === 'done') break;
      await sleep(900);
    }
    await sleep(800);
    await shot('06_게임_도착');
    await f.locator('#cruise-results').click();
    await f.locator('#results:not([hidden])').waitFor({ timeout: 15000 });
    await sleep(1800);
    await shot('07_게임_결과');
    notes.stake = (await f.locator('.w-res-stake').textContent())?.trim();
    notes.photo = await f.locator('.w-res-photo').getAttribute('src');
    notes.overflow = await f.locator('html').evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    notes.learningHost = await page.evaluate(() => { try { const s = window.SYNKLearningHost?.status?.(); return s ? { phase: s.phase, pending: s.pending ?? s.queued ?? null } : null; } catch (e) { return String(e); } });
    await page.locator('#panel-close').click({ timeout: 5000 }).catch(() => {});
  }
  } catch (error) {
    notes.error = String(error).slice(0, 400);
    notes.game = await page.frameLocator('.game-frame').locator('html').evaluate(() => { const s = window.__racing?.snapshot(); return s ? { ready: s.ready, screen: s.screen, startup: s.startup, world: document.getElementById('world-status')?.textContent } : 'no __racing'; }, undefined, { timeout: 4000 }).catch((e) => String(e).slice(0, 200));
  } finally { await 닫기(browser); }
  return { name, view, notes, errors: [...new Set(errors)], failed: [...new Set(failed)] };
}

화면시험({ 분: 20 }, async () => {
  const out = [], 하나 = process.argv.includes('--하나');
  for (const [name, view, 끝까지] of 하나 ? [['1280', { width: 1280, height: 800 }, false]] : [['390', { width: 390, height: 844 }, true], ['1280', { width: 1280, height: 800 }, false]]) {
    try { out.push(await run(name, view, 끝까지)); } catch (error) { out.push({ name, error: String(error) }); }
  }
  fs.writeFileSync(path.join(OUT, '앱화면.json'), JSON.stringify({ at: new Date().toISOString(), base: BASE, out }, null, 1) + '\n');
  console.log(JSON.stringify(out, null, 1));
});
