// 바람길의 새 길(Atlas 재설계 4-6d — 단계4_계획 §23-7 · §23-10 「게임」). 진짜 엔진 코치(손님 · 메모리 저장소)를 셸의 게임 문
// (synk-world-app/world-atlas-game.mjs createGameDoor)에 넣고, 문을 거친 그대로(인수 복제 · 고른 후보 되맞춤) atlas-next-play.mjs로 돈다.
// 보는 것: 달리기는 recommend 없이 게임 차례로 present만(제품 차례 · 아직 못 들어 본 부탁 먼저) · 동작 답은 판정 안 함 · 놓친 부탁은 두 부탁 뒤
// 새 제시 · 제시 → 전달 → 도움 → 답의 차례 · 판 끝 finishSet, 듣기 확인은 문항마다 recommend(3문항 · 새것 한도 9)이고 none이면 게임 차례(이유 줄
// 없음 · 제품 차례) · 진짜 듣기 확인 화면으로 한 판(근거 줄은 저장 뒤 · 닫으면 판 닫기), 순간 맞춤은 한 제시가 Flow를 한 번만 · 오늘 「피곤」,
// 판을 다시 정하면 기록 없이 이어 감 · 다음 판에서 다시 열기, 문이 null이면 옛 길 · RUN_ENDED는 던짐. 끝에 원문 검사(꺼진 판은 새 길 모듈을 싣지 않는다).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { RunnerModel, driveDemo } from './core.mjs';
import { INSTRUCTIONS } from './instructions.mjs';
import { FLOW_RUN, FLOW_WORDS, TIRED_RUN, actionEvidence, instructionMetadata, paceOf, runObservation } from './learning.mjs';
import { LISTENING_CHECKS, checkMetadata, createListeningCheck } from './listening-check.mjs';
import { mountListeningCheck } from './listening-check-ui.mjs';
import { BANKS, CHECK_LENGTH, GAME_ID, createRunner, freshFirst, openRunner } from './atlas-next-play.mjs';
import { ended } from './kit/atlas-next.mjs';
import { createGameDoor, GAME_BANKS } from '../synk-world-app/world-atlas-game.mjs';

const atlas = await import('../../packages/atlas/src/index.mjs');
const json = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
// 낱말 이름까지 — 셸이 여는 코치는 은행 조각의 낱말 줄로 이유 줄의 이름을 세운다.
const mapData = { index: json('../../packages/atlas/map/index.json'), units: json('../../packages/atlas/map/units.json'), words: json('../../packages/atlas/map/words.json') };
const T0 = Date.UTC(2026, 10, 19, 1, 0, 0);   // 서울 오전 10시
const clock = (start = T0) => { const s = { t: start }; return { now: () => s.t, advance: (ms) => { s.t += ms; } }; };
let stores = 0;
const newKey = () => `synk-atlas:korean-runner-test-${process.pid}-${(stores += 1)}`;
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));
const SHAPES = ['ko.listening.detail', 'ko.listening.negation', 'ko.listening.sequence'];

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
  const door = createGameDoor({ entry, gameId: GAME_ID, later: (fn) => fn() });
  const top = { SYNKAtlasGame: door.api };
  const win = { parent: top, top, addEventListener: () => {}, location: { hostname: 'synk.im', search: '' } };
  const runner = await openRunner({ win });
  return { runner, door, win, retire: () => [...retirers].forEach((fn) => fn({ reason: 'account' })) };
}

// app.mjs의 달리기 한 판과 같은 차례: 부탁이 나올 때 제시(showInstruction) → 소리 시작 · 끝(전달) → 글로 보기(도움) → 표시선에서 해냄 · 놓침(동작 답) →
// 순간 맞춤 관찰(그 부탁의 제시 번호와 함께), 90초 끝에 남은 부탁은 응답 없음(closeUnanswered), 판 끝에 닫기(endRun).
// miss(mission): 그 부탁을 따라 하지 않는다(길 바꾸기 부탁만 — 부딪히지 않는다). text(mission): 글로 보기.
function playRun(runner, time, { miss = () => false, text = () => false, flow = null, seed = 7 } = {}) {
  const play = runner.run();
  const coach = runner.coach;
  const model = new RunnerModel({ seed, chooseInstruction: play.instruction, pace: flow ? paceOf(flow.settings().values) : undefined });
  const shown = [];
  const seen = [];
  while (!model.finished) {
    const mission = model.currentMission;
    if (!(mission && miss(mission))) driveDemo(model);
    model.step(0.05);
    time.advance(50);
    for (const n of model.drain()) {
      if (n.type === 'instruction') {
        const m = n.mission;
        m.presentationId = coach.present(instructionMetadata(m.instruction));
        coach.delivery(m.presentationId, { audio: 'pending' });
        coach.delivery(m.presentationId, { audio: 'completed' });
        if (text(m)) coach.help(m.presentationId, 'text');
        shown.push(m);
      }
      if (n.type === 'correct' || n.type === 'wrong') {
        coach.answer(n.mission.presentationId, actionEvidence(n.mission, n.type === 'correct'));
        n.mission.learningClosed = true;
      }
      const observation = flow && runObservation(n);
      if (observation) seen.push(runner.observe(flow, observation, n.mission?.presentationId));
    }
  }
  for (const m of model.missions) if (m.presentationId && !m.learningClosed) { coach.answer(m.presentationId, { correct: null, assessable: false, reason: 'unanswered' }); m.learningClosed = true; }
  play.end();
  return { play, model, shown, seen };
}

