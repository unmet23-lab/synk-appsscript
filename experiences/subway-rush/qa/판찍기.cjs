'use strict';
// 환승 러시 점검(2026-11-04): 녹화 없이 게임 틀에서 ?auto=1로 돌리며 일정 간격으로 화면을 찍고 상태 · 오류를 적는다. 빠른 화면 확인용(소리는 안 담음).
//   node experiences/subway-rush/qa/판찍기.cjs [--씨앗 12345] [--틀림 1,3] [--간격 5] [--이름 점검] [--난도 busy] [폭 높이]   → 공용 작업본 .tmp/subway-rush-20261104/찍기/
const path = require('node:path'), fs = require('node:fs'), http = require('node:http');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../node_modules')] }));
const { 공용작업본 } = require('../../../tools/lib/공용작업본.js');
const argv = process.argv.slice(2);
const opt = (name, d) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : d; };
const SEED = opt('--씨앗', '20261104'), WRONG = opt('--틀림', ''), NAME = opt('--이름', '점검'), GAP = Number(opt('--간격', '5')), LEVEL = opt('--난도', '');
const nums = argv.filter((a, i) => /^\d+$/.test(a) && !['--씨앗', '--간격', '--틀림', '--이름', '--난도'].includes(argv[i - 1])).map(Number);
const [W = 390, H = 844] = nums;
const EXP = path.resolve(__dirname, '../..');
const OUT = path.join(공용작업본(path.resolve(EXP, '..')), '.tmp', 'subway-rush-20261104', '찍기', NAME);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
const SRC = `/subway-rush/index.html?auto=1&qa=1&seed=${SEED}${WRONG ? '&wrong=' + WRONG : ''}${LEVEL ? '&level=' + LEVEL : ''}`;
const FRAME = `<!doctype html><meta charset=utf-8><style>html,body{margin:0;background:#060709;overflow:hidden}iframe{border:0;display:block;width:${W}px;height:${H}px}</style><iframe class="game-frame" src="${SRC}" allow="autoplay"></iframe>`;
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
for (const f of fs.readdirSync(OUT)) fs.rmSync(path.join(OUT, f));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
srv.listen(0, '127.0.0.1', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--headless=new', '--autoplay-policy=no-user-gesture-required', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : [])] });
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  // 프레임 간격을 잰다(게임 틀 안에서). 전환 버린 장 · 끊김을 숫자로 본다 — PC가 바쁘면 함께 늘어난다.
  await context.addInitScript(() => { if (window === window.top) return; const d = []; let last = 0; const tick = (t) => { if (last) d.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick); window.__frames = d; });
  const page = await context.newPage();
  const logs = [];
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) logs.push('console: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) logs.push(r.status() + ' ' + r.url()); });
  await page.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const fr = () => page.frames().find((x) => x.url().includes('subway-rush'));
  const t0 = Date.now(); let n = 0, done = '';
  while (Date.now() - t0 < 300000) {
    await sleep(GAP * 1000);
    const state = await fr()?.evaluate(() => ({
      music: window.__subway?.music?.playing || '', done: document.documentElement.dataset.done || '', err: document.body.dataset.error || '',
      lobby: !document.getElementById('lobby').hidden, board: !document.getElementById('board').hidden, zones: !document.getElementById('zones').hidden, pick: document.getElementById('pick').hasAttribute('data-on'), replies: !document.getElementById('replies').hidden, notice: !document.getElementById('notice').hidden, result: !document.getElementById('result').hidden,
    })).catch((e) => ({ err: String(e) }));
    n += 1;
    await page.screenshot({ path: path.join(OUT, `${String(n).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 72 }).catch(() => {});
    console.log(n, ((Date.now() - t0) / 1000).toFixed(0) + 's', Object.entries(state || {}).filter(([, v]) => v).map(([k, v]) => v === true ? k : `${k}=${v}`).join(' '));
    done = state?.done || state?.err || '';
    if (done) break;
  }
  await sleep(2500);
  n += 1; await page.screenshot({ path: path.join(OUT, `${String(n).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 72 }).catch(() => {});
  await fr()?.evaluate(() => { const r = document.getElementById('result'); if (r) r.scrollTop = r.scrollHeight; }).catch(() => {});
  await sleep(600);
  n += 1; await page.screenshot({ path: path.join(OUT, `${String(n).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 72 }).catch(() => {});
  const frames = await fr()?.evaluate(() => { const d = [...(window.__frames || [])].sort((a, b) => a - b), at = (k) => Math.round(d[Math.floor((d.length - 1) * k)] || 0); return { 장: d.length, 중앙ms: at(0.5), p95ms: at(0.95), 최악ms: at(1), 버림50ms: d.filter((x) => x > 50).length }; }).catch(() => null);
  const overflow = await fr()?.evaluate(() => { const r = document.getElementById('result'); return { 가로넘침: document.documentElement.scrollWidth > innerWidth + 1, 결과가로넘침: r ? r.scrollWidth > r.clientWidth + 1 : false }; }).catch(() => null);
  console.log(JSON.stringify({ done, 초: (Date.now() - t0) / 1000, 장: n, errors: logs, frames, overflow }, null, 0));
  await browser.close(); srv.close();
});
