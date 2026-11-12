// 계정 길 ②의 기록 쪽 장면(단계 4 계획 §18-5-1 · §18-5-5 A6):
//   손님 요약은 메모리에서 곧바로 서고 저장은 뒤에서 — 차례 밖이면 exclusive('summary')를 청하고, 「차례 안」이면 다시 청하지 않는다(R1 · R2).
//   차례를 못 얻거나 저장이 실패해도 열기 · 보기는 그대로다. 판 묶음이 다른 손님 요약은 받지도 지우지도 않는다(R3).
//   치우기는 서버 시각을 받은 뒤에만, 다른 탭의 치운 표시를 만난 탭은 포트를 통째로 다시 읽는다(A6).
//   자물쇠 없이 두 기록부 · 한 포트(R4): 저장된 답은 요약 또는 밀린 것 꼭 한쪽에만 — 보기가 포트 전체를 한 번 접은 것과 같다.
//   새 파생 기록 종류는 이 임의 시험에 넣는다(§18-5-6) — 경계 표지(§18-5-3): 표지는 탭마다 꼭 한 번씩 들고, 옮길 계획은 포트를 새로 읽은 것과 같다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { seedRange } from '../support/seeds.mjs';
import { subject } from '../support/subject.mjs';
import { createClient, createServer, memory, PARAMS } from '../support/trail-sync.mjs';
import { bank, indexOf, rng, T0 } from '../support/trail-world.mjs';

const { openRecord, KEEP_MS, SWEEP_EVERY_MS } = await subject('record/log.mjs');
const { memoryPort } = await subject('record/port.mjs');
const { createHealth } = await subject('health/index.mjs');
const { EVENT_TYPES } = await subject('record/events.mjs');

const items = bank(rng(7));
const index = indexOf(items, 'index-a');
const presented = (item, setId = 'set1') => ({
  setId,
  itemKey: item.itemKey,
  familyKey: item.familyKey,
  skillId: item.skillId,
  difficulty: 1,
  responseFormat: 'single-choice',
  modality: 'listening',
  audioRequired: false,
  confounded: false,
  units: item.units?.length ? item.units : ['u0'],
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
  reason: { code: 'unit.new', slots: {}, evidence: {}, target: 'u0', tier: 2, introduced: [] },
});
const answer = (presentationId, verdict = 'correct', attemptNo = 1) => ({
  presentationId,
  attemptNo,
  verdict,
  errorTags: [],
});

const guest = (port, extra = {}) =>
  openRecord({ port, guest: true, memory, params: PARAMS, index, now: () => T0, ...extra });

async function practise(record, item, verdict = 'correct') {
  const shown = record.add(EVENT_TYPES.presented, presented(item));
  await shown.stored;
  const made = record.add(EVENT_TYPES.attempted, answer(shown.event.id, verdict));
  await made.stored;
  return made.event.id;
}

// 보기의 근거 줄(단위 · 능력 · 첫 만남)을 견줄 꼴로.
const linesOf = view =>
  JSON.stringify({
    memory: [...view.memory].sort(([a], [b]) => a.localeCompare(b)),
    ability: [...view.ability].sort(([a], [b]) => a.localeCompare(b)),
    met: [...view.met].sort(([a], [b]) => a.localeCompare(b)),
  });

test('손님 요약은 메모리에서 곧바로 서고 저장은 차례 안에서 뒤에 — 차례 밖이면 summary 차례를 청하고, 「차례 안」이면 청하지 않는다(R1 · R2)', async () => {
  const port = memoryPort();
  const asked = [];
  const exclusive = (job, work) => {
    asked.push(job);
    return work();
  };
  const record = await guest(port, { exclusive });
  await record.localSaved();
  assert.deepEqual(asked, ['summary'], '열 때 접은 요약을 차례를 청해 저장한다');
  const id = await practise(record, items[0]);
  record.enterTurn();
  await record.refold();
  assert.equal(record.pending().has(id), false, '접기는 곧바로 — 저장을 기다리지 않는다');
  await record.localSaved();
  record.leaveTurn();
  assert.deepEqual(asked, ['summary'], '호스트가 「차례 안」으로 둔 동안에는 다시 청하지 않는다');
  const rows = (await port.read()).filter(row => row.value.kind === 'local');
  assert.equal(rows.length, 1, '앞 요약 기록은 지운다');
  assert.ok(rows[0].value.until >= (await port.read()).find(r => r.value.event?.id === id).key);
});