// listening-check-ui.mjs의 한 판과 같은 차례: 판(runner.checks) → 문항마다 고르기 → 제시(begin) → 소리 시작 · 끝(전달) → 다시 듣기(도움) → 답 → 닫기.
function playChecks(runner, time, { choose = (_i, item) => item.correct, replay = () => false } = {}) {
  const round = runner.checks();
  const check = createListeningCheck(runner.coach);
  const out = [];
  for (let i = 0; i < 10; i += 1) {
    const plan = round.next();
    if (plan.status !== 'ready') break;
    const token = check.begin(plan.item); time.advance(500);
    check.delivery(token, 'pending'); time.advance(2500);
    check.delivery(token, 'completed'); time.advance(500);
    if (replay(i)) { check.replay(); time.advance(2500); }
    const result = check.answer(choose(i, plan.item)); time.advance(1500);
    out.push({ plan, result, pid: check.current.pid });
  }
  check.cancel(); round.end();
  return { round, out };
}

// 저장소의 사건(메모리 포트의 줄 { key, value: { kind: 'event', event } }).
const eventsOf = async (port) => (await port.read()).map((row) => row.value).filter((value) => value?.kind === 'event').map((value) => value.event);
const presentedOf = async (port) => (await eventsOf(port)).filter((event) => event.type === 'practice.presented');
const groupOf = (rows, pid) => rows.filter((row) => row.presentationId === pid).map((row) => row.type);

