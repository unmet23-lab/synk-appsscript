'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const { createProvider, credentialMode } = require('../tools/synk-id/provision-apply.cjs');
// Load the actual existing guard without executing its credential-file reader.
const moduleFixture = { exports: {} }, talkRoot = process.env.SYNK_TALK_ROOT || path.resolve(__dirname, '../../SYNK-talk');
vm.runInNewContext(fs.readFileSync(path.join(talkRoot, 'lib/자격증명.js'), 'utf8'), { module: moduleFixture, exports: moduleFixture.exports, require, __dirname: path.join(talkRoot, 'lib'), process, console });
const guard = moduleFixture.exports;

test('credential guard modes match actual production and rehearsal read/write behavior', () => {
  for (const environment of ['production', 'rehearsal']) for (const apply of [false, true]) {
    const options = credentialMode({ environment, apply }), ref = environment === 'production' ? guard.운영REF : guard.리허설REF;
    assert.equal(options.읽기, !apply);
    assert.equal(options.args.includes('--운영'), environment === 'production' && apply);
    assert.equal(options.args.includes('--apply'), apply);
    const actual = guard.과녁판정({ SUPABASE_PROJECT_REF: ref }, options.args, options);
    assert.equal(actual.상태, environment === 'production' && !apply ? '읽기통과' : '통과');
  }
  assert.equal(guard.과녁판정({ SUPABASE_PROJECT_REF: guard.운영REF }, [], { 읽기: false }).상태, '막음');
  assert.throws(() => credentialMode({ environment: 'unknown', apply: true }));
});

test('provider passes actual mode to the shared guard and read-only instances reject mutations before any network call', async () => {
  const original = process.env.SUPABASE_PROJECT_REF;
  try {
    for (const environment of ['production', 'rehearsal']) for (const apply of [false, true]) {
      const calls = [], observed = [];
      const credentials = { 운영REF: guard.운영REF, 리허설REF: guard.리허설REF, 읽기: (_name, options) => { observed.push(options); return { SUPABASE_PROJECT_REF: process.env.SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN: 'fixture-only' }; } };
      const provider = await createProvider({ environment, apply }, { credentials, management: async (ref, suffix, init) => { calls.push({ ref, suffix, method: init?.method || 'GET' }); return new Response(JSON.stringify(suffix.startsWith('/api-keys') ? [{ type: 'secret', api_key: 'fixture-admin-only' }] : [])); }, fetcher: async (_url, init) => { calls.push({ method: init.method }); return new Response('{}'); } });
      assert.deepEqual(observed, [credentialMode({ environment, apply })]);
      if (apply) { await provider.createClient({}); await provider.writeMapping({}); assert.equal(calls.filter(call => call.method === 'POST').length, 2); }
      else { await assert.rejects(provider.createClient({}), /읽기 전용/); await assert.rejects(provider.writeMapping({}), /읽기 전용/); assert.equal(calls.length, 0); }
    }
    const credentials = { 운영REF: guard.운영REF, 리허설REF: guard.리허설REF, 읽기: () => ({ SUPABASE_PROJECT_REF: 'wrong-target', SUPABASE_ACCESS_TOKEN: 'fixture' }) };
    await assert.rejects(createProvider({ environment: 'production', apply: true }, { credentials }), /실제 요청 대상/);
  } finally { if (original === undefined) delete process.env.SUPABASE_PROJECT_REF; else process.env.SUPABASE_PROJECT_REF = original; }
});

