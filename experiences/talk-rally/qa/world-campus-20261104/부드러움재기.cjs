'use strict';
// 말 랠리 캠퍼스 판 — 화면 바꿈이 부드러운지 잰다(주문 폭주 부드러움재기.cjs를 옮김, 유호님 11-03 「전환될 때 프레임이 끊기는 느낌 — 몰입을 방해」).
// 게임 틀(같은 출처 .game-frame, 390 × 844 · 배율 3 · 실제 GPU · 움직임 영상을 틀 수 있는 Edge)에서 전환 하나를 크롬 추적으로 떠, 눈에 보이는 끊김만 센다:
//   버림 = 합성기 프레임 보고(PipelineReporter)가 STATE_DROPPED이고 affects_smoothness인 장(움직이는 중에 버린 장, 장마다 16.7ms)
//   합성 실패 = 합성기로 못 가고 메인 스레드에서 도는 애니메이션(compositeFailed)
//   셰이더 = GPU가 처음 쓰는 그림 조합의 셰이더를 굽는 시간 · 오디오 문맥 = AudioContext 만들기(윈도우 장치 묻기, 메인 스레드를 잡는다)
// 함정과 읽는 법은 현장 노트 시험 · 화면 「웹 화면 끊김은 rAF 간격이 아니라…」.
//   node experiences/talk-rally/qa/world-campus-20261104/부드러움재기.cjs [입구 시작 서브 받아치기 스매시 틀림 결과 다시 처음으로] [--횟수 3] [--캐시]
const path = require('node:path'), fs = require('node:fs'), os = require('node:os'), http = require('node:http');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE || os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));

