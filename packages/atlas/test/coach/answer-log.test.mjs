// 놓침 기록(coach.answerLog — 단계 4 계획 §25-5, 놓친 곳 카드의 재료). 이 기기 기록부의 2판 제시마다 첫 판정 답을 줄로 내고, 혼자 낸 첫 답은
// 접기가 고른 그 계열의 첫 만남(코치의 측정 measured와 같은 길)으로 정한다. 창은 판을 연 시각(판 번호)과 치우기 자리(floor)로 건다.
// 규칙마다 tools/mutants/coach.mjs에 깬 변형이 있다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { rng } from '../support/seeds.mjs';
import { subject } from '../support/subject.mjs';
import { clock, createCoach, fakeMap, memoryPort, PARAMS, T0 } from './support.mjs';

const { acquireHost, installHostMaker, releaseHost } = await subject('coach/host.mjs');
const { storeName } = await subject('record/port.mjs');
const { KEEP_MS } = await subject('record/log.mjs');
const { createEvent, eventId } = await subject('record/events.mjs');
const { openedAtOfSet } = await subject('coach/set-id.mjs');
const { createServer } = await import('../support/trail-sync.mjs');

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const START = T0 + 10 * HOUR;
const ENTRY = 'entry-check';
const PRACTICE = 'world-practice';
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const eventsOf = async port => (await port.read()).map(row => row.value.event).filter(Boolean);
const indexOfMap = map => ({ edition: 'index-t', lookup: key => map.item(key) });
let stores = 0;
const keyOf = tag => `synk-atlas:answer-log-${process.pid}-${tag}-${(stores += 1)}`;

// 읽기 문항 열둘(계열마다 하나)과 소리가 드는 듣기 문항 둘.
const word = (i, extra = {}) =>
  Object.freeze({
    itemKey: `l.i${i}`,
    familyKey: `l.f${i}`,
    skillId: 'ko.reading.main',
    difficulty: 1,
    responseFormat: 'single-choice',
    units: Object.freeze([`ko.word.l${i}`]),
    order: i,
    modality: 'reading',
    ...extra,
  });
const I = Object.freeze(Array.from({ length: 12 }, (_, i) => word(i)));
const A = Object.freeze(
  [12, 13].map(i =>
    word(i, { skillId: 'ko.listening.detail', modality: 'listening', audioRequired: true }),
  ),
);
const ITEMS = Object.freeze([...I, ...A]);

function guestCoach(
  time,
  { gameId = ENTRY, port = memoryPort(), key = keyOf('guest'), ...host } = {},
) {
  return createCoach({
    gameId,
    map: fakeMap(ITEMS),
    seed: 's',
    dayOffset: 0,
    host: { guest: true, port, key, now: time.now, ...host },
  });
}
async function opened(coach) {
  await coach.ready;
  return coach;
}
// 띄우고 답한다 — 답은 저장이 끝난 뒤 돌려준다.
async function solo(coach, time, item, result = {}) {
  time.advance(MINUTE);
  const pid = coach.present(item);
  time.advance(MINUTE);
  const at = time.t;
  const out = coach.answer(pid, { correct: true, assessable: true, ...result });
  await out.stored;
  return { pid, id: out.eventId, at };
}
const pairs = log => log.rows.map(row => [row.itemKey, row.independent]);
const ids = log => log.rows.map(row => row.eventId);

