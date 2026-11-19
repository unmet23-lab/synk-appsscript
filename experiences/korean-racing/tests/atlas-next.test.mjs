// 레이싱의 새 길(Atlas 재설계 4-6d — 단계4_계획 §23-7 · §23-10 「게임」). 진짜 엔진 코치(손님 · 메모리 저장소)를 셸의 게임 문
// (synk-world-app/world-atlas-game.mjs createGameDoor)에 넣고, 문을 거친 그대로(인수 복제 · 고른 후보 되맞춤) atlas-next-play.mjs로 판을 돈다.
// 보는 것: 맞춤 판만 관문마다 recommend(5관문 · 새것 한도 15 · ?learning= 영역) · 제시 → 전달 → 도움 → 답 → 답 보기 차례 · 판 끝 finishSet,
// none 뒤 게임 차례(이유 줄 없음 · 제품 차례) · idle은 엔진의 채우기 · 정해진 코스 · 시연 · 조작 연습은 present만 · 한 제시가 Flow를 한 번만 ·
// 문항 단계(items)는 손잡이가 아님 · 판을 다시 정하면 기록 없이 이어 감 · 진짜 race-controller.js로 맞춤 판 한 판(관문을 세울 때 고름 ·
// 판 안 후속 바꿔 넣기 없음 · 완주에 판 닫기). 정해진 차례의 판(코스 · 시연 · 조작 연습)은 첫 제시 전에 판 길이를 startSet으로 넘긴다
// (판마다 한 번 · 앞 판을 닫은 뒤 · 코치에 startSet이 없으면 기본 판으로 그대로). 끝에 원문 검사(꺼진 판은 새 길 모듈을 싣지 않는다).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { CAMPAIGN, recommendedStage } from '../campaign.js';
import { FINALES } from '../finales.js';
import { STAGES, WORD_BY_ID, emptyProgress, makeQuestions, reviewStage } from '../learning.js';
import { loadGarage } from '../garage.js';
import { FLOW_RACE, FLOW_WORDS, describeRace, racingItem } from '../personalization.js';
import { createRaceController } from '../race-controller.js';
import { LANES, RIDE_TRACK } from '../lane-core.js';
import { BANKS, GAME_ID, GATE_REASONS, gameOrder, openRace, personalStage, raceLabel } from '../atlas-next-play.mjs';
import { ended } from '../kit/atlas-next.mjs';
import { createGameDoor, GAME_BANKS } from '../../synk-world-app/world-atlas-game.mjs';

const atlas = await import('../../../packages/atlas/src/index.mjs');
const json = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
// 셸처럼 지도 전체(레이싱 조각에는 낱말 줄이 실리지 않는다 — 셸은 낱말 표를 받는다).
const mapData = { index: json('../../../packages/atlas/map/index.json'), units: json('../../../packages/atlas/map/units.json') };
const T0 = Date.UTC(2026, 10, 19, 1, 0, 0);   // 서울 오전 10시
const clock = (start = T0) => { const s = { t: start }; return { now: () => s.t, advance: (ms) => { s.t += ms; } }; };
let stores = 0;
const newKey = () => `synk-atlas:korean-racing-test-${process.pid}-${(stores += 1)}`;
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));
const CAMPAIGN_IDS = new Set(CAMPAIGN.flatMap((stage) => stage.items.map((q) => q.id)));
const FINALE_IDS = new Set(FINALES.flatMap((stage) => stage.items.map((q) => q.id)));

async function engineCoach({ gameId = GAME_ID, port = atlas.memoryPort(), key = newKey(), time = clock(), prefs } = {}) {
  const coach = atlas.createCoach({ gameId, mapData, dayOffset: 540, host: { guest: true, port, key, now: time.now, ...(prefs ? { prefs } : {}) } });
  await coach.ready;
  return { coach, port, key, time };
}

// 코치 메서드 호출을 적는 겉(얼린 코치라 Proxy 대신 같은 이름의 함수 묶음). 순간 맞춤 손잡이의 메서드는 live.<이름>으로 적는다.
function traced(coach) {
  const calls = [];
  const wrap = (target, prefix = '') => {
    const out = {};
    for (const name of Object.keys(target)) {
      const value = target[name];
      out[name] = typeof value === 'function' ? (...args) => {
        const result = value(...args);
        calls.push({ name: prefix + name, args, result });
        return name === 'live' && !prefix ? wrap(result, 'live.') : result;
      } : value;
    }
    return out;
  };
  return { coach: wrap(coach), calls, names: (keep = null) => calls.map((call) => call.name).filter((name) => !keep || keep.includes(name)) };
}

// 가짜 입구 · 문 · 틀 창 — 문을 거친 그대로 연다. give(): 입구가 줄 코치(null이면 지금 판).
async function throughDoor(coach, { give = () => coach } = {}) {
  const retirers = new Set();
  const entry = { gameCoach: async () => give(), retired: (_made, fn) => { retirers.add(fn); return () => retirers.delete(fn); } };
  const door = createGameDoor({ entry, gameId: 'korean-racing', later: (fn) => fn() });
  const top = { SYNKAtlasGame: door.api };
  const win = { parent: top, top, addEventListener: () => {}, location: { hostname: 'synk.im', search: '' } };
  const race = await openRace({ win });
  return { race, door, win, retire: () => [...retirers].forEach((fn) => fn({ reason: 'account' })) };
}

