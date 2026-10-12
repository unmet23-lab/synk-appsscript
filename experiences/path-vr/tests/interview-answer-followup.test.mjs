import test from 'node:test';
import assert from 'node:assert/strict';
import { FOLLOWUP_CATALOG, planAnswerFollowup } from '../interview/film/answer-followup.mjs';

test('simultaneous care expressed with 면서 stays a past experience instead of a hypothetical', () => {
  const answer = '저는 가족을 돌보면서 식사와 이동을 도왔습니다. 이상이 있으면 가족과 담당자에게 전달했습니다.';
  const result = planAnswerFollowup(answer);
  assert.equal(result.id, 'experience');
  assert.equal(result.evidence.polarity, 'affirmed');
  assert.equal(planAnswerFollowup('제가 가족을 돌보면 식사와 이동을 돕겠습니다.').id, 'plan');
});

const allClips = Object.values(FOLLOWUP_CATALOG).map((entry) => entry.clip);
const allReady = (text) => planAnswerFollowup(text, { availableClipIds: allClips });
function exactEvidence(text, result) {
  assert.equal(result.kind, 'usable');
  assert.equal(text.slice(result.evidence.start, result.evidence.end), result.evidence.quote);
  assert.ok(result.evidence.quote.length > 0);
  assert.equal(result.question, FOLLOWUP_CATALOG[result.id].question);
  assert.equal(result.clip, FOLLOWUP_CATALOG[result.id].clip);
}

test('new spoken lines never become playable without explicit verified availability', () => {
  const text = '할머니 식사를 도와드렸습니다.';
  const result = planAnswerFollowup(text);
  assert.equal(result.id, 'experience'); assert.equal(result.desiredId, 'meal'); assert.equal(result.fallback, true);
  assert.equal(allReady(text).id, 'meal');
  assert.equal(planAnswerFollowup(text, { availableClipIds: [] }).reason, 'media');
  assert.equal(planAnswerFollowup(text, { availableClipIds: ['strict-followup-plan'] }).reason, 'media', 'do not replace supported past experience with a different assumed question');
  exactEvidence(text, result);
});

test('default output uses only the original actual spoken questions for every prepared topic', () => {
  for (const text of [
    '할머니 식사를 도와드렸습니다.', '어르신 이동을 부축했습니다.', '어르신이 목욕을 거부하면 먼저 이유를 묻겠습니다.',
    '집에서 아버지를 돌봤습니다.', '상태를 확인해서 동료에게 보고했습니다.', '자격증 공부를 하고 있습니다.',
    '식사 보조를 했고 식사량이 늘었습니다.',
  ]) {
    const result = planAnswerFollowup(text);
    assert.ok(['experience', 'plan'].includes(result.id), text);
    exactEvidence(text, result);
  }
});

test('specific topics select matching fixed spoken lines when their exact media exists', () => {
  for (const [text, id] of [
    ['식사 보조를 했습니다.', 'meal'], ['어르신 이동을 부축했습니다.', 'mobility'],
    ['어르신이 목욕을 거부하면 먼저 이유를 묻겠습니다.', 'refusal'], ['집에서 아버지를 돌봤습니다.', 'family'],
    ['어르신 상태를 동료에게 보고했습니다.', 'handoff'], ['자격증 공부를 하고 있습니다.', 'learning'],
    ['식사 보조를 했고 식사량이 늘었습니다.', 'evidence'], ['동료가 어르신 식사를 도왔습니다.', 'role'],
  ]) {
    const result = allReady(text); assert.equal(result.id, id, text); exactEvidence(text, result);
  }
});

