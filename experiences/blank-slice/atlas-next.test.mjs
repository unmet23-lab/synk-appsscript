// 빈칸 베기의 새 길(Atlas 재설계 4-6d — 단계4_계획 §23-7 · §23-10 「게임」). 진짜 엔진 코치(손님 · 메모리 저장소)를 셸의 게임 문
// (synk-world-app/world-atlas-game.mjs createGameDoor)에 넣고, 문을 거친 그대로(인수 복제 · 고른 후보 되맞춤) atlas-next-play.mjs로 한 판씩 돈다.
// 보는 것: 문장마다 recommend(12문장 · 항목마다 4문장 이상 · 처음 판은 쉬운 문장) · 제시 → 답의 차례(전달 · 도움이 없는 읽기 문항) ·
// 판 끝 finishSet, none 뒤 게임 차례(이유 줄 없음 · 제품 차례) · idle이면 엔진의 채우기 · 한 제시가 Flow를 한 번만(두 번 던져도) ·
// 판을 다시 정하면 기록 없이 이어 감 · 문이 null이면 옛 길 · RUN_ENDED는 던짐. 끝에 원문 검사(꺼진 판은 새 길 모듈을 싣지 않는다).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { ITEMS, SKILL_LABEL } from './content.mjs';
import { composeRound } from './core.mjs';
import { createReadingConfirmation, FLOW_SLICE, FLOW_WORDS, GAME_ID, itemMetadata, sliceObservation } from './learning.mjs';
import { BANKS, SENTENCE_REASONS, openSlice } from './atlas-next-play.mjs';
import { ended } from './kit/atlas-next.mjs';
import { createGameDoor, GAME_BANKS } from '../synk-world-app/world-atlas-game.mjs';
// 원문 토막은 게임 모듈처럼 엄격 모드로 돌린다. 느슨한 모드(with)는 얼린 FLOW_ 값에 쓰는 줄을 조용히 넘겨, 게임에서만 던지는 줄을 시험이 놓친다
// (4-6e 첫 묶음 Fable F4). env의 이름이 토막의 바깥 이름이다 — 토막이 env에 없는 이름에 쓰면 시험이 던진다.
// 토막이 대입할 수 있는 이름은 게임 모듈이 맨 위 let으로 둔 것뿐이다(module — 그 게임 모듈의 원문). 나머지(가져온 FLOW_ 값 · const · 함수)는 const로
// 묶어 다시 대입하면 게임 모듈처럼 던진다(4-6e-2 검수 GA1 · 새 사슬 GA2).
// 이름은 글이 아니라 구문(acorn)으로 읽는다 — 초기값 속의 이름은 선언이 아니다(사슬 -d F1).
const acorn = createRequire(import.meta.url)('acorn');
const topLets = module =>
  new Set(acorn.parse(module, { ecmaVersion: 'latest', sourceType: 'module' }).body.flatMap(node => (node.type === 'VariableDeclaration' && node.kind !== 'const' ? node.declarations.map(({ id }) => id.name) : [])));
const strictEnv = (body, module) => env => {
  const names = Object.keys(env);
  const lets = topLets(module);
  const free = names.filter(name => lets.has(name));
  const fixed = names.filter(name => !free.includes(name));
  return new Function('__env', ...free, `'use strict';\nconst { ${fixed.join(', ')} } = __env;\n${body}`)(env, ...free.map(name => env[name]));
};

const atlas = await import('../../packages/atlas/src/index.mjs');
const json = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
// 낱말 이름까지 — 셸이 여는 코치는 은행 조각의 낱말 줄로 「방금 놓친 「…」」의 이름을 세운다.
const mapData = { index: json('../../packages/atlas/map/index.json'), units: json('../../packages/atlas/map/units.json'), words: json('../../packages/atlas/map/words.json') };
const T0 = Date.UTC(2026, 10, 19, 1, 0, 0);   // 서울 오전 10시
const clock = (start = T0) => { const s = { t: start }; return { now: () => s.t, advance: (ms) => { s.t += ms; } }; };
let stores = 0;
const newKey = () => `synk-atlas:blank-slice-test-${process.pid}-${(stores += 1)}`;
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
  const door = createGameDoor({ entry, gameId: 'blank-slice', later: (fn) => fn() });
  const top = { SYNKAtlasGame: door.api };
  const win = { parent: top, top, addEventListener: () => {}, location: { hostname: 'synk.im', search: '' } };
  const slice = await openSlice({ win });
  return { slice, door, win, retire: () => [...retirers].forEach((fn) => fn({ reason: 'account' })) };
}

