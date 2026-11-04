'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const github = require('../tools/conditional-qa/github.cjs');
const { failureText, republishFailures } = require('../tools/conditional-qa/worker.cjs');
const localStatus = require('../tools/conditional-qa/local-status.cjs');
const { 실패읽기 } = require('../tools/ci빨간불.js');
const { readManifest } = require('../tools/conditional-qa/contract.cjs');

const root = path.resolve(__dirname, '..');
const manifest = readManifest(root), manifestCases = new Map(manifest.cases.map(row => [row.id, row]));
const INCOMPLETE = 'Local verification incomplete; inspect the private worker receipt';
const NOW = Date.parse('2026-11-05T00:00:00Z'), createdAt = '2026-11-04T23:00:00Z';
const sha = letter => letter.repeat(40);
const row = (letter, state, description) => ({ commit: sha(letter), committedAt: '2026-11-04T22:00:00Z', manifest: { count: 79, digest: 'x' }, status: state ? { state, description, createdAt } : null });
const receipt = (t, values) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-qa-diagnosed-')); t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  fs.writeFileSync(path.join(folder, 'result.json'), JSON.stringify(values)); return folder;
};
const failedReceipt = { expected: 3, passed: 2, sourceUnchanged: true, inputsUnchanged: true, rows: [{ id: 'S001', status: 'pass' }, { id: 'S070', status: 'fail' }, { id: 'S002', status: 'pass' }] };
const range = { cases: ['S070'], from: sha('c'), fixedBy: sha('a'), cause: 'the test waits for a card the app replaced' };

test('the public failure line names case ids, fits a status and never reads as a pass', () => {
  assert.equal(github.failureDescription(78, 79, ['S070']), 'FAIL 78/79: S070');
  assert.deepEqual(github.failedCases('FAIL 76/79: S001 S087 S098'), { ids: ['S001', 'S087', 'S098'], complete: true });
  assert.equal(github.failedCases(INCOMPLETE), null);
  assert.equal(github.accepted({ state: 'failure', description: 'FAIL 78/79: S070' }, 79, 'x'.repeat(16)), false);
  const many = Array.from({ length: 79 }, (_, index) => `S${String(index + 1).padStart(3, '0')}`), long = github.failureDescription(0, 79, many);
  assert.ok(long.length <= 140); assert.doesNotThrow(() => github.publish(sha('a'), 'failure', long, () => ({})));
  const read = github.failedCases(long);
  assert.equal(read.complete, false, 'a shortened list says so'); assert.deepEqual(read.ids, many.slice(0, read.ids.length));
});

test('the worker names cases only when the tests themselves failed on unchanged source and inputs', t => {
  assert.equal(failureText(receipt(t, failedReceipt)), 'FAIL 2/3: S070');
  for (const changed of [{ sourceUnchanged: false }, { inputsUnchanged: false }, { rows: failedReceipt.rows.slice(0, 2) }, { rows: failedReceipt.rows.map(item => ({ ...item, status: 'pass' })) }, { rows: [{ id: '../private', status: 'fail' }, ...failedReceipt.rows.slice(1)] }])
    assert.equal(failureText(receipt(t, { ...failedReceipt, ...changed })), INCOMPLETE, JSON.stringify(changed));
  assert.equal(failureText(path.join(os.tmpdir(), 'synk-qa-no-such-receipt')), INCOMPLETE);
  assert.equal(failureText(undefined), INCOMPLETE);
});

test('a failure published late carries the same case names', t => {
  const output = receipt(t, failedReceipt), sent = [], queue = { items: [{ commit: sha('a'), status: 'failed', publicationError: true, output }, { commit: sha('b'), status: 'failed', publicationError: true }] };
  republishFailures(queue, (commit, state, text) => sent.push([commit, state, text]));
  assert.deepEqual(sent, [[sha('a'), 'failure', 'FAIL 2/3: S070'], [sha('b'), 'failure', INCOMPLETE]]);
});

