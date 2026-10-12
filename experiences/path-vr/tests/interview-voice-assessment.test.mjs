import test from 'node:test';
import assert from 'node:assert/strict';
import { assessVoiceAnswer, replaceVoiceSpan, rebaseConfirmedSpans } from '../interview/film/voice-assessment.mjs';

const result = (text, scores = {}, engine = 'whisper-tiny') => ({ text, engine, words: text.match(/\S+/gu)?.map(word => ({ word, conf: scores[word] ?? .92 })) || [] });
const confirm = (r, assessment) => ({ ...assessment.issue, text: r.text.slice(assessment.issue.start, assessment.issue.end) });
function checkIssue(r, assessment) {
  assert.ok(['clarify', 'retry'].includes(assessment.decision));
  const { start, end } = assessment.issue;
  assert.ok(Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end <= r.text.length && end > start);
  assert.ok(start === 0 || /\s/u.test(r.text[start - 1]));
  assert.ok(end === r.text.length || /\s/u.test(r.text[end]));
  assert.equal(assessment.rawText, r.text);
}

test('concrete first-person actions and preparation advance without whole-answer confirmation', () => {
  for (const [text, branch] of [
    ['저는 할머니 식사를 도왔습니다.', 'experience'],
    ['저는 요양보호사 교육을 받고 있습니다.', 'plan'],
    ['제가 할머니를 돌봤고 더 배우고 싶습니다.', 'experience'],
  ]) {
    const r = result(text), a = assessVoiceAnswer(r);
    assert.equal(a.decision, 'auto', text); assert.equal(a.issue, null); assert.equal(a.proposedBranch.id, branch);
    assert.equal(a.rawText, text); assert.ok(a.criticalSpans.length >= 2);
  }
});

test('bare experience polarity requires a short explicit review even when every word scores .999', () => {
  for (const [text, expectedPhrase] of [
    ['저는 돌봄 경험이 있습니다. 감사합니다.', '경험이 있습니다.'],
    ['저는 돌봄 경험이 없습니다. 감사합니다.', '경험이 없습니다.'],
    ['저는 식사를 도운 적이 있습니다.', '도운 적이 있습니다.'],
    ['저는 돌봄을 해 본 적이 없습니다.', '해 본 적이 없습니다.'],
    ['저는 돌봄 경험 이 있 습니다.', '경험 이 있 습니다.'],
    ['저는 돌봄 경험이 있지는 않습니다.', '경험이 있지는 않습니다.'],
  ]) {
    const r = result(text); r.words.forEach(word => { word.conf = .999; }); r.confidence = .999;
    const a = assessVoiceAnswer(r); checkIssue(r, a);
    assert.equal(a.decision, 'clarify', text); assert.equal(a.issue.kind, 'experience-polarity');
    assert.equal(text.slice(a.issue.start, a.issue.end), expectedPhrase);
    assert.ok(a.issue.start > 0, 'do not require the complete answer');
    assert.equal(assessVoiceAnswer(r, { confirmedSpans: [confirm(r, a)] }).decision, 'auto', text);
    assert.equal(assessVoiceAnswer(r, { confirmedSpans: [{ ...confirm(r, a), text: '잘못된 확인' }] }).decision, 'clarify');
  }
});

test('a router-validated short denial advances to preparation after one exact confirmation even with unknown metadata', () => {
  for (const text of ['저는 아직 안 해봤어요.', '아직안해봤어요', '  아직 안 해 봤 어 요.  ', '저는 요양원 일 아직 안 해봤어요.', '해 보지 않았어요.']) {
    for (const r of [result(text, {}, 'whisper-base'), { text, engine: 'whisper-base' }, { text, engine: 'unknown', confidence: .999 }]) {
      const before = structuredClone(r), a = assessVoiceAnswer(r);
      checkIssue(r, a);
      assert.equal(a.decision, 'clarify', text); assert.equal(a.issue.kind, 'experience-polarity', text);
      assert.equal(a.proposedBranch.id, 'plan', text);
      assert.equal(text.slice(a.issue.start, a.issue.end), text.trim(), 'approve this short context-dependent answer once');
      const approved = assessVoiceAnswer(r, { confirmedSpans: [confirm(r, a)] });
      assert.equal(approved.decision, 'auto', text); assert.equal(approved.proposedBranch.id, 'plan');
      assert.equal(approved.issue, null);
      const stale = assessVoiceAnswer(r, { confirmedSpans: [{ ...confirm(r, a), text: '해봤어요.' }] });
      assert.equal(stale.decision, 'clarify');
      assert.deepEqual(r, before);
    }
  }
});

