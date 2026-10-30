// V1 프레임마다 넣은 사진의 테두리(화면 비율 네 점) · 사진 밖 % → src/y24/data.generated.ts. node 데이터.mjs (remotion 폴더에서)
// 원본은 ../자료/V1_사진밖.json(../사진밖재기.py --간격 0.041667, 24fps 모든 프레임). 5프레임 평균으로 떨림만 고른다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const src = JSON.parse(fs.readFileSync(path.join(HERE, '..', '자료', 'V1_사진밖.json'), 'utf8'));
const rows = src['프레임'];
const K = 2;
const quads = rows.map((_, i) => {
  const win = rows.slice(Math.max(0, i - K), i + K + 1).filter((r) => r['테두리']);
  return [0, 1, 2, 3].map((p) => [0, 1].map((c) => +(win.reduce((s, r) => s + r['테두리'][p][c], 0) / win.length).toFixed(4)));
});
const outside = rows.map((r) => r['사진밖_화면비'] ?? 0);
const ts = `// node 데이터.mjs가 만든 파일. 고치지 말고 다시 만든다.\n// V1(24fps) 프레임마다 넣은 사진 테두리 [왼위, 오른위, 오른아래, 왼아래] — 화면 비율 좌표, 사진 밖 % (끝 ${outside[outside.length - 1]}%)\nexport const QUADS: readonly (readonly (readonly [number, number])[])[] = ${JSON.stringify(quads)};\nexport const OUTSIDE: readonly number[] = ${JSON.stringify(outside)};\n`;
fs.writeFileSync(path.join(HERE, 'src', 'y24', 'data.generated.ts'), ts);
console.log(`프레임 ${quads.length} · 끝 사진 밖 ${outside[outside.length - 1]}%`);
