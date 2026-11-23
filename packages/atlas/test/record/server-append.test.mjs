// 서버 이어 접기 장면(설계 주인 11-23 (가) · Fable 5.2 설계 검토 S1~S4). 장면마다 같은 사건을 메모리 서버 둘에 올려 하나는 이어 접기를 켜고
// 하나는 끈 채 접고, 두 요약이 같은 글자이고 처음부터 전부 접은 기준(linesOfGroups)과 같은지 본다. 어느 길로 접었는지(skills.appended ·
// refolded)도 본다 — 처음부터 접어야 하는 장면이 이어 접히면 값이 맞아도 규칙(가운데 끼면 처음부터)을 어긴 것이다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';
import { createMemoryAccount, T0 } from '../support/trail-world.mjs';

const { createEvent, eventId } = await subject('record/events.mjs');
const { foldAccount, summaryOf, entryOf, foldEdition } = await subject('record/server.mjs');
const { linesOfGroups } = await subject('record/rows.mjs');
const { EMPTY_INDEX, groupsOf } = await subject('record/adapt.mjs');
const { createMemory } = await subject('memory/index.mjs');
const { PARAMS } = await subject('params.mjs');

const memory = createMemory(PARAMS);
const L = 'ko.listening.detail';
const R = 'ko.reading.detail';
const T = T0 + 3_600_000;
// 계열 fam0에는 두 능력(L · R)의 문항이, fam1 · fam2에는 L의 문항이 있다.
const ITEMS = {
  a0: { itemKey: 'a0', familyKey: 'fam0', skillId: L, difficulty: 1, units: ['u0'] },
  b0: { itemKey: 'b0', familyKey: 'fam0', skillId: R, difficulty: 2, units: ['u1'] },
  a1: { itemKey: 'a1', familyKey: 'fam1', skillId: L, difficulty: 2, units: ['u2'] },
  a2: { itemKey: 'a2', familyKey: 'fam2', skillId: L, difficulty: 3, units: ['u3'] },
};

const sorted = summary =>
  JSON.stringify({
    ...summary,
    lines: summary.lines
      .map(({ seq, ...line }) => line)
      .sort((x, y) => `${x.kind}|${x.key}`.localeCompare(`${y.kind}|${y.key}`)),
  });

function events() {
  let n = 100;
  const make = (type, fields, atMs, id) => {
    n += 1;
    return createEvent(type, fields, { id: id ?? eventId(atMs, n, 'case0000'), atMs, revision: 1 });
  };
  return {
    shown: (key, atMs, { firstExposure = true, audioRequired = false } = {}) =>
      make(
        'practice.presented',
        {
          setId: 'set1',
          ...ITEMS[key],
          responseFormat: 'single-choice',
          modality: 'listening',
          audioRequired,
          confounded: false,
          firstExposure,
          editions: { ...PARAMS.editions, index: 'index-0' },
          expected: { floor: 0.25, memory: 1, skill: 0.6 },
          arm: 'adaptive',
          reason: {
            code: 'unit.new',
            slots: {},
            evidence: {},
            target: null,
            tier: 0,
            introduced: [],
          },
        },
        atMs,
      ),
    answer: (p, atMs, verdict = 'correct', id = undefined) =>
      make(
        'practice.attempted',
        { presentationId: p.id, attemptNo: 1, verdict, errorTags: [] },
        atMs,
        id,
      ),
    help: (p, atMs, level = 'cue') =>
      make(
        'practice.helped',
        { presentationId: p.id, helpId: `h${n}`, level, contentRef: 'c' },
        atMs,
      ),
    delivery: (p, atMs, audio = 'completed') =>
      make('practice.delivery', { presentationId: p.id, audio }, atMs),
    stated: atMs => make('unit.stated', { unit: 'u9', say: 'known' }, atMs),
    excluded: (target, atMs) => make('record.excluded', { targetId: target.id }, atMs),
    carried: atMs =>
      make('record.carried', { families: { fam9: 1 }, items: {}, after: null }, atMs),
  };
}

