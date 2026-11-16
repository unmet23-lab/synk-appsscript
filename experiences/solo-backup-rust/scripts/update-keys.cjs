'use strict';
// The update signing keys of SYNK 업무 백업 (STAGE1_DESIGN.md 4.10 「열쇠 보관」, 11-16 유호님 「추천대로 만들어」): the same
// shape as the PC app's (desktop/tools/update-signing.cjs). Only the publisher's own PC signs. The keys live in
// ~/SYNK_보안/workbackup-update-signing, which the restore system backs up only as ciphertext, and never enter this
// public repository, its Actions secrets or a release folder.
//   node update-keys.cjs make                       make the operating and recovery key pairs once (stops if the folder exists)
//   node update-keys.cjs sign <SynkWorkBackup-<v>-setup.exe> [--key <secret key file>]
//                                                   sign for version <v> and keep the signature only if a key built into the
//                                                   app (tauri.conf.json) verifies it
//   node update-keys.cjs verify <file> <file.sig>   which built-in key, if any, verifies the signature
//   node update-keys.cjs check-recovery             asks the restore passphrase, opens the recovery key into a temporary
//                                                   folder, signs a test file with it, verifies it and deletes the folder
// The operating key has no password of its own (the folder is the secret layer, like the PC app's operating key). The
// recovery key's plaintext never touches disk when it is made: it goes straight into SYNK-ENC-1 ciphertext for the
// owner's backup key (tools/복원/암호.js), which only the owner's passphrase opens. Losing both keys means the installed
// copies can never be updated again (the Tauri updater trusts only the keys built into them).
const crypto = require('node:crypto'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');

const APP = path.resolve(__dirname, '..');
const REPO = path.resolve(APP, '..', '..');
const KEY_DIRECTORY = process.env.SYNK_WORKBACKUP_SIGNING_DIR || path.join(os.homedir(), 'SYNK_보안', 'workbackup-update-signing');
const TAURI = path.join(APP, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');
const CONFIG = path.join(APP, 'src-tauri', 'tauri.conf.json');
const SETUP = /^SynkWorkBackup-(\d+\.\d+\.\d+)-setup\.exe$/;

function tauri(args, env = {}) {
  const r = spawnSync(process.execPath, [TAURI, ...args], { encoding: 'utf8', env: { ...process.env, CI: 'true', ...env }, windowsHide: true });
  if (r.status !== 0) throw Error(`tauri ${args.slice(0, 2).join(' ')} failed (exit ${r.status})`);
  return r.stdout;
}

// A key pair from the CLI's own output, held only in memory: the base64 line after 「Private:」 and after 「Public:」.
function generate() {
  const lines = tauri(['signer', 'generate', '--ci']).split(/\r?\n/).map(l => l.trim());
  const after = label => lines[lines.findIndex(l => l.startsWith(label)) + 1];
  const secret = after('Private:'), pub = after('Public:');
  if (!/^[A-Za-z0-9+/=]{100,}$/.test(secret || '') || !/^[A-Za-z0-9+/=]{100,}$/.test(pub || '')) throw Error('unexpected tauri signer output');
  return { secret, pub };
}

// minisign's public key (Tauri keeps its text as base64): 「Ed」, the key id and the Ed25519 key.
function publicKey(pub) {
  const line = Buffer.from(pub, 'base64').toString('utf8').split('\n').map(l => l.trim()).find(l => l && !l.startsWith('untrusted comment:'));
  const raw = Buffer.from(line || '', 'base64');
  if (raw.length !== 42 || raw.toString('latin1', 0, 2) !== 'Ed') throw Error('not a minisign public key');
  return { id: raw.subarray(2, 10).toString('hex'), key: crypto.createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: raw.subarray(10).toString('base64url') }, format: 'jwk' }) };
}

// minisign's signature check, as the updater does it: the file's signature (prehashed with BLAKE2b-512 for 「ED」) and the
// global signature over that signature and the trusted comment. Returns the trusted comment's fields.
function verify(file, signature, pub) {
  const { id, key } = publicKey(pub);
  const lines = Buffer.from(signature.trim(), 'base64').toString('utf8').split('\n').map(l => l.replace(/\r$/, ''));
  const sigLine = lines.find((l, i) => i > 0 && l && !l.includes(':'));
  const commentLine = lines.find(l => l.startsWith('trusted comment: '));
  const globalLine = lines[lines.indexOf(commentLine) + 1];
  const raw = Buffer.from(sigLine || '', 'base64');
  if (raw.length !== 74 || !commentLine || !globalLine) throw Error('not a minisign signature');
  const algorithm = raw.toString('latin1', 0, 2), keyId = raw.subarray(2, 10).toString('hex'), value = raw.subarray(10);
  if (keyId !== id) return null;
  const data = fs.readFileSync(file);
  const message = algorithm === 'ED' ? crypto.createHash('blake2b512').update(data).digest() : algorithm === 'Ed' ? data : null;
  if (!message || !crypto.verify(null, message, key, value)) return null;
  const comment = commentLine.slice('trusted comment: '.length);
  if (!crypto.verify(null, Buffer.concat([value, Buffer.from(comment, 'utf8')]), key, Buffer.from(globalLine, 'base64'))) return null;
  return Object.fromEntries(comment.split('\t').map(f => { const i = f.indexOf(':'); return [f.slice(0, i), f.slice(i + 1)]; }));
}

