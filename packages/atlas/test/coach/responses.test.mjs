// 판 응답 목록(단계 4 계획 §22-5) — 「내가 남긴 응답」과 짧은 연습 길이가 읽는 값. 셈(record/responses.mjs)은 옛 엔진과 같은 뜻이다:
// 판(결정)마다 가장 새 응답 하나, 그 뒤에 뺀 것(응답이나 그 판의 마침 · 결정)을 거른다, 30일 안, 새것부터, 새 꼴 사건만. 올리는 계정은 서버
// 읽기 위에 기기의 응답 · 빼기를 얹고, 그 서버 값은 같은 저장소의 코치들이 호스트가 사는 동안만 나눈다. talk의 view=trail-responses와 같은
// 뜻이다(SYNK-talk tests/atlas-trail-me.test.js). 규칙마다 tools/mutants/me.mjs에 깬 변형이 있다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { rng } from '../support/seeds.mjs';
import { subject } from '../support/subject.mjs';
import { bankOf, clock, createCoach, fakeMap, memoryPort, PARAMS } from './support.mjs';

const { responseRows, serverResponses, storedRead, RESPONSE_DAYS } =
  await subject('record/responses.mjs');
const { acquireHost, installHostMaker, releaseHost } = await subject('coach/host.mjs');
const { storeName } = await subject('record/port.mjs');
const { createServer } = await import('../support/trail-sync.mjs');

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 18, 3);
const iso = ms => new Date(ms).toISOString();
// 새 꼴(schema 2) 사건 — 판 하나는 결정 하나와 그 마침. 마침 번호가 done-x면 결정 번호는 dec-x다.
const done = (id, variant, at, decisionId = id.replace('done-', 'dec-')) => ({
  schema: 2,
  type: 'experience.completed',
  id,
  decisionId,
  variant,
  at: iso(at),
});
const given = (id, completionId, value, at) => ({
  schema: 2,
  type: 'feedback.given',
  id,
  completionId,
  value,
  at: iso(at),
});
const dropped = (id, targetId, at) => ({
  schema: 2,
  type: 'record.excluded',
  id,
  targetId,
  at: iso(at),
});
const row = (id, completionId, value, at, variant = 'short') => ({
  id,
  completionId,
  decisionId: completionId.replace('done-', 'dec-'),
  value,
  at: iso(at),
  variant,
});
const idsOf = rows => rows.map(r => r.id);

test('셈 — 판마다 가장 새 응답 하나를 새것부터 내고, 판 종류는 마침의 variant다', () => {
  const events = [
    done('done-a', 'short', NOW - 5 * DAY),
    given('resp-a1', 'done-a', 'too_much', NOW - 5 * DAY + 1000),
    given('resp-a2', 'done-a', 'want_more', NOW - 5 * DAY + 2000),
    done('done-b', 'mock', NOW - DAY),
    given('resp-b1', 'done-b', 'helpful', NOW - DAY + 1000),
  ];
  const rows = responseRows({ events, now: NOW });
  assert.deepEqual(
    rows.map(r => [r.id, r.kind, r.value, r.completionId]),
    [
      ['resp-b1', 'mock', 'helpful', 'done-b'],
      ['resp-a2', 'short', 'want_more', 'done-a'],
    ],
    '다른 값을 고르면 앞 응답을 대신한다',
  );
});

test('셈 — 판은 결정으로 묶는다: 한 결정에 마침이 둘이어도(두 기기가 같은 판을 끝냄) 가장 새 응답 하나다', () => {
  const events = [
    done('done-a', 'short', NOW - 2 * DAY, 'dec-a'),
    given('resp-a1', 'done-a', 'too_much', NOW - 2 * DAY + 1000),
    done('done-a2', 'short', NOW - DAY, 'dec-a'),
    given('resp-a2', 'done-a2', 'helpful', NOW - DAY + 1000),
  ];
  assert.deepEqual(idsOf(responseRows({ events, now: NOW })), ['resp-a2']);
});

test('셈 — 가장 새 응답을 빼도 앞 응답이 되살아나지 않고, 마침이나 결정을 뺀 판의 응답은 내지 않는다', () => {
  const events = [
    done('done-a', 'short', NOW - 3 * DAY),
    given('resp-a1', 'done-a', 'too_much', NOW - 3 * DAY + 1000),
    given('resp-a2', 'done-a', 'want_more', NOW - 3 * DAY + 2000),
    dropped('drop-a2', 'resp-a2', NOW - 3 * DAY + 3000),
    done('done-b', 'short', NOW - 2 * DAY),
    given('resp-b1', 'done-b', 'helpful', NOW - 2 * DAY + 1000),
    dropped('drop-b', 'done-b', NOW - 2 * DAY + 2000),
    done('done-d', 'mock', NOW - 2 * DAY + 5000),
    given('resp-d1', 'done-d', 'helpful', NOW - 2 * DAY + 6000),
    dropped('drop-d', 'dec-d', NOW - 2 * DAY + 7000),
    done('done-c', 'diagnostic', NOW - DAY),
    given('resp-c1', 'done-c', 'too_much', NOW - DAY + 1000),
  ];
  assert.deepEqual(idsOf(responseRows({ events, now: NOW })), ['resp-c1']);
});

