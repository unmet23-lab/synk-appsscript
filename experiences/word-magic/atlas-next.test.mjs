// 낱말 마법의 새 길(Atlas 재설계 4-6d — 단계4_계획 §23-7 · §23-10 「게임」). 진짜 엔진 코치(손님 · 메모리 저장소)를 셸의 게임 문
// (synk-world-app/world-atlas-game.mjs createGameDoor)에 넣고, 문을 거친 그대로(인수 복제) atlas-next-play.mjs의 겉으로 소리 확인 판을 돈다.
// 보는 것: 장마다 확인 둘이 판 하나(recommend 없이 present만 — 제품 차례) · 제시 → 전달 → 답 → 도움의 차례 · 첫 고르기만 답 · 판 끝 finishSet ·
// 답하기 전에 떠나면 skipped · 소리를 못 들은 답은 판정 못 함 · 지도에 없는 문항은 내지 않음 · 판을 다시 정하면 기록 없이 이어 감 ·
// 문이 null이면 옛 길 · RUN_ENDED는 옛 길을 열지 않음. 코치에 startSet이 있으면(가짜 코치) 판마다 첫 제시 앞에서 판 길이 2를 한 번 넘김.
// 끝에 원문 검사(꺼진 판은 새 길 모듈을 싣지 않는다).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { checkpoint, checkpointRound } from './core.mjs';
import { GAME_ID, checkpointMetadata } from './learning.mjs';
import { BANKS, SET_LENGTH, createMagic, openMagic } from './atlas-next-play.mjs';
import { createGameDoor, GAME_BANKS } from '../synk-world-app/world-atlas-game.mjs';

const atlas = await import('../../packages/atlas/src/index.mjs');
const json = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const mapData = { index: json('../../packages/atlas/map/index.json'), units: json('../../packages/atlas/map/units.json') };
const T0 = Date.UTC(2026, 10, 19, 1, 0, 0); // 서울 오전 10시
const clock = (start = T0) => { const s = { t: start }; return { now: () => s.t, advance: (ms) => { s.t += ms; } }; };
let stores = 0;
const newKey = () => `synk-atlas:word-magic-test-${process.pid}-${(stores += 1)}`;
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