test('short-denial confirmation never invents care experience context for other people or unrelated activities', () => {
  for (const text of ['제 친구는 아직 안 해봤어요.', '저는 게임을 안 해봤어요.', '저는 축구를 해 보지 않았어요.', '저는 아직 안 해봤어요라고 들었습니다.']) {
    const r = result(text, {}, 'whisper-base'), first = assessVoiceAnswer(r);
    assert.notEqual(first.decision, 'auto', text);
    assert.notEqual(first.issue.kind, 'experience-polarity', text);
    const approved = assessVoiceAnswer(r, { confirmedSpans: [confirm(r, first)] });
    assert.notEqual(approved.decision, 'auto', text);
  }
});

test('a hypothetical high-score absence-to-presence substitution cannot select the recorded follow-up without review', () => {
  const originalSpeech = '저는 돌봄 경험이 없습니다.';
  const recognized = result('저는 돌봄 경험이 있습니다.'); recognized.words.forEach(word => { word.conf = .999; });
  assert.notEqual(recognized.text, originalSpeech);
  const assessment = assessVoiceAnswer(recognized);
  assert.equal(assessment.proposedBranch.id, 'experience', 'the lexical router alone would choose experience');
  assert.equal(assessment.decision, 'clarify');
  assert.equal(recognized.text.slice(assessment.issue.start, assessment.issue.end), '경험이 있습니다.');
  assert.equal(recognized.text, '저는 돌봄 경험이 있습니다.', 'do not fabricate the missing negation');
});

test('the observed noisy duplicate predicate is one issue and an explicit negative correction preserves the surrounding raw words', () => {
  // Exact real browser output of 05-tried-none__typing-5db. The fixture was
  // synthetic TTS plus noise, not a human/non-native microphone recording.
  const r = result('저는 직접 브이범을 태풍 경험이 있다고 있습니다.', {
    '저는': .723736658037181, '직접': .9965490453993008, '브이범을': .4163572404375534,
    '태풍': .16297741967974716, '경험이': .6987720644267151,
    '있다고': .23403551066084916, '있습니다.': .3342024975141084,
  }, 'whisper-base');
  const original = structuredClone(r), a = assessVoiceAnswer(r);
  assert.equal(a.decision, 'clarify'); assert.equal(a.issue.kind, 'experience-polarity');
  assert.equal(r.text.slice(a.issue.start, a.issue.end), '경험이 있다고 있습니다.');
  assert.ok(a.issue.start > 0);
  const formerShortApproval = { start: a.issue.start, end: a.issue.start + '경험이 있다고'.length, text: '경험이 있다고' };
  assert.equal(assessVoiceAnswer(r, { confirmedSpans: [formerShortApproval] }).decision, 'clarify');
  assert.equal(assessVoiceAnswer(r, { confirmedSpans: [confirm(r, a)] }).decision, 'auto', 'explicit approval must not ask the same trailing verb again');
  const replacement = '경험이 없습니다.';
  const changed = replaceVoiceSpan(r, a.issue, replacement);
  const approved = { start: a.issue.start, end: a.issue.start + replacement.length, text: replacement };
  assert.equal(changed.text, '저는 직접 브이범을 태풍 경험이 없습니다.');
  const next = assessVoiceAnswer(changed, { confirmedSpans: [approved] });
  assert.equal(next.decision, 'auto'); assert.equal(next.proposedBranch.id, 'plan');
  assert.equal(next.issue, null);
  assert.deepEqual(r, original, 'recognition text and scores must never be automatically corrected');
});

