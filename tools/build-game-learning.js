#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
if (args.some(a => a !== '--check')) throw new Error('Usage: node tools/build-game-learning.js [--check]');
const check = args.includes('--check');
// Abilities, grammar, words and the situations a learning reason leads to are separate sources; the
// map's version covers all four.
const read = rel => { const bytes = fs.readFileSync(path.join(root, rel)); return { rel, json: JSON.parse(bytes), sha: crypto.createHash('sha256').update(bytes).digest('hex') }; };
const taxonomy = read('strata/topik-i.skills.json'), grammar = read('strata/topik-i.grammar.json'), words = read('strata/topik-i.words.json');
const situations = read('strata/topik-i.situations.json');
const version = crypto.createHash('sha256').update(taxonomy.sha + grammar.sha + words.sha + situations.sha).digest('hex');
const ref = { source: 'practice-taxonomy', selector: 'skills' };
// Each reason's situations in the contract's order (topik-i.situations.json). The grouping is the
// learning-reasons contract the user approved (r1), so the link is authored and reviewed.
const reasons = [...new Set(situations.json.situations.map(([, reason]) => reason))];
const map = { map_ver: `${taxonomy.json.version}-${version.slice(0, 12)}`, subject: 'ko',
  sources: { 'practice-taxonomy': { path: taxonomy.rel, sha256: taxonomy.sha }, 'practice-grammar': { path: grammar.rel, sha256: grammar.sha },
    'practice-words': { path: words.rel, sha256: words.sha }, 'practice-situations': { path: situations.rel, sha256: situations.sha } },
  nodes: [
    ...taxonomy.json.skills.map(([id, domain, label_ko]) => ({ id, kind: 'skill', label_ko, domain, level: null,
      difficulty: { authored: null, measured: null, n: 0 }, source_refs: [ref] })),
    // A grammar step is the grammar bank's order, or the standard curriculum's grade where a point names
    // that basis (topik-i.grammar.json S points); never a TOPIK grade.
    ...grammar.json.points.map(([id, label_ko, forms, step, , basis]) => ({ id, kind: 'grammar_point', label_ko, forms, level: { intro: step, basis: basis || 'grammar_bank' },
      source_refs: [{ source: 'practice-grammar', selector: id }] })),
    // A situation is where practice happens, not a level: it never moves difficulty or a grade.
    ...situations.json.situations.map(([id, , label_ko, when_ko]) => ({ id, kind: 'situation', label_ko, when_ko, level: null,
      source_refs: [{ source: 'practice-situations', selector: id }] })),
  ],
  // Which abilities a grammar point serves: a draft awaiting teacher review.
  edges: grammar.json.points.flatMap(([id, , , , skills]) => skills.map(to => ({ from: id, to, type: 'part_of', confidence: 'ai_draft', reviewed: false,
    source_refs: [{ source: 'practice-grammar', selector: id }] }))),
  tag_vocabulary: [], links: { tags: [], goals: reasons.map(goal => ({ goal,
    nodes: situations.json.situations.filter(([, reason]) => reason === goal).map(([id]) => id),
    confidence: 'authored', reviewed: true, source_refs: [{ source: 'practice-situations', selector: goal }] })) } };
const { validateMap } = require('../strata');
validateMap(map);
// Words are expanded at run time (strata/topik-i.js); the complete map must be valid too.
validateMap(require('../strata/topik-i').topikMap({ base: map }));
function output(destination, content) {
  const data = Buffer.from(content), same = fs.existsSync(destination) && fs.readFileSync(destination).equals(data);
  if (check && !same) throw new Error(`Learning source differs: ${path.relative(root, destination)}`);
  if (!check && !same) { fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, data); }
  console.log(`${check ? 'verified' : same ? 'unchanged' : 'built'} ${path.relative(root, destination)}`);
}
output(path.join(root, 'strata/maps/topik-i.json'), JSON.stringify(map, null, 2) + '\n');
const esbuild = require(require.resolve('esbuild', { paths: [root, path.join(root, '영상')] }));
const bundled = esbuild.buildSync({ absWorkingDir: root, entryPoints: ['atlas/game-browser.js'], bundle: true,
  write: false, platform: 'browser', format: 'iife', globalName: 'SynkLearning', target: ['es2022'], charset: 'utf8',
  banner: { js: '// Generated from atlas/ and strata/. Change canonical sources; run tools/build-game-learning.js.' } });
for (const game of ['korean-racing', 'korean-runner', 'korean-rhythm', 'order-rush', 'learning-hub', 'entry-check', 'story-classroom', 'blank-slice']) {
  output(path.join(root, 'experiences', game, 'atlas-learning.js'), bundled.outputFiles[0].contents);
}
