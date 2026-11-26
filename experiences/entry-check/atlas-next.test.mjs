// 입장 검사의 새 길(Atlas 재설계 4-6d — 단계4_계획 §23-7 · §23-10 「게임」). 진짜 엔진 코치(손님 · 메모리 저장소)를 셸의 게임 문
// (synk-world-app/world-atlas-game.mjs createGameDoor)에 넣고, 문을 거친 그대로(인수 복제 · 고른 후보 되맞춤) atlas-next-play.mjs로 근무를 돈다.
// 보는 것: 손님이 올 때마다 recommend(손님 6명 · 근무의 약속 — 규칙마다 위반 손님 · 통과 손님 · 알림 전후 · 도착 시각 차례) · 제시 → 도움 → 답의
// 차례 · 근무 끝 finishSet, none 뒤 게임 차례(composeShift 그대로 · 이유 줄 없음 · 제품 차례) · idle이면 엔진의 채우기 · 놓친 단위의 이유 줄 ·
// 연수는 present만(첫 손님 전에 판 길이를 startSet으로 — 판을 닫고 다음 연수를 열 때 다시) · 한 손님 연습(보여 준 손님은 exposures로 거름) · 한 제시가 Flow를 한 번만 · 판을 다시 정하면 기록 없이 이어 감 ·
// 은행 밖 손님은 내지 않음 · 문이 null이면 옛 길 · RUN_ENDED는 던짐.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { VENUES } from './content.mjs';
import { TUTORIAL_CASES } from './narration.mjs';
import { composeShift, memoActive, minutes } from './core.mjs';
import { FLOW_ENTRY, FLOW_WORDS, GAME_ID, answerPayload, caseMetadata, magnifierAfter } from './learning.mjs';
import { choiceId } from './correction.mjs';
import { BANKS, GUEST_REASONS, createShiftCoach, openShiftCoach } from './atlas-next-play.mjs';
import { ended, namelessLine } from './kit/atlas-next.mjs';
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
const mapData = { index: json('../../packages/atlas/map/index.json'), units: json('../../packages/atlas/map/units.json') };
const T0 = Date.UTC(2026, 10, 19, 1, 0, 0);   // 서울 오전 10시
const clock = (start = T0) => { const s = { t: start }; return { now: () => s.t, advance: (ms) => { s.t += ms; } }; };
let stores = 0;
const newKey = () => `synk-atlas:entry-check-test-${process.pid}-${(stores += 1)}`;
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));
const venue = (id) => VENUES.find((v) => v.id === id);

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
  const door = createGameDoor({ entry, gameId: 'entry-check', later: (fn) => fn() });
  const top = { SYNKAtlasGame: door.api };
  const win = { parent: top, top, addEventListener: () => {}, location: { hostname: 'synk.im', search: '' } };
  const shifts = await openShiftCoach({ win });
  return { shifts, door, win, retire: () => [...retirers].forEach((fn) => fn({ reason: 'account' })) };
}

// app.mjs의 손님 하나와 같은 차례: 손님이 올 때 고르고(plan.at) → 제시(순간 맞춤이 있으면 그 겉으로) → 도움(있으면) → 도장(답).
// choose(i, item) → 고른 도장('pass' 또는 규칙 id). 기본은 정답.
function playShift(shifts, plan, time, { choose = (_i, item) => item.answer, help = () => null, flow = null } = {}) {
  const guests = [];
  for (let i = 0; i < plan.size; i += 1) {
    const item = plan.at(i);
    if (!item) break;
    const meta = caseMetadata(item);
    const pid = flow ? flow.present(meta) : shifts.coach.present(meta);
    time.advance(4000);
    const kind = help(i, item);
    if (kind) shifts.coach.help(pid, kind);
    time.advance(4000);
    const choice = choose(i, item);
    const payload = answerPayload(choice === item.answer, { selectedId: choiceId(choice), correctId: choiceId(item.answer) });
    const out = flow ? flow.answer(pid, payload, { latencyMs: 8000 }) : null;
    const rec = out ? out.recorded : shifts.coach.answer(pid, payload);
    time.advance(2000);
    guests.push({ item, pid, rec, out, line: plan.line(i), queue: [...plan.queue] });
  }
  return guests;
}
const wrongChoice = (v, item) => (item.answer === 'pass' ? v.notice.rules[0].id : 'pass');

// 근무의 약속(core.mjs composeShift와 같은 규칙) — 규칙마다 위반 손님 · 통과 손님 · 알림 전 1명과 뒤 2명 · 도착 시각 차례 · 확인용 손님 없음.
function assertPromises(v, queue, label) {
  assert.equal(queue.length, 6, label);
  assert.equal(new Set(queue).size, 6, `${label}: 같은 손님은 한 번`);
  assert.ok(queue.every((c, i) => !i || minutes(queue[i - 1].at) < minutes(c.at)), `${label}: 도착 시각 차례`);
  assert.ok(queue.every((c) => !c.followupOnly), `${label}: 확인용 손님은 후보가 아니다`);
  const rules = [...v.notice.rules.map((r) => r.id), ...(v.memo ? [v.memo.rule.id] : [])];
  for (const id of rules) assert.ok(queue.some((c) => c.answer === id), `${label}: 규칙 ${id}의 위반 손님`);
  assert.ok(queue.some((c) => c.answer === 'pass'), `${label}: 통과 손님`);
  if (v.memo) {
    assert.ok(queue.some((c) => !memoActive(v, c.at)), `${label}: 알림 전 손님`);
    assert.ok(queue.filter((c) => memoActive(v, c.at)).length >= 2, `${label}: 알림 뒤 손님 둘`);
  }
}

