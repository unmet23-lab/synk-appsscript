// 계정 길 ①의 기록 쪽 장면(단계 4 계획 §18-5 — 18-5-7 ①): 건너뛸 사건과 그것에 기댄 사건(R12 · R13) · 같은 제시의 앞 답에 기대어
// 쓰기(§18-4) · 손님 요약은 읽은 데까지만(A4 — s6) · 딸린 거절은 이어진 실패에 넣지 않음(G5 · H2) · 다시 지은 머리(D1 — s1).
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';
import { createClient, createServer, memory, PARAMS } from '../support/trail-sync.mjs';
import { bank, indexOf, rng, T0 } from '../support/trail-world.mjs';

const { openRecord } = await subject('record/log.mjs');
const { memoryPort } = await subject('record/port.mjs');
const { createHealth } = await subject('health/index.mjs');
const { EVENT_TYPES } = await subject('record/events.mjs');

const items = bank(rng(7));
const index = indexOf(items, 'index-a');
const item = { ...items[0], units: ['u0'] };
const presented = (overrides = {}) => ({
  setId: 'set1',
  itemKey: item.itemKey,
  familyKey: item.familyKey,
  skillId: item.skillId,
  difficulty: 1,
  responseFormat: 'single-choice',
  modality: 'listening',
  audioRequired: false,
  confounded: false,
  units: ['u0'],
  firstExposure: true,
  editions: {
    params: 'params-1',
    memory: 'memory-1',
    ability: 'ability-1',
    select: 'select-1',
    index: 'index-a',
  },
  expected: { floor: 0.25, memory: 0.5, skill: 0.6 },
  arm: 'adaptive',
  reason: { code: 'unit.new', slots: {}, evidence: {}, target: 'u0', tier: 2, introduced: ['u0'] },
  ...overrides,
});
const answer = (presentationId, verdict = 'correct', attemptNo = 1) => ({
  presentationId,
  attemptNo,
  verdict,
  errorTags: [],
});

async function account({ port = memoryPort(), health = null, now = () => T0 } = {}) {
  return openRecord({ port, revision: 1, memory, params: PARAMS, index, health, now });
}

test('unsent의 skip — 건너뛴 사건에 기댄 사건(부모 사슬)도 함께 빼고, 그 너머를 읽는다(R12 · R13)', async () => {
  const record = await account();
  const p1 = record.add(EVENT_TYPES.presented, presented());
  const d1 = record.add(EVENT_TYPES.delivery, { presentationId: p1.event.id, audio: 'completed' });
  const a1 = record.add(EVENT_TYPES.attempted, answer(p1.event.id, 'incorrect'));
  const x1 = record.add(EVENT_TYPES.excluded, { targetId: a1.event.id });
  const p2 = record.add(EVENT_TYPES.presented, presented({ setId: 'set1' }));
  const a2 = record.add(EVENT_TYPES.attempted, answer(p2.event.id));
  const decided = record.add(EVENT_TYPES.setDecided, {
    experienceId: 'w.set',
    variant: 'short',
    setId: 'set1',
  });
  const done = record.add(EVENT_TYPES.setCompleted, {
    decisionId: decided.event.id,
    experienceId: 'w.set',
    variant: 'short',
    setId: 'set1',
  });
  await record.saved();
  for (const made of [p1, d1, a1, x1, p2, a2, decided, done]) assert.equal(await made.stored, true);
  const ids = record.unsent(256, new Set([p1.event.id, decided.event.id])).map(e => e.id);
  assert.deepEqual(
    ids,
    [p2.event.id, a2.event.id],
    '건너뛴 제시 · 결정과 그 자손(전달 · 답 · 그 답의 제외 · 마침)은 빠진다',
  );
  assert.deepEqual(
    record.unsent(1, new Set([p1.event.id])).map(e => e.id),
    [p2.event.id],
    '한도는 건너뛴 것 너머의 사건으로 채운다',
  );
  assert.equal(
    record.unsent(256).length,
    8,
    '건너뛰기는 버리지 않는다 — skip 없이는 그대로 대기열에 있다',
  );
});

