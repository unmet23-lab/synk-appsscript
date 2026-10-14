import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID, webcrypto } from 'node:crypto';
import vm from 'node:vm';
import { preparePersonalPublic } from '../tools/prepare-personal-public.mjs';
import { BOOK_STYLES, createBook } from '../experiences/conversation-rehearsal/book.mjs';
import { createSession, appendTurn } from '../experiences/conversation-rehearsal/domain.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = path.join(ROOT, '.tmp', 'personal-public-test-' + randomUUID());
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const config = (product, target = `https://synk.im/${product}/`) => ({ version: 1,
  supabaseUrl: 'https://synthetic-auth.example/', supabasePublishableKey: 'sb_publishable_synthetic_only',
  accountApiUrl: 'https://synthetic-account.example/', portalUrl: 'https://synk.im/id/',
  clients: { [product === 'fortune' ? 'platform' : 'rehearsal']: { clientId: 'synthetic-public-' + product, redirectUri: target },
    care: { clientId: 'unrelated-client', redirectUri: 'https://synk.im/care/' } },
  authorizationClients: [{ product: 'world', clientId: 'unrelated-world', redirectUris: ['https://synk.im/world/'] }],
});
// 앨범 묶음은 모듈 최상위 await를 쓴다. 고전 스크립트 vm에서는 async 함수로 감싸 돌리고, 끌어올려진 계정 연결 함수만 꺼내 둔다.
const runModuleBundle = (bundle, context) => vm.runInContext(`(async () => {\nglobalThis.createProductAccount = createProductAccount;\n${bundle}\n})()`, context);
const albumConfig = () => {
  const value = config('rehearsal', 'https://synk.im/album/');
  value.clients = { 'family-album': { clientId: 'synthetic-public-album', redirectUri: 'https://synk.im/album/' }, care: value.clients.care };
  return value;
};
let fortune, rehearsal, album;
before(async () => {
  await fs.mkdir(temporary, { recursive: true });
  fortune = await preparePersonalPublic({ product: 'fortune', out: path.join(temporary, 'fortune'), config: config('fortune') });
  rehearsal = await preparePersonalPublic({ product: 'rehearsal', out: path.join(temporary, 'rehearsal'), config: config('rehearsal') });
  album = await preparePersonalPublic({ product: 'album', out: path.join(temporary, 'album'), config: albumConfig() });
});

