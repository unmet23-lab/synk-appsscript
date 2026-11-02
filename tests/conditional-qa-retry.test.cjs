'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { retryFailed, parse } = require('../tools/conditional-qa/retry.cjs');
const { write, read } = require('../tools/conditional-qa/inputs.cjs');
const { acquire, due } = require('../tools/conditional-qa/worker.cjs');
const { REPO } = require('../tools/conditional-qa/github.cjs');
function fixture(t) {
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-qa-retry-'));
  t.after(() => { const real = fs.realpathSync(state); assert.ok(real.startsWith(fs.realpathSync(os.tmpdir()) + path.sep) && path.basename(real).startsWith('synk-qa-retry-')); fs.rmSync(real, { recursive: true, force: true }); });
  write(path.join(state, 'owner.json'), { version: 1, purpose: 'synk-conditional-qa', state });
  write(path.join(state, 'config.json'), { version: 1, repo: REPO, state, root: path.join(state, 'workspace/SYNK-appsscript') });
  const commits = ['a', 'b', 'c'].map(x => x.repeat(40));
  const items = commits.map((commit, i) => {
    const output = path.join(state, 'runs', commit);
    write(path.join(output, 'result.json'), { version: 1, commit, route: 'local', candidate: false, ok: i === 1, passed: i === 1 ? 78 : 77, endedAt: '2026-11-01T00:00:00Z' });
    return { commit, status: i === 1 ? 'passed' : 'failed', output, error: i === 1 ? undefined : 'Local tests incomplete: 77/78' };
  });
  write(path.join(state, 'queue.json'), { version: 1, seen: commits[2], items });
  return { state, commits, queue: path.join(state, 'queue.json'), options: { state, commits: [commits[0], commits[2]], reason: 'Execution priority repaired; verify the same commits again', now: 1000 } };
}
test('an explicit retry preserves exact failure evidence and history while requiring a new verification', t => {
  const f = fixture(t), before = fs.readFileSync(f.queue), old = read(f.queue);
  const proof = old.items.filter(row => row.status === 'failed').map(row => ({ file: path.join(row.output, 'result.json'), bytes: fs.readFileSync(path.join(row.output, 'result.json')) }));
  assert.equal(retryFailed(f.options).applied, false);
  assert.deepEqual(fs.readFileSync(f.queue), before);
  assert.equal(fs.existsSync(path.join(f.state, 'retry-history')), false);
  const result = retryFailed({ ...f.options, apply: true }), queue = read(f.queue);
  assert.equal(result.count, 2);
  assert.deepEqual(queue.items[1], old.items[1]);
  for (const index of [0, 2]) {
    const item = queue.items[index];
    assert.equal(item.status, 'retry'); assert.equal(due(item, 1000), true);
    assert.equal(item.output, undefined); assert.equal(item.error, undefined);
    assert.equal(item.history[0].status, 'failed'); assert.equal(item.history[0].output, old.items[index].output);
    assert.equal(item.history[0].error, old.items[index].error); assert.equal(item.retryRequest, result.id);
  }
  for (const row of proof) assert.deepEqual(fs.readFileSync(row.file), row.bytes);
  const ledger = read(path.join(f.state, 'retry-history', `${result.id}.json`));
  assert.equal(ledger.state, 'queued'); assert.deepEqual(ledger.previous.map(row => row.entry), [old.items[0], old.items[2]]);
  assert.equal(fs.existsSync(path.join(f.state, 'worker.lock')), false);
  assert.throws(() => retryFailed({ ...f.options, apply: true }), /not a unique failed entry/);
});
test('a live worker, an invalid selection, or an unrelated receipt cannot mutate the queue', t => {
  const f = fixture(t), before = fs.readFileSync(f.queue), unlock = acquire(f.state);
  try { assert.throws(() => retryFailed({ ...f.options, apply: true }), /already running/); } finally { unlock(); }
  assert.throws(() => retryFailed({ ...f.options, reason: '', apply: true }), /reason is required/);
  for (const commits of [[], [f.commits[0], f.commits[0]], ['../bad'], [f.commits[0], f.commits[1]]]) assert.throws(() => retryFailed({ ...f.options, commits, apply: true }));
  const row = read(f.queue).items[2], file = path.join(row.output, 'result.json'), receipt = read(file);
  for (const invalid of [{ ...receipt, candidate: true }, { ...receipt, commit: f.commits[0] }, { ...receipt, ok: true }]) {
    write(file, invalid); assert.throws(() => retryFailed({ ...f.options, apply: true }), /does not match/);
    assert.deepEqual(fs.readFileSync(f.queue), before);
  }
  assert.equal(fs.existsSync(path.join(f.state, 'retry-history')), false);
});
test('an output path outside this worker is rejected before reading or requeueing it', t => {
  const f = fixture(t), queue = read(f.queue);
  queue.items[0].output = f.state; write(f.queue, queue);
  const before = fs.readFileSync(f.queue);
  assert.throws(() => retryFailed({ ...f.options, apply: true }), /outside this worker/);
  assert.deepEqual(fs.readFileSync(f.queue), before);
  assert.equal(fs.existsSync(path.join(f.state, 'retry-history')), false);
});
test('a second failed attempt retains the earlier attempt and the first retry ledger', t => {
  const f = fixture(t), first = retryFailed({ ...f.options, commits: [f.commits[0]], apply: true });
  const ledgerFile = path.join(f.state, 'retry-history', `${first.id}.json`), firstLedger = fs.readFileSync(ledgerFile);
  const queue = read(f.queue), item = queue.items[0], output = path.join(f.state, 'runs', 'second');
  write(path.join(output, 'result.json'), { version: 1, commit: item.commit, route: 'local', candidate: false, ok: false });
  Object.assign(item, { status: 'failed', output, error: 'second real failure' }); write(f.queue, queue);
  retryFailed({ ...f.options, commits: [f.commits[0]], apply: true, now: 2000 });
  const history = read(f.queue).items[0].history;
  assert.equal(history.length, 2); assert.equal(history[1].error, 'second real failure');
  assert.deepEqual(fs.readFileSync(ledgerFile), firstLedger);
});
test('retry arguments require explicit commits and a reason', () => {
  const commit = 'a'.repeat(40);
  assert.deepEqual(parse(['--state', 'state', '--reason', 'fixed', commit, '--apply']), { state: 'state', reason: 'fixed', commits: [commit], apply: true });
  assert.throws(() => parse(['--reason']), /Missing/); assert.throws(() => parse(['--all']), /SHA/);
});
