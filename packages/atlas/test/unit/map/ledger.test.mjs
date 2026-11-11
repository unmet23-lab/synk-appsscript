// 번호 장부(src/map/ledger.mjs, 설계 §4): 번호는 덧붙이기만 하고, 빠진 열쇠의 번호도 남고, 이름이 바뀌면 옛 번호를 잇는다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../../support/subject.mjs';

const { appendOnly, checkRows, extendRows, numberer } = await subject('map/ledger.mjs');

test('처음 보는 열쇠만 끝에 덧붙인다 — 있던 줄은 그대로', () => {
  const first = extendRows([], ['a', 'b']);
  assert.deepEqual(first.rows, [
    [1, 'a'],
    [2, 'b'],
  ]);
  assert.deepEqual(first.added, [1, 2]);
  const second = extendRows(first.rows, ['c', 'a']);
  assert.deepEqual(second.rows, [
    [1, 'a'],
    [2, 'b'],
    [3, 'c'],
  ]);
  assert.deepEqual(second.added, [3]);
});

test('은행에서 빠진 열쇠의 번호도 남고, 다시 들어오면 같은 번호다', () => {
  const rows = extendRows([], ['a', 'b', 'c']).rows;
  const without = extendRows(rows, ['a', 'c']);
  assert.deepEqual(without.rows, rows);
  const back = extendRows(without.rows, ['b', 'd']);
  assert.equal(numberer(back.rows)('b'), 2);
  assert.equal(numberer(back.rows)('d'), 4);
});

test('이름이 바뀐 열쇠는 옛 줄의 번호를 잇는다(사슬도) — 옛 이름과 새 이름이 함께 살아 있으면 멈춘다', () => {
  const rows = extendRows([], ['a', 'b']).rows;
  const renames = { a: 'a2', a2: 'a3' };
  const next = extendRows(rows, ['a3', 'b'], renames);
  assert.deepEqual(next.added, []);
  assert.equal(numberer(next.rows, renames)('a3'), 1);
  assert.throws(() => extendRows(rows, ['a', 'a3'], renames), /함께 있다/);
  // 사슬 중간 이름과 끝 이름이 함께 살아 있어도 멈춘다 — 둘 다 a의 번호를 받는다(GPT 보충 검수 GA1).
  assert.throws(
    () => extendRows([[1, 'a']], ['a2', 'a3'], { a: 'a2', a2: 'a3' }),
    /두 이름 a2 · a3가 함께 있다/,
  );
  assert.throws(() => extendRows(rows, ['x'], { x: 'y', y: 'x' }), /고리/);
  assert.throws(() => extendRows(rows, ['z'], { a: 'z', b: 'z' }), /두 옛 이름/);
});

test('장부 모양 — 번호는 1부터 빈틈없이, 열쇠는 한 번만', () => {
  assert.deepEqual(
    checkRows([
      [1, 'a'],
      [2, 'b'],
    ]),
    [],
  );
  assert.equal(
    checkRows([
      [1, 'a'],
      [3, 'b'],
    ]).length,
    1,
  );
  assert.equal(
    checkRows([
      [1, 'a'],
      [2, 'a'],
    ]).length,
    1,
  );
  assert.throws(() => extendRows([[2, 'a']], ['a']), /빈틈없이/);
});

test('덧붙이기만인가 — 앞 장부의 줄이 같은 번호 · 같은 열쇠로 모두 남아야 한다', () => {
  const before = { items: [[1, 'a']], families: [[1, 'f']] };
  assert.deepEqual(
    appendOnly(before, {
      items: [
        [1, 'a'],
        [2, 'b'],
      ],
      families: [[1, 'f']],
    }),
    [],
  );
  assert.equal(appendOnly(before, { items: [[1, 'b']], families: [[1, 'f']] }).length, 1);
  assert.equal(appendOnly(before, { items: [], families: [[1, 'f']] }).length, 1);
});

test('이름 표가 장부와 맞나 — 옛 이름이 장부에 없거나, 새 이름이 이미 다른 번호면 멈춘다', () => {
  const rows = extendRows([], ['a', 'b']).rows;
  assert.throws(() => extendRows(rows, ['b'], { a: 'b' }), /이미 2번/);
  assert.throws(() => extendRows(rows, ['z2'], { z: 'z2' }), /장부에 없다/);
});
