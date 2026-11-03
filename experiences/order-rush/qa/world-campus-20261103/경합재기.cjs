'use strict';
// 주문 폭주 캠퍼스 판 — 화면 검수(11-04 아르곤)가 짚은 경합 · 설정 결함 다섯을 게임 틀 안에서 재현한다. 고치기 전 판 · 고친 판을 같은 시험으로 견줄 수 있다.
//   A1 손님이 들어온 직후 문 종 사이에 R(다시 듣기)을 누르면 주문 음성이 몇 번 시작되나 — 1이어야 한다
//   A2 재료를 뺄 때 컵 출렁임이 걸리나 — 뺄 때 false · 담을 때 true
//   B1 줄 선 손님 B를 눌렀다가 120ms 뒤 A로 돌아오면 맨 위 얼굴이 A인가 — true
//   B2 영업 끝 소리 순서 — done → land → coin(코인 정산이 가림막 동안 먼저 와도)
//   B3 앱 설정 「움직임 줄이기」에서 결과 사진 다가감이 멈추나 — none
//   F1 멈춤 창에서 처음으로 나간 다음 판의 음악 크기(pause 값) — 1이어야 한다(멈춤 창 값 0.25가 남으면 12dB 작다)
//   F2 말하는 중에 멈췄다 이어 하면 음악이 다시 내려가나(ducked) — true
//   F3 러시 남은 시간 10 → 9 숫자 띠가 한 칸만 구르나 — translateY(-10em) → (-9em)
//   F4 터치 기기(hover 없음)에서 알약에 코랄 고리가 남나 — none
//   node experiences/order-rush/qa/world-campus-20261103/경합재기.cjs [experiences 폴더]
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE || os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const root = path.resolve(process.argv[2] || path.join(__dirname, '../../..'));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain' };
const frame = '<!doctype html><meta charset=utf-8><link rel=icon href="data:,"><style>html,body{margin:0;height:100%;background:#060709}iframe{border:0;display:block;width:100%;height:100%}</style><iframe class="game-frame" src="/order-rush/index.html?qa=1" allow="autoplay"></iframe>';
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') { res.writeHead(200, { 'Content-Type': types['.html'] }); return res.end(frame); }
  let t = path.resolve(root, '.' + p);
  if (!t.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    if (fs.statSync(t).isDirectory()) t = path.join(t, 'index.html');
    let body = fs.readFileSync(t);
    // 시험에서만: 효과음 이름을 적어 두는 탐침을 심는다(파일은 그대로)
    if (p.endsWith('/world-play.mjs')) body = Buffer.from(body.toString('utf8').replace('function play(name, opts) {', "function play(name, opts) { (window.__playLog ??= []).push([name, Math.round(performance.now())]);"));
    res.writeHead(200, { 'Content-Type': types[path.extname(t)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404).end('nf'); }
});
const faceOf = (src) => /guests\/(g\d)-/.exec(src || '')?.[1] || null;

async function open(browser, { reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript((reducedMotion) => {
    if (reducedMotion && window === window.top) document.documentElement.dataset.motion = 'reduced';
    const orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { (window.__mediaLog ??= []).push([this.currentSrc || this.src || '', Math.round(performance.now())]); return orig.apply(this, arguments); };
  }, reduced);
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load' });
  if (reduced) await page.evaluate(() => { document.documentElement.dataset.motion = 'reduced'; });
  const fr = () => page.frames().find((f) => f.url().includes('/order-rush/index.html'));
  for (let i = 0; i < 120; i += 1) {
    if (await fr()?.evaluate(() => !!window.__rush && document.documentElement.classList.contains('w-ready')).catch(() => false)) break;
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(1800);
  return { ctx, page, fr, f: page.frameLocator('iframe.game-frame') };
}
const waitFor = async (page, fn, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn().catch(() => false)) return true; await page.waitForTimeout(100); } return false; };

