// 말 랠리의 새 길(Atlas 재설계 4-6d — 단계4_계획 §23-7 · §23-10 「게임」). 진짜 엔진 코치(손님 · 메모리 저장소)를 셸의 게임 문
// (synk-world-app/world-atlas-game.mjs createGameDoor)에 넣고, 문을 거친 그대로(인수 복제 · 고른 후보 되맞춤) atlas-next-play.mjs로 한 판씩 돈다.
// 보는 것: 공마다 recommend(12공 · 종류마다 4공 이상 · 처음 판은 쉬운 말) · 제시 → 전달 → 도움 → 답의 차례 · 판 끝 finishSet,
// none 뒤 게임 차례(이유 줄 없음 · 제품 차례) · idle이면 엔진의 채우기 · 하루 도전은 present만(첫 제시 전 startSet 판 길이 12) · 한 제시가 Flow를 한 번만 ·
// 판을 다시 정하면 기록 없이 이어 감 · 문이 null이면 옛 길 · RUN_ENDED는 던짐. 끝에 원문 검사(꺼진 판은 새 길 모듈을 싣지 않는다).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { ITEMS, KIND_LABEL } from './content.mjs';
import { composeRound } from './core.mjs';
import { dailyRound, seoulDate } from './daily.mjs';
import { createExchange, FLOW_RALLY, FLOW_WORDS, GAME_ID, itemMetadata, rallyObservation } from './learning.mjs';
import { BALL_REASONS, BANKS, openRally } from './atlas-next-play.mjs';
import { ended } from './kit/atlas-next.mjs';
import { createGameDoor, GAME_BANKS } from '../synk-world-app/world-atlas-game.mjs';

const atlas = await import('../../packages/atlas/src/index.mjs');
const json = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
// 낱말 이름까지 — 셸이 여는 코치는 은행 조각의 낱말 줄로 「방금 놓친 「…」」의 이름을 세운다.
const mapData = { index: json('../../packages/atlas/map/index.json'), units: json('../../packages/atlas/map/units.json'), words: json('../../packages/atlas/map/words.json') };
const T0 = Date.UTC(2026, 10, 19, 1, 0, 0);   // 서울 오전 10시
const clock = (start = T0) => { const s = { t: start }; return { now: () => s.t, advance: (ms) => { s.t += ms; } }; };
let stores = 0;
const newKey = () => `synk-atlas:talk-rally-test-${process.pid}-${(stores += 1)}`;
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

async function engineCoach({ gameId = GAME_ID, port = atlas.memoryPort(), key = newKey(), time = clock(), prefs } = {}) {
  const coach = atlas.createCoach({ gameId, mapData, dayOffset: 540, host: { guest: true, port, key, now: time.now, ...(prefs ? { prefs } : {}) } });
  await coach.ready;
  return { coach, port, key, time };
}

// 코치 메서드 호출을 적는 겉(얼린 코치라 Proxy 대신 같은 이름의 함수 묶음).
function traced(coach) {
  const calls = [];
  const out = {};
  for (const name of Object.keys(coach)) {
    const value = coach[name];
    out[name] = typeof value === 'function' ? (...args) => { const result = value(...args); calls.push({ name, args, result }); return result; } : value;
  }
  return { coach: out, calls, names: () => calls.map((call) => call.name) };
}

// 가짜 입구 · 문 · 틀 창 — 문을 거친 그대로 연다.
async function throughDoor(coach, { give = () => coach } = {}) {
  const retirers = new Set();
  const entry = { gameCoach: async () => give(), retired: (_made, fn) => { retirers.add(fn); return () => retirers.delete(fn); } };
  const door = createGameDoor({ entry, gameId: 'talk-rally', later: (fn) => fn() });
  const top = { SYNKAtlasGame: door.api };
  const win = { parent: top, top, addEventListener: () => {}, location: { hostname: 'synk.im', search: '' } };
  let sound = true;
  const rally = await openRally({ win, audio: () => sound });
  return { rally, door, win, retire: () => [...retirers].forEach((fn) => fn({ reason: 'account' })), mute: (off) => { sound = !off; } };
}