test('셈 — 옛 꼴(schema 1) 응답 · 마침 · 빼기는 세지 않는다(옛 엔진의 응답은 셸이 옛 코치의 목록으로 합친다)', () => {
  const events = [
    { ...done('done-old', 'short', NOW - DAY), schema: 1 },
    { ...given('resp-old', 'done-old', 'too_much', NOW - DAY + 1000), schema: 1 },
    done('done-a', 'short', NOW - DAY + 2000),
    given('resp-a1', 'done-a', 'helpful', NOW - DAY + 3000),
    { ...dropped('drop-old', 'resp-a1', NOW - DAY + 4000), schema: 1 },
  ];
  assert.deepEqual(idsOf(responseRows({ events, now: NOW })), ['resp-a1']);
});

test('셈 — 30일 안의 응답만 낸다', () => {
  assert.equal(RESPONSE_DAYS, 30);
  const events = [
    done('done-a', 'short', NOW - 40 * DAY),
    given('resp-old', 'done-a', 'too_much', NOW - RESPONSE_DAYS * DAY - 1000),
    done('done-b', 'short', NOW - 31 * DAY),
    given('resp-edge', 'done-b', 'want_more', NOW - RESPONSE_DAYS * DAY + 1000),
  ];
  assert.deepEqual(idsOf(responseRows({ events, now: NOW })), ['resp-edge']);
});

test('셈 — 서버 줄 위에 기기의 응답 · 빼기를 얹는다: 같은 판이면 더 새 응답이 이기고, 기기의 빼기는 서버 줄에도 듣는다', () => {
  const server = [
    row('srv-a', 'done-a', 'too_much', NOW - 4 * DAY),
    row('srv-b', 'done-b', 'helpful', NOW - 3 * DAY, 'diagnostic'),
    row('srv-c', 'done-c', 'want_more', NOW - 2 * DAY, 'mock'),
    row('srv-e', 'done-e', 'helpful', NOW - 2 * DAY + 5000, 'mock'),
  ];
  const events = [
    // 판 a에 이 기기가 더 새 응답을 아직 올리지 않았다(마침은 이틀이 지나 기기에서 치워졌다 — 판 종류는 서버 줄의 것).
    given('dev-a', 'done-a', 'want_more', NOW - DAY),
    // 판 b의 서버 줄을 이 기기에서 뺐다(아직 올리지 않았다).
    dropped('drop-b', 'srv-b', NOW - DAY + 1000),
    // 판 c에는 서버 줄보다 앞선 응답이 기기에 남아 있다 — 서버 줄이 이긴다.
    given('dev-c-old', 'done-c', 'too_much', NOW - 2 * DAY - 1000),
    // 판 e의 결정을 이 기기에서 뺐다 — 서버 줄의 결정(decisionId)으로 그 판을 안다.
    dropped('drop-e', 'dec-e', NOW - DAY + 2000),
  ];
  const rows = responseRows({ events, server, now: NOW });
  assert.deepEqual(
    rows.map(r => [r.id, r.kind, r.value]),
    [
      ['dev-a', 'short', 'want_more'],
      ['srv-c', 'mock', 'want_more'],
    ],
  );
});

test('서버 답 고르기 — 판이 다른 답 · 꼴이 아닌 답은 버리고, 꼴이 아닌 줄은 뺀다', () => {
  const answer = {
    ok: true,
    revision: 3,
    complete: true,
    responses: [
      row('srv-a', 'done-a', 'too_much', NOW - DAY),
      { id: 'srv-bad', completionId: 'done-b', value: 'nope', at: iso(NOW) },
      { id: 'srv-noat', completionId: 'done-c', value: 'helpful', at: 'later' },
      null,
    ],
  };
  const read = serverResponses(answer, 3);
  assert.deepEqual(idsOf(read.rows), ['srv-a']);
  assert.equal(read.rows[0].decisionId, 'dec-a');
  assert.equal(read.complete, true);
  assert.equal(serverResponses(answer, 4), null, '판이 다른 답');
  assert.equal(serverResponses({ ...answer, ok: false }, 3), null);
  assert.equal(serverResponses({ revision: 3 }, 3), null);
  assert.equal(serverResponses({ ...answer, complete: 'yes' }, 3).complete, false);
});

