// 손님 접기의 기록부 장면(기기 답 저장 빠르게 하기 설계 2-5 · 검토 D2 · 시험에 더할 장면 2 ~ 4, 11-23). 접을 때마다 기록부의 요약 줄이 든 사건
// 가운데 열쇠 ≤ 접은 자리인 것을 처음부터 접은 줄(linesOfGroups(groupsOf(…)))과 packSummary 바이트까지 같은지 본다(열쇠 차례 포함).
import assert from 'node:assert/strict';
import test from 'node:test';
import { entryOf, mutableIndex } from '../support/held-world.mjs';
import { subject } from '../support/subject.mjs';
import { memory, PARAMS } from '../support/trail-sync.mjs';
import { bank, rng, T0 } from '../support/trail-world.mjs';

const { openRecord } = await subject('record/log.mjs');
const { memoryPort } = await subject('record/port.mjs');
const { groupsOf } = await subject('record/adapt.mjs');
const { linesOfGroups } = await subject('record/rows.mjs');
const { packSummary } = await subject('record/summary.mjs');
const { EVENT_TYPES } = await subject('record/events.mjs');

const bytes = lines => JSON.stringify(packSummary({ lines }).lines);
// 그 기록부가 든 사건 가운데 열쇠 ≤ until을 처음부터 접은 줄과 그 기록부 요약의 줄이 바이트까지 같다.
function sameFold(record, index, label) {
  const until = record.summary.foldedUntil;
  const entries = record
    .heldItems()
    .filter(item => item.key <= until)
    .map(entryOf);
  const want = linesOfGroups(groupsOf(entries), { memory, params: PARAMS, index });
  assert.equal(
    bytes(record.summary.lines),
    bytes(want),
    `${label}: 접은 줄 = 처음부터(until ${until})`,
  );
  return until;
}

const legacy = (id, m, type, fields) => {
  const at = new Date(T0 + m * 60_000).toISOString();
  return { schema: 1, id, scope: { domain: 'LAB' }, at, recordedAt: at, type, ...fields };
};
const legacyPractice = (n, item) => [
  legacy(`d${n}`, n, 'decision.made', {
    experienceId: 'g',
    variant: 'v',
    policy: 'x',
    evidence: [],
  }),
  legacy(`p${n}`, n, 'practice.presented', {
    decisionId: `d${n}`,
    itemKey: item.itemKey,
    firstExposure: true,
    measure: {
      skillId: item.skillId,
      modality: 'listening',
      difficulty: item.difficulty,
      familyKey: item.familyKey,
      audioRequired: false,
      confounded: false,
      responseFormat: item.responseFormat,
    },
  }),
  legacy(`a${n}`, n, 'practice.attempted', {
    presentationId: `p${n}`,
    attemptNo: 1,
    verdict: 'correct',
    errorTags: [],
  }),
];
const presented = item => ({
  setId: 'set1',
  itemKey: item.itemKey,
  familyKey: item.familyKey,
  skillId: item.skillId,
  difficulty: item.difficulty,
  responseFormat: item.responseFormat,
  modality: 'listening',
  audioRequired: false,
  confounded: false,
  units: item.units?.length ? item.units : ['u0'],
  firstExposure: true,
  editions: { params: 'p', memory: 'm', ability: 'a', select: 's', index: 'index-a' },
  expected: { floor: 0.25, memory: 0.5, skill: 0.6 },
  arm: 'adaptive',
  reason: { code: 'unit.new', slots: {}, evidence: {}, target: 'u0', tier: 2, introduced: [] },
});
async function practise(record, item, clock, verdict = 'correct') {
  clock.now += 60_000;
  const shown = record.add(EVENT_TYPES.presented, presented(item));
  await shown.stored;
  const made = record.add(EVENT_TYPES.attempted, {
    presentationId: shown.event.id,
    attemptNo: 1,
    verdict,
    errorTags: [],
  });
  await made.stored;
  return [shown.event.id, made.event.id];
}