test('duplicate-predicate grouping does not consume another clause or turn reported speech into personal history', () => {
  for (const text of ['저는 경험이 있다고. 있습니다.', '저는 경험이 있다고\n있습니다.', '저는 경험이 있다고 지금 있습니다.']) {
    const r = result(text, {}, 'whisper-base'), a = assessVoiceAnswer(r);
    assert.equal(a.decision, 'clarify', text);
    assert.equal(a.issue.kind, 'experience-polarity', text);
    assert.equal(text.slice(a.issue.start, a.issue.end), text.includes('있다고.') ? '경험이 있다고.' : '경험이 있다고');
  }
  for (const text of [
    '저는 경험이 있다고 말했습니다.',
    '저는 친구가 경험이 있다고 들었습니다.',
    '친구는 돌봄 경험이 있다고 했습니다.',
    '저는 경험이 있다고 생각합니다.',
  ]) {
    const r = result(text, {}, 'whisper-base'); r.words.forEach(word => { word.conf = .999; });
    const confirmations = [];
    for (let attempt = 0; attempt < 5; attempt++) {
      const a = assessVoiceAnswer(r, { confirmedSpans: confirmations });
      assert.ok(!(a.decision === 'auto' && a.proposedBranch.id === 'experience'), text);
      if (a.decision !== 'clarify') break;
      assert.ok(!r.text.slice(a.issue.start, a.issue.end).includes('있다고 있습니다.'));
      confirmations.push(confirm(r, a));
    }
  }
  const direct = assessVoiceAnswer(result('저는 할머니의 식사를 도왔습니다.', {}, 'whisper-base'));
  assert.equal(direct.decision, 'auto'); assert.equal(direct.proposedBranch.id, 'experience');
});

test('specific past actions remain automatic while approval of a bare polarity never overrides semantic repair', () => {
  for (const text of [
    '저는 식사량을 확인해 담당자에게 보고했습니다.',
    '제가 식사를 준비하고 할머니를 도왔습니다.',
    '저는 할머니 식사를 도왔습니다. 요양원 경험은 없습니다.',
  ]) assert.equal(assessVoiceAnswer(result(text)).decision, 'auto', text);
  for (const text of ['제 남편이 돌봄 경험이 있습니다.', '저는 경험이 없지는 않습니다.']) {
    const r = result(text), first = assessVoiceAnswer(r);
    const next = assessVoiceAnswer(r, { confirmedSpans: [confirm(r, first)] });
    assert.notEqual(next.decision, 'auto', text);
  }
});

test('minimal polarity pairs and a negative answer followed by explicit preparation require only their claim', () => {
  for (const [text, expectedPhrase, branch] of [
    ['저는 돌봄 경험이 없습니다.', '경험이 없습니다.', 'plan'],
    ['저는 돌봄 경험이 있습니다.', '경험이 있습니다.', 'experience'],
    ['저는 어르신의 식사를 도운 적이 없습니다.', '도운 적이 없습니다.', 'plan'],
    ['저는 어르신의 식사를 도운 적이 있습니다.', '도운 적이 있습니다.', 'experience'],
    ['저는 직접 돌봄을 해 본 경험이 없습니다.', '경험이 없습니다.', 'plan'],
    ['저는 직접 돌봄을 해 본 경험이 있습니다.', '경험이 있습니다.', 'experience'],
    ['음, 저는 아직 돌봄 경험이 없습니다. 앞으로 이동 보조와 보고 절차를 배우겠습니다.', '경험이 없습니다.', 'plan'],
    ['저는 요양원에서 일한 적이 없습니다.', '일한 적이 없습니다.', 'plan'],
    ['저는 요양원에서 일한 적이 있습니다.', '일한 적이 있습니다.', 'experience'],
  ]) {
    const r = result(text, {}, 'whisper-base'); r.words.forEach(word => { word.conf = .999; });
    const original = structuredClone(r), first = assessVoiceAnswer(r);
    assert.equal(first.decision, 'clarify', text);
    assert.equal(first.issue.kind, 'experience-polarity', text);
    assert.equal(text.slice(first.issue.start, first.issue.end), expectedPhrase);
    assert.equal(first.proposedBranch.id, branch, text);
    const checked = assessVoiceAnswer(r, { confirmedSpans: [confirm(r, first)] });
    assert.equal(checked.decision, 'auto', text);
    assert.equal(checked.proposedBranch.id, branch, text);
    assert.deepEqual(r, original, 'assessment must never replace or infer a polarity word');
  }
});