test('차례를 못 얻으면 요약 저장만 건너뛴다 — 보기는 메모리 요약으로 서고, 계기는 TURN_BUSY를 코드만 센다(R2 · G5)', async () => {
  const port = memoryPort();
  const health = createHealth();
  const busy = () =>
    Promise.reject(Object.assign(new Error('busy'), { code: 'TURN_BUSY', job: 'summary' }));
  const record = await guest(port, { exclusive: busy, health });
  const id = await practise(record, items[1], 'incorrect');
  await record.refold();
  await record.localSaved();
  assert.equal(record.pending().has(id), false, '요약(메모리)에 들었다');
  assert.equal((await port.read()).filter(row => row.value.kind === 'local').length, 0);
  const snapshot = health.snapshot();
  assert.ok(snapshot.save.codes.TURN_BUSY >= 1);
  assert.equal(snapshot.save.streak, 0, '이어진 실패로 세지 않는다');
  assert.equal(snapshot.engineOff, false);
});

// 시간 한도 — 저장을 기다리는 판에서는 끝나지 않는 차례가 열기 · 판 끝을 멈춘다(그 판을 잡아야 하는 시험이다).
test('손님 요약 저장은 아무도 기다리지 않는다 — 차례가 끝나지 않아도 열기 · 판 끝 접기는 메모리 계산까지만(R2)', {
  timeout: 5000,
}, async () => {
  const port = memoryPort();
  const stuck = () => new Promise(() => {});
  const record = await guest(port, { exclusive: stuck });
  const id = await practise(record, items[5]);
  await record.refold();
  assert.equal(record.pending().has(id), false, '판 끝 접기는 메모리에서 끝났다');
  assert.ok(record.summary);
});

test('요약 저장이 실패해도 열기는 성공한다 — 사건은 그대로 근거다(R2)', async () => {
  const port = memoryPort();
  const first = await guest(port);
  await practise(first, items[2]);
  await first.localSaved();
  const health = createHealth();
  port.failNext(Object.assign(new Error('quota'), { name: 'QuotaExceededError' }));
  const reopened = await guest(port, { health });
  await reopened.localSaved();
  port.heal();
  assert.ok(reopened.summary, '열렸고 요약이 섰다');
  assert.equal(reopened.pending().size, 0);
});

test('판 묶음이 다른 손님 요약(다른 판 엔진의 탭)은 받지도 지우지도 않는다(R3)', async () => {
  const port = memoryPort();
  const other = await guest(port, { index: indexOf(items, 'index-b'), tag: 'oldbbbbb' });
  await practise(other, items[3]);
  await other.refold();
  await other.localSaved();
  const theirs = (await port.read()).filter(row => row.value.kind === 'local').map(r => r.key);
  assert.equal(theirs.length, 1);
  const mine = await guest(port, { tag: 'newaaaaa' });
  assert.equal(mine.summary.edition, mine.edition(), '보기의 바탕은 내 판 묶음으로 접은 요약');
  await practise(mine, items[4]);
  await mine.refold();
  await mine.localSaved();
  const keys = (await port.read()).filter(row => row.value.kind === 'local').map(r => r.key);
  for (const key of theirs)
    assert.ok(keys.includes(key), '다른 판 묶음의 요약 기록은 지우지 않는다');
  assert.equal(mine.summary.edition, mine.edition());
});

test('치우기는 이 세션에 서버 시각을 받은 뒤에만, 하루 한 번(A6)', async () => {
  const random = rng(11);
  const server = createServer({ random, index });
  const client = await createClient(server, { name: 'sweepaaa', pull: false });
  assert.equal(client.record.compactDue(), false, '서버 시각을 받기 전');
  assert.equal(await client.record.compact(), 0, '서버 시각을 받기 전에는 치우지 않는다');
  await client.pull();
  assert.equal(client.record.compactDue(), true, '서버 시각을 받았고 치운 적이 없다');
  await client.record.compact();
  assert.equal(client.record.compactDue(), false, '방금 치웠다');
  server.tick(SWEEP_EVERY_MS);
  assert.equal(client.record.compactDue(), true, '하루가 지났다');
});

