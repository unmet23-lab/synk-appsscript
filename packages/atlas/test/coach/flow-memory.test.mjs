// 순간 맞춤의 내용 기억(단계 4 계획 §23-4 (나) · 카본 A8 · GPT GA8): 저장소의 세대마다 열쇠 하나, 씨앗은 세대 0에서 한 번, 비움 세대가
// 다르면 읽지도 쓰지도 않는다. 비우면 따로 열쇠(#cleared)에 「비운 세대」 표지가 남아, 비운 것을 아직 모르는 탭도 읽지도 쓰지도 않는다
// (설계 검토 가 · GPT 다시 검수 -b — 기억을 쓰는 탭은 그 열쇠에 쓰지 않아 늦은 쓰기가 표지를 지우지 못한다).
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';

const { createFlowMemory, clearFlowMemory, FLOW_MEMORY_PREFIX, FLOW_CLEARED_SUFFIX } =
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
const BASE = `${FLOW_MEMORY_PREFIX}${STORE}`;
const MARK = `${BASE}${FLOW_CLEARED_SUFFIX}`;
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
  // 비운 뒤의 세대를 모르거나 0이면 아무것도 쓰지 않는다 — record.clear는 1 이상의 세대를 돌려주거나 던진다.
  const unknown = fakeStorage();
  const kept = createFlowMemory({ storage: unknown, store: STORE, generation: () => 0 });
  assert.equal(kept.save('a', { at: 'x' }, kept.since()), true);
  const bytes = unknown.getItem(BASE);
  assert.equal(clearFlowMemory(unknown, STORE, null), false);
  assert.equal(clearFlowMemory(unknown, STORE, 0), false);
  assert.equal(unknown.getItem(BASE), bytes);
  assert.equal(unknown.map.size, 1);
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

test('비우면 따로 열쇠에 비운 세대의 표지를 쓴다(기억 열쇠에는 쓰지 않는다) — 비운 것을 아직 모르는 탭도 앞 기억을 읽지 않고, 세대 0이 아니면 씨앗을 다시 읽지 않는다', () => {
  const storage = fakeStorage();
  let reads = 0;
  const seed = () => {
    reads += 1;
    return OLD;
  };
  const before = createFlowMemory({ storage, store: STORE, generation: () => 0, seed });
  assert.deepEqual(before.memory('order-rush.rush'), OLD.contents['order-rush.rush']);
  const kept = storage.getItem(BASE);
  assert.equal(clearFlowMemory(storage, STORE, 1), true);
  assert.equal(JSON.parse(storage.getItem(MARK)).gen, 1);
  assert.equal(storage.getItem(BASE), kept, '비우기가 기억 열쇠를 건드렸다');
  assert.equal(storage.getItem(`${BASE}@1`), null);
  assert.equal(before.memory('order-rush.rush'), null, '비운 것을 모르는 탭이 앞 기억을 읽었다');
  const after = createFlowMemory({ storage, store: STORE, generation: () => 2, seed });
  assert.equal(after.memory('order-rush.rush'), null);
  assert.equal(reads, 1, '세대가 오른 뒤 씨앗을 다시 읽었다');
});

test('열쇠의 세대와 값의 세대가 다르면(비우기가 덮은 앞 세대 열쇠) 빈 기억이다', () => {
  const storage = fakeStorage();
  storage.setItem(
    `${BASE}@2`,
    JSON.stringify({
      v: 1,
      gen: 3,
      seeded: true,
      contents: { a: { at: 'x' } },
      declined: { b: 'when' },
    }),
  );
  const memory = createFlowMemory({ storage, store: STORE, generation: () => 2 });
  assert.equal(memory.memory('a'), null);
  assert.equal(memory.declined('b'), null);
});