test('correcting only a recognized polarity discards its old approval and leaves the rest of the answer intact', () => {
  const r = result('  저는 돌봄 경험이 있습니다.  감사합니다.', {}, 'whisper-base');
  r.words.forEach(word => { word.conf = .999; });
  const first = assessVoiceAnswer(r), priorApproval = confirm(r, first);
  const revised = replaceVoiceSpan(r, first.issue, result('경험이 없습니다.', {}, 'whisper-base'));
  assert.equal(revised.text, '  저는 돌봄 경험이 없습니다.  감사합니다.');
  const second = assessVoiceAnswer(revised, { confirmedSpans: [priorApproval] });
  assert.equal(second.decision, 'clarify'); assert.equal(second.issue.kind, 'experience-polarity');
  assert.equal(revised.text.slice(second.issue.start, second.issue.end), '경험이 없습니다.');
  assert.equal(second.proposedBranch.id, 'plan');
  const approved = assessVoiceAnswer(revised, { confirmedSpans: [confirm(revised, second)] });
  assert.equal(approved.decision, 'auto'); assert.equal(approved.proposedBranch.id, 'plan');
  assert.equal(r.text, '  저는 돌봄 경험이 있습니다.  감사합니다.');
});

test('an exact polarity approval does not silently approve uncertain actor metadata', () => {
  const r = result('저는 돌봄 경험이 있습니다.', { '저는': .1 }, 'whisper-base');
  const first = assessVoiceAnswer(r);
  assert.equal(first.issue.kind, 'experience-polarity');
  const claimApproval = confirm(r, first);
  const next = assessVoiceAnswer(r, { confirmedSpans: [claimApproval] });
  assert.equal(next.decision, 'clarify'); assert.equal(next.issue.kind, 'confidence');
  assert.equal(r.text.slice(next.issue.start, next.issue.end), '저는');
  assert.equal(assessVoiceAnswer(r, { confirmedSpans: [claimApproval, confirm(r, next)] }).decision, 'auto');
});

test('multiple bare claims each need their own approval and a later edit preserves the earlier exact approval', () => {
  const r = result('저는 돌봄 경험이 있고 식사를 도운 적이 있습니다.', {}, 'whisper-base');
  r.words.forEach(word => { word.conf = .999; });
  const first = assessVoiceAnswer(r), firstApproval = confirm(r, first);
  assert.equal(r.text.slice(first.issue.start, first.issue.end), '경험이 있고');
  const second = assessVoiceAnswer(r, { confirmedSpans: [firstApproval] });
  assert.equal(second.decision, 'clarify');
  assert.equal(r.text.slice(second.issue.start, second.issue.end), '도운 적이 있습니다.');
  assert.equal(assessVoiceAnswer(r, { confirmedSpans: [firstApproval, confirm(r, second)] }).decision, 'auto');
  const replacement = '도운 적이 많이 있습니다.';
  const kept = rebaseConfirmedSpans(r.text, second.issue, replacement, [firstApproval, confirm(r, second)]);
  assert.deepEqual(kept, [{ start: firstApproval.start, end: firstApproval.end, text: firstApproval.text }]);
  const changed = replaceVoiceSpan(r, second.issue, result(replacement, {}, 'whisper-base'));
  const next = assessVoiceAnswer(changed, { confirmedSpans: kept });
  assert.equal(next.decision, 'clarify'); assert.equal(next.issue.kind, 'experience-polarity');
  assert.equal(changed.text.slice(next.issue.start, next.issue.end), replacement);
  assert.ok(next.issue.start > firstApproval.end, 'the earlier claim must not be asked again');
  assert.equal(assessVoiceAnswer(changed, { confirmedSpans: [...kept, confirm(changed, next)] }).decision, 'auto');
});