server.listen(0, '127.0.0.1', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const out = {};

  // A1: 손님이 들어온 직후 문 종 사이에 R(다시 듣기)을 누르면 주문 음성이 몇 번 시작되나 — 기대 1
  { const { ctx, page, fr, f } = await open(browser);
    await f.locator('#start').click();
    await waitFor(page, () => fr().evaluate(() => !!window.__rush.state().current), 8000);
    await fr().evaluate(() => { window.__mediaLog = []; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', code: 'KeyR', bubbles: true })); });
    await page.waitForTimeout(1600);
    const plays = await fr().evaluate(() => (window.__mediaLog || []).filter(([s]) => /audio\//.test(s) || s === '').length);
    out.A1_주문음성시작 = plays;
    await ctx.close(); }

  // A2: 얼음을 뺄 때 컵 출렁임이 다시 걸리나 — 기대 false
  { const { ctx, page, fr, f } = await open(browser);
    await f.locator('#start').click();
    await waitFor(page, () => fr().evaluate(() => window.__rush.state().current?.heard), 15000);
    await f.locator('[data-ingredient=ice]').click();
    await page.waitForTimeout(1500);
    const before = await fr().evaluate(() => { const s = window.__rush.stage().slots[0]; s.bump = 77; s.bumpAt = 77; return s.bump; });
    await f.locator('[data-ingredient=ice]').click();   // 뺀다
    const after = await fr().evaluate(() => window.__rush.stage().slots[0].bumpAt);
    out.A2_뺄때출렁임 = after !== 77;
    await page.waitForTimeout(200);
    await f.locator('[data-ingredient=ice]').click();   // 다시 담는다
    out.A2_담을때출렁임 = (await fr().evaluate(() => window.__rush.stage().slots[0].bumpAt)) !== 77;
    await ctx.close(); }

  // B1: 줄 선 손님 B를 눌렀다가 120ms 뒤 A로 돌아오면 맨 위 얼굴이 A인가 — 기대 true
  { const { ctx, page, fr, f } = await open(browser);
    await f.locator('.mode[data-mode=rush]').click();
    await f.locator('#start').click();
    await waitFor(page, () => fr().evaluate(() => window.__rush.state().current?.heard), 15000);
    const lined = await waitFor(page, () => fr().evaluate(() => window.__rush.state().queue.length >= 2 && !!document.querySelector('.ticket')), 45000);
    const r = await fr().evaluate(async () => {
      const a = document.querySelector('#guest-img').getAttribute('src'), uid = window.__rush.state().current.uid;
      document.querySelector('.ticket').click();
      await new Promise((d) => setTimeout(d, 120));
      const mid = [document.querySelector('#guest-img').getAttribute('src'), document.querySelector('#w-guest-next').getAttribute('src'), document.querySelector('#w-guest-next').hidden];
      document.querySelector('.ticket').click();   // 줄에는 이제 A가 있다
      await new Promise((d) => setTimeout(d, 1100));
      const front = document.querySelector('#guest-img'), back = document.querySelector('#w-guest-next');
      const top = !back.hidden && back.style.zIndex === '2' ? back : front;
      return { a, uid, nowUid: window.__rush.state().current.uid, mid, top: top.getAttribute('src'), frontId: front.getAttribute('src'), backHidden: back.hidden, backZ: back.style.zIndex, topOpacity: getComputedStyle(top).opacity };
    });
    out.B1_줄서기 = lined;
    out.B1_돌아온손님맨위 = faceOf(r.top) === faceOf(r.a) && r.uid === r.nowUid;
    out.B1_자세히 = r;
    await ctx.close(); }

  // B2: 영업 끝 소리 순서 — 기대 done → … → land → coin
  { const { ctx, page, fr, f } = await open(browser);
    await f.locator('#start').click();
    await waitFor(page, () => fr().evaluate(() => window.__rush.state().current?.heard), 15000);
    const cups = await fr().evaluate(() => window.__rush.state().current.recipe);
    for (const [i, cup] of cups.entries()) {
      if (i) await f.locator('#add-cup').click();
      if (cup.base) await f.locator(`[data-ingredient=${cup.base}]`).click();
      if (cup.milk) await f.locator('[data-ingredient=milk]').click();
      if (cup.ice) await f.locator('[data-ingredient=ice]').click(); else if (cup.temp === 'cold') await f.locator('[data-ingredient=cold]').click();
      if (cup.sugar) await f.locator('[data-ingredient=sugar]').click();
    }
    await f.locator('#serve').click();
    await page.waitForTimeout(600);
    await fr().evaluate(() => { window.__playLog = []; window.__rush.finish(); });
    await page.waitForTimeout(3800);
    const log = await fr().evaluate(() => window.__playLog.map(([n]) => n).filter((n) => ['done', 'land', 'coin'].includes(n)));
    out.B2_소리순서 = log.join(' → ');
    await ctx.close(); }

  // B3: 앱 설정 「움직임 줄이기」에서 결과 사진 다가감이 멈추나 — 기대 none
  { const { ctx, page, fr, f } = await open(browser, { reduced: true });
    await f.locator('#start').click();
    await waitFor(page, () => fr().evaluate(() => !!window.__rush.state().current), 8000);
    await page.waitForTimeout(800);
    await fr().evaluate(() => window.__rush.finish());
    await page.waitForTimeout(1500);
    out.B3_결과사진움직임 = await fr().evaluate(() => getComputedStyle(document.querySelector('#results .res-hero'), '::before').animationName);
    out.B3_data_motion = await fr().evaluate(() => document.documentElement.dataset.motion || null);
    await ctx.close(); }

  // F1 · F2: 멈춤 창과 음악 크기
  { const { ctx, page, fr, f } = await open(browser);
    await f.locator('#start').click();
    await waitFor(page, () => fr().evaluate(() => window.__rush.world()?.music?.playing), 12000);
    await waitFor(page, () => fr().evaluate(() => window.__rush.state().current?.voice === 'playing'), 8000);
    await page.waitForTimeout(250);
    await fr().evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })));
    await page.waitForTimeout(350);
    const paused = await fr().evaluate(() => window.__rush.world());
    await f.locator('#resume').click();
    await page.waitForTimeout(150);
    const resumed = await fr().evaluate(() => ({ ...window.__rush.world(), voice: window.__rush.state().current?.voice }));
    out.F2_멈춤중덕킹 = paused.ducked;
    out.F2_이어하기뒤덕킹 = resumed.ducked;
    await waitFor(page, () => fr().evaluate(() => window.__rush.state().current?.heard), 15000);
    await fr().evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })));
    await page.waitForTimeout(900);
    out.F1_멈춤창크기 = +(await fr().evaluate(() => window.__rush.world().music.pause)).toFixed(2);
    await f.locator('#quit').click();
    await page.waitForTimeout(1500);
    await f.locator('#start').click();
    await page.waitForTimeout(2500);
    out.F1_다음판크기 = +(await fr().evaluate(() => window.__rush.world().music.pause)).toFixed(2);
    await ctx.close(); }

  // F3: 숫자 띠
  { const { ctx, fr } = await open(browser);
    out.F3_띠 = await fr().evaluate(async () => {
      const fx = await import('./world-fx.mjs');
      const s = document.createElement('span'); s.textContent = '10'; document.body.append(s);
      fx.roller(s);
      s.textContent = '9';
      await new Promise((d) => setTimeout(d, 30));
      const strip = s.nextElementSibling.querySelector('.w-roll-s');
      const kf = strip.getAnimations()[0]?.effect.getKeyframes().map((k) => k.transform) || [];
      return kf.join(' → ');
    });
    await ctx.close(); }

  // F4: 터치 기기의 hover 고리
  { const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load' });
    const fr = () => page.frames().find((x) => x.url().includes('/order-rush/index.html'));
    await waitFor(page, () => fr().evaluate(() => !!window.__rush && document.documentElement.classList.contains('w-ready')), 18000);
    await page.waitForTimeout(1500);
    await page.frameLocator('iframe.game-frame').locator('#start').hover();
    out.F4_마우스없음 = await fr().evaluate(() => matchMedia('(hover:hover)').matches === false);
    out.F4_고리 = await fr().evaluate(() => getComputedStyle(document.querySelector('#start')).boxShadow);
    await ctx.close(); }

  await browser.close(); server.close();
  console.log(JSON.stringify(out, null, 1));
});
