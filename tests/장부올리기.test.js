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

test('common checkout never enters the operations retry list', async (t) => {
  const { folder } = repository(t);
  t.mock.method(publish, '올리기', async () => ({ 결과: '올림', 머리: 'fixture' }));
  const noted = t.mock.method(operations, '남은장부적기', () => {});
  await ledger.장부올리기(['docs/fixture.jsonl'], 'fixture message', { 저장소: folder, 환경: {} });
  assert.equal(noted.mock.callCount(), 0);
});

test('an operational publish that dies midway leaves its paths for the next refresh', async (t) => {
  const { folder, git } = repository(t);
  fs.writeFileSync(path.join(folder, 'seed.txt'), 'fixture'); git('add', 'seed.txt'); git('commit', '-qm', 'fixture');
  const worktree = path.join(folder, 'ops'); git('worktree', 'add', '-q', '--detach', worktree);
  const state = path.join(folder, 'ops-state');
  const before = process.env.SYNK_운영사본_상태;
  process.env.SYNK_운영사본_상태 = state;
  t.after(() => { if (before === undefined) delete process.env.SYNK_운영사본_상태; else process.env.SYNK_운영사본_상태 = before; });
  t.mock.method(operations, '운영사본인가', () => true);
  // 올리기 안에서 프로세스가 끝나면 그 시점의 목록이 그대로 남는다. 그 목록을 다음 갱신이 올리는 것은 tests/운영사본.test.js가 본다.
  const records = ['docs/_ops/fixture.jsonl', 'docs/마케팅/편/게시/new.json'];
  assert.ok(records.every(operations.기록자리인가), '갱신이 다시 올리는 자리');
  let midway;
  t.mock.method(publish, '올리기', async () => { midway = operations.남은장부읽기(state); return { 결과: '올림', 머리: 'fixture' }; });
  await ledger.장부올리기(records, 'fixture message', { 저장소: worktree, 환경: {} });
  assert.deepEqual(Object.keys(midway).sort(), [...records].sort());
  assert.match(midway[records[1]].이유, /올리는 중/);
  assert.deepEqual(operations.남은장부읽기(state), {}, '올렸으면 지운다');
  // 올리는 동안 다른 도구가 같은 기록을 다시 적었으면 목록에 남긴다
  publish.올리기.mock.mockImplementation(async () => {
    operations.남은장부적기([records[0]], { 결과: '멈춤', 이유: '진행 중' }, state);
    return { 결과: '올림', 머리: 'fixture' };
  });
  await ledger.장부올리기(records, 'fixture message', { 저장소: worktree, 환경: {} });
  assert.deepEqual(Object.entries(operations.남은장부읽기(state)).map(([p, x]) => [p, x.이유]), [[records[0], '진행 중']]);
  // 먼저 적지 못했으면 다른 도구의 항목을 지우지 않는다
  publish.올리기.mock.mockImplementation(async () => ({ 결과: '올림', 머리: 'fixture' }));
  t.mock.method(operations, '남은장부적기', operations.남은장부적기).mock.mockImplementationOnce(() => { throw new Error('디스크'); });
  await ledger.장부올리기(records, 'fixture message', { 저장소: worktree, 환경: {} });
  assert.deepEqual(Object.keys(operations.남은장부읽기(state)), [records[0]]);
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
