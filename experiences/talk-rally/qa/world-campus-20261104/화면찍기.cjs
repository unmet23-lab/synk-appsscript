'use strict';
// 말 랠리 캠퍼스 판 — 화면 크기마다 입구 · 말 걺 · 기다림 · 해설 · 결과 · 멈춤을 찍고 넘침 · 콘솔 오류 · 실패 요청을 잰다(2026-11-04). 검수 묶음 캡처용.
//   node experiences/talk-rally/qa/world-campus-20261104/화면찍기.cjs [폭x높이 …]   (기본 390x844 360x640 768x1024 1280x720 1440x900)
// 나가는 것: 공용 작업본 .tmp/talk-rally-world-20261104/화면/<폭>_<장면>.png, 화면.json. 시험 틀은 WORLD 앱과 같은 같은 출처 iframe.game-frame이다.
const path = require('node:path'), fs = require('node:fs'), http = require('node:http');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const EXP = path.resolve(__dirname, '../../..');
const OUT = path.join(공용작업본(path.resolve(__dirname, '../../../..')), '.tmp', 'talk-rally-world-20261104', '화면');
fs.mkdirSync(OUT, { recursive: true });
const SIZES = process.argv.slice(2).filter((a) => /^\d+x\d+$/.test(a)).map((a) => a.split('x').map(Number));
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (u === '/') { res.writeHead(200, { 'content-type': TYPES['.html'] }); res.end('<!doctype html><meta charset=utf-8><style>html,body{margin:0;height:100%;background:#060709}iframe{border:0;display:block;width:100%;height:100%}</style><iframe class="game-frame" src="/talk-rally/index.html?qa=1" allow="autoplay"></iframe>'); return; }
      let file = path.join(EXP, u);
      if (!file.startsWith(EXP) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
      if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(fs.readFileSync(file));
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}
const OVERFLOW = () => {
  const W = document.documentElement.clientWidth, bad = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('[hidden]') || el.closest('#w-scene')) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && (r.right > W + 1 || r.left < -1)) bad.push((el.id ? '#' + el.id : el.className || el.tagName).toString().slice(0, 30));
  }
  return { docOverflow: document.documentElement.scrollWidth - W, bad: bad.slice(0, 6) };
};

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--headless=new', '--autoplay-policy=no-user-gesture-required', '--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
  const srv = await serve(), BASE = `http://127.0.0.1:${srv.address().port}/`, report = {};
  for (const [W, H] of SIZES.length ? SIZES : [[390, 844], [360, 640], [768, 1024], [1280, 720], [1440, 900]]) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: W < 700 ? 2 : 1 });
    const page = await ctx.newPage(), errs = [], fails = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
    page.on('response', (r) => { if (r.status() >= 400) fails.push(r.url().split('/').slice(-3).join('/')); });
    await page.goto(BASE, { waitUntil: 'load' });
    const fr = () => page.frames().find((x) => x.url().includes('/talk-rally/'));
    for (let i = 0; i < 100; i += 1) { if (await fr()?.evaluate(() => !!window.__rally && document.documentElement.classList.contains('w-ready')).catch(() => false)) break; await sleep(100); }
    await sleep(1800);
    const shots = {};
    const shot = async (name) => { await page.screenshot({ path: path.join(OUT, `${W}_${name}.png`) }); shots[name] = await fr().evaluate(OVERFLOW); };
    await shot('입구');
    const cur = () => fr().evaluate(() => window.__rally.state().cur);
    const until = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await sleep(120); } return null; };
    await fr().evaluate(() => { document.querySelector('#narration-toggle').click(); document.querySelector('#btn-start').click(); });
    await until(async () => (await cur())?.phase === 'talk');
    await sleep(500);
    await shot('연습말');
    await until(async () => await fr().evaluate(() => !document.querySelector('#wait').hidden));
    await sleep(400);
    await shot('기다림');
    let c = await cur();
    await fr().evaluate((l) => window.__rally.choose(l), c.options.indexOf(c.answer));
    await until(async () => (await cur())?.id !== 'p00' && (await cur())?.phase === 'talk');
    await sleep(500);
    await shot('말걺');
    c = await cur();
    await fr().evaluate((l) => window.__rally.choose(l), c.options.findIndex((o) => o !== c.answer));
    await until(async () => await fr().evaluate(() => !document.querySelector('#explain').hidden));
    await sleep(500);
    await shot('해설');
    await fr().evaluate(() => document.querySelector('#pause').click());
    await sleep(400);
    await shot('멈춤');
    await fr().evaluate(() => document.querySelector('#resume').click());
    await sleep(200);
    await fr().evaluate(() => window.__rally.finish());
    await sleep(3200);
    await shot('결과');
    report[`${W}x${H}`] = { shots, errors: errs, failedRequests: [...new Set(fails)] };
    await ctx.close();
  }
  await browser.close(); srv.close();
  fs.writeFileSync(path.join(OUT, '화면.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report));
})().catch((e) => { console.error(e); process.exit(1); });
