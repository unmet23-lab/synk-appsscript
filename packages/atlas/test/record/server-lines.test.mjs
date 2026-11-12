// 저장 관문 장면 — 서버 줄의 갱신 차례(설계 §4-3 「값이 같으면 차례를 올리지 않는다」, Fable 5.2 Talk 끝 판 P2-2).
// SQL 저장소(jsonb)는 줄 값의 열쇠를 길이 · 글자 순으로 바꿔 돌려준다 — 메모리 저장소(trail-world)도 같은 차례로 돌려준다.
// 접기에 닿았지만 값이 그대로인 줄은 다시 쓰지 않고, since 뒤 달라진 줄로 내려가지 않는다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';
import { createMemoryAccount, T0 } from '../support/trail-world.mjs';

const { createEvent, eventId } = await subject('record/events.mjs');
const { foldAccount, summaryOf, foldEdition } = await subject('record/server.mjs');
const { createMemory } = await subject('memory/index.mjs');
const { PARAMS } = await subject('params.mjs');

const memory = createMemory(PARAMS);
const item = {
  itemKey: 'it0',
  familyKey: 'fam0',
  skillId: 'ko.listening.detail',
  difficulty: 1,
  responseFormat: 'single-choice',
  units: ['u0'],
};
const presented = {
  setId: 'set1',
  ...item,
  modality: 'listening',
  audioRequired: false,
  confounded: false,
  firstExposure: true,
  editions: { ...PARAMS.editions, index: 'index-0' },
  expected: { floor: 0.25, memory: 1, skill: 0.6 },
  arm: 'adaptive',
  reason: { code: 'unit.new', slots: {}, evidence: {}, target: 'u0', tier: 2, introduced: ['u0'] },
};

test('접기에 닿았지만 값이 같은 줄은 갱신 차례가 오르지 않는다 — 열쇠 차례를 바꿔 돌려주는 저장소에서도', async () => {
  const server = createMemoryAccount();
  let n = 0;
  const make = (type, fields) => {
    n += 1;
    const atMs = T0 + n * 60_000;
    return createEvent(type, fields, { id: eventId(atMs, n, 'lines000'), atMs, revision: 1 });
  };
  const context = { memory, params: PARAMS, nowMs: T0 + 1e9 };
  const edition = foldEdition(PARAMS, undefined);
  const shown = make('practice.presented', presented);
  server.append(
    [
      shown,
      make('practice.attempted', {
        presentationId: shown.id,
        attemptNo: 1,
        verdict: 'correct',
        errorTags: [],
      }),
    ],
    T0 + 1e6,
  );
  await foldAccount(server.account, context);
  const first = await summaryOf(server.account.store(edition), { edition });
  assert.ok(first.lines.length >= 3, '단위 · 계열 · 능력 줄이 섰다');
  // 소리가 필수가 아닌 제시의 전달 확인 — 그 묶음을 다시 짓지만 줄 값은 그대로다.
  server.append(
    [make('practice.delivery', { presentationId: shown.id, audio: 'completed' })],
    T0 + 2e6,
  );
  const again = await foldAccount(server.account, context);
  assert.equal(again.folded, 1, '전달 확인을 접었다');
  assert.equal(again.changed, 0, '달라진 줄이 없다');
  const after = await summaryOf(server.account.store(edition), {
    edition,
    since: { edition, seq: first.lineSeq, gen: first.gen },
  });
  assert.equal(after.full, false);
  assert.equal(after.lineSeq, first.lineSeq, '갱신 차례가 오르지 않는다');
  assert.deepEqual(after.lines, [], '값이 그대로인 줄은 다시 내려가지 않는다');
});

test('모의 올리기도 부모가 없는 자식은 받지 않고 rejected로 돌려준다(SYNK-talk 올리기와 같은 partitionLinks — GPT 끝 판 GF1)', async () => {
  const { createServer } = await import('../support/trail-sync.mjs');
  const { rng } = await import('../support/trail-world.mjs');
  const mock = createServer({ random: rng(3), foldChance: 0 });
  const atMs = T0 + 60_000;
  const orphan = createEvent(
    'practice.attempted',
    {
      presentationId: eventId(atMs, 9, 'gone0000'),
      attemptNo: 1,
      verdict: 'correct',
      errorTags: [],
    },
    { id: eventId(atMs, 1, 'orph0000'), atMs, revision: 1 },
  );
  const reply = await mock.post([orphan], null);
  assert.deepEqual(reply.accepted, []);
  assert.deepEqual(reply.rejected, [orphan.id]);
  assert.equal(reply.rejectedCode, 'EVENT_LINK');
});
