#!/usr/bin/env node
/**
 * 구운 영상에서 프레임 몇 장을 뽑아 «눈으로 볼 수 있게» 한 장으로 붙인다.
 *
 * 🔑 이것이 검증의 마지막 겹이다. 앞의 `굽기.js` 가 잡는 것은 «기계가 볼 수 있는 것»뿐이고,
 *   두부(□□□)·틀린 서체·깨진 구도는 로그에 한 줄도 안 남는다. 사람이 봐야 한다.
 *   특히 볼 것: 한글과 몽골 키릴(Ө Ү ө ү)이 네모칸이 아니라 «글자»로 보이는가.
 *
 * 쓰기: node 영상/프레임뽑기.js <영상파일명> [장수]
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const 산출방 = path.join(__dirname, 'out');
const 이름 = process.argv[2];
const 장수 = Number(process.argv[3] || 5);

if (!이름) {
  console.error('쓰기: node 영상/프레임뽑기.js <영상파일명> [장수]');
  process.exit(2);
}

const 영상 = path.join(산출방, 이름);
if (!fs.existsSync(영상)) {
  console.error(`🔴 없는 파일: ${영상}`);
  process.exit(1);
}

function ffprobe(인자들) {
  const r = spawnSync('ffprobe', 인자들, { encoding: 'utf8' });
  return (r.stdout || '').trim();
}
function ffmpeg(인자들) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...인자들], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(r.stderr || '');
    process.exit(1);
  }
}

const 길이 = Number(
  ffprobe(['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', 영상]),
);
if (!길이) {
  console.error('🔴 길이를 못 읽었다 — 영상이 온전하지 않을 수 있다.');
  process.exit(1);
}

/* 양 끝을 피해 고르게 뽑는다 — 첫 프레임은 페이드 중이라 대표성이 없다. */
const 자리 = Array.from({ length: 장수 }, (_, i) => ((i + 0.5) / 장수) * 길이);
const 조각 = [];

자리.forEach((초, i) => {
  const 나온것 = path.join(산출방, `_프레임_${i}.png`);
  ffmpeg(['-ss', String(초), '-i', 영상, '-frames:v', '1', '-vf', 'scale=360:-1', 나온것]);
  조각.push(나온것);
});

const 붙인것 = path.join(산출방, `${path.parse(이름).name}_프레임.png`);
ffmpeg([
  ...조각.flatMap((p) => ['-i', p]),
  '-filter_complex',
  `${조각.map((_, i) => `[${i}:v]`).join('')}hstack=inputs=${조각.length}`,
  붙인것,
]);
for (const p of 조각) fs.unlinkSync(p);

console.log(`✅ ${path.relative(process.cwd(), 붙인것)}`);
console.log(`   길이 ${길이.toFixed(1)}초 · ${장수}장 · ${자리.map((s) => s.toFixed(1) + 's').join(' · ')}`);
console.log('   👀 볼 것: 한글·키릴이 □□□ 가 아닌가 · 서체가 SUIT/Inter Tight 인가 · 구도가 잘리지 않았나');
