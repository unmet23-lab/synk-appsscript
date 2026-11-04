'use strict';
// 주문 폭주 손님별 목소리(11-05) — 게임 틀 안에서 실제로 몇 손님을 받아 보며 잰다: 재생된 파일이 화면의 그 손님 · 그 주문 것인가, 끝까지 들어 「들음」이 되나,
// 목소리 막대가 도나, 결과 화면 「듣기」도 같은 손님 목소리인가, 콘솔 오류 · 실패 요청이 없나. 끝에 맞지 않은 것이 있으면 종료 코드 1.
//   node 손님목소리재생.cjs [--손님 8] [--폭 390 --높이 844]              이 작업본 experiences/
//   node 손님목소리재생.cjs --공개 [--후보 <공개 후보 폴더>] [--손님 8]      synk.im/world의 같은 출처 게임 틀. 후보를 주면 후보에 있는 파일만 후보에서 내준다(공개본은 안 바꾼다)
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE || os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const argv = process.argv.slice(2), opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const root = path.join(__dirname, '../../..');
const 공개 = argv.includes('--공개'), 후보 = opt('--후보') ? path.resolve(opt('--후보')) : null;
const 손님수 = Number(opt('--손님', 8)), W = Number(opt('--폭', 390)), H = Number(opt('--높이', 844));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json', '.wasm': 'application/wasm' };
const frame = (src) => `<!doctype html><meta charset=utf-8><link rel=icon href="data:,"><style>html,body{margin:0;height:100%;background:#060709}iframe{border:0;display:block;width:100%;height:100%}</style><iframe class="game-frame" src="${src}" allow="autoplay"></iframe>`;
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') { res.writeHead(200, { 'Content-Type': types['.html'] }); return res.end(frame('/order-rush/index.html?qa=1')); }
  let t = path.resolve(root, '.' + p);
  if (!t.startsWith(path.resolve(root))) { res.writeHead(403).end(); return; }
  try {
    if (fs.statSync(t).isDirectory()) t = path.join(t, 'index.html');
    res.writeHead(200, { 'Content-Type': types[path.extname(t)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(t));
  } catch { res.writeHead(404).end('nf'); }
});