test('서버 값 두기 — 서버가 본 내 응답(seen)은 서버 줄을 따르고(다른 기기에서 뺐으면 빠진다 — 끝까지 못 읽은 답이어도), 서버가 보지 못한 내 응답만 얹는다(Fable 5.2 설계 검토 F1 · F2, 시험 11 · 12 · 15 · 16)', () => {
  const events = [
    done('done-a', 'short', NOW - 2 * DAY),
    given('seen-a', 'done-a', 'too_much', NOW - 2 * DAY + 1000),
    done('done-b', 'short', NOW - DAY),
    given('fresh-b', 'done-b', 'want_more', NOW - DAY + 1000),
  ];
  const rowsOf = read =>
    idsOf(responseRows({ events, server: read.rows, known: read.known, now: NOW }));
  // 11 — 다른 기기에서 뺀 응답: 서버는 seen-a를 보았고 줄에는 없다. complete가 참이든 거짓이든 같다.
  for (const complete of [true, false]) {
    const read = serverResponses(
      { ok: true, revision: 1, complete, seen: ['seen-a', 'other-device'], responses: [] },
      1,
    );
    assert.deepEqual([...read.known], ['seen-a', 'other-device']);
    assert.deepEqual(rowsOf(read), ['fresh-b'], `complete ${complete}`);
  }
  // 12 — 서버가 읽은 뒤에 올라간 응답은 seen에 없어 얹힌다.
  const before = serverResponses(
    { ok: true, revision: 1, complete: true, seen: [], responses: [] },
    1,
  );
  assert.deepEqual(rowsOf(before), ['fresh-b', 'seen-a']);
  // 15 — seen이 없는 답(옛 서버)은 내 응답을 다 얹는다.
  const legacy = serverResponses({ ok: true, revision: 1, complete: true, responses: [] }, 1);
  assert.equal(legacy.known, null);
  assert.deepEqual(rowsOf(legacy), ['fresh-b', 'seen-a']);
  // 16 — 기기가 이미 치운 응답의 번호가 seen에 있어도 서버 줄 그대로다.
  const swept = serverResponses(
    {
      ok: true,
      revision: 1,
      complete: true,
      seen: ['gone-x', 'srv-c'],
      responses: [row('srv-c', 'done-c', 'helpful', NOW - 3 * DAY, 'mock')],
    },
    1,
  );
  assert.deepEqual(
    idsOf(responseRows({ events: [], server: swept.rows, known: swept.known, now: NOW })),
    ['srv-c'],
  );
  // 꼴이 아닌 번호는 seen에서 뺀다.
  assert.deepEqual(
    [
      ...serverResponses({ ok: true, revision: 1, seen: ['ok-1', 7, null, ''], responses: [] }, 1)
        .known,
    ],
    ['ok-1'],
  );
});

test('서버 값 두기 — 대신한 응답: 서버 줄의 앞 응답 위에 같은 판의 아직 안 올린 더 새 응답이 서고, 그것을 이 기기에서 빼면 판이 비고 앞 응답이 되살아나지 않는다(시험 13)', () => {
  const read = serverResponses(
    {
      ok: true,
      revision: 1,
      complete: true,
      seen: ['srv-a1'],
      responses: [row('srv-a1', 'done-a', 'too_much', NOW - 2 * DAY)],
    },
    1,
  );
  const mine = given('dev-a2', 'done-a', 'want_more', NOW - DAY);
  const rowsWith = events =>
    idsOf(responseRows({ events, server: read.rows, known: read.known, now: NOW }));
  assert.deepEqual(rowsWith([mine]), ['dev-a2']);
  assert.deepEqual(rowsWith([mine, dropped('drop-a2', 'dev-a2', NOW - DAY + 1000)]), []);
});

test('서버 값 두기 — 늦게 닿은 옛 답(서버 시각이 앞섬)은 둔 값을 바꾸지 않고, 판이 다른 답 · 꼴이 아닌 답은 앞 값 그대로다(시험 14)', () => {
  const answer = (serverTime, seen) => ({
    ok: true,
    revision: 1,
    serverTime,
    complete: true,
    seen,
    responses: [],
  });
  const first = storedRead(null, answer(2000, ['a']), 1);
  assert.deepEqual([...first.known], ['a']);
  assert.equal(first.serverTime, 2000);
  assert.equal(storedRead(first, answer(1000, []), 1), first, '옛 답은 버린다');
  const next = storedRead(first, answer(3000, ['a', 'b']), 1);
  assert.deepEqual([...next.known], ['a', 'b']);
  assert.equal(storedRead(next, answer(4000, []), 2), next, '판이 다른 답');
  assert.equal(storedRead(next, { ok: false }, 1), next, '꼴이 아닌 답');
  assert.equal(storedRead(null, { ok: false }, 1), null);
  // 서버 시각이 없는 답은 견주지 않고 받는다.
  const timeless = storedRead(next, { ok: true, revision: 1, responses: [] }, 1);
  assert.equal(timeless.serverTime, null);
  assert.equal(storedRead(timeless, answer(10, []), 1).serverTime, 10);
});