// 저장소의 사건(메모리 포트의 줄 { key, value: { kind: 'event', event } }).
const eventsOf = async (port) => (await port.read()).map((row) => row.value).filter((value) => value?.kind === 'event').map((value) => value.event);
const presentedOf = async (port) => (await eventsOf(port)).filter((event) => event.type === 'practice.presented');

// 같은 저장소의 다른 게임(빈칸 베기)이 입장 검사와 단위가 겹치지 않는 문항으로 그날의 새 단위 한도를 쓴다 — 같은 날 넷째 게임.
async function spendNewUnits({ port, key, time }) {
  const map = atlas.openMap(mapData);
  const entryUnits = new Set(map.items(GAME_ID).flatMap((item) => item.units));
  const pool = map.items('blank-slice').filter((item) => item.units.every((unit) => !entryUnits.has(unit))).map((item) => ({ itemKey: item.itemKey }));
  const other = (await engineCoach({ gameId: 'blank-slice', port, key, time })).coach;
  for (let i = 0; i < 40; i += 1) {
    const picked = other.recommend(pool, { set: { length: 40, newLimit: 120 } });
    if (picked.status !== 'ready') break;
    const pid = other.present(picked.selected); time.advance(3000);
    other.answer(pid, { correct: true, assessable: true }); time.advance(3000);
  }
  other.finishSet({ record: false });
  return other;
}

test('은행 이름은 셸의 게임 은행 표와 같다', () => {
  assert.deepEqual([...BANKS], [...GAME_BANKS['entry-check']]);
});

test('문이 없으면 null(옛 길), 셸이 지금 판이면 null, 문이 닫히는 중이면 RUN_ENDED를 그대로 던진다', async () => {
  assert.equal(await openShiftCoach({ win: { parent: null, top: null, location: { hostname: 'synk.im', search: '?atlas=next' } } }), null, '공개 주소는 개발 깃발을 읽지 않는다');
  const old = await throughDoor(null, { give: () => null });
  assert.equal(old.shifts, null);
  let release;
  const { coach } = await engineCoach();
  const entry = { gameCoach: () => new Promise((resolve) => (release = () => resolve(coach))), retired: () => () => {} };
  const door = createGameDoor({ entry, gameId: 'entry-check', later: (fn) => fn() });
  const top = { SYNKAtlasGame: door.api };
  const opening = openShiftCoach({ win: { parent: top, top, addEventListener() {} } });
  door.dispose(); release();
  const error = await opening.then(() => null, (caught) => caught);
  assert.equal(error?.code, 'RUN_ENDED');
  assert.equal(ended(error), true, '틀에서는 code로만 가른다');
  coach.dispose();
});

