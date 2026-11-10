// ts-fsrs를 부르는 유일한 자리(src/memory/fsrs.mjs): 판 5.4.2에 묶이고, 08-22에 정한 값으로 일정기를 만든다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';

const fsrs = await subject('memory/fsrs.mjs');

test('ts-fsrs 판은 5.4.2(FSRS-6)이다', () => {
  assert.equal(fsrs.FSRS_VERSION, '5.4.2');
});

test('정해진 값: 목표 보유율 0.9 · 최대 간격 60일 · 흔들기 없음', () => {
  assert.deepEqual(
    { ...fsrs.FSRS_SETTINGS },
    {
      request_retention: 0.9,
      maximum_interval: 60,
      enable_fuzz: false,
    },
  );
  const scheduler = fsrs.createFsrs();
  assert.equal(scheduler.parameters.request_retention, 0.9);
  assert.equal(scheduler.parameters.maximum_interval, 60);
  assert.equal(scheduler.parameters.enable_fuzz, false);
  assert.equal(scheduler.parameters.w.length, 21, 'FSRS-6 기본 매개변수 21개');
  assert.equal(typeof scheduler.next_state, 'function', '시제품이 쓰는 기억 계산');
});
