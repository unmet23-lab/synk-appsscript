#!/usr/bin/env node
'use strict';
// The Hangul stage's map and browser bundle: strata/hangul.json → strata/maps/hangul.json, and
// experiences/hangul-stage/learning-entry.cjs (Atlas game adapter + that map) → atlas-learning.js.
// The layer's hash is taken over LF text, so a CRLF checkout builds the same map version.
// Usage: node tools/build-hangul-stage.js [--check] [--root <checkout>]
//   --root builds another checkout in place (for example a clean export of HEAD).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const here = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
let root = here, check = false;
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--check') check = true;
  else if (args[i] === '--root' && args[i + 1]) root = path.resolve(args[++i]);
  else throw new Error('Usage: node tools/build-hangul-stage.js [--check] [--root <checkout>]');
}
const rel = 'strata/hangul.json';
const text = fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');
const sha256 = crypto.createHash('sha256').update(text).digest('hex');
const { hangulMap } = require(path.join(root, 'strata/hangul.js'));
const { validateMap } = require(path.join(root, 'strata'));
const map = hangulMap(JSON.parse(text), { path: rel, sha256 });
validateMap(map);
function output(destination, content) {
  const data = Buffer.from(content), same = fs.existsSync(destination) && fs.readFileSync(destination, 'utf8').replace(/\r\n/g, '\n') === data.toString('utf8').replace(/\r\n/g, '\n');
  if (check && !same) throw new Error(`Hangul stage source differs: ${path.relative(root, destination)}`);
  if (!check && !same) { fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, data); }
  console.log(`${check ? 'verified' : same ? 'unchanged' : 'built'} ${path.relative(root, destination)}`);
}
output(path.join(root, 'strata/maps/hangul.json'), JSON.stringify(map, null, 2) + '\n');
const esbuild = require(require.resolve('esbuild', { paths: [here, path.join(here, '영상')] }));
const bundled = esbuild.buildSync({ absWorkingDir: root, entryPoints: ['experiences/hangul-stage/learning-entry.cjs'], bundle: true,
  write: false, platform: 'browser', format: 'iife', globalName: 'SynkLearning', target: ['es2022'], charset: 'utf8',
  banner: { js: '// Generated from atlas/, strata/ and experiences/hangul-stage/learning-entry.cjs. Change those sources; run tools/build-hangul-stage.js.' } });
output(path.join(root, 'experiences/hangul-stage/atlas-learning.js'), bundled.outputFiles[0].contents);
