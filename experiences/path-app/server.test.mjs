import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { FONT_FILES, serve, createServer } from './server.mjs';

let server, root, port;
const html = '<!doctype html><html lang="ko"><title>PATH 시험</title><p>준비</p></html>';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'synk-path-server-test-'));
  await Promise.all([
    writeFile(path.join(root, 'index.html'), html),
    writeFile(path.join(root, 'styles.css'), 'body { color: #123; }'),
    ...['app.mjs', 'state.mjs', 'content.mjs'].map(name => writeFile(path.join(root, name), `export const name = '${name}';`)),
    writeFile(path.join(root, '.env'), 'PRIVATE_FIXTURE'),
    writeFile(path.join(root, 'server.mjs'), 'PRIVATE_SERVER_FIXTURE'),
    mkdir(path.join(root, 'assets')),
  ]);
  await writeFile(path.join(root, 'assets', 'unlisted.txt'), 'PRIVATE_ASSET_FIXTURE');
  server = await serve({ port: 0, root });
  port = server.address().port;
});

after(async () => {
  if (server?.listening) {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
  if (root) {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.match(path.basename(root), /^synk-path-server-test-/);
    await rm(root, { recursive: true, force: true });
  }
});

function request(target, { method = 'GET', headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: target, method, headers, agent: false }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.once('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.once('error', reject);
    req.end();
  });
}

test('GET serves the root and index alias with static security headers', async () => {
  assert.equal(server.address().address, '127.0.0.1');
  for (const target of ['/', '/index.html', '/index.html?v=preview']) {
    const result = await request(target);
    assert.equal(result.status, 200);
    assert.equal(result.body.toString(), html);
    assert.equal(result.headers['content-type'], 'text/html; charset=utf-8');
    assert.equal(Number(result.headers['content-length']), Buffer.byteLength(html));
    assert.equal(result.headers['x-content-type-options'], 'nosniff');
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.match(result.headers['content-security-policy'], /connect-src 'none'/);
    assert.match(result.headers['content-security-policy'], /frame-ancestors 'none'/);
    assert.equal(result.headers['access-control-allow-origin'], undefined);
  }
});

test('HEAD returns the GET metadata without a response body', async () => {
  const get = await request('/styles.css');
  const head = await request('/styles.css', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.body.length, 0);
  for (const name of ['content-type', 'content-length', 'content-security-policy', 'x-content-type-options']) assert.equal(head.headers[name], get.headers[name]);
  const missing = await request('/missing.html', { method: 'HEAD' });
  assert.equal(missing.status, 404);
  assert.equal(missing.body.length, 0);
});

test('non-reading methods are rejected with the supported methods', async () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    const result = await request('/index.html', { method });
    assert.equal(result.status, 405, method);
    assert.equal(result.headers.allow, 'GET, HEAD');
    assert.equal(result.headers['x-content-type-options'], 'nosniff');
  }
});

test('only named app modules, fonts and font licenses are served with their MIME types', async () => {
  for (const name of ['app.mjs', 'state.mjs', 'content.mjs']) {
    const result = await request(`/${name}`);
    assert.equal(result.status, 200, name);
    assert.equal(result.headers['content-type'], 'text/javascript; charset=utf-8');
    if (name === 'app.mjs') assert.match(result.body.toString(), /app\.mjs/);
    else assert.equal(result.body.toString(), `export const name = '${name}';`);
  }
  for (const [route, source] of Object.entries(FONT_FILES)) {
    const result = await request(route);
    const expected = await readFile(source);
    assert.equal(result.status, 200, route);
    assert.equal(sha(result.body), sha(expected), route);
    assert.equal(result.headers['content-type'], route.endsWith('.woff2') ? 'font/woff2' : 'text/plain; charset=utf-8');
  }
});

