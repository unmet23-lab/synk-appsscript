'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const { provision } = require('../tools/synk-id/provision.cjs');
const { createProvider } = require('../tools/synk-id/provision-apply.cjs');
const { canonicalMap, digest, clientName } = require('../tools/synk-id/provision-plan.cjs');
const { CLIENTS } = require('../tools/synk-id/registry.cjs');
const clone = value => JSON.parse(JSON.stringify(value));
const publicSettings = { version: 1, supabaseUrl: 'https://synthetic.supabase.co', supabasePublishableKey: 'sb_publishable_synthetic', portalUrl: 'https://synk.im/id/' };
function fixture({ failCreate, afterCreate, beforeWrite, failAfterWrite, beforeRead } = {}) {
  let mapping = canonicalMap('production'), journal = null, serial = 0, reads = 0;
  const clients = CLIENTS.filter(client => client.knownIds?.production).map(client => ({ client_id: client.knownIds.production, client_type: 'public', redirect_uris: [...client.redirectUris] }));
  const calls = { create: [], write: [], configs: [] };
  const api = {
    async readDigest() { reads++; beforeRead?.(reads, { mapping, clients }); return digest(mapping); },
    async listClients() { return clone(clients); },
    async createClient(body) {
      calls.create.push(clone(body)); if (failCreate?.(body, calls.create.length)) throw Error('fixture interrupted before creation');
      const client = { ...clone(body), client_id: 'provider-actual-' + ++serial }; clients.push(client);
      if (afterCreate?.(body, calls.create.length)) throw Error('fixture response lost after creation'); return clone(client);
    },
    async writeMapping(value) { beforeWrite?.(value); calls.write.push(clone(value)); mapping = clone(value); if (failAfterWrite) throw Error('fixture response lost after write'); },
  };
  return { api, clients, calls, get journal() { return journal; }, get mapping() { return mapping; }, setMapping: value => { mapping = clone(value); },
    options: () => ({ environment: 'production', api, journal: clone(journal), publicSettings, saveJournal: async value => { journal = clone(value); }, writeConfigs: async plan => { calls.configs.push(plan); return plan.files.map(file => ({ path: file.path, written: true })); } }) };
}

test('default provisioning only reads and creates no clients, mappings, journal or configs', async () => {
  const f = fixture(), result = await provision(f.options());
  assert.equal(result.mode, 'dry-run'); assert.ok(result.registrationsNeeded.includes('care-native'));
  assert.deepEqual(f.calls, { create: [], write: [], configs: [] }); assert.equal(f.journal, null);
});

test('apply registers only public clients with actual API fields, preserves legacy and generates only actual returned IDs', async () => {
  const f = fixture(), legacy = clone(f.mapping), result = await provision({ ...f.options(), apply: true });
  assert.equal(result.mode, 'apply'); assert.equal(result.liveLoginVerified, false);
  assert.ok(f.calls.create.length > 0); assert.equal(f.calls.write.length, 1); assert.equal(f.calls.configs.length, 1);
  for (const body of f.calls.create) { assert.ok(body.client_name.startsWith('SYNK ')); assert.equal(body.name, undefined); assert.equal(body.client_type, 'public'); assert.equal(body.token_endpoint_auth_method, 'none'); assert.deepEqual(Object.keys(body).sort(), ['client_name', 'client_type', 'redirect_uris', 'token_endpoint_auth_method']); }
  for (const [id, product] of Object.entries(legacy)) assert.equal(f.mapping[id], product);
  const actualIds = new Set(f.clients.map(client => client.client_id));
  for (const file of f.calls.configs[0].files) for (const client of Object.values(file.data.clients)) assert.ok(actualIds.has(client.clientId));
  assert.equal(JSON.stringify(result).includes('sb_publishable'), false); assert.equal(result.mappingEntries, f.clients.length);
  const count = f.calls.create.length; await provision({ ...f.options(), apply: true }); assert.equal(f.calls.create.length, count); assert.equal(f.calls.write.length, 1);
});

test('an unknown client creation response is recovered from provider state without duplicate registration', async () => {
  const f = fixture({ afterCreate: (_body, count) => count === 1 });
  await provision({ ...f.options(), apply: true });
  assert.equal(new Set(f.clients.map(client => client.client_name).filter(Boolean)).size, f.calls.create.length);
  assert.equal(f.journal.attempted.length, f.calls.create.length);
});

test('a partial run preserves actual IDs and never repeats an unresolved creation attempt', async () => {
  const f = fixture({ failCreate: (_body, count) => count === 2 });
  await assert.rejects(provision({ ...f.options(), apply: true }), /등록 응답/);
  assert.equal(f.calls.create.length, 2); assert.equal(f.clients.length, 3); assert.equal(Object.keys(f.journal.bindings).length, 1);
  assert.equal(f.calls.write.length, 0); assert.equal(f.calls.configs.length, 0);
  await assert.rejects(provision({ ...f.options(), apply: true }), /이전 등록 요청/);
  assert.equal(f.calls.create.length, 2);
});

