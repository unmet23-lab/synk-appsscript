// 4-4a 코치 고침 둘(단계 4 계획 §21-3, 설계 주인 11-15) — storage의 「아직 칸에 들지 않은 내 답 · 도움」 수(unfolded)와 summary()의
// 옮겨 오기 전 기록(carried). 「내 위치」가 칸을 읽을 때 방금 푼 답이 아직 칸에 없음을 알고, 옛 기기 기록을 옮긴 학생에게 빈 판 대신
// 옮겨 오기 전 기록을 따로 보이게 한다. 규칙마다 tools/mutants/coach.mjs에 깬 변형이 있다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { rng } from '../support/seeds.mjs';
import { subject } from '../support/subject.mjs';
import { bankOf, clock, createCoach, fakeMap, memoryPort, PARAMS } from './support.mjs';

const { acquireHost, releaseHost } = await subject('coach/host.mjs');
const { createServer } = await import('../support/trail-sync.mjs');

let stores = 0;
const keyOf = tag => `synk-atlas:position-${process.pid}-${tag}-${(stores += 1)}`;
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const eventsOf = async port => (await port.read()).map(row => row.value.event).filter(Boolean);
const indexOfMap = map => ({ edition: 'index-t', lookup: key => map.item(key) });
const DAY = 86_400_000;

function coachOn({ items, time, port = memoryPort(), key, ...host }) {
  return createCoach({
    gameId: 'g',
    map: fakeMap(items),
    seed: 's',
    dayOffset: 0,
    host: { guest: true, port, key, now: time.now, ...host },
  });
}

test('unfolded — 제시는 세지 않고, 저장 중이거나 저장됐지만 아직 접지 않은 답 · 도움만 센다. 판 끝에 손님 요약을 접으면 0', async () => {
  const items = bankOf(rng(951), { items: 8 });
  const time = clock();
  const coach = coachOn({ items, time, key: keyOf('unfolded') });
  await coach.ready;
  const count = () => coach.summary().storage.unfolded;
  assert.equal(count(), 0, '빈 기록');
  const first = coach.present(items[0]);
  await settle();
  assert.equal(count(), 0, '띄우기만 한 제시는 세지 않는다');
  const answered = coach.answer(first, { correct: true, assessable: true });
  assert.equal(count(), 1, '저장 중인 답도 센다');
  await answered.stored;
  assert.equal(count(), 1, '저장됐지만 아직 접지 않은 답');
  const second = coach.present(items[2]);
  coach.help(second, 'hint');
  await coach.answer(second, { correct: false, assessable: true }).stored;
  assert.equal(count(), 3, '도움과 답');
  time.advance(60_000);
  assert.equal(await coach.finishSet({ kind: 'short' }).folded, true);
  assert.equal(count(), 0, '판 끝에 손님 요약을 다시 접었다');
  coach.dispose();
});

test('unfolded — 계정은 서버가 받았어도 접은 요약이 오기 전까지 센다(올리기 대기열 unsent와 다르다 — Fable 5.2 M1)', async () => {
  const items = bankOf(rng(961), { items: 8 });
  const map = fakeMap(items);
  // 받기만 하고 스스로 접지 않는 서버 — 접기는 시험이 부른다.
  const server = createServer({ random: rng(962), index: indexOfMap(map), foldChance: 0 });
  const transport = {
    post: (events, since) => server.post(events, since),
    get: async since => ({ summary: await server.summary(since), serverTime: server.now }),
  };
  const time = clock();
  const key = keyOf('acct');
  const coach = createCoach({
    gameId: 'g',
    map,
    seed: 's',
    dayOffset: 0,
    host: {
      guest: false,
      account: 'acct-unfolded',
      revision: 1,
      key,
      port: memoryPort(),
      transport,
      now: time.now,
    },
  });
  await coach.ready;
  const handle = await acquireHost(
    { key, params: PARAMS, now: time.now, guest: false },
    globalThis,
  );
  const pid = coach.present(items[0]);
  await coach.answer(pid, { correct: true, assessable: true }).stored;
  await handle.settled();
  await handle.upload();
  await settle();
  let { storage } = coach.summary();
  assert.equal(storage.unsent, 0, '서버가 받았다');
  assert.equal(storage.unfolded, 1, '받았지만 아직 접지 않았다 — 칸에 없다');
  await server.fold();
  await handle.pull({ force: true });
  await settle();
  ({ storage } = coach.summary());
  assert.equal(storage.unfolded, 0, '접은 요약이 왔다');
  releaseHost(handle);
  coach.dispose();
});

