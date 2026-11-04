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

  // 7. 앱 효과음을 꺼도 소리 부탁(공부 내용)은 남는가 · 폰 폭 첫 안내가 「물러나기」를 덮지 않는가
  const soundCase = async (value) => {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const p = await c.newPage();
    p.on('pageerror', (e) => errors.push(String(e)));
    await p.addInitScript((v) => { if (v === null) localStorage.removeItem('synk.world.sound'); else localStorage.setItem('synk.world.sound', v); }, value);
    await p.goto(BASE); await p.waitForFunction(() => !!window.__snap); await p.waitForTimeout(700);
    await p.locator('[data-go=start]').click();
    await p.waitForFunction(() => window.__snap.S.screen === 'shoot' && !window.__snap.S.busy && !document.querySelector('#msg').hidden, null, { timeout: 30000 });
    const kinds = await p.evaluate(() => window.__snap.S.missions.map((m) => m.kind));
    await c.close();
    return kinds;
  };
  notes.missionsAppSoundOff = await soundCase('false');
  notes.missionsAppSoundOn = await soundCase(null);
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const p3 = await phone.newPage();
  p3.on('pageerror', (e) => errors.push(String(e)));
  await p3.goto(BASE); await p3.waitForFunction(() => !!window.__snap); await p3.waitForTimeout(700);
  await p3.locator('[data-go=start]').click();
  await p3.waitForFunction(() => window.__snap.S.screen === 'shoot' && !window.__snap.S.busy, null, { timeout: 30000 });
  await p3.waitForSelector('.toast', { state: 'visible', timeout: 15000 });
  await p3.evaluate(() => window.__snap.focusOn(window.__snap.S.items.find((i) => i.group === 'blade')));
  await p3.waitForTimeout(700);
  notes.toast = await p3.evaluate(() => { const a = document.querySelector('#step-back'), n = document.querySelector('.toast'); if (!n) return 'no toast'; const A = a.getBoundingClientRect(), B = n.getBoundingClientRect(); return { backHidden: a.hidden, backBottom: Math.round(A.bottom), toastTop: Math.round(B.top), overlap: !a.hidden && B.top < A.bottom && B.bottom > A.top }; });
  await p3.screenshot({ path: path.join(OUT, '5_첫안내.png') });
  await phone.close();

  // 8. 안내문을 끄면 찍은 안내문을 인화에서 묻지 않고 입구 수에도 세지 않는가 · q 없는 카드도 창이 열리는가 · 끈 설정이 되돌아가지 않는가(목표 3급)
  const later = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const p4 = await later.newPage();
  p4.on('pageerror', (e) => errors.push(String(e)));
  await p4.goto(BASE); await p4.waitForFunction(() => !!window.__snap); await p4.waitForTimeout(700);
  await p4.locator('[data-go=start]').click();
  await p4.waitForFunction(() => window.__snap.S.screen === 'shoot' && !window.__snap.S.busy, null, { timeout: 30000 });
  await p4.evaluate(() => window.__snap.focusOn(window.__snap.S.items.find((i) => i.word === 'n-smoke'))); await p4.waitForTimeout(700);
  await p4.locator('#shutter').click(); await p4.waitForTimeout(900);
  await p4.evaluate(() => window.__snap.focusOn(window.__snap.S.items.find((i) => i.word === 'cat'))); await p4.waitForTimeout(700);
  await p4.locator('#shutter').click(); await p4.waitForTimeout(900);
  await p4.evaluate(() => { window.__snap.S.busy = false; window.__snap.beginMissions(); }); await p4.waitForTimeout(900);
  for (let g = 0; g < 8; g += 1) {
    const st = await p4.evaluate(() => { const { S } = window.__snap, m = S.missions[S.mi]; return { phase: S.phase, mi: S.mi, kind: m?.kind, word: m?.word }; });
    if (st.phase !== 'mission') break;
    await p4.evaluate(({ kind, word }) => { const { S } = window.__snap; window.__snap.focusOn(S.items.find((i) => (kind === 'word' ? i.kind === 'thing' : i.kind === 'plate') && i.word === word)); }, st);
    await p4.waitForTimeout(600);
    await p4.locator('#shutter').click();
    await p4.waitForFunction((mi) => window.__snap.S.mi !== mi || window.__snap.S.phase !== 'mission', st.mi, { timeout: 12000 });
    await p4.waitForTimeout(200);
  }
  await p4.waitForFunction(() => window.__snap.S.screen === 'develop', null, { timeout: 12000 });
  const asked = [];
  for (let i = 0; i < 3; i += 1) {
    if (await p4.evaluate(() => window.__snap.S.screen !== 'develop')) break;
    await p4.waitForFunction(() => document.querySelector('.dev-opt:not([disabled])'));
    asked.push(await p4.evaluate(() => window.__snap.S.recallNow?.answer));
    const n = await p4.evaluate(() => window.__snap.answerNow());
    await p4.locator('.dev-opt').nth(n).click();
    await p4.waitForTimeout(1500);
  }
  notes.recallWithNoticesOff = asked;
  await p4.evaluate(() => { const { album } = window.__snap; album.cards['n-smoke'].named = true; delete album.cards.library; album.cards.library = { place: 'gate', at: 1, named: true, kind: 'plate', q: null, style: null, vertical: false, scene: [] }; localStorage.setItem(Object.keys(localStorage).find((k) => k.startsWith('synk.snap-words.v1')), JSON.stringify(album)); });
  await p4.reload(); await p4.waitForFunction(() => !!window.__snap); await p4.waitForTimeout(800);
  notes.lobbyCountSkipsNotice = await p4.evaluate(() => ({ shown: Number(document.querySelector('.lobby-top em').textContent), named: Object.values(window.__snap.album.cards).filter((c) => c.named).length }));
  await p4.locator('.lobby-top [data-go=album]').click(); await p4.waitForTimeout(600);
  notes.cardWithoutQuadOpens = await p4.evaluate(() => { const c = [...document.querySelectorAll('.alb-card:not(.is-empty)')].find((n) => n.textContent.includes('도서관')); c?.click(); return !!document.querySelector('.alb-sheet'); });
  await later.close();
  const third = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p5 = await third.newPage();
  p5.on('pageerror', (e) => errors.push(String(e)));
  const grade3 = `${BASE}${BASE.includes('?') ? '&' : '?'}grade=3`;
  await p5.goto(grade3); await p5.waitForFunction(() => !!window.__snap); await p5.waitForTimeout(600);
  const firstOn = await p5.evaluate(() => window.__snap.album.notices);
  await p5.locator('.notice-toggle').click(); await p5.waitForTimeout(400);
  await p5.reload(); await p5.waitForFunction(() => !!window.__snap); await p5.waitForTimeout(600);
  notes.grade3Toggle = { firstOn, afterOffAndReopen: await p5.evaluate(() => window.__snap.album.notices), placeRowRole: await p5.evaluate(() => document.querySelector('.place-row').getAttribute('role')), pressed: await p5.evaluate(() => [...document.querySelectorAll('.place-chip')].map((n) => n.getAttribute('aria-pressed'))) };
  await third.close();

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

  await Promise.race([browser.close(), sleep(4000).catch(() => {})]).catch(() => {});
  const report = { notes, errors };
  console.log(JSON.stringify(report, null, 1));
  fs.writeFileSync(path.join(OUT, '고친곳.json'), JSON.stringify(report, null, 1) + '\n');
  process.exit(0);
})().catch((error) => { console.error(error); process.exit(1); });