test('빈 기억 손님의 근무 — 손님이 올 때마다 recommend, 근무의 약속, 제시 · 도움 · 답 차례, 놓친 단위의 이유 줄, 근무 끝 finishSet', async () => {
  const { coach, port, time } = await engineCoach();
  const spy = traced(coach);
  const { shifts } = await throughDoor(spy.coach);
  const pool = venue('pool');
  const plan = shifts.shift(pool, { firstTime: false });
  assert.equal(plan.size, 6);
  assert.deepEqual(plan.queue, composeShift(pool, {}), '처음 보이는 줄은 게임 순서');
  assert.ok(plan.pool.every((c) => !c.followupOnly));
  const wrong = new Set([0, 1]);
  const guests = playShift(shifts, plan, time, {
    choose: (i, item) => (wrong.has(i) ? wrongChoice(pool, item) : item.answer),
    help: (i) => (i === 3 ? 'hint' : null),
  });
  assert.equal(guests.length, 6);
  assertPromises(pool, guests.map((g) => g.item), '첫 근무');
  // 보이는 줄은 손님이 올 때마다 고친다 — 온 손님이 앞에, 그 뒤는 근무의 약속을 지키는 게임 순서.
  guests.forEach((g, i) => {
    assert.deepEqual(g.queue.slice(0, i + 1), guests.slice(0, i + 1).map((one) => one.item), `손님 ${i + 1}: 온 손님이 앞`);
    assertPromises(pool, g.queue, `손님 ${i + 1}의 줄`);
  });
  assert.deepEqual(guests.map((g) => g.rec.verdict), guests.map((_, i) => (wrong.has(i) ? 'incorrect' : 'correct')));
  // 손님마다 recommend → present 한 쌍, 판 옵션은 길이 6 · 새것 한도 18.
  const names = spy.names().filter((name) => ['recommend', 'present', 'finishSet'].includes(name));
  assert.deepEqual(names, Array.from({ length: 6 }, () => ['recommend', 'present']).flat());
  const asked = spy.calls.filter((call) => call.name === 'recommend');
  assert.deepEqual(asked[0].args[1], { set: { length: 6, newLimit: 18 } });
  assert.ok(asked.every((call) => call.args[0].every((row) => typeof row.itemKey === 'string' && row.caseId)), '후보는 자료만 — 문을 지난다');
  // 후보는 그 자리에 와도 약속이 지켜지는 손님뿐이다 — 고른 손님은 늘 그 안에 있다.
  asked.forEach((call, i) => assert.ok(call.args[0].some((row) => row.caseId === guests[i].item.id), `손님 ${i + 1}`));
  assert.ok(asked.some((call) => call.args[0].length > 1), '엔진이 고를 자리가 있다');
  assert.deepEqual(plan.kinds(), asked.map((call) => (call.result.status === 'none' ? 'game' : 'engine')));
  // 다시 만나는 단위일 때만 이유 줄 — 놓친 단위를 엔진이 다른 손님으로 데려온다.
  guests.forEach((g, i) => assert.equal(g.line, GUEST_REASONS.includes(asked[i].result.why?.code) ? asked[i].result.why.line : null, `손님 ${i + 1}`));
  assert.ok(guests.some((g) => /방금 놓친/.test(g.line ?? '')), '놓친 단위가 이 근무에서 다른 손님으로 돌아온다');
  assert.equal(plan.end(), null, '엔진이 멈추지 않은 근무는 끝 한 줄이 없다');
  assert.deepEqual(spy.calls.filter((call) => call.name === 'finishSet').map((call) => call.args[0]), [{ record: false }], '근무 끝에 기록 없이 닫는다');
  plan.end();
  assert.equal(spy.names().filter((name) => name === 'finishSet').length, 1, '두 번 닫지 않는다');
  await Promise.all(guests.map((g) => g.rec.stored));
  await settle();
  const rows = await eventsOf(port);
  const presented = rows.filter((event) => event.type === 'practice.presented');
  assert.deepEqual(presented.map((event) => event.itemKey), guests.map((g) => caseMetadata(g.item).itemKey));
  assert.ok(presented.every((event) => event.arm !== 'host'), '엔진이 고른 제시');
  for (const [i, event] of presented.entries()) {
    const group = rows.filter((row) => row.presentationId === event.id).map((row) => row.type);
    assert.deepEqual(group, [...(i === 3 ? ['practice.helped'] : []), 'practice.attempted'], `손님 ${i + 1}`);
  }
  const attempt = rows.find((row) => row.type === 'practice.attempted' && row.presentationId === presented[0].id);
  assert.equal(attempt.verdict, 'incorrect');
  coach.dispose();
});

test('같은 날 다른 게임이 새 단위 한도를 다 쓰면 첫 손님부터 none — 게임 차례로 6명을 끝까지, 이유 줄 없이 제품 차례로 낸다', async () => {
  const port = atlas.memoryPort(), key = newKey(), time = clock();
  const other = await spendNewUnits({ port, key, time });
  const { coach } = await engineCoach({ port, key, time });
  const spy = traced(coach);
  const { shifts } = await throughDoor(spy.coach);
  let presentedBefore = 0;
  for (const [i, v] of VENUES.entries()) {
    const firstTime = i % 2 === 1;
    const from = spy.calls.length;
    const plan = shifts.shift(v, { firstTime });
    const guests = playShift(shifts, plan, time);
    assert.equal(guests.length, 6, `${v.id}: none이어도 근무는 멈추지 않는다`);
    assertPromises(v, guests.map((g) => g.item), v.id);
    const results = spy.calls.slice(from).filter((call) => call.name === 'recommend').map((call) => call.result);
    assert.equal(results.length, 6, v.id);
    if (i === 0) {
      assert.equal(results[0].status, 'none', '같은 날 넷째 게임 — 첫 손님부터 none');
      assert.equal(guests[0].item, composeShift(v, { firstTime })[0], '게임 차례 — composeShift가 세운 첫 손님');
    }
    const none = results.map((result, j) => [result.status, j]).filter(([status]) => status === 'none').map(([, j]) => j);
    results.forEach((result, j) => assert.equal(plan.kinds()[j], result.status === 'none' ? 'game' : 'engine', `${v.id} 손님 ${j + 1}`));
    for (const j of none) assert.equal(guests[j].line, null, '게임 차례 손님에는 이유 줄이 없다');
    plan.end();
    await settle();
    const presented = (await presentedOf(port)).filter((event) => event.itemKey.startsWith('entry-check.'));
    assert.equal(presented.length, presentedBefore + 6);
    for (const j of none) assert.ok(presented[presentedBefore + j].arm === 'host' && presented[presentedBefore + j].reason.code === 'host.order', `${v.id} 손님 ${j + 1}은 제품 차례로 남는다`);
    presentedBefore = presented.length;
  }
  other.dispose(); coach.dispose();
});

