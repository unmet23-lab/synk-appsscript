'use strict';
// 주문 폭주 캠퍼스 판(2026-11-03) — LAB 단독 화면이 그대로인지 잰다: 기준(git HEAD 또는 BASE_REF의 order-rush)과 지금 작업본을
// 같은 헤드리스 크롬에서 차례로 열어 입구 · 영업 · 결과의 계산 스타일(모든 요소) · 본문 DOM · 입구 화면 픽셀을 견준다.
// WORLD 겉(world-host.js · world-skin.css · world-cast.mjs · app.mjs의 WORLD 분기)은 data-host=world일 때만 걸리므로 차이는 0이어야 한다.
// 머리(head)의 새 줄 둘(world-host.js · world-skin.css)은 일부러 더한 것이라 DOM 견줌에서 뺀다.
//   node experiences/order-rush/qa/world-campus-20261103/lab-proof.cjs   (BASE_REF=<커밋> 으로 기준을 바꾼다)
const path = require('node:path'), fs = require('node:fs'), os = require('node:os'), http = require('node:http');
const { execFileSync } = require('node:child_process');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const ROOT = path.resolve(__dirname, '../../../..');
const GAME = path.join(ROOT, 'experiences/order-rush');
const REF = process.env.BASE_REF || 'HEAD';

function extractBase() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rush-base-'));
  const tar = path.join(dir, 'base.tar');
  execFileSync('git', ['-C', ROOT, 'archive', '--format=tar', '-o', tar, REF, 'experiences/order-rush'], { stdio: 'inherit' });
  execFileSync('tar', ['-xf', 'base.tar'], { cwd: dir, stdio: 'inherit' });   // 경로를 넘기면 GNU tar가 「C:」를 원격 주소로 읽는다
  return path.join(dir, 'experiences/order-rush');
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
function serve(dir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      try {
        let p = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
        if (!p.startsWith(dir)) throw 0;
        if (fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(fs.readFileSync(p));
      } catch { res.writeHead(404).end(); }
    }).listen(0, '127.0.0.1', () => resolve(server));
  });
}
const SNAP = () => {
  const props = ['display', 'position', 'width', 'height', 'top', 'left', 'margin', 'padding', 'color', 'background-color', 'background-image', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'border-radius', 'box-shadow', 'opacity', 'transform', 'filter', 'visibility', 'grid-template-columns', 'gap'];
  const out = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest('[hidden]') && el.tagName !== 'DIALOG') continue;
    const cs = getComputedStyle(el);
    out.push(el.tagName + (el.id ? '#' + el.id : '') + '|' + props.map((p) => cs.getPropertyValue(p)).join('|'));
  }
  return { styles: out, body: document.body.innerHTML.replace(/style="[^"]*--left[^"]*"/g, ''), host: document.documentElement.dataset.host || null };
};

async function capture(browser, base, view) {
  const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => { Date.now = () => 1762156800000; Math.random = () => 0.42; });   // 같은 손님 · 같은 순서
  await page.goto(base + 'index.html', { waitUntil: 'networkidle' });
  // 글꼴 · 그림이 다 풀린 뒤 찍는다 — 800ms 고정 대기만 두면 PC가 바쁠 때 한쪽만 그림이 덜 그려져 픽셀이 달랐다(11-03 밤 1440 한 번)
  await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((i) => (i.complete ? null : i.decode().catch(() => null)))]));
  await page.waitForTimeout(800);
  const lobby = await page.evaluate(SNAP), lobbyPng = await page.screenshot({ fullPage: true });
  await page.click('#start');
  await page.waitForTimeout(1500);
  const game = await page.evaluate(SNAP);
  await page.evaluate(() => { document.querySelector('[data-ingredient=coffee]').click(); document.querySelector('#serve').click(); });
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.querySelector('#pause').click());
  await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('#quit').click());
  await page.waitForTimeout(500);
  const back = await page.evaluate(SNAP);
  await ctx.close();
  return { lobby, lobbyPng, game, back, errors };
}
const origin = (v) => (v || '').replace(/http:\/\/127\.0\.0\.1:\d+/g, '');   // 두 서버의 포트만 다르다
function diff(a, b) {
  const n = Math.max(a.length, b.length), rows = [];
  for (let i = 0; i < n; i += 1) if (origin(a[i]) !== origin(b[i])) rows.push({ i, base: a[i], now: b[i] });
  return rows;
}

(async () => {
  const baseDir = extractBase();
  const [s1, s2] = await Promise.all([serve(baseDir), serve(GAME)]);
  const url = (s) => `http://127.0.0.1:${s.address().port}/`;
  const browser = await chromium.launch();
  const report = { ref: REF, views: [] };
  let bad = 0;
  for (const view of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const a = await capture(browser, url(s1), view), b = await capture(browser, url(s2), view);
    const pixels = Buffer.compare(a.lobbyPng, b.lobbyPng) === 0 ? 0 : (() => { let d = 0; const n = Math.min(a.lobbyPng.length, b.lobbyPng.length); for (let i = 0; i < n; i += 1) if (a.lobbyPng[i] !== b.lobbyPng[i]) d += 1; return d + Math.abs(a.lobbyPng.length - b.lobbyPng.length); })();
    const row = {
      view: `${view.width}x${view.height}`, host: [a.lobby.host, b.lobby.host],
      lobbyStyle: diff(a.lobby.styles, b.lobby.styles).length, lobbyDom: origin(a.lobby.body) === origin(b.lobby.body) ? 0 : 1, lobbyPngBytesDifferent: pixels,
      gameStyle: diff(a.game.styles, b.game.styles).length, gameDom: origin(a.game.body) === origin(b.game.body) ? 0 : 1,
      backStyle: diff(a.back.styles, b.back.styles).length, errors: [...a.errors, ...b.errors],
      sample: diff(a.game.styles, b.game.styles).slice(0, 3),
    };
    bad += row.lobbyStyle + row.lobbyDom + row.lobbyPngBytesDifferent + row.gameStyle + row.gameDom + row.backStyle + row.errors.length + (b.lobby.host ? 1 : 0);
    report.views.push(row);
  }
  await browser.close(); s1.close(); s2.close();
  report.ok = bad === 0;
  fs.writeFileSync(path.join(__dirname, 'lab-proof.json'), JSON.stringify(report, null, 1) + '\n');
  console.log(JSON.stringify(report, null, 1));
  process.exitCode = bad ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
