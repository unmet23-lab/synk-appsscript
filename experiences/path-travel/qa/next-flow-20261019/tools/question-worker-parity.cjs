// 확인 질문 워커(10-19 밤) 확인. 실제 크롬에서
// ① 모듈 워커(question-worker.mjs)가 낸 질문·일정 id가 같은 페이지 메인에서 같은 조건으로 계산한 것과 같은지 여러 조건으로 대조하고,
// ② 워커를 못 쓰는 세 경우(워커 파일 404 · 워커 안에서 지도 읽기 실패 · CSP worker-src 'none')에도 화면이 예전처럼 직접 계산해 질문을 붙이는지 본다.
// 사용: node question-worker-parity.cjs <url> <출력폴더>  — 결과는 <출력폴더>/parity.json
// 공개 뒤 공개 주소로도 돌린다: 워커가 빠졌으면 ①이 오류로 나오고 「워커 정상」에 경고가 남는다(CSP 장면은 헤더가 없어 건너뜀).
const path = require('path');
const fs = require('fs');
const { chromium } = require(require.resolve('playwright', { paths: [path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const [url, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const now = '2026-10-19T03:00:00.000Z', origin = { id: 'anguk', name: '안국역', lat: 37.5765, lon: 126.9854 };
const INTENTS = { food: { prefs: { food: true }, check: { category: 'food' } }, tea: { prefs: { tea: true }, check: { category: 'tea' } }, art: { prefs: { art: true }, check: { feature: 'art' } }, palace: { prefs: { history: true, walk: true }, check: { feature: 'palace' } }, alley: { prefs: { walk: true, outdoor: true }, check: { feature: 'hanok', category: 'culture' } }, market: { prefs: { marketFood: true }, check: { feature: 'market' } } };
const HOURS = { 2: [2, 50], 3: [3, 70], 5: [4, 100], 8: [5, 150] };
const clock = v => String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0');
const feedback = [
  { id: 'feedback-indoor', key: 'indoor', value: true, status: 'confirmed', source: { kind: 'user-confirmation' }, confirmedAt: '2026-10-18T09:00:00.000Z', importance: 4 },
  { id: 'feedback-coffee', key: 'coffee', value: false, status: 'confirmed', source: { kind: 'user-confirmation' }, confirmedAt: '2026-10-18T09:05:00.000Z' },
];
// 첫 화면 고르기와 같은 모양(고른 것 → 취향·장소 표시, 시간 → 곳 수·걷기 상한, 맛집이나 점심을 걸친 반나절 이상이면 식사 필수).
const scenarios = [];
const picksList = [[], ['food'], ['tea'], ['art'], ['palace'], ['alley'], ['market'], ['tea', 'art'], ['food', 'palace', 'tea'], ['alley', 'tea'], ['food', 'market'], ['art', 'alley', 'market']];
const slots = [[2, 600], [2, 900], [3, 600], [3, 840], [5, 600], [5, 780], [8, 600]];
for (const picks of picksList) for (const [hours, start] of slots) {
  const [stopCount, maxWalkMinutes] = HOURS[hours], index = scenarios.length;
  const requiredCategories = picks.includes('food') || (hours >= 5 && start <= 720 && start + hours * 60 >= 810) ? ['food'] : [];
  scenarios.push({ label: `${picks.join('+') || '-'} ${hours}h ${clock(start)}`, routed: true, feedback: [], intents: picks.map(id => ({ id, ...INTENTS[id].check })),
    raw: { date: index % 2 ? '2026-10-24' : '2026-10-20', startTime: clock(start), endTime: clock(start + hours * 60), origin, party: { adults: 1, children: 0 }, budget: 60000, maxWalkMinutes, stopCount,
      preferences: Object.assign({}, ...picks.map(id => INTENTS[id].prefs)), requiredFeatures: {}, requiredCategories, lockedIds: [], excludedIds: [] } });
}
// 같은 하루에 화면 밖 조건을 하나씩 섞는다: 확인한 평소 취향·동행·유지·제외·식사 시간대·아이와 예산·지도 없이.
for (const base of scenarios.filter((_, i) => i % 7 === 6 || i % 7 === 3).slice(0, 8)) {
  const variant = (label, change) => { const next = structuredClone(base); next.label += ' · ' + label; change(next); scenarios.push(next); };
  variant('평소 취향', s => { s.feedback = feedback; });
  variant('동행', s => { s.raw.party = { adults: 2, children: 0 }; s.raw.companions = [{ id: 'person-1', label: '동행 1', preferences: { art: true, quiet: true }, requiredFeatures: {} }]; });
  variant('북촌 유지', s => { s.raw.lockedIds = ['bukchon-hanok']; });
  variant('경복궁 제외', s => { s.raw.excludedIds = ['gyeongbokgung']; });
  variant('아이·예산', s => { s.raw.party = { adults: 2, children: 1 }; s.raw.budget = 90000; });
  variant('지도 없이', s => { s.routed = false; });
}
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = { url, now, parity: null, fallbacks: {} };
  // ① 대조
  {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      const at = file => new URL(file, location.href).href;
      const [{ planTravel, normalizePlannerInput }, { TRAVEL_PLACES }, { createWalkingRouter }] = await Promise.all([import(at('./planner.mjs')), import(at('./places-v2.mjs')), import(at('./walking-router.mjs'))]);
      const map = await (await fetch(at('./assets/jongno-walking.json'))).json(), routeLeg = createWalkingRouter(map);
      const worker = new Worker(at('./question-worker.mjs'), { type: 'module' }), waiting = new Map();
      worker.addEventListener('message', ({ data }) => { waiting.get(data.token)?.(data); waiting.delete(data.token); });
      worker.addEventListener('error', event => { for (const resolve of waiting.values()) resolve({ error: 'worker error ' + (event.message ?? '') }); waiting.clear(); });
      let token = 0;
      window.parity = { map, run: async (scenario, now) => {
        const input = normalizePlannerInput(scenario.raw, { places: TRAVEL_PLACES }), id = ++token;
        // 워커에 먼저 보내고 메인이 계산하는 동안 워커도 계산한다(화면의 planThenAsk와 같은 메시지).
        const reply = new Promise(resolve => waiting.set(id, resolve));
        const started = performance.now();
        worker.postMessage({ token: id, input, now, feedback: scenario.feedback, intents: scenario.intents, routed: scenario.routed, mapStamp: map.sourceTimestamp ?? null });
        const main = planTravel(input, { now, feedback: scenario.feedback, intents: scenario.intents, routeLeg: scenario.routed ? routeLeg : null });
        const mainMs = performance.now() - started, answer = await reply, bothMs = performance.now() - started;
        return { label: scenario.label, plan: Boolean(main.primary), about: main.question?.about ?? null, error: answer.error ?? null,
          samePlan: answer.primaryId === (main.primary?.id ?? null), sameQuestion: JSON.stringify(answer.question) === JSON.stringify(main.question), mainMs: Math.round(mainMs), bothMs: Math.round(bothMs) };
      } };
    });
    const rows = [];
    for (const scenario of scenarios) rows.push(await page.evaluate(([s, n]) => window.parity.run(s, n), [scenario, now]));
    const median = list => { const sorted = [...list].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)] ?? null; };
    const withPlan = rows.filter(row => row.plan);
    report.parity = { scenarios: rows.length, withPlan: withPlan.length, withQuestion: withPlan.filter(row => row.about).length,
      same: withPlan.filter(row => row.samePlan && row.sameQuestion && !row.error).length, different: withPlan.filter(row => !row.samePlan || !row.sameQuestion || row.error),
      questionKinds: Object.fromEntries([...new Set(withPlan.map(row => row.about ?? '없음'))].map(kind => [kind, withPlan.filter(row => (row.about ?? '없음') === kind).length])),
      mainMsMedian: median(withPlan.map(row => row.mainMs)), bothMsMedian: median(withPlan.map(row => row.bothMs)), errors, rows };
    await page.close();
  }
  // ② 워커를 못 쓸 때 — 첫 화면에서 하루(맛집+궁궐+차)를 만들고 질문이 붙는지 본다.
  const makeDay = async (label, prepare) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
    const page = await ctx.newPage(), errors = [], warnings = [], requests = [];
    page.on('pageerror', e => errors.push(e.message));
    // 워커를 못 쓰면 화면이 콘솔에 경고를 한 줄 남긴다(정상일 때는 없어야 한다).
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); else if (m.type() === 'warning') warnings.push(m.text()); });
    await prepare(ctx, page, requests);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !/준비하고/.test(document.querySelector('#load-status')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
    await page.locator('#conditions-panel > summary').click();
    await page.locator('#trip-date').fill('2026-10-21'); await page.locator('#trip-date').dispatchEvent('change');
    await page.locator('#start-time').fill('10:00'); await page.locator('#start-time').dispatchEvent('change');
    for (const id of ['food', 'palace', 'tea']) await page.locator(`[data-intent="${id}"]`).click();
    await page.locator('#step-intent .button[data-step="2"]').click(); await page.waitForTimeout(300);
    await page.locator('.time-chips [data-hours="8"]').click(); await page.waitForTimeout(300);
    const t0 = Date.now(); await page.locator('#make-day').click(); await page.waitForSelector('#result:not([hidden])');
    const shownMs = Date.now() - t0;
    await page.waitForFunction(() => document.querySelectorAll('#result-evidence [data-refine]').length > 0, null, { timeout: 15000 }).catch(() => {});
    report.fallbacks[label] = { shownMs, questionMs: Date.now() - t0, refineButtons: await page.locator('#result-evidence [data-refine]').count(), question: await page.locator('#result-evidence h4').first().textContent().catch(() => null), requests, warnings, errors };
    await ctx.close();
  };
  await makeDay('워커 정상', async () => {});
  await makeDay('워커 파일 404', async (ctx, page, requests) => { await page.route('**/question-worker.mjs', route => { requests.push('404 ' + route.request().url()); return route.fulfill({ status: 404, body: 'none' }); }); });
  await makeDay('워커 안 지도 실패', async (ctx, page, requests) => {
    // 화면이 먼저 지도를 받고 나서 워커를 띄우므로 두 번째 지도 요청이 워커의 것이다.
    let count = 0;
    await ctx.route('**/assets/jongno-walking.json', route => { count++; requests.push(count + ' ' + route.request().url()); return count === 1 ? route.continue() : route.fulfill({ status: 503, body: 'busy' }); });
  });
  await makeDay('CSP worker-src none', async (ctx, page, requests) => {
    await page.route(/\/(index\.html)?(\?.*)?$/, async route => {
      if (route.request().resourceType() !== 'document') return route.continue();
      const response = await route.fetch(), headers = response.headers();
      // 공개본(GitHub Pages)은 CSP를 헤더가 아니라 메타로 준다. 그때는 이 장면만 건너뛴다.
      if (!headers['content-security-policy']) { requests.push('CSP 헤더 없음 — 이 장면은 건너뜀'); return route.fulfill({ response }); }
      headers['content-security-policy'] = headers['content-security-policy'].replace("worker-src 'self'", "worker-src 'none'");
      requests.push('csp ' + headers['content-security-policy'].match(/worker-src [^;]+/)[0]);
      return route.fulfill({ response, headers });
    });
  });
  fs.writeFileSync(path.join(out, 'parity.json'), JSON.stringify(report, null, 1));
  const { rows, ...summary } = report.parity;
  console.log(JSON.stringify({ ...report, parity: summary }, null, 1));
  await browser.close();
})();