test('제시마다 첫 판정 답 하나 — 혼자 낸 첫 답은 접기의 첫 만남이 그 답일 때만(도움 뒤 · 판정 못 한 첫 답 뒤 · 소리 전달 안 됨 · 같은 제시의 둘째 답 · 이미 만난 계열은 아니다)', async () => {
  const time = clock(START);
  const coach = await opened(guestCoach(time));
  try {
    const { setId } = coach.startSet({ length: 12 });
    const right = await solo(coach, time, I[0]);
    const choice = { selectedId: 'pass', correctId: 'reject' };
    const wrong = await solo(coach, time, I[1], { correct: false, choice });
    // 도움 뒤 답 — 첫 만남은 도움이다
    time.advance(MINUTE);
    const hp = coach.present(I[2]);
    coach.help(hp, 'hint');
    const helped = coach.answer(hp, { correct: true, assessable: true });
    await helped.stored;
    // 판정 못 한 첫 답 뒤의 판정 답 — 그 제시의 줄은 뒤 답이고, 첫 만남은 판정 못 한 답이다
    time.advance(MINUTE);
    const up = coach.present(I[3]);
    const unjudged = coach.answer(up, { correct: null, assessable: false, reason: 'motor' });
    await unjudged.stored;
    time.advance(MINUTE);
    const judged = coach.answer(up, { correct: true, assessable: true });
    await judged.stored;
    // 소리 전달이 안 된 듣기 답(판정 답이지만 접기가 세지 않는다)과 전달된 듣기 답
    time.advance(MINUTE);
    const sp = coach.present(A[0]);
    coach.delivery(sp, { audio: 'failed' });
    const silent = coach.answer(sp, { correct: true, assessable: true });
    await silent.stored;
    time.advance(MINUTE);
    const dp = coach.present(A[1]);
    coach.delivery(dp, { audio: 'completed' });
    const heard = coach.answer(dp, { correct: true, assessable: true });
    await heard.stored;
    // 같은 제시의 둘째 답 — 줄은 첫 답 하나다
    time.advance(MINUTE);
    const tp = coach.present(I[4]);
    const first = coach.answer(tp, { correct: false, assessable: true });
    await first.stored;
    time.advance(MINUTE);
    const second = coach.answer(tp, { correct: true, assessable: true });
    await second.stored;
    // 이미 만난 계열의 새 제시
    const again = await solo(coach, time, I[0]);
    await settle();

    const log = coach.answerLog({ days: 2 });
    assert.deepEqual(pairs(log), [
      [I[0].itemKey, true],
      [I[1].itemKey, true],
      [I[2].itemKey, false],
      [I[3].itemKey, false],
      [A[0].itemKey, false],
      [A[1].itemKey, true],
      [I[4].itemKey, true],
      [I[0].itemKey, false],
    ]);
    assert.deepEqual(ids(log), [
      right.id,
      wrong.id,
      helped.eventId,
      judged.eventId,
      silent.eventId,
      heard.eventId,
      first.eventId,
      again.id,
    ]);
    const row = log.rows[1];
    assert.deepEqual(row, {
      eventId: wrong.id,
      presentationId: wrong.pid,
      game: ENTRY,
      itemKey: I[1].itemKey,
      setId,
      at: wrong.at,
      verdict: 'incorrect',
      correct: false,
      independent: true,
      choice,
    });
    assert.ok(log.rows.every(one => one.setId === setId && one.game === ENTRY));
    assert.equal(log.rows[3].correct, true, '판정 못 한 첫 답 뒤의 판정 답');
    assert.equal(log.rows[4].verdict, 'correct', '소리 전달이 안 된 답도 판정 답이다');
    assert.ok(log.rows.filter(one => one !== row).every(one => one.choice === null));
    assert.ok(
      log.rows.every((one, k) => k === 0 || log.rows[k - 1].at <= one.at),
      '답 시각 차례',
    );
    assert.equal(log.floor, null, '손님은 치우지 않는다');
    assert.equal(log.since, time.t - 2 * DAY, '창의 시작은 코치 시계 − days');
    assert.equal(log.days, 2);
    assert.ok(Object.isFrozen(log) && Object.isFrozen(log.rows) && Object.isFrozen(row));
    assert.ok(Object.isFrozen(row.choice));
    // 줄의 혼자 낸 첫 답 수는 같은 사건을 접은 칸의 혼자 낸 첫 답 수와 같다
    await coach.finishSet({ record: false }).folded;
    const cells = coach
      .summary()
      .skills.flatMap(skill => skill.cells)
      .reduce((sum, cell) => sum + cell.independent, 0);
    assert.equal(cells, log.rows.filter(one => one.independent).length);
  } finally {
    coach.dispose();
  }
});

test('뺀 답 · 뺀 제시의 줄은 싣지 않는다 — 첫 판정 답을 빼면 뒤 답으로 바꾸지 않고, 도움을 뺀 것은 뺀 답이 아니다', async () => {
  const time = clock(START);
  const coach = await opened(guestCoach(time));
  try {
    coach.startSet({ length: 6 });
    // 첫 판정 답을 뺐다 — 같은 제시의 둘째 답이 줄이 되지 않는다
    time.advance(MINUTE);
    const pid = coach.present(I[5]);
    const dropped = coach.answer(pid, { correct: false, assessable: true });
    await dropped.stored;
    time.advance(MINUTE);
    await coach.answer(pid, { correct: true, assessable: true }).stored;
    coach.exclude(dropped.eventId);
    // 제시를 뺐다
    const whole = await solo(coach, time, I[6]);
    coach.exclude(whole.pid);
    // 도움을 뺐다 — 답은 남는다(제외된 도움도 만남이라 혼자 낸 첫 답은 아니다)
    time.advance(MINUTE);
    const hp = coach.present(I[7]);
    const hint = coach.help(hp, 'hint');
    const kept = coach.answer(hp, { correct: true, assessable: true });
    await kept.stored;
    coach.exclude(hint.id);
    const plain = await solo(coach, time, I[8]);
    for (let k = 0; k < 4; k += 1) await settle();
    const log = coach.answerLog({ days: 2 });
    assert.deepEqual(ids(log), [kept.eventId, plain.id]);
    assert.deepEqual(pairs(log), [
      [I[7].itemKey, false],
      [I[8].itemKey, true],
    ]);
  } finally {
    coach.dispose();
  }
});

