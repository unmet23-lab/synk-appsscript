'use strict';
const { createMap } = require('../strata');
// Abilities and grammar from the built map, with the word layer expanded (strata/topik-i.js).
const curriculum = require('../strata/topik-i').topikMap();
const learning = require('./game-learning');
// Moment-level challenge for any content, with or without a curriculum (Core, Temper, Vellum).
const Flow = require('./flow');
const TemperFlow = require('./temper-flow');
const VellumFlow = require('./vellum-flow');
const Ask = require('./ask');
const map = createMap(curriculum);
function host() {
  if (typeof window === 'undefined') return null;
  if (window.SYNKLearningHost) return window.SYNKLearningHost;
  try { if (window.parent !== window && window.parent.location.origin === window.location.origin) return window.parent.SYNKLearningHost || null; } catch { /* separate origin has no implicit account access */ }
  return null;
}
const factory = config => learning.createGame({ ...config, map });
// Before the page closes or hides, every game here writes its entries again, joining what
// other tabs wrote meanwhile (game-learning.js flush).
const games = new Set();
const flushAll = () => { for (const game of games) { try { game.flush?.(); } catch { /* a closing page has no one to tell */ } } };
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('pagehide', flushAll);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushAll(); });
}
// `engine` lets a host page build its own account-wide adapter in its own window, with the
// synchronisers for its learning log and its Core memory (memory-sync.js).
module.exports = { ...learning, Flow, TemperFlow, VellumFlow, Ask, SKILLS: map.allNodes(),
  engine: Object.freeze({ createGame: factory, createLearningSync: learning.createLearningSync, createMemorySync: learning.createMemorySync }), createGame: options => {
    const owner = host();
    const game = owner ? owner.createGame(options, factory, learning.createLearningSync) : factory(options);
    games.add(game);
    return game;
  } };
