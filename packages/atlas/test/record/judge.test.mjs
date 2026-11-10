// 측정 계약(설계 §5-2) — atlas/trail.js의 judge를 옮긴 것과 그 시험(tests/atlas-trail.test.js의 판정 사례).
// 「처음 본 계열 + 도움 없음 + 소리 전달 확인 + 제외 없음」인 첫 답만 독립 근거다. 달라진 것: 판정 unknown도 판정된 답이다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';

const { judge, assessable } = await subject('record/judge.mjs');

const p = (fields = {}) => ({
  firstExposure: true,
  measure: { confounded: false, audioRequired: false },
  ...fields,
});
const none = () => false;
const only = kinds => wanted => wanted.some(kind => kinds.includes(kind));

test('독립 근거는 확인된 첫 만남에서만 — 본 적 있거나 이력을 모르면 세지 않는다', () => {
  const fresh = judge({ verdict: 'correct' }, p(), none, 'pending');
  assert.deepEqual([fresh.assisted, fresh.exposure, fresh.independent], [false, 'new', true]);
  const seen = judge({ verdict: 'correct' }, p({ firstExposure: false }), none, 'pending');
  assert.deepEqual([seen.assisted, seen.exposure, seen.independent], [null, 'repeat', false]);
  const unknown = judge({ verdict: 'correct' }, p({ firstExposure: null }), none, 'pending');
  assert.deepEqual(
    [unknown.assisted, unknown.exposure, unknown.independent],
    [null, 'unknown', false],
  );
});

test('힌트 · 해설 · 답 보기는 도움이고, 답 보기만 「다시 만남」이다', () => {
  for (const [kinds, exposure] of [
    [['help'], 'new'],
    [['answer'], 'repeat'],
  ]) {
    const result = judge({ verdict: 'correct' }, p(), only(kinds), 'pending');
    assert.equal(result.assisted, true);
    assert.equal(result.exposure, exposure);
    assert.equal(result.independent, false);
  }
  const again = judge({ verdict: 'correct' }, p(), only(['attempt']), 'pending');
  assert.deepEqual([again.assisted, again.exposure, again.independent], [false, 'repeat', false]);
});

test('소리가 필요한 문항은 전달이 확인된 답만 — 보내지 못함 · 확인 전은 소리 사유로 뺀다', () => {
  const audio = p({ measure: { confounded: false, audioRequired: true } });
  for (const [delivery, independent] of [
    ['completed', true],
    ['pending', false],
    ['failed', false],
  ]) {
    const result = judge({ verdict: 'incorrect' }, audio, none, delivery);
    assert.equal(result.independent, independent);
    assert.equal(result.exclusionReason, independent ? null : 'audio');
    assert.equal(assessable({ verdict: 'incorrect' }, audio, delivery), independent);
  }
});

test('화면이 답을 가린 문항(confounded)과 답 사유(저장 실패 포함)는 근거가 아니다', () => {
  const hidden = judge(
    { verdict: 'correct' },
    p({ measure: { confounded: true, audioRequired: false } }),
    none,
    'completed',
  );
  assert.deepEqual([hidden.exclusionReason, hidden.independent], ['visual', false]);
  for (const reason of ['motor', 'audio', 'unanswered', 'demo', 'visual', 'storage']) {
    const result = judge({ verdict: 'correct', reason }, p(), none, 'completed');
    assert.deepEqual([result.exclusionReason, result.independent], [reason, false]);
    assert.equal(assessable({ verdict: 'correct', reason }, p(), 'completed'), false);
  }
});

test('판정된 답만 — correct · incorrect · unknown(모르겠어요)은 판정, 채점 안 함 · 건너뜀은 아니다', () => {
  for (const [verdict, independent] of [
    ['correct', true],
    ['incorrect', true],
    ['unknown', true],
    ['unassessed', false],
    ['skipped', false],
  ]) {
    assert.equal(judge({ verdict }, p(), none, 'pending').independent, independent, verdict);
    assert.equal(assessable({ verdict }, p(), 'pending'), independent, verdict);
  }
});

test('측정 꼴이 없는 옛 제시는 전달 · 가림을 묻지 않는다', () => {
  const result = judge(
    { verdict: 'correct' },
    { firstExposure: true, measure: null },
    none,
    'pending',
  );
  assert.equal(result.usableDelivery, true);
  assert.equal(result.independent, true);
});
