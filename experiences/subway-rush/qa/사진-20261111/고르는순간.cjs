'use strict';
// 환승 러시 고르는 순간 찍기(11-11 사진 다시 굽기 · 고르는 판 맹검용): ?auto=1&qa=1로 돌리며 고르는 판이 올라온 0.85초 뒤(판 · 글이 다 선 뒤) 한 장씩 찍는다.
//   node 고르는순간.cjs <씨앗> <이름> [폭 높이]   → 같은 폴더 찍기/<이름>/NN-<종류>-<사진>.png (휴대폰 390×844 @2x)
const path = require('node:path'), fs = require('node:fs'), http = require('node:http');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const ROOT = path.resolve(__dirname, '../../../..');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.join(ROOT, 'node_modules')] }));
const [SEED = '261', NAME = '시험', W = '390', H = '844'] = process.argv.slice(2);
const EXP = path.resolve(process.env.EXP_DIR || path.join(ROOT, 'experiences'));   // 시험 사본: EXP_DIR=<.tmp/…/시험판/experiences>
const OUT = path.join(require('../../../../tools/lib/공용작업본.js').공용작업본(ROOT), '.tmp', 'subway-rush-20261111', '찍기', NAME);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
// SUBWAY_VIDEO=1: 판 전체를 녹화하고 고르는 순간 시각을 적는다(11-11 고르는 판 시안 영상)
const SRC = `/subway-rush/index.html?auto=1&qa=1&seed=${SEED}${process.env.SUBWAY_LEVEL ? `&level=${process.env.SUBWAY_LEVEL}` : ""}`;   // SUBWAY_LEVEL=busy: 바쁜 아침(승강장 · 출구 공사)
const FRAME = `<!doctype html><meta charset=utf-8><style>html,body{margin:0;background:#060709;overflow:hidden}iframe{border:0;display:block;width:${W}px;height:${H}px}</style><iframe src="${SRC}" allow="autoplay"></iframe>`;
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (u === '/') { res.writeHead(200, { 'content-type': TYPES['.html'] }); res.end(FRAME); return; }
  let file = path.join(EXP, u);
  if (!file.startsWith(EXP) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(fs.readFileSync(file));
});
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
srv.listen(0, '127.0.0.1', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--headless=new', '--autoplay-policy=no-user-gesture-required', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
  const context = await browser.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 2, ...(process.env.SUBWAY_VIDEO ? { recordVideo: { dir: OUT, size: { width: +W * 2, height: +H * 2 } } } : {}) });
  const page = await context.newPage();
  const logs = [];
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) logs.push(r.status() + ' ' + r.url()); });
  await page.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const fr = () => page.frames().find((x) => x.url().includes('subway-rush'));
  const t0 = Date.now(); let n = 0, wasOn = false;
  while (Date.now() - t0 < 300000) {
    await sleep(120);
    const s = await fr()?.evaluate(() => {
      const p = document.getElementById('pick'), on = !!p && p.hasAttribute('data-on') && !p.hasAttribute('data-picked');
      return { on, kind: on ? p.dataset.kind : '', done: document.documentElement.dataset.done || '', err: document.body.dataset.error || '' };
    }).catch(() => null);
    if (!s) continue;
    if (s.on && !wasOn) {
      await sleep(850);
      const img = await fr().evaluate(() => { const st = window.__subway?.scene?.state; const t = st?.img; return (t && (t.name || t.src || t.id)) || ''; }).catch(() => '');
      n += 1;
      const f = path.join(OUT, `${String(n).padStart(2, '0')}-${s.kind}.png`);
      await page.screenshot({ path: f });
      console.log(n, s.kind, String(img).slice(-60), ((Date.now() - t0) / 1000).toFixed(1) + 's');
      // SUBWAY_SEQ=1이면 고른 뒤(자동 고름 1.1초) 문 열림 · 지나감을 몇 장 더 — 문 칸 · 다가갈 점이 사진의 문과 맞는지 본다
      if (process.env.SUBWAY_SEQ && s.kind === 'door') for (const [k, at] of [[1, 700], [2, 500], [3, 450], [4, 450], [5, 500]]) { await sleep(at); await page.screenshot({ path: f.replace('.png', `-${k}.png`) }); }
    }
    wasOn = !!s.on;
    if (s.done || s.err) break;
  }
  console.log(JSON.stringify({ 장: n, errors: logs }));
  await browser.close(); srv.close();
});
