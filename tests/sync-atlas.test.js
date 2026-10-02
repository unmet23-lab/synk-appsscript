'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const script = path.join(root, 'tools/sync-atlas.js');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')).digest('hex');

function fixture(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-atlas-sync-'));
  const talk = path.join(temp, 'talk');
  const website = path.join(temp, 'website');
  for (const dir of [talk, website]) {
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'package.json'), '{}');
  }
  t.after(() => {
    // This test-created absolute directory is the only recursive cleanup target.
    assert.equal(path.dirname(temp), path.resolve(os.tmpdir()));
    assert.ok(path.basename(temp).startsWith('synk-atlas-sync-'));
    fs.rmSync(temp, { recursive: true });
  });
  const run = (...args) => spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8', env: { ...process.env, SYNK_TALK_ROOT: talk, SYNK_WEBSITE_ROOT: website },
  });
  const write = (relative, text) => { const file = path.join(talk, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
  return { temp, talk, website, run, write };
}
// What Talk's app, lib and server functions import today (src/, lib/, a 동봉.json and a test).
function talkLikeImports(write) {
  write('src/learning.js', "import { createGame } from '../lib/atlas/game-learning.js';\nimport { createMap } from '../lib/atlas/strata/index.js';\nimport map from '../lib/atlas/strata/maps/topik-i.json';\n");
  write('src/letter.js', "import { letterFocus } from '../lib/atlas/experiences.js';\n");
  write('lib/session.js', "const { createSession } = require('./atlas/engine.js');\nconst { kernelEvents } = require('./atlas/preferences.js');\n");
  write('supabase/functions/events/동봉.json', JSON.stringify({ 'preferences.mjs': 'lib/atlas/preferences.js' }));
  write('tests/drift.test.js', "const map = require('../lib/atlas/strata/maps/ko.json');\n");
}

test('Talk receives exactly what it imports and what that loads, with a manifest its own tests can read', t => {
  const { talk, website, run, write } = fixture(t);
  fs.unlinkSync(path.join(website, 'package.json'));
  talkLikeImports(write);
  const result = run('--consumer', 'talk');
  assert.equal(result.status, 0, result.stderr);
  const copied = ['education.js', 'engine.js', 'experiences.js', 'flow.js', 'game-flow.js', 'game-learning.js', 'learning-ledger.js', 'learning-sync.js', 'learning.js',
    'preferences.js', 'temper-flow.js', 'temper.js', 'trail.js', 'vellum-flow.js', 'vellum.js'];
  for (const name of copied) assert.deepEqual(fs.readFileSync(path.join(talk, 'lib/atlas', name)), fs.readFileSync(path.join(root, 'atlas', name)), name);
  for (const name of ['index.js', 'maps/ko.json', 'maps/topik-i.json']) assert.deepEqual(fs.readFileSync(path.join(talk, 'lib/atlas/strata', name)), fs.readFileSync(path.join(root, 'strata', name)));
  assert.equal(fs.existsSync(path.join(talk, 'lib/atlas/ask.js')), false, 'nothing in Talk imports it');
  const manifest = JSON.parse(fs.readFileSync(path.join(talk, 'lib/atlas/sync-manifest.json'), 'utf8'));
  assert.deepEqual(Object.keys(manifest.files), [...copied, 'strata/index.js', 'strata/maps/ko.json', 'strata/maps/topik-i.json'].sort());
  for (const [name, hash] of Object.entries(manifest.files)) assert.equal(sha(path.join(talk, 'lib/atlas', name)), hash);
  assert.match(manifest.engine, /^atlas-\d+\.\d+\.\d+$/);
  assert.equal(fs.existsSync(path.join(website, 'dist')), false);
  assert.equal(run('--consumer', 'talk', '--check').status, 0);
  fs.appendFileSync(path.join(talk, 'lib/atlas/preferences.js'), '\n// drift');
  fs.unlinkSync(path.join(talk, 'lib/atlas/flow.js'));
  const drift = run('--consumer', 'talk', '--check');
  assert.notEqual(drift.status, 0);
  assert.match(drift.stderr, /preferences\.js: differs/);
  assert.match(drift.stderr, /flow\.js: missing/, 'every difference is listed at once');
  assert.match(fs.readFileSync(path.join(talk, 'lib/atlas/preferences.js'), 'utf8'), /drift/, 'check changes nothing');
});

test('LF and CRLF checkouts keep the same manifest and do not rewrite equivalent source', t => {
  const { talk, run, write } = fixture(t);
  talkLikeImports(write);
  assert.equal(run('--consumer','talk').status,0);
  const manifestFile=path.join(talk,'lib/atlas/sync-manifest.json');
  const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
  for(const name of [...Object.keys(manifest.files),'sync-manifest.json']){
    const file=path.join(talk,'lib/atlas',name);
    fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace(/\r?\n/g,'\r\n'));
  }
  const check=run('--consumer','talk','--check');assert.equal(check.status,0,check.stderr);
  const before=fs.readFileSync(manifestFile);
  const again=run('--consumer','talk');assert.equal(again.status,0,again.stderr);
  assert.deepEqual(fs.readFileSync(manifestFile),before,'equivalent checkout should not be rewritten');
});

