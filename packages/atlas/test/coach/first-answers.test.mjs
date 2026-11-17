// 예상 급수의 근거 수(coach.firstAnswers — 단계 4 계획 §21-23의 2, 설계 주인 11-17 답 1 · 2). 진짜 코치(손님 기록부 · 시계)로 시험 형식
// 판('world-mock')과 다른 게임의 판을 한 호스트에 지어 넣고, 그 게임의 판에서 처음 본 문항에 혼자 낸 채점된 첫 답만 능력마다 세는지 본다.
// 같은 사건 열을 메모리 서버에 접어 서버 셈(firstAnswersOfStore)이 같은 수를 내는지도 맞댄다. 규칙마다 tools/mutants/coach.mjs에 깬 변형이 있다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';
import { createMemoryAccount } from '../support/trail-world.mjs';
import { rng } from '../support/seeds.mjs';
import { clock, createCoach, fakeMap, memoryPort, PARAMS, T0 } from './support.mjs';

const { firstAnswersOfStore } = await subject('record/first.mjs');
const { foldAccount, foldEdition } = await subject('record/server.mjs');
const { createMemory } = await subject('memory/index.mjs');
const { createServer } = await import('../support/trail-sync.mjs');
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

const DAY = 86_400_000;
const MINUTE = 60_000;
const GAME = 'world-mock';
const skillOf = i =>
  i % 3 === 0 ? 'ko.listening.detail' : i % 3 === 1 ? 'ko.reading.main' : 'ko2.reading.detail';
const itemOf = i =>
  Object.freeze({
    itemKey: `m.i${i}`,
    familyKey: `m.f${i}`,
    skillId: skillOf(i),
    difficulty: 1,
    responseFormat: 'single-choice',
    units: Object.freeze([`ko.word.m${i}`]),
    order: i,
    modality: skillOf(i).split('.')[1],
  });
const ITEMS = Object.freeze(Array.from({ length: 16 }, (_, i) => itemOf(i)));
const START = T0 + 10 * 3_600_000;
const eventsOf = async port => (await port.read()).map(row => row.value.event).filter(Boolean);
const indexOfMap = map => ({ edition: 'index-t', lookup: key => map.item(key) });
let stores = 0;
const keyOf = tag => `synk-atlas:first-${process.pid}-${tag}-${(stores += 1)}`;

async function guest(time, { gameId = GAME, port = memoryPort(), key = keyOf('guest') } = {}) {
  const coach = createCoach({
    gameId,
    map: fakeMap(ITEMS),
    seed: 's',
    dayOffset: 0,
    host: { guest: true, port, key, now: time.now },
  });
  await coach.ready;
  return coach;
}
async function solo(coach, time, item, correct = true) {
  time.advance(MINUTE);
  const pid = coach.present(item);
  time.advance(MINUTE);
  const out = coach.answer(pid, { correct, assessable: true });
  await out.stored;
  return out.eventId;
}

// 장면 하나 — 시험 형식 코치(mock)와 다른 게임의 코치(other, 같은 저장소 · 같은 호스트)가 지은 사건. 근거가 되는 것은 i0 · i1 · i2 · i7
// (i1은 틀린 답이어도 혼자 낸 채점된 첫 답이다), 되지 않는 것은 나머지다(까닭은 줄마다).
async function scene(time) {
  const port = memoryPort();
  const key = keyOf('scene');
  const mock = await guest(time, { port, key });
  const other = await guest(time, { gameId: 'world-mock2', port, key });
  const dot = await guest(time, { gameId: 'world-mock.x', port, key });
  const I = ITEMS;
  await solo(mock, time, I[0]); // 근거(듣기)
  await solo(mock, time, I[1], false); // 근거(읽기) — 틀려도 혼자 낸 채점된 첫 답
  await solo(mock, time, I[2]); // 근거(TOPIK II 읽기)
  // i3: 답 전에 힌트를 봤다 — 첫 만남은 도움이다
  time.advance(MINUTE);
  const helped = mock.present(I[3]);
  mock.help(helped, 'hint');
  await mock.answer(helped, { correct: true, assessable: true }).stored;
  // i4: 다른 게임(world-mock2)의 판에서 먼저 만났다 — 뒤의 시험 형식 답은 첫 만남이 아니다
  await solo(other, time, I[4]);
  await solo(mock, time, I[4]);
  // i5: 이름에 점이 든 다른 게임(world-mock.x)의 판 — world-mock의 근거가 아니다
  await solo(dot, time, I[5]);
  // i6: 시험 형식 답의 응답을 지웠다 — 그 뒤에 다시 낸 답도 근거가 아니다(이미 본 문항의 뒤 답)
  const wiped = await solo(mock, time, I[6]);
  mock.exclude(wiped);
  await solo(mock, time, I[6]);
  // i7: 앞 판에서 띄우기만 하고 답하지 않았다 — 뒤 판의 답 하나가 근거다(띄운 제시는 만남이 아니다)
  time.advance(MINUTE);
  mock.present(I[7]);
  await mock.finishSet({ record: false }).folded;
  time.advance(31 * MINUTE);
  await solo(mock, time, I[7]);
  // i8: 판정할 수 없는 답(소리가 나지 않음) — 채점이 비어 근거가 아니고, 뒤 답도 첫 만남이 아니다
  time.advance(MINUTE);
  const silent = mock.present(I[8]);
  await mock.answer(silent, { correct: true, assessable: false, reason: 'audio' }).stored;
  await solo(mock, time, I[8]);
  await new Promise(resolve => setTimeout(resolve, 0));
  return { port, mock, other, dot, close: () => [mock, other, dot].forEach(c => c.dispose()) };
}

