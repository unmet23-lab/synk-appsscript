import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { preparePortal, parseArguments, TARGETS } from './prepare-portal.mjs';

const require = createRequire(import.meta.url);
const sourceRoot = path.resolve(process.env.SYNK_PORTAL_TEST_SOURCE_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const { buildConfigPlan, OUTPUTS } = require(path.join(sourceRoot, 'tools/synk-id/public-config.cjs'));
const { CLIENTS, LEGACY_CLIENT_IDS } = require(path.join(sourceRoot, 'tools/synk-id/registry.cjs'));
const core = await import(pathToFileURL(path.join(sourceRoot, 'experiences/synk-account/src/core.mjs')));
const environment = name => ({ EXPO_PUBLIC_SUPABASE_URL: `https://${TARGETS[name].ref}.supabase.co`, EXPO_PUBLIC_SUPABASE_ANON_KEY: `sb_publishable_synthetic_${name}`, EXPO_PUBLIC_SYNK_WORLD_OAUTH_CLIENT_ID: LEGACY_CLIENT_IDS[name].world });

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-portal-prepare-')), root = path.join(directory, 'repository');
  t.after(() => { assert.equal(fs.realpathSync(directory), directory);assert.equal(path.dirname(directory), fs.realpathSync(os.tmpdir()));fs.rmSync(directory, { recursive: true, force: true }); });
  fs.mkdirSync(path.join(root, 'experiences/synk-account'), { recursive: true });
  for (const file of ['index.html', 'style.css', 'src/core.mjs', 'dist/app.js', 'assets/scrapbook.css', 'assets/InterTight-700.woff2', 'assets/SUIT-Variable.woff2', 'assets/badge-check.webp', 'assets/badge-cream.webp', 'assets/slab-coral-long.webp', 'assets/slab-cream-long.webp', 'assets/sticker-book.webp', 'assets/thread-shift.webp']) {
    const destination = path.join(root, 'experiences/synk-account', file);fs.mkdirSync(path.dirname(destination), { recursive: true });fs.copyFileSync(path.join(sourceRoot, 'experiences/synk-account', file), destination);
  }
  fs.mkdirSync(path.join(root, 'experiences/learning-hub'), { recursive: true });
  fs.copyFileSync(path.join(sourceRoot, 'experiences/learning-hub/atlas-learning.js'), path.join(root, 'experiences/learning-hub/atlas-learning.js'));
  const configPath = path.join(directory, 'candidate.json'), currentPath = path.join(directory, 'published.json');
  fs.writeFileSync(configPath, JSON.stringify(generatedConfig())); fs.writeFileSync(currentPath, JSON.stringify(generatedConfig()));
  const options = { root, targetName: 'production', out: path.join(directory, 'output'), loadPublicEnvironment: environment, configPath, currentPath };
  return { directory, root, options };
}
function generatedConfig(name = 'production') {
  const env = environment(name);
  const registrations = ['world-legacy', ...(name === 'production' ? ['tools-legacy'] : []), 'fortune-browser', 'fortune-native'];
  const clients = registrations.map(id => { const registered = CLIENTS.find(client => client.id === id);return { registration: id, client_id: registered.knownIds?.[name] || `synthetic-${id}`, client_type: 'public', redirect_uris: [...registered.redirectUris] }; });
  const plan = buildConfigPlan({ version: 1, environment: name, supabaseUrl: env.EXPO_PUBLIC_SUPABASE_URL, supabasePublishableKey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY, portalUrl: TARGETS[name].portal, clients });
  return plan.files.find(file => file.path === OUTPUTS.browser).data;
}
function saveConfig(directory, config) { const file = path.join(directory, 'registered-public.json');fs.writeFileSync(file, JSON.stringify(config));return file; }