// app.js와 같은 관문 차례: 관문을 세울 때 그 자리의 문제(맞춤 판은 그때 고름 — gateQuestion) → 다가가면 제시(presentGate) → 소리 끝(전달)
// → (도움) → 길 고르기(answerGate — 옛 답 꼴) → 답 보기(judgeGate 끝의 도움 answer).
function runGates(race, plan, time, { questions = null, live = null, choose = (_i, q) => q.answer, help = () => null, audio = 'completed' } = {}) {
  const gates = [];
  for (let i = 0; i < plan.size; i += 1) {
    const q = plan.at(i) ?? questions?.[i];
    if (!q) break;
    const meta = racingItem(q);
    const pid = live ? live.present(meta) : race.coach.present(meta);
    time.advance(2500);
    if (meta.audioRequired) race.coach.delivery(pid, { audio });
    const kind = help(i, q);
    if (kind) race.coach.help(pid, kind);
    time.advance(1500);
    const chosen = choose(i, q);
    const response = { correct: chosen === q.answer, assessable: true, reason: undefined, choice: { selectedId: chosen, correctId: q.answer } };
    const out = live ? live.answer(pid, response, { pressure: 0.3 }) : { recorded: race.coach.answer(pid, response) };
    race.coach.help(pid, 'answer');
    time.advance(800);
    gates.push({ q, pid, out, recorded: out.recorded, line: plan.line(q.id) });
  }
  return gates;
}

// 저장소의 사건(메모리 포트의 줄 { key, value: { kind: 'event', event } }).
const eventsOf = async (port) => (await port.read()).map((row) => row.value).filter((value) => value?.kind === 'event').map((value) => value.event);
const presentedOf = async (port) => (await eventsOf(port)).filter((event) => event.type === 'practice.presented');
const wrongOf = (q) => q.options.find((id) => id !== q.answer);
const personal = (progress = emptyProgress(), modality = null) => personalStage({ progress, modality }).stage;

// 판 길이를 받는 코치(설계 주인 11-19 밤의 startSet) 흉내 — 진짜 엔진 코치에 startSet을 덧붙인다. 이 코치의 판이 열려 있으면 새 판을
// 열지 않고({ opened: false }), finishSet이 판을 닫는다. 제시 · 답은 진짜 엔진이 받는다(기본 판) — 이 흉내는 부르는 차례만 본다.
function withStartSet(coach) {
  let open = null, made = 0;
  return {
    ...coach,
    startSet: () => {
      if (open) return { opened: false, setId: open };
      open = `set-${(made += 1)}`;
      return { opened: true, setId: open };
    },
    finishSet: (options) => { open = null; return coach.finishSet(options); },
  };
}

test('은행 이름은 셸의 게임 은행 표와 같고, 혼자 뜨는 길의 이름 표는 낱말 · 능력을 안다', () => {
  assert.deepEqual([...BANKS], [...GAME_BANKS['korean-racing']]);
  assert.equal(GAME_ID, 'korean-racing');
  assert.equal(raceLabel('ko.word.w0001'), WORD_BY_ID.w0001.word);
  assert.equal(raceLabel('ko.reading.condition'), '읽기 · 조건 표현');
  assert.equal(raceLabel('ko.grammar.G207'), null, '문법 단위는 지도의 이름');
});

test('문이 없으면 null(옛 길), 셸이 지금 판이면 null, 문이 닫히는 중이면 RUN_ENDED를 그대로 던진다', async () => {
  assert.equal(await openRace({ win: { parent: null, top: null, location: { hostname: 'synk.im', search: '?atlas=next' } } }), null, '공개 주소는 개발 깃발을 읽지 않는다');
  const old = await throughDoor(null, { give: () => null });
  assert.equal(old.race, null);
  let release;
  const { coach } = await engineCoach();
  const entry = { gameCoach: () => new Promise((resolve) => (release = () => resolve(coach))), retired: () => () => {} };
  const door = createGameDoor({ entry, gameId: 'korean-racing', later: (fn) => fn() });
  const top = { SYNKAtlasGame: door.api };
  const opening = openRace({ win: { parent: top, top, addEventListener() {} } });
  door.dispose(); release();
  const error = await opening.then(() => null, (caught) => caught);
  assert.equal(error?.code, 'RUN_ENDED');
  assert.equal(ended(error), true, '틀에서는 code로만 가른다');
  coach.dispose();
});

test('입구의 맞춤 판은 엔진에 묻지 않고 꼴만 짓는다 — 문항 자리는 게임 순서, ?learning= 영역은 판에 실린다', () => {
  const progress = emptyProgress();
  const stage = personal(progress);
  assert.equal(stage.personalized, true);
  assert.equal(stage.title, '나에게 맞는 5문항');
  assert.deepEqual(stage.items.map((q) => q.id), recommendedStage(progress).items.map((q) => q.id), '빈 기록이면 게임이 권하는 첫 코스의 문항');
  const cleared = { stages: Object.fromEntries(CAMPAIGN.slice(0, 5).map((s) => [s.id, { cleared: true, bestScore: 5, plays: 1 }])) };
  assert.deepEqual(gameOrder(cleared).slice(0, 5).map((q) => q.id), CAMPAIGN[5].items.map((q) => q.id), '아직 통과하지 못한 코스부터');
  const reading = personal(progress, 'reading');
  assert.equal(reading.modality, 'reading');
  assert.ok(reading.items.every((q) => racingItem(q).modality === 'reading'));
  assert.ok(gameOrder(progress).every((q) => CAMPAIGN_IDS.has(q.id) && !FINALE_IDS.has(q.id)), '결승 문항은 맞춤에 쓰지 않는다');
});

