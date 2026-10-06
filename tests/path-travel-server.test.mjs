import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer } from '../experiences/path-travel/server.mjs';

test('로컬 여행 서버는 명시한 정적 자료와 엔진만 제공한다', async t => {
  const server = createServer({ port: 0 });
  await server.start();
  t.after(() => server.stop());
  const base = `http://127.0.0.1:${server.address().port}`;
  const health = await fetch(base + '/api/health');
  assert.equal((await health.json()).booking, false);
  for (const route of ['/model.mjs', '/catalog.mjs', '/storage.mjs', '/profile.mjs', '/extractor.mjs', '/conversation.mjs', '/atlas/engine.js', '/atlas/personalization.js', '/atlas/domain.js', '/atlas/interpretation.js', '/atlas/ask.js', '/atlas/travel.js']) {
    const result = await fetch(base + route);
    assert.equal(result.status, 200, route);
    assert.match(result.headers.get('content-security-policy'), /connect-src 'none'/);
  }
  for (const route of ['/README.md', '/server.mjs', '/.env', '/docs/비전_정본.md', '/assets/../../server.mjs']) assert.equal((await fetch(base + route)).status, 404);
  assert.equal((await fetch(base + '/', { method: 'POST' })).status, 405);
  assert.equal((await fetch(base + '/', { headers: { origin: 'https://other.example' } })).status, 403);
  const status = await new Promise(resolve => {
    http.get(base + '/', { headers: { Host: 'attacker.example' } }, response => { response.resume(); resolve(response.statusCode); });
  });
  assert.equal(status, 403);
});
