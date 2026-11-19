// 렌더한 그림들을 기준 사진(assets/felt-coral.webp)과 같은 크기로 나란히 놓은 판 한 장을 만든다.
//   node docs/디자인/SYNK마스코트_큐브_20261119/블렌더/견주기.cjs <나갈 판.png> <렌더1.png> [렌더2.png …]
const path = require('node:path');
const 뿌리 = path.resolve(__dirname, '../../../..');
const sharp = require(path.join(뿌리, 'desktop/node_modules/sharp'));
const [out, ...renders] = process.argv.slice(2);
const 칸 = 640;
(async () => {
  const 그림 = [path.join(__dirname, '../assets/felt-coral.webp'), ...renders.map(f => path.resolve(f))];
  const 조각 = await Promise.all(그림.map(f => sharp(f).resize(칸, 칸, { fit: 'contain', background: '#000' }).flatten({ background: '#000' }).png().toBuffer()));
  await sharp({ create: { width: 칸 * 조각.length, height: 칸, channels: 3, background: '#000' } })
    .composite(조각.map((input, i) => ({ input, left: 칸 * i, top: 0 }))).png().toFile(path.resolve(out));
  console.log('견줄 판 ' + 조각.length + '칸 → ' + out);
})().catch(e => { console.error(e.message); process.exit(1); });
