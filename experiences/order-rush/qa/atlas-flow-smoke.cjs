'use strict';
// Atlas moment-level challenge in the real cafe. Isolated browser contexts; never a user's profile.
// Four people: quick and accurate, one who lets a customer leave, one who chose fixed speed, and one
// who said "tired" in the hub today.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const base = process.env.SYNK_QA_BASE || 'http://127.0.0.1:4291';
const shot = name => path.join(__dirname, 'shots', name);   // 캡처는 qa/shots/에
// Serve the current customers correctly, right after each order is heard.
const SERVE = `async n => {
  const core = await import('/order-rush/core.mjs');
  const byId = Object.fromEntries([...core.ORDERS, ...core.REVIEW].map(o => [o.id, o]));
  const sleep = ms => new Promise(r => setTimeout(r, ms)), click = s => document.querySelector(s).click(), out = [];
  for (let k = 0; k < n; k += 1) {
    // 줄이 비면 다음 손님은 영업 시간 10초 뒤에 오고 주문은 3~6초다: 끝까지 듣기 전에 서빙하지 않게 30초까지 기다린다
    for (let i = 0; i < 300 && !(window.synkCafe.current && window.synkCafe.current.audioCompleted); i += 1) await sleep(100);
    const cur = window.synkCafe.current; if (!cur) break;
    byId[cur.id].cups.forEach((cup, i) => {
      if (i > 0) click('#add-cup');
      click('[data-ingredient="' + cup.base + '"]');
      if (cup.milk) click('[data-ingredient="milk"]');
      if (cup.ice === true) click('[data-ingredient="ice"]'); else if (cup.temp === 'cold') click('[data-ingredient="cold"]');
      if (cup.sugar === true) click('[data-ingredient="sugar"]');
    });
    click('#serve');
    await sleep(600);
    const line = document.querySelector('#flow-line');
    out.push({ id: cur.id, line: line.hidden ? null : line.textContent, tuning: window.synkCafe.tuning });
  }
  return out;
}`;
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const result = { origin: base, at: new Date().toISOString() }, errors = [];
  const open = async (viewport = { width: 1280, height: 900 }) => {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/order-rush/?qa`); await page.locator('#learning-reason').filter({ hasText: '기록' }).waitFor();
    return { context, page };
  };
  // 2026-10-06 화면: 속도는 「나에게 맞춘 속도」 칩 하나(눌림 = 맞춤, 안 눌림 = 정해진 속도)
  const rush = async (page, flow = 'auto') => {
    await page.locator('[data-mode="rush"]').click();
    if ((await page.locator('#flow-toggle').getAttribute('aria-pressed') === 'true') !== (flow === 'auto')) await page.locator('#flow-toggle').click();
    await page.locator('#start').click(); await page.waitForFunction(() => window.synkCafe.current?.audioCompleted);
  };
  try {
    // 1. Quick and accurate: the cafe gets busier, each change is said, the shift summary lists it.
    const quick = await open();
    await quick.page.screenshot({ path: shot('flow-lobby-desktop.png') });
    await rush(quick.page);
    result.quick = await quick.page.evaluate(`(${SERVE})(9)`);
    const changed = result.quick.filter(r => r.line);
    assert.ok(changed.length > 0, 'a quick, accurate person sees the cafe change');
    const last = result.quick.at(-1).tuning;
    assert.ok(last.patience < 42 || last.spawnEvery < 10 || last.queueMax > 3, 'the rush got busier');
    await quick.page.screenshot({ path: shot('flow-game-desktop.png') });
    // 영업 중간에 결과를 보는 단추는 없앴다(처음으로는 결과 없이 나간다) → 확인 도구의 끝내기(?qa)
    await quick.page.evaluate(() => window.__rush.finish()); await quick.page.locator('#results').waitFor({ state: 'visible' });
    result.quickSummary = await quick.page.locator('#result-flow li').allTextContents();
    assert.ok(result.quickSummary.length > 0 && !result.quickSummary[0].includes('그대로'), 'the summary names what changed');
    await quick.page.locator('#result-flow').scrollIntoViewIfNeeded();
    await quick.page.screenshot({ path: shot('flow-results-desktop.png') });
    // The next shift resumes from where this person left off.
    await quick.page.locator('#home').click(); await rush(quick.page);
    result.quickNextLine = await quick.page.locator('#flow-line').textContent();
    assert.equal(result.quickNextLine, '지난번 영업에 맞춰 문을 열어요.');
    result.quickNextTuning = await quick.page.evaluate(() => window.synkCafe.tuning);
    assert.deepEqual({ p: result.quickNextTuning.patience, s: result.quickNextTuning.spawnEvery, q: result.quickNextTuning.queueMax }, { p: last.patience, s: last.spawnEvery, q: last.queueMax });
    await quick.context.close();

    // 2. A customer leaves: more time for this person, without a language error on record.
    const slow = await open();
    await rush(slow.page);
    await slow.page.waitForFunction(() => !document.querySelector('#flow-line').hidden, null, { timeout: 90000 });
    result.slowLine = await slow.page.locator('#flow-line').textContent();
    result.slowTuning = await slow.page.evaluate(() => window.synkCafe.tuning);
    result.slowLearning = await slow.page.evaluate(() => ({ independent: window.synkCafe.learning.independent }));
    assert.equal(result.slowLine, '손님이 조금 더 여유 있게 기다려요.');
    assert.ok(result.slowTuning.patience > 42 || result.slowTuning.spawnEvery > 10 || result.slowTuning.queueMax < 3);
    await slow.page.screenshot({ path: shot('flow-game-eased.png') });
    await slow.context.close();

    // 3. Fixed speed: the original rush, whatever happens.
    const fixed = await open();
    await rush(fixed.page, 'fixed');
    result.fixedLine = await fixed.page.locator('#flow-line').textContent();
    result.fixed = await fixed.page.evaluate(`(${SERVE})(6)`);
    assert.equal(result.fixedLine, '정해진 속도로 영업해요.');
    for (const r of result.fixed) assert.deepEqual({ p: r.tuning.patience, s: r.tuning.spawnEvery, q: r.tuning.queueMax }, { p: 42, s: 10, q: 3 });
    await fixed.context.close();

    // 4. "Tired" in the hub: the same quick, accurate serving never makes the cafe busier today.
    const tired = await open();
    await tired.page.goto(`${base}/learning-hub/`); await tired.page.locator('[data-today="tired"]').click();
    result.tiredHubNote = await tired.page.locator('#today-note').textContent();
    await tired.page.goto(`${base}/order-rush/?qa`); await tired.page.locator('#learning-reason').filter({ hasText: '기록' }).waitFor();
    await rush(tired.page);
    result.tiredLine = await tired.page.locator('#flow-line').textContent();
    result.tiredStart = await tired.page.evaluate(() => window.synkCafe.tuning);
    result.tired = await tired.page.evaluate(`(${SERVE})(8)`);
    assert.equal(result.tiredLine, '오늘은 더 바빠지지 않게 영업해요.');
    for (const r of result.tired) {
      assert.ok(r.tuning.patience >= result.tiredStart.patience && r.tuning.spawnEvery >= result.tiredStart.spawnEvery && r.tuning.queueMax <= result.tiredStart.queueMax, 'never busier on a tired day');
      assert.ok(!r.line || !r.line.includes('바빠져요'), 'and never says so');
    }
    await tired.context.close();

    // 5. Phone width: the switch and the line fit without hidden overflow.
    const phone = await open({ width: 390, height: 844 });
    await phone.page.screenshot({ path: shot('flow-lobby-mobile.png'), fullPage: true });
    result.mobileOverflow = await phone.page.evaluate(() => ({ scroll: document.documentElement.scrollWidth > innerWidth, zoomed: innerWidth > (visualViewport?.width ?? innerWidth) + 1 }));
    assert.deepEqual(result.mobileOverflow, { scroll: false, zoomed: false });
    await rush(phone.page);
    await phone.page.evaluate(`(${SERVE})(4)`);
    await phone.page.screenshot({ path: shot('flow-game-mobile.png') });
    result.mobileGameOverflow = await phone.page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(result.mobileGameOverflow, false);
    await phone.context.close();
    result.pageErrors = errors;
    assert.deepEqual(errors, []);
    result.status = 'passed';
  } catch (error) {
    result.status = 'failed'; result.error = error.message; result.pageErrors = errors;
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(path.join(__dirname, 'atlas-flow-smoke.json'), JSON.stringify(result, null, 2) + '\n');
    await browser.close();
    console.log(JSON.stringify({ status: result.status, error: result.error, quickChanges: result.quick?.filter(r => r.line).map(r => r.line), slowLine: result.slowLine, summary: result.quickSummary, tiredLine: result.tiredLine, tiredStart: result.tiredStart, tiredEnd: result.tired?.at(-1)?.tuning }, null, 1));
  }
})();