test('an undiagnosed failure alerts with its test, file and receipt', () => {
  const result = localStatus.judge([row('a', 'failure', 'FAIL 78/79: S070')], { now: NOW, manifestCases });
  assert.equal(result.ok, false);
  const text = localStatus.report(result), log = text.split('\n').map(line => `status\tread\t2026-11-05T00:00:00.0000000Z ${line}`).join('\n'), read = 실패읽기(log);
  assert.equal(read.시험.length, 1);
  assert.equal(read.시험[0].위치, 'experiences/synk-world-app/qa/account-browser.test.mjs');
  assert.match(read.시험[0].이름, /^local verification failed at a{40}: S070 actual Chromium/);
  assert.match(read.시험[0].안내[0], /SYNK-conditional-qa\/runs\/a{40}-\*\/result\.json/);
});

test('a plain line still alerts in the old form', () => {
  const result = localStatus.judge([row('a', 'failure', INCOMPLETE)], { now: NOW, manifestCases });
  assert.deepEqual(result.problems, [`local verification failed at ${sha('a')}`]);
});

test('the ledger stops the alert only for its cases inside its range, and the failure stays listed', () => {
  const line = [row('a', 'success', 'x'), row('b', 'failure', 'FAIL 78/79: S070'), row('c', 'failure', 'FAIL 78/79: S070'), row('d', 'failure', 'FAIL 78/79: S070')];
  // Newest first: a is the fix, b and c hold the bad test, d is older than the range.
  const result = localStatus.judge(line, { now: NOW, diagnosed: [range], manifestCases });
  assert.deepEqual(result.explained.map(item => item.commit), [sha('b'), sha('c')]);
  assert.deepEqual(result.problems.filter(text => text.includes('verification failed')), [`local verification failed at ${sha('d')}: S070 ${manifestCases.get('S070').name}`]);
  assert.deepEqual(result.failed, [sha('b'), sha('c'), sha('d')], 'still a failure on the commit');
  const text = localStatus.report(result);
  assert.match(text, new RegExp(`failed, kept until a retry passes: ${sha('b')} S070`));
  assert.match(text, new RegExp(`diagnosed, no alert: ${sha('b')} S070 — the test waits for a card the app replaced \\(fixed by a{12}\\)`));
  assert.equal(result.passed, 0, 'never counted as passed');
});

test('a second failed case, a partial list or a plain line is not explained by a range', () => {
  const line = description => [row('a', 'success', 'x'), row('b', 'failure', description), row('c', null)];
  for (const description of ['FAIL 77/79: S070 S072', 'FAIL 0/79: S070 +40', INCOMPLETE]) {
    const result = localStatus.judge(line(description), { now: NOW, diagnosed: [range], manifestCases });
    assert.deepEqual(result.explained, [], description); assert.match(result.problems.join(), /local verification failed at b{40}/, description);
  }
  assert.ok(localStatus.judge(line('FAIL 78/79: S070'), { now: NOW, diagnosed: [range], manifestCases }).explained.length);
});

test('a range that is not on the master line turns red instead of hiding anything', () => {
  const result = localStatus.judge([row('a', 'success', 'x'), row('b', 'failure', 'FAIL 78/79: S070')], { now: NOW, diagnosed: [range], manifestCases });
  assert.match(result.problems.join('\n'), /diagnosed range c{40} to a{40} is not on the master line/);
  assert.match(result.problems.join('\n'), /local verification failed at b{40}: S070/);
  const reversed = { ...range, from: sha('a'), fixedBy: sha('c') };
  assert.match(localStatus.judge([row('a', 'success', 'x'), row('c', 'failure', 'FAIL 78/79: S070')], { now: NOW, diagnosed: [reversed], manifestCases }).problems.join(), /not on the master line/);
});

test('the ledger on master is well formed and every entry names a local case', t => {
  const ranges = localStatus.readDiagnosed();
  assert.ok(ranges.length >= 1);
  for (const item of ranges) { assert.notEqual(item.from, item.fixedBy); for (const id of item.cases) assert.equal(manifestCases.get(id).route, 'local'); }
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-qa-diagnosed-')), file = path.join(folder, 'bad.json');
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const bad = change => { fs.writeFileSync(file, JSON.stringify({ version: 1, ranges: [{ ...range, ...change }] })); return () => localStatus.readDiagnosed(file, manifest); };
  assert.doesNotThrow(bad({}));
  for (const change of [{ cases: [] }, { cases: ['S999'] }, { cases: [manifest.cases.find(item => item.route !== 'local').id] }, { from: 'abc' }, { fixedBy: range.from }, { cause: ' ' }]) assert.throws(bad(change), /Invalid diagnosed range/, JSON.stringify(change));
});
