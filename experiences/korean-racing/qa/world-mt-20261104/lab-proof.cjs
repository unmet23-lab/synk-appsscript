'use strict';
// MT 자전거 레이스(WORLD 판) — LAB 단독 화면이 그대로인지 잰다(설계 10절, 주문 폭주 lab-proof.cjs 틀): 기준(BASE_REF, 기본 origin/master 전 판)과 지금 작업본을
// 같은 브라우저에서 차례로 열어 ① 입구 픽셀 · 계산 스타일 · 본문 DOM ② 자동 시연을 정해진 걸음만큼 돌린 상태(자리 · 속도 · 순위 · 판정) · 카메라 자세 · 그리기 수를 견준다.
// WORLD 겉(world-host.js · world-skin.css · ride/ · lane-core.js의 RIDE_TRACK · app.js의 rig 갈림)은 data-host=world일 때만 걸리므로 차이는 0이어야 한다.
// 머리(head)의 새 줄 둘(world-host.js · world-skin.css)은 일부러 더한 것이라 DOM 견줌에서 뺀다. 첫 그림 시간은 이 증명 밖이다.
//   BASE_REF=<커밋> node experiences/korean-racing/qa/world-mt-20261104/lab-proof.cjs
const path = require('node:path'), fs = require('node:fs'), os = require('node:os'), http = require('node:http');
const { execFileSync } = require('node:child_process');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const ROOT = path.resolve(__dirname, '../../../..'), GAME = path.join(ROOT, 'experiences/korean-racing');
const REF = process.env.BASE_REF || 'HEAD';

