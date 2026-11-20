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
  // 비운 뒤의 세대를 모르면(null) 세대 0 열쇠에 표지를 쓴다 — 세대 0에서 열어도 씨앗을 다시 읽지 않는다.
  const unknown = fakeStorage();
  assert.equal(clearFlowMemory(unknown, STORE, null), true);
  const zero = createFlowMemory({ storage: unknown, store: STORE, generation: () => 0, seed });
  assert.equal(zero.memory('order-rush.rush'), null);
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

test('다른 탭이 비워 저장된 세대가 앞서면, 이 탭의 세대가 아직 그대로여도 쓰지 않는다(카본 끝 판 D2)', () => {
  const storage = fakeStorage();
  let other = 0;
  const stale = createFlowMemory({ storage, store: STORE, generation: () => 0 });
  const since = stale.since();
  assert.equal(stale.save('a', { at: '1' }, since), true);
  // 다른 탭: 비워 세대 1로 오르고 새 기억을 쓴다.
  other = 1;
  const fresh = createFlowMemory({ storage, store: STORE, generation: () => other });
  assert.equal(fresh.save('a', { at: 'new' }, fresh.since()), true);
  assert.equal(
    stale.save('a', { at: 'old' }, since),
    false,
    '앞 세대의 탭이 비운 뒤의 기억을 덮었다',
  );
  assert.deepEqual(fresh.memory('a'), { at: 'new' });
});

test('앞 세대의 탭이 늦게 써도 비운 뒤의 기억을 덮지 않는다 — 세대마다 열쇠가 다르다(GPT 다시 보기 GC1 · 카본 둘째 다시 보기 A2)', () => {
  const storage = fakeStorage();
  const stale = createFlowMemory({ storage, store: STORE, generation: () => 0 });
  const since = stale.since();
  assert.equal(stale.save('a', { at: '1' }, since), true);
  // 다른 탭(세대 1 — 비운 뒤)이, 이 탭이 다음 세대 열쇠를 본 뒤 · 쓰기 전에 끼어들어 새 기억을 쓴다. Web Storage에는 탭 사이 잠금이 없다.
  const fresh = createFlowMemory({ storage, store: STORE, generation: () => 1 });
  const get = storage.getItem;
  let reads = 0;
  let injected = false;
  storage.getItem = name => {
    if (!injected) {
      reads += 1;
      if (reads === 2) {
        injected = true;
        assert.equal(fresh.save('a', { at: 'new' }, fresh.since()), true);
      }
    }
    return get(name);
  };
  stale.save('a', { at: 'old' }, since);
  storage.getItem = get;
  assert.ok(injected, '쓰기 사이에 끼어들지 못했다');
  assert.deepEqual(
    fresh.memory('a'),
    { at: 'new' },
    '앞 세대 탭의 늦은 쓰기가 비운 뒤의 기억을 지웠다',
  );
  assert.ok(storage.map.has(`${FLOW_MEMORY_PREFIX}${STORE}@1`));
});

test('비우면 그 세대와 바로 앞 세대의 열쇠에 표지를 쓴다 — 비운 것을 아직 모르는 탭도 앞 기억을 읽지 않고, 세대 0이 아니면 씨앗을 다시 읽지 않는다', () => {
  const storage = fakeStorage();
  let reads = 0;
  const seed = () => {
    reads += 1;
    return OLD;
  };
  const before = createFlowMemory({ storage, store: STORE, generation: () => 0, seed });
  assert.deepEqual(before.memory('order-rush.rush'), OLD.contents['order-rush.rush']);
  assert.equal(clearFlowMemory(storage, STORE, 1), true);
  assert.equal(before.memory('order-rush.rush'), null, '비운 것을 모르는 탭이 앞 기억을 읽었다');
  const after = createFlowMemory({ storage, store: STORE, generation: () => 2, seed });
  assert.equal(after.memory('order-rush.rush'), null);
  assert.equal(reads, 1, '세대가 오른 뒤 씨앗을 다시 읽었다');
});

test('열쇠의 세대와 값의 세대가 다르면(비우기가 덮은 앞 세대 열쇠) 빈 기억이다', () => {
  const storage = fakeStorage();
  storage.setItem(
    `${FLOW_MEMORY_PREFIX}${STORE}`,
    JSON.stringify({ v: 1, gen: 1, seeded: true, contents: { a: { at: 'x' } }, declined: {} }),
  );
  const memory = createFlowMemory({ storage, store: STORE, generation: () => 0 });
  assert.equal(memory.memory('a'), null);
});

