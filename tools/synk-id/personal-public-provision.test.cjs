'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path'), crypto = require('node:crypto');
const { planPersonalPublic, writeCandidate, runPersonalPublic, parseArguments, TARGETS: DEFAULT_TARGETS, TRAVEL_TARGET, PATH_APP_TARGET } = require('./personal-public-provision.cjs');
const { journalStore } = require('./provision-apply.cjs');
const { CLIENTS, PRESERVED_CLIENT_BINDINGS } = require('./registry.cjs');
const { digest } = require('./provision-plan.cjs');
const TARGETS=[...DEFAULT_TARGETS,TRAVEL_TARGET];
const clone = value => structuredClone(value);
function fixture() {
  const selected = CLIENTS.filter(row => row.connection !== 'pending-adapter' && (row.runtime !== 'legacy' || row.knownIds?.production));
  const bindings = Object.fromEntries(selected.filter(row => !row.knownIds?.production).map(row => [row.id, 'synthetic-' + row.id]));
  const clients = selected.map(row => ({ client_id: row.knownIds?.production || bindings[row.id], client_type: 'public', token_endpoint_auth_method: 'none', redirect_uris: [...row.redirectUris] }));
  const mapping = Object.fromEntries(selected.map(row => [row.knownIds?.production || bindings[row.id], row.product]));
  const journal = { version: 1, environment: 'production', completedAt: '2026-10-08T00:00:00Z', mapping, bindings, attempted: Object.keys(bindings) };
  const portal = { version: 1, supabaseUrl: 'https://qiwxeddwwnzkwalpsuty.supabase.co', supabasePublishableKey: 'sb_publishable_synthetic_only', portalUrl: 'https://synk.im/id/',
    clients: { world: { clientId: 'preserve-unrelated', redirectUri: 'https://synk.im/world/' } },
    authorizationClients: selected.map(row => ({ product: row.product, clientId: row.knownIds?.production || bindings[row.id], redirectUris: [...row.redirectUris] })) };
  let writeCalls = 0, fortuneChecks = 0;
  const forbidden = async () => { writeCalls++; throw Error('No mutation allowed'); };
  const api = { readDigest: async () => digest(mapping), listClients: async () => clone(clients), verifyFortuneBindings: async value => { fortuneChecks++; assert.equal(value['fortune-browser'], bindings['fortune-browser']); assert.equal(value['fortune-native'], bindings['fortune-native']); },
    updateClient: forbidden, createClient: forbidden, writeMapping: forbidden };
  return { journal, portal, clients, api, products:TARGETS.map(row=>row.product), counts: () => ({ writeCalls, fortuneChecks }) };
}

function pathFixture() {
  const f = fixture();
  for (const row of PRESERVED_CLIENT_BINDINGS) {
    f.journal.bindings[row.id] = row.knownIds.production;
    f.journal.mapping[row.knownIds.production] = row.product;
    f.journal.attempted.push(row.id);
  }
  f.journal.publicPersonal = { version: 1, targets: { rehearsal: {
    clientId: f.journal.bindings['rehearsal-browser'], callback: 'https://synk.im/rehearsal/',
    beforeUris: ['http://127.0.0.1:4297/'], targetUris: ['http://127.0.0.1:4297/', 'https://synk.im/rehearsal/'],
    attempted: true, outcome: 'confirmed', confirmedAt: '2026-10-08T14:21:00.351Z',
  } } };
  f.portal.authorizationClients = f.portal.authorizationClients.filter(row => row.clientId !== f.journal.bindings[PATH_APP_TARGET.binding]);
  f.products = ['path-app'];
  return f;
}

test('PATH-only preparation keeps historical bindings/history and adds exactly its own public callback and portal config', async () => {
  const f = pathFixture(), before = clone({ journal: f.journal, portal: f.portal, clients: f.clients });
  const result = await planPersonalPublic(f), id = f.journal.bindings[PATH_APP_TARGET.binding];
  assert.deepEqual(result.plan.actions.map(row => row.product), ['path-app']);
  assert.deepEqual(result.plan.actions[0].body.redirect_uris, ['http://127.0.0.1:4326/', 'https://synk.im/path/app/']);
  assert.equal(result.plan.targets[0].endpoint, 'synk-path?resource=path-app');
  assert.deepEqual(Object.keys(result.configs), ['path-app']);
  assert.deepEqual(result.configs['path-app'].clients, { 'path-app': { clientId: id, redirectUri: 'https://synk.im/path/app/' } });
  assert.deepEqual(result.portal.authorizationClients.slice(0, -1), before.portal.authorizationClients);
  assert.deepEqual(result.portal.authorizationClients.at(-1), { product: 'platform', clientId: id, redirectUris: ['http://127.0.0.1:4326/', 'https://synk.im/path/app/'] });
  assert.deepEqual(result.portal.clients, before.portal.clients); assert.deepEqual({ journal: f.journal, portal: f.portal, clients: f.clients }, before);
  assert.equal(f.counts().writeCalls, 0); assert.equal(result.plan.productMapChanged, false);
  assert.deepEqual(parseArguments(['--운영', '--out', 'candidate', '--product', 'path-app']), { out: 'candidate', apply: false, products: ['path-app'] });
  for (const product of ['rehearsal', 'family-album', 'path']) assert.throws(() => parseArguments(['--운영', '--out', 'candidate', '--product', product]), /USAGE/);
  assert.deepEqual(DEFAULT_TARGETS.map(row => row.product), ['fortune']);
});