test('result verification requires an affirmed personal action, not a hoped-for outcome', () => {
  for (const text of ['할머니 식사를 도왔습니다. 식사량이 늘었습니다.', '식사를 준비했고 그래서 식사량이 늘었습니다.']) {
    const result = allReady(text); assert.equal(result.id, 'evidence', text); assert.match(result.evidence.quote, /식사량/); exactEvidence(text, result);
  }
  for (const text of ['식사 보조를 하면 식사량이 늘었을 겁니다.', '동료가 식사를 도왔습니다. 식사량이 늘었습니다.', '식사량이 늘었습니다.']) {
    assert.notEqual(allReady(text).id, 'evidence', text);
  }
  const fallback = planAnswerFollowup('할머니 식사를 도왔습니다. 식사량이 늘었습니다.');
  assert.equal(fallback.id, 'experience'); assert.match(fallback.evidence.quote, /도왔/);
});

test('local negation does not erase a separate affirmed family or care experience', () => {
  for (const text of [
    '요양원 경험은 없지만 집에서 할머니 식사를 도와드렸습니다.',
    '시설경험은없지만집에서할머니식사를도왔습니다.',
    '시설 경험은 없는데 집에서 할머니 식사를 도왔습니다.',
    '근무한 적은 없습니다. 할머니를 돌봤습니다.',
    '제가 식사를 도왔지만 시설 경험은 없습니다.',
    '저는 할머니 식사를 도왔습니다. 요양원 경험은 없습니다.',
  ]) {
    const result = planAnswerFollowup(text);
    assert.equal(result.id, 'experience', text); assert.equal(result.category, 'experience');
    assert.equal(result.evidence.polarity, 'affirmed'); assert.equal(result.negatedExperience, false);
    assert.doesNotMatch(result.evidence.quote, /없/); exactEvidence(text, result);
  }
});

test('ordinary, spaced, and past-action negations never claim personal experience', () => {
  for (const text of [
    '경험이 없습니다.', '돌봤던 경험이 없습니다. 교육을 받고 준비하겠습니다.',
    '할머니를 돌본 적이 없습니다.', '봉사 경험 이 없 습니다 배우고 싶습니다.',
    '제가 할머니를 돌본 건 아닙니다.', '제가 할머니를 돌봤다고 할 수는 없습니다.',
    '저는 식사 보조를 하지 않았습니다.', '할머니를 안 돌봤습니다.',
    '제가 할머니를 돌봤던 것은 아닙니다.',
  ]) {
    const result = planAnswerFollowup(text);
    assert.equal(result.id, 'plan', text); assert.equal(result.ruleId, 'no-experience', text);
    assert.equal(result.evidence.polarity, 'negated'); exactEvidence(text, result);
    assert.ok(!['meal', 'family', 'experience', 'evidence'].includes(allReady(text).id), text);
  }
});

test('hypothetical and future actions are never treated as past personal care', () => {
  for (const text of [
    '할머니를 돌봤다면 먼저 상태를 확인했을 겁니다.',
    '제가 할머니를 돌봤으면 보람 있었을 겁니다.',
    '제가 할머니를 돌본다면 보람 있을 것 같습니다.',
    '만약 식사 보조를 했다면 식사량을 확인했을 겁니다.',
    '할머니를 돌보고 싶습니다.', '어르신 식사를 돕겠습니다.',
    '돌봤더라면 상태를 확인했을 겁니다.',
  ]) {
    const result = planAnswerFollowup(text);
    assert.equal(result.id, 'plan', text); assert.notEqual(result.evidence.polarity, 'affirmed');
    assert.ok(!['meal', 'family', 'experience', 'evidence'].includes(allReady(text).id), text);
    exactEvidence(text, result);
  }
  const actual = planAnswerFollowup('할머니를 돌봤고 앞으로도 돕고 싶습니다.');
  assert.equal(actual.id, 'experience'); assert.match(actual.evidence.quote, /돌봤/);
});

