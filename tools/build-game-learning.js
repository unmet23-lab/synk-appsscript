#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
if (args.some(a => a !== '--check')) throw new Error('Usage: node tools/build-game-learning.js [--check]');
const check = args.includes('--check');
const taxonomyPath = path.join(root, 'strata/topik-i.skills.json');
const source = fs.readFileSync(taxonomyPath);
const taxonomy = JSON.parse(source);
const sha = crypto.createHash('sha256').update(source).digest('hex');
const ref = { source: 'practice-taxonomy', selector: 'skills' };
const map = { map_ver: `${taxonomy.version}-${sha.slice(0, 12)}`, subject: 'ko',
  sources: { 'practice-taxonomy': { path: 'strata/topik-i.skills.json', sha256: sha } },
  nodes: taxonomy.skills.map(([id, domain, label_ko]) => ({ id, kind: 'skill', label_ko, domain, level: null,
    difficulty: { authored: null, measured: null, n: 0 }, source_refs: [ref] })),
  edges: [], tag_vocabulary: [], links: { tags: [] } };
require('../strata').validateMap(map);
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
for (const game of ['korean-racing', 'korean-runner', 'korean-rhythm', 'order-rush', 'learning-hub']) {
  output(path.join(root, 'experiences', game, 'atlas-learning.js'), bundled.outputFiles[0].contents);
}