test('unfoldedRows — 서버 접기가 단위 줄을 바꾸는 내 사건(답 · 도움 · 본인 말 · 제외)을 센다. 제외 · 본인 말은 저장 중이거나 받았지만 접히기 전이면 1이고 unfolded는 0이며, 접은 요약이 오면 둘 다 0이다. 제시 · 판 기록은 세지 않는다(설계 주인 11-17 — 4-4c 끝 판 Fable F4)', async () => {
  const items = bankOf(rng(971), { items: 8 });
  const map = fakeMap(items);
  // 받기만 하고 스스로 접지 않는 서버 — 접기는 시험이 부른다.
  const server = createServer({ random: rng(972), index: indexOfMap(map), foldChance: 0 });
  const transport = {
    post: (events, since) => server.post(events, since),
    get: async since => ({ summary: await server.summary(since), serverTime: server.now }),
  };
  const time = clock();
  const key = keyOf('rows');
  const coach = createCoach({
    gameId: 'g',
    map,
    seed: 's',
    dayOffset: 0,
    host: {
      guest: false,
      account: 'acct-rows',
      revision: 1,
      key,
      port: memoryPort(),
      transport,
      now: time.now,
    },
  });
  await coach.ready;
  const handle = await acquireHost(
    { key, params: PARAMS, now: time.now, guest: false },
    globalThis,
  );
  // [unfoldedRows, unfolded]
  const counts = () => {
    const { storage } = coach.summary();
    return [storage.unfoldedRows, storage.unfolded];
  };
  const sent = async () => {
    await handle.settled();
    await handle.upload();
    await settle();
  };
  const folded = async () => {
    await server.fold();
    await handle.pull({ force: true });
    await settle();
  };
  const pid = coach.present(items[0]);
  await settle();
  assert.deepEqual(counts(), [0, 0], '띄우기만 한 제시는 세지 않는다');
  coach.delivery(pid, { audio: 'completed' });
  assert.deepEqual(counts(), [0, 0], '저장 중인 전달은 세지 않는다');
  const answered = coach.answer(pid, { correct: false, assessable: true });
  assert.deepEqual(counts(), [1, 1], '저장 중인 답은 둘 다 센다');
  await answered.stored;
  await sent();
  await folded();
  assert.deepEqual(counts(), [0, 0], '접은 요약이 왔다');
  // 제외(셸의 「응답 지우기」) — 칸(unfolded)은 바꾸지 않지만 30일째 문장의 수를 바꾼다.
  coach.exclude(answered.eventId);
  assert.deepEqual(counts(), [1, 0], '저장 중인 제외는 이 칸만 센다');
  await sent();
  assert.equal(coach.summary().storage.unsent, 0, '서버가 받았다');
  assert.deepEqual(counts(), [1, 0], '받았지만 아직 접지 않은 제외');
  await folded();
  assert.deepEqual(counts(), [0, 0], '제외를 접은 요약이 왔다');
  // 본인 말(「이미 알아요」)도 같다.
  coach.tell(items[1].units[0], 'known');
  assert.deepEqual(counts(), [1, 0], '저장 중인 본인 말은 이 칸만 센다');
  await sent();
  assert.deepEqual(counts(), [1, 0], '받았지만 아직 접지 않은 본인 말');
  await folded();
  assert.deepEqual(counts(), [0, 0], '본인 말을 접은 요약이 왔다');
  // 도움(힌트)도 단위 줄을 바꾼다 — 답처럼 두 칸 모두 센다(Fable 끝 판 F2).
  const hinted = coach.present(items[3]);
  await sent();
  await folded();
  coach.help(hinted, 'hint');
  assert.deepEqual(counts(), [1, 1], '저장 중인 도움은 둘 다 센다');
  await sent();
  assert.deepEqual(counts(), [1, 1], '받았지만 아직 접지 않은 도움');
  await folded();
  assert.deepEqual(counts(), [0, 0], '도움을 접은 요약이 왔다');
  // 제시를 거두는 제외도 센다(거두는 대상과 상관없이). 판 기록은 세지 않는다.
  const shown = coach.present(items[2]);
  await sent();
  await folded();
  coach.exclude(shown);
  assert.deepEqual(counts(), [1, 0], '제시를 거두는 제외도 센다');
  await sent();
  await folded();
  assert.deepEqual(counts(), [0, 0]);
  time.advance(60_000);
  const set = coach.finishSet({ kind: 'short' });
  assert.deepEqual(counts(), [0, 0], '저장 중인 판 기록은 세지 않는다');
  await set?.folded;
  assert.ok(set?.completionId, '판 기록을 남겼다');
  coach.feedback(set, 'helpful');
  assert.deepEqual(counts(), [0, 0], '저장 중인 판 응답(피드백)은 세지 않는다');
  await sent();
  assert.deepEqual(counts(), [0, 0], '받았지만 아직 접지 않은 판 기록 · 판 응답도 세지 않는다');
  releaseHost(handle);
  coach.dispose();
});