async function engineCoach({ gameId = GAME_ID, port = atlas.memoryPort(), key = newKey(), time = clock() } = {}) {
  const coach = atlas.createCoach({ gameId, mapData, dayOffset: 540, host: { guest: true, port, key, now: time.now } });
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
async function throughDoor(coach, { give = () => coach, old = () => 'old' } = {}) {
  const retirers = new Set();
  const entry = { gameCoach: async () => give(), retired: (_made, fn) => { retirers.add(fn); return () => retirers.delete(fn); } };
  const door = createGameDoor({ entry, gameId: 'word-magic', later: (fn) => fn() });
  const top = { SYNKAtlasGame: door.api };
  const leaving = [];
  const win = { parent: top, top, addEventListener: (type, fn) => { if (type === 'pagehide') leaving.push(fn); }, location: { hostname: 'synk.im', search: '' } };
  const magic = await openMagic({ win, old });
  return { magic, door, win, retire: () => [...retirers].forEach((fn) => fn({ reason: 'account' })), pagehide: () => leaving.splice(0).forEach((fn) => fn()) };
}

// app.mjs의 소리 확인 하나와 같은 차례: startCheck(abandon → present) → 다 들음(전달) → 도움(있으면) → 고르기(첫 고르기만 답) → 틀리면 힌트 도움.
function playCheck(magic, check, time, { index = 0, right = true, help = null, heard = true, again = false } = {}) {
  magic.abandon(index > 0);
  const pid = magic.present(check);
  time.advance(1500);
  magic.delivery(heard);
  if (help) magic.help(help);
  time.advance(1500);
  const rec = magic.answer(right);
  if (!right) magic.help('hint');
  // 틀린 뒤 다시 고르기 — 게임 규칙, 코치에 보내지 않는다.
  const retry = again ? magic.answer(true) : undefined;
  time.advance(800);
  return { pid, rec, retry };
}

// 저장소의 사건(메모리 포트의 줄 { key, value: { kind: 'event', event } }).
const eventsOf = async (port) => (await port.read()).map((row) => row.value).filter((value) => value?.kind === 'event').map((value) => value.event);
const presentedOf = async (port) => (await eventsOf(port)).filter((event) => event.type === 'practice.presented');
const groupOf = (rows, pid) => rows.filter((row) => row.presentationId === pid);
const fixedRandom = (...values) => { let i = 0; return () => values[i++ % values.length]; };

test('은행 이름은 셸의 게임 은행 표와 같고, 판은 장마다 확인 둘이다', () => {
  assert.deepEqual([...BANKS], [...GAME_BANKS['word-magic']]);
  assert.equal(SET_LENGTH, checkpointRound(0).length);
  // 은행의 문항 여섯이 소리 확인 여섯과 같다(장 셋 × 둘).
  const keys = [0, 1, 2].flatMap((chapter) => [0, 1].map((index) => checkpointMetadata(checkpoint(chapter, index)).itemKey)).sort();
  assert.deepEqual(atlas.openMap(mapData).items('word-magic').map((item) => item.itemKey).sort(), keys);
});

test('문이 없으면 옛 길(old), 셸이 지금 판이면 옛 길, 문이 닫히는 중이면(RUN_ENDED) 옛 길을 열지 않는다', async () => {
  let olds = 0;
  const old = () => { olds += 1; return 'old'; };
  assert.equal(await openMagic({ win: { parent: null, top: null, location: { hostname: 'synk.im', search: '?atlas=next' } }, old }), 'old', '공개 주소는 개발 깃발을 읽지 않는다');
  const now = await throughDoor(null, { give: () => null, old });
  assert.equal(now.magic, 'old');
  assert.equal(olds, 2);
  // 기다리던 open이 패널 닫힘으로 끝나면 null이 아니라 RUN_ENDED — 옛 길을 열지 않고 null(기록 없이 논다).
  let release;
  const { coach } = await engineCoach();
  const entry = { gameCoach: () => new Promise((resolve) => (release = () => resolve(coach))), retired: () => () => {} };
  const door = createGameDoor({ entry, gameId: 'word-magic', later: (fn) => fn() });
  const top = { SYNKAtlasGame: door.api };
  const opening = openMagic({ win: { parent: top, top, addEventListener() {} }, old });
  door.dispose(); release();
  assert.equal(await opening, null);
  assert.equal(olds, 2, '옛 코치를 만들지 않는다');
  coach.dispose();
});

test('빈 기억 손님의 한 장 — 확인 둘을 recommend 없이 present만, 제시 · 전달 · 답 · 도움 차례, 첫 고르기만 답, 판 끝 finishSet 한 번', async () => {
  const { coach, port, time } = await engineCoach();
  const spy = traced(coach);
  const { magic } = await throughDoor(spy.coach);
  const round = checkpointRound(0, fixedRandom(0.7, 0.2, 0.9));
  const first = playCheck(magic, round[0], time, { index: 0, right: false, again: true });
  assert.equal(first.retry, null, '다시 고르기는 코치에 보내지 않는다');
  assert.equal(first.rec.verdict, 'incorrect');
  const second = playCheck(magic, round[1], time, { index: 1, help: 'replay' });
  assert.equal(second.rec.verdict, 'correct');
  assert.equal(spy.names().includes('finishSet'), false, '같은 장의 둘째 확인까지 판을 잇는다');
  magic.abandon(); // 모험 끝(showEnding)
  magic.abandon(); // 처음으로(showHome) — 닫은 판을 다시 닫지 않는다
  assert.deepEqual(spy.names(), ['itemUnits', 'startSet', 'present', 'delivery', 'answer', 'help', 'itemUnits', 'present', 'delivery', 'help', 'answer', 'finishSet'], '판 길이(2)는 첫 제시 앞에서 한 번');
  assert.deepEqual(spy.calls.find((call) => call.name === 'finishSet').args, [{ record: false }]);
  assert.deepEqual(spy.calls.filter((call) => call.name === 'present').map((call) => call.args[0]), round.map(checkpointMetadata), '문을 지나도 옛 겉과 같은 문항 자료');
  assert.deepEqual(spy.calls.filter((call) => call.name === 'answer').map((call) => call.args[1]), [{ correct: false, assessable: true }, { correct: true, assessable: true }]);
  await Promise.all([first.rec.stored, second.rec.stored]);
  await settle();
  const rows = await eventsOf(port);
  const presented = rows.filter((event) => event.type === 'practice.presented');
  assert.deepEqual(presented.map((event) => event.itemKey), round.map((check) => checkpointMetadata(check).itemKey));
  assert.ok(presented.every((event) => event.arm === 'host' && event.reason.code === 'host.order'), '제품 차례 — 이유 줄이 없다');
  assert.equal(presented[0].setId, presented[1].setId, '한 장의 확인 둘이 한 판');
  assert.deepEqual(groupOf(rows, first.pid).map((row) => row.type), ['practice.delivery', 'practice.attempted', 'practice.helped']);
  assert.deepEqual(groupOf(rows, second.pid).map((row) => row.type), ['practice.delivery', 'practice.helped', 'practice.attempted']);
  assert.deepEqual(rows.filter((row) => row.type === 'practice.attempted').map((row) => [row.verdict, row.attemptNo]), [['incorrect', 1], ['correct', 1]], '제시마다 첫 답 하나');
  assert.deepEqual(rows.filter((row) => row.type === 'practice.helped').map((row) => row.helpId), ['hint', 'replay']);
  coach.dispose();
});

test('판의 경계 — 같은 장의 셋째 확인 · 다른 장 · 떠남은 앞 판을 닫고 새 판을 연다', async () => {
  const { coach, port, time } = await engineCoach();
  const spy = traced(coach);
  const { magic } = await throughDoor(spy.coach);
  const round = checkpointRound(1, fixedRandom(0.1));
  playCheck(magic, round[0], time, { index: 0 });
  playCheck(magic, round[1], time, { index: 1 });
  // 모험을 다시 놀다 같은 장의 확인을 또 낸다(abandon(keep)이어도 판 길이를 넘으면 새 판).
  playCheck(magic, round[0], time, { index: 1 });
  assert.equal(spy.names().filter((name) => name === 'finishSet').length, 1);
  // 다른 장의 확인 — 새 판.
  playCheck(magic, checkpoint(2, 0), time, { index: 1 });
  assert.equal(spy.names().filter((name) => name === 'finishSet').length, 2);
  magic.abandon();
  assert.equal(spy.names().filter((name) => name === 'finishSet').length, 3);
  await settle();
  const sets = (await presentedOf(port)).map((event) => event.setId);
  assert.equal(sets.length, 4);
  assert.equal(sets[0], sets[1]);
  assert.equal(new Set(sets).size, 3);
  coach.dispose();
});

test('답하기 전에 떠나면 저장된 판정이 skipped, 소리를 못 들은 답은 판정 못 함(audio)', async () => {
  const { coach, port, time } = await engineCoach();
  const { magic } = await throughDoor(coach);
  // 다 듣고 떠남 — 옛 길의 reason 'skip'이 skipped로(GPT 다시 검토 GA7).
  const left = magic.present(checkpoint(0, 0));
  time.advance(1500); magic.delivery(true); time.advance(1000);
  magic.abandon();
  // 소리가 끝나기 전에 멈춤 → 그대로 고름.
  playCheck(magic, checkpoint(0, 1), time, { index: 0, heard: false });
  // 듣지 못한 채 떠남.
  const unheard = magic.present(checkpoint(1, 0));
  magic.delivery(false);
  magic.abandon();
  await settle();
  const rows = await eventsOf(port);
  const attempts = rows.filter((row) => row.type === 'practice.attempted');
  assert.deepEqual(attempts.map((row) => [row.verdict, row.reason ?? null]), [['skipped', null], ['unassessed', 'audio'], ['skipped', null]]);
  assert.equal(attempts[0].presentationId, left);
  assert.equal(attempts[2].presentationId, unheard);
  assert.deepEqual(rows.filter((row) => row.type === 'practice.delivery').map((row) => row.audio), ['completed', 'failed', 'failed']);
  coach.dispose();
});

test('지도에 없는 문항은 내지 않는다 — 전달 · 답도 남지 않고 놀이는 그대로', async () => {
  const { coach, port, time } = await engineCoach();
  const spy = traced(coach);
  const { magic } = await throughDoor(spy.coach);
  const stray = { ...checkpoint(0, 0), meaningKey: 'size.wobble' };
  const run = playCheck(magic, stray, time);
  assert.equal(run.pid, null);
  assert.equal(run.rec, null);
  assert.deepEqual(spy.names(), ['itemUnits']);
  magic.abandon();
  await settle();
  assert.equal((await eventsOf(port)).length, 0);
  coach.dispose();
});

test('같은 날 다른 게임이 새 단위 한도를 다 써도 — 소리 확인은 제품 차례로 끝까지 낸다(이유 줄 없음)', async () => {
  const port = atlas.memoryPort(), key = newKey(), time = clock();
  const map = atlas.openMap(mapData);
  const own = new Set(map.items('word-magic').flatMap((item) => item.units));
  const pool = map.items('blank-slice').filter((item) => item.units.every((unit) => !own.has(unit))).map((item) => ({ itemKey: item.itemKey }));
  const other = (await engineCoach({ gameId: 'blank-slice', port, key, time })).coach;
  let last = null;
  for (let i = 0; i < 40; i += 1) {
    last = other.recommend(pool, { set: { length: 40, newLimit: 120 } });
    if (last.status !== 'ready') break;
    const pid = other.present(last.selected); time.advance(3000);
    other.answer(pid, { correct: true, assessable: true }); time.advance(3000);
  }
  assert.notEqual(last.status, 'ready', '그날의 새 단위 한도를 다 썼다');
  other.finishSet({ record: false });
  const { coach } = await engineCoach({ port, key, time });
  const spy = traced(coach);
  const { magic } = await throughDoor(spy.coach);
  const round = checkpointRound(0);
  const runs = round.map((check, index) => playCheck(magic, check, time, { index }));
  magic.abandon();
  assert.ok(runs.every((run) => run.pid && run.rec), '판 끝까지');
  assert.equal(spy.names().includes('recommend'), false);
  await settle();
  const mine = (await presentedOf(port)).filter((event) => event.itemKey.startsWith('word-magic.'));
  assert.equal(mine.length, 2);
  assert.ok(mine.every((event) => event.arm === 'host' && event.reason.code === 'host.order'));
  other.dispose(); coach.dispose();
});

test('판을 다시 정하면 이번 판은 기록 없이 잇고, 판이 끝나면(stale) 문을 다시 열어 새 겉으로 기록한다', async () => {
  const { coach, port, time } = await engineCoach();
  const spy = traced(coach);
  const { magic, retire, win } = await throughDoor(spy.coach);
  const round = checkpointRound(0, fixedRandom(0.3));
  playCheck(magic, round[0], time, { index: 0 });
  retire();
  assert.equal(magic.stale, false, '판이 끝나기 전에는 다시 열지 않는다');
  const before = spy.calls.length;
  const second = playCheck(magic, round[1], time, { index: 1 });
  assert.equal(second.pid, null);
  magic.abandon();
  assert.equal(spy.calls.length, before, '닫힌 뒤에는 셸 코치에 닿지 않는다');
  assert.equal(magic.stale, true);
  // 다음 판(app.mjs learningReady): 같은 문으로 다시 연다 — 새 겉.
  const fresh = await openMagic({ win, old: () => 'old' });
  assert.equal(fresh.stale, false);
  const again = playCheck(fresh, round[0], time, { index: 0 });
  assert.ok(again.pid);
  fresh.abandon();
  await settle();
  assert.equal((await presentedOf(port)).length, 2, '닫힌 판의 둘째 확인은 남지 않는다');
  coach.dispose();
});

test('틀이 떠나 겉이 닫히면(RUN_ENDED) 던지지 않고 기록 없이 잇는다 — 떠날 때의 답은 닫기보다 먼저 든다', async () => {
  const { coach, port, time } = await engineCoach();
  const { magic, pagehide } = await throughDoor(coach);
  const pid = magic.present(checkpoint(0, 0));
  time.advance(1500); magic.delivery(true);
  // app.mjs의 pagehide(abandon)가 키트의 pagehide(셸에 떠남을 알림)보다 먼저 걸려 있다.
  magic.abandon();
  pagehide();
  assert.doesNotThrow(() => playCheck(magic, checkpoint(0, 1), time, { index: 0 }));
  assert.doesNotThrow(() => magic.abandon());
  assert.equal(magic.stale, true);
  await settle();
  const attempts = (await eventsOf(port)).filter((row) => row.type === 'practice.attempted');
  assert.deepEqual(attempts.map((row) => [row.presentationId, row.verdict]), [[pid, 'skipped']]);
  coach.dispose();
});

// startSet이 있는 코치 흉내(엔진 startSet이 들어온 뒤의 꼴 — 설계 주인 11-19 밤). 열린 판이 있으면 새 판을 열지 않고({ opened: false }),
// present는 열린 판이 없으면 기본 판(길이 없음)을 연다. 부른 차례와 판마다 든 제시를 적는다.
function setCoach({ banked = () => true, startSet = null } = {}) {
  const calls = [];
  const sets = [];
  let open = null;
  let n = 0;
  const openSet = (length) => { open = { setId: `s${sets.length + 1}`, length, presents: [] }; sets.push(open); return open; };
  const coach = {
    itemUnits: (key) => { calls.push(['itemUnits', key]); return banked(key) ? [{ unit: 'u' }] : []; },
    startSet: (options) => {
      calls.push(['startSet', options]);
      if (startSet) return startSet(options);
      if (open) return { opened: false, setId: open.setId };
      return { opened: true, setId: openSet(options.length).setId };
    },
    present: (meta) => { calls.push(['present', meta.itemKey]); const pid = `p${(n += 1)}`; (open ?? openSet(null)).presents.push(pid); return pid; },
    delivery: () => { calls.push(['delivery']); },
    help: () => { calls.push(['help']); },
    answer: () => { calls.push(['answer']); return { verdict: 'recorded' }; },
    finishSet: (options) => { calls.push(['finishSet', options]); open = null; },
  };
  return { coach, calls, sets, names: () => calls.map((call) => call[0]) };
}
const setShapes = (fake) => fake.sets.map((set) => [set.length, set.presents.length]);

test('정해진 차례 판 — 장의 첫 확인을 내기 전에 문을 거쳐 startSet({ length: 2 })를 한 번 부르고, 둘째 확인은 같은 판에 든다', async () => {
  const fake = setCoach();
  const { magic } = await throughDoor(fake.coach);
  const time = clock();
  const round = checkpointRound(0, fixedRandom(0.7, 0.2, 0.9));
  playCheck(magic, round[0], time, { index: 0, right: false, again: true });
  playCheck(magic, round[1], time, { index: 1, help: 'replay' });
  magic.abandon(); // 모험 끝
  magic.abandon(); // 처음으로
  assert.deepEqual(fake.names(), ['itemUnits', 'startSet', 'present', 'delivery', 'answer', 'help', 'itemUnits', 'present', 'delivery', 'help', 'answer', 'finishSet']);
  assert.deepEqual(fake.calls.find((call) => call[0] === 'startSet')[1], { length: SET_LENGTH });
  assert.deepEqual(setShapes(fake), [[2, 2]], '코치의 기본 판을 열지 않는다');
});

test('정해진 차례 판 — 앞 판을 닫은 뒤 다음 판의 첫 확인 앞에서 startSet을 다시 부른다(같은 장의 셋째 확인 · 다른 장 · 이어 하기)', async () => {
  const fake = setCoach();
  const { magic } = await throughDoor(fake.coach);
  const time = clock();
  const round = checkpointRound(1, fixedRandom(0.1));
  playCheck(magic, round[0], time, { index: 0 });
  playCheck(magic, round[1], time, { index: 1 });
  playCheck(magic, round[0], time, { index: 1 }); // 판 길이를 넘음 — 새 판
  playCheck(magic, checkpoint(2, 0), time, { index: 1 }); // 다른 장 — 새 판
  magic.abandon();
  // 남은 소리 확인 이어 하기가 둘째 확인부터 낸다(app.mjs startCheck(1)) — 판을 열 때는 모르니 상한 2.
  playCheck(magic, checkpoint(0, 1), time, { index: 1 });
  magic.abandon();
  const order = fake.names().filter((name) => ['startSet', 'present', 'finishSet'].includes(name));
  assert.deepEqual(order, [
    'startSet', 'present', 'present', 'finishSet',
    'startSet', 'present', 'finishSet',
    'startSet', 'present', 'finishSet',
    'startSet', 'present', 'finishSet',
  ]);
  assert.ok(fake.calls.filter((call) => call[0] === 'startSet').every((call) => call[1].length === SET_LENGTH));
  assert.deepEqual(setShapes(fake), [[2, 2], [2, 1], [2, 1], [2, 1]], '판마다 새 판 — 열린 판에 startSet을 부르지 않는다');
});

test('정해진 차례 판 — 지도에 없는 문항만 낸 판은 열지 않고, startSet이 거절해도 제시는 기본 판으로 끝까지 간다', async () => {
  const time = clock();
  const stray = { ...checkpoint(0, 0), meaningKey: 'size.wobble' };
  const fake = setCoach({ banked: (key) => !key.includes('wobble') });
  const { magic } = await throughDoor(fake.coach);
  playCheck(magic, stray, time, { index: 0 });
  magic.abandon();
  assert.equal(fake.names().includes('startSet'), false, '빈 판을 열지 않는다');
  // 첫 확인이 지도에 없으면 둘째 확인 앞에서 연다.
  playCheck(magic, stray, time, { index: 0 });
  const run = playCheck(magic, checkpoint(0, 1), time, { index: 1 });
  magic.abandon();
  assert.ok(run.pid);
  assert.deepEqual(fake.names().filter((name) => ['startSet', 'present'].includes(name)), ['startSet', 'present']);
  assert.deepEqual(setShapes(fake), [[2, 1]]);

  const broken = setCoach({ startSet: () => { throw Object.assign(new Error('거절'), { code: 'SET_REFUSED' }); } });
  const opened = await throughDoor(broken.coach);
  const runs = checkpointRound(2).map((check, index) => playCheck(opened.magic, check, time, { index }));
  opened.magic.abandon();
  assert.ok(runs.every((one) => one.pid && one.rec), '판 끝까지');
  assert.equal(broken.names().filter((name) => name === 'startSet').length, 1, '거절된 판에 다시 묻지 않는다');
  assert.deepEqual(setShapes(broken), [[null, 2]], '첫 제시가 기본 판을 연다');
});

test('createMagic만으로도(개발 깃발의 혼자 뜨는 코치) 같은 겉이다', async () => {
  const { coach, port, time } = await engineCoach();
  const magic = createMagic(coach);
  const run = playCheck(magic, checkpoint(1, 1), time);
  magic.abandon();
  assert.equal(run.rec.verdict, 'correct');
  await settle();
  assert.equal((await presentedOf(port)).length, 1);
  coach.dispose();
});

test('원문 — 꺼진 판은 새 길 모듈을 싣지 않고 옛 코치를 지금 자리에서 같은 인수로 만든다', () => {
  const source = readFileSync(new URL('./app.mjs', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/^import\s[^;]*?from\s*'([^']+)'/gm)].map((match) => match[1]);
  assert.ok(!imports.includes('./kit/atlas-next.mjs'), '키트는 정적으로 싣지 않는다 — 새 길 모듈이 부른다(5-3 게임)');
  assert.ok(!imports.some((path) => path.includes('atlas-next-play')), '새 길 모듈은 정적 import에 없다');
  assert.equal([...source.matchAll(/import\('\.\/atlas-next-play\.mjs'\)/g)].length, 1, '새 길 모듈을 부르는 곳은 하나');
  assert.match(source, /const atlasNext=atlasGate\(window\);\r?\nconst voice=new VoiceBank\(\);let learning=atlasNext\?new MagicLearning\(null\):new MagicLearning\(globalThis\.SynkLearning,storage\),learningOpening=atlasNext\?openLearning\(\):null;/, '문이 없으면 이 자리에서 동기로 옛 코치(지금과 같은 인수)');
  assert.equal(source.includes('/atlas/'), false, '게임이 입구를 직접 부르지 않는다');
  assert.equal(source.match(/await learningReady\(\)/g)?.length, 2);
  for (const line of source.split(/\r?\n/).filter((text) => text.includes('learningReady()') && !text.startsWith('function')))
    assert.match(line, /if\(atlasNext/, '옛 길은 기다리지 않는다');
  // 이 폴더의 다른 파일도 새 길 모듈을 정적으로 싣지 않는다.
  for (const name of readdirSync(new URL('.', import.meta.url))) {
    if (!/\.(m?js)$/.test(name) || name === 'atlas-next-play.mjs' || name.endsWith('.test.mjs')) continue;
    const text = readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');
    assert.ok(!/from\s*'\.\/atlas-next-play\.mjs'/.test(text), name);
  }
  // 새 길 모듈은 고르기 · 순간 맞춤 · 옛 길의 것(return-practice · 옛 요약 · events · 기록 지우기 · syncPort · recheck)을 쓰지 않는다.
  const next = readFileSync(new URL('./atlas-next-play.mjs', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  for (const word of ['recommend', '.live(', 'returnPractice', 'skillReport', 'events(', 'syncPort', 'reset(', 'recheck', 'createGame']) assert.equal(next.includes(word), false, word);
});
