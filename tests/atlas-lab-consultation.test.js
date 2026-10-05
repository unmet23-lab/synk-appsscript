'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Ask = require('../atlas/ask');
const rules = require('../docs/마케팅/맞춤도구/computer/rules');
const content = require('../docs/마케팅/맞춤도구/computer/content');
const adapter = import('../experiences/atlas-lab/consultation.mjs').then(({ createComputerConsultation }) => createComputerConsultation({ Ask, rules, content }));

test('real local-AI workload capacity supplies a distinct question-value basis', async () => {
  const consultation = await adapter, answers = { uses: ['localai'] };
  const byChange = Ask.choose({ questions: consultation.questions(answers), decide: consultation.decision, answers, budget: 99 });
  const byValue = consultation.choose(answers);
  assert.equal(byChange.value, undefined, 'legacy change ranking does not claim a policy value');
  assert.equal(byValue.question.id, 'localai');
  assert.ok(byValue.value > 0);
  assert.equal(byValue.basis, 'declared-decision-value');
  assert.ok(byValue.questions.every(q => q.options.every(option => !Object.hasOwn(option, 'p'))), 'no invented response frequencies');
});

test('a changed RAM suggestion with no reduction in the workload loss can be skipped', async () => {
  const consultation = await adapter;
  const entry = consultation.choose({ uses: ['localai'] }).ranked.find(q => q.id === 'multitask');
  assert.ok(entry.impact > 0, 'the underlying rule does change a recommendation');
  assert.equal(entry.value, 0);
  assert.equal(entry.skippable, true);
  assert.equal(entry.reason, 'no-positive-decision-value');
});

test('underpowered recommendations lose value against the same declared task and unnecessary capacity is penalized', async () => {
  const consultation = await adapter;
  const light = { uses: ['localai'], localai: ['small'], os: 'mac', owned: 'new' };
  const heavy = { ...light, localai: ['huge'] };
  const lightPlan = consultation.decision(light), heavyPlan = consultation.decision(heavy);
  assert.equal(consultation.evaluate({ decision: heavyPlan, answers: heavy }).loss, 0);
  assert.ok(consultation.evaluate({ decision: lightPlan, answers: heavy }).loss > 0);
  assert.ok(consultation.evaluate({ decision: heavyPlan, answers: light }).loss > 0, 'avoid overspecifying a small workload');
});

test('unified memory and discrete graphics each use their own platform workload requirements', async () => {
  const consultation = await adapter;
  for (const os of ['mac', 'win']) {
    const answers = { uses: ['localai'], localai: ['large'], os, owned: 'new' };
    const decision = consultation.decision(answers);
    assert.equal(consultation.evaluate({ decision, answers }).loss, 0);
    assert.equal(decision.content.gpu.kind, os === 'mac' ? 'unified' : 'dedicated');
  }
});

test('budget warnings have question value even when the hardware recommendation stays identical', async () => {
  const consultation = await adapter;
  const before = { uses: ['localai'], localai: ['huge'], os: 'mac', owned: 'new' };
  const after = { ...before, budget: 'lt100' };
  const initial = consultation.decision(before), informed = consultation.decision(after);
  assert.equal(initial.content.ram, informed.content.ram);
  assert.equal(initial.content.storage, informed.content.storage);
  assert.equal(initial.content.budgetWarning, false);
  assert.equal(informed.content.budgetWarning, true);
  assert.ok(consultation.evaluate({ decision: initial, answers: after }).loss > consultation.evaluate({ decision: informed, answers: after }).loss);
  assert.ok(consultation.choose(before).ranked.find(q => q.id === 'budget').value > 0);
  assert.match(consultation.summary(consultation.compute(after)), /모델을 한 단계 작게/);
});

test('owning a computer opens its real check questions and enough RAM preserves a keep-before-buy recommendation', async () => {
  const consultation = await adapter;
  assert.equal(consultation.questions({ uses: ['web'] }).some(q => q.id === 'current.ram'), false);
  const answers = { uses: ['web'], owned: 'have' };
  assert.equal(consultation.choose(answers).question.id, 'current.ram');
  const enough = { ...answers, 'current.ram': '32' };
  const result = consultation.compute(enough);
  assert.equal(result.headline.keep, true);
  assert.match(consultation.summary(result), /지금처럼 쓰다가/);
  const feel = consultation.choose(enough).ranked.find(q => q.id === 'current.feel');
  assert.ok(feel.value > 0, 'slow behavior calls for inspecting the cause even with sufficient RAM');
  const slow = { ...enough, 'current.feel': 'slow' };
  assert.ok(consultation.decision(slow).content.current.actions.includes('check-slowness-cause'));
});

test('actual current-system warnings appear in the same result the question value evaluates', async () => {
  const consultation = await adapter;
  const answers = { uses: ['web'], owned: 'have', 'current.ram': '32', 'current.os': 'win10' };
  assert.ok(consultation.decision(answers).content.current.actions.includes('check-win11-upgrade'));
  assert.match(consultation.summary(consultation.compute(answers)), /윈도우 10은/);
});

