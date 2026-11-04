'use strict';
// 게시판 해독 — 게임만 띄워 세 판을 처음부터 끝까지 돌리고 화면을 찍는다. 콘솔 오류 · 실패 요청 · 가로 넘침을 잰다.
//   PORT=5208 node experiences/board-decode/server.mjs   (또는 아래가 알아서 띄운다)
//   node experiences/board-decode/qa/판돌리기.cjs <출력 폴더> [390x844,1280x800,360x640]
const path = require('node:path'), fs = require('node:fs'), { spawn } = require('node:child_process');
const OUT = process.argv[2] || path.join(__dirname, '화면');
const VIEWS = (process.argv[3] || '390x844').split(',').map((s) => { const [width, height] = s.split('x').map(Number); return { width, height }; });
const PORT = Number(process.env.PORT || 5208);
const { chromium } = require('playwright');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let server = null, browser = null;
(async () => {
  server = spawn(process.execPath, [path.join(__dirname, '..', 'server.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await sleep(700);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = { 오류: [], 실패요청: [], 넘침: [], 판: [] };
  for (const view of VIEWS) {
    const tag = `${view.width}`;
    const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: view.width < 700 ? 2 : 1, hasTouch: view.width < 700, isMobile: view.width < 700 });
    const p = await ctx.newPage();
    p.setDefaultTimeout(15000);
    p.on('pageerror', (e) => report.오류.push(`${tag}: ${e.message}`));
    p.on('console', (m) => { if (m.type() === 'error') report.오류.push(`${tag}: ${m.text()}`); });
    p.on('response', (r) => { if (r.status() >= 400) report.실패요청.push(`${r.status()} ${new URL(r.url()).pathname}`); });
    const shot = async (name) => { await sleep(750); const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (over > 0) report.넘침.push(`${tag} ${name}: ${over}px`); await p.screenshot({ path: path.join(OUT, `${tag}_${name}.png`) }); };
    await p.goto(`http://127.0.0.1:${PORT}/index.html?seed=7&lang=${process.env.QA_LANG || 'ko'}`);
    await p.evaluate(() => document.fonts.ready);
    await shot('0입구');
    for (let r = 0; r < 3; r += 1) {
      const name = ['세탁실', '축제', '계절학기'][r];
      if (r === 0) { await p.click('[data-tear="2"]'); await sleep(1000); }
      await shot(`${name}_1첫화면`);
      const word = await p.getAttribute('.w >> nth=0', 'data-w');
      await p.click('.w >> nth=0'); await shot(`${name}_2단서`);
      await p.click('[data-memo] >> nth=0'); await shot(`${name}_3메모`);
      await p.click('[data-clue-x]');
      const wrong = await p.evaluate(() => { const s = window.__board.state(); const i = s.order[0].findIndex((o) => o.ok !== s.fork.f1); return i; });
      await p.click(`[data-reply="${wrong}"]`); await shot(`${name}_4틀림`);
      await p.click('[data-scene-x]'); await sleep(200);
      const right = () => p.evaluate(() => { const s = window.__board.state(); const list = s.phase === 'patch' ? s.patchOrder : s.order[s.slot]; const slotFork = s.phase === 'patch' ? null : ['f1', 'f2'][s.slot]; return list.findIndex((o) => (s.phase === 'patch' ? o.ok === true : o.ok === s.fork[slotFork])); });
      await p.click(`[data-reply="${await right()}"]`); await sleep(500); await shot(`${name}_5둘째칸`);
      await p.click(`[data-reply="${await right()}"]`); await sleep(1700); await shot(`${name}_6정정`);
      await p.click(`[data-reply="${await right()}"]`); await sleep(1500); await shot(`${name}_7끝`);
      await p.click('[data-peek] >> nth=0'); await shot(`${name}_8엿보기`);
      await p.click('[data-scene-x]'); await sleep(200);
      report.판.push({ view: tag, name, word, 수첩: await p.evaluate(() => Object.keys(window.__board.save().words).length), 앨범: await p.evaluate(() => Object.keys(window.__board.save().album).length) });
      if (r < 2) { await p.click('[data-next]'); await sleep(900); }
    }
    await p.click('[data-replay]'); await sleep(800); await shot('다시하기');
    await p.click('[data-back]'); await sleep(400); await shot('입구_돌아옴');
    await p.click('[data-panel="book"]'); await shot('수첩');
    await p.click('.tabs [data-panel="album"]'); await shot('앨범');
    await ctx.close();
  }
  await browser.close(); server.kill();
  console.log(JSON.stringify(report, null, 1));
  process.exit(0);
})().catch(async (e) => { console.error(e); await browser?.close().catch(() => {}); server?.kill(); process.exit(1); });