function topWindow(port) {
  const top = { location: { origin: 'https://world.test' } };
  top.parent = top;
  installHostMaker(top, { openPort: () => port });
  return top;
}

test('두 탭이 같은 새 계열을 띄워 두 제시가 모두 firstExposure: true여도 혼자 낸 첫 답은 먼저 낸 답 하나다', async () => {
  const port = memoryPort(); // 두 탭이 같은 저장소를 본다
  const key = keyOf('tabs');
  const time = clock(START);
  const [one, two] = await Promise.all(
    [ENTRY, PRACTICE].map(gameId =>
      opened(
        createCoach({
          gameId,
          map: fakeMap(ITEMS),
          seed: 's',
          dayOffset: 0,
          scope: topWindow(port),
          host: { guest: true, port, key, now: time.now },
        }),
      ),
    ),
  );
  try {
    time.advance(MINUTE);
    // 계열 f0: 한 탭이 먼저 맞히고 다른 탭이 뒤에 틀린다. 계열 f1: 다른 탭이 먼저 틀리고 한 탭이 뒤에 맞힌다.
    const p1 = one.present(I[0]);
    const p2 = two.present(I[0]);
    const q1 = one.present(I[1]);
    const q2 = two.present(I[1]);
    await settle();
    const shown = (await eventsOf(port)).filter(event => event.type === 'practice.presented');
    assert.equal(shown.length, 4);
    assert.ok(
      shown.every(event => event.firstExposure === true),
      '장면의 전제 — 네 제시 모두 처음',
    );
    const answers = [];
    for (const [coach, pid, correct] of [
      [one, p1, true],
      [two, p2, false],
      [two, q2, false],
      [one, q1, true],
    ]) {
      time.advance(MINUTE);
      const out = coach.answer(pid, { correct, assessable: true });
      await out.stored;
      answers.push(out);
    }
    await Promise.all(answers.map(out => out.evidence));
    const want = [
      [answers[0].eventId, true],
      [answers[1].eventId, false],
      [answers[2].eventId, true],
      [answers[3].eventId, false],
    ];
    for (const coach of [one, two]) {
      let log = coach.answerLog({ days: 2 });
      for (let k = 0; k < 50 && log.rows.length < 4; k += 1) {
        await settle();
        log = coach.answerLog({ days: 2 });
      }
      assert.deepEqual(
        log.rows.map(row => [row.eventId, row.independent]),
        want,
      );
      assert.deepEqual(
        log.rows.map(row => row.game),
        [ENTRY, PRACTICE, PRACTICE, ENTRY],
      );
    }
  } finally {
    one.dispose();
    two.dispose();
  }
});

test('창은 판을 연 시각(판 번호)으로 건다 — days 창이 판 한가운데를 가르면 그 판의 창 안 답도 빠진다', async () => {
  const time = clock(START);
  const coach = await opened(guestCoach(time));
  try {
    coach.startSet({ length: 3 });
    const early = await solo(coach, time, I[0]);
    time.advance(3 * DAY);
    const late = await solo(coach, time, I[1]); // 사흘 전에 연 판의 창 안 답
    coach.finishSet({ record: false });
    coach.startSet({ length: 3 });
    const fresh = await solo(coach, time, I[2]);
    await settle();
    assert.deepEqual(ids(coach.answerLog({ days: 2 })), [fresh.id]);
    assert.deepEqual(ids(coach.answerLog({ days: 7 })), [early.id, late.id, fresh.id]);
  } finally {
    coach.dispose();
  }
});

test('창의 시작과 같은 때에 연 판은 창 밖이다 — 판을 연 시각이 창의 시작 뒤인 판만(GPT GA7)', async () => {
  const time = clock(START);
  const coach = await opened(guestCoach(time));
  try {
    const { setId } = coach.startSet({ length: 3 });
    const one = await solo(coach, time, I[0]);
    await settle();
    const openedAt = openedAtOfSet(setId);
    time.advance(openedAt + 2 * DAY - 1 - time.t);
    assert.deepEqual(ids(coach.answerLog({ days: 2 })), [one.id], '경계 1밀리초 앞');
    time.advance(1);
    const log = coach.answerLog({ days: 2 });
    assert.equal(log.since, openedAt);
    assert.deepEqual(log.rows, [], '판을 연 때가 곧 창의 시작');
  } finally {
    coach.dispose();
  }
});

