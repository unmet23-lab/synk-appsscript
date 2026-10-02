import test from 'node:test';
import assert from 'node:assert/strict';
import { TUTORIAL_KEY, loadTutorial, saveTutorialCompleted, createTutorial } from '../tutorial.js';

function memoryStorage(initial) {
  const values = new Map(initial ? [[TUTORIAL_KEY, initial]] : []);
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

function steer(tutorial) {
  assert.equal(tutorial.observeOffset(1.8), true);
  assert.equal(tutorial.step, 'steer-right');
  assert.equal(tutorial.observeOffset(-1.8), true);
  assert.equal(tutorial.step, 'listen');
}

test('steering uses the screen direction and cannot be completed by waiting or button events', () => {
  const tutorial = createTutorial();
  assert.equal(tutorial.step, 'steer-left');
  for (const offset of [-3.45, 0, 1.799, NaN, Infinity]) assert.equal(tutorial.observeOffset(offset), false);
  assert.equal(tutorial.tick(30), false);
  assert.equal(tutorial.beginQuestion(), false);
  assert.equal(tutorial.resolveAnswer('school'), false);
  assert.equal(tutorial.activateBoost(), false);
  assert.equal(tutorial.step, 'steer-left');
  assert.equal(tutorial.observeOffset(3.45), true);
  for (const offset of [3.45, 0, -1.799, NaN]) assert.equal(tutorial.observeOffset(offset), false);
  assert.equal(tutorial.step, 'steer-right');
  assert.equal(tutorial.observeOffset(-3.45), true);
  assert.equal(tutorial.step, 'listen');
});

test('the learner can retry a wrong answer and must activate the earned booster to finish', () => {
  const tutorial = createTutorial({ answerId: '학교' });
  steer(tutorial);
  assert.equal(tutorial.tick(300), false);
  assert.equal(tutorial.beginQuestion(), true);
  assert.equal(tutorial.step, 'choose');
  assert.equal(tutorial.resolveAnswer('시장'), false);
  assert.equal(tutorial.step, 'choose');
  assert.equal(tutorial.mistakes, 1);
  assert.equal(tutorial.activateBoost(), false);
  assert.equal(tutorial.resolveAnswer('학교'), true);
  assert.equal(tutorial.step, 'boost-ready');
  assert.equal(tutorial.tick(30), false);
  assert.equal(tutorial.activateBoost(), true);
  assert.equal(tutorial.step, 'boosting');
  assert.equal(tutorial.tick(2), false);
  assert.equal(tutorial.boostElapsed, 2);
  assert.equal(tutorial.tick(.5), true);
  assert.equal(tutorial.step, 'complete');
  assert.equal(tutorial.boostElapsed, 2.5);
});

test('duplicate and out-of-order callbacks cannot skip a step or restart a completed practice', () => {
  const tutorial = createTutorial();
  steer(tutorial);
  assert.equal(tutorial.beginQuestion('병원'), true);
  assert.equal(tutorial.beginQuestion('학교'), false);
  assert.equal(tutorial.resolveAnswer('병원'), true);
  assert.equal(tutorial.resolveAnswer('병원'), false);
  assert.equal(tutorial.resolveAnswer('학교'), false);
  assert.equal(tutorial.mistakes, 0);
  assert.equal(tutorial.activateBoost(), true);
  assert.equal(tutorial.activateBoost(), false);
  for (const dt of [0, -1, NaN, Infinity]) assert.equal(tutorial.tick(dt), false);
  assert.equal(tutorial.boostElapsed, 0);
  assert.equal(tutorial.tick(10), true);
  assert.equal(tutorial.tick(10), false);
  assert.equal(tutorial.beginQuestion(), false);
  assert.equal(tutorial.observeOffset(3.45), false);
  assert.equal(tutorial.activateBoost(), false);
  assert.equal(tutorial.step, 'complete');
});

test('practice progression never writes completion or learning/reward data on its own', () => {
  const storage = memoryStorage();
  const tutorial = createTutorial();
  steer(tutorial);
  tutorial.beginQuestion();
  tutorial.resolveAnswer('school');
  tutorial.activateBoost();
  tutorial.tick(2.5);
  assert.deepEqual(loadTutorial(storage), { completed: false, available: true });
  assert.equal(storage.values.size, 0);
  assert.equal(saveTutorialCompleted(storage), true);
  assert.deepEqual(loadTutorial(storage), { completed: true, available: true });
  assert.deepEqual([...storage.values.keys()], [TUTORIAL_KEY]);
});

test('corrupt and unsupported saved states fall back to practice and recover on explicit completion', () => {
  for (const raw of ['{broken', 'null', 'true', '[]', '{"version":2,"completed":true}', '{"version":1,"completed":"true"}']) {
    const storage = memoryStorage(raw);
    assert.deepEqual(loadTutorial(storage), { completed: false, available: true });
    assert.equal(storage.values.get(TUTORIAL_KEY), raw);
    assert.equal(saveTutorialCompleted(storage), true);
    assert.deepEqual(loadTutorial(storage), { completed: true, available: true });
  }
});

test('missing or blocked browser storage leaves practice available without throwing', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const gettersBlocked = { get getItem() { throw new Error('blocked'); } };
  for (const storage of [undefined, null, {}, blocked, gettersBlocked]) {
    assert.deepEqual(loadTutorial(storage), { completed: false, available: false });
    assert.equal(saveTutorialCompleted(storage), false);
  }
  const full = { getItem: () => null, setItem() { throw new Error('quota exceeded'); } };
  assert.deepEqual(loadTutorial(full), { completed: false, available: true });
  assert.equal(saveTutorialCompleted(full), false);
});

test('a missing question ID cannot award a booster', () => {
  assert.throws(() => createTutorial({ answerId: '' }), TypeError);
  const tutorial = createTutorial();
  steer(tutorial);
  assert.equal(tutorial.beginQuestion(''), false);
  assert.equal(tutorial.step, 'listen');
  assert.equal(tutorial.beginQuestion(), true);
  for (const id of [undefined, null, '', '   ', true]) assert.equal(tutorial.resolveAnswer(id), false);
  assert.equal(tutorial.step, 'choose');
  assert.equal(tutorial.mistakes, 0);
});
