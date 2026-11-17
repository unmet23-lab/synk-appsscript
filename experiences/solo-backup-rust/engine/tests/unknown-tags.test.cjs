'use strict';
// 모르는 꼬리표의 판 (STAGE1_DESIGN.md 4.15 · T33): 나중 판의 엔진이 만든 판(공간 비우기 나 등급의 `cloud-only` 고정 판 따위)을 이 판의
// 엔진은 지우지도 고르지도 않는다. 가짜 restic이 그런 판을 가장 새 판으로 섞어 내놓는다.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { BackupEngine, APP, VERIFIED, knownTags } = require('../src/engine.cjs');

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'unknown-tags-'));
  for (const dir of ['repo', 'source', 'output']) await fs.mkdir(path.join(root, dir));
  const repositoryId = 'b'.repeat(64), vaultId = crypto.randomUUID(), calls = [];
  const now = Date.now(), vault = `vault:${vaultId}`, source = path.join(root, 'source');
  const snap = (c, ago, tags) => ({ id: c.repeat(64), time: new Date(now - ago).toISOString(), hostname: vaultId, paths: [source], tags: [APP, vault, ...tags] });
  const fake = { snapshots: [
    snap('f', -60000, [VERIFIED, 'cloud-only']),            // newest, made by a later engine
    snap('d', 0, [VERIFIED]), snap('e', 3 * 86400000, [VERIFIED]),
    snap('8', 5 * 86400000, [VERIFIED, 'cloud-only']),      // old, made by a later engine
    snap('7', 6 * 86400000, [VERIFIED]),
    snap('6', 7 * 86400000, [VERIFIED, 'pinned-by:future'])] };
  const runner = async (args, opts) => {
    calls.push(args);
    if (args[0] === 'cat' && args[1] === 'config') return JSON.stringify({ id: repositoryId });
    if (args[0] === 'snapshots') return JSON.stringify(fake.snapshots);
    if (args[0] === 'forget' || args[0] === 'prune') return '';
    if (args[0] === 'ls') {
      await opts.consumeStdout(Readable.from([Buffer.from([{ message_type: 'snapshot', id: args.at(-1).slice(0, 64) }, { message_type: 'node', path: '/a.txt', type: 'file', size: 1 }].map(x => JSON.stringify(x)).join('\n'))]));
      return '';
    }
    throw new Error(`unexpected ${args[0]}`);
  };
  const engine = new BackupEngine({ stateDir: path.join(root, 'state'), resticPath: 'unused', runner, now: () => now, secretStore: { encrypt: x => Buffer.from(x), decrypt: x => x.toString() } });
  await engine.open();
  engine.config = { schema: 1, mode: 'backup', vaultId, repositoryId, repository: path.join(root, 'repo'), sources: [source], automatic: true,
    lastBackup: { id: 'd'.repeat(64), at: new Date(now).toISOString() }, health: { status: 'ok', checkedAt: new Date(now).toISOString() }, recoverySaved: true };
  engine.secret = 'x'.repeat(43);
  return { root, engine, fake, calls, snap };
}

test('only the tags this engine writes are known', () => {
  const v = `vault:${crypto.randomUUID()}`, r = `run:${crypto.randomUUID()}`, fl = `fills:${crypto.randomUUID()}`;
  for (const tags of [[APP, v, VERIFIED], [APP, v, r, 'pending'], [APP, v, r, 'meta'], [APP, v, r, 'partial', VERIFIED], [APP, v, r, 'fill', fl], [APP, v, 'movekit'], [APP, v, 'recommended-verified-v1', VERIFIED]]) {
    assert.equal(knownTags({ tags }), true, tags.join(','));
  }
  for (const tags of [[APP, v, VERIFIED, 'cloud-only'], [APP, v, 'run:not-a-uuid'], [APP, 'vault:x'], [APP, v, 'Pending'], [APP, v, '']]) assert.equal(knownTags({ tags }), false, tags.join(','));
  assert.equal(knownTags({}), false);
});

test('a snapshot with a tag this engine does not know is neither listed, chosen nor forgotten', async t => {
  const f = await fixture();
  t.after(() => fs.rm(f.root, { recursive: true, force: true }));
  const { engine, calls } = f;
  // The engine's own list leaves them out, so every place that chooses from it does too.
  assert.deepEqual((await engine.snapshots()).map(s => s.id[0]), ['d', 'e', '7']);
  assert.equal((await engine.snapshots([VERIFIED], { host: engine.hostName }))[0].id, 'd'.repeat(64), 'the newest checked backup is the newest this engine knows');
  // 「파일 되살리기」 reads the newest known backup, not the later engine's.
  await engine.openFileCatalog();
  const ls = calls.filter(c => c[0] === 'ls').map(c => c.at(-1).slice(0, 1));
  assert.deepEqual([...new Set(ls)], ['d']);
  engine.discardCatalog();
  // Cleanup forgets old backups it knows, and never one it does not.
  calls.length = 0;
  await engine.retain();
  const forgot = calls.filter(c => c[0] === 'forget').flatMap(c => c.slice(1));
  for (const id of ['f', '8', '6']) assert.ok(!forgot.includes(id.repeat(64)), `${id} kept`);
  assert.ok(forgot.length > 0 && forgot.every(id => ['e', '7'].includes(id[0])), `only known old backups go: ${forgot.map(x => x[0])}`);
  // The same old backup without the unknown tag is forgotten like the others (the rule is the tag, not the age).
  f.fake.snapshots = f.fake.snapshots.map(s => s.id[0] === '8' ? f.snap('8', 5 * 86400000, [VERIFIED]) : s);
  calls.length = 0;
  await engine.retain();
  assert.ok(calls.filter(c => c[0] === 'forget').flatMap(c => c.slice(1)).includes('8'.repeat(64)));
});
