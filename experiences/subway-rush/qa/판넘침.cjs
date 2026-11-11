'use strict';
// 고르는 판 넘침 재기(11-11 검수 A1): 실제 여정에 나오는 보기 묶음을 모두 판에 띄우고, 무대 크기를 바꿔 가며 잰다.
//   ① 칸 글 · 화살 · 영문이 칸 밖으로 나가는지(판의 칸은 overflow:hidden이라 넘치면 글이 잘려 보인다 — 화면만 봐서는 안 잡힌다)
//   ② 노선 동그라미가 굵은 말과 겹치는지(검수 -b A3) ③ 질문이 「…」로 잘리는지 ④ 누름 칸(#zones)이 판의 칸 자리를 덮는지(높이 0이면 못 고른다)
//   ⑤ 손짓 안내가 보이는지(무대 폭 306 이상이면 보여야 한다 — 360 · 320 폰, Fable 5.2 P2)
//   node experiences/subway-rush/qa/판넘침.cjs [폭,높이 …] [--cq없음]
//     기본 크기 390×844 · 390×740 · 375×667 · 390×600 · 360×800 · 360×560 · 320×568 · 390×480 · 390×420 · 1366×650 · 가로 폰 932×430 · 844×390 · 667×375 · 740×360
//     --cq없음: style.css의 cqh · cqw를 모르는 단위로 바꾸고 @supports(cq) · @container 묶음을 걷어 cq 단위를 모르는 브라우저(iOS Safari 15.4~15.8)를 흉내 낸다
//   끝 코드 0 문제 없음 · 1 문제 있음(넘침 · 겹침 · 질문 잘림 · 누름 칸 어긋남 · 안내 빠짐 · 페이지 오류)
const path = require('node:path'), fs = require('node:fs'), http = require('node:http');
const ROOT = path.resolve(__dirname, '../../..');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.join(ROOT, 'node_modules')] }));
const EXP = path.join(ROOT, 'experiences');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
const args = process.argv.slice(2), NO_CQ = args.includes('--cq없음');
const given = args.filter((a) => /^\d+,\d+$/.test(a));
const SIZES = (given.length ? given : ['390,844', '390,740', '375,667', '390,600', '360,800', '360,560', '320,568', '390,480', '390,420', '1366,650', '932,430', '844,390', '667,375', '740,360']).map((s) => s.split(',').map(Number));   // 끝 넷은 가로로 눕힌 폰
const srv = http.createServer((req, res) => {
  let file = path.join(EXP, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(EXP) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  let body = fs.readFileSync(file);
  if (NO_CQ && path.basename(file) === 'style.css') {
    // 모르는 단위(qqh)로 바꾸면 그 선언은 버려지고(var()가 든 선언은 계산 때 무효), cq 묶음 · 컨테이너 묶음은 통째로 없다
    body = Buffer.from(body.toString('utf8').replace(/@supports \(height:1cqh\)\{[^{}]*\{[^{}]*\}\}/g, '').replace(/@container \([^)]*\)\{(?:[^{}]*\{[^{}]*\})*\}/g, '').replace(/cq([hw])/g, 'qq$1'));
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body);
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
  const count = { 넘친칸: 0, 질문잘림: 0, 누름칸어긋남: 0, 안내빠짐: 0 };
  const out = [];
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(250);
    // 입구가 떠 있는 동안 낮은 창은 무대를 옆 배치로 넓힌다(data-lobby-fit) — 게임 중 무대로 재려고 그 표시를 걷는다
    await page.evaluate(() => { document.documentElement.removeAttribute('data-lobby-fit'); document.getElementById('lobby').hidden = true; });
    await page.waitForTimeout(80);
    for (const s of sets) {
      await page.evaluate((s) => { const p = window.__subway.panel; document.getElementById('zones').hidden = false; p.show(s.kind, s.options, { line: s.line, hint: '누르거나 밀어요' }); }, s);
      await page.waitForTimeout(950);
      const r = await page.evaluate(() => {
        const pick = document.getElementById('pick'), q = pick.querySelector('.pk-q'), hint = pick.querySelector('.pk-hint');
        const cells = [...pick.querySelectorAll('.pk-opt')].map((o) => {
          const R = o.getBoundingClientRect();
          const over = [...o.querySelectorAll('*')].filter((c) => getComputedStyle(c).display !== 'none').map((c) => c.getBoundingClientRect()).filter((b) => b.width && (b.bottom > R.bottom + 0.5 || b.right > R.right + 0.5)).length;
          const L = o.querySelector('.pk-line')?.getBoundingClientRect(), B = o.querySelector('.pk-big')?.getBoundingClientRect();
          const hit = L && B && L.width && !(L.right <= B.left || B.right <= L.left || L.bottom <= B.top || B.bottom <= L.top) ? 1 : 0;
          return { over: over + hit, text: o.textContent.trim().slice(0, 24) };
        });
        const st = document.getElementById('stage').getBoundingClientRect(), zs = document.getElementById('zones').getBoundingClientRect(), op = pick.querySelector('.pk-opts').getBoundingClientRect();
        // 누름 칸이 판의 칸 자리를 덮는가(위아래 2px 안) — 높이 0이면 고를 수 없다
        const zonesOk = zs.height > 40 && Math.abs(zs.top - op.top) <= 2 && zs.bottom >= op.bottom - 2 - parseFloat(getComputedStyle(pick.querySelector('.pk-opts')).paddingBottom || 0);
        return { cells, qCut: q.scrollWidth > q.clientWidth + 1, hintShown: !!hint && getComputedStyle(hint).display !== 'none' && hint.getBoundingClientRect().width > 0, stageW: Math.round(st.width), stage: Math.round(st.height), zonesOk, zh: Math.round(zs.height) };
      });
      const cut = r.cells.filter((c) => c.over).map((c) => c.text);
      count.넘친칸 += cut.length;
      if (r.qCut) count.질문잘림 += 1;
      if (!r.zonesOk) count.누름칸어긋남 += 1;
      const hintMissing = r.stageW >= 306 && !r.hintShown;
      if (hintMissing) count.안내빠짐 += 1;
      const notes = [cut.length ? '넘침: ' + cut.join(' · ') : '들어감', r.qCut ? '질문 잘림(…)' : '', r.zonesOk ? '' : `누름 칸 어긋남(높이 ${r.zh})`, hintMissing ? '손짓 안내 빠짐' : r.hintShown ? '' : '(무대가 좁아 손짓 안내는 뺌)'].filter(Boolean);
      out.push(`${w}×${h}(무대 ${r.stageW}×${r.stage}) ${s.kind} ${s.options.map((o) => o.text || o.exit).join(' / ')} — ${notes.join(' · ')}`);
      await page.evaluate(() => window.__subway.panel.hide());
      await page.waitForTimeout(80);
    }
  }
  console.log(out.join('\n'));
  const bad = count.넘친칸 + count.질문잘림 + count.누름칸어긋남 + count.안내빠짐;
  console.log(JSON.stringify({ 묶음: sets.length, 크기: SIZES.length, cq없음: NO_CQ, ...count, errors }));
  await browser.close(); srv.close();
  process.exit(bad || errors.length ? 1 : 0);
});
