'use strict';
// 고르는 판 넘침 재기(11-11 검수 A1): 실제 여정에 나오는 보기 묶음을 모두 판에 띄우고, 무대 높이를 바꿔 가며 칸 글 · 화살 · 영문이 칸 밖으로 나가는지 잰다.
// 판의 칸은 overflow:hidden이라 넘치면 글이 잘려 보인다 — 화면만 봐서는 안 잡힌다(맹검 · 시험이 못 봄).
//   node experiences/subway-rush/qa/판넘침.cjs [폭,높이 …]   기본 390×844 · 390×740 · 375×667 · 390×600 · 360×560 · 390×480 · 390×420 · 1366×650
//   끝 코드 0 넘침 없음 · 1 넘침 있음
const path = require('node:path'), fs = require('node:fs'), http = require('node:http');
const ROOT = path.resolve(__dirname, '../../..');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.join(ROOT, 'node_modules')] }));
const EXP = path.join(ROOT, 'experiences');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
const SIZES = (process.argv.slice(2).length ? process.argv.slice(2) : ['390,844', '390,740', '375,667', '390,600', '360,560', '390,480', '390,420', '1366,650']).map((s) => s.split(',').map(Number));
const srv = http.createServer((req, res) => {
  let file = path.join(EXP, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(EXP) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(fs.readFileSync(file));
});
srv.listen(0, '127.0.0.1', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--headless=new'] });   // GPU 가속 판은 창 크기를 여러 번 바꾸면 탭이 죽었다(11-11) — 판 글만 재므로 소프트웨어 그리기로
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/subway-rush/index.html?qa=1&seed=21`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => !!window.__subway?.panel, null, { timeout: 90000 });
  // 실제 여정의 보기 묶음(결정 종류마다 겹치지 않게)
  const sets = await page.evaluate(async () => {
    const { buildJourney } = await import('./journeys.mjs');
    const { LINES } = await import('./lines.mjs');
    const kindOf = (d) => (d.kind === 'stop' ? 'door' : d.kind === 'exit' ? 'exit' : d.kind === 'fork' ? 'fork' : 'board');
    const seen = new Map();
    for (const level of ['basic', 'busy']) for (let seed = 1; seed <= 80; seed++) for (const d of buildJourney({ seed, level }).decisions) {
      const key = kindOf(d) + '|' + d.options.map((o) => o.text || o.exit).join('/');
      if (!seen.has(key)) seen.set(key, { kind: kindOf(d), options: d.options, line: LINES[d.line || 1]?.color || '#00A84D' });
    }
    return [...seen.values()];
  });
  let bad = 0;
  const out = [];
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(250);
    for (const s of sets) {
      await page.evaluate((s) => { const p = window.__subway.panel; p.show(s.kind, s.options, { line: s.line, hint: '누르거나 밀어요' }); }, s);
      await page.waitForTimeout(950);
      const r = await page.evaluate(() => {
        const pick = document.getElementById('pick'), q = pick.querySelector('.pk-q');
        const cells = [...pick.querySelectorAll('.pk-opt')].map((o) => {
          const R = o.getBoundingClientRect();
          const over = [...o.querySelectorAll('*')].filter((c) => getComputedStyle(c).display !== 'none').map((c) => c.getBoundingClientRect()).filter((b) => b.width && (b.bottom > R.bottom + 0.5 || b.right > R.right + 0.5)).length;
          return { over, text: o.textContent.trim().slice(0, 24) };
        });
        return { cells, qCut: q.scrollWidth > q.clientWidth + 1, stage: Math.round(document.getElementById('stage').getBoundingClientRect().height) };
      });
      const cut = r.cells.filter((c) => c.over).map((c) => c.text);
      if (cut.length) bad += cut.length;
      out.push(`${w}×${h}(무대 ${r.stage}) ${s.kind} ${s.options.map((o) => o.text || o.exit).join(' / ')} — ${cut.length ? '넘침: ' + cut.join(' · ') : '들어감'}${r.qCut ? ' · 질문 잘림(…)' : ''}`);
      await page.evaluate(() => window.__subway.panel.hide());
      await page.waitForTimeout(80);
    }
  }
  console.log(out.join('\n'));
  console.log(JSON.stringify({ 묶음: sets.length, 크기: SIZES.length, 넘친칸: bad, errors }));
  await browser.close(); srv.close();
  process.exit(bad || errors.length ? 1 : 0);
});