const WANT = { 'ko.listening.detail': 1, 'ko.reading.main': 1, 'ko2.reading.detail': 1 };
// i7(ko.reading.main — 7 % 3 = 1)이 더해진다.
WANT['ko.reading.main'] += 1;

test('그 게임의 판에서 처음 본 문항에 혼자 낸 채점된 첫 답만 능력마다 센다 — 도움 · 다른 게임 · 지운 답 · 판정 못 한 답은 빠진다', async () => {
  const time = clock(START);
  const s = await scene(time);
  try {
    const out = s.mock.firstAnswers({ game: GAME, days: 90 });
    assert.deepEqual(out.bySkill, WANT);
    assert.equal(out.game, GAME);
    assert.equal(out.days, 90);
    assert.equal(
      out.since,
      time.t - 90 * DAY,
      '창의 시작은 코치 시계에서 days × 24시간 — 학습일 경계로 맞추지 않는다',
    );
    assert.ok(Object.isFrozen(out) && Object.isFrozen(out.bySkill), '얼려서 낸다');
    assert.deepEqual(
      Object.keys(out.bySkill),
      [...Object.keys(out.bySkill)].sort(),
      '능력 id 차례',
    );
    // 다른 게임의 이름으로 물으면 그 게임의 첫 만남만 — 점이 든 이름도 같은 꼴로 읽는다
    assert.deepEqual(s.mock.firstAnswers({ game: 'world-mock2', days: 90 }).bySkill, {
      [skillOf(4)]: 1,
    });
    assert.deepEqual(s.mock.firstAnswers({ game: 'world-mock.x', days: 90 }).bySkill, {
      [skillOf(5)]: 1,
    });
    assert.deepEqual(s.mock.firstAnswers({ game: 'nothing', days: 90 }).bySkill, {});
    // 같은 호스트의 다른 코치가 물어도 같다
    assert.deepEqual(s.other.firstAnswers({ game: GAME, days: 90 }), out);
  } finally {
    s.close();
  }
});

test('창은 lead를 고른 뒤 마지막에 건다 — 창 앞에 만난 계열의 창 안 답은 서지 않고, 창 바로 앞의 제시에 창 안에서 한 답은 선다', async () => {
  const time = clock(START);
  const coach = await guest(time);
  try {
    // i9: 창 앞에 혼자 답했고, 창 안에서 다시 냈다 — 첫 만남이 창 밖이라 근거가 아니다
    await solo(coach, time, ITEMS[9]);
    time.advance(10 * DAY);
    await solo(coach, time, ITEMS[9]);
    // i10: 창 바로 앞에 띄우고 창 안에서 답했다 — 만남(답)이 창 안이라 근거다
    time.advance(MINUTE);
    const pid = coach.present(ITEMS[10]);
    const shownAt = time.t;
    time.advance(2 * MINUTE);
    await coach.answer(pid, { correct: true, assessable: true }).stored;
    const answeredAt = time.t;
    await new Promise(resolve => setTimeout(resolve, 0));
    // days 일 뒤의 창 시작이 제시와 답 사이에 오게 시계를 둔다
    time.advance(shownAt + MINUTE + 7 * DAY - time.t);
    const out = coach.firstAnswers({ game: GAME, days: 7 });
    assert.ok(out.since > shownAt && out.since < answeredAt);
    assert.deepEqual(out.bySkill, { [skillOf(10)]: 1 });
    // 창을 넓히면 창 앞에 만난 i9도 그 첫 답으로 선다(창 안 답 둘이 아니라 하나)
    assert.deepEqual(coach.firstAnswers({ game: GAME, days: 30 }).bySkill, {
      [skillOf(9)]: 1,
      [skillOf(10)]: 1,
    });
  } finally {
    coach.dispose();
  }
});