// app.mjs의 공 하나와 같은 차례: 공을 그때 고르고 → 제시(createExchange) → 다 들음(전달) → 도움(있으면) → 받아침(답) → 순간 맞춤 관찰.
function playRound(rally, plan, time, { choose = (_i, item) => item.answer, help = () => null, flow = null } = {}) {
  const balls = [];
  for (let i = 0; i < plan.size; i += 1) {
    const item = plan.at(i);
    if (!item) break;
    const ex = createExchange(rally.coach, item);
    time.advance(2500); ex.heard(true);
    const kind = help(i, item); if (kind) ex.help(kind);
    time.advance(1500);
    const choice = choose(i, item);
    const rec = ex.confirm(choice);
    const seen = flow ? rally.observe(flow, ex.pid, rallyObservation({ choice, answer: item.answer, used: 0.3, assisted: !!kind })) : null;
    time.advance(800);
    balls.push({ item, pid: ex.pid, rec, seen, line: plan.line(i) });
  }
  return balls;
}

// 저장소의 사건(메모리 포트의 줄 { key, value: { kind: 'event', event } }).
const eventsOf = async (port) => (await port.read()).map((row) => row.value).filter((value) => value?.kind === 'event').map((value) => value.event);
const presentedOf = async (port) => (await eventsOf(port)).filter((event) => event.type === 'practice.presented');
const kindsOf = (queue) => Object.fromEntries(Object.keys(KIND_LABEL).map((kind) => [kind, queue.filter((item) => item.kind === kind).length]));

test('은행 이름은 셸의 게임 은행 표와 같다', () => {
  assert.deepEqual([...BANKS], [...GAME_BANKS['talk-rally']]);
});

test('문이 없으면 null(옛 길), 셸이 지금 판이면 null, 문이 닫히는 중이면 RUN_ENDED를 그대로 던진다', async () => {
  assert.equal(await openRally({ win: { parent: null, top: null, location: { hostname: 'synk.im', search: '?atlas=next' } } }), null, '공개 주소는 개발 깃발을 읽지 않는다');
  const old = await throughDoor(null, { give: () => null });
  assert.equal(old.rally, null);
  // 기다리던 open이 패널 닫힘으로 끝나면 null이 아니라 RUN_ENDED — 게임은 옛 길을 열지 않는다.
  let release;
  const { coach } = await engineCoach();
  const entry = { gameCoach: () => new Promise((resolve) => (release = () => resolve(coach))), retired: () => () => {} };
  const door = createGameDoor({ entry, gameId: 'talk-rally', later: (fn) => fn() });
  const top = { SYNKAtlasGame: door.api };
  const opening = openRally({ win: { parent: top, top, addEventListener() {} } });
  door.dispose(); release();
  const error = await opening.then(() => null, (caught) => caught);
  assert.equal(error?.code, 'RUN_ENDED');
  assert.equal(ended(error), true, '틀에서는 code로만 가른다');
  coach.dispose();
});

