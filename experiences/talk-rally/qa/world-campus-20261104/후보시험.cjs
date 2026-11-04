'use strict';
// 말 랠리 캠퍼스 판 — 공개 후보를 실제 공개본 위에서 돌려 본다(2026-11-04, 말의 리듬 후보시험.cjs · 주문 폭주 공개묶음동기화.cjs를 합침):
//   ① 브라우저 요청 가운데 synk.im/world/의 후보 파일만 후보 폴더에서 내주고 나머지는 지금 공개본 그대로 받아 입구 → 시합 → 결과를 지난다. 공개 빌드의 three.js 공용 사본 · 몽글 없는 HTML · 움직임 영상까지 본다.
//   ② 공개본 WORLD 계정 묶음(옛 Atlas일 수 있다) + 후보의 말 랠리로 학습 기록이 서버까지 막히지 않는지 본다(11-02 드라마 때 STORAGE_ERROR로 막힌 일, 현장 노트 배포 · 공개).
//   공개본은 바꾸지 않는다.
//   node experiences/talk-rally/qa/world-campus-20261104/후보시험.cjs [후보 폴더(그 아래 world/) = 공용 작업본 .tmp/talk-rally-world-20261104/공개/후보]
const path = require('node:path'), fs = require('node:fs');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const OUT_ROOT = path.join(공용작업본(path.resolve(__dirname, '../../../..')), '.tmp', 'talk-rally-world-20261104', '공개');
const DIR = process.argv[2] || path.join(OUT_ROOT, '후보');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.json': 'application/json', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const FRAME = 'https://synk.im/world/__rally_frame__';
const LOCAL_HOST = 'connected:!1,guard,engine:import_game_browser.default.engine,';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 부모 쪽: 공개본 계정 묶음의 호스트에 가짜 서버를 잇는다 — 게임 틀이 보낸 기록이 부모를 지나 서버까지 가는지 본다
const PARENT = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><link rel="icon" href="data:,"><style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%;display:block}</style></head><body><script type="module">
window.__posts = []; window.__gets = 0;
globalThis.__testTransport = {
  get: async ({ revision }) => { window.__gets += 1; return { ok: true, events: [], cursor: 0, hasMore: false, revision }; },
  post: async ({ revision, events }) => { window.__posts.push(...events); return { ok: true, revision, accepted: events.map((e) => e.id) }; },
};
const W = await import('/world/world-account.bundle.mjs');
for (const k of Object.keys(localStorage)) if (k.includes('local:synthetic-world')) localStorage.removeItem(k);
W.createLocalWorldLearningHost({ owner: 'synthetic-world', target: window, storage: localStorage });
await window.SYNKLearningHost.ready?.();
const f = document.createElement('iframe'); f.className = 'game-frame'; f.allow = 'autoplay'; f.src = '/world/talk-rally/index.html?qa=1'; document.body.append(f);
</script></body></html>`;

async function run(view) {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [], failed = [], fromCandidate = new Set(), got = new Set();
  let hostPatched = 0;
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${m.text()} @ ${m.location()?.url || ''}`); });
  page.on('response', (r) => { got.add(new URL(r.url()).pathname); if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  await page.route('https://synk.im/world/**', async (route) => {
    const u = new URL(route.request().url()), rel = decodeURIComponent(u.pathname).replace(/^\/world\//, '');
    if (u.href.startsWith(FRAME)) return route.fulfill({ contentType: TYPES['.html'], body: PARENT });
    const file = path.join(DIR, 'world', rel);
    if (fs.existsSync(file) && fs.statSync(file).isFile()) { fromCandidate.add(rel); return route.fulfill({ contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) }); }
    if (rel === 'world-account.bundle.mjs') {
      const r = await route.fetch(), text = await r.text();
      if (text.split(LOCAL_HOST).length !== 2) throw Error('공개본 계정 묶음의 비연결 호스트 꼴이 바뀌었다 — 이 시험의 고칠 곳을 맞춘다');
      hostPatched += 1;
      return route.fulfill({ response: r, body: text.replace(LOCAL_HOST, 'connected:!0,transport:globalThis.__testTransport,guard,engine:import_game_browser.default.engine,') });
    }
    return route.continue();
  });
  await page.goto(FRAME, { timeout: 60000 });
  const fr = () => page.frames().find((f) => f.url().includes('/talk-rally/index.html'));
  const waitFor = async (fn, ms = 60000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch { /* 틀이 아직 없다 */ } await sleep(120); } return false; };
  const out = { view: `${view.width}x${view.height}` };
  out.ready = await waitFor(() => fr().evaluate(() => !!window.__rally && document.documentElement.classList.contains('w-ready')));
  out.host = await fr().evaluate(() => document.documentElement.dataset.host);
  out.lobby = await fr().evaluate(() => ({ art: !!document.querySelector('.w-art'), mongleImgs: document.querySelectorAll('img[src*=mongle]').length, start: document.getElementById('btn-start')?.textContent?.trim() }));
  const hostStatus = () => page.evaluate(() => { const s = window.SYNKLearningHost.status(); return { phase: s.phase, code: s.code || null, queued: s.queued, complete: s.complete, memory: s.memory?.phase || null }; });
  out.hostBefore = await hostStatus();
  const shot = (n) => page.screenshot({ path: path.join(OUT_ROOT, `후보시험-${view.width}-${n}.png`) });
  await sleep(1500); await shot('입구');
  await fr().evaluate(() => document.querySelector('#btn-start').click());
  const pick = async () => {
    for (let i = 0; i < 300; i += 1) {
      const c = await fr().evaluate(() => { const s = window.__rally.state(); return { cur: s.cur, over: !document.querySelector('#results').hidden, explain: !!document.querySelector('#btn-next')?.offsetParent }; });
      if (c.over) return 'over';
      if (c.explain) { await fr().evaluate(() => document.querySelector('#btn-next').click()); await sleep(200); continue; }
      if (c.cur && c.cur.choice == null && (c.cur.phase === 'talk' || c.cur.phase === 'flight')) {
        await sleep(300);
        await fr().evaluate((n) => window.__rally.choose(n), c.cur.options.indexOf(c.cur.answer));
        return c.cur.id;
      }
      await sleep(100);
    }
    return null;
  };
  let n = 0, clipSeen = false;
  for (let i = 0; i < 16; i += 1) {
    const id = await pick();
    if (id === 'over' || !id) break;
    n += 1;
    for (let k = 0; k < 12; k += 1) { if (await fr().evaluate(() => !!window.__rally.world()?.clip)) clipSeen = true; await sleep(100); }
    if (n === 3) await shot('시합');
  }
  await sleep(4200); await shot('결과');
  const after = await hostStatus();
  out.hits = n; out.clipSeen = clipSeen;
  out.result = await fr().evaluate(() => ({ correct: document.querySelector('#r-correct')?.textContent, coins: document.querySelector('#r-coins')?.textContent, hub: getComputedStyle(document.querySelector('#r-hub')).display, room: !!document.querySelector('#w-room') }));
  out.overflow = await fr().evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  out.host2 = after;
  out.posts = await page.evaluate(() => window.__posts.length);
  out.hostPatched = hostPatched;
  out.fromCandidate = fromCandidate.size;
  out.three = [...got].filter((u) => /three\.(module|core)\.js$/.test(u));
  out.dir = DIR;
  out.atlas = await fr().evaluate(async () => { const src = [...document.scripts].map((s) => s.src).find((s) => /atlas-learning\.js/.test(s)); const b = await (await fetch(src)).arrayBuffer(); const h = await crypto.subtle.digest('SHA-256', b); return { src, bytes: b.byteLength, sha: [...new Uint8Array(h)].slice(0, 6).map((x) => x.toString(16).padStart(2, '0')).join('') }; });
  out.labBytes = [...got].filter((u) => /talk-rally\/(kit\/brand\/mongle|assets\/sound\/mongle|assets\/voice\/|assets\/narration\/)/.test(u));
  out.clips = [...got].filter((u) => /clips\//.test(u)).length;
  out.errors = errors; out.failed = [...new Set(failed)];
  await browser.close();
  return out;
}
(async () => {
  const rows = [];
  for (const view of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) rows.push(await run(view));
  fs.writeFileSync(path.join(OUT_ROOT, '후보시험.json'), JSON.stringify(rows, null, 1));
  console.log(JSON.stringify(rows, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
