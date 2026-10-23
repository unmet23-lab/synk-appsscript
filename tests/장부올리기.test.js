'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const { holdResult } = require('../tools/lib/ledger-publish-policy.cjs');
const ledger = require('../tools/lib/장부올리기.js');
const publish = require('../tools/바로올리기.js');
const operations = require('../tools/운영사본.js');

function repository(t) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-ledger-contract-'));
  const resolved = fs.realpathSync(folder);
  t.after(() => { assert.equal(fs.realpathSync(folder), resolved); fs.rmSync(resolved, { recursive: true, force: true }); });
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(folder, 'no-global'), GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'test@example.invalid', GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'test@example.invalid' };
  const git = (...args) => execFileSync('git', args, { cwd: folder, env, stdio: 'pipe' });
  git('init', '-q', '-b', 'master');
  return { folder, git };
}

test('initial publish and retry share off/deferred/test policy without accessing a repository', async () => {
  for (const [environment, expected] of [[{ SYNK_장부올리기: ' 끔 ' }, '건너뜀'], [{ SYNK_장부올리기: '나중' }, '미룸'], [{ NODE_TEST_CONTEXT: 'child-v8' }, '건너뜀']]) {
    assert.equal(holdResult(environment, false).결과, expected);
    assert.equal((await ledger.장부올리기(['missing'], 'fixture', { 환경: environment })).결과, expected);
  }
  assert.equal(holdResult({ NODE_TEST_CONTEXT: 'child-v8' }, true), null);
  assert.equal(holdResult({}, false), null);
});

test('common checkout sends only requested paths to the publish coordinator', async (t) => {
  const { folder } = repository(t); let seen;
  t.mock.method(publish, '올리기', async (options) => { seen = options; return { 결과: '올림', 머리: 'fixture' }; });
  const result = await ledger.장부올리기(['docs/fixture.jsonl'], 'fixture message', { 저장소: folder, 환경: {} });
  assert.equal(result.결과, '올림');
  assert.deepEqual(seen, { 저장소: folder, 경로들: ['docs/fixture.jsonl'], 메시지: 'fixture message', 실행: true });
});

test('failed operational publish preserves retry paths and never touches the shared checkout', async (t) => {
  const { folder, git } = repository(t);
  fs.writeFileSync(path.join(folder, 'seed.txt'), 'fixture'); git('add', 'seed.txt'); git('commit', '-qm', 'fixture');
  const worktree = path.join(folder, 'ops'); git('worktree', 'add', '-q', '--detach', worktree);
  t.mock.method(operations, '운영사본인가', () => true);
  let seen, receipt;
  t.mock.method(publish, '올리기', async (options) => { seen = options; throw Error('offline fixture'); });
  t.mock.method(operations, '남은장부적기', (paths, result) => { receipt = { paths, result }; });
  const result = await ledger.장부올리기(['docs/fixture.jsonl'], 'fixture message', { 저장소: worktree, 환경: {} });
  assert.equal(seen.공용안따라감, true);
  assert.deepEqual(result, { 결과: '실패', 이유: 'offline fixture' });
  assert.deepEqual(receipt, { paths: ['docs/fixture.jsonl'], result });
});