test('PATH selection rejects reused identities, callback drift and malformed historical completion without writing', async () => {
  for (const change of [
    f => { f.journal.bindings['path-app-browser'] = f.journal.bindings['path-browser']; },
    f => { delete f.journal.bindings['path-app-browser']; },
    f => { f.clients.find(row => row.client_id === f.journal.bindings['path-app-browser']).redirect_uris = ['http://127.0.0.1:4327/']; },
    f => { f.clients.find(row => row.client_id === f.journal.bindings['path-app-browser']).redirect_uris.push('https://synk.im/unreviewed/'); },
    f => { f.clients[0].redirect_uris.push(PATH_APP_TARGET.callback); },
    f => { f.journal.publicPersonal.targets.rehearsal.clientId = 'different-history'; },
    f => { f.journal.publicPersonal.targets.rehearsal.outcome = 'pending'; },
    f => { f.journal.publicPersonal.targets.rehearsal.callback = 'https://synk.im/other/'; },
    f => { f.journal.publicPersonal.targets.rehearsal.targetUris.push('https://synk.im/other/'); },
    f => { f.journal.publicPersonal.targets.unknown = {}; },
    f => { f.journal.pendingMapping = {}; },
    f => { delete f.journal.completedAt; },
  ]) {
    const f = pathFixture(); change(f); await assert.rejects(planPersonalPublic(f)); assert.equal(f.counts().writeCalls, 0);
  }
});

test('synthetic PATH callback apply changes one client, preserves complete old history and emits only PATH artifacts', async t => {
  const f = pathFixture(), id = f.journal.bindings[PATH_APP_TARGET.binding], before = clone({ journal: f.journal, clients: f.clients });
  const journals = [], writes = [];
  f.api.updateClient = async (clientId, body) => {
    assert.equal(clientId, id); assert.equal(journals.at(-1).publicPersonal.targets['path-app'].outcome, 'pending');
    writes.push(clientId); Object.assign(f.clients.find(row => row.client_id === id), clone(body));
  };
  const options = { ...f, apply: true, saveJournal: async value => journals.push(clone(value)) };
  const result = await planPersonalPublic(options), saved = journals.at(-1);
  assert.deepEqual(writes, [id]); assert.deepEqual(saved.mapping, before.journal.mapping); assert.deepEqual(saved.bindings, before.journal.bindings);
  assert.deepEqual(saved.publicPersonal.targets.rehearsal, before.journal.publicPersonal.targets.rehearsal);
  assert.equal(saved.publicPersonal.targets['path-app'].outcome, 'confirmed');
  assert.deepEqual(f.clients.filter(row => row.client_id !== id), before.clients.filter(row => row.client_id !== id));
  await planPersonalPublic({ ...options, journal: saved, portal: result.portal }); assert.deepEqual(writes, [id]);
  const root = path.resolve(__dirname, '../..'), out = path.join(root, '.tmp', 'path-app-provision-test-' + crypto.randomUUID());
  t.after(async () => { const actual = await fs.realpath(out); assert.ok(actual.startsWith(path.join(await fs.realpath(root), '.tmp') + path.sep)); await fs.rm(actual, { recursive: true }); });
  await writeCandidate({ out, result });
  assert.deepEqual((await fs.readdir(out)).sort(), ['manifest.json', 'path-app-config.json', 'plan.json', 'portal-before.json', 'portal-config.json']);
  const manifest = JSON.parse(await fs.readFile(path.join(out, 'manifest.json')));
  assert.equal(manifest.applied, true); assert.equal(manifest.secretsIncluded, false);
});