test('explicit generated configuration preserves Fortune browser/native and legacy consent in real output', async t => {
  const { directory, options } = fixture(t), config = generatedConfig();
  const result = await preparePortal({ ...options, configPath: saveConfig(directory, config) });
  const actual = JSON.parse(fs.readFileSync(path.join(result.output, 'config.json')));
  assert.deepEqual(actual.authorizationClients, config.authorizationClients);
  const checked = core.readConfig(actual, TARGETS.production.portal);
  for (const [id, uri] of [['synthetic-fortune-browser', 'http://127.0.0.1:4299/'], ['synthetic-fortune-native', 'http://127.0.0.1:43825/synk/oauth/fortune/callback']]) {
    assert.equal(core.authorizationProduct(id, checked), 'platform');
    assert.equal(core.trustedConsentRedirect(uri + '?code=synthetic&state=synthetic', checked, id), uri + '?code=synthetic&state=synthetic');
  }
  assert.throws(() => core.trustedConsentRedirect('http://127.0.0.1:4296/?code=synthetic', checked, 'synthetic-fortune-browser'));
  const html = fs.readFileSync(path.join(result.output, 'index.html'), 'utf8');
  assert.match(html, /noindex,nofollow/);assert.match(html, /src="\.\/vendor\/atlas-learning.js"/);assert.doesNotMatch(html, /href="\.\/platform.html"/);
  assert.equal(result.files.length, 14);assert.equal(result.clients, 4);
  assert.deepEqual(fs.readFileSync(path.join(result.output, 'dist/app.js')), fs.readFileSync(path.join(options.root, 'experiences/synk-account/dist/app.js')));
});

test('missing current or candidate is rejected; both environments preserve published Fortune registrations', async t => {
  const { directory, options } = fixture(t);
  await assert.rejects(preparePortal({ ...options, currentPath: undefined }), /usage/);
  await assert.rejects(preparePortal({ ...options, configPath: undefined }), /usage/);
  for (const name of ['production', 'rehearsal']) {
    fs.writeFileSync(options.configPath, JSON.stringify(generatedConfig(name))); fs.writeFileSync(options.currentPath, JSON.stringify(generatedConfig(name)));
    const result = await preparePortal({ ...options, targetName: name, out: path.join(directory, name) });
    const actual = JSON.parse(fs.readFileSync(path.join(result.output, 'config.json')));
    assert.equal(result.clients, name === 'production' ? 4 : 3);
    assert.equal(actual.portalUrl, TARGETS[name].portal);assert.equal(actual.supabasePublishableKey, environment(name).EXPO_PUBLIC_SUPABASE_ANON_KEY);
    assert.equal(actual.authorizationClients[0].clientId, LEGACY_CLIENT_IDS[name].world);
    if (name === 'rehearsal') assert.match(fs.readFileSync(path.join(result.output, 'index.html'), 'utf8'), /· 리허설<\/title>/);
  }
});

test('central browser product keys preserve Care using its platform API product', async t => {
  const { directory, options } = fixture(t), config = generatedConfig();
  config.clients.care = { clientId: 'synthetic-care-browser', redirectUri: 'http://127.0.0.1:4296/' };
  config.authorizationClients.push({ product: 'platform', clientId: 'synthetic-care-browser', redirectUris: ['http://127.0.0.1:4296/'] });
  const result = await preparePortal({ ...options, configPath: saveConfig(directory, config) });
  const actual = JSON.parse(fs.readFileSync(path.join(result.output, 'config.json')));
  assert.equal(actual.clients.care, undefined);assert.deepEqual(actual.authorizationClients, config.authorizationClients);
});

