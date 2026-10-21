// 영상이 읽는 그림 사본을 만든다(public/img는 git 밖). 원본은 ../그림/화면/(그림/구글카드캡처.mjs가 뜬 실제 화면).
//   node scripts/img.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.mkdirSync(path.join(ROOT, 'public/img'), { recursive: true });
fs.copyFileSync(path.join(ROOT, '../그림/화면/google-aipro-카드-3x.png'), path.join(ROOT, 'public/img/google-aipro-card.png'));
console.log('public/img/google-aipro-card.png');
