'use strict';
// The TOPIK I map's content layers: grammar and words under the fifteen abilities. Items can
// name the words and grammar they use, and the engine tells which content was missed lately.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMap } = require('../strata');
const { topikMap } = require('../strata/topik-i');
const { createGame } = require('../atlas/game-learning');
const Learning = require('../atlas/learning');
const map = createMap(topikMap());
const memory = () => { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) }; };

test('the map holds abilities, grammar and words, and none of them claims a TOPIK grade', () => {
  const nodes = map.allNodes(), count = kind => nodes.filter(n => n.kind === kind).length;
  assert.deepEqual([count('skill'), count('grammar_point'), count('word')], [15, 45, 2000]);
  assert.equal(map.getNode('ko.word.w0001').label_ko, '사과');
  assert.equal(map.getNode('ko.word.w0001').level, null, 'a word band is source metadata, not a level');
  assert.equal(map.getNode('G209').level.basis, 'grammar_bank', 'a grammar step is the grammar bank order');
  // Negation grammar serves both negation abilities as well as grammar reading.
  const raw = require('../strata/maps/topik-i.json');
  const links = raw.edges.filter(e => e.from === 'G209').map(e => e.to).sort();
  assert.deepEqual(links, ['ko.listening.negation', 'ko.reading.grammar', 'ko.reading.negation']);
  assert.ok(raw.edges.every(e => e.confidence === 'ai_draft' && e.reviewed === false), 'links are drafts awaiting review');
});

function play() {
  let t = Date.parse('2026-10-01T00:00:00Z');
  return createGame({ gameId: 'words', map, storage: memory(), clock: () => new Date(t += 1000).toISOString() });
}
const wordItem = (n, word, extra = {}) => ({ id: `q${n}`, itemKey: `item.${n}`, skillId: 'ko.listening.word', modality: 'listening', difficulty: 1,
  responseFormat: 'single-choice', conceptIds: [`ko.word.${word}`], ...extra });

test('an item names the words and grammar it uses; abilities and unknown ids are refused there', () => {
  const game = play();
  const pid = game.present(wordItem(1, 'w0001', { conceptIds: ['ko.word.w0001', 'G209'] }));
  const presented = game.events().find(e => e.id === pid);
  assert.deepEqual(presented.conceptIds, ['ko.listening.word', 'ko.word.w0001', 'G209']);
  assert.throws(() => game.present(wordItem(2, 'w0001', { conceptIds: ['ko.reading.detail'] })), /invalid measured item/);
  assert.throws(() => game.present(wordItem(3, 'w9999')), /invalid measured item/);
});

test('words missed on separate first tries are named as content to practise; a word got right is not', () => {
  const game = play();
  const answer = (n, word, correct) => { const pid = game.present(wordItem(n, word)); game.delivery(pid, { audio: 'completed' }); return game.answer(pid, { correct, assessable: true }); };
  answer(1, 'w0011', false); answer(2, 'w0011', false); answer(3, 'w0011', true);
  answer(4, 'w0006', true);
  const concepts = game.summary().concepts;
  const water = concepts.find(c => c.id === 'ko.word.w0011'), rice = concepts.find(c => c.id === 'ko.word.w0006');
  assert.equal(water.label, '물'); assert.equal(water.status, 'practice');
  assert.equal(rice.status, 'checking');
  assert.equal(concepts.some(c => c.id === 'ko.word.w0001'), false, 'a word never met is not listed as a weakness');
  // Help, a reveal or a repeat never counts: the same content seen with help stays out of the evidence.
  const pid = game.present(wordItem(9, 'w0002'));
  game.delivery(pid, { audio: 'completed' }); game.help(pid, 'text'); game.answer(pid, { correct: true, assessable: true });
  const banana = game.summary().concepts.find(c => c.id === 'ko.word.w0002');
  assert.equal(banana.status, 'supported');
});

test('between candidates of one ability, the one using recently missed content is offered first', () => {
  const game = play();
  const answer = (n, word, correct) => { const pid = game.present(wordItem(n, word)); game.delivery(pid, { audio: 'completed' }); game.answer(pid, { correct, assessable: true }); };
  answer(1, 'w0011', false); answer(2, 'w0011', false); answer(3, 'w0011', false);
  const candidate = (id, word) => ({ id, itemKey: id, skillIds: ['ko.listening.word'], modality: 'listening', difficulty: 1, responseFormat: 'single-choice', conceptIds: [`ko.word.${word}`] });
  const pick = game.recommend([candidate('a-other', 'w0500'), candidate('b-missed', 'w0011')]);
  assert.equal(pick.selected.id, 'b-missed');
  assert.ok(Learning.summarizeConcepts, 'the content summary is part of Core');
});

test('missed content never puts another ability ahead of the one its own state ranks first', () => {
  const game = play();
  // Word listening at level 2 is missed three times, on one word; its level 1 has no record yet.
  for (const n of [1, 2, 3]) {
    const pid = game.present(wordItem(n, 'w0011', { difficulty: 2 }));
    game.delivery(pid, { audio: 'completed' }); game.answer(pid, { correct: false, assessable: true });
  }
  const candidate = (id, skillId, difficulty, word) => ({ id, itemKey: id, skillIds: [skillId], modality: 'listening', difficulty,
    responseFormat: 'single-choice', conceptIds: [`ko.word.${word}`] });
  // A detail question that uses the missed word does not overtake word listening, which needs practice.
  const pick = game.recommend([candidate('detail-with-missed-word', 'ko.listening.detail', 1, 'w0011'), candidate('word-again', 'ko.listening.word', 2, 'w0500')]);
  assert.equal(pick.selected.id, 'word-again');
  assert.equal(pick.focusSkillId, 'ko.listening.word');
  assert.equal(pick.alternatives[0].id, 'detail-with-missed-word');
});
