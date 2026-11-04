'use strict';
// 말 랠리 캠퍼스 판 — 화면마다 접근성(axe)을 본다. 배포 점검은 첫 화면만 보므로 입구 · 말 걺 · 공 기다림 · 받아치기 · 해설 · 멈춤 · 결과를 여기서 돈다(찰칵 낱말 접근성.cjs를 옮김).
// 주소로 바로 연 앱 사본(/world/talk-rally/, world-host.js가 경로로 WORLD 판을 켠다)으로 재므로 바로 열기에서 오류 · 실패 요청이 없는지도 함께 본다.
//   node experiences/talk-rally/qa/world-campus-20261104/접근성.cjs [공개 빌드의 world 폴더(주면 그 폴더를 /world/로, 없으면 experiences/를 /world/로)]
const path = require('node:path'), fs = require('node:fs'), http = require('node:http');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../../..');
const axeSource = fs.readFileSync(path.join(ROOT, 'tools/vendor/axe.min.js'), 'utf8');
const WORLD = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'experiences');
const OUT = path.join(공용작업본(ROOT), '.tmp', 'talk-rally-world-20261104', '접근성');
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.json': 'application/json', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const serve = () => new Promise((resolve) => {
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = u.startsWith('/world/') ? path.join(WORLD, u.slice(7)) : path.join(ROOT, 'nothing-here');
    if (!file.startsWith(WORLD) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(fs.readFileSync(file));
  });
  srv.listen(0, '127.0.0.1', () => resolve(srv));
});

async function run(base, width, height, mobile) {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: mobile, isMobile: mobile });
  const page = await ctx.newPage(), errors = [], failed = [], found = {};
  const sleep = (ms) => page.waitForTimeout(ms);
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${new URL(r.url()).pathname}`); });
  const scan = async (name) => {
    await page.evaluate(axeSource);
    const r = await page.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }));
    found[name] = r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, at: v.nodes.slice(0, 3).map((x) => x.target.join(' ')) }));
    await page.screenshot({ path: path.join(OUT, `${width}_${name}.png`) });
  };
  const cur = () => page.evaluate(() => { const s = window.__rally.state(); return { cur: s.cur, over: !document.querySelector('#results').hidden, explain: !!document.querySelector('#btn-next')?.offsetParent }; });
  const flying = async () => { for (let i = 0; i < 300; i += 1) { const c = await cur(); if (c.explain) { await page.evaluate(() => document.querySelector('#btn-next').click()); await sleep(200); continue; } if (c.cur?.choice == null && c.cur?.phase === 'flight') return c.cur; await sleep(100); } throw Error('공이 안 뜸'); };
  const pick = (c, ok) => page.evaluate((n) => window.__rally.choose(n), ok ? c.options.indexOf(c.answer) : c.options.findIndex((o) => o !== c.answer));
  await page.goto(`${base}world/talk-rally/?qa=1`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!window.__rally && document.documentElement.classList.contains('w-ready'), null, { timeout: 60000 });
  found.host = await page.evaluate(() => document.documentElement.dataset.host);
  await sleep(2400);
  await scan('입구');
  await page.evaluate(() => document.querySelector('#btn-start').click());
  await sleep(1800);
  await scan('말걺');
  let c = await flying();
  await sleep(4200);
  await scan('공기다림');
  await pick(c, true); await sleep(1800);
  c = await flying(); await pick(c, true); await sleep(1200);
  await scan('받아치기');
  c = await flying(); await pick(c, false); await sleep(1800);
  await scan('해설');
  await page.evaluate(() => document.querySelector('#btn-next').click()); await sleep(500);
  await page.evaluate(() => document.querySelector('#pause').click()); await sleep(600);
  await scan('멈춤');
  await page.evaluate(() => document.querySelector('#resume').click()); await sleep(500);
  await page.evaluate(() => window.__rally.finish()); await sleep(4500);
  await scan('결과');
  await page.evaluate(() => document.querySelector('#w-room').click()); await sleep(1200);
  found.backLobby = await page.evaluate(() => !document.querySelector('#lobby').hidden);
  await Promise.race([browser.close(), sleep(4000)]).catch(() => {});   // 바쁜 PC에서 닫기가 끝나지 않아도 보고는 쓴다(현장노트 시험_화면확인)
  return { width, found, errors, failed: [...new Set(failed)] };
}

(async () => {
  const srv = await serve(), base = `http://127.0.0.1:${srv.address().port}/`;
  const report = [await run(base, 390, 844, true), await run(base, 1280, 800, false)];
  srv.close();
  let bad = 0;
  for (const r of report) {
    console.log(`── ${r.width} · data-host ${r.found.host} · 입구로 돌아옴 ${r.found.backLobby} · 오류 ${r.errors.length} · 실패 요청 ${r.failed.length}`);
    for (const [name, list] of Object.entries(r.found)) {
      if (!Array.isArray(list)) continue;
      console.log(`${name}: ${list.length ? list.map((v) => `${v.impact} ${v.id} ×${v.n} ${v.at.join(', ')}`).join(' | ') : '위반 없음'}`);
      bad += list.filter((v) => v.impact === 'critical').length;
    }
    if (r.errors.length) console.log(r.errors.slice(0, 5).join('\n'));
    if (r.failed.length) console.log(r.failed.slice(0, 8).join('\n'));
    bad += r.failed.length + r.errors.length;
  }
  fs.writeFileSync(path.join(OUT, '접근성.json'), `${JSON.stringify(report, null, 1)}\n`);
  console.log(bad ? `✗ 문제 ${bad}` : '✓ 치명 위반 · 오류 · 실패 요청 없음');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(String(e).slice(0, 800)); process.exit(2); });
