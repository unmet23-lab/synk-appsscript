// 원본창고 암호.js의 사본(복원 체계가 새 노트북에서 창고 도구 없이도 돌도록 저장소에 둔다, 형식 SYNK-ENC-1 동일). 다른 점은 시험용 makeKeys 내보내기뿐이다.
// 창고 암호 — 서버 백업처럼 개인정보·비밀이 든 파일은 유호님만 여는 열쇠로 암호화해서 창고에 넣는다(10-17 유호님 「내가 열쇠를 갖는 방식으로 암호화해서」).
// 방식: 파일마다 새 AES-256-GCM 열쇠로 암호화하고, 그 열쇠를 RSA-4096 공개키(OAEP·SHA-256)로 싼다. 풀려면 비밀키가 필요하다.
// 비밀키는 유호님 암호에서 scrypt(N=2^17)로 뽑은 열쇠로 다시 AES-256-GCM 잠금한다. 암호는 이 PC 어디에도 저장하지 않는다.
//   node 암호.js 열쇠만들기      암호를 두 번 물어 열쇠 한 쌍을 ~/.synk-backup-key/에 만든다(이미 있으면 멈춘다)
//   node 암호.js 풀기 <파일.enc> [출력]   암호를 물어 비밀키를 풀고 파일을 되살린다(인증 태그가 맞을 때만 출력 이름으로 바꾼다)
//   node 암호.js 시험            임시 열쇠로 암호화→복호화 왕복을 확인한다
// 파일 형식: "SYNK-ENC-1\n" + 머리 JSON 한 줄 + 암호문 + GCM 태그 16바이트. 원본 크기·해시는 따로 둔 목록에 적는다.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const KEY_DIR = process.env.SYNK_BACKUP_KEY_DIR || path.join(os.homedir(), '.synk-backup-key');
const PUB = () => path.join(KEY_DIR, '공개키.pem');
const PRIV = () => path.join(KEY_DIR, '비밀키_잠금.json');
const MAGIC = 'SYNK-ENC-1\n';
const SCRYPT = { N: 1 << 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

const keyId = (pubPem) => crypto.createHash('sha256').update(crypto.createPublicKey(pubPem).export({ type: 'spki', format: 'der' })).digest('hex').slice(0, 16);

function lockPrivate(privDer, passphrase) {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const k = crypto.scryptSync(passphrase, salt, 32, SCRYPT);
  const c = crypto.createCipheriv('aes-256-gcm', k, iv);
  const body = Buffer.concat([c.update(privDer), c.final()]);
  return { format: 'SYNK-KEY-1', kdf: 'scrypt', ...{ N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }, salt: salt.toString('base64'),
    iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), body: body.toString('base64') };
}

function unlockPrivate(locked, passphrase) {
  const k = crypto.scryptSync(passphrase, Buffer.from(locked.salt, 'base64'), 32, { N: locked.N, r: locked.r, p: locked.p, maxmem: SCRYPT.maxmem });
  const d = crypto.createDecipheriv('aes-256-gcm', k, Buffer.from(locked.iv, 'base64'));
  d.setAuthTag(Buffer.from(locked.tag, 'base64'));
  const der = Buffer.concat([d.update(Buffer.from(locked.body, 'base64')), d.final()]); // 암호가 틀리면 여기서 실패한다
  return crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
}

