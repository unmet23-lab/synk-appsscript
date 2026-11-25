// 4-5 「나」(단계 4 계획 §22): 단위 요약에 더한 칸 넷 — 이름(kind · label), 마지막 자리의 결과(last), 흔들림 · 또렷함 갈래(state).
// state는 기억 모듈의 standing이 정한다. 아래 장면은 §22-0 실측 표(진짜 기억 모듈에 학습 기록 열두 갈래를 흘려 시각마다 가른 것)
// 그대로다 — 또렷함인 말이 돌아온 뒤 흔들림으로 넘어가지 않는 것과 「이미 알아요」 뒤 61일까지 직접 말함인 것을 포함한다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { PACKAGE_ROOT, subject } from '../support/subject.mjs';
import { clock, createCoach, createMemory, memoryPort, openCoach, PARAMS } from './support.mjs';

const { CLEAR_DAYS } = await subject('memory/index.mjs');
const HOUR = 3_600_000;
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 2, 1);
const memory = createMemory(PARAMS);

// [날, 등급] 줄을 차례로 붙인 상태. 'say:known'은 본인 말 「이미 알아요」.
const fold = rows =>
  rows.reduce(
    (state, [day, grade]) =>
      grade.startsWith('say:')
        ? memory.append(state, { at: T0 + day * DAY, say: grade.slice(4) })
        : memory.append(state, {
            at: T0 + day * DAY,
            grade,
            format: grade === 'good' ? 'spoken' : 'choice',
          }),
    null,
  );

// 마지막 답에서 지난 시각 여덟 — 바로 · 6시간 · 1 · 3 · 8 · 13 · 30 · 61일.
const MARKS = [0, 6 * HOUR, 1 * DAY, 3 * DAY, 8 * DAY, 13 * DAY, 30 * DAY, 61 * DAY];
const S = 'shaky';
const L = 'learning';
const C = 'clear';
const K = 'said';
const SCENES = [
  ['처음 놓침', [[0, 'again']], 0.3, [S, S, S, S, S, S, S, S]],
  [
    '혼자 둘 뒤 놓침',
    [
      [0, 'weak'],
      [1, 'weak'],
      [3, 'again'],
    ],
    0.6,
    [S, S, S, S, S, S, S, S],
  ],
  ['힌트 뒤 맞힘', [[0, 'hard']], 1.3, [S, S, S, S, S, S, S, S]],
  ['처음 혼자 맞힘(고르기)', [[0, 'weak']], 1.3, [L, L, L, L, L, L, L, L]],
  [
    '고르기 혼자 셋',
    [
      [0, 'weak'],
      [1, 'weak'],
      [3, 'weak'],
    ],
    4.9,
    [L, L, L, L, L, L, L, L],
  ],
  [
    '고르기 혼자 넷 — 돌아올 때(13일) 익히는 중',
    [
      [0, 'weak'],
      [1, 'weak'],
      [3, 'weak'],
      [6, 'weak'],
    ],
    8.2,
    [C, C, C, C, C, L, L, L],
  ],
  [
    '만들기 혼자 둘 — 돌아올 때(8일) 익히는 중',
    [
      [0, 'good'],
      [1, 'good'],
    ],
    7.3,
    [C, C, C, C, L, L, L, L],
  ],
  [
    '놓친 뒤 혼자 하나 — 돌아올 때 흔들림',
    [
      [0, 'again'],
      [1, 'weak'],
    ],
    0.9,
    [L, L, S, S, S, S, S, S],
  ],
  [
    '놓친 뒤 혼자 셋 — 간격 7일 미만이라 돌아올 때 흔들림',
    [
      [0, 'again'],
      [1, 'weak'],
      [4, 'weak'],
      [10, 'weak'],
    ],
    6.6,
    [L, L, L, L, S, S, S, S],
  ],
  [
    '놓친 뒤 혼자 넷 — 또렷함, 돌아올 때 흔들림이 아니라 익히는 중',
    [
      [0, 'again'],
      [1, 'weak'],
      [4, 'weak'],
      [10, 'weak'],
      [17, 'weak'],
    ],
    11.6,
    [C, C, C, C, C, L, L, L],
  ],
  ['처음에 이미 알아요', [[0, 'say:known']], 60, [K, K, K, K, K, K, K, K]],
  [
    '놓친 뒤 이미 알아요',
    [
      [0, 'again'],
      [1, 'say:known'],
    ],
    60,
    [K, K, K, K, K, K, K, K],
  ],
];