// 같은 저장소의 다른 게임(빈칸 베기)이 바람길과 단위가 겹치지 않는 문항으로 그날의 새 단위 한도를 쓴다 — 같은 날 넷째 게임.
async function spendNewToday(port, key, time) {
  const map = atlas.openMap(mapData);
  const runnerUnits = new Set(map.items(GAME_ID).flatMap((item) => item.units));
  const pool = map.items('blank-slice').filter((item) => item.units.every((unit) => !runnerUnits.has(unit))).map((item) => ({ itemKey: item.itemKey }));
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

test('은행 이름은 셸의 게임 은행 표와 같고, 달리기 부탁 16 · 듣기 확인 12가 모두 은행에 있다', async () => {
  assert.deepEqual([...BANKS], [...GAME_BANKS[GAME_ID]]);
  const { coach } = await engineCoach();
  for (const meta of [...INSTRUCTIONS.map(instructionMetadata), ...LISTENING_CHECKS.map(checkMetadata)]) assert.ok(coach.itemUnits(meta.itemKey).length > 0, meta.itemKey);
  coach.dispose();
});

test('문이 없으면 null(옛 길), 셸이 지금 판이면 null, 문이 닫히는 중이면 RUN_ENDED를 그대로 던진다', async () => {
  assert.equal(await openRunner({ win: { parent: null, top: null, location: { hostname: 'synk.im', search: '?atlas=next' } } }), null, '공개 주소는 개발 깃발을 읽지 않는다');
  const old = await throughDoor(null, { give: () => null });
  assert.equal(old.runner, null);
  // 기다리던 open이 패널 닫힘으로 끝나면 null이 아니라 RUN_ENDED — 게임은 옛 길을 열지 않는다.
  let release;
  const { coach } = await engineCoach();
  const entry = { gameCoach: () => new Promise((resolve) => (release = () => resolve(coach))), retired: () => () => {} };
  const door = createGameDoor({ entry, gameId: GAME_ID, later: (fn) => fn() });
  const top = { SYNKAtlasGame: door.api };
  const opening = openRunner({ win: { parent: top, top, addEventListener() {} } });
  door.dispose(); release();
  const error = await opening.then(() => null, (caught) => caught);
  assert.equal(error?.code, 'RUN_ENDED');
  assert.equal(ended(error), true, '틀에서는 code로만 가른다');
  coach.dispose();
});

test('빈 기억 손님의 달리기 — recommend 없이 게임 차례로 present만, 동작 답은 판정 안 함, 놓친 부탁은 새 제시로 다시, 판 끝 finishSet', async () => {
  const { coach, port, time } = await engineCoach();
  const spy = traced(coach);
  const { runner } = await throughDoor(spy.coach);
  assert.deepEqual(runner.run().order, INSTRUCTIONS.map((item) => item.id), '처음 달리는 사람은 원고 차례 그대로');
  spy.calls.length = 0;
  const { shown, model } = playRun(runner, time, { miss: (m) => m.index === 0, text: (m) => m.index === 2 });
  assert.equal(model.reason, 'tour', '90초를 끝까지 달린다');
  assert.ok(shown.length >= 8, `부탁 ${shown.length}개`);
  assert.equal(spy.names().includes('recommend'), false, '달리기 부탁은 엔진에 묻지 않는다');
  assert.equal(shown[0].id, 'left');
  // 놓친 첫 부탁은 두 부탁 뒤에 같은 부탁으로 다시 나온다 — 새 제시다.
  const again = shown.filter((m) => m.id === 'left');
  assert.equal(again.length, 2, '놓친 부탁 다시');
  assert.notEqual(again[0].presentationId, again[1].presentationId);
  assert.ok(shown.indexOf(again[1]) >= 3, '두 부탁 넘게 지난 뒤(게임 규칙 — core.mjs reviewQueue)');
  // 이 판에 다시 낸 것 말고는 원고 차례 그대로다(게임 차례).
  const firsts = shown.filter((m, i) => shown.findIndex((x) => x.id === m.id) === i).map((m) => m.id);
  assert.deepEqual(firsts, INSTRUCTIONS.slice(0, firsts.length).map((item) => item.id));
  const finished = spy.calls.filter((call) => call.name === 'finishSet');
  assert.deepEqual(finished.map((call) => call.args[0]), [{ record: false }], '판 끝에 기록 없이 닫는다');
  assert.equal(spy.names().at(-1), 'finishSet', '남은 부탁의 응답 없음이 판 닫기보다 먼저');
  await settle();
  const rows = await eventsOf(port);
  const presented = rows.filter((event) => event.type === 'practice.presented');
  assert.deepEqual(presented.map((event) => event.itemKey), shown.map((m) => instructionMetadata(m.instruction).itemKey));
  for (const event of presented) {
    assert.equal(event.arm, 'host', '제품 차례로 남는다');
    assert.equal(event.reason.code, 'host.order');
    assert.equal(event.confounded, true, '장면을 보고도 할 수 있는 부탁');
  }
  for (const [i, m] of shown.entries()) {
    const group = groupOf(rows, m.presentationId);
    assert.deepEqual(group, ['practice.delivery', 'practice.delivery', ...(m.index === 2 ? ['practice.helped'] : []), 'practice.attempted'], `부탁 ${i + 1}`);
    const attempt = rows.find((row) => row.type === 'practice.attempted' && row.presentationId === m.presentationId);
    assert.equal(attempt.verdict, 'unassessed', '동작 답은 판정하지 않는다');
    assert.ok(['visual', 'motor', 'unanswered'].includes(attempt.reason), attempt.reason);
  }
  assert.equal(rows.find((row) => row.type === 'practice.attempted' && row.presentationId === again[0].presentationId).reason, 'visual', '놓친 부탁도 판정 안 함');
  coach.dispose();
});

test('같은 날 둘째 달리기 — 아직 못 들어 본 부탁 먼저(게임 차례), 그다음 원고 차례', async () => {
  const { coach, time } = await engineCoach();
  const { runner } = await throughDoor(coach);
  const first = playRun(runner, time);
  time.advance(60_000);
  const heard = new Set(first.shown.map((m) => m.id));
  const play = runner.run();
  const unheard = INSTRUCTIONS.map((item) => item.id).filter((id) => !heard.has(id));
  assert.ok(unheard.length > 0, '한 판에 열여섯을 다 듣지 못한다');
  assert.deepEqual(play.order.slice(0, unheard.length), unheard);
  assert.deepEqual(play.order.slice(unheard.length), INSTRUCTIONS.map((item) => item.id).filter((id) => heard.has(id)));
  assert.deepEqual(freshFirst(['a', 'b', 'c'], [true, false, null]), ['b', 'a', 'c'], '모름은 들어 본 것과 같이 둔다');
  play.end();
  const second = playRun(runner, time);
  assert.equal(second.shown[0].id, unheard[0]);
  coach.dispose();
});

test('은행에 없는 문항은 내지 않는다 — 셸 코치에 닿지 않고 기록 없이 지나간다', async () => {
  const { coach } = await engineCoach();
  const spy = traced(coach);
  const { runner } = await throughDoor(spy.coach);
  spy.calls.length = 0;
  const pid = runner.coach.present({ ...instructionMetadata(INSTRUCTIONS[0]), itemKey: 'korean-runner.not-in-bank.v1', familyKey: 'korean-runner.not-in-bank.v1' });
  assert.equal(pid, null);
  assert.deepEqual(spy.names(), ['itemUnits']);
  assert.equal(runner.coach.delivery(pid, { audio: 'completed' }), null);
  assert.equal(runner.coach.answer(pid, { correct: true, assessable: true }).verdict, 'unassessed', '기록하지 못한 답');
  assert.deepEqual(spy.names(), ['itemUnits']);
  coach.dispose();
});

test('빈 기억 손님의 듣기 확인 — 문항마다 recommend(3문항 · 새것 한도 9), 엔진의 이유 줄, 제시 · 전달 · 도움 · 답 차례, 판 끝 finishSet', async () => {
  const { coach, port, time } = await engineCoach();
  const spy = traced(coach);
  const { runner } = await throughDoor(spy.coach);
  spy.calls.length = 0;
  const { round, out } = playChecks(runner, time, { choose: (i, item) => (i === 1 ? (item.correct + 1) % 3 : item.correct), replay: (i) => i === 2 });
  assert.equal(out.length, CHECK_LENGTH);
  assert.equal(round.total, 3);
  assert.deepEqual(round.kinds(), ['engine', 'engine', 'engine'], '빈 기억 손님은 엔진이 끝까지 고른다');
  const names = spy.names().filter((name) => ['recommend', 'present', 'finishSet'].includes(name));
  assert.deepEqual(names, ['recommend', 'present', 'recommend', 'present', 'recommend', 'present', 'finishSet']);
  const asked = spy.calls.filter((call) => call.name === 'recommend');
  assert.deepEqual(asked[0].args[1], { set: { length: 3, newLimit: 9 } });
  assert.ok(asked[0].args[0].every((row) => typeof row.itemKey === 'string' && row.checkId), '후보는 자료만 — 문을 지난다');
  assert.equal(asked[0].args[0].length, 12);
  assert.equal(asked[1].args[0].length, 11, '이 판에 낸 확인은 다시 후보가 아니다');
  out.forEach(({ plan }, i) => {
    assert.equal(plan.note, asked[i].result.why.line, `문항 ${i + 1}의 이유는 엔진의 why.line`);
    assert.equal(plan.followup, null, '즉시 확인 바꿔 넣기는 쓰지 않는다');
  });
  assert.deepEqual(out.map(({ result }) => result.verdict), ['correct', 'incorrect', 'correct']);
  assert.equal(new Set(out.map(({ plan }) => plan.item.id)).size, 3);
  assert.deepEqual(spy.calls.filter((call) => call.name === 'finishSet').map((call) => call.args[0]), [{ record: false }]);
  round.end();
  assert.equal(spy.names().filter((name) => name === 'finishSet').length, 1, '두 번 닫지 않는다');
  // 근거는 저장 뒤 약속 — 처음 듣고 혼자 맞힌 첫 답.
  const proof = await out[0].result.evidence;
  assert.equal(proof.stored, true);
  assert.equal(proof.independent, true);
  await settle();
  const rows = await eventsOf(port);
  const presented = rows.filter((event) => event.type === 'practice.presented');
  assert.deepEqual(presented.map((event) => event.itemKey), out.map(({ plan }) => checkMetadata(plan.item).itemKey));
  assert.ok(presented.every((event) => event.arm !== 'host' && event.confounded === false), '엔진이 고른 제시');
  out.forEach(({ pid }, i) => assert.deepEqual(groupOf(rows, pid), ['practice.delivery', 'practice.delivery', ...(i === 2 ? ['practice.helped'] : []), 'practice.attempted'], `문항 ${i + 1}`));
  const attempts = rows.filter((row) => row.type === 'practice.attempted');
  assert.ok(attempts.every((row) => row.choice?.selectedId && row.choice?.correctId), '고른 보기를 싣는다');
  coach.dispose();
});

test('같은 날 넷째 게임 — 첫 확인부터 none이어도 3문항 끝까지, none 자리는 게임 차례로 이유 줄 없이 제품 차례로 낸다', async () => {
  const port = atlas.memoryPort(), key = newKey(), time = clock();
  const other = await spendNewToday(port, key, time);
  const { coach } = await engineCoach({ port, key, time });
  const spy = traced(coach);
  const { runner } = await throughDoor(spy.coach);
  const { round, out } = playChecks(runner, time);
  assert.equal(out.length, 3, 'none이어도 놀이는 멈추지 않는다');
  const results = spy.calls.filter((call) => call.name === 'recommend').map((call) => call.result);
  assert.equal(results[0].status, 'none', '같은 날 넷째 게임 — 첫 추천부터 none');
  results.forEach((result, i) => assert.equal(round.kinds()[i], result.status === 'none' ? 'game' : result.status === 'idle' ? 'idle' : 'engine', `문항 ${i + 1}`));
  const none = results.map((result, i) => [result.status, i]).filter(([status]) => status === 'none').map(([, i]) => i);
  for (const i of none) assert.equal(out[i].plan.note, '', '게임 차례 문항에는 이유 줄이 없다');
  assert.equal(out[0].plan.item.id, LISTENING_CHECKS[0].id, '게임 차례 — 원고 차례의 첫 확인');
  await settle();
  const presented = (await presentedOf(port)).filter((event) => event.itemKey.startsWith('korean-runner.'));
  assert.equal(presented.length, 3);
  for (const i of none) assert.ok(presented[i].arm === 'host' && presented[i].reason.code === 'host.order', `문항 ${i + 1}은 제품 차례로 남는다`);
  // 달리기도 그대로 끝까지 간다(게임 차례).
  const { shown } = playRun(runner, time);
  assert.ok(shown.length >= 8);
  other.dispose(); coach.dispose();
});

test('듣기 확인의 게임 차례 — 엔진이 늘 none이면 아직 못 들어 본 확인 먼저, 이 판에 없는 듣기 꼴 먼저, 원고 차례', () => {
  const asked = [];
  const exposures = (list) => list.map((row) => ({ seen: row.checkId === 'check-star-middle' }));
  const fake = { recommend: (list, options) => { asked.push(options); return { status: 'none', selected: null, why: null }; }, present: () => 'p', finishSet: () => {}, itemUnits: () => [{ unit: 'u' }], exposures };
  const runner = createRunner(fake);
  const round = runner.checks();
  const picked = [round.next(), round.next(), round.next()];
  assert.deepEqual(picked.map((plan) => plan.item.id), ['check-wide-left', 'check-not-middle', 'check-duck-jump'], '들어 본 별 길은 뒤로, 세부 · 부정 · 순서 하나씩');
  assert.deepEqual(picked.map((plan) => checkMetadata(plan.item).skillId), SHAPES);
  assert.ok(picked.every((plan) => plan.note === '' && plan.engine === false));
  assert.deepEqual(round.kinds(), ['game', 'game', 'game']);
  assert.equal(round.next().status, 'finished');
  assert.equal(asked.length, 3, '문항마다 엔진에 먼저 묻는다');
  // 겉이 닫혀 만남을 읽지 못하면 원고 차례 · 듣기 꼴만으로 고른다.
  const blind = createRunner({ ...fake, exposures: () => { throw Object.assign(new Error('닫힘'), { code: 'RUN_ENDED' }); } }).checks();
  assert.deepEqual([blind.next(), blind.next(), blind.next()].map((plan) => plan.item.id), ['check-star-middle', 'check-not-middle', 'check-duck-jump']);
});

test('같은 날 여러 판의 듣기 확인 — idle(채우기)은 엔진이 고른 문항, none은 게임 차례, ready는 엔진', async () => {
  const { coach, time } = await engineCoach();
  const spy = traced(coach);
  const { runner } = await throughDoor(spy.coach);
  const statuses = [];
  for (let n = 0; n < 4; n += 1) {
    const from = spy.calls.length;
    const { round, out } = playChecks(runner, time, { choose: (i, item) => (i === 0 ? (item.correct + 2) % 3 : item.correct) });
    assert.equal(out.length, 3, `판 ${n + 1}`);
    const results = spy.calls.slice(from).filter((call) => call.name === 'recommend').map((call) => call.result);
    results.forEach((result, i) => {
      statuses.push(result.status);
      assert.equal(round.kinds()[i], { none: 'game', idle: 'idle', ready: 'engine' }[result.status], `판 ${n + 1} 문항 ${i + 1}`);
      if (result.status === 'none') assert.equal(out[i].plan.note, '');
      else assert.equal(out[i].plan.item.id, result.selected.checkId, '엔진이 고른 확인 그대로(원래 후보로 되맞춤)');
    });
    time.advance(120_000);
  }
  assert.ok(statuses.includes('ready'));
  coach.dispose();
});

test('진짜 듣기 확인 화면 — 문항마다 고르고, 근거 줄은 저장 뒤에 쓰고, 닫으면 판을 기록 없이 닫는다', async (t) => {
  const { coach, port, time } = await engineCoach();
  const spy = traced(coach);
  const { runner } = await throughDoor(spy.coach);
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  class Element {
    constructor() { this.children = []; this.dataset = {}; this.open = false; this._text = ''; this.nodes = new Map(); this.classList = { toggle() {} }; }
    set textContent(text) { this._text = String(text); this.children = []; }
    get textContent() { return this._text + this.children.map((node) => (typeof node === 'string' ? node : node.textContent)).join(''); }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this._text = ''; this.children = nodes; }
    querySelector(selector) { if (!this.nodes.has(selector)) this.nodes.set(selector, new Element()); return this.nodes.get(selector); }
    setAttribute() {} addEventListener() {} focus() {} scrollIntoView() {}
    showModal() { this.open = true; } close() { this.open = false; }
  }
  class AudioContext {
    constructor() { this.state = 'running'; this.currentTime = 0; }
    createGain() { return { gain: { value: 0 }, connect() {} }; }
    decodeAudioData() { return Promise.resolve({ duration: 1 }); }
    createBufferSource() { return { connect() {}, stop() {}, start() { queueMicrotask(() => { time.advance(2500); this.onended?.(); }); } }; }
  }
  const nodes = new Map(), $ = (id) => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); };
  const globals = { document: { getElementById: $, createElement: () => new Element(), addEventListener() {} }, window: { AudioContext },
    requestAnimationFrame() {}, addEventListener() {}, fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }) };
  const previous = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  t.after(() => { for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
  let prepared = 0;
  const ui = mountListeningCheck({ coach: () => runner.coach, createRound: () => runner.checks(), prepare: () => { prepared += 1; return null; }, beforeOpen: () => true });
  spy.calls.length = 0;
  await $('listening-check').onclick(); await tick();
  assert.equal(prepared, 1);
  for (let i = 0; i < 3; i += 1) {
    await tick();
    const state = ui.state();
    assert.equal(state.audio, 'completed');
    assert.ok($('check-plan').textContent.length > 0, '엔진이 고른 문항의 이유 줄');
    $('check-choices').children[i === 1 ? (state.correct + 1) % 3 : state.correct].onclick();
    await settle();
    assert.match($('check-feedback').textContent, i === 1 ? /다시 확인해요/ : /맞았어요/);
    assert.match($('check-feedback').textContent, i === 0 ? /처음 듣고 혼자 답한 기록이에요/ : /처음 듣고 혼자 답한 기록이에요|혼자 해낸 기록으로 세지 않았어요/, '근거 줄은 저장 뒤 약속에서');
    if (i === 0) {
      // 답한 뒤 다시 듣기는 복습이다 — 뒤 답 · 도움 · 전달을 남기지 않는다.
      const before = spy.calls.length;
      await $('check-replay').onclick(); await tick(); await tick();
      assert.equal(spy.calls.length, before, '답한 뒤 다시 듣기는 기록하지 않는다');
    }
    $('check-next').onclick(); await tick();
  }
  assert.equal($('listening-check-dialog').open, false, '셋째 뒤 판을 마친다');
  assert.deepEqual(spy.names().filter((name) => ['recommend', 'present', 'answer', 'finishSet'].includes(name)),
    ['recommend', 'present', 'answer', 'recommend', 'present', 'answer', 'recommend', 'present', 'answer', 'finishSet']);
  // 둘째 판을 열고 첫 문항을 듣는 중에 닫으면: 그 제시는 판정 못 한 답으로 닫히고, 그 뒤에 판을 닫는다.
  spy.calls.length = 0;
  await $('listening-check').onclick(); await tick();
  ui.close();
  assert.deepEqual(spy.names().filter((name) => ['recommend', 'present', 'answer', 'finishSet'].includes(name)), ['recommend', 'present', 'answer', 'finishSet']);
  await settle();
  const rows = await eventsOf(port);
  const last = rows.filter((row) => row.type === 'practice.attempted').at(-1);
  assert.ok(['unassessed', 'skipped'].includes(last.verdict) && ['unanswered', 'audio'].includes(last.reason), `${last.verdict} ${last.reason}`);
  coach.dispose();
});

