'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGame, KEY } = require('../atlas/game-learning');
const { createMap } = require('../strata');
const map = createMap(require('../strata/maps/topik-i.json'));

function fixture() {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const game = createGame({ gameId: 'epoch-boundary', map, storage, clock: () => '2026-10-02T01:00:00.000Z' });
  const presentation = game.present({ id: 'reading-item', itemKey: 'reading-item', familyKey: 'reading-item', skillId: 'ko.reading.detail', modality: 'reading', difficulty: 1 });
  return { game, presentation, storage };
}

test('a new history epoch invalidates an open presentation even when restored event IDs overlap', () => {
  for (const refreshFirst of [false, true]) {
    const { game, presentation, storage } = fixture();
    const key = KEY + '.device', restored = JSON.parse(storage.getItem(key));
    restored.epoch = 'synthetic-restored-epoch';
    storage.setItem(key, JSON.stringify(restored));
    if (refreshFirst) game.syncPort.events();
    assert.throws(() => game.answer(presentation, { correct: true, assessable: true }), /presentation ended or local record reset/);
    assert.equal(game.events().filter(event => event.type === 'practice.attempted').length, 0);
  }
});

test('rewriting the same epoch and retained events keeps the current presentation answerable', () => {
  const { game, presentation, storage } = fixture();
  const key = KEY + '.device';
  storage.setItem(key, JSON.stringify(JSON.parse(storage.getItem(key)), null, 2));
  const answer = game.answer(presentation, { correct: true, assessable: true });
  assert.equal(answer.independent, true);
  assert.equal(game.events().filter(event => event.type === 'practice.attempted').length, 1);
});
