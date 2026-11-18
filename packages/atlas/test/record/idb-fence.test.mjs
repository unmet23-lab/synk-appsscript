// 기기 IndexedDB 포트의 막이 트랜잭션(src/record/idb.mjs swap — 단계 4 계획 §22-4 「늦게 쓰는 탭의 막이」). 머리 기록의 지우기 세대를 같은
// 트랜잭션에서 먼저 읽고, 기대와 다르면 아무것도 쓰지 않는다. 가짜는 IndexedDB 규칙 가운데 이 문이 기대는 것만 흉내 낸다 — 요청의 onsuccess
// 안에서 낸 요청도 같은 트랜잭션이고, 그 밖의 차례(타이머 · 다른 작업)에서 낸 요청은 비활성 트랜잭션이라 거절되며, 트랜잭션은 남은 요청이 없을 때
// 한꺼번에 반영되고, abort하면 아무것도 반영되지 않는다. store.clear()는 열쇠 생성기를 되돌리지 않는다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';

const { idbPort } = await subject('record/idb.mjs');
const { GEN_KEY } = await subject('record/port.mjs');

function fakeIndexedDB() {
  let rows = new Map();
  let next = 1;
  const later = fn => setTimeout(fn, 0);
  const sorted = map => [...map.keys()].sort((a, b) => a - b);
  // 트랜잭션은 만든 차례로 하나씩 돈다 — 앞 트랜잭션이 끝나야 다음이 시작하고, 시작할 때 저장소를 읽는다. 시작 전에 낸 요청은 기다린다
  // (4-5 끝 판 GPT GF1 — 만들 때 저장소를 베끼면 겹쳐 돈 두 쓰기의 앞 것이 뒤 것에 덮였다).
  let busy = false;
  const waiting = [];
  const done = () => {
    busy = false;
    const start = waiting.shift();
    if (start) later(start);
  };
  function transaction() {
    const tx = { oncomplete: null, onabort: null, onerror: null, error: null };
    let staged = null;
    let stagedNext = 0;
    let pending = 0;
    let started = false;
    let state = 'live'; // live · done · aborted
    // 요청을 받는 때(실제 IndexedDB의 active 플래그)는 트랜잭션을 만든 차례와 요청마다 onsuccess를 부르는 차례뿐이다 — 그 차례의
    // 마이크로태스크가 다 돈 뒤 내린다. 내렸을 때 남은 요청이 없으면 곧 커밋한다(자동 커밋). 그 뒤의 차례(타이머 · 다른 작업)에서 낸
    // 요청은 TransactionInactiveError다(4-5 끝 판 카본 F2 — 끝남과 활성을 한 상태로 합쳐 두면 그런 변경도 시험을 지났다).
    let active = true;
    const queued = [];
    const commit = () => {
      state = 'done';
      rows = staged;
      next = stagedNext;
      later(() => tx.oncomplete?.());
      done();
    };
    const settle = async () => {
      for (let tick = 0; tick < 64; tick += 1) await null;
      active = false;
      if (state === 'live' && started && pending === 0) commit();
    };
    const run = (op, req) =>
      later(() => {
        pending -= 1;
        if (state !== 'live') return;
        req.result = op();
        active = true;
        req.onsuccess?.();
        void settle();
      });
    const start = () => {
      if (state !== 'live') return;
      busy = true;
      started = true;
      staged = new Map(rows);
      stagedNext = next;
      for (const [op, req] of queued.splice(0)) run(op, req);
      void settle();
    };
    const issue = op => {
      if (state !== 'live' || !active)
        throw Object.assign(new Error('비활성 트랜잭션'), { name: 'TransactionInactiveError' });
      const req = { onsuccess: null, onerror: null, result: undefined, error: null };
      pending += 1;
      if (started) run(op, req);
      else queued.push([op, req]);
      return req;
    };
    tx.abort = () => {
      if (state !== 'live')
        throw Object.assign(new Error('끝난 트랜잭션'), { name: 'InvalidStateError' });
      const wasStarted = started;
      state = 'aborted';
      active = false;
      later(() => {
        tx.error = Object.assign(new Error('aborted'), { name: 'AbortError' });
        tx.onabort?.();
      });
      if (wasStarted) done();
    };
    tx.objectStore = () => ({
      get: key => issue(() => structuredClone(staged.get(key))),
      add(value) {
        const copy = structuredClone(value);
        return issue(() => {
          const key = stagedNext++;
          staged.set(key, copy);
          return key;
        });
      },
      put(value, key) {
        const copy = structuredClone(value);
        return issue(() => {
          staged.set(key, copy);
          return key;
        });
      },
      delete: key => issue(() => void staged.delete(key)),
      clear: () => issue(() => void staged.clear()),
      getAllKeys: () => issue(() => sorted(staged)),
      getAll: () => issue(() => sorted(staged).map(key => structuredClone(staged.get(key)))),
    });
    if (busy) waiting.push(start);
    else start();
    void settle(); // 만든 차례 — 요청이 하나도 없는 트랜잭션도 끝난다
    return tx;
  }
  const db = {
    objectStoreNames: { contains: () => true },
    transaction,
    onversionchange: null,
    close() {},
  };
  return {
    rows: () => rows,
    open() {
      const req = { onsuccess: null, onerror: null, result: db };
      later(() => req.onsuccess?.());
      return req;
    },
  };
}

