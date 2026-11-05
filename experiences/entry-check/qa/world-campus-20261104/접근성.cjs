'use strict';
// 입장 검사 캠퍼스 판 — 화면마다 접근성(axe)을 본다. 배포 점검은 첫 화면만 보므로 입구 · 안내 · 연수 · 손님 · 거절 이유 · 판정 · 그 뒤에 · 결과를 여기서 돈다(찰칵 낱말 접근성.cjs를 옮김).
// 주소로 바로 연 앱 사본(/world/entry-check/, world-host.js가 경로로 WORLD 판을 켠다)으로 재므로 바로 열기에서 오류 · 실패 요청이 없는지도 함께 본다.
//   node experiences/entry-check/qa/world-campus-20261104/접근성.cjs [공개 빌드의 world 폴더(기본: 공용 작업본 .tmp의 공개/new/world)]
const path = require('node:path'), fs = require('node:fs'), http = require('node:http');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../../..');
const axeSource = fs.readFileSync(path.join(ROOT, 'tools/vendor/axe.min.js'), 'utf8');
const WORLD = path.resolve(process.argv[2] || path.join(공용작업본(ROOT), '.tmp', 'entry-check-world-20261104', '공개', 'new', 'world'));   // 공개 빌드로 재야 공개본에서 뺀 파일을 찾는 404가 잡힌다(Fable 지적, 11-05)
if (!fs.existsSync(path.join(WORLD, 'entry-check/index.html'))) throw Error(`공개 빌드가 없다: ${WORLD} — 공개후보.cjs를 먼저 돌리거나 폴더를 인자로 준다`);
const OUT = path.join(공용작업본(ROOT), '.tmp', 'entry-check-world-20261104', '접근성');
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
  const cur = () => page.evaluate(() => window.__entry.state().cur);
  const next = async (앞) => { for (let i = 0; i < 80; i += 1) { const c = await cur(); if (c?.id && c.id !== 앞 && !c.done) return c; await sleep(100); } throw Error('손님이 안 온다'); };
  const click = (q) => page.evaluate((s) => document.querySelector(s).click(), q);
  const judge = async (c, 고름) => { if (고름 === 'pass') await click('#btn-pass'); else { await click('#btn-reject'); await sleep(350); await click(`#notice .rule[data-rule="${고름}"]`); } };
  await page.goto(`${base}world/entry-check/?qa=1`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!window.__entry && document.documentElement.classList.contains('w-ready'), null, { timeout: 60000 });
  found.host = await page.evaluate(() => document.documentElement.dataset.host);
  await sleep(2400);
  await scan('입구');
  await click('#rec-start'); await sleep(1400);
  await scan('안내');
  await click('#btn-begin'); await sleep(1600);
  if (await page.evaluate(() => !document.querySelector('#coach').hidden)) { await scan('연수'); await click('#coach-skip'); await sleep(500); }
  let c = await next(null);
  await sleep(1600);
  await scan('손님');
  await click('#btn-reject'); await sleep(450);
  await scan('거절이유');
  await page.evaluate(() => { const b = [...document.querySelectorAll('#choose button')].at(-1); b?.click(); }); await sleep(300);
  await judge(c, c.answer); await sleep(1500);
  await scan('판정맞음');
  await click('#btn-next'); await sleep(600);
  c = await next(c.id); await sleep(800);
  if (c.answer === 'pass') { await click('#btn-reject'); await sleep(350); await page.evaluate(() => document.querySelector('#notice .rule').click()); } else await click('#btn-pass');
  await sleep(700);
  await scan('판정틀림');
  await sleep(4200);
  await scan('그뒤에');
  for (let g = 0; g < 14; g += 1) {
    await click('#btn-next'); await sleep(500);
    if (await page.evaluate(() => !document.querySelector('#results').hidden)) break;
    c = await next(c.id); await sleep(200);
    await judge(c, c.answer); await sleep(700);
  }
  await sleep(3600);
  await scan('결과');
  await click('#w-room'); await sleep(1200);
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
