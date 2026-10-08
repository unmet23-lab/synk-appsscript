import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createDatingTransport } from '../experiences/atlas-lab/dating-transport.mjs';
import { createDatingService } from '../experiences/atlas-lab/dating-service.mjs';
import { createDatingStore } from '../experiences/atlas-lab/dating-store.mjs';

const ORIGIN = 'https://dating.example.test:8443';
const options = { mode: 'account', publicOrigin: ORIGIN, trustedProxyIPs: ['127.0.0.1'] };
const transport = () => createDatingTransport(options);
function request({ headers = {}, socket = {}, method = 'GET', rawHeaders } = {}) {
  const all = { host: '127.0.0.1:4201', 'x-forwarded-proto': 'https', 'x-forwarded-host': 'dating.example.test:8443', ...headers };
  for (const [key, value] of Object.entries(all)) if (value === undefined) delete all[key];
  return { method, headers: all, rawHeaders: rawHeaders || Object.entries(all).flat(),
    socket: { remoteAddress: '127.0.0.1', localAddress: '127.0.0.1', localPort: 4201, ...socket } };
}
const rejects = (req, code, validator = transport()) => assert.throws(() => validator.assertRequest(req), { status: 403, code });

test('public transport requires account mode, a pure HTTPS origin and an explicit finite exact proxy list', () => {
  for (const publicOrigin of ['', 'http://dating.example.test', 'https://dating.example.test/path', 'https://dating.example.test/?',
    'https://dating.example.test/#', 'https://user@dating.example.test', 'https://dating.example.test\\foo', 'https:///dating.example.test',
    ' https://dating.example.test', 'https://dating.example.test ', 'https://dating.example.test?x=1', null, 123])
    assert.throws(() => createDatingTransport({ ...options, publicOrigin }), TypeError, String(publicOrigin));
  for (const trustedProxyIPs of [undefined, [], ['*'], ['127.0.0.0/8'], ['localhost'], ['0.0.0.0'], ['::'],
    ['::ffff:0.0.0.0'], ['127.0.0.1', '::ffff:127.0.0.1'], ['fe80::1%eth0'], [' 127.0.0.1'], Array(17).fill('127.0.0.1'), '127.0.0.1'])
    assert.throws(() => createDatingTransport({ ...options, trustedProxyIPs }), TypeError);
  assert.throws(() => createDatingTransport({ ...options, mode: 'demo' }), TypeError);
  assert.throws(() => createDatingTransport({ mode: 'account', trustedProxyIPs: [] }), TypeError);
  const config = createDatingTransport({ ...options, publicOrigin: 'https://dating.example.test:443/' });
  assert.equal(config.publicOrigin, 'https://dating.example.test');
  assert.equal(Object.isFrozen(config.trustedProxyIPs), true);
});

test('HTTPS proxy origin supports safe navigation, HEAD and same-origin browser writes', () => {
  const validator = transport();
  for (const req of [request(), request({ method: 'HEAD' }), request({ headers: { origin: ORIGIN, 'sec-fetch-site': 'same-origin' } }),
    request({ method: 'POST', headers: { origin: ORIGIN, 'sec-fetch-site': 'same-origin' } }), request({ headers: { 'sec-fetch-site': 'none' } })])
    assert.doesNotThrow(() => validator.assertRequest(req));
  const fixture = createDatingTransport({ ...options, publicOrigin: 'https://127.0.0.1:5555' });
  assert.doesNotThrow(() => fixture.assertRequest(request({ headers: { 'x-forwarded-host': '127.0.0.1:5555' } })));
});

test('private listener, backend authority and exact proxy peer remain mandatory', () => {
  rejects(request({ socket: { remoteAddress: '192.0.2.1' } }), 'trusted-proxy-required');
  rejects(request({ socket: { localAddress: '192.0.2.1' } }), 'local-host-required');
  for (const host of ['dating.example.test:8443', '127.0.0.1:4202', 'evil.test:4201', '127.0.0.1:4201/path',
    'user@127.0.0.1:4201', '@127.0.0.1:4201', '127.0.0.1:4201#', '127.0.0.1:4201?'])
    rejects(request({ headers: { host } }), 'local-host-required');
  const validator = createDatingTransport({ ...options, trustedProxyIPs: ['192.0.2.1'] });
  rejects(request({ socket: { remoteAddress: '192.0.2.1' } }), 'local-host-required', validator);
});