test('서버 값 두기 — 줄 상한에서 멈춘 답(seenFrom): 읽기가 닿지 못한 내 응답은 앞 값대로 두고 앞 값이 없으면 얹지 않는다. 다른 기기에서 뺀 응답은 읽은 범위 안과 밖 모두 되살아나지 않고, 아직 안 올린 응답과 읽은 뒤에 올라간 응답은 얹는다(설계 주인 11-18)', () => {
  // 받은 표지(서버 순번) — 멈춘 줄은 100이다. old-a(10)는 읽은 범위 밖, in-b(150)는 안, edge-e(100)는 마지막으로 읽은 줄, late-d(400)는 읽은
  // 뒤에 올라갔다. unsent-c는 아직 올리지 않았다.
  const acks = new Map([
    ['old-a', 10],
    ['in-b', 150],
    ['edge-e', 100],
    ['late-d', 400],
  ]);
  const events = [
    done('done-a', 'short', NOW - 3 * DAY),
    given('old-a', 'done-a', 'too_much', NOW - 3 * DAY + 1000),
    done('done-e', 'short', NOW - 2.5 * DAY),
    given('edge-e', 'done-e', 'too_much', NOW - 2.5 * DAY + 1000),
    done('done-b', 'short', NOW - 2 * DAY),
    given('in-b', 'done-b', 'want_more', NOW - 2 * DAY + 1000),
    done('done-c', 'short', NOW - DAY),
    given('unsent-c', 'done-c', 'helpful', NOW - DAY + 1000),
    done('done-d', 'mock', NOW - DAY / 2),
    given('late-d', 'done-d', 'helpful', NOW - DAY / 2 + 1000),
  ];
  const rowsOf = read =>
    idsOf(
      responseRows({
        events,
        server: read?.rows ?? null,
        known: read?.known ?? null,
        seenFrom: read?.seenFrom ?? null,
        held: read?.held ?? null,
        acked: id => acks.get(id),
        now: NOW,
      }),
    );
  const answer = (serverTime, seen, responses, seenFrom = 100) => ({
    ok: true,
    revision: 1,
    serverTime,
    complete: seenFrom == null,
    seen,
    seenFrom,
    responses,
  });
  // 앞 값 없음. in-b는 읽은 범위 안에서 다른 기기가 뺐다(서버가 보았고 줄에 없다). old-a는 읽은 범위 밖이라 다른 기기에서 뺐는지 이 답으로는
  // 알 수 없다 — 얹지 않는다. edge-e는 마지막으로 읽은 줄이라 읽은 범위다(seen에 없으면 읽은 뒤의 것처럼 얹는다).
  const first = storedRead(null, answer(2000, ['in-b'], []), 1);
  assert.equal(first.seenFrom, 100);
  assert.deepEqual([...first.held], []);
  assert.deepEqual(rowsOf(first), ['late-d', 'unsent-c', 'edge-e']);
  // 앞 값이 old-a를 냈다(빼기 전의 끝까지 읽은 답) — 이번 읽기가 닿지 못한 old-a는 앞 값대로 둔다. in-b는 이번 읽기를 따른다(되살아나지 않는다).
  const whole = answer(
    1000,
    ['old-a', 'edge-e', 'in-b'],
    [
      row('in-b', 'done-b', 'want_more', NOW - 2 * DAY + 1000),
      row('edge-e', 'done-e', 'too_much', NOW - 2.5 * DAY + 1000),
      row('old-a', 'done-a', 'too_much', NOW - 3 * DAY + 1000),
    ],
    null,
  );
  const prev = storedRead(null, whole, 1);
  assert.equal(prev.seenFrom, null);
  assert.equal(prev.held, undefined, '끝까지 읽은 답은 이어 들 것이 없다');
  const kept = storedRead(prev, answer(2000, ['in-b'], []), 1);
  assert.deepEqual(
    [...kept.held].sort(),
    ['edge-e', 'old-a'],
    '이번 읽기가 본 in-b는 이어 들지 않는다',
  );
  assert.deepEqual(rowsOf(kept), ['late-d', 'unsent-c', 'edge-e', 'old-a']);
  // 상한에서 멈춘 답이 이어 와도 앞 값의 판단을 잇는다.
  assert.deepEqual(rowsOf(storedRead(kept, answer(3000, ['in-b'], []), 1)), [
    'late-d',
    'unsent-c',
    'edge-e',
    'old-a',
  ]);
  // 앞 값이 old-a를 내지 않았다(앞 읽기 때 이미 다른 기기에서 뺐다) — 앞 값대로 얹지 않는다.
  const gone = storedRead(null, { ...whole, responses: whole.responses.slice(0, 2) }, 1);
  assert.deepEqual(rowsOf(storedRead(gone, answer(2000, ['in-b'], []), 1)), [
    'late-d',
    'unsent-c',
    'edge-e',
  ]);
  // 이번 읽기가 보고 뺀 응답은 뒤의 읽기가 닿지 못해도 되살아나지 않는다 — 이어 드는 것은 앞 값이 낸 응답뿐이다. in-b(150)를 본 읽기(멈춘 줄
  // 100) 다음에 멈춘 줄 200의 읽기가 오면 in-b는 읽은 범위 밖이 된다.
  const sawDrop = storedRead(prev, answer(2000, ['in-b'], []), 1);
  const below = storedRead(sawDrop, answer(3000, [], [], 200), 1);
  assert.equal(below.held.has('in-b'), false);
  assert.equal(rowsOf(below).includes('in-b'), false);
  // 끝까지 읽은 답이 오면 이어 든 값은 버린다 — 그 답이 다 본다.
  const after = storedRead(kept, answer(4000, ['old-a', 'in-b', 'edge-e'], [], null), 1);
  assert.equal(after.held, undefined);
  assert.deepEqual(rowsOf(after), ['late-d', 'unsent-c']);
  // seenFrom의 꼴 — 정수만, seen이 없는 답(옛 서버)은 null.
  const parse = extra =>
    serverResponses({ ok: true, revision: 1, seen: [], responses: [], ...extra }, 1).seenFrom;
  assert.equal(parse({ seenFrom: 100 }), 100);
  assert.equal(parse({ seenFrom: '100' }), null);
  assert.equal(parse({ seenFrom: 1.5 }), null);
  assert.equal(parse({}), null);
  assert.equal(
    serverResponses({ ok: true, revision: 1, seenFrom: 100, responses: [] }, 1).seenFrom,
    null,
  );
});