test('third-party actions, reports and observation remain separate from personal actions', () => {
  for (const text of [
    '동료가 할머니를 돌봤습니다.', '동료가 직접 할머니 식사를 도왔습니다.',
    '어머니가 할머니를 돌봤습니다.', '저는 동료가 식사를 돕는 걸 봤습니다.',
    '동료가 할머니를 돌봤습니다. 식사 보조를 했습니다.',
    '동료가 할머니를 돌봤다고 들었습니다.',
  ]) {
    const fallback = planAnswerFollowup(text);
    assert.equal(fallback.kind, 'repair', text); assert.equal(fallback.reason, 'detail'); assert.equal(fallback.clip, undefined);
    const result = allReady(text);
    assert.equal(result.id, 'role', text); assert.equal(result.evidence.subject, 'other', text);
    assert.equal(result.desiredId, 'role'); exactEvidence(text, result);
  }
  for (const text of ['저는 식사를 도왔고 동료가 기록했습니다.', '동료가 기록했고 저는 식사를 도왔습니다.', '어머니가 아프셔서 제가 식사를 도왔습니다.']) {
    const result = planAnswerFollowup(text); assert.equal(result.id, 'experience', text); assert.equal(result.evidence.subject, 'self'); exactEvidence(text, result);
  }
});

test('generic completed verbs do not establish care experience', () => {
  for (const text of [
    '그냥 돈이 필요해서 지원했습니다.', '요양보호사가 좋다고 생각했습니다.',
    '어르신을 돕는 일을 원했습니다.', '식사를 도와야 한다고 생각했습니다.',
  ]) {
    const result = planAnswerFollowup(text); assert.equal(result.id, 'plan', text); exactEvidence(text, result);
  }
});

test('future-only training does not claim that the applicant has already learned it', () => {
  for (const text of ['다음 달에 교육을 받을 예정입니다.', '자격증 공부를 시작하겠습니다.', '요양 교육을 배우고 싶습니다.', '자격증을 준비하고 있습니다.']) {
    const result = allReady(text); assert.equal(result.id, 'plan', text); exactEvidence(text, result);
  }
});

test('evidence offsets always reproduce the exact original, including recognition spaces and Unicode', () => {
  for (const text of [
    '  🙂 시설 경험은 없지만\n  할머니 를 돌 봤 습니다.  ',
    '할머니를 돌봤습니다.'.normalize('NFD'),
    '\n\t경험 이 없 습니다.\n자격증 을 공부 하고 있습니다.\n',
  ]) exactEvidence(text, planAnswerFollowup(text));
});

test('repairable input and unrelated filler do not consume an answer or select media', () => {
  for (const [text, options, reason] of [
    ['', {}, 'empty'], ['다시요', {}, 'repeat'], ['모르겠습니다.', {}, 'uncertain'],
    ['할머니를 돌봤습니다.', { confidence: .2 }, 'recognition'], ['경험이 있습니다.', { recognitionError: true }, 'recognition'],
    ['x'.repeat(2001), {}, 'length'], ['어제 축구 경기를 봤어요.', {}, 'off-topic'], ['네.', {}, 'detail'], ['그렇습니다.', {}, 'detail'],
  ]) {
    const result = planAnswerFollowup(text, options);
    assert.equal(result.kind, 'repair', text); assert.equal(result.reason, reason); assert.equal(result.evidence, null);
    assert.equal(result.clip, undefined); assert.equal(result.question, undefined);
  }
});

test('caller edits cannot change future results or fixed speech contracts', () => {
  const result = planAnswerFollowup('할머니를 돌봤습니다.');
  result.evidence.quote = '외부 변경'; result.question = '다른 대사';
  const next = planAnswerFollowup('할머니를 돌봤습니다.');
  assert.notEqual(next.evidence.quote, '외부 변경'); assert.equal(next.question, FOLLOWUP_CATALOG.experience.question);
  assert.ok(Object.isFrozen(FOLLOWUP_CATALOG)); assert.ok(Object.isFrozen(FOLLOWUP_CATALOG.experience));
});