test('IPv4-mapped IPv6 addresses are normalized for both registration and peer matching', () => {
  const validator = createDatingTransport({ ...options, trustedProxyIPs: ['::ffff:7f00:1'] });
  assert.deepEqual(validator.trustedProxyIPs, ['127.0.0.1']);
  for (const ip of ['127.0.0.1', '::ffff:127.0.0.1', '::ffff:7f00:1'])
    assert.doesNotThrow(() => validator.assertRequest(request({ socket: { remoteAddress: ip, localAddress: ip } })));
  const ipv6 = createDatingTransport({ ...options, trustedProxyIPs: ['0:0:0:0:0:0:0:1'] });
  assert.doesNotThrow(() => ipv6.assertRequest(request({ headers: { host: '[::1]:4201' }, socket: { remoteAddress: '::1', localAddress: '::1' } })));
});

test('forwarded scheme, hostname and explicit port cannot be inferred from other headers', () => {
  for (const [name, value] of [['x-forwarded-proto', 'http'], ['x-forwarded-proto', 'HTTPS'], ['x-forwarded-host', 'evil.test'],
    ['x-forwarded-host', 'dating.example.test'], ['x-forwarded-host', 'dating.example.test:443'],
    ['x-forwarded-host', 'dating.example.test:8443/path'], ['x-forwarded-host', 'dating.example.test:8443?x=1']])
    rejects(request({ headers: { [name]: value } }), 'forwarded-origin-required');
  for (const name of ['x-forwarded-proto', 'x-forwarded-host'])
    rejects(request({ headers: { [name]: undefined } }), 'proxy-headers-invalid');
  rejects(request({ headers: { 'x-forwarded-proto': undefined, forwarded: 'proto=https;host=dating.example.test:8443' } }), 'proxy-headers-invalid');
});

test('raw duplicate, comma-joined, array and mixed forwarding headers are rejected', () => {
  for (const name of ['host', 'x-forwarded-proto', 'x-forwarded-host', 'origin', 'sec-fetch-site']) {
    const req = request({ headers: { origin: ORIGIN, 'sec-fetch-site': 'same-origin' } });
    req.rawHeaders.push(name.toUpperCase(), req.headers[name]);
    rejects(req, 'proxy-headers-invalid');
  }
  for (const name of ['x-forwarded-proto', 'x-forwarded-host', 'origin', 'sec-fetch-site']) {
    for (const value of ['https, https', ['https'], ' https', ''])
      rejects(request({ headers: { [name]: value } }), 'proxy-headers-invalid');
  }
  rejects(request({ headers: { forwarded: 'for=127.0.0.1;proto=https' } }), 'proxy-headers-invalid');
  const req = request(); req.rawHeaders.push('Forwarded', 'proto=https');
  rejects(req, 'proxy-headers-invalid');
});

test('cross-site and same-site browser traffic, missing mutation origin and sibling origins are rejected', () => {
  for (const value of ['same-site', 'cross-site', 'null', 'Same-Origin'])
    rejects(request({ headers: { 'sec-fetch-site': value, origin: ORIGIN } }), 'cross-site-request');
  for (const origin of ['https://sibling.example.test:8443', 'http://dating.example.test:8443', 'https://dating.example.test', ORIGIN + '/', ORIGIN + '?q=1', 'null'])
    rejects(request({ method: 'POST', headers: { origin } }), 'origin-required');
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) rejects(request({ method }), 'origin-required');
  rejects(request({ headers: { origin: 'http://127.0.0.1:4201' } }), 'origin-required');
});