/** 읽기 흐름을 받아 암호문 파일을 쓴다. 원본은 디스크에 쓰지 않는다. 원본 크기·sha256·md5(base64)를 돌려준다. */
async function encryptStream(pubPem, readable, outPath, name) {
  const fileKey = crypto.randomBytes(32), iv = crypto.randomBytes(12);
  const wrapped = crypto.publicEncrypt({ key: pubPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, fileKey);
  const head = { alg: 'RSA-OAEP-256+AES-256-GCM', keyId: keyId(pubPem), wrappedKey: wrapped.toString('base64'), iv: iv.toString('base64'), name, at: new Date().toISOString() };
  const c = crypto.createCipheriv('aes-256-gcm', fileKey, iv);
  const sha = crypto.createHash('sha256'), md5 = crypto.createHash('md5');
  const part = outPath + '.part';
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const w = fs.createWriteStream(part, { mode: 0o600 });
  const write = (b) => (w.write(b) ? null : new Promise((ok) => w.once('drain', ok)));
  await write(Buffer.from(MAGIC + JSON.stringify(head) + '\n'));
  let bytes = 0;
  for await (const chunk of readable) {
    const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += b.length; sha.update(b); md5.update(b);
    const p = write(c.update(b)); if (p) await p;
  }
  await write(Buffer.concat([c.final(), c.getAuthTag()]));
  await new Promise((ok, no) => w.end((e) => (e ? no(e) : ok())));
  fs.renameSync(part, outPath);
  return { bytes, sha256: sha.digest('hex'), md5b64: md5.digest('base64'), keyId: head.keyId };
}

async function decryptFile(privKey, inPath, outPath) {
  const fd = fs.openSync(inPath, 'r');
  const size = fs.fstatSync(fd).size;
  const headBuf = Buffer.alloc(Math.min(size, 8192));
  fs.readSync(fd, headBuf, 0, headBuf.length, 0);
  fs.closeSync(fd);
  if (headBuf.slice(0, MAGIC.length).toString() !== MAGIC) throw new Error('SYNK-ENC-1 파일이 아니다');
  const nl = headBuf.indexOf(10, MAGIC.length);
  const head = JSON.parse(headBuf.slice(MAGIC.length, nl).toString());
  const start = nl + 1, tagAt = size - 16;
  const tag = Buffer.alloc(16);
  const fd2 = fs.openSync(inPath, 'r'); fs.readSync(fd2, tag, 0, 16, tagAt); fs.closeSync(fd2);
  const fileKey = crypto.privateDecrypt({ key: privKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(head.wrappedKey, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', fileKey, Buffer.from(head.iv, 'base64'));
  d.setAuthTag(tag);
  const part = outPath + '.part';
  const w = fs.createWriteStream(part, { mode: 0o600 });
  const sha = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(inPath, { start, end: tagAt - 1 })) {
    const b = d.update(chunk); sha.update(b);
    if (!w.write(b)) await new Promise((ok) => w.once('drain', ok));
  }
  try { const b = d.final(); sha.update(b); w.write(b); } // 태그가 틀리면 여기서 실패한다
  catch (e) { w.destroy(); fs.rmSync(part, { force: true }); throw new Error('인증 태그가 맞지 않는다 — 파일이 바뀌었거나 열쇠가 다르다'); }
  await new Promise((ok, no) => w.end((e) => (e ? no(e) : ok())));
  fs.renameSync(part, outPath);
  return { name: head.name, sha256: sha.digest('hex') };
}

/** 암호를 묻는다. 글자 대신 *를 보여 준다(유호님 터미널에서만 쓴다).
 * 터미널에 따라 Enter가 "\r\n"이나 다른 글자와 한 덩어리로 들어오므로 글자마다 나눠 본다(10-17 앱 터미널에서 Enter를 못 알아봐 멈춘 듯 보였다). */
function askHidden(q) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') { reject(new Error('키 입력을 받을 수 있는 터미널 창에서 실행한다(파일·파이프 입력은 안 받는다)')); return; }
    process.stdout.write(q);
    let s = '';
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
    const done = () => { stdin.setRawMode(false); stdin.pause(); stdin.off('data', on); process.stdout.write('\n'); resolve(s); };
    const on = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') { done(); return; }
        if (ch === '\u0003') { process.stdout.write('\n'); process.exit(130); }
        if (ch === '\u0008' || ch === '\u007f') { if (s) { s = s.slice(0, -1); process.stdout.write('\b \b'); } continue; }
        if (ch < ' ') continue; // 화살표 등 제어 글자는 버린다
        s += ch;
        process.stdout.write('*');
      }
    };
    stdin.on('data', on);
  });
}

function makeKeys(passphrase) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 4096 });
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' });
  const locked = lockPrivate(privateKey.export({ type: 'pkcs8', format: 'der' }), passphrase);
  return { pubPem, locked };
}

