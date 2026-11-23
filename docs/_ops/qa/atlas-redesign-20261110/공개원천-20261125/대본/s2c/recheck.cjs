'use strict';
// 재확인 계정 장면(설계 주인 11-21): 라이브 지도판으로 1 · 7 · 30일 재확인이 잡혀 있는 계정을 후보로 열어, 그날 낼 재확인 항목과 날짜가 라이브와 같은지 본다.
// offcompare.cjs와 같은 가짜 계정 서버 · 덧씌움 · 시계. 두 꼴:
//   MODE=seed    앞선 날(SHIFT_DAYS일 전)에 첫 실행 걸음 → 다음 생활 레슨 하나를 끝까지 풀고, 이 기기 저장소 · 학습 사건 · 놀이 기록을 SEED_OUT에 적는다
//   MODE=view    그날(SHIFT_DAYS=0)에 SEED_IN을 심고 「내 위치」를 열어 재확인 카드(항목 · 세 칸의 상태와 날짜 · 열기 단추)를 적는다
//   node recheck.cjs <결과 폴더> <판 이름> <덧씌움 폴더…>   env: MODE · SHIFT_DAYS · SEED_IN · SEED_OUT · VIEW
const path = require('node:path'), fs = require('node:fs');
const { chromium } = require(require.resolve('playwright', { paths: ['C:/Users/q1212/Documents/SYNK-appsscript/node_modules'] }));
const [OUT_ARG, LABEL, ...OVERLAY_ARGS] = process.argv.slice(2);
if (!OUT_ARG || !LABEL) throw Error('usage: recheck.cjs <out> <label> <overlay…>');
const OUT = path.resolve(OUT_ARG), OVERLAYS = OVERLAY_ARGS.map(p => path.resolve(p));
fs.mkdirSync(OUT, { recursive: true });
const MODE = process.env.MODE || 'view', SHIFT = Number(process.env.SHIFT_DAYS || 0), VIEW = process.env.VIEW || '390';
const SEED = process.env.SEED_IN ? JSON.parse(fs.readFileSync(process.env.SEED_IN, 'utf8')) : { local: {}, learningEvents: [], playRecords: {}, learning: { enabled: true, revision: 1 } };
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain' };
const API = 'https://qiwxeddwwnzkwalpsuty.supabase.co';
const A = '11111111-1111-4111-8111-111111111111', C = '22222222-2222-4222-8222-222222222222';
const PLUS_HOURS = Number(process.env.PLUS_HOURS || 0), PICK = Number(process.env.PICK || 0);
const BASE_TIME = Date.parse('2026-11-21T10:00:00+09:00') - SHIFT * 86400000 + PLUS_HOURS * 3600000;
const VIEWS = { 390: { width: 390, height: 844 }, 1440: { width: 1440, height: 900 } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PLAY_RUNTIME = require('C:/Users/q1212/Documents/SYNK-talk/supabase/functions/_shared/synk-play-runtime.js');
const overlayFile = rel => { for (const root of OVERLAYS) { const file = path.join(root, rel); if (fs.existsSync(file) && fs.statSync(file).isFile()) return file; } return null; };

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Users/q1212/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe' });
  const ctx = await browser.newContext({ viewport: VIEWS[VIEW], deviceScaleFactor: 1, locale: 'ko-KR', timezoneId: 'Asia/Seoul', serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(({ seed, base }) => {
    let s = seed >>> 0;
    Math.random = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    const RealDate = Date, t0 = performance.now(), now = () => base + Math.floor(performance.now() - t0);
    function FakeDate(...a) { if (!new.target) return new RealDate(now()).toString(); return a.length ? new RealDate(...a) : new RealDate(now()); }
    FakeDate.prototype = RealDate.prototype; FakeDate.now = now; FakeDate.parse = RealDate.parse; FakeDate.UTC = RealDate.UTC;
    Object.setPrototypeOf(FakeDate, RealDate);
    globalThis.Date = FakeDate;
  }, { seed: 20261121 + SHIFT, base: BASE_TIME });
  await ctx.addInitScript(({ local }) => {
    try {
      if (location.hostname !== 'synk.im' || window.top !== window) return;
      if (!sessionStorage.getItem('__seeded')) {
        for (const [k, v] of Object.entries(local)) localStorage.setItem(k, v);
        sessionStorage.setItem('synk.oauth.session.world', JSON.stringify({ access_token: 'synthetic-compare-token', refresh_token: null, expires_at: Date.now() + 3600000 }));
        sessionStorage.setItem('__seeded', '1');
      }
    } catch { /* 저장소 없음 */ }
  }, { local: SEED.local || {} });
  const calls = [], errors = [];
  let learning = { ...(SEED.learning || { enabled: true, revision: 1 }) }, playRevision = 0;
  const empty = PLAY_RUNTIME.model.emptyPlayState(), playState = { ...empty, records: { ...empty.records, ...(SEED.playRecords || {}) } };
  const learningEvents = [...(SEED.learningEvents || [])];
  const reply = (route, status, data) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data), headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS' } });
  async function api(route) {
    const req = route.request(), target = new URL(req.url());
    if (req.method() === 'OPTIONS') return reply(route, 200, {});
    let body = null; try { body = req.postDataJSON(); } catch { body = req.postData(); }
    const p = target.pathname;
    calls.push({ method: req.method(), path: p, query: [...target.searchParams.entries()].sort() });
    if (p.endsWith('/synk-account')) {
      if (body?.action === 'learning-consent') learning = { enabled: body.enabled, revision: learning.revision + 1 };
      return reply(route, 200, body ? { ok: true, refreshRevoked: true } : { ok: true, account: { synk_user_id: A, status: 'active' }, learning, capabilities: { learningSync: true }, sessions: [{ id: C, current: true, revoked: false, product: 'world' }] });
    }
    if (p.endsWith('/synk-play')) {
      if (body && typeof body === 'object' && body.action === 'progress' && Array.isArray(body.changes)) for (const ch of body.changes) { if (ch.value === null) delete playState.records[ch.key]; else playState.records[ch.key] = ch.value; }
      return reply(route, 200, { ok: true, scope: 'synk-play', accountId: A, revision: body ? ++playRevision : playRevision, state: structuredClone(playState) });
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
    if (p.endsWith('/synk-classroom/api/world/homework')) return reply(route, 200, { ok: true, mode: 'account-linked', accountId: A, classes: [], emptyReason: 'NO_CLASS' });
    if (p.endsWith('/functions/v1/classroom')) return reply(route, 401, { contract_ver: 'c16', ok: false, error: { code: 'AUTH_REQUIRED', message: '다시 로그인해 주세요', retryable: false } });
    if (p.endsWith('/synk-personal')) return reply(route, 403, { ok: false, error: { code: 'PRODUCT_FORBIDDEN' } });
    if (p.endsWith('/synk-classroom/api/classes')) return reply(route, 200, { ok: true, mode: 'account-linked', classes: [], learnerId: null, staffId: null });
    if (p.endsWith('/synk-classroom/api/course')) return reply(route, 200, { ok: true, tasks: [] });
    if (p.startsWith('/auth/v1/logout')) return reply(route, 204, {});
    return reply(route, 200, { ok: true });
  }
  await ctx.route('**/*', async route => {
    const req = route.request(), u = new URL(req.url());
    if (u.origin === API) return api(route);
    if (u.hostname === 'synk.im') {
      if (!['GET', 'HEAD'].includes(req.method())) return route.abort('blockedbyclient');
      const rel = decodeURIComponent(u.pathname).replace(/^\//, '');
      if ((rel.startsWith('world/') || rel.startsWith('atlas/')) && !rel.endsWith('/')) { const hit = overlayFile(rel); if (hit) return route.fulfill({ status: 200, contentType: TYPES[path.extname(hit)] || 'application/octet-stream', body: fs.readFileSync(hit) }); }
      return route.continue();
    }
    if (u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    return route.abort('blockedbyclient');
  });
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept().catch(() => {}));
  page.on('pageerror', e => errors.push('pageerror ' + String(e).slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console ' + m.text().slice(0, 300)); });
  const tag = `recheck-${MODE}-${SHIFT}d${PLUS_HOURS ? `+${PLUS_HOURS}h` : ""}-${VIEW}-${LABEL}`, steps = [];
  const closePanels = async () => { for (let i = 0; i < 3; i++) { const c = page.locator('#panel-close:visible'); if (!(await c.count().catch(() => 0))) break; await c.first().click({ timeout: 3000 }).catch(() => {}); await sleep(900); } };
  await page.goto('https://synk.im/world/?opening=off', { waitUntil: 'domcontentloaded', timeout: 90000 });
  for (let round = 0; round < 14; round++) {
    await sleep(1500);
    const s = await page.evaluate(() => ({ lang: !!document.querySelector('[data-lang-picker]'), hangul: !!document.querySelector('dialog[open] [data-first-hangul]'), tutor: !!document.querySelector('.tutor-option'), ready: document.querySelector('.world-shell')?.dataset.entry === 'ready' })).catch(() => ({}));
    if (s.lang) { steps.push('언어'); await page.locator('[data-lang-choice="ko"]').click().catch(() => {}); await page.locator('[data-lang-confirm]').click().catch(() => {}); continue; }
    if (s.hangul) { steps.push('한글'); await page.locator('dialog[open] [data-first-hangul="reads"]').click().catch(() => {}); continue; }
    if (s.tutor) { steps.push('튜터'); const m = page.locator('.tutor-option[data-tutor-id="mongle"]'); if (await m.count()) await m.first().click().catch(() => {}); await page.locator('.tutor-primary').first().click().catch(() => {}); await sleep(600); await page.locator('.tutor-primary[data-tutor-action="finish"]').click().catch(() => {}); continue; }
    if (s.ready) { steps.push('준비'); break; }
  }
  await sleep(3000);
  const 재확인 = async () => {
    await closePanels();
    const pos = page.getByRole('button', { name: '내 위치 보기' });
    const ok = (await pos.count().catch(() => 0)) ? await pos.first().click({ timeout: 5000 }).then(() => true, () => false) : false;
    await sleep(4000);
    const cards = await page.evaluate(() => {
      const sec = document.querySelector('section.wpos-followups');
      return { 있음: !!sec, 글: sec ? sec.innerText.replace(/\s+/g, ' ').trim() : null, 카드: sec ? [...sec.querySelectorAll('li.wfol-card')].map(c => ({ 머리: (c.querySelector('.wfol-head')?.innerText || '').replace(/\s+/g, ' ').trim(), 지금: c.hasAttribute('data-due'), 칸: [...c.querySelectorAll('.wfol-steps > li')].map(s => ({ 상태: s.dataset.status, 글: s.innerText.replace(/\s+/g, ' ').trim() })), 열기: c.querySelector('[data-followup]')?.getAttribute('data-followup') || c.querySelector('[data-followup-life]')?.getAttribute('data-followup-life') || null })) : [] };
    }).catch(e => ({ 오류: String(e) }));
    await page.screenshot({ path: path.join(OUT, `${tag}-내위치.png`) }).catch(() => {});
    await closePanels(); await page.keyboard.press('Escape').catch(() => {}); await sleep(900);
    return { 열림: ok, ...cards };
  };
  let 레슨 = null;
  const 누르기 = async (order, max, done) => {
    const log = []; let idle = 0;
    for (let i = 0; i < max && idle < 3; i++) {
      if (done && await page.locator(done).count().catch(() => 0)) { log.push('끝'); break; }
      let hit = null;
      for (const sel of order) { const l = page.locator(sel); if (await l.count().catch(() => 0)) { const label = ((await l.first().innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim().slice(0, 24); const ok = await l.first().click({ timeout: 4000 }).then(() => true, () => false); hit = `${sel.replace(/:.*$/, '')}[${label}]${ok ? '' : '!'}`; break; } }
      if (hit) { log.push(hit); idle = 0; } else idle++;
      await sleep(1200);
    }
    return log;
  };
  if (MODE === 'seed') {
    레슨 = {};
    // ① 「내 위치」 읽기 짧은 연습(world-practice): 답이 맞든 틀리든 그 문항의 1 · 7 · 30일 재확인이 잡힌다.
    await closePanels();
    const pos = page.getByRole('button', { name: '내 위치 보기' });
    if (await pos.count().catch(() => 0)) await pos.first().click({ timeout: 5000 }).catch(() => {});
    await sleep(4000);
    const 고른 = await page.evaluate(pick => { const all = [...new Set([...document.querySelectorAll('[data-position-practice^="ko.reading"]')].map(x => x.dataset.positionPractice))]; const id = all[pick] || all[0]; const b = id && document.querySelector('[data-position-practice="' + id + '"]'); if (!b) return null; const d = b.closest('details'); if (d) d.open = true; b.scrollIntoView({ block: 'center' }); b.click(); return b.dataset.positionPractice; }, PICK).catch(() => null);
    if (고른) {
      await sleep(600);
      await page.waitForSelector('[data-practice-choice]:not([disabled]), [data-practice-done]', { timeout: 20000 }).catch(() => {});
      await sleep(800);
      const 열림 = await page.locator('[data-practice-choice]:not([disabled]), [data-practice-done]').count().catch(() => 0);
      if (!열림) { 레슨.연습안열림 = await page.evaluate(() => ({ 단추: [...document.querySelectorAll('[data-position-practice]')].map(b => b.dataset.positionPractice + '=' + b.innerText.replace(/\s+/g, ' ').trim()), 알림: [...document.querySelectorAll('.toast, [role=status], [aria-live]')].map(x => x.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean), 패널: (document.querySelector('#world-panel[open]')?.innerText || '').replace(/\s+/g, ' ').slice(0, 300) })).catch(e => String(e)); await page.screenshot({ path: path.join(OUT, tag + '-연습안열림.png') }).catch(() => {}); }
      레슨.연습 = [고른, ...(await 누르기(['[data-practice-choice]:not([disabled]):visible', '[data-practice-next]:not([disabled]):visible'], 30, '[data-practice-done]'))];
    } else 레슨.연습 = ['읽기 연습 단추 없음'];
    await sleep(3000); await closePanels(); await sleep(1500);
    // ② 생활 레슨 하나(배우기 → 지금 레슨): 끝나면 집으로.
    await page.locator('.world-nav [data-view="packs"]').first().click({ timeout: 5000 }).catch(() => {});
    await sleep(2500);
    const 레슨단추 = page.locator('.life-now [data-life-lesson]:visible');
    if (await 레슨단추.count().catch(() => 0)) {
      await 레슨단추.first().click({ timeout: 5000 }).catch(() => {});
      await sleep(2000);
      레슨.생활 = await 누르기(['[data-life-begin]:visible', '[data-life-scene-next]:not([disabled]):visible', '[data-life-choice]:not([disabled]):visible', '[data-life-question-next]:not([disabled]):visible'], 50, '.life-complete');
      await sleep(1500);
      await page.locator('[data-life-home]:visible').first().click({ timeout: 5000 }).catch(() => {});
    } else 레슨.생활 = ['지금 레슨 단추 없음'];
    steps.push(`연습 ${레슨.연습.length} · 생활 ${레슨.생활.length}`);
    await sleep(4000); await closePanels(); await sleep(2000);
  }
  const 카드 = await 재확인();
  await sleep(1500);
  // OPEN=1: 받을 재확인마다 「지금 확인」을 눌러 그날 실제로 나오는 문항(글 · 고를 답 번호)을 읽는다. 답은 내지 않는다.
  let 열어봄 = null;
  if (process.env.OPEN === '1') {
    열어봄 = [];
    for (const c of (카드.카드 || []).filter(x => x.열기)) {
      await closePanels(); await page.locator('[data-life-home]:visible').first().click({ timeout: 2000 }).catch(() => {}); await sleep(800);
      const pos = page.getByRole('button', { name: '내 위치 보기' });
      if (await pos.count().catch(() => 0)) await pos.first().click({ timeout: 5000 }).catch(() => {});
      await sleep(3500);
      const 눌림 = await page.evaluate(id => { const b = [...document.querySelectorAll('[data-followup], [data-followup-life]')].find(x => (x.dataset.followup || x.dataset.followupLife) === id); if (!b) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true; }, c.열기).catch(() => false);
      await page.waitForSelector('[data-practice-choice], [data-life-choice], [data-life-begin], [data-life-scene-next]', { timeout: 15000 }).catch(() => {});
      await sleep(1500);
      const 본 = await page.evaluate(() => {
        const stage = document.querySelector('[data-practice-stage]'), life = document.querySelector('[data-life-choice], [data-life-begin], [data-life-scene-next]');
        const box = stage || life?.closest('section, article, .life-session, .life-stage, main') || null;
        return { 곳: stage ? 'practice' : life ? 'life' : null, 글: box ? box.innerText.replace(/\s+/g, ' ').trim().slice(0, 700) : null, 답: [...document.querySelectorAll('[data-practice-choice], [data-life-choice]')].map(b => b.dataset.practiceChoice || b.dataset.lifeChoice).sort() };
      }).catch(e => ({ 오류: String(e) }));
      await page.screenshot({ path: path.join(OUT, `${tag}-열기-${c.열기.replace(/[^a-z0-9]+/gi, '_')}.png`) }).catch(() => {});
      열어봄.push({ 열기: c.열기, 눌림, ...본 });
      await page.locator('[data-practice-stop]:visible').first().click({ timeout: 2000 }).catch(() => {});
      await closePanels(); await page.locator('[data-life-home]:visible').first().click({ timeout: 2000 }).catch(() => {});
      await sleep(1500);
    }
  }
  const local = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)]))).catch(() => ({}));
  await browser.close();
  const result = { label: LABEL, mode: MODE, shiftDays: SHIFT, base: new Date(BASE_TIME).toISOString(), steps, 레슨, 재확인: 카드, 열어봄, 사건수: learningEvents.length, taskVersions: [...new Set(learningEvents.map(e => e.taskVersion || e.task_version).filter(Boolean))], errors, 요청: calls.length };
  fs.writeFileSync(path.join(OUT, `${tag}.json`), JSON.stringify(result, null, 1));
  if (process.env.SEED_OUT) fs.writeFileSync(process.env.SEED_OUT, JSON.stringify({ local, learningEvents, playRecords: playState.records, learning }, null, 1));
  console.log(`${tag}: ${steps.join('>')} · 재확인 카드 ${카드.카드?.length ?? '?'} · 사건 ${learningEvents.length} · taskVersion ${result.taskVersions.join(' ')} · 오류 ${errors.length}`);
})().catch(e => { console.log('실패', String(e).slice(0, 400)); process.exit(1); });