test('games를 주면 그 경험의 판만 — 같은 호스트의 다른 경험 코치가 쓴 판은 거른다', async () => {
  const time = clock(START);
  const port = memoryPort();
  const key = keyOf('games');
  const entry = await opened(guestCoach(time, { port, key }));
  const practice = await opened(guestCoach(time, { gameId: PRACTICE, port, key }));
  try {
    const a = await solo(entry, time, I[0]);
    const b = await solo(practice, time, I[1]);
    const c = await solo(entry, time, I[2]);
    await settle();
    assert.deepEqual(ids(entry.answerLog({ days: 2 })), [a.id, b.id, c.id], '모든 경험');
    assert.deepEqual(ids(entry.answerLog({ days: 2, games: null })), [a.id, b.id, c.id]);
    assert.deepEqual(ids(entry.answerLog({ days: 2, games: [PRACTICE] })), [b.id]);
    assert.deepEqual(ids(practice.answerLog({ days: 2, games: [ENTRY] })), [a.id, c.id]);
    assert.deepEqual(ids(entry.answerLog({ days: 2, games: [ENTRY, PRACTICE] })), [
      a.id,
      b.id,
      c.id,
    ]);
    assert.deepEqual(entry.answerLog({ days: 2, games: [] }).rows, []);
    assert.deepEqual(entry.answerLog({ days: 2, games: ['nothing'] }).rows, []);
  } finally {
    entry.dispose();
    practice.dispose();
  }
});

test('days는 1 ~ 365의 정수, games는 게임 이름의 배열만 받는다 — 그 밖은 던지고, 준비 전에는 NOT_READY다', async () => {
  const time = clock(START);
  const early = guestCoach(time);
  assert.throws(() => early.answerLog({ days: 2 }), { code: 'NOT_READY' });
  const coach = await opened(early);
  try {
    for (const days of [0, 366, 1.5, '2', null, undefined, Number.NaN])
      assert.throws(() => coach.answerLog({ days }), TypeError, String(days));
    for (const games of [ENTRY, [''], [7], ['a..b'], [null], {}])
      assert.throws(() => coach.answerLog({ days: 2, games }), TypeError, String(games));
    assert.throws(() => coach.answerLog(), TypeError);
    assert.equal(coach.answerLog({ days: 1 }).days, 1);
    assert.equal(coach.answerLog({ days: 365 }).days, 365);
  } finally {
    coach.dispose();
  }
});

test('판 번호가 없는 옛 꼴 제시(옮겨 온 옛 기록)는 싣지 않는다', async () => {
  const time = clock(START);
  const port = memoryPort();
  const scope = { domain: 'LAB', workspace: 'learning', subject: 'device' };
  const at = ms => new Date(ms).toISOString();
  const old = START - HOUR;
  const measure = {
    skillId: 'ko.reading.main',
    modality: 'reading',
    difficulty: 1,
    familyKey: 'old.f',
    audioRequired: false,
    confounded: false,
  };
  await port.append(
    [
      { schema: 1, id: 'd1', scope, at: at(old), recordedAt: at(old), type: 'decision.made' },
      {
        schema: 1,
        id: 'p1',
        scope,
        at: at(old),
        recordedAt: at(old),
        type: 'practice.presented',
        decisionId: 'd1',
        taskId: 't',
        taskVersion: 'v',
        itemKey: 'old-1',
        conceptIds: ['ko.reading.main'],
        firstExposure: true,
        measure,
      },
      {
        schema: 1,
        id: 'a1',
        scope,
        at: at(old + MINUTE),
        recordedAt: at(old + MINUTE),
        type: 'practice.attempted',
        presentationId: 'p1',
        attemptNo: 1,
        verdict: 'incorrect',
        errorTags: [],
      },
    ].map(event => ({ kind: 'event', event })),
  );
  const coach = await opened(guestCoach(time, { port }));
  try {
    const now = await solo(coach, time, I[0]);
    await settle();
    assert.equal(
      (await eventsOf(port)).filter(event => event.type === 'practice.presented').length,
      2,
      '장면의 전제 — 옛 꼴 제시가 기록부에 든다',
    );
    assert.deepEqual(ids(coach.answerLog({ days: 30 })), [now.id]);
  } finally {
    coach.dispose();
  }
});

