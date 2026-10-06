import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCases } from '../tools/learning-blind/cases.mjs';
import { GAME_CONTENT, gameProfiles, gameItems } from '../experiences/teacher-world/game-catalog.mjs';

const data = buildCases();
const group = id => data.cases.filter(row => row.groupId === id);
const observation = (row, skillId) => row.input.observations.find(item => item.skillId === skillId);
const candidate = row => row.input.candidates.find(item => item.id === row.baseline.candidateId);

test('18 deterministic development cases keep provider input apart from baseline and rubric', () => {
  assert.equal(data.schemaVersion, 'learning-blind-v1');
  assert.equal(data.evaluationSplit, 'development18');
  assert.equal(data.synthetic, true); assert.equal(data.learningEffectClaim, false);
  assert.equal(data.cases.length, 18); assert.equal(new Set(data.cases.map(row => row.id)).size, 18);
  assert.equal(new Set(data.cases.map(row => row.groupId)).size, 6);
  assert.deepEqual(buildCases(), data);
  for (const row of data.cases) {
    assert.ok(row.input.candidates.length >= 5 && row.input.candidates.length <= 8);
    assert.ok(Buffer.byteLength(JSON.stringify(row.input), 'utf8') < 16000);
    const forbiddenKeys = /^(baseline|rubric|rank|score|priority|status|recommendation|policy|state)$/;
    const inspect = value => { if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
      assert.ok(!forbiddenKeys.test(key), `answer leakage: ${key}`); inspect(child);
    } };
    inspect(row.input);
    assert.deepEqual(group(row.groupId).map(item => item.stage), [0, 1, 2]);
  }
});

test('every candidate is an actual authored game profile with enough real families', () => {
  for (const row of data.cases) for (const c of row.input.candidates) {
    const content = GAME_CONTENT.find(item => item.id === c.contentId);
    assert.ok(content);
    const profile = gameProfiles(content).find(item => item.id === c.id);
    assert.ok(profile); assert.equal(profile.skillIds[0], c.skillId);
    assert.equal(profile.difficulty, c.difficulty); assert.equal(profile.responseFormat, c.responseFormat);
    assert.equal(profile.modality, c.modality);
    const items = gameItems(content).filter(item => item.skillId === c.skillId && item.difficulty === c.difficulty
      && item.responseFormat === c.responseFormat && item.modality === c.modality);
    assert.equal(c.authoredItemCount, items.length);
    assert.equal(c.authoredFamilyCount, new Set(items.map(item => item.familyKey)).size);
    assert.equal(c.seenFamilyCount + c.unseenFamilyCount, c.authoredFamilyCount);
  }
});

test('Core baseline and evidence references exist while rubric permits alternatives', () => {
  for (const row of data.cases) {
    assert.ok(candidate(row));
    const ids = row.input.observations.map(item => item.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(row.baseline.evidenceId === 'none' || ids.includes(row.baseline.evidenceId));
    const candidates = row.input.candidates.map(item => item.id);
    for (const id of [...row.rubric.acceptableCandidateIds, ...row.rubric.forbiddenCandidateIds]) assert.ok(candidates.includes(id));
    assert.ok(row.rubric.acceptableCandidateIds.every(id => !row.rubric.forbiddenCandidateIds.includes(id)));
    if (!row.rubric.acceptableCandidateIds.length) assert.match(row.rubric.note, /needs-human/);
  }
  assert.ok(group('reading-need')[0].rubric.acceptableCandidateIds.length > 1);
  assert.ok(group('listening-need')[0].rubric.acceptableCandidateIds.length > 1);
});

test('opposite observed histories lead to opposite Core modalities', () => {
  const read = group('reading-need')[0], listen = group('listening-need')[0];
  assert.equal(observation(read, 'ko.reading.detail').independentIncorrect, 3);
  assert.equal(observation(read, 'ko.listening.detail').independentCorrect, 4);
  assert.equal(candidate(read).modality, 'reading');
  assert.equal(candidate(listen).modality, 'listening');
});

test('help-only successful responses never become independent observations', () => {
  const stages = group('assisted-only');
  assert.equal(stages[0].rubric.acceptableCandidateIds.length, 0);
  for (const row of stages) {
    const fact = observation(row, 'ko.reading.negation');
    assert.equal(fact.firstIndependentAttempts, 0);
    assert.equal(fact.knownUnassistedAttempts, 0);
  }
  assert.equal(observation(stages[0], 'ko.reading.negation').coverage, 'no-observed-attempts');
  assert.equal(observation(stages[2], 'ko.reading.negation').assistedCorrect, 5);
  assert.equal(observation(stages[2], 'ko.reading.negation').newExposureAttempts, 5);
  assert.equal(candidate(stages[2]).skillId, 'ko.reading.negation');
});

test('eight right repeated responses preserve one original independent error and unknown help coverage', () => {
  const row = group('repeated-only')[2], fact = observation(row, 'ko.reading.detail');
  assert.equal(fact.totalAttempts, 9); assert.equal(fact.repeatCorrect, 8);
  assert.equal(fact.repeatAttempts, 8); assert.equal(fact.newExposureAttempts, 1);
  assert.equal(fact.assistedCorrect, 0); assert.equal(fact.unknownAssistanceAttempts, 4);
  assert.equal(fact.knownUnassistedAttempts, 5);
  assert.equal(fact.firstIndependentAttempts, 1); assert.equal(fact.independentCorrect, 0);
  assert.equal(fact.independentIncorrect, 1); assert.equal(fact.uniquePresentedFamilies, 1);
});

test('real new item success changes Core baseline while same item retries do not fabricate progress', () => {
  const stages = group('recovered-new-items');
  assert.equal(observation(stages[1], 'ko.reading.detail').independentCorrect, 0);
  const last = observation(stages[2], 'ko.reading.detail');
  assert.equal(last.firstIndependentAttempts, 10); assert.equal(last.independentCorrect, 8); assert.equal(last.independentIncorrect, 2);
  assert.equal(last.uniquePresentedFamilies, 10);
  assert.notEqual(candidate(stages[2]).skillId, 'ko.reading.detail');
  assert.equal(stages[2].rubric.acceptableCandidateIds.length, 0);
});

test('current audio unavailability changes allowed modality without counting failed playback as errors', () => {
  const stages = group('audio-unavailable');
  assert.equal(candidate(stages[0]).modality, 'listening');
  for (const row of stages.slice(1)) {
    assert.equal(candidate(row).modality, 'reading');
    assert.equal(row.baseline.evidenceId, 'obs-current-audio');
    assert.ok(row.rubric.forbiddenCandidateIds.length > 0);
    assert.ok(row.rubric.acceptableCandidateIds.length > 1);
    for (const id of row.rubric.forbiddenCandidateIds) assert.equal(row.input.candidates.find(c => c.id === id).audioRequired, true);
  }
  const before = observation(stages[1], 'ko.listening.detail'), after = observation(stages[2], 'ko.listening.detail');
  assert.equal(after.firstIndependentAttempts, before.firstIndependentAttempts);
  assert.equal(after.independentIncorrect, before.independentIncorrect);
  assert.equal(after.unassessedAttempts, 1); assert.equal(after.audioFailureAttempts, 1);
});
