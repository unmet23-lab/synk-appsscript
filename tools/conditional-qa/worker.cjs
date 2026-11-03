'use strict';
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), os = require('node:os');
const { readManifest, coverage, sha256 } = require('./contract.cjs');
const { read, write, git, loadConfig, clone, prepare, postcheck } = require('./inputs.cjs');
const github = require('./github.cjs');
const { childRun } = require('./run.cjs');
const defaultState = () => path.join(os.homedir(), 'security-audit-skill/SYNK-conditional-qa');
// A tick opens new verifications only within this budget: one verification may take 50 minutes,
// and both the scheduled task and its hidden launcher stop a tick after two hours.
const BUDGET_MS = 60 * 60_000;
const due = (row, now = Date.now()) => ['queued', 'running', 'publish-pending'].includes(row.status) || (row.status === 'retry' && now >= row.retryAt);
// Publish an already verified receipt first. Alternate current/recent work with
// the oldest ready entry, so a stream of new pushes cannot starve the backlog.
// Selection never deletes or passes an older commit.
function nextItem(queue, head, attempted = new Set(), now = Date.now()) {
  const ready = queue.items.filter(row => due(row, now) && !attempted.has(row.commit));
  const oldest = queue.nextTurn === undefined ? attempted.size % 2 === 1 : queue.nextTurn === 'oldest';
  return ready.find(row => row.status === 'publish-pending') ||
    (oldest ? ready[0] : ready.find(row => row.commit === head) || ready.at(-1));
}
function advanceTurn(queue) {
  if (!['recent', 'oldest'].includes(queue.nextTurn)) throw Error('Invalid queue turn');
  queue.nextTurn = queue.nextTurn === 'recent' ? 'oldest' : 'recent';
}
// A lid-close sleep interrupts a run instead of failing a test (2026-11-01: two tutor tests ended at 606 s across a ten-minute sleep).
// Kernel-Power 42 (entering sleep) or 107 (resume) inside the run marks it interrupted; an unreadable log counts as no sleep.
function sleptDuring(from, to, { platform = process.platform, run = cp.execFileSync } = {}) {
  if (platform !== 'win32') return false;
  const range = `@SystemTime>='${new Date(from).toISOString()}' and @SystemTime<='${new Date(to).toISOString()}'`;
  try { return /<Event[\s>]/.test(run('wevtutil.exe', ['qe', 'System', `/q:*[System[Provider[@Name='Microsoft-Windows-Kernel-Power'] and (EventID=42 or EventID=107) and TimeCreated[${range}]]]`, '/c:1', '/f:xml'], { encoding: 'utf8', windowsHide: true, timeout: 30_000 })); }
  catch { return false; }
}
function failureDisposition(error, startedAt, { slept = sleptDuring, now = new Date() } = {}) {
  const interrupted = error.code === 'TEST_FAILURE' && slept(startedAt, now);
  return { interrupted, status: error.code === 'TEST_FAILURE' && !interrupted ? 'failed' : 'retry',
    publicationState: interrupted ? 'pending' : 'failure',
    description: interrupted ? 'System sleep interrupted verification; awaiting a fresh complete run' : 'Local verification incomplete; inspect the private worker receipt' };
}
function extendQueue(state, head, commits) {
  github.validCommit(head);
  for (const commit of commits) {
    github.validCommit(commit);
    if (!state.items.some(item => item.commit === commit)) state.items.push({ commit, status: 'queued' });
  }
  state.seen = head; return state;
}
function acquire(state) {
  const file = path.join(state, 'worker.lock');
  if (fs.existsSync(file)) {
    const owner = read(file); let alive = true;
    try { process.kill(owner.pid, 0); } catch (error) { if (error.code === 'ESRCH') alive = false; else throw error; }
    if (alive) throw Error('Local verifier is already running');
    // Remove only the dead worker's exact lock, never a process selected by its name.
    fs.unlinkSync(file);
  }
  const fd = fs.openSync(file, 'wx'); fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })); fs.closeSync(fd);
  return () => { if (read(file).pid !== process.pid) throw Error('Worker lock ownership changed'); fs.unlinkSync(file); };
}
function initialize(stateDir, firstCommit) {
  github.validCommit(firstCommit); const config = loadConfig(stateDir), root = clone(config);
  git(root, ['fetch', 'origin', 'master']);
  git(root, ['merge-base', '--is-ancestor', firstCommit, 'origin/master']);
  const file = path.join(stateDir, 'queue.json');
  if (fs.existsSync(file)) return read(file);
  const seen = git(root, ['rev-parse', `${firstCommit}^`]);
  const state = { version: 1, activatedAt: new Date().toISOString(), seen, items: [], nextTurn: 'recent' };
  write(file, state); return state;
}
async function verify(config, commit, output) {
  const context = prepare(config, commit), manifest = readManifest(config.root), cases = manifest.cases.filter(row => row.route === 'local');
  fs.mkdirSync(output, { recursive: true });
  const execution = await childRun([path.join(config.root, 'tools/conditional-qa/run.cjs'), '--route', 'local', '--output', output, '--context', path.join(config.state, 'context.json')],
    { cwd: config.root, env: { ...process.env }, log: path.join(output, 'runner.log'), timeoutMs: 50 * 60_000 });
  const receipt = read(path.join(output, 'result.json'));
  receipt.inputsUnchanged = postcheck(context);
  receipt.ok = receipt.ok && execution.exitCode === 0 && !execution.timedOut && receipt.inputDigest === context.inputDigest && !git(config.root, ['status', '--porcelain', '--untracked-files=no']);
  write(path.join(output, 'result.json'), receipt);
  if (!coverage(receipt, { commit, digest: manifest.digest, cases })) { const error = Error(`Local tests incomplete: ${receipt.passed}/${cases.length}`); error.code = 'TEST_FAILURE'; throw error; }
  return { receipt, count: cases.length, digest: manifest.digest };
}
// The flag stays until the commit's runs have settled, so a failed call or a run still in progress is looked at again.
// Least recently tried first: a commit that cannot settle yet never keeps the others from being looked at.
function resumeFinished(queue, resume = github.resumeWaitingWorkflow, now = Date.now()) {
  const flagged = queue.items.filter(row => row.resumePending).sort((a, b) => (a.resumeTriedAt || 0) - (b.resumeTriedAt || 0));
  for (const item of flagged.slice(0, 10)) {
    item.resumeTriedAt = now;
    try { item.resumePending = !resume(item.commit, { localPassed: item.status === 'passed' }); delete item.resumeError; }
    catch (error) { item.resumeError = error.message.slice(0, 500); }
  }
}
// A commit with a local result and a cancelled run has to be woken even if its item settled earlier. Each attempt of a run is looked at once.
// A failure that could not be published still reads as running, so waking its run would only cancel it again.
function markCancelledRuns(queue, cancelled) {
  for (const item of queue.items) {
    const run = cancelled.get(item.commit);
    if (run && (item.status === 'passed' || (item.status === 'failed' && !item.publicationError)) && item.checkedRun !== run) { item.checkedRun = run; item.resumePending = true; }
  }
}
async function tick(stateDir, { budgetMs = BUDGET_MS, slept = sleptDuring } = {}) {
  const config = loadConfig(stateDir), release = acquire(stateDir), queueFile = path.join(stateDir, 'queue.json'), started = Date.now();
  try {
    const root = clone(config); let head, queue;
    // Refetched after every verification, so commits pushed meanwhile join this tick instead of waiting for the next one.
    const refresh = () => {
      git(root, ['fetch', 'origin', 'master']); head = git(root, ['rev-parse', 'origin/master']); queue = read(queueFile);
      if (queue.version !== 1 || !Array.isArray(queue.items)) throw Error('Invalid local queue');
      // Upgrade an existing queue once. Its next turn then survives every tick/restart.
      if (queue.nextTurn === undefined) queue.nextTurn = 'recent';
      if (!['recent', 'oldest'].includes(queue.nextTurn)) throw Error('Invalid queue turn');
      github.validCommit(queue.seen); git(root, ['merge-base', '--is-ancestor', queue.seen, head]);
      const commits = git(root, ['rev-list', '--reverse', '--first-parent', `${queue.seen}..${head}`]).split(/\r?\n/).filter(Boolean);
      extendQueue(queue, head, commits); write(queueFile, queue);
    };
    // Between verifications too: one tick can last two hours while a finished commit's run stays unresolved.
    const settle = () => { resumeFinished(queue); write(queueFile, queue); };
    refresh();
    try { markCancelledRuns(queue, github.cancelledRuns()); } catch (error) { console.error(`Cancelled runs were not listed: ${error.message}`); }
    settle();
    // An interrupted process or network publication is resumed; a failed test stays explicitly failed.
    // Each commit is attempted once per tick, so an unavailable API cannot spin on the same publication.
    const attempted = new Set();
    for (let item; Date.now() - started < budgetMs && (item = nextItem(queue, head, attempted)); refresh(), settle()) {
      attempted.add(item.commit);
      git(root, ['merge-base', '--is-ancestor', item.commit, head]);
      try {
        if (item.status !== 'publish-pending') {
          advanceTurn(queue);
          item.status = 'running'; item.startedAt = new Date().toISOString(); delete item.resumePending; write(queueFile, queue);
          github.publish(item.commit, 'pending', 'Running the registered local conditional tests');
          item.output = path.join(stateDir, 'runs', `${item.commit}-${Date.now()}`);
          const result = await verify(config, item.commit, item.output);
          item.count = result.count; item.digest = result.digest; item.status = 'publish-pending'; write(queueFile, queue);
        }
        // Re-read the receipt after a process restart, rather than trusting queue.json's success flag.
        const receipt = read(path.join(item.output, 'result.json'));
        const savedManifest = JSON.parse(git(root, ['show', `${item.commit}:tools/conditional-qa/cases.json`]));
        const expected = savedManifest.cases.filter(row => row.route === 'local'), digest = sha256(JSON.stringify(savedManifest));
        if (item.digest !== digest || item.count !== expected.length || !receipt.inputsUnchanged || !coverage(receipt, { commit: item.commit, digest, cases: expected })) throw Error('Saved local proof is incomplete');
        github.publish(item.commit, 'success', github.description(item.count, item.digest));
        item.status = 'passed'; item.endedAt = new Date().toISOString(); item.resumePending = true; delete item.error; write(queueFile, queue);
      } catch (error) {
        item.error = error.message.slice(0, 1000);
        let publicationState = 'failure', description = 'Local verification incomplete; inspect the private worker receipt';
        if (item.status !== 'publish-pending') {
          const disposition = failureDisposition(error, item.startedAt, { slept });
          if (disposition.interrupted) item.error = `Interrupted by system sleep; verifying again. ${item.error}`.slice(0, 1000);
          item.status = disposition.status; item.retryAt = Date.now() + 15 * 60_000;
          ({ publicationState, description } = disposition);
        }
        try {
          github.publish(item.commit, publicationState, description);
          // local-coverage has released its runner, so a published failure has to wake it to turn the run red.
          if (publicationState === 'failure') item.resumePending = true;
        } catch { item.publicationError = true; }
        write(queueFile, queue);
      }
      write(queueFile, queue);
    }
    const summary = { checkedAt: new Date().toISOString(), head, queued: queue.items.filter(row => row.status === 'queued').length,
      incomplete: queue.items.filter(row => row.status !== 'passed').length,
      passed: queue.items.filter(row => row.status === 'passed').length, failed: queue.items.filter(row => row.status === 'failed').length,
      items: queue.items.slice(-5).map(({ commit, status, error }) => ({ commit, status, error })) };
    write(path.join(stateDir, 'last-run.json'), summary); console.log(JSON.stringify(summary)); return summary;
  } finally { release(); }
}
if (require.main === module) {
  // Task Scheduler starts the worker below normal priority and every test, server and browser under it inherits that;
  // on a busy PC they starved (a browser launch exceeded 30 s). Children started after this run at normal priority.
  try { if (os.getPriority() > os.constants.priority.PRIORITY_NORMAL) os.setPriority(os.constants.priority.PRIORITY_NORMAL); } catch {}
  const args = process.argv.slice(2), stateDir = args.includes('--state') ? args[args.indexOf('--state') + 1] : defaultState();
  const promise = args.includes('--initialize') ? Promise.resolve(initialize(stateDir, args[args.indexOf('--initialize') + 1])) : tick(stateDir);
  promise.catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { extendQueue, nextItem, advanceTurn, acquire, initialize, verify, tick, defaultState, sleptDuring, failureDisposition, due, resumeFinished, markCancelledRuns };
