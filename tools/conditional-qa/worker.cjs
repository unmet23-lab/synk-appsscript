'use strict';
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), os = require('node:os');
const { readManifest, coverage, sha256 } = require('./contract.cjs');
const { read, write, git, loadConfig, clone, prepare, postcheck, slotConfigs } = require('./inputs.cjs');
const github = require('./github.cjs');
const { childRun } = require('./run.cjs');
const { runnerFor } = require('./legacy-profile.cjs');
const defaultState = () => path.join(os.homedir(), 'security-audit-skill/SYNK-conditional-qa');
// A tick opens new verifications only within this budget: one verification may take 50 minutes,
// and both the scheduled task and its hidden launcher stop a tick after two hours.
const BUDGET_MS = 60 * 60_000;
const MIN_VERIFICATION_FREE_BYTES = 2 * 1024 ** 3;
// Under load the registered browser tests stretch until they time out (S078 takes 3 s on a quiet PC and ran past its 165 s on 11-04 at 100% CPU),
// and a timeout stays a failure that a person has to look at. So verifications open by the load. This only waits; it never relaxes a limit or a verdict.
// Another verification beside a running one needs real room. The first waits out a saturated PC, for a while: a worker that never publishes turns red after 155 minutes.
const ROOM_CPU_PERCENT = 70, ROOM_FREE_MEMORY = 6 * 1024 ** 3, SATURATED_CPU_PERCENT = 95, SATURATED_WAIT_MS = 30 * 60_000;
const ROOM_RECHECK_MS = 30_000;
const hasRoom = (busy, freeMemory = os.freemem()) => busy !== null && busy < ROOM_CPU_PERCENT && freeMemory >= ROOM_FREE_MEMORY;
function saturationGate({ now = Date.now, waitMs = SATURATED_WAIT_MS } = {}) {
  let since = null;
  return busy => {
    if (busy !== null && busy < SATURATED_CPU_PERCENT) { since = null; return true; }
    since ??= now();
    if (now() - since < waitMs) return false;
    since = null;
    return true;
  };
}
const INCOMPLETE = 'Local verification incomplete; inspect the private worker receipt';
// Browser profiles, databases and test output all live on the registered state volume.
function diskWaitFor(item, stateDir, statfs = fs.statfsSync) {
  if (item.status === 'publish-pending') return null;
  const { bavail, bsize } = statfs(stateDir, { bigint: true });
  const availableBytes = Number(bavail * bsize);
  return availableBytes < MIN_VERIFICATION_FREE_BYTES ? { availableBytes, requiredBytes: MIN_VERIFICATION_FREE_BYTES } : null;
}
function browserProfileDiskFull(receipt, output) {
  if (receipt.platform !== 'win32' || receipt.candidate || !receipt.inputsUnchanged || !receipt.sourceUnchanged) return false;
  const failed = receipt.phases?.filter(phase => !phase.ok);
  return !!failed?.length && failed.every(phase => {
    const reports = phase.unexpectedFailures || [], rows = phase.rows || [];
    const failedRows = rows.filter(row => row.status === 'fail');
    if (!reports.length || reports.length !== failedRows.length || !rows.every(row => ['pass', 'missing', 'fail'].includes(row.status))) return false;
    const ownProfile = path.win32.join(output, phase.profile, 'temp', 'playwright_chromiumdev_profile-').toLowerCase();
    return reports.every(({ file, name, error }) => {
      const message = error?.message || '';
      return failedRows.some(row => row.file === file && row.name === name) &&
        message.startsWith('browserType.launch:') && message.includes('Failed to create initial profile') &&
        message.split('\n').some(line => line.toLowerCase().includes(ownProfile) && /\(0x70\)/i.test(line));
    });
  });
}
const due = (row, now = Date.now()) => ['queued', 'running', 'publish-pending'].includes(row.status) || (row.status === 'retry' && now >= row.retryAt);
// Publish an already verified receipt first. Alternate current/recent work with
// the oldest ready entry, so a stream of new pushes cannot starve the backlog.
// Selection never deletes or passes an older commit.
function nextItem(queue, head, attempted = new Set(), now = Date.now(), requestedCommit = null) {
  const ready = queue.items.filter(row => due(row, now) && !attempted.has(row.commit));
  if (requestedCommit !== null) {
    const matches = queue.items.filter(row => row.commit === requestedCommit);
    if (matches.length !== 1) throw Error('Choose one commit already registered in the local queue');
    if (!attempted.has(requestedCommit) && matches[0].status === 'failed') throw Error('Register the failed commit with retry.cjs before verifying it again');
    return ready.find(row => row.commit === requestedCommit);
  }
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
  if (error.code === 'ENOSPC') return { interrupted: false, status: 'retry', publicationState: 'pending',
    description: 'Local storage is full; awaiting a fresh complete verification' };
  const interrupted = error.code === 'TEST_FAILURE' && slept(startedAt, now);
  return { interrupted, status: error.code === 'TEST_FAILURE' && !interrupted ? 'failed' : 'retry',
    publicationState: interrupted ? 'pending' : 'failure',
    description: interrupted ? 'System sleep interrupted verification; awaiting a fresh complete run' : INCOMPLETE };
}
function extendQueue(state, head, commits) {
  github.validCommit(head);
  for (const commit of commits) {
    github.validCommit(commit);
    if (!state.items.some(item => item.commit === commit)) state.items.push({ commit, status: 'queued' });
  }
  state.seen = head; return state;
}
function acquire(state, { reclaimDead = true } = {}) {
  const file = path.join(state, 'worker.lock');
  if (fs.existsSync(file)) {
    if (!reclaimDead) throw Error('Local verifier is already running; the scheduled worker recovers an abandoned lock');
    const owner = read(file); let alive = true;
    try { process.kill(owner.pid, 0); } catch (error) { if (error.code === 'ESRCH') alive = false; else throw error; }
    if (alive) throw Error('Local verifier is already running');
    // Remove only the dead worker's exact lock, never a process selected by its name.
    fs.unlinkSync(file);
  }
  let fd;
  try { fd = fs.openSync(file, 'wx'); }
  catch (error) { if (error.code === 'EEXIST') throw Error('Local verifier is already running'); throw error; }
  try { fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })); }
  catch (error) { fs.closeSync(fd); fs.unlinkSync(file); throw error; }
  fs.closeSync(fd);
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
// A slot's clone has not seen what the scheduled checkout just fetched.
function ensureCommit(root, commit) {
  try { git(root, ['cat-file', '-e', `${commit}^{commit}`], { stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { git(root, ['fetch', 'origin', 'master']); }
}
async function verify(config, commit, output, serialRetry = false) {
  ensureCommit(config.root, commit);
  const context = prepare(config, commit), manifest = readManifest(config.root), cases = manifest.cases.filter(row => row.route === 'local');
  fs.mkdirSync(output, { recursive: true });
  const execution = await childRun([runnerFor(config.root), '--route', 'local', '--output', output, '--context', path.join(config.state, 'context.json')],
    { cwd: config.root, env: { ...process.env, SYNK_QA_SERIAL_RETRY: serialRetry ? '1' : '0' }, log: path.join(output, 'runner.log'), timeoutMs: 50 * 60_000 });
  const receipt = read(path.join(output, 'result.json'));
  receipt.inputsUnchanged = postcheck(context);
  receipt.ok = receipt.ok && execution.exitCode === 0 && !execution.timedOut && receipt.inputDigest === context.inputDigest && !git(config.root, ['status', '--porcelain', '--untracked-files=no']);
  write(path.join(output, 'result.json'), receipt);
  if (!coverage(receipt, { commit, digest: manifest.digest, cases })) {
    const error = Error(`Local tests incomplete: ${receipt.passed}/${cases.length}`);
    const ownInput = receipt.commit === commit && receipt.manifestDigest === manifest.digest && receipt.inputDigest === context.inputDigest;
    error.code = ownInput && browserProfileDiskFull(receipt, output) ? 'ENOSPC' : 'TEST_FAILURE';
    throw error;
  }
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
// A failure that could not be published still reads as running. It is published again, and only then is its run woken.
function republishFailures(queue, publish = github.publish) {
  for (const item of queue.items.filter(row => row.status === 'failed' && row.publicationError).slice(0, 10)) {
    try { publish(item.commit, 'failure', INCOMPLETE); delete item.publicationError; item.resumePending = true; }
    catch { /* Tried again between verifications. */ }
  }
}
function checkSavedReceipt(root, item, runGit = git) {
  const receipt = read(path.join(item.output, 'result.json'));
  const savedManifest = JSON.parse(runGit(root, ['show', `${item.commit}:tools/conditional-qa/cases.json`]));
  const expected = savedManifest.cases.filter(row => row.route === 'local'), digest = sha256(JSON.stringify(savedManifest));
  if (item.digest !== digest || item.count !== expected.length || !receipt.inputsUnchanged || !coverage(receipt, { commit: item.commit, digest, cases: expected })) throw Error('Saved local proof is incomplete');
}
// A passed run keeps its receipt, TAP and events. Its screens, database and temp files are 70 MB a run: at 300 runs a day that outgrows this disk
// before a daily sweep comes round, and nothing reads them again. A failed or unfinished run keeps everything; the space guard sweeps what a crash left behind.
const KEPT_PROFILE_FILES = new Set(['tests.tap', 'events.jsonl', 'process.log']);
function trimPassedRun(output) {
  for (const profile of fs.readdirSync(output, { withFileTypes: true })) {
    if (!profile.isDirectory()) continue;
    const folder = path.join(output, profile.name);
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if (entry.isFile() && KEPT_PROFILE_FILES.has(entry.name)) continue;
      try { fs.rmSync(path.join(folder, entry.name), { recursive: true, force: true, maxRetries: 2 }); } catch { /* Still locked: the space guard takes it later. */ }
    }
  }
}
function cpuMeter({ cpus = os.cpus, now = Date.now, windowMs = 20_000 } = {}) {
  const sample = () => cpus().reduce((sum, { times }) => ({ idle: sum.idle + times.idle, total: sum.total + times.user + times.nice + times.sys + times.idle + times.irq }), { idle: 0, total: 0 });
  let from = sample(), at = now(), busy = null;
  return () => {
    if (now() - at >= windowMs) {
      const to = sample();
      if (to.total > from.total) busy = Math.round(100 * (1 - (to.idle - from.idle) / (to.total - from.total)));
      from = to; at = now();
    }
    return busy;
  };
}
// Runs one job per checkout, opening each when mayOpenFirst or mayOpenAnother allows. A job holds its checkout until it settles, and can give it up for this tick.
// The pool never returns while a job runs, so the caller's lock outlives every verification, and a failure stops new jobs without abandoning the others.
async function runPool({ slots, pick, run, mayOpenFirst = () => true, mayOpenAnother = () => true, finished = () => {}, recheckMs = ROOM_RECHECK_MS }) {
  const free = [...slots], running = new Set();
  let fatal = null, settled = 0;
  for (;;) {
    let waiting = false;
    try {
      while (!fatal && free.length) {
        if (!(running.size ? mayOpenAnother() : mayOpenFirst())) { waiting = true; break; }
        const item = pick();
        if (!item) break;
        const slot = free.shift();
        // run() goes up to its first await before the next pick(), so the turn it takes is seen by that pick().
        const job = run(item, slot).then(outcome => { if (!outcome?.retireSlot) free.unshift(slot); }, error => { fatal ??= error; }).finally(() => { running.delete(job); settled++; });
        running.add(job);
      }
    } catch (error) { fatal ??= error; }
    if (!running.size && (fatal || !waiting)) break;
    const before = settled; let timer;
    await Promise.race([...running, new Promise(resolve => { timer = setTimeout(resolve, recheckMs); })]);
    clearTimeout(timer);
    if (settled !== before && !fatal) { try { finished(); } catch (error) { fatal = error; } }
  }
  if (fatal) throw fatal;
}
async function tick(stateDir, { budgetMs = BUDGET_MS, slept = sleptDuring, requestedCommit = null, hub = github, runGit = git, cloneRoot = clone, verifyCommit = verify, room = hasRoom, meter = cpuMeter(), recheckMs = ROOM_RECHECK_MS } = {}) {
  if (requestedCommit !== null) github.validCommit(requestedCommit);
  const config = loadConfig(stateDir), release = acquire(stateDir, { reclaimDead: requestedCommit === null }), queueFile = path.join(stateDir, 'queue.json'), started = Date.now();
  try {
    const root = cloneRoot(config), queue = read(queueFile); let head;
    if (queue.version !== 1 || !Array.isArray(queue.items)) throw Error('Invalid local queue');
    // Upgrade an existing queue once. Its next turn then survives every tick/restart.
    if (queue.nextTurn === undefined) queue.nextTurn = 'recent';
    if (!['recent', 'oldest'].includes(queue.nextTurn)) throw Error('Invalid queue turn');
    // Refetched after every verification, so commits pushed meanwhile join this tick instead of waiting for the next one.
    // The queue is read once: every writer holds the lock, and a running verification keeps pointing at these same items.
    const refresh = () => {
      runGit(root, ['fetch', 'origin', 'master']); head = runGit(root, ['rev-parse', 'origin/master']);
      github.validCommit(queue.seen); runGit(root, ['merge-base', '--is-ancestor', queue.seen, head]);
      const commits = runGit(root, ['rev-list', '--reverse', '--first-parent', `${queue.seen}..${head}`]).split(/\r?\n/).filter(Boolean);
      extendQueue(queue, head, commits); write(queueFile, queue);
    };
    // Between verifications too: one tick can last two hours while a finished commit's run stays unresolved.
    const settle = () => { republishFailures(queue, hub.publish); resumeFinished(queue, hub.resumeWaitingWorkflow); write(queueFile, queue); };
    refresh();
    try { markCancelledRuns(queue, hub.cancelledRuns()); } catch (error) { console.error(`Cancelled runs were not listed: ${error.message}`); }
    settle();
    // An interrupted process or network publication is resumed; a failed test stays explicitly failed.
    // Each commit is attempted once per tick, so an unavailable API cannot spin on the same publication.
    const attempted = new Set(), saturated = saturationGate();
    let diskWait = null, busy = null, held = 0;
    const pick = () => {
      diskWait = null;
      if (Date.now() - started >= budgetMs) return undefined;
      const item = nextItem(queue, head, attempted, Date.now(), requestedCommit);
      if (!item) return undefined;
      diskWait = diskWaitFor(item, stateDir);
      if (diskWait) return undefined;
      attempted.add(item.commit);
      return item;
    };
    const run = async (item, checkout) => {
      runGit(root, ['merge-base', '--is-ancestor', item.commit, head]);
      try {
        if (item.status !== 'publish-pending') {
          if (requestedCommit === null) advanceTurn(queue);
          item.status = 'running'; item.startedAt = new Date().toISOString(); item.slot = checkout === config ? 1 : Number(path.basename(checkout.state)); item.cpuAtStart = busy;
          delete item.resumePending; write(queueFile, queue);
          hub.publish(item.commit, 'pending', 'Running the registered local conditional tests');
          item.output = path.join(stateDir, 'runs', `${item.commit}-${Date.now()}`);
          const result = await verifyCommit(checkout, item.commit, item.output, Boolean(item.retryRequest));
          item.count = result.count; item.digest = result.digest; item.status = 'publish-pending'; write(queueFile, queue);
        }
        // Re-read the receipt after a process restart, rather than trusting queue.json's success flag.
        checkSavedReceipt(root, item, runGit);
        hub.publish(item.commit, 'success', github.description(item.count, item.digest));
        item.status = 'passed'; item.endedAt = new Date().toISOString(); item.resumePending = true; delete item.error; delete item.publicationError; write(queueFile, queue);
      } catch (error) {
        item.error = error.message.slice(0, 1000);
        let publicationState = 'failure', description = INCOMPLETE, retireSlot = false;
        if (item.status !== 'publish-pending') {
          const disposition = failureDisposition(error, item.startedAt, { slept });
          if (disposition.interrupted) item.error = `Interrupted by system sleep; verifying again. ${item.error}`.slice(0, 1000);
          item.status = disposition.status; item.retryAt = Date.now() + 15 * 60_000;
          ({ publicationState, description } = disposition);
          // Not a test result: this checkout or the network is the suspect, so it stops for this tick instead of failing every commit it is handed.
          retireSlot = !['TEST_FAILURE', 'ENOSPC'].includes(error.code);
        }
        try {
          hub.publish(item.commit, publicationState, description);
          delete item.publicationError;
          // local-coverage has released its runner, so a published failure has to wake it to turn the run red.
          if (publicationState === 'failure') item.resumePending = true;
        } catch { item.publicationError = true; }
        write(queueFile, queue);
        return { retireSlot };
      }
      // Outside the result's try: a file left locked or a missing folder never turns a published pass into anything else.
      try { trimPassedRun(item.output); } catch (error) { console.error(`Passed run was not trimmed: ${error.message}`); }
    };
    const checkouts = requestedCommit === null ? [config, ...slotConfigs(stateDir)] : [config];
    // Nothing to wait for without a verification to open: a requested commit, a saved result to publish, an empty queue or a spent budget.
    const nothingToHold = () => {
      if (requestedCommit !== null || Date.now() - started >= budgetMs) return true;
      const item = nextItem(queue, head, attempted);
      return !item || item.status === 'publish-pending';
    };
    const gated = allowedAt => () => {
      if (nothingToHold()) return true;
      busy = meter();
      const allowed = allowedAt(busy);
      if (!allowed) held++;
      return allowed;
    };
    await runPool({ slots: checkouts, pick, run, recheckMs, finished: () => { refresh(); settle(); }, mayOpenFirst: gated(saturated), mayOpenAnother: gated(room) });
    const summary = { checkedAt: new Date().toISOString(), head, slots: checkouts.length, roomHeld: held, ...(diskWait && { diskWait }), queued: queue.items.filter(row => row.status === 'queued').length,
      incomplete: queue.items.filter(row => row.status !== 'passed').length,
      passed: queue.items.filter(row => row.status === 'passed').length, failed: queue.items.filter(row => row.status === 'failed').length,
      items: queue.items.slice(-5).map(({ commit, status, error }) => ({ commit, status, error })) };
    if (requestedCommit !== null) {
      const selected = queue.items.find(row => row.commit === requestedCommit);
      if (!selected) throw Error('Choose one commit already registered in the local queue');
      if (selected.status === 'passed' && !attempted.has(requestedCommit)) checkSavedReceipt(root, selected, runGit);
      summary.requested = { commit: requestedCommit, status: selected.status, attempted: attempted.has(requestedCommit) };
    }
    write(path.join(stateDir, 'last-run.json'), summary); console.log(JSON.stringify(summary)); return summary;
  } finally { release(); }
}
if (require.main === module) {
  // Task Scheduler starts the worker below normal priority and every test, server and browser under it inherits that;
  // on a busy PC they starved (a browser launch exceeded 30 s). Children started after this run at normal priority.
  try { if (os.getPriority() > os.constants.priority.PRIORITY_NORMAL) os.setPriority(os.constants.priority.PRIORITY_NORMAL); } catch {}
  const args = process.argv.slice(2), stateDir = args.includes('--state') ? args[args.indexOf('--state') + 1] : defaultState();
  const targetIndex = args.indexOf('--registered-commit');
  if (targetIndex >= 0 && (args.includes('--initialize') || targetIndex !== args.lastIndexOf('--registered-commit'))) throw Error('Choose one registered commit per verification');
  const requestedCommit = targetIndex >= 0 ? args[targetIndex + 1] || '' : null;
  const promise = args.includes('--initialize') ? Promise.resolve(initialize(stateDir, args[args.indexOf('--initialize') + 1])) : tick(stateDir, { requestedCommit });
  promise.then(summary => {
    if (requestedCommit !== null && summary.requested.status !== 'passed') process.exitCode = summary.requested.status === 'failed' ? 1 : 2;
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { extendQueue, nextItem, advanceTurn, acquire, initialize, verify, tick, defaultState, sleptDuring, failureDisposition, due, resumeFinished, markCancelledRuns, republishFailures, diskWaitFor, browserProfileDiskFull, runPool, cpuMeter, hasRoom, saturationGate, trimPassedRun };
