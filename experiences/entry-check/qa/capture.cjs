'use strict';
// 입장 검사 확인: 처음 하는 사람처럼 연수 12단계를 실제 클릭으로 끝까지 하고, 근무를 마치며 장면을 찍는다.
// 검사: 오류·4xx, 가로 넘침, 연수 중 비추지 않은 곳이 막히는지, 목소리 차례, 도서관 반복 영상, 움직임 줄이기, 아틀라스 기록.
// 쓰는 법: node experiences/entry-check/server.mjs 를 켠 뒤  node experiences/entry-check/qa/capture.cjs [--영상]
// 따로 띄운 브라우저 프로필을 쓴다(사용자 브라우저를 읽거나 바꾸지 않는다).
const path = require('node:path'), fs = require('node:fs');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM] }));
const URL_BASE = process.env.ENTRY_URL || 'http://127.0.0.1:5215/';
const OUT = path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const VIEWS = {
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  small: { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const RECORD = process.argv.includes('--영상');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = { url: URL_BASE, at: new Date().toISOString(), views: {} };

async function overflow(page) {
  return page.evaluate(() => ({ inner: innerWidth, visual: visualViewport.width, scroll: document.documentElement.scrollWidth }));
}
const state = (page) => page.evaluate(() => window.__entry.state());
const tutorial = (page) => page.evaluate(() => window.__entry.tutorial());
async function answer(page, { wrong = false } = {}) {
  const st = await state(page);
  const ans = st.cur.answer;
  if ((ans === 'pass') !== wrong) { await page.click('#btn-pass'); return 'pass'; }
  await page.click('#btn-reject'); await sleep(260);
  const pick = ans === 'pass' ? await page.evaluate(() => document.querySelector('#notice .rule').dataset.rule) : ans;
  await page.click(`#notice .rule[data-rule="${pick}"]`);
  return pick;
}
/** 화면 좌표로 누른다(가린 막이 있으면 막에 닿는다 — 막히는지 보려고). */
async function tapAt(page, selector) {
  const b = await page.locator(selector).boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}

async function run(browser, viewName, { reduced = false } = {}) {
  const context = await browser.newContext({ ...VIEWS[viewName], reducedMotion: reduced ? 'reduce' : 'no-preference',
    ...(RECORD && viewName === 'desktop' && !reduced ? { recordVideo: { dir: OUT, size: VIEWS.desktop.viewport } } : {}) });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && r.status() !== 416) errors.push(`${r.status()} ${new URL(r.url()).pathname}`); });
  const tag = reduced ? `${viewName}-reduced` : viewName;
  const few = viewName === 'small' || reduced;
  const shot = async (name, full = false) => { const f = path.join(OUT, `${tag}_${name}.png`); await page.screenshot({ path: f, fullPage: full }); return path.basename(f); };
  const out = { shots: [], overflow: {}, checks: {} };
  await page.goto(URL_BASE + '?qa'); await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForSelector('#rec-start'); await sleep(500);
  out.overflow.lobby = await overflow(page);
  out.shots.push(await shot('01_lobby'));
  if (!few) {
    await page.locator('.how').scrollIntoViewIfNeeded(); await sleep(200);
    out.shots.push(await shot('01b_how'));
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  // ── 첫 근무 = 연수 ──
  await page.click('#rec-start'); await sleep(500);
  out.shots.push(await shot('02_briefing'));
  await page.click('#btn-begin'); await sleep(1300);
  out.overflow.game = await overflow(page);
  const steps = [];
  const stepShot = async (n) => { if (!few || [1, 4, 9, 12].includes(n)) out.shots.push(await shot(`03_tut${String(n).padStart(2, '0')}`)); };
  const expect = async (n) => { const t = await tutorial(page); steps.push([n, t.step]); };
  for (let n = 1; n <= 3; n++) { await expect(n); await stepShot(n); await page.click('#coach-next'); await sleep(700); }
  await expect(4); await stepShot(4);
  // 막힘 확인: 비추지 않은 거절 단추 자리의 맨 위 요소가 연수 막이어야 하고, 눌러도 아무 일이 없어야 한다
  const topAtReject = await page.evaluate(() => {
    const r = document.querySelector('#btn-reject').getBoundingClientRect();
    return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.className || null;
  });
  await tapAt(page, '#btn-reject'); await sleep(300);
  const afterTap = await state(page);
  out.checks.blockedOutside = topAtReject === 'coach-block' && !afterTap.cur.choosing && !afterTap.cur.done;
  out.checks.topAtReject = topAtReject;
  await page.click('#btn-pass'); await sleep(1100);
  await expect(5); await stepShot(5);
  await page.click('#btn-next'); await sleep(1500);
  for (let n = 6; n <= 7; n++) { await expect(n); await stepShot(n); await page.click('#coach-next'); await sleep(700); }
  await expect(8); await stepShot(8);
  await page.click('#btn-reject'); await sleep(900);
  await expect(9); await stepShot(9);
  out.checks.onlyTargetRule = await page.evaluate(() => [...document.querySelectorAll('#notice .rule')].filter((r) => !r.disabled).map((r) => r.dataset.rule));
  await page.click('#notice .rule[data-rule="food"]'); await sleep(1100);
  await expect(10); await stepShot(10);
  await page.click('#btn-next'); await sleep(1500);
  await expect(11); await stepShot(11);
  await page.click('#coach-next'); await sleep(700);
  await expect(12); await stepShot(12);
  await page.click('#coach-next'); await sleep(500);
  out.checks.tutorialSteps = steps;
  out.checks.tutorialEnded = await tutorial(page);
  out.checks.progressTutorial = (await page.evaluate(() => window.__entry.progress())).tutorial;
  // ── 혼자 하기: 돋보기 한 번, 일부러 한 번 틀리기 ──
  await page.click('#btn-hint'); await sleep(250);
  if (!few) out.shots.push(await shot('04_hint'));
  await answer(page); await sleep(900); await page.click('#btn-next'); await sleep(1300);
  await answer(page, { wrong: true }); await sleep(1000);
  out.shots.push(await shot('05_feedback_wrong'));
  await page.click('#btn-next'); await sleep(1300);
  for (let i = 0; i < 6; i++) {
    if (await page.isVisible('#results')) break;
    const st = await state(page);
    if (!st.cur || st.cur.done) break;
    await answer(page); await sleep(800); await page.click('#btn-next'); await sleep(1300);
  }
  await page.waitForSelector('#results:not([hidden])', { timeout: 9000 });
  await sleep(1200);
  out.overflow.results = await overflow(page);
  out.shots.push(await shot('06_results'));
  if (!few) out.shots.push(await shot('06_results_full', true));
  out.checks.results = await page.evaluate(() => ({ correct: document.querySelector('#r-correct').textContent, total: document.querySelector('#r-total').textContent,
    log: [...document.querySelectorAll('#r-log li small')].map((x) => x.textContent).filter((t) => t.startsWith('정답')),
    next: document.querySelector('#r-next-name').textContent, reason: document.querySelector('#r-next-reason').textContent,
    skills: [...document.querySelectorAll('#r-skills li')].map((l) => l.textContent.replace(/\s+/g, ' ').trim()) }));
  out.checks.atlasGuided = await page.evaluate(() => window.__entry.state().results.filter((r) => r.guided).map((r) => [r.caseId, r.independent]));
  out.checks.voices = await page.evaluate(() => window.__entry.voices());
  // ── 별빛 도서관: 반복 영상 ──
  await page.evaluate(() => localStorage.setItem('synk.entry-check.v1', JSON.stringify({ v: 1, stars: { pool: 2, library: 2, museum: 2 }, plays: 3, tutorial: true, doneDay: null, motion: true })));
  await page.goto(URL_BASE + '?qa'); await page.waitForSelector('.venue'); await sleep(400);
  await page.click('.venue >> nth=1'); await sleep(500); await page.click('#btn-begin'); await sleep(2200);
  out.checks.libraryVideo = await page.evaluate(async () => {
    const v = document.querySelector('#scene-video'); const t0 = v.currentTime; await new Promise((r) => setTimeout(r, 700));
    return { src: v.getAttribute('src'), on: v.classList.contains('on'), paused: v.paused, advanced: v.currentTime > t0 || v.currentTime < t0, readyState: v.readyState, display: getComputedStyle(v).display };
  });
  out.shots.push(await shot('07_library_video'));
  // ── 공원 음악회: 근무 중 알림 ──
  await page.evaluate(() => document.querySelector('#pause-dialog').showModal());
  if (!few) { await sleep(200); out.shots.push(await shot('08_pause')); }
  await page.click('#quit'); await sleep(400);
  await page.click('.venue >> nth=3'); await sleep(500); await page.click('#btn-begin'); await sleep(1300);
  let memoSeen = false;
  for (let i = 0; i < 6 && !memoSeen; i++) {
    await answer(page); await sleep(800); await page.click('#btn-next'); await sleep(1400);
    memoSeen = await page.isVisible('#memo-alert');
  }
  out.checks.memoAlert = memoSeen;
  if (memoSeen) {
    out.shots.push(await shot('09_memo_alert'));
    await page.click('#btn-alert'); await sleep(1000);
    out.checks.memoRules = await page.evaluate(() => [...document.querySelectorAll('#notice .rule')].map((r) => r.dataset.rule));
  }
  if (reduced) out.checks.runningAnimations = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && (a.effect?.getTiming?.().duration || 0) > 20).length);
  out.errors = errors;
  await context.close();
  return out;
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    for (const v of ['mobile', 'desktop', 'small']) report.views[v] = await run(browser, v);
    report.views['mobile-reduced'] = await run(browser, 'mobile', { reduced: true });
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(__dirname, 'capture-results.json'), JSON.stringify(report, null, 1));
  for (const [k, v] of Object.entries(report.views)) {
    const of = Object.entries(v.overflow).map(([s, o]) => `${s}:${o.scroll > o.inner ? '넘침' : '0'}`).join(' ');
    const c = v.checks;
    console.log(`${k}: 장면 ${v.shots.length} · 오류 ${v.errors.length}${v.errors.length ? ` (${v.errors.slice(0, 3).join(' | ')})` : ''} · 가로 ${of}`
      + ` · 연수 ${c.tutorialSteps?.length}단계 끝=${!c.tutorialEnded?.on} 막힘=${c.blockedOutside} 규칙=${c.onlyTargetRule}`
      + ` · 결과 ${c.results?.correct}/${c.results?.total} · 목소리 ${c.voices?.length}줄 · 영상 ${JSON.stringify(c.libraryVideo)}`
      + ` · 알림 ${c.memoAlert}${c.runningAnimations != null ? ` · 움직이는 애니메이션 ${c.runningAnimations}` : ''}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
