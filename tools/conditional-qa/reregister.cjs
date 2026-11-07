'use strict';
const fs = require('node:fs'), path = require('node:path'), { randomUUID } = require('node:crypto');
const { read, write, git, loadConfig } = require('./inputs.cjs');
const { sha256, relativePath, within } = require('./contract.cjs');
const { acquire, defaultState } = require('./worker.cjs');

// A git-ignored input (a PATH interview film, say) is pinned by hash at provision time, and a tracked list in the repository may name those bytes.
// When the shared working copy's file is rebuilt and the tracked list follows it (2026-11-06 6051236295 repackaged four 720p films), every later
// commit fails against the pinned old bytes. This moves one registered app input to the bytes the shared working copy holds now. The old version
// stays in the row's `replaced` list and its blob is kept, so materialize() may swap exactly those bytes in a checkout and nothing else.
// It never adds a new input, never pins tracked source, and never touches a checkout or the queue: the next verification lays the new bytes.
function reregisterInputs({ state = defaultState(), files, reason, apply = false, now = Date.now(), lock = acquire }) {
  state = path.resolve(state); const config = loadConfig(state);
  if (!Array.isArray(files) || !files.length || files.length > 50 || new Set(files).size !== files.length) throw Error('Choose 1-50 distinct registered inputs');
  files.forEach(relativePath);
  if (typeof reason !== 'string' || !reason.trim() || reason.length > 500) throw Error('A reason is required (at most 500 characters)');
  const requestedAt = new Date(now).toISOString(), release = apply ? lock(state) : () => {};
  try {
    const file = path.join(state, 'inputs.json'), originalBytes = fs.readFileSync(file), manifest = JSON.parse(originalBytes);
    if (manifest.version !== 1 || !Array.isArray(manifest.files)) throw Error('Invalid input list');
    const tracked = new Set(git(config.sourceRepo, ['ls-files', '-z', '--', ...files]).split('\0').filter(Boolean));
    // Validate every file before a blob or the list is written.
    const changes = files.map(rel => {
      const rows = manifest.files.filter(row => row.area === 'app' && row.file === rel);
      if (rows.length !== 1) throw Error(`Not a single registered app input: ${rel}`);
      if (tracked.has(rel)) throw Error(`Tracked source is never pinned: ${rel}`);
      const source = path.join(config.sourceRepo, rel);
      if (!within(config.sourceRepo, source)) throw Error('Input escapes the source repository');
      const data = fs.readFileSync(source);
      return { row: rows[0], data, sha: sha256(data), source };
    });
    const summary = { applied: apply, reason: reason.trim(), requestedAt,
      files: changes.map(({ row, data, sha }) => ({ file: row.file, from: row.sha256, to: sha, bytes: data.length, unchanged: sha === row.sha256 })) };
    if (!apply) return summary;
    const id = `${now}-${randomUUID()}`, ledger = path.join(state, 'input-history', `${id}.json`);
    write(ledger, { version: 1, id, ...summary, state: 'prepared', inputsBeforeSha256: sha256(originalBytes) });
    for (const { row, data, sha, source } of changes) {
      if (sha === row.sha256) continue;
      const blob = path.join(state, 'blobs', sha);
      if (!fs.existsSync(blob)) fs.writeFileSync(blob, data, { flag: 'wx' });
      else if (sha256(fs.readFileSync(blob)) !== sha) throw Error('Immutable input blob changed');
      row.replaced = [...(row.replaced || []), { sha256: row.sha256, bytes: row.bytes, replacedAt: requestedAt, reason: summary.reason, request: id }];
      Object.assign(row, { sha256: sha, bytes: data.length, source });
    }
    write(file, manifest);
    write(ledger, { version: 1, id, ...summary, state: 'applied', inputsBeforeSha256: sha256(originalBytes), inputsAfterSha256: sha256(fs.readFileSync(file)) });
    return { ...summary, id };
  } finally { release(); }
}

function parse(args) {
  const options = { files: [] };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--apply') options.apply = true;
    else if (arg === '--state' || arg === '--reason') {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw Error(`Missing value for ${arg}`);
      options[arg.slice(2)] = args[++i];
    } else if (arg.startsWith('--')) throw Error(`Unknown option ${arg}`);
    else options.files.push(arg.replaceAll('\\', '/'));
  }
  return options;
}
if (require.main === module) {
  try { console.log(JSON.stringify(reregisterInputs(parse(process.argv.slice(2))), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { reregisterInputs, parse };
