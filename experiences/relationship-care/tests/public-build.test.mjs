import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { prepareCarePublic } from '../../../tools/prepare-care-public.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'), targetUrl = 'https://care.example.test/care/';
const config = { version: 1, supabaseUrl: 'https://auth.example.test', accountApiUrl: 'https://api.example.test',
  supabasePublishableKey: 'sb_publishable_fixture', portalUrl: 'https://id.example.test/',
  clients: { care: { clientId: 'fixture-public-care', redirectUri: targetUrl }, path: { clientId: 'unrelated', redirectUri: 'http://127.0.0.1:4292/' } } };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function readImportMap(html) {
  const match = html.match(/<script type="importmap">([^<]+)<\/script>/);
  assert.ok(match, 'the public entry contains an inline import map');
  return { text: match[1], imports: JSON.parse(match[1]).imports, offset: match.index };
}
async function fixture(t) {
  const parent = path.join(root, '.tmp'); await fs.mkdir(parent, { recursive: true });
  const temp = await fs.mkdtemp(path.join(parent, 'care-public-tests-'));
  t.after(async () => { if (path.dirname(temp) !== parent || !path.basename(temp).startsWith('care-public-tests-')) throw Error('Unsafe test directory'); await fs.rm(temp, { recursive: true, force: true }); });
  return temp;
}

test('fixed public artifact preserves brand assets and keeps all imports under its subpath', async t => {
  const temp = await fixture(t), result = await prepareCarePublic({ root, targetUrl, config, out: path.join(temp, 'build') });
  assert.equal(result.fileCount, 80);
  const html = await fs.readFile(path.join(result.output, 'index.html'), 'utf8');
  assert.match(html, /name="synk-care-runtime" content="public-web"/); assert.match(html, /name="referrer" content="no-referrer"/);
  assert.match(html, /connect-src 'self' https:\/\/auth.example.test https:\/\/api.example.test/);
  assert.match(html, /worker-src 'self'; manifest-src 'self'/);
  assert.equal(JSON.parse(await fs.readFile(path.join(result.output, 'manifest.webmanifest'), 'utf8')).display, 'standalone');
  assert.match(await fs.readFile(path.join(result.output, 'care-sw.js'), 'utf8'), /notificationclick/);
  assert.match(await fs.readFile(path.join(result.output, 'account.mjs'), 'utf8'), /\.\/vendor\/account\/product-account.mjs/);
  assert.match(await fs.readFile(path.join(result.output, 'care-planner.mjs'), 'utf8'), /\.\/vendor\/atlas\/domain.js/);
  assert.match(await fs.readFile(path.join(result.output, 'care-focus.mjs'), 'utf8'), /\.\/vendor\/atlas\/domain.js/);
  assert.match(await fs.readFile(path.join(result.output, 'app.mjs'), 'utf8'), /\.\/care-account-view.mjs/);
  assert.match(await fs.readFile(path.join(result.output, 'app.mjs'), 'utf8'), /\.\/care-contact-import.mjs/);
  assert.match(await fs.readFile(path.join(result.output, 'care-contact-import.mjs'), 'utf8'), /addSelectedContacts/);
  const pub = JSON.parse(await fs.readFile(path.join(result.output, 'config.json'), 'utf8'));
  assert.deepEqual(Object.keys(pub.clients), ['care']); assert.equal(pub.clients.care.redirectUri, targetUrl); assert.equal(pub.authorizationClients[0].product, 'platform');
  for (const entry of result.manifest.files) {
    assert.equal(/(?:server|tests|qa|user|\.env|oauth-return)/.test(entry.name), false, entry.name);
    const bytes = await fs.readFile(path.join(result.output, entry.name));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
  }
  for (const source of result.manifest.sourceFiles) assert.equal(sha(await fs.readFile(path.join(root, source.file))), source.sha256, source.file);
  await assert.rejects(prepareCarePublic({ root, targetUrl, config, out: result.output }), /already exists/);
});

test('public build rejects private config, a mismatched callback and paths outside new workspace output', async t => {
  const temp = await fixture(t);
  for (const changed of [{ ...config, supabasePublishableKey: 'sb_secret_never_publish' },
    { ...config, secret: 'not public' }, { ...config, clients: { care: { clientId: 'fixture', redirectUri: 'http://127.0.0.1:4296/' } } }]) {
    await assert.rejects(prepareCarePublic({ root, targetUrl, config: changed, out: path.join(temp, 'invalid') }));
  }
  await assert.rejects(prepareCarePublic({ root, targetUrl, config, out: path.join(root, 'public-unapproved') }), /\.tmp/);
  await assert.rejects(prepareCarePublic({ root, targetUrl: 'http://care.example.test/care/', config, out: path.join(temp, 'insecure') }), /HTTPS/);
  await assert.rejects(prepareCarePublic({ root, targetUrl: targetUrl + '?code=bad', config, out: path.join(temp, 'query') }), /HTTPS/);
  await assert.rejects(fs.stat(path.join(temp, 'invalid')));
});