test('동의를 끈 계정(기기 길)도 줄을 내고 floor는 null이다 — 사건을 치우지 않는다', async () => {
  const time = clock(START);
  const account = 'acct-log-local';
  const coach = await opened(
    guestCoach(time, {
      account,
      revision: 1,
      key: storeName({ account, revision: 1, local: true }),
    }),
  );
  try {
    const a = await solo(coach, time, I[0]);
    await settle();
    const log = coach.answerLog({ days: 2 });
    assert.equal(log.floor, null);
    assert.deepEqual(pairs(log), [[I[0].itemKey, true]]);
    assert.deepEqual(ids(log), [a.id]);
  } finally {
    coach.dispose();
  }
});

// 서버 길 계정 — 올리고 서버가 접은 뒤 이틀이 지나 치운다. 치우기는 제시 묶음마다라 판 A는 앞이 잘린다(첫 답의 묶음만 치우고 여섯 시간 뒤 답의
// 묶음은 남는다). 판 Z의 띄우기만 한 제시는 답이 없어 치워도 남는다 — 남은 가장 이른 사건은 floor보다 앞이다.
test('서버 길 계정 — floor는 마지막 치우기 자리이고, 판을 연 시각이 창 밖인 판은 앞이 잘려 남은 답까지 통째로 빠진다', async () => {
  const map = fakeMap(ITEMS);
  const server = createServer({ random: rng(8101), index: indexOfMap(map) });
  const time = clock(START);
  server.tick(time.now() - server.now); // 치우기는 서버 시각으로 이틀을 잰다 — 두 시계를 맞춘다
  const pass = ms => {
    time.advance(ms);
    server.tick(ms);
  };
  const top = {
    location: { origin: 'https://world.test' },
    addEventListener() {},
    removeEventListener() {},
  };
  top.parent = top;
  installHostMaker(top, { openPort: () => memoryPort() });
  const account = 'acct-log';
  const key = storeName({ account, revision: 1 });
  const coach = createCoach({
    gameId: ENTRY,
    map,
    seed: 's',
    dayOffset: 0,
    scope: top,
    host: {
      guest: false,
      account,
      revision: 1,
      key,
      port: memoryPort(),
      transport: {
        post: (events, since) => server.post(events, since),
        get: async since => ({ summary: await server.summary(since), serverTime: server.now }),
      },
      now: time.now,
    },
  });
  await coach.ready;
  await coach.synced();
  const handle = await acquireHost({ key, params: PARAMS, now: time.now, guest: false }, top);
  const answer = async item => {
    pass(MINUTE);
    const pid = coach.present(item);
    pass(MINUTE);
    const out = coach.answer(pid, { correct: true, assessable: true });
    await out.stored;
    return { pid, id: out.eventId };
  };
  try {
    // 판 Z — 띄우기만 한 제시
    coach.startSet({ length: 3 });
    pass(MINUTE);
    const shownOnly = coach.present(I[9]);
    coach.finishSet({ record: false });
    pass(HOUR);
    // 판 A — 첫 답과 여섯 시간 뒤 답
    const setA = coach.startSet({ length: 3 });
    const openedA = handle.now();
    const cut = await answer(I[0]);
    pass(6 * HOUR);
    const left = await answer(I[1]);
    coach.finishSet({ record: false });
    pass(HOUR);
    // 판 B — 판 A를 연 뒤 일곱 시간쯤
    const setB = coach.startSet({ length: 3 });
    const kept = await answer(I[2]);
    coach.finishSet({ record: false });
    await handle.settled();
    await handle.upload();
    await handle.pull({ force: true });
    assert.equal(handle.trail.unsent().length, 0, '모두 올라갔다');
    // 서버 시각을 받은 뒤의 하루 한 번 치우기가 이미 돌았다(치운 것은 없다) — floor는 그 자리라 세 판이 모두 창 안이다
    const before = coach.answerLog({ days: 2 });
    assert.equal(before.floor, handle.trail.record.sweptAt() - KEEP_MS);
    assert.ok(before.floor < handle.trail.record.sweptAt());
    assert.deepEqual(ids(before), [cut.id, left.id, kept.id]);
    // 판 A를 연 때에서 이틀 세 시간 뒤에 치운다 — 치우기 자리(그때 − 이틀)는 판 A의 첫 답과 둘째 답 사이다
    pass(openedA + 2 * DAY + 3 * HOUR - handle.now());
    assert.ok((await handle.trail.compact()) > 0, '이틀 지난 사건을 치웠다');
    const sweptAt = handle.trail.record.sweptAt();
    assert.equal(handle.trail.heldEvent(cut.id), null, '판 A의 첫 답은 치웠다');
    assert.ok(handle.trail.heldEvent(left.id), '판 A의 둘째 답은 남았다 — 앞이 잘린 판');
    assert.ok(handle.trail.heldEvent(shownOnly), '답이 없는 제시는 남았다');
    const leftShown = Date.parse(handle.trail.heldEvent(left.pid).at);
    const openedOf = setId => Number(setId.split('.').at(-3));
    assert.equal(openedOf(setA.setId), openedA, '판 번호에 든 시각은 판을 연 때다');
    for (const days of [2, 30]) {
      const log = coach.answerLog({ days });
      assert.equal(log.floor, sweptAt - KEEP_MS, `${days}일 — floor는 치우기 자리`);
      assert.ok(log.floor > openedA && log.floor < leftShown, '치우기 자리가 판 A를 가른다');
      assert.ok(openedOf(setB.setId) > log.floor, '판 B는 창 안에서 열었다');
      assert.equal(log.since, Math.max(log.floor, handle.now() - days * DAY));
      assert.deepEqual(pairs(log), [[I[2].itemKey, true]], `${days}일`);
      assert.deepEqual(ids(log), [kept.id]);
    }
  } finally {
    releaseHost(handle);
    coach.dispose();
  }
});

