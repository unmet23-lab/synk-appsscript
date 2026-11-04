'use strict';
// 말 랠리 캠퍼스 판(2026-11-04) — WORLD 앱(이 PC 시범 서버를 스스로 띄움) 안에서 「놀이」 잠김 → 싱크타운 카페 첫 방문 → 열림 → 게임 틀 안 캠퍼스 판 → 결과 → 우리 동네로를 찍는다.
// 빈칸 베기 앱화면.cjs와 같은 길. 게임 틀은 ?qa 없이 열리므로 카드 글과 원고(content.mjs)로 맞는 카드를 찾아 진짜로 누른다.
// 넘침 · 콘솔 오류 · 실패한 요청 · 몽글 그림과 소리 · 움직임 영상 받기 · 공용 three.js · 곁 튜터가 안 붙는지도 본다.
//   node experiences/talk-rally/qa/world-campus-20261104/앱화면.cjs   (찍은 것은 공용 작업본 .tmp/talk-rally-world-20261104/앱화면/)
//   SYNK_TALK_ROOT로 형제 저장소를 가리킨다(기본 Documents/SYNK-talk). WORLD_URL을 주면 띄우지 않고 그 서버로 한다.
const path = require('node:path'), fs = require('node:fs');
const { spawn } = require('node:child_process');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../../..');
const PORT = 43000 + Math.floor(Math.random() * 2000);   // 다른 세션의 시범 서버와 겹치지 않게
const BASE = process.env.WORLD_URL || `http://127.0.0.1:${PORT}`;
const OUT = path.join(공용작업본(ROOT), '.tmp', 'talk-rally-world-20261104', '앱화면');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(name, view, ITEMS) {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: view.width < 700 ? 2 : 1, hasTouch: view.width < 700, isMobile: view.width < 700 });
  const page = await ctx.newPage(), errors = [], failed = [], notes = {}, got = new Set();
  page.setDefaultTimeout(30000);
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('response', (r) => { const u = new URL(r.url()).pathname; got.add(u); if (r.status() >= 400 && !/\/api\/world\/bootstrap$/.test(u)) failed.push(`${r.status()} ${u}`); });
  const shot = async (label) => { await page.mouse.move(2, 2).catch(() => {}); await page.screenshot({ path: path.join(OUT, `${name}_${label}.png`) }); };
  await page.goto(`${BASE}/${view.width < 700 ? 'mobile' : 'desktop'}.html?opening=off`);
  await page.getByText('계속하기', { exact: true }).click();
  await page.getByText('읽을 수 있어요', { exact: true }).click();
  await page.locator('button:has-text("함께하기")').first().click();
  await page.locator('[data-tutor-action=finish]').click();
  await sleep(1200);
  // 「놀이」: 처음에는 말 랠리가 잠겨 있다
  await page.locator('[data-view=play]').first().click();
  await page.waitForSelector('[data-game=rally]');
  notes.lockedBefore = await page.locator('[data-game=rally]').getAttribute('data-locked') !== null;
  notes.lockText = (await page.locator('[data-game=rally] .play-lock').textContent())?.trim();
  await page.locator('[data-game=rally]').scrollIntoViewIfNeeded();
  await shot('01_놀이_잠김');
  await page.locator('[data-game=rally]').click({ force: true });
  await sleep(500);
  notes.lockedStaysHome = (await page.locator('.game-frame').count()) === 0;
  await page.locator('#panel-close').click();
  await sleep(500);
  // 싱크타운 카페 첫 방문(빈칸 베기와 같은 순서) — 지금 앱에서 가장 짧게 이야기 기록을 남기는 길
  await page.evaluate(() => document.querySelector('[data-view=cafe]').click());
  await page.locator('.felt-button[data-life-lesson=cafe-apply]').click();
  const next = async () => { if (await page.locator('.cafe-welcome [data-life-cafe-mode=read]').count()) await page.locator('[data-life-cafe-mode=read]').click(); await page.locator('[data-life-cafe-next]:not([disabled])').click(); await sleep(600); };
  const choose = async (id) => { await page.locator(`[data-life-cafe-choice=${id}]:not([disabled])`).click(); await sleep(700); };
  await next(); await choose('b'); await next(); await choose('c'); await next(); await next(); await choose('a'); await next();
  await page.locator('#panel-close').click();
  await sleep(600);
  // 「놀이」: 이제 열려 있고 처음 볼 때 「새로 열림」
  await page.locator('[data-view=play]').first().click();
  await page.waitForSelector('[data-game=rally]');
  notes.lockedAfter = await page.locator('[data-game=rally]').getAttribute('data-locked') !== null;
  notes.newBadge = await page.locator('[data-game=rally] .play-new').count();
  await page.locator('[data-game=rally]').scrollIntoViewIfNeeded();
  await shot('02_놀이_열림');
  await page.locator('[data-game=rally]').click();
  await page.waitForSelector('.game-frame');
  const f = page.frameLocator('.game-frame');
  await f.locator('#btn-start').waitFor({ state: 'attached' });
  await sleep(1800);
  notes.host = await f.locator('html').getAttribute('data-host');
  notes.mongleInFrame = await f.locator('img[src*="mongle"]').count();
  notes.gameTutor = await page.evaluate(() => !!window.__synkGameTutor);
  await shot('03_게임_입구');
  await f.locator('#btn-start').click();
  await sleep(1500);
  // 카드 글로 맞는 카드를 찾아 누른다(연습은 빛나는 카드)
  const board = () => f.locator('html').evaluate(() => ({ cards: [...document.querySelectorAll('#cards .card')].map((c) => c.querySelector('.say')?.textContent.replace(/\s+/g, ' ').trim() || ''), locked: document.querySelector('#cards')?.classList.contains('locked') || !!document.querySelector('#cards .card[aria-pressed=true]'), hint: [...document.querySelectorAll('#cards .card')].findIndex((c) => c.classList.contains('hint')), hud: document.querySelector('#hud-q, .game-bar')?.textContent.replace(/\s+/g, ' ').trim() || '', over: !document.querySelector('#results')?.hidden, explain: !document.querySelector('#explain')?.hidden && !!document.querySelector('#btn-next')?.offsetParent, shown: document.querySelector('#btn-next')?.offsetParent != null }));
  let hits = 0, shotPlay = false, shotHit = false;
  const t0 = Date.now();
  for (let k = 0; k < 900 && Date.now() - t0 < 240000; k += 1) {
    const b = await board();
    if (b.over) break;
    if (b.shown) { await f.locator('#btn-next').click(); await sleep(250); continue; }
    if (b.cards.length === 3 && !b.locked) {
      await sleep(600);
      if (!shotPlay) { shotPlay = true; await shot('04_게임_말걺'); }
      let lane = b.hint;
      if (lane < 0) {
        const norm = (s) => s.replace(/\s+/g, ' ').trim();
        const item = ITEMS.find((x) => x.options.length === b.cards.length && b.cards.every((c) => x.options.map(norm).includes(c)));
        lane = item ? b.cards.indexOf(norm(item.answer)) : -1;
      }
      if (lane >= 0) { await f.locator(`#cards .card.l${lane}`).click(); hits += 1; }
      await sleep(900);
      if (hits === 3 && !shotHit) { shotHit = true; await sleep(700); await shot('05_게임_받아침'); }
      continue;
    }
    await sleep(120);
  }
  notes.hits = hits;
  await sleep(3200);
  notes.result = await f.locator('html').evaluate(() => ({ correct: document.querySelector('#r-correct')?.textContent, total: document.querySelector('#r-total')?.textContent, coins: document.querySelector('#r-coins')?.textContent, room: !!document.querySelector('#w-room') }));
  await shot('06_결과');
  await f.locator('#w-room').click();
  await sleep(1200);
  notes.backHome = (await page.locator('.game-frame').count()) === 0;
  await shot('07_돌아옴');
  notes.clips = [...got].filter((u) => /talk-rally\/assets\/world\/cast\/taeo\/clips\//.test(u)).map((u) => u.split('/').pop());
  notes.music = [...got].filter((u) => /talk-rally\/assets\/world\/music\//.test(u)).map((u) => u.split('/').pop());
  notes.three = [...got].filter((u) => /three\.(module|core)\.js$/.test(u));
  const mascots = [...got].filter((u) => /talk-rally\/.*(kit\/brand\/mongle|assets\/sound\/mongle|assets\/voice\/|assets\/narration\/)/.test(u));
  await browser.close();
  return { name, view, notes, mascots, errors, failed: [...new Set(failed)] };
}

(async () => {
  const content = await import(require('node:url').pathToFileURL(path.resolve(__dirname, '../../content.mjs')).href);
  const ITEMS = [...content.ITEMS, content.PRACTICE];
  let server = null;
  if (!process.env.WORLD_URL) {
    server = spawn(process.execPath, [path.join(ROOT, 'experiences/synk-world-app/server.mjs')], { cwd: ROOT, env: { ...process.env, SYNK_WORLD_PORT: String(PORT), SYNK_TALK_ROOT: process.env.SYNK_TALK_ROOT || path.join(process.env.USERPROFILE, 'Documents/SYNK-talk') }, stdio: 'ignore' });
    for (let i = 0; i < 100; i += 1) { try { const r = await fetch(`${BASE}/mobile.html`); if (r.ok) break; } catch { /* 아직 */ } await sleep(300); }
  }
  const out = [];
  try {
    for (const [name, view] of [['폰', { width: 390, height: 844 }], ['PC', { width: 1280, height: 800 }]]) out.push(await run(name, view, ITEMS));
  } finally { server?.kill(); }
  fs.writeFileSync(path.join(OUT, '앱화면.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
