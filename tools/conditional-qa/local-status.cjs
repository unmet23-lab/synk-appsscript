'use strict';
const fs = require('node:fs'), path = require('node:path');
const { CONTEXT, sha256, readManifest } = require('./contract.cjs');
const { REPO, request, accepted, failedCases, graphql } = require('./github.cjs');
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
// A commit's own tests are frozen with it, so a test that was wrong for a stretch of commits fails on every one of them and a retry cannot pass.
// diagnosed.json lists those stretches once someone has found the cause. It only stops the alert: the commit keeps its failure and is never counted as passed.
function readDiagnosed(file = path.join(__dirname, 'diagnosed.json'), manifest = readManifest(path.resolve(__dirname, '../..'))) {
  const ledger = JSON.parse(fs.readFileSync(file, 'utf8')), local = new Set(manifest.cases.filter(row => row.route === 'local').map(row => row.id));
  if (ledger.version !== 1 || !Array.isArray(ledger.ranges)) throw Error('Invalid diagnosed ledger');
  for (const range of ledger.ranges) {
    const commits = [range.from, range.fixedBy];
    if (!commits.every(commit => /^[0-9a-f]{40}$/.test(commit)) || range.from === range.fixedBy || !Array.isArray(range.cases) || !range.cases.length || !range.cases.every(id => local.has(id)) || typeof range.cause !== 'string' || !range.cause.trim()) throw Error(`Invalid diagnosed range: ${JSON.stringify(range).slice(0, 200)}`);
  }
  return ledger.ranges;
}
// Newest first: a range holds from `from` up to, but not including, the commit that stopped the failure.
function placeRanges(rows, diagnosed) {
  const position = new Map(rows.map((row, index) => [row.commit, index])), spans = [], broken = [];
  for (const range of diagnosed) {
    const newest = position.get(range.fixedBy), oldest = position.get(range.from);
    if (newest === undefined || oldest === undefined || newest >= oldest) broken.push(range); else spans.push({ ...range, newest, oldest });
  }
  return { position, spans, broken };
}
// A failed case outside its range, a plain line or a partial list stays an alert.
function explain(row, { position, spans }) {
  const named = failedCases(row.status.description), at = position.get(row.commit);
  if (!named?.complete) return null;
  const covering = named.ids.map(id => spans.find(span => span.cases.includes(id) && at > span.newest && at <= span.oldest));
  return covering.every(Boolean) ? { cases: named.ids, ranges: [...new Set(covering)] } : null;
}
function failureLine(row, manifestCases) {
  const named = failedCases(row.status.description), text = `local verification failed at ${row.commit}`;
  if (!named) return { text };
  const first = manifestCases.get(named.ids[0]), label = named.ids.length === 1 && named.complete && first ? `${named.ids[0]} ${first.name}` : `${named.ids.join(' ')}${named.complete ? '' : ' and more'}`;
  return { text: `${text}: ${label}`, location: first?.file, cases: named.ids };
}
// Every state other than an exact PASS of that commit's own manifest stays unfinished. Pending, absent or offline never passes.
function judge(rows, { now = Date.now(), reachedFirst = true, diagnosed = [], manifestCases = new Map() } = {}) {
  const passed = [], waiting = [], failed = [], invalid = [], explained = [], details = new Map(); let activityAt = 0;
  for (const row of rows) {
    const { status: value, manifest } = row;
    if (value && !value.description.startsWith(WAITING_PREFIX)) activityAt = Math.max(activityAt, Date.parse(value.createdAt));
    if (accepted(value, manifest.count, manifest.digest)) passed.push(row);
    else if (value?.state === 'failure' || value?.state === 'error') failed.push(row);
    else if (value?.state === 'success') invalid.push(row);
    else waiting.push(row);
  }
  const oldest = waiting.at(-1), problems = [], placed = placeRanges(rows, diagnosed);
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
  if (!reachedFirst) problems.push('the status window ended before the first queued commit');
  return { ok: problems.length === 0, problems, details, explained, failedCases: new Map(failed.map(row => [row.commit, failedCases(row.status.description)?.ids || []])), passed: passed.length, waiting: waiting.length, failed: failed.map(row => row.commit), invalid: invalid.length, oldest: oldest?.commit || null, oldestAt: oldest?.committedAt || null, activityAt: activityAt ? new Date(activityAt).toISOString() : null };
}
// TAP lines: tools/ci빨간불.js names each problem from them, so only a new failure sends a new alert.
function report(result) {
  const lines = [`local statuses: ${result.passed} passed, ${result.waiting} waiting, ${result.failed.length} failed`, `newest worker result: ${result.activityAt || 'none'}`];
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
  const { line, reachedFirst } = fetchHistory({ query }), cache = new Map();
  const rows = line.map(node => toRow(node, node.file ? manifestAt(node.file.oid, { api, cache }) : { count: -1, digest: '' }));
  return judge(rows, { now, reachedFirst, diagnosed, manifestCases });
}
if (require.main === module) {
  try {
    if (process.env.GITHUB_REPOSITORY && process.env.GITHUB_REPOSITORY !== REPO) throw Error('Restricted to the trusted repository');
    const result = check();
    console.log(report(result));
    if (!result.ok) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { fetchHistory, manifestAt, toRow, judge, report, check, readDiagnosed, FIRST_COMMIT, STALL_MS, OVERDUE_MS, FAILURE_RED_MS };