test('read-only plan adds only the two exact callbacks to existing browser IDs, preserves native/mappings and creates no clients', async () => {
  const f = fixture(), before = clone({ journal: f.journal, portal: f.portal, clients: f.clients });
  const result = await planPersonalPublic(f);
  assert.equal(result.plan.actions.length, 2); assert.equal(result.plan.newClients, 0);
  assert.deepEqual(f.counts(), { writeCalls: 0, fortuneChecks: 2 });
  assert.deepEqual({ journal: f.journal, portal: f.portal, clients: f.clients }, before);
  for (const target of TARGETS) {
    const id = f.journal.bindings[target.binding], action = result.plan.actions.find(row => row.product === target.product);
    assert.deepEqual(action.body, { redirect_uris: [target.localCallback, target.callback] });
    assert.equal(action.path, '/auth/v1/admin/oauth/clients/' + id);
    assert.deepEqual(result.configs[target.product].clients, { [target.configKey]: { clientId: id, redirectUri: target.callback } });
    assert.equal(result.plan.targets.find(row => row.product === target.product).endpoint, target.endpoint);
  }
  assert.deepEqual(result.portal.clients, f.portal.clients);
  for (const old of f.portal.authorizationClients) {
    const after = result.portal.authorizationClients.find(row => row.clientId === old.clientId);
    assert.equal(after.product, old.product); for (const uri of old.redirectUris) assert.ok(after.redirectUris.includes(uri));
    if (!TARGETS.some(target => f.journal.bindings[target.binding] === old.clientId)) assert.deepEqual(after, old);
  }
});

test('explicit travel selection prepares only its callback/config and adds an unpublished consent entry without touching PATH VR', async () => {
  const f = fixture(), travelId = f.journal.bindings['path-travel-browser'], original = clone({ clients: f.clients, journal: f.journal });
  f.portal.authorizationClients = f.portal.authorizationClients.filter(row => row.clientId !== travelId);
  const result = await planPersonalPublic({ ...f, products: ['path-travel'] });
  assert.deepEqual(result.plan.actions.map(row => row.product), ['path-travel']);
  assert.deepEqual(result.plan.actions[0].body.redirect_uris, ['http://127.0.0.1:4303/', 'https://synk.im/try/travel/']);
  assert.deepEqual(Object.keys(result.configs), ['path-travel']);
  assert.deepEqual(result.configs['path-travel'].clients, { 'path-travel': { clientId: travelId, redirectUri: 'https://synk.im/try/travel/' } });
  assert.deepEqual(result.portal.authorizationClients.slice(0, -1), f.portal.authorizationClients);
  assert.deepEqual(f.clients, original.clients); assert.deepEqual(f.journal, original.journal);
  assert.equal(f.counts().writeCalls, 0); assert.equal(result.plan.newClients, 0);
  assert.deepEqual(parseArguments(['--운영', '--out', 'candidate', '--product', 'path-travel']), { out: 'candidate', apply: false, products: ['path-travel'] });
  assert.throws(() => parseArguments(['--운영', '--out', 'candidate', '--product', 'path']));
});

test('travel selection requires its own verified registration and rejects a reused VR identity or unknown selections', async () => {
  for (const change of [f => { delete f.journal.bindings['path-travel-browser']; }, f => { f.journal.bindings['path-travel-browser'] = f.journal.bindings['path-browser']; }]) {
    const f = fixture(); change(f); await assert.rejects(planPersonalPublic({ ...f, products: ['path-travel'] })); assert.equal(f.counts().writeCalls, 0);
  }
  for (const products of [[], ['path'], ['path-travel', 'path-travel'], 'path-travel']) await assert.rejects(planPersonalPublic({ ...fixture(), products }), /UNKNOWN_PRODUCT_SELECTION/);
});

