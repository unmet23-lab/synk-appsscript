'use strict';
// 선택 공개 2단계 「꺼진 판 결과 대조」(설계 주인 11-20 18:30): 라이브 synk.im/world/ 위에 덧씌움 폴더들을 차례로 덮어(page.route) 띄우고,
// 같은 계정 상태 · 같은 가짜 계정 서버에서 첫 실행 걸음(언어 · 한글 · 튜터) → 홈 첫 화면 → 아래 탭마다 화면 글 → 나 칸 → 계정 서버 요청 ·
// 이 기기 저장소를 적는다. 진짜 계정 서버로는 아무 요청도 가지 않는다(계정 주소는 모두 여기서 답한다). synk.im에는 GET만 보내고, 그 밖의
// 바깥 주소는 막는다. 공개본은 바꾸지 않는다.
//   node offcompare.cjs <결과 폴더> <판 이름> <덧씌움 폴더(world/ · atlas/를 담음)…>   — 앞 폴더가 먼저 쓰인다
//   STATES=guest,guest-arrived,login-noclass,login-class,login-exam1,login-exam3 · VIEW=390|1440
const path = require('node:path'), fs = require('node:fs');
const { chromium } = require(require.resolve('playwright', { paths: ['C:/Users/q1212/Documents/SYNK-appsscript/node_modules'] }));
const [OUT_ARG, LABEL, ...OVERLAY_ARGS] = process.argv.slice(2);
if (!OUT_ARG || !LABEL) throw Error('usage: offcompare.cjs <out> <label> <overlay…>');
const OUT = path.resolve(OUT_ARG), OVERLAYS = OVERLAY_ARGS.map(p => path.resolve(p));
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain' };
const API = 'https://qiwxeddwwnzkwalpsuty.supabase.co';
const A = '11111111-1111-4111-8111-111111111111', C = '22222222-2222-4222-8222-222222222222';
const BASE_TIME = Date.parse('2026-11-21T10:00:00+09:00');
const VIEWS = { 390: { width: 390, height: 844 }, 1440: { width: 1440, height: 900 } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
// 실제 계정 서버(SYNK-talk synk-play)가 새 계정에 내는 빈 놀이 상태(읽기만 — 공용 사본은 고치지 않는다)
const PLAY_RUNTIME = require("C:/Users/q1212/Documents/SYNK-talk/supabase/functions/_shared/synk-play-runtime.js");
const ARRIVAL = JSON.stringify({ version: 1, stage: 'left', dream: 'idol', name: '민지', scenes: [] });

// 상태마다: 이 기기 저장소 씨앗(local) · 로그인 세션 여부 · 반 · 놀이 기록(synk-play records)
function scenario(name, extras) {
  const base = { name, local: {}, login: false, classroom: false, records: {} };
  if (name === 'guest') return base;
  if (name === 'guest-arrived') return { ...base, local: { 'synk.world.arrival.v1:guest': ARRIVAL } };
  if (name === 'login-noclass') return { ...base, login: true };
  if (name === 'login-class') return { ...base, login: true, classroom: true };
  if (name === 'login-exam1' || name === 'login-exam3') return { ...base, login: true, records: extras?.[name] || {} };
  throw Error('unknown state ' + name);
}

function overlayFile(rel) {
  for (const root of OVERLAYS) {
    const file = path.join(root, rel);
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return { file, root };
  }
  return null;
}

async function runState(st, viewName) {
  const browser = await chromium.launch({ executablePath: 'C:/Users/q1212/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe' });
  const ctx = await browser.newContext({ viewport: VIEWS[viewName], deviceScaleFactor: 1, locale: 'ko-KR', timezoneId: 'Asia/Seoul', serviceWorkers: 'block', reducedMotion: 'reduce' });
  // 두 판이 같은 무작위 · 같은 날짜에서 돌게 한다(오프닝 · 계획 줄이 날짜와 무작위에 기대므로). 시각은 기준 시각에서 실제 흐름만큼 간다.
  await ctx.addInitScript(({ seed, base }) => {
    let s = seed >>> 0;
    Math.random = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    const RealDate = Date, t0 = performance.now();
    const now = () => base + Math.floor(performance.now() - t0);
    function FakeDate(...a) { if (!new.target) return new RealDate(now()).toString(); return a.length ? new RealDate(...a) : new RealDate(now()); }
    FakeDate.prototype = RealDate.prototype; FakeDate.now = now; FakeDate.parse = RealDate.parse; FakeDate.UTC = RealDate.UTC;
    Object.setPrototypeOf(FakeDate, RealDate);
    globalThis.Date = FakeDate;
  }, { seed: 20261121, base: BASE_TIME });
  await ctx.addInitScript(({ local, login }) => {
    try {
      if (location.hostname !== 'synk.im' || window.top !== window) return;
      if (!sessionStorage.getItem('__seeded')) {
        for (const [k, v] of Object.entries(local)) localStorage.setItem(k, v);
        if (login) sessionStorage.setItem('synk.oauth.session.world', JSON.stringify({ access_token: 'synthetic-compare-token', refresh_token: null, expires_at: Date.now() + 3600000 }));
        sessionStorage.setItem('__seeded', '1');
      }
    } catch { /* 저장소 없음 */ }
  }, { local: st.local, login: st.login });
  await ctx.addInitScript(() => {
    window.__idbOpens = [];
    try { const open = indexedDB.open.bind(indexedDB); indexedDB.open = (name, ...rest) => { window.__idbOpens.push(String(name)); return open(name, ...rest); }; } catch { /* 없음 */ }
  });

  const calls = [], blocked = [], served = new Set(), worldGets = [], errors = [], failed = [];
  let learning = { enabled: true, revision: 1 }, playRevision = 0;
  const empty = PLAY_RUNTIME.model.emptyPlayState(); const playState = { ...empty, records: { ...empty.records, ...st.records } };
  const learningEvents = [];
  const reply = (route, status, data) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data), headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS' } });
  async function api(route) {
    const req = route.request(), target = new URL(req.url());
    if (req.method() === 'OPTIONS') return reply(route, 200, {});
    let body = null; try { body = req.postDataJSON(); } catch { body = req.postData(); }
    const p = target.pathname;
    calls.push({ method: req.method(), path: p, query: [...target.searchParams.entries()].sort(), body });
    if (p.endsWith('/synk-account')) {
      if (body?.action === 'learning-consent') learning = { enabled: body.enabled, revision: learning.revision + 1 };
      return reply(route, 200, body ? { ok: true, refreshRevoked: true } : { ok: true, account: { synk_user_id: A, status: 'active' }, learning, capabilities: { learningSync: true }, sessions: [{ id: C, current: true, revoked: false, product: 'world' }] });
    }
    if (p.endsWith('/synk-play')) {
      if (body && typeof body === 'object') {
        if (body.action === 'progress' && Array.isArray(body.changes)) for (const ch of body.changes) { if (ch.value === null) delete playState.records[ch.key]; else playState.records[ch.key] = ch.value; }
        return reply(route, 200, { ok: true, scope: 'synk-play', accountId: A, revision: ++playRevision, state: structuredClone(playState) });
      }
      return reply(route, 200, { ok: true, scope: 'synk-play', accountId: A, revision: playRevision, state: structuredClone(playState) });
    }
    if (p.endsWith('/synk-learning')) {
      if (!learning.enabled) return reply(route, 403, { ok: false, error: { code: 'LEARNING_DISABLED' } });
      if (target.searchParams.get('view') === 'memory' || body?.memory) return reply(route, 200, { ok: true, revision: learning.revision, entries: body?.memory || [] });
      if (body?.events) { learningEvents.push(...body.events); return reply(route, 200, { ok: true, revision: learning.revision, accepted: body.events.map(e => e.id) }); }
      return reply(route, 200, { ok: true, revision: learning.revision, events: learningEvents.slice(Number(target.searchParams.get('after')) || 0), cursor: learningEvents.length, hasMore: false });
    }
    if (p.endsWith('/synk-world-v1/bootstrap')) return reply(route, 200, { ok: true, accountId: A, revision: 1, avatar: { characterId: 'mongle', slots: { body: '', neck: '' } }, inventory: [{ itemId: 'mongle-apron-starter' }], activeRun: null });
    if (p.endsWith('/synk-town/entry')) return reply(route, 200, { ok: true, accountId: A, allowed: true, entryVerified: true, access: 'trial' });
    if (p.includes('/synk-town/')) return reply(route, 200, { ok: true, accountId: A });
    if (p === '/functions/v1/me2-photo/api') return reply(route, 200, { ok: true, accountId: A, status: 'off' });
    if (p.endsWith('/synk-classroom/api/world/homework')) return reply(route, 200, { ok: true, mode: 'account-linked', accountId: A, classes: [], emptyReason: st.classroom ? 'NO_HOMEWORK_PLAN' : 'NO_CLASS' });
    if (p.endsWith('/functions/v1/classroom')) {
      if (!st.classroom) return reply(route, 401, { contract_ver: 'c16', ok: false, error: { code: 'AUTH_REQUIRED', message: '다시 로그인해 주세요', retryable: false } });
      return reply(route, 200, { contract_ver: 'c16', ok: true, classes: [{ class_id: C, display_name: '합성 해바라기반', video_privacy: 'private', playlist_url: null, meeting_url: null, sessions: [{ session_key: 'w1', title: '1주 차 수업', starts_at: '2026-11-23T10:00:00+09:00', ends_at: '2026-11-23T11:00:00+09:00', status: 'scheduled', watch_url: null }] }], empty_reason: null, server_time: new Date(BASE_TIME).toISOString() });
    }
    if (p.endsWith('/synk-personal')) return reply(route, 403, { ok: false, error: { code: 'PRODUCT_FORBIDDEN' } });
    if (p.endsWith('/synk-classroom/api/classes')) return reply(route, 200, { ok: true, mode: 'account-linked', classes: st.classroom ? [{ id: C, role: 'learner', name: '합성 해바라기반' }] : [], learnerId: st.classroom ? A : null, staffId: null });
    if (p.endsWith('/synk-classroom/api/course')) return reply(route, 200, { ok: true, tasks: [] });
    if (p.startsWith('/auth/v1/logout')) return reply(route, 204, {});
    calls[calls.length - 1].unknown = true;
    return reply(route, 200, { ok: true });
  }
  await ctx.route('**/*', async route => {
    const req = route.request(), u = new URL(req.url());
    if (u.origin === API) return api(route);
    if (u.hostname === 'synk.im') {
      if (!['GET', 'HEAD'].includes(req.method())) { blocked.push(`${req.method()} ${u.pathname}`); return route.abort('blockedbyclient'); }
      const rel = decodeURIComponent(u.pathname).replace(/^\//, '');
      if ((rel.startsWith('world/') || rel.startsWith('atlas/')) && !rel.endsWith('/')) {
        const hit = overlayFile(rel);
        if (hit) { served.add(rel); return route.fulfill({ status: 200, contentType: TYPES[path.extname(hit.file)] || 'application/octet-stream', body: fs.readFileSync(hit.file) }); }
      }
      return route.continue();
    }
    if (u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    blocked.push(`${req.method()} ${u.origin}${u.pathname}`);
    return route.abort('blockedbyclient');
  });
  const page = await ctx.newPage();
  page.on('request', r => { const u = new URL(r.url()); if (u.hostname === 'synk.im') worldGets.push(u.pathname); });
  page.on('dialog', d => d.accept().catch(() => {}));
  page.on('pageerror', e => errors.push('pageerror ' + String(e).slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console ' + m.text().slice(0, 300)); });
  page.on('response', r => { if (r.status() >= 400 && !r.url().startsWith(API)) failed.push(`${r.status()} ${r.url().replace(/\?.*$/, '')}`); });

  const tag = `${st.name}-${viewName}-${LABEL}`;
  const text = async () => {
    const parts = [];
    for (const f of page.frames()) { try { parts.push((await f.evaluate(() => document.body?.innerText || '')).replace(/\s+/g, ' ').trim()); } catch { parts.push('(못 읽음)'); } }
    return parts.filter(Boolean).join(' | ').slice(0, 30000);
  };
  const steps = [];
  await page.goto('https://synk.im/world/?opening=off', { waitUntil: 'domcontentloaded', timeout: 90000 });
  // 첫 실행 걸음: 화면 언어(한국어) → 한글 읽기(읽을 수 있어요) → 튜터(몽글) — 계정 화면 시험(qa/account-browser.test.mjs)과 같은 차례
  let tutors = null;
  for (let round = 0; round < 14; round++) {
    await sleep(1500);
    const s = await page.evaluate(() => ({
      lang: !!document.querySelector('[data-lang-picker]'),
      hangul: !!document.querySelector('dialog[open] [data-first-hangul]'),
      tutor: !!document.querySelector('.tutor-option'),
      ready: document.querySelector('.world-shell')?.dataset.entry === 'ready',
    })).catch(() => ({}));
    if (s.lang) { steps.push('언어'); await page.locator('[data-lang-choice="ko"]').click().catch(() => {}); await page.locator('[data-lang-confirm]').click().catch(() => {}); continue; }
    if (s.hangul) { steps.push('한글'); await page.locator('dialog[open] [data-first-hangul="reads"]').click().catch(() => {}); continue; }
    if (s.tutor) {
      steps.push('튜터');
      tutors = await page.evaluate(() => [...document.querySelectorAll('.tutor-option')].map(o => `${o.dataset.tutorId || ''}:${(o.innerText || '').replace(/\s+/g, ' ').trim()}`)).catch(() => null);
      const mongle = page.locator('.tutor-option[data-tutor-id="mongle"]');
      if (await mongle.count()) await mongle.first().click().catch(() => {}); else await page.locator('.tutor-option').first().click().catch(() => {});
      await page.locator('.tutor-primary').first().click().catch(() => {});
      await sleep(600);
      await page.locator('.tutor-primary[data-tutor-action="finish"]').click().catch(() => {});
      continue;
    }
    if (s.ready) { steps.push('준비'); break; }
  }
  await sleep(3500);
  const views = [];
  views.push({ name: '홈', text: await text() });
  await page.screenshot({ path: path.join(OUT, `${tag}-홈.png`) });
  // 열린 칸(배우기 · 놀이 · 나 시트)을 닫는다 — 열린 칸이 아래 탭을 덮어 다음 탭이 눌리지 않는다.
  const closePanels = async () => {
    for (let i = 0; i < 3; i++) {
      const closer = page.locator('#panel-close:visible');
      if (!(await closer.count().catch(() => 0))) break;
      await closer.first().click({ timeout: 3000 }).catch(() => {});
      await sleep(900);
    }
  };
  const clicked = [];
  // 아래 탭마다(지금 판 탭 이름 그대로) 화면 글
  const navs = await page.evaluate(() => [...document.querySelectorAll('.world-nav [data-view]')].map(b => b.dataset.view)).catch(() => []);
  for (const v of navs) {
    await closePanels();
    const ok = await page.locator(`.world-nav [data-view="${v}"]`).first().click({ timeout: 5000 }).then(() => true, () => false);
    clicked.push(`${v}:${ok ? '눌림' : '못 누름'}`);
    await sleep(2500);
    views.push({ name: `탭:${v}`, text: await text() });
    await page.screenshot({ path: path.join(OUT, `${tag}-탭-${v}.png`) });
  }
  await closePanels();
  if (navs.length) { await page.locator(`.world-nav [data-view="${navs[0]}"]`).first().click({ timeout: 5000 }).catch(() => {}); await sleep(1500); }
  // 「내 위치 보기」 — 이번 주 계획 줄과 진단 · 시험 목표 글이 나오는 곳
  {
    await closePanels();
    const pos = page.getByRole('button', { name: '내 위치 보기' });
    const ok = (await pos.count().catch(() => 0)) ? await pos.first().click({ timeout: 5000 }).then(() => true, () => false) : false;
    clicked.push(`내 위치:${ok ? '눌림' : '못 누름'}`);
    await sleep(3500);
    views.push({ name: '내 위치', text: await text() });
    await page.screenshot({ path: path.join(OUT, `${tag}-내위치.png`) });
    await closePanels();
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(1200);
  }
  // 나 칸
  await closePanels();
  if (await page.locator('.profile-control[data-view="me"]').count()) {
    const ok = await page.locator('.profile-control[data-view="me"]').first().click({ timeout: 5000 }).then(() => true, () => false);
    clicked.push(`나:${ok ? '눌림' : '못 누름'}`);
    await sleep(3000);
    views.push({ name: '나', text: await text() });
    await page.screenshot({ path: path.join(OUT, `${tag}-나.png`) });
    await closePanels();
  }
  steps.push('누름 ' + clicked.join(' '));
  // 첫 레슨 풀기(저장 요청 · 학습 사건 · 판정 자격을 견주려고): 배우기 → 시작하기 → 장면 다음 → 보기(맨 앞) → 문제 다음 …
  // 같은 차례 규칙으로 두 판을 걷는다. 누를 것이 두 번 연달아 없으면 멈춘다.
  {
    await closePanels();
    await page.locator('.world-nav [data-view="packs"]').first().click({ timeout: 5000 }).catch(() => {});
    await sleep(2000);
    const lessonLog = [];
    const order = ['[data-life-begin]:visible', '[data-life-scene-next]:not([disabled]):visible', '[data-life-choice]:not([disabled]):visible', '[data-life-question-next]:not([disabled]):visible', '[data-life-finish]:not([disabled]):visible', '[data-life-done]:not([disabled]):visible'];
    let idle = 0;
    for (let i = 0; i < 40 && idle < 2; i++) {
      let hit = null;
      for (const sel of order) {
        const l = page.locator(sel);
        if (await l.count().catch(() => 0)) {
          const label = ((await l.first().innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim().slice(0, 30);
          const ok = await l.first().click({ timeout: 4000 }).then(() => true, () => false);
          hit = `${sel.replace(/:.*$/, '')}[${label}]${ok ? '' : '!'}`;
          break;
        }
      }
      if (!hit && i === 0) { const b = page.getByRole('button', { name: /시작하기/ }); if (await b.count().catch(() => 0)) { await b.first().click({ timeout: 4000 }).catch(() => {}); hit = '시작하기(이름)'; } }
      if (hit) { lessonLog.push(hit); idle = 0; } else idle++;
      await sleep(1600);
    }
    steps.push('레슨 ' + lessonLog.join(' > '));
    await sleep(4000);
    views.push({ name: '레슨 뒤', text: await text() });
    await page.screenshot({ path: path.join(OUT, `${tag}-레슨뒤.png`) });
    await closePanels();
    await sleep(3000);
  }
  // 지하철 계획 장면(설계 주인 11-21): 레슨을 하나 끝낸 뒤에는 이번 주 계획 후보에 환승 러시(world.play.subway)가 든다 — 「내 위치」를 다시 연다.
  {
    await closePanels();
    if (navs.length) { await page.locator(`.world-nav [data-view="${navs[0]}"]`).first().click({ timeout: 5000 }).catch(() => {}); await sleep(1500); }
    const pos = page.getByRole('button', { name: '내 위치 보기' });
    const ok = (await pos.count().catch(() => 0)) ? await pos.first().click({ timeout: 5000 }).then(() => true, () => false) : false;
    await sleep(3500);
    const t = await text();
    const plan = await page.evaluate(() => { try { return window.__synkWorld?.plan?.() ?? null; } catch { return '(던짐)'; } }).catch(() => null);
    views.push({ name: '레슨 뒤 내 위치', text: t });
    steps.push(`레슨 뒤 내 위치:${ok ? '눌림' : '못 누름'} · 환승 러시 글 ${t.includes('환승 러시') ? '있음' : '없음'}`);
    if (plan != null) views.push({ name: '레슨 뒤 계획 값', text: JSON.stringify(plan).slice(0, 30000) });
    await page.screenshot({ path: path.join(OUT, `${tag}-레슨뒤내위치.png`) });
    await closePanels();
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(1200);
  }
  // 계정 화면 두루 걷기(설계 주인 11-21 「대표 계정이 계정 화면을 모두 지나는지」 · 지도: 계정 화면 지도 11-21) — 장면마다 글과 계정 요청 수를 적는다.
  const 장면 = async (이름, 몸) => {
    const 앞 = calls.length, 앞사건 = learningEvents.length;
    let 결과 = '';
    try { 결과 = (await 몸()) || ''; } catch (e) { 결과 = `던짐 ${String(e).slice(0, 120)}`; }
    await sleep(1500);
    views.push({ name: 이름, text: await text() });
    steps.push(`${이름}: ${결과} · 계정 요청 ${calls.length - 앞} · 학습 사건 ${learningEvents.length - 앞사건}`);
    await page.screenshot({ path: path.join(OUT, `${tag}-${이름.replace(/[^\p{L}\p{N}]+/gu, '')}.png`) }).catch(() => {});
    await closePanels();
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(900);
  };
  const 누르기 = async (sel, 시간 = 5000) => { const l = page.locator(sel); return (await l.count().catch(() => 0)) ? l.first().click({ timeout: 시간 }).then(() => true, () => false) : false; };
  const 집으로 = async () => { await closePanels(); if (navs.length) { await 누르기(`.world-nav [data-view="${navs[0]}"]`); await sleep(1200); } };
  await 장면('설정', async () => { await 집으로(); return `톱니 ${await 누르기('#settings-open') ? '눌림' : '없음'}`; });
  await 장면('마을', async () => { await closePanels(); await 누르기('.world-nav [data-view="play"]'); await sleep(1500); return `마을 ${await 누르기('[data-world="town"]') ? '눌림' : '없음'}`; });
  // 게임 학습 기록(atlas/game-learning.js createGame): 말의 리듬 한 판의 앞부분 — 판 단추(O)를 누를 때마다 present · answer가 기록된다
  await 장면('리듬 게임', async () => {
    await closePanels(); await 누르기('.world-nav [data-view="play"]'); await sleep(1500);
    if (!await 누르기('button[data-game="rhythm"]')) return '리듬 단추 없음';
    let frame = null;
    for (let i = 0; i < 20 && !frame; i++) { await sleep(1000); frame = page.frames().find(f => /korean-rhythm/.test(f.url())) || null; }
    if (!frame) return '게임 틀 없음';
    await sleep(2500);
    const 시작 = await frame.locator('#start-button').first().click({ timeout: 8000 }).then(() => true, () => false);
    let 누름 = 0;
    for (let i = 0; i < 24; i++) { await sleep(1200); const pad = frame.locator('#pad-0:not([disabled])'); if (await pad.count().catch(() => 0)) { if (await pad.first().click({ timeout: 1500 }).then(() => true, () => false)) 누름++; } }
    await sleep(2000);
    return `시작 ${시작 ? '눌림' : '못 누름'} · 판 단추 ${누름}번`;
  });
  // 리듬 보충 문항(korean-rhythm/supplemental.json): 「내 위치」의 듣기 능력 → 짧은 듣기 연습
  await 장면('보충 문항', async () => {
    await 집으로();
    const pos = page.getByRole('button', { name: '내 위치 보기' });
    if (!((await pos.count().catch(() => 0)) && await pos.first().click({ timeout: 5000 }).then(() => true, () => false))) return '내 위치 못 엶';
    await sleep(3000);
    const 칸 = page.locator('details.wpos-skill[data-skill^="ko.listening"] > summary');
    const 펼침 = (await 칸.count().catch(() => 0)) ? await 칸.first().click({ timeout: 4000 }).then(() => true, () => false) : false;
    await sleep(1200);
    const 연습 = await 누르기('details.wpos-skill[data-skill^="ko.listening"] button[data-position-practice]') || await 누르기('button[data-position-practice]');
    await sleep(2500);
    const 듣기 = page.getByRole('button', { name: /대화 듣기/ });
    const 들음 = (await 듣기.count().catch(() => 0)) ? await 듣기.first().click({ timeout: 4000 }).then(() => true, () => false) : false;
    await sleep(7000);
    const 고름 = page.getByRole('button', { name: /맞아요/ });
    const 답 = (await 고름.count().catch(() => 0)) ? await 고름.first().click({ timeout: 4000 }).then(() => true, () => false) : false;
    return `듣기 칸 ${펼침 ? '펼침' : '없음'} · 연습 ${연습 ? '눌림' : '없음'} · 대화 듣기 ${들음 ? '눌림' : '없음'} · 답 ${답 ? '고름' : '못 고름'}`;
  });
  // 나 칸: 배움 기록 동의 끄고 켜기 · 옷장 · 내 반 연결(초대 코드 미리 보기)
  if (await page.locator('.profile-control[data-view="me"]').count().catch(() => 0)) {
    await 장면('동의 끄고 켜기', async () => {
      await 집으로(); await 누르기('.profile-control[data-view="me"]'); await sleep(2500);
      const 끔 = await 누르기('[data-world-learning]'); await sleep(2500);
      const 켬 = await 누르기('[data-world-learning]'); await sleep(2500);
      return `동의 칸 ${끔 ? '끔' : '없음'}${켬 ? ' · 켬' : ''}`;
    });
    await 장면('옷장', async () => { await 집으로(); await 누르기('.profile-control[data-view="me"]'); await sleep(2500); return `옷장 ${await 누르기('[data-world="wardrobe"]') ? '눌림' : '없음'}`; });
    await 장면('내 반 연결', async () => {
      await 집으로(); await 누르기('.profile-control[data-view="me"]'); await sleep(2500);
      const 칸 = page.locator('#world-classroom-entry input[name="invite"]');
      if (!(await 칸.count().catch(() => 0))) return '초대 칸 없음';
      await 칸.first().fill('SYNTH-CODE').catch(() => {});
      const b = page.getByRole('button', { name: /이름과 반 확인/ });
      return `미리 보기 ${(await b.count().catch(() => 0)) && await b.first().click({ timeout: 4000 }).then(() => true, () => false) ? '눌림' : '없음'}`;
    });
  }
  await sleep(2000);
  const after = await page.evaluate(() => {
    const dump = s => Object.fromEntries(Object.keys(s).sort().map(k => [k, s.getItem(k)]));
    let life = null, screen = null;
    try { life = window.__synkWorld?.life?.() ?? null; } catch { life = '(던짐)'; }
    try { screen = window.__synkWorld?.screen?.() ?? null; } catch { screen = '(던짐)'; }
    return { local: dump(localStorage), session: Object.keys(sessionStorage).sort(), idb: window.__idbOpens || [], life, screen, status: window.__synkWorld?.client?.status ?? null };
  }).catch(e => ({ error: String(e) }));
  // 로그아웃(마지막 · 로그인 상태만): 나 → 로그아웃 — 계정 서버 요청과 남는 이 기기 저장소 열쇠를 적는다
  let afterLogout = null;
  if (st.login && await page.locator('.profile-control[data-view="me"]').count().catch(() => 0)) {
    await 장면('로그아웃', async () => { await 집으로(); await 누르기('.profile-control[data-view="me"]'); await sleep(2500); return `로그아웃 ${await 누르기('[data-world="logout"]') ? '눌림' : '없음'}`; });
    await sleep(3000);
    afterLogout = await page.evaluate(() => ({ local: Object.keys(localStorage).sort(), session: Object.keys(sessionStorage).sort() })).catch(() => null);
  }
  await browser.close();
  const result = { label: LABEL, state: st.name, view: viewName, steps, tutors, views, calls, blocked, served: [...served].sort(), worldGets: [...new Set(worldGets)].sort(), errors, failed, after, afterLogout, playRecords: playState.records, learningEvents };
  fs.writeFileSync(path.join(OUT, `${tag}.json`), JSON.stringify(result, null, 1));
  return result;
}

(async () => {
  const extrasFile = process.env.EXTRAS;
  const extras = extrasFile ? JSON.parse(fs.readFileSync(extrasFile, 'utf8')) : {};
  const states = (process.env.STATES || 'guest,guest-arrived,login-noclass,login-class').split(',').map(s => s.trim()).filter(Boolean);
  const viewName = process.env.VIEW || '390';
  for (const name of states) {
    const st = scenario(name, extras);
    const t0 = Date.now();
    try {
      const r = await runState(st, viewName);
      console.log(`${name} ${viewName} ${LABEL}: 걸음 ${r.steps.join('>')} · 탭 ${r.views.length} · 계정 요청 ${r.calls.length} · 막음 ${r.blocked.length} · 덧씌움 ${r.served.length} · 오류 ${r.errors.length} · 실패 ${r.failed.length} · ${Math.round((Date.now() - t0) / 1000)}초`);
    } catch (e) { console.log(`${name} ${viewName} ${LABEL}: 실패 ${String(e).slice(0, 300)}`); }
  }
})();
