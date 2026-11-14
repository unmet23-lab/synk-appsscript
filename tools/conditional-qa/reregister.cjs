'use strict';
const fs = require('node:fs'), path = require('node:path'), { randomUUID } = require('node:crypto');
const { read, write, git, loadConfig } = require('./inputs.cjs');
const { sha256, relativePath, within } = require('./contract.cjs');
const { acquire, defaultState } = require('./worker.cjs');
const fileKey = value => process.platform === 'win32' ? value.toLowerCase() : value;
function sameFile(left, right) {
  try { return fileKey(fs.realpathSync.native(left)) === fileKey(right); }
  catch (error) { if (['ENOENT','ENOTDIR'].includes(error.code)) return false; throw error; }
}
function recoverPrepared(state, entries, bytes, { add, reason, requestedAt, apply }) {
  const directory = path.join(state, 'input-history');
  if (!fs.existsSync(directory)) return null;
  const currentSha = sha256(bytes), matches = [];
  const history = fs.readdirSync(directory).filter(name => /^\d+-[a-f0-9-]+\.json$/.test(name))
    .map(name => { const ledger = path.join(directory, name); return { ledger, receipt: read(ledger) }; });
  // A later successful request can produce the same manifest as an abandoned
  // prepared attempt. Its applied receipt already owns these registry bytes.
  if (history.some(({ receipt }) => receipt.version === 1 && receipt.state === 'applied' && receipt.inputsAfterSha256 === currentSha)) return null;
  for (const { ledger, receipt } of history) {
    if (receipt.version !== 1 || receipt.state !== 'prepared' || Boolean(receipt.add) !== add || receipt.reason !== reason ||
        !Array.isArray(receipt.files) || receipt.files.length !== entries.length || !/^[a-f0-9]{64}$/.test(receipt.inputsBeforeSha256 || '') ||
        (receipt.inputsAfterSha256 && receipt.inputsAfterSha256 !== currentSha)) continue;
    const names = new Set();
    if (!receipt.files.every(old => {
      const entry = entries.find(entry => fileKey(entry.rel) === fileKey(old.file || ''));
      if (!entry || names.has(fileKey(old.file)) || entry.rows.length !== 1) return false;
      names.add(fileKey(old.file));
      return old.to === entry.sha && old.bytes === entry.data.length && entry.rows[0].sha256 === old.to && entry.rows[0].bytes === old.bytes;
    })) continue;
    for (const row of receipt.files) {
      const blob = fs.readFileSync(path.join(state, 'blobs', row.to));
      if (blob.length !== row.bytes || sha256(blob) !== row.to) throw Error('Immutable input blob changed');
    }
    matches.push({ ledger, receipt });
  }
  if (matches.length > 1) throw Error('Ambiguous prepared input history');
  if (!matches.length) return null;
  const { ledger, receipt } = matches[0];
  if (apply) write(ledger, { ...receipt, state: 'applied', recoveredAt: requestedAt, inputsAfterSha256: currentSha });
  return { applied: apply, reason, requestedAt: receipt.requestedAt, ...(add && { add: true }), files: receipt.files,
    id: receipt.id, ...(apply ? { recovered: true } : { recoveryPending: true }) };
}

