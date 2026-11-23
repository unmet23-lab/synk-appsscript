'use strict';
const fs = require('node:fs'), path = require('node:path');
const { CONTEXT, sha256, readManifest } = require('./contract.cjs');
const { REPO, request, accepted, failedCases, failureDescription, traceDescription, graphql } = require('./github.cjs');
// local-coverage cancels its own run while the PC verifies, and a cancelled run is never counted as red. So a stopped PC or
// a failure on an older commit would make no signal at all. This reads every queued commit's status; it never runs a test or writes a pass.
const FIRST_COMMIT = 'df9ec0dff34be52fc0fabff03381a0a2e59e639f'; // The worker's activation point; older commits were never queued.
const MAX_COMMITS = 3000, PAGE = 100, READ_ATTEMPTS = 3;
const STALL_MS = 155 * 60_000; // Current verification, one backlog turn, one newest turn (each <=50 min), and a scheduler interval.
const OVERDUE_MS = 72 * 3600_000; // The backlog may not outlast this: half the worker's turns go to the oldest commit.
const FAILURE_RED_MS = 24 * 3600_000; // A failure stays listed until retried; red only while new, so a later failure is not buried.
const WAITING_PREFIX = 'WAIT '; // Written by local-coverage, not by the worker.
// Written by the worker for a commit it does not measure (README #run-criterion). Pending, so it never passes; settled, so it never waits.
const NOT_RUN_PREFIX = 'NOT RUN:';
const notRunStatus = value => value?.state === 'pending' && value.description.startsWith(NOT_RUN_PREFIX);
// A worker that keeps marking commits not run must still measure the newest master: four full runs a day, so a day without one is red.
const VERDICT_MS = 24 * 3600_000;
// The line since activation outgrew the first 1000-commit window on 11-06 00:28 and every run turned red; at 200-300 pushes a day a larger
// fixed window only moves that date. Every alert needs a young commit or a fresh status: a waiting commit turns red at 72 h and a failure stays
// red for 24 h. So the read may end once a page's worth of the oldest commits read are older than both together and settled
// (a pass, or a failure no longer red). The worker takes the oldest ready commit every other turn, so nothing older still waits behind such a run;
// an old commit that is waiting or failed afresh keeps the read going. Reading the activation commit also ends it.
const HORIZON_MS = OVERDUE_MS + FAILURE_RED_MS, SETTLED_RUN = 50;
function settledLongAgo(node, now) {
  const found = (node.status?.contexts || []).find(row => row.context === CONTEXT);
  if (!found || (found.description || '').startsWith(WAITING_PREFIX)) return false;
  return found.state === 'SUCCESS' || (found.state === 'PENDING' && (found.description || '').startsWith(NOT_RUN_PREFIX))
    || (['FAILURE', 'ERROR'].includes(found.state) && now - Date.parse(found.createdAt) >= FAILURE_RED_MS);
}
const historyQuery = size => `query($owner:String!,$name:String!,$ref:String!,$after:String){repository(owner:$owner,name:$name){object(expression:$ref){... on Commit{history(first:${size},after:$after){pageInfo{hasNextPage endCursor}
  nodes{oid committedDate parents(first:1){nodes{oid}} file(path:"tools/conditional-qa/cases.json"){oid} status{contexts{id context state description createdAt}}}}}}}}`;

