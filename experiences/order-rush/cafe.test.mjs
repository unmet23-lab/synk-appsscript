import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ORDERS, REVIEW, makeCup, editCup } from './core.mjs';
import { ANIMALS, customerOf, customerName, cupLabel, liquidOf } from './cafe.mjs';

const here = new URL('./', import.meta.url);

test('주문마다 손님이 정해져 있고, 본 주문 12개는 모두 다른 손님이다(줄에 같은 얼굴이 겹치지 않는다)', () => {
  for (const o of [...ORDERS, ...REVIEW]) {
    const key = customerOf(o.id);
    assert.ok(ANIMALS[key], o.id);
    assert.ok(fs.existsSync(new URL(`assets/cast/${key}.webp`, here)), `${key} 그림`);
    assert.ok(fs.existsSync(new URL(`assets/cast/face/${key}.webp`, here)), `${key} 얼굴`);
    assert.match(customerName(o.id), / 손님$/);
  }
  assert.equal(new Set(ORDERS.map((o) => customerOf(o.id))).size, ORDERS.length);
});

test('컵 한 줄 이름은 넣은 것만 적는다', () => {
  const c = (...acts) => acts.reduce(editCup, makeCup());
  assert.equal(cupLabel(makeCup()), '빈 컵');
  assert.equal(cupLabel(c('coffee', 'sugar')), '따뜻한 커피 · 설탕');
  assert.equal(cupLabel(c('coffee', 'milk', 'ice')), '차가운 라테 · 얼음');
  assert.equal(cupLabel(c('tea', 'cold')), '차가운 차');
  assert.equal(cupLabel(c('tea', 'milk')), '따뜻한 밀크티');
  assert.equal(cupLabel(c('milk')), '따뜻한 우유');
  assert.equal(cupLabel(c('ice')), '빈 컵 · 얼음');
  assert.equal(cupLabel(c('cold', 'sugar')), '빈 컵 · 설탕 · 차갑게');
  assert.equal(liquidOf(makeCup()), null);
  assert.equal(liquidOf(c('coffee', 'milk')), 'latte');
});