test('synthetic travel apply writes only its selected callback and candidate, preserving prior public product history', async t => {
  const f = fixture(), travelId = f.journal.bindings['path-travel-browser'], journals = [], writes = [], beforeClients = clone(f.clients);
  const fortune = TARGETS[0], fortuneId = f.journal.bindings[fortune.binding];
  f.journal.publicPersonal = { version: 1, targets: { fortune: { clientId: fortuneId, callback: fortune.callback,
    beforeUris: [fortune.localCallback], targetUris: [fortune.localCallback, fortune.callback], attempted: true, outcome: 'confirmed', confirmedAt: '2026-10-08T00:00:00Z' } } };
  const history = clone(f.journal.publicPersonal.targets.fortune);
  f.api.updateClient = async (id, body) => { assert.equal(id, travelId); assert.equal(journals.at(-1).publicPersonal.targets['path-travel'].outcome, 'pending'); writes.push(id); Object.assign(f.clients.find(row => row.client_id === id), clone(body)); };
  const result = await planPersonalPublic({ ...f, products: ['path-travel'], apply: true, saveJournal: async value => journals.push(clone(value)) });
  assert.deepEqual(writes, [travelId]); assert.deepEqual(journals.at(-1).publicPersonal.targets.fortune, history);
  assert.deepEqual(f.clients.filter(row => row.client_id !== travelId), beforeClients.filter(row => row.client_id !== travelId));
  await planPersonalPublic({ ...f, journal: journals.at(-1), products: ['path-travel'], apply: true, saveJournal: async value => journals.push(clone(value)) });
  assert.deepEqual(writes, [travelId]);
  const root = path.resolve(__dirname, '../..'), out = path.join(root, '.tmp', 'travel-provision-test-' + crypto.randomUUID());
  t.after(async () => { const actual = await fs.realpath(out); assert.ok(actual.startsWith(path.join(await fs.realpath(root), '.tmp') + path.sep)); await fs.rm(actual, { recursive: true }); });
  await writeCandidate({ out, result });
  assert.deepEqual((await fs.readdir(out)).sort(), ['manifest.json', 'path-travel-config.json', 'plan.json', 'portal-before.json', 'portal-config.json']);
  assert.equal(JSON.parse(await fs.readFile(path.join(out, 'path-travel-config.json'))).clients['path-travel'].clientId, travelId);
});

test('already registered callbacks produce no OAuth action, and an unpublished portal callback is preserved as a local candidate only', async () => {
  const f = fixture();
  for (const target of TARGETS) f.clients.find(row => row.client_id === f.journal.bindings[target.binding]).redirect_uris.push(target.callback);
  const r = await planPersonalPublic(f); assert.deepEqual(r.plan.actions, []); assert.equal(r.plan.portalChanged, true);
  assert.equal(r.plan.limitations.callbackRegistrationsVerified, true); assert.equal(r.plan.limitations.portalPublished, false);
  f.portal = r.portal; assert.equal((await planPersonalPublic(f)).plan.portalChanged, false);
  assert.equal(f.counts().writeCalls, 0);
});

test('apply without durable persistence, incomplete journal and missing or shared native/browser identity are rejected with no mutation', async () => {
  for (const change of [f => { f.apply = true; }, f => { f.journal.pendingMapping = {}; }, f => { delete f.journal.bindings['fortune-browser']; }, f => { f.journal.bindings['fortune-native'] = f.journal.bindings['fortune-browser']; }]) {
    const f = fixture(); change(f); await assert.rejects(planPersonalPublic(f)); assert.equal(f.counts().writeCalls, 0);
  }
});

function applyFixture() {
  const f = fixture(), writes = [], journals = [], events = [];
  f.saveJournal = async value => { journals.push(clone(value)); events.push({ type: 'journal', value: clone(value.publicPersonal) }); };
  f.api.updateClient = async (id, patch) => {
    const target = TARGETS.find(target => f.journal.bindings[target.binding] === id);
    assert.ok(target, 'only the two existing browser clients may be updated');
    const pending = journals.at(-1)?.publicPersonal.targets[target.product];
    assert.equal(pending?.outcome, 'pending', 'pending must be durable before the PUT');
    assert.deepEqual(patch, { redirect_uris: pending.targetUris });
    writes.push({ id, patch: clone(patch) }); events.push({ type: 'update', product: target.product });
    Object.assign(f.clients.find(row => row.client_id === id), clone(patch));
  };
  return Object.assign(f, { writes, journals, events, apply: true });
}

