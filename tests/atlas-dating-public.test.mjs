import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { DATING_PUBLIC_FILES, datingPublicTarget, datingRequestPath, resolveDatingPublicTarget } from '../experiences/atlas-lab/dating-public.mjs';
import { createServer, targetFor } from '../experiences/learning-hub/server.mjs';

async function host(t, options = {}) {
  const server = createServer({ datingOnly: true, ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}
function rawRequest(origin, rawPath, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request(origin, { path: rawPath, method }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString(), headers: res.headers }));
    }); req.on('error', reject); req.end();
  });
}

test('standalone dating files are an exact closed browser dependency graph', async () => {
  const queue = ['/atlas-lab/dating.html'], visited = new Set();
  while (queue.length) {
    const route = queue.shift(); if (visited.has(route)) continue; visited.add(route);
    const file = await resolveDatingPublicTarget(route); assert.ok(file, `Missing reviewed browser dependency: ${route}`);
    if (!/\.(?:m?js|html|css)$/.test(route)) continue;
    const source = await fs.readFile(file, 'utf8'), references = [];
    if (/\.m?js$/.test(route)) {
      for (const match of source.matchAll(/^\s*(?:import|export)\s+(?:[^;\n]*?\sfrom\s*)?["']([^"']+)["']/gm)) references.push(match[1]);
      assert.doesNotMatch(source, /\bimport\s*\(/, `Review dynamic imports in ${route} before publishing`);
    }
    for (const match of source.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)) if (/\.(?:m?js|css|html|png|webp|svg|woff2)(?:[?#]|$)/.test(match[1])) references.push(match[1]);
    for (const match of source.matchAll(/url\(\s*["']?([^)'"\s]+)["']?\s*\)/g)) references.push(match[1]);
    for (const ref of references) {
      assert.ok(ref.startsWith('.') || ref.startsWith('/'), `Nonlocal browser dependency: ${ref}`);
      const next = new URL(ref, `https://dating.invalid${route}`).pathname;
      assert.ok(DATING_PUBLIC_FILES.includes(next), `${route} depends on unreviewed ${next}`); queue.push(next);
    }
  }
  assert.deepEqual([...visited].sort(), [...DATING_PUBLIC_FILES].sort(), 'No unneeded files are published');
});

test('raw traversal, encoded paths, aliases and unknown files never map to a dating public file', () => {
  for (const route of DATING_PUBLIC_FILES) assert.ok(targetFor(route, { datingOnly: true }), route);
  for (const route of [
    '/atlas-lab/dating-runtime.mjs', '/atlas-lab/dating-service.mjs', '/atlas-lab/dating-adult.mjs',
    '/atlas-lab/dating-lifecycle.mjs', '/atlas-lab/dating-transport.mjs', '/atlas-lab/dating-public.mjs',
    '/atlas-lab/qa/result.json', '/atlas-lab/database.sqlite', '/atlas-lab/private-config.json',
    '/atlas-lab/.env', '/atlas-lab/unknown.mjs', '/atlas-lab/dating.html.bak',
    '/synk-account/config.json', '/learning-hub/server.mjs', '/atlas-lab/',
    '/consult/core/domain.js', '/synk-account/platform.html',
    '/atlas-lab/../atlas-lab/dating.html', '/atlas-lab/./dating.html',
    '/atlas-lab/%2e%2e/atlas-lab/dating.html', '/atlas-lab/%64ating.html',
    '/atlas-lab%2fdating.html', '/atlas-lab%5cdating.html', '/atlas-lab/%252eenv',
    '/atlas-lab//dating.html', '//atlas-lab/dating.html', '/atlas-lab\\dating.html',
    'https://elsewhere.invalid/atlas-lab/dating.html', '/atlas-lab/dating.html\u0000',
  ]) assert.equal(datingPublicTarget(route), null, route);
  assert.equal(datingRequestPath('/atlas-lab/dating.html?code=opaque%2Bvalue&state=opaque'), '/atlas-lab/dating.html');
});

test('standalone host serves every browser dependency and only its own root and config', async t => {
  const { origin } = await host(t, { datingConfig: { mode: 'account', labAvailable: true } });
  const entry = await fetch(origin, { redirect: 'manual' }); assert.equal(entry.status, 302);
  assert.equal(entry.headers.get('location'), '/atlas-lab/dating.html');
  const config = await (await fetch(`${origin}/api/atlas-dating/config`)).json();
  assert.equal(config.mode, 'account'); assert.equal(config.labAvailable, false);
  for (const route of DATING_PUBLIC_FILES) {
    const response = await fetch(origin + route); assert.equal(response.status, 200, route);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.ok(Number(response.headers.get('content-length')) > 0, route);
    await response.arrayBuffer();
  }
  const head = await fetch(`${origin}/atlas-lab/dating.html`, { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
  const ranged = await fetch(`${origin}/learning-hub/assets/slab-cream-long.webp`, { headers: { Range: 'bytes=0-9' } });
  assert.equal(ranged.status, 206); assert.equal((await ranged.arrayBuffer()).byteLength, 10);
});

test('standalone host does not dispatch unrelated APIs or normalized traversal to a service', async t => {
  const seen = [], service = { async handle(req, res) { seen.push(req.url); if (req.url === '/api/atlas-dating/state') { res.writeHead(200).end('dating'); return true; } return false; }, close() {} };
  const { origin } = await host(t, { datingService: service });
  for (const method of ['GET', 'POST']) for (const route of ['/api/atlas-journey/status', '/api/atlas-journey/create', '/api/other']) {
    assert.equal((await rawRequest(origin, route, method)).status, 404, `${method} ${route}`);
  }
  for (const route of ['/atlas-lab/../atlas-lab/dating.html', '/api/other/../atlas-dating/state', '/api/atlas-dating/%2e%2e/state', '/atlas-lab%2fdating.html', '/atlas-lab/qa/test.json', '/atlas-lab/dating-runtime.mjs', '/synk-account/config.json']) {
    assert.equal((await rawRequest(origin, route)).status, 404, route);
  }
  assert.deepEqual(seen, []);
  assert.equal((await fetch(`${origin}/api/atlas-dating/state`)).status, 200);
  assert.deepEqual(seen, ['/api/atlas-dating/state']);
});

test('request guard runs before public config, files, redirect and service actions', async t => {
  const guarded = []; let serviceCalls = 0;
  const { origin } = await host(t, { requestGuard: async req => { guarded.push(req.url); return false; }, datingService: { handle() { serviceCalls++; return false; }, close() {} } });
  for (const route of ['/', '/api/atlas-dating/config', '/atlas-lab/dating.html', '/atlas-lab/dating-ui.mjs', '/api/atlas-dating/state', '/api/atlas-dating/action']) {
    const response = await rawRequest(origin, route, route.endsWith('/action') ? 'POST' : 'GET'); assert.equal(response.status, 403, route);
  }
  assert.equal(guarded.length, 6); assert.equal(serviceCalls, 0);
});

test('request guard can finish a response and accepted requests continue', async t => {
  const { origin } = await host(t, { requestGuard: (req, res) => { if (req.url === '/') { res.writeHead(421).end('wrong host'); return false; } return true; } });
  assert.equal((await rawRequest(origin, '/')).status, 421);
  assert.equal((await rawRequest(origin, '/atlas-lab/dating.html')).status, 200);
});

test('reviewed names cannot publish files through a symlink or junction', async t => {
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-dating-public-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(fixture)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(fixture).startsWith('synk-dating-public-'));
    await fs.rm(fixture, { recursive: true, force: true });
  });
  const normalRoot = path.join(fixture, 'normal'), linkedRoot = path.join(fixture, 'linked'), privateDir = path.join(fixture, 'private');
  await fs.mkdir(path.join(normalRoot, 'atlas-lab'), { recursive: true }); await fs.mkdir(linkedRoot); await fs.mkdir(privateDir);
  await fs.writeFile(path.join(normalRoot, 'atlas-lab', 'dating.html'), 'reviewed');
  await fs.writeFile(path.join(privateDir, 'dating.html'), 'private fixture');
  await fs.symlink(privateDir, path.join(linkedRoot, 'atlas-lab'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.ok(await resolveDatingPublicTarget('/atlas-lab/dating.html', normalRoot));
  assert.equal(await resolveDatingPublicTarget('/atlas-lab/dating.html', linkedRoot), null);
  assert.equal(await resolveDatingPublicTarget('/atlas-lab/dating.css', normalRoot), null);
});

test('development hub retains other product entry points while dating server code stays private', async t => {
  const { origin } = await host(t, { datingOnly: false, datingConfig: { labAvailable: false } });
  const entry = await fetch(origin, { redirect: 'manual' }); assert.equal(entry.headers.get('location'), '/synk-account/platform.html');
  assert.equal((await (await fetch(`${origin}/api/atlas-dating/config`)).json()).labAvailable, true);
  for (const route of ['/learning-hub/', '/atlas-lab/', '/atlas-lab/dating.html']) assert.equal((await fetch(origin + route)).status, 200, route);
  for (const name of ['server', 'service', 'store', 'auth', 'runtime', 'lifecycle', 'adult', 'transport', 'public', 'admission', 'shutdown', 'restore']) {
    assert.equal(targetFor(`/atlas-lab/dating-${name}.mjs`), null, name);
    assert.equal((await fetch(`${origin}/atlas-lab/dating-${name}.mjs`)).status, 404, name);
  }
});