test('빈 기억 손님의 처음 판 — 공마다 recommend, 쉬운 말 12공에 종류마다 4공 이상, 제시 · 전달 · 도움 · 답 차례, 판 끝 finishSet', async () => {
  const { coach, port, time } = await engineCoach();
  const spy = traced(coach);
  const { rally } = await throughDoor(spy.coach);
  const plan = rally.round({ firstTime: true, seed: 1 });
  assert.equal(plan.size, 12);
  assert.equal(plan.pool.every((item) => item.difficulty === 1), true, '처음 판은 쉬운 말만 후보');
  const wrong = new Set([0, 4, 7]);
  const balls = playRound(rally, plan, time, { choose: (i, item) => (wrong.has(i) ? item.options[1] : item.answer), help: (i) => (i === 2 ? 'replay' : null) });
  assert.equal(balls.length, 12);
  assert.equal(new Set(plan.queue).size, 12, '한 판에 같은 말은 한 번');
  assert.equal(plan.queue.every((item) => item.difficulty === 1), true);
  for (const [kind, n] of Object.entries(kindsOf(plan.queue))) assert.ok(n >= 4, `${kind} ${n}공`);
  assert.deepEqual(plan.kinds(), Array(12).fill('engine'), '빈 기억 손님의 처음 판은 엔진이 끝까지 고른다');
  assert.deepEqual(balls.map((ball) => ball.rec.verdict), balls.map((_, i) => (wrong.has(i) ? 'incorrect' : 'correct')));
  // 공마다 recommend → present 한 쌍이고, 판 옵션은 길이 12 · 새것 한도 36 · 소리 있음이다.
  const names = spy.names().filter((name) => ['recommend', 'present', 'finishSet'].includes(name));
  assert.deepEqual(names, Array.from({ length: 12 }, () => ['recommend', 'present']).flat());
  const asked = spy.calls.find((call) => call.name === 'recommend');
  assert.deepEqual(asked.args[1], { set: { length: 12, newLimit: 36 }, audio: true });
  assert.ok(asked.args[0].every((row) => typeof row.itemKey === 'string' && row.itemId), '후보는 자료만 — 문을 지난다');
  // 엔진이 고른 공에만, 다시 만나는 말일 때만 이유 줄이 붙는다.
  const reasons = spy.calls.filter((call) => call.name === 'recommend').map((call) => call.result.why);
  balls.forEach((ball, i) => assert.equal(ball.line, BALL_REASONS.includes(reasons[i]?.code) ? reasons[i].line : null, `공 ${i + 1}`));
  plan.end();
  assert.deepEqual(spy.calls.filter((call) => call.name === 'finishSet').map((call) => call.args[0]), [{ record: false }], '판 끝에 기록 없이 닫는다');
  plan.end();
  assert.equal(spy.names().filter((name) => name === 'finishSet').length, 1, '두 번 닫지 않는다');
  await Promise.all(balls.map((ball) => ball.rec.stored));
  await settle();
  // 사건의 차례: 제시마다 제시 → 전달 → (도움) → 답 하나.
  const rows = await eventsOf(port);
  const presented = rows.filter((event) => event.type === 'practice.presented');
  assert.deepEqual(presented.map((event) => event.itemKey), plan.queue.map((item) => itemMetadata(item).itemKey));
  assert.ok(presented.every((event) => event.arm !== 'host'), '엔진이 고른 제시');
  for (const [i, event] of presented.entries()) {
    const group = rows.filter((row) => row.presentationId === event.id).map((row) => row.type);
    assert.deepEqual(group, ['practice.delivery', ...(i === 2 ? ['practice.helped'] : []), 'practice.attempted'], `공 ${i + 1}`);
  }
  coach.dispose();
});

