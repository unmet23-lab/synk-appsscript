import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { resolvePlatformUrl, LOCAL_PLATFORM_URL } from '../platform-navigation.mjs';
import { createMessenger } from '../server.mjs';

test('platform preview defaults only on loopback and can be explicitly disabled', () => {
  assert.equal(resolvePlatformUrl(undefined, { origin: 'http://127.0.0.1:4191' }), LOCAL_PLATFORM_URL);
  assert.equal(resolvePlatformUrl(undefined, { origin: 'https://company.example.test' }), null);
  assert.equal(resolvePlatformUrl('', { origin: 'http://localhost:4191' }), null);
  assert.equal(resolvePlatformUrl(null, { origin: 'http://localhost:4191' }), null);
  assert.equal(resolvePlatformUrl('https://synk.example.test/platform', { origin: 'https://company.example.test' }), 'https://synk.example.test/platform');
});

test('platform navigation rejects credentials, tokens, executable schemes and remote HTTP', () => {
  const invalid = ['javascript:alert(1)', 'data:text/html,hello', '//example.test', 'https://user:password@example.test/', 'https://example.test/?token=secret', 'https://example.test/#access_token=secret', 'http://example.test/', ' https://example.test/', 'https://example.test/\\path'];
  for (const value of invalid) assert.throws(() => resolvePlatformUrl(value, { origin: 'http://localhost:4191' }), value);
  assert.throws(() => resolvePlatformUrl(LOCAL_PLATFORM_URL, { origin: 'https://company.example.test' }));
});

test('public navigation exposes only the configured link and grants no messenger access', async t => {
  const dataDir = await mkdtemp(join(tmpdir(), 'synk-platform-navigation-'));
  const app = createMessenger({ dataDir, port: 0, platformUrl: LOCAL_PLATFORM_URL, driveStorage: { active: async () => null } });
  t.after(async () => {
    await app.close();
    assert.ok(resolve(dataDir).startsWith(resolve(tmpdir()) + sep));
    await rm(dataDir, { recursive: true, force: true });
  });
  const { url } = await app.listen();
  const response = await fetch(url + '/api/bootstrap');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.platformUrl, LOCAL_PLATFORM_URL);
  assert.equal(body.user, undefined);
  assert.equal(body.channels, undefined);
  assert.equal((await fetch(url + '/api/channels')).status, 401);
});
