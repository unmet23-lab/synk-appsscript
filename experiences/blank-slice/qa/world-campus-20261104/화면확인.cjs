'use strict';
// 빈칸 베기 캠퍼스 판 화면 확인(2026-11-04): 게임 틀(같은 출처 .game-frame)에서 한 판을 끝까지 실제로 돌리며 화면마다 찍고, 넘침 · 콘솔 오류 · 실패 요청 · 몽글/펠트 그림을 잰다.
// 판: 숫자 키로 맞힘 · 맞힘 · 틀림(해설) · 맞힘 · 놓침(두 번 떨어진 뒤 멈춘 보기) · 나머지 맞힘 → 결과(빨간 펜 채점) → 「우리 동네로」 자리.
//   node experiences/blank-slice/qa/world-campus-20261104/화면확인.cjs [폭 높이 …]   (기본 390 844 · 1280 800)
//   나가는 것: 공용 작업본 .tmp/blank-slice-world-20261104/화면/ · 결과 표는 표준 출력
const path = require('node:path'), fs = require('node:fs'), http = require('node:http');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const nums = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
const SIZES = nums.length >= 2 ? nums.reduce((o, n, i) => (i % 2 ? o : [...o, [n, nums[i + 1]]]), []) : [[390, 844], [1280, 800]];
const EXP = path.resolve(__dirname, '../../..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
const OUT = path.join(공용작업본(path.resolve(__dirname, '../../../..')), '.tmp', 'blank-slice-world-20261104', '화면');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function serve(W, H) {
  const FRAME = `<!doctype html><meta charset=utf-8><style>html,body{margin:0;background:#060709;overflow:hidden}iframe{border:0;display:block;width:${W}px;height:${H}px}</style><iframe class="game-frame" src="/blank-slice/index.html?qa=1" allow="autoplay"></iframe>`;
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

async function run(browser, W, H) {
  const srv = await serve(W, H);
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: W < 600 ? 2 : 1 });
  await context.addInitScript(() => { try { if (location.pathname.includes('/blank-slice/')) localStorage.setItem('synk.blank-slice.v1', JSON.stringify({ v: 1, plays: 3, practiced: true, slow: false, best: null })); } catch { /* 없음 */ } });
  const page = await context.newPage();
  const errors = [], bad = [], felt = new Set();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${new URL(r.url()).pathname}`); });
  page.on('request', (r) => { const u = new URL(r.url()).pathname; if (/mongle|\/felt\/(?!tex)/.test(u)) felt.add(u); });
  await page.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil: 'domcontentloaded' });
  const fr = () => page.frames().find((x) => x.url().includes('/blank-slice/'));
  for (let i = 0; i < 200; i += 1) { if (await fr()?.evaluate(() => !!window.__slice && document.documentElement.classList.contains('w-ready')).catch(() => false)) break; await sleep(100); }
  const shot = (name) => page.screenshot({ path: path.join(OUT, `${W}_${name}.png`) });
  const overflow = () => fr().evaluate(() => { const d = document.documentElement; return { sw: d.scrollWidth, cw: d.clientWidth, over: d.scrollWidth > d.clientWidth + 1, offenders: [...document.querySelectorAll('body *')].filter((n) => { const b = n.getBoundingClientRect(); return !n.closest('.arena,[hidden]') && b.width && b.right > d.clientWidth + 1; }).slice(0, 5).map((n) => n.tagName + '.' + n.className) }; });
  const report = { size: `${W}x${H}`, overflow: {} };
  await sleep(1400); await shot('입구'); report.overflow.입구 = await overflow();
  await fr().evaluate(() => { const r = document.querySelector('.how'); r?.scrollIntoView({ block: 'center' }); }); await sleep(300); await shot('입구_아래');
  await fr().evaluate(() => window.scrollTo(0, 0));
  await sleep(1800); await shot('입구_제목베기후보');
  await fr().evaluate(() => {   // 안내 글과 결과 큰 숫자가 지나간 값을 모은다(숫자가 내려가거나 「조각 · 손가락」이 남으면 보인다)
    window.__seen = { tips: [], rungs: [] };
    new MutationObserver(() => window.__seen.tips.push(document.querySelector('#tip').textContent)).observe(document.querySelector('#tip'), { childList: true, characterData: true, subtree: true });
    new MutationObserver(() => window.__seen.rungs.push(Number(document.querySelector('#r-correct').textContent))).observe(document.querySelector('#r-correct'), { childList: true, characterData: true, subtree: true });
    document.querySelector('#btn-start').click();
  });
  await sleep(1500);
  const keys0 = await fr().evaluate(() => window.__slice.stage()?.gpuInfo(true).keys || []);
  report.programs = { 처음: keys0.length };   // 베기마다 셰이더를 새로 구우면 그 순간 화면이 멈춘다
  const box = await page.locator('iframe.game-frame').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.97);   // 키 입력이 틀 안으로 가게(판 아래쪽 빈 곳 — 긋지 않은 누름은 베지 않는다)
  const cur = () => fr().evaluate(() => ({ ...window.__slice.state().cur, pieces: window.__slice.pieces(), results: window.__slice.state().results.length, qlen: window.__slice.state().queue.length }));
  const waitToss = async () => { for (let k = 0; k < 260; k += 1) { const c = await cur(); if (c?.id && !c.done && c.pieces.length === 4 && c.pieces.every((p) => c.options.includes(p.word) && p.alive)) return c; await sleep(60); } return null; };
  const press = (i) => page.keyboard.press(String(i + 1));
  let n = 0;
  for (;;) {
    const c = await waitToss();
    if (!c) { const res = await fr().evaluate(() => !document.querySelector('#results').hidden); if (!res) errors.push('던지기를 기다리다 멈춤 ' + n); break; }
    await sleep(900);
    if (n === 0) { await shot('놀이_뜬조각'); report.overflow.놀이 = await overflow(); }
    if (n === 2) {   // 틀림 → 해설
      const w = c.pieces.find((p) => p.word !== c.answer); await press(w.index); await sleep(1100); await shot('해설'); report.overflow.해설 = await overflow();
      await fr().evaluate(() => document.querySelector('#btn-next').click());
    } else if (n === 4) {   // 놓침: 두 번 떨어질 때까지 기다린다 → 멈춘 보기
      for (let k = 0; k < 400; k += 1) { if (await fr().evaluate(() => !document.querySelector('#answer-check').hidden)) break; await sleep(100); }
      await sleep(300); await shot('멈춘보기'); report.overflow.멈춘보기 = await overflow();
      await fr().evaluate(() => document.querySelector('#check-options button').click()); await sleep(900); await shot('놓침해설');
      await fr().evaluate(() => document.querySelector('#btn-next').click());
    } else {
      const a = c.pieces.find((p) => p.word === c.answer); await press(a.index); await sleep(n === 1 ? 500 : 200);
      if (n === 1) await shot('맞힘_붙은뒤');
    }
    n += 1;
    if (n === 6) { await page.keyboard.press('Escape'); await sleep(400); await shot('멈춤창'); await fr().evaluate(() => document.querySelector('#resume').click()); }
    await sleep(300);
    if (await fr().evaluate(() => !document.querySelector('#results').hidden)) break;
  }
  for (let k = 0; k < 80; k += 1) { if (await fr().evaluate(() => !document.querySelector('#results').hidden)) break; await sleep(100); }
  await sleep(900); await shot('결과_채점중');
  await sleep(2600); await shot('결과'); report.overflow.결과 = await overflow();
  const doc = await fr().evaluate(() => ({ correct: document.querySelector('#r-correct').textContent, total: document.querySelector('#r-total').textContent, marks: document.querySelectorAll('#r-log li.w-pen').length, items: document.querySelectorAll('#r-log li').length, done: document.querySelector('.big').classList.contains('w-done'), mongle: !!document.querySelector('.hero-mongle,#r-mongle') }));
  report.result = doc;
  const seen = await fr().evaluate(() => ({ ...window.__seen, 글: ['#lobby .how-steps + .fine', '#check-note', '#pause-dialog p', '#x-kicker'].map((s) => document.querySelector(s)?.textContent || '') }));
  report.words = { 조각손가락: [...seen.tips, ...seen.글].filter((t) => /조각|손가락/.test(t)), 안내: [...new Set(seen.tips)].slice(0, 6), 글: seen.글 };
  report.rungs = { 값: seen.rungs, 내려감: seen.rungs.some((v, i) => i && v < seen.rungs[i - 1] && v !== 0) };
  const keys1 = await fr().evaluate(() => window.__slice.stage()?.gpuInfo(true).keys || []);
  report.programs.끝 = keys1.length; report.programs.새것 = keys1.filter((k) => !keys0.includes(k)).map((k) => k.slice(0, 900));
  await page.setViewportSize({ width: W, height: Math.max(H, 1900) }); await fr().evaluate(() => { const f = window.frameElement; f.style.height = '1900px'; window.scrollTo(0, 0); }); await sleep(400); await shot('결과_전체');
  report.errors = errors; report.bad = [...new Set(bad)]; report.felt = [...felt];
  await context.close(); srv.close();
  return report;
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--headless=new', '--autoplay-policy=no-user-gesture-required', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : [])] });
  const all = [];
  for (const [W, H] of SIZES) all.push(await run(browser, W, H));
  await browser.close();
  console.log(JSON.stringify(all, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