test('entry, styles and every shipped static or dynamic module resolve to their emitted SHA URLs under the existing CSP', async t => {
  const temp = await fixture(t), result = await prepareCarePublic({ root, targetUrl, config, out: path.join(temp, 'versioned') });
  const html = await fs.readFile(path.join(result.output, 'index.html'), 'utf8');
  const { text, imports, offset } = readImportMap(html);
  const modules = result.manifest.files.filter(entry => /\.(?:mjs|js)$/.test(entry.name));
  assert.deepEqual(Object.keys(imports).sort(), modules.map(entry => './' + entry.name).sort());
  for (const entry of modules) {
    assert.equal(imports['./' + entry.name], './' + entry.name + '?v=' + entry.sha256);
    const url = new URL(imports['./' + entry.name], targetUrl);
    assert.equal(url.origin, new URL(targetUrl).origin);
    assert.equal(url.pathname, new URL(entry.name, targetUrl).pathname);
    assert.equal(url.searchParams.get('v'), sha(await fs.readFile(path.join(result.output, entry.name))));
  }
  const entryTag = html.match(/<script\b(?=[^>]*\btype="module")[^>]*>/);
  assert.ok(entryTag);
  assert.ok(offset < entryTag.index, 'the map is installed before any module graph begins');
  assert.ok(entryTag[0].includes('src="' + imports['./app.mjs'] + '"'));
  const css = result.manifest.files.find(entry => entry.name === 'style.css');
  assert.ok(html.includes('href="./style.css?v=' + css.sha256 + '"'));
  const expectedCspHash = createHash('sha256').update(text).digest('base64');
  assert.ok(html.includes("script-src 'self' 'sha256-" + expectedCspHash + "';"));
  assert.doesNotMatch(html, /unsafe-inline|unsafe-eval/);

  // Relative imports normalize against the importing module's URL without its
  // query. The same global map pins a static dependency and the lazy core import.
  const normalized = new Map(Object.entries(imports).map(([key, value]) => [new URL(key, targetUrl).href, new URL(value, targetUrl).href]));
  for (const [importer, specifier, dependency] of [
    ['app.mjs', './model.mjs', 'model.mjs'],
    ['account.mjs', './vendor/account/product-account.mjs', 'vendor/account/product-account.mjs'],
    ['care-planner.mjs', './vendor/atlas/domain.js', 'vendor/atlas/domain.js'],
    ['care-support.mjs', './care-followup.js', 'care-followup.js'],
    ['vendor/account/product-account.mjs', './core.mjs', 'vendor/account/core.mjs'],
  ]) {
    const importerUrl = new URL(imports['./' + importer], targetUrl);
    assert.equal(normalized.get(new URL(specifier, importerUrl).href), new URL(imports['./' + dependency], targetUrl).href);
  }
  assert.match(await fs.readFile(path.join(result.output, 'vendor/account/product-account.mjs'), 'utf8'), /import\('\.\/core\.mjs'\)/);
  assert.equal(result.fileCount, 80);
  assert.equal(result.manifest.files.find(entry => entry.name === 'index.html').sha256, sha(html));
});

test('changing a dependency or stylesheet changes its public URL and the HTML hash without editing the entry module', async t => {
  const temp = await fixture(t), initial = await prepareCarePublic({ root, targetUrl, config, out: path.join(temp, 'initial') });
  const sourceRoot = path.join(temp, 'isolated-source');
  // Change only a disposable copy of the fixed allowlisted source inventory.
  for (const source of initial.manifest.sourceFiles) {
    const copied = path.join(sourceRoot, source.file);
    await fs.mkdir(path.dirname(copied), { recursive: true });
    await fs.copyFile(path.join(root, source.file), copied);
  }
  await fs.appendFile(path.join(sourceRoot, 'experiences/relationship-care/model.mjs'), '\n// isolated dependency cache regression\n');
  await fs.appendFile(path.join(sourceRoot, 'experiences/relationship-care/style.css'), '\n/* isolated stylesheet cache regression */\n');
  const changed = await prepareCarePublic({ root: sourceRoot, targetUrl, config, out: path.join(sourceRoot, '.tmp/changed') });
  const firstHtml = await fs.readFile(path.join(initial.output, 'index.html'), 'utf8');
  const nextHtml = await fs.readFile(path.join(changed.output, 'index.html'), 'utf8');
  const firstMap = readImportMap(firstHtml).imports, nextMap = readImportMap(nextHtml).imports;
  assert.notEqual(nextMap['./model.mjs'], firstMap['./model.mjs']);
  assert.equal(nextMap['./app.mjs'], firstMap['./app.mjs'], 'unchanged entry bytes can keep their cache because imports resolve through the new HTML map');
  assert.equal(await fs.readFile(path.join(changed.output, 'app.mjs'), 'utf8'), await fs.readFile(path.join(initial.output, 'app.mjs'), 'utf8'));
  assert.notEqual(nextHtml.match(/href="(\.\/style\.css\?v=[^"]+)"/)[1], firstHtml.match(/href="(\.\/style\.css\?v=[^"]+)"/)[1]);
  assert.notEqual(changed.manifest.files.find(entry => entry.name === 'index.html').sha256, initial.manifest.files.find(entry => entry.name === 'index.html').sha256);
  for (const entry of changed.manifest.files) assert.equal(entry.sha256, sha(await fs.readFile(path.join(changed.output, entry.name))), entry.name);
  for (const source of changed.manifest.sourceFiles) assert.equal(source.sha256, sha(await fs.readFile(path.join(sourceRoot, source.file))), source.file);
  assert.equal(changed.fileCount, 80);
});
