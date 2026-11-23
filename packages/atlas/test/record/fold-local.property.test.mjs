// 대조 시험 2(기기 답 저장 빠르게 하기 설계 2-5 · 검토 D1 · D2, 11-23) — 손님 접기의 바뀐 묶음만 다시 접기(src/record/fold-local.mjs)가 접을
// 때마다 처음부터 접은 줄(linesOfGroups(groupsOf(열쇠 ≤ until)))과 packSummary 바이트까지 같다(열쇠 차례 포함). 넣는 차례 · 열쇠 차례 ·
// 같은 번호 두 열쇠(R10) · 치우기 · 다시 읽기 · 지도 더하기 · until이 줄어드는 접기를 섞는다. 앞 접기가 낸 줄은 뒤 접기가 고치지 않는다.
// 서버 foldPending과의 대조는 linesOfGroups를 거친다(server-fold.property.test.mjs가 둘이 같음을 본다).
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHeld, eventPool, jitter, mutableIndex } from '../support/held-world.mjs';
import { rng, seedRange } from '../support/seeds.mjs';
import { subject } from '../support/subject.mjs';
import { memory, PARAMS } from '../support/trail-sync.mjs';

const { createGroupIndex } = await subject('record/groups.mjs');
const { foldLines } = await subject('record/fold-local.mjs');
const { linesOfGroups } = await subject('record/rows.mjs');
const { packSummary } = await subject('record/summary.mjs');

const bytes = lines => JSON.stringify(packSummary({ lines }).lines);
const context = { memory, params: PARAMS };

function world(seed) {
  const random = rng(seed);
  const { items, events } = eventPool(random, { steps: 20 + Math.floor(random() * 50) });
  const index = mutableIndex(items, random);
  const groups = createGroupIndex(index, () => `p+m+a+${index.edition}+r`);
  const held = createHeld(groups);
  const keys = new Map(
    jitter(random, events, 1 + random() * 30).map((event, i) => [event.id, (i + 1) * 10]),
  );
  return { random, index, groups, held, keys, order: jitter(random, events, 1 + random() * 12) };
}

function step(w, event) {
  const roll = w.random();
  w.held.take(event, w.keys.get(event.id));
  if (roll < 0.08) w.held.take(event, w.keys.get(event.id) - 5);
  else if (roll < 0.1) w.index.addMap();
  else if (roll < 0.11) w.index.edition = 'index-b';
  else if (roll < 0.13) w.held.reload();
  else if (roll < 0.15) w.held.drop([...w.held.held.keys()].filter(() => w.random() < 0.15));
}

// 이번 접기의 until — 대개 앞 접기 뒤, 가끔 앞 접기보다 앞(처음부터 짓는 길), 가끔 든 것 전부보다 뒤.
function untilOf(w, last) {
  const top = w.held.maxKey();
  const roll = w.random();
  if (roll < 0.1) return Math.floor(w.random() * Math.max(1, last));
  if (roll < 0.3) return top + 10;
  return last + Math.floor(w.random() * Math.max(1, top - last + 10));
}

function run(seed, tally) {
  const w = world(seed);
  let folding = null;
  let last = 0;
  let shown = null;
  w.order.forEach((event, i) => {
    step(w, event);
    if (w.random() > 0.35 && i < w.order.length - 1) return;
    const until = untilOf(w, last);
    const label = `씨앗 ${seed} 걸음 ${i} until ${until}`;
    const result = foldLines(folding, w.groups, until, context);
    const want = linesOfGroups(w.held.groupsAt(until), { ...context, index: w.index });
    assert.equal(bytes(result.lines), bytes(want), `${label}: 접은 줄 = 처음부터`);
    if (shown)
      assert.equal(bytes(shown.lines), shown.bytes, `${label}: 앞 접기가 낸 줄을 고치지 않는다`);
    shown = { lines: result.lines, bytes: bytes(result.lines) };
    tally[folding && result.folding === folding ? 'carried' : 'fresh'] += 1;
    folding = result.folding;
    last = until;
  });
}

test('대조 2 — 바뀐 묶음만 다시 접어도 접을 때마다 처음부터 접은 줄과 packSummary 바이트까지 같다(넣는 차례 · R10 · 치우기 · 다시 읽기 · 지도 더하기 · 줄어드는 until)', () => {
  const tally = { carried: 0, fresh: 0 };
  for (const seed of seedRange({ count: 80 })) run(seed, tally);
  assert.ok(
    tally.carried > tally.fresh,
    `이어 접기를 실제로 견줘야 뜻이 있다 ${JSON.stringify(tally)}`,
  );
});
