'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { rawCopies, unknownCopies, syncRaw, runAll, GAMES } = require('../tools/lib/atlas-copies');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-atlas-copies-'));
  t.after(() => { assert.equal(path.dirname(root), path.resolve(os.tmpdir())); assert.ok(path.basename(root).startsWith('synk-atlas-copies-')); fs.rmSync(root, { recursive: true }); });
  const write = (relative, content) => { const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); return file; };
  for (const name of ['engine', 'trail', 'personalization']) write(`atlas/${name}.js`, `// ${name}\n`);
  return { root, write };
}
test('one copy check includes PATH and launcher and checks all drift without changing files', t => {
  const { root, write } = fixture(t);
  write('experiences/path-vr/vendor/engine.js', '// stale');
  write('desktop/assets/launcher/personalization.js', '// stale settings');
  const pairs = rawCopies(root), before = fs.readFileSync(pairs[0].destination);
  const checked = syncRaw(root, pairs);
  assert.equal(checked.problems.length, 5);
  assert.deepEqual(fs.readFileSync(pairs[0].destination), before);
  assert.equal(fs.existsSync(path.join(root, 'experiences/path-vr/vendor/trail.js')), false);
  assert.equal(syncRaw(root, pairs, { check: false }).changed.length, 5);
  assert.deepEqual(syncRaw(root, pairs).problems, []);
  write('experiences/path-vr/vendor/engine.js', '// engine\r\n');
  assert.deepEqual(syncRaw(root, pairs).problems, [], 'line-ending-only checkout differences are equivalent');
});
test('engine refresh keeps unrelated launcher and marketing manifest fields and files', t => {
  const { root, write } = fixture(t);
  const extra = { name: 'user-image.png', source: 'other.png', bytes: 123, sha256: 'existing-user-work' };
  const launcher = { note: 'retain this', assets: [{ name: 'engine.js' }, { name: 'personalization.js' }, extra] };
  write('desktop/assets/launcher/sources.json', JSON.stringify(launcher));
  const manifest = { builtAt: 'original', path: '/brief/computer/', files: { 'index.html': { sha256: 'unrelated' } } };
  write('docs/마케팅/맞춤도구/dist/computer.manifest.json', JSON.stringify(manifest));
  write('docs/마케팅/맞춤도구/dist/brief/computer/rules.js', '// user rules');
  const pairs = rawCopies(root);
  assert.equal(pairs.length, 6);
  syncRaw(root, pairs, { check: false });
  const after = JSON.parse(fs.readFileSync(path.join(root, 'desktop/assets/launcher/sources.json')));
  assert.deepEqual(after.assets.at(-1), extra); assert.equal(after.note, launcher.note);
  const marketing = JSON.parse(fs.readFileSync(path.join(root, 'docs/마케팅/맞춤도구/dist/computer.manifest.json')));
  assert.equal(marketing.builtAt, 'original'); assert.deepEqual(marketing.files['index.html'], manifest.files['index.html']);
  assert.equal(marketing.atlasEngineSha256, marketing.files['atlas-engine.js'].sha256);
  assert.equal(fs.readFileSync(path.join(root, 'docs/마케팅/맞춤도구/dist/brief/computer/rules.js'), 'utf8'), '// user rules');
  assert.deepEqual(syncRaw(root, pairs).problems, []);
});
test('a new unregistered consumer is detected while historical QA and dependencies stay untouched', t => {
  const { root, write } = fixture(t);
  const marker = '// Generated from atlas/ and strata/.\n';
  const known = write('experiences/hangul-stage/atlas-learning.js', marker);
  write('experiences/new-product/atlas-learning.js', marker);
  write('experiences/new-product/vendor/ask.js', 'root.SynkAsk = factory();');
  write('experiences/new-product/vendor/flow.js', 'root.SynkFlow = factory();');
  write('experiences/new-product/qa/old.js', marker);
  write('experiences/new-product/node_modules/engine.js', marker);
  assert.deepEqual(unknownCopies(root, new Set([known])), ['experiences/new-product/atlas-learning.js', 'experiences/new-product/vendor/ask.js', 'experiences/new-product/vendor/flow.js']);
  assert.equal(GAMES.length, 9);
});
test('missing canonical files cannot cause a partial raw-copy write', t => {
  const { root, write } = fixture(t), existing = write('experiences/path-vr/vendor/engine.js', '// keep');
  const pairs = rawCopies(root); fs.unlinkSync(path.join(root, 'atlas/trail.js'));
  assert.throws(() => syncRaw(root, pairs, { check: false }), /ENOENT/);
  assert.equal(fs.readFileSync(existing, 'utf8'), '// keep');
});

test('the full check refuses a missing Talk server generator before changing any local copies', t => {
  const { root, write } = fixture(t), existing = write('experiences/path-vr/vendor/engine.js', '// keep');
  write('talk/package.json', '{}'); write('website/package.json', '{}');
  write('talk/supabase/functions/_shared/synk-atlas.js', '// stale server');
  const options = { root, talkRoot: path.join(root, 'talk'), websiteRoot: path.join(root, 'website') };
  for (const check of [true, false]) assert.throws(() => runAll({ ...options, check }), /Missing Talk server generator/);
  assert.equal(fs.readFileSync(existing, 'utf8'), '// keep');
});