test('unsent의 skip — 같은 제시의 답 하나를 건너뛰면 그 뒤 답과 자손도 건너뛴다 · 제시와 다른 제시의 답은 간다(GPT 끝 판 GE2 · 카본 E2)', async () => {
  const record = await account();
  const p1 = record.add(EVENT_TYPES.presented, presented());
  const a1 = record.add(EVENT_TYPES.attempted, answer(p1.event.id, 'incorrect', 1));
  const a2 = record.add(EVENT_TYPES.attempted, answer(p1.event.id, 'correct', 2));
  const x2 = record.add(EVENT_TYPES.excluded, { targetId: a2.event.id });
  const p2 = record.add(EVENT_TYPES.presented, presented());
  const b1 = record.add(EVENT_TYPES.attempted, answer(p2.event.id, 'correct', 1));
  await record.saved();
  for (const made of [p1, a1, a2, x2, p2, b1]) assert.equal(await made.stored, true);
  assert.deepEqual(
    record.unsent(256, new Set([a1.event.id])).map(e => e.id),
    [p1.event.id, p2.event.id, b1.event.id],
    '1번을 건너뛰면 2번(과 그 제외)도 이번엔 가지 않는다 — 1번 없는 2번은 서버가 EVENT_LINK로 짚어 기기가 버렸다',
  );
  assert.equal(record.unsent(256).length, 6, '건너뛰기는 버리지 않는다');
});

test('같은 제시의 둘째 답은 앞 답에 기대어 쓴다 — 앞 답이 저장되지 못했으면 쓰지 않고, 저장 중이면 기다린다(§18-4 H1)', async () => {
  const health = createHealth();
  const port = memoryPort();
  const record = await account({ port, health });
  const shown = record.add(EVENT_TYPES.presented, presented());
  assert.equal(await shown.stored, true);
  port.failNext(Object.assign(new Error('quota'), { name: 'QuotaExceededError' }));
  const first = record.add(EVENT_TYPES.attempted, answer(shown.event.id, 'incorrect', 1));
  assert.equal(await first.stored, false);
  port.heal();
  const second = record.add(EVENT_TYPES.attempted, answer(shown.event.id, 'correct', 2));
  assert.equal(
    await second.stored,
    false,
    '1번이 없는 2번 답은 쓰지 않는다(서버가 EVENT_LINK로 뺀다)',
  );
  assert.ok(
    !record.unsent().some(e => e.type === EVENT_TYPES.attempted),
    '대기열에 2만 남지 않는다',
  );
  const snapshot = health.snapshot();
  assert.deepEqual(snapshot.save.codes, { STORAGE_ERROR: 1, ATTEMPT_UNSAVED: 1 });
  assert.equal(snapshot.save.streak, 1, '딸린 거절은 이어진 실패 수에 넣지 않는다(G5 · H2)');
  assert.equal(snapshot.engineOff, false);
  // 저장 중이면 기다린다 — 앞 답의 저장이 끝난 뒤에 뒤 답이 포트에 들어간다.
  const slow = memoryPort();
  const order = [];
  const append = slow.append.bind(slow);
  let release = null;
  slow.append = async values => {
    const kinds = values.map(v => v.event?.attemptNo).filter(Boolean);
    if (kinds.includes(1)) await new Promise(resolve => (release = resolve));
    order.push(...kinds);
    return append(values);
  };
  const waiting = await account({ port: slow });
  const p = waiting.add(EVENT_TYPES.presented, presented());
  await p.stored;
  const one = waiting.add(EVENT_TYPES.attempted, answer(p.event.id, 'incorrect', 1));
  const two = waiting.add(EVENT_TYPES.attempted, answer(p.event.id, 'correct', 2));
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.deepEqual(order, [], '앞 답이 저장 중이면 뒤 답은 아직 쓰지 않는다');
  release();
  assert.equal(await one.stored, true);
  assert.equal(await two.stored, true);
  assert.deepEqual(order, [1, 2]);
});

test('손님 기기: 첫 답 저장 실패 뒤 다시 맞힌 답이 혼자 낸 첫 답으로 접히지 않는다(§18-4 — s4)', async () => {
  const port = memoryPort();
  const guest = await openRecord({
    port,
    guest: true,
    memory,
    params: PARAMS,
    index,
    now: () => T0,
  });
  const shown = guest.add(EVENT_TYPES.presented, presented());
  await shown.stored;
  port.failNext(new Error('quota'));
  await guest.add(EVENT_TYPES.attempted, answer(shown.event.id, 'incorrect', 1)).stored;
  port.heal();
  await guest.add(EVENT_TYPES.attempted, answer(shown.event.id, 'correct', 2)).stored;
  await guest.refold();
  const cells = [...(guest.summary?.lines.cell.values() ?? [])];
  assert.equal(
    cells.reduce((sum, cell) => sum + (cell.independent ?? 0), 0),
    0,
    '칸에 혼자 낸 첫 답이 없다',
  );
});

