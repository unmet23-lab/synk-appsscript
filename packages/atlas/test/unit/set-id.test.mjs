// 판 번호 짓기 · 읽기(coach/set-id.mjs — 단계 4 계획 §21-23의 2, 설계 주인 11-17 답 1). 지은 번호를 다시 읽으면 같은 게임 이름이고,
// 꼴이 틀린 번호와 빈 값은 null이다. 뒤 세 마디를 꼴 검사 없이 떼면 꼴이 틀린 번호에서 게임 이름이 선다(변형 — tools/mutants/coach.mjs).
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';

const { coachTag, gameOfSet, isGameId, setIdOf } = await subject('coach/set-id.mjs');

test('지은 판 번호를 다시 읽으면 같은 게임 이름이다 — 점과 줄표가 든 이름(world-mock.x · world-mock2)도', () => {
  const games = [
    'world-mock',
    'world-mock.x',
    'world-mock2',
    'atlas',
    'a.b.c',
    'x_y:z',
    'world-mock.1763000000000',
  ];
  for (const game of games)
    for (const seq of [1, 2, 37]) {
      const tag = coachTag();
      assert.match(tag, /^[a-z0-9]{6}$/, '코치 꼬리는 소문자와 숫자 6자');
      assert.equal(gameOfSet(setIdOf(game, 1_763_000_000_000, tag, seq)), game, `${game} ${seq}`);
    }
  assert.equal(
    gameOfSet(setIdOf('world-mock', 0, '123456', 1)),
    'world-mock',
    '숫자만인 꼬리 · 시각 0',
  );
  assert.equal(gameOfSet(setIdOf('world-mock2', 5, 'abcdef', 1)), 'world-mock2');
  assert.equal(gameOfSet(setIdOf('world-mock.x', 5, 'abcdef', 1)), 'world-mock.x');
  // 꼬리를 정하는 난수 — 0과 1 바로 밑에서도 꼴 안이다
  assert.equal(
    coachTag(() => 0),
    'aaaaaa',
  );
  assert.equal(
    coachTag(() => 0.999999),
    '999999',
  );
});

test('꼴이 틀린 판 번호 · 빈 값은 null이다 — 뒤 세 마디를 꼴 검사 없이 떼지 않는다', () => {
  const bad = [
    undefined,
    null,
    '',
    1,
    {},
    ['set.world-mock.1.abcdef.1'],
    'set.world-mock', // 마디가 모자람
    'set.world-mock.1.abcdef', // 차례가 없음
    'set.1.abcdef.1', // 게임 이름이 없음
    'set.world-mock.x.y.z', // 뒤 세 마디가 꼴이 아님
    'set.world-mock.1.ABCDEF.1', // 꼬리는 소문자
    'set.world-mock.1.abcde.1', // 꼬리는 6자
    'set.world-mock.1.abcdefg.1',
    'set.world-mock.01.abcdef.1', // 시각 앞의 0
    'set.world-mock.1.abcdef.0', // 차례는 1부터
    'set.world-mock.1.abcdef.01',
    'set.world-mock.1.abcdef.1.', // 끝 점
    'set..1.abcdef.1', // 빈 게임 이름
    'set.world..mock.1.abcdef.1', // 빈 마디
    'set.world mock.1.abcdef.1', // 빈칸
    'set.world/mock.1.abcdef.1',
    'sets.world-mock.1.abcdef.1',
    'world-mock.1.abcdef.1',
    'set.world-mock.-1.abcdef.1',
    'set.world-mock.1.5.abcdef', // 차례 자리에 꼬리
    ` set.world-mock.1.abcdef.1`,
    `set.${'g'.repeat(90)}.1.abcdef.1`, // 게임 이름이 80자를 넘는다
    `set.${'g'.repeat(120)}.1.abcdef.1`, // 사건 번호 한도(120자)를 넘는다
  ];
  for (const value of bad) assert.equal(gameOfSet(value), null, JSON.stringify(value));
});

test('게임 이름의 꼴 — 점으로 이은 마디(사건 번호 글자), 빈 마디 · 빈칸 · 80자 넘는 이름은 아니다', () => {
  for (const ok of ['world-mock', 'world-mock.x', 'world-mock2', 'a', 'A_1:b-2', 'g'.repeat(80)])
    assert.equal(isGameId(ok), true, ok);
  for (const no of [
    '',
    '.a',
    'a.',
    'a..b',
    'a b',
    'a/b',
    'é',
    1,
    null,
    undefined,
    {},
    'g'.repeat(81),
  ])
    assert.equal(isGameId(no), false, JSON.stringify(no));
});
