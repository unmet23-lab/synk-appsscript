// 기기 IndexedDB 포트의 막이 트랜잭션(src/record/idb.mjs swap — 단계 4 계획 §22-4 「늦게 쓰는 탭의 막이」). 머리 기록의 지우기 세대를 같은
// 트랜잭션에서 먼저 읽고, 기대와 다르면 아무것도 쓰지 않는다. 가짜는 IndexedDB 규칙 가운데 이 문이 기대는 것만 흉내 낸다 — 요청의 onsuccess
// 안에서 낸 요청도 같은 트랜잭션이고, 트랜잭션은 남은 요청이 없을 때 한꺼번에 반영되며, abort하면 아무것도 반영되지 않는다. store.clear()는
// 열쇠 생성기를 되돌리지 않는다.
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
  function transaction() {
    const tx = { oncomplete: null, onabort: null, onerror: null, error: null };
    const staged = new Map(rows);
    let stagedNext = next;
    let pending = 0;
    let state = 'active';
    const finish = () => {
      if (state !== 'active' || pending > 0) return;
      state = 'done';
      rows = staged;
      next = stagedNext;
      tx.oncomplete?.();
    };
    const issue = op => {
      if (state !== 'active')
        throw Object.assign(new Error('끝난 트랜잭션'), { name: 'TransactionInactiveError' });
      const req = { onsuccess: null, onerror: null, result: undefined, error: null };
      pending += 1;
      later(() => {
        pending -= 1;
        if (state !== 'active') return;
        req.result = op();
        req.onsuccess?.();
        later(finish);
      });
      return req;
    };
    tx.abort = () => {
      if (state !== 'active')
        throw Object.assign(new Error('끝난 트랜잭션'), { name: 'InvalidStateError' });
      state = 'aborted';
      later(() => {
        tx.error = Object.assign(new Error('aborted'), { name: 'AbortError' });
        tx.onabort?.();
      });
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
    later(finish); // 요청이 하나도 없는 트랜잭션도 끝난다
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
