'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { provisionWorldAppPublic, CALLBACK, LOCAL_CALLBACK, LEARNING_URL, parseArgs } = require('../tools/synk-id/world-app-public-provision.cjs');
const { digest } = require('../tools/synk-id/provision-plan.cjs');

function fixture() {
  const clientId = 'synthetic-world-browser', otherId = 'synthetic-platform-browser';
  const extra = 'https://synk.im/existing-world/callback';
  const platformCallback = 'https://synk.im/account/client.html?product=platform';
  const journal = { version: 1, environment: 'production', completedAt: '2026-10-08T00:00:00Z', bindings: { 'world-browser': clientId, 'platform-browser': otherId },
    mapping: { [clientId]: 'world', [otherId]: 'platform' }, publicPlatform: { preserve: 'other task journal' } };
  const portal = { version: 1, supabaseUrl: 'https://qiwxeddwwnzkwalpsuty.supabase.co', supabasePublishableKey: 'sb_publishable_synthetic', portalUrl: 'https://synk.im/id/',
    clients: { world: { clientId, redirectUri: LOCAL_CALLBACK }, platform: { clientId: otherId, redirectUri: 'http://127.0.0.1:4280/synk-account/client.html?product=platform' } },
    authorizationClients: [{ product: 'world', clientId, redirectUris: [LOCAL_CALLBACK, extra] }, { product: 'platform', clientId: otherId, redirectUris: [platformCallback] }] };
  const account = structuredClone(portal);
  account.clients.platform.redirectUri = platformCallback;
  account.learningUrl = 'https://synk.im/lab/#work';
  account.messengerUrl = 'https://workspace.synk.im/';
  const rows = [{ client_id: clientId, client_type: 'public', redirect_uris: [LOCAL_CALLBACK, extra], token_endpoint_auth_method: 'none' },
    { client_id: otherId, client_type: 'public', redirect_uris: [platformCallback], token_endpoint_auth_method: 'none' }];
  const writes = [], journals = [], events = [];
  const api = {
    readDigest: async () => digest(journal.mapping), listClients: async () => structuredClone(rows),
    updateClient: async (id, patch) => { events.push('PUT'); writes.push({ id, patch: structuredClone(patch) }); Object.assign(rows.find(row => row.client_id === id), patch); },
    createClient: async () => assert.fail('New registrations are forbidden'), writeMapping: async () => assert.fail('Product mapping writes are forbidden'),
  };
  return { api, journal, portal, account, rows, writes, journals, events, clientId, extra, saveJournal: async value => { events.push('save:' + value.publicWorldApp.outcome); journals.push(structuredClone(value)); } };
}

test('default preview prepares only WORLD settings and keeps published platform settings and every caller input', async () => {
  const f = fixture(), before = structuredClone({ journal: f.journal, portal: f.portal, account: f.account, rows: f.rows });
  const result = await provisionWorldAppPublic(f);
  assert.equal(result.summary.mode, 'dry-run'); assert.equal(result.summary.callbackRegistered, false);
  assert.deepEqual(result.summary.targetUris, [LOCAL_CALLBACK, f.extra, CALLBACK]);
  assert.equal(f.writes.length, 0); assert.equal(f.journals.length, 0);
  assert.deepEqual({ journal: f.journal, portal: f.portal, account: f.account, rows: f.rows }, before);
  assert.deepEqual(result.config.clients.platform, f.account.clients.platform);
  assert.notDeepEqual(result.config.clients.platform, f.portal.clients.platform);
  assert.deepEqual(result.config.clients.world, { clientId: f.clientId, redirectUri: CALLBACK });
  assert.equal(result.config.learningUrl, LEARNING_URL); assert.equal(result.config.messengerUrl, f.account.messengerUrl);
  assert.deepEqual(result.portal.authorizationClients[1], f.portal.authorizationClients[1]);
  assert.deepEqual(result.config.authorizationClients[1], f.account.authorizationClients[1]);
  assert.deepEqual(result.portal.clients, f.portal.clients);
  assert.equal(result.summary.newClients, 0); assert.equal(result.summary.productMapChanged, false); assert.equal(result.summary.localConfigsWritten, false);
});

