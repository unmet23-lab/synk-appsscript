'use strict';
const { createMap } = require('../strata');
const curriculum = require('../strata/maps/topik-i.json');
const learning = require('./game-learning');
const map = createMap(curriculum);
function host() {
  if (typeof window === 'undefined') return null;
  if (window.SYNKLearningHost) return window.SYNKLearningHost;
  try { if (window.parent !== window && window.parent.location.origin === window.location.origin) return window.parent.SYNKLearningHost || null; } catch { /* separate origin has no implicit account access */ }
  return null;
}
module.exports = { ...learning, SKILLS: map.allNodes(), createGame: options => {
  const factory = config => learning.createGame({ ...config, map }), owner = host();
  return owner ? owner.createGame(options, factory, learning.createLearningSync) : factory(options);
} };
