import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, makePerson, makeEvent } from '../model.mjs';
import { prepareCare } from '../care-planner.mjs';

const now = '2026-10-06T03:00:00Z';
function fixture(type = 'wedding', overrides = {}) {
  return { ...emptyState(), people: [makePerson({ id: 'p', name: '친구', notes: '비싼 선물을 좋아할 것 같음: 미확인 메모' })], events: [makeEvent({ id: 'e', personId: 'p', type, date: '2026-10-07', ...overrides })] };
}
const plan = (input = {}, state = fixture()) => prepareCare({ state, personId: 'p', eventId: 'e', now, ...input });

test('Core 선언 근거로 참석·준비시간·예산 조건을 적용하고 원본을 바꾸지 않는다', () => {
  const state = fixture(), before = JSON.stringify(state);
  const result = plan({ attendance: 'attend', timeMinutes: 15, budgetWon: 20000 }, state);
  assert.equal(result.recommendation.action, 'attend');
  assert.equal(result.engines.core, 'core-domain-1');
  assert.equal(result.engines.ask, 'ask-1.1');
  assert.equal(result.decision.calibrated, false);
  assert.equal(result.decision.selected.reasons.find(item => item.field === 'timeMinutes').value, 15);
  assert.equal(result.decision.selected.reasons.find(item => item.field === 'attendance').value, 'attend');
  assert.match(result.recommendation.reason.join(' '), /이동·참석/);
  assert.equal(result.occurrenceId, 'e:2026-10-07');
  assert.equal(JSON.stringify(state), before);
});

test('Ask는 결정이 달라지는 질문만 순서대로 제시하고 제약에 무관한 질문을 생략한다', () => {
  const initial = plan();
  assert.equal(initial.status, 'needs-input');
  assert.equal(initial.question.field, 'timeMinutes');
  assert.equal(initial.recommendation.action, 'remember');
  assert.deepEqual(initial.decision.snapshot.observations, []); // 누락한 예산·시간·참석을 가짜 선언으로 채우지 않는다.
  assert.equal(plan({ timeMinutes: 15 }).question.field, 'attendance');
  const short = plan({ timeMinutes: 3 });
  assert.equal(short.recommendation.action, 'contact');
  assert.equal(short.question, null); // 참석·선물은 지금 3분 조건을 통과하지 못하므로 묻지 않는다.
  assert.equal(plan({ timeMinutes: 15, attendance: 'attend' }).question, null); // 예산 답이 참석 준비를 바꾸지 않음.
  assert.equal(plan({ timeMinutes: 15, attendance: 'not-attend' }).question.field, 'budgetWon');
});

test('Core 시간 상한을 넘거나 참석 불가인 준비를 반환하지 않는다', () => {
  const short = plan({ attendance: 'attend', timeMinutes: 2, budgetWon: 100000 });
  assert.equal(short.recommendation.action, 'remember');
  assert.ok(short.decision.excluded.some(item => item.id === 'attend' && item.reasons.includes('constraint:within-preparation-time')));
  assert.deepEqual(short.alternatives, []);
  const unable = plan({ attendance: 'not-attend', timeMinutes: 60, budgetWon: 0 });
  assert.equal(unable.recommendation.action, 'contact');
  assert.ok(!unable.alternatives.some(item => item.action === 'attend' || item.action === 'gift'));
});

test('선물은 사용자가 정한 예산만 쓰고 물가나 선호를 추정하지 않는다', () => {
  const result = plan({ attendance: 'not-attend', timeMinutes: 15, budgetWon: 12345 }, fixture('birthday'));
  assert.equal(result.recommendation.action, 'gift');
  assert.equal(result.recommendation.amountWon, 12345);
  assert.match(result.recommendation.reason.join(' '), /내 예산/);
  assert.match(result.recommendation.steps.join(' '), /12,345/);
  assert.ok(!JSON.stringify(result).includes('비싼 선물'));
  const withoutBudget = plan({ timeMinutes: 15 }, fixture('birthday'));
  assert.equal(withoutBudget.recommendation.action, 'contact');
  assert.equal(withoutBudget.recommendation.amountWon, null);
  assert.equal(withoutBudget.question.field, 'budgetWon');
});

test('부고·기일은 선물이나 예산 질문을 제안하지 않고 연락에 답장 압박을 줄인다', () => {
  for (const type of ['condolence', 'memorial']) {
    const result = plan({ attendance: 'not-attend', timeMinutes: 30, budgetWon: 100000 }, fixture(type));
    assert.equal(result.recommendation.action, 'contact');
    assert.ok(!result.alternatives.some(item => item.action === 'gift'));
    assert.ok(!result.questions.some(item => item.field === 'budgetWon'));
    assert.match(result.recommendation.steps.join(' '), /재촉/);
  }
});

test('지난 일회성 행사는 참석 준비를 제안하거나 새 회차를 만들지 않는다', () => {
  const result = plan({ attendance: 'attend', timeMinutes: 30, budgetWon: 0 }, fixture('wedding', { date: '2026-10-05' }));
  assert.equal(result.occurrenceId, null);
  assert.equal(result.recommendation.action, 'contact');
  assert.ok(!result.alternatives.some(item => item.action === 'attend'));
  assert.ok(!result.questions.some(item => item.field === 'attendance'));
});

test('잘못된 조건·사람과 일정 연결·4MiB 초과 상태는 추천 전에 거부한다', () => {
  for (const input of [{ timeMinutes: -1 }, { timeMinutes: 1441 }, { timeMinutes: 0.5 }, { timeMinutes: '15' }, { budgetWon: 1000000001 }, { budgetWon: 0.1 }, { attendance: 'maybe' }, { now: 'invalid' }]) assert.throws(() => plan(input));
  assert.throws(() => prepareCare({ state: fixture(), personId: 'missing', eventId: 'e', now }));
  const state = fixture(); state.events[0].personId = 'other';
  assert.throws(() => plan({}, state));
  assert.throws(() => plan({}, { ...fixture(), sources: Array.from({ length: 100 }, (_, index) => ({ id: `s_${index}`, personId: 'p', title: '보관한 원문', text: '가'.repeat(50000), kind: 'text', createdAt: now })) }));
});
