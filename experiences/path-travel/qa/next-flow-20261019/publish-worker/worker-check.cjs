// 확인 질문 워커 공개 확인: 실제 주소 synk.im/try/travel/에 후보 파일만 끼워(나머지는 공개본) 하루를 만들고
// 워커 파일이 실제로 뜨는지, 화면이 직접 계산했다는 경고가 없는지, 질문이 붙는지, 미리보기(빠른 변경)를 받아들인 뒤 질문이 다시 붙는지,
// 결과 직후 「이곳은 유지」 누름이 얼마나 기다리는지 본다.
// 사용: node worker-check.cjs [후보 폴더] [live]  — live면 끼워 넣지 않고 공개본 그대로 연다(공개 뒤 확인).
// 시간은 페이지 안 시계로 잰다(고정 시계를 쓰지 않는다 — ../tools/review-fixes2.cjs ②-2와 같은 방법).
const path = require('path');
const fs = require('fs');
const { chromium } = require(require.resolve('playwright', { paths: [path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const dir = process.argv[2] || path.join(__dirname, 'candidate'), live = process.argv[3] === 'live';
const files = new Set(fs.readdirSync(dir).filter(name => name !== 'report.json'));
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = { mode: live ? '공개본 그대로' : '후보를 끼운 공개 주소', runs: [] };
  for (const [name, options] of [['PC', { viewport: { width: 1280, height: 2000 } }], ['휴대폰', { viewport: { width: 390, height: 2400 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
    const ctx = await browser.newContext({ ...options, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' });
    const served = [], failed = [], errors = [], warnings = [], csp = [], worker = [];
    if (!live) await ctx.route('https://synk.im/try/travel/**', route => {
      const rel = decodeURIComponent(new URL(route.request().url()).pathname.replace(/^\/try\/travel\//, ''));
      if (files.has(rel)) { served.push(rel); return route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: fs.readFileSync(path.join(dir, rel)) }); }
      return route.continue();
    });
    const page = await ctx.newPage(), cdp = await ctx.newCDPSession(page);
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { const text = m.text().slice(0, 200); if (m.type() === 'error') (/Content Security Policy|CSP/.test(text) ? csp : errors).push(text); else if (m.type() === 'warning') warnings.push(text); });
    page.on('response', r => { if (/question-worker\.mjs/.test(r.url())) worker.push(r.status()); if (r.status() >= 400) failed.push(r.status() + ' ' + r.url().replace('https://synk.im', '')); });
    page.on('requestfailed', r => failed.push('실패 ' + r.url().replace('https://synk.im', '')));
    await page.goto('https://synk.im/try/travel/', { waitUntil: 'networkidle', timeout: 180000 });
    await page.waitForFunction(() => !/준비하고/.test(document.querySelector('#load-status')?.textContent || ''), null, { timeout: 60000 }).catch(() => {});
    await page.locator('#conditions-panel > summary').click();
    await page.locator('#trip-date').fill('2026-10-21'); await page.locator('#trip-date').dispatchEvent('change');
    await page.locator('#start-time').fill('10:00'); await page.locator('#start-time').dispatchEvent('change');
    for (const id of ['food', 'palace', 'tea']) await page.locator(`[data-intent="${id}"]`).click();
    await page.locator('#step-intent .button[data-step="2"]').click(); await page.waitForTimeout(300);
    await page.locator('.time-chips [data-hours="8"]').click(); await page.waitForTimeout(300);
    await page.evaluate(() => {
      const log = window.lockLog = [], tasks = window.longTasks = [], hit = event => event.target.closest?.('[data-lock]');
      new PerformanceObserver(list => { for (const entry of list.getEntries()) tasks.push({ start: entry.startTime, duration: entry.duration }); }).observe({ type: 'longtask' });
      addEventListener('pointerdown', event => { if (hit(event)) log.push({ at: event.timeStamp, start: performance.now() }); }, true);
    });
    const t0 = Date.now(); await page.locator('#make-day').click();
    const spot = await page.evaluate(() => new Promise((resolve, reject) => {
      const until = performance.now() + 60000;
      const check = () => { const button = document.querySelector('#result:not([hidden]) [data-lock]');
        if (!button) { if (performance.now() > until) reject(new Error('결과가 보이지 않음')); else requestAnimationFrame(check); return; }
        const box = button.getBoundingClientRect(); window.resultSeenAt = performance.now();
        resolve({ x: box.x + box.width / 2, y: box.y + box.height / 2, id: button.dataset.lock, inView: box.top >= 0 && box.bottom <= innerHeight, title: document.querySelector('#result-title')?.textContent }); };
      check(); }));
    const shownMs = Date.now() - t0;
    // 질문이 워커에서 붙는 것을 먼저 본 뒤(「유지」는 결과의 질문을 지운다), 다시 누름 지연을 잰다.
    await page.waitForFunction(() => document.querySelectorAll('#result-evidence [data-refine]').length > 0, null, { timeout: 30000 }).catch(() => {});
    const questionMs = Date.now() - t0, refine = await page.locator('#result-evidence [data-refine]').count();
    const question = await page.locator('#result-evidence .refinement h4').first().textContent().catch(() => null);
    // 미리보기(빠른 변경 「덜 걷기」) → 「이 코스로 바꾸기」: 미리보기는 질문 없이 바로 보이고, 받아들인 뒤 질문이 워커로 붙는다(10-19 밤 미리보기 판).
    const preview = {};
    if (await page.locator('[data-adjust="less-walk"]').isVisible().catch(() => false)) {
      const p0 = Date.now(); await page.locator('[data-adjust="less-walk"]').click();
      await page.waitForSelector('#plan-change:not([hidden]) [data-action="accept-change"]', { timeout: 30000 }).catch(() => {});
      preview.shownMs = Date.now() - p0; preview.label = await page.locator('#plan-change h4').first().textContent().catch(() => null);
      const a0 = Date.now(); await page.locator('#plan-change [data-action="accept-change"]').click().catch(() => {});
      await page.waitForFunction(() => document.querySelectorAll('#result-evidence [data-refine]').length > 0, null, { timeout: 30000 }).catch(() => {});
      preview.questionAfterAcceptMs = Date.now() - a0; preview.refine = await page.locator('#result-evidence [data-refine]').count();
      preview.question = await page.locator('#result-evidence .refinement h4').first().textContent().catch(() => null);
    }
    // 같은 하루를 한 번 더 만들어 결과 0.3초 뒤에 누른다(질문 계산과 겹치는 때).
    await page.evaluate(() => { window.lockLog.length = 0; window.longTasks.length = 0; });
    await page.locator('[data-action="new-day"]').click().catch(() => {}); await page.waitForTimeout(400);
    await page.locator('#step-intent .button[data-step="2"]').click().catch(() => {}); await page.waitForTimeout(300);
    await page.locator('.time-chips [data-hours="8"]').click().catch(() => {}); await page.waitForTimeout(300);
    const again = await page.locator('#make-day').isVisible().catch(() => false);
    let press = null;
    if (again) {
      await page.locator('#make-day').click();
      const spot2 = await page.evaluate(() => new Promise(resolve => { const check = () => { const button = document.querySelector('#result:not([hidden]) [data-lock]'); if (!button || button.getAttribute('aria-pressed') === 'true') return requestAnimationFrame(check); const box = button.getBoundingClientRect(); window.resultSeenAt = performance.now(); resolve({ x: box.x + box.width / 2, y: box.y + box.height / 2, id: button.dataset.lock, inView: box.top >= 0 && box.bottom <= innerHeight }); }; check(); }));
      await new Promise(resolve => setTimeout(resolve, 300));
      const t1 = Date.now(), timestamp = t1 / 1000;
      await Promise.all(['mousePressed', 'mouseReleased'].map(type => cdp.send('Input.dispatchMouseEvent', { type, x: spot2.x, y: spot2.y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1, timestamp })));
      await page.waitForFunction(id => document.querySelector(`[data-lock="${id}"]`)?.getAttribute('aria-pressed') === 'true', spot2.id, { timeout: 30000 }).catch(() => {});
      const seenMs = Date.now() - t1;
      const { log, tasks } = await page.evaluate(() => ({ log: window.lockLog, tasks: window.longTasks }));
      const down = log[0], round = v => Number.isFinite(v) ? Math.round(v) : null;
      press = { inView: spot2.inView, inputDelayMs: round(down?.start - down?.at), pressedSeenMs: seenMs, longTasksAtOrAfterPressMs: tasks.filter(t => down && t.start + t.duration > down.at).map(t => round(t.duration)) };
    }
    report.runs.push({ name, served: [...new Set(served)], workerResponses: worker, title: spot.title, shownMs, questionMs, refine, question, preview, press, failed, errors, warnings, csp });
    await ctx.close();
  }
  console.log(JSON.stringify(report, null, 1));
  await browser.close();
})();