test('순간 맞춤 — 오늘 「피곤」과 달리기 속도를 읽고, 한 제시는 Flow를 한 번만 움직인다', async () => {
  const { coach, time } = await engineCoach({ prefs: { today: () => 'tired' } });
  const { runner } = await throughDoor(coach);
  assert.equal(runner.coach.today(), 'tired');
  const flow = runner.coach.live(FLOW_RUN, { words: FLOW_WORDS, declared: TIRED_RUN });
  assert.equal(flow.intro().line?.text, FLOW_WORDS['start.tired']);
  assert.equal(flow.settings().values.ramp, 0, '피곤한 날은 판 안에서 빨라지지 않는다');
  const { shown, seen, model } = playRun(runner, time, { flow });
  const resolved = model.answers.length;
  assert.ok(resolved >= 8);
  assert.equal(flow.trace().length, seen.length, '관찰마다 한 번');
  assert.ok(seen.every((out) => !out.change || out.change.direction < 0), '피곤한 날은 빨라지지 않는다');
  // 같은 부탁의 결과를 또 넘겨도(같은 제시) 몫이 없다.
  const pid = shown.find((m) => m.resolved).presentationId;
  const again = runner.observe(flow, { outcome: 'success' }, pid);
  assert.equal(again.change, null);
  assert.equal(flow.trace().length, seen.length, '같은 제시의 둘째 관찰은 Flow를 움직이지 않는다');
  // 부탁 밖의 장애물(제시 없음)은 몫과 상관없이 관찰된다.
  runner.observe(flow, runObservation({ type: 'hit', mission: null }));
  assert.equal(flow.trace().length, seen.length + 1);
  flow.end();
  coach.dispose();
});

