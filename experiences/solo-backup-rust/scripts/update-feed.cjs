'use strict';
// The update feed of SYNK 업무 백업 (STAGE1_DESIGN.md 4.10): the Tauri updater's static JSON for one signed
// installer. It sits beside the PC app's feed (https://synk.im/desktop/releases/workbackup.json, the app's
// tauri.conf.json `plugins.updater.endpoints`) and names the installer where it is downloaded from. SYNK 솔리오's
// 「백업」 room reads the same feed to install the engine (desktop/src/solio-backup.cjs `validateFeed`): for it the entry
// also says the installer's `size` (bytes) and `sha256` (lowercase hex), which the Tauri updater does not read (11-20).
//   node update-feed.cjs [--local-test] <setup.exe> <setup.exe.sig> <download url> <out.json> [notes]
// `--local-test` is the clean-Windows exercise's alone: its packages are served from this PC (http://127.0.0.1/<name>).
// The signature must be minisign's, made with `tauri signer sign --app-version <version>`, so its trusted
// comment — covered by the signature — names this version and this file (the app sets requireSignedVersion).
// It does not check the signature itself: the app does, against its built-in key, and the clean-Windows
// update test checks that the app refuses a wrong one.
const crypto = require('node:crypto'), fs = require('node:fs'), path = require('node:path');

// The versions, size and address SYNK 솔리오 takes (solio-backup.cjs VERSION · SETUP_MAX · the release address).
const SETUP = /^SynkWorkBackup-((?:0|[1-9]\d{0,5})\.(?:0|[1-9]\d{0,5})\.(?:0|[1-9]\d{0,5}))-setup\.exe$/;
const SETUP_MAX = 512 * 1024 * 1024;
const release = (version, name) => `https://github.com/unmet23-lab/synk-policy/releases/download/workbackup-${version}/${name}`;
// The clean-Windows exercise serves its packages from this PC (test-support/clean-update.ps1), and asks for it.
const loopback = (address, name) => address.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(address.hostname) && address.pathname === `/${name}` && !address.search;

/** minisign's shape, as SYNK 솔리오 reads it (solio-backup.cjs parseSignature): an untrusted comment, the signature (ED, key
 *  id, 64 bytes), the trusted comment and the 64-byte global signature. Whether a key verifies it is the app's to check. */
function minisignShape(signature) {
  const lines = Buffer.from(signature, 'base64').toString('utf8').split('\n').map(l => l.replace(/\r$/, ''));
  const at = lines.findIndex(l => l.startsWith('trusted comment: '));
  const raw = Buffer.from(lines[1] || '', 'base64'), global = Buffer.from(lines[at + 1] || '', 'base64');
  return at >= 2 && lines[0].startsWith('untrusted comment:') && raw.length === 74 && raw.toString('latin1', 0, 2) === 'ED' && global.length === 64;
}

function trustedComment(signature) {
  // `signature` is base64 of the .sig file: an untrusted comment line, the signature, the trusted comment line and
  // the global signature (minisign's format).
  const text = Buffer.from(signature, 'base64').toString('utf8');
  const line = text.split('\n').find(l => l.startsWith('trusted comment: '));
  if (!line) throw Error('signature has no trusted comment');
  return Object.fromEntries(line.slice('trusted comment: '.length).split('\t').map(f => { const i = f.indexOf(':'); return [f.slice(0, i), f.slice(i + 1)]; }));
}

function feed({ setup, signature, url, notes = '', now = new Date(), localTest = false }) {
  const name = path.basename(setup), version = SETUP.exec(name)?.[1];
  if (!version) throw Error(`installer name must be SynkWorkBackup-<version>-setup.exe (${name})`);
  const sig = fs.readFileSync(signature, 'utf8').trim();
  if (!/^[A-Za-z0-9+/=]+$/.test(sig) || sig.length > 4096) throw Error('signature file is not base64 of 4096 characters at most');
  if (!minisignShape(sig)) throw Error('signature file is not a whole minisign signature');
  const comment = trustedComment(sig);
  if (comment.version !== version) throw Error(`signature is for version ${comment.version ?? '(none)'}, not ${version}; sign with --app-version ${version}`);
  if (comment.file !== name) throw Error(`signature is for ${comment.file}, not ${name}`);
  const address = new URL(url);
  if (path.posix.basename(address.pathname) !== name) throw Error('download url must end in the installer name');
  if (address.href !== release(version, name) && !(localTest && loopback(address, name))) throw Error(`download url must be ${release(version, name)}`);
  if (typeof notes !== 'string' || notes.length > 500) throw Error('notes: 500 characters at most');
  const size = fs.statSync(setup).size;
  if (!size || size > SETUP_MAX) throw Error(`installer must be 1 to ${SETUP_MAX} bytes`);
  const bytes = fs.readFileSync(setup);
  if (bytes.length !== size) throw Error('installer changed while it was read');
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const entry = { signature: sig, url: address.href, size: bytes.length, sha256 };
  // The updater looks for <target>-<installer> first, then <target>.
  return {
    feed: { version, notes, pub_date: now.toISOString().replace(/\.\d{3}Z$/, 'Z'), platforms: { 'windows-x86_64-nsis': entry, 'windows-x86_64': entry } },
    sha256,
  };
}

module.exports = { feed, trustedComment };
if (require.main === module) {
  const args = process.argv.slice(2), localTest = args[0] === '--local-test';
  const [setup, signature, url, out, notes] = localTest ? args.slice(1) : args;
  if (!setup || !signature || !url || !out) { console.error('usage: update-feed [--local-test] <setup.exe> <setup.exe.sig> <download url> <out.json> [notes]'); process.exitCode = 64; }
  else {
    const { feed: value, sha256 } = feed({ setup, signature, url, notes, localTest });
    fs.writeFileSync(out, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ out, version: value.version, sha256 }));
  }
}