test('explicit apply appends only fixed callbacks, journals each confirmation, preserves every previous callback and is idempotent', async () => {
  const f = applyFixture();
  f.journal.publicPlatform = { preserve: 'independent provisioner state' };
  for (const target of TARGETS) {
    const extra = 'https://synk.im/previous-' + target.product + '/';
    f.clients.find(row => row.client_id === f.journal.bindings[target.binding]).redirect_uris.push(extra);
    f.portal.authorizationClients.find(row => row.clientId === f.journal.bindings[target.binding]).redirectUris.push(extra);
  }
  const original = clone({ journal: f.journal, portal: f.portal, clients: f.clients });
  const result = await planPersonalPublic(f);
  assert.equal(result.plan.mode, 'apply'); assert.equal(result.plan.readOnly, false);
  assert.equal(result.plan.limitations.applied, true); assert.equal(result.plan.limitations.callbackRegistrationsVerified, true);
  assert.equal(result.plan.limitations.portalPublished, false); assert.equal(result.plan.providerUpdates, 2);
  assert.deepEqual(f.journal, original.journal); assert.deepEqual(f.portal, original.portal);
  const saved = f.journals.at(-1), { publicPersonal, ...preserved } = saved;
  assert.deepEqual(preserved, original.journal);
  for (const target of TARGETS) {
    const before = original.clients.find(row => row.client_id === f.journal.bindings[target.binding]);
    assert.deepEqual(f.writes.find(row => row.id === before.client_id).patch, { redirect_uris: [...before.redirect_uris, target.callback] });
    assert.equal(publicPersonal.targets[target.product].outcome, 'confirmed');
  }
  for (const row of original.clients.filter(row => !f.writes.some(write => write.id === row.client_id))) assert.deepEqual(f.clients.find(current => current.client_id === row.client_id), row);
  assert.deepEqual(f.events.map(event => event.type === 'update' ? 'PUT ' + event.product : Object.entries(event.value.targets).map(([key, value]) => key + ':' + value.outcome).join(',')),
    ['fortune:pending', 'PUT fortune', 'fortune:confirmed', 'fortune:confirmed,path-travel:pending', 'PUT path-travel', 'fortune:confirmed,path-travel:confirmed']);
  f.journal = saved; f.portal = result.portal;
  const repeated = await planPersonalPublic(f);
  assert.equal(repeated.plan.providerUpdates, 0); assert.deepEqual(repeated.plan.actions, []); assert.equal(repeated.plan.portalChanged, false);
  assert.equal(f.writes.length, 2); assert.equal(f.journals.length, 4);
});

test('each PUT rechecks mapping, Fortune allowlist, full client inventory and exact callback sets after pending is persisted', async t => {
  for (const product of ['fortune', 'path-travel']) for (const mode of ['mapping', 'allowlist', 'inventory', 'callback', 'public-type', 'callback-conflict']) {
    await t.test(product + ' ' + mode, async () => {
      const f = applyFixture(), save = f.saveJournal;
      f.saveJournal = async value => {
        await save(value);
        if (value.publicPersonal?.targets[product]?.outcome !== 'pending') return;
        const target = TARGETS.find(row => row.product === product), row = f.clients.find(row => row.client_id === f.journal.bindings[target.binding]);
        if (mode === 'mapping') f.api.readDigest = async () => digest({ drift: 'platform' });
        if (mode === 'allowlist') f.api.verifyFortuneBindings = async () => { throw Error('ALLOWLIST_CHANGED'); };
        if (mode === 'inventory') f.clients.push({ client_id: 'unexpected-new-client', client_type: 'public', redirect_uris: ['https://synk.im/unrelated/'] });
        if (mode === 'callback') row.redirect_uris.push('https://synk.im/concurrent-callback/');
        if (mode === 'public-type') row.client_type = 'confidential';
        if (mode === 'callback-conflict') f.clients[0].redirect_uris.push(target.callback);
      };
      await assert.rejects(planPersonalPublic(f));
      assert.equal(f.writes.length, product === 'fortune' ? 0 : 1);
      if (product === 'path-travel') assert.equal(f.journals.at(-1).publicPersonal.targets.fortune.outcome, 'confirmed');
    });
  }
});

test('the exact callback concurrently added after pending is confirmed by readback without sending a redundant PUT', async () => {
  const f = applyFixture(), save = f.saveJournal;
  f.saveJournal = async value => {
    await save(value);
    for (const target of TARGETS) if (value.publicPersonal?.targets[target.product]?.outcome === 'pending') {
      const row = f.clients.find(row => row.client_id === f.journal.bindings[target.binding]);
      if (!row.redirect_uris.includes(target.callback)) row.redirect_uris.push(target.callback);
    }
  };
  const result = await planPersonalPublic(f);
  assert.equal(f.writes.length, 0); assert.equal(result.plan.limitations.callbackRegistrationsVerified, true);
  assert.equal(f.journals.at(-1).publicPersonal.targets['path-travel'].outcome, 'confirmed');
});

