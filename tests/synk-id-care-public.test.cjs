'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
const { provisionCarePublic, buildArtifacts, writePublicArtifacts, parseArguments, PUBLIC_OUTPUT } = require('../tools/synk-id/care-public-provision.cjs');
const { CLIENTS, PUBLIC_CARE_CLIENT: CARE } = require('../tools/synk-id/registry.cjs');
const { digest, clientName } = require('../tools/synk-id/provision-plan.cjs');
const { provision } = require('../tools/synk-id/provision.cjs');
const clone = value => structuredClone(value);
const settings = { version: 1, environment: 'production', supabaseUrl: 'https://qiwxeddwwnzkwalpsuty.supabase.co', supabasePublishableKey: 'sb_publishable_test_fixture', portalUrl: 'https://synk.im/id/', clients: [] };
function fixture(options = {}) {
  const wanted = CLIENTS.filter(row => row.connection !== 'pending-adapter' && (row.runtime !== 'legacy' || row.knownIds?.production));
  const clients = wanted.map(row => ({ client_id: row.knownIds?.production || 'existing-' + row.id, client_type: 'public', token_endpoint_auth_method: 'none', redirect_uris: [...row.redirectUris] }));
  const bindings = Object.fromEntries(wanted.filter(row => !row.knownIds?.production).map(row => [row.id, 'existing-' + row.id]));
  let mapping = Object.fromEntries(wanted.map(row => [row.knownIds?.production || bindings[row.id], row.product]));
  let journal = { version: 1, environment: 'production', mapping: clone(mapping), bindings, attempted: Object.keys(bindings), pendingMapping: null, completedAt: '2026-10-07T00:00:00.000Z' };
  const currentPortal = { version: 1, supabaseUrl: settings.supabaseUrl, supabasePublishableKey: settings.supabasePublishableKey, portalUrl: settings.portalUrl,
    learningUrl: 'https://synk.im/', clients: { platform: { clientId: '', redirectUri: '' }, world: { clientId: '', redirectUri: '' }, messenger: { clientId: '', redirectUri: '' } },
    authorizationClients: wanted.map(row => ({ product: row.product, clientId: row.knownIds?.production || bindings[row.id], redirectUris: [...row.redirectUris] })) };
  const calls = { create: [], mapping: [], saved: [], artifacts: [], fortune: 0 }; let reads = 0;
  const api = {
    async readDigest() { reads++; options.beforeRead?.(reads, mapping, clients); return digest(mapping); },
    async listClients() { return clone(clients); },
    async verifyFortuneBindings(value) { assert.equal(value['fortune-native'], bindings['fortune-native']); assert.equal(value['fortune-browser'], bindings['fortune-browser']); calls.fortune++; if (options.fortuneFail) throw Error('FORTUNE_CHANGED'); },
    async createClient(body) {
      calls.create.push(clone(body)); if (options.failBeforeCreate) throw Error('timeout');
      const row = { ...clone(body), client_id: 'actual-public-care' }; if (options.omitName) delete row.client_name; clients.push(row);
      if (options.afterCreate) throw Error('response lost'); return clone(row);
    },
    async writeMapping(value) { calls.mapping.push(clone(value)); if (options.failBeforeMapping) throw Error('timeout'); mapping = clone(value); if (options.afterMapping) throw Error('response lost'); },
  };
  return { api, calls, clients, currentPortal, original: clone(journal), get mapping() { return mapping; }, get journal() { return journal; },
    setJournal(value) { journal = value; }, setMapping(value) { mapping = value; },
    args(extra = {}) { return { api, journal: clone(journal), settings, currentPortal, saveJournal: async value => { calls.saved.push(clone(value)); journal = clone(value); },
      writeArtifacts: async value => { calls.artifacts.push(clone(value)); return ['config.json', 'portal-config.json']; }, ...extra }; } };
}

