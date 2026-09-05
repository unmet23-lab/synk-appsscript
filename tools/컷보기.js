#!/usr/bin/env node
/* 구운 컷을 «눈으로 재는» 자 — 프레임 몇 장을 가로로 이어 한 장으로 낸다.
 *
 * ■ 왜 필요한가
 *   영상은 끝까지 봐야 어긋난 자리가 보인다. 그런데 어긋남은 대개 «몇 초 지점»에서만 난다
 *   (09-05 실측: 몽글이 눈은 3~5초에서만 뭉갰고, 까몽이는 4초 뒤부터 딴 고양이가 됐다).
 *   그래서 앞·중간·뒤를 한 장에 놓고 본다.
 *
 * ■ 쓰기
 *   node tools/컷보기.js 5 7 8        — 그 컷들
 *   node tools/컷보기.js              — 있는 컷 전부
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const 뿌리 = path.join(__dirname, '..');
const 방 = path.join(뿌리, '영상', 'out', '홍보_4K_v2');
const 낼곳 = path.join(방, '_확인');
const 프레임들 = [24, 72, 120, 168];      // 1초 · 3초 · 5초 · 7초 (24fps)

(async () => {
  const 고른 = process.argv.slice(2).map(Number).filter((n) => !Number.isNaN(n));
  const 파일들 = fs.readdirSync(방).filter((n) => /^컷\d+_.*\.mp4$/.test(n.normalize('NFC')))
    .filter((n) => !고른.length || 고른.includes(Number(n.match(/^컷(\d+)/)[1])))
    .sort((a, b) => Number(a.match(/^컷(\d+)/)[1]) - Number(b.match(/^컷(\d+)/)[1]));

  if (!파일들.length) { console.log('🔴 볼 컷이 없다.'); process.exit(1); }
  fs.mkdirSync(낼곳, { recursive: true });

  for (const f of 파일들) {
    const 고른칸 = 프레임들.map((n) => `eq(n\\,${n})`).join('+');
    const 낼것 = path.join(낼곳, f.replace('.mp4', '.jpg'));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(방, f),
      '-vf', `select='${고른칸}',scale=460:-1,tile=${프레임들.length}x1`,
      '-frames:v', '1', 낼것]);
    console.log(`✅ ${path.basename(낼것)}  (1·3·5·7초)`);
  }
  console.log(`\n${낼곳}`);
})();
