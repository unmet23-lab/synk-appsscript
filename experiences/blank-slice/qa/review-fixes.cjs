'use strict';
// 2026-10-02 검토 지적을 고친 동작을 실제 브라우저로 재현한다(서버를 켠 뒤  node experiences/blank-slice/qa/review-fixes.cjs).
//  ① 두 손가락: 두 번째 손가락이 닿고 첫 손가락이 2px만 움직여도 두 손가락 사이의 조각이 베이지 않는다(P1)
//  ② WebGL을 만들 수 없으면 빈 화면에 멈추지 않고 입구에 안내가 나온다(P3)
//  ③ 날아가는 중에 창이 1440→390으로 줄어도 조각이 화면 안에 있다(P3)
//  ④ 무대를 준비하는 동안 쉬면, 쉬는 동안 조각이 던져지지 않는다(P2)
//  ⑤ 조각 위에 얹은 손가락이 2px씩 떨려도 베이지 않는다(최근 50ms에 8px 이상 움직여야 벤다)
const path = require('node:path');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM] }));
const URL_BASE = process.env.SLICE_URL || 'http://127.0.0.1:5217/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = {};

async function fresh(browser, opts = {}, init = null) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...opts });
  if (init) await context.addInitScript(init);
  const page = await context.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL_BASE + '?qa');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('synk.blank-slice.v1', JSON.stringify({ v: 1, plays: 1, practiced: true, slow: false, best: null })); });
  await page.reload(); await page.waitForSelector('#btn-start');
  return { context, page, errors, S: () => page.evaluate(() => window.__slice.state()) };
}
async function firstToss(S) { for (let i = 0; i < 80; i++) { const st = await S(); if (st.cur && st.cur.tosses > 0) return st; await sleep(100); } return null; }

(async () => {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  try {
    // ① 두 손가락
    {
      const { context, page, errors, S } = await fresh(browser);
      await page.click('#btn-start'); const st = await firstToss(S); await sleep(1400);
      const c = await page.evaluate(() => { const a = window.__slice.arena(), p = window.__slice.pieceScreen(0); return { x: a.x + p.x, y: a.y + p.y }; });
      const cdp = await context.newCDPSession(page), t0 = Date.now() / 1000;
      const A = { x: Math.round(c.x - 75), y: Math.round(c.y + 60), id: 1 }, B = { x: Math.round(c.x + 75), y: Math.round(c.y - 60), id: 2 };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [A], timestamp: t0 });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [A, B], timestamp: t0 + 0.02 });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...A, x: A.x + 2 }, B], timestamp: t0 + 0.03 });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: t0 + 0.05 });
      await sleep(300);
      const after = await S();
      results.twoFingers = { piece: st.cur.options[0], sliced: after.cur?.done ?? null, results: after.results.length, errors };
      await context.close();
    }
    // ⑤ 떨림
    {
      const { context, page, errors, S } = await fresh(browser);
      await page.click('#btn-start'); await firstToss(S); await sleep(1400);
      const c = await page.evaluate(() => { const a = window.__slice.arena(), p = window.__slice.pieceScreen(1); return { x: Math.round(a.x + p.x), y: Math.round(a.y + p.y) }; });
      const cdp = await context.newCDPSession(page), t0 = Date.now() / 1000;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...c, id: 1 }], timestamp: t0 });
      for (let k = 1; k <= 6; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c.x + (k % 2 ? 2 : -2), y: c.y + (k % 3 ? 1 : -1), id: 1 }], timestamp: t0 + 0.01 * k });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: t0 + 0.08 });
      await sleep(300);
      const after = await S();
      results.jitter = { sliced: after.cur?.done ?? null, results: after.results.length, errors };
      await context.close();
    }
    // ② WebGL 없음
    {
      const { context, page, errors } = await fresh(browser, {}, () => {
        const orig = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return /webgl/.test(type) ? null : orig.call(this, type, ...rest); };
      });
      await page.click('#btn-start'); await sleep(1500);
      results.noWebGL = { lobbyShown: await page.isVisible('#lobby'), note: await page.textContent('#storage-note'), errors };
      await context.close();
    }
    // ③ 날아가는 중 창 크기 변경
    {
      const { context, page, errors, S } = await fresh(browser, { viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
      await page.click('#btn-start'); await firstToss(S); await sleep(700);
      await page.setViewportSize({ width: 390, height: 844 }); await sleep(400);
      const xs = await page.evaluate(() => [0, 1, 2, 3].map((i) => window.__slice.pieceScreen(i)?.x).filter((x) => x != null).map(Math.round));
      results.resize = { width: 390, pieceX: xs, inside: xs.every((x) => x > 0 && x < 390), errors };
      await context.close();
    }
    // ④ 무대 준비 중 쉬기: 펠트 결 그림을 1.5초 늦게 줘서 느린 망을 흉내 내고, 시작 직후 Esc
    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await context.route('**/assets/kit/tex-cream.webp', async (route) => { await sleep(1500); await route.continue(); });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(URL_BASE + '?qa');
      await page.evaluate(() => localStorage.setItem('synk.blank-slice.v1', JSON.stringify({ v: 1, plays: 1, practiced: true, slow: false, best: null })));
      await page.reload(); await page.waitForSelector('#btn-start');
      await page.click('#btn-start'); await sleep(150); await page.keyboard.press('Escape');
      await sleep(6000);
      const st = await page.evaluate(() => window.__slice.state());
      results.pauseWhileLoading = { dialogOpen: await page.evaluate(() => document.querySelector('#pause-dialog').open), tosses: st.cur?.tosses ?? 0, results: st.results.length, errors };
      await context.close();
    }
  } finally { await browser.close(); }
  console.log(JSON.stringify(results, null, 1));
  const ok = results.twoFingers?.sliced === false && results.twoFingers.results === 0 && results.jitter?.sliced === false && results.noWebGL?.lobbyShown && /3D/.test(results.noWebGL.note || '')
    && results.resize?.inside && results.pauseWhileLoading?.dialogOpen && results.pauseWhileLoading.tosses === 0 && results.pauseWhileLoading.results === 0;
  console.log(ok ? '모두 통과' : '확인 필요');
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
