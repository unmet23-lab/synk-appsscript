'use strict';
// 빈칸 베기 캠퍼스 판(2026-11-04) — LAB 단독 화면이 그대로인지 잰다: 기준(git HEAD 또는 BASE_REF의 blank-slice)과 지금 작업본을 같은 헤드리스 크롬에서 차례로 열어
// 입구 · 놀이 · 해설 · 결과의 계산 스타일(모든 요소) · 본문 DOM · 입구 · 결과 픽셀과, 3D 판의 픽셀을 견준다. 주문 폭주 lab-proof.cjs에 시계를 더했다:
// 3D 조각은 던지는 순간의 시각이 판마다 달라 그대로 찍으면 기준끼리도 다르다(SAME=1로 확인) → 게임 흐름을 멈추고(__slice.hold) Playwright 시계 · 고정 난수로
// 같은 낱말을 직접 던져 같은 순간을 찍는다(펠트 조각 · 베인 두 쪽 · 부스러기 · 칼빛까지 같아야 한다). 떠오르는 점수 글자의 자리값(#pop)과 낭독 글(#sr-live — 보기 순서가
// 기준끼리도 갈린다)은 DOM 견줌에서 뺀다. 픽셀은 16단계 넘게 다른 점만 센다 — 글자 가장자리는 기준끼리도 미세하게 갈린다(2,000점 안팎 · 차이 16 이하).
// WORLD 겉(world-*.mjs · world-skin.css · app.mjs · stage.mjs의 world/look 갈래)은 data-host=world일 때만 걸리므로 차이는 0이어야 한다.
// 머리(head)의 새 줄 둘(world-host.js · world-skin.css)은 일부러 더한 것이라 본문 DOM 견줌에 들지 않는다.
//   node experiences/blank-slice/qa/world-campus-20261104/lab-proof.cjs   (BASE_REF=<커밋> 으로 기준을 바꾼다) → 공용 작업본 .tmp/blank-slice-world-20261104/lab-proof.json
const path = require('node:path'), fs = require('node:fs'), os = require('node:os'), http = require('node:http');
const { execFileSync, spawnSync } = require('node:child_process');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const { 화면시험, 닫기 } = require('../../../../tools/lib/화면시험.cjs');
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../../..');
const GAME = path.join(ROOT, 'experiences/blank-slice');
const REF = process.env.BASE_REF || 'HEAD';
const OUT = path.join(공용작업본(ROOT), '.tmp', 'blank-slice-world-20261104');

function extractBase() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blank-base-'));
  const tar = path.join(dir, 'base.tar');
  execFileSync('git', ['-C', ROOT, 'archive', '--format=tar', '-o', tar, REF, 'experiences/blank-slice'], { stdio: 'inherit' });
  execFileSync('tar', ['-xf', 'base.tar'], { cwd: dir, stdio: 'inherit' });   // 경로를 넘기면 GNU tar가 「C:」를 원격 주소로 읽는다
  return path.join(dir, 'experiences/blank-slice');
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
function serve(dir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      try {
        let p = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
        if (!p.startsWith(dir)) throw 0;
        if (fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(fs.readFileSync(p));
      } catch { res.writeHead(404).end(); }
    }).listen(0, '127.0.0.1', () => resolve(server));
  });
}
const SNAP = () => {
  const props = ['display', 'position', 'width', 'height', 'top', 'left', 'margin', 'padding', 'color', 'background-color', 'background-image', 'font-family', 'font-size', 'font-weight', 'line-height', 'border-radius', 'box-shadow', 'clip-path', 'opacity', 'transform'];
  const out = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest('[hidden]') && el.tagName !== 'DIALOG') continue;
    if (el.closest('.spark,.fly-chip,#pop')) continue;   // 움직이는 중인 덧그림은 픽셀로 본다
    const cs = getComputedStyle(el);
    out.push(el.tagName + (el.id ? '#' + el.id : '') + '|' + props.map((p) => cs.getPropertyValue(p)).join('|'));
  }
  return { styles: out, body: document.body.innerHTML.replace(/(id="pop"[^>]*?) style="[^"]*"/, '$1').replace(/(id="sr-live"[^>]*>)[^<]*/, '$1'), host: document.documentElement.dataset.host || null };
};
const origin = (v) => (v || '').replace(/http:\/\/127\.0\.0\.1:\d+/g, '');   // 두 서버의 포트만 다르다
/** 두 그림에서 16단계 넘게 다른 점의 수. */
function bigDiff(a, b) {
  if (a.equals(b)) return 0;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blank-px-')), x = path.join(dir, 'a.png'), y = path.join(dir, 'b.png');
  fs.writeFileSync(x, a); fs.writeFileSync(y, b);
  const py = 'import sys\nfrom PIL import Image, ImageChops\na=Image.open(sys.argv[1]).convert("RGB");b=Image.open(sys.argv[2]).convert("RGB")\nprint(-1 if a.size!=b.size else sum(ImageChops.difference(a,b).convert("L").histogram()[17:]))';
  const r = spawnSync('python', ['-I', '-X', 'utf8', '-c', py, x, y], { encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });
  const n = Number(r.stdout.trim());
  return Number.isFinite(n) && r.status === 0 ? (n < 0 ? 1e9 : n) : 1e9;
}

