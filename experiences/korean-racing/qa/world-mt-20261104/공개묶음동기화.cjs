'use strict';
// 공개 전 시험(주문 폭주 같은 이름의 시험을 레이스로 옮김): 공개본 WORLD 계정 묶음(옛 Atlas일 수 있다) + 공개 후보의 레이스로 한 판을 돌려, 학습 기록이 막히지 않고 서버까지 가는지 본다.
// 11-02 드라마 때 게임 묶음이 쓴 새 응답 꼴을 공개본 부모 쪽 동기화가 몰라 로그인 계정의 동기화가 STORAGE_ERROR로 막혔다(현장 노트 배포 · 공개) — 틀 시험의 비연결 호스트로는 안 난다.
// 그래서 공개본 계정 묶음의 호스트를 그대로 쓰되 연결만 가짜 서버에 잇는다(이 시험에서만, 받은 바이트의 비연결 호스트 한 곳을 고쳐 낸다 — 운영 계정 · talk · DB는 건드리지 않는다).
//   node experiences/korean-racing/qa/world-mt-20261104/공개묶음동기화.cjs --후보 <공개 후보 폴더(그 아래 world/)>
//   /live/ = 후보에 있으면 후보, 없으면 synk.im/world의 지금 파일.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE || os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));

const args = process.argv.slice(2), opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const CANDIDATE = opt('--후보') ? path.resolve(opt('--후보'), 'world') : null;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
const PARENT = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><link rel="icon" href="data:,"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#111}iframe{border:0;width:100%;height:100%}</style></head><body><script type="module">
window.__posts = []; window.__gets = 0;
globalThis.__testTransport = {
  get: async ({ revision }) => { window.__gets += 1; return { ok: true, events: [], cursor: 0, hasMore: false, revision }; },
  post: async ({ revision, events }) => { window.__posts.push(...events); return { ok: true, revision, accepted: events.map((e) => e.id) }; },
};
const W = await import('/live/world-account.bundle.mjs');
for (const k of Object.keys(localStorage)) if (k.includes('local:synthetic-world')) localStorage.removeItem(k);
W.createLocalWorldLearningHost({ owner: 'synthetic-world', target: window, storage: localStorage });
await window.SYNKLearningHost.ready?.();
const f = document.createElement('iframe'); f.className = 'game-frame'; f.allow = 'autoplay'; f.src = '/live/korean-racing/index.html?qa=1'; document.body.append(f);
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
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--headless=new', '--autoplay-policy=no-user-gesture-required', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem('SYNK_RACING_TUTORIAL_V1', JSON.stringify({ version: 1, completed: true })); } catch { /* 틀 밖 */ } });
  const page = await ctx.newPage();
  const errors = [], failed = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${m.text()} @ ${m.location()?.url || ''}`); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load' });
  const fr = () => page.frames().find((f) => f.url().includes('/korean-racing/index.html'));
  const waitFor = async (fn, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch { /* 틀이 아직 없다 */ } await page.waitForTimeout(150); } return false; };
  const ready = await waitFor(() => fr().evaluate(() => window.__racingQA?.state().ready), 120000);
  const hostStatus = () => page.evaluate(() => { const s = window.SYNKLearningHost.status(); return { phase: s.phase, code: s.code || null, queued: s.queued, complete: s.complete, memory: s.memory?.phase || null }; });
  const before = await hostStatus();
  const hosted = await fr().evaluate(() => !!window.parent.SYNKLearningHost);
  await fr().evaluate(() => document.getElementById('start').click());
  await waitFor(() => fr().evaluate(() => window.__racingQA.state().running), 60000);
  // 한 판: 첫 문제는 일부러 다른 길로 가고(틀림 기록), 나머지는 맞힌다
  const played = await fr().evaluate(async () => {
    const q = window.__racingQA, r = q.round, LANES = [-3.45, 0, 3.45];
    for (let i = 0; i < 4000 && !r.finished; i++) {
      const g = q.state().gate;
      if (g && !g.judged) {
        if (g.announced && !g.heard) q.hearNow();
        const right = g.types.indexOf(g.answer), lane = q.state().gateIndex === 0 ? (right + 1) % 3 : right;
        r.playerOffset = LANES[lane] ?? r.playerOffset;
        const go = document.getElementById('go'); if (go && !go.hidden && !go.disabled) go.click();
      }
      q.advance(.25);
    }
    return { finished: r.finished, correct: r.correct, total: r.questionBank.length };
  });
  await page.waitForTimeout(1500);
  await fr().evaluate(() => document.getElementById('cruise-results')?.click());
  await page.waitForTimeout(4000);
  const after = await hostStatus();
  await page.evaluate(() => window.SYNKLearningHost.flush?.()).catch(() => {});
  await page.waitForTimeout(1500);
  const posted = await page.evaluate(() => { const c = {}; for (const e of window.__posts) { const k = `${e.kind || e.type || '?'}${e.responseFormat ? ':' + e.responseFormat : ''}`; c[k] = (c[k] || 0) + 1; } return { n: window.__posts.length, gets: window.__gets, kinds: c }; });
  const end = await hostStatus();
  const result = await fr().evaluate(() => ({ title: document.getElementById('r-title')?.textContent, stake: document.querySelector('.w-res-stake')?.textContent, score: document.querySelector('#results .big')?.textContent?.trim() }));
  await browser.close(); server.close();
  console.log(JSON.stringify({ ready, hosted, hostPatched, fromCandidate, fromLive, before, played, after, end, posted, result, errors, failed }, null, 1));
  const blocked = [before, after, end].some((s) => s.phase === 'blocked');
  console.log(blocked || !posted.n ? '✗ 학습 기록 동기화가 막혔다' : `✓ 동기화 ${end.phase} · 보낸 사건 ${posted.n}건`);
  process.exit(blocked || !posted.n ? 1 : 0);
});
