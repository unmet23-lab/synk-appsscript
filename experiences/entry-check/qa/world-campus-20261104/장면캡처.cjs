'use strict';
// 입장 검사 캠퍼스 판 — 판정 한 박자 · 손짓 반응을 정해 둔 순간마다 찍는다(2026-11-04). 영상 전에 레이아웃 · 표정을 눈으로 확인하는 도구.
//   node experiences/entry-check/qa/world-campus-20261104/장면캡처.cjs <출력 폴더> [폭 높이]   (기본 390 844)
const path = require('node:path'), fs = require('node:fs'), http = require('node:http');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const nums = process.argv.slice(3).filter((a) => /^\d+$/.test(a)).map(Number);
const OUT = process.argv[2]; const [W = 390, H = 844] = nums;
const EXP = path.resolve(__dirname, '../../..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const FRAME = `<!doctype html><meta charset=utf-8><style>html,body{margin:0;background:#060709;overflow:hidden}iframe{border:0;display:block;width:${W}px;height:${H}px}</style><iframe class="game-frame" src="/entry-check/?qa=1" allow="autoplay"></iframe>`;
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
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
  const srv = await serve(), BASE = `http://127.0.0.1:${srv.address().port}/`;
  const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 })).newPage();
  const logs = [];
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|vibrate/.test(m.text())) logs.push('console: ' + m.text()); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const fr = () => page.frames().find((x) => x.url().includes('/entry-check/'));
  for (let i = 0; i < 160; i += 1) { if (await fr()?.evaluate(() => document.documentElement.classList.contains('w-ready')).catch(() => false)) break; await sleep(100); }
  let n = 0;
  const shot = async (name) => { n += 1; await page.screenshot({ path: path.join(OUT, `${String(n).padStart(2, '0')}_${name}.jpg`), type: 'jpeg', quality: 82 }); };
  const box = (q) => fr().evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, q);
  const tap = async (q) => { const r = await box(q); await page.mouse.move(r.x, r.y); await page.mouse.down(); await sleep(60); await page.mouse.up(); await page.mouse.move(W - 2, 2); };
  const cur = () => fr().evaluate(() => window.__entry.state().cur);
  const nextGuest = async (last) => { for (let i = 0; i < 80; i += 1) { const c = await cur(); if (c?.id && c.id !== last && !c.done) return c; await sleep(100); } return null; };
  await sleep(1400); await shot('입구');
  await tap('#rec-start'); await sleep(1300); await shot('근무전안내');
  await tap('#btn-begin'); await sleep(1500);
  if (await fr().evaluate(() => !document.querySelector('#coach').hidden)) { await sleep(300); await tap('#coach-skip'); }
  let c = await nextGuest(null); await sleep(750); await shot(`손님옴_${c.id}`);
  await sleep(2600); await shot('말끝');
  await tap('#doc'); await sleep(350); await shot('표누름');
  await sleep(2000);
  const r = await box('.rules li .w-tick'); await page.mouse.move(r.x, r.y); await page.mouse.down(); await page.mouse.up(); await sleep(350); await shot('줄체크');
  await sleep(1800);
  // 통과 도장을 들고 있기 → 도장 줄에 내려놓기(찍히지 않는다)
  const p = await box('#btn-pass'); await page.mouse.move(p.x, p.y); await page.mouse.down(); await sleep(450); await page.mouse.move(p.x - 30, p.y - 240, { steps: 6 }); await sleep(350); await shot('통과도장_듦');
  await page.mouse.move(p.x - 150, p.y, { steps: 4 }); await page.mouse.move((await box('#btn-hint')).x, p.y, { steps: 2 }); await page.mouse.up(); await sleep(400);
  // 첫 손님: 정답대로 판정 — 순간마다
  const judge = async (answer, label) => {
    if (answer === 'pass') { const b = await box('#btn-pass'); await page.mouse.move(b.x, b.y); await page.mouse.down(); await sleep(40); await page.mouse.up(); }
    else { await tap('#btn-reject'); await sleep(450); await shot(`${label}_거절고름`); const b = await box(`#notice .rule[data-rule=${answer}]`); await page.mouse.move(b.x, b.y); await page.mouse.down(); await sleep(40); await page.mouse.up(); }
    await page.mouse.move(W - 2, 2);
    await sleep(70); await shot(`${label}_내려옴`);
    await sleep(40); await shot(`${label}_닿음`);
    await sleep(250); await shot(`${label}_얼굴`);
    await sleep(350); await shot(`${label}_판`);
    await sleep(700); await shot(`${label}_근거`);
  };
  const next = async () => { await fr().evaluate(() => document.querySelector('#feedback').scrollTo?.(0, 0)); await tap('#btn-next'); };
  await judge(c.answer, '맞음1'); await sleep(1500); await shot('맞음1_끝');
  await next(); let last = c.id; c = await nextGuest(last); await sleep(800); await shot(`둘째_${c.id}`); await sleep(2200);
  await judge(c.answer, '맞음2'); await sleep(1000);
  // 셋째: 일부러 틀린다(거절이 정답이면 통과, 통과가 정답이면 거절)
  await next(); last = c.id; c = await nextGuest(last); await sleep(800); await shot(`셋째_${c.id}`); await sleep(2000);
  const rules = await fr().evaluate(() => [...document.querySelectorAll('#notice .rule')].map((x) => x.dataset.rule));
  await judge(c.answer === 'pass' ? rules[0] : 'pass', '틀림'); await sleep(3200); await shot('틀림_사건');
  // 나머지는 맞게 끝까지
  for (let i = 0; i < 12; i += 1) {
    await next(); await sleep(600);
    if (await fr().evaluate(() => !document.querySelector('#results').hidden)) break;
    last = c.id; c = await nextGuest(last); if (!c) break; await sleep(300);
    if (c.answer === 'pass') await tap('#btn-pass'); else { await tap('#btn-reject'); await sleep(200); await tap(`#notice .rule[data-rule=${c.answer}]`); }
    await sleep(800);
  }
  await sleep(2400); await shot('결과');
  await fr().evaluate(() => window.scrollTo(0, 620)); await sleep(500); await shot('결과_아래');
  console.log(JSON.stringify({ n, errors: logs, 판정: await fr().evaluate(() => window.__entry.state().results.map((x) => `${x.caseId} ${x.choice} ${x.correct}`)), world: await fr().evaluate(() => window.__entry.world()?.mood) }, null, 1));
  await browser.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
