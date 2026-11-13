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

test('치우기 — 서버가 번호를 짚어 버린 사건도 이틀이 지나면 치운다(받은 표지가 없어 접힌 적이 없다 — Fable 5.2 끝 판 넘친 #12)', async () => {
  const server = createServer({ random: rng(6), index });
  const client = await createClient(server, { name: 'dropaaaa', port: memoryPort() });
  const open = client.record.add('practice.presented', presented());
  await client.push();
  const shown = client.record.add('practice.presented', presented());
  const made = client.record.add('practice.attempted', answer(shown.event.id));
  const lone = client.record.add('practice.presented', presented());
  await Promise.all([shown.stored, made.stored, lone.stored]);
  await client.record.receive({
    accepted: [],
    rejected: [shown.event.id, made.event.id, lone.event.id],
  });
  assert.deepEqual(client.record.unsent(), [], '버린 것은 다시 보내지 않는다');
  server.tick(3 * 86_400_000);
  await client.push();
  assert.equal(await client.record.compact(), 3, '버린 제시 · 그 답 · 답 없이 버린 제시를 치운다');
  assert.equal(client.record.has(shown.event.id), false);
  assert.equal(client.record.has(lone.event.id), false, '버린 제시는 답을 기다리며 남기지 않는다');
  assert.equal(client.record.has(open.event.id), true, '버리지 않은 · 답이 안 달린 제시는 둔다');
});

