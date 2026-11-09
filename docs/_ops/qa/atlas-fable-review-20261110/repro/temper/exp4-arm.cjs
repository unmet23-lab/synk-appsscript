'use strict';
const __ROOT = require('node:path').resolve(__dirname, '../../../../../..').split(require('node:path').sep).join('/');
const ROOT = __ROOT;
const Game = require(ROOT + '/atlas/game-learning'), { createMap } = require(ROOT + '/strata');
const map = createMap(require(ROOT + '/strata/maps/topik-i.json'));
const values = new Map(); let at = Date.parse('2026-10-01T00:00:00Z');
const storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
const game = Game.createGame({ gameId: 'world-practice', map, storage, fold: false, followups: true, clock: () => new Date(at).toISOString() });
for (let i = 0; i < 400; i += 1) { at += 60000; const id = `i${i}`; const pid = game.present({ id, itemKey: id, familyKey: id, skillId: 'ko.reading.detail', difficulty: 1, modality: 'reading', responseFormat: 'single-choice', audioRequired: false }); game.answer(pid, { correct: i % 3 > 0, assessable: true }); }
const arms = {}; for (const e of game.events()) if (e.type === 'decision.made') arms[String(e.arm)] = (arms[String(e.arm)] || 0) + 1;
const explores = new Set(game.events().filter(e => e.type === 'decision.made').map(e => e.explore));
const c = game.summary().counts;
console.log('decisions by arm over 400 rounds:', arms, 'explore values:', [...explores], 'counts.byArm keys:', Object.keys(c.byArm), 'independent:', c.independent);
const d = game.events().find(e => e.type === 'decision.made');
console.log('decision snapshot keys:', Object.keys(d), 'candidate.learning:', JSON.stringify(d.candidates?.[0]?.learning ?? d.selected?.learning ?? null));
