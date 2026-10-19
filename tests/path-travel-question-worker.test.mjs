import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TRAVEL_PLACES } from '../experiences/path-travel/places-v2.mjs';
import { planTravel, normalizePlannerInput } from '../experiences/path-travel/planner.mjs';
import { createWalkingRouter } from '../experiences/path-travel/walking-router.mjs';

// 질문 워커(question-worker.mjs)를 브라우저 워커처럼 돌린다: 전역 addEventListener·postMessage·fetch를 흉내 내고,
// 메시지는 화면과 워커 사이처럼 structuredClone으로 오간다. 화면이 같은 조건으로 계산한 질문·일정과 같아야 한다.
const mapUrl = new URL('../experiences/path-travel/assets/jongno-walking.json', import.meta.url);
const map = JSON.parse(await readFile(mapUrl, 'utf8')), routeLeg = createWalkingRouter(map);
const now = '2026-10-19T03:00:00.000Z', origin = { id: 'anguk', name: '안국역', lat: 37.5765, lon: 126.9854 };
const intent = { food: { category: 'food' }, tea: { category: 'tea' }, art: { feature: 'art' }, palace: { feature: 'palace' }, market: { feature: 'market' } };
const serveMap = async () => new Response(await readFile(mapUrl));
let loads = 0;
async function startWorker(fetchMap = serveMap) {
  const listeners = [], posted = [], fetched = [];
  Object.assign(globalThis, {
    addEventListener: (type, listener) => { if (type === 'message') listeners.push(listener); },
    postMessage: message => posted.push(structuredClone(message)),
    fetch: async url => { fetched.push(String(url)); return fetchMap(url); },
  });
  await import(`../experiences/path-travel/question-worker.mjs?load=${++loads}`);
  const ask = async message => {
    const before = posted.length;
    await Promise.all(listeners.map(listener => listener({ data: structuredClone(message) })));
    return posted.slice(before);
  };
  return { ask, fetched, listeners };
}
function day({ picks = [], date = '2026-10-21', startTime = '10:00', endTime = '18:00', stopCount = 5, maxWalkMinutes = 150, ...extra }) {
  const prefs = { food: { food: true }, tea: { tea: true }, art: { art: true }, palace: { history: true, walk: true }, market: { marketFood: true } };
  const input = normalizePlannerInput({ date, startTime, endTime, origin, party: { adults: 1, children: 0 }, budget: 60000, maxWalkMinutes, stopCount,
    preferences: Object.assign({}, ...picks.map(id => prefs[id])), requiredFeatures: {}, requiredCategories: picks.includes('food') ? ['food'] : [], lockedIds: [], excludedIds: [], ...extra }, { places: TRAVEL_PLACES });
  return { input, intents: picks.map(id => ({ id, ...intent[id] })) };
}

test('워커가 낸 확인 질문과 일정은 화면이 같은 조건으로 계산한 것과 같다', async () => {
  const worker = await startWorker();
  const feedback = [{ id: 'feedback-indoor', key: 'indoor', value: true, status: 'confirmed', source: { kind: 'user-confirmation' }, confirmedAt: '2026-10-18T09:00:00.000Z', importance: 4 }];
  const scenarios = [
    { label: '하루 맛집+궁궐+차', ...day({ picks: ['food', 'palace', 'tea'] }), feedback: [], routed: true },
    { label: '3시간 차 + 확인한 평소 취향', ...day({ picks: ['tea'], startTime: '14:00', endTime: '17:00', stopCount: 3, maxWalkMinutes: 70 }), feedback, routed: true },
    { label: '반나절 고르지 않음 · 지도 없이', ...day({ startTime: '13:00', endTime: '18:00', stopCount: 4, maxWalkMinutes: 100 }), feedback: [], routed: false },
  ];
  for (const [index, scenario] of scenarios.entries()) {
    const main = planTravel(structuredClone(scenario.input), { now, feedback: scenario.feedback, intents: scenario.intents, routeLeg: scenario.routed ? routeLeg : null });
    assert.ok(main.primary && main.question, `${scenario.label}: 질문이 나오는 조건이어야 대조가 된다`);
    const replies = await worker.ask({ token: index + 1, input: scenario.input, now, feedback: scenario.feedback, intents: scenario.intents, routed: scenario.routed, mapStamp: map.sourceTimestamp });
    assert.equal(replies.length, 1, scenario.label);
    const [reply] = replies;
    assert.equal(reply.error, undefined, scenario.label);
    assert.equal(reply.token, index + 1, scenario.label);
    assert.equal(reply.primaryId, main.primary.id, scenario.label);
    assert.deepEqual(reply.question, main.question, scenario.label);
  }
  // 지도는 시작할 때 한 번만 읽는다.
  assert.deepEqual(worker.fetched, [mapUrl.href]);
});

test('지도를 못 읽거나 화면과 다른 지도면 질문 대신 오류를 돌려줘 화면이 직접 계산하게 한다', async () => {
  let fail = true;
  const worker = await startWorker(async () => fail ? new Response('없음', { status: 404 }) : serveMap());
  const { input, intents } = day({ picks: ['tea'], startTime: '14:00', endTime: '17:00', stopCount: 3, maxWalkMinutes: 70 });
  const message = { token: 7, input, now, feedback: [], intents, routed: true, mapStamp: map.sourceTimestamp };
  assert.deepEqual(await worker.ask(message), [{ token: 7, error: 'map unavailable' }]);
  // 지도를 쓰지 않은 일정이면 지도 없이도 계산한다.
  const [plain] = await worker.ask({ ...message, token: 8, routed: false });
  assert.equal(plain.error, undefined);
  assert.equal(plain.primaryId, planTravel(structuredClone(input), { now, feedback: [], intents, routeLeg: null }).primary.id);
  // 못 읽은 지도는 다음 질문 때 다시 읽는다.
  fail = false;
  const fetchedBefore = worker.fetched.length;
  const [routed] = await worker.ask({ ...message, token: 9 });
  assert.equal(routed.error, undefined);
  assert.equal(worker.fetched.length, fetchedBefore + 1);
  assert.deepEqual(await worker.ask({ ...message, token: 10, mapStamp: 'other-map' }), [{ token: 10, error: 'map differs' }]);
});
