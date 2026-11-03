'use strict';
// 말의 리듬 캠퍼스 판(2026-11-04) — 화면 바꿈 · 놀이 중이 부드러운지 잰다(주문 폭주 캠퍼스 판 부드러움재기.cjs를 옮김, 유호님 11-03 「전환될 때 프레임이 끊기는 느낌 — 몰입을 방해」).
// 게임 틀(같은 출처 .game-frame, 390 × 844 · 배율 3 · GPU)에서 전환 하나를 크롬 추적으로 떠, 눈에 보이는 끊김만 센다:
//   버림 = 합성기 프레임 보고(PipelineReporter)가 STATE_DROPPED이고 affects_smoothness인 장(움직이는 중에 버린 장, 장마다 16.7ms)
//   합성 실패 = 합성기로 못 가고 메인 스레드에서 도는 애니메이션(compositeFailed — 메인 스레드가 잠깐만 바빠도 끊긴다)
//   셰이더 = GPU가 처음 쓰는 그림 조합의 셰이더를 굽는 시간(shader_compile 합). 새 브라우저라 매번 차갑다 — 브라우저 · PC 앱은 디스크에 남겨
//            두 번째부터는 굽지 않는다(--캐시: 같은 브라우저에서 한 판을 먼저 돌린 뒤 새 창에서 잰다 — GPU 프로세스의 셰이더가 남아 있다)
//   오디오 문맥 = AudioContext 만들기(윈도우 장치 묻기 0.2~1초, 메인 스레드를 잡는다)
// 가림막(#w-curtain)이 덮고 있는 동안 버린 장은 보이지 않는다 — 버림 시각을 가림막 켬 · 걷음 시각과 함께 적는다.
//   node experiences/korean-rhythm/qa/world-campus-20261104/부드러움재기.cjs [입구 시작 놀이 듣기 결과 처음으로 다시] [--횟수 3] [--캐시] [--배율 1]
//   나가는 것: 화면에 표 · 이 폴더 부드러움.json(결과 파일 — git 밖)
const path = require('node:path'), fs = require('node:fs'), os = require('node:os'), http = require('node:http');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE || os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));

const ALL = ['입구', '시작', '놀이', '듣기', '결과', '처음으로', '다시'];
const argv = process.argv.slice(2);
const opt = (name, d) => { const i = argv.indexOf(name); return i >= 0 ? Number(argv[i + 1]) : d; };
const KINDS = argv.filter((a) => ALL.includes(a));
const RUNS = opt('--횟수', 3), RATE = opt('--배율', 1), WARM = argv.includes('--캐시');
const EXP = path.resolve(__dirname, '../../..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
const FRAME = '<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#060709}iframe{border:0;display:block;width:100%;height:100%}</style><iframe class="game-frame" src="/korean-rhythm/index.html?qa=1" allow="autoplay"></iframe>';
const CATS = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'blink', 'gpu', 'toplevel', 'cc', 'viz', 'webaudio', 'skia', 'disabled-by-default-skia', 'disabled-by-default-skia.gpu', 'disabled-by-default-skia.shaders'];
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
  return { 버림: dropped.length, 버림시각: dropped, 합성실패: [...new Set(failed)], 셰이더ms: Math.round(shader), 가장긴GPUms: Math.round(gpuLong), 오디오문맥ms: audio };
}

