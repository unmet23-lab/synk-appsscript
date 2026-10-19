// 날짜 확인을 기억하기 전과 뒤의 엔진 결과가 같은지, 걸린 시간은 얼마인지 비교한다(160가지 조건).
// 사용: node engine-memo-compare.mjs <전 사본 path-travel 폴더 file URL> [뒤 path-travel 폴더 file URL]
// 전 사본은 path-travel의 .mjs·assets/jongno-walking.json과 atlas/{domain,travel,ask}.js를 같은 짜임으로 복사하고
// real-conditions.mjs만 `git show HEAD:experiences/path-travel/real-conditions.mjs`로 바꿔 만든다.
import { readFileSync } from 'node:fs';
const [before, after = new URL('../../../', import.meta.url).href] = process.argv.slice(2);
if (!before) throw new Error('전 사본 폴더(file URL)를 첫 인자로 주세요.');
const roots = { before, after };
const INTENT = { food: { category: 'food' }, tea: { category: 'tea' }, art: { feature: 'art' }, palace: { feature: 'palace' }, alley: { feature: 'hanok', category: 'culture' }, market: { feature: 'market' } };
const PREF = { food: { food: true }, tea: { tea: true }, art: { art: true }, palace: { history: true, walk: true }, alley: { walk: true, outdoor: true }, market: { marketFood: true } };
const HOURS = { 2: [2, 50], 3: [3, 70], 5: [4, 100], 8: [5, 150] };
const origin = { id: 'anguk', name: '안국역', lat: 37.5765, lon: 126.9854 };
const now = '2026-10-19T03:00:00.000Z';
const combos = [[], ['food'], ['tea'], ['art'], ['palace'], ['alley'], ['market'], ['food', 'tea'], ['tea', 'art'], ['food', 'palace', 'tea']];
const dates = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-24'];
const clock = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const cases = [];
for (const date of dates) for (const picks of combos) for (const [h, [stops, walk]] of Object.entries(HOURS)) {
  cases.push({ label: `${date} ${picks.join('+') || '-'} ${h}h`, ask: picks.length === 2 && date === '2026-10-21',
    input: { date, startTime: clock(600), endTime: clock(600 + Number(h) * 60), origin, party: { adults: 1, children: 0 }, budget: 60000, stopCount: stops, maxWalkMinutes: walk,
      requiredCategories: picks.includes('food') || Number(h) >= 5 ? ['food'] : [], preferences: Object.assign({}, ...picks.map(id => PREF[id])) },
    intents: picks.map(id => ({ id, ...INTENT[id] })) });
}
const shape = result => JSON.stringify({ status: result.status, primary: result.primary && { stops: result.primary.stops.map(s => [s.placeId, s.arrivalTime, s.departureTime, s.stayMinutes, s.reasons]), end: result.primary.endTime, walk: result.primary.walking, checks: result.primary.checks.map(c => [c.kind, c.status]) },
  alternatives: result.alternatives.map(p => [p.label, p.stops.map(s => [s.placeId, s.arrivalTime])]), question: result.question && { about: result.question.about, options: result.question.options.map(o => o.preview) },
  blocked: result.blocked.map(b => b.reason).sort(), unknowns: result.unknowns.map(b => b.reason).sort() });
const out = {};
for (const [name, root] of Object.entries(roots)) {
  const { planTravel } = await import(root + 'planner.mjs');
  const { createWalkingRouter } = await import(root + 'walking-router.mjs');
  const routeLeg = createWalkingRouter(JSON.parse(readFileSync(new URL(root + 'assets/jongno-walking.json'), 'utf8')));
  const started = performance.now(); let askMs = 0, plainMs = 0;
  out[name] = cases.map(c => { const t = performance.now(); const r = planTravel(c.input, { now, routeLeg, ask: c.ask, intents: c.intents }); const ms = performance.now() - t; if (c.ask) askMs += ms; else plainMs += ms; return shape(r); });
  const asked = cases.filter(c => c.ask).length;
  console.log(name, `전체 ${Math.round(performance.now() - started)}ms · 질문 없음 평균 ${Math.round(plainMs / (cases.length - asked))}ms · 질문 포함 평균 ${Math.round(askMs / asked)}ms`);
}
const diff = cases.filter((c, i) => out.before[i] !== out.after[i]);
console.log(`사례 ${cases.length}개 · 결과가 다른 사례 ${diff.length}개`);
for (const c of diff.slice(0, 5)) console.log(' 다름:', c.label);