test('a copy nothing imports any more is removed; Talk\'s own files and edited copies are kept', t => {
  const { talk, website, run, write } = fixture(t);
  fs.unlinkSync(path.join(website, 'package.json'));
  write('src/consult.js', "import { choose } from '../lib/atlas/ask.js';\n");
  assert.equal(run('--consumer', 'talk').status, 0);
  assert.ok(fs.existsSync(path.join(talk, 'lib/atlas/ask.js')));
  write('lib/atlas/local-note.js', '// Talk-only file next to the copy');
  fs.unlinkSync(path.join(talk, 'src/consult.js'));
  const result = run('--consumer', 'talk');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /removed .*ask\.js/);
  assert.equal(fs.existsSync(path.join(talk, 'lib/atlas/ask.js')), false);
  assert.equal(fs.readFileSync(path.join(talk, 'lib/atlas/local-note.js'), 'utf8'), '// Talk-only file next to the copy');
  // An edited copy that is no longer needed is left for a person and reported.
  write('src/consult.js', "import { choose } from '../lib/atlas/ask.js';\n");
  assert.equal(run('--consumer', 'talk').status, 0);
  fs.appendFileSync(path.join(talk, 'lib/atlas/ask.js'), '\n// edited in Talk');
  fs.unlinkSync(path.join(talk, 'src/consult.js'));
  const kept = run('--consumer', 'talk');
  assert.notEqual(kept.status, 0);
  assert.match(kept.stderr, /ask\.js: no longer needed, but edited in place/);
  assert.ok(fs.existsSync(path.join(talk, 'lib/atlas/ask.js')));
});

test('the server bundle is rebuilt by Talk\'s own generator in the same run and checked', t => {
  const { talk, website, run, write } = fixture(t);
  fs.unlinkSync(path.join(website, 'package.json'));
  // A stand-in for Talk's tools/synk-server-build.js with the same build()/write() shape.
  write('tools/synk-server-build.js', "const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');\n"
    + "function build(){return '// bundle\\n'+fs.readFileSync(path.join(root,'lib/atlas/trail.js'),'utf8').length+':'+fs.readFileSync(path.join(root,'lib/atlas/engine.js'),'utf8').length;}\n"
    + "function write(){const f=path.join(root,'supabase/functions/_shared/synk-atlas.js');fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,build());}\nmodule.exports={build,write};\n");
  const result = run('--consumer', 'talk');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /rebuilt .*synk-atlas\.js/);
  const bundle = path.join(talk, 'supabase/functions/_shared/synk-atlas.js');
  assert.match(fs.readFileSync(bundle, 'utf8'), /^\/\/ bundle/);
  assert.match(result.stdout, /engine \(none\) -> atlas-/, 'a changed engine version is called out with the deploy order');
  assert.match(result.stdout, /deploy synk-account, synk-learning and events before releasing an app/);
  assert.equal(run('--consumer', 'talk', '--check').status, 0);
  fs.writeFileSync(bundle, '// stale');
  const stale = run('--consumer', 'talk', '--check');
  assert.notEqual(stale.status, 0);
  assert.match(stale.stderr, /synk-atlas\.js: not rebuilt/);
});

