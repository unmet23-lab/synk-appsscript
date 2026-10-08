'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { CI에없는로컬자료 } = require('./_git밖.js');
test('local account entry serves only reviewed public files, never its build sources or dependencies', async () => {
  const { targetFor } = await import('../experiences/learning-hub/server.mjs');
  for (const p of ['/', '/synk-account/', '/synk-account/platform.html', '/synk-account/platform.css', '/synk-account/dist/platform.js', '/synk-account/assets/synk-logo.svg', '/synk-account/client.html?product=world', '/synk-account/preview.html', '/synk-account/config.json', '/synk-account/dist/client.js', '/synk-account/assets/slab-coral-long.webp', '/synk-account/src/core.mjs']) assert.ok(targetFor(p), p);
  for (const p of ['/synk-account/package.json', '/synk-account/config.example.json', '/synk-account/build-manifest.json', '/synk-account/src/unknown.mjs', '/synk-account/node_modules/anything/index.js', '/synk-account/dist/unknown.js', '/synk-account/../../Code.js', '/synk-account/%2eenv', '/learning-hub/qa/result.json']) assert.equal(targetFor(p), null, p);
});
test('local root opens the platform while the learning hub remains directly available', async (t) => {
  const { createServer } = await import('../experiences/learning-hub/server.mjs');
  const server = createServer();await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { const base = `http://127.0.0.1:${server.address().port}`;
    const entry = await fetch(base, { redirect: 'manual' });assert.equal(entry.status, 302);assert.equal(entry.headers.get('location'), '/synk-account/platform.html');
    for (const path of ['/synk-account/platform.html', '/synk-account/dist/platform.js', '/learning-hub/']) {
      // dist/ is built by tools/build-synk-account.js from this repo and SYNK-talk, and is not in git:
      // a clean CI checkout skips only that path (tests/_git밖.js, 2026-10-03). Locally a missing build still fails.
      const missing = path.includes('/dist/') && CI에없는로컬자료('experiences/synk-account/dist/platform.js', 'build output from SYNK-talk sources, not in git');
      if (missing) { t.diagnostic(missing); continue; }
      assert.equal((await fetch(base + path)).status, 200);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
