import test from 'node:test';
import assert from 'node:assert/strict';
import { PACKS, LESSONS, CONTENT_VERSION, lessonById, packById } from '../life-content.mjs';

const slug = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const questions = LESSONS.flatMap(item => item.questions);
const allQuestions = questions.flatMap(item => [item, item.review]);

test('six complete packs include cafe visits, order composition, and 132 authored questions', () => {
  assert.deepEqual(PACKS.map(item => item.id), ['greetings', 'cafe', 'store', 'directions', 'transit', 'plans']);
  assert.equal(LESSONS.length, 22);
  assert.equal(questions.length, 66);
  assert.equal(allQuestions.length, 132);
  assert.ok(CONTENT_VERSION.startsWith('life-ko-'));
  for (const pack of PACKS) {
    assert.deepEqual(pack.lessons.map(item => item.type), pack.id === 'cafe' ? ['expressions', 'story', 'apply', 'visit', 'visit', 'visit', 'compose'] : ['expressions', 'story', 'apply'], pack.id);
    assert.equal(pack.skills.length, pack.id === 'cafe' ? 7 : 3, pack.id);
    assert.ok(pack.title && pack.subtitle && pack.icon && pack.level, pack.id);
    for (const item of pack.lessons) assert.equal(item.questions.length, 3, item.id);
  }
});

test('stable identifiers are unique and exported lookups return the same catalog', () => {
  for (const collection of [PACKS, LESSONS, allQuestions]) {
    const ids = collection.map(item => item.id);
    assert.equal(new Set(ids).size, ids.length);
    ids.forEach(id => assert.match(id, slug));
  }
  for (const pack of PACKS) assert.equal(packById(pack.id), pack);
  for (const item of LESSONS) {
    assert.equal(lessonById(item.id), item);
    assert.equal(packById(item.packId).lessons.some(lesson => lesson.id === item.id), true);
  }
  assert.equal(lessonById('missing-lesson'), null);
  assert.equal(packById('missing-pack'), null);
});

test('every question has one answer among distinct short choices and an explanation', () => {
  for (const item of allQuestions) {
    assert.equal(typeof item.prompt, 'string', item.id);
    assert.ok(item.prompt.trim().length, item.id);
    assert.equal(typeof item.context, 'string', item.id);
    assert.deepEqual(item.choices.map(choice => choice.id), ['a', 'b', 'c'], item.id);
    assert.equal(item.choices.filter(choice => choice.id === item.answerId).length, 1, item.id);
    assert.equal(new Set(item.choices.map(choice => choice.text.trim())).size, 3, item.id);
    for (const choice of item.choices) {
      assert.ok(choice.text.trim().length > 0 && [...choice.text].length <= 55, `${item.id}:${choice.id}`);
      assert.equal(choice.text, choice.text.trim(), `${item.id}:${choice.id}`);
    }
    assert.ok(item.explanation.trim().length >= 12, item.id);
  }
});

test('questions and reviews retain an existing reading skill and expression family', () => {
  for (const pack of PACKS) {
    const skills = new Set(pack.skills.map(item => item.id));
    for (const item of pack.skills) {
      assert.match(item.id, slug);
      assert.equal(item.domain, 'reading');
    }
    for (const item of pack.lessons) {
      assert.ok(item.goal.length > 0, item.id);
      const expressions = new Set(item.expressions.map(expression => expression.id));
      for (const expression of item.expressions) {
        assert.match(expression.id, slug);
        assert.ok(expression.korean && expression.meaning, expression.id);
      }
      for (const question of item.questions) {
        for (const variant of [question, question.review]) {
          assert.ok(skills.has(variant.skillId), variant.id);
          assert.ok(expressions.has(variant.expressionId), variant.id);
        }
        assert.equal(question.review.skillId, question.skillId);
        assert.equal(question.review.expressionId, question.expressionId);
      }
    }
  }
});

test('all reviews change the supplied situation rather than only shuffling answers', () => {
  for (const item of questions) {
    assert.equal(item.review.id, `${item.id}-transfer`);
    const supplied = `${item.prompt}\n${item.context}`.replace(/\s+/g, ' ').trim();
    const reviewSupplied = `${item.review.prompt}\n${item.review.context}`.replace(/\s+/g, ' ').trim();
    assert.notEqual(reviewSupplied, supplied, item.id);
    assert.ok(!/위 이야기|앞 이야기|아까 이야기|위 장면/.test(reviewSupplied), item.id);
  }
});

test('six story episodes contain a complete scene and all three distinct friends', () => {
  for (const item of LESSONS.filter(item => item.type === 'story')) {
    assert.ok(item.scenes.length >= 8, item.id);
    const speakers = new Set(item.scenes.map(scene => scene.speaker));
    assert.deepEqual([...speakers].sort(), ['kkamong', 'marine', 'mongle', 'narrator']);
    assert.equal(item.scenes[0].speaker, 'narrator', item.id);
    assert.ok(item.scenes.at(-1).text.length, item.id);
  }
});

test('character dialogue preserves the approved text voice and contains no added narration channel', () => {
  for (const item of LESSONS) {
    for (const scene of item.scenes) {
      assert.ok(['mongle', 'kkamong', 'marine', 'narrator'].includes(scene.speaker), item.id);
      assert.ok(scene.text.trim().length, item.id);
      assert.equal('audio' in scene, false, item.id);
      assert.equal('voice' in scene, false, item.id);
      if (scene.speaker === 'marine') {
        assert.doesNotMatch(scene.text, /[!?！？]|귀여워|좋아해|ㅋㅋ|하하/, item.id);
        assert.match(scene.text, /확인|완료|보고|수칙|기록|준비|…/, item.id);
      }
      if (scene.speaker === 'mongle') {
        assert.match(scene.text, /[!?]/, item.id);
        assert.doesNotMatch(scene.text, /틀렸어|안 돼|싫어|몰라/, item.id);
      }
      if (scene.speaker === 'kkamong') assert.match(scene.text, /이 몸|내가|내 |나는|나 |용/, item.id);
    }
  }
});

test('content is serializable and does not claim speech practice, levels, or proven outcomes', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(PACKS)), PACKS);
  const content = JSON.stringify(PACKS);
  assert.doesNotMatch(content, /점수 향상|합격 보장|듣기 연습|듣기 실력|말하기 평가|1급 달성|2급 달성/);
  assert.doesNotMatch(content, /<script|javascript:|undefined|�/);
  assert.match(content, /기초 생활 한국어/);
});