test('read-only plan preserves all existing state and never mutates or invents a client ID', async () => {
  const f = fixture(), result = await provisionCarePublic(f.args());
  assert.equal(result.mode, 'dry-run'); assert.equal(result.registrationNeeded, true); assert.equal(result.actualClientId, null);
  assert.equal(result.existingRegistrations, 19); assert.equal(result.localConfigsWritten, false);
  assert.equal(f.calls.create.length + f.calls.mapping.length + f.calls.saved.length + f.calls.artifacts.length, 0);
  assert.deepEqual(f.journal, f.original);
});
test('one public registration preserves 19 mappings and bindings, writes only public artifacts and remains idempotent', async () => {
  const f = fixture(), result = await provisionCarePublic(f.args({ apply: true }));
  assert.deepEqual(f.calls.create, [{ client_name: 'SYNK care-public-browser (production)', client_type: 'public', token_endpoint_auth_method: 'none', redirect_uris: ['https://synk.im/care/'] }]);
  assert.equal(result.existingRegistrations, 20); assert.equal(result.mappingEntries, 20); assert.equal(result.actualClientId, 'actual-public-care');
  assert.deepEqual(f.journal.bindings, f.original.bindings); assert.deepEqual(f.journal.attempted, f.original.attempted);
  for (const [id, product] of Object.entries(f.original.mapping)) assert.equal(f.mapping[id], product);
  assert.equal(f.mapping['actual-public-care'], 'platform'); assert.equal(f.journal.pendingMapping, null);
  assert.deepEqual(f.calls.artifacts[0].config.clients, { care: { clientId: 'actual-public-care', redirectUri: 'https://synk.im/care/' } });
  assert.equal(f.calls.artifacts[0].portal.authorizationClients.length, 20);
  assert.deepEqual(f.calls.artifacts[0].portal.authorizationClients.slice(0, 19), f.currentPortal.authorizationClients);
  assert.deepEqual(f.calls.artifacts[0].portal.clients, f.currentPortal.clients);
  await provisionCarePublic(f.args({ apply: true })); assert.equal(f.calls.create.length, 1); assert.equal(f.calls.mapping.length, 1);
  // The shared journal remains consumable by the existing generic read-only tool.
  const generic = await provision({ environment: 'production', api: f.api, journal: f.journal, publicSettings: settings });
  assert.equal(generic.mappingVerified, true); assert.deepEqual(generic.registrationsNeeded, []);
});
test('a lost creation response recovers by exact canonical name and callback without duplicate POST', async () => {
  const f = fixture({ afterCreate: true }); await provisionCarePublic(f.args({ apply: true })); assert.equal(f.calls.create.length, 1); assert.equal(f.journal.publicCare.clientId, 'actual-public-care');
});
test('a returned provider ID recovers even when client_name is omitted', async () => {
  const f = fixture({ omitName: true }); await provisionCarePublic(f.args({ apply: true })); assert.equal(f.journal.publicCare.clientId, 'actual-public-care');
});
test('unknown creation outcome is persisted and never retried automatically', async () => {
  const f = fixture({ failBeforeCreate: true });
  await assert.rejects(provisionCarePublic(f.args({ apply: true })), /CREATE_NOT_VERIFIED/);
  assert.equal(f.journal.publicCare.outcome, 'unconfirmed');
  await assert.rejects(provisionCarePublic(f.args({ apply: true })), /UNCONFIRMED_CREATE_NO_RETRY/);
  assert.equal(f.calls.create.length, 1); assert.equal(f.calls.mapping.length, 0);
});
test('known client disappearing fails closed instead of registering again', async () => {
  const f = fixture(); await provisionCarePublic(f.args({ apply: true })); f.clients.splice(f.clients.findIndex(row => row.client_id === 'actual-public-care'), 1);
  await assert.rejects(provisionCarePublic(f.args({ apply: true })), /RETURNED_ID_NOT_VERIFIED/); assert.equal(f.calls.create.length, 1);
});
test('lost mapping response is verified rather than replayed and a crash resumes pending mapping', async () => {
  const f = fixture({ afterMapping: true }); await provisionCarePublic(f.args({ apply: true })); assert.equal(f.calls.mapping.length, 1);
  const pending = f.calls.saved.find(row => row.pendingMapping); assert.ok(pending); f.setJournal(pending);
  await provisionCarePublic(f.args({ apply: true })); assert.equal(f.calls.create.length, 1); assert.equal(f.calls.mapping.length, 1); assert.equal(f.journal.pendingMapping, null);
});
test('unconfirmed mapping failure retains the durable pending target and writes no artifacts', async () => {
  const f = fixture({ failBeforeMapping: true });
  await assert.rejects(provisionCarePublic(f.args({ apply: true })), /MAPPING_NOT_VERIFIED/);
  assert.equal(Object.keys(f.journal.pendingMapping).length, 20); assert.equal(f.calls.artifacts.length, 0);
});
test('foreign mapping digest drift blocks before mutation', async () => {
  const f = fixture(); f.setMapping({ ...f.mapping, unrelated: 'platform' });
  await assert.rejects(provisionCarePublic(f.args({ apply: true })), /MAPPING_DRIFT/); assert.equal(f.calls.create.length + f.calls.mapping.length, 0);
});
test('mapping drift immediately before a write blocks overwrite', async () => {
  const f = fixture({ beforeRead(reads, mapping) { if (reads === 4) mapping.someoneElse = 'world'; } });
  await assert.rejects(provisionCarePublic(f.args({ apply: true })), /MAPPING_DRIFT/); assert.equal(f.calls.mapping.length, 0); assert.equal(f.calls.artifacts.length, 0);
});
test('existing callback under another name and extra callbacks are not adopted', async () => {
  for (const redirects of [[CARE.redirectUris[0]], [CARE.redirectUris[0], 'https://example.com/']]) {
    const f = fixture(); f.clients.push({ client_id: 'unknown-existing', client_type: 'public', redirect_uris: redirects });
    await assert.rejects(provisionCarePublic(f.args({ apply: true })), /CALLBACK_CONFLICT/); assert.equal(f.calls.create.length, 0);
  }
});
test('foreign canonical name or conflicting product requires review', async () => {
  const f = fixture(); f.clients.push({ client_id: 'unknown-existing', client_name: clientName(CARE.id, 'production'), client_type: 'public', redirect_uris: [...CARE.redirectUris] });
  await assert.rejects(provisionCarePublic(f.args({ apply: true })), /REQUIRES_REVIEW/);
  const second = fixture(); await provisionCarePublic(second.args({ apply: true })); const j = clone(second.journal); j.mapping['actual-public-care'] = 'world'; second.setJournal(j); second.setMapping(clone(j.mapping));
  await assert.rejects(provisionCarePublic(second.args({ apply: true })), /PRODUCT_CONFLICT/);
});
test('existing loopback/native registration or fortune allowlist changes block public mutation', async () => {
  const f = fixture(); f.clients.find(row => row.client_id === f.journal.bindings['care-browser']).redirect_uris = ['https://example.com/'];
  await assert.rejects(provisionCarePublic(f.args({ apply: true })), /care-browser/); assert.equal(f.calls.create.length, 0);
  const badFortune = fixture({ fortuneFail: true }); await assert.rejects(provisionCarePublic(badFortune.args({ apply: true })), /FORTUNE_CHANGED/); assert.equal(badFortune.calls.create.length, 0);
});
test('bad environment, secret key, unrelated pending journal and malformed portal fail before writes', async () => {
  const variants = [
    { settings: { ...settings, environment: 'rehearsal' } },
    { settings: { ...settings, supabasePublishableKey: 'sb_secret_not_allowed' } },
    { currentPortal: {} },
  ];
  for (const variant of variants) { const f = fixture(); await assert.rejects(provisionCarePublic(f.args({ ...variant, apply: true }))); assert.equal(f.calls.create.length + f.calls.mapping.length, 0); }
  const f = fixture(); const journal = clone(f.journal); journal.pendingMapping = { ...journal.mapping, arbitrary: 'world' };
  await assert.rejects(provisionCarePublic(f.args({ journal, apply: true })), /UNRELATED_PENDING_MAPPING/);
});
test('portal candidate must preserve every existing app callback before any registration', async () => {
  const f = fixture(); f.currentPortal.authorizationClients = f.currentPortal.authorizationClients.filter(row => row.clientId !== f.journal.bindings['care-browser']);
  await assert.rejects(provisionCarePublic(f.args({ apply: true })), /EXISTING_PORTAL_REGISTRATION_MISSING/);
  assert.equal(f.calls.create.length + f.calls.mapping.length, 0);
});
test('public file writer only uses fixed output files and preserves local config bytes', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-care-public-test-'));
  try {
    await fs.mkdir(path.join(root, 'desktop'), { recursive: true }); await fs.writeFile(path.join(root, 'desktop/auth-config.json'), 'local-original');
    const f = fixture(), artifacts = await buildArtifacts(settings, f.currentPortal, 'actual-public-care');
    const result = await writePublicArtifacts(artifacts, root); assert.equal(result.length, 2);
    assert.equal(await fs.readFile(path.join(root, 'desktop/auth-config.json'), 'utf8'), 'local-original');
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, PUBLIC_OUTPUT, 'config.json'), 'utf8')).clients, artifacts.config.clients);
    assert.ok((await writePublicArtifacts(artifacts, root)).every(row => !row.written));
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
test('public file writer rejects an output junction before touching its target', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-care-link-test-')), other = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-care-target-test-'));
  try {
    await fs.mkdir(path.join(root, '.tmp/synk-id'), { recursive: true }); await fs.symlink(other, path.join(root, PUBLIC_OUTPUT), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(writePublicArtifacts({ config: {}, portal: {} }, root), /OUTPUT_LINK/); assert.deepEqual(await fs.readdir(other), []);
  } finally { await fs.rm(path.join(root, PUBLIC_OUTPUT), { recursive: false, force: true }); await fs.rm(root, { recursive: true, force: true }); await fs.rm(other, { recursive: true, force: true }); }
});
test('CLI requires explicit production plus public and portal files and is dry-run by default', () => {
  assert.deepEqual(parseArguments(['--운영', '--public', 'settings.json', '--portal', 'portal.json']), { apply: false, publicPath: 'settings.json', portalPath: 'portal.json' });
  for (const args of [[], ['--apply'], ['--운영', '--public', 'a'], ['--운영', '--운영'], ['--운영', '--unknown']]) assert.throws(() => parseArguments(args));
});
