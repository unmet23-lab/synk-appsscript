// 30일째 문장의 자리 세기(단계 4 계획 §21-7 — 설계 주인 11-15 승인 9 · 13). 순수 함수 lookbackWindows · lookbackOf를 본다.
// 자리의 경계는 기억 모델(memory/index.mjs append)과 같아야 한다 — 임의 줄에서 기억 모델의 만난 자리 수 · 놓친 자리 수와 맞댄다.
// 이 파일은 잎 모듈만 부른다(unit 묶음). 기억 모델과의 대조는 ts-fsrs를 부르므로 properties 묶음(test/properties/lookback.property.test.mjs)에 둔다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';

const { lookbackOf, lookbackWindows } = await subject('memory/lookback.mjs');
const { PARAMS } = await subject('params.mjs');

const DAY = 86_400_000;
const HOUR = 3_600_000;
const MN = 480; // 몽골(UTC+8)
const KR = 540; // 한국(UTC+9)
// 11-16 11:00 현지(몽골) — 학습일 11-16(새벽 4시 경계)
const NOW = Date.UTC(2026, 10, 16, 3, 0);
const local = (at, offset) => new Date(at + offset * 60_000).toISOString().slice(0, 16);

let seq = 0;
const answer = (at, grade) => ({ id: `e${String(++seq).padStart(4, '0')}`, at, grade });
const say = (at, kind) => ({ id: `s${String(++seq).padStart(4, '0')}`, at, say: kind });
const ago = (days, hours = 0) => NOW - days * DAY + hours * HOUR;

// 앞 창에 놓친 자리 셋(같은 자리의 두 번째 놓침은 한 자리), 뒤 창 자리 일곱이 모두 혼자 맞힘.
function student() {
  return [
    answer(ago(33), 'again'),
    answer(ago(33, 1), 'again'),
    answer(ago(32), 'again'),
    answer(ago(31), 'weak'),
    answer(ago(31, 1), 'again'),
    answer(ago(25), 'weak'),
    answer(ago(20), 'weak'),
    answer(ago(14), 'weak'),
    answer(ago(9), 'good'),
    answer(ago(5), 'weak'),
    answer(ago(3), 'weak'),
    answer(ago(1), 'weak'),
  ];
}

test('창 셋은 학습일(기기 새벽 4시 · 지금 시간대)로 센다 — 앞 창은 30일 전 학습일에서 끝나는 7학습일, 뒤 창은 그다음 날부터 지금까지', () => {
  const w = lookbackWindows(NOW, { offset: MN });
  assert.equal(local(w.monthAgo.from, MN), '2026-10-11T04:00');
  assert.equal(local(w.monthAgo.to, MN), '2026-10-18T04:00');
  assert.equal(w.since.from, w.monthAgo.to, '뒤 창은 앞 창이 끝난 바로 그때부터');
  assert.equal(w.since.to, NOW);
  assert.equal(local(w.last7.from, MN), '2026-11-10T04:00', '지난 7학습일은 오늘을 넣은 7학습일');
  // 새벽 4시 전은 어제의 학습일이다.
  const dawn = Date.UTC(2026, 10, 15, 19, 30); // 11-16 03:30 몽골
  assert.equal(local(lookbackWindows(dawn, { offset: MN }).last7.from, MN), '2026-11-09T04:00');
  // 한국 시간대는 경계가 한 시간 다르다(같은 순간이어도 학습일 경계는 그 시간대의 새벽 4시).
  assert.equal(local(lookbackWindows(NOW, { offset: KR }).monthAgo.from, KR), '2026-10-11T04:00');
  assert.throws(() => lookbackWindows(Number.NaN), TypeError);
});

test('네 조건을 모두 넘으면 문장을 말할 수 있다 — 앞 창 놓친 자리 둘 이상 · 뒤 창 자리 셋 이상 · 뒤 창에 again · hard 없음 · 마지막 자리가 지난 7학습일 안', () => {
  const w = lookbackWindows(NOW, { offset: MN });
  const out = lookbackOf(student(), w);
  assert.deepEqual(
    { misses: out.misses, reviews: out.reviews, clean: out.clean, said: out.said, pass: out.pass },
    { misses: 3, reviews: 7, clean: true, said: false, pass: true },
  );
  assert.equal(out.last, ago(1));
});

test('조건마다의 경계 — 하나라도 못 넘으면 말하지 않는다', () => {
  const w = lookbackWindows(NOW, { offset: MN });
  const base = student();
  const since = base.filter(row => row.at >= w.since.from);
  // 앞 창의 놓친 자리 — 하나면 말하지 않고, 둘이면 말한다(하한)
  const one = lookbackOf([answer(ago(33), 'again'), answer(ago(32), 'weak'), ...since], w);
  assert.equal(one.misses, 1);
  assert.equal(one.pass, false);
  const twoMisses = lookbackOf([answer(ago(33), 'again'), answer(ago(32), 'again'), ...since], w);
  assert.equal(twoMisses.misses, 2);
  assert.equal(twoMisses.pass, true);
  // 뒤 창 자리 — 둘이면 말하지 않고, 셋이면 말한다(하한)
  const head = base.filter(row => row.at < w.since.from);
  const two = lookbackOf([...head, answer(ago(3), 'weak'), answer(ago(1), 'weak')], w);
  assert.equal(two.reviews, 2);
  assert.equal(two.pass, false);
  const three = lookbackOf(
    [...head, answer(ago(5), 'weak'), answer(ago(3), 'weak'), answer(ago(1), 'weak')],
    w,
  );
  assert.equal(three.reviews, 3);
  assert.equal(three.pass, true);
  // 뒤 창에 힌트를 보고 맞힌 답(hard) 하나 — 같은 자리에서 혼자 맞힌 뒤라도 줄로 본다(검토 S3)
  const hard = lookbackOf([...base, answer(ago(1, 1), 'hard')], w);
  assert.equal(hard.clean, false);
  assert.equal(hard.reviews, 7, '같은 자리라 자리 수는 그대로');
  assert.equal(hard.pass, false);
  // 뒤 창에 놓침 하나
  assert.equal(lookbackOf([...base, answer(ago(10), 'again')], w).pass, false);
  // 마지막 자리가 지난 7학습일 밖(8일 전이 마지막)
  const stale = lookbackOf(
    base.filter(row => row.at < ago(8)),
    w,
  );
  assert.equal(stale.reviews, 4);
  assert.equal(stale.pass, false);
});

