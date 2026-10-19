// 바꾸기 전 비교(빠른 변경·답하기·장소 넣기·바꾸기·남은 일정)의 확인 질문을 받아들인 뒤 워커로 붙여도 예전(누를 때 메인에서 계산)과 같은지 본다(10-19 밤).
// ① 엔진·워커: 실제 크롬에서 같은 페이지 메인이 누를 때처럼 질문까지 계산한 것(ask 기본값)과, 질문 없이 계산한 미리보기에 적은 조건
//    (같은 시각·평소 취향·엔진이 실제로 쓴 고른 것·지도를 썼는지)으로 모듈 워커가 다시 계산한 질문·일정 id를 대조한다.
//    미리보기 일정(ask:false)이 누를 때 일정과 같은지도 같이 본다.
// ② 화면 흐름: 고치기 전 판(page.route로 planner-ui.mjs만 바꿔 끼움)과 지금 판에서 같은 순서로 미리보기를 받아들이고, 붙은 질문 칸(HTML)과 일정을 대조한다.
// ③ 받아들인 뒤 워커를 못 쓰면(워커 파일 404) 화면이 직접 계산해 질문을 붙이고 콘솔에 경고를 한 줄 남기는지 본다.
// ④ 다른 안을 받아들인 뒤 질문 카드의 도보 차이가 지금 보이는 일정 기준인지 본다(전 판은 원래 일정 기준이었다).
// 사용: node preview-question-parity.cjs <url> <출력폴더> --before <고치기 전 planner-ui.mjs> [--parts engine,screen,fallback,alternative]  — 결과는 <출력폴더>/preview-parity.json
const path = require('path');
const fs = require('fs');
const { chromium } = require(require.resolve('playwright', { paths: [path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const argv = process.argv.slice(2), [url, out] = argv, beforeAt = argv.indexOf('--before'), beforeSource = fs.readFileSync(argv[beforeAt + 1], 'utf8');
const partsAt = argv.indexOf('--parts'), parts = new Set((partsAt < 0 ? 'engine,screen,fallback,alternative' : argv[partsAt + 1]).split(','));
fs.mkdirSync(out, { recursive: true });
const now = '2026-10-19T03:00:00.000Z', origin = { id: 'anguk', name: '안국역', lat: 37.5765, lon: 126.9854 };
// 화면(planner-ui.mjs)의 고른 것 표와 같다.
const INTENTS = { food: { prefs: { food: true }, check: { category: 'food' } }, tea: { prefs: { tea: true }, check: { category: 'tea' } }, art: { prefs: { art: true }, check: { feature: 'art' } }, palace: { prefs: { history: true, walk: true }, check: { feature: 'palace' } }, alley: { prefs: { walk: true, outdoor: true }, check: { feature: 'hanok', category: 'culture' } }, market: { prefs: { marketFood: true }, check: { feature: 'market' } } };
const HOURS = { 2: [2, 50], 3: [3, 70], 5: [4, 100], 8: [5, 150] };
const clock = v => String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0');
const feedback = [
  { id: 'feedback-indoor', key: 'indoor', value: true, status: 'confirmed', source: { kind: 'user-confirmation' }, confirmedAt: '2026-10-18T09:00:00.000Z', importance: 4 },
  { id: 'feedback-coffee', key: 'coffee', value: false, status: 'confirmed', source: { kind: 'user-confirmation' }, confirmedAt: '2026-10-18T09:05:00.000Z' },
];
const bases = [];
const picksList = [[], ['food'], ['tea'], ['art'], ['palace'], ['alley', 'tea'], ['tea', 'art'], ['food', 'palace', 'tea'], ['food', 'market']];
const slots = [[3, 600], [5, 780], [8, 600]];
for (const picks of picksList) for (const [hours, start] of slots) {
  const [stopCount, maxWalkMinutes] = HOURS[hours], index = bases.length;
  const requiredCategories = picks.includes('food') || (hours >= 5 && start <= 720 && start + hours * 60 >= 810) ? ['food'] : [];
  bases.push({ label: `${picks.join('+') || '-'} ${hours}h ${clock(start)}`, routed: true, feedback: [],
    raw: { date: index % 2 ? '2026-10-24' : '2026-10-21', startTime: clock(start), endTime: clock(start + hours * 60), origin, party: { adults: 1, children: 0 }, budget: 60000, maxWalkMinutes, stopCount,
      preferences: Object.assign({}, ...picks.map(id => INTENTS[id].prefs)), requiredFeatures: {}, requiredCategories, lockedIds: [], excludedIds: [] } });
}
// 화면 밖 조건을 섞은 하루: 확인한 평소 취향·동행·지도 없이.
for (const base of bases.filter((_, i) => i % 3 === 2).slice(0, 4)) {
  bases.push({ ...structuredClone(base), label: base.label + ' · 평소 취향', feedback });
  const companion = structuredClone(base); companion.label += ' · 동행'; companion.raw.party = { adults: 2, children: 0 }; companion.raw.companions = [{ id: 'person-1', label: '동행 1', preferences: { art: true, quiet: true }, requiredFeatures: {} }]; bases.push(companion);
  bases.push({ ...structuredClone(base), label: base.label + ' · 지도 없이', routed: false });
}
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = { url, now, engine: null, screen: null, fallback: null };
  // ① 엔진·워커 대조
  if (parts.has('engine')) {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(async ([INTENTS, now]) => {
      const at = file => new URL(file, location.href).href;
      const [{ planTravel, replanTravel, replanRemainingTravel }, { TRAVEL_PLACES }, { createWalkingRouter }] = await Promise.all([import(at('./planner.mjs')), import(at('./places-v2.mjs')), import(at('./walking-router.mjs'))]);
      const map = await (await fetch(at('./assets/jongno-walking.json'))).json(), router = createWalkingRouter(map);
      const worker = new Worker(at('./question-worker.mjs'), { type: 'module' }), waiting = new Map();
      worker.addEventListener('message', ({ data }) => { waiting.get(data.token)?.(data); waiting.delete(data.token); });
      worker.addEventListener('error', event => { for (const resolve of waiting.values()) resolve({ error: 'worker error ' + (event.message ?? '') }); waiting.clear(); });
      let token = 0;
      const dayIntents = q => Object.keys(INTENTS).filter(id => Object.entries(INTENTS[id].prefs).every(([key, value]) => q.preferences?.[key] === value));
      const intentSpecs = q => dayIntents(q).map(id => ({ id, ...INTENTS[id].check }));
      const place = id => TRAVEL_PLACES.find(row => row.id === id);
      // 하나의 미리보기: before = 누를 때처럼 질문까지, quiet = 질문 없이, 워커 = quiet에 적은 조건으로 다시.
      const compare = async (label, call, base) => {
        const options = { now, feedback: base.feedback, intents: base.intents, routeLeg: base.routed ? router : null };
        const started = performance.now(), before = call({ ...options }), beforeMs = performance.now() - started;
        const quietStart = performance.now(), quiet = call({ ...options, ask: false }), quietMs = performance.now() - quietStart;
        if (!before.primary) return { label, plan: false, samePreview: !quiet.primary };
        const ask = intents => { const id = ++token, reply = new Promise(resolve => waiting.set(id, resolve));
          worker.postMessage({ token: id, input: quiet.input, now, feedback: options.feedback, intents, routed: base.routed, mapStamp: map.sourceTimestamp ?? null }); return reply; };
        const used = options.intents.filter(rule => quiet.engineAudit.intents.includes(rule.id)), workerStart = performance.now();
        const answer = await ask(used), workerMs = performance.now() - workerStart, filtered = used.length !== options.intents.length;
        // 남은 일정에서 엔진이 뺀 고른 것까지 그대로 넘기면 어떻게 되는지(화면이 거르는 까닭).
        const raw = filtered ? await ask(options.intents) : null;
        return { label, plan: true, about: before.question?.about ?? null, filtered, error: answer.error ?? null,
          unfiltered: raw && { samePlan: raw.primaryId === before.primary.id, sameQuestion: JSON.stringify(raw.question) === JSON.stringify(before.question) },
          samePreview: JSON.stringify(quiet.primary) === JSON.stringify(before.primary) && JSON.stringify(quiet.alternatives) === JSON.stringify(before.alternatives),
          samePlan: answer.primaryId === before.primary.id, sameQuestion: JSON.stringify(answer.question) === JSON.stringify(before.question),
          beforeMs: Math.round(beforeMs), quietMs: Math.round(quietMs), workerMs: Math.round(workerMs) };
      };
      window.parity = async spec => {
        const settings = q => ({ feedback: spec.feedback, routed: spec.routed, intents: intentSpecs(q) });
        const first = planTravel(structuredClone(spec.raw), { now, feedback: spec.feedback, intents: intentSpecs(spec.raw), routeLeg: spec.routed ? router : null });
        if (!first.primary) return [{ label: spec.label + ' · 하루', plan: false }];
        const query = first.input, rows = [], stops = first.primary.stops.map(stop => stop.placeId);
        // 빠른 변경(adjust와 같은 고침)
        for (const kind of ['less-walk', 'less-cost', 'indoors', 'later']) {
          const input = structuredClone(query);
          if (kind === 'less-walk') { input.maxWalkMinutes = Math.max(5, Math.floor(input.maxWalkMinutes * .7)); if (input.preferences.walk !== true) input.preferences.walk = false; }
          if (kind === 'less-cost') input.budget = Math.floor(input.budget * .75 / 1000) * 1000;
          if (kind === 'indoors') { input.preferences.indoor = true; input.preferences.outdoor = false; }
          if (kind === 'later') { const t = Number(input.startTime.slice(0, 2)) * 60 + Number(input.startTime.slice(3)) + 30; input.startTime = String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); }
          rows.push(await compare(`${spec.label} · 빠른 변경 ${kind}`, o => planTravel(structuredClone(input), o), settings(input)));
        }
        // 답하기(하루의 질문 두 답)
        for (const option of first.question?.options ?? []) {
          const input = structuredClone(query); input.preferences[first.question.about] = option.value;
          rows.push(await compare(`${spec.label} · 답하기 ${first.question.about}=${option.value}`, o => planTravel(structuredClone(input), o), settings(input)));
        }
        // 장소 넣기(일정에 없는 곳 하나, 하루마다 분야를 바꿔 가며)
        const kinds = ['tea', 'culture', 'food'], wanted = kinds[spec.label.length % kinds.length];
        const extra = TRAVEL_PLACES.find(row => row.dayPlannerEligible !== false && row.category === wanted && !stops.includes(row.id));
        if (extra) { const input = structuredClone(query); input.lockedIds = [...new Set([...input.lockedIds, extra.id])]; input.excludedIds = input.excludedIds.filter(x => x !== extra.id);
          rows.push(await compare(`${spec.label} · 장소 넣기 ${extra.id}`, o => planTravel(structuredClone(input), o), settings(input))); }
        // 바꾸기(첫 곳 → 같은 분야 다른 곳)
        const swap = TRAVEL_PLACES.find(row => row.category === place(stops[0]).category && !stops.includes(row.id) && row.dayPlannerEligible !== false);
        if (swap) rows.push(await compare(`${spec.label} · 바꾸기 ${stops[0]}→${swap.id}`, o => replanTravel(structuredClone(query), { ...o, replace: { fromId: stops[0], toId: swap.id } }), settings(query)));
        // 남은 일정(첫 곳을 다녀옴, 그곳에서 다시 출발)
        const done = first.primary.stops[0], spot = place(done.placeId);
        if (done.departureTime < query.endTime) rows.push(await compare(`${spec.label} · 남은 일정`, o => replanRemainingTravel(structuredClone(query), { ...o, completedIds: [done.placeId], skippedIds: [], currentTime: done.departureTime,
          origin: { id: 'place:' + spot.id, key: 'place:' + spot.id, name: spot.name, lat: spot.coordinates.lat, lon: spot.coordinates.lon }, remainingBudget: 40000, maxWalkMinutes: query.maxWalkMinutes, stopCount: Math.max(1, stops.length - 1) }), settings(query)));
        return rows;
      };
    }, [INTENTS, now]);
    const rows = [];
    for (const base of bases) rows.push(...await page.evaluate(spec => window.parity(spec), base));
    const median = list => { const sorted = [...list].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)] ?? null; };
    const withPlan = rows.filter(row => row.plan), kind = row => row.label.split(' · ').at(-1).match(/^(빠른 변경|답하기|장소 넣기|바꾸기|남은 일정)/)?.[1];
    const unfiltered = withPlan.filter(row => row.unfiltered);
    report.engine = { bases: bases.length, previews: rows.length, withPlan: withPlan.length, withQuestion: withPlan.filter(row => row.about).length, filtered: unfiltered.length,
      unfilteredWrong: unfiltered.filter(row => !row.unfiltered.samePlan || !row.unfiltered.sameQuestion).length, unfilteredSamePlanWrongQuestion: unfiltered.filter(row => row.unfiltered.samePlan && !row.unfiltered.sameQuestion).length,
      same: withPlan.filter(row => row.samePreview && row.samePlan && row.sameQuestion && !row.error).length, different: withPlan.filter(row => !row.samePreview || !row.samePlan || !row.sameQuestion || row.error),
      byPath: Object.fromEntries(['빠른 변경', '답하기', '장소 넣기', '바꾸기', '남은 일정'].map(name => [name, withPlan.filter(row => kind(row) === name).length])),
      ms: { beforeMedian: median(withPlan.map(row => row.beforeMs)), quietMedian: median(withPlan.map(row => row.quietMs)), workerMedian: median(withPlan.map(row => row.workerMs)) }, errors, rows };
    await page.close();
  }
  // ② 화면 흐름 대조. Date만 서울 10-21(수) 09:30으로 당겨 여행 중 조정까지 연다(그날 10:00–18:00 맛집+궁궐+차).
  const TODAY = Date.parse('2026-10-21T00:30:00Z');
  const shiftDate = target => { const Real = Date, offset = target - Real.now(); class Shifted extends Real { constructor(...values) { if (values.length) super(...values); else super(Real.now() + offset); } static now() { return Real.now() + offset; } } globalThis.Date = Shifted; };
  const open = async (version, prepare) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1600 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' });
    await ctx.addInitScript(shiftDate, TODAY);
    const page = await ctx.newPage(), errors = [], warnings = [], requests = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); else if (m.type() === 'warning') warnings.push(m.text()); });
    if (version === 'before') await page.route('**/planner-ui.mjs', route => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: beforeSource }));
    await prepare?.(page, requests);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !/준비하고/.test(document.querySelector('#load-status')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
    return { ctx, page, errors, warnings, requests };
  };
  const makeDay = async page => {
    await page.locator('#conditions-panel > summary').click();
    await page.locator('#trip-date').fill('2026-10-21'); await page.locator('#trip-date').dispatchEvent('change');
    await page.locator('#start-time').fill('10:00'); await page.locator('#start-time').dispatchEvent('change');
    for (const id of ['food', 'palace', 'tea']) await page.locator(`[data-intent="${id}"]`).click();
    await page.locator('#step-intent .button[data-step="2"]').click(); await page.waitForTimeout(300);
    await page.locator('.time-chips [data-hours="8"]').click(); await page.waitForTimeout(300);
    await page.locator('#make-day').click(); await page.waitForSelector('#result:not([hidden])', { timeout: 30000 });
  };
  // 받아들인 뒤 질문 칸이 가라앉기를 기다려(워커 질문은 몇 초 안에 붙는다) 칸과 일정을 읽는다.
  const settle = async page => {
    await page.waitForFunction(() => document.querySelector('#plan-change').hidden && !document.querySelector('#result').hidden, null, { timeout: 30000 });
    await page.waitForFunction(() => document.querySelectorAll('#result-evidence [data-refine]').length > 0, null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(600);
    return page.evaluate(() => ({ question: document.querySelector('#result-evidence .refinement')?.outerHTML ?? null, stops: [...document.querySelectorAll('#timeline .story h3')].map(h => h.textContent).join(' → ') }));
  };
  const accept = async page => { await page.waitForSelector('#plan-change:not([hidden]) [data-action="accept-change"]', { timeout: 30000 }); await page.locator('#plan-change [data-action="accept-change"]').click(); return settle(page); };
  const flow = async version => {
    const steps = {}, session = await open(version), { page } = session;
    try {
      await makeDay(page); steps['하루'] = await settle(page).catch(() => null);
      await page.locator('#quick-actions [data-adjust="less-walk"]').click(); steps['빠른 변경'] = await accept(page);
      await page.locator('#result-evidence [data-refine]').first().click(); steps['답하기'] = await accept(page);
      await page.locator('#timeline [data-swap]').first().click(); await page.waitForSelector('#swap-dialog[open]');
      await page.locator('#swap-dialog [data-replace-from]').first().click(); steps['바꾸기'] = await accept(page);
      const ids = await page.evaluate(() => { const inPlan = new Set([...document.querySelectorAll('#timeline .story')].map(card => card.id.replace('stop-', ''))); return [...document.querySelectorAll('#place-grid .place-title[data-place]')].map(b => b.dataset.place).filter(id => !inPlan.has(id)); });
      for (const id of ids) { await page.locator(`#place-grid .place-title[data-place="${id}"]`).click(); await page.waitForSelector('#place-dialog[open]'); if (await page.locator('#place-dialog [data-include]').count()) break; await page.locator('#place-dialog .dialog-close').click(); }
      await page.locator('#place-dialog [data-include]').click(); steps['장소 넣기'] = await accept(page);
      await page.locator('[data-action="open-progress"]').first().click(); await page.waitForSelector('#progress-dialog[open]');
      const first = await page.evaluate(() => { const card = document.querySelector('#timeline .story'); return { id: card.id.replace('stop-', ''), leave: card.querySelector('.story-time').textContent.split('–')[1].trim() }; });
      await page.locator(`[data-progress-place="${first.id}"]`).selectOption('completed');
      await page.locator('#progress-time').fill(first.leave); await page.locator('#progress-budget').fill('40000');
      await page.locator('#progress-form button[type=submit]').click(); steps['남은 일정'] = await accept(page);
    } catch (error) { steps.error = String(error?.message ?? error); await page.screenshot({ path: path.join(out, `${version}-flow-error.png`) }).catch(() => {}); }
    steps.errors = session.errors; steps.warnings = session.warnings; await session.ctx.close();
    // 일정이 없을 때 장소 넣기(바로 받아들임)
    const fresh = await open(version);
    try {
      const ids = await fresh.page.evaluate(() => [...document.querySelectorAll('#place-grid .place-title[data-place]')].map(b => b.dataset.place));
      for (const placeId of ids) { await fresh.page.locator(`#place-grid .place-title[data-place="${placeId}"]`).click(); await fresh.page.waitForSelector('#place-dialog[open]'); if (await fresh.page.locator('#place-dialog [data-include]').count()) break; await fresh.page.locator('#place-dialog .dialog-close').click(); }
      await fresh.page.locator('#place-dialog [data-include]').click(); steps['장소 넣기(일정 없음)'] = await settle(fresh.page);
    } catch (error) { steps.freshError = String(error?.message ?? error); }
    steps.freshErrors = fresh.errors; steps.freshWarnings = fresh.warnings; await fresh.ctx.close();
    return steps;
  };
  if (parts.has('screen')) {
    const before = await flow('before'), after = await flow('after'), names = ['하루', '빠른 변경', '답하기', '바꾸기', '장소 넣기', '남은 일정', '장소 넣기(일정 없음)'];
    report.screen = { steps: Object.fromEntries(names.map(name => [name, { sameStops: before[name]?.stops === after[name]?.stops, sameQuestion: before[name]?.question === after[name]?.question, hasQuestion: Boolean(after[name]?.question), stops: after[name]?.stops,
      questionLabel: after[name]?.question?.match(/<h4>([^<]*)<\/h4>/)?.[1] ?? null }])), before: { errors: [...before.errors, ...before.freshErrors], warnings: [...before.warnings, ...before.freshWarnings], error: before.error ?? before.freshError ?? null },
      after: { errors: [...after.errors, ...after.freshErrors], warnings: [...after.warnings, ...after.freshWarnings], error: after.error ?? after.freshError ?? null } };
  }
  // ③ 받아들인 뒤 워커를 못 쓸 때(워커 파일 404): 빠른 변경을 받아들이면 화면이 직접 계산해 질문을 붙이고 경고를 한 줄 남긴다.
  if (parts.has('fallback')) {
    const session = await open('after', async (page, requests) => { await page.route('**/question-worker.mjs', route => { requests.push('404 ' + route.request().url()); return route.fulfill({ status: 404, body: 'none' }); }); });
    const { page } = session; let result = null;
    try {
      await makeDay(page); const day = await settle(page);
      await page.locator('#quick-actions [data-adjust="less-walk"]').click(); const accepted = await accept(page);
      result = { dayQuestion: Boolean(day.question), acceptedQuestion: Boolean(accepted.question), questionLabel: accepted.question?.match(/<h4>([^<]*)<\/h4>/)?.[1] ?? null };
    } catch (error) { result = { error: String(error?.message ?? error) }; }
    report.fallback = { ...result, requests: session.requests, warnings: session.warnings, errors: session.errors };
    await session.ctx.close();
  }
  // ④ 다른 안을 받아들인 뒤 질문 카드의 도보 차이가 지금 일정 기준인지(10-19 밤 고침). 질문은 원래 일정에서 계산한 그대로 따라오고,
  //    고치기 전 판은 그 원래 일정 기준 차이를 그대로 보였다. 지금 일정의 걷기 상단과 답마다의 걷기 상단으로 보여야 할 차이를 다시 잰다.
  if (parts.has('alternative')) {
    report.alternative = {};
    const walkMax = text => Number(text?.match(/(\d+)–(\d+)분/)?.[2]);
    for (const version of ['before', 'after']) {
      const session = await open(version), { page } = session;
      try {
        await makeDay(page); await settle(page);
        const day = await page.evaluate(() => [...document.querySelectorAll('#plan-overview .facts div')].find(row => row.querySelector('dt')?.textContent === '걷기')?.querySelector('dd')?.textContent);
        const label = await page.locator('#alternatives [data-alternative]').first().evaluate(button => button.closest('.alternative').querySelector('h5').textContent);
        await page.locator('#alternatives [data-alternative]').first().click(); await accept(page);
        const shown = await page.evaluate(() => ({ walk: [...document.querySelectorAll('#plan-overview .facts div')].find(row => row.querySelector('dt')?.textContent === '걷기')?.querySelector('dd')?.textContent,
          options: [...document.querySelectorAll('#result-evidence .refinement-option dd:first-of-type')].map(dd => ({ text: dd.firstChild?.textContent, delta: dd.querySelector('small')?.textContent })) }));
        const current = walkMax(shown.walk), options = shown.options.map(row => { const gap = walkMax(row.text) - current, expected = '(' + (gap === 0 ? '현재와 같음' : `${gap > 0 ? '+' : ''}${gap}분`) + ')'; return { ...row, expected, ok: row.delta === expected }; });
        report.alternative[version] = { alternative: label, dayWalkMax: walkMax(day), currentWalkMax: current, options, ok: options.length > 0 && options.every(row => row.ok), errors: session.errors, warnings: session.warnings };
      } catch (error) { report.alternative[version] = { error: String(error?.message ?? error), errors: session.errors }; }
      await session.ctx.close();
    }
  }
  fs.writeFileSync(path.join(out, 'preview-parity.json'), JSON.stringify(report, null, 1));
  const { rows, ...engine } = report.engine ?? {};
  console.log(JSON.stringify({ ...report, engine }, null, 1));
  await browser.close();
})();
