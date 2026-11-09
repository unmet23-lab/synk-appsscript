'use strict';
// 체험 의견 카드 브라우저 시험(2026-11-09). 실제 헤드리스 크롬으로 말 랠리를 열어 한 판(한 개 이상 받아친 뒤 결과)을 끝내고 카드를 다룬다.
// 수집 서버: 기본은 이 파일 안의 「fixture」(계약 trial-feedback.v1-final의 응답 꼴만 흉내 냄 — 실제 회사 서버 · 실제 참여 기록이 아니다).
//   TRIAL_COLLECTOR=http://localhost:<포트>를 주면 GPT 백엔드 로컬 서버로 보낸다(그 서버의 허용 출처에 이 시험의 게임 주소가 있어야 한다).
// 묶음은 늘 qa-로 시작한다(서버가 시험 자료로 따로 둔다).
// 쓰는 법: node experiences/talk-rally/qa/trial-feedback.cjs [all|decline|join|offline|double|withdraw|expire|world|layout]
//   게임 서버는 스스로 띄운다(PORT 5231). 장면 캡처는 qa/shots/trial_*.png, 결과 요약은 qa/trial-feedback-results.json.
const path = require('node:path'), fs = require('node:fs'), http = require('node:http'), { spawn } = require('node:child_process');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM] }));
const GAME_PORT = Number(process.env.GAME_PORT || 5231), FIX_PORT = Number(process.env.FIX_PORT || 5232);
const GAME = process.env.GAME_URL || `http://localhost:${GAME_PORT}/`;   // 공개 코드는 localhost 수집 주소만 받는다. GAME_URL: 공개 후보를 띄운 주소(이때 게임 서버를 띄우지 않는다)
const COLLECTOR = process.env.TRIAL_COLLECTOR || `http://localhost:${FIX_PORT}`;
const OUT = process.env.QA_SHOTS || path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PHONE = { deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const VIEWS = { desktop: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, ...PHONE }, small: { viewport: { width: 320, height: 568 }, ...PHONE } };

/* ── fixture 수집 서버(계약 꼴만) ── */
function fixture() {
  const log = [], participants = new Map(), events = new Map(), withdrawn = new Set();
  let mode = 'ok';
  const srv = http.createServer((req, res) => {
    const origin = req.headers.origin, okOrigin = origin === new URL(GAME).origin;
    const send = (status, body, extra = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(okOrigin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}), ...extra }); res.end(body ? JSON.stringify(body) : undefined); };
    const p = new URL(req.url, 'http://x').pathname;
    if (!['/trial-feedback/enroll', '/trial-feedback/event', '/trial-feedback/withdraw'].includes(p)) return send(404, { ok: false });
    if (!okOrigin) return send(403, { ok: false, error: 'origin' });
    if (req.method === 'OPTIONS') return send(204, null, { 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' });
    if (req.method !== 'POST') return send(405, { ok: false });
    if (!/^application\/json/.test(req.headers['content-type'] || '')) return send(415, { ok: false, error: 'content_type' });
    let raw = ''; req.on('data', (c) => { raw += c; }); req.on('end', () => {
      let body; try { body = JSON.parse(raw); } catch { return send(400, { ok: false, error: 'invalid' }); }
      log.push({ path: p, body, cookie: req.headers.cookie || null, at: Date.now() });
      if (mode === 'busy') return send(503, { ok: false, error: 'stopped' });
      if (p.endsWith('/enroll')) {
        if (withdrawn.has(body.participantId)) return send(410, { ok: false, error: 'withdrawn' });
        const out = { ok: true, consentAt: body.consentAt, expiresAt: new Date(Date.parse(body.consentAt) + 30 * 864e5).toISOString(), deleteAt: new Date(Date.parse(body.consentAt) + 90 * 864e5).toISOString() };
        const old = participants.get(body.participantId);
        if (old) return old.submissionId === body.submissionId ? send(200, { ...out, duplicate: true }) : send(409, { ok: false, error: 'already_enrolled' });
        participants.set(body.participantId, body); return send(201, { ...out, duplicate: false });
      }
      if (p.endsWith('/event')) {
        if (!participants.has(body.participantId)) return send(404, { ok: false, error: 'not_enrolled' });
        const dup = events.has(body.eventId); events.set(body.eventId, body); return send(dup ? 200 : 201, { ok: true, duplicate: dup });
      }
      participants.delete(body.participantId); withdrawn.add(body.participantId);
      for (const [k, v] of events) if (v.participantId === body.participantId) events.delete(k);
      return send(200, { ok: true, deleted: true });
    });
  });
  return { srv, log, participants, events, set mode(v) { mode = v; }, reset() { log.length = 0; participants.clear(); events.clear(); withdrawn.clear(); mode = 'ok'; } };
}

