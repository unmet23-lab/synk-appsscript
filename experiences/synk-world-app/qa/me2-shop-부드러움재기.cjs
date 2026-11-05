'use strict';
// 앱 옷 가게(me2-shop.mjs) — 움직임마다 끊김을 크롬 추적으로 잰다(2026-11-05). 시안 experiences/drama/shop/qa/부드러움재기.cjs와 같은 셈:
//   버림 = PipelineReporter STATE_DROPPED · affects_smoothness인 장, 합성 실패 = 합성기로 못 간 애니메이션, 가장 긴 GPU 장.
// 앱 껍데기 없이 가게 모듈만 모의 상태로 띄운다(서버 · 계정 없음, 주문 답 0.3초). 휴대폰 390×844 · 배율 3 · GPU.
//   node experiences/synk-world-app/qa/me2-shop-부드러움재기.cjs [--횟수 2] [--CPU 4]
const path = require('node:path'), fs = require('node:fs'), os = require('node:os'), http = require('node:http');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE || os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../node_modules')] }));
const ROOT = path.resolve(__dirname, '../../..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? Number(argv[i + 1]) : d; };
const RUNS = opt('--횟수', 2), CPU = opt('--CPU', 1);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const ALLOW = ['/experiences/synk-world-app/', '/experiences/play-common/', '/experiences/brand-opening/'];
const CATS = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'blink', 'gpu', 'toplevel', 'cc', 'viz'];
const ARGS = ['--autoplay-policy=no-user-gesture-required', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : [])];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 가게 모듈과 같은 폴더 깊이에서 부르도록 주소만 그 자리에 둔다 — 파일은 만들지 않는다.
const PAGE = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>옷 가게 재기</title><body style="margin:0;background:#111">
<script type="module">
import {createMe2Shop} from '/experiences/synk-world-app/me2-shop.mjs';
const ids=['outfit-trench','outfit-cardigan','outfit-varsity','outfit-bomber','outfit-rugby','outfit-leather','outfit-denim','outfit-vest'];
const view={status:'ok',consent:{given:true},me:{state:'ready',equipped_look:null},looks:[],menu:{looks:ids.map(id=>({id,group:'outfit'}))}};
const shop=createMe2Shop({lang:()=>'ko',soundOn:()=>false,actions:{
 order:async id=>{await new Promise(r=>setTimeout(r,300));view.looks=[{job_id:'00000000-0000-4000-8000-000000000001',item:id,state:'shipping',new:false,url:null,ordered_at:new Date().toISOString(),sent_at:null,arrived_at:null,arrives_by:new Date(Date.now()+25*3600000).toISOString(),arrives_after:null},...view.looks];shop.update(view);return {status:'ordered'};},
 status:async()=>view,seen:async()=>{},wear:async()=>{},unwear:async()=>{},redo:async()=>({status:'ordered'})}});
window.__m2s={shop,view,open:()=>shop.open(view,{fresh:[]})};
</script></body></html>`;
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (u === '/재기.html') { res.writeHead(200, { 'content-type': TYPES['.html'], 'cache-control': 'no-store' }); res.end(PAGE); return; }
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
  const names = new Map();
  for (const e of ev) if (e.ph === 'M' && e.name === 'thread_name') names.set(`${e.pid}:${e.tid}`, e.args.name);
  const gpu = (e) => /GpuMain/.test(names.get(`${e.pid}:${e.tid}`) || '');
  const frames = ev.filter((e) => e.name === 'PipelineReporter' && (e.ph === 'b' || e.ph === 'X') && e.args?.frame_reporter);
  const dropped = frames.filter((e) => e.args.frame_reporter.state === 'STATE_DROPPED' && e.args.frame_reporter.affects_smoothness).length;
  const shown = frames.filter((e) => e.args.frame_reporter.state === 'STATE_PRESENTED_ALL' || e.args.frame_reporter.state === 'STATE_PRESENTED_PARTIAL').length;
  const open = new Map(), failed = [];
  for (const e of ev.filter((x) => x.name === 'Animation').sort((a, b) => a.ts - b.ts)) {
    const id = e.id2?.local || e.id, d = e.args?.data || {};
    if (e.ph === 'b') open.set(id, `${d.displayName || 'waapi'}@${d.nodeName}`);
    if (e.ph === 'n' && d.compositeFailed) failed.push(`${open.get(id)}(${d.compositeFailed})`);
  }
  const gpuLong = ev.filter((e) => e.ph === 'X' && gpu(e) && /FinishPaintCurrentFrame|DoEndRasterCHROMIUM$/.test(e.name)).reduce((m, e) => Math.max(m, e.dur / 1000), 0);
  return { 낸장: shown, 버림: dropped, 버림비율: +(dropped / Math.max(1, shown + dropped)).toFixed(3), 합성실패: [...new Set(failed)], 가장긴GPUms: Math.round(gpuLong) };
}
(async () => {
  const srv = await serve();
  const url = `http://127.0.0.1:${srv.address().port}/재기.html`;
  const rows = [];
  for (let n = 1; n <= RUNS; n += 1) {
    const browser = await chromium.launch({ args: ARGS });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message || e)));
    if (CPU > 1) await (await ctx.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: CPU });
    const trace = async (kind, fn) => {
      await browser.startTracing(page, { categories: CATS });
      await fn();
      const r = analyze(await browser.stopTracing());
      rows.push({ 움직임: kind, 회: n, ...r });
      console.log(`${kind} ${n}: 낸 장 ${r.낸장} · 버림 ${r.버림}(${(r.버림비율 * 100).toFixed(1)}%) · 합성 실패 ${r.합성실패.join(' ') || '없음'} · 가장 긴 GPU ${r.가장긴GPUms}ms`);
    };
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__m2s);
    await trace('입구', async () => { await page.evaluate(() => window.__m2s.open()); await page.waitForSelector('.m2s[data-ready=yes]'); await sleep(1500); });
    const y = await page.evaluate(() => { const b = document.querySelector('.m2s-rail').getBoundingClientRect(); return b.top + b.height / 2; });
    await trace('끌기', async () => {
      for (const [a, b] of [[320, 80], [300, 60], [70, 330]]) { await page.mouse.move(a, y); await page.mouse.down(); for (let i = 1; i <= 20; i += 1) { await page.mouse.move(a + (b - a) * i / 20, y); await sleep(16); } await page.mouse.up(); await sleep(700); }
    });
    await trace('열기', async () => { await page.click('.m2s-more'); await sleep(1400); });
    await trace('돌리기', async () => { await page.click('.m2s-side button[data-side=back]'); await sleep(1300); await page.click('.m2s-side button[data-side=front]'); await sleep(1300); });
    await trace('포장(처음 여섯 단계)', async () => { await page.click('.m2s-go[data-act=order]'); await sleep(5600); });
    await trace('닫고 다시 열기', async () => { await page.click('.m2s-more'); await sleep(1100); await page.click('.m2s-close'); await sleep(900); });
    if (errors.length) console.log('페이지 오류', errors);
    await ctx.close(); await browser.close();
  }
  srv.close();
  const sum = {};
  for (const r of rows) { (sum[r.움직임] ||= []).push(r.버림비율); }
  console.log(Object.entries(sum).map(([k, v]) => `${k} ${v.map((x) => (x * 100).toFixed(1)).join(' · ')}%`).join('\n'));
})().catch((e) => { console.error(e); process.exit(1); });
