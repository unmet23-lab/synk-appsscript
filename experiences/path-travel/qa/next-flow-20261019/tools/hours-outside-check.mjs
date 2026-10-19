// 엔진 900회(고른 것 15가지 × 2·3·5·8시간 × 4날짜 × 출발 시각)에서 안내된 요일 운영 칸(입장 마감·폐장) 밖에 놓인 방문을 센다(날짜별 예외일은 뺌).
// Fable 재검수(10-19 저녁)가 쓴 셈을 옮겼다. 연장 운영(창경궁 야간개방 등)은 칸 밖으로 세지만 엔진은 「확인 필요」로 넣는다.
// 사용: node hours-outside-check.mjs
import { readFileSync } from 'node:fs';
const root = new URL('../../../', import.meta.url).href;
const { planTravel } = await import(root + 'planner.mjs');
const { createWalkingRouter } = await import(root + 'walking-router.mjs');
const routeLeg = createWalkingRouter(JSON.parse(readFileSync(new URL(root + 'assets/jongno-walking.json'), 'utf8')));
const origin = { id: 'anguk', name: '안국역', lat: 37.5765, lon: 126.9854 }, now = '2026-10-19T03:00:00.000Z';
const INTENTS = { food: { prefs: { food: true }, check: { category: 'food' } }, tea: { prefs: { tea: true }, check: { category: 'tea' } }, art: { prefs: { art: true }, check: { feature: 'art' } }, palace: { prefs: { history: true, walk: true }, check: { feature: 'palace' } }, alley: { prefs: { walk: true, outdoor: true }, check: { feature: 'hanok', category: 'culture' } }, market: { prefs: { marketFood: true }, check: { feature: 'market' } } };
const HOURS = { 1: [1, 20], 2: [2, 50], 3: [3, 70], 5: [4, 100], 8: [5, 150] };
const minute = v => Number(v.slice(0, 2)) * 60 + Number(v.slice(3)), clock = v => String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0');
const picksList = [[], ['food'], ['tea'], ['art'], ['palace'], ['alley'], ['market'], ['tea', 'art'], ['food', 'palace'], ['palace', 'tea'], ['alley', 'tea'], ['food', 'market'], ['art', 'market'], ['food', 'palace', 'tea'], ['art', 'alley', 'market']];
const dates = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-24'], starts = { 2: [600, 780, 900, 1020, 1140], 3: [600, 780, 840, 960, 1080], 5: [600, 780, 900], 8: [600, 720] };
const out = { runs: 0, stops: 0, outside: [], byPlace: {}, byStatus: {}, stretchedOutside: 0 };
for (const picks of picksList) for (const hours of [2, 3, 5, 8]) for (const date of dates) for (const start of starts[hours]) {
  const [stopCount, maxWalkMinutes] = HOURS[hours], preferences = Object.assign({}, ...picks.map(id => INTENTS[id].prefs));
  const requiredCategories = picks.includes('food') || (hours >= 5 && start <= 720 && start + hours * 60 >= 810) ? ['food'] : [];
  const query = { date, startTime: clock(start), endTime: clock(start + hours * 60), origin, party: { adults: 1, children: 0 }, budget: 60000, maxWalkMinutes, stopCount, preferences, requiredCategories, requiredFeatures: {}, lockedIds: [], excludedIds: [] };
  const r = planTravel(query, { now, routeLeg, ask: false, intents: picks.map(id => ({ id, ...INTENTS[id].check })) }); out.runs++;
  if (!r.primary) continue;
  const weekday = new Date(date + 'T00:00:00Z').getUTCDay();
  for (const stop of r.primary.stops) {
    out.stops++;
    const hours = stop.place.conditions?.hours; if (!hours?.weekly) continue;
    if (hours.exceptions?.[date]) continue;
    const slots = hours.weekly[weekday]; if (!Array.isArray(slots)) continue;
    if (!slots.length) { out.outside.push({ date, picks: picks.join('+') || '-', start: clock(start), place: stop.place.id, why: '휴무일', at: stop.arrivalTime + '-' + stop.departureTime, status: stop.schedule.status }); continue; }
    const a = minute(stop.arrivalTime), d = minute(stop.departureTime);
    const ok = slots.some(s => a >= minute(s.open) && a <= minute(s.lastEntry ?? s.close) && d <= minute(s.close));
    if (ok) continue;
    const why = slots.every(s => a > minute(s.lastEntry ?? s.close)) ? '입장 마감 뒤 도착' : slots.some(s => d > minute(s.close)) ? '폐장 뒤 종료' : '운영 전 도착';
    const extra = stop.reasons.find(x => x.includes('더 머물게')) ?? '';
    if (extra) out.stretchedOutside++;
    out.outside.push({ date, picks: picks.join('+') || '-', start: clock(start), place: stop.place.id, why, at: stop.arrivalTime + '-' + stop.departureTime, status: stop.schedule.status, extra });
    out.byPlace[stop.place.id] = (out.byPlace[stop.place.id] ?? 0) + 1; out.byStatus[stop.schedule.status] = (out.byStatus[stop.schedule.status] ?? 0) + 1;
  }
}
console.log(JSON.stringify({ runs: out.runs, stops: out.stops, outside: out.outside.length, stretchedOutside: out.stretchedOutside, byPlace: out.byPlace, byStatus: out.byStatus, examples: out.outside.slice(0, 14) }, null, 1));
