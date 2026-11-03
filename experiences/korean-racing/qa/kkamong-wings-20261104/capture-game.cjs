'use strict';
// 실제 게임(?qa)에서 운전자를 까몽으로 고르고, 해안도로 위 내 차(코스트 GT)를 뒤 · 옆 · 앞에서 찍는다(2026-11-04).
// experiences 폴더를 정적 서버로 띄운 뒤:
//   KKAMONG_ORIGIN=http://127.0.0.1:5288 node experiences/korean-racing/qa/kkamong-wings-20261104/capture-game.cjs [접두어]
// heroPose는 확인용 각도만 바꾸고 판정 · 기록은 건드리지 않는다. 결과는 이 폴더 shots/에만 쓴다.
const path = require('node:path'), fs = require('node:fs');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM] }));
const ORIGIN = process.env.KKAMONG_ORIGIN || 'http://127.0.0.1:5288';
const prefix = process.argv[2] || 'game';
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const POSES = [
  // 실제 주행 추적 카메라와 같은 거리 · 높이 · 화각(데스크톱: 9 m 뒤, 3.6 m 위, 55°)
  { name: 'race-chase', s: 520, offset: 0, side: 0, back: 9, height: 3.6, look: 1.2, fov: 55 },
  { name: 'near-chase', s: 520, offset: 0, side: .55, back: 3.6, height: 2.1, look: 1.0, fov: 38 },
  { name: 'side', s: 520, offset: 0, side: 4.6, back: .4, height: 1.7, look: 1.0, fov: 34 },
  { name: 'front34', s: 520, offset: 0, side: 3.4, back: -4.6, height: 2.0, look: 1.0, fov: 34 },
];
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem('synk-racing-tutorial', JSON.stringify({ version: 1, completed: true })); } catch {} });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${ORIGIN}/korean-racing/?qa`);
  await page.waitForFunction(() => window.__racing?.snapshot().ready, null, { timeout: 180000 });
  await page.click('#driver-kkamong');
  await page.addStyleTag({ content: '.qa-clean #game .game-bar,.qa-clean .top-stack,.qa-clean .lane-tags,.qa-clean .dash,.qa-clean .pop{display:none!important}' });
  for (const pose of POSES) {
    await page.evaluate((p) => window.__racingQA.heroPose(p), pose);
    await page.waitForTimeout(2500);
    await page.locator('#world canvas').screenshot({ path: path.join(OUT, `${prefix}-${pose.name}.png`) });
    console.log('saved', `${prefix}-${pose.name}.png`);
  }
  const driver = await page.evaluate(() => window.__racing.snapshot().driver);
  console.log(JSON.stringify({ driver, errors }));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