test('빈 기억 손님의 맞춤 판 — 관문마다 recommend, 제시 · 전달 · 도움 · 답 · 답 보기 차례, 판 끝 finishSet 한 번', async () => {
  const { coach, port, time } = await engineCoach();
  const spy = traced(coach);
  const { race } = await throughDoor(spy.coach);
  assert.equal(race.hosted, false, '손님 코치는 이 브라우저의 기록');
  const plan = race.begin(personal(), { progress: emptyProgress(), random: () => 0.3 });
  assert.equal(plan.personal, true);
  assert.equal(plan.size, 5);
  const wrong = new Set([1, 3]);
  const gates = runGates(race, plan, time, { choose: (i, q) => (wrong.has(i) ? wrongOf(q) : q.answer), help: (i) => (i === 2 ? 'text' : null) });
  assert.equal(gates.length, 5);
  assert.equal(new Set(gates.map((gate) => gate.q.id)).size, 5, '한 판에 같은 문항은 한 번');
  assert.ok(gates.every((gate) => CAMPAIGN_IDS.has(gate.q.id)), '문장 도전 문항만(결승 제외)');
  assert.deepEqual(plan.kinds(), Array(5).fill('engine'), '빈 기억 손님의 첫 판은 엔진이 끝까지 고른다');
  assert.deepEqual(gates.map((gate) => gate.recorded.verdict), gates.map((_, i) => (wrong.has(i) ? 'incorrect' : 'correct')));
  // 관문마다 recommend → present 한 쌍(관문을 세울 때 고르고 다가가면 낸다). 판 옵션은 길이 5 · 새것 한도 15 · 소리 있음.
  assert.deepEqual(spy.names(['recommend', 'present', 'answer', 'finishSet']), Array.from({ length: 5 }, () => ['recommend', 'present', 'answer']).flat());
  const asked = spy.calls.filter((call) => call.name === 'recommend');
  assert.deepEqual(asked[0].args[1], { set: { length: 5, newLimit: 15 }, audio: true });
  assert.ok(asked.every((call) => call.args[0].every((row) => typeof row.itemKey === 'string' && row.itemKey.startsWith('korean-racing:'))), '후보는 자료만 — 문을 지난다');
  asked.forEach((call, i) => {
    const offered = new Set(call.args[0].map((row) => row.id));
    assert.ok(gates.slice(0, i).every((gate) => !offered.has(gate.q.id)), `관문 ${i + 1}: 앞 관문의 문항은 후보가 아니다`);
  });
  // 결과 화면이 읽는 도움 여부 · 독립 응답 — 처음 만남 · 도움 없음 · 소리 전달 · 판정된 답.
  assert.deepEqual(gates.map((gate) => gate.recorded.assisted), [false, false, true, false, false]);
  assert.deepEqual(gates.map((gate) => gate.recorded.independent), [true, true, false, true, true]);
  // 엔진이 고른 관문에만, 다시 만나는 까닭일 때만 이유 줄이 붙는다.
  const reasons = asked.map((call) => call.result.why);
  gates.forEach((gate, i) => assert.equal(gate.line, GATE_REASONS.includes(reasons[i]?.code) ? reasons[i].line : null, `관문 ${i + 1}`));
  plan.end();
  plan.end();
  assert.deepEqual(spy.calls.filter((call) => call.name === 'finishSet').map((call) => call.args[0]), [{ record: false }], '판 끝에 기록 없이 한 번 닫는다');
  assert.equal(plan.at(5), null, '판 길이 밖은 고르지 않는다');
  await Promise.all(gates.map((gate) => gate.recorded.stored));
  await settle();
  const rows = await eventsOf(port);
  const presented = rows.filter((event) => event.type === 'practice.presented');
  assert.deepEqual(presented.map((event) => event.itemKey), gates.map((gate) => racingItem(gate.q).itemKey));
  assert.ok(presented.every((event) => event.arm !== 'host'), '엔진이 고른 제시');
  assert.equal(new Set(presented.map((event) => event.setId)).size, 1, '다섯 관문이 한 판');
  for (const [i, event] of presented.entries()) {
    const group = rows.filter((row) => row.presentationId === event.id).map((row) => row.type);
    const heard = racingItem(gates[i].q).audioRequired ? ['practice.delivery'] : [];
    assert.deepEqual(group, [...heard, ...(i === 2 ? ['practice.helped'] : []), 'practice.attempted', 'practice.helped'], `관문 ${i + 1}`);
  }
  const attempts = rows.filter((event) => event.type === 'practice.attempted');
  assert.deepEqual(attempts.map((event) => event.choice?.selectedId), gates.map((gate, i) => (wrong.has(i) ? wrongOf(gate.q) : gate.q.answer)), '고른 길이 남는다');
  coach.dispose();
});

test('같은 날 다른 게임이 새 단위 한도를 다 쓰면 첫 관문부터 none — 게임 차례로 다섯 관문을 끝까지, 이유 줄 없이 제품 차례로 낸다', async () => {
  const port = atlas.memoryPort(), key = newKey(), time = clock();
  // 같은 저장소의 다른 게임 둘(빈칸 베기 · 찰칵 낱말)이 레이싱과 단위가 겹치지 않는 문항으로 그날의 새 단위 한도를 쓴다(레이싱 은행은 낱말
  // 2,000개를 덮어 한 게임의 겹치지 않는 단위로는 한도에 닿지 않는다).
  const map = atlas.openMap(mapData);
  const racingUnits = new Set(map.items('korean-racing').flatMap((item) => item.units));
  const others = [];
  for (const gameId of ['blank-slice', 'snap-words']) {
    const pool = map.items(gameId).filter((item) => item.units.every((unit) => !racingUnits.has(unit))).map((item) => ({ itemKey: item.itemKey }));
    const other = (await engineCoach({ gameId, port, key, time })).coach;
    for (let i = 0; i < 40; i += 1) {
      const picked = other.recommend(pool, { set: { length: 40, newLimit: 120 } });
      if (picked.status !== 'ready') break;
      const pid = other.present(picked.selected); time.advance(3000);
      other.answer(pid, { correct: true, assessable: true }); time.advance(3000);
    }
    other.finishSet({ record: false });
    others.push(other);
  }
  const { coach } = await engineCoach({ port, key, time });
  const spy = traced(coach);
  const { race } = await throughDoor(spy.coach);
  const progress = emptyProgress();
  const plan = race.begin(personal(progress), { progress });
  const gates = runGates(race, plan, time);
  assert.equal(gates.length, 5, 'none이어도 놀이는 멈추지 않는다');
  const results = spy.calls.filter((call) => call.name === 'recommend').map((call) => call.result);
  assert.equal(results.length, 5);
  assert.equal(results[0].status, 'none', '같은 날 넷째 게임 — 첫 추천부터 none');
  results.forEach((result, i) => assert.equal(plan.kinds()[i], result.status === 'none' ? 'game' : 'engine', `관문 ${i + 1}`));
  const none = results.map((result, i) => [result.status, i]).filter(([status]) => status === 'none').map(([, i]) => i);
  for (const i of none) assert.equal(gates[i].line, null, '게임 차례 문항에는 이유 줄이 없다');
  assert.equal(gates[0].q.id, recommendedStage(progress).items[0].id, '게임 순서 — 게임이 권하는 코스의 첫 문항');
  plan.end();
  await Promise.all(gates.map((gate) => gate.recorded.stored));
  await settle();
  const presented = (await presentedOf(port)).filter((event) => event.itemKey.startsWith('korean-racing:'));
  assert.equal(presented.length, 5);
  for (const i of none) assert.ok(presented[i].arm === 'host' && presented[i].reason.code === 'host.order', `관문 ${i + 1}은 제품 차례로 남는다`);
  for (const other of others) other.dispose();
  coach.dispose();
});

