'use strict';
// 공개 뒤 라이브 확인(2026-11-04): synk.im에서 ① 손님 길 — 카드 잠김 → 카페 첫 방문 → 새로 열림 → 누르면 로그인, ② /world/talk-rally/ 바로 열기 — WORLD 겉으로 시작해 공 하나를 받아친다.
// 시합 한 판(13공 · 기록 전송)은 후보시험.cjs에 빈 폴더를 주면 라이브 파일만으로 돈다. 공개본은 바꾸지 않는다.
//   node experiences/talk-rally/qa/world-campus-20261104/라이브확인.cjs
const path = require('node:path'), fs = require('node:fs');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const OUT = path.join(공용작업본(path.resolve(__dirname, '../../../..')), '.tmp', 'talk-rally-world-20261104', '라이브');
fs.mkdirSync(OUT, { recursive: true });
const ORIGIN = 'https://synk.im/world/';

async function open(browser, view) {
  const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const log = { errors: [], failed: [], mongle: [], clips: 0 };
  page.setDefaultTimeout(40000);
  page.on('pageerror', (e) => log.errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') log.errors.push(m.text()); });
  page.on('response', (r) => {
    const u = r.url();
    if (r.status() >= 400) log.failed.push(`${r.status()} ${u}`);
    if (/talk-rally\/.*mongle/.test(u)) log.mongle.push(u);
    if (/talk-rally\/.*clips\//.test(u)) log.clips += 1;
  });
  return { ctx, page, log };
}

async function guest(browser, view) {
  const { ctx, page, log } = await open(browser, view);
  const out = { view: `${view.width}x${view.height}` };
  const 쉼 = (ms) => page.waitForTimeout(ms);
  await page.goto(`${ORIGIN}${view.width < 700 ? 'mobile' : 'desktop'}.html?opening=off`, { waitUntil: 'load', timeout: 60000 });
  await page.getByText('계속하기', { exact: true }).click();
  await page.getByText('읽을 수 있어요', { exact: true }).click();
  await page.locator('button:has-text("함께하기")').first().click();
  await page.locator('[data-tutor-action=finish]').click();
  await 쉼(1200);
  const 카드 = async () => { await page.locator('[data-view=play]').first().click(); await page.waitForSelector('[data-game=rally]'); const el = page.locator('[data-game=rally]'); await el.scrollIntoViewIfNeeded(); return (await el.innerText()).replace(/\s+/g, ' ').trim(); };
  out.locked = await 카드();
  await page.screenshot({ path: path.join(OUT, `${view.width}-잠김.png`) });
  await page.locator('#panel-close').click();
  await 쉼(500);
  await page.evaluate(() => document.querySelector('[data-view=cafe]').click());
  await page.locator('.felt-button[data-life-lesson=cafe-apply]').click();
  const 다음 = async () => { if (await page.locator('.cafe-welcome [data-life-cafe-mode=read]').count()) await page.locator('[data-life-cafe-mode=read]').click(); await page.locator('[data-life-cafe-next]:not([disabled])').click(); await 쉼(700); };
  const 고름 = async (id) => { await page.locator(`[data-life-cafe-choice=${id}]:not([disabled])`).click(); await 쉼(700); };
  await 다음(); await 고름('b'); await 다음(); await 고름('c'); await 다음(); await 다음(); await 고름('a'); await 다음();
  await page.locator('#panel-close').click();
  await 쉼(600);
  out.open = await 카드();
  await page.screenshot({ path: path.join(OUT, `${view.width}-열림.png`) });
  await page.locator('[data-game=rally]').click();
  await 쉼(1500);
  await page.screenshot({ path: path.join(OUT, `${view.width}-눌렀을때.png`) });
  out.afterClick = await page.evaluate(() => ({ frame: !!document.querySelector('.game-frame'), login: /로그인/.test(document.body.innerText) }));
  Object.assign(out, log);
  await ctx.close();
  return out;
}

async function direct(browser, view) {
  const { ctx, page, log } = await open(browser, view);
  const out = { view: `${view.width}x${view.height}` };
  await page.goto(`${ORIGIN}talk-rally/`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.documentElement.classList.contains('w-ready'), null, { timeout: 60000 });
  out.host = await page.evaluate(() => document.documentElement.dataset.host);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, `${view.width}-바로열기.png`) });
  await page.locator('#btn-start').click();
  await page.waitForFunction(() => document.querySelectorAll('#cards button.card').length >= 2 && !document.querySelector('#cards').hidden, null, { timeout: 40000 }).catch(() => { out.noOptions = true; });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, `${view.width}-바로열기_시합.png`) });
  if (!out.noOptions) {
    await page.locator('#cards button.card').first().click({ force: true }).catch((e) => { out.clickError = String(e).slice(0, 200); });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, `${view.width}-바로열기_친뒤.png`) });
  }
  out.overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  Object.assign(out, log);
  await ctx.close();
  return out;
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
  const rows = { guest: [], direct: [] };
  for (const view of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    rows.guest.push(await guest(browser, view));
    rows.direct.push(await direct(browser, view));
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, '결과.json'), JSON.stringify(rows, null, 1));
  console.log(JSON.stringify(rows, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