test('standing — §22-0 실측 표의 열두 갈래를 시각 여덟에서 가른다', () => {
  for (const [name, rows, interval, expected] of SCENES) {
    const state = fold(rows);
    const last = T0 + rows.at(-1)[0] * DAY;
    assert.ok(
      Math.abs(memory.intervalDays(state) - interval) < 0.06,
      `${name}: 간격 ${memory.intervalDays(state)}일`,
    );
    assert.deepEqual(
      MARKS.map(dt => memory.standing(state, last + dt)),
      expected,
      name,
    );
  }
});

test('standing — 빈 줄 · 「다시 배울래요」로 비운 줄은 null, 다시 답하면 그 답대로', () => {
  assert.equal(memory.standing(null, T0), null);
  const cleared = memory.append(fold([[0, 'weak']]), { at: T0 + DAY, say: 'relearn' });
  assert.equal(cleared.empty, true);
  assert.equal(memory.standing(cleared, T0 + DAY), null);
  const back = memory.append(cleared, { at: T0 + 2 * DAY, grade: 'weak', format: 'choice' });
  assert.equal(
    memory.standing(back, T0 + 2 * DAY),
    'learning',
    '비운 뒤의 첫 혼자 맞힘은 익히는 중이다(4-5 끝 판 GPT GE6)',
  );
  const again = memory.append(fold([[0, 'say:known']]), {
    at: T0 + DAY,
    grade: 'again',
    format: 'choice',
  });
  assert.equal(memory.standing(again, T0 + DAY), 'shaky', '「이미 알아요」 뒤에 놓치면 흔들림');
  const known = fold([[0, 'say:known']]);
  const after = memory.append(known, { at: T0 + 2 * DAY, grade: 'weak', format: 'choice' });
  assert.notEqual(memory.standing(after, T0 + 2 * DAY), 'said', '다시 답하면 직접 말함을 벗는다');
});

test('standing — 끈질긴 단위는 마지막 자리와 상관없이 흔들림', () => {
  const state = {
    ...fold([
      [0, 'weak'],
      [1, 'weak'],
      [3, 'weak'],
      [6, 'weak'],
    ]),
    stubborn: true,
  };
  assert.equal(memory.standing(state, T0 + 6 * DAY), 'shaky');
});

test('CLEAR_DAYS는 기억 모듈의 상수 7이고 두뇌의 PARAMS에 없다(고르는 데 쓰지 않는다)', () => {
  assert.equal(CLEAR_DAYS, 7);
  assert.equal(
    Object.keys(PARAMS).some(key => /clear/i.test(key)),
    false,
    '보이기 기준은 판 값(관문 5)에 들지 않는다',
  );
});

// ── 코치 요약의 칸 넷 — 진짜 지도의 생활 문항으로 돈다(life.test.mjs와 같은 꼴) ──
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const MAP_DATA = {
  index: readJson(path.join(PACKAGE_ROOT, 'map', 'index.json')),
  units: readJson(path.join(PACKAGE_ROOT, 'map', 'units.json')),
};
const HELLO = 'life.greetings-expressions-hello';
const { openMap } = await subject('map/index.mjs');
const UNTAGGED = openMap(MAP_DATA)
  .items('world-life')
  .find(item => item.units.length === 1 && item.units[0].startsWith('family:'));

let stores = 0;
async function lifeCoach(extra = {}) {
  stores += 1;
  const time = clock();
  const coach = createCoach({
    gameId: 'world-life',
    mapData: MAP_DATA,
    dayOffset: 540,
    host: {
      guest: true,
      port: memoryPort(),
      key: `synk-atlas:world-me-${process.pid}-${stores}`,
      now: time.now,
    },
    ...extra,
  });
  await coach.ready;
  return { coach, time };
}