test('같은 날 여러 판 — idle(채우기)은 엔진이 고른 문항이고, 소리를 끄면 듣기 문항을 고르지 않으며, ?learning= 영역 밖은 후보가 아니다', async () => {
  const { coach, port, time } = await engineCoach();
  const spy = traced(coach);
  const { race } = await throughDoor(spy.coach);
  const progress = emptyProgress();
  const seen = [];
  for (let r = 0; r < 6; r += 1) {
    const from = spy.calls.length;
    const plan = race.begin(personal(progress), { progress });
    const gates = runGates(race, plan, time, { choose: (i, q) => (i % 2 ? wrongOf(q) : q.answer) });
    plan.end();
    const results = spy.calls.slice(from).filter((call) => call.name === 'recommend').map((call) => call.result);
    results.forEach((result, i) => seen.push({ result, kind: plan.kinds()[i], q: gates[i].q }));
    time.advance(60_000);
  }
  const idle = seen.filter((one) => one.result.status === 'idle');
  assert.ok(idle.length > 0, '이 날의 판에는 할 것이 없는 자리가 있다');
  for (const one of idle) {
    assert.equal(one.kind, 'engine', 'idle은 엔진이 고른 문항(§23-6)');
    assert.equal(one.q.id, one.result.selected.id, '엔진의 채우기 그대로');
  }
  seen.forEach((one) => assert.equal(one.kind, one.result.status === 'none' ? 'game' : 'engine'));
  await settle();
  const presented = await presentedOf(port);
  const idleKeys = new Set(idle.map((one) => racingItem(one.q).itemKey));
  assert.ok(presented.filter((event) => idleKeys.has(event.itemKey)).every((event) => event.arm !== 'host'), '채우기는 엔진의 줄로 남는다');
  // 소리 끔: 엔진에 audio: false — 엔진이 고른 관문은 읽기 문항뿐이다.
  const quiet = race.begin(personal(progress), { progress, audio: () => false });
  const quietGates = runGates(race, quiet, time);
  quiet.end();
  const quietAsked = spy.calls.filter((call) => call.name === 'recommend').slice(-5);
  assert.ok(quietAsked.every((call) => call.args[1].audio === false));
  quietGates.forEach((gate, i) => { if (quiet.kinds()[i] === 'engine') assert.equal(racingItem(gate.q).modality, 'reading', `관문 ${i + 1}`); });
  // ?learning=reading: 후보부터 읽기 문항뿐이다.
  const reading = race.begin(personal(progress, 'reading'), { progress });
  const readingGates = runGates(race, reading, time);
  reading.end();
  assert.ok(spy.calls.filter((call) => call.name === 'recommend').slice(-5).every((call) => call.args[0].every((row) => row.modality === 'reading')));
  assert.ok(readingGates.every((gate) => racingItem(gate.q).modality === 'reading'));
  coach.dispose();
});

test('정해진 코스 · 시연 · 조작 연습은 recommend 없이 present만 — 코스는 답까지, 시연 · 조작 연습은 도움 판', async () => {
  const { coach, port, time } = await engineCoach();
  const spy = traced(coach);
  const { race } = await throughDoor(spy.coach);
  // 문장 도전 코스: 그 코스의 차례 그대로.
  const course = CAMPAIGN[2];
  const questions = makeQuestions(course, () => 0.3);
  const plan = race.begin(course, { progress: emptyProgress() });
  assert.equal(plan.personal, false);
  assert.equal(plan.at(0), null, '정해진 코스는 고르지 않는다');
  const gates = runGates(race, plan, time, { questions, choose: (i, q) => (i === 4 ? wrongOf(q) : q.answer) });
  plan.end();
  assert.deepEqual(gates.map((gate) => gate.q.id), course.items.map((q) => q.id));
  // 시연(맞춤 판이어도 엔진에 묻지 않는다)과 조작 연습: 제시 뒤 곧 답 보기, 답 없음.
  const demoStage = personal();
  const demo = race.begin(demoStage, { demo: true, progress: emptyProgress() });
  assert.equal(demo.personal, false);
  const demoPids = demoStage.items.map((q) => { const pid = race.coach.present(racingItem(q)); race.coach.help(pid, 'answer'); time.advance(4000); return pid; });
  demo.end();
  const tutorial = race.begin(null, { tutorial: true });
  const tutorialPid = race.coach.present(racingItem({ answer: 'w0001', word: '가', mode: 'picture', options: ['w0001', 'w0002', 'w0003'] }));
  race.coach.help(tutorialPid, 'answer');
  tutorial.end();
  assert.equal(spy.names().includes('recommend'), false, '제품이 차례를 정한 판');
  assert.deepEqual(spy.calls.filter((call) => call.name === 'finishSet').map((call) => call.args[0]), Array(3).fill({ record: false }), '판마다 닫는다');
  await Promise.all(gates.map((gate) => gate.recorded.stored));
  await settle();
  const rows = await eventsOf(port);
  const presented = rows.filter((event) => event.type === 'practice.presented');
  assert.equal(presented.length, 5 + demoPids.length + 1);
  assert.ok(presented.every((event) => event.arm === 'host'), '제품 차례');
  for (const pid of [...demoPids, tutorialPid]) {
    assert.deepEqual(rows.filter((row) => row.presentationId === pid).map((row) => row.type), ['practice.helped'], '도움 판 — 답 없음');
  }
  coach.dispose();
});