test('multi-select analysis covers the original six choices and combined AI platform requirements', async () => {
  const consultation = await adapter;
  const answers = { uses: ['localai'], owned: 'new', place: 'home' };
  const question = consultation.questions(answers).find(q => q.id === 'localai');
  assert.equal(question.selection, 'multiple');
  assert.equal(question.displayOptions.length, 6);
  assert.equal(question.options.length, 63);
  assert.equal(new Set(question.options.map(option => JSON.stringify(option.value))).size, 63);
  assert.ok(question.options.some(option => option.value.includes('unsure') && option.value.includes('image')), 'the original wizard permits unsure alongside named workloads');
  const combined = question.options.find(option => JSON.stringify(option.value) === JSON.stringify(['large', 'image']));
  assert.ok(combined);
  const large = consultation.decision({ ...answers, localai: ['large'] }).content;
  const imageAndLarge = consultation.decision({ ...answers, localai: combined.value }).content;
  assert.equal(large.os, 'mac');
  assert.equal(large.ram, 48);
  assert.equal(imageAndLarge.os, 'win');
  assert.equal(imageAndLarge.ram, 32);
  assert.equal(imageAndLarge.gpu.vram, 24);
  const ranked = consultation.choose(answers).ranked.find(q => q.id === 'localai');
  assert.deepEqual(ranked.outcomes[combined.id].content, imageAndLarge);
});

test('mobile-development platform conflicts keep the code question valuable when capacities do not change', async () => {
  const consultation = await adapter;
  const before = { uses: ['localai', 'code'], localai: ['huge'], owned: 'new', os: 'win', place: 'home' };
  const after = { ...before, code: 'mobile' };
  const initial = consultation.decision(before), informed = consultation.decision(after);
  assert.equal(initial.content.ram, informed.content.ram);
  assert.equal(initial.content.storage, informed.content.storage);
  assert.deepEqual(informed.content.osConflicts, ['ios-development-requires-mac']);
  assert.equal(consultation.evaluate({ decision: informed, answers: after }).loss, 0);
  assert.equal(consultation.evaluate({ decision: initial, answers: after }).loss, 1);
  const entry = consultation.choose(before).ranked.find(q => q.id === 'code');
  assert.ok(entry.value > 0);
  assert.equal(entry.skippable, false);
  assert.match(consultation.summary(consultation.compute(after)), /Xcode/);
});

test('device-kind advice retains SYNK-origin actions as one diagnosis condition', async () => {
  const consultation = await adapter;
  const before = { uses: ['localai'], localai: ['huge'], owned: 'have', 'current.ram': '4' };
  const laptopAnswers = { ...before, 'current.kind': 'laptop' }, desktopAnswers = { ...before, 'current.kind': 'desktop' };
  const laptop = consultation.decision(laptopAnswers), desktop = consultation.decision(desktopAnswers);
  assert.ok(laptop.content.current.actions.includes('add-desktop-for-heavy-work'));
  assert.ok(desktop.content.current.actions.includes('consider-ram-upgrade'));
  assert.equal(laptop.content.current.verdict, desktop.content.current.verdict);
  assert.equal(consultation.evaluate({ decision: laptop, answers: laptopAnswers }).loss, 0);
  assert.equal(consultation.evaluate({ decision: desktop, answers: laptopAnswers }).loss, 1, 'multiple changed action codes do not double-count one diagnosis');
  const entry = consultation.choose(before).ranked.find(q => q.id === 'current.kind');
  assert.ok(entry.value > 0);
  assert.equal(entry.skippable, false);
  assert.match(consultation.summary(consultation.compute(laptopAnswers)), /데스크톱을 더하세요/);
  assert.match(consultation.summary(consultation.compute(desktopAnswers)), /램만 더 꽂는/);
});

test('advice semantics survive display wording changes and every conflict is shown', async () => {
  const { createComputerConsultation } = await import('../experiences/atlas-lab/consultation.mjs');
  const consultation = await adapter;
  const rewritten = createComputerConsultation({ Ask, content, rules: { ...rules, compute: input => {
    const result = rules.compute(input);
    for (const entry of [...result.os.conflicts, ...(result.current?.actions || [])]) entry.t = '새 설명';
    return result;
  } } });
  const answers = { uses: ['localai', 'game'], localai: ['image'], os: 'mac', owned: 'have', 'current.ram': '4', 'current.kind': 'laptop' };
  assert.deepEqual(rewritten.decision(answers), consultation.decision(answers));
  const summary = consultation.summary(consultation.compute(answers));
  assert.match(summary, /엔비디아/);
  assert.match(summary, /게임이 맥을 지원/);
});

test('answered questions are not repeated and changing the chosen use does not mutate the caller records', async () => {
  const consultation = await adapter;
  const answers = { uses: ['web'], owned: 'new', os: 'win', place: 'home' }, before = structuredClone(answers);
  const result = consultation.choose(answers);
  assert.ok(result.ranked.every(entry => !Object.hasOwn(answers, entry.about)));
  assert.deepEqual(answers, before);
  assert.ok(consultation.questions({ uses: ['video'] }).some(q => q.id === 'video.app'));
  assert.equal(consultation.questions(answers).some(q => q.id === 'video.app'), false);
});
