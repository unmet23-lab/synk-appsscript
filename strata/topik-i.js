'use strict';
// The TOPIK I practice map: abilities and grammar from maps/topik-i.json (built by
// tools/build-game-learning.js), plus the word layer expanded from its compact source.
// Words and grammar are content an item uses; abilities are what it practises. None of
// them is a TOPIK grade: grammar steps and word bands await teacher review.
const words = require('./topik-i.words.json');

const WORD_PREFIX = 'ko.word.';
const wordNodes = rows => rows.map(([id, word, pos, band]) => ({ id: `${WORD_PREFIX}${id}`, kind: 'word', label_ko: word, level: null,
  pos, band, source_refs: [{ source: 'practice-words', selector: id }] }));
function topikMap({ includeWords = true, base = require('./maps/topik-i.json') } = {}) {
  return includeWords ? { ...base, nodes: [...base.nodes, ...wordNodes(words.words)] } : base;
}
module.exports = { topikMap, wordNodes, WORD_PREFIX };