test('정해진 차례의 판은 첫 제시 전에 판 길이를 startSet으로 넘긴다 — 판마다 한 번, 앞 판을 닫은 뒤에, 맞춤 판은 넘기지 않는다', async () => {
  const { coach, port, time } = await engineCoach();
  const spy = traced(withStartSet(coach));
  const { race, door } = await throughDoor(spy.coach);
  const progress = emptyProgress();
  // 복습(틀린 단어 셋 — 다섯이 아닌 판)과 오늘의 미션(app.js가 짓는 꼴 — 힌트 문항을 앞에 둔 문장 도전 코스).
  const review = reviewStage({ ...progress, words: Object.fromEntries(['w0001', 'w0002', 'w0003'].map((id, i) => [id, { seen: 1, correct: 0, wrong: 1, lastAt: T0 - i, lastCorrect: false }])) });
  const source = CAMPAIGN[4], hint = source.items[3];
  const mission = { ...source, id: 'mission-2026-11-19', title: '오늘의 힌트 다시 만나기', finale: false, review: true, items: [hint, ...source.items.filter((q) => q.id !== hint.id)] };
  const courses = [['문장 도전', CAMPAIGN[2]], ['결승', FINALES[0]], ['어휘', STAGES[0]], ['복습', review], ['오늘의 미션', mission]];
  const expected = [];
  const fixed = (name, n, plan) => {
    assert.equal(plan.personal, false, name);
    assert.equal(plan.size, n, name);
    assert.deepEqual(spy.names().slice(-1), ['startSet'], `${name}: 판을 열 때(첫 제시 전) 넘긴다`);
    expected.push('startSet', ...Array(n).fill('present'), 'finishSet');
  };
  for (const [name, stage] of courses) {
    const plan = race.begin(stage, { progress });
    fixed(name, stage.campaign ? stage.items.length : stage.words.length, plan);
    const gates = runGates(race, plan, time, { questions: makeQuestions(stage, () => 0.3) });
    assert.equal(gates.length, plan.size, `${name}: 관문마다 한 번 낸다`);
    plan.end();
  }
  // 시연(맞춤 판이어도 정해진 차례 — 제시 뒤 곧 답 보기)과 조작 연습(제시 하나).
  const demoStage = personal(progress);
  const demo = race.begin(demoStage, { demo: true, progress });
  fixed('시연', 5, demo);
  for (const q of demoStage.items) { const pid = race.coach.present(racingItem(q)); race.coach.help(pid, 'answer'); time.advance(4000); }
  demo.end();
  const tutorial = race.begin(null, { tutorial: true });
  fixed('조작 연습', 1, tutorial);
  race.coach.help(race.coach.present(racingItem({ answer: 'w0001', word: '가', mode: 'picture', options: ['w0001', 'w0002', 'w0003'] })), 'answer');
  tutorial.end();
  // 맞춤 판은 recommend가 판 길이를 넘긴다 — startSet을 부르지 않는다. 그 뒤의 정해진 코스는 다시 넘긴다.
  const mine = race.begin(personal(progress), { progress });
  runGates(race, mine, time);
  mine.end();
  expected.push(...Array.from({ length: 5 }, () => ['recommend', 'present']).flat(), 'finishSet');
  const again = race.begin(CAMPAIGN[2], { progress });
  fixed('문장 도전 다시', 5, again);
  runGates(race, again, time, { questions: makeQuestions(CAMPAIGN[2], () => 0.3) });
  again.end();
  assert.deepEqual(spy.names(['startSet', 'recommend', 'present', 'finishSet']), expected);
  const sets = spy.calls.filter((call) => call.name === 'startSet');
  assert.deepEqual(sets.map((call) => call.args), [5, 5, 5, 3, 5, 5, 1, 5].map((length) => [{ length }]), '판 길이 = 그 판의 제시 수');
  assert.ok(sets.every((call) => call.result.opened === true), '앞 판을 닫은 뒤라 판마다 새 판이 열린다');
  assert.equal(new Set(sets.map((call) => call.result.setId)).size, sets.length);
  await settle();
  assert.equal((await presentedOf(port)).length, 5 + 5 + 5 + 3 + 5 + 5 + 1 + 5 + 5, '제시 · 기록은 그대로');
  // 겉이 닫힌 뒤(패널이 닫힘)에 연 판: startSet이 RUN_ENDED로 거절해도 판은 열리고, 제시는 기록 없이 지나간다.
  door.dispose();
  const closed = race.begin(CAMPAIGN[3], { progress });
  assert.equal(closed.personal, false);
  assert.equal(race.coach.present(racingItem(makeQuestions(CAMPAIGN[3])[0])), null);
  assert.doesNotThrow(() => closed.end());
  coach.dispose();
});

