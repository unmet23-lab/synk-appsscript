// 「놀이」 해금 표(play-unlocks.mjs, 11-03): 표에 없는 놀이는 늘 열림, 주문 폭주는 싱크타운 카페 첫 방문을 마쳐야 열림, 기록이 없거나 읽는 중이면 잠김.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAY_UNLOCKS, playRecord, playState } from '../play-unlocks.mjs';
import strings from '../world-strings.mjs';

const learning = (cafeCompleted, phase = 'ready') => ({ summary: { cafe: { completed: cafeCompleted, total: 1, nextNumber: null }, status: { phase } } });

test('이 표 전부터 있던 놀이(바람길 · 한글 만나기 · 말의 리듬)는 기록이 없어도 열려 있다', () => {
  for (const id of ['runner', 'hangul', 'rhythm']) assert.deepEqual(playState(id, null), { open: true });
});

test('주문 폭주는 싱크타운 카페 첫 방문을 마친 뒤에만 열린다', () => {
  assert.deepEqual(playState('order', playRecord(learning(0))), { open: false, where: 'play.where.cafe' });
  assert.deepEqual(playState('order', playRecord(learning(1))), { open: true });
});

test('생활 진도를 아직 못 읽었거나 읽는 중이면 잠김으로 본다(열렸다고 먼저 말하지 않는다)', () => {
  assert.equal(playRecord(undefined), null);
  assert.equal(playRecord({}), null);
  assert.equal(playRecord(learning(1, 'loading')), null);
  assert.equal(playState('order', null).open, false);
});

test('규칙이 이상한 기록에 던져도 잠김으로 남는다', () => {
  assert.equal(playState('order', { get cafeVisits() { throw Error('broken'); } }).open, false);
});

test('잠김 안내의 여는 자리 글이 화면 글 표에 세 언어로 있다', () => {
  for (const rule of Object.values(PLAY_UNLOCKS)) {
    for (const key of [rule.where, 'play.locked', 'game.order.title', 'game.order.detail']) {
      for (const lang of ['ko', 'en', 'mn']) assert.ok(strings[key]?.[lang], `${key}.${lang}`);
    }
  }
  assert.match(strings['play.locked'].ko, /\{where\}/);
});