// app.mjs의 문장 하나와 같은 차례: 문장을 그때 고르고 → 제시(createReadingConfirmation) → 던지기(못 베면 한 번 더) → 답 하나.
//   way(i, item): 'slice'(한 번에 벰) · 'miss'(두 번 다 놓치고 멈춘 보기에서 고름) · 'late'(한 번 놓치고 두 번째에 벰) · 'quit'(답 없이 그만둠)
//   choose(i, item): 벤 말 · 고른 말. flow가 있으면 던질 때마다 순간 맞춤에 그 문장의 제시 번호와 함께 넘긴다(app.mjs followFlow).
function playRound(slice, plan, time, { way = () => 'slice', choose = (_i, item) => item.answer, flow = null } = {}) {
  const sentences = [];
  const toss = (check, word, item) => (flow ? slice.observe(flow, check.pid, sliceObservation({ word, answer: item.answer, used: 0.4 })) : null);
  for (let i = 0; i < plan.size; i += 1) {
    const item = plan.at(i);
    if (!item) break;
    const check = createReadingConfirmation(slice.coach, item);
    const how = way(i, item);
    const choice = choose(i, item);
    const seen = [];
    time.advance(2000);
    let rec = null;
    if (how === 'slice') { rec = check.confirm(choice); seen.push(toss(check, choice, item)); }
    if (how === 'late') { seen.push(toss(check, null, item)); time.advance(1500); rec = check.confirm(choice); seen.push(toss(check, choice, item)); }
    if (how === 'miss') { seen.push(toss(check, null, item)); time.advance(1500); seen.push(toss(check, null, item)); time.advance(3000); rec = check.confirm(choice); }
    if (how === 'quit') rec = check.cancel();
    time.advance(800);
    sentences.push({ item, pid: check.pid, rec, seen, line: plan.line(i) });
  }
  return sentences;
}

// 저장소의 사건(메모리 포트의 줄 { key, value: { kind: 'event', event } }).
const eventsOf = async (port) => (await port.read()).map((row) => row.value).filter((value) => value?.kind === 'event').map((value) => value.event);
const presentedOf = async (port) => (await eventsOf(port)).filter((event) => event.type === 'practice.presented');
const skillsOf = (queue) => Object.fromEntries(Object.keys(SKILL_LABEL).map((skill) => [skill, queue.filter((item) => item.skill === skill).length]));

test('은행 이름은 셸의 게임 은행 표와 같다', () => {
  assert.deepEqual([...BANKS], [...GAME_BANKS['blank-slice']]);
});

test('문이 없으면 null(옛 길), 셸이 지금 판이면 null, 문이 닫히는 중이면 RUN_ENDED를 그대로 던진다', async () => {
  assert.equal(await openSlice({ win: { parent: null, top: null, location: { hostname: 'synk.im', search: '?atlas=next' } } }), null, '공개 주소는 개발 깃발을 읽지 않는다');
  const old = await throughDoor(null, { give: () => null });
  assert.equal(old.slice, null);
  // 기다리던 open이 패널 닫힘으로 끝나면 null이 아니라 RUN_ENDED — 게임은 옛 길을 열지 않는다.
  let release;
  const { coach } = await engineCoach();
  const entry = { gameCoach: () => new Promise((resolve) => (release = () => resolve(coach))), retired: () => () => {} };
  const door = createGameDoor({ entry, gameId: 'blank-slice', later: (fn) => fn() });
  const top = { SYNKAtlasGame: door.api };
  const opening = openSlice({ win: { parent: top, top, addEventListener() {} } });
  door.dispose(); release();
  const error = await opening.then(() => null, (caught) => caught);
  assert.equal(error?.code, 'RUN_ENDED');
  assert.equal(ended(error), true, '틀에서는 code로만 가른다');
  coach.dispose();
});

