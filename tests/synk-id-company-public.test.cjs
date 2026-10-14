'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path'), { pathToFileURL } = require('node:url');
const { provisionCompanyPublic, buildArtifacts, writePublicArtifacts, parseArguments, PUBLIC_OUTPUT } = require('../tools/synk-id/company-public-provision.cjs');
const { provisionCarePublic } = require('../tools/synk-id/care-public-provision.cjs');
const { CLIENTS, PUBLIC_CARE_CLIENT: CARE, COMPANY_CLOUD: COMPANY } = require('../tools/synk-id/registry.cjs');
const { digest, clientName } = require('../tools/synk-id/provision-plan.cjs');
const clone = value => structuredClone(value);
const settings = { version: 1, environment: 'production', supabaseUrl: 'https://qiwxeddwwnzkwalpsuty.supabase.co', supabasePublishableKey: 'sb_publishable_test_fixture', portalUrl: 'https://synk.im/id/', clients: [] };
function fixture(options = {}) {
  const wanted = CLIENTS.filter(row => row.connection !== 'pending-adapter' && (row.runtime !== 'legacy' || row.knownIds?.production));
  const clients = wanted.map(row => ({ client_id: row.knownIds?.production || 'existing-' + row.id, client_type: 'public', token_endpoint_auth_method: 'none', redirect_uris: [...row.redirectUris] }));
  const bindings = Object.fromEntries(wanted.filter(row => !row.knownIds?.production).map(row => [row.id, 'existing-' + row.id]));
  const staff = clients.find(row => row.client_id === bindings['messenger-browser']);
  if (options.extraStaffCallback) staff.redirect_uris.push('https://synk.im/staff-existing/');
  let mapping = Object.fromEntries(wanted.map(row => [row.knownIds?.production || bindings[row.id], row.product]));
  clients.push({ client_id: 'existing-public-care', client_name: clientName(CARE.id, 'production'), client_type: 'public', token_endpoint_auth_method: 'none', redirect_uris: [...CARE.redirectUris] });
  mapping['existing-public-care'] = CARE.product;
  let journal = { version: 1, environment: 'production', mapping: clone(mapping), bindings, attempted: Object.keys(bindings), pendingMapping: null, completedAt: '2026-10-07T00:00:00.000Z',
    publicCare: { version: 1, registration: CARE.id, redirectUri: CARE.redirectUris[0], attempted: true, clientId: 'existing-public-care', completedAt: '2026-10-07T01:00:00.000Z' } };
  const currentPortal = { version: 1, supabaseUrl: settings.supabaseUrl, supabasePublishableKey: settings.supabasePublishableKey, portalUrl: settings.portalUrl,
    learningUrl: 'https://synk.im/', clients: { platform: { clientId: '', redirectUri: '' }, world: { clientId: '', redirectUri: '' }, messenger: { clientId: '', redirectUri: '' } },
    authorizationClients: clients.map(row => ({ product: mapping[row.client_id], clientId: row.client_id, redirectUris: [...row.redirect_uris] })) };
  const calls = { create: [], update: [], mapping: [], saved: [], artifacts: [], fortune: 0 }; let reads = 0;
  const api = {
    async readDigest() { reads++; options.beforeRead?.(reads, { mapping, clients, journal, calls }); return digest(mapping); },
    async listClients() { return clone(clients); },
    async verifyFortuneBindings(value) { calls.fortune++; assert.equal(value['fortune-native'], bindings['fortune-native']); if (options.fortuneFail) throw Error('FORTUNE_CHANGED'); },
    async updateClient(id, body) {
      calls.update.push({ id, body: clone(body) }); if (options.beforeUpdateFailure) throw Error('timeout secret-provider-text');
      const row = clients.find(client => client.client_id === id); row.redirect_uris = [...body.redirect_uris];
      if (options.afterUpdateFailure) throw Error('response lost'); return clone(row);
    },
    async createClient(body) {
      calls.create.push(clone(body)); if (options.beforeCreateFailure) throw Error('timeout secret-provider-text');
      const row = { ...clone(body), client_id: 'actual-company-customer' }; if (options.omitName) delete row.client_name; clients.push(row);
      if (options.afterCreateFailure) throw Error('response lost'); return clone(row);
    },
    async writeMapping(value) { calls.mapping.push(clone(value)); if (options.beforeMappingFailure) throw Error('timeout'); mapping = clone(value); if (options.afterMappingFailure) throw Error('response lost'); },
  };
  return { api, calls, clients, staff, currentPortal, original: clone(journal), get mapping() { return mapping; }, get journal() { return journal; },
    setJournal(value) { journal = clone(value); }, setMapping(value) { mapping = clone(value); },
    args(extra = {}) { return { api, journal: clone(journal), settings, currentPortal,
      saveJournal: async value => { calls.saved.push(clone(value)); journal = clone(value); options.afterSave?.(value, { mapping, clients, calls }); },
      writeArtifacts: async value => { calls.artifacts.push(clone(value)); return ['config.json', 'portal-config.json']; }, ...extra }; } };
}
const writes = f => f.calls.create.length + f.calls.update.length + f.calls.mapping.length + f.calls.saved.length + f.calls.artifacts.length;

