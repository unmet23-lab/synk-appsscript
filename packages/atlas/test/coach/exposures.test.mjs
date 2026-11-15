// 묶음 만남(exposures) — 여러 문항의 만남을 한 번에 묻는 코치 메서드(단계 4 계획 §21-3, 설계 주인 11-15). 결과는 문항마다 exposure()를
// 부른 것과 완전히 같아야 한다 — 세트 문항(같은 계열), 지도 밖 문항, 모르는 문항(null), 띄우기만 하고 닫은 문항까지. 부르는 사이에 보기를
// 들고 있지 않는다(새 사건이 든 뒤 낡은 답을 내지 않는다). 규칙마다 tools/mutants/coach.mjs에 깬 변형이 있다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { pick, rng, seedRange } from '../support/seeds.mjs';
import { subject } from '../support/subject.mjs';
import { bankOf, clock, createCoach, fakeMap, memoryPort, STEP } from './support.mjs';

const { emptySummary, packSummary } = await subject('record/summary.mjs');

let stores = 0;
const keyOf = tag => `synk-atlas:exposures-${process.pid}-${tag}-${(stores += 1)}`;
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

function coachOn({ items, time, port = memoryPort(), key, ...host }) {
  return createCoach({
    gameId: 'g',
    map: fakeMap(items),
    seed: 's',
    dayOffset: 0,
    host: { guest: true, port, key, now: time.now, ...host },
  });
}

// 지도 밖 문항 · 계열만 있는 문항 · 빈 칸을 섞고, 같은 문항이 두 번 들 수도 있는 묶음.
const OUTSIDE = Object.freeze([
  { itemKey: 'x.out1', familyKey: 'x.f1' },
  { itemKey: 'x.out2' },
  { familyKey: 't.f0' },
  null,
  undefined,
  {},
]);
function batchOf(random, items) {
  const pool = [...items, ...OUTSIDE];
  return Array.from({ length: 2 + Math.floor(random() * 14) }, () => pick(random, pool));
}

const same = (coach, batch, note) =>
  assert.deepEqual(
    coach.exposures(batch),
    batch.map(item => coach.exposure(item)),
    note,
  );

// 임의 걸음 — 띄우기만, 혼자 답, 힌트 뒤 답, 판 끝(손님은 요약을 다시 접는다).
async function walk(coach, random, items, time, steps, check) {
  for (let step = 0; step < steps; step += 1) {
    const item = pick(random, items);
    const pid = coach.present(item);
    const roll = random();
    if (roll >= 0.25) {
      if (roll < 0.4) coach.help(pid, 'hint');
      await coach.answer(pid, { correct: random() < 0.6, assessable: true }).stored;
    }
    time.advance(STEP);
    if (step % 9 === 8) await coach.finishSet({ kind: 'short' }).folded;
    await check(step);
  }
}

test('손님 — 임의 기록 위의 임의 묶음이 문항마다의 exposure()와 깊이 같다(세트 · 지도 밖 · 띄우기만 한 제시)', async () => {
  for (const seed of seedRange({ count: 12 })) {
    const random = rng(seed + 900);
    const items = bankOf(random, { items: 16 });
    const time = clock();
    const coach = coachOn({ items, time, key: keyOf(`guest${seed}`) });
    await coach.ready;
    same(coach, items, `씨앗 ${seed} 빈 기록`);
    await walk(coach, random, items, time, 30, async step => {
      if (step % 3 === 0) same(coach, batchOf(random, items), `씨앗 ${seed} 걸음 ${step}`);
    });
    same(coach, [...items, ...OUTSIDE], `씨앗 ${seed} 끝`);
    coach.dispose();
  }
});

