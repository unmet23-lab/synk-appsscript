'use strict';
// 말의 리듬 캠퍼스 판 — 곡 문맥 다시 쓰기 · 미리듣기가 받던 곡 이어 받기를 실제 브라우저 소리로 잰다(2026-11-04).
//   받기: 곡 카드를 누르고 받는 중에 시작 → 그 곡을 몇 번 받았나(1이어야 한다)
//   받다가 나가기: 이어 받는 중에 처음으로 나가면 받기가 끝나길 기다리지 않고 시작 단추가 바로 풀린다
//   다시 하기 · 다시 듣기: 소리 문맥을 새로 만들지 않고 곡 시계 · 소리가 다시 돈다
//   나갔다 시작: 앞 판에 예약된 문장 안내음이 다음 판에서 깨어나지 않는다(배경 음악을 끄고, 네 박이 끝난 뒤 출력이 조용한지 잰다)
//   숨김: 화면이 숨으면 재워 둔 문맥을 닫고, 다음 판은 새 문맥으로 돈다
//   node 곡문맥재사용.cjs [--대조]   --대조: 두 고리(onPark · recordingSource)를 뗀 판으로 돌려 이 시험이 문제를 잡는지 본다(받기 2 · 안내음 들림이 나와야 한다)
//   --라이브: 이 PC 파일 대신 synk.im 공개본을 같은 게임 틀로 연다(체험 앱에서는 「한 곡 더」가 로그인으로 넘어가 재지 못한다)
const path = require('node:path'), fs = require('node:fs'), os = require('node:os'), http = require('node:http');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE || os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));