async function capture(browser, base, view) {
  const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  await ctx.addInitScript(() => {
    let n = 7; Math.random = () => { n = (n * 16807) % 2147483647; return n / 2147483647; };   // 판마다 같은 차례 · 같은 조각 색
    window.__reseed = () => { n = 7; };
    try { localStorage.clear(); localStorage.setItem('synk.blank-slice.v1', JSON.stringify({ v: 1, plays: 0, practiced: true, slow: false, best: null })); } catch { /* 없음 */ }
  });
  const page = await ctx.newPage(), errors = [], shots = {}, snaps = {};
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.clock.install({ time: new Date('2026-11-04T03:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-04T03:00:01Z'));   // 설치만 하면 진짜 시간으로 계속 흐른다 — 멈춰야 runFor만큼만 간다
  await page.goto(base + 'index.html?qa=1', { waitUntil: 'domcontentloaded' });
  const run = (ms) => page.clock.runFor(ms);
  for (let i = 0; i < 80; i += 1) { await run(100); if (await page.evaluate(() => !!window.__slice && !document.querySelector('#lobby').hidden)) break; await page.waitForTimeout(40); }
  await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((i) => (i.complete ? null : i.decode().catch(() => null)))]));
  for (let i = 0; i < 40; i += 1) { await run(100); await page.waitForTimeout(10); }
  const take = async (name, shot = false) => { snaps[name] = await page.evaluate(SNAP); if (shot) shots[name] = await page.screenshot({ fullPage: name === '입구' }); };
  await take('입구', true);
  await page.evaluate(() => document.querySelector('#btn-start').click());
  const state = () => page.evaluate(() => ({ ...window.__slice.state().cur, pieces: window.__slice.pieces(), results: window.__slice.state().results.length, over: !document.querySelector('#results').hidden, stageOn: !!window.__slice.stage() }));
  const waitToss = async () => { for (let k = 0; k < 300; k += 1) { await run(50); const c = await state(); if (c.over) return c; if (c.id && !c.done && c.pieces.length === 4 && c.pieces.every((p) => c.options.includes(p.word) && p.alive)) return c; await page.waitForTimeout(5); } throw new Error('던지기를 기다리다 멈춤'); };
  const cut = (i) => page.evaluate((n) => window.__slice.stage().sliceIndex(n), i);
  let c = await waitToss();
  await run(900); await page.waitForTimeout(150); await take('놀이');
  await cut(c.pieces.find((p) => p.word === c.answer).index);
  await run(1400);
  c = await waitToss(); await run(700);
  await cut(c.pieces.find((p) => p.word !== c.answer).index);   // 틀림 → 해설
  await run(900); await page.waitForTimeout(150); await take('해설');
  await page.evaluate(() => document.querySelector('#btn-next').click());
  for (let guard = 0; guard < 16; guard += 1) {
    c = await waitToss();
    if (c.over) break;
    await run(500);
    await cut(c.pieces.find((p) => p.word === c.answer).index);
    await run(1400); await page.waitForTimeout(10);
    if ((await state()).over) break;
  }
  for (let i = 0; i < 30; i += 1) { await run(200); await page.waitForTimeout(10); }
  await take('결과', true);
  await ctx.close();
  // 시계가 멈춰 있어도 PC가 바쁘면 찍는 시각이 1~3ms 밀려(CPU 90%에서 실측) 조각 자리 · 칼빛이 갈린다 — 정해진 시각에 정확히 찍힌 판만 쓴다
  const AT = { 뜬조각: 300501, 벤직후: 300501, 벤순간: 300531, 벌어짐: 300881 };
  let got = null;
  for (let tries = 0; tries < 15; tries += 1) {
    got = await capture3d(browser, base, view, errors);
    if (Object.entries(AT).every(([k, v]) => JSON.parse(got.traces[k]).now === v)) break;
  }
  Object.assign(shots, got.shots);
  return { snaps, shots, errors, traces: got.traces };
}