test('cross-environment keys/origins/portals and missing or changed legacy registrations fail before output', async t => {
  const { directory, options } = fixture(t);
  const mutations = [
    c => { c.supabaseUrl = environment('rehearsal').EXPO_PUBLIC_SUPABASE_URL; },
    c => { c.supabaseUrl += '.attacker.test'; },
    c => { c.accountApiUrl = 'https://elsewhere.example.test'; },
    c => { c.supabasePublishableKey = environment('rehearsal').EXPO_PUBLIC_SUPABASE_ANON_KEY; },
    c => { c.supabasePublishableKey = 'sb_secret_synthetic'; },
    c => { c.portalUrl = TARGETS.rehearsal.portal; },
    c => { c.authorizationClients.shift(); },
    c => { c.authorizationClients[0].product = 'platform'; },
    c => { c.authorizationClients.push(structuredClone(c.authorizationClients[0])); },
    c => { c.authorizationClients.at(-1).redirectUris.push(c.authorizationClients.at(-1).redirectUris[0]); },
    c => { c.clients.platform = { clientId: 'synthetic-fortune-browser', redirectUri: 'http://127.0.0.1:4296/' }; },
    c => { c.clients.unrecognized = { clientId: '', redirectUri: '' }; },
    c => { c.access_token = 'synthetic'; },
  ];
  for (const mutate of mutations) {
    const config = generatedConfig();mutate(config);
    await assert.rejects(preparePortal({ ...options, configPath: saveConfig(directory, config) }));
    assert.equal(fs.existsSync(options.out), false);
  }
  await assert.rejects(preparePortal({ ...options, loadPublicEnvironment: () => environment('rehearsal') }));
  assert.equal(fs.existsSync(options.out), false);
});

test('existing files and root/source/ancestor targets are preserved without deletion', async t => {
  const { directory, root, options } = fixture(t), source = path.join(root, 'experiences/synk-account');
  const occupied = path.join(directory, 'occupied'), existingFile = path.join(directory, 'existing.txt');
  fs.mkdirSync(occupied);fs.writeFileSync(path.join(occupied, 'keep.txt'), 'keep');fs.writeFileSync(existingFile, 'keep-file');
  for (const out of [root, directory, source, path.join(root, 'experiences'), path.join(source, 'fresh-output'), path.join(root, '.git/fresh-output'), occupied, existingFile]) await assert.rejects(preparePortal({ ...options, out }));
  assert.equal(fs.readFileSync(path.join(occupied, 'keep.txt'), 'utf8'), 'keep');assert.equal(fs.readFileSync(existingFile, 'utf8'), 'keep-file');
  assert.equal(fs.existsSync(path.join(source, 'fresh-output')), false);
  const result = await preparePortal(options), before = fs.readFileSync(path.join(result.output, 'config.json'));
  await assert.rejects(preparePortal(options), /already contains/);assert.deepEqual(fs.readFileSync(path.join(result.output, 'config.json')), before);
});