// --- 코치 ---

const indexOfMap = map => ({ edition: 'index-t', lookup: key => map.item(key) });
const origin = { origin: 'https://synk.test' };
function topWindow() {
  const top = { location: origin, addEventListener() {}, removeEventListener() {} };
  top.parent = top;
  installHostMaker(top, { openPort: () => memoryPort() });
  return top;
}
function world(seed) {
  const items = bankOf(rng(seed), { items: 6 });
  const map = fakeMap(items);
  return { items, map, time: clock(), top: topWindow(), index: indexOfMap(map) };
}
const open = (w, host) =>
  createCoach({
    gameId: 'resp',
    map: w.map,
    seed: 's',
    dayOffset: 0,
    scope: w.top,
    host: { now: w.time.now, ...host },
  });
async function finished(w, coach, item, kind = 'short') {
  const pid = coach.present(item);
  await coach.answer(pid, { correct: true, assessable: true }).stored;
  const set = coach.finishSet({ kind });
  await set.folded;
  w.time.advance(1000);
  return set;
}
const offline = { get: async () => ({ summary: null }), post: async () => ({ ok: true }) };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test('손님 코치 — 저장 중인 응답도 바로 서고, 다른 값을 고르면 대신하고, 가장 새 응답을 빼면 그 판이 목록에서 빠진다', async () => {
  const w = world(61);
  const coach = open(w, { guest: true, key: storeName({}), port: memoryPort() });
  await coach.ready;
  const set = await finished(w, coach, w.items[0]);
  const first = coach.feedback(set, 'too_much');
  assert.deepEqual(
    coach.responses().rows.map(r => [r.id, r.kind, r.value]),
    [[first.id, 'short', 'too_much']],
    '저장이 끝나기 전에도 목록에 선다(짧은 연습 길이가 바로 바뀐다)',
  );
  w.time.advance(1000);
  const second = coach.feedback(set, 'want_more');
  assert.deepEqual(
    idsOf(coach.responses().rows),
    [second.id],
    '다른 값을 고르면 앞 응답을 대신한다',
  );
  coach.excludeResponse(second.id);
  assert.deepEqual(coach.responses().rows, [], '가장 새 응답을 빼도 앞 응답이 되살아나지 않는다');
  assert.equal(coach.responses().complete, true, '손님 · 기기 길은 저장소의 사건으로 다 센다');
  // 손님 · 기기 길은 서버 값을 받지 않는다 — 같은 판 번호의 서버 줄을 넘겨도 목록에 섞이지 않는다(4-5 코드 검수 GPT GC3).
  const serverOnly = {
    id: 'server-only',
    at: new Date(w.time.now()).toISOString(),
    value: 'helpful',
    completionId: 'done.server',
    decisionId: 'set.server',
    experienceId: 'reset',
    variant: 'short',
  };
  assert.deepEqual(
    coach.responses({
      server: {
        ok: true,
        revision: 0,
        complete: true,
        seen: [serverOnly.id],
        seenFrom: null,
        responses: [serverOnly],
      },
    }),
    { complete: true, rows: [] },
  );
  coach.dispose();
});

test('올리는 계정 코치 — 서버 값 위에 기기의 응답 · 빼기를 얹고, 그 값을 같은 저장소의 코치들과 나누며, 판이 다른 답은 버린다', async () => {
  const w = world(62);
  const key = storeName({ account: 'acct-r', revision: 1 });
  const host = {
    guest: false,
    account: 'acct-r',
    revision: 1,
    key,
    port: memoryPort(),
    transport: offline,
  };
  const coach = open(w, host);
  await coach.ready;
  assert.deepEqual(
    coach.responses(),
    { complete: false, rows: [] },
    '서버를 읽기 전 — 끝까지 읽지 않았다',
  );
  const now = w.time.now();
  const server = {
    ok: true,
    revision: 1,
    complete: true,
    responses: [
      row('srv-a', 'done-a', 'too_much', now - 2 * DAY),
      row('srv-b', 'done-b', 'helpful', now - DAY, 'mock'),
    ],
  };
  const merged = coach.responses({ server });
  assert.equal(merged.complete, true);
  assert.deepEqual(idsOf(merged.rows), ['srv-b', 'srv-a']);
  // 판이 다른 답은 버린다 — 앞 값 그대로.
  assert.deepEqual(
    idsOf(coach.responses({ server: { ...server, revision: 2, responses: [] } }).rows),
    ['srv-b', 'srv-a'],
  );
  // 같은 저장소의 다른 코치도 그 값을 읽는다(호스트가 든다).
  const other = open(w, { ...host, port: undefined });
  await other.ready;
  assert.deepEqual(idsOf(other.responses().rows), ['srv-b', 'srv-a']);
  // 기기의 빼기는 서버 줄에도 바로 듣는다.
  coach.excludeResponse('srv-b');
  assert.deepEqual(idsOf(other.responses().rows), ['srv-a']);
  // 이 기기에서 끝낸 판의 응답은 서버 값 위에 선다.
  const set = await finished(w, coach, w.items[1], 'diagnostic');
  const mine = coach.feedback(set, 'want_more');
  assert.deepEqual(
    coach.responses().rows.map(r => [r.id, r.kind]),
    [
      [mine.id, 'diagnostic'],
      ['srv-a', 'short'],
    ],
  );
  other.dispose();
  coach.dispose();
});

