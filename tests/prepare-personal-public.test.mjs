import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID, webcrypto } from 'node:crypto';
import vm from 'node:vm';
import { preparePersonalPublic } from '../tools/prepare-personal-public.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = path.join(ROOT, '.tmp', 'personal-public-test-' + randomUUID());
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const config = (product, target = `https://synk.im/${product}/`) => ({ version: 1,
  supabaseUrl: 'https://synthetic-auth.example/', supabasePublishableKey: 'sb_publishable_synthetic_only',
  accountApiUrl: 'https://synthetic-account.example/', portalUrl: 'https://synk.im/id/',
  clients: { [product === 'fortune' ? 'platform' : 'path']: { clientId: 'synthetic-public-' + product, redirectUri: target },
    care: { clientId: 'unrelated-client', redirectUri: 'https://synk.im/care/' } },
  authorizationClients: [{ product: 'world', clientId: 'unrelated-world', redirectUris: ['https://synk.im/world/'] }],
});
let fortune;
before(async () => {
  await fs.mkdir(temporary, { recursive: true });
  fortune = await preparePersonalPublic({ product: 'fortune', out: path.join(temporary, 'fortune'), config: config('fortune') });
});

after(async () => {
  // The fixed fixture is created under this workspace. Never follow a computed path outside it for cleanup.
  const actual = await fs.realpath(temporary);
  assert.ok(actual.startsWith(path.join(await fs.realpath(ROOT), '.tmp') + path.sep));
  await fs.rm(actual, { recursive: true });
});

test('the fortune static graph contains only the selected app, explicit public config, assets and licenses with exact source/output hashes', async () => {
  for (const result of [fortune]) {
    for (const row of result.manifest.sourceFiles) assert.equal(sha(await fs.readFile(path.join(ROOT, row.file))), row.sha256, row.file);
    for (const row of result.manifest.files) {
      const bytes = await fs.readFile(path.join(result.output, row.name));
      assert.equal(bytes.length, row.bytes); assert.equal(sha(bytes), row.sha256, row.name);
      assert.ok(!/(?:^|\/)(?:server|tests?|qa|\.env)(?:[./]|$)/.test(row.name), row.name);
    }
    const publicConfig = JSON.parse(await fs.readFile(path.join(result.output, result.manifest.configFile), 'utf8'));
    const key = result.product === 'fortune' ? 'platform' : 'path';
    assert.deepEqual(Object.keys(publicConfig.clients), [key]);
    assert.deepEqual(publicConfig.authorizationClients, [{ product: 'platform', clientId: 'synthetic-public-' + result.product, redirectUris: [result.targetUrl] }]);
    assert.equal(publicConfig.supabaseUrl, 'https://synthetic-auth.example');
    assert.equal(publicConfig.accountApiUrl, 'https://synthetic-account.example');
    assert.equal(publicConfig.clients[key].redirectUri, result.targetUrl);
    assert.deepEqual(result.manifest.limitations, { registrationVerified: false, realLoginVerified: false, browserVerified: false, deployed: false });
    assert.equal(result.manifest.builder.sha256, sha(await fs.readFile(path.join(ROOT, 'tools/prepare-personal-public.mjs'))));
    // 2026-10-14 시그널 판: 글꼴과 라이선스는 공통 signal/ 묶음에 함께 실린다.
    for (const name of ['SUIT', 'InterTight', 'DMMono']) assert.match(await fs.readFile(path.join(result.output, 'signal/assets/' + name + '-OFL.txt'), 'utf8'), /SIL OPEN FONT LICENSE/i);
  }
  assert.match(await fs.readFile(path.join(fortune.output, 'licenses/lunar-javascript-LICENSE.txt'), 'utf8'), /MIT License/);
  assert.equal(fortune.manifest.files.filter(row => /\.(?:mjs|js)$/.test(row.name)).length, 1);
});

