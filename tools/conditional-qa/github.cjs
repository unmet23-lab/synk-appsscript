'use strict';
const cp = require('node:child_process');
const { CONTEXT } = require('./contract.cjs');
const REPO = 'unmet23-lab/synk-appsscript';
function validCommit(commit) { if (!/^[a-f0-9]{40}$/.test(commit || '')) throw Error('A full commit SHA is required'); return commit; }
function request(endpoint, body) {
  const args = ['api', endpoint, '-H', 'Accept: application/vnd.github+json'];
  if (body) args.push('--method', 'POST', '--input', '-');
  const response = cp.execFileSync('gh', args, { input: body ? JSON.stringify(body) : undefined, encoding: 'utf8', windowsHide: true, timeout: 60_000, maxBuffer: 16 << 20 });
  return response.trim() ? JSON.parse(response) : null;
}
function graphql(query, variables = {}) {
  const args = ['api', 'graphql', '-f', `query=${query}`];
  for (const [name, value] of Object.entries(variables)) args.push('-f', `${name}=${value}`);
  try { return JSON.parse(cp.execFileSync('gh', args, { encoding: 'utf8', windowsHide: true, timeout: 60_000, maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'] })); }
  catch (error) {
    // A commit older than the requested file makes gh exit non-zero while the page itself is complete.
    let partial = null; try { partial = JSON.parse(error.stdout); } catch {}
    if (partial?.data && partial.errors?.every(row => /Could not resolve file/.test(row.message))) return partial;
    throw Error(`GitHub query failed: ${String(error.stderr || error.message).slice(0, 300)}`);
  }
}
function status(commit, api = request) {
  validCommit(commit);
  const response = api(`repos/${REPO}/commits/${commit}/status?per_page=100`);
  if (response.sha !== commit || !Array.isArray(response.statuses)) throw Error('Status response is not bound to the requested commit');
  return response.statuses.find(row => row.context === CONTEXT) || null;
}
const description = (count, digest) => `PASS ${count}/${count} manifest=${digest.slice(0, 16)}`;
function accepted(value, count, digest) { return value?.state === 'success' && value.description === description(count, digest); }
function publish(commit, state, text, api = request) {
  validCommit(commit);
  if (!['pending', 'failure', 'error', 'success'].includes(state) || text.length > 140) throw Error('Invalid public check summary');
  return api(`repos/${REPO}/statuses/${commit}`, { state, context: CONTEXT, description: text,
    target_url: `https://github.com/${REPO}/commit/${commit}/checks` });
}
function cancelRun(runId, api = request) { return api(`repos/${REPO}/actions/runs/${runId}/cancel`, {}); }
const listRuns = commit => JSON.parse(cp.execFileSync('gh', ['run', 'list', '--repo', REPO, '--workflow', 'conditional-qa.yml', '--commit', validCommit(commit), '--limit', '10', '--json', 'databaseId,status,conclusion,attempt,createdAt'], { encoding: 'utf8', windowsHide: true, timeout: 60_000 }));
// A commit normally takes two attempts: the one that waited and the one after its local result. This stops a re-run that keeps ending the same way.
const MAX_ATTEMPTS = 6;
// GitHub refuses to re-run a run more than a month after it started, and that refusal never clears.
const RERUN_WINDOW_MS = 30 * 24 * 60 * 60_000;
// local-coverage cancels its own run while the PC verifies, so a waiting run ends as cancelled; an old run that timed out ends as failure.
// A run cancelled by hand can also hold hosted jobs that never ran. This commit's receipt needs them, so they run again with it.
// A job that really failed stays red, and a failed local result only has to wake a run that is still waiting.
// A commit without a run has nothing to wake: a push of several commits runs only the last, and a run created later reads the published result itself.
function resumeWaitingWorkflow(commit, { localPassed = true, api = request, list = listRuns, now = Date.now() } = {}) {
  const runs = list(commit);
  let settled = runs.every(row => row.status === 'completed');
  const wake = runs.filter(row => row.status === 'completed' && !(row.attempt >= MAX_ATTEMPTS) && !(now - Date.parse(row.createdAt) > RERUN_WINDOW_MS) && (row.conclusion === 'cancelled' || (localPassed && row.conclusion === 'failure')));
  for (const run of wake) {
    const jobs = api(`repos/${REPO}/actions/runs/${run.databaseId}/jobs?per_page=100`).jobs;
    const failed = jobs.filter(row => row.conclusion === 'failure' || row.conclusion === 'timed_out');
    if (failed.some(row => row.name !== 'local-coverage') || !(failed.length || jobs.some(row => row.conclusion === 'cancelled'))) continue;
    api(`repos/${REPO}/actions/runs/${run.databaseId}/rerun-failed-jobs`, {}); settled = false;
  }
  return settled;
}
// The newest cancelled runs by commit. A run can be cancelled after its commit's item settled, and a worker before this change took a cancelled run as settled.
function cancelledRuns(api = request, pages = 3) {
  const found = new Map();
  for (let page = 1; page <= pages; page++) {
    const runs = api(`repos/${REPO}/actions/workflows/conditional-qa.yml/runs?branch=master&status=cancelled&per_page=100&page=${page}`).workflow_runs;
    for (const run of runs) if (!found.has(run.head_sha)) found.set(run.head_sha, `${run.id}:${run.run_attempt}`);
    if (runs.length < 100) break;
  }
  return found;
}
module.exports = { REPO, validCommit, request, graphql, status, description, accepted, publish, cancelRun, resumeWaitingWorkflow, cancelledRuns };
