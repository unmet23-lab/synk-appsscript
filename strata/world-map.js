'use strict';
// WORLD 학습 지도의 자료(TOPIK I 지도 + TOPIK II 능력 15개, strata/maps/topik-ii.json). 두 곳이 같은 지도를 쓴다:
// WORLD 코치(experiences/synk-world-app/world-learning-map.mjs)와, 3~4급 문항을 내는 게임의 묶음(tools/build-game-learning.js의 WORLD_MAP_GAMES).
// 다른 게임은 TOPIK I 지도 그대로다(atlas/game-browser.js). 기록 모양(Trail 칸)은 바꾸지 않고 문항이 가리키는 능력 이름만 늘어난다.
const topikI = require('./topik-i');
const topikII = require('./maps/topik-ii.json');

// 두 지도의 출처 이름이 겹치면(둘 다 practice-taxonomy) TOPIK II 쪽 이름에 -ii를 붙여 각 능력이 제 원천을 가리키게 한다.
const II = '-ii';
function worldMapData({ base = topikI.topikMap(), second = topikII } = {}) {
  const rename = key => Object.hasOwn(base.sources, key) ? `${key}${II}` : key;
  const refs = list => list.map(ref => ({ ...ref, source: rename(ref.source) }));
  return { map_ver: `world:${base.map_ver}:${second.map_ver}`, subject: base.subject,
    sources: { ...base.sources, ...Object.fromEntries(Object.entries(second.sources).map(([key, value]) => [rename(key), value])) },
    nodes: [...base.nodes, ...second.nodes.map(node => ({ ...node, source_refs: refs(node.source_refs) }))],
    edges: [...base.edges, ...second.edges.map(edge => ({ ...edge, source_refs: refs(edge.source_refs) }))],
    tag_vocabulary: [...base.tag_vocabulary, ...second.tag_vocabulary],
    links: { ...base.links, tags: [...base.links.tags, ...second.links.tags.map(link => ({ ...link, source_refs: refs(link.source_refs) }))],
      ...(base.links.goals || second.links.goals?.length ? { goals: [...(base.links.goals || []), ...(second.links.goals || []).map(link => ({ ...link, source_refs: refs(link.source_refs) }))] } : {}) } };
}
module.exports = { worldMapData };
