// Flow 내용 정의의 막기(설계 주인 11-21 — 단계 4 계획 §25-12의 15 · §25-10의 4). 문항 난도를 실은 내용(items)은 선언된 손잡이 밖의 내용
// 차원 손잡이를 갖지 못한다 — 두뇌가 고른 어려운 문항의 놓침이 그 손잡이를 종류와 상관없이(도움 포함) 덜어 내기 때문이다. 시간 손잡이는
// 난도 몫을 싣지 않아 막지 않는다. 제품 게임의 내용 관문은 test/build/product-flow.test.mjs가 본다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { Flow } from './legacy.mjs';

const ITEMS = { levels: [1, 2, 3], weight: 2 };
const PACE = { id: 'patience', kind: 'pace', values: [60, 52, 45, 38, 32], start: 2 };
const define = (id, knobs, items = ITEMS) =>
  Flow.defineContent({ id, ...(items ? { items } : {}), knobs });
// 던지는 글에 내용 id와 손잡이 id가 함께 든다.
const blocked = (id, knob) =>
  new RegExp(`${id.replaceAll('.', '\\.')}\\b.*\\b${knob.replaceAll('.', '\\.')}\\b`);

test('문항 난도를 실은 내용은 돌릴 수 있는 내용 차원 손잡이를 가지면 정의할 때 던진다 — 글에 내용 id와 손잡이 id가 든다', () => {
  assert.throws(
    () => define('test.block.content', [{ id: 'choices', values: [2, 3, 4], start: 1 }]),
    blocked('test.block.content', 'choices'),
  );
  // 도움 손잡이도 내용 차원이다 — 막기를 kind: 'content'로 좁히면 이 내용이 지나간다.
  assert.throws(
    () =>
      define('test.block.support', [
        { id: 'hint', kind: 'support', values: ['early', 'normal', 'late'], start: 1 },
      ]),
    blocked('test.block.support', 'hint'),
  );
  // 시간 손잡이와 함께 두어도 막는다(주문 폭주 꼴에 도움 하나를 더한 것).
  assert.throws(
    () =>
      define('test.block.rush', [PACE, { id: 'hint', kind: 'support', values: ['early', 'late'] }]),
    blocked('test.block.rush', 'hint'),
  );
  // 정의한 값은 손잡이 목록까지 얼어 있다 — 정의한 값은 다시 검사하지 않으므로, 뒤에 도움 손잡이를 더해 막기를 비켜 가지 못한다(GPT GA5).
  const paced = define('test.block.frozen', [PACE]);
  assert.throws(
    () => paced.knobs.push({ id: 'hint', kind: 'support', values: ['early', 'late'] }),
    TypeError,
  );
  assert.throws(() => {
    paced.knobs[0].kind = 'support';
  }, TypeError);
  assert.ok(Object.isFrozen(paced.items) && Object.isFrozen(paced.items.levels));
  assert.equal(Flow.defineContent(paced), paced);
});

test('막기에 들지 않는 내용: 문항 난도와 시간 손잡이, 선언된 내용 손잡이, 문항 난도 없는 내용 손잡이는 정의된다', () => {
  assert.deepEqual(
    define('test.block.pace', [PACE]).knobs.map(k => k.id),
    ['patience'],
  );
  const declared = define('test.block.declared', [
    PACE,
    { id: 'textSize', follows: 'declared', values: ['standard', 'large'] },
    { id: 'hint', kind: 'support', follows: 'declared', values: ['early', 'late'] },
  ]);
  assert.deepEqual(
    declared.knobs.map(k => [k.id, k.kind, k.follows]),
    [
      ['patience', 'pace', null],
      ['textSize', 'content', 'declared'],
      ['hint', 'support', 'declared'],
    ],
  );
  const plain = define(
    'test.block.plain',
    [
      { id: 'choices', values: [2, 3, 4], start: 1 },
      { id: 'hint', kind: 'support', values: ['early', 'late'] },
    ],
    null,
  );
  assert.equal(plain.items, null);
  assert.deepEqual(
    plain.knobs.map(k => k.kind),
    ['content', 'support'],
  );
  // items뿐인 내용(손잡이 없음)도 그대로다.
  assert.deepEqual(Flow.defineContent({ id: 'test.block.items', items: ITEMS }).knobs, []);
});
