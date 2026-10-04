'use strict';
// 말 랠리 장면 확인: 연습 공 하나를 처음부터 받아칠 때까지 일정 간격으로 찍는다(컴퓨터·휴대폰). 카메라·크기·겹침을 눈으로 본다.
// 쓰는 법: node experiences/talk-rally/server.mjs 를 켠 뒤  node experiences/talk-rally/qa/frames.cjs [desktop|phone] [시점 JSON]
const path = require('node:path'), fs = require('node:fs');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM] }));
const URL_BASE = process.env.RALLY_URL || 'http://127.0.0.1:5221/';
const OUT = path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const VIEWS = { desktop: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const pick = process.argv[2], viewOverride = process.argv[3] ? JSON.parse(process.argv[3]) : null;
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'] });
  const shots = [];
  for (const [name, view] of Object.entries(VIEWS)) {
    if (pick && pick !== name) continue;
    const page = await (await browser.newContext(view)).newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(URL_BASE + '?qa'); await page.waitForSelector('#btn-start'); await sleep(1200);
    await page.screenshot({ path: path.join(OUT, `${name}_00_lobby.png`) }); shots.push(`${name}_00_lobby.png`);
    await page.click('#btn-start');
    const S = () => page.evaluate(() => window.__rally.state());
    for (let w = 0; w < 100 && !(await page.evaluate(() => !!window.__rally.stage())); w++) await sleep(100);
    if (viewOverride) await page.evaluate((o) => window.__rally.stage().debugView(o), viewOverride);
    let st = await S();
    for (let w = 0; w < 80 && st.cur?.phase !== 'talk'; w++) { await sleep(100); st = await S(); }
    await page.screenshot({ path: path.join(OUT, `${name}_01_talk.png`) }); shots.push(`${name}_01_talk.png`);
    for (let w = 0; w < 80 && st.cur?.phase !== 'flight'; w++) { await sleep(50); st = await S(); }
    await sleep(500);
    await page.screenshot({ path: path.join(OUT, `${name}_02_flight.png`) }); shots.push(`${name}_02_flight.png`);
    await page.evaluate((i) => window.__rally.choose(i), st.cur.options.indexOf(st.cur.answer));
    await sleep(500);
    await page.screenshot({ path: path.join(OUT, `${name}_03_chosen.png`) }); shots.push(`${name}_03_chosen.png`);
    for (let w = 0; w < 80 && st.cur?.phase === 'flight'; w++) { await sleep(30); st = await S(); }
    await sleep(60);
    await page.screenshot({ path: path.join(OUT, `${name}_04_hit.png`) }); shots.push(`${name}_04_hit.png`);
    await sleep(380);
    await page.screenshot({ path: path.join(OUT, `${name}_05_return.png`) }); shots.push(`${name}_05_return.png`);
    console.log(name, '오류', errors.length, errors.slice(0, 3).join(' | '));
  }
  await browser.close();
  console.log(shots.join(' '));
})().catch((e) => { console.error(e); process.exit(1); });
