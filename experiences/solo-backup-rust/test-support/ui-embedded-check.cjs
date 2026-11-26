'use strict';
// 솔리오 안(data-embedded, SOLIO_ONE_CLIENT.md 2.2)의 엔진 화면 확인 — dist/를 작은 로컬 서버로 띄우고 Chrome에서 window.synkBackupHost 대역을 둔다.
//   node test-support/ui-embedded-check.cjs        (먼저 node scripts/stage-ui.cjs)
// 낱말(settings · folders)로 연 서랍을 손님이 닫으면(바깥 · Esc · 닫기) close로 원클릭 판에 돌아가고, 화면 안 단추로 연 서랍은 그 화면에 남는다.
// settings는 기본 화면 위에 열리고, move 낱말은 열린 서랍을 닫는다(카본 workbackup-solio-one-ui-20261127 B1 · B2).
// 화면 DOM 시험 틀이 없어 *.test.cjs가 아니다(Chrome과 Playwright가 있어야 돈다). 하나라도 틀리면 1로 끝난다.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const APP = path.resolve(__dirname, '..');
const REPO = path.resolve(APP, '..', '..');
const DIST = path.join(APP, 'dist');
const { pathToFileURL } = require('node:url');
function playwright() {
  try { return require('playwright'); } catch {
    const { 공용작업본 } = require(path.join(REPO, 'tools/lib/공용작업본.js'));
    return require('node:module').createRequire(path.join(공용작업본(REPO), 'package.json'))('playwright');
  }
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8' };
(async () => {
  const { STATES, NOW } = await import(pathToFileURL(path.join(APP, 'ui/engine-fixtures.js')).href);
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.join(DIST, rel);
    if (!file.startsWith(DIST + path.sep) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('dist/가 없습니다. 먼저 node scripts/stage-ui.cjs');
  const browser = await playwright().chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 760 }, reducedMotion: 'reduce' });
  await ctx.addInitScript((initial) => {
    window.__closed = 0;
    window.synkBackupHost = {
      call: async (m) => (m === 'getState' ? { ok: true, value: initial } : { ok: false, error: 'x', code: 'FIXTURE' }),
      onState: () => () => {},
      onOpen: (cb) => { window.__openTopic = cb; },
      close: () => { window.__closed++; return Promise.resolve({ ok: true }); },
    };
  }, STATES.home);
  const pg = await ctx.newPage();
  const errors = [];
  pg.on('pageerror', (e) => errors.push(e.message));
  await pg.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await pg.waitForFunction(() => window.__wb && window.__openTopic);
  await pg.evaluate(({ state, now }) => window.__wb.show('home', { state, now, still: true }), { state: STATES.home, now: NOW });
  const look = () => pg.evaluate(() => ({ drawer: !document.getElementById('drawer').hidden, closed: window.__closed, screen: document.getElementById('stage').dataset.screen, inert: !!document.getElementById('room').inert, embedded: document.documentElement.dataset.embedded }));
  const results = [];
  const check = (name, ok, got) => results.push([ok ? 'OK ' : 'BAD', name, JSON.stringify(got)]);
  // B1: 낱말 settings → 바깥 누름 · Esc · 닫기 단추 → 원클릭으로(close)
  for (const [how, act] of [['dim', () => pg.click('#drawer-dim', { position: { x: 20, y: 20 } })], ['esc', () => pg.keyboard.press('Escape')], ['button', () => pg.click('[data-act="drawer-close"]')]]) {
    const before = (await look()).closed;
    await pg.evaluate(() => window.__openTopic('settings')); await pg.waitForTimeout(80);
    const opened = await look();
    check(`settings opens the drawer (${how})`, opened.drawer && opened.embedded === '1', opened);
    await act(); await pg.waitForTimeout(80);
    const after = await look();
    check(`closing the topic drawer by ${how} goes back to the board`, !after.drawer && after.closed === before + 1, after);
  }
  // 낱말로 연 서랍(folders)도 같다
  { const before = (await look()).closed; await pg.evaluate(() => window.__openTopic('folders')); await pg.waitForTimeout(80); await pg.keyboard.press('Escape'); await pg.waitForTimeout(80); const a = await look(); check('folders topic drawer closes back to the board', !a.drawer && a.closed === before + 1, a); }
  // 화면 안의 단추로 연 서랍은 그 화면으로 돌아간다(close 없음)
  { await pg.evaluate(({ state, now }) => window.__wb.show('home', { state, now, still: true, drawer: true }), { state: STATES.home, now: NOW }); const before = (await look()).closed; await pg.keyboard.press('Escape'); await pg.waitForTimeout(80); const a = await look(); check('a drawer opened inside the screen closes to the screen', !a.drawer && a.closed === before, a); }
  // settings 진입 때 밑화면은 기본 화면
  { await pg.evaluate(() => window.__openTopic('restore')); await pg.waitForTimeout(80); const r = await look(); await pg.evaluate(() => window.__openTopic('settings')); await pg.waitForTimeout(80); const a = await look(); check('settings lays the drawer over the home screen, not the restore screen left in the view', r.screen === 'restore' && a.drawer && a.screen === 'home', { before: r.screen, after: a }); await pg.keyboard.press('Escape'); await pg.waitForTimeout(50); }
  // B2: 서랍이 열린 채 move → 서랍 닫힘, 뒤 화면 inert 풀림, close 없음
  { await pg.evaluate(() => window.__openTopic('settings')); await pg.waitForTimeout(80); const before = (await look()).closed; await pg.evaluate(() => window.__openTopic('move')); await pg.waitForTimeout(80); const a = await look(); check('move closes an open drawer and frees the screen behind', !a.drawer && !a.inert && a.closed === before, a); }
  check('no page errors', errors.length === 0, errors.slice(0, 3));
  for (const r of results) console.log(r.join(' '));
  const ok = results.every((r) => r[0] === 'OK ');
  console.log(ok ? 'ALL OK' : 'SOME BAD');
  await browser.close(); server.close();
  if (!ok) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exit(1); });