test('코치에 startSet이 없으면(지금 엔진) 판 길이를 넘기지 않고 첫 제시가 기본 판으로 연다 — 놀이 · 기록은 그대로', async () => {
  const { coach, port, time } = await engineCoach();
  const plain = { ...coach };
  delete plain.startSet;
  const spy = traced(plain);
  const { race } = await throughDoor(spy.coach);
  const course = CAMPAIGN[2];
  const plan = race.begin(course, { progress: emptyProgress() });
  const gates = runGates(race, plan, time, { questions: makeQuestions(course, () => 0.3) });
  plan.end();
  assert.equal(gates.length, 5);
  assert.ok(gates.every((gate) => gate.recorded?.eventId), '답이 기록된다');
  assert.deepEqual(spy.names(['startSet', 'present', 'finishSet']), [...Array(5).fill('present'), 'finishSet']);
  await Promise.all(gates.map((gate) => gate.recorded.stored));
  await settle();
  const presented = await presentedOf(port);
  assert.equal(presented.length, 5);
  assert.equal(new Set(presented.map((event) => event.setId)).size, 1, '다섯 관문이 한 판(기본 판)');
  coach.dispose();
});

test('순간 맞춤 — 속도만 손잡이(문항 단계는 관찰만), 오늘을 읽고, 한 제시는 Flow를 한 번만 움직인다', async () => {
  const { coach, time } = await engineCoach({ prefs: { today: () => 'tired' } });
  const { race } = await throughDoor(coach);
  const live = race.coach.live(FLOW_RACE, { words: FLOW_WORDS });
  const start = live.settings().values;
  assert.deepEqual(Object.keys(start), ['cruise'], '문항 단계(item.difficulty)는 새 길에서 손잡이가 아니다');
  assert.equal(live.level(), null);
  assert.equal(live.intro().line?.text, FLOW_WORDS['start.tired']);
  const plan = race.begin(personal(), { progress: emptyProgress() });
  const gates = runGates(race, plan, time, { live });
  plan.end();
  assert.equal(live.trace().length, 5, '관문마다 한 번');
  assert.ok(gates.every((gate) => gate.recorded.eventId), '기록 먼저');
  assert.ok(gates.every((gate) => !gate.out.change || gate.out.change.knob === 'cruise'), '움직이는 손잡이는 속도뿐');
  // 같은 제시를 다시 관찰해도(이미 판정한 답이 몫을 썼다) 움직이지 않는다.
  const again = live.observe({ outcome: 'success', pressure: 0.1 }, gates.at(-1).pid);
  assert.equal(again.change, null);
  assert.equal(live.trace().length, 5, '같은 제시의 둘째 관찰은 몫이 없다');
  const end = live.end();
  assert.ok(end.settings.values.cruise <= start.cruise, '피곤한 날은 빨라지지 않는다');
  assert.ok(describeRace(start, end.settings.values).every((text) => !/맞춤 5문항/.test(text)), '문항 단계 안내 줄은 나오지 않는다');
  coach.dispose();
});

test('판을 다시 정하면 이번 판은 기록 없이 게임 차례로 잇고, 다음 판은 문을 다시 열어 새 겉 · 옛 길 · 기록 없이를 받는다', async () => {
  const { coach, time } = await engineCoach();
  const spy = traced(coach);
  let give = () => spy.coach;
  const { race, retire, win, door } = await throughDoor(spy.coach, { give: () => give() });
  const live = race.coach.live(FLOW_RACE, { words: FLOW_WORDS });
  const plan = race.begin(personal(), { progress: emptyProgress() });
  const first = runGates(race, { ...plan, size: 2, at: (i) => plan.at(i), line: (id) => plan.line(id) }, time, { live });
  assert.equal(first.length, 2);
  // 셋째 관문 앞에서 셸이 판을 다시 정했다.
  retire();
  assert.equal(race.retired, true);
  const before = spy.calls.length;
  for (let i = 2; i < 5; i += 1) {
    const q = plan.at(i);
    assert.ok(q, `관문 ${i + 1}은 게임 차례로 이어 간다`);
    const pid = live.present(racingItem(q));
    assert.equal(pid, null, '닫힌 겉에는 내지 않는다(기록 없이)');
    assert.equal(race.coach.present(racingItem(q)), null);
    assert.deepEqual(live.answer(pid, { correct: true, assessable: true }), { recorded: null, change: null, settings: null, line: null });
    assert.equal(race.coach.answer('p-gone', { correct: true, assessable: true }), null);
  }
  assert.deepEqual(plan.kinds().slice(2), ['game', 'game', 'game']);
  assert.doesNotThrow(() => plan.end());
  assert.equal(spy.calls.length, before, '닫힌 뒤에는 셸 코치에 닿지 않는다');
  assert.throws(() => live.settings(), { code: 'RUN_ENDED' });
  // 다음 판: 같은 문으로 다시 연다 — 새 겉.
  assert.equal(await race.reopen(), 'next');
  assert.equal(race.retired, false);
  const next = race.begin(personal(), { progress: emptyProgress() });
  const again = runGates(race, next, time);
  next.end();
  assert.ok(again.every((gate) => gate.recorded?.eventId), '다시 연 겉으로 기록한다');
  // 셸이 지금 판이라고 하면 옛 길, 패널이 닫혀 문이 치워졌으면 기록 없이.
  retire();
  give = () => null;
  assert.equal(await race.reopen(), 'old');
  retire();
  door.dispose();
  win.parent = win.top = { };
  assert.equal(await race.reopen(), 'ended');
  coach.dispose();
});