test('empty output directories are accepted and symbolic output ancestors are refused', async t => {
  const { directory, options } = fixture(t);fs.mkdirSync(options.out);
  await preparePortal(options);
  const elsewhere = path.join(directory, 'elsewhere'), link = path.join(directory, 'linked');fs.mkdirSync(elsewhere);
  fs.symlinkSync(elsewhere, link, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(preparePortal({ ...options, out: path.join(link, 'new') }), /symbolic link or junction/);
  assert.deepEqual(fs.readdirSync(elsewhere), []);
});

test('a missing build artifact fails without leaving a partly prepared output', async t => {
  const { options } = fixture(t);fs.unlinkSync(path.join(options.root, 'experiences/synk-account/dist/app.js'));
  await assert.rejects(preparePortal(options), /ENOENT/);assert.equal(fs.existsSync(options.out), false);
});

test('CLI requires current and candidate configuration and rejects malformed or ambiguous arguments', () => {
  assert.deepEqual(parseArguments(['production', 'output', '--config=public.json', '--current=published.json', '--config-only']), { targetName: 'production', out: 'output', configPath: 'public.json', currentPath: 'published.json', configOnly: true });
  for (const args of [[], ['unknown', 'output'], ['production'], ['production', '--config=public.json'], ['production', 'output', '--config='], ['production', 'output', '--secret=x'], ['production', 'output', '--config=a', '--config=b']]) assert.throws(() => parseArguments(args), /usage/);
});

test('config-only merge preserves every published field and stale candidates cannot remove Fortune or added HTTPS callbacks', async t => {
  const { directory, options } = fixture(t), current = generatedConfig();
  current.learningUrl = 'https://synk.im/keep-learning/'; current.messengerUrl = 'https://synk.im/keep-messenger/';
  current.authorizationClients[0].redirectUris.push('https://synk.im/world/additional-callback/');
  current.authorizationClients.push({ product: 'platform', clientId: 'existing-unrelated-app', redirectUris: ['https://synk.im/unrelated/callback/'] });
  fs.writeFileSync(options.currentPath, JSON.stringify(current));
  const stale = generatedConfig(); stale.authorizationClients = stale.authorizationClients.slice(0, 2);
  stale.clients = {}; stale.learningUrl = 'https://synk.im/candidate-link-must-not-replace/';
  stale.authorizationClients.push({ product: 'platform', clientId: 'synthetic-new-care', redirectUris: ['http://127.0.0.1:4296/'] });
  const result = await preparePortal({ ...options, configPath: saveConfig(directory, stale), configOnly: true });
  const actual = JSON.parse(fs.readFileSync(path.join(result.output, 'config.json')));
  assert.deepEqual(result.files, ['config.json']); assert.deepEqual(fs.readdirSync(result.output), ['config.json']);
  assert.deepEqual({ ...actual, authorizationClients: undefined }, { ...current, authorizationClients: undefined });
  assert.deepEqual(actual.authorizationClients.slice(0, current.authorizationClients.length), current.authorizationClients);
  assert.equal(actual.authorizationClients.at(-1).clientId, 'synthetic-new-care');
});

test('config-only rejects source-only products and native schemes unsupported by the published bundle', async t => {
  const { directory, options } = fixture(t);
  for (const added of [{ product: 'care', clientId: 'synthetic-care-product', redirectUris: ['http://127.0.0.1:4296/'] }, { product: 'platform', clientId: 'synthetic-care-scheme', redirectUris: ['im.synk.care://oauth/callback'] }]) {
    const config = generatedConfig(); config.authorizationClients.push(added);
    await assert.rejects(preparePortal({ ...options, configPath: saveConfig(directory, config), configOnly: true }), /published portal contract/);
    assert.equal(fs.existsSync(options.out), false);
  }
});

test('dating consent joins the published platform contract without changing its app config or existing callbacks', async t => {
  const { directory, options } = fixture(t), current = generatedConfig();
  const env = environment('production'), registration = CLIENTS.find(row => row.id === 'dating-browser');
  const clients = current.authorizationClients.map(client => ({ client_id: client.clientId, client_type: 'public', redirect_uris: client.redirectUris }));
  clients.push({ registration: registration.id, client_id: 'synthetic-dating-browser', client_type: 'public', redirect_uris: [...registration.redirectUris] });
  const plan = buildConfigPlan({ version: 1, environment: 'production', supabaseUrl: env.EXPO_PUBLIC_SUPABASE_URL, supabasePublishableKey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY, portalUrl: TARGETS.production.portal, clients });
  const dedicated = plan.files.find(file => file.path === OUTPUTS.dating).data;
  const result = await preparePortal({ ...options, configPath: saveConfig(directory, dedicated), configOnly: true });
  const actual = JSON.parse(fs.readFileSync(path.join(result.output, 'config.json')));
  assert.deepEqual(result.files, ['config.json']);
  assert.deepEqual({ ...actual, authorizationClients: undefined }, { ...current, authorizationClients: undefined });
  assert.deepEqual(actual.authorizationClients.slice(0, current.authorizationClients.length), current.authorizationClients);
  const checked = core.readConfig(actual, TARGETS.production.portal), redirect = `${registration.redirectUris[0]}?code=synthetic&state=synthetic`;
  assert.equal(core.authorizationProduct('synthetic-dating-browser', checked), 'platform');
  assert.equal(core.trustedConsentRedirect(redirect, checked, 'synthetic-dating-browser'), redirect);
  assert.throws(() => core.trustedConsentRedirect(redirect.replace(':4300/', ':4301/'), checked, 'synthetic-dating-browser'));
});
