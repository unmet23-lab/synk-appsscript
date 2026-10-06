'use strict';
// 레이싱의 다른 길들을 실제로 지나 본다(헤드리스 크롬, 실제 WebGL): play.cjs가 다루지 않는 흐름.
//  early  : 3D 준비 전에 ‘레이스 시작’을 누르면 기억했다가 준비되는 대로 출발(처음이면 조작 연습) → ‘연습 건너뛰기’ → 레이스
//  demo   : 자동 시연 — 시연 꼬리표, 정답 길을 따라 완주, 결과는 코인·기록 없이
//  words  : 코스 고르기 → 어휘 연습(그림 스테이지) → 그림 꼬리표로 다섯 문제 → 결과
//  keys   : Esc로 멈춤·이어 하기, 멈춤 창의 ‘처음으로’
// 쓰는 법: node experiences/korean-racing/qa/flows.cjs [early|demo|words|keys]
const path = require('node:path'), fs = require('node:fs');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM] }));
const URL_BASE = (process.env.RACING_ORIGIN || 'http://127.0.0.1:5281') + '/korean-racing/?qa';
const OUT = path.join(__dirname, 'shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function scene(browser, name, fn, { tutorialDone = true, view = { viewport: { width: 1280, height: 800 } } } = {}) {
  const ctx = await browser.newContext(view);
  if (tutorialDone) await ctx.addInitScript(() => { try { localStorage.setItem('SYNK_RACING_TUTORIAL_V1', JSON.stringify({ version: 1, completed: true })); } catch { /* 없음 */ } });
  const page = await ctx.newPage(), errors = [], fails = [], notes = [];
  page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const Q = () => page.evaluate(() => window.__racingQA.state());
  const check = (ok, what) => { if (!ok) fails.push(what); };
  const waitFor = async (pred, what, timeout = 60000) => { const t0 = Date.now(); let s; while (Date.now() - t0 < timeout) { s = await Q().catch(() => null); if (s && pred(s)) return s; await sleep(80); } throw new Error(`기다림 초과: ${what} ${JSON.stringify(s?.gate || s)}`); };
  const advance = (sec) => page.evaluate((s) => window.__racingQA.advance(s), sec);
  const advanceUntil = async (pred, what, limit = 60) => { for (let t = 0; t < limit; t += .25) { const s = await Q(); if (pred(s)) return s; await advance(.25); } throw new Error('빨리 감기로도 안 됨: ' + what); };
  const race = async (answer = true) => {
    for (let n = 1; n <= 5; n++) {
      const s = await advanceUntil((x) => x.gateIndex === n - 1 && x.gate?.announced, `${n}번 문제`);
      await page.evaluate(() => window.__racingQA.hearNow());
      if (answer) await page.click(`#lane-choices .lane-tag[data-word="${s.gate.answer}"]`);
      await advanceUntil((x) => x.answers.length === n, `${n}번 판정`);
    }
    await advanceUntil((x) => x.coast.phase === 'drive', '드라이브', 20);
  };
  try { await fn({ page, Q, check, waitFor, advance, advanceUntil, race, notes }); }
  catch (e) { fails.push('중단: ' + String(e.message || e).split('\n')[0]); }
  check(!errors.length, '콘솔 오류 ' + errors.join(' | '));
  await ctx.close();
  console.log(`${fails.length ? '✗' : '✓'} ${name}${fails.length ? '\n  - ' + fails.join('\n  - ') : ''}${notes.length ? '\n  · ' + notes.join('\n  · ') : ''}`);
  return fails.length === 0;
}