test('apply persists pending before the one additive PUT and preserves unrelated journal fields and clients', async () => {
  const f = fixture(), other = structuredClone(f.rows[1]), result = await provisionWorldAppPublic({ ...f, apply: true });
  assert.deepEqual(f.events, ['save:pending', 'PUT', 'save:verified']);
  assert.deepEqual(f.writes, [{ id: f.clientId, patch: { redirect_uris: [LOCAL_CALLBACK, f.extra, CALLBACK] } }]);
  assert.equal(result.summary.callbackRegistered, true); assert.equal(result.summary.providerUpdates, 1);
  const latest = structuredClone(f.journals.at(-1)); assert.equal(latest.publicWorldApp.outcome, 'verified'); delete latest.publicWorldApp;
  assert.deepEqual(latest, f.journal); assert.deepEqual(f.rows[1], other);
});

test('already verified rerun does not dispatch or rewrite its completed journal', async () => {
  const f = fixture(); await provisionWorldAppPublic({ ...f, apply: true });
  const saves = f.journals.length;
  const result = await provisionWorldAppPublic({ ...f, journal: f.journals.at(-1), apply: true });
  assert.equal(f.writes.length, 1); assert.equal(f.journals.length, saves); assert.equal(result.summary.providerUpdates, 0);
});

test('a callback already present without a local attempt requires no provider mutation', async () => {
  const f = fixture(); f.rows[0].redirect_uris.push(CALLBACK);
  const result = await provisionWorldAppPublic({ ...f, apply: true });
  assert.equal(result.summary.callbackRegistered, true); assert.equal(f.writes.length, 0); assert.equal(f.journals.length, 0);
});

test('lost successful PUT response is verified by readback, never replayed', async () => {
  const f = fixture(), update = f.api.updateClient;
  f.api.updateClient = async (...args) => { await update(...args); throw Object.assign(Error('lost synthetic response'), { status: 503 }); };
  assert.equal((await provisionWorldAppPublic({ ...f, apply: true })).summary.callbackRegistered, true);
  assert.equal(f.writes.length, 1); assert.equal(f.journals.at(-1).publicWorldApp.outcome, 'verified');
  assert.equal(f.journals.at(-1).publicWorldApp.httpStatus, 503);
});

test('ambiguous absent update is durable and cannot be retried as another PUT', async () => {
  const f = fixture(); f.api.updateClient = async () => { f.writes.push('attempt'); throw Error('synthetic network failure'); };
  await assert.rejects(provisionWorldAppPublic({ ...f, apply: true }), /UPDATE_NOT_VERIFIED/);
  assert.equal(f.journals.at(-1).publicWorldApp.outcome, 'unconfirmed');
  await assert.rejects(provisionWorldAppPublic({ ...f, journal: f.journals.at(-1), apply: true }), /UNCONFIRMED_UPDATE_NO_RETRY/);
  assert.equal(f.writes.length, 1);
});

test('late successful update is reconciled from an unconfirmed journal without another PUT', async () => {
  const f = fixture(); f.api.updateClient = async () => { f.writes.push('attempt'); throw Error('network'); };
  await assert.rejects(provisionWorldAppPublic({ ...f, apply: true }), /UPDATE_NOT_VERIFIED/);
  f.rows[0].redirect_uris.push(CALLBACK);
  const result = await provisionWorldAppPublic({ ...f, journal: f.journals.at(-1), apply: true });
  assert.equal(result.summary.callbackRegistered, true); assert.equal(f.writes.length, 1); assert.equal(f.journals.at(-1).publicWorldApp.outcome, 'verified');
});

test('failed journal persistence stops before dispatch', async () => {
  const f = fixture(); await assert.rejects(provisionWorldAppPublic({ ...f, apply: true, saveJournal: async () => { throw Error('disk full'); } }), /disk full/);
  assert.equal(f.writes.length, 0);
});

