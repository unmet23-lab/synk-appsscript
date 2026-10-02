import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { EPISODE } from './story.mjs';
import { names } from './stage.mjs';
import { GRAMMAR, missionMetadata, missionCandidates } from './learning.mjs';

// Each request links to the grammar Strata reads in it (strata/topik-i-forms.js): the particles after
// who moves, what moves and where it goes, then the endings of the sentence.
const require = createRequire(import.meta.url);
const { grammarIn, particleAfter } = require('../../strata/topik-i-forms.js');
const Atlas = require('../../atlas/game-browser.js');
const { createMap } = require('../../strata/index.js');
const map = createMap(require('../../strata/maps/topik-i.json'));
const missions = [...EPISODE.acts.flatMap(a => a.missions), ...EPISODE.review];

test('every mission links the particles of its roles and the endings of its sentence, as Strata reads them', () => {
  assert.deepEqual(Object.keys(GRAMMAR).sort(), missions.map(m => m.id).sort());
  for (const m of missions) {
    const roles = [m.actor, m.object, m.destination].map(id => particleAfter(m.text, names[id]));
    assert.ok(roles.every(Boolean), `${m.id}: each role is followed by a particle`);
    const expected = [...new Set([...roles, ...grammarIn(m.text)])];
    assert.deepEqual(GRAMMAR[m.id], expected, m.id);
    assert.deepEqual(missionMetadata(m).conceptIds, expected, m.id);
    assert.deepEqual(missionCandidates([m])[0].conceptIds, expected, m.id);
  }
  for (const id of new Set(Object.values(GRAMMAR).flat())) assert.equal(map.getNode(id)?.kind, 'grammar_point', id);
});

test('a missed sequence request lists -(으)ㄴ 후에 among the content to practise', () => {
  const data = new Map();
  const coach = Atlas.createGame({ gameId: 'story-classroom', storage: { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) } });
  const letter = missions.find(m => m.id === 'clue-letter');
  coach.answer(coach.present(missionMetadata(letter)), { correct: false, assessable: true });
  const concept = coach.summary().concepts.find(c => c.id === 'G406');
  assert.ok(concept, 'G406 is listed after the miss');
  assert.equal(concept.formats.action.incorrect, 1);
});