test('요약 단위 줄 — kind · label은 지도의 이름, last는 마지막 자리의 결과, state는 standing', async () => {
  const { coach, time } = await lifeCoach();
  const pid = coach.present({ itemKey: HELLO });
  await coach.answer(pid, { correct: false, assessable: true }).stored;
  const [line] = coach.summary().units;
  // 지도 원본의 단위는 fields 차례의 배열이다(4-5 코드 검수 GPT GB6 — 객체로 찾으면 늘 null이라 이름 대조를 건너뛰었다).
  const { fields, units } = MAP_DATA.units;
  const named = units.find(unit => unit[fields.indexOf('id')] === line.unit);
  assert.equal(line.unit, 'ko.life.greet-hello');
  assert.ok(named, '지도 원본에 그 단위의 줄이 있다');
  assert.equal(line.label, named[fields.indexOf('label')], '이름은 지도의 이름이다');
  assert.equal(line.kind, named[fields.indexOf('kind')], '종류는 지도의 종류다');
  assert.equal(line.last, 'again');
  assert.equal(line.state, 'shaky');
  time.advance(2 * DAY);
  const p2 = coach.present({ itemKey: HELLO });
  await coach.answer(p2, { correct: true, assessable: true }).stored;
  const [after] = coach.summary().units;
  assert.equal(after.last, 'weak', '고르는 꼴 정답은 약한 성공');
  assert.equal(after.state, 'learning', '놓친 뒤 혼자 하나 — 아직 돌아오지 않았다');
  coach.dispose();
});

test('요약 단위 줄 — 「이미 알아요」는 last known · state said, 이름 없는 계열 단위는 label null', async () => {
  const { coach } = await lifeCoach();
  coach.tell('ko.life.greet-hello', 'known');
  await new Promise(resolve => setTimeout(resolve, 0));
  const said = coach.summary().units.find(line => line.unit === 'ko.life.greet-hello');
  assert.equal(said?.last, 'known');
  assert.equal(said?.state, 'said');
  coach.dispose();

  assert.ok(UNTAGGED, '태그 없는 생활 문항이 지도에 있다');
  const untagged = await lifeCoach();
  const pid = untagged.coach.present({ itemKey: UNTAGGED.itemKey });
  await untagged.coach.answer(pid, { correct: true, assessable: true }).stored;
  const family = untagged.coach.summary().units.find(line => line.unit.startsWith('family:'));
  assert.ok(family, '계열 단위 줄이 선다');
  assert.equal(family.label, null, '이름 없는 단위(N3) — 「나」가 목록과 수에서 뺀다');
  untagged.coach.dispose();
});

test('요약 단위 줄 — 코치 옵션 label이 넘긴 이름 사전이 지도보다 먼저다(제품이 이미 연 조각의 이름표)', async () => {
  const { coach } = await lifeCoach({
    label: id => (id === 'ko.life.greet-hello' ? '안녕하세요' : null),
  });
  const pid = coach.present({ itemKey: HELLO });
  await coach.answer(pid, { correct: true, assessable: true }).stored;
  const [line] = coach.summary().units;
  assert.equal(line.label, '안녕하세요');
  coach.dispose();
});

// ── 판 응답을 빼는 문(§22-5 · 카본 A1 · Fable F6) ──
const { createClient, createServer } = await import('../support/trail-sync.mjs');
const { bank, indexOf, rng } = await import('../support/trail-world.mjs');

// 다른 기기에서 낸 판 응답 하나(판 결정 · 마침 · 응답) — 그 번호를 이 기기에서 뺀다.
async function elsewhereResponse(server) {
  const other = await createClient(server, { name: 'respothr', port: memoryPort() });
  const decided = other.record.add('decision.made', {
    experienceId: 'world-practice',
    variant: 'v1',
    setId: 'set1',
  });
  const completed = other.record.add('experience.completed', {
    decisionId: decided.event.id,
    experienceId: 'world-practice',
    variant: 'v1',
    setId: 'set1',
  });
  const given = other.record.add('feedback.given', {
    completionId: completed.event.id,
    value: 'too_much',
  });
  await given.stored;
  await other.push();
  return given.event.id;
}

test('판 응답을 빼는 문 — 겨눈 응답이 기기에 없어도 「닿는 줄 없음」을 적어 계정 보기가 기다리지 않는다, 일반 제외는 그대로 기다린다', async () => {
  const server = createServer({ random: rng(41), index: indexOf(bank(rng(40)), 'index-a') });
  const target = await elsewhereResponse(server);
  const plainPort = memoryPort();
  const plain = await createClient(server, { name: 'respplan', port: plainPort });
  await plain.push();
  assert.equal(plain.record.view().waitAll, false, '시작');
  await plain.record.add('record.excluded', { targetId: target }).stored;
  assert.equal(
    plain.record.view().waitAll,
    true,
    '일반 제외 — 기기에 없는 대상은 서버가 접을 때까지 기다린다(지금 그대로)',
  );

  const doorPort = memoryPort();
  const door = await createClient(server, { name: 'respdoor', port: doorPort });
  await door.push();
  const made = door.record.add('record.excluded', { targetId: target }, { nothingTouched: true });
  await made.stored;
  assert.equal(door.record.view().waitAll, false, '판 응답을 빼는 문 — 기다리지 않는다');
  const row = (await doorPort.read()).find(entry => entry.value.event?.id === made.event.id);
  assert.deepEqual(row.value.touches, { units: [], skills: [] }, '「닿는 줄 없음」 메모');
  const plainRow = (await plainPort.read()).find(
    entry => entry.value.event?.type === 'record.excluded',
  );
  assert.equal(plainRow.value.touches, undefined, '일반 제외에는 빈 메모를 적지 않는다');
});