test('빈 기억 손님의 처음 판 — 문장마다 recommend, 쉬운 문장 12개에 항목마다 4문장 이상, 제시 → 답 차례, 판 끝 finishSet', async () => {
  const { coach, port, time } = await engineCoach();
  const spy = traced(coach);
  const { slice } = await throughDoor(spy.coach);
  const plan = slice.round({ firstTime: true, seed: 1 });
  assert.equal(plan.size, 12);
  assert.equal(plan.pool.every((item) => item.difficulty === 1), true, '처음 판은 쉬운 문장만 후보');
  assert.equal(plan.pool.length, ITEMS.filter((item) => item.difficulty === 1).length, '은행에 다 있다');
  const wrong = new Set([0, 4]), missed = new Set([2]), late = new Set([7]);
  const way = (i) => (missed.has(i) ? 'miss' : late.has(i) ? 'late' : 'slice');
  const sentences = playRound(slice, plan, time, { way, choose: (i, item) => (wrong.has(i) ? item.options[1] : item.answer) });
  assert.equal(sentences.length, 12);
  assert.equal(new Set(plan.queue).size, 12, '한 판에 같은 문장은 한 번');
  assert.equal(plan.queue.every((item) => item.difficulty === 1), true);
  for (const [skill, n] of Object.entries(skillsOf(plan.queue))) assert.ok(n >= 4, `${skill} ${n}문장`);
  assert.deepEqual(sentences.map((one) => one.rec.verdict), sentences.map((_, i) => (wrong.has(i) ? 'incorrect' : 'correct')), '벤 말 · 멈춘 보기의 답 하나');
  // 문장마다 recommend → present 한 쌍이고, 판 옵션은 길이 12 · 새것 한도 36이다(읽기 문항이라 소리 옵션은 없다).
  const results = spy.calls.filter((call) => call.name === 'recommend').map((call) => call.result);
  const names = spy.names().filter((name) => ['recommend', 'present', 'finishSet'].includes(name));
  assert.deepEqual(names, Array.from({ length: 12 }, () => ['recommend', 'present']).flat());
  const asked = spy.calls.find((call) => call.name === 'recommend');
  assert.deepEqual(asked.args[1], { set: { length: 12, newLimit: 36 } });
  assert.ok(asked.args[0].every((row) => typeof row.itemKey === 'string' && row.itemId), '후보는 자료만 — 문을 지난다');
  assert.equal(asked.args[0].length, plan.pool.length, '첫 문장의 후보는 남은 문장 전부');
  // 엔진이 고른 문장은 엔진 차례, none이면 게임 차례.
  results.forEach((result, i) => assert.equal(plan.kinds()[i], result.status === 'none' ? 'game' : 'engine', `문장 ${i + 1}`));
  assert.equal(results[0].status, 'ready', '빈 기억 손님의 첫 문장은 엔진이 고른다');
  // 엔진이 고른 문장에만, 다시 만나는 말일 때만 이유 줄이 붙는다.
  sentences.forEach((one, i) => assert.equal(one.line, plan.kinds()[i] === 'engine' && SENTENCE_REASONS.includes(results[i].why?.code) ? results[i].why.line : null, `문장 ${i + 1}`));
  plan.end();
  assert.deepEqual(spy.calls.filter((call) => call.name === 'finishSet').map((call) => call.args[0]), [{ record: false }], '판 끝에 기록 없이 닫는다');
  plan.end();
  assert.equal(spy.names().filter((name) => name === 'finishSet').length, 1, '두 번 닫지 않는다');
  await Promise.all(sentences.map((one) => one.rec.stored));
  await settle();
  // 사건의 차례: 제시마다 제시 → 답 하나(두 번 던져도 · 멈춘 보기에서 골라도).
  const rows = await eventsOf(port);
  const presented = rows.filter((event) => event.type === 'practice.presented');
  assert.deepEqual(presented.map((event) => event.itemKey), plan.queue.map((item) => itemMetadata(item).itemKey));
  presented.forEach((event, i) => assert.equal(event.arm === 'host', plan.kinds()[i] === 'game', `문장 ${i + 1}: 엔진이 고른 제시는 adaptive`));
  for (const [i, event] of presented.entries()) {
    const group = rows.filter((row) => row.presentationId === event.id).map((row) => row.type);
    assert.deepEqual(group, ['practice.attempted'], `문장 ${i + 1}`);
  }
  coach.dispose();
});

