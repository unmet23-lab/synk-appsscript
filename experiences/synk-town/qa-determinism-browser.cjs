// 결정성 — Node와 헤드리스 크롬에서 마을 엔진이 같은 결과를 낸다(세로 조각 설계 §15-3, W11).
// 마을 씨앗 셋 × 시간대 둘(서울 · 뉴욕)의 30생활일을 결산 길(town/village.mjs closeBands)로 닫고, 구간마다 계획의 조각 · 선 카드 · 풀린 카드를
// 모아 정규 JSON의 SHA-256을 잰다. 크롬은 저장소 파일을 가짜 출처(http://town.test/)로 받아 같은 모듈을 import한다 — 브라우저 시간대는
// America/Los_Angeles로 두어 기기 시계·지역 시간에 기대지 않음도 함께 본다. CI 밖 확인이다(크롬 채널 Playwright가 있는 PC).
//   node experiences/synk-town/qa-determinism-browser.cjs [<playwright 모듈 경로>]
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const ROOT = path.resolve(__dirname, '..', '..');
const PLAYWRIGHT = process.argv[2] || 'C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';

// The same function runs in both: it takes the village module and returns the canonical JSON of what the bands planned.
const RUN = `async (village) => {
  const DAY = 86400000, start = Date.UTC(2026, 9, 23, 3), out = [];
  const canonical = value => JSON.stringify(value, (k, v) => v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : v);
  for (const seed of ['sim-v001', 'sim-v002', 'sim-v003']) for (const offsetMin of [540, -300]) {
    const v = village.initialVillage();
    village.closeBands(v, { nowMs: start, seed, offsetMin, revision: 0 });
    for (let t = start; t <= start + 30 * DAY; t += 6 * 3600000) {
      village.closeBands(v, { nowMs: t, seed, offsetMin, revision: 0 });
      const plan = village.planOf(v);
      out.push({ seed, offsetMin, band: v.band.band, lifeDay: v.band.lifeDay,
        segments: plan.segments.map(s => [s.npc, s.archetype, s.spot, s.startMs, s.endMs, s.card ?? null, s.mood ?? null]),
        rose: plan.log.map(e => [e.card, e.key, e.atMs]), resolved: plan.resolved.map(r => [r.card, r.path, r.atMs]) });
    }
  }
  return canonical(out);
}`;

(async () => {
  const village = await import(pathToFileURL(path.join(ROOT, 'experiences', 'synk-town', 'town', 'village.mjs')).href);
  const nodeJson = await eval(RUN)(village), nodeHash = crypto.createHash('sha256').update(nodeJson).digest('hex');
  const { chromium } = require(PLAYWRIGHT);
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ timezoneId: 'America/Los_Angeles', locale: 'en-US' });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e.message || e)));
  await page.route('http://town.test/**', route => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/+/, '');
    if (rel === 'blank.html') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><title>town</title>' });
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
    const type = file.endsWith('.mjs') || file.endsWith('.js') ? 'text/javascript' : file.endsWith('.json') ? 'application/json' : 'text/html';
    return route.fulfill({ status: 200, contentType: type, body: fs.readFileSync(file) });
  });
  await page.goto('http://town.test/blank.html');
  const browserJson = await page.evaluate(async run => {
    const village = await import('/experiences/synk-town/town/village.mjs');
    return (0, eval)(run)(village);
  }, RUN);
  const browserHash = crypto.createHash('sha256').update(browserJson).digest('hex');
  await browser.close();
  const report = { node: nodeHash, browser: browserHash, same: nodeHash === browserHash, bands: JSON.parse(nodeJson).length, bytes: nodeJson.length,
    browserTimezone: 'America/Los_Angeles', nodeTZ: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone, pageErrors: errors };
  console.log(JSON.stringify(report));
  process.exit(report.same && !errors.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
