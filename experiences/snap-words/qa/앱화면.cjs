'use strict';
// 찰칵 낱말 — WORLD 앱(이 PC 시범 서버) 안에서 「놀이」 잠김 → 이야기 기록 → 열림 → 게임 틀 안에서 입구 → 둘러보기 → 부탁 → 인화 → 결과 → 앨범을 찍는다.
// 넘침 · 화면 밖 단추 · 콘솔 오류 · 실패한 요청 · 사진 속 글자 크기(다가간 뒤 13px 이상)를 잰다. 주문 폭주 앱화면.cjs와 같은 꼴.
//   WORLD 앱: SYNK_TALK_ROOT=<SYNK-talk> SYNK_WORLD_PORT=4303 node experiences/synk-world-app/server.mjs
//   WORLD_URL=http://127.0.0.1:4303 node experiences/snap-words/qa/앱화면.cjs <출력 폴더>
const path = require('node:path'), fs = require('node:fs');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../node_modules')] }));
const { 화면시험, 닫기 } = require('../../../tools/lib/화면시험.cjs');
const BASE = process.env.WORLD_URL || 'http://127.0.0.1:4303';
const OUT = process.argv[2] || path.join(__dirname, '화면');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(name, view, lang) {
  const browser = await chromium.launch();
  try {
  const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: 2, hasTouch: view.width < 700, isMobile: view.width < 700, reducedMotion: process.env.QA_REDUCED ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage(), errors = [], failed = [], notes = { lang };
  page.setDefaultTimeout(25000);
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && !/\/api\/world\/bootstrap$/.test(new URL(r.url()).pathname)) failed.push(`${r.status()} ${r.url()}`); });
  const shot = async (label) => { await page.mouse.move(2, 2); await page.screenshot({ path: path.join(OUT, `${name}_${label}.png`) }); };
  const game = () => page.frames().find((x) => x.url().includes('/snap-words/'));
  await page.goto(`${BASE}/${view.width < 700 ? 'mobile' : 'desktop'}.html?opening=off`);
  await page.getByText('계속하기', { exact: true }).click();
  await page.getByText('읽을 수 있어요', { exact: true }).click();
  await page.locator('button:has-text("함께하기")').first().click();
  await page.locator('[data-tutor-action=finish]').click();
  await sleep(1200);
  await page.locator('[data-view=play]').first().click();
  await page.waitForSelector('[data-game=snap]');
  notes.lockedBefore = await page.locator('[data-game=snap]').getAttribute('data-locked') !== null;
  notes.lockText = (await page.locator('[data-game=snap] .play-lock').textContent())?.trim();
  await page.locator('[data-game=snap]').scrollIntoViewIfNeeded();
  await shot('01_놀이_잠김');
  await page.locator('[data-game=snap]').click({ force: true });
  await sleep(500);
  notes.lockedStaysHome = (await page.locator('.game-frame').count()) === 0;
  await page.locator('#panel-close').click();
  // 이야기 기록: 「처음 만난 날」 두 강을 마친 기록을 넣는다(강 자체는 생활 이야기 시험의 몫이다)
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage).filter((k) => k.startsWith('synk.life-korean.progress.v1'))) {
      const state = JSON.parse(localStorage.getItem(key)), at = Date.now();
      for (const id of ['greetings-expressions', 'greetings-story']) state.lessons[id] = { attemptId: crypto.randomUUID(), startedAt: at - 60000, completedAt: at, stage: { phase: 'questions', sceneIndex: 0, questionIndex: 0 }, questionIds: [], answers: {} };
      localStorage.setItem(key, JSON.stringify(state));
    }
  });
  await page.goto(`${BASE}/${view.width < 700 ? 'mobile' : 'desktop'}.html?opening=off`);
  await sleep(1500);
  await page.locator('[data-view=play]').first().click();
  await page.waitForSelector('[data-game=snap]');
  notes.lockedAfter = await page.locator('[data-game=snap]').getAttribute('data-locked') !== null;
  await page.locator('[data-game=snap]').scrollIntoViewIfNeeded();
  await shot('02_놀이_열림');
  await page.locator('[data-game=snap]').click();
  await page.waitForSelector('.game-frame');
  for (let i = 0; i < 100 && !game(); i += 1) await sleep(100);
  const f = game();
  await f.waitForFunction(() => !!window.__snap);
  await sleep(1400);
  notes.atlas = await f.evaluate(() => !!window.SynkLearning);
  await shot('03_입구');
  await f.locator('[data-go=start]').click();
  await f.waitForFunction(() => window.__snap.S.screen === 'shoot' && !window.__snap.S.busy && !document.querySelector('#msg').hidden);
  await sleep(700);
  await shot('04_둘러보기');
  const pos = (fn) => f.evaluate((src) => { const { S, cam } = window.__snap, it = S.items.find(eval(src)); const xs = it.q.map((p) => p[0]), ys = it.q.map((p) => p[1]); return { x: cam.x + (Math.min(...xs) + Math.max(...xs)) / 2 * cam.s, y: cam.y + (Math.min(...ys) + Math.max(...ys)) / 2 * cam.s, id: it.id }; }, fn);
  const focus = (src) => f.evaluate((s) => window.__snap.focusOn(window.__snap.S.items.find(eval(s))), src);
  const snap = async () => { await f.locator('#shutter').click(); await sleep(450); };
  await focus("(i)=>i.group==='blade'"); await sleep(800);
  await shot('05_다가감');
  notes.plateFontPx = await f.evaluate(() => { const { S, cam } = window.__snap, el = [...document.querySelectorAll('#plates .pl-blade .pl-t')][0]; return +(parseFloat(getComputedStyle(el).fontSize) * cam.s).toFixed(1); });
  await snap(); await sleep(500);
  await shot('06_카드');
  await focus("(i)=>i.word==='cat'"); await sleep(700); await snap(); await sleep(400);
  await focus("(i)=>i.kind==='fixed'"); await sleep(700); await snap(); await sleep(400);
  await f.locator('#step-back').click(); await sleep(800);
  await shot('07_부탁단추');
  await f.locator('#msg .pill').click();
  await sleep(1200);
  await shot('08_첫부탁');
  // 첫 부탁: 한 번 다르게 찍고 → 맞게
  const wrong = await f.evaluate(() => { const { S } = window.__snap, m = S.missions[S.mi]; return m.kind === 'word' ? 'plate' : 'other'; });
  await focus(wrong === 'other' ? "(i)=>i.kind==='plate'&&i.group&&i.word!==window.__snap.S.missions[window.__snap.S.mi].word" : "(i)=>i.kind==='plate'");
  await sleep(600); await snap(); await sleep(900);
  await shot('09_다름');
  for (let g = 0; g < 6; g += 1) {
    const st = await f.evaluate(() => { const { S } = window.__snap, m = S.missions[S.mi]; return { phase: S.phase, mi: S.mi, kind: m?.kind, word: m?.word }; });
    if (st.phase !== 'mission') break;
    await f.evaluate(({ kind, word }) => { const { S } = window.__snap; window.__snap.focusOn(S.items.find((i) => (kind === 'word' ? i.kind === 'thing' : i.kind === 'plate') && i.word === word)); }, st);
    await sleep(650);
    await f.locator('#shutter').click();
    await f.waitForFunction((mi) => window.__snap.S.mi !== mi || window.__snap.S.phase !== 'mission', st.mi, { timeout: 12000 });
    await sleep(300);
    if (g === 0) await shot('10_보냄');
  }
  await f.waitForFunction(() => window.__snap.S.screen === 'develop', null, { timeout: 12000 });
  await sleep(1800);
  await shot('11_인화');
  for (let i = 0; i < 3; i += 1) {
    if (await f.evaluate(() => window.__snap.S.screen !== 'develop')) break;
    await f.waitForFunction(() => document.querySelector('.dev-opt:not([disabled])'));
    const n = await f.evaluate(() => window.__snap.answerNow());
    await f.locator('.dev-opt').nth(n).click();
    await sleep(700);
    if (i === 0) await shot('12_인화맞음');
    await sleep(900);
  }
  await f.waitForFunction(() => window.__snap.S.screen === 'result', null, { timeout: 10000 });
  await sleep(1500);
  await shot('13_결과');
  notes.overflowResult = await f.evaluate(() => { const r = document.querySelector('.result'); return r.scrollWidth > r.clientWidth + 1; });
  await f.locator('.res-row [data-go=album]').click();
  await sleep(800);
  await shot('14_앨범');
  notes.named = await f.evaluate(() => Object.values(window.__snap.album.cards).filter((c) => c.named).length);
  notes.overflow = await f.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  notes.offscreen = await f.evaluate(() => [...document.querySelectorAll('[data-screen=album] button')].filter((b) => { const r = b.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > innerWidth + 1); }).length);
  return { name, view, notes, errors, failed };
  } finally { await 닫기(browser); }
}

화면시험({ 분: 20 }, async () => {
  const out = [];
  for (const [name, view] of [['390', { width: 390, height: 844 }], ['1280', { width: 1280, height: 800 }]]) {
    try { out.push(await run(name, view)); } catch (error) { out.push({ name, error: String(error) }); }
  }
  fs.writeFileSync(path.join(OUT, '앱화면.json'), JSON.stringify({ at: new Date().toISOString(), base: BASE, out }, null, 1) + '\n');
  console.log(JSON.stringify(out, null, 1));
});