test('a completed secret write with a lost response is confirmed by digest rather than replayed', async () => {
  const f = fixture({ failAfterWrite: true });
  await provision({ ...f.options(), apply: true });
  assert.equal(f.calls.write.length, 1); assert.equal(f.journal.pendingMapping, null);
  await provision({ ...f.options(), apply: true }); assert.equal(f.calls.write.length, 1);
});

test('fresh mapping drift stops before first registration or before secret overwrite', async () => {
  const initial = fixture(); initial.setMapping({ ...initial.mapping, somebody: 'world' });
  await assert.rejects(provision({ ...initial.options(), apply: true }), /지문/); assert.equal(initial.calls.create.length, 0);
  const drift = fixture({ beforeRead: (count, { mapping }) => { if (count === 3) mapping['external-editor'] = 'messenger'; } });
  await assert.rejects(provision({ ...drift.options(), apply: true }), /적용 도중/);
  assert.equal(drift.calls.create.length, 1); assert.equal(drift.calls.write.length, 0); assert.equal(drift.mapping['external-editor'], 'messenger');
});

test('verified unknown mapping entries are preserved while mismatched legacy mappings are refused', async () => {
  const f = fixture(), source = { ...f.mapping, existing_other_app: 'messenger' }; f.setMapping(source);
  await provision({ ...f.options(), apply: true, existingMapping: source }); assert.equal(f.mapping.existing_other_app, 'messenger');
  const bad = fixture(), changed = { ...bad.mapping }; changed[Object.keys(changed)[0]] = 'platform'; bad.setMapping(changed);
  await assert.rejects(provision({ ...bad.options(), apply: true, existingMapping: changed }), /보존/); assert.equal(bad.calls.create.length, 0);
});

test('unbound existing callback requires explicit choice and is never duplicated or silently repurposed', async () => {
  const f = fixture(), wanted = CLIENTS.find(client => client.id === 'care-native');
  f.clients.push({ client_id: 'manually-registered', client_type: 'public', client_name: 'A human-owned name', redirect_uris: [...wanted.redirectUris] });
  await assert.rejects(provision({ ...f.options(), apply: true }), /binding/); assert.equal(f.calls.create.length, 0);
  await provision({ ...f.options(), apply: true, bindings: { 'care-native': 'manually-registered' } });
  assert.equal(f.calls.create.some(body => body.client_name === clientName('care-native', 'production')), false);
  assert.equal(f.mapping['manually-registered'], 'platform');
});

test('invalid public material stops before remote mutation and errors do not echo key values', async () => {
  const f = fixture();
  await assert.rejects(provision({ ...f.options(), apply: true, publicSettings: { ...publicSettings, supabasePublishableKey: 'sb_secret_synthetic_never_print' } }), error => !error.message.includes('synthetic_never_print'));
  assert.equal(f.calls.create.length, 0); assert.equal(f.calls.write.length, 0);
});

test('pending mapping journal can resume after a verified write without replaying it', async () => {
  const f = fixture(); await provision({ ...f.options(), apply: true });
  const journal = clone(f.journal); journal.pendingMapping = journal.mapping; journal.mapping = canonicalMap('production');
  const before = f.calls.write.length; await provision({ ...f.options(), apply: true, journal }); assert.equal(f.calls.write.length, before);
});

test('explicit retry after confirmed absence resumes a failed request without repeating successful clients', async () => {
  const f = fixture({ failCreate: (_body, count) => count === 2 });
  await assert.rejects(provision({ ...f.options(), apply: true }));
  const retry = f.journal.attempted[1], firstId = Object.values(f.journal.bindings)[0];
  await assert.rejects(provision({ ...f.options(), retryConfirmedAbsent: retry }), /--apply/);
  await provision({ ...f.options(), apply: true, retryConfirmedAbsent: retry });
  assert.equal(Object.values(f.journal.bindings).filter(id => id === firstId).length, 1);
  assert.equal(f.journal.retryHistory.length, 1);
  assert.equal(f.journal.attemptResults[retry].outcome, 'response');
  assert.equal(f.calls.create.filter(body => body.client_name === clientName(retry, 'production')).length, 2);
});

test('returned provider IDs recover even when the list omits client_name and persist across interrupted list reads', async () => {
  const f = fixture(), list = f.api.listClients; let interrupt = true;
  f.api.listClients = async () => {
    if (f.calls.create.length === 1 && interrupt) { interrupt = false; throw Error('fixture list unavailable'); }
    return (await list()).map(({ client_name, ...client }) => client);
  };
  await assert.rejects(provision({ ...f.options(), apply: true }), /list unavailable/);
  assert.equal(f.journal.attemptResults[f.journal.attempted[0]].clientId, 'provider-actual-1');
  await provision({ ...f.options(), apply: true });
  assert.equal(f.calls.create.length, f.clients.length - 2);
});

