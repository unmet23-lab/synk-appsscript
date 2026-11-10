// 저장 관문의 기기 장면(설계 §11) — ⑦ 하루 한도 이어짐 · ⑧ 접힌 장부 옮기기와 손님 → 계정 · ⑪ 저장 실패 답은 근거가 아니다,
// 그리고 시각을 누른 묶음 · 판 묶음이 다른 요약 · 받지 않은 사건 · 두 탭 · 치우기.
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';
import { createClient, createServer, memory, PARAMS } from '../support/trail-sync.mjs';
import { bank, indexOf, rng, T0 } from '../support/trail-world.mjs';

const { openRecord } = await subject('record/log.mjs');
const { memoryPort } = await subject('record/port.mjs');
const { createHealth } = await subject('health/index.mjs');
const { carriedFields, carriedSoFar, legacyToImport } = await subject('record/carry.mjs');
const { linesOfGroups } = await subject('record/rows.mjs');
const { groupsOf } = await subject('record/adapt.mjs');
const { entryOf } = await subject('record/server.mjs');
const { viewOf } = await subject('record/summary.mjs');

const random = rng(7);
const items = bank(random);
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

test('⑪ 저장에 실패한 답은 근거로 나가지 않는다 — 대기열 · 보기에 없고 계기에 저장 실패가 남는다', async () => {
  const server = createServer({ random: rng(1), index });
  const health = createHealth();
  const port = memoryPort();
  const client = await createClient(server, { name: 'aaaa', port, health });
  const shown = client.record.add('practice.presented', presented());
  assert.equal(await shown.stored, true);
  port.failNext(Object.assign(new Error('quota'), { name: 'QuotaExceededError' }));
  const lost = client.record.add('practice.attempted', answer(shown.event.id));
  assert.equal(await lost.stored, false, '저장 실패는 근거가 아니라고 말한다');
  port.heal();
  assert.ok(!client.record.unsent().some(e => e.id === lost.event.id), '대기열에 없다');
  const view = client.record.view();
  assert.equal(view.memory.has('u0'), false, '보기에 얹히지 않는다');
  assert.ok(
    view.met.has(item.familyKey),
    '그 판의 메모리 만남 표에는 남는다(같은 판에서 다시 재지 않게)',
  );
  const snapshot = health.snapshot();
  assert.equal(snapshot.save.failures, 1);
  assert.deepEqual(snapshot.save.codes, { STORAGE_ERROR: 1 });
  const reopened = await openRecord({ port, revision: 1, memory, params: PARAMS, index });
  assert.equal(reopened.has(lost.event.id), false, '다시 켜도 없다');
});

test('⑦ 하루 한도는 다시 켜도 · 기기를 바꿔도 이어진다(요약의 「낸 것」 표 + 내 최근 제시)', async () => {
  const server = createServer({ random: rng(2), index });
  const port = memoryPort();
  const first = await createClient(server, { name: 'aaaa', port });
  first.record.add('practice.presented', presented());
  first.record.add(
    'practice.presented',
    presented({
      reason: { code: 'unit.due', slots: {}, evidence: {}, target: 'u0', tier: 1, introduced: [] },
    }),
  );
  await first.settle();
  const again = await openRecord({
    port,
    revision: 1,
    memory,
    params: PARAMS,
    index,
    now: () => server.now,
  });
  assert.deepEqual(
    again.issued().map(row => [row.review, row.units]),
    [
      [false, ['u0']],
      [true, []],
    ],
    '다시 켜도 센다',
  );
  await first.push();
  const other = await createClient(server, { name: 'bbbb' });
  assert.deepEqual(
    other.record.issued().map(row => [row.review, row.units]),
    [
      [false, ['u0']],
      [true, []],
    ],
    '다른 기기도 요약으로 센다',
  );
  server.tick(3 * 86_400_000);
  await other.pull();
  assert.deepEqual(other.record.issued(), [], '이틀이 지나면 빠진다');
});

