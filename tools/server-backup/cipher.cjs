'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const MAGIC='SYNK-ENC-1\n';
const keyId=pub=>crypto.createHash('sha256').update(crypto.createPublicKey(pub).export({type:'spki',format:'der'})).digest('hex').slice(0,16);
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


module.exports={encryptStream,keyId};
