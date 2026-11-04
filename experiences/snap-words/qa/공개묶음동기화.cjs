'use strict';
// 공개 전 시험: 공개본 WORLD 계정 묶음 + 공개 후보의 찰칵 낱말로 한 판을 돌려, 학습 기록이 막히지 않고 서버까지 가는지 본다.
// 주문 폭주 공개묶음동기화.cjs와 같은 길이다 — 공개본 호스트의 연결만 가짜 서버에 잇고 운영 계정 · talk · DB는 건드리지 않는다.
//   node experiences/snap-words/qa/공개묶음동기화.cjs --후보 <공개 후보 폴더(그 아래 world/)>
//   /live/ = 후보에 있으면 후보, 없으면 synk.im/world의 지금 파일.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE || os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../node_modules')] }));

const args = process.argv.slice(2), opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const CANDIDATE = opt('--후보') ? path.resolve(opt('--후보'), 'world') : null;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
const PARENT = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><link rel="icon" href="data:,"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#111}iframe{border:0;width:100%;height:100%;display:block}</style></head><body><script type="module">
window.__posts = []; window.__gets = 0;
globalThis.__testTransport = {
  get: async ({ revision }) => { window.__gets += 1; return { ok: true, events: [], cursor: 0, hasMore: false, revision }; },
  post: async ({ revision, events }) => { window.__posts.push(...events); return { ok: true, revision, accepted: events.map((e) => e.id) }; },
};
const W = await import('/live/world-account.bundle.mjs');
for (const k of Object.keys(localStorage)) if (k.includes('local:synthetic-world')) localStorage.removeItem(k);
W.createLocalWorldLearningHost({ owner: 'synthetic-world', target: window, storage: localStorage });
await window.SYNKLearningHost.ready?.();
const f = document.createElement('iframe'); f.className = 'game-frame'; f.allow = 'autoplay'; f.src = '/live/snap-words/index.html'; document.body.append(f);
</script></body></html>`;
const cache = new Map(); let fromLive = 0, fromCandidate = 0, hostPatched = 0;
const LOCAL_HOST = 'connected:!1,guard,engine:import_game_browser.default.engine,';
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/') { res.writeHead(200, { 'Content-Type': types['.html'] }); return res.end(PARENT); }
    if (!url.pathname.startsWith('/live/')) { res.writeHead(404).end(); return; }
    let rel = decodeURIComponent(url.pathname.slice(6)); if (!rel || rel.endsWith('/')) rel += 'index.html';
    if (rel.includes('..')) { res.writeHead(403).end(); return; }
    const local = CANDIDATE && path.join(CANDIDATE, rel);
    let bytes;
    if (local && fs.existsSync(local)) { bytes = fs.readFileSync(local); fromCandidate += 1; }
    else if (cache.has(rel)) bytes = cache.get(rel);
    else { const r = await fetch(`https://synk.im/world/${encodeURI(rel)}`); if (!r.ok) { res.writeHead(r.status).end(); return; } bytes = Buffer.from(await r.arrayBuffer()); cache.set(rel, bytes); fromLive += 1; }
    if (rel === 'world-account.bundle.mjs') {
      const text = bytes.toString('utf8');
      if (text.split(LOCAL_HOST).length !== 2) throw Error('공개본 계정 묶음의 비연결 호스트 꼴이 바뀌었다 — 이 시험의 고칠 곳을 맞춘다');
      bytes = Buffer.from(text.replace(LOCAL_HOST, 'connected:!0,transport:globalThis.__testTransport,guard,engine:import_game_browser.default.engine,'));
      hostPatched += 1;
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(rel)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(bytes);
  } catch (error) { res.writeHead(500).end(String(error?.message || error)); }
});
server.listen(0, '127.0.0.1', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [], failed = [], sleep = (ms) => page.waitForTimeout(ms);
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${m.text()} @ ${m.location()?.url || ''}`); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load' });
  const game = () => page.frames().find((x) => x.url().includes('/snap-words/'));
  for (let i = 0; i < 300 && !game(); i += 1) await sleep(100);
  const f = game();
  await f.waitForFunction(() => !!window.__snap, null, { timeout: 60000 });
  const hostStatus = () => page.evaluate(() => { const s = window.SYNKLearningHost.status(); return { phase: s.phase, code: s.code || null, queued: s.queued, complete: s.complete, memory: s.memory?.phase || null }; });
  const before = await hostStatus();
  const hosted = await f.evaluate(() => !!window.parent.SYNKLearningHost);
  await sleep(1500);
  await f.locator('[data-go=start]').click();
  await f.waitForFunction(() => window.__snap.S.screen === 'shoot' && !window.__snap.S.busy && !document.querySelector('#msg').hidden, null, { timeout: 30000 });
  // 둘러보기에서 몇 장 찍고 부탁으로
  await f.evaluate(() => window.__snap.focusOn(window.__snap.S.items.find((i) => i.group === 'blade'))); await sleep(700);
  await f.locator('#shutter').click(); await sleep(900);
  await f.evaluate(() => window.__snap.focusOn(window.__snap.S.items.find((i) => i.word === 'cat'))); await sleep(700);
  await f.locator('#shutter').click(); await sleep(900);
  await f.evaluate(() => window.__snap.focusOn(window.__snap.S.items.find((i) => i.kind === 'fixed'))); await sleep(700);
  await f.locator('#shutter').click(); await sleep(900);
  await f.locator('#step-back').click(); await sleep(700);
  await f.locator('#msg .pill').click(); await sleep(1200);
  let played = 0;
  for (let g = 0; g < 8; g += 1) {
    const st = await f.evaluate(() => { const { S } = window.__snap, m = S.missions[S.mi]; return { phase: S.phase, mi: S.mi, kind: m?.kind, word: m?.word }; });
    if (st.phase !== 'mission') break;
    await f.evaluate(({ kind, word }) => { const { S } = window.__snap; window.__snap.focusOn(S.items.find((i) => (kind === 'word' ? i.kind === 'thing' : i.kind === 'plate') && i.word === word)); }, st);
    await sleep(650);
    await f.locator('#shutter').click();
    await f.waitForFunction((mi) => window.__snap.S.mi !== mi || window.__snap.S.phase !== 'mission', st.mi, { timeout: 12000 });
    played += 1; await sleep(300);
  }
  await f.waitForFunction(() => window.__snap.S.screen === 'develop', null, { timeout: 12000 });
  await sleep(1500);
  let developed = 0;
  for (let i = 0; i < 3; i += 1) {
    if (await f.evaluate(() => window.__snap.S.screen !== 'develop')) break;
    await f.waitForFunction(() => document.querySelector('.dev-opt:not([disabled])'));
    const n = await f.evaluate(() => window.__snap.answerNow());
    await f.locator('.dev-opt').nth(n).click();
    developed += 1; await sleep(1500);
  }
  await f.waitForFunction(() => window.__snap.S.screen === 'result', null, { timeout: 12000 });
  await sleep(4000);
  const after = await hostStatus();
  await page.evaluate(() => window.SYNKLearningHost.flush?.()).catch(() => {});
  await sleep(1200);
  const end = await hostStatus();
  const posted = await page.evaluate(() => { const c = {}; for (const e of window.__posts) { const k = `${e.kind || e.type || '?'}${e.responseFormat ? ':' + e.responseFormat : ''}`; c[k] = (c[k] || 0) + 1; } return { n: window.__posts.length, gets: window.__gets, kinds: c }; });
  const named = await f.evaluate(() => Object.values(window.__snap.album.cards).filter((c) => c.named).length);
  await browser.close(); server.close();
  const report = { hosted, hostPatched, fromCandidate, fromLive, before, played, developed, named, after, end, posted, errors, failed };
  console.log(JSON.stringify(report, null, 1));
  const blocked = [before, after, end].some((s) => s.phase === 'blocked');
  console.log(blocked || !posted.n ? '✗ 학습 기록 동기화가 막혔다' : `✓ 동기화 ${end.phase} · 보낸 사건 ${posted.n}건`);
  process.exit(blocked || !posted.n ? 1 : 0);
});
