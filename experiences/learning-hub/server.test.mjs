import test from 'node:test';
import assert from 'node:assert/strict';
import { targetFor, createServer } from './server.mjs';
test('only named game assets are served, not repository files or QA artifacts', () => {
  assert.match(targetFor('/'), /learning-hub[\\/]index.html$/);
  assert.match(targetFor('/korean-racing/atlas-learning.js'), /atlas-learning.js$/);
  assert.match(targetFor('/korean-racing/assets/sky.hdr'), /sky.hdr$/);
  for (const path of ['/../Code.js', '/.env', '/korean-racing/qa/secret.json', '/korean-racing/README.md', '/korean-racing/.secret.json']) assert.equal(targetFor(path), null);
});
test('the Atlas lab serves named consultation rules and optional Core capabilities only', () => {
  assert.match(targetFor('/atlas-lab/'), /atlas-lab[\\/]index.html$/);
  assert.match(targetFor('/consult/computer/rules.js'), /맞춤도구[\\/]computer[\\/]rules.js$/);
  assert.match(targetFor('/consult/computer/content.js'), /맞춤도구[\\/]computer[\\/]content.js$/);
  assert.match(targetFor('/consult/core/domain.js'), /atlas[\\/]domain.js$/);
  assert.match(targetFor('/consult/core/interpretation.js'), /atlas[\\/]interpretation.js$/);
  for (const path of ['/consult/core/engine.js', '/consult/core/package.json', '/consult/computer/view.js', '/consult/computer/탐색노트.md', '/consult/../Code.js', '/atlas-lab/qa/x.json']) assert.equal(targetFor(path), null);
});
test('account classrooms serve teacher UI and Town assets while model, answer keys and stored state stay private',()=>{
  for(const route of ['/teacher-world/?account=1','/teacher-world/app.mjs','/synk-account/world-classroom.css','/synk-town/linked.html','/synk-town/engine/loom-motion.js'])assert.ok(targetFor(route),route);
  for(const route of ['/teacher-world/model.mjs','/teacher-world/account-service.mjs','/teacher-world/learning-runs.mjs','/teacher-world/.local/linked-state.json','/synk-town/core.mjs','/synk-town/server.mjs'])assert.equal(targetFor(route),null,route);
});
test('shared origin serves executable common bundles with nosniff-safe MIME', async () => {
  const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const route of ['/', '/learning-hub/app.js', '/learning-hub/atlas-learning.js', '/korean-rhythm/atlas-learning.js', '/order-rush/core.mjs', '/consult/core/domain.js', '/consult/core/interpretation.js']) {
      const response = await fetch(origin + route); assert.equal(response.status, 200, route);
      assert.match(response.headers.get('content-type'), route === '/' ? /text\/html/ : /text\/javascript/);
    }
    assert.equal((await fetch(origin + '/', { method: 'POST' })).status, 405);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