test('비우기는 그 세대의 열쇠에 쓰지 않는다 — 표지가 늦게 서도 그사이 새 세대에 저장한 다른 탭의 기억이 바이트 그대로다(설계 관문 검토 M1 · GPT GA1)', () => {
  const storage = fakeStorage();
  const before = createFlowMemory({ storage, store: STORE, generation: () => 0 });
  assert.equal(before.save('a', { at: 'old' }, before.since()), true);
  // 탭 B가 기록부를 비워 세대 1로 올렸다. B가 표지를 쓰기 전에, 비움을 알아챈 탭 C가 세대 1에 새 기억을 저장한다.
  const c = createFlowMemory({ storage, store: STORE, generation: () => 1 });
  assert.equal(c.save('a', { at: 'new' }, c.since()), true);
  const bytes = storage.getItem(`${BASE}@1`);
  // 그다음 B가 표지를 쓴다.
  assert.equal(clearFlowMemory(storage, STORE, 1), true);
  assert.equal(storage.getItem(`${BASE}@1`), bytes, '늦은 표지가 새 세대의 기억을 건드렸다');
  assert.deepEqual(c.memory('a'), { at: 'new' });
  assert.equal(before.memory('a'), null, '비운 것을 모르는 탭이 비우기 전 기억을 읽었다');
  // 그 세대의 열쇠가 비어 있어도 쓰지 않는다 — 세대 1 이상은 열쇠가 없으면 원래 씨앗 없는 빈 기억이다. 표지는 따로 열쇠에만 선다.
  const empty = fakeStorage();
  assert.equal(clearFlowMemory(empty, STORE, 1), true);
  assert.equal(empty.getItem(`${BASE}@1`), null);
  assert.equal(empty.getItem(BASE), null);
  assert.equal(JSON.parse(empty.getItem(MARK)).gen, 1);
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
  // 두 번 뒤처진 탭: 세대 1(옮긴 사건 지우기)에는 아무도 쓰지 않았고 손님 비우기가 세대 2로 올렸다. 비운 세대 표지(세대 2)가 이 탭의
  // 세대보다 앞서, 세대 0 탭도 비우기 전 기억을 읽지 않는다.
  const twice = fakeStorage();
  const behind = createFlowMemory({ storage: twice, store: STORE, generation: () => 0 });
  assert.equal(behind.save('a', { at: 'old' }, behind.since()), true);
  assert.equal(clearFlowMemory(twice, STORE, 2), true);
  assert.equal(behind.memory('a'), null, '두 번 뒤처진 탭이 비우기 전 기억을 읽었다');
  assert.equal(behind.save('a', { at: 'late' }, behind.since()), false);
});

test('저장 없이 세대를 여럿 건너뛰어 비워도 뒤처진 탭은 읽지도 쓰지도 않는다 — 비운 세대 표지 하나로 안다(GPT GA3)', () => {
  const check = tabs => {
    for (const [g, tab] of tabs) {
      assert.equal(tab.memory('a'), null, `세대 ${g} 탭이 비우기 전 기억을 읽었다`);
      assert.equal(tab.declined('b'), null, `세대 ${g} 탭이 비우기 전 거절을 읽었다`);
      assert.equal(tab.save('a', { at: 'late' }, tab.since()), false, `세대 ${g} 탭이 썼다`);
      assert.equal(tab.decline('b', 'late', tab.since()), false, `세대 ${g} 탭이 거절을 썼다`);
    }
  };
  // 옮긴 사건 지우기가 세대를 1 · 2로 올리는 동안 아무도 저장하지 않았고 손님 비우기가 3으로 올렸다 — 세대 1의 열쇠가 없다.
  const storage = fakeStorage();
  const tabs = [0, 1, 2].map(g => [
    g,
    createFlowMemory({ storage, store: STORE, generation: () => g }),
  ]);
  const zero = tabs[0][1];
  assert.equal(zero.save('a', { at: 'old' }, zero.since()), true);
  assert.equal(zero.decline('b', 'when', zero.since()), true);
  assert.equal(clearFlowMemory(storage, STORE, 3), true);
  assert.equal(storage.getItem(`${BASE}@1`), null);
  check(tabs);
  // 세대 3 탭의 저장은 세대 3의 열쇠에 서고 읽힌다. 그 뒤에도 앞 세대 탭은 막혀 있다.
  const three = createFlowMemory({ storage, store: STORE, generation: () => 3 });
  assert.equal(three.save('a', { at: 'new' }, three.since()), true);
  assert.ok(storage.map.has(`${BASE}@3`));
  assert.deepEqual(three.memory('a'), { at: 'new' });
  check(tabs);
  // 세대 1 탭이 자기 열쇠에 기억을 둔 채 세 번 뒤처졌다(비우기가 4로 올림) — 바로 다음 세대의 열쇠도 없다.
  const other = fakeStorage();
  const one = createFlowMemory({ storage: other, store: STORE, generation: () => 1 });
  assert.equal(one.save('a', { at: 'old' }, one.since()), true);
  assert.equal(one.decline('b', 'when', one.since()), true);
  assert.equal(clearFlowMemory(other, STORE, 4), true);
  assert.equal(other.getItem(`${BASE}@2`), null);
  check([[1, one]]);
});

