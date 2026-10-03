'use strict';
// The Hangul layer: letters before level 1. Source strata/hangul.json; tools/build-hangul-stage.js
// writes maps/hangul.json from it. Unit order becomes prerequisite edges (a letter of one unit
// needs the letters of the unit before), confusable pairs and look-alike shapes become one
// contrasts_with edge per pair. Nothing here is a TOPIK grade or a mastery claim.
const SOURCE = 'hangul-layer';
const PREFIX = 'hangul.';
const nodeId = id => `${PREFIX}${id}`;

function hangulMap(layer, { path, sha256 }) {
  const ref = selector => [{ source: SOURCE, selector }];
  const letters = new Map(layer.letters.map(([id, glyph, role, jamo]) => [id, { id, glyph, role, jamo }]));
  const unitOf = new Map(layer.units.flatMap(unit => unit.letters.map(id => [id, unit.id])));
  for (const id of unitOf.keys()) if (!letters.has(id)) throw new TypeError(`Hangul layer: unit letter ${id} is not a letter`);
  const nodes = [
    ...layer.skills.map(([id, domain, label_ko]) => ({ id, kind: 'skill', label_ko, domain, level: null,
      difficulty: { authored: null, measured: null, n: 0 }, source_refs: ref('skills') })),
    // 받침은 첫소리와 같은 모양이라 이름에 「받침」을 붙여 가른다.
    ...[...letters.values()].map(l => ({ id: nodeId(l.id), kind: 'letter', label_ko: l.role === 'final' ? `받침 ${l.glyph}` : l.glyph, role: l.role, jamo: l.jamo,
      unit: unitOf.get(l.id) || null, level: null, source_refs: ref(l.id) })),
  ];
  const edges = [];
  layer.units.forEach((unit, i) => {
    const before = layer.units[i - 1];
    if (!before) return;
    for (const from of before.letters) for (const to of unit.letters) edges.push({ from: nodeId(from), to: nodeId(to), type: 'prerequisite',
      confidence: 'authored', reviewed: false, source_refs: ref(`units.${unit.id}`) });
  });
  // One edge per pair: a pair can be alike in sound, in shape or both.
  const contrasts = new Map();
  const contrast = (a, b, basis, extra = {}) => {
    if (!letters.has(a) || !letters.has(b) || a === b) throw new TypeError(`Hangul layer: invalid pair ${a}|${b}`);
    const [from, to] = [a, b].sort(), key = `${from}|${to}`;
    const edge = contrasts.get(key) || { from: nodeId(from), to: nodeId(to), type: 'contrasts_with', bases: [], by_ear: true,
      confidence: 'authored', reviewed: false, source_refs: [] };
    edge.bases.push(basis); Object.assign(edge, extra); edge.source_refs.push(...ref(`${basis}s.${key}`));
    contrasts.set(key, edge);
  };
  for (const pair of layer.pairs) contrast(...pair.letters, 'sound', { by_ear: pair.by_ear });
  for (const [a, b] of layer.shapes) contrast(a, b, 'shape');
  edges.push(...[...contrasts.values()].sort((x, y) => (x.from + x.to).localeCompare(y.from + y.to)));
  return { map_ver: `${layer.version}-${sha256.slice(0, 12)}`, subject: 'ko', sources: { [SOURCE]: { path, sha256 } },
    nodes, edges, tag_vocabulary: [], links: { tags: [] } };
}

module.exports = { hangulMap, nodeId, PREFIX };
