'use strict';
// The engine screen in the resources (SOLIO_ONE_CLIENT.md 2.2): stage-resources.cjs puts every file stage-ui.cjs makes in
// dist/ under resources/ui/ too, with its size and SHA-256 in the manifest, so SYNK 솔리오 can serve that screen from the
// installed folder by the manifest alone. The whole staging, which needs the pinned restic, is checked in run-exe.test.cjs and
// host-exe.e2e.cjs, whose executables check the staged manifest.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { uiFiles, UI_FILES } = require('../scripts/stage-resources.cjs');
const { FILES, MODULES } = require('../scripts/stage-ui.cjs');

function fakeDist(root) {
  const dist = path.join(root, 'dist');
  for (const name of FILES) { const file = path.join(dist, ...name.split('/')); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `screen ${name}`); }
  return dist;
}

test('the screen files are stage-ui\'s own list, and the bundle check requires its page and bridge', () => {
  assert.equal(UI_FILES, FILES);
  for (const name of ['index.html', 'style.css', 'bridge.js', ...MODULES, 'fonts/SUIT-Variable.woff2']) assert.ok(FILES.includes(name), name);
  assert.ok(!FILES.includes('engine-fixtures.js'), 'test states stay out');
  const required = fs.readFileSync(path.join(__dirname, '../src-tauri/src/bundle.rs'), 'utf8').match(/const REQUIRED: \[&str; \d+\] = \[([^\]]+)\]/)[1];
  for (const name of ['ui/index.html', 'ui/bridge.js']) assert.ok(required.includes(`"${name}"`), name);
  for (const name of required.match(/"ui\/[^"]+"/g)) assert.ok(FILES.includes(name.slice(4, -1)), `${name} is one stage-ui makes`);
});

test('every screen file is read from dist as a plain file, or the staging stops', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swb-stage-ui-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dist = fakeDist(root);
  const read = await uiFiles(dist);
  assert.deepEqual(read.map(([name]) => name), FILES);
  assert.equal(read.find(([name]) => name === 'fonts/LICENSE_OFL.txt')[1].toString(), 'screen fonts/LICENSE_OFL.txt');
  fs.rmSync(path.join(dist, 'app.js'));
  await assert.rejects(uiFiles(dist), /UI file missing: app\.js/);
  fs.mkdirSync(path.join(dist, 'app.js'));
  await assert.rejects(uiFiles(dist), /UI file missing: app\.js/, 'a folder in its place');
});