test('올리는 계정 코치 — 서버가 본 내 응답은 서버 줄을 따라 다른 기기에서 뺐으면 빠지고(끝까지 못 읽은 답이어도), 서버가 보지 못한 응답은 얹으며, 늦게 닿은 옛 답은 둔 값을 바꾸지 않는다(Fable 5.2 설계 검토 F1 · F2)', async () => {
  const w = world(63);
  const key = storeName({ account: 'acct-k', revision: 1 });
  const coach = open(w, {
    guest: false,
    account: 'acct-k',
    revision: 1,
    key,
    port: memoryPort(),
    transport: offline,
  });
  await coach.ready;
  const set = await finished(w, coach, w.items[0]);
  const sent = coach.feedback(set, 'too_much');
  const answer = (serverTime, complete, seen) => ({
    ok: true,
    revision: 1,
    serverTime,
    complete,
    seen,
    responses: [],
  });
  assert.deepEqual(
    idsOf(coach.responses({ server: answer(1000, true, []) }).rows),
    [sent.id],
    '서버가 보지 못한 응답(아직 안 올림)은 얹는다',
  );
  assert.deepEqual(
    coach.responses({ server: answer(2000, false, [sent.id]) }).rows,
    [],
    '서버가 본 내 응답을 다른 기기에서 뺐다 — 끝까지 못 읽은 답이어도 서버 줄을 따른다',
  );
  assert.deepEqual(
    coach.responses({ server: answer(1500, true, []) }).rows,
    [],
    '늦게 닿은 옛 답은 둔 값을 바꾸지 않는다',
  );
  w.time.advance(1000);
  const later = coach.feedback(set, 'want_more');
  assert.deepEqual(idsOf(coach.responses().rows), [later.id], '읽은 뒤에 남긴 응답은 얹는다');
  coach.dispose();
});

test('올리는 계정 코치 — 줄 상한에서 멈춘 답(seenFrom)이 닿지 못한 내 응답(받은 표지가 그 아래)은 앞 값이 없으면 얹지 않고 앞 값이 냈으면 그대로 두며, 아직 안 올린 응답은 언제나 얹는다(설계 주인 11-18)', async () => {
  const w = world(64);
  const key = storeName({ account: 'acct-s', revision: 1 });
  const sent = new Map(); // 사건 번호 → 서버 순번(받은 표지)
  let reachable = true;
  const transport = {
    get: async () => ({ summary: null }),
    post: async events => {
      if (!reachable) throw new Error('닿지 못함');
      for (const event of events) sent.set(event.id, sent.size + 1);
      return {
        accepted: events.map(event => ({ id: event.id, seq: sent.get(event.id) })),
        clamped: [],
        rejected: [],
      };
    },
  };
  const coach = open(w, {
    guest: false,
    account: 'acct-s',
    revision: 1,
    key,
    port: memoryPort(),
    transport,
  });
  await coach.ready;
  const setA = await finished(w, coach, w.items[0]);
  const old = coach.feedback(setA, 'too_much');
  for (let waited = 0; !sent.has(old.id) && waited < 6000; waited += 100) await sleep(100);
  assert.ok(sent.has(old.id), '첫 응답이 올라갔다');
  await sleep(200); // 받은 표지가 기록부에 들기를 기다린다
  reachable = false;
  const setB = await finished(w, coach, w.items[1]);
  const unsent = coach.feedback(setB, 'want_more');
  const answer = (serverTime, seen, responses, seenFrom) => ({
    ok: true,
    revision: 1,
    serverTime,
    complete: seenFrom == null,
    seen,
    seenFrom,
    responses,
  });
  // 상한에서 멈춘 답 — 첫 응답(받은 표지가 멈춘 줄 아래)은 이 읽기가 보지 못했다. 앞 값이 없으면 얹지 않는다.
  assert.deepEqual(
    idsOf(coach.responses({ server: answer(1000, [], [], 10_000) }).rows),
    [unsent.id],
    '앞 값이 없으면 얹지 않고, 아직 안 올린 응답은 얹는다',
  );
  // 끝까지 읽은 답이 첫 응답을 냈다 → 그 뒤 상한에서 멈춘 답은 앞 값대로 둔다.
  const serverRow = {
    id: old.id,
    at: old.at,
    value: old.value,
    completionId: old.completionId,
    variant: 'short',
  };
  assert.deepEqual(
    idsOf(coach.responses({ server: answer(2000, [old.id], [serverRow], null) }).rows),
    [unsent.id, old.id],
  );
  assert.deepEqual(
    idsOf(coach.responses({ server: answer(3000, [], [], 10_000) }).rows),
    [unsent.id, old.id],
    '앞 값이 냈으면 그대로 둔다',
  );
  // 끝까지 읽은 답이 첫 응답을 내지 않았다(다른 기기에서 뺐다) → 그 뒤 상한에서 멈춘 답에서도 되살아나지 않는다.
  coach.responses({ server: answer(4000, [old.id], [], null) });
  assert.deepEqual(idsOf(coach.responses({ server: answer(5000, [], [], 10_000) }).rows), [
    unsent.id,
  ]);
  // 같은 저장소의 다른 코치도 그 값을 읽는다.
  const other = open(w, {
    guest: false,
    account: 'acct-s',
    revision: 1,
    key,
    transport,
  });
  await other.ready;
  assert.deepEqual(idsOf(other.responses().rows), [unsent.id]);
  other.dispose();
  coach.dispose();
});

