'use strict';
/**
 * 표준입력을 받으면서 바로 유호님 공개키로 암호화해 파일로만 쓴다(평문은 디스크에 안 남는다). 암호묶음.py가 부른다.
 *   node 암호흐름.cjs <출력.enc> <이름> [--공개키 <공개키.pem>]
 * 끝나면 표준출력에 {bytes, sha256, keyId}를 낸다. 풀기는 같은 형식(SYNK-ENC-1)을 쓰는 원본창고 암호.js · 복원풀기.cjs가 한다.
 */
const fs = require('fs');
const 암호 = require('./암호.js');

function 인자값(이름) {
  const i = process.argv.indexOf(이름);
  return i >= 0 ? process.argv[i + 1] : null;
}

async function main() {
  const [출력, 이름] = process.argv.slice(2);
  if (!출력 || !이름) throw new Error('사용: node 암호흐름.cjs <출력.enc> <이름>');
  const 공개키 = 인자값('--공개키') || 암호.PUB();
  if (!fs.existsSync(공개키)) throw new Error(`공개키가 없다: ${공개키}`);
  const e = await 암호.encryptStream(fs.readFileSync(공개키, 'utf8'), process.stdin, 출력, 이름);
  if (!e.bytes) { fs.rmSync(출력, { force: true }); throw new Error('입력이 비었다'); }
  process.stdout.write(JSON.stringify({ bytes: e.bytes, sha256: e.sha256, keyId: e.keyId }) + '\n');
}

main().catch((e) => { process.stderr.write(`${e.message}\n`); process.exitCode = 1; });