test('partial failure keeps the first confirmation and never retries an absent second callback', async () => {
  const f = applyFixture(), update = f.api.updateClient;
  f.api.updateClient = async (id, patch) => {
    if (id === f.journal.bindings['fortune-browser']) return update(id, patch);
    f.writes.push({ id, patch: clone(patch) }); throw Object.assign(Error('synthetic-private-error-must-not-be-journaled'), { status: 503 });
  };
  await assert.rejects(planPersonalPublic(f), /UPDATE_NOT_VERIFIED/);
  const saved = f.journals.at(-1);
  assert.equal(saved.publicPersonal.targets.fortune.outcome, 'confirmed');
  assert.equal(saved.publicPersonal.targets['path-travel'].outcome, 'unconfirmed');
  assert.equal(saved.publicPersonal.targets['path-travel'].httpStatus, 503);
  assert.ok(!JSON.stringify(saved).includes('synthetic-private-error'));
  f.journal = saved;
  const dry = await planPersonalPublic({ ...f, apply: false });
  assert.equal(dry.plan.limitations.callbackRegistrationsVerified, false); assert.equal(dry.plan.limitations.applied, false);
  await assert.rejects(planPersonalPublic(f), /UNCONFIRMED_UPDATE_NO_RETRY/);
  assert.equal(f.writes.length, 2);
});

test('lost acknowledgements are confirmed by exact remote readback without another PUT', async () => {
  const f = applyFixture(), update = f.api.updateClient;
  f.api.updateClient = async (...args) => { await update(...args); throw Object.assign(Error('response lost'), { status: 502 }); };
  const result = await planPersonalPublic(f);
  assert.equal(result.plan.limitations.callbackRegistrationsVerified, true); assert.equal(f.writes.length, 2);
  assert.ok(f.journals.some(row => row.publicPersonal.targets.fortune.outcome === 'unconfirmed'));
  assert.equal(f.journals.at(-1).publicPersonal.targets['path-travel'].outcome, 'confirmed');
  f.journal = f.journals.at(-1); await planPersonalPublic(f); assert.equal(f.writes.length, 2);
});

test('unknown outcome plus unavailable readback stops before the second product; later exact readback resumes without replay', async () => {
  const f = applyFixture(), update = f.api.updateClient, list = f.api.listClients; let unavailable = false;
  f.api.updateClient = async (...args) => { await update(...args); unavailable = true; throw Error('network'); };
  f.api.listClients = async () => { if (unavailable) throw Error('READBACK_UNAVAILABLE'); return list(); };
  await assert.rejects(planPersonalPublic(f), /READBACK_UNAVAILABLE/);
  assert.equal(f.writes.length, 1); assert.equal(f.journals.at(-1).publicPersonal.targets.fortune.outcome, 'unconfirmed');
  assert.equal(f.journals.at(-1).publicPersonal.targets['path-travel'], undefined);
  unavailable = false; f.api.updateClient = update; f.journal = f.journals.at(-1);
  const result = await planPersonalPublic(f);
  assert.equal(result.plan.providerUpdates, 1); assert.equal(f.writes.length, 2);
  assert.equal(f.journals.at(-1).publicPersonal.targets.fortune.outcome, 'confirmed');
});

test('a success response without the exact remote callback is not a success and cannot be retried automatically', async () => {
  const f = applyFixture(); f.api.updateClient = async (id, patch) => { f.writes.push({ id, patch }); return { ok: true }; };
  await assert.rejects(planPersonalPublic(f), /UPDATE_NOT_VERIFIED/);
  assert.equal(f.journals.at(-1).publicPersonal.targets.fortune.outcome, 'pending');
  f.journal = f.journals.at(-1);
  await assert.rejects(planPersonalPublic(f), /UNCONFIRMED_UPDATE_NO_RETRY/); assert.equal(f.writes.length, 1);
});

test('pending persistence failure sends nothing; confirmation persistence failure leaves a recoverable pending record', async () => {
  const f = applyFixture(); f.saveJournal = async () => { throw Error('DISK_FAILURE'); };
  await assert.rejects(planPersonalPublic(f), /DISK_FAILURE/); assert.equal(f.writes.length, 0);
  const g = applyFixture(), save = g.saveJournal; let failConfirmation = true;
  g.saveJournal = async value => { if (failConfirmation && value.publicPersonal.targets.fortune?.outcome === 'confirmed') throw Error('DISK_FAILURE'); await save(value); };
  await assert.rejects(planPersonalPublic(g), /DISK_FAILURE/); assert.equal(g.writes.length, 1);
  assert.equal(g.journals.at(-1).publicPersonal.targets.fortune.outcome, 'pending');
  failConfirmation = false; g.journal = g.journals.at(-1); await planPersonalPublic(g);
  assert.equal(g.writes.length, 2); assert.equal(g.journals.at(-1).publicPersonal.targets['path-travel'].outcome, 'confirmed');
});