test('같은 날 다른 게임이 새 말 한도를 다 쓰면 첫 공부터 none — 게임 차례로 12공을 끝까지, 이유 줄 없이 제품 차례로 낸다', async () => {
  const port = atlas.memoryPort(), key = newKey(), time = clock();
  // 같은 저장소의 다른 게임(빈칸 베기)이 말 랠리와 단위가 겹치지 않는 문항으로 그날의 새 단위 한도를 쓴다.
  const map = atlas.openMap(mapData);
  const rallyUnits = new Set(map.items('talk-rally').flatMap((item) => item.units));
  const pool = map.items('blank-slice').filter((item) => item.units.every((unit) => !rallyUnits.has(unit))).map((item) => ({ itemKey: item.itemKey }));
  const other = (await engineCoach({ gameId: 'blank-slice', port, key, time })).coach;
  for (let i = 0; i < 40; i += 1) {
    const picked = other.recommend(pool, { set: { length: 40, newLimit: 120 } });
    if (picked.status !== 'ready') break;
    const pid = other.present(picked.selected); time.advance(3000);
    other.answer(pid, { correct: true, assessable: true }); time.advance(3000);
  }
  other.finishSet({ record: false });
  const { coach } = await engineCoach({ port, key, time });
  const spy = traced(coach);
  const { rally } = await throughDoor(spy.coach);
  const plan = rally.round({ firstTime: false, seed: 3 });
  const balls = playRound(rally, plan, time);
  assert.equal(balls.length, 12, 'none이어도 놀이는 멈추지 않는다');
  for (const [kind, n] of Object.entries(kindsOf(plan.queue))) assert.ok(n >= 4, `${kind} ${n}공`);
  const results = spy.calls.filter((call) => call.name === 'recommend').map((call) => call.result);
  assert.equal(results.length, 12);
  assert.equal(results[0].status, 'none', '같은 날 넷째 게임 — 첫 추천부터 none');
  const none = results.map((result, i) => [result.status, i]).filter(([status]) => status === 'none').map(([, i]) => i);
  for (const i of none) {
    assert.equal(plan.kinds()[i], 'game', `공 ${i + 1}`);
    assert.equal(balls[i].line, null, '게임 차례 문항에는 이유 줄이 없다');
  }
  results.forEach((result, i) => assert.equal(plan.kinds()[i], result.status === 'none' ? 'game' : 'engine', `공 ${i + 1}`));
  assert.equal(plan.queue[0], composeRound(ITEMS, { seed: 3 })[0], '게임 순서 — 옛 판이 아틀라스 순서 없이 짜던 판의 첫 말');
  plan.end();
  await Promise.all(balls.map((ball) => ball.rec.stored));
  await settle();
  const presented = (await presentedOf(port)).filter((event) => event.itemKey.startsWith('talk-rally.'));
  assert.equal(presented.length, 12);
  for (const i of none) assert.ok(presented[i].arm === 'host' && presented[i].reason.code === 'host.order', `공 ${i + 1}은 제품 차례로 남는다`);
  other.dispose(); coach.dispose();
});

test('같은 날 둘째 판 — idle(채우기)은 엔진이 고른 문항, none은 게임 차례이고, 소리를 끄면 엔진이 듣기 문항을 고르지 않는다', async () => {
  const { coach, port, time } = await engineCoach();
  const spy = traced(coach);
  const { rally, mute } = await throughDoor(spy.coach);
  const first = rally.round({ firstTime: true, seed: 1 });
  playRound(rally, first, time, { choose: (i, item) => (i % 4 === 0 ? item.options[2] : item.answer) });
  first.end();
  time.advance(60_000);
  const from = spy.calls.length;
  const second = rally.round({ firstTime: false, seed: 2 });
  const balls = playRound(rally, second, time);
  assert.equal(balls.length, 12);
  for (const [kind, n] of Object.entries(kindsOf(second.queue))) assert.ok(n >= 4, `${kind} ${n}공`);
  const results = spy.calls.slice(from).filter((call) => call.name === 'recommend').map((call) => call.result);
  const idle = results.map((result, i) => [result, i]).filter(([result]) => result.status === 'idle').map(([, i]) => i);
  assert.ok(idle.length > 0, '이 판에는 할 것이 없는 자리가 있다');
  for (const i of idle) {
    assert.equal(second.kinds()[i], 'engine', `공 ${i + 1}: idle은 엔진이 고른 문항(§23-6)`);
    assert.equal(second.queue[i].id, results[i].selected.itemId, '엔진의 채우기 그대로');
    assert.equal(second.line(i), null, '「다 만났어요」는 공마다 말하지 않는다');
  }
  results.forEach((result, i) => assert.equal(second.kinds()[i], result.status === 'none' ? 'game' : 'engine', `공 ${i + 1}`));
  second.end();
  await settle();
  const keys = new Set(idle.map((i) => second.queue[i]));
  const presented = (await presentedOf(port)).slice(12);
  assert.ok(presented.filter((event, i) => keys.has(second.queue[i])).every((event) => event.arm !== 'host'), '채우기는 엔진의 줄로 남는다');
  // 소리 끔: 엔진에 audio: false — 듣기 문항뿐이라 none, 게임 차례로 잇는다(이유 줄 없음).
  mute(true);
  const quiet = rally.round({ firstTime: false, seed: 4 });
  assert.ok(quiet.at(0));
  const asked = spy.calls.filter((call) => call.name === 'recommend').at(-1);
  assert.equal(asked.args[1].audio, false);
  assert.equal(asked.result.status, 'none');
  assert.deepEqual(quiet.kinds(), ['game']);
  assert.equal(quiet.line(0), null);
  quiet.end();
  coach.dispose();
});

