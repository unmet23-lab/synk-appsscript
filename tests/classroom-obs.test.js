'use strict';

// Executes the production OBS Lua script with synthetic OBS/filesystem events.
// Use Lua on PATH, or set SYNK_LUA_BIN to lua.exe or fengari-node-cli/src/lua-cli.js.
// Example: npm install --prefix <temporary-dir> --no-save --package-lock=false --ignore-scripts fengari-node-cli@0.1.0
// Then: SYNK_LUA_BIN=<temporary-dir>/node_modules/fengari-node-cli/src/lua-cli.js node --test tests/classroom-obs.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const runtime = process.env.SYNK_LUA_BIN || 'lua';
const javascriptRuntime = /\.[cm]?js$/i.test(runtime);
const executable = javascriptRuntime ? process.execPath : runtime;
const prefix = javascriptRuntime ? [runtime] : [];
const probe = spawnSync(executable, [...prefix, '-v'], { encoding: 'utf8', timeout: 10000 });
const unavailable = !process.env.SYNK_LUA_BIN && probe.error?.code === 'ENOENT';

for (const scenario of ['success', 'early-stop', 'duplicate-start', 'zero-duration', 'clock-backward', 'open-failure', 'write-failure', 'close-failure', 'rename-failure', 'missing-path', 'duplicate-stop', 'existing-manifest', 'unarmed', 'manual-recovery']) {
  test(`OBS recording ownership: ${scenario}`, { skip: unavailable ? 'Lua unavailable: set SYNK_LUA_BIN to execute this regression' : false }, () => {
    assert.ifError(probe.error);
    assert.equal(probe.status, 0, probe.stderr);
    const result = spawnSync(executable, [...prefix, 'tests/fixtures/classroom-obs.lua', 'tools/classroom-media/obs-completed.lua', scenario], {
      cwd: root, encoding: 'utf8', timeout: 10000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    // Fengari 0.1.0 may return exit 0 after a Lua assertion; require its success marker too.
    assert.match(result.stdout, new RegExp(`PASS ${scenario}`), result.stderr);
  });
}
