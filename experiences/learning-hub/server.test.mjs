import test from 'node:test';
import assert from 'node:assert/strict';
import { targetFor, createServer } from './server.mjs';
test('only named game assets are served, not repository files or QA artifacts', () => {
  assert.match(targetFor('/'), /learning-hub[\\/]index.html$/);
  assert.match(targetFor('/korean-racing/atlas-learning.js'), /atlas-learning.js$/);
  assert.match(targetFor('/korean-racing/assets/sky.hdr'), /sky.hdr$/);
  for (const path of ['/../Code.js', '/.env', '/korean-racing/qa/secret.json', '/korean-racing/README.md', '/korean-racing/.secret.json']) assert.equal(targetFor(path), null);
});
test('the Atlas lab and exactly two read-only consultation files are served', () => {
  assert.match(targetFor('/atlas-lab/'), /atlas-lab[\\/]index.html$/);
  assert.match(targetFor('/consult/computer/rules.js'), /맞춤도구[\\/]computer[\\/]rules.js$/);
  assert.match(targetFor('/consult/computer/content.js'), /맞춤도구[\\/]computer[\\/]content.js$/);
  for (const path of ['/consult/computer/view.js', '/consult/computer/탐색노트.md', '/consult/../Code.js', '/atlas-lab/qa/x.json']) assert.equal(targetFor(path), null);
});
test('shared origin serves executable common bundles with nosniff-safe MIME', async () => {
  const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const route of ['/', '/learning-hub/app.js', '/learning-hub/atlas-learning.js', '/korean-rhythm/atlas-learning.js', '/order-rush/core.mjs']) {
      const response = await fetch(origin + route); assert.equal(response.status, 200, route);
      assert.match(response.headers.get('content-type'), route === '/' ? /text\/html/ : /text\/javascript/);
    }
    assert.equal((await fetch(origin + '/', { method: 'POST' })).status, 405);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
