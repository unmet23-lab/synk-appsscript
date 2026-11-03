'use strict';
// 말의 리듬 캠퍼스 판(2026-11-04) — LAB 단독 화면이 그대로인지 잰다(주문 폭주 캠퍼스 판 lab-proof.cjs를 옮김): 기준(origin/master 또는 BASE_REF의 korean-rhythm)과
// 지금 작업본을 같은 헤드리스 크롬에서 차례로 열어 입구 · 놀이 · 결과의 계산 스타일(모든 요소) · 본문 DOM · 입구 화면 픽셀 · 입구 그림 캔버스 · 펠트 무대 판 캔버스를 견준다.
// WORLD 겉(world-host.js · world-skin.css · world-play.mjs · world-sfx.mjs · world-fx.mjs · app.mjs · stage.mjs · audio.mjs의 WORLD 분기)은
// data-host=world일 때만 걸리므로 차이는 0이어야 한다. 보면의 씨앗(crypto)과 Math.random은 두 쪽을 같게 고정한다.
//   node experiences/korean-rhythm/qa/world-campus-20261104/lab-proof.cjs   (기준은 origin/master, BASE_REF=<커밋> 으로 바꾼다)
const path = require('node:path'), fs = require('node:fs'), os = require('node:os'), http = require('node:http');
const { execFileSync } = require('node:child_process');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const ROOT = path.resolve(__dirname, '../../../..');
const EXP = path.join(ROOT, 'experiences');
const REF = process.env.BASE_REF || 'origin/master';

function extractBase() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rhythm-base-'));
  execFileSync('git', ['-C', ROOT, 'archive', '--format=tar', '-o', path.join(dir, 'base.tar'), REF, 'experiences/korean-rhythm', 'experiences/play-common', 'experiences/brand-opening', 'experiences/topik-items', 'experiences/social-conversion.mjs', 'experiences/korean-runner/controls.mjs'], { stdio: 'inherit' });
  execFileSync('tar', ['-xf', 'base.tar'], { cwd: dir, stdio: 'inherit' });
  return path.join(dir, 'experiences');
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
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
    if (el.tagName === 'CANVAS') continue;   // 캔버스 크기는 그림 판으로 따로 견준다
    const cs = getComputedStyle(el);
    out.push(el.tagName + (el.id ? '#' + el.id : '') + '|' + props.map((p) => cs.getPropertyValue(p)).join('|'));
  }
  // 찍는 순간에 따라 갈리는 칸(숨은 카운트 숫자 · 곡 진행 · 시간)은 견주지 않는다 — 두 쪽 모두 같은 글로 지운다
  const body = document.body.cloneNode(true);
  for (const sel of ['#countdown-number', '#now-time', '#learning-count', '#score', '#combo']) { const n = body.querySelector(sel); if (n) n.textContent = ''; }
  body.querySelector('#song-fill')?.removeAttribute('style');
  return { styles: out, body: body.innerHTML, host: document.documentElement.dataset.host || null };
};

async function capture(browser, base, view) {
  const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.addInitScript(() => {
    Math.random = () => 0.42;
    const fill = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = (a) => { if (a instanceof Uint32Array) { a.fill(123456789); return a; } return fill(a); };
    try { localStorage.clear(); } catch {}
  });
  await page.goto(base + 'korean-rhythm/index.html?qa=1', { waitUntil: 'networkidle' });
  await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((i) => (i.complete ? null : i.decode().catch(() => null)))]));
  await page.waitForTimeout(900);
  const lobby = await page.evaluate(SNAP), lobbyPng = await page.screenshot({ fullPage: true });
  const hero = await page.evaluate(() => document.getElementById('hero-runway')?.toDataURL() || '');
  await page.click('#start-button');
  await page.waitForFunction(() => window.__rhythm?.state().screen === 'game' && !window.__rhythm.state().loading, null, { timeout: 30000 }).catch(async (e) => { console.error('멈춤', base, errors.slice(0, 6), await page.evaluate(() => ({ s: window.__rhythm?.state().screen, l: window.__rhythm?.state().loading, toast: document.getElementById('toast')?.textContent, tip: document.getElementById('tip')?.textContent }))); throw e; });
  await page.waitForTimeout(600);
  const game = await page.evaluate(SNAP);
  const floor = await page.evaluate(() => window.__rhythm.stage().bg.toDataURL());   // 움직이지 않는 펠트 벽 · 바닥 · 레인 · 판정선 한 장
  const dur = await page.evaluate(() => window.__rhythm.state().duration);
  await page.evaluate((t) => window.__rhythm.seek(t), dur - 2);
  await page.waitForFunction(() => window.__rhythm.state().screen === 'results', null, { timeout: 30000 });
  await page.waitForTimeout(800);
  const results = await page.evaluate(SNAP);
  await ctx.close();
  return { lobby, lobbyPng, hero, game, floor, results, errors };
}
const origin = (v) => (v || '').replace(/http:\/\/127\.0\.0\.1:\d+/g, '');
function diff(a, b) {
  const n = Math.max(a.length, b.length), rows = [];
  for (let i = 0; i < n; i += 1) if (origin(a[i]) !== origin(b[i])) rows.push({ i, base: a[i], now: b[i] });
  return rows;
}

(async () => {
  const baseDir = extractBase();
  const [s1, s2] = await Promise.all([serve(baseDir), serve(EXP)]);
  const url = (s) => `http://127.0.0.1:${s.address().port}/`;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const report = { ref: REF, views: [] };
  let bad = 0;
  for (const view of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const a = await capture(browser, url(s1), view), b = await capture(browser, url(s2), view);
    const row = {
      view: `${view.width}x${view.height}`, host: [a.lobby.host, b.lobby.host],
      lobbyStyle: diff(a.lobby.styles, b.lobby.styles).length, lobbyDom: origin(a.lobby.body) === origin(b.lobby.body) ? 0 : 1,
      lobbyPng: Buffer.compare(a.lobbyPng, b.lobbyPng) === 0 ? 0 : 1, heroCanvas: a.hero === b.hero ? 0 : 1,
      gameStyle: diff(a.game.styles, b.game.styles).length, gameDom: origin(a.game.body) === origin(b.game.body) ? 0 : 1, floorCanvas: a.floor === b.floor ? 0 : 1,
      resultsStyle: diff(a.results.styles, b.results.styles).length, resultsDom: origin(a.results.body) === origin(b.results.body) ? 0 : 1,
      resultsDomAt: (() => { const x = origin(a.results.body), y = origin(b.results.body); let i = 0; while (i < x.length && x[i] === y[i]) i += 1; return i < Math.max(x.length, y.length) ? { base: x.slice(Math.max(0, i - 80), i + 120), now: y.slice(Math.max(0, i - 80), i + 120) } : null; })(),
      errors: [...a.errors, ...b.errors], sample: [...diff(a.lobby.styles, b.lobby.styles), ...diff(a.game.styles, b.game.styles), ...diff(a.results.styles, b.results.styles)].slice(0, 3),
    };
    bad += row.lobbyStyle + row.lobbyDom + row.lobbyPng + row.heroCanvas + row.gameStyle + row.gameDom + row.floorCanvas + row.resultsStyle + row.resultsDom + row.errors.length + (b.lobby.host ? 1 : 0);
    report.views.push(row);
  }
  await browser.close(); s1.close(); s2.close();
  report.ok = bad === 0;
  fs.writeFileSync(path.join(__dirname, 'lab-proof.json'), JSON.stringify(report, null, 1) + '\n');
  console.log(JSON.stringify(report, null, 1));
  process.exitCode = bad ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
