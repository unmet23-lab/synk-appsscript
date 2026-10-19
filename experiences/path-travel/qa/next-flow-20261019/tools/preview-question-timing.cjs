// 바꾸기 전 비교(미리보기)의 확인 질문을 받아들인 뒤로 미룬 전후(10-19 밤): 누른 뒤 메인을 막던 계산이 사라졌는지 잰다.
// 방법은 review-fixes2.cjs ②-2와 같다 — 누름은 페이지를 거치지 않는 마우스 입력(CDP)으로 보내고, 시간은 페이지 안에서 잰다:
// 누른 시각(event.timeStamp) → 처리 시작(입력 지연) → 처리 뒤 첫 프레임(다음 프레임까지), 그리고 누른 뒤 메인을 50ms 넘게 막은 일(longtask).
// 고정 시계(page.clock)는 페이지의 performance.now·타이머까지 바꿔 지연이 사라지므로 쓰지 않는다. 여행 중 조정(남은 일정)은 여행 날에만 열려서
// Date만 서울 10-21(수) 09:30으로 당기고(performance.now·이벤트 시각은 그대로), 하루는 그날 10:00–18:00 맛집+궁궐+차로 만든다.
// 한 페이지에서 차례로: 빠른 변경(덜 걷기) → 받아들이기 → 답하기 → 바꾸기 → 장소 넣기 → 남은 일정 비교 → 받아들이기. 미리보기는 하나씩 취소한다.
// 일정이 없을 때의 장소 넣기(바로 받아들임)는 새 페이지에서 잰다. 받아들이기는 질문이 붙기까지(누른 시각부터)도 잰다.
// 전(before)은 page.route로 planner-ui.mjs만 고치기 전 판으로 바꿔 끼운다 — 같은 서버·같은 워커다.
// 사용: node preview-question-timing.cjs <url> <출력폴더> --before <고치기 전 planner-ui.mjs> [--rounds 2] [--rates 1,4]  — 결과는 <출력폴더>/timing.json
const path = require('path');
const fs = require('fs');
const { chromium } = require(require.resolve('playwright', { paths: [path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const argv = process.argv.slice(2), [url, out] = argv, flag = name => { const at = argv.indexOf(name); return at < 0 ? null : argv[at + 1]; };
const beforeSource = fs.readFileSync(flag('--before'), 'utf8'), rounds = Number(flag('--rounds') ?? 2), rates = (flag('--rates') ?? '1,4').split(',').map(Number);
fs.mkdirSync(out, { recursive: true });
const TODAY = Date.parse('2026-10-21T00:30:00Z');
// 페이지에 먼저 넣는 것: Date 당기기, 누름·긴 일 기록.
const shiftDate = target => {
  const Real = Date, offset = target - Real.now();
  class Shifted extends Real { constructor(...values) { if (values.length) super(...values); else super(Real.now() + offset); } static now() { return Real.now() + offset; } }
  globalThis.Date = Shifted;
};
const hooks = () => {
  const log = window.pressLog = [], tasks = window.longTasks = [];
  new PerformanceObserver(list => { for (const entry of list.getEntries()) tasks.push({ start: entry.startTime, duration: entry.duration }); }).observe({ type: 'longtask' });
  addEventListener('pointerdown', event => { if (window.armed) log.push({ type: 'down', at: event.timeStamp, start: performance.now() }); }, true);
  // 처리 시작에 프레임을 하나 걸어 두면, 누름 처리(제출 단추면 이어지는 submit 처리까지)가 끝난 뒤 첫 프레임에 불린다.
  addEventListener('click', event => { if (!window.armed) return; const row = { type: 'click', at: event.timeStamp, start: performance.now() }; log.push(row); requestAnimationFrame(() => { row.frame = performance.now(); }); }, true);
};
const previewShown = () => !document.querySelector('#plan-change').hidden && Boolean(document.querySelector('#plan-change [data-action="accept-change"], #plan-change .recovery-options'));
const resultShown = () => document.querySelector('#plan-change').hidden && !document.querySelector('#result').hidden;
const round = value => Number.isFinite(value) ? Math.round(value) : null;
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = { url, today: new Date(TODAY).toISOString(), rows: [] };
  const open = async version => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 2000 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' });
    await ctx.addInitScript(shiftDate, TODAY); await ctx.addInitScript(hooks);
    const page = await ctx.newPage(), errors = [], warnings = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); else if (m.type() === 'warning') warnings.push(m.text()); });
    if (version === 'before') await page.route('**/planner-ui.mjs', route => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: beforeSource }));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !/준비하고/.test(document.querySelector('#load-status')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
    const clock = await page.evaluate(() => ({ nativeNow: /native code/.test(performance.now.toString()), today: new Date().toISOString() }));
    return { ctx, page, cdp: await ctx.newCDPSession(page), errors, warnings, clock };
  };
  // 단추를 화면 가운데로 옮기고 같은 왕복에서 위치를 받은 뒤 누른다. 끝은 done이 참이 될 때, 긴 일은 그 뒤 1.2초까지 받는다.
  const press = async (session, selector, done, label, { question = false } = {}) => {
    const { page, cdp } = session;
    const spot = await page.evaluate(sel => {
      const el = [...document.querySelectorAll(sel)].find(row => row.offsetWidth || row.offsetHeight); if (!el) return null;
      el.scrollIntoView({ block: 'center', behavior: 'instant' }); const box = el.getBoundingClientRect();
      // 받아들인 뒤 질문 칸에 단추가 처음 생긴 때를 적는다(받아들이기 전의 질문은 세지 않는다).
      const evidence = document.querySelector('#result-evidence');
      window.questionAt = null; window.questionWatch?.disconnect();
      window.questionWatch = new MutationObserver(() => { if (window.questionAt === null && evidence.querySelector('[data-refine]')) window.questionAt = performance.now(); });
      window.questionWatch.observe(evidence, { childList: true, subtree: true });
      return { x: box.x + box.width / 2, y: box.y + box.height / 2, text: el.textContent.trim().slice(0, 24) };
    }, selector);
    if (!spot) return { label, error: '단추 없음 ' + selector };
    await page.waitForTimeout(300);
    await page.evaluate(() => { window.pressLog.length = 0; window.armed = true; });
    const timestamp = Date.now() / 1000;
    await Promise.all(['mousePressed', 'mouseReleased'].map(type => cdp.send('Input.dispatchMouseEvent', { type, x: spot.x, y: spot.y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1, timestamp })));
    const shown = await page.waitForFunction(done, null, { timeout: 90000, polling: 50 }).then(() => true, () => false);
    if (question) await page.waitForFunction(() => window.questionAt !== null, null, { timeout: 30000, polling: 50 }).catch(() => {});
    await page.waitForTimeout(1200);
    const { log, tasks, questionAt, preview } = await page.evaluate(() => { window.armed = false; return { log: window.pressLog, tasks: window.longTasks, questionAt: window.questionAt, preview: document.querySelector('#plan-change:not([hidden]) h4 + p')?.textContent ?? null }; });
    const down = log.find(row => row.type === 'down'), click = log.find(row => row.type === 'click');
    return { label, shown, button: spot.text, inputDelayMs: round(down?.start - down?.at), toFrameMs: round(click?.frame - down?.at),
      longTasksAfterPressMs: tasks.filter(task => down && task.start + task.duration > down.at).map(task => round(task.duration)),
      ...(question ? { questionMs: round(questionAt - down?.at), refineButtons: await page.locator('#result-evidence [data-refine]').count() } : { preview }) };
  };
  const cancel = async ({ page }) => { await page.locator('#plan-change [data-action="cancel-change"]').first().click(); await page.waitForTimeout(400); };
  const waitQuestion = ({ page }) => page.waitForFunction(() => document.querySelectorAll('#result-evidence [data-refine]').length > 0, null, { timeout: 30000 }).catch(() => {});
  // 일정에 없는 첫 장소의 상세를 연다(넣기 단추가 있는 곳).
  const openAddable = async ({ page }) => {
    const ids = await page.evaluate(() => { const inPlan = new Set([...document.querySelectorAll('#timeline .story')].map(card => card.id.replace('stop-', ''))); return [...document.querySelectorAll('#place-grid .place-title[data-place]')].map(button => button.dataset.place).filter(id => !inPlan.has(id)); });
    for (const id of ids) {
      await page.locator(`#place-grid .place-title[data-place="${id}"]`).click(); await page.waitForSelector('#place-dialog[open]');
      if (await page.locator('#place-dialog [data-include]').count()) return id;
      await page.locator('#place-dialog .dialog-close').click();
    }
    return null;
  };
  const run = async (version, rate, round) => {
    const base = { version, rate, round };
    // ① 하루를 만든 뒤 차례로 누른다.
    {
      const session = await open(version), { page, cdp } = session;
      try {
        await page.locator('#conditions-panel > summary').click();
        await page.locator('#trip-date').fill('2026-10-21'); await page.locator('#trip-date').dispatchEvent('change');
        await page.locator('#start-time').fill('10:00'); await page.locator('#start-time').dispatchEvent('change');
        for (const id of ['food', 'palace', 'tea']) await page.locator(`[data-intent="${id}"]`).click();
        await page.locator('#step-intent .button[data-step="2"]').click(); await page.waitForTimeout(300);
        await page.locator('.time-chips [data-hours="8"]').click(); await page.waitForTimeout(300);
        await page.locator('#make-day').click(); await page.waitForSelector('#result:not([hidden])', { timeout: 30000 });
        await waitQuestion(session); await page.waitForTimeout(500);
        const day = await page.evaluate(() => ({ title: document.querySelector('#result-title')?.textContent, stops: [...document.querySelectorAll('#timeline .story h3')].map(h => h.textContent) }));
        if (rate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate });
        const rows = [];
        rows.push(await press(session, '#quick-actions [data-adjust="less-walk"]', previewShown, '빠른 변경(덜 걷기)'));
        rows.push(await press(session, '#plan-change [data-action="accept-change"]', resultShown, '받아들이기(빠른 변경)', { question: true }));
        await waitQuestion(session); await page.waitForTimeout(400);
        rows.push(await press(session, '#result-evidence [data-refine]', previewShown, '답하기')); await cancel(session);
        await page.locator('#timeline [data-swap]').first().click(); await page.waitForSelector('#swap-dialog[open]');
        rows.push(await press(session, '#swap-dialog [data-replace-from]', previewShown, '바꾸기')); await cancel(session);
        const added = await openAddable(session);
        rows.push({ ...(await press(session, '#place-dialog [data-include]', previewShown, '장소 넣기(일정 있음)')), place: added }); await cancel(session);
        await page.locator('[data-action="open-progress"]').first().click(); await page.waitForSelector('#progress-dialog[open]');
        const first = await page.evaluate(() => { const card = document.querySelector('#timeline .story'); return { id: card.id.replace('stop-', ''), leave: card.querySelector('.story-time').textContent.split('–')[1].trim() }; });
        await page.locator(`[data-progress-place="${first.id}"]`).selectOption('completed');
        await page.locator('#progress-time').fill(first.leave); await page.locator('#progress-budget').fill('40000');
        rows.push({ ...(await press(session, '#progress-form button[type=submit]', previewShown, '남은 일정 비교')), completed: first });
        rows.push(await press(session, '#plan-change [data-action="accept-change"]', resultShown, '받아들이기(남은 일정)', { question: true }));
        for (const row of rows) report.rows.push({ ...base, ...row, day: day.title });
        report.rows.push({ ...base, label: '페이지', day, clock: session.clock, errors: session.errors, warnings: session.warnings });
      } catch (error) { report.rows.push({ ...base, label: '페이지 오류', error: String(error?.message ?? error), clock: session.clock, errors: session.errors }); }
      await session.ctx.close();
    }
    // ② 일정이 없을 때 장소 넣기는 하루 만들기처럼 바로 받아들인다.
    {
      const session = await open(version), { page, cdp } = session;
      try {
        if (rate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate });
        const added = await openAddable(session);
        report.rows.push({ ...base, ...(await press(session, '#place-dialog [data-include]', resultShown, '장소 넣기(일정 없음)', { question: true })), place: added, errors: session.errors, warnings: session.warnings });
      } catch (error) { report.rows.push({ ...base, label: '장소 넣기(일정 없음) 오류', error: String(error?.message ?? error), errors: session.errors }); }
      await session.ctx.close();
    }
  };
  for (let index = 1; index <= rounds; index++) for (const rate of rates) for (const version of ['before', 'after']) await run(version, rate, index);
  fs.writeFileSync(path.join(out, 'timing.json'), JSON.stringify(report, null, 1));
  // 요약: 칸마다 회차별 다음 프레임까지(ms) · 누른 뒤 가장 긴 일(ms) · 받아들이기는 질문까지(ms).
  const summary = {};
  for (const row of report.rows.filter(row => row.toFrameMs !== undefined)) {
    const key = `${row.label} · ${row.rate === 1 ? 'PC' : 'CPU 4배 느림'}`;
    (summary[key] ??= { before: [], after: [] })[row.version].push([row.toFrameMs, Math.max(0, ...row.longTasksAfterPressMs ?? []), row.questionMs ?? undefined].filter(value => value !== undefined).join('/'));
  }
  console.log(JSON.stringify(summary, null, 1));
  await browser.close();
})();