test('HTML/CSS use existing relative assets and versioned self-only script/style entries under a strict public CSP', async () => {
  for (const result of [fortune]) {
    const html = await fs.readFile(path.join(result.output, 'index.html'), 'utf8');
    assert.match(html, /script-src 'self'; style-src 'self';/);
    assert.match(html, /connect-src 'self' https:\/\/synthetic-auth.example https:\/\/synthetic-account.example;/);
    assert.doesNotMatch(html, /unsafe-inline|unsafe-eval|<(?:style|base|iframe)\b|\bstyle=/i);
    for (const [, value] of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
      if (value.startsWith('#')) continue;
      assert.ok(value.startsWith('./'), value);
      const [name, query] = value.slice(2).split('?');
      const bytes = await fs.readFile(path.join(result.output, name));
      if (/\.(mjs|css)$/.test(name)) assert.equal(query, 'v=' + sha(bytes));
    }
    for (const row of result.manifest.files.filter(row => row.name.endsWith('.css'))) {
      const css = await fs.readFile(path.join(result.output, row.name), 'utf8');
      for (const [, value] of css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)) {
        assert.ok(value.startsWith('./'), value); await fs.access(path.join(result.output, path.posix.dirname(row.name), value.slice(2)));
      }
    }
  }
});

test('exact HTTPS directory callbacks reject host/path drift, query/hash, loopback, credentials and normalized traversal before output', async () => {
  for (const target of ['http://synk.im/fortune/', 'https://localhost/fortune/', 'https://user@synk.im/fortune/', 'https://synk.im/fortune/?next=x', 'https://synk.im/fortune/#x', 'https://synk.im/a/../fortune/', 'https://synk.im//fortune/', 'https://synk.im/fortune/index.html']) {
    const out = path.join(temporary, 'bad-' + randomUUID());
    await assert.rejects(preparePersonalPublic({ product: 'fortune', out, config: config('fortune', target), targetUrl: target }), /exact HTTPS/);
    await assert.rejects(fs.access(out), /ENOENT/);
  }
  for (const target of ['https://elsewhere.example/fortune/', 'https://synk.im/try/fortune/'])
    await assert.rejects(preparePersonalPublic({ product: 'fortune', out: path.join(temporary, 'mismatch-' + randomUUID()), config: config('fortune'), targetUrl: target }), /exact public callback/);
});

test('secret keys, non-public endpoints and wrong product clients fail before creating artifacts', async () => {
  const invalid = [
    { ...config('fortune'), supabasePublishableKey: 'sb_secret_private' },
    { ...config('fortune'), supabasePublishableKey: 'not-a-public-key' },
    { ...config('fortune'), supabasePublishableKey: 'e30.' + Buffer.from('{"role":"service_role"}').toString('base64url') + '.signature' },
    { ...config('fortune'), accountApiUrl: 'http://localhost:4242/' },
    { ...config('fortune'), portalUrl: 'https://synk.im/id/?token=private' },
    { ...config('fortune'), clientSecret: 'never-copy' },
    config('path'),
  ];
  for (const value of invalid) {
    const out = path.join(temporary, 'invalid-' + randomUUID());
    await assert.rejects(preparePersonalPublic({ product: 'fortune', out, config: value }));
    await assert.rejects(fs.access(out), /ENOENT/);
  }
});

