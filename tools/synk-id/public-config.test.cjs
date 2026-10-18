'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os');
const { pathToFileURL } = require('node:url');
const { CLIENTS, SERVICES, LEGACY_CLIENT_IDS } = require('./registry.cjs');
const { buildConfigPlan, applyConfigPlan, OUTPUTS } = require('./public-config.cjs');
const { configuration } = require('../../desktop/src/auth-config.cjs');
const { resolveAuthConfigPath } = require('../../desktop/src/auth-config-path.cjs');
function input(ids = ['world-legacy', 'tools-legacy', 'platform-native', 'world-native', 'messenger-native', 'teacher-native', 'fortune-native', 'care-native', 'platform-browser', 'world-browser', 'messenger-browser', 'fortune-browser', 'care-browser']) {
  return { version: 1, environment: 'production', supabaseUrl: 'https://synthetic.supabase.co', supabasePublishableKey: 'sb_publishable_synthetic', portalUrl: 'https://synk.im/id/',
    clients: ids.map(id => { const registration = CLIENTS.find(client => client.id === id); return { registration: id, client_id: registration.knownIds?.production || `synthetic-${id}`, client_type: 'public', redirect_uris: [...registration.redirectUris] }; }) };
}
const data = (plan, name) => plan.files.find(file => file.path === OUTPUTS[name]).data;

test('registry preserves existing legacy identities and distinguishes unimplemented services', () => {
  assert.deepEqual(LEGACY_CLIENT_IDS.production, { world: '52e3e2ac-e26f-46c4-948a-e4ef84982141', tools: '291a98a7-4fa8-44fe-b5de-8acb790bea21' });
  assert.equal(LEGACY_CLIENT_IDS.rehearsal.world, 'f1a08dbc-2677-46bf-9146-db65688bf445');
  assert.deepEqual(SERVICES.filter(item => ['path'].includes(item.id)).map(item => item.connection), ['implemented']);
  assert.equal(CLIENTS.find(item => item.id === 'teacher-browser').connection, 'pending-adapter');
  assert.ok(Object.isFrozen(CLIENTS[0].redirectUris));
});

test('travel uses a separate browser-only client and observed config without changing PATH VR or native ports', async () => {
  const travel = CLIENTS.filter(row => row.service === 'path-travel');
  assert.equal(travel.length, 1); assert.equal(travel[0].id, 'path-travel-browser');
  assert.deepEqual(travel[0].redirectUris, ['http://127.0.0.1:4303/']);
  assert.equal(CLIENTS.filter(row => row.runtime === 'native').length, 7);
  const plan = buildConfigPlan(input(['path-browser', 'path-travel-browser'])), browser = data(plan, 'browser');
  assert.deepEqual(browser.clients.path, { clientId: 'synthetic-path-browser', redirectUri: 'http://127.0.0.1:4292/' });
  assert.deepEqual(browser.clients['path-travel'], { clientId: 'synthetic-path-travel-browser', redirectUri: 'http://127.0.0.1:4303/' });
  assert.deepEqual(data(plan, 'desktop').clients, {});
  assert.equal(plan.products['synthetic-path-travel-browser'], 'platform');
  const core = await import(pathToFileURL(path.resolve(__dirname, '../../experiences/synk-account/src/core.mjs')));
  assert.equal(core.readConfig(browser, 'http://127.0.0.1:4303/').clients['path-travel'].clientId, 'synthetic-path-travel-browser');
  const shared = input(['path-browser', 'path-travel-browser']); shared.clients[1].client_id = shared.clients[0].client_id;
  assert.throws(() => buildConfigPlan(shared), /중복/);
});