test('자리의 경계는 기억 모델과 같다 — 첫 답에서 6시간, 「이미 알아요」 뒤 첫 답은 새 자리, 「다시 배울래요」는 앞 자리를 비운다', () => {
  const w = lookbackWindows(NOW, { offset: MN });
  // 같은 자리: 첫 답에서 6시간 안(5시간 59분)은 한 자리, 6시간이면 새 자리.
  const inSitting = lookbackOf(
    [answer(ago(2), 'weak'), answer(ago(2) + 6 * HOUR - 60_000, 'weak')],
    w,
  );
  assert.equal(inSitting.reviews, 1);
  const newSitting = lookbackOf(
    [answer(ago(2), 'weak'), answer(ago(2) + PARAMS.sittingHours * HOUR, 'weak')],
    w,
  );
  assert.equal(newSitting.reviews, 2);
  // 창 직전에 열린 자리에 이어진 답은 새 자리가 아니다 — 앞 창 끝 3시간 전에 연 자리의 1시간 뒤 답(뒤 창 안)은 뒤 창 자리로 세지 않는다.
  const edge = w.monthAgo.to;
  const carried = lookbackOf(
    [
      answer(edge - 3 * HOUR, 'again'),
      answer(edge + HOUR, 'weak'),
      answer(ago(9), 'weak'),
      answer(ago(5), 'weak'),
      answer(ago(1), 'weak'),
    ],
    w,
  );
  assert.equal(carried.reviews, 3, '창 직전 자리에 이어진 답은 앞 창의 자리다');
  assert.equal(carried.misses, 1);
  // 「이미 알아요」 뒤 첫 답은 새 자리를 연다(6시간 안이어도).
  const known = lookbackOf(
    [answer(ago(2), 'weak'), say(ago(2, 1), 'known'), answer(ago(2, 2), 'weak')],
    w,
  );
  assert.equal(known.reviews, 2);
  assert.equal(known.said, true, '앞 창이 끝난 뒤 본인 말');
  assert.equal(known.pass, false);
  // 앞 창 안의 「다시 배울래요」는 그 앞의 자리를 비운다 — 본인이 비운 기록을 문장이 다시 꺼내지 않는다(검토 S4).
  const relearn = lookbackOf([...student(), say(ago(31, 2), 'relearn')], w);
  assert.equal(relearn.misses, 0);
  assert.equal(relearn.said, false, '앞 창 안의 본인 말은 고르기를 막지 않는다(비운 것만 빠진다)');
  assert.equal(relearn.pass, false);
  // 앞 창이 끝난 뒤의 「다시 배울래요」 · 「이미 알아요」는 고르지 않는다.
  assert.equal(lookbackOf([...student(), say(ago(20, 1), 'relearn')], w).pass, false);
  const knownAfter = lookbackOf([...student(), say(ago(20, 1), 'known')], w);
  assert.equal(knownAfter.said, true);
  // 「이미 알아요」는 수를 바꾸지 않는다(뒤 자리가 6시간 넘게 떨어져 있다) — 그래도 고르지 않는다.
  assert.deepEqual(
    [knownAfter.misses, knownAfter.reviews, knownAfter.clean, knownAfter.pass],
    [3, 7, true, false],
  );
});

test('지금 뒤의 줄(시계가 앞선 기기)과 판정 못 한 줄은 세지 않는다 · 줄 차례를 타지 않는다', () => {
  const w = lookbackWindows(NOW, { offset: MN });
  const rows = student();
  const future = lookbackOf([...rows, answer(NOW + HOUR, 'again')], w);
  assert.equal(future.pass, true, '지금 뒤의 놓침은 세지 않는다');
  // 지금 뒤의 본인 말도 세지 않는다 — 세면 「다시 배울래요」가 자리를 비우고 「이미 알아요」가 고르기를 막는다.
  assert.equal(
    lookbackOf([...rows, say(NOW + HOUR, 'known')], w).pass,
    true,
    '지금 뒤의 「이미 알아요」',
  );
  assert.equal(
    lookbackOf([...rows, say(NOW + HOUR, 'relearn')], w).pass,
    true,
    '지금 뒤의 「다시 배울래요」',
  );
  const odd = lookbackOf(
    [...rows, { id: 'x1', at: ago(2), grade: null }, { id: 'x2', at: Number.NaN, grade: 'again' }],
    w,
  );
  assert.equal(odd.pass, true);
  const shuffled = [...rows].reverse();
  assert.deepEqual(lookbackOf(shuffled, w), lookbackOf(rows, w), '줄 차례와 상관없다');
  assert.deepEqual(lookbackOf([], w), {
    misses: 0,
    reviews: 0,
    last: null,
    clean: true,
    said: false,
    pass: false,
  });
});