test('하루 도전 — 그날 정해진 12번을 recommend 없이 present만 하고, 판 끝에 닫는다', async () => {
  const { coach, port, time } = await engineCoach();
  const spy = traced(coach);
  const { rally } = await throughDoor(spy.coach);
  const queue = dailyRound(seoulDate(T0));
  const plan = rally.fixed(queue);
  const balls = playRound(rally, plan, time);
  assert.equal(balls.length, 12);
  assert.deepEqual(plan.queue, queue);
  assert.equal(spy.names().includes('recommend'), false, '제품이 차례를 정한 판');
  plan.end();
  assert.deepEqual(spy.calls.filter((call) => call.name === 'finishSet').map((call) => call.args[0]), [{ record: false }]);
  await settle();
  const presented = await presentedOf(port);
  assert.equal(presented.length, 12);
  assert.ok(presented.every((event) => event.arm === 'host'));
  coach.dispose();
});

// 판 열기를 적는 가짜 코치 — 셸 문을 거친 겉으로 쓴다. startSet은 열린 판이 있으면 새 판을 열지 않는다(설계 주인 11-19 밤).
function setCoach({ startSet = true, failing = false } = {}) {
  const calls = [];
  let pids = 0, sets = 0, open = null;
  const coach = {
    recommend: (list, options) => { calls.push({ name: 'recommend', args: [options] }); return { status: 'ready', selected: list[0], why: null }; },
    present: (item) => { calls.push({ name: 'present', args: [item.itemKey] }); return `p-${(pids += 1)}`; },
    delivery: () => { calls.push({ name: 'delivery' }); return null; },
    help: () => { calls.push({ name: 'help' }); return null; },
    answer: (_pid, result) => { calls.push({ name: 'answer' }); return { verdict: result.correct ? 'correct' : 'incorrect' }; },
    finishSet: (options) => { calls.push({ name: 'finishSet', args: [options] }); open = null; },
    today: () => null,
    summary: () => null,
  };
  if (startSet) coach.startSet = (options) => {
    if (failing) throw Object.assign(new Error('판을 열지 못했다'), { code: 'SET_FAILED' });
    const result = open ? { opened: false, setId: open } : { opened: true, setId: (open = `s-${(sets += 1)}`) };
    calls.push({ name: 'startSet', args: [options], result });
    return result;
  };
  return { coach, calls, names: () => calls.map((call) => call.name).filter((name) => ['startSet', 'present', 'recommend', 'finishSet'].includes(name)) };
}

