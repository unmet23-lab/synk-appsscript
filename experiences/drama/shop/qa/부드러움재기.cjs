'use strict';
// 옷 가게 시안 — 움직임마다 끊김을 크롬 추적으로 잰다(2026-11-05). 주문 폭주 `부드러움재기.cjs`(11-03)의 셈 그대로:
//   버림 = PipelineReporter STATE_DROPPED · affects_smoothness인 장, 합성 실패 = 합성기로 못 간 애니메이션, 가장 긴 GPU 장.
// 휴대폰 390×844 · 배율 3 · GPU. 판: a(흰 봉) · b(색 따라오는 처진 봉).
//   node experiences/drama/shop/qa/부드러움재기.cjs [a|b] [--횟수 2] [--CPU 4]
const path = require('node:path'), fs = require('node:fs'), os = require('node:os'), http = require('node:http');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE || os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const ROOT = path.resolve(__dirname, '../../../..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? Number(argv[i + 1]) : d; };
const LOOK = argv.find((a) => a === 'a' || a === 'b') || 'a';
const RUNS = opt('--횟수', 2), CPU = opt('--CPU', 1);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
const ALLOW = ['/experiences/drama/shop/', '/experiences/play-common/', '/experiences/brand-opening/assets/', '/.tmp/me2-20261102/옷상점/입혀보기/'];
const CATS = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'blink', 'gpu', 'toplevel', 'cc', 'viz'];
const ARGS = ['--autoplay-policy=no-user-gesture-required', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : [])];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const file = path.join(ROOT, u);
      if (!ALLOW.some((a) => u.startsWith(a)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(fs.readFileSync(file));
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}
function analyze(buf) {
  const j = JSON.parse(buf.toString()), ev = j.traceEvents || j;
  const t0 = ev.reduce((m, e) => (e.ts && e.ts < m ? e.ts : m), Infinity), at = (ts) => Math.round((ts - t0) / 1000);
  const names = new Map();
  for (const e of ev) if (e.ph === 'M' && e.name === 'thread_name') names.set(`${e.pid}:${e.tid}`, e.args.name);
  const gpu = (e) => /GpuMain/.test(names.get(`${e.pid}:${e.tid}`) || '');
  const frames = ev.filter((e) => e.name === 'PipelineReporter' && (e.ph === 'b' || e.ph === 'X') && e.args?.frame_reporter);
  const dropped = frames.filter((e) => e.args.frame_reporter.state === 'STATE_DROPPED' && e.args.frame_reporter.affects_smoothness).map((e) => at(e.ts));
  const shown = frames.filter((e) => e.args.frame_reporter.state === 'STATE_PRESENTED_ALL' || e.args.frame_reporter.state === 'STATE_PRESENTED_PARTIAL').length;
  const open = new Map(), failed = [];
  for (const e of ev.filter((x) => x.name === 'Animation').sort((a, b) => a.ts - b.ts)) {
    const id = e.id2?.local || e.id, d = e.args?.data || {};
    if (e.ph === 'b') open.set(id, `${d.displayName || 'waapi'}@${d.nodeName}`);
    if (e.ph === 'n' && d.compositeFailed) failed.push(`${open.get(id)}(${d.compositeFailed})`);
  }
  const gpuLong = ev.filter((e) => e.ph === 'X' && gpu(e) && /FinishPaintCurrentFrame|DoEndRasterCHROMIUM$/.test(e.name)).reduce((m, e) => Math.max(m, e.dur / 1000), 0);
  return { 낸장: shown, 버림: dropped.length, 버림비율: +(dropped.length / Math.max(1, shown + dropped.length)).toFixed(3), 합성실패: [...new Set(failed)], 가장긴GPUms: Math.round(gpuLong) };
}
(async () => {
  const srv = await serve();
  const url = `http://127.0.0.1:${srv.address().port}/experiences/drama/shop/index.html?판=${LOOK}&sound=off`;
  const rows = [];
  for (let n = 1; n <= RUNS; n += 1) {
    const browser = await chromium.launch({ args: ARGS });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
    const page = await ctx.newPage();
    if (CPU > 1) await (await ctx.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: CPU });
    const trace = async (kind, fn) => {
      await browser.startTracing(page, { categories: CATS });
      await fn();
      const r = analyze(await browser.stopTracing());
      rows.push({ 움직임: kind, 회: n, ...r });
      console.log(`${kind} ${n}: 낸 장 ${r.낸장} · 버림 ${r.버림}(${(r.버림비율 * 100).toFixed(1)}%) · 합성 실패 ${r.합성실패.join(' ') || '없음'} · 가장 긴 GPU ${r.가장긴GPUms}ms`);
    };
    await trace('입구', async () => { await page.goto(url, { waitUntil: 'domcontentloaded' }); for (let i = 0; i < 80; i += 1) { if (await page.evaluate(() => document.querySelector('.shop')?.dataset.ready === 'yes')) break; await sleep(100); } await sleep(2200); });
    const y = await page.evaluate(() => { const b = document.querySelector('.shop-rail').getBoundingClientRect(); return b.top + b.height / 2; });
    await trace('끌기', async () => {
      for (const [a, b] of [[320, 80], [300, 60], [70, 330]]) { await page.mouse.move(a, y); await page.mouse.down(); for (let i = 1; i <= 20; i += 1) { await page.mouse.move(a + (b - a) * i / 20, y); await sleep(16); } await page.mouse.up(); await sleep(1100); }
    });
    await trace('열기', async () => { await page.click('.shop-more'); await sleep(1400); });
    await trace('돌리기', async () => { await page.click('.shop-side button[data-side=back]'); await sleep(1300); await page.click('.shop-side button[data-side=front]'); await sleep(1300); });
    await trace('상자', async () => { await page.click('.shop-go[data-act=order]'); await sleep(3600); });
    await trace('입은나', async () => { await page.evaluate(() => window.__shop.go(1)); await sleep(1200); await page.click('.shop-more'); await sleep(900); await page.click('.shop-side button[data-side=worn]'); await sleep(1500); await page.click('.shop-close'); await sleep(1200); });
    await ctx.close(); await browser.close();
  }
  srv.close();
  const out = path.join(ROOT, '.tmp', 'me2-20261102', '옷상점', `부드러움_${LOOK}.json`);
  fs.writeFileSync(out, JSON.stringify({ 잰때: new Date().toISOString(), 판: LOOK, CPU, rows }, null, 1));
  console.log(out);
})().catch((e) => { console.error(e); process.exit(1); });
