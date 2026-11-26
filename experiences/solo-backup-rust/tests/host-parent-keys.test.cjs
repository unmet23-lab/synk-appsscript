'use strict';
// The windowless host takes as its parent only SYNK 솔리오's PC app named by that app's own uninstall entry under this
// account (host.rs SOLIO_UNINSTALL, GPT workbackup-solio-one-be-20261127-r2 GA4). electron-builder names a per-user
// install's entry by UUID v5 of the app id in its namespace (app-builder-lib NsisTarget); this works the two keys and
// executables out again from the PC app's catalog (desktop/src/catalog.cjs), so a change of app id there shows here.
// Reads files only; starts nothing.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { identity } = require('../../../desktop/src/catalog.cjs');

const NAMESPACE = '50e065bc-3134-11e6-9bab-38c9862bdaf3';
function uuidV5(name, namespace) {
  const hash = crypto.createHash('sha1').update(Buffer.from(namespace.replace(/-/g, ''), 'hex')).update(Buffer.from(name, 'utf8')).digest();
  const bytes = hash.subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

test('the host reads exactly the PC app\'s two uninstall entries: release and preview, each with its executable', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src-tauri', 'src', 'host.rs'), 'utf8');
  const table = source.match(/pub const SOLIO_UNINSTALL: \[\(&str, &str\); 2\] = \[([\s\S]*?)\];/);
  assert.ok(table, 'host.rs SOLIO_UNINSTALL');
  const entries = [...table[1].matchAll(/\("([0-9a-f-]{36})", "([^"]+)"\)/g)].map((m) => [m[1], m[2]]);
  const expected = ['production', 'development'].map((mode) => { const app = identity('platform', mode); return [uuidV5(app.appId, NAMESPACE), `${app.executableName}.exe`]; });
  assert.deepEqual(entries, expected);
  // The namespace is electron-builder's (the preview key on a real PC is c4ee183e-…).
  assert.equal(uuidV5('im.synk.platform.preview', NAMESPACE), 'c4ee183e-8850-55ce-9d7f-a3a1acb8c830');
});
