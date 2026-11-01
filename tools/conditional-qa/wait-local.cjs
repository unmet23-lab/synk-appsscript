'use strict';
const path = require('node:path');
const { readManifest } = require('./contract.cjs');
const { REPO, validCommit, status, accepted, publish } = require('./github.cjs');
async function wait({ commit, root, timeoutMs = 40 * 60_000, intervalMs = 30_000, read = status, write = publish }) {
  validCommit(commit);
  const manifest = readManifest(root), count = manifest.cases.filter(row => row.route === 'local').length;
  const start = Date.now(); let initialized = false;
  while (Date.now() - start < timeoutMs) {
    const current = read(commit);
    if (accepted(current, count, manifest.digest)) { console.log(`Local coverage complete: ${count}/${count} at ${commit}`); return; }
    if (current?.state === 'failure' || current?.state === 'error') throw Error(`Local QA has not passed: ${current.description}`);
    if (!current && !initialized) { write(commit, 'pending', `WAIT ${count} local tests manifest=${manifest.digest.slice(0, 16)}`); initialized = true; }
    console.log(`Local coverage pending for ${commit.slice(0, 12)} (${count} tests). Offline or unavailable is not a pass.`);
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw Error('Local verification did not finish; this workflow remains incomplete. The worker can resume this job after verification.');
}
if (require.main === module) {
  if (process.env.GITHUB_REPOSITORY !== REPO || process.env.GITHUB_REF !== 'refs/heads/master' || !['push', 'workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME)) throw Error('Local requests are restricted to the trusted master branch');
  wait({ commit: process.env.GITHUB_SHA, root: path.resolve(__dirname, '../..') }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { wait };