test('손님 요약은 포트에서 차례대로 읽은 데까지만 접는다 — 접는 사이 끼어든 다른 탭 답이 요약에도 밀린 것에도 빠지지 않는다(A4 — s6)', async () => {
  const port = memoryPort();
  const range = port.range.bind(port);
  let hook = null;
  port.range = async after => {
    const rows = await range(after);
    if (hook) {
      const run = hook;
      hook = null;
      await run(); // 꼬리를 읽은 직후 — 다른 탭의 답(열쇠 n)과 이 탭의 답(열쇠 n+1)이 끼어든다
    }
    return rows;
  };
  const a = await openRecord({
    port,
    guest: true,
    memory,
    params: PARAMS,
    index,
    now: () => T0,
    tag: 'tabaaaaa',
  });
  const b = await openRecord({
    port,
    guest: true,
    memory,
    params: PARAMS,
    index,
    now: () => T0,
    tag: 'tabbbbbb',
  });
  const shownB = b.add(EVENT_TYPES.presented, presented());
  await shownB.stored;
  const shownA = a.add(EVENT_TYPES.presented, presented({ setId: 'set2' }));
  await shownA.stored;
  let otherId = null;
  hook = async () => {
    const other = b.add(EVENT_TYPES.attempted, answer(shownB.event.id, 'correct'));
    otherId = other.event.id;
    await other.stored;
    await a.add(EVENT_TYPES.attempted, answer(shownA.event.id, 'correct')).stored;
  };
  await a.refold();
  await a.refresh(); // 이제 다른 탭 답(열쇠 n)을 읽는다
  await a.localSaved(); // 손님 요약 저장은 뒤에서 돈다(§18-5-1 R2)
  const rows = await port.read();
  const otherKey = rows.find(row => row.value.event?.id === otherId).key;
  const local = rows.filter(row => row.value.kind === 'local').at(-1);
  assert.ok(local.value.until < otherKey, '읽지 않은 열쇠(다른 탭 답)까지 접었다고 적지 않는다');
  assert.ok(
    a.pending().has(otherId),
    '다른 탭 답은 밀린 것으로 얹힌다 — 요약에도 밀린 것에도 없는 답이 없다',
  );
});

test('다시 지은 머리의 통째 요약은 줄 차례가 기기 것보다 작아도 받는다 — 비우기로 머리를 다시 지은 뒤(D1 — s1)', async () => {
  const random = rng(31);
  const server = createServer({ random, index });
  const client = await createClient(server, { name: 'genaaaaa' });
  for (let i = 0; i < 6; i += 1) {
    const shown = client.record.add(EVENT_TYPES.presented, presented({ setId: `s${i}` }));
    await shown.stored;
    await client.record.add(
      EVENT_TYPES.attempted,
      answer(shown.event.id, i % 2 ? 'correct' : 'incorrect'),
    ).stored;
    server.tick(60_000);
    await client.push();
  }
  const before = client.record.summary;
  assert.ok(before.lineSeq >= 3 && before.gen, '첫 머리의 요약(gen 있음)');
  server.server.clear(); // 머리를 지운다(파생 값) — 다음 접기가 새 머리를 짓는다
  server.tick(60_000);
  const fresh = client.record.add(EVENT_TYPES.presented, presented({ setId: 'after' }));
  await fresh.stored;
  await client.push();
  const after = client.record.summary;
  assert.notEqual(after.gen, before.gen, '새 머리의 요약으로 바뀌었다');
  assert.ok(after.lineSeq < before.lineSeq, '새 머리의 줄 차례는 기기 것보다 작다');
  assert.equal(client.record.view().waitAll, false);
});

test('서버 요약은 since의 gen이 지금 머리와 같을 때만 부분이다 — 다르거나 gen 없는 since는 통째(§18-5-4)', async () => {
  const server = createServer({ random: rng(41), index });
  const client = await createClient(server, { name: 'genbbbbb' });
  const shown = client.record.add(EVENT_TYPES.presented, presented());
  await shown.stored;
  await client.record.add(EVENT_TYPES.attempted, answer(shown.event.id)).stored;
  await client.push();
  const whole = await server.summary(null);
  assert.ok(whole.full && /^\d{13}\.[0-9a-z]{8}$/.test(whole.gen), '머리에 gen이 있다');
  const since = { edition: whole.edition, seq: whole.lineSeq };
  assert.equal(
    (await server.summary({ ...since, gen: whole.gen })).full,
    false,
    '같은 머리면 부분',
  );
  assert.equal(
    (await server.summary({ ...since, gen: '0000000000001.zzzzzzzz' })).full,
    true,
    '다른 머리면 통째',
  );
  assert.equal((await server.summary(since)).full, true, 'gen 없는 since는 gen 있는 머리에 통째');
});
