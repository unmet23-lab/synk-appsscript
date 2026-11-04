'use strict';
// 찰칵 낱말 앨범의 계정 저장을 브라우저에서 끝까지 잰다: 실제 게임 + 실제 놀이 호스트(account-host) + synk-play 계약을 따른 가짜 서버. 운영 계정 · talk · DB는 건드리지 않는다.
//   node experiences/snap-words/qa/계정저장.cjs <출력 폴더>
// ① 한 프로필에서 한 판 → ② 저장이 빈 새 프로필에서 앨범 · 이름 · 장소 열림이 그대로 ③ 기기에만 쌓인 앨범이 계정으로 옮겨감(사본은 남음) ④ 두 값이 다르면 이름 쪽으로 합침
// ⑤ 서버 거절 · 옛 호스트 · 연결 끊김에도 앨범이 비지 않음 ⑥ 콘솔 오류 · 실패 요청(일부러 낸 것 빼고) 0.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../node_modules')] }));

const ROOT = path.resolve(__dirname, '../..');
const OUT = process.argv[2] || path.join(__dirname, '화면');
fs.mkdirSync(OUT, { recursive: true });
const ACCOUNT = '11111111-1111-4111-8111-111111111111', KEY = 'synk.snap-words.v1', DEVICE = `${KEY}:local:${ACCOUNT}`;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml' };
const empty = () => ({ wallet: { v: 1, coins: 0, totalEarned: 0, owned: [] }, records: {}, imported: false });
const play = { state: null, revision: 0, mode: 'ok', posts: 0 };
const parent = (old) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><link rel="icon" href="data:,"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#000}.game-frame{position:fixed;inset:0;width:100%;height:100%;border:0}</style></head><body><script type="module">
import {createWorldPlayHost} from '/play-common/account-host.mjs';
const W = await import('/synk-world-app/world-account.bundle.mjs');
W.createLocalWorldLearningHost({ owner: '${ACCOUNT}', target: window, storage: localStorage });
const call = async (init) => { const r = await fetch('/__play', init); const data = await r.json(); if (!r.ok) throw Object.assign(Error(data.error.code), { code: data.error.code, status: r.status }); return data; };
const host = createWorldPlayHost({ accountId: '${ACCOUNT}', storage: localStorage, guard() {}, client: { load: () => call(), mutate: (body) => call({ method: 'POST', body: JSON.stringify(body) }) } });
window.__host = host;
window.SYNKPlayHost = ${old ? `Object.freeze({ ...host, storage: () => { const port = host.storage(); return { ...port, getItem(k) { if (k === '${KEY}') throw Object.assign(Error('INVALID_PLAY_KEY'), { code: 'INVALID_PLAY_KEY' }); return port.getItem(k); }, setItem(k, v) { if (k === '${KEY}') throw Object.assign(Error('INVALID_PLAY_KEY'), { code: 'INVALID_PLAY_KEY' }); return port.setItem(k, v); } }; } })` : 'host'};
await host.ready();
const f = document.createElement('iframe'); f.className = 'game-frame'; f.allow = 'autoplay'; f.src = '/snap-words/index.html?seed=7'; document.body.append(f);
</script></body></html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
  const reply = () => json(200, { ok: true, scope: 'synk-play', accountId: ACCOUNT, revision: play.revision, state: play.state });
  if (url.pathname === '/__parent') { res.writeHead(200, { 'Content-Type': types['.html'] }); res.end(parent(url.searchParams.has('old'))); return; }
  if (url.pathname === '/__play') {
    if (play.mode === 'down') { res.destroy(); return; }
    if (req.method === 'GET') return reply();
    let raw = ''; req.on('data', (c) => { raw += c; }); req.on('end', () => {
      const body = JSON.parse(raw); play.posts += 1;
      if (play.mode === 'refuse') return json(400, { ok: false, error: { code: 'INVALID_PLAY_STATE' } });
      for (const c of body.changes || []) if ((play.state.records[c.key] ?? null) !== c.previous) return json(409, { ok: false, error: { code: 'REVISION_CONFLICT' } });
      for (const c of body.changes || []) { if (c.value === null) delete play.state.records[c.key]; else play.state.records[c.key] = c.value; }
      play.revision += 1;
      return reply();
    });
    return;
  }
  const file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});