test('an import with no canonical source stops before anything is written', t => {
  const { talk, website, run, write } = fixture(t);
  write('src/x.js', "import nope from '../lib/atlas/nope.js';\n");
  const result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /lib\/atlas\/nope\.js, which has no canonical source \(src\/x\.js\)/);
  assert.equal(fs.existsSync(path.join(talk, 'lib')), false);
  assert.equal(fs.existsSync(path.join(website, 'dist')), false);
});

test('default keeps both consumers, and validates all targets before any mutation', t => {
  const { talk, website, run } = fixture(t);
  fs.unlinkSync(path.join(website, 'package.json'));
  assert.notEqual(run().status, 0);
  assert.equal(fs.existsSync(path.join(talk, 'lib')), false);
  fs.writeFileSync(path.join(website, 'package.json'), '{}');
  assert.equal(run().status, 0);
  assert.deepEqual(fs.readdirSync(path.join(website, 'dist/try/letter/atlas')).sort(), ['engine.js', 'experiences.js']);
  assert.equal(run('--check').status, 0);
});

test('website sync copies only its imports and preserves files outside that consumer contract', t => {
  const { talk, website, run } = fixture(t);
  fs.unlinkSync(path.join(talk, 'package.json'));
  const atlas = path.join(website, 'dist/try/letter/atlas');
  fs.mkdirSync(atlas, { recursive: true });
  fs.writeFileSync(path.join(atlas, 'local-custom.js'), '// existing consumer work');
  const result = run('--consumer', 'website');
  assert.equal(result.status, 0, result.stderr);
  for (const name of ['engine.js', 'experiences.js']) assert.deepEqual(fs.readFileSync(path.join(atlas, name)), fs.readFileSync(path.join(root, 'atlas', name)));
  assert.deepEqual(fs.readdirSync(atlas).sort(), ['engine.js', 'experiences.js', 'local-custom.js']);
  assert.equal(fs.readFileSync(path.join(atlas, 'local-custom.js'), 'utf8'), '// existing consumer work');
  assert.equal(fs.existsSync(path.join(talk, 'lib')), false);
  assert.equal(run('--consumer', 'website', '--check').status, 0);
});

test('after the website copy changes, the website\'s own cache-key step runs; with nothing new it does not', t => {
  const { talk, website, run } = fixture(t);
  fs.unlinkSync(path.join(talk, 'package.json'));
  // A stand-in for SYNK-website's sync-letter-copy.mjs: it hashes the copied engine into the page.
  fs.writeFileSync(path.join(website, 'sync-letter-copy.mjs'), "import fs from 'node:fs';import crypto from 'node:crypto';\n"
    + "const v=crypto.createHash('sha256').update(fs.readFileSync('dist/try/letter/atlas/engine.js')).digest('hex').slice(0,12);\n"
    + "fs.writeFileSync('page.txt','engine.js?v='+v);fs.appendFileSync('runs.txt','run\\n');\n");
  const first = run('--consumer', 'website');
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /ran .*sync-letter-copy\.mjs/);
  const engine = fs.readFileSync(path.join(website, 'dist/try/letter/atlas/engine.js'));
  assert.equal(fs.readFileSync(path.join(website, 'page.txt'), 'utf8'), `engine.js?v=${crypto.createHash('sha256').update(engine).digest('hex').slice(0, 12)}`);
  assert.equal(run('--consumer', 'website').status, 0);
  assert.equal(fs.readFileSync(path.join(website, 'runs.txt'), 'utf8'), 'run\n', 'nothing changed, so the page is left as it is');
  fs.writeFileSync(path.join(website, 'sync-letter-copy.mjs'), "throw new Error('copy source broken');\n");
  fs.appendFileSync(path.join(website, 'dist/try/letter/atlas/engine.js'), '\n// stale');
  const failed = run('--consumer', 'website');
  assert.notEqual(failed.status, 0);
  assert.match(failed.stderr, /sync-letter-copy\.mjs failed after the copy/);
});

test('unknown or missing selectors fail without falling back to every consumer', t => {
  const { talk, run } = fixture(t);
  for (const args of [['--consumer'], ['--consumer', 'typo'], ['--typo']]) {
    assert.notEqual(run(...args).status, 0);
  }
  assert.equal(fs.existsSync(path.join(talk, 'lib')), false);
});
