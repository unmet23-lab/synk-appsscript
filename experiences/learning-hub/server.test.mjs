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
  for(const route of ['/teacher-world/course-writing-ui.mjs','/teacher-world/signal.css','/teacher-world/homework-review.mjs','/teacher-world/homework-review.css','/teacher-world/topik4-homework.json'])assert.ok(targetFor(route),route);
  for(const route of ['/teacher-world/course-writing.mjs','/teacher-world/topik4-course.json','/teacher-world/course-writing.test.mjs','/teacher-world/topik4-homework-key.json'])assert.equal(targetFor(route),null,route);
  for(const route of ['/teacher-world/?account=1','/teacher-world/app.mjs','/teacher-world/workspace-overview.mjs','/teacher-world/workspace-overview.css','/teacher-world/sharing-fence.mjs','/synk-account/world-classroom.css','/synk-town/linked.html','/synk-town/engine/loom-motion.js'])assert.ok(targetFor(route),route);
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
    for (const route of ['/', '/learning-hub/app.js', '/learning-hub/atlas-learning.js', '/korean-rhythm/atlas-learning.js', '/order-rush/core.mjs', '/spaceship-coop/starbook.mjs', '/consult/core/domain.js', '/consult/core/interpretation.js', '/consult/core/engine.js', '/consult/core/personalization.js', '/atlas-lab/meeting.mjs', '/atlas-lab/meeting-ui.mjs', '/atlas-lab/discovery.mjs', '/atlas-lab/discovery-ui.mjs']) {
      const response = await fetch(origin + route); assert.equal(response.status, 200, route);
      assert.match(response.headers.get('content-type'), route === '/' ? /text\/html/ : /text\/javascript/);
    }
    assert.equal((await fetch(origin + '/', { method: 'POST' })).status, 405);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('WORLD wardrobe serves its CSS, lazy ESM bundle and exact image assets without exposing source or QA', async () => {
  const wardrobeImages = [
    'mongle-basic.webp', 'marin-basic.webp', 'kkamong-base.webp', 'kkamong-scarf.webp',
    'kkamong-headphones.webp', 'kkamong-apron.webp', 'kkamong-summer-deel.webp', 'kkamong-winter-deel.webp',
    'felt-paper.webp', 'felt-night.webp', 'felt-lapis.webp', 'cushion-cream.webp', 'cushion-blush.webp',
  ];
  const publicRoutes = [
    ['/synk-account/wardrobe.css', 'text/css'],
    ['/synk-account/dist/wardrobe-three.js', 'text/javascript'],
    ...wardrobeImages.map(file => [`/synk-account/assets/wardrobe/${file}`, 'image/webp']),
  ];
  const privateRoutes = [
    '/synk-account/src/wardrobe-three-preview.mjs', '/synk-account/src/wardrobe-view.mjs',
    '/synk-account/src/generated/wardrobe-client.cjs', '/synk-account/server-shared.mjs',
    '/synk-account/assets/wardrobe/unknown.webp', '/synk-account/assets/wardrobe/private.json',
    '/synk-account/dist/wardrobe-three.js.map', '/synk-account/dist/unknown.js',
    '/synk-account/qa/wardrobe-20261008/browser-validation.json',
    '/synk-account/tests/wardrobe-three-preview.test.mjs', '/mascot-render-lab/three/renderer.mjs',
  ];
  const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const [route, type] of publicRoutes) {
      assert.ok(targetFor(route), route);
      const response = await fetch(origin + route); assert.equal(response.status, 200, route);
      assert.equal(response.headers.get('content-type').split(';')[0], type, route);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff', route);
      const body = Buffer.from(await response.arrayBuffer()); assert.ok(body.length > 0, route);
      if (type === 'image/webp') { assert.equal(body.toString('ascii', 0, 4), 'RIFF', route); assert.equal(body.toString('ascii', 8, 12), 'WEBP', route); }
    }
    for (const route of privateRoutes) {
      assert.equal(targetFor(route), null, route); assert.equal((await fetch(origin + route)).status, 404, route);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
