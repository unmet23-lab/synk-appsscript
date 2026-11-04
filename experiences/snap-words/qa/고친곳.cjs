'use strict';
// 화면 검수 지적을 고친 자리를 실제 브라우저로 본다: 다시 연 앨범의 판 글자, 대기 중 나가기, 대기 중 앨범, 스크롤한 앨범의 카드 창, 앨범 도장, 칠판 판.
//   PORT=5207 node experiences/snap-words/server.mjs
//   node experiences/snap-words/qa/고친곳.cjs <출력 폴더>
const path = require('node:path'), fs = require('node:fs');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../node_modules')] }));
const BASE = process.env.SNAP_URL || 'http://127.0.0.1:5207/index.html?seed=7';
const OUT = process.argv[2] || path.join(__dirname, '화면');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage(), errors = [], notes = {};
  const sleep = (ms) => page.waitForTimeout(ms);
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const ready = () => page.waitForFunction(() => !!window.__snap);
  const start = async () => {
    await page.locator('[data-go=start]').click();
    await page.waitForFunction(() => window.__snap.S.screen === 'shoot' && !window.__snap.S.busy && !document.querySelector('#msg').hidden, null, { timeout: 30000 });
    await sleep(500);
  };
  const shoot = async (src) => { await page.evaluate((s) => window.__snap.focusOn(window.__snap.S.items.find(eval(s))), src); await sleep(650); await page.locator('#shutter').click(); await sleep(700); };
  const toMissions = async () => { await page.locator('#step-back').click(); await sleep(600); await page.locator('#msg .pill').click(); await sleep(900); };
  const finishMissions = async () => {
    for (let g = 0; g < 8; g += 1) {
      const st = await page.evaluate(() => { const { S } = window.__snap, m = S.missions[S.mi]; return { phase: S.phase, mi: S.mi, kind: m?.kind, word: m?.word }; });
      if (st.phase !== 'mission') break;
      await page.evaluate(({ kind, word }) => { const { S } = window.__snap; window.__snap.focusOn(S.items.find((i) => (kind === 'word' ? i.kind === 'thing' : i.kind === 'plate') && i.word === word)); }, st);
      await sleep(600);
      await page.locator('#shutter').click();
      await page.waitForFunction((mi) => window.__snap.S.mi !== mi || window.__snap.S.phase !== 'mission', st.mi, { timeout: 12000 });
      await sleep(200);
      if ((await page.evaluate(() => window.__snap.S.mi)) >= 4) break;
    }
  };
  await page.goto(BASE); await ready(); await sleep(900);

  // 1. 판을 찍고 앱을 다시 열어도 앨범의 판 글자가 남는가
  await start();
  await shoot("(i)=>i.group==='blade'"); await shoot("(i)=>i.word==='cat'"); await shoot("(i)=>i.kind==='fixed'");
  await page.evaluate(() => { window.__snap.S.busy = false; });
  await page.reload(); await ready(); await sleep(900);
  await page.locator('.lobby-top [data-go=album]').click(); await sleep(700);
  notes.reopenedAlbumPlateTexts = await page.evaluate(() => [...document.querySelectorAll('.alb-card .pl-t')].map((n) => n.textContent).filter(Boolean).length);
  await page.screenshot({ path: path.join(OUT, '1_다시연앨범.png') });

  // 4. 스크롤한 앨범에서 카드를 열어도 창이 화면 안인가
  await page.evaluate(() => { document.querySelector('.album').scrollTop = 9999; });
  await sleep(200);
  await page.locator('.alb-card:not(.is-empty)').last().click(); await sleep(500);
  notes.scrolledSheet = await page.evaluate(() => { const r = document.querySelector('.alb-sheet').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), inView: r.top >= 0 && r.bottom <= innerHeight }; });
  await page.screenshot({ path: path.join(OUT, '2_스크롤카드창.png') });
  await page.evaluate(() => document.querySelector('.alb-over').remove());

  // 5. 앨범 도장이 탭 · 카드를 덮지 않는가
  await page.evaluate(() => { const { album } = window.__snap; album.stamps.gate = Date.now(); document.querySelector('[data-album-place=gate]').click(); });
  await sleep(500);
  notes.stampCover = await page.evaluate(() => {
    const s = document.querySelector('.stamp-small')?.getBoundingClientRect(); if (!s) return 'no stamp';
    const tabs = document.querySelector('.alb-tabs').getBoundingClientRect(), grid = document.querySelector('.alb-grid').getBoundingClientRect();
    return { stampBottom: Math.round(s.bottom), tabsTop: Math.round(tabs.top), gridTop: Math.round(grid.top), pointer: getComputedStyle(document.querySelector('.stamp-small')).pointerEvents };
  });
  await page.screenshot({ path: path.join(OUT, '3_앨범도장.png') });
  await page.evaluate(() => { delete window.__snap.album.stamps.gate; });
  await page.locator('[data-go=album-close]').click(); await sleep(700);

  // 2. 부탁을 다 끝낸 대기 중에 입구로 나가면 인화로 끌려가지 않는가
  await start();
  await shoot("(i)=>i.group==='blade'");
  await page.evaluate(() => window.__snap.beginMissions()); await sleep(900);
  await page.evaluate(() => { window.__snap.S.busy = false; });
  await finishMissions();
  notes.phaseAfterMissions = await page.evaluate(() => window.__snap.S.phase);
  await page.locator('[data-screen=shoot] [data-go=back]').first().click();
  await sleep(2600);
  notes.afterLeaving = await page.evaluate(() => window.__snap.S.screen);

  // 3. 그 대기 중에 앨범을 열면 강제로 넘어가지 않고, 닫으면 인화로 잇는가
  await start();
  await shoot("(i)=>i.group==='blade'");
  await page.evaluate(() => window.__snap.beginMissions()); await sleep(900);
  await finishMissions();
  await page.locator('[data-screen=shoot] [data-go=album]').first().click();
  await sleep(2600);
  notes.albumHeldDuringWait = await page.evaluate(() => window.__snap.S.screen);
  await page.locator('[data-go=album-close]').click(); await sleep(1400);
  notes.afterClosingAlbum = await page.evaluate(() => window.__snap.S.screen);

  // 6. 칠판 판의 글자가 판 안에 있는가(학생회관)
  const wide = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p2 = await wide.newPage();
  p2.on('pageerror', (e) => errors.push(String(e)));
  await p2.goto(BASE); await p2.waitForFunction(() => !!window.__snap); await p2.waitForTimeout(800);
  await p2.evaluate(() => window.__snap.startPlace('union'));
  await p2.waitForFunction(() => window.__snap.S.screen === 'shoot' && !window.__snap.S.busy, null, { timeout: 30000 });
  await p2.waitForTimeout(900);
  await p2.evaluate(() => window.__snap.focusOn(window.__snap.S.items.find((i) => i.word === 'menu'))); await p2.waitForTimeout(900);
  notes.chalk = await p2.evaluate(() => { const box = document.querySelector('.pl-chalk'), t = box?.querySelector('.pl-t'); if (!t) return 'none'; const a = box.getBoundingClientRect(), b = t.getBoundingClientRect(); return { boxTop: Math.round(a.top), boxBottom: Math.round(a.bottom), textTop: Math.round(b.top), textBottom: Math.round(b.bottom), inside: b.top >= a.top - 1 && b.bottom <= a.bottom + 1 }; });
  await p2.screenshot({ path: path.join(OUT, '4_칠판.png') });

  await browser.close();
  const report = { notes, errors };
  console.log(JSON.stringify(report, null, 1));
  fs.writeFileSync(path.join(OUT, '고친곳.json'), JSON.stringify(report, null, 1) + '\n');
  process.exit(0);
})().catch((error) => { console.error(error); process.exit(1); });