test('순간 맞춤 — 부탁을 자꾸 놓치면 바람이 느긋해진다(속도 손잡이가 움직임), 놓친 부탁마다 한 번', async () => {
  const { coach, time } = await engineCoach();
  const { runner } = await throughDoor(coach);
  const flow = runner.coach.live(FLOW_RUN, { words: FLOW_WORDS });
  assert.equal(flow.intro().line, null, '처음 달리는 사람은 원래 바람길 그대로');
  assert.deepEqual(paceOf(flow.settings().values), { speed: 13, ramp: 0.055 });
  const laneOnly = (m) => m.instruction.steps.every((step) => step.action === 'lane');
  const { seen } = playRun(runner, time, { flow, miss: laneOnly });
  const eased = seen.filter((out) => out.change);
  assert.ok(eased.length >= 1, '놓치면 느긋해진다');
  assert.ok(eased.every((out) => out.change.direction < 0));
  assert.ok(eased.some((out) => out.line?.text === FLOW_WORDS['ease.pace']));
  assert.equal(flow.trace().length, seen.length);
  flow.end();
  coach.dispose();
});

/* ── 순간 맞춤 진입(4-6e-2 — 설계 주인 11-21) ── */
// app.mjs의 startLive를 원문 그대로 돌린다. 셸 코치의 live는 가짜다 — 문이 옮겨 온 인자(spec, options)를 적고 진짜 엔진 코치의 live에
// 넘긴다(엔진은 거기서 내용을 정의하고, 막기에 걸리면 던진다). 엔진이 던지면 적어 두고 그대로 던진다. startLive는 그 던짐을 삼키고
// 순간 맞춤만 끄므로, 시험은 적힌 던짐과 adaptive로 본다.
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
function liveStarter() {
  const text = readFileSync(new URL('./app.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const from = text.indexOf('let live = null;\nfunction startLive()');
  const to = text.indexOf('function followPace(', from);
  assert.ok(from >= 0 && to > from, 'app.mjs의 순간 맞춤 열기 토막');
  return new Function('env', `with (env) {\n${text.slice(from, to)}\nreturn () => { const pace = startLive(); return { live, pace }; };\n}`);
}

test('순간 맞춤 진입 — app.mjs가 달리기마다 넘긴 내용을 진짜 엔진이 정의하고 달리는 속도의 순간 맞춤이 켜진다, 피곤한 날은 갈수록 빨라지지 않는다', async () => {
  for (const today of [null, 'tired']) {
    const { coach } = await engineCoach({ prefs: { today: () => today } });
    const { shell, got } = liveSpy(coach);
    const { runner } = await throughDoor(shell);
    const env = { coach: runner.coach, learningFailed: false, FLOW_RUN, FLOW_WORDS, TIRED_RUN, paceOf };
    const opened = liveStarter()(env)();
    assert.equal(got.length, 1, `${today}: 달리기마다 순간 맞춤 하나`);
    assert.equal(got[0].spec.id, FLOW_RUN.id);
    assert.equal(got[0].error, null, `진짜 엔진이 받지 않은 내용 — 게임은 삼키고 순간 맞춤만 꺼진다: ${got[0].error?.message}`);
    assert.equal(got[0].adaptive, true, `${today}: 달리기는 순간 맞춤이 켜진다`);
    assert.ok(opened.live, '게임이 순간 맞춤 겉을 쥔다');
    assert.deepEqual(Object.keys(opened.pace), ['speed', 'ramp']);
    if (today === 'tired') {
      assert.deepEqual(got[0].options.declared, TIRED_RUN);
      assert.equal(opened.pace.ramp, 0, '피곤한 날은 갈수록 빨라지지 않는다');
    } else assert.equal(got[0].options.declared, undefined);
    coach.dispose();
  }
});

test('판을 다시 정하면 이번 판은 기록 없이 잇고, 다음 판은 문을 다시 열어 새 겉을 받는다', async () => {
  const { coach, time } = await engineCoach();
  const spy = traced(coach);
  const { runner, retire, win } = await throughDoor(spy.coach);
  const play = runner.run();
  const model = new RunnerModel({ seed: 3, chooseInstruction: play.instruction });
  let presented = 0, after = null, flow = runner.coach.live(FLOW_RUN, { words: FLOW_WORDS });
  while (!model.finished) {
    driveDemo(model); model.step(0.05); time.advance(50);
    for (const n of model.drain()) {
      if (n.type === 'instruction') {
        presented += 1;
        if (presented === 3) { retire(); after = spy.calls.length; assert.equal(runner.stale, true); }
        n.mission.presentationId = runner.coach.present(instructionMetadata(n.mission.instruction));
        runner.coach.delivery(n.mission.presentationId, { audio: 'completed' });
        if (presented >= 3) assert.equal(n.mission.presentationId, null, '닫힌 겉에는 내지 않는다');
      }
      if (n.type === 'correct' || n.type === 'wrong') runner.coach.answer(n.mission.presentationId, actionEvidence(n.mission, n.type === 'correct'));
      const observation = runObservation(n);
      if (observation && flow) { try { runner.observe(flow, observation, n.mission?.presentationId); } catch (error) { assert.equal(ended(error), true); flow = null; } }
    }
  }
  assert.equal(model.reason, 'tour', '놀이는 끝까지 간다');
  assert.equal(flow, null, '닫힌 손잡이는 RUN_ENDED');
  assert.doesNotThrow(() => play.end());
  assert.equal(spy.calls.length, after, '닫힌 뒤에는 셸 코치에 닿지 않는다');
  assert.equal(runner.coach.today(), null);
  // 다음 판: 같은 문으로 다시 연다 — 새 겉.
  const fresh = await openRunner({ win });
  assert.ok(fresh);
  assert.equal(fresh.stale, false);
  const { shown } = playRun(fresh, time);
  assert.ok(shown.every((m) => typeof m.presentationId === 'string'), '다음 판은 다시 기록된다');
  coach.dispose();
});

test('원문 — 꺼진 판은 새 길 모듈을 싣지 않고 옛 코치를 지금 자리에서 같은 인수로 만든다', () => {
  const source = readFileSync(new URL('./app.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const imports = [...source.matchAll(/^import\s[^;]*?from\s+'([^']+)'/gm)].map((match) => match[1]);
  assert.ok(imports.includes('./kit/atlas-next.mjs'), '키트는 정의뿐이라 정적으로 싣는다');
  assert.ok(!imports.some((path) => path.includes('atlas-next-play')), '새 길 모듈은 정적 import에 없다');
  assert.equal([...source.matchAll(/import\('\.\/atlas-next-play\.mjs'\)/g)].length, 1, '새 길 모듈을 부르는 곳은 하나');
  assert.match(source, /async function openNextCoach\(\) \{\n  let opened = null;\n  try \{ opened = await \(await import\('\.\/atlas-next-play\.mjs'\)\)\.openRunner\(/, '문 · 개발 깃발이 있을 때만 동적으로 부른다');
  assert.ok(source.includes("try { coach = globalThis.SynkLearning?.createGame({ gameId: 'korean-runner', storage: localStorage }) || null; } catch { learningFailed = true; }"), '옛 코치는 지금과 같은 인수');
  assert.match(source, /const atlasNext = !!\(nextDoor\(window\) \|\| devFlag\(window\)\);/);
  assert.match(source, /\nif \(!atlasNext\) openOldCoach\(\);\n/, '문이 없으면 이 자리에서 동기로 옛 코치');
  assert.match(source, /\nif \(atlasNext\) await openNextCoach\(\);\n/, '문이 있을 때만 기다린다');
  // 세 줄이 모두 있는지 먼저 본다 — 없으면 indexOf가 -1이라 차례 단언이 늘 참이다. 그리기 고리는 frame 함수 안의 다음 프레임 요청이 아니라
  // 맨 위(줄머리)의 첫 호출이다(끝 판 F6 ②).
  const wait = source.search(/^if \(atlasNext\) await openNextCoach\(\);\r?$/m);
  const world = source.search(/^if \(WORLD\) setupWorld\(\);\r?$/m);
  const loop = source.search(/^requestAnimationFrame\(frame\);\r?$/m);
  assert.ok(wait > 0 && world > 0 && loop > 0, '기다림 · WORLD 문구 · 그리기 고리 줄이 있다');
  assert.ok(world < wait, '그리기 고리와 WORLD 문구 뒤에서 기다린다');
  assert.ok(loop < wait, '맨 위 그리기 고리를 기다림 앞에서 돌린다');
  assert.equal(source.includes('/atlas/'), false, '게임이 입구를 직접 부르지 않는다');
  // 이 폴더의 다른 파일도 새 길 모듈을 정적으로 싣지 않는다.
  for (const name of readdirSync(new URL('.', import.meta.url))) {
    if (!/\.(m?js)$/.test(name) || name === 'atlas-next-play.mjs' || name.endsWith('.test.mjs')) continue;
    const text = readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');
    assert.ok(!/from\s+'\.\/atlas-next-play\.mjs'/.test(text), name);
  }
  // 새 길 모듈은 옛 길의 것(return-practice · 옛 요약 · events · recheck · 기록 지우기 · syncPort)을 쓰지 않는다.
  const next = readFileSync(new URL('./atlas-next-play.mjs', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  for (const word of ['returnPractice', 'missedCheck', 'skillReport', 'runReason', 'chooseInstruction', 'createListeningCheckRound', 'events(', 'syncPort', 'reset(', 'recheck', 'assignment']) assert.equal(next.includes(word), false, word);
});