test('actual registrations produce all six isolated desktop clients and canonical browser configs', async () => {
  const plan = buildConfigPlan(input()), desktop = data(plan, 'desktop'), browser = data(plan, 'browser'), fortune = data(plan, 'fortune');
  assert.deepEqual(Object.keys(desktop.clients), ['platform', 'world', 'messenger', 'teacher', 'fortune', 'care']);
  for (const id of Object.keys(desktop.clients)) { const selected = configuration(desktop, id, 'development'); assert.equal(selected.clientId, `synthetic-${id}-native`); assert.equal(selected.product, ['teacher', 'world'].includes(id) ? 'world' : id === 'messenger' ? 'messenger' : 'platform'); }
  const core = await import(pathToFileURL(path.resolve(__dirname, '../../experiences/synk-account/src/core.mjs')));
  assert.equal(core.readConfig(browser, 'http://127.0.0.1:4280/').clients.care.clientId, 'synthetic-care-browser');
  assert.equal(core.readConfig(fortune, 'http://127.0.0.1:4299/').clients.platform.clientId, 'synthetic-fortune-browser');
  assert.equal(Object.values(desktop.clients).some(client => client.clientId === browser.clients.care.clientId), false);
  assert.equal(browser.authorizationClients.length, plan.registered.length);
  assert.equal(plan.products['synthetic-care-browser'], 'platform');
  assert.equal(plan.products['synthetic-teacher-native'], 'world');
});

test('PATH produces distinct native and browser clients using their registered callbacks', async () => {
  const plan = buildConfigPlan(input(['path-native','path-browser']));
  const desktop = data(plan, 'desktop');
  for (const [id, port] of [['path',43829]]) {
    assert.equal(configuration(desktop, id, 'development').clientKey, id);
    assert.equal(new URL(desktop.clients[id].redirectUri).port, String(port));
  }
  const browser = data(plan, 'browser'), core = await import(pathToFileURL(path.resolve(__dirname, '../../experiences/synk-account/src/core.mjs')));
  const checked = core.readConfig(browser, 'http://127.0.0.1:4280/');
  for (const id of ['path']) {
    assert.equal(checked.clients[id].clientId, 'synthetic-' + id + '-browser');
    assert.notEqual(checked.clients[id].clientId, desktop.clients[id].clientId);
  }
  assert.equal(plan.registered.length, 2);
});

test('dating uses a dedicated browser registration without changing any existing native callback', () => {
  const dating = CLIENTS.filter(item => item.service === 'dating');
  assert.equal(dating.length, 1);
  assert.equal(dating[0].id, 'dating-browser');
  assert.equal(dating[0].product, 'platform');
  assert.deepEqual(dating[0].redirectUris, ['http://127.0.0.1:4300/atlas-lab/dating.html']);
  const native = CLIENTS.filter(item => item.runtime === 'native');
  assert.deepEqual(native.map(item => item.service), ['platform', 'world', 'messenger', 'teacher', 'fortune', 'care', 'path']);
  for (const [index, item] of native.entries()) assert.deepEqual(item.redirectUris, [`http://127.0.0.1:${item.service==='path'?43829:43821 + index}/synk/oauth/${item.service}/callback`]);
});

test('only an observed dating registration adds its isolated platform config and consent entry', async () => {
  const baseline = buildConfigPlan(input());
  assert.equal(baseline.files.length, 3);
  assert.equal(baseline.files.some(file => file.path === OUTPUTS.dating), false);
  const fixture = input(); fixture.clients.push(input(['dating-browser']).clients[0]);
  const plan = buildConfigPlan(fixture), dating = data(plan, 'dating'), browser = data(plan, 'browser');
  assert.equal(plan.files.length, 4);
  assert.deepEqual(Object.keys(dating.clients), ['platform']);
  assert.equal(dating.clients.platform.clientId, 'synthetic-dating-browser');
  assert.equal(dating.clients.platform.redirectUri, 'http://127.0.0.1:4300/atlas-lab/dating.html');
  assert.deepEqual(data(plan, 'desktop'), data(baseline, 'desktop'));
  assert.deepEqual(browser.clients, data(baseline, 'browser').clients);
  assert.deepEqual(data(plan, 'fortune').clients, data(baseline, 'fortune').clients);
  assert.equal(browser.clients.dating, undefined);
  assert.equal(plan.products['synthetic-dating-browser'], 'platform');
  assert.deepEqual(browser.authorizationClients.at(-1), { product: 'platform', clientId: 'synthetic-dating-browser', redirectUris: ['http://127.0.0.1:4300/atlas-lab/dating.html'] });
  assert.deepEqual(dating.authorizationClients, browser.authorizationClients);
  const core = await import(pathToFileURL(path.resolve(__dirname, '../../experiences/synk-account/src/core.mjs')));
  assert.equal(core.readConfig(dating, 'http://127.0.0.1:4300/atlas-lab/dating.html').clients.platform.clientId, 'synthetic-dating-browser');
  assert.doesNotThrow(() => core.readConfig(browser, 'http://127.0.0.1:4280/'));
  fixture.clients.at(-1).client_id = fixture.clients[0].client_id;
  assert.throws(() => buildConfigPlan(fixture), /중복/);
});