test('qualified negation and later self-correction cannot establish personal experience', () => {
  const denied = planAnswerFollowup('저는 돌봄 경험이 있지는 않습니다.', { confidence: .99 });
  assert.equal(denied.id, 'plan'); assert.equal(denied.ruleId, 'no-experience');
  for (const text of [
    '할머니를 돌봤다는 뜻은 아닙니다.',
    '할머니를 돌봤지만 그건 제가 아닙니다.',
    '할머니를 돌봤습니다. 아니요, 제가 아니라 어머니가 돌봤습니다.',
  ]) {
    const result = planAnswerFollowup(text, { confidence: .99 });
    assert.equal(result.kind, 'repair', text); assert.equal(result.reason, 'uncertain');
    assert.equal(result.clip, undefined); assert.equal(result.evidence, null);
  }
});

test('named third parties and quoted practice need clarification instead of assuming the applicant acted', () => {
  for (const text of [
    '동료 김 씨가 할머니를 돌봤습니다.',
    '김 선생님이 할머니를 돌봤다고 합니다.',
    '저는 할머니를 돌봤다는 친구의 얘기를 들었습니다.',
    '경험이 있습니다라는 문장을 연습했습니다.',
    '경험이 없습니다라는 문장을 연습했습니다.',
    '동료가 어르신을 돌보고 싶다고 했습니다.',
    '동료가 요양 교육을 준비하고 있습니다.',
    '남편이 할머니를 돌봤습니다.', '제 딸이 할머니 식사를 도왔습니다.', '김철수가 할머니를 돌봤습니다.',
    '제 친구 홍길동이 할머니를 돌봤습니다.', '저는 제 친구 홍길동이 할머니를 돌봤다고 들었습니다.',
  ]) {
    const result = planAnswerFollowup(text, { confidence: .99 });
    assert.equal(result.kind, 'repair', text); assert.equal(result.clip, undefined);
  }
});

test('tentative or unsupported recognition remains repair even with a high overall confidence', () => {
  for (const text of ['할머니를 돌본 경험이 있는 것 같습니다.', '할머니를 돌봤을 수도 있습니다.', '돌본 것 같기도 하고 안 돌본 것 같기도 합니다.', '할머니를 돌본 경험이 없지는 않습니다.', '경험이 없다고 말하지 않았습니다.']) {
    const result = planAnswerFollowup(text, { confidence: .99 });
    assert.equal(result.kind, 'repair', text); assert.equal(result.reason, 'uncertain');
  }
  for (const text of ['식사량 확인 가입고객 서류 상태 할머니 요양', '아무 말 대잔치입니다.', '돈 버스 초록 문장 별 하나 둘', '경험이 업습니다.']) {
    const result = planAnswerFollowup(text, { confidence: .99 });
    assert.equal(result.kind, 'repair', text); assert.equal(result.reason, 'detail');
    assert.equal(result.clip, undefined); assert.equal(result.evidence, null);
  }
});

test('a stated past action survives a separate learning intention in the same sentence', () => {
  for (const text of ['할머니를 돌봤고 많이 배우고 싶습니다.', '식사를 도왔으며 앞으로도 배우고 싶습니다.', '할머니를 돌봤습니다. 교육을 받으면 더 도움이 될 것 같습니다.', '할머니를 돌봤기 때문에 이 일을 더 배우고 싶습니다.']) {
    const result = planAnswerFollowup(text);
    assert.equal(result.id, 'experience', text); exactEvidence(text, result);
  }
  assert.equal(planAnswerFollowup('동료가 어르신 식사를 도왔습니다. 저는 교육부터 받겠습니다.').id, 'plan');
  assert.match(planAnswerFollowup('동료가 어르신 식사를 도왔습니다. 저는 교육부터 받겠습니다.').evidence.quote, /저는 교육/);
  assert.equal(planAnswerFollowup('동료 김 씨가 기록했고 저는 할머니 식사를 도왔습니다.').id, 'experience');
  assert.equal(planAnswerFollowup('할머니를 같이 돌봤습니다.').id, 'experience');
  assert.equal(planAnswerFollowup('제가 많이 도왔습니다.').id, 'experience');
  assert.equal(planAnswerFollowup('할머니를 돌봤다고 생각하고 싶습니다.').kind, 'repair');
});

