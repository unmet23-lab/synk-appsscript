'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

test('Talk bundle and source hashes stay stable across LF and CRLF checkouts', (t) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-talk-bundle-'));
  t.after(() => {
    assert.equal(path.dirname(temporaryRoot), path.resolve(os.tmpdir()));
    assert.ok(path.basename(temporaryRoot).startsWith('synk-talk-bundle-'));
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  });
  const repository = path.join(temporaryRoot, 'repository');
  const talkRoot = path.join(temporaryRoot, 'talk');
  const generatorPath = path.join(repository, 'tools', 'build-talk-publication-runtime.cjs');
  fs.mkdirSync(path.dirname(generatorPath), { recursive: true });
  fs.copyFileSync(path.resolve(__dirname, '../tools/build-talk-publication-runtime.cjs'), generatorPath);
  const { build } = require(generatorPath);
  const sources = {
    'lib/synkbrief-publication.js': "'use strict';\nconst { value } = require('./shared.js');\nmodule.exports = { publication: () => value };\n",
    'tools/synkbrief-drive-manifest-upload.js': "#!/usr/bin/env node\n'use strict';\nconst { value } = require('../lib/shared.js');\nmodule.exports = { upload: () => value + 1 };\n",
    'lib/synkbrief-drive.js': "'use strict';\nconst { value } = require('./shared.js');\nmodule.exports = { drive: () => value + 2 };\n",
    'lib/shared.js': "'use strict';\nmodule.exports = { value: 7 };\n",
  };
  function writeSources(lineEnding) {
    for (const [file, source] of Object.entries(sources)) {
      const destination = path.join(talkRoot, file);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, source.replace(/\n/g, lineEnding));
    }
  }
  const outputDirectory = path.join(repository, 'tools', 'lib', 'generated');
  const outputNames = ['talk-publication.cjs', 'talk-publication.sources.json'];
  const readOutputs = () => Object.fromEntries(outputNames.map((name) => [
    name, fs.readFileSync(path.join(outputDirectory, name), 'utf8'),
  ]));

  writeSources('\n');
  assert.equal(build(talkRoot).files, 4);
  const lfOutputs = readOutputs();
  const metadata = JSON.parse(lfOutputs['talk-publication.sources.json']);
  assert.equal(Object.keys(metadata.files).length, 4);
  for (const [file, source] of Object.entries(sources)) {
    assert.equal(metadata.files[file], crypto.createHash('sha256').update(source).digest('hex'));
  }
  assert.equal(build(talkRoot, { check: true }).checked, true);

  writeSources('\r\n');
  assert.equal(build(talkRoot, { check: true }).checked, true);
  assert.equal(build(talkRoot).files, 4);
  assert.deepEqual(readOutputs(), lfOutputs);
  for (const name of outputNames) {
    fs.writeFileSync(path.join(outputDirectory, name), lfOutputs[name].replace(/\n/g, '\r\n'));
  }
  assert.equal(build(talkRoot, { check: true }).checked, true);
  writeSources('\n');
  assert.equal(build(talkRoot, { check: true }).checked, true);

  const runtime = require(path.join(outputDirectory, 'talk-publication.cjs'));
  assert.deepEqual([runtime.publication(), runtime.upload(), runtime.drive()], [7, 8, 9]);
  fs.writeFileSync(path.join(talkRoot, 'lib/shared.js'), "'use strict';\nmodule.exports = { value: 8 };\n");
  assert.throws(() => build(talkRoot, { check: true }), /Talk publication output is stale: talk-publication\.cjs/);
});