test('production completed journal, WORLD product and unique browser binding are required', async () => {
  for (const change of [j => { j.environment = 'rehearsal'; }, j => { delete j.completedAt; }, j => { j.pendingMapping = {}; },
    j => { j.mapping['synthetic-world-browser'] = 'platform'; }, j => { delete j.bindings['world-browser']; }, j => { j.bindings['world-native'] = j.bindings['world-browser']; }]) {
    const f = fixture(); change(f.journal); await assert.rejects(provisionWorldAppPublic({ ...f, apply: true }), /COMPLETED_JOURNAL_REQUIRED|WORLD_BINDING_REQUIRED/); assert.equal(f.writes.length, 0);
  }
});

test('mapping drift stops before mutation', async () => {
  const f = fixture(); f.api.readDigest = async () => digest({ other: 'world' });
  await assert.rejects(provisionWorldAppPublic({ ...f, apply: true }), /PRODUCT_MAPPING_DRIFT/); assert.equal(f.writes.length, 0);
});

test('provider, portal and account callback ownership conflicts are blocked', async () => {
  for (const location of ['rows', 'portal', 'account']) {
    const f = fixture(); if (location === 'rows') f.rows[1].redirect_uris.push(CALLBACK); else f[location].authorizationClients[1].redirectUris.push(CALLBACK);
    await assert.rejects(provisionWorldAppPublic({ ...f, apply: true }), /CALLBACK_CONFLICT/); assert.equal(f.writes.length, 0);
  }
});

test('unpublished additions and removed published callbacks cannot be overwritten', async () => {
  const f = fixture(); f.rows[0].redirect_uris.push('https://synk.im/unpublished/callback');
  await assert.rejects(provisionWorldAppPublic({ ...f, apply: true }), /UNPUBLISHED_CALLBACK_DRIFT/); assert.equal(f.writes.length, 0);
  const g = fixture(); g.rows[0].redirect_uris.pop();
  await assert.rejects(provisionWorldAppPublic({ ...g, apply: true }), /REMOVED_CALLBACK_DRIFT/); assert.equal(g.writes.length, 0);
});

test('confidential, revoked, deleted, secret-bearing and duplicate-callback targets are rejected', async () => {
  for (const patch of [{ client_type: 'confidential' }, { revoked: true }, { deleted_at: 'synthetic' }, { client_secret: 'synthetic-secret' },
    { token_endpoint_auth_method: 'client_secret_post' }, { redirect_uris: [LOCAL_CALLBACK, LOCAL_CALLBACK] }]) {
    const f = fixture(); Object.assign(f.rows[0], patch); await assert.rejects(provisionWorldAppPublic({ ...f, apply: true }), /PUBLIC_CLIENT_NOT_VERIFIED/); assert.equal(f.writes.length, 0);
  }
});

test('duplicate provider or portal identities fail closed', async () => {
  const f = fixture(); f.rows.push(structuredClone(f.rows[0])); await assert.rejects(provisionWorldAppPublic(f), /INVALID_PROVIDER_INVENTORY/);
  const g = fixture(); g.portal.authorizationClients.push(structuredClone(g.portal.authorizationClients[0])); await assert.rejects(provisionWorldAppPublic(g), /INVALID_PUBLIC_CONFIG/);
});

test('a second writer callback change after pending journal but before PUT prevents dispatch', async () => {
  const f = fixture(), save = f.saveJournal;
  f.saveJournal = async value => { await save(value); f.rows[0].redirect_uris.push('https://synk.im/concurrent/callback'); };
  await assert.rejects(provisionWorldAppPublic({ ...f, apply: true }), /UNPUBLISHED_CALLBACK_DRIFT/); assert.equal(f.writes.length, 0);
});

test('another client inventory change during preflight cannot silently pass', async () => {
  const f = fixture(), list = f.api.listClients; let calls = 0;
  f.api.listClients = async () => { if (++calls === 2) f.rows[1].redirect_uris.push('https://synk.im/other/new-callback'); return list(); };
  await assert.rejects(provisionWorldAppPublic({ ...f, apply: true }), /PROVIDER_INVENTORY_DRIFT/); assert.equal(f.writes.length, 0);
});

