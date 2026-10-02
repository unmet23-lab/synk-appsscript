#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
let check = false;
const selected = new Set();
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--check') check = true;
  else if (args[i] === '--consumer' && ['talk', 'website'].includes(args[i + 1])) selected.add(args[++i]);
  else throw new Error('Usage: sync-atlas.js [--check] [--consumer talk|website]');
}
const talkFiles = ['engine.js', 'experiences.js', 'preferences.js', 'education.js', 'vellum.js', 'trail.js', 'temper.js',
  'learning.js', 'game-learning.js', 'learning-sync.js', 'strata/index.js', 'strata/maps/ko.json', 'strata/maps/topik-i.json'];
const consumers = {
  talk: [process.env.SYNK_TALK_ROOT || path.resolve(root, '../SYNK-talk'), 'lib/atlas', talkFiles],
  // The letter page imports only these two scripts; do not publish unused modules.
  website: [process.env.SYNK_WEBSITE_ROOT || path.resolve(root, '../SYNK-website'), 'dist/try/letter/atlas', ['engine.js', 'experiences.js']],
};
const targets = (selected.size ? [...selected] : Object.keys(consumers)).map(name => consumers[name]);
// Validate every selected source/consumer before writing any copies.
const sources = new Map([...new Set(targets.flatMap(([, , files]) => files))]
  .map(name => [name, fs.readFileSync(path.join(root, name.startsWith('strata/') ? name : `atlas/${name}`))]));
for (const [repo] of targets) {
  if (!fs.existsSync(path.join(repo, 'package.json'))) throw new Error('Missing consumer: ' + repo);
}
for (const [repo, relative, files] of targets) {
  for (const name of files) {
    const source = sources.get(name);
    const destination = path.join(repo, relative, name);
    const same = fs.existsSync(destination) && fs.readFileSync(destination).equals(source);
    if (!same && check) throw new Error('Atlas copy differs: ' + destination);
    if (!same) { fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, source); }
    console.log(`${check ? 'verified' : same ? 'unchanged' : 'synced'} ${path.basename(repo)}/${relative}/${name} ${crypto.createHash('sha256').update(source).digest('hex').slice(0, 12)}`);
  }
}