test('only observed legacy IDs are auto-bound; unknown registrations and missing clients stay explicit', () => {
  const fixture = input(['world-legacy', 'tools-legacy']); fixture.clients.forEach(client => delete client.registration);
  fixture.clients.push({ client_id: 'unmapped-real-row', client_type: 'public', redirect_uris: ['https://unmapped.example.test/'] });
  const plan = buildConfigPlan(fixture);
  assert.equal(plan.registered.length, 2); assert.deepEqual(data(plan, 'desktop').clients, {}); assert.deepEqual(data(plan, 'browser').clients, {});
  assert.ok(plan.missing.includes('care-native')); assert.deepEqual(plan.unmapped, ['unmapped-real-row']);
  fixture.bindings = { 'care-native': 'not-present-in-provider-list' }; assert.throws(() => buildConfigPlan(fixture), /실제 등록 목록/);
});

test('secret credentials, shared client identities, wrong callback scopes and revoked rows are rejected', () => {
  for (const key of ['sb_secret_do_not_write', ['header', Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url'), 'signature'].join('.')]) assert.throws(() => buildConfigPlan({ ...input(), supabasePublishableKey: key }), /비밀 키/);
  for (const mutate of [
    value => { value.clients[0].client_type = 'confidential'; },
    value => { value.clients[0].client_secret = 'synthetic-secret'; },
    value => { value.clients[0].revoked = true; },
    value => { value.clients.find(row => row.registration === 'care-native').redirect_uris = CLIENTS.find(row => row.id === 'fortune-native').redirectUris; },
    value => { value.bindings = { 'care-browser': 'synthetic-fortune-browser' }; },
    value => { value.clients.find(row => row.registration === 'care-browser').redirect_uris = ['https://example.test/?access_token=should-not-pass']; },
    value => { value.supabaseUrl = 'https://user:password@example.test'; },
  ]) { const fixture = input(); mutate(fixture); assert.throws(() => buildConfigPlan(fixture)); }
});

test('an explicitly selected browser callback must be present in the registered redirect list', () => {
  const fixture = input(['care-browser']); delete fixture.clients[0].registration;
  fixture.bindings = { 'care-browser': { clientId: 'synthetic-care-browser', redirectUri: 'https://deployed.example.test/care/' } };
  assert.throws(() => buildConfigPlan(fixture), /실제 콜백/);
  fixture.clients[0].redirect_uris.push('https://deployed.example.test/care/');
  assert.equal(data(buildConfigPlan(fixture), 'browser').clients.care.redirectUri, 'https://deployed.example.test/care/');
});

test('dry-run writes nothing; writes are backed up atomically and equivalent files stay unchanged', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-public-config-'));
  try {
    const plan = buildConfigPlan(input());
    const dry = await applyConfigPlan(plan, { root }); assert.ok(dry.every(item => !item.written && item.action === 'create')); assert.deepEqual(await fs.readdir(root), []);
    const written = await applyConfigPlan(plan, { root, write: true }); assert.ok(written.every(item => item.written));
    const unchanged = await applyConfigPlan(plan, { root, write: true }); assert.ok(unchanged.every(item => !item.written && item.action === 'unchanged'));
    const file = path.join(root, OUTPUTS.desktop), original = await fs.readFile(file, 'utf8');
    const changed = input(); changed.supabasePublishableKey = 'sb_publishable_rotated';
    const replaced = await applyConfigPlan(buildConfigPlan(changed), { root, write: true });
    assert.ok(replaced.every(item => item.action === 'replace' && item.backup));
    assert.equal(await fs.readFile(path.join(root, replaced[0].backup), 'utf8'), original);
    assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).supabasePublishableKey, 'sb_publishable_rotated');
    assert.equal((await fs.readdir(path.dirname(file))).some(name => name.includes('.tmp-')), false);
    const unsafe = { ...plan, files: [{ path: '../outside.json', data: {} }] }; await assert.rejects(applyConfigPlan(unsafe, { root, write: true }), /고정된 공개 설정 파일/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('a selected dating output can be written without replacing the three existing app configs', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-dating-config-'));
  try {
    const baseline = buildConfigPlan(input());
    await applyConfigPlan(baseline, { root, write: true });
    const before = await Promise.all(baseline.files.map(file => fs.readFile(path.join(root, file.path), 'utf8')));
    const plan = buildConfigPlan(input(['dating-browser']));
    plan.files = plan.files.filter(file => file.path === OUTPUTS.dating);
    const result = await applyConfigPlan(plan, { root, write: true });
    assert.deepEqual(result, [{ path: OUTPUTS.dating, action: 'create', written: true }]);
    assert.deepEqual(await Promise.all(baseline.files.map(file => fs.readFile(path.join(root, file.path), 'utf8'))), before);
    const saved = JSON.parse(await fs.readFile(path.join(root, OUTPUTS.dating), 'utf8'));
    assert.equal(saved.clients.platform.clientId, 'synthetic-dating-browser');
    await applyConfigPlan(baseline, { root, write: true });
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, OUTPUTS.dating), 'utf8')), saved);
  } finally {
    assert.equal(path.dirname(await fs.realpath(root)), await fs.realpath(os.tmpdir()));
    assert.match(path.basename(root), /^synk-dating-config-/);
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('config generation refuses junctions leading outside the workspace before writing', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-config-link-')), outside = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-config-outside-'));
  try {
    await fs.symlink(outside, path.join(root, 'desktop'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(applyConfigPlan(buildConfigPlan(input()), { root, write: true }), /저장소 밖/);
    assert.deepEqual(await fs.readdir(outside), []);
  } finally { await fs.rm(root, { recursive: true, force: true }); await fs.rm(outside, { recursive: true, force: true }); }
});

test('desktop default config lookup is fixed and explicit overrides cannot silently fall back', () => {
  const root = path.resolve('desktop-fixture'), defaultFile = path.join(root, 'auth-config.json'), override = path.resolve('explicit-public.json');
  const exists = file => [defaultFile, override].includes(file);
  assert.equal(resolveAuthConfigPath([], { root, exists }), defaultFile);
  assert.equal(resolveAuthConfigPath(['--auth-config=explicit-public.json'], { root, exists }), override);
  assert.equal(resolveAuthConfigPath([], { root, exists: () => false }), undefined);
  for (const args of [['--auth-config=missing.json'], ['--auth-config='], ['--auth-config=explicit-public.json', '--auth-config=other.json']]) assert.throws(() => resolveAuthConfigPath(args, { root, exists }));
});

test('HTTPS callback additions retain every native and legacy required callback', () => {
  const value = input(['world-legacy', 'care-native']);
  value.clients.forEach(row => row.redirect_uris.push('https://synk.im/extra/' + row.registration));
  const plan = buildConfigPlan(value);
  assert.deepEqual(data(plan, 'browser').authorizationClients.map(row => row.redirectUris), value.clients.map(row => row.redirect_uris));
  value.clients[1].redirect_uris.shift(); assert.throws(() => buildConfigPlan(value), /필수/);
});

test('native auxiliary HTTPS callbacks cannot be selected as the desktop runtime address', () => {
  const value = input(['care-native']); value.clients[0].redirect_uris.push('https://synk.im/care/callback/');
  value.bindings = { 'care-native': { clientId: value.clients[0].client_id, redirectUri: 'https://synk.im/care/callback/' } };
  assert.throws(() => buildConfigPlan(value), /로컬 콜백/);
  value.bindings['care-native'].redirectUri = value.clients[0].redirect_uris[0];
  assert.equal(configuration(data(buildConfigPlan(value), 'desktop'), 'care', 'development').clientId, value.clients[0].client_id);
});
