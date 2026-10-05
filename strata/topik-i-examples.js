'use strict';
// Example sentences for the situations a learning reason leads to (topik-i.situation-examples.json):
// the "예문" of "보기가 바꾸는 것은 연습의 상황과 예문" (learning-reasons contract r1). A layer of its
// own, like the words and the form reader: a host that shows examples asks for it, and the games'
// map and bundle do not carry it. An example shows where practice happens; it never moves
// difficulty, a level or a grade. The sentences are drafts until a teacher reviews them, and each
// one says so (`reviewed`). This module requires nothing but its sentences, so a host that only
// shows them (the account server) carries neither the form reader nor its word list.
const source = require('./topik-i.situation-examples.json');

const fail = message => { throw new TypeError(`Strata examples: ${message}`); };
const text = value => typeof value === 'string' && value.trim().length > 0;
const SENTENCE_END = /[.?!]$/;
const MAX_LENGTH = 30;

// The examples of every situation in `map` (a createMap() result), checked against it: every key is
// one of the map's situations and every situation has examples; ids are unique and say which
// situation they belong to. A host that wants each sentence's grammar passes the map's form reader
// (topik-i-forms.js `grammarIn`): `grammar` is then what it reads in the sentence — a hint for
// picking and for review, possibly empty. Without a reader `grammar` is null (not read).
function situationExamples(map, { data = source, grammarIn = null } = {}) {
  if (typeof map?.getNode !== 'function' || typeof map.allNodes !== 'function') fail('a map is required');
  if (!text(data?.version) || !data.examples || typeof data.examples !== 'object') fail('invalid source');
  if (grammarIn !== null && typeof grammarIn !== 'function') fail('invalid form reader');
  // review.reviewed: id → the sentence a teacher confirmed. A sentence edited afterwards no longer
  // matches and is a draft again.
  const reviewed = data.review?.reviewed;
  if (data.review?.confidence !== 'ai_draft' || !reviewed || typeof reviewed !== 'object' || Array.isArray(reviewed)) fail('invalid review status');
  const ids = new Set(), bySituation = new Map();
  for (const [situation, rows] of Object.entries(data.examples)) {
    const node = map.getNode(situation);
    if (node?.kind !== 'situation') fail(`unknown situation ${situation}`);
    if (!Array.isArray(rows) || !rows.length) fail(`no examples for ${situation}`);
    const prefix = `ex-${situation.slice('sit-'.length)}-`;
    bySituation.set(situation, Object.freeze(rows.map(row => {
      const [id, ko, from] = Array.isArray(row) ? row : [];
      if (!text(id) || ids.has(id) || !id.startsWith(prefix)) fail(`invalid or duplicate example id ${id}`);
      if (!text(ko) || ko !== ko.trim() || !SENTENCE_END.test(ko) || ko.length > MAX_LENGTH) fail(`invalid sentence ${id}`);
      if (from !== undefined && !/^[a-z-]+\/[a-z0-9.-]+$/.test(from)) fail(`invalid origin ${id}`);
      ids.add(id);
      const grammar = grammarIn ? grammarIn(ko) : null;
      if (grammar && (!Array.isArray(grammar) || grammar.some(point => map.getNode(point)?.kind !== 'grammar_point'))) fail(`unknown grammar in ${id}`);
      return Object.freeze({ id, ko, grammar: grammar && Object.freeze([...grammar]), from: from || null,
        confidence: data.review.confidence, reviewed: reviewed[id] === ko });
    })));
  }
  for (const id of Object.keys(reviewed)) if (!ids.has(id)) fail(`reviewed id ${id} is not an example`);
  for (const node of map.allNodes()) if (node.kind === 'situation' && !bySituation.has(node.id)) fail(`situation ${node.id} has no examples`);
  const none = Object.freeze([]);
  // An unknown situation has no examples, never a similar situation's.
  return Object.freeze({ version: data.version, examplesFor: situation => bySituation.get(situation) || none,
    all: () => Object.freeze([...bySituation].map(([situation, examples]) => Object.freeze({ situation, examples }))) });
}
module.exports = { situationExamples, MAX_LENGTH };