test('unfoldedRows — 손님의 제외는 저장되면 기록부가 바로 다시 접어 0이 되고, 본인 말은 다음 접기(판 끝)까지 센다(설계 주인 11-17 — 4-4c 끝 판 Fable F4)', async () => {
  const items = bankOf(rng(981), { items: 8 });
  const time = clock();
  const coach = coachOn({ items, time, key: keyOf('rows-guest') });
  await coach.ready;
  const counts = () => {
    const { storage } = coach.summary();
    return [storage.unfoldedRows, storage.unfolded];
  };
  const pid = coach.present(items[0]);
  const answered = coach.answer(pid, { correct: false, assessable: true });
  await answered.stored;
  time.advance(60_000);
  assert.equal(await coach.finishSet({ kind: 'short' }).folded, true);
  assert.deepEqual(counts(), [0, 0], '판 끝에 손님 요약을 접었다');
  coach.exclude(answered.eventId);
  assert.deepEqual(counts(), [1, 0], '저장 중인 제외는 이 칸만 센다');
  for (let i = 0; i < 20 && counts()[0] > 0; i += 1) await settle();
  assert.deepEqual(counts(), [0, 0], '제외는 넓게 바꾸는 사건이라 손님 기록부가 바로 다시 접는다');
  coach.tell(items[1].units[0], 'known');
  assert.deepEqual(counts(), [1, 0], '저장 중인 본인 말은 이 칸만 센다');
  for (let i = 0; i < 5; i += 1) await settle();
  assert.deepEqual(counts(), [1, 0], '저장됐지만 아직 접지 않은 본인 말');
  const next = coach.present(items[2]);
  await coach.answer(next, { correct: true, assessable: true }).stored;
  time.advance(60_000);
  assert.equal(await coach.finishSet({ kind: 'short' }).folded, true);
  assert.deepEqual(counts(), [0, 0], '판 끝에 다시 접었다');
  coach.dispose();
});

// 옛 기기 장부 — 계열 둘, 칸 둘(능력 a의 난도 1에 혼자 낸 첫 답 셋 · 맞힘 둘, 능력 b의 난도 2에 도움 하나).
const ledgerOf = (items, t) => ({
  keys: { [`family:${items[0].familyKey}`]: 1, [`family:${items[2].familyKey}`]: 1 },
  cells: {
    'ko.reading.a|1|single-choice': {
      ind: [
        ['x1', t, 'correct'],
        ['x2', t + 1000, 'correct'],
        ['x3', t + 2000, 'incorrect'],
      ],
      helped: [],
    },
    'ko.reading.b|2|single-choice': { ind: [], helped: [['x4', t + 3000]] },
  },
});
const iso = t => new Date(t).toISOString();

test('carried — 손님이 처음 옮긴 장부의 칸 요약을 능력마다 따로 낸다(측정 요약 skills의 칸에는 더하지 않는다)', async () => {
  const items = bankOf(rng(971), { items: 6 });
  const time = clock();
  const t = time.t - 3 * DAY;
  const port = memoryPort();
  const legacy = async () => ({ log: [], ledger: ledgerOf(items, t) });
  const coach = coachOn({ items, time, port, key: keyOf('carried'), legacy });
  await coach.ready;
  await settle();
  const { carried, skills } = coach.summary();
  const ledger = (await eventsOf(port)).find(event => event.type === 'record.carried');
  assert.deepEqual(carried, {
    at: ledger.at,
    skills: [
      {
        id: 'ko.reading.a',
        cells: [{ difficulty: 1, independent: 3, correct: 2, helped: 0, lastAt: iso(t + 2000) }],
      },
      {
        id: 'ko.reading.b',
        cells: [{ difficulty: 2, independent: 0, correct: 0, helped: 1, lastAt: iso(t + 3000) }],
      },
    ],
  });
  assert.deepEqual(
    skills.flatMap(skill => skill.cells),
    [],
    '측정 요약의 칸에는 더하지 않는다',
  );
  coach.dispose();
});

// 진짜 길로 옮긴 장부 사건 하나를 본떠, 장부가 여럿인 기록(차례 없이 겹쳐 옮김 — §18-5 R10)을 짓는다.
async function ledgerEvent() {
  const items = bankOf(rng(981), { items: 6 });
  const time = clock();
  const port = memoryPort();
  const legacy = async () => ({ log: [], ledger: ledgerOf(items, time.t - DAY) });
  const coach = coachOn({ items, time, port, key: keyOf('source'), legacy });
  await coach.ready;
  await settle();
  coach.dispose();
  return { items, event: (await eventsOf(port)).find(event => event.type === 'record.carried') };
}
const cellOf = skillId => ({
  skillId,
  difficulty: 1,
  independent: 1,
  correct: 1,
  helped: 0,
  lastAt: null,
});