test('coach.excludeResponse — 저장 중인 내 사건도 판 응답이 아니면 던진다. 막 만든 제시 · 답이 저장되기 전이어도 같다(4-5 끝 판 카본 D3)', async () => {
  const port = memoryPort();
  const time = clock();
  stores += 1;
  const coach = createCoach({
    gameId: 'world-life',
    mapData: MAP_DATA,
    dayOffset: 540,
    host: { guest: true, port, key: `synk-atlas:world-me-${process.pid}-${stores}`, now: time.now },
  });
  await coach.ready;
  const pid = coach.present({ itemKey: HELLO });
  assert.throws(
    () => coach.excludeResponse(pid),
    TypeError,
    '저장 중인 제시는 이 문으로 빼지 않는다',
  );
  const made = coach.answer(pid, { correct: true, assessable: true });
  assert.throws(() => coach.excludeResponse(made.eventId), TypeError, '저장 중인 답도 아니다');
  await made.stored;
  const rows = await port.read();
  assert.ok(
    rows.every(entry => entry.value.event?.type !== 'record.excluded'),
    '제외 사건이 저장소에 없다',
  );
  coach.dispose();
});

test('coach.excludeResponse — 판 응답만 받는다: 기기에 있는 다른 사건이면 던지고, 기기의 응답과 다른 기기의 응답은 뺀다', async () => {
  const port = memoryPort();
  const time = clock();
  stores += 1;
  const coach = createCoach({
    gameId: 'world-life',
    mapData: MAP_DATA,
    dayOffset: 540,
    host: { guest: true, port, key: `synk-atlas:world-me-${process.pid}-${stores}`, now: time.now },
  });
  await coach.ready;
  const pid = coach.present({ itemKey: HELLO });
  await coach.answer(pid, { correct: true, assessable: true }).stored;
  const set = coach.finishSet({ kind: 'short' });
  await set.folded;
  const given = coach.feedback(set, 'want_more');
  time.advance(1000);
  assert.throws(() => coach.excludeResponse(pid), TypeError, '제시는 이 문으로 빼지 않는다');
  assert.throws(() => coach.excludeResponse(set.completionId), TypeError, '판 마침도 아니다');
  const dropped = coach.excludeResponse(given.id);
  assert.equal(dropped.type, 'record.excluded');
  assert.equal(dropped.targetId, given.id);
  await new Promise(resolve => setTimeout(resolve, 0));
  const other = await lifeCoach();
  const otherPid = other.coach.present({ itemKey: HELLO });
  await other.coach.answer(otherPid, { correct: true, assessable: true }).stored;
  const otherSet = other.coach.finishSet({ kind: 'short' });
  await otherSet.folded;
  const elsewhere = other.coach.feedback(otherSet, 'helpful');
  other.coach.dispose();
  const away = coach.excludeResponse(elsewhere.id);
  assert.equal(
    away.targetId,
    elsewhere.id,
    '기기에 없는 번호(다른 기기의 응답)도 판 응답 목록에서 온 것을 믿고 뺀다',
  );
  await new Promise(resolve => setTimeout(resolve, 0));
  const rows = await port.read();
  assert.deepEqual(
    rows.find(entry => entry.value.event?.id === away.id)?.value.touches,
    { units: [], skills: [] },
    '코치 길로도 「닿는 줄 없음」 메모가 기록부까지 간다',
  );
  assert.deepEqual(
    rows.find(entry => entry.value.event?.id === dropped.id)?.value.touches,
    { units: [], skills: [] },
    '기기에 있는 응답을 뺄 때도 같은 메모 — 판 응답은 닿는 줄이 없다',
  );
  coach.dispose();
});