async function startGame() {
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.mjs')], { env: { ...process.env, PORT: String(GAME_PORT) }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => { child.stdout.on('data', (d) => { if (String(d).includes('http://')) resolve(); }); child.on('exit', () => reject(new Error('게임 서버가 꺼졌어요'))); setTimeout(() => reject(new Error('게임 서버 시작 시간 초과')), 15000); });
  return child;
}

async function open(browser, view, { search = '', storage = null } = {}) {
  const ctx = await browser.newContext(view), page = await ctx.newPage(), errors = [], requests = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR_FAILED|ERR_INTERNET_DISCONNECTED/.test(m.text())) errors.push(m.text()); });
  page.on('request', (r) => { if (r.url().startsWith(COLLECTOR)) requests.push({ url: r.url(), method: r.method() }); });
  if (storage) await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, storage);
  const q = `?qa&trialCollector=${encodeURIComponent(COLLECTOR)}&trial=qa-browser${search}`;
  await page.goto(GAME + q, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__rally && !document.querySelector('#lobby').hidden, null, { timeout: 30000 });
  return { ctx, page, errors, requests };
}

/** 판을 시작해 n개를 받아친 뒤 결과로(연습 공이 나오면 그것도 맞힌다). */
async function playRound(page, { n = 1, button = '#btn-start' } = {}) {
  if (button) await page.click(button);
  const t0 = Date.now();
  const canFinish = await page.evaluate(() => typeof window.__rally.finish === 'function');   // 공개본(후보)에는 finish가 없다 → 12개를 끝까지 친다
  while (Date.now() - t0 < 240000) {
    if (!canFinish && !(await page.$eval('#results', (n) => n.hidden))) break;
    const s = await page.evaluate(() => window.__rally.state());
    if (canFinish && s.results.length >= n) break;
    if (s.cur && s.cur.choice == null && ['talk', 'flight', 'hold', 'wait'].includes(s.cur.phase) || (s.cur && s.cur.choice == null && s.cur.waiting)) {
      const lane = s.cur.options.indexOf(s.cur.answer);
      if (lane >= 0) await page.evaluate((l) => window.__rally.choose(l), lane);
    }
    const explain = await page.$('#explain:not([hidden]) #btn-next');
    if (explain) await explain.click().catch(() => {});
    await sleep(120);
  }
  if (canFinish) await page.evaluate(() => window.__rally.finish());
  await page.waitForFunction(() => !document.querySelector('#results').hidden, null, { timeout: 15000 });
  await sleep(400);
}
const learned = (page) => page.evaluate(() => { const s = window.__rally.summary(); return s?.skills?.reduce((n, sk) => n + Object.values(sk.levels || {}).reduce((m, l) => m + Object.values(l.formats || {}).reduce((k, f) => k + (f.n || 0), 0), 0), 0) ?? null; });
const plays = (page) => page.evaluate(() => window.__rally.progress().plays);
const overflow = (page) => page.evaluate(() => { const w = document.documentElement.clientWidth; return [...document.querySelectorAll('#r-trial *, #trial-line *')].filter((n) => { const r = n.getBoundingClientRect(); return r.width && (r.right > w + 1 || r.left < -1); }).map((n) => n.className || n.tagName).slice(0, 5); });

