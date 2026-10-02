'use strict';
// 빈칸 베기 확인: 처음 하는 사람처럼 연습부터 한 판 끝까지 실제 손동작(마우스로 긋기·휴대폰 터치로 긋기·숫자 키)으로 하며 장면을 찍는다.
// 검사: 오류·4xx, 가로 넘침, 연습 → 12문장 → 결과, 맞힘·틀림·놓침(놓치면 멈춘 보기에서 답), 아틀라스 기록, 움직임 줄이기.
// 쓰는 법: node experiences/blank-slice/server.mjs 를 켠 뒤  node experiences/blank-slice/qa/capture.cjs
const path = require('node:path'), fs = require('node:fs');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM] }));
const URL_BASE = process.env.SLICE_URL || 'http://127.0.0.1:5217/';
const OUT = path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const VIEWS = {
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  small: { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = { url: URL_BASE, at: new Date().toISOString(), views: {} };
const PICK = process.argv.slice(2);   // 화면만 골라 돌리기: desktop mobile small mobile-reduced

async function overflow(page) { return page.evaluate(() => ({ inner: innerWidth, scroll: document.documentElement.scrollWidth })); }
const S = (page) => page.evaluate(() => window.__slice.state());

/** 조각 i가 꼭대기 근처(거의 멈춘 때)에 오면 그 위치(페이지 좌표). */
async function waitApex(page, i, timeout = 6000) {
  const t0 = Date.now(); let prev = null;
  while (Date.now() - t0 < timeout) {
    const p = await page.evaluate((k) => { const s = window.__slice.pieceScreen(k), a = window.__slice.arena(); return s && { x: a.x + s.x, y: a.y + s.y, ay: a.y, ah: a.h }; }, i);
    if (p && p.y > p.ay + 40 && p.y < p.ay + p.ah - 30) {
      if (prev && Math.abs(prev.y - p.y) < 6) return p;
      prev = p;
    }
    await sleep(70);
  }
  return null;
}
async function mouseSwipe(cdp, p) {
  // 마우스도 실제 움직인 시각(10ms 간격)을 함께 보낸다(아래 터치와 같은 까닭: 바쁜 때 늦게 도착해도 손 빠르기는 실제대로)
  const t0 = Date.now() / 1000, at = (k) => ({ x: Math.round(p.x - 90 + 30 * k), y: Math.round(p.y - 30 + 10 * k) });
  const ev = (type, k, pressed) => cdp.send('Input.dispatchMouseEvent', { type, ...at(k), button: 'left', buttons: pressed ? 1 : 0, clickCount: 1, timestamp: t0 + 0.01 * k });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...at(0), button: 'none', buttons: 0, timestamp: t0 - 0.02 });
  await ev('mousePressed', 0, true);
  for (let k = 1; k <= 6; k++) await ev('mouseMoved', k, true);
  await ev('mouseReleased', 6, false);
}
async function touchSwipe(cdp, p) {
  const pt = (x, y) => [{ x: Math.round(x), y: Math.round(y), id: 1 }];
  // 손가락이 실제로 움직인 시각(12ms 간격)을 함께 보낸다. 헤드리스는 3D를 소프트웨어로 그려 한 프레임이 100ms를 넘기도 해서,
  // 시각 없이 보내면 터치가 110~430ms 간격으로 도착해 ‘천천히 끈 것’으로 잰다(2026-10-02 재현). 실제 기기는 터치 표본에 하드웨어 시각이 붙는다
  const t0 = Date.now() / 1000;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(p.x - 70, p.y - 24), timestamp: t0 });
  for (let k = 1; k <= 6; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(p.x - 70 + 140 * k / 6, p.y - 24 + 48 * k / 6), timestamp: t0 + 0.012 * k }); await sleep(12); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: t0 + 0.084 });
}