test('the public OAuth callback permits cross-site GET navigation without relaxing authenticated API origins', () => {
  const validator = transport(), callback = request({ headers: { 'sec-fetch-site': 'cross-site' } });
  assert.doesNotThrow(() => validator.assertRequest(callback, { publicResource: true }));
  assert.doesNotThrow(() => validator.assertRequest(request({ method: 'HEAD', headers: { 'sec-fetch-site': 'cross-site' } }), { publicResource: true }));
  rejects(callback, 'cross-site-request', validator);
  const otherOrigin = request({ headers: { origin: 'https://identity.example.test', 'sec-fetch-site': 'cross-site' } });
  assert.doesNotThrow(() => validator.assertRequest(otherOrigin, { publicResource: true }));
  rejects(otherOrigin, 'cross-site-request', validator);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])
    assert.throws(() => validator.assertRequest(request({ method }), { publicResource: true }), { code: 'public-resource-method-forbidden' });
  assert.throws(() => validator.assertRequest(callback, { publicResource: true, serverToServer: true }), { code: 'invalid-transport-context' });
});

test('public resource navigation still requires the trusted proxy, exact forwarding authority and unique headers', () => {
  const validator = transport();
  for (const [req, code] of [
    [request({ socket: { remoteAddress: '192.0.2.1' } }), 'trusted-proxy-required'],
    [request({ headers: { host: 'evil.example.test' } }), 'local-host-required'],
    [request({ headers: { 'x-forwarded-host': 'evil.example.test' } }), 'forwarded-origin-required'],
    [request({ headers: { 'x-forwarded-proto': 'http' } }), 'forwarded-origin-required'],
    [request({ headers: { forwarded: 'proto=https' } }), 'proxy-headers-invalid'],
  ]) assert.throws(() => validator.assertRequest(req, { publicResource: true }), { code });
  for (const name of ['host', 'x-forwarded-proto', 'x-forwarded-host', 'origin', 'sec-fetch-site']) {
    const req = request({ headers: { origin: 'https://identity.example.test', 'sec-fetch-site': 'cross-site' } });
    req.rawHeaders.push(name.toUpperCase(), req.headers[name]);
    assert.throws(() => validator.assertRequest(req, { publicResource: true }), { code: 'proxy-headers-invalid' });
  }
});

test('public lifecycle uses the same trusted proxy path while forbidding browser context', () => {
  const validator = transport();
  assert.doesNotThrow(() => validator.assertRequest(request({ method: 'POST' }), { serverToServer: true }));
  for (const headers of [{ origin: ORIGIN }, { 'sec-fetch-site': 'none' }])
    assert.throws(() => validator.assertRequest(request({ method: 'POST', headers }), { serverToServer: true }), { code: 'lifecycle-browser-forbidden' });
  assert.throws(() => validator.assertRequest(request({ method: 'POST', headers: { 'x-forwarded-proto': 'http' } }), { serverToServer: true }), { code: 'forwarded-origin-required' });
});