async function main(열주소) {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const 오류 = [], 실패 = [], 후보에서 = new Set();
  page.on('console', (m) => { if (m.type() === 'error') 오류.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => 오류.push(String(e).slice(0, 200)));
  page.on('response', (r) => { if (r.status() >= 400) 실패.push(`${r.status()} ${r.url()}`); });
  page.on('requestfailed', (r) => { if (!/ERR_ABORTED/.test(r.failure()?.errorText || '')) 실패.push(`실패 ${r.url()} ${r.failure()?.errorText}`); });
  await page.addInitScript(() => {
    const orig = HTMLMediaElement.prototype.play;
    // src가 먼저다: play() 하는 순간 currentSrc는 아직 앞 파일이다
    HTMLMediaElement.prototype.play = function () { (window.__mediaLog ??= []).push(this.src || this.currentSrc || ''); return orig.apply(this, arguments); };
  });
  if (공개) {
    const 틀 = 'https://synk.im/world/__order_rush_frame__';
    await page.route('https://synk.im/world/**', async (route) => {
      const u = new URL(route.request().url()), rel = decodeURIComponent(u.pathname).replace(/^\//, '');
      if (u.href.startsWith(틀)) return route.fulfill({ contentType: types['.html'], body: frame('/world/order-rush/index.html?qa=1') });
      const file = 후보 && path.join(후보, rel);
      if (file && fs.existsSync(file) && fs.statSync(file).isFile()) { 후보에서.add(rel); return route.fulfill({ contentType: types[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) }); }
      return route.continue();
    });
    열주소 = 틀;
  }
  await page.goto(열주소, { waitUntil: 'load', timeout: 60000 });
  const fr = () => page.frames().find((f) => f.url().includes('/order-rush/index.html'));
  const f = page.frameLocator('iframe.game-frame');
  const 기다림 = async (fn, ms = 40000) => { const end = Date.now() + ms; while (Date.now() < end) { const v = await fn().catch(() => false); if (v) return v; await page.waitForTimeout(60); } return false; };
  await 기다림(() => fr()?.evaluate(() => !!window.__rush && document.documentElement.classList.contains('w-ready')));
  await page.waitForTimeout(1500);
  const 파일 = (s) => { const m = /assets\/world\/voice\/(g\d)\/([^/?#]+)\.mp3/.exec(s || ''); return m ? { guest: m[1], order: m[2] } : null; };
  // 맨 위 얼굴(두 장을 겹쳐 바꾼다 — 경합재기.cjs B1과 같은 읽기)
  const 얼굴 = () => fr().evaluate(() => { const front = document.querySelector('#guest-img'), back = document.querySelector('#w-guest-next'); const top = back && !back.hidden && back.style.zIndex === '2' ? back : front; return /guests\/(g\d)-/.exec(top?.getAttribute('src') || '')?.[1] || null; });
  await f.locator('#start').click();
  const 표 = [];
  let 앞uid = null, 틀림 = 0;
  for (let n = 0; n < 손님수; n += 1) {
    const cur = await 기다림(async () => { const c = await fr().evaluate(() => window.__rush.state().current); return c && c.uid !== 앞uid ? c : false; });
    if (!cur) { 표.push({ 차례: n + 1, 틀림: '다음 손님이 오지 않음' }); 틀림 += 1; break; }
    앞uid = cur.uid;
    const 시작 = Date.now();
    let 막대 = false;
    while (Date.now() - 시작 < 16000) {
      const s = await fr().evaluate(() => ({ heard: window.__rush.state().current?.heard, live: !!document.querySelector('#b-dots.w-live') }));
      막대 ||= s.live;
      if (s.heard) break;
      await page.waitForTimeout(60);
    }
    const c = await fr().evaluate(() => window.__rush.state().current);
    const log = await fr().evaluate(() => window.__mediaLog || []);
    const 뜸 = 파일(log[log.length - 1]);
    const 화면 = await 얼굴();
    const 줄 = { 차례: n + 1, 주문: c.id, 화면손님: 화면, 재생: 뜸 && `${뜸.guest}/${뜸.order}`, 들음: c.heard, 소리상태: c.voice, 막대, 들은초: Math.round((Date.now() - 시작) / 100) / 10 };
    if (!뜸 || 뜸.guest !== 화면 || 뜸.order !== c.id || !c.heard || c.voice === 'error' || !막대) { 줄.틀림 = true; 틀림 += 1; }
    표.push(줄);
    console.log(JSON.stringify(줄));
    for (const [i, cup] of c.recipe.entries()) {
      if (i) await f.locator('#add-cup').click();
      if (cup.base) await f.locator(`[data-ingredient=${cup.base}]`).click();
      if (cup.milk) await f.locator('[data-ingredient=milk]').click();
      if (cup.ice) await f.locator('[data-ingredient=ice]').click(); else if (cup.temp === 'cold') await f.locator('[data-ingredient=cold]').click();
      if (cup.sugar) await f.locator('[data-ingredient=sugar]').click();
    }
    await f.locator('#serve').click();
    await page.waitForTimeout(500);
    if (await fr().evaluate(() => window.__rush.state().done || window.__rush.state().screen === 'result')) break;
  }
  const 받은손님 = new Set(표.map((x) => x.화면손님).filter(Boolean));
  // 결과 화면: 「듣기」도 그 손님 목소리다(결과 줄의 차례 = 영업 때 차례)
  await fr().evaluate(() => { if (!window.__rush.state().done) window.__rush.finish(); });
  await page.waitForTimeout(3500);
  const 결과 = [];
  const 듣기수 = await f.locator('.say-again').count();
  for (let i = 0; i < Math.min(듣기수, 3); i += 1) {
    await f.locator('.say-again').nth(i).scrollIntoViewIfNeeded();
    await f.locator('.say-again').nth(i).click();
    await page.waitForTimeout(250);
    const log = await fr().evaluate(() => window.__mediaLog || []);
    const 뜸 = 파일(log[log.length - 1]);
    const 줄 = { 줄: i + 1, 재생: 뜸 && `${뜸.guest}/${뜸.order}`, 영업때: 표.map((x) => x.재생).filter((x) => x?.endsWith(`/${뜸?.order}`)) };
    if (!뜸 || !줄.영업때.includes(줄.재생)) { 줄.틀림 = true; 틀림 += 1; }
    결과.push(줄);
    console.log(JSON.stringify(줄));
  }
  await page.waitForTimeout(600);
  await browser.close();
  const 끝 = { 받은손님: 표.length, 서로다른손님: 받은손님.size, 결과듣기: 결과.length, 틀림, 후보에서받음: 후보에서.size, 오류, 실패 };
  console.log(JSON.stringify(끝, null, 1));
  return 틀림 || 오류.length || 실패.length ? 1 : 0;
}

if (공개) main().then((c) => process.exit(c));
else server.listen(0, '127.0.0.1', () => main(`http://127.0.0.1:${server.address().port}/`).then((c) => { server.close(); process.exit(c); }));