function extractBase() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'racing-base-')), tar = path.join(dir, 'base.tar');
  execFileSync('git', ['-C', ROOT, 'archive', '--format=tar', '-o', tar, REF, 'experiences/korean-racing'], { stdio: 'inherit' });
  execFileSync('tar', ['-xf', 'base.tar'], { cwd: dir, stdio: 'inherit' });   // 경로를 넘기면 GNU tar가 「C:」를 원격 주소로 읽는다
  const base = path.join(dir, 'experiences/korean-racing');
  for (const glb of ['car.glb', 'coastal-rocks-v6.glb']) fs.copyFileSync(path.join(GAME, 'assets', glb), path.join(base, 'assets', glb));   // git 무시 파일
  return base;
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.hdr': 'application/octet-stream' };
const serve = (dir) => new Promise((resolve) => { const server = http.createServer((req, res) => { try { let p = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname)); if (!p.startsWith(dir)) throw 0; if (fs.statSync(p).isDirectory()) p = path.join(p, 'index.html'); res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(p)); } catch { res.writeHead(404).end(); } }).listen(0, '127.0.0.1', () => resolve(server)); });
const SNAP = () => {
  const props = ['display', 'position', 'width', 'height', 'top', 'left', 'margin', 'padding', 'color', 'background-color', 'background-image', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'border-radius', 'box-shadow', 'opacity', 'transform', 'filter', 'visibility', 'grid-template-columns', 'gap'];
  const out = [];
  for (const el of document.body.querySelectorAll('*')) { if (el.closest('[hidden]') && el.tagName !== 'DIALOG') continue; const cs = getComputedStyle(el); out.push(el.tagName + (el.id ? '#' + el.id : '') + '|' + props.map((p) => cs.getPropertyValue(p)).join('|')); }
  return { styles: out, body: document.body.innerHTML, host: document.documentElement.dataset.host || null };
};
async function capture(browser, base, view) {
  const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => { let n = 0; Date.now = () => 1762156800000; Math.random = () => { n = (n * 9301 + 49297) % 233280; return n / 233280; };
    // 실시간 프레임을 멈출 수 있게: __hold가 켜지면 다음 그림 차례를 받아 두기만 한다(자리는 빨리 감기로만 움직인다).
    const raf = window.requestAnimationFrame.bind(window); window.__hold = false; window.requestAnimationFrame = (fn) => raf(function tick(t) { if (window.__hold) raf(tick); else fn(t); });
    try { localStorage.setItem('SYNK_RACING_TUTORIAL_V1', JSON.stringify({ version: 1, completed: true })); } catch { /* 없는 환경 */ } });
  await page.goto(base + 'index.html?qa', { waitUntil: 'domcontentloaded', timeout: 120000 });
  for (let i = 0; i < 800; i++) { if (await page.evaluate(() => window.__racingQA?.state().ready).catch(() => false)) break; await page.waitForTimeout(250); }
  await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((i) => (i.complete ? null : i.decode().catch(() => null)))]));
  await page.waitForTimeout(800);
  const lobby = await page.evaluate(SNAP), lobbyPng = await page.screenshot({ fullPage: true });
  await page.evaluate(() => { window.__hold = true; document.getElementById('watch').click(); });
  for (let i = 0; i < 400; i++) { if (await page.evaluate(() => window.__racingQA.state().running)) break; await page.waitForTimeout(100); }
  // 한 걸음씩: 실시간 프레임이 끼면 두 판이 갈라지므로 멈춘 뒤 빨리 감기로만 움직인다.
  const run = await page.evaluate(() => {
    const q = window.__racingQA, r = q.round, cam = () => q.camera ? q.camera : null, rows = [];
    const row = () => { const s = q.state(), snap = window.__racing.snapshot(); return { speed: document.getElementById('speed').textContent, rank: document.getElementById('rank').textContent, playerS: +snap.playerS.toFixed(4), offset: +s.offset.toFixed(4), velocity: +s.velocity.toFixed(4), boost: +s.boost.toFixed(4), gateIndex: s.gateIndex, answers: s.answers.map((a) => [a.correct, a.chosen]), rivals: snap.driving.rivals.map((x) => [+x.s.toFixed(3), +x.offset.toFixed(3)]), programs: snap.render.programs, label: document.getElementById('nitro-label').textContent }; };
    for (let t = 0; t < 8; t++) { for (let i = 0; i < 60 && q.state().gate && !q.state().gate.announced; i++) q.advance(.25); q.hearNow(); q.advance(2); rows.push(row()); }
    return rows;
  });
  const after = await page.evaluate(() => { const s = window.__racing.snapshot(); return { render: { programs: s.render.programs, geometries: s.render.geometries, textures: s.render.textures } }; });
  await ctx.close();
  return { lobby, lobbyPng, run, after, errors };
}
const origin = (v) => (v || '').replace(/http:\/\/127\.0\.0\.1:\d+/g, '');
const diff = (a, b) => { const n = Math.max(a.length, b.length), rows = []; for (let i = 0; i < n; i += 1) if (origin(a[i]) !== origin(b[i])) rows.push({ i, base: a[i], now: b[i] }); return rows; };
(async () => {
  const base = extractBase();
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--headless=new', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
  const a = await serve(base), b = await serve(process.env.SELF ? base : GAME), results = [];
  // 입구 그림이 다르면 어디가 몇 칸 다른지(브라우저 안 캔버스로 잰다).
  const pixelDiff = async (pngA, pngB) => { const p = await browser.newPage(); const r = await p.evaluate(async ([x, y]) => { const load = async (b64) => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height); }; const A = await load(x), B = await load(y); if (A.width !== B.width || A.height !== B.height) return { size: [A.width, A.height, B.width, B.height] }; let count = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, max = 0; for (let i = 0; i < A.data.length; i += 4) { const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2])); if (d) { count++; max = Math.max(max, d); const px = (i / 4) % A.width, py = Math.floor(i / 4 / A.width); x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); } } return { count, max, box: [x0, y0, x1, y1] }; }, [pngA.toString('base64'), pngB.toString('base64')]); await p.close(); return r; };
  for (const view of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const A = await capture(browser, `http://127.0.0.1:${a.address().port}/`, view), B = await capture(browser, `http://127.0.0.1:${b.address().port}/`, view);
    const pixels = Buffer.compare(A.lobbyPng, B.lobbyPng) === 0, styles = diff(A.lobby.styles, B.lobby.styles), dom = origin(A.lobby.body) === origin(B.lobby.body), run = JSON.stringify(A.run) === JSON.stringify(B.run), after = JSON.stringify(A.after) === JSON.stringify(B.after);
    results.push({ view: `${view.width}x${view.height}`, 입구픽셀같음: pixels, 픽셀차이: pixels ? undefined : await pixelDiff(A.lobbyPng, B.lobbyPng), 스타일차이: styles.length, 첫차이: styles[0] || null, DOM같음: dom, 한판같음: run, 그리기같음: after, hostBase: A.lobby.host, hostNow: B.lobby.host, errors: [...A.errors, ...B.errors], 한판: run ? undefined : { base: A.run, now: B.run } });
  }
  await browser.close(); a.close(); b.close(); fs.rmSync(path.dirname(path.dirname(base)), { recursive: true, force: true });
  const ok = results.every((r) => r.입구픽셀같음 && !r.스타일차이 && r.DOM같음 && r.한판같음 && r.그리기같음 && !r.hostNow && !r.errors.length);
  fs.writeFileSync(path.join(__dirname, 'lab-proof.json'), JSON.stringify({ ref: REF, ok, results }, null, 1));
  console.log(JSON.stringify({ ok, results: results.map(({ 한판, ...r }) => r) }, null, 1));
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