async function run(browser, viewName, { reduced = false } = {}) {
  const context = await browser.newContext({ ...VIEWS[viewName], reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && r.status() !== 416) errors.push(`${r.status()} ${new URL(r.url()).pathname}`); });
  const cdp = await context.newCDPSession(page);
  const swipe = (p) => (VIEWS[viewName].hasTouch ? touchSwipe(cdp, p) : mouseSwipe(cdp, p));
  // 빗나가면(헤드리스가 바빠 조각이 움직인 사이 등) 다음 던지기에서 한 번 더 긋는다. 다시 그은 횟수는 결과에 남긴다
  async function swipeUntil(index, done) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const before = await S(page), tosses = before.cur?.tosses ?? before.practice?.tries ?? 0;
      const p = await waitApex(page, index);
      if (p) { await swipe(p); await sleep(250); if (await done()) return attempt; }
      out.checks.retries = (out.checks.retries || 0) + 1;
      for (let w = 0; w < 60; w++) {   // 다음 던지기를 기다린다
        if (await done()) return attempt;
        const st = await S(page); if ((st.cur?.tosses ?? st.practice?.tries ?? 0) > tosses) break;
        await sleep(100);
      }
    }
    errors.push(`세 번 그어도 못 벰(${index})`);
    return -1;
  }
  const tag = reduced ? `${viewName}-reduced` : viewName;
  const few = viewName === 'small' || reduced;
  const shot = async (name, full = false) => { const f = path.join(OUT, `${tag}_${name}.png`); await page.screenshot({ path: f, fullPage: full }); return path.basename(f); };
  const out = { shots: [], overflow: {}, checks: { outcomes: [] } };
  await page.goto(URL_BASE + '?qa'); await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForSelector('#btn-start'); await sleep(500);
  out.overflow.lobby = await overflow(page);
  out.shots.push(await shot('01_lobby'));
  if (!few) out.shots.push(await shot('01_lobby_full', true));
  await page.click('#btn-start'); await sleep(1200);
  // 연습: 노란 조각(우유)을 실제로 그어 벤다
  const pr = (await S(page)).practice;
  const pi = pr.options.indexOf('우유');
  await waitApex(page, pi);
  out.shots.push(await shot('02_practice'));
  await swipeUntil(pi, async () => !(await S(page)).practice); await sleep(50);
  out.shots.push(await shot('03_practice_sliced'));
  out.checks.practiceDone = !(await S(page)).practice;
  await sleep(1800);
  out.overflow.game = await overflow(page);
  // 12문장: 1번 맞힘(긋기) · 2번 틀림(긋기) · 3번 놓침(두 번 떨어뜨림) · 나머지 맞힘(넓은 화면은 숫자 키, 휴대폰은 긋기)
  for (let k = 0; k < 12; k++) {
    let st = await S(page);
    for (let w = 0; w < 60 && !(st.cur && st.cur.tosses > 0 && !st.cur.done); w++) { await sleep(100); st = await S(page); }
    const cur = st.cur, idx = st.index;
    const plan = k === 1 ? 'wrong' : k === 2 ? 'miss' : 'right';
    if (plan === 'miss') {
      for (let w = 0; w < 140 && !(await S(page)).cur.done; w++) await sleep(100);
      await sleep(300);
      // 놓치면 정답을 보이기 전에 멈춘 보기(읽기 확인)가 뜬다. 맞는 답을 골라 ‘놓쳤어요 · 고른 답 … 맞아요’ 해설까지 본다.
      await page.waitForSelector('#answer-check:not([hidden])', { timeout: 4000 });
      if (!few || k === 2) out.shots.push(await shot('05_missed_check'));
      await page.click(`#check-options button[data-word="${cur.answer}"]`); await sleep(400);
      if (!few || k === 2) out.shots.push(await shot('05b_missed_explain'));
      out.checks.missedKicker = await page.textContent('#x-kicker');
      await page.click('#btn-next'); await sleep(300);
      const mr = (await S(page)).results.at(-1);
      out.checks.outcomes.push({ k, plan, got: mr?.correct, reading: mr?.readingChoice, readingCorrect: mr?.readingCorrect });
      continue;
    }
    const target = plan === 'right' ? cur.answer : cur.options.find((o) => o !== cur.answer);
    const ti = cur.options.indexOf(target);
    if (plan === 'right' && viewName === 'desktop' && k >= 4) {
      await sleep(600); await page.keyboard.press(String(ti + 1));
    } else {
      await swipeUntil(ti, async () => { const st = await S(page); return st.index !== idx || !!st.cur?.done; });
    }
    await sleep(plan === 'right' ? 10 : 650);
    if (k === 0) out.shots.push(await shot('04_correct'));
    if (plan === 'wrong') { out.shots.push(await shot('06_wrong_explain')); await page.click('#btn-next'); await sleep(300); }
    else await sleep(1150);
    if (plan === 'right' && await page.isVisible('#answer-check')) {   // 두 번 빗나가 놓침: 멈춘 보기에서 답하고 넘어간다(기록)
      errors.push(`맞힘 계획인데 놓침(읽기 확인으로 넘어감) ${cur.id}`);
      await page.click(`#check-options button[data-word="${cur.answer}"]`); await sleep(400);
    }
    if (plan === 'right' && await page.isVisible('#explain')) {   // 엉뚱한 조각이 베였거나 두 번 빗나가 놓침: 기록하고 넘어간다
      errors.push(`맞힘 계획인데 ${JSON.stringify((await S(page)).results.at(-1))}`);
      await page.click('#btn-next'); await sleep(300);
    }
    const res = (await S(page)).results.at(-1);
    out.checks.outcomes.push({ k, plan, id: cur.id, got: res?.correct, choice: res?.choice, index: idx });
    if (await page.isVisible('#results')) break;
  }
  await page.waitForSelector('#results:not([hidden])', { timeout: 9000 });
  await sleep(700);
  out.overflow.results = await overflow(page);
  out.shots.push(await shot('07_results'));
  if (!few) out.shots.push(await shot('07_results_full', true));
  out.checks.results = await page.evaluate(() => ({ correct: document.querySelector('#r-correct').textContent, total: document.querySelector('#r-total').textContent,
    note: document.querySelector('#r-note').textContent, next: document.querySelector('#r-next-reason').textContent,
    skills: [...document.querySelectorAll('#r-skills li')].map((l) => l.textContent.replace(/\s+/g, ' ').trim()),
    log: [...document.querySelectorAll('#r-log li')].map((l) => l.className) }));
  out.checks.atlas = await page.evaluate(() => { const s = window.__slice.summary(); return { independent: s.independent, storage: s.storage?.available }; });
  out.checks.progress = await page.evaluate(() => window.__slice.progress());
  // 다음 판: 아틀라스가 고른 문장으로 시작하는지, 멈춤 창
  await page.click('#r-again'); await sleep(900);
  out.checks.secondRound = (await S(page)).queue;
  if (!few) { await page.keyboard.press('Escape'); await sleep(250); out.shots.push(await shot('08_pause')); await page.click('#resume'); await sleep(200); }
  if (reduced) out.checks.runningAnimations = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && (a.effect?.getTiming?.().duration || 0) > 20).length);
  out.errors = errors;
  await context.close();
  return out;
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  try {
    for (const v of ['desktop', 'mobile', 'small']) if (!PICK.length || PICK.includes(v)) report.views[v] = await run(browser, v);
    if (!PICK.length || PICK.includes('mobile-reduced')) report.views['mobile-reduced'] = await run(browser, 'mobile', { reduced: true });
  } finally { await browser.close(); }
  if (!PICK.length) fs.writeFileSync(path.join(__dirname, 'capture-results.json'), JSON.stringify(report, null, 1));   // 일부 화면만 돌리면 결과 파일은 그대로 둔다
  for (const [k, v] of Object.entries(report.views)) {
    const of = Object.entries(v.overflow).map(([s, o]) => `${s}:${o.scroll > o.inner ? '넘침' : '0'}`).join(' ');
    const c = v.checks;
    console.log(`${k}: 장면 ${v.shots.length} · 오류 ${v.errors.length}${v.errors.length ? ` (${v.errors.slice(0, 3).join(' | ')})` : ''} · 가로 ${of} · 연습 ${c.practiceDone}`
      + ` · 다시 그음 ${c.retries || 0} · 결과 ${c.results?.correct}/${c.results?.total} · 기록 ${JSON.stringify(c.outcomes.map((o) => `${o.plan}:${o.got}`))} · 아틀라스 혼자 ${c.atlas?.independent}`
      + `${c.runningAnimations != null ? ` · 움직이는 애니메이션 ${c.runningAnimations}` : ''}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