test('비우기는 기본 열쇠를 덮지 않는다 — 옛 판 탭이 비운 뒤 기본 열쇠에 쓴 기억이 남고, 새 세대 탭이 이어받고, 뒤처진 탭은 막힌다(Fable 설계 검토 1 · GPT GA2)', () => {
  for (const marked of [1, 2]) {
    const storage = fakeStorage();
    const stale = createFlowMemory({ storage, store: STORE, generation: () => 0 });
    assert.equal(stale.save('a', { at: 'old' }, stale.since()), true);
    // 앞 꼴로 쓰는 옛 판 탭이 새 세대를 받고, 비우는 탭의 표지보다 먼저 기본 열쇠에 새 기억을 쓴다.
    storage.setItem(
      BASE,
      JSON.stringify({
        v: 1,
        gen: marked,
        seeded: true,
        contents: { a: { at: 'new' } },
        declined: {},
      }),
    );
    const bytes = storage.getItem(BASE);
    assert.equal(clearFlowMemory(storage, STORE, 1), true);
    assert.equal(storage.getItem(BASE), bytes, '비우기가 비운 뒤에 쓴 기억을 덮었다');
    assert.equal(stale.memory('a'), null, '비운 것을 모르는 탭이 읽었다');
    assert.equal(stale.save('a', { at: 'late' }, stale.since()), false);
    if (marked === 1) {
      const next = createFlowMemory({ storage, store: STORE, generation: () => 1 });
      assert.deepEqual(next.memory('a'), { at: 'new' }, '새 세대 탭이 이어받지 못했다');
    }
  }
});

// 비운 것을 모르는 탭이 막혔는지 본 뒤 쓰기 전에 다른 탭의 비우기가 끝나는 장면 — 그 탭의 쓰기가 자기 열쇠에 닿는 순간 비우기를 끼운다.
function lateWrite(storage, key, gen, write) {
  const set = storage.setItem;
  let injected = false;
  storage.setItem = (name, value) => {
    if (!injected && name === key) {
      injected = true;
      assert.equal(clearFlowMemory(storage, STORE, gen), true);
    }
    return set(name, value);
  };
  try {
    write();
  } finally {
    storage.setItem = set;
  }
  assert.ok(injected, '쓰기 사이에 끼어들지 못했다');
}

test('비운 것을 모르는 탭의 늦은 쓰기가 비우기와 겹쳐도 표지는 남는다 — 그 탭은 그 뒤 비우기 전 기억을 읽지도 쓰지도 않고, 새 세대 탭은 빈 기억이다(GPT 다시 검수 -b GA1 · GA3)', () => {
  const storage = fakeStorage();
  const stale = createFlowMemory({ storage, store: STORE, generation: () => 0 });
  assert.equal(stale.save('a', { at: 'old' }, stale.since()), true);
  assert.equal(stale.decline('b', 'when', stale.since()), true);
  lateWrite(storage, BASE, 1, () => stale.save('c', { at: 'late' }, stale.since()));
  assert.equal(JSON.parse(storage.getItem(MARK)).gen, 1, '늦은 쓰기가 표지를 지웠다');
  assert.equal(stale.memory('a'), null, '비운 것을 모르는 탭이 비우기 전 기억을 다시 읽었다');
  assert.equal(stale.declined('b'), null);
  assert.equal(stale.save('a', { at: 'again' }, stale.since()), false);
  const next = createFlowMemory({ storage, store: STORE, generation: () => 1 });
  assert.equal(next.memory('a'), null, '새 세대 탭이 비우기 전 기억을 읽었다');
  assert.equal(next.memory('c'), null);
  assert.equal(next.save('d', { at: 'new' }, next.since()), true);
  assert.deepEqual(next.memory('d'), { at: 'new' });
  // 세대를 여럿 건너뛴 비우기(세대 3)와 세대 1 탭의 늦은 쓰기가 겹쳐도 같다.
  const other = fakeStorage();
  const one = createFlowMemory({ storage: other, store: STORE, generation: () => 1 });
  assert.equal(one.save('a', { at: 'old' }, one.since()), true);
  lateWrite(other, `${BASE}@1`, 3, () => one.save('c', { at: 'late' }, one.since()));
  assert.equal(one.memory('a'), null, '세대 1 탭이 비우기 전 기억을 다시 읽었다');
  assert.equal(one.save('a', { at: 'again' }, one.since()), false);
});

