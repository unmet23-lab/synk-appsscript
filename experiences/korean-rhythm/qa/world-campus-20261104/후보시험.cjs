'use strict';
// 말의 리듬 캠퍼스 판 — 공개 후보를 실제 공개본 위에서 돌려 본다(2026-11-04): 브라우저 요청 가운데 synk.im/world/의 후보 파일만 후보 폴더에서 내주고 나머지는 지금 공개본 그대로 받는다.
// 공개본(재방문 연습 전 판) + 내 고침이 3방향으로 맞물려 도는지, 올리기 전에 본다. 공개본은 바꾸지 않는다.
//   node experiences/korean-rhythm/qa/world-campus-20261104/후보시험.cjs [후보 폴더=공용 작업본 .tmp/rhythm-pub-20261104/후보]
const path = require('node:path'), fs = require('node:fs');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const OUT_ROOT = path.join(공용작업본(path.resolve(__dirname, '../../../..')), '.tmp', 'rhythm-pub-20261104');
const DIR = process.argv[2] || path.join(OUT_ROOT, '후보');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.json': 'application/json' };
const FRAME = 'https://synk.im/world/__rhythm_frame__';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(view) {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { try { localStorage.setItem('synk.world.rhythm.calibrated', '1'); } catch { /* 저장 못 함 */ } });
  const page = await ctx.newPage();
  const errors = [], failed = [], fromCandidate = new Set();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  await page.route('https://synk.im/world/**', async (route) => {
    const u = new URL(route.request().url()), rel = decodeURIComponent(u.pathname).replace(/^\//, '');
    if (u.href.startsWith(FRAME)) return route.fulfill({ contentType: TYPES['.html'], body: '<!doctype html><meta charset=utf-8><link rel=icon href=data:,><style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%;display:block}</style><iframe class="game-frame" src="/world/korean-rhythm/index.html?qa=1" allow="autoplay"></iframe>' });
    const file = path.join(DIR, rel);
    if (fs.existsSync(file) && fs.statSync(file).isFile()) { fromCandidate.add(rel); return route.fulfill({ contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) }); }
    return route.continue();
  });
  await page.goto(FRAME, { timeout: 60000 });
  const fr = () => page.frames().find((f) => f.url().includes('/korean-rhythm/index.html'));
  for (let i = 0; i < 200; i += 1) { if (await fr()?.evaluate(() => !!window.__rhythm && !!document.querySelector('.w-art')).catch(() => false)) break; await sleep(150); }
  const out = { view: `${view.width}x${view.height}` };
  out.host = await fr().evaluate(() => document.documentElement.dataset.host);
  out.lobby = await fr().evaluate(() => ({ art: !!document.querySelector('.w-art'), mongleImgs: document.querySelectorAll('img[src*=mongle]').length, start: document.getElementById('start-button')?.textContent?.trim() }));
  const shot = (n) => page.screenshot({ path: path.join(OUT_ROOT, `후보시험-${view.width}-${n}.png`) });
  await sleep(1500); await shot('입구');
  await fr().locator('#start-button').click();
  const until = async (test, ms = 45000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fr().evaluate(test).catch(() => false)) return true; await sleep(120); } return false; };
  out.started = await until(() => window.__rhythm.state().screen === 'game' && window.__rhythm.state().time > -1);
  await fr().evaluate(() => { window.__rhythm.autoplay(true); window.__rhythm.plan(['right', 'right', 'right', 'right', 'right']); });
  out.ran = await until(() => window.__rhythm.state().time > 7);
  await shot('놀이');
  const st = await fr().evaluate(() => { const s = window.__rhythm.state(); return { hits: s.hits, combo: s.combo, duration: s.duration, q0: s.questions[0].answerOpen }; });
  out.hits = st.hits; out.combo = st.combo;
  await fr().evaluate((t) => window.__rhythm.seek(t), st.duration - 3);
  out.results = await until(() => window.__rhythm.state().screen === 'results');
  await sleep(3800); await shot('결과');
  out.title = await fr().evaluate(() => document.getElementById('result-title')?.textContent);
  out.dots = await fr().evaluate(() => document.querySelectorAll('#w-dots li').length);
  out.overflow = await fr().evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  out.fromCandidate = fromCandidate.size;
  out.errors = errors; out.failed = failed;
  await browser.close();
  return out;
}
(async () => {
  const rows = [];
  for (const view of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) rows.push(await run(view));
  console.log(JSON.stringify(rows, null, 1));
  process.exitCode = rows.every((r) => r.started && r.ran && r.results && !r.errors.length && !r.failed.length && !r.overflow) ? 0 : 1;
})().catch((e) => { console.error(e); process.exit(1); });
