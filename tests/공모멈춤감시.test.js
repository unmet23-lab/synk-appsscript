'use strict';
// 공모 마감 직전 멈춘 작업 감시 시험(2026-11-20, 유호님 「다섯 개 다 해」 가운데 첫째).
const test = require('node:test');
const assert = require('node:assert');
const 감시 = require('../tools/공모멈춤감시.js');

const A = 'local_aaaaaaaa-0000-0000-0000-000000000001';
const B = 'local_bbbbbbbb-0000-0000-0000-000000000002';
const 현황 = { items: [
  { id: '1', name: '가 공모', stage: '준비 중', deadline: '2026-11-21T23:59', owner_session: A },
  { id: '2', name: '나 공모', stage: '제작 중', deadline: '2026-11-21T09:00', owner_session: [B] },
  { id: '3', name: '다 공모', stage: '준비 중', deadline: '2026-11-30T23:59', owner_session: A },
  { id: '4', name: '라 공모', stage: '결과 기다림', deadline: '2026-11-21T23:59' },
  { id: '5', name: '마 공모', stage: '준비 중', deadline: '2026-11-21T06:00' },
] };
const 지금 = new Date('2026-11-20T21:00:00+09:00');

test('마감 시각은 시간대가 없으면 한국 시각, 날짜만 있으면 그날 23:59다', () => {
  assert.strictEqual(감시.마감시각('2026-11-23T23:59'), Date.parse('2026-11-23T23:59+09:00'));
  assert.strictEqual(감시.마감시각('2026-11-30'), Date.parse('2026-11-30T23:59+09:00'));
  assert.ok(Number.isNaN(감시.마감시각('미정')));
});

test('준비 중 · 제작 중이고 48시간 안쪽인 공고만 보고, 12시간 안쪽은 문턱이 60분이다', () => {
  const 볼 = 감시.볼것(현황, 지금);
  assert.deepStrictEqual(볼.map(x => x.이름), ['마 공모', '나 공모', '가 공모']);
  assert.strictEqual(볼.find(x => x.이름 === '나 공모').문턱분, 60);
  assert.strictEqual(볼.find(x => x.이름 === '가 공모').문턱분, 120);
});

test('쉬는 세션의 끝글이 문턱 넘게 그대로면 깨우고, 깨운 뒤에는 문턱 동안 다시 깨우지 않는다', () => {
  const 볼 = 감시.볼것(현황, 지금);
  const 상태 = { sessions: {} };
  const 본 = [{ session_id: B, 상태: 'idle', 끝글: '굽기를 걸었다. 받으면 확인한다.', 판단: '멈춤' }];
  assert.strictEqual(감시.판정(상태, 본, 볼, 지금)[0].할일, '기다리기', '처음 본 글은 잰다');
  const 한시간뒤 = new Date(+지금 + 61 * 6e4);
  assert.strictEqual(감시.판정(상태, 본, 볼, 한시간뒤)[0].할일, '깨우기');
  상태.sessions[B].깨운때 = 한시간뒤.toISOString();
  assert.strictEqual(감시.판정(상태, 본, 볼, new Date(+한시간뒤 + 30 * 6e4))[0].할일, '기다리기');
  // 글이 바뀌면 다시 잰다.
  const 바뀜 = [{ ...본[0], 끝글: '받았다. 다음 컷을 굽는다.' }];
  assert.strictEqual(감시.판정(상태, 바뀜, 볼, new Date(+한시간뒤 + 90 * 6e4))[0].할일, '기다리기');
});

test('유호님 답을 기다리면 알리고, 일하는 중이면 기다린다', () => {
  const 볼 = 감시.볼것(현황, 지금);
  const 상태 = { sessions: {} };
  const 본 = [{ session_id: A, 상태: 'idle', 끝글: '제출 단추 앞입니다. 내도 될까요?', 판단: '답기다림' }];
  감시.판정(상태, 본, 볼, 지금);
  const r = 감시.판정(상태, 본, 볼, new Date(+지금 + 121 * 6e4));
  assert.strictEqual(r[0].할일, '알리기');
  assert.deepStrictEqual(r[0].공고, ['가 공모'], '48시간 밖 공고는 넣지 않는다');
  const 일함 = 감시.판정({ sessions: {} }, [{ session_id: A, 상태: 'running', 끝글: 'x', 판단: '일함' }], 볼, 지금);
  assert.strictEqual(일함[0].할일, '기다리기');
});

test('주인 세션이 없고 24시간 안쪽이면 알린다', () => {
  const 볼 = 감시.볼것(현황, 지금);
  const r = 감시.판정({ sessions: {} }, [], 볼, 지금);
  assert.deepStrictEqual(r.map(x => [x.할일, x.공고[0]]), [['알리기', '마 공모']]);
});