test('서버가 시각을 누른 묶음은 요약이 올 때까지 얹지 않는다 · 판 묶음이 다른 요약에는 얹지 않는다', async () => {
  const server = createServer({ random: rng(3), index, foldChance: 0 });
  await server.fold(); // 빈 계정의 머리 — 올리기 답에 (접지 못한) 요약이 실려 온다
  const ahead = await createClient(server, { name: 'aaaa', drift: 30 * 60_000, pull: false });
  const shown = ahead.record.add('practice.presented', presented());
  ahead.record.add('practice.attempted', answer(shown.event.id));
  await ahead.settle();
  // 첫 요약을 받기 전에는 서버 시각과의 차이를 모른다 — 30분 앞선 시계로 찍힌 사건을 서버가 누른다.
  const reply = await ahead.push();
  assert.equal(reply.clamped.length, 2);
  assert.ok(ahead.record.summary, '요약은 왔지만 그 사건들은 아직 안 접혔다');
  assert.equal(ahead.record.view().waitAll, true, '누른 묶음은 얹지 않는다');
  assert.equal(ahead.record.view().memory.has('u0'), false, '누른 묶음의 답은 보기에 없다');
  await ahead.pull();
  assert.equal(ahead.record.view().waitAll, false, '요약이 오면 맞춰진다');
  assert.ok(ahead.record.view().memory.has('u0'));
  const pressed = server.server.log().find(r => r.event.type === 'practice.attempted');
  assert.equal(
    ahead.record.view().memory.get('u0').lastAt,
    pressed.receivedMs,
    '접는 시각은 서버가 받은 시각으로 눌린 값',
  );
  assert.ok(
    Math.abs(ahead.record.clock.offsetMs + 30 * 60_000) < 1000,
    '서버 시각을 받으면 시계 차이를 고친다',
  );
  const otherIndex = await createClient(server, { name: 'bbbb', index: indexOf(items, 'index-b') });
  const other = otherIndex.record.add('practice.presented', presented({ units: ['u7'] }));
  otherIndex.record.add('practice.attempted', answer(other.event.id, 'incorrect'));
  await otherIndex.settle();
  const view = otherIndex.record.view();
  const base = viewOf(otherIndex.record.summary);
  assert.equal(view.waitAll, true, '두뇌 · 색인 판이 다른 기기는 요약 값만');
  assert.deepEqual(view.memory, base.memory, '내 안 접힌 답을 얹지 않는다');
  assert.deepEqual(view.ability, base.ability);
});

test('서버가 받지 않은 사건(옛 동의 판)은 버리고 나머지는 보낸다 — 계기에 EVENT_REVISION', async () => {
  const health = createHealth();
  const port = memoryPort();
  const record = await openRecord({
    port,
    revision: 2,
    memory,
    params: PARAMS,
    index,
    health,
    now: () => T0,
  });
  const a = record.add('practice.presented', presented());
  const b = record.add('practice.presented', presented());
  const c = record.add('practice.presented', presented());
  await Promise.all([a.stored, b.stored, c.stored]);
  assert.equal(record.issued().length, 3);
  await record.receive({ accepted: [{ id: b.event.id, seq: 1 }], rejected: [a.event.id] });
  assert.deepEqual(
    record.unsent().map(e => e.id),
    [c.event.id],
    '받은 것 · 버린 것만 빠지고 나머지는 다시 보낸다',
  );
  assert.equal(record.issued().length, 2, '버린 제시는 하루 한도에도 세지 않는다');
  assert.equal(record.pending().has(a.event.id), false);
  assert.deepEqual(health.snapshot().save.codes, { EVENT_REVISION: 1 });
  const reopened = await openRecord({
    port,
    revision: 2,
    memory,
    params: PARAMS,
    index,
    now: () => T0,
  });
  assert.deepEqual(
    reopened.unsent().map(e => e.id),
    [c.event.id],
    '다시 열어도 버린 것은 버린 채',
  );
  assert.equal(reopened.issued().length, 2);
});