async function capture3d(browser, base, view, errors) {
  const shots = {};
  // 3D 판: 흐름을 멈추고 같은 낱말을 같은 시각에 던진다 — 뜬 조각 · 벤 순간(칼빛 · 두 쪽) · 그 뒤(벌어짐 · 부스러기)
  const ctx3 = await browser.newContext({ viewport: view, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  await ctx3.addInitScript(() => {
    let n = 7; Math.random = () => { n = (n * 16807) % 2147483647; return n / 2147483647; };
    window.__reseed = () => { n = 7; };
    try { localStorage.clear(); localStorage.setItem('synk.blank-slice.v1', JSON.stringify({ v: 1, plays: 1, practiced: true, slow: false, best: null })); } catch { /* 없음 */ }
  });
  const p3 = await ctx3.newPage();
  p3.on('pageerror', (e) => errors.push(String(e)));
  await p3.clock.install({ time: new Date('2026-11-04T03:00:00Z') });
  await p3.clock.pauseAt(new Date('2026-11-04T03:00:01Z'));
  await p3.goto(base + 'index.html?qa=1', { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 80; i += 1) { await p3.clock.runFor(100); if (await p3.evaluate(() => !!window.__slice && !document.querySelector('#lobby').hidden)) break; await p3.waitForTimeout(40); }
  await p3.evaluate(() => document.querySelector('#btn-start').click());
  for (let i = 0; i < 200; i += 1) { await p3.clock.runFor(50); if (await p3.evaluate(() => !!window.__slice.stage())) break; await p3.waitForTimeout(20); }
  await p3.addStyleTag({ content: '.sentence,.tip,.pop,.explain,.game-bar{visibility:hidden!important}' });
  await p3.clock.pauseAt(new Date('2026-11-04T03:05:00Z'));   // 무대 준비에 걸린 시간이 판마다 달라도 같은 시각에서 던진다(시각이 2ms만 달라도 칼빛 투명도가 달랐다)
  await p3.evaluate(() => { window.__slice.hold(); const st = window.__slice.stage(); st.clear(); st.setShowNumbers(false); st.setTopPx(120); window.__reseed(); st.toss([{ word: '빵', n: 1 }, { word: '물', n: 2 }, { word: '옷', n: 3 }, { word: '안 했어요', n: 4 }], { hang: 3.6 }); });
  const trace = (name) => p3.evaluate(() => JSON.stringify({ now: performance.now(), r: Math.random(), at: [0, 1, 2, 3].map((i) => window.__slice.pieceScreen(i)), gpu: window.__slice.stage().gpuInfo() })).then((t) => { traces[name] = t; });
  const traces = {};
  await p3.clock.runFor(1500); await p3.waitForTimeout(250);
  shots.판_뜬조각 = await p3.screenshot(); await trace('뜬조각');
  await p3.evaluate(() => { window.__reseed(); window.__slice.stage().sliceIndex(1); });
  await trace('벤직후');
  await p3.clock.runFor(30); await p3.waitForTimeout(250);
  shots.판_벤순간 = await p3.screenshot(); await trace('벤순간');
  await p3.clock.runFor(350); await p3.waitForTimeout(250);
  shots.판_벌어짐 = await p3.screenshot(); await trace('벌어짐');
  await ctx3.close();
  return { shots, traces };
}
function diff(a, b) {
  const n = Math.max(a.length, b.length), rows = [];
  for (let i = 0; i < n; i += 1) if (origin(a[i]) !== origin(b[i])) rows.push({ i, base: a[i], now: b[i] });
  return rows;
}

화면시험({ 분: 20 }, async () => {
  const baseDir = extractBase();
  // SAME=1: 기준끼리 견준다 — 재는 방식 자체의 흔들림을 본다(이때 차이가 나면 도구 탓이다)
  const [s1, s2] = await Promise.all([serve(baseDir), serve(process.env.SAME ? baseDir : GAME)]);
  const url = (s) => `http://127.0.0.1:${s.address().port}/`;
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const report = { ref: REF, views: [] };
  let bad = 0;
  for (const view of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const a = await capture(browser, url(s1), view), b = await capture(browser, url(s2), view);
    const row = { view: `${view.width}x${view.height}`, host: b.snaps.입구.host, screens: {}, errors: [...a.errors, ...b.errors] };
    for (const name of new Set([...Object.keys(a.snaps), ...Object.keys(a.shots)])) {
      const style = a.snaps[name] ? diff(a.snaps[name].styles, b.snaps[name].styles) : [];
      const dom = a.snaps[name] ? (origin(a.snaps[name].body) === origin(b.snaps[name].body) ? 0 : 1) : 0;
      const pixels = !a.shots[name] ? 0 : bigDiff(a.shots[name], b.shots[name]);
      const firstDom = () => { const x = origin(a.snaps[name].body), y = origin(b.snaps[name].body); let i = 0; while (i < x.length && x[i] === y[i]) i += 1; return [x.slice(Math.max(0, i - 60), i + 60), y.slice(Math.max(0, i - 60), i + 60)]; };
      row.screens[name] = { 스타일: style.length, DOM: dom, 픽셀: pixels, ...(style.length ? { 예: style.slice(0, 2) } : {}), ...(dom ? { DOM예: firstDom() } : {}) };
      bad += style.length + dom + pixels;
      if (pixels) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, `lab_${view.width}_${name}_기준.png`), a.shots[name]); fs.writeFileSync(path.join(OUT, `lab_${view.width}_${name}_지금.png`), b.shots[name]); }
    }
    row.traces = Object.fromEntries(Object.keys(a.traces).map((k) => [k, a.traces[k] === b.traces[k] ? '같음' : { 기준: a.traces[k], 지금: b.traces[k] }]));
    bad += row.errors.length + (row.host ? 1 : 0);
    report.views.push(row);
  }
  await 닫기(browser); s1.close(); s2.close();
  report.ok = bad === 0;
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'lab-proof.json'), JSON.stringify(report, null, 1) + '\n');
  console.log(JSON.stringify(report, null, 1));
  process.exitCode = bad ? 1 : 0;
});
