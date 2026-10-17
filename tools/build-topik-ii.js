#!/usr/bin/env node
'use strict';
// Builds strata/maps/topik-ii.json, the intermediate practice map, from its own source and the TOPIK I
// abilities it builds on. It reads no grammar bank: the grammar layer stays with its canonical owner.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { validateMap } = require('../strata');
const root = path.resolve(__dirname, '..');
const DESTINATION = 'strata/maps/topik-ii.json';
const STAGES = ['A', 'B', 'C', 'D'];
const read = rel => { const bytes = fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n'); return { rel, json: JSON.parse(bytes), sha: crypto.createHash('sha256').update(bytes).digest('hex') }; };

function buildMap(beginner = read('strata/topik-i.skills.json'), intermediate = read('strata/topik-ii.skills.json')) {
  const known = new Set(beginner.json.skills.map(([id]) => id));
  for (const [id, domain, , stages, tasks, units] of intermediate.json.skills) {
    // A new ability must not reuse a TOPIK I id: folding it into 'main' would claim intermediate evidence.
    if (known.has(id)) throw new TypeError(`TOPIK II: ${id} is already a TOPIK I ability`);
    if (!['listening', 'reading', 'writing'].includes(domain)) throw new TypeError(`TOPIK II: invalid domain for ${id}`);
    if (!stages.length || stages.some(stage => !STAGES.includes(stage))) throw new TypeError(`TOPIK II: invalid stages for ${id}`);
    if (tasks.some(task => !/^T\d{2}$/.test(task)) || !units.length || units.some(unit => !/^[A-D]\d{2}$/.test(unit))) throw new TypeError(`TOPIK II: invalid design reference for ${id}`);
  }
  const version = crypto.createHash('sha256').update(beginner.sha + intermediate.sha).digest('hex');
  const difficulty = () => ({ authored: null, measured: null, n: 0 });
  const map = { map_ver: `${intermediate.json.version}-${version.slice(0, 12)}`, subject: 'ko',
    sources: { 'practice-taxonomy': { path: beginner.rel, sha256: beginner.sha }, 'intermediate-taxonomy': { path: intermediate.rel, sha256: intermediate.sha } },
    nodes: [
      // The TOPIK I abilities are here so a prerequisite can point at them; their ids and words are unchanged.
      ...beginner.json.skills.map(([id, domain, label_ko]) => ({ id, kind: 'skill', label_ko, domain, level: null, stages: null,
        difficulty: difficulty(), source_refs: [{ source: 'practice-taxonomy', selector: 'skills' }] })),
      // Stages are the design's production stages and never a TOPIK grade, so level stays null.
      ...intermediate.json.skills.map(([id, domain, label_ko, stages, tasks, units]) => ({ id, kind: 'skill', label_ko, domain, level: null, stages,
        difficulty: difficulty(), design: { tasks, units }, source_refs: [{ source: 'intermediate-taxonomy', selector: id }] })),
    ],
    // Every prerequisite is a draft awaiting teacher review, so it only lowers a candidate and never blocks one.
    edges: intermediate.json.prerequisites.map(([from, to]) => ({ from, to, type: 'prerequisite', confidence: 'ai_draft', reviewed: false,
      source_refs: [{ source: 'intermediate-taxonomy', selector: `${from}>${to}` }] })),
    tag_vocabulary: [], links: { tags: [] } };
  validateMap(map);
  return map;
}
const serialize = map => JSON.stringify(map, null, 2) + '\n';

function main(args = process.argv.slice(2)) {
  if (args.some(arg => arg !== '--check')) throw new Error('Usage: node tools/build-topik-ii.js [--check]');
  const check = args.includes('--check'), destination = path.join(root, DESTINATION), content = serialize(buildMap());
  const same = fs.existsSync(destination) && fs.readFileSync(destination, 'utf8').replace(/\r\n/g, '\n') === content;
  if (check && !same) throw new Error(`Learning source differs: ${DESTINATION}`);
  if (!check && !same) fs.writeFileSync(destination, content);
  console.log(`${check ? 'verified' : same ? 'unchanged' : 'built'} ${DESTINATION}`);
}
if (require.main === module) main();
module.exports = { buildMap, serialize, read, DESTINATION };