test('다른 탭의 치운 표시를 만난 탭은 포트를 통째로 다시 읽는다 — 표지를 읽기 전에 치워진 사건이 받은 표지 없이 남아 두 번 얹히지 않게(A6)', async () => {
  const random = rng(13);
  const server = createServer({ random, index });
  const port = memoryPort();
  const a = await createClient(server, { name: 'taba0000', port });
  const b = await createClient(server, { name: 'tabb0000', port });
  const ids = [];
  for (let i = 0; i < 3; i += 1) ids.push(await practise(a.record, items[i]));
  await b.record.refresh(); // B가 A의 사건을 든다 — 받은 표지는 아직 없다
  for (const id of ids) assert.ok(b.record.pending().has(id));
  await a.push(); // 받은 표지는 포트에 — B는 아직 읽지 않았다
  server.tick(KEEP_MS + 60_000);
  await a.pull();
  assert.ok((await a.record.compact()) > 0, 'A가 이틀 지난 사건을 치웠다');
  for (const id of ids) assert.equal(a.record.has(id), false);
  await b.record.refresh();
  for (const id of ids) {
    assert.equal(b.record.has(id), false, '치운 사건은 B의 메모리에서도 빠진다');
    assert.equal(
      b.record.pending().has(id),
      false,
      '받은 표지 없이 남아 밀린 것으로 얹히지 않는다',
    );
  }
  const fresh = await openRecord({
    port,
    revision: 1,
    memory,
    params: PARAMS,
    index,
    now: () => server.now,
  });
  assert.equal(linesOf(b.record.view()), linesOf(fresh.view()), 'B의 보기 = 포트를 새로 읽은 보기');
});

// 기다리지 않는 줄은 같다 — 다른 탭의 「더 이른 시각」 답이 요약 뒤에 들어오면 얹기는 그 줄을 요약 값 그대로 기다리게 둔다(설계 §5-4
// 「얹을 수 없는 줄」 — 저장 관문 ③과 같은 비교, device.property.test.mjs sameMap).
const MARK_KINDS = ['moved', 'kept', 'logout', 'visited'];
const ACCOUNTS = ['A', 'B'];
// 표지는 받은 차례(내가 쓴 것은 쓸 때, 남의 것은 꼬리에서)로 쌓인다 — 경계는 가장 큰 값만 보므로 열쇠 차례로 견준다.
const marksOf = record =>
  record
    .marks()
    .map(({ key, mark, account, until }) => ({ key, mark, account, until }))
    .sort((x, y) => x.key - y.key);
const planOf = (record, account) => {
  const plan = record.guestUpload(1, { account });
  return {
    current: plan.current.map(event => event.id),
    legacy: plan.legacy.map(event => event.id),
  };
};

function sameLines(view, want, label) {
  for (const [key, line] of want.memory)
    if (!view.waitUnits.has(key))
      assert.deepEqual(view.memory.get(key) ?? null, line, `${label} 단위 ${key}`);
  for (const key of view.memory.keys())
    if (!view.waitUnits.has(key) && !want.memory.has(key))
      assert.fail(`${label}: 없어야 할 단위 ${key}`);
  for (const [key, line] of want.ability)
    if (!view.waitSkills.has(key))
      assert.deepEqual(view.ability.get(key) ?? null, line, `${label} 능력 ${key}`);
  assert.deepEqual([...view.met].sort(), [...want.met].sort(), `${label} 첫 만남`);
}

// 임의 걸음 하나 — 답 · 다른 탭의 답이 끼어드는 다시 접기 · 경계 표지 · 꼬리 읽기.
async function randomStep(tabs, random, cut) {
  const pick = list => list[Math.floor(random() * list.length)];
  const tab = pick(tabs);
  const other = tabs.find(t => t !== tab);
  const roll = random();
  if (roll < 0.4) return practise(tab, pick(items), random() < 0.6 ? 'correct' : 'incorrect');
  if (roll < 0.65) {
    cut(() => practise(other, pick(items), 'correct'));
    return tab.refold();
  }
  if (roll < 0.85) {
    const mark = pick(MARK_KINDS);
    const account = mark === 'logout' ? null : pick(ACCOUNTS);
    const until = tab.guestUpload(1, { account }).until;
    return tab.mark({ mark, account, revision: mark === 'moved' ? 1 : null, until });
  }
  return tab.refresh();
}