function scene() {
  const a = createMemoryAccount();
  const b = createMemoryAccount();
  let index = EMPTY_INDEX;
  const lineOf = async (kind, key) => {
    const edition = foldEdition(PARAMS, index);
    const summary = await summaryOf(a.account.store(edition), { edition });
    return summary.lines.find(l => l.kind === kind && l.key === key)?.value ?? null;
  };
  // 처음부터 전부 접은 기준과 같은가 — 접기가 끝났을 때만(표지까지의 사건 = 로그 전부).
  const sameAsOracle = async () => {
    const edition = foldEdition(PARAMS, index);
    const summary = await summaryOf(a.account.store(edition), { edition });
    const want = linesOfGroups(groupsOf(a.log().map(entryOf)), { memory, params: PARAMS, index });
    for (const kind of Object.keys(want))
      assert.deepEqual(
        Object.fromEntries(summary.lines.filter(l => l.kind === kind).map(l => [l.key, l.value])),
        Object.fromEntries(want[kind]),
        `${kind} 줄 = 처음부터 전부 접은 기준`,
      );
  };
  return {
    ...events(),
    useIndex(next) {
      index = next;
    },
    send(list, receivedMs) {
      a.append(list, receivedMs);
      b.append(list, receivedMs);
    },
    // 한 번 접는다(상한 cap). 두 서버 · 기준을 견주고 이어 접은 쪽의 결과를 돌려준다.
    async fold(cap = 2000) {
      const ctx = { memory, params: PARAMS, index, nowMs: T + 1e9, cap, random: () => 0.5 };
      const left = await foldAccount(a.account, ctx);
      const right = await foldAccount(b.account, { ...ctx, append: false });
      assert.equal(right.skills.appended, 0, '끈 쪽은 이어 접지 않는다');
      for (const edition of a.heads.keys()) {
        const read = server => summaryOf(server.account.store(edition), { edition });
        assert.equal(sorted(await read(a)), sorted(await read(b)), `${edition}: 켠 쪽 = 끈 쪽`);
      }
      if (left.done && !left.building) await sameAsOracle();
      return left;
    },
    line: lineOf,
  };
}

// 이어 접은 능력 수 · 처음부터 접은 능력 수.
const paths = (result, appended, refolded) =>
  assert.deepEqual(
    [result.skills.appended, result.skills.refolded],
    [appended, refolded],
    '이어 접은 능력 · 처음부터 접은 능력',
  );

// 앞 접기 하나를 깔아 둔다 — fam1의 L 답. 새 머리의 첫 접기는 처음부터다(판 묶음 · 바닥이 바뀐 때와 같은 길).
async function base(s) {
  const p = s.shown('a1', T - 600_000);
  s.send([p, s.answer(p, T - 590_000)], T - 500_000);
  paths(await s.fold(), 0, 1);
}

test('제 차례로 온 답은 이어 접는다 — 새 머리의 첫 접기는 처음부터', async () => {
  const s = scene();
  await base(s);
  const p = s.shown('a0', T);
  s.send([p, s.answer(p, T + 10)], T + 1000);
  paths(await s.fold(), 1, 0);
  const q = s.shown('a2', T + 20);
  s.send([q, s.answer(q, T + 30, 'incorrect')], T + 2000);
  paths(await s.fold(), 1, 0);
});

test('같은 시각 · 더 작은 번호의 다른 능력 답이 첫 만남을 가져가면 그 계열의 능력 전부를 처음부터 접는다(S1 · S2)', async () => {
  const s = scene();
  await base(s);
  const p = s.shown('a0', T - 100);
  s.send([p, s.answer(p, T, 'correct', eventId(T, 5, 'bbbb0000'))], T + 1000);
  paths(await s.fold(), 1, 0);
  const before = await s.line('skill', L);
  const q = s.shown('b0', T - 50);
  s.send([q, s.answer(q, T, 'correct', eventId(T, 1, 'aaaa0000'))], T + 2000);
  paths(await s.fold(), 0, 2);
  assert.equal(
    (await s.line('skill', L)).n,
    before.n - 1,
    'L의 답이 첫 만남을 잃어 측정 답이 준다',
  );
});

