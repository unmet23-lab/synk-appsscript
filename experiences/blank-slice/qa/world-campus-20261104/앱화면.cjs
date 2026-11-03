'use strict';
// 빈칸 베기 캠퍼스 판(2026-11-04) — WORLD 앱(이 PC 시범 서버) 안에서 「놀이」 잠김 → 싱크타운 카페 첫 방문 → 열림 → 게임 틀 안 캠퍼스 판 → 결과 → 우리 동네로를 찍는다.
// 주문 폭주 앱화면.cjs와 같은 길. 게임 틀은 ?qa 없이 열리므로 낭독 글(#sr-live의 「보기: 1 …」)과 원고(content.mjs)로 맞는 번호를 찾아 숫자 키로 벤다.
// 넘침 · 콘솔 오류 · 실패한 요청 · 몽글 그림 · 배경음 받기 · 공용 three.js도 본다.
//   WORLD 앱: SYNK_TALK_ROOT=<SYNK-talk> SYNK_WORLD_PORT=4298 node experiences/synk-world-app/server.mjs
//   node experiences/blank-slice/qa/world-campus-20261104/앱화면.cjs   (주소 WORLD_URL, 기본 http://127.0.0.1:4298 · 찍은 것은 공용 작업본 .tmp/blank-slice-world-20261104/앱화면/)
const path = require('node:path'), fs = require('node:fs');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const BASE = process.env.WORLD_URL || 'http://127.0.0.1:4298';
const OUT = path.join(공용작업본(path.resolve(__dirname, '../../../..')), '.tmp', 'blank-slice-world-20261104', '앱화면');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(name, view, ITEMS) {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
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
  // 「놀이」: 처음에는 빈칸 베기가 잠겨 있다
  await page.locator('[data-view=play]').first().click();
  await page.waitForSelector('[data-game=blank]');
  notes.lockedBefore = await page.locator('[data-game=blank]').getAttribute('data-locked') !== null;
  notes.lockText = (await page.locator('[data-game=blank] .play-lock').textContent())?.trim();
  await page.locator('[data-game=blank]').scrollIntoViewIfNeeded();
  await shot('01_놀이_잠김');
  await page.locator('[data-game=blank]').click({ force: true });
  await sleep(500);
  notes.lockedStaysHome = (await page.locator('.game-frame').count()) === 0;
  await page.locator('#panel-close').click();
  await sleep(500);
  // 싱크타운 카페 첫 방문(주문 폭주와 같은 순서) — 지금 앱에서 가장 짧게 이야기 기록을 남기는 길
  await page.evaluate(() => document.querySelector('[data-view=cafe]').click());
  await page.locator('.felt-button[data-life-lesson=cafe-apply]').click();
  const next = async () => { if (await page.locator('.cafe-welcome [data-life-cafe-mode=read]').count()) await page.locator('[data-life-cafe-mode=read]').click(); await page.locator('[data-life-cafe-next]:not([disabled])').click(); await sleep(500); };
  const choose = async (id) => { await page.locator(`[data-life-cafe-choice=${id}]:not([disabled])`).click(); await sleep(700); };
  await next(); await choose('b'); await next(); await choose('c'); await next(); await next(); await choose('a'); await next();
  await page.locator('#panel-close').click();
  await sleep(600);
  // 「놀이」: 이제 열려 있고 처음 볼 때 「새로 열림」
  await page.locator('[data-view=play]').first().click();
  await page.waitForSelector('[data-game=blank]');
  notes.lockedAfter = await page.locator('[data-game=blank]').getAttribute('data-locked') !== null;
  notes.newBadge = await page.locator('[data-game=blank] .play-new').count();
  await page.locator('[data-game=blank]').scrollIntoViewIfNeeded();
  await shot('02_놀이_열림');
  await page.locator('[data-game=blank]').click();
  await page.waitForSelector('.game-frame');
  const f = page.frameLocator('.game-frame');
  await f.locator('#btn-start').waitFor({ state: 'attached' });
  await sleep(1800);
  notes.host = await f.locator('html').getAttribute('data-host');
  notes.mongleInFrame = await f.locator('img[src*="mongle"]').count();
  await shot('03_게임_입구');
  await f.locator('#btn-start').scrollIntoViewIfNeeded();
  await f.locator('#btn-start').click();
  await sleep(1500);
  await page.locator('.game-frame').focus().catch(() => {});
  const box = await page.locator('.game-frame').boundingBox();
  // 연습 한 문장: 빛나는 조각이 답이고, 번호는 낭독 글에 있다
  const readBoard = () => f.locator('html').evaluate(() => ({ sr: document.querySelector('#sr-live')?.textContent || '', text: document.querySelector('#s-text')?.dataset.text || '', kicker: document.querySelector('#s-kicker')?.textContent || '', over: !document.querySelector('#results').hidden, explain: !document.querySelector('#explain').hidden, check: !document.querySelector('#answer-check').hidden, filled: !!document.querySelector('#blank.filled') }));
  const pressAnswer = async (b) => {
    const item = ITEMS.find((x) => x.text === b.text);
    const answer = item?.answer ?? (b.kicker.includes('연습') ? ITEMS.practice.answer : null);
    const m = [...b.sr.matchAll(/(\d) ([^,]+?)(?:,|\.|$)/g)].find((x) => x[2].trim() === answer);
    if (m) await page.keyboard.press(m[1]);
    return !!m;
  };
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.97);
  let done = 0, last = '', shotPlay = false;
  for (let k = 0; k < 900; k += 1) {
    const b = await readBoard();
    if (b.over) break;
    if (b.explain) { await f.locator('#btn-next').click(); await sleep(300); continue; }
    if (b.check) { await f.locator('#check-options button').first().click(); await sleep(300); continue; }
    if (b.text && b.text + b.kicker !== last && !b.filled && /보기:/.test(b.sr)) {
      await sleep(2900);   // 조각이 뜨기를 기다린다(읽을 시간 + 던지기)
      if (!shotPlay) { shotPlay = true; await shot('04_게임_놀이'); }
      if (await pressAnswer(await readBoard())) { last = b.text + b.kicker; done += 1; }
      await sleep(250);
      if (done === 2) await shot('05_게임_벤뒤');
    }
    await sleep(120);
  }
  notes.sliced = done;
  await sleep(3200);
  notes.result = await f.locator('html').evaluate(() => ({ correct: document.querySelector('#r-correct')?.textContent, total: document.querySelector('#r-total')?.textContent, coins: document.querySelector('#r-coins')?.textContent, room: !!document.querySelector('#w-room') }));
  await shot('06_결과');
  await f.locator('#w-room').click();
  await sleep(1200);
  notes.backHome = (await page.locator('.game-frame').count()) === 0;
  await shot('07_돌아옴');
  // 앱 안 기록: 판 수가 계정 놀이 기록 키로 남았는지(같은 틀에서 다시 열어 본다)
  notes.progress = await page.evaluate(() => { try { return Object.keys(localStorage).filter((k) => /blank-slice/.test(k)).length; } catch { return null; } });
  notes.music = [...got].filter((u) => /order-rush\/assets\/world\/music\//.test(u)).map((u) => u.split('/').pop());
  notes.three = [...got].filter((u) => /three\.(module|core)\.js$/.test(u));
  const felt = [...got].filter((u) => /blank-slice\/.*(mongle|hero-pieces)/.test(u));
  await browser.close();
  return { name, view, notes, felt, errors, failed: [...new Set(failed)] };
}

(async () => {
  const content = await import(require('node:url').pathToFileURL(path.resolve(__dirname, '../../content.mjs')).href);
  const ITEMS = [...content.ITEMS]; ITEMS.practice = content.PRACTICE; ITEMS.push(content.PRACTICE);
  const out = [];
  for (const [name, view] of [['폰', { width: 390, height: 844 }], ['PC', { width: 1280, height: 800 }]]) out.push(await run(name, view, ITEMS));
  fs.writeFileSync(path.join(OUT, '앱화면.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
