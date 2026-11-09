'use strict';
const __ROOT = require('node:path').resolve(__dirname, '../../../../../..').split(require('node:path').sep).join('/');
const ROOT = __ROOT;
const Game = require(ROOT + '/atlas/game-learning'), { createMap } = require(ROOT + '/strata');
const map = createMap(require(ROOT + '/strata/maps/topik-i.json'));
const DAY = 86400000, ORIGIN = Date.parse('2026-10-01T00:00:00Z');
function fixture(extra = {}) {
  const values = new Map(); let at = ORIGIN;
  const storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
  const game = Game.createGame({ gameId: 'world-practice', map, storage, fold: false, followups: true, clock: () => new Date(at).toISOString(), ...extra });
  const play = (id, { correct = false, difficulty = 1, help = null, skillId = 'ko.reading.detail' } = {}) => {
    const pid = game.present({ id, itemKey: id, familyKey: id, skillId, difficulty, modality: 'reading', responseFormat: 'single-choice', audioRequired: false });
    if (help) game.help(pid, help);
    return game.answer(pid, { correct, assessable: true });
  };
  return { game, play, at: d => { at = ORIGIN + d * DAY; } };
}
const show = (label, f) => console.log(label, JSON.stringify(f.game.followups().items.map(r => `${r.measure.difficulty}/${r.kind}/${r.window}:${r.status}${r.outcome ? '/' + r.outcome : ''}`)));

// P2: an anchor that is a correct, unhelped answer on an item seen before (a repeat) is labelled "recovery".
{ const f = fixture();
  f.play('seen-item', { correct: true, difficulty: 2 });          // cell d2: anchor #1 (new, correct) -> retention
  f.at(46); f.play('seen-item', { correct: true, difficulty: 2 }); // next cycle of the same cell starts on a repeat, answered alone & right
  f.at(46.1); show('P2 repeat-correct anchor of the 2nd cycle  ', f); }

// P4: a learner who moves up a level leaves the old cell: its d7/d30 are "missed" though they practised daily.
{ const f = fixture();
  f.play('a0', { correct: false, difficulty: 1 });
  for (let d = 1; d <= 3; d += 1) { f.at(d); f.play(`easy${d}`, { correct: true, difficulty: 1 }); }
  for (let d = 4; d <= 36; d += 1) { f.at(d); f.play(`hard${d}`, { correct: d % 3 !== 0, difficulty: 2 }); } // daily practice, now at level 2
  f.at(38); show('P4 moved-up learner, daily practice 38 days', f); }

// P5: exhausted supply: every later answer in the cell is on an item seen before -> windows can never be observed.
{ const f = fixture();
  f.play('i1', { correct: false }); f.at(0.1); f.play('i2', { correct: true }); f.at(0.2); f.play('i3', { correct: true }); // the cell's 3 items are used up on day 0
  for (const d of [1.5, 7.5, 31]) { f.at(d); f.play(['i2', 'i3', 'i2'][Math.floor(d) % 3], { correct: true }); }
  f.at(38); show('P5 exhausted cell (3 items), practised in every window', f); }