const CONTROL = process.argv.includes('--대조'), LIVE = process.argv.includes('--라이브');
const LIVE_FRAME = 'https://synk.im/world/__rhythm_frame__';
const EXP = path.resolve(__dirname, '../../..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
const FRAME = '<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#060709}iframe{border:0;display:block;width:100%;height:100%}</style><iframe class="game-frame" src="/korean-rhythm/index.html?qa=1" allow="autoplay"></iframe>';
let SLOW_MS = 1500;   // 곡 파일을 이만큼 늦게 줘서 「받는 중」을 만든다
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const songRequests = new Map();

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer(async (req, res) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (u === '/') { res.writeHead(200, { 'content-type': TYPES['.html'] }); res.end(FRAME); return; }
      let file = path.join(EXP, u);
      if (!file.startsWith(EXP) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
      if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      if (/\/assets\/music\/.*\.mp3$/.test(u)) { songRequests.set(u, (songRequests.get(u) || 0) + 1); await sleep(SLOW_MS); }
      let body = fs.readFileSync(file);
      if (CONTROL && u.endsWith('/world-play.mjs')) body = String(body).replace('music.onPark =', 'music.noPark =').replace('music.recordingSource =', 'music.noSource =');
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

// 게임 문서 안: 문맥을 세고, 모든 출력을 분석기를 거치게 해 실제로 나는 소리를 잰다
const INIT = () => {
  if (!location.pathname.includes('/korean-rhythm/')) return;
  try { localStorage.setItem('synk.world.rhythm.calibrated', '1'); } catch { /* 저장 못 함 */ }
  window.__acs = [];
  window.__taps = [];
  const Base = window.AudioContext;
  window.AudioContext = class extends Base { constructor(...a) { super(...a); window.__acs.push(this); } };
  const connect = AudioNode.prototype.connect, taps = new WeakMap();
  AudioNode.prototype.connect = function (dst, ...rest) {
    if (dst instanceof AudioDestinationNode) {
      let tap = taps.get(dst);
      if (!tap) { tap = this.context.createAnalyser(); tap.fftSize = 2048; connect.call(tap, dst); taps.set(dst, tap); window.__taps.push(tap); }
      return connect.call(this, tap, ...rest);
    }
    return connect.call(this, dst, ...rest);
  };
  window.__level = () => {
    let peak = 0;
    for (const tap of window.__taps) {
      if (tap.context.state !== 'running') continue;
      const data = new Float32Array(tap.fftSize);
      tap.getFloatTimeDomainData(data);
      for (const x of data) peak = Math.max(peak, Math.abs(x));
    }
    return peak;
  };
};

async function opened(browser, url, { musicOff = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(INIT);
  if (musicOff) await ctx.addInitScript(() => { try { localStorage.setItem('synk.korean-rhythm.music', 'off'); } catch { /* 저장 못 함 */ } });
  const page = await ctx.newPage(), errors = [];
  if (LIVE) await page.route('https://synk.im/world/**', async (route) => {
    const u = new URL(route.request().url()), rel = decodeURIComponent(u.pathname);
    if (u.href === LIVE_FRAME) return route.fulfill({ contentType: TYPES['.html'], body: FRAME.replace('/korean-rhythm/index.html', '/world/korean-rhythm/index.html') });
    if (/\/assets\/music\/.*\.mp3$/.test(rel)) { songRequests.set(rel, (songRequests.get(rel) || 0) + 1); await sleep(SLOW_MS); }
    return route.continue();
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const fr = () => page.frames().find((x) => x.url().includes('/korean-rhythm/'));
  for (let i = 0; i < 120; i += 1) { if (await fr()?.evaluate(() => !!window.__rhythm && !!document.querySelector('.w-art')).catch(() => false)) break; await sleep(150); }
  await sleep(2600);   // 화면 소리 문맥이 한가할 때 만들어질 때까지
  const f = page.frameLocator('iframe.game-frame');
  const until = async (test, arg, ms = 40000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fr().evaluate(test, arg)) return true; await sleep(70); } return false; };
  return { ctx, page, fr, f, until, errors };
}
const count = (s) => s.fr().evaluate(() => window.__acs.length);
const toResults = async (s) => {
  const dur = await s.fr().evaluate(() => window.__rhythm.state().duration);
  await s.fr().evaluate((x) => window.__rhythm.seek(x), dur - 1);
  const reached = await s.until(() => window.__rhythm.state().screen === 'results');
  await sleep(1200);
  if (!reached) throw new Error(`결과에 못 닿음: ${JSON.stringify(await s.fr().evaluate(() => { const r = window.__rhythm.state(); return { screen: r.screen, time: r.time, duration: r.duration, loading: r.loading, paused: r.paused, say: document.querySelectorAll('.say-again').length, errors: 0 }; }))} ${s.errors.join(' | ')}`);
};
const playing = (s) => s.until(() => { const r = window.__rhythm.state(); return r.screen === 'game' && !r.loading && r.time > 0.3; });

(async () => {
  const srv = LIVE ? null : await serve();
  const url = LIVE ? LIVE_FRAME : `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const out = { 대조: CONTROL, 라이브: LIVE };

  { // 받기: 다른 곡 카드를 누르고 받는 중에 시작
    const s = await opened(browser, url);
    const before = new Map(songRequests);
    await s.f.locator('#track-grid .song[data-track="1"]').click();
    await sleep(250);
    await s.f.locator('#start-button').click();
    const ok = await playing(s);
    const asked = [...songRequests].map(([k, v]) => [k, v - (before.get(k) || 0)]).filter(([, v]) => v > 0);
    out.받기 = { 시작됨: ok, 곡: asked, 오류: s.errors };
    await s.ctx.close();
  }
  { // 받다가 나가기: 곡이 오래 걸릴 때 준비 화면에서 나가도 시작 단추가 막히지 않는다
    const s = await opened(browser, url);
    SLOW_MS = 8000;
    await s.f.locator('#track-grid .song[data-track="2"]').click();
    await sleep(250);
    await s.f.locator('#start-button').click();
    await s.until(() => window.__rhythm.state().screen === 'game');
    await s.f.locator('#pause-button').click();
    await s.f.locator('#leave-button').click();
    const t0 = Date.now();
    const freed = await s.until(() => { const r = window.__rhythm.state(); return r.screen === 'lobby' && !r.loading && !document.getElementById('start-button').disabled; }, undefined, 7000);
    out.받다가나가기 = { 풀림: freed, 걸린ms: Date.now() - t0, 오류: s.errors };
    SLOW_MS = 1500;
    await s.ctx.close();
  }
  { // 다시 하기 · 다시 듣기 · 숨김
    const s = await opened(browser, url);
    await s.f.locator('#start-button').click();
    await playing(s);
    const first = await count(s);
    await toResults(s);
    const parked = await s.fr().evaluate(() => window.__acs.map((c) => c.state));
    await s.f.locator('.say-again:visible').first().click({ timeout: 8000 });
    await sleep(700);
    const heard = await s.fr().evaluate(() => window.__level());
    const afterReview = await count(s);
    await s.until(() => window.__acs.at(-1).state === 'suspended', undefined, 12000);
    const reviewParked = await s.fr().evaluate(() => window.__acs.at(-1).state);
    await s.f.locator('#replay-button').click();
    const again = await playing(s);
    await sleep(900);
    const r = await s.fr().evaluate(() => { const x = window.__rhythm.state(); return { time: x.time, screen: x.screen, level: window.__level() }; });
    const afterReplay = await count(s);
    await toResults(s);
    await s.fr().evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); delete document.hidden; });
    await sleep(200);
    const dropped = await s.fr().evaluate(() => window.__acs.map((c) => c.state));
    await s.f.locator('#replay-button').click();
    const fresh = await playing(s);
    await sleep(500);
    out.다시 = { 첫판문맥: first, 결과에서: parked, 다시듣기소리: +heard.toFixed(3), 다시듣기뒤문맥: afterReview, 다시듣기끝: reviewParked, 다시하기됨: again, 다시하기: { ...r, level: +r.level.toFixed(3) }, 다시하기뒤문맥: afterReplay, 숨김뒤: dropped, 숨김뒤판: fresh, 숨김뒤문맥: await count(s), 오류: s.errors };
    await s.ctx.close();
  }
  { // 나갔다 시작: 앞 판에 예약된 안내음이 조용한 자리에서 깨어나는지
    const s = await opened(browser, url, { musicOff: true });
    await s.f.locator('#start-button').click();
    await playing(s);
    const q = await s.fr().evaluate(() => window.__rhythm.state().questions[0]);
    await s.fr().evaluate((x) => window.__rhythm.seek(x), q.showTime - 5);   // 안내음이 4.55초 뒤로 예약된다
    await sleep(150);
    await s.f.locator('#pause-button').click();
    await s.f.locator('#leave-button').click();
    await s.until(() => window.__rhythm.state().screen === 'lobby');
    await s.f.locator('#start-button').click();
    await s.until(() => { const r = window.__rhythm.state(); return r.screen === 'game' && !r.loading && r.time > 0.15; });   // 네 박이 끝났다 — 음악은 꺼 뒀고 문장은 아직이라 조용해야 한다
    const next = await s.fr().evaluate(() => window.__rhythm.state().questions[0].showTime);
    const samples = [], t0 = Date.now();
    while (Date.now() - t0 < 3600) { samples.push(await s.fr().evaluate(() => [window.__rhythm.state().time, window.__level()])); await sleep(30); }
    const quiet = samples.filter(([t]) => t < next - 0.6);
    out.나갔다시작 = { 잰장: quiet.length, 다음판첫문장: +next.toFixed(1), 가장큰소리: +Math.max(0, ...quiet.map(([, l]) => l)).toFixed(4), 문맥: await count(s), 오류: s.errors };
    await s.ctx.close();
  }
  await browser.close();
  srv?.close();
  console.log(JSON.stringify(out, null, 1));
  if (!CONTROL && !LIVE) fs.writeFileSync(path.join(__dirname, '곡문맥재사용.json'), JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