test('days는 1 ~ 365의 정수, game은 게임 이름 꼴만 받는다 — 그 밖은 던진다', async () => {
  const time = clock(START);
  const coach = await guest(time);
  try {
    for (const days of [0, 366, 1.5, '90', null, undefined, Number.NaN])
      assert.throws(() => coach.firstAnswers({ game: GAME, days }), TypeError, String(days));
    for (const game of ['', 'a..b', 'a b', 7, null, undefined, 'g'.repeat(81)])
      assert.throws(() => coach.firstAnswers({ game, days: 90 }), TypeError, String(game));
    assert.throws(() => coach.firstAnswers(), TypeError);
    assert.equal(coach.firstAnswers({ game: GAME, days: 1 }).days, 1);
    assert.equal(coach.firstAnswers({ game: GAME, days: 365 }).days, 365);
  } finally {
    coach.dispose();
  }
});

test('서버 길 계정은 null이다 — 받은 요약이 있어 보기가 기다리지 않아도(기기에 이틀 치만 있어 처음부터 세지 못한다 — lookback과 같은 규칙)', async () => {
  const time = clock(START);
  const map = fakeMap(ITEMS);
  const server = createServer({ random: rng(4401), index: indexOfMap(map), foldChance: 1 });
  await server.fold(); // 서버에 머리(빈 요약)가 서야 첫 받기가 바탕 요약을 받는다
  const transport = {
    post: (events, since) => server.post(events, since),
    get: async since => ({ summary: await server.summary(since), serverTime: server.now }),
  };
  const coach = createCoach({
    gameId: GAME,
    map,
    seed: 's',
    dayOffset: 0,
    host: {
      guest: false,
      account: 'acct-first',
      revision: 1,
      key: keyOf('account'),
      port: memoryPort(),
      transport,
      now: time.now,
    },
  });
  await coach.ready;
  await coach.synced();
  await settle();
  try {
    // 첫 받기 뒤 — 받은 요약이 있고 보기가 기다리지 않는다(이때 손님 막이를 빼면 기기 기록으로 센 값이 나온다)
    assert.equal(coach.summary().storage.waiting, false, '보기가 기다리지 않는 계정');
    assert.equal(coach.summary().storage.base, true, '받은 요약이 있다');
    assert.equal(coach.firstAnswers({ game: GAME, days: 90 }), null);
  } finally {
    coach.dispose();
  }
});

test('서버 셈(firstAnswersOfStore)은 같은 사건 열에서 손님 코치와 같은 수를 낸다 — 메모리 서버에 접은 만남 줄과 사건 번호 묶음으로', async () => {
  const time = clock(START);
  const s = await scene(time);
  try {
    const map = fakeMap(ITEMS);
    const index = indexOfMap(map);
    const server = createMemoryAccount();
    server.append(await eventsOf(s.port), time.t + DAY); // 받은 시각이 사건 시각보다 뒤 — 접는 시각은 사건 시각이다
    const memory = createMemory(PARAMS);
    for (let guard = 0; guard < 200; guard += 1)
      if (
        (await foldAccount(server.account, { memory, params: PARAMS, index, nowMs: time.t })).done
      )
        break;
    const store = server.account.store(foldEdition(PARAMS, index));
    for (const game of [GAME, 'world-mock2', 'world-mock.x', 'nothing'])
      for (const days of [1, 90]) {
        const guest = s.mock.firstAnswers({ game, days });
        assert.deepEqual(
          await firstAnswersOfStore(store, { game, since: guest.since }),
          guest.bySkill,
          `${game} ${days}`,
        );
      }
    assert.deepEqual(
      await firstAnswersOfStore(store, { game: GAME, since: time.t - 90 * DAY }),
      WANT,
    );
  } finally {
    s.close();
  }
});