test('같은 시각 · 더 작은 번호의 판정 못 한 혼자 답이 첫 만남을 가져가도 처음부터 접는다(S1)', async () => {
  const s = scene();
  await base(s);
  const p = s.shown('a0', T - 100);
  s.send([p, s.answer(p, T, 'correct', eventId(T, 5, 'bbbb0000'))], T + 1000);
  paths(await s.fold(), 1, 0);
  const before = await s.line('skill', L);
  const q = s.shown('a0', T - 50);
  s.send([q, s.answer(q, T, 'unassessed', eventId(T, 1, 'aaaa0000'))], T + 2000);
  paths(await s.fold(), 0, 1);
  assert.equal((await s.line('skill', L)).n, before.n - 1, 'L의 답이 첫 만남을 잃는다');
});

test('그 능력의 마지막 줄보다 이르거나 같은 시각의 새 답은 그 능력만 처음부터 접는다(늦은 답 · 같은 시각)', async () => {
  const s = scene();
  await base(s);
  const p = s.shown('a0', T);
  s.send([p, s.answer(p, T + 100)], T + 1000);
  paths(await s.fold(), 1, 0);
  const late = s.shown('a2', T);
  s.send([late, s.answer(late, T + 50, 'incorrect')], T + 2000);
  paths(await s.fold(), 0, 1);
  const tie = s.shown('b0', T + 200);
  s.send([tie, s.answer(tie, T + 300), s.shown('a0', T + 200)], T + 3000);
  paths(await s.fold(), 2, 0); // R은 새 줄, 같은 계열의 L은 새 줄 없이
  const r = s.shown('b0', T + 250);
  s.send([r, s.answer(r, T + 300, 'incorrect')], T + 4000); // R의 lastAt과 같은 시각
  paths(await s.fold(), 1, 1);
});

test('늦게 온 도움이 접힌 답을 도움받은 답으로 바꾸면 처음부터 접는다(바뀐 줄)', async () => {
  const s = scene();
  await base(s);
  const p = s.shown('a0', T);
  s.send([p, s.answer(p, T + 20)], T + 1000);
  paths(await s.fold(), 1, 0);
  assert.equal((await s.line('cell', `${L}|1`)).independent, 1);
  s.send([s.help(p, T + 10)], T + 2000);
  paths(await s.fold(), 0, 1);
  const cell = await s.line('cell', `${L}|1`);
  assert.equal(cell.independent, 0, '혼자 낸 첫 답이 아니다');
  assert.equal(cell.helped, 1, '도움받은 첫 만남');
});

test('도움만 먼저 접히고 답이 다음 접기에 오면 이어 접는다(도움 줄도 능력 줄에 선다 — S3)', async () => {
  const s = scene();
  await base(s);
  const p = s.shown('a0', T);
  s.send([p, s.help(p, T + 10)], T + 1000);
  paths(await s.fold(), 1, 0);
  s.send([s.answer(p, T + 20)], T + 2000);
  paths(await s.fold(), 1, 0);
  assert.equal((await s.line('cell', `${L}|1`)).helped, 1);
});

test('firstExposure false 제시의 장부 만남이 첫 만남이면 그 답은 측정 답이 아니다 — 이어 접어도 같다(S3)', async () => {
  const s = scene();
  await base(s);
  const before = await s.line('skill', L);
  const p = s.shown('a0', T, { firstExposure: false });
  s.send([p, s.answer(p, T + 20)], T + 1000);
  paths(await s.fold(), 1, 0);
  assert.equal((await s.line('skill', L)).n, before.n, '측정 답이 늘지 않는다');
  s.send([s.answer(p, T + 30, 'incorrect')], T + 2000);
  paths(await s.fold(), 1, 0);
});

test('답 뒤 풀이 보기는 묶음 비트만 바꾼다 — 능력 · 칸이 읽는 칸이 그대로라 이어 접는다(S4)', async () => {
  const s = scene();
  await base(s);
  const p = s.shown('a0', T);
  s.send([p, s.answer(p, T + 10)], T + 1000);
  paths(await s.fold(), 1, 0);
  s.send([s.help(p, T + 20, 'explanation')], T + 2000);
  const result = await s.fold();
  paths(result, 1, 0);
  assert.ok(result.changed > 0, '계열 · 문항 줄의 비트는 바뀐다');
});