// 사건 만 건(제시 · 답 오천 쌍)을 저장소에 넣고 연 손님 코치. games로 줄 수만 바꾼다 — 접기는 두 부름 모두 든 사건 전부를 한 번 한다.
// 서버 길 계정의 기기 하나 — 문서(위 창)와 저장소가 기기마다 따로다. synced가 거짓이면 받기 답에 서버 시각이 없어, 첫 올리기 전까지
// 기기 시계를 맞추지 못한다(시계가 앞선 기기가 아직 서버와 이어지지 않은 때).
async function accountDevice(server, map, time, { synced }) {
  const top = {
    location: { origin: 'https://world.test' },
    addEventListener() {},
    removeEventListener() {},
  };
  top.parent = top;
  installHostMaker(top, { openPort: () => memoryPort() });
  const account = 'acct-clamp';
  const key = storeName({ account, revision: 1 });
  const coach = createCoach({
    gameId: ENTRY,
    map,
    seed: 's',
    dayOffset: 0,
    scope: top,
    host: {
      guest: false,
      account,
      revision: 1,
      key,
      port: memoryPort(),
      transport: {
        post: (events, since) => server.post(events, since),
        get: async since => ({
          summary: await server.summary(since),
          ...(synced ? { serverTime: server.now } : {}),
        }),
      },
      now: time.now,
    },
  });
  await coach.ready;
  const handle = await acquireHost({ key, params: PARAMS, now: time.now, guest: false }, top);
  return { coach, handle };
}

// 기기를 닫는다 — 코치와, 시험이 acquireHost로 따로 얻은 호스트 참조를 함께 놓는다(r3 GPT GA4).
function closeDevice(device) {
  if (!device) return;
  device.coach.dispose();
  releaseHost(device.handle);
}

