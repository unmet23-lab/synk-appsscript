'use strict';
// 입장 검사 캠퍼스 판 — 판정 한 박자가 부드러운지 잰다(2026-11-04, 주문 폭주 부드러움재기.cjs를 옮겼다. Fable 설계 검토 P2-11).
// 게임 틀(같은 출처 .game-frame, 390 × 844 · 배율 3 · GPU)에서 장면 하나를 크롬 추적으로 떠, 눈에 보이는 끊김만 센다:
//   버림 = 합성기 프레임 보고(PipelineReporter)가 STATE_DROPPED이고 affects_smoothness인 장, 합성 실패 = 합성기로 못 가고 메인 스레드에서 도는 애니메이션,
//   셰이더 = GPU가 처음 쓰는 그림 조합의 셰이더를 굽는 시간, 오디오 문맥 = AudioContext 만들기.
//   node experiences/entry-check/qa/world-campus-20261104/부드러움재기.cjs [입구 근무시작 손님옴 판정 다음손님 결과] [--횟수 3] [--배율 1]
const path = require('node:path'), fs = require('node:fs'), os = require('node:os'), http = require('node:http');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE || os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const ALL = ['입구', '근무시작', '손님옴', '판정', '다음손님', '결과'];
const argv = process.argv.slice(2);
const opt = (name, d) => { const i = argv.indexOf(name); return i >= 0 ? Number(argv[i + 1]) : d; };
const KINDS = argv.filter((a) => ALL.includes(a));
const RUNS = opt('--횟수', 3), RATE = opt('--배율', 1);
const EXP = path.resolve(__dirname, '../../..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const FRAME = '<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#060709}iframe{border:0;display:block;width:100%;height:100%}</style><iframe class="game-frame" src="/entry-check/?qa=1" allow="autoplay"></iframe>';
const CATS = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'blink', 'gpu', 'toplevel', 'cc', 'viz', 'webaudio', 'skia', 'disabled-by-default-devtools.timeline.layers'];
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
function analyze(buf) {
  const j = JSON.parse(buf.toString()), ev = j.traceEvents || j;
  const t0 = ev.reduce((m, e) => (e.ts && e.ts < m ? e.ts : m), Infinity), at = (ts) => Math.round((ts - t0) / 1000);
  const names = new Map();
  for (const e of ev) if (e.ph === 'M' && e.name === 'thread_name') names.set(`${e.pid}:${e.tid}`, e.args.name);
  const gpu = (e) => /GpuMain/.test(names.get(`${e.pid}:${e.tid}`) || '');
  const dropped = ev.filter((e) => e.name === 'PipelineReporter' && (e.ph === 'b' || e.ph === 'X') && e.args?.frame_reporter?.state === 'STATE_DROPPED' && e.args.frame_reporter.affects_smoothness).map((e) => at(e.ts));
  const open = new Map(), failed = [];
  for (const e of ev.filter((x) => x.name === 'Animation').sort((a, b) => a.ts - b.ts)) {
    const id = e.id2?.local || e.id, d = e.args?.data || {};
    if (e.ph === 'b') open.set(id, `${d.displayName || 'waapi'}@${d.nodeName}`);
    if (e.ph === 'n' && d.compositeFailed) failed.push(`${open.get(id)}(${d.compositeFailed})`);
  }
  const shader = ev.filter((e) => e.ph === 'X' && e.name === 'shader_compile' && gpu(e)).reduce((s, e) => s + e.dur / 1000, 0);
  const audio = ev.filter((e) => e.ph === 'X' && e.name === 'AudioContext::AudioContext').map((e) => Math.round(e.dur / 1000));
  return { 버림: dropped.length, 버림시각: dropped, 합성실패: [...new Set(failed)], 셰이더ms: Math.round(shader), 오디오문맥ms: audio };
}
const fr = (page) => page.frames().find((x) => x.url().includes('/entry-check/'));
async function ready(page) { for (let i = 0; i < 120; i += 1) { if (await fr(page)?.evaluate(() => document.documentElement.classList.contains('w-ready') && !!window.__entry).catch(() => false)) return; await sleep(150); } }
const pressAt = async (page, sel) => {   // 틀이 화면 전체라 틀 안 좌표 = 화면 좌표. 사람처럼 눌러야 잉크 · 얼굴 연출이 같은 길로 간다
  const r = await fr(page).evaluate((q) => { const n = document.querySelector(q); n.scrollIntoView({ block: 'nearest' }); const b = n.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
  await page.mouse.move(r.x, r.y); await page.mouse.down(); await sleep(40); await page.mouse.up();
};
async function toFirstGuest(page) {
  await pressAt(page, '#rec-start'); await sleep(1100);
  await pressAt(page, '#btn-begin'); await sleep(1300);
  if (await fr(page).evaluate(() => !document.querySelector('#coach').hidden)) { await fr(page).evaluate(() => document.querySelector('#coach-skip').click()); await sleep(400); }
  for (let i = 0; i < 80; i += 1) { const c = await fr(page).evaluate(() => window.__entry.state().cur); if (c?.id && !c.done) return c; await sleep(100); }
  return null;
}
async function measure(page, kind) {
  const browser = page.context().browser();
  const trace = async (fn) => { await browser.startTracing(page, { categories: CATS }); await fn(); return browser.stopTracing(); };
  if (kind === '입구') return trace(async () => { await page.goto(page.__url, { waitUntil: 'domcontentloaded', timeout: 60000 }); await ready(page); await sleep(3000); });
  await page.goto(page.__url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await ready(page); await sleep(2200);
  if (kind === '근무시작') { await pressAt(page, '#rec-start'); await sleep(1200); return trace(async () => { await pressAt(page, '#btn-begin'); await sleep(2200); }); }
  if (kind === '손님옴') return trace(async () => { await toFirstGuest(page); await sleep(1800); });
  let cur = await toFirstGuest(page);
  await sleep(2600);
  const judge = async (c) => { if (c.answer === 'pass') await pressAt(page, '#btn-pass'); else { await pressAt(page, '#btn-reject'); await sleep(350); await pressAt(page, `#notice .rule[data-rule="${c.answer}"]`); } };
  if (kind === '판정') return trace(async () => { await judge(cur); await sleep(2400); });
  await judge(cur); await sleep(2400);
  if (kind === '다음손님') return trace(async () => { await pressAt(page, '#btn-next'); await sleep(2400); });
  // 결과: 끝까지 맞게 찍고 마지막 다음 단추부터 잰다
  for (let g = 0; g < 14; g += 1) {
    const last = cur.id;
    const done = await fr(page).evaluate(() => /마치기/.test(document.querySelector('#btn-next span').textContent));
    if (done) break;
    await pressAt(page, '#btn-next'); await sleep(500);
    for (let i = 0; i < 60; i += 1) { cur = await fr(page).evaluate(() => window.__entry.state().cur); if (cur?.id && cur.id !== last && !cur.done) break; await sleep(100); }
    await sleep(200);
    await judge(cur); await sleep(900);
  }
  return trace(async () => { await pressAt(page, '#btn-next'); await sleep(3600); });
}
(async () => {
  const srv = await serve();
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const rows = [];
  for (const kind of KINDS.length ? KINDS : ALL) for (let n = 1; n <= RUNS; n += 1) {
    const browser = await chromium.launch({ args: ARGS });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
    await ctx.addInitScript(() => { try { localStorage.setItem('synk.entry-check.v1', JSON.stringify({ v: 1, stars: {}, plays: 1, tutorial: true, doneDay: null, motion: true })); } catch { /* 없음 */ } });
    const page = await ctx.newPage();
    page.__url = url;
    if (RATE > 1) await (await ctx.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: RATE });
    const buf = await measure(page, kind);
    await ctx.close(); await browser.close();
    if (process.env.TRACE_OUT) fs.writeFileSync(process.env.TRACE_OUT, buf);   // 까닭을 찾을 때 추적 원본을 남긴다
    const r = analyze(buf);
    rows.push({ 장면: kind, 회: n, ...r });
    console.log(`${kind} ${n}: 버림 ${r.버림}장${r.버림 ? ` (${r.버림시각.slice(0, 16).join(',')}ms)` : ''} · 합성 실패 ${r.합성실패.join(' ') || '없음'} · 셰이더 ${r.셰이더ms}ms · 오디오 문맥 ${r.오디오문맥ms.join(',') || '-'}ms`);
  }
  srv.close();
  fs.writeFileSync(path.join(__dirname, '부드러움.json'), JSON.stringify({ 잰때: new Date().toISOString(), 횟수: RUNS, 배율: RATE, rows }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