// 끝 확인 ① ~ ⑤(아래 R4 머리말).
async function checkTab(tab, fresh, answers, label) {
  const until = tab.summary.foldedUntil;
  for (const row of answers)
    assert.notEqual(
      row.key <= until,
      tab.pending().has(row.value.event.id),
      `${label}: ${row.value.event.id}는 요약 또는 밀린 것 꼭 한쪽에만`,
    );
  sameLines(tab.view(), fresh.view(), label);
  await tab.refold();
  assert.equal(linesOf(tab.view()), linesOf(fresh.view()), `${label}: 다시 접은 보기`);
  assert.deepEqual(marksOf(tab), marksOf(fresh), `${label}: 표지는 열쇠당 꼭 한 번`);
  for (const account of ACCOUNTS)
    assert.deepEqual(
      planOf(tab, account),
      planOf(fresh, account),
      `${label}: ${account}에게 옮길 계획 = 포트를 새로 읽은 것`,
    );
}

// R4 — 자물쇠 없이 두 손님 기록부 · 한 포트. 접는 도중(꼬리를 읽은 직후) 다른 탭의 답이 끼어든다. 끝에 ① 저장된 답은 탭마다 요약
// (열쇠 ≤ 요약의 「어디까지 접었나」) 또는 밀린 것 꼭 한쪽에만 있고 ② 기다리지 않는 줄은 포트 전체를 한 번 접은 보기와 같으며 ③ 다시
// 접으면 보기 전체가 같다 — 요약이 읽지 않은 답까지 접었다고 적거나(빠짐, A4) 같은 답이 두 번 얹히면 ② · ③이 다르다. 경계 표지(§18-5-6)도
// 섞어 쓴다 — ④ 표지는 탭마다 열쇠당 꼭 한 번(내가 쓴 표지가 꼬리에서 다시 와도) ⑤ 계정마다 옮길 계획(2판 · 옛 꼴)이 포트를 새로 읽은 것과 같다.
for (const seed of seedRange({ count: 6 })) {
  test(`자물쇠 없이 두 손님 기록부 · 한 포트 임의 시험(씨앗 ${seed}) — 보기는 포트 전체를 한 번 접은 것과 같다(R4)`, async () => {
    const random = rng(1000 + seed);
    const port = memoryPort();
    const range = port.range.bind(port);
    let cutIn = null;
    port.range = async after => {
      const rows = await range(after);
      if (cutIn) {
        const run = cutIn;
        cutIn = null;
        await run();
      }
      return rows;
    };
    const tabs = [await guest(port, { tag: 'r4aaaaaa' }), await guest(port, { tag: 'r4bbbbbb' })];
    const cut = run => {
      cutIn = run;
    };
    for (let step = 0; step < 24; step += 1) await randomStep(tabs, random, cut);
    for (const tab of tabs) {
      await tab.refresh();
      await tab.localSaved();
    }
    const fresh = await guest(port, { tag: 'r4cccccc' });
    const answers = (await port.read()).filter(
      row => row.value.event?.type === EVENT_TYPES.attempted,
    );
    for (const [i, tab] of tabs.entries()) await checkTab(tab, fresh, answers, `탭 ${i}`);
  });
}

test('계정 두 기록부 · 한 포트: 받은 표지가 있는 사건은 어느 탭의 대기열에도 다시 들지 않는다(R4 계정)', async () => {
  const random = rng(17);
  const server = createServer({ random, index });
  const port = memoryPort();
  const tabs = [
    await createClient(server, { name: 'acctaaaa', port }),
    await createClient(server, { name: 'acctbbbb', port }),
  ];
  for (let step = 0; step < 16; step += 1) {
    const tab = tabs[step % 2];
    await practise(tab.record, items[step % items.length], step % 3 ? 'correct' : 'incorrect');
    if (random() < 0.5) {
      await tab.record.refresh();
      await tab.push();
    }
  }
  const acked = new Set(
    (await port.read())
      .filter(row => row.value.kind === 'ack')
      .flatMap(row => row.value.acks.map(([id]) => id)),
  );
  for (const tab of tabs) {
    await tab.record.refresh();
    for (const event of tab.record.unsent(Number.POSITIVE_INFINITY))
      assert.equal(acked.has(event.id), false, `${tab.name}: 받은 ${event.id}가 대기열에`);
  }
});
