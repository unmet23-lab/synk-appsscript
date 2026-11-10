// 바깥 입구(src/index.mjs)의 내보내기 — 두뇌가 ts-fsrs를 부르므로 의존을 깐 build 묶음에서 본다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';

const atlas = await subject();

test('바깥 입구는 판 이름 · 코치 · 계기 · 사건 이름표를 내보낸다', () => {
  assert.equal(atlas.EDITION, 'dev', '소스의 판 이름은 dev — 빌드가 찍는다');
  assert.equal(typeof atlas.createCoach, 'function');
  assert.equal(typeof atlas.createHealth, 'function');
  assert.equal(atlas.EVENT_FORM.current, 2);
  assert.equal(atlas.EVENT_TYPES.stated, 'unit.stated');
});

test('바깥 입구는 두뇌(단계 2)를 내보낸다 — 기억 · 난도 · 접기 · 얹기 · 고르기 · 이유', () => {
  for (const name of [
    'createMemory',
    'gradeOf',
    'abilityOf',
    'stepSkill',
    'evidenceOf',
    'checkFoldEvent',
    'foldServer',
    'foldUnit',
    'foldSkill',
    'firstMeeting',
    'skillRowsOf',
    'createView',
    'overlay',
    'applyOwn',
    'touchedBy',
    'createLearner',
    'startSession',
    'choose',
    'present',
    'record',
    'say',
    'predictParts',
    'planActivities',
    'filterCandidates',
    'reasonLine',
  ])
    assert.equal(typeof atlas[name], 'function', name);
  assert.deepEqual(
    { ...atlas.EDITIONS },
    { params: 'params-1', memory: 'memory-1', ability: 'ability-1', select: 'select-1' },
  );
  assert.ok(Object.isFrozen(atlas.PARAMS));
});
