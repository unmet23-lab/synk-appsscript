'use strict';
// The intermediate (TOPIK II) practice map: the abilities after TOPIK I, built by tools/build-topik-ii.js.
// It holds no learner state, grading or score: whether an ability is steady is Core's and Trail's call.
const { createMap } = require('./index');

function intermediateMap(data = require('./maps/topik-ii.json')) {
  const map = createMap(data), edges = data.edges.filter(edge => edge.type === 'prerequisite');
  // The intermediate abilities an ability leads on to, in id order. A draft link suggests a next
  // practice; it is never a reason to hold one back.
  function leadsTo(id) {
    if (!map.getNode(id)) return [];
    return Object.freeze(edges.filter(edge => edge.from === id).sort((a, b) => a.to < b.to ? -1 : a.to > b.to ? 1 : 0)
      .map(edge => Object.freeze({ node: map.getNode(edge.to), confidence: edge.confidence, reviewed: edge.reviewed,
        blocking: edge.confidence !== 'ai_draft' || edge.reviewed })));
  }
  // The abilities this map adds; the TOPIK I ones it carries for its links have no stages.
  const added = () => Object.freeze(map.allNodes().filter(node => node.stages));
  return Object.freeze({ ...map, leadsTo, added });
}
module.exports = { intermediateMap };
