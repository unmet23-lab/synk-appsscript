'use strict';
const __ROOT = require('node:path').resolve(__dirname, '../../../../../..').split(require('node:path').sep).join('/');
// Exp 1: does a Temper follow-up status (observed vs missed) change what Core recommends next?
const ROOT = __ROOT;
const Game = require(ROOT + '/atlas/game-learning'), { createMap } = require(ROOT + '/strata');
const map = createMap(require(ROOT + '/strata/maps/topik-i.json'));
const DAY = 86400000, ORIGIN = Date.parse('2026-10-01T00:00:00Z');
function fixture() {
  const values = new Map(); let at = ORIGIN;
  const storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
  const game = Game.createGame({ gameId: 'world-practice', map, storage, fold: false, followups: true, clock: () => new Date(at).toISOString() });
  const play = (id, { correct = false, skillId = 'ko.reading.detail', difficulty = 1 } = {}) => {
    const pid = game.present({ id, itemKey: id, familyKey: id, skillId, difficulty, modality: 'reading', responseFormat: 'single-choice', audioRequired: false });
    return game.answer(pid, { correct, assessable: true });
  };
  return { game, play, at: d => { at = ORIGIN + d * DAY; } };
}
const cand = (id, skillId = 'ko.reading.detail', difficulty = 1) => ({ id, itemKey: id, familyKey: id, skillIds: [skillId], difficulty, modality: 'reading', responseFormat: 'single-choice' });
const candidates = [cand('c1'), cand('c2', 'ko.reading.main-idea'), cand('c3', 'ko.reading.detail', 2), cand('c4', 'ko.reading.sequence')].filter(c => map.getNode(c.skillIds[0]));
function world(secondAtDay) {
  const f = fixture(); f.play('anchor', { correct: false });
  if (secondAtDay != null) { f.at(secondAtDay); f.play('second', { correct: true }); }
  f.at(3.5);
  const rows = f.game.followups().items.map(r => `${r.window}:${r.status}${r.outcome ? '/' + r.outcome : ''}`);
  const rec = f.game.recommend(candidates);
  const cell = f.game.summary().skills.find(s => s.id === 'ko.reading.detail').levels[1].formats['single-choice'];
  return { rows, selected: rec.selected?.id, state: rec.state, reason: rec.reason, order: [rec.selected?.id, ...rec.alternatives.map(a => a.id)], cell: { status: cell.status, priority: cell.priority, n: cell.n } };
}
const A = world(1.2), B = world(0.5), C = world(null);
console.log('A (2nd answer inside d1 window)   ', JSON.stringify(A));
console.log('B (same answer 12h after, pre-window)', JSON.stringify(B));
console.log('C (no 2nd answer)                 ', JSON.stringify(C));
console.log('A vs B recommendation identical:', JSON.stringify(A.order) === JSON.stringify(B.order) && A.state === B.state && JSON.stringify(A.cell) === JSON.stringify(B.cell));
