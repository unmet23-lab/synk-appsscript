import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { CAMPAIGN } from '../campaign.js';
import { FINALES } from '../finales.js';
import { racingItem, RACING_CANDIDATES } from '../personalization.js';
const require = createRequire(import.meta.url);
const { createGame } = require('../../../atlas/game-learning.js');
const { createMap } = require('../../../strata/index.js');
const { topikMap } = require('../../../strata/topik-i.js');
const map = createMap(topikMap());
const memory = () => { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) }; };
const all = [...CAMPAIGN, ...FINALES].flatMap(stage => stage.items);

test('questions that turn on one grammar form name it; comprehension questions name none', () => {
  const linked = all.filter(q => racingItem(q).conceptIds.length);
  assert.equal(linked.length, 13);
  for (const q of linked) for (const id of racingItem(q).conceptIds) assert.equal(map.getNode(id)?.kind, 'grammar_point', `${q.id} → ${id}`);
  // In a blank, the linked form is the right answer itself.
  const blanks = { c03q1: '에서', c03q2: '에', c03q3: '에게', c03q4: '에', c03q5: '에서', f02q1: '에서', f02q2: '와' };
  for (const [id, form] of Object.entries(blanks)) {
    const q = all.find(x => x.id === id);
    assert.equal(q.choices.find(c => c.id === q.answer).word, form, id);
  }
  // The word questions keep their word, and recommendation candidates carry the same content.
  assert.ok(all.every(q => racingItem(q).conceptIds.every(id => !id.startsWith('ko.word.'))));
  for (const c of RACING_CANDIDATES) assert.deepEqual(c.conceptIds, racingItem(c.item).conceptIds);
});

test('a missed blank lists its grammar point among the content to practise', () => {
  let t = Date.parse('2026-09-01T00:00:00Z');
  const coach = createGame({ gameId: 'racing-grammar', map, storage: memory(), clock: () => new Date(t += 1000).toISOString() });
  const q = all.find(x => x.id === 'c03q1');
  coach.answer(coach.present(racingItem(q)), { correct: false, assessable: true });
  const concept = coach.summary().concepts.find(c => c.id === 'G207');
  assert.ok(concept, 'G207 (에서) is listed after the miss');
  assert.equal(concept.formats['single-choice'].n, 1);
  assert.equal(concept.formats['single-choice'].incorrect, 1);
});