test('기억 열쇠가 어떻게 덮여도 비운 세대 표지는 남는다 — 기억을 쓰는 탭은 표지 열쇠에 쓰지 않는다', () => {
  const storage = fakeStorage();
  const one = createFlowMemory({ storage, store: STORE, generation: () => 1 });
  assert.equal(one.save('a', { at: 'old' }, one.since()), true);
  assert.equal(clearFlowMemory(storage, STORE, 2), true);
  const mark = storage.getItem(MARK);
  // 앞 꼴로 쓰는 옛 판 탭과 세대 0 탭이 기본 열쇠를 낮은 세대 값으로 덮었다.
  storage.setItem(BASE, JSON.stringify({ v: 1, gen: 0, seeded: true, contents: {}, declined: {} }));
  assert.equal(storage.getItem(MARK), mark);
  assert.equal(one.memory('a'), null, '바로 앞 세대 탭이 비우기 전 기억을 읽었다');
  assert.equal(one.save('a', { at: 'late' }, one.since()), false);
  const zero = createFlowMemory({ storage, store: STORE, generation: () => 0 });
  assert.equal(zero.save('a', { at: 'late' }, zero.since()), false);
  assert.equal(storage.getItem(MARK), mark);
});

test('비운 세대 표지는 세대가 오를 때만 바뀐다 — 늦게 끝난 앞 비우기가 표지를 낮추지 않는다', () => {
  const storage = fakeStorage();
  const two = createFlowMemory({ storage, store: STORE, generation: () => 2 });
  assert.equal(two.save('a', { at: 'old' }, two.since()), true);
  assert.equal(clearFlowMemory(storage, STORE, 3), true);
  assert.equal(clearFlowMemory(storage, STORE, 2), true);
  assert.equal(JSON.parse(storage.getItem(MARK)).gen, 3, '늦은 앞 비우기가 표지를 낮췄다');
  assert.equal(two.memory('a'), null, '세대 2 탭이 비우기 전 기억을 읽었다');
  assert.equal(two.save('a', { at: 'late' }, two.since()), false);
});

test('옛 판 탭이 기본 열쇠에 더 뒤 세대의 기억을 썼으면, 표지가 없어도 뒤처진 탭은 읽지도 쓰지도 않는다 — 그 기억을 덮지 않는다', () => {
  const storage = fakeStorage();
  const stale = createFlowMemory({ storage, store: STORE, generation: () => 0 });
  assert.equal(stale.save('a', { at: 'old' }, stale.since()), true);
  storage.setItem(
    BASE,
    JSON.stringify({ v: 1, gen: 1, seeded: true, contents: { a: { at: 'new' } }, declined: {} }),
  );
  const bytes = storage.getItem(BASE);
  assert.equal(stale.memory('a'), null);
  assert.equal(stale.save('a', { at: 'late' }, stale.since()), false);
  assert.equal(storage.getItem(BASE), bytes, '뒤처진 탭이 더 뒤 세대의 기억을 덮었다');
});

test('세대를 모르는 탭(generation()이 던짐)은 빈 기억으로 읽고, 쓰지 않고, 씨앗도 읽지 않는다(Fable 설계 검토 4)', () => {
  let reads = 0;
  const seed = () => {
    reads += 1;
    return OLD;
  };
  const lost = () => {
    throw new Error('closed');
  };
  // 비운 세대 표지가 선 뒤 — 세대를 모르는 탭은 표지와 기억 열쇠 어디에도 쓰지 않는다.
  const storage = fakeStorage();
  assert.equal(clearFlowMemory(storage, STORE, 1), true);
  const bytes = storage.getItem(MARK);
  const memory = createFlowMemory({ storage, store: STORE, generation: lost, seed });
  assert.equal(memory.since(), null);
  assert.equal(memory.memory('order-rush.rush'), null);
  assert.equal(memory.declined('x'), null);
  assert.equal(memory.save('a', { at: 'x' }, memory.since()), false);
  assert.equal(memory.decline('a', 'when', memory.since()), false);
  assert.equal(storage.getItem(MARK), bytes);
  assert.equal(storage.map.size, 1, '세대를 모르는 탭이 기억 열쇠에 썼다');
  // 빈 저장소에서도 씨앗을 읽거나 쓰지 않는다.
  const empty = fakeStorage();
  const none = createFlowMemory({ storage: empty, store: STORE, generation: lost, seed });
  assert.equal(none.memory('order-rush.rush'), null);
  assert.equal(empty.map.size, 0);
  assert.equal(reads, 0);
});