// 꼬리 읽기(range)를 잡아 둘 수 있는 포트 — 읽을 꼬리는 부른 그때 정해지고(IndexedDB처럼), 답은 문을 열 때 온다.
function gatedPort(base) {
  const gates = [];
  return {
    ...base,
    range(after) {
      const rows = base.range(after);
      if (!gates.length) return rows;
      return gates.shift().then(() => rows);
    },
    hold() {
      let open;
      gates.push(
        new Promise(resolve => {
          open = resolve;
        }),
      );
      return () => open();
    },
  };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

function world(seed = 3) {
  const random = rng(seed);
  const items = bank(random);
  const index = mutableIndex(items, random);
  const base = memoryPort();
  const clock = { now: T0 + 3_600_000 };
  const open = (tag, port = base) =>
    openRecord({ port, guest: true, memory, params: PARAMS, index, now: () => clock.now, tag });
  return { items, index, base, clock, open };
}

test('같은 번호가 더 작은 열쇠로 다시 서고(R10) 그 열쇠까지만 읽은 채 접어도 접은 줄 = 처음부터 — 내 덧붙이기(큰 열쇠)가 꼬리 읽기 뒤에 끝났다', async () => {
  const w = world();
  const gated = gatedPort(w.base);
  const mine = await w.open('minexxxx', gated);
  const before = sameFold(mine, w.index, '열기');
  const other = await w.open('otherxxx');
  const events = legacyPractice(1, w.items[0]);
  await other.importLegacy(events); // 다른 탭이 먼저 옮겼다(작은 열쇠) — 이 탭은 아직 읽지 않았다
  await other.localSaved();
  // 다른 탭 요약 뒤에 든 사건 — 이 탭이 그 요약을 받고도 스스로 접게 한다
  await w.base.append([{ kind: 'event', event: legacyPractice(2, w.items[1])[0] }]);
  const open = gated.hold();
  const openLater = gated.hold(); // 옮기기 뒤의 다시 접기가 읽을 꼬리
  const folding = mine.refold(); // 꼬리 읽기가 지금 꼬리를 정하고 기다린다
  const moving = mine.importLegacy([...events, ...legacyPractice(3, w.items[2])]); // 같은 번호를 큰 열쇠로 다시 덧붙인다
  await settle();
  open();
  await folding;
  const until = sameFold(mine, w.index, '작은 열쇠까지 읽고 접음');
  assert.ok(until > before, '새 꼬리까지 접었다');
  const lowered = mine.heldItems().find(item => item.event.id === 'a1');
  assert.ok(lowered.key <= until, '그 번호는 작은 열쇠로 섰다');
  assert.ok(
    mine.heldItems().some(item => item.key > until),
    '내 덧붙이기의 큰 열쇠는 아직 읽지 않았다',
  );
  openLater();
  await moving;
  sameFold(mine, w.index, '다 읽고 접음');
});

// 장면 2(검토 D2): 접기 → 읽은 자리 뒤의 내 덧붙이기 → 다른 탭의 앞 열쇠 사건 → 접기. 사이에 처음부터 접기(지도 더하기 · 다시 읽기)를 끼운다.
test('접은 뒤 읽은 자리 뒤에 내 덧붙이기가 서고, 처음부터 접기(지도 더하기 · 다시 읽기)를 지나도 그 덧붙이기가 다음 접기에 든다(검토 D2)', async () => {
  const w = world(5);
  const other = await w.open('otherxxx');
  const gated = gatedPort(w.base);
  const mine = await w.open('minexxxx', gated);
  await practise(mine, w.items[0], w.clock);
  await mine.refold();
  sameFold(mine, w.index, '첫 접기');
  for (const rebuild of ['지도 더하기', '다시 읽기']) {
    await practise(other, w.items[1], w.clock, 'incorrect'); // 다른 탭의 앞 열쇠 사건(아직 안 읽음)
    const open = gated.hold();
    const folding = mine.refold();
    const late = practise(mine, w.items[2], w.clock); // 꼬리 읽기 뒤에 끝나는 내 덧붙이기(읽은 자리 뒤)
    await settle();
    if (rebuild === '지도 더하기') w.index.addMap();
    open();
    await folding;
    await late;
    const until = sameFold(mine, w.index, `${rebuild} 뒤 처음부터 접기`);
    assert.ok(
      mine.heldItems().some(item => item.key > until),
      '내 덧붙이기가 읽은 자리 뒤에 있다',
    );
    if (rebuild === '다시 읽기') {
      await other.clear();
      await mine.refresh(); // 다른 탭이 비웠다 — 다시 읽고 그 자리에서 처음부터 접는다
      sameFold(mine, w.index, '다시 읽은 뒤');
      await practise(mine, w.items[3], w.clock);
    }
    await mine.refold();
    sameFold(mine, w.index, `${rebuild} 뒤 이어 접기`);
    assert.equal(
      mine.heldItems().every(item => item.key <= mine.summary.foldedUntil),
      true,
      '든 사건이 모두 접혔다',
    );
  }
});

// 장면 3: 다른 탭이 쓴 손님 요약(until이 더 큼)을 받은 뒤 이어 접는다 — 내 접기 캐시는 그 요약과 따로 든 사건에서 짓는다.
test('다른 탭이 쓴 더 앞선 손님 요약을 받은 뒤의 이어 접기 = 처음부터', async () => {
  const w = world(7);
  const mine = await w.open('minexxxx');
  const other = await w.open('otherxxx');
  await practise(mine, w.items[0], w.clock);
  await mine.refold();
  sameFold(mine, w.index, '내 접기');
  await practise(other, w.items[1], w.clock);
  await practise(other, w.items[2], w.clock, 'incorrect');
  await other.refold();
  await other.localSaved();
  await mine.refresh(); // 다른 탭의 요약을 받는다(더 큰 until)
  assert.equal(mine.summary.foldedUntil, other.summary.foldedUntil, '다른 탭의 요약이 바탕이다');
  await practise(mine, w.items[3], w.clock);
  await practise(mine, w.items[1], w.clock);
  await mine.refold();
  sameFold(mine, w.index, '받은 뒤 이어 접기');
});

// 장면 4: 새 사건 없이 지도만 더한 뒤 사건 하나가 들고 접는다.
test('새 사건 없이 지도만 더한 뒤 사건 하나가 들어 접어도 = 처음부터(지도의 판으로 다시 짓는다)', async () => {
  const w = world(9);
  const mine = await w.open('minexxxx');
  for (const item of w.items.slice(0, 4)) await practise(mine, item, w.clock);
  await mine.refold();
  sameFold(mine, w.index, '지도 전');
  w.index.addMap();
  w.index.addMap();
  const [shown] = await practise(mine, w.items[5], w.clock);
  await mine.refold();
  sameFold(mine, w.index, '지도 더한 뒤');
  assert.equal(mine.pending().has(shown), false);
});