const waitBriefly = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function readPage(query, variables, size, pause) {
  for (let attempt = 1; ; attempt++) {
    try {
      const history = query(historyQuery(size), variables).data?.repository?.object?.history;
      if (!history) throw Error('The master history could not be read');
      return { history, size };
    } catch (error) {
      if (attempt >= READ_ATTEMPTS) throw error;
      size = SETTLED_RUN; // GitHub has returned HTTP 502 for a full 100-node page.
      pause(attempt * 10_000);
    }
  }
}
// complete: the read reached the activation commit, or a settled run past the horizon (see HORIZON_MS). Anything else stays red.
function fetchHistory({ query = graphql, first = FIRST_COMMIT, limit = MAX_COMMITS, pause = waitBriefly, now = Date.now(), horizonMs = HORIZON_MS } = {}) {
  const [owner, name] = REPO.split('/'), byOid = new Map(), line = []; let head, reachedFirst = false, pastHorizon = false;
  // Follow first parents, the same line the worker queues; a merged side branch is verified through its merge.
  const walk = () => {
    const next = line.length ? line.at(-1).parents.nodes[0]?.oid : head;
    for (let node = byOid.get(next); node && line.length < limit; node = byOid.get(node.parents.nodes[0]?.oid)) {
      line.push(node);
      if (node.oid === first) { reachedFirst = true; break; }
    }
    const oldest = line.slice(-SETTLED_RUN);
    pastHorizon = !reachedFirst && oldest.length === SETTLED_RUN && oldest.every(node => now - Date.parse(node.committedDate) >= horizonMs && settledLongAgo(node, now));
  };
  for (let after = null, more = true, size = PAGE; more && byOid.size < limit && !reachedFirst && !pastHorizon;) {
    const page = readPage(query, { owner, name, ref: head || 'master', ...(after ? { after } : {}) }, size, pause);
    const { history } = page;
    size = page.size;
    head ||= history.nodes[0]?.oid;
    more = history.pageInfo.hasNextPage; after = history.pageInfo.endCursor;
    // Keep the same first-parent and alert boundaries as a sequence of 50-node reads.
    for (let offset = 0; offset < history.nodes.length; offset += SETTLED_RUN) {
      for (const node of history.nodes.slice(offset, offset + SETTLED_RUN)) byOid.set(node.oid, node);
      walk();
      if (reachedFirst || pastHorizon || byOid.size >= limit) break;
    }
  }
  return { line, reachedFirst, complete: reachedFirst || pastHorizon };
}
function manifestAt(oid, { api = request, cache = new Map() } = {}) {
  if (!cache.has(oid)) {
    const manifest = JSON.parse(Buffer.from(api(`repos/${REPO}/git/blobs/${oid}`).content, 'base64'));
    cache.set(oid, { count: manifest.cases.filter(row => row.route === 'local').length, digest: sha256(JSON.stringify(manifest)) });
  }
  return cache.get(oid);
}
function toRow(node, manifest) {
  const found = (node.status?.contexts || []).find(row => row.context === CONTEXT);
  return { commit: node.oid, committedAt: node.committedDate, manifest, status: found ? { id: found.id, state: found.state.toLowerCase(), description: found.description || '', createdAt: found.createdAt } : null };
}
// A commit's own tests are frozen with it, so a test that was wrong for a stretch of commits fails on every one of them and a retry cannot pass.
// diagnosed.json lists those stretches once someone has found the cause. It only stops the alert: the commit keeps its failure and is never counted as passed.
function readDiagnosed(file = path.join(__dirname, 'diagnosed.json'), manifest = readManifest(path.resolve(__dirname, '../..'))) {
  const ledger = JSON.parse(fs.readFileSync(file, 'utf8')), local = new Set(manifest.cases.filter(row => row.route === 'local').map(row => row.id));
  if (ledger.version !== 1 || !Array.isArray(ledger.ranges)) throw Error('Invalid diagnosed ledger');
  for (const range of ledger.ranges) {
    const commits = [range.from, range.fixedBy];
    if (range.kind !== undefined || range.reviewedStatuses !== undefined) {
      if (range.kind !== 'trace' || range.cases?.length !== 1 || !Array.isArray(range.reviewedStatuses)) throw Error('Invalid diagnosed trace range');
      const seen = new Set();
      for (const row of range.reviewedStatuses) {
        if (!/^[a-f0-9]{40}$/.test(row.commit) || !/^SC_[\w-]+$/.test(row.statusId) || seen.has(row.statusId)
          || !/^[a-f0-9]{64}$/.test(row.manifest) || !/^[a-f0-9]{64}$/.test(row.receiptSha256)) throw Error('Invalid reviewed trace receipt');
        seen.add(row.statusId);
      }
    }
    if (range.exactCases !== undefined && typeof range.exactCases !== 'boolean') throw Error('Invalid diagnosed range case matching mode');
    if (range.exactCases && Array.isArray(range.cases) && new Set(range.cases).size !== range.cases.length) throw Error('Invalid diagnosed range with duplicate cases');
    if (!commits.every(commit => /^[0-9a-f]{40}$/.test(commit)) || range.from === range.fixedBy || !Array.isArray(range.cases) || !range.cases.length || !range.cases.every(id => local.has(id)) || typeof range.cause !== 'string' || !range.cause.trim()) throw Error(`Invalid diagnosed range: ${JSON.stringify(range).slice(0, 200)}`);
  }
  return ledger.ranges;
}
// Newest first: a range holds from `from` up to, but not including, the commit that stopped the failure.
// truncated: the read ended at the alert horizon, not at the activation commit. Then a range wholly older than the rows has nothing to explain,
// and one whose `from` is older runs to the oldest row read. A missing fixedBy with `from` in the rows is still a broken range.
// A read that ends exactly on fixedBy holds no commit of the range either, since the range stops before fixedBy. Reads end on page boundaries, so
// this hit one push in fifty per range (11-08 acd9aba92: fixedBy was row 850 of 850, three runs red, the next push green).
function placeRanges(rows, diagnosed, { truncated = false } = {}) {
  const position = new Map(rows.map((row, index) => [row.commit, index])), spans = [], broken = [];
  for (const range of diagnosed) {
    const newest = position.get(range.fixedBy); let oldest = position.get(range.from);
    if (truncated && oldest === undefined) { if (newest === undefined || newest === rows.length - 1) continue; oldest = rows.length - 1; }
    if (newest === undefined || oldest === undefined || newest >= oldest) broken.push(range); else spans.push({ ...range, newest, oldest });
  }
  return { position, spans, broken };
}
// A failed case outside its range, a plain line or a partial list stays an alert.
function explain(row, { position, spans }) {
  const at = position.get(row.commit), active = spans.filter(span => at > span.newest && at <= span.oldest);
  const { status, manifest } = row;
  for (const span of active) {
    if (span.kind !== 'trace' || status.state !== 'failure') continue;
    const exactTrace = manifest.count > 0 && /^[0-9a-f]{64}$/.test(manifest.digest)
      && status.description === traceDescription(manifest.count, manifest.digest, span.cases[0]);
    // Old workers had no trace-specific message. A later status on the same commit needs its own diagnosis.
    const reviewed = status.description === 'Local verification incomplete; inspect the private worker receipt'
      && span.reviewedStatuses.some(proof => proof.commit === row.commit && proof.statusId === status.id && proof.manifest === manifest.digest);
    if (exactTrace || reviewed) return { cases: span.cases, ranges: [span] };
  }
  const named = failedCases(status.description);
  if (!named?.complete) return null;
  const count = row.manifest.count;
  const exactCount = row.status.description === failureDescription(count - named.ids.length, count, named.ids);
  const eligible = active.filter(span => span.kind !== 'trace' && (!span.exactCases ||
    (exactCount && span.cases.length === named.ids.length && span.cases.every(id => named.ids.includes(id)))));
  const covering = named.ids.map(id => eligible.find(span => span.cases.includes(id)));
  return covering.every(Boolean) ? { cases: named.ids, ranges: [...new Set(covering)] } : null;
}
function failureLine(row, manifestCases) {
  const named = failedCases(row.status.description), text = `local verification failed at ${row.commit}`;
  if (!named) return { text };
  const first = manifestCases.get(named.ids[0]), label = named.ids.length === 1 && named.complete && first ? `${named.ids[0]} ${first.name}` : `${named.ids.join(' ')}${named.complete ? '' : ' and more'}`;
  return { text: `${text}: ${label}`, location: first?.file, cases: named.ids };
}
// Every state other than an exact PASS of that commit's own manifest stays unfinished. Pending, absent, offline or not run never passes.
function judge(rows, { now = Date.now(), reachedFirst = true, truncated = false, diagnosed = [], manifestCases = new Map() } = {}) {
  const passed = [], notRun = [], waiting = [], failed = [], invalid = [], explained = [], details = new Map(); let activityAt = 0, verdictAt = 0, notRunAt = 0;
  for (const row of rows) {
    const { status: value, manifest } = row, at = value ? Date.parse(value.createdAt) : 0;
    if (value && !value.description.startsWith(WAITING_PREFIX)) activityAt = Math.max(activityAt, at);
    if (accepted(value, manifest.count, manifest.digest)) { passed.push(row); verdictAt = Math.max(verdictAt, at); }
    else if (value?.state === 'failure' || value?.state === 'error') { failed.push(row); verdictAt = Math.max(verdictAt, at); }
    else if (value?.state === 'success') invalid.push(row);
    else if (notRunStatus(value)) { notRun.push(row); notRunAt = Math.max(notRunAt, at); }
    else waiting.push(row);
  }
  const oldest = waiting.at(-1), problems = [], placed = placeRanges(rows, diagnosed, { truncated });
  for (const range of placed.broken) problems.push(`diagnosed range ${range.from} to ${range.fixedBy} is not on the master line`);
  for (const row of failed) {
    const reason = explain(row, placed);
    if (reason) { explained.push({ commit: row.commit, ...reason }); continue; }
    if (now - Date.parse(row.status.createdAt) >= FAILURE_RED_MS) continue;
    const line = failureLine(row, manifestCases);
    problems.push(line.text); details.set(line.text, { ...line, commit: row.commit });
  }
  for (const row of invalid) problems.push(`local success does not match the manifest of ${row.commit}`);
  if (waiting.length && now - activityAt > STALL_MS) problems.push('local worker published no new result within the limit');
  if (oldest && now - Date.parse(oldest.committedAt) > OVERDUE_MS) problems.push('local backlog is older than the limit');
  if (notRunAt && notRunAt - verdictAt > VERDICT_MS) problems.push('local worker marked commits not run but completed no verification within 24 hours');
  // reachedFirst is fetchHistory's `complete`: the activation commit, or a settled run past the horizon.
  if (!reachedFirst) problems.push('the status window ended before the first queued commit or a settled run past the alert horizon');
  return { ok: problems.length === 0, problems, details, explained, failedCases: new Map(failed.map(row => [row.commit, failedCases(row.status.description)?.ids || []])), passed: passed.length, notRun: notRun.length, waiting: waiting.length, failed: failed.map(row => row.commit), invalid: invalid.length, oldest: oldest?.commit || null, oldestAt: oldest?.committedAt || null, activityAt: activityAt ? new Date(activityAt).toISOString() : null };
}
// TAP lines: tools/ci빨간불.js names each problem from them, so only a new failure sends a new alert.
function report(result) {
  const lines = [`local statuses: ${result.passed} passed, ${result.notRun} not run, ${result.waiting} waiting, ${result.failed.length} failed`, `newest worker result: ${result.activityAt || 'none'}`];
  if (result.oldest) lines.push(`oldest waiting: ${result.oldest} committed ${result.oldestAt}`);
  for (const commit of result.failed) lines.push(`failed, kept until a retry passes: ${commit}${(result.failedCases?.get(commit) || []).map(id => ` ${id}`).join('')}`);
  for (const row of result.explained || []) lines.push(`diagnosed, no alert: ${row.commit} ${row.cases.join(' ')} — ${row.ranges.map(range => `${range.cause} (fixed by ${range.fixedBy.slice(0, 12)})`).join(' · ')}`);
  result.problems.forEach((problem, index) => {
    lines.push(`not ok ${index + 1} - ${problem}`);
    const detail = result.details?.get(problem);
    // Read by tools/lib/tap실패.js, so the alert names the test file and where its evidence is.
    if (detail?.commit) lines.push('  ---', "  type: 'test'", ...(detail.location ? [`  location: '${detail.location}'`] : []), `  → 이 PC의 영수증: ~/security-audit-skill/SYNK-conditional-qa/runs/${detail.commit}-*/result.json (phases[].unexpectedFailures)`, '  ...');
  });
  if (result.ok) lines.push('Unfinished commits stay pending until the worker verifies them; this check does not pass them.');
  return lines.join('\n');
}
function check({ now = Date.now(), query = graphql, api = request, diagnosed = readDiagnosed(), manifestCases = new Map(readManifest(path.resolve(__dirname, '../..')).cases.map(row => [row.id, row])) } = {}) {
  const { line, complete, reachedFirst } = fetchHistory({ query, now }), cache = new Map();
  const rows = line.map(node => toRow(node, node.file ? manifestAt(node.file.oid, { api, cache }) : { count: -1, digest: '' }));
  return judge(rows, { now, reachedFirst: complete, truncated: !reachedFirst, diagnosed, manifestCases });
}
if (require.main === module) {
  try {
    if (process.env.GITHUB_REPOSITORY && process.env.GITHUB_REPOSITORY !== REPO) throw Error('Restricted to the trusted repository');
    const result = check();
    console.log(report(result));
    if (!result.ok) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { fetchHistory, manifestAt, toRow, judge, report, check, readDiagnosed, FIRST_COMMIT, STALL_MS, OVERDUE_MS, FAILURE_RED_MS, VERDICT_MS, NOT_RUN_PREFIX };
