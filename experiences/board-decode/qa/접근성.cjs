'use strict';
// 게시판 해독 — 입구부터 끝 화면까지 화면마다 axe를 돌린다(2026-11-05). 배포 점검은 입구 한 장만 보기 때문이다.
//   node experiences/board-decode/qa/접근성.cjs
const path = require('node:path'), fs = require('node:fs'), { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../../..');
const axe = fs.readFileSync(path.join(ROOT, 'tools/vendor/axe.min.js'), 'utf8');
const PORT = Number(process.env.BOARD_QA_PORT || 5241);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  let browser;
  const found = new Map();
  try {
    await sleep(700);
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    for (const view of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 360, height: 640 }]) {
      const ctx = await browser.newContext({ viewport: view, reducedMotion: 'reduce' });
      const p = await ctx.newPage();
      await p.addInitScript(() => { try { localStorage.clear(); } catch { /* 빈 저장 */ } });
      await p.goto(`http://127.0.0.1:${PORT}/index.html?seed=7`);
      const look = async (name) => {
        await sleep(350);
        await p.evaluate(axe);
        const list = await p.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] })).violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(' ')) })));
        for (const v of list) for (const n of v.nodes) found.set(`${v.id}(${v.impact}) ${n}`, `${view.width} ${name}`);
      };
      const right = () => p.evaluate(() => { const s = window.__board.state(); const list = s.phase === 'patch' ? s.patchOrder : s.order[s.slot]; const k = ['f1', 'f2'][s.slot]; return list.findIndex((o) => (s.phase === 'patch' ? o.ok === true : o.ok === s.fork[k])); });
      await look('입구');
      await p.click('[data-panel="album"]'); await look('입구 앨범'); await p.keyboard.press('Escape');
      await p.click('[data-tear="1"]'); await sleep(900); await look('게임');
      await p.click('.w >> nth=0'); await look('단서');
      await p.click('[data-memo] >> nth=0'); await look('연필 메모');
      await p.click('[data-clue-x]');
      const wrong = await p.evaluate(() => { const s = window.__board.state(); return s.order[0].findIndex((o) => o.ok !== s.fork.f1); });
      await p.click(`[data-reply="${wrong}"]`); await look('틀림 장면'); await p.keyboard.press('Escape'); await sleep(200);
      await p.click(`[data-reply="${await right()}"]`); await sleep(500); await look('둘째 칸');
      await p.click('.book-btn'); await look('수첩'); await p.keyboard.press('Escape'); await sleep(200);
      await p.click(`[data-reply="${await right()}"]`); await sleep(1500); await look('정정');
      await p.click(`[data-reply="${await right()}"]`); await sleep(1500); await look('끝');
      await p.click('[data-peek] >> nth=0'); await look('엿보기');
      await ctx.close();
    }
  } finally {
    await browser?.close();
    server.kill();
  }
  for (const [k, where] of found) console.log(`XX ${k} — ${where}`);
  console.log(found.size ? `✗ ${found.size}곳` : '✓ 접근성 위반 없음(세 폭 · 화면 11장)');
  process.exit(found.size ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
