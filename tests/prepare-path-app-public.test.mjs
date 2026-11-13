import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { preparePathAppPublic, validatePathConfig, bundlePathApp, PATH_PUBLIC_URL } from '../tools/prepare-path-app-public.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMP = path.join(ROOT, '.tmp', 'path-public-test-' + randomUUID());
const fixture = path.join(TEMP, 'workspace');
const app = path.join(fixture, 'experiences/path-app');
const account = path.join(fixture, 'experiences/synk-account/src');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const config = () => ({ version: 1, supabaseUrl: 'https://synthetic-auth.example/', supabasePublishableKey: 'sb_publishable_synthetic',
  accountApiUrl: 'https://synthetic-account.example/', portalUrl: 'https://synk.im/id/',
  clients: { 'path-app': { clientId: 'path-app-fixture', redirectUri: PATH_PUBLIC_URL }, path: { clientId: 'unrelated-path', redirectUri: 'https://synk.im/path/' } } });
const output = () => path.join(fixture, '.tmp', 'out-' + randomUUID());
let built;

before(async () => {
  await fs.mkdir(app, { recursive: true }); await fs.mkdir(account, { recursive: true });
  await fs.writeFile(path.join(app, 'app.mjs'), "import { start } from './account.mjs'; import { marker } from './future-ui.mjs'; globalThis.fixture = marker; start();");
  await fs.writeFile(path.join(app, 'account.mjs'), "export { start } from '../synk-account/src/product-account.mjs';");
  await fs.writeFile(path.join(app, 'future-ui.mjs'), "export const marker = 'NEW_DEPENDENCY_INCLUDED';");
  await fs.writeFile(path.join(account, 'product-account.mjs'), "export async function start(){ const core = await import('./core.mjs'); return core.value; }");
  await fs.writeFile(path.join(account, 'core.mjs'), "export const value = 'DYNAMIC_CORE_INCLUDED';");
  await fs.writeFile(path.join(app, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="styles.css"><script type="module" src="app.mjs"></script></head><body><div id="app"></div></body></html>');
  await fs.writeFile(path.join(app, 'styles.css'), "@font-face{font-family:SUIT;src:url('/assets/SUIT-Variable.woff2')} body{color:#123}");
  await fs.writeFile(path.join(app, '.env'), 'DO_NOT_SHIP_SECRET_FIXTURE');
  await fs.writeFile(path.join(app, 'server.mjs'), 'DO_NOT_SHIP_SERVER_FIXTURE');
  for (const name of ['SUIT/SUIT-Variable.woff2', '플랫폼_웹/InterTight-Regular.woff2', 'SUIT/LICENSE_OFL.txt', 'InterTight/OFL.txt', '플랫폼_웹/InterTight-Medium.woff2', '플랫폼_웹/InterTight-SemiBold.woff2', '플랫폼_웹/DMMono-Medium.woff2', 'DM_Mono/OFL.txt']) {
    const target = path.join(fixture, 'docs/브랜드_폰트', name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(path.join(ROOT, 'docs/브랜드_폰트', name), target);
  }
  built = await preparePathAppPublic({ root: fixture, out: output(), config: config() });
});

after(async () => {
  const actual = await fs.realpath(TEMP), workspace = await fs.realpath(ROOT);
  assert.ok(actual.startsWith(path.join(workspace, '.tmp') + path.sep));
  assert.match(path.basename(actual), /^path-public-test-/);
  await fs.rm(actual, { recursive: true, force: true });
});

test('one bundled entry includes newly named app modules and the literal dynamic account core', async () => {
  const js = await fs.readFile(path.join(built.output, 'app.mjs'), 'utf8');
  assert.match(js, /NEW_DEPENDENCY_INCLUDED/); assert.match(js, /DYNAMIC_CORE_INCLUDED/);
  assert.doesNotMatch(js, /\bimport\s*\(/);
  assert.equal(built.manifest.files.filter(file => /\.(?:mjs|js)$/.test(file.name)).length, 1);
  assert.ok(built.manifest.sourceFiles.some(file => file.file.endsWith('/future-ui.mjs')));
  assert.ok(built.manifest.sourceFiles.some(file => file.file.endsWith('/core.mjs')));
  for (const source of built.manifest.sourceFiles) assert.equal(sha(await fs.readFile(path.join(fixture, source.file))), source.sha256);
  for (const file of built.manifest.files) {
    const bytes = await fs.readFile(path.join(built.output, file.name));
    assert.equal(sha(bytes), file.sha256); assert.equal(bytes.length, file.bytes);
    assert.doesNotMatch(file.name, /server|\.env|test/);
  }
  assert.deepEqual(built.manifest.limitations, { registrationVerified: false, realLoginVerified: false, browserVerified: false, deployed: false });
});

test('public config contains only PATH identity and HTML uses fixed CSP and hashed relative entries', async () => {
  const publicConfig = JSON.parse(await fs.readFile(path.join(built.output, 'config.json')));
  assert.deepEqual(Object.keys(publicConfig.clients), ['path-app']);
  assert.equal(publicConfig.clients['path-app'].redirectUri, PATH_PUBLIC_URL);
  assert.deepEqual(publicConfig.authorizationClients, [{ product: 'platform', clientId: 'path-app-fixture', redirectUris: [PATH_PUBLIC_URL] }]);
  const html = await fs.readFile(path.join(built.output, 'index.html'), 'utf8');
  assert.equal([...html.matchAll(/<script\b/g)].length, 1);
  assert.match(html, /script-src 'self'; style-src 'self'/);
  assert.match(html, /connect-src 'self' https:\/\/synthetic-auth.example https:\/\/synthetic-account.example/);
  assert.doesNotMatch(html, /unsafe-inline|unsafe-eval/);
  for (const [, name, hash] of html.matchAll(/(?:src|href)="\.\/([^"?]+)\?v=([a-f0-9]+)"/g)) assert.equal(sha(await fs.readFile(path.join(built.output, name))), hash);
  assert.match(await fs.readFile(path.join(built.output, 'styles.css'), 'utf8'), /url\('\.\/assets\/SUIT-Variable\.woff2'\)/);
  for (const name of ['SUIT-LICENSE.txt', 'InterTight-LICENSE.txt', 'DMMono-LICENSE.txt']) assert.match(await fs.readFile(path.join(built.output, 'assets', name), 'utf8'), /SIL OPEN FONT LICENSE/i);
});

test('wrong callbacks, reused clients and secret configuration are refused before output', async () => {
  const invalid = [];
  for (const target of ['https://synk.im/path/', 'http://127.0.0.1:4326/', 'https://elsewhere.example/path/app/', 'https://synk.im/a/../path/app/', PATH_PUBLIC_URL + '?code=x']) {
    const value = config(); value.clients['path-app'].redirectUri = target; invalid.push({ config: value, targetUrl: target });
  }
  invalid.push({ config: { ...config(), supabasePublishableKey: 'sb_secret_never_publish' } });
  invalid.push({ config: { ...config(), supabasePublishableKey: 'e30.' + Buffer.from('{"role":"service_role"}').toString('base64url') + '.signature' } });
  invalid.push({ config: { ...config(), accountApiUrl: 'https://synthetic-account.example/?token=private' } });
  invalid.push({ config: { ...config(), clientSecret: 'never-copy' } });
  const nested = config(); nested.clients['path-app'].clientSecret = 'never-copy'; invalid.push({ config: nested });
  const reused = config(); reused.clients.path.clientId = reused.clients['path-app'].clientId; invalid.push({ config: reused });
  for (const options of invalid) {
    const out = output();
    await assert.rejects(preparePathAppPublic({ root: fixture, out, ...options }));
    await assert.rejects(fs.access(out), /ENOENT/);
  }
  const local = config(); local.clients['path-app'].redirectUri = 'http://127.0.0.1:4326/';
  assert.equal(validatePathConfig(local, { local: true, targetUrl: 'http://127.0.0.1:4326/' }).clients['path-app'].redirectUri, 'http://127.0.0.1:4326/');
  assert.throws(() => validatePathConfig(local, { local: true, targetUrl: 'http://127.0.0.1:9999/' }));
});

test('existing, traversed, external and linked output directories cannot be overwritten', async () => {
  await assert.rejects(preparePathAppPublic({ root: fixture, out: built.output, config: config() }), /already exists/);
  for (const out of [fixture, path.join(fixture, 'not-tmp'), path.join(fixture, '.tmp', '..', 'escape'), path.join(TEMP, 'outside')])
    await assert.rejects(preparePathAppPublic({ root: fixture, out, config: config() }), /inside the workspace .tmp/);
  const outside = path.join(TEMP, 'linked-target'); await fs.mkdir(outside);
  const link = path.join(fixture, '.tmp', 'link'); await fs.symlink(outside, link, 'junction');
  await assert.rejects(preparePathAppPublic({ root: fixture, out: path.join(link, 'candidate'), config: config() }), /directory link/);
  assert.deepEqual(await fs.readdir(outside), []);
});

test('dependency graph rejects private modules and dependencies outside both allowed source roots', async () => {
  const graph = path.join(TEMP, 'graph'); await fs.mkdir(graph);
  await fs.writeFile(path.join(graph, 'server.mjs'), 'export const value = 1;');
  await fs.writeFile(path.join(TEMP, 'outside.mjs'), 'export const value = 1;');
  for (const dependency of ['./server.mjs', '../outside.mjs']) {
    await fs.writeFile(path.join(graph, 'app.mjs'), `import { value } from '${dependency}'; globalThis.fixture = value;`);
    await assert.rejects(bundlePathApp({ root: fixture, appRoot: graph }), /outside the PATH source allowlist/);
  }
  await fs.writeFile(path.join(graph, 'app.mjs'), 'globalThis.openModule = name => import(name);');
  await assert.rejects(bundlePathApp({ root: fixture, appRoot: graph }), /complete module graph/);
});