const FLOWS = {
  early: (b) => scene(b, 'early', async ({ page, Q, check, waitFor, notes }) => {
    await page.goto(URL_BASE);
    await page.waitForSelector('#start');
    const ready0 = await page.evaluate(() => window.__racing.snapshot().ready);
    await page.click('#start');
    const label = await page.textContent('#start span');
    notes.push(`누른 때 3D 준비 ${ready0 ? '끝' : '전'} · 단추 글 ‘${label}’`);
    if (!ready0) check(label === '준비되면 바로 출발해요', `준비 전 단추 글 ${label}`);
    const s = await waitFor((x) => x.screen === 'game' && x.tutorial === 'steer-left', '조작 연습 시작');
    check(s.running, '연습이 달리는 중');
    await page.click('#tutorial-skip');
    await waitFor((x) => x.screen === 'game' && !x.tutorial && x.running && x.gate, '레이스로 넘어감');
    check(!(await page.evaluate(() => window.__racingQA.state().tutorial)), '건너뛴 뒤 연습이 꺼짐');
  }, { tutorialDone: false }),

  demo: (b) => scene(b, 'demo', async ({ page, check, waitFor, advanceUntil, notes }) => {
    await page.goto(URL_BASE); await page.waitForFunction(() => window.__racing.snapshot().ready, null, { timeout: 120000 });
    await page.click('#watch');
    await waitFor((x) => x.screen === 'game' && x.running, '시연 시작');
    check(await page.evaluate(() => !document.querySelector('#demo-indicator').hidden), '시연 꼬리표');
    await page.screenshot({ path: path.join(OUT, 'flow_demo_race.png') });
    for (let n = 1; n <= 5; n++) {
      await advanceUntil((x) => x.gateIndex === n - 1 && x.gate?.announced, `${n}번`);
      await page.evaluate(() => window.__racingQA.hearNow());
      await advanceUntil((x) => x.answers.length === n, `${n}번 판정`);
    }
    const s = await advanceUntil((x) => x.coast.phase === 'drive', '드라이브', 20);
    check(s.answers.every((a) => a.correct), '자동 시연은 정답 길로 달린다');
    await page.click('#cruise-results'); await waitFor((x) => x.screen === 'results', '결과');
    const r = await page.evaluate(() => ({ coins: document.querySelector('#r-coins').textContent, title: document.querySelector('#r-title').textContent, stars: document.querySelector('#r-stars').getAttribute('aria-label'),
      balance: window.__racing.snapshot().collection.coins, rounds: window.__racing.snapshot().learning.rounds }));
    check(r.coins === '자동 시연은 공통 코인을 지급하지 않아요.' && r.balance === 0 && r.rounds === 0, `시연은 코인·기록 없음 ${JSON.stringify(r)}`);
    notes.push(`${r.title} · ${r.coins}`);
    await page.screenshot({ path: path.join(OUT, 'flow_demo_results.png') });
  }),

  words: (b) => scene(b, 'words', async ({ page, check, waitFor, race, notes }) => {
    await page.goto(URL_BASE); await page.waitForFunction(() => window.__racing.snapshot().ready, null, { timeout: 120000 });
    await page.click('#choose-course'); await sleep(300);
    await page.click('#collection-words'); await sleep(200);
    await page.click('#stage-grid .course-tile[data-stage="s001"]'); await sleep(300);
    const title = await page.textContent('#l-title');
    check(title === '001 · 과일 가게', `어휘 스테이지 선택 ${title}`);
    await page.click('#start');
    await waitFor((x) => x.screen === 'game' && x.running && x.stage === 's001', '어휘 레이스');
    await page.evaluate(() => window.__racingQA.advance(5));
    const tags = await page.evaluate(() => [...document.querySelectorAll('#lane-choices .lane-tag')].map((t) => ({ pic: t.classList.contains('picture'), text: t.querySelector('.say').textContent })));
    check(tags.length === 3 && tags.every((t) => t.pic), `그림 꼬리표 ${JSON.stringify(tags)}`);
    await page.screenshot({ path: path.join(OUT, 'flow_words_race.png') });
    await race(true);
    await page.click('#cruise-results'); await waitFor((x) => x.screen === 'results', '결과');
    const r = await page.evaluate(() => ({ correct: document.querySelector('#r-correct').textContent, rows: [...document.querySelectorAll('#r-log li .a b')].map((b) => b.textContent) }));
    check(r.correct === '5' && new Set(r.rows).size === 5, `낱말 결과(서로 다른 다섯 낱말) ${JSON.stringify(r)}`);
    notes.push(`그림 꼬리표 ${tags.map((t) => t.text).join(' ')} · 결과 ${r.rows.join(' · ')}`);
  }),

  keys: (b) => scene(b, 'keys', async ({ page, check, waitFor, advanceUntil }) => {
    await page.goto(URL_BASE); await page.waitForFunction(() => window.__racing.snapshot().ready, null, { timeout: 120000 });
    await page.click('#start');
    await waitFor((x) => x.screen === 'game' && x.running, '레이스');
    await advanceUntil((x) => x.gate?.announced, '1번');
    await page.keyboard.press('Escape'); await sleep(250);
    check(await page.evaluate(() => document.querySelector('#pause-dialog').open && window.__racingQA.state().paused), 'Esc로 멈춤');
    await page.keyboard.press('Escape'); await sleep(250);
    check(await page.evaluate(() => !document.querySelector('#pause-dialog').open && !window.__racingQA.state().paused), 'Esc로 이어 하기');
    await page.keyboard.press('Escape'); await sleep(250);
    await page.click('#exit');
    await waitFor((x) => x.screen === 'lobby' && !x.running, '처음으로');
  }),
};

(async () => {
  const want = process.argv.slice(2);
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'] });
  let ok = true;
  for (const name of want.length ? want : Object.keys(FLOWS)) ok = (await FLOWS[name](browser)) && ok;
  await browser.close();
  process.exitCode = ok ? 0 : 1;
})();