test('게임 차례만으로 짠 근무는 근무지마다 composeShift 그대로다(처음 하는 사람의 쉬운 통과 손님 · 알림 전후 포함)', () => {
  for (const v of VENUES) for (const firstTime of [false, true]) {
    const asked = [];
    const coach = { itemUnits: () => [{ unit: 'u' }], recommend: (list) => { asked.push(list.length); return { status: 'none', selected: null, why: null }; }, finishSet() {} };
    const plan = createShiftCoach(coach).shift(v, { firstTime });
    const items = Array.from({ length: plan.size }, (_, i) => plan.at(i));
    assert.deepEqual(items, composeShift(v, { firstTime }), `${v.id} firstTime ${firstTime}`);
    assert.deepEqual(plan.queue, items);
    assert.equal(plan.at(6), null, '여섯 명으로 끝난다');
    assert.ok(asked.some((n) => n > 1), `${v.id}: 엔진이 고를 수 있는 자리가 있다`);
  }
});

test('같은 날 둘째 근무 — idle(채우기)은 엔진이 고른 손님이고 이유 줄이 없다', async () => {
  const { coach, port, time } = await engineCoach();
  const spy = traced(coach);
  const { shifts } = await throughDoor(spy.coach);
  const pool = venue('pool');
  const first = shifts.shift(pool, {});
  playShift(shifts, first, time, { choose: (i, item) => (i < 2 ? wrongChoice(pool, item) : item.answer) });
  first.end();
  time.advance(60_000);
  const from = spy.calls.length;
  const second = shifts.shift(pool, {});
  const guests = playShift(shifts, second, time);
  assertPromises(pool, guests.map((g) => g.item), '둘째 근무');
  const results = spy.calls.slice(from).filter((call) => call.name === 'recommend').map((call) => call.result);
  const idle = results.map((result, i) => [result, i]).filter(([result]) => result.status === 'idle').map(([, i]) => i);
  assert.ok(idle.length > 0, '이 근무에는 할 것이 없는 자리가 있다');
  for (const i of idle) {
    assert.equal(second.kinds()[i], 'engine', `손님 ${i + 1}: idle은 엔진이 고른 손님(§23-6)`);
    assert.equal(guests[i].item.id, results[i].selected.caseId, '엔진의 채우기 그대로');
    assert.equal(guests[i].line, null, '「다 만났어요」는 손님마다 말하지 않는다');
  }
  second.end();
  await settle();
  const presented = (await presentedOf(port)).slice(6);
  assert.ok(idle.every((i) => presented[i].arm !== 'host'), '채우기는 엔진의 줄로 남는다');
  coach.dispose();
});

test('연수 — 정해진 손님을 recommend 없이 present만 하고, 근무 끝에 닫는다', async () => {
  const { coach, port, time } = await engineCoach();
  const spy = traced(coach);
  const { shifts } = await throughDoor(spy.coach);
  const pool = venue('pool');
  const queue = [...TUTORIAL_CASES.map((id) => pool.cases.find((c) => c.id === id)), ...composeShift(pool, { firstTime: true }).filter((c) => !TUTORIAL_CASES.includes(c.id))]
    .slice(0, 6).sort((a, b) => minutes(a.at) - minutes(b.at));
  const plan = shifts.fixed(queue);
  const guests = playShift(shifts, plan, time, { help: (i) => (i < 2 ? 'answer' : null) });
  assert.deepEqual(guests.map((g) => g.item), queue);
  assert.equal(spy.names().includes('recommend'), false, '제품이 차례를 정한 근무');
  assert.deepEqual(spy.calls.filter((call) => call.name === 'startSet').map((call) => call.args[0]), [{ length: 6 }], '판 길이는 연수 손님 수로 한 번');
  assert.ok(spy.names().indexOf('startSet') < spy.names().indexOf('present'), '첫 제시보다 먼저');
  assert.deepEqual(plan.kinds(), Array(6).fill('game'));
  plan.end();
  assert.deepEqual(spy.calls.filter((call) => call.name === 'finishSet').map((call) => call.args[0]), [{ record: false }]);
  await settle();
  const presented = await presentedOf(port);
  assert.equal(presented.length, 6);
  assert.ok(presented.every((event) => event.arm === 'host'));
  coach.dispose();
});

test('연수 다시 보기 — 입구의 근무지 추천이 기본 판을 열어 두었어도 연수는 판 길이로 새 판을 연다(4-6 끝 판 F4)', async () => {
  const { coach, port, time } = await engineCoach();
  const spy = traced(coach);
  const { shifts } = await throughDoor(spy.coach);
  shifts.venue(['pool']);
  const plan = shifts.fixed(tutorialOf(venue('pool')));
  playShift(shifts, plan, time, {});
  const opened = spy.calls.filter((call) => call.name === 'startSet').map((call) => call.result.opened);
  assert.deepEqual(opened, [false, true], '추천이 연 기본 판을 닫고 다시 연다');
  plan.end();
  await settle();
  const presented = await presentedOf(port);
  assert.equal(presented.length, 6);
  assert.equal(new Set(presented.map((event) => event.setId)).size, 1, '연수 손님 여섯이 한 판');
  assert.ok(presented.every((event) => event.arm === 'host'), '추천이 남긴 고른 손님이 연수의 첫 손님을 엔진의 줄로 바꾸지 않는다(GA1)');
  coach.dispose();
});