test('trailing corrections and subjectless reversals never select an experience clip', () => {
  for (const text of [
    '저는 돌봄 경험이 있어요 아니 없어요.',
    '저는 돌봄 경험이 있습니다. 사실 없습니다.',
    '저는 요양원에서 어르신을 돌봤습니다. 아니다 아직 안 해봤습니다.',
    '저는 요양원 근무했어요. 안 했어요.',
    '저는 돌봄 경험은 없습니다. 지금은 있습니다.',
    '저는 돌봄 경험이 없어요 아니 있어요.',
    '저는 돌봄 경험이 있습니다. 경험이 없습니다.',
    '저는 돌봄 경험 이 있 습니다. 사실 없 습니다.',
  ]) {
    for (const options of [{ confidence: .999 }, { availableClipIds: allClips }]) {
      const result = planAnswerFollowup(text, options);
      assert.equal(result.kind, 'repair', text); assert.equal(result.reason, 'uncertain');
      assert.equal(result.evidence, null); assert.equal(result.clip, undefined);
    }
  }
});

test('nonstandard past negations require clarification without rewriting their meaning', () => {
  for (const text of [
    '저는 요양원에서 근무했지 않았습니다.', '저는 어르신을 돌봤지 않았어요.',
    '저는 돌봤어요는 아니에요.', '저는 어르신을 도왔습니다는 아니에요.',
    '저는 어르신을 돌 봤 지 않 았 어 요.',
  ]) {
    const result = planAnswerFollowup(text, { confidence: .999 });
    assert.equal(result.kind, 'repair', text); assert.equal(result.reason, 'uncertain');
    assert.equal(result.evidence, null); assert.equal(result.clip, undefined);
  }
});

test('clear short denials use preparation with exact evidence while unrelated replies remain unsupported', () => {
  for (const text of [
    '경험없어요', '아직안해봤어요', '해본적없습니다', '저는 아직 안 해봤어요.',
    '저는 요양원 일 아직 안 해봤어요.', '  아직 안 해 봤 어 요.  ',
    '해본 적 없습니다.'.normalize('NFD'),
    '아직 안 해봤어요. 교육을 받고 준비하겠습니다.',
  ]) {
    const result = planAnswerFollowup(text);
    assert.equal(result.id, 'plan', text); assert.equal(result.ruleId, 'no-experience');
    assert.equal(result.evidence.polarity, 'negated'); exactEvidence(text, result);
  }
  for (const text of ['축구 안 해봤어요.', '그 문장은 아직 안 해봤어요.', '경험이 업습니다.']) {
    const result = planAnswerFollowup(text);
    assert.equal(result.kind, 'repair', text); assert.equal(result.clip, undefined);
  }
  for (const text of [
    '아직 안 해봤어요. 집에서 할머니 식사를 도왔습니다.',
    '할머니를 돌봤습니다. 낙상 사고는 없었습니다.',
    '가족을 돌보면서 식사와 이동을 도왔습니다.',
  ]) assert.equal(planAnswerFollowup(text).id, 'experience', text);
});

test('qualified denials of helping never establish a positive experience', () => {
  for (const text of [
    '저는 할머니를 도와드렸다고는 할 수 없습니다.',
    '저는 할머니를 도와드렸다고 할 수는 없습니다.',
    '저는 할머니를 도와 드렸다고는 말할 수 없습니다.',
    '저는 할머니를 돌봤다고는 할 수 없습니다.',
  ]) {
    for (const options of [{ confidence: .999 }, { availableClipIds: allClips }]) {
      const result = planAnswerFollowup(text, options);
      assert.equal(result.id, 'plan', text); assert.equal(result.ruleId, 'no-experience');
      assert.equal(result.evidence.polarity, 'negated'); exactEvidence(text, result);
    }
  }
  assert.equal(planAnswerFollowup('저는 할머니를 도와드렸다고 할 수 있습니다.').id, 'experience');
  assert.equal(planAnswerFollowup('저는 할머니를 도와드렸습니다. 할머니는 혼자 식사할 수 없습니다.').id, 'experience');
});