test('두 탭 — 다른 탭이 덧붙인 꼬리만 읽고, 같은 판 묶음이면 갱신 차례가 큰 요약만 쓴다', async () => {
  const server = createServer({ random: rng(4), index });
  const port = memoryPort();
  const one = await createClient(server, { name: 'aaaa', port });
  const two = await openRecord({
    port,
    revision: 1,
    memory,
    params: PARAMS,
    index,
    now: () => server.now,
  });
  const shown = one.record.add('practice.presented', presented());
  one.record.add('practice.attempted', answer(shown.event.id));
  await one.settle();
  await two.refresh();
  assert.equal(two.has(shown.event.id), true, '다른 탭이 덧붙인 꼬리를 읽는다');
  assert.ok(two.view().memory.has('u0'), '요약 없이 꼬리만으로 얹는다');
  await one.push();
  await two.refresh();
  const newer = one.record.summary;
  assert.ok(newer.lineSeq > 0, '서버가 접은 요약');
  const older = {
    edition: newer.edition,
    foldedUntil: 0,
    lineSeq: 0,
    issued: [],
    lines: [],
    full: true,
  };
  await two.receive({ summary: older });
  assert.equal(two.summary.lineSeq, newer.lineSeq, '작은 차례의 요약은 쓰지 않는다');
});

test('치우기 — 이틀 지난 · 서버가 접은 사건만 치우고, 다시 열어도 보기가 같다', async () => {
  const server = createServer({ random: rng(5), index });
  const port = memoryPort();
  const client = await createClient(server, { name: 'aaaa', port });
  const shown = client.record.add('practice.presented', presented());
  client.record.add('practice.attempted', answer(shown.event.id));
  await client.push();
  const open = client.record.add('practice.presented', presented());
  await client.push();
  assert.equal(await client.record.compact(), 0, '이틀이 안 지났으면 치우지 않는다');
  const unsentOld = client.record.add('practice.presented', presented());
  client.record.add('practice.attempted', answer(unsentOld.event.id));
  await client.settle();
  server.tick(3 * 86_400_000);
  const young = client.record.add('practice.presented', presented());
  client.record.add('practice.attempted', answer(young.event.id));
  await client.settle();
  const before = client.record.view();
  const removed = await client.record.compact();
  assert.equal(removed, 2, '답이 달린 제시와 그 답만 치운다(답이 안 달린 제시는 둔다)');
  assert.equal(client.record.has(shown.event.id), false);
  assert.equal(client.record.has(open.event.id), true);
  assert.equal(
    client.record.has(unsentOld.event.id),
    true,
    '서버가 아직 안 접은 묶음은 이틀이 지나도 둔다',
  );
  assert.equal(client.record.has(young.event.id), true, '이틀이 안 지난 묶음은 둔다');
  const reopened = await openRecord({
    port,
    revision: 1,
    memory,
    params: PARAMS,
    index,
    now: () => server.now,
  });
  assert.deepEqual(reopened.view().memory, before.memory);
  assert.equal(reopened.summary.lineSeq, client.record.summary.lineSeq);
});