// 단계 4 계획 §6 알려진 한계 · 25-12의 17(GPT GA2). 시계가 앞선 기기가 서버 시각에 맞추기 전에 낸 첫 오답은 서버가 받은 시각으로 눌러,
// 요약의 첫 만남 시각과 기기 기록의 시각이 갈린다. 그래서 카드 줄에서는 혼자 낸 첫 답이 아니다(덜 센다). 답의 측정(measured)은 올리기 전
// 저장할 때 재므로 그 답을 센다. 밀리초가 다르면 다른 기기의 첫 만남은 어느 쪽에서도 이 기기의 것으로 세지 않는다(더 세지 않는다).
test('시계가 앞선 기기의 첫 오답을 서버가 누르면 카드 줄은 덜 세고, 밀리초가 다른 다른 기기의 첫 만남은 어느 쪽에서도 내 것으로 세지 않는다', async () => {
  const map = fakeMap(ITEMS);
  const server = createServer({ random: rng(8201), index: indexOfMap(map) });
  const timeB = clock(server.now);
  const other = await accountDevice(server, map, timeB, { synced: true });
  const timeA = clock(server.now + HOUR);
  let mine = null;
  try {
    await other.coach.synced();
    other.coach.startSet({ length: 3 });
    timeB.advance(MINUTE);
    const there = other.coach.present(I[1]);
    timeB.advance(MINUTE);
    await other.coach.answer(there, { correct: false, assessable: true }).stored;
    await other.handle.settled();
    await other.handle.upload();
    server.tick(10 * MINUTE);

    mine = await accountDevice(server, map, timeA, { synced: false });
    await mine.handle.pull({ force: true });
    assert.equal(mine.handle.trail.record.clock.offsetMs, 0, '아직 서버 시각을 받지 못했다');
    assert.ok(mine.handle.view().met.has(I[1].familyKey), '다른 기기의 첫 만남은 요약으로 왔다');
    mine.coach.startSet({ length: 3 });
    timeA.advance(MINUTE);
    const p0 = mine.coach.present(I[0]);
    timeA.advance(MINUTE);
    const first = mine.coach.answer(p0, { correct: false, assessable: true });
    timeA.advance(MINUTE);
    const p1 = mine.coach.present(I[1]);
    timeA.advance(MINUTE);
    const second = mine.coach.answer(p1, { correct: false, assessable: true });
    assert.equal((await first.evidence).independent, true, '측정은 저장할 때 잰다');
    assert.equal((await second.evidence).independent, false, '다른 기기의 첫 만남(측정)');
    assert.deepEqual(pairs(mine.coach.answerLog({ days: 2 })), [
      [I[0].itemKey, true],
      [I[1].itemKey, false],
    ]);

    await mine.handle.settled();
    await mine.handle.upload();
    await mine.handle.pull({ force: true });
    const pressed = server.server.rawLog().find(row => row.event.id === first.eventId);
    assert.ok(pressed.receivedMs < Date.parse(pressed.event.at), '서버가 그 답의 시각을 눌렀다');
    assert.deepEqual(
      pairs(mine.coach.answerLog({ days: 2 })),
      [
        [I[0].itemKey, false],
        [I[1].itemKey, false],
      ],
      '눌린 첫 오답은 카드 줄에서 빠지고(덜 셈), 다른 기기의 첫 만남은 그대로 내 것이 아니다',
    );

    // 서버 시각을 받은 뒤에도 기기의 사건 시각은 앞서 찍은 마지막 시각보다 뒤로 가지 않는다(record/clock.mjs). 그래서 시계가 앞섰던
    // 만큼의 시간 동안 낸 첫 오답도 서버가 눌러 카드 줄에서 빠진다(Opus 대체 검수 F1 — 틀림은 여전히 덜 세는 쪽이다).
    assert.ok(mine.handle.trail.record.clock.offsetMs < 0, '이제 서버 시각에 맞췄다');
    timeA.advance(MINUTE);
    const p2 = mine.coach.present(I[2]);
    timeA.advance(MINUTE);
    const third = mine.coach.answer(p2, { correct: false, assessable: true });
    assert.equal((await third.evidence).independent, true, '측정은 저장할 때 잰다');
    await mine.handle.settled();
    await mine.handle.upload();
    await mine.handle.pull({ force: true });
    const again = server.server.rawLog().find(row => row.event.id === third.eventId);
    assert.ok(
      again.receivedMs < Date.parse(again.event.at),
      '맞춘 뒤에도 앞섰던 만큼은 서버가 눌렀다',
    );
    assert.deepEqual(pairs(mine.coach.answerLog({ days: 2 })), [
      [I[0].itemKey, false],
      [I[1].itemKey, false],
      [I[2].itemKey, false],
    ]);
  } finally {
    for (const device of [mine, other]) closeDevice(device);
  }
});

// 같은 밀리초의 두 기기(4-6e-5 r2 GPT GA1 · 설계 주인 11-21 — 후속). 요약의 만난 표에는 첫 만남의 시각만 있고 사건 번호가 없다. 그래서 한
// 계정의 두 기기가 같은 계열에 같은 밀리초로 답하면, 서버가 같은 밀리초 안에서 사건 번호 차례로 한 답만 첫 만남으로 골라도 두 기기 모두
// 제 답을 첫 만남으로 읽는다. 이 시험은 지금 동작을 그대로 적는다. 서버가 첫 만남의 사건 번호를 싣는 후속이 들어오면 뒤집는다 — 그때는
// 두 기기 가운데 하나만 혼자 낸 첫 답이다(§6 알려진 한계).
test('같은 밀리초에 두 기기가 같은 계열에 답하면 지금은 두 기기 모두 제 답을 혼자 낸 첫 답으로 읽는다 — 서버 후속이 들어오면 하나로 뒤집는다', async () => {
  const map = fakeMap(ITEMS);
  const server = createServer({ random: rng(8301), index: indexOfMap(map) });
  const times = [clock(server.now), clock(server.now)];
  const devices = [];
  try {
    for (const time of times)
      devices.push(await accountDevice(server, map, time, { synced: true }));
    for (const { coach } of devices) await coach.synced();
    const answers = [];
    for (const [k, { coach }] of devices.entries()) {
      coach.startSet({ length: 3 });
      times[k].advance(MINUTE);
      const pid = coach.present(I[3]);
      times[k].advance(MINUTE);
      answers.push(coach.answer(pid, { correct: k === 0, assessable: true }));
    }
    const ats = [];
    for (const { handle } of devices) {
      await handle.settled();
      ats.push(handle.trail.heldEvents().find(event => event.type === 'practice.attempted')?.at);
    }
    assert.equal(ats[0], ats[1], '두 답이 같은 밀리초다');
    server.tick(10 * MINUTE); // 서버가 두 답 뒤에 받는다 — 시각을 누르지 않는다
    for (const { handle } of devices) await handle.upload();
    for (const { handle } of devices) await handle.pull({ force: true });
    const cell = devices[0].handle.trail.summary().lines.cell.get('ko.reading.main|1');
    assert.equal(
      cell.independent,
      1,
      '서버는 같은 밀리초의 두 답 가운데 하나만 혼자 낸 첫 답으로 센다',
    );
    for (const { coach } of devices)
      assert.deepEqual(pairs(coach.answerLog({ days: 2 })), [[I[3].itemKey, true]]);
  } finally {
    for (const device of devices) closeDevice(device);
  }
});