test('하루 도전 — 첫 공의 제시 전에 startSet({ length: 12 })을 한 번 부르고, 판을 닫고 다음 판을 열 때 다시 부른다', async () => {
  const fake = setCoach();
  const { rally } = await throughDoor(fake.coach);
  const queue = dailyRound(seoulDate(T0));
  const time = clock();
  // 판을 만들기만 하고 첫 공 전에 그만두면 열지도 닫지도 않는다(연습 공만 친 판).
  const quit = rally.fixed(queue);
  quit.end();
  assert.deepEqual(fake.names(), []);
  // app.mjs의 차례: 앞 판을 닫고(endPlan) → 새 판 → 공마다 at → 제시.
  const first = rally.fixed(queue);
  assert.deepEqual(fake.names(), [], '판을 만들 때는 아직 열지 않는다');
  assert.equal(playRound(rally, first, time).length, 12);
  first.end();
  const normal = rally.round({ firstTime: false, seed: 2 });
  assert.equal(playRound(rally, normal, time).length, 12);
  normal.end();
  const second = rally.fixed(queue);
  assert.equal(playRound(rally, second, time).length, 12);
  second.end();
  const twelve = (name) => Array(12).fill(name);
  assert.deepEqual(fake.names(), [
    'startSet', ...twelve('present'), 'finishSet',
    ...Array.from({ length: 12 }, () => ['recommend', 'present']).flat(), 'finishSet',
    'startSet', ...twelve('present'), 'finishSet',
  ], '보통 판(recommend 판)은 startSet을 부르지 않는다');
  const opened = fake.calls.filter((call) => call.name === 'startSet');
  assert.deepEqual(opened.map((call) => call.args[0]), [{ length: 12 }, { length: 12 }]);
  assert.deepEqual(opened.map((call) => call.result.opened), [true, true], '앞 판을 닫은 뒤라 판마다 새로 연다');
  assert.deepEqual(fake.calls.filter((call) => call.name === 'present').slice(0, 12).map((call) => call.args[0]), queue.map((item) => itemMetadata(item).itemKey));
});

test('하루 도전 — startSet이 없거나 실패하거나 겉이 닫혀도 정해진 12번을 그대로 낸다', async () => {
  const queue = dailyRound(seoulDate(T0));
  for (const fake of [setCoach({ startSet: false }), setCoach({ failing: true })]) {
    const { rally } = await throughDoor(fake.coach);
    const plan = rally.fixed(queue);
    assert.equal(playRound(rally, plan, clock()).length, 12);
    plan.end();
    assert.deepEqual(fake.names(), [...Array(12).fill('present'), 'finishSet']);
  }
  const fake = setCoach();
  const { rally, retire } = await throughDoor(fake.coach);
  const plan = rally.fixed(queue);
  retire();
  assert.equal(plan.at(0), queue[0], '닫힌 겉(RUN_ENDED)이어도 첫 공을 낸다');
  assert.doesNotThrow(() => plan.end());
  assert.deepEqual(fake.names(), [], '닫힌 뒤에는 셸 코치에 닿지 않는다');
});

test('순간 맞춤 — 공 시간과 오늘을 읽고, 한 제시는 Flow를 한 번만 움직인다(같은 공을 다시 쳐도 답은 첫 받기만)', async () => {
  const { coach, port, time } = await engineCoach({ prefs: { today: () => 'tired' } });
  const { rally } = await throughDoor(coach);
  assert.equal(rally.coach.today(), 'tired');
  const flow = rally.coach.live(FLOW_RALLY, { words: FLOW_WORDS });
  assert.equal(flow.intro().line?.text, FLOW_WORDS['start.tired']);
  assert.ok(flow.settings().values.flight >= 1, '피곤한 날은 공이 천천히 시작한다');
  const plan = rally.round({ firstTime: true, seed: 1 });
  const balls = playRound(rally, plan, time, { flow });
  assert.equal(flow.trace().length, 12, '공마다 한 번');
  // 놓친 공을 같은 제시로 다시 친 뒤 또 받아쳐도: 답은 첫 받기만이고(createExchange), 순간 맞춤도 움직이지 않는다.
  const last = balls.at(-1);
  const again = rally.observe(flow, last.pid, rallyObservation({ choice: last.item.answer, answer: last.item.answer, used: 0.1 }));
  assert.equal(again.change, null);
  assert.equal(flow.trace().length, 12, '같은 제시의 둘째 관찰은 몫이 없다');
  const ex = createExchange(rally.coach, plan.queue[0]);
  assert.ok(ex.confirm(plan.queue[0].answer));
  assert.equal(ex.confirm(plan.queue[0].answer), null, '한 공에 답은 한 번');
  for (let i = 0; i < 14; i += 1) {
    const one = createExchange(rally.coach, plan.queue[i % 12]);
    const out = rally.observe(flow, one.pid, rallyObservation({ choice: plan.queue[i % 12].answer, answer: plan.queue[i % 12].answer, used: 0.2 }));
    assert.ok(!out.change || out.change.direction < 0, '피곤한 날은 빨라지지 않는다');
    one.cancel();
  }
  plan.end();
  flow.end();
  await settle();
  const attempts = (await eventsOf(port)).filter((event) => event.type === 'practice.attempted' && event.presentationId === ex.pid);
  assert.equal(attempts.length, 1);
  coach.dispose();
});