test('⑧ 손님 기록(옛 로그 + 접힌 장부 + 2판) → 계정: 예전 문항이 「처음 본 정답」이 아니고, 같은 장부 두 번 = 같음, 계정 요약 = 손님 요약', async () => {
  const at = n => new Date(T0 + n * 60_000).toISOString();
  const scope = { domain: 'LAB', workspace: 'learning', subject: 'device' };
  const legacy = (id, n, type, fields) => ({
    schema: 1,
    id,
    scope,
    at: at(n),
    recordedAt: at(n),
    type,
    ...fields,
  });
  const measure = {
    skillId: item.skillId,
    modality: 'listening',
    difficulty: 1,
    familyKey: 'fam9',
    audioRequired: false,
    confounded: false,
    responseFormat: 'single-choice',
  };
  const oldLog = [
    legacy('d1', 1, 'decision.made', {
      experienceId: 'g',
      variant: 'v',
      policy: 'x',
      evidence: [],
    }),
    legacy('p1', 2, 'practice.presented', {
      decisionId: 'd1',
      taskId: 't',
      taskVersion: 'v',
      itemKey: 'old-item',
      conceptIds: [item.skillId],
      firstExposure: true,
      measure,
    }),
    legacy('t1', 3, 'practice.attempted', {
      presentationId: 'p1',
      attemptNo: 1,
      verdict: 'correct',
      errorTags: [],
    }),
  ];
  // 접힌 장부 — 계열 fam0(예전에 풀었다)과 fam9. 처음 옮기는 장부라 after 없음.
  const ledger = {
    cutoff: T0,
    keys: { 'family:fam0': 1, 'item:it00': 1, 'family:fam9': 1 },
    cells: {
      [`${item.skillId}|1|single-choice`]: {
        ind: [['x', T0 - 1, 'correct', 'fam0']],
        helped: [],
        unassessed: 0,
      },
    },
  };
  const port = memoryPort();
  let now = T0 + 10 * 60_000;
  const guest = await openRecord({
    port,
    guest: true,
    memory,
    params: PARAMS,
    index,
    now: () => now,
  });
  await guest.importLegacy(legacyToImport(oldLog, id => guest.has(id)));
  const fields = carriedFields(ledger, carriedSoFar([]));
  assert.deepEqual(Object.keys(fields.families).sort(), ['fam0', 'fam9']);
  assert.equal(fields.cells[0].independent, 1, '칸 요약은 처음 옮길 때만');
  await guest.add('record.carried', fields).stored;
  assert.equal(
    carriedFields(ledger, carriedSoFar(guest.heldEvents())),
    null,
    '같은 장부가 두 번 오면 새로 든 것이 없다',
  );
  const wider = { ...ledger, keys: { ...ledger.keys, 'family:fam5': 1 } };
  const again = carriedFields(wider, carriedSoFar(guest.heldEvents()));
  assert.deepEqual(Object.keys(again.families), ['fam5'], '다녀온 뒤의 장부는 새로 든 계열만');
  assert.equal(
    again.after,
    guest.heldEvents().find(e => e.type === 'record.carried').at,
    'after = 앞 장부를 옮긴 때',
  );
  assert.equal(again.cells, undefined);
  await guest.importLegacy(legacyToImport(oldLog, id => guest.has(id)));
  now += 60_000;
  const shown = guest.add('practice.presented', presented());
  guest.add('practice.attempted', answer(shown.event.id));
  await shown.stored;
  await new Promise(resolve => setTimeout(resolve, 0));
  const local = guest.view();
  assert.equal(
    local.ability.get(item.skillId)?.n ?? 0,
    0,
    '예전에 푼 계열(fam0)의 답은 「처음 본 정답」이 아니다',
  );

  // 계정으로 — 옛 꼴은 옛 POST로 먼저, 2판은 그 계정의 지금 판으로 도장을 찍어 새 길로.
  const server = createServer({ random: rng(6), index });
  server.tick(60 * 60_000);
  const plan = guest.guestUpload(3);
  assert.deepEqual(
    plan.legacy.map(e => e.id),
    ['d1', 'p1', 't1'],
  );
  assert.ok(plan.current.every(e => e.revision === 3));
  server.legacy(plan.legacy);
  await server.post(plan.current, null);
  await server.fold();
  const account = linesOfGroups(groupsOf(server.server.log().map(entryOf)), {
    memory,
    params: PARAMS,
    index,
  });
  assert.deepEqual(
    Object.fromEntries([...account.skill]),
    Object.fromEntries([...guest.view().ability]),
  );
  assert.deepEqual(
    Object.fromEntries([...account.unit]),
    Object.fromEntries([...guest.view().memory]),
  );
});

test('이미 접힌 답의 전달을 거두면 그 답이 적힌 줄을 기다리고, 올린 뒤 온 요약으로 맞춰진다', async () => {
  const server = createServer({ random: rng(8), index });
  const client = await createClient(server, { name: 'aaaa' });
  const shown = client.record.add('practice.presented', presented({ audioRequired: true }));
  const delivered = client.record.add('practice.delivery', {
    presentationId: shown.event.id,
    audio: 'completed',
  });
  client.record.add('practice.attempted', answer(shown.event.id));
  await client.push();
  assert.ok(client.record.view().memory.has('u0'));
  client.record.add('record.excluded', { targetId: delivered.event.id });
  await client.settle();
  const waiting = client.record.view();
  assert.ok(waiting.waitUnits.has('u0') || waiting.waitAll, '판정이 바뀐 접힌 답의 줄은 기다린다');
  await client.push();
  assert.equal(
    client.record.view().memory.has('u0'),
    false,
    '서버가 다시 접은 요약: 소리 확인이 없는 답은 근거가 아니다',
  );
});