test('low nonessential words do not block a clear branch, but the action and negation do', () => {
  const r = result('저는 요양원에서 어르신의 식사를 도왔습니다. 감사합니다.', { '요양원에서': .1, '어르신의': .2, '감사합니다.': .05 });
  assert.equal(assessVoiceAnswer(r).decision, 'auto');
  const low = result(r.text, { '도왔습니다.': .1 });
  const a = assessVoiceAnswer(low); checkIssue(low, a);
  assert.equal(a.decision, 'clarify'); assert.equal(low.text.slice(a.issue.start, a.issue.end), '도왔습니다.');
  const no = result('저는 돌봄 경험이 없습니다.', { '없습니다.': .1 });
  assert.equal(assessVoiceAnswer(no).decision, 'clarify');
});

test('unknown engines, missing or misaligned word scores never borrow the utterance average', () => {
  for (const r of [
    result('저는 할머니를 돌봤습니다.', {}, 'vosk'),
    { text: '저는 할머니를 돌봤습니다.', confidence: .999, engine: 'whisper-tiny' },
    { ...result('저는 할머니를 돌봤습니다.'), words: [{ word: '잘못된', conf: .999 }], confidence: .999 },
  ]) { const a = assessVoiceAnswer(r); assert.equal(a.decision, 'clarify'); checkIssue(r, a); }
  assert.equal(assessVoiceAnswer(result('저는 할머니를 돌봤습니다.', {}, 'whisper-base-q8')).decision, 'auto');
});

test('high scores cannot make a missing actor, another person, quotation, correction or hypothesis certain', () => {
  for (const text of [
    '차린 할머니를 돌봤습니다.', '할머니를 돌봤습니다.', '제 남편이 할머니를 돌봤습니다.',
    '저는 할머니를 돌봤다는 친구의 얘기를 들었습니다.',
    '제가 돌봤습니다. 아니요, 동료가 돌봤습니다.',
    '제가 할머니를 돌봤다면 상태를 확인했을 겁니다.',
    '제가 할머니를 돌본 경험이 있는 것 같습니다.',
    '저는 경험이 없지는 않습니다.',
  ]) { const r = result(text); const a = assessVoiceAnswer(r); assert.equal(a.decision, 'clarify', text); checkIssue(r, a); }
});

test('confirmed spans resolve only the exact issue and never silently confirm another low core word', () => {
  const r = result('저는 할머니를 돌봤습니다.', { '저는': .2, '돌봤습니다.': .1 });
  const first = assessVoiceAnswer(r); checkIssue(r, first);
  const firstConfirmed = confirm(r, first);
  const second = assessVoiceAnswer(r, { confirmedSpans: [firstConfirmed] });
  assert.equal(second.decision, 'clarify'); assert.notEqual(second.issue.start, first.issue.start);
  assert.equal(assessVoiceAnswer(r, { confirmedSpans: [firstConfirmed, confirm(r, second)] }).decision, 'auto');
  assert.equal(assessVoiceAnswer(r, { confirmedSpans: [{ ...firstConfirmed, text: '다른 글' }] }).issue.start, first.issue.start);
});

test('confirmation cannot convert a semantic rejection or incomplete audio into an automatic answer', () => {
  const r = result('제 남편이 할머니를 돌봤습니다.');
  const a = assessVoiceAnswer(r);
  assert.equal(assessVoiceAnswer(r, { confirmedSpans: [confirm(r, a)] }).decision, 'retry');
  const truncated = { ...result('저는 할머니를 돌봤습니다.'), truncated: true };
  const t = assessVoiceAnswer(truncated); assert.equal(t.decision, 'retry'); assert.equal(t.issue.kind, 'truncated');
  assert.equal(assessVoiceAnswer(truncated, { confirmedSpans: [confirm(truncated, t)] }).decision, 'retry');
});