test('판 응답 · 결정 · 마침을 겨눈 제외가 밀린 동안에도 계정 보기는 기다리지 않는다 — 얹을 것이 없다(Fable 5.2 끝 판 넘친 #1)', async () => {
  const server = createServer({ random: rng(9), index });
  const client = await createClient(server, { name: 'feedaaaa', port: memoryPort() });
  const decided = client.record.add('decision.made', {
    experienceId: 'world-practice',
    variant: 'v1',
    setId: 'set1',
  });
  const shown = client.record.add('practice.presented', presented());
  client.record.add('practice.attempted', answer(shown.event.id));
  const completed = client.record.add('experience.completed', {
    decisionId: decided.event.id,
    experienceId: 'world-practice',
    variant: 'v1',
    setId: 'set1',
  });
  const given = client.record.add('feedback.given', {
    completionId: completed.event.id,
    value: 'helpful',
  });
  await given.stored;
  await client.push();
  assert.equal(client.record.view().waitAll, false, '올린 뒤');
  for (const target of [given, completed, decided]) {
    const drop = client.record.add('record.excluded', { targetId: target.event.id });
    await drop.stored;
  }
  assert.equal(client.record.view().waitAll, false, '응답 · 마침 · 결정 빼기가 밀린 동안에도');
  const next = client.record.add('practice.presented', presented());
  await client.record.add('practice.attempted', answer(next.event.id, 'incorrect')).stored;
  assert.equal(client.record.view().waitAll, false, '그 뒤에 낸 답도 얹힌다');
  assert.equal(client.record.unsent().length, 5, '제외 셋 · 제시 · 답은 올리기를 기다린다');
  // 옛 꼴 판 결정을 겨눈 제외는 그 결정의 제시들 답을 통째로 거둔다 — 제시들이 기기에 없으면 적어 둔 줄이 없어 기다린다(설계 주인 11-13)
  await client.push();
  assert.equal(client.record.view().waitAll, false, '올린 뒤');
  const when = new Date(T0).toISOString();
  await client.record.importLegacy([
    {
      schema: 1,
      id: 'old-decided',
      scope: { domain: 'LAB', workspace: 'learning', subject: 'device' },
      at: when,
      recordedAt: when,
      type: 'decision.made',
      experienceId: 'g',
      variant: 'v',
      policy: 'x',
      evidence: [],
    },
  ]);
  await client.record.add('record.excluded', { targetId: 'old-decided' }).stored;
  assert.equal(
    client.record.view().waitAll,
    true,
    '옛 꼴 결정을 겨눈 제외는 얹을 것이 없다고 보지 않는다',
  );
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
  await guest.refresh(); // 고르기는 읽은 자리까지만(§18-5-3) — 꼬리부터 읽고 고른다
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

test('치우기 — 요약이 옛 꼴(받은 표지에 함께 실은 요약)뿐인 저장소도 치운 뒤 다시 열면 요약이 그대로다(GPT 끝 판 GE3)', async () => {
  const server = createServer({ random: rng(5), index });
  const port = memoryPort();
  const client = await createClient(server, { name: 'aaaa', port });
  const shown = client.record.add('practice.presented', presented());
  client.record.add('practice.attempted', answer(shown.event.id));
  await client.push();
  // 옛 꼴(11-11 앞)로 — 요약 기록을 바로 앞 받은 표지에 싣고 따로 두지 않는다.
  const old = memoryPort();
  const values = [];
  for (const row of await port.read()) {
    if (row.value.kind === 'summary') values[values.length - 1].summary = row.value.summary;
    else values.push(row.value);
  }
  await old.append(values);
  const open = () =>
    openRecord({ port: old, revision: 1, memory, params: PARAMS, index, now: () => server.now });
  const record = await open();
  const before = record.summary;
  assert.ok(before, '옛 꼴의 요약을 읽는다');
  await record.receive({ serverTime: server.now });
  await record.compact();
  const kinds = (await old.read()).map(row => row.value.kind);
  assert.ok(kinds.includes('summary'), '요약을 따로 한 기록으로 옮겨 적었다');
  assert.ok(!kinds.slice(0, -2).includes('ack'), '옛 받은 표지는 치웠다');
  const reopened = await open();
  assert.deepEqual(reopened.summary, before, '치운 뒤 다시 열어도 같은 요약');
  await reopened.receive({ serverTime: server.now });
  await reopened.compact();
  assert.equal(
    (await old.read()).filter(row => row.value.kind === 'summary').length,
    1,
    '요약 기록에서 온 요약은 다시 적지 않는다',
  );
  // 섞인 저장소 — 앞 요약은 따로 한 기록, 더 새 요약은 옛 꼴 ack 속. 치우기가 새 요약을 지키고 앞 요약으로 돌아가지 않는다.
  const next = client.record.add('practice.presented', presented());
  client.record.add('practice.attempted', answer(next.event.id));
  const earlier = (await port.read()).find(row => row.value.kind === 'summary').value;
  await client.push();
  const mixedPort = memoryPort();
  const mixed = [earlier];
  for (const row of await port.read()) {
    if (row.value.kind === 'summary') mixed[mixed.length - 1].summary = row.value.summary;
    else mixed.push(row.value);
  }
  await mixedPort.append(mixed);
  const openMixed = () =>
    openRecord({
      port: mixedPort,
      revision: 1,
      memory,
      params: PARAMS,
      index,
      now: () => server.now,
    });
  const newest = await openMixed();
  assert.notDeepEqual(newest.summary, before, '새 요약(옛 꼴 ack 속)이 앞 요약보다 앞선다');
  const kept = newest.summary;
  await newest.receive({ serverTime: server.now });
  await newest.compact();
  assert.deepEqual(
    (await openMixed()).summary,
    kept,
    '치운 뒤에도 새 요약 — 따로 둔 앞 요약으로 돌아가지 않는다',
  );
});

test('제외의 닿는 줄 메모는 겨눈 사건 · 그 묶음의 답이 저장된 뒤에 잰다 — 저장 중에 만든 제외도 메모가 같다(카본 끝 판 E3)', async () => {
  const touchesFor = async wait => {
    const port = memoryPort();
    const record = await openRecord({
      port,
      revision: 1,
      memory,
      params: PARAMS,
      index,
      now: () => T0,
    });
    const shown = record.add('practice.presented', presented());
    record.add('practice.attempted', answer(shown.event.id, 'incorrect'));
    if (wait) await record.saved();
    const excluded = record.add('record.excluded', { targetId: shown.event.id });
    assert.equal(await excluded.stored, true);
    return (await port.read()).find(row => row.value.event?.id === excluded.event.id).value.touches;
  };
  const settled = await touchesFor(true);
  assert.ok(settled, '저장된 뒤 만든 제외는 메모가 있다');
  assert.deepEqual(await touchesFor(false), settled, '저장 중에 만든 제외도 같은 메모');
});

test('옮겨 온 장부 — 거둔 장부는 옮긴 것으로 세지 않고, 다시 옮기는 장부는 앞 장부를 옮긴 때에 서며(새 판 사건 뒤로 늦추지 않음), 망가진 칸은 건너뛴다(GPT 끝 판 GD1 · 아르곤 끝 판 B7)', () => {
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
  // 앞 장부가 있고 그 뒤 새 판에서 낸 사건이 있어도, 다시 옮기는 장부는 앞 장부를 옮긴 때에 선다 — 옛 판 게임이 다른 탭에서 같이
  // 돌았을 수 있어 그 사이 새 판 답이 장부의 만남보다 앞인지 모른다(모르는 구간은 첫 만남으로 치지 않는다, GD1).
  const again = carriedFields(ledger, carriedSoFar([carried, mine, legacy]));
  assert.deepEqual(again.families, { f2: 1 });
  assert.equal(again.after, t(1), '앞 장부를 옮긴 때 — 새 판 사건(t5) 뒤로 늦추지 않는다');
  // 거둔 장부는 없던 것 — 처음 옮기는 장부로(칸 요약도), 어떤 만남보다 먼저(새 판 사건이 있어도).
  const first = carriedFields(ledger, carriedSoFar([carried, mine, withdrawn]));
  assert.deepEqual(first.families, { f1: 1, f2: 1 });
  assert.equal(first.after, null);
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

test('부모 저장이 실패하면 자식은 쓰지 않고(올리기가 막히지 않게), 요약 · 로컬 요약은 늘 한 기록만 남고, 다른 탭이 먼저 쓴 기록을 건너뛰지 않는다(Fable 끝 판 P1 둘 · P2)', async () => {
  // ① 부모 저장 실패 → 자식은 저장하지 않는다(stored false) · 대기열에 없다 · 계기에 PARENT_UNSAVED.
  const health = createHealth();
  const port = memoryPort();
  const record = await openRecord({
    port,
    revision: 1,
    memory,
    params: PARAMS,
    index,
    health,
    now: () => T0,
  });
  port.failNext(Object.assign(new Error('quota'), { name: 'QuotaExceededError' }));
  const lostParent = record.add('practice.presented', presented());
  const orphan = record.add('practice.attempted', answer(lostParent.event.id));
  assert.equal(await lostParent.stored, false);
  assert.equal(await orphan.stored, false, '부모가 저장되지 못한 답은 쓰지 않는다');
  assert.deepEqual(record.unsent(), []);
  assert.deepEqual(health.snapshot().save.codes, { STORAGE_ERROR: 1, PARENT_UNSAVED: 1 });
  // ② 요약은 받을 때마다 새 기록 하나 — 앞 요약 기록은 지운다(저장소가 요약 수만큼 커지지 않게).
  const server = createServer({ random: rng(31), index });
  const client = await createClient(server, { name: 'aaaa', port: memoryPort() });
  for (let i = 0; i < 12; i += 1) {
    const shown = client.device.make('practice.presented', presented());
    client.device.make('practice.attempted', answer(shown.id, i % 3 ? 'correct' : 'incorrect'));
    await client.push();
  }
  const kinds = (await client.port.read()).map(row => row.value.kind);
  assert.equal(kinds.filter(kind => kind === 'summary').length, 1, '요약 기록은 하나');
  assert.ok(client.record.view().memory.has('u0'));
  // 손님 로컬 요약도 하나.
  const guestPort = memoryPort();
  const guest = await openRecord({
    port: guestPort,
    revision: 0,
    guest: true,
    memory,
    params: PARAMS,
    index,
    now: () => T0,
  });
  for (let i = 0; i < 3; i += 1) {
    const shown = guest.add('practice.presented', presented());
    guest.add('practice.attempted', answer(shown.event.id));
    await guest.saved();
    await guest.refold();
  }
  await guest.localSaved(); // 손님 요약 저장은 뒤에서 돈다(§18-5-1 R2)
  assert.equal((await guestPort.read()).filter(row => row.value.kind === 'local').length, 1);
  // ③ 두 탭 — 다른 탭이 먼저 쓴(열쇠가 더 앞인) 기록을 내 덧붙이기가 지나쳐도 꼬리 읽기가 건너뛰지 않는다.
  const shared = memoryPort();
  const tabA = await openRecord({
    port: shared,
    revision: 1,
    memory,
    params: PARAMS,
    index,
    now: () => T0,
  });
  const tabB = await openRecord({
    port: shared,
    revision: 1,
    memory,
    params: PARAMS,
    index,
    now: () => T0,
  });
  const fromA = tabA.add('practice.presented', presented());
  await fromA.stored;
  const fromB = tabB.add('practice.presented', presented());
  await fromB.stored;
  await tabB.refresh();
  assert.equal(tabB.has(fromA.event.id), true, 'A가 먼저 쓴 사건을 읽는다');
});

test('손님 요약은 판 묶음(두뇌 · 색인 · 기록 규칙)이 바뀌면 다시 열 때 든 사건으로 다시 접는다(아르곤 끝 판 D2)', async () => {
  const port = memoryPort();
  const first = await openRecord({
    port,
    revision: 0,
    guest: true,
    memory,
    params: PARAMS,
    index,
    now: () => T0,
  });
  const shown = first.add('practice.presented', presented());
  first.add('practice.attempted', answer(shown.event.id));
  await first.saved();
  await first.refold();
  const before = [...first.summary.lines.unit.keys()];
  // 새 색인은 같은 문항의 단위를 바꾼다(태그 고침) — 판 이름만 바꾸지 않고 든 사건으로 다시 접었는지 값으로 본다(GPT 끝 판 GE1).
  const other = {
    edition: 'index-b',
    lookup: key => {
      const hit = index.lookup(key);
      return hit && key === item.itemKey ? { ...hit, units: ['uz'] } : hit;
    },
  };
  const reopened = await openRecord({
    port,
    revision: 0,
    guest: true,
    memory,
    params: PARAMS,
    index: other,
    now: () => T0,
  });
  assert.equal(reopened.summary.edition, reopened.edition(), '새 판 묶음으로 다시 접었다');
  assert.equal(reopened.view().waitAll, false);
  assert.ok(before.length > 0 && !before.includes('uz'));
  assert.deepEqual(
    [...reopened.summary.lines.unit.keys()],
    ['uz'],
    '옛 단위는 없고 새 단위로 접었다',
  );
});

test('손님 두 탭 — 꼬리를 안 읽은 탭이 다시 접어도 다른 탭이 먼저 쓴 답은 요약 · 얹기에서 빠지지 않는다, 다시 열어도(GPT 끝 판 GC1)', async () => {
  const port = memoryPort();
  const open = () =>
    openRecord({ port, revision: 0, guest: true, memory, params: PARAMS, index, now: () => T0 });
  const tabA = await open();
  const tabB = await open();
  const mine = unit =>
    presented({ itemKey: `tab-${unit}`, familyKey: `fam-${unit}`, units: [unit] });
  const fromA = tabA.add('practice.presented', mine('uA'));
  await fromA.stored;
  await tabA.add('practice.attempted', answer(fromA.event.id)).stored;
  const fromB = tabB.add('practice.presented', mine('uB'));
  await fromB.stored;
  await tabB.add('practice.attempted', answer(fromB.event.id)).stored;
  await tabB.refold();
  await tabB.refresh();
  assert.ok(tabB.view().memory.has('uA'), 'B가 접은 뒤 읽은 A의 답도 보기에 든다');
  assert.ok(tabB.view().memory.has('uB'));
  const reopened = await open();
  assert.ok(reopened.view().memory.has('uA'), '다시 열어도 A의 답이 있다');
});

test('서버 시각은 시계를 맞춘 뒤에만 받은 것으로 친다 — 첫 받기의 덧붙이기가 실패하면 치우지 않는다(A6 · 카본 끝 판 둘째 F1)', async () => {
  const inner = memoryPort();
  let fails = 1;
  const port = {
    ...inner,
    async append(values) {
      if (fails > 0) {
        fails -= 1;
        throw new Error('quota');
      }
      return inner.append(values);
    },
  };
  const rec = await openRecord({ port, revision: 1, memory, params: PARAMS, index, now: () => T0 });
  const base = { edition: rec.edition(), lines: [], full: true, issued: [] };
  await assert.rejects(
    rec.receive({ summary: { ...base, lineSeq: 1, foldedUntil: 1 }, serverTime: T0 - 3_600_000 }),
  );
  assert.equal(rec.compactDue(), false, '시계를 못 맞췄다 — 치우지 않는다');
  await rec.receive({
    summary: { ...base, lineSeq: 2, foldedUntil: 2 },
    serverTime: T0 - 3_600_000,
  });
  assert.equal(rec.compactDue(), true, '받은 뒤에는 치운다');
});

test('앞 요약 행 지우기만 실패하면 받은 답은 그대로 서고 계기에만 따로 남는다 — 남은 행은 다음 새 요약을 받을 때 지운다(카본 끝 판 둘째 F2)', async () => {
  const inner = memoryPort();
  let fails = 0;
  const port = {
    ...inner,
    async remove(keys) {
      if (fails > 0) {
        fails -= 1;
        throw new Error('closing');
      }
      return inner.remove(keys);
    },
  };
  const health = createHealth();
  const rec = await openRecord({
    port,
    revision: 1,
    memory,
    params: PARAMS,
    index,
    now: () => T0,
    health,
  });
  const base = { edition: rec.edition(), lines: [], full: true, issued: [] };
  await rec.receive({ summary: { ...base, lineSeq: 1, foldedUntil: 1 } });
  fails = 1;
  const view = await rec.receive({ summary: { ...base, lineSeq: 2, foldedUntil: 2 } });
  assert.ok(view, '던지지 않고 요약을 돌려준다');
  assert.equal(rec.summary.foldedUntil, 2, '새 요약이 섰다');
  assert.equal(
    health.snapshot().save.codes.SUMMARY_DROP,
    1,
    '지우기 실패는 사건 저장 실패와 따로 센다',
  );
  assert.equal(health.snapshot().save.codes.STORAGE_ERROR, undefined);
  const before = (await inner.read()).filter(row => row.value.kind === 'summary');
  assert.equal(before.length, 2, '앞 행이 남았다');
  await rec.receive({ summary: { ...base, lineSeq: 3, foldedUntil: 3 } });
  const after = (await inner.read()).filter(row => row.value.kind === 'summary');
  assert.equal(after.length, 1, '다음 새 요약을 받을 때 앞의 두 행을 모두 지운다');
});

test('같은 판 묶음 · 같은 갱신 차례의 요약 가운데 덜 접힌 늦은 요약은 쓰지 않는다 — 「낸 것」이 뒤로 가지 않게, 다시 열어도(GPT 끝 판 GC2)', async () => {
  const port = memoryPort();
  const open = () =>
    openRecord({ port, revision: 1, memory, params: PARAMS, index, now: () => T0 });
  const rec = await open();
  const base = { edition: rec.edition(), lineSeq: 5, lines: [], full: true };
  const shown = { id: 'a.0000000000001.0001.aaaaaaaa', at: T0, review: false, units: ['u0'] };
  await rec.receive({ summary: { ...base, foldedUntil: 11, issued: [shown] } });
  await rec.receive({ summary: { ...base, foldedUntil: 10, issued: [] } });
  assert.equal(rec.summary.foldedUntil, 11);
  assert.deepEqual(
    rec.summary.issued.map(row => row.id),
    [shown.id],
  );
  // 저장소 다시 읽기 길 — 두 탭이 같은 차례의 요약을 각각 저장하되 덜 접힌 것(10)이 뒤에 붙는다(GPT 다시 검수 GA1).
  const tabPort = memoryPort();
  const openTab = () =>
    openRecord({ port: tabPort, revision: 1, memory, params: PARAMS, index, now: () => T0 });
  const ahead = await openTab();
  const behind = await openTab();
  await ahead.receive({ summary: { ...base, foldedUntil: 11, issued: [shown] } });
  await behind.receive({ summary: { ...base, foldedUntil: 10, issued: [] } });
  const kinds = (await tabPort.read()).filter(row => row.value.kind === 'summary');
  assert.equal(kinds.length, 2, '두 요약 기록이 차례대로 붙었다');
  const reopened = await openTab();
  assert.equal(reopened.summary.foldedUntil, 11, '다시 열면 덜 접힌 늦은 기록을 쓰지 않는다');
  assert.deepEqual(
    reopened.summary.issued.map(row => row.id),
    [shown.id],
  );
});

test('「낸 것」 줄은 사건 번호(id)를 싣는다 — 내 제시는 그 번호, 번호 없는 요약 줄은 그대로 · 겹치지 않게(단계 4 §16)', async () => {
  const port = memoryPort();
  const record = await openRecord({
    port,
    revision: 1,
    memory,
    params: PARAMS,
    index,
    now: () => T0,
  });
  const fromServer = { id: 'a.0000000000002.0001.bbbbbbbb', at: T0, review: false, units: ['u1'] };
  const legacyA = { at: T0, review: true, units: ['u2'] };
  const legacyB = { at: T0, review: false, units: ['u3'] };
  await record.receive({
    summary: {
      edition: record.edition(),
      full: true,
      lineSeq: 1,
      foldedUntil: 1,
      lines: [],
      issued: [fromServer, legacyA, legacyB],
    },
  });
  const shown = record.add('practice.presented', presented());
  await shown.stored;
  const rows = record.issued();
  assert.deepEqual(
    rows.map(row => row.id),
    [fromServer.id, undefined, undefined, shown.event.id],
    '서버 줄 · 내 제시는 번호를 싣고 번호 없는 줄 둘은 따로 남는다',
  );
  assert.equal(Object.hasOwn(rows[1], 'id'), false, '번호 없는 줄에 id 칸을 만들지 않는다');
  assert.deepEqual(rows[3].units, ['u0']);
});