test('비우기 표지는 그 세대의 열쇠가 비어 있을 때만 쓴다 — 표지가 늦게 쓰여도 그사이 새 세대에 저장한 다른 탭의 기억을 지우지 않는다(설계 관문 검토 M1)', () => {
  const storage = fakeStorage();
  const before = createFlowMemory({ storage, store: STORE, generation: () => 0 });
  assert.equal(before.save('a', { at: 'old' }, before.since()), true);
  // 탭 B가 기록부를 비워 세대 1로 올렸다. B가 표지를 쓰기 전에, 비움을 알아챈 탭 C가 세대 1에 새 기억을 저장한다.
  const c = createFlowMemory({ storage, store: STORE, generation: () => 1 });
  assert.equal(c.save('a', { at: 'new' }, c.since()), true);
  // 그다음 B가 표지를 쓴다.
  assert.equal(clearFlowMemory(storage, STORE, 1), true);
  assert.deepEqual(c.memory('a'), { at: 'new' }, '늦은 표지가 새 세대의 기억을 지웠다');
  assert.equal(before.memory('a'), null, '비운 것을 모르는 탭이 비우기 전 기억을 읽었다');
  // 그 세대의 열쇠가 비어 있으면 표지를 쓴다 — 씨앗 끝이 남는다.
  const empty = fakeStorage();
  assert.equal(clearFlowMemory(empty, STORE, 1), true);
  assert.equal(JSON.parse(empty.getItem(`${FLOW_MEMORY_PREFIX}${STORE}@1`)).seeded, true);
});

test('앞 꼴(기본 열쇠에 세대를 함께 둔 꼴)로 저장된 같은 세대의 기억을 이어받는다 — 그 세대의 열쇠가 없을 때만(GPT GA1)', () => {
  const storage = fakeStorage();
  // 앞 판은 세대 1의 기억과 거절 시각도 기본 열쇠에 「gen: 1」과 함께 두었다.
  storage.setItem(
    `${FLOW_MEMORY_PREFIX}${STORE}`,
    JSON.stringify({
      v: 1,
      gen: 1,
      seeded: true,
      contents: { a: { at: 'x' } },
      declined: { b: 'when' },
    }),
  );
  const memory = createFlowMemory({ storage, store: STORE, generation: () => 1 });
  assert.deepEqual(memory.memory('a'), { at: 'x' });
  assert.equal(memory.declined('b'), 'when');
  // 다음 쓰기는 이어받은 값 위에 그 세대의 열쇠를 세운다 — 앞 값이 빠지지 않는다.
  assert.equal(memory.save('c', { at: 'y' }, memory.since()), true);
  const saved = JSON.parse(storage.getItem(`${FLOW_MEMORY_PREFIX}${STORE}@1`));
  assert.deepEqual(saved.contents, { a: { at: 'x' }, c: { at: 'y' } });
  assert.deepEqual(saved.declined, { b: 'when' });
  // 기본 열쇠의 다른 세대 기억은 이어받지 않는다.
  const other = createFlowMemory({ storage, store: STORE, generation: () => 2 });
  assert.equal(other.memory('a'), null);
  assert.equal(other.declined('b'), null);
});

test('다른 탭이 비워 다음 세대의 열쇠가 섰으면, 이 탭의 세대가 아직 그대로여도 비우기 전 기억을 읽지 않는다(GPT GA2)', () => {
  const storage = fakeStorage();
  const stale = createFlowMemory({ storage, store: STORE, generation: () => 0 });
  assert.equal(stale.save('a', { at: 'old' }, stale.since()), true);
  assert.equal(stale.decline('b', 'when', stale.since()), true);
  // 다른 탭: 비워 세대 1로 오르고(표지를 쓰기 전) 새 기억을 저장한다.
  const next = createFlowMemory({ storage, store: STORE, generation: () => 1 });
  assert.equal(next.save('a', { at: 'new' }, next.since()), true);
  assert.equal(stale.memory('a'), null, '비운 것을 모르는 탭이 비우기 전 기억을 읽었다');
  assert.equal(stale.declined('b'), null);
  assert.equal(stale.save('a', { at: 'late' }, stale.since()), false);
  assert.deepEqual(next.memory('a'), { at: 'new' });
  // 두 번 뒤처진 탭: 세대 1(옮긴 사건 지우기)에는 아무도 쓰지 않았고 손님 비우기가 세대 2로 올렸다. 비우기가 바로 앞 세대(1)의 열쇠를
  // 표지로 덮어, 세대 0 탭도 다음 세대의 열쇠를 보고 비우기 전 기억을 읽지 않는다.
  const twice = fakeStorage();
  const behind = createFlowMemory({ storage: twice, store: STORE, generation: () => 0 });
  assert.equal(behind.save('a', { at: 'old' }, behind.since()), true);
  assert.equal(clearFlowMemory(twice, STORE, 2), true);
  assert.equal(behind.memory('a'), null, '두 번 뒤처진 탭이 비우기 전 기억을 읽었다');
  assert.equal(behind.save('a', { at: 'late' }, behind.since()), false);
});
