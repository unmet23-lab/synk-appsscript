import test from 'node:test';
import assert from 'node:assert/strict';
import { lessonById } from '../life-content.mjs';
import { cafeCompletionMarkup } from '../cafe-ui.mjs';

const lessonId = 'cafe-apply';
const questions = lessonById(lessonId).questions;
const render = answers => cafeCompletionMarkup({ lessonId, answers });

test('a correct first answer with help is described as help, not reselection', () => {
  const html = render({ [questions[0].id]: { correct: true, helped: true } });
  assert.match(html, /1곳에서 도움을 받아 골랐어요/);
  assert.doesNotMatch(html, /다시 골랐어요/);
});

test('a corrected answer and a helped answer retain distinct descriptions', () => {
  const html = render({
    [questions[0].id]: { correct: false, helped: true },
    [questions[1].id]: { correct: true, helped: true },
  });
  assert.match(html, /1곳에서 다시 골랐어요/);
  assert.match(html, /1곳에서 도움을 받아 골랐어요/);
});

test('unassisted correct answers do not invent a review reason', () => {
  const html = render(Object.fromEntries(questions.map(q => [q.id, { correct: true, helped: false }])));
  assert.doesNotMatch(html, /life-result-again|다시 골랐어요|도움을 받아 골랐어요/);
});
