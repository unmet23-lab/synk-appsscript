'use strict';
// Browser entry of the Hangul stage, bundled into atlas-learning.js by tools/build-hangul-stage.js.
// The same Atlas game adapter and WORLD host as the other games (atlas/game-browser.js), with the
// Hangul layer (strata/hangul.json) as its map: answers go to the one shared learning log, and a
// WORLD account host keeps and synchronises them exactly as it does a mini game's.
const { createMap } = require('../../strata');
const learning = require('../../atlas/game-learning');
const layer = require('../../strata/hangul.json');
const map = createMap(require('../../strata/maps/hangul.json'));
function host() {
  if (typeof window === 'undefined') return null;
  if (window.SYNKLearningHost) return window.SYNKLearningHost;
  try { if (window.parent !== window && window.parent.location.origin === window.location.origin) return window.parent.SYNKLearningHost || null; } catch { /* separate origin has no implicit account access */ }
  return null;
}
const factory = config => learning.createGame({ ...config, map });
const games = new Set();
const flushAll = () => { for (const game of games) { try { game.flush?.(); } catch { /* a closing page has no one to tell */ } } };
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('pagehide', flushAll);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushAll(); });
}
module.exports = { layer, mapVersion: map.map_ver, SKILLS: map.allNodes().filter(node => node.kind === 'skill'),
  RESPONSE_FORMATS: learning.RESPONSE_FORMATS,
  createGame: options => {
    const owner = host();
    const game = owner ? owner.createGame(options, factory, learning.createLearningSync) : factory(options);
    games.add(game);
    return game;
  } };
