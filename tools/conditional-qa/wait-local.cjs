'use strict';
const path = require('node:path');
const { readManifest } = require('./contract.cjs');
const { REPO, validCommit, status, accepted, publish, cancelRun } = require('./github.cjs');
// Reads the local result once and never holds a hosted runner while the PC verifies. Polling here for up to
// 155 minutes filled the account's concurrent job limit at 100+ pushes a day, and Pages deploys starved behind it (2026-11-04).
// Pending never means pass: this run cancels itself, so it stays not-passed and is not counted as red,
// and the worker re-runs this job once the commit has a local result (github.cjs resumeWaitingWorkflow).
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
// One GitHub HTTP 500 turned a waiting run red (2026-11-04). A lasting error still fails the job, and that is never a pass.
// GitHub stopped this step 84 s after the cancel request, and a job that outlasts the grace ends red, so the grace leaves room. Waiting it out costs nothing once the cancel lands.
async function persist(call, pauseMs) {
  for (let attempt = 1; ; attempt++) {
    try { return call(); }
    catch (error) { if (attempt >= 3) throw error; await pause(pauseMs); }
  }
}
async function wait({ commit, root, runId, read = status, write = publish, cancel = cancelRun, cancelGraceMs = 300_000, retryPauseMs = 10_000 }) {
  validCommit(commit);
  const manifest = readManifest(root), count = manifest.cases.filter(row => row.route === 'local').length;
  const current = await persist(() => read(commit), retryPauseMs);
  if (accepted(current, count, manifest.digest)) { console.log(`Local coverage complete: ${count}/${count} at ${commit}`); return; }
  if (current?.state === 'failure' || current?.state === 'error') throw Error(`Local QA has not passed: ${current.description}`);
  if (current?.state === 'success') throw Error(`Local status does not match this commit's manifest: ${current.description}`);
  if (!current) await persist(() => write(commit, 'pending', `WAIT ${count} local tests manifest=${manifest.digest.slice(0, 16)}`), retryPauseMs);
  console.log(`Local coverage pending for ${commit.slice(0, 12)} (${count} tests). Offline or unavailable is not a pass. Cancelling this run to free the runner; the worker re-runs it after verification.`);
  if (!/^[0-9]+$/.test(String(runId || ''))) throw Error('Local verification did not finish and this run cannot cancel itself without a run id.');
  await persist(() => cancel(runId), retryPauseMs);
  await pause(cancelGraceMs);
  throw Error('Local verification did not finish and the cancel request did not take effect; this workflow remains incomplete.');
}
if (require.main === module) {
  if (process.env.GITHUB_REPOSITORY !== REPO || process.env.GITHUB_REF !== 'refs/heads/master' || !['push', 'workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME)) throw Error('Local requests are restricted to the trusted master branch');
  wait({ commit: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID, root: path.resolve(__dirname, '../..') }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { wait };
