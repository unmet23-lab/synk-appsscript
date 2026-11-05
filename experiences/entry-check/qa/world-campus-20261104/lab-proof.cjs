'use strict';
// 입장 검사 캠퍼스 판(2026-11-04, 주문 폭주 lab-proof를 옮김) — LAB 단독 화면이 그대로인지 잰다: 기준(git HEAD 또는 BASE_REF의 entry-check)과 지금 작업본을
// 같은 헤드리스 크롬에서 차례로 열어 입구 · 근무(첫 손님 · 도장 · 판정 판)의 계산 스타일(모든 요소) · 본문 DOM · 입구 화면 픽셀을 견준다.
// WORLD 겉(world-host.js · world-skin.css · world-content.mjs · world-play.mjs · app.mjs의 WORLD 분기 · audio.mjs의 WORLD 손잡이)은 data-host=world일 때만 걸리므로 차이는 0이어야 한다.
// 머리(head)의 새 줄 둘(world-host.js · world-skin.css)은 일부러 더한 것이라 DOM 견줌에서 뺀다.
//   node experiences/entry-check/qa/world-campus-20261104/lab-proof.cjs   (BASE_REF=<커밋> 으로 기준을 바꾼다)
const path = require('node:path'), fs = require('node:fs'), os = require('node:os'), http = require('node:http');
const { execFileSync } = require('node:child_process');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const ROOT = path.resolve(__dirname, '../../../..');
const { 화면시험, 닫기 } = require('../../../../tools/lib/화면시험.cjs');   // 전체 시간 한도 · 어떻게 끝나든 브라우저까지 끝낸다(tests/화면시험관문.test.js)
const GAME = path.join(ROOT, 'experiences/entry-check');
const REF = process.env.BASE_REF || 'HEAD';

function extractBase() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'entry-base-'));
  const tar = path.join(dir, 'base.tar');
  execFileSync('git', ['-C', ROOT, 'archive', '--format=tar', '-o', tar, REF, 'experiences/entry-check'], { stdio: 'inherit' });
  execFileSync('tar', ['-xf', 'base.tar'], { cwd: dir, stdio: 'inherit' });   // 경로를 넘기면 GNU tar가 「C:」를 원격 주소로 읽는다
  return path.join(dir, 'experiences/entry-check');
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
  await page.click('#rec-start');
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await page.waitForTimeout(900);
  const brief = await page.evaluate(SNAP), briefPng = await page.screenshot();
  await page.click('#btn-begin');
  await page.waitForTimeout(1500);
  await page.click('#coach-skip');
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));   // app.mjs가 120ms 뒤 fitCushions를 다시 부른다
  await page.waitForTimeout(800);
  const game = await page.evaluate(SNAP), gamePng = await page.screenshot({ fullPage: true });
  await page.evaluate(() => document.querySelector('#btn-pass').click());
  await page.waitForTimeout(1500);
  const verdict = await page.evaluate(SNAP), verdictPng = await page.screenshot();
  await page.evaluate(() => document.querySelector('#pause').click());
  await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('#quit').click());
  await page.waitForTimeout(500);
  const back = await page.evaluate(SNAP);
  await ctx.close();
  return { lobby, lobbyPng, brief, briefPng, game, gamePng, verdict, verdictPng, back, errors };
}
const origin = (v) => (v || '').replace(/http:\/\/127\.0\.0\.1:\d+/g, '');   // 두 서버의 포트만 다르다
function diff(a, b) {
  const n = Math.max(a.length, b.length), rows = [];
  for (let i = 0; i < n; i += 1) if (origin(a[i]) !== origin(b[i])) rows.push({ i, base: a[i], now: b[i] });
  return rows;
}

