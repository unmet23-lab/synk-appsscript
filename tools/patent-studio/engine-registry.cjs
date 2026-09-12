'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { digest } = require('./projection.cjs');
function engine(directory, names) {
  const sources = names.map(name => ({ name, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(directory, name))).digest('hex') }));
  return { key: digest(sources), sources, core: require(path.join(directory, 'core.cjs')), projection: require(path.join(directory, 'projection.cjs')) };
}
const current = engine(__dirname, ['core.cjs', 'projection.cjs', 'temporal-evidence.cjs', 'observation-planner.cjs']);
const legacy = engine(path.join(__dirname, 'engines/0.4.0'), ['core.cjs', 'projection.cjs']);
const resolve = key => [current, legacy].find(e => e.key === key) || null;
module.exports = { current, legacy, resolve };