// 연수 근무의 손님(app.mjs tutorialQueue와 같은 짜임).
const tutorialOf = (v) => [...TUTORIAL_CASES.map((id) => v.cases.find((c) => c.id === id)), ...composeShift(v, { firstTime: true }).filter((c) => !TUTORIAL_CASES.includes(c.id))]
  .slice(0, 6).sort((a, b) => minutes(a.at) - minutes(b.at));
// 코치 startSet 첩자(지금 엔진에는 없다 — 설계 주인 11-19 밤에 승인한 꼴: 열면 { opened: true, setId }).
function withStartSet(spy) {
  let made = 0;
  spy.coach.startSet = (options) => {
    made += 1;
    const result = { opened: true, setId: `set-${made}` };
    spy.calls.push({ name: 'startSet', args: [options], result });
    return result;
  };
  return spy;
}
const setCalls = (calls) => calls.map((call) => call.name).filter((name) => ['startSet', 'recommend', 'present', 'finishSet'].includes(name));

test('연수 — 첫 present 전에 startSet({ length: 연수 손님 수 })을 한 번 부르고, 판을 닫은 뒤 다음 연수를 열 때 다시 부른다', async () => {
  const { coach, time } = await engineCoach();
  const spy = withStartSet(traced(coach));
  const { shifts } = await throughDoor(spy.coach);
  const queue = tutorialOf(venue('pool'));
  // 처음 연수 — 끝까지.
  let from = spy.calls.length;
  const first = shifts.fixed(queue);
  assert.equal(spy.names().slice(from).includes('startSet'), false, '판을 지을 때는 열지 않는다 — 첫 손님을 부를 때 연다');
  playShift(shifts, first, time);
  first.end();
  assert.deepEqual(setCalls(spy.calls.slice(from)), ['startSet', ...Array(6).fill('present'), 'finishSet']);
  assert.deepEqual(spy.calls.slice(from).find((call) => call.name === 'startSet').args[0], { length: 6 }, 'n = 연수 손님 수(은행에 있는 손님 6명)');
  // 다시 연수(연수 다시 보기) — 손님 둘 뒤 그만두고, 다음 연수를 처음부터.
  from = spy.calls.length;
  const second = shifts.fixed(queue);
  for (let i = 0; i < 2; i += 1) { const pid = shifts.coach.present(caseMetadata(second.at(i))); shifts.coach.answer(pid, answerPayload(true)); time.advance(3000); }
  second.end();
  const third = shifts.fixed(queue);
  playShift(shifts, third, time);
  third.end();
  assert.deepEqual(setCalls(spy.calls.slice(from)), ['startSet', 'present', 'present', 'finishSet', 'startSet', ...Array(6).fill('present'), 'finishSet'], '앞 판을 닫은 뒤 새 판을 연다');
  assert.ok(spy.calls.slice(from).filter((call) => call.name === 'startSet').every((call) => call.args[0].length === 6));
  // 손님을 부르기 전에 그만두면(근무 전 안내에서 나감) 판을 열지도 닫지도 않는다.
  from = spy.calls.length;
  shifts.fixed(queue).end();
  assert.deepEqual(setCalls(spy.calls.slice(from)), []);
  coach.dispose();
});

test('연수의 판 길이는 은행에 있는 손님 수 — startSet이 실패해도 연수는 이어 가고, 한 손님 연습(recommend 판)은 startSet을 부르지 않는다', () => {
  const pool = venue('pool');
  const queue = tutorialOf(pool);
  const outside = caseMetadata(queue[2]).itemKey;
  const calls = [];
  let failing = false;
  const coach = {
    itemUnits: (key) => (key === outside ? [] : [{ unit: 'u' }]),
    startSet: (options) => { calls.push(['startSet', options]); if (failing) throw Object.assign(new Error('저장소'), { code: 'STORE_FAILED' }); return { opened: false, setId: 'open' }; },
    recommend: (list, options) => { calls.push(['recommend', options]); return { status: 'ready', selected: list[0], why: null }; },
    present: (meta) => { calls.push(['present', meta.itemKey]); return 'p'; },
    answer: () => null,
    finishSet: () => calls.push(['finishSet']),
    due: () => [{ unit: 'u' }],
    summary: () => ({ units: [] }),
    exposures: (metas) => metas.map(() => ({ seen: false })),
  };
  const shifts = createShiftCoach(coach);
  const plan = shifts.fixed(queue);
  const items = Array.from({ length: plan.size }, (_, i) => plan.at(i));
  for (const item of items) shifts.coach.present(caseMetadata(item));
  plan.end();
  assert.deepEqual(items, queue);
  assert.deepEqual(calls[0], ['startSet', { length: 5 }], '은행 밖 손님은 내지 않으니 길이에 넣지 않는다');
  assert.equal(calls.filter(([name]) => name === 'present').length, 5);
  failing = true;
  calls.length = 0;
  const broken = shifts.fixed(queue);
  assert.equal(broken.at(0), queue[0], 'startSet이 던져도 첫 손님이 온다');
  broken.end();
  assert.deepEqual(calls.map(([name]) => name), ['startSet', 'finishSet']);
  // 한 손님 연습 — 고를 때 recommend가 판(길이 1)을 연다. startSet은 부르지 않는다.
  calls.length = 0;
  const drill = shifts.drill(['pool'], { tutorial: true, plays: 1 });
  assert.ok(drill);
  shifts.coach.present(caseMetadata(drill.plan.at(0)));
  drill.plan.end();
  assert.deepEqual(calls.map(([name]) => name), ['recommend', 'present', 'finishSet']);
  assert.deepEqual(calls[0][1], { set: { length: 1, newLimit: 3 } });
});