test('제외 · 본인 말 · 장부가 든 접기는 닿은 능력을 모두 처음부터 접는다', async () => {
  const s = scene();
  await base(s);
  const p = s.shown('a0', T);
  s.send([p, s.answer(p, T + 10), s.stated(T + 15)], T + 1000);
  paths(await s.fold(), 0, 1);
  const q = s.shown('a2', T + 20);
  const d = s.shown('b0', T + 25);
  s.send([q, d, s.answer(q, T + 30), s.excluded(d, T + 35)], T + 2000);
  paths(await s.fold(), 0, 1);
  const r = s.shown('a1', T + 40);
  s.send([r, s.answer(r, T + 50), s.carried(T + 55)], T + 3000);
  paths(await s.fold(), 0, 1);
});

test('상한으로 한 제시의 사건이 여러 접기에 걸쳐도 같다', async () => {
  const s = scene();
  await base(s);
  const p = s.shown('a0', T);
  const q = s.shown('b0', T + 5);
  s.send(
    [p, q, s.help(p, T + 10), s.answer(q, T + 15), s.answer(p, T + 20), s.answer(p, T + 30)],
    T + 1000,
  );
  for (let i = 0; i < 6; i += 1) await s.fold(1);
});

test('한 요청의 눌린 사건 여럿은 이어 접고, 같은 받은 시각의 다음 요청은 처음부터 접는다', async () => {
  const s = scene();
  await base(s);
  const R0 = T + 1000; // 기기 시계가 서버보다 앞선다 — 사건 시각이 모두 받은 시각으로 눌린다
  const p = s.shown('a0', T + 50_000);
  const q = s.shown('a2', T + 50_010);
  s.send([p, q, s.answer(q, T + 50_020, 'incorrect'), s.answer(p, T + 50_030)], R0);
  paths(await s.fold(), 1, 0);
  const r = s.shown('b0', T + 50_040);
  const u = s.shown('a0', T + 50_050);
  s.send([r, u, s.answer(r, T + 50_060), s.answer(u, T + 50_070)], R0);
  paths(await s.fold(), 0, 2);
});

test('판 묶음을 옆에 짓는 동안에도 같다 — 새 머리의 첫 접기는 처음부터, 그다음은 이어 접는다', async () => {
  const s = scene();
  await base(s);
  const p = s.shown('a0', T);
  const q = s.shown('a2', T + 20);
  s.send([p, s.answer(p, T + 10), q, s.answer(q, T + 30)], T + 1000);
  paths(await s.fold(), 1, 0);
  s.useIndex({ edition: 'index-b', lookup: () => null });
  const first = await s.fold(2);
  assert.ok(first.building, '옆에 짓는다');
  paths(first, 0, 1);
  let next = await s.fold(2);
  paths(next, 1, 0);
  while (next.building) next = await s.fold(2);
  assert.ok(next.swapped, '따라잡으면 바꿔 끼운다');
});

test('같은 시각 · 더 작은 번호의 새 답은 그 능력의 마지막 줄보다 앞선다 — 이어 접으면 차례가 바뀐다', async () => {
  const s = scene();
  await base(s);
  const p = s.shown('a0', T);
  s.send([p, s.answer(p, T + 100, 'correct', eventId(T + 100, 5, 'bbbb0000'))], T + 1000);
  paths(await s.fold(), 1, 0);
  const q = s.shown('a2', T + 50);
  s.send([q, s.answer(q, T + 100, 'incorrect', eventId(T + 100, 1, 'aaaa0000'))], T + 2000);
  paths(await s.fold(), 0, 1);
});

test('늦게 온 전달 확인이 접힌 답을 판정할 수 있는 답으로 바꾸면 처음부터 접는다(새 만남 없이 바뀐 줄)', async () => {
  const s = scene();
  await base(s);
  const before = await s.line('skill', L);
  const p = s.shown('a0', T, { audioRequired: true });
  s.send([p, s.answer(p, T + 20)], T + 1000);
  paths(await s.fold(), 1, 0);
  assert.equal((await s.line('skill', L)).n, before.n, '소리 확인 전의 답은 판정하지 않는다');
  s.send([s.delivery(p, T + 10)], T + 2000);
  paths(await s.fold(), 0, 1);
  assert.equal((await s.line('skill', L)).n, before.n + 1, '앞선 전달 확인으로 측정 답이 된다');
});