test('cloud registry is immutable and does not change the local client catalogue', () => {
  assert.equal(CLIENTS.some(row => row.id === COMPANY.customer.id), false);
  assert.equal(COMPANY.customer.product, 'platform'); assert.equal(COMPANY.staff.product, 'messenger');
  assert.deepEqual(CLIENTS.find(row => row.id === 'messenger-browser').redirectUris, ['http://127.0.0.1:4191/api/synk-id/callback']);
  assert.throws(() => COMPANY.customer.redirectUris.push('https://example.com/'), TypeError);
});
test('read-only plan reports separate identities and performs no state or remote writes', async () => {
  const f = fixture(), result = await provisionCompanyPublic(f.args());
  assert.equal(result.mode, 'dry-run'); assert.equal(result.customer.clientId, null); assert.equal(result.customer.registrationNeeded, true);
  assert.equal(result.staff.clientId, f.staff.client_id); assert.equal(result.staff.callbackNeeded, true); assert.equal(writes(f), 0);
  assert.deepEqual(f.journal, f.original); assert.equal(JSON.stringify(result).includes('sb_publishable'), false);
});
test('unbound new catalogue entries are reported but never registered or mapped by the company workflow', async () => {
  const f = fixture(), journal = clone(f.journal), id = journal.bindings['dating-browser'];
  delete journal.bindings['dating-browser']; delete journal.mapping[id]; journal.attempted = journal.attempted.filter(row => row !== 'dating-browser');
  f.clients.splice(f.clients.findIndex(row => row.client_id === id), 1);
  f.currentPortal.authorizationClients = f.currentPortal.authorizationClients.filter(row => row.clientId !== id);
  f.setJournal(journal); f.setMapping(journal.mapping);
  const result = await provisionCompanyPublic(f.args({ apply: true }));
  assert.deepEqual(result.deferredRegistrations, ['dating-browser']); assert.equal(f.calls.create.length, 1);
  assert.equal(f.calls.create[0].client_name, clientName(COMPANY.customer.id, 'production')); assert.equal(Object.hasOwn(f.mapping, id), false);
});
test('apply preserves existing callbacks, Care, mappings and portal; customer config matches actual runtime contract', async () => {
  const f = fixture({ extraStaffCallback: true }), beforeClients = clone(f.clients), beforePortal = clone(f.currentPortal);
  const result = await provisionCompanyPublic(f.args({ apply: true }));
  assert.deepEqual(f.calls.update, [{ id: f.staff.client_id, body: { redirect_uris: ['http://127.0.0.1:4191/api/synk-id/callback', 'https://synk.im/staff-existing/', COMPANY.staff.redirectUri] } }]);
  assert.deepEqual(f.calls.create, [{ client_name: 'SYNK company-customer-public-browser (production)', client_type: 'public', token_endpoint_auth_method: 'none', redirect_uris: [...COMPANY.customer.redirectUris] }]);
  assert.equal(result.customer.registrationNeeded, false); assert.equal(result.staff.callbackNeeded, false); assert.equal(result.mappingEntries, Object.keys(f.original.mapping).length + 1); assert.equal(result.liveLoginVerified, false);
  assert.deepEqual(f.journal.publicCare, f.original.publicCare); assert.deepEqual(f.journal.bindings, f.original.bindings); assert.deepEqual(f.journal.attempted, f.original.attempted);
  for (const [id, product] of Object.entries(f.original.mapping)) assert.equal(f.mapping[id], product);
  for (const old of beforeClients.filter(row => row.client_id !== f.staff.client_id)) assert.deepEqual(f.clients.find(row => row.client_id === old.client_id), old);
  const { config, portal } = f.calls.artifacts[0]; assert.deepEqual(f.currentPortal, beforePortal); assert.deepEqual(portal.clients, beforePortal.clients);
  for (const old of beforePortal.authorizationClients.filter(row => row.clientId !== f.staff.client_id)) assert.deepEqual(portal.authorizationClients.find(row => row.clientId === old.clientId), old);
  const runtime = await import(pathToFileURL(path.resolve('docs/마케팅/온라인마케팅지도/engagement/company/customer-identity.mjs')));
  const identity = runtime.createCustomerIdentity({ origin: config.origin, config: runtime.customerIdentityConfig(config.env), fetch: () => { throw Error('no network'); } });
  assert.equal(identity.status().enabled, true); assert.notEqual(config.env.SYNK_ID_CUSTOMER_CLIENT_ID, config.env.SYNK_ID_MESSENGER_CLIENT_ID); identity.close();
});
test('re-running is idempotent and existing Care provisioner consumes the preserved shared journal', async () => {
  const f = fixture(); await provisionCompanyPublic(f.args({ apply: true })); await provisionCompanyPublic(f.args({ apply: true }));
  assert.equal(f.calls.update.length, 1); assert.equal(f.calls.create.length, 1); assert.equal(f.calls.mapping.length, 1);
  const care = await provisionCarePublic({ ...f.args(), currentPortal: f.calls.artifacts[0].portal });
  assert.equal(care.mappingVerified, true); assert.equal(care.registrationNeeded, false);
});
test('missing staff binding or mismatched product stops before any write', async () => {
  for (const broken of ['missing', 'product']) {
    const f = fixture(), journal = clone(f.journal);
    if (broken === 'missing') delete journal.bindings['messenger-browser']; else journal.mapping[f.staff.client_id] = 'platform';
    f.setJournal(journal); await assert.rejects(provisionCompanyPublic(f.args({ apply: true })), /STAFF_BINDING_REQUIRED/); assert.equal(writes(f), 0);
  }
});
test('staff callback owned by another client and incomplete live portal block before writes', async () => {
  const clash = fixture(); clash.clients[0].redirect_uris.push(COMPANY.staff.redirectUri);
  await assert.rejects(provisionCompanyPublic(clash.args({ apply: true })), /STAFF_CALLBACK_CONFLICT/); assert.equal(writes(clash), 0);
  const stale = fixture(); stale.currentPortal.authorizationClients = stale.currentPortal.authorizationClients.filter(row => row.clientId !== 'existing-public-care');
  await assert.rejects(provisionCompanyPublic(stale.args({ apply: true })), /EXISTING_PORTAL_REGISTRATION_MISSING/); assert.equal(writes(stale), 0);
});
test('lost staff update response is confirmed by reading the exact union, never sent twice', async () => {
  const f = fixture({ afterUpdateFailure: true }); await provisionCompanyPublic(f.args({ apply: true }));
  assert.equal(f.calls.update.length, 1); assert.equal(f.journal.publicCompany.staff.outcome, 'verified');
  assert.equal(JSON.stringify(f.journal).includes('secret-provider'), false);
});
test('unconfirmed staff update records uncertainty and never retries automatically', async () => {
  const f = fixture({ beforeUpdateFailure: true });
  await assert.rejects(provisionCompanyPublic(f.args({ apply: true })), /STAFF_UPDATE_NOT_VERIFIED/);
  await assert.rejects(provisionCompanyPublic(f.args({ apply: true })), /UNCONFIRMED_STAFF_UPDATE_NO_RETRY/);
  assert.equal(f.calls.update.length, 1); assert.equal(f.calls.create.length + f.calls.mapping.length, 0); assert.equal(JSON.stringify(f.journal).includes('secret-provider'), false);
});
test('crash after staff PUT resumes from observed callbacks and records verified outcome without another PUT', async () => {
  let crashed = false;
  const f = fixture({ afterSave: (value, { calls }) => { if (!crashed && calls.update.length && value.publicCompany.staff.outcome !== 'verified') { crashed = true; throw Error('fixture journal crash'); } } });
  await assert.rejects(provisionCompanyPublic(f.args({ apply: true })), /fixture journal crash/);
  await provisionCompanyPublic(f.args({ apply: true })); assert.equal(f.calls.update.length, 1); assert.equal(f.journal.publicCompany.staff.outcome, 'verified');
});
test('staff callback drift immediately before update prevents replacing another writer callbacks', async () => {
  const f = fixture({ beforeRead: (reads, { clients }) => { if (reads === 3) clients.find(row => row.client_id === 'existing-messenger-browser').redirect_uris.push('https://synk.im/another-writer/'); } });
  await assert.rejects(provisionCompanyPublic(f.args({ apply: true })), /STAFF_CALLBACK_DRIFT/); assert.equal(f.calls.update.length + f.calls.create.length, 0);
});
test('lost customer creation response and missing names recover using verified identity without duplicate create', async () => {
  for (const options of [{ afterCreateFailure: true }, { omitName: true }]) {
    const f = fixture(options); await provisionCompanyPublic(f.args({ apply: true }));
    assert.equal(f.calls.create.length, 1); assert.equal(f.journal.publicCompany.customer.clientId, 'actual-company-customer');
  }
});
test('unconfirmed customer creation is durable and cannot recreate on retry', async () => {
  const f = fixture({ beforeCreateFailure: true });
  await assert.rejects(provisionCompanyPublic(f.args({ apply: true })), /CREATE_NOT_VERIFIED/);
  await assert.rejects(provisionCompanyPublic(f.args({ apply: true })), /UNCONFIRMED_CREATE_NO_RETRY/);
  assert.equal(f.calls.create.length, 1); assert.equal(f.calls.mapping.length, 0); assert.equal(JSON.stringify(f.journal).includes('secret-provider'), false);
});
test('mapping response loss and crash resume by digest without repeated POST', async () => {
  const f = fixture({ afterMappingFailure: true }); await provisionCompanyPublic(f.args({ apply: true }));
  f.setJournal(f.calls.saved.find(row => row.pendingMapping)); await provisionCompanyPublic(f.args({ apply: true }));
  assert.equal(f.calls.mapping.length, 1); assert.equal(f.calls.create.length, 1); assert.equal(f.calls.update.length, 1); assert.equal(f.journal.pendingMapping, null);
});
test('mapping drift at start or immediately before write blocks overwriting unrelated mappings', async () => {
  const initial = fixture(); initial.setMapping({ ...initial.mapping, unrelated: 'world' });
  await assert.rejects(provisionCompanyPublic(initial.args({ apply: true })), /MAPPING_DRIFT/); assert.equal(writes(initial), 0);
  const late = fixture({ afterSave: (value, { mapping }) => { if (value.pendingMapping) mapping.unrelated = 'world'; } });
  await assert.rejects(provisionCompanyPublic(late.args({ apply: true })), /MAPPING_DRIFT/); assert.equal(late.calls.mapping.length, 0); assert.equal(late.mapping.unrelated, 'world');
});
test('another registration pending mapping cannot be absorbed or cleared', async () => {
  const f = fixture(), journal = clone(f.journal); journal.pendingMapping = { ...journal.mapping, other: 'platform' }; f.setJournal(journal);
  await assert.rejects(provisionCompanyPublic(f.args({ apply: true })), /UNRELATED_PENDING_MAPPING/); assert.equal(writes(f), 0);
});
test('unknown customer callback or canonical name is never adopted', async () => {
  for (const named of [false, true]) {
    const f = fixture(); f.clients.push({ client_id: 'unknown-client', client_type: 'public', redirect_uris: [...COMPANY.customer.redirectUris], ...(named ? { client_name: clientName(COMPANY.customer.id, 'production') } : {}) });
    await assert.rejects(provisionCompanyPublic(f.args({ apply: true })), /CUSTOMER_CALLBACK_CONFLICT|EXISTING_REGISTRATION_REQUIRES_REVIEW/); assert.equal(writes(f), 0);
  }
});
test('changed customer product and deleted registered client fail closed', async () => {
  const changed = fixture(); await provisionCompanyPublic(changed.args({ apply: true }));
  const journal = clone(changed.journal); journal.mapping['actual-company-customer'] = 'world'; changed.setJournal(journal); changed.setMapping(journal.mapping);
  await assert.rejects(provisionCompanyPublic(changed.args({ apply: true })), /CUSTOMER_PRODUCT_CONFLICT/);
  const missing = fixture(); await provisionCompanyPublic(missing.args({ apply: true })); missing.clients.pop();
  await assert.rejects(provisionCompanyPublic(missing.args({ apply: true })), /RETURNED_ID_NOT_VERIFIED/); assert.equal(missing.calls.create.length, 1);
});
test('unsafe settings and changed Fortune binding fail before writes without echoing secrets', async () => {
  const f = fixture(); await assert.rejects(provisionCompanyPublic(f.args({ apply: true, settings: { ...settings, supabasePublishableKey: 'sb_secret_never_print' } })), error => !error.message.includes('never_print')); assert.equal(writes(f), 0);
  const fortune = fixture({ fortuneFail: true }); await assert.rejects(provisionCompanyPublic(fortune.args({ apply: true })), /FORTUNE_CHANGED/); assert.equal(writes(fortune), 0);
});
test('artifact generation cannot merge customer and staff identities or wrong customer redirect', async () => {
  const f = fixture(); await assert.rejects(buildArtifacts(settings, f.currentPortal, f.staff.client_id, f.staff.client_id), /VERIFIED_DISTINCT_IDS_REQUIRED/);
  f.currentPortal.authorizationClients.push({ product: 'platform', clientId: 'new-customer', redirectUris: ['https://synk.im/wrong/'] });
  await assert.rejects(buildArtifacts(settings, f.currentPortal, 'new-customer', f.staff.client_id), /CUSTOMER_PORTAL_CONFLICT/);
});
test('CLI requires explicit production and input paths, never enables apply implicitly', () => {
  const args = ['--운영', '--public', 'settings.json', '--portal', 'portal.json']; assert.equal(parseArguments(args).apply, false);
  assert.equal(parseArguments([...args, '--apply']).apply, true);
  for (const invalid of [[], args.slice(1), [...args, '--host', 'evil.example'], [...args, '--apply', '--apply']]) assert.throws(() => parseArguments(invalid));
});
test('public candidate files are isolated, idempotent and preserve previous output backups', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-company-provision-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const f = fixture(), first = await buildArtifacts(settings, f.currentPortal, 'new-customer', f.staff.client_id);
  await writePublicArtifacts(first, root); const again = await writePublicArtifacts(first, root); assert.equal(again.every(row => !row.written), true);
  const second = clone(first); second.config.note = 'candidate revision'; await writePublicArtifacts(second, root);
  const names = await fs.readdir(path.join(root, PUBLIC_OUTPUT)); assert.ok(names.some(name => name.startsWith('config.json.backup-')));
  assert.equal(names.some(name => name.includes('.tmp-')), false); assert.equal(await fs.stat(path.join(root, 'tools')).then(() => true, () => false), false);
});
