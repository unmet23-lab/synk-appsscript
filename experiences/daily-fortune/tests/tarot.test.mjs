import test from 'node:test';
import assert from 'node:assert/strict';
import { seoulDateKey } from '../core.mjs';
import { drawCard, MAJOR_ARCANA } from '../tarot.mjs';
import { addDays, dayNumber } from '../fortune-base.mjs';
import { assertGentle } from './fortune-text.mjs';

const today = '2026-10-14';

test('메이저 아르카나 22장을 한국어로 정방향만 담는다', () => {
  assert.equal(MAJOR_ARCANA.length, 22);
  assert.deepEqual(MAJOR_ARCANA.map(card => card.number), Array.from({ length: 22 }, (_, index) => index));
  for (const field of ['id', 'name', 'english']) assert.equal(new Set(MAJOR_ARCANA.map(card => card[field])).size, 22, field);
  for (const card of MAJOR_ARCANA) {
    assert.match(card.id, /^[a-z-]+$/);
    assert.match(card.name, /^[가-힣 ]+$/);
    assert.match(card.english, /^[A-Z][A-Za-z ]+$/);
    assert.equal(card.keywords.length, 3);
    assert.equal(new Set(card.keywords).size, 3);
    assert.equal(card.meaning.match(/요\./g).length, 2, `뜻은 두 문장: ${card.meaning}`);
    assert.match(card.practice, /세요\.$|주세요\.$/);
    assert.equal(card.upright, true);
  }
  assert.equal(MAJOR_ARCANA[0].name, '바보');
  assert.equal(MAJOR_ARCANA[13].name, '변화');
  assert.equal(MAJOR_ARCANA[21].name, '세계');
  assertGentle(MAJOR_ARCANA, '타로');
  assert.doesNotMatch(JSON.stringify(MAJOR_ARCANA), /역방향|reversed/i);
});

test('하루 동안 같은 카드, 날짜가 바뀌면 다른 카드, 어느 연속 3일도 같은 카드가 없다', () => {
  for (let seedIndex = 0; seedIndex < 60; seedIndex++) {
    const seed = `saju:${addDays('1970-01-01', seedIndex * 211)}:${seedIndex % 2 ? '?' : '07:30'}`;
    const ids = Array.from({ length: 700 }, (_, index) => drawCard({ seed, date: addDays('2026-01-01', index) }).id);
    for (let index = 2; index < ids.length; index++) {
      assert.equal(new Set(ids.slice(index - 2, index + 1)).size, 3, `${seed} ${addDays('2026-01-01', index - 2)}`);
    }
  }
  const card = drawCard({ seed: 'sign:leo', date: today });
  assert.deepEqual(drawCard({ seed: 'sign:leo', date: today }), card);
  assert.equal(Object.isFrozen(card), true);
  assert.equal(card.date, today);
});

test('22일 묶음 안에서는 같은 카드가 다시 나오지 않고 사람마다 순서가 다르다', () => {
  const block = seed => {
    // 1970-01-01부터 센 날 수가 22의 배수인 날이 묶음의 첫날이다.
    let start = '2026-01-01';
    while (dayNumber(start) % 22 !== 0) start = addDays(start, 1);
    return Array.from({ length: 22 }, (_, index) => drawCard({ seed, date: addDays(start, index) }).id);
  };
  for (const seed of ['a', 'b', 'sign:aries', 'saju:1990-05-17:?']) assert.equal(new Set(block(seed)).size, 22, seed);
  assert.notDeepEqual(block('sign:aries'), block('sign:taurus'));
});

test('한국 날짜 기본값과 자정 경계를 따르고 잘못된 seed·날짜를 거부한다', () => {
  assert.deepEqual(drawCard({ seed: 'x' }), drawCard({ seed: 'x', date: seoulDateKey() }));
  const before = seoulDateKey('2026-10-14T14:59:59.999Z'), after = seoulDateKey('2026-10-14T15:00:00.000Z');
  assert.notEqual(drawCard({ seed: 'x', date: before }).id, drawCard({ seed: 'x', date: after }).id);
  for (const seed of ['', '   ', null, 7, 'a'.repeat(201)]) assert.throws(() => drawCard({ seed, date: today }), TypeError);
  assert.throws(() => drawCard({ seed: 'x', date: '2026-02-30' }), TypeError);
  assert.throws(() => drawCard({ seed: 'x', date: '1899-12-31' }), RangeError);
});
