'use strict';
// 입장 검사 캠퍼스 판 — 근무지 넷 · 여러 화면 크기를 끝까지 돌며 「판정 순간에 보여야 할 것이 보이는가」를 잰다(2026-11-04, Fable 설계 검토 P1 두 건의 시험).
// 손님마다 찍은 뒤: 창(얼굴)이 화면 안, 근거 낱말이 판 위 책상 안, 다음 단추가 화면 안. 찍기 전: 안내문 첫 줄이 보이는지 · 가로 넘침 · 콘솔 오류 · 실패한 요청.
//   node experiences/entry-check/qa/world-campus-20261104/장면재기.cjs <출력 폴더> [--크기 390x844,360x640] [--근무지 pool,concert]
const path = require('node:path'), fs = require('node:fs'), http = require('node:http');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const arg = (name, fb) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fb; };
const OUT = process.argv[2];
const SIZES = arg('--크기', '390x844,360x640,320x568,1280x800,844x390').split(',').map((s) => s.split('x').map(Number));
const VENUES = arg('--근무지', 'pool,library,museum,concert').split(',');
const REDUCED = process.argv.includes('--줄이기');
const EXP = path.resolve(__dirname, '../../..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const frameHtml = (W, H) => `<!doctype html><meta charset=utf-8><style>html,body{margin:0;background:#060709;overflow:hidden}iframe{border:0;display:block;width:${W}px;height:${H}px}</style><iframe class="game-frame" src="/entry-check/?qa=1" allow="autoplay"></iframe>`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://x'), u = decodeURIComponent(url.pathname);
      if (u === '/') { res.writeHead(200, { 'content-type': TYPES['.html'] }); res.end(frameHtml(Number(url.searchParams.get('w')), Number(url.searchParams.get('h')))); return; }
      let file = path.join(EXP, u);
      if (!file.startsWith(EXP) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
      if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(fs.readFileSync(file));
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}
const METRICS = () => {
  const H = innerHeight, W = innerWidth, rect = (q) => { const n = document.querySelector(q); if (!n) return null; const r = n.getBoundingClientRect(); return r.width && r.height ? r : null; };
  const inside = (r) => !!r && r.top >= -1 && r.left >= -1 && r.bottom <= H + 1 && r.right <= W + 1;
  const fb = rect('#feedback'), desk = rect('.desk'), frame = rect('.frame'), next = rect('#btn-next'), mark = rect('mark.w-key'), stamp = rect('#stamp-mark');
  const floor = fb && mark && fb.left < mark.right ? Math.min(fb.top, desk.bottom) : desk?.bottom ?? H;
  const seen = (r) => !!r && r.top >= (desk?.top ?? 0) - 1 && r.bottom <= floor + 1;
  return { over: document.documentElement.scrollWidth - W, frameIn: inside(frame), nextIn: inside(next), markSeen: mark ? seen(mark) : null, stampSeen: stamp ? seen(stamp) : null, fbH: fb ? Math.round(fb.height) : 0, deskRoom: desk ? Math.round(Math.min(floor, desk.bottom) - desk.top) : 0 };
};
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const srv = await serve(), BASE = `http://127.0.0.1:${srv.address().port}/`, report = [];
  for (const [W, H] of SIZES) for (const venue of VENUES) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1.5, reducedMotion: REDUCED ? 'reduce' : 'no-preference' });
    await ctx.addInitScript(() => { try { localStorage.setItem('synk.entry-check.v1', JSON.stringify({ v: 1, stars: { pool: 3, library: 3, museum: 3, concert: 3 }, plays: 4, tutorial: true, doneDay: null, motion: true })); } catch { /* 없음 */ } });
    const page = await ctx.newPage(), errors = [], failed = [], problems = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/404|vibrate|Failed to load resource/.test(m.text())) errors.push(m.text()); });
    page.on('response', (r) => { if (r.status() >= 400 && !/favicon|\/api\//.test(r.url())) failed.push(`${r.status()} ${new URL(r.url()).pathname}`); });
    await page.goto(`${BASE}?w=${W}&h=${H}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const fr = () => page.frames().find((x) => x.url().includes('/entry-check/'));
    for (let i = 0; i < 160; i += 1) { if (await fr()?.evaluate(() => document.documentElement.classList.contains('w-ready')).catch(() => false)) break; await sleep(100); }
    const click = (q) => fr().evaluate((s) => document.querySelector(s).click(), q);
    await sleep(500);
    await fr().evaluate((v) => { const b = document.querySelector(`#venues .venue[data-venue="${v}"]`); (b.querySelector('button') || b).click(); }, venue);
    await sleep(500);
    if (await fr().evaluate(() => document.querySelector('#briefing') && !document.querySelector('#briefing').hidden)) { await page.screenshot({ path: path.join(OUT, `${W}x${H}_${venue}_안내.jpg`), type: 'jpeg', quality: 78 }); await sleep(500); await click('#btn-begin'); }
    await sleep(900);
    const dismiss = async () => {
      if (await fr().evaluate(() => !document.querySelector('#memo-alert').hidden)) { await page.screenshot({ path: path.join(OUT, `${W}x${H}_${venue}_알림.jpg`), type: 'jpeg', quality: 78 }); await sleep(500); await fr().evaluate(() => document.querySelector('#memo-alert button').click()); await sleep(500); }
      if (await fr().evaluate(() => !document.querySelector('#coach').hidden)) { await fr().evaluate(() => document.querySelector('#coach-skip')?.click()); await sleep(300); }
    };
    let last = null, n = 0;
    for (let g = 0; g < 14; g += 1) {
      await dismiss();
      if (await fr().evaluate(() => !document.querySelector('#results').hidden)) break;
      let cur = null;
      for (let i = 0; i < 60; i += 1) { cur = await fr().evaluate(() => window.__entry.state().cur); if (cur?.id && cur.id !== last && !cur.done) break; await dismiss(); await sleep(100); }
      if (!cur?.id || cur.id === last) break;
      last = cur.id; n += 1;
      await sleep(600);
      const before = await fr().evaluate(() => { const r = document.querySelector('#notice .rules li')?.getBoundingClientRect(), d = document.querySelector('.desk').getBoundingClientRect(); return { first: !!r && r.top >= d.top && r.bottom <= d.bottom, room: Math.round(d.height), scrollable: document.querySelector('.desk').scrollHeight - document.querySelector('.desk').clientHeight, over: document.documentElement.scrollWidth - innerWidth }; });
      if (!before.first) problems.push(`${cur.id} 찍기 전 안내문 첫 줄이 책상 밖`);
      if (before.over > 0) problems.push(`${cur.id} 찍기 전 가로 넘침 ${before.over}`);
      if (n === 1) await page.screenshot({ path: path.join(OUT, `${W}x${H}_${venue}_읽기.jpg`), type: 'jpeg', quality: 78 });
      if (cur.answer === 'pass') await click('#btn-pass'); else { await click('#btn-reject'); await sleep(260); await fr().evaluate((a) => document.querySelector(`#notice .rule[data-rule="${a}"]`).click(), cur.answer); }
      await sleep(1400);
      const m = await fr().evaluate(METRICS);
      if (!m.frameIn) problems.push(`${cur.id} 판정 때 창이 잘림`);
      if (!m.nextIn) problems.push(`${cur.id} 다음 단추가 화면 밖`);
      if (m.markSeen === false) problems.push(`${cur.id} 근거 낱말이 판 뒤(책상 ${m.deskRoom}px · 판 ${m.fbH}px)`);
      if (m.over > 0) problems.push(`${cur.id} 판정 때 가로 넘침 ${m.over}`);
      if (n === 1 || m.markSeen === false) await page.screenshot({ path: path.join(OUT, `${W}x${H}_${venue}_판정${n}_${cur.id}.jpg`), type: 'jpeg', quality: 78 });
      await click('#btn-next');
      await sleep(700);
    }
    await dismiss();
    for (let i = 0; i < 30; i += 1) { if (await fr().evaluate(() => !document.querySelector('#results').hidden)) break; await sleep(100); }
    await sleep(1800);
    await page.screenshot({ path: path.join(OUT, `${W}x${H}_${venue}_결과.jpg`), type: 'jpeg', quality: 78 });
    const end = await fr().evaluate(() => ({ results: !document.querySelector('#results').hidden, over: document.documentElement.scrollWidth - innerWidth, cards: document.querySelectorAll('.w-stampcard li').length, expr: document.querySelectorAll('.w-expr li').length, hasText: (document.body.innerText || '').match(/몽글|까몽|마린|펠트|LAB/g) }));
    if (!end.results) problems.push('결과 화면에 닿지 못함');
    if (end.over > 0) problems.push(`결과 가로 넘침 ${end.over}`);
    if (end.hasText) problems.push(`옛 말 ${end.hasText.join(' ')}`);
    report.push({ 크기: `${W}x${H}`, 근무지: venue, 손님: n, 도장판: end.cards, 표현: end.expr, 문제: problems, 오류: errors, 실패: [...new Set(failed)] });
    console.log(JSON.stringify(report.at(-1)));
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, '재기.json'), JSON.stringify(report, null, 1));
  await browser.close(); srv.close();
  console.log('문제 합', report.reduce((a, r) => a + r.문제.length + r.오류.length + r.실패.length, 0));
})().catch((e) => { console.error(e); process.exit(1); });
