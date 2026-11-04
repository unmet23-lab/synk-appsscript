'use strict';
// MT 바닷가 레이스 시안 — 장면을 정해 찍는다(설계 4 · 13절 「꼭 넣어 재는 것」). 게임을 WORLD 틀(.game-frame)에서 실제 WebGL로 돌리고,
// 기다리는 구간은 ?qa 빨리 감기로 줄인다. 앱 안 브라우저 칸이 숨어 있으면 게임이 멈추므로(visibilitychange) 설치된 Edge를 헤드리스 · 실제 GPU로 띄운다.
//   node experiences/korean-racing/qa/world-mt-20261104/장면.cjs [city|hybrid] [폭x높이 …]   (기본 city · 390x844 844x390 1440x900)
//   나가는 것: 공용 작업본 .tmp/world-mt-20261104/장면/<결>_<폭>_<장면>.jpg + 장면.json(겹침 · 오류 · 프레임)
const path = require('node:path'), fs = require('node:fs'), http = require('node:http');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../..');
const args = process.argv.slice(2), style = args.find((a) => /^(city|hybrid)$/.test(a)) || 'city';
const sizes = args.filter((a) => /^\d+x\d+$/.test(a)).map((a) => a.split('x').map(Number));
if (!sizes.length) sizes.push([390, 844], [844, 390], [1440, 900]);
const only = args.filter((a) => a.startsWith('--장면=')).map((a) => a.split('=')[1]);
const OUT = path.join(공용작업본(path.resolve(__dirname, '../../../..')), '.tmp', 'world-mt-20261104', '장면');
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.hdr': 'application/octet-stream' };
const serve = () => new Promise((resolve) => { const srv = http.createServer((req, res) => { const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); let file = path.join(ROOT, u); if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; } if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(fs.readFileSync(file)); }); srv.listen(0, '127.0.0.1', () => resolve(srv)); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--headless=new', '--autoplay-policy=no-user-gesture-required', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
  const srv = await serve(), BASE = `http://127.0.0.1:${srv.address().port}`, report = [];
  for (const [W, H] of sizes) {
    const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: W < 700 ? 2 : 1, isMobile: false, hasTouch: W < 700 });
    const page = await context.newPage(), logs = [];
    page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') logs.push('console: ' + m.text()); });
    page.on('requestfailed', (r) => logs.push('failed: ' + r.url()));
    page.on('response', (r) => { if (r.status() >= 400) logs.push(`${r.status()}: ${r.url()}`); });
    await page.addInitScript(() => { try { localStorage.setItem('SYNK_RACING_TUTORIAL_V1', JSON.stringify({ version: 1, completed: true })); } catch { /* 틀 밖 */ } });
    await page.goto(`${BASE}/qa/world-mt-20261104/틀.htm?qa&bike=${style}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    const fr = () => page.frames().find((x) => x.url().includes('/index.html'));
    for (let i = 0; i < 400; i++) { if (await fr()?.evaluate(() => window.__racingQA?.state().ready).catch(() => false)) break; await sleep(250); }
    const shot = async (name, extra = {}) => {
      if (only.length && !only.includes(name)) return;
      await sleep(500);
      const file = path.join(OUT, `${style}_${W}_${name}.jpg`);
      await page.screenshot({ path: file, type: 'jpeg', quality: 86 });
      const data = await fr().evaluate(() => { const q = window.__racingQA, l = q.layout(), s = q.state(), r = q.round, rig = q.rig; return { layout: l, speed: document.getElementById('speed').textContent, rank: document.getElementById('rank').textContent, boost: s.boost, velocity: s.velocity, road: rig.worldS(r.playerS), slope: rig.slopeAt(rig.worldS(r.playerS)), gaps: rig.rivals.map((x) => rig.worldS(x.s) - rig.worldS(r.playerS)), render: q.render() }; });
      report.push({ size: `${W}x${H}`, name, ...extra, ...data });
    };
    await shot('입구');
    if (only.includes('코스창')) { await fr().evaluate(() => document.getElementById('choose-course').click()); await sleep(500); await shot('코스창'); await fr().evaluate(() => document.getElementById('course-close').click()); await sleep(200); }
    await fr().evaluate(() => document.getElementById('watch').click());   // 자동 시연(기록 없음)으로 장면을 잡는다
    for (let i = 0; i < 120; i++) { if (await fr().evaluate(() => window.__racingQA.state().running)) break; await sleep(250); }
    await sleep(900); await shot('출발');
    const go = (fn, arg) => fr().evaluate(fn, arg);
    // 첫 게이트 앞: 음성 대기(상대는 한 발을 내리고 기다린다)
    await go(() => { const q = window.__racingQA; for (let i = 0; i < 60 && !q.state().gate?.announced; i++) q.advance(.5); q.advance(3.2); });
    await sleep(500); await shot('게이트앞');
    // 고개를 넘어 정답 → 내리막 질주
    await go(() => { const q = window.__racingQA; q.hearNow(); for (let i = 0; i < 80 && q.state().boost <= 0; i++) q.advance(.25); q.advance(.9); });
    await sleep(900); await shot('내리막질주');
    // 뒤 6m · 추월 2m(상대 자리만 옮겨 찍는다)
    // 부스터를 길게 잡고 상대 속도를 내 속도와 맞춰 찍는 동안 거리가 그대로 있게 한다.
    const place = (a, b) => go(([a, b]) => { const q = window.__racingQA, r = q.round; r.boost = 99; const [t, h] = q.rig.rivals; t.speed = h.speed = r.velocity; t.s = r.playerS + a[0]; t.offset = r.playerOffset + a[1]; h.s = r.playerS + b[0]; h.offset = r.playerOffset + b[1]; }, [a, b]);
    await place([15, .9], [60, -2.4]); await sleep(900); await shot('뒤6m');
    if (only.includes('입구그림')) { await fr().evaluate(() => { const s = document.createElement('style'); s.textContent = '#game .game-bar,#game .top-stack,#lane-choices,#pop,#boost-meter,#dash,.w-tag{visibility:hidden!important}'; document.head.append(s); }); await place([22, .9], [46, -2.4]); await sleep(1600); await page.screenshot({ path: path.join(OUT, `입구그림_${W}.jpg`), type: 'jpeg', quality: 92 }); }
    await place([6, 1.6], [34, -2.2]); await sleep(500); await shot('옆2m');
    await place([1.5, -1.5], [12, 1.4]); await sleep(500); await shot('스침');
    // 멈춤 창: 자전거 고르기 카드가 소리 켜기 앞에 있다
    if (!only.length || only.includes('멈춤창')) { await fr().evaluate(() => document.getElementById('pause').click()); await sleep(400); await shot('멈춤창'); await fr().evaluate(() => document.getElementById('pause-dialog')?.close?.()); }
    // 결과 셋: 실제 시작 단추로 한 판을 끝까지 달려(답은 고른 차선에 맞춰) 꼴찌를 정해 찍는다. 기록은 이 임시 문맥 안에만 남는다.
    for (const [이름, 자리] of [['결과1등', { taeo: -40, harin: -10 }], ['결과2등', { taeo: 30, harin: -30 }], ['결과3등', { taeo: 40, harin: 20 }]]) {
      if (!only.length ? false : !only.includes(이름) && !only.includes('결과') && !(이름 === '결과1등' && only.includes('결과뒤'))) continue;
      await page.goto(`${BASE}/qa/world-mt-20261104/틀.htm?qa&bike=${style}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      for (let i = 0; i < 400; i++) { if (await fr()?.evaluate(() => window.__racingQA?.state().ready).catch(() => false)) break; await sleep(250); }
      await fr().evaluate(() => document.getElementById('start').click());
      for (let i = 0; i < 120; i++) { if (await fr().evaluate(() => window.__racingQA.state().running)) break; await sleep(250); }
      const 끝 = await fr().evaluate(async (자리) => {
        const q = window.__racingQA, r = q.round, LANES = [-3.45, 0, 3.45];
        for (let i = 0; i < 4000 && !r.finished; i++) {
          const g = q.state().gate;
          if (g && !g.judged) { if (g.announced && !g.heard) q.hearNow(); r.playerOffset = LANES[g.types.indexOf(g.answer)] ?? r.playerOffset; const go = document.getElementById('go'); if (go && !go.hidden && !go.disabled) go.click(); }
          for (const b of q.rig.rivals) b.s = r.playerS + 자리[b.who];
          q.advance(.25);
        }
        return { finished: r.finished, correct: r.correct, banner: q.rig.props.finish.visible, road: Math.round(q.rig.worldS(r.playerS)), last: Object.fromEntries(q.rig.rivals.map((b) => [b.who, Math.round(b.s - r.playerS)])) };
      }, 자리);
      await sleep(1000);
      if (only.includes('결과뒤') && 이름 === '결과1등') { for (let i = 0; i < 6; i++) { await sleep(1000); report.push({ size: `${W}x${H}`, name: '현수막상태', t: i, ...(await fr().evaluate(() => { const q = window.__racingQA; return { banner: q.rig.props.finish.visible, road: Math.round(q.rig.worldS(q.round.playerS)) }; })) }); } }
      if (이름 === '결과1등') { const file = path.join(OUT, `${style}_${W}_숙소도착.jpg`); await page.screenshot({ path: file, type: 'jpeg', quality: 86 }); }
      await fr().evaluate(() => document.getElementById('cruise-results')?.click());
      await sleep(1800);
      report.push({ size: `${W}x${H}`, name: 이름 + '_상태', ...끝 });
      if (only.length) { const file = path.join(OUT, `${style}_${W}_${이름}.jpg`); await page.screenshot({ path: file, type: 'jpeg', quality: 86 }); report.push({ size: `${W}x${H}`, name: 이름, title: await fr().evaluate(() => document.getElementById('r-title').textContent), stake: await fr().evaluate(() => document.querySelector('.w-res-stake')?.textContent), src: await fr().evaluate(() => document.querySelector('.w-res-photo')?.getAttribute('src')) }); }
      // 결과 다음: 바닷길로 돌아갔다 와서 같은 코스를 다시 달린다(자전거 · 소리 · 상대가 처음 상태로 돌아오는가)
      if (이름 === '결과1등' && only.includes('결과뒤')) {
        const file = (label) => path.join(OUT, `${style}_${W}_${label}.jpg`);
        await fr().evaluate(() => document.getElementById('return-cruise').click());
        for (const ms of [1000, 4000, 9000]) { await sleep(ms === 1000 ? 1000 : ms === 4000 ? 3000 : 5000); await page.screenshot({ path: file('바닷길' + ms), type: 'jpeg', quality: 80 }); }
        report.push({ size: `${W}x${H}`, name: '바닷길', ...(await fr().evaluate(() => { const shade = [...document.querySelectorAll('#game, #arena, #game canvas, .curtain, #curtain')].map((n) => [n.id || n.className, getComputedStyle(n).opacity, getComputedStyle(n).filter].join(':')); const q = window.__racingQA; return { shade, classes: document.getElementById('game').className, paused: q.round.paused, running: q.round.running, driving: q.state().coast, cruise: !document.getElementById('cruise-banner').hidden }; })) });
        await fr().evaluate(() => document.getElementById('cruise-results').click()); await sleep(1500);
        await fr().evaluate(() => document.getElementById('replay').click()); await sleep(4000);
        await page.screenshot({ path: file('다시달리기'), type: 'jpeg', quality: 86 });
        report.push({ size: `${W}x${H}`, name: '다시달리기', ...(await fr().evaluate(() => { const q = window.__racingQA, r = q.round; return { running: r.running, finished: r.finished, gateIndex: r.gateIndex, playerS: Math.round(r.playerS), velocity: Math.round(r.velocity), rivals: q.rig.rivals.map((b) => Math.round(b.s - r.playerS)), rank: document.getElementById('rank').textContent, title: document.getElementById('r-title')?.textContent }; })) });
      }
    }
    // 첫 조작 연습: 기록이 없는 새 문맥에서 시작을 눌러 첫 화면을 찍는다
    if (only.includes('연습')) {
      await fr().evaluate(() => { try { localStorage.removeItem('SYNK_RACING_TUTORIAL_V1'); } catch { /* 틀 밖 */ } });
      await context.clearCookies();
      await page.addInitScript(() => { try { localStorage.removeItem('SYNK_RACING_TUTORIAL_V1'); } catch { /* 틀 밖 */ } });
      await page.goto(`${BASE}/qa/world-mt-20261104/틀.htm?qa&bike=${style}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      for (let i = 0; i < 400; i++) { if (await fr()?.evaluate(() => window.__racingQA?.state().ready).catch(() => false)) break; await sleep(250); }
      await fr().evaluate(() => document.getElementById('start').click());
      for (let i = 0; i < 120; i++) { if (await fr().evaluate(() => window.__racingQA.state().running)) break; await sleep(250); }
      await sleep(3000); await shot('연습');
    }
    report.push({ size: `${W}x${H}`, logs: [...new Set(logs)] });
    await context.close();
  }
  await browser.close(); srv.close();
  fs.writeFileSync(path.join(OUT, `${style}_장면.json`), JSON.stringify(report, null, 1));
  const issues = report.filter((r) => r.logs?.length);
  console.log(JSON.stringify({ out: OUT, shots: report.filter((r) => r.name).length, logs: issues }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
