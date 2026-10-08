import test from 'node:test';
import assert from 'node:assert/strict';
import Ask from '../atlas/ask.js';
import content from '../docs/마케팅/맞춤도구/computer/content.js';
import rules from '../docs/마케팅/맞춤도구/computer/rules.js';
import { createComputerConsultation, COMPLETION_POLICY } from '../experiences/atlas-lab/consultation.mjs';

const consultation = createComputerConsultation({ Ask, content, rules });
const buying = { uses: ['web'], owned: 'new', os: 'any', place: 'home', budget: 'lt100' };
const reuse = { uses: ['web'], owned: 'have', os: 'any', 'current.ram': '32', 'current.os': 'win11', 'current.feel': 'ok' };

test('a missing required budget continues in the same question flow after recommendation questions stop', () => {
  const answers = { ...buying }; delete answers.budget;
  const choice = consultation.choose(answers);
  assert.equal(choice.status, 'ask');
  assert.equal(choice.question.id, 'budget');
  assert.equal(choice.reason, 'required-input-confirmation');
  assert.equal(choice.basis, 'product-completion');
  assert.equal(choice.value, undefined, 'required completion must not invent recommendation value');
  assert.equal(choice.ranked.find(entry => entry.id === 'budget').skippable, false);
  assert.equal(choice.completion.status, 'provisional');
  assert.deepEqual(choice.completion.unresolvedRequiredFields, ['budget']);
  assert.deepEqual(choice.completion, consultation.completion(answers));
  assert.equal(consultation.completion(buying).status, 'ready');
  assert.equal(consultation.choose(buying).status, 'none');
});

test('an explicit unknown remains provisional without trapping the person in a repeated required question', () => {
  for (const budget of [undefined, null, 'invalid']) {
    const choice = consultation.choose({ ...buying, budget });
    assert.equal(choice.question.id, 'budget');
  }
  const choice = consultation.choose({ ...buying, budget: 'unknown' });
  assert.equal(choice.status, 'none');
  assert.equal(choice.completion.status, 'provisional');
  assert.deepEqual(choice.completion.unresolvedRequiredFields, ['budget']);
});

test('known answers finish required confirmations without asking inactive or unnecessary fields', () => {
  const paths = [
    { ...buying, multitask: 'light' },
    { ...reuse, place: 'home', multitask: 'light' },
    { ...buying, uses: ['video'], 'video.app': 'fcp', 'video.res': '4k', 'video.load': 'light', multitask: 'light' },
    { ...buying, uses: ['video'], 'video.app': 'capcut', 'video.res': 'fhd', 'video.load': 'light', multitask: 'light' },
    { ...buying, uses: ['localai'], localai: ['large', 'image'], multitask: 'normal' },
    { ...reuse, 'current.ram': '4', 'current.kind': 'desktop', place: 'home', budget: 'lt100', multitask: 'light' },
  ];
  for (const full of paths) {
    const answers = { uses: full.uses }, asked = [];
    for (let count = 0; count < 30; count++) {
      const choice = consultation.choose(answers);
      if (choice.status !== 'ask') break;
      const id = choice.question.about;
      assert.equal(asked.includes(id), false, `repeated ${id}`);
      assert.ok(Object.hasOwn(full, id), `unexpected ${id}`);
      assert.equal(choice.ranked.find(entry => entry.about === id).skippable, false);
      answers[id] = full[id]; asked.push(id);
    }
    assert.equal(consultation.choose(answers).status, 'none');
    assert.equal(consultation.completion(answers).status, 'ready', JSON.stringify({ full, answers }));
    assert.equal(asked.some(id => id.startsWith('video.') && !full.uses.includes('video')), false);
    if (full.owned === 'have' && full['current.ram'] === '32') {
      assert.equal(asked.includes('budget'), false);
    }
    if (full['video.res'] === '4k') assert.equal(consultation.completion(answers).requiredFields.includes('video.load'), false);
  }
});

test('unknown and malformed budgets cannot confirm a purchase, while any OS is a real preference', () => {
  for (const budget of [undefined, 'unknown', 'unsure', 'plenty', null, 100, ['lt100']]) {
    const result = consultation.completion({ ...buying, budget });
    assert.equal(result.status, 'provisional'); assert.ok(result.unresolvedRequiredFields.includes('budget'));
  }
  const result = consultation.completion(buying);
  assert.equal(result.status, 'ready'); assert.equal(result.policy, COMPLETION_POLICY);
  assert.equal(result.scope, 'specification-guidance'); assert.equal(result.budget.state, 'known');
  assert.ok(result.assumptions.some(item => item.id === 'multitask'));
  assert.deepEqual(consultation.completion({ ...buying, multitask: 'light' }).assumptions, []);
});