async function main(argv) {
  const cmd = argv[0];
  if (cmd === '열쇠만들기') {
    if (fs.existsSync(PUB()) || fs.existsSync(PRIV())) throw new Error(`이미 열쇠가 있다: ${KEY_DIR} — 덮어쓰지 않는다`);
    console.log('창고 암호 열쇠를 만든다. 암호는 화면에 보이지 않고 어디에도 저장되지 않는다. 잊으면 백업을 풀 수 없다.');
    const a = await askHidden('암호(12자 이상): ');
    if (a.length < 12) throw new Error('12자 이상으로 다시');
    const b = await askHidden('한 번 더: ');
    if (a !== b) throw new Error('두 암호가 다르다 — 다시');
    console.log('열쇠를 만드는 중(몇 초)…');
    const { pubPem, locked } = makeKeys(a);
    unlockPrivate(locked, a); // 바로 풀어 본다
    fs.mkdirSync(KEY_DIR, { recursive: true });
    fs.writeFileSync(PUB(), pubPem);
    fs.writeFileSync(PRIV(), JSON.stringify(locked, null, 1), { mode: 0o600 });
    console.log(`만들었다: ${PUB()} · ${PRIV()} (열쇠 번호 ${keyId(pubPem)})`);
    console.log('비밀키_잠금.json은 암호로 잠겨 있다. USB나 암호 관리자 등 PC 밖에도 한 부 두면 PC를 잃어도 백업을 풀 수 있다.');
    return 0;
  }
  if (cmd === '풀기') {
    const [inPath, outArg] = argv.slice(1);
    const pass = await askHidden('암호: ');
    const priv = unlockPrivate(JSON.parse(fs.readFileSync(PRIV(), 'utf8')), pass);
    const out = outArg || inPath.replace(/\.enc$/, '');
    const r = await decryptFile(priv, inPath, out);
    console.log(`되살림: ${out} sha256 ${r.sha256}`);
    return 0;
  }
  if (cmd === '시험') {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), '창고암호-'));
    const { pubPem, locked } = makeKeys('test-passphrase-only');
    const src = path.join(dir, 'src.bin');
    fs.writeFileSync(src, crypto.randomBytes(30 * 1024 * 1024 + 123));
    const want = crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex');
    const e = await encryptStream(pubPem, fs.createReadStream(src), path.join(dir, 'src.bin.enc'), 'src.bin');
    const r = await decryptFile(unlockPrivate(locked, 'test-passphrase-only'), path.join(dir, 'src.bin.enc'), path.join(dir, 'back.bin'));
    let wrongPass = false; try { unlockPrivate(locked, 'wrong'); } catch { wrongPass = true; }
    const enc = fs.readFileSync(path.join(dir, 'src.bin.enc')); enc[enc.length - 100] ^= 1; fs.writeFileSync(path.join(dir, 'bad.enc'), enc);
    let tamper = false; try { await decryptFile(unlockPrivate(locked, 'test-passphrase-only'), path.join(dir, 'bad.enc'), path.join(dir, 'bad.out')); } catch { tamper = true; }
    console.log(JSON.stringify({ 왕복: r.sha256 === want && e.sha256 === want, 크기: e.bytes, 틀린암호거절: wrongPass, 변조거절: tamper, 변조출력없음: !fs.existsSync(path.join(dir, 'bad.out')) }));
    fs.rmSync(dir, { recursive: true, force: true });
    return 0;
  }
  console.error('사용: node 암호.js 열쇠만들기 | 풀기 <파일.enc> [출력] | 시험');
  return 2;
}

module.exports = { encryptStream, decryptFile, unlockPrivate, makeKeys, keyId, PUB, PRIV, KEY_DIR };
/* 열쇠 만들기 결과는 암호 없이 열쇠기록.log에 남긴다 — 창을 닫은 뒤에도 무슨 일이 있었는지 볼 수 있게(10-17). */
const 기록 = (m) => { try { fs.appendFileSync(path.join(__dirname, '열쇠기록.log'), `${new Date().toISOString()} ${m}\n`); } catch {} };
if (require.main === module) {
  if (process.argv[2] === '열쇠만들기') 기록('시작');
  main(process.argv.slice(2)).then(
    (c) => { process.exitCode = c; if (process.argv[2] === '열쇠만들기') 기록(`끝 ${c}`); },
    (e) => { console.error(`\n실패: ${e.message}`); process.exitCode = 1; if (process.argv[2] === '열쇠만들기') 기록(`실패: ${e.message}`); });
}