test('verified callback removal fails closed instead of re-adding it', async () => {
  const f = fixture(); await provisionWorldAppPublic({ ...f, apply: true }); f.rows[0].redirect_uris = f.rows[0].redirect_uris.filter(uri => uri !== CALLBACK);
  await assert.rejects(provisionWorldAppPublic({ ...f, journal: f.journals.at(-1), apply: true }), /CONFIRMED_CALLBACK_REMOVED/); assert.equal(f.writes.length, 1);
});

test('tampered or incomplete attempt journals cannot authorize a PUT', async () => {
  const f = fixture(); await provisionWorldAppPublic({ ...f, apply: true }); const saved = f.journals.at(-1);
  for (const change of [j => { j.publicWorldApp.clientId = 'another'; }, j => { j.publicWorldApp.beforeUris = null; }, j => { j.publicWorldApp.targetUris.push('https://extra.invalid/'); },
    j => { j.publicWorldApp.attempted = false; }, j => { j.publicWorldApp.outcome = 'unknown'; }, j => { delete j.publicWorldApp.completedAt; }]) {
    const journal = structuredClone(saved); change(journal); await assert.rejects(provisionWorldAppPublic({ ...f, journal, apply: true }), /JOURNAL_INVALID/);
  }
  assert.equal(f.writes.length, 1);
});

test('local journal drift is checked again after the durable pending write', async () => {
  const f = fixture(); let checks = 0;
  await assert.rejects(provisionWorldAppPublic({ ...f, apply: true, verifyJournal: async () => { if (++checks === 3) throw Error('WORLD_PUBLIC_LOCAL_JOURNAL_DRIFT'); } }), /LOCAL_JOURNAL_DRIFT/);
  assert.equal(f.writes.length, 0); assert.equal(f.journals.length, 1);
});

test('public config secrets, mismatched project or key and foreign WORLD runtime binding are rejected', async () => {
  for (const change of [f => { f.portal.secret = 'synthetic'; }, f => { f.account.supabasePublishableKey = 'sb_secret_synthetic'; },
    f => { f.account.supabaseUrl = 'https://other.supabase.co'; }, f => { f.account.supabasePublishableKey = 'sb_publishable_other'; },
    f => { f.account.clients.world.clientId = 'different-world'; }]) {
    const f = fixture(); change(f); await assert.rejects(provisionWorldAppPublic({ ...f, apply: true }), /공개 설정|PRODUCTION_CONFIG_REQUIRED|ACCOUNT_PORTAL_DRIFT|ACCOUNT_WORLD_BINDING_DRIFT/); assert.equal(f.writes.length, 0);
  }
});

test('an account config with no prior WORLD entry is extended without replacing existing registrations', async () => {
  const f = fixture(); delete f.account.clients.world; f.account.authorizationClients.shift();
  const result = await provisionWorldAppPublic(f);
  assert.deepEqual(result.config.authorizationClients[0], f.account.authorizationClients[0]);
  assert.deepEqual(result.config.authorizationClients[1], { product: 'world', clientId: f.clientId, redirectUris: [LOCAL_CALLBACK, f.extra, CALLBACK] });
});

test('apply requires boolean true and a persistent journal writer', async () => {
  const f = fixture(); await assert.rejects(provisionWorldAppPublic({ ...f, apply: 'false' }), /EXPLICIT_APPLY_REQUIRED/);
  await assert.rejects(provisionWorldAppPublic({ ...f, apply: true, saveJournal: undefined }), /PERSISTENT_JOURNAL_REQUIRED/); assert.equal(f.writes.length, 0);
});

test('CLI preview is the default and only explicit production apply arguments are accepted', () => {
  assert.deepEqual(parseArgs(['--운영']), { apply: false }); assert.deepEqual(parseArgs(['--운영', '--apply']), { apply: true });
  for (const args of [[], ['--apply'], ['--운영', '--apply=false'], ['--운영', '--register'], ['--운영', '--apply', '--apply']]) assert.throws(() => parseArgs(args), /USAGE_REQUIRE_PRODUCTION/);
});
