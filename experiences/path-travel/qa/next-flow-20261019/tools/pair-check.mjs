// 시간 화면의 「두 가지를 한 일정으로 잇기 어려워요」 어림(planner-ui.mjs pairFits와 같은 셈)을 엔진 결과와 대조한다.
// 잘못된 경고 = 어림은 어렵다고 했는데 엔진이 두 가지를 다 넣은 경우. 놓친 경고 = 어림은 된다고 했는데 엔진이 하나만 넣은 경우(엔진의 선택일 수 있음).
// 사용: node pair-check.mjs
import { readFileSync } from 'node:fs';
const root = new URL('../../../', import.meta.url).href;
const { planTravel, estimateWalkingLeg } = await import(root + 'planner.mjs');
const { createWalkingRouter } = await import(root + 'walking-router.mjs');
const { evaluateRealStay } = await import(root + 'real-conditions.mjs');
const { REAL_CONDITION_CALENDAR } = await import(root + 'real-places.mjs');
const { TRAVEL_PLACES } = await import(root + 'places-v2.mjs');
const routeLeg = createWalkingRouter(JSON.parse(readFileSync(new URL(root + 'assets/jongno-walking.json'), 'utf8')));
const origin = { id: 'anguk', name: '안국역', lat: 37.5765, lon: 126.9854 }, now = '2026-10-19T03:00:00.000Z';
const INTENTS = { food: { prefs: { food: true }, check: { category: 'food' } }, tea: { prefs: { tea: true }, check: { category: 'tea' } }, art: { prefs: { art: true }, check: { feature: 'art' } },
  palace: { prefs: { history: true, walk: true }, check: { feature: 'palace' } }, alley: { prefs: { walk: true, outdoor: true }, check: { feature: 'hanok', category: 'culture' } }, market: { prefs: { marketFood: true }, check: { feature: 'market' } } };
const HOURS = { 2: { stops: 2, walk: 50 }, 3: { stops: 3, walk: 70 }, 5: { stops: 4, walk: 100 } };
const clock = v => String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0');
const serves = (place, id) => { const rule = INTENTS[id].check; return (!rule.category || place.category === rule.category) && (!rule.feature || place.features?.[rule.feature] === true); };
const opens = (place, span, arrive) => evaluateRealStay(place, { date: span.date, time: clock(arrive), stayMinutes: place.planningStayMinutes }, { now, calendar: REAL_CONDITION_CALENDAR }).status !== 'unmatched';
function options(id, span) {
  return TRAVEL_PLACES.filter(place => place.dayPlannerEligible !== false && place.coordinates && serves(place, id)).map(place => {
    const leg = estimateWalkingLeg(origin, place, { routeLeg }); return { place, walk: leg.maxMinutes, total: leg.maxMinutes + place.planningStayMinutes };
  }).filter(row => { for (let arrive = span.start + row.walk; arrive + row.place.planningStayMinutes <= span.end; arrive += 30) if (opens(row.place, span, arrive)) return true; return false; });
}
const legFloor = (a, b) => { const plain = estimateWalkingLeg(a, b); return Math.min(Math.max(2, Math.ceil(plain.distanceMeters / 50 + 3)), plain.maxMinutes); };
function pairFits(a, b, span, cap) {
  const rows = id => options(id, span).filter(row => row.walk <= cap);
  const enter = (place, from) => { for (let arrive = from; arrive <= from + 60 && arrive + place.planningStayMinutes <= span.end; arrive += 15) if (opens(place, span, arrive)) return arrive; return null; };
  for (const x of rows(a)) for (const y of rows(b)) for (const [first, second] of [[x, y], [y, x]]) {
    if (first.place.id === second.place.id) continue;
    const earliest = span.start + first.walk + first.place.planningStayMinutes;
    if (earliest + legFloor(first.place, second.place) + second.place.planningStayMinutes > span.end) continue;
    const arrive = enter(first.place, span.start + first.walk); if (arrive === null) continue;
    if (enter(second.place, arrive + first.place.planningStayMinutes + estimateWalkingLeg(first.place, second.place, { routeLeg }).maxMinutes) !== null) return true;
  }
  return false;
}
const ids = Object.keys(INTENTS), pairs = ids.flatMap((a, i) => ids.slice(i + 1).map(b => [a, b]));
const result = { runs: 0, warned: 0, falseWarnings: [], missed: 0, fitsAlone: 0 };
for (const [a, b] of pairs) for (const hours of [2, 3, 5]) for (const date of ['2026-10-19', '2026-10-20', '2026-10-24']) for (const start of [600, 780, 900, 1020]) {
  const end = start + hours * 60; if (end > (hours >= 5 ? 1200 : 1260)) continue;
  const span = { date, start, end }, cap = HOURS[hours].walk;
  // 둘 다 따로는 들어갈 때만 본다(시간 화면도 그렇다).
  const fits = id => options(id, span).some(row => row.total <= hours * 60 && row.walk <= cap);
  if (!fits(a) || !fits(b)) continue;
  result.fitsAlone++;
  const together = pairFits(a, b, span, cap);
  const r = planTravel({ date, startTime: clock(start), endTime: clock(end), origin, party: { adults: 1, children: 0 }, budget: 60000, stopCount: HOURS[hours].stops, maxWalkMinutes: cap,
    preferences: { ...INTENTS[a].prefs, ...INTENTS[b].prefs }, requiredCategories: [], requiredFeatures: {}, lockedIds: [], excludedIds: [] },
    { now, routeLeg, ask: false, intents: [a, b].map(id => ({ id, ...INTENTS[id].check })) });
  result.runs++;
  const both = !!r.primary && [a, b].every(id => r.primary.stops.some(stop => serves(stop.place, id)));
  if (!together) { result.warned++; if (both) result.falseWarnings.push({ pair: `${a}+${b}`, hours, date, start: clock(start), plan: r.primary.stops.map(s => `${s.arrivalTime} ${s.placeId}`).join(' / ') }); }
  else if (!both) result.missed++;
}
console.log(JSON.stringify({ ...result, falseWarnings: result.falseWarnings.length, examples: result.falseWarnings.slice(0, 8) }, null, 1));