// 셸(world-plan-next.mjs · world-atlas-next.mjs)의 앞 판 쓸기 규칙을 옮긴 것이다(4-6e 설계 · 단계4_계획 §25) — 앞 세대 열쇠는 지우고,
// 기본 열쇠는 그 gen이 지금 세대보다 작을 때만 지운다. 비운 세대 표지(#cleared)는 「@세대」도 기본 열쇠도 아니라 남는다. 규칙이 바뀌면
// 아래 두 시험도 함께 고친다.
function sweep(storage, now) {
  for (const name of [...storage.map.keys()]) {
    const at = name.startsWith(`${BASE}@`) ? Number(name.slice(BASE.length + 1)) : null;
    if (Number.isSafeInteger(at) && at < now) storage.removeItem(name);
  }
  const kept = JSON.parse(storage.getItem(BASE) ?? 'null');
  if (kept && Number.isSafeInteger(kept.gen) && kept.gen < now) storage.removeItem(BASE);
}

test('비우기 뒤 셸의 앞 판 쓸기(4-6 — 앞 세대 열쇠는 지우고, 기본 열쇠는 그 gen이 지금 세대보다 작을 때만 지운다)를 거쳐도 뒤처진 탭은 비우기 전 기억을 읽지도 쓰지도 않는다', () => {
  const storage = fakeStorage();
  const zero = createFlowMemory({ storage, store: STORE, generation: () => 0 });
  const one = createFlowMemory({ storage, store: STORE, generation: () => 1 });
  assert.equal(zero.save('a', { at: 'zero' }, zero.since()), true);
  assert.equal(one.save('a', { at: 'one' }, one.since()), true);
  assert.equal(clearFlowMemory(storage, STORE, 2), true);
  sweep(storage, 2);
  assert.equal(storage.getItem(`${BASE}@1`), null, '쓸기가 앞 세대 열쇠를 지우지 않았다');
  assert.equal(storage.getItem(BASE), null, '쓸기가 비우기 전 세대 0 기억을 남겼다');
  assert.equal(JSON.parse(storage.getItem(MARK)).gen, 2, '쓸기가 비운 세대 표지를 지웠다');
  for (const [g, tab] of [
    [0, zero],
    [1, one],
  ]) {
    assert.equal(tab.memory('a'), null, `쓸기 뒤 세대 ${g} 탭이 비우기 전 기억을 읽었다`);
    assert.equal(tab.save('a', { at: 'late' }, tab.since()), false, `쓸기 뒤 세대 ${g} 탭이 썼다`);
  }
  const two = createFlowMemory({ storage, store: STORE, generation: () => 2 });
  assert.equal(two.memory('a'), null);
  assert.equal(two.save('a', { at: 'two' }, two.since()), true);
  assert.deepEqual(two.memory('a'), { at: 'two' });
});

test('비우기 뒤 쓸기를 돌려도 같은 세대의 이어받기는 그대로다 — 기본 열쇠의 같은 세대 앞 꼴 기억을 새 세대 탭이 읽고, 앞선 세대 열쇠만 사라진다(설계 주인 25-12의 8)', () => {
  const storage = fakeStorage();
  const one = createFlowMemory({ storage, store: STORE, generation: () => 1 });
  assert.equal(one.save('a', { at: 'one' }, one.since()), true);
  // 손님 비우기가 세대 2로 올렸고, 표지가 서기 전에 앞 꼴로 쓰는 옛 판 탭이 기본 열쇠에 세대 2 기억을 썼다.
  storage.setItem(
    BASE,
    JSON.stringify({
      v: 1,
      gen: 2,
      seeded: true,
      contents: { a: { at: 'old-format' } },
      declined: { b: 'when' },
    }),
  );
  assert.equal(clearFlowMemory(storage, STORE, 2), true);
  sweep(storage, 2);
  assert.equal(storage.getItem(`${BASE}@1`), null, '쓸기가 앞선 세대 열쇠를 남겼다');
  const two = createFlowMemory({ storage, store: STORE, generation: () => 2 });
  assert.deepEqual(two.memory('a'), { at: 'old-format' }, '비우기 · 쓸기 뒤 이어받기가 깨졌다');
  assert.equal(two.declined('b'), 'when');
  assert.equal(one.memory('a'), null, '비운 것을 모르는 탭이 비우기 전 기억을 읽었다');
});