test('그만두면 풀던 문장은 평가하지 않는 답으로 닫고, 판은 그 뒤에 기록 없이 닫는다', async () => {
  const { coach, port, time } = await engineCoach();
  const spy = traced(coach);
  const { slice } = await throughDoor(spy.coach);
  const plan = slice.round({ firstTime: true, seed: 1 });
  const done = playRound(slice, { ...plan, size: 3, at: plan.at, line: plan.line }, time, { way: (i) => (i === 2 ? 'quit' : 'slice') });
  assert.deepEqual(done.map((one) => one.rec.verdict), ['correct', 'correct', 'unassessed']);
  plan.end();
  const order = spy.names().filter((name) => ['answer', 'finishSet'].includes(name));
  assert.deepEqual(order, ['answer', 'answer', 'answer', 'finishSet'], '그만둔 문장의 답 뒤에 판을 닫는다');
  await settle();
  const attempts = (await eventsOf(port)).filter((event) => event.type === 'practice.attempted');
  assert.equal(attempts.length, 3);
  coach.dispose();
});

test('같은 날 다른 게임이 새 말 한도를 다 쓰면 첫 문장부터 none — 게임 차례로 12문장을 끝까지, 이유 줄 없이 제품 차례로 낸다', async () => {
  const port = atlas.memoryPort(), key = newKey(), time = clock();
  // 같은 저장소의 다른 게임(말 랠리)이 빈칸 베기와 단위가 겹치지 않는 문항으로 그날의 새 단위 한도를 쓴다.
  const map = atlas.openMap(mapData);
  const sliceUnits = new Set(map.items('blank-slice').flatMap((item) => item.units));
  const pool = map.items('talk-rally').filter((item) => item.units.every((unit) => !sliceUnits.has(unit))).map((item) => ({ itemKey: item.itemKey }));
  const other = (await engineCoach({ gameId: 'talk-rally', port, key, time })).coach;
  for (let i = 0; i < 40; i += 1) {
    const picked = other.recommend(pool, { set: { length: 40, newLimit: 120 } });
    if (picked.status !== 'ready') break;
    const pid = other.present(picked.selected); time.advance(3000);
    other.answer(pid, { correct: true, assessable: true }); time.advance(3000);
  }
  other.finishSet({ record: false });
  const { coach } = await engineCoach({ port, key, time });
  const spy = traced(coach);
  const { slice } = await throughDoor(spy.coach);
  const plan = slice.round({ firstTime: false, seed: 3 });
  const sentences = playRound(slice, plan, time);
  assert.equal(sentences.length, 12, 'none이어도 놀이는 멈추지 않는다');
  for (const [skill, n] of Object.entries(skillsOf(plan.queue))) assert.ok(n >= 4, `${skill} ${n}문장`);
  const results = spy.calls.filter((call) => call.name === 'recommend').map((call) => call.result);
  assert.equal(results.length, 12);
  assert.equal(results[0].status, 'none', '같은 날 넷째 게임 — 첫 추천부터 none');
  results.forEach((result, i) => assert.equal(plan.kinds()[i], result.status === 'none' ? 'game' : 'engine', `문장 ${i + 1}`));
  const none = results.map((result, i) => [result.status, i]).filter(([status]) => status === 'none').map(([, i]) => i);
  assert.ok(none.length >= 8, `none ${none.length}번`);
  // 게임 차례는 게임 순서(옛 판이 아틀라스 순서 없이 짜던 판, 그다음 나머지)에서 그 고르기의 후보에 든 첫 문장이다.
  const order = [...new Set([...composeRound(ITEMS, { seed: 3 }), ...composeRound(ITEMS, { seed: 3, size: ITEMS.length })])];
  const lists = spy.calls.filter((call) => call.name === 'recommend').map((call) => call.args[0]);
  for (const i of none) {
    assert.equal(sentences[i].line, null, '게임 차례 문장에는 이유 줄이 없다');
    assert.equal(plan.queue[i], order.find((item) => lists[i].some((row) => row.itemId === item.id)), `문장 ${i + 1}은 게임 순서`);
  }
  assert.equal(plan.queue[0], composeRound(ITEMS, { seed: 3 })[0], '첫 문장은 옛 판이 아틀라스 순서 없이 짜던 판의 첫 문장');
  assert.equal(plan.end(), results.find((result) => result.status === 'none' && ['day.capped', 'pace.stubborn'].includes(result.why?.code))?.why.line ?? null, '판 끝 한 줄은 엔진이 멈춘 까닭의 문장');
  await Promise.all(sentences.map((one) => one.rec.stored));
  await settle();
  const presented = (await presentedOf(port)).filter((event) => event.itemKey.startsWith('blank-slice.'));
  assert.equal(presented.length, 12);
  for (const i of none) assert.ok(presented[i].arm === 'host' && presented[i].reason.code === 'host.order', `문장 ${i + 1}은 제품 차례로 남는다`);
  other.dispose(); coach.dispose();
});

