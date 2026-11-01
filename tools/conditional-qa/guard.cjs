'use strict';
const fs = require('node:fs'), path = require('node:path');
const { readManifest, unknownSkips } = require('./contract.cjs');
function check(root, trace) {
  const manifest = readManifest(root);
  for (const row of manifest.cases) if (!fs.existsSync(path.join(root, row.file))) throw Error(`Missing test source: ${row.id} ${row.file}`);
  if (trace) {
    const rows = fs.readFileSync(trace, 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
    const unknown = unknownSkips(manifest, rows, root);
    if (unknown.length) throw Error(`Unregistered conditional tests: ${JSON.stringify(unknown)}`);
  }
  return manifest.cases.length;
}
if (require.main === module) {
  try {
    if (process.argv[2] && (process.argv[2] !== '--skips' || !process.argv[3] || process.argv.length !== 4)) throw Error('Usage: guard.cjs [--skips <JSONL>]');
    console.log(`Conditional QA inventory: ${check(path.resolve(__dirname, '../..'), process.argv[3])} cases; no unregistered skips`);
  }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { check };
