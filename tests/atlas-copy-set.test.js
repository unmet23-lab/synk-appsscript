'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { rawCopies, ownedFiles, unknownCopies, syncRaw, runAll, GAMES, TOOL_OUTPUTS, WORLD_BUNDLES, PRODUCT_OWNED } = require('../tools/lib/atlas-copies');
const repo = path.resolve(__dirname, '..');
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
  assert.equal(GAMES.length, 10);
  // Registered bundles and product-owned modules carry the same markers but are classified, not unknown.
  write('experiences/synk-world-app/world-account.bundle.mjs', 'else root.SynkAtlas = factory(() => root.SynkTrail);');
  write('experiences/relationship-care/care-followup.js', 'else root.SynkTrailFollowup = factory();');
  write('experiences/relationship-care/care-later.js', 'else root.SynkTrailLater = factory();');
  const unknown = unknownCopies(root, ownedFiles(root, rawCopies(root)));
  assert.deepEqual(unknown, ['experiences/new-product/atlas-learning.js', 'experiences/new-product/vendor/ask.js', 'experiences/new-product/vendor/flow.js', 'experiences/relationship-care/care-later.js']);
});
test('the registry names every current consumer: marketing tool outputs, travel staging, WORLD bundles, product-owned modules', t => {
  const { root, write } = fixture(t);
  assert.deepEqual(Object.keys(TOOL_OUTPUTS), ['computer', 'meeting', 'katana', 'skills', 'move', 'manual']);
  write('website/dist/try/travel/index.html', '<!doctype html>');
  const travel = rawCopies(root, path.join(root, 'website')).filter(row => row.label.startsWith('website/dist/try/travel/atlas/')).map(row => path.basename(row.destination));
  assert.deepEqual(travel.sort(), ['ask.js', 'domain.js', 'engine.js', 'interpretation.js', 'personalization.js', 'temper-outcomes.js', 'trail-life.js', 'travel.js']);
  for (const name of ['trail-life', 'temper-outcomes']) assert.ok(fs.existsSync(path.join(repo, `atlas/${name}.js`)), `canonical atlas/${name}.js exists`);
  // The WORLD builders and their outputs are real files here; each builder verifies its output with --check.
  assert.equal(WORLD_BUNDLES.length, 3);
  for (const bundle of WORLD_BUNDLES) {
    assert.ok(fs.existsSync(path.join(repo, bundle.build)), bundle.build);
    assert.ok(fs.existsSync(path.join(repo, bundle.output)), bundle.output);
    assert.match(fs.readFileSync(path.join(repo, bundle.build), 'utf8'), /--check/);
  }
  // A product-owned module is the canonical source itself, never a generated copy.
  assert.deepEqual(PRODUCT_OWNED, ['experiences/relationship-care/care-followup.js']);
  for (const file of PRODUCT_OWNED) {
    const source = fs.readFileSync(path.join(repo, file), 'utf8');
    assert.doesNotMatch(source, /Canonical source: SYNK-appsscript\/atlas|Generated from atlas\//);
    assert.equal(fs.existsSync(path.join(repo, 'atlas', path.basename(file))), false, 'no atlas/ twin for a product-owned module');
  }
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

test('one sync refreshes the profile core before rebuilding the life consumer', t => {
  const { root, write } = fixture(t);
  const core = 'experiences/synk-world-app/world-learning-profile-core.mjs';
  const life = 'experiences/brand-opening/content/life-standalone.mjs';
  const builder = (source, target) => "const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');\n"
    + `const source=path.join(root,${JSON.stringify(source)}),target=path.join(root,${JSON.stringify(target)}),bytes=fs.readFileSync(source);\n`
    + "if(process.argv.includes('--check')){if(!fs.existsSync(target)||!fs.readFileSync(target).equals(bytes))throw Error('stale derived consumer');}\n"
    + "else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);}\n";
  write('tools/build-game-learning.js', '// no unrelated fixture consumers\n');
  write('tools/build-hangul-stage.js', '// no unrelated fixture consumers\n');
  write('tools/build-world-account.mjs', '// no unrelated fixture consumers\n');
  // The fixture builders use CommonJS, while the real registry invokes .mjs names.
  // createRequire keeps their filesystem behavior identical under those names.
  const moduleBuilder = (source, target) => "import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';"
    + "const require=createRequire(import.meta.url),__dirname=fileURLToPath(new URL('.',import.meta.url));\n" + builder(source, target);
  write('tools/build-world-learning-profile.mjs', moduleBuilder('atlas/engine.js', core));
  write('tools/build-world-life.mjs', moduleBuilder(core, life));
  write(core, '// previous profile core\n');
  write(life, '// previous profile core\n');
  const options = { root, local: true };
  const first = runAll({ ...options, check: false });
  assert.equal(first.ok, true, JSON.stringify(first.problems));
  write('atlas/engine.js', '// refreshed canonical engine\n');
  const synced = runAll({ ...options, check: false });
  assert.equal(synced.ok, true, JSON.stringify(synced.problems));
  const checked = runAll({ ...options, check: true });
  assert.equal(checked.ok, true, JSON.stringify(checked.problems));
  assert.equal(fs.readFileSync(path.join(root, life), 'utf8'), '// refreshed canonical engine\n');
});