test('옮겨 온 장부 — 거둔 장부는 옮긴 것으로 세지 않고, 다시 옮기는 장부는 새 판의 마지막 내 사건 뒤에 서고, 망가진 칸은 건너뛴다(아르곤 끝 판 B3 · B7)', () => {
  const t = n => new Date(T0 + n * 60_000).toISOString();
  const carried = {
    schema: 2,
    id: 'a.c1',
    type: 'record.carried',
    at: t(1),
    revision: 0,
    families: { f1: 1 },
    items: {},
    after: null,
  };
  const mine = { schema: 2, id: 'a.p1', type: 'practice.presented', at: t(5), revision: 0 };
  const withdrawn = {
    schema: 2,
    id: 'a.x1',
    type: 'record.excluded',
    at: t(6),
    revision: 0,
    targetId: 'a.c1',
  };
  const legacy = { schema: 1, id: 'old', type: 'practice.presented', at: t(9) };
  const ledger = { keys: { 'family:f1': 1, 'family:f2': 1 }, cells: null };
  // 앞 장부가 있고 그 뒤 새 판에서 낸 사건이 있으면, 다시 옮기는 장부는 그 사건 뒤(옛 로그에서 옮긴 옛 꼴은 세지 않는다).
  const again = carriedFields(ledger, carriedSoFar([carried, mine, legacy]));
  assert.deepEqual(again.families, { f2: 1 });
  assert.equal(again.after, t(5));
  // 거둔 장부는 없던 것 — 처음 옮기는 장부로(칸 요약도), 그래도 새 판 사건 뒤.
  const first = carriedFields(ledger, carriedSoFar([carried, mine, withdrawn]));
  assert.deepEqual(first.families, { f1: 1, f2: 1 });
  assert.equal(first.after, t(6));
  assert.deepEqual(first.cells, [], '망가진 칸 표(null)는 건너뛴다');
  // 새 판 사건이 없는 처음 장부는 어떤 만남보다 먼저.
  assert.equal(carriedFields(ledger, carriedSoFar([legacy])).after, null);
  const broken = {
    'ko.reading|1': null,
    'ko.reading|2': { ind: 'x' },
    'ko.reading|3': { ind: [[1, 9e20, 'correct'], null], helped: [] },
  };
  assert.deepEqual(
    carriedFields({ keys: { 'family:f3': 1 }, cells: broken }, carriedSoFar([])).cells,
    [{ skillId: 'ko.reading', difficulty: 3, independent: 2, correct: 1, helped: 0, lastAt: null }],
  );
});

test('판 단위 사건은 판 번호(setId)를 실을 수 있고, 손님은 판 끝에 요약을 바로 접어 방금 푼 답이 칸에 든다(단계 4 요청 11-11)', async () => {
  const record = await openRecord({
    port: memoryPort(),
    revision: 0,
    guest: true,
    memory,
    params: PARAMS,
    index,
    now: () => T0,
  });
  const decided = record.add('decision.made', {
    experienceId: 'world-practice',
    variant: 'v1',
    setId: 'set1',
  });
  record.add('experience.completed', {
    decisionId: decided.event.id,
    experienceId: 'world-practice',
    variant: 'v1',
    setId: 'set1',
  });
  assert.throws(() =>
    record.add('decision.made', { experienceId: 'x', variant: 'v', setId: 'bad id!' }),
  );
  const shown = record.add('practice.presented', presented());
  record.add('practice.attempted', answer(shown.event.id));
  await Promise.all([decided.stored, shown.stored]);
  const before = record.summary?.lineSeq ?? 0;
  await record.refold();
  assert.ok(record.summary.lineSeq > before, '판 끝에 바로 접는다');
  assert.ok(record.summary.lines.unit.has('u0'), '방금 푼 답이 요약에 든다');
});
