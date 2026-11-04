// 「놀이」 해금 표(play-unlocks.mjs, 11-03): 표에 없는 놀이는 늘 열림, 주문 폭주는 싱크타운 카페 첫 방문을 마쳐야 열림, 기록이 없거나 읽는 중이면 잠김.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAY_UNLOCKS, PLAY_REPLACED_BY, playRecord, playState, playOrder } from '../play-unlocks.mjs';
import strings from '../world-strings.mjs';

const learning = (cafeCompleted, phase = 'ready') => ({ summary: { cafe: { completed: cafeCompleted, total: 1, nextNumber: null }, status: { phase } } });

test('이 표 전부터 있던 놀이(바람길 · 한글 만나기 · 말의 리듬)는 기록이 없어도 열려 있다', () => {
  for (const id of ['runner', 'hangul', 'rhythm']) assert.deepEqual(playState(id, null), { open: true });
});

test('말 랠리는 레슨 한 번이나 카페 첫 방문 뒤 열린다(동아리 탁구 회차가 생기면 옮긴다)', () => {
  const data = (completed, cafe = 0) => ({ summary: { completed, cafe: { completed: cafe }, status: { phase: 'ready' } } });
  assert.deepEqual(playState('rally', playRecord(data(0))), { open: false, where: 'play.where.lesson' });
  assert.deepEqual(playState('rally', playRecord(data(1))), { open: true });
  assert.deepEqual(playState('rally', playRecord(data(0, 1))), { open: true });
});

test('주문 폭주는 싱크타운 카페 첫 방문을 마친 뒤에만 열린다', () => {
  assert.deepEqual(playState('order', playRecord(learning(0))), { open: false, where: 'play.where.cafe' });
  assert.deepEqual(playState('order', playRecord(learning(1))), { open: true });
});

test('찰칵 낱말은 「처음 만난 날」 이야기를 두 강 들은 뒤 열린다', () => {
  const withPacks = (completed) => ({ summary: { cafe: { completed: 0 }, status: { phase: 'ready' }, packs: [{ id: 'cafe', completed: 9, total: 9 }, { id: 'greetings', completed, total: 3 }] } });
  assert.deepEqual(playState('snap', playRecord(withPacks(1))), { open: false, where: 'play.where.stories' });
  assert.deepEqual(playState('snap', playRecord(withPacks(2))), { open: true });
  assert.equal(playState('snap', playRecord(learning(1))).open, false);   // 묶음 진도가 없는 기록은 잠김
});

test('빈칸 베기는 레슨 한 번이나 카페 첫 방문 뒤에 열린다(중간고사 회차가 생기면 그 기록으로 옮긴다)', () => {
  const record = (completed, cafe = 0) => playRecord({ summary: { completed, cafe: { completed: cafe }, status: { phase: 'ready' } } });
  assert.deepEqual(playState('blank', record(0)), { open: false, where: 'play.where.lesson' });
  assert.deepEqual(playState('blank', record(1)), { open: true });
  assert.deepEqual(playState('blank', record(0, 1)), { open: true });
  assert.equal(playState('blank', null).open, false);
});

test('바닷가 레이스는 지도 찾기 이야기(거꾸로 든 지도)를 마친 뒤에만 열린다', () => {
  const summary = (completed) => ({ summary: { packs: [{ id: 'greetings', completed: 3 }, { id: 'directions', completed }], status: { phase: 'ready' } } });
  assert.deepEqual(playState('racing', playRecord(summary(0))), { open: false, where: 'play.where.directions' });
  assert.deepEqual(playState('racing', playRecord(summary(1))), { open: true });
  assert.equal(playState('racing', playRecord(learning(1))).open, false);   // packs가 없는 옛 요약은 잠김
  assert.equal(playState('racing', null).open, false);
});

test('환승 러시는 레슨 하나를 마친 뒤 열리고, 열리면 바람길 자리를 이어받는다', () => {
  const summary = (completed) => ({ summary: { completed, cafe: { completed: 0 }, status: { phase: 'ready' } } });
  assert.deepEqual(playState('subway', playRecord(summary(0))), { open: false, where: 'play.where.lesson' });
  assert.deepEqual(playState('subway', playRecord(summary(1))), { open: true });
  const ids = ['runner', 'hangul', 'rhythm', 'order', 'subway'];
  assert.deepEqual(playOrder(ids, playRecord(summary(0))), ids, '잠겨 있는 동안은 듣기 놀이가 비지 않는다');
  assert.deepEqual(playOrder(ids, playRecord(summary(2))), ['subway', 'hangul', 'rhythm', 'order']);
  assert.deepEqual(playOrder(ids, null), ids, '기록을 못 읽으면 내리지 않는다');
  assert.equal(playState('runner', playRecord(summary(2))).open, true, '게임 자체는 그대로 열린다');
  assert.deepEqual(PLAY_REPLACED_BY, { runner: 'subway' });
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
    for (const key of [rule.where, 'play.locked', 'game.order.title', 'game.order.detail', 'game.subway.title', 'game.subway.detail', 'game.blank.title', 'game.blank.detail', 'game.snap.title', 'game.snap.detail', 'game.board.title', 'game.board.detail', 'play.locked.level', 'game.racing.title', 'game.racing.detail', 'game.rally.title', 'game.rally.detail']) {
      for (const lang of ['ko', 'en', 'mn']) assert.ok(strings[key]?.[lang], `${key}.${lang}`);
    }
  }
  assert.match(strings['play.locked'].ko, /\{where\}/);
});

test('게시판 해독은 TOPIK II 기록으로 열리고, 한 번 본 뒤에는 기록이 떨어져도 닫히지 않는다', () => {
  const base = { summary: { cafe: { completed: 3 }, completed: 9, status: { phase: 'ready' }, packs: [] } };
  assert.deepEqual(playState('board', playRecord(base)), { open: false, where: 'play.locked.level', lockOnly: true });
  assert.deepEqual(playState('board', playRecord(base, { topik2Near: true })), { open: true });
  assert.equal(playState('board', playRecord(base), ['board']).open, true);
  assert.equal(playState('board', playRecord(base), ['order']).open, false);
  assert.equal(playState('board', null).open, false);
  assert.equal(playState('order', playRecord({ summary: { cafe: { completed: 0 }, status: { phase: 'ready' } } }), ['order']).open, false);   // sticky는 표에 적은 놀이만
});