test('provider uses the guard-returned environment token and verifies existing Fortune allowlist without changing it', async () => {
  const original = process.env.SUPABASE_PROJECT_REF;
  try {
    const calls = [], ids = ['z-native-existing', 'a-web-existing'], { digest } = require('../tools/synk-id/provision-plan.cjs');
    const credentials = { 운영REF: guard.운영REF, 리허설REF: guard.리허설REF, 읽기: () => ({ SUPABASE_PROJECT_REF: process.env.SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN: 'guard-environment-fixture' }) };
    const provider = await createProvider({ environment: 'production' }, { credentials, fetcher: async (url, init) => {
      calls.push({ url, authorization: init.headers.Authorization, method: init.method });
      return new Response(JSON.stringify([{ name: 'SYNK_FORTUNE_CLIENT_IDS', value: digest([...ids].sort()) }]));
    } });
    await provider.verifyFortuneBindings({ 'fortune-native': ids[0], 'fortune-browser': ids[1] });
    assert.equal(calls[0].authorization, 'Bearer guard-environment-fixture'); assert.equal(calls[0].method, undefined);
    await provider.verifyFortuneBindings({ 'fortune-native': ids[1], 'fortune-browser': ids[0] }); // Role swaps are rejected by the plan's actual callback check.
    await assert.rejects(provider.verifyFortuneBindings({ 'fortune-native': 'different-id', 'fortune-browser': ids[0] }), /허용 목록/);
  } finally { if (original === undefined) delete process.env.SUPABASE_PROJECT_REF; else process.env.SUPABASE_PROJECT_REF = original; }
});

test('actual unpaginated OAuth list contract accepts full rows once and stops on a future paginated or unsafe shape', async () => {
  const original = process.env.SUPABASE_PROJECT_REF;
  try {
    const credentials = { 운영REF: guard.운영REF, 리허설REF: guard.리허설REF, 읽기: () => ({ SUPABASE_PROJECT_REF: process.env.SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN: 'fixture' }) };
    for (const data of [{ clients: [{ client_id: 'one' }] }, {}, { clients: [], next_page: 2 }, { clients: [{ client_id: 'one' }, { client_id: 'one' }] }, { clients: Array.from({ length: 50 }, (_, index) => ({ client_id: String(index) })) }]) {
      let count = 0;
      const provider = await createProvider({ environment: 'production' }, { credentials, management: async () => new Response(JSON.stringify([{ type: 'secret', api_key: 'fixture' }])), fetcher: async url => { count++; assert.equal(new URL(url).search, ''); return new Response(JSON.stringify(data)); } });
      if (data.clients?.length === 1 || !Object.keys(data).length) assert.equal((await provider.listClients()).length, data.clients?.length || 0);
      else await assert.rejects(provider.listClients(), /목록/);
      assert.equal(count, 1);
    }
  } finally { if (original === undefined) delete process.env.SUPABASE_PROJECT_REF; else process.env.SUPABASE_PROJECT_REF = original; }
});

test('legacy write flags stop before provider initialization', async () => {
  const { main } = require('../tools/synk-id/oauth-clients.js'); let count = 0;
  for (const args of [['--products'], ['--운영', '--products'], ['--register']]) await assert.rejects(main(args, { createProvider: () => { count++; } }), /폐기/);
  assert.equal(count, 0);
});

test('durable journal preserves full mapping order, survives temporary cleanup and refuses outside junctions', async t => {
  const os = require('node:os'), { journalStore } = require('../tools/synk-id/provision-apply.cjs');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-id-journal-')), root = path.join(base, 'workspace'); fs.mkdirSync(root);
  t.after(() => { assert.equal(path.dirname(base), fs.realpathSync(os.tmpdir())); fs.rmSync(base, { recursive: true, force: true }); });
  const legacyDir = path.join(root, '.tmp/synk-id'); fs.mkdirSync(legacyDir, { recursive: true });
  const original = { version: 1, mapping: { z_existing: 'world', a_other: 'platform' }, bindings: {}, attempted: [] };
  fs.writeFileSync(path.join(legacyDir, 'provision-production.json'), JSON.stringify(original));
  const store = await journalStore(root, 'production'); assert.deepEqual(store.journal, original);
  await store.saveJournal(original); fs.unlinkSync(path.join(legacyDir, 'provision-production.json'));
  assert.deepEqual((await journalStore(root, 'production')).journal, original);
  assert.match(store.file, /tools[\\/]synk-id[\\/]state/);
  const outside = path.join(base, 'outside'), badRoot = path.join(base, 'bad'); fs.mkdirSync(outside); fs.mkdirSync(badRoot);
  fs.symlinkSync(outside, path.join(badRoot, 'tools'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(journalStore(badRoot, 'production'), /저장소 밖/); assert.deepEqual(fs.readdirSync(outside), []);
});
