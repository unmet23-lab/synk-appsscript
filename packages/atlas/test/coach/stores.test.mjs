// 앞 판의 자기 사본 버리기(src/coach/stores.mjs — 설계 §5-3 「비우기」 · 단계 4 계획 §18-5-5 E3). 비우기가 동의 판을 올리면 판이 바뀐 것을
// 본 기기는 같은 계정의 앞 판 저장소(올리는 길 · 기기 길)를 지운다. 다른 계정 · 같은 판 · 뒤 판 · 손님 저장소는 그대로다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';
import { bankOf, clock, createCoach, fakeMap, memoryPort } from './support.mjs';
import { rng } from '../support/seeds.mjs';

const { storeParts, dropEarlier } = await subject('coach/stores.mjs');
const { storeName } = await subject('record/port.mjs');
const { installHostMaker } = await subject('coach/host.mjs');

// IndexedDB 겉 — 판 이름 목록(databases)과 지우기(deleteDatabase)만.
function fakeIndexedDB(names, { list = true } = {}) {
  const dropped = [];
  return {
    dropped,
    ...(list ? { databases: async () => names.map(name => ({ name, version: 1 })) } : {}),
    deleteDatabase(name) {
      dropped.push(name);
      return {};
    },
  };
}
const sorted = list => [...list].sort();

test('저장소 이름 읽기 — 계정 저장소(올리는 길 · 기기 길)만, 손님 · 모르는 꼴은 null', () => {
  assert.deepEqual(storeParts(storeName({ account: 'a1', revision: 3 })), {
    account: 'a1',
    revision: 3,
    local: false,
  });
  assert.deepEqual(storeParts(storeName({ account: 'a1', revision: 2, local: true })), {
    account: 'a1',
    revision: 2,
    local: true,
  });
  assert.equal(storeParts(storeName({})), null, '손님');
  assert.equal(storeParts('synk-atlas:a1:0'), null);
  assert.equal(storeParts('다른 저장소'), null);
});

test('판이 오른 저장소를 열면 같은 계정의 앞 판 사본만 지운다 — 다른 계정 · 같은 판 · 뒤 판 · 손님은 그대로(E3)', async () => {
  const name = (revision, local = false, account = 'a1') => storeName({ account, revision, local });
  const names = [
    name(1),
    name(2, true),
    name(3),
    name(3, true),
    name(4),
    name(1, false, 'b2'),
    storeName({}),
  ];
  const idb = fakeIndexedDB(names);
  const dropped = await dropEarlier(name(3), { indexedDB: idb });
  assert.deepEqual(sorted(idb.dropped), sorted([name(1), name(2, true)]));
  assert.deepEqual(sorted(dropped), sorted(idb.dropped));
});

test('판 이름 목록이 없는 브라우저는 바로 앞 판 둘만 — 첫 판 · 손님 · IndexedDB 없음은 아무것도 지우지 않고, 지우기가 던져도 막지 않는다(E3)', async () => {
  const bare = fakeIndexedDB([], { list: false });
  await dropEarlier(storeName({ account: 'a1', revision: 5 }), { indexedDB: bare });
  assert.deepEqual(
    sorted(bare.dropped),
    sorted([
      storeName({ account: 'a1', revision: 4 }),
      storeName({ account: 'a1', revision: 4, local: true }),
    ]),
  );
  const idb = fakeIndexedDB([storeName({ account: 'a1', revision: 1 })]);
  assert.deepEqual(
    await dropEarlier(storeName({ account: 'a1', revision: 1 }), { indexedDB: idb }),
    [],
  );
  assert.deepEqual(await dropEarlier(storeName({}), { indexedDB: idb }), []);
  assert.deepEqual(
    await dropEarlier(storeName({ account: 'a1', revision: 2 }), { indexedDB: null }),
    [],
  );
  assert.deepEqual(idb.dropped, []);
  const throwing = {
    databases: async () => [{ name: storeName({ account: 'a1', revision: 1 }) }],
    deleteDatabase() {
      throw new Error('막힘');
    },
  };
  assert.equal(
    (await dropEarlier(storeName({ account: 'a1', revision: 2 }), { indexedDB: throwing })).length,
    1,
  );
});

test('호스트는 스스로 연 계정 저장소에서 앞 판 사본 버리기를 부른다 — 시험이 넘긴 포트로 연 것은 건드리지 않는다(E3)', async () => {
  const before = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  const key = storeName({ account: `e3-${process.pid}`, revision: 2 });
  const old = storeName({ account: `e3-${process.pid}`, revision: 1 });
  const idb = fakeIndexedDB([old, key]);
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: idb });
  try {
    const top = { location: { origin: 'https://synk.test' } };
    top.parent = top;
    installHostMaker(top, { openPort: () => memoryPort() });
    const items = bankOf(rng(9), { items: 3 });
    const time = clock();
    const coach = createCoach({
      gameId: 'e3',
      map: fakeMap(items),
      seed: 's',
      dayOffset: 0,
      scope: top,
      host: { guest: false, account: `e3-${process.pid}`, revision: 2, key, now: time.now },
    });
    await coach.ready;
    for (let i = 0; i < 20 && !idb.dropped.length; i += 1)
      await new Promise(resolve => setTimeout(resolve, 1));
    assert.deepEqual(idb.dropped, [old]);
    coach.dispose();
    const given = createCoach({
      gameId: 'e3-port',
      map: fakeMap(items),
      seed: 's',
      dayOffset: 0,
      scope: top,
      host: {
        guest: false,
        account: `e3p-${process.pid}`,
        revision: 2,
        key: storeName({ account: `e3p-${process.pid}`, revision: 2 }),
        port: memoryPort(),
        now: time.now,
      },
    });
    await given.ready;
    assert.deepEqual(idb.dropped, [old], '시험 포트로 연 저장소');
    given.dispose();
  } finally {
    if (before) Object.defineProperty(globalThis, 'indexedDB', before);
    else delete globalThis.indexedDB;
  }
});
