// 읽기 전용 원천 → 독립 QA 폴더에만 사용 크기 파생 이미지를 생성한다.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve(__dirname, '..');
const out = path.join(__dirname, '사용크기');
const files = [
  '02-lab-instagram/upload-04.jpg',
  '08-synkbrief-instagram/upload-06.jpg',
  '13-yuhobuilds-linkedin/upload-01.jpg',
  '14-lab-telegram/upload-01.jpg',
  '16-synk-instagram/upload-01.jpg',
  '19-shift-pinterest/upload-01.jpg',
];
(async () => {
  fs.mkdirSync(out, {recursive: true});
  const records = [];
  for (const rel of files) {
    const source = path.join(root, rel);
    const target = path.join(out, rel.replace(/[\\/]/g, '__').replace('.jpg', '__390.png'));
    await sharp(source).resize({width: 390}).png().toFile(target);
    records.push({source: rel, sha256: crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'), qa: path.basename(target), width: 390});
  }
  fs.writeFileSync(path.join(out, '원천.json'), JSON.stringify({checkedAt: new Date().toISOString(), records}, null, 2) + '\n');
  console.log(JSON.stringify({count: records.length, records}, null, 2));
})();