test('한 손님 연습 — 놓친 단위가 든 손님 가운데 보여 주지 않은 손님(exposures)을 고르고, 연수 전 · 근무 전에는 건네지 않는다', async () => {
  const { coach, port, time } = await engineCoach();
  const spy = traced(coach);
  const { shifts } = await throughDoor(spy.coach);
  const ids = ['pool', 'library', 'museum'];
  assert.equal(shifts.canDrill(ids, { tutorial: true, plays: 0 }), false, '근무를 해 본 사람에게만');
  assert.equal(shifts.canDrill(ids, { tutorial: false, plays: 2 }), false, '연수를 마친 사람에게만');
  assert.equal(shifts.canDrill(ids, { tutorial: true, plays: 1 }), false, '놓친 단위가 없으면 건네지 않는다');
  const pool = venue('pool');
  const first = shifts.shift(pool, {});
  const guests = playShift(shifts, first, time, { choose: (i, item) => (i < 2 ? wrongChoice(pool, item) : item.answer) });
  first.end();
  time.advance(60_000);
  const progress = { tutorial: true, plays: 1 };
  assert.equal(shifts.canDrill(ids, progress), true);
  const shown = new Set(guests.map((g) => g.item.id));
  const from = spy.calls.length;
  const drill = shifts.drill(ids, progress);
  assert.ok(drill);
  const calls = spy.calls.slice(from);
  const asked = calls.find((call) => call.name === 'recommend');
  assert.deepEqual(asked.args[1], { set: { length: 1, newLimit: 3 } });
  assert.ok(calls.some((call) => call.name === 'exposures'), '보여 준 손님은 exposures로 읽는다');
  assert.ok(asked.args[0].every((row) => !shown.has(row.caseId)), '이번 근무에 본 손님은 후보가 아니다');
  const weak = new Set(coach.summary().units.filter((unit) => ['again', 'hard'].includes(unit.last) || unit.stubborn).map((unit) => unit.unit));
  for (const row of asked.args[0]) assert.ok(coach.itemUnits(row.itemKey).some((unit) => weak.has(unit.unit)), `${row.caseId}: 놓친 단위가 든 손님`);
  assert.equal(drill.item.id, asked.result.selected.caseId);
  assert.equal(drill.venueId, VENUES.find((v) => v.cases.includes(drill.item)).id);
  assert.equal(drill.why, GUEST_REASONS.includes(asked.result.why?.code) ? asked.result.why.line : null);
  // 그 손님 한 명 — 제시 · 답 뒤 판을 닫는다.
  const done = playShift(shifts, drill.plan, time);
  assert.equal(done.length, 1);
  assert.equal(done[0].item, drill.item);
  drill.plan.end();
  assert.deepEqual(spy.calls.slice(from).filter((call) => call.name === 'finishSet').map((call) => call.args[0]), [{ record: false }]);
  await settle();
  const presented = (await presentedOf(port)).at(-1);
  assert.equal(presented.itemKey, caseMetadata(drill.item).itemKey);
  assert.notEqual(presented.arm, 'host', '엔진이 고른 손님');
  coach.dispose();
});

test('한 손님 연습 — 근무 전 안내에서 나가면(첫 손님 전) 고를 때 연 판을 기록 없이 닫아, 다음 연수는 앞 판 없이 판 길이로 연다(4-6 끝 판 A1)', async () => {
  const { coach, port, time } = await engineCoach();
  const spy = traced(coach);
  const { shifts } = await throughDoor(spy.coach);
  const pool = venue('pool');
  const first = shifts.shift(pool, {});
  playShift(shifts, first, time, { choose: (i, item) => (i < 2 ? wrongChoice(pool, item) : item.answer) });
  first.end();
  time.advance(60_000);
  const drill = shifts.drill(['pool', 'library', 'museum'], { tutorial: true, plays: 1 });
  assert.ok(drill);
  // 근무 전 안내에서 그만두기 · 연수 다시 보기(app.mjs leaveShift → endPlan) — 손님을 부르지 않았다.
  const from = spy.calls.length;
  drill.plan.end();
  drill.plan.end();
  assert.deepEqual(spy.calls.slice(from).filter((call) => call.name === 'finishSet').map((call) => call.args[0]), [{ record: false }], '고를 때 연 판을 한 번 닫는다');
  const tutorial = shifts.fixed(tutorialOf(pool));
  playShift(shifts, tutorial, time);
  tutorial.end();
  assert.deepEqual(spy.calls.slice(from).filter((call) => call.name === 'startSet').map((call) => call.result.opened), [true], '연수는 남은 판 없이 바로 연다');
  await settle();
  const presented = (await presentedOf(port)).slice(-6);
  assert.equal(new Set(presented.map((event) => event.setId)).size, 1);
  assert.ok(presented.every((event) => event.arm === 'host'), '연수 손님은 제품 차례');
  coach.dispose();
});

