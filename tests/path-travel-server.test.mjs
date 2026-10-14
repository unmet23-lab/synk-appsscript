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
  for (const route of ['/model.mjs', '/catalog.mjs', '/storage.mjs', '/profile.mjs', '/extractor.mjs', '/conversation.mjs', '/real-places.mjs', '/real-guide.mjs', '/real-ui.mjs', '/real-conditions.mjs', '/real-course.mjs', '/real-course-data.mjs', '/real-course-ui.mjs', '/atlas/engine.js', '/atlas/personalization.js', '/atlas/domain.js', '/atlas/interpretation.js', '/atlas/ask.js', '/atlas/travel.js']) {
    const result = await fetch(base + route);
    assert.equal(result.status, 200, route);
    assert.match(result.headers.get('content-security-policy'), /connect-src 'self'/);
  }
  for (const route of ['/planner.mjs', '/planner-ui.mjs', '/planner.css', '/places-v2.mjs', '/walking-router.mjs', '/planner-storage.mjs', '/planner-feedback.mjs', '/planner-account.mjs', '/legacy.html', '/assets/jongno-walking.json', '/atlas/trail-life.js', '/atlas/temper-outcomes.js', '/tools/lib/loom-motion.js']) assert.equal((await fetch(base + route)).status, 200, route);
  assert.match(await (await fetch(base+'/')).text(), /planner-ui.mjs/);
  for (const route of ['/README.md', '/server.mjs', '/.env', '/docs/비전_정본.md', '/assets/../../server.mjs']) assert.equal((await fetch(base + route)).status, 404);
  assert.equal((await fetch(base + '/', { method: 'POST' })).status, 405);
  assert.equal((await fetch(base + '/', { headers: { origin: 'https://other.example' } })).status, 403);
  const status = await new Promise(resolve => {
    http.get(base + '/', { headers: { Host: 'attacker.example' } }, response => { response.resume(); resolve(response.statusCode); });
  });
  assert.equal(status, 403);
});

test('여행 계정 서버는 정제한 공개 설정과 필요한 공유 모듈만 연결한다', async t => {
  const accountConfig = { version: 1, supabaseUrl: 'https://auth.example.test', accountApiUrl: 'https://api.example.test',
    supabasePublishableKey: 'sb_publishable_fixture', portalUrl: 'https://portal.example.test/',
    clients: { 'path-travel': { clientId: 'fixture-travel', redirectUri: 'http://127.0.0.1:4303/' } } };
  const server = createServer({ port: 0, accountConfig });
  await server.start(); t.after(() => server.stop());
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(base + '/config.json'), config = await response.json();
  assert.equal(config.clients['path-travel'].clientId, 'fixture-travel');
  assert.equal(Object.hasOwn(config, 'configured'), false);
  assert.match(response.headers.get('content-security-policy'), /connect-src 'self' https:\/\/auth\.example\.test https:\/\/api\.example\.test;/);
  assert.equal((await (await fetch(base + '/api/health')).json()).accountSync, true);
  for (const route of ['/synk-account/src/account-notebook.mjs', '/synk-account/src/account-notebook.css', '/synk-account/src/product-account.mjs', '/synk-account/src/platform-entry.mjs', '/path-travel/planner.mjs', '/planner-login-draft.mjs']) {
    assert.equal((await fetch(base + route)).status, 200, route);
  }
  for (const route of ['/synk-account/config.json', '/synk-account/server-shared.mjs', '/path-travel/server.mjs']) assert.equal((await fetch(base + route)).status, 404, route);
  for (const route of ['/config.json', '/?state=fixture&code=fixture']) assert.equal((await fetch(base + route, { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403, route);
});
