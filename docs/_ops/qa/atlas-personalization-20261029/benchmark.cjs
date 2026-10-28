'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const root = path.resolve(__dirname, '../../../..');
const baseline = process.argv[2] || 'a1295c5590eca9d35055c1c8db327150f1a3a341';
function previous(file) {
  const source = execFileSync('git', ['show', `${baseline}:${file}`], { cwd: root, encoding: 'utf8' });
  const module = { exports: {} };
  // Both revisions use the same realm so the comparison does not measure VM built-ins.
  vm.runInThisContext(`(function(module,exports){${source}\n})`, { filename: `baseline/${file}` })(module, module.exports);
  return module.exports;
}
const OldStrata = previous('strata/index.js'), NewStrata = require(path.join(root, 'strata'));
const OldLife = previous('atlas/trail-life.js'), NewLife = require(path.join(root, 'atlas/trail-life'));
const json = x => JSON.stringify(x);
const refs = [{ source: 'synthetic', selector: 'fixture' }];
const input = { map_ver: 'synthetic-v1', subject: 'synthetic',
  sources: { synthetic: { path: 'synthetic-only', sha256: '0'.repeat(64) } }, links: { tags: [] }, tag_vocabulary: [],
  nodes: Array.from({ length: 1500 }, (_, i) => ({ id: `skill.${i}`, kind: 'skill', label_ko: `synthetic ${i}`, level: null, source_refs: refs })),
  edges: Array.from({ length: 1499 }, (_, i) => ({ from: `skill.${i}`, to: `skill.${i + 1}`, type: 'prerequisite', confidence: 'authored', reviewed: false, source_refs: refs })) };
const oldMap = OldStrata.createMap(input), newMap = NewStrata.createMap(input);
const state = { lines: input.nodes.map(node => ({ key: `need:node.${node.id}`, source: 'observed', usable: true })) };
assert.equal(json(oldMap.candidates(state, { limit: 100 })), json(newMap.candidates(state, { limit: 100 })));
for (const file of ['ko.json', 'topik-i.json', 'topik-ii.json']) {
  const target = path.join(root, 'strata/maps', file);
  if (!fs.existsSync(target)) continue;
  const data = JSON.parse(fs.readFileSync(target, 'utf8')), old = OldStrata.createMap(data), next = NewStrata.createMap(data);
  for (const node of data.nodes) for (const method of ['getNode', 'forSkill', 'prerequisites', 'recommendedBefore']) assert.equal(json(old[method](node.id)), json(next[method](node.id)), `${file}:${method}:${node.id}`);
  for (const tag of data.tag_vocabulary) assert.equal(json(old.forTag(tag)), json(next.forTag(tag)));
  for (const link of data.links.goals || []) assert.equal(json(old.forGoal(link.goal)), json(next.forGoal(link.goal)));
}
const scope = { domain: 'LAB', workspace: 'benchmark', subject: 'synthetic' }, events = [], depth = 384;
const add = body => events.push({ schema: 1, scope, seq: events.length + 1, ...body });
for (let i = 0; i < depth; i++) add({ id: `f.${i}`, type: 'life.fact', factType: 'helped', causes: i ? [`f.${i - 1}`] : [], revisions: {}, knownBy: i === depth - 1 ? ['npc'] : [] });
for (let i = depth - 2; i >= 0; i--) add({ id: `k.${i}`, type: 'life.knowledge', factId: `f.${i}`, npcId: 'npc', allowed: true, viaId: `f.${i + 1}` });
assert.equal(json(OldLife.summarize(events, { scope })), json(NewLife.summarize(events, { scope })));
const median = fn => { fn(); const samples = []; for (let i = 0; i < 5; i++) { const start = performance.now(); fn(); samples.push(performance.now() - start); } return samples.sort((a, b) => a - b)[2]; };
const rows = [
  { name: 'strata-candidates', fixture: '1500 nodes / 1499 edges / 1500 qualified target lines', old: () => oldMap.candidates(state, { limit: 100 }), next: () => newMap.candidates(state, { limit: 100 }) },
  { name: 'trail-npc-provenance', fixture: '384 linked facts / 383 knowledge grants', old: () => OldLife.summarize(events, { scope }), next: () => NewLife.summarize(events, { scope }) },
];
const measurements = rows.map(row => { const beforeMs = median(row.old), afterMs = median(row.next); return { name: row.name, fixture: row.fixture, beforeMs, afterMs, speedup: beforeMs / afterMs, identicalResult: true }; });
const report = { schema: 'atlas-personalization-performance-1', baseline, node: process.version, runs: 5, statistic: 'median', synthetic: true, includesMapConstruction: false, measurements };
fs.writeFileSync(path.join(__dirname, 'benchmark.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
