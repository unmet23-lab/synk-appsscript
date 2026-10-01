'use strict';
const { createMap } = require('../strata');
const curriculum = require('../strata/maps/topik-i.json');
const learning = require('./game-learning');
const map = createMap(curriculum);
module.exports = { ...learning, SKILLS: map.allNodes(), createGame: options => learning.createGame({ ...options, map }) };