test('올리는 계정 코치 — 이 기기에서 뺀 서버 응답은 그 빼기가 올라가 이틀 뒤 기기에서 치워져도, 서버 값을 다시 읽기 전까지 되살아나지 않는다(4-5 코드 검수 GPT GB4)', async () => {
  const items = bankOf(rng(65), { items: 4 });
  const map = fakeMap(items);
  const server = createServer({ random: rng(66), index: indexOfMap(map) });
  const time = clock();
  server.tick(time.now() - server.now); // 치우기는 서버 시각으로 이틀을 잰다 — 두 시계를 맞춘다
  const top = topWindow();
  const key = storeName({ account: 'acct-gone', revision: 1 });
  const coach = createCoach({
    gameId: 'resp',
    map,
    seed: 's',
    dayOffset: 0,
    scope: top,
    host: {
      guest: false,
      account: 'acct-gone',
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
  const pid = coach.present(items[0]);
  await coach.answer(pid, { correct: true, assessable: true }).stored;
  const set = coach.finishSet({ kind: 'short' });
  await set.folded;
  time.advance(1000);
  const given = coach.feedback(set, 'too_much');
  const handle = await acquireHost({ key, params: PARAMS, now: time.now, guest: false }, top);
  try {
    await handle.settled();
    await handle.upload();
    assert.equal(typeof handle.trail.acked(given.id), 'number', '서버가 응답을 받았다');
    const read = {
      ok: true,
      revision: 1,
      complete: true,
      seen: [given.id],
      seenFrom: null,
      serverTime: server.now,
      responses: [
        {
          id: given.id,
          at: given.at,
          value: given.value,
          completionId: set.completionId,
          decisionId: set.decisionId,
          variant: 'short',
        },
      ],
    };
    assert.deepEqual(idsOf(coach.responses({ server: read }).rows), [given.id]);
    const gone = coach.excludeResponse(given.id);
    assert.deepEqual(coach.responses().rows, [], '뺀 응답은 바로 빠진다');
    await handle.settled();
    await handle.upload();
    assert.equal(typeof handle.trail.acked(gone.id), 'number', '서버가 빼기를 받았다');
    time.advance(3 * 86_400_000);
    server.tick(3 * 86_400_000);
    assert.ok((await handle.trail.compact()) > 0, '이틀 지난 사건을 치웠다');
    assert.equal(handle.trail.heldEvent(gone.id), null, '빼기 사건이 기기에서 치워졌다');
    assert.deepEqual(
      coach.responses().rows,
      [],
      '서버 값을 다시 읽기 전에도 뺀 응답이 되살아나지 않는다',
    );
  } finally {
    releaseHost(handle);
    coach.dispose();
  }
});

// GB4 장면의 둘 — 빼기와 치우기 사이에 목록을 한 번도 읽지 않은 것(GA9)과, 빼기의 저장이 거절된 것(GA1)이다. 판 하나를 끝내 응답을 남기고
// 서버가 받게 한 뒤, 그 응답을 낸 서버 값을 코치에 둔다.
async function servedResponse(tag, port = memoryPort()) {
  const items = bankOf(rng(67), { items: 4 });
  const map = fakeMap(items);
  const server = createServer({ random: rng(68), index: indexOfMap(map) });
  const time = clock();
  server.tick(time.now() - server.now);
  const top = topWindow();
  const account = `acct-${tag}`;
  const key = storeName({ account, revision: 1 });
  const transport = {
    post: (events, since) => server.post(events, since),
    get: async since => ({ summary: await server.summary(since), serverTime: server.now }),
  };
  const coach = createCoach({
    gameId: 'resp',
    map,
    seed: 's',
    dayOffset: 0,
    scope: top,
    host: { guest: false, account, revision: 1, key, port, transport, now: time.now },
  });
  await coach.ready;
  await coach.synced();
  const pid = coach.present(items[0]);
  await coach.answer(pid, { correct: true, assessable: true }).stored;
  const set = coach.finishSet({ kind: 'short' });
  await set.folded;
  time.advance(1000);
  const given = coach.feedback(set, 'too_much');
  const handle = await acquireHost({ key, params: PARAMS, now: time.now, guest: false }, top);
  await handle.settled();
  await handle.upload();
  assert.equal(typeof handle.trail.acked(given.id), 'number', '서버가 응답을 받았다');
  const read = {
    ok: true,
    revision: 1,
    complete: true,
    seen: [given.id],
    seenFrom: null,
    serverTime: server.now,
    responses: [
      {
        id: given.id,
        at: given.at,
        value: given.value,
        completionId: set.completionId,
        decisionId: set.decisionId,
        variant: 'short',
      },
    ],
  };
  assert.deepEqual(idsOf(coach.responses({ server: read }).rows), [given.id]);
  return { coach, handle, server, time, given, map, key, port, transport, account };
}

test('올리는 계정 코치 — 뺀 뒤 목록을 한 번도 읽지 않고 그 빼기가 올라가 이틀 뒤 치워져도 서버 앞 값에서 되살아나지 않는다(4-5 코드 다시 검수 GPT GA9)', async () => {
  const { coach, handle, server, time, given } = await servedResponse('gone-unread');
  try {
    const gone = coach.excludeResponse(given.id);
    await handle.settled();
    await handle.upload();
    assert.equal(typeof handle.trail.acked(gone.id), 'number', '서버가 빼기를 받았다');
    time.advance(3 * 86_400_000);
    server.tick(3 * 86_400_000);
    assert.ok((await handle.trail.compact()) > 0, '이틀 지난 사건을 치웠다');
    assert.equal(handle.trail.heldEvent(gone.id), null, '빼기 사건이 기기에서 치워졌다');
    assert.deepEqual(
      coach.responses().rows,
      [],
      '사이에 목록을 읽지 않았어도 뺀 응답이 되살아나지 않는다',
    );
  } finally {
    releaseHost(handle);
    coach.dispose();
  }
});

test('올리는 계정 코치 — 다른 탭에서 뺀 서버 응답도 이 탭이 그 빼기를 읽고 목록을 센 뒤라면, 이틀 뒤 치워져도 되살아나지 않는다(GB4 · 4-5 코드 다시 검수 GPT GA1 — 저장된 빼기에서 모은다)', async () => {
  const port = memoryPort();
  const a = await servedResponse('gone-other', port);
  const topB = topWindow();
  const other = createCoach({
    gameId: 'resp',
    map: a.map,
    seed: 's',
    dayOffset: 0,
    scope: topB,
    host: {
      guest: false,
      account: a.account,
      revision: 1,
      key: a.key,
      port,
      transport: a.transport,
      now: a.time.now,
    },
  });
  await other.ready;
  const handleB = await acquireHost(
    { key: a.key, params: PARAMS, now: a.time.now, guest: false },
    topB,
  );
  try {
    const gone = other.excludeResponse(a.given.id);
    await handleB.settled();
    await handleB.upload();
    assert.equal(typeof handleB.trail.acked(gone.id), 'number', '서버가 다른 탭의 빼기를 받았다');
    await a.handle.refresh();
    assert.ok(a.handle.trail.heldEvent(gone.id), '이 탭이 다른 탭의 빼기를 읽었다');
    assert.deepEqual(a.coach.responses().rows, [], '목록을 세면 그 빼기를 든다');
    a.time.advance(3 * 86_400_000);
    a.server.tick(3 * 86_400_000);
    assert.ok((await a.handle.trail.compact()) > 0, '이틀 지난 사건을 치웠다');
    assert.equal(a.handle.trail.heldEvent(gone.id), null, '빼기 사건이 이 탭에서 치워졌다');
    assert.deepEqual(a.coach.responses().rows, [], '다른 탭에서 뺀 응답이 되살아나지 않는다');
  } finally {
    releaseHost(handleB);
    other.dispose();
    releaseHost(a.handle);
    a.coach.dispose();
  }
});

test('올리는 계정 코치 — 저장이 거절된 판 응답 빼기는 그 응답을 계속 숨기지 않는다(4-5 코드 다시 검수 GPT GA1)', async () => {
  const base = memoryPort();
  let refuse = false;
  const port = {
    ...base,
    async append(values, options) {
      if (refuse) {
        refuse = false;
        throw Object.assign(new Error('쓰기 거절'), { code: 'STORAGE_FAILED' });
      }
      return base.append(values, options);
    },
  };
  const { coach, handle, given } = await servedResponse('gone-refused', port);
  try {
    refuse = true;
    const gone = coach.excludeResponse(given.id);
    assert.deepEqual(coach.responses().rows, [], '저장 중인 빼기는 목록에서 바로 뺀다');
    await handle.settled();
    assert.equal(handle.trail.heldEvent(gone.id), null, '빼기가 저장되지 않았다');
    assert.deepEqual(
      idsOf(coach.responses().rows),
      [given.id],
      '저장되지 않은 빼기는 응답을 숨기지 않는다',
    );
  } finally {
    releaseHost(handle);
    coach.dispose();
  }
});
