'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGame } = require('../atlas/game-learning');
const { createMap } = require('../strata');
const map = createMap(require('../strata/maps/topik-i.json'));
function fixture() {
  const data = new Map(), storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  const coach = createGame({ gameId: 'family-audit', map, storage });
  const present = (id, familyKey = 'shared.family', itemKey = id) => coach.present({ id, itemKey, familyKey,
    skillId: 'ko.reading.detail', modality: 'reading', difficulty: 1, audioRequired: false, confounded: false });
  const answer = pid => coach.answer(pid, { correct: true, assessable: true });
  return { coach, present, answer, storage };
}

test('a reveal after both variants opened prevents an independent answer on the sibling', () => {
  const f = fixture(), a = f.present('variant-a'), b = f.present('variant-b');
  f.coach.help(a, 'answer');
  assert.equal(f.answer(b).independent, false);
  assert.equal(f.coach.summary().independent, 0);
  assert.equal(createGame({ gameId: 'reloaded', map, storage: f.storage }).summary().independent, 0);
});

test('a first attempt on a concurrently open variant prevents duplicate independent evidence', () => {
  const f = fixture(), a = f.present('variant-a'), b = f.present('variant-b');
  assert.equal(f.answer(a).independent, true);
  assert.equal(f.answer(b).independent, false);
  assert.equal(f.coach.summary().independent, 1);
});

test('excluded family help still counts as exposure, and later help does not rewrite the past', () => {
  const f = fixture(), first = f.present('first', 'first.family');
  assert.equal(f.answer(first).independent, true);
  f.coach.help(f.present('later', 'first.family'), 'answer');
  const a = f.present('variant-a'), b = f.present('variant-b');
  f.coach.help(a, 'answer');f.coach.exclude(a);
  assert.equal(f.answer(b).independent, false);
  assert.equal(f.coach.summary().independent, 1);
});

test('a changed family label cannot hide help on the same item key', () => {
  const f = fixture(), a = f.present('variant-a', 'family.a', 'same.item'), b = f.present('variant-b', 'family.b', 'same.item');
  f.coach.help(a, 'text');
  assert.equal(f.answer(b).independent, false);
});
