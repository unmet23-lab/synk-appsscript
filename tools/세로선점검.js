#!/usr/bin/env node
/* 한 영상이 «세로선으로부터 깨끗한가»를 한 줄로 판정한다 — 0원.
 *
 * 09-05: 세로선이 카메라와 함께 «움직인다»는 것을 알았다(1.5초 x=1499 → 4.5초 x=3180).
 * 그래서 고정 자리를 지우는 방식이 못 쓰게 됐고, 남은 길은 «깨끗한 판을 고르거나 다시 굽는 것»이다.
 * 그 고르기를 눈이 아니라 수로 하려고 짓는다.
 *
 * 판정 = 여러 시점을 재서 «가장 큰 튐»의 최댓값. 실측 기준:
 *   150 이상 = 눈에 확 띈다   ·   60~150 = 보인다   ·   30 미만 = 깨끗하다
 *
 * 쓰기: node tools/세로선점검.js 영상/out/홍보_4K_v2/컷8_둘이.mp4 [또 다른 파일…]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const 폭 = 3840;
const 높 = 2160;
const 볼때 = ['1.5', '3.0', '4.5', '6.0', '7.5'];

function 잰다(파일, 때) {
  const 임시 = path.join(os.tmpdir(), 'synk_선점검.raw');
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', 때, '-i', 파일,
      '-vf', 'format=gray', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', 임시],
    { stdio: ['ignore', 'ignore', 'ignore'] });
  } catch { return null; }
  const 픽 = fs.readFileSync(임시);
  if (픽.length < 폭 * 높) return null;
  const 합 = new Float64Array(폭);
  for (let y = 0; y < 높; y += 8) {
    const 밑 = y * 폭;
    for (let x = 3; x < 폭 - 3; x++) {
      합[x] += Math.abs(픽[밑 + x] - (픽[밑 + x - 3] + 픽[밑 + x + 3]) / 2);
    }
  }
  const 행수 = Math.ceil(높 / 8);
  let 최대 = 0; let 자리 = 0;
  for (let x = 3; x < 폭 - 3; x++) { const v = 합[x] / 행수; if (v > 최대) { 최대 = v; 자리 = x; } }
  return { 최대, 자리 };
}

(async () => {
  const 파일들 = process.argv.slice(2);
  if (!파일들.length) { console.log('쓰기: node tools/세로선점검.js <mp4> [<mp4>…]'); process.exit(2); }

  for (const f of 파일들) {
    if (!fs.existsSync(f)) { console.log(`🔴 없다: ${f}`); continue; }
    let 최악 = { 최대: 0, 자리: 0, 때: '' };
    for (const 때 of 볼때) {
      const r = 잰다(f, 때);
      if (r && r.최대 > 최악.최대) 최악 = { ...r, 때 };
    }
    const 판정 = 최악.최대 >= 150 ? '🔴 확 띈다' : 최악.최대 >= 60 ? '🟠 보인다' : '✅ 깨끗하다';
    console.log(`${판정}  ${최악.최대.toFixed(0).padStart(4)}  (${최악.때}초 x=${최악.자리})  ${path.basename(f)}`);
  }
})();