test('carried — after가 없고 거두지 않은 장부 가운데 열쇠가 가장 앞선 하나만 읽는다(§18-5 R10)', async () => {
  const { items, event } = await ledgerEvent();
  const ledger = (id, skillId, after = null) => ({ ...event, id, after, cells: [cellOf(skillId)] });
  const withdraw = {
    schema: event.schema,
    id: 'x.gone',
    type: 'record.excluded',
    at: event.at,
    revision: event.revision,
    targetId: 'c.gone',
  };
  const port = memoryPort();
  await port.append(
    [
      ledger('c.again', 'ko.reading.again', event.at), // 다녀온 뒤 다시 옮긴 장부(after 있음)
      ledger('c.gone', 'ko.reading.gone'), // 거둔 장부
      withdraw,
      ledger('c.first', 'ko.reading.first'),
      ledger('c.second', 'ko.reading.second'),
    ].map(row => ({ kind: 'event', event: row })),
  );
  const time = clock();
  const coach = coachOn({ items, time, port, key: keyOf('order') });
  await coach.ready;
  assert.deepEqual(
    coach.summary().carried?.skills.map(skill => skill.id),
    ['ko.reading.first'],
  );
  coach.dispose();
});

// 서버 길 계정은 기기 사건에서 짓지 않고 서버가 접어 요약에 실은 칸을 낸다(§21-22 — sync-received.test.mjs가 받은 요약의 칸을 본다).
test('carried — 동의를 끈 계정(기기 길)은 기기 사건에서 내고, 서버 길 계정은 기기 사건에서 짓지 않는다(이틀 뒤 치우는 기록부 — §21-10 덧붙인 물음 3 · §21-22)', async () => {
  const { items, event } = await ledgerEvent();
  const time = clock();
  const preloaded = async () => {
    const port = memoryPort();
    await port.append([{ kind: 'event', event }]);
    return port;
  };
  const device = coachOn({
    items,
    time,
    port: await preloaded(),
    key: keyOf('device'),
    account: 'acct-device',
    revision: 1,
  });
  await device.ready;
  assert.ok(device.summary().carried, '동의를 끈 계정 — 기기 길은 손님 판 기록부');
  device.dispose();
  const server = coachOn({
    items,
    time,
    port: await preloaded(),
    key: keyOf('server'),
    guest: false,
    account: 'acct-server',
    revision: 1,
  });
  await server.ready;
  assert.equal(
    server.summary().carried,
    null,
    '서버 길 계정은 받은 요약의 칸만 — 받은 요약이 없으면 null',
  );
  // 옮김은 기기에서 계열의 만남만 남기고 단위 줄 · 본인 말 줄을 바꾸지 않는다 — 접히지 않은 채 들고 있어도 학습일 답을 막지 않는다(설계 주인 11-17).
  assert.equal(
    server.summary().storage.unfoldedRows,
    0,
    '접히지 않은 옮김(record.carried)은 세지 않는다',
  );
  server.dispose();
});

test('summary — 능력 줄에 지금 streak 안의 가장 높은 난도(peak)를 싣는다. 도움을 받으면 streak과 함께 비운다(계획 §21-3 · 설계 주인 11-16 새벽 물음 4)', async () => {
  const items = bankOf(rng(971), { items: 14 });
  const time = clock();
  const coach = coachOn({ items, time, key: keyOf('peak') });
  await coach.ready;
  const lineOf = () => coach.summary().skills.find(row => row.id === 'ko.reading.s0');
  // 능력 s0의 계열 f0(문항 0 · 1) · f3(6 · 7) · f6(12 · 13). 난도는 1 + (번호 % 3)이다. 계열마다 첫 만남을 혼자 맞히면 측정 답이다
  for (const item of [items[1], items[6]]) {
    const pid = coach.present(item);
    time.advance(20_000);
    await coach.answer(pid, { correct: true, assessable: true }).stored;
  }
  assert.deepEqual(
    [lineOf().streak, lineOf().level, lineOf().peak],
    [2, 1, 2],
    '난도 2 · 1을 이어서 혼자 맞혔다 — level은 마지막 난도, peak은 그 가운데 가장 높은 난도',
  );
  const helped = coach.present(items[12]);
  coach.help(helped, 'hint');
  time.advance(20_000);
  await coach.answer(helped, { correct: true, assessable: true }).stored;
  assert.deepEqual(
    [lineOf().streak, lineOf().peak],
    [0, null],
    '도움을 받으면 streak과 함께 비운다',
  );
  coach.dispose();
});
