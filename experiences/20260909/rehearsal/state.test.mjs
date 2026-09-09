import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, updateField, advance, goToStep, parseState, makeExport, textExport, STEP_FIELDS, FIELD_LIMIT } from './state.mjs';

function complete() {
  let state = advance(createState('2026-09-09T00:00:00.000Z')).state;
  for (let step = 1; step <= 4; step++) {
    for (const key of STEP_FIELDS[step]) state = updateField(state, key, `${key}의 실제 입력 원문\n두 번째 줄`);
    state = advance(state).state;
  }
  return state;
}
test('공백만 있는 질문은 다음 단계로 가지 않는다', () => {
  const state = updateField(advance(createState()).state, 'askGoal', ' \n\t ');
  const result = advance(state);
  assert.equal(result.state.step, 1);
  assert.equal(result.missing.length, 3);
});
test('처음부터 검토 화면으로 건너뛸 수 없다', () => {
  assert.equal(goToStep(createState(), 5).step, 0);
});
test('전체 흐름과 내보내기/다시 열기는 입력 원문과 강사 메모를 보존한다', () => {
  const state = updateField(complete(), 'mentorEvidence', '<script>가 아니라 실제 질문의 근거</script>');
  const restored = parseState(JSON.stringify(makeExport(state)));
  assert.deepEqual(restored, state);
  assert.equal(restored.history.length, 4);
  assert.equal(restored.completed, true);
  assert.match(textExport(restored), /<script>가 아니라 실제 질문의 근거<\/script>/);
  assert.equal(Object.hasOwn(restored, 'score'), false);
});
test('첫 제안을 수정해도 최초 제출 원문을 덮어쓰지 않는다', () => {
  let state = goToStep(complete(), 2);
  const original = state.fields.initialProposal;
  state = updateField(state, 'initialProposal', '다시 생각해서 쓴 두 번째 초안');
  state = advance(state).state;
  const drafts = state.history.filter(item => item.step === 2);
  assert.equal(drafts.length, 2);
  assert.equal(drafts[0].fields.initialProposal, original);
  assert.equal(drafts[1].fields.initialProposal, '다시 생각해서 쓴 두 번째 초안');
});
test('이미 마친 질문을 비우면 다시 마침을 주장하지 않고 다음 이동도 막는다', () => {
  const state = updateField(goToStep(complete(), 1), 'askGoal', '');
  assert.equal(state.completed, false);
  assert.equal(goToStep(state, 5).step, 1);
  assert.deepEqual(parseState(JSON.stringify(state)), state);
});
test('잘못된 저장 파일과 과도한 입력을 거부한다', () => {
  assert.throws(() => parseState('{}'));
  assert.throws(() => parseState('{broken'));
  assert.throws(() => parseState(JSON.stringify({ ...createState(), scenarioId: 'other' })));
  assert.throws(() => parseState(JSON.stringify({ ...complete(), fields: {} })));
  assert.throws(() => updateField(createState(), 'askGoal', '가'.repeat(FIELD_LIMIT + 1)));
  assert.throws(() => updateField(createState(), '__proto__', 'x'));
});
