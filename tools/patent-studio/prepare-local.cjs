'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const args = process.argv.slice(2);
const value = flag => args[args.indexOf(flag) + 1];
if (!['--python', '--model', '--data'].every(flag => args.includes(flag))) {
  console.error('사용: node prepare-local.cjs --python <python.exe> --model <설치된 모델 폴더> --data <기존 자료 폴더>');
  process.exit(1);
}
const python = path.resolve(value('--python')), modelPath = path.resolve(value('--model')), directory = path.resolve(value('--data'));
if (!fs.statSync(python).isFile() || !fs.statSync(directory).isDirectory()) throw new Error('실제 실행 파일과 자료 폴더가 필요합니다.');
const files = ['model.bin', 'config.json', 'tokenizer.json', 'vocabulary.txt'].map(name => {
  const bytes = fs.readFileSync(path.join(modelPath, name));
  return { name, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
});
const modelFingerprint = crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex');
const runtime = path.join(__dirname, '.runtime'); fs.mkdirSync(runtime, { recursive: true });
fs.writeFileSync(path.join(runtime, 'local-stt.json'), JSON.stringify({ python, modelPath,
  modelId: 'faster-whisper-small@' + modelFingerprint.slice(0, 12), modelFingerprint, files }, null, 2));
fs.writeFileSync(path.join(runtime, 'studio.json'), JSON.stringify({ directory }, null, 2));
console.log('현재 기기에 설치된 로컬 런타임을 연결했습니다. verify-runtime.cjs로 실제 전사를 확인하세요.');
