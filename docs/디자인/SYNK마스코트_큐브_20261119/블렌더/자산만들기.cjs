// 블렌더 렌더(작업 폴더 .tmp/synk-cube-blender-20261119/out)를 시안 페이지가 쓰는 webp로 옮긴다. 저장소 뿌리에서 돌린다.
//   node docs/디자인/SYNK마스코트_큐브_20261119/블렌더/자산만들기.cjs
// 판마다 큰 한 장(still), 좌우로 도는 아홉 장을 가로로 이은 띠(turn), 구(sphere), 크림 색(cream)을 만든다.
const path = require('node:path');
const 뿌리 = path.resolve(__dirname, '../../../..');
const sharp = require(path.join(뿌리, 'desktop/node_modules/sharp'));
const 렌더 = path.join(뿌리, '.tmp/synk-cube-blender-20261119/out');
const 자산 = path.join(__dirname, '../assets');
const 판 = [{ 이름: 'gpt', 큰장: 'gpt_r2_dot.png' }, { 이름: 'carbon', 큰장: 'carbon_r2_dot.png' }];
const 띠칸 = 440, 띠장 = 9;
(async () => {
  for (const p of 판) {
    await sharp(path.join(렌더, p.큰장)).resize(880, 880).webp({ quality: 84 }).toFile(path.join(자산, `bl-${p.이름}-still.webp`));
    const 조각 = [];
    for (let i = 0; i < 띠장; i++) 조각.push({ input: await sharp(path.join(렌더, p.이름, `turn_${i}.png`)).resize(띠칸, 띠칸).png().toBuffer(), left: 띠칸 * i, top: 0 });
    await sharp({ create: { width: 띠칸 * 띠장, height: 띠칸, channels: 3, background: '#000' } }).composite(조각).webp({ quality: 80 }).toFile(path.join(자산, `bl-${p.이름}-turn.webp`));
    for (const n of ['sphere', 'cream']) await sharp(path.join(렌더, p.이름, n + '.png')).resize(440, 440).webp({ quality: 82 }).toFile(path.join(자산, `bl-${p.이름}-${n}.webp`));
  }
  console.log('자산 ' + 판.length * 4 + '장');
})().catch(e => { console.error(e.message); process.exit(1); });
