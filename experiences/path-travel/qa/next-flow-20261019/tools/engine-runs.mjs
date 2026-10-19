// 엔진 시나리오 비교: node engine-runs.mjs [라벨]
import { readFileSync, writeFileSync } from 'node:fs';
const root = process.env.PATH_ROOT ?? 'file:///C:/Users/q1212/Documents/SYNK-appsscript/experiences/path-travel/';
const { planTravel } = await import(root + 'planner.mjs');
const { createWalkingRouter } = await import(root + 'walking-router.mjs');
const map = JSON.parse(readFileSync(new URL(root + 'assets/jongno-walking.json'), 'utf8'));
const routeLeg = createWalkingRouter(map);
const now = '2026-10-19T03:00:00.000Z';
const base = { date: '2026-10-21', origin: { id: 'anguk', name: '안국역', lat: 37.5765, lon: 126.9854 },
  party: { adults: 1, children: 0 }, budget: 60000, requiredFeatures: {}, lockedIds: [], excludedIds: [] };
const intents = { food: { food: true }, tea: { tea: true }, art: { art: true }, palace: { history: true, walk: true }, alley: { walk: true, outdoor: true }, market: { marketFood: true } };
const hours = { 1: [1, 20], 2: [2, 50], 3: [3, 70], 5: [4, 100], 8: [5, 150] };
const checks = { food: { category: 'food' }, tea: { category: 'tea' }, art: { feature: 'art' }, palace: { feature: 'palace' }, alley: { feature: 'hanok', category: 'culture' }, market: { feature: 'market' } };
const add = (h, start) => { const [hh, mm] = start.split(':').map(Number), end = hh * 60 + mm + h * 60; return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`; };
const scenario = (name, picks, h, start = '14:00', extra = {}) => {
  const [stopCount, maxWalkMinutes] = hours[h];
  return [name, { ...base, startTime: start, endTime: add(h, start), stopCount, maxWalkMinutes,
    preferences: Object.assign({}, ...picks.map(key => intents[key])), ...extra }, picks.map(id => ({ id, ...checks[id] }))];
};
const runs = [
  scenario('차+전시 3시간', ['tea', 'art'], 3),
  scenario('전시 3시간', ['art'], 3),
  scenario('궁궐 3시간', ['palace'], 3, '10:00'),
  scenario('골목+차 2시간', ['alley', 'tea'], 2),
  scenario('맛집+시장 3시간', ['food', 'market'], 3, '11:30'),
  scenario('반나절 고르지 않음', [], 5, '13:00'),
  scenario('하루 맛집+궁궐+차', ['food', 'palace', 'tea'], 8, '10:00'),
  scenario('하루 고르지 않음', [], 8, '10:00'),
  scenario('1시간 차', ['tea'], 1),
  scenario('1시간 고르지 않음', [], 1, '15:00'),
];
const label = process.argv[2] ?? 'run';
const out = [];
for (const [name, input, picked] of runs) {
  const started = performance.now();
  let result;
  try { result = planTravel(input, { now, routeLeg, ask: true, intents: picked }); } catch (error) { out.push(`${name}: 오류 ${error.field} ${error.message}`); continue; }
  const ms = Math.round(performance.now() - started), plan = result.primary;
  if (!plan) { out.push(`${name} (${input.startTime}–${input.endTime}, ${ms}ms): 일정 없음 · ${result.blocked.slice(0, 2).map(row => row.reason).join(' / ')}`); continue; }
  const free = (Number(input.endTime.slice(0, 2)) * 60 + Number(input.endTime.slice(3))) - (Number(plan.endTime.slice(0, 2)) * 60 + Number(plan.endTime.slice(3)));
  out.push(`${name} (${input.startTime}–${input.endTime}, ${ms}ms) 끝 ${plan.endTime} 여유 ${free}분 · 질문 ${result.question?.about ?? '-'}`);
  for (const stop of plan.stops) out.push(`   ${stop.arrivalTime}–${stop.departureTime} ${stop.place.name} [${stop.place.category}] ${stop.stayMinutes}분 (기본 ${stop.place.planningStayMinutes}) ${stop.reasons.join(' · ')}`);
}
writeFileSync(new URL(`../engine-${label}.txt`, import.meta.url), out.join('\n') + '\n');
console.log(out.join('\n'));
