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
  assert.match(targetFor('/consult/core/engine.js'), /atlas[\\/]engine.js$/);
  assert.match(targetFor('/consult/core/personalization.js'), /atlas[\\/]personalization.js$/);
  for (const path of ['/consult/core/package.json', '/consult/core/storage.js', '/consult/computer/view.js', '/consult/computer/탐색노트.md', '/consult/../Code.js', '/atlas-lab/qa/x.json']) assert.equal(targetFor(path), null);
});
test('account classrooms serve teacher UI and Town assets while model, answer keys and stored state stay private',()=>{
  for(const route of ['/teacher-world/?account=1','/teacher-world/app.mjs','/synk-account/world-classroom.css','/synk-town/linked.html','/synk-town/engine/loom-motion.js'])assert.ok(targetFor(route),route);
  for(const route of ['/teacher-world/model.mjs','/teacher-world/account-service.mjs','/teacher-world/learning-runs.mjs','/teacher-world/.local/linked-state.json','/synk-town/core.mjs','/synk-town/server.mjs'])assert.equal(targetFor(route),null,route);
});
test('beginner games expose playable assets but keep cooperative authority and QA private', async () => {
  for (const route of ['/word-magic/', '/word-magic/atlas-learning.js', '/word-magic/audio/grow.mp3', '/order-rush/beginner.html', '/spaceship-coop/', '/spaceship-coop/assets/audio/red.mp3']) assert.ok(targetFor(route), route);
  for (const route of ['/spaceship-coop/core.mjs', '/spaceship-coop/server.mjs', '/spaceship-coop/server.test.mjs', '/spaceship-coop/qa/data.json', '/word-magic/core.test.mjs', '/word-magic/qa/data.json']) assert.equal(targetFor(route), null, route);
  const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(base + '/api/spaceship/health').then(r=>r.json())).service, 'spaceship-coop');
    const room = await fetch(base + '/api/spaceship/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'integration-room-20261008' }) }).then(r=>r.json());
    assert.match(room.code, /^[A-Z2-9]{6}$/);
    assert.ok(room.token.length >= 16);
    const audio = await fetch(base + '/word-magic/audio/grow.mp3', { headers: { Range: 'bytes=0-31' } });
    assert.equal(audio.status, 206); assert.equal((await audio.arrayBuffer()).byteLength, 32);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('shared origin serves executable common bundles with nosniff-safe MIME', async () => {
  const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const route of ['/', '/learning-hub/app.js', '/learning-hub/atlas-learning.js', '/korean-rhythm/atlas-learning.js', '/order-rush/core.mjs', '/spaceship-coop/starbook.mjs', '/consult/core/domain.js', '/consult/core/interpretation.js']) {
      const response = await fetch(origin + route); assert.equal(response.status, 200, route);
      assert.match(response.headers.get('content-type'), route === '/' ? /text\/html/ : /text\/javascript/);
    }
    assert.equal((await fetch(origin + '/', { method: 'POST' })).status, 405);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
