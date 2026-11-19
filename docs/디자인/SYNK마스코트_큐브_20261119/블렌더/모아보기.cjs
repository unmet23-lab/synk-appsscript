// 그림 여러 장을 한 줄에 놓은 판을 만든다(렌더 확인용).
//   node docs/디자인/SYNK마스코트_큐브_20261119/블렌더/모아보기.cjs <나갈 판.png> <칸 픽셀> <그림1> [그림2 …]
const path = require('node:path');
const 뿌리 = path.resolve(__dirname, '../../../..');
const sharp = require(path.join(뿌리, 'desktop/node_modules/sharp'));
const [out, 칸글, ...그림] = process.argv.slice(2);
const 칸 = Number(칸글);
(async () => {
  const 조각 = await Promise.all(그림.map(f => sharp(path.resolve(f)).resize(칸, 칸, { fit: 'contain', background: '#000' }).flatten({ background: '#000' }).png().toBuffer()));
  await sharp({ create: { width: 칸 * 조각.length, height: 칸, channels: 3, background: '#000' } })
    .composite(조각.map((input, i) => ({ input, left: 칸 * i, top: 0 }))).png().toFile(path.resolve(out));
  console.log('모아 본 판 ' + 조각.length + '칸 → ' + out);
})().catch(e => { console.error(e.message); process.exit(1); });