화면시험({ 분: 20 }, async () => {
  const baseDir = extractBase();
  // LAB_PROOF_BASELINE=1: 양쪽 다 기준 사본 — 같은 코드끼리도 나는 타이밍 차이(바탕 잡음)를 잰다
  const [s1, s2] = await Promise.all([serve(baseDir), serve(process.env.LAB_PROOF_BASELINE ? baseDir : GAME)]);
  const url = (s) => `http://127.0.0.1:${s.address().port}/`;
  const browser = await chromium.launch();
  const report = { ref: REF, views: [] };
  try {
  let bad = 0;
  for (const view of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    // 같은 코드끼리도 갈리는 타이밍 차이가 있다(LAB_PROOF_BASELINE=1로 잰 11-04: 1440의 도장 판 글자 25px ↔ 15px가 fitText와 글꼴 풀림의 경주로 뒤집힌다).
    // 그래서 한 판이라도 차이 0이면 코드 차이가 없다는 증거로 보고, 네 번까지 다시 잰다. 코드가 다르면 네 번 모두 차이가 남는다.
    let row = null, rowBad = Infinity;
    for (let attempt = 1; attempt <= 4 && rowBad > 0; attempt += 1) {
    const a = await capture(browser, url(s1), view), b = await capture(browser, url(s2), view);
    // PNG 바이트가 아니라 픽셀을 센다(PNG는 같은 그림도 바이트가 다를 수 있다)
    const bytes = (x, y) => {
      if (Buffer.compare(x, y) === 0) return 0;
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'entry-px-')), fa = path.join(dir, 'a.png'), fb = path.join(dir, 'b.png');
      fs.writeFileSync(fa, x); fs.writeFileSync(fb, y);
      const py = "import sys;from PIL import Image,ImageChops;a=Image.open(sys.argv[1]).convert('RGB');b=Image.open(sys.argv[2]).convert('RGB');print(-1 if a.size!=b.size else sum(1 for p in ImageChops.difference(a,b).getdata() if p!=(0,0,0)))";
      const out = execFileSync('python', ['-I', '-X', 'utf8', '-c', py, fa, fb], { encoding: 'utf8' }).trim();
      fs.rmSync(dir, { recursive: true, force: true });
      return Number(out);
    };
    const now = {
      view: `${view.width}x${view.height}`, attempt, host: [a.lobby.host, b.lobby.host],
      lobbyStyle: diff(a.lobby.styles, b.lobby.styles).length, lobbyDom: origin(a.lobby.body) === origin(b.lobby.body) ? 0 : 1, lobbyPng: bytes(a.lobbyPng, b.lobbyPng),
      briefStyle: diff(a.brief.styles, b.brief.styles).length, briefPng: bytes(a.briefPng, b.briefPng),
      gameStyle: diff(a.game.styles, b.game.styles).length, gameDom: origin(a.game.body) === origin(b.game.body) ? 0 : 1, gamePng: bytes(a.gamePng, b.gamePng),
      verdictStyle: diff(a.verdict.styles, b.verdict.styles).length, verdictPng: bytes(a.verdictPng, b.verdictPng),
      backStyle: diff(a.back.styles, b.back.styles).length, errors: [...a.errors, ...b.errors],
      sample: diff(a.game.styles, b.game.styles).slice(0, 3),
    };
    const nowBad = now.lobbyStyle + now.lobbyDom + now.lobbyPng + now.briefStyle + now.briefPng + now.gameStyle + now.gameDom + now.gamePng + now.verdictStyle + now.verdictPng + now.backStyle + now.errors.length + (b.lobby.host ? 1 : 0);
    if (nowBad < rowBad) { row = now; rowBad = nowBad; }
    }
    bad += rowBad;
    report.views.push(row);
  }
  } finally { await 닫기(browser); s1.close(); s2.close(); }
  report.ok = bad === 0;
  fs.writeFileSync(path.join(__dirname, 'lab-proof.json'), JSON.stringify(report, null, 1) + '\n');
  console.log(JSON.stringify(report, null, 1));
  process.exitCode = bad ? 1 : 0;
});
