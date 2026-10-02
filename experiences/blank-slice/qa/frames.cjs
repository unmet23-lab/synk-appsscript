'use strict';
// 베는 순간에 화면이 멈추는지(프레임이 늦게 오는지) 잰다. 페이지 안에서 매 프레임 시각을 적고, 벤 순간 앞뒤 0.5초의 가장 긴 프레임 간격을 본다.
// 쓰는 법: 서버를 켠 뒤  node experiences/blank-slice/qa/frames.cjs [desktop|mobile]
const path = require('node:path');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM] }));
const which = process.argv[2] || 'desktop';
const SIZE = which === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 800 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: which === 'mobile' ? 2 : 1 });
  const page = await context.newPage(), cdp = await context.newCDPSession(page);
  await page.goto('http://127.0.0.1:5217/?qa'); await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForSelector('#btn-start');
  await page.evaluate(() => { window.__frames = []; const f = (t) => { window.__frames.push(t); requestAnimationFrame(f); }; requestAnimationFrame(f); });
  const S = () => page.evaluate(() => window.__slice.state());
  async function apex(i) {
    let prev = null;
    for (let k = 0; k < 90; k++) {
      const p = await page.evaluate((n) => { const s = window.__slice.pieceScreen(n), a = window.__slice.arena(); return s && { x: a.x + s.x, y: a.y + s.y, ay: a.y, ah: a.h }; }, i);
      if (p && p.y > p.ay + 60 && p.y < p.ay + p.ah - 40) { if (prev && Math.abs(prev.y - p.y) < 5) return p; prev = p; }
      await sleep(50);
    }
    return null;
  }
  async function swipe(p) {
    const t0 = Date.now() / 1000, at = (k) => ({ x: Math.round(p.x - 110 + 27.5 * k), y: Math.round(p.y - 50 + 12.5 * k) });
    const ev = (type, k, pressed) => cdp.send('Input.dispatchMouseEvent', { type, ...at(k), button: 'left', buttons: pressed ? 1 : 0, clickCount: 1, timestamp: t0 + 0.008 * k });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...at(0), button: 'none', buttons: 0, timestamp: t0 - 0.02 });
    await ev('mousePressed', 0, true);
    for (let k = 1; k <= 8; k++) { await ev('mouseMoved', k, true); await sleep(8); }
    await ev('mouseReleased', 8, false);
  }
  await page.click('#btn-start'); await sleep(900);
  const pr = (await S()).practice;
  await swipe(await apex(pr.options.indexOf('우유'))); await sleep(2600);
  for (let k = 0; k < 4; k++) {
    let st = await S();
    for (let w = 0; w < 80 && !(st.cur && st.cur.tosses > 0 && !st.cur.done); w++) { await sleep(60); st = await S(); }
    const p = await apex(st.cur.options.indexOf(st.cur.answer));
    if (p) await swipe(p);
    await sleep(1500);
  }
  const { frames, impacts } = await page.evaluate(() => ({ frames: window.__frames, impacts: window.__slice.impacts() }));
  const gaps = frames.slice(1).map((t, i) => [frames[i], t - frames[i]]);
  const typical = [...gaps.map((g) => g[1])].sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
  const around = impacts.map((im, i) => {
    const near = gaps.filter(([t]) => t > im.t - 500 && t < im.t + 500);
    const worst = near.reduce((a, b) => (b[1] > a[1] ? b : a), [0, 0]);
    return { n: i + 1, verdict: im.verdict, worstGapMs: Math.round(worst[1]), at: Math.round(worst[0] - im.t) };
  });
  // 50ms 넘는 프레임마다 가장 가까운 벤 순간과의 시각 차(벤 뒤 0.4~0.5초 = 낱말이 빈칸에 끼워지는 순간)
  const long = gaps.filter((g) => g[1] > 50).map(([t, g]) => {
    const near = impacts.reduce((a, im) => (Math.abs(t - im.t) < Math.abs(t - a.t) ? im : a), impacts[0] || { t: 0 });
    return { gapMs: Math.round(g), fromSliceMs: Math.round(t - near.t), atSec: +((t - frames[0]) / 1000).toFixed(2) };
  });
  console.log(JSON.stringify({ view: which, frames: frames.length, typicalMs: +typical.toFixed(1), over50ms: long.length, long, impacts: around }, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
