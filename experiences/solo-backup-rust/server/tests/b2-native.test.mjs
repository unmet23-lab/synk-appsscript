import test from 'node:test';
import assert from 'node:assert/strict';
import { withRetry, B2Error, authorize } from '../b2-native.mjs';

const noSleep = { sleep: async () => {} };

test('retries closed sockets and B2 503, then succeeds', async () => {
  let n = 0;
  const r = await withRetry(async () => { n++; if (n === 1) throw new TypeError('fetch failed'); if (n === 2) throw new B2Error(503, 'service_unavailable'); return 'ok'; }, noSleep);
  assert.equal(r, 'ok'); assert.equal(n, 3);
});

test('does not retry permission errors', async () => {
  let n = 0;
  await assert.rejects(withRetry(async () => { n++; throw new B2Error(403, 'access_denied'); }, noSleep), /403/);
  assert.equal(n, 1);
});

test('gives up after the attempt limit', async () => {
  let n = 0;
  await assert.rejects(withRetry(async () => { n++; throw new TypeError('fetch failed'); }, { ...noSleep, attempts: 3 }), TypeError);
  assert.equal(n, 3);
});

test('authorize never puts the key into the error', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ code: 'unauthorized', message: 'bad key' }), { status: 401 });
  await assert.rejects(authorize({ keyId: 'kid-123', applicationKey: 'SECRET-VALUE-9' }, { fetchImpl }), (e) => {
    assert.equal(e.status, 401); assert.ok(!String(e.message).includes('SECRET-VALUE-9')); return true;
  });
});

test('session token is not enumerable (not serialized into logs)', async () => {
  const body = { accountId: 'acc', authorizationToken: 'TOKEN-XYZ', apiInfo: { storageApi: { apiUrl: 'https://api005.backblazeb2.com', downloadUrl: 'https://f005.backblazeb2.com', s3ApiUrl: 'https://s3.us-east-005.backblazeb2.com', allowed: { capabilities: ['listFiles'] } } } };
  const s = await authorize({ keyId: 'k', applicationKey: 'v' }, { fetchImpl: async () => new Response(JSON.stringify(body), { status: 200 }) });
  assert.ok(!JSON.stringify(s).includes('TOKEN-XYZ'));
  assert.equal(s.region, 'us-east-005');
});
