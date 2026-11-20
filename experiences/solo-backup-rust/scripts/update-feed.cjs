'use strict';
// The update feed of SYNK 업무 백업 (STAGE1_DESIGN.md 4.10): the Tauri updater's static JSON for one signed
// installer. It sits beside the PC app's feed (https://synk.im/desktop/releases/workbackup.json, the app's
// tauri.conf.json `plugins.updater.endpoints`) and names the installer where it is downloaded from.
//   node update-feed.cjs <setup.exe> <setup.exe.sig> <download url> <out.json> [notes]
// The signature must be minisign's, made with `tauri signer sign --app-version <version>`, so its trusted
// comment — covered by the signature — names this version and this file (the app sets requireSignedVersion).
// It does not check the signature itself: the app does, against its built-in key, and the clean-Windows
// update test checks that the app refuses a wrong one.
const crypto = require('node:crypto'), fs = require('node:fs'), path = require('node:path');

const SETUP = /^SynkWorkBackup-(\d+\.\d+\.\d+)-setup\.exe$/;

function trustedComment(signature) {
  // `signature` is base64 of the .sig file: an untrusted comment line, the signature, the trusted comment line and
  // the global signature (minisign's format).
  const text = Buffer.from(signature, 'base64').toString('utf8');
  const line = text.split('\n').find(l => l.startsWith('trusted comment: '));
  if (!line) throw Error('signature has no trusted comment');
  return Object.fromEntries(line.slice('trusted comment: '.length).split('\t').map(f => { const i = f.indexOf(':'); return [f.slice(0, i), f.slice(i + 1)]; }));
}

function feed({ setup, signature, url, notes = '', now = new Date() }) {
  const name = path.basename(setup), version = SETUP.exec(name)?.[1];
  if (!version) throw Error(`installer name must be SynkWorkBackup-<version>-setup.exe (${name})`);
  const sig = fs.readFileSync(signature, 'utf8').trim();
  if (!/^[A-Za-z0-9+/=]+$/.test(sig)) throw Error('signature file is not base64');
  const comment = trustedComment(sig);
  if (comment.version !== version) throw Error(`signature is for version ${comment.version ?? '(none)'}, not ${version}; sign with --app-version ${version}`);
  if (comment.file !== name) throw Error(`signature is for ${comment.file}, not ${name}`);
  const address = new URL(url);
  if (!['https:', 'http:'].includes(address.protocol) || path.posix.basename(address.pathname) !== name) throw Error('download url must end in the installer name');
  if (typeof notes !== 'string' || notes.length > 500) throw Error('notes: 500 characters at most');
  const bytes = fs.readFileSync(setup), sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  // size and sha256 are for the SYNK PC app's Solio backup room (desktop/src/solio-backup.cjs validateFeed, STAGE1_DESIGN.md 4.13):
  // it downloads this installer itself and checks both before the signature. The Tauri updater (2.14.1) reads only
  // url and signature and ignores other fields.
  const entry = { signature: sig, url: address.href, size: bytes.length, sha256 };
  // The updater looks for <target>-<installer> first, then <target>.
  return {
    feed: { version, notes, pub_date: now.toISOString().replace(/\.\d{3}Z$/, 'Z'), platforms: { 'windows-x86_64-nsis': entry, 'windows-x86_64': entry } },
    sha256,
  };
}

module.exports = { feed, trustedComment };
if (require.main === module) {
  const [setup, signature, url, out, notes] = process.argv.slice(2);
  if (!setup || !signature || !url || !out) { console.error('usage: update-feed <setup.exe> <setup.exe.sig> <download url> <out.json> [notes]'); process.exitCode = 64; }
  else {
    const { feed: value, sha256 } = feed({ setup, signature, url, notes });
    fs.writeFileSync(out, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ out, version: value.version, sha256 }));
  }
}