test('unconfigured local mode retains its original loopback origin and separate lifecycle contract', () => {
  for (const mode of ['demo', 'account']) {
    const validator = createDatingTransport({ mode });
    assert.equal(validator.publicOrigin, null);
    assert.doesNotThrow(() => validator.assertRequest(request({ method: 'POST', headers: { origin: 'http://127.0.0.1:4201' } })));
    rejects(request({ method: 'POST', headers: { origin: ORIGIN } }), 'origin-required', validator);
    rejects(request({ socket: { remoteAddress: '192.0.2.1' } }), 'local-host-required', validator);
    rejects(request({ headers: { 'sec-fetch-site': 'same-site' } }), 'cross-site-request', validator);
    rejects(request({ method: 'HEAD' }), 'origin-required', validator);
    assert.doesNotThrow(() => validator.assertRequest({ headers: {}, socket: {} }, { serverToServer: true }));
  }
});

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-dating-transport-'));
  const store = createDatingStore({ path: path.join(directory, 'test.sqlite'), mode: 'account' });
  const owner = '10000000-0000-4000-8000-000000000001', secret = 'synthetic-transport-lifecycle-secret-0001';
  let authentications = 0;
  const service = createDatingService({ store, mode: 'account', transport: { publicOrigin: ORIGIN, trustedProxyIPs: ['127.0.0.1'] },
    verify: async token => { authentications++; return token === 'synthetic-user' ? { accountId: owner } : null; },
    lifecycle: { token: secret, issuer: 'synk-account', audience: 'atlas-dating' } });
  const server = http.createServer(async (req, res) => { if (!await service.handle(req, res)) res.writeHead(404).end(); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); service.close(); });
  const port = server.address().port;
  async function call(route, { method = 'GET', headers = {}, json, duplicate } = {}) {
    const base = { Host: `127.0.0.1:${port}`, 'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': 'dating.example.test:8443',
      Authorization: 'Bearer synthetic-user', ...(json ? { 'Content-Type': 'application/json' } : {}), ...headers };
    for (const [key, value] of Object.entries(base)) if (value === undefined) delete base[key];
    const raw = Object.entries(base).flat(); if (duplicate) raw.push(...duplicate);
    return new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, path: '/api/atlas-dating' + route, method, headers: raw }, res => {
        const parts = []; res.on('data', part => parts.push(part)); res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(Buffer.concat(parts).toString()) }));
      }); req.on('error', reject); req.end(json ? JSON.stringify(json) : undefined);
    });
  }
  return { call, store, owner, secret, authentications: () => authentications };
}

test('real HTTP parser duplicates and spoofed browser origins fail before authentication or mutation', async t => {
  const f = await fixture(t);
  for (const duplicate of [['X-Forwarded-Proto', 'https'], ['X-Forwarded-Host', 'dating.example.test:8443'], ['Origin', ORIGIN]]) {
    const result = await f.call('/state', { headers: { Origin: ORIGIN }, duplicate });
    assert.equal(result.status, 403); assert.equal(result.data.error.code, 'proxy-headers-invalid');
  }
  const input = { requestId: randomUUID(), expectedRevision: 0, action: { kind: 'profile', profile: { nickname: '합성 사용자', region: '', intro: '' } } };
  assert.equal((await f.call('/action', { method: 'POST', json: input })).status, 403);
  assert.equal((await f.call('/action', { method: 'POST', json: input, headers: { Origin: 'https://sibling.example.test:8443' } })).status, 403);
  assert.equal(f.authentications(), 0); assert.equal(f.store.transaction(tx => tx.account(f.owner)), null);
  const first = await f.call('/state'); assert.equal(first.status, 200);
  input.expectedRevision = first.data.view.revision;
  const saved = await f.call('/action', { method: 'POST', json: input, headers: { Origin: ORIGIN, 'Sec-Fetch-Site': 'same-origin' } });
  assert.equal(saved.status, 200, JSON.stringify(saved.data)); assert.equal(saved.data.view.profile.nickname, '합성 사용자');
  assert.equal((await f.call('/config')).data.localOnly, false);
});

test('real lifecycle requests require both proxy verification and their independent server credential', async t => {
  const f = await fixture(t), event = { version: 1, type: 'account.deleted', eventId: randomUUID(), subjectId: f.owner,
    occurredAt: new Date().toISOString(), issuer: 'synk-account', audience: 'atlas-dating' };
  const call = headers => f.call('/lifecycle', { method: 'POST', json: event, headers: { Authorization: `Bearer ${f.secret}`, ...headers } });
  assert.equal((await call({ 'X-Forwarded-Proto': 'http' })).status, 403);
  assert.equal((await call({ Origin: ORIGIN })).status, 403);
  assert.equal((await call({ Authorization: 'Bearer synthetic-user' })).status, 401);
  assert.equal(f.store.transaction(tx => tx.account(f.owner)), null);
  const deleted = await call({}); assert.equal(deleted.status, 200); assert.equal(deleted.data.status, 'deleted');
  const replay = await call({}); assert.deepEqual(replay, deleted);
  assert.equal(f.authentications(), 0);
});