test('reuse can finish without a budget, but missing current-device evidence is not a buying decision', () => {
  const complete = consultation.completion({ ...reuse, budget: 'unknown' });
  assert.equal(complete.status, 'ready'); assert.equal(complete.path, 'reuse');
  assert.equal(complete.budget.required, false);
  assert.ok(!complete.requiredFields.includes('place')); assert.ok(!complete.requiredFields.includes('current.kind'));
  for (const id of ['current.ram', 'current.os', 'current.feel']) {
    const answers = { ...reuse }; delete answers[id];
    const result = consultation.completion(answers);
    assert.equal(result.status, 'provisional'); assert.equal(result.path, 'undetermined');
    assert.equal(result.budget.required, false); assert.ok(result.unresolvedRequiredFields.includes(id));
  }
});

test('a confirmed insufficient machine and an explicit extra purchase open buying requirements', () => {
  const answers = { ...reuse, 'current.ram': '4', 'current.kind': 'desktop' };
  const result = consultation.completion(answers);
  assert.equal(result.path, 'purchase'); assert.equal(result.budget.required, true);
  assert.ok(result.unresolvedRequiredFields.includes('budget')); assert.ok(result.unresolvedRequiredFields.includes('place'));
  assert.equal(consultation.completion({ ...answers, budget: 'lt100', place: 'home' }).status, 'ready');
  assert.equal(consultation.completion({ ...reuse, owned: 'extra' }).budget.required, true);
});

test('heavy work and insufficient memory require the machine type needed by the existing advice branches', () => {
  for (const answers of [{ ...reuse, 'current.ram': '4' }, { ...reuse, uses: ['localai'], localai: ['huge'] }]) {
    const result = consultation.completion(answers);
    assert.equal(result.status, 'provisional'); assert.ok(result.unresolvedRequiredFields.includes('current.kind'));
    assert.equal(result.path, 'undetermined');
  }
});

test('workload edits recalculate requirements and inactive old unknowns cannot block a different use', () => {
  const video = { ...buying, uses: ['video'], 'video.app': 'capcut', 'video.res': '4k' };
  assert.equal(consultation.completion(video).status, 'ready');
  assert.ok(!consultation.completion(video).requiredFields.includes('video.load'));
  assert.ok(consultation.completion({ ...video, 'video.res': 'fhd' }).unresolvedRequiredFields.includes('video.load'));
  assert.ok(consultation.completion({ ...video, 'video.app': 'unknown' }).unresolvedRequiredFields.includes('video.app'));
  assert.equal(consultation.completion({ ...buying, 'video.app': 'unknown', 'current.ram': 'unknown', localai: ['unsure'] }).status, 'ready');
  assert.ok(consultation.completion({ ...buying, uses: ['web', 'localai'] }).unresolvedRequiredFields.includes('localai'));
});

test('uncertain, duplicate and empty multi-select inputs never establish a known workload', () => {
  for (const localai of [[], ['unsure'], ['small', 'unsure'], ['small', 'small'], ['invented'], 'small']) {
    const result = consultation.completion({ ...buying, uses: ['localai'], localai });
    assert.equal(result.status, 'provisional'); assert.ok(result.unresolvedRequiredFields.includes('localai'));
  }
  assert.equal(consultation.completion({ ...buying, uses: ['localai'], localai: ['small', 'image'] }).status, 'ready');
  for (const uses of [[], ['bad'], ['web', 'web'], 'web', null]) assert.equal(consultation.completion({ ...buying, uses }).status, 'not-started');
});

test('confirmed inputs do not erase feasibility warnings or turn an untried machine into measured success', () => {
  const answers = { ...buying, uses: ['localai', 'code'], localai: ['huge'], code: 'mobile', os: 'win' };
  assert.equal(consultation.completion(answers).status, 'ready');
  assert.equal(consultation.compute(answers).budget.warn, true);
  assert.ok(consultation.decision(answers).content.osConflicts.includes('ios-development-requires-mac'));
  const untried = { ...reuse, 'current.feel': 'untried' };
  assert.equal(consultation.completion(untried).status, 'ready');
  assert.ok(consultation.decision(untried).content.current.actions.includes('try-workload-before-buying'));
});

test('completion is a fresh nonmutating snapshot and an unknown field is never known', () => {
  const answers = structuredClone(buying), before = structuredClone(answers);
  const first = consultation.completion(answers); first.requiredFields.length = 0; first.fields[0].state = 'invalid';
  assert.deepEqual(answers, before); assert.equal(consultation.completion(answers).status, 'ready');
  assert.ok(consultation.completion(answers).requiredFields.includes('uses'));
  assert.equal(consultation.answerState('invented', 'yes'), 'invalid');
});
