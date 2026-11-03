'use strict';
// 말의 리듬 캠퍼스 판(2026-11-04) — 게임 틀(틀서버.mjs) 안에서 입구 → 놀이(듣기 · 답 · 맞힘) → 결과를 찍는다. 넘침 · 콘솔 오류 · 실패 요청도 센다.
//   node 장면.cjs [이름표=now] [--입구만] [--틀 <이미 뜬 틀 주소>]   (틀서버.mjs를 스스로 띄운다)
// 찍은 것: 공용 작업본 .tmp/rhythm-world-20261104/장면/<이름표>/ (phone-*.png · pc-*.png · report.json)
const path = require('node:path'), fs = require('node:fs');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');

const args = process.argv.slice(2);
const tag = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--틀') || 'now';
const BASE = (args.includes('--틀') ? args[args.indexOf('--틀') + 1] : null) || 'http://127.0.0.1:5292';
const { spawn } = require('node:child_process');
async function startFrame() {
  if (args.includes('--틀')) return null;
  const child = spawn(process.execPath, [path.join(__dirname, '틀서버.mjs'), '5292'], { stdio: 'ignore' });
  for (let i = 0; i < 50; i += 1) { try { if ((await fetch(BASE + '/')).ok) return child; } catch { /* 아직 */ } await new Promise((r) => setTimeout(r, 100)); }
  child.kill(); throw Error('틀 서버가 뜨지 않았다');
}
const OUT = path.join(공용작업본(path.resolve(__dirname, '../../../..')), '.tmp', 'rhythm-world-20261104', '장면', tag);
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VIEWS = [
  { name: 'phone', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  { name: 'pc', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  { name: 'small', viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  { name: 'land', viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  { name: 'calm', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, reducedMotion: 'reduce' },
];

async function run(view, report) {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: view.viewport, deviceScaleFactor: view.deviceScaleFactor, hasTouch: !!view.hasTouch, isMobile: !!view.isMobile, reducedMotion: view.reducedMotion || 'no-preference' });
  await ctx.addInitScript(() => { try { localStorage.setItem('synk.world.rhythm.calibrated', '1'); } catch {} });
  const page = await ctx.newPage();
  const errors = [], failed = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => failed.push(r.url()));
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  await page.goto(BASE + '/');
  const frameEl = await page.waitForSelector('iframe.game-frame');
  const f = await frameEl.contentFrame();
  await f.waitForFunction(() => document.documentElement.dataset.host === 'world' && window.__rhythm);
  await sleep(1200);
  const shot = async (name) => { await page.screenshot({ path: path.join(OUT, `${view.name}-${name}.png`) }); };
  const overflow = async (where) => {
    const o = await f.evaluate(() => ({ sx: document.scrollingElement.scrollWidth - innerWidth }));
    if (o.sx > 0) report.overflow.push(`${view.name} ${where} 가로 넘침 ${o.sx}px`);
  };
  await shot('1-lobby'); await overflow('lobby');
  if (args.includes('--입구만')) { report.errors.push(...errors.map((e) => `${view.name} ${e}`)); await browser.close(); return; }
  await f.evaluate(() => document.scrollingElement.scrollTo(0, document.scrollingElement.scrollHeight));
  await sleep(300); await shot('2-lobby-bottom');
  await f.evaluate(() => document.scrollingElement.scrollTo(0, 0));
  await f.click('#start-button');
  await f.waitForFunction(() => window.__rhythm.state().screen === 'game' && window.__rhythm.state().time > -2.5, null, { timeout: 30000 });
  await f.evaluate(() => { window.__rhythm.autoplay(true); window.__rhythm.plan(['right', 'wrong', 'right', 'right', 'right']); });
  await sleep(500); await shot('3-count');
  await f.waitForFunction(() => window.__rhythm.state().time > 6, null, { timeout: 20000 });
  await shot('4-play'); await overflow('game');
  const q = await f.evaluate(() => window.__rhythm.state().questions[0]);
  await f.evaluate((t) => window.__rhythm.seek(t), q.showTime + 0.6);
  await sleep(700); await shot('5-listen');
  await f.evaluate((t) => window.__rhythm.seek(t), q.answerOpen + 0.05);
  await sleep(450); await shot('6-answer');
  await f.waitForFunction(() => window.__rhythm.state().questions[0].state !== 'pending', null, { timeout: 10000 });
  await sleep(250); await shot('7-answered');
  const dur = await f.evaluate(() => window.__rhythm.state().duration);
  await f.evaluate((t) => window.__rhythm.seek(t), dur - 3);
  await f.waitForFunction(() => window.__rhythm.state().screen === 'results', null, { timeout: 30000 });
  await sleep(1200); await shot('8-results'); await overflow('results');
  await f.evaluate(() => document.scrollingElement.scrollTo(0, document.scrollingElement.scrollHeight));
  await sleep(300); await shot('9-results-bottom');
  report.errors.push(...errors.map((e) => `${view.name} ${e}`));
  report.failed.push(...failed.map((e) => `${view.name} ${e}`));
  await browser.close();
}

(async () => {
  const server = await startFrame();
  const report = { tag, at: new Date().toISOString(), overflow: [], errors: [], failed: [] };
  for (const view of VIEWS) await run(view, report);
  server?.kill();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  console.log(OUT); console.log(JSON.stringify(report));
})().catch((e) => { console.error(e); process.exit(1); });
