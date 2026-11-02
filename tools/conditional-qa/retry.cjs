'use strict';
const fs = require('node:fs'), path = require('node:path'), { randomUUID } = require('node:crypto');
const { read, write, loadConfig } = require('./inputs.cjs');
const { validCommit } = require('./github.cjs');
const { sha256, within } = require('./contract.cjs');
const { acquire, defaultState } = require('./worker.cjs');

// A deliberate retry preserves the original failed attempt. Only a new complete
// verification can publish success; this command never writes a GitHub status.
function retryFailed({ state = defaultState(), commits, reason, apply = false, now = Date.now() }) {
  state = path.resolve(state); loadConfig(state);
  if (!Array.isArray(commits) || !commits.length || commits.length > 100 || new Set(commits).size !== commits.length) throw Error('Choose 1-100 distinct failed commits');
  commits.forEach(validCommit);
  if (typeof reason !== 'string' || !reason.trim() || reason.length > 500) throw Error('A retry reason is required (at most 500 characters)');
  const requestedAt = new Date(now).toISOString();
  const release = apply ? acquire(state) : () => {};
  try {
    const file = path.join(state, 'queue.json'), originalBytes = fs.readFileSync(file), queue = JSON.parse(originalBytes);
    if (queue.version !== 1 || !Array.isArray(queue.items)) throw Error('Invalid local queue');
    const runRoot = fs.realpathSync(path.join(state, 'runs'));
    // Validate the entire selection before creating a ledger or changing a row.
    const selected = commits.map(commit => {
      const matches = queue.items.filter(item => item.commit === commit);
      if (matches.length !== 1 || matches[0].status !== 'failed') throw Error(`Commit is not a unique failed entry: ${commit}`);
      const item = matches[0];
      if (typeof item.output !== 'string' || !within(runRoot, fs.realpathSync(item.output))) throw Error('Failure receipt is outside this worker');
      const receiptFile = path.join(item.output, 'result.json'), bytes = fs.readFileSync(receiptFile), receipt = JSON.parse(bytes);
      if (receipt.version !== 1 || receipt.commit !== commit || receipt.route !== 'local' || receipt.candidate !== false || receipt.ok !== false) throw Error(`Failure receipt does not match the failed commit: ${commit}`);
      return { item, receiptSha256: sha256(bytes), receiptEndedAt: receipt.endedAt || null };
    });
    const summary = { applied: apply, count: selected.length, commits, reason: reason.trim(), requestedAt };
    if (!apply) return summary;
    const id = `${now}-${randomUUID()}`, ledger = path.join(state, 'retry-history', `${id}.json`);
    const record = { version: 1, id, ...summary, state: 'prepared', queueBeforeSha256: sha256(originalBytes),
      previous: selected.map(({ item, receiptSha256 }) => ({ entry: structuredClone(item), receiptSha256 })) };
    write(ledger, record);
    for (const { item, receiptSha256, receiptEndedAt } of selected) {
      const { history = [], ...previous } = item;
      item.history = [...history, { ...previous, endedAt: previous.endedAt || receiptEndedAt, receiptSha256, retryRequest: id }];
      item.status = 'retry'; item.retryAt = now; item.retryRequest = id;
      for (const field of ['error', 'startedAt', 'endedAt', 'output', 'count', 'digest', 'publicationError', 'resumePending', 'resumeError']) delete item[field];
    }
    write(file, queue);
    write(ledger, { ...record, state: 'queued', queueAfterSha256: sha256(fs.readFileSync(file)) });
    return { ...summary, id };
  } finally { release(); }
}

function parse(args) {
  const options = { commits: [] };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--apply') options.apply = true;
    else if (arg === '--state' || arg === '--reason') {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw Error(`Missing value for ${arg}`);
      options[arg.slice(2)] = args[++i];
    } else { validCommit(arg); options.commits.push(arg); }
  }
  return options;
}
if (require.main === module) {
  try { console.log(JSON.stringify(retryFailed(parse(process.argv.slice(2))))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { retryFailed, parse };
