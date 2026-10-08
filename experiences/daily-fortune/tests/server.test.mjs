import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from '../server.mjs';

test('실제 HTTP에서 화면과 지정 자산만 제공하고 외부 통신 및 쓰기를 막는다', async t => {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /무료 운세/);
  assert.match(page.headers.get('content-security-policy'), /connect-src 'self'\s*;/);
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
  for (const file of ['app.mjs', 'app.css', 'core.mjs', 'saju-core.mjs', 'insights.mjs', 'kit/josa.mjs', 'account.mjs', 'account-state.mjs', 'synk-account/src/core.mjs', 'vendor/lunar-javascript-1.7.7/lunar.mjs', 'vendor/lunar-javascript-1.7.7/LICENSE', 'assets/SUIT.woff2', 'assets/fortune-star.avif', 'assets/synk-logo.svg', 'assets/slab-cream-long.webp', 'assets/slab-blush-long.webp', 'assets/slab-coral-long.webp', 'assets/wide-butter.webp']) {
    const response = await fetch(`${base}/${file}`, { method: 'HEAD' });
    assert.equal(response.status, 200, file);
    assert.ok(Number(response.headers.get('content-length')) > 0, file);
    assert.equal(await response.text(), '');
  }
  assert.equal((await fetch(`${base}/assets/fortune-star.avif`)).headers.get('content-type'), 'image/avif');
  assert.match((await fetch(`${base}/vendor/lunar-javascript-1.7.7/lunar.mjs`)).headers.get('content-type'), /^text\/javascript/);
  for (const file of ['server.mjs', 'README.md', 'tests/core.test.mjs', '.env', 'account.config.json', '%2e%2e/%2e%2e/Code.js', 'assets/%2e%2e/server.mjs']) assert.equal((await fetch(`${base}/${file}`)).status, 404, file);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) assert.equal((await fetch(base, { method })).status, 405);
});

test('계정 설정은 검증한 공개 값과 정확한 API 출처만 노출한다', async t => {
  const accountConfig = { version: 1, supabaseUrl: 'https://auth.fortune-test.invalid', accountApiUrl: 'https://api.fortune-test.invalid',
    portalUrl: 'https://portal.fortune-test.invalid/', supabasePublishableKey: 'sb_publishable_synthetic_test',
    clients: { platform: { clientId: 'synthetic-fortune', redirectUri: 'http://127.0.0.1:4299/' }, world: { clientId: 'unrelated-world', redirectUri: 'http://127.0.0.1:4280/client.html' } } };
  const server = createServer({ accountConfig });server.listen(0, '127.0.0.1');await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/account-config.json`), exposed = await response.json();
  assert.deepEqual(Object.keys(exposed.clients), ['platform']);
  assert.equal(exposed.clients.platform.clientId, 'synthetic-fortune');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const policy = response.headers.get('content-security-policy');
  assert.match(policy, /connect-src 'self' https:\/\/auth\.fortune-test\.invalid https:\/\/api\.fortune-test\.invalid;/);
  assert.doesNotMatch(policy, /connect-src[^;]*\*/);
  assert.throws(() => createServer({ accountConfig: { ...accountConfig, supabasePublishableKey: 'sb_secret_not_public' } }));
  assert.throws(() => createServer({ accountConfig: { ...accountConfig, clients: { platform: { ...accountConfig.clients.platform, clientSecret: 'not-public' } } } }));
});
