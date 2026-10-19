// Fable 재검수(10-19 저녁) P1·P3를 고친 뒤 확인: 저녁 궁궐(운영 시각 밖 금지), 질문을 나중에 붙이는 하루 만들기,
// 폼에서 넷 켠 뒤 고르기 세 개 제한, 앞날 15:00에 하루를 고를 때 알림, 2시간 한 곳 모드 뒤 1장 안내.
// 10-19 밤: 같은 하루에서 결과가 보인 뒤 「이곳은 유지」를 누르면 얼마나 늦게 처리되는지(질문 계산을 워커로 옮기기 전후)를 더했다.
// 사용: node review-fixes2.cjs <url> <출력폴더> [유지만]  — 결과는 <출력폴더>/report.json. 셋째 인자가 「유지만」이면 그 측정만 돈다.
const path = require('path');
const fs = require('fs');
const { chromium } = require(require.resolve('playwright', { paths: [path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const [url, out, only] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = {};
  const open = async (clock = '2026-10-19T03:50:00Z', extra = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', ...extra });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    if (clock) await page.clock.setFixedTime(new Date(clock));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !/준비하고/.test(document.querySelector('#load-status')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
    return { ctx, page, errors };
  };
  const toTime = page => page.locator('#step-intent .button[data-step="2"]').click().then(() => page.waitForTimeout(300));
  const stops = page => page.evaluate(() => [...document.querySelectorAll('.story')].map(c => c.querySelector('.story-time').textContent + ' ' + c.querySelector('h3').textContent));
  const want = name => only !== '유지만' || name === 'lockAfterResult';
  // ① 월 14:59 차+궁궐 3시간: 경복궁(18시 폐장, 17시 입장 마감)을 운영 시각 밖에 넣지 않는다
  if (want('eveningPalace')) { const { ctx, page, errors } = await open('2026-10-19T05:59:00Z');
    await page.locator('[data-intent="tea"]').click(); await page.locator('[data-intent="palace"]').click(); await toTime(page);
    const fit = await page.locator('#fit-text').textContent();
    await page.locator('#make-day').click(); await page.waitForSelector('#result:not([hidden]),#empty-result:not([hidden])'); await page.waitForTimeout(400);
    report.eveningPalace = { fit, title: await page.locator('#result-title').textContent().catch(() => ''), stops: await stops(page), errors };
    await ctx.close(); }
  // ② 하루 맛집+궁궐+차: 결과가 보이는 데 걸린 시간과 질문이 나중에 붙는지
  if (want('deferredQuestion')) { const { ctx, page, errors } = await open();
    for (const id of ['food', 'palace', 'tea']) await page.locator(`[data-intent="${id}"]`).click();
    await toTime(page); await page.locator('.time-chips [data-hours="8"]').click(); await page.waitForTimeout(300);
    const t0 = Date.now(); await page.locator('#make-day').click(); await page.waitForSelector('#result:not([hidden])'); const shown = Date.now() - t0;
    const questionAtShow = await page.locator('#result-evidence .question, #result-evidence [data-refine]').count();
    await page.waitForFunction(() => document.querySelectorAll('#result-evidence [data-refine]').length > 0, null, { timeout: 8000 }).catch(() => {});
    const askedAfter = Date.now() - t0;
    report.deferredQuestion = { shownMs: shown, questionAtShow, questionLaterMs: askedAfter, refineButtons: await page.locator('#result-evidence [data-refine]').count(), title: await page.locator('#result-title').textContent(), errors };
    await ctx.close(); }
  // ②-2 같은 하루(맛집+궁궐+차, 하루)에서 결과가 보인 뒤 손이 가는 만큼(0.1·0.3·0.6초) 쉬었다가 첫 카드의 「이곳은 유지」를 누른다.
  // 누름은 페이지를 거치지 않는 마우스 입력(CDP)으로 보내, 메인 스레드가 바쁘면 그동안 줄을 서게 한다. 시간은 페이지 안에서 잰다:
  // 입력 지연 = 누름 처리가 시작된 시각 - 누른 시각(event.timeStamp), 처리 = 유지 처리(일정 다시 그리기), 다음 프레임까지 = 누른 시각부터 처리 뒤 첫 프레임.
  // 고정 시계(page.clock)는 페이지의 performance.now·타이머까지 바꿔 지연이 0으로 읽힌다(10-19 확인). 그래서 이 측정만 실제 시계로 열고,
  // 날짜·출발 시각은 폼에 직접 적어(10-21 수 10:00) 고르기가 그날 하루를 잡게 한다. 메인을 50ms 넘게 막은 일(longtask)도 같이 적는다.
  // 「보인 뒤 확인」은 노드 쪽에서 잰 누름 → 「유지 중」이 보일 때까지(폴링 몫 수십 ms 포함)다.
  // 「유지」는 결과의 질문을 지운다(invalidatePreferencePreview) — 그래서 이 측정에서는 질문이 붙지 않는 것이 맞다.
  // 「느림4배」는 CPU를 4배 늦춘 휴대폰 흉내다(워커 스레드까지 늦추는지는 확인하지 않았다).
  if (want('lockAfterResult')) {
    report.lockAfterResult = [];
    for (const [cpu, rate] of [['보통', 1], ['느림4배', 4]]) for (const pause of [100, 300, 600]) {
      const { ctx, page, errors } = await open(null, { viewport: { width: 1280, height: 2000 }, reducedMotion: 'reduce' });
      const cdp = await ctx.newCDPSession(page);
      await page.locator('#conditions-panel > summary').click();
      await page.locator('#trip-date').fill('2026-10-21'); await page.locator('#trip-date').dispatchEvent('change');
      await page.locator('#start-time').fill('10:00'); await page.locator('#start-time').dispatchEvent('change');
      for (const id of ['food', 'palace', 'tea']) await page.locator(`[data-intent="${id}"]`).click();
      await toTime(page); await page.locator('.time-chips [data-hours="8"]').click(); await page.waitForTimeout(300);
      const range = await page.locator('#dial-range').textContent();
      if (rate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      await page.evaluate(() => {
        const log = window.lockLog = [], tasks = window.longTasks = [], hit = event => event.target.closest?.('[data-lock]');
        new PerformanceObserver(list => { for (const entry of list.getEntries()) tasks.push({ start: entry.startTime, duration: entry.duration }); }).observe({ type: 'longtask' });
        addEventListener('pointerdown', event => { if (hit(event)) log.push({ type: 'down', at: event.timeStamp, start: performance.now() }); }, true);
        addEventListener('click', event => { if (hit(event)) log.push({ type: 'click', at: event.timeStamp, start: performance.now() }); }, true);
        // 여행 화면의 누름 처리는 document에 걸려 있어 window의 거품 단계가 그 뒤에 온다.
        addEventListener('click', event => { const row = log.findLast(item => item.type === 'click'); if (!row || !hit(event)) return; row.end = performance.now(); requestAnimationFrame(() => { row.frame = performance.now(); }); });
      });
      const t0 = Date.now(); await page.locator('#make-day').click();
      // 결과를 알아챈 프레임에서 바로 값으로 돌려받는다. waitForFunction 뒤 jsonValue()는 두 번째 왕복이라, 그 사이 메인이 막히면
      // 막힘이 끝난 뒤에야 돌아와 누름이 늦어진다(10-19 전 측정에서 확인).
      const spot = await page.evaluate(() => new Promise((resolve, reject) => {
        const until = performance.now() + 30000;
        const check = () => {
          const button = document.querySelector('#result:not([hidden]) [data-lock]');
          if (!button) { if (performance.now() > until) reject(new Error('결과가 보이지 않음')); else requestAnimationFrame(check); return; }
          const box = button.getBoundingClientRect(); window.resultSeenAt = performance.now();
          resolve({ x: box.x + box.width / 2, y: box.y + box.height / 2, id: button.dataset.lock, inView: box.top >= 0 && box.bottom <= innerHeight, questionAtShow: document.querySelectorAll('#result-evidence [data-refine]').length });
        };
        check();
      }));
      const shownMs = Date.now() - t0;
      await new Promise(resolve => setTimeout(resolve, pause));
      const t1 = Date.now(), timestamp = t1 / 1000;
      await Promise.all(['mousePressed', 'mouseReleased'].map(type => cdp.send('Input.dispatchMouseEvent', { type, x: spot.x, y: spot.y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1, timestamp })));
      await page.waitForFunction(id => document.querySelector(`[data-lock="${id}"]`)?.getAttribute('aria-pressed') === 'true', spot.id, { timeout: 30000 }).catch(() => {});
      const pressedSeenMs = Date.now() - t1;
      await page.waitForTimeout(2500);
      const { log, tasks, resultSeenAt } = await page.evaluate(() => ({ log: window.lockLog, tasks: window.longTasks, resultSeenAt: window.resultSeenAt }));
      const down = log.find(row => row.type === 'down'), click = log.find(row => row.type === 'click');
      const round = value => Number.isFinite(value) ? Math.round(value) : null;
      // 누른 시각 뒤에 끝난 긴 일 = 누름이 기다린 일. 결과를 만든 일(누르기 전에 끝남)과 나눈다.
      const after = tasks.filter(task => down && task.start + task.duration > down.at);
      report.lockAfterResult.push({ cpu, pauseMs: pause, range, shownMs, inView: spot.inView, questionAtShow: spot.questionAtShow, pressAfterResultMs: round(down?.at - resultSeenAt),
        inputDelayMs: round(down?.start - down?.at), handlerMs: round(click?.end - click?.start), toFrameMs: round(click?.frame - down?.at), pressedSeenMs,
        longTasksBeforePressMs: tasks.filter(task => !after.includes(task)).map(task => round(task.duration)), longTasksAtOrAfterPressMs: after.map(task => round(task.duration)),
        pressed: await page.locator(`[data-lock="${spot.id}"]`).getAttribute('aria-pressed'), refineAfterLock: await page.locator('#result-evidence [data-refine]').count(), errors });
      await ctx.close();
    }
  }
  // ③ 폼에서 넷을 켠 뒤 고르기를 하나 더 누르면 셋으로 줄인다
  if (want('fourFromForm')) { const { ctx, page, errors } = await open();
    await page.locator('#conditions-panel > summary').click(); await page.evaluate(() => { for (const box of document.querySelectorAll('#trip-form details')) box.open = true; });
    for (const value of ['food', 'tea', 'art']) await page.locator(`[name="preference"][value="${value}"]`).check();
    await page.locator('[data-taste="marketFood"]').selectOption('true');
    const four = await page.$$eval('[data-intent][aria-pressed="true"]', bs => bs.map(b => b.dataset.intent));
    await page.locator('[data-intent="palace"]').click(); await page.waitForTimeout(200);
    report.fourFromForm = { four, after: await page.$$eval('[data-intent][aria-pressed="true"]', bs => bs.map(b => b.dataset.intent)), note: await page.locator('#pick-note').textContent(),
      form: await page.evaluate(() => ({ food: document.querySelector('[name="preference"][value="food"]').checked, tea: document.querySelector('[name="preference"][value="tea"]').checked, art: document.querySelector('[name="preference"][value="art"]').checked, history: document.querySelector('[name="preference"][value="history"]').checked, market: document.querySelector('[data-taste="marketFood"]').value })), errors };
    await ctx.close(); }
  // ④ 앞날 15:00을 직접 정하고 하루를 고르면 당긴 까닭을 알린다
  if (want('handLate')) { const { ctx, page, errors } = await open();
    await page.locator('#conditions-panel > summary').click();
    await page.locator('#trip-date').fill('2026-10-24'); await page.locator('#trip-date').dispatchEvent('change');
    await page.locator('#start-time').fill('15:00'); await page.locator('#start-time').dispatchEvent('change');
    await page.locator('[data-intent="tea"]').click(); await toTime(page);
    const three = { range: await page.locator('#dial-range').textContent(), fit: await page.locator('#fit-text').textContent() };
    await page.locator('.time-chips [data-hours="8"]').click(); await page.waitForTimeout(300);
    report.handLate = { three, day: { range: await page.locator('#dial-range').textContent(), fit: await page.locator('#fit-text').textContent() }, errors };
    await ctx.close(); }
  // ⑤ 2시간 전시+차(한 곳 모드) 뒤 1장으로 돌아가면 안내가 그 사실을 말한다
  if (want('singleBack')) { const { ctx, page, errors } = await open();
    await page.locator('[data-intent="art"]').click(); await page.locator('[data-intent="tea"]').click(); await toTime(page);
    await page.locator('.time-chips [data-hours="2"]').click(); await page.waitForTimeout(300);
    await page.locator('[data-step="1"]').click(); await page.waitForTimeout(200);
    report.singleBack = { note: await page.locator('#pick-note').textContent(), pressed: await page.$$eval('[data-intent][aria-pressed="true"]', bs => bs.map(b => b.dataset.intent)), errors };
    await ctx.close(); }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
  await browser.close();
})();