test('판을 다시 정하면 이번 판은 기록 없이 잇고, 다음 판은 문을 다시 열어 새 겉을 받는다', async () => {
  const { coach, time } = await engineCoach();
  const spy = traced(coach);
  const { rally, retire, win } = await throughDoor(spy.coach);
  const replay = rally.round({ firstTime: true, seed: 1 });
  for (let i = 0; i < 4; i += 1) { const item = replay.at(i); createExchange(rally.coach, item).confirm(item.answer); time.advance(3000); }
  // 다섯째 공 앞에서 셸이 판을 다시 정했다.
  retire();
  assert.equal(rally.retired, true);
  const before = spy.calls.length;
  for (let i = 4; i < 12; i += 1) {
    const item = replay.at(i);
    assert.ok(item, `공 ${i + 1}은 게임 차례로 이어 간다`);
    let error = null;
    try { createExchange(rally.coach, item); } catch (caught) { error = caught; }
    assert.equal(ended(error), true, '닫힌 겉은 RUN_ENDED — 게임은 기록 없이 잇는다');
  }
  assert.deepEqual(replay.kinds().slice(4), Array(8).fill('game'));
  assert.equal(spy.calls.length, before, '닫힌 뒤에는 셸 코치에 닿지 않는다');
  assert.doesNotThrow(() => replay.end());
  assert.throws(() => rally.coach.live(FLOW_RALLY, { words: FLOW_WORDS }), { code: 'RUN_ENDED' });
  // 다음 판: 같은 문으로 다시 연다 — 새 겉.
  const fresh = await openRally({ win });
  assert.ok(fresh);
  assert.equal(fresh.retired, false);
  const next = fresh.round({ firstTime: false, seed: 2 });
  assert.ok(createExchange(fresh.coach, next.at(0)).pid);
  next.end();
  coach.dispose();
});

