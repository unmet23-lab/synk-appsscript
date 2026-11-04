'use strict';
// 화면마다 접근성(axe)을 본다 — 배포 점검은 첫 화면만 보므로 입구 · 둘러보기 · 카드 · 부탁 · 인화 · 결과 · 앨범을 여기서 돈다.
//   node experiences/snap-words/qa/접근성.cjs <주소> <출력 폴더>
//   주소 예: http://127.0.0.1:5207/index.html?seed=7 · https://synk.im/world/snap-words/
const path = require('node:path'), fs = require('node:fs');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const roots = [NM, path.resolve(__dirname, '../../../node_modules')];
const { chromium } = require(require.resolve('playwright', { paths: roots }));
const axeSource = fs.readFileSync(path.resolve(__dirname, '../../../tools/vendor/axe.min.js'), 'utf8');
const BASE = process.argv[2] || 'http://127.0.0.1:5207/index.html?seed=7';
const OUT = process.argv[3] || path.join(__dirname, '화면');
fs.mkdirSync(OUT, { recursive: true });

async function run(width, height, mobile) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: mobile, isMobile: mobile });
  const page = await ctx.newPage(), errors = [], failed = [], found = {};
  const sleep = (ms) => page.waitForTimeout(ms);
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  const scan = async (name) => {
    await page.evaluate(axeSource);
    const r = await page.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }));
    found[name] = r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, at: v.nodes.slice(0, 3).map((x) => x.target.join(' ')) }));
    await page.screenshot({ path: path.join(OUT, `${width}_${name}.png`) });
  };
  const start = () => page.waitForFunction(() => window.__snap.S.screen === 'shoot' && !window.__snap.S.busy && !document.querySelector('#msg').hidden, null, { timeout: 30000 });
  await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!window.__snap, null, { timeout: 60000 });
  await sleep(1500);
  await scan('입구');
  await page.locator('[data-go=start]').click();
  await start(); await sleep(700);
  await scan('둘러보기');
  await page.evaluate(() => window.__snap.focusOn(window.__snap.S.items.find((i) => i.group === 'blade'))); await sleep(800);
  await page.locator('#shutter').click(); await sleep(900);
  await scan('카드');
  await page.evaluate(() => window.__snap.focusOn(window.__snap.S.items.find((i) => i.word === 'cat'))); await sleep(700);
  await page.locator('#shutter').click(); await sleep(900);
  await page.evaluate(() => window.__snap.focusOn(window.__snap.S.items.find((i) => i.kind === 'fixed'))); await sleep(700);
  await page.locator('#shutter').click(); await sleep(900);
  await page.locator('#step-back').click(); await sleep(700);
  await page.locator('#msg .pill').click(); await sleep(1100);
  await scan('부탁');
  for (let g = 0; g < 8; g += 1) {
    const st = await page.evaluate(() => { const { S } = window.__snap, m = S.missions[S.mi]; return { phase: S.phase, mi: S.mi, kind: m?.kind, word: m?.word }; });
    if (st.phase !== 'mission') break;
    await page.evaluate(({ kind, word }) => { const { S } = window.__snap; window.__snap.focusOn(S.items.find((i) => (kind === 'word' ? i.kind === 'thing' : i.kind === 'plate') && i.word === word)); }, st);
    await sleep(600);
    await page.locator('#shutter').click();
    await page.waitForFunction((mi) => window.__snap.S.mi !== mi || window.__snap.S.phase !== 'mission', st.mi, { timeout: 12000 });
    await sleep(200);
  }
  await page.waitForFunction(() => window.__snap.S.screen === 'develop', null, { timeout: 12000 });
  await sleep(1600);
  await scan('인화');
  for (let i = 0; i < 3; i += 1) {
    if (await page.evaluate(() => window.__snap.S.screen !== 'develop')) break;
    await page.waitForFunction(() => document.querySelector('.dev-opt:not([disabled])'));
    const n = await page.evaluate(() => window.__snap.answerNow());
    await page.locator('.dev-opt').nth(n).click();
    await sleep(1500);
  }
  await page.waitForFunction(() => window.__snap.S.screen === 'result', null, { timeout: 12000 });
  await sleep(1400);
  await scan('결과');
  await page.locator('.res-row [data-go=album]').click(); await sleep(700);
  await scan('앨범');
  await Promise.race([browser.close(), sleep(4000)]).catch(() => {});   // 바쁜 PC에서 닫기가 끝나지 않아도 보고는 쓴다(현장노트 시험_화면확인)
  return { width, found, errors, failed };
}

(async () => {
  const report = [await run(390, 844, true), await run(1280, 800, false)];
  let bad = 0;
  for (const r of report) {
    console.log(`── ${r.width} · 오류 ${r.errors.length} · 실패 요청 ${r.failed.length}`);
    for (const [name, list] of Object.entries(r.found)) {
      console.log(`${name}: ${list.length ? list.map((v) => `${v.impact} ${v.id} ×${v.n} ${v.at.join(', ')}`).join(' | ') : '위반 없음'}`);
      bad += list.filter((v) => v.impact === 'critical').length;
    }
    if (r.errors.length) console.log(r.errors.slice(0, 5).join('\n'));
    if (r.failed.length) console.log(r.failed.slice(0, 5).join('\n'));
  }
  fs.writeFileSync(path.join(OUT, '접근성.json'), `${JSON.stringify(report, null, 1)}\n`);
  console.log(bad ? `✗ 치명 위반 ${bad}` : '✓ 치명 위반 없음');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(String(e).slice(0, 800)); process.exit(2); });