// The keys the app has built in: the operating key the updater checks first, the recovery key it tries next.
function builtIn(config = JSON.parse(fs.readFileSync(CONFIG, 'utf8'))) {
  const keys = [];
  if (config.plugins?.updater?.pubkey) keys.push({ role: 'operating', pub: config.plugins.updater.pubkey });
  if (config.plugins?.synkUpdate?.recoveryPubkey) keys.push({ role: 'recovery', pub: config.plugins.synkUpdate.recoveryPubkey });
  return keys;
}
function whichKey(file, signature, keys = builtIn()) {
  for (const k of keys) { const comment = verify(file, signature, k.pub); if (comment) return { role: k.role, id: publicKey(k.pub).id, comment }; }
  return null;
}

function plainFile(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096) throw Error(`not a regular key file: ${file}`);
  return fs.readFileSync(file, 'utf8').trim();
}

async function make(directory = KEY_DIRECTORY) {
  if (fs.existsSync(directory)) throw Error(`the signing key folder already exists; keys are made once: ${directory}`);
  const backup = require(path.join(REPO, 'tools', '복원', '암호.js'));
  const backupPublic = fs.readFileSync(backup.PUB(), 'utf8');
  const operating = generate(), recovery = generate();
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(directory, 'operating.key'), operating.secret + '\n', { flag: 'wx', mode: 0o600 });
  fs.writeFileSync(path.join(directory, 'operating.key.pub'), operating.pub + '\n', { flag: 'wx' });
  const { Readable } = require('node:stream');
  await backup.encryptStream(backupPublic, Readable.from([Buffer.from(recovery.secret + '\n')]), path.join(directory, 'recovery.key.enc'), 'recovery.key');
  fs.writeFileSync(path.join(directory, 'recovery.key.pub'), recovery.pub + '\n', { flag: 'wx' });
  const pinned = [{ role: 'operating', id: publicKey(operating.pub).id, pubkey: operating.pub }, { role: 'recovery', id: publicKey(recovery.pub).id, pubkey: recovery.pub }];
  fs.writeFileSync(path.join(directory, 'pinned-keys.json'), JSON.stringify({ made: new Date().toISOString(), backupKeyId: backup.keyId(backupPublic), keys: pinned }, null, 2) + '\n', { flag: 'wx' });
  fs.writeFileSync(path.join(directory, 'README.md'), [
    '# SYNK 업무 백업 업데이트 서명 열쇠',
    '',
    '`operating.key`는 업데이트 설치 파일에 서명하는 운영 열쇠입니다. `recovery.key.enc`는 운영 열쇠를 잃었을 때 쓰는 비상 열쇠이고, 복원 암호로만 열립니다.',
    '두 공개 열쇠는 앱(`experiences/solo-backup-rust/src-tauri/tauri.conf.json`)에 들어 있습니다. 둘 다 잃으면 이미 깔린 앱을 더는 갱신할 수 없습니다.',
    '서명은 `node experiences/solo-backup-rust/scripts/update-keys.cjs sign <설치 파일>`로 하고, 비상 열쇠 확인은 `check-recovery`로 합니다.',
    '',
  ].join('\n'), { flag: 'wx' });
  return pinned.map(({ role, id, pubkey }) => ({ role, id, pubkey }));
}