test('failure journal stores only safe status metadata and does not silently retry or echo provider bodies', async () => {
  const f = fixture(); f.api.createClient = async () => { const error = Error('secret-looking-provider-body'); error.status = 429; throw error; };
  await assert.rejects(provision({ ...f.options(), apply: true }), /등록 응답/);
  assert.equal(f.journal.attemptResults[f.journal.attempted[0]].httpStatus, 429);
  assert.equal(JSON.stringify(f.journal).includes('secret-looking'), false);
  await assert.rejects(provision({ ...f.options(), apply: true }), /이전 등록 요청/);
});

test('existing Fortune and unrelated mapping source order survive the full workflow', async () => {
  const f = fixture(), bindings = {};
  for (const registration of ['fortune-native', 'fortune-browser']) {
    const wanted = CLIENTS.find(row => row.id === registration), id = 'existing-' + registration;
    f.clients.push({ client_id: id, client_name: 'Different deployed name', client_type: 'public', redirect_uris: [...wanted.redirectUris, 'https://synk.im/fortune/callback/' + registration] }); bindings[registration] = id;
  }
  const original = { ...f.mapping, 'existing-fortune-native': 'platform', 'existing-fortune-browser': 'platform', 'other-service': 'world' }; f.setMapping(original);
  await provision({ ...f.options(), apply: true, existingMapping: original, bindings });
  assert.deepEqual(Object.entries(f.mapping).slice(0, Object.keys(original).length), Object.entries(original));
  assert.equal(f.calls.create.length, 15); assert.equal(f.calls.create.some(row => /fortune/.test(row.client_name)), false);
});

async function updateProviderFixture(t, apply) {
  const original = process.env.SUPABASE_PROJECT_REF;
  t.after(() => { if (original === undefined) delete process.env.SUPABASE_PROJECT_REF; else process.env.SUPABASE_PROJECT_REF = original; });
  const managementCalls = [], requests = [];
  const credentials = { 운영REF: 'synthetic', 리허설REF: 'syntheticpreview', 읽기: () => ({ SUPABASE_PROJECT_REF: process.env.SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN: 'fixture-only' }) };
  const provider = await createProvider({ environment: 'production', apply }, { credentials,
    management: async (ref, suffix) => { managementCalls.push({ ref, suffix }); return Response.json([{ type: 'secret', api_key: 'fixture-admin-only' }]); },
    fetcher: async (url, init) => { requests.push({ url, init }); return Response.json({ client_id: 'existing-client_1', ...JSON.parse(init.body) }); },
  });
  return { provider, managementCalls, requests };
}

test('read-only provider rejects OAuth updates before obtaining admin credentials or sending requests', async t => {
  const f = await updateProviderFixture(t, false);
  await assert.rejects(f.provider.updateClient('existing-client_1', { redirect_uris: ['https://example.com/callback'] }), /읽기 전용/);
  assert.deepEqual(f.managementCalls, []); assert.deepEqual(f.requests, []);
});

test('OAuth update rejects invalid client IDs before any admin credential lookup or request', async t => {
  const f = await updateProviderFixture(t, true);
  for (const id of ['', null, 123, 'a'.repeat(257), '../other', 'client/other', 'client?admin=1', '%2Fother', '클라이언트']) {
    await assert.rejects(f.provider.updateClient(id, {}), /클라이언트 ID/);
  }
  assert.deepEqual(f.managementCalls, []); assert.deepEqual(f.requests, []);
});

test('OAuth update sends one authenticated PUT to the exact client and preserves its callback body', async t => {
  const f = await updateProviderFixture(t, true), body = { redirect_uris: ['http://127.0.0.1:4191/api/synk-id/callback', 'https://workspace.synk.im/api/synk-id/callback'] };
  const result = await f.provider.updateClient('existing-client_1', body);
  assert.deepEqual(f.managementCalls, [{ ref: 'synthetic', suffix: '/api-keys?reveal=true' }]);
  assert.equal(f.requests.length, 1);
  const { url, init } = f.requests[0];
  assert.equal(url, 'https://synthetic.supabase.co/auth/v1/admin/oauth/clients/existing-client_1');
  assert.equal(init.method, 'PUT'); assert.equal(init.redirect, 'error');
  assert.equal(init.headers.apikey, 'fixture-admin-only'); assert.equal(init.headers.Authorization, 'Bearer fixture-admin-only');
  assert.deepEqual(JSON.parse(init.body), body); assert.deepEqual(result, { client_id: 'existing-client_1', ...body });
});
