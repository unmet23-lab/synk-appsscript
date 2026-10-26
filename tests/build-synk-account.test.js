'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const script = path.resolve(__dirname, '../tools/build-synk-account.js');
const source = fs.readFileSync(script, 'utf8');
const names = ['app', 'client', 'preview', 'platform', 'local-world', 'teacher'];

// Run the actual builder while isolating the filesystem and esbuild boundary.
// Invalid compiler output must not replace any of the six bundles or manifest.
// Earlier source copies/assets are intentionally outside that guarantee.
function runBuilder(mutate = files => files) {
  const root = path.resolve('virtual-portal-build'), dir = path.join(root, 'experiences/synk-account');
  const files = new Map(), writes = [], compileCalls = [];
  const readFileSync = (file, encoding) => {
    const content = files.get(file) || (String(file).endsWith('costume-assets.json') ? '{"assets":[]}'
      : String(file).endsWith('package.json') ? '{"dependencies":{"@supabase/supabase-js":"fixture"}}'
      : String(file).endsWith('index.html') ? '<title>SYNK ID</title><script src="./dist/app.js"></script>'
      : 'synthetic source\r\n');
    return encoding ? Buffer.from(content).toString(encoding) : Buffer.from(content);
  };
  const fakeFs = {
    readFileSync,
    existsSync: file => files.has(file),
    mkdirSync() {},
    writeFileSync(file, bytes) { assert.equal(files.has(file), false);files.set(file, Buffer.from(bytes)); },
    renameSync(from, to) { files.set(to, files.get(from));files.delete(from);writes.push(to); },
    unlinkSync: file => files.delete(file),
  };
  const esbuild = { buildSync(options) {
    compileCalls.push(options);
    if (options.format === 'esm') return { outputFiles: [{ contents: Buffer.from('wardrobe\n') }] };
    const outputs = names.map(name => ({ path: path.join(dir, 'dist', `${name}.js`), contents: Buffer.from(`${name}\r\n`) }));
    return { outputFiles: mutate(outputs, dir) };
  } };
  const requireStub = id => id === 'node:fs' ? fakeFs
    : id === './build-member-activity.js' ? { buildMemberActivity() {} }
    : id === 'esbuild-fixture' ? esbuild : require(id);
  requireStub.resolve = id => { assert.equal(id, 'esbuild');return 'esbuild-fixture'; };
  const context = { require: requireStub, __dirname: path.join(root, 'tools'), process: { argv: ['node', script], pid: 1 }, Buffer, console: { log() {} } };
  let error;
  try { vm.runInNewContext(source, context, { filename: script }); } catch (caught) { error = caught; }
  return { error, dir, files, writes, compileCalls };
}

for (const [name, mutate, message] of [
  ['missing output', files => files.slice(0, -1), /Missing portal bundle: teacher/],
  ['duplicate output', files => [...files, files[0]], /Unexpected or duplicate portal bundle/],
  ['unexpected name', (files, dir) => [...files, { path: path.join(dir, 'dist/extra.js'), contents: Buffer.from('extra') }], /Unexpected or duplicate portal bundle/],
  ['wrong directory with a valid name', files => files.map((file, index) => index ? file : { ...file, path: path.join(path.dirname(file.path), '../outside/app.js') }), /Unexpected or duplicate portal bundle/],
]) test(`portal compiler guards refuse ${name} before replacing compiled artifacts`, () => {
  const result = runBuilder(mutate);
  assert.match(result.error?.message || '', message);
  for (const output of [...names.map(name => `dist/${name}.js`), 'build-manifest.json']) {
    assert.equal(result.files.has(path.join(result.dir, output)), false, output);
  }
});

test('reordered compiler outputs retain entry ordering, LF bytes and manifest identities', () => {
  const result = runBuilder(files => files.reverse());
  assert.ifError(result.error);
  const expected = names.map(name => path.join(result.dir, 'dist', `${name}.js`));
  assert.deepEqual(result.writes.filter(file => expected.includes(file)), expected);
  for (const name of names) assert.equal(result.files.get(path.join(result.dir, 'dist', `${name}.js`)).toString(), `${name}\n`);
  const manifest = JSON.parse(result.files.get(path.join(result.dir, 'build-manifest.json')).toString());
  assert.deepEqual(Object.keys(manifest.sha256).filter(file => names.some(name => file === `dist/${name}.js`)), names.map(name => `dist/${name}.js`));
  assert.equal(result.compileCalls.filter(options => options.format === 'iife').length, 1);
});