test('사건 만 건에서 한 번 부르는 시간이 줄 수에 따라 크게 늘지 않는다 — 접기는 부를 때 한 번이고 줄마다 다시 접지 않는다', {
  timeout: 120_000,
}, async () => {
  const time = clock(START);
  const port = memoryPort();
  const pairsCount = 5000;
  const tag = 'perf0000';
  const values = [];
  const base = START - 5 * DAY;
  const step = Math.floor((4 * DAY) / pairsCount);
  let set = null;
  for (let k = 0; k < pairsCount; k += 1) {
    const atMs = base + k * step;
    const game = k < 20 ? 'perf-few' : k < 420 ? 'perf-many' : 'perf-rest';
    if (k % 10 === 0 || k === 20 || k === 420) set = `set.${game}.${atMs}.abcdef.${k + 1}`;
    const item = I[k % I.length];
    const presented = createEvent(
      'practice.presented',
      {
        setId: set,
        itemKey: item.itemKey,
        familyKey: item.familyKey,
        skillId: item.skillId,
        difficulty: item.difficulty,
        responseFormat: item.responseFormat,
        modality: 'reading',
        audioRequired: false,
        confounded: false,
        units: [...item.units],
        firstExposure: null,
        editions: { params: 'p', memory: 'm', ability: 'a', select: 's', index: 'index-t' },
        expected: { floor: 0.25, memory: 0.5, skill: 0.5 },
        arm: 'host',
        reason: {
          code: 'host.order',
          slots: {},
          evidence: {},
          target: null,
          tier: 0,
          introduced: [],
        },
      },
      { id: eventId(atMs, 0, tag), atMs, revision: 0 },
    );
    const answered = createEvent(
      'practice.attempted',
      {
        presentationId: presented.id,
        attemptNo: 1,
        verdict: k % 3 ? 'correct' : 'incorrect',
        errorTags: [],
      },
      { id: eventId(atMs + 1000, 0, tag), atMs: atMs + 1000, revision: 0 },
    );
    values.push({ kind: 'event', event: presented }, { kind: 'event', event: answered });
  }
  await port.append(values);
  const coach = await opened(guestCoach(time, { port }));
  try {
    const timed = games => {
      const begin = performance.now();
      const log = coach.answerLog({ days: 30, games });
      return { ms: performance.now() - begin, rows: log.rows.length };
    };
    const few = [timed(['perf-few']), timed(['perf-few']), timed(['perf-few'])];
    assert.equal(few[0].rows, 20, '줄이 적은 부름');
    const fewMs = Math.min(...few.map(run => run.ms));
    const bound = 3 * fewMs + 150;
    let manyMs = Number.POSITIVE_INFINITY;
    for (let run = 0; run < 3 && manyMs > bound; run += 1) {
      const many = timed(['perf-many']);
      assert.equal(many.rows, 400, '줄이 많은 부름');
      manyMs = Math.min(manyMs, many.ms);
    }
    assert.ok(
      manyMs <= bound,
      `줄 400의 부름(${manyMs.toFixed(0)}ms)이 줄 20의 부름(${fewMs.toFixed(0)}ms)보다 크게 늘지 않는다`,
    );
    assert.equal(coach.answerLog({ days: 30 }).rows.length, pairsCount, '모든 경험');
  } finally {
    coach.dispose();
  }
});