test('album publishes one bundled module with Core globals, its book CSS and a CSP that allows only data: photos and blob:/data: voices', async () => {
  for (const row of album.manifest.sourceFiles) assert.equal(sha(await fs.readFile(path.join(ROOT, row.file))), row.sha256, row.file);
  for (const row of album.manifest.files) {
    const bytes = await fs.readFile(path.join(album.output, row.name));
    assert.equal(sha(bytes), row.sha256, row.name);
    assert.ok(!/(?:^|\/)(?:server|tests?|qa|\.env)(?:[./]|$)/.test(row.name), row.name);
  }
  assert.equal(album.targetUrl, 'https://synk.im/album/');
  assert.equal(album.manifest.files.filter(row => /\.(?:mjs|js)$/.test(row.name)).length, 1);
  const publicConfig = JSON.parse(await fs.readFile(path.join(album.output, 'config.json'), 'utf8'));
  assert.deepEqual(publicConfig.clients, { 'family-album': { clientId: 'synthetic-public-album', redirectUri: 'https://synk.im/album/' } });
  assert.deepEqual(publicConfig.authorizationClients, [{ product: 'platform', clientId: 'synthetic-public-album', redirectUris: ['https://synk.im/album/'] }]);
  const html = await fs.readFile(path.join(album.output, 'index.html'), 'utf8');
  assert.match(html, /img-src 'self' data:; font-src 'self'; connect-src 'self' https:\/\/synthetic-auth.example https:\/\/synthetic-account.example; media-src blob: data:;/);
  assert.doesNotMatch(html, /core\/(?:ask|domain)\.js|unsafe-inline|unsafe-eval|<(?:style|base|iframe)\b|\bstyle=/i);
  for (const [, value] of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
    if (value.startsWith('#')) continue;
    assert.ok(value.startsWith('./'), value); await fs.access(path.join(album.output, value.slice(2).split('?')[0]));
  }
  const { BOOK_CSS } = await import('../experiences/family-album/takehome.mjs');
  assert.equal(await fs.readFile(path.join(album.output, 'takehome.css'), 'utf8'), BOOK_CSS);
  const bundle = await fs.readFile(path.join(album.output, 'app.mjs'), 'utf8');
  assert.doesNotMatch(bundle, /\b(?:import|export)\s+(?:\{|\*|[\w$]+\s+from)|import\s*\(/);
  assert.match(bundle, /configUrl = "\.\/config.json"/);
  assert.ok(!/["'](?:\/api\/account-config|\/synk-account\/src\/|\/member-signal\/)/.test(bundle), 'No runtime requests to local-only config/modules');
  const stop = new Error('Synthetic DOM boundary'), context = vm.createContext({ document: { querySelector() { throw stop; }, querySelectorAll() { throw stop; } }, window: {}, location: { hash: '' },
    localStorage: { getItem: () => null }, TextEncoder, TextDecoder, URL, console, crypto: webcrypto });
  await assert.rejects(runModuleBundle(bundle, context), error => error === stop);
  assert.equal(typeof context.SynkAsk.choose, 'function');
  assert.equal(typeof context.SynkAtlasDomain, 'object');
});
after(async () => {
  // The fixed fixture is created under this workspace. Never follow a computed path outside it for cleanup.
  const actual = await fs.realpath(temporary);
  assert.ok(actual.startsWith(path.join(await fs.realpath(ROOT), '.tmp') + path.sep));
  await fs.rm(actual, { recursive: true });
});

test('both static graphs contain only the selected app, explicit public config, assets and licenses with exact source/output hashes', async () => {
  for (const result of [fortune, rehearsal]) {
    for (const row of result.manifest.sourceFiles) assert.equal(sha(await fs.readFile(path.join(ROOT, row.file))), row.sha256, row.file);
    for (const row of result.manifest.files) {
      const bytes = await fs.readFile(path.join(result.output, row.name));
      assert.equal(bytes.length, row.bytes); assert.equal(sha(bytes), row.sha256, row.name);
      assert.ok(!/(?:^|\/)(?:server|tests?|qa|\.env)(?:[./]|$)/.test(row.name), row.name);
    }
    const publicConfig = JSON.parse(await fs.readFile(path.join(result.output, result.manifest.configFile), 'utf8'));
    const key = result.product === 'fortune' ? 'platform' : 'rehearsal';
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
  assert.equal(rehearsal.manifest.files.filter(row => /\.(?:mjs|js)$/.test(row.name)).length, 1);
});

test('HTML/CSS use existing relative assets and versioned self-only script/style entries under a strict public CSP', async () => {
  for (const result of [fortune, rehearsal]) {
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

test('rehearsal bundle preserves Core Ask execution and changes only its built account-config default', async () => {
  const bundle = await fs.readFile(path.join(rehearsal.output, 'app.mjs'), 'utf8');
  assert.doesNotMatch(bundle, /\b(?:import|export)\s+(?:\{|\*|[\w$]+\s+from)|import\s*\(/);
  assert.match(bundle, /configUrl = "\.\/config.json"/);
  assert.ok(!/["'](?:\/api\/account-config|\/synk-account\/src\/account-notebook)/.test(bundle), 'No runtime requests to local-only config/modules');
  assert.match(await fs.readFile(path.join(ROOT, 'experiences/synk-account/src/product-account.mjs'), 'utf8'), /configUrl = '\/api\/account-config'/);
  const stop = new Error('Synthetic DOM boundary'), context = vm.createContext({ document: { querySelector() { throw stop; } }, TextEncoder, TextDecoder, URL, console });
  assert.throws(() => vm.runInContext(bundle, context), error => error === stop);
  assert.equal(context.SynkAsk.VERSION, 'ask-1.1');
  assert.equal(typeof context.SynkAsk.choose, 'function');
});

test('actual bundled account connectors read only their subdirectory config and create an exact public PKCE callback without contacting a provider', async () => {
  for (const result of [fortune, rehearsal, album]) {
    const bundle = await fs.readFile(path.join(result.output, 'app.mjs'), 'utf8');
    const publicConfig = JSON.parse(await fs.readFile(path.join(result.output, result.manifest.configFile), 'utf8'));
    const resource = result.product === 'album' ? 'family-album' : result.product;
    const stop = new Error('Synthetic DOM boundary'), requests = [], redirects = [], saved = new Map();
    const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) };
    const document = { querySelector() { throw stop; }, querySelectorAll() { throw stop; }, getElementById() { throw stop; } };
    const context = vm.createContext({ document, window: {}, TextEncoder, TextDecoder, URL, URLSearchParams, console, AbortController,
      setTimeout, clearTimeout, crypto: webcrypto, btoa, atob, structuredClone, ...(result.product === 'album' ? { location: { hash: '' } } : {}) });
    if (result.product === 'album') await assert.rejects(runModuleBundle(bundle, context), error => error === stop);
    else assert.throws(() => vm.runInContext(bundle, context), error => error === stop);
    const fetcher = async value => {
      const url = new URL(value, result.targetUrl).href; requests.push(url);
      assert.equal(url, result.targetUrl + result.manifest.configFile);
      return { ok: true, json: async () => publicConfig };
    };
    const account = result.product === 'fortune'
      ? context.createFortuneAccount({ storage, fetcher, location: { href: result.targetUrl + 'index.html', assign: url => redirects.push(url) } })
      : context.createProductAccount({ clientKey: resource, endpoint: 'synk-personal', scope: 'synk-personal', resource,
        storage, fetcher, getUrl: () => result.targetUrl + 'index.html', navigate: url => redirects.push(url), validateState: value => value, cryptoAPI: webcrypto });
    try {
      await account.start(); await account.signIn();
      assert.deepEqual(requests, [result.targetUrl + result.manifest.configFile]);
      assert.equal(redirects.length, 1);
      const login = new URL(redirects[0]);
      assert.equal(login.origin, 'https://synthetic-auth.example');
      assert.equal(login.pathname, '/auth/v1/oauth/authorize');
      assert.equal(login.searchParams.get('redirect_uri'), result.targetUrl);
      assert.equal(login.searchParams.get('client_id'), 'synthetic-public-' + result.product);
      assert.equal(login.searchParams.get('code_challenge_method'), 'S256');
      assert.ok(login.searchParams.get('code_challenge').length > 40);
      assert.equal(saved.size, 1); // One local PKCE transaction, no account/session data.
    } finally { account.dispose(); }
  }
});

test('rehearsal page uses external canonical book CSS while the downloaded book keeps its isolated styles and original text', async () => {
  assert.equal(await fs.readFile(path.join(rehearsal.output, 'book.css'), 'utf8'), BOOK_STYLES);
  let session = createSession({ scenario: 'refusal', counterpart: '합성 동료', goal: '내 범위 말하기', id: 'synthetic-book' });
  for (let i = 0; i < 3; i++) session = appendTurn(session, { answer: '원문 <script>는 실행하지 않아요.\n' + i, review: 'easy', focus: 'pressure' });
  const book = createBook([session]);
  assert.match(book, /원문 &lt;script&gt;는 실행하지 않아요/);
  assert.match(book, /script-src 'none'; style-src 'unsafe-inline'/);
  assert.ok(book.includes(BOOK_STYLES));
  assert.match(book, /SIL OPEN FONT LICENSE/);
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
    config('rehearsal'),
  ];
  for (const value of invalid) {
    const out = path.join(temporary, 'invalid-' + randomUUID());
    await assert.rejects(preparePersonalPublic({ product: 'fortune', out, config: value }));
    await assert.rejects(fs.access(out), /ENOENT/);
  }
});

test('travel produces only its isolated account config and manifest for the existing travel builder', async () => {
  const target = 'https://synk.im/try/travel/', value = config('rehearsal');
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
  for (const row of rehearsal.manifest.sourceFiles) {
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
      const file = path.join(root, 'experiences/conversation-rehearsal/' + (module ? 'app.mjs' : mode === 'asset' ? 'app.css' : 'index.html'));
      const text = await fs.readFile(file, 'utf8');
      await fs.writeFile(file, module ? `import privateValue from './private.${mode === 'json' ? 'json' : 'mjs'}';\nglobalThis.privateValue=privateValue;\n` + text : mode === 'asset' ? text + '\n.bad{background:url(https://external.example/tracker.png)}' : text.replace(/<body\b/, '<body style="color:red"'));
      if (mode === 'module') await fs.writeFile(path.join(root, 'experiences/conversation-rehearsal/private.mjs'), 'globalThis.privateValue="must-not-ship";');
      if (mode === 'json') await fs.writeFile(path.join(root, 'experiences/conversation-rehearsal/private.json'), '{"doNotCopy":"private"}');
    });
    const out = path.join(root, '.tmp', 'candidate');
    await assert.rejects(preparePersonalPublic({ product: 'rehearsal', out, root, config: config('rehearsal') }), /inline content|non-local public asset|public source allowlist/);
    await assert.rejects(fs.access(out), /ENOENT/);
  }
});