test('순간 맞춤 — 돋보기 시점 · stuck · 도움 줄이기 권함을 옛 겉과 같은 이름으로 쓰고, 한 제시는 Flow를 한 번만 움직인다', async () => {
  const { coach, time } = await engineCoach();
  const { shifts } = await throughDoor(coach);
  const flow = shifts.coach.live(FLOW_ENTRY, { words: FLOW_WORDS });
  assert.equal(flow.settings().values.magnifier, '누르면');
  assert.equal(magnifierAfter(flow), null);
  assert.equal(typeof flow.stuck().afterMs, 'number');
  const pool = venue('pool');
  const plan = shifts.shift(pool, {});
  const guests = playShift(shifts, plan, time, { flow, choose: (i, item) => (i === 0 ? wrongChoice(pool, item) : item.answer) });
  assert.equal(flow.trace().length, 6, '손님마다 한 번');
  assert.equal(guests[0].out.recorded.verdict, 'incorrect', '옛 답 꼴을 새 겉으로 옮긴다');
  assert.ok(guests[0].out.change, '놓치면 돋보기를 한 칸 일찍(옛 겉과 같은 움직임)');
  assert.equal(guests[0].out.line?.text, FLOW_WORDS['ease.support']);
  assert.notEqual(flow.settings().values.magnifier, '누르면');
  assert.equal(typeof magnifierAfter(flow), 'number', '머뭇거리면 · 바로 — 돋보기가 스스로 나오는 때');
  // 같은 제시의 둘째 관찰은 몫이 없다.
  const again = flow.observe({ outcome: 'fail' }, guests[0].pid);
  assert.equal(again.change, null);
  assert.equal(flow.trace().length, 6);
  const offer = flow.offerLessHelp();
  assert.equal(typeof offer.offer, 'boolean');
  plan.end();
  assert.ok(flow.end().settings);
  coach.dispose();
});

/* ── 순간 맞춤 진입(4-6e-2 — 설계 주인 11-21) ── */
// app.mjs가 근무를 열 때 순간 맞춤을 여는 원문 토막을 그대로 돌린다(atlas 감싸기 한 줄과 함께). 셸 코치의 live는 가짜다 — 문이 옮겨 온
// 인자(spec, options)를 적고 진짜 엔진 코치의 live에 넘긴다(엔진은 거기서 내용을 정의하고, 막기에 걸리면 던진다). 엔진이 던지면 적어 두고
// 그대로 던진다. atlas 감싸기는 그 던짐을 삼키고 순간 맞춤만 끄므로, 시험은 적힌 던짐과 adaptive로 본다.
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
  const from = text.indexOf('  // 순간 맞춤: 돋보기가 스스로 나오는 때만 맞춘다');
  const to = text.indexOf('  sound.preloadVoices(', from);
  assert.ok(wrap >= 0 && from >= 0 && to > from && text.slice(from, to).includes('c.live?.('), 'app.mjs의 순간 맞춤 열기 토막');
  const body = `${text.slice(wrap, text.indexOf('\n', wrap))}\n${text.slice(from, to)}`;
  return strictEnv(`return () => {\n${body}\nreturn { flow: state.flow, line: state.flowLine };\n};`, text);
}

test('순간 맞춤 진입 — app.mjs가 근무마다 넘긴 내용을 진짜 엔진이 정의하고 돋보기 도움의 순간 맞춤이 켜진다, 연수 근무는 열지 않는다', async () => {
  const { coach } = await engineCoach();
  const { shell, got } = liveSpy(coach);
  const { shifts } = await throughDoor(shell);
  const tut = { on: false };
  const env = { coach: shifts.coach, state: {}, tut, clearTimeout, FLOW_ENTRY, FLOW_WORDS };
  const openShift = flowStarter()(env);

  const opened = openShift();
  assert.equal(got.length, 1, '근무마다 순간 맞춤 하나');
  assert.equal(got[0].spec.id, FLOW_ENTRY.id);
  assert.equal(got[0].error, null, `진짜 엔진이 받지 않은 내용 — 게임은 삼키고 순간 맞춤만 꺼진다: ${got[0].error?.message}`);
  assert.equal(got[0].adaptive, true, '근무는 돋보기 도움의 순간 맞춤이 켜진다');
  assert.ok(opened.flow, '게임이 순간 맞춤 겉을 쥔다');
  assert.equal(opened.flow.settings().values.magnifier, '누르면', '처음 값은 지금 방식(누르면 나옴)');

  tut.on = true;
  assert.equal(openShift().flow, null);
  assert.equal(got.length, 1, '연수 근무는 정해진 대로 — 순간 맞춤을 열지 않는다');
  coach.dispose();
});