// 진짜 race-controller.js로 맞춤 판 한 판(WORLD 자전거 판). 3D · 소리 · 화면은 가짜이고, 학습 자리는 app.js의 새 길 차례와 같다
// (presentGate · answerGate · gateQuestion · followUps · endPlan).
function raceHarness(race, stage, time, { progress = emptyProgress() } = {}) {
  const nodes = new Map();
  const node = () => ({ hidden: true, disabled: false, textContent: '', firstChild: { textContent: '' }, style: {}, open: false,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, focus() {}, blur() {}, setAttribute() {}, showModal() { this.open = true; }, close() { this.open = false; } });
  const $ = (id) => { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); };
  const feedback = [];
  const hud = new Proxy({ answerQuestion: (value) => feedback.push(value) }, { get: (target, key) => target[key] ?? (() => {}) });
  const storage = { data: new Map(), getItem(k) { return this.data.get(k) ?? null; }, setItem(k, v) { this.data.set(k, String(v)); } };
  const car = { position: { y: 0 }, rotation: { z: 0 }, userData: { jets: [], vehicleKind: 'ride' } };
  // 상대는 멀리 세워 둔다(부딪혀 길이 바뀌면 그 답은 조작 실수로 남는다 — 이 시험은 학습 자리를 본다).
  const rivals = [0, 1].map((i) => ({ s: -1000 - i * 100, offset: LANES[i * 2], speed: 0, mesh: { visible: true, userData: { wheels: [] } } }));
  const narrator = { playing: false, activeKind: null, queue: [], cancel() {} };
  let live = null, plan = null, results = null;
  const learn = (action, fallback = null) => { try { return action(race.coach); } catch { return fallback; } };
  const controller = createRaceController({
    view: { $, hud, screenEl: node(), showScreen() {}, showRace() {}, openDialog() {}, closeDialog() {}, renderResults: (summary) => { results = summary; },
      renderLobby() {}, renderCollection() {}, syncSoundToggles() {}, hidden: () => false },
    sound: { narrator, speak() {}, quiet() {}, ensureAudio: async () => {}, ding() {}, contact() {}, engineCoast() {}, engineRace() {} },
    scene: { car: () => car, wheels: () => [], rivals: () => rivals, placeCar() {}, buildGate: () => ({ group: {}, fruitObjects: [] }), removeGate() {},
      applyEquipment() {}, hideRoundEffects() {}, resetCamera() {}, wrapCamera() {}, mascotMood() {}, contactSparks() {} },
    learning: {
      learn,
      presentGate(q) { const item = racingItem(q), why = plan?.line(q.id); if (why) state.laterToast = why; if (live) { try { return live.present(item); } catch { live = null; } } return learn((c) => c.present(item)); },
      answerGate(pid, response, flow) {
        if (live) { try { const out = live.answer(pid, response, flow); if (out.change?.knob === 'cruise') state.cruise = out.settings.values.cruise; return out.recorded; } catch { live = null; } }
        return learn((c) => c.answer(pid, response));
      },
      endLive() { const end = live?.end() ?? null; live = null; return end; },
      nextPersonalized: () => race.personal({ progress: state.progress }),
      learningScope: () => '',
      gateQuestion(index) { const q = plan?.at(index); if (q) state.questionBank[index] = q; },
      followUps: () => false,
      endPlan() { const current = plan; plan = null; current?.end(); },
    },
    rewards: { account: () => ({ status: () => ({ mode: 'guest' }) }), storage, loadGarage: () => loadGarage(storage), storeGarage() {}, wishText: () => '' },
    tutorial: { active: () => false, chooseLane() {}, tapLane() {}, render() {}, repeat() {}, delivered() {}, clearVoice() {} },
    coastRadio: { setState() {}, snapshot: () => ({ blocked: false }), prepare() {}, stop() {} },
    clock: { getDelta: () => 1 / 60 },
    track: RIDE_TRACK,
    state: { progress, selectedStage: stage, questionBank: makeQuestions(stage), garage: loadGarage(storage) },
  });
  const state = controller.state;
  return {
    controller, state, feedback, get results() { return results; },
    // app.js start(): 판을 열고(첫 관문은 reset에서 고른다) 순간 맞춤을 연다.
    start() {
      plan = race.begin(stage, { progress, random: () => 0.3 });
      live = race.coach.live(FLOW_RACE, { words: FLOW_WORDS });
      state.flowStart = live.settings().values;
      controller.reset(true);
      return plan;
    },
    // 달린다 — 관문이 열리면 소리를 끝까지 듣고(전달), choose(i, q)의 길로 옮겨 고른다.
    drive(choose = (_i, q) => q.answer, frames = 60 * 600) {
      for (let f = 0; f < frames && !state.finished; f += 1) {
        const gate = state.gate;
        if (gate?.announced && !gate.judged) {
          if (gate.readyAt == null) { race.coach.delivery(gate.presentationId, { audio: 'completed' }); controller.questionReady(); }
          if (!gate.intentChoice) {
            const lane = LANES[gate.types.indexOf(choose(state.gateIndex, gate.q))];
            state.playerOffset = lane; state.laneAim = lane; state.inputs.left = state.inputs.right = false;
            controller.chooseCurrentLane();
          }
        }
        controller.updateGame(1 / 60);
        time.advance(1000 / 60);
      }
    },
  };
}