// A git-ignored input (a PATH interview film, say) is pinned by hash at provision time, and a tracked list in the repository may name those bytes.
// When the shared working copy's file is rebuilt and the tracked list follows it (2026-11-06 6051236295 repackaged four 720p films), every later
// commit fails against the pinned old bytes. This moves one registered app input to the bytes the shared working copy holds now. The old version
// stays in the row's `replaced` list and its blob is kept, so materialize() may swap exactly those bytes in a checkout and nothing else.
// --add explicitly registers operator-selected untracked inputs, as provision does;
// git-ignore is not an eligibility rule. Use it for external QA assets, never instead
// of committing new source. Ordinary re-registration still refuses unknown paths.
// Neither mode pins tracked source or edits a checkout.
function reregisterInputs({ state = defaultState(), files, reason, apply = false, add = false, now = Date.now(), lock = acquire }) {
  state = path.resolve(state); const config = loadConfig(state);
  if (!Array.isArray(files) || !files.length || files.length > 50) throw Error('Choose 1-50 distinct registered inputs');
  files.forEach(relativePath);
  if (new Set(files.map(fileKey)).size !== files.length) throw Error('Choose 1-50 distinct registered inputs');
  if (typeof reason !== 'string' || !reason.trim() || reason.length > 500) throw Error('A reason is required (at most 500 characters)');
  const requestedAt = new Date(now).toISOString(), release = apply ? lock(state) : () => {};
  try {
    const file = path.join(state, 'inputs.json'), originalBytes = fs.readFileSync(file), manifest = JSON.parse(originalBytes);
    if (manifest.version !== 1 || !Array.isArray(manifest.files)) throw Error('Invalid input list');
    // Query the whole index: a requested case or directory-link alias may not
    // itself be indexed, although the real source (or a symlink ancestor) is.
    const tracked = new Set(git(config.sourceRepo, ['ls-files', '-z']).split('\0').filter(Boolean).map(fileKey));
    const isTracked = rel => {
      for (let name = rel; name !== '.'; name = path.posix.dirname(name)) if (tracked.has(fileKey(name))) return true;
      return false;
    };
    const realRoot = fs.realpathSync.native(config.sourceRepo), physical = new Set();
    // Validate every file before a blob or the list is written.
    const entries = files.map(rel => {
      if (!add && manifest.files.filter(row => row.area === 'app' && fileKey(row.file) === fileKey(rel)).length !== 1) throw Error(`Not a single registered app input: ${rel}`);
      if (isTracked(rel)) throw Error(`Tracked source is never pinned: ${rel}`);
      const source = path.join(config.sourceRepo, rel);
      if (!within(config.sourceRepo, source)) throw Error('Input escapes the source repository');
      const realSource = fs.realpathSync.native(source), inside = within(realRoot, realSource);
      if (add && (!inside || !fs.statSync(source).isFile())) throw Error('New input must be a file inside the source repository');
      const canonical = path.relative(realRoot, realSource).split(path.sep).join('/');
      if (inside && isTracked(canonical)) throw Error(`Tracked source is never pinned: ${rel}`);
      // New rows materialize this exact name on other filesystems, including
      // case-sensitive Linux. Preserve existing rows, but never add an alias.
      if (add && rel !== canonical) throw Error(`New input must use its canonical relative path: ${canonical}`);
      if (physical.has(fileKey(realSource))) throw Error('Choose distinct inputs; aliases resolve to the same file');
      physical.add(fileKey(realSource));
      const rows = manifest.files.filter(row => row.area === 'app' &&
        (fileKey(row.file) === fileKey(rel) || (add && sameFile(path.join(config.sourceRepo, relativePath(row.file)), realSource))));
      const data = fs.readFileSync(source);
      return { rel, rows, data, sha: sha256(data), source };
    });
    const recovered = recoverPrepared(state, entries, originalBytes, { add, reason: reason.trim(), requestedAt, apply });
    if (recovered) return recovered;
    const changes = entries.map(({ rel, rows, ...entry }) => {
      if (add ? rows.length !== 0 : rows.length !== 1) throw Error(add ? `Input is already registered: ${rel}` : `Not a single registered app input: ${rel}`);
      return { ...entry, row: rows[0] || { area: 'app', file: rel } };
    });
    const summary = { applied: apply, reason: reason.trim(), requestedAt,
      ...(add && { add: true }), files: changes.map(({ row, data, sha }) => ({ file: row.file, from: row.sha256 || null, to: sha, bytes: data.length, unchanged: sha === row.sha256 })) };
    if (!apply) return summary;
    const id = `${now}-${randomUUID()}`, ledger = path.join(state, 'input-history', `${id}.json`);
    for (const { row, data, sha, source } of changes) {
      if (sha === row.sha256) continue;
      if (add) manifest.files.push(row);
      else row.replaced = [...(row.replaced || []), { sha256: row.sha256, bytes: row.bytes, replacedAt: requestedAt, reason: summary.reason, request: id }];
      Object.assign(row, { sha256: sha, bytes: data.length, source });
    }
    const inputsAfterSha256 = sha256(Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
    for (const { data, sha } of changes) {
      const blob = path.join(state, 'blobs', sha);
      if (!fs.existsSync(blob)) fs.writeFileSync(blob, data, { flag: 'wx' });
      else if (sha256(fs.readFileSync(blob)) !== sha) throw Error('Immutable input blob changed');
    }
    write(ledger, { version: 1, id, ...summary, state: 'prepared', inputsBeforeSha256: sha256(originalBytes), inputsAfterSha256 });
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
    else if (arg === '--add') options.add = true;
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