test('같은 날 둘째 판 — idle(채우기)은 엔진이 고른 문장, none은 게임 차례이고, 항목마다 4문장 최소를 지킨다', async () => {
  const { coach, port, time } = await engineCoach();
  const spy = traced(coach);
  const { slice } = await throughDoor(spy.coach);
  const first = slice.round({ firstTime: true, seed: 1 });
  playRound(slice, first, time, { choose: (i, item) => (i % 4 === 0 ? item.options[2] : item.answer) });
  first.end();
  time.advance(60_000);
  const from = spy.calls.length;
  const second = slice.round({ firstTime: false, seed: 2 });
  assert.equal(second.pool.length, ITEMS.length, '둘째 판은 모든 문장이 후보');
  const sentences = playRound(slice, second, time);
  assert.equal(sentences.length, 12);
  for (const [skill, n] of Object.entries(skillsOf(second.queue))) assert.ok(n >= 4, `${skill} ${n}문장`);
  const results = spy.calls.slice(from).filter((call) => call.name === 'recommend').map((call) => call.result);
  const idle = results.map((result, i) => [result, i]).filter(([result]) => result.status === 'idle').map(([, i]) => i);
  assert.ok(idle.length > 0, '둘째 판에 채우기가 선다 — 아래 단언이 돈다(끝 판 F6 ⑤)');
  for (const i of idle) {
    assert.equal(second.kinds()[i], 'engine', `문장 ${i + 1}: idle은 엔진이 고른 문장(§23-6)`);
    assert.equal(second.queue[i].id, results[i].selected.itemId, '엔진의 채우기 그대로');
    assert.equal(second.line(i), null, '「다 만났어요」는 문장마다 말하지 않는다');
  }
  results.forEach((result, i) => assert.equal(second.kinds()[i], result.status === 'none' ? 'game' : 'engine', `문장 ${i + 1}`));
  assert.ok(results.some((result) => result.status !== 'ready'), '하루 새것 한도 · 판 몫이 찬 뒤에는 엔진이 채우거나 게임 차례로 넘긴다');
  // 좁힘: 후보 목록이 한 항목뿐인 고르기는 그 항목이 모자란 자리에서만.
  const asked = spy.calls.slice(from).filter((call) => call.name === 'recommend').map((call) => call.args[0]);
  asked.forEach((list, i) => {
    const kinds = new Set(list.map((row) => row.skillIds[0]));
    if (kinds.size === 1) {
      const before = skillsOf(second.queue.slice(0, i));
      const owed = Object.values(before).reduce((sum, n) => sum + Math.max(0, 4 - n), 0);
      assert.ok(owed >= 12 - i, `문장 ${i + 1}: 모자란 항목을 채울 자리만 남았을 때만 좁힌다`);
    }
  });
  second.end();
  await settle();
  const presented = (await presentedOf(port)).slice(12);
  idle.forEach((i) => assert.notEqual(presented[i].arm, 'host', '채우기는 엔진의 줄로 남는다'));
  coach.dispose();
});

test('항목 최소 — 엔진이 한 항목만 고르면 다른 항목 4문장을 채울 자리만 남을 때 후보를 그 항목으로 좁힌다', async () => {
  // 조사 · 문형만 고르는 코치(문을 거친다) — 여덟 문장 뒤에는 낱말 문장만 후보로 받아야 한다.
  const lists = [];
  const fake = {
    recommend: (list) => {
      lists.push(list);
      const row = list.find((one) => one.skillIds[0] === 'ko.reading.grammar') ?? list[0];
      return { status: 'ready', selected: row, why: { code: 'unit.new', line: null } };
    },
    itemUnits: () => [{ unit: 'ko.word.w0001', kind: 'word', label: null }],
    finishSet: () => true,
  };
  const { slice } = await throughDoor(fake);
  const plan = slice.round({ firstTime: false, seed: 5 });
  for (let i = 0; i < 12; i += 1) assert.ok(plan.at(i));
  assert.deepEqual(plan.queue.map((item) => item.skill), [...Array(8).fill('ko.reading.grammar'), ...Array(4).fill('ko.reading.vocabulary')]);
  lists.forEach((list, i) => {
    const kinds = new Set(list.map((row) => row.skillIds[0]));
    assert.deepEqual([...kinds].sort(), i < 8 ? Object.keys(SKILL_LABEL).sort() : ['ko.reading.vocabulary'], `문장 ${i + 1}의 후보`);
  });
  assert.equal(plan.at(12), null, '12문장 뒤에는 고르지 않는다');
  plan.end();
});

