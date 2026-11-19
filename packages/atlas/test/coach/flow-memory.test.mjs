// 순간 맞춤의 내용 기억(단계 4 계획 §23-4 (나) · 카본 A8 · GPT GA8): 저장소마다 열쇠 하나, 씨앗은 한 번, 비움 세대가 다르면 읽지도 쓰지도
// 않고, 비우면 「비움 · 씨앗 끝」 표지가 남아 옛 기억에서 다시 씨앗을 읽지 않는다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';

const { createFlowMemory, clearFlowMemory, FLOW_MEMORY_PREFIX } =
  await subject('coach/flow-memory.mjs');

function fakeStorage() {
  const map = new Map();
  return {
    map,
    getItem: name => (map.has(name) ? map.get(name) : null),
    setItem: (name, value) => map.set(name, String(value)),
    removeItem: name => map.delete(name),
  };
}
const STORE = 'synk-atlas:guest';
const OLD = {
  contents: { 'order-rush.rush': { content: 'order-rush.rush', at: 'x', i: 1 } },
  declined: {},
};

test('처음 열 때 옛 기억을 씨앗으로 한 번 읽고, 다시 읽지 않는다', () => {
  const storage = fakeStorage();
  let reads = 0;
  const seed = () => {
    reads += 1;
    return OLD;
  };
  const gen = 0;
  const one = createFlowMemory({ storage, store: STORE, generation: () => gen, seed });
  assert.deepEqual(one.memory('order-rush.rush'), OLD.contents['order-rush.rush']);
  const two = createFlowMemory({ storage, store: STORE, generation: () => gen, seed });
  two.memory('order-rush.rush');
  assert.equal(reads, 1);
  assert.ok(storage.map.has(`${FLOW_MEMORY_PREFIX}${STORE}`));
});

test('판을 연 때의 세대가 아니면 쓰지 않고, 세대가 바뀌면 빈 기억이다', () => {
  const storage = fakeStorage();
  let gen = 0;
  const memory = createFlowMemory({ storage, store: STORE, generation: () => gen });
  const since = memory.since();
  assert.equal(memory.save('a', { at: '1' }, since), true);
  assert.deepEqual(memory.memory('a'), { at: '1' });
  gen = 1; // 다른 탭이 비웠다
  assert.equal(memory.memory('a'), null);
  assert.equal(memory.save('a', { at: '2' }, since), false, '앞 세대의 열린 판이 기억을 되살렸다');
  assert.equal(memory.memory('a'), null);
  assert.equal(memory.save('a', { at: '3' }, memory.since()), true);
  assert.deepEqual(memory.memory('a'), { at: '3' });
});

test('비우면 씨앗 끝 표지가 남아 옛 기억을 다시 읽지 않는다', () => {
  const storage = fakeStorage();
  let reads = 0;
  const seed = () => {
    reads += 1;
    return OLD;
  };
  assert.equal(clearFlowMemory(storage, STORE, 1), true);
  const memory = createFlowMemory({ storage, store: STORE, generation: () => 1, seed });
  assert.equal(memory.memory('order-rush.rush'), null);
  assert.equal(reads, 0);
});

test('저장소마다 열쇠가 따로다 — 판이 오르면 새로 선다', () => {
  const storage = fakeStorage();
  const a = createFlowMemory({ storage, store: 'synk-atlas:acct:1', generation: () => 0 });
  a.save('c', { at: '1' }, a.since());
  const b = createFlowMemory({ storage, store: 'synk-atlas:acct:2', generation: () => 0 });
  assert.equal(b.memory('c'), null);
});

test('읽개가 던지거나 저장소가 깨져도 빈 기억으로 연다', () => {
  const storage = fakeStorage();
  storage.setItem(`${FLOW_MEMORY_PREFIX}${STORE}`, '{not json');
  const memory = createFlowMemory({
    storage,
    store: STORE,
    generation: () => 0,
    seed: () => {
      throw new Error('blocked');
    },
  });
  assert.equal(memory.memory('x'), null);
  const broken = {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('denied');
    },
  };
  const none = createFlowMemory({ storage: broken, store: STORE, generation: () => 0 });
  assert.equal(none.memory('x'), null);
  assert.equal(none.save('x', {}, none.since()), false);
});

test('거절한 도움 줄이기 제안도 세대를 따른다', () => {
  const storage = fakeStorage();
  let gen = 0;
  const memory = createFlowMemory({ storage, store: STORE, generation: () => gen });
  assert.equal(memory.decline('c', '2026-11-19T00:00:00.000Z', memory.since()), true);
  assert.equal(memory.declined('c'), '2026-11-19T00:00:00.000Z');
  gen = 1;
  assert.equal(memory.declined('c'), null);
});
