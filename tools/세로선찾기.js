#!/usr/bin/env node
/* 컷에 박힌 «세로선»의 x 자리를 찾는다 — 0원.
 *
 * 09-05: 밑그림을 넣은 컷마다 세로선이 하나씩 있다(유호 「지지직거리는 느낌」).
 * 프레임마다 «같은 자리»라 흐리게 해서는 안 걷히고, 자리를 알면 그 줄만 골라 지울 수 있다.
 *
 * 🔴 첫 판은 세로를 1픽셀로 눌러 재려 했는데 틀렸다 — 누르면 세로선도 같이 평균에 묻힌다.
 *    지금 판은 **모든 행에서 이웃과의 차를 더한다.** 세로선은 «모든 행»에서 같은 x 에 서므로
 *    합이 크게 튀고, 물체의 경계는 몇몇 행에만 있어서 안 튄다.
 *
 * 쓰기: node tools/세로선찾기.js 8            — 컷8
 *      node tools/세로선찾기.js 8 4.0        — 그 시각의 프레임으로
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const 뿌리 = path.join(__dirname, '..');
const 방 = path.join(뿌리, '영상', 'out', '홍보_4K_v2');
const 폭 = 3840;
const 높 = 2160;

(async () => {
  const 번호 = process.argv[2];
  const 때 = process.argv[3] || '3.0';
  const f = fs.readdirSync(방).find((n) => n.normalize('NFC').startsWith(`컷${번호}_`) && n.endsWith('.mp4'));
  if (!f) { console.log(`🔴 컷${번호} 가 없다.`); process.exit(1); }

  const 임시 = path.join(os.tmpdir(), `synk_세로선_${번호}.raw`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', 때, '-i', path.join(방, f),
    '-vf', 'format=gray', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', 임시]);

  const 픽 = fs.readFileSync(임시);
  /* 🔴 «합»으로 재면 강한 선 하나가 나머지를 덮는다(09-05: 154 짜리 하나를 지웠더니 70·40 짜리
   *   둘이 그대로 남아 유호님이 다시 보셨다). 그래서 «몇 %의 행에서 튀나»를 센다 —
   *   세로선은 화면 «전체 높이»에 걸쳐 있어 비율이 90% 를 넘고, 물체의 경계는 몇몇 행뿐이다. */
  const 튄행 = new Int32Array(폭);
  const 합 = new Float64Array(폭);
  const 문턱 = 2.2;                       // 이만큼 튀면 «그 행에서 선이 있다»로 센다
  for (let y = 0; y < 높; y += 4) {
    const 밑 = y * 폭;
    for (let x = 3; x < 폭 - 3; x++) {
      const 이웃 = (픽[밑 + x - 3] + 픽[밑 + x + 3]) / 2;
      const 차 = Math.abs(픽[밑 + x] - 이웃);
      합[x] += 차;
      if (차 >= 문턱) 튄행[x] += 1;
    }
  }
  const 행수 = Math.ceil(높 / 4);
  const 자리 = [];
  for (let x = 3; x < 폭 - 3; x++) 자리.push({ x, 값: 합[x] / 행수, 비율: 튄행[x] / 행수 });
  /* 세로선은 «세로로 이어지는 것»이므로 비율이 먼저고 세기는 그다음이다. */
  자리.sort((a, b) => (b.비율 - a.비율) || (b.값 - a.값));

  /* 가까운 것끼리 묶는다(한 선이 두세 열을 차지한다). */
  const 묶음 = [];
  for (const t of 자리.slice(0, 200)) {
    const 있 = 묶음.find((z) => Math.abs(z.x - t.x) < 40);
    if (있) { if (t.값 > 있.값) { 있.값 = t.값; 있.x = t.x; } 있.열 += 1; } else 묶음.push({ x: t.x, 값: t.값, 열: 1 });
  }
  console.log(`■ 컷${번호} (${때}초) — 세로로 이어지는 튐`);
  묶음.slice(0, 6).forEach((z) => console.log(`   x=${z.x}  평균튐=${z.값.toFixed(2)}  열수≈${z.열}`));
  fs.unlinkSync(임시);
})();