test('막이 — 세대가 기대와 다르면 아무것도 쓰지 않고 CLEARED(그때의 세대), 같으면 지우기 · 세대 · 덧붙이기가 한 트랜잭션이다', async () => {
  const fake = fakeIndexedDB();
  const port = await idbPort('t', { indexedDB: fake });
  const [a, b] = await port.append([{ n: 1 }, { n: 2 }]);
  await assert.rejects(
    port.swap({ expect: 3, append: [{ n: 3 }] }),
    error => error.code === 'CLEARED' && error.gen === 0,
  );
  assert.deepEqual(sortedKeys(fake), [a, b], '거절된 쓰기는 아무것도 남기지 않는다');
  const [c] = await port.swap({ expect: 0, gen: 1, remove: [a], append: [{ n: 3 }] });
  assert.deepEqual(sortedKeys(fake), [GEN_KEY, b, c]);
  assert.deepEqual(fake.rows().get(GEN_KEY), { kind: 'gen', gen: 1 });
  await assert.rejects(
    port.swap({ expect: 0, append: [{ n: 4 }] }),
    error => error.code === 'CLEARED' && error.gen === 1,
  );
  const [d] = await port.swap({
    expect: 1,
    gen: 2,
    removeAll: true,
    append: [{ kind: 'cleared', gen: 2 }],
  });
  assert.deepEqual(
    sortedKeys(fake),
    [GEN_KEY, d],
    '머리 기록까지 지운 뒤 같은 트랜잭션에서 세대를 다시 쓴다',
  );
  assert.deepEqual(fake.rows().get(GEN_KEY), { kind: 'gen', gen: 2 });
  assert.ok(d > c, '비워도 열쇠 번호는 이어진다');
  const [e] = await port.swap({ expect: 2, removeAll: true, append: [{ n: 5 }] });
  assert.deepEqual(
    fake.rows().get(GEN_KEY),
    { kind: 'gen', gen: 2 },
    '세대를 주지 않은 removeAll은 세대를 그대로 둔다',
  );
  assert.deepEqual(sortedKeys(fake), [GEN_KEY, e]);
});

test('막이 — 덧붙일 값 하나를 복제할 수 없으면 지우기까지 아무것도 반영하지 않고 그 예외를 던진다', async () => {
  const fake = fakeIndexedDB();
  const port = await idbPort('t', { indexedDB: fake });
  const [a] = await port.append([{ n: 1 }]);
  const broken = { f: () => {} }; // 함수는 구조 복제가 되지 않는다
  await assert.rejects(port.swap({ expect: 0, gen: 1, removeAll: true, append: [broken] }), {
    name: 'DataCloneError',
  });
  assert.deepEqual(sortedKeys(fake), [a], '지우기 · 세대 쓰기도 되돌아갔다');
});

function sortedKeys(fake) {
  return [...fake.rows().keys()].sort((x, y) => x - y);
}

test('막이 — plan을 주면 막이를 지난 같은 트랜잭션에서 기록을 모두 읽어 고른 것을 지우고 덧붙인다. null이면 아무것도 쓰지 않고, 던지면 되돌린다(4-5 코드 검수 GPT GB1)', async () => {
  const fake = fakeIndexedDB();
  const port = await idbPort('t', { indexedDB: fake });
  const [a, b] = await port.append([{ n: 1 }, { n: 2 }]);
  let seen = null;
  const [c] = await port.swap({
    expect: 0,
    gen: 1,
    plan: rows => {
      seen = rows;
      return { remove: [a], append: [{ n: 3 }] };
    },
  });
  assert.deepEqual(
    seen,
    [
      { key: a, value: { n: 1 } },
      { key: b, value: { n: 2 } },
    ],
    '든 기록을 모두 읽어 넘긴다',
  );
  assert.deepEqual(sortedKeys(fake), [GEN_KEY, b, c]);
  assert.deepEqual(fake.rows().get(GEN_KEY), { kind: 'gen', gen: 1 });
  const [d] = await port.swap({
    expect: 1,
    plan: rows => {
      assert.ok(
        rows.every(row => row.key !== GEN_KEY),
        '머리 기록은 넘기지 않는다',
      );
      return { remove: [], append: [{ n: 4 }] };
    },
  });
  assert.deepEqual(sortedKeys(fake), [GEN_KEY, b, c, d]);
  assert.deepEqual(
    await port.swap({ expect: 1, gen: 2, plan: () => null }),
    [],
    '고를 것이 없으면 쓰지 않는다',
  );
  assert.deepEqual(fake.rows().get(GEN_KEY), { kind: 'gen', gen: 1 }, '세대도 그대로다');
  await assert.rejects(
    port.swap({
      expect: 1,
      gen: 2,
      plan: () => {
        throw new Error('고르기 실패');
      },
    }),
    /고르기 실패/,
  );
  assert.deepEqual(sortedKeys(fake), [GEN_KEY, b, c, d], '던지면 아무것도 바꾸지 않는다');
  await assert.rejects(
    port.swap({ expect: 0, gen: 2, plan: () => ({ remove: [b] }) }),
    error => error.code === 'CLEARED' && error.gen === 1,
  );
});