test('순간 맞춤 — 조각 시간과 오늘을 읽고, 한 제시는 Flow를 한 번만 움직인다(두 번 던져도)', async () => {
  const { coach, port, time } = await engineCoach({ prefs: { today: () => 'tired' } });
  const { slice } = await throughDoor(coach);
  assert.equal(slice.coach.today(), 'tired');
  const flow = slice.coach.live(FLOW_SLICE, { words: FLOW_WORDS });
  assert.equal(flow.intro().line?.text, FLOW_WORDS['start.tired']);
  assert.ok(flow.settings().values.hang >= 1, '피곤한 날은 조각이 오래 떠 있게 시작한다');
  const plan = slice.round({ firstTime: true, seed: 1 });
  const twice = new Set([1, 5, 9]);
  const sentences = playRound(slice, plan, time, { flow, way: (i) => (twice.has(i) ? (i === 9 ? 'late' : 'miss') : 'slice') });
  assert.equal(flow.trace().length, 12, '문장마다 한 번 — 두 번째 던지기는 몫이 없다');
  for (const i of twice) assert.equal(sentences[i].seen[1].change, null, `문장 ${i + 1}의 두 번째 던지기`);
  // 같은 제시를 다시 관찰해도 움직이지 않는다.
  const last = sentences.at(-1);
  const again = slice.observe(flow, last.pid, sliceObservation({ word: last.item.answer, answer: last.item.answer, used: 0.1 }));
  assert.equal(again.change, null);
  assert.equal(flow.trace().length, 12);
  // 피곤한 날은 빨라지지 않는다.
  for (let i = 0; i < 14; i += 1) {
    const item = plan.queue[i % 12];
    const one = createReadingConfirmation(slice.coach, item);
    const out = slice.observe(flow, one.pid, sliceObservation({ word: item.answer, answer: item.answer, used: 0.2 }));
    assert.ok(!out.change || out.change.direction < 0, '피곤한 날은 빨라지지 않는다');
    one.cancel();
  }
  assert.equal(flow.trace().length, 26);
  plan.end();
  flow.end();
  await settle();
  // 베기는 읽기 기록이 아니다 — 답은 문장마다 하나.
  const attempts = (await eventsOf(port)).filter((event) => event.type === 'practice.attempted');
  assert.equal(attempts.length, 12 + 14);
  coach.dispose();
});

