'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { sha256 } = require('../tools/conditional-qa/contract.cjs');
const { runnerFor } = require('../tools/conditional-qa/legacy-profile.cjs');

test('only a recognized historical watchdog gets the reviewed deadline with the original tests and judge', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-historical-profile-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const target = path.join(root, 'tools/conditional-qa'), operator = path.join(root, 'operator');
  const original = path.join(target, 'run.cjs'), adapter = require.resolve('../tools/conditional-qa/legacy-profile.cjs');
  const data = {legacy: 'old\n', bounded: 'new\n', contract: 'judge\n', reporter: 'events\n'};
  const hashes = Object.fromEntries(Object.entries(data).map(([name, text]) => [name, sha256(text)]));
  for (const [folder, runner] of [[target, data.legacy], [operator, data.bounded]]) {
    fs.mkdirSync(folder, {recursive: true});
    fs.writeFileSync(path.join(folder, 'run.cjs'), runner);
    fs.writeFileSync(path.join(folder, 'contract.cjs'), data.contract);
  }
  fs.writeFileSync(path.join(target, 'reporter.cjs'), 'events\r\n');
  assert.equal(runnerFor(root, operator, hashes), adapter);
  assert.equal(runnerFor(root, operator), original);
  for (const file of [original, path.join(operator, 'run.cjs'), path.join(target, 'contract.cjs'), path.join(operator, 'contract.cjs'), path.join(target, 'reporter.cjs')]) {
    const before = fs.readFileSync(file);
    fs.appendFileSync(file, 'changed');
    assert.equal(runnerFor(root, operator, hashes), original);
    fs.writeFileSync(file, before);
  }
});