/** 전환 하나를 돌리며 그 구간만 추적한다. 가림막 켬 · 걷음 시각(추적 기준 ms)도 함께. */
async function measure(page, kind) {
  const f = page.frameLocator('iframe.game-frame');
  const fr = () => page.frames().find((x) => x.url().includes('/korean-rhythm/'));
  const browser = page.context().browser() || page.context();
  const trace = async (fn) => {
    await browser.startTracing(page, { categories: CATS });
    const t = await fr()?.evaluate(() => performance.now()).catch(() => 0);
    await fn();
    const marks = await fr()?.evaluate(() => window.__curtainMarks || []).catch(() => []);
    return { buf: await browser.stopTracing(), t, marks };
  };
  if (kind === '입구') {
    await browser.startTracing(page, { categories: CATS });
    await page.goto(page.__url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ready(fr);
    await sleep(3500);
    return { buf: await browser.stopTracing(), t: 0, marks: [] };
  }
  await page.goto(page.__url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await ready(fr);
  await sleep(3500);
  if (kind === '시작') return trace(async () => { await f.locator('#start-button').click(); await sleep(3000); });
  await f.locator('#start-button').click();
  const until = async (test, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fr().evaluate(test)) return; await sleep(80); } };
  await until(() => window.__rhythm.state().screen === 'game' && window.__rhythm.state().time > -1);
  await fr().evaluate(() => { window.__rhythm.autoplay(true); window.__rhythm.plan(['right', 'right', 'right', 'right', 'right']); });
  if (kind === '놀이') { await until(() => window.__rhythm.state().time > 2); return trace(async () => { await sleep(4000); }); }   // 노트 · 고리 · 콤보 · 벽 빛이 다 도는 4초
  if (kind === '듣기') {
    const q = await fr().evaluate(() => window.__rhythm.state().questions[0]);
    await fr().evaluate((x) => window.__rhythm.seek(x), q.showTime - 1.5);
    return trace(async () => { await sleep(3500); });   // 안내음 · 방 어둡힘 · 문제 카드
  }
  const dur = await fr().evaluate(() => window.__rhythm.state().duration);
  await until(() => window.__rhythm.state().time > 3);
  if (kind === '결과') {
    await fr().evaluate((x) => window.__rhythm.seek(x), dur - 1.2);
    return trace(async () => { await sleep(4500); });   // 무대 끝 → 가림막 → 사진 · 점 · 숫자
  }
  await fr().evaluate((x) => window.__rhythm.seek(x), dur - 1);
  await until(() => window.__rhythm.state().screen === 'results');
  await sleep(3500);
  if (kind === '처음으로') return trace(async () => { await f.locator('#other-song').click(); await sleep(2500); });
  return trace(async () => { await f.locator('#replay-button').click(); await sleep(3000); });
}
async function ready(fr) {
  for (let i = 0; i < 100; i += 1) { if (await fr()?.evaluate(() => !!window.__rhythm && !!document.querySelector('.w-art')).catch(() => false)) return; await sleep(150); }
}
// 가림막 켬 · 걷음 시각을 게임 문서에 적어 둔다(추적과 같은 performance 시계)
const CURTAIN = () => {
  if (!location.pathname.includes('/korean-rhythm/')) return;
  try { localStorage.setItem('synk.world.rhythm.calibrated', '1'); } catch { /* 저장 못 함 */ }
  window.__curtainMarks = [];
  new MutationObserver((list) => { for (const m of list) if (m.target.id === 'w-curtain') window.__curtainMarks.push([Math.round(performance.now()), m.target.classList.contains('on') ? '켬' : '걷음']); })
    .observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
};

(async () => {
  const srv = await serve();
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const rows = [];
  for (const kind of KINDS.length ? KINDS : ALL) {
    for (let n = 1; n <= RUNS; n += 1) {
      const browser = await chromium.launch({ args: ARGS });
      const open = async () => {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
        await ctx.addInitScript(CURTAIN);
        const page = await ctx.newPage();
        page.__url = url;
        if (RATE > 1) await (await ctx.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: RATE });
        return { ctx, page };
      };
      if (WARM) {   // 같은 브라우저에서 한 판을 먼저(입구 → 시작 → 놀이 몇 초 → 결과 → 다른 곡) — GPU 프로세스에 셰이더가 남는다
        const { ctx, page } = await open();
        const f = page.frameLocator('iframe.game-frame'), fr = () => page.frames().find((x) => x.url().includes('/korean-rhythm/'));
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); await ready(fr); await sleep(2500);
        await f.locator('#start-button').click();
        for (let i = 0; i < 200; i += 1) { if (await fr().evaluate(() => window.__rhythm.state().time > 3)) break; await sleep(100); }
        const d = await fr().evaluate(() => window.__rhythm.state().duration);
        await fr().evaluate((x) => window.__rhythm.seek(x), d - 1);
        for (let i = 0; i < 200; i += 1) { if (await fr().evaluate(() => window.__rhythm.state().screen === 'results')) break; await sleep(100); }
        await sleep(2500);
        await f.locator('#other-song').click(); await sleep(1500);
        await ctx.close();
      }
      const { ctx, page } = await open();
      const { buf, t, marks } = await measure(page, kind);
      await ctx.close(); await browser.close();
      const r = analyze(buf);
      // 가림막 시각을 추적 기준으로: 추적을 켠 직후 performance.now()가 t — 추적 0ms와 거의 같다
      const curtain = marks.filter(([ms]) => ms >= t).map(([ms, s]) => `${s} ${Math.round(ms - t)}`);
      rows.push({ 전환: kind, 회: n, ...r, 가림막: curtain });
      console.log(`${kind} ${n}: 버림 ${r.버림}장${r.버림 ? ` (${r.버림시각.join(',')}ms)` : ''} · 합성 실패 ${r.합성실패.join(' ') || '없음'} · 셰이더 ${r.셰이더ms}ms · 가장 긴 GPU ${r.가장긴GPUms}ms${r.오디오문맥ms.length ? ` · 오디오 문맥 ${r.오디오문맥ms.join(',')}ms` : ''}${curtain.length ? ` · 가림막 ${curtain.join(' → ')}ms` : ''}`);
    }
  }
  srv.close();
  fs.writeFileSync(path.join(__dirname, '부드러움.json'), JSON.stringify({ 잰때: new Date().toISOString(), 횟수: RUNS, 캐시: WARM, 배율: RATE, rows }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
