#!/usr/bin/env node
/* 컷에 박힌 «세로선»의 x 자리를 찾는다 — 0원.
 *
 * 09-05: 밑그림을 넣은 컷(5·7·8)마다 세로선이 하나씩 있다(유호 「지지직거리는 느낌」).
 * 프레임마다 «같은 자리»라 흐리게 해서는 안 걷히고, 자리를 알면 그 줄만 골라 지울 수 있다.
 *
 * 재는 법: 한 프레임을 아주 낮은 세로 해상도로 눌러(가로만 남긴다) 이웃 열끼리의 차를 본다.
 * 세로선은 «세로 전체»에 걸쳐 있어서 눌러도 살아남고, 물체의 경계는 눌리면서 뭉개진다.
 *
 * 쓰기: node tools/세로선찾기.js 7
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const 뿌리 = path.join(__dirname, '..');
const 방 = path.join(뿌리, '영상', 'out', '홍보_4K_v2');

(async () => {
  const 번호 = process.argv[2];
  const f = fs.readdirSync(방).find((n) => n.normalize('NFC').startsWith(`컷${번호}_`) && n.endsWith('.mp4'));
  if (!f) { console.log(`🔴 컷${번호} 가 없다.`); process.exit(1); }

  /* 세로를 1픽셀로 눌러 «가로 프로파일»만 남긴 뒤 raw 로 받는다. */
  const 임시 = path.join(os.tmpdir(), `synk_세로선_${번호}.raw`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '3.0', '-i', path.join(방, f),
    '-vf', 'format=gray,scale=3840:1', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', 임시]);

  const 줄 = fs.readFileSync(임시);
  /* 이웃과의 차 — 세로선은 «한두 열만» 튄다. 넓게 변하는 그림자·창빛과 갈린다. */
  const 튐 = [];
  for (let x = 2; x < 줄.length - 2; x++) {
    const 이웃 = (줄[x - 2] + 줄[x + 2]) / 2;
    튐.push({ x, 값: Math.abs(줄[x] - 이웃) });
  }
  튐.sort((a, b) => b.값 - a.값);

  /* 가까운 것끼리 묶어 «자리»로 낸다(한 선이 서너 열을 차지한다). */
  const 자리 = [];
  for (const t of 튐.slice(0, 40)) {
    const 있 = 자리.find((z) => Math.abs(z.x - t.x) < 30);
    if (있) { 있.값 = Math.max(있.값, t.값); 있.폭 += 1; } else 자리.push({ x: t.x, 값: t.값, 폭: 1 });
  }
  console.log(`■ 컷${번호} — 튀는 자리(위에서부터)`);
  자리.slice(0, 6).forEach((z) => console.log(`   x=${z.x}  튐=${z.값}  열수≈${z.폭}`));
  fs.unlinkSync(임시);
})();