test('진짜 race-controller로 맞춤 판 한 판 — 관문을 세울 때 고르고, 판 안 후속 바꿔 넣기 없이, 완주에 판을 닫는다', async () => {
  const { coach, port, time } = await engineCoach();
  const spy = traced(coach);
  const { race } = await throughDoor(spy.coach);
  const stage = personal();
  const x = raceHarness(race, stage, time);
  const plan = x.start();
  assert.equal(spy.names(['recommend']).length, 1, '첫 관문은 출발(reset)에서 고른다');
  const wrong = new Set([0, 3]);
  x.drive((i, q) => (wrong.has(i) ? wrongOf(q) : q.answer));
  assert.equal(x.state.finished, true, '완주');
  assert.equal(x.state.answers.length, 5);
  // 관문 하나마다 고르기 → 제시 → 답(앞 관문의 답을 본 뒤 다음 관문을 고른다 — 순간 맞춤 손잡이로), 완주에 판 닫기 한 번.
  const turns = ['recommend', 'present', 'answer', 'live.present', 'live.answer', 'finishSet'];
  assert.deepEqual(spy.names(turns), [...Array.from({ length: 5 }, () => ['recommend', 'live.present', 'live.answer']).flat(), 'finishSet']);
  assert.deepEqual(spy.calls.find((call) => call.name === 'finishSet').args[0], { record: false });
  const picked = x.state.questionBank.map((q) => q.id);
  assert.equal(new Set(picked).size, 5);
  assert.deepEqual(x.state.answers.map((a) => a.id), picked, '고른 문제로 달렸다');
  assert.deepEqual(plan.kinds(), Array(5).fill('engine'));
  // 판 안 후속 바꿔 넣기 · recheck 없음 — 틀려도 「비슷한 새 문제」 안내가 없고 recheck 칸이 비어 있다.
  assert.ok(x.feedback.every((value) => !/비슷한 새 문제/.test(value.why)));
  assert.ok(x.state.answers.every((a) => a.recheck === null));
  assert.deepEqual(x.state.answers.map((a) => a.correct), [false, true, true, false, true]);
  // 결과 화면: 이번 판의 문제와 독립 응답 수(처음 만난 · 도움 없이 고른 답).
  assert.equal(x.results.total, 5);
  assert.deepEqual(x.results.questions.map((q) => q.prompt), x.state.questionBank.map((q) => q.prompt));
  assert.match(x.results.learning, /^도움 없이 처음 고른 답 5개/);
  assert.ok(x.state.answers.every((a) => a.learning?.eventId && a.learning.independent === true));
  await Promise.all(x.state.answers.map((a) => a.learning.stored));
  await settle();
  const presented = await presentedOf(port);
  assert.deepEqual(presented.map((event) => event.itemKey), x.state.questionBank.map((q) => racingItem(q).itemKey));
  assert.ok(presented.every((event) => event.arm !== 'host'), '엔진이 고른 관문');
  // 판을 닫은 뒤 다음 맞춤 판(결과의 다음 코스)도 엔진에 묻지 않고 꼴만 짓는다.
  const asked = spy.calls.length;
  assert.equal(x.controller.nextStage()?.personalized, true);
  assert.equal(spy.calls.length, asked);
  coach.dispose();
});

test('진짜 race-controller로 정해진 코스 두 판 — 출발에서 판 길이를 넘긴 뒤 첫 관문을 내고, 완주에 닫고, 다시 달리면 다시 넘긴다', async () => {
  const { coach, time } = await engineCoach();
  const spy = traced(withStartSet(coach));
  const { race } = await throughDoor(spy.coach);
  const x = raceHarness(race, FINALES[0], time);
  for (let run = 0; run < 2; run += 1) {
    const plan = x.start();
    assert.equal(plan.personal, false);
    x.drive();
    assert.equal(x.state.finished, true, `${run + 1}판 완주`);
    assert.deepEqual(x.state.answers.map((a) => a.id), FINALES[0].items.map((q) => q.id), '코스의 차례 그대로');
  }
  const one = ['startSet', ...Array(5).fill('live.present'), 'finishSet'];
  assert.deepEqual(spy.names(['startSet', 'recommend', 'present', 'live.present', 'finishSet']), [...one, ...one]);
  assert.deepEqual(spy.calls.filter((call) => call.name === 'startSet').map((call) => [call.args[0], call.result.opened]), [[{ length: 5 }, true], [{ length: 5 }, true]]);
  coach.dispose();
});

test('원문 — 꺼진 판은 새 길 모듈을 싣지 않고 옛 코치를 지금 자리에서 같은 인수로 만든다', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/^import\s[^;]*?from\s+'([^']+)'/gm)].map((match) => match[1]);
  assert.ok(imports.includes('./kit/atlas-next.mjs'), '키트는 정의뿐이라 정적으로 싣는다');
  assert.ok(!imports.some((path) => path.includes('atlas-next-play')), '새 길 모듈은 정적 import에 없다');
  assert.equal([...source.matchAll(/import\('\.\/atlas-next-play\.mjs'\)/g)].length, 1, '새 길 모듈을 부르는 곳은 하나');
  assert.match(source, /async function openNextRace\(\) \{\s*try \{ nextRace = await \(await import\('\.\/atlas-next-play\.mjs'\)\)\.openRace\(/, '문 · 개발 깃발이 있을 때만 동적으로 부른다');
  assert.ok(source.includes("try { coach = globalThis.SynkLearning?.createGame({ gameId: 'korean-racing', storage: localStorage }) || null; } catch { learningAvailable = false; }"), '옛 코치는 지금과 같은 인수');
  assert.match(source, /\nif \(nextDoor\(window\) \|\| devFlag\(window\)\) learningOpening = openNextRace\(\); else openOldCoach\(\);\r?\n/, '문이 없으면 이 자리에서 동기로 옛 코치');
  assert.equal(source.includes('/atlas/'), false, '게임이 입구를 직접 부르지 않는다');
  // 이 폴더의 다른 파일도 새 길 모듈을 정적으로 싣지 않는다.
  for (const name of readdirSync(new URL('..', import.meta.url))) {
    if (!/\.(m?js)$/.test(name) || name === 'atlas-next-play.mjs') continue;
    const text = readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
    assert.ok(!/from\s+'\.\/atlas-next-play\.mjs'/.test(text), name);
  }
  // 새 길 모듈은 옛 길의 것(놓친 문제 바로 연습 · 판 안 후속 · recheck · 옛 요약 · events · 기록 지우기 · syncPort · 옛 추천)을 쓰지 않는다.
  const next = readFileSync(new URL('../atlas-next-play.mjs', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  for (const word of ['returnPractice', 'missedRacing', 'racingFollowUp', 'racingRecheck', 'personalizedStage', 'skillReport', 'events(', 'syncPort', 'reset(', 'recheck', 'assignment']) assert.equal(next.includes(word), false, word);
});