test('second answers still require an action or preparation and clear local metadata', () => {
  assert.equal(assessVoiceAnswer(result('제가 식사를 준비했습니다.'), { turn: 2 }).decision, 'auto');
  assert.equal(assessVoiceAnswer(result('저는 교육을 받고 준비하겠습니다.'), { turn: 2 }).decision, 'auto');
  assert.equal(assessVoiceAnswer(result('저는 아무 말 대잔치입니다.'), { turn: 2 }).decision, 'clarify');
  assert.equal(assessVoiceAnswer(result('제 남편이 식사를 준비했습니다.'), { turn: 2 }).decision, 'clarify');
});

test('empty and damaged recognition cannot advance; all offsets refer to unmodified input', () => {
  assert.equal(assessVoiceAnswer({ text: '', words: [] }).decision, 'retry');
  const r = result('  저는\t할머니를 돌봤습니다. � ');
  const a = assessVoiceAnswer(r); checkIssue(r, a); assert.equal(a.issue.kind, 'damaged');
  assert.equal(r.text.slice(a.issue.start, a.issue.end), '�');
  const spaced = result('저 는 할머니를 돌 봤 습니다.');
  const s = assessVoiceAnswer(spaced); assert.equal(s.decision, 'auto');
  for (const span of s.criticalSpans) assert.ok(spaced.text.slice(span.start, span.end));
});

test('a configurable threshold changes only uncertainty, never the recognized words', () => {
  const r = result('저는 할머니를 돌봤습니다.', { '돌봤습니다.': .6 });
  assert.equal(assessVoiceAnswer(r).decision, 'auto');
  assert.equal(assessVoiceAnswer(r, { minConfidence: .7 }).decision, 'clarify');
  assert.equal(r.text, '저는 할머니를 돌봤습니다.');
  assert.throws(() => assessVoiceAnswer(r, { minConfidence: NaN }), RangeError);
});

test('span replacement preserves surrounding bytes and scores without correcting any other word', () => {
  const original = result('  저는\t할머니를 돌봤습니다.  감사합니다.');
  const before = structuredClone(original);
  const start = original.text.indexOf('돌봤습니다.');
  const issue = { start, end: start + '돌봤습니다.'.length };
  const replacement = result('돌본 적이 없습니다.', { '없습니다.': .63 });
  const merged = replaceVoiceSpan(original, issue, replacement);
  assert.equal(merged.text, '  저는\t할머니를 돌본 적이 없습니다.  감사합니다.');
  assert.deepEqual(merged.words, [original.words[0], original.words[1], ...replacement.words, original.words[3]]);
  assert.equal(merged.engine, original.engine); assert.deepEqual(original, before);
  const typed = replaceVoiceSpan(original, issue, '돌보지 않았습니다.');
  assert.equal(typed.words[0].conf, .92); assert.equal(typed.words[2].conf, undefined); assert.equal(typed.words[3].conf, undefined);
  assert.equal(typed.words.at(-1).conf, .92);
});

test('span replacement rejects partial-word ranges and preserves unknown or truncated metadata honestly', () => {
  const original = result('저는 할머니를 돌봤습니다.');
  assert.throws(() => replaceVoiceSpan(original, { start: 1, end: 2 }, '나는'), RangeError);
  const issue = { start: 8, end: original.text.length };
  const bad = replaceVoiceSpan({ ...original, words: [{ word: '다름', conf: 1 }] }, issue, { text: '돌보겠습니다.', engine: 'whisper-base', words: [{ word: '다름', conf: 1 }] });
  assert.ok(bad.words.every(word => word.conf === undefined)); assert.notEqual(bad.engine, 'whisper-tiny');
  assert.equal(replaceVoiceSpan({ ...original, truncated: true }, issue, '도왔습니다.').truncated, true);
});

