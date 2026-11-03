'use strict';
const { CONTEXT, sha256 } = require('./contract.cjs');
const { REPO, request, accepted, graphql } = require('./github.cjs');
// local-coverage cancels its own run while the PC verifies, and a cancelled run is never counted as red. So a stopped PC or
// a failure on an older commit would make no signal at all. This reads every queued commit's status; it never runs a test or writes a pass.
const FIRST_COMMIT = 'df9ec0dff34be52fc0fabff03381a0a2e59e639f'; // The worker's activation point; older commits were never queued.
const MAX_COMMITS = 1000, PAGE = 50, READ_ATTEMPTS = 3; // A page of 100 with statuses drew an HTTP 502 (2026-11-04).
const STALL_MS = 155 * 60_000; // Current verification, one backlog turn, one newest turn (each <=50 min), and a scheduler interval.
const OVERDUE_MS = 72 * 3600_000; // The backlog may not outlast this: half the worker's turns go to the oldest commit.
const FAILURE_RED_MS = 24 * 3600_000; // A failure stays listed until retried; red only while new, so a later failure is not buried.
const WAITING_PREFIX = 'WAIT '; // Written by local-coverage, not by the worker.
const HISTORY = `query($owner:String!,$name:String!,$after:String){repository(owner:$owner,name:$name){object(expression:"master"){... on Commit{history(first:${PAGE},after:$after){pageInfo{hasNextPage endCursor}
  nodes{oid committedDate parents(first:1){nodes{oid}} file(path:"tools/conditional-qa/cases.json"){oid} status{contexts{context state description createdAt}}}}}}}}`;

const waitBriefly = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function readPage(query, variables, pause) {
  for (let attempt = 1; ; attempt++) {
    try { return query(HISTORY, variables); }
    catch (error) { if (attempt >= READ_ATTEMPTS) throw error; pause(attempt * 10_000); }
  }
}
function fetchHistory({ query = graphql, first = FIRST_COMMIT, limit = MAX_COMMITS, pause = waitBriefly } = {}) {
  const [owner, name] = REPO.split('/'), byOid = new Map(); let head, reachedFirst = false;
  for (let after = null, more = true; more && byOid.size < limit && !byOid.has(first);) {
    const history = readPage(query, { owner, name, ...(after ? { after } : {}) }, pause).data?.repository?.object?.history;
    if (!history) throw Error('The master history could not be read');
    for (const node of history.nodes) { head ||= node.oid; byOid.set(node.oid, node); }
    more = history.pageInfo.hasNextPage; after = history.pageInfo.endCursor;
  }
  // Follow first parents, the same line the worker queues; a merged side branch is verified through its merge.
  const line = [];
  for (let node = byOid.get(head); node && line.length < limit; node = byOid.get(node.parents.nodes[0]?.oid)) {
    line.push(node);
    if (node.oid === first) { reachedFirst = true; break; }
  }
  return { line, reachedFirst };
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
  return { commit: node.oid, committedAt: node.committedDate, manifest, status: found ? { state: found.state.toLowerCase(), description: found.description || '', createdAt: found.createdAt } : null };
}
// Every state other than an exact PASS of that commit's own manifest stays unfinished. Pending, absent or offline never passes.
function judge(rows, { now = Date.now(), reachedFirst = true } = {}) {
  const passed = [], waiting = [], failed = [], invalid = []; let activityAt = 0;
  for (const row of rows) {
    const { status: value, manifest } = row;
    if (value && !value.description.startsWith(WAITING_PREFIX)) activityAt = Math.max(activityAt, Date.parse(value.createdAt));
    if (accepted(value, manifest.count, manifest.digest)) passed.push(row);
    else if (value?.state === 'failure' || value?.state === 'error') failed.push(row);
    else if (value?.state === 'success') invalid.push(row);
    else waiting.push(row);
  }
  const oldest = waiting.at(-1), problems = [];
  for (const row of failed) if (now - Date.parse(row.status.createdAt) < FAILURE_RED_MS) problems.push(`local verification failed at ${row.commit}`);
  for (const row of invalid) problems.push(`local success does not match the manifest of ${row.commit}`);
  if (waiting.length && now - activityAt > STALL_MS) problems.push('local worker published no new result within the limit');
  if (oldest && now - Date.parse(oldest.committedAt) > OVERDUE_MS) problems.push('local backlog is older than the limit');
  if (!reachedFirst) problems.push('the status window ended before the first queued commit');
  return { ok: problems.length === 0, problems, passed: passed.length, waiting: waiting.length, failed: failed.map(row => row.commit), invalid: invalid.length, oldest: oldest?.commit || null, oldestAt: oldest?.committedAt || null, activityAt: activityAt ? new Date(activityAt).toISOString() : null };
}
// TAP lines: tools/ci빨간불.js names each problem from them, so only a new failure sends a new alert.
function report(result) {
  const lines = [`local statuses: ${result.passed} passed, ${result.waiting} waiting, ${result.failed.length} failed`, `newest worker result: ${result.activityAt || 'none'}`];
  if (result.oldest) lines.push(`oldest waiting: ${result.oldest} committed ${result.oldestAt}`);
  for (const commit of result.failed) lines.push(`failed, kept until a retry passes: ${commit}`);
  result.problems.forEach((problem, index) => lines.push(`not ok ${index + 1} - ${problem}`));
  if (result.ok) lines.push('Unfinished commits stay pending until the worker verifies them; this check does not pass them.');
  return lines.join('\n');
}
function check({ now = Date.now(), query = graphql, api = request } = {}) {
  const { line, reachedFirst } = fetchHistory({ query }), cache = new Map();
  const rows = line.map(node => toRow(node, node.file ? manifestAt(node.file.oid, { api, cache }) : { count: -1, digest: '' }));
  return judge(rows, { now, reachedFirst });
}
if (require.main === module) {
  try {
    if (process.env.GITHUB_REPOSITORY && process.env.GITHUB_REPOSITORY !== REPO) throw Error('Restricted to the trusted repository');
    const result = check();
    console.log(report(result));
    if (!result.ok) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { fetchHistory, manifestAt, toRow, judge, report, check, FIRST_COMMIT, STALL_MS, OVERDUE_MS, FAILURE_RED_MS };