test('travel produces only its isolated account config and manifest for the existing travel builder', async () => {
  const target = 'https://synk.im/try/travel/', value = config('path');
  value.clients['path-travel'] = { clientId: 'synthetic-travel-public', redirectUri: target };
  value.clients.path = { clientId: 'synthetic-vr-keep', redirectUri: 'https://synk.im/path/' };
  const result = await preparePersonalPublic({ product: 'path-travel', out: path.join(temporary, 'travel-config'), config: value });
  assert.deepEqual((await fs.readdir(result.output)).sort(), ['build-manifest.json', 'config.json']);
  const publicConfig = JSON.parse(await fs.readFile(path.join(result.output, 'config.json'), 'utf8'));
  assert.deepEqual(publicConfig.clients, { 'path-travel': { clientId: 'synthetic-travel-public', redirectUri: target } });
  assert.deepEqual(publicConfig.authorizationClients, [{ product: 'platform', clientId: 'synthetic-travel-public', redirectUris: [target] }]);
  assert.equal(result.manifest.artifact, 'account-config-only'); assert.equal(result.manifest.limitations.appBuilt, false);
  assert.equal(result.manifest.limitations.registrationVerified, false); assert.equal(result.manifest.limitations.deployed, false);
  assert.equal(sha(await fs.readFile(path.join(result.output, 'config.json'))), result.manifest.files[0].sha256);
  const reused = structuredClone(value); reused.clients.path.clientId = reused.clients['path-travel'].clientId;
  await assert.rejects(preparePersonalPublic({ product: 'path-travel', out: path.join(temporary, randomUUID()), config: reused }), /own client identity/);
  for (const wrong of ['https://synk.im/path/', 'https://synk.im/travel/', 'https://elsewhere.example/try/travel/']) {
    const changed = structuredClone(value); changed.clients['path-travel'].redirectUri = wrong;
    await assert.rejects(preparePersonalPublic({ product: 'path-travel', out: path.join(temporary, randomUUID()), config: changed, targetUrl: wrong }), /exact public callback/);
  }
  delete value.clients['path-travel'];
  await assert.rejects(preparePersonalPublic({ product: 'path-travel', out: path.join(temporary, randomUUID()), config: value }), /product client/);
});

test('existing directories, workspace outputs and symlink/junction destinations are refused without overwriting anything', async () => {
  await assert.rejects(preparePersonalPublic({ product: 'fortune', out: fortune.output, config: config('fortune') }), /already exists/);
  await assert.rejects(preparePersonalPublic({ product: 'fortune', out: path.join(ROOT, 'never-created-public'), config: config('fortune') }), /inside the workspace .tmp/);
  const destination = path.join(temporary, 'link-target'), link = path.join(temporary, 'linked');
  await fs.mkdir(destination); await fs.symlink(destination, link, process.platform === 'win32' ? 'junction' : 'dir');
  try { await assert.rejects(preparePersonalPublic({ product: 'fortune', out: path.join(link, 'output'), config: config('fortune') }), /directory link/); }
  finally { await fs.unlink(link); }
  assert.deepEqual(await fs.readdir(destination), []);
  assert.equal(sha(await fs.readFile(path.join(fortune.output, 'index.html'))), fortune.manifest.files.find(row => row.name === 'index.html').sha256);
});

async function fixtureSources(name, change) {
  const root = path.join(temporary, name);
  for (const row of fortune.manifest.sourceFiles) {
    const target = path.join(root, row.file); await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(path.join(ROOT, row.file), target);
  }
  await change(root);
  return root;
}

test('new inline styling, undeclared asset URLs and arbitrary source imports stop the build instead of widening the public allowlist', async () => {
  for (const mode of ['style', 'asset', 'module', 'json']) {
    const root = await fixtureSources('fixture-' + mode, async root => {
      const module = ['module', 'json'].includes(mode);
      const file = path.join(root, 'experiences/daily-fortune/' + (module ? 'app.mjs' : mode === 'asset' ? 'app.css' : 'index.html'));
      const text = await fs.readFile(file, 'utf8');
      await fs.writeFile(file, module ? `import privateValue from './private.${mode === 'json' ? 'json' : 'mjs'}';\nglobalThis.privateValue=privateValue;\n` + text : mode === 'asset' ? text + '\n.bad{background:url(https://external.example/tracker.png)}' : text.replace(/<body\b/, '<body style="color:red"'));
      if (mode === 'module') await fs.writeFile(path.join(root, 'experiences/daily-fortune/private.mjs'), 'globalThis.privateValue="must-not-ship";');
      if (mode === 'json') await fs.writeFile(path.join(root, 'experiences/daily-fortune/private.json'), '{"doNotCopy":"private"}');
    });
    const out = path.join(root, '.tmp', 'candidate');
    await assert.rejects(preparePersonalPublic({ product: 'fortune', out, root, config: config('fortune') }), /inline content|non-local public asset|public source allowlist/);
    await assert.rejects(fs.access(out), /ENOENT/);
  }
});
