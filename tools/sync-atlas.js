#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const check = process.argv.includes('--check');
const targets = [
  [process.env.SYNK_TALK_ROOT || path.resolve(root, '../SYNK-talk'), 'lib/atlas'],
  [process.env.SYNK_WEBSITE_ROOT || path.resolve(root, '../SYNK-website'), 'dist/try/letter/atlas'],
];
for (const [repo, relative] of targets) {
  if (!fs.existsSync(path.join(repo, 'package.json'))) throw new Error('Missing consumer: ' + repo);
  for (const name of ['engine.js', 'experiences.js']) {
    const source = fs.readFileSync(path.join(root, 'atlas', name));
    const destination = path.join(repo, relative, name);
    const same = fs.existsSync(destination) && fs.readFileSync(destination).equals(source);
    if (!same && check) throw new Error('Atlas copy differs: ' + destination);
    if (!same) { fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, source); }
    console.log(`${check ? 'verified' : same ? 'unchanged' : 'synced'} ${path.basename(repo)}/${relative}/${name} ${crypto.createHash('sha256').update(source).digest('hex').slice(0, 12)}`);
  }
}
