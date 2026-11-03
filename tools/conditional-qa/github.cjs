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
const listRuns = commit => JSON.parse(cp.execFileSync('gh', ['run', 'list', '--repo', REPO, '--workflow', 'conditional-qa.yml', '--commit', validCommit(commit), '--limit', '10', '--json', 'databaseId,status,conclusion'], { encoding: 'utf8', windowsHide: true, timeout: 60_000 }));
// local-coverage cancels its own run while the PC verifies, so a waiting run ends as cancelled; an old run that timed out ends as failure.
// Only a run whose single unfinished job is local-coverage is re-run, so a cancelled hosted job is never mistaken for a waiting one.
function resumeWaitingWorkflow(commit, api = request, list = listRuns) {
  const runs = list(commit);
  let settled = runs.length > 0 && runs.every(row => row.status === 'completed');
  for (const run of runs.filter(row => row.status === 'completed' && (row.conclusion === 'failure' || row.conclusion === 'cancelled'))) {
    const jobs = api(`repos/${REPO}/actions/runs/${run.databaseId}/jobs?per_page=100`).jobs;
    const failures = jobs.filter(row => row.conclusion === 'failure' || row.conclusion === 'timed_out' || row.conclusion === 'cancelled');
    if (failures.length === 1 && failures[0].name === 'local-coverage') { api(`repos/${REPO}/actions/runs/${run.databaseId}/rerun-failed-jobs`, {}); settled = false; }
  }
  return settled;
}
module.exports = { REPO, validCommit, request, status, description, accepted, publish, cancelRun, resumeWaitingWorkflow };