test('가짜의 규칙 — 만든 차례와 요청의 onsuccess 차례(마이크로태스크까지)에만 요청을 받고, 그 뒤 차례의 요청은 TransactionInactiveError다. 남은 요청이 없으면 곧 커밋한다(4-5 끝 판 카본 F2)', async () => {
  const fake = fakeIndexedDB();
  const db = await new Promise(resolve => {
    const req = fake.open();
    req.onsuccess = () => resolve(req.result);
  });
  const inactive = error => error?.name === 'TransactionInactiveError';
  const tx = db.transaction();
  const store = tx.objectStore();
  await null; // 만든 차례의 마이크로태스크 — 아직 받는다
  const first = store.add({ n: 1 });
  const outcome = await new Promise(resolve => {
    first.onsuccess = () => {
      // onsuccess 안과 그 마이크로태스크에서 낸 요청은 같은 트랜잭션이다.
      store.add({ n: 2 });
      Promise.resolve().then(() => store.add({ n: 3 }));
      // 다음 차례(타이머)에서 낸 요청은 비활성 트랜잭션이라 거절된다.
      setTimeout(() => {
        try {
          store.add({ n: 4 });
          resolve('accepted');
        } catch (error) {
          resolve(inactive(error) ? 'inactive' : error);
        }
      }, 0);
    };
  });
  assert.equal(outcome, 'inactive');
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.deepEqual(
    [...fake.rows().values()].map(row => row.n),
    [1, 2, 3],
    '받은 요청만 한 번에 커밋했다',
  );
  const late = db.transaction();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.throws(
    () => late.objectStore().add({ n: 5 }),
    inactive,
    '만든 차례가 지나면 요청을 받지 않는다',
  );
});

test('막이 — 덧붙이기(append)도 세대가 기대와 다르면 아무것도 쓰지 않고 CLEARED(그때의 세대), 같으면 쓴다(4-5 끝 판 GPT GF2)', async () => {
  const fake = fakeIndexedDB();
  const port = await idbPort('t', { indexedDB: fake });
  const other = await idbPort('t', { indexedDB: fake });
  await other.swap({ expect: 0, gen: 1, append: [] });
  await assert.rejects(
    port.append([{ n: 1 }], { expect: 0 }),
    error => error.code === 'CLEARED' && error.gen === 1,
  );
  assert.deepEqual(sortedKeys(fake), [GEN_KEY], '거절된 덧붙이기는 아무것도 남기지 않는다');
  const [key] = await port.append([{ n: 2 }], { expect: 1 });
  assert.deepEqual(sortedKeys(fake), [GEN_KEY, key], '지금 세대면 쓴다');
});

test('막이 — 두 탭이 겹쳐 쓰면 차례로 돈다: 비우기(plan)가 고른 뒤 다른 탭이 단 답은 비우는 트랜잭션에 닿지 못하고 막이에 걸린다. 부모 없는 답이 남지 않는다(4-5 끝 판 GPT GF1)', async () => {
  for (const first of ['swap', 'append']) {
    const fake = fakeIndexedDB();
    const clearer = await idbPort('t', { indexedDB: fake });
    const writer = await idbPort('t', { indexedDB: fake });
    await clearer.append([{ kind: 'event', id: 'p1' }]);
    const swap = () =>
      clearer.swap({
        expect: 0,
        gen: 1,
        plan: rows => ({
          remove: rows.filter(row => row.value.kind === 'event').map(row => row.key),
          append: [],
        }),
      });
    const child = () => writer.append([{ kind: 'event', id: 'c1', parent: 'p1' }], { expect: 0 });
    const runs = first === 'swap' ? [swap(), child()] : [child(), swap()];
    const settled = await Promise.allSettled(runs);
    const left = [...fake.rows().values()]
      .filter(value => value.kind === 'event')
      .map(value => value.id);
    assert.deepEqual(left, [], `${first} 먼저 — 비우는 트랜잭션 뒤에 남은 사건이 없다`);
    assert.deepEqual(
      fake.rows().get(GEN_KEY),
      { kind: 'gen', gen: 1 },
      `${first} 먼저 — 비우기가 덮이지 않았다`,
    );
    if (first === 'swap')
      assert.equal(settled[1].reason?.code, 'CLEARED', '비운 뒤의 답은 막이에 걸린다');
    else assert.equal(settled[0].status, 'fulfilled', '먼저 쓴 답은 비우기가 함께 지운다');
  }
});
