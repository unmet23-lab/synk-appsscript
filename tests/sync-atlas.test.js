'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const script = path.join(root, 'tools/sync-atlas.js');

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
  return { temp, talk, website, run };
}

test('selected consumer syncs the shared files without touching the other app', t => {
  const { talk, website, run } = fixture(t);
  fs.unlinkSync(path.join(website, 'package.json'));
  const result = run('--consumer', 'talk');
  assert.equal(result.status, 0, result.stderr);
  for (const name of ['engine.js', 'experiences.js', 'preferences.js', 'education.js', 'vellum.js', 'trail.js', 'temper.js']) {
    assert.deepEqual(fs.readFileSync(path.join(talk, 'lib/atlas', name)), fs.readFileSync(path.join(root, 'atlas', name)));
  }
  for (const name of ['index.js', 'maps/ko.json']) assert.deepEqual(fs.readFileSync(path.join(talk, 'lib/atlas/strata', name)), fs.readFileSync(path.join(root, 'strata', name)));
  assert.equal(fs.existsSync(path.join(website, 'dist')), false);
  assert.equal(run('--consumer', 'talk', '--check').status, 0);
  fs.appendFileSync(path.join(talk, 'lib/atlas/preferences.js'), '\n// drift');
  assert.notEqual(run('--consumer', 'talk', '--check').status, 0);
  assert.match(fs.readFileSync(path.join(talk, 'lib/atlas/preferences.js'), 'utf8'), /drift/);
});

test('default keeps both consumers, and validates all targets before any mutation', t => {
  const { talk, website, run } = fixture(t);
  fs.unlinkSync(path.join(website, 'package.json'));
  assert.notEqual(run().status, 0);
  assert.equal(fs.existsSync(path.join(talk, 'lib')), false);
  fs.writeFileSync(path.join(website, 'package.json'), '{}');
  assert.equal(run().status, 0);
  assert.equal(fs.existsSync(path.join(website, 'dist/try/letter/atlas/preferences.js')), true);
  assert.equal(run('--check').status, 0);
});

test('unknown or missing selectors fail without falling back to every consumer', t => {
  const { talk, run } = fixture(t);
  for (const args of [['--consumer'], ['--consumer', 'typo'], ['--typo']]) {
    assert.notEqual(run(...args).status, 0);
  }
  assert.equal(fs.existsSync(path.join(talk, 'lib')), false);
});