test('coach.untell — 「다시 배울래요」 사건을 빼고, 저장이 끝나면 참으로 풀린다. 그때 요약은 단위를 앞 자리(직접 말함)로 돌려준다. 다른 사건 · 기기에 없는 번호면 던지고, 저장되지 않으면 거짓이다(4-5 끝 판 GPT GB4 · 설계 주인 11-19 새벽)', async () => {
  const UNIT = 'ko.life.greet-hello';
  const { coach } = await lifeCoach();
  coach.tell(UNIT, 'known');
  await new Promise(resolve => setTimeout(resolve, 0));
  const relearn = coach.tell(UNIT, 'relearn');
  await new Promise(resolve => setTimeout(resolve, 0));
  const before = coach.summary().units.find(line => line.unit === UNIT);
  assert.notEqual(before?.state, 'said', '「다시 배울래요」 뒤에는 직접 말함이 아니다');
  const undone = coach.untell(relearn.id);
  assert.equal(undone.event.type, 'record.excluded');
  assert.equal(undone.event.targetId, relearn.id);
  assert.equal(await undone.stored, true, '저장되면 참');
  const after = coach.summary().units.find(line => line.unit === UNIT);
  assert.equal(after?.state, 'said', '저장이 끝나면 요약이 앞 자리로 돌아와 있다');
  const pid = coach.present({ itemKey: HELLO });
  assert.throws(
    () => coach.untell(pid),
    TypeError,
    '본인 말이 아닌 사건(저장 중인 제시)은 받지 않는다',
  );
  assert.throws(
    () => coach.untell('a.0000000000000.0000.none0000'),
    TypeError,
    '기기에 없는 번호도 받지 않는다',
  );
  coach.dispose();

  const port = memoryPort();
  let failing = false;
  const flaky = {
    ...port,
    async append(values, options) {
      if (failing) throw Object.assign(new Error('저장 실패'), { code: 'STORAGE_ERROR' });
      return port.append(values, options);
    },
  };
  const time = clock();
  stores += 1;
  const shaky = createCoach({
    gameId: 'world-life',
    mapData: MAP_DATA,
    dayOffset: 540,
    host: {
      guest: true,
      port: flaky,
      key: `synk-atlas:world-me-${process.pid}-${stores}`,
      now: time.now,
    },
  });
  await shaky.ready;
  const told = shaky.tell(UNIT, 'relearn');
  await new Promise(resolve => setTimeout(resolve, 0));
  failing = true;
  assert.equal(
    await shaky.untell(told.id).stored,
    false,
    '저장되지 않으면 거짓 — 셸은 되돌리기를 남긴다',
  );
  shaky.dispose();
});

// 5-3 전 고침 GB4(설계 주인 11-25): 「다시 배울래요」로 비운 단위를 새것으로 다시 들일 때 이유 문장이 「처음 만나요」였다. 같은 코치는 그 문항을
// 만났다고 안다(exposure). recommend와 plan(홈의 다음 레슨 줄)이 「처음부터 다시 만나요」를 말한다.
test('「다시 배울래요」 뒤 새것으로 다시 들인 단위 — recommend · plan의 문장은 「처음부터 다시 만나요」이고, 같은 코치는 그 문항을 만났다고 안다(5-3 전 고침 GB4)', async () => {
  const item = Object.freeze({
    itemKey: 'bank',
    familyKey: 'bank',
    units: ['ko.word.bank'],
    skillId: 'ko.reading.vocabulary',
    difficulty: 1,
    responseFormat: 'single-choice',
    order: 0,
    modality: 'reading',
  });
  const time = clock(T0);
  const { coach } = await openCoach({ items: [item], time });
  try {
    for (const step of [DAY, 20_000]) {
      const pid = coach.present(item);
      await coach.answer(pid, { correct: true, assessable: true }).stored;
      time.advance(step);
    }
    coach.tell('ko.word.bank', 'relearn');
    await new Promise(resolve => setTimeout(resolve, 0));
    time.advance(DAY);
    assert.deepEqual(coach.exposure(item), { seen: true, met: true }, '장면: 만난 적 있는 문항');
    const picked = coach.recommend([item]);
    const [entry] = coach.plan([{ id: 'next-lesson', candidates: [item] }]);
    assert.deepEqual([picked.why.code, picked.why.slots.relearn], ['unit.new', true]);
    assert.equal(picked.why.line, '「bank」 처음부터 다시 만나요.');
    assert.equal(entry.why.line, '「bank」 처음부터 다시 만나요.', '홈의 다음 레슨 줄');
    // 근거 칸 relearn이 든 이유도 제시 사건의 이유 검사를 지나 저장된다.
    const pid = coach.present(picked.selected);
    assert.equal(await coach.answer(pid, { correct: true, assessable: true }).stored, true);
  } finally {
    coach.dispose();
  }
});
