'use strict';
const { createMap } = require('../strata');
const curriculum = require('../strata/maps/topik-i.json');
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
module.exports = { ...learning, Flow, TemperFlow, VellumFlow, Ask, SKILLS: map.allNodes(), createGame: options => {
  const factory = config => learning.createGame({ ...config, map }), owner = host();
  return owner ? owner.createGame(options, factory, learning.createLearningSync) : factory(options);
} };