function sign(setup, keyFile = path.join(KEY_DIRECTORY, 'operating.key')) {
  const name = path.basename(setup), version = SETUP.exec(name)?.[1];
  if (!version) throw Error(`installer name must be SynkWorkBackup-<version>-setup.exe (${name})`);
  const out = `${setup}.sig`;
  if (fs.existsSync(out)) throw Error(`a signature is already there: ${out}`);
  tauri(['signer', 'sign', '--app-version', version, setup], { TAURI_SIGNING_PRIVATE_KEY: plainFile(keyFile), TAURI_SIGNING_PRIVATE_KEY_PASSWORD: '' });
  // Only a signature that was checked stays: any failure on the way — reading the config or the signature included —
  // takes it away too, so a retry starts clean (GPT GA2).
  let signer = null;
  try { signer = whichKey(setup, fs.readFileSync(out, 'utf8')); } catch { signer = null; }
  if (!signer || signer.comment.version !== version || signer.comment.file !== name) {
    fs.rmSync(out, { force: true });
    throw Error('the signature is not one the app accepts (no built-in key verifies it for this version and file); removed it');
  }
  return { out, version, key: signer.role, id: signer.id };
}

function askHidden(question) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') { reject(Error('run it in a terminal window: the passphrase is typed, never piped')); return; }
    process.stdout.write(question);
    let s = '';
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
    const on = chunk => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') { stdin.setRawMode(false); stdin.pause(); stdin.off('data', on); process.stdout.write('\n'); resolve(s); return; }
        if (ch === '\u0003') { process.stdout.write('\n'); process.exit(130); }
        if (ch === '\u0008' || ch === '\u007f') { if (s) { s = s.slice(0, -1); process.stdout.write('\b \b'); } continue; }
        if (ch < ' ') continue;
        s += ch; process.stdout.write('*');
      }
    };
    stdin.on('data', on);
  });
}

async function checkRecovery(directory = KEY_DIRECTORY) {
  const backup = require(path.join(REPO, 'tools', '복원', '암호.js'));
  // The key the app has built in, not the folder's own list: a folder holding another key set must not pass (GPT GA1).
  const recoveryPub = builtIn().find(k => k.role === 'recovery')?.pub;
  if (!recoveryPub) throw Error('the app has no recovery key built in (tauri.conf.json plugins.synkUpdate.recoveryPubkey)');
  const pinned = JSON.parse(fs.readFileSync(path.join(directory, 'pinned-keys.json'), 'utf8'));
  if (pinned.keys.find(k => k.role === 'recovery')?.pubkey !== recoveryPub) throw Error('this folder\'s recovery key is not the one built into the app');
  const passphrase = await askHidden('복원 암호: ');
  const privateKey = backup.unlockPrivate(JSON.parse(fs.readFileSync(backup.PRIV(), 'utf8')), passphrase);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'swb-recovery-check-'));
  try {
    const keyFile = path.join(temp, 'recovery.key');
    await backup.decryptFile(privateKey, path.join(directory, 'recovery.key.enc'), keyFile);
    const test = path.join(temp, 'SynkWorkBackup-0.0.1-setup.exe');
    fs.writeFileSync(test, crypto.randomBytes(4096));
    tauri(['signer', 'sign', '--app-version', '0.0.1', test], { TAURI_SIGNING_PRIVATE_KEY: plainFile(keyFile), TAURI_SIGNING_PRIVATE_KEY_PASSWORD: '' });
    const signer = whichKey(test, fs.readFileSync(`${test}.sig`, 'utf8'), builtIn().filter(k => k.role === 'recovery'));
    const result = { checkedAt: new Date().toISOString(), recoveryKeyId: publicKey(recoveryPub).id, opened: true, signedAndVerified: Boolean(signer && signer.comment.version === '0.0.1') };
    fs.writeFileSync(path.join(directory, 'recovery-check.json'), JSON.stringify(result, null, 2) + '\n');
    return result;
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

module.exports = { publicKey, verify, builtIn, whichKey, sign, make, KEY_DIRECTORY };
if (require.main === module) {
  const [command, ...rest] = process.argv.slice(2);
  const main = async () => {
    if (command === 'make') return { made: KEY_DIRECTORY, keys: await make() };
    if (command === 'sign') { const at = rest.indexOf('--key'); return sign(rest[0], at >= 0 ? rest[at + 1] : undefined); }
    if (command === 'verify') { const signer = whichKey(rest[0], fs.readFileSync(rest[1], 'utf8')); if (!signer) process.exitCode = 3; return signer ? { key: signer.role, id: signer.id, version: signer.comment.version, file: signer.comment.file } : { key: null }; }
    if (command === 'check-recovery') { const r = await checkRecovery(); if (!r.signedAndVerified) process.exitCode = 3; return r; }
    process.exitCode = 64;
    return { usage: 'update-keys.cjs make | sign <setup.exe> [--key <file>] | verify <file> <file.sig> | check-recovery' };
  };
  main().then(v => console.log(JSON.stringify(v)), e => { console.error(e.message); process.exitCode = process.exitCode || 1; });
}
