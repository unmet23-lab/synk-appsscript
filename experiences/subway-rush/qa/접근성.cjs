'use strict';
// 환승 러시 — 화면마다 접근성(axe)을 본다. 배포 점검은 첫 화면만 재므로 입구 · 고르기 · 글로 보기 · 멈춤 · 만남 · 결과 · 내 노선도를 여기서 돈다.
// 실제 손짓으로 끝까지 간다(자동 진행 없이). 첫 칸만 누르므로 오답 화면도 지난다.
//   node experiences/subway-rush/qa/접근성.cjs [주소] [출력 폴더]
//   주소 예: https://synk.im/world/subway-rush/ · http://127.0.0.1:5207/index.html
// 사진 위 글자의 color-contrast는 도구가 배경을 못 읽은 오판일 수 있으니 찍은 그림으로 본다.
const path = require('node:path'), fs = require('node:fs');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../node_modules')] }));
const axeSource = fs.readFileSync(path.resolve(__dirname, '../../../tools/vendor/axe.min.js'), 'utf8');
const BASE = process.argv[2] || 'https://synk.im/world/subway-rush/';
const OUT = process.argv[3] || path.join(require('node:os').tmpdir(), 'subway-rush-접근성');
fs.mkdirSync(OUT, { recursive: true });
const URL_ = `${BASE}${BASE.includes('?') ? '&' : '?'}qa=1&seed=21`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(width, height, mobile) {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--headless=new', '--autoplay-policy=no-user-gesture-required', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: mobile, isMobile: mobile });
  const page = await ctx.newPage(), errors = [], failed = [], found = {};
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) failed.push(`${r.status()} ${r.url()}`); });
  const scan = async (name) => {
    if (found[name]) return;
    found[name] = [];
    await page.evaluate(axeSource);
    const r = await page.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }));
    found[name] = r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, at: v.nodes.slice(0, 3).map((x) => x.target.join(' ')) }));
    await page.screenshot({ path: path.join(OUT, `${width}_${name}.png`) });
  };
  const shown = (id) => page.evaluate((x) => { const e = document.getElementById(x); return !!e && !e.hidden; }, id);
  await page.goto(URL_, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!window.__subway, null, { timeout: 60000 });
  await page.waitForSelector('#reader', { state: 'visible', timeout: 60000 });
  await sleep(1500);
  await scan('입구');
  await page.locator('#reader').click();
  const t0 = Date.now();
  let paused = false;
  while (Date.now() - t0 < 420000) {
    if (await shown('result')) break;
    if (await shown('replies')) {
      const b = page.locator('#replies button:not([disabled])');
      if (await b.count()) { await scan('만남'); await b.first().click({ timeout: 3000 }).catch(() => {}); await sleep(400); continue; }
    }
    if (await shown('zones')) {
      const ready = await page.locator('#zones button:not([disabled])').count();
      const keys = await page.evaluate(() => !document.getElementById('key-text').disabled);
      if (keys && !found['글로 보기']) {
        await scan('전광판');
        await page.locator('#key-text').click({ timeout: 3000 }).catch(() => {});
        await sleep(500);
        await scan('글로 보기');
      }
      if (keys && !paused) {
        paused = true;
        await page.locator('#key-pause').click({ timeout: 3000 }).catch(() => {});
        await sleep(500);
        await scan('멈춤');
        await page.locator('#btn-resume').click({ timeout: 3000 }).catch(() => {});
        await sleep(600);
      }
      if (ready) {
        await scan('고르기');
        await page.locator('#zones button:not([disabled])').first().click({ timeout: 3000 }).catch(() => {});
        await sleep(350);
        if (await shown('notice')) await scan('틀렸을 때');
      }
    }
    await sleep(250);
  }
  if (!(await shown('result'))) throw Error(`결과까지 못 갔다 · 지금까지 ${Object.keys(found).join(' · ')}`);
  await sleep(2500);
  await scan('결과');
  await page.locator('#btn-again').click();
  await page.waitForSelector('#reader', { state: 'visible', timeout: 30000 });
  await sleep(800);
  await page.locator('#ticket-album').click({ timeout: 8000 });
  await sleep(600);
  await scan('내 노선도');
  await Promise.race([browser.close(), sleep(4000)]).catch(() => {});
  return { 폭: width, 화면: found, 오류: errors, 실패요청: failed };
}

(async () => {
  const out = [await run(390, 844, true), await run(1280, 800, false)];
  fs.writeFileSync(path.join(OUT, '결과.json'), JSON.stringify(out, null, 1));
  for (const o of out) {
    console.log(`== ${o.폭}px · 오류 ${o.오류.length} · 실패 요청 ${o.실패요청.length}`);
    for (const [name, list] of Object.entries(o.화면)) console.log(`  ${name}: ${list.length ? list.map((v) => `${v.impact} ${v.id} ×${v.n} (${v.at.join(' | ')})`).join(' / ') : '위반 0'}`);
    for (const e of [...o.오류, ...o.실패요청].slice(0, 6)) console.log(`  ! ${e}`);
  }
  console.log(`→ ${OUT}`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
