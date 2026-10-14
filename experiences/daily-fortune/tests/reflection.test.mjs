import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, recentReflections } from '../account-state.mjs';
import { seoulDateKey } from '../core.mjs';

const entry = (date, number, values = {}) => ({
  id: `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
  mode: 'western', date, signId: 'aries', birth: null, title: '저장한 제목',
  action: '저장한 작은 행동', note: '저장한 메모', completed: false, verdict: null,
  createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-08T00:00:00.000Z', ...values,
});
const state = entries => ({ ...emptyState(), entries });

test('최근 7일은 오늘부터 6일 전까지이며 수정 시각이 최근인 옛 기록과 미래 운세는 제외한다', () => {
  const records = state([
    entry('2026-10-08', 1), entry('2026-10-02', 2), entry('2026-10-01', 3), entry('2026-10-09', 4),
  ]);
  const recent = recentReflections(records, '2026-10-08');
  assert.equal(recent.startDate, '2026-10-02');assert.equal(recent.endDate, '2026-10-08');
  assert.deepEqual(recent.days.map(day => day.date), ['2026-10-08', '2026-10-07', '2026-10-06', '2026-10-05', '2026-10-04', '2026-10-03', '2026-10-02']);
  assert.deepEqual(recent.days.flatMap(day => day.entries.map(value => value.id)), [records.entries[0].id, records.entries[1].id]);
});

test('메모 또는 실천 완료가 있는 실제 저장본만 모으고 공백 메모·미완료 제안은 제외한다', () => {
  const records = state([entry('2026-10-08', 1, { note: '  줄바꿈\n원문 <script>그대로</script>  ' }),
    entry('2026-10-08', 2, { note: '', completed: true }), entry('2026-10-08', 3, { note: ' \n ' })]);
  const recent = recentReflections(records, '2026-10-08');
  assert.equal(recent.days[0].entries.length, 2);assert.equal(recent.days[0].entries[0].note, records.entries[0].note);
  assert.equal(recent.days[0].entries[1].action, records.entries[1].action);
  recent.days[0].entries[0].note = '보기에서 변경';assert.notEqual(records.entries[0].note, '보기에서 변경');
});

test('서로 다른 별자리와 사주 기록을 같은 날에 함께 보존하고 저장본 최신 수정 순서로 보여 준다', () => {
  const records = state([entry('2026-10-08', 1), entry('2026-10-08', 2, {
    mode: 'korean', signId: null, birth: { birthDate: '2000-01-01', birthTime: null, calendar: 'solar', timeZone: 'Asia/Seoul' },
    updatedAt: '2026-10-08T01:00:00.000Z',
  })]);
  const copy = structuredClone(records), recent = recentReflections(records, '2026-10-08');
  assert.deepEqual(recent.days[0].entries.map(value => value.mode), ['korean', 'western']);
  assert.deepEqual(records, copy);assert.deepEqual(recentReflections(emptyState(), '2026-10-08').days.map(day => day.entries), Array.from({ length: 7 }, () => []));
});

for (const [today, start] of [['2027-01-03', '2026-12-28'], ['2024-03-02', '2024-02-25'], ['2026-10-03', '2026-09-27']]) {
  test(`최근 7일이 연말·윤일·월말 경계를 넘는다: ${today}`, () => {
    const recent = recentReflections(emptyState(), today);
    assert.equal(recent.startDate, start);assert.equal(new Set(recent.days.map(day => day.date)).size, 7);
    if (today === '2024-03-02') assert.ok(recent.days.some(day => day.date === '2024-02-29'));
  });
}

test('한국 자정에 하루가 바뀌면 가장 오래된 날을 빼고 새 오늘을 포함한다', () => {
  const records = state([entry('2026-10-02', 1), entry('2026-10-09', 2)]);
  const before = recentReflections(records, seoulDateKey('2026-10-08T14:59:59.999Z'));
  const after = recentReflections(records, seoulDateKey('2026-10-08T15:00:00.000Z'));
  assert.equal(before.days[6].entries[0].id, records.entries[0].id);
  assert.equal(after.days[0].entries[0].id, records.entries[1].id);
  assert.equal(after.startDate, '2026-10-03');
});

test('날짜와 저장 형식이 잘못되면 정상적인 회고로 꾸며 내지 않는다', () => {
  assert.throws(() => recentReflections(emptyState(), '2026-02-30'));
  assert.throws(() => recentReflections(state([entry('2026-10-08', 1, { completed: 'true' })]), '2026-10-08'));
});