test('판을 다시 정하면 이번 근무는 기록 없이 게임 차례로 잇고, 다음 근무는 문을 다시 열어 새 겉을 받는다', async () => {
  const { coach, time } = await engineCoach();
  const spy = traced(coach);
  const { shifts, retire, win } = await throughDoor(spy.coach);
  const pool = venue('pool');
  const plan = shifts.shift(pool, {});
  for (let i = 0; i < 3; i += 1) { const item = plan.at(i); const pid = shifts.coach.present(caseMetadata(item)); shifts.coach.answer(pid, answerPayload(true)); time.advance(3000); }
  retire();
  assert.equal(shifts.retired, true);
  const before = spy.calls.length;
  const rest = [];
  for (let i = 3; i < 6; i += 1) {
    const item = plan.at(i);
    assert.ok(item, `손님 ${i + 1}은 게임 차례로 이어 간다`);
    rest.push(item);
    let error = null, pid = null;
    try { pid = shifts.coach.present(caseMetadata(item)); } catch (caught) { error = caught; }
    assert.ok(pid === null && (error === null || ended(error)), '닫힌 겉은 RUN_ENDED(또는 제시 없음) — 게임은 기록 없이 잇는다');
  }
  assert.deepEqual(plan.kinds().slice(3), Array(3).fill('game'));
  assertPromises(pool, [...plan.queue], '다시 정한 뒤에도 근무의 약속');
  assert.equal(spy.calls.length, before, '닫힌 뒤에는 셸 코치에 닿지 않는다');
  assert.doesNotThrow(() => plan.end());
  assert.equal(shifts.venue(['pool']), null, '추천 근무지는 게임이 고른다');
  assert.equal(shifts.canDrill(['pool'], { tutorial: true, plays: 3 }), false);
  assert.throws(() => shifts.coach.live(FLOW_ENTRY, { words: FLOW_WORDS }), { code: 'RUN_ENDED' });
  const fresh = await openShiftCoach({ win });
  assert.ok(fresh);
  assert.equal(fresh.retired, false);
  const next = fresh.shift(pool, {});
  assert.ok(fresh.coach.present(caseMetadata(next.at(0))));
  next.end();
  coach.dispose();
});

test('추천 근무지 — 열린 근무지의 손님 가운데 엔진이 고른 손님의 근무지와 그 이유 줄(엔진이 고를 때만)', async () => {
  const { coach } = await engineCoach();
  const spy = traced(coach);
  const { shifts } = await throughDoor(spy.coach);
  const rec = shifts.venue(['pool', 'library']);
  const asked = spy.calls.find((call) => call.name === 'recommend');
  assert.deepEqual(asked.args[1], {}, '판을 열지 않는다');
  assert.ok(asked.args[0].every((row) => ['pool', 'library'].includes(row.venueId) && !VENUES.find((v) => v.id === row.venueId).cases.find((c) => c.id === row.caseId).followupOnly));
  assert.equal(asked.result.status, 'ready');
  // 이유 줄은 이 판에서 아직 평가하지 않은 단위의 이름을 말하지 않는다 — 키트가 이름 없는 줄로 바꾼다(5-3 게임 GE1).
  assert.deepEqual(rec, { venueId: asked.result.selected.venueId, line: namelessLine(asked.result.why) });
  coach.dispose();
});

test('은행 밖 손님은 후보가 아니고 제시하지 않는다 — 그 손님의 도움 · 답도 기록하지 않는다', () => {
  const pool = venue('pool');
  const outside = caseMetadata(pool.cases.find((c) => c.id === 'pool-02')).itemKey;
  const calls = [];
  const coach = {
    itemUnits: (key) => (key === outside ? [] : [{ unit: 'u' }]),
    recommend: (list, options) => { calls.push(['recommend', list.map((row) => row.caseId), options]); return { status: 'none', selected: null, why: null }; },
    present: (meta) => { calls.push(['present', meta.itemKey]); return 'p'; },
    help: () => calls.push(['help']),
    answer: () => calls.push(['answer']),
    finishSet: () => calls.push(['finishSet']),
  };
  const shifts = createShiftCoach(coach);
  const plan = shifts.shift(pool, {});
  const items = Array.from({ length: 6 }, (_, i) => plan.at(i));
  assert.deepEqual(items, composeShift(pool, {}), '게임 차례는 은행 밖 손님도 그대로 세운다');
  assert.ok(calls.filter(([name]) => name === 'recommend').every(([, ids]) => !ids.includes('pool-02')), '은행 밖 손님은 후보가 아니다');
  for (const item of items) {
    const pid = shifts.coach.present(caseMetadata(item));
    shifts.coach.help(pid, 'hint');
    shifts.coach.answer(pid, answerPayload(true));
  }
  assert.equal(calls.filter(([name]) => name === 'present').length, 5);
  assert.ok(!calls.some(([name, key]) => name === 'present' && key === outside));
  assert.equal(calls.filter(([name]) => name === 'answer').length, 5);
});