test('confirmed callback removal and forged journal identities, callbacks or target arrays fail closed', async () => {
  const f = applyFixture(); await planPersonalPublic(f); const saved = clone(f.journals.at(-1));
  for (const change of [entry => { entry.clientId = 'other-client'; }, entry => { entry.callback = 'https://synk.im/other/'; }, entry => { entry.targetUris.push('https://synk.im/other/'); }, entry => { entry.beforeUris = null; }, entry => { entry.attempted = false; }, entry => { entry.outcome = 'retry'; }]) {
    f.journal = clone(saved); change(f.journal.publicPersonal.targets.fortune);
    await assert.rejects(planPersonalPublic(f), /JOURNAL_INVALID/);
  }
  f.journal = saved; f.clients.find(row => row.client_id === f.journal.bindings['fortune-browser']).redirect_uris = [TARGETS[0].localCallback];
  await assert.rejects(planPersonalPublic(f), /CONFIRMED_CALLBACK_REMOVED/); assert.equal(f.writes.length, 2);
});

test('only explicit production apply with a new output is accepted by the CLI parser', () => {
  assert.deepEqual(parseArguments(['--운영', '--out', '.tmp/candidate']), { out: '.tmp/candidate', apply: false });
  assert.deepEqual(parseArguments(['--apply', '--out', '.tmp/candidate', '--운영']), { out: '.tmp/candidate', apply: true });
  for (const args of [[], ['--out', '.tmp/candidate'], ['--운영', '--out', '--apply'], ['--운영', '--out', '.tmp/candidate', '--apply', '--apply'], ['--운영', '--out', '.tmp/candidate', '--retry']]) assert.throws(() => parseArguments(args), /USAGE/);
});

async function cliFixture(t) {
  const f = applyFixture(), workspace = path.resolve(__dirname, '../..'), root = path.join(workspace, '.tmp', 'personal-cli-test-' + crypto.randomUUID());
  await fs.mkdir(path.join(root, 'tools/synk-id/state'), { recursive: true });
  t.after(async () => { const actual = await fs.realpath(root); assert.ok(actual.startsWith(path.join(await fs.realpath(workspace), '.tmp') + path.sep)); await fs.rm(actual, { recursive: true }); });
  const storage = await journalStore(root, 'production'); await storage.saveJournal(f.journal);
  const save = storage.saveJournal;
  storage.saveJournal = async value => { await save(value); await f.saveJournal(value); };
  const out = path.join(root, '.tmp', 'candidate'), args = ['--운영', '--out', out, '--apply'];
  let providerCalls = 0;
  return Object.assign(f, { root, out, args, storage, readPortal: async () => clone(f.portal), storeFactory: async () => storage,
    providerFactory: async options => { providerCalls++; assert.equal(options.apply, args.includes('--apply')); return f.api; }, providerCalls: () => providerCalls });
}

test('CLI default remains read-only and explicit synthetic apply shares the provisioner lock, checks journal writes and emits truthful manifests', async t => {
  const f = await cliFixture(t); f.args.pop();
  const journalBefore = await fs.readFile(f.storage.file, 'utf8'), dry = await runPersonalPublic(f);
  assert.equal(dry.mode, 'dry-run'); assert.equal(dry.applied, false); assert.equal(f.writes.length, 0);
  assert.equal(await fs.readFile(f.storage.file, 'utf8'), journalBefore);
  const g = await cliFixture(t), update = g.api.updateClient;
  g.api.updateClient = async (...args) => { assert.equal(JSON.parse(await fs.readFile(g.storage.lockPath)).registration, 'personal-public-callbacks'); return update(...args); };
  const applied = await runPersonalPublic(g);
  assert.equal(applied.applied, true); assert.equal(g.writes.length, 1);
  assert.equal(JSON.parse(await fs.readFile(g.storage.file)).publicPersonal.targets.fortune.outcome, 'confirmed');
  const manifest = JSON.parse(await fs.readFile(path.join(g.out, 'manifest.json')));
  assert.equal(manifest.applied, true); assert.equal(manifest.readOnly, false);
  await assert.rejects(fs.stat(g.storage.lockPath), { code: 'ENOENT' });
});