const ALL = ['입구', '시작', '서브', '받아치기', '스매시', '틀림', '결과', '다시', '처음으로'];
const argv = process.argv.slice(2);
const opt = (name, d) => { const i = argv.indexOf(name); return i >= 0 ? Number(argv[i + 1]) : d; };
const KINDS = argv.filter((a) => ALL.includes(a));
const RUNS = opt('--횟수', 3), WARM = argv.includes('--캐시');
const EXP = path.resolve(__dirname, '../../..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.json': 'application/json' };
const FRAME = '<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#060709}iframe{border:0;display:block;width:100%;height:100%}</style><iframe class="game-frame" allow="autoplay" src="/talk-rally/index.html?qa=1"></iframe>';
const CATS = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'blink', 'gpu', 'toplevel', 'cc', 'viz', 'webaudio', 'skia', 'disabled-by-default-skia', 'disabled-by-default-skia.shaders', 'benchmark', 'rail', 'cc.debug.scheduler.frames'];
const ARGS = ['--autoplay-policy=no-user-gesture-required', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : [])];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (u === '/') { res.writeHead(200, { 'content-type': TYPES['.html'] }); res.end(FRAME); return; }
      let file = path.join(EXP, u);
      if (!file.startsWith(EXP) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
      if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(fs.readFileSync(file));
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

/** 추적 하나를 「보이는 끊김」 숫자로. */
function analyze(buf) {
  const j = JSON.parse(buf.toString()), ev = j.traceEvents || j;
  const t0 = ev.reduce((m, e) => (e.ts && e.ts < m ? e.ts : m), Infinity), at = (ts) => Math.round((ts - t0) / 1000);
  const names = new Map();
  for (const e of ev) if (e.ph === 'M' && e.name === 'thread_name') names.set(`${e.pid}:${e.tid}`, e.args.name);
  const gpu = (e) => /GpuMain/.test(names.get(`${e.pid}:${e.tid}`) || '');
  const main = (e) => /CrRendererMain/.test(names.get(`${e.pid}:${e.tid}`) || '');
  const dropped = ev.filter((e) => e.name === 'PipelineReporter' && (e.ph === 'b' || e.ph === 'X') && e.args?.frame_reporter?.state === 'STATE_DROPPED' && e.args.frame_reporter.affects_smoothness).map((e) => at(e.ts));
  const open = new Map(), failed = [];
  for (const e of ev.filter((x) => x.name === 'Animation').sort((a, b) => a.ts - b.ts)) {
    const id = e.id2?.local || e.id, d = e.args?.data || {};
    if (e.ph === 'b') open.set(id, `${d.displayName || 'waapi'}@${d.nodeName}`);
    if (e.ph === 'n' && d.compositeFailed) failed.push(`${open.get(id)}(${d.compositeFailed})`);
  }
  const shader = ev.filter((e) => e.ph === 'X' && e.name === 'shader_compile' && gpu(e)).reduce((s, e) => s + e.dur / 1000, 0);
  const gpuLong = ev.filter((e) => e.ph === 'X' && gpu(e) && /FinishPaintCurrentFrame|DoEndRasterCHROMIUM$/.test(e.name)).reduce((m, e) => Math.max(m, e.dur / 1000), 0);
  const audio = ev.filter((e) => e.ph === 'X' && e.name === 'AudioContext::AudioContext').map((e) => Math.round(e.dur / 1000));
  // 메인 스레드를 50ms 넘게 잡은 일: 3D 공 · 표정 판 바꿈이 그 시간만큼 선다
  const long = ev.filter((e) => e.ph === 'X' && e.name === 'RunTask' && main(e) && e.dur >= 50000).map((e) => `${at(e.ts)}+${Math.round(e.dur / 1000)}`);
  // 헤드리스 rAF는 화면 주사율에 묶이지 않아(초당 200번 넘게) 장 수는 부푼다 — 보이는 것은 이어진 버림의 길이다. 13ms 안으로 붙은 버림을 한 덩이로 묶어 33ms 넘는 덩이만 적는다.
  const runs = [];
  for (const ms of dropped) { const last = runs[runs.length - 1]; if (last && ms - last[1] <= 13) last[1] = ms; else runs.push([ms, ms]); }
  const lumps = runs.filter(([s, e]) => e - s >= 33).map(([s, e]) => `${s}+${e - s}`);
  // 화면에 실제로 나간 장 사이의 빈틈(3D가 늘 그리므로 시합 중에는 움직임이 멈춘 시간이다)
  const swaps = ev.filter((e) => e.ph === 'X' && e.name === 'Display::DrawAndSwap').map((e) => e.ts).sort((x, y) => x - y);
  const gaps = [];
  for (let i = 1; i < swaps.length; i += 1) { const d = (swaps[i] - swaps[i - 1]) / 1000; if (d >= 50) gaps.push(`${at(swaps[i - 1])}+${Math.round(d)}`); }
  return { 버림: dropped.length, 덩이: lumps, 빈틈: gaps, 장수: swaps.length, 합성실패: [...new Set(failed)], 셰이더ms: Math.round(shader), 가장긴GPUms: Math.round(gpuLong), 오디오문맥ms: audio, 긴일: long };
}

async function ready(fr) {
  for (let i = 0; i < 200; i += 1) { if (await fr()?.evaluate(() => !!window.__rally && document.documentElement.classList.contains('w-ready')).catch(() => false)) return; await sleep(150); }
}
const fly = async (fr) => {
  for (let i = 0; i < 300; i += 1) {
    const c = await fr().evaluate(() => { const s = window.__rally.state(); if (document.querySelector('#btn-next')?.offsetParent) document.querySelector('#btn-next').click(); return s.cur; });
    if (c && c.choice == null && c.phase === 'flight') return c;
    await sleep(100);
  }
  throw Error('공이 안 뜸');
};
const hit = (fr, c, ok = true) => fr().evaluate((n) => window.__rally.choose(n), ok ? c.options.indexOf(c.answer) : c.options.findIndex((o) => o !== c.answer));

/** 전환 하나를 돌리며 그 구간만 추적한다. */
async function measure(page, kind) {
  const fr = () => page.frames().find((x) => x.url().includes('/talk-rally/'));
  const browser = page.context().browser();
  const trace = async (fn) => {
    await browser.startTracing(page, { categories: CATS });
    await fn();
    return { buf: await browser.stopTracing(), clip: await fr()?.evaluate(() => window.__rally.world()?.clip || null).catch(() => null) };
  };
  if (kind === '입구') return trace(async () => { await page.goto(page.__url, { waitUntil: 'domcontentloaded', timeout: 60000 }); await ready(fr); await sleep(3500); });
  await page.goto(page.__url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await ready(fr);
  await sleep(3500);
  const click = (q) => fr().evaluate((s) => document.querySelector(s).click(), q);
  if (kind === '시작') return trace(async () => { await click('#btn-start'); await sleep(2500); });
  await click('#btn-start');
  let c = await fly(fr);
  if (kind === '서브') {   // 연습 공을 받아치면 다음 말(글 없는 첫 공) → 공 띄워 치기 영상 → 3D 공이 이어받는다
    await hit(fr, c);
    return trace(async () => { await fly(fr); await sleep(1500); });
  }
  await hit(fr, c); c = await fly(fr);
  if (kind === '받아치기') return trace(async () => { await hit(fr, c); await sleep(3000); });
  if (kind === '스매시') { await fr().evaluate(() => window.__rally.setRally(2)); await sleep(100); return trace(async () => { await hit(fr, c); await sleep(3000); }); }
  if (kind === '틀림') return trace(async () => { await hit(fr, c, false); await sleep(2500); await click('#btn-next'); await sleep(1500); });
  await hit(fr, c); await sleep(2500);
  if (kind === '결과') return trace(async () => { await fr().evaluate(() => window.__rally.finish()); await sleep(3500); });
  if (kind === '다시') { await fr().evaluate(() => window.__rally.finish()); await sleep(4500); return trace(async () => { await click('#r-again'); await sleep(2500); }); }
  // 처음으로: 멈춤 창에서 입구로
  await click('#pause'); await sleep(400);
  return trace(async () => { await click('#quit'); await sleep(2500); });
}

(async () => {
  const srv = await serve();
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const rows = [];
  for (const kind of KINDS.length ? KINDS : ALL) {
    for (let n = 1; n <= RUNS; n += 1) {
      const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ARGS });
      const open = async () => {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
        const page = await ctx.newPage();
        page.__url = url;
        return { ctx, page };
      };
      if (WARM) {   // 같은 브라우저에서 한 판을 먼저 — GPU 프로세스에 셰이더가 남는다(두 번째부터의 모습)
        const { ctx, page } = await open();
        const fr = () => page.frames().find((x) => x.url().includes('/talk-rally/'));
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); await ready(fr); await sleep(2500);
        await fr().evaluate(() => document.querySelector('#btn-start').click());
        await hit(fr, await fly(fr)); await hit(fr, await fly(fr)); await sleep(2800);
        await fr().evaluate(() => window.__rally.finish()); await sleep(2500);
        await ctx.close();
      }
      const { ctx, page } = await open();
      const { buf } = await measure(page, kind);
      await ctx.close(); await browser.close();
      const r = analyze(buf);
      rows.push({ 전환: kind, 회: n, ...r });
      console.log(`${kind} ${n}: 버림 ${r.버림}장 · 33ms 넘는 덩이 ${r.덩이.join(' ') || '없음'} · 화면 빈틈 ${r.빈틈.join(' ') || '없음'}(${r.장수}장) · 합성 실패 ${r.합성실패.join(' ') || '없음'} · 셰이더 ${r.셰이더ms}ms · 가장 긴 GPU ${r.가장긴GPUms}ms${r.오디오문맥ms.length ? ` · 오디오 문맥 ${r.오디오문맥ms.join(',')}ms` : ''} · 메인 50ms 넘는 일 ${r.긴일.join(' ') || '없음'}`);
    }
  }
  srv.close();
  fs.writeFileSync(path.join(os.tmpdir(), 'talk-rally-부드러움.json'), JSON.stringify({ 잰때: new Date().toISOString(), 횟수: RUNS, 캐시: WARM, rows }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