test('띄우기만 하고 닫은 제시 — 같은 계열의 다른 문항(세트)도 화면용으로 본 것이고, 측정용으로는 만나지 않았다', async () => {
  const items = bankOf(rng(911), { items: 8 });
  const time = clock();
  const coach = coachOn({ items, time, key: keyOf('shown') });
  await coach.ready;
  const [first, sibling] = items.filter(item => item.familyKey === items[0].familyKey);
  assert.ok(sibling, '같은 계열 문항 둘');
  coach.present(first);
  time.advance(STEP);
  await settle();
  const [a, b] = coach.exposures([first, sibling]);
  assert.deepEqual(a, { seen: true, met: false });
  assert.deepEqual(b, { seen: true, met: false }, '세트의 다른 문항도 화면용으로 본 것');
  same(coach, items, '문항마다와 같다');
  coach.dispose();
});

test('요약을 아직 받지 못한 계정 · 보기가 얹지 못하는 계정 — 모름(null)도 문항마다와 같다', async () => {
  const random = rng(921);
  const items = bankOf(random, { items: 12 });
  // ① 요약을 한 번도 받지 못한 계정(받기가 늘 끊긴다)
  {
    const time = clock();
    const coach = coachOn({
      items,
      time,
      key: keyOf('acct-none'),
      guest: false,
      account: 'acct-exp-none',
      revision: 1,
      transport: async () => {
        throw Object.assign(new Error('offline'), { code: 'OFFLINE' });
      },
    });
    await coach.ready;
    same(coach, items, '빈 계정');
    await walk(coach, random, items, time, 12, async step => {
      if (step % 4 === 0) same(coach, batchOf(random, items), `요약 없음 걸음 ${step}`);
    });
    const nulls = coach.exposures(items).filter(row => row.met === null).length;
    assert.ok(nulls > 0, '모름이 실제로 나왔다');
    coach.dispose();
  }
  // ② 판 묶음이 다른 요약을 든 계정(보기가 아무것도 얹지 못한다)
  {
    const time = clock();
    const port = memoryPort();
    await port.append([
      {
        kind: 'ack',
        acks: [],
        clamped: [],
        dropped: [],
        summary: packSummary(emptySummary('other-edition')),
      },
    ]);
    const coach = coachOn({
      items,
      time,
      port,
      key: keyOf('acct-wait'),
      guest: false,
      account: 'acct-exp-wait',
      revision: 1,
    });
    await coach.ready;
    assert.equal(coach.summary().storage.waiting, true, '보기가 기다린다');
    await walk(coach, random, items, time, 10, async step => {
      if (step % 3 === 0) same(coach, batchOf(random, items), `기다림 걸음 ${step}`);
    });
    same(coach, [...items, ...OUTSIDE], '기다림 끝');
    coach.dispose();
  }
});

test('부르는 사이에 든 답을 다음 부름이 본다 — 들고 있는 보기가 없다', async () => {
  const items = bankOf(rng(931), { items: 10 });
  const time = clock();
  const coach = coachOn({ items, time, key: keyOf('fresh') });
  await coach.ready;
  const before = coach.exposures(items);
  assert.ok(
    before.every(row => row.met === false && row.seen === false),
    '빈 기록',
  );
  const pid = coach.present(items[3]);
  await coach.answer(pid, { correct: true, assessable: true }).stored;
  time.advance(STEP);
  const after = coach.exposures(items);
  assert.deepEqual(after[3], { seen: true, met: true }, '방금 답한 문항');
  same(coach, items, '문항마다와 같다');
  coach.dispose();
});

test('입력 — 빈 묶음은 빈 배열, 배열이 아니면 던진다, 닫은 코치는 던진다', async () => {
  const items = bankOf(rng(941), { items: 4 });
  const time = clock();
  const coach = coachOn({ items, time, key: keyOf('input') });
  await coach.ready;
  assert.deepEqual(coach.exposures([]), []);
  assert.throws(() => coach.exposures(items[0]), TypeError);
  assert.throws(() => coach.exposures(null), TypeError);
  coach.dispose();
  assert.throws(() => coach.exposures(items), { code: 'DISPOSED' });
});