const SCENES = {
  /** 동의 안 함: 괜찮아요 → 요청 0, 다음 판 · 학습 기록 그대로, 다음 결과에 카드 없음 */
  async decline(browser, fx, out) {
    const { page, errors, requests, ctx } = await open(browser, VIEWS.desktop);
    const l0 = await learned(page), p0 = await plays(page);
    await playRound(page);
    const shown = await page.isVisible('#r-trial');
    await page.screenshot({ path: path.join(OUT, 'trial_desktop_card.png'), fullPage: true });
    await page.click('#r-trial [data-tf=no]');
    const hidden = !(await page.isVisible('#r-trial'));
    await page.click('#r-again');
    await page.waitForFunction(() => !document.querySelector('#game').hidden);
    await playRound(page, { button: null }).catch(() => {});
    const l1 = await learned(page), p1 = await plays(page);
    out.decline = { cardShown: shown, hiddenAfterNo: hidden, cardOnSecondResult: await page.isVisible('#r-trial'), collectorRequests: requests.length, fixtureLog: fx.log.length,
      learnedBefore: l0, learnedAfter: l1, playsBefore: p0, playsAfter: p1, errors };
    await ctx.close();
  },
  /** 참여: 14세 · 답 전에는 보내기 꺼짐 → 질문 3만 답(일부) → 보냄, 다음 판 시작 · 완료가 같은 roundId */
  async join(browser, fx, out) {
    fx.reset();
    const { page, errors, ctx } = await open(browser, VIEWS.phone);
    const l0 = await learned(page);
    await playRound(page);
    await page.click('#r-trial [data-tf=join]');
    const disabled0 = await page.isDisabled('#r-trial .tf-send');
    await page.check('#r-trial input[name=again][value=again_7d]');
    const disabledNoAge = await page.isDisabled('#r-trial .tf-send');
    await page.check('#r-trial input[name=age14]');
    const enabled = !(await page.isDisabled('#r-trial .tf-send'));
    await page.screenshot({ path: path.join(OUT, 'trial_phone_form.png'), fullPage: true });
    await page.click('#r-trial .tf-send');
    await page.waitForSelector('#r-trial .tf-status.ok', { timeout: 15000 });
    await page.screenshot({ path: path.join(OUT, 'trial_phone_sent.png'), fullPage: true });
    const enroll = fx.log.find((x) => x.path.endsWith('/enroll'));
    await page.click('#r-again');
    await page.waitForFunction(() => !document.querySelector('#game').hidden);
    await playRound(page, { button: null }).catch(() => {});
    await sleep(800);
    const kinds = fx.log.filter((x) => x.path.endsWith('/event')).map((x) => ({ kind: x.body.kind, roundId: x.body.round?.roundId || null }));
    await page.click('#r-home'); await sleep(500);
    const line = await page.textContent('#trial-line');
    await page.screenshot({ path: path.join(OUT, 'trial_phone_lobby_line.png') });
    out.join = { disabledBeforeAnswer: disabled0, disabledWithoutAge: disabledNoAge, enabledAfter: enabled, enrollAnswers: enroll?.body.answers, enrollCohort: enroll?.body.cohort,
      enrollKeys: enroll && Object.keys(enroll.body).sort(), cookieSent: fx.log.some((x) => x.cookie), events: kinds, cardOnSecondResult: await page.isVisible('#r-trial'), lobbyLine: line?.trim(),
      learnedBefore: l0, learnedAfter: await learned(page), errors };
    await ctx.close();
  },
  /** 오프라인: 담아 둠 → 다시 보내기로 성공. 320px 화면 */
  async offline(browser, fx, out) {
    fx.reset();
    const { page, errors, ctx } = await open(browser, VIEWS.small);
    await playRound(page);
    await page.click('#r-trial [data-tf=join]');
    await page.check('#r-trial input[name=fun][value=fun_3]');
    await page.check('#r-trial input[name=stuck][value=listen]');
    await page.check('#r-trial input[name=stuck][value=none]');
    const noneExclusive = !(await page.isChecked('#r-trial input[name=stuck][value=listen]'));
    await page.fill('#r-trial textarea', '자동 시험 글(fixture)');
    await page.check('#r-trial input[name=again][value=again_1d]');
    await page.check('#r-trial input[name=age14]');
    const ovForm = await overflow(page);
    await page.screenshot({ path: path.join(OUT, 'trial_small_form.png'), fullPage: true });
    await ctx.route(COLLECTOR + '/**', (r) => r.abort('internetdisconnected'));
    await page.click('#r-trial .tf-send');
    await page.waitForSelector('#r-trial .tf-status.warn', { timeout: 20000 });
    const offlineText = await page.textContent('#r-trial .tf-status');
    await page.screenshot({ path: path.join(OUT, 'trial_small_offline.png'), fullPage: true });
    const queued = await page.evaluate(() => window.__rally.trial());
    await ctx.unroute(COLLECTOR + '/**');
    await page.click('#r-trial [data-tf=retry]');
    await page.waitForSelector('#r-trial .tf-status.ok', { timeout: 15000 });
    const enrolls = fx.log.filter((x) => x.path.endsWith('/enroll'));
    out.offline = { noneExclusive, overflowForm: ovForm, offlineText, phaseWhileOffline: queued?.phase, enrollCount: enrolls.length, note: enrolls[0]?.body.answers.stuckNote, stuck: enrolls[0]?.body.answers.stuck, errors };
    await ctx.close();
  },
  /** 이중 클릭 · 서버 바쁨 → 다시 보내기는 같은 submissionId */
  async double(browser, fx, out) {
    fx.reset(); fx.mode = 'busy';
    const { page, errors, ctx } = await open(browser, VIEWS.desktop);
    await playRound(page);
    await page.click('#r-trial [data-tf=join]');
    await page.check('#r-trial input[name=fun][value=fun_4]'); await page.check('#r-trial input[name=age14]');
    await page.dblclick('#r-trial .tf-send');
    await page.waitForSelector('#r-trial .tf-status.warn', { timeout: 15000 });
    const busyText = await page.textContent('#r-trial .tf-status');
    fx.mode = 'ok';
    await page.click('#r-trial [data-tf=retry]');
    await page.waitForSelector('#r-trial .tf-status.ok', { timeout: 15000 });
    const subs = fx.log.filter((x) => x.path.endsWith('/enroll')).map((x) => x.body.submissionId);
    await page.screenshot({ path: path.join(OUT, 'trial_desktop_sent.png'), fullPage: true });
    out.double = { busyText, enrollRequests: subs.length, sameSubmission: new Set(subs).size === 1, participants: fx.participants.size, errors };
    await ctx.close();
  },
  /** 그만두기: 입구 줄 → 확인 → 서버 기록 0, 이후 판 요청 0 */
  async withdraw(browser, fx, out) {
    fx.reset();
    const { page, errors, ctx } = await open(browser, VIEWS.phone);
    await playRound(page);
    await page.click('#r-trial [data-tf=join]');
    await page.check('#r-trial input[name=again][value=again_no]'); await page.check('#r-trial input[name=age14]');
    await page.click('#r-trial .tf-send'); await page.waitForSelector('#r-trial .tf-status.ok');
    await page.click('#r-home'); await sleep(300);
    page.once('dialog', (d) => d.accept());
    await page.click('#trial-line [data-tf=leave]');
    await page.waitForFunction(() => /그만두었어요/.test(document.querySelector('#trial-line').textContent), null, { timeout: 15000 });
    const flash = await page.textContent('#trial-line');
    await page.screenshot({ path: path.join(OUT, 'trial_phone_withdrawn.png') });
    const before = fx.log.length;
    await playRound(page);
    await sleep(500);
    out.withdraw = { flash: flash.trim(), participantsAfter: fx.participants.size, eventsAfter: fx.events.size, requestsAfterWithdraw: fx.log.length - before, cardAgain: await page.isVisible('#r-trial'), errors };
    await ctx.close();
  },
  /** 만료: 30일 지난 참여 상태 → 입구 「기간이 끝났어요」, 판 요청 0 */
  async expire(browser, fx, out) {
    fx.reset();
    const past = (d) => new Date(Date.now() - d * 864e5).toISOString(), future = (d) => new Date(Date.now() + d * 864e5).toISOString();
    const state = { v: 1, state: 'enrolled', participantId: '00000000-0000-4000-8000-0000000000aa', consentAt: past(31), sendUntil: past(1), keepUntil: future(59), cohort: 'qa-browser', lastVisitDate: '2000-01-01' };
    const { page, errors, ctx } = await open(browser, VIEWS.desktop, { storage: { 'synk.trial-feedback.talk-rally.v1': JSON.stringify(state) } });
    const line = (await page.textContent('#trial-line')).trim();
    await playRound(page);
    await sleep(500);
    out.expire = { line, requests: fx.log.length, cardShown: await page.isVisible('#r-trial'), errors };
    await ctx.close();
  },
  /** WORLD 틀(.game-frame) 안: 카드 · 입구 줄 없음, 수집 요청 0 */
  async world(browser, fx, out) {
    fx.reset();
    const ctx = await browser.newContext(VIEWS.desktop), page = await ctx.newPage(), requests = [], errors = [];
    page.on('request', (r) => { if (r.url().startsWith(COLLECTOR)) requests.push(r.url()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    const src = `/?qa&trialCollector=${encodeURIComponent(COLLECTOR)}&trial=qa-browser`;
    await page.route(GAME + '__world-frame.html', (r) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><iframe class="game-frame" src="${src}" style="width:1400px;height:860px;border:0"></iframe>` }));
    await page.goto(GAME + '__world-frame.html');
    const frame = await (await page.waitForSelector('iframe')).contentFrame();
    await frame.waitForFunction(() => document.documentElement.dataset.host === 'world' && !!window.__rally, null, { timeout: 30000 }).catch(() => {});
    await sleep(1500);
    const host = await frame.evaluate(() => document.documentElement.dataset.host).catch(() => null);
    out.world = { host, trialStatus: await frame.evaluate(() => window.__rally?.trial?.() ?? null).catch(() => 'no-qa'), lineHidden: await frame.evaluate(() => document.querySelector('#trial-line')?.hidden ?? true).catch(() => null),
      requests: requests.length, errors: errors.slice(0, 3) };
    await ctx.close();
  },
  /** 배치: 세 폭에서 결과 카드(접힘 · 펼침) · 입구 한 줄을 찍고 가로 넘침 · 탭 순서(키보드만으로 보내기까지)를 잰다 */
  async layout(browser, fx, out) {
    const res = {};
    for (const [vname, view] of Object.entries(VIEWS)) {
      fx.reset();
      const { page, errors, ctx } = await open(browser, view);
      await playRound(page);
      const card = await page.$('#r-trial');
      await card.screenshot({ path: path.join(OUT, `trial_layout_${vname}_collapsed.png`) });
      await page.click('#r-trial [data-tf=join]');
      await sleep(200);
      const focused = await page.evaluate(() => document.activeElement?.id || document.activeElement?.className);
      await card.screenshot({ path: path.join(OUT, `trial_layout_${vname}_form.png`) });
      const ov = await overflow(page);
      const docOv = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      // 키보드만: 14세 체크 → 첫 질문 첫 답 → 보내기
      await page.focus('#r-trial input[name=age14]'); await page.keyboard.press('Space');
      await page.focus('#r-trial input[name=fun][value=fun_4]'); await page.keyboard.press('Space');
      await page.focus('#r-trial .tf-send'); await page.keyboard.press('Enter');
      await page.waitForSelector('#r-trial .tf-status.ok', { timeout: 15000 });
      await page.click('#r-home'); await sleep(400);
      await page.screenshot({ path: path.join(OUT, `trial_layout_${vname}_lobby.png`), fullPage: true });
      res[vname] = { focusedAfterJoin: focused, overflow: ov, docOverflowX: docOv, keyboardSent: fx.participants.size === 1, lobbyLine: (await page.textContent('#trial-line')).trim(), errors };
      await ctx.close();
    }
    out.layout = res;
  },
  /** 운영자 화면: company/public/trial-feedback.*를 회사 서버와 같은 CSP로 내주고 요약은 fixture(시험 자료 꼴)로 — 로그인 없음 · 권한 없음 · 0건 · 오류 · 숫자 · 자유 글 숨김 */
  async operator(browser, fx, out) {
    const pub = path.join(__dirname, '..', '..', '..', 'docs', '마케팅', '온라인마케팅지도', 'engagement', 'company', 'public');
    const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'";
    let mode = 'filled'; const asked = [];
    const zero = { ok: true, contractVersion: 'trial-feedback.v1-final', today: '2026-11-09', unit: 'fixture', filter: { cohort: 'all', days: 30, data: 'synthetic' }, cohorts: [], otherDataCount: 3,
      denominators: { participants: 0, visits: 0, returnVisits: 0, participantsReturned: 0, roundStarts: 0, roundCompletes: 0, roundsStartedNotCompleted: 0, roundsCompletedWithoutStart: 0 },
      fun: { answered: 0, skipped: 0, counts: {} }, stuck: { answered: 0, skipped: 0, counts: {} }, againVsReturn: [], performance: { firstRound: { n: 0, medianCorrectRatio: null, helpedRoundShare: null, soundOffShare: null } }, comments: [], commentsHidden: false };
    const filled = { ...zero, filter: { cohort: 'all', days: 30, data: 'synthetic' }, cohorts: [{ cohort: 'qa-fixture-a', participants: 4 }, { cohort: 'qa-fixture-b', participants: 2 }], otherDataCount: 0,
      denominators: { participants: 6, visits: 9, returnVisits: 3, participantsReturned: 2, roundStarts: 11, roundCompletes: 10, roundsStartedNotCompleted: 1, roundsCompletedWithoutStart: 0 },
      fun: { answered: 5, skipped: 1, counts: { fun_4: 2, fun_3: 2, fun_2: 1, fun_1: 0 } }, stuck: { answered: 4, skipped: 2, counts: { listen: 2, read: 0, howto: 1, control: 0, sound: 1, perf: 0, none: 1 } },
      againVsReturn: [{ again: 'again_1d', participants: 2, within1d: { eligible: 2, returned: 1 }, within7d: { eligible: 1, returned: 1 } }, { again: 'again_7d', participants: 2, within1d: { eligible: 1, returned: 0 }, within7d: { eligible: 0, returned: 0 } },
        { again: 'again_unsure', participants: 1, within1d: { eligible: 1, returned: 0 }, within7d: { eligible: 1, returned: 0 } }, { again: 'again_no', participants: 0, within1d: { eligible: 0, returned: 0 }, within7d: { eligible: 0, returned: 0 } },
        { again: null, participants: 1, within1d: { eligible: 1, returned: 1 }, within7d: { eligible: 0, returned: 0 } }],
      performance: { label: '판 안 수행 — 학습 효과 아님', firstRound: { n: 6, medianCorrectRatio: 0.75, helpedRoundShare: 0.5, soundOffShare: null } },
      comments: [{ date: '2026-11-08', cohort: 'qa-fixture-a', fun: 'fun_3', stuck: ['listen'], again: 'again_1d', note: '시험용 가짜 글 <b>태그는 글자로</b>' }] };
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://x');
      const head = { 'Cache-Control': 'no-store', 'Content-Security-Policy': CSP };
      if (u.pathname === '/api/trial-feedback/summary') {
        asked.push(u.search);
        const [status, body] = mode === 'login' ? [401, { ok: false, error: 'login' }] : mode === 'role' ? [403, { ok: false, error: 'role' }] : mode === 'error' ? [500, { ok: false }]
          : mode === 'zero' ? [200, zero] : mode === 'viewer' ? [200, { ...filled, comments: null, commentsHidden: true }] : [200, filled];
        res.writeHead(status, { ...head, 'Content-Type': 'application/json' }); return res.end(JSON.stringify(body));
      }
      const map = { '/trial-feedback/': ['trial-feedback.html', 'text/html; charset=utf-8'], '/trial-feedback/trial-feedback.js': ['trial-feedback.js', 'text/javascript; charset=utf-8'], '/trial-feedback/trial-feedback.css': ['trial-feedback.css', 'text/css; charset=utf-8'] };
      const hit = map[u.pathname]; if (!hit) { res.writeHead(404, head); return res.end(); }
      res.writeHead(200, { ...head, 'Content-Type': hit[1] }); res.end(fs.readFileSync(path.join(pub, hit[0])));
    });
    await new Promise((r) => srv.listen(5233, '127.0.0.1', r));
    const result = {};
    try {
      for (const [vname, view] of Object.entries(VIEWS)) {
        const ctx = await browser.newContext(view), page = await ctx.newPage(), errors = [];
        page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
        const cases = vname === 'desktop' ? ['filled', 'viewer', 'zero', 'login', 'role', 'error'] : ['filled', 'zero'];
        for (const c of cases) {
          mode = c;
          await page.goto('http://127.0.0.1:5233/trial-feedback/?data=synthetic&days=30');
          await page.waitForFunction(() => document.querySelector('#out').getAttribute('aria-busy') === 'false', null, { timeout: 15000 });
          const info = await page.evaluate(() => ({ h2: [...document.querySelectorAll('#out h2')].map((h) => h.textContent.trim()).slice(0, 3), banner: !document.querySelector('#synthetic-banner').hidden,
            bars: [...document.querySelectorAll('.tf-track i')].map((i) => i.style.width).slice(0, 3), dash: document.querySelector('.tf-perf dd:nth-of-type(1)') && [...document.querySelectorAll('.tf-perf dd')].map((d) => d.textContent),
            rawTag: !!document.querySelector('.tf-comments b'), overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }));
          result[`${vname}:${c}`] = info;
          if (['filled', 'zero'].includes(c) || vname === 'desktop') await page.screenshot({ path: path.join(OUT, `trial_operator_${vname}_${c}.png`), fullPage: true });
        }
        result[`${vname}:errors`] = errors;
        await ctx.close();
      }
    } finally { srv.close(); }
    out.operator = { ...result, queries: [...new Set(asked)] };
  },
};

(async () => {
  const want = process.argv[2] || 'all';
  const fx = fixture();
  if (!process.env.TRIAL_COLLECTOR) await new Promise((r) => fx.srv.listen(FIX_PORT, '127.0.0.1', r));
  const game = process.env.GAME_URL ? { kill() {} } : await startGame();
  const browser = await chromium.launch({ channel: process.env.QA_CHANNEL || 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = { collector: process.env.TRIAL_COLLECTOR ? 'TRIAL_COLLECTOR(외부)' : 'fixture(계약 꼴 흉내, 실제 서버 아님)', at: new Date().toISOString() };
  try {
    for (const name of Object.keys(SCENES)) {
      if (want !== 'all' && want !== name) continue;
      try { await SCENES[name](browser, fx, out); } catch (e) { out[name] = { ...(out[name] || {}), crashed: String(e).slice(0, 400) }; }
      process.stdout.write(`${name}: ${JSON.stringify(out[name])}\n`);
    }
  } finally { await browser.close(); game.kill(); fx.srv.close(); }
  fs.writeFileSync(path.join(__dirname, 'trial-feedback-results.json'), JSON.stringify(out, null, 2) + '\n');
})();