test('private files, dynamic endpoints and raw or encoded traversal are not routable', async () => {
  const targets = [
    '/.env', '/server.mjs', '/server.test.mjs', '/config.json', '/README.md', '/api/health', '/api/account-config',
    '/assets/', '/assets/unlisted.txt', '/styles.CSS', '/app.mjs/extra',
    '/./app.mjs', '/../app.mjs', '/assets/../app.mjs', '/assets/%2e%2e/app.mjs',
    '/%2e/app.mjs', '/%2e%2e/app.mjs', '/%252e%252e/app.mjs', '/assets%2f..%2fapp.mjs',
    '/assets\\..\\app.mjs', '/assets/%5c..%5capp.mjs', '//app.mjs', '/app%2emjs', '/%00', '/%ZZ',
  ];
  for (const target of targets) {
    const result = await request(target);
    assert.equal(result.status, 404, target);
    assert.equal(result.body.toString(), 'Not found\n', target);
    assert.equal(result.headers['x-content-type-options'], 'nosniff');
  }
});

test('an unrelated Host header cannot read the preview', async () => {
  const result = await request('/', { headers: { Host: `example.invalid:${port}` } });
  assert.equal(result.status, 403);
  assert.doesNotMatch(result.body.toString(), /준비/);
});

test('invalid ports fail before opening a listener', async () => {
  for (const invalid of [-1, 65536, 1.5, NaN]) await assert.rejects(serve({ port: invalid, root }), /PATH_APP_PORT/);
});

test('explicit local configuration is projected and its source filename remains private', async () => {
  const config = { version: 1, supabaseUrl: 'https://synthetic-auth.example/', supabasePublishableKey: 'sb_publishable_fixture',
    accountApiUrl: 'https://synthetic-account.example/', portalUrl: 'https://synk.im/id/',
    clients: { 'path-app': { clientId: 'fixture-path', redirectUri: 'http://127.0.0.1:4326/' }, care: { clientId: 'unrelated', redirectUri: 'https://synk.im/care/' } } };
  await writeFile(path.join(root, 'private-config.json'), JSON.stringify(config));
  const configured = createServer({ root, config });
  await new Promise(resolve => configured.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${configured.address().port}`;
    const response = await fetch(base + '/config.json');
    assert.equal(response.status, 200);
    const publicConfig = await response.json();
    assert.deepEqual(Object.keys(publicConfig.clients), ['path-app']);
    assert.equal(publicConfig.clients['path-app'].clientId, 'fixture-path');
    assert.match(response.headers.get('content-security-policy'), /connect-src 'self' https:\/\/synthetic-auth.example https:\/\/synthetic-account.example/);
    assert.equal((await fetch(base + '/private-config.json')).status, 404);
    assert.equal((await fetch(base + '/account.mjs')).status, 404);
    assert.equal((await fetch(base + '/document.mjs')).status, 404);
  } finally { configured.closeAllConnections(); await new Promise(resolve => configured.close(resolve)); }
  await assert.rejects(serve({ root, port: 0, configPath: path.join(root, 'private-config.json') }), /registered port 4326/);
  assert.throws(() => createServer({ root, config: { ...config, supabasePublishableKey: 'sb_secret_should_never_be_served' } }));
});

test('the local entry bundles newly added safe dependencies without exposing arbitrary files', async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'synk-path-server-test-'));
  let preview;
  try {
    await writeFile(path.join(fixture, 'index.html'), html);
    await writeFile(path.join(fixture, 'app.mjs'), "import { marker } from './live-ui.mjs'; globalThis.fixtureMarker = marker;");
    await writeFile(path.join(fixture, 'live-ui.mjs'), "export const marker = 'DEPENDENCY_WAS_BUNDLED';");
    preview = await serve({ root: fixture, port: 0 });
    const base = `http://127.0.0.1:${preview.address().port}`;
    const body = await (await fetch(base + '/app.mjs')).text();
    assert.match(body, /DEPENDENCY_WAS_BUNDLED/); assert.doesNotMatch(body, /import\s+.*from/);
    assert.equal((await fetch(base + '/live-ui.mjs')).status, 404);
  } finally {
    if (preview) { preview.closeAllConnections(); await new Promise(resolve => preview.close(resolve)); }
    assert.equal(path.dirname(path.resolve(fixture)), path.resolve(os.tmpdir()));
    assert.match(path.basename(fixture), /^synk-path-server-test-/);
    await rm(fixture, { recursive: true, force: true });
  }
});
