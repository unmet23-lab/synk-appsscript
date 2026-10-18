import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { request } from 'node:http';
import { createHash } from 'node:crypto';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { createCompanyApp } from './server.mjs';
import { createStaticResponder } from './static-response.mjs';
import { createMessenger } from '../../../../../tools/company-messenger/server.mjs';

const publicDir = fileURLToPath(new URL('../../../../../tools/company-messenger/public/', import.meta.url));
const localDrive = { active: async () => null, status: async () => ({ provider: 'local', connections: [] }) };
async function fixture(t, make) {
  const directory = await mkdtemp(join(tmpdir(), 'synk-messenger-static-'));
  let close;
  t.after(async () => {
    await close?.();
    assert.ok(resolve(directory).startsWith(resolve(join(tmpdir(), 'synk-messenger-static-'))));
    await rm(directory, { recursive: true, force: true });
  });
  const result = await make(directory);
  close = result.close;
  return result;
}
const companyFixture = t => fixture(t, async directory => {
  const app = createCompanyApp({ dataDir: directory, port: 0, allowTestHost: true, schedule: false, messengerDriveStorage: localDrive, synkIdentityConfig: null });
  const address = await app.start();
  return { base: `http://127.0.0.1:${address.port}`, close: () => app.stop() };
});
function wire(base, path, { headers = {}, method = 'GET' } = {}) {
  return new Promise((resolve, reject) => {
    const outgoing = request(new URL(path, base), { method, headers, agent: false }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
    });
    outgoing.setTimeout(5000, () => outgoing.destroy(new Error('Static response timed out')));
    outgoing.on('error', reject);
    outgoing.end();
  });
}

test('embedded messenger JS and CSS use compressed public responses with unchanged decoded bytes and security headers', async t => {
  const fx = await companyFixture(t);
  for (const file of ['app.js', 'styles.css', 'messenger-design.css', 'signal.css']) {
    const expected = await readFile(join(publicDir, file));
    const response = await wire(fx.base, `/messenger/${file}`, { headers: { 'Accept-Encoding': 'br, gzip' } });
    assert.equal(response.status, 200, file);
    assert.equal(response.headers['content-encoding'], 'br', file);
    assert.equal(response.headers.vary, 'Accept-Encoding');
    assert.equal(response.headers['cache-control'], 'public, max-age=0, must-revalidate');
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.equal(response.headers['x-frame-options'], 'SAMEORIGIN');
    assert.match(response.headers['content-security-policy'], /frame-ancestors 'self'/);
    assert.equal(Number(response.headers['content-length']), response.body.length);
    assert.ok(response.body.length < expected.length / 2, file);
    assert.deepEqual(brotliDecompressSync(response.body), expected, file);
  }
});

test('messenger reloads validate the selected encoding, HEAD is empty, and excluded encodings are honored', async t => {
  const fx = await companyFixture(t), path = '/messenger/app.js';
  const br = await wire(fx.base, path, { headers: { 'Accept-Encoding': 'br' } });
  const repeat = await wire(fx.base, path, { headers: { 'Accept-Encoding': 'br', 'If-None-Match': br.headers.etag } });
  assert.equal(repeat.status, 304);
  assert.equal(repeat.body.length, 0);
  assert.equal(repeat.headers.etag, br.headers.etag);
  assert.equal(repeat.headers['cache-control'], 'public, max-age=0, must-revalidate');
  const gzip = await wire(fx.base, path, { headers: { 'Accept-Encoding': 'br;q=0, gzip', 'If-None-Match': br.headers.etag } });
  assert.equal(gzip.status, 200);
  assert.equal(gzip.headers['content-encoding'], 'gzip');
  assert.notEqual(gzip.headers.etag, br.headers.etag);
  assert.deepEqual(gunzipSync(gzip.body), await readFile(join(publicDir, 'app.js')));
  const head = await wire(fx.base, path, { method: 'HEAD', headers: { 'Accept-Encoding': 'gzip' } });
  assert.equal(head.status, 200);
  assert.equal(head.body.length, 0);
  assert.equal(head.headers.etag, gzip.headers.etag);
  assert.equal(Number(head.headers['content-length']), gzip.body.length);
  const excluded = await wire(fx.base, path, { headers: { 'Accept-Encoding': 'br;q=0, gzip;q=0, identity;q=0' } });
  assert.equal(excluded.status, 406);
  assert.equal(excluded.headers['cache-control'], 'no-store');
});

test('messenger HTML, API, protected files, errors and other public asset types keep no-store without validators', async t => {
  const fx = await companyFixture(t);
  for (const [path, status] of [
    ['/messenger/', 200], ['/messenger/index.html', 200], ['/messenger/api/health', 200],
    ['/messenger/api/bootstrap', 401], ['/messenger/api/events', 401], ['/messenger/api/files/private-id', 401],
    ['/messenger/missing.css', 404], ['/messenger/assets/synk-ko.svg', 200],
  ]) {
    const response = await wire(fx.base, path, { headers: { 'Accept-Encoding': 'br', 'If-None-Match': '*' } });
    assert.equal(response.status, status, path);
    assert.equal(response.headers['cache-control'], 'no-store', path);
    assert.equal(response.headers.etag, undefined, path);
    assert.equal(response.headers['content-encoding'], undefined, path);
  }
  const denied = await wire(fx.base, '/messenger/app.js', { headers: { 'sec-fetch-site': 'cross-site', 'If-None-Match': '*' } });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers['cache-control'], 'no-store');
  assert.equal(denied.headers.etag, undefined);
});

test('embedded CSS is rewritten before its digest and compression, and changed source cannot reuse a stale validator', async t => {
  const original = '.sample{background:url("/assets/test.svg")}\n'.repeat(32);
  const expected = Buffer.from('.sample{background:url("/messenger/assets/test.svg")}\n'.repeat(32));
  let source;
  const fx = await fixture(t, async directory => {
    source = join(directory, 'source.css');
    await writeFile(source, original);
    // Supply a private test file through the responder boundary; never edit public assets.
    const app = createMessenger({ dataDir: join(directory, 'data'), port: 0, basePath: '/messenger', driveStorage: localDrive, backgroundJobsEnabled: false,
      staticResponderFactory: ({ read }) => createStaticResponder({ read: () => read(source), inspect: (_file, options) => stat(source, options) }),
    });
    const address = await app.listen();
    return { base: address.url, close: () => app.close() };
  });
  const first = await wire(fx.base, '/messenger/styles.css', { headers: { 'Accept-Encoding': 'br' } });
  assert.equal(first.status, 200);
  assert.deepEqual(brotliDecompressSync(first.body), expected);
  assert.equal(first.headers.etag, `"${createHash('sha256').update(expected).digest('base64url')}.br"`);
  assert.notEqual(first.headers.etag, `"${createHash('sha256').update(original).digest('base64url')}.br"`);
  await writeFile(source, original + '.changed{color:blue}\n');
  const changed = await wire(fx.base, '/messenger/styles.css', { headers: { 'Accept-Encoding': 'br', 'If-None-Match': first.headers.etag } });
  assert.equal(changed.status, 200);
  assert.notEqual(changed.headers.etag, first.headers.etag);
  assert.deepEqual(brotliDecompressSync(changed.body), Buffer.concat([expected, Buffer.from('.changed{color:blue}\n')]));
});