test('소리를 끈 공 — 엔진이 판정하지 못한 답(등급 없음)은 결과에 기록된 답으로 세지 않는다(4-6 끝 판 GD7)', async () => {
  const { coach, time } = await engineCoach();
  const { rally } = await throughDoor(coach);
  const plan = rally.round({ firstTime: true, seed: 1 });
  // app.mjs speakCur의 차례: 소리를 끄면 말을 글로 보이고(도움 text) 다 듣지 못한 채(전달 failed) 공을 친다. 소리가 도중에 끊긴 공도 같다.
  const ball = (i, { heard, help = null, right = true }) => {
    const item = plan.at(i);
    const ex = createExchange(rally.coach, item);
    if (help) ex.help(help);
    time.advance(2000); ex.heard(heard); time.advance(1000);
    return ex.confirm(right ? item.answer : item.options.find((option) => option !== item.answer));
  };
  const muted = ball(0, { heard: false, help: 'text' });
  const mutedWrong = ball(1, { heard: false, help: 'text', right: false });
  const alone = ball(2, { heard: true });
  const replayed = ball(3, { heard: true, help: 'replay' });
  assert.equal(muted.verdict, 'correct', '화면의 맞힘은 그대로');
  assert.equal(muted.grade, null, '소리를 끈 답은 엔진이 판정하지 않는다');
  assert.equal(mutedWrong.grade, null);
  assert.notEqual(alone.grade, null);
  assert.notEqual(replayed.grade, null, '다 듣고 다시 들은 답은 판정한다(옛 길도 기록한 답)');
  assert.deepEqual([muted, mutedWrong, alone, replayed].map((rec) => rally.assessed(rec)), [false, false, true, true]);
  assert.equal(rally.assessed(null), false, '답이 코치에 닿지 않았으면(닫힌 겉 · 오류) 기록되지 않은 답');
  // app.mjs는 새 길에서 이 값으로 결과의 recorded를 정하고, 옛 길(rally 없음)은 옛 판정 비교 그대로다.
  const source = readFileSync(new URL('./app.mjs', import.meta.url), 'utf8');
  assert.ok(source.includes("cur.recorded = rally ? rally.assessed(rec) : !!rec && rec.verdict !== 'unassessed';"));
  plan.end();
  coach.dispose();
});

test('원문 — 꺼진 판은 새 길 모듈을 싣지 않고 옛 코치를 지금 자리에서 같은 인수로 만든다', () => {
  const source = readFileSync(new URL('./app.mjs', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/^import\s[^;]*?from\s+'([^']+)'/gm)].map((match) => match[1]);
  assert.ok(imports.includes('./kit/atlas-next.mjs'), '키트는 정의뿐이라 정적으로 싣는다');
  assert.ok(!imports.some((path) => path.includes('atlas-next-play')), '새 길 모듈은 정적 import에 없다');
  assert.equal([...source.matchAll(/import\('\.\/atlas-next-play\.mjs'\)/g)].length, 1, '새 길 모듈을 부르는 곳은 하나');
  assert.match(source, /async function openNextCoach\(\) \{\s*let opened = null;\s*try \{ opened = await \(await import\('\.\/atlas-next-play\.mjs'\)\)\.openRally\(/, '문 · 개발 깃발이 있을 때만 동적으로 부른다');
  assert.ok(source.includes("try { coach = window.SynkLearning?.createGame({ gameId: GAME_ID, storage: window.localStorage }) || null; } catch { coach = null; }"), '옛 코치는 지금과 같은 인수');
  assert.match(source, /const atlasNext = !!\(nextDoor\(window\) \|\| devFlag\(window\)\);\r?\nif \(atlasNext\) await openNextCoach\(\); else openOldCoach\(\);/, '문이 없으면 이 자리에서 동기로 옛 코치');
  assert.equal(source.includes('/atlas/'), false, '게임이 입구를 직접 부르지 않는다');
  // 이 폴더의 다른 파일도 새 길 모듈을 정적으로 싣지 않는다.
  for (const name of readdirSync(new URL('.', import.meta.url))) {
    if (!/\.(m?js)$/.test(name) || name === 'atlas-next-play.mjs' || name.endsWith('.test.mjs')) continue;
    const text = readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');
    assert.ok(!/from\s+'\.\/atlas-next-play\.mjs'/.test(text), name);
  }
  // 새 길 모듈은 옛 길의 것(return-practice · 옛 요약 · events · 기록 지우기 · syncPort)을 쓰지 않는다.
  const next = readFileSync(new URL('./atlas-next-play.mjs', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  for (const word of ['returnPractice', 'missedPractice', 'skillReport', 'hasEarlierRecord', 'rankItems', 'events(', 'syncPort', 'reset(', 'recheck']) assert.equal(next.includes(word), false, word);
});