test('confirmation rebasing keeps exact earlier spans and shifts later spans without mutating input', () => {
  const text = '저는 할머니 식사를 도왔습니다.';
  const span = (word) => ({ start: text.indexOf(word), end: text.indexOf(word) + word.length, text: word });
  const issue = span('식사를');
  const confirmed = [span('저는'), span('도왔습니다.')];
  const before = structuredClone(confirmed);
  const replacement = '식사와 이동을';
  const moved = rebaseConfirmedSpans(text, issue, replacement, confirmed);
  const delta = replacement.length - issue.text.length;
  assert.deepEqual(moved, [confirmed[0], { ...confirmed[1], start: confirmed[1].start + delta, end: confirmed[1].end + delta }]);
  const updated = text.slice(0, issue.start) + replacement + text.slice(issue.end);
  for (const item of moved) assert.equal(updated.slice(item.start, item.end), item.text);
  assert.deepEqual(confirmed, before);
  assert.deepEqual(rebaseConfirmedSpans(text, issue, '', confirmed), [confirmed[0], { ...confirmed[1], start: confirmed[1].start - 3, end: confirmed[1].end - 3 }]);
});

test('confirmation rebasing drops overlapping approvals while preserving separate whole-word spans', () => {
  const text = '저는 할머니 식사를 도왔습니다.';
  const start = text.indexOf('할머니'), end = text.indexOf('식사를') + '식사를'.length;
  const issue = { start, end };
  const all = { start: 0, end: text.length, text };
  const overlapLeft = { start: 0, end: start + '할머니'.length, text: text.slice(0, start + 3) };
  const overlapRight = { start: text.indexOf('식사를'), end: text.length, text: text.slice(text.indexOf('식사를')) };
  const inside = { start, end: start + 3, text: '할머니' };
  const prior = { start: 0, end: 2, text: '저는' };
  const afterStart = text.indexOf('도왔습니다.');
  const after = { start: afterStart, end: text.length, text: '도왔습니다.' };
  const moved = rebaseConfirmedSpans(text, issue, '가족을', [all, overlapLeft, overlapRight, inside, prior, after]);
  const delta = '가족을'.length - (end - start);
  assert.deepEqual(moved, [prior, { ...after, start: after.start + delta, end: after.end + delta }]);
});

test('stale text, partial words and invalid offsets never become confirmations after an edit', () => {
  const text = '저는 할머니를 돌봤습니다.';
  const issue = { start: 3, end: 7 };
  const valid = { start: 0, end: 2, text: '저는' };
  const invalid = [
    { ...valid, text: '나는' }, { start: 0, end: 1, text: '저' },
    { start: 1, end: 2, text: '는' }, { start: -1, end: 2, text: '저는' },
    { start: .5, end: 2, text: '저는' }, { start: 0, end: 99, text },
    { start: 2, end: 2, text: '' }, { start: 0, end: 2 }, null,
  ];
  assert.deepEqual(rebaseConfirmedSpans(text, issue, '가족을', [...invalid, valid]), [valid]);
  assert.deepEqual(rebaseConfirmedSpans(text, issue, '가족을', null), []);
  assert.throws(() => rebaseConfirmedSpans(text, { start: 4, end: 7 }, '가족을', [valid]), RangeError);
  assert.throws(() => rebaseConfirmedSpans(text, { start: 3, end: 6 }, '가족을', [valid]), RangeError);
  assert.throws(() => rebaseConfirmedSpans(text, issue, {}, [valid]), TypeError);
});

test('rebased approvals retain raw whitespace and Unicode offsets and do not approve the new phrase', () => {
  const text = '  저는\t할머니를  돌봤습니다. 🙂';
  const issue = { start: text.indexOf('할머니를'), end: text.indexOf('할머니를') + 4 };
  const approved = ['저는', '돌봤습니다.', '🙂'].map(word => ({ start: text.indexOf(word), end: text.indexOf(word) + word.length, text: word }));
  const updated = replaceVoiceSpan(result(text), issue, '가족과 이웃을');
  const moved = rebaseConfirmedSpans(text, issue, '가족과 이웃을', approved);
  assert.equal(moved.length, 3);
  for (const item of moved) assert.equal(updated.text.slice(item.start, item.end), item.text);
  assert.ok(moved.every(item => !['가족과', '이웃을'].includes(item.text)));
});