/* ── 순간 맞춤 진입(4-6e-2 — 설계 주인 11-21) ── */
// app.mjs의 startFlow를 원문 그대로 돌린다(atlas 감싸기 한 줄과 함께). 셸 코치의 live는 가짜다 — 문이 옮겨 온 인자(spec, options)를 적고
// 진짜 엔진 코치의 live에 넘긴다(엔진은 거기서 내용을 정의하고, 막기에 걸리면 던진다). 엔진이 던지면 적어 두고 그대로 던진다. atlas
// 감싸기는 그 던짐을 삼키고 순간 맞춤만 끄므로, 시험은 적힌 던짐과 adaptive로 본다.
function liveSpy(coach) {
  const got = [];
  const shell = {};
  for (const name of Object.keys(coach)) if (typeof coach[name] === 'function') shell[name] = (...args) => coach[name](...args);
  shell.live = (spec, options) => {
    const row = { spec, options, error: null, adaptive: null };
    got.push(row);
    try {
      const handle = coach.live(spec, options);
      row.adaptive = handle.settings().adaptive;
      return handle;
    } catch (error) {
      row.error = error;
      throw error;
    }
  };
  return { shell, got };
}
function flowStarter() {
  const text = readFileSync(new URL('./app.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const wrap = text.indexOf('const atlas = (fn, fallback = null) =>');
  const from = text.indexOf('function startFlow() {');
  const to = text.indexOf('function endFlow()', from);
  assert.ok(wrap >= 0 && from >= 0 && to > from, 'app.mjs의 순간 맞춤 열기 토막');
  const body = `${text.slice(wrap, text.indexOf('\n', wrap))}\n${text.slice(from, to)}`;
  return strictEnv(`${body}\nreturn () => { const line = startFlow(); return { flow: state.flow, line }; };`, text);
}

test('순간 맞춤 진입 — app.mjs가 판마다 넘긴 내용을 진짜 엔진이 정의하고 조각 시간의 순간 맞춤이 켜진다(WORLD 말투로 바꾼 줄도)', async () => {
  for (const world of [null, { say: (text) => `${text} ` }]) {
    const { coach } = await engineCoach();
    const { shell, got } = liveSpy(coach);
    const { slice } = await throughDoor(shell);
    const env = { coach: slice.coach, state: { flow: null, tired: false }, world, say: world ? world.say : (text) => text, FLOW_SLICE, FLOW_WORDS };
    const opened = flowStarter()(env)();
    assert.equal(got.length, 1, '판마다 순간 맞춤 하나');
    assert.equal(got[0].spec.id, FLOW_SLICE.id);
    assert.equal(got[0].error, null, `진짜 엔진이 받지 않은 내용 — 게임은 삼키고 순간 맞춤만 꺼진다: ${got[0].error?.message}`);
    assert.equal(got[0].adaptive, true, '판은 조각 시간의 순간 맞춤이 켜진다');
    assert.ok(opened.flow, '게임이 순간 맞춤 겉을 쥔다');
    assert.equal(opened.flow.settings().values.hang, 1, '처음은 원래 게임(1배)');
    assert.equal(got[0].options.words['raise.pace'], world ? `${FLOW_WORDS['raise.pace']} ` : FLOW_WORDS['raise.pace']);
    coach.dispose();
  }
});

test('판을 다시 정하면 이번 판은 기록 없이 잇고, 다음 판은 문을 다시 열어 새 겉을 받는다', async () => {
  const { coach, time } = await engineCoach();
  const spy = traced(coach);
  const { slice, retire, win } = await throughDoor(spy.coach);
  const round = slice.round({ firstTime: true, seed: 1 });
  for (let i = 0; i < 4; i += 1) { const item = round.at(i); createReadingConfirmation(slice.coach, item).confirm(item.answer); time.advance(3000); }
  // 다섯째 문장 앞에서 셸이 판을 다시 정했다.
  retire();
  assert.equal(slice.retired, true);
  const before = spy.calls.length;
  for (let i = 4; i < 12; i += 1) {
    const item = round.at(i);
    assert.ok(item, `문장 ${i + 1}은 게임 차례로 이어 간다`);
    let error = null;
    try { createReadingConfirmation(slice.coach, item); } catch (caught) { error = caught; }
    assert.equal(ended(error), true, '닫힌 겉은 RUN_ENDED — 게임은 기록 없이 잇는다');
  }
  assert.deepEqual(round.kinds().slice(4), Array(8).fill('game'));
  for (const [skill, n] of Object.entries(skillsOf(round.queue))) assert.ok(n >= 4, `${skill} ${n}문장`);
  assert.equal(spy.calls.length, before, '닫힌 뒤에는 셸 코치에 닿지 않는다');
  assert.doesNotThrow(() => round.end());
  assert.throws(() => slice.coach.live(FLOW_SLICE, { words: FLOW_WORDS }), { code: 'RUN_ENDED' });
  // 다음 판: 같은 문으로 다시 연다 — 새 겉.
  const fresh = await openSlice({ win });
  assert.ok(fresh);
  assert.equal(fresh.retired, false);
  const next = fresh.round({ firstTime: false, seed: 2 });
  assert.ok(createReadingConfirmation(fresh.coach, next.at(0)).pid);
  next.end();
  coach.dispose();
});

test('원문 — 꺼진 판은 새 길 모듈을 싣지 않고 옛 코치를 지금 자리에서 같은 인수로 만든다', () => {
  const source = readFileSync(new URL('./app.mjs', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/^import\s[^;]*?from\s+'([^']+)'/gm)].map((match) => match[1]);
  assert.ok(imports.includes('./kit/atlas-next.mjs'), '키트는 정의뿐이라 정적으로 싣는다');
  assert.ok(!imports.some((path) => path.includes('atlas-next-play')), '새 길 모듈은 정적 import에 없다');
  assert.equal([...source.matchAll(/import\('\.\/atlas-next-play\.mjs'\)/g)].length, 1, '새 길 모듈을 부르는 곳은 하나');
  assert.match(source, /async function openNextCoach\(\) \{[\s\S]{0,120}?slice = await \(await import\('\.\/atlas-next-play\.mjs'\)\)\.openSlice\(/, '문 · 개발 깃발이 있을 때만 동적으로 부른다');
  assert.ok(source.includes("try { coach = window.SynkLearning?.createGame({ gameId: GAME_ID, storage: window.localStorage }) || null; } catch { coach = null; }"), '옛 코치는 지금과 같은 인수');
  assert.match(source, /const atlasNext = !!\(nextDoor\(window\) \|\| devFlag\(window\)\);[\s\S]{0,400}?\r?\nif \(atlasNext\) coachOpening = openNextCoach\(\); else openOldCoach\(\);/, '문이 없으면 이 자리에서 동기로 옛 코치');
  assert.equal(/await openNextCoach\(\)/.test(source), false, '맨 위에서 셸의 코치를 기다리지 않는다(입구를 먼저 그린다)');
  assert.equal(source.includes('/atlas/'), false, '게임이 입구를 직접 부르지 않는다');
  // 이 폴더의 다른 파일도 새 길 모듈을 정적으로 싣지 않는다.
  for (const name of readdirSync(new URL('.', import.meta.url))) {
    if (!/\.(m?js)$/.test(name) || name === 'atlas-next-play.mjs' || name.endsWith('.test.mjs')) continue;
    const text = readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');
    assert.ok(!/from\s+'\.\/atlas-next-play\.mjs'/.test(text), name);
  }
  // 새 길 모듈은 옛 길의 것(return-practice · 옛 요약 · events · 기록 지우기 · syncPort · 과제)을 쓰지 않는다.
  const next = readFileSync(new URL('./atlas-next-play.mjs', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  for (const word of ['returnPractice', 'missedPractice', 'skillReport', 'rankItems', 'events(', 'syncPort', 'reset(', 'recheck', 'assignment']) assert.equal(next.includes(word), false, word);
});

test('원문 토막은 엄격 모드로 돈다 — 얼린 FLOW_ 값에 쓰는 줄은 시험에서도 던진다(느슨한 with는 조용히 넘긴다, 4-6e 첫 묶음 Fable F4)', () => {
  const write = 'FLOW_SLICE.id = "바꿈";\nreturn FLOW_SLICE.id;';
  assert.throws(() => strictEnv(write, '')({ FLOW_SLICE }), TypeError);
  assert.equal(new Function('env', `with (env) {\n${write}\n}`)({ FLOW_SLICE }), FLOW_SLICE.id, '느슨한 모드는 쓰기를 삼킨다 — 위 단정이 가르는 꼴');
  assert.throws(() => strictEnv('없는이름 = 1;', '')({}), ReferenceError);
  assert.throws(() => strictEnv('FLOW_SLICE = null;', '')({ FLOW_SLICE }), TypeError, '가져온 이름을 다시 대입하면 던진다(GA1)');
  assert.equal(strictEnv('coach = 2;\nreturn coach;', 'let coach = null;\n')({ coach: 1 }), 2, '모듈 맨 위의 let은 대입할 수 있다');
  assert.equal(strictEnv('b = 2;\nreturn b;', 'let a = null, b = 1;\n')({ b: 1 }), 2, '한 줄에 둔 둘째 let도 같다');
  assert.equal(strictEnv('b = 2;\nreturn b;', 'let a = f(1, { x: [2, 3] }), b;\n')({ b: 1 }), 2, '초기값 뒤의 둘째 let도 같다');
  assert.throws(() => strictEnv('state = 9;', 'const state = {};\nlet rows = [first, state, last];\n')({ state: 1 }), TypeError, '초기값 속의 이름은 let이 아니다(사슬 -d F1)');
  // 소문자 const를 다시 대입하면 게임 모듈에서 던진다 — 시험도 던진다(새 사슬 GA2). 함수 안의 let은 모듈 이름이 아니다.
  assert.throws(() => strictEnv('state = null;', 'const state = {};\n')({ state: 1 }), TypeError);
  assert.throws(() => strictEnv('state = null;', 'const state = {};\nfunction f() {\n  let state = 1;\n}\n')({ state: 1 }), TypeError);
});
