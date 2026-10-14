import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer, createStore } from './server.mjs';

async function withServer(options, run) {
  const server = createServer({ ...options, store: createStore() });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
test('normal server denies town entry and developer commands regardless of query claims', async () => {
  await withServer({}, async origin => {
    const entry = await (await fetch(origin + '/api/entry?passed=true&grade=6')).json();
    assert.equal(entry.allowed, false);
    assert.equal((await fetch(origin + '/api/preview/state')).status, 403);
    assert.equal((await fetch(origin + '/preview.html')).status, 404);
    assert.equal((await fetch(origin + '/day-residents.mjs')).status, 404);
    assert.equal((await fetch(origin + '/day-rendering.mjs')).status, 404);
    assert.equal((await fetch(origin + '/rendering/SSAOPass.js')).status, 404);
    assert.equal((await fetch(origin + '/avatar-wardrobe.mjs')).status, 404);
    assert.equal((await fetch(origin + '/wardrobe-catalog.mjs')).status, 404);
  });
});
test('explicit local preview uses same-origin JSON mutations and denies repository exposure', async () => {
  await withServer({ previewEnabled: true }, async origin => {
    assert.equal((await fetch(origin + '/api/preview/state')).status, 200);
    const body = JSON.stringify({ id: 'one', type: 'CHOOSE', payload: { branch: 'inside' }, expectedRevision: 0 });
    const headers = { 'Content-Type': 'application/json', Origin: origin };
    assert.equal((await fetch(origin + '/api/preview/command', { method: 'POST', body, headers: { ...headers, Origin: 'https://other.example' } })).status, 403);
    assert.equal((await fetch(origin + '/api/preview/command', { method: 'POST', body, headers: { 'Content-Type': 'application/json' } })).status, 403);
    const result = await fetch(origin + '/api/preview/command', { method: 'POST', body, headers });
    assert.equal(result.status, 200); assert.equal((await result.json()).state.phase, 'inside-preview');
    for (const route of ['/core.mjs', '/server.mjs', '/README.md', '/assets/../../Code.js', '/api/preview/other']) {
      assert.ok((await fetch(origin + route)).status >= 400, route);
    }
    assert.equal((await fetch(origin + '/engine/loom-life.js')).status, 200);
    const residentModule = await fetch(origin + '/day-residents.mjs');
    assert.equal(residentModule.status, 200);
    assert.match(residentModule.headers.get('content-type'), /javascript/);
    for (const route of ['/day-materials.mjs', '/day-rendering.mjs', '/rendering/EffectComposer.js', '/rendering/SSAOPass.js', '/rendering/OutputPass.js']) {
      const module = await fetch(origin + route);
      assert.equal(module.status, 200, route);
      assert.match(module.headers.get('content-type'), /javascript/, route);
    }
    assert.equal((await fetch(origin + '/rendering/provenance.json')).status, 404);
    assert.equal((await fetch(origin + '/rendering/unlisted.js')).status, 404);
    for (const route of ['/avatar-wardrobe.mjs', '/wardrobe-catalog.mjs']) {
      const response = await fetch(origin + route);
      assert.equal(response.status, 200, route);
      assert.match(response.headers.get('content-type'), /javascript/, route);
    }
    assert.equal((await fetch(origin + '/avatar-unlisted.mjs')).status, 404);
    for (const id of ['cafe-owner', 'visitor-tea-reader']) {
      const portrait = await fetch(origin + `/assets/residents/${id}.png`);
      assert.equal(portrait.status, 200);
      assert.match(portrait.headers.get('content-type'), /image\/png/);
    }
    const badHostStatus = await new Promise((resolve, reject) => {
      http.get(origin + '/api/preview/state', { headers: { Host: 'untrusted.example' } }, response => {
        response.resume(); resolve(response.statusCode);
      }).on('error', reject);
    });
    assert.equal(badHostStatus, 403);
  });
});