const checks = [];
const check = (name, ok, more = '') => { checks.push({ name, ok: !!ok, more }); console.log(`${ok ? '✓' : '✗'} ${name}${more ? ` — ${more}` : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stored = () => { const raw = play.state.records[KEY]; return raw ? JSON.parse(raw) : null; };
const namedOf = (album) => Object.keys(album?.cards || {}).filter((id) => album.cards[id].named).sort();

async function main() {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const errors = [];
  async function profile(name, view, { seed = {}, old = false, expectFail = false } = {}) {
    const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: 1, hasTouch: view.width < 700, isMobile: view.width < 700 });
    if (Object.keys(seed).length) await ctx.addInitScript((pairs) => { if (!sessionStorage.getItem('__seeded')) { sessionStorage.setItem('__seeded', '1'); for (const [k, v] of Object.entries(pairs)) localStorage.setItem(k, v); } }, seed);
    const page = await ctx.newPage();
    page.setDefaultTimeout(30000);
    page.on('pageerror', (e) => errors.push(`${name} pageerror ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error' && !expectFail) errors.push(`${name} ${m.text()}`); });
    page.on('response', (r) => { if (r.status() >= 400 && !expectFail) errors.push(`${name} ${r.status()} ${r.url()}`); });
    await page.goto(`${base}/__parent${old ? '?old=1' : ''}`, { waitUntil: 'load' });
    const game = () => page.frames().find((f) => f.url().includes('/snap-words/'));
    for (let i = 0; i < 200 && !game(); i += 1) await sleep(100);
    const f = game();
    await f.waitForFunction(() => !!window.__snap, null, { timeout: 60000 });
    return { ctx, page, f, shot: (label) => page.screenshot({ path: path.join(OUT, `${name}_${label}.png`) }) };
  }
  const synced = (p) => p.page.waitForFunction(() => { const s = window.__host.status(); return s.pending === 0 && s.phase === 'synced'; }, null, { timeout: 15000 });
  async function round({ f }) {
    await sleep(1200);
    await f.locator('[data-go=start]').click();
    await f.waitForFunction(() => window.__snap.S.screen === 'shoot' && !window.__snap.S.busy && !document.querySelector('#msg').hidden, null, { timeout: 30000 });
    for (const pick of [(i) => i.group === 'blade', (i) => i.word === 'cat', (i) => i.kind === 'fixed']) {
      await f.evaluate((src) => { const S = window.__snap.S; window.__snap.focusOn(S.items.find(eval(src))); }, pick.toString()); await sleep(700);
      await f.locator('#shutter').click(); await sleep(900);
    }
    await f.locator('#step-back').click(); await sleep(700);
    await f.locator('#msg .pill').click(); await sleep(1200);
    for (let g = 0; g < 8; g += 1) {
      const st = await f.evaluate(() => { const { S } = window.__snap, m = S.missions[S.mi]; return { phase: S.phase, mi: S.mi, kind: m?.kind, word: m?.word }; });
      if (st.phase !== 'mission') break;
      await f.evaluate(({ kind, word }) => { const { S } = window.__snap; window.__snap.focusOn(S.items.find((i) => (kind === 'word' ? i.kind === 'thing' : i.kind === 'plate') && i.word === word)); }, st);
      await sleep(600);
      await f.locator('#shutter').click();
      await f.waitForFunction((mi) => window.__snap.S.mi !== mi || window.__snap.S.phase !== 'mission', st.mi, { timeout: 12000 });
      await sleep(250);
    }
    await f.waitForFunction(() => window.__snap.S.screen === 'develop', null, { timeout: 12000 });
    for (let i = 0; i < 3; i += 1) {
      await sleep(1500);
      if (await f.evaluate(() => window.__snap.S.screen !== 'develop')) break;
      await f.waitForFunction(() => document.querySelector('.dev-opt:not([disabled])'));
      const n = await f.evaluate(() => window.__snap.answerNow());
      await f.locator('.dev-opt').nth(n).click();
    }
    await f.waitForFunction(() => window.__snap.S.screen === 'result', null, { timeout: 15000 });
    await sleep(600);
  }
  const albumView = async (p) => {
    await p.f.locator('.lobby-top [data-go=album]').click(); await sleep(700);
    return p.f.evaluate(() => ({ captions: [...document.querySelectorAll('.alb-card:not(.is-empty) .print-cap')].map((n) => n.textContent.trim()).filter(Boolean), cards: document.querySelectorAll('.alb-card:not(.is-empty)').length, n: document.querySelector('.alb-n')?.textContent }));
  };
  const album = (p) => p.f.evaluate(() => JSON.parse(JSON.stringify(window.__snap.album)));

  // ① 한 프로필에서 한 판 — 저장은 묶어서 가고 끝에 바로 올라간다
  play.state = empty(); play.revision = 0; play.mode = 'ok'; play.posts = 0;
  const phone = await profile('A_폰', { width: 390, height: 844 });
  await round(phone);
  await synced(phone);
  const first = await album(phone), firstNamed = namedOf(first), account = stored();
  check('한 판 뒤 계정에 앨범이 올라감', account && namedOf(account).join() === firstNamed.join(), `이름 ${firstNamed.length}개 · 카드 ${Object.keys(first.cards).length}장`);
  check('한 판의 계정 쓰기가 찍을 때마다 나가지 않음', play.posts <= 12, `쓰기 ${play.posts}번 · 앨범 ${Buffer.byteLength(play.state.records[KEY])}바이트`);
  check('이름 붙은 카드가 하나 이상', firstNamed.length > 0);
  await phone.shot('결과');
  await phone.ctx.close();

  // ② 저장이 빈 새 프로필, 같은 계정
  const postsBeforeFresh = play.posts;
  const fresh = await profile('B_새프로필', { width: 1280, height: 800 });
  const restored = await album(fresh);
  check('새 프로필에 앨범 · 이름이 그대로', namedOf(restored).join() === firstNamed.join() && Object.keys(restored.cards).length === Object.keys(first.cards).length);
  check('새 프로필에서 입구 앨범 수가 이름 수와 같음', Number(await fresh.f.locator('.lobby-top [data-go=album] em').textContent()) === firstNamed.length, await fresh.f.locator('.lobby-top [data-go=album] em').textContent());
  const seen = await albumView(fresh);
  check('새 프로필 앨범 화면에 손글씨 이름이 보임', seen.captions.length > 0 && seen.cards > 0, `${seen.n} · ${seen.captions.join(', ')}`);
  check('새 프로필에서도 다음 장소가 잠기지 않음', await fresh.f.evaluate(() => !document.querySelector('[data-album-place=union]')?.classList.contains('is-locked')));
  await fresh.shot('앨범');
  check('받기만 한 기기는 계정에 다시 쓰지 않음', play.posts === postsBeforeFresh, `${play.posts - postsBeforeFresh}번`);
  await fresh.ctx.close();

  // ③ 기기에만 쌓인 앨범(MVP 판)이 계정으로 — 사본은 남긴다
  play.state = empty(); play.revision = 0; play.posts = 0;
  const legacy = await profile('C_옮기기', { width: 390, height: 844 }, { seed: { [DEVICE]: JSON.stringify(first) } });
  await synced(legacy);
  check('기기 앨범이 계정으로 옮겨감', namedOf(stored()).join() === firstNamed.join());
  check('기기 사본은 지우지 않음', await legacy.page.evaluate((k) => !!localStorage.getItem(k), DEVICE));
  await legacy.ctx.close();

  // ④ 두 값이 다르면 이름 쪽으로 합침
  const target = firstNamed[0];
  const extra = ['dorm', 'post', 'pharmacy', 'office', 'bank', 'tree'].find((id) => !first.cards[id]);
  const remote = JSON.parse(JSON.stringify(first));
  remote.cards[target].named = false; delete remote.cards[target].namedAt;
  remote.cards[extra] = { place: 'gate', at: 5, named: true, namedAt: 6, kind: 'plate', q: first.cards[target].q, style: first.cards[target].style, vertical: false, scene: [] };
  const local = JSON.parse(JSON.stringify(first));
  play.state = empty(); play.state.records[KEY] = JSON.stringify(remote); play.revision = 1;
  const both = await profile('D_합치기', { width: 390, height: 844 }, { seed: { [DEVICE]: JSON.stringify(local) } });
  await synced(both);
  const merged = stored();
  check('합친 값이 계정에 — 어느 쪽의 이름도 잃지 않음', merged.cards[target]?.named === true && merged.cards[extra]?.named === true, `${target} · ${extra}`);
  check('합친 값이 기기 사본에도', await both.page.evaluate(([k, t, x]) => { const a = JSON.parse(localStorage.getItem(k)); return a.cards[t].named && a.cards[x].named; }, [DEVICE, target, extra]));
  const counted = await albumView(both);
  check('합친 앨범이 화면에 보임', counted.captions.length > 0, counted.captions.join(', '));
  await both.shot('앨범');
  await both.ctx.close();

  // ⑤ 저장 실패: 서버 거절 · 옛 호스트 · 연결 끊김
  play.state = empty(); play.revision = 0; play.mode = 'refuse';
  const refused = await profile('E_거절', { width: 390, height: 844 }, { seed: { [DEVICE]: JSON.stringify(first) }, expectFail: true });
  await refused.page.waitForFunction(() => window.__host.status().rejected >= 1, null, { timeout: 15000 });
  check('서버가 거절해도 앨범이 비지 않음', namedOf(await album(refused)).join() === firstNamed.join());
  await refused.page.reload({ waitUntil: 'load' });
  for (let i = 0; i < 100 && !refused.page.frames().some((f) => f.url().includes('/snap-words/')); i += 1) await sleep(100);
  const refusedFrame = refused.page.frames().find((f) => f.url().includes('/snap-words/'));
  await refusedFrame.waitForFunction(() => !!window.__snap);
  check('거절 뒤 다시 열어도 비지 않음', namedOf(await refusedFrame.evaluate(() => JSON.parse(JSON.stringify(window.__snap.album)))).join() === firstNamed.join());
  await refused.ctx.close();

  play.mode = 'ok'; play.state = empty(); play.revision = 0; play.posts = 0;
  const oldHost = await profile('F_옛호스트', { width: 390, height: 844 }, { seed: { [DEVICE]: JSON.stringify(first) }, old: true });
  check('옛 호스트에서도 앨범이 비지 않음', namedOf(await album(oldHost)).join() === firstNamed.join());
  check('옛 호스트는 계정에 쓰지 않음', play.posts === 0 && !stored());
  await oldHost.f.evaluate(() => { window.__snap.albumStore.saveNow(); });
  check('옛 호스트에서 저장해도 판이 안 깨짐', (await oldHost.f.evaluate(() => window.__snap.albumStore.status().account)) === false);
  await oldHost.ctx.close();

  const offline = await profile('G_끊김', { width: 390, height: 844 }, { expectFail: true });
  play.mode = 'down';
  await offline.f.evaluate(() => { const { album, albumStore } = window.__snap; album.cards.cat = { place: 'gate', at: 9, named: true, namedAt: 10, kind: 'thing', q: null, style: null, vertical: false, scene: [] }; albumStore.saveNow(); });
  await offline.page.waitForFunction(() => window.__host.status().phase === 'offline', null, { timeout: 15000 });
  check('끊긴 동안 앨범이 비지 않음', (await album(offline)).cards.cat?.named === true);
  check('끊긴 동안 기다리는 기록이 기기에 남음', (await offline.page.evaluate(() => window.__host.status().pending)) >= 1);
  play.mode = 'ok';
  await offline.page.evaluate(() => window.__host.retry());
  await synced(offline);
  check('다시 연결되면 계정에 올라감', stored()?.cards.cat?.named === true);
  await offline.ctx.close();

  check('콘솔 오류 · 실패 요청 없음', errors.length === 0, errors.slice(0, 4).join(' | '));
  await Promise.race([browser.close(), sleep(4000)]).catch(() => {});
  fs.writeFileSync(path.join(OUT, '계정저장.json'), `${JSON.stringify(checks, null, 1)}\n`);
  const bad = checks.filter((c) => !c.ok);
  console.log(bad.length ? `✗ ${bad.length}/${checks.length} 실패` : `✓ ${checks.length}건 모두 통과`);
  server.close();
  process.exit(bad.length ? 1 : 0);
}
main().catch((e) => { console.error(String(e?.stack || e).slice(0, 1200)); process.exit(2); });