test('CLI rejects existing output before obtaining a write provider, respects another provisioner lock and preserves out-of-band journal changes', async t => {
  const f = await cliFixture(t); await fs.mkdir(f.out, { recursive: true });
  await assert.rejects(runPersonalPublic(f), /OUTPUT_EXISTS/); assert.equal(f.providerCalls(), 0);
  const g = await cliFixture(t); await fs.writeFile(g.storage.lockPath, 'other-owner', { flag: 'wx' });
  await assert.rejects(runPersonalPublic(g), /OTHER_PROVISIONER_LOCKED/); assert.equal(g.writes.length, 0);
  assert.equal(await fs.readFile(g.storage.lockPath, 'utf8'), 'other-owner');
  const h = await cliFixture(t), list = h.api.listClients; let changed = false;
  h.api.listClients = async () => {
    if (!changed) { changed = true; const original = JSON.parse(await fs.readFile(h.storage.file)); original.unrelatedWork = 'preserve'; await fs.writeFile(h.storage.file, JSON.stringify(original)); }
    return list();
  };
  await assert.rejects(runPersonalPublic(h), /JOURNAL_CHANGED_DURING_PLAN/); assert.equal(h.writes.length, 0);
  assert.equal(JSON.parse(await fs.readFile(h.storage.file)).unrelatedWork, 'preserve');
  await assert.rejects(fs.stat(h.storage.lockPath), { code: 'ENOENT' });
});

test('product-map or Fortune allowlist drift blocks preparation before any public artifacts exist', async () => {
  const f = fixture(); f.api.readDigest = async () => digest({ changed: 'world' });
  await assert.rejects(planPersonalPublic(f), /PRODUCT_MAPPING_DRIFT/);
  const g = fixture(); g.api.verifyFortuneBindings = async () => { throw Error('FORTUNE_ALLOWLIST_DRIFT'); };
  await assert.rejects(planPersonalPublic(g), /FORTUNE_ALLOWLIST_DRIFT/);
  assert.equal(f.counts().writeCalls + g.counts().writeCalls, 0);
});

test('unknown callback changes and exact callback belonging to another provider or portal client fail closed', async () => {
  for (const mode of ['added', 'removed', 'other-provider', 'other-portal']) {
    const f = fixture(), row = f.clients.find(row => row.client_id === f.journal.bindings['fortune-browser']);
    if (mode === 'added') row.redirect_uris.push('https://synk.im/unrelated/');
    if (mode === 'removed') row.redirect_uris = ['https://synk.im/unrelated/'];
    if (mode === 'other-provider') f.clients[0].redirect_uris.push(TARGETS[0].callback);
    if (mode === 'other-portal') f.portal.authorizationClients[0].redirectUris.push(TARGETS[0].callback);
    await assert.rejects(planPersonalPublic(f)); assert.equal(f.counts().writeCalls, 0);
  }
});

test('provider mutation between the two read snapshots cannot produce a stale candidate', async () => {
  const f = fixture(), list = f.api.listClients; let reads = 0;
  f.api.listClients = async () => { if (++reads === 2) f.clients.find(row => row.client_id === f.journal.bindings['fortune-browser']).redirect_uris.push(TARGETS[0].callback); return list(); };
  await assert.rejects(planPersonalPublic(f), /PROVIDER_CHANGED_DURING_PLAN/); assert.equal(f.counts().writeCalls, 0);
});

test('public configs cannot contain secret keys, foreign production endpoints or duplicate portal identities', async () => {
  for (const change of [f => { f.portal.supabasePublishableKey = 'sb_secret_do_not_output'; }, f => { f.portal.accountApiUrl = 'https://elsewhere.example'; }, f => { f.portal.authorizationClients.push(clone(f.portal.authorizationClients[0])); }]) {
    const f = fixture(); change(f); await assert.rejects(planPersonalPublic(f), /PRODUCTION_PORTAL_REQUIRED/); assert.equal(f.counts().writeCalls, 0);
  }
});

test('candidate files have verifiable hashes, separate app configs, preserved portal, and cannot overwrite an existing output', async t => {
  const root = path.resolve(__dirname, '../..'), out = path.join(root, '.tmp', 'personal-provision-test-' + crypto.randomUUID()), result = await planPersonalPublic(fixture());
  t.after(async () => { const actual = await fs.realpath(out); assert.ok(actual.startsWith(path.join(await fs.realpath(root), '.tmp') + path.sep)); await fs.rm(actual, { recursive: true }); });
  await writeCandidate({ out, result });
  const manifest = JSON.parse(await fs.readFile(path.join(out, 'manifest.json'), 'utf8'));
  for (const row of manifest.files) assert.equal(crypto.createHash('sha256').update(await fs.readFile(path.join(out, row.name))).digest('hex'), row.sha256);
  assert.deepEqual(manifest.guardDigests, result.plan.guards);
  assert.equal(manifest.applied, false); assert.equal(manifest.secretsIncluded, false);
  await assert.rejects(writeCandidate({ out, result }), /OUTPUT_EXISTS/);
  await assert.rejects(writeCandidate({ out: path.join(root, 'never-write-here'), result }), /NEW_WORKSPACE_TMP_REQUIRED/);
});
